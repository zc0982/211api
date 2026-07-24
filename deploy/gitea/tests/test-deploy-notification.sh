#!/usr/bin/env bash

set -euo pipefail

ROOT="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly ROOT
readonly DEPLOY="$ROOT/.gitea/workflows/deploy.yml"
readonly STEP_NAME='      - name: Notify final deployment result through Pipedream'
readonly ENDPOINT_HOST_CANARY='endpoint-host-canary'
readonly ENDPOINT_PATH_CANARY='secret-path-canary'
readonly ENDPOINT_QUERY_CANARY='query-canary'
readonly ENDPOINT_CANARY="https://$ENDPOINT_HOST_CANARY.m.pipedream.net/$ENDPOINT_PATH_CANARY?secret=$ENDPOINT_QUERY_CANARY"
readonly REQUEST_CANARY='decafbaddecafbaddecafbaddecafbaddecafbad'
readonly INVALID_INPUT_CANARY='request-canary'
readonly RUN_URL_CANARY='https://git.211api.com/211api/211api/actions/runs/987654321'
readonly RESPONSE_CANARY='response-canary'
readonly ERROR_CANARY='error-canary'

[[ "$(grep -Fxc "$STEP_NAME" "$DEPLOY")" -eq 1 ]]

notify_run="$({
  awk -v step="$STEP_NAME" '
    $0 == step { in_step = 1; next }
    in_step && !in_run && /^      - / { exit 5 }
    in_step && $0 == "        run: |" {
      if (found++) exit 2
      in_run = 1
      next
    }
    in_run && /^      - / { exit }
    in_run {
      if ($0 == "") { print; next }
      if ($0 !~ /^          /) exit 3
      sub(/^          /, "")
      print
    }
    END {
      if (found != 1 || !in_run) exit 4
    }
  ' "$DEPLOY"
})"

[[ -n "$notify_run" ]]
bash -n <<<"$notify_run"
if grep -Fq 'process.exit(' <<<"$notify_run"; then
  printf 'notification step may truncate its outcome marker with process.exit()\n' >&2
  exit 1
fi
[[ "$(grep -Eoc '(^|[^[:alnum:]_])fetch[[:space:]]*\(' <<<"$notify_run")" -eq 1 ]]
[[ "$(grep -Ec '^[[:space:]]*if ! node[[:space:]]+--input-type=module[[:space:]]+-e ' <<<"$notify_run")" -eq 1 ]]
if [[ "$(grep -Eo '(^|[^[:alnum:]_:])node([[:space:];|&<>()]|$)' <<<"$notify_run" | wc -l)" -ne 1 ]]; then
  printf 'notification step must contain exactly one standalone node invocation\n' >&2
  exit 1
fi
if grep -Eqi \
  -e '(^|[^[:alnum:]_])(curl|wget|aria2c|httpie|nc|ncat|netcat|socat|telnet|ftp|ssh|scp|sftp|openssl)([^[:alnum:]_]|$)' \
  -e '(^|[^[:alnum:]_])(python|python3|perl|ruby|php|deno|bun|java)([^[:alnum:]_]|$)' \
  -e '/dev/(tcp|udp)' \
  -e 'node:(http|https|net|tls|dgram|dns|child_process)' \
  -e "[\"'](node:)?(http|https|net|tls|dgram|dns|child_process|undici)[\"']" \
  -e '(http|https|net|tls|dgram)\.(request|get|connect|createConnection)' \
  -e '(^|[^[:alnum:]_])(WebSocket|EventSource|XMLHttpRequest)([^[:alnum:]_]|$)' \
  -e '(^|[[:space:];])(export[[:space:]]+)?PATH=' \
  <<<"$notify_run"; then
  printf 'notification step contains an unmocked network client\n' >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT
mock="$tmp_dir/fetch-mock.mjs"
mock_bin="$tmp_dir/bin"
mkdir -m 0700 "$mock_bin"
ln -s -- "$(command -v node)" "$mock_bin/node"
ln -s -- "$(command -v date)" "$mock_bin/date"

cat >"$mock" <<'EOF'
import { writeFileSync } from "node:fs";

const scenario = process.env.NOTIFY_TEST_SCENARIO;
const fetchLog = process.env.NOTIFY_TEST_FETCH_LOG;
const fetchReturnedLog = process.env.NOTIFY_TEST_FETCH_RETURNED_LOG;
const timerClearedLog = process.env.NOTIFY_TEST_TIMER_CLEARED_LOG;
const mockLoadedLog = process.env.NOTIFY_TEST_MOCK_LOADED_LOG;
const expectedEndpoint = process.env.NOTIFY_TEST_EXPECTED_ENDPOINT;
const expectedSha = process.env.NOTIFY_TEST_EXPECTED_SHA;
const expectedRunUrl = process.env.NOTIFY_TEST_EXPECTED_RUN_URL;
const expectedStatus = process.env.NOTIFY_TEST_EXPECTED_STATUS;
let fetchCount = 0;
let timerClearCount = 0;

