/**
 * Node module-resolution hook for tests.
 *
 * Lets `node:test` import real Next.js route handlers, which use:
 *   - the `@/*` path alias from tsconfig.json
 *   - extensionless bare specifiers like `next/server`
 *
 * Register it through `tests/register-loader.mjs` (see the `npm test` script).
 */
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

const EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js"];
const INDEX_FILES = EXTENSIONS.map((ext) => `index${ext}`);

function resolveFile(base) {
  const candidates = [base, ...EXTENSIONS.map((ext) => `${base}${ext}`)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  for (const index of INDEX_FILES) {
    const candidate = resolvePath(base, index);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveFile(resolvePath(PROJECT_ROOT, specifier.slice(2)));
    if (target) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }

  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  return nextResolve(specifier, context);
}
