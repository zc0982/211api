## ADDED Requirements

### Requirement: 上游同步必须绑定正式版本并规范化 main 版本声明
系统 SHALL 以一个可解析为 commit 的正式 release tag `vX.Y.Z` 作为每次上游同步的目标。同步分支 MUST 命名为 `sync/upstream-X.Y.Z`，并 MUST 在合并前将 `backend/cmd/server/VERSION` 规范化为同一 canonical `X.Y.Z`；移动的 `upstream/main`、日期分支或 tag 内遗留的 VERSION 值 MUST NOT 替代该目标版本事实。

#### Scenario: 正式 tag 内仍包含上一版本 VERSION
- **WHEN** 同步目标为 `v0.1.179`，但该 tag 中 `backend/cmd/server/VERSION` 为 `0.1.178`
- **THEN** 同步分支 MUST 将 VERSION 改为 `0.1.179`
- **THEN** VERSION 一致性门禁 MUST 在该修改完成前失败，并同时报告 expected 与 actual

#### Scenario: 同步分支版本与 VERSION 一致
- **WHEN** 分支为 `sync/upstream-0.1.179` 且 VERSION 恰好为 canonical `0.1.179`
- **THEN** 版本一致性门禁 MUST 通过

#### Scenario: 同步目标不是正式 semver
- **WHEN** 同步分支缺少 `X.Y.Z`、使用 pre-release/build 后缀或无法映射到正式 tag
- **THEN** 门禁 MUST 拒绝该同步声明
- **THEN** 系统 MUST NOT 通过猜测最新 tag 或读取移动分支来静默修正 expected version

### Requirement: 可合入版本元数据必须是严格且可复用验证的声明
系统 SHALL 提供一个本地和 CI 共用的 POSIX 版本验证入口。VERSION 文件 MUST 恰好包含一行 canonical release semver `X.Y.Z`；显式 expected MAY 接受单个 `v` 前缀并在比较前规范化，但 VERSION 文件自身 MUST NOT 包含前缀、空白行、pre-release、build metadata 或额外内容。

#### Scenario: 普通 backend 功能分支
- **WHEN** 当前分支不是上游同步分支
- **THEN** 门禁 MUST 校验 VERSION 文件的结构与 canonical 格式
- **THEN** 门禁 MUST NOT 将普通功能分支错误绑定到某个上游 release

#### Scenario: 显式 expected 与 actual 不一致
- **WHEN** 调用方指定 expected `v0.1.179` 且 VERSION 为 `0.1.178`
- **THEN** 门禁 MUST 归一 expected 为 `0.1.179` 后非零退出
- **THEN** 失败信息 MUST 包含 expected、actual 和更新 VERSION 的修复方向

#### Scenario: VERSION 文件包含额外内容
- **WHEN** VERSION 为空、包含额外行、带 `v` 或不是正式 `X.Y.Z`
- **THEN** 门禁 MUST 非零退出
- **THEN** 构建或 CI MUST NOT 通过截断、宽松 semver 或默认值把该声明当作有效

### Requirement: 构建、运行时 API 与生产容器必须报告同一版本
系统 SHALL 把当前 main commit 的 VERSION 作为生产 Docker 构建的显式版本输入，并通过现有 ldflags/BuildInfo 传播到运行中二进制、公开设置 `version` 和管理员更新信息 `current_version`。生产部署 MUST 在 digest 与 health 成功后核对运行中 SHA 容器的 `--version`；只有 expected 与 running version 相等时才能成功。

#### Scenario: main commit 构建生产镜像
- **WHEN** Deploy checkout 的 VERSION 为 `0.1.179`
- **THEN** Docker build MUST 显式接收 `VERSION=0.1.179` 和当前 commit SHA
- **THEN** 构建 MUST NOT 依赖该 checkout 是否恰好位于 exact tag 才得到正确生产版本

#### Scenario: 运行中容器版本匹配
- **WHEN** SHA image digest 已校验、Compose 已重建且 `/health` 返回成功
- **THEN** Deploy MUST 在 `sub2api` 服务容器中执行二进制 `--version`
- **THEN** 解析出的版本与 expected 相等时部署 MAY 成功

#### Scenario: 健康但运行版本不匹配
- **WHEN** `/health` 成功但运行中二进制报告的版本与当前 commit VERSION 不同、为空或不可解析
- **THEN** Deploy MUST 失败并输出 expected/running 与有界诊断信息
- **THEN** 系统 MUST NOT 仅凭健康检查把该镜像宣称为成功部署

