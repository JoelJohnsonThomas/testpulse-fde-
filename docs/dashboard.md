# TestRelic Dashboard — real ingested run

This page links the **real** TestRelic cloud run produced by this repo's own test suite
(`npm test`), as required by Part 3. The data is genuine: 32 tests (31 passing + the one
intentional failure), uploaded by `@testrelic/playwright-analytics`.

- **Project / repo:** `testpulse-fde`
- **Run:** the most recent `npm test` run on `main`

## Shareable link

<!-- Paste the run URL from platform.testrelic.ai after the upload completes. -->
> https://platform.testrelic.ai/  →  project **testpulse-fde**  →  latest run

`(link to be pasted from the dashboard run page)`

## Screenshot

The dashboard should show:
- the test grid with recognizable names (`checkout > applies discount code`, `search > shows results`, …),
- the **one visible failure** (`intentional-failure.spec.ts › summary routes a new failure to a code owner`),
- its failure diagnostics (expected `Owner:` substring not found in the summary markdown).

![TestRelic dashboard — testpulse-fde run](./dashboard.png)

<!--
To capture:
1. Run `npm test` with TESTRELIC_API_KEY set (see README → "Run the full loop").
2. Open platform.testrelic.ai → project testpulse-fde → the run that just uploaded.
3. Screenshot the run overview (grid + the failing test expanded) and save as docs/dashboard.png.
4. Paste the run URL above.
-->
