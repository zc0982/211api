<template>
  <section class="bh-section bh-trace" aria-labelledby="bh-trace-title">
    <div class="bh-trace__sky" aria-hidden="true">
      <span class="bh-trace__bloom bh-trace__bloom--left" />
      <span class="bh-trace__bloom bh-trace__bloom--right" />
      <span class="bh-trace__bloom bh-trace__bloom--gold" />
      <span class="bh-trace__orbit bh-trace__orbit--outer" />
      <span class="bh-trace__orbit bh-trace__orbit--inner" />
    </div>
    <div class="bh-container">
      <header class="bh-section-head bh-trace__head">
        <h2 id="bh-trace-title" class="bh-section-title">{{ t('brandHome.trace.title') }}</h2>
        <p class="bh-section-sub">{{ t('brandHome.trace.subtitle') }}</p>
      </header>

      <ul class="bh-trace__points">
        <li v-for="point in points" :key="point.title" class="bh-trace__point">
          <span class="bh-trace__node" aria-hidden="true"><i /></span>
          <div>
            <h3 class="bh-trace__point-title">{{ point.title }}</h3>
            <p class="bh-trace__point-desc">{{ point.desc }}</p>
          </div>
        </li>
      </ul>

      <figure class="bh-console" :aria-label="t('brandHome.trace.panelLabel')">
        <div aria-hidden="true">
          <div class="bh-console__titlebar">
            <div class="bh-console__name">
              <span class="bh-console__title">{{ t('brandHome.trace.panelTitle') }}</span>
              <span class="bh-console__path bh-mono">console / logs</span>
            </div>
            <div class="bh-console__right">
              <span class="bh-console__sample">{{ t('brandHome.trace.sampleData') }}</span>
              <span class="bh-console__export">{{ t('brandHome.trace.exportCsv') }}</span>
            </div>
          </div>

          <div class="bh-console__filters">
            <span class="bh-console__filter">
              <span class="bh-console__filter-k">{{ t('brandHome.trace.filterTime') }}</span>
              <span class="bh-console__filter-v">{{ t('brandHome.trace.filterTimeValue') }}</span>
              <svg viewBox="0 0 8 4" width="8" height="4"><path d="M.75.75 4 3.25 7.25.75" /></svg>
            </span>
            <span class="bh-console__filter">
              <span class="bh-console__filter-k">{{ t('brandHome.trace.filterModel') }}</span>
              <span class="bh-console__filter-v">{{ t('brandHome.trace.filterAll') }}</span>
              <svg viewBox="0 0 8 4" width="8" height="4"><path d="M.75.75 4 3.25 7.25.75" /></svg>
            </span>
            <span class="bh-console__filter">
              <span class="bh-console__filter-k">{{ t('brandHome.trace.filterStatus') }}</span>
              <span class="bh-console__filter-v">{{ t('brandHome.trace.filterAll') }}</span>
              <svg viewBox="0 0 8 4" width="8" height="4"><path d="M.75.75 4 3.25 7.25.75" /></svg>
            </span>
            <span class="bh-console__spacer" />
            <SearchField :placeholder="t('brandHome.trace.searchPlaceholder')" class="bh-console__search" />
            <span class="bh-console__summary bh-mono">{{ t('brandHome.trace.summaryCount', { count: '1,284' }) }} · $18.42</span>
          </div>

          <div class="bh-console__table">
            <div class="bh-console__row bh-console__row--head">
              <span>{{ t('brandHome.trace.colRequestId') }}</span>
              <span>{{ t('brandHome.trace.colTime') }}</span>
              <span>{{ t('brandHome.trace.colModel') }}</span>
              <span>{{ t('brandHome.trace.colDuration') }}</span>
              <span>{{ t('brandHome.trace.colFirstToken') }}</span>
              <span>{{ t('brandHome.trace.colTokens') }}</span>
              <span>{{ t('brandHome.trace.colCost') }}</span>
              <span>{{ t('brandHome.trace.colStatus') }}</span>
            </div>

            <div v-for="(row, index) in ROWS" :key="row.id" class="bh-console__group" :class="{ 'is-open': index === 0, 'is-faded': index === ROWS.length - 1 }">
              <div class="bh-console__row bh-mono">
                <span class="bh-console__id">{{ row.id }}</span>
                <span class="bh-console__muted">{{ row.time }}</span>
                <span class="bh-console__model"><VendorIcon :vendor="row.vendor" :size="14" />{{ row.model }}</span>
                <span>{{ row.duration }}</span>
                <span>{{ row.ttft }}</span>
                <span class="bh-console__soft">{{ row.tokens }}</span>
                <span class="bh-console__cost">{{ row.cost }}</span>
                <span><StatusBadge label="200 OK" /></span>
              </div>

              <div v-if="index === 0" class="bh-console__detail">
                <div class="bh-timeline">
                  <p class="bh-timeline__head">
                    <span>{{ t('brandHome.trace.timelineLabel') }}</span>
                    <span class="bh-mono">{{ row.id }} · {{ t('brandHome.trace.timelineFirstToken', { ms: row.ttft }) }}</span>
                  </p>
                  <div class="bh-timeline__track">
                    <span class="bh-timeline__line" />
                    <span class="bh-timeline__segment" style="left: 0; width: 34%">{{ t('brandHome.trace.waitingFirstToken') }}</span>
                    <span class="bh-timeline__light bh-motion" />
                    <span v-for="stage in stages" :key="stage.label" class="bh-timeline__stage" :class="{ 'is-end': stage.end }" :style="{ left: stage.at }">
                      <i />
                      <b>{{ stage.label }}</b>
                      <em class="bh-mono">{{ stage.value }}</em>
                    </span>
                    <span class="bh-timeline__total bh-mono">= {{ row.duration }}</span>
                  </div>
                </div>
                <dl class="bh-console__kv">
                  <div>
                    <dt>{{ t('brandHome.trace.detailKey') }}</dt>
                    <dd class="bh-mono">web-app</dd>
                  </div>
                  <div>
                    <dt>{{ t('brandHome.trace.colModel') }}</dt>
                    <dd class="bh-mono">{{ row.model }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('brandHome.trace.detailTokens') }}</dt>
                    <dd>{{ t('brandHome.trace.detailTokensValue', { input: '1,204', output: '386' }) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('brandHome.trace.detailCost') }}</dt>
                    <dd>{{ t('brandHome.trace.detailCostValue', { cost: row.cost }) }}</dd>
                  </div>
                </dl>
                <RouterLink :to="links.usage" class="bh-console__open" tabindex="-1">
                  {{ t('brandHome.trace.openInConsole') }} →
                </RouterLink>
              </div>
            </div>
          </div>
        </div>

        <figcaption class="bh-console__footer">
          <span>{{ t('brandHome.trace.footer', { shown: ROWS.length, total: '1,284' }) }}</span>
          <RouterLink :to="links.usage" class="bh-console__link">{{ t('brandHome.trace.viewAll') }} →</RouterLink>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SearchField from '../components/SearchField.vue'
