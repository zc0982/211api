#!/usr/bin/env bash

# Render, but never install, the disposable workflow used to prove that a
# failed validation prevents deployment.  Keeping the workflow out of the
# default branch makes it impossible for this smoke fixture to run against
# main or inherit the production deployment commands.
set -euo pipefail

[[ $# -eq 1 && $1 =~ ^ci-smoke-fail-gate-[0-9a-f]{16}$ ]] || {
  printf 'usage: %s <exact-smoke-branch>\n' "${0##*/}" >&2
  exit 64
}
readonly smoke_branch=$1

cat <<'YAML'
name: deploy-failure-gate-smoke

"on":
  push:
    branches:
YAML
printf '      - "%s"\n' "$smoke_branch"
cat <<'YAML'

permissions:
  contents: read

jobs:
  backend:
    name: backend
    runs-on: go-1.26.5
    steps:
      - name: Deliberately fail before validation or credentials
        shell: bash
        run: |
          set -euo pipefail
          printf '%s\n' 'failure-gate-smoke: intentional backend gate failure'
          exit 86

  verify:
    name: verify
    if: always()
    needs: backend
    runs-on: node-20.20.2
    steps:
      - name: Require backend to succeed
        env:
          BACKEND_RESULT: ${{ needs.backend.result }}
        shell: bash
        run: |
          set -euo pipefail
          printf 'failure-gate-smoke: backend-result=%s\n' "$BACKEND_RESULT"
          [[ "$BACKEND_RESULT" == success ]]

  build_deploy:
    name: build-and-deploy
    needs:
      - verify
    runs-on: docker-29.6.1
    steps:
      - name: Unreachable deployment sentinel
        shell: sh
        run: |
          set -eu
          printf '%s\n' 'UNREACHABLE: build/deploy job must be skipped' >&2
          exit 99

  notify:
    name: telegram-notification
    if: always()
    needs:
      - verify
      - build_deploy
    runs-on: linux-amd64
    steps:
      - name: Assert failed gate skipped build/deploy
        env:
          VERIFY_RESULT: ${{ needs.verify.result }}
          BUILD_DEPLOY_RESULT: ${{ needs.build_deploy.result }}
        shell: bash
        run: |
          set -euo pipefail
          [[ "$VERIFY_RESULT" == failure ]]
          [[ "$BUILD_DEPLOY_RESULT" == skipped ]]
          printf 'failure-gate-smoke: verify-result=%s build-deploy-result=%s\n' \
            "$VERIFY_RESULT" "$BUILD_DEPLOY_RESULT"
YAML
