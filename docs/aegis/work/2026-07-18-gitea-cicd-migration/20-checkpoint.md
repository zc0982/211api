# Gitea CI/CD 迁移 - Checkpoint

- Task ID: 2026-07-18-gitea-cicd-migration
- Current todo: 写入并自检 Design Spec
- Active slice: 设计文档持久化与用户书面审阅
- Blocked on: none
- Next step: 创建 docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md 并更新索引

## Checkpoint Update

- Current todo: 自检 Design Spec 并交付用户书面审阅
- Active slice: 书面设计自检和用户审阅门禁
- Completed todos:
- 完成项目、工作流、官方文档与主机现状探索
- 确认迁移边界与三部分设计
- 创建初始双基线与 Design Spec
- Evidence refs:
- docs/aegis/baseline/2026-07-18-initial-baseline.md
- docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md
- Blocked on: none
- Next step: 扫描占位符、矛盾、范围、边界并运行 workspace check

## DriftCheckDraft

- Scope status: 仍限定为 Gitea 平台与 CI/CD 迁移，未迁移 211API 业务运行时
- Compatibility status: Gateway 生产 owner 和 GitHub 上游更新边界保持不变
- Retirement status: GitHub Actions/GHCR/DockerHub/Telegram 退役路径已显式记录，尚未执行
- New risk signals:
- 异地备份目标尚未提供，明确为非阻塞残余风险
- Advisory decision: continue

## Checkpoint Update

- Current todo: Run Task 8 complete repository-only verification gate
- Active slice: Task 8 branch-wide syntax/runtime/retirement proof
- Completed todos:
- Task 7 committed as `a9ab06b61`: fixed-path Gateway installer, strict forced-SSH dispatcher, root deployment owner, direct-human baseline backup, encrypted pre-deploy backup, one-time migration approval, bounded audit, retention, and isolated PostgreSQL restore drill
- The Gateway fixture passed exact grammar/source/env injection, lock 75, both stale-head gates, API/compare faults, pg_dump/archive/validator/age/disk/fsync/audit/SIGTERM faults, one-line environment mutation, approval mismatch/expiry/replay/CI rejection, pull/start/health fail-closed evidence, `/run` reboot recovery, retention leases, and labelled restore cleanup
- Independent specification, security, backup/restore, installer/operations, test, repair, and final-diff reviews found no remaining high/medium repository blocker
- The Task 12 direct-human `deploy --record-baseline` branch was added to close the approved real-backup requirement without a fourth subcommand or an ad hoc root shell; the CI dispatcher cannot invoke it
- Evidence refs:
- task7-gateway-enforcement
- Blocked on: none for Task 8; real Gitea/Gateway credentials, SSH identities, DNS/TLS, age custody, and runtime evidence remain Task 9+ gates
- Next step: run every repository dispatcher/test, render both Compose projects, build the locked AMD64 application without push, and prove retirement/secret/diff hygiene

## DriftCheckDraft

- Scope status: Task 7 changed only repository-owned Gateway enforcement sources and local fixtures; no Gateway, Netcup, DNS, Gitea, Registry, or GitHub state was mutated
- Compatibility status: Gateway remains the sole production runtime; only `SUB2API_IMAGE` is mutable, while a failed post-switch deployment deliberately requires human reconciliation rather than database restore or blind retry
- Retirement status: repository delivery owners remain Gitea-only on the feature branch; external GitHub delivery state is still untouched behind Tasks 12-13
- New risk signals: all Gateway tests use isolated temporary stubs; real Buildx Registry inspection, protected-main API, SSH source restriction, age-encrypted production backup/restore, Compose health, audit ENOSPC, and host reboot behavior remain live-only Tasks 12/15 evidence
- Advisory decision: continue

## Checkpoint Update

