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

## Checkpoint Update

- Current todo: Complete Task 9 platform-input and render gate
- Active slice: Fail-closed wait for the backup-failure webhook URL
- Completed todos:
- Committed the reviewed Netcup host owner as `65d8fe563` and its real Fail2ban socket-readiness repair as `53cb6a213`; all 16 migration shell tests passed after the repair
- Installed only the approved packages, restored bounded NTP synchronization, proved the existing 65536-entry uidmap, and created the canonical `/opt/gitea` plus root-only `/etc/gitea` layout without `/opt/gitea/secrets`
- Copied 32 production files and eight host-owner files with exact SHA-256 agreement; generated only the three 64-hex platform secrets directly in 0600 files without reading or printing their values
- Activated the SSH 4422 jail while leaving the Gitea jail disabled; the live Type=simple socket race reproduced and the bounded ping/reload/ping owner succeeded on attempt two after a real restart
- Accepted the supplied public age recipient into strict root-only `/etc/gitea/platform.env`; strict schema validation and configuration-only platform Compose rendering passed
- Preserved the existing 4422 IPv4/IPv6 rules and UFW deny defaults; added only explicit IPv4 80/443/2222 rules, installed both DOCKER-USER guards, and proved one Docker restart replayed the checksum/apply/reload/verify chain
- Revalidated all preserved services, NTP bounds, 305984184320 free bytes, zero Docker containers, no `gitea`/`act_runner` process, and only sshd 4422 host listeners; Gateway Los Angeles was not mutated
- Evidence refs:
- task9-netcup-preflight
- Blocked on: `BACKUP_FAILURE_WEBHOOK_URL`; `/etc/gitea/backup-notify-url` was deliberately not fabricated
- Next step: receive the webhook URL through a private channel, validate and write only its canonical 0600 file, then close Task 9 without starting the platform

## DriftCheckDraft

- Scope status: Netcup now owns only prepared Gitea control-plane prerequisites and host enforcement; no Gitea/Runner delivery owner is running, and Gateway Los Angeles remains the sole production runtime
- Compatibility status: Hermes, Komari, Docker, SSH 4422, UFW defaults, the existing 4422 IPv4/IPv6 rules, uidmap, and all copied production hashes remain intact
- Retirement status: no GitHub, Registry, DNS, Gitea, Runner, or Gateway cutover owner was disabled or activated; Task 13 remains a separate explicit approval gate
- New risk signals: Task 9 cannot truthfully complete until the external HTTPS failure webhook is supplied; Task 10 also remains gated on Cloudflare and bootstrap identities
- Advisory decision: stop fail-closed at the declared input boundary

## Checkpoint Update

- Current todo: Deploy the reviewed Pipedream adapter and close Task 9 notification preflight
- Active slice: Operator Pipedream paste/deploy and live endpoint validation
- Completed todos:
- Versioned and locally verified the Pipedream Telegram backup adapter: Node syntax pass, 8/8 mocked branch tests pass, secret-value scans empty
- Evidence refs:
- pipedream-telegram-adapter-local
- docs/aegis/plans/2026-07-19-pipedream-telegram-backup-notification.md
- Blocked on: Operator must paste and deploy the committed adapter in the existing Pipedream workflow; endpoint remains operator-held and must not be sent to chat
- Next step: Commit the adapter slice, then provide exact Pipedream paste/deploy and masked live-test instructions

## DriftCheckDraft

- Scope status: The slice added only the approved versioned Pipedream adapter and offline tests; no host, Pipedream, Telegram, Gitea, Runner, DNS, or Gateway state changed
- Compatibility status: Existing Netcup payloads and sender are unchanged; Gateway remains the sole production runtime and the endpoint/token/chat remain outside Git
- Retirement status: Legacy release/deploy Telegram paths remain retired; the new file is the sole bounded backup-failure adapter and no fallback was added
- New risk signals:
- Live Pipedream deployment, Telegram receipt, endpoint installation, and Netcup preflight are still unverified external steps
- Advisory decision: continue

## Checkpoint Update