import StatusBadge from '../components/StatusBadge.vue'
import VendorIcon from '../components/VendorIcon.vue'
import type { HomeLinks } from '../composables/homeLinks'
import type { BrandVendor } from '../config'

/**
 * 调用明细示意面板。所有行都是示例数据（右上角标「示例数据」），只展示
 * 控制台真实存在的字段：模型、总耗时、首字延迟、tokens、费用、状态
 * （见 backend/internal/handler/dto/types.go UsageLog）。
 */
defineProps<{ links: HomeLinks }>()
const { t } = useI18n()

interface SampleRow {
  id: string
  time: string
  vendor: BrandVendor
  model: string
  duration: string
  ttft: string
  tokens: string
  cost: string
}

const ROWS: readonly SampleRow[] = [
  { id: 'req_7f3a9c', time: '14:32:08', vendor: 'claude', model: 'claude-fable-5-2', duration: '1.24s', ttft: '312ms', tokens: '1,204 / 386', cost: '$0.0042' },
  { id: 'req_7f3a9b', time: '14:32:05', vendor: 'openai', model: 'gpt-6.1-sol', duration: '2.06s', ttft: '428ms', tokens: '862 / 1,530', cost: '$0.0118' },
  { id: 'req_7f3a9a', time: '14:31:59', vendor: 'gemini', model: 'gemini-4-carbon', duration: '1.87s', ttft: '506ms', tokens: '3,410 / 702', cost: '$0.0096' },
  { id: 'req_7f3a99', time: '14:31:52', vendor: 'claude', model: 'claude-fable-5-2', duration: '0.98s', ttft: '641ms', tokens: '980 / 244', cost: '$0.0031' },
  { id: 'req_7f3a98', time: '14:31:47', vendor: 'grok', model: 'grok-4.7', duration: '1.42s', ttft: '189ms', tokens: '2,048 / 1,112', cost: '$0.0021' },
  { id: 'req_7f3a97', time: '14:31:40', vendor: 'openai', model: 'gpt-6.1-sol', duration: '0.91s', ttft: '274ms', tokens: '1,536 / 498', cost: '$0.0019' }
]

