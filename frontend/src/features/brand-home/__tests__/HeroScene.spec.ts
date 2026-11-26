import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { HERO_CHARACTERS, MOTION_LOOP } from '../config'
import { fitHeroLabels } from '../composables/heroLabels'
import { heroStateAt } from '../composables/motion'
import HeroScene from '../components/HeroScene.vue'

const time = ref(0)
const reducedMotion = ref(false)
vi.mock('../composables/useSceneClock', () => ({ useSceneClock: () => ({ time, reducedMotion }) }))
vi.mock('../composables/useSpriteSheets', async (original) => ({
  ...await original<typeof import('../composables/useSpriteSheets')>(),
  useSpriteSheets: () => ({ ready: ref(true) })
}))

const names = ['Claude Code', 'Codex', 'Hermes', 'OpenClaw', 'OpenCode', 'DSH', 'Cursor', 'Pi']

afterEach(() => {
  time.value = 0
  reducedMotion.value = false
})

describe('hero labels below the character', () => {
  it('puts all eight names in a single shared row on desktop, phone and in reduced motion', async () => {
    const wrapper = mount(HeroScene, { props: { switchLabel: '', creditLabel: '' } })
    const row = wrapper.get('.bh-hs__names')
    const orderedNames = ['Claude Code', 'Cursor', 'OpenCode', 'Codex', 'Pi', 'Hermes', 'DSH', 'OpenClaw']

    for (const width of [1440, 390, 320]) {
      await wrapper.setProps({ scale: width / 1440 })
      for (const reduced of [false, true]) {
        reducedMotion.value = reduced
        time.value = 4.2
        await nextTick()
        const labels = row.findAll('.bh-hs__label')
        expect(labels.map((label) => label.text())).toEqual(orderedNames)
        expect(labels.every((label) => label.element.parentElement === row.element)).toBe(true)
        expect(labels.every((label) => !label.attributes('style').includes('label-row'))).toBe(true)
      }
    }
    wrapper.unmount()
  })

  it('moves the original label through A, B and both walking directions, with one copy of each label', async () => {
    const wrapper = mount(HeroScene, { props: { switchLabel: 'switched', creditLabel: 'sample' } })
    const findLabel = (name: string) => wrapper.findAll('.bh-hs__label').filter((label) => label.text() === name)
    expect(wrapper.findAll('.bh-hs__label')).toHaveLength(8)
    expect(wrapper.findAll('.bh-hs__label--moving')).toHaveLength(8)
    expect(wrapper.findAll('.bh-hs__badge')).toHaveLength(8)
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

describe('fitting the hero name row', () => {
  const fit = (anchors: number[], widths: number[], right = 100) => fitHeroLabels(
    anchors.map((anchor, i) => ({ anchor, width: widths[i], fadeDistance: 10 })),
    4, { left: 0, right }, 4, 10
  )

  it('shares the space between close actors without moving an isolated name', () => {
    expect(fit([20, 25, 80], [20, 20, 20])).toEqual([4, 28, 70])
  })

  it('fits all fading text and releases its clearance continuously at either edge', () => {
    const left = (x: number) => fit([x, 15], [20, 20], 80)
    expect(left(-9.99)).toEqual([4, 28])
    expect(left(-10)[0]).toBeUndefined()
    expect(left(-10)[1]).toBe(28)
    expect(left(-10.01)[1]).toBeCloseTo(28, 3)
    expect(left(-15)[1]).toBe(16)
    expect(left(-20)[1]).toBe(5)

    const right = (x: number) => fit([65, x], [20, 20], 80)
    expect(right(89.99)).toEqual([32, 56])
    expect(right(90)[1]).toBeUndefined()
    expect(right(90)[0]).toBe(32)
    expect(right(90.01)[0]).toBeCloseTo(32, 3)
    expect(right(95)[0]).toBe(44)
    expect(right(100)[0]).toBe(55)
  })

  it('fits visible neighbours without a slot for either offscreen name', () => {
    const positions = fit([-73, -37, 2, 202], [67, 35, 55, 33], 390)
    expect(positions[0]).toBeUndefined()
    expect(positions[1]).toBeUndefined()
    expect(positions[2]).toBe(4)
    expect(positions[3]).toBe(185.5)
  })
})
