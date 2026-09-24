# Fase 72 — Auditoría de seguridad y fallos (InConexion Platform)

Fecha: 2026-09-24. Alcance: todo el código en `main` + configuración de despliegue
+ producción (`https://inconexionpruebasclaude.duckdns.org`), revisado en modo
pasivo. Ningún dato se escribió en producción durante esta auditoría; ningún
secreto real aparece en este documento (donde se menciona uno, solo se da
nombre de variable/archivo/commit, nunca el valor).

Metodología: lectura de código + `grep` dirigido, `npm audit`/`npm outdated`
(real y en directorios temporales aislados para `xlsx`/`exceljs`), pruebas HTTP
reales contra el servidor local (`node bootstrap.js`) con los usuarios de
seed-demo de cada rol y un par de usuarios de prueba temporales creados y
borrados en la BD local, `git log --all` completo para secretos, sondeo pasivo
(headers/rutas) contra producción por HTTPS normal, y un recorrido con
Playwright (Node, local) por los 10 roles de seed-demo.

---

## 1. Resumen ejecutivo

La postura general es sólida: JWT sin cookies (sin superficie CSRF), bcrypt
consistente, límite de intentos de login, CSP/HSTS/X-Frame-Options reales en
producción, CORS con lista blanca estricta, SQL siempre parametrizado, cero
vulnerabilidades de `npm audit` en el árbol real del servidor, ningún secreto
real jamás commiteado, sin archivos sensibles alcanzables por HTTP, sin fugas
de stack trace, backups automáticos diarios ya funcionando y confirmados en S3.

Se encontraron **2 hallazgos que sí requieren arreglo** (uno de aislamiento
entre clientes, uno de higiene de exportaciones), y **una limpieza operativa
recomendada** (workflows de un solo uso que nunca se retiraron). El resto de
puntos investigados salió limpio — se documentan igual, con su evidencia, para
que quede constancia de que se revisaron.

---

## 2. Tabla de hallazgos

