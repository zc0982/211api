#!/usr/bin/env bash

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
ENGINE="$ROOT/deploy/gitea/admin/immutable-hook-installer"
HOOK_SOURCE="$ROOT/deploy/gitea/admin/immutable-v-tags"
tmp=$(mktemp -d)

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

uid=$(id -u)
gid=$(id -g)

fail() {
  printf 'immutable hook test: %s\n' "$*" >&2
  exit 1
}

expect_failure() {
  local label=$1
  shift
  if "$@" >"$tmp/$label.out" 2>"$tmp/$label.err"; then
    fail "$label unexpectedly succeeded"
  fi
}

make_managed_bare() {
  local repository=$1
  git init --bare -q "$repository"
  mkdir -p "$repository/hooks/update.d"
  printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    'for hook in "$0.d"/*; do' \
    '  [ -f "$hook" ] && [ -x "$hook" ] || continue' \
    '  "$hook" "$@" || exit $?' \
    'done' \
    'exit 0' >"$repository/hooks/update"
  printf '%s\n' '#!/bin/sh' 'exit 0' >"$repository/hooks/update.d/gitea"
  chmod 0755 "$repository/hooks/update" "$repository/hooks/update.d/gitea"
}

fixture_install() {
  local repository=$1 expected=$2 record=$3
  GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" --fixture-install \
    "$repository" "$expected" "$HOOK_SOURCE" "$record" "$uid" "$gid"
}

fixture_verify() {
  local repository=$1 expected=$2 record=$3
  GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" --fixture-verify \
    "$repository" "$expected" "$HOOK_SOURCE" "$record" "$uid" "$gid"
}

[[ -x "$ENGINE" && -x "$HOOK_SOURCE" ]] ||
  fail 'reviewed installer and hook source must be executable'

repository="$tmp/live.git"
mkdir -m 0700 "$tmp/live-evidence"
make_managed_bare "$repository"
fixture_install "$repository" "$repository" "$tmp/live-evidence/checksum" >/dev/null
fixture_verify "$repository" "$repository" "$tmp/live-evidence/checksum" >/dev/null
rm -f -- "$repository/hooks/update.d/immutable-v-tags"
expect_failure regenerated-missing-hook fixture_verify "$repository" "$repository" \
  "$tmp/live-evidence/checksum"
fixture_install "$repository" "$repository" "$tmp/live-evidence/checksum" >/dev/null
fixture_verify "$repository" "$repository" "$tmp/live-evidence/checksum" >/dev/null

git init -q "$tmp/source"
git -C "$tmp/source" config user.name 'Hook Test'
git -C "$tmp/source" config user.email hook-test@211api.invalid
printf 'one\n' >"$tmp/source/value"
git -C "$tmp/source" add value
git -C "$tmp/source" commit -qm one
git -C "$tmp/source" remote add origin "$repository"
git -C "$tmp/source" push -q origin HEAD:refs/heads/main

git -C "$tmp/source" tag v1.0.0
git -C "$tmp/source" push -q origin refs/tags/v1.0.0
printf 'two\n' >>"$tmp/source/value"
git -C "$tmp/source" commit -qam two
git -C "$tmp/source" tag -f v1.0.0 >/dev/null
if git -C "$tmp/source" push --force origin refs/tags/v1.0.0 \
  >"$tmp/update.out" 2>"$tmp/update.err"; then
  fail 'protected v* tag update unexpectedly succeeded'
fi
grep -F 'protected release tags are immutable' "$tmp/update.err" >/dev/null ||
  fail 'protected tag update did not execute the immutable hook'
if git -C "$tmp/source" push origin :refs/tags/v1.0.0 \
  >"$tmp/delete.out" 2>"$tmp/delete.err"; then
  fail 'protected v* tag deletion unexpectedly succeeded'
fi
grep -F 'protected release tags are immutable' "$tmp/delete.err" >/dev/null ||
  fail 'protected tag deletion did not execute the immutable hook'

git -C "$tmp/source" tag ordinary
git -C "$tmp/source" push -q origin refs/tags/ordinary
printf 'three\n' >>"$tmp/source/value"
git -C "$tmp/source" commit -qam three
git -C "$tmp/source" tag -f ordinary >/dev/null
git -C "$tmp/source" push -q --force origin refs/tags/ordinary
git -C "$tmp/source" push -q origin :refs/tags/ordinary
git -C "$tmp/source" push -q origin HEAD:refs/heads/ordinary-branch
printf 'four\n' >>"$tmp/source/value"
git -C "$tmp/source" commit -qam four
git -C "$tmp/source" push -q origin HEAD:refs/heads/ordinary-branch
git -C "$tmp/source" push -q origin :refs/heads/ordinary-branch

