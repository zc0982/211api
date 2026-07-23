# Gitea 单 Runner 性能优化研究

## 研究结论

本任务不需要新增 Runner、提高并发或升级 Gitea。当前瓶颈首先来自事件与
Job 图重复，其次才是每个 Job 的依赖和工具冷启动。最小可行方案是：

1. 让源分支 `push` 成为合并前检查的唯一执行事件，删除受信 Runner 上的
   `pull_request` 执行；现有分支保护本来就要求两个 `(push)` 状态。
2. `main` 只执行 `deploy.yml` 内的一套完整校验，不再同时触发 CI、安全和部署
   三套重叠工作流。
3. 在 `capacity: 1` 下按镜像边界合并 Job，而不是增加并发；Go 与 Node 仍使用
   已锁定的不同镜像。
4. 启用 Runner 2.1.0 内建 cache server，并用 rootless DinD 可达、宿主机不可
   发布的固定私网别名提供服务。
5. 只缓存可重建的依赖/构建数据；缓存失效、损坏或服务不可达时继续走正确的
   冷构建。

## 仓库证据

| 证据 | 结论 |
| --- | --- |
| `.gitea/workflows/ci.yml` | `push` 与 `pull_request` 各创建 6 个 Job。 |
| `.gitea/workflows/security.yml` | `push`、`pull_request` 各创建 3 个 Job，另有周定时任务。 |
| `.gitea/workflows/deploy.yml` | `main` 创建 10 个 Job，其中 7 个校验与 CI/安全工作流重复。 |
| `deploy/gitea/runner/config.yaml` | `capacity: 1`，cache 关闭。 |
| `deploy/gitea/runner/compose.yaml` | Runner 为非特权容器，只有 rootless DinD 特权；DinD 限制 6 GiB、3 CPU，无宿主 Docker socket 和端口发布。 |
| `tools/gitea-ci.sh` | pnpm 在前端测试和审计中分别安装；lint 与 govulncheck 每个 Job 都执行固定版本 `go install`。 |
| `Dockerfile` | pnpm store、Go module 和 Go build 已使用 BuildKit cache mount，且 `docker_data` 持久化；无需再引入外部 Registry cache。 |
| `deploy/gitea/README.md:271` 附近 | 实测单个 Go 工作负载超过 5 GiB，现有 6 GiB DinD 和 `capacity: 1` 是可靠性边界。 |
| `deploy/gitea/admin/*` | 分支保护精确要求 `ci / required (push)` 与 `security / required (push)`。 |
| `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md:242` 附近 | 必需状态来自源分支 push；PR 执行是额外兼容性 smoke，不是分支保护所需状态。 |

当前结构的可计算基线：

- `main` push：`ci` 6 + `security` 3 + `deploy` 10 = 19 个 Job；七项重型校验
  被执行两次，共 14 次。
- 内部 PR 的一次源分支更新：push 9 + pull_request 9 = 18 个 Job。
- Runner 容量为 1，所以这些 Job 在同一算力上串行竞争；拆成更多 Job 不会获得
  并行收益，反而重复 checkout、容器创建和依赖准备。

## Runner 2.1.0 配置证据

从仓库锁定镜像
`gitea/runner:2.1.0@sha256:b1d3cb21a98fcfc3e6f242e847136045cf1972b943f09805fb607f94b1dedc0d`
执行 `gitea-runner generate-config` 后确认：

- 内建 cache server 默认能力包含 `enabled`、`dir`、`host`、`port`、
  `external_server`、`external_secret` 与 `offline_mode`。
- 容器化 Runner 需要显式设置作业容器可达的 `cache.host` 和固定端口；自动探测
  可能选择作业网络不可达的地址。
- `offline_mode: true` 会复用已经获取的 Action，因此只有全部 Action 都使用完整
  commit SHA 时才安全。
- Runner 2.1.0 支持 `runner.post_task_script` 和有界超时，可在每个任务完成、内建
  清理之后执行短小的缓存维护脚本。

官方参考：

- <https://docs.gitea.com/usage/actions/act-runner>
- <https://docs.gitea.com/usage/actions/actions-variables>
- <https://docs.gitea.com/usage/actions/comparison>

Context7 先解析了 Gitea Runner 库 ID，再查询容器化 Runner 缓存语义。当前 CLI
不支持 `--research` 参数，因此没有把不支持的重试结果当作证据。

## rootless DinD 网络实验

使用唯一命名、可自动清理的临时 Docker 网络完成了本地实验：

1. 在外层网络启动一个带 `cache-endpoint` 别名的只读 HTTP 端点。
2. 在同一外层网络启动锁定的 rootless DinD。
3. 通过该 DinD 启动一个 UID 65534、只读根文件系统、无 capability 的内层
   Alpine 作业容器。
4. 内层容器成功解析 `cache-endpoint`，并通过其外层地址访问 HTTP 端点。

