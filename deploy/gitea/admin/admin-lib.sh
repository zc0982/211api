#!/usr/bin/env bash

# Shared, fail-closed primitives for the root-run Gitea administration tools.
# This file defines functions only. Secret values are read from files and are
# never accepted as command-line arguments.

GITEA_API_URL=https://git.211api.com/api/v1
GITEA_SWAGGER_URL=https://git.211api.com/swagger.v1.json
GITEA_ADMIN_CURL_CONFIG=/etc/gitea/admin-api.curl
GITEA_ADMIN_METADATA=/etc/gitea/admin-api.metadata.json
GITEA_BOOTSTRAP_ENV=/etc/gitea/bootstrap.env
GITEA_CREDENTIAL_DIR=/etc/gitea/bootstrap-credentials
GITEA_TOKEN_DIR=/etc/gitea/tokens
GITEA_TOKEN_METADATA_DIR=/etc/gitea/token-metadata
GITEA_IMAGE_LOCK=/opt/gitea/images.lock.env
GITEA_PLATFORM_ENV=/etc/gitea/platform.env
GITEA_PLATFORM_COMPOSE=/opt/gitea/platform/compose.yaml
GITEA_EXPECTED_VERSION=1.26.4
GITEA_ORG=211api
GITEA_REPO=211api

gitea_die() {
  printf 'gitea-admin: %s\n' "$*" >&2
  exit 1
}

gitea_require_root() {
  [[ ${EUID:-$(id -u)} -eq 0 ]] || gitea_die 'must run as root'
}

gitea_require_commands() {
  local command
  for command in "$@"; do
    command -v "$command" >/dev/null 2>&1 ||
      gitea_die "required command is unavailable: $command"
  done
}

gitea_require_root_file() {
  local path=$1 expected_mode=${2:-600} metadata
  [[ -f "$path" && ! -L "$path" ]] ||
    gitea_die "required regular non-symlink file is missing: $path"
  metadata=$(stat -c '%u:%g %a' -- "$path")
  [[ "$metadata" == "0:0 $expected_mode" ]] ||
    gitea_die "unsafe owner or mode for $path (expected 0:0 $expected_mode)"
}

gitea_require_root_secret() {
  local path=$1
  gitea_require_root_file "$path" 600
  [[ -s "$path" ]] || gitea_die "secret file is empty: $path"
}

gitea_require_root_dir() {
  local path=$1 expected_mode=${2:-700} metadata
  [[ -d "$path" && ! -L "$path" ]] ||
    gitea_die "required directory is missing or is a symlink: $path"
  metadata=$(stat -c '%u:%g %a' -- "$path")
  [[ "$metadata" == "0:0 $expected_mode" ]] ||
    gitea_die "unsafe owner or mode for $path (expected 0:0 $expected_mode)"
}

gitea_install_root_dir() {
  local path=$1
  if [[ -e "$path" || -L "$path" ]]; then
    gitea_require_root_dir "$path" 700
  else
    install -d -o root -g root -m 0700 -- "$path"
  fi
}

gitea_make_runtime() {
  local runtime
  runtime=$(mktemp -d /run/gitea-admin.XXXXXX) ||
    gitea_die 'cannot create root runtime directory'
  chown root:root "$runtime"
  chmod 0700 "$runtime"
  printf '%s\n' "$runtime"
}

gitea_load_bootstrap_env() {
  local file=$1 line key value required
  local -a required_keys=(BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_EMAIL)
  local -A seen=()

  gitea_require_root_secret "$file"
  unset BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_EMAIL
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || gitea_die 'bootstrap.env contains invalid syntax'
    key=${line%%=*}
    value=${line#*=}
    [[ -z "${seen[$key]:-}" ]] ||
      gitea_die "bootstrap.env contains duplicate key: $key"
    case "$key" in
      BOOTSTRAP_ADMIN_USERNAME)
        [[ "$value" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,38}$ ]] ||
          gitea_die 'BOOTSTRAP_ADMIN_USERNAME is invalid'
        ;;
      BOOTSTRAP_ADMIN_EMAIL)
        [[ "$value" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] ||
          gitea_die 'BOOTSTRAP_ADMIN_EMAIL is invalid'
        ;;
      *)
        gitea_die "bootstrap.env contains unknown key: $key"
        ;;
    esac
    seen[$key]=1
    printf -v "$key" '%s' "$value"
  done <"$file"

  for required in "${required_keys[@]}"; do
    [[ -n "${seen[$required]:-}" ]] ||
      gitea_die "bootstrap.env is missing $required"
  done
  export BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_EMAIL
}

