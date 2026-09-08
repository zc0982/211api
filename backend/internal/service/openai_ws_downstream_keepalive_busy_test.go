package service

import (
	"bufio"
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	openaiwsv2 "github.com/Wei-Shaw/sub2api/internal/service/openai_ws_v2"
	coderws "github.com/coder/websocket"
	"github.com/stretchr/testify/require"
)

type downstreamKeepaliveTestRelay struct {
	client *coderws.Conn
	traces chan openaiwsv2.RelayTraceEvent
	frames chan []byte
	turns  chan openaiwsv2.RelayTurnResult
	done   chan struct{}
}

func startDownstreamKeepaliveTestRelay(
	t *testing.T,
	upstream openaiwsv2.FrameConn,
	filter func(coderws.MessageType, []byte) ([]byte, *OpenAIFastBlockedError, error),
	wrapWriter func(http.ResponseWriter) http.ResponseWriter,
	onPing func(context.Context, []byte) bool,
	configure ...func(*openaiwsv2.RelayOptions),
) *downstreamKeepaliveTestRelay {
	t.Helper()
	h := &downstreamKeepaliveTestRelay{
		traces: make(chan openaiwsv2.RelayTraceEvent, 100), frames: make(chan []byte, 10),
		turns: make(chan openaiwsv2.RelayTurnResult, 10), done: make(chan struct{}),
	}
	ctx, cancel := context.WithCancel(context.Background())
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(h.done)
		if wrapWriter != nil {
			w = wrapWriter(w)
		}
		conn, err := coderws.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer func() { _ = conn.CloseNow() }()
		clientFrame := &openAIWSClientFrameConn{conn: conn, controlCtx: ctx}
		options := openaiwsv2.RelayOptions{
			FirstMessageSent: true, StartClientAfterFirstDownstream: true,
			DownstreamPingInterval: 30 * time.Millisecond, DownstreamPingTimeout: 80 * time.Millisecond,
			UpstreamDrainTimeout: 100 * time.Millisecond,
			OnTrace:              func(e openaiwsv2.RelayTraceEvent) { h.traces <- e },
			OnTurnComplete:       func(turn openaiwsv2.RelayTurnResult) { h.turns <- turn },
		}
		for _, fn := range configure {
			fn(&options)
		}
		openaiwsv2.RunEntry(openaiwsv2.EntryInput{
			Ctx: ctx, ClientConn: &openAIWSPolicyEnforcingFrameConn{inner: clientFrame, filter: filter}, UpstreamConn: upstream,
			FirstClientMessage: []byte(`{"type":"response.create","model":"gpt-test"}`),
			Options:            options,
		})
	}))
	client, _, err := coderws.Dial(context.Background(), "ws"+strings.TrimPrefix(server.URL, "http"), &coderws.DialOptions{OnPingReceived: onPing})
	require.NoError(t, err)
	h.client = client
	client.SetReadLimit(2 << 20)
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		for {
			_, payload, err := client.Read(context.Background())
			if err != nil {
				return
			}
			h.frames <- payload
		}
	}()
	t.Cleanup(func() {
		cancel()
		_ = client.CloseNow()
		server.Close()
		select {
		case <-h.done:
		case <-time.After(2 * time.Second):
			t.Error("relay did not stop")
		}
		<-readDone
	})
	return h
}

func (h *downstreamKeepaliveTestRelay) waitTrace(t *testing.T, stage string) {
	t.Helper()
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	for {
		select {
		case e := <-h.traces:
			require.NotEqual(t, "downstream_ping_failed", e.Stage, "healthy client was disconnected: %s", e.Error)
			if e.Stage == stage {
				return
			}
		case <-h.done:
			t.Fatal("relay stopped while the client was healthy")
		case <-timer.C:
			t.Fatalf("missing trace %s", stage)
		}
	}
}

func (h *downstreamKeepaliveTestRelay) readFrame(t *testing.T) []byte {
	t.Helper()
	select {
	case payload := <-h.frames:
		return payload
	case <-time.After(2 * time.Second):
		t.Fatal("missing downstream business frame")
		return nil
	}
}

type keepaliveSlowUpstreamConn struct {
	*stagedPassthroughConn
	beforeWrite func()
}

