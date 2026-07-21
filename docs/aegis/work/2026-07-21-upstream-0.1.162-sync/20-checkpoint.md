# 同步上游 0.1.162 - Checkpoint

- Task ID: 2026-07-21-upstream-0.1.162-sync
- Current todo: 推送测试时序修复并在新 SHA 上通过受保护 Gitea PR 门禁
- Completed: 从精确 origin/main `e289410d1c37d7aa93d26ea75103026845759587` 创建隔离 worktree；以 `--no-ff --no-commit` 合并 upstream/main `5a8d6c4e41e38f05cea4164e6ff03443fc0f6923`；解决 axios 两处文本冲突；完成部署、安全、迁移、退役 owner 与 logo 语义审计；本地验证通过；创建双父 merge commit `11344fe32dcd6b1dae2acfe588a1896cff2e8a06`
- Active slice: PR #5 已创建；旧 SHA 的 pull_request backend-unit 暴露单一 WebSocket 测试启动时序失败，测试已以协议级握手同步修复并完成本地复验
- Blocked on: none
- Next step: 提交并推送测试修复，在精确新 SHA 上重新运行完整 PR CI/security 门禁

## Checkpoint Update — 2026-07-21T22:13:12+08:00

- Merge base: `57914967cbb127ff715719c3879d881c10d75274`
- Divergence before merge: origin-only 124 / upstream-only 213 commits
- VERSION: `0.1.162`
- Local verification: backend unit/integration, frontend lint/typecheck/1242 tests/build, embed-tag tests, compose parsing, shell syntax and server build all pass
- Toolchain note: canonical scripts correctly reject local Go 1.24.2 / Node 24 because protected runners require Go 1.26.5 / Node 20；固定版本的最终证据必须来自 Gitea PR checks
- Remaining remote work: push, PR checks/security, protected merge, deploy and production verification
- Fresh pre-commit fetch: origin/main and upstream/main were unchanged at the exact recorded SHAs.
- Local integration commit: `11344fe32dcd6b1dae2acfe588a1896cff2e8a06`, parents are exact origin/main then upstream/main.
- Non-goals remain active: no Task 17, no release tag, no GitHub Actions enablement, no Task 16 cleanup

## Checkpoint Update — 2026-07-21T23:32:03+08:00

- Branch `sync/upstream-0.1.162` was pushed through the strict `luoee` Gitea SSH identity; protected PR #5 is open: `https://git.211api.com/211api/211api/pulls/5`.
- On commit `b4646b2e93ea9bedce26e8eb44d2c3ef9f6ab931`, all completed push lanes passed. The pull-request backend-unit job 576 alone failed in `TestPassthroughLifecycle_LeaseLossSendsRetryClose`: expected close 1013 but observed EOF.
- The identical SHA's push backend-unit lane and the pre-push full local unit suite passed. Reproduction at `-count=300` confirmed a narrow client-reader startup window rather than a production close-ownership regression.
- The test now performs a legal protocol synchronization before lease cancellation: it confirms upstream `response.create`, sends downstream `response.cancel`, confirms upstream receipt, and only then injects lease loss. Close code 1013 and exact retry reason assertions remain unchanged.
- Fresh verification after the test-only change: focused test `-count=5000` passed; the complete `internal/service` unit package passed; `git diff --check` passed. Independent read-only review found no production semantic weakening.
- Remaining remote work: commit/push the fix, require all CI/security contexts on the new exact SHA, protected merge, deploy, Registry and production verification.
