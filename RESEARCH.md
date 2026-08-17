# RESEARCH — Coursera (Tipo B: cookie de sesión vía browser)

Recon en vivo: 2026-08-12. Curso de prueba: `conquistaaudienciasconiag`.
Verificado contra cuenta propia con enrollment activo.

---

## Portal Map

| Portal | URL Base | Auth | Anti-bot | Contenido |
|---|---|---|---|---|
| Web | www.coursera.org | Cookie `CAUTH` (dominio `.coursera.org`) | CAPTCHA solo en login automatizado | Catálogo, materiales, videos, subtítulos |

Plataforma: **API interna "Naptime"** — todas las respuestas comparten el
envelope `{elements, paging, linked}`.

---

## Auth Flow

Cookie de auth: **`CAUTH`** (~601 chars).

⚠ **No confundir con cookies de visitante anónimo**: `__204u`, `csrf3-token`,
`usertype`, `__400v`. Aparecen sin login y guardan una sesión inútil.

### Método (browser handoff)
1. Playwright abre `coursera.org/?authMode=login` con `headless=False`
2. Usuario se loguea **a mano** — automatizar el tipeo dispara CAPTCHA
   (así murió `coursera-download-with-selenium`)
3. Polear `context.cookies()` hasta encontrar `CAUTH`
4. Verificar contra un endpoint real antes de declararla válida
5. Guardar en `~/.config/coursera_recon/session.json`

Perfil persistente en `~/.config/coursera_recon/browser_profile` → la segunda
captura es instantánea.

### TTL
**≥ 104 horas (4.3 días)** — medido 2026-08-16 contra una sesión capturada el 2026-08-12
a las 10:24. Seguía devolviendo JSON en `memberships.v1`.

Consecuencia de diseño: el login **no** es el paso 1 de un flujo. Una herramienta que
reusa la sesión existente funciona días sin intervención humana. El límite superior
sigue sin medirse.

---

## Gotchas numerados

1. **`Accept: application/json` es obligatorio.** Sin él, Coursera negocia
   contenido y devuelve el HTML de la SPA con **status 200**. Un 200 con HTML
   NO significa sesión inválida — significa request mal armado. Un 401/403 sí
   sería sesión inválida. Confundirlos cuesta horas.
2. **`typeName` vive anidado** en `contentSummary.typeName`, no en la raíz del
   item. Pedirlo plano devuelve `None` en silencio.
3. **`pscp` no expande `~`** al copiar a una VM — usar ruta absoluta.
4. Headers que acompañan: `X-Requested-With: XMLHttpRequest`, `Referer`.
5. **`subtitlesVtt` devuelve rutas RELATIVAS** (`/api/subtitleAssetProxy.v1/...`).
   `requests` las rechaza con `MissingSchema`. Hay que anteponer el host.
6. **`sources.byResolution["1080p"]` es un dict, no una URL.** Contiene
   `mp4VideoUrl` / `webMVideoUrl`. Tratarlo como string revienta con
   `TypeError: unhashable type: 'slice'`.
7. **Las URLs de media van FIRMADAS y expiran.** Subtítulos con
   `?expiry=<ms>&hmac=<...>`; video con CloudFront `?Expires=<s>&Signature=<...>`.
   Corolario: no se pueden cachear las URLs y descargar después — hay que pedir
   y bajar en la misma pasada. Un JSON de curso guardado ayer tiene links muertos.
8. **`memberships.v1` trunca en silencio.** Devuelve `paging.total` (215 en la cuenta de
   referencia) y `paging.next` como offset en string. Con `limit=100` y sin recorrer el
   cursor, se pierde el 54% de la biblioteca sin ningún error. Verificado 2026-08-16.
9. **El header `Cookie` puesto a mano se descarta en PowerShell 5.1.** `Invoke-WebRequest
   -Headers @{Cookie=...}` da 403 aunque la cookie sea válida: hay que usar un
   `CookieContainer` vía `-WebSession`. No afecta a `fetch` en TS/Bun, pero explica
   un falso "sesión muerta" al diagnosticar desde la terminal.
10. Los archivos `.vtt` llegan en **UTF-8**. `Get-Content` de PowerShell 5.1 los
   muestra como mojibake (`mÃ³dulo`) por codepage ANSI — es display, no
   corrupción. Verificar con `read_bytes()` antes de "arreglar" nada.

---

## Endpoints — estado verificado 2026-08-12

