# PROGRESS — InConexión Platform

Fuente de verdad del avance. **Aditivo**: se añaden entradas al cerrar cada fase,
no se reescribe.

Rama de trabajo: `main` (mergeado desde `feat/dashboards-pro-y-aws`).
Última actualización: **2026-09-09**.

---

## Fase 0 — Auditoría de punto de partida

Estado real del proyecto **antes** de este bloque de trabajo (commit `64cf731` y
anteriores), y dónde quedó **después**:

| Fase de este documento | Antes | Después | Evidencia |
|---|---|---|---|
| **1** — Backend Calidad/Metas | ✅ Ya hecho | ✅ sin cambios | `calidad.js`/`metas.js` van contra `/api/...`, 0 usos de `localStorage` para persistir; tablas `monitoreos`, `cronograma_metas`, `calidad_plantillas` en `db.js`; cálculos en `server/calidad-logic.js`; `REAL_DATA_REPORT.md` |
| **2** — Dashboards configurables | 🟡 Parcial | ✅ Completo | Existía `dashboards_config` + `dashboard-generic.js` + `dashboards-admin.js`, pero: (a) el motor solo hacía "último valor", sin análisis; (b) el constructor visual **no tenía DOM** (el botón fallaba); (c) solo line/bar/pie/tabla. Todo resuelto en M1–M2. |
| **3** — Dashboards de cliente restantes | ❌ Faltaban 9 | ✅ Completo (con supuestos) | 3 dashboards migrados ya estaban; los 9 restantes creados en M3 por plantilla estándar. 12 en total, todos por configuración. |
| **4** — Inventario y Gerencia | 🟡 Módulos propios | ✅ Sobre el sistema configurable | Existían como modales bespoke con tablas/API propias. M4 los expone además por el motor genérico (adaptadores). |
| **5** — Seguridad/estabilidad | ✅ Ya hecho | ✅ + endpoints nuevos cubiertos | `config.js` fail-fast, CSP, CORS whitelist, rate-limit global + login, graceful shutdown, error handler central (commit `0bf69d1`/`64cf731`, `DEPLOY_REPORT.md`). Los endpoints nuevos (adaptadores) son GET con `can(actor, ...)`. |
| **6** — Infra AWS | ❌ Solo Docker genérico | 🟡 Código listo, deploy real pendiente | Existían `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile`, `backup.js` (solo local), `ci.yml`. M5–M6 añaden SSM, S3, systemd, CloudWatch, IAM y el pipeline. Falta ejecutarlo con una cuenta AWS. |
| **7** — Verificación por rol | Parcial (tests de permisos) | ✅ Matriz de 9 roles | `server/tests/role-matrix.test.js` (nuevo). |
| **8** — Reporte de lanzamiento | — | ✅ | `LAUNCH_REPORT.md` + `AWS_DEPLOY_REPORT.md`. |

Tipos de panel soportados **antes**: `kpi_row, line, bar, pie, combo, tabla,
calidad_kpis, calidad_pie`. **Ahora** además: `area`, y todo panel de serie es
conmutable a líneas/barras/área por el visor.

Infra de despliegue **antes**: `server/Dockerfile` (multi-stage), `docker-compose.yml`
(app + Caddy opcional), `deploy/Caddyfile`, `.github/workflows/ci.yml` (test Node
18/20/22 + docker build). Sin nada específico de AWS.

---

## Fase 1 — Backend Calidad y Metas

**Estado: ✅ ya estaba hecho** (trabajo previo, `REAL_DATA_REPORT.md`). No se
repitió. Verificado en Fase 0 y por la suite (`calidad.test.js`).

---

## Fase 2 — Sistema de dashboards configurables, nivel profesional

**Estado: ✅ completo.** Commits `949e533` (M1) y `dc84b78` (M2).

| Sub | Qué se hizo |
|---|---|
| 2.1 Motor | Ya existía (`dashboards_config`, `dashboard-generic.js`). |
| 2.2 Tipos de panel | + `area`. Total: kpi, barras, líneas, área, pie/donut, combo, tabla. |
| 2.3 Análisis | Tendencia vs periodo de comparación (abs + %), vs meta (número o columna), tendencia de N periodos (series), **resaltado de alerta** (`alerta: {min,max,caidaPct}`), **filtro/selector "Comparar contra"**. |
| 2.4 Visual | Tarjetas KPI de BI con flecha/color de tendencia y barra de meta; `loFmt()` (miles, %, mm:ss en ejes/tooltips/datalabels); design tokens de `styles.css`. |
| 2.5 Constructor visual | **Se añadió el modal que faltaba en `index.html`.** Elegir cliente, secciones, KPIs, paneles, tipo de gráfico, fuente; **reordenar paneles**; **"Previsualizar"** contra datos reales sin guardar. Fix `f282293`: el round-trip conserva `meta/mejorDireccion/alerta`. |
| 2.6 Personalización por visor | Botones Líneas/Barras/Área por panel; preferencia en `localStorage` por cliente, no afecta a otros ni requiere permiso. |
| 2.7 Exportación | Excel (`.xlsx` real: hoja KPIs + hoja por panel con datos calculados) y PDF/impresión. |
| 2.8 Migrar legado | Los 3 dashboards de código (`dashboard-aurora/orlant/hlm.js`) **ya habían sido eliminados** en el commit previo; viven como config. Verificado que no se pierde ninguna pestaña. |
| 2.9 Verificación | Chrome headless sobre Aurora + INFONDO + 3 dashboards más con datos multi-periodo reales: tendencias, metas, alertas, tipos de gráfico y export OK. |

---

## Fase 3 — Dashboards de cliente restantes

**Estado: ✅ completo, con supuestos de negocio documentados.** Commit `7124505` (M3).

`server/dashboard-plantillas-cliente.js`: 3 plantillas estándar de contact center
generadas por configuración (sin código por cliente).

| Cliente | Plantilla | Calidad |
|---|---|---|
| TELEVENTAS SURA, TELEVENTAS COMFAMA | Ventas salientes | sí |
| PANTERA MAIKERS | Ventas salientes | no |
| ANDRES YEPES, MOVILIZE, ALBERTO LINERO GO | Ventas salientes | Yepes/Movilize sí |
| INFONDO | Cobranza / cartera | sí |
| SASCHA FITNESS | Atención + pedidos | sí |
| BIVETT | Atención + agendas (deja de ser demo) | sí |

**Pendiente de negocio** (no bloquea; se ajusta desde el constructor visual):
confirmar qué operación son PANTERA MAIKERS y MOVILIZE; si YEPES/LINERO/SASCHA son
televentas o marca personal; metas reales por cliente. Detalle en
`AWS_DEPLOY_REPORT.md` §6.1.

