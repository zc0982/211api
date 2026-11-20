/**
 * Brand home configuration (v3「星链」).
 *
 * Code-level switches and illustrative values only: nothing here reads admin
 * settings or environment variables. Every number below that is not a layout
 * coordinate is sample data for the pixel scenes and demo panels; it is shown
 * next to an「示意 / 示例数据」label, never animated as a counter and never
 * called「实时」. See docs/spec/brand-home.md.
 */

/**
 * Operational stats (availability, first-token latency, call counts, "all
 * systems operational"). There is no public endpoint for them yet, so the
 * service-status section is not rendered. When a real endpoint exists, wire
 * its numbers in and flip this flag; never hard-code values.
 */
export const liveStats = false

/** Fallback brand name when the admin has not set site_name. */
export const DEFAULT_SITE_NAME = '211API'

/** Model used in the quick-start samples (same model the hero traces). */
export const SAMPLE_MODEL = 'claude-fable-5-2'

/** Codex sample model (same default as the console's Codex config in UseKeyModal.vue). */
export const CODEX_SAMPLE_MODEL = 'gpt-6.1-sol'

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

/** Card order on "All" (matches Figma 94:47354). */
export const VENDOR_CARD_ORDER: readonly BrandVendor[] = ['claude', 'openai', 'gemini', 'grok']

/** Filter-chip order (matches Figma 94:47354). */
export const VENDOR_CHIP_ORDER: readonly BrandVendor[] = ['openai', 'claude', 'gemini', 'grok']

export const VENDOR_LABEL: Readonly<Record<BrandVendor, string>> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  grok: 'Grok'
}

/** Max cards rendered for a single-vendor filter (one row at 1200px). */
export const MAX_CARDS_PER_VENDOR = 4

/** Viewport margin before the model section starts fetching. */
export const PLAZA_PREFETCH_MARGIN = '400px 0px'

export type EcosystemTool =
  | 'claudeCode'
  | 'codex'
  | 'cursor'
  | 'deepseekHarness'
  | 'pi'
  | 'hermes'
  | 'openCode'
  | 'openClaw'

/* -------------------------------------------------------------------------- */
/* Hero「星链」scene — 1440×900 design space, ground line y = 836 (Figma 46:2720) */
/* -------------------------------------------------------------------------- */

export const SCENE_WIDTH = 1440
export const HERO_SCENE_HEIGHT = 900
export const FOOTER_SCENE_HEIGHT = 340
/** Footer stage: the scene plus the ground edge and the cache chips that sit on the base below it. */
export const FOOTER_STAGE_HEIGHT = 380
/** Below this width the page stacks and the scenes are scaled to fit (PR 2 adds the 0.75× pan). */
export const SCENE_STACK_BREAKPOINT = 860

/** Moon centre and the point every trace starts from (bottom of the moon). */
export const MOON = { cx: 1060, cy: 220, r: 42 } as const
export const TRACE_ORIGIN = { x: 1060, y: 264 } as const

/** Pixel-art display scale for characters and station props. */
export const SPRITE_SCALE = 1.5

export interface HeroStation {
  tool: EcosystemTool
  name: string
  /** Prop file under assets/sprites/hero (prop-<file>.png). */
  prop: string
  /** Prop left edge; the prop's bottom sits on the ground line. */
  propX: number
  /** 1x prop size in pixels (displayed at SPRITE_SCALE). */
  propW: number
  propH: number
  /** Status chip: left / top / width in scene pixels. */
  chipX: number
  chipY: number
  chipW: number
  /** Illustrative chip text: model (or status code) and latency. */
  chipModel: string
  chipMeta: string
  /** The tracked call: gold trace, gold chip outline. */
  tracked?: boolean
  /** Chip is dimmed (no one working there at t = 0). */
  dim?: boolean
  /** Trace stroke opacity override (Codex carries the 429 marker). */
  traceOpacity?: number
}

