<template>
  <section class="bh-status" aria-labelledby="bh-status-title">
    <div class="bh-container">
      <div class="bh-status__panel bh-glass">
        <p class="bh-status__head">
          <span class="bh-status__ok"><i aria-hidden="true" />{{ t('brandHome.status.allOperational') }}</span>
          <span id="bh-status-title">{{ t('brandHome.status.label') }}</span>
          <a v-if="statusUrl" :href="statusUrl" class="bh-status__link">{{ t('brandHome.status.viewLive') }} →</a>
        </p>
        <dl class="bh-status__stats">
          <div>
            <dt>{{ t('brandHome.status.availability') }}</dt>
            <dd class="bh-mono">{{ stats.availability }}</dd>
          </div>
          <div>
            <dt>{{ t('brandHome.status.avgFirstToken') }}</dt>
            <dd class="bh-mono">{{ stats.avgFirstToken }}</dd>
          </div>
          <div>
            <dt>{{ t('brandHome.status.providers') }}</dt>
            <dd class="bh-mono">{{ stats.providers }}</dd>
          </div>
          <div>
            <dt>{{ t('brandHome.status.totalCalls') }}</dt>
            <dd class="bh-mono">{{ stats.totalCalls }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 服务状态条带（Figma 1:3476）。当前没有公开的运营数据接口，BrandHome 在
 * config.liveStats 为 false 时不渲染本组件。接入时数值只能来自真实接口，
 * 由调用方传入已格式化的字符串，不得硬编码。
 */
export interface LiveStats {
  availability: string
  avgFirstToken: string
  providers: string
  totalCalls: string
}

defineProps<{ stats: LiveStats; statusUrl?: string | null }>()
const { t } = useI18n()
</script>

<style scoped>
.bh-status {
  padding: 0 0 96px;
}
.bh-status__panel {
  padding: 24px 40px 28px;
  border-radius: 20px;
}
.bh-status__head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0;
  color: var(--bh-slate);
  font-size: 13px;
}
.bh-status__ok {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--bh-ok);
  font-weight: 500;
}
.bh-status__ok i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bh-ok);
}
.bh-status__link {
  margin-left: auto;
  color: var(--bh-blue);
  font-weight: 500;
}
.bh-status__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 24px 0 0;
}
.bh-status__stats dt {
  color: var(--bh-slate);
  font-size: 13px;
}
.bh-status__stats dd {
  margin: 0;
  color: var(--bh-ink);
  font-size: 40px;
  font-weight: 500;
  line-height: 1.2;
}
</style>
