<template>
  <section v-reveal class="bh-section bh-band bh-qs" aria-labelledby="bh-qs-title">
    <span class="bh-qs__bloom bh-qs__bloom--blue" aria-hidden="true" />
    <span class="bh-qs__bloom bh-qs__bloom--gold" aria-hidden="true" />
    <div class="bh-container">
      <header class="bh-section-head" data-reveal style="--bh-i: 0">
        <h2 id="bh-qs-title" class="bh-section-title">{{ t('brandHome.quickstart.title') }}</h2>
        <p class="bh-section-sub">{{ t('brandHome.quickstart.subtitle') }}</p>
      </header>

      <div class="bh-qs__grid">
        <ol class="bh-qs__steps" data-reveal style="--bh-i: 1">
          <li class="bh-qs__step">
            <span class="bh-qs__num bh-mono" aria-hidden="true">01</span>
            <div>
              <h3 class="bh-qs__step-title">{{ t('brandHome.quickstart.step1Title') }}</h3>
              <p class="bh-qs__step-desc">{{ t('brandHome.quickstart.step1Desc') }}</p>
            </div>
          </li>
          <li class="bh-qs__step is-active">
            <span class="bh-qs__num bh-mono" aria-hidden="true">02</span>
            <div>
              <h3 class="bh-qs__step-title">{{ t('brandHome.quickstart.step2Title', { site: siteName }) }}</h3>
              <p class="bh-qs__step-desc">
                <code class="bh-qs__url bh-mono">{{ baseUrl }}</code>
                {{ t('brandHome.quickstart.step2Desc') }}
              </p>
            </div>
          </li>
          <li class="bh-qs__step">
            <span class="bh-qs__num bh-mono" aria-hidden="true">03</span>
            <div>
              <h3 class="bh-qs__step-title">{{ t('brandHome.quickstart.step3Title') }}</h3>
              <p class="bh-qs__step-desc">{{ t('brandHome.quickstart.step3Desc') }}</p>
            </div>
          </li>
        </ol>

        <div class="bh-qs__card" data-reveal style="--bh-i: 2">
          <div class="bh-qs__bar">
            <div class="bh-qs__tabs" role="tablist" :aria-label="t('brandHome.quickstart.languageTabs')" @keydown="onTabKey">
              <button
                v-for="(sample, index) in samples"
                :id="`bh-qs-tab-${sample.language}`"
                :key="sample.language"
                :ref="(el) => (tabRefs[index] = el as HTMLButtonElement | null)"
                type="button"
                role="tab"
                class="bh-qs__tab bh-mono"
                :class="{ 'is-on': sample.language === language }"
                :aria-selected="sample.language === language"
                :aria-controls="`bh-qs-panel`"
                :tabindex="sample.language === language ? 0 : -1"
                @click="language = sample.language"
              >
                <i v-if="sample.language === language" aria-hidden="true" />{{ sample.label }}
              </button>
            </div>
            <div class="bh-qs__tools">
              <span class="bh-qs__file bh-mono">{{ current.filename }}</span>
              <button type="button" class="bh-qs__copy" @click="copy">
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" />
                  <rect x="4.5" y="3.5" width="8.5" height="9.5" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4" />
                </svg>
                <span>{{ copyLabel }}</span>
              </button>
              <span class="bh-sr-only" aria-live="polite">{{ copyState === 'idle' ? '' : copyLabel }}</span>
            </div>
          </div>

          <div
            id="bh-qs-panel"
            class="bh-qs__code"
            role="tabpanel"
            :aria-labelledby="`bh-qs-tab-${current.language}`"
            tabindex="0"
          >
            <pre class="bh-mono"><code><span
              v-for="(line, index) in current.lines"
              :key="index"
              class="bh-qs__line"
              :class="{ 'is-hl': index + 1 === current.highlight }"
            ><span class="bh-qs__ln" aria-hidden="true">{{ index + 1 }}</span><span
              v-for="(token, ti) in line"
              :key="ti"
              :class="`tk-${token[1]}`"
            >{{ token[0] }}</span></span></code></pre>
          </div>

          <div class="bh-qs__result">
            <StatusBadge label="200 OK" />
            <span class="bh-qs__result-text bh-mono">
              {{ model }} · {{ t('brandHome.quickstart.firstToken') }} 312ms · 1,590 tokens · $0.0042
            </span>
            <RouterLink :to="links.usage" class="bh-qs__link">{{ t('brandHome.quickstart.viewLogs') }} →</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '../components/StatusBadge.vue'
import { vReveal } from '../composables/vReveal'
import { buildSamples, sampleToText, type SampleLanguage } from '../composables/codeSamples'
import type { HomeLinks } from '../composables/homeLinks'
import { API_KEY_PLACEHOLDER } from '../config'

const props = defineProps<{ links: HomeLinks; baseUrl: string; model: string; siteName: string }>()
const { t } = useI18n()

const language = ref<SampleLanguage>('python')
const tabRefs = ref<(HTMLButtonElement | null)[]>([])

const samples = computed(() =>
  buildSamples({
    baseUrl: props.baseUrl,
    model: props.model,
    apiKey: API_KEY_PLACEHOLDER,
    greeting: t('brandHome.quickstart.sampleGreeting', { site: props.siteName }),
    comment: t('brandHome.quickstart.codeComment')
  })
)
const current = computed(() => samples.value.find((s) => s.language === language.value) ?? samples.value[0])

function onTabKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  const list = samples.value
  const index = list.findIndex((s) => s.language === language.value)
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % list.length
  if (event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = list.length - 1
  language.value = list[next].language
  tabRefs.value[next]?.focus()
}

const copyState = ref<'idle' | 'done' | 'failed'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | null = null
const copyLabel = computed(() =>
  copyState.value === 'done'
    ? t('brandHome.quickstart.copied')
    : copyState.value === 'failed'
      ? t('brandHome.quickstart.copyFailed')
      : t('brandHome.quickstart.copy')
)

function fallbackCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(area)
  return ok
}

async function copy() {
  const text = sampleToText(current.value)
  let ok = false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ok = true
    } else {
      ok = fallbackCopy(text)
    }
  } catch {
    ok = fallbackCopy(text)
  }
  copyState.value = ok ? 'done' : 'failed'
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copyState.value = 'idle'), 1600)
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style scoped>
.bh-qs {
  overflow: hidden;
}
.bh-qs__bloom {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.bh-qs__bloom--blue {
  left: calc(50% - 220px);
  top: 120px;
  width: 1000px;
  height: 700px;
  background: radial-gradient(closest-side, rgba(191, 214, 246, 0.55), rgba(191, 214, 246, 0.18) 55%, transparent);
}
.bh-qs__bloom--gold {
  left: calc(50% + 160px);
  top: 320px;
  width: 540px;
  height: 420px;
  background: radial-gradient(closest-side, rgba(212, 168, 75, 0.16), transparent);
}

.bh-qs__grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 456px) minmax(0, 1fr);
  align-items: center;
  gap: 48px;
}

.bh-qs__steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bh-qs__step {
  position: relative;
  display: flex;
  gap: 20px;
  padding: 24px 28px;
  border-radius: 14px;
  overflow: hidden;
}
.bh-qs__step.is-active {
  background: rgba(232, 240, 252, 0.72);
}
.bh-qs__step.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--bh-gold);
}
.bh-qs__num {
  flex: none;
  width: 16px;
  color: var(--bh-mist);
  font-size: 13px;
  font-weight: 500;
  line-height: 28px;
}
.is-active .bh-qs__num {
  color: var(--bh-bronze);
}
.bh-qs__step-title {
  margin: 0;
  color: var(--bh-slate);
  font-size: 18px;
  font-weight: 500;
  line-height: 28px;
}
.is-active .bh-qs__step-title {
  color: var(--bh-ink);
}
.bh-qs__step-desc {
  margin: 6px 0 0;
  color: var(--bh-mist);
  font-size: 14px;
  line-height: 22px;
}
.is-active .bh-qs__step-desc {
  color: var(--bh-slate);
}
.bh-qs__url {
  display: block;
  color: var(--bh-navy);
  word-break: break-all;
}

.bh-qs__card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 12px 32px -8px rgba(20, 48, 107, 0.08);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-qs__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(220, 228, 242, 0.8);
}
.bh-qs__tabs {
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(232, 240, 252, 0.8);
}
.bh-qs__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--bh-mist);
  font-size: 13px;
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
}
.bh-qs__tab:hover {
  color: var(--bh-ink);
}
.bh-qs__tab.is-on {
  background: #fff;
  color: var(--bh-navy);
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(20, 48, 107, 0.1);
}
.bh-qs__tab i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bh-gold);
}
.bh-qs__tab:focus-visible,
.bh-qs__copy:focus-visible,
.bh-qs__code:focus-visible,
.bh-qs__link:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}
.bh-qs__tools {
  display: inline-flex;
  align-items: center;
  gap: 16px;
}
.bh-qs__file {
  color: var(--bh-mist);
  font-size: 12px;
}
.bh-qs__copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: #fff;
  color: var(--bh-slate);
  font-family: var(--bh-font-sans);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.bh-qs__copy:hover {
  color: var(--bh-ink);
  border-color: var(--bh-sky);
}

.bh-qs__code {
  overflow-x: auto;
  padding: 20px 0 24px;
}
.bh-qs__code pre {
  margin: 0;
  font-size: 13px;
  line-height: 24px;
  color: var(--bh-ink);
}
.bh-qs__line {
  display: block;
  min-width: max-content;
  padding-right: 24px;
}
.bh-qs__line.is-hl {
  background: rgba(212, 168, 75, 0.14);
  box-shadow: inset 2px 0 0 var(--bh-gold);
}
.bh-qs__ln {
  display: inline-block;
  width: 44px;
  margin-right: 20px;
  color: rgba(102, 115, 140, 0.7);
  text-align: right;
  user-select: none;
}
.tk-kw {
  color: var(--bh-navy);
  font-weight: 500;
}
.tk-key {
  color: var(--bh-navy);
}
.tk-fn {
  color: var(--bh-blue);
}
.tk-str {
  color: var(--bh-bronze);
}
.tk-punct {
  color: var(--bh-slate);
}
.tk-comment {
  color: var(--bh-mist);
}

.bh-qs__result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid rgba(220, 228, 242, 0.8);
  background: rgba(246, 249, 254, 0.7);
}
.bh-qs__result-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--bh-slate);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bh-qs__link {
  flex: none;
  color: var(--bh-blue);
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}
.bh-qs__link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 1100px) {
  .bh-qs__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .bh-qs__file {
    display: none;
  }
  .bh-qs__result {
    flex-wrap: wrap;
  }
  .bh-qs__result-text {
    flex-basis: 100%;
    order: 3;
  }
  .bh-qs__step {
    padding: 20px;
  }
}
</style>
