package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// The fork's idle-keepalive scanner must enforce the same upstream limits as
// the synchronous scanner, including when a single line exceeds queue budget.
func TestOpenAIPassthroughTransportLimitsWithKeepalive(t *testing.T) {
	for _, interval := range []int{0, 1} {
		name := "synchronous"
		if interval > 0 {
			name = "keepalive"
		}
		t.Run(name, func(t *testing.T) {
			for _, valid := range []bool{false, true} {
				caseName := "undelimited_event"
				if valid {
					caseName = "valid_large_frame"
				}
				t.Run(caseName, func(t *testing.T) {
					svc := &OpenAIGatewayService{cfg: &config.Config{Gateway: config.GatewayConfig{
						StreamKeepaliveInterval: interval, MaxLineSize: 1 << 20,
						SSEEventMaxLines: 4, SSEQueueMaxBytes: 64,
					}}}
					rec := httptest.NewRecorder()
					c, _ := gin.CreateTestContext(rec)
					c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
					prefix := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"" + strings.Repeat("a", 1024) + "\"}\n\n"
					tail := "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_test\",\"status\":\"completed\",\"usage\":{\"input_tokens\":3,\"output_tokens\":1}}}\n\n"
					if !valid {
						tail = strings.Repeat(": missing delimiter\n", 5) + "\n" + tail
					}
					resp := &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(prefix + tail))}
					defer func() { _ = resp.Body.Close() }()
					result, err := svc.handleStreamingResponsePassthrough(context.Background(), resp, c, &Account{ID: 1, Platform: PlatformOpenAI}, time.Now(), "gpt-test", "gpt-test")
					require.NotNil(t, result)
					require.Contains(t, rec.Body.String(), strings.Repeat("a", 1024))
					if valid {
						require.NoError(t, err)
						require.Contains(t, rec.Body.String(), "response.completed")
						require.Equal(t, 3, result.usage.InputTokens)
					} else {
						require.ErrorIs(t, err, errSSETransportLimit)
						require.NotContains(t, rec.Body.String(), "response.completed")
					}
				})
			}
		})
	}
}
