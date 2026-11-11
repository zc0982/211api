//go:build unit

package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

type refreshRecoveryUserRepo struct {
	service.UserRepository
	user *service.User
}

func (r *refreshRecoveryUserRepo) GetByID(context.Context, int64) (*service.User, error) {
	return r.user, nil
}

// Drop a successful destructive script's reply, after Redis has committed it.
// This models a timeout without incorrectly treating it as a failed write.
type refreshLostReplyHook struct {
	dropped      bool
	beforeCommit bool
}

func (h *refreshLostReplyHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h *refreshLostReplyHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (h *refreshLostReplyHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		isRotation := (cmd.Name() == "evalsha" && cmd.Args()[1] == rotateRefreshTokenScript.Hash()) || (cmd.Name() == "eval" && strings.Contains(fmt.Sprint(cmd.Args()[1]), "local receipt ="))
		failure := &net.OpError{Op: "read", Net: "tcp", Err: context.DeadlineExceeded}
		if isRotation && h.beforeCommit && !h.dropped {
			h.dropped = true
			cmd.SetErr(failure)
			return failure
		}
		err := next(ctx, cmd)
		if err == nil && !h.dropped && isRotation {
			h.dropped = true
			err = failure
			cmd.SetErr(err)
		}
		return err
	}
}
func refreshTestHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
func TestRefreshTokenRotationRecoversAfterCommittedReplyLost(t *testing.T) {
	ctx := context.Background()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { _ = rdb.Close() })
	cache := NewRefreshTokenCache(rdb)
	user := &service.User{ID: 7, Email: "refresh@example.com", Role: service.RoleUser, Status: service.StatusActive}
	cfg := &config.Config{JWT: config.JWTConfig{Secret: "refresh-recovery-test-secret", AccessTokenExpireMinutes: 60, RefreshTokenExpireDays: 7}}
	svc := service.NewAuthService(nil, &refreshRecoveryUserRepo{user: user}, nil, cache, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
	original, err := svc.GenerateTokenPair(ctx, user, "recovery-family")
	require.NoError(t, err)
	hook := &refreshLostReplyHook{}
	rdb.AddHook(hook)
	_, err = svc.RefreshTokenPair(ctx, original.RefreshToken)
	require.ErrorIs(t, err, service.ErrServiceUnavailable)
	require.True(t, hook.dropped, "must inject the failure after the Redis mutation")
	// Recovery must work on a different service instance, without in-memory state.
	svc = service.NewAuthService(nil, &refreshRecoveryUserRepo{user: user}, nil, cache, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
	recovered, err := svc.RefreshTokenPair(ctx, original.RefreshToken)
	require.NoError(t, err, "a retry after an ambiguous Redis result must recover the session")
	require.NotEqual(t, original.RefreshToken, recovered.RefreshToken)
	retry, err := svc.RefreshTokenPair(ctx, original.RefreshToken)
	require.NoError(t, err)
	require.Equal(t, recovered.RefreshToken, retry.RefreshToken)
	for _, key := range mr.Keys() {
		if strings.HasPrefix(key, refreshTokenKeyPrefix) {
			value, getErr := mr.Get(key)
			require.NoError(t, getErr)
			require.NotContains(t, value, original.RefreshToken)
			require.NotContains(t, value, recovered.RefreshToken)
		}
	}
	_, err = svc.RefreshTokenPair(ctx, recovered.RefreshToken)
	require.NoError(t, err)
	_, err = svc.RefreshTokenPair(ctx, original.RefreshToken)
	require.ErrorIs(t, err, service.ErrRefreshTokenInvalid)
}

func TestRefreshTokenRotationRetryBoundedAndRevocable(t *testing.T) {
	for _, revoke := range []string{"none", "user", "family", "successor", "receipt"} {
		t.Run(revoke, func(t *testing.T) {
			ctx := context.Background()
			mr := miniredis.RunT(t)
			rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
			t.Cleanup(func() { _ = rdb.Close() })
			cache := &refreshTokenCache{rdb: rdb}
			old := &service.RefreshTokenData{UserID: 7, FamilyID: "f"}
			require.NoError(t, cache.StoreRefreshToken(ctx, "old", old, time.Minute))
			require.NoError(t, cache.RotateRefreshToken(ctx, "old", "next", old, time.Hour))
			mr.FastForward(10 * time.Second)
			require.NoError(t, cache.RotateRefreshToken(ctx, "old", "next", old, time.Hour))
			require.Equal(t, 20*time.Second, mr.TTL(refreshTokenKey("old")), "retry cannot extend receipt")
			require.Equal(t, time.Hour-10*time.Second, mr.TTL(refreshTokenKey("next")), "retry cannot extend successor")
			switch revoke {
			case "user":
				require.NoError(t, cache.DeleteUserRefreshTokens(ctx, 7))
			case "family":
				require.NoError(t, cache.DeleteTokenFamily(ctx, "f"))
			case "successor":
				require.NoError(t, cache.DeleteRefreshToken(ctx, "next"))
			case "receipt":
				require.NoError(t, cache.DeleteRefreshToken(ctx, "old"))
			case "none":
				mr.FastForward(21 * time.Second)
			}
			_, err := cache.GetRefreshToken(ctx, "old")
			require.ErrorIs(t, err, service.ErrRefreshTokenNotFound)
			require.ErrorIs(t, cache.RotateRefreshToken(ctx, "old", "next", old, time.Hour), service.ErrRefreshTokenNotFound)
			_, err = cache.GetRefreshToken(ctx, "next")
			if revoke == "none" {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, service.ErrRefreshTokenNotFound)
			}
		})
	}
}

