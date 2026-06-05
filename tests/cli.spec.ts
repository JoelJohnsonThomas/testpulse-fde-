import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * End-to-end tests that run the real CLI as a subprocess — the same entry point
 * a customer's developer types. These would catch a regression in argument
 * parsing, exit codes (CI gating), or the demo path.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const bin = resolve(root, 'bin', 'testpulse.mjs');
const fixture = (name: string) => resolve(here, 'fixtures', name);

function runCli(args: string[]) {
  const res = spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

test.describe('cli — the real entry point a developer types', () => {
  test('`testpulse demo` runs with zero setup and prints a plain-English signal', () => {
    const { status, stdout } = runCli(['demo']);
    expect(status).toBe(0);
    expect(stdout).toContain('FIX FIRST');
    expect(stdout.toLowerCase()).toContain('flaky');
  });

  test('`--format json` emits valid, parseable JSON', () => {
    const { status, stdout } = runCli(['demo', '--format', 'json']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.headline).toBeTruthy();
    expect(parsed.totals.total).toBeGreaterThan(0);
  });

  test('`--fail-on new-bug` exits non-zero so CI can gate on a real regression', () => {
    // Fresh history file => the fixture's failing test has no prior passes => new bug.
    const historyPath = resolve(mkdtempSync(resolve(tmpdir(), 'tp-')), 'history.jsonl');
    const { status, stdout } = runCli([
      fixture('testrelic-run.json'),
      '--history',
      historyPath,
      '--fail-on',
      'new-bug',
    ]);
    expect(status).toBe(1);
    expect(stdout).toContain('applies discount code');
  });

  test('without --fail-on, a failing report still exits 0 (TestPulse informs, it does not block by default)', () => {
    const historyPath = resolve(mkdtempSync(resolve(tmpdir(), 'tp-')), 'history.jsonl');
    const { status } = runCli([fixture('testrelic-run.json'), '--history', historyPath, '--no-record']);
    expect(status).toBe(0);
  });

  test('a missing report file fails clearly with a non-crash exit code', () => {
    const { status, stderr } = runCli(['does-not-exist.json']);
    expect(status).toBe(2);
    expect(stderr.toLowerCase()).toContain('could not read');
  });

  test('`help` prints usage', () => {
    const { status, stdout } = runCli(['help']);
    expect(status).toBe(0);
    expect(stdout).toContain('USAGE');
    expect(stdout).toContain('testpulse demo');
  });
});
