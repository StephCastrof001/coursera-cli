# coursera-cli

Tus cursos de Coursera desde la terminal — y desde Claude Code, vía MCP.

Baja los **transcripts** y las **lecturas** de los cursos en los que estás inscrito, usando
la API interna de Coursera. Sin scrapear HTML, sin bajar gigabytes de video.

```
coursera courses --buscar "pricing"     → encontrá el curso
coursera course <slug>                  → mirá el temario
coursera transcript <slug>              → bajá el contenido en texto
```

---

## Instalación

Requiere [Bun](https://bun.sh).

```bash
cd klipso_reverse/Cli-propios/coursera-cli
bun install
```

## Sesión

El CLI necesita la cookie `CAUTH` de tu cuenta. La busca en tres lugares, en orden:

1. La variable de entorno `COURSERA_CAUTH`
2. Su propio store, en `~/.config/coursera-cli/session.json`
3. El store del repo de recon en Python, en `~/.config/coursera_recon/session.json`

Si no tenés ninguna, capturala con `capture_session.py` del repo `coursera_recon`: abre un
Chromium visible, te logueás a mano y guarda la cookie. **El login no se automatiza**:
tipear las credenciales por script dispara el CAPTCHA.

Para ver si la que tenés sigue viva:

```bash
coursera session
```
```
origen      store heredado de coursera_recon (Python)
capturada   2026-08-12T10:24:51-0500
antigüedad  104.5 h
estado      VIVA
cursos      215
```

## Comandos

| Comando | Qué hace |
|---|---|
| `coursera session` | Estado de la sesión: origen, antigüedad, si está viva |
| `coursera courses [--buscar <texto>]` | Tus cursos. Sin `--buscar` los lista todos |
| `coursera map [--detalle]` | En qué ramas te formaste y qué especializaciones dejaste a medias |
| `coursera course <slug>` | Temario: módulos, lecciones e items con su tipo |
| `coursera transcript <slug>` | Baja transcripts y lecturas |

Flags globales:

| Flag | Default | Para qué |
|---|---|---|
| `--output json\|table\|auto` | `auto` | `auto` = tabla en terminal, JSON si redirigís |
| `--out <dir>` | `~/.local/share/coursera-cli/<slug>/` | Dónde escribir |
| `--limit <n>` | todos | Cortar después de N items |
| `--lang es,en` | `es,es-LA,en` | Orden de preferencia de subtítulos |

Ejemplos:

```bash
coursera courses --buscar "machine learning" --output json | jq -r '.courses[].slug'
coursera transcript machine-learning-foundations-for-product-managers --limit 5
coursera transcript uva-darden-bcg-pricing-strategy-practice --out ./notas/pricing --lang en
```

## MCP para Claude Code

Registrá el servidor con la **ruta absoluta del binario de Bun** — el proceso que lanza el
MCP no hereda tu PATH, así que `"command": "bun"` falla con "Failed to connect":

```json
{
  "mcpServers": {
    "coursera": {
      "command": "C:/Users/<vos>/.bun/bin/bun.exe",
      "args": [
        "run",
        "C:/Users/<vos>/klipso_reverse/Cli-propios/coursera-cli/src/mcp/index.ts"
      ]
    }
  }
}
```

Tools que expone:

| Tool | Devuelve |
|---|---|
| `session_status` | Si la sesión está viva, de dónde salió, cuántos cursos ve |
| `list_courses` | Tus cursos, filtrables por texto |
| `get_library_map` | Ramas, horas y avance en tus especializaciones |
| `get_course_outline` | El árbol del curso |
| `fetch_transcripts` | Baja el curso y devuelve el **índice** de lo bajado |
| `read_transcript` | El texto de **un** item |

`fetch_transcripts` devuelve rutas, no texto: un curso son ~130 KB (≈35k tokens) y
mandarlo entero a la conversación la reventaría. Para leer, `read_transcript`.

## Qué baja, y qué no

Por defecto baja **texto**: `.txt` con el transcript de cada video y `.reading.md` con las
lecturas. No baja video — un curso son gigabytes en mp4 contra ~130 KB en texto, y para
estudiar o resumir el texto tiene la misma señal.

Los archivos quedan organizados por módulo, numerados en orden, más un `manifest.json` con
el índice.

## Módulos con candado

Cuando un curso está en preview o tiene semanas bloqueadas, la API principal **censura el
tipo** de esos items: los devuelve vacíos, y los extractores que filtran por tipo se saltan
el 75% del temario creyéndolo vacío.

Este CLI no filtra: le pregunta directo a los microservicios de video y de lecturas por cada
item, y se queda con lo que responda. Ver `ARCHITECTURE` en el repo de recon original.

## Documentación

| Archivo | Qué tiene |
|---|---|
| `SPEC.md` | El spec de v1: problema, decisiones, alcance, verificación |
| `CONTEXT.md` | Glosario del dominio |
| `RESEARCH.md` | El recon del portal: endpoints, gotchas, qué está vivo |
| `endpoints.json` | Las rutas. Si Coursera deprecia una versión, se arregla acá |

## Tests

```bash
bun test          # 31 tests contra respuestas reales capturadas de la API
bun run typecheck
```

## Legal

Accede sólo a **tu propia cuenta** con **tu propia sesión**, a los cursos en los que ya
estás inscrito. El material descargado tiene copyright de Coursera y de sus universidades:
es para tu estudio personal. No lo redistribuyas.