func TestRefreshTokenRotationFailureBeforeCommitLeavesOldToken(t *testing.T) {
	ctx := context.Background()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { _ = rdb.Close() })
	cache := &refreshTokenCache{rdb: rdb}
	data := &service.RefreshTokenData{UserID: 7, FamilyID: "f"}
	require.NoError(t, cache.StoreRefreshToken(ctx, "old", data, time.Minute))
	hook := &refreshLostReplyHook{beforeCommit: true}
	rdb.AddHook(hook)
	require.Error(t, cache.RotateRefreshToken(ctx, "old", "next", data, time.Hour))
	remaining, err := cache.GetRefreshToken(ctx, "old")
	require.NoError(t, err)
	require.Empty(t, remaining.RotatedTo)
	require.False(t, mr.Exists(refreshTokenKey("next")))
	require.NoError(t, cache.RotateRefreshToken(ctx, "old", "next", data, time.Hour))
}

func TestRefreshTokenRotationDoesNotExtendOriginalExpiry(t *testing.T) {
	ctx := context.Background()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	cache := &refreshTokenCache{rdb: rdb}
	data := &service.RefreshTokenData{UserID: 7, FamilyID: "f"}
	require.NoError(t, cache.StoreRefreshToken(ctx, "old", data, time.Second))
	require.NoError(t, cache.RotateRefreshToken(ctx, "old", "next", data, time.Hour))
	require.Equal(t, time.Second, mr.TTL(refreshTokenKey("old")))
}

func TestRefreshTokenRotationRejectsBrokenIndexBeforeMutation(t *testing.T) {
	ctx := context.Background()
	cache := newRefreshTokenCacheForTest(t)
	data := &service.RefreshTokenData{UserID: 7, FamilyID: "f"}
	require.NoError(t, cache.StoreRefreshToken(ctx, "old", data, time.Minute))
	require.NoError(t, cache.rdb.Set(ctx, tokenFamilyKey("f"), "wrong-type", 0).Err())
	require.Error(t, cache.RotateRefreshToken(ctx, "old", "next", data, time.Hour))
	old, err := cache.GetRefreshToken(ctx, "old")
	require.NoError(t, err)
	require.Empty(t, old.RotatedTo)
	require.Zero(t, cache.rdb.Exists(ctx, refreshTokenKey("next")).Val())
}

func TestRefreshTokenRotationRecoveryRevalidatesUser(t *testing.T) {
	for _, change := range []string{"disabled", "password"} {
		t.Run(change, func(t *testing.T) {
			ctx := context.Background()
			cache := newRefreshTokenCacheForTest(t)
			user := &service.User{ID: 7, Email: "refresh@example.com", Role: service.RoleUser, Status: service.StatusActive}
			cfg := &config.Config{JWT: config.JWTConfig{Secret: "refresh-test-secret", AccessTokenExpireMinutes: 60, RefreshTokenExpireDays: 7}}
			svc := service.NewAuthService(nil, &refreshRecoveryUserRepo{user: user}, nil, cache, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
			original, err := svc.GenerateTokenPair(ctx, user, "f")
			require.NoError(t, err)
			successor, err := svc.RefreshTokenPair(ctx, original.RefreshToken)
			require.NoError(t, err)
			want := service.ErrTokenRevoked
			if change == "disabled" {
				user.Status = service.StatusDisabled
				want = service.ErrUserNotActive
			} else {
				user.PasswordHash = "changed-password-hash"
			}
			_, err = svc.RefreshTokenPair(ctx, original.RefreshToken)
			require.ErrorIs(t, err, want)
			_, err = cache.GetRefreshToken(ctx, refreshTestHash(successor.RefreshToken))
			require.ErrorIs(t, err, service.ErrRefreshTokenNotFound, "invalid session family is revoked")
		})
	}
}

type refreshBindingSettings struct{ service.SettingRepository }

func (*refreshBindingSettings) GetValue(context.Context, string) (string, error) { return "true", nil }

func TestRefreshTokenRotationRecoveryChecksSuccessorBinding(t *testing.T) {
	ctx := context.Background()
	cache := newRefreshTokenCacheForTest(t)
	user := &service.User{ID: 7, Email: "binding@example.com", Role: service.RoleUser, Status: service.StatusActive}
	cfg := &config.Config{JWT: config.JWTConfig{Secret: "binding-test-secret", AccessTokenExpireMinutes: 60, RefreshTokenExpireDays: 7}}
	settings := service.NewSettingService(&refreshBindingSettings{}, cfg)
	svc := service.NewAuthService(nil, &refreshRecoveryUserRepo{user: user}, nil, cache, cfg, settings, nil, nil, nil, nil, nil, nil, nil)
	// A legacy unbound session gets its first binding during rotation.
	original, err := svc.GenerateTokenPair(ctx, user, "binding-family")
	require.NoError(t, err)
	firstCtx := service.WithSessionBinding(ctx, &service.SessionBinding{IP: "192.0.2.1", UserAgent: "browser"})
	successor, err := svc.RefreshTokenPair(firstCtx, original.RefreshToken)
	require.NoError(t, err)
	retry, err := svc.RefreshTokenPair(firstCtx, original.RefreshToken)
	require.NoError(t, err)
	require.Equal(t, successor.RefreshToken, retry.RefreshToken)
	otherCtx := service.WithSessionBinding(ctx, &service.SessionBinding{IP: "192.0.2.2", UserAgent: "browser"})
	_, err = svc.RefreshTokenPair(otherCtx, original.RefreshToken)
	require.ErrorIs(t, err, service.ErrSessionBindingMismatch)
	_, err = cache.GetRefreshToken(ctx, refreshTestHash(successor.RefreshToken))
	require.ErrorIs(t, err, service.ErrRefreshTokenNotFound)
}
