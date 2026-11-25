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
| 桌面 ≥ 1280 | 夜空侧栏，宽度按内容自适应（200–288px，Figma 为 248），可收成 72px 图标栏（`appStore.sidebarCollapsed`） | 64px 暖纸底 + 底线 | 28 40 56 |
| 平板 768–1279 | 固定 72px 图标栏；底部「展开」以浮层打开整栏（复用 `appStore.mobileOpen`） | 同上，左右 32 | 24 32 48 |
| 手机 < 768 | 304px 抽屉（`mobileOpen`），带遮罩和关闭按钮 | 52px 夜空顶栏：菜单、星狐横版、余额、头像 | 20 16 36 |

- **侧栏**（`AppSidebar.vue`）：夜空渐变 `#050b18 → #091430 → #13244b` + 种子星空（`components/layout/assets/*-stars.svg`，与 Figma 同一种子）；顶部星狐 + 白色站点名（后台上传了标志则垫白底）；用户菜单按 概览 / 调用 / 账户 / 设置 分组（`NavItem.group`），图标栏里组之间用短横线；当前项月白 8% 底 + 左侧 3px 月白竖条、蓝色外发光，不用金色；底部像素「学院一角」（`assets/sidebar-vignette.png`，从 Figma 节点导出 @2x）和收起按钮。管理员菜单不分组，样式相同。
- **顶栏**（`AppHeader.vue`）：左侧页面标题（路由 `meta.pageHeading: true` 的页面自带 h1 页头，顶栏不再重复标题和描述；目前是 `/keys`、`/usage`、`/purchase`、`/subscriptions`、`/orders`、`/redeem`，仪表盘不受影响）；右侧公告、文档、模型广场、语言、主题切换（从侧栏移来，仍读写 `localStorage.theme`）、订阅进度、余额胶囊（余额 + 等宽金额 + 「充值」）、账户菜单。手机夜空顶栏也保留公告铃铛：后端默认公告是 `silent`，不自动弹出，铃铛是唯一入口。
- **余额旁的购买入口**统一用 `utils/siteBillingMode.ts` 的 `resolveBalancePurchaseAction`：支付关闭或简易模式不给；关了余额充值（`payment_balance_disabled`，仅订阅站点）时 `/purchase` 没有充值标签，顶栏不显示「充值」，仪表盘余额卡改成「订阅」；订阅也关了就都不给。
- **侧栏宽度**：展开态 `.sidebar--full` 为 `width: max-content`，`min-width: 200px`、`max-width: 288px`，取最长菜单项 / 品牌区（Logo + 站点名 + 版本号）/ 底栏所需，中英文、管理员 / 用户菜单各自贴合；收起的分组子菜单仍留在 DOM（折叠 + `inert`），所以宽度按全部菜单算，展开分组不跳宽。像素插画 `width: 0; min-width: 100%` 不参与宽度。`.sidebar--rail` 72、`.sidebar--overlay` `min(304px, 86vw)` 不变。
- **主内容区左边距**跟随侧栏实测宽度：`AppSidebar` 用 `ResizeObserver` 写 `consoleSidebarWidth`（`useConsoleViewport.ts`），`AppLayout` 经 `resolveConsoleMainOffset` 取值（桌面 = 实测宽，收起 / 展开动画逐帧跟随；平板 72；手机 0；未量到回退 248 / 72），不再写死 248。
- **侧栏分组**的点击和子菜单渲染都按当前视口的 `isRail` 判断，不看 `sidebarCollapsed`：桌面收起后切到平板再打开浮层，分组必须能展开。顶栏样式写在非 scoped 的 `<style>` 里，类名带 `console-` 前缀（scoped 里的 `:global(.dark) x` 会被编译成光秃的 `.dark {}`）。
- Figma 顶栏的「搜索请求 ID、密钥或模型」是新功能，没有后端支持，未做；位置先给页面标题。

## 仪表盘（第一批）

