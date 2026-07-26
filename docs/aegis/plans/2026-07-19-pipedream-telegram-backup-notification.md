# Pipedream Telegram Backup Notification Implementation Plan

> Retired (2026-07-26): this plan targeted the self-hosted Gitea delivery
> chain, which has been reverted and retired. GitHub Actions and GHCR own
> delivery again, and no Pipedream sender exists in the current tree. Kept as a
> historical record only; do not use it for alignment. Its parent design and
> plan under the `2026-07-18-gitea-cicd-migration` name were removed.

> Historical plan note (2026-07-22): the backup contract remains compatible,
> but `2026-07-22-automatic-deploy-telegram-notification.md` supersedes this
> plan's backup-only adapter scope and filename.

Date: `2026-07-19`
Status: `approved-spec implementation plan`
Parent design: `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`
Parent plan: `docs/aegis/plans/2026-07-18-gitea-cicd-migration.md`

## Goal

Implement and verify the approved, narrow notification path in which Netcup's
existing `gitea-backup-notify` sender posts bounded nonsecret JSON to Pipedream,
and Pipedream alone translates a valid backup failure into a Telegram
`sendMessage` call to the dedicated private operations group.

Task 9 ends with the Pipedream endpoint installed as root-owned mode `0600` on
Netcup, a silent live preflight returning HTTP 2xx, one explicit synthetic test
alert received in Telegram, and evidence updated without recording the endpoint,
bot token, chat ID, or any private key. Gitea and Runner remain stopped and
Gateway remains untouched.

## Architecture

```text
/opt/gitea/platform/gitea-backup-notify (Netcup)
  -> POST application/json
  -> root-only /etc/gitea/backup-notify-url
  -> Pipedream HTTP trigger
  -> versioned Node.js adapter
  -> Telegram Bot API sendMessage
  -> dedicated private operations group
```

Canonical owners:

- Netcup owns failure-marker persistence and the fixed outbound sender.
- The repository owns the reviewed, copy-pasteable Pipedream adapter source and
  its deterministic unit tests.
- Pipedream owns runtime execution and the two project secrets
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Telegram is only the delivery destination; it is not a CI/CD or backup owner.

## Tech Stack

- Pipedream HTTP / Webhook trigger
- Pipedream Node.js 20 code step and `$.respond()`
- Node.js built-in `fetch`, `AbortController`, and `node:test`
- Telegram Bot API `sendMessage`
- Existing Bash/curl sender on Netcup
- Aegis workspace evidence for Task 9

## Baseline/Authority Refs

- `docs/aegis/specs/2026-07-18-gitea-cicd-migration-design.md`, especially
  sections 8, 10.1.1, 13.1, 14.4, 15, and 16.
- `docs/aegis/plans/2026-07-18-gitea-cicd-migration.md`, Tasks 4 and 9.
- `deploy/gitea/platform/gitea-backup-notify`.
- `deploy/gitea/platform/gitea-backup`, function `probe_webhook`.
- `deploy/gitea/README.md`.
- Pipedream HTTP trigger, environment variable, Node.js, and HTTP response
  documentation cited by the parent design.
- Telegram Bot API `sendMessage` documentation cited by the parent design.

## Baseline Usage Draft

- Required baseline refs: approved parent design, parent implementation plan,
  existing Netcup sender, current Task 9 evidence.
- Acknowledged before plan refs: all required refs above.
- Cited in plan refs: all required refs above.
- Missing refs: none.
- Decision: `continue`.

## Requirement Ready Check

- Requirement source refs: approved parent design and explicit 2026-07-19
  written-spec approval.
- Goal and scope refs: parent design sections 10.1.1 and 14.4.
- User/scenario refs: dedicated bot, dedicated private group, credentials only
  in Pipedream, Gateway still production owner.
- Acceptance refs: exact payload validation, silent preflight, synthetic test,
  Telegram `ok: true`, negative adapter tests, root-only endpoint, and no runtime
  start.
- Open blocker questions: none for repository implementation. The operator must
  paste/deploy the reviewed step in the already-created Pipedream workflow and
  install the endpoint without disclosing it.
- Decision: `ready`.

## Compatibility Boundary

- Do not change the two existing Netcup JSON payload shapes.
- Do not add an Authorization-header secret to Netcup; its reviewed contract
  stores one opaque HTTPS endpoint only.
- Do not restore any GitHub release/deploy Telegram step, credential, bot, or
  chat.
