import { ref } from 'vue'
import { HERO_CHARACTERS, HERO_STATIONS, type EcosystemTool, type HeroCharacter, type HeroStation } from '@/features/brand-home/config'
import type { SpriteCharacter } from '@/features/brand-home/composables/useSpriteSheets'

/**
 * 侧栏底部「学院一角」的动态像素学子（docs/spec/console-v3.md「外壳 · 侧栏」）。
 *
 * - 8 位学子与首页首屏共用 HERO_CHARACTERS，每人带自己工位的道具；
 * - 每次刷新随机 1 位，并排除上一次（sessionStorage）；点击切到下一位；
 * - 时间线是纯数据（STUDENT_TIMELINE），组件只按步播放：原地干活 4 帧 + 呼吸停顿，
 *   约每二十多秒交替一次「踱步」和「回头看一眼」。
 */

export type StudentId = SpriteCharacter

export interface SidebarStudentSpec {
  id: StudentId
  /** 自己的工位：道具和悬停里的工具名都取 HERO_STATIONS 里这一项。 */
  tool: EcosystemTool
  /** 干活帧画布的 1x 尺寸（头侧圆标定位用）。 */
  w: number
  h: number
  /** 头侧圆标：模型厂商图标，或工具图标。 */
  badge: HeroCharacter['badge']
}

/** 轮换池，也是点击切换的顺序；每人使用首页 A 点的工位。 */
export const SIDEBAR_STUDENTS: readonly SidebarStudentSpec[] = HERO_CHARACTERS.map((c) => ({
  id: c.id, tool: c.stationA, w: c.w, h: c.h, badge: c.badge
}))

export const STUDENTS: readonly StudentId[] = SIDEBAR_STUDENTS.map((c) => c.id)

/** sessionStorage 键：上一次展示的学子 ID。 */
export const STUDENT_STORAGE_KEY = 'console-sidebar-student'

/** 显示名（悬停 / 读屏）。 */
export const STUDENT_NAME: Readonly<Record<StudentId, string>> = {
  claude: 'Claude',
  gpt: 'GPT',
  gemini: 'Gemini',
  grok: 'Grok',
  opencode: 'OpenCode',
  dsh: 'DSH',
  cursor: 'Cursor',
  pi: 'Pi'
}

export function studentCharacter(id: StudentId): SidebarStudentSpec {
  return SIDEBAR_STUDENTS.find((c) => c.id === id)!
}

/** 学子自己的工位，道具和工具名都取这里。 */
export function studentStation(id: StudentId): HeroStation {
  const tool = studentCharacter(id).tool
  return HERO_STATIONS.find((s) => s.tool === tool)!
}

function isStudent(value: unknown): value is StudentId {
  return typeof value === 'string' && (STUDENTS as readonly string[]).includes(value)
}

export function readLastStudent(): StudentId | null {
  try {
    const v = sessionStorage.getItem(STUDENT_STORAGE_KEY)
    return isStudent(v) ? v : null
  } catch {
    return null
  }
}

export function writeLastStudent(id: StudentId) {
  try {
    sessionStorage.setItem(STUDENT_STORAGE_KEY, id)
  } catch {
    // 存储被禁用（隐私模式等）：本页照常显示，只是下次刷新可能抽到同一位。
  }
}

/** 随机 1 位，排除上一次；`random` 返回 [0, 1)。 */
export function pickStudent(last: StudentId | null, random: () => number = Math.random): StudentId {
  const pool = last ? STUDENTS.filter((id) => id !== last) : STUDENTS
  const i = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return pool[i]
}

/** 点击切换：按 STUDENTS 顺序的下一位（循环）。 */
export function nextStudent(id: StudentId): StudentId {
  return STUDENTS[(STUDENTS.indexOf(id) + 1) % STUDENTS.length]
}

/**
 * 本次页面加载的学子。放在模块里而不是组件里：侧栏随路由重挂载、收起再展开时不重抽，
 * 只有刷新页面（模块重新执行）才重抽。
 */
