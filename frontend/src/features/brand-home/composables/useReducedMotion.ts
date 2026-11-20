import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onMediaChange } from './mediaQuery'

/** Tracks `prefers-reduced-motion: reduce`. */
export function useReducedMotion() {
  const reduced = ref(false)
  let query: MediaQueryList | null = null
  let stop: (() => void) | null = null
  const update = () => {
    reduced.value = query?.matches === true
  }
  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    query = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    stop = onMediaChange(query, update)
  })
  onBeforeUnmount(() => {
    stop?.()
  })
  return reduced
}
