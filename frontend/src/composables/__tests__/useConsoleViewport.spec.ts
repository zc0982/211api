import { describe, expect, it } from 'vitest'
import { CONSOLE_DESKTOP_MIN, CONSOLE_TABLET_MIN, resolveConsoleViewport } from '../useConsoleViewport'

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
