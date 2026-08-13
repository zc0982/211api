#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

check_openai_first_output_timeouts() {
  file=$1
  for setting in \
    'GATEWAY_OPENAI_FIRST_OUTPUT_TIMEOUT_SECONDS=${GATEWAY_OPENAI_FIRST_OUTPUT_TIMEOUT_SECONDS:-55}' \
    'GATEWAY_OPENAI_HIGH_EFFORT_FIRST_OUTPUT_TIMEOUT_SECONDS=${GATEWAY_OPENAI_HIGH_EFFORT_FIRST_OUTPUT_TIMEOUT_SECONDS:-55}'
  do
    count=$(grep -F -c -- "- $setting" "$file" || true)
    if [ "$count" -ne 1 ]; then
      printf '%s must pass %s exactly once\n' "$file" "${setting%%=*}" >&2
      exit 1
    fi
  done
}

for compose_file in \
  deploy/docker-compose.yml \
  deploy/docker-compose.local.yml \
  deploy/docker-compose.standalone.yml \
  deploy/docker-compose.dev.yml
do
  check_openai_first_output_timeouts "$compose_file"
done

for setting in \
  'GATEWAY_OPENAI_FIRST_OUTPUT_TIMEOUT_SECONDS=55' \
  'GATEWAY_OPENAI_HIGH_EFFORT_FIRST_OUTPUT_TIMEOUT_SECONDS=55'
do
  count=$(grep -F -c -- "$setting" deploy/.env.example || true)
  if [ "$count" -ne 1 ]; then
    printf 'deploy/.env.example must document %s exactly once\n' "${setting%%=*}" >&2
    exit 1
  fi
done

printf 'docker compose OpenAI timeout test passed\n'
