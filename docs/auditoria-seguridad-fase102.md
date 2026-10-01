# Auditoría de seguridad y bugs — Fase 102 (Octubre 2026)

Escaneo completo de seguridad y de bugs de InConexión Platform, pedido para
revisar todo lo que se agregó desde las últimas auditorías (Fases 72 y 81
de seguridad, Fase 88 de bugs): el selector de MES global, WhatsApp con 2
niveles de servicio, el dominio nuevo, Calidad (fecha/evaluador bloqueados,
asesorUserId, catálogo de codificaciones, alerta y "visto"), Inasistencia
completo, Agendamiento con 4 vistas, la guía de uso y el monitor de
producción.

Este documento no incluye secretos ni pasos de explotación — todo lo que
se encontró ya se arregló (ver la tabla de abajo); no queda nada pendiente
que describir con detalle explotable.

## Resumen

- **3 hallazgos críticos** de escalada de privilegios, cerrados.
- **1 hallazgo alto** (la guía de uso era pública), cerrado.
- **1 hallazgo medio** (cruce de campaña en Calidad) y **1 informativo**
  relacionado, cerrados.
- **1 hallazgo bajo** de integridad de datos (fechas imposibles), cerrado.
- **Endurecimiento de 2 workflows** de GitHub Actions (permisos explícitos
  + inyección de input), cerrado con autorización previa del usuario.
- Inyección SQL, XSS guardado, fórmulas de Excel, prototype pollution,
  path traversal, cabeceras HTTP, CORS, JWT, rate limiting de login, costo
  de hash, DoS/límites de carga, borrado con alcance de cliente/campaña,
  secretos en el repo y su historial, y logs del servidor: **sin
  hallazgos** — se detalla la evidencia revisada en cada caso.
- Recorrido amplio con Playwright en local (ORLANT a fondo + 10 roles de
  seed:demo): **0 hallazgos**.
- Migraciones corridas 3 veces sobre una base con la forma de producción:
  resultado idéntico, sin errores.

## Tabla de hallazgos

| Severidad | Área | Cómo se reproduce (resumen) | Evidencia | Arreglo |
|---|---|---|---|---|
| Crítica | Usuarios/permisos | Un actor con solo el permiso puntual `crearUsuarios`/`editarUsuarios` (asignable a cualquier rol) podía crear o convertir un usuario a `ADMIN`/`AUX_ADMIN`, incluso a sí mismo. | `server/routes/usuarios.js` (antes del fix) | PR #224 |
| Crítica | Usuarios/permisos | `PUT /users/:id/password` no tenía el mismo límite que crear/editar — cualquiera con `cambiarPassword` podía resetear la contraseña de un `ADMIN`/`AUX_ADMIN` existente e iniciar sesión como esa cuenta. | `server/routes/usuarios.js:135-150` (antes) | PR #227 |
| Crítica | Usuarios/permisos | Ni `PUT /users/:id/perms` ni el campo `perms` de `PUT /users/:id` bloqueaban la auto-edición — un actor con `gestionPermisos` podía otorgarse a sí mismo cualquier otro permiso de la plataforma. | `server/routes/usuarios.js:168-182` (antes) | PR #227 |
| Alta | Guía de uso | `public/guia-uso.html` se servía por `express.static` sin ninguna autenticación — la URL directa exponía el nombre del cliente y la estructura de carga de cada base sin iniciar sesión. | `public/guia-uso.html` (antes), `server.js` | PR #226 |
| Media | Calidad | El fallback por nombre (filas sin `asesorUserId`) de `/monitoreos/mios`, `/monitoreos/mios/nuevos` y `PUT /monitoreos/:id/visto` no filtraba por campaña — un asesor con el mismo nombre en otra campaña podía ver/marcar como visto un monitoreo ajeno. | `server/routes/calidad.js` (antes) | PR #225 |
| Baja/informativo | Calidad | `GET /calidad/plantillas` devolvía la plantilla de evaluación de TODAS las campañas a cualquier actor autenticado. | `server/routes/calidad.js` (antes) | PR #225 |
| Baja | Integridad de datos | `fechaSchema` solo validaba el FORMATO (regex), nunca que la fecha existiera en el calendario — `"2026-02-30"` se guardaba tal cual. | `server/validation.js:152` (antes) | PR #228 |
| Baja | Workflows (repo público) | `ci.yml` sin bloque `permissions:` explícito (default del repo); 2 pasos de `verificar-logs-produccion.yml` interpolaban `${{ github.event.inputs.horas_atras }}` directo dentro de `run:` en vez de pasarlo por `env:`. | `.github/workflows/ci.yml`, `verificar-logs-produccion.yml` | PR #230 (autorizado antes de tocar) |
| Informativo | Dependencias | `better-sqlite3` 12→13 y `dotenv` 17→18 tienen versión MAYOR disponible. | `npm outdated` | Congeladas hasta después de la entrega de ORLANT, por decisión ya tomada del proyecto — no se tocan. |
| Informativo | GitHub Actions | Ninguna acción de terceros está fijada a un SHA de commit (todas usan un tag mutable, ej. `@v4`); `appleboy/ssh-action@v1` es la de mayor riesgo de cadena de suministro por no ser first-party. | `.github/workflows/*.yml` | Solo se lista (pedido explícito): fijar a SHA queda pendiente de decisión del usuario. |