Permisos: sin cambios. `server/tests/dashboard.test.js` verifica que un
`CLIENTES_DASH` sin `cliente_INFONDO` recibe 403 y con el permiso 200.

---

## Fase 4 — Inventario y Gerencia

**Estado: ✅ completo sobre el sistema configurable.** Commit `bfffc9f` (M4).

`server/dashboard-adapters.js`: `INVENTARIO` y `GERENCIA` se renderizan con el
**mismo** motor genérico (paneles, análisis A6, exportación), leyendo de sus
tablas propias (`inventario_*`, `gerencia_kpis`) en vez de `dashboard_cargas`.

- Los modales de gestión siguen siendo la entrada de datos; se añadió botón
  **"Ver dashboard"**.
- Gerencia: % de cumplimiento de metas por mes con tendencia real.
- Inventario: foto de stock + entradas/salidas por mes, alerta de "sin stock".

**Pendiente de negocio**: umbral de bajo stock **por ítem** (hoy la alerta es
`cantidad = 0` porque no hay campo `minimo`); dirección de cada meta ejecutiva
(hoy `valor >= meta` para todas). Detalle en `AWS_DEPLOY_REPORT.md` §6.2.

---

## Fase 5 — Seguridad y estabilidad

**Estado: ✅.** Base ya endurecida en trabajo previo (`DEPLOY_REPORT.md`).
Añadido en este bloque:

- `server/secrets.js` + `server/bootstrap.js`: secretos desde AWS SSM en
  producción, sin `.env` en disco; fallback transparente en local/test.
- Endpoints nuevos (adaptadores Inventario/Gerencia): solo GET, protegidos por
  `can(actor, 'Inventario' | 'Gerencia')`; no aceptan escritura.
- `ci.yml`: el job docker-build ahora **arranca el contenedor y verifica
  `/api/health`** (smoke test real de la imagen).
- Suite: **68/68** (`calidad`, `dashboard`, `inventario-gerencia`, `permissions`,
  `rate-limit`, `validation`, `auth`, `no-password-leak`, `role-matrix`).

---

## Fase 6 — Infraestructura y despliegue en AWS

**Estado: 🟡 código y documentación listos; deploy real pendiente de cuenta AWS.**
Commits `209b926` (M5), `e5f60f6` (M6).

| Sub | Estado |
|---|---|
| 6.1 Arquitectura | ✅ Elegida: **Lightsail + Docker + Caddy + disco de bloques**. Alternativa RDS/multi-instancia documentada con la señal de migración (`AWS_DEPLOY_REPORT.md` §2). |
| 6.2 Secretos | ✅ SSM Parameter Store (`SecureString`). Comandos exactos en `AWS_DEPLOY_REPORT.md` §3. Parameter Store por defecto (gratis); Secrets Manager si se quiere rotación. |
| 6.3 Red / IAM | ✅ Security Group documentado (443/80 público, SSH a tu IP); `CORS_ORIGIN` obligatorio en prod (ya lo fuerza `config.js`); `deploy/iam-policy-instance.json` de mínimo privilegio + rol de deploy sin `AdministratorAccess`. |
| 6.4 Dominio / HTTPS | ✅ Documentado (Route 53 o registrador → IP estática; Caddy saca el cert solo). §5. |
| 6.5 Backups | ✅ `scripts/backup.js` sube a S3 (versionado) + `deploy/inconexion-backup.{service,timer}` (systemd, diario 03:15). |
| 6.6 Logs / monitoreo | ✅ `deploy/cloudwatch-agent-config.json` (logs de contenedores + métricas); alarma de health check documentada (§7.5). |
| 6.7 Pipeline | ✅ `.github/workflows/deploy.yml`: CI OK en `main` → OIDC → build → ECR → SSH → `compose pull && up -d` + health check. `environment: produccion` para aprobación manual opcional. |
| Verificación del pipeline | ⏳ **Pendiente**: requiere crear ECR, rol OIDC y 4 secrets de GitHub, y hacer 1 deploy real. Motivo: son credenciales de la cuenta AWS que no se manejan desde aquí. |

---

## Fase 7 — Verificación final integral

**Estado: ✅ automatizada; ⏳ en AWS pendiente del deploy.**

- `server/tests/role-matrix.test.js`: los **9 roles** (ADMIN, AUX_ADMIN, CALIDAD,
  INVENTARIO, GERENCIA, CLIENTES_DASH, SUPERVISOR, ASESOR, REPORTES) acceden solo
  a lo suyo. 10/10.
- `npm test` → **68/68**.
- Recorrido headless (Chrome) con datos reales: login, dashboards con gráficos +
  análisis, constructor + previsualización, export Excel. OK.
- ⏳ El recorrido "en el entorno de AWS ya desplegado" queda pendiente del deploy
  real (Fase 6.7).

---

## Fase 8 — Reporte final

**Estado: ✅.** `LAUNCH_REPORT.md` (checklist de lanzamiento) + `AWS_DEPLOY_REPORT.md`
(runbooks, costos, arquitectura).

---

## Resumen de lo que falta para lanzar

1. **Decisiones de negocio** (§6 de `AWS_DEPLOY_REPORT.md`):
   - Qué operación son PANTERA MAIKERS y MOVILIZE, y KPIs reales de los clientes
     asumidos.
   - Umbral de bajo stock por ítem en Inventario; dirección de metas en Gerencia.
2. **Cuenta AWS**: ejecutar el runbook (`AWS_DEPLOY_REPORT.md` §7) — crear
   instancia, SSM, S3, ECR, rol OIDC + secrets de GitHub — y hacer el primer
   deploy. A partir de ahí el pipeline lo automatiza.
3. Cargar los **datos reales** de cada dashboard (Excel) y **cambiar las
   contraseñas de ejemplo** en el primer login.

---

## Fase 9 — Auditoría post-cierre: XSS almacenado (2026-09-10)

**Estado: ✅ resuelto de raíz.** Detalle completo en `SECURITY_FIX_REPORT.md`.

Una auditoría posterior (datos, seguridad, escalabilidad, documentación) dio verde
en todo salvo **un** hallazgo real: **XSS almacenado generalizado** en el frontend.
Todo `public/js/*.js` construía HTML por concatenación y lo asignaba con
`innerHTML` (y un `document.write` en la exportación a PDF) **sin escapar** los
valores que vienen de datos — texto libre del usuario (nombre de asesor,
observaciones, `liderNombre`, nombres de ítem/KPI, log de auditoría) y celdas de
Excel cargadas en el navegador. `server/validation.js` sólo limita longitud/formato
y permite caracteres HTML a propósito: el problema es de **salida (render)**, no de
entrada. El CSP no lo mitigaba (`script-src` ya tiene `'unsafe-inline'` por ~105
`onclick` inline).

**Arreglo:**

