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
	year, month, day := at.In(location).Date()
	return groupUsageDayStart(year, month, day, location).UTC()
}

func groupUsageYesterdayStartInLocation(at time.Time, location *time.Location) time.Time {
	// 从当日起点向前 12 小时定位前一个本地日，避免直接构造可能不存在的零点。
	return groupUsageTodayStartInLocation(groupUsageTodayStartInLocation(at, location).Add(-12*time.Hour), location)
}

func groupUsageDateInLocation(at time.Time, location *time.Location) string {
	return at.In(location).Format(groupUsageDateFormat)
}

func parseGroupUsageDateInLocation(value string, location *time.Location) (time.Time, error) {
	date, err := time.Parse(groupUsageDateFormat, value)
	if err != nil {
		return time.Time{}, err
	}
	year, month, day := date.Date()
	return groupUsageDayStart(year, month, day, location), nil
}

// groupUsageDayStart 返回本地日期的第一个时刻。夏令时跳变可使零点消失或重复。
func groupUsageDayStart(year int, month time.Month, day int, location *time.Location) time.Time {
	target := groupUsageDateOrdinal(year, month, day)
	start := time.Date(year, month, day, 0, 0, 0, 0, location)
	if localGroupUsageDateOrdinal(start, location) == target &&
		localGroupUsageDateOrdinal(start.Add(-time.Nanosecond), location) < target {
		return start
	}
	// 在前一日正午到当日正午之间找本地日期首次到达目标日期的时刻。
	low := time.Date(year, month, day-1, 12, 0, 0, 0, location)
	high := time.Date(year, month, day, 12, 0, 0, 0, location)
	for high.Sub(low) > time.Nanosecond {
		mid := low.Add(high.Sub(low) / 2)
		if localGroupUsageDateOrdinal(mid, location) >= target {
			high = mid
		} else {
			low = mid
		}
	}
	return high
}

func localGroupUsageDateOrdinal(at time.Time, location *time.Location) int {
	year, month, day := at.In(location).Date()
	return groupUsageDateOrdinal(year, month, day)
}

func groupUsageDateOrdinal(year int, month time.Month, day int) int {
	return year*10000 + int(month)*100 + day
}
