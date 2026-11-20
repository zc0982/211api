<template>
  <div ref="rootEl" class="bh-theme" @focusout="onFocusOut">
    <button
      ref="buttonEl"
      type="button"
      class="bh-theme__btn"
      :aria-label="t('brandHome.theme.toggle', { mode: t(LABEL_KEYS[preference]) })"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
      @keydown="onButtonKeydown"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <template v-if="isDark">
          <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
        </template>
        <template v-else>
          <circle cx="8" cy="8" r="2.75" />
          <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
        </template>
      </svg>
    </button>
    <ul v-show="open" :id="menuId" class="bh-theme__menu" role="menu" :aria-label="t('brandHome.theme.menu')" @keydown="onMenuKeydown">
      <li v-for="(option, i) in OPTIONS" :key="option" role="none">
        <button
          :ref="(el) => (itemEls[i] = el as HTMLButtonElement | null)"
          type="button"
          role="menuitemradio"
          class="bh-theme__item"
          :class="{ 'is-on': option === preference }"
          :aria-checked="option === preference"
          tabindex="-1"
          @click="choose(option)"
        >
          <svg class="bh-theme__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <template v-if="option === 'system'">
              <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" />
              <path d="M5.5 13.75h5M8 11v2.75" />
            </template>
            <template v-else-if="option === 'light'">
              <circle cx="8" cy="8" r="2.75" />
              <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
            </template>
            <template v-else>
              <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
            </template>
          </svg>
          <span class="bh-theme__label">{{ t(LABEL_KEYS[option]) }}</span>
          <svg v-if="option === preference" class="bh-theme__check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThemePreference } from '../composables/useBrandTheme'

/**
 * 主题按钮与菜单（Figma 10:988 / 46:1808 / 46:2685）。32px 圆形按钮，浅色显示太阳、
 * 深色显示月亮；点按展开「跟随系统 / 浅色 / 深色」，当前项衬 tint 并带对勾。
 * 键盘：Enter / Space / ↓ 打开并聚焦当前项，↑↓ Home End 移动，Esc 关闭并回到按钮，
 * Tab 离开时关闭。
 */
const props = defineProps<{ preference: ThemePreference; isDark: boolean }>()
const emit = defineEmits<{ (e: 'select', value: ThemePreference): void }>()
const { t } = useI18n()

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark']
const LABEL_KEYS = {
  system: 'brandHome.theme.system',
  light: 'brandHome.theme.light',
  dark: 'brandHome.theme.dark'
} as const

const menuId = `bh-theme-menu-${useId()}`
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const buttonEl = ref<HTMLButtonElement | null>(null)
const itemEls = ref<(HTMLButtonElement | null)[]>([])

function focusItem(index: number) {
  const count = OPTIONS.length
  itemEls.value[((index % count) + count) % count]?.focus()
}

async function openMenu(focus: 'current' | 'first' | 'last' = 'current') {
  open.value = true
  await nextTick()
  if (focus === 'first') focusItem(0)
  else if (focus === 'last') focusItem(OPTIONS.length - 1)
  else focusItem(Math.max(0, OPTIONS.indexOf(props.preference)))
}

function close(returnFocus = false) {
  if (!open.value) return
  open.value = false
  if (returnFocus) buttonEl.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openMenu()
}

function choose(value: ThemePreference) {
  emit('select', value)
  close(true)
}

function onButtonKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openMenu('current')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    openMenu('last')
  } else if (event.key === 'Escape') {
    close()
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const index = itemEls.value.findIndex((el) => el === document.activeElement)
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusItem(index + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusItem(index - 1)
      break
    case 'Home':
      event.preventDefault()
      focusItem(0)
      break
    case 'End':
      event.preventDefault()
      focusItem(OPTIONS.length - 1)
      break
    case 'Escape':
      event.preventDefault()
      close(true)
      break
    case 'Tab':
      close()
      break
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && rootEl.value?.contains(next)) return
  close()
}

function onPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node)) close()
}

watch(open, (value) => {
  if (value) document.addEventListener('pointerdown', onPointerDown, true)
  else document.removeEventListener('pointerdown', onPointerDown, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
</script>

<style scoped>
.bh-theme {
  position: relative;
  display: inline-flex;
}
.bh-theme svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bh-theme__btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgb(var(--brand-navy) / var(--bh-toggle-alpha, 0.06));
  color: var(--bh-slate);
  cursor: pointer;
  transition:
    background-color 160ms ease-out,
    color 160ms ease-out;
}
.bh-theme__btn:hover,
.bh-theme__btn[aria-expanded='true'] {
  background: rgb(var(--brand-navy) / 0.12);
  color: var(--bh-ink);
}
.bh-theme__btn:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}

.bh-theme__menu {
  position: absolute;
  top: calc(100% + 12px);
  left: -3px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 184px;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--bh-line);
  border-radius: 16px;
  background: var(--bh-surface);
  box-shadow: 0 8px 24px rgb(var(--bh-shadow-navy) / min(calc(0.08 * var(--bh-shadow-k)), 0.5));
  list-style: none;
  animation: bh-fade 160ms ease-out;
}
.bh-theme__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--bh-ink);
  font-family: var(--bh-font-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.bh-theme__item:hover {
  background: rgb(var(--brand-tint) / 0.6);
}
.bh-theme__item.is-on {
  background: var(--bh-tint);
  color: var(--bh-navy);
}
.bh-theme__item:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: -2px;
}
.bh-theme__icon {
  flex: none;
  color: var(--bh-slate);
}
.bh-theme__item.is-on .bh-theme__icon {
  color: var(--bh-navy);
}
.bh-theme__label {
  flex: 1;
}
.bh-theme__check {
  flex: none;
  color: var(--bh-navy);
  stroke-width: 1.8;
}

/* Narrow screens: the actions capsule hugs the right edge, so open leftwards. */
@media (max-width: 860px) {
  .bh-theme__menu {
    left: auto;
    right: -3px;
  }
}
</style>
