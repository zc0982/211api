# Self-hosted Gitea operations

This directory is the reviewed source of truth for the private Gitea control
plane on Netcup. It does not run the 211API application; production remains on
Gateway in Los Angeles.

All image references come from `images.lock.env`. Never run these Compose files
through an implicit `.env` file, and never copy the production application
`.env` to Netcup or Gitea.

For a new host, the operational order is: start and validate the platform;
complete **Repository bootstrap and controls** through `--base`; install and
register the isolated Runner; run a validated bootstrap backup; then execute
the later live gates before activating `main`. The headings below are grouped
by implementation owner, so follow this order rather than reading them as one
linear command transcript.

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
| `/etc/gitea/backup-notify-url` | `root:root 0600` | opaque Pipedream HTTPS endpoint for backup failures |
| `/etc/gitea/runner-registration-token` | `root:root 0600` | short-lived Runner registration-token source |
| `/etc/gitea/bootstrap.env` | `root:root 0600` | data-only bootstrap human identity |
| `/etc/gitea/admin-api.curl` | `root:root 0600` | bootstrap administrator API token directive |
| `/etc/gitea/admin-api.metadata.json` | `root:root 0600` | administrator token scopes and 30-day rotation gate |
| `/etc/gitea/bootstrap-credentials` | `root:root 0700` | one-time passwords; only release-tag survives to its SSH gate |
| `/etc/gitea/tokens` | `root:root 0700` | split service PAT values, one file per authority |
| `/etc/gitea/token-metadata` | `root:root 0700` | non-value PAT ID/scope/rotation/revocation records |
| `/opt/gitea/platform/log` | numeric `1000:1000 0750` | bounded Gitea authentication logs |
| `/opt/gitea/backups` | `root:root 0700` | local encrypted backup sets |
| `/opt/gitea/host` | `root:root 0755` | reviewed Netcup firewall/Fail2ban installer and sources |

Create the host directories before installing configuration:

```bash
sudo install -d -o root -g root -m 0700 /etc/gitea /opt/gitea/backups
sudo install -d -o 1000 -g 1000 -m 0750 /opt/gitea/platform/log
```

## Netcup host controls

Install `deploy/gitea/host` at `/opt/gitea/host` with root ownership, excluding
tests and generated files. The installer writes only reviewed files through
atomic replacements, records their SHA-256 values under `/etc/gitea`, and
serializes concurrent installer runs. It leaves the Gitea jail disabled until
`--enable-gitea` proves a non-empty, regular, numeric `1000:1000` log in the
canonical mode-0750 log directory. Run it only from the canonical directory:

```bash
sudo /opt/gitea/host/install-netcup-host-controls
sudo fail2ban-client -t
sudo systemctl daemon-reload
sudo systemctl restart fail2ban.service
```

After `--enable-gitea` has installed the explicit enable override, every later
installer run must repeat `--enable-gitea`. A default run then refuses rather
than silently preserving or disabling an already-live jail.

The SSH jail uses the systemd backend, port 4422, five attempts per ten-minute
window, and a one-hour ban. Confirm its effective action no longer resolves to
the packaged `ssh`/22 default:

```bash
sudo fail2ban-client status sshd
sudo fail2ban-client -d | grep -E "sshd.*|dports 4422"
```

Preserve the existing 4422 IPv4/IPv6 UFW rules and default
`deny incoming`/`deny routed` policy. Add only these IPv4 rules; the explicit
destination prevents UFW from creating raw-IPv6 Gitea exposure:

```bash
sudo ufw allow in on ens3 proto tcp from 0.0.0.0/0 \
  to 37.221.194.27 port 80 comment 'gitea-http-v4'
sudo ufw allow in on ens3 proto tcp from 0.0.0.0/0 \
  to 37.221.194.27 port 443 comment 'gitea-https-v4'
sudo ufw allow in on ens3 proto tcp from 0.0.0.0/0 \
  to 37.221.194.27 port 2222 comment 'gitea-ssh-v4'
sudo ufw reload
```

Docker diverts published traffic before UFW's host input rules, so the
versioned guard is also mandatory. It atomically owns only `GITEA-GUARD` and
`GITEA6-GUARD`; it never flushes Docker, UFW, Fail2ban, or another administrator
chain. It permits Docker's canonical terminal `RETURN` only after the guard and
inserts the guard before it when present. IPv4 matches the original conntrack
destination after DNAT, accepts 80/443, rate-limits new 2222 connections per
source to 30/minute with burst 20, and drops every other external forwarded
flow. It deliberately returns traffic that did not enter on `ens3`, so
container-to-container, host health probes, and container egress remain under
Docker's own network owner. IPv6 publishes remain closed.

```bash
sudo systemctl enable --now gitea-netcup-firewall.service
sudo /usr/local/sbin/gitea-netcup-firewall verify
sudo iptables -S DOCKER-USER
sudo ip6tables -S DOCKER-USER
```

