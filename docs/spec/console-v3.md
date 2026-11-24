# 用户后台 v3「星链」

设计源：Figma 文件「211API」页面「211API · Console v3」（C0 规则与组件，C1–C12 桌面浅 / 深，C13–C14 手机 390，C15 平板 1024）；设计语言见设计仓库 `DESIGN.md`「Console（用户后台 v3）」。本文件记录代码里怎么落地，以及之后每一页照什么规则改。

## 做法

- **保留结构，按稿换样式。** 沿用现有组件、数据和交互，只改布局、颜色、字体、卡片层级；和稿子差异大的块（仪表盘夜空数据卡、模型分布）才重写。目的是少和上游 Sub2API 冲突。
- **分批交付，一批一个 PR。** 第一批：设计 token + 外壳（侧栏 / 图标栏 / 抽屉 / 顶栏）+ 仪表盘。之后每个 PR 一到两页，先在本地开发环境给人看过再提。
- **外壳用户和管理员共用。** 管理员页面不按稿重画，内容区只跟着换颜色和字体。

## 设计 token（第一批，全站生效）

全部在 `frontend/tailwind.config.js` 和 `frontend/src/style.css`，改的是已有调色板的取值，类名不变，所以所有页面（含管理员、登录、公开页）一起换色。

| 调色板 | 取值 | 说明 |
|---|---|---|
| `primary-*` | 50 `#f2f6fd` … 100 tint `#e8f0fc`、300 sky `#bfd6f6`、400 夜空蓝 `#7aa2ff`、600 blue `#2f5fd0`、800 navy `#14306b`、950 `#091430` | 原青色主色换成学院深蓝。主按钮用 800，深色模式强调用 400 |
| `gray-50…400` | CSS 变量 `--c-gray-*`：浅色 canvas `#f7f5f0`、band `#efeae1`、line `#e3dccd`、按钮描边 `#d9d1c1`；深色换成冷色月白（ink `#e9eef8` … mist `#7f8ca5`） | 浅色当底色 / 描边，深色当文字，所以按主题切换 |
| `gray-500…950` | mist `#66738c`、slate `#45536e` … ink `#0c1830` | 两套主题相同 |
| `dark-*` | 950 canvas `#070e1d`、900 band `#0b1427`、800 surface `#0e1830`、700 line `#1f2d48`、600 `#2b3a58`、400 mist、300 slate、100 ink | 深色模式夜空色系 |
| `star-*` | gold `#d4a84b` / `#e3b95e`、bronze `#8a6420` / `#ecc978`、ok `#137a52` / `#3dd68c` | 金色只给被追踪的调用，古铜只给金额，绿只表示状态 |
| `font-sans` | `Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif` | 与品牌首页同一套 |
| `font-mono` | `Brand Geist Mono`（`style.css` 的 `@font-face`，与首页共用 `features/brand-home/assets/fonts/` 的子集） | 可核对的数字一律等宽 |
| `shadow-card / float / pop` | CSS 变量 `--c-shadow-*`：card `0 8 24 -12`、float `0 18 40 -14`、pop `0 12 32 -6`，深色换黑色 | Figma C0 |

`style.css` 里的组件类按 v3 改：按钮、输入框为胶囊形（多行输入圆角 16），主按钮浅色深蓝、深色月白；卡片白底（深色 `#0e1830`）+ 1px line + 圆角 16；表头 `--c-thead`（`#faf8f3` / `#121d38`）、行线 `--c-row-line`（`#f0ebe0` / `#18243f`）；徽章 success 用信号绿、warning 用古铜描边；分段控件 `.tabs` / `.tab` 是 band 底胶囊；`.page-title` 26/34（手机 22/30）。

## 外壳

宽度三档由 `composables/useConsoleViewport.ts` 判断（与 Tailwind `md` 768、`xl` 1280 对齐）：

| 档位 | 侧栏 | 顶栏 | 内容区边距 |
|---|---|---|---|
| 桌面 ≥ 1280 | 248px 夜空侧栏，可收成 72px 图标栏（`appStore.sidebarCollapsed`） | 64px 暖纸底 + 底线 | 28 40 56 |
| 平板 768–1279 | 固定 72px 图标栏；底部「展开」以浮层打开整栏（复用 `appStore.mobileOpen`） | 同上，左右 32 | 24 32 48 |
| 手机 < 768 | 304px 抽屉（`mobileOpen`），带遮罩和关闭按钮 | 52px 夜空顶栏：菜单、星狐横版、余额、头像 | 20 16 36 |

