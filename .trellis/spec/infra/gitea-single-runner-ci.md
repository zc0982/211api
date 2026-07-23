# Gitea Single-Runner CI Contract

## 1. Scope / Trigger

Use this contract whenever changing `.gitea/workflows/`, `.gitea/actions.lock`,
`tools/gitea-ci.sh`, `tools/gitea-cache-key.sh`, or `deploy/gitea/runner/`.

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

## 5. Good / Base / Bad Cases

- **Good**: a warm non-`main` push runs four jobs, restores exact Go/pnpm keys,
  executes all seven gates once, and emits both protected contexts.
- **Base**: the cache is empty or unavailable; the same push downloads upstream
  dependencies, passes all gates, and may populate cache afterward.
- **Bad**: a fork PR, floating Action tag, published cache port, cache-root
  symlink, or failed upstream gate gains access to later trusted work. Static or
  live validation must reject each case.

## 6. Tests Required

Run these repository checks for every related change:

```text
deploy/gitea/tests/test-ci-dispatcher.sh
deploy/gitea/tests/test-ci-cache-key.sh
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
reachability from a real rootless DinD job.

Repository tests do not replace live Gitea validation. Before rollout is
considered complete, verify branch/tag routing, exact protected contexts, cold
fallback, save/restore/hit behavior, failure blocking, final notification,
host/public port exposure, cleanup invocation, timing, and memory/OOM behavior.

## 7. Wrong vs Correct

### Wrong

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

```yaml
on:
  push:
    branches-ignore: [main]
cache:
  host: gitea-runner-cache
expose:
  - "8088"
```

Internal PRs consume their head-push statuses, while rootless DinD jobs reach
the cache through its private network alias without a host-published port.

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
