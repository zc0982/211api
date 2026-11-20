<template>
  <section v-reveal class="bh-section bh-on-canvas bh-kb" aria-labelledby="bh-kb-title">
    <div class="bh-container bh-kb__grid">
      <header class="bh-section-head bh-kb__head" data-reveal style="--bh-i: 0">
        <h2 id="bh-kb-title" class="bh-section-title">
          <span>{{ t('brandHome.budget.titleLine1') }}</span>
          <span>{{ t('brandHome.budget.titleLine2') }}</span>
        </h2>
        <p class="bh-section-sub">{{ t('brandHome.budget.subtitle') }}</p>
        <RouterLink class="bh-section-link" :to="links.keys">{{ t('brandHome.budget.link') }} →</RouterLink>
      </header>

      <figure class="bh-kb__figure" data-reveal style="--bh-i: 1">
        <div class="bh-kb__card bh-dark-card">
          <div class="bh-kb__inner">
            <div class="bh-kb__top">
              <span>{{ t('brandHome.budget.cardTitle') }}</span>
              <span class="bh-kb__sample">{{ t('brandHome.trace.sampleData') }}</span>
            </div>
            <ul class="bh-kb__cols">
              <li v-for="col in columns" :key="col.name" :class="{ 'is-warn': col.warn }">
                <p class="bh-kb__name"><i aria-hidden="true" />{{ col.label }}</p>
                <p class="bh-kb__pct bh-mono">{{ col.percent }}%</p>
                <span
                  class="bh-kb__bar"
                  role="meter"
                  :aria-valuenow="col.percent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="t('brandHome.budget.usedLabel', { name: col.label })"
                ><span :style="{ width: `${col.percent}%` }" /></span>
                <p class="bh-kb__used bh-mono">{{ col.used }} / {{ col.quota }}</p>
                <p v-if="col.warn" class="bh-kb__note">{{ t('brandHome.budget.autoDisable') }}</p>
                <p v-else class="bh-kb__cap bh-mono">{{ t('brandHome.budget.cap', { cap: col.cap }) }}</p>
              </li>
            </ul>
          </div>
        </div>
        <figcaption class="bh-caption">{{ t('brandHome.budget.caption') }}</figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { vReveal } from '../composables/vReveal'
import type { HomeLinks } from '../composables/homeLinks'
import { KEY_BUDGET } from '../config'

/**
 * 用量与预算 · 密钥额度（Figma 46:3709）：左文右深色卡，四个密钥的额度示例。
 * 卡片在两种主题下都是深色。第二行显示周期用量上限（API Key 有 5h / 1d / 7d
 * 用量窗口），不写「RPM」「告警」——密钥上没有这两项，见文案核对。
 */
defineProps<{ links: HomeLinks }>()
const { t } = useI18n()

const columns = computed(() =>
  KEY_BUDGET.map((col) => ({
    ...col,
    label:
      col.name === 'production'
        ? t('brandHome.budget.keyProduction')
        : col.name === 'staging'
          ? t('brandHome.budget.keyStaging')
          : col.name === 'team'
            ? t('brandHome.budget.keyTeam')
            : 'Claude Code'
  }))
)
</script>

<style scoped>
.bh-kb__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 680px;
  align-items: center;
  gap: 48px;
}
.bh-kb__head {
  margin-bottom: 0;
}
.bh-kb__head .bh-section-title span {
  display: block;
}
.bh-kb__figure {
  margin: 0;
}
.bh-kb__card {
  padding: 20px;
  border-radius: 24px;
}
.bh-kb__inner {
  padding: 22px 24px 30px;
  border: 1px solid var(--bh-night-line);
  border-radius: 16px;
  background: var(--bh-night-inner);
}
.bh-kb__top {
  display: flex;
  justify-content: space-between;
  color: var(--bh-night-slate);
  font-size: 13px;
  line-height: 16px;
}
.bh-kb__sample {
  color: var(--bh-night-mist);
  font-size: 12px;
}
.bh-kb__cols {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}
.bh-kb__cols p {
  margin: 0;
}
.bh-kb__name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--bh-night-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 17px;
  white-space: nowrap;
}
.bh-kb__name i {
  width: 8px;
  height: 8px;
  flex: none;
  background: var(--bh-night-blue);
}
.bh-kb__pct {
  margin-top: 17px !important;
  color: var(--bh-night-ink);
  font-size: 30px;
  font-weight: 500;
  line-height: 39px;
}
.is-warn .bh-kb__pct {
  color: var(--bh-night-bronze);
}
.bh-kb__bar {
  display: block;
  height: 4px;
  margin-top: 13px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--bh-night-line);
}
.bh-kb__bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--bh-night-blue);
}
.bh-kb__used {
  margin-top: 14px !important;
  color: var(--bh-night-slate);
  font-size: 12px;
  line-height: 16px;
}
.bh-kb__cap {
  margin-top: 6px !important;
  color: var(--bh-night-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-kb__note {
  margin-top: 6px !important;
  color: var(--bh-night-bronze);
  font-size: 12px;
  line-height: 16px;
}

@media (max-width: 1100px) {
  .bh-kb__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .bh-kb__card {
    padding: 12px;
  }
  .bh-kb__inner {
    padding: 18px 16px 22px;
  }
  .bh-kb__cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 28px;
  }
}
</style>
