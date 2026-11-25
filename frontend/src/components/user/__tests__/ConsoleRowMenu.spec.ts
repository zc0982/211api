import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import ConsoleRowMenu from '../ConsoleRowMenu.vue'

let wrapper: VueWrapper | null = null

const mountMenu = () => {
  wrapper = mount(ConsoleRowMenu, {
    attachTo: document.body,
    props: { label: 'More actions: demo' },
    slots: {
      default: `
        <button type="button" role="menuitem" aria-label="Import">Import</button>
        <button type="button" role="menuitem" aria-label="Disable">Disable</button>
        <button type="button" role="menuitem" aria-label="Delete" data-test="delete">Delete</button>
      `,
    },
    global: { stubs: { Icon: true } },
  })
  return wrapper
}

const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]')
const items = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ConsoleRowMenu', () => {
  it('opens a body-level menu, focuses the first item and moves with arrow keys', async () => {
    const view = mountMenu()
    const trigger = view.get('button')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(menu()).toBeNull()

    await trigger.trigger('click')
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(menu()?.parentElement).toBe(document.body)
    expect(trigger.attributes('aria-controls')).toBe(menu()?.id)
    expect(document.activeElement).toBe(items()[0])

    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(items()[1])
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(items()[2])
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const view = mountMenu()
    const trigger = view.get('button')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(menu()).not.toBeNull()

    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('closes after choosing an item and on outside pointer down', async () => {
    const view = mountMenu()
    await view.get('button').trigger('click')
    await nextTick()
    items()[2].click()
    await nextTick()
    expect(menu()).toBeNull()

    await view.get('button').trigger('click')
    await nextTick()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(menu()).toBeNull()
  })
})
