<template>
  <div
    ref="boxEl"
    class="bh-armillary"
    :class="{ 'is-live': mode === 'live', 'is-drawn': staticHidden, 'is-handoff': handoff }"
    :data-armillary-mode="mode"
    :data-armillary-reason="reason || undefined"
    data-armillary-mount
  >
    <svg class="bh-armillary__orbits" viewBox="0 0 1800 680" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <ellipse cx="900" cy="340" rx="210" ry="75" stroke-opacity="0.10" />
      <ellipse cx="900" cy="340" rx="360" ry="130" stroke-opacity="0.08" />
      <ellipse cx="900" cy="340" rx="520" ry="190" stroke-opacity="0.06" />
      <ellipse cx="900" cy="340" rx="700" ry="260" stroke-opacity="0.05" />
      <ellipse cx="900" cy="340" rx="899" ry="339" stroke-opacity="0.04" />
    </svg>
    <span class="bh-armillary__glow" aria-hidden="true" />
    <span class="bh-armillary__shadow" aria-hidden="true" />
    <canvas v-if="mode !== 'static'" ref="canvasEl" class="bh-armillary__canvas" aria-hidden="true" />
    <img
      class="bh-armillary__img"
      :class="{ 'is-hidden': staticHidden }"
      :src="armillary1x"
      :srcset="`${armillary1x} 1x, ${armillary2x} 2x`"
      width="573"
      height="607"
      :alt="alt"
      fetchpriority="high"
      decoding="async"
    />

    <template v-if="mode === 'live'">
      <button
        v-for="bead in BEADS"
        :key="bead.vendor"
        :ref="(el) => setBeadEl(bead.vendor, el)"
        type="button"
        class="bh-bead"
        :class="{ 'is-traced': bead.vendor === activeVendor }"
        :style="staticHidden ? { '--bh-bead-size': `${bead.size}px` } : staticBeadStyle(bead)"
        :aria-label="beadLabel(bead.vendor)"
        :aria-pressed="bead.vendor === activeVendor"
        @pointerenter="pick(bead.vendor)"
        @focus="pick(bead.vendor)"
        @click="pick(bead.vendor)"
        @pointerleave="release"
        @blur="release"
      >
        <VendorIcon :vendor="bead.vendor" :size="Math.round(bead.size * 0.45)" />
      </button>
    </template>
    <template v-else>
      <span
        v-for="bead in BEADS"
        :key="bead.vendor"
        class="bh-bead"
        :class="{ 'is-traced': bead.vendor === STATIC_VENDOR }"
        :style="staticBeadStyle(bead)"
        aria-hidden="true"
      >
        <VendorIcon :vendor="bead.vendor" :size="Math.round(bead.size * 0.45)" />
      </span>
    </template>

    <div ref="chipEl" class="bh-armillary__chip">
      <slot name="chip" />
    </div>
    <div class="bh-armillary__card">
      <slot name="card" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import armillary1x from '../assets/hero/armillary.webp'
import armillary2x from '../assets/hero/armillary@2x.webp'
import VendorIcon from './VendorIcon.vue'
import { ARMILLARY_WEBGL, VENDOR_LABEL, type BrandVendor } from '../config'
import { canUseParallax, readDeviceProbe, staticReasonBeforeLoad, type StaticReason } from '../armillary/capability'
import type { ArmillaryController, BeadPlacement } from '../armillary/scene'

/**
 * 首屏浑天仪。先渲染静态图（Figma 10:959，合轨态，Claude 环为金槽），挂载后
 * 视设备情况动态加载 three.js（armillary/scene.ts，vendor-three 分包）。
 * WebGL 首帧画完后静态图 200ms 淡出；任何降级条件命中都保留或恢复静态图。
 *
 * 静态模式：铭珠是装饰（aria-hidden），固定追踪 Claude，与静态图一致。
 * WebGL 模式：铭珠是 <button>，悬停 / 聚焦 / 点击切换追踪对象并 emit
 * vendor-change；位置每帧由 3D 锚点投影得到，只写 transform 与 opacity。
 */
const props = withDefaults(
  defineProps<{ activeVendor?: BrandVendor; reducedMotion?: boolean; alt: string; beadLabel?: (v: BrandVendor) => string }>(),
  {
    activeVendor: 'claude',
    reducedMotion: false,
    beadLabel: (v: BrandVendor) => VENDOR_LABEL[v]
  }
)

