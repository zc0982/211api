<template>
  <section id="bh-top" class="bh-hero" aria-labelledby="bh-hero-title">
    <PixelStage class="bh-hero__stage" :width="SCENE_WIDTH" :height="HERO_SCENE_HEIGHT">
      <HeroScene :switch-label="t('brandHome.hero.switched')" :credit-label="t('brandHome.hero.illustrative')" />
    </PixelStage>

    <div class="bh-container bh-hero__copy">
      <p class="bh-hero__badge bh-rise" style="--bh-i: 0">
        <i aria-hidden="true" />{{ t('brandHome.hero.badge') }}
      </p>
      <h1 id="bh-hero-title" class="bh-hero__title bh-rise" style="--bh-i: 1">
        <span>{{ t('brandHome.hero.titleLine1') }}</span>
        <i18n-t keypath="brandHome.hero.titleLine2" tag="span" scope="global">
          <template #emphasis>
            <em class="bh-hero__emphasis">{{ t('brandHome.hero.titleEmphasis') }}</em>
          </template>
        </i18n-t>
      </h1>
      <p class="bh-hero__lead bh-rise" style="--bh-i: 2">{{ t('brandHome.hero.lead') }}</p>
      <div class="bh-hero__ctas bh-rise" style="--bh-i: 3">
        <BrandButton :to="links.getKey" variant="night" arrow>{{ t('brandHome.nav.getKey') }}</BrandButton>
        <BrandButton v-if="links.docs" variant="night-outline" :href="links.docs">{{ t('brandHome.hero.ctaDocs') }}</BrandButton>
      </div>
    </div>

    <!-- The scene is decorative (aria-hidden); its tools and sample figures, as text. -->
    <div class="bh-sr-only">
      <h2>{{ t('brandHome.hero.sceneTitle') }}</h2>
      <ul>
        <li v-for="station in HERO_STATIONS" :key="station.tool">
          {{ t('brandHome.hero.stationLine', { tool: station.name, model: station.chipModel, meta: station.chipMeta }) }}
          <template v-if="station.tracked">{{ t('brandHome.hero.tracked') }}</template>
        </li>
      </ul>
      <p>{{ t('brandHome.hero.illustrative') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import PixelStage from '../components/PixelStage.vue'
import HeroScene from '../components/HeroScene.vue'
import type { HomeLinks } from '../composables/homeLinks'
import { HERO_SCENE_HEIGHT, HERO_STATIONS, SCENE_WIDTH } from '../config'

/**
 * 首屏「星链」（Figma 46:2720）：夜空像素场景按 1440 设计宽等比缩放，文案和按钮
 * 是叠在场景左上方的 HTML。860px 以下文案移到场景上方，场景整幅缩放到屏宽
 * （PR 2 再加 0.75 倍镜头平移）。首屏在两种主题下都是夜空。
 */
defineProps<{ links: HomeLinks }>()
const { t } = useI18n()
</script>

<style scoped>
.bh-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #050b18;
  color: var(--bh-night-ink);
}

/* Copy sits over the scene where Figma puts it (badge at y = 174 of 900). */
.bh-hero__copy {
  position: absolute;
  left: 0;
  right: 0;
  top: max(96px, calc(100vw * 174 / 1440));
}

.bh-hero__badge {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--bh-night-slate);
  font-size: 14px;
  line-height: 17px;
}
.bh-hero__badge i {
  width: 8px;
  height: 8px;
  background: var(--bh-night-blue);
}

.bh-hero__title {
  margin: 15px 0 0;
  max-width: 920px;
  color: var(--bh-night-ink);
  font-family: var(--bh-font-serif);
  font-size: clamp(36px, 3.9vw, 56px);
  font-weight: 600;
  line-height: 1.29;
  letter-spacing: 0.03em;
  text-wrap: balance;
}
/* Two lines: 「一个账户，」/「接入顶级编程模型。」 */
.bh-hero__title > span {
  display: block;
}
.bh-hero__emphasis {
  color: var(--bh-night-blue);
  font-style: normal;
}

.bh-hero__lead {
  margin: 20px 0 0;
  max-width: 560px;
  color: var(--bh-night-slate);
  font-size: 18px;
  line-height: 30px;
}
.bh-hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 30px;
}

@media (max-width: 860px) {
  .bh-hero__copy {
    position: static;
    order: -1;
    padding-top: 104px;
    padding-bottom: 32px;
  }
  .bh-hero__title {
    font-size: clamp(26px, 7.6vw, 40px);
  }
  .bh-hero__lead {
    font-size: 16px;
    line-height: 28px;
  }
}
</style>
