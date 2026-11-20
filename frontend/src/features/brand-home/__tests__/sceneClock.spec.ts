import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'

/** Manual rAF + IntersectionObserver + matchMedia so the clock can be stepped. */
let frames: Map<number, FrameRequestCallback>
let nextId: number
let now: number
let observers: { cb: IntersectionObserverCallback }[]
let motionListeners: ((e: { matches: boolean }) => void)[]
let reduce: boolean

function step(ms = 1000 / 60) {
  now += ms
  const q = [...frames.values()]
  frames.clear()
  q.forEach((cb) => cb(now))
}
function intersect(on: boolean) {
  observers.forEach((o) => o.cb([{ isIntersecting: on } as IntersectionObserverEntry], {} as IntersectionObserver))
}

beforeEach(() => {
  vi.resetModules()
  frames = new Map()
  nextId = 0
  now = 1000
  observers = []
  motionListeners = []
  reduce = false
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++nextId, cb)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observers.push({ cb })
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce') ? reduce : false,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => motionListeners.push(fn),
    removeEventListener() {}
  }))
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountClock(enabled: Ref<boolean> = ref(true)) {
  const { useSceneClock } = await import('../composables/useSceneClock')
  let time!: Ref<number>
  const Comp = defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null)
      time = useSceneClock(el, enabled).time
      return () => h('div', { ref: el })
    }
  })
  const wrapper = mount(Comp)
  return { wrapper, time: () => time.value }
}

describe('shared scene clock', () => {
  it('advances only while on screen', async () => {
    const { time } = await mountClock()
    expect(frames.size).toBe(0)
    intersect(true)
    step()
    for (let i = 0; i < 60; i++) step()
    expect(time()).toBeCloseTo(1, 1)
    intersect(false)
    expect(frames.size).toBe(0)
    const paused = time()
    step(500)
    expect(time()).toBe(paused)
  })

  it('does not jump after a pause, and clamps long frames to 0.1s', async () => {
    const { time } = await mountClock()
    intersect(true)
    step()
    step(5000)
    expect(time()).toBeCloseTo(0.1)
  })

  it('stops while disabled (e.g. sprite atlas not loaded yet)', async () => {
    const enabled = ref(false)
    const { time } = await mountClock(enabled)
    intersect(true)
    expect(frames.size).toBe(0)
    enabled.value = true
    await nextTick()
    step()
    step()
    expect(time()).toBeGreaterThan(0)
  })

  it('pauses in a hidden tab', async () => {
    const { time } = await mountClock()
    intersect(true)
    step()
    step()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    const t = time()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    step(10_000)
    expect(time()).toBe(t)
  })

  it('never runs under prefers-reduced-motion, and stops when it is switched on', async () => {
    reduce = true
    const first = await mountClock()
    intersect(true)
    expect(frames.size).toBe(0)
    expect(first.time()).toBe(0)
    first.wrapper.unmount()

    vi.resetModules()
    reduce = false
    motionListeners = []
    await mountClock()
    intersect(true)
    step()
    step()
    motionListeners.forEach((fn) => fn({ matches: true }))
    expect(frames.size).toBe(0)
  })

  it('in-page pause freezes every subscriber where it is, and play resumes from there', async () => {
    const { time } = await mountClock()
    const { setMotionPaused, motionPaused } = await import('../composables/useSceneClock')
    intersect(true)
    step()
    for (let i = 0; i < 30; i++) step()
    const at = time()
    setMotionPaused(true)
    expect(motionPaused.value).toBe(true)
    expect(frames.size).toBe(0)
    step(5000)
    expect(time()).toBe(at)
    expect(localStorage.getItem('bh-motion')).toBe('paused')
    setMotionPaused(false)
    expect(localStorage.getItem('bh-motion')).toBeNull()
    step()
    step()
    expect(time()).toBeGreaterThan(at)
    expect(time() - at).toBeLessThan(0.05)
  })

  it('remembers a pause from an earlier visit', async () => {
    localStorage.setItem('bh-motion', 'paused')
    const { time } = await mountClock()
    intersect(true)
    expect(frames.size).toBe(0)
    expect(time()).toBe(0)
    localStorage.removeItem('bh-motion')
  })

  it('follows a reduced-motion change on legacy Safari that only has addListener', async () => {
    const legacy: ((e: { matches: boolean }) => void)[] = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      addListener: (fn: (e: { matches: boolean }) => void) => legacy.push(fn),
      removeListener() {}
    }))
    const { useSceneClock, reducedMotion } = await import('../composables/useSceneClock')
    const Comp = defineComponent({
      setup() {
        const el = ref<HTMLElement | null>(null)
        useSceneClock(el)
        return () => h('div', { ref: el })
      }
    })
    mount(Comp)
    intersect(true)
    expect(frames.size).toBe(1)
    expect(legacy).toHaveLength(1)
    legacy[0]({ matches: true })
    expect(reducedMotion.value).toBe(true)
    expect(frames.size).toBe(0)
  })

  it('stops the loop when the last subscriber unmounts', async () => {
    const { wrapper } = await mountClock()
    intersect(true)
    expect(frames.size).toBe(1)
    wrapper.unmount()
    expect(frames.size).toBe(0)
  })
})
