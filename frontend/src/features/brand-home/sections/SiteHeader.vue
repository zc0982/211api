<template>
  <header class="bh-header bh-motion" :class="{ 'is-scrolled': scrolled }">
    <div class="bh-container bh-header__inner">
      <a href="#bh-top" class="bh-header__brand" :aria-label="siteName" @click.prevent="emit('anchor', 'bh-top')">
        <BrandLogo :name="siteName" />
      </a>
      <NavDock
        v-if="dockItems.length > 1"
        class="bh-header__dock"
        :items="dockItems"
        current="home"
        :label="t('brandHome.a11y.primaryNav')"
        @anchor="(id) => emit('anchor', id)"
      />
      <nav class="bh-header__actions" :aria-label="t('brandHome.a11y.accountNav')">
        <RouterLink v-if="links.console" :to="links.console" class="bh-header__text-link">
          {{ t('brandHome.nav.console') }}
        </RouterLink>
        <RouterLink v-else :to="links.login" class="bh-header__text-link">
          {{ t('brandHome.nav.login') }}
        </RouterLink>
        <BrandButton :to="links.getKey" size="sm" arrow>{{ t('brandHome.nav.getKey') }}</BrandButton>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandLogo from '../components/BrandLogo.vue'
import BrandButton from '../components/BrandButton.vue'
import NavDock, { type DockItem } from '../components/NavDock.vue'
import type { HomeLinks } from '../composables/homeLinks'

const props = defineProps<{ links: HomeLinks; siteName: string }>()
const emit = defineEmits<{ (e: 'anchor', id: string): void }>()
const { t } = useI18n()

/** Once the page scrolls, the bar gets a glass backdrop so content does not run under the wordmark. */
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
const dockItems = computed<DockItem[]>(() => {
  const items: DockItem[] = [{ key: 'home', label: t('brandHome.nav.home'), href: '#bh-top', anchor: 'bh-top' }]
  if (props.links.modelPlaza) items.push({ key: 'models', label: t('brandHome.nav.models'), to: props.links.modelPlaza })
  if (props.links.docs) items.push({ key: 'docs', label: t('brandHome.nav.docs'), href: props.links.docs, external: true })
  return items
})
</script>

<style scoped>
.bh-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 40;
  height: 72px;
  animation: bh-nav-in 0.5s var(--bh-ease) 0.1s both;
}
.bh-header::before {
  content: '';
  position: absolute;
  inset: 0;
  border-bottom: 1px solid rgba(220, 228, 242, 0.7);
  background: rgba(246, 249, 254, 0.72);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  backdrop-filter: blur(20px) saturate(1.4);
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
  justify-content: space-between;
  height: 100%;
}
.bh-header__brand {
  display: inline-flex;
  border-radius: 8px;
}
.bh-header__dock {
  position: absolute;
  left: 50%;
  top: 13px;
  transform: translateX(-50%);
}
.bh-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 3px 3px 6px;
  border: 1px solid rgba(12, 24, 48, 0.08);
  border-radius: 999px;
  background:
    linear-gradient(to bottom, rgba(255, 255, 255, 0.14), transparent 45%),
    rgba(255, 255, 255, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 8px 24px -8px rgba(12, 24, 48, 0.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  backdrop-filter: blur(20px) saturate(1.5);
}
.bh-header__text-link {
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--bh-slate);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  transition: color 0.2s;
}
.bh-header__text-link:hover {
  color: var(--bh-ink);
}
.bh-header__text-link:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}

@media (max-width: 860px) {
  .bh-header {
    height: 64px;
  }
  .bh-header__dock,
  .bh-header__text-link {
    display: none;
  }
  .bh-header__actions {
    padding: 3px;
  }
}
</style>
