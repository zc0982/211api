---
name: 211API
description: 学院深蓝 + 帽穗金的设计语言（v3 · 星链）：星狐 Logo、夜空像素首屏、暖纸色内容区、像素工地页脚、夜空侧栏的用户后台，金色只标记被追踪的那一次调用
colors:
  navy: "#14306b"
  blue: "#2f5fd0"
  gold: "#d4a84b"
  bronze: "#8a6420"
  ink: "#0c1830"
  slate: "#45536e"
  mist: "#66738c"
  ok: "#137a52"
  line: "#e3dccd"
  surface: "#ffffff"
  canvas: "#f7f5f0"
  band: "#efeae1"
  night: "#050b18"
  tint: "#e8f0fc"
  sky: "#bfd6f6"
typography:
  display:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "clamp(32px, min(3.9vw, 6.2svh), 56px)"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.667
  body:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.333
  mono:
    fontFamily: "Geist Mono, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  wordmark:
    fontFamily: "Plus Jakarta Sans（只用 Logo 里的转曲路径，不用文字重排）"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0em"
rounded:
  tile: "8px"
  card: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-glass:
    backgroundColor: "rgba(255, 255, 255, 0.6)"
    textColor: "{colors.navy}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-glass-hover:
    backgroundColor: "rgba(255, 255, 255, 0.85)"
    textColor: "{colors.navy}"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.slate}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "36px"
  chip-filter-active:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "36px"
  status-badge:
    backgroundColor: "rgba(19, 122, 82, 0.1)"
    textColor: "{colors.ok}"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card-glass:
    backgroundColor: "rgba(255, 255, 255, 0.62)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
---

<!--
  副本，以设计源为准。
  来源：/Users/luoee/Design/211API-UI/DESIGN.md（211API-UI 设计仓库，commit 8858ee7，v3「星链」，含 PR #5 的星狐 Logo、用户后台 v3 与无衬线字体）
  复制日期：2026-11-24
  设计源更新后重新复制，不要直接修改本文件。
-->

# Design System: 211API

## Overview

**Creative North Star: "学院天文台（The Academy Observatory）"**，v3 版本名「星链」。

211API 的视觉世界是一座夜里的学院。首屏是夜空：月亮是所有调用的源头，月面上印着一只淡淡的星狐剪影；连线落到地平线上的生态工具工位，像素学子在工位之间走动干活；帽穗金是被观测到的那一颗星，也就是「被追踪的那一次调用」。页面中段是暖纸色的书页，安静地讲清楚接入、追踪和预算；页脚是一片正在施工的新教学楼，学子们搬砖砌墙（砖就是 token）。界面的任务是让一次调用的去向被看清，像素场景负责温度和记忆点。

品牌标志是原创二次元「星狐」（见 Logo 一节）：一只狐狸代表一个入口，身后 4 条尾巴代表通往各家模型的多条路由。用户后台沿用同一套语言：夜空侧栏 + 暖纸内容区（见 Console 一节）。

整体气质**克制、有学院气，带一点像素游戏和二次元的亲切感**。标题和正文都用系统无衬线字体栈（与 astrlink.com 相同），标题字重 700、字距 −1%；代码和数据一律用 Geist Mono 等宽数字。内容区底色是暖纸色，层次靠细线和浅底区分，阴影只留给浮层和状态。

动效集中在首屏和页脚两块像素场景：角色逐帧走动干活，金色光点沿金线流动，塔吊升降。内容区保持安静。一切动效都可以关闭。

v3 取代了 v2：首屏不再使用浑天仪，标题改为左对齐，浅色底改为暖纸色。v2 的组件（按钮、芯片、徽章、玻璃浮层等）继续沿用。2026-11 起又做了两处变更：标题字体由思源宋体改为系统无衬线（代码已上线，Figma 首页画板里的标题仍是宋体，未同步）；品牌标志由学士帽改为星狐（Figma 首页 v3 与用户后台稿已替换，线上代码尚未替换）。

