/**
 * Demo data for `testpulse demo` — four synthetic TestRelic runs that tell a
 * story across time so the flaky-vs-real-bug logic is visible without needing a
 * live TestRelic account. Shaped exactly like a real analytics-timeline.json.
 *
 * The story across runs 1->4 for "checkout > applies discount code":
 *   pass, pass, pass, FAIL  => a brand-new regression (fix first).
 * For "search > shows results": pass, FAIL, pass, FAIL => flaps = flaky noise.
 * For "login > rejects bad password": FAIL, FAIL, FAIL, FAIL => still broken.
 */

function run(
  id: string,
  startedAt: string,
  tests: Array<{
    title: string;
    status: 'passed' | 'failed' | 'flaky';
    duration: number;
    retryCount?: number;
    message?: string;
    line?: number;
    code?: string;
  }>,
) {
  return {
    schemaVersion: '1.3.0',
    testRunId: id,
    startedAt,
    completedAt: startedAt,
    totalDuration: tests.reduce((a, t) => a + t.duration, 0),
    summary: {
      total: tests.length,
      passed: tests.filter((t) => t.status === 'passed').length,
      failed: tests.filter((t) => t.status === 'failed').length,
      flaky: tests.filter((t) => t.status === 'flaky').length,
      skipped: 0,
    },
    ci: { provider: 'github-actions', buildId: id, commitSha: id.slice(-7), branch: 'main' },
    metadata: { repo: 'acme-web' },
    timeline: [
      {
        url: 'app://tests',
        navigationType: 'dummy',
        visitedAt: startedAt,
        duration: 0,
        specFile: 'tests/e2e.spec.ts',
        domContentLoadedAt: null,
        networkIdleAt: null,
        networkStats: null,
        tests: tests.map((t) => ({
          title: t.title,
          status: t.status,
          duration: t.duration,
          startedAt,
          completedAt: startedAt,
          retryCount: t.retryCount ?? 0,
          tags: [],
          failure:
            t.status === 'failed' || t.message
              ? { message: t.message ?? 'Test failed', line: t.line ?? null, code: t.code ?? null, stack: null }
              : null,
        })),
      },
    ],
    shardRunIds: null,
  };
}

const P = (title: string, duration: number) => ({ title, status: 'passed' as const, duration });

export const DEMO_RUNS = [
  run('demo-0001', '2026-06-02T09:00:00.000Z', [
    P('e2e.spec.ts > checkout > applies discount code', 1200),
    P('e2e.spec.ts > search > shows results', 900),
    {
      title: 'e2e.spec.ts > login > rejects bad password',
      status: 'failed',
      duration: 700,
      line: 41,
      message: "expect(received).toBe(expected)\n\nExpected: 401\nReceived: 200",
      code: '  40 |   const res = await api.login("bad", "creds");\n> 41 |   expect(res.status()).toBe(401);',
    },
    P('e2e.spec.ts > homepage > loads hero banner', 600),
  ]),
  run('demo-0002', '2026-06-03T09:00:00.000Z', [
    P('e2e.spec.ts > checkout > applies discount code', 1250),
    {
      title: 'e2e.spec.ts > search > shows results',
      status: 'failed',
      duration: 30000,
      line: 18,
      message: 'locator.click: Timeout 30000ms exceeded waiting for locator("#results .item")',
      code: '  17 |   await page.fill("#q", "shoes");\n> 18 |   await page.click("#results .item");',
    },
    {
      title: 'e2e.spec.ts > login > rejects bad password',
      status: 'failed',
      duration: 690,
      line: 41,
      message: "expect(received).toBe(expected)\n\nExpected: 401\nReceived: 200",
      code: '  40 |   const res = await api.login("bad", "creds");\n> 41 |   expect(res.status()).toBe(401);',
    },
    P('e2e.spec.ts > homepage > loads hero banner', 1400),
  ]),
  run('demo-0003', '2026-06-04T09:00:00.000Z', [
    P('e2e.spec.ts > checkout > applies discount code', 1180),
    P('e2e.spec.ts > search > shows results', 950),
    {
      title: 'e2e.spec.ts > login > rejects bad password',
      status: 'failed',
      duration: 705,
      line: 41,
      message: "expect(received).toBe(expected)\n\nExpected: 401\nReceived: 200",
      code: '  40 |   const res = await api.login("bad", "creds");\n> 41 |   expect(res.status()).toBe(401);',
    },
    P('e2e.spec.ts > homepage > loads hero banner', 2600),
  ]),
  // Current run (run 4): checkout breaks for the first time, search flaps again,
  // login still broken, homepage has crept much slower.
  run('demo-0004', '2026-06-05T09:00:00.000Z', [
    {
      title: 'e2e.spec.ts > checkout > applies discount code',
      status: 'failed',
      duration: 1300,
      line: 63,
      message:
        'expect(received).toHaveText(expected)\n\nExpected string: "Total: $80.00"\nReceived string: "Total: $100.00"',
      code: '  62 |   await page.click("#apply-code");\n> 63 |   await expect(page.locator("#total")).toHaveText("Total: $80.00");',
    },
    {
      title: 'e2e.spec.ts > search > shows results',
      status: 'failed',
      duration: 30000,
      line: 18,
      message: 'locator.click: Timeout 30000ms exceeded waiting for locator("#results .item")',
      code: '  17 |   await page.fill("#q", "shoes");\n> 18 |   await page.click("#results .item");',
    },
    {
      title: 'e2e.spec.ts > login > rejects bad password',
      status: 'failed',
      duration: 710,
      line: 41,
      message: "expect(received).toBe(expected)\n\nExpected: 401\nReceived: 200",
      code: '  40 |   const res = await api.login("bad", "creds");\n> 41 |   expect(res.status()).toBe(401);',
    },
    P('e2e.spec.ts > homepage > loads hero banner', 5200),
  ]),
];
