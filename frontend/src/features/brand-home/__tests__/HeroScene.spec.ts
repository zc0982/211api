import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { HERO_CHARACTERS, MOTION_LOOP } from '../config'
import { heroStateAt } from '../composables/motion'
import HeroScene from '../components/HeroScene.vue'

const time = ref(0)
const reducedMotion = ref(false)
vi.mock('../composables/useSceneClock', () => ({ useSceneClock: () => ({ time, reducedMotion }) }))
vi.mock('../composables/useSpriteSheets', async (original) => ({
  ...await original<typeof import('../composables/useSpriteSheets')>(),
  useSpriteSheets: () => ({ ready: ref(true) })
}))

const names = ['Claude Code', 'Codex', 'Hermes', 'OpenClaw', 'OpenCode', 'DeepSeek Harness']

afterEach(() => {
  time.value = 0
  reducedMotion.value = false
})

describe('hero labels below the character', () => {
  it('moves the original label through A, B and both walking directions, with one copy of each label', async () => {
    const wrapper = mount(HeroScene, { props: { switchLabel: 'switched', creditLabel: 'sample' } })
    const findLabel = (name: string) => wrapper.findAll('.bh-hs__label').filter((label) => label.text() === name)
    expect(wrapper.findAll('.bh-hs__label')).toHaveLength(8)
    expect(wrapper.findAll('.bh-hs__label--moving')).toHaveLength(6)
    expect(wrapper.findAll('.bh-hs__badge')).toHaveLength(6)
    expect(wrapper.find('.bh-hs__name').exists()).toBe(false)

    for (const [index, c] of HERO_CHARACTERS.entries()) {
      const labels = findLabel(names[index])
      expect(labels).toHaveLength(1)
      const label = labels[0].element as HTMLElement
      const [a, ab, b, ba] = c.beats
      for (const local of [a / 2, a + ab / 2, a + ab + b / 2, a + ab + b + ba / 2]) {
        time.value = (local - c.offset + MOTION_LOOP) % MOTION_LOOP
        await nextTick()
        expect(parseFloat(label.style.getPropertyValue('--actor-x'))).toBeCloseTo(heroStateAt(c, time.value).x)
      }
    }
    for (const station of ['Cursor', 'Pi']) {
      const [label] = findLabel(station)
      expect(label.classes()).not.toContain('bh-hs__label--moving')
      expect((label.element as HTMLElement).style.left).toMatch(/px$/)
    }
    reducedMotion.value = true
    await nextTick()
    for (const [index, c] of HERO_CHARACTERS.entries()) {
      const [label] = findLabel(names[index])
      expect((label.element as HTMLElement).style.getPropertyValue('--actor-x')).toBe(`${c.x}px`)
    }
    wrapper.unmount()
  })

  it('fades the moving label as its character leaves the viewport', async () => {
    reducedMotion.value = true
    const wrapper = mount(HeroScene, {
      props: { switchLabel: '', creditLabel: '', viewport: { left: 89, right: 800 } }
    })
    const claude = wrapper.get('.bh-hs__label--moving').element as HTMLElement
    expect(claude.style.opacity).toBe('1')
    await wrapper.setProps({ viewport: { left: 110, right: 800 } })
    expect(Number(claude.style.opacity)).toBeGreaterThan(0)
    expect(Number(claude.style.opacity)).toBeLessThan(1)
    await wrapper.setProps({ viewport: { left: 124, right: 800 } })
    expect(claude.style.opacity).toBe('0')
    wrapper.unmount()
  })

  it('opens space for readable phone labels while keeping the tracked chip and line together', async () => {
    const wrapper = mount(HeroScene, { props: { switchLabel: 'switched', creditLabel: 'sample' } })
    const scene = wrapper.get('.bh-hs')
    const ground = wrapper.get('.bh-hs__ground')
    const trackedTrace = wrapper.get('.bh-hs__traces .is-tracked')
    const traceY = () => Number(trackedTrace.attributes('d').split(' ').at(-1))
    const desktopY = traceY()
    expect(scene.classes()).not.toContain('bh-hs--phone-labels')

    for (const scale of [390 / 1440, 0.6]) {
      await wrapper.setProps({ scale, viewport: { left: 0, right: 390 / scale } })
      expect(scene.classes()).toContain('bh-hs--phone-labels')
      expect(parseFloat((scene.element as HTMLElement).style.getPropertyValue('--caption-screen-px')) * scale).toBeCloseTo(1)
      const groundShift = Number(ground.attributes('style').match(/translateY\(([-.\d]+)px\)/)?.[1])
      expect(groundShift).toBeLessThan(0)
      expect(traceY()).toBeCloseTo(desktopY + groundShift)
    }
    wrapper.unmount()
  })
})
