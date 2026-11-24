<template>
  <div ref="rootEl" class="brand-home">
    <a href="#bh-main" class="bh-skip" @click.prevent="scrollToId('bh-main', true)">{{ t('brandHome.a11y.skipToContent') }}</a>
    <SiteHeader
      :links="links"
      :site-name="siteName"
      :site-logo="siteLogo"
      :is-dark="theme.isDark.value"
      @anchor="scrollToId"
      @theme="theme.setPreference"
    />
    <main id="bh-main" tabindex="-1">
      <HeroStarlink :links="links" />
      <QuickStart :links="links" :base-url="baseUrl" :site-name="siteName" />
      <CallLog :links="links" />
      <KeyBudget :links="links" />
      <Features />
      <ModelPlazaSection :links="links" />
      <StatusSection v-if="liveStats && stats" :stats="stats" />
      <FaqSection :links="links" :base-url="baseUrl" :site-name="siteName" />
    </main>
    <FooterSite :links="links" :site-name="siteName" :site-logo="siteLogo" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import './styles/brand-home.css'
import { DEFAULT_SITE_NAME, liveStats } from './config'
import { resolveHomeLinks } from './composables/homeLinks'
import { normalizeApiBaseUrl } from './composables/baseUrl'
import { useReducedMotion } from './composables/useReducedMotion'
import { useBrandTheme } from './composables/useBrandTheme'
import SiteHeader from './sections/SiteHeader.vue'
import HeroStarlink from './sections/HeroStarlink.vue'
import QuickStart from './sections/QuickStart.vue'
import CallLog from './sections/CallLog.vue'
import KeyBudget from './sections/KeyBudget.vue'
import Features from './sections/Features.vue'
import ModelPlazaSection from './sections/ModelPlazaSection.vue'
import StatusSection, { type LiveStats } from './sections/StatusSection.vue'
import FaqSection from './sections/FaqSection.vue'
import FooterSite from './sections/FooterSite.vue'

/**
 * 211API 品牌首页。主题跟随系统，可在导航里手动切换（composables/useBrandTheme）：
 * 与控制台共用 html.dark 和 localStorage `theme`。颜色全部走 CSS 变量
 * （styles/brand-home.css 的 .brand-home / .dark .brand-home），不用 dark: 变体。
 */
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => (settings.value?.site_name || '').trim() || DEFAULT_SITE_NAME)
/** 后台「站点 Logo」为准（与控制台、登录页同一来源）；未上传时用内置星狐头像 /logo.svg。 */
const siteLogo = computed(() =>
  sanitizeUrl(settings.value?.site_logo || '', { allowRelative: true, allowDataUrl: true })
)
const links = computed(() =>
  resolveHomeLinks(settings.value, { isAuthenticated: authStore.isAuthenticated, isAdmin: authStore.isAdmin })
)
const baseUrl = computed(() => normalizeApiBaseUrl(settings.value?.api_base_url, window.location.origin))
const reducedMotion = useReducedMotion()
const rootEl = ref<HTMLElement | null>(null)
const theme = useBrandTheme(rootEl)

/** No public stats endpoint yet; see config.liveStats. */
const stats: LiveStats | null = null

function scrollToId(id: string, focus = false) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reducedMotion.value ? 'auto' : 'smooth', block: 'start' })
  if (focus) el.focus({ preventScroll: true })
}

onMounted(() => {
  authStore.checkAuth()
})
</script>

<style scoped>
main:focus {
  outline: none;
}
</style>