**Key Characteristics:**
- 深蓝占约 70% 的着色面积，帽穗金不超过 5%，只出现在被追踪的线和它的终点上（Logo 里的金星除外）。
- 无衬线标题与正文 + 等宽数据的两层字体分工。
- 星狐 Logo：通用版头像不带圆底、外围白色贴纸描边，深浅背景都能用。
- 浅色渐变天空 + 细网格 + 轨道线的背景配方，而不是两色线性渐变。
- 胶囊形控件与玻璃浮层，静态内容平铺、用细线分隔。
- 居中 1200px 内容区，区块标题左对齐，区块之间留出宽松而统一的间距。
- 首屏和页脚是 1440 设计宽的像素场景；8px 像素方块是列表标记。

## Logo（星狐）

2026-11 起品牌标志改为原创二次元「星狐」，取代学士帽。学士帽定稿保留在 Figma 区块 01 LOGO 和 `export/logo/` 作历史参考；线上网站、favicon 在代码替换前仍是学士帽。

- **寓意**：一只狐狸代表一个入口（一个 Key、一个地址）；全身版身后 4 条尾巴代表通往各家模型的多条路由，其中一条尾尖是帽穗金，即被追踪的那一次调用。
- **形象**：浅蓝身体，白色口鼻面罩、耳内和胸前绒毛，深蓝描边；大眼睛带白色四芒星高光，额头一枚蓝色月牙印记，两腮双层绒毛。只用品牌色，腮红用浅蓝，不用粉色。
- **头像图标（通用版，主用）**：只有头部，不带圆底，外围一圈白色贴纸描边。深色背景靠白边把轮廓框出来，浅色背景靠深蓝线条，一个版本深浅通用。两耳之间一颗帽穗金四芒星（深蓝描边），是 Logo 里唯一的金色，属于标志本身，不计入 One Star Rule。用于网站小图标、App 图标、头像、后台侧栏图标栏。导出 1024 / 512 / 180 / 64 / 32 / 16；32px 下仍能认出竖耳朵的狐狸头。
- **横版**：通用头像 + 官方「211API」字标。字标沿用学士帽横版里的转曲路径（Plus Jakarta Sans ExtraBold），不要用文字重排。夜空和深色背景用白字，浅色背景用深蓝字（#14306b）；字标高约为头像的 42%，两者间距约为头像高的 15%。
- **全身版**：坐姿全身星狐，带 4 条尾巴，有夜空圆盘徽章版和透明底版，用于品牌插画和周边，不用在 64px 以下。
- **月中星狐**：首屏月亮中心只印淡色全身剪影（#cdd9ee），不放彩色头像，以免和导航 Logo 重复。
- **不要**：给头像加回深蓝圆底后放在深色背景上（会和背景融在一起）；拉伸或改比例；在 Logo 上再加其他金色；把字标换成别的字体。
- **出处**：Figma 页面「211API · Console v3」C0 区块的组件 `Logo/v3 星狐 · Icon（通用）`、`Logo/v3 星狐 · Horizontal · 深色底（白字）`、`Logo/v3 星狐 · Horizontal · 浅色底（深蓝字）`。VectorCraft 源文件、SVG 和各尺寸 PNG 在设计目录 `logo-gen/round7-vectorcraft-fox/`（过程稿，不进 git，同学士帽各轮一样放在网盘）；定稿后再导出到 `export/logo/`。

## Colors

一套以学院深蓝为主、帽穗金点睛的浅色调板，文字分墨色、石板、雾灰三级对比。

### Primary
- **学院深蓝**（navy）：主按钮、选中的筛选芯片、标题强调、Logo 线条与描边。对白 12.6:1。整页着色面积约 70%。
- **交互蓝**（blue）：文字链接、悬停反馈、首屏标题强调（深色背景上用 #7aa2ff）。对白 5.7:1。

### Secondary
- **帽穗金**（gold）：只用于图形——追踪金线、金色光点、被追踪模型的金槽和激活描边。对白仅 2.2:1，**不可用于文字**。
- **古铜**（bronze）：金色系的文字版本，用于价格、步骤序号、Model Chip 里的耗时。对白 5.4:1。

