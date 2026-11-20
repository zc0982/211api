<template>
  <header class="bh-header" :class="{ 'is-scrolled': scrolled }">
    <div class="bh-container bh-header__inner">
      <a href="#bh-top" class="bh-header__brand" :aria-label="siteName" @click.prevent="emit('anchor', 'bh-top')">
        <BrandLogo :name="siteName" :src="siteLogo" />
      </a>
      <nav v-if="navItems.length > 1" class="bh-header__nav" :aria-label="t('brandHome.a11y.primaryNav')">
        <template v-for="item in navItems" :key="item.key">
          <RouterLink v-if="item.to" :to="item.to" class="bh-header__link">{{ item.label }}</RouterLink>
          <a
            v-else
            :href="item.href"
            class="bh-header__link"
            :class="{ 'is-current': item.key === 'home' }"
            :aria-current="item.key === 'home' ? 'page' : undefined"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener' : undefined"
            @click="onClick(item, $event)"
          >
            {{ item.label }}
          </a>
        </template>
      </nav>
      <div class="bh-header__actions">
        <ThemeToggle :is-dark="isDark" @select="(value) => emit('theme', value)" />
        <nav class="bh-header__account" :aria-label="t('brandHome.a11y.accountNav')">
          <RouterLink v-if="links.console" :to="links.console" class="bh-header__ghost">
            {{ t('brandHome.nav.console') }}
          </RouterLink>
          <RouterLink v-else :to="links.login" class="bh-header__ghost">{{ t('brandHome.nav.login') }}</RouterLink>
          <BrandButton :to="links.getKey" variant="night" size="sm">{{ t('brandHome.nav.getKey') }}</BrandButton>
        </nav>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandLogo from '../components/BrandLogo.vue'
import BrandButton from '../components/BrandButton.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import type { HomeLinks } from '../composables/homeLinks'
import type { ThemePreference } from '../composables/useBrandTheme'

/**
 * v3 导航（Figma 46:3445）：直接压在夜空上，没有玻璃胶囊；当前项文字纯白，
 * 下方 6px 一条与文字等宽的 3px 月白横条带蓝色外发光。滚动离开首屏后加夜空色
 * 玻璃底，避免内容区里看不清。浅色、深色两版导航完全一样。
 */
interface NavItem {
  key: string
  label: string
  to?: string
  href?: string
  external?: boolean
  anchor?: string
}

const props = defineProps<{ links: HomeLinks; siteName: string; siteLogo?: string; isDark: boolean }>()
const emit = defineEmits<{ (e: 'anchor', id: string): void; (e: 'theme', value: ThemePreference): void }>()
const { t } = useI18n()

const scrolled = ref(false)
const onScroll = () => {
  scrolled.value = window.scrollY > 8
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

/** 「状态」没有公开页面，不渲染；「模型」「文档」按可见性显示。 */
const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [{ key: 'home', label: t('brandHome.nav.home'), href: '#bh-top', anchor: 'bh-top' }]
  if (props.links.modelPlaza) items.push({ key: 'models', label: t('brandHome.nav.models'), to: props.links.modelPlaza })
  if (props.links.docs) items.push({ key: 'docs', label: t('brandHome.nav.docs'), href: props.links.docs, external: true })
  return items
})

function onClick(item: NavItem, event: MouseEvent) {
  if (!item.anchor) return
  event.preventDefault()
  emit('anchor', item.anchor)
}
</script>

<style scoped>
.bh-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 40;
  height: 72px;
}
.bh-header::before {
  content: '';
  position: absolute;
  inset: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(5, 11, 24, 0.82);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  backdrop-filter: blur(16px) saturate(1.3);
  opacity: 0;
  transition: opacity 0.2s ease-out;
  pointer-events: none;
}
.bh-header.is-scrolled::before {
  opacity: 1;
}
.bh-header__inner {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
}
.bh-header__brand {
  display: inline-flex;
  border-radius: 8px;
  color: #fff;
}
/* The wordmark always sits on the night sky. */
.bh-header__brand :deep(.bh-logo) {
  color: #fff;
}
.bh-header__nav {
  display: flex;
  gap: 32px;
  margin-left: 72px;
}
.bh-header__link {
  position: relative;
  padding: 4px 0;
  color: var(--bh-night-slate);
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  transition: color 0.2s;
}
.bh-header__link:hover {
  color: #fff;
}
.bh-header__link.is-current {
  color: #fff;
}
.bh-header__link.is-current::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -6px;
  height: 3px;
  background: var(--bh-night-moon);
  box-shadow: 0 0 8px rgba(122, 162, 255, 0.85);
}
.bh-header__link:focus-visible,
.bh-header__ghost:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: 3px;
}
.bh-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.bh-header__account {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bh-header__ghost {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 17px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  color: var(--bh-night-ink);
  font-size: 14px;
  font-weight: 500;
  transition: border-color 160ms ease-out;
}
.bh-header__ghost:hover {
  border-color: rgba(255, 255, 255, 0.45);
}

@media (max-width: 860px) {
  .bh-header {
    height: 64px;
  }
  .bh-header__nav,
  .bh-header__ghost {
    display: none;
  }
}
</style>