- Current todo: Deploy exact committed Pipedream adapter and validate the live notification path
- Active slice: Operator Pipedream paste/deploy and live endpoint validation
- Completed todos:
- Adapter committed as af5b0cb6f; 8/8 tests passed locally and in digest-locked Node 20.20.2
- Operator workflow, masked test, endpoint install, rotation, and retirement instructions committed as 7fb5d8842
- Evidence refs:
- pipedream-telegram-adapter-local
- af5b0cb6f
- 7fb5d8842
- Blocked on: Operator must paste and deploy af5b0cb6f adapter in Pipedream and run masked live tests; endpoint must remain outside chat
- Next step: Give the operator the exact paste/deploy sequence, then wait for preflight, invalid-schema, and synthetic Telegram confirmation before installing the endpoint on Netcup

## DriftCheckDraft

- Scope status: Repository adapter, tests, and operator documentation are complete; no external workflow or host state was changed by these commits
- Compatibility status: Existing sender payloads remain unchanged; Gateway remains production owner; endpoint/token/chat remain outside Git
- Retirement status: Legacy release/deploy Telegram paths remain retired and the committed adapter is the only permitted Telegram call owner
- New risk signals:
- Operator Pipedream deployment and live Telegram receipt are required before Netcup endpoint installation
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Prepare Task 10 DNS, TLS, Gitea bootstrap, and identity gate
- Active slice: Task 9 evidence close; Task 10 not started
- Completed todos:
- Task 9 complete: Pipedream adapter af5b0cb6f tested 8/8 in locked Node 20; live preflight 200, invalid 400, notification-test 200, Telegram receipt confirmed
- Netcup backup-notify-url is a regular root:root 0600 single-line file; remote preflight 200; zero containers/processes/new listeners; preserved services, Compose renders, Fail2ban, NTP, and firewall guard pass
- Evidence refs:
- task9-netcup-preflight
- pipedream-telegram-adapter-local
- af5b0cb6f
- Blocked on: Task 10 requires Cloudflare authority and bootstrap identities; these are not Task 9 completion blockers
- Next step: Commit Task 9 close evidence, then request/validate only the Task 10 inputs before any DNS, TLS, Gitea, or Runner start

## DriftCheckDraft

- Scope status: Task 9 is complete at the approved no-start boundary; only notification endpoint installation and verification changed external state
- Compatibility status: Netcup still hosts no 211API business runtime; Gateway remains sole production; no Gitea/Runner/DNS/TLS state was activated
- Retirement status: Legacy release/deploy Telegram paths remain retired; Pipedream adapter af5b0cb6f is the sole backup-failure Telegram owner
- New risk signals:
- Task 10 remains gated on Cloudflare authority and bootstrap identities; Task 13 still requires fresh explicit cutover approval
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Complete Task 10 bootstrap identity, two-phase repository bootstrap, and empty-state backup/restore gates
- Active slice: Fail-closed wait for the explicit human administrator username and email
- Completed todos:
- Created the unique Cloudflare DNS-only A record for `git.211api.com`; both authoritative nameservers and Cloudflare, Google, and Quad9 return only `37.221.194.27` with no AAAA; retained existing DNSSEC and absent CAA unchanged
- Started the locked PostgreSQL, Gitea 1.26.4, and Caddy stack without Runner; external HTTPS health is 200, the exact SAN/Let's Encrypt chain/checkend gate passes, and the public SSH fingerprint matches the container key
- Repaired the first-live `secret-init` capability/order defect at commit `839992222` and the `[log.file]` environment escape defect at commit `0b3096591`; all eight platform tests passed and the real host log is growing with the required ownership/mode
- Enabled the checked-in Gitea Fail2ban jail; the synthetic TEST-NET line matches, the `DOCKER-USER` jump precedes the platform guard, and manual ban/unban of `192.0.2.1` passed; corrected the Fail2ban 1.1 fixture invocation in `4bc66cbe1`
- Revalidated preserved Netcup services, no Runner, zero users, zero repositories, and no Gateway mutation; recorded the in-progress external evidence as `f6a8a9b93`
- Evidence refs:
- task10-platform-bootstrap
- f6a8a9b93
- Blocked on: explicit `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_EMAIL`; `/etc/gitea/bootstrap.env` remains absent and no identity was inferred
- Next step: receive the two non-secret identity values, install the strict root-only input, run bootstrap phase one, then stop for the user's password-change/2FA/recovery-code confirmation before phase two

