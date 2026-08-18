# coursera-cli

```
 ██████  █████  ██   ██ ██████  ███████ ███████ ██████   █████
██      ██   ██ ██   ██ ██   ██ ██      ██      ██   ██ ██   ██
██      ██   ██ ██   ██ ██████  ███████ █████   ██████  ███████
██      ██   ██ ██   ██ ██   ██      ██ ██      ██   ██ ██   ██
 ██████  █████   █████  ██   ██ ███████ ███████ ██   ██ ██   ██
```

[![npm](https://img.shields.io/npm/v/coursera-cli?color=0056D2&logo=npm&logoColor=white)](https://www.npmjs.com/package/coursera-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-0056D2.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3-0056D2.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0056D2.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-87%20passing-0056D2.svg)](#tests)
[![MCP](https://img.shields.io/badge/MCP-6%20tools-0056D2.svg)](https://modelcontextprotocol.io/)

Your own Coursera courses, from the terminal — and from Claude Code, over MCP.

Downloads the **transcripts** and **readings** of courses you are enrolled in, through
Coursera's internal API. No HTML scraping, no gigabytes of video.

```
coursera courses --search pricing     find the course
coursera map                          see what you actually studied
coursera transcript <slug>            pull the content as text
```

---

## Install

Requires [Bun](https://bun.sh) — the CLI is TypeScript and Bun runs it directly, with no
build step.

```bash
bun add -g coursera-cli     # or: npm install -g coursera-cli
```

That puts a `coursera` command on your PATH. It works even when Bun itself is not on
PATH: the installed command is a small Node launcher that goes looking for Bun, and says
so plainly if it cannot find it.

### From source

```bash
git clone https://github.com/StephCastrof001/coursera-cli.git
cd coursera-cli
bun install
bun link                    # optional: same global `coursera` command
```

Without `bun link`, run it as `bun run index.ts <command>` from the repo root.

## Session

The CLI needs your account's `CAUTH` cookie. It looks in three places, in order:

1. The `COURSERA_CAUTH` environment variable
2. Its own store, under the platform config directory
3. A store left by an earlier capture (`~/.config/coursera_recon/session.json`)

### Getting the cookie

**Logging in is not automated.** Typing credentials from a script is what triggers the
CAPTCHA, so the cookie is copied by hand — once. It lasts days, not hours: the longest
measured lifetime so far is 126 hours.

1. Log in to [coursera.org](https://www.coursera.org) in your browser
2. Open DevTools (`F12`) → **Application** tab on Chrome, **Storage** on Firefox
3. **Cookies** → `https://www.coursera.org` → find the row named `CAUTH`
4. Copy its **Value** — a long opaque string

Then hand it to the CLI:

```bash
# macOS, Linux, Git Bash
export COURSERA_CAUTH="paste-the-value-here"

# PowerShell
$env:COURSERA_CAUTH = "paste-the-value-here"
```

Make it permanent by adding that line to your shell profile, or keep it in the session
store. Either way, `coursera session` tells you whether it worked:

```bash
coursera session   # is it alive, where did it come from, how old is it
coursera doctor    # session + routes + paths, all at once
```

```
[OK]   version: coursera-cli 0.3.2 on win32, bun 1.3.11
[OK]   session-present: found via cli, 12.4 h old
[OK]   session-alive: 42 courses visible
[OK]   endpoints: 10 routes declared, domains.v1 alive
[OK]   paths: state C:\Users\you\AppData\Local\coursera-cli

5/5 checks passed
```

## Commands

| Command | What it does |
|---|---|
| `coursera session` | Session state: source, age, alive or dead |
| `coursera doctor` | Diagnoses session, live routes and writable paths |
| `coursera courses [filters]` | Your courses |
| `coursera map [--detail]` | Branches, levels, institutions, unfinished specializations |
| `coursera course <slug>` | Syllabus, institution, instructors, declared level |
| `coursera transcript <slug>` | Downloads transcripts and readings |

### Filters

Filters compose with AND, and multi-word values need no quotes:

```bash
coursera courses --search machine learning
coursera courses --level intermediate --domain data-science
coursera courses --lang es --hours 5          # short courses in Spanish
coursera courses --university duke
```

| Flag | Example |
|---|---|
| `--search <text>` | name or slug |
| `--level` | `beginner`, `intermediate`, `advanced` |
| `--domain <id>` | branch or sub-branch, e.g. `data-science`, `machine-learning` |
| `--lang <code>` | primary language, e.g. `es` |
| `--hours <n>` | at most n estimated hours |
| `--university <name>` | e.g. `duke` |

### Global flags

| Flag | Default | Purpose |
|---|---|---|
| `--json` | off | Structured output. Implied when stdout is piped |
| `--out <dir>` | platform data dir | Where to write |
| `--limit <n>` | all | Stop after n items |
| `--lang es,en` | `es,es-LA,en` | Subtitle preference order |
| `--quiet` | off | No progress output |
| `--color` / `--no-color` | auto | Force colour on or off. Auto-detects TTY, and honours `NO_COLOR` and `FORCE_COLOR` |

## Library map

`coursera map` cross-references your library against Coursera's own taxonomy. The output
below is an illustration — the figures are made up, not anyone's real library:

```
42 courses in your library
levels: beginner 18   intermediate 15   advanced 3   undeclared 6
data-science                      21  ████████████████████████  310 h
computer-science                  14  ████████████████          180 h
business                           9  ██████████                 95 h

SPECIALIZATIONS (4)
  ✓ Foundations of Data Science                      4/4  complete
  ○ Cloud Architecture                               2/5  3 missing
```

Two caveats it prints itself, because both are real: a course filed under two branches
counts in both, and hours come from Coursera's free-text workload field, which a good
third of courses do not state readably.

## MCP for Claude

Register the server with the **absolute path to the Bun binary** — the process that
launches MCP servers does not inherit your PATH, so `"command": "bun"` fails with
"Failed to connect". Find yours with `which bun` (`where.exe bun` on Windows).

### Claude Code

In `.mcp.json` at your project root, or in `~/.claude.json` to have it everywhere:

```json
{
  "mcpServers": {
    "coursera": {
      "command": "C:/Users/you/.bun/bin/bun.exe",
      "args": ["C:/Users/you/coursera-cli/src/mcp/index.ts"]
    }
  }
}
```

### Claude Desktop

Same shape, in the app's own config file — `%APPDATA%\Claude\claude_desktop_config.json`
on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "coursera": {
      "command": "/Users/you/.bun/bin/bun",
      "args": ["/Users/you/coursera-cli/src/mcp/index.ts"]
    }
  }
}
```

### Tools

| Tool | Returns |
|---|---|
| `session_status` | Whether the session is alive, where it came from, how many courses it sees |
| `list_courses` | Your courses, with the same filters as the CLI |
| `get_library_map` | Branches, levels, institutions, specialization progress |
| `get_course_outline` | The course tree plus institution and instructors |
| `fetch_transcripts` | Downloads a course, returns the **index** of what landed |
| `read_transcript` | The text of **one** item |

`fetch_transcripts` returns paths, not text: a course is ~130 KB (≈35k tokens) and sending
it whole would blow up the conversation. To read, use `read_transcript`.

## What it downloads

Text, by default: a `.txt` transcript per video and a `.reading.md` per reading. No video —
a course is gigabytes as MP4 against ~130 KB as text, and for studying or summarizing the
text carries the same signal.

Files are organized per module, numbered in order, with a `manifest.json` index.

## Locked modules

When a course is in preview or has locked weeks, the aggregating API **censors the item
type**: it returns them empty, and extractors that filter by type skip 75% of the syllabus
believing it is empty.

This CLI does not filter. It asks the video and reading microservices about every item
directly and keeps whatever answers.

## Architecture

Four layers, one direction of dependency: commands and MCP call services, services call
`http.ts`, `http.ts` calls the network. Commands never build URLs and services never print —
that is what lets the CLI and the MCP server share every line of business logic.

```
index.ts             → CLI dispatcher (one file per command, lazily imported)
src/
  constants.ts       → base URL, user agent, rate limit, paths
  config.ts          → session loading: env var, own store, legacy Python store
  session.ts         → bridge between the stored session and the HTTP client
  http.ts            → typed client; 200-with-HTML means a dead route, 401 a dead session
  errors.ts          → error vocabulary: every failure has a code and a hint
  output.ts          → flag parsing, table rendering, human vs JSON mode
  endpoints.json     → the routes. A deprecation is fixed here, not in the code
  services/          → business logic, shared by CLI and MCP
    memberships.ts   → your enrolled courses, paginated and filtered
    courses.ts       → the syllabus tree, rebuilt from flat linked lists
    transcripts.ts   → probes video and reading microservices per item
    download.ts      → writes files, records where each course landed
    library.ts       → taxonomy cross-reference behind `coursera map`
    partners.ts      → resolves institution names to ids
  commands/          → one file per CLI command
  mcp/index.ts       → MCP server, 6 tools
  ui/
    theme.ts         → colour tokens, truecolor detection
    banner.ts        → wordmark and status dashboard
  cli/               → cligentic blocks: json-mode, error-map, xdg-paths, doctor
test/                → 87 tests against responses captured live from the API
```

## Tech Stack

- [Bun](https://bun.sh) — runtime. TypeScript runs directly, no build step
- [TypeScript](https://www.typescriptlang.org/) — strict mode, no `any`
- [MCP SDK](https://modelcontextprotocol.io/) — the Claude integration, 6 tools
- [picocolors](https://github.com/alexeyraspopov/picocolors) — the only runtime dependency
  besides the MCP SDK. Truecolor is layered on top of it in `ui/theme.ts`
- [cligentic](https://cligentic.railly.dev/) — copy-paste blocks for agent-facing CLI
  concerns: structured output, typed errors, XDG paths, health checks

## Docs

| File | Contents |
|---|---|
| `SPEC.md` | The spec: problem, decisions, scope, verification |
| `CONTEXT.md` | Domain glossary |
| `RESEARCH.md` | Portal recon: endpoints, gotchas, what is alive |
| `CHANGELOG.md` | What changed in each version |
| `endpoints.json` | The routes. A deprecation is fixed here, not in the code |

## Tests

```bash
bun test          # 87 tests against responses captured live from the API
bun run typecheck
```

## Legal

Reaches **your own account** with **your own session**, for courses you are already
enrolled in. Downloaded material is copyrighted by Coursera and its universities: it is for
your personal study. Do not redistribute it.
