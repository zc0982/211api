# 实施计划：单机 Gitea Runner 性能优化

## 实施前门禁

- [ ] 使用 `python3 .trellis/scripts/task.py current` 确认 active task 正是本目录；只有
  用户在最终规划摘要之后再次明确批准，才运行 `task.py start`。
- [ ] 实施 Agent 读取 `prd.md`、`design.md`、本文件与 `implement.jsonl` 的全部上下文；
  检查 Agent 读取 `check.jsonl`。
- [ ] 运行 `git status --short`，保留用户现有 `.agents/`、`.trellis/` 等改动，不覆盖
  无关 dirty worktree。
- [ ] 在任何线上变更前，从现有 Gitea 记录一个 `main` run 和一个内部 PR head
  更新的 run ID、SHA、Job 列表、开始/结束时间。没有该基线就不声称耗时改善。
- [ ] 线上 Runner/Gitea/Gateway 修改需要另行授权；仓库实施默认只生成代码、测试和
  操作说明。

## 1. 先建立失败的合同测试

### 1.1 Workflow 图合同

- [ ] 新增 `deploy/gitea/tests/test-workflow-contract.sh`，从受控缩进解析三个 workflow
  的事件和顶层 Job，至少断言：
  - `ci.yml` 2 Job，`security.yml` 2 Job，`deploy.yml` 4 Job；
  - CI/security 对 push 排除 main，所有 active workflow 均无 `pull_request`；
  - deploy 只监听 main，security cron 保持 `0 3 * * 1`，release 触发器不变；
  - 七个 dispatcher 检查在 main 图各出现一次；
  - `ci/required`、`security/required` 的 Job 名不变；
  - admin template/verifier 仍精确包含两个 `(push)` context；
  - 每个 `uses:` 均为绝对 URL + 40 位 SHA，且与 `.gitea/actions.lock` 一一对应；
  - 禁止 host Docker endpoint、浮动 Action tag 和 cache `restore-keys`。
- [ ] 测试必须在现状失败，避免写成只验证自身 fixture 的无效测试。

### 1.2 Cache key 合同

- [ ] 新增 `deploy/gitea/tests/test-ci-cache-key.sh`：把 key 脚本及其输入复制到临时
  仓库形状，证明相同输入结果稳定、Go/pnpm key 不同、任一对应 lock/config 输入
  改变会变 key、未知类型返回 64 且不输出 key。

### 1.3 Cache 清理合同

- [ ] 新增 `deploy/gitea/runner/tests/test-cache-maintenance.sh`，在唯一临时目录或卷中
  覆盖：阈值以下不删除、超过测试阈值只清空精确子项、根目录保留、符号链接拒绝、
  owner 不符拒绝、非目标文件不受影响。
- [ ] 不对真实 `gitea-runner-data` 执行测试清理。

## 2. 实现统一依赖准备与 cache key

### 2.1 `tools/gitea-ci.sh`

- [ ] 抽取前端依赖准备函数，固定 `COREPACK_HOME=/root/.cache/corepack`，把 install
  改为 `pnpm install --frozen-lockfile --prefer-offline`。
- [ ] 保留现有七个子命令和退出码；新增 `frontend-all`，一次依赖安装后先测试再审计。
- [ ] 保持 `GITEA_CI` Testcontainers override、Go/Node 版本检查、lint
  `GOMAXPROCS=1`、固定工具版本和 audit exception 语义不变。
- [ ] 更新 `deploy/gitea/tests/test-ci-dispatcher.sh` 的精确命令序列，特别验证
  `frontend-all` 只有一次 corepack/pnpm install，并执行两项门禁。

### 2.2 `tools/gitea-cache-key.sh`

- [ ] 新增可执行 Bash 脚本，只接受 `go` 或 `pnpm`。
- [ ] 使用固定排序的显式文件列表和 `sha256sum`；不得读取环境 secret、Git ref、
  workspace 临时文件或网络。
- [ ] 输出 `gitea-<type>-linux-amd64-v1-<64hex>`；输入缺失、路径异常或未知类型均
  失败关闭。

## 3. 启用私网 Runner cache 与有界清理

### 3.1 Runner 配置/Compose

- [ ] 更新 `deploy/gitea/runner/config.yaml`：cache enabled，目录
  `/data/cache/actions`，host `gitea-runner-cache`，port `8088`，无 external
  server/secret，offline mode enabled；配置 post-task 脚本与 2 分钟超时。
- [ ] 继续显式保留 capacity、资源、TLS、valid volumes、rootless Unix socket、
  metrics disabled 等全部现有值。
