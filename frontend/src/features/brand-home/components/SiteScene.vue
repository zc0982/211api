<template>
  <div ref="root" class="bh-ss">
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

    <!-- Crane rope and hook carrying a pallet of bricks; the context chip rides with the hook. -->
    <span class="bh-ss__rope" :style="ropeStyle" />
    <img
      class="bh-ss__sprite bh-ss__moving bh-pixel"
      :src="sprite('prop-pallet-hook')"
      alt=""
      :width="SITE_HOOK.w"
      :height="SITE_HOOK.h"
      loading="lazy"
      decoding="async"
      :style="{ width: `${SITE_HOOK.w}px`, height: `${SITE_HOOK.h}px`, transform: `translate(${SITE_HOOK.x}px, ${hookY}px)` }"
    />
    <span class="bh-ss__chip bh-ss__moving" :style="{ transform: `translate(${SITE_HOOK.x + 63}px, ${hookY + 34}px)` }">
      <i class="bh-ss__icon bh-ss__icon--context" /><span class="bh-ss__label">{{ labels.context }}</span>
      <span class="bh-mono">{{ SITE_CONTEXT_VALUE }}</span>
    </span>

    <template v-for="(worker, index) in SITE_WORKERS" :key="worker.id">
      <SpriteActor
        scene="footer"
        :id="worker.id"
        :state="states[index]"
        :feet-y="SITE_FEET_Y"
        :still="still(worker.id, states[index].kind)"
        :animated="animated"
      />
      <!-- All four chips exist; the current one is shown by opacity, so a switch never re-lays out text. -->
      <span
        v-for="kind in CHIP_KINDS"
        :key="kind"
        class="bh-ss__chip bh-ss__moving bh-ss__param"
        :class="{ 'is-off': states[index].chip !== kind }"
        :style="chipStyle(worker, states[index].x)"
      >
        <template v-if="kind === 'firstToken'">
          <i class="bh-ss__icon bh-ss__icon--play" /><span class="bh-ss__label">{{ labels.firstToken }}</span>
          <span class="bh-mono">{{ SITE_PARAMS[worker.id].firstToken }}</span>
        </template>
        <template v-else-if="kind === 'speed'">
          <i class="bh-ss__icon bh-ss__icon--ok" /><span class="bh-mono"><RollingNumber :value="speeds[index]" :digits="String(SITE_PARAMS[worker.id].speed).length" /> tok/s</span>
        </template>
        <template v-else-if="kind === 'tokens'">
          <i class="bh-ss__icon bh-ss__icon--brick" /><span class="bh-mono">{{ SITE_PARAMS[worker.id].tokens }} tok</span>
        </template>
        <span v-else class="bh-mono bh-ss__cost">{{ SITE_PARAMS[worker.id].cost }}</span>
      </span>
    </template>

    <span class="bh-ss__base" />
    <span class="bh-ss__edge" />
    <span
      v-for="(chip, index) in SITE_CACHE_CHIPS"
      :key="chip.x"
      class="bh-ss__chip"
      :style="{ left: `${chip.x}px`, top: '350px' }"
    >
      <i class="bh-ss__icon bh-ss__icon--cache" /><span class="bh-ss__label">{{ labels.cache }}</span>
      <span class="bh-mono"><RollingNumber :value="cacheHits[index]" :digits="2" />%</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SpriteActor from './SpriteActor.vue'
import RollingNumber from './RollingNumber.vue'
import starsUrl from '../assets/scene/footer-stars.svg?url'
import skylineUrl from '../assets/scene/footer-skyline.svg?url'
import {
  SITE_CACHE_CHIPS,
  SITE_CHIP_DX,
  SITE_CHIP_H,
  SITE_CONTEXT_VALUE,
  SITE_FEET_Y,
  SITE_HOOK,
  SITE_PARAMS,
  SITE_PROPS,
  SITE_WORKERS,
  SPRITE_SCALE,
  type SiteChipKind,
  type SiteWorker
} from '../config'
import { cacheHitAt, cachePeak, hookYAt, siteRestState, siteSpeedAt, siteStateAt, type ActorKind } from '../composables/motion'
import { useSceneClock } from '../composables/useSceneClock'
import { useSpriteSheets } from '../composables/useSpriteSheets'

