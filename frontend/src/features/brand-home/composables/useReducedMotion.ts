import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Tracks `prefers-reduced-motion: reduce`. */
export function useReducedMotion() {
  const reduced = ref(false)
  let query: MediaQueryList | null = null
  const update = () => {
    reduced.value = query?.matches === true
  }
  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    query = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    query.addEventListener?.('change', update)
  })
  onBeforeUnmount(() => {
    query?.removeEventListener?.('change', update)
  })
  return reduced
}
