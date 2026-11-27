#!/usr/bin/env bash
set -euo pipefail

preview_url=$(node -e '
  const input = process.argv[1].trim()
  const authority = /^https?:\/\/([^/?#\\\s]+)/i.exec(input)?.[1]
  try {
    const url = new URL(input)
    if (!authority || authority.includes("@") || url.username || url.password ||
        !["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new TypeError("Disallowed preview URL")
    }
    console.log(url.href)
  } catch {
    console.error("Expected an HTTP/HTTPS loopback URL without user information")
    process.exit(2)
  }
' -- "${1:-}")

export AGENT_BROWSER_SESSION="console-mobile-drawer-focus-$$"
export AGENT_BROWSER_ALLOWED_DOMAINS="127.0.0.1,localhost"
trap 'agent-browser close >/dev/null' EXIT

case "${2:-}" in
  --without-inert)
    export AGENT_BROWSER_INIT_SCRIPTS="$(cd "$(dirname "$0")" && pwd)/console-mobile-drawer-without-inert.js"
    closed_drawer='!("inert" in HTMLElement.prototype) && !drawer.hasAttribute("inert") && getComputedStyle(drawer).display === "none"'
    ;;
  '')
    closed_drawer='drawer.inert && getComputedStyle(drawer).display !== "none"'
    ;;
  *) echo "Usage: bash $0 <loopback preview URL> [--without-inert]" >&2; exit 2 ;;
esac

assert_browser() {
  local condition="$1"
  if [[ $(agent-browser eval "$condition") != true ]]; then
    echo "Expected browser condition: $condition" >&2
    exit 1
  fi
}

assert_drawer_closed() {
  assert_browser "(() => { const drawer = document.querySelector('aside.sidebar'); return drawer.getAttribute('aria-hidden') === 'true' && ($closed_drawer) })()"
}

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
agent-browser open "$preview_url"
agent-browser wait --fn 'innerWidth === 390 && document.querySelector("aside.sidebar")?.getBoundingClientRect().right === 0'
assert_drawer_closed

agent-browser press Tab
assert_focus '.console-topbar__menu'
agent-browser press Enter
agent-browser wait --fn 'document.querySelector("aside.sidebar").getBoundingClientRect().left === 0'
agent-browser press Tab
assert_focus '.sidebar-logo'
agent-browser press Tab
assert_focus '.sidebar-brand-title'
agent-browser press Tab
if [[ $(agent-browser eval 'Boolean(document.querySelector(".sidebar-brand button[title]"))') == true ]]; then
  assert_focus '.sidebar-brand button[title]'
  echo "Verified administrator version button in the tab sequence"
  agent-browser press Tab
fi
assert_focus '.sidebar-close'
agent-browser press Enter
assert_focus '.console-topbar__menu'
assert_drawer_closed
agent-browser press Tab
assert_focus '.console-topbar__brand'
