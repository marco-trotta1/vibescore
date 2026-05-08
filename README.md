# badvibes

[![npm version](https://img.shields.io/npm/v/badvibes.svg?style=flat-square)](https://www.npmjs.com/package/badvibes)
[![npm downloads](https://img.shields.io/npm/dm/badvibes.svg?style=flat-square)](https://www.npmjs.com/package/badvibes)
[![CI](https://img.shields.io/github/actions/workflow/status/marco-trotta1/vibescore/ci.yml?branch=main&style=flat-square)](https://github.com/marco-trotta1/vibescore/actions)
[![license](https://img.shields.io/npm/l/badvibes.svg?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/badvibes.svg?style=flat-square)](https://nodejs.org)

> **Lint for AI slop.** Audits a repo and prints a **Vibe Score** from 0 to 100.

`badvibes` is a zero-config CLI that scans a repository for the things AI-assisted
codebases tend to accumulate: missing `.env.example`, committed secrets, giant files,
TODO/FIXME drifts, duplicated blocks, placeholder stubs, missing tests, missing CI,
thin READMEs, unresolved imports.

It's deterministic. No LLMs. Just rules, file scans, and a little bit of judgment.

## Quick start

```bash
npx badvibes .
```

That's it. No config file, no setup.

## Example output

```
💀 BadVibes Report for ./my-app

Vibe Score: 63/100 (Neutral)

CRITICAL
- Missing .env.example despite env usage  (src/api/server.ts)
- Potential committed secret (AWS access key id)  (src/config.ts)

WARNINGS
- File exceeds 600 LOC (712 lines)  (src/routes/handler.ts:712)
- 17 TODO/FIXME/HACK/TEMP/XXX markers found. Top: src/utils/helpers.ts (9), src/api/server.ts (5), src/lib/parser.ts (3)
- Duplicate 6-line block found in 3 files  (src/a.ts:42, src/b.ts:17)

INFO
- Possibly unused dependency: lodash  (package.json)
- Mixed filename conventions in src/components/: kebab(4), pascal(3)

Verdict:
Functional, but worth cleaning up before shipping.
```

## Why

AI pair-programming produces code faster than anyone can review it. That code
tends to ship with the same handful of problems:

- secrets hard-coded during "let me just test this"
- `mock for now` / `sample data` / `// TODO: real implementation`
- giant files that were refactored by "just extend this one"
- three copies of the same function in different folders
- no `.env.example` to onboard the next human

`badvibes` puts a number on it.

## Install

```bash
# one-off
npx badvibes .

# as a dev dependency
npm install --save-dev badvibes
```

Requires Node.js 18+.

## Usage

```bash
badvibes            # audit cwd
badvibes .          # same
badvibes ./my-app   # audit another path

badvibes --json .                        # machine-readable output
badvibes --strict .                      # harsher scoring + non-zero exit if score < 70
badvibes --roast .                       # roast issue descriptions
badvibes --no-funny .                    # dry verdict
badvibes --max-file-lines 800 .          # override large-file threshold
badvibes --help
badvibes --version
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--json` | `false` | Print a structured JSON report instead of the terminal view. |
| `--strict` | `false` | Multiplies penalties by 1.5 and returns exit code 1 when score < 70 or any critical issue exists. |
| `--roast` | `false` | Rewrites issue descriptions as hardcoded roasts. Suppressed by `--no-funny`. |
| `--no-funny` | | Removes the verdict line; prints a dry summary instead. |
| `--max-file-lines <n>` | `600` | Severe threshold for file size. Warning threshold is half of this. |
| `-v, --version` | | Print version. |
| `-h, --help` | | Print usage. |

### JSON shape

```json
{
  "target": "/abs/path/to/repo",
  "score": 63,
  "band": "Neutral",
  "strict": false,
  "summary": { "critical": 1, "warnings": 3, "info": 2 },
  "issues": [
    {
      "severity": "critical",
      "code": "missing-env-example",
      "message": "Missing .env.example despite env usage",
      "file": ".env.example",
      "line": null
    }
  ],
  "verdict": "Functional, but worth cleaning up before shipping."
}
```

## Score bands

| Band | Range | Meaning |
| --- | --- | --- |
| Pristine | 90–100 | Looks clean. Nothing meaningful to fix right now. |
| Clean | 75–89 | Solid overall. A few small things worth tightening. |
| Neutral | 60–74 | Functional, but worth cleaning up before shipping. |
| Needs Rebuild | 40–59 | Real structural problems. Plan some focused cleanup. |
| Nuke it | 0–39 | Hard to salvage without serious rework. |

Scores start at 100 and subtract per issue. Representative weights:

| Issue | Severity | Penalty |
| --- | --- | --- |
| Missing `.env.example` while env is referenced | critical | −12 |
| Potential committed secret | critical | −20 each (capped) |
| No tests despite critical code (`src/api`, `src/server`, …) | critical | −15 |
| Unresolved local import | critical | −10 each (capped) |
| File > severe threshold (default 600 LOC) | warning | −5 each |
| File > warn threshold (default 300 LOC) | warning | −2 each |
| TODO/FIXME/HACK/TEMP/XXX markers | warning | −1 each (cap −12) |
| Duplicate code cluster | warning | −3 each |
| Placeholder / stub language | warning | −2 each |
| Missing CI config | warning | −5 |
| Missing README | warning | −10 |
| Thin README | warning | −4 |
| Possibly unused dependency | info | −1 each |
| Mixed filename conventions in a folder | info | −1 each |

`--strict` multiplies these by 1.5.

## What it checks

1. **Env example** — detects `process.env` / `import.meta.env` usage and warns if `.env.example` is missing.
2. **Secrets** — pattern + high-entropy heuristics for AWS, Google, GitHub, Slack, Stripe, OpenAI, Anthropic, JWTs, private keys, and bearer tokens. Skips fixtures and placeholders.
3. **Tests** — looks for `__tests__/`, `*.test.*`, `*.spec.*`. Flags critical if `src/api`, `src/server`, `src/routes`, or `src/lib` exist without tests.
4. **Large files** — configurable warn / severe thresholds. Skips `node_modules`, `dist`, `build`, `coverage`, `.git`, lockfiles, binaries.
5. **Markers** — counts `TODO`, `FIXME`, `HACK`, `TEMP`, `XXX`. Reports top offenders.
6. **Placeholders / stubs** — flags `sample data`, `mock for now`, `temporary`, `fake data`, `placeholder`, etc. in source (not docs).
7. **Duplicate logic** — hashes normalized 6-line windows across source files.
8. **Unused dependencies** — compares `package.json` deps to imports/requires/scripts. Conservative; only reports `info`.
9. **Naming consistency** — flags directories that mix kebab / pascal / snake / camel filename conventions.
10. **CI** — looks for GitHub Actions, GitLab CI, CircleCI, Travis, Azure Pipelines, Bitbucket, Drone.
11. **README** — checks for description, install section, usage section.
12. **Broken imports** — resolves relative imports and flags unresolved ones.

## Programmatic API

```ts
import { analyze } from 'badvibes';

const report = await analyze({
  target: './my-app',
  strict: false,
  funny: true,
  maxFileLines: 600,
});

console.log(report.score, report.band);
```

## Roadmap

- `--fix` suggestions for common issues
- pluggable checks via `badvibes.config.ts`
- per-project ignore rules
- GitHub Action that comments the score on PRs
- HTML report mode
- severity thresholds (e.g. `--min-score 75`)
- more language-specific heuristics (Python, Go)

## Contributing

Small, focused PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Each check lives in [`src/checks/`](src/checks) and is a pure function over a
`RepoContext`. Add yours, wire it into [`src/index.ts`](src/index.ts), and drop
a test in [`tests/checks.test.ts`](tests/checks.test.ts).

```bash
npm install
npm test
npm run dev .      # run against cwd
npm run build      # emit dist/
```

## License

MIT — see [LICENSE](./LICENSE).