- **`public/js/esc.js`** (nuevo): función central `esc()` que escapa
  `& < > " '` (texto y atributos). Se carga antes que el resto de módulos en
  `index.html`. Modo dual navegador/Node para poder testearla.
- **Auditoría exhaustiva de cada sink** (`innerHTML` / `innerHTML +=` /
  `document.write`) en todo `public/js/`: se aplica `esc()` a cada valor de datos y
  se dejan intactos los literales de HTML y los valores de `constants.js`
  (`CLIENTES_LIST`, `CAMPANAS_*`, …). Archivos tocados: `calidad.js`,
  `dashboard-generic.js` (incl. `_gdExportPrint`), `inventario.js`, `gerencia.js`,
  `cargas.js`, `users.js`, `historial.js`, `metas.js`, `reportes.js`,
  `mis-resultados.js`, `dashboards-admin.js` (se reemplazó el `_esc` local
  incompleto por `esc` global), `roles-perms.js`.
- **3 `onclick`/`data` con texto libre** (`verSupervisionLider` con `liderNombre`,
  editar/eliminar dashboard con `cliente`, `switchGenericTab` con `t.key`)
  convertidos a `data-*` + `addEventListener` delegado — el escape HTML no basta
  dentro de un atributo de evento.
- **Fix colateral:** `public/js/gerencia.js` tenía un error de sintaxis
  preexistente (array `aoa` sin cerrar en `gerDescargarPlantilla`) que impedía
  parsear el archivo entero; corregido.
- **Regresión automatizada:** `server/tests/xss-frontend.test.js` fija el contrato
  de `esc()` (payloads `<img onerror>` / `<script>` quedan como texto).

**Hallazgo menor — `GET /api/users`:** exponía la matriz de permisos completa de
todos los usuarios a cualquier autenticado. Ahora filtra: sólo ADMIN / gestión de
usuarios o permisos reciben `perms` poblado; el resto recibe `perms: {}` (los
selects de asesor/líder usan id/nombre/rol/`asesorCampana`, y las pantallas que
necesitan `perms` ajenos son de rol privilegiado). Tests nuevos en
`server/tests/permissions.test.js`.

**Verificación:** `npm test` → **73/73** (68 previos + 2 de `/api/users` + 3 de
XSS). `npm audit` → 0 vulnerabilidades. Verificación manual end-to-end: un
monitoreo con `<img src=x onerror=alert(1)>` / `<script>…</script>` en campos de
texto libre se guarda crudo (correcto) y se renderiza como texto literal, sin
etiquetas ejecutables — en tablas y en la exportación a PDF. Pasos y salidas en
`SECURITY_FIX_REPORT.md`.

---

## Fase 9 — Despliegue real en AWS (2026-09-10)

Ejecución del runbook de `AWS_DEPLOY_REPORT.md` §7 en la cuenta AWS
**934685482338** (IAM user `deploy-inconexion`), región **us-east-1**.

**La aplicación está EN PRODUCCIÓN:** <https://inconexionpruebasclaude.duckdns.org>
— `GET /api/health` → `{"ok":true}` con certificado Let's Encrypt válido.

### Recursos creados (IDs/ARNs, sin secretos)

| Recurso | Identificador |
|---|---|
| Instancia Lightsail | `inconexion-prod` · plan `micro_3_0` (1 GB RAM / 2 vCPU / 40 GB) · Ubuntu 22.04 · `us-east-1a` |
| IP estática | `inconexion-ip` = **100.51.93.1** |
| Disco de bloques | `inconexion-data` 20 GB, adjuntado en `/dev/xvdf` (aparece como `/dev/nvme1n1` en el SO; montado por UUID en `/opt/inconexion/data`) |
| Firewall Lightsail | 443 y 80 → `0.0.0.0/0`; 22 → `181.79.84.39/32` (IP del operador) |
| ECR | `934685482338.dkr.ecr.us-east-1.amazonaws.com/inconexion` (scanOnPush) — imagen inicial construida localmente y subida (`:latest`, `:bootstrap`, `:d7b323c…`) |
| SSM Parameter Store (SecureString) | `/inconexion/prod/JWT_SECRET`, `/MASTER_ADMIN_PASSWORD_HASH`, `/MASTER_ADMIN_USER`, `/CORS_ORIGIN` |
| S3 backups | `inconexion-backups-josedavidosorio2005` — versionado activo, acceso público bloqueado (4/4) |
| IAM usuario instancia | `arn:aws:iam::934685482338:user/inconexion-instance` — mínimo privilegio: leer `ssm:.../inconexion/prod/*`, `kms:Decrypt` vía `ssm`, `s3:{Put,Get}Object` + `ListBucket` solo prefijo `db-backups/`, `ecr` pull solo repo `inconexion`, `logs`/`cloudwatch` PutMetricData. Access key en `/opt/inconexion/aws/` y `/root/.aws/` de la instancia (Lightsail no tiene instance profile utilizable) |
| IAM rol deploy (OIDC) | `arn:aws:iam::934685482338:role/inconexion-github-deploy` — trust `repo:josedavidosorio2005/claude-dasborad-:ref:refs/heads/main`, permisos solo push a ECR `inconexion` |
| Proveedor OIDC | `arn:aws:iam::934685482338:oidc-provider/token.actions.githubusercontent.com` |
| SNS | `arn:aws:sns:us-east-1:934685482338:inconexion-alertas` (suscripción email `jose.osoriog@…` — **pendiente de confirmar por el usuario**) |
| Route 53 health check | `94fe66d2-b74c-4436-b49d-845febfa4b8b` — HTTPS `/api/health`, intervalo 30 s, umbral 3. Todas las regiones: `Success 200` |
| CloudWatch alarma | `inconexion-health` — `HealthCheckStatus < 1` por 3×60 s → SNS. Estado actual: **OK** |
| CloudWatch logs | grupos `/inconexion/prod/docker` (ret. 30 d) y `/inconexion/prod/backup` (ret. 90 d) — agente activo enviando logs de contenedores + backup + métricas mem/disk/cpu |
| systemd | `inconexion-backup.timer` (diario 03:15 UTC) activo; corrida de prueba subió `s3://…/db-backups/inconexion-20260910-160854.db` (221 KB, con versionado) |
| Swap | 2 GiB en `/swapfile` (la RAM de 1 GB es justa); `vm.swappiness=10` |

### Verificación (checklist §11 del prompt)

