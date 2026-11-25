/**
 * 用户后台 v3 订单状态徽章（Figma C6）。只给用户侧「我的订单」「最近订单」用；
 * 管理端继续用 orderUtils.statusBadgeClass，不受影响。
 * 绿色只给「已完成」；待支付 / 退款处理中用古铜描边或淡蓝；终态（取消、过期、已退款）用中性色；
 * 失败是真实错误，保留红色。
 */
const CONSOLE_ORDER_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  PAID: 'badge-primary',
  RECHARGING: 'badge-primary',
  COMPLETED: 'badge-success console-badge-dot',
  EXPIRED: 'console-badge-muted',
  CANCELLED: 'console-badge-muted',
  FAILED: 'badge-danger',
  REFUND_REQUESTED: 'badge-primary',
  REFUNDING: 'badge-primary',
  REFUND_PENDING: 'badge-primary',
  PARTIALLY_REFUNDED: 'badge-gray',
  REFUNDED: 'badge-gray',
  REFUND_FAILED: 'badge-danger',
}

export function consoleOrderBadgeClass(status: string): string {
  return CONSOLE_ORDER_BADGE[status] || 'console-badge-muted'
}
