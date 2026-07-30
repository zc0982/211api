import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UserEditModal from '../UserEditModal.vue'

const { update, showSuccess, showError } = vi.hoisted(() => ({
  update: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    users: {
      update
    },
    userAttributes: {
      updateUserAttributeValues: vi.fn()
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showSuccess,
    showError
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

vi.mock('@/composables/useStepUp', () => ({
  useStepUp: () => ({
    run: (action: () => Promise<unknown>) => action()
  }),
  isStepUpBlocked: () => false,
  isStepUpCancelled: () => false,
  stepUpBlockReason: () => null
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const user = {
  id: 12,
  email: 'merchant@example.com',
  username: 'merchant',
  notes: '',
  role: 'user',
  concurrency: 5,
  rpm_limit: 0
} as any

const mountModal = () => mount(UserEditModal, {
  props: {
    show: true,
    user
  },
  global: {
    stubs: {
      BaseDialog: {
        props: ['show', 'title'],
        emits: ['close'],
        template: '<div v-if="show"><slot /><slot name="footer" /></div>'
      },
      UserAttributeForm: true,
      Icon: true,
      TotpStepUpDialog: true
    }
  }
})

describe('UserEditModal', () => {
  beforeEach(() => {
    update.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    update.mockResolvedValue({ ...user, concurrency: 0 })
  })

  it('allows zero concurrency and sends it to the update API', async () => {
    const wrapper = mountModal()

    const input = wrapper.get('[data-test="concurrency-input"]')
    expect(input.attributes('min')).toBe('0')

    await input.setValue('0')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(showError).not.toHaveBeenCalledWith('admin.users.concurrencyMin')
    expect(update).toHaveBeenCalledWith(12, expect.objectContaining({ concurrency: 0 }))
  })
})
