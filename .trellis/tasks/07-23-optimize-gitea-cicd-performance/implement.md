# 实施计划：单机 Gitea Runner 性能优化

## 实施前门禁

- [x] 使用 `python3 .trellis/scripts/task.py current` 确认 active task 正是本目录；只有
  用户在最终规划摘要之后再次明确批准，才运行 `task.py start`。
- [x] 实施 Agent 读取 `prd.md`、`design.md`、本文件与 `implement.jsonl` 的全部上下文；
  检查 Agent 读取 `check.jsonl`。
- [x] 运行 `git status --short`，保留用户现有 `.agents/`、`.trellis/` 等改动，不覆盖
  无关 dirty worktree。
- [x] 在任何线上变更前，从现有 Gitea 记录一个 `main` run 和一个内部 PR head
  更新的 run ID、SHA、Job 列表、开始/结束时间。没有该基线就不声称耗时改善。
- [x] 线上 Runner/Gitea/Gateway 修改需要另行授权；仓库实施默认只生成代码、测试和
  操作说明。

## 0. 已补齐的主路径证据与仍待门禁/需求决策

优化前 `main` SHA `34be916c487f261f9e034c726be13c773be8489a` 的同一次 push 恰好创建
run `191`（`ci.yml`，6 Job）、`192`（`deploy.yml`，10 Job）与 `193`（`security.yml`，3
Job），在单 Runner 下的总窗口为 `2026-07-23T12:54:41Z`–`14:17:20Z`（4959 秒）。优化后
SHA `95b94297ac236df9eb9fda68ebde53e8f81e2ba0` 的 `main` push 只创建 run `215`
（`deploy.yml`，4 Job），窗口为 `2026-07-24T07:00:26Z`–`07:18:29Z`（1083 秒）：观察到
Job 19→4、七项重型检查 14→7、窗口减少 3876 秒（78.2%）。两次事件的 SHA/日期不同，故仅
是观察性路径比较，不能将全部差异归因于单一优化因素；完整原始证据见 `evidence.md` §2.1/§9。

run `215` 的 job `867` BuildKit 原始日志有 10 个既有层命中：`#3`、`#12`、`#14`、`#15`、
`#28`–`#33` 均为 `CACHED`，随后 `#39 exporting layers` 完成。因此 AC4 的 BuildKit 命中
证据已具备，但不声称所有层均命中。PRD R3 的 BuildKit 容量语义已由锁定 rootless DinD 的
docker-driver 默认自动 GC policy、无 daemon override 与 live `buildx inspect default` 解决：
存在 filtered 48h 有界 policy 及最终 `All=true` 的正 reserved/max/min-free policy，且
max 大于 reserved。当前 GiB 数值仅为这一 image/storage 组合的观察；升级 DIND digest、改变
磁盘或出现 daemon.json override 必须重新 inspect。该证据不声称已发生阈值触发、GC sweep 或
自动删除；宿主监控和停机人工 prune 是获授权的恢复/应急路径。

以下为 live gate 与需求缺口状态：已完成项勾选，未通过项保持未勾选。

- [x] PRD R3（包括 BuildKit/`docker_data`）已满足：当前锁定 docker driver 的默认自动 GC
  policy 是自动软上限，design、infra contract、README 与 evidence 已同步；不新增 daemon.json
  或固定跨机器容量配置。仅 policy 运行态已获证，不把它误述为 GC 删除事件。
- [x] 通知诊断补丁先以 `6bcdf666...` 与 `aadcc6cd...` 推送 source，后者对应
  source run `216`/`217` 的 CI/Security success；该 source 阶段未 deploy，不证明真实通知。
  补丁后续进入 `main` 及通知路径的结果见下两项。
- [x] PR #12 `fix(ci): 增强部署通知失败诊断` 已在 `2026-07-24T11:56:08Z` Ready 后以
  fast-forward-only 合并；merge/head/base 与 main/source 均为
  `ddd6e9390d87550bd6c159dd61088fd0b87cea6e`。仅合并产生 run `222`（deploy main push），
  共 4 个严格串行 Job、957 秒；Go/pnpm exact hit、七项门禁各一次、15 个 BuildKit CACHED
  step、Registry/Gateway 对齐且无 OOM。详情见 evidence.md §11。
