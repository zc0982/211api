# 单机 Gitea Runner 灰度与 Smoke 证据

## 1. 证据边界

- 授权范围：仅优化并灰度现有单机 Runner；允许推送当前分支、执行同 SHA 的
  cold/warm smoke 及停 Runner 后清空精确 action cache 的 cold fallback。
- 分支：`sync/upstream-0.1.164`。
- 第 5 节 cold/warm 对照的被测提交：
  `d283e13000c8fc957ff9832e196c43869fcf9b5a`。PostCSS 安全补丁
  `e40f3ff66` 已提交并随该 tip 推送；下文当前 SHA 的 attempt 1 是 Go warm / pnpm
  cold，attempt 2 是四次 exact hit，attempt 3 是精确清理后的 cold fallback。所有时间
  均为 UTC。
- 第 1–8 节记录的灰度与 smoke 阶段未合并 `main`，也未修改或部署 Gateway；内部 PR 的
  opening/head update 与外部 Fork 隔离，以及故障传播和最终通知 Job 调度均已验证。故障
  smoke 不证明真实通知投递或 `main` 部署。后续经授权完成的 `main` 部署观察见第 9 节，
  通知诊断补丁的保留源分支观察见第 10 节；实际通知、当前 workflow 的非 `v*` tag 负面
  smoke 与后续定时运行仍是独立 live gate。PRD R3 的 BuildKit 容量语义已由锁定
  docker-driver 的默认自动 GC policy、无 daemon override 与 live inspect 解决；这证明
  运行态有界 policy，不声称已观察到阈值触发、GC sweep 或自动删除。

## 2. 优化前基线

### 2.1 代表性 `main` 路径基线（与优化后观察性对比）

优化前，`main` 的同一次 push（SHA
`34be916c487f261f9e034c726be13c773be8489a`）恰好创建三条 run：`191`（`ci.yml`，6
Job）、`192`（`deploy.yml`，10 Job）和 `193`（`security.yml`，3 Job），合计 19 Job。受
`capacity: 1` 的单 Runner 严格串行约束，该事件的总窗口为
`2026-07-23T12:54:41Z`–`2026-07-23T14:17:20Z`，即 4959 秒；其中 deploy run `192`
自身为 `2026-07-23T13:33:00Z`–`2026-07-23T14:17:20Z`。

优化后，SHA `95b94297ac236df9eb9fda68ebde53e8f81e2ba0` 的 `main` push 只产生 run
`215`（`deploy.yml`，4 Job），窗口为 `2026-07-24T07:00:26Z`–`07:18:29Z`，即 1083
秒。与上述旧 `main` 事件相比，总窗口减少 3876 秒（78.2%），Job 从 19 降至 4，七项重型
检查从重复执行 14 次降至各一次、共 7 次。两个样本的 SHA 与日期不同；此处仅记录事件路径的
观察性对比，不能把全部时延差异归因于任何单一优化因素。

### 2.2 源分支与内部 PR 的重复执行基线

同一 head SHA `a6a70ecaf06b...` 的源分支 push 与内部 PR 同时产生 run
`187`–`190`：

| Run | Workflow / event | Job 数 | 开始 | 结束 | Run 耗时 |
| ---: | --- | ---: | --- | --- | ---: |
| 187 | `ci.yml` / push | 6 | 11:33:58 | 12:54:11 | 4813 s |
| 188 | `security.yml` / push | 3 | 12:12:45 | 12:54:12 | 2487 s |
| 189 | `ci.yml` / pull_request | 6 | 12:14:06 | 12:54:13 | 2407 s |
| 190 | `security.yml` / pull_request | 3 | 12:52:40 | 12:54:14 | 94 s |

由于 `capacity: 1`，四个 workflow 的 18 个 Job 在
`2026-07-23T11:33:58Z`–`12:54:14Z` 形成 4816 秒（80 分 16 秒）的串行关键窗口。
代表性旧 Job 耗时为：backend unit 595–601 秒、integration 555–563 秒、lint
1041–1054 秒、frontend 109–110 秒；源分支更新同时被 PR 事件重复执行。

灰度前后均保持 Runner `512 MiB / 0.5 CPU`、rootless DinD
`6 GiB / 3 CPU`、`capacity: 1`。灰度前 DinD `memory.events` 基线为：

```text
low 0
high 0
max 296
oom 0
oom_kill 0
oom_group_kill 0
```

## 3. Runner 灰度部署

部署前线上 `compose.yaml` 与 `config.yaml` 的 SHA-256 分别为
`467a04...`、`119f65...`，与被测提交父版本一致。备份保存在只允许 root 访问的
`/opt/gitea/runner/backups/pre-cache-7e29fc83d/`；其中 compose/config 为
`root:root 0644`，目录为 `0700`，并记录原本不存在 maintenance 脚本。

部署后的精确 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `/opt/gitea/runner/compose.yaml` | `7793427499ef44cd03928cbf38e81aca19377206c6648479f9972e43bb83b5f8` |
| `/opt/gitea/runner/config.yaml` | `9360c5c557e531d1fb229f56cc9d8e78a80eb1564b82266a711d946b1d1e2e7e` |
| `/opt/gitea/runner/cache-maintenance.sh` | `200e1503bc66ebdb4e46637484095e556dc38f6815ac7e11bc6bf81feee838dc` |

只重建了 Runner 容器；rootless DinD 容器保持原 ID，避免丢失既有
`docker_data`/BuildKit cache：

| 容器 | ID 前缀 | 创建/启动 | 状态 |
| --- | --- | --- | --- |
| Runner | `c56b4685eb91` | `2026-07-23T16:12:54Z` | 已注册，0 次重启，未 OOM |
| DinD | `e1b3ef2e3cb5` | `2026-07-22T02:40:36Z` | 原容器继续运行且 healthy，0 次重启，未 OOM |

上述已部署 Compose 将 Runner 与 DinD 的容器运行身份均显式固定为 `1000:1000`。
Runner 日志确认 `netcup-amd64-1` declare 成功。持久卷目录
`/data`、`/data/cache`、`/data/cache/actions` 均为 `1000:1000 0700`；已有
`.runner` 保持 `1000:1000 0644`，未删除注册状态、整个 Runner 卷或
`docker_data`。

## 4. 隔离证明