## DriftCheckDraft

- Scope status: Netcup now runs only the Gitea control plane; Runner, repository import, Gateway deployment state, GitHub external state, and cutover remain untouched
- Compatibility status: Gateway remains the sole 211API production runtime; Hermes, Komari, admin SSH, Docker, Fail2ban, and the firewall owner remain active
- Retirement status: no additional compatibility owner or fallback was introduced; two live-start defects were repaired at their canonical Compose owners and stale persisted logger keys were removed
- New risk signals:
- The bootstrap cannot proceed without a user-selected human identity, and the later 2FA/recovery-code gate is intentionally non-automatable
- The age private identity remains operator-held and off Netcup; the empty-state restore drill must wait until bootstrap creates the dedicated backup-reader authority
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Complete the human password-change, 2FA, and recovery-code custody gate before bootstrap phase two
- Active slice: Phase-one administrator handoff for `luoee`
- Completed todos:
- Received the explicit username and email, validated the strict two-key schema, and installed `/etc/gitea/bootstrap.env` as a root-owned mode-0600 file without recording the email in repository evidence
- Created exactly one active administrator, retained zero repositories, and wrote the random password plus administrator PAT only to root-owned mode-0600 Netcup files without printing either value
- Repaired the locked CLI version/global-runtime contract in `53ffd0fc2` and the real Gitea must-change-password API transition in `281613e71`; administrator primitives and immutable-tag fixtures passed
- Re-ran the live first phase and proved it exits only with the reviewed instruction to change the password and enable 2FA; the user list still reports 2FA false as expected
- Evidence refs:
- task10-platform-bootstrap
- 53ffd0fc2
- 281613e71
- Blocked on: user must retrieve the password directly on Netcup, change it over the verified HTTPS origin, enable 2FA, and retain recovery codes; the agent must not automate or inspect those values
- Next step: after the user confirms all three actions, rerun `/opt/gitea/admin/bootstrap-gitea`, require the live 200/identity/OpenAPI/2FA gates, and create the exact empty private repository/control identities

## DriftCheckDraft

- Scope status: The slice created only the approved human Gitea administrator and root-only bootstrap artifacts; no service user, organization, repository, Runner, import, Gateway, GitHub, or cutover state was created
- Compatibility status: Gateway remains sole production; Gitea, Caddy, PostgreSQL, Fail2ban, Hermes, Komari, Docker, and admin SSH boundaries are unchanged
- Retirement status: The incorrect uppercase CLI contract, implicit global-runtime dependency, and impossible unconditional pre-password HTTP-200 assumption are retired; no fallback or broadened PAT scope was added
- New risk signals:
- The next step is intentionally human-only because password entry, TOTP enrollment, and recovery-code custody cannot be safely automated or observed by the agent
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Close Task 10 DNS, platform bootstrap, encrypted backup, and isolated restore evidence
- Active slice: Task 10 completed; stopped before Task 11 import and Runner registration
- Completed todos:
- The operator changed the `luoee` password, enabled TOTP, and retained recovery codes without exposing any of those values; the locked local Gitea CLI reports 2FA enabled
- Bootstrap phase two and an idempotent rerun created and verified seven users, the private `211api` organization, the private empty `211api/211api` repository, five exact teams, four direct collaborators, six least-privilege token files plus metadata, and no Runner or imported refs
- Corrected the post-password administrator/TOTP gates and unsafe root-script local expansions at `22a4ade53`, `820a7b534`, `826479589`, and `f5a582e73`
- Repaired streamed PostgreSQL validation at `8b0eb7f84`: `pg_restore --list` may close early, so a private FIFO plus a draining tee now preserves the full pg_dump/age stream without a complete plaintext file
- Created validated age-encrypted bootstrap backup `gitea-20260719T034037Z-561d9ad0` with nine ciphertext components; the preceding fail-closed attempts restored service health and the successful run cleared the root-only FAILED marker
- Repaired the installed restore-helper mode contract at `55e8d7a7f` and the Netcup Docker loopback-publication incompatibility at `5c0ccb47c` without changing daemon, NAT, sysctl, or production firewall state
- The isolated restore verified PostgreSQL structure, the non-admin backup identity, empty clone/refs, releases, packages, and Registry metadata; run-labelled containers, volumes, network, scratch, proxy, lease, and operator tmpfs all had zero residue
- Installed and enabled `gitea-backup.timer`; repository/remote unit hashes match and the next run is `2026-07-19T18:30:00Z`
- Revalidated production PostgreSQL/Gitea/Caddy health, external HTTP 200, active Fail2ban/firewall owners, preserved Netcup services, zero Runner, and zero Gateway mutation
- Evidence refs:
- task10-platform-bootstrap
- 8b0eb7f84
- 55e8d7a7f
- 5c0ccb47c
- Blocked on: none for Task 10; Task 11 is a separate import/Runner execution slice and has not started
- Next step: commit the completed Task 10 evidence, then stop at the Task 11 boundary for the next explicit continuation