### Tertiary
- **信号绿**（ok）：只表示状态（200 OK、所有系统运行正常、可用率条）。对白 5.3:1。

### Neutral
- **墨色**（ink）：主文字和数据值。对白 17.7:1。
- **石板**（slate）：次要文字、导航链接默认态；玻璃表面上的文字最低用到这一级。对白 7.7:1。
- **雾灰**（mist）：标签、占位、版权等辅助信息，字号不小于 12px。对白 4.8:1。
- **细线**（line）：分割线、描边、表格行线。
- **白**（surface）：卡片和玻璃的基色。
- **画布**（canvas）：内容区底色，暖纸色。
- **条带**（band）：交替区块的底色，比画布略深。
- **夜空**（night）：首屏和页脚像素场景的天空底色，竖向渐变 #050b18 → #091430 → #13244b。
- **浅蓝**（tint）：选中行、激活步骤和图标块的底色。
- **天空蓝**（sky）：轨道环、非追踪连线。

### Dark Theme（学院夜空）
深色版与浅色版结构完全相同，只换一套同名颜色变量。Figma 里是独立集合「211API / Color v2 · Dark」（当前方案每个集合只允许 1 个模式）。v3 深色稿是区块 07 的 `Home / v3 · 星链 · Dark 1440`（94:47709），内容区已绑定变量的颜色都换到了这套集合里；v2 深色稿 `Home / v2 · Dark 1440`（46:1740）只作历史参考。实现时等价于在 `.dark` 下覆盖同名 CSS 变量。

主题默认跟随系统（`prefers-color-scheme`），导航右侧的主题按钮可以手动切换，手动选择优先于系统设置。

Figma 中浅色集合的 canvas、line 已改为 v3 暖纸色值，两个集合都加了 band；v3 浅色、深色画板内容区里和变量同值的颜色都已绑定变量。设计语言画板（区块 02）展示两套色板、夜空场景配方，以及 v3 导航链接、主题按钮组件。

| 变量 | 浅色 | 深色 | 深色下的角色 | 对 canvas |
|---|---|---|---|---|
| navy | #14306b | #dbe6fb | 主按钮底、选中芯片、标题强调（反转为月白，按钮上文字取 surface） | 15.3:1 |
| blue | #2f5fd0 | #7aa2ff | 链接、悬停 | 7.7:1 |
| gold | #d4a84b | #e3b95e | 追踪金线与光点 | — |
| bronze | #8a6420 | #ecc978 | 金色系文字 | 12.1:1 |
| ink | #0c1830 | #e9eef8 | 主文字 | 16.6:1 |
| slate | #45536e | #aab6cb | 次要文字 | 9.4:1 |
| mist | #66738c | #7f8ca5 | 辅助信息 | 5.7:1 |
| ok | #137a52 | #3dd68c | 状态 | 10.3:1 |
| line | #e3dccd | #1f2d48 | 分割线、描边 | — |
| surface | #ffffff | #0e1830 | 卡片与玻璃基色 | — |
| canvas | #f7f5f0 | #070e1d | 页面底色 | — |
| band | #efeae1 | #0b1427 | 交替区块的条带底色 | — |
| tint | #e8f0fc | #15223f | 选中行、激活步骤 | — |
| sky | #bfd6f6 | #2b4170 | 轨道描边 | — |