The unit is `PartOf=docker.service`: a Docker restart replays and verifies the
guard, waits up to ten seconds for Fail2ban's socket before reloading it so its
jump stays before the guard, and fails closed on an unknown `DOCKER-USER` rule
or checksum drift. During first preparation, restart Docker exactly once and
then use `systemctl start` to join/wait for the dependency job before re-running
all four commands above plus the preserved-service checks. `restart docker`
can return while its wanted guard is still briefly `activating`:

```bash
sudo systemctl restart docker.service
sudo systemctl start gitea-netcup-firewall.service
sudo systemctl is-active gitea-netcup-firewall.service
sudo /usr/local/sbin/gitea-netcup-firewall verify
```

If the Fail2ban reload fails after the guard was applied, systemd deliberately
leaves the unit failed while the restrictive guard remains installed. Repair
Fail2ban, restart this unit, and require both the unit and its explicit `verify`
command to pass; do not treat that partial fail-closed state as completion.

After Gitea has a stable `/opt/gitea/platform/log/gitea.log`, validate the
checked-in filter against a TEST-NET synthetic line before enabling its jail:

```bash
sudo fail2ban-regex \
  '2026-07-18 00:00:00 [W] Failed authentication attempt from 192.0.2.1:4242' \
  /opt/gitea/host/fail2ban/filter.d/gitea-auth.conf
sudo /opt/gitea/host/install-netcup-host-controls --enable-gitea
sudo fail2ban-client -t
sudo systemctl restart fail2ban.service
sudo fail2ban-client status gitea-auth
```

The Gitea jail explicitly selects `iptables-multiport`, sets its independent
`chain = DOCKER-USER` interpolation, and uses port 2222. The Compose mapping is
2222:2222, so the post-DNAT destination port remains exact. The filter text is
tied to Gitea v1.26.4's standard `Failed authentication attempt` log messages.

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

Do not create or edit `/etc/gitea/backup-notify-url` until the Pipedream
workflow has passed the masked tests under **Pipedream to Telegram adapter**.
Install the endpoint from the operator machine over SSH stdin; never put it in
Git, chat, a screenshot, shell history, or a command argument.

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

On a new host, complete **Repository bootstrap and controls** below through its
`--base` verification before generating a repository-scoped Runner token; the
section order follows implementation-task ownership, not first-install order.

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

JavaScript Actions execute `node` inside the selected job container. The
digest-locked Go image does not contain that runtime, so the `go-1.26.5` label
uses the private `GO_ACTIONS_CI_IMAGE` package instead. Its reviewed
`go-actions.Dockerfile` copies only Node 24.18.0 plus its license/readme/changelog
from `NODE_ACTIONS_BASE_IMAGE` into `GO_CI_IMAGE`; it installs no package and
retains the exact Go toolchain. Both bases, the published image, and its
Dockerfile checksum label are immutable inputs. A missing package is a stop:
never remap the label to the plain Go image or install Node during a workflow.
The repository-wide Runner environment sets `GOFLAGS=-p=1`, limiting Go's
package build parallelism while leaving test semantics unchanged. Live cold
builds proved that 3 GiB was insufficient even after serialization because the
single `internal/service` compiler process crossed that cgroup; DinD therefore
has a still-bounded 4 GiB limit. Runner capacity remains one, and no workflow or
business package receives a resource-specific branch. The separate cold source
build of `golangci-lint` has a compiler-internal concurrency peak, so only that
fixed-version `go install` and the linter process run with `GOMAXPROCS=1`. A
live cold build of v2.9.0 with Go 1.26.5 completed inside the 4 GiB boundary;
the first unrestricted linter analysis still exhausted that boundary, so the
same compiler-internal limit also owns package loading and analysis. Business
tests keep their normal runtime.

Docker-label jobs also execute JavaScript Actions and every normal `run` step
uses Bash, while the locked public Docker CLI image contains neither Node nor
Bash. The `docker-29.6.1` label therefore uses the private digest-locked
`DOCKER_ACTIONS_CI_IMAGE`: it starts from the locked Node 24.18.0 Alpine image
and copies only `/usr/local/bin/docker` plus the buildx/compose CLI plugins from
`DOCKER_CLI_IMAGE`. The first deploy/release step explicitly uses `sh` to
install Bash and the other reviewed helpers before checkout or Bash steps run.
A missing private package is a stop; never remap the label to the plain Docker
CLI image.

Testcontainers needs two explicit values only for Gitea Actions jobs. Rootless
DinD publishes ports in its parent network namespace, not at either inner
Docker bridge gateway. The Gitea workflows explicitly set `GITEA_CI=true` on
the integration step; only under that repository-owned marker does the
dispatcher export the stable outer Compose service name `docker` as
`TESTCONTAINERS_HOST_OVERRIDE` and `/run/user/1000/docker.sock` as
`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, so Ryuk mounts the actual DinD-side
socket. Existing conflicting overrides fail closed. Local runs retain
Testcontainers' native discovery; Ryuk stays enabled, per-job networks stay
isolated, and no Docker TCP endpoint is added.

Runner project, container, volume, and network names are fixed in Compose so
backup, inspection, and restore cannot drift through an environment override.
The exact container names are `gitea-runner` and `gitea-runner-docker`. No
Runner environment file exists: the registration token and its source path stay
outside Compose.
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
runner_compose pull docker runner
sudo docker pull "$DOCKER_CLI_IMAGE"
sudo docker pull "$APP_ALPINE_IMAGE"
for image in "$DIND_IMAGE" "$RUNNER_IMAGE" "$DOCKER_CLI_IMAGE" \
  "$APP_ALPINE_IMAGE"; do
  sudo docker image inspect "$image" >/dev/null
done
```

