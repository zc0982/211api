package openai_ws_v2

import (
	"context"
	"io"
	"sync/atomic"
	"testing"
	"time"

	coderws "github.com/coder/websocket"
	"github.com/stretchr/testify/require"
)

type pingTestFrameConn struct {
	*passthroughTestFrameConn
	ping func(context.Context) error
}

func (c *pingTestFrameConn) Ping(ctx context.Context) error { return c.ping(ctx) }

type keepaliveRacingFrameConn struct {
	*pingTestFrameConn
	readDone                   chan struct{}
	writeStarted, releaseWrite chan struct{}
}

func (c *keepaliveRacingFrameConn) ReadFrame(context.Context) (coderws.MessageType, []byte, error) {
	// Model the production adapter: only transport Close, not relay context
	// cancellation, releases its reader.
	defer close(c.readDone)
	return c.passthroughTestFrameConn.ReadFrame(context.Background())
}

func (c *keepaliveRacingFrameConn) WriteFrame(ctx context.Context, mt coderws.MessageType, payload []byte) error {
	if len(c.Writes()) == 1 {
		close(c.writeStarted)
		<-c.releaseWrite
		return io.ErrClosedPipe
	}
	return c.passthroughTestFrameConn.WriteFrame(ctx, mt, payload)
}

func TestRelay_DownstreamPingFailureDrainsRacingWriteAndJoinsReader(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	firstExit := make(chan struct{})
	client := &keepaliveRacingFrameConn{
		pingTestFrameConn: &pingTestFrameConn{passthroughTestFrameConn: newPassthroughTestFrameConn(nil, false)},
		readDone:          make(chan struct{}), writeStarted: make(chan struct{}), releaseWrite: make(chan struct{}),
	}
	defer func() { _ = client.Close() }()
	client.ping = func(ctx context.Context) error {
		select {
		case <-client.writeStarted:
			return io.ErrUnexpectedEOF
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	upstream := newPassthroughTestFrameConn([]passthroughTestFrame{{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_write_race"}}`)}}, false)
	done := make(chan RelayResult, 1)
	go func() {
		result, _ := Relay(ctx, client, upstream, []byte(`{"type":"response.create"}`), RelayOptions{
			FirstMessageSent: true, StartClientAfterFirstDownstream: true,
			DownstreamPingInterval: 10 * time.Millisecond, DownstreamPingTimeout: time.Second, UpstreamDrainTimeout: time.Second,
			BeforeRelayCancel: func(RelayExit) { close(firstExit) },
		})
		done <- result
	}()
	require.Eventually(t, func() bool { return len(client.Writes()) == 1 }, time.Second, time.Millisecond)
	upstream.readCh <- passthroughTestFrame{msgType: coderws.MessageText, payload: []byte(`{"type":"response.output_text.delta","delta":"x"}`)}
	select {
	case <-firstExit:
	case <-time.After(time.Second):
		t.Fatal("ping did not start drain")
	}
	close(client.releaseWrite)
	select {
	case <-done:
		t.Fatal("racing downstream write ended upstream drain")
	case <-time.After(30 * time.Millisecond):
	}
	upstream.readCh <- passthroughTestFrame{msgType: coderws.MessageText, payload: []byte(`{"type":"response.completed","response":{"id":"resp_write_race","usage":{"input_tokens":13,"output_tokens":8}}}`)}
	select {
	case result := <-done:
		require.Equal(t, 13, result.Usage.InputTokens)
		require.Equal(t, 8, result.Usage.OutputTokens)
		require.EqualValues(t, 2, result.DroppedDownstreamFrames)
		select {
		case <-client.readDone:
		default:
			t.Fatal("relay returned with an unjoined client reader")
		}
	case <-time.After(time.Second):
		t.Fatal("relay did not close and join client reader")
	}
}

func TestRelay_DownstreamBusinessTrafficPostponesPing(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	var nowNanos atomic.Int64
	nowNanos.Store(time.Now().UnixNano())
	var pings atomic.Int32
	client := &pingTestFrameConn{newPassthroughTestFrameConn(nil, false), func(context.Context) error { pings.Add(1); return nil }}
	upstream := newPassthroughTestFrameConn(nil, false)
	done := make(chan struct{})
	go func() {
		defer close(done)
		Relay(ctx, client, upstream, nil, RelayOptions{FirstMessageSent: true,
			DownstreamPingInterval: 20 * time.Millisecond,
			Now:                    func() time.Time { return time.Unix(0, nowNanos.Load()) },
		})
	}()
	for i := 1; i <= 4; i++ {
		nowNanos.Add(int64(10 * time.Millisecond))
		upstream.readCh <- passthroughTestFrame{msgType: coderws.MessageText, payload: []byte(`{"type":"response.output_text.delta","delta":"x"}`)}
		require.Eventually(t, func() bool { return len(client.Writes()) == i }, time.Second, time.Millisecond)
		// Allow the keepalive timer to check the recent business-write time.
		time.Sleep(30 * time.Millisecond)
		require.Zero(t, pings.Load())
	}
	nowNanos.Add(int64(30 * time.Millisecond))
	require.Eventually(t, func() bool { return pings.Load() > 0 }, time.Second, time.Millisecond)
	cancel()
	<-done
}

func TestRelay_DownstreamPingDisabledOrUnsupported(t *testing.T) {
	for _, mode := range []string{"disabled", "unsupported", "wrapped_unsupported"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			base := newPassthroughTestFrameConn(nil, false)
			var pings, unsupported atomic.Int32
			var client FrameConn = &pingTestFrameConn{base, func(context.Context) error { pings.Add(1); return ErrDownstreamPingUnsupported }}
			interval := 10 * time.Millisecond
			if mode == "disabled" {
				interval = 0
			}
			if mode == "unsupported" {
				client = base
			}
			upstream := newPassthroughTestFrameConn([]passthroughTestFrame{{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_optional"}}`)}}, false)
			done := make(chan struct{})
			go func() {
				defer close(done)
				Relay(ctx, client, upstream, nil, RelayOptions{FirstMessageSent: true, DownstreamPingInterval: interval,
					OnTrace: func(e RelayTraceEvent) {
						if e.Stage == "downstream_ping_unsupported" {
							unsupported.Add(1)
						}
					},
				})
			}()
			require.Eventually(t, func() bool { return len(base.Writes()) == 1 }, time.Second, time.Millisecond)
			select {
			case <-done:
				t.Fatal("optional keepalive disconnected relay")
			case <-time.After(60 * time.Millisecond):
			}
			cancel()
			<-done
			if mode == "disabled" {
				require.Zero(t, pings.Load())
				require.Zero(t, unsupported.Load())
			} else {
				require.EqualValues(t, 1, unsupported.Load())
			}
			if mode == "wrapped_unsupported" {
				require.EqualValues(t, 1, pings.Load())
			}
		})
	}
}

func TestRelay_DownstreamPingStopsAndJoinsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan context.Context, 1)
	release := make(chan struct{})
	client := &pingTestFrameConn{newPassthroughTestFrameConn(nil, false), func(ctx context.Context) error {
		started <- ctx
		<-release
		return nil
	}}
	upstream := newPassthroughTestFrameConn([]passthroughTestFrame{{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_cancel"}}`)}}, false)
	var failed atomic.Int32
	done := make(chan struct{})
	go func() {
		defer close(done)
		Relay(ctx, client, upstream, nil, RelayOptions{FirstMessageSent: true, DownstreamPingInterval: 10 * time.Millisecond, DownstreamPingTimeout: time.Second,
			OnTrace: func(e RelayTraceEvent) {
				if e.Stage == "downstream_ping_failed" {
					failed.Add(1)
				}
			},
		})
	}()
	var pingCtx context.Context
	select {
	case pingCtx = <-started:
	case <-time.After(time.Second):
		t.Fatal("ping did not start")
	}
	cancel()
	select {
	case <-done:
		t.Fatal("relay returned while ping was still running")
	case <-time.After(20 * time.Millisecond):
	}
	require.NoError(t, pingCtx.Err(), "relay cancellation must not cancel a control write and hard-close the client")
	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("relay did not join ping")
	}
	require.Zero(t, failed.Load())
}

func TestRelay_DownstreamPongTimeoutHasBoundedDrain(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	var pings atomic.Int32
	client := &pingTestFrameConn{newPassthroughTestFrameConn(nil, false), func(ctx context.Context) error {
		pings.Add(1)
		<-ctx.Done()
		return ctx.Err()
	}}
	upstream := newPassthroughTestFrameConn([]passthroughTestFrame{{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_timeout"}}`)}}, false)
	start := time.Now()
	_, exit := Relay(ctx, client, upstream, nil, RelayOptions{FirstMessageSent: true,
		DownstreamPingInterval: 10 * time.Millisecond, DownstreamPingTimeout: 20 * time.Millisecond, UpstreamDrainTimeout: 40 * time.Millisecond,
	})
	require.Nil(t, exit)
	require.EqualValues(t, 1, pings.Load())
	require.GreaterOrEqual(t, time.Since(start), 60*time.Millisecond)
	require.NoError(t, ctx.Err(), "drain must stop at its own budget")
}

func TestRelay_DownstreamPingStartsAfterFirstBusinessWrite(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pinged := make(chan struct{}, 10)
	client := &pingTestFrameConn{passthroughTestFrameConn: newPassthroughTestFrameConn(nil, false)}
	client.ping = func(ctx context.Context) error {
		pinged <- struct{}{}
		return nil
	}
	upstream := newPassthroughTestFrameConn(nil, false)
	done := make(chan struct{})
	go func() {
		defer close(done)
		Relay(ctx, client, upstream, []byte(`{"type":"response.create","model":"gpt-test"}`), RelayOptions{
			FirstMessageSent: true, StartClientAfterFirstDownstream: true,
			DownstreamPingInterval: 20 * time.Millisecond, DownstreamPingTimeout: 10 * time.Millisecond,
		})
	}()
	select {
	case <-pinged:
		t.Fatal("ping started before first downstream business write")
	case <-time.After(70 * time.Millisecond):
	}
	upstream.readCh <- passthroughTestFrame{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_ping"}}`)}
	for range 2 {
		select {
		case <-pinged:
		case <-time.After(time.Second):
			t.Fatal("idle downstream was not pinged")
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("relay did not stop")
	}
}

func TestRelay_DownstreamPingFailureDrainsDespiteClientReadExit(t *testing.T) {
	for _, readerFirst := range []bool{false, true} {
		t.Run(map[bool]string{false: "ping_first", true: "reader_first"}[readerFirst], func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			firstExit := make(chan struct{})
			client := &pingTestFrameConn{passthroughTestFrameConn: newPassthroughTestFrameConn(nil, false)}
			client.ping = func(ctx context.Context) error {
				if readerFirst {
					_ = client.Close()
					<-firstExit
				}
				return io.ErrUnexpectedEOF
			}
			upstream := newPassthroughTestFrameConn([]passthroughTestFrame{{msgType: coderws.MessageText, payload: []byte(`{"type":"response.created","response":{"id":"resp_drain_ping"}}`)}}, false)
			var turns atomic.Int32
			type outcome struct {
				result RelayResult
				exit   *RelayExit
			}
			done := make(chan outcome, 1)
			go func() {
				result, exit := Relay(ctx, client, upstream, []byte(`{"type":"response.create","model":"gpt-test"}`), RelayOptions{
					FirstMessageSent: true, StartClientAfterFirstDownstream: true,
					DownstreamPingInterval: 20 * time.Millisecond, DownstreamPingTimeout: 10 * time.Millisecond,
					UpstreamDrainTimeout: time.Second,
					OnTurnComplete:       func(RelayTurnResult) { turns.Add(1) },
					BeforeRelayCancel:    func(exit RelayExit) { close(firstExit) },
				})
				done <- outcome{result, exit}
			}()
			select {
			case <-firstExit:
			case <-time.After(time.Second):
				t.Fatal("ping failure did not disconnect client")
			}
			_ = client.Close()
			// A duplicate client exit must not terminate the upstream drain window.
			select {
			case <-done:
				t.Fatal("drain ended on the second client exit before late usage")
			case <-time.After(50 * time.Millisecond):
			}
			upstream.readCh <- passthroughTestFrame{msgType: coderws.MessageText, payload: []byte(`{"type":"response.completed","response":{"id":"resp_drain_ping","usage":{"input_tokens":17,"output_tokens":9,"input_tokens_details":{"cached_tokens":3}}}}`)}
			select {
			case out := <-done:
				require.Nil(t, out.exit)
				require.Equal(t, "resp_drain_ping", out.result.RequestID)
				require.Equal(t, "response.completed", out.result.TerminalEventType)
				require.Equal(t, 17, out.result.Usage.InputTokens)
				require.Equal(t, 9, out.result.Usage.OutputTokens)
				require.Equal(t, 3, out.result.Usage.CacheReadInputTokens)
				require.EqualValues(t, 1, out.result.DroppedDownstreamFrames)
				require.EqualValues(t, 1, turns.Load())
				require.Len(t, client.Writes(), 1)
			case <-time.After(time.Second):
				t.Fatal("relay did not settle drained usage")
			}
		})
	}
}
