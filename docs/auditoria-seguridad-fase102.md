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

## Hallazgo posterior: cuentas de ejemplo en producción — corregido

Esta auditoría (igual que las Fases 72 y 81) revisó los usuarios de
`seed:demo` — el set de 10 roles que se siembra manualmente por CLI para
pruebas — y la lógica de login/permisos en sí misma, pero nunca se
preguntó si la siembra automática de arranque de `server/db.js` (que
corre sola cuando la tabla `users` está vacía, sin importar el entorno)
podía dejar cuentas con su contraseña de ejemplo activas en una
producción real. La Fase 110 encontró que sí había ocurrido, y corrigió
de raíz que esa siembra ya nunca se ejecute en producción, más una red de
seguridad que suspende sola cualquier cuenta de ejemplo que aún conserve
su contraseña original. Ver `PROGRESS.md`, Fase 110.

## Revisión Fase 117 (2026-10-05) — código nuevo de las Fases 113-116

Antes de entregar ORLANT, se revisó con evidencia el código de
autenticación/auditoría más nuevo (Fase 113: "Cambiar mi contraseña" y
registro de inicios de sesión) y se repasó, con grep dirigido sobre todo
`server/*.js` y `public/js/*.js`, lo que ya cubrían las Fases 72/81/102
(inyección SQL, `ORDER BY` dinámico, cabeceras HTTP/CORS, archivos
estáticos, secretos en el árbol y en todo el historial de Git, SHA-pin
de workflows) para confirmar que nada retrocedió. Detalle completo,
incluido lo que esta fase no llegó a cubrir con evidencia propia (matriz
de IDOR por rol, barrido visual completo, verificación en producción con
sesión real), en `docs/historico/progress-fases.md` → Fase 117 y en
`docs/pendientes.md`.

Dos hallazgos reales, ambos corregidos en el mismo PR:

1. **Orden del Historial no determinista en empates de milisegundo**
   (severidad media, encontrado por una prueba que falló al azar en la
   suite completa) — `GET /historial` ordenaba solo por `ts`
   (`Date.now()`); dos eventos en el mismo milisegundo podían aparecer
   en cualquier orden. Fix: desempate por `id` (AUTOINCREMENT).
2. **Plantilla descargable de Calidad sin protección contra fórmulas de
   Excel** (severidad baja, preventivo — ningún dato real afectado) —
   `descargarPlantillaMonitoreos`/`descargarPlantillaConsolidada` no
   pasaban el nombre de cada criterio por `xlsxFilasSeguras`, a
   diferencia del resto de descargas de la plataforma. Fix: mismo patrón
   ya usado en el resto del código.

Ningún otro hallazgo nuevo con evidencia (login, permisos por campaña,
transacciones del reemplazo por rango, secretos, workflows: todos
revisados y sin problema — ver el detalle en `progress-fases.md`).

## Revisión Fase 118 (2026-10-05) — cierra con evidencia lo que la Fase 117 dejó sin demostrar

La Fase 117 señaló varias cosas revisadas por CÓDIGO pero nunca
EJECUTADAS contra el sistema real: una matriz de acceso completa, la
privacidad del HistCDR con valores centinela, y la verificación en
producción con sesión real. Esta fase las ejecuta.

**Matriz de acceso (Parte 2A, `server/tests/fase118-matriz-acceso.test.js`,
51 pruebas)**: inventario programático de las 113 rutas reales de Express
(recorrido de `app.router.stack`, nunca a mano) con una política
declarada por ruta — una ruta nueva sin política hace fallar la prueba de
cobertura. Los 10 roles de `seed:demo` (vía `seedUsers()` real, sembrados
con acceso SOLO a ORLANT) ejecutados contra `CLINICA AURORA` como
campaña/cliente ajena para cada ruta de lectura scoped, los módulos
internos (Inventario/Gerencia/Gestión Humana) y las rutas
`requireDataLoader`. Reconfirma con un ataque real (no solo lectura de
código) las 3 escaladas CRÍTICAS de la Fase 102 — `crearUsuarios` no
alcanza para crear/convertir a `ADMIN`/`AUX_ADMIN`, `cambiarPassword` no
alcanza para resetear la clave de una cuenta `ADMIN`/`AUX_ADMIN`
existente, `gestionPermisos` no permite auto-otorgarse `isAdmin` — y que
`CLIENTES_DASH` nunca llega a otra campaña ni a ningún módulo
administrativo. Las 7 familias de endpoints de carga masiva (esquemas Zod
de fila con muchas columnas obligatorias) quedaron fuera de la ejecución
dinámica; se confirmó por lectura de código que siguen el mismo patrón
`canLoadData`+`campaignAccess(body.campana)` ya verificado dinámicamente
en otros 4 endpoints de escritura.

