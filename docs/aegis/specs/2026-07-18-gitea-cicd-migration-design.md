# Gitea CI/CD Migration Design

Date: `2026-07-18`
Status: `approved written design; Telegram backup-notification amendment approved`
ArchitectureReviewRequired: `yes`

## 1. Outcome

Move the private `211api` fork from GitHub-owned CI/CD to a self-hosted Gitea
delivery chain on Netcup while keeping the 211API production runtime and all
business state on Gateway Los Angeles.

The migration is complete only when Gitea is the single canonical owner of the
fork repository, Actions, Registry, release records, and production deployment,
and the retired GitHub workflows can no longer deploy.

## 2. Confirmed Decisions

| Decision | Approved value |
| --- | --- |
| Delivery owner | Gitea is canonical; GitHub is not a CI/CD fallback |
| Repository visibility | Private; invited team members only |
| Public endpoint | `https://git.211api.com` |
| Git transport | HTTPS plus SSH on `git.211api.com:2222` |
| Gitea host | Netcup Germany `37.221.194.27` |
| Production host | Gateway Los Angeles `157.254.234.244` |
| Runner | Same Netcup host, separate rootless DinD stack |
| Release output | AMD64 image, protected `v*` tag, Gitea Release |
| Retired release output | DockerHub, legacy Telegram release/deploy notifications, ARM64, macOS/Windows binaries |
| Backup failure notification | Netcup fixed JSON webhook -> Pipedream -> dedicated Telegram bot and private group |
| Upstream updater | Continue reading `Wei-Shaw/sub2api` GitHub Releases |
| Old GitHub repository | Retained; Actions disabled; repository not deleted |

## 3. Authority and Evidence

### 3.1 Project references

- `README_CN.md`
- `DEV_GUIDE.md`
- `deploy/README.md`
- `.github/workflows/backend-ci.yml`
- `.github/workflows/cla.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/release.yml`
- `.github/workflows/security-scan.yml`
- `.goreleaser.yaml` and `.goreleaser.simple.yaml`
- `backend/internal/service/update_service.go`
- `backend/internal/repository/github_release_service.go`

### 3.2 External references

