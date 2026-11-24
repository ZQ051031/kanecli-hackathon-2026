import { createCheckout, readMode } from "./checkout.mjs";

const products = [
  { id: "rucksack", name: "Trail Rucksack", detail: "20 L · olive canvas", price: 6800, alt: "Olive roll-top canvas backpack" },
  { id: "flask", name: "Daybreak Flask", detail: "500 ml · warm sand", price: 2800, alt: "Matte ivory travel flask" },
  { id: "beanie", name: "Ridge Beanie", detail: "One size · slate blue", price: 2400, alt: "Slate blue ribbed beanie" },
];

const byId = (id) => document.getElementById(id);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents) => usd.format(cents / 100);
const cart = new Map();
let mode = readMode(location.search);
let busy = false;
let checkout = createCheckout({ onEvent: logEvent });

const form = byId("checkout-form");
const error = byId("checkout-error");
const simulate = byId("simulate-failures");
const policy = byId("policy");
const events = byId("recovery-events");

byId("product-list").innerHTML = products.map((product) => `
  <article class="product">
    <img src="assets/${product.id}.webp" alt="${product.alt}" width="506" height="648">
    <div class="product-body">
      <h3>${product.name}</h3>
      <p>${product.detail}</p>
      <div class="product-action"><strong>${money(product.price)}</strong>
        <button class="add-button" type="button" data-add="${product.id}"
          aria-label="Add ${product.name} to cart">Add <span aria-hidden="true">+</span></button>
      </div>
    </div>
  </article>
`).join("");

function cartTotal() {
  return products.reduce((total, product) => total + product.price * (cart.get(product.id) ?? 0), 0);
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  byId("cart-count").textContent = count;
  byId("cart-items").innerHTML = products.filter((product) => cart.has(product.id)).map((product) => `
    <li class="cart-item">
      <img src="assets/${product.id}.webp" alt="" width="44" height="44">
      <div><strong>${product.name}</strong><small>${cart.get(product.id)} × ${money(product.price)}</small></div>
      <button type="button" class="remove-button" data-remove="${product.id}"
        aria-label="Remove one ${product.name}">−</button>
    </li>
  `).join("");
  byId("empty-cart").hidden = count > 0;
  byId("open-checkout").disabled = count === 0;
  byId("cart-total").textContent = money(cartTotal());
  byId("pay-total").textContent = money(cartTotal());
}

function show(stage) {
  byId("shopping-view").hidden = stage !== "cart";
  form.hidden = stage !== "checkout";
  byId("confirmation").hidden = stage !== "confirmation";
  const title = byId("checkout-title");
  title.textContent = { cart: "Your cart", checkout: "Checkout", confirmation: "Order confirmed" }[stage];
  title.focus();
}

function logEvent({ kind, message }) {
  const row = document.createElement("li");
  row.dataset.kind = kind;
  row.textContent = message;
  events.append(row);
  byId("empty-log").hidden = true;
}

function clearError() {
  error.hidden = true;
  error.textContent = "";
  byId("name").removeAttribute("aria-invalid");
  byId("email").removeAttribute("aria-invalid");
}

function renderMode() {
  simulate.checked = mode.broken;
  policy.value = mode.policy;
  byId("policy-row").hidden = !mode.broken;
  byId("lab-status").textContent = mode.broken ? "Faults on" : "Normal";
  byId("lab-status").classList.toggle("faults-on", mode.broken);
}

function changeMode() {
  mode = { broken: simulate.checked, policy: policy.value };
  const next = new URL(location.href);
  if (mode.broken) {
    next.searchParams.set("scenario", "broken");
    next.searchParams.set("repair", mode.policy);
  } else {
    next.searchParams.delete("scenario");
    next.searchParams.delete("repair");
  }
  history.replaceState(null, "", next);
  checkout = createCheckout({ onEvent: logEvent });
  events.replaceChildren();
  byId("empty-log").hidden = false;
  clearError();
  renderMode();
}

function setBusy(value) {
  busy = value;
  for (const control of [
    byId("pay"), byId("back-to-cart"), byId("name"), byId("email"), simulate, policy,
    ...document.querySelectorAll("[data-add]"),
  ]) control.disabled = value;
  byId("pay").classList.toggle("is-busy", value);
  if (value) byId("pay").setAttribute("aria-label", "Processing payment");
  else byId("pay").removeAttribute("aria-label");
  byId("payment-announcement").textContent = value ? "Processing payment." : "";
}

byId("product-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button || busy) return;
  const id = button.dataset.add;
  cart.set(id, (cart.get(id) ?? 0) + 1);
  if (!byId("confirmation").hidden) {
    checkout = createCheckout({ onEvent: logEvent });
    show("cart");
  }
  renderCart();
  byId("cart-announcement").textContent = `${products.find((p) => p.id === id).name} quantity ${cart.get(id)}.`;
});

byId("cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const id = button.dataset.remove;
  const quantity = cart.get(id) - 1;
  if (quantity) cart.set(id, quantity);
  else cart.delete(id);
  renderCart();
  const nextControl = byId("cart-items").querySelector(`[data-remove="${id}"]`) ??
    byId("cart-items").querySelector("button") ?? byId("checkout-title");
  nextControl.focus();
});

byId("open-checkout").addEventListener("click", () => {
  clearError();
  show("checkout");
});

byId("back-to-cart").addEventListener("click", () => show("cart"));
byId("new-order").addEventListener("click", () => {
  checkout = createCheckout({ onEvent: logEvent });
  show("cart");
});
simulate.addEventListener("change", changeMode);
policy.addEventListener("change", changeMode);
form.addEventListener("input", clearError);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !cart.size) return;
  clearError();
  const details = { name: byId("name").value, email: byId("email").value, total: cartTotal() };
  setBusy(true);
  let result;
  try {
    result = await checkout.submit(details, mode);
  } finally {
    setBusy(false);
  }
  if (result.status === "confirmed") {
    byId("order-id").textContent = result.id;
    byId("order-summary").textContent = `${money(result.total)} paid with the demo card.`;
    cart.clear();
    form.reset();
    renderCart();
    show("confirmation");
    return;
  }
  error.textContent = result.message;
  error.hidden = false;
  if (result.field) byId(result.field).setAttribute("aria-invalid", "true");
  byId(result.field ?? "pay").focus();
});

renderMode();
renderCart();
