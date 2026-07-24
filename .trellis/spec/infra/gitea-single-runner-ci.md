# Gitea Single-Runner CI Contract

## 1. Scope / Trigger

Use this contract whenever changing `.gitea/workflows/`, `.gitea/actions.lock`,
`tools/gitea-ci.sh`, `tools/gitea-cache-key.sh`, or `deploy/gitea/runner/`, and
when validating the internal-PR, external-fork, or failed-deployment-gate
boundary on live Gitea.

The target is the existing self-hosted Gitea Runner. Its security boundary is
part of the feature: keep `runner.capacity: 1`, rootless DinD, the existing CPU
and memory limits, and no host Docker socket, host networking, host PID, or
arbitrary host-path mounts.

## 2. Signatures

### CI dispatcher

```text
./tools/gitea-ci.sh <command>

commands:
  shell-syntax
  backend-unit
  backend-integration
  lint
  frontend
  frontend-all
  security-backend
  security-frontend
```

`frontend-all` installs dependencies once, then runs frontend tests followed by
the production-dependency audit. Any failed phase returns non-zero.

### Cache key owner

```text
./tools/gitea-cache-key.sh {go|pnpm}
```

- Exactly one argument is required.
- Success prints exactly one key in the form
  `gitea-<go|pnpm>-linux-amd64-v1-<sha256>`.
- Unknown, missing, or extra arguments return exit code `64`.
- Missing or symlinked digest inputs fail closed.

### Cache maintenance hook

```text
/usr/local/bin/gitea-runner-cache-maintenance
```

The production command accepts no path argument. It may operate only on
`/data/cache/actions` and keeps that root directory after cleanup.

### Runner state/cache volume initializer

```text
docker run --rm --network none --read-only --user 0:0 \
  --cap-drop ALL \
  --cap-add DAC_OVERRIDE --cap-add CHOWN --cap-add FOWNER \
  --security-opt no-new-privileges:true \
  --mount type=volume,src=gitea-runner-data,dst=/data \
  "$APP_ALPINE_IMAGE" sh -ec '<initialize and assert exact paths>'
```

The initializer creates only `/data/cache/actions`, normalizes `/data`,
`/data/cache`, and `/data/cache/actions` to `1000:1000` mode `0700`, then
asserts all three owner/mode pairs. It is idempotent and must not read, rewrite,
chmod, chown, or delete the sibling `/data/.runner` registration-state file.

### Failed-deployment-gate live-smoke renderer

```text
deploy/gitea/tests/render-deploy-failure-gate-smoke.sh \
  ci-smoke-fail-gate-<16-lowercase-hex>
```

Exactly one branch argument is required, and it must match
`^ci-smoke-fail-gate-[0-9a-f]{16}$`. Invalid arity, a wildcard, `main`, or any
other branch returns `64` and writes no partial workflow to stdout. The command
only renders YAML; it never creates a worktree, installs a workflow, commits,
pushes, or calls Gitea.

The rendered workflow has the production job IDs, `runs-on` labels, `needs`,
and job-level `if` topology, but replaces all real work with bounded local
sentinels:

```text
backend(failure:86) -> verify(failure) -> build_deploy(skipped)
                                          \
                                           -> notify(success)
```

It contains no `uses:`, secret expression, URL, network command, Docker build
or publication command, Registry/Gateway reference, or external notification.
Its `build_deploy` unreachable sentinel uses POSIX `sh`, because the locked
Docker job image does not include Bash.

### Internal PR live-smoke API

```http
POST /api/v1/repos/{owner}/{repo}/pulls
Content-Type: application/json

{
  "title": "WIP: <reviewed smoke title>",
  "head": "<same-repository source branch>",
  "base": "main",
  "body": "<exact SHA and no-merge/no-Gateway boundary>",
  "allow_maintainer_edit": false
}
```

