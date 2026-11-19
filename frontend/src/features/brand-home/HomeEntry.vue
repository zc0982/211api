<template>
  <UpstreamHome v-if="variant === 'upstream'" />
  <BrandHome v-else-if="variant === 'brand'" />
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useAppStore } from '@/stores'
import { resolveHomeVariant, type HomeVariant } from './composables/homeVariant'

/**
 * /home 入口：在上游首页和品牌首页之间二选一（规则见 resolveHomeVariant）。
 * 两个页面各自懒加载、各自成 chunk。设置未加载时先等待 fetchPublicSettings，
 * 决定前不渲染任何一页，避免先出一页再切换。
 */
const UpstreamHome = defineAsyncComponent(() => import('@/views/HomeView.vue'))
const BrandHome = defineAsyncComponent(() => import('./BrandHome.vue'))

const appStore = useAppStore()
const variant = ref<HomeVariant | null>(null)

function decide() {
  const settings = appStore.publicSettingsLoaded ? appStore.cachedPublicSettings : null
  variant.value = resolveHomeVariant(settings, { VITE_BRAND_HOME: import.meta.env.VITE_BRAND_HOME })
}

if (appStore.publicSettingsLoaded) {
  decide()
} else {
  Promise.resolve()
    .then(() => appStore.fetchPublicSettings())
    .catch(() => null)
    .finally(decide)
}
</script>
