# coursera-cli

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

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/StephCastrof001/coursera-cli.git
cd coursera-cli
bun install
```

### The `coursera` command

Every example below assumes `coursera` runs from anywhere. Bun does not always put
itself on PATH, so the launcher calls it by absolute path.

**Windows** — drop `coursera.cmd` in a directory already on your PATH
(`%USERPROFILE%\.local\bin` works):

```bat
@echo off
"%USERPROFILE%\.bun\bin\bun.exe" run "%USERPROFILE%\coursera-cli\index.ts" %*
```

**macOS, Linux, Git Bash** — same idea, as `coursera` (then `chmod +x`):

```sh
#!/bin/sh
exec "$HOME/.bun/bin/bun" run "$HOME/coursera-cli/index.ts" "$@"
```

Without a launcher, replace `coursera` with `bun run index.ts` from the repo root.

## Session

The CLI needs your account's `CAUTH` cookie. It looks in three places, in order:

1. The `COURSERA_CAUTH` environment variable
2. Its own store, under the platform config directory
3. The store written by the Python recon repo (`~/.config/coursera_recon/session.json`)

If you have none, capture one with `capture_session.py` from the `coursera_recon` repo: it
opens a visible Chromium, you log in by hand, and it saves the cookie. **Logging in is not
automated** — typing credentials from a script is what triggers the CAPTCHA.

```bash
coursera session   # is it alive, where did it come from, how old is it
coursera doctor    # session + routes + paths, all at once
```

```
[OK]   version: coursera-cli 0.2.0 on win32, bun 1.3.11
[OK]   session-present: found via legacy, 108.2 h old
[OK]   session-alive: 215 courses visible
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

## Library map

`coursera map` cross-references your library against Coursera's own taxonomy:

```
215 courses in your library
levels: beginner 99   intermediate 66   advanced 7   undeclared 43
business                         158  ████████████████████████ 1366 h
data-science                      90  ██████████████            735 h
computer-science                  35  █████                     255 h

SPECIALIZATIONS (15)
  ✓ AI Product Management                            3/3  complete
  ○ Digital Product Management                       3/5  2 missing
```

Two caveats it prints itself, because both are real: a course filed under two branches
counts in both, and hours come from Coursera's free-text workload field, which 78 of 215
courses do not state readably.

## MCP for Claude Code

Register the server with the **absolute path to the Bun binary** — the process that
launches MCP servers does not inherit your PATH, so `"command": "bun"` fails with
"Failed to connect":

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
bun test          # 76 tests against responses captured live from the API
bun run typecheck
```

## Legal

Reaches **your own account** with **your own session**, for courses you are already
enrolled in. Downloaded material is copyrighted by Coursera and its universities: it is for
your personal study. Do not redistribute it.
