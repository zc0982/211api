# v0.2.20 同步与升级核验

## 同步基线

- 上游正式发布：[v0.2.20](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.20)，commit `dab829a4e9b7d1cc307189aea8b0319eb29e29d0`。
- Fork 基线：`5982c89e7727d0e71a45934978e3b2850d6234cd`，已包含 v0.2.19 和 PR #85 的 decode-uri-component 安全修复。
- 从最新 origin/main 创建独立 worktree，普通 merge 正式 tag；不包含发布后的 upstream/main。tag 内 VERSION 仍为 `0.2.19`，显式校正为 `0.2.20`。

## 升级行为

- 新增 OAuth 管理 MCP、授权确认和连接管理页面。未配置 `MCP_PUBLIC_URL` 时默认关闭；本次不配置或启用生产 MCP。
- 管理员密钥补全统计、OpenAI OAuth 等权限；全权兼容模式需在产品界面输入确认文字。
- 注册邮箱精确黑名单、生图账号 1K/2K/4K 路由、GPT Image 2.6，以及 Antigravity 配额窗口和错误冷却改进。
- 网关请求体内存预算、读写空闲超时、SSE 队列/事件上限与后台工作限额；同步非流式 Responses 聚合、WS 每轮首 token、使用记录导出限流和兼容协议修复。
- Vue I18n / message-compiler 更新至 11.4.16，follow-redirects 至修复版 >=1.16.2；decode-uri-component 保留 >=0.5.1 安全约束。Node 24 和 pnpm 9 的 CI 配置保留。

## 合并适配与本地行为

- credits 调度、逐窗口额度豁免、429 runtime blocker、WS Ping/Pong 保活、S3 临时文件上传实现与 fork 基线一致。
- 保留首输出超时、Codex 顶层 input 归一化、长上下文分组默认值、部署镜像覆盖及本地 CI 门禁。
- 四个 Compose 文件同时保留本地首输出超时和 WS 保活变量，并加入上游传输错误冷却开关。
- SSE 透传保留本地同步/异步扫描分支各自归还缓冲区的生命周期，接入上游 bounded splitter；异步保活队列也接入 `sse_queue_max_bytes`，在入队前申请、出队时释放预算，取消时解除等待。
- 新增同步/保活两条路径的回归：无事件分隔符时触发上限，合法大帧即使大于队列预算也可完整输出，完成事件与用量不丢失。
- CI 关键前端测试补入 MCP 授权/路由/连接、邮箱黑名单、管理员权限展示和生图尺寸分流。

## 发布影响

- 新增 `249_mcp_oauth.sql`，创建授权、授权码和凭据摘要表及索引。这里仅同步文件，未执行生产迁移。
- 以实际配置代码为准：`gateway.request_body_memory_budget_bytes` 默认 1 GiB；`gateway.request_body_read_timeout_seconds`、`gateway.downstream_write_timeout_seconds` 默认 120 秒。超预算返回 503；空闲超时不同于整个流的总时长限制，配置 0 可禁用。
- GPT-6.1 Terra 的订阅长上下文附加费、API Key 长上下文计费、effort 校验与默认 Codex 导出模型同步采用上游行为。

## 本地验证

本地工具链：Go 1.27.3、golangci-lint 2.14.0（Go 1.27.3 构建）、Node 24.19.0、pnpm 9.15.9。

已通过：版本完整性 11 项测试、integration 包登记、后端 59 个包的 unit、4 个包的 PostgreSQL / Redis 集成测试、前端 lint/typecheck、385 个文件的 3,101 项测试及生产构建。新增透传合并回归已通过 race 检查。

安全检查：govulncheck 报告代码受影响漏洞为 0，go mod verify 全部通过。pnpm 生产依赖 high/critical 门禁通过，仍有 2 项已有且有效的 SheetJS high 例外，无新增豁免。

部署脚本、Compose 安全/环境变量/首输出期限/资源配置检查、Caddy 缓存检查、版本交付完整性和 10 项 release matrix 测试通过。Compose 配置校验使用本机独立 docker-compose 的临时命令适配器；release matrix 使用临时 PyYAML 6.0.3，不修改项目依赖。Apple container 生命周期测试使用 fixtures，没有操作现有业务容器。

包含前端资源的后端 release 构建通过，二进制版本回读为 0.2.20；`go test -tags=embed ./internal/web` 通过，覆盖 MCP OAuth 元数据路径不被前端路由接管。

首次完整 service race 在上游新增的 `TestOpenAIResponsesOrphanPrecheckLargeEscapedContent` 零分配断言失败（80 次）；未报告 DATA RACE。该用例独立运行 3 次 race 均通过，说明失败与全套测试环境有关。`AllocsPerRun` 统计进程全局分配，沿用仓库既有 `raceDetectorEnabled` 处理：仅在非 race unit 执行零分配性能断言，race 仍检查大转义输入的判断结果与输入不被修改。

修正后非 race 定向测试连续 3 次通过；完整 service race 全量复验通过（249.498s），最终 golangci-lint 检查通过（0 issues）。代码同步、PR CI、合并、部署与生产生效分别判断。