gitea_compose() {
  docker compose \
    --env-file "$GITEA_IMAGE_LOCK" \
    --env-file "$GITEA_PLATFORM_ENV" \
    -f "$GITEA_PLATFORM_COMPOSE" "$@"
}

gitea_cli() {
  gitea_compose exec -T --user 1000:1000 gitea gitea "$@"
}

gitea_cli_user_exists() {
  local username=$1
  gitea_cli admin user list 2>/dev/null |
    awk -v username="$username" 'NR > 1 && $2 == username { found=1 } END { exit !found }'
}

gitea_api_status() {
  local config=$1 method=$2 path=$3 output=$4 body=${5:-}
  local -a args=(
    curl --config "$config"
    --silent --show-error
    --proto '=https' --tlsv1.2
    --connect-timeout 5 --max-time 30
    --request "$method"
    --output "$output"
    --write-out '%{http_code}'
  )
  if [[ -n "$body" ]]; then
    args+=(--header 'Content-Type: application/json' --data-binary "@$body")
  fi
  args+=("${GITEA_API_URL}${path}")
  "${args[@]}"
}

gitea_swagger_status() {
  local config=$1 output=$2
  curl --config "$config" \
    --silent --show-error \
    --proto '=https' --tlsv1.2 \
    --connect-timeout 5 --max-time 30 \
    --output "$output" \
    --write-out '%{http_code}' \
    "$GITEA_SWAGGER_URL"
}

gitea_expect_status() {
  local actual=$1 expected=$2 operation=$3
  [[ "$actual" == "$expected" ]] ||
    gitea_die "$operation returned HTTP $actual (expected $expected)"
}

gitea_expect_one_of_statuses() {
  local actual=$1 operation=$2
  shift 2
  local expected
  for expected in "$@"; do
    [[ "$actual" == "$expected" ]] && return 0
  done
  gitea_die "$operation returned unexpected HTTP $actual"
}

gitea_validate_bootstrap_admin_gate_response() {
  local status=$1 response=$2 username=$3 password_file=$4
  if [[ "$status" == 403 ]] && jq -e '
    (.message | type == "string")
    and (.message | startswith(
      "You must change your password. Change it at: "
    ))
  ' "$response" >/dev/null; then
    gitea_require_root_secret "$password_file"
    gitea_die "manual gate: change the bootstrap password and enable 2FA for $username, then rerun"
  fi
  gitea_expect_status "$status" 200 \
    'GET /admin/users with bootstrap administrator token'
  jq -e 'type == "array"' "$response" >/dev/null ||
    gitea_die 'bootstrap administrator gate returned a non-array user list'
}

gitea_api_get_all() {
  local config=$1 path=$2 output=$3 runtime=$4 prefix=$5
  local page=1 limit=50 status count separator page_file merged
  [[ "$prefix" =~ ^[a-zA-Z0-9._-]+$ ]] ||
    gitea_die 'unsafe pagination scratch prefix'
  if [[ "$path" == *\?* ]]; then
    separator='&'
  else
    separator='?'
  fi
  printf '[]\n' >"$output"
  while ((page <= 100)); do
    page_file="$runtime/$prefix.page-$page.json"
    status=$(gitea_api_status "$config" GET \
      "${path}${separator}page=$page&limit=$limit" "$page_file") ||
      gitea_die "failed to retrieve API page $page for $path"
    gitea_expect_status "$status" 200 "GET paginated $path"
    jq -e 'type == "array"' "$page_file" >/dev/null ||
      gitea_die "paginated API response is not an array for $path"
    count=$(jq -r 'length' "$page_file")
    merged="$runtime/$prefix.merged.json"
    jq -s '.[0] + .[1]' "$output" "$page_file" >"$merged"
    mv -f -- "$merged" "$output"
    ((count < limit)) && return 0
    ((page += 1))
  done
  gitea_die "paginated API response exceeded 5000 rows for $path"
}

