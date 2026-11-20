<template>
  <div class="bh-code-card bh-glass">
    <div class="bh-code-card__top">
      <span class="bh-code-card__label">{{ label }}</span>
      <StatusBadge v-if="status" class="bh-code-card__badge" :label="status" :meta="statusMeta" />
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
  /* Figma 10:970: 16px 20px inside a 1px border (Figma strokes sit inside), label 16 + 6 + two 18px code lines 6 apart = 96px tall. */
  padding: 15px 20px 12px;
  border-radius: 16px;
  background: rgb(var(--brand-surface) / 0.66);
  box-shadow: 0 12px 32px -8px rgb(var(--bh-shadow-navy) / min(calc(0.08 * var(--bh-shadow-k)), 0.5));
  color: var(--bh-ink);
  text-align: left;
}
.bh-code-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  row-gap: 14px;
  /*
   * At default size the row is the label's 16px and the taller badge overhangs
   * it (negative block margin below), as in Figma. The row still grows with
   * its content: a wrapped label (narrow screen, text-only zoom) or a badge
   * that drops to its own line pushes the code down instead of covering it.
   */
  min-height: 16px;
  /* 3px + the code's 3px half-leading = the 6px gap in Figma. */
  margin-bottom: 3px;
}
.bh-code-card__badge {
  margin-block: -4px;
}
.bh-code-card__label {
  min-width: 0;
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
