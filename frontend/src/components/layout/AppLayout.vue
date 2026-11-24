<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-950">
    <!-- Sidebar（夜空侧栏 / 图标栏 / 抽屉，见 AppSidebar.vue） -->
    <AppSidebar />

    <!-- Main Content Area: 248 / 72 / 0，随 useConsoleViewport 的三档宽度 -->
    <div class="relative min-h-screen transition-[margin] duration-300" :style="{ marginLeft: mainOffset }">
      <!-- Header -->
      <AppHeader />

      <!-- Main Content：内容区左右 40（平板 32、手机 16），见 DESIGN.md · Console -->
      <main class="console-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { useConsoleViewport } from '@/composables/useConsoleViewport'

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const { isPhone, isTablet } = useConsoleViewport()
const mainOffset = computed(() => {
  if (isPhone.value) return '0px'
  if (isTablet.value || sidebarCollapsed.value) return '72px'
  return '248px'
})
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>

<style scoped>
.console-main {
  padding: 20px 16px 36px;
}

@media (min-width: 768px) {
  .console-main {
    padding: 24px 32px 48px;
  }
}

@media (min-width: 1280px) {
  .console-main {
    padding: 28px 40px 56px;
  }
}
</style>