| Ítem | Estado |
|---|---|
| `npm test` en `server/` | ✅ 73/73 |
| `https://inconexionpruebasclaude.duckdns.org/api/health` → `{"ok":true}` con cert válido | ✅ (Let's Encrypt `CN=inconexionpruebasclaude.duckdns.org`, válido 2026-09-10 → 2026-12-09; sin warnings) |
| HTTP → HTTPS | ✅ 308 permanente |
| Puerto 3000 **no** accesible desde internet | ✅ `Test-NetConnection :3000` → `False`; publicado solo en `127.0.0.1:3000` |
| Puerto 22 solo desde la IP del operador | ✅ `181.79.84.39/32` |
| Backup de prueba visible en S3 | ✅ (ver tabla arriba) |
| Secretos fuera del repo y del disco (SSM) | ✅ el contenedor los lee de SSM al arrancar; en `app.env` no hay secretos (solo la access key de mínimo privilegio, `chmod 600`, root) |
| Alarma de caída | ✅ Route 53 health check + CloudWatch alarm → SNS |
| Contraseñas de ejemplo cambiadas | ⏳ **pendiente** — lo hace el usuario en el primer login (`admin`) sobre `crodriguez, mlopez, jherrera, agomez, lrios, psuarez` |
| Push a `main` dispara CI → deploy | ⏳ **pendiente** — requiere que el usuario cargue 5 secrets/variables en GitHub (`AWS_DEPLOY_ROLE_ARN`, `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, var `AWS_REGION`) y haga `commit` + `push` del árbol de trabajo actual a `main` |

### Pendiente / notas honestas

- **Sin firma de imagen ni escaneo bloqueante**: ECR tiene `scanOnPush` pero no hay
  gate. Aceptable para pruebas.
- **1 GB de RAM**: el plan `small_3_0` (2 GB) y planes mayores están **bloqueados
  por ser cuenta AWS nueva** (`InvalidInputException` de Lightsail). Se usa
  `micro_3_0` + 2 GiB de swap. Uso actual ~500 MB / swap casi sin tocar. Para
  subir a 2 GB: pedir aumento de límite a AWS Support, luego snapshot + recrear.
- **Sin snapshots automáticos de Lightsail** (decisión del usuario): la
  recuperación de "toda la máquina" se hace recreando con el runbook + restaurando
  la BD del último backup S3.
- **Imagen base Node 20**: el AWS SDK v3 avisa que pedirá Node ≥ 22 después de
  enero 2027. Cambiar `server/Dockerfile` a `node:22-*` antes de esa fecha.
- **Lightsail sí expone un rol IMDS** (`AmazonLightsailInstanceRole`, en una cuenta
  de AWS, sin permisos): el CloudWatch Agent lo tomaba por defecto y fallaba con
  `AccessDenied`. Resuelto poniéndole las credenciales de `inconexion-instance` en
  `/root/.aws/` + `common-config.toml`.
- **La imagen desplegada se construyó desde el árbol de trabajo local** (incluye
  los cambios sin commitear de la Fase XSS). Para que CI y producción converjan,
  el usuario debe commitear y pushear a `main` antes del primer deploy automático.

---

## Fase 10 — Feedback de Edwin (rama `feature/feedback-edwin-2026-09-10`)

Feedback real del operador de la app. **No mergeado** — vive en la rama para
revisión y PR manual (el deploy a producción es continuo, así que nada llega a
`main` sin aprobación explícita). `npm test` → **78/78**, `npm audit` → 0.

### Implementado

| # | Qué | Cómo | Tests |
|---|-----|------|-------|
| **1.1** | El historial "no registraba" la creación de usuarios | El backend **sí** la registra (`POST /api/users` → `logEvent('CREADO')`). Bug de frontend: `showSection('hist')` no hacía `await loadHist()` antes de `renderHist()` → al abrir Historial tras crear un usuario no aparecía. Además el filtro "Cambios de permisos" tenía `value="PERMISO"` y el backend escribe `"PERMISOS"`. Ambos corregidos. | `server/tests/historial.test.js` (nuevo, 3) |
| **2.3** | Historial descargable | Botón "Descargar" → `.xlsx` de lo que esté filtrado en pantalla, con la columna "Realizado por" (actor). Patrón `_gdExportExcel`. | — (frontend) |
| **2.1** | Rol REPORTES = quien carga los datos | `applyRolePermDefaults()` fuerza `cargarDatos:true` para REPORTES al crear el usuario y al cambiarle el rol. Sin fusionar rol y permiso en el modelo (menos riesgo). UI: el check se marca y bloquea para REPORTES. | `dashboard.test.js` (+2) |
| **2.2** | Gerencia = solo lectura | Los 4 endpoints de escritura (`POST/PUT/DELETE /gerencia/kpis`, `POST /gerencia/carga`) pasan de `can(actor,'Gerencia')` a `canLoadData()`. La lectura sigue con `can(actor,'Gerencia')`. Frontend: se ocultan "Nuevo indicador", pestaña "Carga Excel" y Editar/Eliminar por fila. | `inventario-gerencia.test.js` (reescrito), `role-matrix.test.js` (+aserción) |
| **3.1** | Cargas: avisar antes de sobrescribir | `POST /api/dashboard/cargas` responde **409** `{yaExiste:true,...}` si ya hay carga para (cliente, sección, periodo) y no se pasó `reemplazar:true`. El frontend pide `confirm(...)` y reenvía con la bandera. | `dashboard.test.js` (reescrito el flujo) |

### Pendiente de tu respuesta (marcado "pregúntame" en el brief, no implementado)

- **1.2** "Quitar inventario del lugar de visita del historial" — ambiguo. Necesito
  captura o descripción de qué se ve mal. (Observación: el historial hoy muestra
  también eventos `INV_*`, `GER_*`, `DASHBOARD_CONFIG*` y de Calidad, pero el
  `<select>` de filtro solo lista acciones de usuarios.)
- **3.1 (parte 2)** Cadencia diaria: el modelo y el selector ya la soportan cuando
  la **sección** está configurada con `periodo:'dia'`. Qué dashboards deben pasar a
  granularidad diaria es decisión de negocio — pendiente.
- **3.2** Nivel de servicio / métricas de call center — falta la fórmula exacta de
  esta operación y qué columnas de Excel la alimentan.
- **3.3** "Editar el dashboard subiendo un Excel" — falta saber si es (a) cargar
  datos (ya existe) o (b) definir la estructura del dashboard por Excel.
- **4. Gestión Humana** (rol nuevo confirmado) — falta el esquema exacto de la
  tabla (¿cargo, documento, salario, supervisor?), la definición de "efectividad y
  ganancias", el periodo de rotación (mensual/trimestral) y si ya existe un costo
  por asesor/hora para la rentabilidad por campaña.

### Notas
- Primer commit de la rama (`baseline`) = snapshot del árbol ya desplegado en
  producción (Fase XSS + docs de infra), para separar lo previo del trabajo de
  Edwin. Los 5 commits siguientes son 1.1/2.3, 2.1, 2.2, 3.1.
- `apiRequest` ahora adjunta `err.status` y `err.data` al Error que lanza (lo
  necesitaba el flujo 409 de 3.1; es retrocompatible).

---

## Fase 11 — Cierre: Gestión Humana + pasada de calidad + merge a producción (2026-09-10)

### Feedback de Edwin — punto 4 (Gestión Humana) implementado

Módulo nuevo siguiendo el patrón Inventario/Gerencia. Ver commit
`feat(gestion-humana)`.

- **Tabla** `gestion_humana_personal` (`db.js`) con índices `campana`,
  `fecha_ingreso`, `fecha_salida`.
- **Campo nuevo pedido por Edwin** para la rentabilidad: `costo_hora` +
  `horas_mes` **por asesor** (no por campaña). Decisión: la tabla ya es por
  persona; el costo de una campaña = suma de su gente activa; así soporta que
  alguien cambie de campaña o tenga tarifa distinta. Costo mensual persona =
  `costo_hora * horas_mes`.
- **Rol** `GESTION_HUMANA` + permiso `GestionHumana`. La matriz de roles pasa de
  9 a **10 roles** (`role-matrix.test.js`).
- **Rutas** `/api/gh/personal` (CRUD) + `/api/gh/resumen`, guardadas por
  `can(actor,'GestionHumana')`.
- **Dashboard** `GESTION_HUMANA` (adapter): rotación (`bajas del mes / activos al
  inicio del mes`), ingresos/salidas por mes, costo de nómina, y **rentabilidad
  por campaña** = `ingresos - costo`.
- **Frontend**: sección admin + overlay (para el rol) + modal CRUD; `esc()` en
  todo dato. Se agregó también la regla CSS de overlay que **faltaba** para
  `#inventario-overlay` / `#gerencia-overlay` (quedaban como bloque suelto al
  fondo de la página — bug preexistente encontrado en la pasada).
- **Tests**: `gestion-humana.test.js` (6).

### Huecos de negocio que quedan (documentados, no bloquean)

| Punto | Qué falta | Estado en el código |
|---|---|---|
| **1.2** "Quitar inventario del lugar de visita del historial" | Descripción/captura de qué se ve mal. El historial hoy muestra eventos `INV_*`/`GER_*`/`GH_*`/`DASHBOARD_*`/Calidad además de los de usuarios; el `<select>` de filtro solo lista acciones de usuarios. | Sin cambios — necesita aclaración de Edwin. |
| **3.2** Nivel de servicio | Fórmula exacta de la operación + qué columnas de Excel la alimentan. | Sin implementar. |
| **3.3** "Editar dashboard subiendo Excel" | Si es (a) cargar datos (ya existe) o (b) definir la estructura por Excel. | Sin implementar. |
| **3.1 parte 2** Cadencia diaria por dashboard | Qué dashboards deben ofrecer granularidad diaria. | El modelo y el selector ya la soportan cuando la sección usa `periodo:'dia'`. |
| **GH — "efectividad y ganancias"** | Definición (producción del equipo vs objetivo, o ingresos vs costo). | No se implementó como métrica propia. |
| **GH — "ingresos generados" por campaña** | Qué KPI exacto de cada plantilla de cliente es "ingresos". | Heurística: `recaudo` si existe, si no `ventas`, de la última carga `resumen` del dashboard de esa campaña. |
| **GH — campos de la persona** | Si Edwin necesita más que documento/cargo/supervisor/salario. | Incluidos como opcionales. |

### Pasada de calidad / seguridad / escalabilidad

- **XSS**: barrido de todos los sinks `innerHTML`/`document.write` de `public/js/`
  incluyendo `gestion-humana.js` — 100% pasa por `esc()`/valores numéricos.
  `xss-frontend.test.js` sigue en verde.
- **`GET /api/users`**: ya resuelto en la fase anterior (roles no privilegiados
  reciben `perms:{}`). Sin cambios.
- **`npm audit`**: 0 vulnerabilidades.
- **`npm outdated`**: se aplicó el único parche disponible (`@aws-sdk/client-s3` y
  `@aws-sdk/client-ssm` 3.1129 → 3.1130). El resto son majors (express 4→5,
  helmet 7→8, zod 3→4, bcryptjs 2→3, better-sqlite3 12→13, dotenv 16→17,
  express-rate-limit 7→8) — no se tocan sin aprobación.
- **`server/Dockerfile`**: `node:20-*` → **`node:22-*`** (aviso de fin de soporte
  del AWS SDK v3). `AWS_DEPLOY_REPORT.md` actualizado.
- **Sin `console.log`** de depuración en código nuevo (server ni frontend).
- **Índices** de `gestion_humana_personal`: mismo criterio que `inventario_*` /
  `gerencia_kpis`.
- **Refactor**: no hizo falta — cada adaptador tiene lógica propia; los helpers
  (`col`/`U`/`S`/`kpi`) ya se comparten.

### Conteo final de tests

`cd server && npm test` → **85/85** (73 de fases previas + 3 `historial` + 2
`/api/users`/REPORTES + 6 `gestion-humana` + 1 rework Gerencia neto). `npm audit`
→ 0.

---

## Fase 12 — Apps de escritorio y Android (rama `feature/apps-desktop-android`, 2026-09-10)

Empaquetado de la MISMA aplicación web como cliente ligero de escritorio y de
Android. **Ninguna embebe el backend** — las tres superficies consumen la API
desplegada en AWS. No se tocó `server/` ni `public/`.

### `desktop-app/` — Windows `.exe` (Electron)

- Electron 33 + electron-builder 25. `appId` `com.inconexion.desktop`, producto
  **InConexion Platform**, target **nsis**.
- `main.js`: una `BrowserWindow` que carga `https://inconexionpruebasclaude.duckdns.org`.
  `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`. Navegación
  fuera del dominio de producción → `shell.openExternal` (no dentro de la app).
  1280×800, recuerda tamaño/posición entre sesiones (`window-state.json` en
  userData). Menú mínimo (recargar, zoom, devtools, salir). Instancia única.
- Ícono: **placeholder genérico** (`build/icon.png`, teal). Reemplazar por el
  real cuando lo haya.
- `win.signAndEditExecutable=false` para evitar el fallo de symlinks de
  `winCodeSign` en Windows sin Developer Mode (no firmamos igual).
- **`npm run build` → `desktop-app/dist/InConexion Platform Setup 1.0.0.exe`**
  (~78 MB, NSIS). Verificado: el `.exe` empaquetado abre sin crashear.
- **Sin firma de código** → SmartScreen mostrará "Windows protegió tu PC" la
  primera vez. Esperado; se quita con un certificado de firma de código.

### `mobile-app/` — Android `.apk` (Capacitor)

- Capacitor 6 en modo **server URL**: `capacitor.config.json` con
  `server.url = https://inconexionpruebasclaude.duckdns.org`, `cleartext:false`.
  `appId` `com.inconexion.app`, `appName` **InConexion Platform**. `www/` es solo
  un placeholder — Capacitor carga el sitio real.
- `npx cap add android` genera `mobile-app/android/` (versionado; sin `build/`).
- **Permisos**: solo `android.permission.INTERNET` (+ el auto-generado por AGP
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, obligatorio en targetSdk 34). Nada
  de más.
- **Keystore de firma de PRUEBAS** generado nuevo (`keytool`, RSA 2048, validez
  ~27 años, alias `inconexion`). El `.keystore` y `release-signing.properties`
  (con la contraseña) están **gitignoreados**. La contraseña se entregó al
  usuario aparte para que la guarde.
- `android/app/build.gradle`: `signingConfigs.release` lee
  `../release-signing.properties` si existe; si no, el release queda sin firmar.
- **`./gradlew assembleDebug assembleRelease`** →
  - `app/build/outputs/apk/debug/app-debug.apk` (~3.7 MB)
  - **`app/build/outputs/apk/release/app-release.apk` (~3.0 MB)** — firmado
    (esquemas v1 + v2), `apksigner verify` → `Verifies`.
- **No se sube a Google Play** (fuera de alcance). El `.apk` de release es para
  *sideload* / distribución interna.

### Pendiente / notas

- Prueba visual de login en ambas apps (la hace el usuario).
- Ícono real (desktop y Android) cuando exista — hoy placeholder.
- Certificado de firma de código para el `.exe` si se quiere quitar el aviso de
  SmartScreen (decisión de negocio).
- `mobile-app` tiene 2 vulnerabilidades npm en `tar` (transitiva de
  `@capacitor/cli`, **devDependency** — no se empaqueta en el `.apk`).

---

## Fase 13 — Pulido nativo de la app Android (2026-09-11)

Sigue siendo cliente ligero: **no se tocó `server/`**, y de `public/` solo se
cambió la línea del `<meta name="viewport">` (se agregó `viewport-fit=cover`
para las áreas seguras). Todo lo demás vive en `mobile-app/`.

- **Plugins nuevos**: `@capacitor/splash-screen`, `@capacitor/status-bar`,
  `@capacitor/app` (^6.x, sincronizados con `npx cap sync android`). Impacto
  en tamaño: prácticamente nulo — el `.apk` de release bajó de ~3.0 MB a
  **2.90 MB** y el de debug de ~3.7 MB a **3.70 MB** (se quitaron 11 PNG del
  splash placeholder por defecto, que compensó el código de los plugins).
- **Splash**: fondo sólido color de marca (`#0D4A5E`, mismo que
  `--c-primary` de `public/css/styles.css`), vía `res/drawable/splash.xml`
  (reemplaza el placeholder celeste-sobre-blanco de Capacitor). `capacitor.config.json`
  → `SplashScreen.launchAutoHide:false`; se oculta desde `MainActivity.java`
  cuando el `WebViewClient` dispara `onPageFinished` del sitio real (o de la
  pantalla de sin conexión), nunca por un timer fijo.
- **Status bar**: `capacitor.config.json` → `StatusBar.backgroundColor`
  = color de marca, `style: LIGHT` (íconos claros, porque el fondo es
  oscuro). Se lee automáticamente al arrancar el plugin nativo, sin JS.
- **Botón/gesto atrás** (`MainActivity.onBackPressed`): si el `WebView`
  tiene historial de navegación (`canGoBack()`) retrocede ahí; si no, pide
  confirmación ("toca atrás de nuevo para salir", ventana de 2s con `Toast`)
  en vez de cerrar de golpe. **Nota importante**: `public/js` no usa
  `pushState` ni rutas por hash — es una SPA de una sola URL que cambia de
  vista por estado de JS, no por historial del navegador. Por eso
  `canGoBack()` normalmente será `false` incluso navegando entre
  dashboards: el atrás nativo del WebView **no puede** hacer "volver del
  dashboard al menú" sin que `public/js` empuje historial por vista, lo cual
  queda fuera de esta tarea (no se tocó esa lógica). Lo que sí se logró es
  que el botón atrás ya no cierre la app sin avisar.
- **Sin conexión**: `WebViewClient` propio en `MainActivity.java` intercepta
  `onReceivedError` para errores de red del frame principal (host lookup,
  connect, timeout, IO) y carga `assets/offline.html` (pantalla propia, en
  español, con botón "Reintentar" que vuelve a la URL de producción) en vez
  del error nativo de Chromium.
- **Áreas seguras**: `public/index.html` ya cargaba con `viewport-fit=cover`
  agregado; Android respeta el notch/gestos por defecto porque la Activity
  no usa modo edge-to-edge (`fitsSystemWindows` implícito de AppCompat).
- **Orientación**: bloqueada a vertical (`android:screenOrientation="portrait"`
  en el `<activity>` del manifest) — decisión del usuario, es una app de
  dashboards/formularios de trabajo.
- **Teclado**: `android:windowSoftInputMode="adjustResize"` en el manifest
  para que el WebView se redimensione (no se tape el input activo) al
  aparecer el teclado. Pendiente de confirmar en dispositivo real con
  formularios largos (modal de Gestión Humana).
- **Ícono adaptable**: ya estaba bien formado (`mipmap-anydpi-v26/ic_launcher.xml`
  con capas `background`/`foreground` separadas) — se verificó, no fue
  necesario tocarlo. Sigue siendo el placeholder genérico teal de Capacitor.
- **`colors.xml`**: se creó (no existía) con los colores de marca —
  `styles.xml` ya referenciaba `@color/colorPrimary`/`colorPrimaryDark`
  /`colorAccent` sin que existiera ese recurso en ningún lado del proyecto
  local; quedó resuelto de paso.
- Verificado con `./gradlew assembleDebug assembleRelease` (`BUILD
  SUCCESSFUL`) y `apksigner verify` sobre el release (firma v1+v2 OK, mismo
  keystore de pruebas de la Fase 12). Pruebas de los 6 puntos (splash,
  status bar, atrás, sin conexión, notch, teclado) **pendientes en
  dispositivo físico real por el usuario** — un emulador no siempre
  reproduce notch/gestos reales.

---

## Fase 14 — Ícono real y logo en el splash (2026-09-11)

Logo real recibido del usuario (JPEG 307×78, fondo blanco: símbolo de 4
círculos conectados — 1 verde + 3 azules — más wordmark "InConexion" en
teal oscuro). Reemplaza el ícono placeholder teal genérico en **ambas**
apps.

- **El recorte del símbolo en el original es de solo 41×41 px.** Escalarlo
  directamente a 256px (.ico) o 432px (adaptive icon xxxhdpi) se habría
  visto borroso (~14x de upscale). En vez de eso, se detectaron los centros
  y radios de los 4 círculos por análisis de imagen (umbral de color +
  distancia por erosión) y se **reconstruyó el símbolo como figuras
  geométricas limpias** (círculos + conectores) renderizadas con
  supersampling a cualquier resolución — nítido en todos los tamaños, no es
  una foto de la foto. El wordmark ("InConexion") si se usa (solo en el
  splash) sale del original recortado y escalado ~3x, con el fondo
  quitado — un upscale de texto moderado, no vectorizado (no hay forma de
  vectorizar tipografía sin la fuente real).
- **Desktop (`desktop-app/build/icon.ico`)**: 7 tamaños embebidos
  (16/24/32/48/64/128/256), fondo transparente. `package.json` → `"icon"`
  ahora apunta a `build/icon.ico` (antes `build/icon.png`, quedaba a criterio
  de electron-builder). `build/icon.png` (ícono de ventana en tiempo de
  ejecución, `main.js`) también reemplazado.
- **Android — ícono adaptable** (`mipmap-*/ic_launcher_foreground.png`,
  todas las densidades): símbolo solo, fondo transparente, ocupando ~62%
  del canvas (safe zone del sistema de máscaras de Android). El fondo del
  adaptive icon (`ic_launcher_background` = blanco) no cambió.
- **Android — íconos legacy** (`mipmap-*/ic_launcher.png` +
  `ic_launcher_round.png`, para API <26): símbolo sobre blanco, cuadrado y
  recortado a círculo respectivamente.
- **Splash**: ahora muestra el **logo completo** (símbolo + wordmark) en
  vez del rectángulo de color sólido de la Fase 13.
  `res/drawable-xxxhdpi/inconexion_logo.png` (único bucket de densidad — a
  mayor densidad Android reescala hacia abajo para el resto, evita
  duplicar el archivo 5 veces) sobre `res/drawable/splash.xml`, ahora un
  `<layer-list>` (fondo + logo centrado) en vez de un `<shape>` sólido.
  **El fondo del splash pasó de teal de marca a blanco**: el wordmark del
  logo real es teal oscuro, sobre el teal de fondo anterior habría quedado
  ilegible. `capacitor.config.json` → `SplashScreen.backgroundColor` blanco,
  `androidScaleType` CENTER_INSIDE (antes CENTER_CROP, para no recortar el
  logo si el layer-list no reporta bien su tamaño intrínseco al plugin).
  La barra de estado del **resto de la app** (fuera del splash) se queda en
  teal de marca — eso no cambió.
- Reconstruido con `./gradlew assembleDebug assembleRelease` (`BUILD
  SUCCESSFUL`) y `npm run build` en `desktop-app/` (electron-builder, sin
  errores). `apksigner verify` OK sobre el release nuevo. Tamaños: `.exe`
  81.7 MB→81.7 MB (+70 KB), `.apk` release 2.90→**3.03 MB**, debug
  3.70→**3.83 MB** (+~130 KB cada uno, por los 17 PNG de íconos/splash
  nuevos).
- Copiados a `Desktop\InConexion-Entregables\`, reemplazando los anteriores.
- Pendiente: el símbolo reconstruido es una aproximación geométrica fiel al
  original pero no un archivo vectorial oficial de marca — si el diseñador
  tiene el .ai/.svg original o un PNG de mayor resolución, usarlo
  directamente daría un resultado aún más fiel (sobre todo del wordmark).

---

## Fase 15 — Cierre de escritorio y Android, verificación real en dispositivo (2026-09-11)

Objetivo: dejar ambas apps terminadas de verdad, verificadas en un teléfono
físico real por USB (no emulador) y en el `.exe` desempaquetado — no "debería
funcionar". Sigue sin tocarse `server/`; de `public/` solo `css/styles.css`
(dos reglas `env(safe-area-inset-*)`, ver punto 3).

### Prerrequisitos — estado real al empezar

- Logo: no estaba en `Desktop\inconexion-logo.png` (esa ruta nunca existió).
  Ya se había usado el logo real, recibido por chat en la Fase 14, para los
  íconos — no hizo falta repetir ese trabajo.
- Keystore: `Desktop\inconexion-secrets\` presente, igual a la copia local en
  `mobile-app/android/` que usa el build.
- Teléfono por USB: apareció `unauthorized` — requirió intervención del
  usuario (reconectar cable, aceptar el popup de depuración USB en pantalla)
  antes de poder instalar nada. Una vez autorizado, se usó para **todas** las
  pruebas de esta fase.

### 1–2. Verificación y pulido nativo de Android — 3 bugs reales encontrados en el teléfono

Lo de la Fase 13/14 (íconos, orientación, teclado, back button básico,
offline básico) seguía intacto en el código, pero probarlo en el teléfono
real (no en el análisis de código) encontró fallas que no eran visibles de
otra forma:

1. **Botón atrás no cerraba la app al segundo toque.** `super.onBackPressed()`
   quedaba absorbido por el `OnBackPressedCallback` interno de Capacitor
   (registrado para el evento JS `backButton`, que nunca tiene listener
   porque `public/js` no lo usa) — el dispatcher lo daba por "manejado" y
   nunca llegaba a cerrar la Activity. **Fix**: `finish()` directo en vez de
   `super.onBackPressed()`. Confirmado con `adb shell input keyevent
   KEYCODE_BACK` x2 + `dumpsys window` (el foco pasa a la app anterior).
2. **Con el teléfono realmente sin ninguna interfaz de red** (wifi y datos
   apagados a la vez, no solo un wifi sin internet), Chromium a veces se
   quedaba esperando **25+ segundos sin disparar `onReceivedError`** en vez
   de fallar rápido — confirmado con logcat completo, cero actividad de red
   de la app. **Fix**: watchdog de `Handler.postDelayed` de 10s en
   `onPageStarted`; si la carga real no terminó para entonces, se fuerza
   `offline.html` igual. No se pudo aislar la causa exacta (parece timing de
   MIUI al propagar "sin red" a Chromium justo después de apagar los radios),
   pero el watchdog cubre el síntoma de forma determinística.
3. **Splash con logo real en Android 12+**: el tema `Theme.SplashScreen` +
   `android:background` (técnica clásica) es **ignorado** por la API de
   sistema en API 31+; sin los atributos modernos
   (`windowSplashScreenBackground`/`windowSplashScreenAnimatedIcon`/
   `postSplashScreenTheme`) el sistema mostraba un fondo oscuro genérico en
   vez del blanco de marca — confirmado con captura real (`#211F17` en vez
   de blanco). Agregados esos atributos a `styles.xml`, usando
   `@mipmap/ic_launcher_foreground` (el símbolo, sin wordmark) como ícono del
   splash moderno.

