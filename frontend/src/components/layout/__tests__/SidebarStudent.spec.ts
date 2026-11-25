import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => `${key}:${params?.name ?? ''}@${params?.tool ?? ''}`
  })
}))

import SidebarStudent from '../SidebarStudent.vue'
import { SPRITE_SHEETS } from '@/features/brand-home/sprites.generated'
import { HERO_CHARACTERS } from '@/features/brand-home/config'
import {
  STUDENTS,
  SIDEBAR_STUDENTS,
  studentStation,
  STUDENT_STORAGE_KEY,
  STUDENT_TIMELINE,
  advanceStudent,
  ensureStudent,
  nextStudent,
  pickStudent,
  resetStudentForTest
} from '../sidebarStudent'

/** prefers-reduced-motion 的开关；setup.ts 的默认 matchMedia 对任何查询都返回 true，这里覆盖。 */
let reduced = false
const decodeCalls: string[] = []

class FakeImage {
  decoding = ''
  src = ''
  decode() {
    decodeCalls.push(this.src)
    return Promise.resolve()
  }
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function mountStudent(props: { active?: boolean } = {}) {
  const wrapper = mount(SidebarStudent, { props })
  // 静图 / 道具是动态导入（真实异步），等按钮出来
  await vi.waitFor(() => expect(wrapper.find('button.sidebar-student').exists()).toBe(true))
  await flushPromises()
  return wrapper
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 当前图集里的格位（transform），时钟走一步就会变。 */
const cell = (w: ReturnType<typeof mount>) => w.find('.bh-actor img').attributes('style') ?? ''

beforeEach(() => {
  reduced = false
  decodeCalls.length = 0
  sessionStorage.clear()
  resetStudentForTest()
  setHidden(false)
  vi.stubGlobal('Image', FakeImage)
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sidebar student roster', () => {
  it('rotates eight students: the six home-page students, then Cursor and Pi', () => {
    expect(STUDENTS).toEqual(['claude', 'gpt', 'gemini', 'grok', 'opencode', 'dsh', 'cursor', 'pi'])
    expect(STUDENTS.slice(0, 6)).toEqual(HERO_CHARACTERS.map((c) => c.id))
  })

  it('gives Cursor and Pi their own desks, tool badges and a hero atlas the home page never loads', () => {
    expect(studentStation('cursor').prop).toBe('cursor')
    expect(studentStation('pi').prop).toBe('pi')
    expect(SIDEBAR_STUDENTS.find((s) => s.id === 'cursor')?.badge).toEqual({ tool: 'cursor' })
    expect(SIDEBAR_STUDENTS.find((s) => s.id === 'pi')?.badge).toEqual({ tool: 'pi' })
    const hero = SPRITE_SHEETS.hero
    for (const id of ['cursor', 'pi'] as const) expect(hero.home as readonly number[]).not.toContain(hero.rows[id][0])
    for (const c of HERO_CHARACTERS) expect(hero.home as readonly number[]).toContain(hero.rows[c.id][0])
    // 首页场景（首屏 6 位）仍按原来的 6 位走位
    expect(HERO_CHARACTERS.map((c) => c.id)).toEqual(['claude', 'gpt', 'gemini', 'grok', 'opencode', 'dsh'])
  })
})

describe('sidebar student picking', () => {
  it('never draws the same student twice in a row', () => {
    for (const last of STUDENTS) {
      for (let r = 0; r < 1; r += 0.05) {
        const id = pickStudent(last, () => r)
        expect(id).not.toBe(last)
        expect(STUDENTS).toContain(id)
      }
    }
    // 每一位都可能抽到（排除上一次之后的 7 位里均匀取）
    const seen = new Set(Array.from({ length: 28 }, (_, i) => pickStudent('claude', () => i / 28)))
    expect([...seen].sort()).toEqual(STUDENTS.filter((s) => s !== 'claude').sort())
  })

  it('excludes the student stored in sessionStorage on reload and records the new one', () => {
    sessionStorage.setItem(STUDENT_STORAGE_KEY, 'gemini')
    const id = ensureStudent(() => 0.5)
    expect(id).not.toBe('gemini')
    expect(sessionStorage.getItem(STUDENT_STORAGE_KEY)).toBe(id)
    // 同一次加载里（侧栏随路由重挂载）不重抽
    expect(ensureStudent(() => 0.99)).toBe(id)
  })

  it('ignores an unknown stored value', () => {
    sessionStorage.setItem(STUDENT_STORAGE_KEY, 'nobody')
    expect(STUDENTS).toContain(ensureStudent(() => 0))
  })

  it('click order walks all eight students and wraps around', () => {
    let id = STUDENTS[0]
    const seen = [id]
    for (let i = 0; i < STUDENTS.length; i++) {
      id = nextStudent(id)
      seen.push(id)
    }
    expect(seen).toEqual([...STUDENTS, STUDENTS[0]])
    expect(nextStudent('dsh')).toBe('cursor')
    expect(nextStudent('pi')).toBe('claude')
  })

  it('cycles to the next student and stores it', () => {
    expect(nextStudent('claude')).toBe('gpt')
    expect(nextStudent(STUDENTS[STUDENTS.length - 1])).toBe(STUDENTS[0])
    sessionStorage.setItem(STUDENT_STORAGE_KEY, 'pi')
    ensureStudent(() => 0) // → claude（排除 pi 后第一位）
    expect(advanceStudent()).toBe('gpt')
    expect(sessionStorage.getItem(STUDENT_STORAGE_KEY)).toBe('gpt')
  })

  it('keeps the work loop calm: 0.28–0.35s frames, breath pauses and an occasional stroll', () => {
    const work = STUDENT_TIMELINE.filter((s) => s.kind === 'work' && s.frame > 0)
    for (const s of work) expect(s.dur).toBeGreaterThanOrEqual(0.28)
    for (const s of work) expect(s.dur).toBeLessThanOrEqual(0.35)
    const total = STUDENT_TIMELINE.reduce((t, s) => t + s.dur, 0)
    const moves = STUDENT_TIMELINE.filter((s) => s.mirror || s.kind === 'walk')
    expect(moves.length).toBeGreaterThan(0)
    // 一个循环里两次小动作，平均二三十秒一次
    expect(total / 2).toBeGreaterThan(20)
    expect(total / 2).toBeLessThan(32)
    // 踱步走多远都会走回原位，整数像素
    for (const s of STUDENT_TIMELINE) expect(Number.isInteger(s.dx)).toBe(true)
    expect(STUDENT_TIMELINE[STUDENT_TIMELINE.length - 1].dx).toBe(0)
  })
})

describe('SidebarStudent', () => {
  it('is an accessible button that shows one student with its own prop and loads only that atlas', async () => {
    sessionStorage.setItem(STUDENT_STORAGE_KEY, 'pi')
    ensureStudent(() => 0) // claude
    const wrapper = await mountStudent()
    const button = wrapper.get('button.sidebar-student')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('data-student')).toBe('claude')
    expect(button.attributes('aria-label')).toBe('nav.sidebarStudentLabel:Claude@Claude Code')
    expect(button.attributes('title')).toBe('nav.sidebarStudentTitle:Claude@Claude Code')
    expect(wrapper.get('.sidebar-student__prop').attributes('src')).toContain('prop-claude-code')
    expect(wrapper.find('.sidebar-student__badge').exists()).toBe(true)
    // 只解码当次学子所在的那一张首页图集
    expect(decodeCalls).toHaveLength(1)
    expect(decodeCalls[0]).toMatch(/hero\/actors-1\.png/)
    expect(button.attributes('data-animated')).toBe('true')
  })

  it.each([
    ['cursor', 'Cursor', 'prop-cursor'],
    ['pi', 'Pi', 'prop-pi']
  ] as const)('renders %s with its desk and its own atlas (actors-3)', async (id, tool, prop) => {
    const wrapper = await mountStudent()
    // 从随机抽到的那位开始，按点击顺序一路点到目标学子
    for (let i = 0; i < STUDENTS.length && wrapper.get('button').attributes('data-student') !== id; i++) {
      const before = wrapper.get('button').attributes('data-student')
      await wrapper.get('button').trigger('click')
      await vi.waitFor(() => expect(wrapper.get('button').attributes('data-student')).not.toBe(before))
    }
    expect(wrapper.get('button').attributes('data-student')).toBe(id)
    expect(wrapper.get('button').attributes('aria-label')).toBe(`nav.sidebarStudentLabel:${tool}@${tool}`)
    expect(wrapper.get('.sidebar-student__prop').attributes('src')).toContain(prop)
    expect(wrapper.get('.bh-actor img').attributes('src')).toMatch(new RegExp(`${id}-work-f1|actors-3`))
    await vi.waitFor(() => expect(decodeCalls.some((u) => /hero\/actors-3\.png/.test(u))).toBe(true))
    expect(wrapper.find('.sidebar-student__badge').exists()).toBe(true)
  })

  it('switches to the next student on click and remembers it', async () => {
    ensureStudent(() => 0)
    const wrapper = await mountStudent()
    const first = wrapper.get('button').attributes('data-student') as (typeof STUDENTS)[number]
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('button').attributes('data-student')).toBe(nextStudent(first)))
    const second = wrapper.get('button').attributes('data-student')
    expect(sessionStorage.getItem(STUDENT_STORAGE_KEY)).toBe(second)
    expect(wrapper.get('.sidebar-student__prop').attributes('src')).toContain('prop-')
  })

