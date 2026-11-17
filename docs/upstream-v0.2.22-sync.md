# v0.2.22 同步与升级核验

## 同步基线

- 上游正式发布 [v0.2.22](https://github.com/Wei-Shaw/sub2api/releases/tag/v0.2.22)，源码 commit `b0fa9f3e6eeab1968a53e1289b69daa4bb40ca2b`。
- Fork 基线 `78f3aa33d6bad00dc4ed288ed0cf02c43533a4c0`，包含 v0.2.21、OpenAI 积分调度修复、Go 1.27.4 和 Redis 刷新令牌轮转恢复修复。
- 在独立 worktree 普通合并正式标签。将标签里滞后的 VERSION 从 `0.2.21` 校正到 `0.2.22`。

## 升级行为

- OpenAI 和 Composite 分组新增强制 Ultra Fast。对支持的模型，分组强制 Ultra Fast 优先于分组强制 Fast 和客户端档位。OpenAI 透传账号可选按模型白名单参与调度。
- Gemini Vertex 新增 us/eu 区域端点。区域请求默认模型价乘以 1.1，分组和渠道自定义价格沿用配置。支持 Gemini 4 Carbon，补齐 Gemini 4 Hydrogen 计费。
- 同步按用户合并扣费、调度快照加载合并和分组日汇总非阻塞重建，以及 OpenAI 兼容流、Gemini 工具调用、刷新用量和退款修复。
- `concurrency.ping_interval` 默认仍为 10 秒，可设置为 0 关闭等待期间的 SSE ping。

## 合并适配

- 保留本地积分逐窗口豁免、首输出期限、SSE 队列预算、WS 下游保活、S3 流式上传和部署配置，以及 Go 1.27.4 的所有构建入口和共享安全扫描门禁。
- 保留分组用量日期函数的显式时区参数，接入上游夏令时零点处理。新增圣保罗跳过零点的回归，覆盖日期解析、当日起点与前日起点。
- 保留 CI 的版本校验、编译缓存及集成测试包登记。将分组强制档位、渠道 Bedrock 兼容和国内供应商额度显示的回归纳入前端关键测试。

## 数据库迁移

- `251_group_force_openai_ultrafast.sql` 为分组新增默认关闭的 `force_openai_ultrafast`。
- `251_group_usage_rollup_nonblocking_build.sql` 为分组用量汇总登记保留期下界和重建进度，更新用量记录的失效触发器。
- 迁移按完整文件名排序和记录。两个上游文件均保留原名；生产迁移随应用启动执行。

## 本地验证

- Go 1.27.4 下后端单元测试 60 个包通过，PostgreSQL 18 / Redis 集成测试 4 个包通过。圣保罗夏令时回归在合并前日期实现上复现 UTC 起点偏差一小时，接入上游算法后通过。
- 完整 service 竞态检测通过，用时 272.797s。
- golangci-lint 2.14.0 报告 0 项问题。go mod verify 全部通过，govulncheck v1.9.0 报告代码受影响漏洞为 0，漏洞库索引时间为 `2026-11-11 02:51:11 UTC`。
- Node 24.19.0 与 pnpm 9.15.9 下冻结安装、lint、typecheck、全量 3,155 项测试、CI 清单 1,588 项测试和前端生产构建通过。生产依赖审计通过，沿用 2 项已有的 high 例外。
- 版本完整性、集成测试包登记、Compose 环境变量 / 安全 / 资源配置、部署脚本、Caddy 验证及 release matrix 的 10 项测试通过。
- 含前端资源的后端发行构建与 embed 测试通过。直接运行及发行二进制均回读版本 `0.2.22`，发行构建使用 Go 1.27.4。

## 主分支竞态修复

- [PR #88](https://github.com/zc0982/211api/pull/88) 的 CI 和安全扫描通过。合并后，[主分支竞态检测](https://github.com/zc0982/211api/actions/runs/44018142747/job/133820997532) 发现清理与分组日界测试改写 `time.Local` 时，内容审计 worker 并发调用 `time.Now()`。部署在 CI 门禁处停止，生产仍运行 `0.2.21`。
- 将三个需要全局时区的测试放入独立进程，保留日志保留期、跳过零点和重复零点的业务断言。
