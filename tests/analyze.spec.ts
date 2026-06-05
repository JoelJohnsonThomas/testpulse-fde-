import { test, expect } from '@playwright/test';
import { analyze } from '../src/analyze';
import type { HistoryRecord, NormalizedRun, NormalizedTest, TestStatus } from '../src/types';

/**
 * These tests pin down the heart of TestPulse: telling a real bug apart from
 * flaky noise. That judgement is impossible from a single run, so each test
 * feeds in a run history and asserts the classification.
 */

function priorRun(id: string, statuses: Record<string, TestStatus>, durations: Record<string, number> = {}): HistoryRecord {
  return { runId: id, startedAt: `2026-06-0${id}T09:00:00.000Z`, commitSha: id, branch: 'main', statuses, durations };
}

function t(name: string, status: TestStatus, durationMs = 100, failureMsg?: string): NormalizedTest {
  return {
    name,
    status,
    durationMs,
    retries: 0,
    failure: status === 'failed' || failureMsg ? { message: failureMsg ?? 'failed', location: `tests/x.spec.ts:1`, snippet: null } : null,
  };
}

function currentRun(tests: NormalizedTest[]): NormalizedRun {
  return {
    runId: 'current',
    startedAt: '2026-06-06T09:00:00.000Z',
    project: 'acme',
    commitSha: 'cur',
    branch: 'main',
    totalDurationMs: tests.reduce((a, x) => a + x.durationMs, 0),
    tests,
  };
}

// Five prior runs (oldest -> newest), each carrying every test's outcome.
const history: HistoryRecord[] = [
  priorRun('1', { NEWBUG: 'passed', FLAKY: 'passed', PERSIST: 'passed', SLOW: 'passed' }, { SLOW: 500 }),
  priorRun('2', { NEWBUG: 'passed', FLAKY: 'failed', PERSIST: 'passed', SLOW: 'passed' }, { SLOW: 520 }),
  priorRun('3', { NEWBUG: 'passed', FLAKY: 'passed', PERSIST: 'passed', SLOW: 'passed' }, { SLOW: 510 }),
  priorRun('4', { NEWBUG: 'passed', FLAKY: 'failed', PERSIST: 'failed', SLOW: 'passed' }, { SLOW: 505 }),
  priorRun('5', { NEWBUG: 'passed', FLAKY: 'passed', PERSIST: 'failed', SLOW: 'passed' }, { SLOW: 515 }),
];

test.describe('analyze — signal vs. noise', () => {
  const run = currentRun([
    t('NEWBUG', 'failed', 100, 'expect(received).toBe(expected)'),
    t('FLAKY', 'failed', 30000, 'Timeout 30000ms exceeded waiting for locator(".x")'),
    t('PERSIST', 'failed', 100),
    t('SLOW', 'passed', 2000),
    t('CLEAN', 'passed', 100),
  ]);
  const a = analyze(run, history, { window: 10 });

  test('a test that passed every prior run and just failed is flagged as a NEW real bug', () => {
    expect(a.newBugs.map((c) => c.test.name)).toContain('NEWBUG');
    const c = a.newBugs.find((x) => x.test.name === 'NEWBUG')!;
    expect(c.verdict).toBe('real-bug-new');
    expect(c.runsConsidered).toBe(5);
    expect(c.passRate).toBe(1);
  });

  test('a test that flaps between pass and fail is classified as flaky noise, not a real bug', () => {
    const names = a.flakyTests.map((c) => c.test.name);
    expect(names).toContain('FLAKY');
    expect(a.newBugs.map((c) => c.test.name)).not.toContain('FLAKY');
    const c = a.flakyTests.find((x) => x.test.name === 'FLAKY')!;
    // It passed 3 of the 5 prior runs -> 60% pass rate.
    expect(c.passRate).toBeCloseTo(0.6, 5);
    expect(c.plainEnglish.toLowerCase()).toContain('noise');
  });

  test('a test failing on a sustained recent streak is "still broken" (persistent), not new', () => {
    expect(a.persistentBugs.map((c) => c.test.name)).toContain('PERSIST');
    expect(a.newBugs.map((c) => c.test.name)).not.toContain('PERSIST');
  });

  test('a passing test much slower than its own history is flagged as a slow regression', () => {
    expect(a.slowRegressions.map((c) => c.test.name)).toContain('SLOW');
    expect(a.slowRegressions[0].plainEnglish.toLowerCase()).toContain('slower');
  });

  test('a never-before-seen failing test is treated as a real bug until proven otherwise', () => {
    const run2 = currentRun([t('BRAND_NEW', 'failed', 100, 'boom')]);
    const a2 = analyze(run2, [], { window: 10 });
    expect(a2.newBugs.map((c) => c.test.name)).toContain('BRAND_NEW');
    expect(a2.newBugs[0].runsConsidered).toBe(0);
  });

  test('counts and totals are tallied correctly', () => {
    expect(a.total).toBe(5);
    expect(a.failed).toBe(3); // NEWBUG, FLAKY(status failed), PERSIST
    expect(a.passed).toBe(2); // SLOW, CLEAN
    expect(a.runsInHistory).toBe(5);
  });

  test('an SDK-reported flaky status is always treated as flaky regardless of history', () => {
    const run3 = currentRun([t('RETRIED', 'flaky', 100)]);
    const a3 = analyze(run3, [], {});
    expect(a3.flakyTests.map((c) => c.test.name)).toContain('RETRIED');
  });
});
