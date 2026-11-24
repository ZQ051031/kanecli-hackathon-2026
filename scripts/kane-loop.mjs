import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRun, verifyAndHeal } from "../kane/loop.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = new URL(process.env.CHECKOUT_URL ?? "http://127.0.0.1:4173/");
const startedAt = new Date().toISOString();
const dir = join(root, "kane-results", startedAt.replaceAll(":", "-"));
const results = { startedAt, baseUrl: base.href, status: "running", runs: [], repairs: [] };
await mkdir(dir, { recursive: true });

async function save() {
  await writeFile(join(dir, "results.json"), JSON.stringify(results, null, 2) + "\n");
}

async function run(id, policy) {
  const url = new URL(base);
  if (id === "happy") {
    url.searchParams.delete("scenario");
    url.searchParams.delete("repair");
  } else {
    url.searchParams.set("scenario", "broken");
    url.searchParams.set("repair", policy);
  }

  const flow = await readFile(join(root, "kane", "flows", `${id}.txt`), "utf8");
  const objective = `Go to ${url.href}\n${flow.trim()}`;
  const { status: exitCode, stdout = "", stderr = "", error } = spawnSync("kane-cli", [
    "run", objective, "--url", url.href, "--target", "desktop", "--agent", "--headless",
    "--bug-detection", "off", "--assertion-failure-mode", "stop",
    "--skip-code-validation", "--timeout", "150",
    "--name", `checkout-${policy}-${id}`,
  ], { cwd: root, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

  const label = `${policy}-${id}`;
  const ndjson = `${label}.ndjson`;
  const diagnostics = `${label}.stderr.log`;
  await writeFile(join(dir, ndjson), stdout);
  await writeFile(join(dir, diagnostics), stderr);
  const outcome = error
    ? { status: "error", exitCode, reason: error.code === "ENOENT" ? "Install @testmuai/kane-cli globally." : error.message }
    : classifyRun({ exitCode, stdout, stderr });
  results.runs.push({ id, policy, url: url.href, ...outcome, ndjson, diagnostics });
  await save();
  console.log(`${label}: ${outcome.status}${outcome.reason ? ` (${outcome.reason})` : ""}`);
  return outcome;
}

try {
  const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
  if (!response.ok || !(await response.text()).includes("<title>Fieldwork Supply · Checkout Healer</title>")) {
    throw new Error("CHECKOUT_URL did not return the Checkout Healer storefront.");
  }

  const outcome = await verifyAndHeal(run, async (selection) => {
    results.repairs.push(selection);
    await save();
    console.log(`Kane confirmed ${selection.fault}; using policy "${selection.to}" for the next suite.`);
  });
  results.status = outcome.status;
  if (outcome.reason) results.reason = outcome.reason;
} catch (error) {
  results.status = "error";
  results.reason = `Check that the storefront is running (npm start). ${error.message}`;
}

results.finishedAt = new Date().toISOString();
await save();
console.log(`Kane loop: ${results.status}${results.reason ? ` · ${results.reason}` : ""}`);
console.log(`Results: ${join(dir, "results.json")}`);
process.exitCode = { passed: 0, failed: 1, blocked: 2, error: 3 }[results.status] ?? 3;