未进变量的配方在深色下这样换：
- 玻璃表面：白色半透明改为 surface 同等不透明度；玻璃白描边降到白 6%–8%；液态玻璃内高光降到白 8%。
- 首屏和页脚本来就是夜空像素场景，深色版不变；条带用 band 变量（#0b1427）。
- 阴影：深蓝投影改为黑色，不透明度约为浅色的 3 倍，上限 50%；金色投影保留。
- 金色高亮底：代码行 10%。被追踪的表格行不用金色底，用 band（#0b1427）。
- 首屏标题：在夜空上始终用深色值（ink #e9eef8，「编程模型。」blue #7aa2ff），不随主题切换。像素角色、道具与厂商图标不变。
- 本来就是深色的内容卡片（快速接入的代码面板、密钥额度卡）内部不变，外框补 1px line（#1f2d48）描边，阴影按上一条换成黑色。
- v3 内容区里没进变量的暖纸色：表格行分隔 #f0ebe0、#ece6d9 → #18243f；表头底 #faf8f3 → #121d38；「示例数据」标签底 #f1ece2 → tint；次级按钮描边 #d9d1c1 → #2b3a58；服务状态玻璃面板白 70% → surface 70%，白描边降到 8%；FAQ 折叠项底 canvas 90% → surface 90%。
- 厂商图标原色（Claude #d97757、Gemini #3186ff 等）不变。

### Named Rules
**The One Star Rule.** 任一时刻，页面上只有一个被追踪的对象带金色：一条金线和它的终点。其余轨道、环和卡片一律保持深蓝或石板，不出现厂商品牌色。Logo 里两耳之间的金星是标志的固定部分，不计入这条规则。

**The Bronze Text Rule.** 金色系的文字一律用古铜，帽穗金只画线、点和描边。

**The Signal Green Rule.** 绿色只表示状态，不用于装饰、按钮或强调。

## Typography

**Display / Body Font:** 系统无衬线字体栈 `Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, system-ui, Segoe UI, sans-serif`（与 astrlink.com 相同；Inter 只在用户已安装时生效，不外链，不再自托管中文字体）
**Mono Font:** Geist Mono 400 / 500（代码与数据，自托管）
**Wordmark:** 不用字体排版，直接用 Logo 里的转曲路径

**Character:** 无衬线标题干净利落，字重 700、字距 −1% 显得紧凑；正文同一字体，干净可读；等宽数字让延迟、tokens、费用这些可核对的数据对齐成列。2026-11-20 起代码已按此实现（代码仓库 `docs/spec/brand-home.md`「字体」）；用户后台 Figma 稿用 PingFang SC Semibold 表示 700。Figma 首页画板里的宋体标题尚未同步。

### Hierarchy
- **Display**（Bold 700，clamp(32px, min(3.9vw, 6.2svh), 56px)，行高 1.22，字距 −1%）：只用于首屏主标题，固定两行。窄屏用 clamp(26px, 7.6vw, 40px)。
- **Section**（Bold 700，40px / 52px，字距 −1%）：长页各区块的大标题。
- **Headline**（Semibold 600，32px / 44px，字距 −1%）：次级标题。用户后台页标题用 26px / 34px（手机 22px / 30px）。
- **Lead**（Regular 400，18px / 30px）：首屏副文和区块副标题，单行不超过约 40 个汉字。
- **Body**（Regular 400，15px / 24px）：正文、功能描述、FAQ 答案。FAQ 答案宽度限制在 840px 以内。
- **Label**（Medium 500，14–15px / 20px）：按钮、导航、芯片、表头。
- **Mono**（Geist Mono Regular / Medium，12–13px / 18px，等宽数字）：代码、请求 ID、延迟、tokens、价格、状态码。
- **Wordmark**：「211API」字标，用 Logo 里的转曲路径（Plus Jakarta Sans ExtraBold），见 Logo 一节。

### Named Rules
**The Tabular Truth Rule.** 凡是可以被核对的数字——延迟、tokens、费用、可用率、调用量——都用 Geist Mono 等宽数字，不用比例字体。

**The Heading Speaks Alone Rule.** 区块标题直接由大标题承担，上方不加小标签或横线夹字。

## Layout

