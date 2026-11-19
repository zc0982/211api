import { sanitizeUrl } from '@/utils/url'

/**
 * Link targets for the brand home. Mirrors HomeView.vue so both homes agree:
 * console target (HomeView.vue `dashboardPath`), model-plaza visibility
 * (HomeView.vue `showModelPlazaEntry`) and doc_url sanitising.
 */

export interface HomeLinkSettings {
  registration_enabled?: boolean | null
  model_plaza_enabled?: boolean | null
  model_plaza_require_auth?: boolean | null
  doc_url?: string | null
  contact_info?: string | null
}

export interface HomeLinkAuth {
  isAuthenticated: boolean
  isAdmin: boolean
}

export interface ContactLink {
  /** Plain text as entered by the admin (rendered as text, never as HTML). */
  text: string
  /** Validated http(s)/mailto target, or null when the text is not a link. */
  href: string | null
}

export interface HomeLinks {
  /** "Get API Key" target. */
  getKey: string
  /** Console target when signed in, otherwise null (show "Log in"). */
  console: string | null
  login: string
  /** Register entry (footer) — only for visitors when registration is open. */
  register: string | null
  keys: string
  usage: string
  /** /model-plaza when the plaza is visible to this visitor, else null. */
  modelPlaza: string | null
  /** Sanitised external docs URL, else null. */
  docs: string | null
  contact: ContactLink | null
}

const EMAIL_RE = /^[^\s@<>()"]+@[^\s@<>()"]+\.[^\s@<>()"]+$/

export function resolveContact(raw: string | null | undefined): ContactLink | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  const url = sanitizeUrl(text)
  if (url) return { text, href: url }
  if (EMAIL_RE.test(text)) return { text, href: `mailto:${text}` }
  return { text, href: null }
}

export function isModelPlazaVisible(settings: HomeLinkSettings | null | undefined, auth: HomeLinkAuth): boolean {
  return settings?.model_plaza_enabled === true && (auth.isAuthenticated || settings?.model_plaza_require_auth !== true)
}

export function resolveHomeLinks(settings: HomeLinkSettings | null | undefined, auth: HomeLinkAuth): HomeLinks {
  const registrationClosed = settings?.registration_enabled === false
  const docs = sanitizeUrl(settings?.doc_url ?? '')
  return {
    getKey: auth.isAuthenticated ? '/keys' : registrationClosed ? '/login' : '/register',
    console: auth.isAuthenticated ? (auth.isAdmin ? '/admin/dashboard' : '/dashboard') : null,
    login: '/login',
    register: !auth.isAuthenticated && !registrationClosed ? '/register' : null,
    keys: '/keys',
    usage: '/usage',
    modelPlaza: isModelPlazaVisible(settings, auth) ? '/model-plaza' : null,
    docs: docs || null,
    contact: resolveContact(settings?.contact_info)
  }
}
