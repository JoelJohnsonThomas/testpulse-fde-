/** Status as TestPulse normalizes it across input formats. */
export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

/** A single normalized test result, independent of input format. */
export interface NormalizedTest {
  /** Stable identity used to track a test across runs (spec + title). */
  name: string;
  status: TestStatus;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Number of retries Playwright performed (>0 with a final pass => flaky). */
  retries: number;
  failure: NormalizedFailure | null;
}

/** A failure stripped down to the human-actionable essentials. */
export interface NormalizedFailure {
  /** First, most meaningful line of the error message. */
  message: string;
  /** Source file:line where the failure occurred, if known. */
  location: string | null;
  /** Source code snippet around the failing line, if captured. */
  snippet: string | null;
}

/** One normalized test run. */
export interface NormalizedRun {
  runId: string;
  startedAt: string;
  /** Repo/project name as it appears in the TestRelic dashboard. */
  project: string | null;
  commitSha: string | null;
  branch: string | null;
  totalDurationMs: number;
  tests: NormalizedTest[];
}

/** One historical record persisted to .testpulse/history.jsonl (compact). */
export interface HistoryRecord {
  runId: string;
  startedAt: string;
  commitSha: string | null;
  branch: string | null;
  /** Map of test name -> status, kept small on purpose. */
  statuses: Record<string, TestStatus>;
  /** Map of test name -> duration in ms, used for slow-regression detection. */
  durations?: Record<string, number>;
}

/** How TestPulse classifies each notable test after looking at history. */
export type Verdict =
  | 'real-bug-new' // failing now, was passing before -> likely a real regression
  | 'real-bug-persistent' // failing now and in prior run(s) -> known breakage
  | 'flaky' // mixed pass/fail history, or SDK marked it flaky -> noise
  | 'slow-regression'; // passed, but markedly slower than its own history

export interface ClassifiedTest {
  test: NormalizedTest;
  verdict: Verdict;
  /** Pass rate over the history window, 0..1. */
  passRate: number;
  /** Number of historical runs considered (excluding the current one). */
  runsConsidered: number;
  /** Plain-English, non-technical explanation of what happened. */
  plainEnglish: string;
  /** Concrete next step a non-QA developer can take. */
  nextStep: string;
}

export interface Analysis {
  run: NormalizedRun;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  total: number;
  newBugs: ClassifiedTest[];
  persistentBugs: ClassifiedTest[];
  flakyTests: ClassifiedTest[];
  slowRegressions: ClassifiedTest[];
  /** Top tests by duration this run. */
  slowest: NormalizedTest[];
  runsInHistory: number;
}