- Do not route CI, security scan, release, deployment, Gateway, or business
  application events through this adapter.
- Do not start Gitea/Runner, create DNS/TLS state, or modify Gateway in this
  slice.
- Do not record the actual endpoint, bot token, chat ID, or age identity in Git,
  evidence, process arguments, or terminal output.

## TDD Route

- Mode: `off`.
- Decision: `skipped`.
- Strict authority: `not applicable`.
- Test posture: post-change regression with deterministic mocked Telegram
  responses, followed by bounded live preflight and one synthetic alert.
- Reason: no explicit strict-TDD request exists; the adapter is isolated and can
  be verified proportionally without prescribing RED/GREEN ceremony.
- Verification: `node --test` plus live Pipedream and Netcup probes.

## Change Necessity

- User-visible need: backup failures must arrive in the dedicated Telegram group
  without putting the bot token on Netcup.
- No-change option: an unversioned Pipedream editor cell would work temporarily
  but would leave no auditable source, deterministic regression test, or rebuild
  path.
- Why code change is necessary: Pipedream requires adapter logic to validate the
  fixed schema, suppress preflight noise, call Telegram, and propagate delivery
  failure.
- Minimum change boundary: one copy-pasteable `.mjs` adapter, one Node test file,
  and notification-specific operator documentation. Existing sender behavior is
  unchanged.
- Decision: `code-change`.

## Existence Check

- Proposed new surface: `deploy/gitea/pipedream/` adapter source and test.
- Existing owner/reuse candidate: the existing Bash sender cannot own Telegram
  without placing the bot token on Netcup; Pipedream's editor alone is not a
  versioned repository owner.
- Why existing surface is insufficient: the sender deliberately knows only the
  endpoint and fixed nonsecret schema.
- Creation proof: one isolated adapter is required by the approved cross-system
  boundary and provides the only tested translation to Telegram.
- Entropy/retirement impact: legacy release/deploy Telegram owners remain
  deleted; no fallback or second Telegram adapter is added.
- Decision: `add-with-proof`.

## Architecture Integrity Lens

- Invariant: Gitea remains the only delivery owner and Gateway remains the only
  production runtime owner.
- Canonical contract: Netcup fixed JSON -> Pipedream validation/translation ->
  Telegram plain-text message.
- Responsibility overlap: none; Netcup never learns Telegram credentials and
  Pipedream never handles backup contents or deployment authority.
- Higher-level simplification: reuse the existing sender and HTTP trigger rather
  than adding a second host daemon, direct Telegram curl, or business bot.
- Retirement/falsifier: any Telegram call outside the one Pipedream adapter, or
  any legacy release/deploy Telegram reference, invalidates this plan.
- Verdict: proceed.

## Plan Pressure Test

- Owner/contract/retirement: explicit and aligned with the approved spec.
- Architecture integrity: one adapter and no fallback.
- Verification scope: unit tests cover all response branches; live tests cover
  silent preflight and one end-to-end Telegram message.
- Task executability: repository changes are local; the operator UI step and
  secret endpoint transfer are spelled out without revealing values.
- Pressure result: `proceed`.

## Plan-Time Complexity Check

- Artifact class: isolated external adapter.
- Target files: one adapter under 180 lines, one test under 260 lines, bounded
  README additions.
- Current pressure: no existing Pipedream source owner.
- Projected pressure: within budget; schema validation, rendering, delivery, and
  response mapping remain in one small single-purpose component.
- Better boundary: dedicated `deploy/gitea/pipedream/` directory rather than
  embedding external code in the platform Bash sender or the root README.
- Recommendation: add owner file; no application or host-script refactor.

## Execution Readiness View

- Intent Lock: only Gitea platform backup failures reach Telegram.
- Scope Fence: repository adapter/tests/docs, Pipedream workflow, and Task 9
  Netcup endpoint/preflight evidence only.
- Baseline Lock: approved parent design plus existing sender payloads.
- Approved Behavior: strict JSON POST validation, quiet preflight, bounded
  failure message, `ok: true` success, generic non-2xx failure.
- Owner/Contract Constraints: Telegram secrets only in Pipedream; endpoint only
  in Netcup's root-only file.
- Compatibility Boundary: legacy Telegram release/deploy path stays retired;
  Gateway and stopped platform state remain unchanged.
