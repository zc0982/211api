<template>
  <AppLayout>
    <div class="console-available-channels">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('availableChannels.title') }}</h1>
          <p class="page-description">{{ t('availableChannels.description') }}</p>
        </div>
      </header>
      <section :aria-label="t('availableChannels.filters')">
        <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div class="flex flex-1 flex-wrap items-center gap-3">
            <div class="relative w-full sm:w-80">
              <Icon
                name="search"
                size="md"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('availableChannels.searchPlaceholder')"
                :aria-label="t('availableChannels.searchPlaceholder')"
                class="input pl-10"
              />
            </div>
          </div>

          <div class="flex w-full flex-shrink-0 flex-wrap items-center justify-end gap-3 lg:w-auto">
            <button
              @click="loadChannels"
              :disabled="loading"
              class="btn btn-secondary"
              :title="t('common.refresh', 'Refresh')"
              :aria-label="t('common.refresh')"
            >
              <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
            </button>
          </div>
        </div>
        <div class="console-channel-platforms" role="group" :aria-label="t('availableChannels.platformFilter')">
          <button class="btn btn-secondary" :class="{ 'is-active': !selectedPlatform }" :aria-pressed="!selectedPlatform" @click="selectedPlatform = ''">{{ t('common.all') }}</button>
          <button v-for="platform in platforms" :key="platform" class="btn btn-secondary" :class="{ 'is-active': selectedPlatform === platform }" :aria-pressed="selectedPlatform === platform" @click="selectedPlatform = platform">
            <PlatformIcon :platform="platform as GroupPlatform" :data-console-platform="platform" size="sm" />{{ platform }}
          </button>
          <span class="console-channel-count">{{ t('availableChannels.count', { count: filteredChannels.length }) }}</span>
        </div>
      </section>

      <div v-if="loadError" class="console-channel-error" role="alert">
        <p>{{ loadError }}</p>
        <button class="btn btn-secondary" :disabled="loading" @click="loadChannels">{{ t('common.tryAgain') }}</button>
      </div>
      <section v-else class="card console-channel-table">
        <AvailableChannelsTable
          :columns="columnLabels"
          :rows="filteredChannels"
          :loading="loading"
          :user-group-rates="userGroupRates"
          pricing-key-prefix="availableChannels.pricing"
          :no-pricing-label="t('availableChannels.noPricing')"
          :no-models-label="t('availableChannels.noModels')"
          :empty-label="t(channels.length ? 'availableChannels.noMatch' : 'availableChannels.empty')"
          console
        />
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { GroupPlatform } from '@/types'
import '@/styles/console-channel-pages.css'
import Icon from '@/components/icons/Icon.vue'
import AvailableChannelsTable from '@/components/channels/AvailableChannelsTable.vue'
import userChannelsAPI, { type UserAvailableChannel } from '@/api/channels'
import userGroupsAPI from '@/api/groups'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()

const channels = ref<UserAvailableChannel[]>([])
const userGroupRates = ref<Record<number, number>>({})
const loading = ref(false)
const searchQuery = ref('')
const selectedPlatform = ref('')
const loadError = ref('')
const platforms = computed(() => [...new Set(channels.value.flatMap(ch => ch.platforms.map(p => p.platform)))])

const columnLabels = computed(() => ({
  name: t('availableChannels.columns.name'),
  description: t('availableChannels.columns.description'),
  platform: t('availableChannels.columns.platform'),
  groups: t('availableChannels.columns.groups'),
  supportedModels: t('availableChannels.columns.supportedModels'),
}))

/**
 * 搜索过滤：
 * - 命中渠道名/描述 → 整个渠道（所有 platforms）都保留
 * - 否则按 platform/group/model 维度在 sections 里过滤，保留有匹配的 section
 * - 所有 sections 都不匹配时，渠道本身被过滤掉
 */
const filteredChannels = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return channels.value
    .map((ch) => {
      const sections = ch.platforms.filter(p => !selectedPlatform.value || p.platform === selectedPlatform.value)
      const nameHit = ch.name.toLowerCase().includes(q)
      const descHit = (ch.description || '').toLowerCase().includes(q)
      if (!q || nameHit || descHit) return sections.length ? { ...ch, platforms: sections } : null
      const matchingSections = sections.filter(
        (p) =>
          p.platform.toLowerCase().includes(q) ||
          p.groups.some((g) => g.name.toLowerCase().includes(q)) ||
          p.supported_models.some((m) => m.name.toLowerCase().includes(q)),
      )
      if (matchingSections.length === 0) return null
      return { ...ch, platforms: matchingSections }
    })
    .filter((ch): ch is UserAvailableChannel => ch !== null)
})

async function loadChannels() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    // 渠道列表和用户专属倍率并发拉取。专属倍率失败不阻塞渠道展示——
    // 失败时只是无法渲染专属倍率角标，降级为仅显示默认倍率。
    const [list, rates] = await Promise.all([
      userChannelsAPI.getAvailable(),
      userGroupsAPI.getUserGroupRates().catch((err: unknown) => {
        console.error('Failed to load user group rates:', err)
        return {} as Record<number, number>
      }),
    ])
    channels.value = list
    userGroupRates.value = rates
    if (selectedPlatform.value && !platforms.value.includes(selectedPlatform.value)) selectedPlatform.value = ''
  } catch (err: unknown) {
    loadError.value = extractApiErrorMessage(err, t('availableChannels.loadFailed'))
    appStore.showError(loadError.value)
  } finally {
    loading.value = false
  }
}

onMounted(loadChannels)
</script>
