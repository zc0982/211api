<template>
  <button type="button" class="bh-chip" :class="{ 'is-on': active }" :aria-pressed="active">
    <slot name="icon" />
    <span><slot /></span>
  </button>
</template>

<script setup lang="ts">
/** 筛选芯片：同一时刻只选中一个（由父组件控制）。 */
defineProps<{ active: boolean }>()
</script>

<style scoped>
.bh-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--bh-line);
  border-radius: 999px;
  background: #fff;
  color: var(--bh-slate);
  font-family: var(--bh-font-sans);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    background-color 0.2s;
}
.bh-chip:hover {
  color: var(--bh-ink);
  border-color: var(--bh-sky);
}
.bh-chip.is-on {
  border-color: var(--bh-navy);
  background: var(--bh-navy);
  color: #fff;
  box-shadow: 0 4px 12px -4px rgba(20, 48, 107, 0.18);
}
.bh-chip:focus-visible {
  outline: 2px solid var(--bh-blue);
  outline-offset: 2px;
}
</style>
