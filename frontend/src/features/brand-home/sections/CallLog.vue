<template>
  <section v-reveal class="bh-section bh-on-band bh-log" aria-labelledby="bh-log-title">
    <div class="bh-container">
      <header class="bh-section-head" data-reveal style="--bh-i: 0">
        <h2 id="bh-log-title" class="bh-section-title">{{ t('brandHome.trace.title') }}</h2>
        <p class="bh-section-sub">{{ t('brandHome.trace.subtitle') }}</p>
        <RouterLink class="bh-section-link" :to="links.usage">{{ t('brandHome.trace.viewLogs') }} →</RouterLink>
      </header>

      <figure class="bh-log__card" data-reveal style="--bh-i: 1" :aria-label="t('brandHome.trace.panelLabel')">
        <div class="bh-log__toolbar">
          <div class="bh-log__heading">
            <span class="bh-log__title">{{ t('brandHome.trace.panelTitle') }}</span>
            <span class="bh-log__tag">{{ t('brandHome.trace.sampleData') }}</span>
          </div>
          <!-- Mock console controls: illustration only, not interactive. -->
          <div class="bh-log__tools" aria-hidden="true">
            <span class="bh-log__select">{{ t('brandHome.trace.filterTime') }}<i /></span>
            <span class="bh-log__select">{{ t('brandHome.trace.filterModel') }}<i /></span>
            <span class="bh-log__select">{{ t('brandHome.trace.filterStatus') }}<i /></span>
            <SearchField class="bh-log__search" :placeholder="t('brandHome.trace.searchPlaceholder')" />
            <span class="bh-log__export">{{ t('brandHome.trace.exportCsv') }}</span>
          </div>
        </div>

        <div class="bh-log__scroll">
          <table class="bh-log__table">
            <thead>
              <tr>
                <th scope="col">{{ t('brandHome.trace.colTime') }}</th>
                <th scope="col">{{ t('brandHome.trace.colRequestId') }}</th>
                <th scope="col">{{ t('brandHome.trace.colModel') }}</th>
                <th scope="col">{{ t('brandHome.trace.colDuration') }}</th>
                <th scope="col">{{ t('brandHome.trace.colFirstToken') }}</th>
                <th scope="col">{{ t('brandHome.trace.colTokens') }}</th>
                <th scope="col">{{ t('brandHome.trace.colCost') }}</th>
                <th scope="col">{{ t('brandHome.trace.colStatus') }}</th>
                <th scope="col"><span class="bh-sr-only">{{ t('brandHome.trace.colDetail') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, index) in CALL_LOG_ROWS" :key="row.id">
                <tr :class="{ 'is-tracked': index === 0 }">
                  <td class="bh-mono bh-log__muted">{{ row.time }}</td>
                  <td class="bh-mono">{{ row.id }}</td>
                  <td>
                    <span class="bh-log__model"><VendorIcon :vendor="row.vendor" :size="16" /><span class="bh-mono">{{ row.model }}</span></span>
                  </td>
                  <td class="bh-mono">{{ row.duration }}</td>
                  <td class="bh-mono">{{ row.firstToken }}</td>
                  <td class="bh-mono">{{ row.tokens }}</td>
                  <td class="bh-mono bh-log__cost">{{ row.cost }}</td>
                  <td><StatusBadge label="200 OK" /></td>
                  <td>
                    <svg class="bh-log__chevron" :class="{ 'is-open': index === 0 }" viewBox="0 0 10 5" width="10" height="5" aria-hidden="true">
                      <path d="M0.5 0.5L5 4.5L9.5 0.5" />
                    </svg>
                  </td>
                </tr>
                <tr v-if="index === 0" class="is-tracked bh-log__detail">
                  <td colspan="9">
                    <div class="bh-log__timeline">
                      <div class="bh-log__meta">
                        <p class="bh-log__meta-title">{{ t('brandHome.trace.timelineLabel') }}</p>
                        <p class="bh-mono bh-log__meta-sub">
                          {{ row.id }} · {{ t('brandHome.trace.firstTokenShort') }} {{ CALL_LOG_TIMELINE.firstToken }} · {{ t('brandHome.trace.durationShort') }} {{ CALL_LOG_TIMELINE.duration }}
                        </p>
                      </div>
                      <ol class="bh-log__hops">
                        <li v-for="hop in hops" :key="hop.key" :class="{ 'is-end': hop.end }">
                          <span class="bh-log__hop-label">{{ hop.label }}</span>
                          <i aria-hidden="true" />
                          <span class="bh-mono bh-log__hop-value">{{ hop.value }}</span>
                        </li>
                      </ol>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <figcaption class="bh-log__foot">
          <span>{{ t('brandHome.trace.footer', { total: CALL_LOG_TOTAL }) }}</span>
          <RouterLink :to="links.usage" class="bh-log__open">{{ t('brandHome.trace.openInConsole') }} →</RouterLink>
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
import { vReveal } from '../composables/vReveal'
import type { HomeLinks } from '../composables/homeLinks'
import { CALL_LOG_ROWS, CALL_LOG_TIMELINE, CALL_LOG_TOTAL } from '../config'

/**
 * 透明可追溯 · 调用明细（Figma 46:3567）：示例数据的调用明细表，第一行是被
 * 追踪、已展开的调用——条带色底 + 左侧 3px 金色竖条，展开后是这次请求的时间线。
 * 时间线只用用量日志里真有的字段（首字、总耗时、费用），不画用户端看不到的
 * 「鉴权 → 路由 → 上游」逐跳耗时，见 docs/spec/brand-home.md 文案核对。
 */
defineProps<{ links: HomeLinks }>()
const { t } = useI18n()

const hops = computed(() => [
  { key: 'sent', label: t('brandHome.trace.stageSent'), value: '0 ms' },
  { key: 'first', label: t('brandHome.trace.stageFirstToken'), value: CALL_LOG_TIMELINE.firstToken },
  { key: 'done', label: t('brandHome.trace.stageDone'), value: CALL_LOG_TIMELINE.duration },
  { key: 'billed', label: t('brandHome.trace.stageBilled'), value: t('brandHome.trace.billedValue', { cost: CALL_LOG_TIMELINE.cost }), end: true }
])
</script>

<style scoped>
.bh-log__card {
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--bh-line);
  border-radius: 20px;
  background: var(--bh-surface);
  box-shadow: 0 16px 40px -16px rgb(var(--bh-shadow-navy) / min(calc(0.06 * var(--bh-shadow-k)), 0.5));
}
.bh-log__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
}
.bh-log__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bh-log__title {
  color: var(--bh-ink);
  font-size: 16px;
  font-weight: 500;
}
.bh-log__tag {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bh-tag-bg);
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 14px;
}
.bh-log__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.bh-log__select,
.bh-log__export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: var(--bh-surface);
  color: var(--bh-slate);
  font-size: 13px;
  white-space: nowrap;
}
.bh-log__select i {
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-right: 1.5px solid var(--bh-mist);
  border-bottom: 1.5px solid var(--bh-mist);
  transform: rotate(45deg);
}
.bh-log__search {
  width: 200px;
  height: 32px;
}
.bh-log__export {
  border-color: var(--bh-btn-line);
  color: var(--bh-navy);
  font-size: 14px;
  font-weight: 500;
}

