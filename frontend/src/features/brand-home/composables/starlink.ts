import { HERO_FEET_Y, SPRITE_SCALE, TRACE_ORIGIN, type HeroCharacter, type HeroStation } from '../config'

/**
 * Geometry of the hero「星链」scene (pure functions, tested in starlink.spec.ts).
 * All values are in the 1440×900 design space.
 */

export interface Point {
  x: number
  y: number
}

export interface Trace {
  start: Point
  c1: Point
  c2: Point
  end: Point
}

/** Top centre of a station's status chip: where its trace lands. */
export function chipAnchor(station: Pick<HeroStation, 'chipX' | 'chipY' | 'chipW'>): Point {
  return { x: station.chipX + station.chipW / 2, y: station.chipY }
}

/**
 * Cubic Bézier from the moon to a chip (handoff v3 §2):
 * c1 = s + (dx·0.22, dy·0.42), c2 = e − (dx·0.18, dy·0.48).
 */
export function traceFor(end: Point, start: Point = TRACE_ORIGIN): Trace {
  const dx = end.x - start.x
  const dy = end.y - start.y
  return {
    start,
    c1: { x: start.x + dx * 0.22, y: start.y + dy * 0.42 },
    c2: { x: end.x - dx * 0.18, y: end.y - dy * 0.48 },
    end
  }
}

const r = (n: number) => Math.round(n * 100) / 100

export function tracePath(t: Trace): string {
  return `M ${r(t.start.x)} ${r(t.start.y)} C ${r(t.c1.x)} ${r(t.c1.y)} ${r(t.c2.x)} ${r(t.c2.y)} ${r(t.end.x)} ${r(t.end.y)}`
}

/** Point on the curve at parameter u ∈ [0, 1]. */
export function pointOnTrace(t: Trace, u: number): Point {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return {
    x: a * t.start.x + b * t.c1.x + c * t.c2.x + d * t.end.x,
    y: a * t.start.y + b * t.c1.y + c * t.c2.y + d * t.end.y
  }
}

/** Pixel prop box: left edge from config, bottom on the characters' feet line. */
export function propBox(station: Pick<HeroStation, 'propX' | 'propW' | 'propH'>) {
  const w = station.propW * SPRITE_SCALE
  const h = station.propH * SPRITE_SCALE
  return { left: station.propX, top: HERO_FEET_Y - h, width: w, height: h }
}

/** Character sprite box: centred on x, feet on the ground. */
export function characterBox(c: Pick<HeroCharacter, 'x' | 'w' | 'h'>) {
  const w = c.w * SPRITE_SCALE
  const h = c.h * SPRITE_SCALE
  return { left: c.x - w / 2, top: HERO_FEET_Y - h, width: w, height: h }
}
