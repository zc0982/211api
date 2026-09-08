package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	openaiwsv2 "github.com/Wei-Shaw/sub2api/internal/service/openai_ws_v2"
	coderws "github.com/coder/websocket"
	"github.com/stretchr/testify/require"
)

func TestOpenAIWSPassthroughDownstreamKeepaliveRealSocket(t *testing.T) {
	for _, mode := range []string{"pong_and_idle_close", "missing_pong_drain", "lease_loss_during_ping"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithCancelCause(context.Background())
			defer cancel(context.Canceled)
			upstream := newStagedPassthroughConn()
			traces := make(chan openaiwsv2.RelayTraceEvent, 100)
			turns := make(chan openaiwsv2.RelayTurnResult, 10)
			finished := make(chan *openaiwsv2.RelayExit, 1)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				conn, err := coderws.Accept(w, r, nil)
				if err != nil {
					return
				}
				defer func() { _ = conn.Close(coderws.StatusNormalClosure, ""); _ = conn.CloseNow() }()
				clientFrame := &openAIWSClientFrameConn{conn: conn, controlCtx: ctx, interTurnIdleTimeout: 150 * time.Millisecond, interTurnStarted: make(chan struct{}, 1)}
				policyFrame := &openAIWSPolicyEnforcingFrameConn{inner: clientFrame}
				_, exit := openaiwsv2.RunEntry(openaiwsv2.EntryInput{
					Ctx: ctx, ClientConn: policyFrame, UpstreamConn: upstream,
					FirstClientMessage: []byte(`{"type":"response.create","model":"gpt-test"}`),
					Options: openaiwsv2.RelayOptions{
						FirstMessageSent: true, StartClientAfterFirstDownstream: true,
						DownstreamPingInterval: 30 * time.Millisecond, DownstreamPingTimeout: 50 * time.Millisecond,
						UpstreamDrainTimeout: 100 * time.Millisecond,
						OnTrace:              func(event openaiwsv2.RelayTraceEvent) { traces <- event },
						OnTurnComplete:       func(turn openaiwsv2.RelayTurnResult) { turns <- turn },
						AfterClientWrite: func(_ coderws.MessageType, payload []byte, err error) {
							if err == nil && openAIWSPassthroughIsTerminalOutput(payload) {
								clientFrame.markTurnCompleted()
							}
						},
					},
				})
				finished <- exit
			}))
			defer server.Close()
			pinged := make(chan struct{}, 20)
			client, _, err := coderws.Dial(context.Background(), "ws"+strings.TrimPrefix(server.URL, "http"), &coderws.DialOptions{
				OnPingReceived: func(context.Context, []byte) bool { pinged <- struct{}{}; return mode == "pong_and_idle_close" },
			})
			require.NoError(t, err)
			defer func() { _ = client.CloseNow() }()
			readErr := make(chan error, 1)
			go func() {
				for {
					_, _, err := client.Read(context.Background())
					if err != nil {
						readErr <- err
						return
					}
				}
			}()
			upstream.Send(`{"type":"response.created","response":{"id":"resp_socket"}}`)
			waitTrace := func(stage string) {
				t.Helper()
				timer := time.NewTimer(2 * time.Second)
				defer timer.Stop()
				for {
					select {
					case trace := <-traces:
						if trace.Stage == stage {
							return
						}
					case <-timer.C:
						t.Fatalf("missing trace %s", stage)
					}
				}
			}
			select {
			case <-pinged:
			case <-time.After(time.Second):
				t.Fatal("no downstream Ping control frame")
			}
			if mode == "lease_loss_during_ping" {
				cancel(ErrOpenAIWSIngressLeaseLost)
				select {
				case err := <-readErr:
					require.Equal(t, coderws.StatusTryAgainLater, coderws.CloseStatus(err), "cancellation must preserve close frame 1013")
				case <-time.After(time.Second):
					t.Fatal("lease loss did not close client")
				}
			} else {
				if mode == "missing_pong_drain" {
					waitTrace("downstream_ping_failed")
					waitTrace("first_exit")
				} else {
					waitTrace("downstream_ping_ok")
				}
				completedAt := time.Now()
				upstream.Send(`{"type":"response.completed","response":{"id":"resp_socket","usage":{"input_tokens":11,"output_tokens":7}}}`)
				select {
				case turn := <-turns:
					require.Equal(t, 11, turn.Usage.InputTokens)
					require.Equal(t, 7, turn.Usage.OutputTokens)
				case <-time.After(time.Second):
					t.Fatal("usage was not settled")
				}
				select {
				case err := <-readErr:
					require.Equal(t, coderws.StatusNormalClosure, coderws.CloseStatus(err))
					require.Less(t, time.Since(completedAt), time.Second, "Pongs must not extend inter-turn idle timeout")
				case <-time.After(time.Second):
					t.Fatal("Pongs kept a completed session alive past idle timeout")
				}
			}
			select {
			case exit := <-finished:
				if mode == "missing_pong_drain" {
					require.Nil(t, exit)
				}
			case <-time.After(time.Second):
				t.Fatal("relay did not finish")
			}
			select {
			case duplicate := <-turns:
				t.Fatalf("duplicate turn settlement: %+v", duplicate)
			default:
			}
		})
	}
}

func TestPassthroughLifecycle_ConfigEnablesDownstreamPing(t *testing.T) {
	ctx, cancel := context.WithCancelCause(context.Background())
	defer cancel(context.Canceled)
	cfg := passthroughLifecycleConfig()
	cfg.Gateway.OpenAIFirstOutputTimeoutSeconds = 30
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 30
	cfg.Gateway.OpenAIWS.PassthroughDownstreamPingIntervalSeconds = 5
	cfg.Gateway.OpenAIWS.PassthroughDownstreamPingTimeoutSeconds = 1
	upstream := newStagedPassthroughConn()
	svc := newPassthroughLifecycleService(cfg, upstream)
	server, serverErr := startPassthroughLifecycleServer(t, ctx, svc, passthroughLifecycleAccount())
	defer server.Close()
	var pings atomic.Int32
	client, _, err := coderws.Dial(context.Background(), "ws"+strings.TrimPrefix(server.URL, "http"), &coderws.DialOptions{
		OnPingReceived: func(context.Context, []byte) bool { pings.Add(1); return true },
	})
	require.NoError(t, err)
	defer func() { _ = client.CloseNow() }()
	require.NoError(t, client.Write(context.Background(), coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-test"}`)))
	requirePassthroughUpstreamWrite(t, upstream, time.Second)
	upstream.Send(`{"type":"response.created","response":{"id":"resp_config"}}`)
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		for {
			if _, _, err := client.Read(context.Background()); err != nil {
				return
			}
		}
	}()
	require.Eventually(t, func() bool { return pings.Load() > 0 }, 7*time.Second, 10*time.Millisecond)
	cancel(ErrOpenAIWSIngressLeaseLost)
	select {
	case err := <-serverErr:
		require.True(t, errors.Is(err, ErrOpenAIWSIngressLeaseLost))
	case <-time.After(2 * time.Second):
		t.Fatal("configured passthrough did not stop")
	}
	<-readDone
}