/** Order and coordinates from the v3 handoff table and Figma 46:2720. */
export const HERO_STATIONS: readonly HeroStation[] = [
  { tool: 'claudeCode', name: 'Claude Code', prop: 'claude-code', propX: 116, propW: 33, propH: 36, chipX: 57, chipY: 696, chipW: 168, chipModel: 'claude-fable-5-2', chipMeta: '1.24s', tracked: true },
  { tool: 'cursor', name: 'Cursor', prop: 'cursor', propX: 268, propW: 28, propH: 37, chipX: 200, chipY: 728, chipW: 179, chipModel: 'claude-fable-5-2', chipMeta: '412ms', dim: true },
  { tool: 'openCode', name: 'OpenCode', prop: 'opencode', propX: 416, propW: 29, propH: 37, chipX: 392, chipY: 696, chipW: 93, chipModel: '200', chipMeta: '344ms' },
  { tool: 'codex', name: 'Codex', prop: 'codex', propX: 566, propW: 34, propH: 33, chipX: 519, chipY: 728, chipW: 146, chipModel: 'gpt-6.1-sol', chipMeta: '640ms', traceOpacity: 0.55 },
  { tool: 'pi', name: 'Pi', prop: 'pi', propX: 718, propW: 34, propH: 28, chipX: 671, chipY: 696, chipW: 146, chipModel: 'gpt-6.1-sol', chipMeta: '286ms', dim: true },
  { tool: 'hermes', name: 'Hermes', prop: 'hermes', propX: 868, propW: 28, propH: 41, chipX: 803, chipY: 728, chipW: 172, chipModel: 'gemini-4-carbon', chipMeta: '530ms' },
  { tool: 'deepseekHarness', name: 'DeepSeek Harness', prop: 'deepseek-harness', propX: 1232, propW: 37, propH: 30, chipX: 1214, chipY: 696, chipW: 93, chipModel: '200', chipMeta: '198ms', dim: true },
  { tool: 'openClaw', name: 'OpenClaw', prop: 'openclaw', propX: 1372, propW: 28, propH: 42, chipX: 1298, chipY: 728, chipW: 126, chipModel: 'grok-4.7', chipMeta: '276ms', dim: true }
]

/** Station whose trace carries the「429 → 已切换」marker (at t = 0.5 of the curve). */
export const SWITCH_MARKER_TOOL: EcosystemTool = 'codex'

export type SceneCharacter = 'claude' | 'gpt' | 'gemini' | 'grok' | 'opencode' | 'dsh'

export interface HeroCharacter {
  id: SceneCharacter
  /** Centre x at point A (static frame, PR 2 adds the B point and timing). */
  x: number
  /** 1x size of the work frame 1 sprite. */
  w: number
  h: number
  /** Head-side badge: model vendor icon, or a tool icon for OpenCode / DSH. */
  badge: { vendor: BrandVendor } | { tool: EcosystemTool }
}

export const HERO_CHARACTERS: readonly HeroCharacter[] = [
  { id: 'claude', x: 90, w: 36, h: 50, badge: { vendor: 'claude' } },
  { id: 'gpt', x: 540, w: 34, h: 50, badge: { vendor: 'openai' } },
  { id: 'gemini', x: 842, w: 45, h: 50, badge: { vendor: 'gemini' } },
  { id: 'grok', x: 1346, w: 37, h: 55, badge: { vendor: 'grok' } },
  { id: 'opencode', x: 390, w: 33, h: 52, badge: { tool: 'openCode' } },
  { id: 'dsh', x: 1206, w: 38, h: 50, badge: { tool: 'deepseekHarness' } }
]

/** Gold dot on the tracked trace at t = 0 (Figma 52:13385 centre). PR 2 moves it along the curve. */
export const GOLD_DOT = { x: 478, y: 507 } as const

export const HERO_GROUND_Y = 836
/** Characters stand 2px below the ground line in Figma (feet overlap the edge). */
export const HERO_FEET_Y = 838