- 页头：问候语（按本地时间早 / 下午 / 晚）+ 今日调用次数和花费 + 「兑换码」「创建 API 密钥」。
- 夜空数据卡 `UserDashboardOverview.vue`：账户余额（累计 / 今日消费、密钥数、充值和兑换码）｜配额用量（第一个配置了限额的平台；多个平台时可切换；≥ 90% 和禁用用古铜）｜最近一次调用（月亮里是淡色星狐剪影 → 金线 → 金点 → 金色描边的模型牌，下面是状态、请求 ID、tokens、首字、费用）。没有限额时中栏显示 API 密钥概况；没有调用时右栏显示提示，不出现金色。
- 指标卡四块：今日请求、今日消费（标准价、省多少）、今日 Token、平均响应（RPM / TPM）。按平台拆分保留，改成一张卡里竖线分栏。
- 趋势图沿用 `TokenUsageTrend`（新增可选 `#actions` 插槽放时间范围、粒度、刷新），线色换成深蓝 / 星光蓝 / 天蓝；Figma 是堆叠柱，暂未改图表类型（管理员页也用这个组件）。
- 模型分布改成按费用的条形列表：前 4 个模型 + 「其他 N 个模型」。
- 「最近一次调用」单独请求 `/usage?page=1&page_size=1&sort_by=created_at&sort_order=desc`，不带趋势图日期，区分加载中、读取失败、确实没有调用三种状态。
- 用量记录没有 HTTP 状态码，**不显示 `200 OK`**；只有 `request_type === 'cyber'`（安全策略拦截，网关也会写用量）标「安全策略拦截」古铜徽章（`components/user/dashboard/usageStatus.ts`）。之后的用量页同样照此处理。
- 最近使用改成表格（时间、模型、密钥、输入 / 输出、耗时、费用），手机改列表行；快捷操作改成细线分隔的列表。
- 金额沿用产品实际的美元，Figma 里的 ¥ 和数值只是示意。

## 之后每一页的改法

1. 先看 Figma 对应页（桌面浅 / 深、手机、平板），列出和现状不同的块。
2. 只动模板里的布局和类名：卡片里不再放带描边或底色的卡片（改用细线、留白、条带底色）；数字换 `font-mono`；金额 `text-star-bronze dark:text-star-bronze-night`；状态用 `badge-success`；提醒用 `badge-warning`，不引入红色（真实错误除外）。
3. 页面标题用 `.page-title` / `.page-description`；每页至多一块夜空数据卡（单层 `#0e1830`、圆角 20、`shadow-float`，深色补 1px `#1f2d48` 描边）。
4. 本地开发环境截图核对 1440 / 1024 / 390 和深色，再提 PR。

## 充值 / 订阅与我的订阅（第 2 批）

设计源：C4（`/purchase`，节点 99:15890 浅 / 99:18846 深）、C5（`/subscriptions`，99:27306 / 99:27790）、C13 手机「充值」（99:34483）、C14 手机「我的订阅」（99:38258）。Figma REST 因 starter 计划被限流（约 3.6 天），改用 Desktop Bridge 导出参考截图。支付逻辑（下单、跳转、回调、恢复）一行未改，只改展示；金额沿用美元 / 支付币种。

- **路由**：`/purchase`、`/subscriptions` 加 `meta.pageHeading`，顶栏不再重复标题；页头自带 `h1.page-title`。样式在 `styles/console-purchase-pages.css`，限定 `.console-purchase` / `.console-subscriptions`。
- **充值页**：「余额充值 / 订阅套餐」用全站 `.tabs`；充值页左侧金额卡（5 档 + 自定义输入卡，3 列，手机 2 列）和支付方式单选卡，右侧单层夜空「订单摘要」（桌面 sticky，<1280 落到内容下方）；摘要含账户、当前余额、支付金额、折扣 / 手续费 / 赠金 / 到账（原有 `data-testid` 保留）、支付方式、「充值后余额」大号等宽数字和「确认支付」按钮。优惠档位标签改为古铜描边小标签，不用红色。
- **共享组件**：`AmountInput`、`PaymentMethodSelector`、`SubscriptionPlanCard` 新增默认关闭的 `console` 参数，旧样式和管理端（含 `RechargeBonusTierEditor`）不变。
- **最近订单**：`/payment/orders/my?page=1&page_size=5` 只读展示（订单号、类型、金额、支付方式、状态、时间，行高 56px，金额古铜，状态徽章），「我的订单 →」「查看全部 →」跳 `/orders`；无订单或请求失败时整块隐藏，不影响下单。手机隐藏类型 / 支付方式两列。
- **我的订阅**：页头 +「购买订阅」；两列卡片（<400px 容器 1 列）。每卡：名称 + 状态徽章 + 「剩余 N 天 / 长期有效 / 已结束」，平台 chip + 倍率 + 到期日，按周期的进度条行（已用 / 限额 + 重置时间；未开始计时写「等待首次使用」），无限额写「该订阅无用量限制」，不画空条、不显示 $0.00；≥ 90% 条和数字用古铜；已过期卡片降低透明度，按钮为「重新购买」。「续费」「重新购买」跳 `/purchase?tab=subscription&group=<id>`（原行为），「查看用量」跳 `/usage`。进度条不再用红 / 橙 / 绿。