- Runner 仅连接既有 `gitea-runner-network`；私网别名包含
  `gitea-runner-cache`，cache 只 `expose` 容器端口 `8088`。
- Runner 与 DinD 的 Docker port bindings 均为空，宿主 `ss` 无 `:8088` TCP
  listener；未新增公网或宿主端口。
- cache endpoint 已分别从外层 Runner 网络和真实 rootless DinD 内层临时容器访问
  成功；内层地址解析到 Runner 私网地址，未绕过 rootless DinD 边界。
- DinD 原 Unix socket、资源限制和持久数据卷保持不变；Runner 未获得宿主 Docker
  socket、host network、host PID 或新增 host-path 数据挂载。

## 5. Smoke 矩阵

### 5.1 Cold 首次运行（缓存链通过，安全门禁按设计阻断）

推送 `7e29fc83d80c...` 只创建以下两个 push run、共四个 Job；没有
`pull_request` run：

| Run / Job | DB ID / task | 状态或证据 |
| --- | --- | --- |
| `194 ci.yml` | `backend` job `821` / task `771` | 成功；cold Go miss/save，1626 s |
| `195 security.yml` | `backend` job `823` / task `772` | 成功；Go 精确 hit，61 s |
| `194 ci.yml` | `required` job `822` / task `773` | 成功；cold pnpm miss/save，108 s |
| `195 security.yml` | `required` job `824` / task `774` | pnpm 精确 hit；新 PostCSS 高危公告使安全检查失败，22 s |

Run `194` 于 `2026-07-23T16:18:53Z` 开始。首个 Go restore 明确记录 key
`gitea-go-linux-amd64-v1-d9e678...` 未命中且 `go-cache-hit=`；缓存故障容错没有
跳过真实门禁。步骤耗时为 backend unit 584 秒、backend integration 309 秒、lint
494 秒。Post action 于 `16:45:53Z` 明确记录 `Cache saved successfully`，随后
post-task maintenance 记录 `size_kib=1018616 filesystem_used_percent=16` 并按阈值
保留缓存。Job 完成前目录仅 28 KiB，save 后约 995 MiB，符合 archive 完成后才提交
cache 的时序。

Gitea 随后调度 security backend；同一 Go key 在 32 秒内恢复并明确输出
`go-cache-hit=true`，安全后端步骤 20 秒通过。CI Node Job 的首个 pnpm key
`gitea-pnpm-linux-amd64-v1-0ffec8...` 未命中，frontend 98 秒通过并保存约 4 MiB
cache；security Node Job 随后明确 `pnpm-cache-hit=true`。

四 Job 串行关键窗口为 `16:18:53Z`–`16:49:10Z`，共 1817 秒（30 分 17 秒），
相对旧同一 head 更新产生 push+PR 18 Job 的 4816 秒窗口减少 2999 秒，约 62.3%。
这不是完整 warm 对比，因为首个 Go/pnpm Job承担了 cold populate。

