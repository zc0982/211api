<template>
  <footer class="bh-footer">
    <div class="bh-container bh-footer__row">
      <p class="bh-footer__copy">{{ t('brandHome.footer.copyright', { year, site: siteName }) }}</p>
      <nav class="bh-footer__links" :aria-label="t('brandHome.a11y.footerNav')">
        <a href="#bh-top" @click.prevent="emit('anchor', 'bh-top')">{{ t('brandHome.footer.home') }}</a>
        <RouterLink v-if="links.register" :to="links.register">{{ t('brandHome.footer.register') }}</RouterLink>
        <RouterLink v-if="links.modelPlaza" :to="links.modelPlaza">{{ t('brandHome.footer.pricing') }}</RouterLink>
        <RouterLink :to="links.keys">{{ t('brandHome.footer.keys') }}</RouterLink>
        <RouterLink v-if="links.console" :to="links.console">{{ t('brandHome.footer.console') }}</RouterLink>
        <RouterLink v-else :to="links.login">{{ t('brandHome.footer.login') }}</RouterLink>
      </nav>
      <LocaleToggle :label="t('brandHome.a11y.language')" />
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LocaleToggle from '../components/LocaleToggle.vue'
import type { HomeLinks } from '../composables/homeLinks'

/** 页脚。「关于」没有公开页面，不渲染。语言切换放在页脚右侧。 */
defineProps<{ links: HomeLinks; siteName: string }>()
const emit = defineEmits<{ (e: 'anchor', id: string): void }>()
const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<style scoped>
.bh-footer {
  border-top: 1px solid var(--bh-line);
  background: #fff;
}
.bh-footer__row {
  display: flex;
  align-items: center;
  gap: 40px;
  min-height: 88px;
  padding-top: 20px;
  padding-bottom: 20px;
}
.bh-footer__copy {
  margin: 0;
  color: var(--bh-mist);
  font-size: 13px;
  line-height: 20px;
}
.bh-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 40px;
  margin-left: auto;
}
.bh-footer__links a {
  color: var(--bh-slate);
  font-size: 14px;
  line-height: 20px;
  border-radius: 4px;
  transition: color 0.2s;
}
.bh-footer__links a:hover {
  color: var(--bh-ink);
}
.bh-footer__links a:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 3px;
}
@media (max-width: 860px) {
  .bh-footer__row {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    padding-top: 28px;
    padding-bottom: 28px;
  }
  .bh-footer__links {
    margin-left: 0;
    gap: 12px 24px;
  }
}
</style>
