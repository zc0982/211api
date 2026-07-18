# Gitea CI/CD Migration Implementation Plan

Date: `2026-07-18`
Status: `ready for execution-choice review`
ArchitectureReviewRequired: `yes`
Parent spec: `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`

## Goal

Replace this private fork's GitHub-owned delivery chain with a private Gitea
1.26.4 platform, Gitea Registry, isolated Gitea Runner, and digest-qualified
Gateway deployment while keeping the live 211API application, PostgreSQL,
Redis, ingress, configuration, and business data on Gateway Los Angeles.

## Architecture

- Netcup `37.221.194.27`: Caddy, Gitea, Gitea PostgreSQL, Gitea Runner, and a
  separate privileged rootless DinD daemon.
- Gateway `157.254.234.244`: unchanged 211API runtime owner; receives only a
  verified image reference and audited deployment command.
- Gitea is the fork delivery owner. GitHub remains only the retained public
  upstream source and an inert historical fork after Actions is disabled.
- Repository code owns reproducible manifests, workflow logic, image locks,
  backup/deploy scripts, and verification. Secret values stay in host files or
  Gitea Actions secrets and never enter Git.

## Tech Stack and Version Lock

| Surface | Pinned version | Manifest-list digest |
| --- | --- | --- |
| Gitea rootless | `gitea/gitea:1.26.4-rootless` | `sha256:cd1d2614b403fc9b085fa52ceb4424dde9c4dcf5da8e3263abb27955562070c4` |
| Gitea Runner | `gitea/runner:2.1.0` | `sha256:b1d3cb21a98fcfc3e6f242e847136045cf1972b943f09805fb607f94b1dedc0d` |
| Caddy | `caddy:2.11.4-alpine` | `sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648` |
| Gitea PostgreSQL | `postgres:14.23-alpine` | `sha256:f1341c01408dc7278e9d365ed4f860cd3f87dd16b4464ac326fc0f422083a579` |
| Rootless DinD | `docker:29.6.1-dind-rootless` | `sha256:371962f4344295a1eb185f1c9e62064bf4503a7beb8c6e73be3405500041784b` |
| Docker CLI job | `docker:29.6.1-cli` | `sha256:862099ada15c669000bef53aa4cb9d821262829f45b0dda2159ccb276443043b` |
| Go CI job | `golang:1.26.5-bookworm` | `sha256:1ecb7edf62a0408027bd5729dfd6b1b8766e578e8df93995b225dfd0944eb651` |
| Node CI job | `node:20.20.2-bookworm` | `sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5` |
| App frontend build | `node:24.18.0-alpine` | `sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd` |
| App backend build | `golang:1.26.5-alpine` | `sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2` |
| App runtime | `alpine:3.21.7` | `sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d` |
| App PostgreSQL client | `postgres:18.4-alpine` | `sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15` |

Additional locks:

- checkout action: `https://gitea.com/actions/checkout` commit
  `df4cb1c069e1874edd31b4311f1884172cec0e10` (`v6.0.3`)
- pnpm: `9.15.9`
- golangci-lint: `v2.9.0`
- govulncheck module: `v1.6.0`

Official authority links:

