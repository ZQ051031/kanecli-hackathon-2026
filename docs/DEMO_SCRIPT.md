# Checkout Healer demo script

**Target runtime** 4 minutes. Record the storefront and a terminal. Set up Chrome and your TestMu AI authentication off camera, using the account registered for the hackathon. [Setup instructions](../README.md#run-the-kane-loop)

Open a terminal beside the browser and start the demo store with `npm start`. Use a second terminal for `npm run kane`. A full suite can take longer than the video, so record the run in advance or cut between stages. Use the results from your own run when narrating the Kane section.

## 0:00–0:25 · The store

Show the Fieldwork Supply storefront and point to the Recovery lab.

> This is Checkout Healer, a storefront I built with Devin for the KaneCLI Online Hackathon. I’ll buy an item normally, reproduce two checkout faults, and show how Kane’s browser verdicts drive a repair and then verify it again.

## 0:25–0:55 · Normal checkout

Add one Trail Rucksack, choose **Go to checkout**, then enter `Alex Morgan` and `alex@example.com`. Click **Pay $68.00** once. Show **Order confirmed**, the order reference and the empty recovery log.

> This is the normal path. The store uses a demo card and generates one simulated order.

## 0:55–1:45 · Reproduce both faults

Open [faults on, recovery off](http://127.0.0.1:4173/?scenario=broken&repair=off) in a fresh tab. Repeat checkout with `alex+trail@example.com` and click Pay once. Hold on the inline validation alert and the unchanged address. Change the email to `alex@example.com` and click Pay. Hold on the payment-stall alert.

> The demo validator rejects a valid plus-address. Using a simple address lets us reach the second fault. The first payment attempt stalls, and checkout stays open.

## 1:45–2:30 · Heal with one click

Switch the Recovery policy to **Auto-heal both faults**, enter `alex+trail@example.com` again, and click Pay once. Show the confirmation and the ordered entries in the Recovery log.

> On this attempt, checkout accepts the original plus-address and retries payment once. The log shows both faults and both recoveries. One Pay click produced one order.

## 2:30–3:45 · Show Kane and the feedback loop

Show the [email](../kane/flows/email.txt) and [payment](../kane/flows/payment.txt) objectives, then the `npm run kane` output. Open that run’s `results.json`. Show the normal control, the broken-flow browser failures with recovery off, and the diagnostic confirmations. Highlight each recorded policy change and the subsequent reruns. Open the final combined browser verdict or its Kane evidence pack.

> Kane checks the normal checkout and then isolates each bug with a separate browser objective. A failed test needs a second Kane objective to confirm the exact inline error before the runner applies the matching repair. The runner repeats the checks after each repair and ends by testing both recoveries in a single checkout.

If your run stops at authentication, show the actual `blocked` record and say that Kane has no browser verdict. Complete the authenticated run before presenting Kane verification for judging.

## 3:45–4:00 · Close

Show the repository and point viewers to the setup, Kane objectives and result locations.

> You can run the static store locally, reproduce either fault from the Recovery lab, and rerun the Kane loop from the repository. The final combined check asks Kane to prove that one Pay click reaches confirmation after both recoveries.

For judging, upload the 3–5 minute recording to YouTube, publish two distinct public posts on eligible platforms, and include the links in the hackathon submission by **November 26, 2026 at 11:59 p.m. IST**. [Official submission rules](https://www.kaneclihack.sh/#rules)