- [x] run `222` 的 job `884`/task `833` 首次执行虽因 soft-fail 显示 success，真实 marker 为
  `http-5xx-502` 且 Telegram 未收件；Pipedream 脱敏探针随后以 `getMe`/`getChat` 的 HTTP `401`
  确定 Bot token 已失效。修复 token 后探针为 HTTP `200`、原事件重放实收；再经明确授权使用
  Gitea 官方 `rerunWorkflowJob` 仅重跑 job `884` 一次，HTTP `201`，其在
  `13:29:33Z`–`13:29:37Z` success，最终 marker 为 `accepted`，用户确认 Telegram 群实收。
  run 仍为 `222`/4 Job、无新 run，前三个 Job 时间戳未变，故没有重跑验证、构建或部署。
  通知 live gate 已关闭；详见 evidence.md §11.1–§11.2。
- [ ] 自然触发的 scheduled security 2 Job 尚未发生。2026-07-24 只读预检已确认
  `security.yml` 在 Gitea 官方 API 中为 `active`，宿主 NTP 已同步、宿主/Gitea 容器时钟差 0 秒，
  Runner `online`/`busy=false` 且标签齐全；Gitea DB 只读查询进一步确认仓库恰有一条
  `action_schedule`/`action_schedule_spec`，绑定当前 `security.yml@refs/heads/main` 与
  `ddd6e939...`，cron 为 `0 3 * * 1`、`prev=0`、`next=2026-07-27 03:00:00 UTC`。最近
  100 个 run 中 `event=schedule` 为 0；首次自然观察仍待该时间，详见 evidence.md §12。
- [x] design §3.1/§7.2 所要求、针对当前 workflow 的临时非 `v*` tag 负面 smoke 已完成：
  `ci-no-workflow-smoke-3d5d8ac8` 指向 `3d5d8ac8...`，在 `10:23:48Z`–`10:26:20Z` 的约
  152 秒观察中远端 tag 保持指向该 SHA、max run ID 始终为 `219`、`new_runs=[]`、Runner idle；
  ci/security/deploy/release 均未调度。远端 ref 已精确删除并由 `ls-remote` 验空，随后同名本地
  tag 亦删除；不替代通知或自然 scheduled gate。历史真实 release request run `138` 与
  `v0.1.160-gitea-smoke.2` tag run `141` 均为 2 Job completed/success，且当前
  `release.yml` 与其被测 SHA `e289410d...` 字节级无差异，当前 release 合同测试亦 PASS；
  因而 release 分支/tag 的正向路由与普通 tag 的负向路由均已有证据。详见 evidence.md
  §10.5/§13.1。

## 1. 先建立失败的合同测试

### 1.1 Workflow 图合同

- [x] 新增 `deploy/gitea/tests/test-workflow-contract.sh`，从受控缩进解析三个 workflow
  的事件和顶层 Job，至少断言：
  - `ci.yml` 2 Job，`security.yml` 2 Job，`deploy.yml` 4 Job；
  - CI/security 对 push 排除 main，所有 active workflow 均无 `pull_request`；
  - deploy 只监听 main，security cron 保持 `0 3 * * 1`，release 触发器不变；
  - 七个 dispatcher 检查在 main 图各出现一次；
  - `ci/required`、`security/required` 的 Job 名不变；
  - admin template/verifier 仍精确包含两个 `(push)` context；
  - 每个 `uses:` 均为绝对 URL + 40 位 SHA，且与 `.gitea/actions.lock` 一一对应；
  - 禁止 host Docker endpoint、浮动 Action tag 和 cache `restore-keys`。
- [ ] 历史 TDD red 顺序无法由当前工作树或提交顺序权威证明；实现 commit `8a133c006` 早于
  测试 commit `da3ee16e1`，因此不追溯性勾选。本项是不可重建的过程证据缺口，不代表当前
  workflow 合同、回归覆盖或 live gate 未实现。

### 1.2 Cache key 合同

