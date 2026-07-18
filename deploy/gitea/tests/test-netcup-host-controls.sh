#!/usr/bin/env bash

set -euo pipefail
umask 077

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
HOST_ROOT="$REPO_ROOT/deploy/gitea/host"
PROGRAM="$HOST_ROOT/netcup-firewall"
INSTALLER="$HOST_ROOT/install-netcup-host-controls"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT HUP INT TERM

fail() {
  printf 'test-netcup-host-controls: %s\n' "$1" >&2
  exit 1
}

expect_failure() {
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  ((status != 0)) || fail "expected failure: $*"
}

fixture="$TEST_ROOT/fixture"
mkdir -p "$fixture"
"$INSTALLER" --test-root "$fixture" >/dev/null
expected_owner="$(id -u):$(id -g)"

for executable in \
  usr/local/sbin/gitea-netcup-firewall; do
  [[ "$(stat -c '%a' "$fixture/$executable")" == 755 ]] ||
    fail "bad executable mode: $executable"
  [[ "$(stat -c '%u:%g' "$fixture/$executable")" == "$expected_owner" ]] ||
    fail "bad executable owner: $executable"
done
for config in \
  etc/systemd/system/gitea-netcup-firewall.service \
  etc/fail2ban/jail.d/211api-sshd.local \
  etc/fail2ban/jail.d/211api-gitea.local \
  etc/fail2ban/filter.d/gitea-auth.conf; do
  [[ "$(stat -c '%a' "$fixture/$config")" == 644 ]] || fail "bad config mode: $config"
  [[ "$(stat -c '%u:%g' "$fixture/$config")" == "$expected_owner" ]] ||
    fail "bad config owner: $config"
done
[[ "$(stat -c '%a' "$fixture/etc/gitea")" == 700 ]]
[[ "$(stat -c '%u:%g' "$fixture/etc/gitea")" == "$expected_owner" ]]
[[ "$(stat -c '%a' "$fixture/etc/gitea/netcup-host-controls.sha256")" == 600 ]]
[[ "$(stat -c '%u:%g' "$fixture/etc/gitea/netcup-host-controls.sha256")" == "$expected_owner" ]]
[[ ! -e "$fixture/etc/fail2ban/jail.d/zz-211api-gitea-enable.local" ]]
sha256sum --quiet --check "$fixture/etc/gitea/netcup-host-controls.sha256"

install -d -o "$(id -u)" -g "$(id -g)" -m 0750 \
  "$fixture/opt/gitea/platform/log"
install -o "$(id -u)" -g "$(id -g)" -m 0640 /dev/null \
  "$fixture/opt/gitea/platform/log/gitea.log"
expect_failure "$INSTALLER" --test-root "$fixture" --enable-gitea
printf 'stable Gitea log\n' >"$fixture/opt/gitea/platform/log/gitea.log"
"$INSTALLER" --test-root "$fixture" --enable-gitea >/dev/null
[[ "$(stat -c '%a' "$fixture/etc/fail2ban/jail.d/zz-211api-gitea-enable.local")" == 644 ]]
sha256sum --quiet --check "$fixture/etc/gitea/netcup-host-controls.sha256"
expect_failure "$INSTALLER" --test-root "$fixture"
"$INSTALLER" --test-root "$fixture" --enable-gitea >/dev/null
sha256sum --quiet --check "$fixture/etc/gitea/netcup-host-controls.sha256"

exec 7<"$fixture/etc/gitea"
flock -n 7
expect_failure env NETCUP_HOST_INSTALL_TEST_LOCK_TIMEOUT=0 \
  "$INSTALLER" --test-root "$fixture" --enable-gitea 7>&-
flock -u 7
exec 7>&-

conflict="$TEST_ROOT/conflict"
mkdir -p "$conflict/usr/local/sbin"
ln -s /tmp/forbidden "$conflict/usr/local/sbin/gitea-netcup-firewall"
expect_failure "$INSTALLER" --test-root "$conflict"

transaction="$TEST_ROOT/transaction"
mkdir -p "$transaction"
"$INSTALLER" --test-root "$transaction" >/dev/null
printf 'pre-transaction-sentinel\n' >"$transaction/usr/local/sbin/gitea-netcup-firewall"
chmod 0755 "$transaction/usr/local/sbin/gitea-netcup-firewall"
rm -f "$transaction/etc/fail2ban/filter.d/gitea-auth.conf"
ln -s /tmp/forbidden "$transaction/etc/fail2ban/filter.d/gitea-auth.conf"
expect_failure "$INSTALLER" --test-root "$transaction"
grep -Fx 'pre-transaction-sentinel' \
  "$transaction/usr/local/sbin/gitea-netcup-firewall" >/dev/null