writeFileSync(mockLoadedLog, "mock-loaded\n", { mode: 0o600 });

const recordFetch = () => writeFileSync(fetchLog, `${fetchCount}\n`, { mode: 0o600 });
const returnedResponse = (status, text) => {
  writeFileSync(fetchReturnedLog, "fetch-returned\n", { mode: 0o600 });
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => {
      if (scenario === "response-text-error") throw new Error("error-canary");
      return text;
    },
  };
};
const response = (status, text) => ({
  ...returnedResponse(status, text),
});
const nativeClearTimeout = globalThis.clearTimeout;

if (scenario === "timeout") {
  globalThis.setTimeout = (callback, delay) => {
    if (delay !== 15_000) throw new Error("timer-canary");
    queueMicrotask(callback);
    return 1;
  };
}
globalThis.clearTimeout = (timer) => {
  timerClearCount += 1;
  writeFileSync(timerClearedLog, `${timerClearCount}\n`, { mode: 0o600 });
  if (scenario !== "timeout") nativeClearTimeout(timer);
};

globalThis.fetch = async (endpoint, options) => {
  fetchCount += 1;
  recordFetch();
  let payload;
  try {
    payload = JSON.parse(options.body);
  } catch {
    throw new Error("error-canary");
  }
  const payloadKeys = ["commit", "event", "finished_at", "repository", "run_url", "schema", "status"];
  if (endpoint !== expectedEndpoint ||
      options.method !== "POST" || options.redirect !== "manual" ||
      options.headers?.["content-type"] !== "application/json" ||
      !(options.signal instanceof AbortSignal) ||
      JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(payloadKeys) ||
      payload.schema !== "gitea-deployment-notification.v1" ||
      payload.event !== "deployment-finished" || payload.status !== expectedStatus ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(payload.finished_at) ||
      payload.repository !== "211api/211api" || payload.commit !== expectedSha ||
      payload.run_url !== expectedRunUrl) {
    throw new Error("error-canary");
  }
  if (scenario === "timeout") {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("error-canary")), { once: true });
    });
  }
  if (scenario === "network") throw new Error("error-canary");
  if (scenario === "accepted") {
    return response(200, '{"ok":true,"event":"deployment-finished","diagnostic":"response-canary"}');
  }
  if (scenario === "invalid-json") return response(200, "response-canary");
  if (scenario === "response-text-error") return response(200, "response-canary");
  if (scenario === "response-contract") return response(200, '{"ok":false,"event":"response-canary"}');
  if (scenario.startsWith("http-")) {
    const status = Number.parseInt(scenario.slice(5), 10);
    return response(status, "response-canary");
  }
  throw new Error("unknown-scenario");
};
EOF

assert_output_safe() {
  local output=$1
  local canary
  for canary in \
    "$ENDPOINT_CANARY" \
    "$ENDPOINT_HOST_CANARY" \
    "$ENDPOINT_PATH_CANARY" \
    "$ENDPOINT_QUERY_CANARY" \
    "$REQUEST_CANARY" \
    "$INVALID_INPUT_CANARY" \
    "$RUN_URL_CANARY" \
    "$RESPONSE_CANARY" \
    "$ERROR_CANARY" \
    'gitea-deployment-notification.v1' \
    'deployment-finished' \
    '211api/211api'; do
    if grep -Fq "$canary" <<<"$output"; then
      printf 'notification output exposed a protected canary\n' >&2
      return 1
    fi
  done
}

if assert_output_safe "deployment-notification-outcome=network $REQUEST_CANARY" 2>/dev/null; then
  printf 'notification canary guard did not fail closed\n' >&2
  exit 1
fi

