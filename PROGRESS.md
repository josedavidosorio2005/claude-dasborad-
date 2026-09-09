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
