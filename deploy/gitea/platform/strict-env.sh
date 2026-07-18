#!/usr/bin/env bash

# Strict data-only loaders for root-run platform programs. This file defines
# functions only; callers validate this code file before sourcing it.

_gitea_env_error() {
  printf 'strict-env: invalid %s entry: %s\n' "$1" "$2" >&2
  return 1
}

gitea_load_image_lock() {
  local file=$1 line key value required
  local -a required_keys=(
    GITEA_IMAGE
    RUNNER_IMAGE
    CADDY_IMAGE
    GITEA_POSTGRES_IMAGE
    DIND_IMAGE
    DOCKER_CLI_IMAGE
    GO_CI_IMAGE
    NODE_CI_IMAGE
    APP_NODE_IMAGE
    APP_GO_IMAGE
    APP_ALPINE_IMAGE
    APP_POSTGRES_IMAGE
    PNPM_VERSION
    GOLANGCI_LINT_VERSION
    GOVULNCHECK_VERSION
  )
  local -A seen=()

  [[ -f "$file" && ! -L "$file" ]] || _gitea_env_error image-lock file
  for required in "${required_keys[@]}"; do
    unset "$required"
  done

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || {
      _gitea_env_error image-lock syntax
      return 1
    }
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      GITEA_IMAGE|RUNNER_IMAGE|CADDY_IMAGE|GITEA_POSTGRES_IMAGE|DIND_IMAGE|DOCKER_CLI_IMAGE|GO_CI_IMAGE|NODE_CI_IMAGE|APP_NODE_IMAGE|APP_GO_IMAGE|APP_ALPINE_IMAGE|APP_POSTGRES_IMAGE)
        [[ "$value" =~ ^[a-z0-9][a-z0-9._/:-]+@sha256:[0-9a-f]{64}$ ]] || {
          _gitea_env_error image-lock image-reference
          return 1
        }
        ;;
      PNPM_VERSION)
        [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
          _gitea_env_error image-lock version
          return 1
        }
        ;;
      GOLANGCI_LINT_VERSION|GOVULNCHECK_VERSION)
        [[ "$value" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
          _gitea_env_error image-lock version
          return 1
        }
        ;;
      *)
        _gitea_env_error image-lock unknown-key
        return 1
        ;;
    esac
    [[ -z "${seen[$key]:-}" ]] || {
      _gitea_env_error image-lock duplicate-key
      return 1
    }
    seen[$key]=1
    printf -v "$key" '%s' "$value"
    export "$key"
  done <"$file"

  for required in "${required_keys[@]}"; do
    [[ -n "${seen[$required]:-}" ]] || {
      _gitea_env_error image-lock missing-key
      return 1
    }
  done
}

gitea_load_platform_env() {
  local file=$1 line key value required
  local -a required_keys=(
    GITEA_DB_PASSWORD_FILE
    GITEA_SECRET_KEY_FILE
    GITEA_INTERNAL_TOKEN_FILE
    GITEA_BACKUP_API_CONFIG
    BACKUP_AGE_RECIPIENT
  )
  local -a all_keys=(
    GITEA_DB_PASSWORD_FILE
    GITEA_SECRET_KEY_FILE
    GITEA_INTERNAL_TOKEN_FILE
    GITEA_BACKUP_API_CONFIG
    BACKUP_AGE_RECIPIENT
  )
  local -A seen=()

  [[ -f "$file" && ! -L "$file" ]] || _gitea_env_error platform-env file
  for required in "${all_keys[@]}"; do
    unset "$required"
  done

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || {
      _gitea_env_error platform-env syntax
      return 1
    }
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      GITEA_DB_PASSWORD_FILE|GITEA_SECRET_KEY_FILE|GITEA_INTERNAL_TOKEN_FILE|GITEA_BACKUP_API_CONFIG)
        [[ "$value" == /* && "$value" != *[[:space:]]* && "$value" != *//* &&
          "$value" != */.. && "$value" != *'/../'* ]] || {
          _gitea_env_error platform-env absolute-path
          return 1
        }
        ;;
      BACKUP_AGE_RECIPIENT)
        [[ "$value" =~ ^age1[0-9a-z]+$ ]] || {
          _gitea_env_error platform-env age-recipient
          return 1
        }
        ;;
      *)
        _gitea_env_error platform-env unknown-key
        return 1
        ;;
    esac
    [[ -z "${seen[$key]:-}" ]] || {
      _gitea_env_error platform-env duplicate-key
      return 1
    }
    seen[$key]=1
    printf -v "$key" '%s' "$value"
    export "$key"
  done <"$file"

  for required in "${required_keys[@]}"; do
    [[ -n "${seen[$required]:-}" ]] || {
      _gitea_env_error platform-env missing-key
      return 1
    }
  done
}
