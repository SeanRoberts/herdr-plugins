#!/bin/sh
# Action entrypoint: opens the usage dashboard as a right-hand split ("sidebar").
exec "${HERDR_BIN_PATH:-herdr}" plugin pane open \
  --plugin sean.claude-usage \
  --entrypoint sidebar \
  --placement split \
  --direction right \
  --no-focus
