import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { ArmillaryCallbacks, ArmillaryOptions } from '../armillary/scene'

const { createArmillary, controller, state } = vi.hoisted(() => {
  const state: { callbacks: ArmillaryCallbacks | null; options: ArmillaryOptions | null } = {
    callbacks: null,
    options: null
  }
  const controller = {
    setTracked: vi.fn(),
    holdAutoTrack: vi.fn(),
    setRunning: vi.fn(),
    dispose: vi.fn(),
    info: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, frames: 0 })),
    freeze: vi.fn()
  }
  const createArmillary = vi.fn((opts: ArmillaryOptions) => {
    state.callbacks = opts.callbacks
    state.options = opts
    return controller
  })
  return { createArmillary, controller, state }
})

vi.mock('../armillary/scene', () => ({ __esModule: true, createArmillary, CANVAS_OVERHANG: 0.1 }))

import ArmillaryHero from '../components/ArmillaryHero.vue'

const realWebGL = (window as { WebGLRenderingContext?: unknown }).WebGLRenderingContext
const realCores = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency')

function setWebGL(available: boolean) {
  if (available) (window as { WebGLRenderingContext?: unknown }).WebGLRenderingContext = function WebGLRenderingContext() {}
  else delete (window as { WebGLRenderingContext?: unknown }).WebGLRenderingContext
}

const realMatchMedia = window.matchMedia
/** The shared setup answers every media query with true; answer reduce-motion with false here. */
function setMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })) as unknown as typeof window.matchMedia
}

function setCores(n: number) {
  Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => n })
}

async function mountHero(props: Record<string, unknown> = {}) {
  const wrapper = mount(ArmillaryHero, {
    props: { alt: 'armillary', ...props },
    slots: { chip: '<span data-testid="chip" />', card: '<span data-testid="card" />' },
    attachTo: document.body
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('ArmillaryHero', () => {
  beforeEach(() => {
    createArmillary.mockClear()
    Object.values(controller).forEach((fn) => fn.mockClear())
    state.callbacks = null
    setCores(8)
    setMedia(false)
  })

  afterEach(() => {
    setWebGL(Boolean(realWebGL))
    if (realWebGL) (window as { WebGLRenderingContext?: unknown }).WebGLRenderingContext = realWebGL
    if (realCores) Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', realCores)
    delete (navigator as { hardwareConcurrency?: number }).hardwareConcurrency
    window.matchMedia = realMatchMedia
    document.body.innerHTML = ''
  })

  it('keeps the static render and never loads three.js when WebGL is unavailable', async () => {
    setWebGL(false)
    const wrapper = await mountHero()
    const root = wrapper.find('[data-armillary-mount]')
    expect(root.attributes('data-armillary-mode')).toBe('static')
    expect(root.attributes('data-armillary-reason')).toBe('no-webgl')
    expect(wrapper.find('img.bh-armillary__img').classes()).not.toContain('is-hidden')
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.findAll('button.bh-bead')).toHaveLength(0)
    expect(wrapper.findAll('span.bh-bead')).toHaveLength(4)
    expect(createArmillary).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stays static under prefers-reduced-motion', async () => {
    setWebGL(true)
    const wrapper = await mountHero({ reducedMotion: true })
    expect(wrapper.find('[data-armillary-mount]').attributes('data-armillary-reason')).toBe('reduced-motion')
    expect(createArmillary).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stays static on low-end devices', async () => {
    setWebGL(true)
    setCores(4)
    const wrapper = await mountHero()
    expect(wrapper.find('[data-armillary-mount]').attributes('data-armillary-reason')).toBe('low-cores')
    expect(createArmillary).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('falls back to static when the WebGL context cannot be created', async () => {
    setWebGL(true)
    createArmillary.mockImplementationOnce(() => {
      throw new Error('Error creating WebGL context.')
    })
    const wrapper = await mountHero()
    await flushPromises()
    expect(wrapper.find('[data-armillary-mount]').attributes('data-armillary-mode')).toBe('static')
    expect(wrapper.find('[data-armillary-mount]').attributes('data-armillary-reason')).toBe('context-failed')
    expect(wrapper.find('canvas').exists()).toBe(false)
    wrapper.unmount()
  })

  it('goes live: fades the static render after the first frame and turns beads into buttons', async () => {
    setWebGL(true)
    const wrapper = await mountHero()
    expect(createArmillary).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-armillary-mount]').attributes('data-armillary-mode')).toBe('live')
    expect(wrapper.find('canvas').attributes('aria-hidden')).toBe('true')
    // Static render still visible until the first frame is drawn.
    expect(wrapper.find('img.bh-armillary__img').classes()).not.toContain('is-hidden')
    // …and the beads keep their Figma positions until the scene places them.
    expect(wrapper.find('button.bh-bead').attributes('style')).toContain('left: 29.84%')
    expect(wrapper.find('[data-armillary-mount]').classes()).not.toContain('is-drawn')
    state.callbacks!.onFirstFrame()
    await flushPromises()
    expect(wrapper.find('img.bh-armillary__img').classes()).toContain('is-hidden')
    expect(wrapper.find('[data-armillary-mount]').classes()).toContain('is-drawn')
    expect(wrapper.find('button.bh-bead').attributes('style') ?? '').not.toContain('left:')

    const beads = wrapper.findAll('button.bh-bead')
    expect(beads).toHaveLength(4)
    expect(beads.map((b) => b.attributes('aria-label'))).toEqual(['Claude', 'OpenAI', 'Gemini', 'Grok'])
    expect(beads[0].attributes('aria-pressed')).toBe('true')
    expect(controller.setRunning).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })

  it('switches vendors from a bead and pauses auto-rotation', async () => {
    setWebGL(true)
    const wrapper = await mountHero()
    await wrapper.findAll('button.bh-bead')[2].trigger('focus')
    expect(controller.holdAutoTrack).toHaveBeenCalledWith(12000)
    expect(wrapper.emitted('vendor-change')?.[0]).toEqual(['gemini'])
    await wrapper.setProps({ activeVendor: 'gemini' })
    expect(controller.setTracked).toHaveBeenCalledWith('gemini')
    wrapper.unmount()
  })

  it('re-emits auto-rotation from the scene', async () => {
    setWebGL(true)
    const wrapper = await mountHero()
    state.callbacks!.onAutoTrack('openai')
    expect(wrapper.emitted('vendor-change')?.[0]).toEqual(['openai'])
    wrapper.unmount()
  })

  it('restores the static render on a runtime fallback (context lost) and resets tracking', async () => {
    setWebGL(true)
    const wrapper = await mountHero({ activeVendor: 'grok' })
    state.callbacks!.onFirstFrame()
    state.callbacks!.onFallback('context-lost')
    await flushPromises()
    const root = wrapper.find('[data-armillary-mount]')
    expect(root.attributes('data-armillary-mode')).toBe('static')
    expect(root.attributes('data-armillary-reason')).toBe('context-lost')
    expect(wrapper.find('img.bh-armillary__img').classes()).not.toContain('is-hidden')
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.emitted('vendor-change')?.at(-1)).toEqual(['claude'])
    wrapper.unmount()
  })

  it('pauses when the tab is hidden and disposes on unmount', async () => {
    setWebGL(true)
    const wrapper = await mountHero()
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(controller.setRunning).toHaveBeenLastCalledWith(false)
    delete (document as { hidden?: boolean }).hidden
    if (hidden) Object.defineProperty(Document.prototype, 'hidden', hidden)
    wrapper.unmount()
    expect(controller.dispose).toHaveBeenCalled()
  })
})
