import { describe, expect, it } from 'vitest'
import {
  GOLD_DOT,
  HERO_CHARACTERS,
  HERO_STATIONS,
  MOTION_LOOP,
  SITE_CACHE_CHIPS,
  SITE_HOOK,
  SITE_WORKERS,
  TRACE_PULSE,
  type SceneCharacter
} from '../config'
import {
  arcTable,
  cacheHitAt,
  countUp,
  siteSpeedAt,
  dotPhase,
  dotStateAt,
  frameAt,
  heroRestState,
  heroStateAt,
  hookYAt,
  litStations,
  panAt,
  pointAtFraction,
  pulseStateAt,
  siteRestState,
  siteStateAt
} from '../composables/motion'
import { chipAnchor, traceFor } from '../composables/starlink'

const hero = (id: SceneCharacter) => HERO_CHARACTERS.find((c) => c.id === id)!
const worker = (id: SceneCharacter) => SITE_WORKERS.find((w) => w.id === id)!
/** Scene time t at which a character's own timeline reads tb. */
const at = (tb: number, offset: number) => tb - offset

describe('hero walk table', () => {
  it('every rhythm fills the 9.6s loop', () => {
    for (const c of HERO_CHARACTERS) expect(c.beats.reduce((a, b) => a + b, 0)).toBeCloseTo(MOTION_LOOP)
  })

  it('Claude: works at Claude Code, walks to Cursor, works there, walks back', () => {
    const c = hero('claude')
    const s = (tb: number) => heroStateAt(c, at(tb, c.offset))
    expect(s(0)).toEqual({ x: 90, kind: 'work', frame: 0, mirror: false, station: 'claudeCode' })
    expect(s(2.79).kind).toBe('work')
    expect(s(2.8)).toMatchObject({ x: 90, kind: 'walk', mirror: false })
    expect(s(3.8).x).toBeCloseTo((90 + 242) / 2)
    expect(s(4.8)).toMatchObject({ x: 242, kind: 'work', station: 'cursor' })
    expect(s(7.6)).toMatchObject({ x: 242, kind: 'walk', mirror: true })
    expect(s(8.6).x).toBeCloseTo((90 + 242) / 2)
    expect(s(9.599).x).toBeCloseTo(90, 0)
  })

  it('Grok walks left to the observatory (mirrored) and right back home', () => {
    const c = hero('grok')
    const s = (tb: number) => heroStateAt(c, at(tb, c.offset))
    expect(s(0)).toMatchObject({ x: 1346, kind: 'work', station: 'openClaw' })
    expect(s(2)).toMatchObject({ kind: 'walk', mirror: true })
    expect(s(4.8)).toMatchObject({ x: 1102, kind: 'work', station: undefined })
    expect(s(6.8)).toMatchObject({ kind: 'walk', mirror: false })
  })

  it('OpenCode / DSH stay near their stations on the 4.2 / 0.9 / 3.6 / 0.9 rhythm', () => {
    for (const id of ['opencode', 'dsh'] as const) {
      const c = hero(id)
      const s = (tb: number) => heroStateAt(c, at(tb, c.offset))
      expect(s(4.19)).toMatchObject({ x: c.x, kind: 'work', station: c.stationA })
      expect(s(4.2).kind).toBe('walk')
      expect(s(5.1)).toMatchObject({ x: c.b, kind: 'work' })
      expect(s(8.7).kind).toBe('walk')
    }
  })

  it('applies the phase offset: tb = (t + offset) mod 9.6', () => {
    const c = hero('gpt')
    expect(heroStateAt(c, 0)).toEqual(heroStateAt(c, MOTION_LOOP))
    expect(heroStateAt(c, -c.offset)).toEqual(heroStateAt({ ...c, offset: 0 }, 0))
  })

  it('steps work frames every 0.2s and walk frames every 0.15s, 4-frame loops', () => {
    expect([0, 0.2, 0.4, 0.6, 0.8].map((t) => frameAt(t, 0.2))).toEqual([0, 1, 2, 3, 0])
    expect([0.15, 0.3, 0.45, 0.6].map((t) => frameAt(t, 0.15))).toEqual([1, 2, 3, 0])
    const c = hero('gemini') // offset 0, works 0–2.6
    expect(heroStateAt(c, 0.59).frame).toBe(2)
    expect(heroStateAt(c, 0.6).frame).toBe(3)
    expect(heroStateAt(c, 2.6 + 0.01)).toMatchObject({ kind: 'walk', frame: frameAt(2.61, 0.15) })
  })

  it('t = 0 lights the same chips as the Figma still: Claude Code, OpenCode, Codex, Hermes', () => {
    const lit = litStations(HERO_CHARACTERS.map((c) => heroStateAt(c, 0)))
    expect([...lit].sort()).toEqual(['claudeCode', 'codex', 'hermes', 'openCode'])
    const dim = HERO_STATIONS.filter((s) => !lit.has(s.tool)).map((s) => s.tool)
    expect(dim).toEqual(['cursor', 'pi', 'deepseekHarness', 'openClaw'])
  })

  it('lights Cursor while Claude works there, and keeps the tracked Claude Code chip lit', () => {
    const c = hero('claude')
    const lit = litStations([heroStateAt(c, at(5, c.offset))])
    expect(lit.has('cursor')).toBe(true)
    expect(lit.has('claudeCode')).toBe(true)
    // Walking lights nothing.
    expect([...litStations([heroStateAt(c, at(3, c.offset))])]).toEqual(['claudeCode'])
  })

  it('reduced motion: everyone at A on work frame 1, their own stations lit', () => {
    const rest = HERO_CHARACTERS.map(heroRestState)
    for (const [i, c] of HERO_CHARACTERS.entries()) {
      expect(rest[i]).toEqual({ x: c.x, kind: 'work', frame: 0, mirror: false, station: c.stationA })
    }
    expect([...litStations(rest)].sort()).toEqual(['claudeCode', 'codex', 'deepseekHarness', 'hermes', 'openClaw', 'openCode'])
  })
})

