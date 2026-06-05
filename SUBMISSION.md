# Submission checklist — FDE Intern Assignment

Repo deliverables and their status. ✅ = done & in repo. 🟡 = needs one manual step
on your TestRelic account (account + GUI screenshots can't be automated).

| # | Deliverable | Required | Status | Location |
|---|---|---|---|---|
| 1 | Problem Decomposition (≤1 page) | MUST | ✅ | [`docs/problem.md`](docs/problem.md) |
| 2 | Working Tool + README (runs in <3 cmds) | MUST | ✅ | [`README.md`](README.md), [`src/`](src/) — `npm install && npm run demo` |
| 3 | Playwright suite ≥5 tests + 1 intentional failure | MUST | ✅ (31 pass + 1 intentional fail) | [`tests/`](tests/), evidence: [`docs/test-run-output.txt`](docs/test-run-output.txt) |
| 4 | TestRelic dashboard link/screenshot (real data) | MUST | 🟡 | [`docs/dashboard.md`](docs/dashboard.md) — run upload, paste link + `dashboard.png` |
| 5 | MCP query screenshot (NL prompt + AI insight) | MUST | 🟡 | [`docs/mcp.md`](docs/mcp.md) — run query, paste `mcp.png` |
| 6 | Scale Brief (≤2 pages) | MUST | ✅ | [`docs/scale.md`](docs/scale.md) |
| 7 | GitHub Actions CI run reporting to TestRelic | SHOULD | ✅ wired | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — add `TESTRELIC_API_KEY` secret |
| 8 | Loom/demo video (≤3 min) | SHOULD | ⬜ optional | link in README |

## The 3 manual steps left for you (≈15 min)

These need your TestRelic account and a desktop with a browser for screenshots —
they can't be scripted from here.

1. **Upload a real run → dashboard (item 4).**
   - Easiest: push this repo to GitHub, add `TESTRELIC_API_KEY` as a repo secret
     (Settings → Secrets → Actions). The CI workflow runs `npm test` on Node 20 and
     uploads automatically. Open the run in `platform.testrelic.ai`, screenshot it to
     `docs/dashboard.png`, paste the URL into `docs/dashboard.md`.
   - Or locally on **Node 20 LTS** (`nvm use`): `cp .env.example .env`, paste your key,
     `npm test`. (On Node 24 the reporter hangs — see the note in `docs/mcp.md`.)

2. **MCP query → AI insight (item 5).** Configure the MCP server (`docs/mcp.md` has the
   exact config), ask the flakiness prompt, screenshot the prompt + answer to `docs/mcp.png`.

3. **Submit.** Push to GitHub, then email the repo link to `hiring@testrelic.ai` with
   subject **"FDE Intern — [Your Name]"** before the 72-hour window closes.

## Verify the tool right now (no account needed)

```bash
npm install
npm run demo          # plain-English signal from 4 bundled runs
npx playwright test --reporter=list   # 31 pass + 1 intentional fail
```