rollback="$TEST_ROOT/rollback"
mkdir -p "$rollback"
"$INSTALLER" --test-root "$rollback" >/dev/null
rollback_paths=(
  usr/local/sbin/gitea-netcup-firewall
  etc/systemd/system/gitea-netcup-firewall.service
  etc/fail2ban/jail.d/211api-sshd.local
  etc/fail2ban/jail.d/211api-gitea.local
  etc/fail2ban/filter.d/gitea-auth.conf
  etc/gitea/netcup-host-controls.sha256
)
for relative in "${rollback_paths[@]}"; do
  printf 'rollback-sentinel:%s\n' "$relative" >"$rollback/$relative"
done
snapshot_managed() {
  local root=$1 relative
  for relative in "${rollback_paths[@]}"; do
    printf '%s %s %s\n' \
      "$(sha256sum "$root/$relative" | awk '{print $1}')" \
      "$(stat -c '%u:%g:%a' "$root/$relative")" \
      "$relative"
  done
}
rollback_before="$(snapshot_managed "$rollback")"
status=0
NETCUP_HOST_INSTALL_TEST_FAULT=after-final-commit \
  "$INSTALLER" --test-root "$rollback" >/dev/null 2>&1 || status=$?
[[ "$status" == 91 ]]
[[ "$(snapshot_managed "$rollback")" == "$rollback_before" ]]
[[ ! -e "$rollback/etc/fail2ban/jail.d/zz-211api-gitea-enable.local" ]]
if find "$rollback" -type f \
  \( -name '.gitea-host-stage.*' -o -name '.gitea-host-backup.*' \) \
  -print -quit | grep -q .; then
  fail 'transaction debris survived rollback'
fi

grep -Fx 'PartOf=docker.service' "$HOST_ROOT/gitea-netcup-firewall.service" >/dev/null
grep -Fx 'WantedBy=multi-user.target docker.service' \
  "$HOST_ROOT/gitea-netcup-firewall.service" >/dev/null
grep -Fx 'ExecStartPost=/usr/bin/fail2ban-client reload' \
  "$HOST_ROOT/gitea-netcup-firewall.service" >/dev/null
grep -Fx 'ReadWritePaths=/run/lock' "$HOST_ROOT/gitea-netcup-firewall.service" >/dev/null
grep -Fx 'backend = systemd' "$HOST_ROOT/fail2ban/jail.d/211api-sshd.local" >/dev/null
grep -Fx 'port = 4422' "$HOST_ROOT/fail2ban/jail.d/211api-sshd.local" >/dev/null
grep -Fx 'enabled = false' "$HOST_ROOT/fail2ban/jail.d/211api-gitea.local" >/dev/null
grep -Fx 'banaction = iptables-multiport' \
  "$HOST_ROOT/fail2ban/jail.d/211api-gitea.local" >/dev/null
grep -Fx 'chain = DOCKER-USER' "$HOST_ROOT/fail2ban/jail.d/211api-gitea.local" >/dev/null
grep -F 'Failed authentication attempt from <HOST>' \
  "$HOST_ROOT/fail2ban/filter.d/gitea-auth.conf" >/dev/null
grep -F 'Failed authentication attempt for .* from <HOST>' \
  "$HOST_ROOT/fail2ban/filter.d/gitea-auth.conf" >/dev/null

set +e
verify_output="$(systemd-analyze verify "$HOST_ROOT/gitea-netcup-firewall.service" 2>&1)"
verify_status=$?
set -e
if [[ "$verify_status" -ne 0 ]]; then
  while IFS= read -r line; do
    case "$line" in
      netplan-ovs-cleanup.service:*Permission\ denied) ;;
      gitea-netcup-firewall.service:*'/usr/local/sbin/gitea-netcup-firewall'*No\ such\ file\ or\ directory) ;;
      gitea-netcup-firewall.service:*'/usr/bin/fail2ban-client'*No\ such\ file\ or\ directory) ;;
      "") ;;
      *) fail "unexpected systemd verification error: $line" ;;
    esac
  done <<<"$verify_output"
fi

unshare -Urn bash -s -- "$PROGRAM" <<'NAMESPACE_TEST'
set -euo pipefail
program=$1

ip link add ens3 type dummy
ip address add 37.221.194.27/32 dev ens3
ip link set ens3 up
iptables -N DOCKER-USER
ip6tables -N DOCKER-USER
iptables -A DOCKER-USER -j RETURN
ip6tables -A DOCKER-USER -j RETURN
iptables -N KEEP-ME
iptables -A KEEP-ME -s 192.0.2.1 -j DROP

"$program" apply
"$program" verify

