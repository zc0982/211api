## Context

### 事故链

版本传播链为：

```text
sync target/tag
  -> backend/cmd/server/VERSION (main/source fallback)
  -> backend/scripts/resolve-version.sh
  -> Docker/Makefile ldflags main.Version
  -> shared BuildInfo
  -> /api/v1/settings/public version + admin current_version
```

`resolve-version.sh` 在 exact tag checkout 上优先取 tag，但 `main` 没有 exact tag，生产 Docker build 会读取 VERSION。上游 `v0.1.179` tag 中该文件仍是 `0.1.178`，所以按 tag 合并代码并不自动保证 main 的发布元数据正确。

CI 链为：

```text
backend PR -> unit/integration/lint -> merge main
main push -> race-service -> ci-ok -> Deploy wait-ci -> image -> production
```

旧条件把 race 限定为 main push，导致 PR 可合并但同一代码随后无法通过部署门禁。实际 race 来自一个 `t.Parallel()` 测试暂时改写包级 Antigravity Base URL/availability；cleanup 恢复不能保护与其他并行测试重叠的读写。

## Goals / Non-Goals

**Goals:**

- 让同步目标版本、main VERSION、构建版本和运行中版本可自动追踪且一致。
- 让 backend PR 在合并前执行与 main 相同的 service race suite。
- 把并行测试共享状态规则写成明确可评审的工程契约。
- 保持 Deploy 只消费同一 main SHA 的成功 `ci-ok`，并增加运行中版本反馈信号。

**Non-Goals:**

- 不自动选择“最新”上游 release，也不自动合并或解决冲突。
- 不改版本 API envelope、前端展示逻辑或在线更新服务。
- 不把全部 Go 包都纳入 race；本 change 固定并前移现有 service suite。
- 不让部署 workflow 自动修改或提交 VERSION。
- 不改变 release workflow 的 tag 产物生成机制。

## Decisions

### 1. 正式 tag 是同步目标，VERSION 是 main 的声明事实

同步人员先选择并验证一个解析为 commit 的正式 `vX.Y.Z` tag，再从 main 创建 `sync/upstream-X.Y.Z` 并合并该 tag。移动的 `upstream/main` 不能替代目标版本，日期分支也不能表达所交付 release。

合并后无论 tag 内原值是什么，`backend/cmd/server/VERSION` 都必须为 canonical `X.Y.Z`。exact-tag 优先解析只服务 tag build；它不能掩盖即将进入 main 的 stale fallback。

### 2. 一个 POSIX 脚本同时服务本地、CI 和 Deploy

`backend/scripts/verify-version.sh` 负责：

- 校验 VERSION 恰好一行且为 canonical release semver。
- 接受 `--expected vX.Y.Z|X.Y.Z` 并归一前缀。
- 在 `sync/upstream-X.Y.Z` 上自动从 branch/GitHub PR head 推导 expected。
- 在其他分支只验证当前 commit 的 VERSION 声明有效。

fixture 通过 `--version-file`/`--branch` 驱动同一生产脚本，避免测试复制解析算法。`resolve-version.sh` 保持不变，因为它解决构建时选择，verify 脚本解决合并时声明完整性。

### 3. PR 和 main 使用同一个独立 race job

`race-service` 保持独立 job、专用缓存、30 分钟 timeout 和 `make test-race-service`，但条件只依赖 backend path filter。这样 PR 是合并前首检，main 是 Deploy 前同 SHA 复验；两处不会因命令漂移产生不同结果。

不把 race 合并进 unit job，便于定位失败、独立缓存和 required-check 聚合。`ci-ok` 继续把 success/skipped 作为合法结果，但 backend 改动时 race 不会 skipped。

### 4. 并行测试隔离共享 mutable state

调用 `t.Parallel()` 的测试从调用后到所有测试 goroutine 退出期间，不得写包级 slice、singleton、缓存、默认 client、环境代理或其他进程级 mutable state，除非读写由测试和生产路径共同使用的正确同步机制保护。

首选把值放入 request/loop params、service 实例或注入接口；本次 `antigravityRetryLoopParams.baseURL` 是参考模式。`t.Cleanup` 只负责恢复，不提供并发隔离。无法注入时必须取消并行，并在恢复前等待所启动 goroutine 完全退出。

### 5. CI 显式注入版本，部署后检查实际容器

Deploy checkout 后先运行 verify 脚本并读取 VERSION，将它作为 Docker `VERSION` build arg、`${{ github.sha }}` 作为 `COMMIT` 传入。Dockerfile fallback 保留供本地/其他构建使用，但生产 CI 不再隐式依赖 fallback。

远端继续校验 SHA image digest、Compose health；随后在 Compose 的 `sub2api` 运行容器中执行 `/app/sub2api --version`，解析 `Sub2API X.Y.Z` 并与 expected 比较。检查失败使 Deploy 失败并输出容器状态/有界日志，不能宣称成功。

### 6. 同 SHA CI 门禁保持不变

push-main Deploy 仍通过 `wait-on-check-action` 等待 `ref=${{ github.sha }}` 的 `ci-ok`。workflow_dispatch 沿用现有显式放行语义；它仍会执行 VERSION/build/runtime 检查，但不会伪造一个不存在的 CI run。

## Risks / Trade-offs

- **PR 等待时间增加**：完整 service race 约数分钟，但这是在 merge 前发现会阻断生产的同一问题，不能以速度换掉门禁。
- **VERSION 在多个上游 release 相同代码时需人工规范化**：脚本给出 expected/actual，修复是一行明确改动，不自动篡改 PR。
- **部署后版本不匹配时容器已经重建**：检查会明确失败并阻止成功结论；构建前 VERSION 门禁和显式 build arg 使该情况只可能来自镜像/Compose 选择异常。
- **分支命名参与契约**：仅 `sync/upstream-X.Y.Z` 触发目标比较，普通功能分支不会被错误绑定到 release。

## Rollback

- CI 规则可回退到前一 workflow，但这会重新打开已知 merge-after-race 缺口，不建议作为配额优化手段。
- 部署版本断言失败时先保留 SHA/digest/输出调查，不修改 VERSION 规避；可按现有生产回滚流程恢复上一镜像。
- 新脚本和 OpenSpec 不改变数据库、API 或运行时状态，回退无需数据迁移。