### Áreas revisadas sin hallazgos

Para cada una se detalla qué se revisó y por qué se considera cerrada:

- **Inyección SQL**: todo el código nuevo usa `.prepare(...).run/get/all(params)` de `better-sqlite3` con placeholders; los nombres de columna en cláusulas `WHERE`/`DISTINCT` dinámicas son siempre literales fijos del código, nunca vienen del request.
- **XSS guardado**: todo texto proveniente de un Excel cargado o de un catálogo (especialidad, codificación, asesor, entidad, profesional, skill/cola) pasa por `esc()` antes de insertarse en `innerHTML`, en los módulos nuevos (Inasistencia, Agendas, Tipificación, Calidad) y los existentes.
- **Fórmulas de Excel en exportes**: todos los exports (incluidos los nuevos de Inasistencia y Agendas) pasan las filas por `xlsxFilasSeguras`/`xlsxCeldaSegura` (`public/js/xlsx-export-helpers.js`) antes de `json_to_sheet`, igual que los exports ya cubiertos desde la Fase 72.
- **Prototype pollution**: el esquema Zod de la config de dashboards (`z.object`, modo strip por defecto) descarta cualquier clave de nivel superior no declarada; la config se reconstruye con `JSON.parse` fresco en cada lectura, nunca se mergea sobre un objeto compartido.
- **Path traversal**: `express.static` usa la implementación estándar de Express (normaliza y rechaza `..`); ningún endpoint arma una ruta de archivo a partir de un parámetro del request — incluida la nueva ruta de la guía de uso, que sirve una constante fija.
- **JWT**: algoritmo fijado explícitamente a `HS256` (defensa en profundidad, PR #224); vence a las 8h; un usuario borrado pierde el acceso de inmediato (el actor se recarga fresco de la base en cada request) sin esperar a que el token expire; uno suspendido recibe 403 de inmediato por el mismo motivo.
- **Login / fuerza bruta**: limitador dedicado (20 intentos por ventana, solo cuenta los fallidos) además del límite general de la API; mitigación de ataque de tiempo (hash dummy cuando el usuario no existe, para no poder enumerar usuarios por el tiempo de respuesta).
- **Costo de hash**: `bcrypt` con 10 rondas, estándar razonable.
- **Cambio de contraseña**: no existe un flujo de "cambiar mi propia contraseña" — solo un reseteo hecho por alguien con el permiso `cambiarPassword` (ahora correctamente restringido para cuentas `ADMIN`/`AUX_ADMIN`). Esto es una característica de diseño, no una vulnerabilidad; se menciona por si el negocio quiere agregar un flujo de autoservicio a futuro.
- **DoS / cargas masivas**: límite de tamaño de payload (2MB global, 8MB en las 2 rutas de tipificación); cada endpoint de carga masiva tiene un límite explícito de filas en su esquema Zod (entre 500 y 50.000 según el endpoint); los números y fechas pasan por validación de tipo/rango antes de llegar a la lógica de negocio.
- **Borrado con alcance de cliente/campaña**: se revisó cada `DELETE` del backend — los de "reemplazo por período" (agendas, inasistencia, tipificaciones) están acotados por `campana` + rango de fechas/mes; los que borran por `id` (monitoreos, cargas de dashboard, etc.) siempre verifican el `cliente`/`campana` de la fila antes de borrar.
- **Cabeceras HTTP**: verificado en vivo contra producción — CSP estricto sin defaults, HSTS, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options` presentes; CORS con lista blanca explícita (rechaza un origen no autorizado con 403, confirmado en vivo).
- **Manejo de errores**: un 500 nunca manda el stack ni el mensaje interno al cliente; un 404 de API es JSON genérico; una ruta que no existe fuera de `/api` cae al SPA (comportamiento esperado de esta arquitectura, no un hallazgo).
- **Secretos**: sin hallazgos en el árbol actual ni en el historial completo de git (escaneo dirigido por patrones típicos); los logs del servidor no imprimen contraseñas, tokens ni objetos completos de usuario/request.
- **Migraciones**: una base sembrada con `seed:demo` + todas las migraciones, reabierta 3 veces seguidas, da contenido byte-idéntico (hash SHA-256 de todas las tablas) sin ningún error.
- **Config round-trip (Zod que borra campos)**: ya existía una prueba general de la Fase 85 (`tests/dashboards-config-put-round-trip-fase85.test.js`) que manda de vuelta, sin tocar nada, la config YA SEMBRADA de cada cliente real y confirma que lo leído después es idéntico byte a byte — si mañana se agrega un campo sin declararlo en el esquema, esta prueba falla sola, sin tener que saber de antemano cuál campo es.
- **Producción (solo lectura)**: headers de `/`, `/api/health` y la guía correctos; certificado TLS vence en 88 días (lejos del umbral de 14 del monitor automático); `/api/...` sin token da 401 genérico; una ruta inexistente da 404 limpio; no hay source maps ni listado de directorios (las URLs que parecían serlo en realidad caen al SPA, confirmado por el `Content-Type`).

### Decisiones de diseño confirmadas (no son bugs)

- La carga masiva histórica de monitoreos (`POST /monitoreos/bulk`) sí toma el nombre del evaluador del Excel — documentado desde la Fase 95 como una excepción intencional para datos históricos; la creación y edición individual en tiempo real mantienen el evaluador inmutable (siempre el usuario de la sesión), sin ninguna vía para cambiarlo.
- Inventario, Gerencia y Gestión Humana son módulos internos de alcance global (sin granularidad por campaña en su permiso), igual que un cuarto rol dedicado a cada uno — patrón uniforme y deliberado, no un IDOR.
- La carga de Tráfico de Llamadas (`POST /calidad/trafico/carga`) y el mapeo de skills no filtran por campaña puntual porque un mismo archivo trae varias campañas a la vez — documentado desde una auditoría anterior (2026-09-15).

## Pendiente de decisión del usuario

- Fijar las acciones de terceros de los workflows a un SHA de commit en vez de un tag mutable (`@v4` → un hash). Se listaron, no se tocaron.
- Las actualizaciones mayores de dependencias (`better-sqlite3`, `dotenv`) siguen congeladas hasta después de la entrega de ORLANT, por acuerdo ya existente.

## Verificación

- `npm test`: verde antes y después de cada arreglo (ver cada PR).
- `npm audit`: 0 vulnerabilidades antes y después.
- Recorrido amplio con Playwright en local (`seed:demo`): 0 hallazgos — ver `.github/scripts/verificar-fase102-auditoria-amplia-local.js`.
- Verificación final en producción, solo lectura, con sesión real del usuario: ver `.github/scripts/verificar-fase102-revision-final-produccion.js` y el cierre de esta fase en `PROGRESS.md`.
