# Automatic Deployment and Telegram Result Notification Plan

## Goal

Remove the migration-sensitive human approval gate so every protected `main`
push can deploy automatically after the existing verification, immutable-image,
backup, and Gateway checks pass. Extend the existing Pipedream-to-Telegram
notification owner to report the final post-merge deployment result while
preserving backup-failure alerts.

## Architecture

Gitea remains the delivery owner and Gateway remains the production runtime
owner. The Gateway still classifies migration-sensitive paths, records that
classification in the validated pre-deploy backup, and grants those deployments
the longer health-check window, but it no longer creates, validates, or consumes
human approval records. A final `deploy.yml` job sends one bounded result payload
to the existing Pipedream endpoint. Pipedream validates the payload and owns the
only Telegram credentials and `sendMessage` call.

## Tech Stack

- Gitea Actions YAML and Bash
- Gateway Bash runtime on Debian
- Pipedream Node.js adapter
- Telegram Bot API `sendMessage`
- Node.js built-in test runner

## Baseline/Authority Refs

- User-approved design in the 2026-07-22 conversation: remove the migration
  approval gate; notify post-merge deployment success/failure through
  Pipedream and Telegram.
- `docs/aegis/baseline/2026-07-18-initial-baseline.md`
- `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`
- `docs/aegis/plans/2026-07-19-pipedream-telegram-backup-notification.md`
- `.gitea/workflows/deploy.yml`
- `deploy/gitea/gateway/211api-deploy`
- `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs`

## Compatibility Boundary

- Keep protected-`main` verification, immutable commit/digest binding, two
  protected-head checks, serialized deployment, validated encrypted backup,
  environment hash checks, bounded health checks, audit logging, and no
  automatic database restore.
- Keep migration-sensitive classification for backup metadata and the extended
  health deadline; retire only the human approval gate.
- Keep existing `gitea-backup-notification.v1` requests valid during the
  adapter transition.
- Pipedream and Telegram remain notification-only and receive no Gitea token,
  Registry token, SSH key, production credential, database content, or log.
- Notification delivery failure must be observable in the notification job but
  must not rewrite the already-determined deployment outcome.
- Existing on-host approval/audit records are historical persistent evidence;
  this plan does not delete or mutate them.

## TDD Route

- Mode: `off`
- Decision: `skipped`
- Strict authority: not applicable
- Test posture: post-change regression
- Reason: the user requested the behavior change but did not request strict TDD;
  existing adapter tests and shell syntax checks provide focused regression.
- Verification: Node adapter tests, Bash syntax, workflow contract assertions,
  lingering-reference checks, and post-rollout workflow/health evidence.

## Scope Check

### BaselineUsageDraft

- Required baseline refs: current Gitea CI/CD design, active baseline, Gateway
  README, Pipedream adapter contract.
- Acknowledged before plan refs: all required refs above.
- Cited in plan refs: all required refs above.
- Missing refs: none.
- Decision: continue.

### Requirement Ready Check

- Requirement source refs: user-approved 2026-07-22 design.
- Goals and scope refs: remove migration approval; add final deployment result
  notification.
- User / scenario refs: maintainer merges a PR and receives one Telegram success
  or failure message after the `main` deployment workflow reaches its outcome.
- Acceptance / verification criteria refs: no approval command or active record
  dependency; automatic migration-sensitive deploy; strict notification schema;
  backup alerts preserved; notification-only trust boundary.
- Open blocker questions: none for repository implementation. Pipedream editor
  deployment is an explicit rollout step because its credentials are external.
- Decision: ready.

### Change Necessity

- User-visible need: migration-sensitive `main` changes currently fail with exit
  78 until an operator creates a TTY-only record, and deployment results are not
  sent to Telegram.
- No-change / non-code option: manually approving and checking Gitea remains the
  exact friction the user asked to remove.
- Why code change is necessary: the gate is enforced inside the root-owned
  Gateway program and the Pipedream adapter rejects all deployment payloads.
- Minimum change boundary: Gateway deploy/install/runtime files, one final
  workflow job, the existing adapter/tests, and active architecture/operator
  documentation.
- Decision: code-change.

### Existence Check

- Proposed new surface: one final Gitea Actions notification job and one new
  payload kind.
- Existing owner / reuse candidate: the existing deploy workflow, Pipedream
  adapter, bot, group, and endpoint.
- Why existing surface is insufficient: the adapter currently accepts only
  backup failures and the deploy workflow has no terminal notification job.
- Creation proof: a final workflow job is the smallest owner that can see the
  actual deployment result; extending the existing adapter avoids a second bot
  or Telegram credential owner.
- Entropy / retirement impact: retire the backup-only filename/contract wording
  and the complete approval implementation instead of adding bypasses.
- Decision: reuse-existing.

### Architecture Integrity Lens

- Invariant: Gitea owns delivery, Gateway owns production mutation, Pipedream
  owns Telegram translation only.
- Canonical contract: `deploy.yml` bounded JSON -> Pipedream validation ->
  Telegram plain-text status.