- **侧栏**（`AppSidebar.vue`）：夜空渐变 `#050b18 → #091430 → #13244b` + 种子星空（`components/layout/assets/*-stars.svg`，与 Figma 同一种子）；顶部星狐 + 白色站点名（后台上传了标志则垫白底）；用户菜单按 概览 / 调用 / 账户 / 设置 分组（`NavItem.group`），图标栏里组之间用短横线；当前项月白 8% 底 + 左侧 3px 月白竖条、蓝色外发光，不用金色；底部像素「学院一角」（`assets/sidebar-vignette.png`，从 Figma 节点导出 @2x）和收起按钮。管理员菜单不分组，样式相同。
- **顶栏**（`AppHeader.vue`）：左侧页面标题；右侧公告、文档、模型广场、语言、主题切换（从侧栏移来，仍读写 `localStorage.theme`）、订阅进度、余额胶囊（余额 + 等宽金额 + 「充值」，支付开启且非简易模式才有）、账户菜单。顶栏样式写在非 scoped 的 `<style>` 里，类名带 `console-` 前缀（scoped 里的 `:global(.dark) x` 会被编译成光秃的 `.dark {}`）。
- Figma 顶栏的「搜索请求 ID、密钥或模型」是新功能，没有后端支持，未做；位置先给页面标题。

## 仪表盘（第一批）

- 页头：问候语（按本地时间早 / 下午 / 晚）+ 今日调用次数和花费 + 「兑换码」「创建 API 密钥」。
- 夜空数据卡 `UserDashboardOverview.vue`：账户余额（累计 / 今日消费、密钥数、充值和兑换码）｜配额用量（第一个配置了限额的平台；多个平台时可切换；≥ 90% 和禁用用古铜）｜最近一次调用（月亮里是淡色星狐剪影 → 金线 → 金点 → 金色描边的模型牌，下面是状态、请求 ID、tokens、首字、费用）。没有限额时中栏显示 API 密钥概况；没有调用时右栏显示提示，不出现金色。
- 指标卡四块：今日请求、今日消费（标准价、省多少）、今日 Token、平均响应（RPM / TPM）。按平台拆分保留，改成一张卡里竖线分栏。
- 趋势图沿用 `TokenUsageTrend`（新增可选 `#actions` 插槽放时间范围、粒度、刷新），线色换成深蓝 / 星光蓝 / 天蓝；Figma 是堆叠柱，暂未改图表类型（管理员页也用这个组件）。
- 模型分布改成按费用的条形列表：前 4 个模型 + 「其他 N 个模型」。
- 最近使用改成表格（时间、模型、密钥、输入 / 输出、耗时、费用、状态），手机改列表行；快捷操作改成细线分隔的列表。
- 金额沿用产品实际的美元，Figma 里的 ¥ 和数值只是示意。

## 之后每一页的改法

1. 先看 Figma 对应页（桌面浅 / 深、手机、平板），列出和现状不同的块。
2. 只动模板里的布局和类名：卡片里不再放带描边或底色的卡片（改用细线、留白、条带底色）；数字换 `font-mono`；金额 `text-star-bronze dark:text-star-bronze-night`；状态用 `badge-success`；提醒用 `badge-warning`，不引入红色（真实错误除外）。
3. 页面标题用 `.page-title` / `.page-description`；每页至多一块夜空数据卡（单层 `#0e1830`、圆角 20、`shadow-float`，深色补 1px `#1f2d48` 描边）。
4. 本地开发环境截图核对 1440 / 1024 / 390 和深色，再提 PR。

## 本地查看

mock 后端需要响应 `/api/v1/settings/public`、`/api/v1/auth/me`、`/api/v1/usage/dashboard/{stats,trend,models}`、`/api/v1/usage`、`/api/v1/user/platform-quotas`；启动 `VITE_DEV_PROXY_TARGET=http://127.0.0.1:<mock 端口> pnpm --dir frontend exec vite --port <端口>`，在 `/login` 页往 `localStorage` 写 `auth_token`、`auth_user`、`token_expires_at` 后打开 `/dashboard`。

## 上游同步检查

- `tailwind.config.js` 的 `primary` / `gray` / `dark` / `star` / `fontFamily` / `boxShadow.card|float|pop` 取值，`style.css` 的 `--c-*` 变量和组件类，上游改动时以本文件为准合并。
- `AppSidebar.vue`、`AppHeader.vue`、`AppLayout.vue` 已按 v3 重写模板；上游新增菜单项时补 `group`，新增顶栏入口放进右侧按钮组。
- 用户仪表盘的五个组件和 `DashboardView.vue` 已重写；上游改仪表盘数据时只合并数据部分。
