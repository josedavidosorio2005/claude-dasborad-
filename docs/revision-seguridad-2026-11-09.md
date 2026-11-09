# Revisión de seguridad y bugs — 09/11/2026 (Fase 309)

Producción revisada en `1.154.0`, **solo lectura**. Prioridad: lo tocado en las Fases 298–308
(carga del SUPERVISOR, Agendas, Inasistencia, Encuestas, Calidad en ORLANT/Aurora, filtros por
campaña, usuarios asesores). Revisión con tiempo límite de 30 minutos: es una pasada enfocada, no
una auditoría completa. Sin datos reales.

## Cómo se revisó

- **Código del backend** (no solo botones ocultos): `server/auth.js` (`campaignAccess`,
  `canLoadModule`, `canEvaluateCampaign`), `server/routes/aurora-bases.js`, `server/routes/calidad.js`
  (monitoreos, metas), `server/validation.js` (esquemas de carga), `server/server.js` (límites).
- **Matriz de acceso automática** (`fase118-matriz-acceso.test.js`): cada ruta de la API está
  declarada con su política y se prueba con 10 roles contra una campaña propia y una ajena; una
  ruta nueva sin declarar hace fallar la suite. Incluye las rutas nuevas de las Fases 299–307.
- **Producción, solo lectura:** cabeceras HTTP de `/` y `/api/health` (un GET), y el recorrido de
  demo de la Fase 308 (misma versión `1.154.0`, mismo día).
- `npm audit`, búsqueda de secretos en el repo y en el historial reciente, suite completa.

## Hallazgos

| # | Hallazgo | Severidad | Dónde | Arreglado |
|---|---|---|---|---|
| 1 | `GET /metas?campana=X` devolvía a la **cuenta cliente** el nombre de los líderes de Calidad (son quienes evalúan). `/metas/cumplimiento` y `/monitoreos` ya lo quitaban. | Alta | `server/routes/calidad.js` (`GET /metas`) | **Sí** (v1.154.1): para la cuenta cliente `liderNombre` va vacío. Prueba `fase309-revision-seguridad`. |
| 2 | La carga de un módulo no comprueba que el módulo sea de esa campaña: un SUPERVISOR con acceso a la campaña X podría mandar filas de «Inasistencia (Aurora)» para X. No da acceso a datos de otra campaña (se exige acceso a X); solo dejaría filas que ninguna pestaña de X muestra. | Baja | `server/routes/aurora-bases.js` y demás rutas de carga (`canLoadModule` + `campaignAccess`) | No (reportado) |
| 3 | El permiso `cargarDatos` se puede asignar a cualquier rol desde Usuarios; si un administrador se lo da a una cuenta cliente, esa cuenta podría cargar en su campaña. Es configuración intencional, no un fallo del código. | Baja | `server/auth.js` (`canLoadData`) | No (reportado) |
| 4 | La CSP permite `'unsafe-inline'` en scripts y estilos (la app usa `onclick` en línea). Mitigado: sin orígenes externos, `object-src 'none'`, `frame-ancestors 'self'`. Quitarlo es un cambio grande. | Baja | Cabeceras de producción (helmet) | No (reportado) |
| 5 | El inicio de sesión **distingue mayúsculas** en el usuario; un bloc de credenciales con el usuario en mayúsculas no sirve. No es un fallo de seguridad (es más estricto). | Informativa | `server/routes/auth.js` | No (anotado en `pendientes-2026-11-10.md`) |

## Lo que se comprobó y está bien

1. **Permisos.** Rutas de carga: `canLoadModule` (administrador, `cargarDatos`, SUPERVISOR o
   CALIDAD con `cargar_<módulo>`) **y** `campaignAccess`; ASESOR y CLIENTE reciben 403 (matriz
   automática + pruebas de las Fases 299 y 306). Calificar: `canEvaluateCampaign` solo
   administrador o SUPERVISOR/CALIDAD con `campana_<X>`; ASESOR, CLIENTE y líderes de otra campaña
   reciben 403 (prueba de la Fase 307). Rutas de admin: `requirePermission` (crear/editar usuarios,
   plantillas). Un SUPERVISOR sin la campaña asignada recibe 403 al leer y al cargar.
2. **Fuga entre campañas.** Toda lectura pide `campana` y pasa por `campaignAccess`; la matriz
   prueba cada ruta con campaña propia y ajena (403 en la ajena). Las rutas nuevas de Aurora
   filtran por `campana` en el SQL.
3. **Calidad y el cliente.** `GET /monitoreos` para la cuenta cliente sale sin evaluador,
   observaciones ni teléfono (`privacidad.monitoreosParaCliente`, prueba de la Fase 307);
   `/metas/cumplimiento` sin nombre del líder; `GET /metas` arreglado (hallazgo 1).
4. **Cargas de Excel.** El Excel se lee **en el navegador**; al servidor solo llegan conteos
   agregados validados con esquemas estrictos (`strictObject`: un campo de más, como cédula o
   nombre, da 400). No hay subida de archivos ni rutas de archivo controladas por el usuario
   (`archivoNombre` es solo texto, máximo 200 caracteres). Límites: JSON de 2–8 MB según la ruta
   (40 MB solo para SURA), máximo de filas por carga (5.000 inasistencia, 20.000 encuestas). Las
   tablas nuevas solo guardan mes, especialidad/entidad, fecha y conteos.
5. **Secretos.** Ningún archivo de credenciales (`usuarios_*.txt`, `.env`, llaves, `storageState`)
   en el repo ni en el historial; ninguna clave con forma real en el código ni en los últimos 30
   commits (solo claves de prueba de los tests). Los blocs de credenciales de asesores quedaron
   fuera del repo. `npm audit`: 0 vulnerabilidades.
6. **Sesión.** El token de sesión vive **en memoria** del navegador (no en cookies ni en
   `localStorage`), así que no aplica httpOnly/secure y no hay cookie que robar. Límite de intentos
   de login por IP + usuario y otro solo por usuario (ventana larga), con registro en el Historial.
   Contraseña asignada por un administrador obliga a cambiarla al primer ingreso. Cabeceras en
   producción: HSTS con preload, CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP; sin `X-Powered-By`.
7. **Bugs.** Suite completa en verde (ver el PR). Consola en producción (recorrido de la Fase 308,
   Aurora con todas sus pestañas, HLM, Mobilize y SURA, 1440 y 375 px): 0 errores, 0 respuestas de
   más de 3 s. Los 21 errores al cargar Inasistencia son de la librería de Excel con el `.xls` viejo.

## ORLANT

No se encontró nada en ORLANT. El arreglo del hallazgo 1 es del servidor, común a todas las
campañas: solo cambia lo que recibe una **cuenta cliente** en `GET /metas` (sin el nombre del
líder); ningún cálculo ni pantalla de ORLANT cambia.
