## 1. 固化规范

- [x] 1.1 新增 `release-delivery-integrity` proposal、design、capability spec 和验证矩阵
- [x] 1.2 记录正式 tag、VERSION fallback、runtime BuildInfo 和 Deploy 的完整信任链
- [x] 1.3 明确 `t.Parallel()` 与进程级 mutable state 的隔离规则

## 2. 实现版本一致性门禁

- [x] 2.1 新增 POSIX `backend/scripts/verify-version.sh`，支持显式 expected 与 sync 分支推导
- [x] 2.2 严格校验 canonical `X.Y.Z`，拒绝错配、空值、额外行和非正式 semver
- [x] 2.3 新增脚本正反向测试，覆盖 stale VERSION 与匹配 VERSION
- [x] 2.4 在 `backend/Makefile` 暴露 `test-version-integrity`

## 3. 将门禁前移到 PR

- [x] 3.1 在 backend test job 的 Go 测试前运行版本一致性门禁
- [x] 3.2 让 `race-service` 对所有 backend PR 和 main push 执行同一个 Make target
- [x] 3.3 保留 `ci-ok` 对 race 的聚合和 Deploy 对同一 main SHA 的等待

## 4. 验证运行中部署版本

- [x] 4.1 在 Deploy 读取并验证当前 commit 的 VERSION
- [x] 4.2 把 VERSION 与 commit SHA 显式传给 Docker build
- [x] 4.3 在 digest、Compose 和 health 成功后核对运行中服务容器的 `--version`
- [x] 4.4 新增 workflow 结构回归测试，锁定同 SHA wait-ci、PR race、build args 和运行中检查

## 5. 更新运行手册并验收

- [x] 5.1 更新 `DEV_GUIDE.md` 的正式 tag 同步流程、CI 表格和 PR checklist
- [x] 5.2 记录并行测试全局状态禁令及依赖注入优先规则
- [x] 5.3 运行版本脚本测试、runtime 版本检查、最小 race 复现和完整 service race suite
- [x] 5.4 运行 backend unit、shell 语法和 whitespace 回归；integration 已执行但因外部 TLS 证书不受信且本机 Docker 不可用而失败
- [x] 5.5 使用 OpenSpec CLI 1.10.0 执行 strict validate/status/show；4/4 planning artifacts complete，change valid