/* -------------------------------------------------------------------------- */
/* Footer「新教学楼工地」scene — 1440×340, ground line y = 340 (Figma 46:3761)    */
/* -------------------------------------------------------------------------- */

export interface SiteProp {
  file: string
  x: number
  y: number
  w: number
  h: number
  mirror?: boolean
}

/** Left/top/size in scene pixels (1.5x; building and crane 2x), from the handoff table. */
export const SITE_PROPS: readonly SiteProp[] = [
  { file: 'building', x: 470, y: 141, w: 380, h: 200 },
  { file: 'crane', x: 870, y: 41, w: 400, h: 300 },
  { file: 'hut', x: 20, y: 297, w: 72, h: 45 },
  { file: 'sand', x: 100, y: 288, w: 63, h: 54 },
  { file: 'brick-pile', x: 175, y: 314, w: 47, h: 29 },
  { file: 'mixer', x: 300, y: 281, w: 57, h: 62 },
  { file: 'wall', x: 452, y: 272, w: 68, h: 71 },
  { file: 'wall', x: 800, y: 272, w: 68, h: 71, mirror: true },
  { file: 'brick-pile', x: 1060, y: 314, w: 47, h: 29 },
  { file: 'wheelbarrow', x: 1215, y: 299, w: 63, h: 44 },
  { file: 'cones', x: 1300, y: 312, w: 65, h: 30 }
]

/** Crane hook carrying a pallet of bricks, and its rope (static: hook at the top). */
export const SITE_HOOK = { x: 1055, y: 120, w: 57, h: 81, ropeX: 1082, ropeTop: 71 } as const

export type SiteChipKind = 'firstToken' | 'speed' | 'tokens' | 'cost'

export interface SiteWorker {
  id: SceneCharacter
  /** Sprite file under assets/sprites/footer at t = 0. */
  sprite: string
  /** Sprite box left/top in scene pixels and 1x sprite size. */
  x: number
  y: number
  w: number
  h: number
  /** Face left (scaleX(-1)). */
  mirror?: boolean
  /** Parameter chip shown at t = 0 and its left/top in scene pixels. */
  chip: SiteChipKind
  chipX: number
  chipY: number
}

/**
 * t = 0 of the 9.6s site loop (handoff PR 2 §3 with phase offsets 0 / 3.2 / 6.4):
 * the first two of each team lay bricks, the third carries a load at the pile.
 * Positions match Figma 59:22798.
 */
export const SITE_WORKERS: readonly SiteWorker[] = [
  { id: 'claude', sprite: 'claude-work-f1', x: 376, y: 265, w: 39, h: 52, chip: 'firstToken', chipX: 359, chipY: 233 },
  { id: 'gpt', sprite: 'gpt-work-f1', x: 408, y: 263, w: 36, h: 53, chip: 'speed', chipX: 389, chipY: 211 },
  { id: 'opencode', sprite: 'opencode-walk-f1', x: 200, y: 267, w: 30, h: 50, chip: 'tokens', chipX: 183, chipY: 223 },
  { id: 'gemini', sprite: 'gemini-work-f1', x: 845, y: 263, w: 47, h: 53, mirror: true, chip: 'firstToken', chipX: 834, chipY: 233 },
  { id: 'grok', sprite: 'grok-work-f1', x: 881, y: 261, w: 36, h: 54, mirror: true, chip: 'speed', chipX: 865, chipY: 209 },
  { id: 'dsh', sprite: 'dsh-walk-f1', x: 1033, y: 266, w: 35, h: 51, mirror: true, chip: 'tokens', chipX: 1013, chipY: 225 }
]