func (c *keepaliveSlowUpstreamConn) WriteFrame(ctx context.Context, mt coderws.MessageType, payload []byte) error {
	c.beforeWrite()
	return c.stagedPassthroughConn.WriteFrame(ctx, mt, payload)
}

func TestOpenAIWSPassthroughDownstreamKeepaliveBusyReaderRealSocket(t *testing.T) {
	for _, mode := range []string{"policy_before_ping", "upstream_before_ping", "policy_during_ping", "upstream_during_ping", "reader_resumed_during_ping"} {
		t.Run(mode, func(t *testing.T) {
			entered, release := make(chan struct{}), make(chan struct{})
			var enterOnce, releaseOnce sync.Once
			unblock := func() { releaseOnce.Do(func() { close(release) }) }
			block := func() { enterOnce.Do(func() { close(entered) }); <-release }
			upstream := newStagedPassthroughConn()
			var transport openaiwsv2.FrameConn = upstream
			var filter func(coderws.MessageType, []byte) ([]byte, *OpenAIFastBlockedError, error)
			if strings.HasPrefix(mode, "upstream") {
				transport = &keepaliveSlowUpstreamConn{stagedPassthroughConn: upstream, beforeWrite: block}
			} else {
				filter = func(_ coderws.MessageType, payload []byte) ([]byte, *OpenAIFastBlockedError, error) {
					block()
					return payload, nil, nil
				}
			}
			var client atomic.Pointer[coderws.Conn]
			var sent atomic.Bool
			h := startDownstreamKeepaliveTestRelay(t, transport, filter, nil, func(ctx context.Context, _ []byte) bool {
				if strings.Contains(mode, "during_ping") && sent.CompareAndSwap(false, true) {
					// Put a business message before the Pong on the wire, so the
					// server leaves Read and enters a slow operation during Ping.
					_ = client.Load().Write(ctx, coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-test"}`))
					if mode == "reader_resumed_during_ping" {
						unblock()
						// A completed business read is liveness evidence even if
						// a new Reader is already active when this Pong times out.
						return false
					}
				}
				return true
			})
			client.Store(h.client)
			t.Cleanup(unblock)
			upstream.Send(`{"type":"response.completed","response":{"id":"resp_first","usage":{"input_tokens":1,"output_tokens":2}}}`)
			h.readFrame(t)
			if strings.Contains(mode, "before_ping") {
				require.NoError(t, h.client.Write(context.Background(), coderws.MessageText, []byte(`{"type":"response.create","model":"gpt-test"}`)))
			}
			select {
			case <-entered:
			case <-time.After(time.Second):
				t.Fatal("business handler was not reached")
			}
			h.waitTrace(t, "downstream_ping_deferred")
			if mode != "reader_resumed_during_ping" {
				// Stay paused longer than the original interval + Pong timeout.
				for range 3 {
					h.waitTrace(t, "downstream_ping_deferred")
				}
			}
			unblock()
			requirePassthroughUpstreamWrite(t, upstream, time.Second)
			h.waitTrace(t, "downstream_ping_ok")
			upstream.Send(`{"type":"response.completed","response":{"id":"resp_second","usage":{"input_tokens":11,"output_tokens":7}}}`)
			require.Contains(t, string(h.readFrame(t)), "resp_second")
			for _, id := range []string{"resp_first", "resp_second"} {
				select {
				case turn := <-h.turns:
					require.Equal(t, id, turn.RequestID)
					if id == "resp_second" {
						require.Equal(t, 11, turn.Usage.InputTokens)
						require.Equal(t, 7, turn.Usage.OutputTokens)
					}
				case <-time.After(time.Second):
					t.Fatal("turn usage was not settled")
				}
			}
			require.Empty(t, h.turns, "each turn must be settled once")
		})
	}
}

// Pause a real transport write after coder/websocket has acquired writeFrameMu.
// This models a slow frame without depending on platform TCP buffer sizes.
type keepaliveBlockedNetConn struct {
	net.Conn
	paused                 atomic.Bool
	entered, release       chan struct{}
	enterOnce, releaseOnce sync.Once
}

func (c *keepaliveBlockedNetConn) unblock() { c.releaseOnce.Do(func() { close(c.release) }) }

func (c *keepaliveBlockedNetConn) Write(p []byte) (int, error) {
	if c.paused.Load() {
		c.enterOnce.Do(func() { close(c.entered) })
		<-c.release
	}
	return c.Conn.Write(p)
}

func (c *keepaliveBlockedNetConn) Close() error { c.unblock(); return c.Conn.Close() }

type keepaliveHijackWriter struct {
	http.ResponseWriter
	conn *keepaliveBlockedNetConn
}

func (w keepaliveHijackWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("response writer does not support hijacking")
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return nil, nil, err
	}
	w.conn.Conn = conn
	if err := rw.Flush(); err != nil {
		_ = conn.Close()
		return nil, nil, err
	}
	rw.Writer.Reset(w.conn)
	return w.conn, rw, nil
}