/**
 * 页脚「新教学楼工地」场景（Figma 46:3761 / 59:22798）：两队学子按 9.6s 时间线
 * 砌砖、空手回砖堆、抱砖走回，塔吊吊钩一托砖下降再升起；参数牌把砖比作 token，
 * 随人移动。全部数值为示意，页脚文字里标注「工地参数为示意」。角色精灵表在场景
 * 接近视口时才加载；减少动态效果时停在每人砌砖的第 1 帧。场景 aria-hidden，
 * 可读文本在 FooterSite。
 */
defineProps<{ labels: { firstToken: string; cache: string; context: string } }>()

const SPRITES = import.meta.glob(['../assets/sprites/footer/prop-*.png', '../assets/sprites/footer/*-f1.png'], {
  eager: true,
  import: 'default',
  query: '?url'
}) as Record<string, string>
const sprite = (name: string) => SPRITES[`../assets/sprites/footer/${name}.png`]
/** Frame-1 still; only work and (for the two who hold bricks at t = 0) walk exist. */
const still = (id: string, kind: ActorKind) => sprite(`${id}-${kind}-f1`) ?? sprite(`${id}-work-f1`)

const CHIP_KINDS: readonly SiteChipKind[] = ['firstToken', 'speed', 'tokens', 'cost']

const box = (x: number, y: number, w: number, h: number) => ({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` })

const root = ref<HTMLElement | null>(null)
const { ready } = useSpriteSheets('footer', root)
const { time, reducedMotion } = useSceneClock(root, ready)
const animated = computed(() => ready.value && !reducedMotion.value)

const states = computed(() =>
  SITE_WORKERS.map((w) => {
    if (reducedMotion.value) return siteRestState(w)
    if (!ready.value) return { ...siteStateAt(w, 0), frame: 0 }
    return siteStateAt(w, time.value)
  })
)
/** Counting numbers (cache hit, tok/s); the targets when still or under reduced motion. */
const speeds = computed(() =>
  SITE_WORKERS.map((w) => (animated.value ? siteSpeedAt(w, SITE_PARAMS[w.id].speed, time.value) : SITE_PARAMS[w.id].speed))
)
// Still frame: the first loop's peak.
const cacheHits = computed(() => SITE_CACHE_CHIPS.map((c) => (animated.value ? cacheHitAt(c, time.value) : cachePeak(c, 0))))

const hookY = computed(() => (animated.value ? hookYAt(time.value) : SITE_HOOK.y))

const ROPE_MAX = SITE_HOOK.bottom - SITE_HOOK.ropeTop
const ropeStyle = computed(() => ({
  left: `${SITE_HOOK.ropeX}px`,
  top: `${SITE_HOOK.ropeTop}px`,
  height: `${ROPE_MAX}px`,
  transform: `scaleY(${(hookY.value - SITE_HOOK.ropeTop) / ROPE_MAX})`
}))

/** Parameter chip over the head, staggered within the team. */
const chipStyle = (w: SiteWorker, x: number) => ({
  transform: `translate(${x + SITE_CHIP_DX}px, ${SITE_FEET_Y - w.h * SPRITE_SCALE - SITE_CHIP_H - w.chipGap}px)`
})
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
.bh-ss__moving {
  left: 0;
  top: 0;
}
.bh-ss__rope {
  transform-origin: 50% 0;
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
  height: 22px; /* SITE_CHIP_H */
  padding: 0 9px;
  border: 1px solid var(--bh-night-chip-line);
  border-radius: 999px;
  background: rgba(14, 24, 48, 0.92);
  color: var(--bh-night-text);
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
}
.bh-ss__param {
  will-change: opacity;
}
.bh-ss__param.is-off {
  opacity: 0;
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
