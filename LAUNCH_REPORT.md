# LAUNCH_REPORT — InConexión Platform

Fecha: **2026-09-09** · Rama: `main`

Este documento es el **checklist de lanzamiento**. El detalle técnico de la
infraestructura (comandos, runbooks completos, costos) está en
`AWS_DEPLOY_REPORT.md`; el avance por fase, en `PROGRESS.md`.

---

## 1. Checklist "¿listo para lanzar?" (recorrido honesto)

| # | Ítem | Estado | Nota |
|---|---|---|---|
| 1 | Todos los dashboards de cliente creados | ✅ **estructura** / ⏳ **datos** | 12 dashboards por configuración. Faltan cargar los Excel reales y confirmar métricas de MAIKERS/MOVILIZE (§4). |
| 2 | Calidad/Metas persistiendo en el servidor | ✅ | SQLite, API con permisos por campaña, cálculos en el backend. |
| 3 | Inventario y Gerencia construidos | ✅ **con supuestos** | Sobre el sistema configurable. Pendiente: umbral de bajo stock por ítem, dirección de metas ejecutivas (§4). |
| 4 | Análisis de datos y gráficas personalizables | ✅ | Tendencia vs periodo/meta, alertas fuera de rango, 6 tipos de gráfico, preferencia por visor, export Excel/PDF, constructor visual con previsualización. |
| 5 | Seguridad endurecida y pruebas en verde | ✅ | `config.js` fail-fast, CSP, CORS whitelist, rate-limit, graceful shutdown, error handler central. **68/68** pruebas. CI verde. |
| 6 | Desplegado en AWS con dominio y HTTPS reales | ⏳ | Todo el código y la documentación listos. Falta ejecutar el runbook con la cuenta AWS. |
| 7 | Backups automáticos funcionando | ✅ **código** / ⏳ **activar** | `backup.js` → local + S3 versionado; `systemd` timer diario. Se activa al preparar la instancia. |
| 8 | Pipeline de despliegue automático probado | ⏳ | `deploy.yml` listo; falta crear ECR + rol OIDC + 4 secrets de GitHub y correr 1 deploy. |
| 9 | Matriz de acceso por rol verificada | ✅ | Los 9 roles, `server/tests/role-matrix.test.js`. |
| 10 | Contraseñas de ejemplo cambiadas | ⏳ | Hacer en el primer login en producción. |

**Veredicto:** el **producto (código)** está listo para producción. Lo que
queda es **trabajo de cuenta AWS** (crear recursos, 1 deploy) y **3–4 decisiones
de negocio**. Ninguno requiere programar más, salvo dos ajustes menores del §4.

---

## 2. Qué se entrega

### Producto
- **12 dashboards de cliente** + **Inventario** + **Gerencia**, todos sobre un
  único motor configurable. Crear/ajustar uno es una tarea visual (constructor),
  no código.
- Motor de análisis: comparación contra periodo anterior y contra meta,
  tendencia de N periodos, alertas automáticas, filtro de periodo de comparación.
- 6 tipos de gráfico; cada visor puede cambiar el tipo de un panel para su vista.
- Exportación a Excel y PDF.
- Calidad, Metas, Inventario, Gerencia, Usuarios, Historial, Permisos por
  rol/campaña/cliente — todo en el backend SQLite con API validada.

### Infraestructura (lista, sin desplegar)
- `server/Dockerfile` (multi-stage, no-root, healthcheck) + `docker-compose.yml`
  + `deploy/docker-compose.prod.yml` (pull desde ECR).
- Secretos en AWS SSM Parameter Store (`server/secrets.js` + `bootstrap.js`).
- Backups a S3 con versionado + `systemd` timer.
- CloudWatch Agent (logs + métricas) + alarma de health check.
- Política IAM de mínimo privilegio (`deploy/iam-policy-instance.json`).
- Pipeline `.github/workflows/deploy.yml` (OIDC, sin claves de larga vida).

