<template>
  <button
    v-if="assets"
    type="button"
    class="sidebar-student"
    :tabindex="active ? undefined : -1"
    :data-student="assets.id"
    :data-animated="animated ? 'true' : 'false'"
    :data-running="running ? 'true' : 'false'"
    :aria-label="t('nav.sidebarStudentLabel', { name, tool: station.name })"
    :title="t('nav.sidebarStudentTitle', { name, tool: station.name })"
    @click="onClick"
  >
    <img
      class="sidebar-student__prop"
      :src="assets.prop"
      alt=""
      :width="propW"
      :height="propH"
      decoding="async"
      :style="{ left: `${propLeft}px`, top: `${FEET_Y - propH}px` }"
    />
    <SpriteActor scene="hero" :id="assets.id" :state="actorState" :feet-y="FEET_Y" :still="assets.still" :animated="animated" />
    <span class="sidebar-student__badge" :style="badgeStyle">
      <VendorIcon v-if="'vendor' in character.badge" :vendor="character.badge.vendor" :size="12" />
      <ToolIcon v-else :tool="character.badge.tool" :size="12" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SpriteActor from '@/features/brand-home/components/SpriteActor.vue'
import VendorIcon from '@/features/brand-home/components/VendorIcon.vue'
import ToolIcon from '@/features/brand-home/components/ToolIcon.vue'
import { SPRITE_SCALE } from '@/features/brand-home/config'
import { SPRITE_SHEETS } from '@/features/brand-home/sprites.generated'
import { actorSheet } from '@/features/brand-home/composables/useSpriteSheets'
import { onMediaChange } from '@/features/brand-home/composables/mediaQuery'
import {
  STUDENT_NAME,
  STUDENT_REST,
  STUDENT_TIMELINE,
  advanceStudent,
  currentStudent,
  ensureStudent,
  studentCharacter,
  type StudentId,
  studentStation
} from './sidebarStudent'

/**
 * 侧栏「学院一角」左侧舞台：1 位像素学子 + 工位道具 + 头侧圆标，整块是一个按钮，点击换下一位。
 * 只按需加载当次学子的第 1 帧静图、道具（各自是很小的异步模块）和所在那张图集；
 * 图集解码完成前显示静图。`active` 为 false（手机抽屉关闭）、标签页隐藏、
 * 或系统要求减少动态效果时帧时钟停住（后者停在第 1 帧静图，也不加载图集）。
 * 手机抽屉关闭时侧栏整体 aria-hidden 且移出屏幕，按钮同时退出 Tab 顺序（tabindex=-1）。
 */
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true })

const { t } = useI18n()

/** 1.5 倍像素（与首页一致）；脚线比地面线（容器 y=106）低 2px，同首页 HERO_FEET_Y。 */
const FEET_Y = 108
/** 站位：精灵格左边 8px；道具左边 = 中心 + 26（首页每个工位都是这个间距）。 */
const CELL_W = SPRITE_SHEETS.hero.cellW * SPRITE_SCALE
const ACTOR_X = 8 + CELL_W / 2
const PROP_GAP = 26

const STILLS = import.meta.glob('../../features/brand-home/assets/sprites/hero/*-work-f1.png', { query: '?url', import: 'default' }) as Record<
  string,
  () => Promise<string>
>
const PROPS = import.meta.glob('../../features/brand-home/assets/sprites/hero/prop-*.png', { query: '?url', import: 'default' }) as Record<
  string,
  () => Promise<string>
>
const DIR = '../../features/brand-home/assets/sprites/hero'

interface Assets {
  id: StudentId
  still: string
  prop: string
}

/** 当前已显示的学子（静图和道具都到了才换，避免闪空）。 */
const assets = shallowRef<Assets | null>(null)
/** 图集已解码的学子。 */
const atlasReady = ref<StudentId | null>(null)
const reducedMotion = ref(false)
const pageHidden = ref(typeof document !== 'undefined' && document.hidden)
const stepIndex = ref(0)

const shownId = computed<StudentId>(() => assets.value?.id ?? currentStudent.value ?? 'claude')
const character = computed(() => studentCharacter(shownId.value))
const station = computed(() => studentStation(shownId.value))
const name = computed(() => STUDENT_NAME[shownId.value])

const animated = computed(() => !reducedMotion.value && atlasReady.value === shownId.value)
const running = computed(() => animated.value && props.active && !pageHidden.value)

