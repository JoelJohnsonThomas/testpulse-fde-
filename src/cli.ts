#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseFile, parseReport } from './parse';
import { analyze } from './analyze';
import { toText, toMarkdown, toJson } from './summarize';
import { readHistory, appendRun, alreadyRecorded, toRecord, DEFAULT_HISTORY_PATH } from './history';
import { postToSlack } from './slack';
import { DEMO_RUNS } from './demo/demo-data';
import type { Analysis, HistoryRecord, NormalizedRun } from './types';

interface Args {
  command: 'summary' | 'demo' | 'help';
  file?: string;
  format: 'text' | 'md' | 'json';
  out?: string;
  slack: boolean;
  record: boolean;
  history: string;
  dashboard?: string;
  window: number;
  failOn: 'none' | 'new-bug' | 'any-bug';
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    command: 'summary',
    format: 'text',
    slack: false,
    record: true,
    history: process.env.TESTPULSE_HISTORY ?? DEFAULT_HISTORY_PATH,
    dashboard: process.env.TESTRELIC_DASHBOARD_URL,
    window: 10,
    failOn: 'none',
  };
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case 'demo':
        a.command = 'demo';
        break;
      case 'help':
      case '--help':
      case '-h':
        a.command = 'help';
        break;
      case '--format':
        a.format = argv[++i] as Args['format'];
        break;
      case '--out':
        a.out = argv[++i];
        break;
      case '--slack':
        a.slack = true;
        break;
      case '--no-record':
        a.record = false;
        break;
      case '--history':
        a.history = argv[++i];
        break;
      case '--dashboard':
        a.dashboard = argv[++i];
        break;
      case '--window':
        a.window = Number(argv[++i]) || a.window;
        break;
      case '--fail-on':
        a.failOn = argv[++i] as Args['failOn'];
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        positionals.push(arg);
    }
  }
  if (a.command === 'summary' && positionals[0]) a.file = positionals[0];
  if (!['text', 'md', 'json'].includes(a.format)) throw new Error(`--format must be text|md|json`);
  return a;
}

const HELP = `testpulse — turn a test run into one plain-English signal.

USAGE
  testpulse <report.json> [options]   Summarize a TestRelic or CTRF report
  testpulse demo                      Run against bundled sample data (no setup)
  testpulse help                      Show this help

OPTIONS
  --format text|md|json   Output format (default: text)
  --out <file>            Write output to a file instead of stdout
  --slack                 Also post the summary to SLACK_WEBHOOK_URL
  --dashboard <url>       TestRelic dashboard URL to link in the summary
  --history <path>        Run-history file (default: .testpulse/history.jsonl)
  --no-record             Analyze but do not append this run to history
  --window <n>            How many prior runs to weigh for flakiness (default: 10)
  --fail-on none|new-bug|any-bug
                          Exit non-zero so CI can gate on it (default: none)

EXAMPLES
  testpulse test-results/analytics-timeline.json
  testpulse test-results/analytics-timeline.json --format md --out docs/summary.md
  testpulse ctrf-report.json --slack --fail-on new-bug
`;

function buildDemoAnalysis(window: number): Analysis {
  const runs: NormalizedRun[] = DEMO_RUNS.map(parseReport);
  const history: HistoryRecord[] = runs.slice(0, -1).map(toRecord);
  const current = runs[runs.length - 1];
  return analyze(current, history, { window });
}

function render(analysis: Analysis, a: Args): string {
  const opts = { dashboardUrl: a.dashboard ?? null };
  if (a.format === 'json') return toJson(analysis);
  if (a.format === 'md') return toMarkdown(analysis, opts);
  return toText(analysis, opts);
}

function exitCodeFor(analysis: Analysis, failOn: Args['failOn']): number {
  if (failOn === 'new-bug') return analysis.newBugs.length > 0 ? 1 : 0;
  if (failOn === 'any-bug') return analysis.newBugs.length + analysis.persistentBugs.length > 0 ? 1 : 0;
  return 0;
}

export async function run(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write((err as Error).message + '\n\n' + HELP);
    return 2;
  }

  if (args.command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }

  let analysis: Analysis;

  if (args.command === 'demo') {
    analysis = buildDemoAnalysis(args.window);
  } else {
    if (!args.file) {
      process.stderr.write('Error: no report file given.\n\n' + HELP);
      return 2;
    }
    let runData: NormalizedRun;
    try {
      runData = parseFile(args.file);
    } catch (err) {
      process.stderr.write('Error: ' + (err as Error).message + '\n');
      return 2;
    }
    const history = readHistory(args.history);
    analysis = analyze(runData, history, { window: args.window });
    if (args.record && !alreadyRecorded(history, runData)) {
      appendRun(args.history, runData);
    }
  }

  const output = render(analysis, args);

  if (args.out) {
    writeFileSync(args.out, output, 'utf8');
    process.stdout.write(`Wrote ${args.format} summary to ${args.out}\n`);
  } else {
    process.stdout.write(output + '\n');
  }

  if (args.slack) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) {
      process.stderr.write('Warning: --slack given but SLACK_WEBHOOK_URL is not set; skipping Slack post.\n');
    } else {
      try {
        const res = await postToSlack(url, analysis, { dashboardUrl: args.dashboard ?? null });
        process.stderr.write(res.ok ? 'Posted summary to Slack.\n' : `Slack post failed (HTTP ${res.status}).\n`);
      } catch (err) {
        process.stderr.write('Slack post error: ' + (err as Error).message + '\n');
      }
    }
  }

  return exitCodeFor(analysis, args.failOn);
}

// Only run when invoked as a script (not when imported by tests).
const invokedDirectly =
  process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('testpulse.mjs') || process.argv[1].endsWith('cli.js'));
if (invokedDirectly) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
