#!/bin/sh
# Fuzzy tab jumper: lists every "workspace / tab" pair across all workspaces
# in fzf, then focuses the selected workspace and tab.
set -eu
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERDR="${HERDR_BIN_PATH:-herdr}"

tab=$(printf '\t')

lines=$("$HERDR" workspace list |
  jq -r '.result.workspaces[] | [.number, .focused, .workspace_id, .label] | @tsv' |
  while IFS="$tab" read -r num focused ws_id ws_label; do
    "$HERDR" tab list --workspace "$num" |
      jq -r --arg focused "$focused" --arg ws_id "$ws_id" --arg ws_label "$ws_label" '
        .result.tabs[] |
        [ (if $focused == "true" and .focused then "*" else " " end)
            + " " + $ws_label + " / " + .label,
          $ws_id,
          .tab_id
        ] | @tsv'
  done)

sel=$(printf '%s\n' "$lines" | fzf \
  --delimiter='\t' \
  --with-nth=1 \
  --reverse \
  --prompt='jump> ' \
  --no-multi) || exit 0

ws_id=$(printf '%s' "$sel" | cut -f2)
tab_id=$(printf '%s' "$sel" | cut -f3)

"$HERDR" workspace focus "$ws_id"
"$HERDR" tab focus "$tab_id"
