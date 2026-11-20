<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <slot />
    <span v-if="arrow" class="bh-btn__arrow" aria-hidden="true">→</span>
  </RouterLink>
  <a v-else-if="href" :href="href" target="_blank" rel="noopener" :class="classes">
    <slot />
    <span v-if="arrow" class="bh-btn__arrow" aria-hidden="true">→</span>
  </a>
  <button v-else type="button" :class="classes">
    <slot />
    <span v-if="arrow" class="bh-btn__arrow" aria-hidden="true">→</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 主按钮 / 玻璃按钮。`to` 渲染站内路由，`href` 渲染外链（新窗口，rel=noopener），
 * 都没有时是普通 button。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'glass' | 'outline' | 'night' | 'night-outline'
    size?: 'md' | 'sm'
    to?: string | null
    href?: string | null
    arrow?: boolean
  }>(),
  { variant: 'primary', size: 'md', to: null, href: null, arrow: false }
)

const classes = computed(() => ['bh-btn', `bh-btn--${props.variant}`, `bh-btn--${props.size}`])
</script>

<style scoped>
.bh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 24px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-family: var(--bh-font-sans);
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    transform 160ms ease-out,
    box-shadow 160ms ease-out,
    background-color 160ms ease-out;
}
.bh-btn:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 3px;
}
.bh-btn:active {
  transform: none;
}
.bh-btn__arrow {
  font-family: var(--bh-font-wordmark);
  font-weight: 600;
}

.bh-btn--primary {
  background: var(--bh-navy);
  border-color: var(--bh-navy);
  color: var(--bh-on-navy);
  box-shadow: var(--bh-shadow-primary);
}
.bh-btn--primary.bh-btn--md:hover {
  transform: translateY(-2px);
  box-shadow: var(--bh-shadow-primary-hover);
}
.bh-btn--primary.bh-btn--sm:hover {
  background: var(--bh-navy-hover);
}

.bh-btn--glass {
  border-color: var(--bh-glass-edge);
  background: rgb(var(--brand-surface) / 0.6);
  color: var(--bh-navy);
  box-shadow: var(--bh-shadow-glass);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-btn--glass:hover {
  background: rgb(var(--brand-surface) / 0.85);
  transform: translateY(-2px);
  box-shadow: var(--bh-shadow-glass-hover);
}

/* White button with a hairline border (FAQ / "view all models"). */
.bh-btn--outline {
  border-color: var(--bh-line);
  background: var(--bh-surface);
  color: var(--bh-navy);
  box-shadow: 0 4px 12px -6px rgb(var(--bh-shadow-navy) / min(calc(0.06 * var(--bh-shadow-k)), 0.5));
}
.bh-btn--outline:hover {
  transform: translateY(-2px);
  box-shadow: var(--bh-shadow-glass-hover);
}

/* On the night sky (hero, header): fixed colours, same in both themes. */
.bh-btn--night {
  background: var(--bh-night-moon);
  border-color: var(--bh-night-moon);
  color: var(--bh-night-inner);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
.bh-btn--night:hover {
  background: #eef3fd;
}
.bh-btn--night.bh-btn--md:hover {
  transform: translateY(-2px);
}
.bh-btn--night-outline {
  border-color: rgba(255, 255, 255, 0.22);
  background: transparent;
  color: var(--bh-night-ink);
}
.bh-btn--night-outline:hover {
  border-color: rgba(255, 255, 255, 0.45);
  transform: translateY(-2px);
}
.bh-btn--night:focus-visible,
.bh-btn--night-outline:focus-visible {
  outline-color: var(--bh-night-blue);
}
.bh-btn--sm {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}
</style>