- [x] 新增 `deploy/gitea/tests/test-ci-cache-key.sh`：把 key 脚本及其输入复制到临时
  仓库形状，证明相同输入结果稳定、Go/pnpm key 不同、任一对应 lock/config 输入
  改变会变 key、未知类型返回 64 且不输出 key。

### 1.3 Cache 清理合同

- [x] 新增 `deploy/gitea/runner/tests/test-cache-maintenance.sh`，在唯一临时目录或卷中
  覆盖：阈值以下不删除、超过测试阈值只清空精确子项、根目录保留、符号链接拒绝、
  owner 不符拒绝、非目标文件不受影响。
- [x] 不对真实 `gitea-runner-data` 执行测试清理。

## 2. 实现统一依赖准备与 cache key

### 2.1 `tools/gitea-ci.sh`

- [x] 抽取前端依赖准备函数，固定 `COREPACK_HOME=/root/.cache/corepack`，把 install
  改为 `pnpm install --frozen-lockfile --prefer-offline`。
- [x] 保留现有七个子命令和退出码；新增 `frontend-all`，一次依赖安装后先测试再审计。
- [x] 保持 `GITEA_CI` Testcontainers override、Go/Node 版本检查、lint
  `GOMAXPROCS=1`、固定工具版本和 audit exception 语义不变。
- [x] 更新 `deploy/gitea/tests/test-ci-dispatcher.sh` 的精确命令序列，特别验证
  `frontend-all` 只有一次 corepack/pnpm install，并执行两项门禁。

### 2.2 `tools/gitea-cache-key.sh`

- [x] 新增可执行 Bash 脚本，只接受 `go` 或 `pnpm`。
- [x] 使用固定排序的显式文件列表和 `sha256sum`；不得读取环境 secret、Git ref、
  workspace 临时文件或网络。
- [x] 输出 `gitea-<type>-linux-amd64-v1-<64hex>`；输入缺失、路径异常或未知类型均
  失败关闭。

## 3. 启用私网 Runner cache 与有界清理

### 3.1 Runner 配置/Compose

- [x] 更新 `deploy/gitea/runner/config.yaml`：cache enabled，目录
  `/data/cache/actions`，host `gitea-runner-cache`，port `8088`，无 external
  server/secret，offline mode enabled；配置 post-task 脚本与 2 分钟超时。
- [x] 继续显式保留 capacity、资源、TLS、valid volumes、rootless Unix socket、
  metrics disabled 等全部现有值。
- [x] 更新 `compose.yaml`：runner 在既有私网增加 cache alias，声明容器内 8088，
  以只读 config 挂载维护脚本并设可执行 mode；不得增加 `ports`、新服务、宿主 socket
  或可写 host bind。

### 3.2 `cache-maintenance.sh`

- [x] 使用 POSIX shell/Runner 镜像已有 BusyBox 命令；目标硬编码为
  `/data/cache/actions`。
- [x] 校验非 symlink、目录、UID/GID 1000:1000；默认阈值 20 GiB 或文件系统 80%。
- [x] 目标路径不可覆盖；只允许单元测试通过严格数值环境变量降低阈值，生产 Compose
  不设置该变量。测试容器仍将唯一临时卷挂到精确 `/data/cache/actions`。
- [x] 只删除目标根目录下一层入口，保留根目录；打印不含文件名/秘密的大小与结果。
- [x] 任一校验/统计失败时不删除并非零退出；不要触碰 `.runner`、Action clone cache、
  workspace、`docker_data` 或 runtime volume。

### 3.3 Runner 测试与 smoke

- [x] 更新 `test-runner-config.sh` 对渲染模型、schema、cache 字段、alias、只读脚本
  config、无 published port/host endpoint 和原资源边界的断言。
- [x] 扩展 `smoke-rootless-dind.sh` 或新增同级 smoke：在唯一临时外层网络提供别名 HTTP
  endpoint，从 rootless DinD 内层非特权只读容器解析并访问；trap 只清理本次唯一
  project/network/volumes。
- [x] 不伪造真实 Runner 注册状态；真实 cache API 留给线上 smoke。

## 4. 重写 Workflow 图

### 4.1 Action lock

