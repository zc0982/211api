# v0.2.26 同步与升级核验

## 发布基线

- Fork `origin/main` 为 `34133e668f112412e9625be40c01e4bb9a1f3eaf`，Git 共同祖先为 `348997267d756eab5729bb6b78a275a15d18796a`，双方独有提交数为 435 / 153。
- 正式标签 `v0.2.26` 指向源码 `9494105c7e350937a61bd78b3f913a5a10867f58`（annotated tag 对象 `bb3690b32171c0f6003b55e00ddb66a8026bbcdb`）。按本次指定的发布目标，普通合并其唯一后续版本提交 `f53641e53c8da5efd959595c1eac696bdc0a3a57`。该提交相对源码标签仅把 `backend/cmd/server/VERSION` 更新到 `0.2.26`。

## 冲突处理与重叠检查

| 文件 | 处理及证据 |
| --- | --- |
| `backend/cmd/server/VERSION` | 写入发布 head 的 `0.2.26`，由版本完整性脚本校验。 |
| `backend/internal/service/grok_free_quota_gate_test.go` | 采用上游按缓存等待异步刷新并在锁内快照测试桩的实现。私有缓存用例只清理自身缓存，共享缓存通过 `sync.Map.Clear` 清理。恢复用例要求看到新用量值，避免把缓存未命中当作恢复。 |
| `frontend/src/components/admin/usage/UsageTable.vue` | 保留 211API 紧凑延迟单元格的缓存命中率和读屏文本，纳入上游令牌和费用明细按视口定位及可选用户名列。 |
| `frontend/src/views/admin/UsageView.vue` | 保留管理员 XLSX 的现有列位置，缓存命中率以 Excel 数值百分比留在 AH 列，用户名追加在 AI 列。 |
| `frontend/src/views/admin/__tests__/UsageView.spec.ts` | 回归检查表头和数据行等长、用户名与模型列位置、缓存命中率百分比单元格。 |
| `frontend/src/views/admin/__tests__/AccountsView.sparkShadow.spec.ts` | 同时核对站点链接提示的对齐、外链属性，以及相邻的本地分组同步按钮。 |

- `/home`、星链 v3 静态资源与星狐 Logo、品牌 i18n、`vendor-brand-icons`、`localStorage.theme`，以及 Console v3 侧栏、顶栏、手机导航焦点和仪表盘入口均保留。用户用量手机卡片采用独立模板，补上已有渠道开关允许显示的实际响应模型，沿用既有展开明细布局。
- Redis 粘性绑定新增终值 compare-and-bind。转发期间其他请求写入的绑定继续生效，利润门准入和换号使用本次请求尝试过的账号集。Antigravity 先尝试既有积分接续，仍耗尽时直接冷却换号。同步保留逐窗口额度豁免与积分调度实现。
- 保留首输出期限、WebSocket 下游 keepalive 与 S3 流式上传的 `ContentLength`。上游 Compact SSE 把各次尝试的传输心跳统一计数，避免误判已发送语义输出。WebSocket 相关差异为 TTFT 测试的上下游顺序同步。
- Anthropic 原生流累积 `message_start` 输出 token，Chat/Responses 兼容桥采集 Anthropic OAuth/setup-token 的窗口头并还原跨增量工具名。原生和转换路径保留既有 SSE 扫描及计费上下文。标准库版本约束、时区子进程隔离、发布与依赖审计入口保持与基线一致。
- 上游标签回退了强制校验更新包 checksum 的上游提交。应用内更新包缺少 checksum 时仍可进入安装，这是 fork 已有的边界。合并树的 `update_service.go` 和相关测试与 fork 基线一致，本次验证未执行应用内安装。
- 上游新增的 Responses 思考 token 测试在 `t.Parallel()` 后调用 `gin.SetMode`，与并行 SSE 测试创建 Gin context 的读操作竞争。移除该测试里的重复写入，沿用 service `TestMain` 在运行用例前统一初始化的测试模式，保留原有并行与断言。

## 数据库迁移、配置与兼容性

