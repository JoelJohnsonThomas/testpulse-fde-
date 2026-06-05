import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseFile, parseReport, firstMeaningfulLine, ParseError } from '../src/parse';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => resolve(here, 'fixtures', name);

test.describe('parse — normalizing real report formats', () => {
  test('normalizes a TestRelic analytics-timeline.json into a flat test list with correct statuses', () => {
    const run = parseFile(fixture('testrelic-run.json'));

    // All tests from every timeline entry are flattened into one list.
    expect(run.tests).toHaveLength(4);
    const byName = Object.fromEntries(run.tests.map((t) => [t.name, t]));

    expect(byName['checkout.spec.ts > checkout > shows correct total'].status).toBe('passed');
    expect(byName['checkout.spec.ts > checkout > applies discount code'].status).toBe('failed');
    expect(byName['search.spec.ts > search > shows results'].status).toBe('flaky');

    // CI + project metadata is carried through for the dashboard link / history.
    expect(run.branch).toBe('main');
    expect(run.commitSha).toBe('abc1234');
    expect(run.project).toBe('acme-web');
  });

  test('extracts a failure into message + file:line + snippet, stripping ANSI and stack noise', () => {
    const run = parseFile(fixture('testrelic-run.json'));
    const failing = run.tests.find((t) => t.status === 'failed')!;

    expect(failing.failure).not.toBeNull();
    // First meaningful line only — no raw multi-line stack, no ANSI escapes.
    expect(failing.failure!.message).toBe('expect(received).toHaveText(expected)');
    expect(failing.failure!.message).not.toContain('[31m');
    expect(failing.failure!.message).not.toContain('Object.<anonymous>');
    // Location combines the spec file with the failing line number.
    expect(failing.failure!.location).toBe('tests/checkout.spec.ts:63');
    expect(failing.failure!.snippet).toContain('apply-code');
  });

  test('normalizes a CTRF report and treats flaky:true as flaky even when status is passed', () => {
    const run = parseFile(fixture('ctrf-run.json'));

    expect(run.project).toBe('acme-api');
    expect(run.tests).toHaveLength(3);
    const flaky = run.tests.find((t) => t.name === 'api > GET /products lists items')!;
    // CTRF marks a retried-but-passed test with flaky:true — we surface it as flaky noise.
    expect(flaky.status).toBe('flaky');

    const failed = run.tests.find((t) => t.name === 'api > POST /login rejects bad password')!;
    expect(failed.status).toBe('failed');
    expect(failed.failure!.message).toContain('expect(received).toBe(expected)');
  });

  test('deduplicates retries of the same test, keeping the most severe outcome', () => {
    // A flaky run often reports the same title twice (attempt 1 failed, attempt 2 passed).
    const report = {
      timeline: [
        {
          specFile: 'tests/x.spec.ts',
          tests: [
            { title: 'x > sometimes', status: 'failed', duration: 10, failure: { message: 'boom', line: 1, code: null } },
            { title: 'x > sometimes', status: 'passed', duration: 12, failure: null },
          ],
        },
      ],
      summary: { total: 2, passed: 1, failed: 1, flaky: 0, skipped: 0 },
    };
    const run = parseReport(report);
    expect(run.tests).toHaveLength(1);
    // failed (severity 3) wins over passed (severity 1).
    expect(run.tests[0].status).toBe('failed');
  });

  test('rejects an unrecognized format with a clear, actionable error', () => {
    expect(() => parseReport({ hello: 'world' })).toThrow(ParseError);
    expect(() => parseReport({ hello: 'world' })).toThrow(/Unrecognized report format/);
  });

  test('firstMeaningfulLine skips blank lines and strips ANSI (with and without the ESC byte)', () => {
    const ESC = String.fromCharCode(27);
    // Real Playwright errors prefix color codes with the ESC byte.
    expect(firstMeaningfulLine(`\n\n${ESC}[32mPASS${ESC}[39m line one\nsecond`)).toBe('PASS line one');
    // Some serializers drop the ESC byte but leave the bracket codes.
    expect(firstMeaningfulLine('\n[1mBold[22m text')).toBe('Bold text');
  });
});
