# CONTEXT — domain language

The project's glossary. No implementation details: if something describes *how* it is
built, it belongs in `SPEC.md` or `RESEARCH.md`.

---

## Membership

The link between an account and a course. **It is not the course.** An element of
`memberships.v1` is a membership: it says this account is attached to this course with a
`role` (`LEARNER`). It says nothing about content or progress.

The reference account holds **215 memberships**.

## Course

The content: name, syllabus, materials. It arrives under `linked` as `courses.v1`, not in
`elements`. When the user says "my courses" they mean the courses their memberships reach.

## Slug

The readable identifier in the URL: `machine-learning-foundations-for-product-managers`.
It is what a person types and what every command accepts.

## courseId

The internal identifier, a hash: `Bob8HYsxEeuqDwqw9ez0Fw`. It is what the API demands. The
user never types it: `courses --search` translates slug to id.

## Branch and sub-branch

Coursera's own taxonomy: 11 branches (`business`, `data-science`, `computer-science`…),
each with sub-branches (`machine-learning`, `finance`, `design-and-product`…). A course can
belong to several. **A branch is not a category of ours** — it is Coursera's, and it is
reported as given.

## Level

Declared difficulty: `BEGINNER`, `INTERMEDIATE` or `ADVANCED`. Many courses declare none,
and that absence is its own value — never inferred from anything else.

## Workload

Effort as free text, written by each course team: "4 weeks of study, 2-3 hours/week",
"2 hours", "4 semanas de estudio, 2-4 horas/semana". It is prose, not a number. Turning it
into hours is an estimate, and where the text is ambiguous the estimate is refused.

## Specialization

An ordered sequence of courses leading to a joint certificate. It is where real progression
lives: since Coursera does not rank difficulty reliably, the order of courses inside a
specialization is the closest thing to a learning path.

The reference account belongs to **15 specializations**.

## Institution and instructor

The university or company behind a course (`partners.v1`) and who teaches it
(`instructors.v1`). Neither rides along with a course listing: both are separate lookups.

## Module → Lesson → Item

The syllabus hierarchy. **Item** is the smallest unit — a video, a reading, a quiz — and its
`itemId` unlocks everything else: without it you cannot request a subtitle or a supplement.

## Item type

What kind of content it is: `lecture`, `supplement`, `staffGraded`, `discussionPrompt`,
`coach`, `phasedPeer`. Plus a seventh value that does not come from Coursera:

## unknown

An item whose type the aggregator **censored** — returned empty — because the course is in
preview or that week is locked. `unknown` means "I don't know what this is", never "this is
empty". Treating it as discardable is the mistake that makes an extractor skip 75% of a
course.

## Transcript

The text of a video, derived from its `.vtt` subtitles. It is the main product: a course is
gigabytes as video and ~130 KB as transcripts, and for studying or summarizing the text
carries all the signal. A transcript is **not** the raw `.vtt`: it is the cleaned text,
without timestamps or cue marks.

## Reading

The non-video content of a `supplement` item. It arrives as CML (Coursera's own markup) and
is stored as markdown.

## Session

The `CAUTH` cookie that authenticates every call. A session can be **captured** (present on
disk) and still be **dead** — capturing is not working, which is why it is verified against
a real endpoint before being trusted. It lasts days, not hours.

## Probe

Asking a microservice about one item directly instead of trusting what the aggregator said.
It is how an `unknown` item gets identified: if the video service answers, it was a video.

## Manifest

The index of what a course folder holds. It exists because media URLs expire: without it
there would be no way to find an already-downloaded item again without asking the API for
everything anew.