| Endpoint | Estado | Devuelve |
|---|---|---|
| `onDemandCourseMaterials.v2` | ✅ VIVO | árbol módulos→lecciones→items |
| `onDemandCourses.v1` | ✅ VIVO | metadata, descripción, courseId desde slug |
| `onDemandLectureVideos.v1` | ✅ VIVO | mp4 por resolución + subtítulos srt/vtt |
| `memberships.v1` | ✅ VIVO | los cursos en los que estás inscrita |
| `adminUserPermissions.v1` | ✅ VIVO | permisos |
| `onDemandCourseMaterials.v1` | ❌ MUERTO | 200 + HTML — **esto mató a `coursera-dl`** |
| `externalBasicProfiles.v1` | ❌ MUERTO | 200 + HTML |
| `/api/users/v1/me/enrollments` | ❌ 404 | el flujo OAuth2 del Developer Console ya no existe |
| `onDemandReferences.v1` | ⚠ 405 | existe, verbo equivocado |
| `onDemandCourseMaterialItems.v2` | ⚠ | params equivocados, no confirmado muerto |

### Rutas confirmadas

```
GET /api/onDemandCourses.v1/?q=slug&slug={slug}
GET /api/onDemandCourseMaterials.v2/?q=slug&slug={slug}
      &includes=modules,lessons,items
      &fields=moduleIds,
              onDemandCourseMaterialModules.v1(name,slug,lessonIds),
              onDemandCourseMaterialLessons.v1(name,slug,itemIds),
              onDemandCourseMaterialItems.v2(name,slug,contentSummary)
GET /api/onDemandLectureVideos.v1/{courseId}~{itemId}
      ?includes=video
      &fields=onDemandVideos.v1(sources,subtitles,subtitlesVtt)
GET /api/memberships.v1?q=me&includes=courseId,course
      &fields=courseId,course.v1(name,slug,courseType)&limit=100
```

`itemId` es el segmento de la URL: `/learn/{slug}/lecture/{itemId}/...`

---

## Contenido disponible (medido)

Curso `conquistaaudienciasconiag` — courseId `MQQf3JsJEfCPiQr_2dbk-Q`:

- 48 items, 18 de tipo `lecture`
- Otros tipos: `supplement` (lecturas CML), quizzes
- Video `DSzDu`: mp4 en `1080p / 720p / 540p / 360p / 240p`
- Subtítulos: `es` y `es-LA` en **srt** y **vtt**
- **Sin DRM, sin Widevine, sin CAPTCHA en la capa de API**
- ⚠ Corrección a una nota anterior: las URLs de media **sí** van firmadas
  (hmac / CloudFront Signature) con expiry. No hay DRM, pero tampoco son
  links permanentes. Ver gotcha 7.

### Corrida real (2026-08-12)
26 archivos `.vtt` (`es` + `es-LA`), 128.7 KB, 0 vacíos, 4 carpetas de módulo.
Todo el curso en texto pesa menos que un solo frame en 1080p.

---

## Decisión de diseño: transcripts-first

Un curso de 18 videos ≈ varios GB en mp4, contra ~200 KB en `.vtt`. Para
resumir, generar flashcards o montar RAG, el mp4 no aporta señal extra sobre
el transcript. Default del descargador = subtítulos + estructura; video
opt-in con `--videos`.

---

## Anti-patrón a evitar

No hardcodear rutas en el código. Van en `endpoints.json` versionado: cuando
Coursera vuelva a deprecar una `.v2`, el fix es una línea de datos. Esa fue
exactamente la deuda que mató a `coursera-dl`.

---

## Ronda 2 de recon — 2026-08-16

### Estado del curso: no existe endpoint conocido

Buscando de dónde sacar si un curso está activo / completado / abandonado:

| Candidato | Resultado |
|---|---|
| `memberships.v1` elements | Sólo `{role, id, userId, courseId}`. `role` siempre `LEARNER` |
| `memberships.v1?includes=...,grade` | Acepta el include y lo ignora: mismos 4 campos |
| `onDemandCourseGrades.v1/{userId}~{courseId}` | ❌ 404 |
| `courseProgress.v1/{userId}~{courseId}` | ❌ 200 + HTML (muerto) |
| `onDemandEnrollments.v1?q=me` | ❌ 200 + HTML (muerto) |
| `learnerCourseSummary.v1?q=me` | ❌ 200 + HTML (muerto) |
| `onDemandLearnerSessions.v1?q=findByLearnerAndCourse` | ⚠ 405 — existe, verbo equivocado |