iptables -F GITEA-GUARD
iptables -A GITEA-GUARD -j RETURN
before_v4="$(iptables -S GITEA-GUARD)"
before_v6="$(ip6tables -S GITEA6-GUARD)"
before_user_v4="$(iptables -S DOCKER-USER)"
before_user_v6="$(ip6tables -S DOCKER-USER)"
for fault in after-ipv4 after-ipv6; do
  status=0
  GITEA_FIREWALL_TEST_FAULT="$fault" "$program" apply >/dev/null 2>&1 || status=$?
  [[ "$status" == 91 ]]
  [[ "$(iptables -S GITEA-GUARD)" == "$before_v4" ]]
  [[ "$(ip6tables -S GITEA6-GUARD)" == "$before_v6" ]]
  [[ "$(iptables -S DOCKER-USER)" == "$before_user_v4" ]]
  [[ "$(ip6tables -S DOCKER-USER)" == "$before_user_v6" ]]
done

iptables -D DOCKER-USER -m comment --comment gitea-platform-guard-v1 -j GITEA-GUARD
ip6tables -D DOCKER-USER -m comment --comment gitea-platform-guard-v6-v1 -j GITEA6-GUARD
before_user_v4="$(iptables -S DOCKER-USER)"
before_user_v6="$(ip6tables -S DOCKER-USER)"
status=0
GITEA_FIREWALL_TEST_FAULT=after-ipv4-jump \
  "$program" apply >/dev/null 2>&1 || status=$?
[[ "$status" == 91 ]]
[[ "$(iptables -S GITEA-GUARD)" == "$before_v4" ]]
[[ "$(ip6tables -S GITEA6-GUARD)" == "$before_v6" ]]
[[ "$(iptables -S DOCKER-USER)" == "$before_user_v4" ]]
[[ "$(ip6tables -S DOCKER-USER)" == "$before_user_v6" ]]

"$program" apply
"$program" verify
"$program" apply
"$program" verify

[[ "$(iptables -S DOCKER-USER | grep -c -- '-j GITEA-GUARD')" == 1 ]]
[[ "$(ip6tables -S DOCKER-USER | grep -c -- '-j GITEA6-GUARD')" == 1 ]]
[[ "$(iptables -S DOCKER-USER | tail -n 1)" == '-A DOCKER-USER -j RETURN' ]]
[[ "$(ip6tables -S DOCKER-USER | tail -n 1)" == '-A DOCKER-USER -j RETURN' ]]
iptables -C KEEP-ME -s 192.0.2.1 -j DROP
iptables -S GITEA-GUARD | grep -F -- '--ctorigdst 37.221.194.27 --ctorigdstport 2222' >/dev/null
iptables -S GITEA-GUARD | grep -F -- '--hashlimit-name gitea_ssh_v4' >/dev/null
iptables -S GITEA-GUARD | grep -F -- '-i ens3 -j DROP' >/dev/null
ip6tables -S GITEA6-GUARD | grep -F -- '-i ens3 -j DROP' >/dev/null

iptables -N f2b-gitea-auth
iptables -A f2b-gitea-auth -j RETURN
iptables -I DOCKER-USER 1 -p tcp -m multiport --dports 2222 -j f2b-gitea-auth
"$program" verify
[[ "$(iptables -S DOCKER-USER | sed -n '1p')" == '-N DOCKER-USER' ]]
[[ "$(iptables -S DOCKER-USER | sed -n '2p')" == *'-j f2b-gitea-auth' ]]
[[ "$(iptables -S DOCKER-USER | sed -n '3p')" == *'-j GITEA-GUARD' ]]
[[ "$(iptables -S DOCKER-USER | sed -n '4p')" == '-A DOCKER-USER -j RETURN' ]]

iptables -A DOCKER-USER -j ACCEPT
if "$program" verify >/dev/null 2>&1; then
  printf 'unexpected unowned-rule acceptance\n' >&2
  exit 1
fi
iptables -D DOCKER-USER -j ACCEPT

iptables -N f2b-forged
iptables -A f2b-forged -j RETURN
iptables -I DOCKER-USER 1 -p tcp -m multiport --dports 2222 -j f2b-forged
if "$program" verify >/dev/null 2>&1; then
  printf 'unexpected forged-fail2ban acceptance\n' >&2
  exit 1
fi
iptables -D DOCKER-USER -p tcp -m multiport --dports 2222 -j f2b-forged
iptables -F f2b-forged
iptables -X f2b-forged

iptables -N FOREIGN-OWNER
iptables -A FOREIGN-OWNER -j GITEA-GUARD
if "$program" apply >/dev/null 2>&1; then
  printf 'unexpected external-reference acceptance\n' >&2
  exit 1
fi
iptables -D FOREIGN-OWNER -j GITEA-GUARD
iptables -X FOREIGN-OWNER

iptables -D DOCKER-USER -p tcp -m multiport --dports 2222 -j f2b-gitea-auth
iptables -A DOCKER-USER -p tcp -m multiport --dports 2222 -j f2b-gitea-auth
if "$program" verify >/dev/null 2>&1; then
  printf 'unexpected post-guard fail2ban acceptance\n' >&2
  exit 1
fi
NAMESPACE_TEST

printf 'Netcup host installer, firewall namespace, and Fail2ban contracts passed\n'
