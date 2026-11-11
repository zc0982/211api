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

安全检查：govulncheck 的代码受影响漏洞为 0，`go mod verify` 全部通过；pnpm 生产依赖 high/critical 门禁沿用现有审计例外通过，无新增豁免。

完整后端 unit 60 个包通过，其中 service 用时 175.339 秒；完整 service race 通过，用时 280.435 秒，无 DATA RACE。

最新 origin/main 祖先检查与净 diff/whitespace 检查通过，未包含本地配置。以上均为本地验证；未推送、未建 PR、未合并到 main、未部署，生产仍运行基线版本。