- Retirement Boundary: no old bot/token/chat/code reuse.
- Task Batches: repository adapter; operator Pipedream deployment; Netcup
  endpoint install/probe; evidence close.
- Test Obligations: Node mocked branches, exact live preflight, one synthetic
  notification, remote mode/owner/no-listener assertions.
- Review Gates: stop if Pipedream code differs from the committed source, the
  endpoint appears in output, Telegram does not return `ok: true`, or Netcup
  gains a new listener/container.
- Drift/Rewind Rules: repair the committed adapter and redeploy the exact source;
  do not add a direct-Telegram fallback.
- Evidence Required Before Completion: commit IDs, test exit codes, redacted
  Pipedream response classes, Telegram receipt confirmation, Netcup presence-only
  file metadata, HTTP status, preserved-service/no-container/no-listener checks.
- Advisory Boundary: method-pack execution guidance only; not GateDecision,
  PolicySnapshot, or completion authority.

## File Map

Create:

- `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs` — canonical Pipedream
  code-step source.
- `deploy/gitea/pipedream/gitea-backup-to-telegram.test.mjs` — deterministic
  Node tests with no network access.

Modify:

- `deploy/gitea/README.md` — Pipedream creation, paste/deploy, masked testing,
  and endpoint installation instructions.
- `docs/aegis/plans/2026-07-18-gitea-cicd-migration.md` — narrow every Telegram
  retirement statement to legacy release/deploy behavior and link this plan.
- `docs/aegis/work/2026-07-18-gitea-cicd-migration/evidence-bundle-draft-task9-netcup-preflight.json`
  — record only presence, owner/mode, status classes, and unchanged runtime.
- `docs/aegis/work/2026-07-18-gitea-cicd-migration/20-checkpoint.md` and
  `90-evidence.md` — close Task 9 and name Task 10 as next without starting it.

## Task 1: Add the Versioned Pipedream Adapter

**Files:** create `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs`.

**Why:** make the external workflow reproducible and enforce the approved
payload, ownership, and failure contracts.

**Impact/Compatibility:** adds no dependency and changes no existing sender.
It must be pasted without modification into a Pipedream Node.js code step.

**Step 1: create the adapter with this complete content.**

```javascript
const SCHEMA = "gitea-backup-notification.v1";
const PREFLIGHT_KEYS = ["event", "schema", "status"];
const FAILURE_KEYS = ["code", "event", "failed_at", "schema", "status", "unit"];
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expected) {
  return Object.keys(value).sort().join("\n") === expected.join("\n");
}

function isUtcSecond(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString() === `${value.slice(0, -1)}.000Z`;
}

function classifyPayload(body) {
  if (!isRecord(body) || body.schema !== SCHEMA) {
    return null;
  }
  if (body.event === "preflight" && body.status === "ok" &&
      hasExactKeys(body, PREFLIGHT_KEYS)) {
    return "preflight";
  }
  if (body.event !== "backup-failed" || body.status !== "failed" ||
      !hasExactKeys(body, FAILURE_KEYS) || !isUtcSecond(body.failed_at) ||
      typeof body.code !== "string" || !/^[a-z0-9-]{1,48}$/.test(body.code) ||
      typeof body.unit !== "string" || !/^[0-9A-Za-z_.@-]{1,128}$/.test(body.unit)) {
    return null;
  }
  return "backup-failed";
}

function renderMessage(body) {
  const heading = body.code === "notification-test"
    ? "🧪 Gitea 备份告警测试"
    : "🚨 Gitea 平台备份失败";
  return [
    heading,
    `时间（UTC）：${body.failed_at}`,
    `错误代码：${body.code}`,
    `systemd 单元：${body.unit}`,
  ].join("\n");
}

function validConfiguration(token, chatId) {
  return typeof token === "string" && token.length >= 20 && token.length <= 256 &&
    !/\s/.test(token) && typeof chatId === "string" &&
    /^-[1-9][0-9]{0,19}$/.test(chatId);
}

export default defineComponent({
  async run({ steps, $ }) {
    const respond = async (status, body) => {
      await $.respond({ status, headers: JSON_HEADERS, body });
      return body;
    };

    const request = steps?.trigger?.event;
    const contentType = request?.headers?.["content-type"];
    if (request?.method !== "POST" || typeof contentType !== "string" ||
        !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return respond(400, { ok: false, error: "invalid_request" });
    }

    const kind = classifyPayload(request.body);
    if (kind === null) {
      return respond(400, { ok: false, error: "invalid_payload" });
    }
    if (kind === "preflight") {
      return respond(200, { ok: true, event: "preflight" });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!validConfiguration(token, chatId)) {
      return respond(500, { ok: false, error: "configuration_error" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: renderMessage(request.body) }),
          signal: controller.signal,
        },
      );
      let telegram = null;
      try {
        telegram = await response.json();
      } catch {
        telegram = null;
      }
      if (!response.ok || telegram?.ok !== true) {
        return respond(502, { ok: false, error: "telegram_delivery_failed" });
      }
      return respond(200, { ok: true, event: "backup-failed" });
    } catch {
      return respond(502, { ok: false, error: "telegram_delivery_failed" });
    } finally {
      clearTimeout(timeout);
    }
  },
});
```

