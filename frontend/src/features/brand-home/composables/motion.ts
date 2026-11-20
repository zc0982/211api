import {
  GOLD_DOT,
  GOLD_DOT_FADE,
  GOLD_DOT_TRIP,
  HERO_FRAME,
  MOTION_LOOP,
  PAN_PERIOD,
  SITE_BEATS,
  SITE_CHIP_TIMES,
  SITE_COUNT_UP,
  SITE_FRAME,
  SITE_HOOK,
  TRACE_PULSE,
  type EcosystemTool,
  type HeroCharacter,
  type SiteChipKind,
  type SiteWorker
} from '../config'
import { pointOnTrace, type Point, type Trace } from './starlink'

/**
 * Timeline of the v3 pixel scenes (handoff PR 2), as pure functions of the
 * scene time t in seconds. Components only render what these return; tests in
 * motion.spec.ts pin every segment boundary.
 */

export type ActorKind = 'work' | 'walk' | 'empty'

export interface ActorState {
  /** Centre x in scene pixels. */
  x: number
  kind: ActorKind
  /** 0..3 within the kind. */
  frame: number
  /** Facing left: scaleX(-1). The sprites face right. */
  mirror: boolean
}

export interface HeroActorState extends ActorState {
  /** Station this character is working at, if any (lights its chip). */
  station?: EcosystemTool
}

export interface SiteActorState extends ActorState {
  /** Parameter chip over the head, or none. */
  chip: SiteChipKind | null
}

/** Round to the microsecond so 3.8, 4.2 + 0.9, (t + offset) mod 9.6 land exactly on segment edges. */
const q = (n: number) => Math.round(n * 1e6) / 1e6

/** Positive modulo, quantised to the microsecond. */
export const mod = (a: number, n: number) => {
  const r = q(a) % n
  return q(r < 0 ? r + n : r)
}

/** Frame index for a running clock; the epsilon keeps 0.6 / 0.2 from flooring to 2. */
export const frameAt = (tb: number, perFrame: number) => Math.floor(tb / perFrame + 1e-9) % 4

/** Sine ease-in-out on [0, 1]. */
export const easeInOut = (p: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, p))) / 2

const lerp = (a: number, b: number, p: number) => a + (b - a) * p

/* --------------------------------- hero ---------------------------------- */

export function heroStateAt(c: HeroCharacter, t: number): HeroActorState {
  const [workA, walkAB, workB] = c.beats
  const tb = mod(t + c.offset, MOTION_LOOP)
  const work = frameAt(tb, HERO_FRAME.work)
  const walk = frameAt(tb, HERO_FRAME.walk)
  const t1 = workA
  const t2 = q(t1 + walkAB)
  const t3 = q(t2 + workB)
  if (tb < t1) return { x: c.x, kind: 'work', frame: work, mirror: false, station: c.stationA }
  if (tb < t2) return { x: lerp(c.x, c.b, (tb - t1) / walkAB), kind: 'walk', frame: walk, mirror: c.b < c.x }
  if (tb < t3) return { x: c.b, kind: 'work', frame: work, mirror: false, station: c.stationB }
  return { x: lerp(c.b, c.x, (tb - t3) / (MOTION_LOOP - t3)), kind: 'walk', frame: walk, mirror: c.x < c.b }
}

/** Still frame (reduced motion): everyone at A, work frame 1. */
export function heroRestState(c: HeroCharacter): HeroActorState {
  return { x: c.x, kind: 'work', frame: 0, mirror: false, station: c.stationA }
}

/** Stations whose chip is lit: someone works there. The tracked station is always lit. */
export function litStations(states: readonly HeroActorState[], always: EcosystemTool = 'claudeCode'): Set<EcosystemTool> {
  const lit = new Set<EcosystemTool>([always])
  for (const s of states) if (s.kind === 'work' && s.station) lit.add(s.station)
  return lit
}

/* --------------------------------- site ---------------------------------- */

export function siteStateAt(w: SiteWorker, t: number): SiteActorState {
  const tb = mod(t + w.offset, MOTION_LOOP)
  const t1 = SITE_BEATS.lay
  const t2 = q(t1 + SITE_BEATS.back)
  const t3 = q(t2 + SITE_BEATS.pickup)
  // Lay facing the wall, i.e. away from the pile.
  const layMirror = w.pile > w.wall
  if (tb < t1) {
    return {
      x: w.wall,
      kind: 'work',
      frame: frameAt(tb, SITE_FRAME.work),
      mirror: layMirror,
      chip: tb < SITE_CHIP_TIMES.firstToken ? 'firstToken' : 'speed'
    }
  }
  const walk = frameAt(tb, SITE_FRAME.walk)
  if (tb < t2) {
    return {
      x: lerp(w.wall, w.pile, (tb - t1) / SITE_BEATS.back),
      kind: 'empty',
      frame: walk,
      mirror: w.pile < w.wall,
      chip: q(tb - t1) < SITE_CHIP_TIMES.cost ? 'cost' : null
    }
  }
  if (tb < t3) return { x: w.pile, kind: 'walk', frame: 0, mirror: w.wall < w.pile, chip: 'tokens' }
  return { x: lerp(w.pile, w.wall, (tb - t3) / SITE_BEATS.carry), kind: 'walk', frame: walk, mirror: w.wall < w.pile, chip: 'tokens' }
}

/** Still frame (reduced motion): everyone at the wall, work frame 1, first-token chip. */
export function siteRestState(w: SiteWorker): SiteActorState {
  return { x: w.wall, kind: 'work', frame: 0, mirror: w.pile > w.wall, chip: 'firstToken' }
}

