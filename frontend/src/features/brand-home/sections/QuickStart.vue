<template>
  <section v-reveal class="bh-section bh-on-canvas bh-qs" aria-labelledby="bh-qs-title">
    <div class="bh-container">
      <header class="bh-section-head" data-reveal style="--bh-i: 0">
        <h2 id="bh-qs-title" class="bh-section-title">{{ t('brandHome.quickstart.title') }}</h2>
        <p class="bh-section-sub">{{ t('brandHome.quickstart.subtitle', { site: siteName }) }}</p>
        <a v-if="links.docs" class="bh-section-link" :href="links.docs" target="_blank" rel="noopener">
          {{ t('brandHome.quickstart.docsLink') }} →
        </a>
      </header>

      <div class="bh-qs__panel bh-dark-card" data-reveal style="--bh-i: 1">
        <div class="bh-qs__rail">
          <p :id="railLabelId" class="bh-qs__rail-label">{{ t('brandHome.quickstart.clients') }}</p>
          <div
            class="bh-qs__clients"
            role="tablist"
            aria-orientation="vertical"
            :aria-labelledby="railLabelId"
            @keydown="onTabKey"
          >
            <button
              v-for="(sample, index) in samples"
              :id="`bh-qs-tab-${sample.client}`"
              :key="sample.client"
              :ref="(el) => (tabRefs[index] = el as HTMLButtonElement | null)"
              type="button"
              role="tab"
              class="bh-qs__client"
              :class="{ 'is-on': sample.client === client }"
              :aria-selected="sample.client === client"
              aria-controls="bh-qs-panel"
              :tabindex="sample.client === client ? 0 : -1"
              @click="client = sample.client"
            >
              {{ clientLabel(sample.client) }}
            </button>
          </div>
          <svg class="bh-qs__skyline" viewBox="0 0 266 175" width="266" height="175" aria-hidden="true">
            <g fill="#13244c">
              <rect x="0" y="127" width="24" height="48" />
              <rect x="48" y="111" width="32" height="64" />
              <rect x="78" y="135" width="38" height="40" />
              <rect x="114" y="103" width="30" height="72" />
              <rect x="142" y="123" width="42" height="52" />
              <rect x="182" y="139" width="46" height="36" />
              <rect x="226" y="117" width="40" height="58" />
            </g>
            <g fill="#1c3264">
              <rect x="164" y="137" width="64" height="4" />
              <rect x="164" y="133" width="64" height="4" />
              <rect x="164" y="129" width="64" height="4" />
              <rect x="168" y="125" width="56" height="4" />
              <rect x="168" y="121" width="56" height="4" />
              <rect x="172" y="117" width="48" height="4" />
              <rect x="176" y="113" width="40" height="4" />
              <rect x="184" y="109" width="24" height="4" />
            </g>
            <rect x="160" y="141" width="72" height="34" fill="#172b55" />
            <rect x="202" y="105" width="6" height="8" fill="#8fa6d4" />
            <rect x="200" y="97" width="6" height="8" fill="#8fa6d4" />
            <rect x="198" y="89" width="6" height="8" fill="#8fa6d4" />
            <rect x="196" y="81" width="6" height="8" fill="#dbe6fb" />
            <g fill="#fff">
              <rect x="60" y="95" width="2" height="2" opacity="0.44" />
              <rect x="232" y="0" width="2" height="2" opacity="0.54" />
              <rect x="90" y="1" width="2" height="2" opacity="0.23" />
              <rect x="246" y="102" width="2" height="2" opacity="0.41" />
              <rect x="113" y="55" width="2" height="2" opacity="0.44" />
              <rect x="120" y="5" width="2" height="2" opacity="0.5" />
              <rect x="209" y="34" width="2" height="2" opacity="0.27" />
              <rect x="245" y="8" width="2" height="2" opacity="0.38" />
              <rect x="148" y="34" width="2" height="2" opacity="0.33" />
              <rect x="128" y="73" width="2" height="2" opacity="0.32" />
              <rect x="40" y="91" width="2" height="2" opacity="0.45" />
              <rect x="45" y="23" width="2" height="2" opacity="0.57" />
            </g>
          </svg>
        </div>

        <div class="bh-qs__editor">
          <div class="bh-qs__bar">
            <span class="bh-qs__file bh-mono">{{ current.filename }}</span>
            <button type="button" class="bh-qs__copy" @click="copy">{{ copyLabel }}</button>
            <span class="bh-sr-only" aria-live="polite">{{ copyState === 'idle' ? '' : copyLabel }}</span>
          </div>
          <div
            id="bh-qs-panel"
            class="bh-qs__code"
            role="tabpanel"
            :aria-labelledby="`bh-qs-tab-${current.client}`"
            tabindex="0"
          >
            <pre class="bh-mono"><code><span
              v-for="(line, index) in current.lines"
              :key="`${current.client}-${index}`"
              class="bh-qs__line"
              :class="{ 'is-removed': line.mark === '-', 'is-added': line.mark === '+' }"
            ><span class="bh-qs__ln" aria-hidden="true">{{ index + 1 }}</span><span class="bh-qs__mark" aria-hidden="true">{{ line.mark === '-' ? '−' : line.mark ?? '' }}</span><span
              v-if="line.mark === '-'"
              class="bh-sr-only"
            >{{ t('brandHome.quickstart.removedLine') }} </span><span class="bh-qs__text"><span
              v-for="(token, ti) in line.tokens"
              :key="ti"
              :class="`tk-${token[1]}`"
            >{{ token[0] }}</span></span><span
              v-if="line.mark === '+'"
              class="bh-qs__note"
            >← {{ current.client === 'claudeCode' || current.client === 'codex' ? t('brandHome.quickstart.pointHere', { site: siteName }) : t('brandHome.quickstart.onlyLine') }}</span></span></code></pre>
          </div>
          <div class="bh-qs__result">
            <span class="bh-qs__status bh-mono"><i aria-hidden="true" />{{ QUICKSTART_RESPONSE.status }} · {{ QUICKSTART_RESPONSE.latency }}</span>
            <span class="bh-mono">{{ SAMPLE_MODEL }}</span>
            <span class="bh-mono">{{ QUICKSTART_RESPONSE.tokens }} tokens</span>
            <span class="bh-mono bh-qs__cost">{{ QUICKSTART_RESPONSE.cost }}</span>
            <RouterLink :to="links.usage" class="bh-qs__link">{{ t('brandHome.quickstart.viewLogs') }} →</RouterLink>
          </div>
        </div>
      </div>
      <p class="bh-caption" data-reveal style="--bh-i: 2">{{ t('brandHome.quickstart.caption') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { vReveal } from '../composables/vReveal'
import { buildSamples, sampleToText, type SampleClient } from '../composables/codeSamples'
import type { HomeLinks } from '../composables/homeLinks'
import { API_KEY_PLACEHOLDER, CODEX_SAMPLE_MODEL, QUICKSTART_RESPONSE, SAMPLE_MODEL } from '../config'

/**
 * 快速接入「换一个地址，其余照旧」（Figma 46:3457）：左侧客户端列表，右侧深色
 * 代码面板只把 base_url 那一行标成金色（有官方地址的客户端先划掉官方那行）。
 * 面板在两种主题下都是深色。地址是运行时 base_url，密钥是占位符，底部响应行
 * 是示意数值。
 */
const props = defineProps<{ links: HomeLinks; baseUrl: string; siteName: string }>()
const { t } = useI18n()

const railLabelId = `bh-qs-rail-${useId()}`
const client = ref<SampleClient>('pythonOpenai')
const tabRefs = ref<(HTMLButtonElement | null)[]>([])

const samples = computed(() =>
  buildSamples({
    baseUrl: props.baseUrl,
    model: SAMPLE_MODEL,
    codexModel: CODEX_SAMPLE_MODEL,
    apiKey: API_KEY_PLACEHOLDER,
    greeting: t('brandHome.quickstart.sampleGreeting')
  })
)
const current = computed(() => samples.value.find((s) => s.client === client.value) ?? samples.value[0])

function clientLabel(id: SampleClient): string {
  switch (id) {
    case 'pythonOpenai':
      return t('brandHome.quickstart.clientPythonOpenai')
    case 'nodeOpenai':
      return t('brandHome.quickstart.clientNodeOpenai')
    case 'pythonAnthropic':
      return t('brandHome.quickstart.clientPythonAnthropic')
    case 'curl':
      return 'curl'
    case 'claudeCode':
      return 'Claude Code'
    default:
      return 'Codex'
  }
}

function onTabKey(event: KeyboardEvent) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const list = samples.value
  const index = list.findIndex((s) => s.client === client.value)
  let next = index
  if (event.key === 'ArrowDown') next = (index + 1) % list.length
  if (event.key === 'ArrowUp') next = (index - 1 + list.length) % list.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = list.length - 1
  client.value = list[next].client
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
/* Fixed dark panel (Figma 46:3457): 1200×540, rail 264 + editor. */
.bh-qs__panel {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  min-height: 540px;
  overflow: hidden;
  border-radius: 24px;
}
.bh-qs__rail {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px 12px 0;
  border-right: 1px solid var(--bh-night-line);
  background: var(--bh-night-inner);
}
.bh-qs__rail-label {
  margin: 0 0 14px 12px;
  color: var(--bh-night-mist);
  font-size: 12px;
  line-height: 14px;
}
.bh-qs__clients {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bh-qs__client {
  position: relative;
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--bh-night-slate);
  font-family: var(--bh-font-sans);
  font-size: 14px;
  line-height: 17px;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease-out;
}
.bh-qs__client:hover {
  color: var(--bh-night-ink);
}
.bh-qs__client.is-on {
  background: #15223f;
  color: var(--bh-night-ink);
  font-weight: 500;
}
.bh-qs__client.is-on::before {
  content: '';
  position: absolute;
  left: 0;
  top: 11px;
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--bh-night-blue);
}
.bh-qs__client:focus-visible,
.bh-qs__copy:focus-visible,
.bh-qs__link:focus-visible,
.bh-qs__code:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: -2px;
}
.bh-qs__skyline {
  position: absolute;
  left: 0;
  bottom: 0;
  pointer-events: none;
}