- Current todo: Obtain user written-spec review before implementation planning
- Active slice: Written design review gate
- Completed todos:
- Design drafted, independently reviewed, tightened, and self-reviewed
- Evidence refs:
- design-self-review, independent-design-review
- Blocked on: none
- Next step: Ask the user to approve or amend the written design specification

## Checkpoint Update

- Current todo: Obtain the user's implementation-plan execution choice
- Active slice: Reviewed implementation-plan handoff
- Completed todos:
- User explicitly approved the written Design Spec
- Implementation plan written with 17 ordered tasks and a separate Task 13 cutover stop
- Independent consistency, technical, operations, security, and governance findings incorporated
- Official Gitea 1.26 token and Runner 2.1 socket contracts rechecked
- Evidence refs:
- written-design-approval
- implementation-plan-review
- docs/aegis/plans/2026-07-18-gitea-cicd-migration.md
- Blocked on: user execution choice; external runtime inputs remain execution gates only
- Next step: Present subagent-driven (recommended) versus inline execution; do not implement until the user chooses

## Checkpoint Update

- Current todo: Complete Task 1 generated-cache cleanup and close its evidence checkpoint
- Active slice: Task 1 isolated worktree and execution-input lock
- Completed todos:
- User selected execution option A
- Created `/home/lym/dev/projects/211api-gitea-cicd` on `feature/gitea-cicd-migration` without pushing
- Confirmed design commit ancestry, original GitHub/upstream remotes, and no branch/path conflict
- Inventory found Task 9+ credentials/identities absent or unknown while `gh` is authenticated; Tasks 2-8 remain unblocked
- Revalidated Netcup as empty former runtime and Gateway as healthy sole production runtime over read-only SSH
- Passed Go 1.26.5 backend unit tests and Node 20/pnpm 9 frontend lint, typecheck, and 93 critical tests
- Evidence refs:
- task1-preflight
- Blocked on: exact-path approval to delete this turn's generated untracked `/home/lym/dev/projects/211api-gitea-cicd/.pnpm-store` cache after two approval-service transport rejections
- Next step: after explicit approval, delete only `.pnpm-store`, prove the worktree clean except ignored `frontend/node_modules`, update drift to continue, and begin Task 2

## Checkpoint Update

- Current todo: Implement Task 2 canonical image/tool lock and CI dispatcher
- Active slice: Task 2 repository lock and dispatcher
- Completed todos:
- Task 1 isolated worktree, input inventory, read-only host boundaries, and baseline tests
- User explicitly approved deletion of the generated `.pnpm-store`; only that path was removed
- Worktree contains no implementation edits; only Aegis execution records are pending, with ignored `frontend/node_modules` retained as setup state
- Evidence refs:
- task1-preflight
- Blocked on: none for Tasks 2-8; Cloudflare/age/webhook/bootstrap identities remain Task 9+ gates
- Next step: run Task 2 pre-edit owner/complexity check, implement the four declared files, verify locked manifests and dispatcher behavior, then complete two-stage read-only review

## Checkpoint Update

- Current todo: Implement Task 4 Netcup platform stack and backup programs
- Active slice: Tasks 4-7 host-automation owners
- Completed todos:
- Task 2 committed as `2359acad8`: exact image/tool/action locks plus closed CI dispatcher
- All 12 locked image manifests resolved with `linux/amd64`; dispatcher fixture, syntax, spec, and quality reviews passed
- Task 3 committed as `eea546041`: four Gitea workflows became the sole repository CI/CD owner; five GitHub workflows, GitHub audit file, and both GoReleaser configs retired
- Locked Go image integration gap repaired with a Unix-socket, two-command read-only Docker probe; real Testcontainers integration passed afterward
- Go unit/integration/lint/govulncheck and Node frontend/security dispatcher paths all passed in locked images
- Evidence refs:
- task2-toolchain-lock
- task3-gitea-workflow-owner
- Blocked on: none for Tasks 4-8; Gitea live context/API behavior remains a Task 11 smoke gate, and external credentials remain Task 9+ gates
- Next step: implement and locally fault-test the declared Task 4 platform/backup files without mutating Netcup