**Intento fallido, revertido a propósito** (documentado porque costó mucho
tiempo de esta sesión y vale la pena que quede explicado): se intentó tomar
control 100% nativo del splash (`SplashScreen.installSplashScreen()` +
`setKeepOnScreenCondition` propio) para que también se ocultara al fallar la
carga (`window.Capacitor` no existe en `offline.html` ni en una carga
fallida — confirmado con logs — así que el `.hide()` por JS no tenía
efecto ahí). Ese manejo nativo **funcionaba para el caso offline pero rompía
el caso normal**: quedaba una franja blanca/negra visible entre la barra de
estado y el contenido en la transición de la carga exitosa de todos los
días (varias causas descartadas una por una: animación de salida por
defecto, `postSplashScreenTheme` pisando el color de status bar, modo
edge-to-edge dejado a medias) — **se revirtió** a que Capacitor maneje el
splash con su mecanismo original (JS `.hide()`), que renderiza limpio en el
caso normal. Costo aceptado: si la **primera** carga de la app falla por
red, el splash (blanco + símbolo, sin fantasma ni franjas — eso sí se
verificó limpio) puede quedar pegado sobre `offline.html`, que carga bien
debajo pero no se ve hasta que el splash se oculta solo. Es un caso de borde
(primer arranque + cero conectividad en ese instante exacto), no el uso
normal.

