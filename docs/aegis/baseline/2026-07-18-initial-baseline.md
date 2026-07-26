# 211API Initial Baseline

Date: `2026-07-18`
Revised: `2026-07-26`
Status: `dual baseline, active`

## 1. Purpose

This snapshot records the fork's requirement and architecture state. Later
alignment checks must use it to distinguish delivery-chain changes from an
unrequested production-service or business-data migration.

The 2026-07-18 edition was written for a migration of the CI/CD owner from
GitHub to a self-hosted Gitea instance. That migration was reverted and the
self-hosted Gitea has been retired: GitHub Actions and GHCR own delivery again.
Sections below were revised on 2026-07-26 to state the current truth; the
retired Gitea target is retained only where it explains a past decision.

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
- Read-only host inspection captured on 2026-07-18 for Gateway
  `157.254.234.244`.
- No pre-existing project ADR, `CONTEXT.md`, `CONTEXT-MAP.md`, or Aegis
  baseline existed before this snapshot.

## 4. Product / Requirement Baseline

### 4.1 Current Truth

- GitHub is this fork's CI/CD owner. The 2026-07-18 plan to replace it with a
  self-hosted Gitea delivery chain was carried out and then reverted; the
  self-hosted Gitea instance is retired and is no longer an authority surface.
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

1. GitHub is the only canonical owner for this fork's repository, Registry, CI,
   release, and production deployment.
2. Gateway `157.254.234.244` remains the sole 211API production runtime owner.
3. CI jobs must not mount a host Docker socket.
4. Production deployments use immutable commit image tags and must not expose
   the production `.env` through CI.

### 4.3 Product Non-goals

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
- The self-hosted delivery platform that the 2026-07-18 edition planned on a
  second host is retired. No self-hosted Git, Registry, or runner host is part
  of this architecture.

### 5.2 Architecture Non-negotiables

1. Deployment direction is one-way:
   `GitHub Actions -> GHCR -> SSH -> Gateway production`.
2. The Gateway business database has forward-only migrations; automatic
   database restoration or blind image rollback is forbidden.
3. Existing Hermes, Komari, host SSH, and Gateway ingress services remain
   outside the delivery chain's scope.

### 5.3 Architecture Non-goals

- Kubernetes, Nomad, or another orchestration layer.
- A second runner host.
- Host Docker socket access from Actions.
- A new release-provider abstraction inside the 211API application.

## 6. Ownership / Contract Snapshot

| Surface | Owner |
| --- | --- |
| Fork repository | GitHub fork `zc0982/211api` |
| CI and security scan | GitHub Actions |
| Container registry | GHCR |
| Main deployment | GitHub deploy workflow |
| Private fork release | GitHub/GoReleaser |
| Public upstream update check | GitHub Releases |
| 211API production runtime | Gateway Los Angeles |

## 7. Current State and Risks

- GitHub-specific contexts, tokens, actions, release URLs, and GHCR templates
  are distributed across workflows and GoReleaser configuration.
- The current deploy workflow transfers the full production environment,
  increasing secret exposure.
- The current deploy workflow does not provide a database-aware rollback.

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