#### Scenario: 前端和管理员读取版本
- **WHEN** 运行中二进制使用构建版本启动
- **THEN** `/api/v1/settings/public` 的 `version` 与管理员 update/version 响应的 `current_version` MUST 使用同一 BuildInfo 版本
- **THEN** 前端 MUST NOT 使用独立 package 版本覆盖该运行时事实

### Requirement: backend PR 与 main 必须执行等价的 service race 门禁
系统 SHALL 对所有经路径分类为 backend 的 pull request 和 main push 运行同一个 `make test-race-service`。该 job 的失败或取消 MUST 使聚合 `ci-ok` 失败；PR 必须在合并前暴露失败，main 的生产 Deploy 必须在同一 SHA 的 `ci-ok` 成功前保持阻断。

#### Scenario: backend PR 包含数据竞争
- **WHEN** PR 修改 backend 路径且 service race detector 报告 DATA RACE
- **THEN** PR 的 `race-service` MUST 失败
- **THEN** `ci-ok` MUST 失败，PR MUST NOT 满足合并门禁

#### Scenario: backend PR race 通过后合入 main
- **WHEN** backend PR 的同一 suite 通过并产生 main push
- **THEN** main CI MUST 对合入后的 SHA 再运行该 suite
- **THEN** Deploy MUST 等待该 main SHA 的 `ci-ok`，而不是其他 commit 或 PR run 的结果

#### Scenario: 没有 backend 变更
- **WHEN** 路径过滤确定本次 PR/push 没有 backend 变更
- **THEN** race job MAY 被跳过
- **THEN** `ci-ok` MAY 将该显式 skipped 视为可接受，但 MUST NOT 把 backend race failure/cancelled 视为 skipped 或 success

### Requirement: 并行 Go 测试必须隔离进程级可变状态
调用 `t.Parallel()` 的测试及其仍在运行的 goroutine MUST NOT 写入未同步的包级或进程级 mutable state。测试 SHOULD 通过参数、service 实例或依赖接口注入所需值；cleanup 恢复全局值 MUST NOT 被视为并发隔离。只有无法合理注入时，测试才 MAY 取消并行，并 MUST 在恢复状态前等待后台 goroutine 完全退出。

#### Scenario: 测试需要自定义 Antigravity Base URL
- **WHEN** 并行测试需要固定 retry loop 的 Base URL
- **THEN** 测试 MUST 通过 request/loop params 注入 URL
- **THEN** 测试 MUST NOT 暂时改写共享 `BaseURLs` 或 availability singleton

#### Scenario: cleanup 会恢复全局值
- **WHEN** 一个并行测试计划写全局值并使用 `t.Cleanup` 恢复
- **THEN** 该设计 MUST 被视为仍有数据竞争风险
- **THEN** 实现 MUST 改为注入或取消并行并提供完整 goroutine 生命周期边界

#### Scenario: 全局状态有正确同步机制
- **WHEN** 生产和测试路径都通过同一个 mutex/atomic/immutable snapshot 协议访问共享状态
- **THEN** 并行测试 MAY 使用该公开同步接口
- **THEN** race suite MUST 证明并发读写没有 DATA RACE

### Requirement: 生产部署必须保持同 SHA 的 CI 信任链
系统 SHALL 仅在 main push 对应的同一 commit SHA 的 `ci-ok` 成功后执行自动生产部署。Deploy MUST 继续按 SHA tag 绑定镜像并验证 digest；版本断言是该信任链的附加条件，不能替换 unit、integration、lint 或 race 门禁。

#### Scenario: main SHA 的 race 失败
- **WHEN** main commit 的 `race-service` 失败并使 `ci-ok` 失败
- **THEN** Deploy wait-ci MUST 失败
- **THEN** image build/push 与生产 Compose 更新 MUST NOT 执行

#### Scenario: 另一个 SHA 的 CI 成功
- **WHEN** 仓库存在其他 commit 或 PR 的成功 `ci-ok`，但当前 main SHA 尚未成功
- **THEN** Deploy MUST NOT 使用其他 run 作为当前 SHA 的授权

#### Scenario: 手动部署
- **WHEN** workflow_dispatch 的 commit 没有可等待的 CI run
- **THEN** workflow MAY 沿用显式手动放行策略
- **THEN** VERSION 校验、显式 build version、digest、health 和 running version 检查 MUST 仍然执行
