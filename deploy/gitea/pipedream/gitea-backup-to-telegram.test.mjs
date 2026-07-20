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