describe('site loop', () => {
  it('left team: lay facing right → back empty facing left → pick up → carry facing right', () => {
    const w = worker('claude') // offset 0
    expect(siteStateAt(w, 0)).toEqual({ x: 405, kind: 'work', frame: 0, mirror: false, chip: 'firstToken' })
    expect(siteStateAt(w, 0.99).chip).toBe('firstToken')
    expect(siteStateAt(w, 1).chip).toBe('speed')
    expect(siteStateAt(w, 3.8)).toMatchObject({ x: 405, kind: 'empty', mirror: true, chip: 'cost' })
    expect(siteStateAt(w, 4.99).chip).toBe('cost')
    expect(siteStateAt(w, 5)).toMatchObject({ kind: 'empty', chip: null })
    expect(siteStateAt(w, 5.1).x).toBeCloseTo((405 + 236) / 2)
    expect(siteStateAt(w, 6.4)).toEqual({ x: 236, kind: 'walk', frame: 0, mirror: false, chip: 'tokens' })
    expect(siteStateAt(w, 6.99)).toMatchObject({ x: 236, frame: 0 })
    expect(siteStateAt(w, 7)).toMatchObject({ x: 236, kind: 'walk', mirror: false, chip: 'tokens' })
    expect(siteStateAt(w, 8.3).x).toBeCloseTo((236 + 405) / 2)
  })

  it('right team mirrors it: lay facing left, back empty facing right, carry facing left', () => {
    const w = worker('gemini')
    expect(siteStateAt(w, 0)).toMatchObject({ x: 880, kind: 'work', mirror: true })
    expect(siteStateAt(w, 4)).toMatchObject({ kind: 'empty', mirror: false })
    expect(siteStateAt(w, 6.5)).toMatchObject({ x: 1045, kind: 'walk', mirror: true })
    expect(siteStateAt(w, 8)).toMatchObject({ kind: 'walk', mirror: true })
  })

  it('t = 0 matches the Figma still (offsets 0 / 3.2 / 6.4 per team)', () => {
    const s = (id: SceneCharacter) => siteStateAt(worker(id), 0)
    expect(s('claude')).toMatchObject({ x: 405, kind: 'work', chip: 'firstToken' })
    expect(s('gpt')).toMatchObject({ x: 435, kind: 'work', chip: 'speed' })
    expect(s('opencode')).toMatchObject({ x: 222, kind: 'walk', frame: 0, chip: 'tokens' })
    expect(s('gemini')).toMatchObject({ x: 880, kind: 'work', mirror: true, chip: 'firstToken' })
    expect(s('grok')).toMatchObject({ x: 908, kind: 'work', mirror: true, chip: 'speed' })
    expect(s('dsh')).toMatchObject({ x: 1059, kind: 'walk', mirror: true, chip: 'tokens' })
  })

  it('steps lay frames every 0.2s and walk frames every 0.17s', () => {
    const w = worker('claude')
    expect(siteStateAt(w, 0.6).frame).toBe(3)
    expect(siteStateAt(w, 4.08).frame).toBe(frameAt(4.08, 0.17))
    expect(frameAt(0.34, 0.17)).toBe(2)
  })

  it('reduced motion: everyone at the wall, laying, frame 1, first-token chip', () => {
    for (const w of SITE_WORKERS) {
      expect(siteRestState(w)).toEqual({ x: w.wall, kind: 'work', frame: 0, mirror: w.pile > w.wall, chip: 'firstToken' })
    }
  })

  it('crane hook: down 0–2.4s (ease-in-out), waits to 4.0s, up by 6.4s, rests', () => {
    expect(hookYAt(0)).toBe(SITE_HOOK.y)
    expect(hookYAt(1.2)).toBeCloseTo((SITE_HOOK.y + SITE_HOOK.bottom) / 2)
    expect(hookYAt(0.3) - SITE_HOOK.y).toBeLessThan((SITE_HOOK.bottom - SITE_HOOK.y) * (0.3 / 2.4))
    expect(hookYAt(2.4)).toBe(SITE_HOOK.bottom)
    expect(hookYAt(3.99)).toBe(SITE_HOOK.bottom)
    expect(hookYAt(5.2)).toBeCloseTo((SITE_HOOK.y + SITE_HOOK.bottom) / 2)
    expect(hookYAt(6.4)).toBe(SITE_HOOK.y)
    expect(hookYAt(9.5)).toBe(SITE_HOOK.y)
    expect(hookYAt(MOTION_LOOP + 1.2)).toBeCloseTo(hookYAt(1.2))
  })
})

