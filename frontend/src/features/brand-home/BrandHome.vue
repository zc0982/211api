<template>
  <div class="brand-home">
    <a href="#bh-main" class="bh-skip" @click.prevent="scrollToId('bh-main', true)">{{ t('brandHome.a11y.skipToContent') }}</a>
    <SiteHeader :links="links" :site-name="siteName" @anchor="scrollToId" />
    <main id="bh-main" tabindex="-1">
      <HeroSection :links="links" :base-url="baseUrl" :model="HERO_DEFAULT_MODEL" :reduced-motion="reducedMotion" />
      <EcosystemSection />
      <QuickstartSection :links="links" :base-url="baseUrl" :model="HERO_DEFAULT_MODEL" :site-name="siteName" />
      <TraceabilitySection :links="links" />
      <FeaturesSection />
      <ModelPlazaSection :links="links" />
      <StatusSection v-if="liveStats && stats" :stats="stats" />
      <FaqSection :links="links" :base-url="baseUrl" :site-name="siteName" />
    </main>
    <FooterSection :links="links" :site-name="siteName" @anchor="scrollToId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import './styles/brand-home.css'
import serifTitleFont from './assets/fonts/noto-serif-sc-600.woff2?url'
import sansBodyFont from './assets/fonts/noto-sans-sc-400.woff2?url'
import { DEFAULT_SITE_NAME, HERO_DEFAULT_MODEL, liveStats } from './config'
import { resolveHomeLinks } from './composables/homeLinks'
import { normalizeApiBaseUrl } from './composables/baseUrl'
import { useReducedMotion } from './composables/useReducedMotion'
import SiteHeader from './sections/SiteHeader.vue'
import HeroSection from './sections/HeroSection.vue'
import EcosystemSection from './sections/EcosystemSection.vue'
import QuickstartSection from './sections/QuickstartSection.vue'
import TraceabilitySection from './sections/TraceabilitySection.vue'
import FeaturesSection from './sections/FeaturesSection.vue'
import ModelPlazaSection from './sections/ModelPlazaSection.vue'
import StatusSection, { type LiveStats } from './sections/StatusSection.vue'
import FaqSection from './sections/FaqSection.vue'
import FooterSection from './sections/FooterSection.vue'

/**
 * 211API 品牌首页。固定浅色：根节点自带底色、文字色与 color-scheme，
 * 不使用 dark: 变体，也不读写 html.dark。
 */
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => (settings.value?.site_name || '').trim() || DEFAULT_SITE_NAME)
const links = computed(() =>
  resolveHomeLinks(settings.value, { isAuthenticated: authStore.isAuthenticated, isAdmin: authStore.isAdmin })
)
const baseUrl = computed(() => normalizeApiBaseUrl(settings.value?.api_base_url, window.location.origin))
const reducedMotion = useReducedMotion()

/** No public stats endpoint yet; see config.liveStats. */
const stats: LiveStats | null = null

function scrollToId(id: string, focus = false) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reducedMotion.value ? 'auto' : 'smooth', block: 'start' })
  if (focus) el.focus({ preventScroll: true })
}

// Preload only the two first-screen faces (headline serif, body sans).
const preloads: HTMLLinkElement[] = []
for (const href of [serifTitleFont, sansBodyFont]) {
  if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.href = href
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
  preloads.push(link)
}

onMounted(() => {
  authStore.checkAuth()
})

onBeforeUnmount(() => {
  preloads.forEach((link) => link.remove())
})
</script>

<style scoped>
main:focus {
  outline: none;
}
</style>
