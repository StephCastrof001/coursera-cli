# SPEC — coursera-cli v1

> Estado: implementado y verificado 2026-08-16. Ver §Verificación al final.
> No hay issue tracker configurado en este entorno, así que el spec vive en el repo
> en vez de publicarse como issue con label `ready-for-agent`.

---

## Problem Statement

Tengo 215 cursos en Coursera y el contenido que me interesa —lo que dicen los videos y
las lecturas— está encerrado en una SPA. Para estudiar, resumir o alimentar un sistema
de notas necesito el texto, y hoy la única forma es abrir el navegador, ir clase por
clase y copiar a mano.

Existe un repo de recon en Python (`coursera_recon`) que ya resolvió la parte difícil:
descubrió la API interna, la cookie de sesión, los endpoints vivos y cómo desbloquear
módulos que la web muestra con candado. Pero es un conjunto de scripts sueltos que hay
que correr en orden, desde su carpeta, con el entorno de Python armado. No es una
herramienta: es un experimento que funcionó.

Además, nada de eso es accesible para un agente. Cuando quiero preguntarle a Claude
"¿qué vi en el curso de pricing sobre elasticidad?", Claude no tiene forma de mirar.

## Solution

Un CLI instalable y un servidor MCP sobre la misma lógica:

- **Desde la terminal:** `coursera courses --buscar "pricing"` encuentra el curso,
  `coursera transcript <slug>` baja sus transcripts y lecturas a una carpeta.
- **Desde Claude Code:** las mismas capacidades como tools MCP, para que el agente
  busque cursos y lea contenido dentro de la conversación, sin que yo escriba comandos.

El default es **transcripts, no video**: un curso pesa gigabytes en mp4 y ~130 KB en
texto, y para estudiar o resumir el texto tiene toda la señal.

## User Stories

1. Como estudiante con 215 cursos, quiero buscar un curso por nombre, para no tener que recordar su slug ni buscarlo en la web.
2. Como estudiante, quiero que la búsqueda mire mis 215 cursos y no sólo los primeros 100, para que no me oculte cursos en silencio.
3. Como estudiante, quiero buscar sin escribir tildes, para que "analitica" encuentre "Analítica".
4. Como estudiante, quiero ver el temario de un curso antes de bajarlo, para decidir si vale la pena.
5. Como estudiante, quiero bajar los transcripts de un curso con un comando, para tener el contenido en texto.
6. Como estudiante, quiero que también me baje las lecturas, no sólo los videos, porque parte del contenido no es audiovisual.
7. Como estudiante en un curso con semanas bloqueadas, quiero que igual intente bajar los módulos con candado, porque la API los entrega aunque la web los esconda.
8. Como estudiante, quiero elegir el idioma de los subtítulos, para leerlos en español cuando exista.
9. Como estudiante, quiero que si mi idioma no está disponible baje otro en vez de saltear el video, porque un transcript en inglés es mejor que ninguno.
10. Como estudiante, quiero que los archivos queden organizados por módulo y en orden, para poder leerlos como un libro.
11. Como estudiante, quiero elegir dónde se guardan con `--out`, para llevarlos a mi repo de notas.
12. Como estudiante, quiero un default sensato cuando no paso `--out`, para no tener que decidir cada vez.
13. Como estudiante, quiero bajar sólo los primeros N items con `--limit`, para probar antes de comprometerme con un curso entero.
14. Como estudiante, quiero saber si mi sesión sigue viva antes de empezar, para no descubrir a mitad de una descarga que venció.
15. Como estudiante, quiero saber hace cuánto se capturó la sesión, para entender cuánto dura en la práctica.
16. Como usuaria del repo de recon en Python, quiero que el CLI reuse la sesión que ya tengo capturada, para no volver a loguearme.
17. Como usuaria en un servidor sin interfaz gráfica, quiero pasar la cookie por variable de entorno, para poder correrlo en EC2.
18. Como agente (Claude), quiero listar los cursos del usuario como tool, para responder "¿qué cursos tengo sobre X?" sin pedirle que corra nada.
19. Como agente, quiero obtener el temario de un curso, para saber qué items existen antes de leer.
20. Como agente, quiero disparar la descarga de un curso, para trabajar sobre su contenido.
21. Como agente, quiero que la descarga me devuelva un índice y no el texto completo, para no quemar el contexto de la conversación.
22. Como agente, quiero leer un item puntual por id o por nombre, para citar exactamente lo que necesito.
23. Como agente, quiero saber si la sesión está viva, para explicar por qué falla en vez de reintentar a ciegas.
24. Como agente, quiero que los errores lleguen tipados (sesión vencida vs ruta muerta vs red), para decidir qué hacer sin parsear un mensaje.
25. Como scripter, quiero `--output json` en todo comando, para pipear a `jq`.
26. Como scripter, quiero que el CLI detecte solo si está en terminal o redirigido, para no pasar el flag siempre.
27. Como mantenedora, quiero que las rutas de la API vivan en un archivo de datos, para que una deprecación se arregle sin tocar código.
28. Como mantenedora, quiero tests contra respuestas reales de la API, para que un cambio de forma no pase desapercibido.
29. Como mantenedora, quiero que una descarga larga no muera por un item que falla, para no perder el trabajo de los otros 60.
30. Como usuaria, quiero un aviso de progreso durante la descarga, para saber que no se colgó.
31. Como usuaria, quiero que los nombres de archivo sobrevivan en Windows, para que no se rompa por un `?` o un `:` en el título.
32. Como usuaria preocupada por la privacidad, quiero que la cookie nunca se escriba en el repo, porque es una credencial viva.

