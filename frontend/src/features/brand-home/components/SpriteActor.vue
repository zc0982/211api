<template>
  <span class="bh-actor" :style="boxStyle">
    <img v-if="animated" class="bh-pixel" :src="sheet.url" alt="" :width="sheetW" :height="sheetH" decoding="async" :style="cellStyle" />
    <img v-else class="bh-pixel" :src="still" alt="" :width="cellW" :height="cellH" decoding="async" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SPRITE_SCALE } from '../config'
import { SPRITE_SHEETS } from '../sprites.generated'
import { actorSheet, type SpriteCharacter, type SpriteScene } from '../composables/useSpriteSheets'
import type { ActorState } from '../composables/motion'

/**
 * One pixel character. Position, facing and frame are all transforms: the box
 * moves with translate() and flips with scaleX(-1); inside it the atlas slides
 * to the current cell. Until the atlas has loaded (or under reduced motion) it
 * shows the inlined frame-1 still, which has the same cell size.
 */
const props = defineProps<{
  scene: SpriteScene
  id: SpriteCharacter
  state: ActorState
  /** Feet line in scene pixels (bottom of the cell). */
  feetY: number
  /** Frame-1 still for the current kind. */
  still: string
  /** Atlas loaded and the clock may run. */
  animated: boolean
}>()

const spec = computed(() => SPRITE_SHEETS[props.scene])
const sheet = computed(() => actorSheet(props.scene, props.id))
const cellW = computed(() => spec.value.cellW * SPRITE_SCALE)
const cellH = computed(() => spec.value.cellH * SPRITE_SCALE)
const strideX = computed(() => (spec.value.cellW + spec.value.gutter) * SPRITE_SCALE)
const strideY = computed(() => (spec.value.cellH + spec.value.gutter) * SPRITE_SCALE)
const sheetW = computed(() => strideX.value * spec.value.kinds.length * spec.value.frames - spec.value.gutter * SPRITE_SCALE)
const sheetH = computed(() => {
  const n = sheet.value.n
  const rows = Object.values(spec.value.rows as Readonly<Record<string, readonly [number, number]>>).filter(([m]) => m === n).length
  return strideY.value * rows - spec.value.gutter * SPRITE_SCALE
})

const boxStyle = computed(() => {
  const x = props.state.x - cellW.value / 2
  const y = props.feetY - cellH.value
  return {
    width: `${cellW.value}px`,
    height: `${cellH.value}px`,
    transform: `translate(${x}px, ${y}px)${props.state.mirror ? ' scaleX(-1)' : ''}`
  }
})

const cellStyle = computed(() => {
  const kinds = spec.value.kinds as readonly string[]
  const cell = Math.max(0, kinds.indexOf(props.state.kind)) * spec.value.frames + props.state.frame
  return { transform: `translate(${-cell * strideX.value}px, ${-sheet.value.row * strideY.value}px)` }
})
</script>

<style scoped>
.bh-actor {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
}
.bh-actor img {
  display: block;
  max-width: none;
}
</style>
