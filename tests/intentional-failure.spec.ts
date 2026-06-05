import { test, expect } from '@playwright/test';
import { analyze } from '../src/analyze';
import { toMarkdown } from '../src/summarize';
import type { NormalizedRun } from '../src/types';

/**
 * ── INTENTIONAL FAILURE (assignment Part 3) ─────────────────────────────────
 *
 * Required by the brief: "Write one test intentionally to fail ... and include
 * the TestRelic AI analysis of that failure in your submission."
 *
 * This is NOT a broken assertion for its own sake — it documents a real, planned
 * feature that TestPulse does not ship yet: automatically routing a new failure
 * to a code owner ("Owner: @team") inside the summary. The test asserts the
 * feature exists; it fails with a clean expected-vs-actual diff that the TestRelic
 * AI can read and explain in plain English ("the summary is expected to name an
 * owner, but no owner line is emitted").
 *
 * To make this test pass later, implement owner routing in summarize.ts and
 * delete this banner. Until then it is the live demo of the failure → insight loop.
 */

const run: NormalizedRun = {
  runId: 'intentional',
  startedAt: '2026-06-06T00:00:00.000Z',
  project: 'acme-web',
  commitSha: 'cur',
  branch: 'main',
  totalDurationMs: 100,
  tests: [
    {
      name: 'checkout.spec.ts > applies discount code',
      status: 'failed',
      durationMs: 100,
      retries: 0,
      failure: { message: 'expect(received).toBe(expected)', location: 'tests/checkout.spec.ts:63', snippet: null },
    },
  ],
};

test('summary routes a new failure to a code owner @planned-feature', () => {
  const analysis = analyze(run, [], {});
  const md = toMarkdown(analysis);

  // PLANNED, NOT YET IMPLEMENTED — this assertion is expected to fail today.
  expect(md, 'TestPulse should name a code owner for each new bug so the right person sees it').toContain('Owner:');
});
