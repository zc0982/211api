import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'

/**
 * One requestAnimationFrame loop for every animated part of the home page
 * (hero actors, site actors, the narrow-screen camera pans).
 *
 * Each subscriber gets its own `time` (seconds) that only advances while that
 * subscriber is enabled, on screen (IntersectionObserver) and the tab is
 * visible; under prefers-reduced-motion nothing advances, nor while the
 * visitor has paused motion with the header's pause button (WCAG 2.2.2). The
 * loop stops when no subscriber is running, so an idle page costs nothing.
 */

interface Subscriber {
  time: Ref<number>
  intersecting: boolean
  enabled: Ref<boolean>
}

const subscribers = new Set<Subscriber>()
let rafId = 0
let last = 0
let listening = false

/** Shared prefers-reduced-motion state (live: follows the OS setting). */
export const reducedMotion = ref(false)

const PAUSE_KEY = 'bh-motion'

function readPaused(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PAUSE_KEY) === 'paused'
  } catch {
    return false
  }
}

/**
 * Visitor's in-page pause (header button). Freezes every animated part where
 * it is; kept across scrolling and, best effort, across visits.
 */
export const motionPaused = ref(readPaused())

export function setMotionPaused(paused: boolean) {
  motionPaused.value = paused
  try {
    if (paused) localStorage.setItem(PAUSE_KEY, 'paused')
    else localStorage.removeItem(PAUSE_KEY)
  } catch {
    // Storage blocked (private mode etc.): the pause still holds for this page.
  }
  update()
}

function running(s: Subscriber) {
  return s.intersecting && s.enabled.value
}

function canRun() {
  if (reducedMotion.value || motionPaused.value || (typeof document !== 'undefined' && document.hidden)) return false
  for (const s of subscribers) if (running(s)) return true
  return false
}

function tick(now: number) {
  // Clamp: a long frame (or the first one after a pause) never makes actors jump.
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
  last = now
  for (const s of subscribers) if (running(s)) s.time.value += dt
  rafId = canRun() ? requestAnimationFrame(tick) : 0
  if (!rafId) last = 0
}

function update() {
  if (typeof requestAnimationFrame === 'undefined') return
  if (canRun()) {
    if (!rafId) {
      last = 0
      rafId = requestAnimationFrame(tick)
    }
  } else if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
    last = 0
  }
}

/** Start following prefers-reduced-motion and tab visibility (idempotent). */
export function watchMotionPreference() {
  if (listening || typeof window === 'undefined') return
  listening = true
  // Both listeners live for the page's lifetime (one closure each).
  document.addEventListener('visibilitychange', update)
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = query.matches
    query.addEventListener?.('change', (e) => {
      reducedMotion.value = e.matches
      update()
    })
  }
}

/**
 * Subscribe an element to the shared clock. `enabled` gates this subscriber
 * (e.g. sprite sheets loaded, or narrow screen for the camera pan).
 */
export function useSceneClock(target: Ref<HTMLElement | null>, enabled: Ref<boolean> = ref(true)) {
  watchMotionPreference()
  const sub: Subscriber = { time: shallowRef(0), intersecting: false, enabled }
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    subscribers.add(sub)
    if (typeof IntersectionObserver === 'undefined') {
      sub.intersecting = true
      update()
      return
    }
    observer = new IntersectionObserver((entries) => {
      sub.intersecting = entries.some((e) => e.isIntersecting)
      update()
    })
    if (target.value) observer.observe(target.value)
  })

  const stop = watch(enabled, update)

  onBeforeUnmount(() => {
    stop()
    observer?.disconnect()
    subscribers.delete(sub)
    update()
  })

  return { time: sub.time, reducedMotion }
}

/** Test hook: drop every subscriber and stop the loop. */
export function resetSceneClockForTests() {
  subscribers.clear()
  motionPaused.value = false
  if (rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId)
  rafId = 0
  last = 0
}