**Step 2: syntax-check the component.**

```bash
node --check deploy/gitea/pipedream/gitea-backup-to-telegram.mjs
```

Expected: exit `0`, no output.

## Task 2: Add Deterministic Adapter Tests

**Files:** create
`deploy/gitea/pipedream/gitea-backup-to-telegram.test.mjs`.

**Why:** prove every validation and Telegram-response branch without using the
real endpoint, token, chat, or network.

**Impact/Compatibility:** tests temporarily replace `globalThis.fetch` and the
two process variables, restore them after every invocation, and run serially.

**Step 1: create the test with this complete content.**

```javascript
import assert from "node:assert/strict";
import test from "node:test";

globalThis.defineComponent = (component) => component;
const { default: component } = await import("./gitea-backup-to-telegram.mjs");
delete globalThis.defineComponent;

const TOKEN = "1234567890:abcdefghijklmnopqrstuvwxyzABCDE";
const CHAT_ID = "-1234567890";
const FAILURE = {
  schema: "gitea-backup-notification.v1",
  event: "backup-failed",
  status: "failed",
  failed_at: "2026-07-19T00:00:00Z",
  code: "notification-test",
  unit: "gitea-backup.service",
};

async function invoke(event, fakeFetch) {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const responses = [];
  globalThis.fetch = fakeFetch;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_CHAT_ID = CHAT_ID;
  try {
    const result = await component.run({
      steps: { trigger: { event } },
      $: { respond: async (response) => responses.push(response) },
    });
    assert.equal(responses.length, 1);
    return { response: responses[0], result };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = originalChatId;
  }
}

function request(body, overrides = {}) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    ...overrides,
  };
}

test("preflight is silent and returns 200", { concurrency: false }, async () => {
  let calls = 0;
  const result = await invoke(
    request({ schema: FAILURE.schema, event: "preflight", status: "ok" }),
    async () => { calls += 1; throw new Error("must not call Telegram"); },
  );
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.result, { ok: true, event: "preflight" });
  assert.equal(calls, 0);
});

test("invalid requests return 400 without Telegram", { concurrency: false }, async () => {
  const invalid = [
    request(FAILURE, { method: "GET" }),
    request(FAILURE, { headers: { "content-type": "text/plain" } }),
    request({ ...FAILURE, extra: true }),
    request({ ...FAILURE, failed_at: "2026-99-99T00:00:00Z" }),
    request({ ...FAILURE, code: "UPPER_CASE" }),
    request({ ...FAILURE, unit: "bad unit" }),
    request({ schema: "unknown.v1", event: "preflight", status: "ok" }),
  ];
  for (const event of invalid) {
    let calls = 0;
    const result = await invoke(event, async () => { calls += 1; });
    assert.equal(result.response.status, 400);
    assert.equal(calls, 0);
  }
});

test("valid failure sends bounded Telegram message", { concurrency: false }, async () => {
  let captured;
  const result = await invoke(request(FAILURE), async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  });
  assert.equal(result.response.status, 200);
  assert.equal(captured.url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
  const body = JSON.parse(captured.options.body);
  assert.equal(body.chat_id, CHAT_ID);
  assert.match(body.text, /Gitea 备份告警测试/);
  assert.match(body.text, /notification-test/);
  assert.match(body.text, /gitea-backup\.service/);
  assert.doesNotMatch(JSON.stringify(result.response), new RegExp(TOKEN));
  assert.doesNotMatch(JSON.stringify(result.response), new RegExp(CHAT_ID));
});

for (const [name, fakeFetch] of [
  ["Telegram HTTP failure", async () => ({ ok: false, json: async () => ({ ok: false }) })],
  ["Telegram ok false", async () => ({ ok: true, json: async () => ({ ok: false }) })],
  ["Telegram malformed JSON", async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } })],
  ["Telegram network failure", async () => { throw new Error("network"); }],
]) {
  test(`${name} returns 502`, { concurrency: false }, async () => {
    const result = await invoke(request(FAILURE), fakeFetch);
    assert.equal(result.response.status, 502);
    assert.deepEqual(result.result, { ok: false, error: "telegram_delivery_failed" });
  });
}

test("missing configuration returns 500 without Telegram", { concurrency: false }, async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  const responses = [];
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; };
  try {
    const result = await component.run({
      steps: { trigger: { event: request(FAILURE) } },
      $: { respond: async (response) => responses.push(response) },
    });
    assert.equal(responses[0].status, 500);
    assert.deepEqual(result, { ok: false, error: "configuration_error" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = originalChatId;
  }
});
```

