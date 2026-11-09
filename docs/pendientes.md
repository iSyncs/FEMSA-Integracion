# Pendientes por revisar

Ideas y temas que ya salieron pero todavía no se deciden. Cuando uno se aclare, se convierte en una decisión (`docs/decisiones/`) o en una historia.

## LLMOps, arnés de IA y agentes

**Anotado:** 2026-11-09 (Carlos). Nos lo mencionaron, falta aclarar con quién y qué piden exactamente.

**Qué hay que averiguar**
- ¿Qué entienden por "LLMOps" y por "arnés": evaluación de prompts, pruebas de calidad de la IA, monitoreo de costo y latencia, versionado de modelos?
- ¿Piden usar **agentes** (que ejecuten pasos o flujos por su cuenta) o solo una IA que sugiere?
- ¿Cómo encaja con lo que ya existe? El Equipo 2 tiene `backend/src/ia` (proveedor compatible con OpenAI, OpenRouter en producción y LM Studio en local). Maple usa Gemini con `AI_PROVIDER`.

**Qué revisar después**
- Un solo punto de entrada para la IA en lugar de dos proveedores sueltos.
- Un conjunto de casos de prueba fijos para medir si la IA mejora o empeora al cambiar de modelo o de prompt.
- Registro de cada llamada (modelo, tiempo, costo, resultado) en la bitácora.

**Cuándo:** después de la presentación del 9 de nov. No bloquea la Fase 1.
