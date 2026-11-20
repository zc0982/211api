# 品牌首页（brand-home）

`/home` 的 211API 品牌首页，v3「星链」：夜空像素首屏 + 暖纸色内容区 + 像素工地页脚。设计源是 Figma「211API」（fileKey `5ZuuXYB3ZCw4RFHh8sYFTj`）区块 06 的「Home / v3 · 星链 1440」（节点 `46:2719`）和区块 07 的深色版「Home / v3 · 星链 · Dark 1440」（节点 `94:47709`，结构一一对应）。规范以设计仓库的 `DESIGN.md`、`PRODUCT.md`、`.impeccable/design.json`、`export/sprites/README.md` 和 `handoff/home-v3-prompts.md` 为准；本仓库的副本在 `docs/brand/`（只读，以设计源为准）。v2（浑天仪首屏，Figma `1:1147` / `46:1740`）已停用。

## 接入方式

- 代码全部在 `frontend/src/features/brand-home/`。上游 `views/HomeView.vue` 不改不删。
- `/home` 路由组件改为 `features/brand-home/HomeEntry.vue`，`meta.titleKey = 'brandHome.meta.title'`。
- `HomeEntry` 用纯函数 `resolveHomeVariant(settings, env)`（`composables/homeVariant.ts`）选页面，按顺序：
  1. `home_content` 去掉首尾空白后非空 → 上游 HomeView（管理员自定义首页，也是运行时回退通道）；
  2. `compact_home_enabled === true` → 上游 HomeView；
  3. 构建时 `VITE_BRAND_HOME === 'off'` → 上游 HomeView（构建级应急回退）；
  4. 其他（包括公开设置获取失败、设置未知）→ BrandHome。
- 两个页面都用 `defineAsyncComponent` 懒加载，各自成 chunk。`publicSettingsLoaded` 为 false 时（后端读取设置失败时不注入 `__APP_CONFIG__`）先 `await fetchPublicSettings()`，请求最长 30s 才超时；决定前只显示中性加载占位（三个圆点，跟随当前文字色），不渲染任何一页。

### 回退方法

| 场景 | 做法 | 生效 |
|---|---|---|
| 临时换回上游首页（运行时） | 管理后台填写「首页内容」（`home_content`），或开启紧凑首页 | 立即，无需发版 |
| 构建级关闭品牌首页 | 构建前端时设置 `VITE_BRAND_HOME=off` | 重新构建发布后 |
| 彻底移除 | 把 router `/home` 的 component 改回 `() => import('@/views/HomeView.vue')`，删除 `features/brand-home` 与 i18n 接入行 | 发版后 |

## 允许改动的上游文件

| 文件 | 改动 | 原因 |
|---|---|---|
| `frontend/src/router/index.ts` | `/home` 的 component 与 `titleKey` | 接入入口 |
| `frontend/tailwind.config.js` | `theme.extend` 下追加 `colors.brand`（含 v3 的 `band`）、`fontFamily.brand-*`、`boxShadow.brand-*`、`borderRadius.brand-*`（相邻已有行只补逗号）。`colors.brand.*` 写成 `rgb(var(--brand-*) / <alpha-value>)`，`boxShadow.brand-*` 写成 `var(--bh-shadow-*)`，值由 `brand-home.css` 按主题提供 | 品牌 token，不改已有键；随深浅色切换 |
| `frontend/src/i18n/locales/{zh,en}/index.ts` | 各加一行 import 和 `brandHome` 键 | 文案命名空间 |
| `frontend/vite.config.ts` | `manualChunks` 在 `vendor-misc` 兜底前追加 `@lobehub/icons-vue → vendor-brand-icons` | 不追加时图标会被并入所有页面都 modulepreload 的 `vendor-misc`（经用户确认后加入）。v2 的 `vendor-three` 分支随 three.js 一起删除 |
| 根 `Makefile` | `FRONTEND_CRITICAL_VITEST` 登记 brand-home 的 8 个测试 | CI 只跑这份清单 |
| `frontend/package.json`、`pnpm-lock.yaml` | 新增 `@lobehub/icons-vue` 精确版本（v2 的 `three`、`@types/three` 已移除） | 厂商 / 工具图标（Vue 3 包） |
| `frontend/public/logo.svg` | 换成品牌首页学士帽标志（透明底，藏青帽 + 金穗） | 未上传站点 Logo 时，控制台侧栏、登录页、公开页和 favicon 的回退图与首页一致，见「标志」 |
| `AppSidebar.vue`、`AuthLayout.vue`、`PlazaNavBar.vue`、`LegalDocumentView.vue`、`KeyUsageView.vue`、`HomeView.vue` | 标志容器/图片追加 `dark:bg-white dark:p-*`（`PlazaNavBar.vue`、`LegalDocumentView.vue` 原有的 `dark:bg-dark-800` 换成 `dark:bg-white`） | 透明底藏青标志在深色模式下需浅色底，见「标志」 |

