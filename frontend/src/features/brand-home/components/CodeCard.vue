<template>
  <div class="bh-code-card bh-glass">
    <div class="bh-code-card__top">
      <span class="bh-code-card__label">{{ label }}</span>
      <StatusBadge v-if="status" :label="status" :meta="statusMeta" />
    </div>
    <pre class="bh-code-card__code bh-mono"><span class="k">base_url</span> = <span class="s">"{{ baseUrl }}"</span>
<span class="k">model</span>    = <span class="s">"{{ model }}"</span></pre>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'

/** 代码卡「你的代码」：base_url 为运行时地址；状态与耗时为示意值。 */
withDefaults(
  defineProps<{ label: string; baseUrl: string; model: string; status?: string; statusMeta?: string }>(),
  { status: '', statusMeta: '' }
)
</script>

<style scoped>
.bh-code-card {
  width: 340px;
  max-width: 100%;
  padding: 14px 20px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 12px 32px -8px rgba(20, 48, 107, 0.08);
  color: var(--bh-ink);
  text-align: left;
}
.bh-code-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.bh-code-card__label {
  color: var(--bh-mist);
  font-size: 12px;
  line-height: 16px;
}
.bh-code-card__code {
  margin: 0;
  overflow: hidden;
  color: var(--bh-navy);
  font-size: 12px;
  line-height: 24px;
  white-space: pre;
  text-overflow: ellipsis;
}
.bh-code-card__code .k {
  color: var(--bh-mist);
}
.bh-code-card__code .s {
  color: var(--bh-navy);
}
</style>