/** Cubic ease-out: quick start, slow finish (counters settle onto the target). */
export const easeOut = (p: number) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3

/** Integer count from `from` to `to` at progress p. */
export const countUp = (from: number, to: number, p: number) => Math.round(lerp(from, to, easeOut(p)))

/** tok/s shown on a worker's chip: climbs from 30% to the target after the chip appears. */
export function siteSpeedAt(w: SiteWorker, target: number, t: number): number {
  const tb = mod(t + w.offset, MOTION_LOOP)
  const shown = tb - SITE_CHIP_TIMES.firstToken
  if (shown < 0 || tb >= SITE_BEATS.lay) return target
  return countUp(Math.round(target * SITE_COUNT_UP.speedFrom), target, shown / SITE_COUNT_UP.speedRise)
}

/** Cache-hit percentage under a brick pile: climbs once per loop, then holds. */
export function cacheHitAt(chip: { from: number; to: number; offset: number }, t: number): number {
  const tb = mod(t - chip.offset, MOTION_LOOP)
  return countUp(chip.from, chip.to, tb / SITE_COUNT_UP.cacheRise)
}

/** Crane hook top y. */
export function hookYAt(t: number): number {
  const [down, wait, up] = SITE_HOOK.times
  const tb = mod(t, MOTION_LOOP)
  if (tb < down) return lerp(SITE_HOOK.y, SITE_HOOK.bottom, easeInOut(tb / down))
  if (tb < wait) return SITE_HOOK.bottom
  if (tb < up) return lerp(SITE_HOOK.bottom, SITE_HOOK.y, easeInOut((tb - wait) / (up - wait)))
  return SITE_HOOK.y
}

/* ------------------------------- gold dot -------------------------------- */

export interface ArcTable {
  trace: Trace
  /** Cumulative length at u = i / (n − 1). */
  lengths: number[]
}

export function arcTable(trace: Trace, samples = 256): ArcTable {
  const lengths = [0]
  let prev = pointOnTrace(trace, 0)
  for (let i = 1; i < samples; i++) {
    const p = pointOnTrace(trace, i / (samples - 1))
    lengths.push(lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y))
    prev = p
  }
  return { trace, lengths }
}

/** Point at a fraction of the curve's arc length (what SVG getPointAtLength gives). */
export function pointAtFraction(table: ArcTable, f: number): Point {
  const { lengths } = table
  const total = lengths[lengths.length - 1]
  const target = Math.min(1, Math.max(0, f)) * total
  let lo = 0
  let hi = lengths.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] < target) lo = mid
    else hi = mid
  }
  const span = lengths[hi] - lengths[lo] || 1
  const u = (lo + (target - lengths[lo]) / span) / (lengths.length - 1)
  return pointOnTrace(table.trace, u)
}

/** Arc fraction of the curve point nearest to p. */
export function nearestFraction(table: ArcTable, p: Point): number {
  const { lengths } = table
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < lengths.length; i++) {
    const q = pointOnTrace(table.trace, i / (lengths.length - 1))
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return lengths[best] / lengths[lengths.length - 1]
}

export interface DotState extends Point {
  opacity: number
}

/**
 * Gold dot on the tracked trace. `phase` (seconds) is chosen so t = 0 shows
 * the dot where the still frame has it (GOLD_DOT), so starting the clock does
 * not make it jump.
 */
export function dotStateAt(table: ArcTable, t: number, phase: number): DotState {
  const tb = mod(t + phase, GOLD_DOT_TRIP)
  const p = pointAtFraction(table, tb / GOLD_DOT_TRIP)
  const opacity = Math.min(1, tb / GOLD_DOT_FADE, (GOLD_DOT_TRIP - tb) / GOLD_DOT_FADE)
  return { ...p, opacity }
}

export interface PulseState extends DotState {
  /** Direction of travel in degrees (for the comet tail). */
  angle: number
}

/**
 * Moonlight pulse on an untracked trace: `slot` is its place in the cascade
 * (0, 1, 2 …). Hidden (opacity 0) between trips.
 */
export function pulseStateAt(table: ArcTable, t: number, slot: number): PulseState {
  const tb = mod(t - slot * TRACE_PULSE.stagger, TRACE_PULSE.period)
  if (tb >= TRACE_PULSE.trip) return { ...pointAtFraction(table, 1), opacity: 0, angle: 0 }
  const f = tb / TRACE_PULSE.trip
  const p = pointAtFraction(table, f)
  // Heading: from a point just behind to the head, so the comet tail trails along the curve.
  const back = pointAtFraction(table, Math.max(0, f - 0.01))
  const ahead = f < 0.01 ? pointAtFraction(table, 0.01) : p
  const angle = (Math.atan2(ahead.y - back.y, ahead.x - back.x) * 180) / Math.PI
  const opacity = Math.min(1, tb / GOLD_DOT_FADE, (TRACE_PULSE.trip - tb) / GOLD_DOT_FADE)
  return { ...p, opacity, angle }
}

export function dotPhase(table: ArcTable): number {
  return nearestFraction(table, GOLD_DOT) * GOLD_DOT_TRIP
}

/* ------------------------------ narrow pan ------------------------------- */

/**
 * Narrow-screen camera: how far the world is shifted left, 0..overflow.
 * One round trip per PAN_PERIOD, ease-in-out each way, starting at the left.
 */
export function panAt(time: number, overflow: number): number {
  if (overflow <= 0) return 0
  const half = PAN_PERIOD / 2
  const p = mod(time, PAN_PERIOD) / half
  return overflow * easeInOut(p < 1 ? p : 2 - p)
}