- 新增、删除或改写 SQL 均为 0。迁移目录和 runner 与 fork 基线逐字节一致，无新增编号冲突、DDL 表锁或回填。runner 持有数据库 advisory lock，按完整文件名排序，用完整文件名查询 `schema_migrations`，比较去除首尾空白后的 SHA-256，沿用已有历史兼容清单。已安装实例验证账册并跳过已应用迁移，全新安装依序运行全套既有迁移。应用二进制回滚沿用原库和配置即可，已经产生的业务记录或显式启用的渠道配置仍会保留。
- Fork 和上游发布树已有迁移历史差异。Fork 的 `234_add_usage_log_upstream_request_id.sql`、`235_add_usage_log_upstream_request_id_index_notx.sql`、`236_channel_max_reasoning_effort_multiplier.sql`、`237_group_codex_models_manifest_config.sql` 分别对应上游的 `232`、`233`、`234`、`234` 同内容文件。替换名称会改变 runner 的迁移身份并重跑 SQL，全部保持 fork 已发布的完整文件名。`250_openai_cache_write_ttl.sql` 的上游差异只有末尾空行，保持已发布字节。`253_upstream_cache_hit_rate.sql` 是 fork 的缓存命中率来源字段迁移，继续从同一文件安装并校验。
- `gateway.antigravity_gemini_omit_include_thoughts` / `GATEWAY_ANTIGRAVITY_GEMINI_OMIT_INCLUDE_THOUGHTS` 默认 `false`。只在 Antigravity Gemini 的 Chat/Responses 流式兼容路径生效，启用后把思考摘要选择交给上游。长时间无数据仍可能触发流间隔超时。
- `OPENCODE_USER_AGENT_VERSION` 可覆盖官方 OpenCode 上游 User-Agent 的内置版本 `1.19.6`，启动时只接受三段数字，非法值回退默认。Compose 样例不会自动向容器注入这两个新增可选环境变量。自定义场景通过应用 YAML 或显式容器环境覆盖相应配置，默认升级无须新增配置。
- `GATEWAY_DISABLE_OPENAI_TRANSPORT_ERROR_COOLDOWN` 保留默认 `false`。网络不可达的冷却从 10 分钟缩至 30 秒，代理认证失败仍为 10 分钟。短时网络抖动恢复后较快重新调度，持续故障时重试频次也会上升。已有冷却和业务限流按原状态处理。Antigravity `QUOTA_EXHAUSTED` 明确耗尽时冷却后改派，减少同号重试。
- `channels.features_config.expose_response_model` 使用既有 JSONB，默认关闭。列表和详情直接批量读取渠道权限。只有开关是布尔 `true` 且上游实际报告了不同于请求模型的值，才返回可选的 `response_model`。用户桌面表、手机卡片显示该字段，用户 CSV 维持既有列结构。管理员 XLSX 在 AI 列追加 `Username`，原有列位置保持一致。用量今日统计和趋势加入上游错误计数，代理列表新增可选探测时间，均复用已有数据结构。
- 上游错误计数按账号和时间范围读取 `ops_error_logs`，对应现有 `idx_ops_error_logs_account_time`。监控关闭时跳过查询，统计读取失败时主用量统计继续返回。隔离 PostgreSQL 集成覆盖提供方错误、业务限流排除和日期归组。
- 裸 Responses 工具请求在 Chat-only 账号上允许改派至支持 Responses 的账号，无匹配时仍是结构化 400。Chat→Responses 流长度截断改为 `response.incomplete`。风险中心记录供应商图片安全拒绝，Anthropic URL 图片纳入已有审核流程。以上改变无需修改数据库或部署参数。
- 新增的 Antigravity 配额耗尽事件记录 HTTP 状态、上游请求 ID 和可辨认的供应商结构化状态及代码。该换号分支在 Redis 中只会删除仍指向失败账号的会话键。

## PR #116 首轮审查修订

1. 用量 DTO 仅接收实际上游 `upstream_response_model`。空白值、与请求模型相同的值和未获许可的值一律省略。列表沿用当前用户筛选，详情校验所有权后才读取开关。用户桌面表关闭管理端审计列的模型渲染分支，手机明细同样只使用公开的 `response_model`。DTO、列表、详情和两种视图均有回归。
2. 每页以去重后的渠道 ID 执行一次 PostgreSQL 查询，JSONB 值只有严格布尔 `true` 才允许披露。读取限时一秒，错误时继续返回普通用量数据。披露查询独立于渠道内存快照及 Redis Pub/Sub。两实例集成测试让订阅端保留旧缓存，仍验证撤权立即影响后续读、重新开启可见、字符串 `"true"` 不生效及数据库读错时不披露。
3. Responses 生图回退将普通 moderation 文案归类为缺少图像结果。明确拒绝文案可继续返回客户端兼容的 400 和错误码，Ops 只保存来源、分类和允许的协议枚举。风控留证只接收明确的供应商错误码或结构化过滤原因，继续使用现有脱敏规则、范围开关和日志队列，不增加自动封禁或邮件动作。
4. 管理员 XLSX 的 C、E、AH 仍为 API Key、请求模型及数值百分比的缓存命中率，用户名追加在 AI。回归校验列位置、表头、单元格类型和值，用户 CSV 沿用原布局。
5. Antigravity 明确配额耗尽换号事件只记录结构化供应商状态及代码、HTTP 状态、上游请求 ID 与固定分类。开启上游响应详情记录的合成回归确认此分支仍省略原始消息及 body。
6. 同一换号分支复用 Redis 单键比较删除脚本，只比较当前会话键的账号值。Redis 集成回归覆盖失败账号匹配时删除，以及健康账号已接管时保留值与剩余 TTL。其他故障分支沿用原行为。