除上表外，不改后端、其他页面和全局样式（`style.css`、`main.ts`）。

## 主题（跟随系统 + 手动切换）

- **状态复用上游，不新增存储键。** 上游 `main.ts` 的 `initThemeClass()` 在挂载前按 `localStorage.theme`（`'dark'` / `'light'`，没有值 = 跟随系统）写 `html.dark`；控制台 `AppSidebar.vue` 的切换按钮读写同一个键。品牌首页的 `composables/useBrandTheme.ts` 用同一个键和同一个类，首页和控制台的选择互相同步。没有改上游文件。
- 默认跟随系统：监听 `matchMedia('(prefers-color-scheme: dark)')` 的 `change` 实时跟随。点导航里的主题按钮手动切换后写入 `theme`，以手动选择为准，刷新后保留；其他标签页改了 `theme` 时通过 `storage` 事件同步。`setPreference('system')` 会删除手动值（v3 的按钮只在浅 / 深之间切换，没有「跟随系统」选项；清除手动值后自动恢复跟随系统）。
- **首次绘制前确定主题**：靠上游 `main.ts` 在 `app.mount` 前写好 `html.dark`，品牌首页挂载时只复核一次。没有改 `index.html`；JS 加载前的空白帧是全站已有行为。
- **按钮**（`components/ThemeToggle.vue`，DESIGN.md「Navigation」）：在「登录」左侧 12px，36px 圆形，月白 6% 底、白 22% 描边，16px、1.5px 描边的月白线条图标；浅色显示太阳、深色显示月亮；`aria-label` 写明切到哪个主题。窄屏也保留。
- **颜色全部走 CSS 变量**（`styles/brand-home.css`）：`--brand-*` 是 `R G B` 三元组，`.brand-home` 上是浅色值，`.dark .brand-home` 只覆盖为 DESIGN.md「Dark Theme」表里的深色值（含 v3 的 `band`）；组件里写 `var(--bh-*)` 或 `rgb(var(--brand-*) / α)`，不用 Tailwind `dark:` 变体。根节点 `color-scheme` 随主题，保留 `min-height: 100dvh`。
- 没进 token 的暖纸色细节也是变量：表格行线 `--bh-row-line`、表头 `--bh-head-bg` / `--bh-head-line`、「示例数据」标签 `--bh-tag-bg`、次级按钮描边 `--bh-btn-line`、服务状态玻璃面板 `--bh-panel-bg` / `--bh-panel-edge`、FAQ 折叠项 `--bh-faq-bg`；深色值按 DESIGN.md 同一节。阴影 `rgb(var(--bh-shadow-navy) / min(calc(a * var(--bh-shadow-k)), 0.5))`：浅色深蓝 × 1，深色黑色 × 3、上限 50%。
- **两种主题下都不变**：首屏和页脚的夜空像素场景、导航、快速接入的代码面板、密钥额度卡。它们用固定的 `--bh-night-*` 变量；深色下深色卡片外框补 1px `#1f2d48`（`--bh-dark-card-edge`）。
- 切换时 `useBrandTheme` 给根节点加 `.bh-theming` 约 250ms，背景色 / 文字色 / 描边色过渡 200ms；`prefers-reduced-motion` 下不加。
- 不复用上游 `LocaleSwitcher`，语言切换是自写的 `components/LocaleToggle.vue`，放在页脚品牌信息下方；页脚在本地把它用到的变量换成夜色值。

