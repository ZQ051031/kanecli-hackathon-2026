const BROKEN_FLOWS = ["email", "payment"];

export function classifyRun({ exitCode, stdout, stderr }) {
  let terminal;
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event?.type === "run_end") terminal = event;
    } catch {
      // Chrome and CLI startup messages may share stdout with the NDJSON stream.
    }
  }

  const details = { exitCode, terminalStatus: terminal?.status ?? null, summary: terminal?.summary ?? null };
  if (exitCode === 0 && terminal?.status === "passed") return { status: "passed", ...details };
  if (exitCode === 1 && terminal?.status === "failed") return { status: "failed", ...details };
  if (/not logged in|not authenticated|no (stored )?credentials|credentials (not found|are required)|authentication (required|failed)/i.test(stderr)) {
    return { status: "blocked", reason: "TestMu AI authentication required", ...details };
  }
  return { status: "error", reason: "Kane exited without a recognized browser verdict", ...details };
}

export async function verifyAndHeal(run, recordSelection) {
  const repairs = [];

  for (;;) {
    const policy = repairs.length === 2 ? "both" : repairs[0] ?? "off";
    const happy = await run("happy", policy);
    if (happy.status !== "passed") return happy;

    const unresolved = [];
    for (const flow of BROKEN_FLOWS) {
      const result = await run(flow, policy);
      if (result.status === "failed" && repairs.includes(flow)) return result;
      if (result.status === "failed") {
        unresolved.push(flow);
      } else if (result.status !== "passed") {
        return result;
      } else if (!repairs.includes(flow)) {
        return { status: "failed", reason: `The ${flow} fault did not reproduce with policy "${policy}".` };
      }
    }

    if (!unresolved.length) return run("combined", policy);

    const fault = unresolved[0];
    const diagnosis = await run(`probe-${fault}`, policy);
    if (diagnosis.status !== "passed") {
      return { ...diagnosis, reason: diagnosis.reason ?? `Kane did not confirm the simulated ${fault} fault.` };
    }

    repairs.push(fault);
    await recordSelection({
      from: policy,
      to: repairs.length === 2 ? "both" : fault,
      fault,
      basedOn: { failedCheck: fault, passedDiagnostic: `probe-${fault}` },
    });
  }
}
