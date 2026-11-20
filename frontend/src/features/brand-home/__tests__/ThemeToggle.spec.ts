import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import ThemeToggle from '../components/ThemeToggle.vue'

describe('ThemeToggle (v3 single button)', () => {
  it('in light shows the sun and offers dark', async () => {
    const wrapper = mount(ThemeToggle, { props: { isDark: false } })
    const button = wrapper.get('button.bh-theme')
    expect(button.attributes('aria-label')).toBe('brandHome.theme.toDark')
    expect(button.find('circle').exists()).toBe(true) // sun
    await button.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['dark']])
  })

  it('in dark shows the moon and offers light', async () => {
    const wrapper = mount(ThemeToggle, { props: { isDark: true } })
    const button = wrapper.get('button.bh-theme')
    expect(button.attributes('aria-label')).toBe('brandHome.theme.toLight')
    expect(button.find('circle').exists()).toBe(false) // moon
    await button.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['light']])
  })

  it('is a real button reachable by keyboard', () => {
    const wrapper = mount(ThemeToggle, { props: { isDark: false } })
    const button = wrapper.get('button.bh-theme')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('tabindex')).toBeUndefined()
  })
})