## DriftCheckDraft

- Scope status: Netcup runs only the approved Gitea control plane and encrypted local backup owner; Gateway Los Angeles remains the sole production runtime
- Compatibility status: DNS/TLS/SSH, Gitea, PostgreSQL, Caddy, Fail2ban, backup timer, Hermes, Komari, Docker, and admin SSH are healthy; no Docker daemon, NAT, sysctl, or Gateway mutation was introduced by the restore repair
- Retirement status: no GitHub external state, Runner, repository import, release owner, deploy owner, or cutover state changed; Task 13 remains the explicit cutover approval gate
- New risk signals:
- Backups remain on the Netcup host only; total host/disk loss is the already accepted residual risk until a separate off-host destination is approved
- Pipedream free-tier quota remains an external notification availability constraint; the local FAILED marker and systemd failure state remain the durable on-host signals
- Advisory decision: continue to Task 11 only when explicitly resumed

## Checkpoint Update

- Current todo: Establish the dedicated Gitea import SSH identity and atomically import exact old-GitHub refs
- Active slice: Task 11 preflight and credential-write approval gate; canonical Gitea repository still has zero refs
- Completed todos:
- Re-read the intent, baseline, Design Spec, Task 11 plan, checkpoint, resume hint, and Execution Readiness View; TDD remains off with proportional live verification
- Proved the old GitHub fork currently exposes nine heads and zero tags while the local worktree contains 152 non-source tags, local `main` is two commits ahead, and the feature branch is 38 commits ahead of old `origin/main`
- Repaired Task 11 Step 2 at `29ade5759` to use an isolated tag namespace, reject any nonempty Gitea target, perform one atomic push, compare sorted source/target inventories including peeled tag rows, and clean only local import refs
- Two specification and two quality review rounds passed after fixing stale-target, legal `HEAD` branch, network failure, partial-push, signal, and cleanup hazards
- Passed `test-admin-primitives.sh`, `test-immutable-tag-hook.sh`, Runner config/token lifecycle tests, and the real disposable rootless DinD smoke; socket was `1000:1000 1660`, the daemon reported rootless security, and all test resources were removed
- Confirmed the locked Gitea 1.26.4 CLI provides `actions generate-runner-token --scope {owner}[/{repo}]`; no Runner or canonical repository refs were written
- Evidence refs:
- 29ade5759
- task11-local-runner-hook-preflight
- Blocked on: explicit approval to create a dedicated local Gitea import private key and add only its public key to `luoee`; the credential-write approval service rejected the first attempt and no workaround was attempted
- Next step: after approval, verify the trusted built-in SSH fingerprint, create/add the dedicated key, prove SSH authentication, and execute the atomic exact-ref import before any feature-branch push

## DriftCheckDraft