- [Gitea 1.26.4 release](https://github.com/go-gitea/gitea/releases/tag/v1.26.4)
- [Gitea Runner 2.1.0 release](https://gitea.com/gitea/runner/releases/tag/v2.1.0)
- [Caddy 2.11.4 release](https://github.com/caddyserver/caddy/releases/tag/v2.11.4)
- [PostgreSQL 14 release notes](https://www.postgresql.org/docs/14/release.html)
- [Docker rootless requirements](https://docs.docker.com/engine/security/rootless/)
- [Gitea 1.26 Actions documentation](https://docs.gitea.com/1.26/usage/actions/overview)
- [Gitea 1.26 protected tags](https://docs.gitea.com/1.26/usage/access-control/protected-tags)

## Baseline and Authority Refs

- `docs/aegis/baseline/2026-07-18-initial-baseline.md`
- `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`
- `README_CN.md`, `DEV_GUIDE.md`, `deploy/README.md`
- `.github/workflows/*.yml`, `.goreleaser.yaml`, `.goreleaser.simple.yaml`
- `Dockerfile`, `deploy/docker-compose.local.yml`, root/backend Makefiles
- Gitea 1.26.4 OpenAPI template at tag `v1.26.4`
- 2026-07-18 read-only Netcup and Gateway inspections

## Aegis Visibility

Planning is required because this work changes the canonical delivery owner,
creates privileged build infrastructure, retires GitHub release paths, and
crosses a forward-only production migration boundary.

## BaselineUsageDraft

- Required baseline refs: initial baseline, approved design, current workflows,
  deployment Compose, official Gitea 1.26.4 contract, both host inspections.
- Acknowledged before plan: all required refs.
- Cited in plan: all required refs.
- Missing refs: none.
- Decision: `continue`.

## Requirement Ready Check

- Requirement source: user-approved written Design Spec.
- Goal/scenario: private team fork, Gitea-only delivery, Gateway production.
- Acceptance source: Design Spec section 14.
- Runtime inputs still required: Cloudflare API authorization, human Gitea
  identity details, an operator-held age recipient and private-key custodian
  available for isolated drills, an external JSON webhook, and generated
  credentials. These are execution inputs, not missing design.
- Decision: `ready`.

## TDD Route

- Mode: `off`.
- Decision: `skipped`.
- Strict authority: not applicable; neither user nor project requested strict
  test-first TDD.
- Test posture: minimum implementation followed by focused regression,
  configuration validation, isolated destructive-boundary probes, and full
  cutover evidence.
- Reason: the main artifacts are workflows, Compose, shell scripts, permissions,
  and external-state transitions rather than a behavior defect requiring RED.
- Verification: every task below has exact local or remote checks and a stop
  condition.

## Scope Check

### Facts

- Netcup is Debian 13.5, 4 vCPU, 7.8 GiB RAM, 285 GiB free; Docker 29.6.1 and
  Compose 5.3.0 are present; ports 80/443/2222 are unused.
- Netcup has no active NTP service and lacks `newuidmap`/`newgidmap`; UFW is
  active with only 4422 allowed; Hermes and Komari are actually
  `hermes-gateway.service` and `komari-agent.service` and are active.
- Gateway is healthy on image commit
  `5ed5530c098896e8caecca83d42c279bc65b9381`; application exposure is only
  `127.0.0.1:8080`; Docker credentials exist at `/root/.docker/config.json`
  mode 0600.
- Gateway host key fingerprints are ED25519
  `SHA256:mjqTB3ZZQTbi0kv6cYfHzhBtWbohjb8klYGId4KnnS4` and RSA
  `SHA256:Y90Pf4PYF16qX2on5JnXKm5ZfJnTxUKoohhB12YnyOQ`.
- Current high production dependency findings are only the two recorded `xlsx`
  advisories; obsolete lodash/lodash-es/axios exceptions no longer match audit.

### Assumptions to verify during execution

- Cloudflare token has DNS edit on the `211api.com` zone and no broader use is
  required.
- Gitea Runner 2.1.0 interoperates with Gitea 1.26.4 for every used feature;
  the non-main compatibility smoke is the proof, not release recency.
- Gitea rootless paths remain `/var/lib/gitea` and `/etc/gitea` in the pinned
  image; `docker compose config` and a disposable start prove this before data
  import.

### Execution gates, not fabricated defaults

Execution must stop before external writes unless these are supplied or safely
generated:

- `CLOUDFLARE_API_TOKEN` with DNS edit only;
- bootstrap admin username/email and at least one non-admin team identity for
  negative permission tests;
- `BACKUP_AGE_RECIPIENT`, whose private key is held off both servers;
- an operator who can mount that offline age private key into a root-only tmpfs
  for the two explicit restore drills without disclosing or persisting it;
- `BACKUP_FAILURE_WEBHOOK_URL`, accepting JSON and returning HTTP 2xx;
- authenticated `gh` access to `zc0982/211api` for the final Actions-disable
  operation.

## Compatibility Boundary

- Preserve `Wei-Shaw/sub2api` GitHub Releases in
  `backend/internal/service/update_service.go` and
  `backend/internal/repository/github_release_service.go`.
- Preserve public upstream installation/download documentation that correctly
  points to `Wei-Shaw/sub2api`; private fork delivery must not replace it.
- Preserve Gateway data, `.env` values, Compose services, loopback binding,
  Caddy/cloudflared ingress, and current business database.
- Do not add GitHub mirror, DockerHub, legacy Telegram release/deploy, ARM64,
  macOS, Windows, or binary-release compatibility paths. The only Telegram
  exception is the approved Pipedream adapter scoped to Gitea platform backup
  failures in `2026-07-19-pipedream-telegram-backup-notification.md`.

## Change Necessity

- User-visible need: Gitea must be the real, auditable delivery owner.
- No-change option: manually copying GitHub workflow behavior to servers leaves
  no versioned owner, reproducibility, or retirement proof.
- Why repository change is necessary: Gitea workflows, exact image locks,
  deployment enforcement, backup scripts, and old-path deletion must travel
  with the fork.
- Minimum boundary: `.gitea/`, `deploy/gitea/`, `tools/gitea-ci.sh`, and the CI
  section of `DEV_GUIDE.md`; application update-provider code is untouched.
- Decision: `code-change` limited to delivery/configuration code.

## Existence Check

| Proposed surface | Existing reuse | Creation proof | Decision |
| --- | --- | --- | --- |
| `.gitea/workflows` | `.github/workflows` test intent | Gitea canonical path is required | add with old path deleted |
| `tools/gitea-ci.sh` | Makefile test targets | one dispatcher prevents CI/deploy drift without duplicating test logic | add with proof |
| `deploy/gitea/` | existing `deploy/` owner | platform/runner/Gateway assets belong beside deployment assets | add under existing owner |
| image lock | Dockerfile floating build args | exact digests are an approved reproducibility invariant | add one canonical env lock |
| managed immutable-tag hook | native protected tags | Gitea 1.26 couples create/update/delete; no native rule satisfies the approved split | add with proof; user hooks stay disabled |
| release request lane | direct human tag push | separates human authorization from SSH-only technical tag creation | add inside existing `release.yml` |

## Architecture Integrity Lens

- Invariant: one fork delivery owner; production remains Gateway.
- Canonical owners: Gitea for repository/CI/artifacts, `deploy/gitea` for host
  automation, Gateway script for production mutation.
- Responsibility overlap removed: `.github/workflows` and GoReleaser stop
  carrying delivery behavior before Gitea main activates.
- Higher-level simplification: one CI dispatcher and one Gateway mutation script
  replace repeated workflow shell fragments.
- Falsifier: any need for host Docker socket, an enabled GitHub deploy path, or a
  second production mutation script returns to design.
- Verdict: proceed.

## First-Principles Tag Review

- First principle: a released Git ref cannot move after creation.
- Non-negotiables: release maintainers initiate; only a technical SSH identity
  creates; no user-controlled server hook; admins remain the trusted root.
- Assumptions dropped: Gitea native protected-tag whitelist does not distinguish
  create from delete; Runner 2.1.0 does not propagate an external TCP daemon's
  client TLS material into Docker CLI job containers.
- Smallest sufficient path: protected `release/v*` request + SSH-only tag bot +
  root-managed update hook + separate non-whitelisted release PAT.
- Escalation signal: if API/Git negative tests can move/delete a protected tag,
  stop before cutover and return to design; no permissive fallback is allowed.

## Plan Pressure Test

- Owner/retirement: explicit and single-owner.
- Architecture: host-socket fallback forbidden; tag-control limitation handled
  at the repository owner boundary.
- Verification: local, non-main, host, cutover, production, and restore evidence
  are all represented.
- Executability: runtime secrets are named gates; no value is fabricated.
- Pressure result: `proceed`.

## Plan-Time Complexity Check

- Artifact class: workflow/configuration and host shell automation.
- Existing pressure: current deployment logic is embedded in GitHub YAML and
  has no rollback-aware server owner.
- Better boundary: thin workflows call one CI dispatcher and one root-owned
  Gateway deployment program; platform backup remains a separate script.
- Projected result: within budget if each script stays single-purpose and the
  Gateway script exposes only `status`, `approve-migration`, and `deploy`.
- Recommendation: add owner files; do not grow application Go code.

## Anti-Entropy Declaration

- Deletion class: code retirement for `.github/workflows` and `.goreleaser*`.
- New canonical owner: `.gitea/workflows` plus Gitea Registry/Release.
- Preserved behavior: Linux CI, security scan, main deployment, protected
  version release, public upstream update lookup.
- Retired behavior: GitHub Actions, CLA bot, GHCR, DockerHub, legacy Telegram
  release/deploy notifications, GoReleaser archives/manifests,
  macOS/Windows/ARM64 release lanes, `PROD_ENV_B64`.
- Bounded new behavior: Pipedream alone translates fixed Gitea backup-failure
  JSON to the dedicated Telegram group; it is not a CI/CD fallback.
- Compatibility exception: public `Wei-Shaw/sub2api` updater/install paths only.
- Persistent-state risk: no existing repository, tag, release, backup, or
  production data is deleted. Retention may remove only newly generated,
  validated derived backup sets under exact new backup directories.
- Retirement path: `delete-first`; no CI/CD fallback retained.

## File Map

### Create

- `.gitea/actions.lock`
- `.gitea/audit-exceptions.yml`
- `.gitea/workflows/ci.yml`
- `.gitea/workflows/security.yml`
- `.gitea/workflows/deploy.yml`
- `.gitea/workflows/release.yml`
- `tools/gitea-ci.sh`
- `deploy/gitea/README.md`
- `deploy/gitea/images.lock.env`
- `deploy/gitea/platform/compose.yaml`
- `deploy/gitea/platform/Caddyfile`
- `deploy/gitea/platform/gitea-backup`
- `deploy/gitea/platform/gitea-restore-drill`
- `deploy/gitea/platform/gitea-backup-notify`
- `deploy/gitea/platform/systemd/gitea-backup.service`
- `deploy/gitea/platform/systemd/gitea-backup.timer`
- `deploy/gitea/platform/systemd/gitea-backup-notify@.service`
- `deploy/gitea/runner/compose.yaml`
- `deploy/gitea/runner/config.yaml`
- `deploy/gitea/admin/bootstrap-gitea`
- `deploy/gitea/admin/admin-lib.sh`
- `deploy/gitea/admin/configure-repository`
- `deploy/gitea/admin/install-immutable-tag-hook`
- `deploy/gitea/admin/immutable-hook-installer`
- `deploy/gitea/admin/immutable-v-tags`
- `deploy/gitea/admin/templates/*.json`
- `deploy/gitea/admin/verify-repository`
- `deploy/gitea/gateway/install-gateway-deployer`
- `deploy/gitea/gateway/211api-deploy`
- `deploy/gitea/gateway/211api-deploy-dispatch`
- `deploy/gitea/tests/test-ci-dispatcher.sh`
- `deploy/gitea/tests/test-admin-primitives.sh`
- `deploy/gitea/tests/test-immutable-tag-hook.sh`
- `deploy/gitea/tests/test-gateway-deployer.sh`

### Modify

- `DEV_GUIDE.md`: Gitea remotes, Go 1.26.5, golangci-lint 2.9.0, four
  Gitea workflows, local verification.
- `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`: written approval
  state and native protected-tag feasibility clarification.
- `docs/aegis/INDEX.md` and active work checkpoint/evidence records.

### Delete from the canonical Gitea commit

- `.github/workflows/backend-ci.yml`
- `.github/workflows/security-scan.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/release.yml`
- `.github/workflows/cla.yml`
- `.github/audit-exceptions.yml` after its two active entries move to `.gitea/`
- `.goreleaser.yaml`
- `.goreleaser.simple.yaml`

### Explicit non-edits

- `backend/internal/service/update_service.go`
- `backend/internal/repository/github_release_service.go`
- `deploy/docker-compose.local.yml` and Gateway business `.env`
- public upstream install/update documentation in `README*` and `deploy/README.md`

## Task 1: Create an Isolated Execution Worktree and Lock Inputs

**Files:** none in the first step; later tasks run in the new worktree.

**Why:** keep the current clean `main` and user work isolated until Gitea is
ready to receive the migration branch.

**Change necessity:** no source change in this task.

**Steps:**

1. Confirm the parent checkout is clean and at the design commit:

   ```bash
   git status --short
   git rev-parse HEAD
   git merge-base --is-ancestor \
     ebfa95c341c914ef36c44f67735f82e4ed8ccec8 HEAD
   ```

   Expected: empty status and the approved design commit is an ancestor of the
   reviewed implementation-plan commit.

2. Create the implementation worktree without pushing to GitHub:

   ```bash
   git worktree add ../211api-gitea-cicd -b feature/gitea-cicd-migration
   git -C ../211api-gitea-cicd remote -v
   ```

   Expected: `origin` is still the old GitHub fork only as a local source; no
   push occurs.

3. Inventory execution inputs by name without printing values: Cloudflare token,
   age recipient, offline-key custodian availability, webhook URL, bootstrap
   identity fields, and authenticated `gh auth status`. Missing inputs do not
   block repository-only Tasks 2-8, but they block Task 9 and every later
   external write; record the exact gate rather than fabricating a value.

4. Re-run read-only host identity checks with `BatchMode=yes` and record only
   version/listener/service summaries in the work evidence.

**Verification:** worktree clean; no external state changed; no secret printed.

**Commit:** none.

## Task 2: Add the Canonical Image/Tool Lock and CI Dispatcher

**Files:** create `deploy/gitea/images.lock.env`, `.gitea/actions.lock`,
`tools/gitea-ci.sh`, and `deploy/gitea/tests/test-ci-dispatcher.sh`.

**Why:** workflows and Compose must resolve identical immutable inputs and test
commands.

**Change necessity:** existing GitHub setup actions hide floating setup/cache
behavior; explicit locked images and one dispatcher are the minimum auditable
replacement.

**Steps:**

1. Write `deploy/gitea/images.lock.env` with the exact tag-plus-digest values in
   the Tech Stack table. Use these variable names:

   ```dotenv
   GITEA_IMAGE=docker.io/gitea/gitea:1.26.4-rootless@sha256:cd1d2614b403fc9b085fa52ceb4424dde9c4dcf5da8e3263abb27955562070c4
   RUNNER_IMAGE=docker.io/gitea/runner:2.1.0@sha256:b1d3cb21a98fcfc3e6f242e847136045cf1972b943f09805fb607f94b1dedc0d
   CADDY_IMAGE=docker.io/library/caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
   GITEA_POSTGRES_IMAGE=docker.io/library/postgres:14.23-alpine@sha256:f1341c01408dc7278e9d365ed4f860cd3f87dd16b4464ac326fc0f422083a579
   DIND_IMAGE=docker.io/library/docker:29.6.1-dind-rootless@sha256:371962f4344295a1eb185f1c9e62064bf4503a7beb8c6e73be3405500041784b
   DOCKER_CLI_IMAGE=docker.io/library/docker:29.6.1-cli@sha256:862099ada15c669000bef53aa4cb9d821262829f45b0dda2159ccb276443043b
   GO_CI_IMAGE=docker.io/library/golang:1.26.5-bookworm@sha256:1ecb7edf62a0408027bd5729dfd6b1b8766e578e8df93995b225dfd0944eb651
   NODE_CI_IMAGE=docker.io/library/node:20.20.2-bookworm@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5
   APP_NODE_IMAGE=docker.io/library/node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
   APP_GO_IMAGE=docker.io/library/golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2
   APP_ALPINE_IMAGE=docker.io/library/alpine:3.21.7@sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d
   APP_POSTGRES_IMAGE=docker.io/library/postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15
   PNPM_VERSION=9.15.9
   GOLANGCI_LINT_VERSION=v2.9.0
   GOVULNCHECK_VERSION=v1.6.0
   ```

2. Write `.gitea/actions.lock` with only:

   ```text
   https://gitea.com/actions/checkout df4cb1c069e1874edd31b4311f1884172cec0e10 v6.0.3
   ```

3. Implement `tools/gitea-ci.sh` with `set -euo pipefail`, a closed case list,
   and these commands:

   - `backend-unit`: assert `go1.26.5`; run `make -C backend test-unit`.
   - `backend-integration`: assert `go1.26.5`; run
     `make -C backend test-integration`.
   - `frontend`: assert Node major 20; enable Corepack; activate pnpm 9.15.9;
     run frozen install and `make test-frontend`.
   - `lint`: install golangci-lint v2.9.0 into a temporary `GOBIN`; run from
     `backend/` with `--timeout=30m`; remove the temp directory via trap.
   - `security-backend`: install govulncheck v1.6.0 into a temporary `GOBIN`;
     run `govulncheck ./...` from `backend/`.
   - `security-frontend`: activate pnpm 9.15.9, frozen install, write audit JSON
     to `mktemp`, invoke `tools/check_pnpm_audit_exceptions.py` against
     `.gitea/audit-exceptions.yml`, and remove the temp file via trap.
   - `shell-syntax`: run `bash -n` over tracked shell files plus the extensionless
     Gitea deploy programs; do not execute Apple-container fixtures.
   - any other argument: print usage and exit 64.

4. Add a fixture-driven test that stubs `go`, `node`, `corepack`, `pnpm`, `make`,
   and `python3`, then proves every allowed subcommand dispatches exactly the
   expected command and an unknown command returns 64.

5. Verify all locked manifests still resolve and include `linux/amd64`:

   ```bash
   set -a
   source deploy/gitea/images.lock.env
   set +a
   for image in "$GITEA_IMAGE" "$RUNNER_IMAGE" "$CADDY_IMAGE" \
     "$GITEA_POSTGRES_IMAGE" "$DIND_IMAGE" "$DOCKER_CLI_IMAGE" \
     "$GO_CI_IMAGE" "$NODE_CI_IMAGE" "$APP_NODE_IMAGE" \
     "$APP_GO_IMAGE" "$APP_ALPINE_IMAGE" "$APP_POSTGRES_IMAGE"; do
     docker buildx imagetools inspect "$image" >/dev/null
   done
   ```

6. Run:

   ```bash
   bash -n tools/gitea-ci.sh deploy/gitea/tests/test-ci-dispatcher.sh
   bash deploy/gitea/tests/test-ci-dispatcher.sh
   ```

   Expected: all dispatcher cases pass; no network credential is required.

7. Commit:

   ```bash
   git add .gitea/actions.lock deploy/gitea/images.lock.env \
     tools/gitea-ci.sh deploy/gitea/tests/test-ci-dispatcher.sh
   git commit -m "ci: lock Gitea toolchain inputs"
   ```

## Task 3: Replace GitHub Workflow Ownership with Four Gitea Workflows

**Files:** create the four `.gitea/workflows/*.yml` files and
`.gitea/audit-exceptions.yml`; delete `.github/workflows/*`,
`.github/audit-exceptions.yml`, and `.goreleaser*`; modify `DEV_GUIDE.md`.

**Why:** Gitea cannot become canonical while GitHub workflow and GoReleaser
files still carry active fork delivery behavior.

**Change necessity:** configuration-only migration is insufficient unless the
old code owners are removed from the canonical branch.

**Impact/compatibility:** public upstream GitHub updater/install paths stay;
only private fork delivery paths retire.

**Steps:**

1. Move the two active `xlsx` exceptions to `.gitea/audit-exceptions.yml`.
   Remove the inactive expired lodash, lodash-es, and axios entries rather than
   renewing them. Prove the current audit still passes with the new file.

2. Create `ci.yml` named `ci`, using legal Gitea event keys `push` and
   `pull_request`. For a pull request, make the first guard compare the head
   repository full name with `gitea.repository` and fail closed unless it is a
   same-repository (internal) PR; do not invent an `internal` YAML event/filter.
   Use the pinned absolute checkout action. Define jobs for
   backend unit, backend integration, frontend, lint, and shell syntax, each
   invoking one dispatcher subcommand. Use runner labels `go-1.26.5`,
   `node-20.20.2`, or `linux-amd64`. Add aggregate job `required` with
   `if: always()`; it exits nonzero unless every required `needs.*.result` is
   `success`. Its expected commit status is `ci / required`.

3. Create `security.yml` named `security`, triggered by legal `push` and
   `pull_request` event keys plus cron `0 3 * * 1`, with the same internal-PR
   guard. Use one Go and one Node job invoking the
   security dispatcher cases, then aggregate job `required`. Expected status:
   `security / required`.

4. Create `deploy.yml` triggered only by `main` push. Repeat the same dispatcher
   jobs inside this workflow and make the build job depend on all of them;
   never infer success from another workflow's scheduling order. In the Docker
   CLI job:

   - authenticate to `git.211api.com` using `REGISTRY_BUILD_TOKEN` on stdin;
   - verify current `gitea.sha` equals the API's `main` SHA before publication;
   - build `linux/amd64` with every `APP_*_IMAGE` build arg from the lock file;
   - set OCI source, revision, version, and deterministic commit-date labels;
   - refuse a pre-existing SHA tag that resolves to another digest;
   - push only `:<40-hex-sha>`, inspect AMD64 manifest/digest, then recheck head;
   - write SSH key and known-hosts secrets to 0600 temporary files with `set +x`;
   - invoke the fixed forced command on
     `root@157.254.234.244:4422`;
   - after health success, recheck head and update `:main` only if still current.

5. Create `release.yml` with two lanes:

   - request lane on new `release/v*` branch: require actor membership in the
     release-maintainers team, branch head equal to `main`, matching SHA image,
     VERSION consistency, and no existing tag; use `RELEASE_TAG_SSH_KEY` to
     create/push the annotated tag as `svc-release-tag`, with separately pinned
     `RELEASE_TAG_KNOWN_HOSTS` rather than runtime key discovery. Set the remote
     literally to `ssh://git@git.211api.com:2222/211api/211api.git` and use
     `GIT_SSH_COMMAND` with `-p 2222`, `IdentitiesOnly=yes`, the temporary key,
     and the pinned known-hosts file; never fall back to port 22 or API tagging;
   - publication lane on `v*` tag: require the SHA digest, refuse conflicting
     version tags, retag the digest without rebuilding, update `latest` only for
     stable SemVer, and create the Gitea Release with
     `RELEASE_RECORD_TOKEN`. Prerelease tags set `prerelease=true`.

6. Delete all five GitHub workflow files and both GoReleaser files in the same
   commit. Do not create compatibility copies or a GitHub mirror.

7. Update `DEV_GUIDE.md` to name `git.211api.com/211api/211api`, Go 1.26.5,
   golangci-lint 2.9.0, pnpm 9.15.9, the four Gitea workflows, and dispatcher
   commands. Retain `git fetch upstream` behavior.

8. Verify locally:

   ```bash
   bash -n tools/gitea-ci.sh
   while IFS= read -r -d '' file; do bash -n "$file"; done \
     < <(find deploy/gitea -type f -name '*.sh' -print0)
   ./tools/gitea-ci.sh backend-unit
   ./tools/gitea-ci.sh backend-integration
   ./tools/gitea-ci.sh frontend
   ./tools/gitea-ci.sh lint
   ./tools/gitea-ci.sh security-backend
   ./tools/gitea-ci.sh security-frontend
   rg -n 'PROD_ENV_B64|GHCR_TOKEN|DOCKERHUB_|TELEGRAM_' .gitea deploy/gitea tools
   test ! -d .github/workflows
   test ! -e .goreleaser.yaml
   test ! -e .goreleaser.simple.yaml
   ```

   Expected: all checks pass; `rg` returns no matches. Do not treat retained
   `Wei-Shaw/sub2api` GitHub updater references as retirement failures. Parse
   all four workflow files as YAML and require the trigger keys to be exactly
   the legal Gitea keys above; the authoritative same-repository PR trigger and
   expression check remains the live smoke in Task 11.

9. Commit:

   ```bash
   git add -A .gitea .github .goreleaser.yaml .goreleaser.simple.yaml \
     DEV_GUIDE.md
   git commit -m "ci: replace GitHub workflows with Gitea Actions"
   ```

## Task 4: Add the Netcup Platform Stack and Consistent Backup Programs

**Files:** create `deploy/gitea/platform/*`, its three systemd units, and the
platform sections of `deploy/gitea/README.md`.

**Why:** the Gitea control plane needs a reproducible, secret-file-based owner
before DNS or repository migration.

**Change necessity:** host-only Compose assembled interactively would be an
unreviewed second source of truth.

**Impact/compatibility:** no host port except explicit IPv4 80, 443, and 2222;
no 211API service is added to Netcup.

**Steps:**

1. Create `platform/compose.yaml` with project name `gitea-platform` and exactly
   four services:

   - `secret-init`: a locked Alpine one-shot with no network, read-only root
     filesystem, all capabilities dropped, and only `CAP_CHOWN` restored for
     the bounded ownership handoff. Docker Compose cannot remap
     `uid`/`gid`/`mode` for file-backed secrets, so this root-only boundary
     copies the three root-owned 0600 source files into a dedicated named
     volume as UID/GID 1000 mode 0400. Gitea receives only that read-only
     staged volume; the service never remains running;

   - `postgres`: locked PostgreSQL 14.23, database/user `gitea`, password from
     `POSTGRES_PASSWORD_FILE=/run/secrets/gitea_db_password`, no published port,
     named data volume,
     `pg_isready` health check, 1 GiB memory limit;
   - `gitea`: locked 1.26.4 rootless image, UID/GID 1000, `/var/lib/gitea` and
     `/etc/gitea` named volumes, private HTTP 3000, explicit IPv4 publish
     `37.221.194.27:2222:2222`, database password via `__FILE`, generated
     secret/internal-token files, UTC timezone, 1 GiB memory limit, and
     `/opt/gitea/platform/log:/var/lib/gitea/log` for bounded authentication
     logs read by the host ban service;
   - `caddy`: locked 2.11.4, explicit IPv4 publishes
     `37.221.194.27:80:80` and `37.221.194.27:443:443`, read-only Caddyfile,
     persistent data/config volumes, 256 MiB memory limit;
   - no application or runner service.

2. Define Compose top-level file secrets `gitea_db_password`,
   `gitea_secret_key`, and `gitea_internal_token`. Their `file:` values come
   only from required path variables in the root-only host env file; mount the
   database secret into PostgreSQL/Gitea and the two security secrets only into
   Gitea. The host files and env file are root-owned 0600, the log directory is
   0750 and owned by numeric UID/GID 1000, and `docker compose config` must fail
   if any required path is absent. Set Gitea environment configuration
   explicitly:

   ```text
   server.DOMAIN=git.211api.com
   server.ROOT_URL=https://git.211api.com/
   server.SSH_DOMAIN=git.211api.com
   server.SSH_PORT=2222
   server.SSH_LISTEN_PORT=2222
   server.START_SSH_SERVER=true
   service.DISABLE_REGISTRATION=true
   service.REQUIRE_SIGNIN_VIEW=true
   service.DISABLE_REGULAR_ORG_CREATION=true
   repository.DEFAULT_PRIVATE=private
   actions.ENABLED=true
   security.INSTALL_LOCK=true
   security.DISABLE_GIT_HOOKS=true
   packages.ENABLED=true
   log.MODE=console,file
   log.file.FILE_NAME=/var/lib/gitea/log/gitea.log
   log.file.DAILY_ROTATE=true
   log.file.MAX_DAYS=14
   log.file.MAX_SIZE_SHIFT=24
   ```

   Use `GITEA__database__PASSWD__FILE`,
   `GITEA__security__SECRET_KEY__FILE`, and
   `GITEA__security__INTERNAL_TOKEN__FILE` pointing to the staged read-only
   `/run/gitea-secrets/*` files. PostgreSQL alone reads the raw database file at
   `/run/secrets/gitea_db_password`. Never put password, secret key, internal
   token, or admin password in Compose environment literals.

3. Create `platform/Caddyfile` for only `git.211api.com`, JSON access logs to
   stdout, zstd/gzip encoding, and this valid active-health structure:

   ```caddyfile
   reverse_proxy gitea:3000 {
       health_uri /api/healthz
       health_interval 30s
       health_timeout 5s
   }
   ```

   Keep Caddy's global `log_credentials` option absent (its default redacts
   Cookie/Authorization-class headers) and use the documented filter encoder
   `request>uri delete` so no query value is retained. Apply Docker `local`
   logging limits (`max-size=10m`,
   `max-file=5`) to every platform/runner service. Do not proxy SSH or publish
   the Caddy admin API. Validate both Caddy syntax and a synthetic
   Authorization/Cookie/query sentinel never appearing in captured JSON logs.

4. Implement `platform/gitea-backup` as a root-only Bash program that:

   - takes `/run/lock/gitea-platform-backup.lock` with nonblocking `flock`;
   - authenticates API reads through a root-only one-line curl config owned by
     a dedicated non-admin `svc-backup-read` identity with only `read:user`,
     `read:repository`, and `read:package`; it never reuses deployment or
     release credentials;
   - requires `BACKUP_AGE_RECIPIENT`, a 2xx webhook configuration, at least 20%
     free disk, and room for two estimated sets;
   - asks Gitea's API for active Actions tasks and postpones once when any task
     is running; it never kills a job;
   - snapshots normalized release/package metadata before quiescing ingress and
     verifies the API snapshots are unchanged after service restoration, so a
     concurrent release or package write invalidates the partial set;
   - treats a not-yet-created or already-stopped Runner container as idle during
     the bootstrap backup, while still requiring the non-admin backup API
     config and without treating any API/network failure as idle;
   - stops runner dispatch, then Gitea and Caddy, while PostgreSQL remains up;
   - creates a PostgreSQL custom stream using the matching client and records
     start/end UTC plus WAL positions while Gitea remains quiesced;
   - streams the exact PostgreSQL dump and each archive through a validator and
     `age` concurrently, covering Gitea data/config, repositories/packages,
     runner registration, Compose/lock files, and Caddy data/config; no complete
     plaintext dump or tar is written to disk;
   - captures validator exit status for `pg_restore --list` and full tar
     listings, rather than losing process-substitution failures;
   - writes only `.partial` ciphertext during construction; traps EXIT/HUP/INT/
     TERM, removes owned partials, fsyncs components and the nonsecret manifest,
     then atomically renames the set to `.validated`;
   - always restores Caddy, Gitea, and runner service and verifies health;
   - rotates only after a new validated set, under the backup/restore lock, using
     manifest fields `validated_at`, `role`, `lease_until`, and `referenced_by`.
     Dry-run the deterministic selection first; retain seven daily, four weekly,
     the current/leased drill set, the newest known-good set, and any upgrade
     predecessor. Never infer deletability merely from a missing state pointer;
   - writes `/opt/gitea/backups/FAILED` on failure and removes the marker only
     after a later fully validated backup.

5. Implement `gitea-backup-notify` to read the failure record, POST a fixed JSON
   schema to the URL stored in root-only `/etc/gitea/backup-notify-url`, require
   HTTP 2xx, and never include tokens, repository contents, or command output.
   The external adapter and its verification are owned by
   `2026-07-19-pipedream-telegram-backup-notification.md`.

6. Implement `gitea-restore-drill` to require the operator age key from a tmpfs
   path, decrypt into root-only temporary storage, start isolated temporary
   volumes/network on loopback-only alternate HTTP port, and verify database,
   login API, clone, exact ref counts, release metadata, and package manifest.
   It must reject any target path equal to a live volume and remove only its
   own temporary resources. Require `umask 077`, an explicit operator
   confirmation naming the backup ID, offline-key custody evidence without key
   content, and cleanup/unmount on every exit. The drill command has no option
   that targets a live Compose project.

7. Add systemd units:

   - `gitea-backup.timer`: `OnCalendar=*-*-* 18:30:00 UTC`, persistent, randomized
     delay disabled so evidence is deterministic;
   - `gitea-backup.service`: oneshot, root, hardened filesystem/device settings,
     `OnFailure=gitea-backup-notify@%N.service`; `%N` removes the source unit
     suffix, and the notifier template appends `.service` to its payload value;
   - notification template service calling only the notifier.

   The backup preflight also verifies NTP synchronization/offset bounds, Gitea
   health, certificate chain, and at least 14 days of certificate validity; its
   existing failure marker/webhook is the daily time/renewal-failure alert path.

8. Add README commands for secret generation, Compose validation, backup,
   restore drill, and upgrade backup. Every secret command begins with
   `umask 077`; examples refer to secret file paths, never example values. Every
   platform Compose start/stop/config command passes both the nonsecret image
   lock and `/etc/gitea/platform.env`; backup/systemd units declare the root-only
   env file with `EnvironmentFile=` and their script still supplies both explicit
   `--env-file` arguments to Compose. Never rely on the current shell or
   Compose's implicit `.env` lookup.

9. Verify locally with dummy secret files in a temporary directory. The test
   harness defines `$tmp`, installs the three dummy files mode 0600, and creates
   `$tmp/platform.env` containing only their absolute path variables; the trap
   removes that owned directory on exit:

   ```bash
   docker compose --env-file deploy/gitea/images.lock.env \
     --env-file "$tmp/platform.env" \
     -f deploy/gitea/platform/compose.yaml config --quiet
   docker run --rm --read-only \
     -v "$PWD/deploy/gitea/platform/Caddyfile:/etc/caddy/Caddyfile:ro" \
     "$CADDY_IMAGE" caddy validate --config /etc/caddy/Caddyfile \
       --adapter caddyfile
   bash -n deploy/gitea/platform/gitea-backup \
     deploy/gitea/platform/gitea-restore-drill \
     deploy/gitea/platform/gitea-backup-notify
   systemd-analyze verify deploy/gitea/platform/systemd/*.service \
     deploy/gitea/platform/systemd/*.timer
   ```

   Expected: valid Compose/Caddy/unit syntax; rendered Compose defines every
   referenced secret, has no secret values, and only the three approved IPv4
   published ports. Fault-injection tests cover validator failure, `age`
   failure, disk full, SIGTERM, fsync failure, and stale partial cleanup without
   leaving plaintext or promoting an invalid set.

10. Commit:

   ```bash
   git add deploy/gitea/platform deploy/gitea/README.md
   git commit -m "ops: define private Gitea platform stack"
   ```

## Task 5: Add the Isolated Gitea Runner and Rootless DinD Stack

**Files:** create `deploy/gitea/runner/compose.yaml`, `config.yaml`, and focused
Runner configuration/DinD smoke tests; update `deploy/gitea/README.md`.

**Why:** CI needs Docker execution without the Netcup host Docker socket.

**Change necessity:** the official basic runner otherwise expects an external
daemon; a separate rootless DinD is the approved isolation boundary.

**Impact/compatibility:** only the DinD service is privileged; the runner and
job containers are not.

**Steps:**

1. Create project `gitea-runner` with two services:

   - `docker`: locked `29.6.1-dind-rootless`, `privileged: true`, its image's
     rootless UID/GID 1000 execution path,
     `DOCKER_TLS_CERTDIR=` because no TLS/TCP endpoint exists, no published
     ports, persistent `/home/rootless/.local/share/docker`, shared named tmpfs
     runtime volume at `/run/user/1000`, and an explicit command beginning with
     `dockerd` followed by the sole daemon endpoint
     `--host=unix:///run/user/1000/docker.sock` and `--group=root`. The group
     flag makes root inside RootlessKit map to the outer fixed GID 1000 instead
     of leaking a host-dependent subordinate GID onto the shared socket. The
     leading `dockerd` is
     security-significant: the locked image's entrypoint adds
     `tcp://0.0.0.0:2375` when its first argument begins with `-`, while the
     explicit command retains the rootless checks/RootlessKit path without that
     listener injection. Apply 3 GiB memory and 3 CPU limit;
   - `runner`: locked basic `gitea/runner:2.1.0`, forced by Compose to numeric
     unprivileged UID/GID 1000 with `HOME=/data`, 512 MiB and 0.5 CPU limit,
     pre-owned runner data volume, read-only config, the same named tmpfs runtime
     volume mounted read-write at `/run/user/1000`, a registration-token file
     path inside that tmpfs, `DOCKER_HOST=unix:///run/user/1000/docker.sock`, and
     no host path or host socket mount.

     The mount mode is not treated as authorization: Docker socket access already
     grants full control of only the disposable DinD daemon, and a read-only
     filesystem mount does not meaningfully reduce Unix-socket API authority.
     Isolation comes from the dedicated named tmpfs and absence of the host
     daemon socket.

2. Supply runner labels through `GITEA_RUNNER_LABELS`, interpolated from the
   image lock:

   ```text
   linux-amd64:docker://${NODE_CI_IMAGE}
   go-1.26.5:docker://${GO_CI_IMAGE}
   node-20.20.2:docker://${NODE_CI_IMAGE}
   docker-29.6.1:docker://${DOCKER_CLI_IMAGE}
   ```

   This is why Runner 2.1.0 is selected: its stable release explicitly honors
   colon-containing `GITEA_RUNNER_LABELS`.

3. Configure `runner.capacity: 1`, `runner.timeout: 3h`, Gitea TLS verification on,
   no debug logs, `cache.enabled: false`, `container.privileged: false`,
   `container.valid_volumes: []`,
   `container.docker_host: unix:///run/user/1000/docker.sock`,
   `container.bind_workdir: false`, IPv6-disabled per-job networks, forced image
   pulls disabled, and no host-mode labels.

4. Define the runtime volume as local-driver tmpfs owned 1000:1000 mode 0700.
   Runner startup waits for that exact socket and requires effective
   UID/GID 1000 access plus numeric owner/group 1000:1000 before connecting.
   The intended
   Runner 2.1.0 contract, implemented by
   `internal/app/run/runner.go` (`ContainerDaemonSocket`) and
   `act/runner/run_context.go` (`GetBindsAndMounts`/`validVolumes`), is that
   `container.docker_host` causes its built-in daemon-socket bind to be placed
   at `/var/run/docker.sock` inside each job;
   `container.valid_volumes: []` must continue to reject workflow-requested
   mounts and must not disable this built-in bind. Treat that as an assumption
   until the disposable daemon smoke below and live job smoke in Task 11 both
   prove it. Fail startup if the socket is missing; never fall back to TCP
   2375/2376 or `/var/run/docker.sock` on Netcup.

5. Add documented one-off commands using the locked utility Alpine image to:

   - create/chown only the Runner data volume to 1000:1000 before first start;
   - copy the root-owned mode-0600 registration-token source into the dedicated
     runtime tmpfs as UID/GID 1000 mode 0400, with no network, a read-only root
     filesystem/source mount, and only the narrow filesystem capabilities
     required for staging, only after DinD is running as the long-lived tmpfs
     mount holder; and
   - after a nonempty `/data/.runner` registration state exists, remove the
     staged token from the tmpfs immediately.

   Docker Compose file-backed secrets cannot remap a root-owned mode-0600 source
   for a forced UID 1000 process, so mounting that source directly would be a
   nonfunctional security control. Keep the source path out of Compose, never
   put the token in an environment variable or persistent volume, and do not
   print it. The staging utility is one-off and non-privileged; do not add an
   init service or run the Runner process as root. Prove the resulting Runner
   process effective UID is 1000.

6. Validate configuration, then run the locked DinD service alone as a
   disposable local stack on a host with `uidmap`. Wait with a finite deadline
   for `/run/user/1000/docker.sock`, prove its numeric ownership/mode, connect
   using the locked Docker CLI through that Unix socket, and run an unprivileged
   hello-world container. Stop/remove only this disposable project and volumes.
   A rootless-entrypoint failure, UID mismatch, socket permission error, or any
   TCP listener blocks the implementation rather than changing to rootful DinD.

   ```bash
   docker compose --env-file deploy/gitea/images.lock.env \
     -f deploy/gitea/runner/compose.yaml config --quiet
   docker compose --env-file deploy/gitea/images.lock.env \
     -f deploy/gitea/runner/compose.yaml config | \
     rg '/var/run/docker.sock|network_mode: host|pid: host'
   ```

   Expected: the second command returns no host-socket/host-namespace matches.
   Separately inspect the rendered service and prove only `docker` has
   `privileged: true`, the only Docker endpoint is the named tmpfs socket, and no
   TCP Docker API is configured. Record the exact Runner 2.1.0 config-schema and
   socket-bind source locations used by the implementation; the authoritative
   end-to-end proof is still a real Gitea job in Task 11.

7. Commit:

   ```bash
   git add deploy/gitea/runner deploy/gitea/README.md
   git commit -m "ops: isolate Gitea Runner with rootless DinD"
   ```

## Task 6: Add Gitea Bootstrap, Protection, and Verification Automation

**Files:** create all `deploy/gitea/admin/*` files,
`deploy/gitea/tests/test-admin-primitives.sh`, and
`deploy/gitea/tests/test-immutable-tag-hook.sh`; update README and the encrypted
host-config backup allowlist.

**Why:** organization, service identities, repository units, protection, and
the tag permission split must be reproducible and negatively testable.

**Change necessity:** manual UI-only setup cannot prove exact API fields or be
repeated safely after restore.

**Impact/compatibility:** scripts are idempotent; they never delete users,
repositories, releases, tags, or teams.

**Steps:**

1. Implement `bootstrap-gitea` with `set -euo pipefail`, root-only input files,
   API token read through a curl config file, and idempotent create/get logic for:

   The administrator automation token is limited to `write:admin`,
   `write:organization`, and `write:repository`, has root-only metadata, and
   hard-stops after its 30-day rotation deadline; it is not a substitute for
   the human 2FA gate.

   - bootstrap human admin (CLI, must change password, then manual 2FA gate);
   - organization `211api`;
   - private empty repository `211api/211api`, default branch `main`, Actions,
     Packages, Pull Requests, and Releases enabled;
   - human teams `maintainers` and `release-maintainers`, plus granular service
     teams `package-publishers` (`repo.packages:write`) and
     `package-readers` (`repo.packages:read`), because Gitea Registry access is
     granted through organization team units rather than a repository
     collaborator alone;
   - non-human users `svc-build`, `svc-backup-read`, `svc-release-package`,
     `svc-release-record`, `svc-release-tag`, and `svc-deploy-read`.

   Generate random service passwords directly into root-only files. After the
   SSH key is installed for `svc-release-tag`, replace and discard its password
   file and create no PAT for that account.

2. Generate split tokens with exact minimum scopes and write each once to a
   separate 0600 file without stdout. Validate the deployed 1.26.4
   `/swagger.v1.json` and CLI help before creation; use each service account's
   one-time credential with `POST /api/v1/users/{username}/tokens` and JSON
   fields `name` plus `scopes`, then discard that credential when no longer
   needed:

   - build: `write:package` (which includes package read);
   - backup reader: `read:user`, `read:repository`, and `read:package`;
   - release package: `write:package` (which includes package read);
   - release record: `write:repository`;
   - Gateway head: `read:repository`;
   - Gateway Registry pull: `read:package`.

   Refuse an OpenAPI/CLI mismatch rather than guessing a field or broadening a
   token. Before accepting each token, run its positive operation and at least
   one negative forbidden operation: package tokens cannot create releases or
   edit repository settings; release-record cannot push packages, tags, or
   settings; backup/head/pull tokens cannot write. A broader token is a stop, not a
   fallback. Store token ID, account, exact scope list, creation, expiry/rotation
   deadline, and revocation procedure without the value.

3. Implement `configure-repository` using Gitea 1.26.4 endpoints and checked-in
   JSON request templates whose fields are verified against the deployed
   OpenAPI before the first mutation:

   - `PATCH /api/v1/repos/211api/211api` for private units;
   - `POST /api/v1/repos/211api/211api/branch_protections` for `main` and
     `release/v*`;
   - `POST /api/v1/repos/211api/211api/tag_protections` for `v*`, whitelisting
     only `svc-release-tag`;
   - `PUT /api/v1/repos/211api/211api/actions/secrets/{name}` for split secrets.

   Main sets `enable_push=false`, `enable_force_push=false`, merge whitelist
   team `maintainers`, admin override blocked, and exact status contexts only
   after the test PR proves their names. Release-request branches enable push
   only for `release-maintainers`, disable force push, and are not merge targets.

4. Implement `immutable-v-tags` as a POSIX Git update hook. Its complete rule is:

   ```sh
   #!/bin/sh
   set -eu
   refname=${1:?missing-refname}
   oldrev=${2:?missing-oldrev}
   zero=0000000000000000000000000000000000000000
   case "$refname" in
     refs/tags/v*)
       if [ "$oldrev" != "$zero" ]; then
         echo "protected release tags are immutable" >&2
         exit 1
       fi
       ;;
   esac
   exit 0
   ```

   Implement a root-only installer that discovers and then requires the exact
   canonical bare path
   `/var/lib/gitea/git/repositories/211api/211api.git`, installs the executable
   as `hooks/update.d/immutable-v-tags` beside the required Gitea-managed
   `hooks/update.d/gitea`, and refuses symlinks, a wrong repository owner, or a
   missing managed wrapper. Keep `security.DISABLE_GIT_HOOKS=true`; this disables
   user-created hooks, not the platform-managed receive path. Record SHA-256 and
   invoke the installer/verification after hook regeneration, restore, and every
   Gitea upgrade so replacement or non-execution is a stop.

5. Implement `verify-repository` to check private visibility, disabled
   registration, units, teams, branch/tag rules, actual commit-status contexts,
   service-account token negative permissions, hook checksum, and absence of a
   push mirror.

6. Test the immutable hook in a disposable local bare repository: creation from
   zero succeeds; update and deletion from nonzero both fail; non-`v*` refs are
   unchanged. This test deletes only its own temporary directory. Add a second
   fixture proving the installer refuses a wrong bare path, symlink, missing
   managed hook, and checksum drift. Task 11 performs the required live
   Gitea-1.26.4 receive-pack smoke before cutover.

7. Run:

   ```bash
   bash -n deploy/gitea/admin/*
   bash deploy/gitea/tests/test-admin-primitives.sh
   bash deploy/gitea/tests/test-immutable-tag-hook.sh
   ```

8. Commit:

   ```bash
   git add deploy/gitea/admin deploy/gitea/tests/test-immutable-tag-hook.sh \
     deploy/gitea/README.md
   git commit -m "ops: automate Gitea repository controls"
   ```

## Task 7: Add the Gateway Deployment Enforcement Owner

**Files:** create all `deploy/gitea/gateway/*` files and
`deploy/gitea/tests/test-gateway-deployer.sh`; update README.

**Why:** production mutation, backup, migration approval, lock, and health
evidence must be enforced on Gateway, not trusted to workflow YAML alone.

**Change necessity:** the current workflow uploads the full environment and has
no database-aware server-side guard.

**Impact/compatibility:** the script edits only `SUB2API_IMAGE`; all other
Gateway `.env`, Compose, data, ingress, and services remain intact.

**Steps:**

1. Implement `install-gateway-deployer` to create only:

   ```text
   /usr/local/sbin/211api-deploy
   /usr/local/sbin/211api-deploy-dispatch
   /usr/local/sbin/211api-backup-restore-drill
   /etc/211api-deploy/
   /etc/logrotate.d/211api-deploy
   /opt/211api/deploy/backups/
   /opt/211api/deploy/.deployment-state.json
   /var/log/211api-deploy/audit.jsonl
   ```

   Use 0755 for programs, 0700 for secret/backup/log directories, and 0600 for
   token, recipient, state, key-metadata, and audit files. Install size-bounded
   log rotation (`10 MiB`, ten compressed rotations, root-only create mode) and
   refuse a conflicting existing path.

   Audit writes take a dedicated file lock, append one bounded JSON line, and
   call `fdatasync` before every production mutation and on completion. If the
   pre-mutation audit write cannot be persisted (including ENOSPC), deployment
   fails closed; log rotation takes the same lock.

2. Implement `211api-deploy-dispatch` as the forced SSH command. It must never
   use `eval`; tokenize a strict grammar and allow only:

   ```text
   status
   deploy --commit 40_HEX --digest sha256:64_HEX
   ```

   Require `SSH_CONNECTION` to split into exactly four fields
   `<peer-ip> <peer-port> <local-ip> <local-port>`, validate both ports as
   numeric, and compare field 1 exactly with `37.221.194.27`; never compare or
   pattern-match the unsplit string. Reject a PTY/`SSH_TTY`,
   forwarding assumptions, extra arguments, migration approval, shell
   metacharacters, alternate registry, host, path, or Compose project with exit
   64. Capture only the validated original command/source, set `umask 077`, fix
   `PATH=/usr/sbin:/usr/bin:/sbin:/bin`, then execute the root-owned program with
   an argv array through `env -i`; no caller-controlled environment survives.

3. Implement `211api-deploy` with only three administrative subcommands:
   `status`, `approve-migration`, and `deploy`. Fixed constants are:

   ```text
   repository=211api/211api
   registry=git.211api.com/211api/211api
   deploy_dir=/opt/211api/deploy
   compose_file=/opt/211api/deploy/docker-compose.yml
   env_file=/opt/211api/deploy/.env
   health_url=http://127.0.0.1:8080/health
   lock=/run/lock/211api-deploy.lock
   ```

   `deploy --record-baseline --commit ... --digest ...` is a Task-12-only
   direct-human mode of the existing `deploy` subcommand, not a fourth
   subcommand. It is excluded from the forced-command grammar, requires a TTY
   confirmation, proves the current `.env` image, container image ID,
   RepoDigest, and OCI revision or exact full-commit tag token, then creates the
   encrypted pre-cutover backup and initial state without editing `.env`,
   Registry, Compose, or containers. This closes the Task 12 pre-cutover backup
   requirement without an ad hoc root shell bypass around the audited owner.

4. In `deploy`, hold nonblocking `flock` FD for the entire operation; return 75
   if held. Validate exact SHA/digest and Gitea Registry manifest AMD64. Query
   protected `main` using a root-only curl config containing the read-only token
   both before backup and after backup immediately before `.env` mutation.
   Enforce connect/total timeouts; non-2xx, malformed JSON, or either mismatch
   fails closed. If head advances during backup, retain the valid set as stale
   evidence but change neither `.env` nor mutable Registry tags.

5. Determine migration sensitivity by comparing the previous deployed commit
   with target through Gitea's compare API and matching exactly the Design Spec
   file set. Apply the same timeout/non-2xx/malformed-response fail-closed rule.
   If previous state is missing, mark sensitive. A sensitive deploy requires an
   unexpired one-time approval matching commit and digest.

6. Implement `approve-migration` only for the pre-existing human administrative
   SSH key/session on Gateway: the operator connects to port 4422 with a TTY and
   directly runs `/usr/local/sbin/211api-deploy approve-migration ...`. The new
   CI forced-command key never reaches this branch. Display the exact changed
   migration-sensitive paths, require interactive confirmation, create a random
   nonce record bound to commit/digest/operator/creation/30-minute expiry, and
   store it 0600. `deploy` atomically moves the record to a consumed directory
   before mutation. Wrong, expired, reused, non-TTY, or CI approval returns 78
   and is audited without token values.

7. Under the lock, create a validated encrypted set containing:

   - PostgreSQL custom dump from `sub2api-postgres` using its in-container env;
   - `pg_restore --list` output;
   - current Compose and `.env`;
   - previous commit/image/digest and checksums.

   Use PostgreSQL `--serializable-deferrable`; stream the exact dump and
   Compose/environment archive through their validator and `age` without a
   complete plaintext file. Capture every producer/validator/encrypter exit
   status, trap EXIT/HUP/INT/TERM, remove only owned `.partial` ciphertext,
   fsync completed components and manifest, then atomically promote the set.
   The manifest binds UTC start/end, recipient ID, previous state, source hashes,
   and ciphertext/listing hashes. Any validation, encryption, disk, signal, or
   fsync failure aborts before image change. The offline age private key is not
   present during automated backup.

8. Atomically replace only the single `SUB2API_IMAGE=` line with
   `git.211api.com/211api/211api:${commit}@${digest}`; preserve owner/mode and
   prove every other `.env` line hash is unchanged. Run Compose pull/up, poll
   health for five minutes or twelve minutes with consumed migration approval,
   and capture redacted bounded logs on failure without automatic restore.

9. On success, verify container image digest and OCI revision label, write state
   atomically, and then evaluate retention under the deployment/restore lock.
   Each set has `validated_at`, `role`, `lease_until`, and `referenced_by`;
   dry-run the deterministic deletion list and retain the three newest validated
   sets, running predecessor, newest known-good set, and every active drill/
   recovery lease. Never delete an unclassified set or touch existing
   `data.before-restore-*`, `redis_data.before-restore-*`, or
   `origin-hardening`.

10. Implement `211api-backup-restore-drill` for explicit operator use only. It
    accepts one validated backup ID and an age identity path already mounted on
    root-only tmpfs, requires `umask 077` and interactive confirmation, verifies
    ciphertext/recipient hashes, and streams the dump into a disposable locked
    PostgreSQL 18.4 container with a new named volume, `--network none`, no
    published port, and no production mounts. Require `pg_restore
    --exit-on-error`, expected schema/constraints, and representative nonsecret
    row-count checks. Reject every live volume/path/project name and remove only
    the drill's ID-prefixed container, volume, and tmpfs material on exit.

11. Test with stub executables and a temporary fixture tree:

    - dispatcher rejects every unapproved form;
    - source-address, PTY, environment, `SSH_ORIGINAL_COMMAND`, and PATH
      injection probes fail;
    - lock contention returns 75 without file changes;
    - stale head before backup and a head change during backup both stop before
      mutation; compare/head API timeout, non-2xx, and malformed JSON fail closed;
    - backup failure leaves `.env` byte-identical;
    - validator/age/disk/fsync/SIGTERM faults leave no plaintext or promoted set;
    - audit append/fsync failure stops before backup or `.env` mutation;
    - only `SUB2API_IMAGE` changes on success;
    - migration approval wrong SHA/digest, expiry, replay, and CI creation fail;
    - a valid approval is consumed once;
    - health failure preserves evidence and does not call restore;
    - direct baseline recording requires a human confirmation, cannot be
      dispatched by the CI key, and leaves `.env`/containers byte-identical;
    - restore drill refuses every live target and deletes only its own fixture.

12. Run:

    ```bash
    bash -n deploy/gitea/gateway/*
    bash deploy/gitea/tests/test-gateway-deployer.sh
    ```

13. Commit:

    ```bash
    git add deploy/gitea/gateway deploy/gitea/tests/test-gateway-deployer.sh \
      deploy/gitea/README.md
    git commit -m "ops: enforce digest deployments on Gateway"
    ```

## Task 8: Run the Complete Repository-Only Verification Gate

**Files:** all repository changes from Tasks 2-7.

**Why:** no external state should change until the implementation branch proves
its own syntax, test intent, immutable inputs, and retirement shape.

**Steps:**

1. Run every dispatcher case and all new shell tests.

2. Run existing backend unit/integration, frontend lint/typecheck/critical
   Vitest, golangci-lint, govulncheck, and pnpm audit-exception validation using
   the exact dispatcher commands.

3. Render both Compose projects with the image lock and inspect effective
   mounts, ports, users, privilege, memory, networks, and secrets.

4. Build the application without pushing:

   ```bash
   set -a
   source deploy/gitea/images.lock.env
   set +a
   docker buildx build --platform linux/amd64 --load \
     --build-arg NODE_IMAGE="$APP_NODE_IMAGE" \
     --build-arg GOLANG_IMAGE="$APP_GO_IMAGE" \
     --build-arg ALPINE_IMAGE="$APP_ALPINE_IMAGE" \
     --build-arg POSTGRES_IMAGE="$APP_POSTGRES_IMAGE" \
     --build-arg COMMIT="$(git rev-parse HEAD)" \
     --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
     -t 211api:gitea-plan-verify .
   docker image inspect 211api:gitea-plan-verify \
     --format '{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
   ```

   Expected: `amd64` and exact HEAD. The local verification tag is derived state
   and may be removed after evidence capture.

5. Search retirement and compatibility separately:

   ```bash
   test ! -d .github/workflows
   rg -n 'PROD_ENV_B64|GHCR_TOKEN|DOCKERHUB_|TELEGRAM_' .gitea deploy/gitea tools
   rg -n 'Wei-Shaw/sub2api' backend/internal/service/update_service.go \
     backend/internal/repository/github_release_service.go deploy/README.md
   ```

   Expected: first retirement search empty; retained-boundary search nonempty.

6. Run `git diff --check`, inspect `git status --short`, and confirm no secret
   file, generated token, private key, `.env`, database dump, or decrypted backup
   is tracked.

7. Add an Aegis evidence bundle for the repository gate and update the drift
   check. Do not claim runtime verification.

8. Commit only documentation/evidence changes produced by this gate:

   ```bash
   git add -f docs/aegis
   git commit -m "docs: record Gitea migration repository gate"
   ```

## Task 9: Prepare Netcup Without Starting the Delivery Owner

**Repository files:** create `deploy/gitea/host/*` and
`deploy/gitea/tests/test-netcup-host-controls.sh`; update
`deploy/gitea/README.md` before any firewall mutation.

**Files on Netcup:** `/opt/gitea/{platform,runner,admin,backups}`, the canonical
root-only `/etc/gitea` configuration/secret owner, and approved system
packages/configuration only. Do not create a duplicate `/opt/gitea/secrets`
owner.

**Why:** TLS, token registration, and rootless DinD are unsafe until time,
uidmap, directories, and listener/firewall baselines are correct.

**Change necessity:** host prerequisites cannot be delivered by repository code
alone.

**Impact/compatibility:** preserve `hermes-gateway.service`,
`komari-agent.service`, Docker, and administrative SSH 4422.

**Steps:**

1. Capture pre-change evidence:

   ```bash
   ssh -o BatchMode=yes -i ~/.ssh/211api_root_37_221_194_27_4422 \
     -p 4422 root@37.221.194.27 \
     'date -Is; timedatectl; ss -lntup; ufw status verbose; systemctl is-active hermes-gateway.service komari-agent.service docker'
   ```

   Expected: only 4422 public TCP, both preserved services active, NTP not yet
   synchronized.

2. Install only required Debian packages: `systemd-timesyncd`, `uidmap`, `age`,
   `jq`, `curl`, `ca-certificates`, and `fail2ban`. Do not replace Docker or
   Compose.

3. Enable/start `systemd-timesyncd`; wait until
   `timedatectl show -p NTPSynchronized --value` is `yes`. Record the selected
   source, offset, root distance, and poll interval from `timedatectl
   timesync-status`; require absolute offset below one second and root distance
   below five seconds. Stop before DNS/TLS if synchronization or either bound
   fails, and repeat the bound before and after cutover.

4. Prove `newuidmap`, `newgidmap`, user namespaces, and the host's existing
   `/etc/subuid`/`subgid` state. Do not rewrite the existing `lym` mapping.

5. Create root-owned mode 0755 `/opt/gitea/platform`, `/opt/gitea/runner`, and
   `/opt/gitea/admin` directories, numeric `1000:1000` mode 0750
   `/opt/gitea/platform/log`, and root-owned mode 0700 `/opt/gitea/backups` plus
   `/etc/gitea`. Refuse any unexpected pre-existing path. `/etc/gitea` is the
   only host secret/configuration owner; never create a duplicate
   `/opt/gitea/secrets` tree.

6. Copy only the reviewed production files from `deploy/gitea/platform`,
   `deploy/gitea/runner`, and `deploy/gitea/admin`, plus `images.lock.env`, with
   `rsync --checksum`. Compare SHA-256 against the repository. Exclude every
   `tests` and `__pycache__` tree and do not copy `gateway`, `.git`, worktree
   files, private keys, or generated local credentials. The Gateway owner is
   installed only on Gateway in Task 12. After committing the repository host
   owner, copy only `deploy/gitea/host` to root-owned mode-0755
   `/opt/gitea/host`, compare every file hash, and run its default installer
   without the Gitea-jail enable override.

7. Generate platform DB password, Gitea secret key, and internal token directly
   into their canonical 0600 `/etc/gitea` files using `openssl rand`; never
   capture their contents in terminal evidence. Write the root-only Compose env
   file with only their absolute path variables, and prove every top-level
   Compose secret resolves. Install only the public age recipient and the
   Pipedream webhook URL in separate 0600 files. Follow
   `2026-07-19-pipedream-telegram-backup-notification.md`; never place the
   Telegram token or chat ID on Netcup.

8. Render the platform project with both
   `--env-file /opt/gitea/images.lock.env` and
   `--env-file /etc/gitea/platform.env`; render the runner with the image lock.
   Keep its fixed root-only registration-token source outside Compose and stage
   it only through the reviewed one-off tmpfs command. Assert no published 3000,
   5432, 2375,
   2376, cache, metrics, or Docker API port; no IPv6 publish; no host Docker
   socket; only DinD privileged.

9. Keep UFW default incoming deny for both IPv4 and IPv6. Add public IPv4 rules
   for 80, 443, and 2222 while retaining the exact pre-existing 4422 source rule
   without widening it. Bind Compose publishes explicitly to `37.221.194.27`,
   so raw IPv6 has no listener. Account for Docker's packet path with versioned,
   checksum-recorded `DOCKER-USER` rules: established/related first, allow only
   IPv4 80/443/2222 to the declared containers, rate-limit new 2222 connections
   per source, then drop every other new container-bound IPv4/IPv6 flow. The
   checked-in installer must atomically install a checksum-recorded systemd
   owner for independent `GITEA-GUARD`/`GITEA6-GUARD` chains; serialize
   concurrent installer runs and roll every managed file back on a partial
   commit. It may preserve Fail2ban jumps before its guard but must refuse any
   other unowned `DOCKER-USER` rule except Docker's exact terminal `RETURN`
   after the guard. Install a checked-in `sshd` fail2ban jail for host port 4422
   using the systemd backend;
   preserve the current management-source boundary. Persist rules without
   flushing unrelated Docker/UFW chains, restart UFW and Docker once, and prove
   identical effective ordering/defaults plus healthy preserved services.
   Because `systemctl restart docker` may return while its wanted guard is still
   `activating`, join the queued dependency with `systemctl start
   gitea-netcup-firewall.service` before the final active/verify assertions; do
   not issue a second Docker restart.

10. Start neither Gitea nor Runner yet. Re-run `ss`, UFW/nftables summaries,
    fail2ban status, preserved services, time/offset, disk, and Docker checks.
    Expected new listener count remains zero until Task 10; `sshd` jail is
    active, while the Gitea jail remains deliberately disabled until its stable,
    non-empty regular log path exists in Task 10. The explicit enable operation
    must enforce that path/owner boundary rather than depending only on operator
    ordering.

**Verification:** host prerequisites pass; existing services stay active; no
Gitea delivery capability exists yet.

**Commit:** commit the reviewed host-control owner and tests before applying its
firewall changes; record packages, NTP, uidmap, installed checksums, firewall,
preserved-service, and no-listener results in the Aegis Netcup-preflight bundle.

## Task 10: Create DNS, Start Gitea, and Complete Platform Bootstrap

**External surfaces:** Cloudflare DNS and the Netcup platform stack.

**Why:** repository import and Runner registration require a trusted HTTPS/SSH
Gitea endpoint.

**Authority boundary:** this task creates new Gitea state but does not touch
Gateway production or disable GitHub.

**Steps:**

1. Put the Cloudflare token in a 0600 curl config or environment passed without
   command tracing. Query `/client/v4/zones?name=211api.com`, require exactly one
   zone, and record only zone ID hash/zone name/HTTP status.

2. Query existing DNS records for exact name `git.211api.com`. Require none or
   an exact idempotent A record. Create/update exactly one record:

   ```json
   {
     "type": "A",
     "name": "git.211api.com",
     "content": "37.221.194.27",
     "ttl": 1,
     "proxied": false
   }
   ```

   Do not create AAAA, wildcard, MX, CNAME, tunnel, or proxied records.

3. Verify the Cloudflare authoritative servers and at least two independent
   public recursive resolvers return only the approved A value and no AAAA.
   Record CAA and DNSSEC state: if CAA exists it must permit Caddy's selected
   issuer; if DNSSEC is already enabled its chain must validate. Do not silently
   enable or disable DNSSEC/CAA in this migration. Wait for convergence before
   Caddy acceptance.

4. Start PostgreSQL, Gitea, and Caddy with the locked Compose project, explicitly
   passing `/opt/gitea/images.lock.env` and `/etc/gitea/platform.env`. Poll
   container health and `https://git.211api.com/api/healthz`. Use OpenSSL's
   verified chain result, require the exact SAN, approved issuer, and at least
   14 days remaining (`-checkend 1209600`), and confirm Caddy's automation state
   is persisted in its named data volume. Confirm SSH greeting/host key on 2222
   without accepting an unverified key. Run `caddy validate` against the exact
   mounted configuration and prove synthetic Authorization/Cookie/query values
   are absent from JSON access logs.

5. Run the pinned Gitea CLI inside the container to create the bootstrap admin
   from root-only input files. The user must log in, change the bootstrap
   password, enable 2FA, and confirm recovery-code custody before normal use.
   This is a manual review gate; do not automate around 2FA.

6. Run `bootstrap-gitea` to create organization, repository, teams, service
   users, and split tokens. Keep the repository empty and private. Store tokens
   directly into 0600 operator files; never print them.

7. Install the checked-in Gitea fail2ban filter/jail against
   `/opt/gitea/platform/log/gitea.log`, with the ban action explicitly targeting
   `DOCKER-USER` for port 2222. Validate its regex against a captured synthetic
   failed-login line, start the jail, manually ban documentation IP `192.0.2.1`,
   prove the packet rule/counter appears in the intended chain, then unban it.
   Never use the current admin source for the test. Record ban time, retry/window,
   filter checksum, and jail status.

8. Verify externally:

   - UI/API requires sign-in for private content;
   - registration endpoint is disabled;
   - only IPv4 80/443/2222/4422 are reachable;
   - raw IPv6 does not expose Gitea/Caddy/SSH;
   - database and internal ports are unreachable;
   - Hermes, Komari, and admin SSH remain healthy.

9. Run an empty-state encrypted platform backup and bootstrap restore mechanics
   drill. Send a synthetic failure notification and require HTTP 2xx plus marker
   behavior before proceeding.

**Verification:** healthy private Gitea 1.26.4, valid/monitored TLS, active SSH
rate/ban policy, no repository data, working encrypted backup mechanics.

**Commit:** external evidence only; add DNS/platform-bootstrap evidence.

## Task 11: Import Git History, Install Runner, and Prove Non-Main CI

**Repository state:** Gitea private `211api/211api`; local implementation
worktree remains unpushed to GitHub.

**Why:** all delivery functions must be proven away from `main` before cutover.

**Steps:**

1. Add a temporary local remote named `gitea`:

   ```bash
   git remote add gitea ssh://git@git.211api.com:2222/211api/211api.git
   ```

2. Fetch old GitHub into remote-tracking refs, then push those exact refs rather
   than local `main` (which already contains design/plan commits):

   ```bash
   git fetch origin \
     '+refs/heads/*:refs/remotes/origin/*' \
     '+refs/tags/*:refs/tags/*'
   while IFS= read -r ref; do
     case "$ref" in */HEAD) continue ;; esac
     branch=${ref#refs/remotes/origin/}
     git push gitea "${ref}:refs/heads/${branch}"
   done < <(git for-each-ref --format='%(refname)' \
     refs/remotes/origin/)
   git push gitea 'refs/tags/*:refs/tags/*'
   ```

   Do this before the implementation branch or any Gitea-only commit. Capture
   `git ls-remote --heads --tags` from old GitHub and Gitea, normalize sorted
   refs, and require exact object-ID equality including annotated tag objects.
   This is import-equality evidence; later canonical divergence is expected.

3. Install the root-managed immutable-tag hook in the bare repository's
   exact canonical path `hooks/update.d/immutable-v-tags`, record its checksum,
   run Gitea hook regeneration, and prove both it and the managed `gitea` hook
   still exist/executable while custom user hooks remain disabled. Configure
   `v*` protection to whitelist only `svc-release-tag`.

4. Generate the `svc-release-tag` Ed25519 key with 0600 private permissions.
   Add only its public key to that Gitea account. Do not create a PAT and discard
   the generated service password after successful SSH authentication. Read the
   Gitea built-in SSH public keys over the trusted Netcup admin channel, verify
   their fingerprints there, and create `RELEASE_TAG_KNOWN_HOSTS`; do not use an
   unverified runtime `ssh-keyscan` result as trust.

5. Create one explicitly disposable private Gitea repository named
   `211api/hook-smoke-<run-id>`, install the same managed hook through the
   root-only installer, and configure the same tag protection. Through the real
   Gitea 1.26.4 SSH receive path, prove `svc-release-tag` can create one `v*` tag
   but cannot move or delete it, and a normal maintainer cannot create one.
   Verify the hook executes even with `DISABLE_GIT_HOOKS=true`. Delete only that
   exact run-ID repository after evidence, with owner/name/id triple guards;
   never use the canonical repository for a disposable immutable tag.

6. Generate a repository/organization runner token with the pinned Gitea CLI;
   write it to `/etc/gitea/runner-registration-token` mode 0600 so it cannot be
   captured with the archived `/opt/gitea/runner` manifests. Initialize and
   chown only the Runner data volume with the locked utility image, start DinD,
   and wait with a finite deadline for rootless Unix-socket health. Stage the
   token into the runtime tmpfs with the reviewed one-off command, then start
   Runner and confirm effective UID 1000 and one online `linux/amd64` runner at
   capacity one. Once nonempty registration state exists, remove the staged
   token with the reviewed one-off command and prove it is absent without
   printing either file. Rotate/revoke the registration token in Gitea and
   delete that fixed source before any normal backup. Prove socket owner/mode
   and connect with the locked CLI before Runner registration; any fallback
   endpoint or rootful daemon is a stop.

7. Inspect effective containers:

   ```bash
   docker inspect gitea-runner gitea-runner-docker
   ss -lntup
   ```

   Record only mounts/users/capabilities/networks. Prove no
   Netcup `/var/run/docker.sock`, no host PID/network/device, no Docker TCP
   listener, runner unprivileged, DinD sole privileged container, UID 1000, and
   the dedicated tmpfs socket only.

8. Push `feature/gitea-cicd-migration` only to Gitea. Confirm CI and security
   workflows run; deploy does not run because the branch is not `main`.

9. Query commit statuses through Gitea API. Require exact contexts
   `ci / required` and `security / required`. If names differ, fix workflow/job
   names in the branch and rerun; never configure a guessed or wildcard context.

10. Exercise every used Gitea compatibility surface: absolute pinned checkout,
   legal `push`/`pull_request` parsing and the same-repository PR guard,
   service/DinD access, secrets masking, cron
   parser, needs/result expressions, artifacts actually used, and disabled
   cache. Any unsupported semantic returns to the workflow task; do not add a
   GitHub fallback. For masking, create a temporary noncredential sentinel
   secret, print only that synthetic value in the smoke branch, require redacted
   logs, then remove the test secret; never print a real token or key. The Docker
   job must run `docker version`, `docker info`, and an unprivileged child
   container through `/var/run/docker.sock`; inspect the DinD-side job/child
   mounts during a bounded hold and prove the source is the dedicated
   `/run/user/1000/docker.sock`, not a host path. This is the cutover gate for
   Runner's automatic socket injection and `valid_volumes: []` interaction.

11. Configure `main` and `release/v*` branch protections only after exact status
    evidence exists. Open an internal Gitea PR from the feature branch to main;
    do not merge it.

12. From Netcup, use the isolated DinD daemon and the exact reviewed build
    command from `deploy.yml` to publish a non-production branch SHA candidate
    manually with the build token. This verifies Registry, image locks, and
    credentials without widening `deploy.yml` beyond main. Inspect one AMD64
    manifest/digest and remove no tag. Verify the build token cannot create a
    release or administer the repo.

13. Run a data-bearing consistent platform backup and full isolated restore
    drill. Verify private clone, exact imported refs, Actions metadata, and the
    candidate package manifest. Keep the encrypted backup; remove only isolated
    drill resources after evidence.

**Verification:** CI/security/Registry/Runner/restore proven; no `main` merge,
Gateway deployment, GitHub disable, or release tag.

**Commit:** fix-only commits to the Gitea feature branch if smoke evidence finds
repository defects; rerun the full repository gate after each fix.

## Task 12: Install and Dry-Run the Gateway Deployment Boundary

**Gateway files:** exact paths from Task 7; no application image change yet.

**Why:** production enforcement and backup must be proven before the workflow is
allowed to call it.

**Steps:**

1. Re-record Gateway baseline: running image ID/digest/tags, container health,
   `127.0.0.1:8080`, Caddy/cloudflared listeners, Compose and `.env` hashes/modes,
   disk, and current full commit tag. Do not output `.env` values.

2. Install required packages `age`, `jq`, `curl`, and `util-linux` only if
   absent. Copy reviewed Gateway programs by checksum and run installer. Refuse
   conflicts outside the new exact paths.

3. Install the public age recipient and split read-only Gitea head/Registry
   tokens into 0600 files. Authenticate `svc-deploy-read` to
   `git.211api.com` through password stdin; preserve existing Docker credential
   entries and verify it cannot push.

4. Generate a dedicated deployment Ed25519 key off Gateway. Verify Gateway
   ED25519/RSA fingerprints over the pre-existing trusted admin SSH channel, then
   build the bracketed `[157.254.234.244]:4422` known-hosts file. Runtime
   `ssh-keyscan` is not the trust source. Assign a unique key ID/comment and a
   rotation deadline no more than 90 days away; record create/rotate/revoke
   metadata without private material. The incident procedure removes that exact
   authorized-key line, proves new authentication fails, rotates the Gitea
   secret, and audits the interval before reenabling deployment.

5. Append the public deployment key to root `authorized_keys` with
   `from="37.221.194.27",restrict,command="/usr/local/sbin/211api-deploy-dispatch"`.
   Back up the file, validate `sshd -t`, keep the existing admin session open,
   and prove from Netcup that the new key can run `status` but cannot obtain
   shell, PTY, forwarding, arbitrary command, or migration approval. Before
   deleting the operator-side temporary key, prove the same key is rejected from
   a non-Netcup source. Verify the pre-existing human admin key can still open a
   TTY and is the only path that can invoke `approve-migration` directly.

6. Upload `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `REGISTRY_BUILD_TOKEN`,
   `REGISTRY_RELEASE_TOKEN`, `RELEASE_RECORD_TOKEN`, and
   `RELEASE_TAG_SSH_KEY` plus `RELEASE_TAG_KNOWN_HOSTS` to Gitea repository
   Actions secrets through the API. List only names/descriptions afterward;
   secret values must be unreadable.

7. Run the real Gateway `status`, lock-contention no-op, both stale-head no-ops,
   API timeout/non-2xx fixtures, backup/audit-failure fixtures, key-source/
   environment-injection probes, and migration-approval rejection tests. Verify
   logrotate syntax/locking and disk-full fail-safe. Do not run real `deploy`
   yet.

8. Create one real pre-cutover encrypted Gateway backup under the new backup
   directory. Validate dump/archive/ciphertext. With the offline key mounted
   only on root-owned tmpfs, run `211api-backup-restore-drill` into a disposable
   PostgreSQL 18.4 container/volume with no network, port, or live mount; require
   restore, schema/constraint, and representative row-count checks, then remove
   only drill resources and unmount tmpfs. Record current image
   commit `5ed5530c098896e8caecca83d42c279bc65b9381` as the proven deployment
   baseline only after matching its running image digest/tag.

9. Compare that baseline commit to feature-branch target for migration-sensitive
   paths. Expected for this migration: no match. If a migration path appears,
   classify it and require the one-time approval path at Task 14.

**Verification:** all guards and backup/drill pass; Gateway application image,
`.env`, containers, ports, and business data remain unchanged.

**Commit:** external evidence only; add Gateway-boundary evidence.

## Task 13: Cutover Readiness Review and Explicit Stop Point

**Why:** the next task disables the only active GitHub deployment owner and
merges the Gitea deployment workflow to `main`.

**Required evidence:**

- repository-only gate green;
- Netcup NTP offset/TLS-chain-and-expiry/firewall-reload/rate-and-ban/backup
  evidence green;
- Runner isolation and exact contexts green;
- Gitea full restore drill green;
- Gateway source-restricted forced command/key lifecycle, encrypted backup,
  isolated PostgreSQL restore drill, baseline, and no-op guard tests green;
- old GitHub workflow runs enumerated;
- no external input or secret gate missing.

**Steps:**

1. Render the Execution Readiness View below with actual commit IDs, image
   digests, backup IDs, token names, status contexts, and host evidence refs.

2. Verify Gitea PR is mergeable but not merged; Gitea deploy workflow has never
   run on main; GitHub Actions still owns current delivery.

3. Present the readiness receipt to the user and stop for explicit
   cutover authorization. Approval must name the cutover, not merely say to
   continue planning. No GitHub permission, remote, main branch, or production
   change occurs before that authorization.

**Verification:** advisory state is `ready-for-cutover`, not completion.

## Task 14: Disable GitHub Actions and Activate Gitea Main Without Dual Ownership

**External state:** old GitHub Actions permission, local remotes, protected
Gitea main.

**Why:** the owner transition must have no overlap.

**Steps:**

1. Enumerate all GitHub runs for `zc0982/211api` through paginated API calls
   (`gh api --paginate` with `per_page=100`) for both `queued` and `in_progress`;
   never rely on a single `gh run list --limit` page. Record the complete active
   ID set at drain start, then wait for or explicitly `gh run cancel` every ID,
   with a hard ten-minute deadline and 15-second poll interval. Require every
   observed ID to become terminal; a newly appearing active ID or deadline
   expiry stops cutover. Then require two full paginated zero-active queries 60
   seconds apart, stable Gateway image/Compose hashes, and no SSH/deploy/Compose
   process targeting `/opt/211api/deploy`. Record only complete IDs/statuses and
   redacted process types.

2. Disable repository Actions using an authenticated JSON request:

   ```bash
   jq -n '{enabled:false}' | \
     gh api --method PUT repos/zc0982/211api/actions/permissions --input -
   gh api repos/zc0982/211api/actions/permissions --jq '.enabled'
   ```

   Expected: `false`.

   Repeat the GitHub zero-active-run query and Gateway quiet/stability checks
   after disable; an already-issued remote mutation is a cutover stop even if
   repository permissions now read `false`.

3. Snapshot the old deploy workflow's run IDs, then attempt this exact dispatch
   and capture only response headers/status plus a sanitized error body:

   ```bash
   set +e
   gh api --include --method POST \
     repos/zc0982/211api/actions/workflows/deploy.yml/dispatches \
     -f ref=main >dispatch.response 2>&1
   dispatch_rc=$?
   set -e
   ```

   Parse the first HTTP status and assert one of `403`, `404`, or `422` with a
   nonzero command status. If GitHub instead returns `204`, treat transport
   acceptance as inconclusive: poll for 90 seconds and require the run-ID set to
   remain byte-identical and zero active runs. Any other status, new run ID, or
   active run stops cutover. Redact/delete `dispatch.response` after recording
   only status, sanitized message class, timestamps, and before/after run IDs.

4. Rename local remotes without pushing old GitHub:

   ```bash
   git remote rename origin github
   git remote rename gitea origin
   git remote set-url origin ssh://git@git.211api.com:2222/211api/211api.git
   git remote -v
   ```

   Expected roles: `origin` Gitea, `github` old fork, `upstream` public upstream.

5. Merge the already-green internal Gitea PR using maintainer identity. Require
   branch protection/statuses to remain active; do not bypass or direct-push.

6. Confirm the canonical Gitea main has no `.github/workflows` or GoReleaser
   files. The old GitHub repo may retain inert historical files because it is no
   longer mirrored.

7. Observe the Gitea main deploy workflow. At this exact point Gitea becomes
   delivery owner; GitHub is already disabled.

**Verification:** GitHub disabled/rejected; Gitea main protected and active;
there was no dual-deploy interval.

## Task 15: Complete the First Digest-Qualified Gateway Deployment

**Production state:** Gateway only.

**Why:** prove the new owner can safely deliver the exact main commit.

**Steps:**

1. Verify deploy workflow's repeated CI/security jobs pass, main freshness
   checks pass, candidate SHA tag is AMD64, and its manifest digest is recorded.

2. If migration-sensitive comparison is empty, allow the forced normal deploy.
   If nonempty, the workflow must stop before Gateway mutation; the operator
   reviews the exact paths and uses one-time `approve-migration` only after a
   fresh validated backup. Any unexpected migration returns to the user before
   approval.

3. Observe remote lock, backup, digest validation, `.env` atomic update,
   Compose pull/up, and bounded health check. On failure, collect redacted
   evidence and stop; do not restore database or blindly roll back image.

4. Verify after success:

   - `/health` succeeds;
   - running image is
     `git.211api.com/211api/211api:${GITEA_MAIN_SHA}@${MANIFEST_DIGEST}`;
   - OCI revision equals main SHA;
   - application remains `127.0.0.1:8080` with unchanged ingress;
   - PostgreSQL/Redis remain healthy and on Gateway;
   - every `.env` line except `SUB2API_IMAGE` matches pre-cutover hash evidence;
   - deployment state and encrypted predecessor backup are recorded;
   - mutable Registry `main` points to the deployed digest only if the commit is
     still Gitea main.

5. Verify old GHCR image remains only historical and is not a Compose input;
   do not delete GHCR packages in this scope.

**Verification:** production healthy on Gitea digest with no business-state or
exposure drift.

## Task 16: Prove the Protected Prerelease Path

**Tag/request:** `v0.1.160-gitea-smoke.1` and
`release/v0.1.160-gitea-smoke.1`.

**Why:** prove release authorization, immutable tag, digest retag, prerelease,
and `latest` exclusion without creating binary/multiarch outputs.

**Steps:**

1. Record the current Registry `latest` digest or its absence.

2. As a release maintainer, create the release request branch at the deployed
   main SHA and push only to Gitea. Do not create the tag directly.

3. Verify request lane actor/team, branch-name, exact-main, VERSION base,
   existing SHA image, and absent tag checks. Confirm `svc-release-tag` creates
   one annotated tag through SSH.

4. Verify publication lane retags the existing digest as the prerelease version,
   creates a Gitea prerelease, and leaves `latest` byte-for-byte unchanged.

5. Negative permission checks:

   - normal maintainer cannot create/move/delete `v*` through Git or API;
   - release-record PAT cannot delete the tag;
   - tag-bot has no PAT/API credential;
   - local disposable bare-repo test proves the same update hook rejects a
     whitelisted Git move/delete;
   - managed hook checksum still matches.

   Do not issue a deletion as site admin and do not delete the smoke tag,
   release, image, or request branch.

6. Confirm no DockerHub manifest, GHCR publication, legacy Telegram release
   message, archive, checksum file, macOS/Windows binary, or ARM64 manifest was
   produced. The isolated backup notification test is not release output.

**Verification:** retained private smoke prerelease exists, digest matches the
deployed commit, `latest` unchanged, immutable-ref controls proven.

## Task 17: Close Verification, Retirement, Backup, and Architecture Records

**Files:** Aegis work evidence/checkpoint/reflection, baseline updates, and an
ADR if the completion review confirms the durable decision.

**Why:** completion requires evidence that both the new path works and the old
owner stopped.

**Steps:**

1. Run the complete Design Spec section 14 acceptance matrix and attach bounded,
   redacted evidence for every criterion.

2. Verify backup timer is enabled, next run is correct UTC time, synthetic
   failure notification works, one data-bearing Gitea restore drill passed, and
   one Gateway isolated PostgreSQL restore drill passed. Recheck NTP offset,
   certificate chain/14-day threshold, both fail2ban jails, firewall persistence,
   bounded logs, log-redaction sentinels, and deployment-key rotation deadline.
   Record RPO/RTO and the residual lack of off-host backup without claiming it
   solved.

3. Run lingering-reference checks. Classify retained GitHub references only as
   the explicit public updater/install compatibility boundary; any active fork
   workflow, GHCR deploy input, DockerHub/legacy Telegram release or deployment
   logic, or `PROD_ENV_B64` is a failure. The exact versioned Pipedream backup
   adapter is the only Telegram exception.

4. Verify the old GitHub API still reports Actions disabled and no post-cutover
   run exists. Verify no Gitea push mirror exists.

5. Verify Netcup has no 211API application/database/Redis container or business
   data; Gateway remains healthy and authoritative.

6. Run Registry/backup retention under the corresponding lock and in dry-run
   mode first. Select only objects with a validated manifest, expired/no lease,
   empty `referenced_by`, and a role outside the deterministic retained set;
   require the dry-run IDs to match the final delete IDs exactly. Never remove
   an unclassified set, running digest, predecessor, release/smoke digest,
   latest weekly/newest known-good backup, active drill/recovery selection, old
   existing Gateway before-restore directories, or any production data.

7. Update the Aegis baseline to the achieved single-owner state. Run ADR
   backfill for: Gitea delivery owner on Netcup; Gateway runtime owner; public
   GitHub updater exception; isolated rootless DinD; service-account release-tag
   permission split. Record rejected alternatives from the Design Spec.

8. Run `git diff --check`, full repository regression, Aegis bundle/check, and
   `git status --short`. Commit only reviewed docs/evidence/ADR changes.

9. Use `aegis:verification-before-completion`; do not claim completion from
   workspace structure checks alone.

## Risks and Stop Conditions

| Risk | Detection | Required response |
| --- | --- | --- |
| Runner/Gitea protocol incompatibility | non-main context/service/secret test fails | stop; choose no fallback; return to version decision |
| Host Docker exposure | effective mount/socket/capability evidence | stop before runner registration |
| Tag can move/delete | negative Git/API test succeeds | stop before release/cutover; return to design |
| NTP/TLS failure | offset/root-distance bound, chain, or 14-day threshold fails | stop before tokens/import |
| Secret leakage | logs/diff/tracked-file scan | revoke affected credential; remove evidence; restart gate |
| Unexpected migration paths | compare result | stop automatic deploy; explicit one-time approval review |
| Backup cannot restore in isolation | decrypt/pg_restore/schema drill failure | stop cutover/deployment |
| Gateway port broadens | listener/Compose diff | stop and restore nonsecret Compose/bind configuration |
| GitHub run/session can still mutate | API/dispatch/Gateway quiet evidence | do not merge Gitea main |
| Cross-host freshness race | main changes after final check | serialized newer run converges; never update mutable `main` tag from stale run |
| Missing webhook/age/identity input | preflight validation | pause for user; do not fabricate |

## Retirement Verification Plan

- Main-path check: Gitea PR, CI, Registry, main deployment, and release smoke all
  pass.
- Lingering-reference check: no canonical `.github/workflows`, GoReleaser,
  private-fork GHCR/DockerHub/legacy Telegram release/deploy/PROD_ENV_B64 path;
  only the versioned Pipedream backup adapter may call Telegram.
- Negative check: GitHub dispatch rejected; non-main Gitea branch never deploys;
  stale/locked/migration-sensitive/unauthorized tag paths fail closed.
- Boundary check: public upstream updater remains GitHub-backed, Gateway remains
  production, Netcup has no business runtime/data.

## Execution Readiness View

- Intent Lock: replace fork GitHub CI/CD with private Gitea; keep Gateway
  production.
- Scope Fence: repository workflows, Gitea platform/runner/Registry/release,
  Gateway deployment enforcement, DNS, backups, and owner cutover only.
- Baseline Lock: initial baseline, approved/clarified design, current workflow
  audit, official pinned versions, both host inspections.
- Approved Behavior: private Gitea, main digest deployment, protected prerelease,
  four active workflow files, encrypted validated backups.
- Owner/Contract Constraints: Gitea delivery; Gateway runtime; GitHub public
  updater only; Gateway script sole production mutation owner.
- Compatibility Boundary: no application updater rewrite; no business data or
  ingress move; no GitHub delivery fallback.
- Retirement Boundary: delete workflow/GoReleaser code; keep old GitHub repo and
  historical packages; no live-data deletion.
- Task Batches: repository 1-8; Netcup/platform 9-11; Gateway 12; explicit
  cutover review 13; owner switch/production/release 14-16; closure 17.
- Test Obligations: dispatcher/regression, Compose/systemd syntax, Runner
  isolation, API permission negatives, tag immutability, encrypted restore,
  Gateway no-op/lock/migration guards, production health.
- Review Gates: repository gate, non-main Gitea gate, Gateway dry-run gate,
  explicit cutover authorization, production health, release smoke, completion
  review.
- Drift/Rewind Rules: any new fallback, host socket, business-data move, public
  repo, mutable production tag, or automated DB restore returns to design.
- Evidence Required Before Completion: every Design Spec acceptance item plus
  GitHub-disabled proof, exact running digest, backup restore evidence, and
  lingering-reference scan.
- Advisory Boundary: method-pack execution guidance only; not GateDecision,
  PolicySnapshot, or completion authority.

## Execution Choice

After this plan passes written review, execute it using one of these workflows:

1. **Subagent-driven execution (recommended):** fresh implementation subagent
   per repository task, primary-agent review between tasks, primary agent owns
   every server/external mutation and final verification.
2. **Inline execution:** primary agent follows `aegis:executing-plans` in small
   batches with the same review gates.

No execution path may skip Task 13's explicit cutover authorization.