- [x] 在 `.gitea/actions.lock` 加入
  `https://github.com/actions/cache 0057852bfaa89a56745cba8c7296529d2fc39830 v4.3.0`。
- [x] checkout pin 保持不变；不引入其他 Action。

### 4.2 `ci.yml`

- [x] 触发器改为非 main 的 push，不再声明 pull_request。
- [x] `backend` Go Job：checkout → go key → cache → Shell → unit → integration → lint。
- [x] `required` Node Job：`if: always()` + `needs: backend`；先检查 result，再 checkout
  → pnpm key → cache → frontend。
- [x] cache 失败容错并输出 hit 日志；所有真实检查继续硬失败。

### 4.3 `security.yml`

- [x] push 排除 main、移除 pull_request、保留原 cron。
- [x] `backend` 执行 Go vulnerability；`required` 先验证 backend，再执行 Node audit。
- [x] 保持 workflow/job 名，确保 push context 不变。

### 4.4 `deploy.yml`

- [x] 用 `backend` Go Job 合并 Shell、unit、integration、lint、backend vulnerability。
- [x] 用 `verify` Node Job 验证 backend 后调用 `frontend-all`。
- [x] `build_deploy` 只依赖 verify；其发布/部署脚本内容除缩进/needs 所需调整外不改。
- [x] `notify` 保持 always，依赖 verify 与 build_deploy；验证失败时仍报告失败。
- [x] 确认 main 完整图正好 4 Job，七项检查正好各一次。

## 5. 缩小 Docker build context

- [x] 对照 Dockerfile 每条 `COPY` 后更新 `.dockerignore`，排除明确不用的 AI/Trellis/
  Gitea 运维/资产目录和 deploy 非入口文件。
- [x] 保留 `frontend/`、`backend/`、`docs/legal/`、`deploy/docker-entrypoint.sh` 以及
  Dockerfile 真正读取的所有源。
- [x] 不增加外部 BuildKit cache；保留现有三个 cache mount 与持久 `docker_data`，其 docker-driver
  默认自动 GC policy 作为 R3 软边界；人工 prune 仅限获授权的 stopped-Runner 恢复窗口。

## 6. 更新当前文档与架构合同

- [x] `DEV_GUIDE.md`：事件矩阵、4/4 Job 图、源分支 push 状态、无 PR Runner、缓存与
  本地命令。
- [x] `deploy/gitea/README.md`：cache 网络/目录/阈值、上线前后顺序、cold/warm 验证、
  磁盘/内存观测、精确清空与回滚；本地检查列表加入新 tests。
- [x] `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`：只更新 living design
  的状态、Runner cache、workflow 7.1-7.3 和 acceptance 段；保留历史迁移 plan 与
  evidence 文件不变。
- [x] 所有文档明确：线上主机操作另需授权，缓存是性能层而非门禁/授权层。

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

- [x] 先部署 Runner config/Compose/维护脚本，验证 Runner healthy、cache 仅监听容器
  私网、8088 无宿主端口，Docker daemon 仍只有 Unix socket。
- [x] 修复后 smoke 分支以 4 Job 完成七项检查并产生两个精确 push context；精确清理
  后的 attempt 3 同时证明 Go/pnpm 首次 miss/save 和后续 exact hit。
- [x] 对同 SHA rerun：attempt 2 的 4 次 Go/pnpm restore 均为精确
  `cache-hit=true`，且没有 miss/save；已分别记录 warm 与清理后 cold fallback 总耗时。
- [x] 停止 Runner 后只清空 `/data/cache/actions`，再运行同 SHA，证明 cold fallback。
- [x] 内部 PR opening + head update smoke：打开 Draft PR 本身未新增 workflow run；
  opening 前的 head `484aba68...` 已由 source push 产生 run `198`/`199`。后续已批准
  head update `803bda0a...` 仅创建 run `200`/`201` 两个 `push` run、共 4 个 Job；
  全程没有 `pull_request` run。两个 head 的聚合 commit status 均为 success，required
  context 的名称与成功状态和 `main` 保护合同精确一致。不声称 API 直接返回了 PR 消费
  contexts 的额外 rollup 字段。