- [Gitea Actions quick start](https://docs.gitea.com/1.26/usage/actions/quickstart)
- [Gitea act_runner](https://docs.gitea.com/1.26/usage/actions/act-runner)
- [Gitea and GitHub Actions comparison](https://docs.gitea.com/1.26/usage/actions/comparison)
- [Gitea Actions secrets](https://docs.gitea.com/1.26/usage/actions/secrets)
- [Gitea token permissions](https://docs.gitea.com/1.26/usage/actions/token-permissions)
- [Gitea container registry](https://docs.gitea.com/usage/packages/container)
- [Pipedream HTTP triggers](https://pipedream.com/docs/workflows/building-workflows/triggers)
- [Pipedream project secrets](https://pipedream.com/docs/workflows/environment-variables)
- [Pipedream Node.js workflow steps](https://pipedream.com/docs/workflows/building-workflows/code/nodejs)
- [Telegram Bot API `sendMessage`](https://core.telegram.org/bots/api#sendmessage)

### 3.3 Host evidence

- Netcup: Debian 13, 4 vCPU, 7.8 GiB memory, approximately 285 GiB free,
  Docker 29.6.1, Compose 5.3.0, and no 211API containers.
- Gateway: Docker 29.6.1, Compose 5.3.1, healthy 211API/PostgreSQL/Redis,
  current image `ghcr.io/zc0982/211api:main`, deployment path
  `/opt/211api/deploy`.
- Cloudflare is authoritative for `211api.com`; `git.211api.com` had no
  public A record when checked.

## 4. Requirement Ready Check

- Requirement source: user-approved design sections and the references above.
- Goal and scope: explicit and stable.
- Scenario: private team repository with automatic main deployment.
- Acceptance evidence: defined in section 14.
- Implementation-only inputs: Cloudflare DNS authorization, generated Gitea
  administrator credentials, generated least-privilege PATs, an operator-held
  backup-encryption recipient, and the operator-held Pipedream webhook URL.
  The notification destination is approved, but its URL and all credentials
  must never be written to the repository.
- Decision: `ready`.

## 5. Architecture

### 5.1 Runtime topology

```text
Team member
  -> git.211api.com:443 / :2222
  -> Netcup platform stack: Caddy -> Gitea -> Gitea PostgreSQL
  -> Netcup runner stack: act_runner -> rootless DinD
  -> Gitea Registry: git.211api.com/211api/211api
  -> SSH deployment
  -> Gateway Los Angeles: 211API + business PostgreSQL + Redis
```

The Netcup and Gateway roles are not interchangeable:

- Netcup owns code hosting, platform state, Registry, and build execution.
- Gateway owns the live 211API service and all business state.
- No 211API business container, database, Redis data, configuration, ingress,
  or traffic moves to Netcup.

### 5.2 Platform stack

Directory: `/opt/gitea/platform`

- Caddy terminates TLS for `git.211api.com`.
- Gitea serves private Git, Actions coordination, releases, and packages.
- PostgreSQL stores Gitea platform metadata only.
- A networkless, one-shot secret initializer bridges Docker Compose's lack of
  UID/GID remapping for file-backed secrets: it copies the root-owned 0600
  sources into a private named volume as UID/GID 1000 mode 0400, then exits.
  Gitea remains rootless and mounts only the staged volume read-only.
- Persistent directories contain repositories, LFS, attachments, packages,
  configuration, database data, and Caddy state.
- Images are pinned to explicit stable version tags and recorded digests.
  `latest`, `nightly`, and floating major tags are not accepted deployment
  inputs.

### 5.3 Runner stack

Directory: `/opt/gitea/runner`

- act_runner registers only for the private `211api` organization or repository;
  it is not a public-instance runner.
- Job execution uses a pinned rootless Docker-in-Docker image. The runner
  container itself is unprivileged. If the selected rootless DinD image requires
  `privileged`, DinD is the only privileged container and is given no host
  Docker socket, host PID namespace, host network, host devices, or arbitrary
  host-path mounts. This reduces, but does not eliminate, same-host runner risk.
- The host `/var/run/docker.sock` and every other host Docker endpoint are absent
  from both runner and job mounts. Falling back to the host socket is forbidden;
  inability to run under this boundary stops the cutover.
- Runner-to-DinD traffic uses the rootless daemon's Unix socket in a dedicated
  named tmpfs volume shared only by DinD, Runner, and the ephemeral job
  containers that need Docker. No TCP Docker API is enabled or published. DinD
  data, runtime socket, and runner registration state use separate named volumes
  and fixed non-root UID/GID ownership. This implementation clarification follows
  Gitea Runner 2.1.0's verified socket-injection contract and avoids distributing
  Docker client TLS credentials into job containers.
- The pinned checkout action is a JavaScript Action and therefore requires a
  Node runtime inside every selected job image. Go jobs use one private,
  digest-locked image derived only from the approved Go 1.26.5 Debian image and
  the approved Node 24.18.0 Debian runtime; the reviewed Dockerfile copies only
  the Node binary and its license/readme/changelog. The plain Go image remains
  the build source, not a runnable Actions label. A missing derived package
  stops Runner startup rather than triggering an in-job download or mutable
  image fallback.
- Docker-label jobs additionally require the Docker CLI/buildx contract and a
  shell bootstrap path. Their private digest-locked image uses the approved
  Node 24 Alpine base and copies only Docker CLI plus buildx/compose plugins
  from the approved Docker CLI image. The first helper-install step explicitly
  runs under `sh` to install Bash before checkout and later Bash steps. The
  plain Docker CLI image is not a runnable Actions label.
- The repository-scoped Runner injects `GOFLAGS=-p=1` into every job and keeps
  DinD under a 5 GiB cgroup. Live unit and integration builds independently
  exhausted the original 3 GiB limit; serialization removed package-level
  concurrency but proved the single `internal/service` compiler still crossed
  3 GiB. After the upstream 0.1.162 sync, lint sampled within 1 MiB of the 4 GiB
  ceiling and two independent `govulncheck` lanes plus their controlled retries
  were OOM-killed there. The host retained more than 6 GiB available after the
  failed runs, so a 5 GiB single-job boundary is the smallest whole-GiB
  correction with material headroom rather than an unbounded daemon or
  business-code accommodation. Workflow commands remain canonical and Runner
  capacity stays one. The fixed golangci-lint source build is the separate
  compiler-internal peak: its `go install` and linter process both use
  `GOMAXPROCS=1`. The same limit owns package loading and analysis. Business
  test runtimes remain unchanged.
- Gitea Runner places each job on an ephemeral user-defined inner Docker
  network. Testcontainers' default remote-daemon host discovery resolves the
  default `172.17.0.1` bridge, but RootlessKit publishes ports in DinD's parent
  network namespace rather than either inner bridge gateway. For Gitea Actions
  integration jobs only, the workflow explicitly supplies the repository-owned
  `GITEA_CI=true` marker; the stable outer Compose service name `docker` is then
  the fail-closed `TESTCONTAINERS_HOST_OVERRIDE`.
  `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` is the distinct DinD-side
  `/run/user/1000/docker.sock` path used by Ryuk. This keeps Ryuk enabled,
  preserves per-job networks and the Unix-only Docker API, and leaves local
  Testcontainers discovery unchanged.
- The locked DinD entrypoint receives an explicit command beginning with
  `dockerd`, only the Unix `--host`, and `--group=root`; a leading option would
  cause that image to inject an unauthenticated TCP 2375 listener, while the
  explicit group makes RootlessKit expose deterministic outer 1000:1000 socket
  ownership rather than a host-dependent subordinate GID. The root-owned
  mode-0600 runner
  registration token is never mounted directly into the UID 1000 Runner because
  Compose file secrets cannot remap it. A reviewed, non-privileged, networkless
  one-off utility stages it as mode 0400 in the runtime tmpfs and removes it as
  soon as persistent registration state exists. No token enters Compose
  environment values, persistent volumes, logs, or the archived Runner manifest
  tree; its root-only source remains under `/etc/gitea` only for the bounded
  registration window.
- Concurrency is one job. CPU, memory, process, and disk limits leave capacity
  for Caddy, Gitea, and PostgreSQL.
- Job containers and workspaces are ephemeral. Cache volumes may contain only
  dependency/build cache, never credentials or repository tokens, and are
  subject to bounded cleanup.
- Acceptance inspects effective mounts, namespaces, capabilities, socket
  endpoints, and UID/GID rather than trusting the Compose source alone.

### 5.4 Network and DNS

- Create a Cloudflare DNS-only A record:
  `git.211api.com -> 37.221.194.27`.
- DNS-only mode is required because standard Cloudflare proxying does not carry
  the selected Git SSH port `2222`.
- Apply a default-deny host firewall and open only `80/tcp`, `443/tcp`, and
  `2222/tcp` in addition to the existing administrative SSH port `4422/tcp`.
  Port 80 exists only for ACME and HTTPS redirection. SSH ports are rate-limited
  and covered by fail2ban or an equivalent audited ban policy.
- Gitea PostgreSQL, Gitea HTTP upstream, runner coordination, and DinD ports
  stay on private Docker networks.
- Do not publish an AAAA record until IPv6 listeners and firewall rules have
  been validated. Before that point, acceptance must prove that no public AAAA
  record exists and that an IPv6 listener cannot bypass the IPv4 policy.
- DNS-only exposes the Netcup origin IP. Caddy TLS, patched services, firewall
  policy, SSH rate limiting, and log monitoring are the compensating controls.
- Netcup time synchronization must be active before issuing certificates or
  registering runners.

## 6. Repository Ownership and Migration

- Create private organization/repository `211api/211api`.
- Import all branches and tags without rewriting history. Compare the exact
  object IDs under `refs/heads/*` and `refs/tags/*` from the source and a fresh
  Gitea clone with `git for-each-ref`; annotated tag object IDs are compared as
  refs, not only as peeled commits.
- Set local `origin` to
  `ssh://git@git.211api.com:2222/211api/211api.git`.
- Rename the previous fork remote to `github`.
- Keep `upstream` pointing at
  `https://github.com/Wei-Shaw/sub2api.git`.
- Do not configure an automatic push mirror back to GitHub.
- Protect `main`: direct push, force push, and deletion are disabled; changes
  enter through an internal pull request; only the maintainer team may merge;
  exact required push statuses are `ci / required (push)` and
  `security / required (push)`.
- Protect `v*`: the release-maintainer team initiates creation through a
  protected `release/v*` request branch. Only the SSH-only `svc-release-tag`
  technical account is whitelisted to create the annotated tag. Gitea 1.26
  natively couples protected-tag create/update/delete permission, so a
  root-managed repository `update.d` hook permits the zero-to-new creation and
  rejects every later move or deletion over Git. User-managed custom hooks stay
  disabled. A separate release-record PAT is not tag-whitelisted and therefore
  cannot delete the protected tag through the API. Signature enforcement is
  deliberately not added in this migration; protected initiator identity,
  immutable refs, and commit/digest validation are the trust boundary.
- Branch and tag protection are proved with negative push/update/delete tests
  from a normal team account, not only by reading the settings UI.
- Before protection becomes a cutover gate, a test pull request must produce the
  actual Gitea commit-status list. Live push evidence must show contexts exactly
  named `ci / required (push)` and `security / required (push)`; the PR smoke
  separately proves the event-qualified pull-request executions rather than
  weakening or guessing the required-status rule.
- Disable Actions in the old GitHub repository through the GitHub repository
  Actions-permissions API before activating Gitea deployment. Evidence includes
  `enabled=false`, no queued or in-progress old workflow run, and rejection of a
  new dispatch attempt. The old repository and its historical workflow files
  remain intact and are not deleted or mirrored.

## 7. Workflow Design

All active workflows live under `.gitea/workflows/`. Gitea-compatible contexts
and outputs replace `GITHUB_*` assumptions. The only initially approved external
action is the Gitea-hosted checkout action; it is pinned to a full commit ID.
Toolchains run from digest-pinned job/container images or project scripts, so
setup and lint Marketplace actions are unnecessary. The approved action URL and
commit are recorded in reviewed manifest `.gitea/actions.lock`; additions require a pull
request and platform-operator review. No workflow may silently resolve a mutable
Marketplace tag. The pre-cutover smoke run explicitly validates the Gitea event
contexts, service containers, secrets, artifacts, and cache semantics used by
these workflows.

### 7.1 `ci.yml`

Triggers: `push`, internal `pull_request`.

- Backend unit tests.
- Backend integration tests.
- Frontend frozen pnpm install, typecheck, and critical Vitest suite.
- golangci-lint v2.9 with the project timeout.
- Linux shell syntax checks.
- No macOS runner and no Apple-container fixture job.
- The aggregate `required` job depends on every item above and is the only
  base success context named `ci / required`; Gitea persists its push execution
  as `ci / required (push)`. The commands live in reviewed project scripts
  shared with the deployment verification job, preventing CI and deploy
  verification from drifting apart.

### 7.2 `security.yml`

Triggers: `push`, internal `pull_request`, and cron `0 3 * * 1` with the Gitea
and runner containers configured to UTC (Monday 03:00 UTC / 11:00 China time).

- govulncheck.
- Production dependency pnpm audit.
- Audit-exception validation.
- Move the exception source from `.github/audit-exceptions.yml` to
  `.gitea/audit-exceptions.yml`.
- The aggregate base context is `security / required`, persisted for push as
  `security / required (push)`. A scheduled failure is visible in Gitea Actions
  and enters the operator's failure-notification path; it must be acknowledged
  within one business day.

### 7.3 `deploy.yml`

Trigger: push to protected `main` only.

1. Checkout the exact commit.
2. Run the same reviewed required CI and security scripts used by `ci.yml` and
   `security.yml`; deployment has a native `needs: verify` boundary and does not
   rely on cross-workflow scheduling order.
3. Build locally with an explicit `linux/amd64` platform and source-revision
   labels, then query the Gitea API before any Registry publication. If the
   commit is no longer protected `main` head, exit successfully as superseded
   without changing Registry or production.
4. Push only immutable candidate `:<commit-sha>`, inspect the remote manifest,
   require exactly AMD64, and record its `sha256` manifest digest. Recheck the
   Gitea main head before any mutable tag or Gateway operation. A commit that
   became superseded during candidate publication may leave only its unique SHA
   artifact; it cannot update `:main` or Gateway.
6. Detect changes since the last deployed commit in `backend/migrations/**`,
   `backend/ent/schema/**`, `backend/ent/migrate/**`,
   `backend/internal/repository/ent.go`,
   `backend/internal/repository/migrations_runner.go`, or
   `backend/migrations/migrations.go`. A match takes the migration-sensitive
   path in section 9.
7. Invoke the audited Gateway deployment script for the fixed allowlisted target
   `root@157.254.234.244:4422` and `/opt/211api/deploy`; repository variables
   cannot redirect production SSH. This dedicated root authorized key is also
   constrained with `from="37.221.194.27"`, OpenSSH `restrict`, and a fixed
   command dispatcher. The dispatcher validates the SSH source again, clears the
   inherited environment, fixes `PATH` and `umask`, and cannot obtain a shell,
   PTY, forwarding, agent forwarding, or execute arbitrary commands. Key ID,
   creation, rotation deadline, and revocation evidence are recorded without the
   private key.
8. Acquire `/run/lock/211api-deploy.lock` with non-blocking `flock`; the lock file
   descriptor remains open for the entire backup, update, pull, start, and health
   sequence. Exit code 75 means another deployment owns the lock. Process exit or
   disconnect releases the kernel lock; no lock-file deletion or TTL is used.
9. Under the lock, the Gateway script uses a root-only, repository-read-only
   Gitea head token to check protected `main` before backup and again after the
   validated backup, immediately before its first production mutation. API
   timeout, non-2xx response, malformed JSON, or either mismatch fails closed.
   Capture the previous commit, image reference, manifest digest, and current
   Compose/environment state, then create and validate pre-deploy backups. A
   head change during backup retains the valid backup as non-deployment evidence
   but changes neither the environment nor any mutable Registry tag.
10. Atomically update only `SUB2API_IMAGE` in the existing Gateway `.env` to
    `git.211api.com/211api/211api:<commit-sha>@sha256:<manifest-digest>` and write
    a root-only deployment-state record through temp-file-plus-rename.
11. Run `docker compose pull` and `docker compose up -d` from the existing
    Gateway deployment directory.
12. Poll `/health` for up to five minutes on the normal no-migration path. The
    approved migration-sensitive path has a twelve-minute ceiling, covering the
    existing ten-minute migration context plus startup evidence collection.
13. On failure, emit container status and redacted bounded logs, preserve the
    previous image and backup locations, and stop for operator action.
14. After success, verify the running container digest and source-revision label.
    Recheck Gitea head and update mutable `:main` only if this commit is still
    current, then apply bounded backup and Registry retention. If `main` advances
    after the Gateway's final pre-mutation check, the serialized newer job is the
    convergence path; the narrow cross-host race is recorded and no false claim
    of distributed atomicity is made.

Registry publication is idempotent but not overwrite-permissive: if an existing
SHA or version tag resolves to a different digest, the workflow fails and leaves
the tag unchanged. Cleanup preserves the digest running on Gateway, its recorded
predecessor, every retained Gitea Release, the smoke release, and the newest 20
successful SHA builds. `main` is only a mutable convenience pointer; `latest` is
only the latest stable release pointer.

The workflow does not use `workflow_dispatch` or job `environment` as a
security gate because the target Gitea behavior does not support those GitHub
semantics.

### 7.4 `release.yml`

Publication trigger: protected `v*` tag only. The same workflow also contains a
request lane for a newly pushed protected `release/v*` branch. That lane records
the actor from the signed push event, requires Gitea to report the request branch
as protected with its head equal to current `main`, requires the SHA image to
exist, validates VERSION/tag consistency, and uses the SSH-only technical account
to create the annotated tag. Branch protection, independently checked by the full
repository verifier, enforces actor/team admission. The request lane does not
publish a release itself; the resulting tag event enters the publication lane
below.

- Resolve the tag's commit SHA.
- Require the corresponding SHA image and recorded manifest digest to exist.
- Retag the digest, not a rebuilt image, as the version. Only a stable SemVer tag
  without a prerelease suffix updates `latest`; production never deploys
  `main`, `latest`, or a version tag.
- Create a Gitea Release with the tag message and Registry image reference.
- Do not build archives, cross-platform binaries, ARM64 images, DockerHub
  manifests, DockerHub descriptions, or legacy Telegram release messages.
- Verification first used the exact request branch
  `release/v0.1.160-gitea-smoke.1`; its failed actor-gate evidence is retained
  without a tag, release, or version image. The authorized recovery uses the
  exact annotated private prerelease tag `v0.1.160-gitea-smoke.2`. It creates a
  Gitea prerelease and version image but must not update `latest`. Both smoke
  request branches and all resulting smoke tag, image, and release evidence are
  retained unless the user later gives explicit scoped permission to delete
  them.

## 8. Secrets and Permissions

- `REGISTRY_BUILD_TOKEN`: dedicated service-account PAT with package write and
  the minimum package read permission needed by the deploy build job.
- `REGISTRY_RELEASE_TOKEN`: separate service-account PAT with only the package
  read/write permission required to retag a verified digest.
- `RELEASE_RECORD_TOKEN`: separate token with repository read and release write;
  it has no administration, Actions-secret, or package-write permission.
- `GITEA_TOKEN` remains the repository-scoped per-job built-in identity and is
  never shadowed by a static repository secret. It is not treated as the push
  actor: the request lane reads the actor from the signed push event, requires
  a new exact-main branch reported as protected, and relies on the independently
  full-verified `release/v*` push whitelist for team admission. Gitea 1.26.4
  rejects user secret names with the reserved `GITEA_` prefix, so the
  release-record PAT uses the non-reserved `RELEASE_RECORD_TOKEN` name.
- `RELEASE_TAG_SSH_KEY`: SSH-only key for `svc-release-tag`; the account has no
  retained password or PAT, and native tag protection plus the platform-managed
  immutable-tag hook bound what the key can change.
- `RELEASE_TAG_KNOWN_HOSTS`: pinned Gitea built-in SSH host keys for
  `git.211api.com:2222`, verified through the trusted Netcup administrative
  connection rather than runtime `ssh-keyscan` trust.
- Gateway `REGISTRY_PULL_TOKEN`: read-only package token stored only in root's
  Docker credential file on Gateway, mode `0600`; it never enters Gitea Actions.
- Gateway `GITEA_HEAD_READ_TOKEN`: repository-content read-only token used only
  by the root-owned deploy script for the final protected-main freshness check;
  it has no package, release, write, or administration permission.
- `DEPLOY_SSH_KEY`: dedicated deployment key.
- `DEPLOY_KNOWN_HOSTS`: pinned Gateway host key material.
- Pipedream project secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` belong
  only to the dedicated backup-notification workflow. They are never stored on
  Netcup, Gateway, Gitea, or in this repository, and workflow code must not log
  either value.
- Netcup stores only the Pipedream HTTPS endpoint in
  `/etc/gitea/backup-notify-url`, owned by `root:root` with mode `0600`. The
  endpoint URL is a bearer-like secret: it is not committed, printed, copied to
  evidence, or included in shell history. Gateway stores no notification
  credential or endpoint.
- Gateway host, port, user, and path are fixed audited constants in the deploy
  script, not mutable repository variables or secret payloads.
- The full production `.env` is not stored in Gitea and is not copied on
  every deployment.
- SSH host trust is pinned only after its fingerprints are compared through the
  existing trusted administrative connection or provider console. Runtime
  `ssh-keyscan` is not the trust source. Rotation is a separate reviewed change
  that may overlap old and new verified keys for a bounded period.
- Multiline keys and known-hosts data are written from secret environment values
  to mode-`0600` temporary files without evaluation. Registry passwords use
  stdin. Secret-bearing steps prohibit `set -x`; secrets are never placed in
  argv, interpolated into remote shell source, or printed in partial form that
  defeats Gitea masking.
- Secret files on hosts use mode `0600`, parent directories use `0700`, and all
  are excluded from Git. Service accounts and PATs are split by role so a build
  credential cannot create releases or administer repositories.
- The deploy public key is installed as a forced-command, restricted root key.
  The dispatcher accepts only strict full-SHA/digest/status subcommands and
  rejects unexpected argv before invoking the root-owned deployment script.
  Migration approval cannot be supplied by this CI key; a platform operator must
  use the pre-existing administrative channel for that explicit action.

## 9. Production Safety and Rollback Boundary

Before each deployment on Gateway:

- validate the allowlisted repository, full commit, AMD64 manifest, and digest;
- save the current image reference;
- back up `docker-compose.yml` and `.env`;
- create and validate a PostgreSQL custom-format backup using a PostgreSQL 18
  client compatible with the running server;
- require enough free disk for the new image plus two estimated backup sets;
- acquire the remote `flock` before any mutable step.

Application migrations are forward-only and may run before the new container
becomes healthy. Therefore:

- the normal automatic main path is allowed only when the migration-sensitive
  file set in section 7.3 has not changed since the recorded deployed commit;
- the first cutover is treated as migration-sensitive unless the currently
  deployed commit can be proven exactly;
- a migration-sensitive run builds and records the image but stops before
  Gateway mutation. A platform operator must review the SQL/schema diff,
  confirm an expand/contract compatibility window, and verify the backup. Over
  the pre-existing administrative SSH channel the operator runs
  `/usr/local/sbin/211api-deploy approve-migration` with exact arguments
  `--commit <40-hex-sha>`, `--digest sha256:<64-hex>`, and `--expires-in 30m`,
  confirms the displayed diff identity,
  and receives a random one-time nonce in a root-only approval record. The
  operator then invokes `211api-deploy deploy` with the same commit, digest, and
  nonce. Approval is atomically consumed before mutation; mismatch, expiry,
  replay, or an approval attempt through the CI forced-command key is rejected.
  Failed attempts and the consumed approval metadata are written to the
  root-only deployment audit log without secret values;
- the existing database advisory lock serializes concurrent migration runners
  but is not treated as rollback, compatibility, or recovery protection;
- migration stdout/stderr and the bounded startup log are retained as evidence;
- no automated database restore is allowed;
- no blind image rollback is claimed safe;
- a failed health check stops the workflow and reports evidence;
- any database restoration requires separate, explicit, scoped user
  confirmation;
- the previous image and backups remain available for a reviewed recovery
  procedure.

Although `backend/migrations/README.md` contains illustrative `Down` examples,
the active runner contract is forward-only. CI/CD adds no automated Down path;
reversal requires a reviewed compensating migration or an explicitly approved
database restore.

## 10. Backup and Restore

### 10.1 Gitea platform

- A root-owned systemd timer runs daily at 18:30 UTC (02:30 China time), separate
  from the Monday security scan. It takes a platform-backup lock, pauses new
  runner dispatch, and checks through the Gitea API that no job or package upload
  is active. An active job causes one bounded postponement and then a visible
  failure rather than interruption. With the platform idle, it stops Gitea
  briefly to quiesce repository/package writes and uses a PostgreSQL
  client matching the server major version for `pg_dump -Fc`, archives Gitea
  repositories, LFS, attachments, packages, configuration, runner registration
  state, platform/runner manifests, and Caddy state, then restores service and
  verifies health even when backup creation fails.
- Before writing, require at least 20% free disk and capacity for two estimated
  backup sets. Directories are root-owned `0700`; artifacts are `0600`, encrypted
  to an operator-held `age` recipient whose private key is not on Netcup, and
  accompanied by SHA-256 checksums. Database and archive streams are validated
  while being encrypted, so no complete plaintext backup is staged on disk.
  Partial ciphertext is signal-safe cleanup state; validated components are
  fsynced and atomically promoted with a manifest containing backup time, WAL
  position, recipient ID, source hashes, and component hashes. Restore drills
  receive the operator-held decryption key only through an ephemeral
  tmpfs/session; the private key is never persisted on Netcup.
- Retain seven daily and four weekly validated local backups. Cleanup runs only
  after a new validated backup and never removes the latest weekly or the backup
  selected for the current restore drill.
- Create an additional validated backup before platform upgrades.
- Complete an initial restore drill before cutover and repeat quarterly. Restore
  into a new isolated Docker network, temporary volumes, and loopback-only
  alternate port; verify admin login, repository clone, tag/ref counts, release
  metadata, and a package manifest without touching live data.
- The platform operator owns the timer, daily failure acknowledgement, quarterly
  drill, and evidence. A timer failure writes a persistent local failure marker
  and must enter a user-selected external notification path; journal-only silent
  failure is not accepted. Local-restore targets are RPO 24 hours and RTO two
  hours.

#### 10.1.1 Backup failure notification contract

The approved path is deliberately narrower than the retired release notifier:

```text
Netcup gitea-backup-notify
  -> fixed nonsecret JSON over HTTPS
  -> Pipedream HTTP workflow
  -> Telegram Bot API sendMessage
  -> dedicated private operations group
```

- The path carries only Gitea platform backup failures. It is not a CI,
  security-scan, release, deployment, Gateway, or general observability channel.
- Netcup emits one of two exact payload shapes. The readiness probe is
  `{schema:"gitea-backup-notification.v1",event:"preflight",status:"ok"}`.
  A failure contains exactly `schema`, `event`, `status`, `failed_at`, `code`,
  and `unit`; `event` is `backup-failed`, `status` is `failed`, `failed_at` is
  UTC `YYYY-MM-DDTHH:MM:SSZ`, `code` matches `^[a-z0-9-]{1,48}$`, and `unit`
  matches `^[0-9A-Za-z_.@-]{1,128}$`. No log text, command output, URL, token,
  host credential, backup content, or business data enters the payload.
- Pipedream accepts only HTTPS-triggered JSON `POST` requests matching one of
  those shapes. Unknown fields, wrong methods, malformed values, and unknown
  schema versions return HTTP 400 and do not call Telegram.
- A valid `preflight` returns HTTP 200 without sending a Telegram message, so
  daily readiness checks remain quiet. A one-time synthetic failure with code
  `notification-test` is rendered as an explicit test alert and proves the full
  path before the timer is enabled.
- A valid failure is rendered as bounded plain text containing only the event
  class, UTC failure time, failure code, and systemd unit. The bot performs no
  inbound-message processing, is a normal non-admin member of the dedicated
  private group, and is not reused by another business workflow.
- Pipedream returns success to Netcup only when Telegram returns HTTP 2xx and a
  JSON body with `ok: true`. Telegram timeout, non-2xx, malformed JSON, or
  `ok != true` returns a generic non-2xx response without exposing credentials.
  Netcup therefore retains its persistent failure marker for operator recovery.
- The HTTP trigger has no separate authorization header because the reviewed
  Netcup sender contract stores and sends only one HTTPS URL. The opaque
  endpoint URL is therefore the bearer credential. Suspected exposure requires
  endpoint rotation and replacement of the root-only Netcup file before the old
  endpoint is disabled.
- Pipedream may retain execution metadata, so the request is intentionally
  limited to nonsecret bounded fields. Neither Pipedream nor Telegram becomes a
  delivery owner or a backup store.

### 10.2 Production deployment

- Store each pre-deploy set under
  `/opt/211api/deploy/backups/<UTC-timestamp>-<commit>/` with directory mode
  `0700` and component mode `0600`. Include encrypted PostgreSQL custom-format
  dump, encrypted Compose/environment state, previous commit/image/digest,
  checksums, and a hashed validation listing. Validate each exact stream while
  encrypting it to the same recorded operator-held `age` recovery recipient used
  for Gitea backups; no complete plaintext dump or archive is staged on disk.
  Trap signals and abnormal exits, remove only owned partial ciphertext, fsync
  validated components, and atomically promote the completed set. Backup,
  encryption, validation, or manifest-write failure aborts deployment.
- The initial pre-cutover set and proven deployment state use the same audited
  deploy owner through a direct-human, TTY-confirmed `deploy
  --record-baseline` mode. That mode is not accepted by the CI forced-command
  dispatcher and makes no `.env`, Registry, Compose, or container change; it
  exists so the real baseline backup is not produced through an ad hoc root
  shell outside the owner.
- Before first cutover and quarterly thereafter, the operator supplies the `age`
  private key through a root-only tmpfs session and restores one retained
  Gateway dump into a disposable PostgreSQL 18 container with a new volume, no
  published port, no live volume, and no production network. The drill requires
  `pg_restore --exit-on-error`, schema/constraint checks, and representative
  nonsecret row-count checks before removing only its isolated resources and
  unmounting tmpfs. Recipient rotation records old/new IDs and retains the
  corresponding operator-held private keys until every backup under the old
  recipient expires.
- Retain at least the three newest validated sets. Cleanup occurs only after
  successful health verification and never removes the running deployment's
  predecessor or the newest known-good set.
- The per-deployment backup gives an RPO immediately before that deployment.
  Restore remains an explicitly approved operator procedure with a target RTO
  of two hours after approval; this design does not claim automatic rollback.

### 10.3 Residual risk

The approved scope has no off-host backup destination for Gitea. Local backups
do not survive total Netcup disk loss. Off-host encrypted backup is a recorded
follow-up and is not represented as already solved.

## 11. Security Controls

- Disable Gitea self-registration.
- Require the bootstrap administrator to enable 2FA before normal use.
- Limit the root-only administrator automation PAT to `write:admin`,
  `write:organization`, and `write:repository`; record its creation and a
  30-day rotation deadline. It has no package scope and never replaces the
  human 2FA gate.
- Keep the repository private.
- Keep runner concurrency at one.
- Use separate non-human service accounts for runner registration, build
  packages, backup reads, release packages, release records, and production
  deployment reads. The backup reader is non-admin and limited to `read:user`,
  `read:repository`, and `read:package`; it is never reused by deployment or
  release automation. Gitea grants organization-owned Registry access through
  granular team units, so `package-publishers` has only
  `repo.packages:write` and `package-readers` has only `repo.packages:read`;
  service accounts are not placed in either human maintainer team. Rotate
  bootstrap tokens after registration and record PAT expiry/rotation dates
  without recording values.
- Preserve existing Hermes, Komari, administrative SSH, and Gateway ingress
  services.
- Do not expose database or runner-internal ports.
- Keep Netcup and Gateway SSH password login disabled, retain key-only
  administration, and prove firewall/listener behavior for both IPv4 and IPv6.
- Validate Compose configuration before startup.
- Apply container log rotation and disk-usage monitoring.
- Bound Gateway deployment audit logs and Caddy/Gitea access logs by size and
  age. A deployment must fail before production mutation if its audit record
  cannot be atomically appended and fsynced; credential headers and query-secret
  sentinels must not appear in retained logs.
- Never inspect, print, commit, or copy private key contents into evidence.

## 12. Cutover Sequence

1. Synchronize Netcup time, establish DNS/firewall/listener baselines, create
   directories, and validate digest-pinned platform manifests without touching
   Gateway production.
2. Start and verify Caddy, Gitea, Gitea PostgreSQL, backup encryption, and a
   bootstrap backup/restore-mechanics drill before importing private data.
3. Create the private organization/repository and register the isolated runner.
4. Import repository history, compare every branch/tag ref, and configure exact
   branch/tag protection, service accounts, variables, and secrets.
5. Push the migration commit to a non-`main` Gitea branch. Verify Gitea context
   compatibility, CI, security scanning, Registry AMD64 manifest/digest, secret
   masking, and runner isolation. Create a consistent data-bearing platform
   backup and complete the full clone/ref/release/package restore drill. Do not
   push this commit to the old GitHub fork.
6. Record the current Gateway deployment/image/port baseline and complete the
   migration-sensitive first-deploy review and validated Gateway backup.
7. On GitHub, wait for or cancel every queued/in-progress old run within a
   bounded ten-minute drain window, then require every listed run to be terminal
   and no GitHub-originated SSH/deploy process to remain on Gateway. Disable
   repository Actions through the API and verify `enabled=false`. The sole
   accepted platform residue is run `29755862485`, which may remain queued only
   with zero jobs, no transition into execution, no other queued run, and zero
   `in_progress` runs; GitHub Actions must never be re-enabled merely to clear
   it. Repeat the exact residual-run and no-Gateway-session checks twice at
   least 60 seconds apart. Store redacted timestamped API JSON fields, old run
   IDs/statuses, and the dispatch HTTP status/result in the Aegis evidence
   bundle; never store the authorization header or token.
8. Switch local `origin` to Gitea and merge the already-tested migration commit
   into protected Gitea `main`. The canonical commit removes
   `.github/workflows/*`; the retained GitHub repository may still contain those
   inert historical files because Actions is already disabled.
9. Execute the first digest-qualified deployment to Gateway through the audited
   migration-sensitive path.
10. Verify production health, unchanged ingress/listener exposure, running
    manifest digest, source-revision label, and deployment-state record.
11. Push protected request branch `release/v0.1.160-gitea-smoke.1` at the
    deployed `main` commit. Verify that the SSH-only service account creates the
    annotated tag, then verify the Gitea prerelease and version image and prove
    that `latest` was not changed.
12. Confirm that no GitHub workflow, GHCR, DockerHub, or legacy Telegram
    release/deploy path remains an active delivery owner. The isolated backup
    failure notifier is evidence-only and cannot publish or deploy.

There is no period in which both GitHub and Gitea are allowed to deploy.

## 13. Retirement and Compatibility

### 13.1 Delete-first retirement

- Delete `.github/workflows/*.yml` from the canonical Gitea branch.
- Retire GHCR image naming and credentials.
- Retire DockerHub and legacy Telegram release/deploy steps and credentials.
- Do not reuse any retired Telegram bot, token, chat, code path, or workflow for
  the new backup notifier. Pipedream plus the dedicated bot is the single owner
  of the bounded notification adapter; Gitea workflows and Gateway have no
  Telegram credential.
- Retire GitHub-only CLA automation, which is inactive for this fork.
- Retire macOS CI and multi-architecture release jobs.
- Remove the CI dependency on `PROD_ENV_B64`.

### 13.2 Bounded compatibility exception

The application updater remains GitHub-backed because it represents the active
public upstream contract, not this fork's delivery owner. The retained boundary
is:

- `backend/internal/service/update_service.go` continues to use
  `Wei-Shaw/sub2api`;
- `backend/internal/repository/github_release_service.go` remains unchanged;
- the private fork is deployed only through Gitea CI/CD.

No Gitea-to-GitHub updater fallback or dual release provider is added.

### 13.3 Destructive boundary

- The old GitHub repository is not deleted.
- Existing Gateway business state is not deleted or relocated.
- New Gitea persistent state is backed up before upgrades.
- Any future deletion of releases, tags, repositories, or production data
  requires its own scoped authorization when irreversible.

## 14. Acceptance Criteria

### 14.1 Platform

- `https://git.211api.com` has a valid certificate and healthy Gitea UI/API.
- SSH clone and push work on port `2222`.
- Self-registration is disabled and `211api/211api` is private.
- Only approved Netcup listeners are reachable over IPv4; no AAAA record or
  IPv6 firewall bypass exists. PostgreSQL and runner-internal ports are not
  publicly reachable.
- Effective runner mounts contain no Netcup host Docker socket or arbitrary host
  path; the runner is unprivileged, only the declared rootless DinD boundary may
  be privileged, no Docker TCP API is listening, and the shared socket resolves
  only inside the dedicated tmpfs volume. Job UID/GID/capability evidence matches
  section 5.3.
- NTP is synchronized, SSH rate limiting/ban policy is active, and existing
  Hermes, Komari, and administrative SSH remain healthy.

### 14.2 Repository and CI

- Exact source and Gitea `refs/heads/*` and `refs/tags/*` object-ID inventories
  match.
- `origin`, `github`, and `upstream` have the approved roles.
- Negative direct/force/delete tests prove protected `main`. Role checks prove
  only release maintainers can create `release/v*` requests; wrong-head requests
  fail; Git and API move/delete attempts prove existing `v*` refs immutable; the
  managed hook checksum is recorded and user custom hooks remain disabled.
- Backend tests, frontend checks, lint, and security scan pass in Gitea.
- Required push contexts are exactly `ci / required (push)` and
  `security / required (push)`; the Gitea compatibility smoke covers every
  context/secret/service/cache feature used by active workflows.
- No active workflow remains under `.github/workflows/`.

### 14.3 Registry, deployment, and release

- Gitea Registry contains SHA and `main` tags; manifest inspection proves one
  `linux/amd64` image and records its digest. `main` is documented as mutable and
  is never a production input.
- Gateway runs
  `git.211api.com/211api/211api:<verified-commit-sha>@sha256:<verified-digest>`.
- Gateway `/health` succeeds after the cutover.
- The effective Gateway listener/ingress exposure matches the recorded
  pre-cutover baseline and no new public application port exists.
- A safe concurrent-lock test returns 75 without mutation. A commit superseded
  before publication changes neither Registry nor Gateway; one superseded during
  immutable candidate publication may retain only its unique SHA artifact and
  demonstrably changes neither `:main` nor Gateway.
- Production `.env` was never stored in Gitea.
- Protected `v0.1.160-gitea-smoke.1` produces a prerelease and version image from
  the existing digest without changing `latest`.
- GitHub API evidence reports Actions disabled, zero executing jobs, and no
  queued run except the explicitly accepted zero-job residual
  `29755862485`; the residual never executes and Gitea is the only deployment
  owner.

### 14.4 Backup

- A validated, encrypted Gitea backup includes database and
  repository/package/configuration state, with checksum evidence.
- A temporary isolated restore drill proves clone, refs, release, and package
  retrieval without modifying live data.
- The backup timer, persistent failure marker, notification path, owner, RPO/RTO,
  retention, and quarterly drill are configured and evidenced.
- The Pipedream endpoint returns 400 without calling Telegram for an invalid
  method, schema, field set, timestamp, code, or unit; returns 200 silently for
  the exact preflight payload; sends one explicit `notification-test` message to
  the dedicated private group; and returns non-2xx when the Telegram API does
  not prove `ok: true`.
- Presence-only evidence proves `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are
  Pipedream project secrets, the bot is a non-admin member of the dedicated
  private group, and neither secret exists in the repository, Netcup, Gitea, or
  Gateway. Netcup contains only the root-owned mode-`0600` Pipedream endpoint;
  evidence never records its value.
- A validated Gateway pre-deploy backup and previous commit/image/digest are
  recorded; age recipient/rotation and an isolated PostgreSQL restore drill are
  evidenced; failed backup validation demonstrably blocks deployment.
- Wrong-commit, wrong-digest, expired, replayed, and CI-key migration approvals
  are rejected; one valid approval is bound to one commit/digest and consumed.

## 15. Non-goals

- Moving 211API production or business data from Gateway to Netcup.
- Public Gitea access or external pull-request CI.
- Off-host backup implementation without a user-selected destination.
- Replacing the application updater's public GitHub release source.
- Deleting or automatically mirroring the old GitHub repository.
- Preserving GitHub workflow syntax or GitHub-only behavior for its own sake.
- Using Telegram for CI, security-scan, release, deployment, Gateway, or general
  application notifications.

## 16. Architecture Integrity and Minimality

- Invariant: one canonical delivery owner, with production runtime ownership
  remaining separate.
- Canonical owners: Gitea for delivery; Gateway for runtime; GitHub for public
  upstream releases; Pipedream for the bounded backup-notification adapter.
- Responsibility overlap removed: GitHub workflows and GHCR stop carrying
  delivery behavior before Gitea deployment activates.
- New surfaces with creation proof: Gitea platform, Gitea PostgreSQL, Caddy,
  isolated act_runner, and rootless DinD are the minimum services needed for
  private self-hosted Git plus TLS, persistence, and CI execution. The dedicated
  Pipedream workflow, bot, and private group are the minimum isolated surfaces
  needed to deliver backup failures without placing a Telegram credential on
  Netcup or reactivating retired release notification logic.
- Rejected additions: Kubernetes, a second runner host, GitHub push mirror,
  application release-provider abstraction, and CI-held production
  environment payload.
- Verdict: proceed to a written implementation plan after written-spec review.

## 17. ADR Signals for Completion Review

The completed implementation must be checked for ADR backfill because it
changes durable architecture ownership, host boundaries, artifact shape,
Registry ownership, compatibility, and retirement state.

Candidate durable decision:

- Gitea is the canonical delivery owner on Netcup.
- Gateway remains the canonical 211API production runtime owner.
- GitHub remains only the public upstream release source.
- Rootless DinD is the runner isolation contract.
- Pipedream is the only Telegram adapter, scoped to Gitea backup failures; all
  legacy release/deploy Telegram paths remain retired.

The ADR, if backfilled after implementation evidence exists, must record the
alternatives considered: single Compose stack, native systemd services, and a
separate runner host.

## 18. Implementation Boundary

This design authorizes planning, not implementation by itself. The
implementation plan must include exact files, pinned image versions, commands,
verification evidence, cutover checkpoints, rollback boundaries, and the
specific point at which GitHub Actions are disabled.

Cloudflare authorization, generated administrator credentials, runner
registration tokens, Registry PATs, deployment keys, and the Pipedream webhook
URL are implementation inputs. Their absence may block execution, but none may
be fabricated, committed, or printed.
