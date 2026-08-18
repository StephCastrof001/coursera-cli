# coursera-cli — CLAUDE.md

CLI + MCP over your own Coursera enrollments. Pulls transcripts and readings through the
internal API: no HTML scraping, no video.

## Agent behaviour

- **Show the banner on first interaction.** The MCP returns data, never the wordmark, so
  run the CLI once to print it:

  ```
  coursera
  ```

  If `coursera` is not on PATH, call Bun by absolute path — the process that launches MCP
  servers does not inherit it:

  ```
  ~/.bun/bin/bun run "C:/Users/HP SUPPORT/coursera-cli/index.ts"
  ```

- **Check the session before anything else.** `session_status` says whether the CAUTH
  cookie is alive and how old it is. A dead session makes every other tool fail with the
  same unhelpful shape, so ask first.

- **Never paste the CAUTH cookie into a reply.** It is a live credential. Refer to it, do
  not print it.

- **`fetch_transcripts` returns an index, not text.** A course is ~130 KB, roughly 35k
  tokens. Download, read the index, then pull single items with `read_transcript`.

- **Search before assuming a slug.** `list_courses` with a query resolves a name to its
  slug; guessing a slug produces a NotFound that looks like a session problem.

- **Report unknown hours as unknown.** Coursera's workload field is free text and about a
  third of courses do not state it readably. The tools return null there — say "not
  stated" rather than inventing a number.

## Session

Three sources, in order: `COURSERA_CAUTH`, this CLI's own store, a legacy store. Write the
second with `coursera session set <cauth>`. Getting the cookie is manual by design —
scripted logins are what trigger the CAPTCHA. See the README.

## Architecture

`commands/` and `mcp/` → `services/` → `http.ts` → network. Commands never build URLs and
services never print, which is what lets the CLI and the MCP server share every line of
business logic. Routes live in `endpoints.json`: a deprecation is fixed there, not in code.

## Rules

1. Every HTTP call goes through `src/http.ts` — no direct fetch in services or commands
2. `stdout` is data, `stderr` is logs and progress
3. A 200 carrying HTML means the route is gone; 401/403 means the session died. Do not
   confuse them — the first sends you to `endpoints.json`, the second to a new cookie
4. Colour is applied after padding, never before: ANSI escapes count as characters to
   `padEnd`, so colouring first breaks every column