make_managed_bare "$tmp/canonical.git"
make_managed_bare "$tmp/wrong.git"
mkdir -m 0700 "$tmp/wrong-evidence"
expect_failure wrong-path env GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" \
  --fixture-install "$tmp/wrong.git" "$tmp/canonical.git" "$HOOK_SOURCE" \
  "$tmp/wrong-evidence/checksum" "$uid" "$gid"

ln -s "$tmp/canonical.git" "$tmp/symlink.git"
mkdir -m 0700 "$tmp/symlink-evidence"
expect_failure symlink env GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" \
  --fixture-install "$tmp/symlink.git" "$tmp/symlink.git" "$HOOK_SOURCE" \
  "$tmp/symlink-evidence/checksum" "$uid" "$gid"

git init --bare -q "$tmp/missing-managed.git"
mkdir -m 0700 "$tmp/missing-evidence"
expect_failure missing-managed env GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" \
  --fixture-install "$tmp/missing-managed.git" "$tmp/missing-managed.git" \
  "$HOOK_SOURCE" "$tmp/missing-evidence/checksum" "$uid" "$gid"

mkdir -m 0700 "$tmp/owner-evidence"
expect_failure wrong-owner env GITEA_HOOK_INSTALL_FIXTURE=1 "$ENGINE" \
  --fixture-install "$tmp/canonical.git" "$tmp/canonical.git" "$HOOK_SOURCE" \
  "$tmp/owner-evidence/checksum" "$((uid + 1))" "$gid"

make_managed_bare "$tmp/drift.git"
mkdir -m 0700 "$tmp/drift-evidence"
fixture_install "$tmp/drift.git" "$tmp/drift.git" \
  "$tmp/drift-evidence/checksum" >/dev/null
printf '%s\n' '# drift' >>"$tmp/drift.git/hooks/update.d/immutable-v-tags"
expect_failure checksum-drift fixture_verify "$tmp/drift.git" "$tmp/drift.git" \
  "$tmp/drift-evidence/checksum"

make_managed_bare "$tmp/record-drift.git"
mkdir -m 0700 "$tmp/record-drift-evidence"
fixture_install "$tmp/record-drift.git" "$tmp/record-drift.git" \
  "$tmp/record-drift-evidence/checksum" >/dev/null
printf '%s\n' 'invalid checksum evidence' >"$tmp/record-drift-evidence/checksum"
expect_failure record-drift fixture_verify "$tmp/record-drift.git" \
  "$tmp/record-drift.git" "$tmp/record-drift-evidence/checksum"

make_managed_bare "$tmp/target-mode.git"
mkdir -m 0700 "$tmp/target-mode-evidence"
fixture_install "$tmp/target-mode.git" "$tmp/target-mode.git" \
  "$tmp/target-mode-evidence/checksum" >/dev/null
chmod 0644 "$tmp/target-mode.git/hooks/update.d/immutable-v-tags"
expect_failure target-mode fixture_verify "$tmp/target-mode.git" \
  "$tmp/target-mode.git" "$tmp/target-mode-evidence/checksum"

make_managed_bare "$tmp/target-symlink.git"
mkdir -m 0700 "$tmp/target-symlink-evidence"
ln -s /dev/null "$tmp/target-symlink.git/hooks/update.d/immutable-v-tags"
expect_failure target-symlink fixture_install "$tmp/target-symlink.git" \
  "$tmp/target-symlink.git" "$tmp/target-symlink-evidence/checksum"

make_managed_bare "$tmp/record-symlink.git"
mkdir -m 0700 "$tmp/record-symlink-evidence"
ln -s "$tmp/record-symlink-target" "$tmp/record-symlink-evidence/checksum"
expect_failure record-symlink fixture_install "$tmp/record-symlink.git" \
  "$tmp/record-symlink.git" "$tmp/record-symlink-evidence/checksum"

make_managed_bare "$tmp/managed-symlink.git"
mkdir -m 0700 "$tmp/managed-symlink-evidence"
rm -f -- "$tmp/managed-symlink.git/hooks/update.d/gitea"
ln -s /bin/true "$tmp/managed-symlink.git/hooks/update.d/gitea"
expect_failure managed-symlink fixture_install "$tmp/managed-symlink.git" \
  "$tmp/managed-symlink.git" "$tmp/managed-symlink-evidence/checksum"

make_managed_bare "$tmp/evidence-mode.git"
mkdir -m 0755 "$tmp/evidence-mode"
expect_failure evidence-mode fixture_install "$tmp/evidence-mode.git" \
  "$tmp/evidence-mode.git" "$tmp/evidence-mode/checksum"

printf '%s\n' 'immutable tag hook and installer refusal fixtures passed'