const step = computed(() => (animated.value ? STUDENT_TIMELINE[stepIndex.value] : STUDENT_REST))
const actorState = computed(() => ({
  x: ACTOR_X + step.value.dx * SPRITE_SCALE,
  kind: step.value.kind,
  frame: step.value.frame,
  mirror: step.value.mirror
}))

const propW = computed(() => station.value.propW * SPRITE_SCALE)
const propH = computed(() => station.value.propH * SPRITE_SCALE)
const propLeft = ACTOR_X + PROP_GAP

/** 头侧 18px 圆标：贴在干活帧的头侧，随人移动、不随转身翻面（同首页 badgeStyle）。 */
const badgeStyle = computed(() => {
  const c = character.value
  const x = actorState.value.x + (c.w * SPRITE_SCALE) / 2 - 6
  const y = FEET_Y - c.h * SPRITE_SCALE + 8
  return { transform: `translate(${x}px, ${y}px)` }
})

/* ---- 按需加载 ---- */

const atlasCache = new Map<string, Promise<void>>()
function decodeAtlas(url: string): Promise<void> {
  let p = atlasCache.get(url)
  if (!p) {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    p =
      typeof img.decode === 'function'
        ? img.decode()
        : new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
          })
    // 失败不缓存：下次换人或换回来时重试；本次保持静图。
    p.catch(() => atlasCache.delete(url))
    atlasCache.set(url, p)
  }
  return p
}

let loadToken = 0
async function show(id: StudentId) {
  const token = ++loadToken
  const s = studentStation(id)
  // 加载失败（离线、部署切换）保持当前画面，下次点击或刷新再试
  const loaded = await Promise.all([STILLS[`${DIR}/${id}-work-f1.png`](), PROPS[`${DIR}/prop-${s.prop}.png`]()]).catch(() => null)
  if (!loaded || token !== loadToken) return
  const [still, prop] = loaded
  stepIndex.value = 0
  assets.value = { id, still, prop }
  loadAtlas()
}

function loadAtlas() {
  const id = assets.value?.id
  // 抽屉关着（看不见）时不取图集，打开再取
  if (!id || reducedMotion.value || !props.active || atlasReady.value === id) return
  decodeAtlas(actorSheet('hero', id).url)
    .then(() => {
      if (assets.value?.id === id) atlasReady.value = id
    })
    .catch(() => {})
}

function onClick() {
  void show(advanceStudent())
}

/* ---- 帧时钟：按步 setTimeout，没在跑就没有定时器 ---- */

let timer: ReturnType<typeof setTimeout> | null = null
function stopClock() {
  if (timer) clearTimeout(timer)
  timer = null
}
function schedule() {
  stopClock()
  if (!running.value) return
  timer = setTimeout(() => {
    timer = null
    stepIndex.value = (stepIndex.value + 1) % STUDENT_TIMELINE.length
    schedule()
  }, STUDENT_TIMELINE[stepIndex.value].dur * 1000)
}
watch(running, schedule)
watch(
  () => props.active,
  (active) => active && loadAtlas()
)
watch(shownId, () => {
  if (running.value) schedule()
})

let offMedia: (() => void) | null = null
function onVisibility() {
  pageHidden.value = document.hidden
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = mq.matches
    offMedia = onMediaChange(mq, (e) => {
      reducedMotion.value = e.matches
      if (!e.matches) loadAtlas()
    })
  }
  document.addEventListener('visibilitychange', onVisibility)
  void show(currentStudent.value ?? ensureStudent())
})

onBeforeUnmount(() => {
  loadToken++
  stopClock()
  offMedia?.()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.sidebar-student {
  position: absolute;
  left: 0;
  top: 0;
  /* 只占左侧舞台（学子 + 道具），右侧月亮、图书馆不可点 */
  width: 140px;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-student:focus-visible {
  outline: 2px solid #7aa2ff;
  outline-offset: -2px;
}

.sidebar-student > * {
  position: absolute;
}

.sidebar-student :deep(img) {
  display: block;
  max-width: none;
  image-rendering: pixelated;
  pointer-events: none;
  user-select: none;
}

.sidebar-student__badge {
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 1px solid #2b4170;
  border-radius: 50%;
  background: #e9eef8;
  pointer-events: none;
  --bh-ink: #0c1830;
}
</style>
