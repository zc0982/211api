import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${params.mode}` : key) })
  }
})

import ThemeToggle from '../components/ThemeToggle.vue'

function mountToggle(preference: 'system' | 'light' | 'dark' = 'system', isDark = false) {
  return mount(ThemeToggle, { props: { preference, isDark }, attachTo: document.body })
}

describe('ThemeToggle', () => {
  it('labels the button with the current mode and starts closed', () => {
    const wrapper = mountToggle('light')
    const button = wrapper.get('.bh-theme__btn')
    expect(button.attributes('aria-label')).toBe('brandHome.theme.toggle:brandHome.theme.light')
    expect(button.attributes('aria-haspopup')).toBe('menu')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role="menu"]').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('opens on click, marks the current option and emits the choice', async () => {
    const wrapper = mountToggle('system')
    await wrapper.get('.bh-theme__btn').trigger('click')
    expect(wrapper.get('.bh-theme__btn').attributes('aria-expanded')).toBe('true')

    const items = wrapper.findAll('[role="menuitemradio"]')
    expect(items.map((item) => item.attributes('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(items[0].find('.bh-theme__check').exists()).toBe(true)

    await items[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['dark']])
    expect(wrapper.get('.bh-theme__btn').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('.bh-theme__btn').element)
    wrapper.unmount()
  })

  it('supports the keyboard: arrow keys move, Escape closes back to the button', async () => {
    const wrapper = mountToggle('light')
    const button = wrapper.get('.bh-theme__btn')
    await button.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('[role="menuitemradio"]')
    expect(document.activeElement).toBe(items[1].element)

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2].element)
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0].element)
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(items[2].element)

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })

  it('closes when clicking outside', async () => {
    const wrapper = mountToggle()
    await wrapper.get('.bh-theme__btn').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.bh-theme__btn').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})
