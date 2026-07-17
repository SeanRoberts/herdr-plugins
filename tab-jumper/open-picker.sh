#!/bin/sh
# Action entrypoint: opens the fzf picker popup.
exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin sean.tab-jumper --entrypoint picker