- **Status bar**: se confirmó por código (`StatusBarPlugin.java`) que el
  plugin **no** lee `capacitor.config.json` — solo actúa si JS llama a sus
  métodos, cosa que `public/js` no hace. Se fija nativamente en
  `MainActivity.onCreate()` (`Window.setStatusBarColor` +
  `WindowInsetsControllerCompat`). Verificado con captura real: teal de
  marca, íconos claros.
- **CSS safe-area** (`public/css/styles.css`): agregadas dos reglas
  (`.navbar` padding-top, `.toast` bottom/right) con
  `env(safe-area-inset-*)` — defensivo, hoy no cambia nada visible porque
  Android no usa edge-to-edge con el targetSdk actual, pero protege ante un
  futuro cambio. Este archivo lo sirve el sitio real, no el `.apk` — el
  cambio se activa vía el deploy normal (push a `main`), no reconstruyendo
  el paquete Android.
- Teclado (`adjustResize`) y orientación vertical: sin cambios, ya estaban
  bien de la Fase 13; no se pudo probar el modal de Gestión Humana porque
  no hay credenciales de login disponibles para esta sesión.

### 3. Pulido de escritorio (nuevo, `desktop-app/`)

- **Splash propio**: `splash.html` (nueva ventana `BrowserWindow` sin marco,
  logo real + spinner) se muestra mientras la ventana principal (que
  arranca oculta, `show:false`) carga el sitio; se cierra sola en
  `did-finish-load`/`did-fail-load`.
