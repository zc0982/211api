# 验证与证据矩阵

## 1. 关键不变量

- 同步分支目标 `X.Y.Z` 与 `backend/cmd/server/VERSION` 必须一致。
- backend PR 与 main push 必须运行同一个 `make test-race-service`。
- race 失败必须传播到 `ci-ok`；main 的 Deploy 必须等待同 SHA `ci-ok`。
- 部署成功必须同时满足 image digest、health 和运行中 binary version。
- 并行测试不得通过 cleanup 包装未同步的进程级全局写入。

## 2. Requirement → Evidence

| ID | Requirement | 自动化证据 | 状态 |
| --- | --- | --- | --- |
| R01 | 正式 tag 同步与 VERSION 规范化 | `verify-version-test.sh` 的 11 个 sync match/mismatch、branch/semver/file cases | 通过 |
| R02 | 版本传播与运行中断言 | `test-version-integrity` 通过；`go run ./cmd/server --version` 输出 `Sub2API 0.1.179`；Deploy build-arg/runtime 结构测试通过 | 通过 |
| R03 | PR/main 等价 race | workflow 结构测试通过；最小历史 repro 连续 5 轮通过；完整 `test-race-service` 最终通过 | 通过 |
| R04 | 并行测试共享状态隔离 | Antigravity Base URL 参数注入回归；最小 race 组合连续运行无 DATA RACE | 通过 |
| R05 | 同 SHA 部署门禁 | `deploy/tests/release-delivery-integrity-test.sh` 锁定 `wait-ci`、race 聚合、build args 与运行中容器检查 | 通过 |

## 3. 标准命令

```bash
make -C backend test-version-integrity
backend/scripts/verify-version.sh --expected 0.1.179
go -C backend run ./cmd/server --version
```

历史 race 最小组合：

```bash
go -C backend test -tags=unit -race -count=1 ./internal/service \
  -run '^(TestRetryLoop_ErrorPolicy_NoPolicy_OriginalBehavior|TestAntigravityRetryLoop_SmartRetryFailed_StickySession_SwitchErrorPropagates)$'
```

完整门禁与回归：

```bash
make -C backend test-race-service
make -C backend test-unit
make -C backend test-integration
```

Shell/仓库检查：

```bash
sh -n backend/scripts/verify-version.sh
sh -n backend/scripts/tests/verify-version-test.sh
git diff --check
```

## 4. 红/绿验收

### 4.1 stale VERSION 必须为红

fixture 写入 `0.1.178` 并指定 `--branch sync/upstream-0.1.179`：命令 MUST 非零退出，消息同时包含 `expected=0.1.179 actual=0.1.178`。

### 4.2 matching VERSION 必须为绿

同一 fixture 写入 `0.1.179`：命令 MUST 零退出。显式 expected `v0.1.179` MUST 规范化并通过；VERSION 文件自身带 `v`、pre-release、空文件或额外行 MUST 失败。

### 4.3 race 必须在 merge 前可见

backend PR 的 Actions graph MUST 包含 `race-service`，其命令与 main push 完全相同。不能向 main 推送故意 race；由历史最小 repro 的回归测试和 `-race` suite 证明该类缺陷会令 PR job 非零退出。

### 4.4 运行中版本必须匹配

Deploy 日志 MUST 记录 expected version、SHA image digest 和解析后的 running version。任一为空或不相等时 job MUST 失败并输出 Compose 状态与有界日志。

## 5. OpenSpec 校验

优先运行：

```bash
openspec validate add-release-delivery-integrity --type change --strict --no-interactive
openspec show add-release-delivery-integrity
```

若环境没有 OpenSpec CLI，验收记录必须明确“CLI 未执行”，并人工确认 `.openspec.yaml`、proposal/design/tasks/verification、`ADDED Requirements`、每条 Requirement 的 Scenario 和本矩阵均存在；不得把人工结构检查写成 strict validate 通过。

## 6. 2026-08-20 实施验证记录

- OpenSpec CLI 1.10.0：`openspec validate add-release-delivery-integrity --type change --strict --no-interactive` 返回 valid；`openspec status` 显示 4/4 planning artifacts complete；`openspec show --json` 可正常解析。规格包含 6 条 ADDED Requirements、19 个 Scenarios。
- `make -C backend test-version-integrity`：11/11 cases 通过；当前 branch VERSION `0.1.179` 通过。
- `go -C backend run ./cmd/server --version`：输出包含 `Sub2API 0.1.179`。
- 历史最小 race 组合：单次通过，随后连续 5 轮通过。
- `make -C backend test-race-service`：首次运行非零但输出被工具截断；用完整日志重跑后退出 0，未发现 DATA RACE/FAIL；该首次结果不隐藏，最终门禁以可审计的完整日志重跑为准。
- `make -C backend test-unit`：全量通过。
- `make -C backend test-integration`：未通过；`internal/pkg/tlsfingerprint` 访问 `https://tls.peet.ws/api/all` 时因本机 CA 信任报 `x509: certificate signed by unknown authority`，且本机 Docker daemon 不可用。其他已运行 integration packages 通过。该失败与本 change 的脚本/workflow/doc 改动无关，但不能记为通过。
- `sh deploy/tests/release-delivery-integrity-test.sh`、三个新增 shell 的 `sh -n`、workflow/OpenSpec YAML 解析和 `git diff --check` 均通过。
