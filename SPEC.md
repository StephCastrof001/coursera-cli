# SPEC — coursera-cli

> Status: v0.2.0 implemented and verified against the live API on 2026-08-17.
> The backlog derived from this spec lives as issues in
> [StephCastrof001/coursera-cli](https://github.com/StephCastrof001/coursera-cli/issues),
> labelled `ready-for-agent`. This document holds the decisions; the issues are the
> executable slices.

---

## Problem statement

I have 215 Coursera courses, and the part I care about — what the videos say and what the
readings contain — is locked inside a single-page app. To study, summarize, or feed a note
system, I need the text, and today the only way is opening a browser and going class by
class.

A Python recon repo (`coursera_recon`) already solved the hard part: it found the internal
API, the session cookie, the live endpoints, and how to unlock modules the web shows with a
padlock. But it is a pile of scripts you must run in order, from their folder, with a
Python environment set up. It is not a tool: it is an experiment that worked.

None of it is reachable by an agent either. When I want to ask Claude "what did the pricing
course say about elasticity?", Claude has no way to look.

And with 215 courses, a second problem sits on top of the first: I cannot see my own
library. I do not know what I actually studied, what I left half-finished, or how much of
it overlaps.

## Solution

One installable CLI and one MCP server over the same logic:

- **From the terminal:** `coursera courses --search pricing` finds the course,
  `coursera map` shows what the library is made of, `coursera transcript <slug>` pulls the
  content to a folder.
- **From Claude Code:** the same capabilities as MCP tools, so the agent can search, map and
  read inside the conversation without me typing commands.

Default output is **transcripts, not video**: a course is gigabytes as MP4 and ~130 KB as
text, and the text carries the signal.

## User stories

1. As a learner with 215 courses, I want to search a course by name, so that I do not have to remember its slug.
2. As a learner, I want search to cover all 215 courses and not just the first 100, so that nothing is hidden from me silently.
3. As a learner, I want to search without typing accents, so that "analitica" finds "Analítica".
4. As a learner, I want multi-word searches without quotes, so that `--search machine learning` does what it looks like.
5. As a learner, I want to filter by declared difficulty, so that I can find something at my level.
6. As a learner, I want to filter by branch, so that I can look only at data science.
7. As a learner, I want to filter by language, so that I can pick a course in Spanish.
8. As a learner, I want to filter by estimated hours, so that I can find something I can finish this week.
9. As a learner, I want to filter by university, so that I can see everything I took from one institution.
10. As a learner, I want to see the syllabus before downloading, so that I can judge whether it is worth it.
11. As a learner, I want to know who teaches a course and which institution backs it, so that I can weigh its authority.
12. As a learner, I want a map of my library by branch, so that I can see what I actually studied rather than what I think I studied.
13. As a learner, I want to see how far along each specialization is, so that I can finish one instead of starting another.
14. As a learner, I want the map to tell me which institutions my library comes from, so that I know where my education actually came from.
15. As a learner, I want estimated hours per branch, so that I can compare where my time went.
16. As a learner, I want the tool to say when hours are unknown, so that I do not read an estimate as a fact.
17. As a learner, I want to download a course's transcripts with one command, so that I have the content as text.
18. As a learner, I want readings downloaded too, not just videos, because part of the content is not audiovisual.
19. As a learner in a course with locked weeks, I want it to try the padlocked modules anyway, because the API serves them even when the web hides them.
20. As a learner, I want to choose the subtitle language, so that I can read in Spanish where it exists.
21. As a learner, I want a fallback language rather than a skipped video, because a transcript in English beats no transcript.
22. As a learner, I want files organized by module and in order, so that I can read them like a book.
23. As a learner, I want to choose where they are saved, so that I can put them in my notes repo.
24. As a learner, I want a course downloaded to a custom folder to still be readable later, so that `--out` does not hide it from me.
25. As a learner, I want to download only the first N items, so that I can try a course before committing to it.
26. As a learner, I want to know whether my session is alive before I start, so that a download does not die halfway.
27. As a learner, I want one command that diagnoses everything, so that a failure names its own cause.
28. As a learner, I want to know how old my session is, so that I learn how long it really lasts.
29. As a user of the Python recon repo, I want the CLI to reuse the session I already captured, so that I do not log in again.
30. As a user on a headless server, I want to pass the cookie through an environment variable, so that it runs on EC2.
31. As an agent, I want to list the user's courses as a tool, so that I can answer "what do I have on X?" without asking them to run anything.
32. As an agent, I want the same filters the human has, so that I can narrow down without pulling 215 rows into context.
33. As an agent, I want the library map as a tool, so that I can reason about what they studied.
34. As an agent, I want a course outline, so that I know what exists before reading.
35. As an agent, I want to trigger a download, so that I can work on the content.
36. As an agent, I want the download to return an index rather than the text, so that I do not burn the context window.
37. As an agent, I want to read one item by id or by name, so that I can quote exactly what I need.
38. As an agent, I want typed errors with a code and a hint, so that I can decide what to do without parsing prose.
39. As a scripter, I want `--json` on every command, so that I can pipe into `jq`.
40. As a scripter, I want the CLI to detect a pipe on its own, so that I do not have to pass the flag every time.
41. As a maintainer, I want API routes in a data file, so that a deprecation is fixed without touching code.
42. As a maintainer, I want tests against real API responses, so that a shape change does not slip through.
43. As a maintainer, I want a long download to survive one failing item, so that 60 others are not lost.
44. As a maintainer, I want a changelog, so that the difference between versions is legible.
45. As a user, I want progress feedback during a download, so that I know it has not hung.
46. As a user, I want filenames that survive Windows, so that nothing breaks on a `?` or a `:` in a title.
47. As a privacy-minded user, I want the cookie never written into the repo, because it is a live credential.

## Implementation decisions

**Location and runtime.** The repo is standalone and lives at the top level, not nested
inside the `klipso_reverse` factory. It still follows the factory's conventions and ADRs,
but it has its own git remote, so nesting it under a `.gitignore`d directory of another
repo bought nothing and cost three levels of path on every invocation. Runtime is **Bun** (this CLI is
API-heavy: fetch plus JSON). The Bun binary is not on the PATH of the process that launches
MCP servers — point 2 of ADR-0001 — so every programmatic invocation uses the absolute path
to the `.exe`.

**Layers.** Four, with one direction of dependency: `commands/` and `mcp/` → `services/` →
`http.ts` → network. Commands do not build URLs and services do not print. That is what lets
MCP and CLI share 100% of the logic.

**Framework blocks.** The presentation, error, path and health-check layers come from the
cligentic registry (`json-mode`, `error-map`, `xdg-paths`, `global-flags`, `next-steps`,
`doctor`, `audit-log`, `detect`) copied into `src/cli/`, rather than hand-rolled. The trust
ladder and killswitch blocks are deliberately **not** installed: they gate mutating
operations, and this CLI only reads. Coursera exposes no way to buy, enroll or delete
through this API, so there is nothing to authorize.

**Routes as data.** `endpoints.json` holds every route with placeholders. When Coursera
deprecates a version, the fix is one line of data — the debt that killed `coursera-dl`.

**Session with three sources, in order:** `COURSERA_CAUTH` env var → this CLI's store → the
Python recon repo's store. The third exists because the cookie lasts days and forcing a
re-login would be free for nobody. The legacy store is read, never written.

**Typed errors.** `AppError` carries `code` and `hint`. The critical distinction comes from
the recon: a **200 with HTML** means the route is gone or the request was malformed, **not**
that the session died; a dead session is 401/403.

**Real pagination.** `memberships.v1` reports `paging.total` and `paging.next`. With 215
memberships and `limit=100`, not walking the cursor drops 54% without warning.

**Tree reconstruction.** The API sends three flat lists in `linked` plus the ids that stitch
them. Two recon traps are covered: `typeName` lives under `contentSummary`, and missing or
nameless items inherit their parent lesson's title.

**Unlock by polymorphic probing.** The plan is never filtered by `typeName`: preview courses
have that field censored, and filtering early discards whole modules as if they were empty.
Each item is probed against `onDemandLectureVideos.v1` and then `onDemandSupplements.v1`.
Whatever answers 200 wins; anything else is recorded as skipped and the run continues. An
`unknown` is **never** filtered, not even when the caller asks for `lecture` only.

**Single-pass download.** Media URLs are signed with an expiry, so planning today and
downloading tomorrow is impossible. Ask and fetch in the same pass, 500 ms apart.

**Manifest plus location index.** Each course folder carries a `manifest.json`; a separate
index records where each course was last downloaded. Together they let `read_transcript`
find an item later without returning to the API, and let `--out` work without hiding a
course from the reader.

**Metadata beyond the syllabus.** `courses.v1` accepts a `fields=` selection that includes
`level`, `certificates`, `partnerIds` and `instructorIds`, and the same selection works
inside `memberships.v1` — so the whole library's metadata costs 3 requests, not 215.
Institutions and instructors do not ride along and are resolved in batched lookups against
`partners.v1` and `instructors.v1`.

**Declared, never inferred.** `level` is reported exactly as Coursera declares it, and
"undeclared" is its own bucket. Estimated hours are labelled as estimates, and the count of
courses whose workload cannot be read is printed alongside them.

**MCP surface: six granular tools**, not one tool with a subcommand — the pattern
`_knowledge/cli-vs-mcp.md` marks as better for agents:

| Tool | Returns |
|---|---|
| `session_status` | source, age, alive, total courses |
| `list_courses` | filtered courses with level and estimated hours |
| `get_library_map` | branches, levels, institutions, specialization progress |
| `get_course_outline` | full tree plus institution, instructors and level |
| `fetch_transcripts` | **index** of what was downloaded: paths and sizes, never text |
| `read_transcript` | the text of **one** item, by id or by part of its name |

The split between the last two is deliberate: a course is ~130 KB (≈35k tokens). Returning
it whole would blow up a conversation in two calls.

**Agent-first output.** Every command supports `--json`, and piped stdout switches to JSON
on its own through the `json-mode` block. Without machine-readable output a CLI is not
usable by an agent.

## Testing decisions

**What makes a good test here:** it verifies observable behavior against real API data.
Fixtures in `test/fixtures/` are responses **captured live**, with signed query strings
redacted. A test that passes against invented JSON proves nothing about Coursera.

**Single seam:** the pure functions in `src/services/`, which turn the raw envelope into
domain objects. HTTP is injected as a `Client` interface, so tests touch neither network nor
session. Everything else — commands, MCP — is thin wiring over that seam.

**Covered (76 tests):**
- `memberships`: extraction from `linked`, real total vs page, cursor, broken entries,
  accent-insensitive search, relevance ordering, and every filter including their AND
  composition and the rule that an unreadable workload excludes a course from `--hours`.
- `courses`: tree reconstruction, nested `typeName`, `moduleIds` ordering, item count,
  censored item → `unknown` inheriting its lesson name, type filtering, and the rule that
  `unknown` is never filtered.
- `library`: the workload grammar (nine shapes, both languages, and the ambiguous cases that
  must return null), level tally with its undeclared bucket, branch grouping including
  double-counting rules, and specialization progress.
- `partners`: institution and instructor parsing, id collection and deduplication, ranking,
  unresolved ids labelled rather than dropped, and name lookup.
- `flags`: multi-word values, boolean flags that must not swallow the next token,
  positional arguments.

**Deliberately not unit tested:** the download loop and the MCP transport. Both are verified
by real runs against the API, which is where they actually break.

## Out of scope

- **MP4 video.** The pipeline is there (`sources.byResolution`); v1 does not expose it.
- **Obsidian vault and knowledge graph.** The Python repo generates them; that is knowledge
  modelling, a different layer.
- **Browser login.** The CLI reuses an existing session. When it expires you still need
  `capture_session.py` from the recon repo. Issue #3.
- **Course progress and certificates.** No known endpoint returns them, though two answer
  405 and are therefore worth a spike.
- **Catalog search and recommendations.** Public search moved to a GraphQL gateway;
  reverse-engineering it is a separate project.
- **Ratings and popularity.** Not exposed by this API at all — verified by field enumeration.
- **Quizzes, grades and forums.** Videos and readings only.
- **Resumable downloads.** Each run is complete. Issue #4.

## Verification

| Criterion | Result |
|---|---|
| Full pagination | **215/215 courses**. `fundamentals-machine-learning-in-finance` sits at row 131: invisible under the 100-row truncation |
| Real download | **8 of 8 items, 0 skipped, 0 empty files**, 15.9 KB. Mixed: 4 Spanish lectures + 4 readings |
| MCP end to end | **6 tools listed and answering** against a real MCP client: `list_courses(level=ADVANCED)` → 7 of 215, `get_library_map` → 9 branches, 57 institutions, 15 specializations |
| Diagnosis | `doctor` → 5/5 checks passed, session 108.2 h old and alive |
| Tests | 76 passing, typecheck clean |
