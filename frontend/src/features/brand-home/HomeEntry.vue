<template>
  <UpstreamHome v-if="variant === 'upstream'" />
  <BrandHome v-else-if="variant === 'brand'" />
  <div v-else class="home-entry-loading" data-testid="home-entry-loading" aria-busy="true">
    <span /><span /><span />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useAppStore } from '@/stores'
import { resolveHomeVariant, type HomeVariant } from './composables/homeVariant'

/**
 * /home 入口：在上游首页和品牌首页之间二选一（规则见 resolveHomeVariant）。
 * 两个页面各自懒加载、各自成 chunk。设置未加载时先等待 fetchPublicSettings
 * （请求最长 30s 才超时），决定前只显示中性的加载占位，不渲染任何一页，
 * 避免先出一页再切换，也避免整页空白。
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

<style scoped>
.home-entry-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 100vh;
  min-height: 100dvh;
}
.home-entry-loading span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.25;
  animation: home-entry-pulse 1.2s ease-in-out infinite;
}
.home-entry-loading span:nth-child(2) {
  animation-delay: 0.15s;
}
.home-entry-loading span:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes home-entry-pulse {
  50% {
    opacity: 0.7;
  }
}
@media (prefers-reduced-motion: reduce) {
  .home-entry-loading span {
    animation: none;
    opacity: 0.4;
  }
}
</style>
