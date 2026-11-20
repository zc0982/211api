# 品牌首页（brand-home）

`/home` 的 211API 品牌首页。设计源是 Figma「211API」（fileKey `5ZuuXYB3ZCw4RFHh8sYFTj`）的「Home / v2 · Light 1440」（节点 `1:1147`），规范以设计仓库的 `DESIGN.md`、`PRODUCT.md`、`.impeccable/design.json` 为准；本仓库的副本在 `docs/brand/`（只读，以设计源为准）。`design.json`（组件参考 HTML/CSS、motion、breakpoints）不复制，路径为 `/Users/luoee/Design/211API-UI/.impeccable/design.json`。

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
| `frontend/tailwind.config.js` | `theme.extend` 下追加 `colors.brand`、`fontFamily.brand-*`、`boxShadow.brand-*`、`borderRadius.brand-*`（相邻已有行只补逗号） | 品牌 token，不改已有键 |
| `frontend/src/i18n/locales/{zh,en}/index.ts` | 各加一行 import 和 `brandHome` 键 | 文案命名空间 |
| `frontend/vite.config.ts` | `manualChunks` 在 `vendor-misc` 兜底前追加 `@lobehub/icons-vue → vendor-brand-icons`、`/node_modules/three/ → vendor-three` | 不追加时图标、three.js 会被并入所有页面都 modulepreload 的 `vendor-misc`。图标分支经用户确认后加入；three 分支由 PR 2 交接提示词指定 |
| 根 `Makefile` | `FRONTEND_CRITICAL_VITEST` 登记 brand-home 的 8 个测试 | CI 只跑这份清单 |
| `frontend/package.json`、`pnpm-lock.yaml` | 新增 `@lobehub/icons-vue`、`three`、`@types/three`（dev）精确版本 | 厂商 / 工具图标（Vue 3 包）；首屏浑天仪 WebGL |
| `frontend/public/logo.svg` | 换成品牌首页学士帽标志（透明底，藏青帽 + 金穗） | 未上传站点 Logo 时，控制台侧栏、登录页、公开页和 favicon 的回退图与首页一致，见「标志」 |
| `AppSidebar.vue`、`AuthLayout.vue`、`PlazaNavBar.vue`、`LegalDocumentView.vue`、`KeyUsageView.vue`、`HomeView.vue` | 标志容器/图片追加 `dark:bg-white dark:p-*`（`PlazaNavBar.vue`、`LegalDocumentView.vue` 原有的 `dark:bg-dark-800` 换成 `dark:bg-white`） | 透明底藏青标志在深色模式下需浅色底，见「标志」 |

除上表外，不改后端、其他页面和全局样式（`style.css`、`main.ts`）。

## 固定浅色

- `.brand-home` 根节点自带底色 `#f6f9fe`、墨色文字、`color-scheme: light`、`min-height: 100dvh`；不使用 `dark:` 变体，不读写 `html.dark`。
- 全局 `* { border-color }` 在 `.dark` 下会变深，品牌首页在根节点下重设为细线色。
- 不复用上游 `LocaleSwitcher`（带 `dark:` 样式），语言切换是自写的 `components/LocaleToggle.vue`，放在页脚右侧，切换不整页刷新。

## 链接与登录态

统一由 `composables/homeLinks.ts` 的 `resolveHomeLinks(settings, auth)` 计算，读 `appStore.cachedPublicSettings` 与 `authStore`：

| 入口 | 规则 |
|---|---|
| 获取 API Key | 已登录 `/keys`；未登录且 `registration_enabled === false` → `/login`，否则 `/register` |
| 控制台 / 登录 | 已登录显示控制台：管理员 `/admin/dashboard`，普通用户 `/dashboard`（同 `HomeView.vue` `dashboardPath`）；未登录显示「登录」→ `/login` |
| 模型 / 模型价格 / 查看全部模型 | `model_plaza_enabled === true` 且（不要求登录或已登录）时显示 `/model-plaza`（同 `HomeView.vue` `showModelPlazaEntry`），否则隐藏 |
| 文档 / 查看文档 | `doc_url` 经 `sanitizeUrl` 后非空才显示，外链 `rel="noopener"` |
| 联系我们 | `contact_info` 非空才显示；能校验为 http(s) 链接或邮箱时作为链接，否则点击后以纯文本展示，不用 `v-html` |
| 查看调用明细 / 查看全部调用 / 在控制台中打开 | `/usage`，未登录交给路由守卫 |
| 注册（页脚） | 未登录且注册未关闭时显示 |
| 状态、关于 | 没有公开页面，隐藏 |

