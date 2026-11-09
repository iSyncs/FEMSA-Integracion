# 0003 · Biome para todo y Node 24

**Fecha:** 2026-11-09 · **Estado:** Aceptada

## Contexto
El Equipo 2 usa Oxlint (sin formateador) y el Equipo 11 usa Biome. El Equipo 2 prueba con Node 24 en CI y Maple pide Node >=22.

## Decisión
- **Biome** para lint y formato en las tres partes, con un solo `biome.json` en la raíz. Hace las dos cosas con una herramienta y Maple ya lo usa.
- **Node 24** en `.nvmrc`: cumple el `>=22` de Maple, es el LTS actual y el que usa Vercel por defecto.
- El código del Equipo 2 se formatea con Biome en **un commit aparte** cuando llegue, y su hash se agrega a `.git-blame-ignore-revs`.
- Para NestJS, el `biome.json` permite decoradores de parámetros y no convierte imports a `import type` (rompería la inyección de dependencias).

## Consecuencias
- Oxlint desaparece. Los scripts `lint` del frontend del Equipo 2 pasan a `biome`.
- Un PR de formato grande al inicio, pero se hace una sola vez.