Pull all four public digest-locked service/utility images before creating any
Runner resource. Compose pulls only the two service images; it does not fetch
the Docker CLI and Alpine utility images used by volume initialization and
socket verification. The private Go and Docker Actions job images are pulled
into the isolated DinD daemon after that daemon is healthy.

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

Pull both locked private Actions images through the existing package-read-only
backup identity. The Docker client configuration is temporary inside the DinD
container and is removed immediately; the token is never placed in an argument,
environment value, job container, or log. A restored platform backup already
contains these Registry packages. If either locked digest is absent, stop for a
reviewed image rebuild and lock update rather than substituting a mutable tag or
the public Docker CLI image.

```bash
runner_registry_config=/tmp/gitea-runner-registry-auth
cleanup_runner_registry_auth() {
  sudo docker exec gitea-runner-docker \
    rm -rf -- "$runner_registry_config" >/dev/null 2>&1 || true
}
trap cleanup_runner_registry_auth EXIT HUP INT TERM
sudo test "$(sudo stat -c '%u:%g %a' \
  /etc/gitea/tokens/backup-reader.token)" = '0:0 600'
sudo docker exec gitea-runner-docker test ! -e "$runner_registry_config"
sudo docker exec gitea-runner-docker \
  mkdir -m 0700 "$runner_registry_config"
sudo sh -c 'docker exec -i \
  -e DOCKER_CONFIG=/tmp/gitea-runner-registry-auth \
  gitea-runner-docker docker login git.211api.com \
  --username svc-backup-read --password-stdin \
  < /etc/gitea/tokens/backup-reader.token' >/dev/null
for image in "$GO_ACTIONS_CI_IMAGE" "$DOCKER_ACTIONS_CI_IMAGE"; do
  sudo docker exec -e DOCKER_CONFIG="$runner_registry_config" \
    gitea-runner-docker docker pull "$image" >/dev/null
done
sudo docker exec gitea-runner-docker docker run --rm \
  --network none --read-only --user 1000:1000 --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$GO_ACTIONS_CI_IMAGE" /bin/bash --noprofile --norc -ec '
    test "$(node --version)" = v24.18.0
    test "$(go version)" = "go version go1.26.5 linux/amd64"
    test -f /usr/local/share/licenses/node/LICENSE
    test -f /usr/local/share/doc/node/README.md
    test -f /usr/local/share/doc/node/CHANGELOG.md
  '
sudo docker exec gitea-runner-docker docker run --rm \
  --network none --read-only --user 1000:1000 --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$DOCKER_ACTIONS_CI_IMAGE" sh -ec '
    test "$(node --version)" = v24.18.0
    test "$(docker --version)" = "Docker version 29.6.1, build 8900f1d"
    docker buildx version
    docker compose version
    command -v apk >/dev/null
    test ! -e /bin/bash
  '
cleanup_runner_registry_auth
trap - EXIT HUP INT TERM
unset -f cleanup_runner_registry_auth
```

Generate a repository- or organization-scoped registration token only after
Gitea is ready. Write the command output directly to the fixed root-owned mode
0600 source file; never put the value in a shell variable, Compose environment,
command argument, terminal output, or Git. The locked Gitea 1.26.4 CLI returns
the existing active token for the scope; it does not rotate one. Refuse any
pre-existing source and create the first repository-scoped token atomically:

