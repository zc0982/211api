<template>
  <span class="bh-logo">
    <img v-if="src && !failed" class="bh-logo__img" :src="src" alt="" @error="failed = true" />
    <img v-else class="bh-logo__mark" src="/logo.svg" width="30" height="34" alt="" />
    <span v-if="name" class="bh-logo__word">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 站点标志 + 站点名字标。
 * `src` 为后台「站点 Logo」（调用方已做 sanitizeUrl），有值时以它为准；
 * 未上传或加载失败时回退到内置星狐头像 `/logo.svg`（与控制台、favicon 同一文件；
 * 设计源 logo-gen/round7-vectorcraft-fox/211api-star-fox-icon-universal.svg）。
 * 星狐头像自带白色贴纸描边，深浅背景都能用，不加白底。
 */
const props = withDefaults(defineProps<{ name?: string; src?: string }>(), {
  name: '',
  src: ''
})
const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  }
)
</script>

<style scoped>
.bh-logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--bh-navy);
}
/* Lockup proportions (DESIGN.md · Logo): icon 34px, wordmark ≈ 42% of it, gap ≈ 15%. */
.bh-logo__mark {
  display: block;
  width: 30px;
  height: 34px;
  flex: none;
  object-fit: contain;
}
.bh-logo__img {
  display: block;
  width: auto;
  height: 28px;
  max-width: 112px;
  flex: none;
  object-fit: contain;
}
.bh-logo__word {
  font-family: var(--bh-font-sans);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
/* Dark theme: the uploaded logo sits on a white tile, see styles/brand-home.css. */
</style>