结果为 `numeric_reachable=true`。这证明当前双层网络下可以将 Runner 服务别名
`gitea-runner-cache` 广告给内层作业，无需 `ports`、宿主网络、静态 IP 或 Docker
TCP API。所有实验容器、网络和卷均已清理。仓库仍需保留一个可重复 smoke，并在
真实 Gitea Job 中验证 Runner 自己的 cache API。

## Action 选择

GitHub 官方 `actions/cache` 的当前 v4 tag 中，`v4.3.0` 对应完整 commit：

```text
0057852bfaa89a56745cba8c7296529d2fc39830
```

其 `action.yml` 使用 Node 20，入口为 restore，成功后的 post 步骤负责 save，输出
`cache-hit`，且支持 cache service v2。实现时必须用完整 SHA 并加入
`.gitea/actions.lock`；不得写浮动 tag。Gitea 对该 Action 的 `post-if: success()`、
步骤输出与容错语义仍属于真实 Runner 上线门禁，不能仅凭 GitHub 兼容性假设通过。

## 缓存边界

建议缓存：

| 类型 | 路径 | Key 输入 |
| --- | --- | --- |
| Go modules/build | `/go/pkg/mod`、`/root/.cache/go-build` | cache schema、Linux/AMD64、`backend/go.mod`、`backend/go.sum`、`backend/.golangci.yml`、锁定镜像/工具版本、CI dispatcher |
| pnpm/Corepack | `/root/.local/share/pnpm/store`、显式 `COREPACK_HOME` | cache schema、Linux/AMD64、`frontend/package.json`、`frontend/pnpm-lock.yaml`、锁定 Node/pnpm 版本、CI dispatcher |
| Docker build | 现有 `docker_data` 中的 BuildKit cache | Dockerfile 的现有 cache mount 和内容寻址规则；本任务不新建外部 cache |
| Action clone | Runner `offline_mode` | 只允许 `.gitea/actions.lock` 中的完整 SHA |

不缓存：工作区、`node_modules`、测试输出、PAT/SSH key、Docker 登录配置、Action
runtime token、临时 `GOBIN` 或预编译 lint/vulnerability 二进制。固定 Go 工具继续从
精确 module version 构建，但会命中 module/build cache。

Key 不使用前缀恢复，不跨不同锁文件模糊回退。外部 fork 不触发任何受信 Runner
工作流，因此不能读写缓存；内部分支保持当前私有仓库信任边界。缓存只影响性能，
不影响正确性或发布授权。

## 有界维护

Runner cache 使用持久卷中的显式目录 `/data/cache/actions`。每个任务完成后由
`post_task_script` 检查：

- cache 超过 20 GiB；或
- cache 所在文件系统使用率达到 80%。

任一条件满足时，脚本只清空该 cache 目录的子项，保留根目录，并记录清理前后
大小。完整清空比猜测 Runner 内部条目格式更安全，且下次任务自动冷构建。脚本
必须拒绝符号链接、错误 owner 或非精确目标路径，超时不超过 2 分钟。目标路径
不可覆盖；测试只在一次性容器中降低数值阈值，并仍挂载到精确目标路径。

BuildKit 数据沿用现有 `docker_data` 和宿主磁盘监控；它不是本任务新增的数据面。
运维文档仍要记录 `docker system df`/builder 使用量和在 Runner 停止状态下的人工
清理、回滚步骤。

## 仍需真实环境证明的兼容性

以下项目不能由静态研究替代：

- `push.branches-ignore: [main]` 在 Gitea 1.26.4 中只调度预期的源分支 push，且
  tag 仍只由 `release.yml` 处理。
- 删除 `pull_request` 触发后，内部 PR 仍读取源分支 push 的两个精确必需状态；
  外部 fork 既不调度 Runner，也无法满足这两个状态。
- `actions/cache@005785...` 能通过 Runner 2.1.0 的内建 cache API 完成 cold save、
  同 SHA rerun restore，并正确给出 `cache-hit=true`。
- cache 服务不可达、缓存目录为空或缓存被清空时，检查仍能冷构建成功。
- cache endpoint 无宿主/公网端口，内层 Job 只通过 `gitea-runner-cache:8088` 访问。
- Job 数、上下文名、失败传播、6 GiB cgroup 峰值和部署阻断语义与设计一致。

## 排除的方案

- 新 Runner/新主机：用户明确排除。
- 在当前 6 GiB DinD 上提高 `capacity`：与真实 OOM 证据冲突。
- 让 deploy 等待另一个 workflow：Gitea 跨工作流顺序和状态关联不够可靠，且会
  削弱 main 提交的自包含校验。
- 为 PR 保留轻量 Runner Job：即使不 checkout，也会把外部 PR 调度到受信 Runner；
  删除 PR 触发的边界更清晰。
- 对公网或宿主发布 cache 端口、挂载宿主 Docker socket：违反现有隔离合同。
- 缓存 `node_modules` 或固定工具二进制：收益与可移植/投毒风险不成比例。
- 新建 Registry cache：现有持久 BuildKit cache 已覆盖镜像构建，复杂度没有对应
  的首要瓶颈证据。
