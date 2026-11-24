import type { UsageLog } from '@/types'

type PromptTokens = Pick<UsageLog, 'input_tokens' | 'cache_read_tokens' | 'cache_creation_tokens'>

export function cacheHitRate(tokens: PromptTokens): number | null {
  const promptTokens = tokens.input_tokens + tokens.cache_read_tokens + tokens.cache_creation_tokens
  return promptTokens > 0 ? tokens.cache_read_tokens / promptTokens : null
}

export function formatCacheHitRate(tokens: PromptTokens, emptyValue = '—'): string {
  const rate = cacheHitRate(tokens)
  return rate === null ? emptyValue : `${(rate * 100).toFixed(1)}%`
}