## Checkpoint Update

- Current todo: Implement Task 5 isolated Runner and rootless DinD stack
- Active slice: Task 5 Runner isolation owner
- Completed todos:
- Task 4 committed as `c65b78cbd`: four-service private Gitea platform, Caddy, encrypted backup/restore, retention, notification, systemd, and operator runbook
- All eight Task 4 platform tests, formal Caddy validation, dispatcher regression, syntax, secret scan, and diff hygiene passed
- Independent repair reviews approved strict data-only env parsing, streamed tar safety, fd-based retention deletion, restore isolation, Compose/Caddy, and systemd failure handling
- Official Gitea v1.26.4 source confirmed `pending`, `queued`, and `in_progress` map to all three internal non-final run states
- Evidence refs:
- task4-private-platform
- Blocked on: none for Tasks 5-8; real Gitea, Registry, webhook, age, NTP, and restore evidence remain Tasks 9-11 gates
- Next step: implement Task 5 Runner Compose/config/README and run only disposable local DinD smoke resources

## DriftCheckDraft

- Scope status: Netcup remains Gitea/CI control plane only; Gateway Los Angeles remains the sole production runtime
- Compatibility status: no host Docker socket, TCP Docker API, host network/PID, or business runtime was added
- Retirement status: old external CI owners remain governed by Tasks 12-17; Task 4 introduced no fallback owner
- New risk signals: Task 4 is repository-verified but not production-verified; systemd installed-path, NTP/TLS, API permissions, webhook, age, and full restore remain fail-closed live gates
- Advisory decision: continue

## Checkpoint Update

- Current todo: Implement Task 6 Gitea bootstrap, protection, and verification automation
- Active slice: Task 6 repository-control owner
- Completed todos:
- Task 5 committed as `86f5abbc1`: fixed-name two-service Runner stack with rootless DinD and no host Docker endpoint
- Locked DinD runtime proved rootless over a shared named tmpfs socket owned 1000:1000, with no TCP listener or published port
- Runner config schema, exact labels, UID/capability boundary, missing/unsafe token and unsafe state negative starts, synthetic token lifecycle, and unprivileged inner container all passed
- Independent reviews repaired DinD entrypoint TCP injection, subordinate-GID drift, Compose secret UID mismatch, tmpfs lifetime, token backup capture, registration timeout cleanup, and a non-restorable bootstrap-backup fallback
- All Task 4 platform tests, Task 5 tests, dispatcher regression, formal Caddy validation, shell syntax, secret scan, and diff hygiene passed after the repairs
- Evidence refs:
- task5-isolated-runner
- Blocked on: none for Tasks 6-8; real Runner registration, job socket injection, Gitea protocol, Registry, NTP/TLS, webhook, age, and restore remain Tasks 9-11 gates
- Next step: implement Task 6 root-only bootstrap/protection/hook verification owners and run only disposable local hook fixtures

## Checkpoint Update

- Current todo: Implement Task 7 Gateway deployment enforcement owner
- Active slice: Task 7 Gateway production-mutation owner
- Completed todos:
- Task 6 committed as `908aa74c5`: root-only bootstrap, exact organization/repository/team/collaborator controls, least-privilege PAT lifecycle, branch/tag protections, Actions secrets, immutable `v*` update hook, installer, verifier, and backup coverage
- Locked Gitea 1.26.4 disposable API/OpenAPI probes proved granular team semantics, restricted service-user Basic token creation, exact token scopes, reserved secret-name behavior, protections, and Registry authorization
- Immutable-tag POSIX hook tests covered create/move/delete behavior plus owner, mode, symlink, checksum, managed-hook, regeneration, and rollback faults
- Two fresh independent final reviews found no high/medium repository blocker; all remaining Task 6 gates require the real Gitea/Runner/SSH/Registry environment in Task 11
- Evidence refs:
- task6-repository-controls
- Blocked on: none for Tasks 7-8; real Gitea/Gateway credentials and identities remain Task 9+ gates
- Next step: implement the fixed-path Gateway dispatcher/deployer/backup/restore owners and fault-test them entirely against temporary fixtures without mutating Gateway

