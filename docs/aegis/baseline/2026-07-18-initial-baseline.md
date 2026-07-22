# 211API Initial Baseline

Date: `2026-07-18`
Status: `initial dual-baseline snapshot`

## 1. Purpose

This snapshot records the requirement and architecture state immediately before
the fork's CI/CD owner moves from GitHub to self-hosted Gitea. Later alignment
checks must use it to distinguish the requested delivery migration from an
unrequested production-service or business-data migration.

## 2. Workspace Structure

- `backend/`: Go API gateway, migrations, update/rollback service, and embedded
  frontend target.
- `frontend/`: Vue application built with pnpm.
- `deploy/`: Docker Compose, installation, and runtime deployment assets.
- `.github/workflows/`: current GitHub CI, security, deployment, release, and
  CLA workflows.
- `.goreleaser*.yaml`: current multi-platform GitHub/DockerHub release
  configuration.
- `docs/aegis/`: project-local Aegis design, plan, work, and evidence records.

## 3. Current Authority Surfaces

- User-approved design decisions in the current migration conversation.
- `README_CN.md`, `DEV_GUIDE.md`, and `deploy/README.md`.
- Current workflow definitions under `.github/workflows/`.
- Gitea 1.26 official Actions, runner, compatibility, secrets, token, and
  container registry documentation.
- Read-only host inspection captured on 2026-07-18 for Netcup
  `37.221.194.27` and Gateway `157.254.234.244`.
- No pre-existing project ADR, `CONTEXT.md`, `CONTEXT-MAP.md`, or Aegis
  baseline existed before this snapshot.

## 4. Product / Requirement Baseline

### 4.1 Current Truth

- The requested outcome is to replace this fork's GitHub CI/CD with a private,
  self-hosted Gitea delivery chain.
- Gitea is to be hosted on the Netcup Germany server and exposed as
  `https://git.211api.com`, with Git SSH on port `2222`.
- The repository is private, self-registration is disabled, and only invited
  team members may access or trigger CI.
- The selected release posture is AMD64-only: automatic `main` deployment,
  immutable commit images, protected `v*` releases, and no DockerHub,
  legacy Telegram release notifications, ARM64, macOS, or Windows release
  outputs. A dedicated Pipedream adapter sends bounded backup failures and
  final post-merge deployment results to Telegram without deployment authority.
- The current production application remains on Gateway Los Angeles. Business
  traffic, PostgreSQL, Redis, configuration, and persistent data do not move.
- The application admin UI continues to use the public
  `Wei-Shaw/sub2api` GitHub Releases feed for upstream version checks.

### 4.2 Non-negotiables

1. Gitea is the only canonical owner for this fork's repository, Registry, CI,
   release, and production deployment.
2. Netcup must not host the 211API business application or its business data.
3. Gateway `157.254.234.244` remains the sole 211API production runtime owner.
4. CI jobs must not mount the Netcup host Docker socket.
5. Production deployments use immutable commit image tags and must not expose
   the production `.env` through Gitea.
6. GitHub Actions must be disabled before Gitea becomes the active deployment
   owner.

### 4.3 Product Non-goals

- Public Gitea registration or public repository access.
- Business database, Redis, ingress, domain, or application relocation.
- Complete removal of GitHub as the public upstream source.
- DockerHub publication, Telegram deployment control or general business
  notifications, multi-architecture images, or cross-platform binary releases.
- Deletion of the old GitHub repository.

## 5. Architecture / Runtime Boundary Baseline

### 5.1 Current Truth

- Local `origin` points to `https://github.com/zc0982/211api.git`; local
  `upstream` points to `https://github.com/Wei-Shaw/sub2api.git`.
- Five GitHub workflows currently own CI, CLA, deployment, release, and
  security scanning.
- The current deployment workflow builds
  `ghcr.io/zc0982/211api:main`, pushes to GHCR, and deploys over SSH.
- Gateway production currently runs healthy containers for 211API,
  PostgreSQL, and Redis under `/opt/211api/deploy`.
- Netcup is the retired former production host. It has no 211API containers or
  business data and has capacity for the Gitea platform.
- Gitea 1.26 does not provide drop-in behavior for every GitHub workflow
  feature used here: `workflow_dispatch` and job `environment` cannot be
  treated as active protection gates, and package publication needs a
  dedicated PAT rather than relying on `GITEA_TOKEN`.

### 5.2 Architecture Non-negotiables

1. Netcup platform stack and rootless runner stack are separate Compose
   projects, networks, and lifecycle units.
2. PostgreSQL used by Gitea is platform state only and is unrelated to the
   Gateway business PostgreSQL.
3. Deployment direction is one-way:
   `Netcup runner -> Gitea Registry -> SSH -> Gateway production`.
4. The Gateway business database has forward-only migrations; automatic
   database restoration or blind image rollback is forbidden.
5. Existing Hermes, Komari, host SSH, and Gateway ingress services remain
   outside this migration.

### 5.3 Architecture Non-goals

- Kubernetes, Nomad, or another orchestration layer.
- A second runner host.
- Host Docker socket access from Actions.
- A new release-provider abstraction inside the 211API application.

## 6. Ownership / Contract Snapshot

| Surface | Current owner | Approved target owner |
| --- | --- | --- |
| Fork repository | GitHub fork | Gitea `211api/211api` |
| CI and security scan | GitHub Actions | Gitea Actions |
| Container registry | GHCR | Gitea Container Registry |
| Main deployment | GitHub deploy workflow | Gitea deploy workflow |
| Private fork release | GitHub/GoReleaser | Gitea protected tag workflow |
| Public upstream update check | GitHub Releases | GitHub Releases, retained |
| 211API production runtime | Gateway Los Angeles | Gateway Los Angeles |
| Gitea platform runtime | none | Netcup Germany |

## 7. Current State and Risks

- GitHub-specific contexts, tokens, actions, release URLs, and GHCR templates
  are distributed across workflows and GoReleaser configuration.
- The current deploy workflow transfers the full production environment,
  increasing secret exposure.
- The current deploy workflow does not provide a database-aware rollback.
- Netcup time synchronization was not active during inspection and must be
  corrected before TLS and token-based automation are trusted.
- Local-only Gitea backups do not protect against total Netcup disk loss; an
  off-host backup destination is a follow-up operational requirement.

## 8. Alignment Use

- Read the Product / Requirement Baseline before changing repository
  visibility, release outputs, production location, or upstream-update
  behavior.
- Read the Architecture / Runtime Boundary Baseline before changing host
  placement, runner isolation, Registry ownership, deployment direction, or
  rollback behavior.
- Report `scope: both` when a proposed change affects both delivery behavior
  and host/runtime ownership.

## 9. Compatibility Boundary

- Preserve all existing production business state and Gateway runtime
  ownership.
- Preserve public upstream update checks against `Wei-Shaw/sub2api`.
- Preserve the existing backend/frontend test intent while retiring the
  macOS-only CI lane selected out of scope.
- Do not preserve GitHub CI/CD as a fallback after Gitea cutover.