const emit = defineEmits<{ (e: 'vendor-change', vendor: BrandVendor): void }>()

/** Vendor the static render shows in gold. */
const STATIC_VENDOR: BrandVendor = 'claude'

/** Bead centres relative to the 573×607 instrument box (Figma 10:960). */
const BEADS: readonly { vendor: BrandVendor; x: string; y: string; size: number; opacity: number }[] = [
  { vendor: 'claude', x: '29.84%', y: '31.63%', size: 42, opacity: 1 },
  { vendor: 'openai', x: '71.29%', y: '21.00%', size: 41, opacity: 0.92 },
  { vendor: 'gemini', x: '60.30%', y: '53.46%', size: 37, opacity: 0.35 },
  { vendor: 'grok', x: '34.82%', y: '59.06%', size: 39, opacity: 0.59 }
]

type Mode = 'static' | 'loading' | 'live'
const mode = ref<Mode>('static')
const reason = ref<StaticReason | null>(null)
const staticHidden = ref(false)
const handoff = ref(false)

const boxEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const chipEl = ref<HTMLElement | null>(null)
const beadEls = new Map<BrandVendor, HTMLElement>()

let controller: ArmillaryController | null = null
let io: IntersectionObserver | null = null
let inView = true
let unmounted = false
let handoffTimer = 0

type Bead = (typeof BEADS)[number]
/** Figma position; also used by the live beads until the first WebGL frame places them. */
function staticBeadStyle(bead: Bead) {
  return {
    left: bead.x,
    top: bead.y,
    '--bh-bead-size': `${bead.size}px`,
    opacity: bead.vendor === STATIC_VENDOR ? 1 : bead.opacity
  }
}

function setBeadEl(vendor: BrandVendor, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) beadEls.set(vendor, el)
  else beadEls.delete(vendor)
}

function goStatic(why: StaticReason) {
  reason.value = why
  controller?.dispose()
  controller = null
  teardownObservers()
  mode.value = 'static'
  staticHidden.value = false
  handoff.value = false
  if (props.activeVendor !== STATIC_VENDOR) emit('vendor-change', STATIC_VENDOR)
}

function pick(vendor: BrandVendor) {
  if (!controller) return
  controller.holdAutoTrack(ARMILLARY_WEBGL.manualHoldMs)
  if (vendor !== props.activeVendor) emit('vendor-change', vendor)
}

function release() {
  controller?.holdAutoTrack(ARMILLARY_WEBGL.manualHoldMs)
}