## 链接与登录态

统一由 `composables/homeLinks.ts` 的 `resolveHomeLinks(settings, auth)` 计算，读 `appStore.cachedPublicSettings` 与 `authStore`：

| 入口 | 规则 |
|---|---|
| 获取 API Key | 已登录 `/keys`；未登录且 `registration_enabled === false` → `/login`，否则 `/register` |
| 控制台 / 登录 | 已登录显示控制台：管理员 `/admin/dashboard`，普通用户 `/dashboard`（同 `HomeView.vue` `dashboardPath`）；未登录显示「登录」→ `/login` |
| 模型 / 模型价格 / 查看全部模型 | `model_plaza_enabled === true` 且（不要求登录或已登录）时显示 `/model-plaza`（同 `HomeView.vue` `showModelPlazaEntry`），否则隐藏 |
| 文档 / 查看文档 | `doc_url` 经 `sanitizeUrl` 后非空才显示，外链 `rel="noopener"` |
| 联系我们 | `contact_info` 非空才显示；能校验为 http(s) 链接或邮箱时作为链接，否则点击后以纯文本展示，不用 `v-html` |
| 查看调用明细 / 在调用明细中查看 / 在控制台中打开 | `/usage`，未登录交给路由守卫 |
| 前往密钥管理、页脚「密钥」 | `/keys`，未登录交给路由守卫 |
| 查看接入文档 | 同「文档」：`doc_url` 安全时显示 |
| 注册（页脚「账户」列） | 未登录且注册未关闭时显示 |
| 状态、关于（导航「状态」、页脚「关于」列） | 没有公开页面，隐藏 |

导航「首页」用 `scrollIntoView` 回到顶部；路由 `scrollBehavior` 不处理 hash，不改。字标和版权用 `site_name`（缺省 `211API`）+ 当前年份。

## 数据来源与隐藏规则

### 模型卡（`composables/plazaCards.ts`、`useModelPlazaCards.ts`）

- 只在模型广场对当前访客可见时请求 `@/api/modelPlaza` 的 `getModelPlaza`；区块距视口 400px 内才发请求；同一页面会话内缓存（失败也缓存为空，不重试）。
- 404、401、网络失败：隐藏整组卡片和筛选芯片，只保留标题与「查看全部模型」链接，不弹错误。注意：带过期 token 的 401 会触发共享 `apiClient` 拦截器的刷新 / 跳转登录逻辑，这是全站行为，与模型广场页一致。
- 四家筛选按 `platform` 映射：`anthropic→Claude`、`openai→OpenAI`、`gemini→Gemini`、`grok→Grok`；其他平台（含 Composite 分组里的其他平台模型）不进卡片，「全部」也只含这四家。
- **价格口径**（如运营另有决定以运营为准）：
  - 只看匿名访客可见、按量付费的分组：排除 `is_exclusive` 与 `subscription_type === 'subscription'` 分组；
  - 只看 token 计费模型；标准时段价（不乘 `time_pricing` 时段倍率）；有长上下文阶梯且没有基础价时取最低档（`resolveIntervalPrices`）；
  - 实付价 = 渠道单价 × 分组 `rate_multiplier`（不使用 `user_rate_multiplier`，保证所有访客看到同一个「起」价），用 `formatScaled(value, 1_000_000, 2)` 换算为 USD / 1M tokens——与 `PlazaModelPricingTable.vue` 的 `paidPerMillion` 同一公式（该函数在 SFC 内部，未导出，故按同一公式调用 `@/utils/pricing`）；
  - 同一模型在多个分组出现时取输出价最低的分组（输入价取同一分组），标注「起」。