**Step 2: run the focused regression.**

```bash
node --test deploy/gitea/pipedream/gitea-backup-to-telegram.test.mjs
```

Expected: all tests pass; no real network request occurs.

**Step 3: run source safety checks.**

```bash
! rg -n 'console\.|\.m\.pipedream\.net|api\.telegram\.org/bot[0-9]+:' \
  deploy/gitea/pipedream
```

Expected: exit `0` and no output. The literal generic Telegram API template in
the adapter remains allowed because it contains `${token}`, not a token value.

**Step 4: commit Tasks 1-2.**

```bash
git add deploy/gitea/pipedream
git commit -m "ops: version Pipedream Telegram backup adapter"
```

## Task 3: Align Operator Documentation and the Parent Plan

**Files:** modify `deploy/gitea/README.md` and the parent plan.

**Why:** eliminate the remaining ambiguous statement that all Telegram behavior
is retired and make the external workflow reproducible without disclosing its
secrets.

**Change:**

1. Link `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs` as the only source
   that may be pasted into the Pipedream Node.js step.
2. Document HTTP / Webhook `New Requests`, Authorization `None`, then `Run custom
   code` with the committed file pasted byte-for-byte.
3. Require the workflow and the two project secrets to share the same Pipedream
   project; prohibit logging `process.env` or either variable.
4. Document that the Pipedream URL is bearer-like and must not be pasted into
   chat, Git, screenshots, or shell history.
5. Replace broad Telegram-retirement wording in the parent plan with
   "legacy Telegram release/deploy" and link this plan as the only exception.

**Verification:**

```bash
rg -n 'Pipedream|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|legacy Telegram' \
  deploy/gitea/README.md \
  docs/aegis/plans/2026-07-18-gitea-cicd-migration.md
git diff --check
```

Expected: documentation names variables but contains no values; broad retirement
language no longer contradicts the approved exception.

**Commit:**

```bash
git add -u -- deploy/gitea/README.md \
  docs/aegis/plans/2026-07-18-gitea-cicd-migration.md
git commit -m "docs: document Pipedream backup notifications"
```

## Task 4: Deploy and Validate the Pipedream Workflow

**External surface:** the operator's Pipedream project and Telegram group.

**Why:** the repository source is not active until the operator deploys the
exact code step in the workflow that owns the two secrets.

**Steps:**

1. In the same Pipedream project that contains the two secrets, open the existing
   workflow `gitea-backup-failure-to-telegram`.
2. Keep the trigger as `HTTP / Webhook` -> `New Requests`, Event Data
   `Full HTTP request`, Authorization `None`, and HTTP Response set to the
   custom-response-from-workflow option. `Return HTTP 200 OK` is forbidden
   because it would hide the adapter's 400/500/502 failure statuses.
3. Add `Run custom code`, select Node.js, and paste the complete contents of
   `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs` without edits.
4. Deploy the workflow. Do not copy the endpoint into this chat.
5. On the operator machine, read the endpoint without shell-history exposure:

   ```bash
   umask 077
   read -rsp 'Pipedream Webhook URL: ' WEBHOOK_URL; echo
   case "$WEBHOOK_URL" in
     https://*.m.pipedream.net) ;;
     *) printf 'unexpected Pipedream URL\n' >&2; unset WEBHOOK_URL; exit 1 ;;
   esac
   ```

