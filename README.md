# herdr-plugins

Plugins for herdr.

## tab-jumper

Fuzzy-jump to any tab in any workspace using fzf. Opens a popup pane listing every `workspace / tab` pair across all workspaces; selecting one focuses that workspace and tab.

Requires `fzf` and `jq` on your PATH.

## claude-usage

A live sidebar (right-hand split pane) showing Claude Code token usage and estimated cost — today, last 7 days, and all time, broken down by model. Reads `~/.claude/projects/*/*.jsonl` and refreshes every 15s.

Requires `node` on your PATH.