- **代表模型选取规则**：每家取官方参考输出价（`official_pricing.output_price`）最高的模型，同价按模型名降序——与 `PlazaModelPricingTable.vue` 的排序一致；「全部」按 Claude、OpenAI、Gemini、Grok 顺序每家一张；单家筛选最多 4 张。
- 接口没有上下文长度和热度数据：卡片不显示上下文，不实现「按热度排序」，也不显示 Figma 的能力图标。

### 运营数据

可用率、首字延迟、今日 / 累计调用、「所有系统运行正常」没有公开接口：

- 首屏徽章用「一个接口 · 四家模型」（PRODUCT.md）；
- 「服务状态」区块（`sections/StatusSection.vue`）不渲染，由 `config.ts` 的 `liveStats = false` 控制。开关是代码级的，不接后台设置或环境变量；接入时数值只能来自真实接口。

### 示例数据标注

示意 UI：首屏工位状态牌、「429 → 已自动切换」标记和金色光点；快速接入的响应行；调用明细面板与时间线；密钥额度卡；页脚工地的参数牌（首字、tok/s、token、缓存命中、上下文）。标注：首屏右下「界面数值为示意」，快速接入下方「接入示意 · 地址与密钥为占位，响应数值为示意」，调用明细与额度卡右上「示例数据」，额度卡下方「密钥额度示意」，页脚「工地参数为示意」。所有示意数值写在 `config.ts`，不硬编码在模板里；不做数字滚动，不出现「实时」。调用明细只展示控制台真实存在的字段（模型、总耗时、首字延迟、tokens、费用、状态，见 `backend/internal/handler/dto/types.go` `UsageLog`），金额统一用美元（与控制台一致，Figma 为人民币）。

### 代码示例

`base_url`：`api_base_url` 非空用它，否则 `window.location.origin`；按 `UseKeyModal.vue` 的做法去掉末尾 `/v1` 与 `/`，再补 `/v1`（`composables/baseUrl.ts`）。客户端（`composables/codeSamples.ts`）：OpenAI SDK（Python / Node.js）、curl、Codex 用 `/v1` 地址；Anthropic SDK 与 Claude Code 用根地址（`rootOf`，与 `UseKeyModal.vue` 一致）。有官方地址的客户端把官方那行划掉、211API 那行标成金色；「复制」只复制改后的代码。`api_key` 用占位符 `sk-YOUR_API_KEY`；示例模型 `config.SAMPLE_MODEL`（Codex 用 `CODEX_SAMPLE_MODEL`，与控制台 Codex 配置默认一致）。

## 文案核对

上线文案与代码能力逐条核对。没有证据的文案不渲染或改写。

