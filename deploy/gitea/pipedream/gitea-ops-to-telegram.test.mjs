import assert from "node:assert/strict";
import test from "node:test";

globalThis.defineComponent = (component) => component;
const { default: component } = await import("./gitea-ops-to-telegram.mjs");
delete globalThis.defineComponent;

const TOKEN = "1234567890:abcdefghijklmnopqrstuvwxyzABCDE";
const CHAT_ID = "-1234567890";
const BACKUP_FAILURE = {
  schema: "gitea-backup-notification.v1",
  event: "backup-failed",
  status: "failed",
  failed_at: "2026-07-19T00:00:00Z",
  code: "notification-test",
  unit: "gitea-backup.service",
};
const DEPLOYMENT = {
  schema: "gitea-deployment-notification.v1",
  event: "deployment-finished",
  status: "success",
  finished_at: "2026-07-22T14:00:00Z",
  repository: "211api/211api",
  commit: "0123456789abcdef0123456789abcdef01234567",
  run_url: "https://git.211api.com/211api/211api/actions/runs/180",
};

async function invoke(event, fakeFetch, configured = true) {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const responses = [];
  globalThis.fetch = fakeFetch;
  if (configured) {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_CHAT_ID = CHAT_ID;
  } else {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
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

function telegramOk(capture) {
  return async (url, options) => {
    capture.url = url;
    capture.options = options;
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  };
}

test("backup preflight remains silent", { concurrency: false }, async () => {
  let calls = 0;
  const result = await invoke(
    request({ schema: BACKUP_FAILURE.schema, event: "preflight", status: "ok" }),
    async () => { calls += 1; throw new Error("must not call Telegram"); },
  );
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.result, { ok: true, event: "preflight" });
  assert.equal(calls, 0);
});

test("backup failure compatibility sends the existing message", { concurrency: false }, async () => {
  const capture = {};
  const result = await invoke(request(BACKUP_FAILURE), telegramOk(capture));
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.result, { ok: true, event: "backup-failed" });
  const body = JSON.parse(capture.options.body);
  assert.match(body.text, /Gitea 备份告警测试/);
  assert.match(body.text, /gitea-backup\.service/);
});

for (const status of ["success", "failed"]) {
  test(`deployment ${status} sends a bounded result message`, { concurrency: false }, async () => {
    const capture = {};
    const result = await invoke(
      request({ ...DEPLOYMENT, status }),
      telegramOk(capture),
    );
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.result, { ok: true, event: "deployment-finished" });
    assert.equal(capture.url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(capture.options.body);
    assert.equal(body.chat_id, CHAT_ID);
    assert.match(body.text, status === "success" ? /部署成功/ : /部署失败/);
    assert.match(body.text, /0123456789ab/);
    assert.match(body.text, /actions\/runs\/180/);
    assert.doesNotMatch(JSON.stringify(result.response), new RegExp(TOKEN));
    assert.doesNotMatch(JSON.stringify(result.response), new RegExp(CHAT_ID));
  });
}

test("invalid requests and payloads never call Telegram", { concurrency: false }, async () => {
  const invalid = [
    request(BACKUP_FAILURE, { method: "GET" }),
    request(BACKUP_FAILURE, { headers: { "content-type": "text/plain" } }),
    request({ ...BACKUP_FAILURE, extra: true }),
    request({ ...BACKUP_FAILURE, failed_at: "2026-99-99T00:00:00Z" }),
    request({ ...DEPLOYMENT, status: "skipped" }),
    request({ ...DEPLOYMENT, commit: "short" }),
    request({ ...DEPLOYMENT, repository: "other/repo" }),
    request({ ...DEPLOYMENT, run_url: "https://example.com/actions/runs/180" }),
    request({ ...DEPLOYMENT, extra: true }),
    request({ schema: "unknown.v1", event: "preflight", status: "ok" }),
  ];
  for (const event of invalid) {
    let calls = 0;
    const result = await invoke(event, async () => { calls += 1; });
    assert.equal(result.response.status, 400);
    assert.equal(calls, 0);
  }
});

for (const [name, fakeFetch] of [
  ["Telegram HTTP failure", async () => ({ ok: false, json: async () => ({ ok: false }) })],
  ["Telegram ok false", async () => ({ ok: true, json: async () => ({ ok: false }) })],
  ["Telegram malformed JSON", async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } })],
  ["Telegram network failure", async () => { throw new Error("network"); }],
]) {
  test(`${name} returns 502`, { concurrency: false }, async () => {
    const result = await invoke(request(DEPLOYMENT), fakeFetch);
    assert.equal(result.response.status, 502);
    assert.deepEqual(result.result, { ok: false, error: "telegram_delivery_failed" });
  });
}

test("missing configuration returns 500 without Telegram", { concurrency: false }, async () => {
  let calls = 0;
  const result = await invoke(
    request(DEPLOYMENT),
    async () => { calls += 1; },
    false,
  );
  assert.equal(result.response.status, 500);
  assert.deepEqual(result.result, { ok: false, error: "configuration_error" });
  assert.equal(calls, 0);
});
