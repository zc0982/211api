import { ARMILLARY_WEBGL } from '../config'

/**
 * Why the hero keeps (or falls back to) the static render.
 * Pre-load reasons are decided before three.js is imported; runtime reasons
 * stop and dispose an already running scene.
 */
export type StaticReason =
  | 'reduced-motion'
  | 'no-webgl'
  | 'low-cores'
  | 'low-memory'
  | 'narrow'
  | 'context-failed'
  | 'context-lost'
  | 'slow-frames'

export interface DeviceProbe {
  reducedMotion: boolean
  webgl: boolean
  /** navigator.hardwareConcurrency (undefined when the browser hides it). */
  cores?: number
  /** navigator.deviceMemory in GB (Chromium only). */
  memoryGB?: number
  viewportWidth: number
}

type Gates = Pick<
  typeof ARMILLARY_WEBGL,
  'maxLowEndCores' | 'maxLowEndMemoryGB' | 'stackBreakpoint' | 'enableOnNarrow'
>

/** Reason to stay static before loading three.js, or null to go ahead. */
export function staticReasonBeforeLoad(probe: DeviceProbe, gates: Gates = ARMILLARY_WEBGL): StaticReason | null {
  if (probe.reducedMotion) return 'reduced-motion'
  if (!probe.webgl) return 'no-webgl'
  if (typeof probe.cores === 'number' && probe.cores > 0 && probe.cores <= gates.maxLowEndCores) return 'low-cores'
  if (typeof probe.memoryGB === 'number' && probe.memoryGB > 0 && probe.memoryGB <= gates.maxLowEndMemoryGB) {
    return 'low-memory'
  }
  if (!gates.enableOnNarrow && probe.viewportWidth < gates.stackBreakpoint) return 'narrow'
  return null
}

/** True when the sampled frame times (ms) average above the limit. */
export function isSlowFrames(frameTimes: readonly number[], maxAvgMs: number = ARMILLARY_WEBGL.maxAvgFrameMs): boolean {
  if (frameTimes.length === 0) return false
  let sum = 0
  for (const ms of frameTimes) sum += ms
  return sum / frameTimes.length > maxAvgMs
}

/** Reads the device probe from the browser. Never throws. */
export function readDeviceProbe(reducedMotion: boolean): DeviceProbe {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
  return {
    reducedMotion,
    webgl: typeof window !== 'undefined' && typeof window.WebGLRenderingContext === 'function',
    cores: nav?.hardwareConcurrency,
    memoryGB: nav?.deviceMemory,
    viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth
  }
}

/** Pointer parallax only for a fine pointer that can hover (not touch). */
export function canUseParallax(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