导航「首页」和页脚「首页」用 `scrollIntoView` 回到顶部；路由 `scrollBehavior` 不处理 hash，不改。字标和版权用 `site_name`（缺省 `211API`）+ 当前年份。

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

- 首屏信任条只保留「主流供应商 4 家」（PRODUCT.md）；
- 「服务状态」区块（`sections/StatusSection.vue`）不渲染，由 `config.ts` 的 `liveStats = false` 控制。开关是代码级的，不接后台设置或环境变量；接入时数值只能来自真实接口。

### 示例数据标注

示意 UI：首屏 Model Chip 耗时、代码卡「200 · 286 ms」、快速接入的响应行、透明可追溯区的调用明细面板与时间线。标注：调用明细面板右上角「示例数据」，首屏 Credit 行后「界面数值为示意」。示意数字不做数字滚动，不出现「实时」。调用明细面板只展示控制台真实存在的字段（模型、总耗时、首字延迟、tokens、费用、状态，见 `backend/internal/handler/dto/types.go` `UsageLog`），金额用美元（与控制台一致）。

### 代码示例

`base_url`：`api_base_url` 非空用它，否则 `window.location.origin`；按 `UseKeyModal.vue` 的做法去掉末尾 `/v1` 与 `/`，再补 `/v1`（`composables/baseUrl.ts`）。`api_key` 用占位符 `sk-YOUR_API_KEY`。示例模型为 `config.ts` 的 `HERO_DEFAULT_MODEL`（与静态浑天仪图的金环 Claude 一致）。

## 文案核对

上线文案与代码能力逐条核对。没有证据的文案不渲染或改写。

| Figma 原文 | 处理 | 证据 / 理由 |
|---|---|---|
| 一个接口 · 四家模型；主流供应商 4 家 | 保留 | `docs/brand/PRODUCT.md`「模型供应商」 |
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
| 全面兼容主流应用与生态工具（8 个工具） | 保留 | PRODUCT.md「生态工具」；Claude Code / Codex 配置见 `UseKeyModal.vue`，其余工具未逐一实测 |

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

- 以后台「站点设置 → 站点 Logo」（`site_logo`）为准，全站同一来源：首页页头（`BrandHome.vue` 经 `sanitizeUrl` 传给 `components/BrandLogo.vue` 的 `src`）、控制台侧栏、登录页、公开页、后端注入的 favicon。换标志只需在后台重新上传。
- 未上传、地址不安全或图片加载失败时回退：首页页头用 `BrandLogo.vue` 内联的学士帽，其余页面用 `frontend/public/logo.svg`（同一学士帽，透明底，裁切 `viewBox="10 15 44 33"` 与页头一致）。两处回退图形来自设计源 `export/logo/logo-mark-light.svg`，改回退图时一起改。后台上传的标志也用透明底、同一裁切（PNG 176×132），首页页头按高 28px 显示时与内置标志尺寸相同。
- 页头里上传的图片按高 28px 等比显示（最宽 112px）。
- 标志是透明底藏青色，深色模式下看不清。控制台侧栏、登录页、模型广场、公开页、Key 查询页和上游首页的标志容器在深色模式加白底和小内边距（`dark:bg-white dark:p-1`，大图标 `p-1.5`/`p-2`）。新增显示 `site_logo` 的位置也要加。品牌首页固定浅色，不加。

## 图标