  it('advances frames while visible', async () => {
    const wrapper = await mountStudent()
    expect(wrapper.get('button').attributes('data-running')).toBe('true')
    const before = cell(wrapper)
    await sleep(STUDENT_TIMELINE[0].dur * 1000 + 60)
    expect(cell(wrapper)).not.toBe(before)
  })

  it('under reduced motion stays on the frame-1 still and never loads the atlas', async () => {
    reduced = true
    const wrapper = await mountStudent()
    await sleep(400)
    expect(wrapper.get('button').attributes('data-animated')).toBe('false')
    expect(wrapper.get('button').attributes('data-running')).toBe('false')
    expect(wrapper.get('.bh-actor img').attributes('src')).toMatch(/-work-f1\.png/)
    expect(decodeCalls).toHaveLength(0)
  })

  it('pauses the frame clock while inactive (closed drawer) and resumes when shown', async () => {
    const wrapper = await mountStudent({ active: false })
    expect(wrapper.get('button').attributes('data-running')).toBe('false')
    // 抽屉关着时连图集都不取，停在静图
    expect(decodeCalls).toHaveLength(0)
    expect(wrapper.get('.bh-actor img').attributes('src')).toMatch(/-work-f1\.png/)
    await wrapper.setProps({ active: true })
    await vi.waitFor(() => expect(wrapper.get('button').attributes('data-running')).toBe('true'))
    expect(decodeCalls).toHaveLength(1)
    await wrapper.setProps({ active: false })
    expect(wrapper.get('button').attributes('data-running')).toBe('false')
    const frozen = cell(wrapper)
    await sleep(800)
    expect(cell(wrapper)).toBe(frozen)
  })

  it('pauses while the tab is hidden and resumes when visible', async () => {
    const wrapper = await mountStudent()
    await vi.waitFor(() => expect(wrapper.get('button').attributes('data-running')).toBe('true'))
    setHidden(true)
    await flushPromises()
    expect(wrapper.get('button').attributes('data-running')).toBe('false')
    const frozen = cell(wrapper)
    await sleep(800)
    expect(cell(wrapper)).toBe(frozen)
    setHidden(false)
    await flushPromises()
    expect(wrapper.get('button').attributes('data-running')).toBe('true')
  })

  it('stops its timer when unmounted', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const wrapper = await mountStudent()
    await vi.waitFor(() => expect(wrapper.get('button').attributes('data-running')).toBe('true'))
    clear.mockClear()
    wrapper.unmount()
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })
})
