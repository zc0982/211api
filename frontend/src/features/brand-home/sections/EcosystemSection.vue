<template>
  <section v-reveal class="bh-eco" aria-labelledby="bh-eco-title">
    <div class="bh-container">
      <div class="bh-eco__label" data-reveal style="--bh-i: 0">
        <span class="bh-eco__rule" aria-hidden="true" />
        <h2 id="bh-eco-title" class="bh-eco__title">{{ t('brandHome.ecosystem.title') }}</h2>
        <span class="bh-eco__rule" aria-hidden="true" />
      </div>
      <ul class="bh-eco__tiles" data-reveal style="--bh-i: 1">
        <li v-for="tool in tools" :key="tool.id" class="bh-eco__tile">
          <span class="bh-eco__mono" aria-hidden="true"><ToolIcon :tool="tool.id" :size="26" /></span>
          <span class="bh-eco__name">{{ tool.name }}</span>
          <span class="bh-eco__caption">{{ tool.caption }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolIcon from '../components/ToolIcon.vue'
import { vReveal } from '../composables/vReveal'
import { ECOSYSTEM_TOOLS, type EcosystemTool } from '../config'

const { t } = useI18n()

const captions = computed<Record<EcosystemTool, string>>(() => ({
  claudeCode: t('brandHome.ecosystem.captionCli'),
  codex: t('brandHome.ecosystem.captionCli'),
  cursor: t('brandHome.ecosystem.captionEditor'),
  deepseekHarness: t('brandHome.ecosystem.captionDeepseek'),
  pi: t('brandHome.ecosystem.captionCli'),
  hermes: t('brandHome.ecosystem.captionHermes'),
  openCode: t('brandHome.ecosystem.captionOpenCode'),
  openClaw: t('brandHome.ecosystem.captionOpenClaw')
}))

const tools = computed(() => ECOSYSTEM_TOOLS.map((tool) => ({ ...tool, caption: captions.value[tool.id] })))
</script>

<style scoped>
/* Attached strip under the hero: top 40 / bottom 64 instead of 96/96. */
.bh-eco {
  padding: 40px 0 64px;
}
.bh-eco__label {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
}
.bh-eco__rule {
  flex: 1;
  height: 1px;
  background: var(--bh-line);
}
.bh-eco__title {
  margin: 0;
  color: var(--bh-slate);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}
.bh-eco__tiles {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-eco__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 144px;
  padding: 24px 8px 20px;
  border: 1px solid var(--bh-glass-edge);
  border-radius: 16px;
  background: rgb(var(--brand-surface) / 0.72);
  box-shadow: 0 8px 24px -8px rgb(var(--bh-shadow-navy) / min(calc(0.06 * var(--bh-shadow-k)), 0.5));
  text-align: center;
}
.bh-eco__mono {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  border: 1px solid var(--bh-sky);
  border-radius: 12px;
  background: var(--bh-surface);
}
.bh-eco__name {
  color: var(--bh-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}
.bh-eco__caption {
  margin-top: 2px;
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}

@media (max-width: 1100px) {
  .bh-eco__tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .bh-eco__tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .bh-eco__title {
    white-space: normal;
    text-align: center;
  }
}
</style>
