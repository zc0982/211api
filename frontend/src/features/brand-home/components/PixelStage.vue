<template>
  <div ref="stageEl" class="bh-stage" :style="{ height: `${height * scale}px` }" aria-hidden="true">
    <div class="bh-stage__world" :style="{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Fixed-size design world (e.g. 1440×900) scaled to the stage width with a
 * single transform, so every pixel sprite keeps its relative position. The
 * stage itself is decorative (aria-hidden); readable text for the scene lives
 * next to it. PR 2 adds the 0.75× pan on narrow screens.
 */
const props = defineProps<{ width: number; height: number }>()

const stageEl = ref<HTMLElement | null>(null)
// First guess from the viewport so the first frame is already the right size.
const scale = ref(typeof window === 'undefined' ? 1 : Math.max(0.1, (document.documentElement.clientWidth || props.width) / props.width))

function measure() {
  const w = stageEl.value?.clientWidth
  if (w) scale.value = w / props.width
}

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