/** Illustrative per-worker parameters (handoff PR 2 table; brick = token). */
export const SITE_PARAMS: Readonly<Record<SceneCharacter, { firstToken: string; speed: string; tokens: string; cost: string }>> = {
  claude: { firstToken: '312ms', speed: '86', tokens: '1,284', cost: '$0.0042' },
  gpt: { firstToken: '286ms', speed: '112', tokens: '2,048', cost: '$0.0118' },
  opencode: { firstToken: '344ms', speed: '74', tokens: '960', cost: '$0.0031' },
  gemini: { firstToken: '198ms', speed: '128', tokens: '1,640', cost: '$0.0096' },
  grok: { firstToken: '276ms', speed: '95', tokens: '760', cost: '$0.0021' },
  dsh: { firstToken: '410ms', speed: '68', tokens: '3,210', cost: '$0.0019' }
}

/** Ground chips under the brick piles and the context chip on the hook. */
export const SITE_CACHE_CHIPS: readonly { x: number; value: string }[] = [
  { x: 147, value: '64%' },
  { x: 1032, value: '71%' }
]
export const SITE_CONTEXT_VALUE = '200K'

/* -------------------------------------------------------------------------- */
/* Demo panels (sample data, labelled「示例数据」/「示意」on the page)            */
/* -------------------------------------------------------------------------- */

/** Quick-start response row under the code panel. */
export const QUICKSTART_RESPONSE = { status: '200', latency: '286 ms', tokens: '1,284 / 356', cost: '$0.0213' } as const

export interface CallLogRow {
  time: string
  id: string
  vendor: BrandVendor
  model: string
  duration: string
  firstToken: string
  tokens: string
  cost: string
}

/** Call-log rows (Figma 46:3567). The first row is the tracked, expanded one. */
export const CALL_LOG_ROWS: readonly CallLogRow[] = [
  { time: '14:21:08', id: 'req_7f3a9c', vendor: 'claude', model: 'claude-fable-5-2', duration: '1.24s', firstToken: '312ms', tokens: '1,284 / 356', cost: '$0.0042' },
  { time: '14:20:51', id: 'req_7f3a9b', vendor: 'openai', model: 'gpt-6.1-sol', duration: '2.06s', firstToken: '486ms', tokens: '2,048 / 512', cost: '$0.0118' },
  { time: '14:20:37', id: 'req_7f3a9a', vendor: 'gemini', model: 'gemini-4-carbon', duration: '1.87s', firstToken: '401ms', tokens: '1,640 / 288', cost: '$0.0096' },
  { time: '14:20:12', id: 'req_7f3a99', vendor: 'claude', model: 'claude-fable-5-2', duration: '0.98s', firstToken: '640ms', tokens: '980 / 120', cost: '$0.0031' },
  { time: '14:19:58', id: 'req_7f3a98', vendor: 'grok', model: 'grok-4.7', duration: '1.42s', firstToken: '355ms', tokens: '760 / 96', cost: '$0.0021' }
]
export const CALL_LOG_TOTAL = '1,284'

/** Request timeline of the tracked row: only fields the usage log really has. */
export const CALL_LOG_TIMELINE = { firstToken: '312ms', duration: '1.24s', cost: '$0.0042' } as const

export interface KeyBudgetColumn {
  name: string
  /** Used share of the quota, 0–100. */
  percent: number
  used: string
  quota: string
  /** Rolling spending cap shown under the quota (5h / 1d / 7d windows exist per key). */
  cap: string
  /** Near or at the limit: bronze figure and the auto-disable note. */
  warn?: boolean
}

/** Key-budget card (Figma 46:3709), sample data. */
export const KEY_BUDGET: readonly KeyBudgetColumn[] = [
  { name: 'production', percent: 64, used: '$1,280', quota: '$2,000', cap: '$300' },
  { name: 'staging', percent: 18, used: '$90', quota: '$500', cap: '$80' },
  { name: 'claudeCode', percent: 41, used: '$205', quota: '$500', cap: '$120' },
  { name: 'team', percent: 96, used: '$960', quota: '$1,000', cap: '$200', warn: true }
]
