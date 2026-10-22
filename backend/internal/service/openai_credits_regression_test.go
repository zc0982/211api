//go:build unit

package service

import (
	"context"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type credits429SnapshotRepo struct {
	oauth429RateLimitRepo
	updates map[string]any
}

func (r *credits429SnapshotRepo) UpdateExtra(_ context.Context, _ int64, updates map[string]any) error {
	r.updates = updates
	return nil
}

func TestOpenAI429FastPath_ResponseCreditsOverrideCache(t *testing.T) {
	for _, tc := range []struct {
		name          string
		cachedCredits bool
		response      string
		expired       bool
		wantRetry     bool
	}{
		{"depleted response overrides positive cache", true, "false", false, false},
		{"positive response overrides depleted cache", false, "true", false, true},
		{"missing response uses positive cache", true, "", false, true},
		{"missing response uses depleted cache", false, "", false, false},
		{"cached credits retry window expires", true, "", true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			account := &Account{ID: 8181, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Extra: map[string]any{
				"codex_5h_used_percent":  100.0,
				"codex_5h_reset_at":      now.Add(time.Hour).Format(time.RFC3339),
				"codex_usage_updated_at": now.Format(time.RFC3339),
				openaiQuotaCreditsKey: openAICreditsSnapshot{
					Credits: &OpenAICredits{HasCredits: tc.cachedCredits}, FetchedAt: now.Unix(),
				},
			}}
			headers := http.Header{}
			headers.Set("x-codex-primary-used-percent", "100")
			headers.Set("x-codex-primary-reset-after-seconds", "3600")
			headers.Set("x-codex-primary-window-minutes", "300")
			if tc.response != "" {
				headers.Set("x-codex-credits-has-credits", tc.response)
				headers.Set("x-codex-credits-unlimited", "false")
			}
			repo := &credits429SnapshotRepo{}
			limits := NewRateLimitService(repo, nil, &config.Config{}, nil, nil)
			svc := &OpenAIGatewayService{rateLimitService: limits}
			limits.SetAccountRuntimeBlocker(svc)
			if tc.expired {
				svc.openaiOAuth429RetryStartedAt.Store(account.ID, now.Add(-openAIOAuth429RetryWindow-time.Second))
			}

			// Exercise each retry entry before an existing runtime block can mask it.
			require.Equal(t, tc.wantRetry, svc.ShouldRetryOpenAIOAuth429(account, headers, nil))
			require.Equal(t, tc.wantRetry, svc.shouldRetryOpenAIOAuth429OnSameAccountWithResponse(account, 429, false, headers, nil))
			require.False(t, svc.handleOpenAIAccountUpstreamError(context.Background(), account, 429, headers, nil))
			require.Equal(t, !tc.wantRetry, svc.isOpenAIAccountRuntimeBlocked(account))
			require.Equal(t, tc.wantRetry, svc.shouldRetryOpenAIOAuth429OnSameAccountWithResponse(account, 429, false, headers, nil))
			if tc.wantRetry {
				require.Zero(t, repo.setRateLimitedCalls)
			} else {
				require.False(t, svc.shouldRetryOpenAIOAuth429OnSameAccount(account, 429, false), "cached credits must not restart retries on a blocked account")
				require.Equal(t, 1, repo.setRateLimitedCalls)
				require.WithinDuration(t, now.Add(time.Hour), repo.lastRateLimitedUntil, 2*time.Second)
				if tc.response == "false" {
					snapshot := repo.updates[openaiQuotaCreditsKey].(openAICreditsSnapshot)
					require.False(t, snapshot.Credits.HasCredits)
				}
			}
		})
	}
}

func TestOpenAICreditsScheduling_PreservesOtherWindowThreshold(t *testing.T) {
	for _, exhaustedWindow := range []string{"5h", "7d"} {
		for _, autoReset := range []bool{false, true} {
			t.Run(exhaustedWindow+"/autoReset="+strconv.FormatBool(autoReset), func(t *testing.T) {
				now := time.Now()
				otherWindow := "5h"
				if exhaustedWindow == "5h" {
					otherWindow = "7d"
				}
				account := &Account{ID: 8182, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Extra: map[string]any{
					"codex_" + exhaustedWindow + "_used_percent": 100.0,
					"codex_" + exhaustedWindow + "_reset_at":     now.Add(24 * time.Hour).Format(time.RFC3339),
					"codex_" + otherWindow + "_used_percent":     91.0,
					"codex_" + otherWindow + "_reset_at":         now.Add(time.Hour).Format(time.RFC3339),
					"codex_usage_updated_at":                     now.Format(time.RFC3339),
					"auto_pause_5h_threshold":                    0.90,
					"auto_pause_7d_threshold":                    0.90,
					OpenAIAutoResetCreditEnabledExtraKey:         autoReset,
					openaiQuotaCreditsKey: openAICreditsSnapshot{
						Credits: &OpenAICredits{HasCredits: true}, FetchedAt: now.Unix(),
					},
				}}
				decision := EvaluateAccountSchedulingThreshold(account, map[string]int{PlatformOpenAI: 90}, now)
				require.True(t, decision.ShouldPause)
				require.Equal(t, otherWindow, decision.Window)
				paused, quotaDecision := shouldAutoPauseOpenAIAccountByQuota(context.Background(), account)
				require.True(t, paused)
				require.Equal(t, otherWindow, quotaDecision.window)
				if autoReset {
					key := OpenAIAutoResetCredit5hThresholdExtraKey
					if otherWindow == "7d" {
						key = OpenAIAutoResetCredit7dThresholdExtraKey
					}
					account.Extra[key] = 0.90
					paused, quotaDecision = shouldAutoPauseOpenAIAccountByQuota(context.Background(), account)
					require.True(t, paused)
					require.Equal(t, "quota_auto_reset_pending_"+otherWindow, quotaDecision.reason)
				}

				account.Extra["codex_"+otherWindow+"_used_percent"] = 80.0
				require.False(t, EvaluateAccountSchedulingThreshold(account, map[string]int{PlatformOpenAI: 90}, now).ShouldPause)
				paused, _ = shouldAutoPauseOpenAIAccountByQuota(context.Background(), account)
				require.False(t, paused, "credits still cover the exhausted window")

				account.Extra["codex_"+otherWindow+"_used_percent"] = 100.0
				require.False(t, EvaluateAccountSchedulingThreshold(account, map[string]int{PlatformOpenAI: 90}, now).ShouldPause)
				paused, _ = shouldAutoPauseOpenAIAccountByQuota(context.Background(), account)
				require.False(t, paused, "credits can cover both exhausted windows")
			})
		}
	}
}