- Scope status: Task 11 remains inside repository import/Runner/non-main CI; only local plan/test state changed and Gitea refs remain empty
- Compatibility status: Gateway Los Angeles remains sole production; Netcup Gitea platform remains healthy and has no Runner
- Retirement status: unsafe local-tag import is retired; no GitHub mirror, delivery fallback, host Docker socket, or public repository path was added
- New risk signals:
- The import identity is a credential-bearing write and cannot proceed until the user explicitly approves after the approval-service rejection
- Existing backup/restore verification still needs Task 11 live evidence for Actions metadata and the candidate package manifest after those objects exist
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Establish the dedicated Gitea import SSH identity and atomically import exact old-GitHub refs
- Active slice: Task 11 credential-write approval gate; Runner token lifecycle is locked but no token or Runner exists
- Completed todos:
- Reconfirmed the operator changed the `luoee` password, enabled TOTP, and retained recovery codes without disclosing any credential material; this is already covered by the completed Task 10 live gate
- Confirmed from the official Gitea v1.26.4 source that `actions generate-runner-token` and the REST registration-token endpoint return the existing active token, while the authenticated CSRF-protected repository Settings reset route creates a replacement and deactivates its predecessor
- Locked the repository-scoped one-time token procedure at `a3e40bbae`: fixed root-only lock, absent-source and zero-row preconditions, direct-to-file generation, exact shape/API equality checks, no-clobber publication, post-registration UI reset, `1|1` database-state proof, and fixed-source deletion before normal backup
- Independent specification and quality reviews passed; both root-only shell blocks passed extraction-based `bash -n`
- Rechecked the isolated worktree at `a3e40bbae`; only the three known derived untracked paths remain and no external state changed in this slice
- Evidence refs:
- 29ade5759
- a3e40bbae
- task11-local-runner-hook-preflight
- task11-runner-token-lifecycle
- Blocked on: explicit approval to create a dedicated local Gitea import private key and add only its public key to `luoee`; no credential write, Gitea ref import, Runner token generation, or Runner start has occurred
- Next step: after approval, verify the trusted built-in SSH fingerprint over the Netcup admin channel, create/add the dedicated import key, prove SSH authentication, and execute the atomic exact-ref import before any feature-branch push

## DriftCheckDraft

- Scope status: the slice changed only the Task 11 runbook/plan/checkpoint; canonical Gitea refs remain empty and the Runner remains absent
- Compatibility status: Gateway Los Angeles remains the sole production runtime; no Gateway, GitHub, DNS, Gitea repository, token, or Runner mutation occurred
- Retirement status: ambiguous CLI-based Runner-token rotation is retired; the only accepted rotation owner is the locked Gitea v1.26.4 CSRF-protected web reset route
- New risk signals:
- The import identity still requires an explicitly approved credential-bearing write
- The manual Runner-token reset will require the authenticated administrator only after successful Runner registration; it is not part of the current import-identity gate
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Establish the dedicated Gitea import SSH identity and atomically import exact old-GitHub refs
- Active slice: Task 11 credential-write approval gate; disposable immutable-tag smoke installer gap closed locally
- Completed todos:
- Located the Task 11 Step 5 mismatch: the approved plan required a disposable real-SSH hook smoke repository, while the sole production hook installer accepted only the canonical bare repository
- Repaired the canonical owner at `f21194c62`: the existing wrapper/engine now accept only `hook-smoke-YYYYMMDDtHHMMSSz-8hex`, derive both fixed Gitea-volume paths, retain root/owner/mode/symlink/checksum/atomic-link checks, and grant no repository deletion authority
- Kept canonical `--install` and `--verify` behavior unchanged; documented that a fresh API/database owner-name-ID guard and canonical-repository exclusion remain mandatory before deletion
- The immutable-hook fixture, admin primitives, Bash/POSIX syntax, production ShellCheck, fixture ShellCheck excluding only intentional literal `SC2016`, and `git diff --check` passed
- Fresh specification and quality review loops passed after repairing safe checksum-parent creation and removing an execution-UID-dependent test assertion
- Evidence refs:
- f21194c62
- task11-disposable-hook-installer
- Blocked on: explicit approval to create a dedicated local Gitea import private key and add only its public key to `luoee`; Gitea refs remain empty and no Runner/token/smoke repository exists
- Next step: after approval, verify the trusted built-in SSH fingerprint over the Netcup admin channel, create/add the dedicated import key, prove SSH authentication, and execute the atomic exact-ref import

## DriftCheckDraft

