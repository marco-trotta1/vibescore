# vibeclean

> Lint for AI slop. Audits a repo and prints a **Vibe Score** from 0 to 100.

`vibeclean` is a zero-config CLI that scans a repository for the things AI-assisted
codebases tend to accumulate: missing `.env.example`, committed secrets, giant files,
TODO/FIXME drifts, duplicated blocks, placeholder stubs, missing tests, missing CI,
thin READMEs, unresolved imports.

It's deterministic. No LLMs. Just rules, file scans, and a little bit of judgment.

```
🧼 Vibeclean Report for ./my-app

Vibe Score: 63/100 (Chaotic Neutral)

CRITICAL
- Missing .env.example despite env usage (src/api/server.ts)
- Potential committed secret (AWS access key id) in src/config.ts

WARNINGS
- File exceeds 600 LOC (712 lines)  (src/routes/handler.ts:712)
- 17 TODO/FIXME/HACK/TEMP/XXX markers found. Top: src/utils/helpers.ts (9), src/api/server.ts (5), src/lib/parser.ts (3)
- Duplicate 6-line block found in 3 files (src/a.ts:42, src/b.ts:17)

INFO
- Possibly unused dependency: lodash  (package.json)
- Mixed filename conventions in src/components/: kebab(4), pascal(3)

Verdict:
Your repo compiles on faith.
```

## Why

AI pair-programming produces code faster than anyone can review it. That code
tends to ship with the same handful of smells:

- secrets hard-coded during "let me just test this"
- `mock for now` / `sample data` / `// TODO: real implementation`
- giant files that were refactored by "just extend this one"
- three copies of the same function in different folders
- no `.env.example` to onboard the next human

`vibeclean` puts a number on it.

## Install

```bash
# one-off
npx vibeclean .

# as a dev dependency
npm install --save-dev vibeclean
```

Requires Node.js 18+.

## Usage

```bash
vibeclean            # audit cwd
vibeclean .          # same
vibeclean ./my-app   # audit another path

vibeclean --json .                        # machine-readable output
vibeclean --strict .                      # harsher scoring + non-zero exit if score < 70
vibeclean --no-funny .                    # dry verdict, no jokes
vibeclean --max-file-lines 800 .          # override large-file threshold
vibeclean --help
vibeclean --version
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--json` | `false` | Print a structured JSON report instead of the terminal view. |
| `--strict` | `false` | Multiplies penalties by 1.5 and returns exit code 1 when score < 70 or any critical issue exists. |
| `--no-funny` | | Removes the roast line; prints a dry verdict instead. |
| `--max-file-lines <n>` | `600` | Severe threshold for file size. Warning threshold is half of this. |
| `-v, --version` | | Print version. |
| `-h, --help` | | Print usage. |

### JSON shape

```json
{
  "target": "/abs/path/to/repo",
  "score": 63,
  "band": "Chaotic Neutral",
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
  "verdict": "Your repo compiles on faith."
}
```

## Score bands

| Band | Range | Meaning |
| --- | --- | --- |
| Pristine | 90–100 | Cleaner than most production code. |
| Clean | 75–89 | A few loose wires, but still roadworthy. |
| Chaotic Neutral | 60–74 | Your repo compiles on faith. |
| Cursed | 40–59 | 'Ship now, explain never' energy. |
| Biohazard | 0–39 | Consider a controlled demolition. |

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

## Checks in v1

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
import { analyze } from 'vibeclean';

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
- pluggable checks via `vibeclean.config.ts`
- per-project ignore rules
- GitHub Action that comments the score on PRs
- HTML report mode
- severity thresholds (e.g. `--min-score 75`)
- more language-specific heuristics (Python, Go)

## Contributing

Small, focused PRs welcome. Each check lives in [`src/checks/`](src/checks) and is a
pure function over a `RepoContext`. Add yours, wire it into
[`src/index.ts`](src/index.ts), and drop a test in [`tests/checks.test.ts`](tests/checks.test.ts).

```bash
npm install
npm test
npm run dev .      # run against cwd
npm run build      # emit dist/
```

## License

MIT
