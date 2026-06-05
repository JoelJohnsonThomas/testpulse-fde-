# Part 1 — Customer Problem Decomposition

**Customer:** 12-person SaaS startup, developer-owned testing, no QA engineer. Writes Playwright tests; results rot as XML in GitHub Actions artifacts.

## Root Cause Analysis

The customer *asked for* "better test reports" and "plain-English failures." That is the symptom. The **real problem is that test results are invisible to the people who can act on them, and where they are visible, signal is indistinguishable from noise.** A report only has value at the moment a developer decides what to do next — and these reports never reach that moment: they live in an artifact nobody opens, in a format nobody reads, with no way to tell a real regression from a flaky test that fails 20% of the time anyway. So the team learns about breakage from Slack (production), not from the tests they already wrote. The data exists; the **judgement and the delivery** do not. Fixing the report format alone changes nothing — you have to push an *interpreted* signal to where developers already look.

## Jobs-to-be-Done

- **Functional:** *When a CI run finishes, I want to be told in one line whether anything I should care about broke, so I can keep shipping without opening a dashboard.*
- **Functional:** *When a test fails, I want a plain-English explanation and the exact file/line, so I can act without reading an 800-line stack trace.*
- **Functional:** *When a test goes red, I want to know if it's a real regression or known flaky noise, so I don't waste an afternoon chasing a test that fails randomly.*
- **Emotional:** *When I merge on a green-ish build, I want to feel confident I'm not about to get paged from Slack at 11pm — that the tests are watching my back, not just generating XML.*

## Failure Modes at Scale (deployed to 200 similar teams)

1. **Silent no-op when the API key is missing.** The SDK swallows the upload, the dashboard stays empty, and the team concludes "this doesn't work" and churns. **Mitigation:** the tool runs and produces a full local plain-English summary *without* a key (cloud is purely additive), and emits a one-line warning that uploads are off — so value lands on run #1 regardless.
2. **Alert fatigue / flaky noise floods the channel.** If every red test pings Slack, developers mute the channel within a week and we're back to "nobody reads it." **Mitigation:** cross-run flakiness classification — flaky tests are demoted to a "safe to ignore" list and never gate; only *new* real regressions lead the message.
3. **Format/framework drift.** Teams are on different Playwright/CTRF versions and report shapes; a brittle parser breaks for 1 in 5 teams. **Mitigation:** normalize both the TestRelic timeline schema *and* the framework-agnostic CTRF standard to one internal model, fail loudly with an actionable error, and skip corrupt history lines instead of crashing.

## Success Metric

**Not** "they installed it." The activation signal is: **a developer takes an action on a TestPulse signal within 24h of a run** — e.g., the first time a run is flagged "new real bug" and the corresponding test goes green again in the next run on the same branch (a fix landed *because of* the signal). Observable in TestRelic analytics as a **fail → (TestPulse flag) → fix-on-next-run transition**, attributable to a run the team actually viewed/received. Tracking `summary.viewed`, `slack.delivered`, and the per-test red→green recovery time after a `new-bug` flag turns "did it get used" into "did it change behavior."
