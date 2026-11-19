---
name: 211API
description: 学院深蓝 + 帽穗金的浅色设计语言（v2），金色只标记被追踪的那一次调用
colors:
  navy: "#14306b"
  blue: "#2f5fd0"
  gold: "#d4a84b"
  bronze: "#8a6420"
  ink: "#0c1830"
  slate: "#45536e"
  mist: "#66738c"
  ok: "#137a52"
  line: "#dce4f2"
  surface: "#ffffff"
  canvas: "#f6f9fe"
  tint: "#e8f0fc"
  sky: "#bfd6f6"
typography:
  display:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "clamp(36px, 3.4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.03em"
  section:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  headline:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "0.01em"
  lead:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.667
  body:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
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
    fontFamily: "Geist, Noto Sans SC, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
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
  来源：/Users/luoee/Design/211API-UI/DESIGN.md（211API-UI 设计仓库，commit 5b08d9f）
  复制日期：2026-11-18
  设计源更新后重新复制，不要直接修改本文件。
-->

# Design System: 211API

## Overview

**Creative North Star: "学院天文台（The Academy Observatory）"**

211API 的视觉世界是一座安静的学院天文台。学院深蓝提供稳重和信任；浅色渐变天空、细网格和轨道等高线是观测的环境；浑天仪和轨道线是仪器；帽穗金是被观测到的那一颗星，也就是「被追踪的那一次调用」。界面本身不抢戏，它的任务是让一次调用的去向被看清。

整体气质**克制、通透、有学院气**。标题用思源宋体 SemiBold，略加字距，带一点书卷气；正文用思源黑体保证可读；代码和数据一律用 Geist Mono 等宽数字。背景不是平涂，而是「底色 + 五层模糊云团 + 96px 细网格 + 轨道线」的叠加，营造通透的科技感。层次靠细线和浅底区分，阴影只留给浮层和状态。

科技感来自运动而不是装饰：云团缓慢呼吸，金线自绘，光点沿轨道流动。一切动效都慢、轻，并且可以关闭。

**Key Characteristics:**
- 深蓝占约 70% 的着色面积，帽穗金不超过 5%，只出现在被追踪的线和它的终点上。
- 宋体标题 + 黑体正文 + 等宽数据的三层字体分工。
- 浅色渐变天空 + 细网格 + 轨道线的背景配方，而不是两色线性渐变。
- 胶囊形控件与玻璃浮层，静态内容平铺、用细线分隔。
- 居中 1200px 内容区，区块之间留出宽松而统一的间距。

## Colors

一套以学院深蓝为主、帽穗金点睛的浅色调板，文字分墨色、石板、雾灰三级对比。

### Primary
- **学院深蓝**（navy）：主按钮、选中的筛选芯片、标题强调、Logo 与仪器外环釉面。对白 12.6:1。整页着色面积约 70%。
- **交互蓝**（blue）：文字链接、悬停反馈、渐变终点和右上主氛围云团。对白 5.7:1。

### Secondary
- **帽穗金**（gold）：只用于图形——追踪金线、金色光点、「海量」下的笔画、被追踪模型的金槽和激活描边。对白仅 2.2:1，**不可用于文字**。
- **古铜**（bronze）：金色系的文字版本，用于价格、步骤序号、Model Chip 里的耗时。对白 5.4:1。

### Tertiary
- **信号绿**（ok）：只表示状态（200 OK、所有系统运行正常、可用率条）。对白 5.3:1。

### Neutral
- **墨色**（ink）：主文字和数据值。对白 17.7:1。
- **石板**（slate）：次要文字、导航链接默认态；玻璃表面上的文字最低用到这一级。对白 7.7:1。
- **雾灰**（mist）：标签、占位、版权等辅助信息，字号不小于 12px。对白 4.8:1。
- **细线**（line）：分割线、描边、表格行线。
- **白**（surface）：卡片和玻璃的基色。
- **画布**（canvas）：页面底色。
- **浅蓝**（tint）：选中行、激活步骤和图标块的底色。
- **天空蓝**（sky）：渐变云团。

### Named Rules
**The One Star Rule.** 任一时刻，页面上只有一个被追踪的对象带金色：一条金线和它的终点。其余轨道、环和卡片一律保持深蓝或石板，不出现厂商品牌色。

**The Bronze Text Rule.** 金色系的文字一律用古铜，帽穗金只画线、点和描边。

**The Signal Green Rule.** 绿色只表示状态，不用于装饰、按钮或强调。

## Typography

**Display Font:** Noto Serif SC（思源宋体），回退 Songti SC
**Body Font:** Noto Sans SC（思源黑体），回退 PingFang SC、Microsoft YaHei
**Label/Mono Font:** Geist Mono（代码与数据），字标用 Geist

**Character:** 宋体标题带学院的书卷气，加 1%–3% 字距显得克制；黑体正文干净可读；等宽数字让延迟、tokens、费用这些可核对的数据对齐成列。

