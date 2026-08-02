package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func withOpenAICodexOAuthUnsupportedFields(t *testing.T, body []byte) []byte {
	t.Helper()

	values := map[string]any{
		"max_output_tokens":      128,
		"max_completion_tokens":  256,
		"temperature":            0.2,
		"top_p":                  0.8,
		"frequency_penalty":      0,
		"presence_penalty":       0,
		"user":                   "user_123",
		"metadata":               map[string]any{"user_id": "user_123"},
		"prompt_cache_retention": "24h",
		"safety_identifier":      "sid",
		"stream_options":         map[string]any{"include_usage": true},
	}

	next := body
	for _, field := range openAICodexOAuthUnsupportedFields {
		value, ok := values[field]
		require.True(t, ok, "test fixture must provide a value for %s", field)
		var err error
		next, err = sjson.SetBytes(next, field, value)
		require.NoError(t, err)
	}
	return next
}

func TestNormalizeOpenAIPassthroughOAuthBody_RemovesUnsupportedUser(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4","input":"hello","user":"user_123","metadata":{"user_id":"user_123"},"prompt_cache_retention":"24h","safety_identifier":"sid","stream_options":{"include_usage":true}}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	for _, field := range openAIChatGPTInternalUnsupportedFields {
		require.False(t, gjson.GetBytes(normalized, field).Exists(), "%s should be stripped", field)
	}
	require.True(t, gjson.GetBytes(normalized, "stream").Bool())
	require.False(t, gjson.GetBytes(normalized, "store").Bool())
}

func TestNormalizeOpenAIPassthroughOAuthBody_RemovesCodexUnsupportedGenerationControls(t *testing.T) {
	body := withOpenAICodexOAuthUnsupportedFields(t, []byte(`{"model":"gpt-5.4-mini","input":[{"type":"message","role":"user","content":"hello"}]}`))

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	for _, field := range openAICodexOAuthUnsupportedFields {
		require.False(t, gjson.GetBytes(normalized, field).Exists(), "%s should be stripped", field)
	}
	require.True(t, gjson.GetBytes(normalized, "input").IsArray())
	require.True(t, gjson.GetBytes(normalized, "stream").Bool())
	require.False(t, gjson.GetBytes(normalized, "store").Bool())
}

func TestNormalizeOpenAIPassthroughOAuthBody_CompactRemovesUnsupportedUser(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4","input":"hello","user":"user_123","metadata":{"user_id":"user_123"},"stream":true,"store":true}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, true)
	require.NoError(t, err)
	require.True(t, changed)
	require.False(t, gjson.GetBytes(normalized, "user").Exists())
	require.False(t, gjson.GetBytes(normalized, "metadata").Exists())
	require.False(t, gjson.GetBytes(normalized, "stream").Exists())
	require.False(t, gjson.GetBytes(normalized, "store").Exists())
}

func TestNormalizeOpenAIPassthroughOAuthBody_StringInputBecomesList(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4-mini","input":"hello"}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	require.True(t, gjson.GetBytes(normalized, "input").IsArray())
	require.Equal(t, "message", gjson.GetBytes(normalized, "input.0.type").String())
	require.Equal(t, "user", gjson.GetBytes(normalized, "input.0.role").String())
	require.Equal(t, "hello", gjson.GetBytes(normalized, "input.0.content").String())
}

func TestNormalizeOpenAIPassthroughOAuthBody_EmptyStringInputWrappedAsEmptyArray(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4","input":"  "}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	input := gjson.GetBytes(normalized, "input")
	require.True(t, input.IsArray())
	require.Len(t, input.Array(), 0, "whitespace-only input should become empty array")
}

func TestNormalizeOpenAIPassthroughOAuthBody_ObjectInputBecomesList(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4-mini","input":{"type":"message","role":"user","content":"hello"}}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	require.True(t, gjson.GetBytes(normalized, "input").IsArray())
	require.Equal(t, "message", gjson.GetBytes(normalized, "input.0.type").String())
	require.Equal(t, "user", gjson.GetBytes(normalized, "input.0.role").String())
	require.Equal(t, "hello", gjson.GetBytes(normalized, "input.0.content").String())
}

func TestNormalizeOpenAIPassthroughOAuthBody_MissingInputBecomesEmptyList(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4-mini"}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	require.True(t, gjson.GetBytes(normalized, "input").IsArray())
	require.Equal(t, int64(0), gjson.GetBytes(normalized, "input.#").Int())
}

func TestNormalizeOpenAIPassthroughOAuthBody_ArrayInputUnchanged(t *testing.T) {
	body := []byte(`{"model":"gpt-5.4","input":[{"type":"message","role":"user","content":"hi"}]}`)

	normalized, _, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)

	input := gjson.GetBytes(normalized, "input")
	require.True(t, input.IsArray())
	require.Len(t, input.Array(), 1)
	require.Equal(t, "message", input.Array()[0].Get("type").String())
}

func TestDetectOpenAIPassthroughInstructionsRejectReason(t *testing.T) {
	for _, tt := range []struct {
		name string
		body string
		want string
	}{
		{name: "missing is optional", body: `{"model":"gpt-5.1-codex"}`, want: ""},
		{name: "non string remains rejected", body: `{"instructions":{"text":"invalid"}}`, want: "instructions_not_string"},
		{name: "empty remains rejected", body: `{"instructions":"  "}`, want: "instructions_empty"},
		{name: "non empty remains accepted", body: `{"instructions":"client guidance"}`, want: ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, detectOpenAIPassthroughInstructionsRejectReason("gpt-5.1-codex", []byte(tt.body)))
		})
	}
}
