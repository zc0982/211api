# 单机 Gitea Runner 性能优化设计

## 1. 设计目标与边界

在现有 Netcup 单 Runner 上缩短提交反馈与 `main` 部署时间。设计不新增主机、不
提高 Runner 并发、不改变业务测试语义，也不削弱 rootless DinD、分支/tag 保护、
不可变镜像或部署健康检查。

不可变约束：

- Gitea `1.26.4`、Runner `2.1.0`，现阶段不升级。
- Runner `capacity: 1`；DinD 继续限制 6 GiB / 3 CPU，Runner 继续限制
  512 MiB / 0.5 CPU。
- 只有 DinD 是特权容器；无宿主 Docker socket、Docker TCP API、host network、
  host PID 或任意 host-path 数据挂载。
- 分支保护继续精确要求 `ci / required (push)` 与
  `security / required (push)`。
- 七项门禁继续存在：backend unit、backend integration、frontend、lint、Shell
  syntax、backend vulnerability、frontend production dependency audit。

## 2. 总体架构

性能优化按“先消除无价值工作，再复用可重建数据”的顺序实施：

```text
源分支 push
  ├─ ci: backend(Go) ──> required(Node/frontend)       ──> ci / required (push)
  └─ security: backend(Go) ──> required(Node/audit)   ──> security / required (push)

internal PR
  └─ 不创建新 Job；消费同一 head SHA 的两个 push 状态

external fork PR
  └─ 不调度受信 Runner；无 push 状态，不能满足保护规则

main push
  └─ deploy: backend(Go) ──> verify(Node) ──> build_deploy(Docker) ──> notify

所有 Job（capacity=1）
  ├─ checkout/action clone：Runner full-SHA offline cache
  ├─ Go/pnpm：Runner 内建 cache server，经 rootless DinD 私网访问
  └─ Docker build：沿用持久 docker_data 中的 BuildKit cache
```

Go 和 Node 不合成新镜像。现有 Go Actions 镜像中的 Node 24 只用于 JavaScript
Action runtime，前端合同要求 Node 20；因此每个校验工作流保留一个 Go Job 和一个
Node Job。这是当前镜像边界下的最少 Job 数。

## 3. 事件与 Job 合同

| 事件 | Workflow / Job | 执行内容 | Job 数 | 重型检查数 |
| --- | --- | --- | ---: | ---: |
| 非 `main` 分支 push | `ci/backend` → `ci/required`；`security/backend` → `security/required` | 七项门禁各一次 | 4 | 7 |
| `pull_request` | 无 | 复用 head SHA 的 push 状态 | 0 | 0 |
| `main` push | `deploy/backend` → `deploy/verify` → `deploy/build-and-deploy` → `deploy/telegram-notification` | 七项门禁各一次，然后构建/部署/通知 | 4 | 7 |
| 周一定时 | `security/backend` → `security/required` | 两项安全门禁 | 2 | 2 |
| `release/v*` / `v*` | 现有 `release.yml` | 保持现有发布请求/tag 语义 | 不变 | 不变 |

结构性改善：

- `main`：19 → 4 Job（减少 15，约 79%）；重型校验 14 → 7。
- 内部 PR 的一次 head 更新：18 → 4 Job（减少 14，约 78%）。
- 不再为每个检查重复内部 PR guard、checkout 和 Job 容器启动。

### 3.1 触发器

- `ci.yml`：仅 `push.branches-ignore: [main]`。
- `security.yml`：`push.branches-ignore: [main]` 加原有周一定时任务。
- `deploy.yml`：保持 `push.branches: [main]`。
- 不创建 `pull_request` workflow。这样外部 fork 不会获得受信 Runner；内部 PR 的
  head 分支 push 仍产生保护规则所需的两个精确状态。
- `release.yml` 不改触发器。Gitea 1.26.4 对 branch/tag filter 的实际行为必须由
  smoke 分支和临时 tag 负面验证，静态兼容性推断不能替代上线门禁。

