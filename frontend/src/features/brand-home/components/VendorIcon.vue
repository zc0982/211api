<template>
  <component :is="icon" :size="size" aria-hidden="true" focusable="false" class="bh-vendor-icon" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
// Single-variant imports from the Vue 3 package (@lobehub/icons-vue). Each
// path pulls one SVG component only, never the whole icon catalogue.
import ClaudeColor from '@lobehub/icons-vue/es/Claude/components/Color'
import OpenAIMono from '@lobehub/icons-vue/es/OpenAI/components/Mono'
import GeminiColor from '@lobehub/icons-vue/es/Gemini/components/Color'
import GrokMono from '@lobehub/icons-vue/es/Grok/components/Mono'
import type { BrandVendor } from '../config'

/** 厂商图标：变体按 Figma（Claude/Gemini 彩色，OpenAI/Grok 单色墨色）。 */
const props = withDefaults(defineProps<{ vendor: BrandVendor; size?: number }>(), { size: 16 })

const ICONS = {
  claude: ClaudeColor,
  openai: OpenAIMono,
  gemini: GeminiColor,
  grok: GrokMono
} as const

const icon = computed(() => ICONS[props.vendor])
</script>

<style scoped>
.bh-vendor-icon {
  color: var(--bh-ink);
}
</style>
