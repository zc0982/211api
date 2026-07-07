package service

import "net/http"

func setEventStreamResponseHeaders(h http.Header) {
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
