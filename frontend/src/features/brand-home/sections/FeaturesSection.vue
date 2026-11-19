<template>
  <section class="bh-section bh-band" aria-labelledby="bh-features-title">
    <div class="bh-container">
      <header class="bh-section-head">
        <h2 id="bh-features-title" class="bh-section-title">{{ t('brandHome.features.title') }}</h2>
        <p class="bh-section-sub">{{ t('brandHome.features.subtitle') }}</p>
      </header>
      <ul class="bh-features">
        <li v-for="item in items" :key="item.key" class="bh-feature">
          <span class="bh-feature__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="item.key === 'unified'">
                <path d="M4 24L13.333 16L4 8M13.333 16H4" stroke="#14306B" />
                <path d="M13.333 16H24" stroke="#D4A84B" />
                <circle cx="26.667" cy="16" r="2.667" fill="#D4A84B" stroke="none" />
              </template>
              <template v-else-if="item.key === 'routing'">
                <path d="M4 16H10.667C14.667 16 14.667 8 18.667 8H28" stroke="#14306B" />
                <path d="M10.667 16C14.667 16 14.667 24 18.667 24H28" stroke="#D4A84B" />
                <circle cx="10.667" cy="16" r="2.033" fill="#fff" stroke="#14306B" />
              </template>
              <template v-else-if="item.key === 'tracing'">
                <path d="M5.333 16H26.667" stroke="#D4A84B" />
                <circle cx="5.333" cy="16" r="2.567" fill="#fff" stroke="#14306B" />
                <circle cx="16" cy="16" r="3.467" fill="#D4A84B" stroke="none" />
                <circle cx="26.667" cy="16" r="2.567" fill="#fff" stroke="#14306B" />
                <path d="M16 5.333V9.333M16 22.667V26.667" stroke="#14306B" />
              </template>
              <template v-else-if="item.key === 'billing'">
                <path d="M8 4H24V28L20 25.333L16 28L12 25.333L8 28V4Z" stroke="#14306B" />
                <path d="M12 10.667H20M12 16H20" stroke="#14306B" />
                <path d="M12 21.333H16" stroke="#D4A84B" />
              </template>
              <template v-else-if="item.key === 'budget'">
                <path d="M5.333 22.667C5.333 16.776 10.11 12 16 12C21.891 12 26.667 16.776 26.667 22.667" stroke="#14306B" />
                <path d="M16 22.667L21.333 16" stroke="#D4A84B" />
                <circle cx="16" cy="22.667" r="2.4" fill="#D4A84B" stroke="none" />
                <path d="M5.333 26.667H26.667" stroke="#14306B" />
              </template>
              <template v-else>
                <path d="M16 4L25.333 8V16C25.333 22 21.333 26 16 28C10.667 26 6.667 22 6.667 16V8L16 4Z" stroke="#14306B" />
                <path d="M12 16L14.667 18.667L20 13.333" stroke="#D4A84B" />
              </template>
            </svg>
          </span>
          <h3 class="bh-feature__title">{{ item.title }}</h3>
          <p class="bh-feature__desc">{{ item.desc }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** 核心能力：同质条目用顶部细线分隔的开放栅格，不做卡片。图标取自 Figma 1:2821。 */
const { t } = useI18n()

const items = computed(() => [
  { key: 'unified', title: t('brandHome.features.unifiedTitle'), desc: t('brandHome.features.unifiedDesc') },
  { key: 'routing', title: t('brandHome.features.routingTitle'), desc: t('brandHome.features.routingDesc') },
  { key: 'tracing', title: t('brandHome.features.tracingTitle'), desc: t('brandHome.features.tracingDesc') },
  { key: 'billing', title: t('brandHome.features.billingTitle'), desc: t('brandHome.features.billingDesc') },
  { key: 'budget', title: t('brandHome.features.budgetTitle'), desc: t('brandHome.features.budgetDesc') },
  { key: 'access', title: t('brandHome.features.accessTitle'), desc: t('brandHome.features.accessDesc') }
])
</script>

<style scoped>
.bh-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 56px 48px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-feature {
  padding-top: 32px;
  border-top: 1px solid var(--bh-line);
}
.bh-feature__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--bh-tint);
}
.bh-feature__title {
  margin: 24px 0 0;
  color: var(--bh-ink);
  font-size: 18px;
  font-weight: 500;
  line-height: 28px;
}
.bh-feature__desc {
  margin: 8px 0 0;
  max-width: 352px;
  color: var(--bh-slate);
  font-size: 15px;
  line-height: 24px;
}
@media (max-width: 1100px) {
  .bh-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 40px 32px;
  }
}
@media (max-width: 560px) {
  .bh-features {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
