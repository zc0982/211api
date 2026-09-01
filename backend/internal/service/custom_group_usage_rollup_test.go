//go:build unit

package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func groupUsageTestLocation(t *testing.T, name string) *time.Location {
	t.Helper()

	location, err := time.LoadLocation(name)
	require.NoError(t, err)
	return location
}

func TestGroupUsageDateUsesConfiguredTimezoneBoundary(t *testing.T) {
	location := groupUsageTestLocation(t, "America/New_York")

	beforeMidnight := time.Date(2026, 3, 9, 3, 59, 59, 0, time.UTC)
	atMidnight := time.Date(2026, 3, 9, 4, 0, 0, 0, time.UTC)

	require.Equal(t, "2026-03-08", groupUsageDateInLocation(beforeMidnight, location))
	require.Equal(t, "2026-03-09", groupUsageDateInLocation(atMidnight, location))
	require.Equal(t, atMidnight, groupUsageTodayStartInLocation(atMidnight, location))
}

func TestGroupUsageParseDateUsesConfiguredTimezone(t *testing.T) {
	location := groupUsageTestLocation(t, "America/New_York")

	parsed, err := parseGroupUsageDateInLocation("2026-03-08", location)
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 8, 5, 0, 0, 0, time.UTC), parsed.UTC())
	require.Equal(t, "America/New_York", parsed.Location().String())
}

func TestGroupUsageYesterdayStartHandlesDST(t *testing.T) {
	location := groupUsageTestLocation(t, "America/New_York")

	todayStart := time.Date(2026, 3, 9, 4, 0, 0, 0, time.UTC)
	yesterdayStart := groupUsageYesterdayStartInLocation(todayStart, location)

	require.Equal(t, time.Date(2026, 3, 8, 5, 0, 0, 0, time.UTC), yesterdayStart)
	require.Equal(t, 23*time.Hour, todayStart.Sub(yesterdayStart))
	require.Equal(t, "America/New_York", groupUsageTimezoneNameInLocation(location))
}
