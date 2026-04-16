# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-04-16

### Added
- Initial release of `vibescore`.
- Zero-config CLI that audits a repo and returns a Vibe Score from 0 to 100.
- Human-readable terminal report and `--json` output.
- `--strict` flag (harsher scoring, non-zero exit when score < 70 or any critical issue).
- `--no-funny` flag for dry verdict output.
- `--max-file-lines <n>` to override the large-file threshold.
- 12 deterministic checks:
  - Env example (`.env.example` missing despite `process.env` usage)
  - Committed secrets (AWS, Google, GitHub, Slack, Stripe, OpenAI, Anthropic, JWT, private keys, bearer tokens)
  - Missing / thin tests on critical paths
  - Large files (warn + severe thresholds)
  - TODO/FIXME/HACK/TEMP/XXX markers
  - Placeholder / stub language
  - Duplicate 6-line normalized blocks
  - Unused dependencies (conservative, info only)
  - Mixed filename naming conventions
  - Missing CI config
  - Missing / thin README
  - Broken relative imports
- Programmatic API via `import { analyze } from 'vibescore'`.
- Score bands: Pristine, Clean, Neutral, Needs Rebuild, Nuke it.

[Unreleased]: https://github.com/marco-trotta1/vibescore/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/marco-trotta1/vibescore/releases/tag/v0.1.0
