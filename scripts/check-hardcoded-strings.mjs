import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "build", ".vercel", "messages"]);
const CYRILLIC = /[\u0400-\u04FF]/;
const SCOPES = [
  { dir: "app", extensions: new Set([".tsx"]), skip: (rel) => rel.split(sep).includes("api") },
  { dir: "components", extensions: new Set([".ts", ".tsx"]), skip: () => false },
];

function listFiles(dir, extensions, shouldSkip, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) listFiles(full, extensions, shouldSkip, acc);
    } else if (extensions.has(extname(entry))) {
      const rel = relative(ROOT, full);
      if (!shouldSkip(rel)) acc.push(full);
    }
  }
  return acc;
}

function findCyrillic(source) {
  const findings = [];
  let state = "code";
  let line = 1;
  let lineStart = 0;
  let i = 0;
  let lastReportedLine = 0;
  const n = source.length;

  const report = () => {
    if (lastReportedLine === line) return;
    lastReportedLine = line;
    findings.push({ line, column: i - lineStart + 1 });
  };

  while (i < n) {
    const c = source[i];
    if (c === "\n") {
      line += 1;
      lineStart = i + 1;
    }

    if (state === "code") {
      if (c === "/" && source[i + 1] === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && source[i + 1] === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === '"') {
        state = "double";
        i += 1;
        continue;
      }
      if (c === "'") {
        state = "single";
        i += 1;
        continue;
      }
      if (c === "`") {
        state = "template";
        i += 1;
        continue;
      }
      if (CYRILLIC.test(c)) report();
      i += 1;
      continue;
    }

    if (state === "line") {
      if (c === "\n") state = "code";
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && source[i + 1] === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    const quote = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (c === "\\") {
      if (source[i + 1] === "\n") {
        line += 1;
        lineStart = i + 2;
      }
      i += 2;
      continue;
    }
    if (c === quote) {
      state = "code";
      i += 1;
      continue;
    }
    if (CYRILLIC.test(c)) report();
    i += 1;
  }

  return findings;
}

const files = SCOPES.flatMap(({ dir, extensions, skip }) =>
  listFiles(join(ROOT, dir), extensions, skip),
);

const results = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const findings = findCyrillic(source);
  if (findings.length > 0) {
    const lines = source.split("\n");
    results.push({ file: relative(ROOT, file), findings, lines });
  }
}

for (const { file, findings, lines } of results) {
  for (const { line, column } of findings) {
    const snippet = (lines[line - 1] ?? "").trim();
    console.log(`[hardcoded] ${file}:${line}:${column}  ${snippet}`);
  }
}

console.log(
  results.length === 0
    ? `OK: кириллических строковых литералов в UI-коде нет (проверено файлов: ${files.length})`
    : `Найдено файлов с кириллическими строковыми литералами: ${results.length}`,
);

process.exitCode = results.length > 0 ? 1 : 0;