## DriftCheckDraft

- Scope status: Gateway Los Angeles remains the sole production runtime; Task 7 adds repository-owned enforcement programs but performs no production installation or deployment
- Compatibility status: only `SUB2API_IMAGE` may change; Compose, all other `.env` content, PostgreSQL, Redis, data, ingress, ports, and services remain owned by the existing Gateway deployment
- Retirement status: no external CI or production owner is disabled in Task 7; real installation remains Task 12 and cutover remains behind Task 13 approval
- New risk signals: Task 6 API behavior is locally proved against locked Gitea 1.26.4 but real-instance identities, status contexts, SSH receive path, Registry push/pull, and restored authentication remain Task 11 fail-closed gates
- Advisory decision: continue

## Checkpoint Update

- Current todo: Prepare Task 9 Netcup control plane without starting the delivery owner
- Active slice: Task 9 installed-path and host-readiness gate
- Completed todos:
- Task 8 passed all seven closed dispatcher paths in their digest-locked Go/Node environments: backend unit/integration, frontend lint/typecheck/93 tests, golangci-lint with zero issues, govulncheck with zero reachable vulnerabilities, pnpm audit-exception validation, and shell syntax
- All 15 migration shell tests passed, including both rendered Compose contracts, disposable Caddy redaction, Runner token lifecycle, real rootless DinD smoke, Gitea administration/tag-hook fixtures, and the complete Gateway fault matrix; Task 8 disposable containers/networks/volumes were cleaned by their owners
- The application built locally for `linux/amd64` from all four digest locks without push; image ID `sha256:b4c84f7d159b267a4b32aa7fc7f8d9bbca128035a1deb12c6b9b4f550e086bc5` and OCI revision exactly matched `a9ab06b61707283feb9d2baaa7ae8014e626c166`
- Repository retirement passed: `.github/workflows` and active legacy secret names are absent, while the declared nine `Wei-Shaw/sub2api` updater/download references remain
- Secret hygiene passed after isolating four exact pre-existing unit-test fixtures from production paths; no suspect tracked filename, generated token, private key file, `.env`, database dump, decrypted backup, or diff whitespace failure was found
- No implementation source changed during Task 8; the transient first-build Alpine index I/O failure passed on an identical retry and required no source/lock workaround
- Evidence refs:
- task8-repository-gate
- Blocked on: Task 9+ still requires real Netcup/Gitea identities, age custody, notification destination, DNS/TLS authority, and installed-path runtime evidence; none was fabricated during Task 8
- Next step: execute Task 9's fail-closed Netcup preflight and prepare only the approved control-plane paths; do not start Gitea/Runner or mutate Gateway

## DriftCheckDraft

- Scope status: Task 8 changed only Aegis repository evidence and local derived test/build state; Netcup remains the future Gitea control plane and Gateway Los Angeles remains the sole production runtime
- Compatibility status: all updater/download references to `Wei-Shaw/sub2api` remained; no business runtime, database, Redis, ingress, or deployment configuration changed
- Retirement status: the feature branch has one Gitea repository CI/CD owner and no GitHub workflow/GoReleaser owner; external GitHub state remains untouched until the separately approved cutover sequence
- New risk signals: the complete repository gate cannot substitute for real NTP/DNS/TLS, credentials, SSH source restriction, Registry/API behavior, webhook, age custody, installed ownership/reboot, or backup/restore evidence; the first application build also demonstrated that external Alpine package availability can transiently fail while immutable inputs remain intact
- Advisory decision: continue