## Implementation Decisions

**Ubicación y runtime.** El repo vive en `klipso_reverse/Cli-propios/coursera-cli/`, dentro
de la fábrica de CLIs, para heredar sus convenciones y ADRs. Runtime **Bun** (el CLI es
API-heavy: fetch + JSON). El binario de Bun no está en el PATH del proceso de Claude Code
—punto 2 del ADR-0001—, así que toda invocación programática usa la ruta absoluta del `.exe`.

**Capas.** Cuatro, con una sola dirección de dependencia:
`commands/` y `mcp/` → `services/` → `http.ts` → red. Los comandos no arman URLs y los
servicios no imprimen. Esto es lo que permite que MCP y CLI compartan el 100% de la lógica.

**Rutas en datos, no en código.** `endpoints.json` mantiene las 6 rutas con placeholders;
`services/endpoints.ts` las interpola. Cuando Coursera deprecie una `.v2`, el arreglo es
una línea de datos. Ésa fue la deuda que mató a `coursera-dl`.

**Sesión con tres orígenes, en orden:** variable `COURSERA_CAUTH` → store propio del CLI →
store del repo de recon en Python (`~/.config/coursera_recon/session.json`). El tercero
existe porque la cookie dura días y obligar a re-loguearse sería gratuito para nadie.
El store de Python se lee, nunca se escribe.

**Errores tipados.** `CourseraError` con `kind`: `unauthorized | not_found | html_response |
http | network`. La distinción crítica viene del recon: un **200 con HTML** significa ruta
deprecada o request mal armado, **no** sesión vencida; sesión vencida es 401/403. Confundirlos
manda a re-loguearse cuando el problema era la URL.

**Paginación real.** `memberships.v1` acepta `limit` y devuelve `paging.total` y
`paging.next`. Con 215 memberships y `limit=100`, no seguir el cursor trunca el 54% sin
avisar. `listCourses` recorre hasta agotar `next`, deduplicando por id.

**Reconstrucción del árbol.** La API manda tres listas planas en `linked` (módulos,
lecciones, items) más los ids que las cosen; el árbol se arma por ids. Dos trampas del
recon quedan cubiertas: `typeName` vive en `contentSummary`, no en la raíz; y los items
faltantes o sin nombre heredan el título de su lección padre.

**Desbloqueo por sondeo polimórfico.** No se filtra por `typeName` al construir el plan:
en cursos en preview el agregador censura ese campo, y filtrar temprano descarta módulos
enteros creyéndolos vacíos. Para cada item se sondea `onDemandLectureVideos.v1` y, si no
responde, `onDemandSupplements.v1`. Lo que devuelva 200 gana; si ninguno responde, el item
se registra como salteado y la corrida sigue. Un `unknown` **nunca** se filtra, ni siquiera
cuando el usuario pide sólo `lecture`.

**Descarga en una sola pasada.** Las URLs de media van firmadas con expiry (hmac / CloudFront
Signature), así que no se puede planificar hoy y bajar mañana. Se pide y se baja en la misma
pasada, con 500 ms entre items.

**Manifiesto.** Cada carpeta de curso lleva un `manifest.json` con item id, nombre, tipo,
idioma, ruta y tamaño. Es lo que permite que `read_transcript` lea un item después sin
volver a la API (donde las URLs firmadas ya habrían expirado).

**Superficie MCP: 5 tools granulares**, no un tool con subcomando —el patrón que
`_knowledge/cli-vs-mcp.md` marca como mejor para agentes:

| Tool | Devuelve |
|---|---|
| `session_status` | origen, antigüedad, si está viva, total de cursos |
| `list_courses` | `{total, matches, courses:[{slug,name}]}` |
| `get_course_outline` | árbol completo + `itemCount` |
| `fetch_transcripts` | **índice** de lo bajado: rutas y tamaños, nunca el texto |
| `read_transcript` | el texto de **un** item, por id o por parte del nombre |

La separación entre las dos últimas es deliberada: un curso son ~130 KB (≈35k tokens).
Devolverlo entero reventaría la conversación en dos llamadas.

**Salida agent-first.** Todo comando acepta `--output json|table|auto`; `auto` decide por
`process.stdout.isTTY`. Sin `--output json` el CLI no es usable por un agente.

## Testing Decisions