- [ ] 更新 `compose.yaml`：runner 在既有私网增加 cache alias，声明容器内 8088，
  以只读 config 挂载维护脚本并设可执行 mode；不得增加 `ports`、新服务、宿主 socket
  或可写 host bind。

### 3.2 `cache-maintenance.sh`

- [ ] 使用 POSIX shell/Runner 镜像已有 BusyBox 命令；目标硬编码为
  `/data/cache/actions`。
- [ ] 校验非 symlink、目录、UID/GID 1000:1000；默认阈值 20 GiB 或文件系统 80%。
- [ ] 目标路径不可覆盖；只允许单元测试通过严格数值环境变量降低阈值，生产 Compose
  不设置该变量。测试容器仍将唯一临时卷挂到精确 `/data/cache/actions`。
- [ ] 只删除目标根目录下一层入口，保留根目录；打印不含文件名/秘密的大小与结果。
- [ ] 任一校验/统计失败时不删除并非零退出；不要触碰 `.runner`、Action clone cache、
  workspace、`docker_data` 或 runtime volume。

### 3.3 Runner 测试与 smoke

- [ ] 更新 `test-runner-config.sh` 对渲染模型、schema、cache 字段、alias、只读脚本
  config、无 published port/host endpoint 和原资源边界的断言。
- [ ] 扩展 `smoke-rootless-dind.sh` 或新增同级 smoke：在唯一临时外层网络提供别名 HTTP
  endpoint，从 rootless DinD 内层非特权只读容器解析并访问；trap 只清理本次唯一
  project/network/volumes。
- [ ] 不伪造真实 Runner 注册状态；真实 cache API 留给线上 smoke。

## 4. 重写 Workflow 图

### 4.1 Action lock

- [ ] 在 `.gitea/actions.lock` 加入
  `https://github.com/actions/cache 0057852bfaa89a56745cba8c7296529d2fc39830 v4.3.0`。
- [ ] checkout pin 保持不变；不引入其他 Action。

### 4.2 `ci.yml`

- [ ] 触发器改为非 main 的 push，不再声明 pull_request。
- [ ] `backend` Go Job：checkout → go key → cache → Shell → unit → integration → lint。
- [ ] `required` Node Job：`if: always()` + `needs: backend`；先检查 result，再 checkout
  → pnpm key → cache → frontend。
- [ ] cache 失败容错并输出 hit 日志；所有真实检查继续硬失败。

### 4.3 `security.yml`

- [ ] push 排除 main、移除 pull_request、保留原 cron。
- [ ] `backend` 执行 Go vulnerability；`required` 先验证 backend，再执行 Node audit。
- [ ] 保持 workflow/job 名，确保 push context 不变。

### 4.4 `deploy.yml`

- [ ] 用 `backend` Go Job 合并 Shell、unit、integration、lint、backend vulnerability。
- [ ] 用 `verify` Node Job 验证 backend 后调用 `frontend-all`。
- [ ] `build_deploy` 只依赖 verify；其发布/部署脚本内容除缩进/needs 所需调整外不改。
- [ ] `notify` 保持 always，依赖 verify 与 build_deploy；验证失败时仍报告失败。
- [ ] 确认 main 完整图正好 4 Job，七项检查正好各一次。

## 5. 缩小 Docker build context

- [ ] 对照 Dockerfile 每条 `COPY` 后更新 `.dockerignore`，排除明确不用的 AI/Trellis/
  Gitea 运维/资产目录和 deploy 非入口文件。
- [ ] 保留 `frontend/`、`backend/`、`docs/legal/`、`deploy/docker-entrypoint.sh` 以及
  Dockerfile 真正读取的所有源。
- [ ] 不增加外部 BuildKit cache；保留现有三个 cache mount 与持久 `docker_data`。

## 6. 更新当前文档与架构合同

- [ ] `DEV_GUIDE.md`：事件矩阵、4/4 Job 图、源分支 push 状态、无 PR Runner、缓存与
  本地命令。
- [ ] `deploy/gitea/README.md`：cache 网络/目录/阈值、上线前后顺序、cold/warm 验证、
  磁盘/内存观测、精确清空与回滚；本地检查列表加入新 tests。
- [ ] `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`：只更新 living design
  的状态、Runner cache、workflow 7.1-7.3 和 acceptance 段；保留历史迁移 plan 与
  evidence 文件不变。
- [ ] 所有文档明确：线上主机操作另需授权，缓存是性能层而非门禁/授权层。

## 7. 本地验证

从仓库根目录运行，任一失败先修复再进入 live gate：

