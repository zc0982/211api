## Why

同步上游 `v0.1.179` 时，正式 tag 中的 `backend/cmd/server/VERSION` 仍为 `0.1.178`。tag 构建可由 exact tag 得到正确版本，但未打 tag 的 `main` Docker 构建回退读取 VERSION，导致新代码上线后仍向前端和管理接口报告旧版本。随后，backend service race 检查只在合入 `main` 后运行，PR 阶段没有发现并行测试写 Antigravity 进程级全局状态的数据竞争；合并后的 `ci-ok` 因 race 失败，Deploy 因而未执行。

这两个缺口都属于“交付声明与实际门禁不一致”：同步目标没有约束 main 的版本元数据，PR 门禁也不等价于生产部署前门禁。需要把事故结论固化为正式、可执行的交付完整性契约。

## What Changes

- 新增正式 tag 同步契约：使用 `sync/upstream-X.Y.Z`，并把 VERSION 规范化为目标 tag 版本，不盲信 tag 内文件或移动的 `upstream/main`。
- 新增可复用 VERSION 一致性脚本及正反向测试，在 backend CI 的快速阶段执行。
- 让 backend PR 与 main push 都运行同一个 service race suite，并继续由 `ci-ok` 聚合。
- 规定并行 Go 测试不得写未同步的进程级全局状态，优先使用参数或依赖注入。
- 将 main commit 的 VERSION 显式传给 Docker build，并在部署健康后核对运行中 SHA 容器的 `--version`。
- 更新上游同步、PR 检查和并行测试运行手册。

## Capabilities

### New Capabilities

- `release-delivery-integrity`: 定义正式 tag 同步、版本声明/传播、PR 与 main race 等价门禁、并行测试隔离以及同 SHA 部署验证。

### Modified Capabilities

无。仓库当前没有已发布的 release/deployment capability。

## Impact

- **规范**：新增独立 OpenSpec change，不修改 prompt-audit 规格。
- **CI**：backend PR 增加完整 `internal/service` race 检查；同步分支 VERSION 错配会在普通测试前失败。
- **构建/部署**：main Docker 构建显式注入 VERSION；健康检查后增加运行中二进制版本断言。
- **开发流程**：同步上游改为按正式 tag 和语义化版本命名，PR 清单增加版本、race 与 runtime 版本检查。
- **兼容性**：不改变 API envelope、版本字段来源、Dockerfile 的本地 fallback 或 Deploy 的同 SHA `ci-ok` 等待关系。
