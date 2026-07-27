# 修复 internal/service race 测试并增加 CI 门禁

## Goal

消除 `backend/internal/service` 在 Go race detector 下已观察到的测试数据竞争，使 race 检测成为可重复执行的本地命令，并在 backend 变更合入 `main` 后、自动部署前形成强制门禁。

用户价值：恢复 race detector 对真实并发缺陷的信噪比，避免测试基础设施竞态长期掩盖生产代码回归。

## Background

- 来源：GitHub Issue #27。
- `internal/service` 中有 679 次 `gin.SetMode(gin.TestMode)`，分布在 77 个测试文件；并行测试会并发写 Gin v1.9.1 的包级模式变量。
- `usage_cleanup_service_test.go` 等测试 stub 会被后台 goroutine 写入，并被 `require.Eventually` 的轮询 goroutine无同步读取。
- 当前 Makefile 和 CI 未提供 `-race` 目标。
- 竞态报告数依赖提交和调度；验收以命令完全 race-clean 为准，不绑定 45、38 或其他固定数量。
- 当前观察没有显示双方都直接位于本项目生产代码的竞争，但这不构成对所有生产竞态的排除证明。

## Requirements

- R1：`internal/service` 测试包只允许在包级 `TestMain` 中调用一次 `gin.SetMode(gin.TestMode)`；删除测试函数内的重复调用，不改变各测试的业务断言。
- R2：修复完整 race 运行实际暴露的测试 stub 无同步访问；计数器/布尔值使用 atomic 或等价同步，复合状态使用 mutex 或 channel，所有读取路径与写入路径必须使用同一同步协议。
- R3：在 `backend/Makefile` 增加独立、不可缓存的 `test-race-service` 目标，执行 `go test -tags=unit -race -count=1 ./internal/service`。
- R4：GitHub Actions 增加独立 `race-service` job，仅在 backend 变更的 `main` push 上执行，不阻塞 PR。
- R5：`race-service` 必须加入 `ci-ok.needs`；race 失败必须使 `ci-ok` 失败，从而阻止 #26 建立的自动部署链路继续。
- R6：保留普通单元测试和现有并行化收益，不移除 #25 增加的 `t.Parallel()`，不通过关闭 race detector 或串行化整个测试包规避问题。
- R7：从最新 `origin/main` 创建独立分支和 worktree，保护当前含未提交内容且落后远端的主工作区。

## Out of Scope

- 不承诺本次使 `go test -race ./...` 在整个 backend 范围通过。
- 不修改 Gin 依赖源码或升级 Gin 版本。
- 不重构生产业务逻辑，除非完整 race 运行提供直接且可复现的生产代码竞争证据；若出现该情况，先回到规划阶段评估范围。
- 不修改 PR #25 的并行测试策略。

## Acceptance Criteria

- [x] AC1：`internal/service` 中仅剩包级 `TestMain` 的一次 `gin.SetMode(gin.TestMode)` 调用，且不存在其他模式切换。
- [x] AC2：所有定向竞态回归用例在 `-race` 下通过。
- [x] AC3：`cd backend && make test-race-service` 退出码为 0，输出中没有 `WARNING: DATA RACE`。
- [x] AC4：`cd backend && make test-unit` 通过，无普通单元测试回归。
- [x] AC5：变更的 Go 文件已 `gofmt`/整理 imports，并通过适用的 lint/编译检查。
- [x] AC6：workflow 语法和 job 依赖检查通过；`race-service` 在 PR/非 backend 场景可 skipped，在 backend `main` push 场景执行。
- [x] AC7：`ci-ok.needs` 包含 `race-service`，现有聚合脚本对其 `failure` 结果判失败、对 `skipped` 判通过。
- [x] AC8：变更提交到 `fix/issue-27-service-race-ci`，推送 origin 并创建以 `main` 为 base、正文包含 `Closes #27` 的 PR。

## Constraints

- 不覆盖或提交主工作区现有的 `.gitattributes`、`.agents/`、`.gitnexusignore`、`.trellis/` 用户改动。
- 批量删除 `gin.SetMode` 后必须同步清理未使用的 Gin imports，但不能删除仍用于 context/router 构造的 imports。
- CI race job 使用独立 Go build cache key，避免与普通 test/lint 缓存职责混淆。
