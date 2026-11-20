<template>
  <span class="bh-model-chip bh-mono" :class="{ 'is-active': active }">
    <span class="bh-sr-only">{{ label }}</span>
    <span class="bh-model-chip__name">{{ model }}</span>
    <span v-if="meta" class="bh-model-chip__meta">{{ meta }}</span>
  </span>
</template>

<script setup lang="ts">
/**
 * Model Chip：当前被追踪的模型。玻璃胶囊 + 帽穗金描边（One Star Rule）+ 古铜耗时。
 * 首屏的耗时是示意值，不做数字滚动。
 */
withDefaults(defineProps<{ model: string; meta?: string; label?: string; active?: boolean }>(), {
  meta: '',
  label: '',
  active: true
})
</script>

<style scoped>
.bh-model-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 16px;
  border: 1.25px solid var(--bh-glass-edge);
  border-radius: 999px;
  background: rgb(var(--brand-surface) / 0.85);
  color: var(--bh-navy);
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 12px 28px -8px rgb(var(--bh-shadow-navy) / min(calc(0.14 * var(--bh-shadow-k)), 0.5));
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.bh-model-chip.is-active {
  border-color: var(--bh-gold);
  background: rgb(var(--brand-surface) / 0.88);
}
.bh-model-chip__name {
  font-weight: 500;
}
.bh-model-chip__meta {
  font-size: 12px;
  color: var(--bh-bronze);
}
</style>
