<template>
  <section ref="root" class="bh-section bh-band bh-plaza" aria-labelledby="bh-plaza-title">
    <div class="bh-container">
      <header class="bh-section-head">
        <h2 id="bh-plaza-title" class="bh-section-title">{{ t('brandHome.plaza.title') }}</h2>
        <p v-if="links.modelPlaza" class="bh-section-sub">{{ t('brandHome.plaza.subtitle') }}</p>
        <p v-else class="bh-section-sub">{{ t('brandHome.plaza.subtitleNoPricing') }}</p>
      </header>

      <div v-if="showCards" class="bh-plaza__body" :aria-busy="state === 'loading'">
        <div v-if="state === 'ready'" class="bh-plaza__toolbar" role="group" :aria-label="t('brandHome.plaza.filterLabel')">
          <FilterChip :active="filter === 'all'" @click="filter = 'all'">{{ t('brandHome.plaza.all') }}</FilterChip>
          <FilterChip v-for="vendor in chipVendors" :key="vendor" :active="filter === vendor" @click="filter = vendor">
            <template #icon><VendorIcon :vendor="vendor" :size="16" /></template>
            {{ VENDOR_LABEL[vendor] }}
          </FilterChip>
        </div>

        <ul v-if="state === 'ready'" class="bh-plaza__grid">
          <li v-for="card in cards" :key="`${card.vendor}:${card.name}`" class="bh-plaza__card">
            <div class="bh-plaza__top">
              <span class="bh-plaza__mono" aria-hidden="true"><VendorIcon :vendor="card.vendor" :size="20" /></span>
              <div class="bh-plaza__id">
                <h3 class="bh-plaza__name bh-mono" :title="card.name">{{ card.name }}</h3>
                <p class="bh-plaza__provider">{{ VENDOR_LABEL[card.vendor] }}</p>
              </div>
            </div>
            <dl class="bh-plaza__prices">
              <div>
                <dt>{{ t('brandHome.plaza.inputPerMillion') }}</dt>
                <dd class="bh-mono">{{ t('brandHome.plaza.priceFrom', { price: card.input }) }}</dd>
              </div>
              <div>
                <dt>{{ t('brandHome.plaza.outputPerMillion') }}</dt>
                <dd class="bh-mono">{{ t('brandHome.plaza.priceFrom', { price: card.output }) }}</dd>
              </div>
            </dl>
          </li>
        </ul>

        <ul v-else class="bh-plaza__grid" aria-hidden="true">
          <li v-for="n in 4" :key="n" class="bh-plaza__card is-skeleton"><span /><span /><span /></li>
        </ul>
      </div>

      <div v-if="links.modelPlaza" class="bh-plaza__foot">
        <p v-if="state === 'ready'" class="bh-plaza__note">{{ t('brandHome.plaza.footnote') }}</p>
        <BrandButton variant="outline" :to="links.modelPlaza" class="bh-plaza__all">{{ t('brandHome.plaza.viewAll') }} →</BrandButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import FilterChip from '../components/FilterChip.vue'
import VendorIcon from '../components/VendorIcon.vue'
import { VENDOR_CHIP_ORDER, VENDOR_LABEL } from '../config'
import type { HomeLinks } from '../composables/homeLinks'
import { useModelPlazaCards } from '../composables/useModelPlazaCards'

/**
 * 模型广场摘要。仅在广场对当前访客可见（model_plaza_enabled，且不要求登录或已登录）
 * 时请求，区块接近视口才发请求；失败（404/401/网络）时整组卡片隐藏，不弹错误。
 */
const props = defineProps<{ links: HomeLinks }>()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const enabled = computed(() => props.links.modelPlaza !== null)
const { state, filter, vendors, cards } = useModelPlazaCards(root, toRef(() => enabled.value))

const chipVendors = computed(() => VENDOR_CHIP_ORDER.filter((v) => vendors.value.includes(v)))
const showCards = computed(() => enabled.value && state.value !== 'failed')
</script>

<style scoped>
.bh-plaza__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.bh-plaza__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-plaza__card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--bh-line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 20px -10px rgba(20, 48, 107, 0.05);
}
.bh-plaza__top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--bh-line);
}
.bh-plaza__mono {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--bh-sky);
  border-radius: 10px;
  background: #fff;
}
.bh-plaza__id {
  min-width: 0;
}
.bh-plaza__name {
  margin: 0;
  overflow: hidden;
  color: var(--bh-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bh-plaza__provider {
  margin: 2px 0 0;
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-plaza__prices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 16px 0 0;
}
.bh-plaza__prices dt {
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-plaza__prices dd {
  margin: 2px 0 0;
  color: var(--bh-ink);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
}
.bh-plaza__card.is-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 153px;
}
.bh-plaza__card.is-skeleton span {
  display: block;
  height: 14px;
  border-radius: 7px;
  background: var(--bh-tint);
}
.bh-plaza__card.is-skeleton span:first-child {
  width: 60%;
  height: 36px;
  border-radius: 10px;
}
.bh-plaza__card.is-skeleton span:last-child {
  width: 80%;
  margin-top: auto;
}

.bh-plaza__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 32px;
}
.bh-plaza__note {
  margin: 0;
  color: var(--bh-mist);
  font-size: 13px;
  line-height: 18px;
}
.bh-plaza__all {
  margin-left: auto;
}

@media (max-width: 1100px) {
  .bh-plaza__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .bh-plaza__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .bh-plaza__foot {
    flex-direction: column;
    align-items: flex-start;
  }
  .bh-plaza__all {
    margin-left: 0;
  }
}
</style>
