<template>
  <nav class="bh-dock" :aria-label="label" @mouseleave="settle" @focusout="onFocusOut">
    <span class="bh-dock__knob" :style="knobStyle" aria-hidden="true" />
    <template v-for="item in items" :key="item.key">
      <RouterLink
        v-if="item.to"
        :ref="(el) => setRef(item.key, el)"
        :to="item.to"
        class="bh-dock__link"
        :class="{ 'is-current': item.key === current }"
        @mouseenter="moveTo(item.key)"
        @focus="moveTo(item.key)"
      >
        {{ item.label }}
      </RouterLink>
      <a
        v-else
        :ref="(el) => setRef(item.key, el)"
        :href="item.href"
        class="bh-dock__link"
        :class="{ 'is-current': item.key === current }"
        :aria-current="item.key === current ? 'page' : undefined"
        :target="item.external ? '_blank' : undefined"
        :rel="item.external ? 'noopener' : undefined"
        @click="onClick(item, $event)"
        @mouseenter="moveTo(item.key)"
        @focus="moveTo(item.key)"
      >
        {{ item.label }}
      </a>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'

/**
 * 导航胶囊（液态玻璃）。当前项下衬 7% 深蓝高亮胶囊，悬停 / 聚焦时以
 * .45s 回弹曲线滑到对应项，离开后回到当前项。
 */
export interface DockItem {
  key: string
  label: string
  to?: string
  href?: string
  external?: boolean
  /** In-page target id handled with scrollIntoView (router scrollBehavior ignores hashes). */
  anchor?: string
}

const props = defineProps<{ items: DockItem[]; current: string; label: string }>()
const emit = defineEmits<{ (e: 'anchor', id: string): void }>()

const refs = new Map<string, HTMLElement>()
const active = ref(props.current)
const box = ref<{ left: number; width: number } | null>(null)

function setRef(key: string, el: Element | ComponentPublicInstance | null) {
  const node = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null)
  if (node) refs.set(key, node)
  else refs.delete(key)
}

function measure() {
  const el = refs.get(active.value)
  box.value = el ? { left: el.offsetLeft, width: el.offsetWidth } : null
}

function moveTo(key: string) {
  active.value = key
  measure()
}

function settle() {
  moveTo(props.current)
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) settle()
}

function onClick(item: DockItem, event: MouseEvent) {
  if (!item.anchor) return
  event.preventDefault()
  emit('anchor', item.anchor)
}

const knobStyle = computed(() =>
  box.value
    ? { transform: `translateX(${box.value.left}px)`, width: `${box.value.width}px`, opacity: 1 }
    : { opacity: 0 }
)

let resizeObserver: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  measure()
  // Web fonts change link widths after first paint.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measure())
    refs.forEach((el) => resizeObserver?.observe(el))
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.bh-dock {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 6px;
  border: 1px solid rgba(12, 24, 48, 0.08);
  border-radius: 999px;
  background:
    linear-gradient(to bottom, rgba(255, 255, 255, 0.14), transparent 45%),
    rgba(255, 255, 255, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 8px 24px -8px rgba(12, 24, 48, 0.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  backdrop-filter: blur(20px) saturate(1.5);
}
.bh-dock__knob {
  position: absolute;
  top: 6px;
  left: 0;
  height: calc(100% - 12px);
  border-radius: 999px;
  background: rgba(12, 24, 48, 0.07);
  transition:
    transform 0.45s var(--bh-ease-knob),
    width 0.45s var(--bh-ease-knob),
    opacity 0.2s;
  pointer-events: none;
}
.bh-dock__link {
  position: relative;
  padding: 6px 16px;
  border-radius: 999px;
  color: var(--bh-slate);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  transition: color 0.2s;
}
.bh-dock__link:hover,
.bh-dock__link.is-current {
  color: var(--bh-ink);
}
.bh-dock__link:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}
</style>
