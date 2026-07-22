# 同步上游 0.1.162 - Evidence

## Source and merge topology

- origin/main before sync: `e289410d1c37d7aa93d26ea75103026845759587`
- upstream/main: `5a8d6c4e41e38f05cea4164e6ff03443fc0f6923`
- merge base: `57914967cbb127ff715719c3879d881c10d75274`
- divergence: origin-only 124 / upstream-only 213
- target version: `backend/cmd/server/VERSION = 0.1.162`
- fresh pre-commit fetch confirmed both remote refs unchanged
- merge commit: `11344fe32dcd6b1dae2acfe588a1896cff2e8a06`
- merge parents: `e289410d1c37d7aa93d26ea75103026845759587` and `5a8d6c4e41e38f05cea4164e6ff03443fc0f6923`
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

## Protected PR evidence

- Protected Gitea PR #5: `https://git.211api.com/211api/211api/pulls/5`.
- On exact SHA `b4646b2e93ea9bedce26e8eb44d2c3ef9f6ab931`, every completed push lane passed. Pull-request backend-unit job 576 failed only in `TestPassthroughLifecycle_LeaseLossSendsRetryClose`, where the assertion received EOF before the WebSocket client reader had started.
- The same SHA's push backend-unit lane passed, and the unmodified focused test reproduced the EOF at `-count=300`. This isolated a test timing window rather than a change in production lease-loss close ownership.
- Test-only synchronization now proves the reader relay is active before injecting lease loss: observe upstream `response.create`, send a legal `response.cancel`, observe that upstream frame, then cancel control with `ErrOpenAIWSIngressLeaseLost`. The required `websocket.CloseError`, code 1013 and exact reason assertions are retained.
- Post-change focused verification: `go test -tags=unit ./internal/service -run '^TestPassthroughLifecycle_LeaseLossSendsRetryClose$' -count=5000` — pass in 8.249s.
- Post-change package verification: `go test -tags=unit ./internal/service` — pass in 142.594s.
- Independent read-only review confirmed that the added exchange is protocol-level readiness synchronization and does not alter production relay or close ownership.
- Exact test-fix SHA `243f8d66368c6507265c1b7bda26f2970242a64e` passed all 18 push/pull_request CI and security contexts on Go 1.26.5 and Node 20; the formerly failing pull-request backend-unit context passed in 10m0s.
- PR #5 merged without branch deletion as `f83eeda7715b63b55cca5abe3d1674715b3e7f9f`; its parents are exact old main `e289410d...` then exact PR head `243f8d663...`.

## Main deploy and production evidence

- Main run 152 finished `success`; exact main has 18/18 success, zero failure and zero pending across CI, security and deploy.
- `deploy / lint` attempt 1 failed with exit 137 when golangci-lint was killed at the 4 GiB DinD cgroup boundary. The host itself still had about 5.4 GiB available. Cgroup evidence recorded `memory.max=4294967296`, lifetime `memory.peak=4295454720` and `oom_kill=5` before retry.
- A single controlled `rerun-failed-jobs` retried only lint and downstream jobs. Lint attempt 2 passed in 18m19s with `oom_kill` unchanged, but repeated live samples reached `4294881280` bytes and less than 1 MiB remaining. The upstream sync is deployed; the bounded Runner memory margin remains an explicit reliability follow-up.
- Build-and-deploy attempt 1 published the immutable SHA image, then failed closed with exit 78 because migration-sensitive changes had no exact approval. No production state or mutable `main` tag was changed by that attempt.
- Installed Gateway `211api-deploy`, dispatcher and runtime library hashes exactly matched origin/main; owner/mode, health, lock availability and state/env consistency passed. Human root TTY review listed only `backend/internal/repository/migrations_runner.go`, migrations 183 and 184, then created the 30-minute approval bound to exact commit and digest.
- Build-and-deploy attempt 2 succeeded in 53s. The approval was atomically consumed; validated encrypted backup `20260721T190018Z-f83eeda7715b63b55cca5abe3d1674715b3e7f9f` was created before `.env` mutation.
- Registry `f83eeda...` and `main` both resolve to `sha256:333330a196494a37ee4f44f58b31232a37a3e228f0c95f37c5712ed50f3c8135`; raw inspection proves `application/vnd.oci.image.manifest.v1+json`, no index, `linux/amd64`, and exact OCI revision/version. Registry `latest`, `0.1.162` and `v0.1.162` are absent.
- Gateway status reports ready, healthy, lock available, protected main exact, current commit/digest exact, and `state_env_consistent=true`; listener proof is only `127.0.0.1:8080`. Container health is `healthy` with failing streak 0 and exact OCI labels.
- Production `schema_migrations` contains `183_ops_ingress_reject_aggregates.sql` checksum `16a2ffccfe0f03451ab5ab6edfe252501d09c5c8927e27d87bbc3f826a5d8871` and `184_auth_cache_invalidation_outbox.sql` checksum `870ff546e67a8c59f99310fab34e2101af71332eea50fff17a6bfb2a4d0fdc7a`; they match the deployed source.
- GitHub Actions remains disabled. Residual run `29755862485` remains queued at old SHA `5ed5530...` with zero jobs. Gitea retains only the authorized Task 16 smoke tag/release; no 0.1.162 tag/release was created.
- Static owner proof: `.github/workflows` and `.goreleaser*` remain absent, release/deploy workflows publish only to `git.211api.com`, and the produced manifest is not multi-arch. No DockerHub/GHCR/Telegram publication, archive/checksum, macOS/Windows binary or ARM64 output occurred.

These records are Method Pack evidence only and do not grant completion authority.
