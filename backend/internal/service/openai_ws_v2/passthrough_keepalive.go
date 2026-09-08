package openai_ws_v2

import (
	"context"
	"errors"
	"sync/atomic"
	"time"
)

// PingableFrameConn is optional: custom frame transports may not support
// WebSocket control frames. Ping must run concurrently with the client reader.
type PingableFrameConn interface {
	FrameConn
	Ping(context.Context) error
}

// ErrDownstreamPingUnsupported lets a wrapper preserve its inner transport's
// capabilities without turning unsupported keepalive into a client disconnect.
var ErrDownstreamPingUnsupported = errors.New("downstream websocket ping is unsupported")

// ErrDownstreamPingDeferred means local business work prevented a reliable
// liveness probe. Retry later without disconnecting or extending business idle.
var ErrDownstreamPingDeferred = errors.New("downstream websocket ping deferred by business activity")

func runDownstreamKeepalive(
	ctx context.Context,
	clientConn FrameConn,
	interval, timeout time.Duration,
	now func() time.Time,
	lastWrite *atomic.Int64,
	onTrace func(RelayTraceEvent),
	reportExit func(relayExitSignal),
) {
	pingConn, ok := clientConn.(PingableFrameConn)
	trace := func(stage string, err error) {
		emitRelayTrace(onTrace, RelayTraceEvent{
			Stage: stage, Direction: "downstream_keepalive",
			Graceful: true, WroteDownstream: true, Error: relayErrorString(err),
		})
	}
	if !ok {
		trace("downstream_ping_unsupported", nil)
		return
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	timer := time.NewTimer(interval)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		if ctx.Err() != nil {
			return
		}
		if remaining := interval - now().Sub(time.Unix(0, lastWrite.Load())); remaining > 0 {
			timer.Reset(remaining)
			continue
		}
		// Like downstream business writes, do not inherit relay cancellation:
		// coder/websocket may hard-close the socket when a control write's
		// context is canceled. Let an in-flight Ping finish within its timeout.
		pingCtx, cancel := context.WithTimeout(context.Background(), timeout)
		err := pingConn.Ping(pingCtx)
		cancel()
		if ctx.Err() != nil {
			return
		}
		if errors.Is(err, ErrDownstreamPingUnsupported) {
			trace("downstream_ping_unsupported", nil)
			return
		}
		if errors.Is(err, ErrDownstreamPingDeferred) {
			trace("downstream_ping_deferred", nil)
			timer.Reset(min(interval, timeout))
			continue
		}
		if err != nil {
			trace("downstream_ping_failed", err)
			reportExit(relayExitSignal{stage: "read_client", err: err, graceful: true, wroteDownstream: true})
			return
		}
		trace("downstream_ping_ok", nil)
		// Transport liveness must not reset the inter-turn business idle timeout.
		timer.Reset(interval)
	}
}