```bash
bash -n \
  tools/gitea-ci.sh \
  tools/gitea-cache-key.sh \
  deploy/gitea/runner/cache-maintenance.sh \
  deploy/gitea/tests/test-ci-dispatcher.sh \
  deploy/gitea/tests/test-ci-cache-key.sh \
  deploy/gitea/tests/test-workflow-contract.sh \
  deploy/gitea/runner/tests/test-cache-maintenance.sh \
  deploy/gitea/runner/tests/test-runner-config.sh \
  deploy/gitea/runner/tests/smoke-rootless-dind.sh

deploy/gitea/tests/test-ci-dispatcher.sh
deploy/gitea/tests/test-ci-cache-key.sh
deploy/gitea/tests/test-workflow-contract.sh
deploy/gitea/runner/tests/test-cache-maintenance.sh
deploy/gitea/runner/tests/test-runner-config.sh
deploy/gitea/runner/tests/smoke-rootless-dind.sh
./tools/gitea-ci.sh shell-syntax
```

另外运行现有与修改边界相邻的 fixtures，防止 release/admin/Runner 漂移：

```bash
deploy/gitea/runner/tests/test-go-actions-image.sh
deploy/gitea/runner/tests/test-docker-actions-image.sh
deploy/gitea/runner/tests/test-registration-token-lifecycle.sh
deploy/gitea/tests/test-admin-primitives.sh
deploy/gitea/tests/test-release-workflow.sh
```

检查差异与静态残留：

```bash
rg -n 'pull_request|actions/cache@|restore-keys|capacity:|cache:|ports:' \
  .gitea deploy/gitea/runner DEV_GUIDE.md
git diff --check
git status --short
```

## 8. 真实 Gitea 上线门禁（另行授权）

- [ ] 先部署 Runner config/Compose/维护脚本，验证 Runner healthy、cache 仅监听容器
  私网、8088 无宿主端口，Docker daemon 仍只有 Unix socket。
- [ ] smoke 分支首次运行：4 Job、七项检查、cache miss/save、两个精确 push context。
- [ ] 对同 SHA rerun：4 Job、Go 与 pnpm `cache-hit=true`、结果一致；记录 cold/warm
  总耗时。
- [ ] 停止 Runner 后只清空 `/data/cache/actions`，再运行同 SHA，证明 cold fallback。
- [ ] 打开/更新内部 PR 不创建 pull_request run；外部 fork 负面 smoke 不调度受信
  Runner 且不能满足 push contexts。
- [ ] 故意失败的 smoke commit 不进入 build/deploy；不得使用真实 main/Gateway 制造
  失败实验。
- [ ] 经批准合并后，main 只有 deploy 的 4 Job、七项检查各一次、镜像/部署/通知各
  一次；记录内存峰值和 `memory.events`，无新增 OOM。
- [ ] 观察两个后续源分支 push、一个 main run，并在下次定时安全运行补齐 2 Job
  证据；若兼容点失败，执行回滚而非放宽门禁。

## 9. 风险文件与回滚点

| 风险点 | 失败影响 | 回滚 |
| --- | --- | --- |
| workflow 触发/needs | 缺状态、重复或跳过校验 | 回退三个 workflow；required context 名未改 |
| cache Action/Gitea 兼容 | cache 失效或 Job 异常 | 先禁用 cache step/Runner cache，恢复冷构建 |
| cache 网络别名 | 内层 Job 无法访问 | 移除 alias/host/port，`cache.enabled: false` |
| post-task 清理 | 错删/Runner 离线过久 | fail-closed 测试；移除 post script；只允许精确 cache 路径 |
| dispatcher 组合 | 前端测试或 audit 漏跑 | fixture 精确断言；回退 `frontend-all` 并恢复两个调用 |
| `.dockerignore` | Docker COPY 缺文件 | 回退 ignore 条目；不删除 BuildKit/docker_data |

严禁回滚时删除整个 `gitea-runner-data`、`docker_data`、注册状态、Registry 镜像或
Gateway 数据。清 cache 前必须停止 Runner 并再次解析精确 volume/path。

## 10. 完成定义

- [ ] PRD AC1–AC10 均有对应静态或 live 证据；未执行的线上项明确标为待授权，不能
  伪称完成。
- [ ] 本地测试全绿，`git diff --check` 无问题，Action/image/full context lock 无漂移。
- [ ] 代码审查确认七项门禁、release、部署和通知语义未弱化。
- [ ] cold/warm、Job 数、耗时、磁盘、内存和回滚证据写回任务/运维记录。
