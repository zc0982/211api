<template>
  <div class="bh-ss">
    <div class="bh-ss__sky" />
    <img class="bh-ss__layer" :src="starsUrl" alt="" width="1440" height="198" loading="lazy" decoding="async" />
    <img
      class="bh-ss__layer bh-pixel"
      :src="skylineUrl"
      alt=""
      width="1440"
      height="88"
      loading="lazy"
      decoding="async"
      :style="{ top: '252px' }"
    />

    <img
      v-for="(prop, index) in SITE_PROPS"
      :key="`${prop.file}-${index}`"
      class="bh-ss__sprite bh-pixel"
      :class="{ 'is-mirrored': prop.mirror }"
      :src="sprite(`prop-${prop.file}`)"
      alt=""
      :width="prop.w"
      :height="prop.h"
      loading="lazy"
      decoding="async"
      :style="box(prop.x, prop.y, prop.w, prop.h)"
    />

    <!-- Crane rope and hook carrying a pallet of bricks (PR 2 animates the drop). -->
    <span class="bh-ss__rope" :style="{ left: `${SITE_HOOK.ropeX}px`, top: `${SITE_HOOK.ropeTop}px`, height: `${SITE_HOOK.y - SITE_HOOK.ropeTop}px` }" />
    <img
      class="bh-ss__sprite bh-pixel"
      :src="sprite('prop-pallet-hook')"
      alt=""
      :width="SITE_HOOK.w"
      :height="SITE_HOOK.h"
      loading="lazy"
      decoding="async"
      :style="box(SITE_HOOK.x, SITE_HOOK.y, SITE_HOOK.w, SITE_HOOK.h)"
    />
    <span class="bh-ss__chip" :style="{ left: `${SITE_HOOK.x + 63}px`, top: `${SITE_HOOK.y + 34}px` }">
      <i class="bh-ss__icon bh-ss__icon--context" /><span class="bh-ss__label">{{ labels.context }}</span>
      <span class="bh-mono">{{ SITE_CONTEXT_VALUE }}</span>
    </span>

    <template v-for="worker in SITE_WORKERS" :key="worker.id">
      <img
        class="bh-ss__sprite bh-pixel"
        :class="{ 'is-mirrored': worker.mirror }"
        :src="sprite(worker.sprite)"
        alt=""
        :width="worker.w * SPRITE_SCALE"
        :height="worker.h * SPRITE_SCALE"
        loading="lazy"
        decoding="async"
        :style="box(worker.x, worker.y, worker.w * SPRITE_SCALE, worker.h * SPRITE_SCALE)"
      />
      <span class="bh-ss__chip" :style="{ left: `${worker.chipX}px`, top: `${worker.chipY}px` }">
        <template v-if="worker.chip === 'firstToken'">
          <i class="bh-ss__icon bh-ss__icon--play" /><span class="bh-ss__label">{{ labels.firstToken }}</span>
          <span class="bh-mono">{{ SITE_PARAMS[worker.id].firstToken }}</span>
        </template>
        <template v-else-if="worker.chip === 'speed'">
          <i class="bh-ss__icon bh-ss__icon--ok" /><span class="bh-mono">{{ SITE_PARAMS[worker.id].speed }} tok/s</span>
        </template>
        <template v-else-if="worker.chip === 'tokens'">
          <i class="bh-ss__icon bh-ss__icon--brick" /><span class="bh-mono">{{ SITE_PARAMS[worker.id].tokens }} tok</span>
        </template>
        <span v-else class="bh-mono bh-ss__cost">{{ SITE_PARAMS[worker.id].cost }}</span>
      </span>
    </template>

    <span class="bh-ss__base" />
    <span class="bh-ss__edge" />
    <span
      v-for="chip in SITE_CACHE_CHIPS"
      :key="chip.x"
      class="bh-ss__chip"
      :style="{ left: `${chip.x}px`, top: '350px' }"
    >
      <i class="bh-ss__icon bh-ss__icon--cache" /><span class="bh-ss__label">{{ labels.cache }}</span>
      <span class="bh-mono">{{ chip.value }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import starsUrl from '../assets/scene/footer-stars.svg?url'
import skylineUrl from '../assets/scene/footer-skyline.svg?url'
import {
  SITE_CACHE_CHIPS,
  SITE_CONTEXT_VALUE,
  SITE_HOOK,
  SITE_PARAMS,
  SITE_PROPS,
  SITE_WORKERS,
  SPRITE_SCALE
} from '../config'

/**
 * 页脚「新教学楼工地」场景（Figma 46:3761 / 59:22798）第 0 秒的静态画面：
 * 两队学子砌墙、抱砖，塔吊吊着一托砖；参数牌把砖比作 token。全部数值为示意，
 * 页脚文字里标注「工地参数为示意」。场景 aria-hidden，可读文本在 FooterSite。
 */
defineProps<{ labels: { firstToken: string; cache: string; context: string } }>()

const SPRITES = import.meta.glob('../assets/sprites/footer/*.png', { eager: true, import: 'default', query: '?url' }) as Record<
  string,
  string
>
const sprite = (name: string) => SPRITES[`../assets/sprites/footer/${name}.png`]

const box = (x: number, y: number, w: number, h: number) => ({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` })
</script>

<style scoped>
.bh-ss {
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--bh-font-sans);
}
.bh-ss > * {
  position: absolute;
}
.bh-ss__sky {
  left: 0;
  top: 0;
  width: 1440px;
  height: 340px;
  background: var(--bh-night-sky-footer);
}
.bh-ss__layer {
  left: 0;
  top: 0;
  max-width: none;
}
.bh-ss__sprite {
  max-width: none;
}
.bh-ss__sprite.is-mirrored {
  transform: scaleX(-1);
}
.bh-ss__rope {
  width: 2px;
  background: #c9d3e6;
}
/* Top of the footer base: the stage runs 40px past the ground so the cache chips sit on it. */
.bh-ss__base {
  left: 0;
  top: 344px;
  width: 1440px;
  height: 40px;
  background: var(--bh-night-footer);
}
.bh-ss__edge {
  left: 0;
  top: 340px;
  width: 1440px;
  height: 4px;
  background: #22355f;
}

/* Parameter chips: 22px capsule, #0e1830 92%, 1px #2b4170 (Figma 59:22858). */
.bh-ss__chip {
  display: flex;
  align-items: center;
  gap: 5px;
  box-sizing: border-box;
  height: 22px;
  padding: 0 9px;
  border: 1px solid var(--bh-night-chip-line);
  border-radius: 999px;
  background: rgba(14, 24, 48, 0.92);
  color: var(--bh-night-text);
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
}
.bh-ss__label {
  color: var(--bh-night-slate);
}
.bh-ss__cost {
  color: var(--bh-night-bronze);
  font-weight: 500;
}
.bh-ss__icon {
  position: relative;
  flex: none;
  width: 9px;
  height: 9px;
}
.bh-ss__icon--play {
  clip-path: polygon(12% 6%, 90% 50%, 12% 94%);
  background: var(--bh-night-blue);
}
.bh-ss__icon--ok::before {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 50%;
  background: var(--bh-night-ok);
}
.bh-ss__icon--brick {
  background:
    linear-gradient(to right, transparent 4px, #6e3a2e 4px, #6e3a2e 5px, transparent 5px) 0 2px / 9px 5px no-repeat,
    linear-gradient(#a8553f, #a8553f) 0 2px / 9px 5px no-repeat;
}
.bh-ss__icon--cache {
  border: 1px solid var(--bh-night-ok);
  box-sizing: border-box;
}
.bh-ss__icon--cache::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 3px;
  width: 5px;
  height: 2px;
  background: var(--bh-night-ok);
}
.bh-ss__icon--context {
  border: 1px solid #c9d3e6;
  box-sizing: border-box;
}
.bh-ss__icon--context::before,
.bh-ss__icon--context::after {
  content: '';
  position: absolute;
  left: 1px;
  width: 5px;
  height: 1px;
  background: #c9d3e6;
}
.bh-ss__icon--context::before {
  top: 2px;
}
.bh-ss__icon--context::after {
  top: 4px;
}
</style>
