<template>
  <section id="bh-top" class="bh-hero" aria-labelledby="bh-hero-title">
    <div class="bh-hero__sky" aria-hidden="true">
      <span class="bh-hero__grid" />
      <span class="bh-blob bh-blob--a bh-hero__bloom bh-hero__bloom--blue" />
      <span class="bh-blob bh-blob--b bh-hero__bloom bh-hero__bloom--sky" />
      <span class="bh-blob bh-blob--c bh-hero__bloom bh-hero__bloom--navy" />
      <span class="bh-blob bh-blob--b bh-hero__bloom bh-hero__bloom--veil" />
    </div>

    <div class="bh-container bh-hero__inner">
      <div class="bh-hero__copy">
        <p class="bh-hero__badge bh-rise" style="--bh-i: 0">
          <i aria-hidden="true" />{{ t('brandHome.hero.badge') }}
        </p>
        <h1 id="bh-hero-title" class="bh-hero__title bh-rise" style="--bh-i: 1">
          <span class="bh-hero__line">{{ t('brandHome.hero.titleLine1') }}</span>
          <i18n-t keypath="brandHome.hero.titleLine2" tag="span" class="bh-hero__line bh-hero__line--accent" scope="global">
            <template #emphasis>
              <span class="bh-hero__emphasis">
                {{ t('brandHome.hero.titleEmphasis') }}<svg
                  class="bh-hero__stroke"
                  viewBox="0 0 93 14"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                ><path
                  d="M0.404297 11.5285C32.4964 3.90629 64.6643 6.08407 92.2043 1.72852"
                /></svg>
              </span>
            </template>
          </i18n-t>
        </h1>
        <p class="bh-hero__lead bh-rise" style="--bh-i: 2">{{ t('brandHome.hero.lead') }}</p>
        <div class="bh-hero__ctas bh-rise" style="--bh-i: 3">
          <BrandButton :to="links.getKey" arrow>{{ t('brandHome.nav.getKey') }}</BrandButton>
          <BrandButton v-if="links.docs" variant="glass" :href="links.docs">{{ t('brandHome.hero.ctaDocs') }}</BrandButton>
        </div>
      </div>

      <div class="bh-hero__stage bh-rise" style="--bh-i: 2">
        <ArmillaryHero
          :alt="t('brandHome.hero.armillaryAlt')"
          :active-vendor="activeVendor"
          :reduced-motion="reducedMotion"
          @vendor-change="(v) => (activeVendor = v)"
        >
          <template #chip>
            <ModelChip :model="model" meta="1.24s" :label="t('brandHome.hero.trackedModel')" />
          </template>
          <template #card>
            <CodeCard
              :label="t('brandHome.hero.codeCardLabel')"
              :base-url="baseUrl"
              :model="model"
              status="200 ·"
              status-meta="286 ms"
            />
          </template>
        </ArmillaryHero>
      </div>

      <div class="bh-hero__foot">
        <p class="bh-hero__trust">
          <span>{{ t('brandHome.hero.providersLabel') }}</span>
          <span class="bh-mono bh-hero__num">{{ t('brandHome.hero.providersValue') }}</span>
        </p>
        <p class="bh-hero__credit">
          {{ t('brandHome.hero.credit') }}<span class="bh-hero__note"> · {{ t('brandHome.hero.illustrative') }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import ArmillaryHero from '../components/ArmillaryHero.vue'
import ModelChip from '../components/ModelChip.vue'
import CodeCard from '../components/CodeCard.vue'
import type { HomeLinks } from '../composables/homeLinks'
import type { BrandVendor } from '../config'

defineProps<{ links: HomeLinks; baseUrl: string; model: string; reducedMotion: boolean }>()
const { t } = useI18n()

/** 静态图固定追踪 Claude；WebGL 版本通过 vendor-change 更新。 */
const activeVendor = ref<BrandVendor>('claude')
</script>

<style scoped>
.bh-hero {
  position: relative;
  overflow: hidden;
  min-height: 760px;
  height: clamp(760px, 62.5vw, 900px);
  background: linear-gradient(to bottom, #f7faff 0%, #edf3fd 50%, #f5f8fe 100%);
}

/* Atmosphere: 5 cloud blooms + 96px grid, laid out on the 1440 artboard. */
.bh-hero__sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bh-hero__grid {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2880px;
  margin-left: -1440px;
  background-image:
    linear-gradient(to right, rgba(20, 48, 107, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(20, 48, 107, 0.05) 1px, transparent 1px);
  background-size: 96px 96px;
  background-position: 0 72px;
}
.bh-hero__bloom {
  margin-left: -720px;
}
.bh-hero__bloom--blue {
  left: calc(50% + 580px);
  top: -410px;
  width: 1200px;
  height: 900px;
  background: radial-gradient(closest-side, rgba(47, 95, 208, 0.3), rgba(47, 95, 208, 0.12) 50%, transparent);
}
.bh-hero__bloom--sky {
  left: calc(50% - 490px);
  top: -60px;
  width: 1100px;
  height: 960px;
  background: radial-gradient(closest-side, rgba(141, 182, 242, 0.5), rgba(141, 182, 242, 0.2) 50%, transparent);
}
.bh-hero__bloom--navy {
  left: calc(50% + 450px);
  top: 480px;
  width: 1340px;
  height: 800px;
  background: radial-gradient(closest-side, rgba(20, 48, 107, 0.2), rgba(20, 48, 107, 0.07) 55%, transparent);
}
.bh-hero__bloom--veil {
  left: calc(50% - 190px);
  top: 90px;
  width: 1100px;
  height: 640px;
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.35) 55%, transparent);
}

.bh-hero__inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 573px);
  align-items: center;
  column-gap: 32px;
  height: 100%;
  padding-top: 72px;
  padding-bottom: 72px;
}
.bh-hero__copy {
  position: relative;
  z-index: 2;
  max-width: 560px;
}
.bh-hero__stage {
  position: relative;
  z-index: 1;
  justify-self: end;
  width: 100%;
  margin-top: -36px;
  margin-right: 3px;
}

