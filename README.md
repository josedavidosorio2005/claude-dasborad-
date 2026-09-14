# InConexión Platform

App completa (frontend + backend real) para un contact center / BPO: gestión de
usuarios, roles y permisos, **control de Calidad**, **cronograma de metas**,
**dashboards de cliente configurables** con análisis de datos, e **Inventario** y
**Gerencia**. Todo con base de datos, login seguro y API — lista para desplegar
en un servidor real (Docker) o en **AWS**.

**No llama a Claude ni a ninguna IA en ningún punto** — es una app web
tradicional (Node.js + Express + SQLite) con su propio login.

---

## Documentación

| Archivo | Para qué |
|---|---|
| **README.md** (este) | Visión general, instalación local, seguridad, despliegue con Docker |
| [`PROGRESS.md`](PROGRESS.md) | Estado del proyecto fase por fase (fuente de verdad del avance) |
| [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md) | Checklist "¿listo para lanzar?", entregables, pendientes de negocio, costos |
| [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md) | **Despliegue en AWS**: arquitectura, runbook desde cero, recuperación, secretos, red, backups, CloudWatch, pipeline |
| [`DEPLOY_REPORT.md`](DEPLOY_REPORT.md) | Endurecimiento de seguridad y despliegue genérico (Docker/VPS) |
| [`SECURITY_FIX_REPORT.md`](SECURITY_FIX_REPORT.md) | Cierre del hallazgo de auditoría: XSS almacenado en el frontend (`esc()`) + filtrado de `GET /api/users` |
| [`REAL_DATA_REPORT.md`](REAL_DATA_REPORT.md) | Migración de Calidad/Metas/dashboards a datos reales en el servidor |
| [`UI_CLEANUP_REPORT.md`](UI_CLEANUP_REPORT.md) | Reorganización del frontend por módulos |

---

## Qué hace la app

### Usuarios, roles y permisos
9 roles (`ADMIN`, `AUX_ADMIN`, `CALIDAD`, `INVENTARIO`, `GERENCIA`,
`CLIENTES_DASH`, `SUPERVISOR`, `ASESOR`, `REPORTES`) con permisos verificados en
el servidor, incluyendo permisos por **campaña** (`campana_X`) y por **cliente**
(`cliente_X`). Historial de auditoría *append-only*.

### Calidad y Metas
Monitoreos de calidad por asesor/campaña con puntaje **calculado en el servidor**
(no manipulable desde el navegador), plantillas de calificación por campaña, y un
cronograma de metas con cumplimiento reproducible. Todo en SQLite + API.

### Dashboards de cliente — configurables, con análisis
- **12 dashboards** (Aurora, Orlant, Hospital La María + 9 de contact center),
  **todos definidos por configuración**, no por código. Crear o ajustar uno es
  una tarea visual.
- **Constructor visual** (panel admin → *Dashboards de Cliente*): elegir cliente,
  definir secciones de carga (Excel), KPIs y paneles, elegir tipo de gráfico y
  fuente, **reordenar** y **previsualizar** antes de guardar.
- **Motor de análisis**: cada KPI muestra tendencia vs periodo de comparación
  (variación absoluta y %), avance contra la meta (número o columna), tendencia
  de N periodos, y **resaltado de alerta automático** cuando un valor se sale de
  rango. Selector "Comparar contra" cualquier periodo previo.
- **6 tipos de panel**: KPI con tendencia, barras, líneas, área, pie/donut,
  tabla (+ combo barras/línea).
- **Preferencia por visor**: cualquier usuario cambia el tipo de gráfico de un
  panel para *su* vista (no afecta a los demás, no requiere permiso).
- **Exportación** del dashboard a Excel (`.xlsx` con los datos calculados) y PDF.
- Cada dashboard es visible **solo** para los roles con el permiso `cliente_<NOMBRE>`.

