import { test, expect } from '@playwright/test';
import { explainFailure, nextStepFor, verdictLabel, fmtMs } from '../src/plain-english';
import type { NormalizedTest } from '../src/types';

/**
 * The customer's literal ask: "can someone just tell us in plain English what
 * happened instead of making us dig through 800 lines of stack trace?" These
 * tests assert the translation actually happens.
 */

function failing(message: string): NormalizedTest {
  return { name: 't', status: 'failed', durationMs: 100, retries: 0, failure: { message, location: 'tests/a.spec.ts:5', snippet: null } };
}

test.describe('plain-english — translating failures for non-QA developers', () => {
  test('a Playwright timeout becomes a plain explanation, not a stack trace', () => {
    const t = failing('locator.click: Timeout 30000ms exceeded waiting for locator("#results .item")');
    const text = explainFailure(t, 'real-bug-new', { passRate: 1, runsConsidered: 4 });
    expect(text.toLowerCase()).toContain('waited for something');
    // It should NOT just echo Playwright internals at the developer.
    expect(text).not.toContain('locator.click');
    expect(text).toContain('just started failing');
  });

  test('an assertion mismatch is described as a behavior mismatch', () => {
    const t = failing('expect(received).toBe(expected)\n\nExpected: 401\nReceived: 200');
    const text = explainFailure(t, 'real-bug-persistent', { passRate: 0, runsConsidered: 3 });
    expect(text.toLowerCase()).toContain('expected one value but the app produced a different one');
    expect(text.toLowerCase()).toContain('failing across recent runs');
  });

  test('a network error is described as the app/endpoint not responding', () => {
    const t = failing('Error: connect ECONNREFUSED 127.0.0.1:3000');
    const text = explainFailure(t, 'real-bug-new', { passRate: 1, runsConsidered: 0 });
    expect(text.toLowerCase()).toContain('did not respond');
    // With no history, copy must say so rather than claim a regression.
    expect(text.toLowerCase()).toContain('no prior history');
  });

  test('an unknown error falls back to the raw first line, never silently dropped', () => {
    const t = failing('Custom domain assertion: invoice currency must be USD');
    const text = explainFailure(t, 'real-bug-new', { passRate: 1, runsConsidered: 2 });
    expect(text).toContain('invoice currency must be USD');
  });

  test('flaky copy reassures the developer it is noise, citing the pass rate', () => {
    const t = failing('Timeout exceeded');
    const text = explainFailure(t, 'flaky', { passRate: 0.8, runsConsidered: 5 });
    expect(text.toLowerCase()).toContain('flips between pass and fail');
    expect(text).toContain('80%');
  });

  test('verdict labels and duration formatting are human-friendly', () => {
    expect(verdictLabel('real-bug-new')).toMatch(/real/i);
    expect(verdictLabel('flaky')).toMatch(/noise/i);
    expect(fmtMs(500)).toBe('500ms');
    expect(fmtMs(1500)).toBe('1.5s');
    expect(nextStepFor('flaky', failing('x'))).toMatch(/do not block/i);
  });
});