.bh-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  color: var(--bh-slate);
  font-size: 13px;
  line-height: 18px;
  box-shadow: 0 4px 12px -8px rgba(20, 48, 107, 0.06);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-hero__badge i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bh-gold);
}

.bh-hero__title {
  margin: 28px 0 0;
  font-family: var(--bh-font-serif);
  font-size: clamp(36px, 3.4vw, 52px);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.03em;
  color: var(--bh-ink);
}
.bh-hero__line {
  display: block;
}
.bh-hero__line--accent {
  background: linear-gradient(90deg, var(--bh-navy), var(--bh-blue));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  width: fit-content;
}
.bh-hero__emphasis {
  position: relative;
  display: inline-block;
}
.bh-hero__stroke {
  position: absolute;
  left: 0;
  bottom: -0.16em;
  width: 100%;
  height: 0.28em;
  overflow: visible;
  clip-path: inset(-50% 100% -50% 0);
  animation: bh-reveal 600ms ease-out 560ms forwards;
}
@keyframes bh-reveal {
  to {
    clip-path: inset(-50% 0 -50% 0);
  }
}
.bh-hero__stroke path {
  fill: none;
  stroke: var(--bh-gold);
  stroke-width: 3.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.bh-hero__lead {
  margin: 22px 0 0;
  max-width: 540px;
  color: var(--bh-slate);
  font-size: 18px;
  line-height: 30px;
}
.bh-hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 36px;
}

.bh-hero__foot {
  position: absolute;
  left: var(--bh-gutter);
  right: var(--bh-gutter);
  bottom: 40px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  pointer-events: none;
}
.bh-hero__trust,
.bh-hero__credit {
  margin: 0;
  pointer-events: auto;
}
.bh-hero__trust {
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  color: var(--bh-slate);
  font-size: 13px;
  line-height: 17px;
}
.bh-hero__num {
  color: var(--bh-navy);
  font-weight: 500;
}
.bh-hero__credit {
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 17px;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .bh-hero__stroke {
    animation: none;
    clip-path: none;
  }
}

@media (max-width: 1100px) and (min-width: 861px) {
  .bh-hero__stage {
    margin-top: -20px;
  }
}

@media (max-width: 860px) {
  .bh-hero {
    height: auto;
    min-height: 0;
  }
  .bh-hero__inner {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    row-gap: 40px;
    padding-top: 104px;
    padding-bottom: 32px;
    text-align: center;
  }
  .bh-hero__copy {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .bh-hero__title {
    font-size: clamp(26px, 7.6vw, 40px);
    margin-top: 20px;
  }
  .bh-hero__line--accent {
    margin: 0 auto;
  }
  .bh-hero__lead {
    font-size: 16px;
    line-height: 28px;
  }
  .bh-hero__ctas {
    justify-content: center;
    gap: 16px;
  }
  .bh-hero__stage {
    justify-self: center;
    margin: 0;
    max-width: 360px;
  }
  .bh-hero__foot {
    position: static;
    grid-column: 1;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .bh-hero__trust {
    display: none;
  }
  .bh-hero__credit {
    text-align: center;
  }
}
</style>
