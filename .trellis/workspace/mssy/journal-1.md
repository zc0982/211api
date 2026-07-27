# Journal - mssy (Part 1)

> AI development session journal
> Started: 2026-07-27

---



## Session 1: 修复 service 测试竞态并增加 race 门禁

**Date**: 2026-07-27
**Task**: 修复 service 测试竞态并增加 race 门禁
**Branch**: `fix/issue-27-service-race-ci`

### Summary

完成 Issue #27：internal/service race-clean，增加 main push race CI 门禁并创建 PR #28。

### Main Changes

- 将 679 次 gin.SetMode 收敛到单一 TestMain，并使用 atomic 修复 usage cleanup 测试桩竞态
- 新增 make test-race-service 与 main-push-only race-service job，接入 ci-ok 部署门禁

### Git Commits

| Hash | Message |
|------|---------|
| `addd76f14` | (see git log) |

### Testing

- [OK] make test-race-service、make test-unit、golangci-lint run ./...、actionlint 均通过
- [OK] PR #28 真实 CI 的 test、frontend、golangci-lint、shell、ci-ok 全部通过

### Status

[OK] **Completed**

### Next Steps

- 等待 PR #28 评审与合并；合并后的 main push 将首次执行 race-service 部署门禁


## Session 2: 修复 Deploy 等待 ci-ok 创建竞态

**Date**: 2026-07-27
**Task**: 修复 Deploy 等待 ci-ok 创建竞态
**Branch**: `main`

### Summary

定位 PR #28 合并后 Deploy 失败为跨 workflow 检查创建竞态；升级 wait-on-check-action 至 v1.8.1 并配置 2100 秒发现窗口，创建 PR #29，远端 ci-ok 通过。

### Git Commits

| Hash | Message |
|------|---------|
| `3121d8a01` | (see git log) |

### Status

[OK] **Completed**
