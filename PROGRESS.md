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

## Fase 8.1 — Auditoría post-cierre: XSS almacenado (2026-09-10)

> (Antes rotulada «Fase 9»; se renumeró para no chocar con «Fase 9 — Despliegue
> real en AWS». Todas las referencias externas a «Fase 9» apuntan al despliegue.)

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

## Fase 13 — Cierre total: producción sirviendo la versión nueva (2026-09-10)

### PRs

- **PR #3** (`feat/feedback-edwin` + Gestión Humana + Node 22) — **mergeado** a `main`.
- **PR #4** (`desktop-app/` + `mobile-app/`) — **mergeado** a `main`. No toca
  `server/` ni `public/`.

### Deploy a producción — resuelto tras 3 fallos diagnosticados

1. `aws-region` vacío → faltaban los secrets/variable de GitHub. **Cargados** los
   5 (`AWS_DEPLOY_ROLE_ARN`, `DEPLOY_SSH_HOST/USER/KEY`, var `AWS_REGION`).
2. OIDC `Not authorized ... sts:AssumeRoleWithWebIdentity`. CloudTrail mostró que
   el `sub` real es `repo:josedavidosorio2005@195043085/claude-dasborad-@1362719668:ref:refs/heads/main`
   (la cuenta tiene *immutable subjects*). **Trust policy del rol
   `inconexion-github-deploy` ajustada** (por el usuario, comando aparte): condiciona
   por el claim `repository` (nombre plano) + `StringLike` `sub` = `repo:*:ref:refs/heads/main`.
   Se quitó también `environment: produccion` del workflow (no aportaba gating).
3. Paso SSH: `dial tcp ***:22: i/o timeout`. El firewall de Lightsail tiene el
   **puerto 22 restringido a la IP del operador** (`181.79.84.39/32`); los runners
   de GitHub tienen IP dinámica → no conectan.
   - **Este deploy (y los siguientes, por ahora) se hacen A MANO** por SSH desde
     la IP del operador: `cd /opt/inconexion && docker compose pull && docker
     compose up -d` (la imagen ya la construye CI y la sube a ECR — esa parte del
     pipeline sí funciona sola).
   - **El deploy 100% automático queda PENDIENTE de decisión.** Opciones evaluadas
     para no dejar el puerto 22 abierto a todo el mundo:
     - ❌ **Restringir 22 a los CIDRs de GitHub Actions** (`api.github.com/meta` →
       clave `actions`): **inviable** — la lista tiene **~6980 rangos** (5436 IPv4
       + 1544 IPv6; GitHub movió los runners a Azure y ahora abarca asignaciones
       enormes) y cambia seguido. Ningún firewall práctico (Lightsail incluido)
       aguanta miles de reglas.
     - 🟢 **Whitelist dinámica en el workflow** (recomendada): un paso previo al
       SSH añade la IP pública del runner a `cidrs` del puerto 22; un paso `if:
       always()` la quita al terminar. El 22 queda abierto a **una sola IP durante
       ~90 s por deploy**. Requiere `lightsail:GetInstancePortStates` +
       `lightsail:PutInstancePublicPorts` en el rol `inconexion-github-deploy`
       (acotado al ARN de la instancia) + ~15 líneas en `deploy.yml`.
     - 🟢 **AWS SSM (hybrid activation)**: registrar la instancia Lightsail como
       *managed instance* (el `amazon-ssm-agent` ya está instalado y activo) y usar
       `aws ssm send-command` en vez de SSH. Puerto 22 **cerrado del todo**. Más
       piezas (activación, rol, re-registro del agente).
     - 🟡 **Pull-based en la instancia**: systemd timer que hace `docker compose
       pull && up -d` cada N min. Cero acceso entrante. Pierde la señal "deploy
       falló" en CI y añade latencia = intervalo del timer.
     - Mientras se decide: deploy manual (arriba). El pipeline hasta ECR ya es
       automático.

### Verificación en producción REAL (no en el estado del workflow)

| Ítem | Evidencia |
|---|---|
| Imagen corriendo = versión nueva | `docker inspect` → `sha256:9c8b0b72693fa38a162a11a76b62161d166f8f8b5d00062c097d17f5eab1aa34`; ECR `latest` = mismo digest, tags `latest` + `0fd699ce…` (= `main` HEAD). Contenedor recreado 21:56 UTC. |
| `/api/health` HTTPS + cert | `HTTP 200 {"ok":true}`; cert Let's Encrypt `CN=inconexionpruebasclaude.duckdns.org`, cadena válida, vence 2026-12-09 |
| Login admin maestro | `POST /api/auth/login` → 200, JWT, `rol=ADMIN isMaster=true` |
| `GET /api/dashboard/GESTION_HUMANA` (usuario rol `GESTION_HUMANA`) | 200, `config.cliente=GESTION_HUMANA`, secciones = `resumen, flujo_mes, por_campana, personal` (4) |
| Bug 1.1 (crear usuario → historial) | `POST /api/users` → 201; `GET /api/historial` → fila `CREADO` con `actor='Administrador (@admin)'` |
| Contraseñas de ejemplo cambiadas | login `crodriguez` / `calidad123` → **HTTP 401** |
| Overlays Inventario/Gerencia | CSS servido en prod incluye `#inventario-overlay,#gerencia-overlay,#gestionhumana-overlay{display:none;position:fixed;inset:0;…}` + `.show{display:flex}` — la regla que faltaba. (Confirmación visual pendiente del usuario.) |
| Suscripción SNS de la alarma | `list-subscriptions-by-topic` → estado = ARN real, no `PendingConfirmation` |
| Archivos nuevos en el contenedor | `public/js/gestion-humana.js` 7921 B, `public/js/esc.js` 867 B, `ADAPTERS` = `[GERENCIA, INVENTARIO, GESTION_HUMANA]` |
| `npm test` / `npm audit` (local, `main`) | 85/85 · 0 vulnerabilidades |

### Los 4 huecos de negocio que siguen abiertos (para Edwin)

1. **1.2** "Quitar inventario del lugar de visita del historial" — sin descripción
   clara de qué se ve mal. (Dato: el historial registra eventos `INV_*`/`GER_*`/
   `GH_*`/`DASHBOARD_*`/Calidad además de los de usuarios; el filtro `<select>` solo
   lista acciones de usuarios.)
2. **3.2** Fórmula exacta de "nivel de servicio" + qué columnas de Excel la
   alimentan.
3. **3.3** "Editar el dashboard subiendo un Excel" — ¿(a) cargar datos (ya existe)
   o (b) definir la estructura del dashboard por Excel?
4. **Gestión Humana — "efectividad y ganancias"**: definición pendiente. (También
   sin confirmar: qué KPI exacto de cada plantilla de cliente = "ingresos" para la
   rentabilidad por campaña; hoy usa la heurística `recaudo || ventas`.)