Gitea 1.26.4's live `CreatePullRequestOption` does not expose a `draft` request
field. Use the configured `WIP:` title convention and require the create
response and later GET to report `draft=true`, the exact head/base SHAs,
`merged=false`, and `allow_maintainer_edit=false`. Never print or persist the
root-only API credential while recording this evidence.

### External Fork live-smoke APIs

The isolation smoke uses a disposable private fork and exact, one-shot API
mutations. On the deployed Gitea 1.26.4 instance, a newly created fork defaults
to `has_actions=false`; this is not Runner-isolation evidence. After separate
operator approval, enable Actions on the disposable fork only:

```http
PATCH /api/v1/repos/{temporary-user}/{fork}
Content-Type: application/json

{"has_actions":true}
```

The response must be HTTP `200` and a later GET must report
`has_actions=true`. Create the smoke branch from an exact reviewed commit,
then add one marker file:

```http
POST /api/v1/repos/{temporary-user}/{fork}/branches
{"new_branch_name":"smoke/<reviewed-name>","old_ref_name":"<40-hex-base>"}

POST /api/v1/repos/{temporary-user}/{fork}/contents/<marker-path>
{"branch":"smoke/<reviewed-name>","content":"<base64>","message":"<reviewed-message>"}
```

The external WIP PR create body uses `allow_maintainer_edit`, not
`maintainer_can_modify`. The latter is silently ignored by this deployed
version and can leave the new PR at the default `true` value.

```http
POST /api/v1/repos/{owner}/{repo}/pulls

{
  "title":"WIP: <reviewed external-fork smoke>",
  "head":"<temporary-user>:smoke/<reviewed-name>",
  "base":"main",
  "allow_maintainer_edit":false
}
```

A successful create returns HTTP `201`; require the response and a later GET to
report `allow_maintainer_edit=false`. If an already-created PR used the ignored
field, do not replay the create. Reconcile the exact PR, then perform at most one
approved correction using the live edit schema:

```http
PATCH /api/v1/repos/{owner}/{repo}/pulls/{index}
Content-Type: application/json

{"allow_maintainer_edit":false}
```

On this deployed version the edit returns HTTP `201`; a later GET must confirm
the field is false.

To test status-write isolation, the disposable user's PAT may attempt exactly
one non-required sentinel context against the unique SHA:

```http
POST /api/v1/repos/{owner}/{repo}/statuses/{unique-sha}

{
  "state":"pending",
  "context":"runner-fork-smoke / forbidden",
  "description":"permission-boundary probe"
}
```

The deployed live-smoke returned HTTP `403`; accept only `403` or `404` and
require a zero-row API/DB readback. Never probe either real required context.

## 3. Contracts

### Workflow topology

| Event | Required job graph | Protected context |
| --- | --- | --- |
| Non-`main` push | `ci: backend -> required` | `ci / required (push)` |
| Non-`main` push | `security: backend -> required` | `security / required (push)` |
| `pull_request` | No trusted Runner workflow | Reuse the internal head-push statuses |
| `main` push | `deploy: backend -> verify -> build_deploy -> notify` | Same-workflow `needs` graph |
| Weekly schedule | `security: backend -> required` | Security checks run once |

The seven gates remain mandatory: backend unit, backend integration, frontend,
lint, shell syntax, backend vulnerability, and frontend production dependency
audit. A downstream Node job must validate the upstream Go result before
checkout or dependency preparation. Release workflow branch/tag behavior is not
changed by this contract.

### Failed-validation live-smoke boundary

The live failure smoke proves Gitea/Runner `needs` and `always()` behavior; it
must not manufacture a failure on real `main` or execute a redacted version of
the production deployment body. Bind the disposable graph to production with
`test-deploy-failure-gate-smoke.sh`, which requires the same four job IDs,
Runner labels, exact `needs`, `verify`/`notify` `always()`, and default
successful-needs gating on `build_deploy`.

