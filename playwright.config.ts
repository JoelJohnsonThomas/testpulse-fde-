import { defineConfig } from '@playwright/test';

/**
 * TestPulse's own test suite (assignment Part 3).
 *
 * TestPulse is a CLI, so these are *behavioral* Playwright tests: they exercise
 * the real parsing / flakiness / plain-English logic and run the compiled CLI as
 * a subprocess. No browser is launched, which keeps a clean-clone setup under the
 * 15-minute bar (no `npx playwright install` of a ~300MB browser is required).
 *
 * The TestRelic reporter records every test (pass / fail / flaky + failure
 * diagnostics). Cloud upload to the dashboard is enabled ONLY when
 * TESTRELIC_API_KEY is set — so a clean clone with no key produces the local
 * JSON report (which TestPulse reads) and exits, instead of hanging on an
 * unauthenticated upload stream.
 */
const hasKey = !!process.env.TESTRELIC_API_KEY;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    [
      '@testrelic/playwright-analytics',
      {
        outputPath: './test-results/analytics-timeline.json',
        includeStackTrace: true,
        includeCodeSnippets: true,
        quiet: false,
        openReport: false,
        // 'embedded' writes a single self-contained JSON + HTML report and exits.
        // The default 'streaming' starts a local report server that never exits.
        reportMode: 'embedded',
        metadata: {
          tool: 'testpulse',
          suite: 'self-tests',
        },
        // Only attempt cloud upload when a key is present. Without this guard the
        // realtime upload stream hangs the run on a clean machine.
        ...(hasKey
          ? {
              cloud: {
                apiKey: process.env.TESTRELIC_API_KEY,
                endpoint: 'https://platform.testrelic.ai/api/v1',
                // 'batch' uploads once at the end; 'both'/'realtime' opens a
                // persistent stream on start that can block the whole run.
                upload: 'batch' as const,
              },
            }
          : {}),
      },
    ],
  ],
});