6. Run the silent preflight and require HTTP 200:

   ```bash
   status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
     --connect-timeout 5 --max-time 15 \
     --header 'Content-Type: application/json' \
     --data-binary '{"schema":"gitea-backup-notification.v1","event":"preflight","status":"ok"}' \
     "$WEBHOOK_URL")"
   [[ "$status" == 200 ]]
   ```

7. Run one invalid-schema probe and require HTTP 400:

   ```bash
   status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
     --connect-timeout 5 --max-time 15 \
     --header 'Content-Type: application/json' \
     --data-binary '{"schema":"invalid.v1","event":"preflight","status":"ok"}' \
     "$WEBHOOK_URL")"
   [[ "$status" == 400 ]]
   ```

8. Run exactly one synthetic end-to-end alert and require HTTP 200:

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

9. Confirm visually that the dedicated private group received one message headed
   `🧪 Gitea 备份告警测试`, containing the UTC time, `notification-test`, and
   `gitea-backup.service`, with no token, URL, or log text.
10. Keep `WEBHOOK_URL` only for the immediately following secure install; do not
    print it.

**Stop conditions:** any unexpected status, missing Telegram message, different
code in the deployed Pipedream step, or secret appearing in Pipedream logs stops
execution before Netcup installation.

## Task 5: Install the Endpoint on Netcup and Close Task 9

**External surface:** Netcup `37.221.194.27` over the existing administrative SSH
port `4422` only.

**Why:** make the reviewed sender able to reach the already-proven workflow while
preserving the no-start/no-Gateway boundary.

**Steps:**

1. From the same operator shell where `WEBHOOK_URL` is still set, install it over
   stdin so it never appears in argv or command history:

   ```bash
   printf '%s\n' "$WEBHOOK_URL" | \
     ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
       -i ~/.ssh/211api_root_37_221_194_27_4422 -p 4422 \
       root@37.221.194.27 \
       'umask 077; install -o root -g root -m 0600 /dev/stdin /etc/gitea/backup-notify-url'
   unset WEBHOOK_URL
   ```

2. Over the same SSH channel, validate presence without printing content:

   ```bash
   test -f /etc/gitea/backup-notify-url
   test ! -L /etc/gitea/backup-notify-url
   test "$(stat -c '%u:%g:%a' /etc/gitea/backup-notify-url)" = 0:0:600
   test "$(wc -l </etc/gitea/backup-notify-url)" -eq 1
   ```

3. Build the exact preflight payload in root-only temporary files, require HTTP
   200, and print only the status class:

   ```bash
   ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
     -i ~/.ssh/211api_root_37_221_194_27_4422 -p 4422 \
     root@37.221.194.27 '
       set -euo pipefail
       umask 077
       runtime=/run/gitea-backup-task9
       test ! -L "$runtime"
       install -d -o root -g root -m 0700 "$runtime"
       config="$(mktemp "$runtime/webhook.XXXXXX.curl")"
       payload="$(mktemp "$runtime/webhook.XXXXXX.json")"
       cleanup() { rm -f -- "$config" "$payload"; }
       trap cleanup EXIT HUP INT TERM
       mapfile -t lines </etc/gitea/backup-notify-url
       test "${#lines[@]}" -eq 1
       url="${lines[0]}"
       [[ "$url" == https://* && "$url" != *[[:space:]]* &&
          "$url" != *\"* && "$url" != *\\* ]]
       printf "url = \"%s\"\n" "$url" >"$config"
       jq -n '\''{schema:"gitea-backup-notification.v1",event:"preflight",status:"ok"}'\'' >"$payload"
       chmod 0600 "$config" "$payload"
       status="$(curl --config "$config" --silent --show-error --fail \
         --connect-timeout 5 --max-time 15 \
         --header "Content-Type: application/json" \
         --data-binary "@$payload" --output /dev/null --write-out "%{http_code}")"
       test "$status" = 200
       printf "webhook_preflight_http=200\n"
     '
   ```