| Figma 原文 | 处理 | 证据 / 理由 |
|---|---|---|
| 一个接口 · 四家模型；主流供应商 4 家 | 保留 | `docs/brand/PRODUCT.md`「模型供应商」 |
| 首屏徽章：稳定 · 透明 · 高效 | 不用，保留「一个接口 · 四家模型」 | 「稳定」「高效」没有可用率 / 延迟的公开数据（`config.liveStats = false`） |
| 首屏标题：一个账户，接入顶级编程模型。 | 保留 | 营销定位，不含可核对的数字或承诺 |
| 首屏副文：一个 Key 调通 Claude、GPT、Gemini、Grok；每次调用的路由与费用逐笔可查 | 改为「一个地址接入 Claude、GPT、Gemini、Grok；每次调用的用量与费用逐笔可查」 | 一个 Key 跨四家取决于 Composite 分组配置（同下「全部模型」一行）；用户侧没有路由信息（同下「路由节点」一行）；用量与费用见 `UsageLog` |
| 兼容 OpenAI 与 Anthropic 协议 | 保留 | `backend/internal/server/routes/gateway.go`（`/v1/messages`、`/v1/chat/completions`） |
| 一个 Key、一个地址对接全部模型 | 改为「多家模型」 | Composite 分组可跨平台路由（`backend/internal/service/admin_group.go` `PlatformComposite`），取决于管理员配置；「全部」无法保证 |
| 为每个项目创建独立密钥，可单独设置额度与有效期 | 保留 | `frontend/src/api/keys.ts`（`quota`、`expiresInDays`） |
| 逐笔查看路由节点、首字延迟、tokens 与费用 | 去掉「路由节点」 | 用户侧 `UsageLog` 只有 `account_id`，没有节点信息（`backend/internal/handler/dto/types.go`） |
| 路由公开：每次请求经过哪个节点、为何切换 | 改为「耗时逐笔记录」 | 同上；改写依据 `UsageLog.DurationMs`、`FirstTokenMs` |
| 用量透明：tokens 与首字延迟逐笔记录，实时可查 | 改为输入 / 输出 / 缓存 tokens 逐笔可查，去掉「实时」 | `UsageLog` token 字段 |
| 账单逐笔可对：账单与日志逐条对应 | 改为「费用折算到每一次请求，可导出 CSV 对账」 | `UsageLog.ActualCost`；`frontend/src/views/user/UsageView.vue` `exportToCSV` |
| 日志保留 30 天，可导出对账 | 去掉「保留 30 天」 | 没有固定保留期；清理由管理员任务执行（`backend/internal/service/usage_cleanup_service.go`） |
| 调用链路：鉴权 → 路由 → 上游 → 计费逐跳耗时 | 示意面板改为「发起请求 → 首字返回 → 响应完成 → 计费入账」时间线 | 用户端没有逐跳耗时；新时间线只用真实字段 |
| 智能路由：多节点实时测速，上游异常时毫秒级切换，请求不中断 | 改为「自动切换：多账号调度，上游异常时自动切换重试」 | `backend/internal/service/gateway_service.go` `UpstreamFailoverError`；「实时测速」「毫秒级」「不中断」无证据 |
| 全链路追踪：鉴权、路由、上游、计费逐跳记录 | 改为「逐笔记录：模型、tokens、耗时与费用」 | 同调用链路 |
| 按量计费：按官方价折算，没有月费，也没有隐性费用 | 改为「按每次请求的实际用量计费，用多少付多少」 | 站点有订阅套餐（`subscription_enabled`、`views/user/SubscriptionsView.vue`），「没有月费」不成立 |
| 用量与预算控制：额度、速率与告警，超出预算自动暂停 | 改为「额度、有效期与周期用量上限，额度用尽自动停用」 | `backend/internal/service/api_key.go`（`StatusAPIKeyQuotaExhausted`、5h/1d/7d 用量窗口）；密钥级告警无证据，「速率」实为费用上限 |
| 安全合规：密钥加密存储，传输全程 TLS，请求内容不落盘、不留存 | 改为「访问控制：IP 白名单与黑名单，可随时停用或设置过期」 | 「不落盘」与提示词审计可保存 `full_prompt` 冲突（`frontend/src/features/prompt-audit/types.ts`）；TLS 属部署层，代码无法证明；改写依据 `frontend/src/api/keys.ts`（`ip_whitelist`、`ip_blacklist`） |
| 新模型上线即接入 | 删除 | 无证据 |
| 价格公开可查 | 仅模型广场可见时显示 | `model_plaza_enabled` / `model_plaza_require_auth` |
| 迁移答案：请求和响应格式完全兼容 | 改为「兼容官方协议」；地址用运行时 base_url | 「完全」无法保证 |
| 最终 CTA 区块（1:3661）：极速、稳定、安全，从这里开始；注册即送体验额度，五分钟完成接入 | 整个区块不渲染（按产品要求删除） | 原文另有无证据表述：性能 / 安全、赠送额度 |
| 生态工具（8 个工位：Claude Code、Cursor、OpenCode、Codex、Pi、Hermes、DeepSeek Harness、OpenClaw） | 保留（v3 不再单独成块，放在首屏工位） | PRODUCT.md「生态工具」；Claude Code / Codex 配置见 `UseKeyModal.vue`，其余工具未逐一实测 |
| v3 快速接入：换一个地址，其余照旧；模型名称与官方一致 | 保留 | 同「兼容 OpenAI 与 Anthropic 协议」；模型名直接透传 |
| v3 调用明细副文：路由节点、首字延迟、tokens 和费用逐笔记录；看清鉴权 → 路由 → 上游 → 计费的完整链路 | 改为「模型、首字延迟、tokens 和费用逐笔记录；看清这次请求从发出到计费的时间线」，表格「路由节点」列改为「总耗时」，展开行改为请求时间线 | 同「路由节点」「调用链路」两行 |
| v3 调用明细：日志保留 30 天，可导出对账 | 改为「可导出 CSV 对账」 | 同「日志保留 30 天」一行 |
| v3 调用明细：429 → 200 自动切换行 | 不渲染 | 用户侧用量日志不记录重试过程 |
| v3 首屏：429 → 已切换 sg-01 | 改为「429 → 已自动切换」 | 上游失败会切换账号重试（`UpstreamFailoverError`）；「sg-01」节点名在用户侧不存在 |
| v3 密钥额度：为每个密钥设置额度、速率与告警，超出预算自动暂停；卡片「60 RPM · 告警 80%」 | 改为「额度、有效期与周期用量上限，额度用尽自动停用」；卡片第二行改为「7 天上限」 | 同「用量与预算控制」一行；密钥没有 RPM 与告警 |
| v3 核心能力：一个 Key、一个地址，调用四家供应商的全部模型 | 改为「一个地址对接多家模型，兼容 OpenAI 与 Anthropic 协议」 | 同「全部模型」一行 |
| v3 核心能力：智能路由，多节点实时测速，上游异常时自动切换节点，请求不中断 | 改为「自动切换：多账号调度，上游异常时自动切换重试」 | 同「智能路由」一行 |
| v3 核心能力：用多少付多少，没有月费；控制台与账单以人民币结算 | 改为「按每次请求的实际用量计费，用多少付多少」 | 站点有订阅套餐；控制台金额以美元显示 |
| v3 核心能力：安全合规，密钥加密存储，传输全程 TLS | 改为「访问控制：IP 白名单与黑名单，可随时停用或设置过期」 | 同「安全合规」一行 |
| v3 页脚：关于 211API | 不渲染 | 没有公开页面 |