- Responsibility overlap: none; notification cannot trigger or authorize deploy.
- Higher-level simplification: one adapter accepts both operational event kinds.
- Retirement / falsifier: any active approval command/record dependency or any
  Telegram token outside Pipedream invalidates the result.
- Verdict: proceed.

### Anti-Entropy Declaration

- Deletion Class: code-retirement and contract-carrying deployment code.
- Old Path/Object: `approve-migration`, active/consumed approval directories,
  approval validation/consumption, and backup-only Telegram adapter naming.
- New Canonical Owner: unconditional guarded Gateway deploy plus the existing
  Pipedream notification owner.
- Expected Preserved Behavior: all verification, backups, health checks, audits,
  sensitive-path classification, and backup alerts.
- Expected Retired Behavior: exit 78 caused by missing/expired migration approval
  and interactive approval instructions.
- External Boundary Touched: yes, Pipedream editor and Gitea Actions secret.
- Source-of-Truth Data Risk: none; existing host records are retained.
- User Confirmation Required: no; the user explicitly approved code retirement,
  and no persistent records are deleted.

### Retirement Decision

- Path: delete-first.
- Why: approval is an internal deployment gate with no external caller that must
  remain compatible; keeping a bypass or dormant command would preserve two
  paths and future confusion.
- Non-edits: do not delete live approval/audit history and do not weaken backup,
  health, protected-head, image, or environment checks.

### Complexity Budget

- Artifact class: workflow, root deployment program, external adapter.
- Target files / artifacts: existing owners only.
- Current pressure: `211api-deploy` is large, but deletion reduces it; the
  adapter remains small and schema-driven.
- Projected post-change pressure: lower Gateway complexity, modest adapter growth.
- Budget result: within-budget.
- Planned governance: rename the adapter to match its widened responsibility and
  keep payload classification/rendering centralized.

### Plan Pressure Test

- Owner / contract / retirement: existing owners, explicit gate retirement.
- Architecture integrity / higher-level path: one final workflow result owner and
  one notification adapter.
- Verification scope: local regression plus live Pipedream/Gitea/Gateway rollout.
- Task executability: repository tasks are complete; external rollout has strict
  sequencing and bounded secrets.
- Pressure result: proceed.

## Execution Readiness View

- Intent Lock: automatic protected-`main` deployment and Telegram result notices.
- Scope Fence: Gateway approval retirement, deployment workflow terminal notice,
  Pipedream adapter/tests, active docs, and rollout only.
- Baseline Lock: existing Gitea/Gateway architecture remains authoritative except
  for the two user-approved amendments.
- Approved Behavior: migration-sensitive deploys no longer pause; final success
  or failure emits one bounded notification attempt.
- Owner / Contract Constraints: no production authority in Pipedream/Telegram.
- Compatibility Boundary: backup notification schema and all non-approval
  production safeguards remain.
- Retirement Boundary: remove active approval code; retain historical host data.
- Task Batches: Gateway retirement; adapter/workflow; docs; local verification;
  external rollout and proof.
- Test Obligations: Node tests, Bash syntax, YAML/contract checks, lingering refs,
  workflow outcome, and public health.
- Review Gates: stop on unrelated worktree changes, schema ambiguity, secret
  output, failed backup-alert regression, or loss of a production safeguard.
- Drift / Rewind Rules: repair the canonical owner; do not restore an approval
  bypass or add direct Telegram calls.
- Evidence Required Before Completion: reviewed diff, passing local checks,
  deployed Pipedream adapter, installed Gateway owner, successful Gitea run, and
  healthy public endpoint.
- Advisory Boundary: method-pack execution guidance only; not completion authority.

## Files

- Modify `.gitea/workflows/deploy.yml`.
- Modify `deploy/gitea/admin/admin-lib.sh` and
  `deploy/gitea/admin/verify-repository` so full verification requires the
  notification endpoint secret without changing base-bootstrap ordering.
- Modify `deploy/gitea/gateway/211api-deploy`.
- Modify `deploy/gitea/gateway/gateway-runtime.sh`.
- Modify `deploy/gitea/gateway/install-gateway-deployer`.
- Rename and modify `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs` to
  `deploy/gitea/pipedream/gitea-ops-to-telegram.mjs`.
- Rename and modify its test to `gitea-ops-to-telegram.test.mjs`.
- Modify `deploy/gitea/README.md`, the active baseline, the active design, and
  `docs/aegis/INDEX.md`.

## Tasks

### Task 1: Retire the Gateway Approval Gate

**Files:** Gateway deploy, runtime, and installer files above.

**Why:** make migration-sensitive changes follow the same automatic, backed-up,
audited deployment path as other protected-main changes.

**Impact/Compatibility:** preserve sensitive-path detection for backup metadata
and the twelve-minute health ceiling; leave existing host record directories
untouched during rollout.

**Steps:**

1. Remove the approval CLI grammar, layout validation, record helpers, audit
   events, and consumption branch.
