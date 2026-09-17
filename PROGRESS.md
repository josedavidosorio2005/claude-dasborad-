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

---

## Fase 14 — Layout responsivo en celular: navbar + sidebar (rama `fix/responsive-navbar-sidebar-movil-2026-09-11`, 2026-09-11)

Reportado con capturas reales de un teléfono físico (~412px de viewport):
el logo del navbar se solapaba con "Administrador", el badge de rol tapaba
"Cerrar Sesión", y el sidebar (ancho fijo) dejaba tan poco espacio al
contenido que títulos como "Gestión de Usuarios" se partían palabra por
palabra en 3+ líneas. Como `public/` es el mismo HTML/CSS/JS que carga la
app Android empaquetada (cliente ligero, sin bundle propio), este arreglo
del sitio real también arregla la app Android — no hizo falta tocar nada
en `mobile-app/`; la próxima vez que se abra la app (con el deploy ya
hecho) se va a ver bien sin reconstruir el `.apk`. No se tocó `server/`.

### Diagnóstico

`public/css/styles.css` ya tenía breakpoints (`max-width:700px` para grids
de dashboards, `max-width:520px` para el login) pero **ninguno tocaba
`.navbar` ni `.sidebar`** — ancho fijo de `.sidebar` (220px, ~55% del
viewport en un teléfono de 412px) sin ningún media query, y `.navbar` sin
ningún ajuste para ancho angosto.

### Solución — patrón estándar (perfil colapsado a ícono + sidebar off-canvas)

- **Navbar**: `navbar-user`/`navbar-role`/`btn-logout` se envolvieron en un
  `.navbar-profile-dropdown` (en desktop se ve idéntico a como estaba,
  `display:flex` con el mismo gap — envolver esos 3 elementos no cambia
  nada arriba de 768px). En `@media(max-width:768px)` ese div pasa a panel
  desplegable oculto por defecto, activado por un ícono nuevo
  (`.navbar-profile-toggle`, 👤) — mismo patrón que Gmail/cualquier SaaS en
  móvil.
- **Sidebar**: por debajo de 768px pasa a `position:fixed` fuera del flujo
  (`transform:translateX(-105%)` oculto, `translateX(0)` visible),
  superpuesto sobre el contenido (no lo empuja), con un
  `.sidebar-overlay` semitransparente detrás que cierra el menú al
  tocarlo. Un botón hamburguesa nuevo (`.navbar-menu-toggle`, ☰) en el
  navbar lo abre. Con el sidebar fuera del flujo, `.main-content` usa el
  100% del ancho.
- **Títulos**: con el ancho completo disponible, "Gestión de Usuarios" y
  el resto de `.page-title` ya no se parten — se le bajó igual el
  font-size en el breakpoint móvil (1.35rem → 1.1rem) como red de
  seguridad para títulos más largos ("Gerencia — Indicadores Ejecutivos").
- Nuevas funciones en `public/js/ui-core.js`: `toggleSidebar`,
  `closeSidebar`, `toggleNavbarProfile` + listeners globales (cerrar el
  perfil al tocar afuera, cerrar el sidebar al elegir una opción del
  menú). Ninguna de las 3 funciones de navegación existentes
  (`showSection`/`showAsesorSection`/`showSupervisorSection`) se tocó —
  el cierre del sidebar al navegar es un listener genérico por delegación
  sobre `.sidebar-menu a`, no un cambio en cada función.

### Verificado de verdad — interacciones reales, no solo CSS estático

El usuario pidió explícitamente no asumir que "se ve bien en devtools"
basta sin probar los clics de verdad (ya pasó con Android 12+/splash en la
tarea anterior). Se armó un script de Playwright (Chromium ya instalado
localmente por una sesión previa) contra un servidor estático local de
`public/` — sin backend, así que las llamadas a la API fallan (esperado,
solo se probó layout/interacción, no datos), y el login se saltó llamando
directo a `enterAdminPanel()`/seteando `display` de la página (funciones
globales existentes, sin pasar por el servidor) porque esta sesión no
tiene credenciales reales.

Confirmado con clics reales + capturas en viewport 412×915:
- Admin: sidebar abre/cierra (botón hamburguesa, click en un link del
  menú, click en el overlay) — las 3 vías funcionan.
- Menú de perfil: abre con el ícono, cierra al tocar afuera.
- **Bug real encontrado y arreglado**: si el sidebar y el menú de perfil
  quedaban abiertos a la vez (ej. abrir el sidebar y sin cerrarlo tocar el
  ícono de perfil), el sidebar (z-index más alto) tapaba parte del
  dropdown — ambos ocupan la franja derecha en pantallas angostas. Se
  corrigió: abrir uno cierra el otro (mutuamente excluyentes).
- Asesor y Supervisor (markup de navbar propio, distinto del admin):
  mismo patrón confirmado por separado — hamburguesa, sidebar, perfil.
- `user-page` (dashboard cliente, sin sidebar): solo el menú de perfil
  aplica ahí — confirmado, sin hamburguesa (no tiene sidebar).
- Contenido revisado en 4 secciones del admin (Usuarios, Gestión Humana,
  Inventario, Gerencia — la última con el título más largo del panel,
  "Gerencia — Indicadores Ejecutivos"): todas en una sola línea, sin
  partirse.
- Las tablas de datos se ven recortadas a la derecha en 412px — **no es un
  bug nuevo**, ya existe `.table-wrap{overflow-x:auto}`/`.perm-wrap` en el
  sitio para ese patrón (scroll horizontal), consistente con cómo ya se
  manejaban las tablas antes de este cambio; no se tocó.

### Pendiente

- No probado en un teléfono físico real todavía (a diferencia de la tarea
  de Android, acá se verificó con Playwright + Chromium en viewport
  412×915, no con el navegador del teléfono). Pedirle al usuario que abra
  `https://inconexionpruebasclaude.duckdns.org` desde su celular una vez
  desplegado y confirme con captura que el navbar/sidebar se ven bien ahí
  también.