### Inventario y Gerencia
Se muestran con el **mismo motor de dashboards** (mismos paneles, mismo análisis,
misma exportación). Sus datos salen de sus tablas propias:
- **Inventario**: stock, estados, valor, movimientos (entrada/salida/ajuste/
  transferencia) con actualización atómica, carga masiva por Excel, alerta de
  "sin stock".
- **Gerencia**: indicadores ejecutivos mensuales, % de cumplimiento de metas con
  tendencia mes a mes, carga masiva por Excel.

Los modales de gestión son la **entrada de datos**; el botón **"Ver dashboard"**
abre la vista de análisis.

---

## Estructura del proyecto

```
inconexion-app/
├── server/                            → Backend (Node.js + Express)
│   ├── server.js                       createApp() + arranque + shutdown ordenado
│   ├── bootstrap.js                    Entrypoint de producción: hidrata secretos de AWS SSM y arranca
│   ├── secrets.js                      Lectura de secretos desde AWS SSM Parameter Store
│   ├── config.js                       Validación fail-fast de variables de entorno (zod)
│   ├── db.js                           Esquema y conexión SQLite + semillas idempotentes
│   ├── auth.js                         JWT + checks de permisos (rol, campaña, cliente)
│   ├── validation.js                   Esquemas zod de entrada por endpoint
│   ├── calidad-logic.js                Cálculos puros de Calidad (puntaje, metas, cumplimiento)
│   ├── calidad-plantillas-seed.js      Plantillas de calificación por campaña (semilla)
│   ├── dashboard-secciones.js          Secciones/plantillas de Excel de los 3 dashboards base
│   ├── dashboard-config-seed.js        Configuración de los dashboards base + los de M3
│   ├── dashboard-plantillas-cliente.js Plantillas estándar (ventas / cobranza / atención) de los 9 clientes
│   ├── dashboard-adapters.js           Inventario y Gerencia sobre el motor genérico
│   ├── hash-password.js                Utilidad para generar hashes bcrypt
│   ├── scripts/backup.js               Backup del SQLite → local + S3 (versionado)
│   ├── tests/                          node:test + supertest (incl. role-matrix.test.js)
│   ├── Dockerfile                      Imagen de producción (multi-stage, usuario no root)
│   └── package.json
├── public/                            → Frontend (HTML + JS por módulo, sin framework)
│   ├── index.html
│   ├── css/styles.css                  Design tokens (color, tipografía, espaciado)
│   └── js/                             api, session, users, roles-perms, calidad, metas,
│                                       cargas, dashboard-generic, dashboards-admin,
│                                       dashboards-core, charts, inventario, gerencia, ...
├── deploy/
│   ├── Caddyfile                       Reverse proxy con HTTPS automático
│   ├── docker-compose.prod.yml         Compose de la instancia AWS (descarga imagen de ECR)
│   ├── inconexion-backup.{service,timer}  systemd timer del backup diario
│   ├── cloudwatch-agent-config.json    Logs + métricas a CloudWatch
│   └── iam-policy-instance.json        Política IAM de mínimo privilegio
├── .github/workflows/
│   ├── ci.yml                          Pruebas (Node 18/20/22) + build Docker + smoke test
│   └── deploy.yml                      Deploy a AWS tras CI OK en main (OIDC → ECR → SSH)
├── docker-compose.yml                 Servicio app + volumen persistente + Caddy opcional
├── app.env.example                   Plantilla de configuración (Docker / producción)
└── *.md                              Documentación (ver tabla arriba)
```

---

## 1. Instalación local (para probar en tu computador)

