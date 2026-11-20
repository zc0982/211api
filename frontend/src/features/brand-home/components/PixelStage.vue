<template>
  <div ref="stageEl" class="bh-stage" :style="{ height: `${height * scale}px` }" aria-hidden="true">
    <div class="bh-stage__world" :style="{ width: `${width}px`, height: `${height}px`, transform: worldTransform }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NARROW_SCENE_SCALE, SCENE_STACK_BREAKPOINT } from '../config'
import { panAt } from '../composables/motion'
import { reducedMotion, useSceneClock } from '../composables/useSceneClock'

/**
 * Fixed-size design world (e.g. 1440×900) shown through the stage with one
 * transform, so every pixel sprite keeps its relative position.
 *
 * - ≥ 860px: scaled to the stage width.
 * - < 860px: shown at 0.75× (1440 → 1080px) so nobody is cropped out; the
 *   stage clips it and the camera pans across, one round trip every 30s, on
 *   the shared scene clock (pauses off screen / in a hidden tab).
 * - < 860px with reduced motion: no pan, the whole world scaled to fit.
 *
 * The stage is decorative (aria-hidden); readable text lives next to it.
 */
const props = defineProps<{ width: number; height: number }>()

const stageEl = ref<HTMLElement | null>(null)
// First guess from the viewport so the first frame is already the right size.
const stageWidth = ref(typeof window === 'undefined' ? props.width : document.documentElement.clientWidth || props.width)

function measure() {
  const w = stageEl.value?.clientWidth
  if (w) stageWidth.value = w
}

const narrow = computed(() => stageWidth.value < SCENE_STACK_BREAKPOINT)
const panEnabled = computed(() => narrow.value && !reducedMotion.value)
const { time } = useSceneClock(stageEl, panEnabled)

const scale = computed(() => (panEnabled.value ? NARROW_SCENE_SCALE : Math.max(0.1, stageWidth.value / props.width)))
const offset = computed(() => (panEnabled.value ? panAt(time.value, props.width * scale.value - stageWidth.value) : 0))
const worldTransform = computed(() => `translateX(${-offset.value}px) scale(${scale.value})`)

let observer: ResizeObserver | null = null
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    observer = new ResizeObserver(measure)
    observer.observe(stageEl.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ scale })
</script>

<style scoped>
.bh-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.bh-stage__world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
</style>
