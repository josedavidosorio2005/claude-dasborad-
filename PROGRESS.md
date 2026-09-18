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

**Verificación en producción real** (PRs #48-49, tras el deploy): CI verde
en Node 18/20/22 + `docker-build` (confirma que el Dockerfile empaqueta
`server/routes/` y `public/img/` sin cambios), deploy automático (OIDC +
apertura temporal del puerto 22) sin intervención manual, y un workflow de
QA nuevo (`verificar-permiso-historial-y-routers-produccion.yml`) con 2
usuarios temporales (creados/borrados directo en la BD, nunca vía la API)
confirmó en producción real:

| Chequeo | Resultado real |
|---|---|
| `GET /api/historial` con ASESOR temporal | **403** — `"Sin permiso para ver el historial"` |
| `GET /api/historial` con ADMIN temporal | **200** — 57 filas reales, sin cambios |
| Cabeceras de estáticos (`curl -I`) | `index.html`: `Cache-Control: no-cache`, gzip; `/img/*.png`: `max-age=604800`; `/css`,`/js`: `max-age=300`, gzip |
| `index.html` real servido | 80 940 bytes (antes 467 112) — sin ningún `data:image` embebido, referencia real a `img/logo-inconexion.png` e `img/navbar-icon.png` |
| Flujo Playwright login → dashboard → cargar datos | Login ADMIN temporal OK → dashboard real de ORLANT abre con datos reales (`"Informe Nov-26 — ORLANT"`) → carga de prueba a ALBERTO LINERO GO (periodo 2027-08, plantilla consolidada real) se guarda (`"✓ Resumen mensual (KPIs y tendencias)"`) y se ve reflejada en su dashboard → carga de prueba y los 2 usuarios temporales borrados al final |

Los 4 puntos que pedía la verificación quedan confirmados con evidencia
real, no solo con el test suite. Capturas subidas como artifact del run
(`verificacion-historial-routers-<run id>`, 30 días de retención).

## Fase 30 — Cierre del resto de la lista de auditoría (deps mayores) + fix de `main` roto + auditoría del flujo de carga (PRs #55-57, 2026-09-17)

Pedido de InCo: cerrar los 7 puntos restantes de la lista priorizada de la
Fase 29, y por separado auditar el flujo de "subir datos" en busca de huecos
no cubiertos por la auditoría general.

### Hallazgo de partida: 6 de los 7 puntos ya estaban cerrados

Antes de tocar código se verificó el estado real de cada uno de los 7 puntos
contra el repo (no contra el texto de la auditoría original, que quedó
desactualizado por el trabajo de la propia Fase 29):

| # | Punto | Estado real encontrado |
|---|---|---|
| 1 | Tests de `semaforo-logic.js`/`paleta-logic.js`/`gd-filtro-logic.js` | **Ya existían** (`server/tests/{semaforo,paleta,gd-filtro}-logic.test.js`), corriendo en CI vía `npm test`. De hecho los 7 archivos de lógica de navegador de `public/js/` tienen su test. |
| 2 | Consolidar exportación a Excel/PDF | **Ya resuelto** en el PR #52 (`public/js/xlsx-export-helpers.js`) — investigado uno por uno, la duplicación real era `xlsxNombreHojaUnico`/`xlsxAgregarAvisoDemo`, no toda la lógica de exportación (cada módulo arma columnas/hojas genuinamente distintas). |
| 3 | Playwright a 412px en constructor de dashboards + carga masiva | **Ya resuelto** en el PR #53 — encontró y arregló un bug real (`.form-row` sin wrap en el constructor). |
| 4 | ~48 hex sueltos que duplican una variable | **Ya resuelto** en el PR #51 — de los ~48, solo 1 caso real tras revisarlos uno por uno. |
| 5 | README: "9 roles"/"9 clientes", árbol de directorios | **Ya resuelto** en el PR #51 (10 roles, 12 clientes, árbol actualizado). |
| 6 | 3 endpoints muertos | **Ya resuelto** en el PR #51 — 2 eliminados, `GET /gerencia/kpis` confirmado con consumidor real, no se toca. |
| 7 | Deps mayores ancladas (7 paquetes) | **Parcialmente resuelto**: bcryptjs/dotenv/helmet/express-rate-limit ya en su mayor nueva desde el PR #54. Express y zod, pendientes de verdad — cerrados en esta fase. better-sqlite3, decisión explícita de NO subir (ver abajo). |

Es decir: del trabajo pedido, lo único real que quedaba en código era terminar
el punto 7. El resto ya estaba hecho por el propio trabajo de la Fase 29,
simplemente el pedido se redactó sobre el texto original de la auditoría sin
saber que ya se había cerrado.

### Bloqueante encontrado primero: `main` estaba roto (PR #55)

Antes de tocar nada de lo anterior: el PR #54 (mergeado más temprano el mismo
día) se fusionó a `main` con **CI en rojo** en Node 18 y Node 20 —
`better-sqlite3@13` exige Node ≥22 y crashea con SIGSEGV en versiones
anteriores, no da un error controlado. El merge no se bloqueó porque no hay
protección de rama que exija CI verde. El fix correcto ya existía
(`fix(deps): revierte better-sqlite3 a 12.11.1`) pero vivía en una rama que se
había mergeado *antes* de que ese commit se creara, así que nunca llegó a
`main`. Sin impacto en producción real: el deploy está encadenado al éxito de
CI, así que ese despliegue se saltó solo (`skipped`) y producción siguió
sirviendo la versión anterior (PR #53) todo este tiempo. Corregido
cherry-pickeando el commit a una rama nueva, con CI verde en los 3 Node antes
de mergear (a diferencia del PR #54).

### Deps mayores: Express 4→5 y zod 3→4 (PRs #56-57)

- **Express 5** (#56): único punto de código afectado — `server.js` usaba
  `app.get('*', ...)` para el fallback SPA; Express 5 (path-to-regexp v8) ya
  no acepta `'*'` suelto como patrón. Cambiado a `app.get('/{*splat}', ...)`.
  Verificado con servidor real: SPA fallback, estático y 404 de API sin
  cambios de comportamiento.
- **zod 4** (#57): **hallazgo real, no solo "subir el número"**. zod v4
  elimina `required_error`/`invalid_type_error`/`errorMap` en favor de un
  único parámetro `error`. Sin arreglar nada, la suite seguía en 224/224
  (ningún test compara el texto exacto de estos mensajes) pero los 16 sitios
  que usaban ese patrón en `validation.js`/`config.js` quedaban silenciosamente
  con el mensaje genérico en inglés de zod en vez del mensaje en español
  pensado para el usuario — una regresión de UX invisible a la suite, del
  mismo tipo que pide vigilar la Parte 2 de este pedido. Arreglado con un
  helper (`reqStr`) que reproduce exactamente el comportamiento de zod v3;
  verificado con un script aparte que compara el mensaje palabra por palabra
  antes/después, y en producción real (`POST /api/auth/login` sin body sigue
  devolviendo `"Usuario y contrasena requeridos"`, no el genérico de zod).
- **better-sqlite3 se queda en v12, a propósito**: subir a v13 exige antes
  decidir si se deja de soportar Node 18/20 (cambiar `ci.yml` y el README) —
  decisión de negocio de InCo, no algo que resolver dentro de este PR.

Las 3 ramas siguieron el patrón completo: CI verde en Node 18/20/22 antes de
mergear, deploy automático, verificación real en producción
(`https://inconexionpruebasclaude.duckdns.org/api/health` y, para zod, el
mensaje de error real de `/api/auth/login`).

**Verificación**: `npm test` → 224/224 en cada PR, `npm audit` → 0
vulnerabilidades. `main` sano de nuevo desde el PR #55 en adelante.

### Parte 2 — Auditoría del flujo de carga de datos (sin código, salvo lo trivial)

Pedido aparte de InCo: revisar qué le falta al flujo de "subir datos" para
que la experiencia sea sólida cuando se carguen los archivos reales de
Orlant/Aurora/Hospital La María. Reporte completo entregado directamente a
InCo (no versionado aquí, igual que la "Radiografía" de la Fase 29). Resumen
de los 3 hallazgos reales, verificados contra el código:

1. **Mapeo manual de skill de Wolkvox — SÍ vale la pena, esfuerzo trivial**:
   el backend (`PUT /calidad/trafico/skills/:skillName`) ya hace upsert —
   soporta crear un mapeo nuevo de una campaña antes de que exista ningún
   dato para esa skill. El único hueco es de frontend: la pantalla
   "Mapeo de Skills → Campaña" (`public/index.html`, tabla
   `tv-skills-tbody`) solo lista skills que YA tienen fila en
   `trafico_skill_mapeo` — no hay un campo de texto para escribir un
   `SKILL_NAME` nuevo a mano. Agregar ese campo + botón junto al ya existente
   "Actualizar" reutiliza el endpoint tal cual (sin cambios de backend ni de
   permisos). Recomendado antes de la carga real de Aurora/Hospital La María.
2. **Mensajes de error de carga**: fecha inválida y archivo no-Excel ya son
   claros (mensaje puntual por fila o por archivo). Hueco real encontrado:
   en la plantilla consolidada (`cargas.js`), una hoja con el nombre
   cambiado/faltante se trata exactamente igual que una hoja "vacía — no
   aplica esta vez" (mismo camino de código, `cargasHojaVacia`) — no hay
   forma de distinguir "esta sección de verdad no aplica" de "renombraste la
   pestaña por error", así que esa sección se pierde en silencio.
3. **Confirmación de qué se cargó**: ya es sólido — `guardarCarga()` refresca
   la tabla de cargas existentes de inmediato (sin recargar la página) y
   muestra un resumen ✓/✗ por hoja; lo mismo para la carga de Tráfico
   independiente (refresca cobertura/skills/nivel de servicio al guardar).

## Fase 31 — Fix: una hoja renombrada en la plantilla consolidada ya no se pierde en silencio (2026-09-17)

Pedido de InCo: cerrar el hallazgo #2 de la auditoría del flujo de carga
(Fase 30) — riesgo real de pérdida de datos silenciosa, no cosmético — antes
de la carga real de datos de Orlant/Aurora/Hospital La María. El otro
hallazgo de esa auditoría (pantalla de mapeo manual de skill de Wolkvox)
queda solo documentado; InCo decide eso por separado.

### El bug

`cargasProcesarHoja` (`public/js/cargas-logic.js`) trataba dos casos muy
distintos exactamente igual: una hoja **presente** en el archivo pero sin
filas de datos (caso legítimo: "esta sección no aplica hoy") y una hoja
**ausente** del archivo porque el usuario la renombró o borró por error.
Ambos caían en `cargasHojaVacia` → `{vacia:true}` → se omitía sin ningún
aviso. La sección se perdía en silencio.

### El fix

`cargasProcesarHoja(hojaPlan, aoa, ws, parseFn, nombresHojasArchivo)` ahora
distingue los dos casos usando una señal que ya estaba disponible pero sin
usarse para esto: `ws` (`wb.Sheets[hoja]`) es `undefined` si y solo si esa
pestaña no existe en el workbook subido — nunca si existe pero está vacía.

- Hoja **ausente** (`!ws`) → `{error: 'No se encontro la hoja "X" en tu
  archivo. Si esta seccion no aplica para esta campana, no la borres ni la
  renombres: dejala vacia. Hojas encontradas en tu archivo: [lista real de
  wb.SheetNames].'}` — mismo estilo que los mensajes ya existentes
  (fórmula sin valor, columnas faltantes), rechaza **solo esa hoja**, igual
  que cualquier otro error de esta pantalla — las demás hojas válidas del
  mismo archivo se guardan igual.
- Hoja **presente** sin filas de datos → sigue exactamente igual que antes:
  `{vacia:true}`, sin ningún aviso nuevo, no bloquea nada. Verificado que
  esto no se rompió.
- El conjunto de "hojas esperadas" sigue siendo el plan de **esa campaña
  específica** (`cargasPlanConsolidado`) — una campaña sin plantilla de
  Calidad nunca incluye "Monitoreos" en su plan, así que nunca genera este
  aviso por esa ausencia (sin falsos positivos).

Único llamador (`public/js/cargas.js`, `procesarArchivoConsolidado`) ahora
pasa `wb.SheetNames` como quinto argumento.

### Verificación

`npm test` → **226/226** en verde (224 previos + 2 nuevos:
`cargasProcesarHoja` con hoja ausente → error con mensaje exacto y lista de
hojas reales; caso legítimo de hoja vacía sin cambios). `npm audit` → 0
vulnerabilidades. El test que antes fijaba el comportamiento viejo
("hoja ausente se trata igual que vacía") se reescribió para exigir el
comportamiento correcto.

Playwright contra un servidor local (admin real, base de datos de
desarrollo ya existente): plantilla real de ALBERTO LINERO GO descargada,
pestaña "diario" renombrada a "Diaro" (typo típico), "resumen" llenada con
datos válidos, resto de hojas sin tocar (vacías, legítimas). Resultado real
en la vista previa:

> ⚠ No se encontro la hoja "diario" en tu archivo. Si esta seccion no
> aplica para esta campana, no la borres ni la renombres: dejala vacia.
> Hojas encontradas en tu archivo: INSTRUCCIONES, resumen, Diaro,
> tipificacion, asesores, DATA.

"Resumen mensual" siguió en verde (`OK — 1 fila(s)`); "Tipificación de
gestión"/"Resultados por asesor"/"Trafico de Llamadas" siguieron en
`Vacia — no aplica esta vez` sin ningún cambio. Al guardar, el toast
mostró únicamente `✓ Resumen mensual (KPIs y tendencias)` — "Gestión por
día" nunca se intentó guardar, sin bloquear las demás hojas válidas. Carga
de prueba (periodo `2099-01`) borrada al terminar.

`.github/scripts/verificar-plantilla-produccion.js` (workflow
`verificacion-plantilla-produccion.yml`) se extendió con un tercer
escenario que reproduce este mismo caso contra producción real con un
usuario temporal.

**Verificación en producción real** (PR #59, tras merge + deploy): CI
verde en Node 18/20/22 + docker-build, deploy automático sin intervención
manual, y el workflow extendido corrido contra producción real
(`https://inconexionpruebasclaude.duckdns.org`) con un usuario temporal —
mismo mensaje exacto que en local:

> ⚠ No se encontro la hoja "diario" en tu archivo. Si esta seccion no
> aplica para esta campana, no la borres ni la renombres: dejala vacia.
> Hojas encontradas en tu archivo: INSTRUCCIONES, resumen, Diaro,
> tipificacion, asesores, DATA.

Toast de guardado: `✓ Resumen mensual (KPIs y tendencias)` — "resumen" se
guardó igual, sin que el aviso de "diario" bloqueara nada. Datos de
prueba (carga `ALBERTO LINERO GO`/`resumen`/periodo `2027-06`) y usuario
temporal borrados de inmediato al terminar (confirmado en el log del
propio workflow). `main` sano, producción sirviendo el fix.

## Fase 32 — Pantalla de mapeo manual de skill de Wolkvox → campaña (2026-09-17)

Pedido de InCo: implementar ahora la única recomendación de la auditoría
del flujo de carga (Fase 30) que había quedado sin construir — registrar de
antemano el mapeo `SKILL_NAME` (Wolkvox) → campaña, antes de subir el
primer archivo real de Aurora/Hospital La María.

### Backend: sin cambios

Confirmado antes de tocar nada: `PUT /calidad/trafico/skills/:skillName`
(`server/trafico-skills.js`, `remapearSkill`) ya hace upsert puro —
`INSERT` si el skill no existe, `UPDATE` si ya existe — sobre una tabla
(`trafico_skill_mapeo`) sin ninguna relación con un `SKILL_ID` ni ninguna
otra tabla que exija que el skill ya se haya visto antes. Cero ajuste de
backend, cero cambio de permisos: sigue exigiendo `canLoadData` igual que
hoy, tanto para leer como para editar el mapeo.

### Frontend

`public/index.html` (pantalla "Metas Calidad", donde ya vivía el mapeo):
nuevo section-card "Registrar skill nuevo" **arriba** de la tabla de
mapeos existentes (mismo patrón ya usado en Umbrales de Semáforo: tarjeta
de alta separada de la tarjeta de "ya configurados") — campo de texto
`SKILL_NAME`, selector de campaña (mismo catálogo `CAMPANAS_CALIDAD` que
ya usa cada fila existente), selector de sede (mismo mecanismo de
mostrar/ocultar ya usado para Hospital La María) y botón "Registrar
skill". Reutiliza el mismo `PUT` que ya usa `guardarMapeoSkill` para las
filas existentes — ninguna ruta nueva.

Validación (`public/js/trafico-logic.js`, `traficoValidarNuevoMapeo` —
función pura, mismo patrón dual navegador/`require()` que el resto de
`*-logic.js`): SKILL_NAME vacío o solo espacios → rechazo; sin campaña
seleccionada → rechazo; campaña multi-sede sin sede elegida → rechazo
(mismo mensaje que ya usa `guardarMapeoSkill`); nada de esto llama al
backend. **Decisión sobre duplicados**: si el SKILL_NAME ya tiene fila en
la tabla de abajo, se **rechaza** ("ya existe en la tabla de abajo —
edítalo ahí") en vez de dejar que el upsert lo actualice en silencio —
aunque el backend lo soportaría sin problema, un typo que coincida con un
skill real ya mapeado reasignaría de golpe su tráfico ya cargado a otra
campaña, y este formulario nuevo no tiene la misma visibilidad (campaña/
filas actuales ya a la vista) que sí tiene la fila existente antes de
editarla. Al registrar con éxito: toast de confirmación, campo de texto
limpio, y la tabla de mapeos se refresca sola (mismo patrón que control de
cargas) — sin recargar la página.

### Verificación

`npm test` → **233/233** en verde (226 previos + 7 nuevos: 6 de
`traficoValidarNuevoMapeo` — vacío, sin campaña, sin sede, duplicado, y los
dos caminos felices — y 1 de extremo a extremo: registrar un SKILL_NAME
por `PUT` **sin ninguna carga previa**, confirmar una sola fila de mapeo
sin duplicar, subir después una carga real que lo menciona y confirmar que
resuelve directo a la campaña ya registrada, nunca a `"(SIN ASIGNAR)"`, sin
crear una segunda fila ni pisar la ya registrada). `npm audit` → 0
vulnerabilidades.

Playwright contra un servidor local real: SKILL_NAME vacío y sin campaña
rechazados con el mensaje exacto, sin crear fila; registro de
`QA_LOCAL_SKILL_...` → `CLINICA AURORA` exitoso, aparece en la tabla de
inmediato sin recargar, campo de texto se limpia; reintentar el mismo
SKILL_NAME → rechazado como duplicado. Fila de prueba borrada al terminar
(no hay endpoint de borrado para mapeos — se limpió directo en la base de
desarrollo local).

**Verificación en producción real** (PRs #61-62, tras merge + deploy): CI
verde en Node 18/20/22 + docker-build en cada PR, deploy automático sin
intervención manual, y un workflow nuevo
(`verificar-mapeo-skill-produccion.yml`) con un usuario temporal **rol
ADMIN** (nunca `AUX_ADMIN` aquí: la pantalla "Metas Calidad" solo es
visible en el menú para ADMIN/master hoy — mismo criterio que ya usa
`verificar-permiso-historial-y-routers-produccion.yml` para otra pantalla
con la misma restricción; creado directo en la base de datos, nunca con
la contraseña maestra) confirmó en producción real:

| Caso | Resultado real |
|---|---|
| SKILL_NAME vacío | `"Escribe el SKILL_NAME real de Wolkvox."` — sin llamar al backend |
| Sin campaña seleccionada | `"Selecciona la campana a la que pertenece este skill."` — sin llamar al backend |
| Camino feliz (`PROD_QA_VERIF_SKILL_MAPEO_<run id>` → ORLANT) | `"Skill \"...\" registrado y asignado a ORLANT. Quedara listo para cuando llegue trafico con este nombre."` — aparece en la tabla de inmediato, sin recargar la página |
| Reintentar el mismo SKILL_NAME | `"El skill \"...\" ya existe en la tabla de abajo — editalo ahi en vez de registrarlo de nuevo."` |

Skill de prueba y usuario temporal borrados de inmediato al terminar
(confirmado en el log del propio workflow: `skillMapeo: 1` fila borrada).
`main` sano, producción sirviendo el formulario nuevo.

### Skills reales de Aurora/Hospital La María

No se registró ningún SKILL_NAME real de Clínica Aurora ni de Hospital La
María en este cierre: no se cuenta con el nombre exacto que usa Wolkvox
para ninguna de las dos campañas (ni sus sedes Castilla/Sede 33). Queda
para que InCo lo registre él mismo desde esta pantalla nueva en cuanto
tenga el dato real — nunca se inventó un nombre de skill.

---

## Fase 33 — Dashboard de ORLANT con las 16 gráficas del PDF de InCo (PRs #64-65, 2026-09-18)

Pedido de InCo, con el orden decidido tras la auditoría de la Fase 30
(reporte publicado como artifact, `17d6b216-…`): implementar **solo
ORLANT** — es la campaña que ya tenía casi todo listo (STA ya construido,
Salida con esquema completo aunque sin datos, tipificación sin límite de
esquema). Clínica Aurora y Hospital La María no se tocan: tienen preguntas
de negocio sin responder (¿"línea 3P" aplica a ellas? ¿"ordenamiento
médico" es exclusivo de Orlant?).

### Hallazgo de arquitectura antes de tocar nada

`dashboards_config` solo se siembra si el cliente **no existe todavía**
(`server/db.js`) — ORLANT ya existe en producción, así que editar
`dashboard-config-seed.js` por sí solo nunca llega a la fila real. Se
agregó la migración `dashboards_config_orlant_pdf_graficas_v1` que mueve
el layout de producción a la misma forma que el seed define ahora (la
migración lee el layout objetivo directo de `CONFIGS`, una sola fuente de
verdad, sin repetir el JSON a mano). Defensiva por tab: solo reemplaza un
tab si su forma actual coincide con la vieja reconocible; si no la
reconoce (personalización manual), lo deja intacto y lo loguea —
verificado con un test que simula un tab de ORLANT editado a mano y
confirma que la migración no lo toca (`orlant-graficas-migracion.test.js`).

### Qué se construyó (motor genérico, 3 capacidades nuevas reutilizadas ≥2 veces)

| Capacidad | Dónde | Para qué |
|---|---|---|
| `filtroCampo` (filtro-por-panel existente, generalizado a filtrar por una columna distinta al eje X) | `dashboard-generic.js` | Tipificación: 1 pie filtrable por línea en vez de 2 pies fijos |
| `filtroSerie` (selector de 1 serie entre varias + "Total: N") | `dashboard-generic.js` + `gdSerieSeleccionada` nueva en `gd-filtro-logic.js` | Salida: 1 gráfica de llamadas + 1 de WhatsApp, cada una con selector Línea General/3P |
| Agregación anual (`modo:'anual'` escalar, `f.anual` agrupado por categoría) | `dashboard-generic.js` + `gdAnioDeMes`/`gdCargasDelAnio` nuevas en `gd-filtro-logic.js` | KPI anual de ordenamiento médico (panel `nota_kpi` nuevo) y "Órdenes por servicio/estado (año)" de STA |
| `loBarPct` (% del total en barras, factorizado del mismo cálculo que ya usaba `loPie`) | `charts.js` | Órdenes por servicio/estado |

Cero cambios de esquema de carga (`dashboard-secciones.js` sin tocar).
`trafico.js` agrega 2 gráficas más (abandono, AHT) al panel de Tráfico ya
existente, reusando datos que `traficoAgregar()` ya calculaba y exportaba
a Excel pero no tenían gráfica propia — sin tocar `trafico-logic.js`.

### Disposición de los 9 tabs de ORLANT

- **Ajustados** (mismo dato, formato del PDF): Tráfico (+2 canvases),
  "Agendas por línea" (bar→line), "STA por mes" (+barra Agendada), "Órdenes
  por servicio" (+anual/+%), "STA del mes por tipo" (solo título).
- **Reemplazados** (redundancia obvia con lo nuevo — mismos campos/fuente,
  juicio propio, explicado en el PR): 4 líneas de Salida → 2 paneles con
  selector de línea; 2 pies de Tipificación → 1 con filtro; "Órdenes por
  estado" pie → bar con %.
- **Nuevos**: `nota_kpi` "Efectividad del año — Ordenamiento médico 3P",
  "Total agendas — variación % mes a mes" (reusa `transform:'incremento'`,
  ya existía, lo usa Aurora).
- **Sin equivalente en el PDF, se mantienen intactos**: tab "Flujo
  Mensual", panel "Recuperación de cancelados", tab "Efectividad Citas",
  tab "Calidad".
- **Ya calzaba, sin cambios**: tab "Inasistencia" (4 líneas, ya idéntico a
  la gráfica 12 del PDF).

**Verificación**: `npm test` → **242/242** (8 tests nuevos de lógica pura +
2 de la migración), `npm audit` → 0 vulnerabilidades. CI verde en Node
18/20/22 + docker-build, deploy automático (PR #64).

**Verificación en producción real** (PR #65, workflow nuevo
`verificar-graficas-orlant-produccion.yml`, mismo patrón de usuario
temporal + SSH temporal que las verificaciones anteriores, de solo
lectura): Playwright abrió el dashboard real de ORLANT (datos reales de
nov-2026) y confirmó cada tab — capturas en `docs/capturas-demo/
orlant-graficas-pdf-*.png`:

| Tab | Resultado real |
|---|---|
| Tráfico | Los 2 canvases nuevos (abandono, AHT) están listos, pero la campaña **no tiene ningún dato cargado en el módulo Tráfico/Volvox** — el panel muestra "Sin datos cargados todavía" en vez de las 3 gráficas. Hallazgo nuevo: los KPIs de llamadas 3P/General de la cabecera vienen de la sección `resumen` (carga manual por Excel), un camino de datos paralelo al de Tráfico/Volvox — Orlant nunca subió un archivo de Volvox. |
| Salida | Los 2 paneles con selector de línea renderizan correctamente la UI (dropdown General/3P, botón Aplicar, "Total: 0") — confirma en cero, como ya se sabía. |
| Tipificación | El pie renderiza con datos **reales** ya cargados — pero las categorías reales (`Agendamiento`, `Información general`, `Reprogramación`, `Cancelación`, `No contesta/llamada cortada`) **no coinciden** con los 2 códigos del glosario (`INFORMACION_3P`, `INFORMACION_SECRETARIA`, tomados del PDF). El glosario queda marcado como "basado en el PDF, confirmar" — confirmado que hacía falta esa advertencia. |
| Agendamiento | El `nota_kpi` renderiza el texto real: *"...se han gestionado un total de 1.640 pacientes, de los cuales se han logrado agendar 1.230 — efectividad del año: 75%."* — coincide con el formato exacto del PDF. |
| Inasistencia | Sin cambios, datos reales (10,5% / 8,3% / 6,7% / 8,6%). Se observó un defecto cosmético **preexistente** (no introducido en esta fase): las etiquetas del eje Y muestran ruido de punto flotante (ej. "8.7000000000001%") en rangos muy angostos — queda anotado para una fase aparte, no se tocó. |
| Gestión STA | "Órdenes por servicio (año)" y "Estado de órdenes (año)" renderizan con datos reales y % del total (33/29/23/15% y 62/13/15/6/4%), con la nota de exclusiones visible. |

Workflow y usuario temporal (`verif_graf_orlant_<run id>`, rol `ADMIN`,
creado/borrado directo en la base de datos) limpiados automáticamente al
final del run — de solo lectura, ninguna fila real de ORLANT se tocó.

### Pendiente / decisión de InCo

- Confirmar el glosario de Tipificación contra las categorías reales (no
  coinciden con las del PDF) o quitarlo si no aporta.
- Salida y Tráfico/Volvox siguen sin archivo real — fuera del alcance de
  esta fase (vacío de datos ya conocido).
- El defecto cosmético del eje Y de Inasistencia (punto flotante) queda
  para una fase aparte.

---

## Fase 34 — Fix: Tipificación duplicaba categorías en el pie + datos de prueba dejados visibles a propósito (PR #70, 2026-09-18)

Pedido de InCo tras revisar las capturas de la Fase 33: el pie de
Tipificación combinaba 3P+General por defecto (`filtroCampo:'linea'` con
el multi-select genérico, ambas líneas seleccionadas de entrada) — como
comparten nombres de categoría, cada una salía **duplicada** en la
leyenda (10 porciones en vez de 5).

**Fix — Opción A** (selector de una línea a la vez, mismo patrón que
Salida, no Opción B de sumar duplicados): el PDF original ya mostraba esto
como 2 pasteles separados por línea, así que es fiel al pedido, no una
desviación. Nuevo tipo de filtro `'unico'` (`dashboard-generic.js`) +
`gdValorFiltroUnico` (`gd-filtro-logic.js`, mismo patrón que
`gdSerieSeleccionada`). Migración nueva `dashboards_config_orlant_tipificacion_unico_v1`
(`db.js`, ORLANT ya existe en producción). Tests: caso exacto del bug
(mismo nombre de categoría en ambas líneas → nunca duplicado tras
filtrar) + 2 de la migración. Suite 249/249, `npm audit` limpio.

**Verificado en producción real**: Playwright confirmó `tipificacionDefaultSinDuplicadosOk`,
`tipificacionSelectorLineaOk` y `tipificacionCambioLineaSinDuplicadosOk` —
la vista por defecto y el cambio de línea (3P↔General) nunca repiten una
categoría. Captura reemplazada: `docs/capturas-demo/orlant-tipificacion-confirmacion-2026-09-18.png`
(la versión anterior, con el bug, queda solo en el historial de git del
PR #69 como evidencia del "antes").

### Datos de prueba dejados visibles a propósito en producción

A diferencia de la Fase 33, InCo pidió esta vez **no borrar** el skill y
las cargas de prueba al terminar, para poder entrar él mismo a revisar las
gráficas con datos reales fluyendo. Siguen en producción:

- Skill `PRUEBA_QA_GRAFICAS_ORLANT` → mapeado a campaña `ORLANT`.
- Tráfico: 8 filas diarias (una por mes, ene–ago **2020**) + su agregado
  mensual en `calidad_nivel_servicio`.
- Salida: 1 carga (`dashboard_cargas`, cliente `ORLANT`, sección `salida`,
  periodo **2020-07**, 31 filas diarias).

El workflow `qa-datos-prueba-trafico-salida-orlant.yml` ganó un input
`borrar_al_final` (default `true`) — esta corrida se disparó con
`borrar_al_final=false`. El usuario temporal de QA (rol ADMIN) **sí** se
borró como siempre (nunca queda una cuenta ADMIN huérfana en producción,
sin importar este input).

**Nombre y periodo inconfundiblemente ficticios**: `PRUEBA_QA_GRAFICAS_ORLANT`
no se parece a ningún patrón real de SKILL_NAME de Wolkvox, y el año 2020
es anterior a que esta plataforma o esta campaña existieran — nadie puede
confundirlos con datos reales de Orlant (oct/nov-2026 en adelante) si los
ve sin este contexto.

**Aislamiento — confirmado con matices, no 100% limpio**: dentro del
dashboard de ORLANT y en cualquier vista de otro cliente (Gerencia,
Aurora, HLM, exportes Excel/PDF de cualquier dashboard) el aislamiento es
completo — cada fuente de datos está scopeada por `cliente`/`campana`, y
se confirmó revisando cada endpoint involucrado. **Pero se encontraron 2
pantallas administrativas (no un "reporte" de negocio, solo accesibles con
permiso de Cargar Datos o rol ADMIN) que sí combinan campañas sin
filtro**:

1. `GET /calidad/trafico/skills` (tabla "Mapeo de Skills → Campaña",
   pantalla Metas Calidad) — lista TODOS los skills de TODAS las campañas
   sin scoping; el skill de prueba aparece ahí mezclado con los reales.
2. `GET /calidad/nivel-servicio` sin `?campana=` (tabla "Historial de
   Nivel de Servicio", misma pantalla) — para un ADMIN completo, devuelve
   TODAS las filas de `calidad_nivel_servicio` de TODAS las campañas; las
   8 filas de prueba (2020) aparecen ahí. Se ve tal cual en las 3 capturas
   de esta fase y de la Fase 33 (la tabla al pie de cada captura).

Ninguna de las dos es una vista que InCo use para revisar resultados de
negocio (son pantallas de administración técnica de la plataforma, no
dashboards de cliente ni reportes), y `GET /dashboard/cargas` (la lista de
cargas de Salida) sí queda correctamente scopeada por cliente en el flujo
real de la UI. Aun así, no es un aislamiento del 100% como se pidió
confirmar — queda anotado aquí explícitamente en vez de reportarlo como
resuelto. No se tocó en esta fase (no es trivial: requeriría decidir cómo
scopear esas 2 pantallas por campaña, cambio de alcance mayor).

### Cómo borrar esta data de prueba cuando InCo termine de revisarla

Volver a correr `qa-datos-prueba-trafico-salida-orlant.yml` con
`borrar_al_final=true` (el default), o borrarla a mano — mismas 4
sentencias que ya usa el paso "Borrar los datos de prueba" del workflow
(`calidad_nivel_servicio_diario`/`calidad_nivel_servicio` por skill/mes,
`trafico_skill_mapeo`, `dashboard_cargas` por cliente+sección+periodo).
También se reemplaza sola en cuanto InCo registre el skill real de Wolkvox
y suba el primer archivo real: el mapeo por SKILL_NAME es 1 a 1, así que
un skill real nuevo no choca con `PRUEBA_QA_GRAFICAS_ORLANT` (nombres
distintos) — ambos convivirían hasta que alguien borre el de prueba a
mano.

## Fase 35 — Tema oscuro/claro para toda la plataforma (PR #72, 2026-09-18)

Pedido de InCo: tema oscuro consistente en toda la app (login, admin, los
12 dashboards de cliente incluido ORLANT, Calidad, Gerencia, Inventario,
Gestión Humana), como parte de seguir profesionalizando la apariencia,
apoyándose en el trabajo de variables CSS del PR #51.

**Reconocimiento previo (pedido explícito antes de tocar nada):** la
cobertura de variables de `styles.css` es más parcial de lo que parece.
Está bien tokenizada para superficies/texto/bordes/marca — extenderla con
un segundo set oscuro cubre la mayoría del CSS sin reescribirlo. Pero dos
categorías quedaban completamente fuera de ese sistema, sin que el PR #51
las detectara porque no eran literales *duplicados* de una variable (eran
únicos):

1. **Chart.js 100% hardcodeado en JS, no en CSS** — `charts.js` definía
   `CD/CM/CG/CR/CO/CP` y el array `PC` (paleta categórica) como hex fijos,
   y `lo()/loPie()/loBar()/loPct()` escribían colores de eje/leyenda/
   título/datalabel como strings literales. Nada de esto pasaba por
   `var(--...)`.
2. **~140 literales hex sueltos en `public/js/*.js`** — casi todos
   `style="color:#xxxx"` en HTML generado dinámicamente (estados vacíos,
   notas, badges "sin asignar", menú de exportar) en `dashboard-generic.js`,
   `trafico.js`, `cargas.js`, `historial.js`, `users.js`, `gerencia.js`,
   `inventario.js`, `gestion-humana.js`, `calidad.js`.

**Diseño:** atributo `data-theme` en `<html>` (fijado por un script inline
bloqueante en `<head>`, antes del primer paint, para no parpadear),
persistido en `localStorage` (`inco_tema`). `public/js/theme.js` (nuevo)
expone `toggleTema()`/`aplicarTema()`, y un botón `🌙/☀️` siempre visible en
las 4 navbars (admin/user/asesor/supervisor, fuera del menú de perfil
colapsable para que también se vea en móvil) + uno flotante en el login.

`styles.css` extiende el `:root` existente con `:root[data-theme="dark"]`
(mismos tokens, redefinidos) y promueve a la variable de marca fija
`--c-brand` los usos de `--c-primary` que son fondo/chrome (navbar,
botones, toast, headers de tablero) — `--c-primary` en sí queda libre para
aclararse en oscuro, porque el resto de sus ~25 usos en el archivo son
texto/acento sobre una tarjeta que deja de ser blanca. Para Chart.js,
`charts.js` reasigna esas mismas constantes globales (`CD/CM/CG/CR/CO/CP/PC`
+ nuevas `CHART_GRID/CHART_TICK/CHART_DL_BG`) según el tema — el resto del
código ya las lee por nombre al construir cada gráfica, así que no hizo
falta tocar esos call-sites. Gráficas ya abiertas se redibujan al togglear
reusando el mecanismo que la app ya tenía para cambios de filtro
(`renderGenericTab`/`renderCalReportes`/`renderMisResultados`, destruyen y
recrean canvases desde el estado en memoria, sin refetch).

**Semáforo y paleta categórica — sin cambios de lógica.** `semaforo-logic.js`
sigue devolviendo solo `'verde'/'amarillo'/'rojo'`; el ajuste de contraste
en oscuro es 100% CSS (`td.kpi-green/org/red`, `.aurora-kpi.kpi-*`).
`paleta-logic.js` sigue derivando el índice por hash de forma determinista;
se le sumó un array alterno `PC_DARK` en `charts.js` (mismo índice = mismo
color, ahora en su versión oscura) sin tocar `paletaColorPara`.

**Excluido a propósito:** el HTML de impresión/exportación a PDF
(`_gdExportPrint()` y su equivalente en `trafico.js`) abre una ventana
aparte para imprimir en papel — ajena por completo al `data-theme` de la
app, se queda blanco siempre. El banner fijo de "DATOS DE DEMOSTRACIÓN"
(`state.js`) también se dejó con su color de advertencia fijo en ambos
temas, a propósito (máxima visibilidad).

**Verificación:** suite de servidor sin cambios, 249/249 en verde (cambio
100% frontend), `npm audit` limpio. Script nuevo
`.github/scripts/capturas-tema-oscuro.js` (mismo estilo que los de
verificación en producción existentes) corrido en local contra los datos
de prueba `PRUEBA_QA_GRAFICAS_ORLANT` que InCo dejó vivos en ORLANT (Fase
34) — de solo lectura, no los tocó. Confirmó, con capturas claro/oscuro en
escritorio y móvil (~412px) en `docs/capturas-demo/tema-oscuro/`: login,
Usuarios (tabla de admin), el dashboard de ORLANT completo (con sus
gráficas) y el modal de Previsualizar — semáforo y paleta categórica
legibles y distinguibles en oscuro, y persistencia del tema confirmada tras
recargar la página.

**Verificado en producción real**: tras el merge del PR #72 y el deploy
automático, un chequeo de Playwright contra
`https://inconexionpruebasclaude.duckdns.org` (sin crear ningún usuario,
solo el toggle público del login) confirmó `data-theme` cambiando de
`light` a `dark` al click, guardado en `localStorage`, y conservado tras
recargar la página — y que el HTML servido en producción ya incluye
`js/theme.js` y el botón `.theme-toggle`.

## Fase 36 — Trafico real de ORLANT (agosto 2026) + retiro de los datos de prueba de la Fase 34 (2026-09-18)

Operación de datos sobre producción real, sin cambios de código: InCo mandó
el archivo real de tráfico de ORLANT para agosto 2026, ya lleno sobre la
plantilla oficial (`server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx`).
Confirmado antes de usarlo (hoja `DATA`, 13 columnas del subconjunto
oficial, 50 filas, 2 skills — `CALL INBOUND ORLANT 3P` y
`CALL INBOUND ORLANT GENERAL` —, 2026-08-01 a 2026-08-31, sin fines de
semana/festivos, sin fila `TOTAL`). El archivo nunca se comiteó al repo —
vivió solo en `Claude outputs/` local, subido a producción por Playwright
contra la UI real y borrado del scratch al terminar.

**Mapeo de skills — hallazgo antes de subir nada:** al revisar
`GET /calidad/trafico/skills` en producción, **ninguna de las 2 skills
del archivo estaba mapeada todavía** — ni siquiera `CALL INBOUND ORLANT 3P`,
que se asumía ya mapeada por haberse usado en el fixture `EJEMPLO.xlsx`
(ese fixture resultó ser solo de pruebas locales — `server/tests/` —, nunca
se subió a producción real). Se procedió igual (el diseño de la campaña
centinela `(SIN ASIGNAR)` de la Fase 18 cubre exactamente este caso sin
romper la carga), y se documenta aquí en vez de asumirlo silenciosamente.

**Carga — Opción A (Playwright contra la UI real)**: login como admin
maestro, `showSection('metas')` (la carga de Tráfico vive en la pantalla
**Metas Calidad**, no en el modal "Cargar Datos" — primer intento fallido
por confundir ambas pantallas, corregido antes de guardar nada), subir el
archivo por `#tv-file`, revisar el preview (50 filas válidas, 2 skills, 1
mes — 2026-08 — coincide exacto con la inspección previa), "Guardar carga
de tráfico". Resultado: 50 filas guardadas, ambas skills cayeron en
`(SIN ASIGNAR)` como se esperaba, remapeadas a ORLANT vía el mismo
`PUT /api/calidad/trafico/skills/:skillName` que ya usa el panel — 25
filas reatribuidas cada una, mes 2026-08 recalculado tanto para el
sentinel como para ORLANT. Mapeo final confirmado: ambas skills → ORLANT,
25 filas cada una, cobertura muestra el archivo real como origen.

**Retiro de los datos de prueba (Fase 34)**: disparado
`qa-datos-prueba-trafico-salida-orlant.yml` con `borrar_al_final=true`. El
job general salió en rojo (falla en unos checks de Tipificación del propio
script de QA, preexistentes y sin relación con esta fase — no se tocó ese
script), pero los pasos de borrado corren con `if: always()` y sí
completaron: `USUARIO_TEMPORAL_BORRADO {"filasBorradas":1}`,
`DATOS_DE_PRUEBA_BORRADOS {"traficoDiarioBorradas":8,"traficoMensualBorradas":8,"skillMapeoBorrado":1,"cargaSalidaPruebaBorrada":1}`,
`VERIFICACION_LIMPIEZA {"limpio":true,...}` — cero rastro confirmado por el
propio workflow. Verificado además por separado que el borrado no tocó
ninguna fila de agosto 2026 (`mapeoFinal` solo muestra las 2 skills reales,
25 filas cada una, sin cambios).

**Verificado en producción real**: dashboard de ORLANT, pestaña Tráfico,
muestra agosto 2026 real (8.061 llamadas totales, 7.159 contestadas, 902
abandonadas, 88.8% nivel de atención) con ambas skills seleccionables en el
filtro y ninguna mención a `PRUEBA_QA_GRAFICAS_ORLANT` ni a fechas 2020. La
pestaña Salida quedó vacía ("Sin datos cargados para este periodo"), tal
como se esperaba (no se subió nada ahí en esta fase). Capturas en
`docs/capturas-demo/trafico-real-orlant-agosto-2026-*.png`.

**Nota de seguridad operativa**: se evitó tocar el admin maestro real
creando de entrada un usuario ADMIN temporal por SSH+DB (mismo patrón que
`qa-datos-prueba-trafico-salida-orlant.yml`), pero el PR que agregaba ese
workflow nuevo fue bloqueado por el clasificador de seguridad del harness
de Claude Code (cualquier PR que agregue/modifique un workflow de CI con
acceso a secretos de despliegue queda sujeto a revisión humana, por
diseño). InCo optó por pasar las credenciales del admin maestro
directamente en vez de resolver ese bloqueo; llegaron por el chat en lugar
del archivo local pedido — se recomienda rotar esa contraseña como buena
práctica tras esta fase. La rama sin mergear
`ops/usuario-temporal-trafico-real-orlant-2026-09-18` quedó pusheada pero
sin usar; se puede borrar o dejar para una próxima vez que haga falta este
mismo patrón.

## Fase 37 — Cronograma y Metas de Monitoreo reorganizado en sub-pestañas (PR #76, 2026-09-18)

Pedido pendiente desde la Fase 1 (14/09): `#section-metas` había crecido de
2 tarjetas a 9, todas apiladas sueltas sin agrupar — la causa real de la
sensación de "pantallas separadas" reportada por el usuario, que empeoraba
con cada fase nueva en vez de mejorar.

**Agrupamiento confirmado contra el código real antes de tocar nada** (tal
como se pidió): las 9 tarjetas se agrupan en 3 sub-pestañas — Cronograma
(1-2), Nivel de Servicio (3, 4, 9) y Tráfico/Wolkvox (5-8) — mismo patrón
visual `.aurora-tabs`/`.atab` que ya usan los dashboards de cliente
(`dashboard-generic.js`), sin crear página nueva ni tocar el menú
principal. Cero cambios de backend: solo se envolvió el HTML existente en
3 `<div>` y se agregó `switchMetasTab()` (`metas.js`) para alternar cuál
está visible — ningún formulario cambió de id, firma ni comportamiento de
guardado.

**Hallazgo en el pedido original**: la nota sobre "Volvox" decía que
aparecía en la pantalla de mapeo y "la copia del punto 3" (Nivel de
Servicio manual) — pero el código real no menciona Volvox ahí. Sí aparecía
(sin haberlo pedido) en "Control de Cargas por Periodo" (punto 8) y en las
tarjetas "Trafico de Llamadas" que ven los 12 dashboards de cliente
(`trafico.js`) y en la plantilla consolidada de carga (`cargas-logic.js`).
Se corrigieron todas por ser igual de triviales (solo texto), y se
documenta aquí la discrepancia en vez de asumir que el pedido original
tenía razón.

**De paso**: la carga simple de Nivel de Servicio (Fase 1) quedó marcada
con un badge nuevo "Método anterior — 1 campaña" (`.badge-legacy`,
`styles.css`) — sigue funcionando igual, solo menos prominente que la
carga Wolkvox multi-skill recomendada. Se agregó el filtro de Campana
pedido a "Historial de Nivel de Servicio" y "Mapeo de Skills → Campana"
(gap anotado sin resolver en la Fase 34) — mismo patrón `hist-filter-sel`
que ya usaba el filtro de mes, opciones derivadas de los datos reales
(incluye `(SIN ASIGNAR)`).

**Verificación**: suite de servidor sin cambios, 249/249 en verde (cambio
100% frontend), `npm audit` limpio. Playwright **local** (entorno propio,
sin tocar producción) confirmó que las 3 formas de cargar Nivel de
Servicio/Tráfico (manual, Excel simple, Excel Wolkvox multi-skill) y el
cronograma siguen guardando exactamente igual que antes, ahora agrupadas
en pestañas, y que ambos filtros de Campana nuevos funcionan — capturas
claro/oscuro y escritorio/móvil en `docs/capturas-demo/fase37-metas-tabs/`.

**Verificado en producción real**: tras el merge del PR #76 y el deploy
automático, un chequeo de Playwright de solo lectura (login con el admin
maestro, sin tocar ningún botón de Guardar) confirmó las 3 pestañas
desplegadas, el badge "Método anterior", ambos filtros de Campana nuevos y
el texto "Wolkvox" ya en producción.
