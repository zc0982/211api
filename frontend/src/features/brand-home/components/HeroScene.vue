<template>
  <div class="bh-hs">
    <div class="bh-hs__sky" />
    <img class="bh-hs__layer" :src="starsUrl" alt="" width="1440" height="742" decoding="async" />
    <div class="bh-hs__haze" />
    <div class="bh-hs__moon-glow" />

    <svg class="bh-hs__orbits" viewBox="0 0 1440 900" width="1440" height="900">
      <circle :cx="MOON.cx" :cy="MOON.cy" r="105" stroke-opacity="0.12" />
      <circle :cx="MOON.cx" :cy="MOON.cy" r="160" stroke-opacity="0.08" stroke-dasharray="2 6" />
      <circle :cx="MOON.cx" :cy="MOON.cy" r="225" stroke-opacity="0.05" />
    </svg>

    <img
      class="bh-hs__layer bh-pixel"
      :src="skylineUrl"
      alt=""
      width="1440"
      height="318"
      decoding="async"
      :style="{ top: '582px' }"
    />

    <!-- Gold glow on the ground under the tracked station. -->
    <span class="bh-hs__ground-glow" />

    <svg class="bh-hs__traces" viewBox="0 0 1440 900" width="1440" height="900">
      <path
        v-for="trace in traces"
        :key="trace.tool"
        :d="trace.d"
        :class="{ 'is-tracked': trace.tracked }"
        :stroke-opacity="trace.tracked ? 1 : trace.opacity"
      />
    </svg>

    <span class="bh-hs__halo" />
    <span class="bh-hs__moon">
      <svg viewBox="10 15 44 33" width="36" height="27" aria-hidden="true">
        <path d="M32 17.5L52 28L32 38.5L12 28L32 17.5Z" fill="#14306B" />
        <path d="M20.75 34.22L32 40.125L43.25 34.22V42.16L32 46.375L20.75 42.16V34.22Z" fill="#14306B" />
        <path
          d="M45.6543 32.7383L45.9746 32.9072V40.125H44.7754V33.6328L31.7207 26.7812L32.2793 25.7188L45.6543 32.7383Z"
          fill="#D4A84B"
        />
        <circle cx="32" cy="26.25" r="1.5" fill="#D4A84B" />
        <circle cx="45.375" cy="40.125" r="1.55" fill="#D4A84B" />
      </svg>
    </span>

    <!-- 429 → switched marker on the Codex trace (t = 0.5). -->
    <span class="bh-hs__switch" :style="{ left: `${marker.x - 6}px`, top: `${marker.y - 6}px` }">
      <i />
      <span class="bh-hs__chip bh-hs__chip--switch">
        <b class="bh-mono">429</b><span>{{ switchLabel }}</span>
      </span>
    </span>

    <span class="bh-hs__dot" :style="{ left: `${GOLD_DOT.x - 12}px`, top: `${GOLD_DOT.y - 12}px` }" />

    <template v-for="station in stations" :key="station.tool">
      <img
        class="bh-hs__sprite bh-pixel"
        :src="sprite(`prop-${station.prop}`)"
        alt=""
        :width="station.box.width"
        :height="station.box.height"
        decoding="async"
        :style="boxStyle(station.box)"
      />
      <span
        class="bh-hs__chip"
        :class="{ 'is-tracked': station.tracked, 'is-dim': station.dim }"
        :style="{ left: `${station.chipX}px`, top: `${station.chipY}px`, width: `${station.chipW}px` }"
      >
        <i v-if="!station.tracked" class="bh-hs__ok" />
        <span class="bh-mono bh-hs__model">{{ station.chipModel }}</span>
        <span class="bh-mono bh-hs__meta">{{ station.chipMeta }}</span>
      </span>
      <span class="bh-hs__label" :style="{ left: `${station.box.left + station.box.width / 2}px` }">{{ station.name }}</span>
    </template>

    <template v-for="character in characters" :key="character.id">
      <img
        class="bh-hs__sprite bh-pixel"
        :src="sprite(`${character.id}-work-f1`)"
        alt=""
        :width="character.box.width"
        :height="character.box.height"
        decoding="async"
        :style="boxStyle(character.box)"
      />
      <span
        class="bh-hs__badge"
        :style="{ left: `${character.box.left + character.box.width - 6}px`, top: `${character.box.top + 8}px` }"
      >
        <VendorIcon v-if="'vendor' in character.badge" :vendor="character.badge.vendor" :size="12" />
        <ToolIcon v-else :tool="character.badge.tool" :size="12" />
      </span>
    </template>

    <span class="bh-hs__credit">{{ creditLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VendorIcon from './VendorIcon.vue'
import ToolIcon from './ToolIcon.vue'
import starsUrl from '../assets/scene/hero-stars.svg?url'
import skylineUrl from '../assets/scene/hero-skyline.svg?url'
import { GOLD_DOT, HERO_CHARACTERS, HERO_STATIONS, MOON, SWITCH_MARKER_TOOL } from '../config'
import { characterBox, chipAnchor, pointOnTrace, propBox, traceFor, tracePath } from '../composables/starlink'

/**
 * 首屏「星链」夜空场景（Figma 46:2720）的第 0 秒静态画面，画在 1440×900 的
 * 设计坐标里，由 PixelStage 等比缩放。月亮到每个工位状态牌一条连线，只有
 * 被追踪的 Claude Code 是金线。场景整体 aria-hidden，工位与数值的可读文本在
 * HeroStarlink 的读屏列表里。两种主题下都不变。
 */
defineProps<{ switchLabel: string; creditLabel: string }>()

const SPRITES = import.meta.glob('../assets/sprites/hero/*.png', { eager: true, import: 'default', query: '?url' }) as Record<
  string,
  string
>
const sprite = (name: string) => SPRITES[`../assets/sprites/hero/${name}.png`]

type Box = { left: number; top: number; width: number; height: number }
const boxStyle = (b: Box) => ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })

const stations = HERO_STATIONS.map((s) => ({ ...s, box: propBox(s) }))
const characters = HERO_CHARACTERS.map((c) => ({ ...c, box: characterBox(c) }))

const traces = computed(() =>
  // Tracked trace last so it draws on top.
  [...HERO_STATIONS]
    .sort((a, b) => Number(!!a.tracked) - Number(!!b.tracked))
    .map((s) => ({
      tool: s.tool,
      tracked: !!s.tracked,
      opacity: s.traceOpacity ?? 0.34,
      d: tracePath(traceFor(chipAnchor(s)))
    }))
)

const switchStation = HERO_STATIONS.find((s) => s.tool === SWITCH_MARKER_TOOL)!
const marker = pointOnTrace(traceFor(chipAnchor(switchStation)), 0.5)
</script>

<style scoped>
.bh-hs {
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--bh-font-sans);
}
.bh-hs > * {
  position: absolute;
}
.bh-hs__sky {
  inset: 0;
  background: var(--bh-night-sky);
}
.bh-hs__layer {
  left: 0;
  top: 0;
  max-width: none;
}
.bh-hs__haze {
  left: 0;
  top: 520px;
  width: 1440px;
  height: 316px;
  background: linear-gradient(to bottom, rgba(29, 51, 102, 0), rgba(29, 51, 102, 0.45));
}
.bh-hs__moon-glow {
  left: 760px;
  top: -80px;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(122, 162, 255, 0.24), rgba(122, 162, 255, 0.07) 40%, rgba(122, 162, 255, 0));
}
.bh-hs__orbits,
.bh-hs__traces {
  left: 0;
  top: 0;
  overflow: visible;
}
.bh-hs__orbits circle {
  fill: none;
  stroke: #a9c1f0;
  stroke-width: 1;
}
.bh-hs__traces path {
  fill: none;
  stroke: var(--bh-night-blue);
  stroke-width: 1.25;
}
.bh-hs__traces path.is-tracked {
  stroke: var(--bh-night-gold);
  stroke-width: 1.75;
  filter: drop-shadow(0 0 4px rgba(227, 185, 94, 0.9));
}
.bh-hs__ground-glow {
  left: 86px;
  top: 824px;
  width: 110px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(227, 185, 94, 0.4), rgba(227, 185, 94, 0));
}
.bh-hs__halo {
  left: 970px;
  top: 130px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(219, 230, 251, 0.38), rgba(219, 230, 251, 0.08) 50%, rgba(219, 230, 251, 0));
}
.bh-hs__moon {
  left: 1018px;
  top: 178px;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #f2f5fb;
  box-shadow: 0 0 28px rgba(219, 230, 251, 0.45);
}
.bh-hs__sprite {
  max-width: none;
}

/* Status chips: capsule 24px, #0e1830 92%, 1px #2b4170 (tracked: gold). */
.bh-hs__chip {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--bh-night-chip-line);
  border-radius: 999px;
  background: rgba(14, 24, 48, 0.92);
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
}
.bh-hs__chip.is-tracked {
  border-color: var(--bh-night-gold);
}
.bh-hs__chip.is-dim {
  opacity: 0.45;
}
.bh-hs__ok {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bh-night-ok);
}
.bh-hs__model {
  color: var(--bh-night-text);
}
.bh-hs__meta {
  color: var(--bh-night-mist);
}
.bh-hs__chip.is-tracked .bh-hs__model {
  color: var(--bh-night-ink);
  font-weight: 500;
}
.bh-hs__chip.is-tracked .bh-hs__meta {
  color: var(--bh-night-bronze);
  font-weight: 500;
}

.bh-hs__label {
  top: 848px;
  transform: translateX(-50%);
  color: var(--bh-night-text);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.bh-hs__badge {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 1px solid var(--bh-night-chip-line);
  border-radius: 50%;
  background: var(--bh-night-ink);
  --bh-ink: #0c1830;
}

.bh-hs__switch {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bh-hs__switch > i {
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 1.5px solid var(--bh-night-bronze);
  border-radius: 50%;
  background: var(--bh-night-card);
}
.bh-hs__chip--switch {
  position: static;
  padding: 0 11px;
  gap: 6px;
  color: var(--bh-night-slate);
  font-size: 12px;
}
.bh-hs__chip--switch b {
  color: var(--bh-night-bronze);
  font-size: 11px;
  font-weight: 500;
}

.bh-hs__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(227, 185, 94, 0.22);
}
.bh-hs__dot::after {
  content: '';
  position: absolute;
  left: 8px;
  top: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f3d58e;
  box-shadow: 0 0 10px rgba(227, 185, 94, 0.9);
}

.bh-hs__credit {
  right: 120px;
  top: 874px;
  color: var(--bh-night-mist);
  font-size: 12px;
  line-height: 14px;
}
</style>