- **网格**：内容区固定 1200px 居中，12 列，栏间距 24px；窄屏保留最小侧边距。首页画板宽 1440px，同时在 1920px 下检查过。
- **区块节奏**：主要区块上下各留 96px，区块之间形成 192px 的大间隔；区块标题组到内容统一 48px。
- **附属条带**：依附于上一区块的条带（首屏下的「生态兼容」、模型广场下的「服务状态」）只保留一侧间距，贴近它所属的内容。
- **组内节奏**：紧密组用 8–16px，组与组之间用 24–48px。标题组内部（标题 → 副文）16px；标题组和它的操作按钮之间 28px。
- **标题组**：区块标题、副文和「查看 xx →」链接左对齐到 1200 栅格左缘（标题 → 副文 28px，副文 → 链接 30px，链接 → 内容 40px）。工具栏类控件（筛选芯片、排序）沿栅格左右对齐。
- **区块底色**：画布与条带交替；深色数据卡（#0b1427 外框 + #0e1830 内卡）用于首页代码面板和额度卡，与夜空首屏呼应。用户后台的夜空数据卡已改为单层 #0e1830（不套卡片），首页这两块待统一。
- **像素场景**：首屏 1440×900、地面线 y=836；页脚场景高 340、地面线 y=340。按设计宽等比缩放，像素图一律 `image-rendering: pixelated`。窄屏（< 860px）不删角色：场景以 0.75 倍显示，镜头在 1440 宽的世界里缓慢左右平移（30s 往返）；减少动态效果时改为整幅缩放到屏宽、静止。
- **响应式**：860px 以下改为上文下图；导航隐藏中间的胶囊菜单和「登录」；首屏标题改用 clamp(26px, 7.6vw, 40px)。

## Elevation & Depth

静态内容平铺：功能栅格、FAQ 列表、模型卡片用细线、浅底和 1px 描边区分层次。阴影只给浮起来的东西：玻璃浮层（代码卡、Model Chip、导航）、主按钮，以及悬停、激活这些状态。阴影一律带深蓝色调和柔和模糊，不用中性灰或黑。

### Shadow Vocabulary
- **主按钮**（`box-shadow: 0 6px 16px rgba(20,48,107,.18)`）：深蓝主按钮静止态；悬停加深为 `0 10px 24px rgba(20,48,107,.24)` 并上移 2px。
- **玻璃静止**（`box-shadow: 0 6px 24px rgba(20,48,107,.08)`）：玻璃按钮、代码卡、导航胶囊。
- **玻璃悬停**（`box-shadow: 0 10px 28px rgba(20,48,107,.12)`）：玻璃表面悬停态。
- **静态卡片**（`box-shadow: 0 8px 24px -12px rgba(20,48,107,.05)`）：模型卡片这类需要轻微浮起的容器，几乎不可见。

### Named Rules
**The Flat-By-Default Rule.** 表面静止时是平的；阴影只表示「浮层」或「状态」。不能用阴影给静态内容做装饰。

**The Glass Recipe Rule.** 所有玻璃浮层共用一套配方：白 62% + 背景模糊 24 + 1px 白 90% 内描边 + 深蓝柔影。状态只改透明度和位移：悬停填充 85% 并上移 2px，激活填充 88% 并加 1.25px 帽穗金描边。

## Shapes

形状语言圆润：可点击的控件——按钮、筛选芯片、导航、状态徽章、搜索框——一律做成胶囊（999px）。卡片和浮层用 16px 圆角；大面板（调用明细、服务状态）用约 20px；图标块用 8px。描边统一 1px，颜色用细线色（line）；玻璃表面用白色内描边。圆形只用于状态点、铭珠和轨道。

## Components

整体手感**圆润、轻盈、响应克制**：悬停只上移 2px、白度变亮，不弹跳、不发光。

### Buttons
- **Shape:** 胶囊（999px），高 48px，左右内距 24px；小号高 36px、内距 16px。
- **Primary:** 学院深蓝底、白字，Label 字重，带主按钮阴影。文字后可跟一个箭头。
- **Hover / Focus:** 160ms ease-out，上移 2px，阴影加深；小号按钮悬停只把底色加深到 #1a3a7e，不位移。
- **Glass（次要）:** 白 60% 玻璃底、深蓝字、1px 白 90% 描边，悬停白度升到 85% 并上移 2px。用于「查看文档」等次要操作。

