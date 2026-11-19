import { describe, expect, it } from 'vitest'
import {
  CYCLE_MS,
  DWELL_MS,
  FLIP_MS,
  INTRO_MS,
  damp,
  easeOutCubic,
  halfTurns,
  isMerged,
  lightPhase,
  mergeCount,
  mergePulse,
  mergeTime,
  nextTracked,
  ringAngle,
  smootherstep
} from '../armillary/timeline'
import { ARMILLARY_RINGS } from '../config'

const RINGS = ARMILLARY_RINGS.length
const ORDER = ARMILLARY_RINGS.map((r) => r.vendor)

/** Distance of an angle from the equatorial plane: 0 when it is a multiple of π. */
const offPlane = (a: number) => Math.abs(Math.sin(a))
/** Smallest difference between two angles. */
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return Math.min(d, Math.PI * 2 - d)
}

describe('armillary timeline', () => {
  it('uses the spec rhythm: 3.2s intro, 9.5s cycle = 7.5s flip + 2.0s dwell', () => {
    expect(INTRO_MS).toBe(3200)
    expect(FLIP_MS).toBe(7500)
    expect(DWELL_MS).toBe(2000)
    expect(CYCLE_MS).toBe(9500)
  })

  it('smootherstep is clamped, symmetric and flat at both ends', () => {
    expect(smootherstep(-1)).toBe(0)
    expect(smootherstep(0)).toBe(0)
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 12)
    expect(smootherstep(1)).toBe(1)
    expect(smootherstep(2)).toBe(1)
    for (const x of [0.1, 0.25, 0.4]) expect(smootherstep(x) + smootherstep(1 - x)).toBeCloseTo(1, 12)
    // first derivative ≈ 0 at the ends
    expect(smootherstep(1e-4) / 1e-4).toBeLessThan(1e-6)
    expect((1 - smootherstep(1 - 1e-4)) / 1e-4).toBeLessThan(1e-6)
  })

  it('easeOutCubic reaches 1 at the end of the intro', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 12)
  })

  it('starts with every ring out of the equatorial plane', () => {
    for (let i = 0; i < RINGS; i++) expect(offPlane(ringAngle(i, 0))).toBeGreaterThan(0.2)
  })

  it('puts every ring exactly back in the equatorial plane at each merge', () => {
    for (let m = 1; m <= 12; m++) {
      const t = mergeTime(m)
      for (let i = 0; i < RINGS; i++) expect(offPlane(ringAngle(i, t))).toBeLessThan(1e-9)
    }
  })

  it('holds the merged pose for the whole dwell, and leaves it during the flip', () => {
    for (let m = 1; m <= 4; m++) {
      const t0 = mergeTime(m)
      for (const dt of [0, 500, 1999]) {
        expect(isMerged(t0 + dt)).toBe(true)
        for (let i = 0; i < RINGS; i++) expect(angleDiff(ringAngle(i, t0 + dt), ringAngle(i, t0))).toBeLessThan(1e-9)
      }
      // 30% into the flip: 1-half-turn rings are ~0.5 rad out, 2-half-turn rings ~1.0 rad.
      const during = t0 + DWELL_MS + FLIP_MS * 0.3
      expect(isMerged(during)).toBe(false)
      for (let i = 0; i < RINGS; i++) expect(offPlane(ringAngle(i, during))).toBeGreaterThan(0.45)
    }
  })

  it('flips each ring by 1 or 2 half turns per cycle, ending where the angle function lands', () => {
    for (let c = 0; c < 6; c++) {
      for (let i = 0; i < RINGS; i++) {
        const n = halfTurns(i, c)
        expect([1, 2]).toContain(n)
        const before = ringAngle(i, mergeTime(c + 1))
        const after = ringAngle(i, mergeTime(c + 2))
        const expected = (before + Math.PI * n) % (Math.PI * 2)
        expect(angleDiff(after, expected)).toBeLessThan(1e-9)
      }
    }
    // Neighbouring rings do not flip in lockstep.
    expect(halfTurns(0, 0)).not.toBe(halfTurns(1, 0))
  })

  it('is continuous across phase boundaries (no snapping)', () => {
    const boundaries = [INTRO_MS, mergeTime(2), mergeTime(2) + DWELL_MS, mergeTime(5), mergeTime(5) + DWELL_MS]
    for (const b of boundaries) {
      for (let i = 0; i < RINGS; i++) expect(angleDiff(ringAngle(i, b - 0.01), ringAngle(i, b + 0.01))).toBeLessThan(1e-3)
    }
  })

  it('repeats with a 9.5s period after the intro (mod the half-turn parity)', () => {
    for (let i = 0; i < RINGS; i++) {
      const t = mergeTime(3) + DWELL_MS + 1234
      // Two cycles add 3 half turns: an odd count, i.e. a mirror flip. Four cycles add 6: identical.
      expect(angleDiff(ringAngle(i, t), ringAngle(i, t + CYCLE_MS * 4))).toBeLessThan(1e-9)
    }
  })

  it('counts merges: intro merge is #1, then one every cycle', () => {
    expect(mergeCount(0)).toBe(0)
    expect(mergeCount(INTRO_MS - 1)).toBe(0)
    expect(mergeCount(INTRO_MS)).toBe(1)
    expect(mergeCount(INTRO_MS + CYCLE_MS - 1)).toBe(1)
    expect(mergeCount(INTRO_MS + CYCLE_MS)).toBe(2)
    expect(mergeTime(2)).toBe(INTRO_MS + CYCLE_MS)
  })

  it('fires the merge pulse once per merge and fades it out', () => {
    expect(mergePulse(INTRO_MS - 1)).toBe(0)
    expect(mergePulse(INTRO_MS)).toBe(1)
    expect(mergePulse(INTRO_MS + 600)).toBeCloseTo(0.5, 9)
    expect(mergePulse(INTRO_MS + 1200)).toBe(0)
    expect(mergePulse(mergeTime(3) + 1)).toBeGreaterThan(0.99)
  })

  it('moves the light point linearly, one loop per 2.4s', () => {
    expect(lightPhase(0)).toBe(0)
    expect(lightPhase(600)).toBeCloseTo(0.25, 12)
    expect(lightPhase(2400)).toBe(0)
    expect(lightPhase(3600)).toBeCloseTo(0.5, 12)
  })

  it('rotates tracking outer → inner and wraps: Claude → OpenAI → Gemini → Grok → Claude', () => {
    expect(ORDER).toEqual(['claude', 'openai', 'gemini', 'grok'])
    const seen = [ORDER[0]]
    for (let k = 0; k < 4; k++) seen.push(nextTracked(seen[seen.length - 1], ORDER))
    expect(seen).toEqual(['claude', 'openai', 'gemini', 'grok', 'claude'])
  })

  it('damps exponentially towards the target', () => {
    expect(damp(0, 1, 2.6, 0)).toBe(0)
    expect(damp(0, 1, 2.6, 1)).toBeCloseTo(1 - Math.exp(-2.6), 12)
    expect(damp(0.2, 0.2, 2.6, 0.016)).toBe(0.2)
  })
})
