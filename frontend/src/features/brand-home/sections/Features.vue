<template>
  <section v-reveal class="bh-on-canvas bh-feat" aria-labelledby="bh-feat-title">
    <div class="bh-container">
      <div class="bh-feat__rule">
        <h2 id="bh-feat-title" class="bh-sr-only">{{ t('brandHome.features.title') }}</h2>
        <ul class="bh-feat__list" data-reveal style="--bh-i: 0">
          <li v-for="item in items" :key="item.key">
            <h3 class="bh-feat__title"><i class="bh-pixel-mark" aria-hidden="true" />{{ item.title }}</h3>
            <p class="bh-feat__desc">{{ item.desc }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { vReveal } from '../composables/vReveal'

/**
 * 核心能力 · 四栏（Figma 46:3747）：顶部一条细线，四栏短句，8px 像素方块作标记。
 * 设计稿没有区块标题，这里给读屏补一个视觉隐藏的 h2。文案按核对表改写过。
 */
const { t } = useI18n()

const items = computed(() => [
  { key: 'unified', title: t('brandHome.features.unifiedTitle'), desc: t('brandHome.features.unifiedDesc') },
  { key: 'routing', title: t('brandHome.features.routingTitle'), desc: t('brandHome.features.routingDesc') },
  { key: 'billing', title: t('brandHome.features.billingTitle'), desc: t('brandHome.features.billingDesc') },
  { key: 'access', title: t('brandHome.features.accessTitle'), desc: t('brandHome.features.accessDesc') }
])
</script>

<style scoped>
.bh-feat {
  padding-bottom: 120px;
}
.bh-feat__rule {
  padding-top: 72px;
  border-top: 1px solid var(--bh-line);
}
.bh-feat__list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px 54px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-feat__title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--bh-ink);
  font-size: 17px;
  font-weight: 500;
  line-height: 20px;
}
.bh-feat__desc {
  margin: 12px 0 0 18px;
  max-width: 252px;
  color: var(--bh-slate);
  font-size: 15px;
  line-height: 24px;
}
@media (max-width: 1100px) {
  .bh-feat__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .bh-feat {
    padding-bottom: 72px;
  }
  .bh-feat__rule {
    padding-top: 48px;
  }
  .bh-feat__list {
    grid-template-columns: minmax(0, 1fr);
  }
  .bh-feat__desc {
    max-width: none;
  }
}
</style>
