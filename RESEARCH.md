# RESEARCH — Coursera (Type B: session cookie via browser handoff)

Live recon: 2026-08-12, extended 2026-08-16 and 2026-08-17.
Verified against a real account with active enrollments. Control course:
`machine-learning-foundations-for-product-managers` (Duke), courseId
`Bob8HYsxEeuqDwqw9ez0Fw`.

---

## Portal map

| Portal | Base URL | Auth | Anti-bot | Content |
|---|---|---|---|---|
| Web | www.coursera.org | `CAUTH` cookie (domain `.coursera.org`) | CAPTCHA only on automated login | Catalog, materials, videos, subtitles |

Platform: internal API known as **"Naptime"** — every response shares the envelope
`{elements, paging, linked}`. The tree is never assembled: flat lists plus the ids that
stitch them together.

---

## Auth

Auth cookie: **`CAUTH`** (~601 chars).

⚠ **Do not confuse it with anonymous visitor cookies**: `__204u`, `csrf3-token`, `usertype`,
`__400v`. They appear without logging in and store a useless session.

### Method (browser handoff)

1. Playwright opens `coursera.org/?authMode=login` with `headless=False`
2. The human logs in **by hand** — scripting the typing triggers the CAPTCHA
   (that is how `coursera-download-with-selenium` died)
3. Poll `context.cookies()` until `CAUTH` shows up
4. Verify against a real endpoint before declaring it valid
5. Store it outside the repo

A persistent browser profile makes the second capture instant.

### TTL

**≥ 108 hours (4.5 days)** — measured 2026-08-17 against a session captured 2026-08-12 at
10:24, still returning JSON from `memberships.v1`.

Design consequence: login is **not** step 1 of a flow. A tool that reuses the existing
session works for days without human intervention. The upper bound is still unmeasured.

---

## Numbered gotchas

1. **`Accept: application/json` is mandatory.** Without it Coursera negotiates content and
   serves the SPA's HTML with **status 200**. A 200 with HTML does NOT mean the session is
   invalid — it means the request was malformed. 401/403 is what an invalid session looks
   like. Confusing the two costs hours.
2. **`typeName` is nested** under `contentSummary.typeName`, not at the item root. Asking
   for it flat returns `None` silently.
3. **`pscp` does not expand `~`** when copying to a VM — use absolute paths.
4. Companion headers: `X-Requested-With: XMLHttpRequest`, `Referer`.
5. **`subtitlesVtt` returns RELATIVE paths** (`/api/subtitleAssetProxy.v1/...`). HTTP
   clients reject them; the host has to be prepended.
6. **`sources.byResolution["1080p"]` is an object, not a URL.** It holds `mp4VideoUrl` /
   `webMVideoUrl`. Treating it as a string throws.
7. **Media URLs are SIGNED and expire.** Subtitles carry `?expiry=<ms>&hmac=<...>`; video
   carries CloudFront `?Expires=<s>&Signature=<...>`. Corollary: URLs cannot be cached and
   downloaded later — ask and fetch in the same pass. A course JSON saved yesterday holds
   dead links.
8. **`memberships.v1` truncates silently.** It returns `paging.total` (215 on the reference
   account) and `paging.next` as a string offset. With `limit=100` and no cursor walk, 54%
   of the library disappears without any error.
9. **A hand-set `Cookie` header is dropped by PowerShell 5.1.** `Invoke-WebRequest
   -Headers @{Cookie=...}` returns 403 even with a valid cookie: a `CookieContainer` via
   `-WebSession` is required. Irrelevant to `fetch`, but it explains a false "dead session"
   while diagnosing from a terminal.
10. `.vtt` files arrive as **UTF-8**. PowerShell 5.1's `Get-Content` shows them as mojibake
    because of the ANSI codepage — that is display, not corruption. Check `read_bytes()`
    before "fixing" anything.

---

## Reading the three failure modes

Three different answers that are easy to lump together, and only the first means dead:

