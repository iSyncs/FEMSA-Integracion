# 0004 · CI/CD con GitHub Actions y Vercel

**Fecha:** 2026-11-09 · **Estado:** Aceptada

## Contexto
El Equipo 2 desplegaba con la integración Git de Vercel (un despliegue por PR y por merge, con tope de 50 imágenes del backend). Maple despliega desde GitHub Actions con la CLI de Vercel y tiene staging y producción. Carlos eligió Actions.

## Decisión
- Todo el CI/CD vive en GitHub Actions. La integración Git de Vercel se apaga (`git.deploymentEnabled: false` en cada `vercel.json`).
- `ci.yml` valida; el workflow reutilizable `desplegar-vercel.yml` publica. Un merge a `develop` va a **staging** y un merge a `main` va a **producción**.
- Cada parte es un proyecto de Vercel distinto, con su *Root Directory*.
- El job **CI OK** es el único requisito para mergear.
- El despliegue se omite sin error si faltan los secrets, para poder armar el repo antes de tener Vercel listo.
- Las pruebas usan datos en memoria y nunca tocan Azure.

## Consecuencias
- Se despliega solo código que ya pasó el CI.
- Hay que crear tres proyectos en Vercel y cargar los secrets (ver [la guía](../guias/configurar-github.md)).
- Pendiente: vista previa por PR y pruebas E2E sobre el sitio publicado, que hoy tiene Maple. Se agregan cuando llegue el frontend.
- Pendiente: el límite de 50 imágenes del backend en Vercel Hobby; el script `limpiar-imagenes-vercel.sh` del Equipo 2 se trae junto con su backend.
