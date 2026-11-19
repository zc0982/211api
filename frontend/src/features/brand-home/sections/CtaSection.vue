<template>
  <section class="bh-cta-wrap" aria-labelledby="bh-cta-title">
    <div class="bh-container">
      <div class="bh-cta">
        <div class="bh-cta__art" aria-hidden="true">
          <span class="bh-cta__glow bh-cta__glow--blue" />
          <span class="bh-cta__glow bh-cta__glow--lens" />
          <span class="bh-cta__glow bh-cta__glow--gold" />
          <span class="bh-cta__grid" />
          <span class="bh-cta__orbit" style="--d: 300px" />
          <span class="bh-cta__orbit" style="--d: 440px; opacity: 0.7" />
          <span class="bh-cta__orbit" style="--d: 620px; opacity: 0.5" />
          <svg class="bh-cta__trace" viewBox="0 0 1200 440" preserveAspectRatio="xMinYMin slice">
            <defs>
              <linearGradient id="bh-cta-gold" x1="309" y1="300" x2="1097" y2="300" gradientUnits="userSpaceOnUse">
                <stop stop-color="#D4A84B" stop-opacity="0.35" />
                <stop offset="0.5" stop-color="#D4A84B" stop-opacity="0.9" />
                <stop offset="1" stop-color="#D4A84B" />
              </linearGradient>
            </defs>
            <path
              id="bh-cta-path"
              class="bh-cta__line bh-motion"
              d="M309 221C381 221 381 385 471 385H961C1061 385 1091 301 1097 215"
              pathLength="1"
            />
            <circle class="bh-cta__dest-ring" cx="1096" cy="208" r="12" />
            <circle cx="1096" cy="208" r="4" fill="#D4A84B" />
            <g :transform="reducedMotion ? 'translate(840 385)' : undefined">
              <circle r="22" fill="#D4A84B" fill-opacity="0.3" filter="url(#bh-cta-blur)" />
              <circle r="4" fill="#fff" stroke="#D4A84B" stroke-width="2" />
              <animateMotion v-if="!reducedMotion" dur="2.4s" repeatCount="indefinite" calcMode="linear">
                <mpath href="#bh-cta-path" />
              </animateMotion>
            </g>
            <filter id="bh-cta-blur" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="6" /></filter>
          </svg>
          <span class="bh-cta__tag bh-mono"><b>200 OK</b> 312ms</span>
          <span class="bh-cta__lens">
            <span class="bh-cta__lens-ring" />
            <BrandLogo inverse class="bh-cta__mark" />
          </span>
        </div>

        <div class="bh-cta__copy">
          <h2 id="bh-cta-title" class="bh-cta__title">{{ t('brandHome.cta.title') }}</h2>
          <p class="bh-cta__sub">{{ t('brandHome.cta.subtitle') }}</p>
          <div class="bh-cta__actions">
            <BrandButton variant="inverse" :to="links.getKey" arrow>{{ t('brandHome.nav.getKey') }}</BrandButton>
            <BrandButton v-if="links.docs" variant="ghost-inverse" :href="links.docs">{{ t('brandHome.cta.docs') }}</BrandButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import BrandLogo from '../components/BrandLogo.vue'
import type { HomeLinks } from '../composables/homeLinks'

/** 最终 CTA（Figma 1:3661）。金线与「200 OK 312ms」标签是装饰，数值为示意。 */
defineProps<{ links: HomeLinks; reducedMotion: boolean }>()
const { t } = useI18n()
</script>

<style scoped>
.bh-cta-wrap {
  padding: 24px 0 96px;
}
.bh-cta {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 440px;
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(110deg, #102857 0%, #14306b 50%, #2f5fd0 100%);
  box-shadow: 0 24px 56px -16px rgba(20, 48, 107, 0.22);
  isolation: isolate;
}
.bh-cta__art {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.bh-cta__glow {
  position: absolute;
  border-radius: 50%;
}
.bh-cta__glow--blue {
  left: 620px;
  top: -300px;
  width: 900px;
  height: 700px;
  background: radial-gradient(closest-side, rgba(47, 95, 208, 0.55), rgba(47, 95, 208, 0.2) 55%, transparent);
}
.bh-cta__glow--lens {
  left: -80px;
  top: -60px;
  width: 600px;
  height: 560px;
  background: radial-gradient(closest-side, rgba(47, 95, 208, 0.35), transparent);
}
.bh-cta__glow--gold {
  left: 920px;
  top: 60px;
  width: 360px;
  height: 320px;
  background: radial-gradient(closest-side, rgba(212, 168, 75, 0.18), transparent);
}
.bh-cta__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  background-position: 48px 40px;
}
.bh-cta__orbit {
  position: absolute;
  left: 220px;
  top: 220px;
  width: var(--d);
  height: var(--d);
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}
.bh-cta__trace {
  position: absolute;
  left: 0;
  top: 0;
  width: 1200px;
  height: 440px;
}
.bh-cta__line {
  fill: none;
  stroke: url(#bh-cta-gold);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: bh-draw 900ms ease-out 200ms forwards;
}
.bh-cta__dest-ring {
  fill: rgba(212, 168, 75, 0.18);
  stroke: #d4a84b;
  stroke-width: 1.5;
}
.bh-cta__tag {
  position: absolute;
  left: 960px;
  top: 226px;
  display: inline-flex;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 16px;
}
.bh-cta__tag b {
  font-weight: 400;
  color: #bfe8d2;
}
.bh-cta__lens {
  position: absolute;
  left: 132px;
  top: 132px;
  display: grid;
  place-items: center;
  width: 176px;
  height: 176px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}
.bh-cta__lens-ring {
  position: absolute;
  inset: 21px;
  border: 1.2px solid var(--bh-gold);
  border-radius: 50%;
}
.bh-cta__mark :deep(.bh-logo__mark) {
  width: 66px;
  height: 50px;
}

.bh-cta__copy {
  position: relative;
  max-width: 600px;
  margin-left: 420px;
  padding: 48px 32px 48px 0;
}
.bh-cta__title {
  margin: 0;
  color: #fff;
  font-family: var(--bh-font-serif);
  font-size: 40px;
  font-weight: 600;
  line-height: 52px;
  text-wrap: balance;
}
.bh-cta__sub {
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 18px;
  line-height: 30px;
}
.bh-cta__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

@media (prefers-reduced-motion: reduce) {
  .bh-cta__line {
    animation: none;
    stroke-dashoffset: 0;
  }
}

@media (max-width: 1100px) {
  .bh-cta__lens,
  .bh-cta__orbit,
  .bh-cta__trace,
  .bh-cta__tag {
    display: none;
  }
  .bh-cta__copy {
    margin: 0 auto;
    padding: 56px 32px;
    text-align: center;
  }
  .bh-cta__actions {
    justify-content: center;
  }
}
@media (max-width: 860px) {
  .bh-cta-wrap {
    padding: 0 0 64px;
  }
  .bh-cta {
    min-height: 0;
    border-radius: 24px;
  }
  .bh-cta__copy {
    padding: 48px 20px;
  }
  .bh-cta__title {
    font-size: 28px;
    line-height: 38px;
  }
  .bh-cta__sub {
    font-size: 16px;
    line-height: 26px;
  }
}
</style>