- **Sin conexión**: `offline.html` (nuevo, mismo estilo que el de Android) se
  carga en `did-fail-load` filtrando por una lista de net-error-codes de
  Chromium que significan "sin red" (`ERR_INTERNET_DISCONNECTED`,
  `ERR_NAME_NOT_RESOLVED`, `ERR_CONNECTION_REFUSED`, etc.), ignorando
  `ERR_ABORTED` (navegaciones canceladas a propósito) — nunca para errores
  4xx/5xx del servidor, esos sí cargan la página normal.
- **Menú**: se dejó "Herramientas de desarrollador" (decisión del usuario,
  para soporte remoto).
- **Sesión persistente**: no se tocó nada — Electron usa por defecto una
  sesión persistente en disco (sin `partition` custom en el
  `BrowserWindow`), así que cookies/localStorage deberían sobrevivir entre
  aperturas por comportamiento estándar de Chromium/Electron, no por código
  de esta app. **No verificado end-to-end** (abrir, loguearse, cerrar,
  reabrir, seguir logueado) porque esta sesión no tiene credenciales de
  login válidas — pendiente de que el usuario lo confirme.
- `package.json` → `files` ahora incluye `splash.html`, `offline.html`,
  `build/icon.png`, `build/splash-logo.png` (si no, no se empaquetaban en el
  `.exe`).

