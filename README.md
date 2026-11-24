# Checkout Healer

Checkout Healer is a static demo store built with Devin for the TestMu AI KaneCLI Online Hackathon. Browse Fieldwork Supply, add gear to the cart, enter demo contact details and make a simulated payment. The Recovery lab can make checkout reject a valid plus-address and stall the first payment attempt. With both repairs enabled, one Pay click accepts the original address, retries the payment and returns a single order confirmation.

## Run locally

Use Node.js 22 or newer. The storefront is HTML, CSS and JavaScript in [public/](public/) and the local server only serves those files. Google Chrome is needed for the browser tests and Kane.

```sh
npm ci
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Add the **Trail Rucksack** for $68.00, choose **Go to checkout**, enter **Alex Morgan** and a demo email address, and click **Pay $68.00**. Checkout uses the built-in demo card.

| Mode | Open | Email | Expected first Pay click |
| --- | --- | --- | --- |
| Normal | [Storefront](http://127.0.0.1:4173/) | `alex@example.com` | Order confirmed |
| Validation fault | [Faults on, recovery off](http://127.0.0.1:4173/?scenario=broken&repair=off) | `alex+trail@example.com` | The demo validator rejects the address |
| Payment fault | [Faults on, recovery off](http://127.0.0.1:4173/?scenario=broken&repair=off) | `alex@example.com` | The first payment stalls |
| Recovery | [Faults on, both repairs enabled](http://127.0.0.1:4173/?scenario=broken) | `alex+trail@example.com` | Order confirmed and both repairs appear in the Recovery log |

The Recovery lab has the same controls as the query parameters. Start a fresh page for each scenario. With recovery off, the simulated gateway accepts a second manual Pay click after a stall. A malformed address remains invalid with recovery enabled.

## Run the Kane loop

**Status as of November 24, 2026.** Kane CLI 0.10.8 was installed and the first objective was attempted. Kane exited with `Not authenticated` before it produced a browser verdict. The suite stopped with status `blocked`, and Kane verified zero flows. The separate Chrome regression suite reproduced both faults and verified that one click recovers them. [Blocked attempt record](kane-results/README.md)

1. Register with TestMu AI and claim the 10,000 free credits using the same email as your hackathon entry. Complete this step on your account for scoring. [Official hackathon rules](https://www.kaneclihack.sh/#start)
2. On your machine, install Google Chrome and Kane CLI. Run `kane-cli login --oauth` and approve it in your browser. Confirm the active profile with `kane-cli whoami`. Kane also supports username and account access key authentication for non-interactive setups. [Kane authentication docs](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/authentication.md)
3. Leave `npm start` running and use a second terminal at the repository root.

```sh
npm install -g @testmuai/kane-cli@0.10.8
kane-cli login --oauth
kane-cli whoami
npm run kane
```

Set `KANE_CLI_CHROME_PATH` to the Chrome binary if it lives outside Kane's standard paths. If you changed the local server port, set `CHECKOUT_URL` to the new storefront URL when running the loop. Kane drives desktop Chrome on your machine, so the default loopback URL works with the local server. [Kane installation docs](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/installation.md)

### How Kane’s result drives the next run

The [plain-English objectives](kane/flows/) run through `kane-cli run --agent`. The [loop](scripts/kane-loop.mjs) reads the process exit code and the NDJSON `run_end` event. It starts with recovery off and runs the normal checkout control, the plus-address check and the one-click payment check. Separate objectives isolate the two faults so the email rejection cannot mask the payment stall.

| Recovery policy | Normal checkout | Plus-address check | First-payment check |
| --- | --- | --- | --- |
| Off | Pass | Fail | Fail |
| Email only | Pass | Pass | Fail |
| Both repairs | Pass | Pass | Pass |

These are the expected browser verdicts. The runner acts on a failed check only after a diagnostic objective passes by confirming the specific inline error. It then applies the matching built-in repair through the next browser URL, records the decision and reruns the same three checks. After both repairs, a combined objective requires the original plus-address, one Pay click, one order and both recovery log entries. The loop applies repair policies to the demo scenario and can be rerun with `npm run kane` after editing the checkout.

Each invocation saves the URL, status, exit code, verdict summary, and repair decisions to `kane-results/<timestamp>/results.json`, alongside Kane's stdout and stderr. Named runs can also produce Kane evidence under `.testmuai/`. Exit codes are `0` for passed, `1` for a failed verification, `2` for authentication blocked, and `3` for an execution or setup error.

## Tests and demo

```sh
npm test
npm run test:browser
```

The first command covers checkout behavior and the loop’s reaction to simulated Kane verdicts. The browser suite launches local Chrome and starts its own static server. Set `CHROME_PATH` to a Chrome executable if it lives outside Playwright’s standard paths.

The [four-minute demo script](docs/DEMO_SCRIPT.md) includes the fault reproduction, recovery, and authenticated Kane run to capture for the submission.