| # | Área | Severidad | Hallazgo | Evidencia | Estado |
|---|------|-----------|----------|-----------|--------|
| H1 | Permisos / aislamiento entre clientes | **Alta** | `clienteAccess()` en `routes/dashboards.js` concede lectura de **cualquier** cliente a quien tenga el permiso global `cargarDatos`, saltándose el permiso por cliente/campaña (`cliente_X`/`campana_X`). El rol REPORTES tiene `cargarDatos` siempre en `true` (por diseño), así que en producción cualquier usuario REPORTES podía leer los datos operativos completos de un cliente al que nunca se le dio acceso, cambiando el nombre en la URL. | `server/routes/dashboards.js:22-29` (función `clienteAccess`); reproducido en local: `demo_reportes` (solo con `campana_` de 9 clientes) obtuvo `200` y 80 KB de datos reales de `HOSPITAL LA MARIA` en `GET /api/dashboard/HOSPITAL%20LA%20MARIA`, cliente al que NO tiene acceso asignado. Contraste: un usuario de prueba temporal con solo `cliente_ORLANT` recibió `403` correctamente en ambas rutas para otro cliente — confirma que el modelo normal SÍ aísla bien; el bug era específico de esta función. | **Arreglado — PR #137 (merged, desplegado)** |
| H2 | Exportaciones a Excel | Media | Ningún export (`XLSX.utils.json_to_sheet`/`aoa_to_sheet` en `historial.js`, `dashboard-generic.js`, `trafico.js`, `trafico-whatsapp.js`, `calidad.js`) neutralizaba celdas de texto libre que empiecen con `=`, `+`, `-` o `@` antes de escribirlas. Esas celdas pueden venir de datos cargados por Excel (skill, nombre de asesor/líder, cola de WhatsApp, detalle de historial). Si alguien abre el `.xlsx` exportado en Excel/LibreOffice, esas celdas pueden interpretarse como fórmula en vez de texto (inyección de fórmulas / CSV injection, OWASP). | Los 5 sitios que re-exportan datos reales (no las plantillas en blanco, que solo tienen encabezados/ejemplos estáticos) pasaban valores de texto libre a `XLSX.utils.*` sin ningún saneador. | **Arreglado — PR #138 (merged, desplegado)** |
| H3 | GitHub Actions / CI | Baja-Media (higiene, no explotable directamente) | 13 workflows de "un solo uso" de fases ya cerradas seguían en el repo con acceso real a producción (rol OIDC de AWS + SSH), en vez de haberse retirado como marca la disciplina ya documentada del proyecto (ver Fase 67). Todos requerían `workflow_dispatch` manual (no alcanzables por un atacante externo sin acceso de escritura al repo), pero era superficie innecesaria. | Ver lista completa en §4 (eran 13, no 12 como dije al preguntarte — corrijo aquí el conteo). | **Retirados — PR #141 (merged, aprobado por ti en el chat)** |
| N1 | Login / enumeración de usuarios | Baja | `routes/auth.js` respondía `401` inmediato (sin `bcrypt.compare`) cuando el usuario no existe, pero sí hacía `bcrypt.compare` (≈60-100ms) cuando el usuario existe pero la contraseña es incorrecta. Un atacante con acceso de red preciso podría inferir qué usuarios existen por el tiempo de respuesta. Mitigado en parte por el rate-limit de login (20 intentos/15 min). | `server/routes/auth.js:44-47` | **Arreglado — PR #139 (merged, desplegado)** |
| N2 | Límite de tamaño de body JSON | Baja (nota operativa, no vulnerabilidad) | `express.json({ limit: '100kb' })` era global y fijo; `traficoCargaBody` permite hasta 5000 filas, que en la práctica podría superar 100kb con datos reales de varios meses. | `server/server.js:103`, `server/validation.js` (`traficoCargaBody.filas.max(5000)`) | **Arreglado (100kb → 2mb) — PR #140 (merged, desplegado)** |
| B1 | Backups — prueba de restauración | Info (gap operativo, IAM pendiente) | Nunca se había probado restaurar un backup real. Al correrlo de verdad, salió otro gap real: el usuario IAM `inconexion-instance` tiene `s3:GetObject` sobre `db-backups/*` (por eso el backup SÍ sube bien) pero le falta `s3:ListBucket` sobre el bucket, así que el workflow no puede listar cuál es el backup más reciente para descargarlo. | Corrida real 2026-09-24 20:53 UTC: `AccessDenied ... s3:ListBucket on resource "arn:aws:s3:::inconexion-backups-877538609452"`. Herramienta construida y lista (PR #142, ya fusionada); falta el permiso de IAM — ver §5. | **Herramienta lista, falta 1 permiso de IAM (tuyo, en AWS)** |
| L1 | Logs reales de producción | Info (gap operativo, IAM pendiente) | No había forma de traer los errores reales de producción sin acceso manual. Al correrlo de verdad: el rol OIDC `inconexion-github-deploy` no tiene `logs:FilterLogEvents` sobre `/inconexion/prod/*`. | Corrida real 2026-09-24 20:53 UTC: `AccessDeniedException ... logs:FilterLogEvents ... log-group:/inconexion/prod/docker`. Se encontró además que el workflow original escondía este error como "0 eventos" — corregido en PR #143 (para que un fallo de permiso nunca se confunda con "no hay errores"). | **Herramienta lista y corregida, falta 1 permiso de IAM (tuyo, en AWS)** |

**Todo lo demás investigado salió limpio** (sin hallazgo) — ver el detalle
punto por punto en la §3, con la evidencia de cada verificación.

---

## 3. Detalle por punto del pedido (con evidencia)

### 3.1 Auth / sesión — limpio
- Hash: `bcryptjs`, costo 10, consistente en altas y en rotación de contraseñas
  (`server/scripts/seed-demo-lib/users.js`, `server/routes/usuarios.js`).
- Límite de intentos: `express-rate-limit` dedicado al login
  (`server/routes/auth.js:17-24`), 20 intentos/15 min, solo cuenta fallidos
  (`skipSuccessfulRequests`) para no bloquear una oficina entera.
- Sesión: JWT sin estado, `JWT_EXPIRES_IN` por defecto 8h, **sin cookies en
  absoluto** (el token vive solo en memoria del navegador) — sin superficie
  CSRF que cubrir.
- Suspensión de usuario: probado en vivo — un usuario `active=0` recibe `403`
  **en el login mismo**, nunca llega a obtener un token (más estricto de lo
  mínimo necesario).
- `getActor()` relee el usuario fresco de la BD en cada request — un cambio de
  rol/permiso surte efecto de inmediato, sin esperar a que expire un token
  viejo.

### 3.2 Permisos por rol / aislamiento entre clientes — 1 hallazgo (H1), resto limpio
- Confirmado en vivo con un usuario de prueba temporal (creado y borrado en la
  BD local, nunca en producción) con permiso *solo* de `cliente_ORLANT`:
  pidió otro cliente por URL y body → `403` en `GET /dashboard/:cliente`,
  `GET /dashboard/cargas` y `POST /dashboard/cargas`. El modelo normal aísla
  bien.
- `/monitoreos/mios` (portal ASESOR) resuelve la identidad del actor **desde
  el JWT verificado en el servidor**, nunca desde un parámetro que mande el
  cliente — un ASESOR no puede pedir los resultados de otro asesor cambiando
  nada en la petición (`server/routes/calidad.js:125-135`).
- `calidad.js`/`trafico.js`/`trafico-whatsapp.js` usan `campaignAccess()`
  (scoping real por campaña) de forma consistente, sin el atajo que sí tiene
  `dashboards.js` (H1).
- Excepción encontrada: **H1** arriba.

### 3.3 Validación de entrada / SQL / XSS / inyección de fórmulas
- **zod**: se revisaron los 32 `router.post/put/delete` del backend — 31
  tienen `validate(schemas.X)` explícito. El único sin validar es
  `DELETE /dashboards/config/:cliente` (`server/routes/dashboards.js:205`):
  usa el `cliente` de la URL solo en una consulta parametrizada
  (`WHERE cliente = ?`) y la ruta ya exige `isFullAdmin`, así que no hay
  riesgo real de inyección ni de escalamiento — es una inconsistencia menor
  de estilo, no una vulnerabilidad. Se deja anotado, arreglo opcional de bajo
  riesgo (agregar el mismo patrón de validación por consistencia).
- **SQL**: `grep` de todo `server/` buscando concatenación de
  query/params/body dentro de `db.prepare`/`db.exec` — el único resultado
  (`scripts/seed-demo-lib/marks.js`) interpola un nombre de TABLA fijo
  (nunca alcanzable desde HTTP, solo desde el script de CLI de seed-demo).
  Ninguna ruta HTTP concatena SQL. Limpio.
- **XSS**: existe un helper único `esc()` (`public/js/esc.js`) con su propio
  test de regresión (`server/tests/xss-frontend.test.js`). Barrido heurístico
  de los 151 sitios `innerHTML`/`insertAdjacentHTML` en `public/js/`: los
  campos de texto libre de mayor riesgo (nombre de asesor, `skillName` de
  Excel de Volvox, nombre de campaña/cliente) están envueltos en `esc()` en
  cada sitio verificado — `public/js/trafico.js:191-192` (skillName, el caso
  de más riesgo real porque viene directo de un Excel), `public/js/calidad.js:289`
  (nombre de asesor). Los campos sin `esc()` que aparecieron en el barrido
  (`clasificacion`, `nivelCritico`, montos, IDs) son **valores calculados por
  el servidor de un conjunto fijo de strings** (`server/calidad-logic.js:42-56`),
  nunca texto libre del usuario — sin riesgo aunque no lleven `esc()`. No se
  hizo revisión línea por línea de los 151 sitios, pero el patrón es
  consistente en cada muestra de alto riesgo revisada.
- **Inyección de fórmulas en exports**: ver **H2**.

### 3.4 Carga de archivos
- El servidor **nunca recibe un archivo crudo**: no hay `multer` ni ningún
  middleware de `multipart/form-data` en todo `server/`. El Excel se parsea
  en el navegador del usuario (librería `xlsx` cargada en `public/js/`) y
  solo se envía JSON ya parseado a la API — confirmado también por el propio
  comentario de cabecera de `public/js/cargas.js`. Esto significa que un
  Excel malicioso (zip bomb, archivo corrupto) como mucho cuelga la pestaña
  del navegador de quien lo sube — nunca llega a tocar el servidor ni afecta
  a otros usuarios. Diseño ya seguro por construcción; no aplica el resto de
  la pregunta (tamaño/tipo de archivo) porque no hay endpoint de subida.
- Lo que sí limita el tamaño de la carga ya parseada es `express.json({limit:'100kb'})`
  — ver **N2**.

### 3.5 Headers / configuración
- Confirmado con una petición real (equivalente a curl) contra
  `https://inconexionpruebasclaude.duckdns.org`: CSP explícita presente,
  `X-Frame-Options`, `X-Content-Type-Options: nosniff`,
  `Strict-Transport-Security` presentes (`helmet` en `server/server.js`).
- CORS: lista blanca explícita (`config.corsOrigins`), nunca `origin:true` ni
  `*`; `config.js` fuerza `CORS_ORIGIN` obligatorio y con formato `https://`
  en producción.
- Apps móvil/escritorio (Capacitor/Electron, retiradas en Fase 70): la propia
  investigación de esa fase confirmó que nunca necesitaron un origen CORS
  especial — ambas solo abrían la URL real de siempre en un webview, sin
  origen propio. Nada que limpiar aquí — confirmado de nuevo por búsqueda en
  `server/config.js`/`server.js`: no hay ningún origen tipo `capacitor://` o
  `file://` en el código.
- Errores: el manejador central de errores (`server.js`, al final) siempre
  responde `500 {"error":"Error interno del servidor"}` al cliente — el
  stack trace real solo va a `console.error` (logs del servidor), nunca a la
  respuesta HTTP.
- Rutas sensibles: sondeadas por HTTPS normal contra producción —
  `/.env`, `/.git/config`, `/server/data/inconexion.db`, `/package.json` no
  exponen el archivo real (la ruta SPA catch-all devuelve el `index.html` de
  siempre con 200, lo cual es seguro porque `express.static` solo sirve
  `public/`, nunca el resto del árbol).

### 3.6 Dependencias
- `npm audit` en `server/`: **0 vulnerabilidades**.
- `npm outdated`: sin cambios relevantes de seguridad pendientes.
- `xlsx`/`exceljs` (riesgo ya aceptado en fases previas): re-chequeado en
  directorios temporales aislados (nunca agregados como dependencia real) —
  sigue sin haber una versión corregida de `xlsx` para el CVE conocido de
  ReDoS/prototype pollution; se sigue usando client-side únicamente (nunca en
  el servidor), que es la mitigación ya adoptada. Sin cambios respecto a lo
  ya documentado.

### 3.7 Secretos en git — limpio
- `git log --all -p` completo (259 commits) + `grep` de patrones de AWS keys,
  bloques PEM, hashes bcrypt, y asignaciones a nombres de variable de secreto
  conocidos: el único hash bcrypt que aparece alguna vez en todo el historial
  es un placeholder dummy ya conocido (usado repetidamente como
  `MASTER_ADMIN_PASSWORD_HASH` desechable en contenedores QA temporales de
  fases anteriores) — no es un secreto real.
- `server/.env` (el archivo real con secretos de desarrollo local) **nunca
  estuvo trackeado en git** — `git log --all -- server/.env` no devuelve
  nada; solo `server/.env.example`/`app.env.example` (plantillas sin
  valores) están versionados. `.gitignore` excluye `.env`, `app.env`,
  `server/.env` y `*.env` explícitamente.
- Ningún nombre de archivo sensible (`*.pem`, `*credentials*`, `*.key`) fue
  agregado nunca al historial (`git log --all --diff-filter=A --name-only`).

### 3.8 GitHub Actions — ver H3
- Todos los workflows disparan solo con `workflow_dispatch` (manual) o, en el
  caso de `deploy.yml`, con `workflow_run` apuntando **al propio** workflow
  "CI" del mismo repo (nunca a un repo de terceros) — sin `pull_request_target`
  en ningún archivo, sin riesgo de "PR malicioso ejecuta con secretos".
  `ci.yml` (el único que corre con `pull_request`/`push` automático) no usa
  ningún secret — sin riesgo de fuga por PR de un fork.
- `permissions:` está presente y acotado (`id-token: write, contents: read`)
  en todos los workflows con acceso a AWS — sin permisos de más.
- Acciones (`uses:`) todas fijadas a versión mayor de publicadores oficiales
  (`actions/*`, `aws-actions/*`) o de terceros muy establecidos
  (`appleboy/ssh-action`) — ninguna apunta a una rama mutable (`@main`).
  Fijar a SHA exacto sería más estricto todavía, pero es una mejora opcional
  de bajo impacto, no una vulnerabilidad.
- Lista completa de qué sigue teniendo acceso real a producción: §4.

### 3.9 Producción (sondeo pasivo) — limpio
- Headers, TLS (vía Caddy, `Alt-Svc: h3`) y rutas sensibles ya cubiertos en
  §3.5. Ninguna prueba agresiva, de fuerza bruta ni de carga se ejecutó
  contra producción — solo peticiones equivalentes a un `curl` normal.

### 3.10 Backups — ver §5 (necesita tu decisión para una parte)
- Mecanismo confirmado en el propio repo: `server/scripts/backup.js` (backup
  online de SQLite, `better-sqlite3.backup()`, consistente aunque el
  servidor esté escribiendo) + `deploy/inconexion-backup.timer` (diario,
  03:15, con `Persistent=true`) + `deploy/inconexion-backup.service`
  (corre el script dentro del contenedor, `--keep 14` copias locales).
- Según `PROGRESS.md` (líneas 134, 252-260, 272): el timer está **activo en
  producción**, sube a un bucket S3 versionado
  (`inconexion-backups-josedavidosorio2005`, acceso público bloqueado), con
  IAM de mínimo privilegio (solo prefijo `db-backups/`). Una corrida de
  prueba ya subió un backup real y verificado
  (`inconexion-20260910-160854.db`, 221 KB, 2026-09-10 — hace ~2 semanas).
  CloudWatch retiene esos logs 90 días.
- **Lo que NO está confirmado**: nunca se ha probado una *restauración* real
  (bajar un backup de S3 y cargarlo en un servidor para confirmar que el
  archivo sirve) — `PROGRESS.md` solo documenta el *procedimiento* de
  recuperación (recrear con el runbook + restaurar el último backup de S3),
  no una prueba real ya hecha. Ver §5.

### 3.11 Errores reales de producción
- **No investigado en esta pasada** — requiere acceso de lectura a
  producción (logs de CloudWatch `/inconexion/prod/docker`) y no hay hoy un
  workflow de solo lectura ya existente que los traiga; crear uno nuevo toca
  CI. Ver §5 para la pregunta.

### 3.12 Casos límite de carga de datos — limpio
- Hoja/fila vacía: cubierto con tests dedicados
  (`server/tests/cargas-logic.test.js` — `cargasHojaVacia`, hoja ausente vs.
  vacía vs. con fórmula sin calcular).
- Fechas como texto vs. serial de Excel: `public/js/trafico-logic.js:38` y
  `public/js/trafico-whatsapp-logic.js:27` — conversión con aritmética UTC
  explícita "sin depender de la zona horaria" (cubre el cruce de mes en
  Colombia UTC-5), con test dedicado.
- Comas vs. puntos en decimales: manejado explícitamente —
  `String(v).trim().replace(',', '.')` antes de `Number()`/`parseFloat()` en
  `trafico-logic.js`/`trafico-whatsapp-logic.js` (múltiples sitios).
- Porcentajes 0-1 vs. 0-100: dos funciones separadas y documentadas —
  `traficoPctDesdeTexto` (ya viene 0-100) vs. `traficoPctDesdeFraccion`
  (`* 100`, para columnas que Wolkvox manda como fracción 0-1) —
  `public/js/trafico-logic.js:118-134`.
- Filas duplicadas: tests de migración dedicados por cliente
  (`orlant-kpis-whatsapp-duplicados-migracion.test.js`,
  `sascha-bivett-kpis-duplicados-migracion.test.js`,
  `trafico-kpis-duplicados-migracion.test.js`).
- No se encontró ningún caso límite de esta lista sin cubrir.

### 3.13 Recorrido por rol (Playwright, local)
- Los 10 roles de seed-demo (ADMIN, AUX_ADMIN, CALIDAD, INVENTARIO, GERENCIA,
  GESTION_HUMANA, CLIENTES_DASH, SUPERVISOR, ASESOR, REPORTES) iniciaron
  sesión correctamente contra el servidor local: **0 errores de consola, 0
  peticiones fallidas (ninguna respuesta 5xx), ninguna pantalla en blanco**
  en la página de aterrizaje.
- El rol CLIENTES_DASH aterriza en el selector de módulos con los badges
  "Sin acceso" correctos en los módulos que no le tocan (captura:
  `docs/capturas-demo/fase72-seguridad-y-fallos/walkthrough-clientes_dash.png`).
  El rol ASESOR navegó un paso más adentro sin errores.
- No se hizo clic exhaustivo panel por panel de cada pestaña de ORLANT en
  esta pasada (quedaría para una revisión de UI más larga) — lo ya cubierto
  en Fases 66-71 con verificación real en producción para ORLANT (números de
  referencia de Tráfico) sigue siendo la evidencia más fuerte de que esas
  pantallas concretas funcionan.

---

## 4. Workflows con acceso real a producción hoy

Mecanismo común a todos: rol OIDC de AWS (`AWS_DEPLOY_ROLE_ARN`) + apertura
temporal del puerto 22 solo para la IP del runner + SSH
(`DEPLOY_SSH_HOST/USER/KEY`). Todos son `workflow_dispatch` (disparo manual).

**De uso general / recomendado mantener:**
- `deploy.yml` — el pipeline de despliegue real, se dispara solo al terminar CI en verde.
- `audit-instance.yml` — auditoría de permisos de la instancia, solo lectura, ya pensado para reusarse.
- `seed-demo.yml` — sembrar/limpiar datos de demo en producción, operación recurrente documentada en el README.

**De un solo uso, ya cumplieron su propósito (candidatos a retirar — pido tu confirmación en §5):**
- `auditoria-3-campanas-produccion.yml`
- `carga-real-trafico-whatsapp-orlant-produccion.yml` (este **escribió** datos reales una vez, Fase 56)
- `diagnostico-aht-6-clientes-produccion.yml` (Fase 65)
- `diagnostico-dashboard-produccion.yml`
- `diagnostico-fase66-orlant-agosto-produccion.yml` (Fase 66)
- `qa-datos-prueba-trafico-salida-orlant.yml` (carga datos de **prueba** — posible origen de los datos "Asesor Prueba" de la Fase 71, que ya quedó como decisión aparte)
- `verificacion-plantilla-produccion.yml`
- `verificar-filtros-colores-produccion.yml`
- `verificar-graficas-orlant-produccion.yml`
- `verificar-mapeo-skill-produccion.yml` (Fase 32)
- `verificar-orlant-ocultar-pestanas-produccion.yml` (Fase 40b)
- `verificar-orlant-subpestanas-produccion.yml` (Fase 40)
- `verificar-permiso-historial-y-routers-produccion.yml`

---

## 5. Lo que necesita tu decisión

Estado tras tus respuestas en el chat (todas "sí, adelante"):

1. **H1** — arreglado y desplegado (PR #137).
2. **H3 / lista de workflows (§4)** — retirados los 13 (PR #141, ya fusionada
   con tu aprobación explícita).
3. **N1 (timing de login)** — arreglado y desplegado (PR #139).
4. **Backups (prueba de restauración real) + logs reales de producción** —
   PR #142 fusionada y ambos workflows disparados de verdad contra
   producción. Resultado: **ninguno de los dos pudo completarse todavía**,
   no por un bug de la herramienta sino porque a los permisos de AWS ya
   existentes les falta un permiso puntual de solo lectura para cada uno
   (nunca de escritura). Necesito que TÚ hagas este cambio en la consola de
   AWS (no tengo — ni debo tener — acceso para modificar políticas de IAM):

   - **Para probar restauración de backups**: agrega `s3:ListBucket` al
     usuario IAM `inconexion-instance`, sobre el bucket
     `inconexion-backups-877538609452`, idealmente con una condición
     `s3:prefix` limitada a `db-backups/*` (mismo alcance que ya tiene su
     `GetObject`, solo que a nivel de bucket en vez de objeto — no le da
     acceso a nada nuevo que no pueda ya descargar).
   - **Para ver logs reales**: agrega `logs:FilterLogEvents` (y
     `logs:GetLogEvents` si quieres margen) al rol
     `inconexion-github-deploy`, scoped a los ARNs de
     `/inconexion/prod/docker` y `/inconexion/prod/backup`.

   En cuanto lo agregues, aviso y vuelvo a disparar los dos workflows
   (`verificar-restore-backup-produccion.yml`,
   `verificar-logs-produccion.yml`) para darte el resultado real.

Nada quedó bloqueado esperando: mientras tanto ya se arregló también H2 y N2
(ver tabla de arriba), que no requerían tu decisión.
