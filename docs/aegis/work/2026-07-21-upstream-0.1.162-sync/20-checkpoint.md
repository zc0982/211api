# 同步上游 0.1.162 - Checkpoint

- Task ID: 2026-07-21-upstream-0.1.162-sync
- Current todo: 等待新的明确授权；不得启动 Task 17
- Completed: 从精确 origin/main `e289410d1c37d7aa93d26ea75103026845759587` 创建隔离 worktree；以 `--no-ff --no-commit` 合并 upstream/main `5a8d6c4e41e38f05cea4164e6ff03443fc0f6923`；解决 axios 两处文本冲突；完成部署、安全、迁移、退役 owner 与 logo 语义审计；本地验证通过；创建双父 merge commit `11344fe32dcd6b1dae2acfe588a1896cff2e8a06`
- Active slice: upstream/main 0.1.162 已经受保护 PR 合并并部署到 Gateway；最终运行态已验证
- Blocked on: none
- Next step: 保持当前生产与 Task 16 smoke 证据不变；如另行授权，再独立治理 Runner lint 的 4 GiB 容量余量

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

## Checkpoint Update — 2026-07-22T03:09:56+08:00

- Test-fix commit `243f8d66368c6507265c1b7bda26f2970242a64e` passed all 18 exact-SHA push/pull_request CI and security contexts; the repaired `ci / backend-unit (pull_request)` passed in 10m0s.
- Protected PR #5 was merged by `luoee` without deleting the branch. Protected main is the two-parent merge `f83eeda7715b63b55cca5abe3d1674715b3e7f9f`, with parents `e289410d1c37d7aa93d26ea75103026845759587` and `243f8d66368c6507265c1b7bda26f2970242a64e`; VERSION is `0.1.162`.
- Main run 152 initially exposed two independent fail-closed gates. Deploy lint attempt 1 was cgroup-OOM-killed with exit 137; DinD is bounded at 4 GiB and its lifetime `memory.peak` reached the limit. The controlled failed-job rerun passed in 18m19s without a new OOM kill, but live sampling repeatedly came within 1 MiB of the cap. This is a recorded reliability follow-up, not hidden completion evidence.
- Build-and-deploy attempt 1 built and published the immutable SHA image, then correctly returned 78 because migrations 183/184 required a missing exact migration approval. Canonical Gateway hashes/owner/mode, health, lock, state/env and exact changed paths were verified before a human root TTY approved only `migrations_runner.go`, migration 183 and migration 184 for the exact commit/digest and 30-minute window.
- Build-and-deploy attempt 2 atomically consumed the approval, created validated backup `20260721T190018Z-f83eeda7715b63b55cca5abe3d1674715b3e7f9f`, deployed successfully and retagged `main`. Run 152 and all 18 main contexts are now success.
- Registry SHA and `main` both resolve to `sha256:333330a196494a37ee4f44f58b31232a37a3e228f0c95f37c5712ed50f3c8135`; both are single linux/amd64 OCI manifests with revision/version `f83eeda...`. `latest`, `0.1.162` and `v0.1.162` remain absent.
- Gateway is ready, healthy, lock-available and state/env-consistent; it listens only on `127.0.0.1:8080`. Migrations 183 and 184 are present in `schema_migrations` with the source checksums. The active approval is absent and its consumed root:root 0600 record is retained.
- GitHub Actions remains `enabled=false`; residual run `29755862485` remains queued with zero jobs. No `.github/workflows`, `.goreleaser*`, Gitea 0.1.162 tag/release, DockerHub/GHCR/Telegram release output, ARM64 manifest, archive/checksum or desktop binary was created.
- Task 16 retained branches/tag/prerelease/images were not removed or changed, and Task 17 was not started.
