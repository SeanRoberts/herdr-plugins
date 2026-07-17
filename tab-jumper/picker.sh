#!/bin/sh
# Fuzzy tab jumper: lists every "workspace / tab" pair across all workspaces
# in fzf, then focuses the selected workspace and tab.
set -eu
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERDR="${HERDR_BIN_PATH:-herdr}"
export HERDR

lines=$("$HERDR" workspace list | python3 -c '
import json, os, subprocess, sys

herdr = os.environ["HERDR"]
workspaces = json.load(sys.stdin)["result"]["workspaces"]
for w in workspaces:
    out = subprocess.run(
        [herdr, "tab", "list", "--workspace", str(w["number"])],
        capture_output=True, text=True, check=True,
    )
    for t in json.loads(out.stdout)["result"]["tabs"]:
        marker = "*" if w["focused"] and t["focused"] else " "
        label = w["label"] + " / " + t["label"]
        print(marker + " " + label + "\t" + w["workspace_id"] + "\t" + t["tab_id"])
')

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