- **币种规则（主人 2026-11-25 确认）**：生产支付用人民币，余额与用量用美元。充值页金额卡、支付金额、手续费、实付、最近订单金额按支付渠道币种显示（生产为 `¥`，取 `checkout-info.methods.*.currency`，订单取 `order.currency`）；「到账 $」、当前余额、充值后余额、赠金、订阅限额与用量一律用美元。两者换算以后端返回为准（`balance_recharge_multiplier`、`recharge_bonus_*` 的报价、订阅的 `subscription_usd_to_cny_rate`），前端不自定汇率；同一行不要把 ¥ 和 $ 混成一个数。
- **最近订单（手机）**：<768 用 `ConsoleRecordList`（与 #104 同一做法），每行原生 `details`：摘要是完整订单号（等宽、按字符折行，不截断）+ 古铜金额、时间 + 状态徽章；展开后是带标签的字段（订单号 + 「复制」按钮、类型、支付方式），不再渲染 4 列表格。桌面表格订单号也不再截断。
- **当前订阅小列表**（订阅套餐标签页底部）：去掉平台色左条，平台 chip 改成中性淡蓝底；绿色只留给「有效」状态徽章。

### 与稿子的已知差异（第 2 批）

- 优惠码输入、「使用」按钮：后端没有优惠码接口，未做。
- 支付方式卡片第二行「人民币 / Stripe · 支持外币卡」：接口只给渠道名与手续费，未做；有手续费时显示「手续费 N%」。
- 手机端稿子是底部固定「应付 + 去支付」栏；实现为订单摘要卡落在内容之后（不做固定栏，避免遮挡内容和支付弹窗），按钮文案保持「确认支付 + 金额」。
- 稿子的「继续支付」订单操作未做（继续支付流程不改）；订单行只展示，不带操作列。
- 金额卡为 50 / 100 / 200 / 500 / 1000 + 自定义（原来有 10–5000 九档，更大金额走自定义输入）。
- 稿子没有「订阅套餐」选择页、订阅确认页、支付中面板的设计：保留原结构，只让套餐卡走 `console` 变体（统一深蓝按钮、中性边框、无平台色）；当前订阅小列表、确认卡仍沿用原样式，仅继承全站 v3 token。
- 稿子里「我的订阅」平台 chip 为蓝底；平台为空 / `default` 显示「默认」。
- 稿子的顶栏搜索框、余额旁按钮等外壳项沿用第 1 批实现。

## 我的订单与兑换码（第 3 批）

设计源：C6（`/orders`，节点 99:24318 浅 / 99:24877 深）、C7（`/redeem`，99:25436 / 99:25897）、C14 手机「我的订单」（99:38430）、「兑换码」（99:38591）。Figma REST 仍被 starter 计划限流，经 Desktop Bridge 读节点结构并导出参考截图。取消订单、申请退款、兑换提交及其后的刷新逻辑未改，只改展示。

