import type { Directive } from 'vue'

/**
 * Scroll reveal for below-the-fold sections.
 *
 * Only a section whose top is below the viewport when it mounts gets
 * `.bh-reveal` (which hides its `[data-reveal]` children); once it scrolls
 * into view it gets `.is-revealed` and the children rise in once, staggered by
 * `--bh-i`. Sections already on screen at mount, and browsers without
 * IntersectionObserver, are never hidden. Styles live in styles/brand-home.css.
 */
export const REVEAL_ROOT_MARGIN = '0px 0px -12% 0px'

const observers = new WeakMap<HTMLElement, IntersectionObserver>()

function stop(el: HTMLElement) {
  observers.get(el)?.disconnect()
  observers.delete(el)
}

export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    if (typeof IntersectionObserver === 'undefined' || typeof window === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return

    el.classList.add('bh-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        el.classList.add('is-revealed')
        stop(el)
      },
      { rootMargin: REVEAL_ROOT_MARGIN }
    )
    observer.observe(el)
    observers.set(el, observer)
  },
  unmounted(el) {
    stop(el)
  }
}