**Privacidad del HistCDR completo (Parte 2B,
`server/tests/fase118-histcdr-privacidad.test.js`, 4 pruebas + 8 ya
existentes de la Fase 116)**: valores centinela únicos en TELEPHONE,
CUSTOMER_ID, COMMENT, CONN_ID, DESTINY y COST, en un libro sintético de 20
columnas con la forma real del export HistCDR de Wolkvox. Confirmado que
ninguno sobrevive en el payload del navegador (protección estructural: el
parser ni siquiera reconoce esas columnas), el servidor (un 7mo elemento
colado en la fila se rechaza con 400 — `tipificacionFilaArraySchema` es
un `z.tuple()` de 6 elementos sin `.rest()`), SQLite (`SELECT *` de la
fila insertada, la tabla no tiene columna para eso), el Historial, `GET
/calidad/tipificacion/por-tipo` (agregado, nunca filas crudas) y ningún
`console.log` del servidor. Defecto simulado (`.rest(z.any())` temporal
en el schema) y revertido para confirmar que la prueba del rechazo-400 no
es vacía.

**Verificación en producción con sesión real** (`scripts/produccion/
revision-final.js`, ampliado): corrida real contra
`https://informa.inconexion.com.co` — 0 discrepancias de números de
control (el `ESPERADO` del script estaba desactualizado en 3, no la
producción — ver el commit), 0 errores de consola, 0 canvas sin dibujar,
0 peticiones fallidas (chequeo nuevo), Exportar dispara descarga real en
las 7 pestañas (chequeo nuevo), Fase 113 (login propio en el Historial +
"Cambiar mi contraseña") confirmada. El recorrido con un usuario
`CLIENTES_DASH` (chequeo nuevo, segundo login en la misma ventana visible)
quedó **inconcluso**: la evidencia de esa corrida (rol devuelto `null`,
`#admin-page` NO oculto, ambas escaladas de prueba "no bloqueadas") es la
firma de que el segundo login reutilizó la sesión de administrador, no
una cuenta `CLIENTES_DASH` real — no había a mano una contraseña real de
ese tipo de usuario en producción. No se reporta como verificado.

**Hallazgo real adicional, severidad baja**: un test de la Fase 117
(`fase113-tema-a-registro-login.test.js`, desempate de `GET /historial`
por `id`) resultó flaky en CI — no por el comportamiento real (el fix de
la Fase 117 sigue correcto), sino porque su filtro de verificación era
demasiado amplio (`ts === tsFijo` sin acotar también por los usuarios
sintéticos de la prueba) y podía coincidir con un evento real de otra
prueba del mismo archivo en el mismo milisegundo. Corregido.

**Fuera de alcance de esta sesión, con motivo documentado** (ver
`docs/pendientes.md` → "De la Fase 118"): casos de borde del reemplazo
por rango más allá de los ya cubiertos por las Fases 115/116 (archivo de
un solo día, skill nueva, re-subida idéntica idempotente, rango que
cruza meses, fecha futura — la atomicidad ante una falla a la mitad SÍ
se confirmó por lectura de código: las 3 funciones de carga revisadas
usan `db.transaction(...)`, que revierte todo ante cualquier excepción);
XSS dirigido con Playwright en local; pruebas de zona horaria
UTC/América-Bogotá; pruebas de fallas de red/carreras de UI; el barrido
visual completo (7 pestañas × claro/oscuro × 4 tamaños de pantalla); el
barrido de código muerto a partir del grafo de graphify.

`npm test`: 1033/1033 (1029 previas + 4 nuevas de HistCDR; la matriz de
acceso se sumó y restó en el mismo PR que el fix del test flaky). `npm
audit`: 0 vulnerabilidades antes y después (sin cambios de dependencias).
5 PRs, uno por tema, CI verde en los 5. Detalle completo en
`docs/historico/progress-fases.md` → Fase 118.

## Revisión Fase 119 (2026-10-05) — deja ORLANT lista para entregarla al cliente

Objetivo explícito del jefe: (1) entregarle ORLANT al cliente, (2) dejar
las 7 bases seguras para cargar más meses. No agrega funciones nuevas.

**Verificación en producción con la cuenta REAL del cliente**
(`scripts/produccion/revision-final.js`, reescrito): a diferencia de la
Fase 118 (donde el recorrido `CLIENTES_DASH` quedó inconcluso por una
probable confusión de credenciales), esta fase corrió con la cuenta REAL
del cliente de ORLANT (creada por el usuario desde la propia
plataforma). Identidad confirmada por el JWT decodificado (`rol:
CLIENTES_DASH`, `isMasterAdmin: false`) — el script ahora detecta la
identidad real de cada ventana de login (ya no asume un orden fijo
admin→cliente) porque, en la práctica, la cuenta del cliente terminó
escribiéndose en la primera ventana varias veces seguidas pese al aviso
en pantalla. Confirmado con esa cuenta real: solo ve su dashboard de
ORLANT; los 7 endpoints administrativos probados dan 403; las 7 pestañas
cargan con datos, canvas dibujado y Exportar funcionando; las 5 pestañas
ocultas no aparecen; sin ningún aviso "demo" visible; Calidad descrita
(catálogo vacío, 37 monitoreos sin tocar); "Cambiar mi contraseña"
visible y rechaza una contraseña actual incorrecta. Se corrigieron 2
falsos negativos del propio script en el camino (un `querySelector` sin
acotar a la página activa, y ruido de los propios 403 esperados de las
pruebas de escalada contado como error) — ver el commit para el detalle.
El recorrido de ADMIN no se repitió esta sesión (la cuenta del cliente
se usó también en la segunda ventana) — se apoya en la confirmación
completa de ese mismo recorrido horas antes, en la Fase 118, mismo día.

