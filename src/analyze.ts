import type {
  Analysis,
  ClassifiedTest,
  HistoryRecord,
  NormalizedRun,
  NormalizedTest,
  TestStatus,
  Verdict,
} from './types';
import { explainFailure, nextStepFor } from './plain-english';

export interface AnalyzeOptions {
  /** How many prior runs to consider when judging flakiness. */
  window?: number;
  /** A passing test slower than median * this factor is flagged. */
  slowFactor?: number;
  /** Floor (ms) below which slowness is ignored as noise. */
  slowFloorMs?: number;
}

const DEFAULTS = { window: 10, slowFactor: 1.5, slowFloorMs: 800 };

/**
 * The core of TestPulse: separate signal from noise.
 *
 * One run can only tell you red/green. Telling a developer "this is a real bug,
 * fix it now" vs. "this is flaky noise, ignore it" requires looking across runs.
 * That cross-run judgement is the thing the customer said they were missing.
 */
export function analyze(
  run: NormalizedRun,
  history: HistoryRecord[],
  opts: AnalyzeOptions = {},
): Analysis {
  const cfg = { ...DEFAULTS, ...opts };
  // Prior runs only (exclude the current run if it was already persisted),
  // most-recent-first, capped to the window.
  const prior = history
    .filter((h) => h.runId !== run.runId)
    .slice(-cfg.window)
    .reverse();

  const newBugs: ClassifiedTest[] = [];
  const persistentBugs: ClassifiedTest[] = [];
  const flakyTests: ClassifiedTest[] = [];
  const slowRegressions: ClassifiedTest[] = [];

  let passed = 0,
    failed = 0,
    flaky = 0,
    skipped = 0;

  for (const test of run.tests) {
    if (test.status === 'passed') passed++;
    else if (test.status === 'failed') failed++;
    else if (test.status === 'flaky') flaky++;
    else if (test.status === 'skipped') skipped++;

    const priorStatuses = prior
      .map((h) => h.statuses[test.name])
      .filter((s): s is TestStatus => !!s);

    const classified = classify(test, priorStatuses, prior, cfg);
    if (!classified) continue;
    switch (classified.verdict) {
      case 'real-bug-new':
        newBugs.push(classified);
        break;
      case 'real-bug-persistent':
        persistentBugs.push(classified);
        break;
      case 'flaky':
        flakyTests.push(classified);
        break;
      case 'slow-regression':
        slowRegressions.push(classified);
        break;
    }
  }

  const slowest = [...run.tests]
    .filter((t) => t.status !== 'skipped')
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3);

  return {
    run,
    passed,
    failed,
    flaky,
    skipped,
    total: run.tests.length,
    newBugs,
    persistentBugs,
    flakyTests,
    slowRegressions,
    slowest,
    runsInHistory: prior.length,
  };
}

function classify(
  test: NormalizedTest,
  priorStatuses: TestStatus[],
  prior: HistoryRecord[],
  cfg: typeof DEFAULTS,
): ClassifiedTest | null {
  const failsBefore = priorStatuses.filter((s) => s === 'failed').length;
  const flakyBefore = priorStatuses.filter((s) => s === 'flaky').length;
  const passesBefore = priorStatuses.filter((s) => s === 'passed').length;
  const n = priorStatuses.length;
  const passRate = n > 0 ? passesBefore / n : test.status === 'passed' ? 1 : 0;

  const base = (verdict: Verdict): ClassifiedTest => ({
    test,
    verdict,
    passRate,
    runsConsidered: n,
    plainEnglish: explainFailure(test, verdict, { passRate, runsConsidered: n }),
    nextStep: nextStepFor(verdict, test),
  });

  // SDK retried this test and it eventually passed: textbook flaky.
  if (test.status === 'flaky') return base('flaky');

  if (test.status === 'failed') {
    // A test that has BOTH passed and failed recently is flapping = flaky noise,
    // unless it's currently on a sustained failing streak (then it's real).
    const recentFailStreak = leadingFailStreak(priorStatuses);
    const flaps = passesBefore > 0 && failsBefore + flakyBefore > 0;

    if (n === 0) {
      // Never seen before and it's red: surface it as a likely real bug, but the
      // plain-English copy notes there's no history yet.
      return base('real-bug-new');
    }
    if (recentFailStreak >= 2) return base('real-bug-persistent');
    if (flaps) return base('flaky');
    if (failsBefore + flakyBefore === n) return base('real-bug-persistent');
    // Passed consistently before, red now: a fresh regression.
    return base('real-bug-new');
  }

  // Passing test — the only thing worth flagging is a real slowdown vs. its own history.
  if (test.status === 'passed') {
    const durations = prior
      .map((h) => h.durations?.[test.name])
      .filter((d): d is number => typeof d === 'number' && d > 0);
    if (durations.length >= 3) {
      const med = median(durations);
      if (test.durationMs > Math.max(cfg.slowFloorMs, med * cfg.slowFactor)) {
        const c = base('slow-regression');
        return c;
      }
    }
  }
  return null;
}

/** Count consecutive failing/flaky runs at the most-recent end of the window. */
function leadingFailStreak(recentFirst: TestStatus[]): number {
  let streak = 0;
  for (const s of recentFirst) {
    if (s === 'failed' || s === 'flaky') streak++;
    else break;
  }
  return streak;
}

function median(ns: number[]): number {
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