Pista sin explorar: [davidfurlong/Coursera-new-tab-extension](https://github.com/davidfurlong/Coursera-new-tab-extension)
dice hacer reverse engineering del progreso de curso. Empezar ahí si algún día hace falta.

### Censo de tipos de item

Curso `machine-learning-foundations-for-product-managers` — courseId `Bob8HYsxEeuqDwqw9ez0Fw`,
6 módulos, 69 items:

| typeName | Cantidad |
|---|---|
| `lecture` | 48 |
| `supplement` | 12 |
| `staffGraded` | 6 |
| `discussionPrompt` | 1 |
| `coach` | 1 |
| `phasedPeer` | 1 |

Un filtro binario video/lectura se come 9 items. Y `staffGraded` / `phasedPeer` no aparecían
en el recon del curso anterior: la lista de tipos no es cerrada, no hardcodearla.

### Ramas, esfuerzo y especializaciones — 2026-08-16

**Corrección de método:** en la ronda 2 di por muertos varios endpoints leyendo mal la
respuesta. Las tres son distintas y hay que separarlas:

| Respuesta | Significa |
|---|---|
| 200 + HTML de la SPA (len 778) | La ruta **no existe** |
| `405 {"msg":"Routing error: 'get-all' not implemented"}` | El recurso **existe**, falta el finder `q=` correcto |
| `404 {"message":"","statusCode":404}` | El recurso existe, ese id no |

Con ese criterio, `onDemandCourseGrades.v1` y `onDemandLearnerMaterialItems.v1` **existen**
(dan 405) — falta descubrir sus finders. Ahí probablemente viva el progreso del curso.

#### Vivos y útiles

| Endpoint | Devuelve |
|---|---|
| `domains.v1` | ✅ 11 ramas con `subdomainIds`, `keywords`, `description` |
| `courses.v1` (≠ `onDemandCourses.v1`) | ✅ acepta `fields=domainTypes,workload,primaryLanguages,partnerIds` |
| `memberships.v1` con `courses.v1(...)` | ✅ trae rama y workload de los 215 cursos en **3 requests**, no 215 |
| `onDemandSpecializationMemberships.v1` | ✅ 15 especializaciones; con `includes=s12nId` + `onDemandSpecializations.v1(name,slug,courseIds)` trae sus cursos |

`fields=` **ignora en silencio los campos que no existen** — no devuelve error. Por eso
`difficultyLevel` no está: se pidió y no vino, sin queja. No hay dificultad en esta API.

#### Muertos confirmados (200 + HTML)

`onDemandCourseCertificates.v1`, `onDemandSpecializationCertificates.v1`,
`onDemandAccomplishments.v1`, `certificates.v1`, `catalogResults.v1/v2`, `search.v1`,
`onDemandUserRecommendations.v1`, `onDemandCourseDerivatives.v1`, `courseProgress.v1`.

No hay forma conocida de leer certificados ni de buscar en el catálogo por esta API. La
búsqueda pública migró a un gateway GraphQL (`/graphql-gateway`), que responde 400 a una
query inventada: reversearlo es un proyecto aparte.

#### El campo `workload` no tiene formato

Medido sobre los 215 cursos: **174 lo traen, 41 no**. De los 174, la primera versión del
parser sólo entendía 67. Los equipos de cada curso lo escriben como quieren, en dos idiomas:

```
"5 weeks of study, approximately 15 hours total"
"4 weeks of study, 2-3 hours/week"     "4 weeks of study, 3-4 hours a week"
"2 hours"     "1.5 hours"     "4-6 hours/week"     "2"
"4 semanas de estudio, 2-4 horas/semana"
"De 4 a 8 horas de videos, lecturas y exámenes"
"The course consists of 5 modules, each of which should take 3-5 hours of study time."
```

Lección: **muestrear 8 registros no alcanza para inferir una gramática.** La segunda versión
llega a 137 de 174 (79%); el resto es genuinamente ambiguo (`"2"`, o horas por semana sin
decir cuántas semanas) y devuelve `null` antes que inventar.

### Subtítulos disponibles

29 idiomas en el curso de Duke (incluye `es`, `en`, `pt-BR`, `zh-CN`, `ja`, `ar`). El mismo
asset se sirve como `.srt` y `.vtt` cambiando `fileExtension` en el querystring firmado.