**Cargas mensuales seguras** (`server/tests/fase119-cargas-multi-mes.test.js`,
26 pruebas, las 7 bases): falla a mitad de carga inyectada (0 filas a
medias, confirmado con un monkey-patch real de `db.prepare` que fuerza
una excepción dentro de la transacción — better-sqlite3 revierte todo);
otra campaña con las mismas fechas no se toca AL ESCRIBIR (no solo al
leer); orden inverso (cargar un periodo anterior después de uno más
reciente); archivo equivocado en la ventana equivocada (400, nunca se
mezcla). 2 hallazgos de COBERTURA (el código ya se comportaba bien, solo
faltaba la prueba ejecutada): Efectividad de Agendamiento no tenía la
prueba de "varios meses reemplaza solo esos meses"; Tráfico de
Llamadas/WhatsApp, Agendas y Tipificación no tenían una prueba dinámica
de "fecha futura → 400" — las 4 se agregaron. De paso se confirmó un
detalle de negocio no obvio: "futura" significa posterior al FIN DEL MES
EN CURSO, no posterior a "hoy".

**Matriz de acceso de las 7 familias de carga masiva**
(`server/tests/fase119-matriz-cargas-masivas.test.js`, 9 pruebas): cierra
el hueco que la Fase 118 dejó explícito (esas 7 solo estaban confirmadas
por lectura de código). **Hallazgo real, severidad BAJA/informativa,
documentado y NO corregido**: Tráfico de Llamadas es la única de las 7
cuya carga no exige `campaignAccess` por campaña puntual — decisión
EXPLÍCITA y ya documentada de una auditoría anterior (`server/routes/
trafico.js`, "Decisión explícita, auditoría 2026-09-15"), porque un solo
archivo trae varias skills que resuelven a campañas distintas vía mapeo.
No se corrige esta fase: arreglarlo exigiría rediseñar el modelo
multi-campaña-por-archivo que Edwin pidió, y el riesgo real hoy es
mínimo (CLINICA AURORA/Hospital La María en cero datos reales). Ver
`docs/pendientes.md` → "De la Fase 119".

**Zonas horarias** (`server/tests/fase119-zonas-horarias.test.js`, 3
pruebas): confirmado con EJECUCIÓN real (2 procesos Node, uno con
`TZ=UTC` y otro con `TZ=America/Bogota`) que `fecha-limites.js`,
`fecha-limites-logic.js` y `tipificacion-logic.js` dan el mismo
resultado bajo las 2 zonas horarias — usan exclusivamente métodos
`getUTC*()` sobre un offset fijo de -5h, nunca la hora local del
proceso. Defecto simulado (métodos locales sensibles a la TZ) y
revertido para confirmar que la prueba detecta un problema real: con el
defecto, una diferencia de un día completo entre los 2 procesos.

**Entrega al cliente**: `docs/procedimiento-carga-mensual.md` (nuevo),
`CHECKLIST_VERIFICACION_EDWIN.md` (nuevo), guía de uso al día (versión
1.10.0 → 1.11.2, faltaba mencionar pantalla completa). Confirmado por
búsqueda (grep) que no hay texto "TODO"/"prueba"/"demo" fuera de lo
esperado, ni nombres de otras campañas, ni rutas de servidor, en el
código del frontend que ve un `CLIENTES_DASH` — consistente con el
chequeo dinámico real contra producción de esta misma fase.

**Fuera de alcance de esta sesión, con motivo documentado** (ver
`docs/pendientes.md` → "De la Fase 119"): barrido visual completo (7
pestañas × tema × 4 tamaños de pantalla), barrido de código muerto a
partir del grafo de `graphify`, XSS dinámico con Playwright, fallas y
carreras de UI (500/red cortada/cambio rápido de pestaña).

`npm test`: 1071/1071 (1033 previas + 38 nuevas: 26 de cargas
multi-mes, 9 de la matriz de cargas masivas, 3 de zonas horarias). `npm
audit`: 0 vulnerabilidades antes y después (sin cambios de
dependencias). Sin cambio de versión — ningún PR de esta fase toca
`server/`/`public/` de forma que cambie el comportamiento de la app para
un usuario real (solo tests, un script de QA ampliado, y docs/HTML de
contenido). Detalle completo en `docs/historico/progress-fases.md` →
Fase 119.