### 4. Verificación real — qué se probó y qué se vio

**Teléfono físico (USB, `adb`)**, APK de release, instalación limpia
(desinstalar + instalar + un solo arranque, no reinstalos en caliente uno
tras otro que podían estar afectando algún resultado intermedio):

| Punto | Resultado | Evidencia |
|---|---|---|
| Ícono real | ✅ | capturas de pantalla |
| Splash con símbolo real, fondo blanco | ✅ (caso normal) | capturas de pantalla |
| Status bar color de marca | ✅ | capturas de pantalla |
| Botón atrás (toast + cierre al 2do toque) | ✅ | `dumpsys window` (foco pasa a la app anterior) |
| Sin conexión → pantalla propia + reintentar | ✅ (contenido), splash puede quedar pegado (ver arriba) | capturas de pantalla + logcat |
| CSS safe-area | No verificable visualmente (no hay notch real en este teléfono ni edge-to-edge activo) | — |
| Teclado no tapa inputs | No probado (sin credenciales para llegar al modal de Gestión Humana) | — |
| Orientación bloqueada | Ya verificado en Fase 13, sin cambios | — |

**Escritorio (.exe, `win-unpacked`, sin instalar)**: se abrió sin crashear,
título de ventana pasa de vacío/splash a "InConexion Platform" tras ~4s
(confirmado por proceso/título de ventana, no por captura de pantalla — ver
nota de privacidad abajo), sin errores en stderr. Splash/login/manejo de
sin-conexión **no se confirmaron visualmente** por la misma razón.

**Nota de transparencia**: al intentar verificar visualmente la app de
escritorio con una captura de pantalla automatizada, un primer intento
capturó el escritorio completo del usuario y un segundo intento (más
dirigido a la ventana de la app) falló y terminó capturando contenido
privado (WhatsApp Web) que sí estaba en pantalla en ese momento. Se avisó
de inmediato, se borraron los archivos, y no se volvió a intentar capturar
el escritorio de Windows en esta sesión — por eso la verificación visual
del `.exe` quedó incompleta (solo por proceso/logs, no por pantalla). Las
capturas del teléfono sí se seguyeron usando (vía `adb exec-out
screencap`, que solo trae el frame del dispositivo Android, no el
escritorio de Windows) porque ese método no tiene ese riesgo.

### 5–6. Entrega y control de versión

- Copiados a `Desktop\InConexion-Entregables\` (reemplazando lo anterior):
  `.exe` 81.9 MB, `.apk` release 3.03 MB, `.apk` debug 3.83 MB.
  `apksigner verify` OK sobre el release final.
- `README.txt` actualizado: mención de íconos reales y de la limitación del
  splash pegado en el primer arranque sin red.
