"use strict";
// Pane entrypoint: renders the Claude Code usage dashboard to the TTY and
// refreshes on a timer. A herdr pane is just a terminal process, so this owns
// the whole screen and redraws in place.

const usage = require("./usage");

const REFRESH_MS = 15_000;

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

function width() {
  return Math.max(24, process.stdout.columns || 32);
}

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function fmtCost(n) {
  return "$" + n.toFixed(n >= 100 ? 0 : 2);
}

function modelLabel(model) {
  return model
    .replace(/^claude-/, "")
    .replace(/-\d+$/, "")
    .replace(/-/g, " ");
}

function row(label, value, w) {
  const gap = Math.max(1, w - label.length - value.length);
  return label + C.dim + ".".repeat(gap) + C.reset + value;
}

function section(title, w) {
  return C.bold + C.cyan + title + C.reset;
}

function bucketBlock(title, b, w, color) {
  const lines = [];
  lines.push(section(title, w));
  lines.push(row("  cost", (color || "") + fmtCost(b.cost) + C.reset, w));
  lines.push(row("  input", fmtTokens(b.input), w));
  lines.push(row("  output", fmtTokens(b.output), w));
  lines.push(row("  cache write", fmtTokens(b.cacheWrite), w));
  lines.push(row("  cache read", fmtTokens(b.cacheRead), w));
  lines.push(row("  messages", String(b.messages), w));
  return lines;
}

function render(data) {
  const w = width();
  const out = [];
  const rule = C.dim + "─".repeat(w) + C.reset;

  out.push(C.bold + C.magenta + "  CLAUDE USAGE" + C.reset);
  out.push(rule);
  out.push(...bucketBlock("Today", data.totals.today, w, C.green));
  out.push("");
  out.push(...bucketBlock("Last 7 days", data.totals.week, w, C.yellow));
  out.push("");
  out.push(...bucketBlock("All time", data.totals.all, w));
  out.push("");
  out.push(section("By model (all time)", w));
  if (data.models.length === 0) {
    out.push(C.dim + "  no usage found" + C.reset);
  } else {
    for (const m of data.models.slice(0, 6)) {
      out.push(row("  " + modelLabel(m.model), fmtCost(m.cost), w));
      out.push(
        C.dim + row("    in/out", fmtTokens(m.input) + "/" + fmtTokens(m.output), w) + C.reset
      );
    }
  }
  out.push("");
  out.push(rule);
  const stamp = data.generatedAt.toLocaleTimeString();
  out.push(C.dim + `  ${data.fileCount} sessions · updated ${stamp}` + C.reset);
  out.push(C.dim + "  refreshes every 15s · Ctrl-C to close" + C.reset);
  return out.join("\r\n");
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
}

async function draw() {
  let data;
  try {
    data = await usage.aggregate(new Date());
  } catch (err) {
    clearScreen();
    process.stdout.write(C.yellow + "Claude Usage: failed to read logs\r\n" + C.reset);
    process.stdout.write(C.dim + String(err && err.message) + C.reset + "\r\n");
    return;
  }
  clearScreen();
  process.stdout.write(render(data) + "\r\n");
}

async function main() {
  process.stdout.write("\x1b[?25l"); // hide cursor
  const cleanup = () => {
    process.stdout.write("\x1b[?25h"); // restore cursor
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.stdout.on("resize", () => {
    draw().catch(() => {});
  });

  await draw();
  setInterval(() => {
    draw().catch(() => {});
  }, REFRESH_MS);
}

main();
