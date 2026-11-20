<template>
  <span class="bh-search" :class="{ 'is-static': !interactive }">
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <input v-if="interactive" :placeholder="placeholder" :aria-label="placeholder" type="search" />
    <span v-else class="bh-search__placeholder">{{ placeholder }}</span>
  </span>
</template>

<script setup lang="ts">
/** 胶囊搜索框。首页里只用于示意面板（interactive=false，不可输入）。 */
withDefaults(defineProps<{ placeholder: string; interactive?: boolean }>(), { interactive: false })
</script>

<style scoped>
.bh-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  width: 220px;
  padding: 0 14px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: rgb(var(--brand-surface) / 0.9);
  color: var(--bh-mist);
  font-size: 13px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.bh-search input {
  width: 100%;
  border: none;
  outline: none;
  background: none;
  color: var(--bh-ink);
  font: inherit;
}
.bh-search input::placeholder,
.bh-search__placeholder {
  color: var(--bh-mist);
}
.bh-search:focus-within {
  border-color: var(--bh-blue);
  box-shadow: 0 0 0 3px rgb(var(--brand-blue) / 0.12);
}
</style>