### 3.2 `ci.yml`

`backend` 使用 `go-1.26.5`，一次 checkout 和一次 Go cache restore 后，以独立步骤
依次执行：

1. `shell-syntax`（最快失败）；
2. `backend-unit`；
3. `backend-integration`，显式 `GITEA_CI=true`；
4. `lint`。

`required` 使用 `node-20.20.2`，声明 `if: always()` 且依赖 `backend`：

1. 第一条无 checkout 步骤检查 `needs.backend.result == success`；失败时立即失败，
   不继续消耗 Node 依赖准备。
2. backend 成功后 checkout、restore pnpm cache、执行 `frontend`。

Job 名仍为 `required`，因此成功上下文仍是 `ci / required (push)`；它不是空聚合
器，而是真实拥有 frontend 门禁并验证所有前置 Go 门禁。

### 3.3 `security.yml`

`backend` 使用 Go 镜像并执行 `security-backend`。`required` 使用 Node 镜像、
`if: always()`，先验证 backend 结果，再执行 `security-frontend`。Job 名保持
`required`，上下文保持 `security / required (push)`。

定时任务使用同一两 Job 图。安全失败仍为硬失败，并继续进入现有运维可见路径。

### 3.4 `deploy.yml`

`backend` 使用 Go 镜像，一次 checkout/cache 后依次执行 Shell、unit、integration、
lint、backend vulnerability。`verify` 使用 Node 镜像、`if: always()`，先验证
backend 成功，再一次安装前端依赖并连续执行 frontend tests 与 production audit。

`build_deploy` 只依赖 `verify`，沿用当前精确 SHA、main head、防覆盖 Registry tag、
Gateway SSH forced command、健康验证和 `:main` 指针更新合同。`notify` 保持
`if: always()` 并依赖 `verify` 与 `build_deploy`，验证失败或部署失败均得到最终失败
通知。

部署不等待或查询其他 workflow。这样 main 的发布判断继续绑定同一提交、同一
workflow 的原生 `needs` 图，不引入跨 workflow 竞态。

## 4. Dispatcher 与依赖准备

`tools/gitea-ci.sh` 抽取单一前端依赖准备函数：

- 校验 Node 20；
- 使用显式 `COREPACK_HOME=/root/.cache/corepack`；
- 激活锁定的 pnpm `9.15.9`；
- 运行 `pnpm install --frozen-lockfile --prefer-offline`。

保留现有 `frontend` 与 `security-frontend` 子命令，保证开发者和两个独立工作流的
调用不变；新增一个只供 deploy Node Job 使用的组合子命令（实施时命名
`frontend-all`），只安装一次，然后依次执行 frontend tests 和 audit exception
checker。测试与审计仍是两个清晰阶段，任一失败即返回非零。

lint 与 govulncheck 继续通过精确 module version 执行 `go install` 到临时
`GOBIN`。不缓存可执行文件；恢复的 Go module/build cache 会消除主要源码下载和
编译冷启动，同时保留 Go module 校验链。

新增 `tools/gitea-cache-key.sh {go|pnpm}` 作为唯一 key owner。脚本只读取仓库文件，
输出一个无秘密的单行 key；未知类型返回 64。Key 结构：

```text
gitea-<go|pnpm>-linux-amd64-v1-<sha256>
```

摘要输入：

- Go：脚本自身、`tools/gitea-ci.sh`、`deploy/gitea/images.lock.env`、
  `backend/go.mod`、`backend/go.sum`、`backend/.golangci.yml`。
- pnpm：脚本自身、`tools/gitea-ci.sh`、`deploy/gitea/images.lock.env`、
  `frontend/package.json`、`frontend/pnpm-lock.yaml`。

工作流在 checkout 后把 key 写入 `$GITEA_OUTPUT`，随后交给 cache Action。不要配置
`restore-keys`；锁文件或工具输入变化必须得到精确 miss。