.bh-log__scroll {
  overflow-x: auto;
}
.bh-log__table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
  font-size: 13px;
}
.bh-log__table th {
  height: 40px;
  padding: 0 12px;
  border-top: 1px solid var(--bh-head-line);
  border-bottom: 1px solid var(--bh-head-line);
  background: var(--bh-head-bg);
  color: var(--bh-mist);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}
.bh-log__table td {
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--bh-row-line);
  color: var(--bh-ink);
  white-space: nowrap;
}
.bh-log__table th:first-child,
.bh-log__table td:first-child {
  padding-left: 24px;
}
.bh-log__table th:last-child,
.bh-log__table td:last-child {
  width: 40px;
  padding-right: 24px;
}
.bh-log__table tr.is-tracked {
  background: var(--bh-band);
}
.bh-log__table tr.is-tracked td:first-child {
  box-shadow: inset 3px 0 0 var(--bh-gold);
}
.bh-log__table tr.is-tracked:not(.bh-log__detail) td {
  border-bottom: none;
}
.bh-log__muted {
  color: var(--bh-slate) !important;
}
.bh-log__model {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bh-log__cost {
  color: var(--bh-bronze) !important;
  font-weight: 500;
}
.bh-log__chevron {
  display: block;
  fill: none;
  stroke: var(--bh-mist);
  stroke-width: 1.2;
}
.bh-log__chevron.is-open {
  transform: rotate(180deg);
}

/* Expanded timeline of the tracked call (Figma 46:3567 expanded row). */
.bh-log__detail td {
  height: auto;
  padding-top: 8px !important;
  padding-bottom: 28px !important;
  white-space: normal;
}
.bh-log__timeline {
  display: grid;
  grid-template-columns: 276px minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}
.bh-log__meta-title {
  margin: 0;
  color: var(--bh-ink);
  font-size: 13px;
  font-weight: 500;
}
.bh-log__meta-sub {
  margin: 6px 0 0;
  color: var(--bh-mist);
  font-size: 12px;
}
.bh-log__hops {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
/* Gold line through the four nodes. */
.bh-log__hops::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 35px;
  height: 2px;
  background: var(--bh-gold);
}
.bh-log__hops li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.bh-log__hops li.is-end {
  align-items: flex-end;
}
.bh-log__hop-label {
  color: var(--bh-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
}
.bh-log__hops i {
  position: relative;
  width: 14px;
  height: 14px;
  margin: 13px 0 12px;
  box-sizing: border-box;
  border: 1.5px solid var(--bh-gold);
  border-radius: 50%;
  background: var(--bh-surface);
}
.bh-log__hops li.is-end i {
  background: var(--bh-gold);
}
.bh-log__hop-value {
  color: var(--bh-slate);
  font-size: 12px;
}
.bh-log__hops li.is-end .bh-log__hop-value {
  color: var(--bh-bronze);
}

.bh-log__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 24px;
  color: var(--bh-mist);
  font-size: 12px;
}
.bh-log__open {
  color: var(--bh-blue);
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}

@media (max-width: 860px) {
  .bh-log__tools {
    display: none;
  }
}
</style>