Use one reviewed commit descended from the PR head and one exact disposable
branch accepted by the renderer. To prevent an unrelated 15-minute CI/security
run, the disposable commit may add that *exact* branch to the temporary copies
of `ci.yml` and `security.yml` `branches-ignore`; it must make no other change
to those workflows. Add the rendered smoke workflow only on the disposable
branch. Never create a PR or tag, change `main`, add `workflow_dispatch`, or
copy production secrets/build/deploy/notification steps into the smoke.

The only passing observation is:

- the SHA creates exactly one `deploy-failure-gate-smoke` push run with four
  jobs and no CI, security, deploy, or release run;
- `backend` is assigned to the trusted Runner, logs the intentional sentinel,
  and fails with the dedicated exit code `86`;
- `verify` is assigned, observes `needs.backend.result=failure`, and fails its
  production-equivalent hard gate;
- `build_deploy` is `skipped`, receives no Runner task, has no step log, and
  never prints its `UNREACHABLE` sentinel;
- `notify` is assigned despite the failed/skipped dependencies, asserts
  `verify=failure` and `build_deploy=skipped`, logs only the local sentinel, and
  succeeds;
- the workflow conclusion remains `failure`.

This proves final notification *job scheduling* on failure, not delivery to the
real Telegram/Pipedream endpoint. Actual deployment and notification delivery
remain part of the later approved successful-`main` gate.

Before the one-shot push, snapshot branch absence, exact base SHA, `main`/PR
heads, recent runs, Runner/cache/OOM state, and any Registry state used for the
no-publication assertion. After the run, record branch/SHA, workflow hash,
run/job/task IDs, conclusions, sentinel logs, absence of the build task, and
unchanged production state. Delete only the exact remote branch and disposable
local worktree after evidence capture; keep the Gitea run as historical
evidence. An unknown push/delete result requires read-only reconciliation, not
a blind replay.

### Internal PR evidence boundary

Snapshot the exact source and `main` SHAs, existing PRs, head-SHA runs, Runner
idle state, cache size, and latest required contexts before creating the PR.
Opening the reviewed WIP PR must leave the head with only its existing `push`
runs and zero `pull_request` runs. Validate separately that `main` protection
requires exactly `ci / required (push)` and `security / required (push)`, and
that the head's latest statuses for those names are successful.

Those observations prove the event boundary and an exact match between the
head statuses and the protection contract. Do not claim that an API returned a
PR-specific status rollup unless that concrete response field was observed.
Treat opening a PR and later updating its head as separate live gates; a push
while the PR is open must still create only the four expected `push` jobs.

### External Fork evidence and cleanup boundary

Use a non-admin, non-restricted, private temporary user with no organization or
team membership. Give it one direct `read` collaboration on the canonical
repository and one PAT scoped exactly to `write:repository`. Store the random
password, PAT value, Basic/token curl configs, and mutation stage only under a
root-owned mode-`0700` runtime directory; secret files are mode `0600` and are
never printed. Before every non-idempotent retry, reconcile through API and DB
instead of assuming a failed client command means the server mutation failed.

After enabling Actions on the temporary fork, the marker push must create the
expected `ci.yml` and `security.yml` `push` runs. Isolation is proved only when
all of the following hold in the same bounded observation window:

- the fork has no Actions secrets;
- the fork runs and jobs exist for the unique SHA;
- every job remains unassigned (`task_id=0`), no matching `action_task` exists,
  and no task row may record trusted Runner ID `1`;
- the trusted Runner remains repository-scoped to canonical repo ID `1` and
  does not become busy for the fork;
- canonical runs gain no `pull_request` event for the external PR;
- the unique SHA has no status in canonical repo ID `1`, including both
  required contexts;
- a single non-required sentinel status request made with the temporary PAT is
  rejected (`403`/`404`) and produces no canonical API/DB row;
- cache metadata, Runner/DinD identity, restart/OOM state, and
  `memory.events` do not change.