- 厂商和生态工具图标用 `@lobehub/icons-vue`（Vue 3 包，精确锁定 `1.0.3`）。按单个变体路径导入（如 `@lobehub/icons-vue/es/Claude/components/Color`），只打包用到的 12 个组件。
- 变体以 Figma 为准：彩色 Claude、Gemini、Claude Code、Codex、DeepSeek（DSH）、OpenClaw；单色 OpenAI、Grok、Cursor、Pi、NousResearch（Hermes）、OpenCode。
- 不使用 `utils/platformColors.ts`；控制台的 `ModelIcon.vue`、`PlatformIcon.vue` 不变。仓库已有的 `@lobehub/icons` 是 React 包，不在 Vue 里引用。

## 动效

- 首屏：导航 .5s 滑入（延迟 .1s）；徽章 → 标题 → 副文 → 按钮依次上浮 8px（400ms，间隔 60ms）；「海量」金色笔画 600ms 描出；云团 12–20s 漂移。
- 首屏以下：`composables/vReveal.ts` 的 `v-reveal` 指令。挂载时顶部已在视口下方的区块才加 `.bh-reveal`，其中 `[data-reveal]` 子元素先隐藏；进入视口（rootMargin 底部 -12%）后加 `.is-revealed`，按 `--bh-i` 依次上浮淡入，只播一次。挂载时已在屏内的区块、没有 IntersectionObserver 的浏览器不隐藏。
- 调用明细时间线的光点 2.4s 匀速跑完整条线（发起请求 → 计费入账）后循环。
- 首屏浑天仪：见下一节。
- `prefers-reduced-motion`：关闭漂移、光点、上浮，「海量」金线直接完成，只保留 200ms 淡入；浑天仪保留静态图（合轨态），不加载 three.js。

## 浑天仪

规格来源：Figma `10:890`（实现说明，冲突时为准）、`10:872`（分镜）、`10:763` / `10:920`（首屏），视觉对照 `10:959`（静态渲染图）；DESIGN.md「Armillary Hero」；design.json `motion.armillary-cycle`。

### 结构

| 文件 | 内容 | 是否依赖 three |
|---|---|---|
| `components/ArmillaryHero.vue` | 静态图、HTML 叠加层（铭珠、Model Chip、代码卡、接地阴影）、降级判定、按需加载 | 否 |
| `armillary/timeline.ts` | 时间函数（纯函数） | 否 |
| `armillary/capability.ts` | 降级判定（纯函数）与设备探测 | 否 |
| `armillary/dials.ts` | 外层三环刻度的 CanvasTexture 绘制 | 否 |
| `armillary/scene.ts` | three.js 场景、渲染循环、投影、资源释放 | 是，只经 `import()` 加载 |

`ArmillaryHero` 对外接口不变：props `activeVendor`、`reducedMotion`、`alt`，新增可选 `beadLabel`（铭珠的可读名称，`HeroSection` 传 `brandHome.hero.trackVendor`）；事件 `vendor-change`。`HeroSection` 按被追踪厂商取 `config.HERO_VENDOR_MODELS`，刷新 Model Chip 与代码卡的 model（耗时仍是示意值，不按厂商编造）。

各厂商的示例模型取自后端内置默认模型列表里该平台的第一个文本模型：`claude-fable-5-2`（`pkg/claude/constants.go`）、`gpt-5.6-sol`（`pkg/openai/constants.go`）、`gemini-3-flash`（`pkg/geminicli/models.go`，跳过前面的图像模型）、`grok-4.7`（`pkg/xai/models.go`）。

### 加载顺序

1. 首屏文字、按钮和静态图（`assets/hero/armillary*.webp`，合轨态、Claude 金槽）先显示。
2. 组件挂载后判定降级条件（见下）。不降级才 `import('../armillary/scene')`，连带加载 `vendor-three`。
3. 创建 `WebGLRenderer`；第一帧画完后静态图 200ms 线性淡出（`ARMILLARY_WEBGL.fadeMs`），铭珠从 Figma 坐标切换到每帧投影坐标。

### 场景

