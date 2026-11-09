# 0005 · Una sola sesión

**Fecha:** 2026-11-09 · **Estado:** Aceptada

## Contexto
Hay dos sistemas de sesión: el del Equipo 2 (`USER_SESSION`, cookie `femsa_sesion`) y el de Maple (`AuthUsers` y `AuthSessions`). Los dos son casi iguales: token aleatorio en cookie HttpOnly de 8 horas y SHA-256 en la base. Maple prefiere el nuestro.

## Decisión
- Se usa **`USER_SESSION`** y la cookie `femsa_sesion` (HttpOnly, SameSite=Lax, Secure en producción, 8 horas).
- Solo `backend-auditoria` abre y cierra sesiones. `backend-riesgos` agrega un middleware que lee la cookie, busca el hash en `USER_SESSION` y obtiene el usuario.
- Las contraseñas de prueba se redefinen (bcrypt, como las del Equipo 2) en lugar de migrar los hashes scrypt de Maple.
- Los roles son los mismos de la tabla `ROLE`. Entra ID se comparte cuando FEMSA dé acceso.

## Consecuencias
- Un solo login (el diseño del Equipo 2) y una sola cookie para todo el sitio.
- `AuthUsers` y `AuthSessions` quedan sin uso y se retiran con una migración.
- Los dos backends deben colgar del mismo dominio para compartir la cookie.