- **路由**：`/orders`、`/redeem` 加 `meta.pageHeading`，页头自带 `h1.page-title`，顶栏不重复标题。样式都在 `styles/console-purchase-pages.css`（订单页根节点同时带 `.console-data-page`，复用第 1 批的筛选条、手机记录列表、`console-table-foot`）。
- **订单状态徽章**：用户侧统一用 `components/payment/consoleOrderStatus.ts`（`/orders` 和充值页「最近订单」共用；管理端仍用 `orderUtils.statusBadgeClass`）。已完成 = 信号绿 + 圆点（唯一的绿色）；待支付 = 古铜描边；已支付 / 充值中 / 退款处理中 = 淡蓝；已取消 / 已过期 = 中性描边；已退款 / 部分退款 = band 底；失败 / 退款失败保留红色（真实错误）。之前 `badge-info` / `badge-secondary` 在全站没有定义，导致这些状态是无色徽章，现已不用；「我的订阅」已过期 / 已撤销徽章同理改为 `badge-gray`。
- **我的订单**：页头 +「去充值」（原「返回充值」按钮，仍跳 `/purchase`）。筛选一行：状态分段（全部 / 待支付 / 已完成 / 失败 / 已退款，值与原下拉相同）+「全部类型」胶囊（`order_type`，后端已支持）+ 右侧刷新；手机整条横滑、边缘渐隐，刷新固定在同一行。表格一张卡片：订单号（完整、等宽 + 复制图标按钮）、类型、到账金额（美元、古铜；有赠送时第二行「含赠送 $x」）、实付（订单币种、墨色；有手续费时第二行「手续费 N%」）、支付方式、状态、创建时间、操作（待支付「取消订单」、可退款「申请退款」，其余「—」）；行高 60，表头中文不转大写；分页在卡片底部 `console-table-foot`。加载中 / 无订单 / 筛选无结果 / 读取失败（带「刷新」重试）各有状态行，不显示空表头。
- **订单（手机）**：`ConsoleRecordList`，摘要为类型 + 状态徽章、完整订单号 + 实付（古铜）、时间 · 支付方式；展开后是字段列表（订单号 + 复制、到账金额 / 赠送、实付 / 手续费、支付方式）和文字按钮（取消订单 / 申请退款）。1024 下单元格左右 8px，整表不横滚。
- **兑换码**：两列（左 1fr，右 360；<1280 右 300；<1024 单列，顺序为兑换 → 余额 → 最近活动 → 说明）。「输入兑换码」卡：48px 胶囊输入（礼物图标、等宽字体）+ 48px「兑换」按钮（手机满宽），说明文字，结果直接放卡片里：成功为绿色淡底 `role="status"`（标题 + 后端消息 + 「已添加 / 新余额 / 新并发」一行，金额美元）；失败为古铜描边 `role="alert"`，不用红色。右侧单层夜空「当前余额」卡：$ + 36px 等宽余额，账户刷新成功后才在旁边标「+$x」，下方并发数。「最近活动」卡：32px 淡蓝图标块 + 标题 + 副标题（兑换码完整显示，过长省略并带 `title`；返利转入显示「邀请返利」；管理员调整显示「管理员调整 · 备注」）、右侧数值（余额入账古铜，扣除写 `-$x` 墨色）+ 时间；原分页（总数、每页 20 / 50 / 100、上一页 / 下一页）原样放卡片底部。补上了用户侧 `affiliate_balance` 记录的标题（原来显示「未知」）。
- **兑换失败原因**：`apiClient` 把后端错误归一化为 `{ status, code, reason, message }`，页面用 `extractApiErrorCode` 取 `reason`，按 `redeem.errors.<CODE>` 显示中文 / 英文原因；码表以 `backend/internal/service/redeem_service.go` 为准：`REDEEM_CODE_NOT_FOUND`（不存在）、`REDEEM_CODE_USED`（已使用）、`REDEEM_CODE_EXPIRED`（已过期）、`REDEEM_CODE_LOCKED`（处理中）、`REDEEM_RATE_LIMITED`（失败次数过多）、`REDEEM_CODE_INVALID`（配置有误）、`REDEEM_CODE_UNSUPPORTED_TYPE`（邀请码只能注册时用）。其他码、无码（请求校验 400、500）、网络错误一律回退「兑换失败，请检查兑换码后重试」，不显示后端英文 message。原来读的 `response.data.detail` 在 `apiClient` 之后永远为空，已不用。兑换提交、刷新余额 / 订阅 / 记录的流程不变。
- **兑换成功提示**：后端 `POST /redeem` 实际返回兑换码记录（`type`、`value`、`validity_days`、`group`），没有 `message` / `new_balance`；`RedeemResult` 把这些字段标为可选。提示只显示标题 +「已添加 …」一行；若后端（旧版）带了 `message` 且与标题相同（忽略空白和标点），不再重复显示。订阅的分组名取 `group_name`，没有时取 `group.name`。

