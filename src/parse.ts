import { readFileSync } from 'node:fs';
import type {
  NormalizedFailure,
  NormalizedRun,
  NormalizedTest,
  TestStatus,
} from './types';

/**
 * TestPulse accepts two input shapes:
 *   1. The TestRelic analytics-timeline.json produced by @testrelic/playwright-analytics.
 *   2. A CTRF-compatible report (ctrf.io) — so the tool is framework-agnostic.
 *
 * Both are normalized to the same NormalizedRun so the rest of the pipeline
 * doesn't care where the data came from.
 */

export class ParseError extends Error {}

export function parseFile(path: string): NormalizedRun {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ParseError(`Could not read report file "${path}": ${(err as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new ParseError(`"${path}" is not valid JSON: ${(err as Error).message}`);
  }
  return parseReport(json);
}

export function parseReport(json: unknown): NormalizedRun {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if ('timeline' in obj && 'summary' in obj) return parseTestRelic(obj);
    if ('results' in obj && isCtrf(obj)) return parseCtrf(obj);
  }
  throw new ParseError(
    'Unrecognized report format. Expected a TestRelic analytics-timeline.json ' +
      '(with "timeline" + "summary") or a CTRF report (with "results.tests").',
  );
}

function isCtrf(obj: Record<string, unknown>): boolean {
  const results = obj.results as Record<string, unknown> | undefined;
  return !!results && typeof results === 'object' && Array.isArray((results as any).tests);
}

// --- TestRelic analytics-timeline.json -------------------------------------

function parseTestRelic(obj: Record<string, unknown>): NormalizedRun {
  const timeline = Array.isArray(obj.timeline) ? obj.timeline : [];
  const ci = (obj.ci ?? null) as Record<string, unknown> | null;
  const metadata = (obj.metadata ?? null) as Record<string, unknown> | null;

  const tests: NormalizedTest[] = [];
  for (const entry of timeline) {
    const e = entry as Record<string, unknown>;
    const specFile = typeof e.specFile === 'string' ? e.specFile : '';
    const entryTests = Array.isArray(e.tests) ? e.tests : [];
    for (const t of entryTests) {
      tests.push(normalizeTestRelicTest(t as Record<string, unknown>, specFile));
    }
  }

  return {
    runId: str(obj.testRunId) ?? cryptoRandomId(),
    startedAt: str(obj.startedAt) ?? new Date().toISOString(),
    project: str(metadata?.['repo']) ?? str(metadata?.['project']) ?? null,
    commitSha: ci ? str(ci.commitSha) : null,
    branch: ci ? str(ci.branch) : null,
    totalDurationMs: num(obj.totalDuration) ?? sum(tests.map((t) => t.durationMs)),
    tests: dedupeByName(tests),
  };
}

function normalizeTestRelicTest(t: Record<string, unknown>, specFile: string): NormalizedTest {
  const title = str(t.title) ?? 'unknown test';
  const status = normalizeStatus(str(t.status));
  const retries = num(t.retryCount) ?? 0;
  const failureObj = t.failure as Record<string, unknown> | null | undefined;
  const failure: NormalizedFailure | null = failureObj
    ? {
        message: firstMeaningfulLine(str(failureObj.message) ?? ''),
        location: buildLocation(specFile, num(failureObj.line)),
        snippet: str(failureObj.code),
      }
    : null;
  return { name: title, status, durationMs: num(t.duration) ?? 0, retries, failure };
}

// --- CTRF (ctrf.io) ---------------------------------------------------------

function parseCtrf(obj: Record<string, unknown>): NormalizedRun {
  const results = obj.results as Record<string, unknown>;
  const ctrfTests = Array.isArray(results.tests) ? results.tests : [];
  const summary = (results.summary ?? {}) as Record<string, unknown>;
  const environment = (results.environment ?? {}) as Record<string, unknown>;

  const tests: NormalizedTest[] = ctrfTests.map((raw) => {
    const t = raw as Record<string, unknown>;
    const retries = num(t.retries) ?? 0;
    const flaky = t.flaky === true;
    let status = normalizeStatus(str(t.status));
    if (flaky && status === 'passed') status = 'flaky';
    const message = str(t.message);
    const failure: NormalizedFailure | null =
      status === 'failed' || message
        ? {
            message: firstMeaningfulLine(message ?? str(t.trace) ?? 'Test failed'),
            location: str(t.filePath) ?? null,
            snippet: str(t.snippet) ?? null,
          }
        : null;
    return {
      name: str(t.name) ?? 'unknown test',
      status,
      durationMs: num(t.duration) ?? 0,
      retries,
      failure: status === 'passed' && !flaky ? null : failure,
    };
  });

  return {
    runId: str(summary.runId) ?? str(obj.reportId) ?? cryptoRandomId(),
    startedAt: summary.start ? new Date(num(summary.start) ?? Date.now()).toISOString() : new Date().toISOString(),
    project: str(environment.appName) ?? str(environment.repositoryName) ?? null,
    commitSha: str(environment.commit) ?? null,
    branch: str(environment.branchName) ?? null,
    totalDurationMs:
      num(summary.stop) && num(summary.start)
        ? (num(summary.stop) as number) - (num(summary.start) as number)
        : sum(tests.map((t) => t.durationMs)),
    tests: dedupeByName(tests),
  };
}

// --- helpers ----------------------------------------------------------------

function normalizeStatus(s: string | null): TestStatus {
  switch ((s ?? '').toLowerCase()) {
    case 'passed':
    case 'pass':
      return 'passed';
    case 'failed':
    case 'fail':
      return 'failed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
    case 'pending':
    case 'other':
      return 'skipped';
    default:
      return 'passed';
  }
}

/** ANSI escape sequences, with or without the leading ESC byte. */
const ANSI = /?\[[0-9;]*m/g;

/** Pull the first line that actually says something, skipping ANSI/blank noise. */
export function firstMeaningfulLine(message: string): string {
  const stripped = message.replace(ANSI, '');
  const lines = stripped.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? 'Test failed (no message captured)';
}

function buildLocation(specFile: string, line: number | null): string | null {
  if (!specFile) return null;
  return line != null ? `${specFile}:${line}` : specFile;
}

/** If the same test name appears twice (retries), keep the most severe/last. */
function dedupeByName(tests: NormalizedTest[]): NormalizedTest[] {
  const map = new Map<string, NormalizedTest>();
  for (const t of tests) {
    const existing = map.get(t.name);
    if (!existing || severity(t.status) >= severity(existing.status)) map.set(t.name, t);
  }
  return [...map.values()];
}

function severity(s: TestStatus): number {
  return { skipped: 0, passed: 1, flaky: 2, failed: 3 }[s];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}
function cryptoRandomId(): string {
  return 'run-' + Math.random().toString(36).slice(2, 10);
}