### Chips
- **Style:** 胶囊，高 36px，内距 8px 16px，白底、细线描边、石板色字；供应商芯片左侧带 @lobehub/icons 图标。
- **State:** 选中态改为学院深蓝底、白字、无描边。筛选芯片同一时刻只选中一个。

### Cards / Containers
- **Corner Style:** 卡片 16px，大面板约 20px。
- **Background:** 白或白→canvas 的极浅竖向渐变；玻璃浮层用玻璃配方。
- **Shadow Strategy:** 见 Elevation & Depth——静态卡片几乎无阴影，浮层用玻璃阴影。
- **Border:** 1px 细线色。
- **Internal Padding:** 16–32px，按内容密度选。
- 功能介绍这类同质条目不做成卡片，改用顶部 1px 细线分隔的开放栅格。

### Inputs / Fields
- **Style:** 胶囊形搜索框，白底，1px 细线描边，左侧放大镜图标，占位字用雾灰。
- **Copy Field:** 可复制的 base_url 字段用 Geist Mono 显示地址，右侧带「复制」按钮。

### Navigation
- 固定在顶部，高 72px。左侧星狐横版 Logo（夜空上用白字版），中间液态玻璃胶囊菜单（首页、模型、文档、状态），右侧玻璃胶囊里放「登录」和小号主按钮「获取 API Key」。
- 菜单链接默认石板色、悬停和当前态为墨色；当前项下面衬一个 7% 深蓝的高亮胶囊，切换时以 .45s 回弹曲线滑动。
- 入场时从上方 20px 滑入，用时 .5s，延迟 .1s。
- **v3 首屏导航**（直接压在夜空上，没有玻璃胶囊）：链接默认 #aab6cb，当前项文字纯白，下方 6px 处放一条与文字等宽的 3px 月白（#dbe6fb）横条，横条带 8px 的 #7aa2ff 85% 外发光。不再使用 2px 的 #7aa2ff 细线，因为它和夜空里的连线是同一个色系，在夜空上看不出来。下划线不用金色，金色只留给被追踪的那次调用。浅色、深色两版的导航完全一样。
- **主题按钮**：在「登录」左侧 12px，36px 圆形，底色月白 6%，描边白 22%（和「登录」按钮一致），图标为 16px、1.5px 描边的月白线条；浅色时显示太阳，深色时显示月亮，切换过渡 200ms。

### Call Log（调用明细表格）
- 被追踪、已展开的那一行用条带色（band）做背景，左侧 3px 帽穗金竖条，链路里的金线与节点标出被追踪的调用。行背景不用金色，金色只留给竖条和链路。
- 其余行白底，行线 1px；表头底比条带更浅。

### FAQ（折叠列表）
- 折叠项：画布 90% 底（深色 surface 90%）+ 1px 细线描边，16px 圆角。
- 展开项：surface 底、天空蓝 90% 描边、浮层阴影，右侧切换按钮填深蓝。**不加金色竖条**：金色只留给被追踪的那次调用（One Star Rule），FAQ 不是被追踪的对象。Figma 的 FAQ 组件主件 `Page/FAQ Item / State=Expanded`（1:3461）已删掉竖条，v2、v3 各画板的实例随之更新。

### Status Badge
- 胶囊，信号绿 10% 底 + 信号绿 Mono 字，左侧 6px 圆点，例如「● 200 OK」。重试场景用古铜描边的「429」→ 箭头 → 绿色「200」表示自动切换。

### Model Chip（招牌组件）
- 显示当前被追踪的模型：胶囊玻璃底，左侧供应商图标，Mono 字显示模型名，古铜色显示耗时（如 1.24s）。
- 激活态加帽穗金描边——这是 One Star Rule 在组件上的体现。

### Code Card（招牌组件）
- 「你的代码」玻璃卡片，宽约 340px，圆角 14–16px，Mono 字。顶部一行显示标签和状态徽章（「● 200 · 286 ms」），下面是 `base_url` 和 `model` 两行代码，键名用雾灰。