run_case() {
  local name=$1
  local scenario=$2
  local endpoint=$3
  local event_sha=$4
  local expected_fetches=$5
  local expected_marker=$6
  local build_deploy_result=${7:-success}
  local expected_status=${8:-success}
  local fetch_log="$tmp_dir/$name.fetches"
  local fetch_returned_log="$tmp_dir/$name.fetch-returned"
  local timer_cleared_log="$tmp_dir/$name.timer-cleared"
  local mock_loaded_log="$tmp_dir/$name.mock-loaded"
  local output status

  if output="$(env -i \
    PATH="$mock_bin" \
    NODE_OPTIONS="--import=$mock" \
    NOTIFY_TEST_SCENARIO="$scenario" \
    NOTIFY_TEST_FETCH_LOG="$fetch_log" \
    NOTIFY_TEST_FETCH_RETURNED_LOG="$fetch_returned_log" \
    NOTIFY_TEST_TIMER_CLEARED_LOG="$timer_cleared_log" \
    NOTIFY_TEST_MOCK_LOADED_LOG="$mock_loaded_log" \
    NOTIFY_TEST_EXPECTED_ENDPOINT="$endpoint" \
    NOTIFY_TEST_EXPECTED_SHA="$event_sha" \
    NOTIFY_TEST_EXPECTED_RUN_URL="$RUN_URL_CANARY" \
    NOTIFY_TEST_EXPECTED_STATUS="$expected_status" \
    PIPEDREAM_NOTIFY_URL="$endpoint" \
    EVENT_SHA="$event_sha" \
    RUN_URL="$RUN_URL_CANARY" \
    BUILD_DEPLOY_RESULT="$build_deploy_result" \
    "$BASH" -c "$notify_run" 2>&1)"; then
    status=0
  else
    status=$?
  fi

  [[ "$status" -eq 0 ]]
  assert_output_safe "$output"
  [[ "$(grep -Fxc "deployment-notification-outcome=$expected_marker" <<<"$output")" -eq 1 ]]
  if [[ "$expected_marker" == accepted || "$expected_marker" == skipped ]]; then
    [[ "$(grep -Fc 'Deployment notification delivery failed; deployment result is unchanged.' <<<"$output")" -eq 0 ]]
  else
    [[ "$(grep -Fxc 'Deployment notification delivery failed; deployment result is unchanged.' <<<"$output")" -eq 1 ]]
  fi
  if [[ "$expected_fetches" -eq 0 ]]; then
    [[ ! -e "$fetch_log" ]]
  else
    [[ "$(<"$fetch_log")" -eq "$expected_fetches" ]]
  fi
  if [[ -z "$endpoint" ]]; then
    [[ ! -e "$mock_loaded_log" ]]
  else
    [[ "$(<"$mock_loaded_log")" == mock-loaded ]]
  fi
  if [[ "$expected_fetches" -eq 0 ]]; then
    [[ ! -e "$timer_cleared_log" ]]
  else
    [[ "$(<"$timer_cleared_log")" -eq 1 ]]
  fi
  if [[ "$name" == response_text_error ]]; then
    [[ "$(<"$fetch_returned_log")" == fetch-returned ]]
  fi
}

# The configured endpoint and successful request/response canaries are intentionally
# opaque. The exact step gets only node/date on PATH; its sole fetch is preloaded with
# a fail-closed mock, and static guards reject other network clients and Node APIs.
run_case accepted accepted "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 accepted
run_case accepted_failed_deploy accepted "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 accepted failure failed
run_case accepted_path_colon accepted "https://$ENDPOINT_HOST_CANARY.m.pipedream.net/$ENDPOINT_PATH_CANARY:443?secret=$ENDPOINT_QUERY_CANARY" "$REQUEST_CANARY" 1 accepted
run_case skipped accepted '' "$REQUEST_CANARY" 0 skipped
run_case endpoint_validation accepted 'https://user@endpoint-canary.m.pipedream.net/' "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_password accepted 'https://user:password@endpoint-canary.m.pipedream.net/' "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_empty_userinfo accepted 'https://@endpoint-canary.m.pipedream.net/' "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_leading_whitespace accepted " $ENDPOINT_CANARY" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_trailing_whitespace accepted "$ENDPOINT_CANARY " "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_raw_whitespace accepted "https://$ENDPOINT_HOST_CANARY.m.pipedream.net/path with-space" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_http_scheme accepted "http://$ENDPOINT_HOST_CANARY.m.pipedream.net/" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_extra_slashes accepted "https:////$ENDPOINT_HOST_CANARY.m.pipedream.net/" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_wrong_host accepted 'https://endpoint-host-canary.example.test/' "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_suffix_confusion accepted "https://$ENDPOINT_HOST_CANARY.m.pipedream.net.example.test/" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_bare_suffix accepted 'https://m.pipedream.net/' "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_explicit_default_port accepted "https://$ENDPOINT_HOST_CANARY.m.pipedream.net:443/" "$REQUEST_CANARY" 0 endpoint-validation
run_case endpoint_explicit_nondefault_port accepted "https://$ENDPOINT_HOST_CANARY.m.pipedream.net:8443/" "$REQUEST_CANARY" 0 endpoint-validation
run_case input_validation accepted "$ENDPOINT_CANARY" "$INVALID_INPUT_CANARY" 0 input-validation
run_case timeout timeout "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 timeout
run_case network network "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 network
run_case http_3xx http-302 "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 http-3xx-302
run_case http_4xx http-400 "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 http-4xx-400
run_case http_5xx http-599 "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 http-5xx-599
run_case http_other http-199 "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 http-other-199
run_case invalid_json invalid-json "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 invalid-json
run_case response_text_error response-text-error "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 network
run_case response_contract response-contract "$ENDPOINT_CANARY" "$REQUEST_CANARY" 1 response-contract

printf 'deploy notification tests passed.\n'