gitea_validate_admin_curl_config() {
  local file=${1:-$GITEA_ADMIN_CURL_CONFIG}
  gitea_require_root_secret "$file"
  [[ $(wc -l <"$file") -eq 1 ]] ||
    gitea_die "admin curl config must contain exactly one line: $file"
  grep -Eq '^header = "Authorization: token [A-Za-z0-9_]+"$' "$file" ||
    gitea_die "admin curl config has an unexpected directive: $file"
}

gitea_validate_admin_control_record() {
  gitea_validate_admin_curl_config
  gitea_require_root_secret "$GITEA_ADMIN_METADATA"
  jq -e '
    (.created_at | try fromdateiso8601 catch null) as $created
    | (.rotation_due | try fromdateiso8601 catch null) as $rotation
    | .token_name == "bootstrap-admin-automation"
    and .token_id == null
    and (.scopes | sort) ==
      (["write:admin", "write:organization", "write:repository"] | sort)
    and $created != null
    and $created <= (now + 300)
    and .server_expiry == null
    and $rotation != null
    and $rotation > $created
    and now < $rotation
    and .revocation_procedure ==
      "Log in as the 2FA bootstrap administrator, revoke bootstrap-admin-automation in Applications, then remove admin-api.curl and this metadata file."
  ' "$GITEA_ADMIN_METADATA" >/dev/null ||
    gitea_die 'administrator control-token metadata drifted or reached its rotation deadline'
}

gitea_make_token_curl_config() {
  local token_file=$1 output=$2
  gitea_require_root_secret "$token_file"
  [[ $(wc -l <"$token_file") -le 1 ]] ||
    gitea_die "token file contains multiple lines: $token_file"
  grep -Eq '^[A-Za-z0-9_]+$' "$token_file" ||
    gitea_die "token file has an unexpected format: $token_file"
  umask 077
  {
    printf 'header = "Authorization: token '
    tr -d '\r\n' <"$token_file"
    printf '"\n'
  } >"$output"
  chmod 0600 "$output"
}

gitea_make_basic_curl_config() {
  local username=$1 password_file=$2 output=$3
  gitea_require_root_secret "$password_file"
  [[ "$username" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,38}$ ]] ||
    gitea_die 'unsafe username for Basic authentication config'
  [[ $(wc -l <"$password_file") -le 1 ]] ||
    gitea_die "password file contains multiple lines: $password_file"
  grep -Eq '^[A-Za-z0-9]+$' "$password_file" ||
    gitea_die "password file has an unexpected format: $password_file"
  umask 077
  awk -v username="$username" '{ printf "user = \"%s:%s\"\n", username, $0 }' \
    "$password_file" >"$output"
  chmod 0600 "$output"
}

