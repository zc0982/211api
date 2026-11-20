import { HERO_FEET_Y, HERO_FIT, NARROW_SCENE_SCALE, SPRITE_SCALE, TRACE_ORIGIN, type HeroStation } from '../config'

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


export interface StageLayout {
  /** World → screen scale. */
  scale: number
  /** World height shown (design units). */
  worldHeight: number
  /** Smallest stage height in screen px (fit mode), or the fixed stage height. */
  stageHeight: number
}

/**
 * How a 1440-wide world sits in its stage (PixelStage).
 * - Not panning (≥ 860px, or reduced motion): scale to the stage width.
 * - Panning (< 860px): 0.75×, or in `fit` mode smaller (down to
 *   HERO_FIT.narrowMinScale) so about HERO_FIT.narrowHeight world px fit —
 *   but never below the width scale, so the world always covers the stage
 *   (narrow and short, e.g. a phone held sideways, must not leave a blank
 *   strip on the right). The camera only moves when the world overflows.
 * - `fit`: the world is as tall as the stage at that scale, never below
 *   HERO_FIT.minHeight; otherwise it is `designHeight` and the stage follows.
 */
export function stageLayout(opts: {
  stageWidth: number
  stageHeight: number
  worldWidth: number
  designHeight: number
  pan: boolean
  fit: boolean
}): StageLayout {
  const { stageWidth, stageHeight, worldWidth, designHeight, pan, fit } = opts
  const widthScale = Math.max(0.1, stageWidth / worldWidth)
  let scale = widthScale
  if (pan) {
    const wanted = fit ? Math.min(NARROW_SCENE_SCALE, Math.max(HERO_FIT.narrowMinScale, stageHeight / HERO_FIT.narrowHeight)) : NARROW_SCENE_SCALE
    scale = Math.max(widthScale, wanted)
  }
  if (!fit) return { scale, worldHeight: designHeight, stageHeight: designHeight * scale }
  // At least the minimum world at this scale; when panning, also the smallest narrow stage.
  const minStage = pan ? Math.max(HERO_FIT.narrowHeight * HERO_FIT.narrowMinScale, HERO_FIT.minHeight * scale) : HERO_FIT.minHeight * scale
  return { scale, worldHeight: Math.max(HERO_FIT.minHeight, Math.max(stageHeight, minStage) / scale), stageHeight: minStage }
}
