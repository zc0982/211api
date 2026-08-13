package admin

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateGroupRequest_LongContextPricingPresence(t *testing.T) {
	t.Run("omitted", func(t *testing.T) {
		var req CreateGroupRequest
		require.NoError(t, json.Unmarshal([]byte(`{"name":"test"}`), &req))
		require.Nil(t, req.LongContextPricingEnabled)
	})

	t.Run("explicit_false", func(t *testing.T) {
		var req CreateGroupRequest
		require.NoError(t, json.Unmarshal([]byte(`{"name":"test","long_context_pricing_enabled":false}`), &req))
		require.NotNil(t, req.LongContextPricingEnabled)
		require.False(t, *req.LongContextPricingEnabled)
	})
}
