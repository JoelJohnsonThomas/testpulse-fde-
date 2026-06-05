# TestPulse — the last mile for test reports nobody reads

> **FDE Intern Assignment · 2026.** Built for the customer who said: *"Nobody reads our test reports. When something breaks, we find out from Slack, not from our tests."*

**TestPulse turns a finished test run into one plain-English signal a developer can act on** — and pushes it to where they already look (terminal, PR comment, Slack). It reads the [TestRelic](https://testrelic.ai) analytics report (or any CTRF report), and across run history it separates **real bugs from flaky noise** — the exact question the customer couldn't answer.

TestRelic already gets your results into a dashboard. The gap is the *last mile*: nobody opens the dashboard. TestPulse is that last mile.

```
🔴 1 new failure that looks like a real bug · 🟠 1 still broken · 🟡 1 flaky (noise) · ✅ 1 passed

FIX FIRST — new failures that look like real bugs:
  • [Likely a REAL bug (new failure)] e2e.spec.ts > checkout > applies discount code
      The test expected one value but the app produced a different one. ... It passed every
      one of the last 3 runs and just started failing — something changed.
      where: tests/e2e.spec.ts:63
      do: Open the diff since the last green run and check the code touching this test.
```

---

## Try it in 30 seconds (no account, no key)

```bash
npm install
npm run demo
```

That runs TestPulse against four bundled sample runs and prints the signal above. **Two commands, zero setup.**

To point it at a real report:

```bash
node bin/testpulse.mjs path/to/analytics-timeline.json
# or, if installed: npx testpulse path/to/analytics-timeline.json
```

---

## What it does (Part 2)

The customer's real problem isn't "ugly reports" — it's that **test results are invisible to the people who can act on them, and signal is buried in noise.** TestPulse addresses exactly that:

| Customer pain | TestPulse response |
|---|---|
| "Nobody reads the XML reports." | One-line headline + a short, scannable summary you can pipe to **Slack / a PR comment** — the report comes to you. |
| "Which tests catch real bugs vs. flaky noise?" | Cross-run history (`​.testpulse/history.jsonl`) classifies each test: **new real bug · still broken · flaky noise · slowing down**. |
| "Tell us in plain English what happened." | Every failure is translated from stack traces into one human sentence + the exact `file:line` + a concrete next step. |
| "Must work in 15 minutes, no QA engineer." | Zero runtime dependencies, runs on a plain JSON report, works offline without an API key. |

**Form:** a Node/TypeScript CLI. **Input:** TestRelic `analytics-timeline.json` *or* a [CTRF](https://ctrf.io) report. **Output:** `text` (default), `md`, or `json`; optional `--slack`; optional `--fail-on new-bug` to gate CI on real regressions only.

```bash
node bin/testpulse.mjs <report.json> [--format text|md|json] [--out file]
                       [--slack] [--fail-on none|new-bug|any-bug] [--window 10]
```

See [`docs/problem.md`](docs/problem.md) for the full problem decomposition (Part 1).

---

## How it integrates with TestRelic (Part 3)

This repo **dogfoods itself**: TestPulse is tested with Playwright, those results upload to TestRelic, and TestPulse then summarizes its own run.

1. **The reporter** is wired in [`playwright.config.ts`](playwright.config.ts) using `@testrelic/playwright-analytics`. It writes `test-results/analytics-timeline.json` locally and uploads to the TestRelic cloud dashboard **when `TESTRELIC_API_KEY` is set**.
2. **The test suite** ([`tests/`](tests/)) has **31 meaningful tests + 1 intentional failure** (required by the brief) covering parsing, flakiness classification, plain-English translation, summary rendering, and the CLI end-to-end.
3. **The MCP server** (`npx @testrelic/mcp`) is used to query the run in natural language — see [`docs/mcp.md`](docs/mcp.md).

### Run the full loop with the cloud dashboard

```bash
cp .env.example .env        # then paste your TESTRELIC_API_KEY (from platform.testrelic.ai → Settings → API Keys)
npm test                    # runs the Playwright suite → uploads to TestRelic
node bin/testpulse.mjs test-results/analytics-timeline.json   # plain-English signal for the real run
```

> **Requirements:** Node **18 or 20 LTS** for the TestRelic reporter step (`.nvmrc` pins 20; run `nvm use`). The reporter was observed to hang on **Node 24** on Windows. The CI workflow runs on Node 20 and uploads to the dashboard on every push — that's the most reliable path to real dashboard evidence. `npm run demo` and `testpulse <report.json>` work on any Node ≥18.

> **Note on the intentional failure:** `tests/intentional-failure.spec.ts` is *designed* to fail (it asserts a planned, not-yet-built "route to code owner" feature). That's the point — it demonstrates the full customer experience from a red test to an AI-readable failure. Expect **31 passed, 1 failed.**

### Dashboard & AI evidence

- TestRelic dashboard (real ingested run): see [`docs/dashboard.md`](docs/dashboard.md)
- MCP natural-language query + AI insight: see [`docs/mcp.md`](docs/mcp.md)

---

## Scale thinking (Part 4)

How this goes from one team to 10,000 — deployment playbook, top integration failure patterns, feedback-loop instrumentation, and one concrete product insight (`testrelic doctor`): [`docs/scale.md`](docs/scale.md).

---

## Project layout

```
testpulse-fde/
├── src/                       # The tool (zero runtime deps)
│   ├── cli.ts                 # CLI entry: arg parsing, commands, exit codes
│   ├── parse.ts               # TestRelic timeline + CTRF → one normalized model
│   ├── history.ts             # append-only run history (.testpulse/history.jsonl)
│   ├── analyze.ts             # real-bug vs flaky vs persistent vs slow (the core)
│   ├── plain-english.ts       # stack trace → one human sentence + next step
│   ├── summarize.ts           # text / markdown / json renderers
│   ├── slack.ts               # push the signal to a Slack webhook
│   └── demo/demo-data.ts      # four sample runs for `npm run demo`
├── tests/                     # Playwright suite (Part 3): 31 tests + 1 intentional fail
├── docs/
│   ├── problem.md             # Part 1 — problem decomposition
│   ├── scale.md               # Part 4 — the 10,000-customer brief
│   ├── dashboard.md           # TestRelic dashboard link + screenshot
│   └── mcp.md                 # MCP natural-language query + AI insight
├── playwright.config.ts       # TestRelic reporter wired here
├── .testrelic/                # TestRelic cloud config (committed; key stays in env)
└── .github/workflows/ci.yml   # CI: test → upload → TestPulse summary → Slack (Part 3 bonus)
```

## Design choices worth calling out

- **Zero runtime dependencies.** The tool is plain Node + TypeScript so a clean clone installs and runs fast — directly serving the "works in 15 minutes" constraint.
- **Behavioral, browserless tests.** TestPulse is a CLI, so its Playwright suite exercises the real logic and runs the built CLI as a subprocess — no `npx playwright install` of a 300MB browser, keeping setup minimal. The TestRelic reporter still records and uploads every test.
- **`reportMode: 'embedded'`.** The reporter's default `streaming` mode starts a local report server that does not exit; `embedded` writes a single self-contained JSON + HTML and exits cleanly — important for unattended CI.
- **Cloud upload is gated on `TESTRELIC_API_KEY`.** With no key, TestPulse and the local report still work; we never block local value on a cloud credential.

## Attribution

- [`@testrelic/playwright-analytics`](https://www.npmjs.com/package/@testrelic/playwright-analytics) — TestRelic's Playwright reporter & cloud SDK (the reporter wiring and JSON schema are theirs).
- [`@playwright/test`](https://playwright.dev) — test runner.
- [CTRF](https://ctrf.io) — the framework-agnostic test-results schema TestPulse also reads.
- AI coding tools were used to build this (as encouraged); every line is reviewed and owned.
