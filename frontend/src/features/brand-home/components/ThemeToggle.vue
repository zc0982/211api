<template>
  <button
    type="button"
    class="bh-theme"
    :aria-label="isDark ? t('brandHome.theme.toLight') : t('brandHome.theme.toDark')"
    :title="isDark ? t('brandHome.theme.toLight') : t('brandHome.theme.toDark')"
    @click="emit('select', isDark ? 'light' : 'dark')"
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path v-if="isDark" d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
      <template v-else>
        <circle cx="8" cy="8" r="2.75" />
        <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
      </template>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ThemePreference } from '../composables/useBrandTheme'

/**
 * 主题按钮（DESIGN.md v3「Navigation」）：在夜空导航上，「登录」左侧 12px，
 * 36px 圆形，月白 6% 底、白 22% 描边，16px 月白线条图标；浅色显示太阳、
 * 深色显示月亮。点按在浅 / 深之间切换，选择会记住（useBrandTheme）；
 * 没有手动选择时跟随系统。
 */
defineProps<{ isDark: boolean }>()
const emit = defineEmits<{ (e: 'select', value: ThemePreference): void }>()
const { t } = useI18n()
</script>

<style scoped>
.bh-theme {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(219, 230, 251, 0.06);
  color: var(--bh-night-moon);
  cursor: pointer;
  transition:
    background-color 200ms ease-out,
    border-color 200ms ease-out;
}
.bh-theme:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(219, 230, 251, 0.12);
}
.bh-theme:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: 2px;
}
.bh-theme svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
