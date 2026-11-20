/**
 * brandHome 命名空间（中文）。所有键在源码中以静态字面量引用。
 * 文案与代码能力的核对见 docs/spec/brand-home.md「文案核对」。
 */
export default {
  meta: {
    title: '统一大模型 API 网关'
  },
  a11y: {
    skipToContent: '跳到主要内容',
    primaryNav: '主导航',
    accountNav: '账户',
    footerNav: '页脚导航',
    language: '语言'
  },
  nav: {
    home: '首页',
    models: '模型',
    docs: '文档',
    login: '登录',
    console: '控制台',
    getKey: '获取 API Key'
  },
  theme: {
    toDark: '切换到深色主题',
    toLight: '切换到浅色主题'
  },
  hero: {
    badge: '一个接口 · 四家模型',
    titleLine1: '一个账户，',
    titleLine2: '接入顶级{emphasis}',
    titleEmphasis: '编程模型。',
    lead: '兼容 Claude Code、Codex 等编码工具，一个地址接入 Claude、GPT、Gemini、Grok；每次调用的用量与费用逐笔可查。',
    ctaDocs: '查看文档',
    switched: '→ 已自动切换',
    illustrative: '界面数值为示意',
    sceneTitle: '生态工具工位（示意）',
    stationLine: '{tool}：{model} · {meta}',
    tracked: '（被追踪的调用）'
  },
  quickstart: {
    title: '换一个地址，其余照旧',
    subtitle: '兼容 OpenAI 与 Anthropic 协议，模型名称与官方一致。把 base_url 换成 {site} 的地址，现有代码、SDK 和编码工具照常运行。',
    docsLink: '查看接入文档',
    clients: '选择客户端',
    clientPythonOpenai: 'Python · OpenAI SDK',
    clientNodeOpenai: 'Node.js · OpenAI SDK',
    clientPythonAnthropic: 'Python · Anthropic SDK',
    copy: '复制',
    copied: '已复制',
    copyFailed: '复制失败',
    removedLine: '原来的地址：',
    onlyLine: '只改这一行',
    pointHere: '指向 {site}',
    sampleGreeting: 'Hello',
    viewLogs: '在调用明细中查看',
    caption: '接入示意 · 地址与密钥为占位，响应数值为示意'
  },
  trace: {
    title: '每一次调用，都有据可查',
    subtitle: '模型、首字延迟、tokens 和费用逐笔记录。展开任意一行，看清这次请求从发出到计费的时间线。',
    viewLogs: '查看调用明细',
    panelTitle: '调用明细',
    panelLabel: '调用明细界面示例，数据为示例',
    sampleData: '示例数据',
    exportCsv: '导出 CSV',
    filterTime: '近 24 小时',
    filterModel: '全部模型',
    filterStatus: '全部状态',
    searchPlaceholder: '搜索请求 ID',
    colTime: '时间',
    colRequestId: '请求 ID',
    colModel: '模型',
    colDuration: '总耗时',
    colFirstToken: '首字',
    colTokens: '输入 / 输出 tokens',
    colCost: '费用',
    colStatus: '状态',
    colDetail: '展开',
    timelineLabel: '请求时间线',
    firstTokenShort: '首字',
    durationShort: '总耗时',
    stageSent: '发起请求',
    stageFirstToken: '首字返回',
    stageDone: '响应完成',
    stageBilled: '计费入账',
    billedValue: '{cost} · 已入账',
    footer: '共 {total} 条 · 可导出 CSV 对账',
    openInConsole: '在控制台中打开'
  },
  budget: {
    titleLine1: '每个密钥的额度，',
    titleLine2: '一眼总览',
    subtitle: '为每个密钥设置额度、有效期与周期用量上限，额度用尽自动停用。',
    link: '前往密钥管理',
    cardTitle: '密钥额度',
    keyProduction: '生产环境',
    keyStaging: '测试环境',
    keyTeam: '团队共享',
    usedLabel: '{name} 已用额度',
    cap: '7 天上限 {cap}',
    autoDisable: '额度用尽后自动停用',
    caption: '密钥额度示意'
  },
  features: {
    title: '核心能力',
    unifiedTitle: '统一接口',
    unifiedDesc: '一个地址对接多家模型，兼容 OpenAI 与 Anthropic 协议。',
    routingTitle: '自动切换',
    routingDesc: '多账号调度，上游异常时自动切换重试。',
    billingTitle: '按量计费',
    billingDesc: '按每次请求的实际用量计费，用多少付多少。',
    accessTitle: '访问控制',
    accessDesc: '密钥支持 IP 白名单与黑名单，可随时停用或设置过期。'
  },
  plaza: {
    title: '4 大主流供应商 · 一站式接入',
    subtitle: '同一个 Key 调用多家模型，价格公开可查。',
    subtitleNoPricing: '同一个 Key 调用多家模型。',
    filterLabel: '按供应商筛选',
    all: '全部',
    inputPerMillion: '输入 / 1M tokens',
    outputPerMillion: '输出 / 1M tokens',
    priceFrom: '{price} 起',
    footnote: '每家展示一款旗舰模型 · 实付价起 · 单位：美元 / 每 1M tokens',
    viewAll: '查看全部模型'
  },
  status: {
    allOperational: '所有系统运行正常',
    label: '服务状态',
    availability: '可用率',
    avgFirstToken: '平均首字延迟',
    providers: '主流供应商',
    totalCalls: '累计调用',
    viewLive: '查看实时状态'
  },
  faq: {
    title: '接入前你可能想知道',
    subtitleBoth: '找不到答案？查看文档，或直接联系我们。',
    subtitleDocs: '找不到答案？可以查看文档。',
    subtitleContact: '找不到答案？可以直接联系我们。',
    docs: '查看文档',
    contact: '联系我们',
    contactLabel: '联系方式：',
    migrateQuestion: '如何从官方 API 迁移到 {site}？',
    migrateAnswer:
      '在控制台创建 API Key，把 SDK 或工具中的 base_url 改为 {baseUrl} 并替换 api_key 即可。模型名称与官方一致，请求和响应格式兼容官方协议，原有代码无需改动；Claude Code 通过环境变量、Codex 通过 config.toml 完成切换。'
  },
  footer: {
    tagline: '统一的大模型 API 网关',
    product: '产品',
    account: '账户',
    register: '注册',
    pricing: '模型价格',
    keys: '密钥',
    console: '控制台',
    login: '登录',
    copyright: '© {year} {site}',
    siteNote: '工地参数为示意',
    chipFirstToken: '首字',
    chipCache: '缓存命中',
    chipContext: '上下文',
    sceneSummary: '像素工地插画：学子们搬砖砌墙，砖块代表 token，参数为示意。'
  }
}
