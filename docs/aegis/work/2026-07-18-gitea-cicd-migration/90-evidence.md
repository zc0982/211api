# Gitea CI/CD 迁移 - Evidence

Evidence bundles recorded through the repository-only Task 8 gate follow.

## EvidenceBundleDraft

- Artifact key: repo-ci-audit
- Type: repository inspection
- Source: .github/workflows/*.yml and related deployment/release files
- Summary: Mapped current CI jobs, GitHub-only contexts, GHCR, release, secrets, runner requirements, and retirement surface.
- Verifier: main agent plus six read-only subagent audits

## EvidenceBundleDraft

- Artifact key: gitea-official-docs
- Type: official documentation
- Source: Gitea 1.26 Actions, runner, comparison, secrets, token, and registry documentation
- Summary: Confirmed workflow directory, runner isolation, ignored GitHub semantics, package-token boundary, and Registry naming.
- Verifier: Context7 CLI and independent official-source subagent verification

## EvidenceBundleDraft

- Artifact key: netcup-host-inspection
- Type: read-only host inspection
- Source: 37.221.194.27:4422
- Summary: Confirmed retired Netcup host capacity, Docker availability, open-port state, existing services, and absence of 211API containers.
- Verifier: main agent SSH read-only commands

## EvidenceBundleDraft

- Artifact key: gateway-host-inspection
- Type: read-only host inspection
- Source: 157.254.234.244:4422
- Summary: Confirmed Gateway remains healthy production with Docker Compose, 211API/PostgreSQL/Redis, deployment path, and current GHCR image.
- Verifier: main agent SSH read-only commands

## EvidenceBundleDraft

- Artifact key: user-design-decisions
- Type: user approval
- Source: current conversation decisions
- Summary: Confirmed canonical Gitea owner, private repo, git.211api.com, AMD64 release posture, rootless runner, upstream GitHub updater, and Gateway production boundary.
- Verifier: explicit user selections and three design-section approvals

## EvidenceBundleDraft

- Artifact key: design-self-review
- Type: review
- Source: docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md
- Summary: Self-review resolved deployment freshness, migration gating, runner isolation, registry immutability, backup consistency, cutover ordering, and exact acceptance evidence; no TODO/TBD placeholders remain.
- Verifier: Primary agent structural and consistency review on 2026-07-18

## EvidenceBundleDraft

- Artifact key: independent-design-review
- Type: review
- Source: docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md
- Summary: Two independent read-only reviews checked workflow/cutover consistency and security boundaries; reported issues were incorporated and rechecked.
- Verifier: Subagent consistency and security reviews on 2026-07-18

## EvidenceBundleDraft

- Artifact key: written-design-approval
- Type: user approval
- Source: 2026-07-18 conversation: 批准书面规范
- Summary: The user explicitly approved the written Gitea CI/CD migration design while retaining Gateway Los Angeles as the production runtime owner.
- Verifier: Explicit user message on 2026-07-18

## EvidenceBundleDraft

- Artifact key: implementation-plan-review
- Type: review
- Source: docs/aegis/plans/2026-07-18-gitea-cicd-migration.md
- Summary: Independent reviews checked specification coverage, Gitea/Runner/Compose/Gateway executability, cutover races, restoration, and governance; all reported blocking and medium issues were incorporated.
- Verifier: Primary agent plus independent reviews on 2026-07-18

## EvidenceBundleDraft

- Artifact key: task1-preflight
- Type: execution preflight
- Source: isolated worktree plus read-only Netcup/Gateway checks on 2026-07-18
- Summary: Worktree creation, input presence inventory, both host boundaries, Go 1.26.5 unit tests, and Node 20/pnpm 9 frontend lint/typecheck/93 critical tests were verified; the generated cache was removed only after exact-path user approval.
- Verifier: Primary agent commands plus three read-only default subagent probes
- Audit detail: `evidence-bundle-draft-task1-preflight.json` records each input's presence-only state, repository/worktree/remotes, both hosts' nonsecret version/listener/service summaries, exact toolchain/test outcomes, and scoped cleanup result.

## EvidenceBundleDraft

- Artifact key: task2-toolchain-lock
- Type: implementation and verification
- Source: commit `2359acad8`
- Summary: Locked 12 container images, checkout action, pnpm, golangci-lint, and govulncheck; added one closed dispatcher and fixture. Every manifest resolved with `linux/amd64`; syntax/fixture/spec/quality checks passed.
- Verifier: Primary agent commands plus two fresh default-agent reviews

## EvidenceBundleDraft

- Artifact key: task3-gitea-workflow-owner
- Type: implementation, retirement, and regression verification
- Source: commit `eea546041`
- Summary: Added the four Gitea workflows and active audit exceptions, deleted all active GitHub workflow/GoReleaser owners, updated developer guidance, and repaired locked-image Docker preflight without widening the DinD boundary. All seven dispatcher paths passed in locked Go/Node images.
- Verifier: Primary agent runtime/static checks plus fresh specification and quality reviews
- Audit detail: `evidence-bundle-draft-task2-3-repository-ci.json` records commits, runtime checks, review results, retirement boundary, official Gitea 1.26 contracts used, and uncovered live-smoke scope.

## EvidenceBundleDraft

- Artifact key: task4-private-platform
- Type: implementation, fault injection, and independent review
- Source: commit `c65b78cbd`
- Summary: Added the four-service Gitea platform, Caddy, strict root-only configuration loaders, streamed encrypted backup, safe restore drill, deterministic retention, failure notification, hardened systemd timer, runbook, and eight local tests. All tests plus formal Caddy validation and dispatcher regression passed.
- Verifier: Primary agent fresh commands plus four initial and four repair-focused default-agent reviews
- Residual boundary: No Netcup mutation occurred. Installed-path systemd, NTP/TLS, real Gitea/Registry permissions, webhook 2xx, operator-held age identity, and full restore remain Tasks 9-11 evidence gates.

## EvidenceBundleDraft

- Artifact key: task5-isolated-runner
- Type: implementation, disposable runtime smoke, fault injection, and independent review
- Source: commit `86f5abbc1`
- Summary: Added a fixed-name two-service Runner project. Only locked rootless DinD is privileged; Runner is UID/GID 1000 with no host Docker endpoint, no host namespace, four digest-qualified labels, capacity one, disabled cache/metrics/privileged jobs, and an exact shared Unix socket. Added strict ephemeral registration-token staging/removal, schema/config tests, negative startup tests, and a disposable real DinD smoke.
- Verifier: Primary agent fresh commands plus three initial and two repair-focused default-agent reviews
- Runtime evidence: Rootless security options were present; the shared socket was `1000:1000` mode `1660`; no 2375/2376 listener or published port existed; locked Docker CLI connected only through the socket; a locked inner Alpine ran as 65534:65534 with read-only root and no capabilities; all owned smoke resources were removed.
- Repair detail: Explicit `dockerd --host=unix:///run/user/1000/docker.sock --group=root` avoids the locked entrypoint's TCP injection and host-dependent subordinate GID. Root-only registration input stays outside the archived Runner tree, is staged mode 0400 only while DinD holds the tmpfs, and is removed on success or timeout. Bootstrap backups now always require the API config needed by restore drills.
- Residual boundary: No Runner registered and no Netcup mutation occurred. Real token consumption, socket injection inside a Gitea job, protocol/context compatibility, and restored Runner authentication remain Task 11 live gates.

## EvidenceBundleDraft

- Artifact key: task6-repository-controls
- Type: implementation, locked-version API probe, fault injection, and independent review
- Source: commit `908aa74c5`
- Summary: Added root-only Gitea bootstrap/configure/verify automation, exact organization/repository/team/collaborator ownership, least-privilege service PAT creation and rotation metadata, protected branch/tag templates, exact Actions secret installation, a POSIX immutable `v*` update hook with a root-only transactional installer, and backup coverage for all administrative control material.
- Verifier: Primary agent static/runtime checks plus locked Gitea 1.26.4 disposable API/OpenAPI/Registry probes and two fresh final default-agent audits
- Runtime evidence: Granular teams exposed exact `units_map`; restricted individual service users supported Basic-auth token creation only with forced password-change disabled; exact PAT scopes and package-team Registry authorization passed; the reserved `GITEA_` user-secret prefix was rejected and `RELEASE_RECORD_TOKEN` accepted; branch/tag protection payloads matched locked OpenAPI contracts.
- Hook evidence: Creation of `v*` tags remained allowed while move/delete was rejected; ordinary tags and branches were unaffected. Tests rejected wrong paths, symlinks, owner/mode/checksum drift, missing managed hooks, invalid checksum evidence, and failed record publication; explicit reinstall restored the hook after simulated regeneration.
- Residual boundary: No external Gitea or Gateway mutation occurred. Real admin 2FA gate, Runner registration/job contexts, main status checks, SSH-only release tagging, Registry operations, restored credentials, and immutable-tag receive-pack behavior remain Task 11 live gates.

## EvidenceBundleDraft

- Artifact key: task7-gateway-enforcement
- Type: implementation, fault injection, regression verification, and independent review
- Source: commit `a9ab06b61`
- Summary: Added the only Gateway production-mutation owner: atomic fixed-path installation, strict source-bound forced-SSH dispatch, exact Gitea main/Registry validation, encrypted and validated PostgreSQL/deployment backup, migration-sensitive compare and one-time approval, single-line digest deployment, bounded health/evidence behavior, deployment state/retention, and a network-none PostgreSQL 18.4 restore drill.
- Verifier: Primary agent fresh tests plus specification, security, backup/restore, installer/operations, test-coverage, repair, environment-failure, and final-diff default-agent audits
- Dispatcher evidence: Only `status` and exact lower-hex commit/digest deployment grammar survived; source IP, numeric ports, PTY, agent/X11, alternate syntax, baseline, approval, environment, PATH, and shell injection probes were rejected with no arbitrary execution.
- Mutation evidence: Lock contention returned 75; stale head before backup and after a validated backup returned 76; API/compare, database/archive producer, both validators, age, disk, fsync/fdatasync, audit, env-write, and SIGTERM faults stopped before unsafe mutation and removed only owned partials. A successful fixture changed exactly one `SUB2API_IMAGE` line and verified state/audit.
- Approval/failure evidence: Commit, digest, sensitive-path hash, expiry, consumed-nonce replay, CI, and noninteractive approval failures returned 78. Pull/start/health failures retained encrypted backup and redacted evidence, never called restore, and exposed `state_env_consistent=false`/`intervention_required=true` instead of claiming an automatic rollback.
- Restore/retention evidence: The locked restore container had network none, no published port, one labelled non-live volume, and owned cleanup on success/failure. Active leases/newest three were retained, an expired stale reference was eligible for checksum-bound fd-safe deletion, and a production sentinel was untouched.
- Residual boundary: No Gateway installation, backup, deployment, database access, or SSH key change occurred. Real protected-main/Registry contracts, host ownership/reboot/logrotate, age custody, baseline backup/restore, forced-key source restriction, Compose health, and production digest/revision remain Tasks 12/15 live gates.

## EvidenceBundleDraft

- Artifact key: task8-repository-gate
- Type: repository-only verification gate
- Source: branch HEAD `a9ab06b61707283feb9d2baaa7ae8014e626c166`
- Summary: All seven dispatcher paths, all 15 migration shell tests, both effective Compose invariant suites, the digest-locked AMD64 application build, retirement/compatibility searches, tracked-secret checks, and diff hygiene passed without a push or external mutation.
- Verifier: Primary agent fresh commands plus three read-only default-agent acceptance/inventory/retirement probes
- Runtime evidence: Backend unit/integration, frontend lint/typecheck/93 tests, golangci-lint `0 issues`, govulncheck `0` reachable vulnerabilities, and pnpm audit-exception validation passed in locked toolchain images. Disposable Caddy, token, Testcontainers, and rootless DinD resources left no Task 8 container behind.
- Build evidence: `211api:gitea-plan-verify` is `amd64`, image ID `sha256:b4c84f7d159b267a4b32aa7fc7f8d9bbca128035a1deb12c6b9b4f550e086bc5`, and its OCI revision is the exact branch HEAD. The first attempt had a transient Alpine package-index I/O failure; an identical no-push retry passed without changing source or locks.
- Retirement evidence: `.github/workflows` is absent; active `PROD_ENV_B64|GHCR_TOKEN|DOCKERHUB_|TELEGRAM_` references are absent; the declared `Wei-Shaw/sub2api` updater/download boundary remains nonempty. Four high-confidence secret-pattern hits matched the exact pre-existing test-fixture allowlist, while production secret paths and suspect tracked filenames remained empty.
- Residual boundary: This is repository/local-container evidence only. No Netcup, Gateway, Gitea, DNS, Registry, GitHub, or production runtime verification is claimed; real gates remain Tasks 9-12/15 and cutover still stops at Task 13.
- Audit detail: `evidence-bundle-draft-task8-repository-gate.json` records commands' semantic outcomes, derived local state, exact fixture boundary, initial network diagnostic, and unverified live scope.

## EvidenceBundleDraft

- Artifact key: task9-netcup-preflight
- Type: live Netcup preflight; complete no-start checkpoint
- Source: commits `65d8fe563`, `53cb6a213`, and Pipedream adapter `af5b0cb6f`; local/locked-Node checks, `root@37.221.194.27:4422` on 2026-07-18/19, and operator Pipedream/Telegram checks
- Summary: Installed and verified the approved Netcup prerequisites, time/uidmap/path ownership, checksum-matched production assets, presence-only platform secrets, SSH 4422 Fail2ban jail, IPv4-only UFW exposure, persistent IPv4/IPv6 Docker guards, public age recipient, both no-start Compose renders, and the bounded Pipedream-to-Telegram backup-failure path. The opaque endpoint is a regular root-owned mode-0600 single-line file; no endpoint or Telegram credential was recorded.
- Verifier: Primary agent fresh local/locked-Node/SSH checks, operator-reported Pipedream status classes and Telegram receipt, plus independent host-installer, firewall, repair, and Fail2ban-readiness reviews
- Runtime evidence: Pipedream returned preflight 200, invalid-schema 400, and notification-test 200; the dedicated group received the bounded test message. A fresh Netcup preflight returned 200; all preserved services were active; only sshd 4422 listened; no container, `gitea`, or `act_runner` process existed; both Compose renders and the firewall guard passed; the Gitea jail remained disabled.
- Diagnostic evidence: Debian Fail2ban's Type=simple service exposed a real active-before-socket race. The checked-in bounded readiness owner passed on attempt two after a real restart. Docker restart returned while its wanted guard briefly activated, so the final check joined the queued unit without issuing a second Docker restart.
- Residual boundary: Task 9 is complete. Gitea/Runner/DNS/TLS/bootstrap remain untouched; Task 10 still requires Cloudflare authority and bootstrap identities, and Task 13 still requires fresh cutover approval.
- Audit detail: `evidence-bundle-draft-task9-netcup-preflight.json` records package versions, time/uidmap bounds, path modes, manifest hashes, presence-only secret shape, notification status classes, both Compose renders, firewall ordering, preserved services, diagnostics, and exact residual gates without secret values.

## EvidenceBundleDraft

- Artifact key: pipedream-telegram-adapter-local
- Type: local adapter verification
- Source: commit `af5b0cb6f`; `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs` and `.test.mjs`
- Summary: Versioned the copy-pasteable Pipedream Node adapter. `node --check` passed; `node --test` passed 8/8 both locally and in the digest-locked Node 20.20.2 image, covering silent preflight, invalid method/content/schema/field/timestamp/code/unit, success rendering, configuration failure, and Telegram HTTP, `ok:false`, malformed JSON, and network failures. Actual endpoint, chat ID, and bot token were absent.
- Verifier: Primary agent fresh local Node 24.14.1 plus digest-locked Node 20.20.2 tests, diff, and secret-pattern checks on 2026-07-19
