package httputil

import "net/http"

func SetEventStreamResponseHeaders(h http.Header) {
	if h == nil {
		return
	}
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	h.Del("Content-Length")
	h.Del("Content-Encoding")
}