- [x] 外部 fork 负面 smoke：第二次经单独授权仅临时启用 Fork Actions 后，唯一 Fork
  SHA 真实产生 `ci.yml`/`security.yml` 两条 push run（204/205）和四个未分配 job（841–844，
  `task_id=0`，没有 `action_task`/`runner_id=1`）；canonical 无该 SHA 或外部 PR 的
  pull_request run，Fork secrets 为空，cache/Runner/OOM 不变。外部 WIP PR #11 opening 后
  仍无 pull_request run；临时 PAT 对非 required sentinel 返回 403，canonical 不含 sentinel
  或 required contexts。所有临时活动对象已按 PR、Fork、collaborator、PAT、user 的顺序清理，
  full verifier 通过。run/job/Fork status 是删除 Fork 前的观测证据；删除后相应 live DB 行已
  级联清除。首次 `has_actions=false` fail-closed 记录仍保留于 evidence.md。
- [x] 故意失败的 smoke commit 不进入 build/deploy；未使用真实 main/Gateway 制造
  失败实验。
  - [x] 已新增并独立检查 fail-closed renderer、生产拓扑绑定合同及常用测试入口；只接受
    `ci-smoke-fail-gate-` 加 16 位小写十六进制的精确分支，生成物无 secret、URL、
    Registry、Gateway 或外部通知调用。
  - [x] 经单独授权的 `ci-smoke-fail-gate-7b9bc28b7a8a63e1` 产生唯一 run `208`：
    `backend` job/task `849`/`799` 在 Runner `1` 以 intentional exit `86` 失败，
    `verify` `850`/`800` 以 `backend-result=failure` 失败，`build-and-deploy` `851`
    无 task/Runner 而 skipped（log HTTP `404`、无 `UNREACHABLE`），
    `telegram-notification` `852`/`801` 在 Runner `1` 以
    `verify-result=failure build-deploy-result=skipped` 成功。精确远端 branch、本地
    worktree/ref/directory 均已清理，历史 run/job 保留；生产不变量未变。该结果只证明
    通知 Job 最终调度，不替代真实 `main` 的构建、部署和实际消息投递证据。
- [x] 经批准合并后，main 只有 deploy 的 4 Job、七项检查各一次、镜像/部署/通知各
  一次；记录内存峰值和 `memory.events`，无新增 OOM。
  - [x] `95b94297ac236df9eb9fda68ebde53e8f81e2ba0` 的唯一 main `deploy.yml` run `215`
    为 4 个严格串行 Job（865–868），七项检查各一次；BuildKit/export、Registry push 与
    Gateway deploy 各一次，Go/pnpm exact hit，Runner/DinD restart 与 OOM 均为 0，
    `memory.events max=296`、`oom*=0`。Registry/Gateway revision 和 immutable digest
    对齐；详情见 evidence.md §9。
  - [x] job `868` 的历史负面观察已完整记录：虽 API success，但实际日志为
    `Deployment notification delivery failed;
    deployment result is unchanged.`（`skip=0`、`delivery_failed=1`）。实际 adapter
    接受与 Telegram 收件均未证明；独立 Trellis 最终 gate 因此 FAIL，不能勾选本项。只读历史
    显示 run `192`/job `817` 与 run `185`/job `780` 曾实际 `guard accepted=1`、
    `delivery_failed=0`，故 `215` 是当前单次失败而非已知连续故障；backup preflight 的
    `non-2xx=0` 发生在 Telegram 分支之前，不能替代实际投递证据。
  - [x] 已完成通知失败安全诊断补丁与 12/12 已执行回归；两轮独立
    trellis-check 及主 Agent 最终静态/通知/工作流合同检查均 PASS。补丁采用严格 HTTPS
    Pipedream endpoint 验证、单次 15 秒可取消 fetch、无敏感输出的 outcome marker 与外层
    soft-fail；Phase 3.3 的 infra spec sync 亦已完成并经独立检查 PASS；详情见 evidence.md
    §10。诊断实现 commit `6bcdf666fe8ead91fec9530522e7ffe9378be6d0` 及证据补充 commit
    `aadcc6cd78e9651bbfc0375e0db97f72d3e8a846` 均已推送至保留源分支
    `sync/upstream-0.1.164`；在该 source 观察阶段尚未进入 `main`、未触发 deploy，Gateway、
    Registry 和真实通知均未触碰，因而该阶段不能作为 run `215` 已修复、adapter 接受或 Telegram
    收件的证据。
  - [x] 经单独授权，通知诊断补丁已随 PR #12 fast-forward 合并进 `main` 并执行真实
    `main` 通知路径。run `222` 首次得到 `http-5xx-502` 且 Telegram 未收件；确认并修复失效的
    Pipedream Bot token 后，官方单 Job rerun 得到 `accepted` 且用户确认群实收，main/通知
    live gate 已完成。
