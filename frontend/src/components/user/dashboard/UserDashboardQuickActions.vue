<template>
  <!-- v3 快捷操作：一张卡，条目之间用细线分隔（不再一条一个底色块） -->
  <div class="card p-5">
    <h2 class="text-[15px] font-semibold text-gray-900 dark:text-dark-100">{{ t('dashboard.quickActions') }}</h2>
    <ul class="mt-2">
      <li v-for="action in actions" :key="action.to" class="quick-row">
        <button type="button" class="quick-row__btn group" @click="router.push(action.to)">
          <span class="quick-row__icon"><Icon :name="action.icon" size="sm" /></span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block truncate text-[13px] font-medium text-gray-900 dark:text-dark-100">{{ action.title }}</span>
            <span class="block truncate text-xs text-gray-500 dark:text-dark-400">{{ action.desc }}</span>
          </span>
          <Icon
            name="chevronRight"
            size="sm"
            class="text-gray-400 transition-colors group-hover:text-primary-800 dark:text-dark-500 dark:group-hover:text-primary-400"
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
const router = useRouter()
const { t } = useI18n()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

const actions = computed(() => [
  { to: '/keys', icon: 'key' as const, title: t('dashboard.createApiKey'), desc: t('dashboard.generateNewKey') },
  { to: '/usage', icon: 'chart' as const, title: t('dashboard.viewUsage'), desc: t('dashboard.checkDetailedLogs') },
  ...(canUseBatchImage.value
    ? [{ to: '/batch-image', icon: 'sparkles' as const, title: t('dashboard.batchImageAgent'), desc: t('dashboard.batchImageAgentDesc') }]
    : []),
  { to: '/redeem', icon: 'gift' as const, title: t('dashboard.redeemCode'), desc: t('dashboard.addBalanceWithCode') }
])

onMounted(() => {
  void refreshBatchImageAccess()
})
</script>

<style scoped>
.quick-row + .quick-row {
  border-top: 1px solid var(--c-row-line);
}

.quick-row__btn {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
}

.quick-row__icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #e8f0fc;
  color: #14306b;
}
</style>

<style>
.dark .quick-row__icon {
  background: #15223f;
  color: #7aa2ff;
}
</style>
