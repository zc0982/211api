<template>
  <span class="bh-roll" :aria-label="String(value)">
    <span v-for="(d, i) in cells" :key="i" class="bh-roll__cell" aria-hidden="true">
      <span class="bh-roll__strip" :style="{ transform: `translateY(${-d * ROW}px)` }">
        <span v-for="n in GLYPHS" :key="n">{{ n }}</span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Counter whose digits change without re-laying out text: each digit is a
 * fixed 1ch cell over a strip of 0–9 (plus a blank for leading positions),
 * moved with translateY. Width is set by `digits`, so the chip never resizes.
 * Used for the footer site's counting numbers (cache hit, tok/s).
 */
const props = defineProps<{ value: number; digits: number }>()

/** Row height in px; must match the line-height below. */
const ROW = 14
const GLYPHS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ']
const BLANK = 10

const cells = computed(() => {
  const v = Math.max(0, Math.round(props.value))
  return Array.from({ length: props.digits }, (_, i) => {
    const place = 10 ** (props.digits - 1 - i)
    // Leading positions the number has not reached yet stay blank.
    if (v < place && i < props.digits - 1) return BLANK
    return Math.floor(v / place) % 10
  })
})
</script>

<style scoped>
.bh-roll {
  display: inline-flex;
  vertical-align: top;
}
.bh-roll__cell {
  display: inline-block;
  width: 1ch;
  height: 14px;
  overflow: hidden;
  line-height: 14px;
}
.bh-roll__strip {
  display: flex;
  flex-direction: column;
}
.bh-roll__strip > span {
  height: 14px;
  text-align: center;
}
</style>