const points = computed(() => [
  { title: t('brandHome.trace.point1Title'), desc: t('brandHome.trace.point1Desc') },
  { title: t('brandHome.trace.point2Title'), desc: t('brandHome.trace.point2Desc') },
  { title: t('brandHome.trace.point3Title'), desc: t('brandHome.trace.point3Desc') }
])

const stages = computed(() => [
  { label: t('brandHome.trace.stageSent'), value: '0ms', at: '0%', end: false },
  { label: t('brandHome.trace.stageFirstToken'), value: '312ms', at: '34%', end: false },
  { label: t('brandHome.trace.stageDone'), value: '1.24s', at: '68%', end: false },
  { label: t('brandHome.trace.stageBilled'), value: '$0.0042', at: '100%', end: true }
])
</script>

<style scoped>
.bh-trace {
  overflow: hidden;
}
.bh-trace__sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bh-trace__bloom,
.bh-trace__orbit {
  position: absolute;
  border-radius: 50%;
}
.bh-trace__bloom--left {
  left: calc(50% - 1050px);
  top: 340px;
  width: 1240px;
  height: 900px;
  background: radial-gradient(closest-side, rgba(191, 214, 246, 0.6), rgba(191, 214, 246, 0.2) 55%, transparent);
}
.bh-trace__bloom--right {
  left: calc(50% - 60px);
  top: 214px;
  width: 1020px;
  height: 760px;
  background: radial-gradient(closest-side, rgba(191, 214, 246, 0.5), rgba(191, 214, 246, 0.16) 55%, transparent);
}
.bh-trace__bloom--gold {
  left: calc(50% + 120px);
  top: 574px;
  width: 740px;
  height: 560px;
  background: radial-gradient(closest-side, rgba(212, 168, 75, 0.16), transparent);
}
.bh-trace__orbit--outer {
  left: calc(50% - 880px);
  top: 374px;
  width: 1760px;
  height: 760px;
  border: 1px solid rgba(255, 255, 255, 0.95);
}
.bh-trace__orbit--inner {
  left: calc(50% - 700px);
  top: 474px;
  width: 1400px;
  height: 560px;
  border: 1px solid rgba(191, 214, 246, 0.55);
}
.bh-trace__head {
  margin-bottom: 40px;
}

.bh-trace__points {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 0 40px;
  padding: 0;
  list-style: none;
}
.bh-trace__point {
  display: flex;
  gap: 16px;
  padding: 4px 32px;
}
.bh-trace__point:first-child {
  padding-left: 0;
}
.bh-trace__point + .bh-trace__point {
  border-left: 1px solid var(--bh-line);
}
.bh-trace__node {
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin: 4px;
  border: 1.5px solid var(--bh-gold);
  border-radius: 50%;
  background: #fff;
}
.bh-trace__node i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bh-gold);
}
.bh-trace__point-title {
  margin: 0;
  color: var(--bh-ink);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}
.bh-trace__point-desc {
  margin: 4px 0 0;
  color: var(--bh-slate);
  font-size: 14px;
  line-height: 22px;
}