function placeBeads(beads: readonly BeadPlacement[]) {
  for (const b of beads) {
    const el = beadEls.get(b.vendor)
    if (!el) continue
    const traced = b.vendor === props.activeVendor
    const scale = 0.82 + 0.18 * b.front
    el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`
    el.style.opacity = traced ? '1' : (0.35 + 0.65 * b.front).toFixed(3)
    el.style.zIndex = traced ? '3' : b.front > 0.5 ? '2' : '1'
    if (traced && chipEl.value) {
      const size = el.offsetWidth || 40
      chipEl.value.style.transform = `translate3d(${(b.x + (size * scale) / 2 + 7).toFixed(1)}px, ${b.y.toFixed(1)}px, 0) translateY(-50%)`
    }
  }
}

function updateRunning() {
  controller?.setRunning(inView && !document.hidden)
}

function onVisibility() {
  updateRunning()
}

function teardownObservers() {
  io?.disconnect()
  io = null
  document.removeEventListener('visibilitychange', onVisibility)
}

async function start() {
  // Read the media query directly too: the parent's useReducedMotion ref may
  // not have reached this prop yet on the first tick.
  const reduced =
    props.reducedMotion ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const why = staticReasonBeforeLoad(readDeviceProbe(reduced))
  if (why) {
    reason.value = why
    return
  }
  mode.value = 'loading'
  await nextTick()
  let mod: typeof import('../armillary/scene')
  try {
    mod = await import('../armillary/scene')
  } catch {
    if (!unmounted) goStatic('no-webgl')
    return
  }
  if (unmounted || mode.value !== 'loading' || !canvasEl.value || !boxEl.value) return
  try {
    controller = mod.createArmillary({
      canvas: canvasEl.value,
      box: boxEl.value,
      tracked: props.activeVendor,
      parallax: canUseParallax(),
      callbacks: {
        onFirstFrame() {
          staticHidden.value = true
          handoff.value = true
          handoffTimer = window.setTimeout(() => (handoff.value = false), ARMILLARY_WEBGL.fadeMs)
        },
        onFallback: (r) => goStatic(r),
        onAutoTrack: (v) => emit('vendor-change', v),
        onBeads: placeBeads
      }
    })
  } catch {
    goStatic('context-failed')
    return
  }
  mode.value = 'live'
  if (import.meta.env.DEV) (window as unknown as { __armillary?: ArmillaryController }).__armillary = controller

  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1]?.isIntersecting ?? true
      updateRunning()
    })
    io.observe(boxEl.value)
  }
  document.addEventListener('visibilitychange', onVisibility)
  updateRunning()
}

watch(
  () => props.activeVendor,
  (v) => controller?.setTracked(v)
)

watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced && mode.value !== 'static') goStatic('reduced-motion')
  }
)

onMounted(() => {
  // useReducedMotion resolves in its own onMounted; read it after this tick.
  void nextTick(start)
})

onBeforeUnmount(() => {
  unmounted = true
  window.clearTimeout(handoffTimer)
  teardownObservers()
  controller?.dispose()
  controller = null
  if (import.meta.env.DEV) delete (window as unknown as { __armillary?: ArmillaryController }).__armillary
})
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
  stroke: var(--bh-orbit-stroke);
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
  background: radial-gradient(closest-side, var(--bh-core-glow), var(--bh-core-glow-soft) 55%, transparent);
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
  background: radial-gradient(
    closest-side,
    rgb(var(--bh-shadow-navy) / min(calc(0.22 * var(--bh-shadow-k)), 0.5)),
    rgb(var(--bh-shadow-navy) / min(calc(0.08 * var(--bh-shadow-k)), 0.5)) 55%,
    rgb(var(--bh-shadow-navy) / 0)
  );
}
/*
 * The canvas is the 573×607 instrument area grown by 10% per side
 * (scene.ts CANVAS_OVERHANG). Sized from the width only: on narrow screens the
 * code card sits inside the box and makes it taller than the instrument.
 * margin-top in % resolves against the width.
 */
.bh-armillary__canvas {
  position: absolute;
  left: -10%;
  top: 0;
  width: 120%;
  aspect-ratio: 573 / 607;
  margin-top: calc(-10% * 607 / 573);
  pointer-events: none;
}
.bh-armillary__img {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
  transition: opacity 200ms linear;
}
.bh-armillary__img.is-hidden {
  opacity: 0;
}

.bh-bead {
  position: absolute;
  display: grid;
  place-items: center;
  width: var(--bh-bead-size);
  height: var(--bh-bead-size);
  padding: 0;
  transform: translate(-50%, -50%);
  border: 1px solid var(--bh-glass-edge);
  border-radius: 50%;
  background: rgb(var(--brand-surface) / 0.82);
  box-shadow: 0 4px 14px rgb(var(--bh-shadow-navy) / min(calc(0.12 * var(--bh-shadow-k)), 0.5));
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
button.bh-bead {
  cursor: pointer;
  will-change: transform, opacity;
  transition:
    border-color 160ms ease-out,
    box-shadow 160ms ease-out;
}
.is-drawn button.bh-bead {
  left: 0;
  top: 0;
}
button.bh-bead:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 3px;
}
.bh-bead.is-traced {
  border-color: var(--bh-gold);
  box-shadow:
    0 0 0 4px rgb(var(--brand-gold) / 0.14),
    0 6px 18px rgb(var(--bh-shadow-navy) / min(calc(0.14 * var(--bh-shadow-k)), 0.5));
}
.is-handoff button.bh-bead,
.is-handoff .bh-armillary__chip {
  animation: bh-armillary-in 200ms linear;
}
@keyframes bh-armillary-in {
  from {
    opacity: 0;
  }
}

/* Model Chip: left edge just right of the traced bead, vertically centred on it. */
.bh-armillary__chip {
  position: absolute;
  z-index: 4;
  left: 34.73%;
  top: 31.63%;
  transform: translateY(-50%);
}
.is-drawn .bh-armillary__chip {
  left: 0;
  top: 0;
  will-change: transform;
}
/* Code card: centred under the instrument base (Figma 10:970). */
.bh-armillary__card {
  position: absolute;
  z-index: 4;
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
