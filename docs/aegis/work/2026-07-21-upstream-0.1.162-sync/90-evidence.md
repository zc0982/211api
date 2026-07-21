# 同步上游 0.1.162 - Evidence

## Source and merge topology

- origin/main before sync: `e289410d1c37d7aa93d26ea75103026845759587`
- upstream/main: `5a8d6c4e41e38f05cea4164e6ff03443fc0f6923`
- merge base: `57914967cbb127ff715719c3879d881c10d75274`
- divergence: origin-only 124 / upstream-only 213
- target version: `backend/cmd/server/VERSION = 0.1.162`
- explicit conflicts: `frontend/package.json` and `frontend/pnpm-lock.yaml`; both resolved to axios `^1.18.1`, locked `1.18.1`

## Semantic merge decisions

- Preserved the fork's secure behavior: missing/read-failed `session_binding_enabled` and `step_up_enabled` remain enabled; only explicit `false` disables them.
- Preserved trusted-proxy authority: raw forwarded-header takeover defaults to false and migration never changes persisted false to true.
- Kept upstream migrations `183_ops_ingress_reject_aggregates.sql` and `184_auth_cache_invalidation_outbox.sql`; runner sorts them 183 then 184 and executes both transactionally.
- Limited `REDIS_USERNAME` to `docker-compose.standalone.yml` / external Redis; bundled Redis profiles use the default user and cannot become false-healthy from an undefined ACL user.
- Kept the upstream 256 MiB Caddy request limit because it matches `server.max_request_body_size` and multimodal/image upload contracts; retained the fork's explicit MIME compression list.
- Updated stale upstream tests for the 900000 ms rollback API timeout and the intentional PNG-to-SVG default logo migration.
- `.github/workflows` and `.goreleaser*` remain absent; `.gitea/workflows` and `deploy/gitea` remain the canonical CI/CD/release/deploy owners.

## Local verification

- `go test -tags=unit ./internal/config ./internal/service ./internal/server/middleware ./internal/handler/admin` — pass.
- `go test -tags=unit ./...` — pass after aligning API contract fixtures with the secure defaults.
- `go test -tags=integration ./...` — pass, including repository/service/migrations integration paths.
- `go test -tags=embed ./internal/web -count=1` — pass after updating embedded static asset checks to `/logo.svg`.
- Frontend pinned dependency install: `corepack pnpm@9.15.9 install --frozen-lockfile` — pass.
- Frontend lint and typecheck — pass.
- Frontend full Vitest: 179 files / 1242 tests — pass in 30.29s when run without competing lint/typecheck load.
- Frontend production build — pass; only existing dynamic-import/chunk-size warnings remain.
- Four compose files parse with `docker compose ... config --quiet` — pass.
- `./tools/gitea-ci.sh shell-syntax` — pass.
- CGO-disabled server build — pass.

## Diagnostic and review evidence

- Initial concurrent full Vitest run had six 10-second timeouts; the same five files then passed 57/57 under low load, and the final full suite passed 1242/1242. Root cause: local CPU/transform contention, not product logic.
- Upstream rollback tests deterministically failed because commit `35b5edb24` added a third axios timeout argument without updating the test; test-only contract repair passes 3/3.
- Independent security review found no actionable issue; residual design choice is fail-closed treatment of any value other than exact `false`.
- Independent integrity review found stale embed-tag `/logo.png` tests; reproduced failure, updated to canonical SVG, then both unit and embed-tag web tests passed.
- Reviewer Redis concern was checked against the final worktree: only standalone compose contains `REDIS_USERNAME`.

## Pending evidence

- Protected Gitea PR CI/security checks on Go 1.26.5 and Node 20.
- Protected merge result, deploy workflow result, Registry digest and production health.

These records are Method Pack evidence only and do not grant completion authority.
