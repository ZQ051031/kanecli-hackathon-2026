export const faults = Object.freeze({
  email: "Demo validator rejected this email.",
  payment: "Payment simulator stalled.",
});

const policies = ["off", "email", "payment", "both"];
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readMode(search) {
  const params = new URLSearchParams(search);
  const requestedPolicy = params.get("repair") ?? "both";
  return {
    broken: params.get("scenario") === "broken",
    policy: policies.includes(requestedPolicy) ? requestedPolicy : "both",
  };
}

export function createCheckout({
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onEvent = () => {},
  orderId = () => `FW-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, "0").toUpperCase()}`,
} = {}) {
  let firstPayment = true;
  let pending = false;
  let confirmed = null;

  async function pay(broken) {
    await delay(450);
    if (broken && firstPayment) {
      firstPayment = false;
      return "stalled";
    }
    return "paid";
  }

  async function submit({ name, email, total }, { broken, policy }) {
    if (pending) return { status: "pending" };
    if (confirmed) return confirmed;
    if (!name.trim()) return { status: "invalid", field: "name", message: "Enter your full name." };
    const address = email.trim();
    if (!validEmail.test(address)) {
      return { status: "invalid", field: "email", message: "Enter a valid email address." };
    }

    const repairs = (fault) => policy === "both" || policy === fault;
    pending = true;
    try {
      if (broken && address.split("@")[0].includes("+")) {
        onEvent({ kind: "detected", message: faults.email });
        if (!repairs("email")) return { status: "invalid", field: "email", message: faults.email };

        await delay(450);
        onEvent({ kind: "healed", message: "Email validation repaired. Plus-address accepted." });
      }

      if (await pay(broken) === "stalled") {
        onEvent({ kind: "detected", message: faults.payment });
        if (!repairs("payment")) {
          return { status: "failed", message: `${faults.payment} Try paying again.` };
        }

        onEvent({ kind: "retry", message: "Retrying the simulated payment once." });
        await pay(broken);
        onEvent({ kind: "healed", message: "Payment recovered on retry." });
      }

      confirmed = { status: "confirmed", id: orderId(), total };
      return confirmed;
    } finally {
      pending = false;
    }
  }

  return { submit };
}
