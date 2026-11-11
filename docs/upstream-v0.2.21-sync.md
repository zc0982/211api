# v0.2.21 同步与积分调度修复

## 基线与合并

- Fork 基线：`7878a6ac349c02bbb1690bb6d51be45b9a3752c1`，生产只读核对也运行该镜像。
- 上游正式标签：[v0.2.21](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.21)，源码 commit `10ba8f9b4dc2e6023d4a9879ab77b21841babd10`。
- 独立 worktree 普通合并正式标签；VERSION 从标签内的旧值校正为 `0.2.21`，不合并移动的 upstream/main。
- 唯一冲突在 tool schema 分配复杂度测试：接入上游独立进程隔离，并保留本地 race 模式仅验证转换结果、非 race 执行分配上限的规则。
- 保留本地 CI、部署、429 积分优先级、WebSocket 保活及 SSE 队列预算；上游模型级过载冷却逻辑与本地积分处理同时保留。

## 本次故障与修复

生产账号 597 的周用量为 99%、自动重置卡阈值为 99%、重置卡为 0，同时存在新鲜的正积分余额。原实现仅在窗口达到 100% 时豁免自动用卡等待，因此 99% 时仍被排除。只读核对的全局普通 5h/7d 停调阈值均为 0、OpenAI 管理员调度阈值为 100%，该账号没有独立覆盖。其他 OpenAI OAuth 账号均为手动不可调度，导致账号池没有可用候选。

自动用卡等待改为基于有效可消费积分豁免，不再要求窗口耗尽；独立管理员停调阈值继续逐窗口判断。共享调度函数覆盖 legacy、高级调度和 WebSocket 续接。规则见 [积分调度规范](spec/openai-credits-scheduling.md)。

## 上游行为与迁移

- 同步请求体内存预算自适应、OpenAI 缓存写入 TTL 计费、模型目录、SSE/WS 错误恢复和页面性能改进。
- 新增 `249_add_usage_logs_api_key_cost_index_notx.sql`：为 API Key 用量统计创建并发覆盖索引，表大时首次迁移可能耗时。
- 新增 `250_openai_cache_write_ttl.sql`：新增 30m/12h 缓存写入 token 字段，以及四类价卡的 12h 价格字段。仅移除上游文件末尾多余空行以通过 diff whitespace 门禁，SQL 不变。
- 现有 `249_mcp_oauth.sql` 保留；迁移按完整文件名识别。仅同步迁移文件，未执行生产迁移或生产配置写入。

## 验证

修复前新增回归在 5h/7d、各重置卡状态下稳定失败，原因均为 `quota_auto_reset_pending_*`。定向复验已通过。

已通过前端 lint/typecheck、385 个文件的 3,122 项测试和生产构建；后端 Go 1.27.3 + golangci-lint 2.14.0 检查为 0 issues，含前端资源的 release 二进制版本回读为 0.2.21，embed 测试通过。

PostgreSQL/Redis 集成测试 4 个包通过。首次运行因 testcontainers 未发现本机 Colima socket 失败；显式指定 `DOCKER_HOST` 和容器侧 socket 后实际执行通过，未跳过。测试容器已自动清理。

版本完整性、integration 包登记、部署脚本、Compose 环境/安全/资源配置、Caddy 缓存及 10 项 release matrix 测试通过。Compose 使用临时适配器调用本机独立 docker-compose，release matrix 的 PyYAML 安装在临时 venv，未改项目依赖。

首次本地安全检查在当时取得的漏洞库索引下显示代码受影响漏洞为 0，`go mod verify` 全部通过；pnpm 生产依赖 high/critical 门禁沿用现有审计例外通过，无新增豁免。随后 PR 安全扫描发现新发布的 Go 标准库漏洞，首次本地结果不能代表当前安全门禁，见下文。

完整后端 unit 60 个包通过，其中 service 用时 175.339 秒；完整 service race 通过，用时 280.435 秒，无 DATA RACE。

