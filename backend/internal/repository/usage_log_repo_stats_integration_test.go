//go:build integration

package repository

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestUsageLog_UpstreamModelMismatchFilterAndPartialIndex(t *testing.T) {
	ctx := context.Background()
	tx := testEntTx(t)
	client := tx.Client()
	repo := newUsageLogRepositoryWithSQL(client, tx)

	user := mustCreateUser(t, client, &service.User{Email: "model-audit@test.com"})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "sk-model-audit", Name: "model-audit"})
	account := mustCreateAccount(t, client, &service.Account{Name: "model-audit-account"})
	now := time.Now().UTC()
	responseModel := "gpt-5.4"
	for _, mismatch := range []bool{true, false} {
		mismatchValue := mismatch
		_, err := repo.Create(ctx, &service.UsageLog{
			UserID: user.ID, APIKeyID: apiKey.ID, AccountID: account.ID,
			Model: "gpt-5.5", InputTokens: 1, OutputTokens: 1,
			UpstreamResponseModel: &responseModel, UpstreamModelMismatch: &mismatchValue,
			CreatedAt: now,
		})
		require.NoError(t, err)
	}

	start := now.Add(-time.Hour)
	end := now.Add(time.Hour)
	trueValue := true
	stats, err := repo.GetStatsWithFilters(ctx, usagestats.UsageLogFilters{
		UserID: user.ID, StartTime: &start, EndTime: &end, UpstreamModelMismatch: &trueValue,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), stats.TotalRequests)
	require.Equal(t, []usagestats.EndpointStat{{
		Endpoint: "unknown", Requests: 1, TotalTokens: 2,
	}}, stats.Endpoints)
	require.Equal(t, []usagestats.EndpointStat{{
		Endpoint: "unknown", Requests: 1, TotalTokens: 2,
	}}, stats.UpstreamEndpoints)
	require.Equal(t, []usagestats.EndpointStat{{
		Endpoint: "unknown -> unknown", Requests: 1, TotalTokens: 2,
	}}, stats.EndpointPaths)

	trend, err := repo.GetUsageTrendWithUsageFilters(ctx, start, end, "hour", usagestats.UsageLogFilters{
		UserID: user.ID, UpstreamModelMismatch: &trueValue,
	})
	require.NoError(t, err)
	require.Len(t, trend, 1)
	require.Equal(t, int64(1), trend[0].Requests)

	_, err = tx.ExecContext(ctx, "SET LOCAL enable_seqscan = off")
	require.NoError(t, err)
	assertPlanUsesIndex := func(query, indexName string, args ...any) {
		rows, queryErr := tx.QueryContext(ctx, query, args...)
		require.NoError(t, queryErr)
		var planLines []string
		for rows.Next() {
			var line string
			require.NoError(t, rows.Scan(&line))
			planLines = append(planLines, line)
		}
		require.NoError(t, rows.Err())
		require.NoError(t, rows.Close())
		require.Contains(t, strings.Join(planLines, "\n"), indexName)
	}
	assertPlanUsesIndex(`
EXPLAIN (COSTS OFF)
SELECT id
FROM usage_logs
WHERE upstream_model_mismatch IS TRUE
ORDER BY created_at DESC, id DESC
LIMIT 100
`, usageLogsUpstreamModelMismatchIndex)
	assertPlanUsesIndex(`
EXPLAIN (COSTS OFF)
SELECT id
FROM usage_logs
WHERE COALESCE(NULLIF(TRIM(requested_model), ''), model) = $1
  AND created_at >= $2 AND created_at < $3
ORDER BY created_at DESC, id DESC
LIMIT 100
`, usageLogsEffectiveRequestedModelIndex, "gpt-5.5", start, end)
	assertPlanUsesIndex(`
EXPLAIN (COSTS OFF)
SELECT id
FROM usage_logs
WHERE COALESCE(NULLIF(TRIM(upstream_model), ''), model) = $1
  AND created_at >= $2 AND created_at < $3
ORDER BY created_at DESC, id DESC
LIMIT 100
`, usageLogsEffectiveUpstreamModelIndex, "gpt-5.5", start, end)
}

func TestUsageLog_GetStatsWithFilters_AggregatesAndEndpoints(t *testing.T) {
	ctx := context.Background()
	tx := testEntTx(t)
	client := tx.Client()
	repo := newUsageLogRepositoryWithSQL(client, tx)

	user := mustCreateUser(t, client, &service.User{Email: "stats@test.com"})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "sk-stats-1", Name: "k"})
	account := mustCreateAccount(t, client, &service.Account{Name: "acc-stats"})

	now := time.Now().UTC()
	inboundEndpoint := "/v1/messages"
	upstreamEndpoint := "/v1/responses"
	for i := 0; i < 3; i++ {
		_, err := repo.Create(ctx, &service.UsageLog{
			UserID: user.ID, APIKeyID: apiKey.ID, AccountID: account.ID,
			Model: "claude-3", InputTokens: 2, OutputTokens: 3,
			CacheCreationTokens: 4, CacheReadTokens: 5,
			TotalCost: 0.5, ActualCost: 0.4, CreatedAt: now,
			InboundEndpoint: &inboundEndpoint, UpstreamEndpoint: &upstreamEndpoint,
		})
		require.NoError(t, err)
	}

	start := now.Add(-1 * time.Hour)
	end := now.Add(1 * time.Hour)
	// 按本测试创建的 user 维度过滤:集成库为共享实例,其它用 testEntClient 的兄弟测试会留下
	// 已提交的 usage_log 行(含零 token 的失败请求),不限定 user 会把它们计入 TotalRequests。
	stats, err := repo.GetStatsWithFilters(ctx, usagestats.UsageLogFilters{UserID: user.ID, StartTime: &start, EndTime: &end})
	require.NoError(t, err)
	require.Equal(t, int64(3), stats.TotalRequests)
	require.Equal(t, int64(6), stats.TotalInputTokens)
	require.Equal(t, int64(9), stats.TotalOutputTokens)
	require.Equal(t, int64(27), stats.TotalCacheTokens)
	require.Equal(t, int64(12), stats.TotalCacheCreationTokens)
	require.Equal(t, int64(15), stats.TotalCacheReadTokens)
	require.InDelta(t, 1.2, stats.TotalActualCost, 1e-9)
	require.NotEmpty(t, stats.Endpoints)
	require.NotEmpty(t, stats.UpstreamEndpoints)
	require.NotEmpty(t, stats.EndpointPaths)
}

