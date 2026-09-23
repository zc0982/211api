//go:build unit

package service

import (
	"bytes"
	"context"
	"encoding/json"
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

// 复现验证阶段的第二报错：Codex remote compaction v2（裸 /v1/responses +
// stream:true + compaction_trigger）经 opencode_go 原生 Responses 线路时，
// 客户端报 "stream closed before response.completed"。上游（官方校验器后的
// 真实 OpenAI /responses）会流出 compaction 项 + response.completed，网关
// 必须原样把终止事件交给客户端。
func TestOpenCodeGoNativeResponses_CompactionV2StreamReachesCompleted(t *testing.T) {
	body := []byte(`{
		"model":"gpt-5.5",
		"stream":true,
		"input":[
			{"type":"message","id":"msg_1","role":"user","content":[{"type":"input_text","text":"hi"}]},
			{"type":"compaction_trigger"}
		]
	}`)

	streamPayload := "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_c1\",\"object\":\"response\",\"model\":\"gpt-5.5\",\"status\":\"in_progress\"}}\n\n" +
		"data: {\"type\":\"response.output_item.done\",\"output_index\":0,\"item\":{\"type\":\"compaction\",\"id\":\"cmp_1\",\"encrypted_content\":\"cipher\"}}\n\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_c1\",\"object\":\"response\",\"model\":\"gpt-5.5\",\"status\":\"completed\",\"output\":[{\"type\":\"compaction\",\"id\":\"cmp_1\",\"encrypted_content\":\"cipher\"}],\"usage\":{\"input_tokens\":10,\"output_tokens\":5,\"total_tokens\":15}}}\n\n" +
		"data: [DONE]\n\n"

	upstream := &httpUpstreamRecorder{resp: &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(streamPayload)),
	}}
	svc := &OpenAIGatewayService{cfg: rawChatCompletionsTestConfig(), httpUpstream: upstream}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	MarkOpenAINativeCompactionV2(c)

	result, err := svc.Forward(context.Background(), c, openCodeGoNativeResponsesTestAccount(), body)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, upstream.lastReq)
	require.Equal(t, "https://opencode.ai/zen/v1/responses", upstream.lastReq.URL.String())

	got := recorder.Body.String()
	require.Contains(t, got, "response.completed", "compaction v2 stream must deliver response.completed to the client")
	require.Contains(t, got, `"compaction"`, "compaction output item must reach the client")
	// compaction_trigger 不在项 ID 前缀约束表内，应原样透传且仍在末尾。
	upstreamInput := gjson.GetBytes(upstream.lastBody, "input").Array()
	require.Equal(t, "compaction_trigger", upstreamInput[len(upstreamInput)-1].Get("type").String())
}

// 复现线上第三种报错形态（2026-09-23 生产抓包）：opencode zen 上游对超限的
// compact 请求只流出 response.created → response.in_progress → 裸 error 帧
// （无错误负载）便直接 EOF，不发协议要求的 response.failed。Codex 不把裸
// error 帧当终止事件，EOF 被报成 "stream closed before response.completed"，
// 与网络截断无法区分。网关必须在转发裸 error 之后补发一帧合成的
// response.failed，让客户端拿到规范终止事件。
func TestOpenCodeGoNativeResponses_BareErrorStreamGetsSynthesizedResponseFailed(t *testing.T) {
	body := []byte(`{
		"model":"gpt-5.6-luna",
		"stream":true,
		"input":[
			{"type":"message","id":"msg_1","role":"user","content":[{"type":"input_text","text":"hi"}]},
			{"type":"compaction_trigger"}
		]
	}`)

	// 与生产抓包逐字节同形：裸 error 后上游直接 EOF（无 [DONE]、无 response.failed）。
	streamPayload := "event: response.created\n" +
		"data: {\"type\":\"response.created\",\"sequence_number\":0,\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"created_at\":1790128860,\"status\":\"in_progress\",\"model\":\"gpt-5.6-luna\",\"output\":[]}}\n\n" +
		"event: response.in_progress\n" +
		"data: {\"type\":\"response.in_progress\",\"sequence_number\":1,\"response\":{\"id\":\"resp_1\",\"object\":\"response\",\"created_at\":1790128860,\"status\":\"in_progress\",\"model\":\"gpt-5.6-luna\",\"output\":[]}}\n\n" +
		"event: error\n" +
		"data: {\"type\":\"error\",\"sequence_number\":2}\n\n"

	upstream := &httpUpstreamRecorder{resp: &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(streamPayload)),
	}}
	svc := &OpenAIGatewayService{cfg: rawChatCompletionsTestConfig(), httpUpstream: upstream}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	MarkOpenAINativeCompactionV2(c)

	// 响应已提交（200 + 已转发事件），Forward 返回的 error 仅用于记账与日志；
	// 客户端侧的协议完整性以实际写入的 SSE 帧为准。
	_, _ = svc.Forward(context.Background(), c, openCodeGoNativeResponsesTestAccount(), body)

	got := recorder.Body.String()
	require.Contains(t, got, "event: error", "裸 error 帧应原样转发给客户端")
	require.Contains(t, got, "event: response.failed", "裸 error 后网关必须补发 response.failed 终止事件")
	require.Less(t, strings.Index(got, "event: error"), strings.Index(got, "event: response.failed"),
		"response.failed 必须在 error 帧之后")
	require.NotContains(t, got, "response.completed", "失败流不应出现 response.completed")

	failedFrame := got[strings.Index(got, "event: response.failed"):]
	_, payload, found := strings.Cut(failedFrame, "data: ")
	require.True(t, found, "response.failed 帧必须带 data 行: %q", failedFrame)
	payload, _, _ = strings.Cut(payload, "\n")

	var event struct {
		Type           string `json:"type"`
		SequenceNumber *int64 `json:"sequence_number"`
		Response       struct {
			ID        string `json:"id"`
			Status    string `json:"status"`
			CreatedAt int64  `json:"created_at"`
			Error     struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		} `json:"response"`
	}
	require.NoError(t, json.Unmarshal([]byte(strings.TrimSpace(payload)), &event))
	require.Equal(t, "response.failed", event.Type)
	require.NotNil(t, event.SequenceNumber, "严格客户端把 sequence_number 当必填字段")
	require.Equal(t, int64(3), *event.SequenceNumber, "sequence_number 应接在上游裸 error 的 2 之后")
	require.Equal(t, "resp_1", event.Response.ID, "合成帧应沿用上游 response.id")
	require.Equal(t, "failed", event.Response.Status)
	require.Greater(t, event.Response.CreatedAt, int64(0), "严格客户端把 created_at 当必填字段")
	require.NotEmpty(t, event.Response.Error.Message, "裸 error 无负载时也要有兜底错误消息")
}
