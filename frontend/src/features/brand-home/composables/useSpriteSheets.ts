import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { SceneCharacter } from '../config'
import { SPRITE_SHEETS } from '../sprites.generated'
import { reducedMotion, watchMotionPreference } from './useSceneClock'

/**
 * Loads the character atlases of one scene when they are about to be needed,
 * and reports when every atlas has decoded so the scene can switch from its
 * still frame (frame 1 PNGs, inlined) to animation in one go.
 *
 * - hero: after the first paint, when the browser is idle;
 * - footer: when the scene comes within `margin` of the viewport.
 * Under prefers-reduced-motion nothing is loaded.
 */

const ATLASES = import.meta.glob('../assets/sprites/*/actors-*.png', { eager: true, import: 'default', query: '?url' }) as Record<
  string,
  string
>

export type SpriteScene = keyof typeof SPRITE_SHEETS

/** Atlas URL and row of a character in a scene. */
export function actorSheet(scene: SpriteScene, id: SceneCharacter): { url: string; row: number } {
  const [n, row] = SPRITE_SHEETS[scene].rows[id]
  return { url: ATLASES[`../assets/sprites/${scene}/actors-${n}.png`], row }
}

function sceneAtlases(scene: SpriteScene): string[] {
  return Object.entries(ATLASES)
    .filter(([path]) => path.startsWith(`../assets/sprites/${scene}/`))
    .map(([, url]) => url)
}

function decode(url: string): Promise<void> {
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  return typeof img.decode === 'function'
    ? img.decode()
    : new Promise((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })
}

function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 200)
  return () => window.clearTimeout(id)
}

export function useSpriteSheets(scene: SpriteScene, target: Ref<HTMLElement | null>, margin = '600px 0px') {
  watchMotionPreference()
  const ready = ref(false)
  let started = false
  let cancel: (() => void) | null = null
  let observer: IntersectionObserver | null = null

  function load() {
    if (started || reducedMotion.value) return
    started = true
    observer?.disconnect()
    Promise.all(sceneAtlases(scene).map(decode))
      .then(() => {
        ready.value = true
      })
      // A failed atlas keeps the still frame: the page stays correct, just static.
      .catch(() => {})
  }

  function arm() {
    if (started || reducedMotion.value || typeof window === 'undefined') return
    if (scene === 'hero') {
      // Two frames: the still frame has painted before the sheets are requested.
      requestAnimationFrame(() => requestAnimationFrame(() => (cancel = whenIdle(load))))
      return
    }
    if (typeof IntersectionObserver === 'undefined') return load()
    observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && load(), { rootMargin: margin })
    if (target.value) observer.observe(target.value)
  }

  onMounted(arm)
  // Reduced motion turned off later: start loading then.
  const stop = watch(reducedMotion, (reduced) => !reduced && arm())
  onBeforeUnmount(() => {
    stop()
    cancel?.()
    observer?.disconnect()
  })

  return { ready }
}