Commit statuses are repository-scoped. Pending contexts created under the fork
repo ID do not satisfy canonical branch protection and must not be reported as
canonical statuses. WIP status is an independent merge blocker, so do not
claim that the PR is unmergeable *because* required contexts are absent; state
the observed context and permission facts and do not attempt a merge.

Close the exact external PR, then delete the exact fork, canonical
collaboration, PAT ID, and temporary user in that order. The deployed API
contract is:

```http
PATCH  /api/v1/repos/{owner}/{repo}/pulls/{index} {"state":"closed"} -> 201
DELETE /api/v1/repos/{temporary-user}/{fork}                         -> 204
DELETE /api/v1/repos/{owner}/{repo}/collaborators/{temporary-user}  -> 204
DELETE /api/v1/users/{temporary-user}/tokens/{token-id}             -> 204
DELETE /api/v1/admin/users/{temporary-user}?purge=true              -> 204
```

Revoke the PAT with the temporary user's Basic credentials before deleting the
user. Treat an unknown mutation result as unresolved and reconcile the exact
object before any retry. Run the full canonical repository verifier afterward,
and delete the runtime directory only after all objects are absent and
non-secret evidence has been recorded. Deleting the fork
cascades its live `action_run`, `action_run_job`, and fork-scoped
`commit_status` rows, so snapshot those IDs and assignment fields before
deletion. After cleanup, distinguish that historical observation from current
live DB state. The closed PR, audit log, PR ref, or unique commit may remain;
never promise zero historical traces.

### Dependency and cache wiring

- Frontend preparation pins Node 20 and pnpm `9.15.9`, sets
  `COREPACK_HOME=/root/.cache/corepack`, and uses
  `pnpm install --frozen-lockfile --prefer-offline`.
- Go caches only `/go/pkg/mod` and `/root/.cache/go-build`.
- Node caches only `/root/.cache/corepack` and
  `/root/.local/share/pnpm/store`.
- Cache keys are exact; do not add `restore-keys`.
- Cache restore/save steps use the full SHA in `.gitea/actions.lock`, set
  `continue-on-error: true`, and log their `cache-hit` output. A cache outage
  must fall back to a correct cold build.
- With `offline_mode: true`, every `uses:` reference must be a full 40-character
  SHA represented in `.gitea/actions.lock`.

### Runner cache boundary

```yaml
runner:
  capacity: 1
  post_task_script: /usr/local/bin/gitea-runner-cache-maintenance
  post_task_script_timeout: 2m
cache:
  enabled: true
  dir: /data/cache/actions
  host: gitea-runner-cache
  port: 8088
  external_server: ""
  external_secret: ""
  offline_mode: true
```

`gitea-runner-cache:8088` is a private Compose-network alias. `compose.yaml` may
use `expose`, but must not publish host port `8088` or attach the cache service
to the public/Gitea platform network.

The maintenance hook requires the exact cache path to be a real directory owned
by `1000:1000`. It clears direct children when size exceeds 20 GiB or filesystem
usage reaches 80%. Production Compose must not set test threshold overrides.

