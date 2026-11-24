<template>
  <AppLayout>
    <div class="space-y-5">
      <!-- Page header：问候 + 今日概况（Figma C1「Page header」） -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="min-w-0 flex-1">
          <h1 class="page-title">{{ greeting }}</h1>
          <p v-if="stats" class="page-description">{{ todaySummary }}</p>
        </div>
        <div v-if="!authStore.isSimpleMode" class="flex flex-wrap gap-2">
          <router-link to="/redeem" class="btn btn-secondary">
            <Icon name="gift" size="sm" />
            {{ t('dashboard.redeemCode') }}
          </router-link>
          <router-link to="/keys" class="btn btn-primary">
            <Icon name="plus" size="sm" />
            {{ t('dashboard.createApiKey') }}
          </router-link>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-12"><LoadingSpinner /></div>
      <template v-else-if="stats">
        <UserDashboardOverview
          :balance="user?.balance || 0"
          :stats="stats"
          :platform-quotas="platformQuotas"
          :last-call="recentUsage[0] ?? null"
          :is-simple="authStore.isSimpleMode"
          :payment-enabled="paymentEnabled"
        />
        <UserDashboardStats :stats="stats" :balance="user?.balance || 0" :is-simple="authStore.isSimpleMode" :platform-quotas="platformQuotas" />
        <UserDashboardCharts v-model:startDate="startDate" v-model:endDate="endDate" v-model:granularity="granularity" :loading="loadingCharts" :trend="trendData" :models="modelStats" @dateRangeChange="loadCharts" @granularityChange="loadCharts" @refresh="refreshAll" />
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <UserDashboardRecentUsage :data="recentUsage" :loading="loadingUsage" />
          <UserDashboardQuickActions />
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'; import { useAuthStore } from '@/stores/auth'; import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import AppLayout from '@/components/layout/AppLayout.vue'; import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import UserDashboardStats from '@/components/user/dashboard/UserDashboardStats.vue'; import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'
import UserDashboardRecentUsage from '@/components/user/dashboard/UserDashboardRecentUsage.vue'; import UserDashboardQuickActions from '@/components/user/dashboard/UserDashboardQuickActions.vue'
import UserDashboardOverview from '@/components/user/dashboard/UserDashboardOverview.vue'
import Icon from '@/components/icons/Icon.vue'
import { useI18n } from 'vue-i18n'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import type { UsageLog, TrendDataPoint, ModelStat, PlatformQuotaItem } from '@/types'
import { getMyPlatformQuotas } from '@/api/user'
import { formatDateLocalInput } from '@/utils/format'

const authStore = useAuthStore(); const user = computed(() => authStore.user)
const { t } = useI18n()
const paymentEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.payment))
// 问候语按本地时间：5–12 早上、12–18 下午、其余晚上
const greeting = computed(() => {
  const name = user.value?.username || user.value?.email?.split('@')[0] || ''
  const hour = new Date().getHours()
  const key = hour >= 5 && hour < 12 ? 'greetingMorning' : hour >= 12 && hour < 18 ? 'greetingAfternoon' : 'greetingEvening'
  return t(`dashboard.${key}`, { name })
})
const todaySummary = computed(() =>
  t('dashboard.todaySummary', {
    requests: (stats.value?.today_requests || 0).toLocaleString('en-US'),
    cost: '$' + (stats.value?.today_actual_cost || 0).toFixed(2)
  })
)
const stats = ref<UserStatsType | null>(null); const loading = ref(false); const loadingUsage = ref(false); const loadingCharts = ref(false)
const trendData = ref<TrendDataPoint[]>([]); const modelStats = ref<ModelStat[]>([]); const recentUsage = ref<UsageLog[]>([])
const platformQuotas = ref<PlatformQuotaItem[] | null>(null)

const startDate = ref(formatDateLocalInput(new Date(Date.now() - 6 * 86400000))); const endDate = ref(formatDateLocalInput(new Date())); const granularity = ref('day')

const loadStats = async () => { loading.value = true; try { await authStore.refreshUser(); stats.value = await usageAPI.getDashboardStats() } catch (error) { console.error('Failed to load dashboard stats:', error) } finally { loading.value = false } }
const loadCharts = async () => { loadingCharts.value = true; try { const res = await Promise.all([usageAPI.getDashboardTrend({ start_date: startDate.value, end_date: endDate.value, granularity: granularity.value as any }), usageAPI.getDashboardModels({ start_date: startDate.value, end_date: endDate.value })]); trendData.value = res[0].trend || []; modelStats.value = res[1].models || [] } catch (error) { console.error('Failed to load charts:', error) } finally { loadingCharts.value = false } }
const loadRecent = async () => { loadingUsage.value = true; try { const res = await usageAPI.getByDateRange(startDate.value, endDate.value); recentUsage.value = res.items.slice(0, 5) } catch (error) { console.error('Failed to load recent usage:', error) } finally { loadingUsage.value = false } }
const loadPlatformQuotas = async () => { try { const data = await getMyPlatformQuotas(); platformQuotas.value = data.platform_quotas ?? [] } catch (error) { console.warn('Failed to load platform quotas:', error); platformQuotas.value = [] } }
const refreshAll = () => { loadStats(); loadCharts(); loadRecent(); loadPlatformQuotas() }

onMounted(() => { refreshAll() })
</script>
