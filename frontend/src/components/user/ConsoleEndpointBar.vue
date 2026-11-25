<template>
  <!-- v3 密钥页端点条（Figma C2「API 端点」）：说明 + 地址胶囊 + 带文字的测速 / 复制。复制与测速链接沿用 EndpointPopover 的行为。 -->
  <section v-if="endpoints.length" class="console-endpoint-bar" :aria-labelledby="headingId">
    <div class="console-endpoint-intro">
      <span class="console-endpoint-icon" aria-hidden="true"><Icon name="server" size="sm" /></span>
      <div class="min-w-0">
        <h2 :id="headingId" class="console-endpoint-title">{{ t('keys.endpoints.title') }}</h2>
        <p class="console-endpoint-desc">{{ t('keys.endpoints.description') }}</p>
      </div>
    </div>
    <ul class="console-endpoint-list">
      <li v-for="item in endpoints" :key="item.endpoint" class="console-endpoint-pill">
        <span v-if="!item.isDefault" class="console-endpoint-name" :title="item.description || undefined">{{ item.name }}</span>
        <code class="console-endpoint-url">{{ item.endpoint }}</code>
        <span v-if="item.isDefault" class="console-endpoint-default">{{ t('keys.endpoints.default') }}</span>
        <a
          :href="speedTestUrl(item.endpoint)"
          target="_blank"
          rel="noopener noreferrer"
          class="console-endpoint-action"
          :aria-label="`${t('keys.endpoints.speedTest')} ${item.endpoint}`"
          data-test="endpoint-speed-test"
        >
          <Icon name="bolt" size="xs" />
          <span>{{ t('keys.endpoints.speedTest') }}</span>
        </a>
        <button
          type="button"
          class="console-endpoint-action console-endpoint-copy"
          :aria-label="copied === item.endpoint ? t('keys.endpoints.copiedHint') : `${t('keys.copyToClipboard')} ${item.endpoint}`"
          data-test="endpoint-copy"
          @click="copy(item.endpoint)"
        >
          <Icon :name="copied === item.endpoint ? 'check' : 'copy'" size="xs" />
          <span>{{ copied === item.endpoint ? t('keys.endpoints.copied') : t('common.copy') }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import type { CustomEndpoint } from '@/types'

const props = defineProps<{
  apiBaseUrl: string
  customEndpoints: CustomEndpoint[]
}>()

const { t } = useI18n()
const { copyToClipboard } = useClipboard()
const headingId = `console-endpoints-${useId()}`
const copied = ref<string | null>(null)
let resetTimer: number | undefined

const endpoints = computed(() => {
  const items: Array<{ name: string; endpoint: string; description: string; isDefault: boolean }> = []
  if (props.apiBaseUrl) {
    items.push({ name: t('keys.endpoints.title'), endpoint: props.apiBaseUrl, description: '', isDefault: true })
  }
  for (const ep of props.customEndpoints) items.push({ ...ep, isDefault: false })
  return items
})

async function copy(url: string) {
  if (!(await copyToClipboard(url, t('keys.endpoints.copied')))) return
  copied.value = url
  window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    if (copied.value === url) copied.value = null
  }, 1800)
}

function speedTestUrl(endpoint: string): string {
  return `https://www.tcptest.cn/http/${encodeURIComponent(endpoint)}`
}

onBeforeUnmount(() => window.clearTimeout(resetTimer))
</script>
