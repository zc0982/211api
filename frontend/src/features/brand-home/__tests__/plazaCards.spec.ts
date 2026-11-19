import { describe, expect, it } from 'vitest'
import type { ModelPlazaGroup, ModelPlazaResponse, PlazaModel } from '@/api/modelPlaza'
import { availableVendors, baseTokenPrices, collectCandidates, formatPerMillion, selectCards } from '../composables/plazaCards'

const perM = (usd: number) => usd / 1_000_000

function model(name: string, platform: string, input: number | null, output: number | null, officialOutput: number | null = output, extra: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name,
    platform,
    pricing: {
      billing_mode: 'token',
      input_price: input == null ? null : perM(input),
      output_price: output == null ? null : perM(output),
      cache_write_price: null,
      cache_read_price: null,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: {
      input_price: input == null ? null : perM(input),
      output_price: officialOutput == null ? null : perM(officialOutput),
      cache_write_price: null,
      cache_read_price: null
    },
    ...extra
  }
}

function group(id: number, platform: string, rate: number, models: PlazaModel[], extra: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id,
    name: `g${id}`,
    description: '',
    platform,
    subscription_type: 'standard',
    rate_multiplier: rate,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    video_rate_independent: false,
    video_rate_multiplier: 1,
    long_context_pricing_enabled: false,
    models,
    ...extra
  }
}

const response = (groups: ModelPlazaGroup[]): ModelPlazaResponse => ({ description: '', groups })

describe('formatPerMillion', () => {
  it('converts USD/token to USD per 1M tokens with at least 2 decimals', () => {
    expect(formatPerMillion(perM(3))).toBe('$3.00')
    expect(formatPerMillion(perM(1.25))).toBe('$1.25')
    expect(formatPerMillion(perM(0.0125))).toBe('$0.0125')
    expect(formatPerMillion(null)).toBe('-')
  })
})

describe('collectCandidates', () => {
  it('applies the group rate multiplier and keeps the cheapest anonymous group', () => {
    const candidates = collectCandidates(
      response([
        group(1, 'anthropic', 1.5, [model('claude-x', 'anthropic', 3, 15)]),
        group(2, 'anthropic', 0.8, [model('claude-x', 'anthropic', 3, 15)])
      ])
    )
    expect(candidates).toHaveLength(1)
    expect(formatPerMillion(candidates[0].inputPaid)).toBe('$2.40')
    expect(formatPerMillion(candidates[0].outputPaid)).toBe('$12.00')
  })

  it('ignores exclusive and subscription groups and user-specific multipliers', () => {
    const candidates = collectCandidates(
      response([
        group(1, 'anthropic', 1, [model('claude-x', 'anthropic', 3, 15)], { user_rate_multiplier: 0.1 }),
        group(2, 'anthropic', 0.2, [model('claude-x', 'anthropic', 3, 15)], { is_exclusive: true }),
        group(3, 'anthropic', 0.3, [model('claude-x', 'anthropic', 3, 15)], { subscription_type: 'subscription' })
      ])
    )
    expect(formatPerMillion(candidates[0].outputPaid)).toBe('$15.00')
  })

  it('maps only the four vendors and drops non-token billing', () => {
    const image = model('img-1', 'openai', 1, 1)
    image.pricing!.billing_mode = 'image'
    const candidates = collectCandidates(
      response([
        group(1, 'openai', 1, [model('gpt-a', 'openai', 1, 2), image]),
        group(2, 'antigravity', 1, [model('other', 'antigravity', 1, 2)]),
        group(3, 'gemini', 1, [model('gem', 'gemini', 1, 2)]),
        group(4, 'grok', 1, [model('grok', 'grok', 1, 2)])
      ])
    )
    expect(candidates.map((c) => `${c.vendor}:${c.name}`).sort()).toEqual(['gemini:gem', 'grok:grok', 'openai:gpt-a'])
  })

  it('uses the lowest long-context tier when no base price is set', () => {
    const tiered = model('tiered', 'anthropic', null, null)
    tiered.pricing!.intervals = [
      { min_tokens: 200000, max_tokens: null, tier_label: '', input_price: perM(6), output_price: perM(22.5), cache_write_price: null, cache_read_price: null, per_request_price: null, sort_order: 1 },
      { min_tokens: 0, max_tokens: 200000, tier_label: '', input_price: perM(3), output_price: perM(15), cache_write_price: null, cache_read_price: null, per_request_price: null, sort_order: 0 }
    ] as never
    expect(baseTokenPrices(tiered)).toEqual({ input: perM(3), output: perM(15) })
  })

  it('returns nothing for an empty or failed response', () => {
    expect(collectCandidates(null)).toEqual([])
    expect(collectCandidates(response([]))).toEqual([])
  })
})

describe('selectCards', () => {
  const candidates = collectCandidates(
    response([
      group(1, 'anthropic', 1, [model('claude-haiku', 'anthropic', 1, 5), model('claude-opus', 'anthropic', 5, 25)]),
      group(2, 'openai', 1, [model('gpt-mini', 'openai', 0.25, 2), model('gpt-big', 'openai', 1.25, 10)]),
      group(3, 'grok', 1, [model('grok-4', 'grok', 3, 15)])
    ])
  )

  it('"all" shows one flagship per vendor in Figma order (Claude, OpenAI, Gemini, Grok)', () => {
    expect(selectCards(candidates, 'all')).toEqual([
      { vendor: 'claude', name: 'claude-opus', input: '$5.00', output: '$25.00' },
      { vendor: 'openai', name: 'gpt-big', input: '$1.25', output: '$10.00' },
      { vendor: 'grok', name: 'grok-4', input: '$3.00', output: '$15.00' }
    ])
  })

  it('a vendor filter lists that vendor flagship first', () => {
    expect(selectCards(candidates, 'openai').map((c) => c.name)).toEqual(['gpt-big', 'gpt-mini'])
    expect(selectCards(candidates, 'gemini')).toEqual([])
  })

  it('exposes only vendors that have cards', () => {
    expect(availableVendors(candidates)).toEqual(['claude', 'openai', 'grok'])
  })
})