`ci / required (push)` 产生真实 success；`security / required (push)` 产生真实
failure。失败原因不是 cache、Runner 或 workflow 图：同一锁文件的 PostCSS 8.5.6
在 `12:14:02Z` 的旧安全 Job 仍输出 `Audit exceptions validated.`，而 `16:49:07Z`
的新 Job 从实时 advisory feed 检出刚发布的高危
[`GHSA-6g55-p6wh-862q`](https://github.com/advisories/GHSA-6g55-p6wh-862q)。官方范围为
`<=8.5.11`，修复版本为 `8.5.12`；门禁按设计阻止用漏洞例外掩盖新风险。

全部四个 task 结束后 maintenance 均执行并保留约 999 MiB cache。DinD
`memory.events` 与基线相同，`oom/oom_kill` 均为 0，容器未重启或 OOM；采样内存
最高约 4.55 GiB / 6 GiB，最终宿主文件系统使用率 16%。

### 5.2 修复后的首次运行（attempt 1，Go warm / pnpm cold）

对 `d283e13000c8fc957ff9832e196c43869fcf9b5a` 的首轮 push，run `196 ci.yml`
于 `2026-07-23T22:23:50Z`–`22:38:14Z` 运行 864 秒，run `197 security.yml` 于
`22:35:21Z`–`22:38:36Z` 运行 195 秒；四个 Job 在 capacity=1 下的串行关键窗口为
886 秒。Job `825`、`827`、`826`、`828` 分别为 691、62、111、22 秒。

七项门禁均通过：Go restore 为 32/33 秒、unit 199 秒、integration 165 秒、lint
286 秒、security-backend 21 秒、frontend 101 秒、security-frontend 13 秒。首个 Go
Job 复用未变化的 Go key，两个 Go restore 均为精确 hit；PostCSS lockfile 改变了
pnpm key，因此首个 pnpm Job miss/save，后续 pnpm Job 精确 hit。四个真实 push
context 均成功，名称与状态 ID 的精确映射见 5.5。

DinD 峰值为 4.209 GiB / 6 GiB，没有 OOM 或容器重启。真实 PostCSS 流水线的
production dependency audit 输出 `0 vulnerabilities` 与 `Audit exceptions validated.`；
这确认已推送补丁通过线上门禁，而非以 exception 绕过公告。

### 5.3 同 SHA warm rerun（attempt 2）

对 run `196`、`197` 各仅 rerun 一次。同一 SHA 的 ci run 为
`2026-07-23T22:39:52Z`–`22:54:20Z`（868 秒），security run 为
`22:51:30Z`–`22:54:45Z`（195 秒），四 Job 串行窗口为 893 秒。Job 耗时依次为
698、63、106、25 秒；Go restore 31/32 秒，unit 200 秒，integration 163 秒，lint
296 秒，security-backend 22 秒，frontend 98 秒，security-frontend 18 秒。

四次 Go/pnpm restore 均为精确 `cache-hit=true`，没有 miss/save；四个 push context
均成功，状态 ID 见 5.5。action cache 为 1004 MiB，DinD 峰值为
3.841 GiB / 6 GiB，未见 OOM 或容器重启。

### 5.4 精确 cache 清理与 cold fallback（attempt 3）

确认 active jobs 为 0 后，仅停止 Runner。只清理 `/data/cache/actions`：清理前为
3 个直接子项、1027304 KiB，清理后为 0 项、4 KiB；根目录仍为 `1000:1000 0700`。
`.runner` 内容及元数据未变，Runner `c56b4685eb91` 与 DinD `e1b3ef2e3cb5` 均保留。
API 确认 Runner `online` 且 `busy=false` 后才进入 cold fallback。

同一 SHA 对 run `196`、`197` 各仅 rerun 一次：ci run 为
`2026-07-23T22:58:04Z`–`23:27:50Z`（1786 秒），security run 为
`23:24:54Z`–`23:28:11Z`（197 秒），四 Job 串行窗口为 1807 秒。Job 耗时为
1609、64、112、21 秒；七项门禁全部通过：shell 0 秒、unit 581 秒、integration
316 秒、lint 511 秒、security-backend 22 秒、frontend 101 秒、security-frontend
13 秒。Go 首次 miss/save 后，后续 Job 在 34 秒内精确 hit；pnpm 首次 miss/save 后，
后续 Job 精确 hit。cache 重建为 1022864 KiB（约 999 MiB）；四个 context 均成功，
状态 ID 见 5.5。

DinD 峰值为 4.972 GiB / 6 GiB；从灰度前基线到 attempt 1–3 结束，
`memory.events` 始终为 `low 0`、`high 0`、`max 296`、`oom 0`、`oom_kill 0`、
`oom_group_kill 0`。两个容器 restart 均为 0，`OOMKilled=false`，结束时无 active
jobs 或遗留 Job 容器。

### 5.5 可比边界与结果

修复后同一 SHA 三轮 attempt 的 context 名称与成功状态 ID 保持以下精确顺序：

| Context | attempt 1 | attempt 2 | attempt 3 |
| --- | ---: | ---: | ---: |
| `ci / backend (push)` | `2681` | `2695` | `2709` |
| `security / backend (push)` | `2684` | `2698` | `2712` |
| `ci / required (push)` | `2687` | `2701` | `2715` |
| `security / required (push)` | `2689` | `2703` | `2717` |

旧基线是同一源分支 head 同时触发四个 workflow、18 个 Job 的 4816 秒串行窗口；本节
的 893 秒 warm 和 1807 秒 cold 均是修复后同一 SHA 的两个 push workflow、4 个 Job。
因此它们衡量的是“源分支提交获得两个 required push context”的端到端反馈路径，并不
声称代表尚未授权的 `main`/Gateway 部署图或 PR/fork 行为。

在该边界内，warm 相比旧基线减少约 81.5%，cold 相比旧基线减少约 62.5%；warm 相比
cold 少 914 秒，约 50.6%。缓存是性能层：清空后仍完成七项门禁和两个真实 contexts，
仅恢复正确的冷构建耗时。旧基线 `a6a70ecaf06b...` 与修复后
`d283e13000c8fc957ff9832e196c43869fcf9b5a` 并非同一提交，采样窗口也不同，故前两个
百分比是包含 Job 图、缓存及运行时波动的观察性路径对比，不能全部归因于缓存；同 SHA、
同四 Job 图下的 893/1807 秒更接近缓存状态本身的对照。

## 6. 诊断与最小修正

首次初始化器以 root 用户运行并在 `chown 1000:1000` 后执行 `chmod 0700`，但只保留
`DAC_OVERRIDE` 与 `CHOWN`；目录已不再归 UID 0 所有，因此 `chmod` 缺少
`FOWNER` 而失败。失败发生在启动新 Runner 之前，随后通过只读检查确认线上文件和
容器状态，再继续灰度。

修正后的初始化器显式使用 UID/GID `0:0`，先 `--cap-drop ALL`，仅恢复
`DAC_OVERRIDE`、`CHOWN`、`FOWNER`，保持无网络、只读根文件系统和
`no-new-privileges`。本地回归测试预置 `.runner`，连续初始化两次并证明三个目录
均为 `1000:1000 0700`、`.runner` 内容与元数据不变。该规则已同步到 Runner 运维
说明和 Trellis infra 合同。

Cold smoke 还捕获到上线窗口内新增的 PostCSS high advisory。未新增或延长 audit
exception；已将 `frontend/package.json` 的安全下限提升到 `^8.5.12`，pnpm 9.15.9
锁到官方最新 `8.5.22`，并同步其上游必需的 nanoid patch。补丁已作为
`e40f3ff66` 提交并随当前 tip `d283e13000c8fc957ff9832e196c43869fcf9b5a` 推送；上述
attempt 1–3 已在线上证明 Node 20 锁定镜像的生产依赖审计、ESLint、vue-tsc、96 个关键
Vitest 与真实 Vite/Tailwind/Autoprefixer/PostCSS production build 均通过。

## 7. 回滚准备与残余门禁

- 回滚备份和部署前哈希均已保留；在 smoke/观察完成前不删除备份。
- cache 是可重建性能层；失败时可先停止 Runner、恢复 config/compose、移除
  maintenance 脚本，再只重建 Runner。不得删除 Runner 注册卷或 DinD 数据。
- 当前证明单机 Runner 灰度、私网隔离，以及修复后源分支 push 的混合预热 attempt、
  四次 exact-hit warm rerun 和精确清理 cold fallback。内部 PR opening 与 head update、
  后续源分支 push、外部 Fork 隔离，以及故障传播/最终通知 Job 调度的新增证据见第
  8 节；故障 smoke 只证明 `needs`/`always()` 与最终通知 Job 调度，不替代真实通知投递。
  经批准合并后的真实 `main` 4 Job/七项各一次/镜像与部署/实际通知/Gateway，以及下一次
  scheduled security run 仍待单独授权或自然事件；任务保持 `in_progress`。

## 8. 内部 PR lifecycle smoke 与后续 source push（2026-07-24）

### 8.1 内部 PR opening smoke

在未合并 `main`、未触碰 Gateway 或部署的前提下，创建了保持 Draft 的内部 PR
[#10](https://git.211api.com/211api/211api/pulls/10)：

| 字段 | 观察值 |
| --- | --- |
| 创建时间（UTC） | `2026-07-24T01:12:54Z` |
| 标题 | `WIP: ci: 优化现有单机 Runner 流水线性能` |
| 状态 | `open`；`draft=true`；`merged=false`；`mergeable=false`；`allow_maintainer_edit=false` |
| head | `sync/upstream-0.1.164` / `484aba68c0d4d75417037a1adf3ee3375b9ad7f4` |
| base | `main` / `34be916c487f261f9e034c726be13c773be8489a` |

创建前、创建后及延迟复核均显示该 head 仅有 run `198`、`199` 两个已完成的
`event=push` run；`pull_request` run 计数为 0，未出现新的 Job 或 Runner 接单。
这只证明“打开内部 PR”不会追加受信 Runner 工作；head update 的独立证据见 8.3 节。

`main` 分支保护保持 `enable_status_check=true`，contexts 精确为
`ci / required (push)` 和 `security / required (push)`。该 head 的聚合 commit status
为 `success`、`total_count=4`，最新四个 context 均为 success：

| Context | 最新 status DB ID | 状态 |
| --- | ---: | --- |
| `ci / backend (push)` | `2723` | success |
| `security / backend (push)` | `2726` | success |
| `ci / required (push)` | `2729` | success |
| `security / required (push)` | `2731` | success |

因此，已确认受保护 context 的名称和成功状态与保护合同精确一致；不对 API 未直接暴露的
额外 rollup 字段作出声明。

### 8.2 自然后续 source push `484aba68...` 的 warm 观察

PR opening 前，同一 head 的自然后续 source push 已产生 run `198`、`199`，合计 4 个
Job；总关键跨度为 884 秒，四个 Job 耗时依次为 692、62、107、23 秒，合计同为 884
秒。四次 Go/pnpm restore 均为精确 `cache-hit=true`，没有 miss/save。此为第一次已发生的
后续源分支 push warm 观察；第二次及 PR head update 见 8.3 节，二者均不替代尚未执行的
`main` 运行或定时安全运行证据。

结束时 Runner 为 `online`、`busy=false`；action cache 保持 3 个直接子项、
`1022864 KiB`，目录为 `1000:1000 0700`。Runner 与 DinD restart 均为 0，
`OOMKilled=false`；DinD 峰值内存为 4.445 GiB，`memory.events` 为：

```text
low 0
high 0
max 296
oom 0
oom_kill 0
oom_group_kill 0
```

### 8.3 PR head update 与第二次后续 source push `803bda0a...`

已批准提交 `803bda0a3d81bdcf1854769c11420a8529ad0aa4` 在
`2026-07-24T01:42:56Z` 更新 PR #10 head。更新时及随后复核，PR 始终保持
`open`、`draft=true`、`merged=false`；base 仍为 `main` /
`34be916c487f261f9e034c726be13c773be8489a`。因此本节记录的是一次真实内部 PR head
update，而不是打开 PR 的重述，也不涉及合并、`main`、Gateway 或部署。

该 SHA 只创建 run `200`（`ci.yml` / `push`）和 run `201`（`security.yml` / `push`），
恰好为 Job `833`–`836` 四个 Job；没有 `pull_request` run、重复 run 或其他 Job，四个
Job 均在 attempt 1 成功。run `200` 为 871 秒，run `201` 为 195 秒；capacity=1 下总关键
跨度为 893 秒。Job 耗时依次为 698、65、108、21 秒；关键步骤耗时为 Go restore 32/34 秒、
unit 199 秒、integration 164 秒、lint 293 秒、security-backend 23 秒、frontend 98 秒、
security-frontend 14 秒。

四次 Go/pnpm restore 都是精确 `cache-hit=true`，均记录 `Cache restored`，没有 miss 或
save；安全审计输出 `0 vulnerabilities`，前端审计输出 `Audit exceptions validated.`。
action cache 保持 `1022864 KiB`。四个真实 push context 均为 success：

| Context | status DB ID | 状态 |
| --- | ---: | --- |
| `ci / backend (push)` | `2737` | success |
| `security / backend (push)` | `2740` | success |
| `ci / required (push)` | `2743` | success |
| `security / required (push)` | `2745` | success |

DinD 峰值为 4.179 GiB / 6 GiB；`memory.events` 保持 `low 0`、`high 0`、`max 296`、
`oom 0`、`oom_kill 0`、`oom_group_kill 0`。Runner/DinD 身份保留，restart 均为 0，
`OOMKilled=false`；结束时没有 active 或遗留 Job。至此，run `198`/`199` 的 `484aba68...`
与 run `200`/`201` 的 `803bda0a...` 构成两个已观察的后续源分支 push。

### 8.4 外部 Fork 首次 fail-closed 尝试（2026-07-24）

在用户明确授权后，按临时对象边界创建了用户
`runner-fork-smoke-0724`（ID `9`，`admin=false`、`restricted=false`、
`visibility=private`）。对 canonical 仓库的 direct collaborator 纠正写入返回 HTTP
`204`，随后回读为 `read`。唯一 PAT 的元数据为 ID `17`、名称
`runner-fork-smoke-0724`、scope 仅 `write:repository`；令牌值从未输出或写入任务记录。

创建的 Fork 为 ID `3`、`runner-fork-smoke-0724/211api`，`private=true`、`fork=true`，
parent 为 canonical ID `1` / `211api/211api`。但 API 回读 `has_actions=false`。这是预设的
fail-closed 条件，因此立即停止：没有 marker branch 或 commit、没有 Fork Action run、没有
外部 PR、没有向 canonical status API 发出哨兵请求。故本次尝试不能证明“不调度受信
Runner”或“不能满足 push contexts”，也不构成 AC2 外部 Fork 隔离完成证据。

清理在 `2026-07-24T02:31:05Z` 完成，顺序为 Fork、canonical collaborator、精确 PAT、
临时用户；四个 DELETE 均返回 HTTP `204`。回读 temporary user/repository/collaborator
均不存在，canonical Fork 数恢复为 `0`，PR 列表仍只有 #1–#10；内部 PR #10 保持
`open`、`draft=true`、`merged=false`，head 仍为 `803bda0a...`。主会话随后以 exact
path/realpath/root-owner guard 单次删除 `/run/gitea-runner-fork-smoke-0724` 并验证不存在。

清理后 cache 仍为 `1022864 KiB`、`1000:1000 0700`、3 个直接子项；
`memory.events` 仍为 `low 0`、`high 0`、`max 296`、`oom 0`、`oom_kill 0`、
`oom_group_kill 0`。Runner DB 仍为 `repo_id=1`，完整 verifier 输出
`Gitea repository verification passed (full).`。未改动 main、Gateway、Runner 或 cache。

在本次首次尝试结束时，若要完成真实外部 Fork smoke，尚需新增授权：仅临时 PATCH Fork 的
`has_actions=true`，再重新创建隔离对象，完成有界观察与精确清理；不得将本次 fail-closed
尝试本身描述为成功的 Runner 隔离验证。该新增授权后来已取得，结果见 8.5 节。

截至首次尝试结束时，外部 Fork 完整负面 smoke 尚未完成；其后续完成证据见 8.5 节。故障
注入阻断、合并后的 `main`/Gateway/部署/通知及定时安全运行仍未完成；PR #10 保持 open
Draft。

### 8.5 外部 Fork Actions 隔离负面 smoke（2026-07-24）

在对“仅临时启用该 Fork Actions”获得单独授权后，重新创建临时用户 ID `10`（仍为
`admin=false`、`restricted=false`、`visibility=private`）、canonical read collaborator 与
仅含 `write:repository` 的 PAT ID `18`；敏感值仅位于 root-only `0700` 运行目录中的
`0600` 文件，未写入本记录。创建私有 Fork ID `4` 后，回读其 `parent.id=1`、
`private=true`、`fork=true`、Actions secrets 为空。唯一的额外配置 mutation 是对这个临时
Fork 的 `PATCH {"has_actions":true}`，返回 HTTP `200` 并回读为 true；没有修改 canonical。

从精确 base `803bda0a3d81bdcf1854769c11420a8529ad0aa4` 创建
`smoke/fork-runner-boundary-20260724`，再单次添加唯一 marker
`.gitea-fork-smoke-20260724.md`。产生的 commit 为
`7a959a11c2747eb43a0cdf1bae7975688c099251`，其唯一 parent 精确为该 base。该 Gitea
版本的 compare API 只返回 commits 而不返回 files；因此以 marker contents 路径、branch
head 和 Git commit parent 三项交叉核验“仅 marker diff”，不将缺失的 compare files 字段
伪称为 API 证据。

该唯一 SHA 在 Fork ID `4` 上真实产生两条 `push` Action run：`204` (`ci.yml`) 与
`205` (`security.yml`)；DB job 为 `841`–`844`。四个 job 的 `task_id` 均为 `0`，该 SHA/
Fork 在 `action_task` 中没有记录，故不存在 `runner_id=1` 的接单。canonical API Runner
保持 `busy=false`，canonical action_run 的最新记录仍为既有 `200`/`201`，没有该 unique SHA
或随后外部 PR 的 `pull_request` run。Fork secrets 全程为空，cache 始终为
`1000:1000 0700`、`1022864 KiB`、3 个直接子项；Runner/DinD ID、restart、OOM 和
`memory.events` 也都未变化。

随后创建 WIP 外部 PR #`11`（base `main`、Fork head 为上述 SHA）。首次 create body 误用了
`maintainer_can_modify` 字段；Gitea 仍以 HTTP `201` 创建 PR，但忽略该未知字段，初始回读
`allow_maintainer_edit=true`。没有重放创建，而是依据 live OpenAPI 用一次
`PATCH {"allow_maintainer_edit":false}` 修正，返回 HTTP `201`。观察期间 PR 始终
open/draft/unmerged，未尝试 merge；WIP 不暴露可合并性，因此不声称“因 contexts 不能合并”。
保护合同仍精确要求两个 `(push)` context，而 unique SHA 在 canonical scope 中没有任何
status。临时 PAT 对 canonical 仅提交非 required context
`runner-fork-smoke / forbidden`，返回 HTTP `403`；canonical status API 为空，DB 也确认
该 SHA 的四个 pending context 都只属于 Fork repo ID `4`，canonical repo ID `1` 中不含
sentinel 或任一 required context。没有尝试写入真实 required context。

清理顺序为关闭 PR #`11`（HTTP `201`，closed/unmerged）、删除 Fork（`204`）、删除
canonical collaborator（`204`）、用临时用户 Basic API 撤销精确 PAT ID `18`（`204`）、
purge 删除用户 ID `10`（`204`）。最终 API/DB 均显示 user、Fork 与 collaboration 为 0；
Fork 数恢复 0，canonical collaborators 恢复四个 service accounts；内部 PR #`10` 仍为
open/draft/unmerged、head `803bda0a...`。运行目录也已删除。删除 Fork 后，其 live
`action_run`、`action_run_job` 与 Fork `commit_status` 行被级联清除，因此 run `204`/`205`、
job `841`–`844` 及四个 Fork pending contexts 是清理前的有界观测证据，不能描述为当前仍
存在的 Action 记录。关闭的外部 PR #`11` 与请求审计日志仍保留；PR API 仍返回 unique SHA，
但删除 Fork 后 `head.repo` 为空，DB 则保留历史 `head_repo_id=4`。该 SHA 仍可从 canonical
PR ref 读取，且唯一 parent 仍为 `803bda0a...`。这些是已接受的残留痕迹，而不是仍存活的
临时 Fork 对象。`verify-repository --full ... 803bda0a...` 通过。此处证明的是 Fork 不会调度
repo-scoped trusted Runner 且不能向 canonical 写入 status；不替代尚未授权的故障、main
部署图或定时运行门禁。

### 8.6 PR 当前 head `7b9bc28...` 的后续 source push warm 观察

PR #10 当前仍为 `open`、`draft=true`、`merged=false`，base 仍为 `main`
`34be916c487f261f9e034c726be13c773be8489a`，head 已更新为
`7b9bc28b7a8a63e185c4f6b1d117bcf56250b04f`。该 head 仅产生 run `206`（`ci.yml` /
`push`）和 run `207`（`security.yml` / `push`），各 2 个 Job，Job `845`–`848` 均成功；
没有新增 `pull_request` run。四次 Go/pnpm restore 均为精确 `cache-hit=true`，没有 miss
或 save。这是继 run `198`/`199` 与 `200`/`201` 后的又一次 4 Job warm 路径观察。

### 8.7 一次性故障阻断 smoke（2026-07-24）

在不触碰真实 `main`、Gateway、Registry 或真实通知的边界内，从当前 PR head
`7b9bc28b7a8a63e185c4f6b1d117bcf56250b04f` 创建一次性精确分支
`ci-smoke-fail-gate-7b9bc28b7a8a63e1`。审定补丁 SHA-256 为
`88b46f46f3e98e99a2a73f9ec697e3588f6dd8e7eda33822401240091d43b397`；临时 commit
`9f6842272adf52136543ad40c9254d27d75dd2fc` 的唯一 parent 是该 base，且仅改动三份文件、
共 71 insertions。该 SHA 恰好创建 run `208`（`push`、disposable workflow）；overall
`failure` 是预期通过，未产生额外 CI 或 Security run。

| Job | Job / task / Runner | 结论与日志证据 |
| --- | --- | --- |
| `backend` | `849` / `799` / `1` | `failure`；记录 intentional exit `86`。 |
| `verify` | `850` / `800` / `1` | `failure`；记录 `backend-result=failure`。 |
| `build-and-deploy` | `851` / `0` / `0` | `skipped`；step log HTTP `404`，没有 `UNREACHABLE`。 |
| `telegram-notification` | `852` / `801` / `1` | `success`；记录 `verify-result=failure build-deploy-result=skipped`。 |

该 disposable workflow 没有 secrets、URL、外部 action、Registry、Gateway 或真实通知。
因此它只证明生产等价 Job 图中的 `needs` 失败传播、`always()` 与最终通知 Job 调度；不证明
真实通知投递，也不替代真实 `main` 的构建、部署或通知证据。

运行后不变量保持：`main` 仍为
`34be916c487f261f9e034c726be13c773be8489a`；PR #10 仍为 open/draft/unmerged，head 为
`7b9bc28...`；Runner idle。Runner/DinD restart 均为 `0`、`OOMKilled=false`；cache 为 3 个
直接子项、`1022864 KiB`、`1000:1000 0700`；DinD `memory.events` 的 `oom=0`、
`oom_kill=0`。清理后精确远端 branch API 返回 `404`，本地精确 worktree/ref/directory
均不存在；历史 run `208` 与四个 Job 保留，未触碰其他 worktree。独立 trellis-check 已
PASS，未发现证据缺口。

### 8.8 PR 当前 head `ee9d38f...` 的最新 source push warm 观察

PR #10 仍为 `open`、`draft=true`、`merged=false`，base 仍为 `main`
`34be916c487f261f9e034c726be13c773be8489a`；当前 head 为
`ee9d38f851e602d7bc0c65c81e8de75cc228ba9d`。该 SHA 恰好产生 run `209`
（`ci.yml` / `push` / success，878 秒）和 run `210`（`security.yml` / `push` /
success，192 秒）；没有 `pull_request`、`deploy`、`release` 或重复 run。本次观察未
触碰 `main`、Gateway、Registry、真实通知或部署；历史 run `208` 保留。

在 `capacity: 1` 下，四个 Job 的首尾精确串行为
`2026-07-24T05:23:39Z`–`05:38:39Z`，关键窗口为 900 秒：

| Run / Job | Job / task / Runner / attempt | 时间（UTC） | 耗时 |
| --- | --- | --- | ---: |
| `209 ci.yml` / `backend` | `853` / `802` / `1` / `1` | 05:23:39–05:35:27 | 708 s |
| `210 security.yml` / `backend` | `855` / `803` / `1` / `1` | 05:35:27–05:36:30 | 63 s |
| `209 ci.yml` / `required` | `854` / `804` / `1` / `1` | 05:36:30–05:38:17 | 107 s |
| `210 security.yml` / `required` | `856` / `805` / `1` / `1` | 05:38:17–05:38:39 | 22 s |

七项门禁各执行一次并成功：Shell 1 秒、unit 201 秒、integration 164 秒、lint
302 秒、backend vulnerability 22 秒、frontend 98 秒、frontend audit 13 秒。四个 Job
各有一次成功 restore，均为精确 `cache-hit=true`；`false`、空值、miss 与 save 均为 0。
两个 Go restore 各为 32 秒，两个 pnpm restore 均小于 1 秒。

该 SHA 的聚合 commit status 为 `success`，最新四个 context 均为 success；`main` 分支
保护仍只要求 `ci / required (push)` 与 `security / required (push)`。结束时 Runner 为
`online`、`busy=false`、`capacity=1`；Runner/DinD restart 均为 0，`OOMKilled=false`，
没有端口发布，资源边界仍为 Runner `512 MiB / 0.5 CPU` 与 DinD `6 GiB / 3 CPU`。
action cache 是 `1000:1000`、`0700` 的普通目录，大小 `1022864 KiB`、3 个直接子项；
`memory.events` 为 `max 296`、`oom 0`、`oom_kill 0`。`memory.peak=6442455040` 仅记录为
容器生命周期累计峰值，不能归因于本轮运行。独立 trellis-check 已 PASS。

## 9. PR #10 合并与 `main` 部署观察（2026-07-24）

### 9.1 内容无变化同步合并与 source 验证

PR #10 在 Ready 后以 fast-forward-only 发起一次合并请求，HTTP 返回 `200`；于
`2026-07-24T07:00:22Z` 合并并关闭，将 `main` 推进到合并前已存在的 source sync commit
`95b94297ac236df9eb9fda68ebde53e8f81e2ba0`。该 commit 的 parents 精确为
`1a9d258543d5c808da34f625703c0e02cdbdc902` 与
`34be916c487f261f9e034c726be13c773be8489a`；其 tree 与 `1a9d...` 完全相同。合并后
`main` 与保留的 source branch 均指向该 SHA。

该 source SHA 先产生成功的 `push` run `213`（ci）与 `214`（security）。在
`capacity: 1` 下，Job/task/Runner/attempt 均为 `1/1`，严格串行窗口为 927 秒：

| Run / Job | Job / task | 耗时 |
| --- | --- | ---: |
| `213 ci` / `backend` | `861` / `810` | 732 s |
| `214 security` / `backend` | `863` / `811` | 62 s |
| `213 ci` / `required` | `862` / `812` | 109 s |
| `214 security` / `required` | `864` / `813` | 22 s |

四次 Go/pnpm restore 均为精确 `cache-hit=true`；七项门禁各执行一次且成功，四个 commit
context 均为 success。独立 check 为 PASS。

### 9.2 `main` 的唯一 deploy run、镜像与 Gateway 对齐

该 `main` push 只产生唯一 `deploy.yml` run `215`，结论 `completed/success`，窗口为
`2026-07-24T07:00:26Z`–`07:18:29Z`、总时长 1083 秒（18 分 03 秒）。四个 Job 在 Runner
`1`、attempt `1` 严格串行：`backend` job `865` 为
751 秒、`verify` `866` 为 119 秒、`build-and-deploy` `867` 为 200 秒、
`telegram-notification` `868` 为 6 秒。Go/pnpm 均为精确 cache hit，七项门禁仍各执行
一次；BuildKit/export、Registry push 与 Gateway deploy 均各执行一次，`early-exit=0`。

job `867` 原始 BuildKit 日志显示既有层有 10 个精确 `CACHED` step：`#3`、`#12`、`#14`、
`#15`、`#28`、`#29`、`#30`、`#31`、`#32`、`#33`，随后 `#39 exporting layers` 完成。这
关闭 AC4 对 BuildKit 命中的证据缺口；它只证明这些适用的既有层命中，不表示所有构建层均命中。
PRD R3 的 BuildKit 容量语义也已由随后取得的权威 live inspect 关闭：锁定
`docker:29.6.1-dind-rootless@sha256:371962f4344295a1eb185f1c9e62064bf4503a7beb8c6e73be3405500041784b`
运行 Docker Engine Community 29.6.1、BuildKit v0.31.1，builder `default`、driver
`docker`、status running。没有 `/home/rootless/.config/docker/daemon.json` 或
`/etc/docker/daemon.json` override，持久 `docker_data` 位于
`/home/rootless/.local/share/docker`。inspect 直接显示四条自动 GC policy：rule0 为
filtered `type==source.local`、`type==exec.cachemount`、`type==source.git.checkout`，
Keep Duration 48h、Max Used Space 4.118GiB；rule1–2 为非 `All` 的有界 policy；rule3 为
最终 `All=true` policy。后三条均显示 Reserved 29.8GiB、Max Used Space 234.7GiB、
Min Free Space 58.67GiB，满足正值且 max 大于 reserved。数值只作为当前
image/storage 环境证据；升级 DIND digest、改变磁盘或出现 daemon override 后必须重新
inspect/验证。Docker 文档说明 docker driver 通过 daemon 配置按 policy 周期 GC；本次
以 live inspect 为更高权威来源。该证据证明 active bounded policy，而非一次 GC sweep、
阈值触发或自动删除事件；未执行 prune。

Registry 不可变 SHA tag 与 `:main` 的 digest 都为
`sha256:0ee9306b679ca1cc4e0c437b63796aeb0a9c8ff905607333136b8f6c802a15e2`，并且是单一
OCI `linux/amd64` 镜像，revision 为 `95b94297ac236df9eb9fda68ebde53e8f81e2ba0`。
Gateway 的 `main_head`、`state.commit` 与 `current_image` 同此 revision 对齐；备份为
`20260724T071747Z-95b94297ac236df9eb9fda68ebde53e8f81e2ba0`，`deployed_at` 为
`2026-07-24T07:18:18Z`，并且
`ready=true`、`health=true`、`state_env_consistent=true`、`intervention_required=false`。

资源不变量均通过：Runner/DinD restart 为 0，OOM 为 0；`memory.events` 保持
`max 296` 且所有 `oom*` 字段为 0；没有 host listener、新残留容器或 cache 异常。

### 9.3 最终通知的失败边界（未通过）

尽管 job `868` 的 API 结论为 success，实际日志明确输出
`Deployment notification delivery failed; deployment result is unchanged.`；记录为
`skip=0`、`delivery_failed=1`。因此本次只能证明最终通知 Job 被调度及其失败未改变已经
成功的部署结果，**不能证明 adapter 已接受通知，也不能证明 Telegram 收件**。

针对该次 `main` live 观察，独立 Trellis 最终判定为 FAIL，其中唯一失败项为实际通知投递；
其余本次 main deploy、Registry、Gateway、cache 运行状态与资源不变量均已通过。这不表示任务
整体只剩通知：下次 scheduled security 与当前 workflow 的非 `v*` tag 负面 smoke 也仍保持待办。

只读历史诊断表明，这不是已知的连续通知故障：最近一次 adapter accepted 为 run `192` /
job `817`（SHA `34be...`，`2026-07-23T14:17:16Z`–`14:17:20Z`），结论 success，实际
`skip=0`、`delivery_failed=0`、`guard accepted=1`。更早的 run `185` / job `780`
（SHA `9ced...`，`2026-07-22T17:20:26Z`–`17:20:31Z`）亦为相同的 success/实际结果；
run `178` 与 `171` 尚无 notification job。故 run `215` 是当前观察到的单次失败，不能据此
断言历史连续故障。

`gitea-backup.service` 在 `2026-07-24 02:30:28`–`02:32:26` CST 的执行为
success/exit `0`，其 preflight `non-2xx=0`；但该 preflight 在 Telegram 配置或调用之前
直接返回 HTTP 200。因此它只证明当时 endpoint 返回 2xx，不能证明 Telegram 分支已执行或
投递成功。现有记录仍不足以区分瞬时网络、非 2xx、contract/JSON、Pipedream 配置或 Telegram
失败，实际通知 gate 必须保持未完成。

## 10. run 215 通知失败后的安全诊断增量与保留源分支观察

本节记录通知诊断补丁的本地回归，以及其已推送到保留源分支后的只读观察。诊断实现 commit
`6bcdf666fe8ead91fec9530522e7ffe9378be6d0` 及证据补充 commit
`aadcc6cd78e9651bbfc0375e0db97f72d3e8a846` 均已推送至
`sync/upstream-0.1.164`；但尚未进入 `main`、未触发 deploy，Gateway、Registry 和真实通知
均未触碰。因此 **不表示 run 215 已修复，也不证明 adapter 接受或 Telegram 收件**；§9 的失败
结论保持原样。

### 10.1 本地补丁的边界与行为合同

该已推送诊断补丁新增 `deploy/gitea/tests/test-deploy-notification.sh`，并修改
`.gitea/workflows/deploy.yml`、已跟踪的 `.trellis/spec/infra/gitea-single-runner-ci.md`、
`deploy/gitea/tests/test-workflow-contract.sh`、`deploy/gitea/README.md` 与 `DEV_GUIDE.md`。
通知适配器将结果限制为安全 outcome marker：
`skipped`、`endpoint-validation`、`input-validation`、`timeout`、`network`、
`http-3xx-<status>`、`http-4xx-<status>`、`http-5xx-<status>`、`http-other` /
`http-other-<status>`、`invalid-json`、`response-contract`、`accepted`。其中
`accepted` 仅表示 adapter 收到符合预期的 2xx JSON，仍不能证明 Telegram 收件。Phase 3.3
已按七段 code-spec 同步补齐：notification env、7-field payload、accepted response、endpoint
与 soft-fail、error matrix、good-base-bad 以及 27-case test/wrong-correct；独立
trellis-check 对该 infra spec sync 为 PASS。

Pipedream endpoint 只接受 HTTPS 与严格的 raw authority/host 校验；会拒绝 userinfo、显式
端口、空白和 host-confusion 输入。调用最多一次 fetch，使用 15 秒 `AbortController` 超时及
`redirect: manual`；不会输出 endpoint、payload、response 或 error。所有直接
`process.exit` 已移除，确保 marker 刷新及 timer 的 `finally` 清理；外层仍为 soft-fail，
不会改变既有部署结果。

### 10.2 本地测试与防泄漏验证

新增通知测试从 workflow 以 fail-closed 方式精确提取唯一 step/run block；其 `PATH` 仅含
`node`/`date`，通过 `NODE_OPTIONS` 注入 fetch mock，并拒绝额外网络客户端。27 个场景均覆盖
完整 request/response/error/endpoint canary、防泄漏、fetch 调用次数 `0/1`、timer clear 与
success/failed payload。独立 trellis-check 两轮（含 Phase 3.3 infra spec sync）均为 PASS；
主 Agent 最终复验以下项目均通过：

```text
bash -n
ShellCheck
deploy/gitea/tests/test-deploy-notification.sh
deploy/gitea/tests/test-workflow-contract.sh（含 failure-gate）
./tools/gitea-ci.sh shell-syntax
git diff --check
```

广域本地回归已执行的 12/12 项均 PASS。相邻 image/lifecycle 检查中，
`docker-actions` 与 `registration-token` 为 PASS；`go-actions-image` 因锁定 Node 基础镜像
本机缺失、为避免再次联网而 SKIP，故本轮增量不宣称全量二元 PASS。`actionlint` 与 `yamllint`
未安装；本增量没有适用的类型检查项。

### 10.3 DinD 偏差、清理与残余风险

rootless DinD smoke 中，内层 daemon 因本地没有 Alpine 缓存而一次性从 Docker Hub 拉取锁定
摘要；临时容器、网络和卷均已清理，主 Agent 复核不存在 `gitea-runner-smoke` 残留。该本地
网络行为未触发真实通知或任何远端修改。补丁随后仅推送至保留源分支，仍需在获得授权后合并进
`main`，并通过一次新的真实 `main` 通知路径观察 adapter 实际接受与 Telegram 收件；scheduled
security 的自然事件证据也仍未完成。

### 10.4 保留源分支 `aadcc6cd...` 的最终只读观察

已推送的 `aadcc6cd78e9651bbfc0375e0db97f72d3e8a846` 位于保留源分支
`sync/upstream-0.1.164`。该 SHA 只创建两条 `push` run：run `216`
`ci.yml@refs/heads/sync/upstream-0.1.164` 在 `2026-07-24T08:50:10Z`–
`09:05:34Z` completed/success；run `217`
`security.yml@refs/heads/sync/upstream-0.1.164` 在 `09:02:25Z`–`09:05:57Z`
completed/success。没有 `pull_request`、deploy、release 或重复 run。

在 `capacity: 1` 下，四个 Job 均为 Runner `1`、attempt `1`、success，严格串行，总窗口
947 秒：

| Run / Job | Job / task | 时间（UTC） | 耗时 |
| --- | --- | --- | ---: |
| `216 ci` / `backend` | `869` / `818` | 08:50:10–09:02:25 | 735 s |
| `217 security` / `backend` | `871` / `819` | 09:02:25–09:03:33 | 68 s |
| `216 ci` / `required` | `870` / `820` | 09:03:33–09:05:34 | 121 s |
| `217 security` / `required` | `872` / `821` | 09:05:35–09:05:57 | 22 s |

七项门禁均只执行一次且成功：shell-syntax 0 s、backend-unit 209 s、backend-integration
168 s、lint 312 s、security-backend 25 s、frontend 111 s、security-frontend 14 s。四次
restore 均成功且均为精确 `cache-hit=true`（Go 2 次、pnpm 2 次）；miss、save、restore failure
和 save failure 均为 0。action cache 为 `1022864 KiB`、`1000:1000`、`0700` 的普通目录，
文件系统使用率为 17%。

该 commit 的 aggregate status 为 `success`、`total_count=4`，四个 context 均为 success；
`main` 保护仍精确要求 `ci / required (push)` 与 `security / required (push)`。完成后
pending/queued/in_progress run 均为 0；Runner API id `1` 为 `online`、`busy=false`，Runner 与
DinD 均 running（DinD healthy），restart 为 0、`OOMKilled=false`。Runner `memory.events`
`max=83534`、`oom*=0`，DinD `max=296`、`oom*=0`，且 08:45Z 后 kernel OOM marker 为 0；资源
快照为 Runner `38.93 MiB / 512 MiB`、DinD `764.4 MiB / 6 GiB`。内层容器为 0/0、published
bindings 为 0，宿主 `8088`/`2375`/`2376` listener 为 0。DinD build cache 为 22.72 GB（其中
20.01 GB reclaimable），文件系统仍仅使用 17%；这些仅作记录，未执行清理。与本节随后取得的
`buildx inspect default` 自动 GC policy 证据共同满足 R3 的容量语义，但不构成发生过自动删除的证明。

这次观察不涉及 `main`、deploy、Gateway、Registry 或真实通知，不能作为 run `215` 修复、adapter
接受或 Telegram 收件的证据。scheduled security 的自然事件、当前 workflow 的非 `v*` tag
负面 smoke、合并后真实 `main` 通知验证仍待办；R3/BuildKit 容量语义已由上述默认自动
GC policy 与 live inspect 解决。
