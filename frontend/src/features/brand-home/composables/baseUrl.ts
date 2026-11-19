/**
 * Runtime API base for code samples. Same normalisation as
 * components/keys/UseKeyModal.vue (`currentFiles`): strip a trailing `/v1`
 * and trailing slashes, then append `/v1`.
 */
export function normalizeApiBaseUrl(apiBaseUrl: string | null | undefined, origin: string): string {
  const configured = (apiBaseUrl ?? '').trim()
  const baseUrl = configured || origin
  const baseRoot = baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
  const trimmed = baseRoot.replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}