func TestUsageLog_UpstreamCacheHitRateAcrossRowsAndRollups(t *testing.T) {
	ctx := context.Background()
	tx := testEntTx(t)
	client := tx.Client()
	repo := newUsageLogRepositoryWithSQL(client, tx)
	rollups := newDashboardAggregationRepositoryWithSQL(tx)
	user := mustCreateUser(t, client, &service.User{Email: "cache-rate@example.test"})
	key := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "test-cache-rate", Name: "cache-rate"})
	account := mustCreateAccount(t, client, &service.Account{Name: "cache-rate"})
	start := time.Date(2040, 2, 3, 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)
	filters := usagestats.UsageLogFilters{UserID: user.ID, StartTime: &start, EndTime: &end}
	add := func(log service.UsageLog) *service.UsageLog {
		log.UserID, log.APIKeyID, log.AccountID = user.ID, key.ID, account.ID
		log.Model = "test-cache-rate"
		_, err := repo.Create(ctx, &log)
		require.NoError(t, err)
		saved, err := repo.GetByID(ctx, log.ID)
		require.NoError(t, err)
		return saved
	}
	check := func(want *float64) {
		t.Helper()
		stats, err := repo.GetStatsWithFilters(ctx, filters)
		require.NoError(t, err)
		require.Equal(t, want, stats.CacheHitRate)
		require.NoError(t, rollups.upsertHourlyAggregates(ctx, start, end))
		require.NoError(t, rollups.upsertDailyAggregates(ctx, start, end))
		for _, granularity := range []string{"hour", "day"} {
			raw, err := repo.GetUsageTrendWithUsageFilters(ctx, start, end, granularity, filters)
			require.NoError(t, err)
			cached, err := repo.getUsageTrendFromAggregates(ctx, start, end, granularity)
			require.NoError(t, err)
			require.NotEmpty(t, raw)
			require.Equal(t, raw, cached)
			if granularity == "day" {
				require.Len(t, raw, 1)
				require.Equal(t, want, raw[0].CacheHitRate)
			}
		}
	}
	// TTL-only and positive totals coexist in one hour. A COALESCE after SUM
	// would lose the first row's 250 writes or count the second row's twice.
	ttlOnly := add(service.UsageLog{CacheReadTokens: 250, CacheCreation5mTokens: 50, CacheCreation1hTokens: 200, CreatedAt: start})
	half := 0.5
	require.Equal(t, &half, ttlOnly.CacheHitRate())
	full := add(service.UsageLog{CacheReadTokens: 50, CacheCreationTokens: 50, CacheCreation5mTokens: 50, CreatedAt: start})
	require.Equal(t, &half, full.CacheHitRate())
	openAI := add(service.UsageLog{CacheReadTokens: 100, CacheCreation30mTokens: 40, CacheCreation12hTokens: 60, CreatedAt: start})
	require.Equal(t, &half, openAI.CacheHitRate())
	zero := 0
	discounted := add(service.UsageLog{CacheReadTokens: 200, UpstreamCacheReadTokens: &zero, CreatedAt: start.Add(time.Hour)})
	zeroRate := 0.0
	require.Equal(t, &zeroRate, discounted.CacheHitRate())
	weighted := 0.4 // 400 reads / 1000 prompt tokens
	check(&weighted)
	// Simulate a row from an older writer with indistinguishable true and billed hits.
	_, err := tx.ExecContext(ctx, "UPDATE usage_logs SET upstream_cache_read_tokens = NULL WHERE id = $1", discounted.ID)
	require.NoError(t, err)
	legacy, err := repo.GetByID(ctx, discounted.ID)
	require.NoError(t, err)
	require.Nil(t, legacy.CacheHitRate())
	check(nil)

	// A positive uncached input proves this old row wasn't fully reclassified.
	_, err = tx.ExecContext(ctx, "UPDATE usage_logs SET input_tokens = 50, cache_read_tokens = 150 WHERE id = $1", discounted.ID)
	require.NoError(t, err)
	legacy, err = repo.GetByID(ctx, discounted.ID)
	require.NoError(t, err)
	require.NotNil(t, legacy.CacheHitRate())
	require.InDelta(t, 0.75, *legacy.CacheHitRate(), 1e-12)
	recovered := 0.55
	check(&recovered)
}
