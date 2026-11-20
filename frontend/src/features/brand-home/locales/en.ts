/**
 * brandHome namespace (English). Every key is referenced as a static literal.
 * Copy is checked against product capabilities in docs/spec/brand-home.md.
 */
export default {
  meta: {
    title: 'Unified LLM API Gateway'
  },
  a11y: {
    skipToContent: 'Skip to main content',
    primaryNav: 'Primary',
    accountNav: 'Account',
    footerNav: 'Footer',
    language: 'Language'
  },
  nav: {
    home: 'Home',
    models: 'Models',
    docs: 'Docs',
    login: 'Log in',
    console: 'Console',
    getKey: 'Get API Key'
  },
  motion: {
    pause: 'Pause animation',
    play: 'Play animation'
  },
  theme: {
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme'
  },
  hero: {
    badge: 'Stable · Transparent · Efficient',
    titleLine1: 'One account for ',
    titleLine2: 'the top {emphasis}',
    titleEmphasis: 'coding models.',
    lead: 'Works with Claude Code, Codex and other coding tools. One endpoint reaches Claude, GPT, Gemini and Grok, and the usage and cost of every call are on record.',
    ctaDocs: 'Read the docs',
    switched: '→ switched automatically',
    illustrative: 'Figures in the interface are illustrative',
    sceneTitle: 'Ecosystem tool stations (illustrative)',
    stationLine: '{tool}: {model} · {meta}',
    tracked: '(tracked call)'
  },
  quickstart: {
    title: 'Change one address. Keep everything else.',
    subtitle: 'Compatible with the OpenAI and Anthropic APIs, with the official model names. Point base_url at {site} and your code, SDKs and coding tools keep working.',
    docsLink: 'Read the integration docs',
    clients: 'Choose a client',
    clientPythonOpenai: 'Python · OpenAI SDK',
    clientNodeOpenai: 'Node.js · OpenAI SDK',
    clientPythonAnthropic: 'Python · Anthropic SDK',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    removedLine: 'Previous address: ',
    onlyLine: 'the only line to change',
    pointHere: 'points at {site}',
    sampleGreeting: 'Hello',
    viewLogs: 'View in usage logs',
    caption: 'Integration example · address and key are placeholders, response figures are illustrative'
  },
  trace: {
    title: 'Every call, on the record',
    subtitle: 'Model, time to first token, tokens and cost are logged per request. Expand any row to see the request from sending to billing.',
    viewLogs: 'View usage logs',
    panelTitle: 'Usage logs',
    panelLabel: 'Example of the usage log screen with sample data',
    sampleData: 'Sample data',
    exportCsv: 'Export CSV',
    filterTime: 'Last 24 hours',
    filterModel: 'All models',
    filterStatus: 'All statuses',
    searchPlaceholder: 'Search request ID',
    colTime: 'Time',
    colRequestId: 'Request ID',
    colModel: 'Model',
    colDuration: 'Duration',
    colFirstToken: 'TTFT',
    colTokens: 'Input / output tokens',
    colCost: 'Cost',
    colStatus: 'Status',
    colDetail: 'Expand',
    timelineLabel: 'Request timeline',
    firstTokenShort: 'TTFT',
    durationShort: 'duration',
    stageSent: 'Request sent',
    stageFirstToken: 'First token',
    stageDone: 'Completed',
    stageBilled: 'Billed',
    billedValue: '{cost} · recorded',
    footer: '{total} calls · export to CSV to reconcile',
    openInConsole: 'Open in console'
  },
  budget: {
    titleLine1: 'Every key’s budget,',
    titleLine2: 'at a glance',
    subtitle: 'Give each key a quota, an expiry and rolling spending caps. Keys stop when the quota runs out.',
    link: 'Manage API keys',
    cardTitle: 'Key budgets',
    keyProduction: 'Production',
    keyStaging: 'Staging',
    keyTeam: 'Team',
    usedLabel: '{name} quota used',
    cap: '7-day cap {cap}',
    autoDisable: 'Stops when the quota runs out',
    caption: 'Key budget example'
  },
  features: {
    title: 'Core capabilities',
    unifiedTitle: 'One API',
    unifiedDesc: 'One endpoint for many models, compatible with the OpenAI and Anthropic APIs.',
    routingTitle: 'Automatic failover',
    routingDesc: 'Requests are scheduled across accounts and retried elsewhere when an upstream fails.',
    billingTitle: 'Pay as you go',
    billingDesc: 'Billed by what each request actually uses.',
    accessTitle: 'Access control',
    accessDesc: 'Restrict keys with IP allow and deny lists, and disable or expire them at any time.'
  },
  plaza: {
    title: 'Four major providers, one endpoint',
    subtitle: 'Call several providers with the same key. Prices are public.',
    subtitleNoPricing: 'Call several providers with the same key.',
    filterLabel: 'Filter by provider',
    all: 'All',
    inputPerMillion: 'Input / 1M tokens',
    outputPerMillion: 'Output / 1M tokens',
    priceFrom: 'from {price}',
    footnote: 'One flagship model per provider · lowest price paid · USD per 1M tokens',
    viewAll: 'View all models'
  },
  status: {
    allOperational: 'All systems operational',
    label: 'Service status',
    availability: 'Availability',
    avgFirstToken: 'Avg. time to first token',
    providers: 'Major providers',
    totalCalls: 'Total calls',
    viewLive: 'View live status'
  },
  faq: {
    title: 'Before you integrate',
    subtitleBoth: "Can't find an answer? Read the docs or contact us.",
    subtitleDocs: "Can't find an answer? Read the docs.",
    subtitleContact: "Can't find an answer? Contact us.",
    docs: 'Read the docs',
    contact: 'Contact us',
    contactLabel: 'Contact: ',
    migrateQuestion: 'How do I migrate from an official API to {site}?',
    migrateAnswer:
      'Create an API key in the console, set base_url in your SDK or tool to {baseUrl} and replace api_key. Model names match the official ones and requests and responses follow the official APIs, so existing code keeps working; Claude Code switches over through environment variables and Codex through config.toml.'
  },
  footer: {
    tagline: 'A unified LLM API gateway',
    product: 'Product',
    account: 'Account',
    register: 'Sign up',
    pricing: 'Model pricing',
    keys: 'API keys',
    console: 'Console',
    login: 'Log in',
    copyright: '© {year} {site}',
    siteNote: 'Site figures are illustrative',
    chipFirstToken: 'TTFT',
    chipCache: 'Cache hit',
    chipContext: 'Context',
    sceneSummary: 'Pixel construction site: students carry bricks and build a wall; each brick stands for a token. Figures are illustrative.'
  }
}