- 外层静止：地平环（r 1.2，十二地支）、子午环（r 1.13，竖直，十天干）、赤道环（r 1.0，垂直于极轴，二十八宿）。极轴在子午面内仰起 34.6°（洛阳纬度）。材质 `MeshPhysicalMaterial` 学院深蓝釉面（`#21418f`，clearcoat），刻度天蓝 `#a9c8f5`。
- 刻度与刻字由 `dials.ts` 在运行时画进 CanvasTexture，用 RingGeometry 的平面 UV 贴到环面两侧；字体为系统衬线 CJK 栈 `"Songti SC", "Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif`（品牌衬线是子集字体，未必包含这些字）。
- 内层四环（`config.ARMILLARY_RINGS`）：抛光银（`MeshStandardMaterial` metalness .92 / roughness .2，`RoomEnvironment` 环境贴图）加蓝槽 `#2f5fd0`；外→内 Claude r .86、OpenAI .75、Gemini .64、Grok .53，环宽 .044。不使用厂商品牌色。
- 被追踪的环换成金槽 `#d4a84b`，金色光点 2.4s 匀速绕行；仪心是深蓝小球加金环与淡金光晕。合轨时金环亮起、光晕闪一次，一圈蓝色细线沿赤道扩散 1.2s。
- 取景：相机仰角约 10°、视距 6.85、fov 26°，仪器绕竖轴转 2.23 rad（子午面约 53° 斜视），按 10:959 的椭圆比例反推，合轨态与静态图叠加对齐。
- 渲染：`alpha: true`、clear alpha 0 叠在 CSS 背景上；`NeutralToneMapping`；`setPixelRatio(min(devicePixelRatio, 2))`；`ResizeObserver` 跟随画布尺寸。画布比仪器区四周各大 10%（`CANVAS_OVERHANG`，给视差留余量），只按宽度定尺寸（窄屏时代码卡在框内，框比仪器高）。画布 `aria-hidden="true"`。

### 时间函数（`armillary/timeline.ts`）

- 首次合轨 3.2s：每环从 `introSpin(i) = π(2.35 + 0.4i)` 按 ease-out cubic 转回 0。
- 之后每 9.5s 一个周期：合轨停留 2.0s，再翻转 7.5s（smootherstep）。环 i 在第 c 个周期翻 `halfTurns(i, c)` = 1 或 2 个半圈，相邻环交替、方向相反。
- 每个内环绕自己在赤道面内的一条直径翻转；绕这样的轴转 π 正好回到赤道面，所以角度函数在合轨时刻恰为 π 的整数倍，合轨是角度函数本身保证的，不是插值拼接。测试逐个检查合轨时刻、停留段、相位边界连续性和 4 个周期的重复。
- 追踪轮换：外→内 Claude → OpenAI → Gemini → Grok → Claude。首次合轨保持 Claude（与静态图、Figma `t = 4.6s` 定格一致），之后每次合轨换下一家。
- 手动切换：铭珠是 `<button>`（`aria-pressed`、可读名称「追踪 Claude」等），悬停、聚焦、点击都会切换，并通过 `vendor-change` 刷新 Model Chip 与代码卡。切换后自动轮换暂停 12s（`ARMILLARY_WEBGL.manualHoldMs`），移出或失焦时再从那一刻起算 12s；之后的下一次合轨从当前厂商继续轮换。
- 视差：仅精确指针且可悬停的设备（`(hover: hover) and (pointer: fine)`，触屏不做），整体偏航 ±0.2 rad、俯仰 ±0.07 rad，指数阻尼 2.6/s。
- 铭珠、Model Chip 每帧由 3D 锚点投影到屏幕，只写 `transform`、`opacity`、`z-index`，不触发布局；转到背面时变淡缩小（opacity .35–1、scale .82–1），被追踪的铭珠保持不透明。

### 降级条件（`armillary/capability.ts`，阈值在 `config.ARMILLARY_WEBGL`）

