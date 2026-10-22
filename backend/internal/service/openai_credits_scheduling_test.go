package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestOpenAISpendableCreditsAvailable(t *testing.T) {
	now := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	balance := "4.50"
	zero := "0"
	negative := "-1"

	tests := []struct {
		name     string
		snapshot any
		want     bool
	}{
		{
			name: "fresh finite balance",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{HasCredits: true, Balance: &balance},
				FetchedAt: now.Unix(),
			},
			want: true,
		},
		{
			name: "unlimited",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{Unlimited: true},
				FetchedAt: now.Unix(),
			},
			want: true,
		},
		{
			name: "two hour old production snapshot",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{HasCredits: true, Balance: &balance},
				FetchedAt: now.Add(-2 * time.Hour).Unix(),
			},
			want: true,
		},
		{
			name: "zero is exhausted",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{HasCredits: false, Balance: &zero},
				FetchedAt: now.Unix(),
			},
			want: false,
		},
		{
			name: "negative balance is invalid",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{HasCredits: true, Balance: &negative},
				FetchedAt: now.Unix(),
			},
			want: false,
		},
		{
			name: "stale snapshot",
			snapshot: openAICreditsSnapshot{
				Credits:   &OpenAICredits{HasCredits: true, Balance: &balance},
				FetchedAt: now.Add(-openAICreditsSnapshotSchedulingTTL - time.Second).Unix(),
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			account := &Account{Extra: map[string]any{openaiQuotaCreditsKey: tt.snapshot}}
			require.Equal(t, tt.want, openAISpendableCreditsAvailable(account, now))
		})
	}
}

func TestParseOpenAICreditsHeaders(t *testing.T) {
	headers := http.Header{}
	headers.Set("x-codex-credits-has-credits", "true")
	headers.Set("x-codex-credits-unlimited", "false")
	headers.Set("x-codex-credits-balance", "12.500")

	credits, ok := parseOpenAICreditsHeaders(headers)
	require.True(t, ok)
	require.True(t, credits.HasCredits)
	require.False(t, credits.Unlimited)
	require.NotNil(t, credits.Balance)
	require.Equal(t, "12.500", *credits.Balance)

	headers.Del("x-codex-credits-unlimited")
	_, ok = parseOpenAICreditsHeaders(headers)
	require.False(t, ok, "incomplete credit headers must not fabricate availability")
}