4. Re-run the no-start, preserved-service, time-sync, and Compose-render checks:

   ```bash
   ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
     -i ~/.ssh/211api_root_37_221_194_27_4422 -p 4422 \
     root@37.221.194.27 '
       set -euo pipefail
       test -z "$(docker ps -aq)"
       ! ps -eo comm= | grep -Eq "^(gitea|act_runner)$"
       test "$(timedatectl show -p NTPSynchronized --value)" = yes
       for unit in hermes-gateway.service komari-agent.service docker.service \
         systemd-timesyncd.service fail2ban.service; do
         systemctl is-active --quiet "$unit"
       done
       docker compose --env-file /opt/gitea/images.lock.env \
         --env-file /etc/gitea/platform.env \
         -f /opt/gitea/platform/compose.yaml config --quiet
       docker compose --env-file /opt/gitea/images.lock.env \
         -f /opt/gitea/runner/compose.yaml config --quiet
       test "$(ss -H -lntp | wc -l)" -eq 2
       ss -H -lntp | awk '\''$4 !~ /:4422$/ { exit 1 }'\''
       printf "task9_runtime_boundary=pass\n"
     '
   ```
5. Update Task 9 evidence with:
   - `backup-notify-url`: present, regular, root:root `0600`, one line;
   - live preflight status: `200`;
   - synthetic Pipedream/Telegram result: operator-confirmed, no identifier;
   - Gitea/Runner still not started;
   - Gateway untouched;
   - the exact repository adapter commit and test outcome.
6. Update checkpoint/evidence narrative so Task 9 is complete and Task 10 is the
   next step. Do not execute Task 10.
7. Run JSON validation, Aegis bundle/check, secret-pattern scans, and
   `git diff --check`.
8. Commit only evidence/checkpoint changes:

   ```bash
   git add -u -- docs/aegis/work/2026-07-18-gitea-cicd-migration
   git commit -m "docs: close Netcup notification preflight"
   ```

## Verification Matrix

| Requirement | Evidence |
| --- | --- |
| Exact schema and method | Node invalid-request table; live invalid schema 400 |
| Quiet readiness | unit fetch-call count zero; live preflight 200; no Telegram message |
| End-to-end alert | live `notification-test` 200 plus operator group confirmation |
| Telegram fail-closed | mocked HTTP/non-JSON/`ok:false`/network branches return 502 |
| Credential ownership | Pipedream variable presence-only confirmation; repository/host scans |
| Endpoint secrecy | stdin install; root:root 0600 metadata; no content in evidence/output |
| Retirement | lingering-reference scan finds no legacy release/deploy Telegram owner |
| Runtime boundary | zero platform/Runner containers/process/listeners; Gateway untouched |

## Risks and Rollback Surface

- Endpoint leakage permits trigger spam. Rotate the Pipedream endpoint, install
  the new URL and prove preflight, then disable the old endpoint.
- Pipedream or Telegram outage leaves the Netcup failure marker intact because
  the adapter returns non-2xx unless Telegram proves `ok: true`.
- A mistaken Pipedream edit creates drift. Re-paste the committed adapter and
  rerun the entire Task 4 matrix; never patch only the live editor.
- Removing `/etc/gitea/backup-notify-url` disables notification and makes backup
  preflight fail closed; it does not affect Gateway or delete backup data.
- No destructive persistent-state operation is authorized by this plan.

## Repair and Retirement Tracks

Repair track:

- Canonical repair owner: the committed Pipedream adapter source.
- Minimum stable repair: correct the adapter, rerun Node tests, redeploy exact
  source, rerun live matrix.
- Compatibility: existing Netcup sender payloads remain unchanged.

Retirement track:

- Old owner: GitHub/DockerHub release and deployment Telegram notification code.
- Status: deleted/retired; it must not be reintroduced.
- Retained behavior: only the new Pipedream adapter for Gitea backup failures.
- Negative verification: no Telegram credential on Netcup/Gateway/Gitea and no
  Telegram call outside `deploy/gitea/pipedream/gitea-backup-to-telegram.mjs`.

## ADR and Baseline Signal

Completion review must add the approved notification boundary to the migration
ADR or its baseline sync: Pipedream is the only Telegram adapter, legacy
release/deploy Telegram paths remain retired, and the endpoint-only Netcup
contract is an explicit bounded security trade-off.

## Plan Self-Review

- Spec coverage: every section 10.1.1 and 14.4 requirement maps to Tasks 1-5.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step.
- Type consistency: Pipedream request fields and the existing Bash payloads
  match exactly.
- Compatibility: sender, Gateway, release retirement, and no-start boundaries
  are explicit.
- Change necessity/existence: the single adapter has proof; no fallback is
  introduced.
- Complexity: isolated files stay single-purpose.
- Verification: commands and expected status classes are explicit.
- Dual track: adapter repair and legacy notification retirement are both
  preserved.