---

## 3. Runbooks

### Despliegue desde cero
Ver **`AWS_DEPLOY_REPORT.md` §7** — paso a paso desde crear la instancia
Lightsail hasta la app corriendo en el dominio con HTTPS. Resumen:

1. Crear instancia Lightsail + IP estática + disco de bloques + firewall (§7.1).
2. Instalar Docker + AWS CLI, montar el disco en `/opt/inconexion/data` (§7.2).
3. Crear parámetros SSM, bucket S3, repo ECR (§7.1).
4. Copiar `deploy/docker-compose.prod.yml` → `/opt/inconexion/docker-compose.yml`,
   `deploy/Caddyfile` (con el dominio real) y `app.env`.
5. `docker compose pull && docker compose up -d`; verificar `/api/health`.
6. Activar el `systemd` timer de backup y el CloudWatch Agent (§7.4–7.5).
7. Primer login: cambiar todas las contraseñas de ejemplo, crear usuarios reales.

### Recuperación
Ver **`AWS_DEPLOY_REPORT.md` §9**:
- Instancia caída → nueva instancia + reatachar el mismo disco de datos.
- Restaurar de S3 → `docker compose stop app`, copiar el `.db` desde S3, borrar
  WAL viejo, `start app`.
- Deploy roto → `INCONEXION_IMAGE=...:<sha-anterior> docker compose up -d`.

---

## 4. Pendiente por decisión de negocio (no confirmada)

| Tema | Qué falta decidir | Cómo se resuelve |
|---|---|---|
| PANTERA MAIKERS | Qué operación es y sus KPIs | Constructor visual (o 1 config en `dashboard-plantillas-cliente.js`) |
| MOVILIZE | Qué operación es y sus KPIs | Idem |
| ANDRES YEPES / ALBERTO LINERO GO / SASCHA FITNESS | ¿Televentas o marca personal (redes/e-commerce)? | Constructor visual |
| Metas por cliente | Valores reales de meta de ventas / contactabilidad / recaudo | Campo "Meta" por KPI en el constructor |
| Inventario | Umbral de **bajo stock por ítem** | Añadir columna `minimo` a `inventario_items` + comparación (cambio pequeño) |
| Gerencia | **Dirección** de cada meta (AHT/costo: "menos es mejor") y de qué fuente salen los indicadores | Añadir campo `sentido` a `gerencia_kpis` (cambio pequeño); si deben consolidarse de Calidad/cargas, es trabajo nuevo |

Además: **cargar los datos reales** (Excel) de cada dashboard antes de mostrarlos
a los clientes — hoy tienen la estructura, no los datos.

---

## 5. Costos estimados (us-east-1, orden de magnitud)

| Recurso | US$/mes |
|---|---|
| Instancia Lightsail 2 GB | ~12 |
| Disco de bloques 20 GB | ~2 |
| S3 backups (versionado) | <1 |
| CloudWatch (logs + métricas + 1 alarma) | 1–4 |
| Route 53 (zona + health check) | ~1.5 |
| Dominio .com | ~1 |
| ECR | <1 |
| **Total** | **~US$18–25/mes** |

Con RDS Postgres + 2 instancias (alta disponibilidad): ~US$60–100/mes. La señal
para migrar está en `AWS_DEPLOY_REPORT.md` §2.

---

## 6. Estado de las pruebas

```
cd server && npm test
# tests 68 · pass 68 · fail 0
```

Cobertura: auth, validación de entrada, rate limiting, fuga de contraseñas,
permisos, Calidad (monitoreos/metas/cálculos), dashboards (cargas, config,
acceso por cliente), Inventario/Gerencia (CRUD + adaptadores), y la **matriz de
los 9 roles**.

CI (`.github/workflows/ci.yml`): pruebas en Node 18/20/22 + build de la imagen
Docker + smoke test que arranca el contenedor y verifica `/api/health`.
