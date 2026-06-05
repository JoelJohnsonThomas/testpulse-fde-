import { test, expect } from '@playwright/test';
import { analyze } from '../src/analyze';
import { headline, toMarkdown, toText, toJson } from '../src/summarize';
import { slackify } from '../src/slack';
import type { HistoryRecord, NormalizedRun, NormalizedTest, TestStatus } from '../src/types';

function tt(name: string, status: TestStatus, msg?: string): NormalizedTest {
  return { name, status, durationMs: 100, retries: 0, failure: status === 'failed' ? { message: msg ?? 'expect(received).toBe(expected)', location: 'tests/a.spec.ts:9', snippet: null } : null };
}
function run(tests: NormalizedTest[]): NormalizedRun {
  return { runId: 'r', startedAt: '2026-06-06T00:00:00Z', project: 'acme', commitSha: 'c', branch: 'main', totalDurationMs: 0, tests };
}
const prior: HistoryRecord[] = [{ runId: 'p1', startedAt: '', commitSha: null, branch: null, statuses: { 'a > new bug': 'passed', 'a > ok': 'passed' } }];

test.describe('summarize — the signal a developer actually reads', () => {
  const a = analyze(run([tt('a > new bug', 'failed'), tt('a > ok', 'passed')]), prior, {});

  test('headline leads with the real bug and a red marker', () => {
    const h = headline(a);
    expect(h).toContain('🔴');
    expect(h.toLowerCase()).toContain('real bug');
    expect(h).toContain('✅ 1 passed');
  });

  test('all-green run produces a clean, reassuring headline', () => {
    const green = analyze(run([tt('a > ok', 'passed'), tt('a > ok2', 'passed')]), [], {});
    expect(headline(green)).toContain('🟢');
    expect(headline(green).toLowerCase()).toContain('all 2 tests passed');
  });

  test('markdown output has a Fix-first section, the test name, location and a next step', () => {
    const md = toMarkdown(a, { dashboardUrl: 'https://platform.testrelic.ai/runs/r' });
    expect(md).toContain('### 🔴 Fix first');
    expect(md).toContain('a > new bug');
    expect(md).toContain('tests/a.spec.ts:9');
    expect(md).toContain('👉');
    expect(md).toContain('[View full run in TestRelic →](https://platform.testrelic.ai/runs/r)');
  });

  test('text output is plain and scannable', () => {
    const txt = toText(a);
    expect(txt).toContain('FIX FIRST');
    expect(txt).toContain('a > new bug');
  });

  test('json output is valid and machine-consumable for CI gating', () => {
    const parsed = JSON.parse(toJson(a));
    expect(parsed.headline).toBeTruthy();
    expect(Array.isArray(parsed.newBugs)).toBe(true);
    expect(parsed.newBugs[0].name).toBe('a > new bug');
    expect(parsed.totals.passed).toBe(1);
  });

  test('slackify converts our markdown to Slack mrkdwn (no ### headings, * for bold, <url|text> links)', () => {
    const slack = slackify(toMarkdown(a, { dashboardUrl: 'https://x.test/r' }));
    expect(slack).not.toContain('###');
    expect(slack).not.toContain('**');
    expect(slack).toContain('<https://x.test/r|View full run in TestRelic →>');
  });
});