- Scope status: this slice changed only repository-owned Task 11 hook installation controls, tests, runbook, plan, and evidence; no external state changed
- Compatibility status: canonical hook installation remains unchanged, Gateway remains sole production, and no arbitrary path or alternate delivery owner was introduced
- Retirement status: a second smoke-only installer was rejected; the existing installer remains the sole owner for canonical and disposable managed-hook installation
- New risk signals:
- The real Gitea receive path, human-maintainer negative test, owner/name/ID deletion guard, and checksum-record cleanup still require the later live smoke execution
- The import credential write remains outside this slice until explicitly approved
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Prove the dedicated Gitea import SSH identity and atomically import exact old-GitHub refs
- Active slice: Dedicated identity created; SSH verification/import process-start approval gate
- Completed todos:
- The operator explicitly approved creation of the dedicated Gitea import identity and addition of its public key to `luoee`
- Revalidated zero canonical refs, zero Runner rows, zero pre-existing `luoee` public keys, the admin key-write API path, and trusted Gitea built-in SSH host-key availability before mutation
- Created only the dedicated local Ed25519 identity and root-of-trust known-hosts file with exact local ownership/modes; key material and public-key bodies were not printed or recorded
- The first admin-key attempt stopped before POST because the deliberately admin-only PAT cannot read the user-category public-key list; official Gitea v1.26.4 source and live status/database evidence proved the scope boundary
- Retired that unauthorized GET check without broadening the PAT, then added the public key through the `write:admin` endpoint and verified one exact API response/database row by positive numeric ID, title, and SHA-256 fingerprint
- A later command intended to add the temporary `gitea` remote and prove strict SSH authentication was rejected before process creation by the automatic approval service after a transport-review failure; local readback confirms only `origin` and `upstream` exist
- Evidence refs:
- official Gitea v1.26.4 `routers/api/v1/api.go` admin-scope middleware and `routers/api/v1/admin/user.go` public-key handler
- task11-import-identity
- Blocked on: explicit approval after the new approval-service rejection to run strict Gitea SSH authentication and the atomic exact-ref import; no `gitea` remote or Gitea refs exist
- Next step: after approval, add the temporary SSH remote, require strict-known-host private-repository authentication with zero target refs, then run the reviewed atomic import and exact source/target inventory comparison

## DriftCheckDraft

- Scope status: the only external mutation was the explicitly approved single `luoee` import public key; repository refs, Runner, GitHub, and Gateway remain unchanged
- Compatibility status: the existing admin PAT scopes remain unchanged; trusted host keys came only through the Netcup administrator channel; no SSH trust-on-first-use or alternate credential was introduced
- Retirement status: the user-category GET preflight was removed from this execution path after its scope mismatch was proved; database identity/fingerprint verification is the root-only source of truth for this one administrator mutation
- New risk signals:
- The automatic approval transport failure prevented process creation for the next SSH/ref-import action and requires a fresh explicit approval before retry
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Independently reverify imported refs, then install canonical immutable-tag controls
- Active slice: Atomic import command succeeded; independent read-only verification process-start approval gate
- Completed todos:
- After explicit approval, strict SSH authentication through the dedicated `luoee` key and administrator-sourced known-hosts succeeded against the private empty repository; the temporary `gitea` remote now has the exact reviewed SSH URL
- Executed the reviewed import script with a second empty-target precondition, fresh old-GitHub fetch into remote-tracking and isolated tag refs, one `git push --atomic`, sorted full source/target heads-and-tags inventories, byte-for-byte `cmp`, count equality, and isolated local-ref cleanup
- The atomic import command exited successfully; every failure before or during push/comparison would have returned nonzero, and the local isolated tag namespace is empty afterward
- Local readback confirms the feature worktree and tracked status are unchanged and the feature branch was not part of the source refspec construction
- A separate fresh read-only `ls-remote` inventory comparison was rejected before process creation by another automatic approval transport-review failure; no alternate query was attempted
- Evidence refs:
- task11-import-identity
- task11-atomic-ref-import
- Blocked on: explicit approval after the new approval-service rejection to run the independent refs comparison and proceed with canonical hook/protection installation
- Next step: rerun only the independent strict-SSH source/target inventory comparison; if equal, install and verify canonical managed hook and base tag protection without touching Runner or feature refs

## DriftCheckDraft

