import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { startServer } from "../scripts/serve.mjs";

let browser;
let server;
let base;
before(async () => {
  server = await startServer(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function visit(t, query = "", options = {}) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(5000);
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  const response = await page.goto(`${base}/${query}`);
  assert.equal(response.status(), 200);
  return page;
}

async function fillCheckout(page, email = "alex@example.com") {
  await page.getByRole("button", { name: "Add Trail Rucksack to cart" }).click();
  await page.getByRole("button", { name: "Go to checkout" }).click();
  await page.getByLabel("Full name").fill("Alex Morgan");
  await page.getByLabel("Email address").fill(email);
}

const pay = (page) => page.getByRole("button", { name: "Pay $68.00", exact: true });
const confirmed = (page) => page.getByRole("heading", { name: "Order confirmed", exact: true });
const log = (page) => page.getByRole("log", { name: "Recovery log" });

test("Chrome happy path browses products, maintains the cart, and confirms payment", async (t) => {
  const page = await visit(t);
  assert.equal(await page.locator(".product").count(), 3);
  assert.equal(await page.locator(".product img").evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)), true);
  assert.equal(await page.getByRole("button", { name: "Go to checkout" }).isDisabled(), true);
  await page.getByRole("button", { name: "Add Daybreak Flask to cart" }).click();
  await page.getByRole("button", { name: "Add Ridge Beanie to cart" }).click();
  assert.equal(await page.locator("#cart-total").textContent(), "$52.00");
  for (const name of ["Daybreak Flask", "Ridge Beanie"]) {
    await page.getByRole("button", { name: `Remove one ${name}` }).click();
  }
  await fillCheckout(page);
  await pay(page).click();
  await confirmed(page).waitFor();
  assert.equal(await page.locator("#order-summary").textContent(), "$68.00 paid with the demo card.");
  assert.match(await page.locator("#order-id").textContent(), /^FW-[A-F0-9]{8}$/);
  assert.equal(await page.locator("#cart-count").textContent(), "0");
  assert.equal(await log(page).getByRole("listitem").count(), 0);
});

test("Chrome reproduces the plus-address validation bug with recovery off", async (t) => {
  const page = await visit(t, "?scenario=broken&repair=off");
  await fillCheckout(page, "alex+trail@example.com");
  await pay(page).click();
  await page.getByRole("alert").filter({ hasText: "Demo validator rejected this email." }).waitFor();
  assert.equal(await page.getByLabel("Email address").inputValue(), "alex+trail@example.com");
  assert.equal(await page.getByLabel("Email address").getAttribute("aria-invalid"), "true");
  assert.equal(await confirmed(page).count(), 0);
});

test("Chrome reproduces the first-payment stall with recovery off", async (t) => {
  const page = await visit(t, "?scenario=broken&repair=off");
  await fillCheckout(page);
  await pay(page).click();
  await page.getByRole("alert").filter({ hasText: "Payment simulator stalled. Try paying again." }).waitFor();
  assert.equal(await confirmed(page).count(), 0);
  await pay(page).click();
  await confirmed(page).waitFor();
});

test("Chrome recovers both faults after a single Pay click at a phone viewport", async (t) => {
  const page = await visit(t, "", { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const simulate = page.getByRole("switch", { name: "Simulate failures" });
  await simulate.check();
  assert.equal(new URL(page.url()).searchParams.get("scenario"), "broken");
  assert.equal(await page.getByLabel("Recovery policy").inputValue(), "both");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), true);
  await fillCheckout(page, "alex+trail@example.com");
  await pay(page).click();
  await confirmed(page).waitFor();
  assert.deepEqual(await log(page).getByRole("listitem").allTextContents(), [
    "Demo validator rejected this email.",
    "Email validation repaired. Plus-address accepted.",
    "Payment simulator stalled.",
    "Retrying the simulated payment once.",
    "Payment recovered on retry.",
  ]);
  assert.equal(await page.locator("#cart-count").textContent(), "0");
  assert.equal(await page.locator(".order-id:visible").count(), 1);
});

test("Chrome accepts only the repair selected after a fault", async (t) => {
  const page = await visit(t, "?scenario=broken&repair=off");
  await fillCheckout(page, "alex+trail@example.com");
  await pay(page).click();
  await page.getByRole("alert").filter({ hasText: "Demo validator rejected this email." }).waitFor();
  await page.getByLabel("Recovery policy").selectOption("email");
  await pay(page).click();
  await page.getByRole("alert").filter({ hasText: "Payment simulator stalled." }).waitFor();
  assert.equal(await log(page).getByText("Email validation repaired. Plus-address accepted.").count(), 1);
  assert.equal(await confirmed(page).count(), 0);
  await page.getByLabel("Recovery policy").selectOption("both");
  await pay(page).click();
  await confirmed(page).waitFor();
});