### Hierarchy
- **Display**（SemiBold 600，clamp(36px, 3.4vw, 52px)，1440 宽下约 49px，行高 1.3，字距 +3%）：只用于首屏主标题。设计稿里另有 60/76 的 Display 样式作为上限。
- **Section**（SemiBold 600，40px / 52px）：长页各区块的大标题。
- **Headline**（Medium 500，32px / 44px，字距 +1%）：次级标题、底部 CTA 标题。
- **Lead**（Regular 400，18px / 30px）：首屏副文和区块副标题，单行不超过约 40 个汉字。
- **Body**（Regular 400，15px / 24px）：正文、功能描述、FAQ 答案。FAQ 答案宽度限制在 840px 以内。
- **Label**（Medium 500，14–15px / 20px）：按钮、导航、芯片、表头。
- **Mono**（Geist Mono Regular / Medium，12–13px / 18px，等宽数字）：代码、请求 ID、延迟、tokens、价格、状态码。
- **Wordmark**（Geist SemiBold 20px，字距 −2%）：「211API」字标。

### Named Rules
**The Tabular Truth Rule.** 凡是可以被核对的数字——延迟、tokens、费用、可用率、调用量——都用 Geist Mono 等宽数字，不用宋体或黑体。

**The Heading Speaks Alone Rule.** 区块标题直接由宋体大标题承担，上方不加小标签或横线夹字。

## Layout

- **网格**：内容区固定 1200px 居中，12 列，栏间距 24px；窄屏保留最小侧边距。首页画板宽 1440px，同时在 1920px 下检查过。
- **区块节奏**：主要区块上下各留 96px，区块之间形成 192px 的大间隔；区块标题组到内容统一 48px。
- **附属条带**：依附于上一区块的条带（首屏下的「生态兼容」、模型广场下的「服务状态」）只保留一侧间距，贴近它所属的内容。
- **组内节奏**：紧密组用 8–16px，组与组之间用 24–48px。标题组内部（标题 → 副文）16px；标题组和它的操作按钮之间 28px。
- **标题组**：区块标题和副文居中，下方内容回到 1200 栅格对齐。工具栏类控件（筛选芯片、排序）沿栅格左右对齐，不居中。
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

形状语言圆润：可点击的控件——按钮、筛选芯片、导航、状态徽章、搜索框——一律做成胶囊（999px）。卡片和浮层用 16px 圆角；大面板（调用明细、服务状态、底部 CTA）用约 20px；图标块用 8px。描边统一 1px，颜色用细线色（line）；玻璃表面用白色内描边。圆形只用于状态点、铭珠和轨道。

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
- 固定在顶部，高 72px。左侧字标，中间液态玻璃胶囊菜单（首页、模型、文档、状态），右侧玻璃胶囊里放「登录」和小号主按钮「获取 API Key」。
- 菜单链接默认石板色、悬停和当前态为墨色；当前项下面衬一个 7% 深蓝的高亮胶囊，切换时以 .45s 回弹曲线滑动。
- 入场时从上方 20px 滑入，用时 .5s，延迟 .1s。

### Status Badge
- 胶囊，信号绿 10% 底 + 信号绿 Mono 字，左侧 6px 圆点，例如「● 200 OK」。重试场景用古铜描边的「429」→ 箭头 → 绿色「200」表示自动切换。

### Model Chip（招牌组件）
- 显示当前被追踪的模型：胶囊玻璃底，左侧供应商图标，Mono 字显示模型名，古铜色显示耗时（如 1.24s）。
- 激活态加帽穗金描边——这是 One Star Rule 在组件上的体现。

### Code Card（招牌组件）
- 「你的代码」玻璃卡片，宽约 340px，圆角 14–16px，Mono 字。顶部一行显示标签和状态徽章（「● 200 · 286 ms」），下面是 `base_url` 和 `model` 两行代码，键名用雾灰。

### Armillary Hero（招牌组件）
- 首屏的浑天仪 WebGL 仪器：外层子午环、地平环、赤道环为学院深蓝釉面配天蓝刻度；内层四环为抛光银配蓝槽，对应 Claude、OpenAI、Gemini、Grok 四家。
- 每 9.5s 合轨一次（翻转 7.5s + 停留 2.0s），被追踪的环换成金槽，金色光点 2.4s 绕行一周。完整分镜与实现说明见 Figma「04 · 首屏原型 Hero · 浑天仪」。

## Do's and Don'ts

### Do:
- **Do** 让学院深蓝占约 70% 的着色面积，帽穗金不超过 5%，只画在被追踪的线和它的终点上。
- **Do** 金色系文字用古铜（bronze），玻璃表面上的文字至少用石板色（slate）。
- **Do** 内容区固定 1200px 居中；主要区块上下各 96px，标题组到内容 48px。
- **Do** 背景用「底色 + 五层模糊云团 + 96px 细网格 + 轨道线」的配方，而不是两色线性渐变。
- **Do** 可核对的数字一律用 Geist Mono 等宽数字。
- **Do** 厂商图标统一用 @lobehub/icons。
- **Do** 所有动效都提供 `prefers-reduced-motion` 降级：关闭漂移、光点和漂浮，金线直接呈现完成态，只保留 200ms 淡入。

### Don't:
- **Don't** 使用橙色、紫色或纯黑。
- **Don't** 把帽穗金（#d4a84b）用作文字颜色，它对白只有 2.2:1。
- **Don't** 把绿色用于状态以外的任何地方。
- **Don't** 给静态内容加装饰性阴影，也不要把同质的功能条目做成一排排一样的卡片。
- **Don't** 在区块标题上方加小标签或「— xx —」式的横线夹字。
- **Don't** 在轨道、环或卡片上使用厂商品牌色；只有图标本身保留品牌色。