### 与稿子的已知差异（第 3 批）

- 订单：时间范围（近 30 天）和「搜索订单号」后端不支持，未做；「继续支付」「详情 →」没有对应用户接口 / 页面，未做（操作列只保留取消、申请退款）。稿子状态分段是「全部 / 待支付 / 已完成 / 退款」，实现沿用原有五个筛选值。
- 订单：稿子的订阅订单第二行「Claude 专线 · 月卡」需要套餐名，订单接口只有 `plan_id`，未显示。原表格里的内部「订单 ID」列不再显示（订单号是对外标识）。底部「待支付订单 30 分钟后自动关闭」没有可读的配置，未显示。手机底部「加载更多」改为与其他页一致的分页。
- 订单：稿子里到账、实付都写 ¥；按币种规则，到账是余额（美元），实付按订单币种。
- 兑换码：稿子余额卡的「RPM 限制」未做（用户级 `rpm_limit` 会被分组覆盖，单独显示会误导）；「最近活动」右上「近 30 天」后端不支持，未显示。手机稿活动行副标题是时间，实现与桌面一致（兑换码 / 来源 + 右侧时间）。

## 本地查看

### API 密钥与使用记录：设计核对（2026-11-24）

实现起点为 `7799c09dab5aedc618f26bf4d8ff57bffb6734d2`。设计仓库只读核对的最新 `origin/main` 为 `8858ee76cd3c2f84c462b7460d23101ba75d0884`；Figma 使用 connector 读取节点，并经 Desktop Bridge 导出参考截图。

| 页面 | 桌面浅 / 深 | 手机浅 / 深 |
|---|---|---|
| API 密钥 `/keys` | [C2 Light](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-14261) / [C2 Dark](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-17217) | [C13 Light](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-34003) / [C13 Dark](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-35611) |
| 使用记录 `/usage` | [C3 Light](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-15061) / [C3 Dark](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-18017) | [C13 Light](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-34237) / [C13 Dark](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-35845) |

