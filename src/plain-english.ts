import type { NormalizedTest, Verdict } from './types';

/**
 * Translates Playwright/CTRF failure messages into language a developer with no
 * QA background can act on. The customer asked for exactly this: "can someone
 * just tell us in plain English what happened instead of making us dig through
 * 800 lines of stack trace?"
 */

interface FailurePattern {
  match: RegExp;
  /** Plain-English explanation of what this kind of failure means. */
  explain: string;
}

const PATTERNS: FailurePattern[] = [
  {
    match: /Timeout.*exceeded|waiting for (locator|selector|element)|locator\.\w+: Timeout/i,
    explain:
      'The test waited for something on the page (a button, text, or element) that never showed up in time. Usually a renamed/removed selector, a page that got slower, or a genuinely broken screen.',
  },
  {
    match: /net::ERR|ERR_CONNECTION|ECONNREFUSED|getaddrinfo|fetch failed|socket hang up/i,
    explain:
      'The page or API the test tried to reach did not respond (network or server error). Often the app under test was not running, or a service it depends on was down.',
  },
  {
    match: /expect\(.*\)\.(toBe|toEqual|toHaveText|toContain|toHaveValue)/i,
    explain:
      'The test expected one value but the app produced a different one. This is a behavior mismatch — the app is doing something other than what the test says it should.',
  },
  {
    match: /(\d{3})\b.*(received|status)|status.*\b(4\d\d|5\d\d)\b|expected status/i,
    explain:
      'An API call came back with the wrong HTTP status code (e.g. a 4xx/5xx where a 200 was expected). The endpoint is rejecting the request or erroring out.',
  },
  {
    match: /strict mode violation|resolved to \d+ elements/i,
    explain:
      'The test pointed at an element but the page now has several that match. The UI markup changed and the selector is no longer unique.',
  },
  {
    match: /is not a function|undefined is not|cannot read propert|ReferenceError|TypeError/i,
    explain:
      'The test code (or the app code it called) threw a JavaScript error before it could finish. This is a code-level bug, not a flaky environment issue.',
  },
];

/** A short, human verdict label used as the headline for a classified test. */
export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'real-bug-new':
      return 'Likely a REAL bug (new failure)';
    case 'real-bug-persistent':
      return 'Still broken (failing repeatedly)';
    case 'flaky':
      return 'Flaky noise (safe to ignore for now)';
    case 'slow-regression':
      return 'Getting slower';
  }
}

export function explainFailure(
  test: NormalizedTest,
  verdict: Verdict,
  ctx: { passRate: number; runsConsidered: number },
): string {
  if (verdict === 'slow-regression') {
    return `This test still passes, but it took ${fmtMs(test.durationMs)} — noticeably slower than its recent average. Worth a look before it starts timing out.`;
  }

  const reason = test.failure ? classifyMessage(test.failure.message) : null;
  const pct = Math.round(ctx.passRate * 100);

  if (verdict === 'flaky') {
    const history =
      ctx.runsConsidered > 0
        ? ` It passed ${pct}% of the last ${ctx.runsConsidered} runs, so this red is probably noise, not a real break.`
        : ' It passed on retry within the same run, which is the classic flaky signature.';
    return (reason ? reason + ' ' : '') + 'This test flips between pass and fail without the code changing.' + history;
  }

  if (verdict === 'real-bug-new') {
    const history =
      ctx.runsConsidered > 0
        ? ` It passed every one of the last ${ctx.runsConsidered} runs and just started failing — something changed.`
        : ' There is no prior history for this test yet, so treat the failure as real until proven otherwise.';
    return (reason ?? 'The test failed.') + history;
  }

  // persistent
  return (reason ?? 'The test failed.') + ' It has been failing across recent runs — this is a known, unresolved break.';
}

export function nextStepFor(verdict: Verdict, test: NormalizedTest): string {
  const loc = test.failure?.location ? ` (${test.failure.location})` : '';
  switch (verdict) {
    case 'real-bug-new':
      return `Open the diff since the last green run and check the code touching this test${loc}. This is the one to fix first.`;
    case 'real-bug-persistent':
      return `This has been red for a while — if it is expected, quarantine it; if not, it is blocking. Look at${loc || ' the failing assertion'}.`;
    case 'flaky':
      return 'Do not block your release on this. Add it to the flaky watch-list and stabilize it later (waits, test isolation, or a more specific selector).';
    case 'slow-regression':
      return 'Profile the slow step; a test creeping toward the timeout will eventually fail intermittently and look flaky.';
  }
}

function classifyMessage(message: string): string | null {
  if (!message) return null;
  for (const p of PATTERNS) {
    if (p.match.test(message)) return p.explain;
  }
  // Fall back to the raw first line so we never hide the truth — just trimmed.
  return `The test failed with: "${truncate(message, 140)}"`;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}
