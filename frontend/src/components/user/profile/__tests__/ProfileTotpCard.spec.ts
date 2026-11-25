import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileTotpCard from '../ProfileTotpCard.vue'
import type { TotpStatus } from '@/types'

const { getStatus } = vi.hoisted(() => ({ getStatus: vi.fn() }))
vi.mock('@/api', () => ({ totpAPI: { getStatus } }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)

const render = () => mount(ProfileTotpCard, {
  global: { stubs: { TotpSetupModal: true, TotpDisableDialog: true } },
})
const status = (enabled: boolean, feature_enabled = true): TotpStatus => ({ enabled, feature_enabled })

beforeEach(() => vi.resetAllMocks())

describe('ProfileTotpCard status recovery', () => {
  it('does not infer an authentication state while the first request is loading', async () => {
    getStatus.mockReturnValue(new Promise(() => {}))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[aria-busy="true"]').text()).toBe('common.loading')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('profile.totp.notEnabled')
  })

  it('shows an accessible failure and retry instead of a fabricated disabled state', async () => {
    getStatus.mockRejectedValue({ status: 503 })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('profile.totp.loadFailed')
    expect(wrapper.get('button').attributes('type')).toBe('button')
    expect(wrapper.get('button').text()).toBe('profile.totp.retry')
    expect(wrapper.text()).not.toContain('profile.totp.notEnabled')
    expect(wrapper.findComponent({ name: 'TotpSetupModal' }).exists()).toBe(false)
  })

  it.each([
    [true, true, 'profile.totp.enabled', 'profile.totp.disable'],
    [false, true, 'profile.totp.notEnabled', 'profile.totp.enable'],
    [false, false, 'profile.totp.featureDisabled', null],
  ] as const)('retries once and renders the returned enabled=%s / available=%s state', async (enabled, available, text, action) => {
    let resolve!: (value: TotpStatus) => void
    getStatus.mockRejectedValueOnce({ status: 503 }).mockImplementationOnce(() => new Promise<TotpStatus>(done => { resolve = done }))
    const wrapper = render()
    await flushPromises()
    const retry = wrapper.get('button')
    // Two events in the same tick must still send only one retry request.
    const first = retry.trigger('click')
    const second = retry.trigger('click')
    await Promise.all([first, second])
    expect(getStatus).toHaveBeenCalledTimes(2)
    expect(getStatus).toHaveBeenLastCalledWith()
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[aria-busy="true"]').text()).toBe('common.loading')
    resolve(status(enabled, available))
    await flushPromises()
    expect(wrapper.text()).toContain(text)
    expect(wrapper.find('[aria-busy]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    if (action) expect(wrapper.get('button').text()).toBe(action)
    else expect(wrapper.find('button').exists()).toBe(false)
  })

  it('keeps retry available after another failed request', async () => {
    getStatus.mockRejectedValue({ status: 503 })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(getStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="alert"]').text()).toBe('profile.totp.loadFailed')
    expect(wrapper.get('button').text()).toBe('profile.totp.retry')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it.each([
    [false, 'TotpSetupModal'],
    [true, 'TotpDisableDialog'],
  ] as const)('preserves the %s modal flow and hides stale state if its refresh fails', async (enabled, modalName) => {
    getStatus.mockResolvedValueOnce(status(enabled)).mockRejectedValueOnce({ status: 503 })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    const modal = wrapper.getComponent({ name: modalName })
    modal.vm.$emit('success')
    await flushPromises()
    expect(getStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent({ name: modalName }).exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toBe('profile.totp.loadFailed')
    expect(wrapper.get('button').text()).toBe('profile.totp.retry')
  })
})