```bash
sudo /bin/bash <<'ROOT'
set -euo pipefail
source=/etc/gitea/runner-registration-token
lock=/run/lock/gitea-runner-registration-token.lock
if test -e "$lock"; then
  test -f "$lock"
  test ! -L "$lock"
  test "$(stat -c '%u' "$lock")" -eq 0
fi
exec 9>"$lock"
chown root:root "$lock"
chmod 0600 "$lock"
test "$(stat -c '%u:%g %a' "$lock")" = '0:0 600'
flock -n 9
test ! -e "$source"
test ! -L "$source"
token_count=$(docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml \
  exec -T postgres psql -U gitea -d gitea -Atqc '
    SELECT count(*)
    FROM action_runner_token AS t
    JOIN repository AS r ON r.id = t.repo_id
    JOIN "user" AS u ON u.id = r.owner_id
    WHERE u.lower_name = $$211api$$
      AND r.lower_name = $$211api$$
  ')
test "$token_count" -eq 0
tmp=$(mktemp /etc/gitea/.runner-registration-token.XXXXXX)
cleanup() { rm -f -- "$tmp"; }
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml \
  exec -T --user 1000:1000 gitea \
  gitea actions generate-runner-token --scope 211api/211api \
  </dev/null >"$tmp"
test "$(wc -l <"$tmp")" -eq 1
test "$(wc -c <"$tmp")" -eq 41
token_state=$(docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml \
  exec -T postgres psql -U gitea -d gitea -Atqc '
    SELECT
      count(*) FILTER (WHERE t.is_active),
      count(*) FILTER (WHERE NOT t.is_active)
    FROM action_runner_token AS t
    JOIN repository AS r ON r.id = t.repo_id
    JOIN "user" AS u ON u.id = r.owner_id
    WHERE u.lower_name = $$211api$$
      AND r.lower_name = $$211api$$
  ')
test "$token_state" = '1|0'
cmp "$tmp" <(
  curl --config /etc/gitea/admin-api.curl \
    --silent --show-error --fail \
    --request POST \
    https://git.211api.com/api/v1/repos/211api/211api/actions/runners/registration-token \
  | jq -er '.token | select(type == "string" and length == 40)'
)
chown root:root "$tmp"
chmod 0600 "$tmp"
ln -- "$tmp" "$source"
rm -f -- "$tmp"
test "$(stat -c '%u:%g %a' "$source")" = '0:0 600'
trap - EXIT HUP INT TERM
unset -f cleanup
ROOT

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

After the Runner is online, use the authenticated repository Settings ->
Actions -> Runners page to reset the registration token. This is a manual
administrator gate: Gitea 1.26.4 exposes reset only through the CSRF-protected
web route, while the CLI and REST registration-token endpoint both return an
existing active token. Verify without reading either token that the repository
scope has exactly one active row and exactly one inactive predecessor, then
delete only `/etc/gitea/runner-registration-token`:

```bash
sudo /bin/bash <<'ROOT'
set -euo pipefail
source=/etc/gitea/runner-registration-token
test -f "$source"
test ! -L "$source"
test "$(stat -c '%u:%g %a' "$source")" = '0:0 600'
docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml \
  exec -T postgres psql -U gitea -d gitea -Atqc '
    SELECT
      count(*) FILTER (WHERE t.is_active),
      count(*) FILTER (WHERE NOT t.is_active)
    FROM action_runner_token AS t
    JOIN repository AS r ON r.id = t.repo_id
    JOIN "user" AS u ON u.id = r.owner_id
    WHERE u.lower_name = $$211api$$
      AND r.lower_name = $$211api$$
  ' | grep -qx '1|1'
rm -f -- "$source"
test ! -e "$source"
ROOT
```

Keeping the source outside `/opt/gitea/runner` prevents the host-manifest
backup from capturing it during the short registration window. Subsequent
Runner restarts use the persistent registration state and require no staged
token.

## Repository bootstrap and controls

Install the reviewed administration directory at its canonical path. The
installer deliberately refuses to run from a checkout or another location.

```bash
sudo install -d -o root -g root -m 0755 /opt/gitea/admin
sudo cp -a /path/to/reviewed/deploy/gitea/admin/. /opt/gitea/admin/
sudo chown -R root:root /opt/gitea/admin
sudo find /opt/gitea/admin -type d -exec chmod 0755 {} +
sudo find /opt/gitea/admin -type f -exec chmod 0644 {} +
sudo chmod 0755 \
  /opt/gitea/admin/bootstrap-gitea \
  /opt/gitea/admin/configure-repository \
  /opt/gitea/admin/immutable-hook-installer \
  /opt/gitea/admin/immutable-v-tags \
  /opt/gitea/admin/install-immutable-tag-hook \
  /opt/gitea/admin/verify-repository
