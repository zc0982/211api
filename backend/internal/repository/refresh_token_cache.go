package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/redis/go-redis/v9"
)

// A receipt is usable only while its immediate successor is still active.
// Reading both keys in Lua prevents a revoked/rotated successor from being revived.
var getRefreshTokenScript = redis.NewScript(`
 local value = redis.call('GET', KEYS[1])
 if not value then return nil end
 local data = cjson.decode(value)
 if data.rotated_to then
  local successor = redis.call('GET', ARGV[1] .. data.rotated_to)
  if not successor or cjson.decode(successor).rotated_to then return nil end
  return successor
 end
 return value
`)

// Commit the entire rotation in one operation. The old key becomes a bounded
// receipt, containing only hashes, so a lost reply can recover the SAME successor.
var rotateRefreshTokenScript = redis.NewScript(`
 local value = redis.call('GET', KEYS[1])
 if not value then return 0 end
 local old = cjson.decode(value)
 if old.rotated_to then
  if old.rotated_to ~= ARGV[1] then return 0 end
  local successor = redis.call('GET', KEYS[2])
  if not successor or cjson.decode(successor).rotated_to then return 0 end
  return 1
 end
 local remaining = redis.call('PTTL', KEYS[1])
 if remaining <= 0 then return 0 end
 local data = cjson.decode(ARGV[2])
 if data.user_id ~= old.user_id or data.family_id ~= old.family_id or data.token_version ~= old.token_version then return 0 end
 local ttl = tonumber(ARGV[3])
 -- Validate index types before writing: Redis scripts do not roll back runtime errors.
 for i = 3, 4 do
  local kind = redis.call('TYPE', KEYS[i]).ok
  if kind ~= 'none' and kind ~= 'set' then return redis.error_reply('invalid refresh token index type') end
 end
 redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl)
 for i = 3, 4 do
  redis.call('SADD', KEYS[i], ARGV[1], ARGV[5])
  if redis.call('PTTL', KEYS[i]) < ttl then redis.call('PEXPIRE', KEYS[i], ttl) end
 end
 -- Store only the successor hash. Older binaries see zero ExpiresAt and reject
 -- the receipt instead of treating it as another active token. Identity/version
 -- metadata stays in Go-encoded successor JSON, avoiding cjson int64 rounding.
 local receipt = cjson.encode({rotated_to = ARGV[1]})
 redis.call('SET', KEYS[1], receipt, 'PX', math.min(remaining, tonumber(ARGV[4])))
 return 1
`)

var deleteRefreshTokenScript = redis.NewScript(`
 local value = redis.call('GET', KEYS[1])
 if value then
  local data = cjson.decode(value)
  if data.rotated_to then redis.call('DEL', ARGV[1] .. data.rotated_to) end
 end
 return redis.call('DEL', KEYS[1])
`)

// Enumerate and delete atomically with rotation, including short-lived receipts.
var deleteRefreshTokenSetScript = redis.NewScript(`
 local hashes = redis.call('SMEMBERS', KEYS[1])
 for _, hash in ipairs(hashes) do redis.call('DEL', ARGV[1] .. hash) end
 redis.call('DEL', KEYS[1])
 return 1
`)

const refreshRotationRetryWindow = 30 * time.Second

const (
	refreshTokenKeyPrefix   = "refresh_token:"
	userRefreshTokensPrefix = "user_refresh_tokens:"
	tokenFamilyPrefix       = "token_family:"
)

// refreshTokenKey generates the Redis key for a refresh token.
func refreshTokenKey(tokenHash string) string {
	return refreshTokenKeyPrefix + tokenHash
}

// userRefreshTokensKey generates the Redis key for user's token set.
func userRefreshTokensKey(userID int64) string {
	return fmt.Sprintf("%s%d", userRefreshTokensPrefix, userID)
}

// tokenFamilyKey generates the Redis key for token family set.
func tokenFamilyKey(familyID string) string {
	return tokenFamilyPrefix + familyID
}

type refreshTokenCache struct {
	rdb *redis.Client
}

