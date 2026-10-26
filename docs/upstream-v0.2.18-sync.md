# v0.2.18 同步与本地修复核验

## 核验基线

- 上游正式发布：[`v0.2.18`](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.18)，commit `ac1b8f1271be0d674fa6f074403c1410f30a3a81`。
- Fork 基线：`fdb681ce2`，已包含 PR #81、#82；前一次同步为 `v0.2.17`。
- 同步正式 tag，不包含发布后的管理员范围密钥、多图计费等 `upstream/main` 改动。
- tag 中的 VERSION 仍为 `0.2.17`，本次显式更新为 `0.2.18`。

## 本地修复是否已由上游覆盖

以下结论以 `v0.2.18` 的实际代码行为为准，不以提交标题或提交是否属于上游历史作为等价依据。已覆盖的目标不代表相关文件的全部差异都可删除。

| 修复 | 上游状态 | 代码证据与本次处理 |
| --- | --- | --- |
| PR #81、#82：有 credits 时避免额度耗尽误停调度 | 未覆盖 | 上游 `shouldAutoPauseOpenAIAccountByQuota` 不读取可消费 credits，429 分类也未结合账号 credits。保留 `openai_credits_scheduling.go`、调度缓存投影、响应头优先于缓存、逐窗口豁免及回归测试。上游已有 `codex_credits_snapshot` 存储，不能据此认定调度已修复。 |
| PR #66：WS 下游 Ping/Pong 保活与繁忙时延后 Ping | 未覆盖 | 上游没有 `openai_ws_v2/passthrough_keepalive.go`、`runDownstreamKeepalive` 及对应下游 Ping 配置；保留本地实现和真实 socket 测试。上游入站 preflight Ping 不等于持续的下游保活。 |
| PR #42：Cloudflare 524 首输出期限 | 部分覆盖 | 上游已有原生 Responses 的首输出期限，但默认关闭；`ForwardAsAnthropic` 尚无本地的响应头等待 guard。保留本地默认配置、`/v1/messages` header guard 和 `TestOpenAIMessagesStreamFailsBeforeProxyReadDeadlineWhileWaitingForHeaders`。 |
| PR #4：Responses 收到 terminal 后结束，不等待 EOF | 核心行为已覆盖 | 上游 `openai_gateway_response_handling.go` 同步/异步循环均在完整 terminal 后 `finalizeStream()`；透传循环也在 terminal 后的空行处退出，并保留 bare error 例外。本地透传循环还有心跳、错误事件格式等差异，本次一并保留，不整文件回退。 |
| PR #33：S3 上传避免整份备份驻留内存，明确 Content-Length | 未覆盖 | 上游 `S3BackupStore.Upload` 仍 `io.ReadAll(body)`；本地通过临时文件流式上传并设置 `ContentLength`，保留实现和上传长度测试。 |
| PR #34：管理端用户并发数允许 0 | 已覆盖 | `frontend/src/components/admin/user/UserEditModal.vue` 两侧内容一致，输入下限与提交校验均接受整数 0。 |
| PR #1：Codex OAuth input 归一化 | 部分覆盖 | 上游已有字符串转数组，透传路径也能包装对象；通用 `applyCodexOAuthTransformWithOptions` 仍缺少本地提前执行的 `normalizeCodexTopLevelInputList`，对象、缺省/null input 等仍需本地处理。保留完整归一化与测试。 |
| PR #2：清除 Codex OAuth 不支持的请求字段 | 已覆盖 | 上游已有 `openAIChatGPTInternalUnsupportedFields`、`openAICodexOAuthUnsupportedFields` 以及对应出站剥离。 |
| PR #16：透传账号跳过旧 model_mapping 准入门控 | 已覆盖 | 上游 `Account.isModelMappingSupported` 在查询 mapping 前对 `IsOpenAIPassthroughEnabled()` 放行；保留当前实现，不扩大到绕过其他模型政策。 |
| 测试竞态与偶发失败修复 | 部分覆盖 | CN provider 余额探测测试和 Antigravity Base URL 测试文件已与上游一致。Ollama singleflight 合法交错断言、channel monitor 捕获桩互斥、共享账号映射测试串行化、Gin 全局状态和 race 下 allocation guard 等差异仍在，继续保留。 |

另核对到 `61786df40`（Opencode Go compact item ID）仅在独立分支，尚未合入 fork `origin/main`，本次不引入。现存 Gin 全局状态、共享缓存、allocation counter 等测试隔离补丁，以及部署镜像覆盖和本地 CI 门禁均保留；不将部署定制当作上游业务缺陷。

对发布后的 `upstream/main`（`ba81c7fd758e425d67f856d601147ef0c5263d3f`）额外核对：credits 调度、429 runtime blocker、quota service 三个实现文件与 `v0.2.18` 一致，因此 PR #81、#82 的调度问题在该 head 也尚未解决。

## 合并适配

- CI 冲突保留本地缓存、版本完整性、integration 包登记和 service race 门禁，同时将三个 Go 断言对齐到 `1.27.3`。
- 分组创建冲突保留 `LongContextPricingEnabled` 默认开启及显式关闭的本地语义，采用上游导出的 `DefaultAllowImageGenerationForPlatform`，兼容新版 Gemini / Antigravity 生图默认值。
- 根 Dockerfile、backend/Dockerfile、deploy/Dockerfile、go.mod 与 CI / release / security 工作流统一使用 Go `1.27.3`。
- 不删除已由上游覆盖的整块本地代码：同一块代码可能还包含尚未覆盖的异常处理、SSE 头、keepalive 和测试隔离行为。

发布时需要注意上游新增的 `246_enable_gemini_image_generation_groups.sql`：它会将现有 Gemini / Antigravity 分组的 `allow_image_generation=false` 更新为 `true`，排除 composite。这里仅同步迁移文件，尚未执行生产迁移或部署。

## 本地验证环境

- Go 自动工具链：`go1.27.3 darwin/arm64`；golangci-lint：与 CI 相同的 `v2.14.0`，用 Go `1.27.3` 构建。
- Testcontainers 指定当前 Colima 的 `DOCKER_HOST` 和容器内 `/var/run/docker.sock`；repository 集成测试未通过：PostgreSQL 初始化报 `No space left on device`。middleware、tlsfingerprint、routes 集成测试通过。不改全局 Docker 配置，不清理既有容器或数据。
- 本机只有独立的 `docker-compose` 命令；Compose 配置测试通过临时命令适配器执行同一组断言。
- Release 矩阵测试用临时 PyYAML `6.0.3` 依赖运行，不改项目依赖。

已通过：后端 57 个包的 unit 测试、前端 lint/typecheck 与 94 个文件的 1,200 项测试、前后端构建、版本完整性、integration 包登记、golangci-lint v2.14.0、govulncheck、pnpm audit 例外校验、部署脚本检查和 10 项 release matrix 测试。service race 全量检查也通过（239.990s）。

代码同步、本地验证、PR CI、合并和生产部署分别记录。
