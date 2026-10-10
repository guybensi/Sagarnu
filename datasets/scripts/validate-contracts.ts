/**
 * Validates manually labeled contract ground-truth files.
 *
 *   pnpm dataset:validate                                   # every examples/*.json
 *   pnpm dataset:validate datasets/contracts/examples/contract_001.json
 *
 * Exit code 1 when any file has errors (warnings alone do not fail).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContractGroundTruth, type Issue } from "./contract-ground-truth";

const datasetDir = resolve(dirname(fileURLToPath(import.meta.url)), "../contracts");
const examplesDir = join(datasetDir, "examples");
// pnpm runs scripts inside the package; INIT_CWD is where the user typed the command.
const cwd = process.env.INIT_CWD ?? process.cwd();

const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => resolve(cwd, f))
  : existsSync(examplesDir)
    ? readdirSync(examplesDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(examplesDir, f))
    : [];

if (files.length === 0) {
  console.log(`No labeled files found in ${relative(cwd, examplesDir) || examplesDir}.`);
  console.log("Add contract_001.pdf + contract_001.json there (see datasets/contracts/README.md).");
  process.exit(0);
}

const color = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = color(31);
const yellow = color(33);
const green = color(32);

let failed = 0;
for (const file of files) {
  const name = relative(cwd, file) || file;
  const issues: Issue[] = [];

  if (!existsSync(file)) {
    issues.push({ level: "error", path: "", message: "file not found" });
  } else {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      issues.push({ level: "error", path: "", message: `invalid JSON: ${(e as Error).message}` });
    }
    if (json !== undefined) issues.push(...validateContractGroundTruth(json).issues);

    const isTemplate = basename(file) === "contract_template.json";
    const pdf = join(dirname(file), `${basename(file, extname(file))}.pdf`);
    if (!isTemplate && !existsSync(pdf)) {
      issues.push({ level: "warning", path: "", message: `no matching PDF (${basename(pdf)}) next to it` });
    }
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  if (errors.length) failed++;
  const status = errors.length ? red("✗") : warnings.length ? yellow("!") : green("✓");
  console.log(`${status} ${name}${errors.length || warnings.length ? "" : "  OK"}`);
  for (const i of [...errors, ...warnings]) {
    const tag = i.level === "error" ? red("  error  ") : yellow("  warning");
    console.log(`${tag} ${i.path || "(file)"}: ${i.message}`);
  }
}

console.log(`\n${files.length} file(s), ${failed} with errors.`);
process.exit(failed ? 1 : 0);