// NewRefreshTokenCache creates a new RefreshTokenCache implementation.
func NewRefreshTokenCache(rdb *redis.Client) service.RefreshTokenCache {
	return &refreshTokenCache{rdb: rdb}
}

func (c *refreshTokenCache) StoreRefreshToken(ctx context.Context, tokenHash string, data *service.RefreshTokenData, ttl time.Duration) error {
	key := refreshTokenKey(tokenHash)
	val, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal refresh token data: %w", err)
	}
	return c.rdb.Set(ctx, key, val, ttl).Err()
}

func (c *refreshTokenCache) GetRefreshToken(ctx context.Context, tokenHash string) (*service.RefreshTokenData, error) {
	key := refreshTokenKey(tokenHash)
	val, err := getRefreshTokenScript.Run(ctx, c.rdb, []string{key}, refreshTokenKeyPrefix).Text()
	if err != nil {
		if err == redis.Nil {
			return nil, service.ErrRefreshTokenNotFound
		}
		return nil, err
	}
	var data service.RefreshTokenData
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return nil, fmt.Errorf("unmarshal refresh token data: %w", err)
	}
	return &data, nil
}

func (c *refreshTokenCache) DeleteRefreshToken(ctx context.Context, tokenHash string) error {
	return deleteRefreshTokenScript.Run(ctx, c.rdb, []string{refreshTokenKey(tokenHash)}, refreshTokenKeyPrefix).Err()
}

func (c *refreshTokenCache) RotateRefreshToken(ctx context.Context, oldHash, newHash string, data *service.RefreshTokenData, ttl time.Duration) error {
	if data == nil || data.RotatedTo != "" || oldHash == newHash || ttl.Milliseconds() <= 0 {
		return fmt.Errorf("invalid refresh token rotation")
	}
	val, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal refresh token data: %w", err)
	}
	result, err := rotateRefreshTokenScript.Run(ctx, c.rdb, []string{
		refreshTokenKey(oldHash), refreshTokenKey(newHash), userRefreshTokensKey(data.UserID), tokenFamilyKey(data.FamilyID),
	}, newHash, string(val), ttl.Milliseconds(), refreshRotationRetryWindow.Milliseconds(), oldHash).Int()
	if err != nil {
		return err
	}
	if result != 1 {
		return service.ErrRefreshTokenNotFound
	}
	return nil
}

func (c *refreshTokenCache) DeleteUserRefreshTokens(ctx context.Context, userID int64) error {
	return deleteRefreshTokenSetScript.Run(ctx, c.rdb, []string{userRefreshTokensKey(userID)}, refreshTokenKeyPrefix).Err()
}

func (c *refreshTokenCache) DeleteTokenFamily(ctx context.Context, familyID string) error {
	return deleteRefreshTokenSetScript.Run(ctx, c.rdb, []string{tokenFamilyKey(familyID)}, refreshTokenKeyPrefix).Err()
}

func (c *refreshTokenCache) AddToUserTokenSet(ctx context.Context, userID int64, tokenHash string, ttl time.Duration) error {
	key := userRefreshTokensKey(userID)
	pipe := c.rdb.Pipeline()
	pipe.SAdd(ctx, key, tokenHash)
	pipe.Expire(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func (c *refreshTokenCache) AddToFamilyTokenSet(ctx context.Context, familyID string, tokenHash string, ttl time.Duration) error {
	key := tokenFamilyKey(familyID)
	pipe := c.rdb.Pipeline()
	pipe.SAdd(ctx, key, tokenHash)
	pipe.Expire(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func (c *refreshTokenCache) GetUserTokenHashes(ctx context.Context, userID int64) ([]string, error) {
	key := userRefreshTokensKey(userID)
	return c.rdb.SMembers(ctx, key).Result()
}

func (c *refreshTokenCache) GetFamilyTokenHashes(ctx context.Context, familyID string) ([]string, error) {
	key := tokenFamilyKey(familyID)
	return c.rdb.SMembers(ctx, key).Result()
}

func (c *refreshTokenCache) IsTokenInFamily(ctx context.Context, familyID string, tokenHash string) (bool, error) {
	key := tokenFamilyKey(familyID)
	return c.rdb.SIsMember(ctx, key, tokenHash).Result()
}
