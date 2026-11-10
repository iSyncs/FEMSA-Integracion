# Módulo de IA (FE1S-23 · FE1S-24)

La IA **sugiere**; nada se guarda hasta que el usuario acepta con los endpoints de hallazgos o planes.

## Configuración
| Variable | Uso |
|---|---|
| `IA_BASE_URL` | `https://openrouter.ai/api/v1` (por defecto) o `http://localhost:1234/v1` para LM Studio |
| `IA_API_KEY` | Clave de OpenRouter. LM Studio no la necesita. Nunca se sube al repo. |
| `IA_MODEL` | Id del modelo en el proveedor |
| `IA_TIMEOUT_MS` | Tiempo máximo por respuesta, 60000 por defecto |

Si no se definen las `IA_*`, el módulo usa las del módulo de sugerencias de IA (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`, `OPENROUTER_TIMEOUT_MS`), así basta con una sola clave en Vercel.

Sin `IA_MODEL` (o sin clave en OpenRouter) los endpoints responden 503 y `GET /api/ia/estado` regresa `configurada: false`, para que la pantalla muestre "IA no disponible".

## Skills (`skills/index.ts`)
| Endpoint | Skill | Roles |
|---|---|---|
| `POST /api/ia/clasificar` | Tipo de documento y procedimiento sugerido | auditor, líder |
| `POST /api/ia/completitud` | Faltantes del lote y mensaje para el auditado | auditor, líder |
| `POST /api/ia/hallazgo` | Hallazgo con condición, criterio, causa, efecto, recomendación y severidad | auditor, líder |
| `POST /api/ia/plan` | Plan de remediación para un hallazgo | auditor, líder, auditado |
| `POST /api/ia/resumen` | Resumen ejecutivo de una auditoría | auditor, líder, jefe, gerente, director |

Cada skill define su prompt y su JSON Schema. Al proveedor se le manda el esquema en modo estricto (sin límites de longitud, que algunos modelos no aceptan) y el backend valida la respuesta completa; si no cumple, reintenta una vez con los errores y, si sigue mal, responde 502.

Se envía `reasoning_effort: "none"`: con Qwen 3.5 en LM Studio el razonamiento extendido tardaba más de 80 s y dejaba la respuesta vacía.

## Modelo recomendado en OpenRouter
`IA_MODEL=nvidia/nemotron-3-super-120b-a12b:free`. Probado el 15 oct con las 5 skills: JSON válido, entre 5 y 29 s por respuesta y acepta salida estructurada.
`nvidia/nemotron-3.5-lightning:free` también funciona, pero no acepta salida estructurada y tardó hasta 53 s. Los modelos gratuitos tienen límite de uso diario.

## Límites
- Hasta 10 documentos de 12 000 caracteres por petición.
- 20 peticiones por minuto por usuario (en memoria de cada instancia).
- Solo datos de demostración hacia OpenRouter; los documentos reales de FEMSA irán al modelo local o a Azure (Sprint 3).
