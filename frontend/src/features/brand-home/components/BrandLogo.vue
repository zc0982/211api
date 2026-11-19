<template>
  <span class="bh-logo" :class="{ 'is-inverse': inverse }">
    <svg class="bh-logo__mark" viewBox="10 15 44 33" aria-hidden="true" focusable="false">
      <path d="M32 17.5L52 28L32 38.5L12 28L32 17.5Z" :fill="ink" />
      <path d="M20.75 34.22L32 40.125L43.25 34.22V42.16L32 46.375L20.75 42.16V34.22Z" :fill="ink" />
      <path
        d="M45.6543 32.7383L45.9746 32.9072V40.125H44.7754V33.6328L31.7207 26.7812L32.2793 25.7188L45.6543 32.7383Z"
        fill="#D4A84B"
      />
      <circle cx="32" cy="26.25" r="1.5" fill="#D4A84B" />
      <circle cx="45.375" cy="40.125" r="1.55" fill="#D4A84B" />
    </svg>
    <span v-if="name" class="bh-logo__word">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** 学士帽标志（设计源 export/logo/logo-mark-*.svg）+ 站点名字标。 */
const props = withDefaults(defineProps<{ name?: string; inverse?: boolean }>(), { name: '', inverse: false })
const ink = computed(() => (props.inverse ? '#FFFFFF' : '#14306B'))
</script>

<style scoped>
.bh-logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--bh-navy);
}
.bh-logo__mark {
  width: 37px;
  height: 28px;
  flex: none;
}
.bh-logo__word {
  font-family: var(--bh-font-wordmark);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.bh-logo.is-inverse {
  color: #fff;
}
</style>