## 5. Cache 设计

### 5.1 Runner 内建服务

`deploy/gitea/runner/config.yaml` 使用：

```yaml
runner:
  capacity: 1
  post_task_script: /usr/local/bin/gitea-runner-cache-maintenance
  post_task_script_timeout: 2m

cache:
  enabled: true
  dir: /data/cache/actions
  host: gitea-runner-cache
  port: 8088
  external_server: ""
  external_secret: ""
  offline_mode: true
```

`compose.yaml` 为 runner 在既有 `runner` 私网增加别名
`gitea-runner-cache`，并可声明容器内 `8088` expose；严禁增加 `ports`。内层 Job
通过 rootless DinD DNS/NAT 访问该别名。缓存服务不加入 Gitea platform 网络，
不使用宿主 IP、静态容器 IP或额外凭据。

`offline_mode: true` 只因为所有 `uses:` 均被 `.gitea/actions.lock` 的完整 40 位 SHA
约束。静态测试必须拒绝浮动 Action ref 和 lock/use 漂移。

### 5.2 Cache Action

新增唯一外部 Action：

```text
https://github.com/actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830
```

对应官方 `v4.3.0`，使用 Node 20。每个 Go/Node 校验 Job 在 checkout/key 之后使用
它：

| Job 类型 | 缓存路径 |
| --- | --- |
| Go | `/go/pkg/mod`、`/root/.cache/go-build` |
| Node | `/root/.cache/corepack`、`/root/.local/share/pnpm/store` |

cache 步骤设置 `continue-on-error: true`，并打印结构化
`go-cache-hit=<value>` / `pnpm-cache-hit=<value>` 日志。缓存网络、归档或 post-save
失败不得把正确的检查变成失败或成功；检查始终能从上游 Registry/module source
冷构建。上线 smoke 反过来把 cache hit 当作独立硬门禁，避免长期静默失效。

不缓存 workspace、`node_modules`、临时工具二进制、Docker credential、token、
SSH key、audit 输出或测试产物。外部 fork 不运行 workflow，因此不能读写该 cache。

### 5.3 容量与清理

新增只读挂载到 Runner 的审核脚本
`deploy/gitea/runner/cache-maintenance.sh`。Runner 每个任务完成后以 UID 1000 执行：

1. 只接受硬编码的精确目录 `/data/cache/actions`；目录不得是符号链接，owner 必须
   `1000:1000`。
2. 读取目录大小和文件系统使用率。
3. 大小超过 20 GiB，或文件系统使用率达到 80%，则删除该目录的直接子项，保留
   根目录并记录结果。
4. 路径/owner/统计异常时非零退出且不删除；Runner 记录 warning，后续任务仍可
   冷构建。

目录不可通过参数或环境变量覆盖。为避免单元测试分配 20 GiB 实体数据，脚本只
允许测试进程覆盖数值阈值；测试在一次性容器内仍把唯一临时卷挂到精确
`/data/cache/actions`，生产 Compose 不设置任何阈值覆盖变量。

这是任务结束时执行的软上限：单次上传过程中可能短暂越过阈值，但任务收尾后会
回到空 cache。清空整个 cache 而非猜测内部条目格式，避免留下半条目。

Action clone cache 的条目数由两条 full-SHA lock 约束，默认不自动删除；Action
升级或损坏时，在 Runner 停止后按文档清空对应 Runner action cache。BuildKit
继续位于既有 `docker_data`，通过现有宿主磁盘监控和停机人工 prune 管理。

## 6. Docker Build 优化

不新增 `cache-to/cache-from`：当前 Dockerfile 已对 pnpm store、Go modules 和 Go
build 使用 BuildKit cache mount，rootless DinD 的 `docker_data` 也已持久化。