export const currentStudent = ref<StudentId | null>(null)

export function ensureStudent(random?: () => number): StudentId {
  if (!currentStudent.value) {
    currentStudent.value = pickStudent(readLastStudent(), random)
    writeLastStudent(currentStudent.value)
  }
  return currentStudent.value
}

export function advanceStudent(): StudentId {
  const next = nextStudent(ensureStudent())
  currentStudent.value = next
  writeLastStudent(next)
  return next
}

/** 测试用：回到「本次加载还没抽」的状态。 */
export function resetStudentForTest() {
  currentStudent.value = null
}

/* -------------------------------------------------------------------------- */
/* 时间线                                                                       */
/* -------------------------------------------------------------------------- */

export interface StudentStep {
  kind: 'work' | 'walk'
  /** 0..3 within the kind. */
  frame: number
  /** 朝左（scaleX(-1)）；精灵默认朝右，面向道具。 */
  mirror: boolean
  /** 相对站位的水平偏移，单位为 1x 像素（显示时 × SPRITE_SCALE）。 */
  dx: number
  /** 这一步停留的秒数。 */
  dur: number
}

/** 干活每帧秒数（首页 0.2s，这里更舒缓）。 */
export const STUDENT_WORK_FRAME = 0.32
/** 每轮 4 帧之后停在第 1 帧的「呼吸」停顿。 */
export const STUDENT_BREATH = 0.64
/** 走路每帧秒数，每帧挪 STUDENT_STEP_PX（1x 像素）。 */
export const STUDENT_WALK_FRAME = 0.3
export const STUDENT_STEP_PX = 2
/** 两次小动作之间干活的轮数：12 × (4 × 0.32 + 0.64) ≈ 23s。 */
export const STUDENT_WORK_ROUNDS = 12

function workRounds(n: number): StudentStep[] {
  const steps: StudentStep[] = []
  for (let r = 0; r < n; r++) {
    for (let f = 0; f < 4; f++) steps.push({ kind: 'work', frame: f, mirror: false, dx: 0, dur: STUDENT_WORK_FRAME })
    steps.push({ kind: 'work', frame: 0, mirror: false, dx: 0, dur: STUDENT_BREATH })
  }
  return steps
}

/** 转身朝左踱 3 步、停一下，再转回来走回原位。 */
function stroll(): StudentStep[] {
  const out: StudentStep[] = []
  const n = 3
  for (let i = 1; i <= n; i++) out.push({ kind: 'walk', frame: i % 4, mirror: true, dx: -STUDENT_STEP_PX * i, dur: STUDENT_WALK_FRAME })
  out.push({ kind: 'walk', frame: 0, mirror: true, dx: -STUDENT_STEP_PX * n, dur: 1.2 })
  for (let i = n - 1; i >= 0; i--) out.push({ kind: 'walk', frame: (n - i) % 4, mirror: false, dx: -STUDENT_STEP_PX * i, dur: STUDENT_WALK_FRAME })
  out.push({ kind: 'walk', frame: 0, mirror: false, dx: 0, dur: 0.4 })
  return out
}

/** 原地回头看一眼。 */
function glance(): StudentStep[] {
  return [
    { kind: 'work', frame: 0, mirror: true, dx: 0, dur: 1.4 },
    { kind: 'work', frame: 0, mirror: false, dx: 0, dur: 0.4 }
  ]
}

/** 一个循环约 50s：干活 ≈23s → 踱步 → 干活 ≈23s → 回头。 */
export const STUDENT_TIMELINE: readonly StudentStep[] = [
  ...workRounds(STUDENT_WORK_ROUNDS),
  ...stroll(),
  ...workRounds(STUDENT_WORK_ROUNDS),
  ...glance()
]

/** 静止画面 / 减少动态效果：干活第 1 帧、原位、朝右。 */
export const STUDENT_REST: StudentStep = { kind: 'work', frame: 0, mirror: false, dx: 0, dur: 0 }