gitea_template_keys_match_definition() {
  local swagger=$1 definition=$2 template=$3
  jq -e --arg definition "$definition" --slurpfile body "$template" '
    .definitions[$definition].properties as $properties
    | ($properties | type == "object")
    and ([($body[0] | keys[]) as $key | $properties | has($key)] | all)
    and ([((.definitions[$definition].required // [])[]) as $key
      | $body[0] | has($key)] | all)
    and ([
      ($body[0] | to_entries[]) as $entry
      | $properties[$entry.key] as $schema
      | (
          (($schema.type == ($entry.value | type))
           or ($schema.type == "integer"
               and ($entry.value | type) == "number"
               and ($entry.value | floor) == $entry.value))
          and (($schema.enum // null) == null
               or ($schema.enum | index($entry.value)) != null)
          and (if $schema.type == "array" and ($schema.items.type // null) != null
               then all($entry.value[]; type == $schema.items.type)
               else true end)
          and (if $schema.type == "object"
                   and ($schema.additionalProperties.type // null) != null
               then all($entry.value[]; type == $schema.additionalProperties.type)
               else true end)
        )
    ] | all)
  ' "$swagger" >/dev/null ||
    gitea_die "template keys, types, or enums do not match OpenAPI definition $definition: $template"
}

gitea_validate_openapi() {
  local runtime=$1
  local swagger="$runtime/swagger.v1.json" status template_root
  template_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/templates" && pwd)
  status=$(gitea_swagger_status "$GITEA_ADMIN_CURL_CONFIG" "$swagger") ||
    gitea_die 'failed to retrieve deployed OpenAPI document'
  gitea_expect_status "$status" 200 'GET /swagger.v1.json'

  jq -e --arg version "$GITEA_EXPECTED_VERSION" '
    .info.version == $version
    and (.paths["/admin/users"].post | type == "object")
    and (.paths["/admin/users"].get | type == "object")
    and (.paths["/admin/users/{username}/orgs"].post | type == "object")
    and (.paths["/orgs/{org}"].get | type == "object")
    and (.paths["/orgs/{org}/repos"].post | type == "object")
    and (.paths["/orgs/{org}/teams"].post | type == "object")
    and (.paths["/orgs/{org}/teams"].get | type == "object")
    and (.paths["/users/{username}/tokens"].post | type == "object")
    and (.paths["/users/{username}/tokens"].get | type == "object")
    and (.paths["/user"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}"].patch | type == "object")
    and (.paths["/repos/{owner}/{repo}"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/branch_protections"].post | type == "object")
    and (.paths["/repos/{owner}/{repo}/branch_protections"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/tag_protections"].post | type == "object")
    and (.paths["/repos/{owner}/{repo}/tag_protections"].get | type == "object")
    and (.paths["/teams/{id}/members/{username}"].put | type == "object")
    and (.paths["/teams/{id}/members"].get | type == "object")
    and (.paths["/teams/{id}/repos/{org}/{repo}"].put | type == "object")
    and (.paths["/teams/{id}/repos"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/collaborators/{collaborator}"].put | type == "object")
    and (.paths["/repos/{owner}/{repo}/collaborators/{collaborator}/permission"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/push_mirrors"].get | type == "object")
    and (.paths["/packages/{owner}"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/releases"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/releases"].post | type == "object")
    and (.paths["/repos/{owner}/{repo}/commits/{ref}/statuses"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/actions/secrets"].get | type == "object")
    and (.paths["/repos/{owner}/{repo}/actions/secrets/{secretname}"].put | type == "object")
    and (.definitions.CreateAccessTokenOption.required | index("name") != null)
    and (.definitions.CreateAccessTokenOption.properties.scopes.type == "array")
    and (.definitions.CreateAccessTokenOption.properties.scopes.items.type == "string")
    and (.definitions.AccessToken.properties | has("scopes"))
    and (.definitions.AccessToken.properties | has("sha1"))
  ' "$swagger" >/dev/null ||
    gitea_die "deployed OpenAPI is not the reviewed Gitea $GITEA_EXPECTED_VERSION contract"

  gitea_template_keys_match_definition "$swagger" CreateOrgOption \
    "$template_root/create-org.json"
  gitea_template_keys_match_definition "$swagger" CreateRepoOption \
    "$template_root/create-repo.json"
  gitea_template_keys_match_definition "$swagger" CreateTeamOption \
    "$template_root/team-maintainers.json"
  gitea_template_keys_match_definition "$swagger" CreateTeamOption \
    "$template_root/team-release-maintainers.json"
  gitea_template_keys_match_definition "$swagger" CreateTeamOption \
    "$template_root/team-package-publishers.json"
  gitea_template_keys_match_definition "$swagger" CreateTeamOption \
    "$template_root/team-package-readers.json"
  gitea_template_keys_match_definition "$swagger" EditRepoOption \
    "$template_root/repository-settings.json"
  gitea_template_keys_match_definition "$swagger" CreateBranchProtectionOption \
    "$template_root/branch-main.json"
  gitea_template_keys_match_definition "$swagger" CreateBranchProtectionOption \
    "$template_root/branch-release.json"
  gitea_template_keys_match_definition "$swagger" CreateTagProtectionOption \
    "$template_root/tag-v.json"
}

gitea_validate_cli_contract() {
  local runtime=$1
  local version_file="$runtime/gitea-version" create_help="$runtime/user-create.help"
  local token_help="$runtime/token-create.help" hooks_help="$runtime/regenerate-hooks.help"
  gitea_cli --version >"$version_file" 2>&1 ||
    gitea_die 'cannot inspect the deployed Gitea CLI version'
  grep -Eq "^gitea version ${GITEA_EXPECTED_VERSION}([ +]|$)" "$version_file" ||
    gitea_die "deployed Gitea CLI is not version $GITEA_EXPECTED_VERSION"
  gitea_cli admin user create --help >"$create_help" 2>&1 ||
    gitea_die 'cannot inspect admin user create CLI help'
  gitea_cli admin user generate-access-token --help >"$token_help" 2>&1 ||
    gitea_die 'cannot inspect access-token CLI help'
  for flag in --username --email --user-type --random-password \
    --random-password-length --must-change-password --restricted; do
    grep -F -- "$flag" "$create_help" >/dev/null ||
      gitea_die "Gitea user-create CLI is missing reviewed flag $flag"
  done
  grep -F -- 'can be disabled by --must-change-password=false' "$create_help" >/dev/null ||
    gitea_die 'Gitea user-create CLI no longer exposes explicit password-change disablement'
  for flag in --username --token-name --raw --scopes; do
    grep -F -- "$flag" "$token_help" >/dev/null ||
      gitea_die "Gitea token CLI is missing reviewed flag $flag"
  done
  gitea_cli admin regenerate hooks --help >"$hooks_help" 2>&1 ||
    gitea_die 'cannot inspect managed-hook regeneration CLI help'
  grep -F -- 'Regenerate git-hooks' "$hooks_help" >/dev/null ||
    gitea_die 'Gitea managed-hook regeneration CLI contract drifted'
}

gitea_assert_repository_shape() {
  local file=$1
  jq -e --arg owner "$GITEA_ORG" --arg repo "$GITEA_REPO" '
    .owner.login == $owner
    and .name == $repo
    and .full_name == ($owner + "/" + $repo)
    and .private == true
    and .archived == false
    and .default_branch == "main"
    and .has_code == true
    and .has_issues == false
    and .has_projects == false
    and .has_pull_requests == true
    and .has_wiki == false
    and .has_releases == true
    and .has_packages == true
    and .has_actions == true
    and (.mirror != true)
    and (.internal != true)
    and (.template != true)
  ' "$file" >/dev/null ||
    gitea_die 'repository identity, privacy, units, default branch, or mirror state drifted'
}

gitea_assert_organization_shape() {
  local file=$1
  jq -e --arg org "$GITEA_ORG" '
    (.username // .name) == $org
    and .full_name == "211API"
    and .description == "Private 211API engineering organization"
    and .visibility == "private"
    and .repo_admin_change_team_access == false
  ' "$file" >/dev/null ||
    gitea_die 'organization identity, visibility, or team-administration policy drifted'
}

gitea_assert_release_protection() {
  local file=$1
  jq -e '
    (.rule_name // .branch_name) == "release/v*"
    and .enable_push == true
    and .enable_push_whitelist == true
    and (.push_whitelist_usernames | sort) == []
    and (.push_whitelist_teams | sort) == ["release-maintainers"]
    and .push_whitelist_deploy_keys == false
    and .enable_force_push == false
    and .enable_force_push_allowlist == false
    and (.force_push_allowlist_usernames | sort) == []
    and (.force_push_allowlist_teams | sort) == []
    and .force_push_allowlist_deploy_keys == false
    and .enable_merge_whitelist == false
    and (.merge_whitelist_usernames | sort) == []
    and (.merge_whitelist_teams | sort) == []
    and .enable_status_check == false
    and (.status_check_contexts | sort) == []
    and .block_admin_merge_override == true
  ' "$file" >/dev/null ||
    gitea_die 'release/v* branch-protection settings drifted'
}

gitea_assert_main_protection() {
  local file=$1
  jq -e '
    (.rule_name // .branch_name) == "main"
    and .enable_push == false
    and .enable_push_whitelist == false
    and (.push_whitelist_usernames | sort) == []
    and (.push_whitelist_teams | sort) == []
    and .push_whitelist_deploy_keys == false
    and .enable_force_push == false
    and .enable_force_push_allowlist == false
    and (.force_push_allowlist_usernames | sort) == []
    and (.force_push_allowlist_teams | sort) == []
    and .force_push_allowlist_deploy_keys == false
    and .enable_merge_whitelist == true
    and (.merge_whitelist_usernames | sort) == []
    and (.merge_whitelist_teams | sort) == ["maintainers"]
    and .enable_status_check == true
    and (.status_check_contexts | sort) == ["ci / required", "security / required"]
    and .block_admin_merge_override == true
  ' "$file" >/dev/null || gitea_die 'main branch-protection settings drifted'
}

gitea_assert_tag_protection() {
  local file=$1
  jq -e '
    .name_pattern == "v*"
    and (.whitelist_usernames | sort) == ["svc-release-tag"]
    and (.whitelist_teams | sort) == []
  ' "$file" >/dev/null || gitea_die 'v* tag-protection settings drifted'
}

gitea_owner_team_id() {
  local teams_file=$1
  jq -er '
    [.[] | select(.name == "Owners")] as $matches
    | select(($matches | length) == 1)
    | $matches[0]
    | select(.permission == "owner")
    | select(.includes_all_repositories == true)
    | select(.can_create_org_repo == true)
    | select(.units_map["repo.code"] == "owner")
    | select(.units_map["repo.pulls"] == "owner")
    | select(.units_map["repo.releases"] == "owner")
    | select(.units_map["repo.packages"] == "owner")
    | select(.units_map["repo.actions"] == "owner")
    | .id
    | select(type == "number" and . > 0)
  ' "$teams_file"
}

gitea_assert_only_owner_member() {
  local members_file=$1 username=$2
  jq -e --arg username "$username" '
    (map(.login) | sort) == [$username]
  ' "$members_file" >/dev/null ||
    gitea_die 'organization Owners team has an unreviewed or missing administrator'
}

gitea_scope_json() {
  local comma_list=$1
  jq -cn --arg scopes "$comma_list" '$scopes | split(",")'
}

gitea_validate_token_record() {
  local token_file=$1 metadata=$2 account=$3 token_name=$4 scopes=$5
  local scope_json
  gitea_require_root_secret "$token_file"
  gitea_require_root_secret "$metadata"
  scope_json=$(gitea_scope_json "$scopes")
  jq -e \
    --arg account "$account" \
    --arg token_name "$token_name" \
    --argjson scopes "$scope_json" '
      (.created_at | try fromdateiso8601 catch null) as $created
      | (.rotation_due | try fromdateiso8601 catch null) as $rotation
      | (.token_id | tostring) as $token_id
      | .account == $account
      and .token_name == $token_name
      and (.scopes | sort) == ($scopes | sort)
      and (.token_id | type == "number" and . > 0)
      and $created != null
      and $created <= (now + 300)
      and .server_expiry == null
      and $rotation != null
      and $rotation > $created
      and now < $rotation
      and (.revocation_procedure | type == "string")
      and (.revocation_procedure | contains($account))
      and (.revocation_procedure | contains($token_id))
    ' "$metadata" >/dev/null ||
    gitea_die "local token metadata drifted for $account/$token_name"
}

gitea_assert_actions_secret_names() {
  local file=$1 require_ssh=${2:-false}
  jq -e --argjson require_ssh "$require_ssh" '
    def rows: if type == "array" then . else (.secrets // []) end;
    (rows | map(.name)) as $names
    | ($names | index("REGISTRY_BUILD_TOKEN") != null)
    and ($names | index("REGISTRY_RELEASE_TOKEN") != null)
    and ($names | index("RELEASE_RECORD_TOKEN") != null)
    and ($names | index("GITEA_TOKEN") == null)
    and (($require_ssh | not) or (
      ($names | index("DEPLOY_SSH_KEY") != null)
      and ($names | index("DEPLOY_KNOWN_HOSTS") != null)
      and ($names | index("RELEASE_TAG_SSH_KEY") != null)
      and ($names | index("RELEASE_TAG_KNOWN_HOSTS") != null)
    ))
  ' "$file" >/dev/null ||
    gitea_die 'Actions secret names drifted or a static GITEA_TOKEN shadows the job token'
}

gitea_assert_required_statuses() {
  local file=$1 sha=$2
  jq -e --arg sha "$sha" '
    def latest($context):
      [ .[] | select(.context == $context) ]
      | sort_by(.created_at)
      | last;
    (latest("ci / required")) as $ci
    | (latest("security / required")) as $security
    | $ci.status == "success"
    and $security.status == "success"
    and $ci.sha == $sha
    and $security.sha == $sha
  ' "$file" >/dev/null ||
    gitea_die 'actual commit statuses do not prove successful required contexts'
}

gitea_token_permission_probe() {
  local token_file=$1 positive_kind=$2 runtime=$3 prefix=$4
  local config="$runtime/$prefix.curl" output="$runtime/$prefix.out" status
  gitea_make_token_curl_config "$token_file" "$config"

  case "$positive_kind" in
    repository)
      status=$(gitea_api_status "$config" GET \
        "/repos/$GITEA_ORG/$GITEA_REPO" "$output") ||
        gitea_die "positive repository probe failed for $prefix"
      ;;
    repository-package)
      status=$(gitea_api_status "$config" GET \
        "/repos/$GITEA_ORG/$GITEA_REPO" "$output") ||
        gitea_die "positive repository probe failed for $prefix"
      gitea_expect_status "$status" 200 \
        "positive repository token probe for $prefix"
      status=$(gitea_api_status "$config" GET \
        "/packages/$GITEA_ORG?type=container&page=1&limit=1" "$output") ||
        gitea_die "positive package probe failed for $prefix"
      ;;
    package)
      status=$(gitea_api_status "$config" GET \
        "/packages/$GITEA_ORG?type=container&page=1&limit=1" "$output") ||
        gitea_die "positive package probe failed for $prefix"
      ;;
    release)
      status=$(gitea_api_status "$config" GET \
        "/repos/$GITEA_ORG/$GITEA_REPO/releases?page=1&limit=1" "$output") ||
        gitea_die "positive release probe failed for $prefix"
      ;;
    *)
      gitea_die "unknown positive token probe: $positive_kind"
      ;;
  esac
  gitea_expect_status "$status" 200 "positive $positive_kind token probe for $prefix"

  case "$positive_kind" in
    package)
      status=$(gitea_api_status "$config" GET \
        "/repos/$GITEA_ORG/$GITEA_REPO" "$output") ||
        gitea_die "negative repository-read probe failed for $prefix"
      gitea_expect_status "$status" 403 \
        "negative repository-read token probe for $prefix"
      printf '{}\n' >"$runtime/$prefix.invalid-release.json"
      status=$(gitea_api_status "$config" POST \
        "/repos/$GITEA_ORG/$GITEA_REPO/releases" "$output" \
        "$runtime/$prefix.invalid-release.json") ||
        gitea_die "negative release-create probe failed for $prefix"
      gitea_expect_status "$status" 403 \
        "negative release-create token probe for $prefix"
      ;;
    release)
      status=$(gitea_api_status "$config" GET \
        "/packages/$GITEA_ORG?type=container&page=1&limit=1" "$output") ||
        gitea_die "negative package-read probe failed for $prefix"
      gitea_expect_status "$status" 403 \
        "negative package-read token probe for $prefix"
      ;;
    repository|repository-package)
      printf '{}\n' >"$runtime/$prefix.invalid-release.json"
      status=$(gitea_api_status "$config" POST \
        "/repos/$GITEA_ORG/$GITEA_REPO/releases" "$output" \
        "$runtime/$prefix.invalid-release.json") ||
        gitea_die "negative release-create probe failed for $prefix"
      gitea_expect_status "$status" 403 \
        "negative release-create token probe for $prefix"
      ;;
  esac

  printf '{"private":true}\n' >"$runtime/$prefix.noop-settings.json"
  status=$(gitea_api_status "$config" PATCH \
    "/repos/$GITEA_ORG/$GITEA_REPO" "$output" \
    "$runtime/$prefix.noop-settings.json") ||
    gitea_die "negative repository-settings probe failed for $prefix"
  gitea_expect_status "$status" 403 \
    "negative repository-settings token probe for $prefix"
}

gitea_atomic_curl_config_from_token() {
  local token_file=$1 target=$2 partial="${target}.partial"
  [[ ! -L "$target" && ! -L "$partial" ]] ||
    gitea_die "refusing symlink curl-config target: $target"
  gitea_make_token_curl_config "$token_file" "$partial"
  chown root:root "$partial"
  chmod 0600 "$partial"
  mv -f -- "$partial" "$target"
}