2. Remove approval directory variables and new-install directory creation.
3. Run `./tools/gitea-ci.sh shell-syntax` and require exit 0.
4. Scan active runtime files for `approve-migration`, `approval_record`,
   `ACTIVE_APPROVAL_DIR`, and `CONSUMED_APPROVAL_DIR`; require no matches.

### Task 2: Widen the Existing Pipedream Adapter

**Files:** renamed adapter and test.

**Why:** reuse the only Telegram credential owner for deployment results without
granting it deployment authority.

**Impact/Compatibility:** retain exact backup preflight/failure inputs; add an
exact `gitea-deployment-notification.v1` result payload with bounded repository,
commit, status, timestamp, and run URL.

**Steps:**

1. Rename the files and centralize exact-key validation by schema/event.
2. Render separate Chinese success/failure messages without secrets or logs.
3. Add positive success/failure, invalid-payload, compatibility, delivery-fail,
   and configuration tests.
4. Run `node --check` and `node --test`; require all tests pass.

### Task 3: Add the Terminal Deployment Notification Job

**Files:** `.gitea/workflows/deploy.yml`.

**Why:** this workflow is the only owner that knows whether the post-merge
deployment itself succeeded or failed.

**Impact/Compatibility:** run after `verify` and `build_deploy` with `always()`;
the notification endpoint is a Gitea Actions secret and notification failure
does not change the deployment result.

**Steps:**

1. Add a bounded `notify` job on `linux-amd64` with no checkout.
2. Derive success only from `build_deploy == success`; otherwise send failure.
3. Build JSON with `jq`, call Pipedream with bounded timeouts and no tracing, and
   emit only a generic warning if delivery fails.
4. Assert the YAML contains the terminal `always()`/`needs` boundary, secret,
   schema, and no Telegram credential/API reference.

### Task 4: Synchronize Active Architecture and Operator Docs

**Files:** active design, baseline, Gateway README, Pipedream plan references,
and workspace index.

**Why:** prevent the retired gate and backup-only Telegram scope from remaining
as conflicting operator authority.

**Impact/Compatibility:** historical work/evidence documents remain historical;
active docs describe automatic deploy, notification-only Pipedream, endpoint
installation, adapter deployment, and retained on-host audit records.

**Steps:**

1. Amend production safety and deploy flow language.
2. Replace backup-only adapter filenames and deployment instructions.
3. Document `PIPEDREAM_NOTIFY_URL` as a notification-only Actions secret.
4. Run an active-authority lingering-reference scan; inspect every remaining
   approval or backup-only notification claim.
5. Extend the full repository verifier to require `PIPEDREAM_NOTIFY_URL`, while
   keeping the base-bootstrap secret check compatible with pre-endpoint setup.

### Task 5: Verify and Roll Out

**Files/External surfaces:** repository diff, Pipedream workflow, Gitea secret,
Gateway installed programs, Gitea Actions, public health.

**Why:** repository changes alone do not update the Pipedream editor or the
root-owned production Gateway program.

**Impact/Compatibility:** deploy Pipedream first so the new result payload is
accepted before `main` sends it; install Gateway code only from the reviewed
commit. Do not print the endpoint or credentials.

**Steps:**

1. Run all local checks and review the diff/retirement scan.
2. Deploy the exact committed adapter in Pipedream and run backup plus deployment
   synthetic probes.
3. Copy the existing opaque endpoint to Gitea secret `PIPEDREAM_NOTIFY_URL`
   through masked/stdin-safe administration.
4. Install the reviewed Gateway files; confirm status readiness and that the old
   CLI command is rejected as unknown while historical directories remain.
5. Push a branch and create a PR. After authorized merge, monitor verification,
   deployment, notification, and `https://www.211api.com/health`.

## Verification Plan

- Main-path check: a protected-main deployment with sensitive paths proceeds
  through backup and mutation without looking for an approval record.
- Lingering-reference check: active code/operator authority has no approval
  command or record dependency; historical plans/evidence are allowed.
- Negative check: `approve-migration` is no longer a valid CLI command and the
  workflow contains no direct Telegram call.
- Boundary check: backup notifications still pass, Pipedream owns Telegram
  credentials, and Gateway safety checks remain present.

## Risks and Rollback

- A forward-only migration can deploy automatically after merge. Mitigation is
  mandatory PR checks, protected main, validated pre-deploy backup, longer
  migration health window, and explicit no-auto-restore behavior.
- A malformed notification adapter can suppress alerts. Deploy the adapter
  before the workflow and prove both schemas through masked probes.
- A notification endpoint leak permits alert spam only. Rotate the Pipedream
  endpoint and Gitea secret; it grants no deploy authority.
- Rollback of repository code is a normal revert, but restoring the human
  approval gate would be a fresh architecture decision, not an automatic
  fallback. Database restore remains separately scoped and requires explicit
  confirmation.

## Retirement

- Delete active approval code and install/runtime dependencies.
- Rename the backup-only adapter owner to its operational-notification scope.
- Keep existing production approval/audit records as inert historical evidence.
- Do not add a compatibility alias for `approve-migration` and do not add a
  second Telegram adapter.