FAQ 只上线第一条（迁移），其余 5 条（协议和 SDK、调用数据保存、查看费用、429 / 超时、发票与对公）等待真实答案后再加。

## 字体

| 字体 | 字重 | 来源（官方发布） | 许可 |
|---|---|---|---|
| Noto Serif SC | 500 / 600 | notofonts/noto-cjk `Serif2.003` · `14_NotoSerifSC.zip` · `SubsetOTF/SC` | SIL OFL 1.1 |
| Noto Sans SC | 400 / 500 | notofonts/noto-cjk `Sans2.004` · `18_NotoSansSC.zip` | SIL OFL 1.1 |
| Geist | 600 | vercel/geist-font `v1.9.2` | SIL OFL 1.1 |
| Geist Mono | 400 / 500 | vercel/geist-font `v1.9.2` | SIL OFL 1.1 |

- 许可证文件在 `features/brand-home/assets/fonts/LICENSE-*.txt`。
- 子集化脚本 `features/brand-home/scripts/subset-fonts.py`（fontTools，不进 package.json），字符清单 `scripts/charset-*.txt`。宋体只含标题用字，黑体含全部 zh / en 文案用字。**改动 brandHome 文案后必须重跑脚本**，否则新字会走回退字体。
- `@font-face` 的族名加 `Brand` 前缀，与系统已装的完整字体区分；`font-display: swap`；只 preload 首屏标题（宋体 600）和正文（黑体 400）；保留 DESIGN.md 的系统回退栈；不用外链字体。
- 字标按 DESIGN.md 用 Geist 600；Figma 字标实际是 Plus Jakarta Sans ExtraBold，未引入该字体。

