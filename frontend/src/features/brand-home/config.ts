/**
 * Brand home configuration.
 *
 * Code-level switches only: nothing here reads admin settings or environment
 * variables. See docs/spec/brand-home.md for the rules behind each value.
 */

/**
 * Operational stats (availability, first-token latency, call counts, "all
 * systems operational"). There is no public endpoint for them yet, so the
 * hero trust line keeps only verifiable items and the service-status section
 * is not rendered. When a real endpoint exists, wire its numbers in and flip
 * this flag; never hard-code values.
 */
export const liveStats = false

/** Fallback brand name when the admin has not set site_name. */
export const DEFAULT_SITE_NAME = '211API'

/**
 * Model shown in the hero Model Chip, code card and quick-start sample.
 * Matches the static armillary render (the Claude ring is the gold one).
 */
export const HERO_DEFAULT_MODEL = 'claude-fable-5-2'

/** Placeholder key used in every code sample. Never a real credential. */
export const API_KEY_PLACEHOLDER = 'sk-YOUR_API_KEY'

export type BrandVendor = 'claude' | 'openai' | 'gemini' | 'grok'

/** Model-plaza `platform` → vendor. Platforms not listed here are ignored. */
export const PLATFORM_VENDOR: Readonly<Record<string, BrandVendor>> = {
  anthropic: 'claude',
  openai: 'openai',
  gemini: 'gemini',
  grok: 'grok'
}

/** Card order on "All" (matches Figma 1:3218). */
export const VENDOR_CARD_ORDER: readonly BrandVendor[] = ['claude', 'openai', 'gemini', 'grok']

/** Filter-chip order (matches Figma 1:3226). */
export const VENDOR_CHIP_ORDER: readonly BrandVendor[] = ['openai', 'claude', 'gemini', 'grok']

export const VENDOR_LABEL: Readonly<Record<BrandVendor, string>> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  grok: 'Grok'
}

/** Max cards rendered for a single-vendor filter (one row at 1200px). */
export const MAX_CARDS_PER_VENDOR = 4

export type EcosystemTool =
  | 'claudeCode'
  | 'codex'
  | 'cursor'
  | 'deepseekHarness'
  | 'pi'
  | 'hermes'
  | 'openCode'
  | 'openClaw'

export const ECOSYSTEM_TOOLS: readonly { id: EcosystemTool; name: string }[] = [
  { id: 'claudeCode', name: 'Claude Code' },
  { id: 'codex', name: 'Codex' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'deepseekHarness', name: 'DSH' },
  { id: 'pi', name: 'Pi' },
  { id: 'hermes', name: 'Hermes' },
  { id: 'openCode', name: 'OpenCode' },
  { id: 'openClaw', name: 'OpenClaw' }
]

/** Viewport margin before the model section starts fetching. */
export const PLAZA_PREFETCH_MARGIN = '400px 0px'