### Starlink Hero（招牌场景）
- 夜空 + 星星 + 月亮（84px 圆 #f2f5fb，中心印淡色全身星狐剪影 #cdd9ee，即「月中星狐」，外圈三道轨道环）+ 像素学院天际线（图书馆、钟楼、天文台、楼群、松树）。月亮里不放彩色 Logo，避免和导航 Logo 重复。
- 地平线上 8 个工位，每个工位一件专属像素道具，对应一个生态工具：Claude Code 书桌、Cursor 光标黑板、OpenCode CRT 电脑推车、Codex 全息控制台、Pi 茶歇角、Hermes 邮筒、DeepSeek Harness 鲸鱼鱼缸实验台、OpenClaw 抓娃娃机。工具名写在道具下方。
- 月亮到每个工位状态牌有一条连线：普通线天空蓝 34%；被追踪的 Claude Code 线为金色，金色光点 2.4s 流动一趟。上游异常的线可挂「429 → 已切换」标记。
- 状态牌显示「模型名 · 耗时」；角色在哪个工位干活，那个工位的状态牌亮起，其余 45%。

### Pixel Characters（像素学子）
- 6 位原创二次元像素角色，一个模型或工具一个形象：Claude（赤陶波浪长发）、GPT（黑色短发白挑染、实验袍）、Gemini（双色双马尾、魔法少女裙）、Grok（银发红瞳、黑色卫衣）、OpenCode（薄荷双丸子头、护目镜）、DSH（钴蓝短发、鲸鱼书包）。都别迷你学士帽发夹，只有 Claude 是金色帽穗。
- 角色插画允许使用发色、服装色等厂商联想色；连线、卡片、按钮仍不用厂商品牌色。
- 1.5 倍像素显示；干活帧 0.2s、走路帧 0.15–0.17s；头侧 18px 圆标显示模型（或工具）图标，随人移动。
- 素材与走位参数见 `export/sprites/README.md` 与 `handoff/home-v3-prompts.md`。

### Construction Footer（像素工地页脚）
- 在建钢架教学楼 + 塔吊 + 砖堆、半砌的墙、搅拌机、手推车、沙堆、路障、工地小屋；6 位学子戴白色安全帽分两队搬砖砌墙，塔吊吊着一托砖升降。
- 参数牌把砖比作 token：砌砖时显示首字延迟和输出速度，抱砖时显示本次 token，砌完显示费用；砖堆下方显示缓存命中，吊砖旁显示上下文长度。全部为示意数据，并标注「工地参数为示意」。
- 工地不使用黄色和金色：安全帽和塔吊用月白、钢蓝，砖用砖红。

## Console（用户后台 v3）

Figma 页面「211API · Console v3」：C0 设计说明与组件；C1–C12 共 12 个页面（仪表盘、API 密钥、使用记录、充值 / 订阅、我的订阅、我的订单、兑换码、邀请返利、个人资料、可用渠道、渠道状态、MCP 服务），每页桌面 1440 浅色 + 深色；C13–C14 手机 390（12 页浅深各一，另有侧栏抽屉）；C15 平板 1024 图标栏（仪表盘）。目前只有设计稿，尚未实现到代码。

