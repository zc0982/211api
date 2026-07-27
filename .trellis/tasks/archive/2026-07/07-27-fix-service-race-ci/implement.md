# Implementation Plan

## 1. Prepare isolated branch

- Fetch latest `origin/main`.
- Create branch `fix/issue-27-service-race-ci` in a dedicated worktree outside the dirty primary worktree.
- Record worktree path in task metadata.

## 2. Centralize Gin test mode

- Add `backend/internal/service/main_test.go` with package-level `TestMain`.
- Remove all other `gin.SetMode(gin.TestMode)` calls under `backend/internal/service`.
- Run import organization and `gofmt` on touched Go test files.
- Verify exact call count is one and no other Gin mode values remain.

## 3. Fix stub races iteratively

- Fix `dashboardRepoStub.recomputeCalls` with an atomic counter and synchronized reads.
- Run targeted race tests for the usage cleanup and parallel Gin reproductions.
- Run `go test -tags=unit -race -count=1 ./internal/service`.
- Parse any remaining race reports by direct access frames and fix only in-scope test synchronization; repeat until zero warnings.
- If direct production-production access appears, stop and return to planning.

## 4. Add reusable local gate

- Add `.PHONY` entry and `test-race-service` target to `backend/Makefile`.
- Re-run through `make test-race-service` rather than only the raw command.

## 5. Add CI/deployment gate

- Add `race-service` job to `.github/workflows/backend-ci.yml`.
- Gate it on backend changes plus `push` to `main`.
- Use the same Go version source and verification as backend test jobs.
- Add a separate Go build cache key and job timeout.
- Add `race-service` to `ci-ok.needs`; preserve skipped-as-success aggregation behavior.

## 6. Validation

- Search invariants: exactly one `gin.SetMode(gin.TestMode)` in service tests; no DebugMode/ReleaseMode switching.
- `cd backend && go test -tags=unit -race -count=1 -run '<targeted regex>' ./internal/service`.
- `cd backend && make test-race-service`.
- `cd backend && make test-unit`.
- Run applicable formatting, compile/lint, workflow parse, and structural assertions.
- Review diff for accidental changes outside Issue #27 scope.

## 7. Review and delivery

- Dispatch Trellis quality check and address findings.
- Update project spec only if a durable new convention is introduced; otherwise record no spec change needed.
- Commit only implementation files on `fix/issue-27-service-race-ci`.
- Push to origin and create a GitHub PR targeting `main`, including summary, validation evidence, risk/CI behavior, and `Closes #27`.

## Rollback Points

- Before CI edit: test-only changes can be reverted independently.
- Before push: branch/worktree can be discarded without touching primary worktree.
- After PR: each logical layer is reviewable in one commit; no migration or production data rollback is required.
