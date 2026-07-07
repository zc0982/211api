package service

import (
	"net/http"

	pkghttputil "github.com/Wei-Shaw/sub2api/internal/pkg/httputil"
)

func setEventStreamResponseHeaders(h http.Header) {
	pkghttputil.SetEventStreamResponseHeaders(h)
}
