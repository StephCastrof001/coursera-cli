/** Domain vocabulary. Canonical definitions live in CONTEXT.md. */

/** Branch and sub-branch Coursera files a course under. A course can have several. */
export interface DomainRef {
  domainId: string;
  subdomainId?: string;
}

/** Difficulty as Coursera declares it. Many courses simply don't declare one. */
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/** A catalog course. `slug` is what a human types; `id` is what the API wants. */
export interface Course {
  id: string;
  slug: string;
  name: string;
  courseType?: string;
  level?: CourseLevel;
  /** e.g. ["VerifiedCert", "Specialization"] — what the course offers, not what you earned. */
  certificates?: string[];
  domainTypes?: DomainRef[];
  /** Effort as prose: "4 weeks of study, 2-3 hours/week". Not a number. */
  workload?: string;
  primaryLanguages?: string[];
  partnerIds?: string[];
  instructorIds?: string[];
}

/** The university or company behind a course. */
export interface Partner {
  id: string;
  name: string;
  shortName?: string;
  location?: { country?: string; city?: string; name?: string };
}

export interface Instructor {
  id: string;
  fullName: string;
  title?: string;
  department?: string;
}

/** Smallest unit of content: a video, a reading, a quiz. Its id unlocks everything. */
export interface Item {
  id: string;
  name: string;
  slug?: string;
  /** "" or "unknown" when the aggregator censors the type (preview courses). */
  type: string;
}

export interface Lesson {
  id: string;
  name: string;
  items: Item[];
}

export interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
}

/** The course tree, rebuilt from the flat lists in `linked`. */
export interface Outline {
  courseId: string;
  slug: string;
  modules: Module[];
}

/** A planned download: the item plus where it sits in the tree, for file naming. */
export interface PlannedItem {
  itemId: string;
  name: string;
  type: string;
  moduleIndex: number;
  moduleName: string;
  lessonName: string;
  itemIndex: number;
}

/** Envelope shared by every response of Coursera's internal API ("Naptime"). */
export interface Envelope<E = unknown> {
  elements?: E[];
  paging?: { next?: string; total?: number };
  linked?: Record<string, unknown[]>;
}
