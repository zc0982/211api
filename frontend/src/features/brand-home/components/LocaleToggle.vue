<template>
  <span class="bh-locale" role="group" :aria-label="label">
    <template v-for="(option, index) in OPTIONS" :key="option.code">
      <span v-if="index > 0" class="bh-locale__sep" aria-hidden="true">/</span>
      <button
        type="button"
        class="bh-locale__btn"
        :class="{ 'is-on': option.code === current }"
        :aria-pressed="option.code === current"
        :aria-label="option.name"
        :lang="option.code"
        :disabled="switching"
        @click="choose(option.code)"
      >
        {{ option.label }}
      </button>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

/**
 * 语言切换，放在导航右上（参考 astrlink.com）：纯文字「中 / EN」，当前语言白色
 * 加粗，另一个灰色。导航在两种主题下都压在夜空上，所以颜色用夜空色板。自绘而不
 * 复用上游 LocaleSwitcher：后者带 dark: 样式。切换只更新文案，不整页刷新。
 */
defineProps<{ label: string }>()

const OPTIONS = [
  { code: 'zh', label: '中', name: '中文' },
  { code: 'en', label: 'EN', name: 'English' }
] as const

const { locale } = useI18n()
const current = computed(() => locale.value)
const switching = ref(false)

async function choose(code: string) {
  if (switching.value || code === current.value) return
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
  align-items: center;
  gap: 4px;
  color: var(--bh-night-mist);
  font-size: 14px;
  line-height: 20px;
}
.bh-locale__btn {
  padding: 4px 2px;
  border: none;
  background: transparent;
  color: var(--bh-night-slate);
  font: inherit;
  font-weight: 400;
  cursor: pointer;
  transition: color 160ms ease-out;
}
.bh-locale__btn:hover {
  color: #fff;
}
.bh-locale__btn.is-on {
  color: #fff;
  font-weight: 600;
  cursor: default;
}
.bh-locale__btn:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: 2px;
  border-radius: 4px;
}
.bh-locale__sep {
  user-select: none;
}
</style>
