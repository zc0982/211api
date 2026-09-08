package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadOpenAIWSPassthroughDownstreamKeepalive(t *testing.T) {
	for _, tc := range []struct {
		name, intervalEnv, timeoutEnv string
		interval, timeout             int
	}{
		{name: "defaults", interval: 20, timeout: 5},
		{name: "environment", intervalEnv: "30", timeoutEnv: "7", interval: 30, timeout: 7},
		{name: "disabled", intervalEnv: "0", timeoutEnv: "0"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resetViperWithJWTSecret(t)
			t.Setenv("GATEWAY_OPENAI_WS_PASSTHROUGH_DOWNSTREAM_PING_INTERVAL_SECONDS", tc.intervalEnv)
			t.Setenv("GATEWAY_OPENAI_WS_PASSTHROUGH_DOWNSTREAM_PING_TIMEOUT_SECONDS", tc.timeoutEnv)
			cfg, err := Load()
			require.NoError(t, err)
			require.Equal(t, tc.interval, cfg.Gateway.OpenAIWS.PassthroughDownstreamPingIntervalSeconds)
			require.Equal(t, tc.timeout, cfg.Gateway.OpenAIWS.PassthroughDownstreamPingTimeoutSeconds)
		})
	}
}

func TestValidateOpenAIWSPassthroughDownstreamKeepalive(t *testing.T) {
	for _, tc := range []struct {
		interval, timeout int
		valid             bool
	}{
		{20, 5, true}, {5, 1, true}, {60, 10, true}, {0, 5, true}, {0, 0, true},
		{-1, 5, false}, {1, 5, false}, {61, 5, false}, {20, -1, false},
		{20, 0, false}, {20, 20, false}, {20, 21, false}, {0, -1, false},
	} {
		resetViperWithJWTSecret(t)
		cfg, err := Load()
		require.NoError(t, err)
		cfg.Gateway.OpenAIWS.PassthroughDownstreamPingIntervalSeconds = tc.interval
		cfg.Gateway.OpenAIWS.PassthroughDownstreamPingTimeoutSeconds = tc.timeout
		err = cfg.Validate()
		if tc.valid {
			require.NoError(t, err, "%+v", tc)
		} else {
			require.ErrorContains(t, err, "passthrough_downstream_ping", "%+v", tc)
		}
	}
}
