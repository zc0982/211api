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
