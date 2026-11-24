-- NULL preserves the distinction between historical billed counts and observed hits.
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS upstream_cache_read_tokens INTEGER;

ALTER TABLE usage_dashboard_hourly
    ADD COLUMN IF NOT EXISTS upstream_cache_read_tokens BIGINT,
    ADD COLUMN IF NOT EXISTS cache_prompt_tokens BIGINT;
ALTER TABLE usage_dashboard_daily
    ADD COLUMN IF NOT EXISTS upstream_cache_read_tokens BIGINT,
    ADD COLUMN IF NOT EXISTS cache_prompt_tokens BIGINT;
