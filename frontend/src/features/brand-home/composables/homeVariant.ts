/**
 * Decides which page renders at /home. Pure so the four branches are
 * unit-testable; the order is the contract in docs/spec/brand-home.md.
 */

export type HomeVariant = 'upstream' | 'brand'

export interface HomeVariantSettings {
  home_content?: string | null
  compact_home_enabled?: boolean | null
}

export interface HomeVariantEnv {
  VITE_BRAND_HOME?: string
}

export function resolveHomeVariant(
  settings: HomeVariantSettings | null | undefined,
  env: HomeVariantEnv
): HomeVariant {
  // 1) Admin-provided home content always wins (also the runtime fallback).
  if ((settings?.home_content ?? '').trim().length > 0) return 'upstream'
  // 2) Compact home is an upstream feature; keep its behaviour.
  if (settings?.compact_home_enabled === true) return 'upstream'
  // 3) Build-time emergency switch.
  if (env.VITE_BRAND_HOME === 'off') return 'upstream'
  // 4) Default, including "settings unknown".
  return 'brand'
}
