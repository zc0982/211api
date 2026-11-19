<template>
  <div class="bh-locale" role="group" :aria-label="label">
    <button
      v-for="option in OPTIONS"
      :key="option.code"
      type="button"
      class="bh-locale__btn"
      :class="{ 'is-on': option.code === locale }"
      :aria-pressed="option.code === locale"
      :lang="option.code"
      :disabled="switching"
      @click="choose(option.code)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

/**
 * 语言切换（页脚）。自绘而不复用上游 LocaleSwitcher：后者带 dark: 样式，
 * 在 html.dark 下会变深色。切换只更新文案，不整页刷新。
 */
defineProps<{ label: string }>()

const OPTIONS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' }
] as const

const { locale } = useI18n()
const switching = ref(false)

async function choose(code: string) {
  if (switching.value || code === locale.value) return
  switching.value = true
  try {
    await setLocale(code)
  } finally {
    switching.value = false
  }
}
</script>

<style scoped>
.bh-locale {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: #fff;
}
.bh-locale__btn {
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--bh-slate);
  font-family: var(--bh-font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
}
.bh-locale__btn:hover {
  color: var(--bh-ink);
}
.bh-locale__btn.is-on {
  background: var(--bh-tint);
  color: var(--bh-navy);
}
.bh-locale__btn:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}
</style>
