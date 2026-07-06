package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

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
	body := []byte(`{"model":"gpt-5.4-mini","input":[{"type":"message","role":"user","content":"hello"}],"max_output_tokens":128,"max_completion_tokens":256,"temperature":0.2,"top_p":0.8,"frequency_penalty":0,"presence_penalty":0}`)

	normalized, changed, err := normalizeOpenAIPassthroughOAuthBody(body, false)
	require.NoError(t, err)
	require.True(t, changed)
	for _, field := range []string{
		"max_output_tokens",
		"max_completion_tokens",
		"temperature",
		"top_p",
		"frequency_penalty",
		"presence_penalty",
	} {
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
