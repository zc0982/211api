<template>
  <div class="bh-armillary" data-armillary-mount>
    <svg class="bh-armillary__orbits" viewBox="0 0 1800 680" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <ellipse cx="900" cy="340" rx="210" ry="75" stroke-opacity="0.10" />
      <ellipse cx="900" cy="340" rx="360" ry="130" stroke-opacity="0.08" />
      <ellipse cx="900" cy="340" rx="520" ry="190" stroke-opacity="0.06" />
      <ellipse cx="900" cy="340" rx="700" ry="260" stroke-opacity="0.05" />
      <ellipse cx="900" cy="340" rx="899" ry="339" stroke-opacity="0.04" />
    </svg>
    <span class="bh-armillary__glow" aria-hidden="true" />
    <span class="bh-armillary__shadow" aria-hidden="true" />
    <img
      class="bh-armillary__img"
      :src="armillary1x"
      :srcset="`${armillary1x} 1x, ${armillary2x} 2x`"
      width="573"
      height="607"
      :alt="alt"
      fetchpriority="high"
      decoding="async"
    />
    <span
      v-for="bead in BEADS"
      :key="bead.vendor"
      class="bh-bead"
      :class="{ 'is-traced': bead.vendor === activeVendor }"
      :style="{ left: bead.x, top: bead.y, '--bh-bead-size': `${bead.size}px`, opacity: bead.vendor === activeVendor ? 1 : bead.opacity }"
      aria-hidden="true"
    >
      <VendorIcon :vendor="bead.vendor" :size="Math.round(bead.size * 0.45)" />
    </span>
    <div class="bh-armillary__chip">
      <slot name="chip" />
    </div>
    <div class="bh-armillary__card">
      <slot name="card" />
    </div>
  </div>
</template>

<script setup lang="ts">
import armillary1x from '../assets/hero/armillary.webp'
import armillary2x from '../assets/hero/armillary@2x.webp'
import VendorIcon from './VendorIcon.vue'
import type { BrandVendor } from '../config'

/**
 * 首屏浑天仪。本 PR 只渲染静态图（Figma 10:959，合轨态，Claude 环为金槽）；
 * WebGL 版本在后续 PR 通过同一组件接口接入：
 *   props: activeVendor（被追踪的厂商）、reducedMotion
 *   emits: vendor-change
 * 铭珠、Model Chip、代码卡、接地阴影是 HTML 叠加层，坐标取自 Figma 绝对坐标
 * （以 573×607 的仪器框为基准换算成百分比）。
 */
withDefaults(defineProps<{ activeVendor?: BrandVendor; reducedMotion?: boolean; alt: string }>(), {
  activeVendor: 'claude',
  reducedMotion: false
})

defineEmits<{ (e: 'vendor-change', vendor: BrandVendor): void }>()

/** Bead centres relative to the 573×607 instrument box (Figma 10:960). */
const BEADS: readonly { vendor: BrandVendor; x: string; y: string; size: number; opacity: number }[] = [
  { vendor: 'claude', x: '29.84%', y: '31.63%', size: 42, opacity: 1 },
  { vendor: 'openai', x: '71.29%', y: '21.00%', size: 41, opacity: 0.92 },
  { vendor: 'gemini', x: '60.30%', y: '53.46%', size: 37, opacity: 0.35 },
  { vendor: 'grok', x: '34.82%', y: '59.06%', size: 39, opacity: 0.59 }
]
</script>

<style scoped>
.bh-armillary {
  position: relative;
  width: 100%;
  max-width: 573px;
  aspect-ratio: 573 / 607;
}
.bh-armillary__orbits {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 314%;
  transform: translate(-50%, -50%);
  overflow: visible;
  fill: none;
  stroke: var(--bh-navy);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.bh-armillary__orbits ellipse {
  vector-effect: non-scaling-stroke;
}
.bh-armillary__glow {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 150%;
  height: 76%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(233, 199, 123, 0.34), rgba(233, 199, 123, 0.12) 55%, transparent);
  pointer-events: none;
}
.bh-armillary__shadow {
  position: absolute;
  left: 49.91%;
  top: 97.03%;
  width: 41.9%;
  height: 5.93%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(20, 48, 107, 0.22), rgba(20, 48, 107, 0.08) 55%, rgba(20, 48, 107, 0));
}
.bh-armillary__img {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

.bh-bead {
  position: absolute;
  display: grid;
  place-items: center;
  width: var(--bh-bead-size);
  height: var(--bh-bead-size);
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 4px 14px rgba(20, 48, 107, 0.12);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.bh-bead.is-traced {
  border-color: var(--bh-gold);
  box-shadow:
    0 0 0 4px rgba(212, 168, 75, 0.14),
    0 6px 18px rgba(20, 48, 107, 0.14);
}

/* Model Chip: left edge just right of the traced bead, vertically centred on it. */
.bh-armillary__chip {
  position: absolute;
  left: 34.73%;
  top: 31.63%;
  transform: translateY(-50%);
}
/* Code card: centred under the instrument base (Figma 10:970). */
.bh-armillary__card {
  position: absolute;
  left: 49.91%;
  top: 99%;
  transform: translateX(-50%);
}

@media (max-width: 860px) {
  .bh-armillary__chip {
    display: none;
  }
  .bh-armillary__card {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    display: flex;
    justify-content: center;
    margin-top: -18px;
  }
}
</style>