```

Create the data-only bootstrap input with exactly these two assignments. The
username is the initial human administrator and the first member of both human
control teams.

```text
BOOTSTRAP_ADMIN_USERNAME=reviewed-human-login
BOOTSTRAP_ADMIN_EMAIL=reviewed-human-address@example.com
```

```bash
sudo install -o root -g root -m 0600 /dev/null /etc/gitea/bootstrap.env
sudoedit /etc/gitea/bootstrap.env
sudo /opt/gitea/admin/bootstrap-gitea
```

The first run creates the human administrator with a random, must-change
password under `/etc/gitea/bootstrap-credentials`, creates the root-only admin
API curl config, and then stops at the manual 2FA gate. Log in over the reviewed
HTTPS origin, change the password, enable 2FA, and rerun the same command. The
control PAT is limited to `write:admin`, `write:organization`, and
`write:repository`; it deliberately has no package, notification, issue, or
user scope. Because a PAT is not protected by the interactive 2FA challenge,
its root-only metadata enforces a 30-day rotation deadline. At expiry, revoke
`bootstrap-admin-automation` from the administrator's Applications page,
remove its curl config and metadata, and rerun bootstrap to issue the reviewed
replacement. The second phase refuses any OpenAPI or CLI mismatch before API
mutations, paginates every exact-set inspection against the platform-fixed
50-item response cap, and then creates the private organization/repository and
these exact granular teams:

| Team | Members | Repository units |
| --- | --- | --- |
| `maintainers` | bootstrap human | `repo.code:write`, `repo.pulls:write` |
| `release-maintainers` | bootstrap human | `repo.code:write` |
| `package-publishers` | `svc-build`, `svc-release-package` | `repo.packages:write` |
| `package-readers` | `svc-backup-read`, `svc-deploy-read` | `repo.packages:read` |

Gitea's `bot` user type cannot hold the one-time password required by
`POST /users/{username}/tokens`. The six technical identities are therefore
restricted individual accounts with fixed service names, no administrator
rights, random one-time passwords, and the granular team/collaborator access
above. Their PAT scopes remain the second and independent permission boundary.

The bootstrap writes each PAT once and never prints it. It records the server
token ID, exact scopes, creation time, null server expiry, 90-day rotation due
date, and revocation procedure without the value. Every one-time service
password is deleted after its token(s) pass positive and negative permission
probes. `svc-release-tag` is the exception: it gets no PAT, and its password is
retained only until Task 11 proves the pinned SSH key and then records
`/etc/gitea/release-tag-ssh-only.json` before discarding the password.
Revocation uses the root-only administrator API to assign a fresh random
one-time service password, Basic-authenticates the exact recorded token ID to
`DELETE /users/{username}/tokens/{id}`, immediately discards that password, and
then removes or rotates the dependent Actions/host secret; the metadata record
stores this sequence per token.

| Token file | Account | Exact scope | Destination |
| --- | --- | --- | --- |
| `registry-build.token` | `svc-build` | `write:package` | `REGISTRY_BUILD_TOKEN` Actions secret |
| `backup-reader.token` | `svc-backup-read` | `read:user,read:repository,read:package` | backup curl config |
| `registry-release.token` | `svc-release-package` | `write:package` | `REGISTRY_RELEASE_TOKEN` Actions secret |
| `release-record.token` | `svc-release-record` | `write:repository` | `RELEASE_RECORD_TOKEN` Actions secret |
| `deploy-head.token` | `svc-deploy-read` | `read:repository` | Gateway deploy owner only |
| `deploy-registry.token` | `svc-deploy-read` | `read:package` | Gateway Docker credential only |

`GITEA_TOKEN` is Gitea's per-job built-in identity. Never create a static
Actions secret with that name: the release request lane relies on its actor and
team binding. Gitea also rejects user secret names beginning with reserved
`GITEA_`, which is why the Release API PAT is named `RELEASE_RECORD_TOKEN`.
Gateway's two read tokens never enter Actions.

After bootstrap, install the pre-main repository controls and split Actions
PATs. The command creates rules only when absent and fails on field drift; it
never deletes or silently replaces a rule.

```bash
sudo /opt/gitea/admin/configure-repository --base
```

Regenerate Gitea's managed receive hooks before installing the platform-owned
delegate. `security.DISABLE_GIT_HOOKS=true` remains enabled: the immutable hook
is installed beside Gitea's own executable `hooks/update.d/gitea` through the
fixed named data volume, not through user-created Git hooks.

```bash
sudo docker compose \
  --env-file /opt/gitea/images.lock.env \
  --env-file /etc/gitea/platform.env \
  -f /opt/gitea/platform/compose.yaml \
  exec -T --user 1000:1000 gitea gitea admin regenerate hooks
sudo /opt/gitea/admin/install-immutable-tag-hook --install
sudo /opt/gitea/admin/verify-repository --base
```

Run regeneration, installation, and verification again after every restore or
Gitea upgrade. The installer requires the exact bare path
`/var/lib/gitea/git/repositories/211api/211api.git`, numeric owner 1000:1000,
the Gitea-managed delegate, and matching recorded SHA-256. A symlink, wrong
owner, missing managed hook, partial state, or checksum drift is a hard stop.

Task 11's disposable receive-path proof must use a repository named exactly
`hook-smoke-YYYYMMDDtHHMMSSz-8hex`. After the API-created repository has passed
the owner/name/numeric-ID guards and Gitea has generated its managed hooks,
install and verify the same reviewed delegate without accepting an operator
supplied filesystem path:

```bash
smoke_repository=hook-smoke-20260719t120000z-0123abcd
sudo /opt/gitea/admin/install-immutable-tag-hook \
  --smoke-install "$smoke_repository"
sudo /opt/gitea/admin/install-immutable-tag-hook \
  --smoke-verify "$smoke_repository"
```

The installer derives both
`/var/lib/gitea/git/repositories/211api/$smoke_repository.git` and the unique
root-only checksum record under `/var/lib/gitea/.platform`; it rejects any
other name or arbitrary path. These modes do not authorize repository deletion:
the API/DB owner, name, and numeric ID must still match immediately before the
single exact smoke repository is deleted. Never use them for `211api/211api`.

Do not activate `main` protection from guessed check names. Task 11 must first
produce a root-owned mode-0600 evidence file containing exactly:

```text
ci / required
security / required
```

Then activate and verify against the real tested commit SHA:

```bash
sudo /opt/gitea/admin/configure-repository \
  --activate-main /etc/gitea/required-status-contexts
