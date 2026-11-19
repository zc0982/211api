import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { REVEAL_ROOT_MARGIN, vReveal } from '../composables/vReveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

const instances: { callback: Callback; options?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = []

class FakeIntersectionObserver {
  disconnect = vi.fn()
  constructor(callback: Callback, options?: IntersectionObserverInit) {
    instances.push({ callback, options, disconnect: this.disconnect })
  }
  observe() {}
  unobserve() {}
}

const Section = defineComponent({
  directives: { reveal: vReveal },
  template: '<section v-reveal><h2 data-reveal>title</h2></section>'
})

function mountAt(top: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  return mount(Section, { attachTo: document.body })
}

describe('vReveal', () => {
  const original = globalThis.IntersectionObserver

  afterEach(() => {
    globalThis.IntersectionObserver = original
    instances.length = 0
    vi.restoreAllMocks()
  })

  it('leaves sections that are on screen at mount untouched', () => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const wrapper = mountAt(100)
    expect(wrapper.classes()).not.toContain('bh-reveal')
    expect(instances).toHaveLength(0)
    wrapper.unmount()
  })

  it('hides below-the-fold sections until they scroll into view, then reveals once', () => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const wrapper = mountAt(window.innerHeight + 400)
    expect(wrapper.classes()).toContain('bh-reveal')
    expect(wrapper.classes()).not.toContain('is-revealed')
    expect(instances[0].options?.rootMargin).toBe(REVEAL_ROOT_MARGIN)

    instances[0].callback([{ isIntersecting: false }])
    expect(wrapper.classes()).not.toContain('is-revealed')

    instances[0].callback([{ isIntersecting: true }])
    expect(wrapper.classes()).toContain('is-revealed')
    expect(instances[0].disconnect).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('never hides content when IntersectionObserver is unavailable', () => {
    // @ts-expect-error simulate a browser without IntersectionObserver
    globalThis.IntersectionObserver = undefined
    const wrapper = mountAt(window.innerHeight + 400)
    expect(wrapper.classes()).not.toContain('bh-reveal')
    wrapper.unmount()
  })

  it('disconnects the observer on unmount', () => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver
    const wrapper = mountAt(window.innerHeight + 400)
    wrapper.unmount()
    expect(instances[0].disconnect).toHaveBeenCalled()
  })
})
