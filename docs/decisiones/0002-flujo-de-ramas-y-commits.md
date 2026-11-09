# 0002 · Ramas, commits y PR de Maple

**Fecha:** 2026-11-09 · **Estado:** Aceptada

## Contexto
Los equipos trabajaban distinto: Maple con `develop`, ramas `feature/USxx`, commits `tipo(USxx): ...` y 1 aprobación; el Equipo 2 con `main` y una rama por persona. Carlos decidió el 2026-11-08 adoptar las reglas de Maple.

## Decisión
Se usa el flujo de Maple completo (ver [CONTRIBUTING.md](../../CONTRIBUTING.md)): `main` y `develop`, `feature/*`, PR con 1 aprobación y CI, squash para historias y merge commit para entregas.

Dos ajustes para que funcione con dos equipos:
1. **Numeración:** `HUxx` para historias del Equipo 2 y `USxx` para las de Maple, porque los números se repiten entre equipos.
2. **Título del PR:** usa el mismo formato que los commits (`tipo(ID): descripción`). En el repo de Maple era `USxx: descripción`, lo que hacía que el commit de squash no siguiera el formato. El CI lo revisa.

## Consecuencias
- Historial uniforme y fácil de buscar.
- Quien venía del Equipo 2 deja los títulos sencillos en español y usa `feat(HU05): ...`.
