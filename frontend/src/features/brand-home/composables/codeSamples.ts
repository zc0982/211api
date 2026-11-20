/**
 * Quick-start samples for the v3 client list (Figma 46:3457), as token lines
 * rendered as text spans (never v-html). Each sample shows the one line that
 * changes as a diff: the official address struck out (when the client has
 * one), then the 211API address highlighted in gold.
 *
 * Addresses follow the console's「使用密钥」dialog (components/keys/UseKeyModal.vue):
 * OpenAI SDK, curl and Codex use the /v1 base; the Anthropic SDK and Claude
 * Code use the root (the SDK appends /v1/messages itself).
 */

export type TokenKind = 'plain' | 'kw' | 'str' | 'punct' | 'comment'
export type CodeToken = readonly [string, TokenKind]

export interface CodeLine {
  tokens: readonly CodeToken[]
  /** Diff marker: '-' = the official line being replaced, '+' = the 211API line. */
  mark?: '-' | '+'
}

export type SampleClient = 'pythonOpenai' | 'nodeOpenai' | 'pythonAnthropic' | 'curl' | 'claudeCode' | 'codex'

export interface SampleInput {
  /** Normalised API base ending in /v1. */
  baseUrl: string
  model: string
  codexModel: string
  apiKey: string
  greeting: string
}

export interface CodeSample {
  client: SampleClient
  filename: string
  lines: CodeLine[]
}

const q = (s: string) => `"${s}"`
const line = (tokens: CodeToken[], mark?: '-' | '+'): CodeLine => (mark ? { tokens, mark } : { tokens })
const blank: CodeLine = { tokens: [] }

/** Root address for Anthropic-style clients (base without the trailing /v1). */
export function rootOf(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
}

function pythonOpenai(i: SampleInput): CodeSample {
  return {
    client: 'pythonOpenai',
    filename: 'main.py',
    lines: [
      line([['from', 'kw'], [' openai ', 'plain'], ['import', 'kw'], [' OpenAI', 'plain']]),
      blank,
      line([['client = OpenAI(', 'plain']]),
      line([['    base_url=', 'plain'], [q('https://api.openai.com/v1'), 'str'], [',', 'punct']], '-'),
      line([['    base_url=', 'plain'], [q(i.baseUrl), 'str'], [',', 'punct']], '+'),
      line([['    api_key=', 'plain'], [q(i.apiKey), 'str'], [',', 'punct']]),
      line([[')', 'plain']]),
      blank,
      line([['resp = client.chat.completions.create(', 'plain']]),
      line([['    model=', 'plain'], [q(i.model), 'str'], [',', 'punct']]),
      line([['    messages=[{', 'plain'], [q('role'), 'str'], [': ', 'punct'], [q('user'), 'str'], [', ', 'punct'], [q('content'), 'str'], [': ', 'punct'], [q(i.greeting), 'str'], ['}],', 'plain']]),
      line([[')', 'plain']])
    ]
  }
}

function nodeOpenai(i: SampleInput): CodeSample {
  return {
    client: 'nodeOpenai',
    filename: 'main.mjs',
    lines: [
      line([['import', 'kw'], [' OpenAI ', 'plain'], ['from', 'kw'], [' ', 'plain'], [q('openai'), 'str']]),
      blank,
      line([['const', 'kw'], [' client = ', 'plain'], ['new', 'kw'], [' OpenAI({', 'plain']]),
      line([['  baseURL: ', 'plain'], [q('https://api.openai.com/v1'), 'str'], [',', 'punct']], '-'),
      line([['  baseURL: ', 'plain'], [q(i.baseUrl), 'str'], [',', 'punct']], '+'),
      line([['  apiKey: ', 'plain'], [q(i.apiKey), 'str'], [',', 'punct']]),
      line([['})', 'plain']]),
      blank,
      line([['const', 'kw'], [' resp = ', 'plain'], ['await', 'kw'], [' client.chat.completions.create({', 'plain']]),
      line([['  model: ', 'plain'], [q(i.model), 'str'], [',', 'punct']]),
      line([['  messages: [{ role: ', 'plain'], [q('user'), 'str'], [', content: ', 'plain'], [q(i.greeting), 'str'], [' }],', 'plain']]),
      line([['})', 'plain']])
    ]
  }
}