describe('footer counters (cache hit, tok/s)', () => {
  it('counts in integers from low to high with an ease-out, and holds at the target', () => {
    expect(countUp(38, 64, 0)).toBe(38)
    expect(countUp(38, 64, 1)).toBe(64)
    expect(countUp(38, 64, 2)).toBe(64)
    expect(countUp(38, 64, 0.5)).toBeGreaterThan(38 + 13) // ease-out: past halfway at half time
    for (let p = 0; p < 1; p += 0.05) expect(countUp(38, 64, p + 0.05)).toBeGreaterThanOrEqual(countUp(38, 64, p))
  })

  it('cache hit climbs once per loop, from its start offset, then holds', () => {
    const [left, right] = SITE_CACHE_CHIPS
    expect(cacheHitAt(left, 0)).toBe(left.from)
    expect(cacheHitAt(left, 3.2)).toBeGreaterThan(left.from)
    expect(cacheHitAt(left, 3.2)).toBeLessThan(left.to)
    expect(cacheHitAt(left, 6.4)).toBe(left.to)
    expect(cacheHitAt(left, 9.5)).toBe(left.to)
    expect(cacheHitAt(left, MOTION_LOOP)).toBe(left.from)
    // The right pile runs half a loop later.
    expect(cacheHitAt(right, 4.8)).toBe(right.from)
    expect(cacheHitAt(right, 0)).toBe(right.to)
  })

  it('tok/s starts at 30% when the chip appears (1s into laying) and reaches the target in 1.2s', () => {
    const w = worker('gpt')
    const at = (tb: number) => siteSpeedAt(w, 112, tb - w.offset)
    expect(at(1.0)).toBe(34)
    expect(at(1.6)).toBeGreaterThan(34)
    expect(at(1.6)).toBeLessThan(112)
    expect(at(2.2)).toBe(112)
    expect(at(3.7)).toBe(112)
    expect(at(0.5)).toBe(112) // chip not shown: value irrelevant, stays at the target
  })
})

