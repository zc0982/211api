package service

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// openAICreditsSnapshotSchedulingTTL keeps a queried/header snapshot useful
// long enough for the scheduler cache to observe it, while preventing a stale
// balance from overriding the actual rate-limit windows indefinitely.
const openAICreditsSnapshotSchedulingTTL = openAIQuotaHeadroomSnapshotStaleAfter

func openAICreditsAvailable(credits *OpenAICredits) bool {
	return credits != nil && (credits.Unlimited || credits.HasCredits)
}

func parseOpenAICreditsHeaders(headers http.Header) (*OpenAICredits, bool) {
	if headers == nil {
		return nil, false
	}

	hasCredits, hasCreditsOK := parseOpenAIHeaderBool(headers.Get("x-codex-credits-has-credits"))
	unlimited, unlimitedOK := parseOpenAIHeaderBool(headers.Get("x-codex-credits-unlimited"))
	if !hasCreditsOK || !unlimitedOK {
		return nil, false
	}

	var balance *string
	if raw := strings.TrimSpace(headers.Get("x-codex-credits-balance")); raw != "" {
		value := raw
		balance = &value
	}
	return &OpenAICredits{
		HasCredits: hasCredits,
		Unlimited:  unlimited,
		Balance:    balance,
	}, true
}

func parseOpenAIHeaderBool(raw string) (bool, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false, false
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, false
	}
	return value, true
}

func openAICreditsSnapshotFresh(snapshot openAICreditsSnapshot, now time.Time) bool {
	if snapshot.FetchedAt <= 0 {
		return false
	}
	fetchedAt := time.Unix(snapshot.FetchedAt, 0)
	if fetchedAt.After(now.Add(time.Minute)) {
		return false
	}
	return now.Sub(fetchedAt) <= openAICreditsSnapshotSchedulingTTL
}

func openAISpendableCreditsAvailable(account *Account, now time.Time) bool {
	if account == nil || len(account.Extra) == 0 {
		return false
	}
	raw, ok := account.Extra[openaiQuotaCreditsKey]
	if !ok || raw == nil {
		return false
	}

	encoded, err := json.Marshal(raw)
	if err != nil {
		return false
	}
	var snapshot openAICreditsSnapshot
	if err := json.Unmarshal(encoded, &snapshot); err != nil || !openAICreditsSnapshotFresh(snapshot, now) {
		return false
	}
	if !openAICreditsAvailable(snapshot.Credits) {
		return false
	}

	// has_credits is authoritative upstream. When a finite balance is exposed,
	// reject malformed or negative values so stale/garbled data cannot keep an
	// exhausted account in rotation.
	if snapshot.Credits.Unlimited || snapshot.Credits.Balance == nil {
		return true
	}
	balance := strings.TrimSpace(*snapshot.Credits.Balance)
	if balance == "" {
		return true
	}
	value, err := strconv.ParseFloat(balance, 64)
	return err == nil && !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0
}

func openAIQuotaExhaustedWithCredits(account *Account, now time.Time) bool {
	if !openAISpendableCreditsAvailable(account, now) {
		return false
	}
	utilization5h, has5h := resolveOpenAIQuotaUtilization(account.Extra, "5h", now)
	utilization7d, has7d := resolveOpenAIQuotaUtilization(account.Extra, "7d", now)
	return (has5h && utilization5h >= 1) || (has7d && utilization7d >= 1)
}

func openAISpendableCreditsAvailableFromHeaders(headers http.Header) bool {
	credits, ok := parseOpenAICreditsHeaders(headers)
	return ok && openAICreditsAvailable(credits)
}
