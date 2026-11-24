import assert from "node:assert/strict";
import test from "node:test";
import { classifyRun, verifyAndHeal } from "../kane/loop.mjs";

const event = (status) => JSON.stringify({ type: "run_end", status, summary: "Test summary" });
const result = (status) => ({ status });
const simulatedResult = (id, policy) => {
  if (id === "email") return result(policy === "off" ? "failed" : "passed");
  if (id === "payment") return result(policy === "both" ? "passed" : "failed");
  return result("passed");
};

test("count a Kane pass or failure only with the matching exit code and terminal event", () => {
  assert.equal(classifyRun({ exitCode: 0, stdout: `Startup text\n${event("passed")}`, stderr: "" }).status, "passed");
  assert.equal(classifyRun({ exitCode: 1, stdout: event("failed"), stderr: "" }).status, "failed");
  assert.equal(classifyRun({ exitCode: 0, stdout: '{"step":1,"status":"passed"}', stderr: "" }).status, "error");
  assert.equal(classifyRun({ exitCode: 1, stdout: event("passed"), stderr: "" }).status, "error");
});

test("an unauthenticated invocation has no browser verdict", () => {
  assert.deepEqual(classifyRun({
    exitCode: 1, stdout: '{"type":"stream_start"}', stderr: "Not authenticated. Run: kane-cli login --oauth",
  }), {
    status: "blocked", reason: "TestMu AI authentication required", exitCode: 1, terminalStatus: null, summary: null,
  });
});

test("confirmed failures choose one repair at a time and rerun the same suite", async () => {
  const history = [];
  const final = await verifyAndHeal(async (id, policy) => {
    history.push(`${policy}:${id}`);
    return simulatedResult(id, policy);
  }, ({ from, to, basedOn }) => history.push(`${from}>${to}:${basedOn.failedCheck}+${basedOn.passedDiagnostic}`));

  assert.equal(final.status, "passed");
  assert.deepEqual(history, [
    "off:happy", "off:email", "off:payment", "off:probe-email", "off>email:email+probe-email",
    "email:happy", "email:email", "email:payment", "email:probe-payment", "email>both:payment+probe-payment",
    "both:happy", "both:email", "both:payment", "both:combined",
  ]);
});

test("authentication or infrastructure failure never activates a repair", async () => {
  for (const status of ["blocked", "error"]) {
    let attempts = 0;
    const final = await verifyAndHeal(async () => {
      attempts++;
      return result(status);
    }, () => assert.fail("An unactionable verdict activated a repair."));
    assert.equal(final.status, status);
    assert.equal(attempts, 1);
  }
});

test("a failed browser check alone never activates a repair", async () => {
  const final = await verifyAndHeal(async (id, policy) => {
    if (id === "probe-email") return result("failed");
    return simulatedResult(id, policy);
  }, () => assert.fail("A repair was activated without a successful diagnostic."));
  assert.equal(final.status, "failed");
  assert.match(final.reason, /did not confirm/);
});

test("a missing baseline regression cannot be reported as healed", async () => {
  const final = await verifyAndHeal(async () => result("passed"), () => assert.fail("No fault was observed."));
  assert.equal(final.status, "failed");
  assert.match(final.reason, /did not reproduce/);
});

test("a failed combined check prevents the loop from passing", async () => {
  const final = await verifyAndHeal(async (id, policy) =>
    id === "combined" ? result("failed") : simulatedResult(id, policy), () => {});
  assert.equal(final.status, "failed");
});
