# Self-hosted Gitea operations

This directory is the reviewed source of truth for the private Gitea control
plane on Netcup. It does not run the 211API application; production remains on
Gateway in Los Angeles.

All image references come from `images.lock.env`. Never run these Compose files
through an implicit `.env` file, and never copy the production application
`.env` to Netcup or Gitea.

## Platform host layout

Install the tracked platform files below `/opt/gitea/platform`, the image lock
as `/opt/gitea/images.lock.env`, and create these host-owned paths:

| Path | Owner/mode | Purpose |
| --- | --- | --- |
| `/etc/gitea/platform.env` | `root:root 0600` | paths and non-secret operational configuration |
| `/etc/gitea/db-password` | `root:root 0600` | PostgreSQL/Gitea database password |
| `/etc/gitea/secret-key` | `root:root 0600` | Gitea secret key |
| `/etc/gitea/internal-token` | `root:root 0600` | Gitea internal token |
| `/etc/gitea/backup-api.curl` | `root:root 0600` | curl config for the backup reader token |
| `/etc/gitea/backup-notify-url` | `root:root 0600` | external HTTPS failure webhook URL |
| `/etc/gitea/runner-registration-token` | `root:root 0600` | short-lived Runner registration-token source |
| `/opt/gitea/platform/log` | numeric `1000:1000 0750` | bounded Gitea authentication logs |
| `/opt/gitea/backups` | `root:root 0700` | local encrypted backup sets |

Create the host directories before installing configuration:

```bash
sudo install -d -o root -g root -m 0700 /etc/gitea /opt/gitea/backups
sudo install -d -o 1000 -g 1000 -m 0750 /opt/gitea/platform/log
```

## Secret material

Run each secret operation with a restrictive umask. The commands write only to
the paths listed above; do not paste values into Compose or this repository.

```bash
umask 077
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/gitea/db-password'
```

```bash
umask 077
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/gitea/secret-key'
```

```bash
umask 077
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/gitea/internal-token'
```

```bash
umask 077
sudo install -o root -g root -m 0600 /dev/null /etc/gitea/backup-notify-url
sudoedit /etc/gitea/backup-notify-url
```

The `age` private identity stays in operator custody and must never be stored on
Netcup. Put only its public `age1…` recipient in `platform.env`. Record the
recipient SHA-256 separately; restore compares it with both the backup manifest
and the custody record.

After Gitea initialization, create a dedicated non-admin account
`svc-backup-read` and a token limited to user/repository/package read access. Store
the token only in `/etc/gitea/backup-api.curl`, as one curl `Authorization:
token` header directive. The account must be able to read the private
`211api/211api` repository, its Actions runs, releases, and container packages;
it must not have write, administration, or production-deploy rights.

```bash
umask 077
sudo install -o root -g root -m 0600 /dev/null /etc/gitea/backup-api.curl
sudoedit /etc/gitea/backup-api.curl
```

Create `/etc/gitea/platform.env` with exactly one assignment for each required
name. The three Gitea secret variables and `GITEA_BACKUP_API_CONFIG` contain
absolute file paths; `BACKUP_AGE_RECIPIENT` contains only the public recipient:

- `GITEA_DB_PASSWORD_FILE`
- `GITEA_SECRET_KEY_FILE`
- `GITEA_INTERNAL_TOKEN_FILE`
- `GITEA_BACKUP_API_CONFIG`
- `BACKUP_AGE_RECIPIENT`

```bash
umask 077
sudo install -o root -g root -m 0600 /dev/null /etc/gitea/platform.env
sudoedit /etc/gitea/platform.env
```

## Validate and operate the platform

Every platform command supplies both explicit environment files:

```bash
sudo docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml config --quiet
```

```bash
sudo docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml up -d secret-init postgres gitea caddy
```

```bash
sudo docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml stop -t 60 caddy gitea postgres
```

The stack publishes only Netcup IPv4 ports 80, 443, and 2222. PostgreSQL and
Gitea HTTP remain on the private Compose network. `secret-init` is a completed
one-shot boundary: it stages the root-only source files as UID/GID 1000 mode
0400 in a named volume, which Gitea mounts read-only.

## Isolated Runner

The Runner project has exactly two long-running services. `docker` is the only
privileged service and runs the locked rootless DinD image as numeric
1000:1000. `runner` is unprivileged, has no host Docker socket or host-path data
mount, and talks only to `/run/user/1000/docker.sock` in the named runtime tmpfs.
The explicit `dockerd` command prevents the locked image entrypoint from adding
a TCP listener; `--group=root` makes RootlessKit expose deterministic outer
1000:1000 socket ownership. The accepted socket modes are 0660 and the observed
01660 variant, where the extra sticky bit has no socket-file access effect; both
deny all `other` access. Existing `.runner` state must be a nonempty regular,
non-symlink file owned 1000:1000 before it can bypass registration.