- Scope status: only exact old-GitHub refs were submitted to the empty private Gitea repository; the local feature branch, GitHub repository, Runner, and Gateway were not mutated
- Compatibility status: import used the dedicated key and strict trusted host keys; no mirror, fallback remote, local-main refspec, or local-tag refspec was introduced
- Retirement status: the isolated local GitHub-tag namespace was removed after the successful comparison; the temporary `gitea` remote remains intentionally for the rest of Task 11
- New risk signals:
- The import command contains direct equality evidence, but the planned independent post-command reread is still missing because its process never started
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Create the SSH-only release-tag identity and execute the disposable real-SSH immutable-tag smoke
- Active slice: Exact Git import and canonical Hook controls complete; stopped before the next credential write
- Completed todos:
- A fresh independent refs reread was twice rejected before process creation by the approval service; no alternate transport was used. The reviewed atomic import command itself already required byte-for-byte source/target inventory equality before success, so the planned import gate is complete without claiming the unavailable extra reread
- Deployed the reviewed `f21194c62` Hook installer/source files by exact SHA-256, configured base repository controls, and regenerated Gitea managed hooks
- The first SSH-streamed remote script stopped after base configuration because a nested `docker compose exec -T` consumed the remaining script stdin; independent Hook readback caught the missing delegate before any completion claim
- Re-ran all stdin-capable commands with explicit `/dev/null`; managed-hook regeneration and canonical Hook install/verify then passed
- Live verification exposed a pre-existing producer/consumer defect: `verify-repository` wrote the boolean result of a tag-rule predicate and then treated it as an object
- Fixed the canonical verifier at `85fc2ad9c` with a shared unique-object extractor and regression coverage for the old boolean output plus duplicate rejection; local syntax, admin primitives, immutable-hook fixtures, ShellCheck boundary, diff hygiene, specification review, and quality review passed
- Deployed only the reviewed verifier/library repair by exact SHA-256. Canonical Hook verification, base repository verification, exact managed/immutable hook owner-mode checks, `DISABLE_GIT_HOOKS=true`, and external health 200 all passed; exact staging/backups were removed
- Evidence refs:
- task11-atomic-ref-import
- f21194c62
- 85fc2ad9c
- task11-canonical-hook-controls
- Blocked on: explicit approval to create the `svc-release-tag` SSH-only key, add only its public key, prove authentication, discard its retained one-time password, and create/delete one exact disposable smoke repository
- Next step: after approval, create the service SSH identity and trusted known-hosts, prove SSH-only authentication, then execute the owner/name/ID-guarded disposable tag-protection smoke without touching canonical tags

## DriftCheckDraft

- Scope status: Netcup changes are limited to exact imported Git refs, base repository protections, canonical managed Hook files, one import public key, and reviewed admin verifier/install files; Runner, feature refs, GitHub, and Gateway remain unchanged
- Compatibility status: Gitea custom user hooks remain disabled; the platform-owned `update.d` delegate coexists with the regenerated Gitea hook and uses the reviewed checksum owner
- Retirement status: the broken boolean tag-rule output path is removed; the remote stdin-consuming execution shape is retired in favor of explicit `/dev/null`; no fallback verifier or alternate Hook owner was added
- New risk signals:
- The SSH-only tag service identity, disposable real receive-path proof, password discard record, and checksum-record cleanup remain unverified
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Execute the prepared disposable repository's real SSH receive-path positive/negative proof and guarded deletion
- Active slice: Service identity and smoke controls prepared; SSH test process-start approval gate
- Completed todos:
- The operator explicitly approved the dedicated `svc-release-tag` key, disposable Hook smoke, and guarded deletion
- Proved the service account initially had zero SSH keys and zero PATs, its retained password was root-owned mode 0600, and canonical base/Hook verification remained green
- Created a dedicated local Ed25519 service identity plus a byte-identical independent known-hosts file derived only from the administrator-trusted Gitea host keys; no key body was emitted
- Added exactly the service public key through the `write:admin` API and verified the sole database row by numeric ID 2, title, and SHA-256 fingerprint; no PAT was created
- Strict SSH authentication to the private canonical repository succeeded with 10 readable ref rows
- Reverified key identity and PAT count zero, passed the final password-based base verifier, deleted only `/etc/gitea/bootstrap-credentials/svc-release-tag.password`, atomically published the root-owned mode-0600 SSH-only record, and passed the no-password base verifier
- Official Gitea v1.26.4 source proved protected-tag allowlists have no site-admin/org-owner bypass, so the existing `luoee` SSH identity is a valid non-whitelisted writer actor without creating a disposable user
- Created private `211api/hook-smoke-20260719t055854z-d8395467` with numeric repository ID 2 only after API 404/database-zero preconditions; API and database owner/name/ID/private state agreed
- Granted only `svc-release-tag` direct write, installed the exact `v*` allowlist, regenerated managed hooks, and installed/verified the same immutable delegate through the bounded smoke mode
- The real SSH test command was rejected before process creation by the automatic approval service after a transport-review failure; no smoke commit or tag was pushed, and the exact prepared repository remains for the approved test
- Evidence refs:
- task11-canonical-hook-controls
- task11-release-tag-ssh-only
- task11-hook-smoke-prepared
- Blocked on: fresh explicit approval after the approval-service rejection to execute the already prepared real SSH positive/negative pushes and, only after evidence, the owner/name/ID-guarded deletion and checksum cleanup
- Next step: run the exact real SSH smoke with the two dedicated identities, prove retained/absent refs, then delete only repository ID 2 and its exact checksum record after fresh API/database guards