只收紧 `.dockerignore` 中明确不会被 Dockerfile `COPY` 的仓库元数据和运维目录，
尤其是 `.gitea/`、`.trellis/`、`.agents/`、`.ace-tool/`、`.codex/`、`openspec/`、
`skills/`、`assets/` 以及除 `docker-entrypoint.sh`/必要文档外的 `deploy/*`。保留
`frontend/`、`backend/` 与 `docs/legal/` 的现有构建合同。静态测试/评审要逐条
对照 Dockerfile 的 `COPY` 源，避免错误忽略运行时资源。

## 7. 安全与兼容性

### 7.1 保持的不变量

- Runner 与所有 job image/version/digest 锁保持不变。
- `capacity: 1`、6 GiB DinD、`GOFLAGS=-p=1` 和 lint 的
  `GOMAXPROCS=1` 保持不变。
- cache 和 Docker daemon 均不发布端口；Runner 仍无宿主 socket/路径数据挂载。
- required context 名不变，因此 admin branch-protection template 不迁移；测试要
  明确证明它们仍是原值。
- deploy/release 的 PAT、SSH、Registry、不可变 tag/digest 和通知语义不变。
- 缓存不是授权或正确性输入；任何 miss/清空均只增加耗时。

### 7.2 必须 live-smoke 的语义

静态测试只能验证配置意图。以下 Gitea/Runner 兼容点在真实实例通过前不允许合并：

- branch filter、schedule 与 tag 事件路由；
- `$GITEA_OUTPUT`/step output；
- `actions/cache` 的 restore、`post-if: success()`、save、`cache-hit` 与
  `continue-on-error`；
- full-SHA offline Action clone；
- 内层 Job 到 `gitea-runner-cache:8088` 的解析/连接；
- push required context 精确名称和 PR 保护消费方式；
- 失败 needs 传播、`if: always()`、通知和构建阻断；
- cold/warm 两次运行与 6 GiB cgroup 无新增 OOM。

任何不兼容均回退到 cache 关闭的冷构建；不得引入 GitHub Actions fallback。

## 8. 测试与证据

| 合同 | 本地/静态证据 | 真实 Gitea 证据 |
| --- | --- | --- |
| Job 图与事件去重 | 新增 workflow contract 测试，断言 Job 数、触发器、每项 dispatcher 次数、无 `pull_request` | 查询/截图代表性源分支、PR、main 的 run/job 列表 |
| 必需状态 | 静态断言 workflow/job 名与 admin template 不变 | head SHA status API 返回两个精确 `(push)` context 且成功 |
| 缓存 key | fixture 证明同输入稳定、任一锁定输入变化后 miss | 同 SHA rerun 首次 miss/save、第二次 `cache-hit=true` |
| 冷回退 | cache step 容错、dispatcher fixture | 停 Runner 后清空 cache，再运行同一套检查成功 |
| 私网 cache | Compose render 无 ports，rootless disposable DNS/HTTP smoke | 内层 Job 访问别名；宿主 `ss`/`docker port` 无 8088 |
| 容量清理 | 临时目录测试阈值、symlink/owner fail-closed、只删目标 | Runner post-task 日志；可控小阈值演练后恢复 20 GiB |
| 资源边界 | config 测试仍断言 capacity/memory/CPU | `memory.events` 无新增 OOM，记录代表性峰值/耗时 |
| 构建/部署阻断 | workflow needs contract | 故意失败 smoke 不创建镜像/不调用 Gateway；成功 main 仅部署一次 |

测量表至少记录：事件、SHA、run ID、冷/热标记、Job 数、开始/结束时间、总耗时、
cache-hit、DinD peak memory/OOM、最终状态。结构基线为 main 19 Job、内部 PR head
更新 18 Job；耗时基线必须在修改线上 Runner 前从现有 run 记录取样，不能事后猜测。

## 9. 上线顺序

线上变更需要单独授权，本任务的代码实施本身不自动修改主机或 Gitea：