The pinned Runner 2.1.0 source contract is tag `v2.1.0`, commit
`ad967330a8788c9b8ab723abbc1a86d53c3bc5e6`: configuration fields come from
`internal/pkg/config/config.go`, colon-bearing labels from
`internal/pkg/labels/labels.go`, and the external daemon socket handoff from
`internal/app/run/runner.go` plus `act/runner/run_context.go`. The locked DinD
entrypoint at `/usr/local/bin/dockerd-entrypoint.sh` is also treated as code:
the disposable smoke inspects its effective command, rootless security option,
socket, listeners, and mounts instead of relying on image documentation.

Runner project, volume, and network names are fixed in Compose so backup and
restore cannot drift through an environment override. No Runner environment
file exists: the registration token and its source path stay outside Compose.
Define a shell helper so every operation supplies the reviewed image lock. The
lock is non-secret and root-owned; sourcing it makes the locked utility image
available to the one-off volume operations below.

```bash
runner_compose() {
  sudo docker compose \
    --env-file /opt/gitea/images.lock.env \
    -f /opt/gitea/runner/compose.yaml "$@"
}
set -a
. /opt/gitea/images.lock.env
set +a
runner_compose config --quiet
```

Initialize only the persistent Runner state volume. This utility container is
networkless and non-privileged; it does not initialize DinD data or any host
path.

```bash
sudo docker volume create gitea-runner-data >/dev/null
sudo docker run --rm --network none --read-only \
  --cap-drop ALL --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount type=volume,src=gitea-runner-data,dst=/data \
  "$APP_ALPINE_IMAGE" sh -ec '
    chmod 0700 /data
    chown 1000:1000 /data
    test "$(stat -c "%u:%g" /data)" = 1000:1000
  '
```

Start DinD first and apply a bounded health deadline. Then prove an external
locked CLI container can reach only the shared Unix socket. No port is
published even though the upstream image declares TCP ports in image metadata.

```bash
runner_compose up -d --wait --wait-timeout 120 docker
sudo docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount type=volume,src=gitea-runner-runtime,dst=/run/user/1000 \
  -e DOCKER_HOST=unix:///run/user/1000/docker.sock \
  "$DOCKER_CLI_IMAGE" info --format '{{json .SecurityOptions}}'
```

Generate a repository- or organization-scoped registration token only after
Gitea is ready. Write the command output directly to the fixed root-owned mode
0600 source file; never put the value in a shell variable, Compose environment,
command argument, terminal output, or Git. Before staging, verify the source
metadata without reading it:

```bash
sudo test -f /etc/gitea/runner-registration-token
sudo test ! -L /etc/gitea/runner-registration-token
sudo test "$(sudo stat -c '%u:%g %a' \
  /etc/gitea/runner-registration-token)" = '0:0 600'
```

Compose file-backed secrets cannot remap that source for UID 1000. Copy it
briefly into the existing runtime tmpfs with the locked utility image instead.
DinD must already be running: as the long-lived mount holder it preserves this
local-driver tmpfs across the one-off staging and verification containers.
The only added capabilities permit access to the mode-0700 tmpfs and ownership
assignment; the container is still non-privileged, networkless, and read-only.

```bash
sudo docker run --rm --network none --read-only \
  --cap-drop ALL --cap-add DAC_OVERRIDE --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount type=bind,src=/etc/gitea/runner-registration-token,dst=/source-token,readonly \
  --mount type=volume,src=gitea-runner-runtime,dst=/runtime \
  "$APP_ALPINE_IMAGE" sh -ec '
    partial=/runtime/.runner-registration-token.partial
    target=/runtime/runner-registration-token
    trap "rm -f \"$partial\"" EXIT HUP INT TERM
    test -f /source-token
    test ! -L /source-token
    test "$(stat -c "%u:%g %a" /source-token)" = "0:0 600"
    test -s /source-token
    rm -f "$partial"
    cp /source-token "$partial"
    chmod 0400 "$partial"
    chown 1000:1000 "$partial"
    mv -f "$partial" "$target"
    test "$(stat -c "%u:%g %a" "$target")" = "1000:1000 400"
  '
```

Start Runner, require registration state within a finite deadline, and then
remove the staged token immediately. The persistent `.runner` file contains the
registration state; the short-lived source token does not enter that volume.

```bash
finish_runner_registration() {
  local registered=0 runner_id
  runner_compose up -d runner || return 1
  for _attempt in $(seq 1 120); do
    if runner_compose exec -T runner test -s /data/.runner; then
      registered=1
      break
    fi
    sleep 1
  done

  # Remove the tmpfs copy on both success and timeout.
  sudo docker run --rm --network none --read-only \
    --cap-drop ALL --cap-add DAC_OVERRIDE \
    --security-opt no-new-privileges:true \
    --mount type=volume,src=gitea-runner-runtime,dst=/runtime \
    "$APP_ALPINE_IMAGE" sh -ec '
      rm -f /runtime/runner-registration-token
      test ! -e /runtime/runner-registration-token
    ' || return 1

  if [ "$registered" != 1 ]; then
    runner_compose stop -t 30 runner || true
    printf 'Runner registration deadline exceeded; staged token removed.\n' >&2
    return 1
  fi
  runner_id="$(runner_compose ps -q runner)" || return 1
  test -n "$runner_id" || return 1
  test "$(sudo docker inspect -f '{{.Config.User}}' "$runner_id")" = \
    1000:1000
}
finish_runner_registration
unset -f finish_runner_registration
```

