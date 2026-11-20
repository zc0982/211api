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
          <i18n-t keypath="brandHome.hero.titleLine2" tag="span" class="bh-hero__line" scope="global">
            <template #emphasis>
              <span class="bh-hero__emphasis">{{ t('brandHome.hero.titleEmphasis') }}</span>
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
          :bead-label="(v) => t('brandHome.hero.trackVendor', { vendor: VENDOR_LABEL[v] })"
          @vendor-change="(v) => (activeVendor = v)"
        >
          <template #chip>
            <ModelChip :key="trackedModel" class="bh-hero__refresh" :model="trackedModel" meta="1.24s" :label="t('brandHome.hero.trackedModel')" />
          </template>
          <template #card>
            <CodeCard
              :key="trackedModel"
              class="bh-hero__refresh"
              :label="t('brandHome.hero.codeCardLabel')"
              :base-url="baseUrl"
              :model="trackedModel"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import ArmillaryHero from '../components/ArmillaryHero.vue'
import ModelChip from '../components/ModelChip.vue'
import CodeCard from '../components/CodeCard.vue'
import type { HomeLinks } from '../composables/homeLinks'
import { HERO_VENDOR_MODELS, VENDOR_LABEL, type BrandVendor } from '../config'

const props = defineProps<{ links: HomeLinks; baseUrl: string; model: string; reducedMotion: boolean }>()
const { t } = useI18n()

/**
 * 被追踪的厂商。静态图固定 Claude；WebGL 版本在合轨时轮换、铭珠可手动切换，
 * 都通过 vendor-change 更新，Model Chip 与代码卡随之刷新 model。
 */
const activeVendor = ref<BrandVendor>('claude')
const trackedModel = computed(() =>
  activeVendor.value === 'claude' ? props.model : HERO_VENDOR_MODELS[activeVendor.value]
)
</script>

<style scoped>
.bh-hero {
  position: relative;
  overflow: hidden;
  min-height: 760px;
  height: clamp(760px, 62.5vw, 900px);
  background: var(--bh-hero-bg);
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
    linear-gradient(to right, var(--bh-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--bh-grid-line) 1px, transparent 1px);
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
  background: radial-gradient(closest-side, rgb(var(--bh-cloud-blue) / 0.3), rgb(var(--bh-cloud-blue) / 0.12) 50%, transparent);
}
.bh-hero__bloom--sky {
  left: calc(50% - 490px);
  top: -60px;
  width: 1100px;
  height: 960px;
  background: radial-gradient(closest-side, rgb(var(--bh-cloud-sky) / 0.5), rgb(var(--bh-cloud-sky) / 0.2) 50%, transparent);
}
.bh-hero__bloom--navy {
  left: calc(50% + 450px);
  top: 480px;
  width: 1340px;
  height: 800px;
  background: radial-gradient(closest-side, var(--bh-cloud-navy), var(--bh-cloud-navy-soft) 55%, transparent);
}
.bh-hero__bloom--veil {
  left: calc(50% - 190px);
  top: 90px;
  width: 1100px;
  height: 640px;
  background: radial-gradient(closest-side, var(--bh-veil), var(--bh-veil-soft) 55%, transparent);
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
  border: 1px solid var(--bh-glass-edge);
  border-radius: 999px;
  background: rgb(var(--brand-surface) / 0.55);
  color: var(--bh-slate);
  font-size: 13px;
  line-height: 18px;
  box-shadow: 0 4px 12px -8px rgb(var(--bh-shadow-navy) / min(calc(0.06 * var(--bh-shadow-k)), 0.5));
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
/* Figma 10:974: the emphasis is solid interaction blue (no gradient, no gold stroke). */
.bh-hero__emphasis {
  color: var(--bh-blue);
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

/* Chip and code card cross-fade when the tracked model changes. */
.bh-hero__refresh {
  animation: bh-hero-refresh 320ms var(--bh-ease);
}
@keyframes bh-hero-refresh {
  from {
    opacity: 0.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bh-hero__refresh {
    animation: none;
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
