package service

import (
	"context"
	"time"

	appTimezone "github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
)

const groupUsageDateFormat = "2006-01-02"

// GroupUsageRollupRepository 是分组日汇总的可选持久化能力。
type GroupUsageRollupRepository interface {
	SyncGroupUsageRollups(ctx context.Context, todayStart time.Time) error
}

// GroupUsageTimezoneName 返回服务端配置的时区名称。
func GroupUsageTimezoneName() string {
	return groupUsageTimezoneNameInLocation(appTimezone.Location())
}

// GroupUsageTodayStart 返回指定时刻在服务端配置时区内的自然日 UTC 起点。
func GroupUsageTodayStart(at time.Time) time.Time {
	return groupUsageTodayStartInLocation(at, appTimezone.Location())
}

// GroupUsageYesterdayStart 返回指定时刻前一个本地日历日的 UTC 起点。
func GroupUsageYesterdayStart(at time.Time) time.Time {
	return groupUsageYesterdayStartInLocation(at, appTimezone.Location())
}

// GroupUsageDate 返回指定时刻在服务端配置时区内的日期。
func GroupUsageDate(at time.Time) string {
	return groupUsageDateInLocation(at, appTimezone.Location())
}

// ParseGroupUsageDate 解析服务端配置时区内的日期并返回其零点。
func ParseGroupUsageDate(value string) (time.Time, error) {
	return parseGroupUsageDateInLocation(value, appTimezone.Location())
}

func groupUsageTimezoneNameInLocation(location *time.Location) string {
	return location.String()
}

func groupUsageTodayStartInLocation(at time.Time, location *time.Location) time.Time {
	return groupUsageStartOfDayInLocation(at, location).UTC()
}

func groupUsageYesterdayStartInLocation(at time.Time, location *time.Location) time.Time {
	return groupUsageStartOfDayInLocation(at, location).AddDate(0, 0, -1).UTC()
}

func groupUsageDateInLocation(at time.Time, location *time.Location) string {
	return at.In(location).Format(groupUsageDateFormat)
}

func parseGroupUsageDateInLocation(value string, location *time.Location) (time.Time, error) {
	return time.ParseInLocation(groupUsageDateFormat, value, location)
}

func groupUsageStartOfDayInLocation(at time.Time, location *time.Location) time.Time {
	local := at.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}
