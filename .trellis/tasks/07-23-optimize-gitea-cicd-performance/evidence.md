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
- 未合并 `main`，未修改或部署 Gateway；内部 PR 的 opening/head update 与外部 Fork
  隔离均已验证，但故障阻断、`main` 部署图和后续定时运行仍是独立 live gate，不能由
  本文现有证据替代。

## 2. 优化前基线

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
  两次后续源分支 push 与外部 Fork 隔离的新增证据见第 8 节；故障阻断、`main` 4 Job
  自包含部署图、Gateway 与最终通知及定时安全运行仍待单独授权或自然事件；任务保持
  `in_progress`。

## 8. 内部 PR lifecycle smoke 与两次后续 source push（2026-07-24）

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