| Response | Meaning |
|---|---|
| 200 + the SPA's HTML (len 778) | The route **does not exist** |
| `405 {"msg":"Routing error: 'get-all' not implemented"}` | The resource **exists**, the `q=` finder is wrong |
| `404 {"message":"","statusCode":404}` | The resource exists, that id does not |

Under that rule, `onDemandCourseGrades.v1` and `onDemandLearnerMaterialItems.v1` **exist**
(both answer 405) — their finder names are still unknown. Course progress probably lives
there.

---

## Endpoint status

### Alive

| Endpoint | Returns |
|---|---|
| `memberships.v1` | Your enrollments. Accepts `courses.v1(...)` field selection |
| `courses.v1` | Course metadata. Accepts `fields=level,certificates,description,photoUrl,instructorIds,partnerIds` |
| `onDemandCourses.v1` | Metadata, description, courseId from slug |
| `onDemandCourseMaterials.v2` | modules → lessons → items tree |
| `onDemandLectureVideos.v1` | mp4 per resolution + srt/vtt subtitles |
| `onDemandSupplements.v1` | CML readings |
| `onDemandSpecializationMemberships.v1` | Your specializations; with `includes=s12nId` also their `courseIds` |
| `domains.v1` | 11 branches with `subdomainIds`, `keywords`, `description` |
| `partners.v1` | Universities: `name`, `shortName`, `location` |
| `instructors.v1` | Instructors: `fullName`, `title`, `department`, `bio` |
| `adminUserPermissions.v1` | Permissions |

### Dead (200 + HTML)

`onDemandCourseMaterials.v1` (**this is what killed `coursera-dl`**), `externalBasicProfiles.v1`,
`courseProgress.v1`, `onDemandEnrollments.v1`, `learnerCourseSummary.v1`,
`onDemandCourseCertificates.v1`, `onDemandSpecializationCertificates.v1`,
`onDemandAccomplishments.v1`, `certificates.v1`, `catalogResults.v1`, `catalogResults.v2`,
`search.v1`, `onDemandUserRecommendations.v1`, `onDemandCourseDerivatives.v1`,
`productRatings.v1`, `onDemandRatings.v1`, `onDemandCourseReviews.v1`,
`onDemandRelatedCourses.v1`, `onDemandCategories.v1`.

There is no known way to read certificates, ratings, review counts or catalog search
through this API. Public search moved to a GraphQL gateway (`/graphql-gateway`), which
answers 400 to an invented query: reverse-engineering that schema is a project of its own.

### Confirmed routes

```
GET /api/memberships.v1?q=me&includes=courseId,course
      &fields=courseId,courses.v1(name,slug,courseType,level,certificates,
              domainTypes,workload,primaryLanguages,partnerIds,instructorIds)
      &limit=100&start={cursor}
GET /api/courses.v1?q=slug&slug={slug}&fields=level,certificates,instructorIds,partnerIds
GET /api/onDemandCourseMaterials.v2/?q=slug&slug={slug}&includes=modules,lessons,items
GET /api/onDemandLectureVideos.v1/{courseId}~{itemId}?includes=video
GET /api/onDemandSupplements.v1/{courseId}~{itemId}?includes=asset&fields=content
GET /api/onDemandSpecializationMemberships.v1?q=me&includes=s12nId
      &fields=s12nId,onDemandSpecializations.v1(name,slug,courseIds)
GET /api/partners.v1?ids={ids}&fields=name,shortName,location
GET /api/instructors.v1?ids={ids}&fields=fullName,title,department
GET /api/domains.v1?limit=50
```

`itemId` is the URL segment: `/learn/{slug}/lecture/{itemId}/...`

---

## Field enumeration trick

`fields=` **silently ignores names that do not exist** — no error, no warning. That makes
enumeration cheap: ask for many candidates at once and see which come back.

Asking `courses.v1` for 30 candidate fields returned:
`courseType, description, photoUrl, id, slug, instructorIds, specializations, level,
partnerIds, certificates, name, courseStatus`.

And silently dropped: `difficultyLevel`, `enrollmentCount`, `learnerCount`, `averageRating`,
`ratingCount`, `avgLearningHours`, `skills`, `topics`, `verifiedCertificateCost`.

