# v0.2.23 同步与升级核验

## 同步基线

- 上游正式发布 [Sub2API v0.2.23](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.23)，源码 commit `5af9afb588c4b014b3df9db7d4073af1f8ae01b6`。
- Fork 基线 `bc114fb50c9533e7b789186d44b6e05ca42b920a`，包含 v0.2.22 和分组日界及请求日志清理测试的时区隔离修复。
- 在独立 worktree 普通合并正式标签，将标签内滞后一版的 `VERSION` 校正为 `0.2.23`。

## 升级行为

- 支持 GPT-6.2 Sol 和 Astra 及对应的长上下文计费。GPT-6.2 的 Ultra Fast 在 2027 年 3 月 1 日 00:00（太平洋时间）前按标准价的 3 倍计费，此后为 6 倍。Pro 200 可用 Sol 的 Ultra Fast，Pro 500 可用两款模型的 Ultra Fast。
- 渠道可按模型自定义 Ultra Fast 倍率。留空沿用模型规则，既有 Fast 倍率单独生效。
- Anthropic、Responses 和 Chat Completions 互转时保留 5 分钟与 1 小时缓存写入明细。缓存写入总量大于明细之和时，差额按 5 分钟价格计费。
- OpenAI 原生 Responses 流在首个模型输出前空闲超时可换账号一次，复用现有首输出切换额度。收到上游数据会延后空闲截止时间。原生 Chat Completions 流在下次读取上游及扫描结束时集中刷新。

## 合并适配

- 计费预留内存回归采用上游的独立测试进程，保留无直接查库和缓存内存有界的断言。测试夹具复用实际服务的费率解析器，减少后台活动对内存测量的干扰，并保持被测对象在最终 GC 时可达。
- 保留本地 OpenAI 积分调度与逐窗口豁免、首输出期限、SSE 队列预算、WebSocket 下游保活、S3 流式上传、时区测试隔离及部署配置。
- 在中英文分组提示里补回 `service_tier=ultrafast`，保留上游新增的套餐、回退和计费说明。将该提示及渠道 Ultra Fast 定价的回归加入根 Makefile 的 CI 关键测试清单。

## 数据库迁移

- `252_channel_pricing_ultrafast_multiplier.sql` 随应用启动执行。它为 `channel_model_pricing` 增加可空的 `ultrafast_multiplier`，设值时必须大于 0。既有价格卡保持原有配置，空值沿用模型默认倍率。

## 本地验证

- Go 1.27.4 下，71 个包的单元测试和 PostgreSQL 18.4 / Redis 集成测试的 4 个包通过。单独重跑渠道定价集成回归，验证迁移重复执行保留已配置价格，非法倍率的替换操作保留原价格卡。
- 完整 service 竞态检测通过，用时 291.920 秒。
- golangci-lint 2.14.0 报告 0 项问题。依赖校验通过。govulncheck 1.10.0 在 Go 1.27.4 下报告代码受影响漏洞为 0，漏洞库索引时间为 `2026-11-11 02:51:11 UTC`。
- Node 24.19.0 和 pnpm 9.15.9 下，通过冻结安装、前端 lint、类型检查和生产构建。分组提示回归首次失败，补回参数后，单项回归、CI 清单的 1,596 项测试和全量 3,159 项测试均通过。生产依赖审计沿用 2 项已有的 high 例外。
- 版本完整性、集成测试包登记、Compose 环境变量和安全配置、部署脚本、Caddy 配置及 release matrix 的 10 项测试通过。
- 后端 embed 测试及包含前端资源的发行构建通过。直接构建和发行构建产物均回读版本 `0.2.23`。