| 条件 | 时机 | 结果（`data-armillary-reason`） |
|---|---|---|
| `prefers-reduced-motion: reduce` | 加载前；运行中切换时立即停止 | `reduced-motion`，保留静态图（合轨态） |
| 无 `WebGLRenderingContext` | 加载前 | `no-webgl` |
| `hardwareConcurrency ≤ 4` | 加载前 | `low-cores` |
| `deviceMemory ≤ 4`（GB，仅 Chromium 提供） | 加载前 | `low-memory` |
| 创建 WebGL 上下文失败 | 加载后 | `context-failed` |
| 运行中 `webglcontextlost` | 运行中 | `context-lost` |
| 首帧之后 60 帧平均帧时长 > 32ms | 运行中 | `slow-frames` |
| 窄屏（< 860px） | — | 不降级（`enableOnNarrow: true`），见下 |

降级时立即释放场景、恢复静态图和 Figma 坐标的铭珠（装饰、`aria-hidden`），追踪对象回到 Claude，与静态图一致。浏览器不提供的信号（例如 Safari 没有 `deviceMemory`）不参与判定。

窄屏：在 390×844（DPR 3）实测平均帧时长 16.6ms，与桌面相同，CPU 降速 4 倍时 16.7ms；低端机靠核数、内存和 60 帧探测兜底，所以窄屏不单独关闭。测试机是 Apple M4，未在真实低端手机上测过。

离开视口（IntersectionObserver）或 `document.hidden` 时暂停渲染循环，动画时钟随之暂停；恢复时重新开始帧时长探测。

### 分包

- `vite.config.ts` 的 `manualChunks` 在 `vendor-misc` 兜底前追加 `id.includes('/node_modules/three/') → 'vendor-three'`。不追加时 three 会被并入每个页面都 modulepreload 的 `vendor-misc`。
- `scene.ts` 是单独的应用 chunk，只被 `ArmillaryHero` 的 `import()` 引用；`vendor-three` 只出现在它的依赖里。
- 构建后检查：`dist/index.html` 的 modulepreload 只有 `vendor-vue`、`vendor-i18n`、`vendor-misc`；`/login`、`/models` 等路由不请求 three。

### 资源释放

卸载或降级时：取消 rAF，断开 ResizeObserver / IntersectionObserver，移除 `pointermove`、`visibilitychange`、`webglcontextlost` 监听；dispose 所有几何体、材质、纹理（含 PMREM 环境贴图和 CanvasTexture），`renderer.renderLists.dispose()`、`renderer.dispose()`，再 `forceContextLoss()`。开发模式下 `window.__armillary` 暴露控制器（`info()`、`freeze(t)`、`debugProject`）用于截图和泄漏检查，生产构建会裁掉。

## SEO

SPA，不做 SSR 或预渲染。只保证路由 `titleKey`、语义标题层级（全页一个 `h1`）、图片 `alt` 和 `<html lang>`（由 `setLocale` 维护）。爬虫若不执行 JS 只能看到 `index.html` 的站点标题。

## 上游同步检查

1. 上游 `views/HomeView.vue`：`home_content`、`compact_home_enabled` 的判断与优先级有没有变化；如有，同步 `resolveHomeVariant` 与测试。
2. 上游 `/home` 路由是否改名或新增 meta；保留本地 component 覆盖与 `titleKey`。
3. `i18n/locales/{zh,en}/index.ts` 的 `brandHome` 接入行、`tailwind.config.js` 的 `brand` 追加项、`vite.config.ts` 的 `vendor-brand-icons` 与 `vendor-three` 分支仍在（都要在 `vendor-misc` 兜底之前）。构建后 `dist/index.html` 的 modulepreload 里不能出现 `vendor-three`。
4. `@/api/modelPlaza` 的响应结构、`@/utils/pricing` 与 `PlazaModelPricingTable.vue` 的实付价公式是否变化；变化时同步 `plazaCards.ts`。
5. `appStore.fetchPublicSettings`、`authStore.isAuthenticated / isAdmin` 的语义是否变化。
6. 跑 `FRONTEND_CRITICAL_VITEST` 里的 brand-home 测试和 `pnpm build`。
7. 升级 `three` 时：`NeutralToneMapping`（r162 起）与 `three/examples/jsm/environments/RoomEnvironment.js` 路径仍可用；按「浑天仪 · 资源释放」一节复测上下文释放。
