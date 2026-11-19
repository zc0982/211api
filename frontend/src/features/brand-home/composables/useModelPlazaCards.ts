import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { getModelPlaza, type ModelPlazaResponse } from '@/api/modelPlaza'
import { PLAZA_PREFETCH_MARGIN } from '../config'
import { availableVendors, collectCandidates, selectCards, type PlazaFilter } from './plazaCards'

/**
 * Session cache: one request per page session. A failed request (404 when
 * the plaza is off, 401, network) is cached as `null` so the section stays
 * hidden without retry loops; a full reload starts over.
 */
let sessionRequest: Promise<ModelPlazaResponse | null> | null = null

export function resetModelPlazaCache(): void {
  sessionRequest = null
}

export function loadModelPlazaOnce(): Promise<ModelPlazaResponse | null> {
  if (!sessionRequest) {
    sessionRequest = getModelPlaza().catch(() => null)
  }
  return sessionRequest
}

export type PlazaLoadState = 'idle' | 'loading' | 'ready' | 'failed'

/**
 * Fetches only when `enabled` is true and the target is near the viewport.
 */
export function useModelPlazaCards(target: Ref<HTMLElement | null>, enabled: Ref<boolean>) {
  const state = ref<PlazaLoadState>('idle')
  const data = shallowRef<ModelPlazaResponse | null>(null)
  const filter = ref<PlazaFilter>('all')
  let observer: IntersectionObserver | null = null

  const candidates = computed(() => collectCandidates(data.value))
  const vendors = computed(() => availableVendors(candidates.value))
  const cards = computed(() => selectCards(candidates.value, filter.value))

  async function load() {
    if (state.value !== 'idle') return
    state.value = 'loading'
    const result = await loadModelPlazaOnce()
    data.value = result
    state.value = result && collectCandidates(result).length > 0 ? 'ready' : 'failed'
  }

  function disconnect() {
    observer?.disconnect()
    observer = null
  }

  function observe() {
    disconnect()
    const el = target.value
    if (!el || !enabled.value || state.value !== 'idle') return
    if (typeof IntersectionObserver === 'undefined') {
      void load()
      return
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          disconnect()
          void load()
        }
      },
      { rootMargin: PLAZA_PREFETCH_MARGIN }
    )
    observer.observe(el)
  }

  watch([target, enabled], observe, { immediate: true, flush: 'post' })
  onBeforeUnmount(disconnect)

  return { state, filter, vendors, cards }
}
