"use strict";
// Aggregates Claude Code token usage from the per-session JSONL logs under
// ~/.claude/projects/*/*.jsonl. Pure I/O + math; the renderer lives in sidebar.js.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

// USD per 1M tokens. Keyed by normalized model id. cacheWrite is the 5m-cache
// write rate (~1.25x input); cacheRead is the cache-hit rate (~0.1x input).
// Unknown models fall back to the opus tier so cost is never silently zero.
const PRICING = {
  "claude-opus-4-8": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-sonnet-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-fable-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};
const FALLBACK_TIER = PRICING["claude-opus-4-8"];

// Collapse aliases ("opus" -> "claude-opus-4-8") onto their priced id.
function normalizeModel(model) {
  if (!model) return null;
  if (model === "<synthetic>") return null;
  if (PRICING[model]) return model;
  if (model.startsWith("opus") || model.includes("opus")) return "claude-opus-4-8";
  if (model.startsWith("sonnet") || model.includes("sonnet")) return "claude-sonnet-5";
  if (model.startsWith("fable") || model.includes("fable")) return "claude-fable-5";
  return model; // keep unknown ids visible; priced via fallback tier
}

function priceFor(model) {
  return PRICING[model] || FALLBACK_TIER;
}

function emptyBucket() {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, messages: 0 };
}

function costOf(u, model) {
  const p = priceFor(model);
  return (
    (u.input / 1e6) * p.input +
    (u.output / 1e6) * p.output +
    (u.cacheWrite / 1e6) * p.cacheWrite +
    (u.cacheRead / 1e6) * p.cacheRead
  );
}

function addUsage(bucket, u, model) {
  bucket.input += u.input;
  bucket.output += u.output;
  bucket.cacheWrite += u.cacheWrite;
  bucket.cacheRead += u.cacheRead;
  bucket.cost += costOf(u, model);
  bucket.messages += 1;
}

// Day key in the machine's local timezone (YYYY-MM-DD).
function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Reads one JSONL file line-by-line, feeding usage records to `onRecord`.
// Streams rather than reading whole files — logs can be tens of MB.
function scanFile(file, onRecord) {
  return new Promise((resolve) => {
    let stream;
    try {
      stream = fs.createReadStream(file, { encoding: "utf8" });
    } catch {
      resolve();
      return;
    }
    stream.on("error", () => resolve());
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line || line.indexOf('"usage"') === -1) return;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        return;
      }
      const msg = o.message;
      const u = msg && msg.usage;
      if (!u) return;
      const model = normalizeModel(msg.model);
      if (!model) return;
      onRecord({
        id: msg.id,
        requestId: o.requestId,
        model,
        timestamp: o.timestamp,
        usage: {
          input: u.input_tokens || 0,
          output: u.output_tokens || 0,
          cacheWrite: u.cache_creation_input_tokens || 0,
          cacheRead: u.cache_read_input_tokens || 0,
        },
      });
    });
    rl.on("close", resolve);
  });
}

function listLogFiles() {
  let projects;
  try {
    projects = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of projects) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, entry.name);
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) {
      if (n.endsWith(".jsonl")) files.push(path.join(dir, n));
    }
  }
  return files;
}

// Aggregates every log into today / this-week / all-time buckets plus a
// per-model breakdown. `now` is injectable for deterministic tests.
async function aggregate(now = new Date()) {
  const todayKey = localDayKey(now);
  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const weekAgoKey = localDayKey(weekAgo);

  const totals = { today: emptyBucket(), week: emptyBucket(), all: emptyBucket() };
  const byModel = new Map();
  const seen = new Set(); // dedup resumed-session replays

  const files = listLogFiles();
  const onRecord = (rec) => {
    const dedupKey = `${rec.id || ""}:${rec.requestId || ""}`;
    if (rec.id && rec.requestId) {
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
    }
    addUsage(totals.all, rec.usage, rec.model);

    let modelBucket = byModel.get(rec.model);
    if (!modelBucket) {
      modelBucket = emptyBucket();
      byModel.set(rec.model, modelBucket);
    }
    addUsage(modelBucket, rec.usage, rec.model);

    const day = rec.timestamp ? localDayKey(new Date(rec.timestamp)) : null;
    if (day) {
      if (day === todayKey) addUsage(totals.today, rec.usage, rec.model);
      if (day >= weekAgoKey) addUsage(totals.week, rec.usage, rec.model);
    }
  };

  for (const file of files) {
    await scanFile(file, onRecord);
  }

  const models = [...byModel.entries()]
    .map(([model, b]) => ({ model, ...b }))
    .sort((a, b) => b.cost - a.cost);

  return { generatedAt: now, fileCount: files.length, totals, models };
}

module.exports = {
  aggregate,
  normalizeModel,
  costOf,
  localDayKey,
  PRICING,
  PROJECTS_DIR,
};