function pythonAnthropic(i: SampleInput): CodeSample {
  return {
    client: 'pythonAnthropic',
    filename: 'main.py',
    lines: [
      line([['import', 'kw'], [' anthropic', 'plain']]),
      blank,
      line([['client = anthropic.Anthropic(', 'plain']]),
      line([['    base_url=', 'plain'], [q('https://api.anthropic.com'), 'str'], [',', 'punct']], '-'),
      line([['    base_url=', 'plain'], [q(rootOf(i.baseUrl)), 'str'], [',', 'punct']], '+'),
      line([['    api_key=', 'plain'], [q(i.apiKey), 'str'], [',', 'punct']]),
      line([[')', 'plain']]),
      blank,
      line([['msg = client.messages.create(', 'plain']]),
      line([['    model=', 'plain'], [q(i.model), 'str'], [', max_tokens=', 'plain'], ['1024', 'plain'], [',', 'punct']]),
      line([['    messages=[{', 'plain'], [q('role'), 'str'], [': ', 'punct'], [q('user'), 'str'], [', ', 'punct'], [q('content'), 'str'], [': ', 'punct'], [q(i.greeting), 'str'], ['}],', 'plain']]),
      line([[')', 'plain']])
    ]
  }
}

function curl(i: SampleInput): CodeSample {
  const body = `{"model": ${q(i.model)}, "messages": [{"role": "user", "content": ${q(i.greeting)}}]}`
  return {
    client: 'curl',
    filename: 'request.sh',
    lines: [
      line([['curl ', 'kw'], ['https://api.openai.com/v1/chat/completions', 'str'], [' \\', 'punct']], '-'),
      line([['curl ', 'kw'], [`${i.baseUrl}/chat/completions`, 'str'], [' \\', 'punct']], '+'),
      line([['  -H ', 'plain'], [q(`Authorization: Bearer ${i.apiKey}`), 'str'], [' \\', 'punct']]),
      line([['  -H ', 'plain'], [q('Content-Type: application/json'), 'str'], [' \\', 'punct']]),
      line([['  -d ', 'plain'], [`'${body}'`, 'str']])
    ]
  }
}

function claudeCode(i: SampleInput): CodeSample {
  return {
    client: 'claudeCode',
    filename: 'terminal',
    lines: [
      line([['# macOS / Linux', 'comment']]),
      line([['export', 'kw'], [' ANTHROPIC_BASE_URL=', 'plain'], [q(rootOf(i.baseUrl)), 'str']], '+'),
      line([['export', 'kw'], [' ANTHROPIC_AUTH_TOKEN=', 'plain'], [q(i.apiKey), 'str']]),
      blank,
      line([['claude', 'plain']])
    ]
  }
}

function codex(i: SampleInput): CodeSample {
  return {
    client: 'codex',
    filename: '~/.codex/config.toml',
    lines: [
      line([['model_provider = ', 'plain'], [q('OpenAI'), 'str']]),
      line([['model = ', 'plain'], [q(i.codexModel), 'str']]),
      blank,
      line([['[model_providers.OpenAI]', 'kw']]),
      line([['name = ', 'plain'], [q('OpenAI'), 'str']]),
      line([['base_url = ', 'plain'], [q(i.baseUrl), 'str']], '+'),
      line([['wire_api = ', 'plain'], [q('responses'), 'str']]),
      line([['requires_openai_auth = ', 'plain'], ['false', 'kw']]),
      line([['experimental_bearer_token = ', 'plain'], [q(i.apiKey), 'str']])
    ]
  }
}

export const SAMPLE_CLIENTS: readonly SampleClient[] = ['pythonOpenai', 'nodeOpenai', 'pythonAnthropic', 'curl', 'claudeCode', 'codex']

export function buildSamples(input: SampleInput): CodeSample[] {
  return [pythonOpenai(input), nodeOpenai(input), pythonAnthropic(input), curl(input), claudeCode(input), codex(input)]
}

/** What the copy button puts on the clipboard: the code after the change (no removed lines). */
export function sampleToText(sample: CodeSample): string {
  return (
    sample.lines
      .filter((l) => l.mark !== '-')
      .map((l) => l.tokens.map(([text]) => text).join(''))
      .join('\n') + '\n'
  )
}