1. 从当前工作流记录至少一个 main 和一个内部 PR head 更新的基线 run/job/耗时。
2. 本地完成 Shell、dispatcher、cache key、workflow contract、Compose/Runner schema、
   cache maintenance 和 disposable rootless smoke。
3. 先部署 Runner cache 配置/私网别名/维护脚本并重建 Runner 容器；保持旧 workflow
   可继续冷运行。
4. 在真实 rootless Job 中证明 endpoint 可达、无端口发布和 Action full-SHA 获取。
5. 推送包含新 workflow 的 smoke 分支：第一次冷运行完成并保存 cache；对同 SHA
   rerun，要求 Go 与 pnpm 精确 hit，七项检查成功。
6. 打开/更新内部 PR，确认没有 pull_request run，两个 push required status 仍被
   分支保护识别；外部 fork 负面 smoke 不调度 Runner。
7. 合并后观察 main：只出现 deploy 的 4 个 Job，七项检查各一次，构建部署一次，
   通知一次。
8. 观察至少两个后续源分支 push 和一个 main run，记录耗时、cache hit、磁盘和
   OOM；定时安全任务首次运行后补齐 2 Job 证据。

## 10. 回滚

回滚点按依赖逆序：

1. 回退 workflow、dispatcher、cache key/action lock 与 `.dockerignore`，恢复原有
   Job 图；required context 名从未改变，因此无需改分支保护。
2. 将 Runner `cache.enabled`/`offline_mode` 设回 false，移除 cache host/port、
   post-task 脚本和网络别名，重建 Runner。
3. cache 数据可原样保留为惰性数据；若怀疑损坏，先停止 Runner，再只清空
   `/data/cache/actions`。不得删除整个 `runner_data`，其中包含注册状态。
4. `docker_data` 与现有 BuildKit cache 不因回滚删除；不触碰 Registry 或 Gateway。
5. 用旧路径执行一次源分支冷构建，确认两个 required context 恢复成功。

单独的 cache 故障不要求回退 workflow：cache 步骤容错，先禁用 cache 即可恢复
正确的串行冷构建。

## 11. 取舍与被拒绝方案

- **不提高并发**：容量 1 是实测内存合同，不是待调优默认值。
- **不跨 workflow 等待**：main 必须自包含验证，避免调度竞态和错误复用旧状态。
- **不保留 PR Runner Job**：内部 PR 已有 push 状态，外部 fork 不应获得受信
  Runner；额外 compatibility Job 没有足够价值。
- **不新建 Go+Node20 镜像**：两 Job 已达到现有工具链边界下的最小图，新增镜像会
  扩大供应链和运维面。
- **不缓存工具二进制/node_modules**：module/store/build cache 提供主要收益，且
  保留精确安装与完整性校验。
- **不新增外部 cache/Registry cache**：单 Runner 内建 cache 和既有 BuildKit
  数据即可，外部服务不会消除首要重复。

## 12. 文件影响面

计划修改/新增：

- Workflows：`.gitea/workflows/ci.yml`、`security.yml`、`deploy.yml`、
  `.gitea/actions.lock`。
- CI helpers：`tools/gitea-ci.sh`、新增 `tools/gitea-cache-key.sh`。
- Runner：`deploy/gitea/runner/config.yaml`、`compose.yaml`、新增
  `cache-maintenance.sh`。
- Build context：`.dockerignore`。
- Tests：dispatcher、Runner config、rootless smoke，以及新增 cache key、cache
  maintenance、workflow contract fixtures。
- Docs/spec：`DEV_GUIDE.md`、`deploy/gitea/README.md` 和现行 Aegis migration
  design 的 Runner/workflow/acceptance 段落；历史 implementation/evidence 文件不
  重写。

明确不改：业务代码、数据库、前端产品逻辑、`release.yml`、admin required-context
值、Gateway deployer、线上主机状态或凭据。
