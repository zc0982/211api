<template>
  <component :is="icon" :size="size" aria-hidden="true" focusable="false" class="bh-tool-icon" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ClaudeCodeColor from '@lobehub/icons-vue/es/ClaudeCode/components/Color'
import CodexColor from '@lobehub/icons-vue/es/Codex/components/Color'
import CursorMono from '@lobehub/icons-vue/es/Cursor/components/Mono'
import DeepSeekColor from '@lobehub/icons-vue/es/DeepSeek/components/Color'
import PiMono from '@lobehub/icons-vue/es/Pi/components/Mono'
import NousResearchMono from '@lobehub/icons-vue/es/NousResearch/components/Mono'
import OpenCodeMono from '@lobehub/icons-vue/es/OpenCode/components/Mono'
import OpenClawColor from '@lobehub/icons-vue/es/OpenClaw/components/Color'
import type { EcosystemTool } from '../config'

/**
 * 生态工具图标，变体以 Figma 1:2349 为准：彩色 = Claude Code、Codex、
 * DeepSeek（DSH）、OpenClaw；单色 = Cursor、Pi、Hermes（NousResearch）、OpenCode。
 */
const props = withDefaults(defineProps<{ tool: EcosystemTool; size?: number }>(), { size: 26 })

const ICONS = {
  claudeCode: ClaudeCodeColor,
  codex: CodexColor,
  cursor: CursorMono,
  deepseekHarness: DeepSeekColor,
  pi: PiMono,
  hermes: NousResearchMono,
  openCode: OpenCodeMono,
  openClaw: OpenClawColor
} as const

const icon = computed(() => ICONS[props.tool])
</script>

<style scoped>
.bh-tool-icon {
  color: var(--bh-ink);
}
</style>
