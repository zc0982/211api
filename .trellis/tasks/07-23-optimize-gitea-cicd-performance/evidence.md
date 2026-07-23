# 单机 Gitea Runner 灰度与 Smoke 证据

## 1. 证据边界

- 授权范围：仅优化并灰度现有单机 Runner；允许推送当前分支、执行同 SHA 的
  cold/warm smoke 及停 Runner 后清空精确 action cache 的 cold fallback。
- 分支：`sync/upstream-0.1.164`。
- 被测提交：`7e29fc83d80c...`，由仓库提交 `8a133c006`、`da3ee16e1`、
  `7e29fc83d` 组成。
- 线上窗口从 `2026-07-23T16:12:54Z` 开始，所有时间均为 UTC。
- 未合并 `main`，未修改或部署 Gateway；内部 PR/fork、`main` 部署图和后续定时运行
  仍是独立 live gate，不能由本文现有证据替代。

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

### 5.2 同 SHA warm rerun

原计划对 run `194`、`195` 各调用一次 Gitea 原生 rerun。由于实时安全门禁发现了
与 Runner 优化无关的新漏洞，未浪费 Runner 重跑已知不安全的旧 SHA。先将直接依赖
的安全下限改为 PostCSS `^8.5.12`，锁文件解析到官方最新补丁 `8.5.22`，再以新的
单一 SHA 重新建立 cold/warm 证据；不得把旧、新 SHA 的耗时混作同一对照。

### 5.3 清 cache 后 cold fallback

待修复 SHA 的 warm 证据完成后停止 Runner，只校验并清空命名卷中的
`/data/cache/actions` 直接子项，再启动同一 Runner 并 rerun 同 SHA。不得删除
`.runner`、整个 `gitea-runner-data`、`docker_data` 或 Action clone cache。待记录
首次 miss/save、七项门禁、contexts、耗时与 OOM 增量。

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
exception；本地仅把 `frontend/package.json` 的安全下限提升到 `^8.5.12`，pnpm
9.15.9 锁到官方最新 `8.5.22`，并同步其上游必需的 nanoid patch。Node 20 锁定镜像
中已通过生产依赖审计、ESLint、vue-tsc、96 个关键 Vitest 和真实 Vite/Tailwind/
Autoprefixer/PostCSS production build。该补丁尚未提交或推送，需单独提交确认。

## 7. 回滚准备与残余门禁

- 回滚备份和部署前哈希均已保留；在 smoke/观察完成前不删除备份。
- cache 是可重建性能层；失败时可先停止 Runner、恢复 config/compose、移除
  maintenance 脚本，再只重建 Runner。不得删除 Runner 注册卷或 DinD 数据。
- 当前只证明单机 Runner 灰度、私网隔离和源分支 smoke。内部 PR 无新增 run、fork
  负面行为、故障阻断、`main` 4 Job 自包含部署图、最终通知和后续定时安全运行仍待
  单独授权或自然事件；任务保持 `in_progress`。
