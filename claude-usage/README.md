# claude-usage

A live herdr pane showing Claude Code token usage and estimated cost.

Opens a right-hand split pane that reads the per-session logs under
`~/.claude/projects/*/*.jsonl` and shows tokens + estimated $ spend for
**today**, the **last 7 days**, and **all time**, plus an all-time breakdown by
model. It refreshes every 15s.

herdr has no literal "sidebar" placement, so this uses a right-side `split`
pane — the idiomatic equivalent for a terminal-process UI.

> A sidebar variant that showed plan rate-limit % (session/weekly, like `/usage`)
> as `[ui.sidebar.agents]` rows was dropped: herdr sidebar sections render once
> per agent pane, so account-global numbers duplicated across every session and
> there's no "render once" sidebar surface.

## Install

```sh
herdr plugin link /path/to/herdr-plugins/claude-usage
```

Open it via the **Show Claude usage** workspace action, or:

```sh
herdr plugin pane open --plugin sean.claude-usage --entrypoint sidebar \
  --placement split --direction right --no-focus
```

`Ctrl-C` inside the pane closes it.

## Notes

- Costs are **estimates** from public per-model rates in `usage.js` (`PRICING`);
  edit that table if rates change. Unknown model ids are priced at the opus tier
  so cost is never silently zero.
- Records are de-duplicated by message id + request id, so resumed sessions
  aren't double-counted.
- Requires `node` on PATH. No other dependencies.

## Develop

```sh
node --test   # unit tests for the aggregation logic
```

Aggregation lives in `usage.js` (pure I/O + math, tested); rendering lives in
`sidebar.js` (owns the TTY, redraws on a timer).
