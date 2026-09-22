//go:build unit

package service

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// openCodeGoNativeResponsesTestAccount 固定 api_protocol=responses，让
// openCodeGoNativeProtocol 稳定走原生 Responses 线路（不依赖模型规则表）。
func openCodeGoNativeResponsesTestAccount() *Account {
	return &Account{
		ID:          901,
		Name:        "oc-go-responses",
		Platform:    PlatformOpenCodeGo,
		Type:        AccountTypeAPIKey,
		Status:      StatusActive,
		Schedulable: true,
		Concurrency: 1,
		Credentials: map[string]any{
			"api_key":      "sk-opencode",
			"api_protocol": APIProtocolResponses,
			"base_url":     "https://opencode.ai/zen/v1",
		},
	}
}

func openCodeGoCompactTestContext(path string, body []byte) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func openCodeGoOKUpstream() *httpUpstreamRecorder {
	return &httpUpstreamRecorder{resp: &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body: io.NopCloser(strings.NewReader(
			`{"id":"resp_oc_compact","status":"completed","output":[{"type":"compaction","encrypted_content":"cipher"}],"usage":{"input_tokens":1,"output_tokens":1}}`,
		)),
	}}
}

// 复现用户场景：Codex 会话里沉淀了转换层生成的 item_* 前缀 reasoning 项，
// /responses/compact 直达官方校验器时被 400（Expected an ID that begins with 'rs'）。
// opencode_go 原生 Responses 线路必须与 OpenAI 账号走同样的收敛：
// store=false 语义丢弃无 encrypted_content 的 reasoning，其余项剥离非法前缀 id。
func TestOpenCodeGoNativeResponses_CompactSanitizesReplayedItemIDs(t *testing.T) {
	body := []byte(`{
		"model":"gpt-5.5",
		"stream":false,
		"input":[
			{"type":"reasoning","id":"item_8bc3ca6491af4e19cba36263","summary":[{"type":"summary_text","text":"stale summary"}]},
			{"type":"reasoning","id":"rs_server","encrypted_content":"cipher","summary":[]},
			{"type":"item_reference","id":"rs_server"},
			{"type":"message","id":"item_msg_bad","role":"user","content":[{"type":"input_text","text":"continue"}]},
			{"type":"function_call","id":"item_fc_bad","call_id":"call_1","name":"lookup","arguments":"{}"},
			{"type":"function_call_output","call_id":"call_1","output":"ok"},
			{"type":"message","id":"msg_valid","role":"assistant","content":[{"type":"output_text","text":"done"}]}
		]
	}`)

	upstream := openCodeGoOKUpstream()
	svc := &OpenAIGatewayService{cfg: rawChatCompletionsTestConfig(), httpUpstream: upstream}
	c := openCodeGoCompactTestContext("/v1/responses/compact", body)

	result, err := svc.Forward(context.Background(), c, openCodeGoNativeResponsesTestAccount(), body)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, upstream.lastReq)
	require.Equal(t, "https://opencode.ai/zen/v1/responses/compact", upstream.lastReq.URL.String())

	forwarded := upstream.lastBody
	// 无 encrypted_content 的 item_* reasoning 与 rs_ item_reference 被整体丢弃，
	// 幸存 5 项：reasoning(剥 id)、message(剥 id)、function_call(剥 id)、
	// function_call_output、message(msg_valid)。
	require.Equal(t, int64(5), gjson.GetBytes(forwarded, "input.#").Int(), string(forwarded))

	reasoning := gjson.GetBytes(forwarded, "input.0")
	require.Equal(t, "reasoning", reasoning.Get("type").String())
	require.False(t, reasoning.Get("id").Exists(), "rs_ id must be stripped on store=false compact replay")
	require.Equal(t, "cipher", reasoning.Get("encrypted_content").String())

	userMsg := gjson.GetBytes(forwarded, "input.1")
	require.Equal(t, "message", userMsg.Get("type").String())
	require.False(t, userMsg.Get("id").Exists(), "item_* id must be stripped from message")

	fnCall := gjson.GetBytes(forwarded, "input.2")
	require.Equal(t, "function_call", fnCall.Get("type").String())
	require.False(t, fnCall.Get("id").Exists(), "item_* id must be stripped from function_call")
	require.Equal(t, "call_1", fnCall.Get("call_id").String(), "call_id pairing must survive")

	require.Equal(t, "function_call_output", gjson.GetBytes(forwarded, "input.3.type").String())
	require.Equal(t, "msg_valid", gjson.GetBytes(forwarded, "input.4.id").String(),
		"valid msg_ id must be preserved")

	require.NotContains(t, string(forwarded), "item_8bc3ca6491af4e19cba36263")
}

// 非 compact 的普通轮次：opencode_go 原生 Responses 上游对 reasoning 回放宽容，
// 只需剥离非法前缀的项 id，项本体保留。
func TestOpenCodeGoNativeResponses_NonCompactStripsInvalidItemIDs(t *testing.T) {
	body := []byte(`{
		"model":"gpt-5.5",
		"stream":false,
		"input":[
			{"type":"reasoning","id":"item_bad_reasoning","summary":[]},
			{"type":"message","id":"msg_ok","role":"user","content":[{"type":"input_text","text":"hi"}]}
		]
	}`)

	upstream := openCodeGoOKUpstream()
	svc := &OpenAIGatewayService{cfg: rawChatCompletionsTestConfig(), httpUpstream: upstream}
	c := openCodeGoCompactTestContext("/v1/responses", body)

	result, err := svc.Forward(context.Background(), c, openCodeGoNativeResponsesTestAccount(), body)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, upstream.lastReq)
	require.Equal(t, "https://opencode.ai/zen/v1/responses", upstream.lastReq.URL.String())

	forwarded := upstream.lastBody
	require.Equal(t, int64(2), gjson.GetBytes(forwarded, "input.#").Int(), string(forwarded))
	reasoning := gjson.GetBytes(forwarded, "input.0")
	require.Equal(t, "reasoning", reasoning.Get("type").String())
	require.False(t, reasoning.Get("id").Exists(), "item_* id must be stripped from reasoning")
	require.Equal(t, "msg_ok", gjson.GetBytes(forwarded, "input.1.id").String())
}
