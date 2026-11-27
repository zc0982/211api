import { describe, expect, it } from 'vitest'
import { CONSOLE_DESKTOP_MIN, CONSOLE_TABLET_MIN, resolveConsoleMainOffset, resolveConsoleViewport } from '../useConsoleViewport'

describe('resolveConsoleViewport', () => {
  it('maps widths to the three console shells (phone < 768 ≤ tablet < 1280 ≤ desktop)', () => {
    expect(CONSOLE_TABLET_MIN).toBe(768)
    expect(CONSOLE_DESKTOP_MIN).toBe(1280)
    expect(resolveConsoleViewport(360)).toBe('phone')
    expect(resolveConsoleViewport(767)).toBe('phone')
    expect(resolveConsoleViewport(768)).toBe('tablet')
    expect(resolveConsoleViewport(1279)).toBe('tablet')
    expect(resolveConsoleViewport(1280)).toBe('desktop')
    expect(resolveConsoleViewport(1440)).toBe('desktop')
  })
})

describe('resolveConsoleMainOffset', () => {
  it('follows the measured desktop sidebar width, including intermediate animation frames', () => {
    expect(resolveConsoleMainOffset({ viewport: 'desktop', collapsed: false, measured: 210.2 })).toBe(210.2)
    expect(resolveConsoleMainOffset({ viewport: 'desktop', collapsed: true, measured: 72 })).toBe(72)
  })

  it('falls back to 248 / 72 before the sidebar has been measured', () => {
    expect(resolveConsoleMainOffset({ viewport: 'desktop', collapsed: false, measured: null })).toBe(248)
    expect(resolveConsoleMainOffset({ viewport: 'desktop', collapsed: true, measured: null })).toBe(72)
  })

  it('keeps the tablet rail at 72 (the overlay floats above) and phones at 0', () => {
    expect(resolveConsoleMainOffset({ viewport: 'tablet', collapsed: false, measured: 304 })).toBe(72)
    expect(resolveConsoleMainOffset({ viewport: 'phone', collapsed: false, measured: 304 })).toBe(0)
  })
})
