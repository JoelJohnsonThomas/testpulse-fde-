import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HistoryRecord, NormalizedRun } from './types';

/**
 * A tiny append-only run history (JSON Lines) so TestPulse can tell the
 * difference between "flaky noise" and "a real regression" — which needs more
 * than one run to know. Deliberately local-first and dependency-free: the
 * customer's developers can `git`-ignore it or commit it, their choice.
 */

export const DEFAULT_HISTORY_PATH = '.testpulse/history.jsonl';

export function readHistory(path: string): HistoryRecord[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const records: HistoryRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed) as HistoryRecord;
      if (rec && rec.statuses) records.push(rec);
    } catch {
      // Skip a corrupt line rather than crashing the whole run.
    }
  }
  return records;
}

export function toRecord(run: NormalizedRun): HistoryRecord {
  const statuses: Record<string, HistoryRecord['statuses'][string]> = {};
  const durations: Record<string, number> = {};
  for (const t of run.tests) {
    statuses[t.name] = t.status;
    durations[t.name] = t.durationMs;
  }
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    commitSha: run.commitSha,
    branch: run.branch,
    statuses,
    durations,
  };
}

export function appendRun(path: string, run: NormalizedRun): void {
  const dir = dirname(path);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(path, JSON.stringify(toRecord(run)) + '\n', 'utf8');
}

/** Has this exact run already been recorded? Keeps re-runs idempotent. */
export function alreadyRecorded(history: HistoryRecord[], run: NormalizedRun): boolean {
  return history.some((h) => h.runId === run.runId);
}
