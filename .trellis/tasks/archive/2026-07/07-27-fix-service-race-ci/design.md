# Technical Design

## Boundaries

本变更仅涉及三类边界：`internal/service` 测试代码、backend Makefile 测试入口、GitHub Actions 聚合门禁。生产服务接口、数据库、HTTP 合同和前端均不变。

## Test Package Initialization

新增 `backend/internal/service/main_test.go`（`package service`），在 `TestMain` 进入任何测试前执行一次：

```go
func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	m.Run()
}
```

Go 测试包装器会在 `TestMain` 返回后使用 `m.Run()` 的结果退出，因此不额外引入 `os.Exit`。`service_test` 外部测试会链接进同一测试二进制，当前其中没有额外模式切换。

随后机械删除 `backend/internal/service/**/*_test.go` 中其余 `gin.SetMode(gin.TestMode)`，并整理仅因此变为未使用的 imports。所有调用设置值相同，仓库内没有该包测试对 DebugMode/ReleaseMode 或 `gin.Mode()` 的断言，因此集中初始化不改变预期行为。

## Stub Synchronization

先修已知的 `dashboardRepoStub.recomputeCalls`：用 `atomic.Int32` 保存，写入路径调用 `Add(1)`，Eventually 读取路径调用 `Load()`。

之后运行完整 race 目标。对新增暴露的报告按直接访问帧处理：

- scalar counter/flag：atomic；
- slice/map/复合字段：stub 内部 mutex + accessor；
- 完成事件：优先 channel；
- 不允许只给写端加锁、读端仍直接访问字段。

若报告双方均为生产代码直接访问，则停止扩张实现，回到规划阶段评估，而不是把生产修复混入测试清理。

## Makefile Contract

将 `test-race-service` 加入 `.PHONY`，目标固定为：

```make
go test -tags=unit -race -count=1 ./internal/service
```

`-count=1` 禁用测试结果缓存；目标名称明确表达当前治理范围，避免误导为全 backend race-clean。

## CI Data Flow

```text
changes.backend
      |
      +--> test / golangci-lint
      |
      +--> race-service
             if push && main && backend changed
                    |
                    v
ci-ok needs [..., race-service]
      |
      +--> success/skipped: pass
      +--> failure/cancelled: fail
                    |
                    v
deploy wait-ci gate
```

`race-service` 使用 setup-go、Go 版本校验和独立 `gobuild-race` cache key；设置合理 job timeout。PR 上 job skipped，现有 `ci-ok` 聚合逻辑接受 skipped，因此不会增加 PR 阻塞时间。

## Compatibility and Rollback

- 测试初始化行为与现有 679 次调用一致，均为 `gin.TestMode`。
- CI 新 job 只影响 backend `main` push；失败会延迟部署，这是预期保护。
- 回滚可按层独立进行：CI job/Makefile、TestMain 集中化、stub 同步；但启用 CI 前必须先保证完整 race 目标为绿。
