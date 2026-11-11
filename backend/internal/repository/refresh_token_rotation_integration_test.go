//go:build integration

package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// Exercise Redis' actual Lua/cjson and atomic index/revocation behavior, beyond miniredis.
func TestRefreshTokenRotationRedis(t *testing.T) {
	for _, revoke := range []string{"user", "family", "single"} {
		t.Run(revoke, func(t *testing.T) {
			ctx := context.Background()
			id := time.Now().UnixNano()
			oldHash, newHash := fmt.Sprintf("rotation-old-%d", id), fmt.Sprintf("rotation-new-%d", id)
			family := fmt.Sprintf("rotation-family-%d", id)
			// The scripts construct successor keys; use unique real keys instead of the
			// harness hook that only rewrites KEYS (not dynamically constructed keys).
			cache := &refreshTokenCache{rdb: integrationRedis}
			keys := []string{refreshTokenKey(oldHash), refreshTokenKey(newHash), userRefreshTokensKey(id), tokenFamilyKey(family)}
			t.Cleanup(func() { require.NoError(t, integrationRedis.Del(context.Background(), keys...).Err()) })
			old := &service.RefreshTokenData{UserID: id, TokenVersion: math.MaxInt64, FamilyID: family}
			require.NoError(t, cache.StoreRefreshToken(ctx, oldHash, old, time.Minute))
			next := *old
			next.BindingHash = "new-session-binding"
			require.NoError(t, cache.RotateRefreshToken(ctx, oldHash, newHash, &next, time.Hour))
			require.NoError(t, cache.RotateRefreshToken(ctx, oldHash, newHash, &next, time.Hour), "retry the same committed operation")
			recovered, err := cache.GetRefreshToken(ctx, oldHash)
			require.NoError(t, err)
			require.Equal(t, next, *recovered, "preserve int64 identity/version and the successor binding")
			raw, err := integrationRedis.Get(ctx, refreshTokenKey(oldHash)).Bytes()
			require.NoError(t, err)
			var receipt service.RefreshTokenData
			require.NoError(t, json.Unmarshal(raw, &receipt))
			require.Equal(t, newHash, receipt.RotatedTo)
			require.True(t, receipt.ExpiresAt.IsZero(), "old binaries must treat receipts as expired")
			hashes, err := cache.GetFamilyTokenHashes(ctx, family)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{oldHash, newHash}, hashes)
			switch revoke {
			case "user":
				require.NoError(t, cache.DeleteUserRefreshTokens(ctx, id))
			case "family":
				require.NoError(t, cache.DeleteTokenFamily(ctx, family))
			case "single":
				require.NoError(t, cache.DeleteRefreshToken(ctx, newHash))
			}
			_, err = cache.GetRefreshToken(ctx, oldHash)
			require.ErrorIs(t, err, service.ErrRefreshTokenNotFound)
			require.ErrorIs(t, cache.RotateRefreshToken(ctx, oldHash, newHash, &next, time.Hour), service.ErrRefreshTokenNotFound)
		})
	}
}
