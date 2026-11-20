<template>
  <button
    v-if="!reducedMotion"
    type="button"
    class="bh-motion"
    :aria-pressed="motionPaused"
    :aria-label="motionPaused ? t('brandHome.motion.play') : t('brandHome.motion.pause')"
    :title="motionPaused ? t('brandHome.motion.play') : t('brandHome.motion.pause')"
    @click="setMotionPaused(!motionPaused)"
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path v-if="motionPaused" d="M5.5 3.5v9l7-4.5-7-4.5Z" />
      <path v-else d="M5.75 3.75v8.5M10.25 3.75v8.5" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { motionPaused, reducedMotion, setMotionPaused, watchMotionPreference } from '../composables/useSceneClock'

/**
 * 动画暂停 / 播放（WCAG 2.2.2）：导航里主题按钮左侧，与主题按钮同款 36px 圆钮。
 * 一个开关停住首屏角色、连线光点与彗星、页脚工地、计数和窄屏镜头（共享时钟），
 * 停在当前画面；选择保留到滚动和下次访问。系统要求减少动态效果时页面本来就不动，
 * 不显示此按钮。
 */
watchMotionPreference()
const { t } = useI18n()
</script>

<style scoped>
.bh-motion {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(219, 230, 251, 0.06);
  color: var(--bh-night-moon);
  cursor: pointer;
  transition:
    background-color 200ms ease-out,
    border-color 200ms ease-out;
}
.bh-motion:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(219, 230, 251, 0.12);
}
.bh-motion:focus-visible {
  outline: 2px solid var(--bh-night-blue);
  outline-offset: 2px;
}
.bh-motion svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bh-motion[aria-pressed='true'] svg path {
  fill: currentColor;
}
</style>
