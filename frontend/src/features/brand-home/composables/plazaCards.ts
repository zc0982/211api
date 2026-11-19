/**
 * Model cards for the brand home, derived from GET /model-plaza.
 *
 * Price rule (docs/spec/brand-home.md, "价格口径"):
 * - only groups an anonymous visitor can see: not exclusive, pay-as-you-go
 *   (subscription groups excluded), using the group's `rate_multiplier`
 *   (user-specific multipliers are ignored so every visitor sees the same
 *   "from" price);
 * - only token-billed models; standard-period price (time_pricing periods are
 *   not applied); when a model has long-context tiers, the lowest tier;
 * - paid price = channel unit price × multiplier, shown as USD / 1M tokens with
 *   the same `formatScaled(…, 1_000_000, 2)` call used by
 *   components/modelPlaza/PlazaModelPricingTable.vue (`paidPerMillion`);
 * - across groups the cheapest output price wins (input from the same group),
 *   labelled "from".
 *
 * Representative model per vendor: highest official output price, ties by
 * name descending — the same ordering PlazaModelPricingTable uses.
 */
import { BILLING_MODE_TOKEN } from '@/constants/channel'
import type { ModelPlazaGroup, ModelPlazaResponse, PlazaModel } from '@/api/modelPlaza'
import { formatScaled, resolveIntervalPrices } from '@/utils/pricing'
import {
  MAX_CARDS_PER_VENDOR,
  PLATFORM_VENDOR,
  VENDOR_CARD_ORDER,
  type BrandVendor
} from '../config'

export const PER_MILLION = 1_000_000
const MIN_DECIMALS = 2

export interface PlazaCandidate {
  vendor: BrandVendor
  name: string
  /** USD per token, already multiplied by the group rate. */
  inputPaid: number | null
  outputPaid: number | null
  officialOutput: number | null
}

export interface PlazaCard {
  vendor: BrandVendor
  name: string
  /** e.g. "$3.00"; "-" when the price is not configured. */
  input: string
  output: string
}

export function isAnonymousPayGoGroup(group: ModelPlazaGroup): boolean {
  return !group.is_exclusive && group.subscription_type !== 'subscription'
}

function isTokenBilled(model: PlazaModel): boolean {
  return model.pricing != null && (model.pricing.billing_mode || BILLING_MODE_TOKEN) === BILLING_MODE_TOKEN
}

/** Base (lowest-tier) channel prices in USD per token. */
export function baseTokenPrices(model: PlazaModel): { input: number | null; output: number | null } {
  const pricing = model.pricing
  if (!pricing) return { input: null, output: null }
  if (pricing.input_price != null || pricing.output_price != null) {
    return { input: pricing.input_price, output: pricing.output_price }
  }
  const tiers = [...(pricing.intervals ?? [])].sort((a, b) => a.min_tokens - b.min_tokens)
  if (tiers.length === 0) return { input: null, output: null }
  const lowest = resolveIntervalPrices(tiers[0], pricing)
  return { input: lowest.input_price, output: lowest.output_price }
}

function better(a: PlazaCandidate, b: PlazaCandidate): boolean {
  const ao = a.outputPaid ?? Number.POSITIVE_INFINITY
  const bo = b.outputPaid ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao < bo
  return (a.inputPaid ?? Number.POSITIVE_INFINITY) < (b.inputPaid ?? Number.POSITIVE_INFINITY)
}

/** Cheapest anonymous pay-as-you-go price per (vendor, model). */
export function collectCandidates(response: ModelPlazaResponse | null | undefined): PlazaCandidate[] {
  const best = new Map<string, PlazaCandidate>()
  for (const group of response?.groups ?? []) {
    if (!isAnonymousPayGoGroup(group)) continue
    const rate = Number.isFinite(group.rate_multiplier) ? group.rate_multiplier : 1
    for (const model of group.models ?? []) {
      const vendor = PLATFORM_VENDOR[(model.platform || group.platform || '').toLowerCase()]
      if (!vendor || !isTokenBilled(model)) continue
      const base = baseTokenPrices(model)
      if (base.input == null && base.output == null) continue
      const candidate: PlazaCandidate = {
        vendor,
        name: model.name,
        inputPaid: base.input == null ? null : base.input * rate,
        outputPaid: base.output == null ? null : base.output * rate,
        officialOutput: model.official_pricing?.output_price ?? null
      }
      const key = `${vendor}:${model.name}`
      const current = best.get(key)
      if (!current) {
        best.set(key, candidate)
      } else {
        if (better(candidate, current)) best.set(key, { ...candidate, officialOutput: current.officialOutput ?? candidate.officialOutput })
      }
    }
  }
  return [...best.values()]
}

/** Flagship-first ordering (official output price desc, then name desc). */
export function compareFlagship(a: PlazaCandidate, b: PlazaCandidate): number {
  const pa = a.officialOutput
  const pb = b.officialOutput
  if (pa != null && pb != null && pa !== pb) return pb - pa
  if (pa != null && pb == null) return -1
  if (pa == null && pb != null) return 1
  return b.name.localeCompare(a.name)
}

export function formatPerMillion(value: number | null): string {
  return formatScaled(value, PER_MILLION, MIN_DECIMALS)
}

function toCard(c: PlazaCandidate): PlazaCard {
  return { vendor: c.vendor, name: c.name, input: formatPerMillion(c.inputPaid), output: formatPerMillion(c.outputPaid) }
}

export type PlazaFilter = 'all' | BrandVendor

/** Vendors that have at least one card, in card order. */
export function availableVendors(candidates: PlazaCandidate[]): BrandVendor[] {
  return VENDOR_CARD_ORDER.filter((v) => candidates.some((c) => c.vendor === v))
}

export function selectCards(candidates: PlazaCandidate[], filter: PlazaFilter): PlazaCard[] {
  if (filter === 'all') {
    return VENDOR_CARD_ORDER.flatMap((vendor) => {
      const top = candidates.filter((c) => c.vendor === vendor).sort(compareFlagship)[0]
      return top ? [toCard(top)] : []
    })
  }
  return candidates
    .filter((c) => c.vendor === filter)
    .sort(compareFlagship)
    .slice(0, MAX_CARDS_PER_VENDOR)
    .map(toCard)
}
