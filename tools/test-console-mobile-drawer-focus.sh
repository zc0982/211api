#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  http://127.0.0.1:*) ;;
  *) echo "Usage: bash $0 <loopback console preview session URL>" >&2; exit 2 ;;
esac

export AGENT_BROWSER_SESSION="console-mobile-drawer-focus-$$"
trap 'agent-browser close >/dev/null' EXIT

assert_focus() {
  local selector="$1"
  local focused
  focused=$(agent-browser eval "document.activeElement.matches('$selector')")
  if [[ "$focused" != true ]]; then
    echo "Expected focus on $selector, got $(agent-browser eval 'document.activeElement.outerHTML.slice(0, 240)')" >&2
    exit 1
  fi
}

agent-browser set viewport 390 844
agent-browser open "$1"
agent-browser wait --fn 'innerWidth === 390 && document.querySelector("aside.sidebar")?.getBoundingClientRect().right === 0'

agent-browser press Tab
assert_focus '.console-topbar__menu'
agent-browser press Enter
agent-browser wait --fn 'document.querySelector("aside.sidebar").getBoundingClientRect().left === 0'
agent-browser press Tab
assert_focus '.sidebar-logo'
agent-browser press Tab
assert_focus '.sidebar-brand-title'
agent-browser press Tab
assert_focus '.sidebar-close'
agent-browser press Enter
assert_focus '.console-topbar__menu'
agent-browser press Tab
assert_focus '.console-topbar__brand'