## 标志

- 以后台「站点设置 → 站点 Logo」（`site_logo`）为准，全站同一来源：首页导航与页脚（`BrandHome.vue` 经 `sanitizeUrl` 传给 `components/BrandLogo.vue` 的 `src`）、控制台侧栏、登录页、公开页、后端注入的 favicon。换标志只需在后台重新上传。
- 未上传、地址不安全或图片加载失败时回退：首页用 `BrandLogo.vue` 内联的学士帽，其余页面用 `frontend/public/logo.svg`（同一学士帽，透明底，裁切 `viewBox="10 15 44 33"`）。两处回退图形来自设计源 `export/logo/logo-mark-light.svg`，改回退图时一起改。
- v3 的导航和页脚都在夜空上：内置学士帽和站点名用白色（帽穗仍是金色）；上传的标志一律加白底小圆角（规则写在 `brand-home.css` 全局段：scoped 样式里的 `:global(.dark) x` 会被编译成光秃的 `.dark {}`）。首屏月亮里的学士帽是场景的一部分，不随后台标志变化。
- 控制台侧栏、登录页、模型广场、公开页、Key 查询页和上游首页的标志容器在深色模式加白底和小内边距（`dark:bg-white dark:p-1`，大图标 `p-1.5`/`p-2`）。新增显示 `site_logo` 的位置也要加。

## 图标

- 厂商和生态工具图标用 `@lobehub/icons-vue`（Vue 3 包，精确锁定 `1.0.3`）。按单个变体路径导入（如 `@lobehub/icons-vue/es/Claude/components/Color`），只打包用到的 12 个组件。
- 变体以 Figma 为准：彩色 Claude、Gemini、Claude Code、Codex、DeepSeek（DSH）、OpenClaw；单色 OpenAI、Grok、Cursor、Pi、NousResearch（Hermes）、OpenCode。
- 不使用 `utils/platformColors.ts`；控制台的 `ModelIcon.vue`、`PlatformIcon.vue` 不变。仓库已有的 `@lobehub/icons` 是 React 包，不在 Vue 里引用。

## 动效

- 首屏：徽章 → 标题 → 副文 → 按钮依次上浮 8px（400ms，间隔 60ms）。像素场景本版本只渲染第 0 秒的静态画面（角色在 A 点、work 第 1 帧，金色光点在 Figma 位置，吊钩在顶部），角色走位、金线光点、吊钩升降、窄屏镜头平移在下一个 PR（handoff v3 提示词 2）实现。
- 首屏以下：`composables/vReveal.ts` 的 `v-reveal` 指令。挂载时顶部已在视口下方的区块才加 `.bh-reveal`，其中 `[data-reveal]` 子元素先隐藏；进入视口（rootMargin 底部 -12%）后加 `.is-revealed`，按 `--bh-i` 依次上浮淡入，只播一次。
- `prefers-reduced-motion`：关闭上浮和主题切换过渡，只保留 200ms 淡入。

## 像素场景（首屏「星链」与页脚工地）

规格来源：handoff v3 提示词 1 第二、三、四节，Figma `46:2720`（首屏）、`46:3761` / `59:22798`（页脚），素材 `export/sprites/`。