共用参考：[C0 组件与规则](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=100-50061)、[C15 平板浅](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-36200) / [深](https://www.figma.com/design/5ZuuXYB3ZCw4RFHh8sYFTj/?node-id=99-36669)。C14 是其余页面，当前两页的手机稿都在 C13；C15 只有仪表盘，沿用其 72px 图标栏及 32px 页边距。

- 两页均沿用已有 `font-sans`、`font-mono`，标题 `.page-title`，暖纸 / 夜空主题、表头和行线变量、16px 表格圆角、胶囊控件；页内主要区块间距 20px，夜空额度卡圆角 20px，手机双列。
- 密钥：增加页头和单层夜空额度概览；端点、筛选、表格、分页及原有创建 / 编辑 / 状态 / 复制 / 批量操作保持接口与规则不变。
- 使用记录：页头、四项统计合为单层分隔条，筛选和记录前置；既有图表保留在记录后的可展开区。金额为美元，不添加成功状态码。
- 响应式沿用外壳三档。新增用户专用 `ConsoleRecordList.vue`：手机用原生 `details/summary` 分隔列表，摘要显示名称、状态、金额等主要数据，展开后由页面的 `#detail` 插槽直接渲染带标签字段（`dl`）和文字按钮，**不再每行渲染一张 DataTable**；`selectable` 时每行左侧有复选框，顶部「全选本页」，与桌面表格共用 `selectedIds`，批量编辑在手机可用。桌面保留原语义表格。命名区域可聚焦，左右方向键转交现有表格滚动容器；内容宽度不足时仅表格或手机筛选条局部横滚。
- 记录卡片：`.console-records` 是唯一卡片（白底 / `#0e1830`、1px line、圆角 16），分页放在卡片底部 `.console-table-foot`（上边框 1px、padding 12px 20px，Figma Table foot），桌面和手机都不再是卡片外的单独白带；密钥页 `TablePageLayout` 的卡片外壳在 `.console-keys` 下去掉。
- 表头一律不转大写（`text-transform: none`），列名用中文：使用记录 Token 列叫「输入 / 输出」，延迟列叫「首字 / 耗时」。
- 视觉覆盖集中在 `styles/console-data-pages.css`，必须以 `.console-data-page` 限定；不修改管理员共用表格和统计组件。统计 / 额度卡按容器宽度切双列，触摸设备表格操作至少 44px；不在 `html/body` 隐藏横向溢出。

### 本批能力与设计差异

- 密钥概览明确为「当前页」中设置了额度的密钥，按累计 `quota_used / quota` 排名前四；接口分页且额度不按月重置，不能标为全账户或「本月」。没有设置额度的密钥不进入此卡，空列表时不显示卡片。
- Figma 的每密钥 RPM、邮件告警阈值没有相应用户密钥接口；保留产品现有的 5h / 1d / 7d 美金额度窗口、并发数和到期规则，不用它们冒充 RPM。限流窗口、最近使用、IP、ID 仍由原列设置开启；不迁移或覆盖已有列偏好。
- 用量列：设了额度显示 40px 额度条 + 金额（≥ 90% 古铜），未设额度显示「不限额」，不画空进度条、不写 $0.00；第二行直接显示今日 / 近 30 天实际花费（不放折叠区，加载中是骨架）。手机摘要同样处理。用量格是普通 `div`，不再用 `summary` 包块级内容。
- 操作列：「使用」带文字，编辑保留图标，导入 CC Switch、启用 / 禁用、删除收进 `ConsoleRowMenu.vue`「更多」菜单（`role="menu"`，挂到 body 避免被表格滚动容器裁剪，方向键 / Home / End / Esc，点选后关闭）；每个操作保留 `aria-label`，站点隐藏 CCS 时菜单里也不出现。手机展开后全部操作都是文字按钮。
- 1440 下整表不横滚：单元格左右 8px，用量格固定 188px，过期 / 创建时间两行日期 72px，名称最长 120px 截断（`title` 显示全名），状态徽章 `nowrap`。1024 以下表格在卡片内横滚，操作列按 DataTable 既有规则固定在右侧并带阴影。
- 端点条改为用户专用 `ConsoleEndpointBar.vue`：图标 + 「API 端点」+ 说明文字，右侧地址胶囊（地址、「默认」、带文字的「测速」「复制」），自定义端点逐行列出；复制 / 测速行为与上游 `EndpointPopover` 相同，后者保留不改以便同步上游。
- 使用记录默认时间前置，并展示已有 `request_id` 字段与复制；端点、IP、分组、计费模式默认折叠到列设置，推理强度继续默认展示。既有列偏好原样读取；全部筛选、导出字段与请求逻辑保留。
- 筛选是一行 36px 胶囊：时间范围、密钥、模型、分组、类型（错误请求 tab 换成密钥 / 模型 / 分类 / 状态码），「更多筛选」按钮（带已生效数量）展开压缩 / 计费类型 / 计费模式；刷新、重置、列设置在同一行右侧，宽度不够时整组换到下一行。手机筛选条不折行、局部横滑，按滚动位置给左右边缘加 48px 渐隐（`console-filter-scroll--more-left/right`）提示还有内容。Figma 的请求 ID 搜索没有后端支持，未做。
- 表格行单行约 56px：`UsageTable` 新增可选 `compact`（默认关，管理端不变），Token 显示「输入 / 输出」一行，缓存与图片 Token 在原浮层；延迟显示「首字 / 总耗时」一行、中性色，输出 TPS 和缓存率放 `title` 和读屏文本，不再用绿色和健康色条表示数值（绿只表示状态）；费用为古铜。用户页同时传 `flat`，表格不再自带卡片。
- 「用量分析与趋势」默认折叠：折叠时筛选变化只标记过期，不请求 `/usage/dashboard/snapshot-v2`；展开时才请求并挂载图表（`v-if`），Chart.js 按真实容器尺寸绘制。模型统计仍随筛选加载（模型筛选项来自它）。
- 用量接口不提供成功 HTTP 状态或鉴权 / 路由耗时，因此不显示 `200 OK`，不制作示意调用链，不增加无接口支持的请求 ID 查询；真实错误仍走原「错误请求」标签。手机请求类型复用 `resolveUsageRequestType`，保持 WS / Live / 安全策略语义，不能由 `stream` 布尔值覆盖显式类型。
- 1024 下使用记录表在卡片内横滚；手机展开记录用金色左线标记，展开内容是请求 ID（可复制）、推理强度、输入 / 输出、缓存、费用 / 标准价、首字 / 耗时、输出 TPS、缓存率、端点、计费方式；金额使用古铜，币种始终为美元。模型、分组、端点分布和用量趋势继续可用，放入列表后的「用量分析与趋势」。

### 本批本地验证

- 使用正常前端 `pnpm dev --host 127.0.0.1 --port <空闲端口> --strictPort`，`VITE_DEV_PROXY_TARGET` 指向仅监听回环地址的独立合成数据服务；两页真实路由是 `/keys`、`/usage`。mock、启动脚本、日志、Playwright 取证脚本和 PNG 均放工作区外，不进入 PR，不读取生产数据或真实凭据。
- Jev 验证密钥创建、编辑、禁用和复制反馈，并用独立 mock API 回读写后字段；使用记录筛选经可见文字和请求日志核对列表 / 统计 / 图表同一密钥条件。Playwright 仅补充确定性视口、截图、尺寸、手机展开 / 批量选择和表格键盘滚动取证。
- 两页各有 1440 浅、1440 深、1024 浅、390 浅 PNG。390 下根节点 `clientWidth = scrollWidth = 390`，内容 `clientWidth = scrollWidth = 358`；密钥展开和两行选择、使用记录展开及高级筛选同样通过。手机筛选条有意局部横滚，不属于页面溢出。注意：手机下 `.console-filter-bar` 必须 `flex-wrap: nowrap`，多行纵向 flex 会按最宽子项拉伸，横滑条会撑破页面。
- 全页截图里侧栏在约 1 个视口高度处截止是截图伪影：侧栏 `position: fixed`、高度等于视口，真实浏览器滚到底部时仍覆盖整个视口。
- 使用项目命令 `pnpm --dir frontend test:run`、`typecheck`、`lint:check`、`build`；回归测试覆盖：手机请求类型不误标流式 / 成功；图表折叠时不请求快照、展开后用最新筛选加载；使用记录紧凑行 / 中文列名 / 分页在卡片内 / 一行筛选；手机字段直接渲染且无表格；密钥不限额、花费直接可见、用量格无 details、「更多」菜单项与 CCS 开关、端点条、手机批量选择；`UsageTable` 紧凑模式与管理端默认布局；`ConsoleRowMenu` 键盘操作；顶栏 `pageHeading`。详细命令结果、8 张 PNG 路径、预览端口及服务重启方式在本批工作区外交付报告中。
- mock 覆盖的是前端路由、API 参数和展示 / 交互；不代表真实鉴权、网关调用或计费验收。日期跨日边界、错误详情、删除、批量提交、真实 CCS 外部唤起、IP 地理批查和生产端点测速未做浏览器验收。


mock 后端需要响应 `/api/v1/settings/public`、`/api/v1/auth/me`、`/api/v1/usage/dashboard/{stats,trend,models}`、`/api/v1/usage`、`/api/v1/user/platform-quotas`；启动 `VITE_DEV_PROXY_TARGET=http://127.0.0.1:<mock 端口> pnpm --dir frontend exec vite --port <端口>`，在 `/login` 页往 `localStorage` 写 `auth_token`、`auth_user`、`token_expires_at` 后打开 `/dashboard`。

## 上游同步检查

- `tailwind.config.js` 的 `primary` / `gray` / `dark` / `star` / `fontFamily` / `boxShadow.card|float|pop` 取值，`style.css` 的 `--c-*` 变量和组件类，上游改动时以本文件为准合并。
- `AppSidebar.vue`、`AppHeader.vue`、`AppLayout.vue` 已按 v3 重写模板；上游新增菜单项时补 `group`，新增顶栏入口放进右侧按钮组。
- 用户仪表盘的五个组件和 `DashboardView.vue` 已重写；上游改仪表盘数据时只合并数据部分。