Initialize the shared Runner state volume before recreating the Runner. The
initializer must run as explicit UID/GID `0:0` with all capabilities dropped and
only `DAC_OVERRIDE`, `CHOWN`, and `FOWNER` restored. `CHOWN` changes ownership,
but it does not authorize a later `chmod` after the directory belongs to UID
1000; `FOWNER` is therefore required for the exact `0700` postcondition.
`DAC_OVERRIDE` is required when the idempotent second run traverses the already
normalized `1000:1000` mode-`0700` parents. Do not add broader capabilities,
make the container privileged, or replace the named volume to repair
permissions, because the same volume contains `.runner`.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Upstream Go job fails | Downstream guard fails before checkout/install |
| Cache restore or save fails | Log the miss/error and continue with a cold build |
| Cache key kind/arity is invalid | Exit `64`, print no usable key |
| Cache-key input is missing or a symlink | Exit non-zero |
| Cache root is missing, symlinked, or not owned by `1000:1000` | Exit non-zero and delete nothing |
| Volume initializer is run against an empty volume | Create the missing `/data/cache/actions` path and normalize `/data`, `/data/cache`, and `/data/cache/actions` to `1000:1000` mode `0700` |
| Volume initializer is run again with an existing `.runner` | Succeed with identical directory postconditions and leave `.runner` byte-for-byte and metadata unchanged |
| Initializer omits `FOWNER` after chowning directories to UID 1000 | `chmod` may fail; treat initialization as failed and do not recreate the Runner |
| Cache size `>20 GiB` or filesystem use `>=80%` | Delete direct children only; keep cache root |
| Action ref is floating or absent from lock file | Static workflow contract test fails |
| Host port `8088` is published | Runner configuration test fails |
| A required verification step fails on `main` | Build/deploy must not run; final notification still runs |
| Failure-smoke renderer branch/arity is invalid | Exit `64` and emit no workflow |
| Rendered smoke or production graph fails the static binding | Do not push; fix/review the contract instead of weakening assertions |
| The disposable SHA creates CI/security/deploy/release or more than one smoke run | Treat routing as failed, capture the unexpected runs, and clean the exact branch |
| Failure-smoke `build_deploy` gets a task or prints `UNREACHABLE` | Treat failed-needs propagation as broken; the harmless sentinel exits `99`, and no production endpoint is available |
| Failure-smoke `notify` is skipped or its local assertions fail | Keep final-notification scheduling unproved; do not substitute `if: false` or a soft assertion |
| Scratch push/delete response is unknown | Reconcile the exact branch/SHA/run before deciding whether one retry is safe |
| Live create-PR schema has no `draft` field | Use a reviewed `WIP:` title and assert `draft=true` in the response; do not invent a request field |
| Opening an internal PR adds a `pull_request` run or Runner job | Stop rollout and restore the event graph before merge |
| Head statuses and `main` protection names differ | Treat the protection gate as unproved; do not infer success from PR state or `mergeable` |
| Only PR opening has been observed | Keep PR head-update smoke pending until a later reviewed source push proves zero PR jobs again |
| A new disposable fork reports `has_actions=false` | Stop; do not count the absence of runs as Runner isolation. Obtain separate approval before enabling Actions on that fork only |
| Fork Actions are enabled but no push run appears in the bounded window | Record the failed smoke and clean up; do not modify the trusted Runner or workflow to manufacture evidence |
| A create/update client exits after the server may have mutated | Preserve root-only state and reconcile exact API/DB identity before deciding whether another write is safe |
| External PR creation used `maintainer_can_modify` | Treat the field as ignored; do not replay creation. Reconcile the created PR and, if approved, patch `allow_maintainer_edit=false` exactly once |
| The sentinel request unexpectedly succeeds | Never attempt a required context; record the non-required status as a security finding and continue exact cleanup |
| Fork deletion removes run/job/status live rows | Use the pre-delete snapshot as historical evidence and report the post-delete zero-row state separately |

## 5. Good / Base / Bad Cases

- **Good**: a warm non-`main` push runs four jobs, restores exact Go/pnpm keys,
  executes all seven gates once, and emits both protected contexts.
- **Base**: the cache is empty or unavailable; the same push downloads upstream
  dependencies, passes all gates, and may populate cache afterward.
- **Good (internal PR)**: a WIP Draft PR points at an already successful exact
  head SHA, creates no new workflow run, and its two required head statuses
  match the exact `main` protection context names.
- **Base (PR head update)**: a later reviewed source push updates the open PR;
  exactly four `push` jobs run and no `pull_request` job is created.
- **Good (external fork)**: Actions are temporarily enabled on the disposable
  fork, the marker push creates two real push runs and four unassigned jobs,
  the trusted repo-scoped Runner never receives a task, and a non-required
  canonical status probe is rejected.
