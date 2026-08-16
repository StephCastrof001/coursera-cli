/** Vocabulario del dominio. Ver CONTEXT.md para las definiciones canónicas. */

/** Un curso del catálogo. `slug` es lo que escribe el humano; `id` lo que pide la API. */
export interface Course {
  id: string;
  slug: string;
  name: string;
  courseType?: string;
}

/** Unidad mínima de contenido: video, lectura, quiz. Su id es la llave de todo. */
export interface Item {
  id: string;
  name: string;
  slug?: string;
  /** "" o "unknown" cuando el agregador censura el tipo (curso en preview). */
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

/** El árbol del curso reconstruido desde las listas planas de `linked`. */
export interface Outline {
  courseId: string;
  slug: string;
  modules: Module[];
}

/** Una descarga planificada: item + su ubicación en el árbol, para nombrar archivos. */
export interface PlannedItem {
  itemId: string;
  name: string;
  type: string;
  moduleIndex: number;
  moduleName: string;
  lessonName: string;
  itemIndex: number;
}

/** Envelope común de la API interna de Coursera ("Naptime"). */
export interface Envelope<E = unknown> {
  elements?: E[];
  paging?: { next?: string; total?: number };
  linked?: Record<string, unknown[]>;
}