describe('gold dot', () => {
  const tracked = HERO_STATIONS.find((s) => s.tracked)!
  const table = arcTable(traceFor(chipAnchor(tracked)))

  it('runs the whole gold trace by arc length, moon to chip', () => {
    expect(pointAtFraction(table, 0)).toEqual({ x: 1060, y: 264 })
    const end = pointAtFraction(table, 1)
    expect(end.x).toBeCloseTo(141)
    expect(end.y).toBeCloseTo(696)
  })

  it('starts where the still frame puts it, so the clock starting does not jump', () => {
    const p = dotStateAt(table, 0, dotPhase(table))
    expect(Math.hypot(p.x - GOLD_DOT.x, p.y - GOLD_DOT.y)).toBeLessThan(3)
    expect(p.opacity).toBe(1)
  })

  it('fades in and out over 0.25s at each end of its 2.4s trip', () => {
    expect(dotStateAt(table, 0, 0).opacity).toBe(0)
    expect(dotStateAt(table, 0.125, 0).opacity).toBeCloseTo(0.5)
    expect(dotStateAt(table, 1.2, 0).opacity).toBe(1)
    expect(dotStateAt(table, 2.4 - 0.125, 0).opacity).toBeCloseTo(0.5)
  })
})

describe('moonlight pulses on the other traces', () => {
  const codex = HERO_STATIONS.find((s) => s.tool === 'codex')!
  const table = arcTable(traceFor(chipAnchor(codex)))

  it('runs moon → chip in 2.4s, then rests until the next 4.8s period', () => {
    expect(pulseStateAt(table, 0, 0)).toMatchObject({ x: 1060, y: 264, opacity: 0 })
    expect(pulseStateAt(table, 1.2, 0).opacity).toBe(1)
    expect(pulseStateAt(table, 2.4, 0).opacity).toBe(0)
    expect(pulseStateAt(table, 4.0, 0).opacity).toBe(0)
    expect(pulseStateAt(table, 4.8 + 1.2, 0)).toEqual(pulseStateAt(table, 1.2, 0))
  })

  it('departs one slot after another (0.6s apart), cascading across the traces', () => {
    expect(pulseStateAt(table, 0.6 + 1.2, 1)).toEqual(pulseStateAt(table, 1.2, 0))
    // Seven untracked traces fill 7 × 0.6 = 4.2s of the 4.8s period: at least two traces are always firing besides the gold one.
    const untracked = HERO_STATIONS.filter((s) => !s.tracked).length
    expect(untracked * TRACE_PULSE.stagger).toBeLessThan(TRACE_PULSE.period)
    for (let t = 0; t < TRACE_PULSE.period; t += 0.1) {
      const firing = Array.from({ length: untracked }, (_, slot) => pulseStateAt(table, t, slot).opacity > 0).filter(Boolean)
      expect(firing.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('narrow-screen pan', () => {
  it('goes left → right → left in 30s with ease-in-out', () => {
    expect(panAt(0, 690)).toBe(0)
    expect(panAt(7.5, 690)).toBeCloseTo(345)
    expect(panAt(15, 690)).toBeCloseTo(690)
    expect(panAt(22.5, 690)).toBeCloseTo(345)
    expect(panAt(30, 690)).toBeCloseTo(0)
    expect(panAt(1, 690)).toBeLessThan(690 / 15)
  })

  it('does not move when the world fits', () => {
    expect(panAt(10, 0)).toBe(0)
    expect(panAt(10, -20)).toBe(0)
  })
})
