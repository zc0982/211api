<template>
  <footer class="bh-footer">
    <PixelStage :width="SCENE_WIDTH" :height="FOOTER_STAGE_HEIGHT">
      <SiteScene
        :labels="{
          firstToken: t('brandHome.footer.chipFirstToken'),
          cache: t('brandHome.footer.chipCache'),
          context: t('brandHome.footer.chipContext')
        }"
      />
    </PixelStage>

    <div class="bh-container bh-footer__base">
      <div class="bh-footer__brand">
        <BrandLogo :name="siteName" :src="siteLogo" />
        <p class="bh-footer__tagline">{{ t('brandHome.footer.tagline') }}</p>
        <p class="bh-footer__copy bh-mono">{{ t('brandHome.footer.copyright', { year, site: siteName }) }}</p>
        <p class="bh-footer__note">{{ t('brandHome.footer.siteNote') }}</p>
        <LocaleToggle class="bh-footer__locale" :label="t('brandHome.a11y.language')" />
      </div>
      <nav class="bh-footer__cols" :aria-label="t('brandHome.a11y.footerNav')">
        <div class="bh-footer__col">
          <h2>{{ t('brandHome.footer.product') }}</h2>
          <RouterLink v-if="links.modelPlaza" :to="links.modelPlaza">{{ t('brandHome.footer.pricing') }}</RouterLink>
          <RouterLink :to="links.keys">{{ t('brandHome.footer.keys') }}</RouterLink>
          <RouterLink v-if="links.console" :to="links.console">{{ t('brandHome.footer.console') }}</RouterLink>
          <a v-if="links.docs" :href="links.docs" target="_blank" rel="noopener">{{ t('brandHome.nav.docs') }}</a>
        </div>
        <div class="bh-footer__col">
          <h2>{{ t('brandHome.footer.account') }}</h2>
          <RouterLink v-if="links.register" :to="links.register">{{ t('brandHome.footer.register') }}</RouterLink>
          <RouterLink v-if="!links.console" :to="links.login">{{ t('brandHome.footer.login') }}</RouterLink>
          <RouterLink v-else :to="links.console">{{ t('brandHome.footer.console') }}</RouterLink>
        </div>
      </nav>
    </div>

    <p class="bh-sr-only">{{ t('brandHome.footer.sceneSummary') }}</p>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BrandLogo from '../components/BrandLogo.vue'
import LocaleToggle from '../components/LocaleToggle.vue'
import PixelStage from '../components/PixelStage.vue'
import SiteScene from '../components/SiteScene.vue'
import type { HomeLinks } from '../composables/homeLinks'
import { FOOTER_STAGE_HEIGHT, SCENE_WIDTH } from '../config'

/**
 * 页脚 · 新教学楼工地（Figma 46:3761）：上半是像素工地场景（第 0 秒静态），
 * 下半是夜色底上的链接。两种主题下都是夜色。「关于」没有公开页面，不渲染；
 * 其余链接按可见性显示（同 v2）。语言切换放在品牌信息下方。
 */
defineProps<{ links: HomeLinks; siteName: string; siteLogo?: string }>()
const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<style scoped>
.bh-footer {
  /* Night palette for the shared components rendered here (LocaleToggle). */
  --bh-surface: rgba(255, 255, 255, 0.04);
  --bh-line: rgba(255, 255, 255, 0.14);
  --bh-tint: rgba(219, 230, 251, 0.12);
  --bh-navy: var(--bh-night-moon);
  --bh-ink: var(--bh-night-ink);
  --bh-slate: var(--bh-night-slate);
  --bh-blue: var(--bh-night-blue);

  background: var(--bh-night-footer);
  color: var(--bh-night-slate);
}
.bh-footer__base {
  display: flex;
  justify-content: space-between;
  gap: 48px;
  padding-top: 8px;
  padding-bottom: 56px;
}
.bh-footer__brand {
  color: #fff;
}
.bh-footer__brand :deep(.bh-logo) {
  color: #fff;
}
.bh-footer__tagline {
  margin: 14px 0 0;
  color: var(--bh-night-slate);
  font-size: 14px;
  line-height: 17px;
}
.bh-footer__copy {
  margin: 13px 0 0;
  color: var(--bh-night-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-footer__note {
  margin: 10px 0 0;
  color: var(--bh-night-mist);
  font-size: 12px;
  line-height: 14px;
}
.bh-footer__locale {
  margin-top: 20px;
}
.bh-footer__cols {
  display: flex;
  gap: 94px;
  /* Columns start at x = 900 / 1050 of the 1440 board (the「关于」column is hidden). */
  padding-right: 214px;
}
.bh-footer__col {
  display: flex;
  flex-direction: column;
  gap: 13px;
  min-width: 56px;
}
.bh-footer__col h2 {
  margin: 0 0 4px;
  color: var(--bh-night-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 17px;
}
.bh-footer__col a {
  color: var(--bh-night-slate);
  font-size: 14px;
  line-height: 17px;
  border-radius: 4px;
  transition: color 0.2s;
}
.bh-footer__col a:hover {
  color: #fff;
}
.bh-footer__col a:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: 3px;
}

@media (max-width: 860px) {
  .bh-footer__base {
    flex-direction: column;
    gap: 32px;
    padding-top: 24px;
  }
  .bh-footer__cols {
    gap: 56px;
    padding-right: 0;
  }
}
</style>
