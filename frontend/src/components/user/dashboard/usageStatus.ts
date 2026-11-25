import type { UsageLog } from '@/types'

/**
 * 用量记录没有 HTTP 状态码，不能一律当成成功（`200 OK`）。
 * 唯一可信的失败标记是 `request_type === 'cyber'`：网关被安全策略拦截时也会写一条用量记录。
 */
export function isPolicyBlockedUsage(log: Pick<UsageLog, 'request_type'> | null | undefined): boolean {
  return log?.request_type === 'cyber'
}
