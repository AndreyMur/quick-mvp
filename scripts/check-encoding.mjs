import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "build", ".vercel"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".json"]);
const CYRILLIC = /[\u0400-\u04FF]/;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const cp1251 = new TextDecoder("windows-1251");

function listFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) listFiles(full, acc);
    } else if (EXTENSIONS.has(extname(entry))) {
      acc.push(full);
    }
  }
  return acc;
}

function isUtf8(buffer) {
  try {
    utf8.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

const found = [];
for (const file of listFiles(ROOT)) {
  const buffer = readFileSync(file);
  if (isUtf8(buffer)) continue;
  const hasRussian = CYRILLIC.test(cp1251.decode(buffer));
  found.push({ file: relative(ROOT, file), hasRussian });
}

for (const { file, hasRussian } of found) {
  console.log(`${hasRussian ? "[cp1251] " : "[not utf-8] "}${file}`);
}

console.log(
  found.length === 0
    ? "OK: все .ts/.tsx/.json файлы с русским текстом в UTF-8 (найдено: 0)"
    : `Найдено файлов вне UTF-8: ${found.length}`,
);

process.exitCode = found.length > 0 ? 1 : 0;