After the Runner is online, rotate or revoke the bootstrap registration token
in Gitea, then delete only `/etc/gitea/runner-registration-token`. Keeping the
source outside `/opt/gitea/runner` prevents the host-manifest backup from
capturing it during the short registration window. Subsequent Runner restarts
use the persistent registration state and require no staged token.

## Backups and notification

The backup script refuses concurrent execution, checks NTP, TLS validity,
health, webhook delivery, active Actions, and disk headroom, then quiesces the
writer services. It streams every database/archive component through validation
and `age`; only ciphertext partials exist on disk before atomic promotion.

The webhook must be an HTTPS endpoint returning 2xx. It receives only the fixed
bounded notification schema; no token, repository data, URL, or command output
is included. A daily preflight event proves delivery before any service is
stopped. `/opt/gitea/backups/FAILED` remains until a later fully validated
backup succeeds.

Before the runner exists, a bootstrap backup may treat an absent/stopped runner
as idle. It still requires the dedicated backup-reader API curl config; this
mode is for a bootstrapped but repository-empty Gitea, not an uninitialized
instance:

```bash
sudo /opt/gitea/platform/gitea-backup --bootstrap
```

Normal and pre-upgrade backups are explicit:

```bash
sudo /opt/gitea/platform/gitea-backup --daily
sudo /opt/gitea/platform/gitea-backup --upgrade
```

Local retention keeps seven daily sets, four weekly selections, the newest
known-good set, all upgrade predecessors, and any leased/referenced restore set.
This is not an off-host backup: total Netcup disk loss remains an accepted,
recorded residual risk until a destination is separately approved.

Install and enable the timer only after a manual validated backup and webhook
test pass:

```bash
sudo install -o root -g root -m 0644 \
  /opt/gitea/platform/systemd/*.service \
  /opt/gitea/platform/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gitea-backup.timer
sudo systemctl list-timers gitea-backup.timer
```

The timer runs at 18:30 UTC every day with persistent catch-up and no randomized
delay.

## Isolated restore drill

Use only a `.validated` backup ID. Mount the operator-held private identity on a
root-only tmpfs, and prepare a root-owned mode-0600 JSON custody record with
schema `age-key-custody.v1`, the exact `backup_id`, nonempty `custodian`, UTC
`mounted_at`, and the SHA-256 `recipient_id`. The custody record must contain no
private key text.

```bash
umask 077
sudo install -d -o root -g root -m 0700 /run/gitea-operator-key
sudo mount -t tmpfs -o size=1m,mode=0700,nosuid,nodev,noexec \
  tmpfs /run/gitea-operator-key
```

After placing the identity and custody record at operator-selected absolute
paths with mode 0600, run:

```bash
sudo /opt/gitea/platform/gitea-restore-drill \
  --backup-id "$BACKUP_ID" \
  --identity "$TMPFS_IDENTITY_PATH" \
  --custody-record "$CUSTODY_RECORD_PATH"
```

The script requires an interactive confirmation containing the exact backup ID,
adds a bounded retention lease, creates only run-labelled temporary volumes and
an internal network, and publishes Gitea only on a transient loopback port. It
verifies PostgreSQL restore, the non-admin backup identity, exact heads/tags,
release metadata, package metadata, and each OCI/Docker manifest through the
isolated Registry endpoint, then removes only resources bearing its run
label and unmounts its own key copy. Finally unmount the operator-owned source
tmpfs separately.

## Local repository checks

The repository test scripts use dummy mode-0600 files only:

```bash
deploy/gitea/platform/tests/test-platform-config.sh
deploy/gitea/platform/tests/test-strict-env.sh
deploy/gitea/platform/tests/test-tar-validator.sh
deploy/gitea/platform/tests/test-backup-primitives.sh
deploy/gitea/platform/tests/test-restore-primitives.sh
deploy/gitea/platform/tests/test-retention.sh
deploy/gitea/platform/tests/test-caddy-redaction.sh
deploy/gitea/platform/tests/test-systemd-units.sh
deploy/gitea/runner/tests/test-runner-config.sh
deploy/gitea/runner/tests/test-registration-token-lifecycle.sh
deploy/gitea/runner/tests/smoke-rootless-dind.sh
```

The DinD smoke uses unique project, network, and volume names, proves rootless
security options, socket ownership/mode, absence of TCP listeners and published
ports, and runs a locked inner Alpine container as UID/GID 65534 with a read-only
root filesystem and no capabilities. Its trap removes only those unique
resources. It exercises only Runner's negative startup branches; real token
consumption, registration, job socket injection, and Gitea protocol compatibility
remain mandatory live gates in Task 11.
