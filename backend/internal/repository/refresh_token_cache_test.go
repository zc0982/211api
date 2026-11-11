//go:build unit

package repository

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newRefreshTokenCacheForTest(t *testing.T) *refreshTokenCache {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return &refreshTokenCache{rdb: rdb}
}

type rotationResult struct{ err error }

// 并发尝试不同后继时，只有一个后继能提交。
func TestRefreshTokenCacheRotationRejectsDifferentSuccessors(t *testing.T) {
	cache := newRefreshTokenCacheForTest(t)
	ctx := context.Background()

	require.NoError(t, cache.StoreRefreshToken(ctx, "hash-1", &service.RefreshTokenData{
		UserID:   7,
		FamilyID: "family-1",
	}, time.Minute))

	const workers = 16
	results := make(chan rotationResult, workers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			err := cache.RotateRefreshToken(ctx, "hash-1", fmt.Sprintf("next-%d", i), &service.RefreshTokenData{UserID: 7, FamilyID: "family-1"}, time.Minute)
			results <- rotationResult{err: err}
		}(i)
	}
	close(start)
	wg.Wait()
	close(results)

	successes, notFound := 0, 0
	for result := range results {
		switch {
		case result.err == nil:
			successes++
		case errors.Is(result.err, service.ErrRefreshTokenNotFound):
			notFound++
		default:
			t.Fatalf("unexpected consume error: %v", result.err)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, workers-1, notFound)

	receipt, err := cache.GetRefreshToken(ctx, "hash-1")
	require.NoError(t, err)
	require.Empty(t, receipt.RotatedTo, "retry reads the active successor metadata")
	hashes, err := cache.GetFamilyTokenHashes(ctx, "family-1")
	require.NoError(t, err)
	require.Len(t, hashes, 2, "one receipt and exactly one successor")
}