- **Base (fork default)**: the new fork has Actions disabled. The smoke stops,
  cleans up, and records no isolation claim until separate approval allows a
  second attempt with fork-only Actions enabled.
- **Good (failed deployment gate)**: one exact disposable branch produces one
  four-job smoke run; backend/verify fail, build/deploy is skipped without a
  task, the local final-notification sentinel succeeds, and production state is
  unchanged.
- **Base (failure smoke preflight)**: an invalid or wildcard branch is rejected
  locally with exit `64` and no YAML, so no Gitea mutation is attempted.
- **Bad**: a fork PR, floating Action tag, published cache port, cache-root
  symlink, failed upstream gate gains access to later trusted work, or a failure
  experiment contains a production secret/network step. Static or live
  validation must reject each case.

## 6. Tests Required

Run these repository checks for every related change:

```text
deploy/gitea/tests/test-ci-dispatcher.sh
deploy/gitea/tests/test-ci-cache-key.sh
deploy/gitea/tests/test-deploy-failure-gate-smoke.sh
deploy/gitea/tests/test-workflow-contract.sh
deploy/gitea/runner/tests/test-cache-maintenance.sh
deploy/gitea/runner/tests/test-runner-config.sh
deploy/gitea/runner/tests/smoke-rootless-dind.sh
./tools/gitea-ci.sh shell-syntax
```

Assertions must cover command failure propagation, one frontend install in
`frontend-all`, exact key inputs and arity, immutable Action refs, event/job
counts and dependency order, no host cache port, cache cleanup thresholds and
path/owner guards, restricted-capability volume initialization, two consecutive
initializer runs preserving `.runner` content and metadata, and DNS/HTTP
reachability from a real rootless DinD job. `test-workflow-contract.sh` must
invoke `test-deploy-failure-gate-smoke.sh`; the latter must reject unsafe
renderer source/output, non-exact branches, graph/Runner-label drift, a
job-level `if` on production `build_deploy`, and any difference in the
production/smoke `needs` topology.

Repository tests do not replace live Gitea validation. Before rollout is
considered complete, verify branch/tag routing, exact protected contexts, cold
fallback, save/restore/hit behavior, failure blocking, final notification,
host/public port exposure, cleanup invocation, timing, and memory/OOM behavior.
For the PR boundary, record opening and head-update observations separately:
exact SHAs, run IDs/events/counts, latest required statuses, protection context
names, Runner/cache state, and the absence of `pull_request` work. PR `draft` or
`mergeable` alone is not proof that required statuses matched.

For an external-fork smoke, record the temporary repo/user/PAT IDs without
their secret values, fork `has_actions` transition, exact base/unique SHAs,
fork run/job IDs, pre-delete job/task assignment rows, fork secret names,
canonical status count, sentinel HTTP result, cache/Runner/OOM invariants, PR
state, every cleanup HTTP result, and the post-cleanup full verifier. Assert
both states around fork deletion: the required run/job/status rows existed
before deletion, and their live fork-scoped rows no longer exist afterward.

For a failed-deployment-gate smoke, record the reviewed patch hash, exact
branch/base/unique SHA, the single run and four job/task IDs, expected
failure/failure/skipped/success conclusions, the intentional and final local
sentinels, absence of the unreachable build sentinel/task/log, route counts,
and production/Runner/cache/OOM invariants before and after exact branch
cleanup. Do not report the local `notify` sentinel as real message delivery.

## 7. Wrong vs Correct

### Wrong

```yaml
on:
  workflow_dispatch:
jobs:
  build_deploy:
    if: false
    env:
      DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
```

This both weakens the test and widens its blast radius: `if: false` does not
exercise Gitea's default failed-needs propagation, while copying a production
secret makes an unexpected scheduler result dangerous.

```yaml
on: [push, pull_request]
cache:
  host: 127.0.0.1
ports:
  - "8088:8088"
```

This duplicates trusted work for internal PRs, schedules fork PRs on the trusted
Runner, points nested jobs at the wrong network namespace, and exposes the cache
on the host.