Requisitos: [Node.js](https://nodejs.org) v18 o superior.

```bash
cd server
npm install
cp .env.example .env
```

Edita `server/.env` y completa:

1. **JWT_SECRET** (32+ caracteres):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **MASTER_ADMIN_PASSWORD_HASH**:
   ```bash
   node hash-password.js "tu-contrasena-segura"
   ```
   Pega el resultado (empieza con `$2a$`/`$2b$`) en la variable.

```bash
npm start          # -> http://localhost:3000
```

> En local `npm start` ejecuta `bootstrap.js`, que se comporta igual que
> `server.js` mientras no definas `SSM_PARAM_PREFIX`.

### Usuarios de ejemplo (creados la primera vez)

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | la de `MASTER_ADMIN_PASSWORD_HASH` | Administrador maestro |
| crodriguez | calidad123 | Calidad |
| mlopez | inv123 | Inventario |
| jherrera | ger123 | Gerencia |
| agomez | cli123 | Dashboard Clientes |
| lrios | aux123 | Auxiliar Admin |
| psuarez | admin456 | Admin |

**Cambia estas contraseñas** antes de usar la app con datos reales.

---

## 2. Seguridad

- **Configuración fail-fast**: `config.js` valida al arrancar `JWT_SECRET`
  (32+), `MASTER_ADMIN_PASSWORD_HASH` (formato bcrypt), `PORT`, y en producción
  `CORS_ORIGIN` obligatorio con dominio explícito (sin `*`). Si algo falta, el
  proceso **no arranca**.
- **Secretos en producción**: si defines `SSM_PARAM_PREFIX`, el servidor lee
  `JWT_SECRET`, `MASTER_ADMIN_PASSWORD_HASH`, `MASTER_ADMIN_USER` y `CORS_ORIGIN`
  desde **AWS SSM Parameter Store** (rol IAM de la instancia, sin claves). No hay
  `.env` con secretos en disco. Ver [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md) §3.
- **Contraseñas**: `bcrypt`, nunca en texto plano. Mínimo 8 caracteres.
- **Sesión**: JWT en memoria del navegador (no `localStorage`).
- **Permisos**: cada acción sensible se re-verifica en el servidor con los datos
  reales. Un usuario suspendido a mitad de sesión deja de poder actuar. Verificado
  para los 9 roles en `server/tests/role-matrix.test.js`.
- **Validación de entrada**: `zod` en todos los endpoints (tipos, longitudes,
  formato). Lo que no cumple → `400`.
- **Anti abuso**: login limitado (20 intentos / 15 min por IP) + límite global
  (300 req / 15 min por IP).
- **Cabeceras**: `helmet` con CSP explícita.
- **Errores**: middleware centralizado; el cliente recibe `500` genérico, el
  detalle solo va al log del servidor.
- **Logging**: `morgan` (`combined` en producción); nunca registra contraseñas ni
  `Authorization`.
- **Apagado ordenado**: `SIGTERM`/`SIGINT` cierran HTTP + SQLite.

---

## 3. Desplegar con Docker (VPS genérico)

Docker con **Compose ≥ v2.30**. Dominio apuntando a la máquina.

```bash
git clone <tu-repo> inconexion-app && cd inconexion-app
cp app.env.example app.env

# Secretos
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"                 # -> JWT_SECRET
docker compose run --rm --no-deps app node hash-password.js "TU-CONTRASENA-ADMIN"        # -> MASTER_ADMIN_PASSWORD_HASH

# Edita app.env: JWT_SECRET, MASTER_ADMIN_PASSWORD_HASH (con sus "$", sin comillas),
#                CORS_ORIGIN=https://tudominio.com, TRUST_PROXY=1
# Edita deploy/Caddyfile: tu dominio y tu email.

docker compose --profile proxy up -d --build
curl -s https://tudominio.com/api/health     # -> {"ok":true}
```

- La BD SQLite vive en el volumen `inconexion-data` y **sobrevive** a
  `restart` / `down`+`up` / actualizaciones de imagen. Solo `down -v` la borra.
- Sin reverse proxy en esa máquina: omite `--profile proxy` y ajusta `ports`.

---

## 4. Desplegar en AWS  ⭐

Arquitectura recomendada: **1 instancia Lightsail + Docker + Caddy + disco de
bloques** para SQLite, con **SSM** (secretos), **S3** (backups versionados) y
**CloudWatch** (logs + alarma de health check).

El runbook completo paso a paso (crear instancia, SSM, S3, ECR, dominio, HTTPS,
backups, monitoreo, pipeline, recuperación y costos ~US$18–25/mes) está en:

**→ [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md)**

Pipeline: `.github/workflows/deploy.yml` despliega automáticamente tras pasar CI
en `main` (OIDC → build → ECR → SSH → `docker compose pull && up -d` + health
check). Requiere crear en AWS/GitHub los recursos y secrets del §8 de ese
documento.

---

## 5. Backups

`server/scripts/backup.js` hace una copia consistente del SQLite (backup en
caliente de `better-sqlite3`, sin parar la app) y, si defines `BACKUP_S3_BUCKET`,
la sube a S3 (bucket con versionado).

```bash
docker compose exec app node scripts/backup.js --keep 14      # local, retención 14
```

Automatizado en AWS con `deploy/inconexion-backup.timer` (systemd, diario 03:15).

---

## 6. Datos de demostración (`seed:demo`)

`server/scripts/seed-demo.js` siembra datos de ejemplo en **todos** los
dashboards a la vez (los 12 de cliente + Calidad + Nivel de Servicio +
Cronograma + Inventario + Gerencia + Gestión Humana), con 6 meses de
histórico (`2026-04` a `2026-09`), para poder ver la app llena de datos
mientras llegan los datos reales del cliente.

```bash
cd server
npm run seed:demo             # siembra (idempotente: correrlo 2 veces no duplica nada)
npm run seed:demo:limpiar     # borra EXACTAMENTE lo que sembró — nada más
```

**Qué siembra:**

- Los 12 dashboards de cliente (`ORLANT`, `HOSPITAL LA MARIA`, `CLINICA AURORA`,
  `TELEVENTAS SURA`, `TELEVENTAS COMFAMA`, `PANTERA MAIKERS`, `ANDRES YEPES`,
  `MOVILIZE`, `SASCHA FITNESS`, `ALBERTO LINERO GO`, `INFONDO`, `BIVETT`), con
  carga en **todas** sus secciones y los 6 meses de histórico.
- Nivel de Servicio diario (`calidad_nivel_servicio_diario`) con el formato
  real del conmutador (skill por campaña, lunes-viernes ~150-250 llamadas,
  sábado ~30-40, domingo sin operación, `SERVICE_LEVEL_20SEC` 70-95%); el
  agregado mensual lo recalcula la misma función que usa
  `POST /api/calidad/nivel-servicio/carga-diaria`
  (`server/nivel-servicio-diario.js`) — nunca hay dos formas de sumarlo.
- Calidad: 8-12 asesores por campaña (de las que tienen pestaña de Calidad),
  con monitoreos repartidos en los 6 meses y puntajes variados (calculados
  siempre por `calidad-logic.js`, nunca a mano), y cronograma de metas con
  cumplimiento variable mes a mes.
- Cronograma de metas, Inventario (con ítems **sin stock** a propósito, para
  ver la alerta), Gerencia (KPIs mensuales con meta y cumplimiento variable) y
  Gestión Humana (altas/bajas repartidas en los meses, `costo_hora`/`horas_mes`
  poblados para la rentabilidad y el % de efectividad por campaña).
- Un usuario de demo **por cada rol** (`ADMIN`, `AUX_ADMIN`, `CALIDAD`,
  `INVENTARIO`, `GERENCIA`, `GESTION_HUMANA`, `CLIENTES_DASH`, `SUPERVISOR`,
  `ASESOR`, `REPORTES`), usuario `demo_<rol>`, con permisos por
  campaña/cliente ya puestos (útiles también para probar la matriz de
  permisos). Las contraseñas son aleatorias y **se imprimen una sola vez**, al
  final de la corrida en que se crean — no se pueden volver a mostrar después
  (se guardan hasheadas). Si vuelves a correr `seed:demo` y esos usuarios ya
  existen, no se tocan ni se muestra contraseña de nuevo.

**Cómo se marca lo sembrado** (para que `seed:demo:limpiar` borre exactamente
eso y nada más): cada fila que crea queda registrada en una tabla propia
(`seed_demo_marcas`, `tabla` + `clave` determinística + `id` real de la fila),
además de un rastro visible en los datos mismos (`observaciones`/`archivoNombre`
con `[DEMO]` / `seed-demo.xlsx`, `cargadoPorNombre: "Seed Demo (script)"`).
Nunca pisa ni adopta una carga/meta/KPI que ya existiera y no fuera suyo — si
alguien subió un dato real para el mismo período antes de sembrar, el seed lo
deja intacto y no lo marca.

Escribe **directo a SQLite** (no por HTTP), pero siempre pasando por las
mismas funciones de normalización/cálculo que usa la API real
(`dashboard-secciones.normalizarFilas`, `calidad-logic.computeScore`,
`nivel-servicio-diario.cargarNivelServicioDiario`), así que un dato sembrado
es indistinguible de uno real y nunca se cuela algo que la app rechazaría.

> ⚠️ **Nunca corre solo** (no está enganchado al arranque, solo por comando
> explícito) y **rechaza correr contra producción** (`NODE_ENV=production`)
> salvo que confirmes a propósito:
>
> ```bash
> SEED_DEMO_CONFIRM=1 npm run seed:demo
> SEED_DEMO_CONFIRM=1 npm run seed:demo:limpiar
> ```

---

## 7. SQLite vs Postgres — cuándo migrar

SQLite en un archivo es adecuado para esta app (un proceso, tráfico bajo/medio).
Migrar a **Postgres + varias instancias** cuando: se necesite más de una
instancia de app (alta disponibilidad), aparezcan `SQLITE_BUSY` recurrentes,
varios servicios escriban la misma BD, o se requiera point-in-time recovery.
Criterio detallado en [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md) §2. Hoy **no
se migra**.

---

## 8. Pruebas automatizadas

```bash
cd server && npm test          # node:test + supertest, sin infra extra  ->  108/108
```

Cubren: login (correcto/incorrecto, suspendido), acceso por permiso (`403`/`200`),
que contraseñas/hashes **nunca** salen en respuestas, rate limit de login
(`429`), validación de entrada (`400`), Calidad (puntaje reproducible, acceso por
campaña, cronograma y cumplimiento), dashboards (cargas por Excel, config,
acceso por cliente, dashboards de M3), Inventario y Gerencia (CRUD + carga masiva
+ adaptadores de dashboard), la **matriz de los 9 roles**
(`role-matrix.test.js`), y el seed de demo — idempotencia, que `seed:demo:limpiar`
deja la base como estaba, que los 12 clientes quedan con carga en todas sus
secciones, y que su mensual de Nivel de Servicio coincide con el que produce
el endpoint real (`seed-demo.test.js`).

CI (`.github/workflows/ci.yml`): pruebas en Node 18/20/22 + build de la imagen
Docker + **smoke test** que arranca el contenedor y verifica `/api/health`.

---

## 9. Comandos útiles

```bash
# generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# generar hash bcrypt del admin maestro
node server/hash-password.js "mi-contrasena"

# desarrollo local
cd server && npm install && cp .env.example .env && npm start

# pruebas
cd server && npm test

# backup manual
cd server && npm run backup            # node scripts/backup.js --keep 14

# datos de demostración (ver sección 6)
cd server && npm run seed:demo
cd server && npm run seed:demo:limpiar
```

---

## 10. Notas

- No hay recuperación de contraseña por correo (se gestiona vía admin).
- La CSP permite `'unsafe-inline'` en scripts porque `public/index.html` usa
  manejadores inline; `xlsx` se carga desde `cdnjs`, Chart.js va embebido.
- Métricas de negocio de algunos clientes (PANTERA MAIKERS, MOVILIZE) y la
  dirección de las metas de Gerencia están **pendientes de confirmación**; ver
  [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md) §4. Se ajustan desde el constructor
  visual sin programar.