- **外壳（≥ 1280）**：左侧 248px 夜空侧栏（首屏同款夜空渐变 + 星点，顶部星狐横版白字 Logo，底部像素学院一角：月亮、图书馆、松树、Claude 在书桌前干活），右侧暖纸内容区。顶栏 64px：搜索（⌘K）、文档、中 / EN、主题、余额 + 充值、账户。内容区左右 40px，1440 下内容宽 1112px；画板最小高度 900。
- **平板（768–1279）**：侧栏收成 72px 图标栏（顶部星狐头像），悬停显示名称提示，底部按钮可展开。内容区左右 32px；指标卡一行四个，趋势图通栏，表格保留。
- **手机（< 768）**：顶部夜空应用栏（菜单、星狐横版、余额、头像）；侧栏改为左侧 304px 抽屉，带遮罩。内容区左右 16px；指标卡两列，表格改成列表行，筛选胶囊横向滑动，充值页支付栏吸底。
- **当前导航项**：月白 8% 底 + 左侧 3px 月白竖条（#7aa2ff 外发光），侧栏、图标栏、抽屉一致，和首页导航当前项同一配方，不用金色。
- **不套卡片**：卡片里不再放带描边或底色的卡片。卡片内分组用细线、留白或条带底色；并排的明细用竖线分隔；金额、支付方式这类可选项直接放在页面上。
- **夜空数据卡**：单层 #0e1830、圆角 20、浮层阴影，每页至多一块（仪表盘总览、密钥额度、订单摘要、兑换余额、邀请返利、MCP 连接）；深色主题补 1px line 描边。
- **金色**：只出现在仪表盘「最近一次调用」（月亮 → 金线 → 金点 → 金色描边的模型牌）和使用记录的展开行（3px 金色竖条 + 鉴权 → 路由 → 上游 → 计费链路）。可用渠道的展开行用条带底色，不加金色。
- **数字与颜色**：可核对的数字一律 Geist Mono；金额文字用古铜；信号绿只表示状态（200 OK、启用、已支付、可用率条）。额度 ≥ 90%、延迟升高用古铜提示，不引入红色。
- **表格**：表头底 #faf8f3、行线 #f0ebe0、行高 48–64px；勾选行 tint 60%；可展开的行展开后用条带底色。
- **深色**：内容区颜色全部绑定「211API / Color v2 · Dark」变量；侧栏和夜空卡保持原样；OpenAI、Grok、Cursor、OpenCode 等黑色单色图标在深色下改为墨色 #e9eef8。
- **组件**（C0「组件与规则」画板）：Nav Item、Rail Item、Mobile App Bar、Button（浅色 / 夜空）、Input、Switch、Filter Pill、Segmented、Badge、Stat Tile、Copy Field、Model Chip · Night、Pixel Vignette，以及星狐 Logo 组件。
- **数据与文案**：画板里的数值都是示意，上线后由接口提供；页面和字段名沿用产品现有中文文案。

## Do's and Don'ts

### Do:
- **Do** 让学院深蓝占约 70% 的着色面积，帽穗金不超过 5%，只画在被追踪的线和它的终点上。
- **Do** 金色系文字用古铜（bronze），玻璃表面上的文字至少用石板色（slate）。
- **Do** 内容区固定 1200px 居中，区块标题左对齐；主要区块上下各约 120px。
- **Do** 内容区用暖纸色画布与条带交替；首屏和页脚用夜空像素场景，像素图保持整数倍、不做平滑。
- **Do** 可核对的数字一律用 Geist Mono 等宽数字。
- **Do** 厂商图标统一用 @lobehub/icons。
- **Do** 所有动效都提供 `prefers-reduced-motion` 降级：关闭漂移、光点和漂浮，金线直接呈现完成态，只保留 200ms 淡入。
- **Do** Logo 用星狐通用版头像；横版在夜空和深色背景上用白字，浅色背景上用深蓝字。

### Don't:
- **Don't** 使用橙色、紫色或纯黑。
- **Don't** 把帽穗金（#d4a84b）用作文字颜色，它对白只有 2.2:1。
- **Don't** 把绿色用于状态以外的任何地方。
- **Don't** 给静态内容加装饰性阴影，也不要把同质的功能条目做成一排排一样的卡片。
- **Don't** 在区块标题上方加小标签或「— xx —」式的横线夹字。
- **Don't** 在轨道、环或卡片上使用厂商品牌色；只有图标本身保留品牌色。
- **Don't** 在卡片里再套带描边或底色的卡片（用户后台已按此执行；首页的代码面板、额度卡仍是外框 + 内卡，待统一）。
- **Don't** 在首屏月亮里放彩色 Logo，也不要给星狐头像加回深蓝圆底后放在深色背景上。
