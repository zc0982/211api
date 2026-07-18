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
as idle:

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
```
