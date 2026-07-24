# 优化自建 Gitea CI/CD 性能

## Goal

在不削弱现有测试、安全和发布门禁的前提下，缩短自建 Gitea Actions 从提交到反馈、从 `main` 推送到部署完成的时间，并降低 Runner 的重复计算、网络下载、磁盘写入和 OOM 风险。

## Background and Confirmed Facts

- 当前实例使用 Gitea `1.26.4` 与 Gitea Runner `2.1.0`，Runner 通过隔离的 rootless DinD 执行仓库作业。
- `.gitea/workflows/ci.yml:3` 与 `.gitea/workflows/security.yml:3` 同时监听 `push` 和 `pull_request`；内部 PR 更新时，同一提交可能产生两套验证。
- `.gitea/workflows/deploy.yml:3` 在 `main` 推送时再次执行单元测试、集成测试、前端检查、lint、Shell 语法和两项安全扫描；这些检查也会被 `ci.yml` 与 `security.yml` 触发。
- 一个 `main` 推送当前会创建 19 个 Job，其中 14 个是两套相同的 7 项重型验证。
- `deploy/gitea/runner/config.yaml:6` 将 Runner 容量固定为 `1`，因此同一 Runner 上的 Job 串行执行。
- `deploy/gitea/runner/config.yaml:16` 关闭 Runner cache；`tools/gitea-ci.sh` 每次重新准备 pnpm、安装前端依赖，并从源码安装 `golangci-lint` 与 `govulncheck`。
- `deploy/gitea/README.md:271` 记录了真实冷启动资源证据：单个 Go 工作负载峰值超过 5 GiB，DinD 上限已提高到 6 GiB，Runner 必须继续保持容量 1，除非新增独立算力并重新完成资源验证。
- 主分支保护与运维校验把必需状态固定为 `ci / required (push)` 和 `security / required (push)`；优化不能意外丢失或绕过这些状态。
- 历史设计把 `pull_request` 执行用于额外兼容性 smoke，但实际分支保护消费的是源分支提交产生的两个 `(push)` 状态；因此 PR 事件不是合并门禁的权威执行来源。
- Gitea 官方文档确认 Runner 支持 `actions/cache`，但容器化 Runner 必须让作业容器可达缓存服务。当前双层 rootless DinD 不能直接暴露宿主 Docker socket 或未经验证的 TCP 端口。

## Scope Decision

- 本任务仅优化现有单机 Runner，不新增、不迁移独立 Runner 主机，也不增加云主机成本。
- Runner 继续保持 `capacity: 1`、rootless DinD 和当前 6 GiB 内存上限；性能收益必须来自消除重复、调整串行 Job 边界、复用安全缓存和减少冷启动。
- 合并前验证以源分支 `push` 为唯一权威事件；不在受信 Runner 上执行 `pull_request` 工作流。内部 PR 复用源分支 push 状态，外部 fork 不调度该 Runner。

## Requirements

### R1. 消除重复执行

- 每个提交只执行满足其事件语义所需的一套 CI 与安全验证。
- `main` 部署必须在同一提交的完整验证成功后开始，但不得因为三个工作流同时触发而重复运行相同检查。
- 源分支 push 保留 `ci / required (push)` 和 `security / required (push)` 两个真实门禁；`main` push 只进入自包含的部署工作流。
- 保留 release 请求、受保护 tag、定时安全扫描和部署通知的现有语义。

### R2. 优化单 Runner 串行流水线

- 依据 `capacity: 1` 的事实优化 Job 边界，减少重复 checkout、容器启动、依赖准备和相同工具链冷启动。
- 不通过在现有 6 GiB DinD 上盲目提高并发来换取速度。
- 快速失败检查应优先执行，同时保留可定位的失败输出。
- 目标 Job 图为：普通源分支 push 共 4 个 Job（CI 2 + Security 2），`main` push 共 4 个 Job（验证 2 + 构建部署 1 + 通知 1）。

### R3. 引入安全且可失效的缓存

- 为 Go module/build cache、pnpm store、固定版本 CI 工具和 Docker BuildKit 层选择适合的缓存机制。
- 缓存 key 必须绑定锁文件、工具版本、平台及会影响产物的配置，允许确定性失效。
- 缓存不得跨越现有信任边界、暴露宿主 Docker socket、对公网开放缓存端口或让不受信输入污染发布镜像。
- 缓存损坏或未命中时，流水线必须能够回退到正确的冷构建。
- 缓存容量必须有自动软上限和明确的停机清空路径；不得依赖无界增长的持久目录。

### R4. 保持安全、发布与回滚不变量

- 保留 digest 锁定的基础镜像和 Actions、rootless DinD、非特权 Runner、受保护分支/tag、拆分 PAT、不可变 SHA 镜像与 Gateway 部署校验。
- 不删除单元、集成、前端、lint、Shell 和依赖漏洞门禁，也不把失败改为软失败。
- `ci / required (push)` 与 `security / required (push)` 不迁移；仓库保护模板、校验脚本与测试必须证明它们保持原值。

### R5. 可测量与可运维

- 记录优化前后的事件到 Job 图、重型检查次数、冷/热缓存行为和代表性端到端耗时。
- 为缓存容量、命中/未命中、清理策略、Runner 磁盘和内存压力提供有界的运维说明。
- 改动必须包含本地静态验证、仓库测试和需要在真实 Gitea Runner 上完成的上线门禁。

## Acceptance Criteria

- [x] AC1：`main` 推送中的七项重型验证各执行且只执行一次，完整验证失败时不构建、不发布、不部署。
- [x] AC2：内部 PR 的同一提交只通过源分支 push 执行 4 个 Job；打开或更新 PR 不再追加重型工作流。外部 fork 不获得受信 Runner、cache 或 secrets，且不能伪造必需 push 状态。
- [x] AC3：代表性 `main` 事件从 19 个 Job 降为 4 个 Job，七项重型校验从 14 次降为 7 次；失败验证阻止构建部署，通知 Job 仍最终执行。
- [x] AC4：连续两次相同 SHA/锁文件的验证中，第二次明确记录 Go 与 pnpm 精确 `cache-hit=true`；完全清空 Runner cache 后七项检查仍能通过。Docker 构建继续命中适用的既有 BuildKit 层。
- [x] AC5：Runner 保持 `capacity: 1` 与现有 6 GiB DinD 上限，代表性 cold/warm 运行不得出现新增 OOM。
- [x] AC6：`ci / required (push)` 与 `security / required (push)` 继续由真实成功检查产生，名称不能迁移、伪造或缺失。
- [x] AC7：缓存服务和 Docker daemon 均无新增公网监听；Runner 仍不挂载宿主 Docker socket，作业仍在 rootless DinD 内隔离。
- [x] AC8：所有受影响的工作流、Shell、Compose、Runner 配置、仓库控制测试和文档校验通过。
- [x] AC9：设计文档包含上线顺序、缓存预热、观测窗口、失败回滚和恢复到当前串行冷构建路径的方法。
- [x] AC10：Action/cache 持久目录超过 20 GiB 或所在文件系统使用率达到 80% 后，在当前任务结束后的维护阶段被安全清空；目标错误、符号链接或 owner 异常时脚本失败关闭且不删除其他路径。

## Out of Scope

- 修改 211API 业务功能、数据库模型或前后端产品行为。
- 为了提速删除测试、安全扫描、不可变发布或部署健康检查。
- 未经单独授权直接修改线上 Gitea、Runner、Gateway 或云主机状态。
- Gitea/Runner 大版本升级；除非研究证明它是实现已批准目标的必要前置条件，并重新提交范围决策。
