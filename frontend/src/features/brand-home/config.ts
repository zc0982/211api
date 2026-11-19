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

/**
 * Model shown in the hero Model Chip and code card for each tracked vendor.
 * Each id is the first text model in that platform's built-in default list
 * (backend/internal/pkg/claude/constants.go, openai/constants.go,
 * geminicli/models.go, xai/models.go), so it is a model the gateway knows.
 */
export const HERO_VENDOR_MODELS: Readonly<Record<BrandVendor, string>> = {
  claude: HERO_DEFAULT_MODEL,
  openai: 'gpt-5.6-sol',
  gemini: 'gemini-3-flash',
  grok: 'grok-4.7'
}

/** Inner rings of the armillary, outer → inner, and the auto-tracking order. */
export const ARMILLARY_RINGS: readonly { vendor: BrandVendor; radius: number }[] = [
  { vendor: 'claude', radius: 0.86 },
  { vendor: 'openai', radius: 0.75 },
  { vendor: 'gemini', radius: 0.64 },
  { vendor: 'grok', radius: 0.53 }
]

/** Width of each inner ring (same unit as ARMILLARY_RINGS radius). */
export const ARMILLARY_RING_WIDTH = 0.044

/**
 * WebGL armillary gates. Any hit keeps the static render (and three.js is
 * not loaded, or is stopped and disposed). See docs/spec/brand-home.md.
 */
export const ARMILLARY_WEBGL = {
  /** navigator.hardwareConcurrency at or below this → static. */
  maxLowEndCores: 4,
  /** navigator.deviceMemory (GB) at or below this → static. */
  maxLowEndMemoryGB: 4,
  /** Frames sampled after the first frame to measure frame time. */
  probeFrames: 60,
  /** Average frame time (ms) above this over the probe → static. */
  maxAvgFrameMs: 32,
  /** Below this viewport width the layout stacks; WebGL stays on (see spec). */
  stackBreakpoint: 860,
  /** WebGL on stacked (narrow) layouts. Measured; see docs/spec/brand-home.md. */
  enableOnNarrow: true,
  /** After a manual bead switch, auto-rotation waits this long (ms). */
  manualHoldMs: 12000,
  /** Static render fade-out once the first WebGL frame is drawn (ms). */
  fadeMs: 200
} as const
