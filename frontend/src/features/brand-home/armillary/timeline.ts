/**
 * Armillary timeline: pure functions of elapsed animation time (ms).
 * No three.js here, so it is unit-tested directly.
 *
 *   0 ─────── 3.2s            first merge (intro, ease-out cubic)
 *   then every 9.5s:  dwell 2.0s (merged) → flip 7.5s (smootherstep) → merge
 *
 * Each inner ring turns about its own diameter, which lies in the equatorial
 * plane. A half turn (π) about such an axis maps the ring back onto the
 * equatorial plane, so a flip of n half turns ends exactly in the plane.
 * The merge is a property of the angle function itself, not an interpolation
 * towards a target.
 */

export const INTRO_MS = 3200
export const DWELL_MS = 2000
export const FLIP_MS = 7500
export const CYCLE_MS = DWELL_MS + FLIP_MS
export const LIGHT_LOOP_MS = 2400
export const MERGE_PULSE_MS = 1200

const PI = Math.PI
const TAU = Math.PI * 2

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/** Ken Perlin's smootherstep: 6x⁵ − 15x⁴ + 10x³ on [0, 1]. */
export function smootherstep(x: number): number {
  const t = clamp01(x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function easeOutCubic(x: number): number {
  const t = 1 - clamp01(x)
  return 1 - t * t * t
}

/** Half turns ring `ring` makes during flip `cycle` (always 1 or 2). */
export function halfTurns(ring: number, cycle: number): 1 | 2 {
  return (ring + cycle) % 2 === 0 ? 1 : 2
}

/** Turn direction per ring, alternating so neighbours counter-rotate. */
export function ringDirection(ring: number): 1 | -1 {
  return ring % 2 === 0 ? 1 : -1
}

/**
 * Intro spin per ring (radians still to go at t = 0). Not a multiple of π,
 * so the rings start visibly out of the plane.
 */
export function introSpin(ring: number): number {
  return PI * (2.35 + 0.4 * ring)
}

/** Half turns completed before flip `cycle` starts, reduced mod 2. */
function halfTurnsBefore(ring: number, cycle: number): number {
  // n(j) = 1 + [ (ring + j) odd ]. Sum over j < cycle, mod 2.
  const odd = ring % 2 === 0 ? Math.floor(cycle / 2) : Math.ceil(cycle / 2)
  return (cycle + odd) % 2
}

/** Rotation of ring `ring` about its in-plane axis at time `t` (radians, [0, 2π)). */
export function ringAngle(ring: number, t: number): number {
  const dir = ringDirection(ring)
  let angle: number
  if (t < INTRO_MS) {
    angle = introSpin(ring) * (1 - easeOutCubic(t / INTRO_MS))
  } else {
    const s = t - INTRO_MS
    const cycle = Math.floor(s / CYCLE_MS)
    const u = s - cycle * CYCLE_MS
    const base = PI * halfTurnsBefore(ring, cycle)
    angle = u < DWELL_MS ? base : base + PI * halfTurns(ring, cycle) * smootherstep((u - DWELL_MS) / FLIP_MS)
  }
  const a = (dir * angle) % TAU
  return a < 0 ? a + TAU : a
}

/** Number of merges that have happened by time `t` (the intro merge is #1). */
export function mergeCount(t: number): number {
  if (t < INTRO_MS) return 0
  return 1 + Math.floor((t - INTRO_MS) / CYCLE_MS)
}

/** Time of merge #m (m ≥ 1). */
export function mergeTime(m: number): number {
  return INTRO_MS + (m - 1) * CYCLE_MS
}

/** True while the rings sit in the equatorial plane (dwell after a merge). */
export function isMerged(t: number): boolean {
  if (t < INTRO_MS) return false
  return (t - INTRO_MS) % CYCLE_MS < DWELL_MS
}

/** Milliseconds since the latest merge, or null before the first one. */
export function sinceMerge(t: number): number | null {
  if (t < INTRO_MS) return null
  return (t - INTRO_MS) % CYCLE_MS
}

/** Merge pulse (expanding blue line, centre ring flash): 1 → 0 over MERGE_PULSE_MS. */
export function mergePulse(t: number): number {
  const since = sinceMerge(t)
  if (since === null || since >= MERGE_PULSE_MS) return 0
  return 1 - since / MERGE_PULSE_MS
}

/** Gold light point position along the tracked ring, [0, 1). Linear, 2.4s/turn. */
export function lightPhase(t: number): number {
  return (t % LIGHT_LOOP_MS) / LIGHT_LOOP_MS
}

/** Next vendor in the tracking order (wraps). Unknown → first. */
export function nextTracked<T>(current: T, order: readonly T[]): T {
  const i = order.indexOf(current)
  return order[(i + 1) % order.length]
}

/** Exponential damping step: move `current` towards `target` at `rate` per second. */
export function damp(current: number, target: number, rate: number, dtSeconds: number): number {
  return target + (current - target) * Math.exp(-rate * dtSeconds)
}
