# CONTEXT — lenguaje del dominio

Glosario del proyecto. Sin detalles de implementación: si algo describe *cómo* está hecho,
va en `SPEC.md` o `RESEARCH.md`, no acá.

---

## Membership

El vínculo entre una cuenta y un curso. **No es el curso.** Un `element` de
`memberships.v1` es una membership: dice que esta cuenta está asociada a este curso, con
un `role` (`LEARNER`). No dice nada sobre el contenido ni sobre el avance.

La cuenta de referencia tiene **215 memberships**.

## Curso

El contenido: nombre, temario, materiales. Vive en `linked` bajo `courses.v1`, no en
`elements`. Cuando el usuario dice "mis cursos" se refiere a los cursos alcanzados por sus
memberships.

## Slug

El identificador legible que aparece en la URL: `machine-learning-foundations-for-product-managers`.
Es lo que escribe una persona y lo que aceptan todos los comandos.

## courseId

El identificador interno, un hash: `Bob8HYsxEeuqDwqw9ez0Fw`. Es lo que exige la API para
pedir contenido. El usuario nunca lo escribe: `courses --buscar` traduce de slug a id.

## Módulo → Lección → Item

La jerarquía del temario. **Item** es la unidad mínima —un video, una lectura, un quiz— y su
`itemId` es la llave de todo lo demás: sin él no se puede pedir ni un subtítulo ni un
suplemento.

## Tipo de item

Qué clase de contenido es: `lecture`, `supplement`, `staffGraded`, `discussionPrompt`,
`coach`, `phasedPeer`. Y un séptimo valor que no viene de Coursera:

## unknown

Un item cuyo tipo el agregador **censuró** —lo devuelve vacío— porque el curso está en
preview o esa semana está bloqueada. `unknown` significa "no sé qué es", nunca "está vacío".
Tratarlo como descartable es el error que hace que un extractor se salte el 75% de un curso.

## Transcript

El texto de un video, derivado de sus subtítulos `.vtt`. Es el producto principal: un curso
pesa gigabytes en video y ~130 KB en transcripts, y para estudiar o resumir el texto tiene
toda la señal. Un transcript **no** es el archivo `.vtt` crudo: es el texto ya limpio, sin
timestamps ni marcas de cue.

## Lectura

El contenido no audiovisual de un item `supplement`. Llega como CML (el formato de markup
propio de Coursera) y se guarda como markdown.

## Sesión

La cookie `CAUTH` que autentica todas las llamadas. Una sesión puede estar **capturada**
(existe en disco) y aun así **muerta** — capturar no es funcionar, por eso se verifica
contra un endpoint real antes de darla por buena. Dura días, no horas.

## Sondeo

Preguntarle directo a un microservicio por un item, en vez de confiar en lo que dijo el
agregador. Es la forma de averiguar qué es un item `unknown`: si el servicio de videos
responde, era un video.

## Manifiesto

El índice de lo que quedó bajado en una carpeta de curso. Existe porque las URLs de media
expiran: sin manifiesto no habría forma de volver a encontrar un item ya descargado sin
pedirle todo de nuevo a la API.