## DriftCheckDraft

- Scope status: only the approved service public key, password retirement record, and one empty private smoke repository/control set were added; canonical refs, feature refs, Runner, GitHub, and Gateway remain unchanged
- Compatibility status: the service account is now SSH-only with zero PATs; host trust remains administrator-sourced; the negative actor uses an existing non-whitelisted writer whose admin status cannot bypass the Gitea protected-tag model
- Retirement status: the one-time service password is permanently removed after successful SSH authentication; no disposable user or alternate tag API test path was introduced
- New risk signals:
- Smoke repository ID 2 is intentionally retained because the required real SSH test process did not start; it must not be deleted before the approved evidence run or mistaken for canonical repository ID 1
- Advisory decision: pause-for-user

## Checkpoint Update

- Current todo: Register the isolated Runner, rotate its bootstrap token, and prove effective container boundaries
- Active slice: Immutable-tag real SSH gate complete; Runner not started
- Completed todos:
- After fresh explicit approval, the prepared real SSH smoke ran through Gitea's port-2222 receive path with dedicated identities
- The non-whitelisted `luoee` actor successfully pushed `main`, proving repository write; `svc-release-tag` successfully created the single allowed `v*` tag
- The same whitelisted service actor's force-move and delete pushes both failed and emitted the exact platform Hook message `protected release tags are immutable`, proving the delegate executes while custom user hooks are disabled
- The non-whitelisted maintainer's separate `v*` creation failed through tag protection; final remote state contained only `main` at commit two and the allowed tag at commit one
- Before deletion, fresh API and database checks required private owner `211api`, exact repository name, numeric ID 2, and ID inequality with canonical repository ID; the smoke Hook and exact two-ref inventory were reverified
- Deleted only repository ID 2 through the API, then required API 404, database zero rows, and absent bare path
- Validated the unique root-owned checksum record against the reviewed Hook checksum and exact deleted target path, removed only that record through the locked networkless image, and reverified canonical Hook/base controls
- Evidence refs:
- task11-release-tag-ssh-only
- task11-hook-smoke-prepared
- task11-real-ssh-hook-smoke
- Blocked on: none for the immutable-tag stage; Runner registration will stop at the authenticated manual token-reset gate after the Runner is online
- Next step: revalidate zero Runner/token state and installed Runner manifests, generate the repository-scoped token once, start isolated rootless DinD/Runner, then request the UI reset before deleting the fixed token source

## DriftCheckDraft

- Scope status: the disposable smoke repository, its refs, collaborator relation, tag protection, bare data, and checksum record are gone; only the intended persistent service SSH identity/record and canonical controls remain
- Compatibility status: no canonical `v*` tag was created, no API tag fallback was used, and both positive/negative evidence traversed the real SSH receive path
- Retirement status: the disposable repository and checksum evidence were removed only after complete proof and fresh identity guards; the `svc-release-tag` password remains retired and no PAT exists
- New risk signals:
- The service private key and known-hosts remain operator-held outside Git for later Actions-secret installation; that installation is not part of the completed smoke stage
- Advisory decision: continue
