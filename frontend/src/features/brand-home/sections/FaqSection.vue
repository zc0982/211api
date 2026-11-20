<template>
  <section v-reveal class="bh-section bh-band" aria-labelledby="bh-faq-title">
    <div class="bh-container">
      <header class="bh-section-head bh-faq__head" data-reveal style="--bh-i: 0">
        <h2 id="bh-faq-title" class="bh-section-title">{{ t('brandHome.faq.title') }}</h2>
        <p v-if="links.docs && links.contact" class="bh-section-sub">{{ t('brandHome.faq.subtitleBoth') }}</p>
        <p v-else-if="links.docs" class="bh-section-sub">{{ t('brandHome.faq.subtitleDocs') }}</p>
        <p v-else-if="links.contact" class="bh-section-sub">{{ t('brandHome.faq.subtitleContact') }}</p>

        <div v-if="links.docs || links.contact" class="bh-faq__actions">
          <BrandButton v-if="links.docs" variant="outline" :href="links.docs">{{ t('brandHome.faq.docs') }}</BrandButton>
          <template v-if="links.contact">
            <BrandButton v-if="contactHref" :href="contactHref" arrow>{{ t('brandHome.faq.contact') }}</BrandButton>
            <BrandButton
              v-else
              arrow
              :aria-expanded="contactOpen"
              aria-controls="bh-faq-contact"
              @click="contactOpen = !contactOpen"
            >
              {{ t('brandHome.faq.contact') }}
            </BrandButton>
          </template>
        </div>
        <p v-if="links.contact && !contactHref && contactOpen" id="bh-faq-contact" class="bh-faq__contact">
          {{ t('brandHome.faq.contactLabel') }}<span class="bh-faq__contact-text">{{ links.contact.text }}</span>
        </p>
      </header>

      <div class="bh-faq__list" data-reveal style="--bh-i: 1">
        <details class="bh-faq__item" open>
          <summary class="bh-faq__q">
            <h3>{{ t('brandHome.faq.migrateQuestion', { site: siteName }) }}</h3>
            <span class="bh-faq__toggle" aria-hidden="true">
              <svg viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" /></svg>
            </span>
          </summary>
          <p class="bh-faq__a">{{ t('brandHome.faq.migrateAnswer', { baseUrl }) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandButton from '../components/BrandButton.vue'
import { vReveal } from '../composables/vReveal'
import type { HomeLinks } from '../composables/homeLinks'

/**
 * FAQ：只上线第一条（迁移），其余 5 条等待真实答案，见 docs/spec/brand-home.md。
 * contact_info 是自由文本：能校验成 http(s)/mailto 时作为链接，否则按纯文本展示。
 */
const props = defineProps<{ links: HomeLinks; baseUrl: string; siteName: string }>()
const { t } = useI18n()

const contactOpen = ref(false)
const contactHref = computed(() => props.links.contact?.href ?? null)
</script>

<style scoped>
.bh-faq__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}
.bh-faq__contact {
  margin: 16px 0 0;
  color: var(--bh-slate);
  font-size: 15px;
}
.bh-faq__contact-text {
  color: var(--bh-ink);
  white-space: pre-wrap;
  word-break: break-word;
}
.bh-faq__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bh-faq__item {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--bh-line);
  border-radius: 16px;
  background: rgba(246, 249, 254, 0.9);
}
.bh-faq__item[open] {
  border-color: rgba(191, 214, 246, 0.9);
  background: #fff;
  box-shadow: 0 12px 32px -12px rgba(20, 48, 107, 0.08);
}
.bh-faq__item[open]::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--bh-gold);
}
.bh-faq__q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 28px;
  list-style: none;
  cursor: pointer;
  border-radius: 16px;
}
/* Figma 1:3619: the open item gets 26px on top, collapsed items 22px. */
.bh-faq__item[open] .bh-faq__q {
  padding-top: 26px;
}
.bh-faq__q::-webkit-details-marker {
  display: none;
}
.bh-faq__q:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: -2px;
}
.bh-faq__q h3 {
  margin: 0;
  color: var(--bh-ink);
  font-size: 17px;
  font-weight: 500;
  line-height: 26px;
}
.bh-faq__toggle {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--bh-line);
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s var(--bh-ease);
}
.bh-faq__toggle path {
  fill: none;
  stroke: var(--bh-slate);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bh-faq__item[open] .bh-faq__toggle {
  border-color: var(--bh-navy);
  background: var(--bh-navy);
  transform: rotate(180deg);
}
.bh-faq__item[open] .bh-faq__toggle path {
  stroke: #fff;
}
.bh-faq__a {
  max-width: 840px;
  margin: -10px 0 0;
  padding: 0 28px 26px;
  color: var(--bh-slate);
  font-size: 15px;
  line-height: 26px;
  overflow-wrap: anywhere;
}
</style>