func TestOpenAIWSPassthroughDownstreamKeepaliveBusyWriterRealSocket(t *testing.T) {
	upstream := newStagedPassthroughConn()
	transport := &keepaliveBlockedNetConn{entered: make(chan struct{}), release: make(chan struct{})}
	h := startDownstreamKeepaliveTestRelay(t, upstream, nil, func(w http.ResponseWriter) http.ResponseWriter {
		return keepaliveHijackWriter{ResponseWriter: w, conn: transport}
	}, nil)
	t.Cleanup(transport.unblock)
	upstream.Send(`{"type":"response.created","response":{"id":"resp_slow_write"}}`)
	h.readFrame(t)
	transport.paused.Store(true)
	upstream.Send(`{"type":"response.output_text.delta","delta":"` + strings.Repeat("x", 1<<20) + `"}`)
	select {
	case <-transport.entered:
	case <-time.After(time.Second):
		t.Fatal("business write did not acquire the transport write lock")
	}
	for range 4 {
		h.waitTrace(t, "downstream_ping_deferred")
	}
	transport.unblock()
	require.Contains(t, string(h.readFrame(t)), "response.output_text.delta")
	h.waitTrace(t, "downstream_ping_ok")
	upstream.Send(`{"type":"response.completed","response":{"id":"resp_slow_write","usage":{"input_tokens":13,"output_tokens":8}}}`)
	require.Contains(t, string(h.readFrame(t)), "response.completed")
	select {
	case turn := <-h.turns:
		require.Equal(t, 13, turn.Usage.InputTokens)
		require.Equal(t, 8, turn.Usage.OutputTokens)
	case <-time.After(time.Second):
		t.Fatal("slow response usage was not settled")
	}
	require.Empty(t, h.turns)
}

func TestOpenAIWSPassthroughDownstreamKeepaliveBusinessWriteDuringPingRealSocket(t *testing.T) {
	upstream := newStagedPassthroughConn()
	pinged := make(chan struct{})
	var firstPing atomic.Bool
	h := startDownstreamKeepaliveTestRelay(t, upstream, nil, nil, func(context.Context, []byte) bool {
		if firstPing.CompareAndSwap(false, true) {
			close(pinged)
			return false
		}
		return true
	}, func(options *openaiwsv2.RelayOptions) {
		options.WriteTimeout = 100 * time.Millisecond
		options.DownstreamPingTimeout = 500 * time.Millisecond
	})
	upstream.Send(`{"type":"response.created","response":{"id":"resp_write_during_ping"}}`)
	h.readFrame(t)
	select {
	case <-pinged:
	case <-time.After(time.Second):
		t.Fatal("Ping did not start")
	}
	// Waiting for a Pong must not hold up business writes, even if their
	// configured timeout is shorter than the outstanding Ping timeout.
	upstream.Send(`{"type":"response.output_text.delta","delta":"still streaming"}`)
	require.Contains(t, string(h.readFrame(t)), "still streaming")
	h.waitTrace(t, "downstream_ping_deferred")
	h.waitTrace(t, "downstream_ping_ok")
	upstream.Send(`{"type":"response.completed","response":{"id":"resp_write_during_ping","usage":{"input_tokens":2,"output_tokens":3}}}`)
	require.Contains(t, string(h.readFrame(t)), "response.completed")
}