- [x] 观察至少两个后续源分支 push：`484aba68...` 的 run `198`/`199`、
  `803bda0a...` 的 run `200`/`201`、`7b9bc28...` 的 run `206`/`207`，以及最新 PR
  head `ee9d38f...` 的 run `209`/`210` 均为 4 Job 的 warm 路径；最新一次恰好只有两条
  success `push` run，无 `pull_request`、deploy、release 或重复 run，四次 restore 均为
  精确 `cache-hit=true`。若兼容点失败，执行回滚而非放宽门禁。
- [x] 已推送保留源分支 `sync/upstream-0.1.164` 的
  `aadcc6cd78e9651bbfc0375e0db97f72d3e8a846` 最终只产生 run `216`（ci）与 `217`
  （security）两条 success `push` run、四个严格串行 Job；七项门禁各一次、四次 Go/pnpm
  restore 均为精确 hit，且无 `pull_request`、deploy、release 或重复 run。在该 source run 观察阶段，
  它尚未进入 `main`，Gateway、Registry 与真实通知均未触碰；后续合并结果见 evidence.md §11。
- [x] 最新 `3d5d8ac8dc107eaaeb1e5b232a41eb037adeb880` source push 仅产生 run `218`（ci）
  与 `219`（security）两条 success `push` run，四个 Job（873–876）在 Runner `1` 严格串行
  923 秒；七项门禁各一次、2 次 Go 与 2 次 pnpm 精确 hit，`ci / backend (push)`、
  `ci / required (push)`、`security / backend (push)`、`security / required (push)` 四个 context
  全部 success，未产生 `pull_request`/deploy/release/重复 run。完成后执行并完全清理精确非 `v*` tag
  `ci-no-workflow-smoke-3d5d8ac8`：152 秒内无新 run（max ID 219），故当前 tag 负向 live gate
  已关闭；本次未触碰 main/Gateway/Registry/真实通知，且未执行 prune。详见 evidence.md §10.5。
- [x] 第一个 `main` run 的负面观察已完整记录：`95b94297ac236df9eb9fda68ebde53e8f81e2ba0`
  的唯一 deploy run `215` 完成，但实际通知投递失败；它保留为失败诊断证据，不作为通过的
  main live gate。
- [x] 第二个 `main` run 的整体 gate：PR #12 合并后的
  `ddd6e9390d87550bd6c159dd61088fd0b87cea6e` 仅产生 completed/success 的 deploy run `222`
  （Job 881–884，严格串行 957 秒），且 main commit aggregate 为 success/8 contexts。失效的
  Pipedream Bot token 修复后，仅对 job `884` 做一次官方 rerun，最终 marker 为 `accepted` 且
  用户确认 Telegram 群实收；没有新 run，也未重跑前三个 Job。分支保护所需两个 `(push)`
  context 未变；scheduled Security 自然运行仍待 2026-07-27 03:00 UTC。

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

- [ ] PRD R1–R5 与 AC1–AC10 均已有对应实现及静态/live 证据；但 design §7.2/§9 要求的
  当前版本首次自然 scheduled security 仍待 2026-07-27 03:00 UTC，完成前任务不得归档。
- [x] 本地测试全绿，`git diff --check` 无问题，Action/image/full context lock 无漂移。
- [x] 代码审查确认七项门禁、release、部署和通知语义未弱化。
- [x] cold/warm、Job 数、耗时、磁盘、内存和回滚证据写回任务/运维记录。
