# Part 4 — The 10,000-Customer Question

TestPulse solves one team's problem. Here is how it compounds to the next 50, then 10,000.

## Deployment Playbook — onboarding the next 50 customers

**Principle: value must land on run #1, before any account exists.** Every step that requires a login is a place customers drop off, so we front-load value and back-load setup.

| # | Step | Time | Drop-off risk & mitigation |
|---|------|------|----------------------------|
| 1 | `npx testpulse demo` — see a plain-English signal from sample data | 1 min | *None.* Zero install, zero key. This is the "aha" before commitment. |
| 2 | Add the TestRelic reporter to `playwright.config.ts`, run tests once | 5 min | *Reporter not picked up.* Ship a `defineConfig` wrapper that wires it automatically; verify with a one-line "TestPulse read N tests" confirmation. |
| 3 | `testpulse ./test-results/analytics-timeline.json` on a **real** run | 2 min | *Empty/again-no-value.* Works offline; the summary is the value, the cloud is additive. |
| 4 | Sign up, paste `TESTRELIC_API_KEY`, re-run → results in dashboard | 4 min | *Silent no-upload (no key).* Loud warning + local summary still prints. Key lives in env, never in config. |
| 5 | Add `--slack` + webhook, or the GitHub Action | 3 min | *Alert fatigue.* Default channel post is **new bugs only**; flaky/persistent are opt-in. |
| 6 | **Activation:** first time a `new-bug` flag precedes a same-branch red→green fix | day 1–3 | *Never reaches activation.* If no run is viewed in 72h, send one digest email, then stop (no nagging). |

**The funnel we watch:** demo run → real run parsed → cloud upload succeeds → signal delivered (Slack/PR) → **first acted-upon flag**. The cliff is between "uploaded once" and "delivered where I look" — so Slack/PR-comment delivery is the highest-leverage onboarding step, not the dashboard.

## Top 3 Integration Failure Patterns

1. **`TESTRELIC_API_KEY` not set → results silently never upload.**
   - *Symptom:* `[testrelic] No API key configured` in CI logs (easy to miss); dashboard stays empty; team thinks the product is broken.
   - *Fix:* (1) Add `TESTRELIC_API_KEY` as a CI secret and pass it to the test job's `env:`. (2) Re-run; confirm the run appears under Settings → API Keys "last used." (3) Keep TestPulse's local summary as the always-on fallback so a missing key degrades gracefully instead of going dark.

2. **ESM/CJS resolution error on `npx playwright test`.**
   - *Symptom:* `Error [ERR_REQUIRE_ESM]: require() of ES Module .../fixture.js not supported.`
   - *Fix:* (1) Add `"type": "module"` to `package.json` **or** set `tsconfig` `module`/`moduleResolution` to `NodeNext`. (2) Alternatively import the explicit CJS subpath `@testrelic/playwright-analytics/fixture/cjs`. (3) Re-run a single spec to confirm before the full suite.

3. **Sharded CI uploads each shard as a separate, half-empty run.**
   - *Symptom:* Dashboard shows 4 runs of "3 tests" instead of 1 run of "12 tests"; flakiness history is fragmented and TestPulse can't compute pass rates.
   - *Fix:* (1) `npx testrelic merge shard-*.json -o merged.json`. (2) Run TestPulse against the merged report, not per-shard. (3) In CI, gate the merge+summarize step on `needs: [test-shards]` so it runs once after all shards finish.

## Feedback Loop Design

Instrument the *moments of value*, not vanity counts. Events (each carries `repo`, `runId`, `anonymizedTeamId`):

- `testpulse.summary_generated` — `{ source: demo|local|ci, hadKey, newBugs, flaky, persistent }`
- `testpulse.signal_delivered` — `{ channel: stdout|slack|pr_comment, ok }`
- `testpulse.report_viewed` — dashboard run opened (links delivery → attention)
- `testpulse.flag_resolved` — a `new-bug`-flagged test went green on the next same-branch run (the outcome that matters)

**Activation threshold:** a team is *activated* when, within 7 days, they hit ≥1 `signal_delivered` to a non-stdout channel **and** ≥1 `flag_resolved`. That pair means the signal reached them *and* changed behavior. "Stuck" = `summary_generated` with `hadKey=false` for 3+ runs (they're getting local value but never connected the cloud) → trigger the key-setup nudge. First-value = first `flag_resolved`.

## One Product Insight

**Problem:** The TestRelic SDK silently no-ops cloud upload when `TESTRELIC_API_KEY` is unset — the single biggest onboarding cliff (failure pattern #1 above), and the one most likely to make a developer-owned team conclude "it doesn't work" and churn. The failure is invisible exactly when the user most needs a signal.

**Proposed solution:** A **`testrelic doctor`** preflight (and a startup self-check in the reporter) that, in <2s, verifies: key present + valid, endpoint reachable, repo name set, config file location correct, and ESM/CJS resolution sane — printing a green/red checklist with the exact fix line for each red item. Run it automatically once per machine and surface a one-line "uploads ON/OFF + why" banner on every run.

**Evidence:** Building this assignment, the two things that cost real time were (a) discovering uploads were off only by noticing an empty dashboard, and (b) the documented `ERR_REQUIRE_ESM` footgun. Both are *detectable before a single test runs*. The SDK README already documents both as troubleshooting entries — which proves they're common enough to pre-empt. A doctor command converts your two highest-volume support emails ("dashboard is empty" / "require ESM error") into a self-serve green check, directly lifting the activation rate the playbook above optimizes for.
