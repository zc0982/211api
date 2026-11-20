<template>
  <span class="bh-badge bh-mono"><i aria-hidden="true" />{{ label }}<em v-if="meta">{{ meta }}</em></span>
</template>

<script setup lang="ts">
/** 状态徽章：信号绿只表示状态；可选的古铜耗时。 */
defineProps<{ label: string; meta?: string }>()
</script>

<style scoped>
.bh-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgb(var(--brand-ok) / 0.1);
  color: var(--bh-ok);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.bh-badge i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bh-ok);
}
.bh-badge em {
  font-style: normal;
  color: var(--bh-bronze);
}
</style>
