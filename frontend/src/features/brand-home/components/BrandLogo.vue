<template>
  <span class="bh-logo">
    <img v-if="src && !failed" class="bh-logo__img" :src="src" alt="" @error="failed = true" />
    <svg v-else class="bh-logo__mark" viewBox="10 15 44 33" aria-hidden="true" focusable="false">
      <path d="M32 17.5L52 28L32 38.5L12 28L32 17.5Z" fill="currentColor" />
      <path d="M20.75 34.22L32 40.125L43.25 34.22V42.16L32 46.375L20.75 42.16V34.22Z" fill="currentColor" />
      <path
        d="M45.6543 32.7383L45.9746 32.9072V40.125H44.7754V33.6328L31.7207 26.7812L32.2793 25.7188L45.6543 32.7383Z"
        class="bh-logo__tassel"
      />
      <circle class="bh-logo__tassel" cx="32" cy="26.25" r="1.5" />
      <circle class="bh-logo__tassel" cx="45.375" cy="40.125" r="1.55" />
    </svg>
    <span v-if="name" class="bh-logo__word">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 站点标志 + 站点名字标。
 * `src` 为后台「站点 Logo」（调用方已做 sanitizeUrl），有值时以它为准；
 * 未上传或加载失败时回退到内置学士帽（设计源 export/logo/logo-mark-*.svg）。
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
.bh-logo__mark {
  width: 37px;
  height: 28px;
  flex: none;
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
.bh-logo__tassel {
  fill: var(--bh-gold);
}
/* Dark theme: the uploaded logo sits on a white tile, see styles/brand-home.css. */
</style>
