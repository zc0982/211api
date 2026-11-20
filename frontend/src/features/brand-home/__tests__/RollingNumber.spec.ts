import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RollingNumber from '../components/RollingNumber.vue'

/** Digit shown by each cell: strip offset / row height (10 = blank). */
const shown = (value: number, digits: number) => {
  const w = mount(RollingNumber, { props: { value, digits } })
  return w.findAll('.bh-roll__strip').map((s) => Math.round(-parseFloat(/translateY\((-?[\d.]+)px\)/.exec(s.attributes('style')!)![1]) / 14) || 0)
}

describe('RollingNumber', () => {
  it('keeps one fixed cell per target digit and blanks leading places', () => {
    expect(shown(34, 3)).toEqual([10, 3, 4])
    expect(shown(112, 3)).toEqual([1, 1, 2])
    expect(shown(7, 2)).toEqual([10, 7])
    expect(shown(0, 2)).toEqual([10, 0])
  })

  it('moves digits with transforms only and exposes the value to assistive tech', () => {
    const w = mount(RollingNumber, { props: { value: 64, digits: 2 } })
    expect(w.attributes('aria-label')).toBe('64')
    expect(w.findAll('.bh-roll__cell')).toHaveLength(2)
    for (const s of w.findAll('.bh-roll__strip')) expect(s.attributes('style')).toMatch(/^transform: translateY/)
  })
})
