/**
 * Quick-start code samples as token lines (rendered as text spans, never
 * v-html). Colours follow Figma 1:2466: keyword/param navy, call blue,
 * string bronze, punctuation slate, comment mist.
 */

export type TokenKind = 'plain' | 'kw' | 'fn' | 'key' | 'str' | 'punct' | 'comment'
export type CodeToken = readonly [string, TokenKind]
export type CodeLine = readonly CodeToken[]

export type SampleLanguage = 'curl' | 'python' | 'node'

export interface SampleInput {
  baseUrl: string
  model: string
  apiKey: string
  greeting: string
  comment: string
}

export interface CodeSample {
  language: SampleLanguage
  label: string
  filename: string
  lines: CodeLine[]
  /** 1-based line number of the base_url line (highlighted). */
  highlight: number
}

const q = (s: string) => `"${s}"`

function python(i: SampleInput): CodeSample {
  return {
    language: 'python',
    label: 'Python',
    filename: 'main.py',
    highlight: 4,
    lines: [
      [['from', 'kw'], [' openai ', 'plain'], ['import', 'kw'], [' ', 'plain'], ['OpenAI', 'fn']],
      [],
      [['client = ', 'plain'], ['OpenAI', 'fn'], ['(', 'punct']],
      [['    ', 'plain'], ['base_url', 'key'], ['=', 'plain'], [q(i.baseUrl), 'str'], [',', 'punct'], ['  # ' + i.comment, 'comment']],
      [['    ', 'plain'], ['api_key', 'key'], ['=', 'plain'], [q(i.apiKey), 'str'], [',', 'punct']],
      [[')', 'punct']],
      [],
      [['resp = client', 'plain'], ['.', 'punct'], ['chat', 'plain'], ['.', 'punct'], ['completions', 'plain'], ['.', 'punct'], ['create', 'fn'], ['(', 'punct']],
      [['    ', 'plain'], ['model', 'key'], ['=', 'plain'], [q(i.model), 'str'], [',', 'punct']],
      [['    ', 'plain'], ['messages', 'key'], ['=', 'plain'], ['[{', 'punct'], [q('role'), 'str'], [': ', 'punct'], [q('user'), 'str'], [', ', 'punct'], [q('content'), 'str'], [': ', 'punct'], [q(i.greeting), 'str'], ['}],', 'punct']],
      [[')', 'punct']],
      [['print', 'fn'], ['(', 'punct'], ['resp', 'plain'], ['.', 'punct'], ['choices', 'plain'], ['[', 'punct'], ['0', 'plain'], ['].', 'punct'], ['message', 'plain'], ['.', 'punct'], ['content', 'plain'], [')', 'punct']]
    ]
  }
}

function node(i: SampleInput): CodeSample {
  return {
    language: 'node',
    label: 'Node.js',
    filename: 'main.mjs',
    highlight: 4,
    lines: [
      [['import', 'kw'], [' OpenAI ', 'plain'], ['from', 'kw'], [' ', 'plain'], [q('openai'), 'str'], [';', 'punct']],
      [],
      [['const', 'kw'], [' client = ', 'plain'], ['new', 'kw'], [' ', 'plain'], ['OpenAI', 'fn'], ['({', 'punct']],
      [['  ', 'plain'], ['baseURL', 'key'], [': ', 'punct'], [q(i.baseUrl), 'str'], [',', 'punct'], [' // ' + i.comment, 'comment']],
      [['  ', 'plain'], ['apiKey', 'key'], [': ', 'punct'], [q(i.apiKey), 'str'], [',', 'punct']],
      [['});', 'punct']],
      [],
      [['const', 'kw'], [' resp = ', 'plain'], ['await', 'kw'], [' client', 'plain'], ['.', 'punct'], ['chat', 'plain'], ['.', 'punct'], ['completions', 'plain'], ['.', 'punct'], ['create', 'fn'], ['({', 'punct']],
      [['  ', 'plain'], ['model', 'key'], [': ', 'punct'], [q(i.model), 'str'], [',', 'punct']],
      [['  ', 'plain'], ['messages', 'key'], [': ', 'punct'], ['[{ ', 'punct'], ['role', 'key'], [': ', 'punct'], [q('user'), 'str'], [', ', 'punct'], ['content', 'key'], [': ', 'punct'], [q(i.greeting), 'str'], [' }],', 'punct']],
      [['});', 'punct']],
      [['console', 'plain'], ['.', 'punct'], ['log', 'fn'], ['(', 'punct'], ['resp', 'plain'], ['.', 'punct'], ['choices', 'plain'], ['[', 'punct'], ['0', 'plain'], ['].', 'punct'], ['message', 'plain'], ['.', 'punct'], ['content', 'plain'], [');', 'punct']]
    ]
  }
}

function curl(i: SampleInput): CodeSample {
  const body = `{"model": ${q(i.model)}, "messages": [{"role": "user", "content": ${q(i.greeting)}}]}`
  return {
    language: 'curl',
    label: 'cURL',
    filename: 'request.sh',
    highlight: 2,
    lines: [
      [['# ' + i.comment, 'comment']],
      [['curl', 'fn'], [' ', 'plain'], [`${i.baseUrl}/chat/completions`, 'str'], [' \\', 'punct']],
      [['  -H ', 'key'], [q(`Authorization: Bearer ${i.apiKey}`), 'str'], [' \\', 'punct']],
      [['  -H ', 'key'], [q('Content-Type: application/json'), 'str'], [' \\', 'punct']],
      [['  -d ', 'key'], [`'${body}'`, 'str']]
    ]
  }
}

export function buildSamples(input: SampleInput): CodeSample[] {
  return [curl(input), python(input), node(input)]
}

export function sampleToText(sample: CodeSample): string {
  return sample.lines.map((line) => line.map(([text]) => text).join('')).join('\n') + '\n'
}