So: **there is a `level`, but no popularity, rating or enrollment count in this API.** The
same trick, applied wrongly, is what made an earlier round of this recon declare `level`
missing — it was requested under the wrong name and dropped without complaint.

---

## Measured data

### Content of the control course

- 6 modules, 69 items
- Item types: `lecture` (48), `supplement` (12), `staffGraded` (6), `discussionPrompt` (1),
  `coach` (1), `phasedPeer` (1). A binary video/reading filter loses 9 items, and the list
  of types is not closed — do not hardcode it.
- 29 subtitle languages, including `es` and `en`, served as `.srt` and `.vtt` by switching
  `fileExtension` in the signed query string
- No DRM, no Widevine, no CAPTCHA at the API layer

### The library (215 courses)

| Signal | Value |
|---|---|
| Branches | 9 of Coursera's 11 present; `business` 158, `data-science` 90, `computer-science` 35 |
| Levels | beginner 99, intermediate 66, advanced 7, **undeclared 43** |
| Institutions | 57 distinct partners |
| Specializations | 15, of which 2 complete |
| `workload` present | 174 of 215 |

### `workload` has no format

Each course team writes it their own way, in two languages:

```
"5 weeks of study, approximately 15 hours total"
"4 weeks of study, 2-3 hours/week"     "4 weeks of study, 3-4 hours a week"
"2 hours"     "1.5 hours"     "4-6 hours/week"     "2"
"4 semanas de estudio, 2-4 horas/semana"
"De 4 a 8 horas de videos, lecturas y exámenes"
"The course consists of 5 modules, each of which should take 3-5 hours of study time."
```

Lesson: **sampling 8 records is not enough to infer a grammar.** A parser written against
that sample read 67 of 174; widened, it reads 137. The remainder is genuinely ambiguous
(`"2"`, or hours per week without a week count) and returns null rather than inventing.

---

## Unlock architecture

### The problem: censorship at the aggregator, not at the microservice

For a course in **preview** or with locked weeks:

1. **In the web SPA:** links are hidden and modules 2, 3 and 4 show padlocks.
2. **In the aggregating API (`onDemandCourseMaterials.v2`):** the module and lesson lists
   still come back, but `contentSummary.typeName` is **censored** (empty or `unknown`) and
   item names are hidden.
3. **How traditional scrapers fail:**
   ```python
   # CLASSIC ERROR: skips 75% of the course
   if item.get("contentSummary", {}).get("typeName") not in ("lecture", "supplement"):
       continue
   ```
   Seeing `typeName == ""`, they discard future modules on the false assumption that they
   are empty.

### The four-step method

1. **Unfiltered structural mapping** — build the plan from every `itemId` hanging off each
   lesson, without filtering by `typeName`.
2. **Semantic title recovery** — when the aggregator returns `name: null` or `?`, derive the
   name from the parent lesson title plus the resource id.
3. **Dual probe to atomic microservices** — for each `itemId`, ask
   `onDemandLectureVideos.v1` first and `onDemandSupplements.v1` second. Whichever answers
   200 wins; if neither does, the item is recorded as skipped and the run continues.
4. **Polite rate limiting** — 0.5s between requests keeps CDN protections quiet.

---

## Design decision: transcripts-first

A 20-lesson course is ~2 GB as video and ~200 KB as `.vtt`. For synthesis, study, or
feeding a RAG/LLM pipeline, the transcript carries 100% of the semantic value at zero
network and storage cost. Video is opt-in.

---

## Anti-pattern to avoid

Do not hardcode routes. They belong in a versioned `endpoints.json`: when Coursera
deprecates another `.v2`, the fix is one line of data. That is exactly the debt that killed
`coursera-dl`.

---

## Open lead

[davidfurlong/Coursera-new-tab-extension](https://github.com/davidfurlong/Coursera-new-tab-extension)
claims to reverse-engineer course progress. If progress or completion data is ever needed,
start there — together with the two endpoints that answer 405 above.
