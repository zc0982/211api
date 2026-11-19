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
    variant?: 'primary' | 'glass' | 'outline' | 'inverse' | 'ghost-inverse'
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
  color: #fff;
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
  border-color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.6);
  color: var(--bh-navy);
  box-shadow: var(--bh-shadow-glass);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-btn--glass:hover {
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-2px);
  box-shadow: var(--bh-shadow-glass-hover);
}

/* White button with a hairline border (FAQ / "view all models"). */
.bh-btn--outline {
  border-color: var(--bh-line);
  background: #fff;
  color: var(--bh-navy);
  box-shadow: 0 4px 12px -6px rgba(20, 48, 107, 0.06);
}
.bh-btn--outline:hover {
  transform: translateY(-2px);
  box-shadow: var(--bh-shadow-glass-hover);
}

/* On the navy CTA band. */
.bh-btn--inverse {
  background: #fff;
  color: var(--bh-navy);
  box-shadow: 0 8px 20px -6px rgba(5, 15, 41, 0.3);
}
.bh-btn--inverse:hover {
  transform: translateY(-2px);
}
.bh-btn--ghost-inverse {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.bh-btn--ghost-inverse:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}
.bh-btn--inverse:focus-visible,
.bh-btn--ghost-inverse:focus-visible {
  outline-color: #fff;
}

.bh-btn--sm {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}
</style>
