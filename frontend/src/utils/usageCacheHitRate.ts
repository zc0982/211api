export function formatCacheHitRate(rate: number | null | undefined, emptyValue = '—'): string {
  return rate == null ? emptyValue : `${(rate * 100).toFixed(1)}%`
}
