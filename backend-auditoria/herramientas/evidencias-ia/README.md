# Evidencias simuladas para la IA

Generador de las evidencias PDF **ficticias** que usan la pantalla de IA y los lotes de evidencia (FE1S-35). Los PDF ya generados están en `src/datos/memoria/archivos-demo/`; solo hace falta correrlo para cambiar o agregar casos.

| Archivo | Qué es |
|---|---|
| `generar_evidencias_ia.py` | Crea los PDF, el SQL que los registra en `dbo.EVIDENCE` y el manifiesto |
| `manifiesto_evidencias_ia.md` | Lista de casos: qué debe encontrar la IA en cada evidencia |
| `datos_prueba_evidencias_ia.md` | Explicación de los datos de prueba |

```bash
cd backend-auditoria/herramientas/evidencias-ia
pip install reportlab pypdf
python generar_evidencias_ia.py --pdf-dir ../../src/datos/memoria/archivos-demo
```