### 隔离数据库启动验证

- 使用 PostgreSQL 18.4 和 Redis 8.4.6，通过旧版实际启动入口初始化 v0.2.25。创建合成管理员、API Key、两个渠道和两笔用量，随后在相同数据目录、数据库与 Redis 上启动 v0.2.26，再切回 v0.2.25。另在空数据库和独立 Redis DB 中用 v0.2.26 从零安装。
- 四种启动场景的 `/health` 正常，公开设置回读各自版本。升级前后和全新安装的 `schema_migrations` 共 306 项完整文件名和 checksum 一致。旧登录会话和 API Key 在升级后可读，切回旧版后仍能查询用量记录。
- 在新版默认配置下，两笔用量的列表和单条响应均省略实际响应模型。开启一个合成渠道的开关后，只有该渠道的历史记录新增最终模型，两个出口都保留原请求模型与 25% 缓存命中率。
- 使用嵌入发行构建和真实 Chromium，在 390 × 844 的深色视口核对星链首页、星狐 Logo 和用户用量卡片。允许显示的模型位于横坐标 249–357 px，页面宽度保持 390 px。关闭开关的记录保持隐藏，两个记录均无中间映射模型。

## 本地验证

- `GOFLAGS=-p=2 make -C backend test-unit` 的 60 个测试包全部通过。首次高并发运行中，基线已有的 `TestServerTimingConnectorRecordsDriverCallsWithoutRowLifetime` 发生一次时序断言失败。该测试及实现与基线一致，独立基线运行 20 次通过，候选全量复跑通过。
- 修复并行测试的 Gin 全局写入后，相关 Responses 和 SSE 保活测试在 `-race -count=15` 下通过。`GOFLAGS=-p=2 make -C backend test-race-service` 完整复跑通过，用时 339.192 秒。
- Go 1.27.4 下，`make -C backend test-version-integrity test-integration-pkgs-check`、`sh backend/scripts/verify-version.sh --expected 0.2.26` 和 `go mod verify` 通过。将 Colima 的 Docker socket 显式传给 Testcontainers 后，`CI=true GOFLAGS=-v make -C backend test-integration` 的 4 个包通过。需独立远端抓包服务的可选 TLS 用例跳过。在 `backend` 下用 golangci-lint 2.14.0 执行 `golangci-lint run --timeout=30m`，报告 0 个问题。
- `make -C backend test-security` 使用 Go 1.27.4 工具链路径直接启动 govulncheck 1.10.0，漏洞库更新时间为 `2026-11-24 15:56:00 UTC`，项目代码可达漏洞为 0。安全扫描入口、Go 依赖和前端锁文件与基线一致。执行 `pnpm --dir frontend audit --prod --audit-level=high --json`，随后用 `tools/check_pnpm_audit_exceptions.py` 核验现有的 2 项 high 例外，例外检查通过。
- Node 24.19.0 和 pnpm 9.15.9 下，`pnpm --dir frontend install --frozen-lockfile`、`make test-frontend` 中的 lint 和 typecheck 步骤、`pnpm --dir frontend build` 通过。两 worker 下复跑 `pnpm --dir frontend test:run --maxWorkers=2 --minWorkers=1` 和 `make test-frontend-critical`，分别通过 422 个文件的 3,595 项测试及 154 个文件的 1,994 项测试。首次高并发运行曾有超时和断言失败。
- 运行 `.github/workflows/backend-ci.yml` 列出的部署脚本检查及 Compose simple mode 环境测试，全部通过。Python 3.12 下，`python -m unittest discover -s .github/release-tools -p test_release_matrix.py` 的 10 项测试及 `bash -n .github/release-tools/release-images.sh` 通过。后端 `go test -tags embed ./internal/web` 和 `go build -tags embed` 通过，产物版本回读为 `0.2.26`。
