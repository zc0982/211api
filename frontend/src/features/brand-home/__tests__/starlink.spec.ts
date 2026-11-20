import { describe, expect, it } from 'vitest'
import { HERO_STATIONS, TRACE_ORIGIN } from '../config'
import { chipAnchor, pointOnTrace, propBox, stageLayout, traceFor, tracePath } from '../composables/starlink'
import { buildSamples, rootOf, sampleToText } from '../composables/codeSamples'

describe('hero「星链」geometry', () => {
  it('anchors each trace at the top centre of its status chip', () => {
    const claude = HERO_STATIONS.find((s) => s.tool === 'claudeCode')!
    expect(chipAnchor(claude)).toEqual({ x: 141, y: 696 })
  })

  it('builds the handoff Bézier: c1 = s + (dx·0.22, dy·0.42), c2 = e − (dx·0.18, dy·0.48)', () => {
    const t = traceFor({ x: 141, y: 696 })
    expect(t.start).toEqual(TRACE_ORIGIN)
    expect(t.c1.x).toBeCloseTo(1060 - 919 * 0.22)
    expect(t.c1.y).toBeCloseTo(264 + 432 * 0.42)
    expect(t.c2.x).toBeCloseTo(141 + 919 * 0.18)
    expect(t.c2.y).toBeCloseTo(696 - 432 * 0.48)
    // Same curve as Figma's Claude Code trace (vector 52:13379, relative to its box).
    expect(tracePath(t)).toBe('M 1060 264 C 857.82 445.44 306.42 488.64 141 696')
  })

  it('places the 429 marker at t = 0.5 of the Codex trace (Figma 52:13384 at 819, 486)', () => {
    const codex = HERO_STATIONS.find((s) => s.tool === 'codex')!
    const p = pointOnTrace(traceFor(chipAnchor(codex)), 0.5)
    expect(p.x).toBeCloseTo(819, 0)
    expect(p.y).toBeCloseTo(486, 0)
  })

  it('curve end points are exact', () => {
    const t = traceFor({ x: 500, y: 700 })
    expect(pointOnTrace(t, 0)).toEqual(TRACE_ORIGIN)
    expect(pointOnTrace(t, 1)).toEqual({ x: 500, y: 700 })
  })

  it('sits props on the ground at 1.5× pixel scale', () => {
    const prop = propBox({ propX: 116, propW: 33, propH: 36 })
    expect(prop).toEqual({ left: 116, top: 838 - 54, width: 49.5, height: 54 })
  })

  it('has exactly one tracked station (One Star Rule)', () => {
    expect(HERO_STATIONS.filter((s) => s.tracked).map((s) => s.tool)).toEqual(['claudeCode'])
  })
})

describe('stage layout (hero fills the first screen)', () => {
  const base = { worldWidth: 1440, designHeight: 900 }

  it('1440×900: the design as drawn', () => {
    expect(stageLayout({ ...base, stageWidth: 1440, stageHeight: 900, pan: false, fit: true })).toEqual({ scale: 1, worldHeight: 900, stageHeight: 640 })
  })

  it('wide and short / wide and tall: width sets the scale, the world height follows the screen', () => {
    const fhd = stageLayout({ ...base, stageWidth: 1920, stageHeight: 1080, pan: false, fit: true })
    expect(fhd.scale).toBeCloseTo(4 / 3)
    expect(fhd.worldHeight).toBeCloseTo(810)
    const laptop = stageLayout({ ...base, stageWidth: 1440, stageHeight: 780, pan: false, fit: true })
    expect(laptop.worldHeight).toBe(780)
  })

  it('never below the minimum world height; the stage asks for that much', () => {
    const short = stageLayout({ ...base, stageWidth: 1440, stageHeight: 500, pan: false, fit: true })
    expect(short.worldHeight).toBe(640)
    expect(short.stageHeight).toBe(640)
  })

  it('narrow: 0.75× when there is room, smaller (down to 0.34) when the space under the copy is short', () => {
    expect(stageLayout({ ...base, stageWidth: 768, stageHeight: 640, pan: true, fit: true }).scale).toBe(0.75)
    const phone = stageLayout({ ...base, stageWidth: 390, stageHeight: 442, pan: true, fit: true })
    expect(phone.scale).toBeCloseTo(442 / 760)
    expect(phone.worldHeight).toBeCloseTo(760)
    expect(stageLayout({ ...base, stageWidth: 360, stageHeight: 200, pan: true, fit: true }).scale).toBe(0.34)
  })

  it('without fit (footer): fixed design height, the stage follows the scale', () => {
    expect(stageLayout({ ...base, designHeight: 380, stageWidth: 720, stageHeight: 0, pan: false, fit: false })).toEqual({ scale: 0.5, worldHeight: 380, stageHeight: 190 })
    expect(stageLayout({ ...base, designHeight: 380, stageWidth: 390, stageHeight: 0, pan: true, fit: false }).scale).toBe(0.75)
  })
})

describe('quick-start samples', () => {
  const samples = buildSamples({
    baseUrl: 'https://gw.example.com/v1',
    model: 'claude-fable-5-2',
    codexModel: 'gpt-6.1-sol',
    apiKey: 'sk-YOUR_API_KEY',
    greeting: 'Hello'
  })
  const text = (client: string) => sampleToText(samples.find((s) => s.client === client)!)

  it('covers the six v3 clients in Figma order', () => {
    expect(samples.map((s) => s.client)).toEqual(['pythonOpenai', 'nodeOpenai', 'pythonAnthropic', 'curl', 'claudeCode', 'codex'])
  })

  it('highlights exactly one added line per sample', () => {
    for (const s of samples) expect(s.lines.filter((l) => l.mark === '+').length).toBe(1)
  })

  it('uses /v1 for OpenAI-style clients and the root for Anthropic-style ones', () => {
    expect(rootOf('https://gw.example.com/v1')).toBe('https://gw.example.com')
    expect(text('pythonOpenai')).toContain('base_url="https://gw.example.com/v1"')
    expect(text('curl')).toContain('curl https://gw.example.com/v1/chat/completions')
    expect(text('codex')).toContain('base_url = "https://gw.example.com/v1"')
    expect(text('pythonAnthropic')).toContain('base_url="https://gw.example.com"')
    expect(text('claudeCode')).toContain('ANTHROPIC_BASE_URL="https://gw.example.com"')
  })

  it('copies the code after the change: no struck-out official address', () => {
    for (const s of samples) {
      const copied = sampleToText(s)
      expect(copied).not.toContain('api.openai.com')
      expect(copied).not.toContain('api.anthropic.com')
      expect(copied).toContain('sk-YOUR_API_KEY')
    }
  })
})
