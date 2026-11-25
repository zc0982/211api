import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import GroupBadge from '@/components/common/GroupBadge.vue'
import SupportedModelChip from '../SupportedModelChip.vue'
vi.mock('vue-i18n', async () => ({ ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'), useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
describe('Shared channel components opt into Console', () => {
  it('keeps administrator group badge colors by default and preserves custom rate strike-through', () => {
    const common = { name: 'Exclusive', platform: 'anthropic' as const, subscriptionType: 'subscription' as const, rateMultiplier: 1.2, userRateMultiplier: .8, alwaysShowRate: true }
    const admin = mount(GroupBadge, { props: common, global: { plugins: [createPinia()] } })
    const user = mount(GroupBadge, { props: { ...common, console: true }, global: { plugins: [createPinia()] } })
    expect(admin.classes()).toContain('bg-orange-100')
    expect(admin.classes()).not.toContain('console-channel-group')
    expect(user.classes()).toContain('console-channel-group')
    expect(user.get('.line-through').text()).toBe('1.2x')
    expect(user.get('.is-custom .font-bold').text()).toBe('0.8x')
  })
  it('keeps the administrator model appearance and hover behavior by default', async () => {
    const wrapper = mount(SupportedModelChip, { props: { model: { name: 'gpt-test', platform: 'openai', pricing: null } }, global: { stubs: { Teleport: true } } })
    const trigger = wrapper.get('[tabindex]')
    expect(trigger.classes()).toContain('bg-green-500/10')
    expect(trigger.attributes('role')).toBeUndefined()
    await trigger.trigger('mouseenter')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
    await trigger.trigger('mouseleave')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
  })
  it('pins a Console price popover on tap/click, closes with Escape/outside, and clamps to a narrow viewport', async () => {
    vi.stubGlobal('innerWidth', 390)
    vi.stubGlobal('innerHeight', 844)
    const wrapper = mount(SupportedModelChip, { attachTo: document.body, props: { console: true, model: { name: 'gpt-test', platform: 'openai', pricing: null }, noPricingLabel: 'No price' } })
    const trigger = wrapper.get('[role="button"]')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({ left: 320, width: 60, top: 800, bottom: 830, right: 380, height: 30, x: 320, y: 800, toJSON: () => ({}) })
    const popover = document.body.querySelector('.console-channel-price') as HTMLElement
    Object.defineProperties(popover, { offsetWidth: { value: 320 }, offsetHeight: { value: 240 } })
    await trigger.trigger('click')
    await trigger.trigger('mouseleave')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(popover.textContent).toContain('No price')
    expect(parseInt(popover.style.left)).toBe(62)
    expect(parseInt(popover.style.top)).toBe(552)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    vi.unstubAllGlobals()
  })
})