sudo /opt/gitea/admin/verify-repository --full \
  /etc/gitea/required-status-contexts "$PROVED_COMMIT_SHA"
```

The full verifier also requires the later SSH secrets, both actual commit
statuses, the SSH-only release-tag evidence, no push mirror, exact teams and
members, token negative permissions, disabled registration, and the immutable
hook checksum. It makes no repository mutation.

Once present, `/opt/gitea/admin`, the bootstrap input, split token files,
non-value metadata, and later SSH-only/status-context evidence are included in
the existing age-encrypted host configuration component. The root-only hook
checksum record lives at `/var/lib/gitea/.platform/immutable-v-tags.sha256`
inside the backed-up Gitea data volume. The short-lived Runner registration
token remains deliberately excluded.

## Gateway deployment enforcement

These files are installed only on the existing Gateway in Los Angeles. They do
not move the application, PostgreSQL, Redis, ingress, ports, environment, or
business data to Netcup. The root program is the sole production-mutation
owner; workflow YAML can request only the exact commit and manifest digest.

Copy a reviewed Task 7 source directory into a temporary root-owned staging
directory, compare its recorded checksums with the repository review evidence,
and run the installer. It refuses symlinks, unsafe ownership/modes, and path
type conflicts; an existing safe installation is replaced atomically.

```bash
umask 077
sudo install -d -o root -g root -m 0700 /root/211api-gateway-install
sudo cp -a /path/to/reviewed/deploy/gitea/gateway/. \
  /root/211api-gateway-install/
sudo chown -R root:root /root/211api-gateway-install
sudo find /root/211api-gateway-install -type d -exec chmod 0700 {} +
sudo chmod 0755 \
  /root/211api-gateway-install/211api-deploy \
  /root/211api-gateway-install/211api-deploy-dispatch \
  /root/211api-gateway-install/211api-backup-restore-drill \
  /root/211api-gateway-install/install-gateway-deployer \
  /root/211api-gateway-install/gateway-audit-rotate \
  /root/211api-gateway-install/gateway-retention.py \
  /root/211api-gateway-install/gateway-validate-archive.py
sudo chmod 0644 \
  /root/211api-gateway-install/gateway-runtime.sh \
  /root/211api-gateway-install/211api-deploy.logrotate
