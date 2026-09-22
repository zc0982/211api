package apicompat

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Responses 官方校验器对回放项 id 有类型前缀契约（reasoning→rs_、message→msg_、
// function_call→fc_ 等）。转换层生成的 id 必须满足该契约，否则客户端（Codex）
// 把这些项沉淀进会话后在 /responses/compact 回放时会被上游 400 拒绝。

func TestGenerateItemIDForType_Prefixes(t *testing.T) {
	cases := []struct {
		itemType string
		prefix   string
	}{
		{"reasoning", "rs_"},
		{"message", "msg_"},
		{"function_call", "fc_"},
		{"custom_tool_call", "ctc_"},
		{"tool_search_call", "tsc_"},
		{"web_search_call", "ws_"},
		{"unknown_future_type", "item_"},
		{"", "item_"},
	}
	for _, tc := range cases {
		t.Run(tc.itemType, func(t *testing.T) {
			id := generateItemIDForType(tc.itemType)
			require.True(t, strings.HasPrefix(id, tc.prefix), "id %q must start with %q", id, tc.prefix)
			require.Len(t, id, len(tc.prefix)+24, "id %q must carry a 24-hex random suffix", id)
		})
	}

	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		id := generateItemIDForType("reasoning")
		require.False(t, seen[id], "duplicate id generated")
		seen[id] = true
	}
}

func requireItemIDPrefix(t *testing.T, itemType, id string) {
	t.Helper()
	require.Equal(t, responsesItemIDPrefixByType(itemType)+"_", id[:strings.Index(id, "_")+1],
		"%s item id %q has wrong prefix", itemType, id)
}

func TestAnthropicToResponsesResponse_ItemIDPrefixes(t *testing.T) {
	resp := &AnthropicResponse{
		ID:    "msg_1",
		Model: "claude-test",
		Content: []AnthropicContentBlock{
			{Type: "thinking", Thinking: "plan"},
			{Type: "text", Text: "answer"},
			{Type: "tool_use", ID: "toolu_1", Name: "lookup", Input: json.RawMessage(`{"q":"x"}`)},
		},
	}

	out := AnthropicToResponsesResponse(resp)
	require.Len(t, out.Output, 3)
	for _, item := range out.Output {
		requireItemIDPrefix(t, item.Type, item.ID)
	}
	require.Equal(t, "reasoning", out.Output[0].Type)
	require.Equal(t, "function_call", out.Output[1].Type)
	require.Equal(t, "message", out.Output[2].Type)
}

func TestChatMessageToResponsesOutput_ItemIDPrefixes(t *testing.T) {
	message := ChatMessage{
		Role:             "assistant",
		ReasoningContent: "think",
		Content:          json.RawMessage(`"answer"`),
		ToolCalls: []ChatToolCall{{
			ID:       "call_1",
			Type:     "function",
			Function: ChatFunctionCall{Name: "lookup", Arguments: `{"q":"x"}`},
		}},
	}

	outputs := chatMessageToResponsesOutput(message, nil, nil, false, nil)
	require.Len(t, outputs, 3)
	require.Equal(t, "reasoning", outputs[0].Type)
	require.Equal(t, "message", outputs[1].Type)
	require.Equal(t, "function_call", outputs[2].Type)
	for _, item := range outputs {
		requireItemIDPrefix(t, item.Type, item.ID)
	}
}

func TestStream_ItemIDPrefixesMatchType(t *testing.T) {
	events := collectStreamEvents(t, []string{
		`{"choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"plan"}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_a","type":"function","function":{"name":"exec","arguments":"{\"cmd\":\"ls\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"content":"done"}}]}`,
		`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}`,
	})

	seenTypes := map[string]bool{}
	for _, e := range events {
		switch e.Type {
		case "response.output_item.added", "response.output_item.done":
			require.NotNil(t, e.Item)
			requireItemIDPrefix(t, e.Item.Type, e.Item.ID)
			seenTypes[e.Item.Type] = true
		case "response.completed":
			require.NotNil(t, e.Response)
			for _, item := range e.Response.Output {
				requireItemIDPrefix(t, item.Type, item.ID)
			}
		}
	}
	require.True(t, seenTypes["reasoning"], "stream should include a reasoning item")
	require.True(t, seenTypes["function_call"], "stream should include a function_call item")
	require.True(t, seenTypes["message"], "stream should include a message item")
}
