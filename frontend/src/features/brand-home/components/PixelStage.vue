<template>
  <div ref="stageEl" class="bh-stage" :class="{ 'is-fit': fit }" :style="stageStyle" aria-hidden="true">
    <div class="bh-stage__world" :style="{ width: `${width}px`, height: `${worldHeight}px`, transform: worldTransform }">
      <slot :height="worldHeight" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SCENE_STACK_BREAKPOINT } from '../config'
import { panAt } from '../composables/motion'
import { stageLayout } from '../composables/starlink'
import { reducedMotion, useSceneClock } from '../composables/useSceneClock'

/**
 * Fixed-width design world (1440) shown through the stage with one transform,
 * so every pixel sprite keeps its relative position.
 *
 * - ≥ 860px: scaled to the stage width.
 * - < 860px: shown at 0.75× (smaller in `fit` mode when the space is short)
 *   so nobody is cropped out; the stage clips it and the camera pans across,
 *   one round trip every 30s, on the shared scene clock.
 * - < 860px with reduced motion: no pan, the whole width scaled to fit.
 *
 * Height: by default the world is `height` tall and the stage follows it.
 * With `fit` the stage takes the height its parent gives it (the hero fills
 * the first screen) and the world is as tall as that at the current scale, at
 * least HERO_FIT.minHeight; the slot receives that world height.
 *
 * The stage is decorative (aria-hidden); readable text lives next to it.
 */
const props = defineProps<{ width: number; height: number; fit?: boolean }>()

const stageEl = ref<HTMLElement | null>(null)
// First guess from the viewport so the first frame is already the right size.
const stageWidth = ref(typeof window === 'undefined' ? props.width : document.documentElement.clientWidth || props.width)
const stageHeight = ref(typeof window === 'undefined' ? props.height : window.innerHeight || props.height)

function measure() {
  const el = stageEl.value
  if (!el) return
  if (el.clientWidth) stageWidth.value = el.clientWidth
  if (el.clientHeight) stageHeight.value = el.clientHeight
}

const narrow = computed(() => stageWidth.value < SCENE_STACK_BREAKPOINT)
/** Narrow layout with motion allowed (0.75× / fit scale); the camera itself only runs when the world overflows. */
const panEnabled = computed(() => narrow.value && !reducedMotion.value)

const layout = computed(() =>
  stageLayout({
    stageWidth: stageWidth.value,
    stageHeight: stageHeight.value,
    worldWidth: props.width,
    designHeight: props.height,
    pan: panEnabled.value,
    fit: !!props.fit
  })
)
const scale = computed(() => layout.value.scale)
const worldHeight = computed(() => layout.value.worldHeight)
// Fit: never shorter than the minimum world, otherwise the parent decides. Fixed: follow the world.
const stageStyle = computed(() =>
  props.fit ? { minHeight: `${layout.value.stageHeight.toFixed(2)}px` } : { height: `${layout.value.stageHeight}px` }
)

const overflow = computed(() => props.width * layout.value.scale - stageWidth.value)
const panRuns = computed(() => panEnabled.value && overflow.value > 0.5)
const { time } = useSceneClock(stageEl, panRuns)

const offset = computed(() => (panRuns.value ? panAt(time.value, overflow.value) : 0))
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

defineExpose({ scale, worldHeight })
</script>

<style scoped>
.bh-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.bh-stage.is-fit {
  flex: 1 1 auto;
}
.bh-stage__world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
</style>
