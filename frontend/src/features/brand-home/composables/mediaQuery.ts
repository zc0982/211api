/**
 * Listen to a MediaQueryList's changes in every browser we support.
 *
 * Safari ≤ 13 implements only the deprecated `addListener` / `removeListener`;
 * calling `addEventListener?.('change', …)` there silently registers nothing,
 * so later changes (e.g. turning on reduced motion, or the system switching
 * to dark) would be missed. Returns an unsubscribe function.
 */
export function onMediaChange(query: MediaQueryList, handler: (event: { matches: boolean }) => void): () => void {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }
  // Legacy MediaQueryList (Safari ≤ 13).
  const legacy = query as MediaQueryList & {
    addListener?: (cb: (event: { matches: boolean }) => void) => void
    removeListener?: (cb: (event: { matches: boolean }) => void) => void
  }
  legacy.addListener?.(handler)
  return () => legacy.removeListener?.(handler)
}