/* Console mock -------------------------------------------------------------- */
.bh-console {
  position: relative;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 12px 32px -8px rgba(20, 48, 107, 0.08);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-console__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
}
.bh-console__name {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.bh-console__title {
  color: var(--bh-ink);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}
.bh-console__path {
  color: var(--bh-mist);
  font-size: 12px;
}
.bh-console__right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bh-console__sample {
  padding: 4px 10px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: var(--bh-tint);
  color: var(--bh-slate);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}
.bh-console__export {
  padding: 6px 12px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: #fff;
  color: var(--bh-slate);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}
.bh-console__filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px 16px;
}
.bh-console__filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px 0 14px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  white-space: nowrap;
}
.bh-console__filter-k {
  color: var(--bh-mist);
}
.bh-console__filter-v {
  color: var(--bh-ink);
  font-weight: 500;
}
.bh-console__filter svg path {
  fill: none;
  stroke: var(--bh-slate);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bh-console__spacer {
  flex: 1;
}
.bh-console__summary {
  color: var(--bh-slate);
  font-size: 12px;
  white-space: nowrap;
}

.bh-console__table {
  overflow-x: auto;
}
.bh-console__row {
  display: grid;
  grid-template-columns: 140px 100px 180px 96px 104px 160px 100px minmax(120px, 1fr);
  align-items: center;
  min-width: 1150px;
  height: 52px;
  padding: 0 24px;
  color: var(--bh-ink);
  font-size: 13px;
  white-space: nowrap;
}
.bh-console__row--head {
  height: 40px;
  border-top: 1px solid rgba(220, 228, 242, 0.9);
  border-bottom: 1px solid rgba(220, 228, 242, 0.9);
  background: rgba(232, 240, 252, 0.55);
  color: var(--bh-mist);
  font-size: 12px;
  font-weight: 500;
}
.bh-console__group {
  position: relative;
  border-bottom: 1px solid rgba(220, 228, 242, 0.9);
}
.bh-console__group.is-open {
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 3px 0 0 var(--bh-gold);
}
.bh-console__group.is-faded {
  opacity: 0.5;
}
.bh-console__id {
  color: var(--bh-navy);
}
.bh-console__muted {
  color: var(--bh-mist);
}
.bh-console__soft {
  color: var(--bh-slate);
}
.bh-console__cost {
  font-weight: 500;
}
.bh-console__model {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.bh-console__detail {
  display: grid;
  grid-template-columns: minmax(0, 700px) minmax(0, 1fr);
  align-items: start;
  gap: 16px 56px;
  min-width: 1150px;
  padding: 16px 24px 28px;
}
.bh-timeline__head {
  display: flex;
  gap: 12px;
  margin: 0;
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-timeline__head span:first-child {
  font-weight: 500;
}
.bh-timeline__track {
  position: relative;
  height: 96px;
  margin: 14px 100px 0 6px;
}
.bh-timeline__line {
  position: absolute;
  left: 0;
  right: 0;
  top: 33px;
  height: 2px;
  background: linear-gradient(90deg, rgba(212, 168, 75, 0.55), var(--bh-gold));
}
.bh-timeline__segment {
  position: absolute;
  top: 0;
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}
.bh-timeline__light {
  position: absolute;
  top: 28px;
  left: 0;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border: 2px solid var(--bh-gold);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 10px rgba(212, 168, 75, 0.18);
  animation: bh-light-run 2.4s linear infinite;
}
@keyframes bh-light-run {
  from {
    left: 0;
  }
  to {
    left: 34%;
  }
}
.bh-timeline__stage {
  position: absolute;
  top: 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform: translateX(-6px);
}
.bh-timeline__stage i {
  width: 12px;
  height: 12px;
  border: 2px solid var(--bh-gold);
  border-radius: 50%;
  background: #fff;
}
.bh-timeline__stage.is-end i {
  background: var(--bh-gold);
}
.bh-timeline__stage b {
  margin-top: 10px;
  color: var(--bh-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}
.bh-timeline__stage em {
  margin-top: 2px;
  color: var(--bh-bronze);
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 16px;
}
.bh-timeline__total {
  position: absolute;
  left: calc(100% + 26px);
  top: 25px;
  color: var(--bh-bronze);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.bh-console__kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
  margin: 0;
}
.bh-console__kv dt {
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-console__kv dd {
  margin: 4px 0 0;
  color: var(--bh-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}
.bh-console__open {
  grid-column: 2;
  justify-self: start;
  margin-top: -4px;
  color: var(--bh-blue);
  font-size: 13px;
  font-weight: 500;
}

.bh-console__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  color: var(--bh-mist);
  font-size: 13px;
  line-height: 18px;
}
.bh-console__link {
  flex: none;
  color: var(--bh-blue);
  font-weight: 500;
  border-radius: 4px;
}
.bh-console__link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 1100px) {
  .bh-console__search,
  .bh-console__summary {
    display: none;
  }
}
@media (max-width: 860px) {
  .bh-trace__points {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .bh-trace__point,
  .bh-trace__point:first-child {
    padding: 0;
  }
  .bh-trace__point + .bh-trace__point {
    border-left: 0;
  }
  .bh-console__filters {
    overflow: hidden;
  }
  .bh-console__titlebar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .bh-console__export {
    display: none;
  }
}
</style>
