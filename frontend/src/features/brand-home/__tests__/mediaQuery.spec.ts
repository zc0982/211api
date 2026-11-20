import { describe, expect, it, vi } from 'vitest'
import { onMediaChange } from '../composables/mediaQuery'

type Cb = (event: { matches: boolean }) => void

describe('onMediaChange', () => {
  it('uses addEventListener / removeEventListener when the browser has them', () => {
    const listeners = new Set<Cb>()
    const query = {
      addEventListener: vi.fn((_: string, cb: Cb) => listeners.add(cb)),
      removeEventListener: vi.fn((_: string, cb: Cb) => listeners.delete(cb)),
      addListener: vi.fn(),
      removeListener: vi.fn()
    } as unknown as MediaQueryList
    const handler = vi.fn()
    const stop = onMediaChange(query, handler)
    listeners.forEach((cb) => cb({ matches: true }))
    expect(handler).toHaveBeenCalledWith({ matches: true })
    expect(query.addListener).not.toHaveBeenCalled()
    stop()
    expect(listeners.size).toBe(0)
  })

  it('falls back to addListener / removeListener on legacy Safari (≤ 13)', () => {
    const listeners = new Set<Cb>()
    const query = {
      matches: false,
      addListener: (cb: Cb) => listeners.add(cb),
      removeListener: (cb: Cb) => listeners.delete(cb)
    } as unknown as MediaQueryList
    const handler = vi.fn()
    const stop = onMediaChange(query, handler)
    expect(listeners.size).toBe(1)
    listeners.forEach((cb) => cb({ matches: true }))
    expect(handler).toHaveBeenCalledWith({ matches: true })
    stop()
    expect(listeners.size).toBe(0)
  })

  it('does nothing (and does not throw) when neither API exists', () => {
    const stop = onMediaChange({} as MediaQueryList, vi.fn())
    expect(() => stop()).not.toThrow()
  })
})
