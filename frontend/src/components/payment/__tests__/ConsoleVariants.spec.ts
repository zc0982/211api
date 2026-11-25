import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import AmountInput from '../AmountInput.vue'
import PaymentMethodSelector from '../PaymentMethodSelector.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown> | string) =>
      params && typeof params === 'object' && 'amount' in params ? `${key} ${String(params.amount)}` : typeof params === 'string' ? params : key,
  }),
}))
enableAutoUnmount(afterEach)

describe('AmountInput console variant', () => {
  it('is off by default and keeps the legacy markup', () => {
    const wrapper = mount(AmountInput, { props: { modelValue: null, amounts: [50] } })
    expect(wrapper.find('.console-amounts').exists()).toBe(false)
    expect(wrapper.findAll('input')).toHaveLength(1)
  })

  it('renders tiles with symbol, credited line, selection state and a custom tile', async () => {
    const wrapper = mount(AmountInput, { props: { modelValue: 100, amounts: [50, 100], console: true, currency: 'CNY' } })
    const tiles = wrapper.findAll('[data-testid^="quick-amount-"][aria-pressed]')
    expect(tiles).toHaveLength(2)
    expect(tiles[1].classes()).toContain('is-selected')
    expect(tiles[1].attributes('aria-pressed')).toBe('true')
    expect(tiles[0].text()).toContain('¥50')
    expect(tiles[0].get('[data-testid="quick-amount-credited"]').text()).toContain('$50.00')
    await tiles[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[50]])
  })

  it('selects the custom tile only for amounts outside the quick list and accepts typing', async () => {
    const wrapper = mount(AmountInput, { props: { modelValue: 75, amounts: [50, 100], console: true } })
    expect(wrapper.get('.console-amount--custom').classes()).toContain('is-selected')
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('75')
    await input.setValue('12.5')
    expect(wrapper.emitted('update:modelValue')).toEqual([[12.5]])
  })

  it('shows bonus tags as text (no red badge) on tiers', () => {
    const wrapper = mount(AmountInput, {
      props: { modelValue: null, amounts: [100], console: true, bonusTiers: [{ min_amount: 100, bonus_percent: 20 }] },
    })
    const tile = wrapper.get('[data-testid="quick-amount-100"]')
    expect(tile.get('[data-testid="quick-amount-bonus-badge"]').text()).toBe('+20%')
    expect(tile.html()).not.toContain('bg-red')
  })
})

describe('PaymentMethodSelector console variant', () => {
  const methods = [
    { type: 'alipay', fee_rate: 0, available: true },
    { type: 'stripe', fee_rate: 3, available: false },
  ]
  it('is off by default', () => {
    const wrapper = mount(PaymentMethodSelector, { props: { methods, selected: 'alipay' } })
    expect(wrapper.find('.console-methods').exists()).toBe(false)
  })

  it('renders a radiogroup, marks the selection and skips disabled methods', async () => {
    const wrapper = mount(PaymentMethodSelector, { props: { methods, selected: 'alipay', console: true } })
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(radios[1].attributes('disabled')).toBeDefined()
    expect(radios[1].text()).toContain('3%')
    await radios[1].trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    await radios[0].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['alipay']])
  })
})
