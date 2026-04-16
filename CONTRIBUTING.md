# Contributing to vibescore

Thanks for considering a contribution. Small, focused PRs are strongly preferred.

## Ground rules

- **Deterministic only.** No LLM calls, no network, no telemetry.
- **Zero-config.** Defaults must be sensible for most repos. New flags need a reason.
- **Small surface area.** Each check is a pure function over a `RepoContext`.
- **No new runtime deps** unless strictly necessary.
- **Keep it honest.** False positives erode trust fast; prefer `info` to `warning`, `warning` to `critical` when in doubt.

## Development setup

```bash
git clone https://github.com/marco-trotta1/vibescore.git
cd vibescore
npm install
npm test
npm run dev .        # run CLI against current directory
npm run build        # produces dist/
npm run typecheck
```

Requires Node 18+.

## Adding a new check

1. Create `src/checks/my-check.ts`. Export a function `(ctx: RepoContext, opts: AnalyzeOptions) => Issue[]`.
2. Wire it into the `DEFAULT_CHECKS` array in `src/index.ts`.
3. Add a test in `tests/checks.test.ts`. Use a temp directory fixture.
4. If the check adds a user-visible severity, add a penalty weight row to the README table.
5. Run `npm test` and `npm run typecheck` before opening the PR.

### What makes a good check

- Catches a real problem that a human reviewer would also flag.
- Low false-positive rate on tidy repos. Run it against a handful of clean repos before submitting.
- Honest severity:
  - `critical` — almost always a bug or a leak
  - `warning` — legitimate issue most of the time
  - `info` — opinion or style heuristic

## Commit / PR style

- One logical change per PR.
- Write a short, clear description of *why* the change matters — not just what it does.
- Include a before/after example when changing output format or scoring.

## Code style

- TypeScript strict mode. Respect `noUncheckedIndexedAccess`.
- Prefer small pure functions. Avoid classes unless there's a reason.
- No `any`. If you need to escape the type system, write a comment explaining why.

## Questions

Open a discussion or a `[question]` issue. No stupid questions.