初次交付时 origin/main 祖先检查与净 diff/whitespace 检查通过，未包含本地配置。随后已创建 PR #87；未合并到 main、未部署。

## PR #87 后端安全门禁修复

- 旧 head `902bb1885d703d1ee8e77bec3619cc77d75871f8` 的 CI 工作流通过，但 [Security Scan 42952766554](https://github.com/zc0982/211api/actions/runs/42952766554) 在 govulncheck 阶段退出码 3，报告 `GO-2026-6859`：Go 1.27.3 的 net/http HTTP/1 服务崩溃漏洞，修复版本为 1.27.4。
- 本地旧扫描器为 v1.8.0，CI 为 v1.9.0；换用 v1.9.0 后，本地默认漏洞库索引仍显示 2026-11-05，但官方 OSV 条目已于 2026-11-11T02:51:11Z 发布。不能将差异仅归因为扫描器版本。使用官方原始条目的临时定向扫描已在 Go 1.27.3 复现同一漏洞与退出码。
- 将 go.mod、三个 Dockerfile 以及 CI/Release/Security 的所有版本断言统一升级到 Go 1.27.4。补充发布一致性校验，避免 CI 升级而镜像仍使用旧标准库。
- 本地和 CI 改用共享 `make test-security`，每次临时安装最新 govulncheck，打印实际 Go、扫描器和漏洞库时间，并保留扫描失败退出码。不增加漏洞豁免，也不替换 CI 的默认漏洞库。
- Go 1.27.4 下完整 unit 60 个包、PostgreSQL/Redis 集成测试 4 个包、完整 service race（272.409 秒）、lint（0 issues）、含前端资源的发行构建均通过；二进制工具链回读为 Go 1.27.4，应用版本为 0.2.21。发布一致性检查及旧 Docker 镜像/单处旧 CI 断言的反例检查通过，release matrix 10 项测试通过。
- 完整 unit 曾出现计费估算内存守卫读取到约 8.75 MB 的进程堆增量，超过原 8 MiB 上限；同一用例独立执行 3 次通过。现将测量放入独立进程，保留 20,000 次调用、原内存上限及全部业务断言；修改后的完整 unit 与该用例 3 次 race 验证通过。
- 官方原始漏洞条目定向扫描在 Go 1.27.4 下通过。默认漏洞库的本地全量扫描也通过，但索引仍显示 2026-11-05，不能据此宣称新 head CI 安全门禁已通过；PR 检查状态需在推送后回读。


## PR #87 刷新令牌轮转 review 修复

行级评论指出：旧实现原子删除 refresh token 后，如果 Redis 已执行但响应丢失，服务返回 503，客户端重试得到 401。新增故障注入测试先在旧代码复现该路径。

轮转现改为一次 Lua 原子提交后继及撤销索引，并将旧键转为有界回执；后继按用途隔离的 HMAC-SHA256 派生，跨实例和并发重试只取得同一后继。回执最多 30 秒、不超过旧 TTL，重试不延长有效期；后继使用、过期或撤销后回执不可恢复。用户与家族撤销同时改为原子读取/删除，避免漏掉并发生成的后继。恢复读取后继真实元数据并重新验证用户、密码版本和会话指纹。

回执只含后继哈希，避免旧二进制重复兑换，也避免 Lua cjson 重编码损失 int64 精度；旧二进制会把回执视为过期，混跑可能中断短时恢复。无数据库迁移，Redis 不存原始 bearer token。规则和验证边界见 [刷新令牌轮转规范](spec/refresh-token-rotation.md)。

验证：完整后端 unit 60 个包通过；完整 service/repository race 通过（service 269.804 秒），最终回执格式另通过 repository 全量 race（24.341 秒）及定向 service/repository race。真实 Redis 回归与完整集成测试 4 个包通过，lint 为 0 issues；前端既有刷新/5xx 会话保留测试 2 个文件、40 项通过。未合并或部署。
