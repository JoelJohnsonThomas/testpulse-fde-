# Submission checklist — FDE Intern Assignment

Repo deliverables and their status. ✅ = done & in repo.

| # | Deliverable | Required | Status | Location |
|---|---|---|---|---|
| 1 | Problem Decomposition (≤1 page) | MUST | ✅ | [`docs/problem.md`](docs/problem.md) |
| 2 | Working Tool + README (runs in <3 cmds) | MUST | ✅ | [`README.md`](README.md), [`src/`](src/) — `npm install && npm run demo` |
| 3 | Playwright suite ≥5 tests + 1 intentional failure | MUST | ✅ (31 pass + 1 intentional fail) | [`tests/`](tests/), evidence: [`docs/test-run-output.txt`](docs/test-run-output.txt) |
| 4 | TestRelic dashboard link/screenshot (real data) | MUST | ✅ | [`docs/dashboard.md`](docs/dashboard.md) — live run + `dashboard.png` |
| 5 | MCP query screenshot (NL prompt + AI insight) | MUST | ✅ | [`docs/mcp.md`](docs/mcp.md) — 2 AI conversations, `mcp.png`–`mcp5.png` |
| 6 | Scale Brief (≤2 pages) | MUST | ✅ | [`docs/scale.md`](docs/scale.md) |
| 7 | GitHub Actions CI run reporting to TestRelic | SHOULD | ✅ wired | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — add `TESTRELIC_API_KEY` secret |
| 8 | Loom/demo video (≤3 min) | SHOULD | ⬜ optional | link in README |

## The 3 manual steps left for you (≈15 min)

✅ **Done:** dashboard upload (CI on Node 20 → `docs/dashboard.md` + `dashboard.png`) and
the MCP/Ask-AI insights (`docs/mcp.md` + `mcp.png`–`mcp5.png`).

**Only step left — submit:** email the repo link
`https://github.com/JoelJohnsonThomas/testpulse-fde-` to `hiring@testrelic.ai` with
subject **"FDE Intern — Joel Thomas"** before the 72-hour window closes.

## Verify the tool right now (no account needed)

```bash
npm install
npm run demo          # plain-English signal from 4 bundled runs
npx playwright test --reporter=list   # 31 pass + 1 intentional fail
```
