# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- A visual layer, in `src/ui/`. Bare `coursera` in a terminal now opens with the wordmark
  and a dashboard — session state and age, courses enrolled, courses cached locally —
  before the command list.
- Colour throughout human output: course slugs in brand blue, levels colour-coded by
  difficulty, dimmed table rules, highlighted commands in `--help`, red errors.

### Changed
- The repo moved out of `klipso_reverse/Cli-propios/` to the top level. It has its own git
  remote, and the directory it sat in is `.gitignore`d by the parent repo, so the nesting
  bought nothing and cost three levels of path on every invocation. The README now
  documents a `coursera` launcher so the path is never typed at all.
- Brand colour is `#0056D2`, read off coursera.org rather than guessed: its `theme-color`
  meta tag, its primary button, and the `fill` of the header logo SVG all agree. The
  wordmark's fade derives its light end from that value, so no invented hex is in the
  palette. The brand's `#002457` secondary is recorded but unused — on a dark terminal it
  sits near 1.5:1 contrast and disappears.

### Fixed
- 24-bit colour is now detected on Windows Terminal, VS Code, iTerm2, WezTerm, Hyper,
  Ghostty and Tabby, not just on terminals that set `COLORTERM`. That variable is a Unix
  convention Windows Terminal does not follow, so the brand blue was quietly degrading to
  plain ANSI blue on the default terminal of this project's own author.
- `--color` and `--no-color` are declared as boolean flags, so the argument parser stops
  treating them as flags that swallow the following token. picocolors already honoured
  both, along with `NO_COLOR` and `FORCE_COLOR`.

### Notes
- Colour never reaches `--json`: structured output goes through the cligentic `json-mode`
  block, and picocolors already no-ops when stdout is not a TTY or `NO_COLOR` is set. Both
  paths are covered by the smoke checks.

## [0.2.0] — 2026-08-17

### Added
- `coursera map` — branches you studied, declared difficulty levels, top institutions,
  and progress on every specialization. Also exposed as the `get_library_map` MCP tool.
- `coursera doctor` — diagnoses session, live routes and writable paths in one pass, so a
  failure names its own cause instead of leaving you to guess.
- Filters on `coursera courses`: `--level`, `--domain`, `--lang`, `--hours`, `--university`.
  They compose with AND and are mirrored in the `list_courses` MCP tool.
- Course metadata: declared `level`, offered `certificates`, institution and instructors,
  resolved through `partners.v1` and `instructors.v1`.
- `--version`, and cligentic blocks for output, errors, paths and health checks.

### Changed
- **The whole project is now in English** — code, comments, docs and CLI strings.
- `--search machine learning` no longer needs quotes: a text flag takes every word up to
  the next flag. Before, it silently searched only `machine`.
- A course downloaded to `--out <dir>` can be read back from there: downloads record their
  location, so `read_transcript` no longer looks only in the default folder.
- Errors are typed with a `code` and a `hint` (cligentic `error-map`), keeping the recon's
  key distinction: 200-with-HTML means the route is gone, 401/403 means the session died.
- Structured output now goes through the cligentic `json-mode` block: stdout is data,
  stderr is logs, and piped stdout switches to JSON on its own.
- Config and data paths follow the platform convention via `xdg-paths`. On Windows that is
  `%LOCALAPPDATA%\coursera-cli`, not `~/.local/share`.

### Fixed
- The workload parser understood 67 of 174 courses; it now reads 137. The first version was
  written against an 8-course sample and missed bare hours, Spanish wording, the
  "hours a week" variant and per-module effort. Genuinely ambiguous text returns null
  instead of inventing a number.

## [0.1.0] — 2026-08-16

### Added
- First working version: `session`, `courses`, `course <slug>`, `transcript <slug>`.
- MCP server with granular tools: `session_status`, `list_courses`, `get_course_outline`,
  `fetch_transcripts`, `read_transcript`.
- Real cursor pagination — 215 memberships instead of the 100 the default limit returns.
- Polymorphic probing that recovers modules the web shows as locked.
- 31 tests against API responses captured live.