sudo sha256sum /root/211api-gateway-install/*
sudo /root/211api-gateway-install/install-gateway-deployer
```

The installer creates only the reviewed programs under `/usr/local/sbin`, the
root-only `/etc/211api-deploy` control tree, the encrypted-backup/state/audit
paths under `/opt/211api/deploy` and `/var/log`, and the logrotate owner. It
does not create credentials and does not edit the existing Compose or `.env`.
The deployer requires exactly one root-owned mode-0600 `SUB2API_IMAGE=` line;
it fails rather than adding or guessing one.

Install `age`/`age-keygen`, `curl`, `jq`, `python3`, `util-linux` (`flock` and
`findmnt`), `openssl`, `gzip`, and GNU core utilities first; Docker must include
Compose v2 and Buildx. The production installer refuses a missing runtime
command. `/run` is intentionally ephemeral: every status/deploy/restore entry
recreates only `/run/211api-deploy` and the two root-owned mode-0600 lock files
after validating `/run` and `/run/lock`, so a host reboot does not require the
installer to be rerun.

Provision the Task 6 split credentials without printing them. Store the
repository-read PAT only as a one-line mode-0600 curl config at
`/etc/211api-deploy/gitea-head-api.curl`. Store the package-read PAT in a
separate temporary root-only file, pass it to `docker login` over stdin, then
remove that token file after the root Docker config is verified mode 0600.
Neither token enters Actions or an argv value.

```text
header = "Authorization: token <svc-deploy-read repository-read PAT>"
```

```bash
umask 077
sudo install -o root -g root -m 0600 /dev/null \
  /etc/211api-deploy/gitea-head-api.curl
sudoedit /etc/211api-deploy/gitea-head-api.curl
sudo install -o root -g root -m 0600 /dev/null \
  /etc/211api-deploy/registry-pull.token
sudoedit /etc/211api-deploy/registry-pull.token
sudo sh -c 'docker login git.211api.com --username svc-deploy-read \
  --password-stdin < /etc/211api-deploy/registry-pull.token'
sudo chmod 0600 /root/.docker/config.json
sudo rm -f /etc/211api-deploy/registry-pull.token
```

Install only the public age recipient at `/etc/211api-deploy/age-recipient`.
`key-metadata.json` is mode 0600 with schema
`211api-age-key-metadata.v1`, the recipient SHA-256, custody verification UTC,
and rotation deadline; it contains no private key. During rotation, an optional
`recipients` array retains old recipient hashes until every corresponding
backup expires, so an operator-held old identity can still be verified for a
restore drill. New backups require the public recipient file to equal the
top-level active `recipient_sha256`; a historical array entry can never become
the encryption target by leaving an old public-recipient file in place.

The status command returns only nonsecret readiness, protected-main head,
health, lock, image, and state metadata:

```bash
sudo /usr/local/sbin/211api-deploy status | jq .
```

Install the dedicated public deployment key as one exact root authorized-key
line only after its source and Gateway host fingerprints are independently
verified. The private key remains on Netcup as an Actions secret.

```text
from="37.221.194.27",restrict,command="/usr/local/sbin/211api-deploy-dispatch" ssh-ed25519 <reviewed-public-key> <reviewed-key-id>
```

The dispatcher accepts only `status` or
`deploy --commit <40-lower-hex> --digest sha256:<64-lower-hex>`. It requires the
split SSH source to equal `37.221.194.27`, rejects PTY/agent/X11 forwarding and
all extra syntax, and invokes the root program through `env -i`. It cannot
create a migration approval or invoke the Task 12 baseline branch.

Before cutover, the human administrator records the proved current production
commit/digest and creates a real encrypted backup without changing `.env`,
Registry, Compose, or any container. This direct TTY-only mode is not in the
forced-command grammar:

```bash
sudo /usr/local/sbin/211api-deploy deploy --record-baseline \
  --commit "$PROVED_CURRENT_COMMIT" \
  --digest "$PROVED_CURRENT_MANIFEST_DIGEST"
```

It first requires the current `.env` image, running container image ID, local
RepoDigest, and OCI revision or exact full-commit image tag token to agree. Only
then does it write the initial state and pre-cutover backup.

A normal deploy locks the entire operation, verifies the Gitea candidate as a
single Linux/AMD64 manifest with the exact OCI revision, checks protected
`main`, computes the exact migration-sensitive path set, and creates a
validated age-encrypted PostgreSQL/deployment backup. It checks `main` and the
Compose/environment hashes again immediately before mutation, atomically
replaces only `SUB2API_IMAGE`, and verifies health plus the running image ID,
RepoDigest, and OCI revision. Head/API, backup, audit, pull, start, or health
failure is fail-closed; no automatic database restore or blind image rollback
exists.

Because `.env` is the Compose source of truth, a pull/start/health failure after
its atomic image switch can intentionally leave `.env` at the requested digest
while deployment state still records the last proved healthy image. `status`
then reports `state_env_consistent=false` and
`intervention_required=true`; subsequent deployment is blocked by the same
state check. This is evidence-preserving fail-closed behavior, not permission
to retry blindly. The operator must review the validated backup, the bounded
root-only failure log, actual container image/health, and any migration output,
then obtain separately scoped recovery approval before reconciling the image
line or database. No script performs that recovery automatically.

For a migration-sensitive commit, use only the pre-existing human
administrative TTY on Gateway. Review the displayed path set and enter the
exact confirmation; the 30-minute record is bound to commit, digest, operator,
random nonce, and sensitive-path hash. The CI key cannot reach this branch.

```bash
sudo /usr/local/sbin/211api-deploy approve-migration \
  --commit "$TARGET_COMMIT" \
  --digest "$TARGET_MANIFEST_DIGEST" \
  --expires-in 30m
```

The next matching deploy atomically moves that record into
`consumed-approvals` before the first application mutation. Wrong, expired,
changed-path, non-TTY, CI, and replay attempts return 78. Lock contention
returns 75; stale protected-main evidence returns 76.

Each pre-deploy set under `/opt/211api/deploy/backups` contains only encrypted
database/deployment streams, validation listings, nonsecret previous-state
metadata, and a fsynced manifest. Retention runs under the deployment lock,
dry-runs first, verifies every classified component checksum, keeps at least
the newest three plus predecessor/known-good/leased/referenced sets, and never
touches unclassified or legacy recovery paths.

For the quarterly or pre-cutover restore drill, place the matching operator
identity on a root-owned tmpfs and run the TTY-only command. It verifies the
recipient history, ciphertext hashes, and manifest; restores through a pipe
into the locked PostgreSQL 18.4 image with `--network none`, no published port,
one newly labelled volume, and no production mount; checks schema,
constraints, and representative nonsecret row counts; then removes only its
own labelled container and volume. Unmount the operator-owned tmpfs afterward.

```bash
umask 077
sudo install -d -o root -g root -m 0700 /run/211api-operator-key
sudo mount -t tmpfs -o size=1m,mode=0700,nosuid,nodev,noexec \
  tmpfs /run/211api-operator-key
sudo /usr/local/sbin/211api-backup-restore-drill \
  --backup-id "$GATEWAY_BACKUP_ID" \
  --identity "$TMPFS_IDENTITY_PATH"
sudo umount /run/211api-operator-key
```

Audit records are bounded single-line JSON, appended under a dedicated lock,
and `fdatasync`ed before every production mutation and at completion. Crossing
10 MiB rotates under that same lock; ten root-only compressed rotations are
kept. A failed audit append/sync stops before the next mutation.

## Backups and notification

### Pipedream to Telegram adapter

This path is only for Gitea platform backup failures. Legacy GitHub/DockerHub
release and deployment Telegram notifications remain retired. CI, security
scan, release, deployment, Gateway, and business-application events must not
call this adapter.

In the same Pipedream project that owns the project secrets
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`:

1. Open workflow `gitea-backup-failure-to-telegram`.
2. Configure `HTTP / Webhook` -> `New Requests` with Event Data
   `Full HTTP request`, Authorization `None`, and HTTP Response set to the
   option that returns a custom response from the workflow. Do not select
   `Return HTTP 200 OK`: the Node step must be allowed to return 400, 500, or
   502 when validation or Telegram delivery fails.
3. Add `Run custom code`, select Node.js, and paste the complete contents of
   `pipedream/gitea-backup-to-telegram.mjs` without modification.
4. Deploy the workflow. Do not log `process.env`, the endpoint, or either
   project secret.

The committed file is the canonical source for the Pipedream editor cell. Its
offline regression uses no real credentials or network:

```bash
node --check deploy/gitea/pipedream/gitea-backup-to-telegram.mjs
node --test deploy/gitea/pipedream/gitea-backup-to-telegram.test.mjs
```

On the operator machine, read the deployed endpoint without adding it to shell
history, validate the expected Pipedream host, and exercise the quiet preflight:

```bash
umask 077
read -rsp 'Pipedream Webhook URL: ' WEBHOOK_URL; echo
case "$WEBHOOK_URL" in
  https://*.m.pipedream.net) ;;
  *) printf 'unexpected Pipedream URL\n' >&2; unset WEBHOOK_URL; exit 1 ;;
esac
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --connect-timeout 5 --max-time 15 \
  --header 'Content-Type: application/json' \
  --data-binary '{"schema":"gitea-backup-notification.v1","event":"preflight","status":"ok"}' \
  "$WEBHOOK_URL")"
[[ "$status" == 200 ]]
```

The exact preflight returns 200 without a Telegram message. An invalid schema
must return 400 without a Telegram call:

```bash
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --connect-timeout 5 --max-time 15 \
  --header 'Content-Type: application/json' \
  --data-binary '{"schema":"invalid.v1","event":"preflight","status":"ok"}' \
  "$WEBHOOK_URL")"
[[ "$status" == 400 ]]
```

Send one explicit end-to-end test and require HTTP 200:

```bash
failed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
payload="$(jq -cn --arg failed_at "$failed_at" \
  '{schema:"gitea-backup-notification.v1",event:"backup-failed",status:"failed",failed_at:$failed_at,code:"notification-test",unit:"gitea-backup.service"}')"
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --connect-timeout 5 --max-time 15 \
  --header 'Content-Type: application/json' \
  --data-binary "$payload" "$WEBHOOK_URL")"
unset payload failed_at
[[ "$status" == 200 ]]
```

The dedicated private group must receive one message headed
`🧪 Gitea 备份告警测试` with the UTC time, `notification-test`, and
`gitea-backup.service`, and no URL, token, or log text. Only then install the
endpoint on Netcup via stdin and clear the local variable:

```bash
printf '%s\n' "$WEBHOOK_URL" | \
  ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
    -i ~/.ssh/211api_root_37_221_194_27_4422 -p 4422 \
    root@37.221.194.27 \
    'umask 077; install -o root -g root -m 0600 /dev/stdin /etc/gitea/backup-notify-url'
unset WEBHOOK_URL
```

Netcup stores only that endpoint. The bot token and chat ID remain solely in
Pipedream. If the endpoint may have leaked, deploy a replacement endpoint,
install and prove the replacement, then disable the old workflow endpoint.

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
an internal network, and exposes the isolated Gitea only through a run-owned
Python TCP proxy bound to a transient `127.0.0.1` port. This avoids changing
host-wide Docker daemon, NAT, or `route_localnet` settings when Docker cannot
materialize a loopback-only published port. The proxy accepts only loopback or
RFC1918 targets and is stopped by the restore cleanup trap. The drill
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
deploy/gitea/runner/tests/test-go-actions-image.sh
deploy/gitea/runner/tests/test-registration-token-lifecycle.sh
deploy/gitea/runner/tests/smoke-rootless-dind.sh
deploy/gitea/tests/test-admin-primitives.sh
deploy/gitea/tests/test-immutable-tag-hook.sh
deploy/gitea/tests/test-gateway-deployer.sh
```

The DinD smoke uses unique project, network, and volume names, proves rootless
security options, socket ownership/mode, absence of TCP listeners and published
ports, and runs a locked inner Alpine container as UID/GID 65534 with a read-only
root filesystem and no capabilities. Its trap removes only those unique
resources. It exercises only Runner's negative startup branches; real token
consumption, registration, job socket injection, and Gitea protocol compatibility
remain mandatory live gates in Task 11.