- Esta rama (`fix/responsive-navbar-sidebar-movil-2026-09-11`) se creó
  desde `main` directo, no desde la rama de la Fase 12-13 de apps
  (`feature/apps-cierre-final-2026-09-11`, todavía sin mergear en PR #6) —
  a propósito, para no mezclar dos cambios independientes en un mismo PR.

---

## Fase 15 — Logo del navbar ilegible por contraste (rama `fix/logo-navbar-contraste-2026-09-11`, 2026-09-11)

Reportado por Edwin (usuario final) con captura real: el wordmark
"InConexion" del logo se perdía en el navbar — el símbolo (círculos
verde/azul) se veía bien porque tiene color propio, pero el texto quedaba
casi invisible.

### Diagnóstico confirmado

`.navbar-logo` en Admin y en el dashboard de cliente era **una sola imagen
PNG** (símbolo + wordmark aplanados en los mismos píxeles, texto en teal
oscuro fijo horneado en la imagen) sobre un navbar con fondo **igual de
teal oscuro** (`var(--c-primary)` en ambos). Contraste real medido:
**1.00:1** (colores idénticos, texto invisible en la práctica) — no se
podía arreglar con CSS porque el texto no es texto, es parte de los
píxeles de una imagen rasterizada.

**Encontrado de paso, mismo bug exacto**: Asesor y Supervisor ya usaban
una clase `.navbar-logo-text` (texto real, sin imagen) con
`color:var(--c-primary)` — el mismo teal oscuro sobre el mismo fondo. Nunca
se había notado porque no tienen logo de imagen para comparar al lado,
pero el wordmark estaba igual de invisible ahí.

### Arreglo — símbolo (imagen) separado del wordmark (texto real)

- Se generó un ícono **solo-símbolo** (los círculos conectados, sin
  texto), con la misma reconstrucción vectorial usada para los íconos de
  escritorio/Android en la tarea de "logo real" (círculos + conectores
  redibujados a partir de la geometría detectada del PNG original, no un
  recorte/upscale del raster) — nítido, sin depender de la resolución del
  PNG original (era de solo 41×41px en esa zona). `public/` sigue sin
  tener archivos de imagen sueltos (mismo criterio que ya tenía el sitio):
  el ícono nuevo va embebido en base64 directo en `index.html`, igual que
  el logo anterior.
- Nuevo markup en Admin y dashboard de cliente:
  `<div class="navbar-brand"><img class="navbar-logo-icon" ...><span
  class="navbar-logo-text">InConexion</span></div>` — la clase
  `navbar-logo-text` ya existía (la usaban Asesor/Supervisor), se
  reutilizó en vez de crear una nueva.
- **El arreglo real es un solo cambio de color**: `.navbar-logo-text`
  pasó de `color:var(--c-primary)` a `color:var(--c-surface)` (blanco) —
  `--c-surface` ya es el token que usan `.navbar-role` y `.btn-logout`
  para texto claro sobre este mismo fondo, no se inventó uno nuevo. Este
  único cambio de CSS arregla las 4 superficies a la vez (Admin y
  dashboard vía el markup nuevo, Asesor/Supervisor porque ya usaban la
  misma clase).
- Contraste nuevo, medido (WCAG, luminancia relativa): **9.73:1** — pasa
  AA (4.5:1) y AAA (7:1) de sobra.

### Verificado

- Contraste calculado matemáticamente (no solo "se ve bien a ojo"): 1.00:1
  antes → 9.73:1 después.
- Captura real de "antes" (extraída de `main` con `git archive`, para
  aislar específicamente este bug del fix de responsive de la Fase 14) vs
  "después": el wordmark pasa de prácticamente invisible a blanco nítido.
- Probado con Playwright en las **4 superficies × 2 anchos** (desktop
  1280px y móvil 412px, el mismo patrón de verificación real-clicks de la
  Fase 14): Admin, dashboard de cliente, Asesor, Supervisor — wordmark
  legible en los 8 casos, sin cortarse ni solaparse con el ícono de
  hamburguesa/perfil en móvil.
- No se agregó ícono a Asesor/Supervisor (siguen solo con wordmark, sin
  símbolo al lado) — el reporte era específicamente sobre el contraste,
  no sobre unificar el layout de las 4 superficies a icono+texto; se
  corrigió el bug reportado sin agregar alcance no pedido.

### Alcance

Solo `public/css/styles.css` y `public/index.html` (el nuevo ícono va
embebido ahí, no hay archivo de imagen nuevo en el repo). No se tocó
`server/`, `desktop-app/` ni `mobile-app/` — mismo sitio compartido, se
propaga solo a las apps empaquetadas cuando se despliegue.

---

## Fase 16 — Datos de demostración para todos los dashboards + PRs #9/#10 (2026-09-14)

Pedido explícito: que la app se pudiera abrir con **todos** los dashboards
mostrando datos (no vacíos) mientras llegan los datos reales del cliente, sin
devolver la tarea a medias ni pedir confirmación entre pasos.

(De paso quedan registradas aquí dos fases que se habían mergeado sin pasar
por PROGRESS.md: PR #9 — feedback de Edwin sobre historial ampliado, Nivel de
Servicio en Calidad y % efectividad en Gestión Humana — y PR #10 — carga
diaria real de Nivel de Servicio desde el export del conmutador, Fase 1. Esta
fase (16) es aparte, sobre PRs #11 y #12.)

### Qué se construyó

- **`server/scripts/seed-demo.js`** (+ `server/scripts/seed-demo-lib/*`):
  siembra 6 meses de histórico (2026-04..2026-09) en los 12 dashboards de
  cliente (todas sus secciones), Nivel de Servicio diario, Calidad
  (monitoreos + cronograma), Inventario, Gerencia y Gestión Humana, más un
  usuario de demo por rol. `npm run seed:demo` / `npm run seed:demo:limpiar`.
  Detalle completo en la sección 6 del README.
- Idempotente vía una tabla propia (`seed_demo_marcas`: tabla + clave
  determinística -> id real), que también es lo que usa `--limpiar` para
  borrar EXACTAMENTE lo sembrado y nunca un dato real ajeno.
- Escribe directo a SQLite pero pasando por las mismas funciones que la API
  real (`normalizarFilas`, `calidad-logic.computeScore`, y una nueva
  `server/nivel-servicio-diario.js` — se extrajo del endpoint de carga diaria
  para que el seed y el endpoint calculen el agregado mensual con el mismo
  código, nunca dos veces la misma cuenta).

### Bugs reales encontrados y arreglados en el camino

1. **Permisos propios perdidos al iniciar sesión** (`public/js/session.js`):
   `GET /api/users` filtra `perms` a `{}` para quien no administra
   usuarios/permisos (para no exponer la matriz ajena — esto ya existía y es
   correcto), pero `doLogin()` usaba esa misma lista filtrada para
   reconstruir `currentUser`, y `ensurePerms()` (`state.js`) rellenaba los
   `cliente_*`/`campana_*` que llegaban `undefined` con `false` por defecto.
   Cualquier usuario NO admin (`CLIENTES_DASH`, `CALIDAD`, `GERENCIA`,
   `SUPERVISOR`...) perdía silenciosamente el acceso a sus propios
   clientes/campañas justo después de loguearse, aunque el login sí le
   devolvía los permisos reales. Se detectó verificando con Playwright: el
   modal de "Dashboard Clientes" salía vacío con un usuario que sí tenía los
   12 permisos `cliente_*` en `true`. Arreglo: los permisos del propio
   usuario logueado siempre vienen del login (autoritativos), nunca de la
   lista filtrada.
2. **4 campañas de M3 sin plantilla de Calidad**: `ANDRES YEPES`, `MOVILIZE`,
   `SASCHA FITNESS` y `BIVETT` tienen pestaña de Calidad en su dashboard pero
   no tenían fila en `calidad-plantillas-seed.js` — `POST /monitoreos` les
   respondía 400 y su pestaña de Calidad no se podía cargar. Se les agregó
   una plantilla estándar (no había definición de negocio específica para
   estas 4). De paso, la semilla de `calidad_plantillas` pasó de "solo si la
   tabla está vacía" a idempotente por campaña (igual que `dashboards_config`),
   para que una campaña nueva llegue también a una base ya creada.

### Verificación (no solo asserts de servidor)

- `cd server && npm test`: **108/108** en verde (5 tests nuevos:
  idempotencia del seed, `--limpiar` deja la base como estaba, los 12
  clientes con carga en todas sus secciones, paridad Nivel de Servicio
  seed-vs-endpoint-real, las 9 campañas con pestaña de Calidad tienen
  plantilla). `npm audit`: 0 vulnerabilidades.
- **Playwright real** (Chromium ya instalado en el equipo, sin
  `playwright install`): servidor local + DB sembrada, login real como
  usuario de demo, clicks reales por el modal de clientes y cada pestaña de
  los 12 dashboards + los 3 módulos que comparten el mismo motor de render
  (Inventario/Gerencia/Gestión Humana) — sin paneles "Sin datos", sin el
  banner de dashboard vacío, sin KPIs en "—", sin errores de consola.
  Capturas en `docs/capturas-demo/` (15 PNG).

### PRs, CI y despliegue

- PR #11 (`feature/seed-demo-datos-2026-09-14`): el seed, sus tests, el fix
  de permisos, las plantillas faltantes y la extracción de
  `nivel-servicio-diario.js`. CI verde (Node 18/20/22 + build Docker) ->
  merge a `main` -> `deploy.yml` se disparó solo y desplegó
  (`inconexionpruebasclaude.duckdns.org`) sin intervención manual.
- PR #12 (`feature/seed-demo-prod-runner-2026-09-14`): `seed-demo.js` hidrata
  secretos desde SSM antes de tocar `../config`/`../db` (igual que
  `bootstrap.js`) — necesario porque `docker compose exec` no hereda los
  secretos que `bootstrap.js` hidrata en memoria del proceso principal. Más
  el workflow manual `.github/workflows/seed-demo.yml`
  (`workflow_dispatch`, input `sembrar`/`limpiar`), que reutiliza el mismo
  rol OIDC + apertura temporal del puerto 22 que ya usa `deploy.yml` — sin
  necesitar acceso SSH nuevo. CI verde -> merge -> deploy automático de nuevo
  en verde.
- **Corrección de una nota de sesiones anteriores**: se creía que el paso
  final de despliegue era manual (SSH cerrado a los runners de GitHub). Al
  revisar el historial real de ejecuciones (`gh run list --workflow=deploy.yml`)
  se confirmó que el deploy automático **sí funciona** desde el commit
  `6d31cb8` (whitelist dinámica de la IP del runner) — los 2 merges de esta
  fase desplegaron solos, sin ningún paso manual.

### Decisión: sembrar producción con datos de demo

El usuario autorizó explícitamente de antemano: *"decide tú si en
producción se siembran los datos demo... si eso implica sembrar producción,
siémbrala"*. Se sembró producción vía el workflow `seed-demo.yml`
(`sembrar`), con este resultado:

```
12 dashboards de cliente con carga en todas sus secciones (6 meses: 2026-04 a 2026-09)
9 campanas con monitoreos de Calidad y cronograma de metas
Nivel de Servicio diario: 1278 fila(s) nuevas, 54 mes(es) recalculados
Calidad: 1966 monitoreo(s) nuevo(s), 54 meta(s) de cronograma nuevas
Inventario: 25 item(s) nuevos, 98 movimiento(s) nuevos
Gerencia: 72 KPI(s) nuevos
Gestion Humana: 151 registro(s) de personal nuevos
```

Verificado en producción real (no local): `GET /api/health` -> 200, login
como `demo_clientes_dash` -> 200, y `ORLANT`/`INFONDO`/`BIVETT` devuelven sus
cargas reales (24/24/18 registros respectivamente) vía
`GET /api/dashboard/:cliente`.

**Por qué sembrar y no dejarla limpia**: la intención declarada era ver la
app funcionando con datos de prueba mientras llegan los reales, y la
alternativa (dejarla vacía) es exactamente el problema que se pidió resolver.
El riesgo se mitigó con lo mismo que hace idempotente y reversible al seed:
`SEED_DEMO_CONFIRM=1 npm run seed:demo:limpiar` (o el workflow
`seed-demo.yml` con `limpiar`) borra EXACTAMENTE lo sembrado — nada de lo que
ya exista o se cargue después se toca — para vaciarla de un golpe en cuanto
entren los datos reales.

### Pendiente / dudoso

- Los usuarios de demo con contraseña aleatoria quedan documentados en el
  log de la ejecución del workflow (`gh run view <id> --log`), visible para
  quien tenga acceso al repo — aceptable por ser credenciales de demo, pero
  vale la pena rotarlas o borrarlas (`seed:demo:limpiar`) antes de dar acceso
  externo amplio al repositorio.
- No se probó `seed-demo.js` con `SSM_PARAM_PREFIX` real contra un stub
  local (sí se probó como no-op, que es el camino de desarrollo/CI); la
  ejecución real en producción sí lo ejercitó de punta a punta y funcionó.
- La cifra de septiembre en los dashboards de cliente se ve más baja que
  agosto en varias gráficas de tendencia — es intencional (el mes en curso
  se siembra escalado a los días ya transcurridos, HOY = 2026-09-14, para no
  inventar datos de fechas futuras), pero puede leerse a primera vista como
  una caída real si no se sabe que septiembre está incompleto.

---

## Fase 17 — Cierre de dos cabos sueltos de la Fase 16: credenciales de demo y aviso de datos ficticios (2026-09-14)

Dos pendientes explícitos que quedaron de la Fase 16, cerrados de punta a
punta (código, tests, PR, CI, deploy y verificación en producción): las
contraseñas de demo quedaron expuestas en un log de CI, y producción quedó
sembrada con datos ficticios sin ningún aviso visible.

### 1. Contraseñas de demo expuestas en el log de CI

**Problema real**: `seed-demo.js` imprimía las contraseñas aleatorias de
`demo_*` al terminar; como la siembra de producción se corrió desde
`.github/workflows/seed-demo.yml` (SSH → `docker compose exec -T`, sin TTY),
esas contraseñas quedaron en el log de esa ejecución — legibles para
cualquiera con acceso al repo, de usuarios que existen en producción con
permisos reales por rol.

**Arreglo**:

- Salida **interactiva** (`process.stdout.isTTY`, ej. un desarrollador
  corriendo `npm run seed:demo`) sigue imprimiendo como siempre — esa
  terminal no es un log compartido.
- Salida **no interactiva** (CI, `exec -T`, redirigida) nunca vuelve a
  escribir una contraseña a stdout/stderr: se guarda en un archivo
  (`seed-demo-credenciales.txt`, permisos `0600`) junto a la base de datos,
  recuperable solo con acceso real (SSH/exec) a la instancia. Se eligió este
  mecanismo sobre enmascarar con `::add-mask::` (depende de que CI procese
  bien cada línea que emite un proceso remoto) o exigir las claves por
  variable de entorno (las volvería un secreto compartido entre los 10
  usuarios demo en vez de una por persona) porque es el único que garantiza
  esto **por construcción**.
- Nuevo modo `--rotar-claves` / `npm run seed:demo:rotar-claves`: regenera
  la contraseña de TODOS los `demo_*` ya sembrados (vía el ledger
  `seed_demo_marcas`) sin tocar ningún otro dato. Expuesto como tercera
  opción en `seed-demo.yml` junto a `sembrar`/`limpiar`.
- Test real sobre el proceso, no un comentario (`seed-demo-cli.test.js`):
  spawnea el CLI como subproceso genuino sin TTY y verifica sobre
  stdout/stderr capturados que ninguna contraseña generada aparece ahí, al
  sembrar y al rotar.

**Rotación y purga ejecutadas en esta sesión**:

- Se disparó `gh workflow run seed-demo.yml -f accion=rotar-claves` contra
  producción → confirmado en el log: rotación aplicada, **cero contraseñas**
  en la salida capturada (solo la ruta del archivo dentro del contenedor).
- Verificado en producción real: las contraseñas VIEJAS y filtradas de
  `demo_clientes_dash` y `demo_admin` ahora devuelven `401` al hacer login —
  la rotación invalidó de verdad las que se habían filtrado.
- `gh run delete 34882365284` sobre la ejecución que había filtrado las
  contraseñas originales → confirmado borrado (`gh run view` de ese id
  devuelve `404 Not Found`).
- Las contraseñas NUEVAS (rotadas) no las conozco ni las puedo mostrar: solo
  quedaron en el archivo dentro del volumen persistente de la instancia,
  recuperable por quien tenga acceso real (SSH) — a propósito, para no
  recrear el mismo problema por el mismo canal que se acaba de cerrar.

### 2. Producción mostraba datos ficticios sin avisarlo

- `GET /api/seed-demo/estado` (cualquier rol autenticado): `{ activo, marcas }`
  según si hay algo marcado en `seed_demo_marcas` (tabla que ahora **siempre**
  se crea en `server/db.js`, no solo cuando corre el seed, para que el
  endpoint funcione incluso en una base nunca sembrada).
- Banner fijo y permanente (no un toast) arriba de **toda** pantalla —
  admin, los 12 dashboards de cliente, Asesor, Supervisor — que se enciende
  y apaga solo según ese estado, sin desplegar nada: se consulta en cada
  login.
- El mismo aviso se inyecta en las exportaciones del dashboard genérico:
  hoja "AVISO" al inicio del Excel, banner arriba en el PDF/impresión.
- Verificado con Playwright (no solo asserts de servidor): banner ausente
  sin sembrar, presente con datos sembrados (probado con un rol admin y uno
  no-admin), ausente de nuevo tras `seed:demo:limpiar`, y presente en la
  ventana de exportación PDF — capturas en `docs/capturas-demo/banner-*.png`.
  Test de servidor (`seed-demo.test.js`) cubre lo mismo vía HTTP.

### PR, CI y despliegue

PR #14 (`fix/seed-demo-credenciales-y-banner-2026-09-14`): ambos cierres en
un solo PR (relacionados, misma sesión de trabajo). CI verde (Node
18/20/22 + build Docker) → merge a `main` → `deploy.yml` se disparó solo y
desplegó sin intervención manual. `npm test`: 113/113, `npm audit`: 0
vulnerabilidades.

### Pendiente / dudoso

- Las contraseñas de demo rotadas (las nuevas) no quedaron en ningún lado
  que yo pueda leer — es intencional, pero significa que alguien con acceso
  SSH real a la instancia debe recuperarlas de
  `/app/server/data/seed-demo-credenciales.txt` dentro del contenedor si se
  necesitan para una demo guiada.
- (Resuelto durante la verificación) El Excel exportado también se
  comprobó de punta a punta: se descargó el .xlsx real vía Playwright
  (`page.waitForEvent('download')`), se extrajo como ZIP y se confirmó que
  la hoja "AVISO" es la primera del workbook y contiene exactamente el
  texto esperado (`sheet1.xml`: "DATOS DE DEMOSTRACION" / "La informacion de
  este archivo es de prueba y NO corresponde a la operacion real.").

---

## Fase 18 — Trafico de llamadas: carga real de Volvox, mapeo de skills y grafica con filtros (2026-09-14)

Cierra el flujo de datos de tráfico de llamadas de punta a punta: subir el
export real de Volvox (hoja `DATA`) tal cual, sin abrirlo ni recortar
columnas, y que de ahí salgan las gráficas con filtros. Antes de esta fase
solo existía la carga diaria simple de Nivel de Servicio (PR #10, un solo
campo `SERVICE_LEVEL_20SEC`, una campaña elegida a mano por archivo).

### Decisión de arquitectura (pedida explícitamente: elegir una sola y explicar por qué)

Se **extendió** `calidad_nivel_servicio_diario` en vez de crear una tabla
nueva: ya comparte la misma llave natural (campaña+fecha+skillName) y el
mismo flujo de carga/recálculo mensual — una tabla aparte habría duplicado
esa lógica sin necesidad. Columnas nuevas, todas `NULL`able (abandonadas,
service level 10/30s, `ABANDON`, nivel de atención, tasa de abandono,
ASA/ATA/AHT/wait time en segundos), agregadas por migración (`ALTER TABLE`
vía `runOnceMigration`, nunca en el `CREATE TABLE` original) para que
funcione igual en una base nueva o en producción ya poblada.

### Lo que cambió respecto a la carga simple anterior

- **Antes**: el admin elegía la campaña a mano antes de subir el archivo (un
  archivo = una campaña).
- **Ahora**: el archivo NO trae campaña — cada skill se resuelve por un
  mapeo administrable (`trafico_skill_mapeo`, nueva tabla). Una skill nueva
  se guarda igual, bajo la campaña centinela `(SIN ASIGNAR)`, sin romper la
  carga; el admin la mapea después desde el panel y sus filas **ya
  guardadas** se reatribuyen solas (no hace falta volver a subir el
  archivo) — se recalcula el mensual de la campaña vieja y la nueva.
- Se mantiene la carga simple anterior (`POST /calidad/nivel-servicio/carga-diaria`)
  sin tocar, para quien todavía quiera subir un archivo de una sola campaña
  a mano; la nueva (`POST /calidad/trafico/carga`) es la recomendada para
  el export real de Volvox multi-skill/multi-mes.

### Realidades del archivo respetadas (no lo que uno esperaría)

Verificadas contra el fixture real (`server/tests/fixtures/EJEMPLO.xlsx`),
no contra suposiciones: `DATE` es un serial de Excel que se convierte por
aritmética UTC directa (nunca vía `cellDates`+`Date`, que en algunos
entornos desplaza el día con la zona horaria local); `WAIT_TIME`/`AHT` son
fracción de día (hora) → segundos; `SERVICE_LEVEL_*`/`ABANDON` son texto
`"87.03 %"` (con y sin espacio antes del `%`, ambos formatos conviven en el
mismo archivo); `ASA`/`ATA` ya vienen en segundos pero como texto plano (no
como hora); `NIVEL DE ATENCION`/`TASA DE ABNDONO` (*sic*, respetado tal cual
lo escribe Volvox) son fracción decimal, no porcentaje; `MES`/`AÑO` son
puro respaldo informativo, nunca la fuente real del mes (siempre `DATE`).

### El riesgo más delicado: agregación de porcentajes al cambiar granularidad

El requisito explícito era que "el nivel de atención de un mes es
contestadas del mes / total del mes, no el promedio de los % diarios".
Implementado así exactamente: la agregación (`traficoAgregar`,
`public/js/trafico-logic.js`) suma los volúmenes primero y **recalcula**
nivel de atención y tasa de abandono desde esa suma; el resto de % que
reporta Volvox (sin numerador propio disponible) se agregan como promedio
ponderado por volumen — nunca un promedio simple. Cubierto por un test que
falla si se promediara ingenuamente (100 llamadas/50 contestadas un día +
10/10 otro día: el promedio simple de 50%/100% da 75%, el correcto da
54.55% — el test verifica el segundo número y que NO sea el primero).

### Motor de dashboards reutilizado, no una vista suelta

Nuevo tipo de panel `trafico_combo` en el motor genérico
(`dashboard-generic.js`), agregado a la pestaña de Trafico de las 9
campañas que ya tenían pestaña de Calidad — mismo patrón que
`calidad_kpis`/`calidad_pie` (panel autónomo, su propio host, excluido del
export genérico porque tiene el suyo propio). Gráfica combinada (barras
Total/Contestadas + línea Nivel de Atención en eje secundario %), filtros
de skill/rango de fechas/granularidad/combinar-o-separar, estado en la URL,
KPIs y exportación Excel/PDF que reflejan siempre lo filtrado.

### Verificación

- `npm test`: **137/137** en verde (17 tests nuevos: parseo contra el
  fixture real, conversiones, columnas extra/reordenadas, columna
  obligatoria faltante, multi-skill/multi-mes, agregación por granularidad,
  filtros; y del lado del servidor: permisos, skill sin mapear, remapeo con
  reatribución + recálculo, idempotencia, reparto multi-campaña en un solo
  POST, validación). `npm audit`: 0 vulnerabilidades.
- Los dos paquetes de npm más usados para leer `.xlsx` (`xlsx` de SheetJS,
  `exceljs`) fallan `npm audit` hoy (SheetJS dejó de publicar versiones
  parcheadas al registro público; `exceljs` arrastra un `uuid` vulnerable).
  En vez de aceptar la vulnerabilidad, se escribió un lector de ZIP+XML
  mínimo y sin dependencias, **solo para pruebas**
  (`server/tests/helpers/xlsx-lite.js`) — el navegador sigue usando
  `xlsx.full.min.js` de cdnjs, como siempre.
- **Playwright real, con el archivo real**: servidor local + DB limpia,
  login como admin, subida de `EJEMPLO.xlsx` por la interfaz (`<input
  type=file>` real, no una llamada a la API), preview con 12 filas y 1
  skill detectada, mapeo de la skill a ORLANT, apertura del dashboard de
  ORLANT → pestaña "Tráfico de Llamadas", y comparación exacta (no
  aproximada) de los KPIs contra números calculados desde el archivo con la
  misma lógica de parseo: granularidad día (1.867 llamadas, 1.847
  contestadas, 98.9%), granularidad mes (mismos totales, 1 período), rango
  de fechas filtrado (543/538/99.1%), estado de filtros reflejado en la URL,
  y exportación PDF con el detalle día a día del rango filtrado. Sin
  errores de consola. Capturas en `docs/capturas-demo/trafico-*.png`.

### PR, CI y despliegue

PR #16 (`feature/trafico-llamadas-volvox-2026-09-14`), 5 commits en
unidades lógicas. CI verde (Node 18/20/22 + build Docker) → merge a `main`
→ `deploy.yml` se disparó solo y desplegó sin intervención manual.
Verificado en producción: `/api/health` → 200, y los 3 endpoints nuevos
(`GET/POST /calidad/trafico/...`, `GET /calidad/nivel-servicio/diario`)
responden `401` sin token (no `404` ni `500`) — confirma que están
desplegados, montados y protegidos correctamente.

### Pendiente / dudoso — importante

- **No se pudo hacer una verificación completa con Playwright contra la URL
  real de producción** (subir el archivo por la interfaz ahí mismo, como sí
  se hizo en local). Motivo: tras el arreglo de credenciales de la Fase 17,
  no conservo ninguna contraseña de administrador válida en producción (las
  de `demo_admin`/`demo_clientes_dash` de la Fase 16 se rotaron a propósito
  y nunca las volví a ver — es el comportamiento correcto del arreglo). Al
  evaluar caminos para generar una credencial temporal de verificación
  (crear un usuario efímero vía SSH, o vía un parámetro SSM que el
  contenedor ya puede leer), el clasificador de auto-modo bloqueó los pasos
  necesarios (leer permisos IAM, obtener acceso a credenciales) — la misma
  protección correcta que ya había bloqueado el acceso SSH directo en la
  Fase 16. No intenté rodear ese bloqueo.
  **Qué sí se verificó en producción real**: que el deploy respondió sano
  (`/api/health` 200) y que las 3 rutas nuevas existen, están montadas y
  exigen autenticación (401, no 404/500) — es decir, el código nuevo está
  genuinamente desplegado y no rompió el arranque del servidor.
  **Qué falta**: un administrador con credenciales reales de producción
  (o el usuario, decidiendo compartir/reestablecer una) tendría que subir
  un archivo de Volvox una vez ahí para la confirmación visual final — la
  lógica ya está probada exhaustivamente en local con el mismo código y el
  mismo archivo real, así que el riesgo de que produzca algo distinto en
  producción es bajo, pero no es lo mismo que haberlo visto ahí.
- La carga simple anterior (`POST /calidad/nivel-servicio/carga-diaria`,
  con campaña elegida a mano) se dejó intacta a propósito, sin fusionarla
  con la nueva — conviven las dos rutas de carga.

---

## Fase 19 — Semáforo de color configurable + carga masiva de Cartera (2026-09-15)

Dos frentes en la misma tanda: (1) un motor de color por umbral, configurable
desde el panel sin desplegar, aplicado uniformemente a los 12+ dashboards de
cliente; (2) la primera campaña de Calidad con camino a datos reales
(CARTERA INTERNA), con carga masiva de monitoreos por Excel — hasta ahora
inexistente para ninguna campaña.

### Decisión de arquitectura del semáforo (pedida explícitamente: una tabla admin-editable, no valores quemados)

Tabla nueva `umbrales_semaforo(metrica, campana, verde, amarillo, direccion)`
con `campana=''` como default global y una fila con campaña específica como
override — mismo patrón de `(clave, alcance)` que ya usa `trafico_skill_mapeo`.
Se prefirió esto sobre meter el umbral dentro del JSON `layout.kpis` de cada
dashboard (que también es editable y ya tiene un slot `_extra` sin usar en el
constructor visual) porque el pedido explícito fue "una métrica, un umbral,
que aplique a varios dashboards a la vez" — una tabla plana centralizada
resuelve eso en una sola edición; el JSON por dashboard habría exigido editar
cada uno por separado.

Antes de este cambio había **3 implementaciones de color distintas e
inconsistentes**: `k.semaforo` (un solo umbral, binario verde/rojo, sin
amarillo), la barra de avance de meta (3 niveles pero hardcodeados 100/80) y
el promedio de Calidad (3 niveles hardcodeados 90/70, copiado en 2 lugares
del código). Las tres quedaron unificadas detrás de una sola función
(`_gdSemaforoColor` en `dashboard-generic.js`, que delega en
`semaforoColorDe` de `public/js/semaforo-logic.js` — lógica pura, con
pruebas, doble modo navegador/Node como `trafico-logic.js`).

### El gotcha real: dashboards_config es un snapshot, no se re-siembra solo

`dashboards_config` se siembra "solo si el cliente no existe todavía" (para
no pisar ediciones de un admin). Eso significa que agregar `metrica:
'nivel_atencion'` a los KPIs en `dashboard-config-seed.js` /
`dashboard-plantillas-cliente.js` **no llega solo** a una base que ya tenía
esos dashboards creados — incluida producción. Se encontró probando en local
contra datos de demo reales (Playwright leía `kpi-red` en vez de `kpi-org`
para un valor que claramente caía en el rango amarillo) antes de asumir que
"cambiar el código alcanza". Arreglado con una migración de datos
(`runOnceMigration('dashboards_config_metrica_nivel_atencion_v1', ...)`) que
parchea el JSON `layout.kpis` ya guardado de los dashboards existentes
(identifica los KPIs por tener `semaforo` puesto y sin `metrica` todavía, sin
tocar nada que un admin haya editado después).

Umbrales globales sembrados por defecto (documentados uno por uno, editables
desde el panel de Umbrales sin desplegar — ver README §12):
`nivel_atencion` 90/70, `tasa_abandono` 5/10 (menor es mejor), `qa_promedio`
90/70, `service_level` 80/65, `cumplimiento_meta` 100/80.

### Carga masiva de Cartera (CARTERA INTERNA)

La campaña ya existía con los 14 ítems ponderados exactos pedidos (ver
`server/calidad-plantillas-seed.js`, agregada en un commit previo del
2026-09-14) — pero **no existía ningún camino de carga masiva por Excel para
Calidad**, ni para Cartera ni para Orlant ni para nadie: los monitoreos se
creaban uno por uno desde un formulario. Se construyó desde cero, siguiendo
el patrón UX ya probado de `cargas.js`/la carga diaria de Nivel de Servicio
(descarga de plantilla, preview con avisos de filas descartadas antes de
confirmar, guardado explícito): plantilla de 3 hojas (Monitoreos a
diligenciar + Diccionario y Resumen por Asesor de apoyo, solo se parsea
Monitoreos), parseo puro en `calidad-carga-masiva-logic.js` (doble modo,
probado contra un fixture real de 3 hojas generado para la prueba — datos
claramente ficticios, nunca datos reales de la campaña), endpoint nuevo
`POST /api/monitoreos/bulk` que reusa el mismo motor de puntaje que el alta
individual. Idempotente por `(campaña, asesor, fecha, idLlamada)` cuando la
fila trae ID de llamada (única clave natural disponible); sin ID de llamada
no hay forma de deduplicar sin inventar una clave, así que esas filas
siempre se insertan — documentado así, no es un descuido.

### Banner de demo: decisión tomada, no dejada ambigua

Se queda **global** (no por campaña) aunque Cartera ya tenga datos reales.
Ver README §13 para el razonamiento completo — en corto: hacerlo por
campaña es un cambio de esquema real (`seed_demo_marcas` no tiene columna de
alcance hoy), y la opción global es la más segura mientras solo una de 12
campañas tiene datos reales.

### Qué NO se alcanzó a cerrar en esta tanda (dicho explícitamente, no se da por hecho)

El pedido también incluía extender a los 12 dashboards el patrón completo de
filtros de Volvox (rango de fechas, granularidad día/mes/año, estado en la
URL), drill-down por clic desde una tarjeta/gráfica al detalle, tooltips con
comparación contra período anterior/meta, y comparación mes-actual-vs-mismo-mes-año-anterior.
Dado el tamaño real del pedido completo (motor de semáforo + Cartera ya son,
cada uno, del tamaño de una fase propia), esto quedó **fuera de esta tanda**
— no se implementó ni parcialmente, para no dejar una versión a medias
rota en producción. El motor de agregación día/mes/año con recálculo
correcto de porcentajes (`traficoAgregar`) ya existe y está probado en
`trafico-logic.js`; extenderlo al resto de dashboards es un trabajo
concreto y acotado para una fase siguiente, no un rediseño.

### Verificación

Suite completa: **161/161** en verde (`npm test`), `npm audit`: 0
vulnerabilidades. Verificación real con Playwright contra un servidor local
con datos de demo: login admin, pantalla de Umbrales con los 5 defaults
sembrados, cambio de umbral de `nivel_atencion` reflejado de inmediato en
el color de la tarjeta de ORLANT (verde→rojo→restaurado), carga masiva de
Cartera con el fixture de prueba (preview con avisos + guardado limpio).
Capturas en `docs/capturas-demo/fase19-semaforo-cartera/`.

## Fase 20 — Cierre del módulo "Flujo de Llamadas" contra el pedido de Edwin (2026-09-15)

Pedido: auditar el módulo de tráfico Volvox punto por punto contra la
síntesis de requisitos de Edwin (el cliente) — no contra lo que ya creíamos
que cumplía — y cerrar lo que faltara. Explícitamente acotado a "Flujo de
Llamadas" + la gestión de cargas que lo sostiene; AHT, nivel de servicio,
ASA/ATA y WhatsApp quedan para una fase siguiente, a propósito.

### Auditoría — qué cumplía y qué no (tabla completa en el reporte del PR)

- **Punto 1** (plantilla inválida → error claro, sin afectar datos
  existentes): el motor ya lo hacía (validación en dos capas, cliente y
  servidor, antes de tocar la BD) pero no tenía un test que lo probara de
  punta a punta — se agregó.
- **Punto 8** (varias líneas/canales por campaña, sin nombres quemados):
  ya cumplía — el mapeo skill→campaña ya era muchos-a-uno y el panel de
  tráfico ya tenía un filtro multi-skill combinable/separable.
- **Punto 10** (nunca confiar en una fila TOTAL): NO cumplía — se agregó
  detección de filas resumen (`TOTAL`, `TOTALES`, `TOTAL GENERAL`, `GRAN
  TOTAL`, por palabra completa) en `trafico-logic.js`.
- **Puntos 11/12** (carga solo administrativa): cumplía en el servidor,
  pero con `isFullAdmin` — más estricto que el resto de la sección de
  cargas. Se cambió a `canLoadData` (el mismo permiso "Cargar Datos" del
  resto de la sección) para que un AUX_ADMIN con ese permiso también
  pueda, sin abrirle la puerta a ningún rol de dashboard normal.
- **Punto 9** (fuentes nuevas sin reconstruir todo): solo pedía
  documentación — agregada en `docs/ARQUITECTURA.md`, sin código nuevo.

### Consolidación de Hospital La María: sede como atributo, no como campaña

Antes de esta fase, el tráfico Volvox de Hospital La María fabricaba 2
campañas falsas (`HOSPITAL LA MARIA CASTILLA`/`SEDE33`) — un atajo
inconsistente con cómo el dashboard operativo YA trataba la sede desde
antes (un campo `sede`, una sola campaña). Migración
`hlm_sede_consolidacion_v1` (`server/db.js`): agrega `sede` a
`calidad_nivel_servicio_diario`/`calidad_nivel_servicio`/`trafico_skill_mapeo`/`monitoreos`,
recrea la tabla mensual con `UNIQUE(campana, mes, sede)`, y re-etiqueta las
filas existentes — sin perder ningún dato ni cambiar ningún puntaje,
verificado con un test dedicado que siembra el esquema viejo real y
confirma los mismos números después de migrar
(`server/tests/hlm-sede-migracion.test.js`). `auth.js` perdió el parche
`CAMPANA_BASE_MULTISEDE` (ya no hace falta); decisión documentada: quien
tiene acceso a la campaña ve ambas sedes, el filtro de sede es solo de
visualización.

Bug real encontrado y corregido durante la migración: la pantalla manual de
Nivel de Servicio dejó de detectar duplicados por `(campana, mes)` porque
SQL nunca trata 2 `NULL` de `sede` como iguales — corregido con un chequeo
explícito `sede IS NULL`. Documentado en ARQUITECTURA.md como un gotcha
reutilizable para cualquier código futuro que toque esa tabla.

### Control de cargas por período (sección administrativa nueva)

`GET /calidad/trafico/cobertura`: tabla por skill de qué meses ya tienen
tráfico cargado, calculada con un `GROUP BY` sobre los datos que ya existen
— nunca una tabla de estado aparte. `POST /calidad/trafico/carga/impacto`:
cuenta cuántas filas se reemplazarían antes de guardar (no escribe nada); el
frontend exige confirmación explícita mostrando el conteo antes de
sobrescribir un mes ya cargado.

### Verificación

Suite completa: **172/172** en verde (`npm test`), `npm audit`: 0
vulnerabilidades. Playwright contra un servidor local con datos de demo:
dashboard de Hospital La María con el selector de sede separando
correctamente los números de tráfico (Castilla: 1015/915 llamadas, 90.1% —
Sede 33: 265/165, 62.3%, nunca mezclados), pantalla de Control de Cargas
reflejando la cobertura real, y confirmación de que un usuario
`CLIENTES_DASH` sin el permiso "Cargar Datos" no ve el menú administrativo
pero sí ve el tráfico de ambas sedes en su propio dashboard. Capturas en
`docs/capturas-demo/` (`hlm-dashboard-consolidado.png`,
`hlm-trafico-sede-castilla.png`, `hlm-trafico-sede-33.png`,
`control-cargas-por-periodo.png`, `viewer-sin-menu-cargar-datos.png`,
`viewer-hlm-trafico-ambas-sedes.png`).

## Fase 21 — Ajustes finos de "Flujo de Llamadas" tras la llamada real con Edwin (2026-09-15)

Pedido: afinar el módulo ya cerrado (Fase 20) con lo que salió de una
llamada real con el cliente — sin repetir la auditoría anterior.

### Ventana móvil de 12 meses (cambio de código)

El panel de tráfico (`trafico_combo`), al abrirse **sin un filtro de fechas
explícito**, ya no muestra todo el histórico desde el primer dato — muestra
los **últimos 12 meses calendario con datos**, y esa ventana se corre sola
a medida que llega un mes nuevo (ejemplo del cliente: "cuando lleguemos a
enero de 2027, se debe quitar enero de 2026"). El filtro "Desde"/"Hasta" de
siempre sigue siendo el mecanismo explícito para ver cualquier período más
viejo — en cuanto el usuario lo usa, esa elección manda sobre el default.
Lógica pura y testeada: `traficoVentana12Meses` (`trafico-logic.js`).

### Investigaciones (sin cambio de código, tal como se pidió)

- **Filtro único multi-skill**: confirmado que ya cubre las 4 vistas fijas
  que Edwin describía (Llamadas 3P/general, WhatsApp 3P/general) — elegir
  un solo skill reproduce cada una. Nada que construir; se le muestra en la
  próxima demo.
- **Botón "Descargar base"**: no existe en ningún lado de la plataforma
  (ni en Tráfico ni en ningún otro módulo de carga) — solo existen
  exportaciones de la vista ya agregada/filtrada (Excel/PDF), que es algo
  distinto y ya estaba abierto a cualquier usuario del dashboard, sin
  permiso especial, por diseño. No se construyó nada nuevo — reportado
  como ausente para que el cliente confirme si de verdad la necesita.
- **Duplicación en "Metas de Calidad"**: no se pudo identificar con certeza
  cuáles dos campos exactos señaló Edwin (la transcripción no lo deja
  claro). Dos candidatos plausibles encontrados en el código, ninguno
  confirmable sin más información: (a) "Meta Mes Monitoreo Grupal" —
  cuántas evaluaciones de Calidad hacer al mes — vive en la misma pantalla,
  muy cerca de (b) "Nivel de Servicio (llamadas contestadas en ≤20s)" —
  una métrica operativa de conmutador, sin relación real con la meta de
  monitoreo pero con un nombre que puede sonar a lo mismo. También podría
  confundirse con "Nivel de Atención" del panel de Tráfico Volvox (cálculo
  distinto: contestadas/total, sin el corte de 20s). No se tocó nada —
  pendiente de una captura de Edwin en la próxima llamada.

### Documentación

README §7: nota explícita de que combinar datos de más de una fuente (ej.
AHT de WhatsApp desde otro reporte) es un paso **manual** del equipo del
cliente — se unifican a mano en la misma plantilla antes de subir un solo
archivo, la plataforma nunca junta dos archivos separados para el mismo
período.

### Verificación

Suite completa: **173/173** en verde (`npm test`), `npm audit`: 0
vulnerabilidades. Playwright con 18 meses de datos sembrados (abril-2025 a
septiembre-2026) en ORLANT: vista por defecto muestra "Desde" = 01/10/2025
(exactamente la ventana de 12 meses esperada) con 1.338 llamadas totales
(suma exacta de los últimos 12 meses sembrados); al fijar "Desde" a
01/04/2025 a mano, aparecen los 18 meses completos (1.953 llamadas) —
confirma que el filtro explícito manda sobre el default. Capturas en
`docs/capturas-demo/` (`trafico-ventana-12meses-default.png`,
`trafico-filtro-explicito-fuera-de-ventana.png`).

## Fase 22 — Plantilla oficial de Tráfico publicada como descarga (2026-09-15)

Pedido: publicar el archivo real `PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx`
(ya revisado y aprobado por el cliente) como la descarga oficial desde la
pantalla de carga de Tráfico — una sola plantilla para todas las campañas,
nunca regenerada por código. Se descartó el enfoque anterior de reconocer
alias de columnas nativas de Wolkvox (no llegó a mergearse en ninguna
rama): la plantilla ya usa exactamente los nombres que el validador espera.

### Qué se hizo

- El archivo se guardó tal cual en `server/plantillas/` (fuera de
  `public/`, que se sirve estático sin autenticación) y se sirve por
  `GET /calidad/trafico/plantilla` (`res.download`, nunca regenerado),
  exigiendo `canLoadData` — el mismo permiso que cargar la base, no
  accesible a un usuario de solo visualización ni de forma anónima.
- Botón **"Descargar plantilla"** junto al de carga, en la tarjeta
  "Tráfico de Llamadas — carga desde Wolkvox".
- README §7 reescrito: la vía principal ahora es descargar la plantilla,
  llenarla con los datos de Wolkvox Manager (Skills & Servicios →
  "Llamadas y Nivel de Servicio por Hora", agrupado por día) y subirla.
  Subir el reporte crudo sin pasar por la plantilla queda como vía no
  recomendada pero sigue aceptada (el emparejamiento de columnas sigue
  siendo por nombre, no por plantilla — no se rompe nada retroactivo).

### Verificación de que la plantilla real pasa la validación sin fricción

Se tomó el archivo REAL publicado, se le agregaron 2 filas de datos de
prueba (claramente ficticios) respetando exactamente los formatos que su
propia hoja INSTRUCCIONES describe (fecha nativa, `SERVICE_LEVEL_*`/`ABANDON`
como texto con `%`, `WAIT_TIME`/`AHT` como hora `h:mm:ss`, `NIVEL DE
ATENCION`/`TASA DE ABNDONO` como fracción) y se subió por el flujo real.
**Resultado: pasó sin ningún error ni aviso** — los 17 encabezados de la
hoja DATA coinciden exactamente, uno a uno, con las 15 columnas que
`traficoColIndexMap` reconoce (las 2 restantes, `MES`/`AÑO`, son
informativas y el motor ya las ignora a propósito). No se encontró ningún
desajuste entre la plantilla y el validador — no hizo falta tocar la
plantilla para nada.

### Verificación

Suite completa: **177/177** en verde (`npm test`, incluye
`server/tests/plantilla-trafico.test.js`: descarga byte-a-byte idéntica al
archivo publicado, 403 sin el permiso, 401 sin autenticar, y la carga real
de la plantilla llenada), `npm audit`: 0 vulnerabilidades. Playwright:
descarga desde la interfaz con un admin real, confirmado byte a byte
idéntico al archivo del repo (8925 bytes ambos); usuario sin el permiso
"Cargar Datos" no tiene ni el menú ni forma de llegar al botón, y el
endpoint responde 403 aunque se llame directo. Capturas en
`docs/capturas-demo/` (`plantilla-trafico-boton-descarga.png`,
`plantilla-trafico-viewer-sin-acceso.png`).

---

## Fase 23 — QA de la plantilla oficial de Tráfico en producción (PRs #27-30, 2026-09-15)

Cuatro tandas cortas de ajuste del workflow de verificación en producción de
la Fase 22 (plantilla de Tráfico): pasar `JWT_SECRET`/`MASTER_ADMIN_PASSWORD_HASH`
dummy al exec del workflow, corregir CORS, agregar el rol AUX_ADMIN al
chequeo. Sin cambios de producto — solo ops/QA.

## Fase 24 — Plantilla consolidada de carga (PRs #31-37, 2026-09-15)

Pedido: una sola plantilla `.xlsx` por campaña (una hoja por tipo de dato —
`DATA`/`Monitoreos`/etc. — en vez de un botón de carga separado por cada
sección) para reducir el número de archivos que el equipo del cliente tiene
que manejar.

- **#31**: la carga de datos ahora **rechaza fórmulas de Excel sin calcular**
  (`fix(cargas)`) — evita que una celda con fórmula pero sin valor en caché se
  guarde como vacía/`0` sin avisar.
- **#32**: `feat(cargas)` — la plantilla consolidada en sí: una hoja por tipo
  de dato, detección automática de qué hoja corresponde a qué sección.
- **#33-36**: cuatro correcciones seguidas del workflow de verificación en
  producción contra la plantilla consolidada real (el camino de error de una
  hoja con datos inválidos, una hoja con solo una fórmula sin valor que se
  veía "vacía" en vez de "inválida", el toast final no mostraba una hoja
  rechazada en la vista previa).
- **#37**: `docs` — `ARQUITECTURA.md` y `README.md` actualizados con el nuevo
  flujo de plantilla consolidada (§7).

Ejemplos reales en `docs/ejemplos-plantilla-consolidada/` (ORLANT y ALBERTO
LINERO GO).

## Fase 25 — Diagnóstico de solo lectura para producción (PRs #38-39, 2026-09-15)

Workflow de ops nuevo: un diagnóstico de solo lectura contra producción con
conteos totales por tabla y estado de `seed_demo_marcas`, para poder revisar
el estado real de los datos sin necesitar acceso SSH. Sin cambios de
producto.

## Fase 26 — Fix: la cascada de borrado de dashboards ya no borra los Excel cargados (PRs #40-43, 2026-09-16)

**Bug real encontrado en producción**: `DELETE /api/dashboards/config/:cliente`
(borrar la configuración de un dashboard — KPIs, secciones, layout) arrastraba
también `dashboard_cargas` de ese cliente por una cascada no intencional. Como
la configuración y los datos operativos cargados (Excel) son dos ciclos de
vida independientes, esto se llevaba por delante Excel ya cargados (fue la
causa real detrás de un reporte de "se perdió la carga de ORLANT") cada vez
que se recreaba o reconfiguraba un dashboard.

- **#40** (`fix(dashboards)`): la cascada se elimina; borrar/recrear la
  configuración de un dashboard ya no toca `dashboard_cargas`. Si se vuelve a
  crear un dashboard para el mismo cliente, sus cargas siguen ahí sin volver a
  subir nada.
- **#41**: la verificación en producción ahora también abre el DASHBOARD real
  (no solo pega contra la API) para confirmar visualmente que los datos siguen
  ahí tras el fix.
- **#42**: `fix(ops)` — la verificación de ORLANT ya no manda `222` en
  columnas de porcentaje (bug del propio script de verificación, no del
  producto).
- **#43**: `docs` — evidencia de la re-verificación en producción del fix
  (PR #40) documentada en `ARQUITECTURA.md`.

## Fase 27 — Botón "Previsualizar" + filtros y colores estables en gráficas (PRs #44-46, 2026-09-16)

- **#44** (`feat(dashboards)`): botón **"Previsualizar"** en el constructor de
  dashboards — reutiliza el mismo render de producción (mismo motor genérico,
  mismo gate de administrador) para mostrar cómo se vería un dashboard con
  datos reales **antes de guardar** los cambios. Color categórico estable por
  gráfica: cada etiqueta (campaña, categoría, etc.) obtiene un color fijo
  derivado de un hash de su nombre (`public/js/paleta-logic.js`), en vez de
  depender del orden en que llegan los datos — así una misma serie no cambia
  de color entre recargas. Filtros extendidos a las pantallas de Calidad y
  Gestión de base (antes solo estaban en Tráfico).
- **#45**: verificación en producción real del botón Previsualizar + filtros
  y colores.
- **#46**: `docs` — evidencia de esa verificación documentada en
  `ARQUITECTURA.md` (§8).

## Fase 28 — Auditoría de solo lectura de las 3 campañas prioritarias (PR #47, 2026-09-16)

Pedido directo de InCo: un workflow de solo lectura contra producción que
recorre específicamente **ORLANT, Clínica Aurora y Hospital La María** (las 3
campañas que InCo marcó como prioritarias) y reporta, por campaña, qué datos
reales existen hoy en Gestión de base, Calidad y Tráfico. Sin escrituras, sin
credenciales reales expuestas.

**Resultado real** (confirmado de nuevo el 2026-09-17 para la auditoría de la
Fase 29): solo **ORLANT** tiene datos reales de producción (cargas de
oct/nov-2026, 37 monitoreos de Calidad de septiembre); **Clínica Aurora** y
**Hospital La María** siguen en cero en las tres áreas. La Calidad de ORLANT
además mezcla asesores/evaluadores de prueba (`Asesor Prueba 01-04`,
`Evaluador QA Prueba`) con los reales — quedó documentado como hallazgo
abierto, no resuelto en esta fase (ver Fase 29).

## Fase 29 — Auditoría general de la plataforma ("Radiografía InConexión") + 4 mejoras técnicas (2026-09-17)

Pedido de InCo: un paso atrás de todo lo anterior — no una funcionalidad
puntual, sino un diagnóstico completo de la plataforma (funcionalidad, UX,
código, seguridad, documentación) verificado contra el código real y contra
producción, con una lista priorizada de mejoras. Entregado como reporte
("Radiografía InConexión", no versionado en el repo — es un documento de
decisión, no código). Hallazgo central: esta misma bitácora
(`PROGRESS.md`) llevaba ~21 PRs sin actualizarse (Fases 23-28 de arriba,
backfilled en esta misma fase) — incluido el bug real de la Fase 26 y la
auditoría de campañas prioritarias de la Fase 28, que hasta ahora solo
vivían en mensajes de commit.

De esa auditoría, InCo priorizó implementar de inmediato 4 de las mejoras
técnicas (no las de negocio/datos, que exigen coordinación con el cliente):

1. **Permiso faltante en `GET /api/historial`**: la única de las ~75 rutas
   de la API que solo exigía un JWT válido (`requireAuth`) sin ningún chequeo
   de rol — cualquier autenticado (incluida una cuenta ya suspendida, mientras
   su token siguiera vigente) podía leer el log de auditoría completo. Cambiado
   a `requireActor` + el mismo criterio que ya usa el frontend para mostrar la
   pestaña Historial (`isFullAdmin`: admin maestro o rol `ADMIN`; ni siquiera
   `AUX_ADMIN` la ve). De paso se cerró el hallazgo menor relacionado:
   `GET /calidad/plantillas/:campana` (variante con una campaña puntual, sin
   consumidor hoy en el frontend) ahora exige `campaignAccess` — la lista sin
   parámetro (`/calidad/plantillas`) sigue abierta a cualquier autenticado a
   propósito, porque `calidad.js`/`cargas.js` la usan para armar un lookup
   global de todas las plantillas activas, sin relación con las campañas del
   usuario logueado.
2. **Compresión y caché de estáticos**: se confirmó que Caddy ya comprimía en
   producción (`encode gzip zstd`, verificado con `curl -H "Accept-Encoding: gzip"`)
   — el hallazgo original de la auditoría fue un falso positivo por no mandar
   ese header. Se agregó `compression` a nivel de Express de todos modos, para
   que la app comprima igual sin el proxy delante (dev local, el smoke test de
   CI que le pega directo al contenedor). El hallazgo real de caché sí se
   corrigió: `index.html` pesaba 467 KB porque el logo y el ícono del navbar
   (Fase 15) estaban embebidos dos veces cada uno como base64 — se extrajeron a
   `public/img/logo-inconexion.png` y `public/img/navbar-icon.png` (archivos
   reales, cacheables 7 días), bajando `index.html` a 82 KB. Cabeceras nuevas:
   `index.html` → `no-cache` (siempre revalida, nunca deja a alguien atascado
   en una versión vieja tras un deploy); `public/img/*` → 7 días; el resto
   (css/js, sin fingerprint en el nombre) → 5 minutos.
3. **`server.js` dividido en routers por dominio**: el archivo pasó de 2534 a
   269 líneas. Las ~75 rutas se movieron a `server/routes/{auth,usuarios,
   calidad,umbrales,trafico,dashboards,inventario,gerencia,gestion-humana,
   historial}.js` (un `express.Router()` por dominio) + `server/routes/shared.js`
   con el plumbing común (`wrap`, `logEvent`, `actorLabel`, `toPublicUser`,
   credenciales del admin maestro). Refactor mecánico: cada router se monta en
   `server.js` en el mismo orden relativo en que las rutas vivían en el
   monolito, porque el middleware de no-cache de Calidad (prefijo `/calidad`)
   también cubre las rutas `/calidad/trafico/*` que ahora viven en
   `routes/trafico.js` — igual que en el archivo original. Ninguna URL,
   respuesta, permiso, ni orden de validación cambió.

**Verificación local** (antes de PR): `npm test` → **218/218** (216 previos +
2 nuevos del permiso de historial/plantillas), `npm audit` → **0
vulnerabilidades**, servidor levantado localmente con smoke test manual
sobre cada router extraído (login, historial, users, calidad, tráfico —
incluida la descarga real de la plantilla, que depende de una ruta de
archivo (`__dirname`) ajustada al mover el código a `routes/` — inventario,
gerencia, gestión humana, dashboard de cliente, umbrales, 401/404, estático).
**Verificación en producción real: pendiente** — se documenta en la fase
siguiente tras el deploy, siguiendo el mismo patrón que las Fases 26/27
(PR de código + PR de evidencia de producción por separado).