```json
{
  "title": "CI smoke",
  "head": "unreviewed-branch",
  "base": "main",
  "draft": true
}
```

This invents a field absent from Gitea 1.26.4's live create-PR schema, omits the
reviewed exact-SHA/no-merge boundary, and cannot by itself prove anything about
Runner dispatch or protected contexts.

```json
{
  "title": "WIP: external smoke",
  "head": "temporary-user:smoke/fork-boundary",
  "base": "main",
  "maintainer_can_modify": false
}
```

This uses the wrong Gitea field. The request may still create a PR with
maintainer editing enabled, so replaying the create request can duplicate the
PR. Reconcile the returned/created PR and use the live edit schema instead.

```bash
docker run --rm --network none --read-only --user 0:0 \
  --cap-drop ALL \
  --cap-add DAC_OVERRIDE --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount type=volume,src=gitea-runner-data,dst=/data \
  "$APP_ALPINE_IMAGE" sh -ec '
    mkdir -p /data/cache/actions
    chown 1000:1000 /data /data/cache /data/cache/actions
    chmod 0700 /data /data/cache /data/cache/actions
  '
```

After `chown`, UID 0 no longer owns the directory and has neither `FOWNER` nor
the full root capability set, so the `chmod` is not a valid deployment contract.

### Correct

```text
render-deploy-failure-gate-smoke.sh \
  ci-smoke-fail-gate-0123456789abcdef

backend(failure) -> verify(failure) -> build_deploy(skipped)
                                      -> notify(local assertion succeeds)
```

The exact disposable branch and sanitized workflow test the same job topology
without a production endpoint. Static binding plus live job/task evidence is
required; neither half alone closes the compatibility gate.

```yaml
on:
  push:
    branches-ignore: [main]
cache:
  host: gitea-runner-cache
expose:
  - "8088"
```

An internal PR opening creates no new trusted workflow work, and its head's
push-status names match the exact protection contract. Rootless DinD jobs reach
the cache through its private network alias without a host-published port.

```json
{
  "title": "WIP: ci: reviewed single-Runner smoke",
  "head": "reviewed-source-branch",
  "base": "main",
  "body": "Exact head/base SHA; do not merge main or operate Gateway.",
  "allow_maintainer_edit": false
}
```

Create exactly once after fail-closed SHA/status preconditions, then assert the
returned Draft/head/base fields and prove zero additional `pull_request` runs.
Compare the head's latest two required statuses with the exact `main` protection
context set instead of inferring that relationship from PR mergeability.

```json
{
  "title": "WIP: external fork Runner-boundary smoke",
  "head": "temporary-user:smoke/fork-boundary",
  "base": "main",
  "allow_maintainer_edit": false
}
```

Enable Actions only on the disposable fork, require real fork push runs with
unassigned jobs, and send at most one non-required sentinel status request.
Snapshot fork-scoped run/job/status rows before exact cleanup; never use their
later cascade deletion to claim that no run was created.

```bash
docker run --rm --network none --read-only --user 0:0 \
  --cap-drop ALL \
  --cap-add DAC_OVERRIDE --cap-add CHOWN --cap-add FOWNER \
  --security-opt no-new-privileges:true \
  --mount type=volume,src=gitea-runner-data,dst=/data \
  "$APP_ALPINE_IMAGE" sh -ec '
    mkdir -p /data/cache/actions
    chown 1000:1000 /data /data/cache /data/cache/actions
    chmod 0700 /data /data/cache /data/cache/actions
    test "$(stat -c "%u:%g %a" /data)" = "1000:1000 700"
    test "$(stat -c "%u:%g %a" /data/cache)" = "1000:1000 700"
    test "$(stat -c "%u:%g %a" /data/cache/actions)" = "1000:1000 700"
  '
```

The least-capability initializer can enforce the owner/mode postcondition while
leaving the existing registration file outside its mutation set.