- **缩放**：`components/PixelStage.vue` 把 1440 宽的设计世界（首屏 1440×900，页脚 1440×380：340 场景 + 地面边 + 缓存牌所在的 40px 底边）用一个 `transform: scale(容器宽 / 1440)` 等比缩放，宽度由 `ResizeObserver` 测量。≥ 860px 时首屏文案是叠在场景左上方的 HTML（徽章顶 `max(96px, 100vw × 174 / 1440)`）；860px 以下文案移到场景上方，场景整幅缩放到屏宽（0.75 倍 + 30s 镜头平移在 PR 2 实现）。页面不产生横向滚动。
- **背景**：夜空渐变、地平线雾、月光、月亮光晕用 CSS；星星和「远景剪影 + 学院建筑 + 松树 + 地面」是从 Figma 分组导出后合成的两张 SVG（`assets/scene/hero-stars.svg`、`hero-skyline.svg`；页脚 `footer-stars.svg`、`footer-skyline.svg`），运行时不逐块绘制。重新导出时按文件头注释的坐标合成。
- **工位与连线**（`config.HERO_STATIONS`、`composables/starlink.ts`）：8 个工位道具 1.5 倍、底边贴地（脚线 y=838）；状态牌是 HTML 胶囊；连线是一张内联 SVG，从月亮底 (1060, 264) 到状态牌顶部中点，`c1 = s + (dx·0.22, dy·0.42)`、`c2 = e − (dx·0.18, dy·0.48)`。只有 Claude Code 是金线（One Star Rule），Codex 线在 t=0.5 挂「429 → 已自动切换」。
- **角色**：6 人各在 A 点、work 第 1 帧，头侧 18px 圆标（Claude / GPT / Gemini / Grok 用 `@lobehub/icons-vue` 模型图标，OpenCode / DSH 用工具图标）。页脚 6 人按第 0 秒状态摆放（每队前两人砌砖、第三人在砖堆抱砖，右队镜像），参数牌按状态显示首字 / tok/s / token。
- **图片**：一律 `<img>` + `image-rendering: pixelated`，宽高写死为 1x × 倍数，`decoding="async"`，`alt=""`；首屏不懒加载，页脚 `loading="lazy"`。PR 1 只引入第 0 秒用到的精灵图（首屏 8 个道具 + 6 个 work 第 1 帧，页脚 10 个道具 + 6 帧）。
- **可访问性**：两个场景容器 `aria-hidden="true"`。首屏另有视觉隐藏的工位列表（工具名、示意模型与耗时、被追踪的那一个）和「界面数值为示意」；页脚有一句场景说明。
- 示意数值、坐标全部在 `config.ts`：`HERO_STATIONS`、`HERO_CHARACTERS`、`GOLD_DOT`、`SITE_PROPS`、`SITE_HOOK`、`SITE_WORKERS`、`SITE_PARAMS`、`SITE_CACHE_CHIPS`。

## SEO

SPA，不做 SSR 或预渲染。只保证路由 `titleKey`、语义标题层级（全页一个 `h1`）、图片 `alt` 和 `<html lang>`（由 `setLocale` 维护）。爬虫若不执行 JS 只能看到 `index.html` 的站点标题。

## 上游同步检查

1. 上游 `views/HomeView.vue`：`home_content`、`compact_home_enabled` 的判断与优先级有没有变化；如有，同步 `resolveHomeVariant` 与测试。
2. 上游 `/home` 路由是否改名或新增 meta；保留本地 component 覆盖与 `titleKey`。
3. `i18n/locales/{zh,en}/index.ts` 的 `brandHome` 接入行、`tailwind.config.js` 的 `brand` 追加项（含 `band`）、`vite.config.ts` 的 `vendor-brand-icons` 分支仍在（在 `vendor-misc` 兜底之前）。
4. `@/api/modelPlaza` 的响应结构、`@/utils/pricing` 与 `PlazaModelPricingTable.vue` 的实付价公式是否变化；变化时同步 `plazaCards.ts`。
5. `appStore.fetchPublicSettings`、`authStore.isAuthenticated / isAdmin` 的语义是否变化；`main.ts` 的主题初始化与 `localStorage.theme` 约定是否变化（见「主题」）。
6. `UseKeyModal.vue` 里 Claude Code / Codex / SDK 的地址口径是否变化；变化时同步 `codeSamples.ts`。
7. 跑 `FRONTEND_CRITICAL_VITEST` 里的 brand-home 测试和 `pnpm build`。