**Qué hace bueno a un test acá:** que verifique comportamiento observable con datos reales
de la API. Los fixtures (`test/fixtures/`) son respuestas **capturadas en vivo** el
2026-08-16, con los querystrings firmados redactados. Un test que pasa contra JSON inventado
no prueba nada sobre Coursera.

**Seam único:** las funciones puras de `src/services/`, que transforman el envelope crudo en
objetos del dominio. HTTP se inyecta como interfaz `Client`, así que los tests no tocan red
ni necesitan sesión. Todo lo demás (comandos, MCP) es cableado delgado sobre ese seam.

**Cubierto (31 tests):**
- `memberships`: extracción desde `linked`, total real vs página, cursor, entradas rotas,
  búsqueda con y sin acentos, orden de relevancia, consulta vacía.
- `courses`: reconstrucción del árbol, `typeName` anidado, orden de `moduleIds`, conteo de
  items, item censurado → `unknown` heredando nombre de la lección, filtrado por tipo,
  y la regla de que `unknown` nunca se filtra.
- `transcripts`: preferencia de idioma, fallback a cualquier idioma, ruta relativa
  preservada, limpieza de `.vtt` (cues, timestamps, tags, líneas repetidas), CML → markdown,
  nombres seguros en Windows.

**Prior art:** el patrón de tests con `bun:test` sobre fixtures viene de `cligentic`
(ver `reference_cligentic_tests_pattern`).

**Deliberadamente sin test unitario:** el loop de descarga y el transporte MCP. Se verifican
con corridas reales contra la API (ver §Verificación), que es donde se rompen de verdad.

## Out of Scope

- **Video mp4.** El pipeline está (`sources.byResolution`), pero v1 no lo expone. `--videos` es v2.
- **Vault de Obsidian y grafo de conocimiento.** El repo de Python los genera
  (`cases/duke_ml_foundations/`); es modelado de conocimiento, otra capa. v2.
- **Login con browser.** v1 reusa la sesión existente. Cuando expire hace falta
  `capture_session.py` del repo de recon. `coursera login` con Playwright es v1.1, y ahí sí
  aplica el runtime híbrido del ADR-0001.
- **Estado del curso** (activo / completado / abandonado). Ningún endpoint conocido lo
  expone, y con el flujo de "un curso a la vez" no aporta. Descartado, no pospuesto.
- **Quizzes, notas y foros.** Sólo videos y lecturas.
- **Reanudar descargas.** Cada corrida es completa.
- **Bloques de cligentic.** El framework los pide (`json-mode`, `xdg-paths`, `error-map`).
  v1 implementa equivalentes mínimos locales (`output.ts`, `constants.ts`, `CourseraError`)
  para no depender de la red en el scaffold. Migrar a los bloques es deuda declarada.

## Further Notes

**Hallazgos de recon nuevos, verificados en vivo el 2026-08-16** (no estaban en `RESEARCH.md`):

1. **TTL de la cookie ≥ 104 horas.** Estaba documentado como "sin medir". Una sesión
   capturada el 12/08 seguía sirviendo el 16/08. Cambia el diseño: el login no es el paso 1.
2. **`paging.total` = 215 con `limit=100`.** El truncamiento silencioso es real y era el
   bug más caro de v1.
3. **`memberships.v1` no trae estado.** Los `elements` son `{role, id, userId, courseId}` y
   nada más. `onDemandCourseGrades.v1` da 404; `courseProgress.v1`, `onDemandEnrollments.v1`
   y `learnerCourseSummary.v1` devuelven 200+HTML (muertos).
4. **El curso de control tiene 6 tipos de item**, no dos: `lecture` (48), `supplement` (12),
   `staffGraded` (6), `discussionPrompt`, `coach`, `phasedPeer`. Un filtro binario
   video/lectura pierde 8 items.
5. **29 idiomas de subtítulos** en el curso de Duke, incluido español.

**Pista abierta:** [davidfurlong/Coursera-new-tab-extension](https://github.com/davidfurlong/Coursera-new-tab-extension)
dice hacer reverse engineering del progreso de curso. Si algún día hace falta el estado,
empezar ahí.

## Verificación

| DoD | Resultado |
|---|---|
| `courses --output json` devuelve todos los cursos | **215/215**. `fundamentals-machine-learning-in-finance` sale en la fila 131: con el truncamiento en 100 era invisible |
| `transcript <slug>` baja archivos no vacíos | **8 de 8 items, 0 salteados, 0 archivos vacíos**, 15.9 KB. Mezcla real: 4 `lecture` en español + 4 `supplement` |
| MCP responde en conversación | **5 tools listadas y respondiendo** contra un cliente MCP real: `session_status` (viva, 104.5 h), `list_courses("pricing")` → 3 de 215, `get_course_outline` → 6 módulos / 69 items |

Falta el último tramo del tercer punto: que Claude Code lo tenga cargado en una conversación
real. Eso requiere registrar el `.mcp.json` y reiniciar Claude Code — acción del usuario.