.bh-qs__editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.bh-qs__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 32px;
  border-bottom: 1px solid var(--bh-night-line);
}
.bh-qs__file {
  color: var(--bh-night-slate);
  font-size: 12px;
}
.bh-qs__copy {
  height: 28px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: transparent;
  color: var(--bh-night-slate);
  font-family: var(--bh-font-sans);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.bh-qs__copy:hover {
  color: var(--bh-night-ink);
  border-color: rgba(255, 255, 255, 0.3);
}

.bh-qs__code {
  flex: 1;
  overflow-x: auto;
  padding: 24px 0;
}
.bh-qs__code pre {
  margin: 0;
  font-size: 14px;
  line-height: 28px;
}
.bh-qs__line {
  display: flex;
  min-width: max-content;
  padding-right: 32px;
  color: var(--bh-night-ink);
}
.bh-qs__ln {
  width: 52px;
  flex: none;
  padding-right: 4px;
  color: var(--bh-night-dim);
  font-size: 13px;
  text-align: right;
  user-select: none;
}
.bh-qs__mark {
  width: 32px;
  flex: none;
  padding-left: 12px;
  color: var(--bh-night-mist);
  user-select: none;
}
.bh-qs__text {
  white-space: pre;
}
.bh-qs__line.is-removed {
  background: rgba(255, 255, 255, 0.03);
}
.bh-qs__line.is-removed .bh-qs__text,
.bh-qs__line.is-removed .bh-qs__text span {
  color: var(--bh-night-mist);
  text-decoration: line-through;
}
.bh-qs__line.is-added {
  background: var(--bh-gold-code);
  box-shadow: inset 2px 0 0 var(--bh-night-gold);
}
.bh-qs__line.is-added .bh-qs__mark {
  color: var(--bh-night-bronze);
}
.bh-qs__note {
  margin-left: 20px;
  color: var(--bh-night-bronze);
  font-family: var(--bh-font-sans);
  font-size: 13px;
  font-weight: 500;
}
.tk-kw {
  color: var(--bh-night-blue);
}
.tk-str {
  color: var(--bh-night-bronze);
}
.tk-punct {
  color: var(--bh-night-slate);
}
.tk-comment {
  color: var(--bh-night-mist);
}

.bh-qs__result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  min-height: 64px;
  padding: 12px 32px;
  border-top: 1px solid var(--bh-night-line);
  color: var(--bh-night-slate);
  font-size: 12px;
}
.bh-qs__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(61, 214, 140, 0.12);
  color: var(--bh-night-ok);
  font-weight: 500;
}
.bh-qs__status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bh-night-ok);
}
.bh-qs__cost {
  color: var(--bh-night-bronze);
}
.bh-qs__link {
  margin-left: auto;
  color: var(--bh-night-blue);
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}

@media (max-width: 860px) {
  .bh-qs__panel {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }
  .bh-qs__rail {
    padding: 16px 12px 12px;
    border-right: none;
    border-bottom: 1px solid var(--bh-night-line);
  }
  .bh-qs__rail-label {
    margin-bottom: 8px;
  }
  .bh-qs__clients {
    flex-direction: row;
    gap: 4px;
    overflow-x: auto;
  }
  .bh-qs__client {
    flex: none;
    height: 34px;
    padding: 0 12px;
  }
  .bh-qs__client.is-on::before {
    display: none;
  }
  .bh-qs__skyline {
    display: none;
  }
  .bh-qs__bar,
  .bh-qs__result {
    padding-left: 16px;
    padding-right: 16px;
  }
  .bh-qs__ln {
    width: 36px;
  }
  .bh-qs__link {
    margin-left: 0;
  }
}
</style>
