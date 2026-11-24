import assert from "node:assert/strict";
import test from "node:test";
import { createCheckout, faults, readMode } from "../public/checkout.mjs";

const details = { name: "Alex Morgan", email: "alex+trail@example.com", total: 6800 };
const mode = (policy) => ({ broken: true, policy });
const fixture = () => {
  const events = [];
  const checkout = createCheckout({
    delay: async () => {},
    orderId: () => "FW-12345678",
    onEvent: (event) => events.push(event),
  });
  return { events, submit: checkout.submit };
};

test("normal mode is the default and broken mode defaults to both repairs", () => {
  assert.deepEqual(readMode(""), { broken: false, policy: "both" });
  assert.deepEqual(readMode("?scenario=broken&repair=off"), mode("off"));
  assert.deepEqual(readMode("?scenario=broken&repair=unknown"), mode("both"));
});

test("normal checkout accepts a plus address and confirms with no recovery events", async () => {
  const { submit, events } = fixture();
  assert.deepEqual(await submit(details, readMode("")), { status: "confirmed", id: "FW-12345678", total: 6800 });
  assert.deepEqual(events, []);
});

test("invalid names and addresses still fail when repairs are on", async () => {
  const { submit, events } = fixture();
  assert.equal((await submit({ ...details, name: " " }, mode("both"))).field, "name");
  assert.equal((await submit({ ...details, email: "alex+" }, mode("both"))).message, "Enter a valid email address.");
  assert.deepEqual(events, []);
});

test("email fault rejects a valid plus address with policy off", async () => {
  const { submit, events } = fixture();
  assert.deepEqual(await submit(details, mode("off")), { status: "invalid", field: "email", message: faults.email });
  assert.deepEqual(events.map(({ kind }) => kind), ["detected"]);
});

test("email repair lets the submission reach the payment fault independently", async () => {
  const { submit, events } = fixture();
  assert.equal((await submit(details, mode("email"))).status, "failed");
  assert.deepEqual(events.map(({ kind }) => kind), ["detected", "healed", "detected"]);
});

test("first payment stalls with recovery off and a second manual submission can succeed", async () => {
  const { submit } = fixture();
  const basic = { ...details, email: "alex@example.com" };
  const first = await submit(basic, mode("off"));
  assert.equal(first.status, "failed");
  assert.ok(first.message.startsWith(faults.payment));
  assert.equal((await submit(basic, mode("off"))).status, "confirmed");
});

test("both repairs produce one confirmation, including across overlapping submissions", async () => {
  const { submit, events } = fixture();
  const first = submit(details, mode("both"));
  assert.deepEqual(await submit(details, mode("both")), { status: "pending" });
  const confirmed = await first;
  assert.equal(confirmed.status, "confirmed");
  assert.strictEqual(await submit(details, mode("both")), confirmed);
  assert.deepEqual(events.map(({ kind }) => kind), ["detected", "healed", "detected", "retry", "healed"]);
});
