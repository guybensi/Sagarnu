// Removes the previous production build of apps/web before the E2E build.
// OneDrive turns folders in the repo into read-only placeholders, and `next build` then fails to
// delete them (EPERM). Clearing the read-only flag first lets Node remove them. `dev` (a running
// `pnpm dev`) and `cache` are left alone.
import { chmodSync, existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../apps/web/.next", import.meta.url));
const KEEP = new Set(["dev", "cache"]);

function makeWritable(path) {
  try {
    chmodSync(path, 0o777);
  } catch {
    // Not fatal: rmSync below reports anything that really cannot be removed.
  }
  if (lstatSync(path).isDirectory()) for (const entry of readdirSync(path)) makeWritable(join(path, entry));
}

if (existsSync(dist)) {
  for (const entry of readdirSync(dist)) {
    if (KEEP.has(entry)) continue;
    const path = join(dist, entry);
    makeWritable(path);
    rmSync(path, { recursive: true, force: true });
  }
}
