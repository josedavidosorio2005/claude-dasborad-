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
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | **Foto completa del sistema**: modelo de datos, motor de semáforo, motor de dashboards, Tráfico Volvox, carga masiva de Calidad, API, y decisiones no obvias — para mantener/extender sin preguntar |
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

### Tráfico de llamadas (export real de Volvox)
Sube el reporte diario de la plataforma de marcación **Volvox tal cual lo
descargas**, sin abrirlo ni recortar columnas — el sistema toma las columnas
que necesita por **nombre de encabezado** (nunca por posición) y convierte lo
que haga falta (horas → segundos, texto con `%` → número, fracción decimal →
porcentaje). Una skill nueva se guarda igual, marcada "sin asignar", hasta
que el admin la mapee a una campaña — nunca rompe la carga. Alimenta una
pestaña **"Tráfico de Llamadas"** en el dashboard de cada campaña (grafica
combinada: llamadas totales/contestadas en barras + nivel de atención en
línea sobre eje secundario), con filtros de skill, rango de fechas y
granularidad día/mes/año — ver la sección 7 para el detalle completo.

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

### Contraseñas de demo: dónde salen y cómo rotarlas

Las contraseñas nuevas **solo se imprimen en una terminal interactiva real**
(`process.stdout.isTTY`) — exactamente lo que tienes al correr
`npm run seed:demo` tú mismo. En una corrida **no interactiva** (CI,
`docker compose exec -T ...`, salida redirigida a un archivo/log) el script
**nunca** las escribe a stdout/stderr: las guarda en un archivo junto a la
base de datos (`seed-demo-credenciales.txt`, permisos `0600`), recuperable
solo con acceso real (SSH/exec) a la máquina — nunca desde el log de un
workflow de CI. Cubierto por un test real sobre la salida del proceso
(`server/tests/seed-demo-cli.test.js`), no por un comentario.

Si una contraseña de demo se llegó a filtrar (p. ej. quedó en un log antes de
este mecanismo), rótala — cambiar de ahora en adelante no es suficiente,
la que ya se filtró sigue siendo válida hasta que la reemplaces:

```bash
npm run seed:demo:rotar-claves     # regenera la contrasena de TODOS los demo_*
                                    # existentes, sin tocar ningun otro dato sembrado
```

En producción, cualquiera de los tres (`sembrar`/`limpiar`/`rotar-claves`) se
dispara desde `.github/workflows/seed-demo.yml` (`workflow_dispatch`):

```bash
gh workflow run seed-demo.yml -f accion=rotar-claves
```

### Banner "Datos de demostración"

Mientras `seed:demo` tenga algo sembrado, la app pinta un banner fijo y
permanente arriba de **toda** pantalla (admin, dashboards de cliente, Asesor,
Supervisor) avisando que los datos son de prueba — se enciende y apaga solo
según `GET /api/seed-demo/estado` (que a su vez solo mira si hay algo en
`seed_demo_marcas`), sin tocar código ni desplegar nada: corre
`seed:demo:limpiar` y desaparece en el siguiente login. El mismo aviso se
inyecta en las exportaciones a Excel (hoja `AVISO` al principio del archivo)
y PDF/impresión del dashboard genérico, para que un archivo con datos falsos
nunca circule sin decirlo.

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

## 7. Cargar datos de una campaña — para el usuario final

> Actualizado 2026-09-16 (PR #32): antes había que ir a pantallas separadas
> según el tipo de dato — la plantilla de Tráfico estaba en "Metas
> Calidad", la de Calidad en el módulo de Calidad, y la de KPIs/resumen
> mensual en "Cargar Datos". **Ya no.** Ahora es un solo paso, un solo
> botón, un solo archivo por campaña.

### Un solo botón por campaña: la plantilla consolidada (vía principal)

1. Entra como **administrador** (o un usuario con el permiso **"Cargar
   Datos"**) → menú **"Cargar Datos"** → elige la **campaña** en el
   desplegable "Cliente".
2. Botón **"Descargar plantilla (Excel)"** — trae **un solo archivo**, con
   **una hoja por cada tipo de dato que le aplica a esa campaña**: sus
   secciones propias de resumen mensual/KPIs y demás (varían por campaña),
   una hoja **"Monitoreos"** de Calidad si esa campaña tiene plantilla de
   calificación, y siempre una hoja **"DATA"** para el tráfico de llamadas
   (Volvox). La hoja **INSTRUCCIONES** al inicio del archivo explica qué es
   cada hoja, cuáles columnas son obligatorias/opcionales, y los formatos
   de fecha/hora/porcentaje — léela una vez antes de llenar la primera vez.
3. Llena **solo las hojas que le apliquen a esa campaña esta vez** — las
   demás pueden quedarse tal cual las descargaste, vacías. Eso **no es un
   error**: una hoja vacía simplemente no aplica esta vez, no hace falta
   borrarla ni avisar nada.
4. Indica el **período (mes)** — aplica a las hojas de resumen/KPIs; las de
   Calidad y Tráfico ya traen su propia fecha por fila. Sube el archivo
   lleno con **"Elegir archivo…"**.
5. Revisa la **vista previa**: por cada hoja dice si quedó **OK** (con
   cuántas filas), **vacía** (no aplica esta vez, sin problema) o con un
   **error explícito** — por ejemplo, si una celda trae una fórmula de
   Excel sin calcular en vez de un número (pasa cuando el archivo se
   generó por script y nunca se abrió en Excel/LibreOffice para forzar el
   cálculo), el mensaje dice **exactamente cuál celda** y qué escribir en
   su lugar.
6. Confirma con **"Guardar carga"**. **Si una hoja tiene un error, las
   demás se guardan igual** — no hay que corregir y volver a llenar todo el
   archivo por un solo error: corrige solo esa hoja, vuelve a subir el
   archivo completo, y las que ya estaban bien no se pierden ni se vuelven
   a pedir por separado.

### Casos especiales

- **Tráfico en bloque, multi-skill y multi-campaña de un solo export de
  Wolkvox:** si tu flujo es pegar el export completo de Wolkvox Manager
  (varias skills, varias campañas, varios meses a la vez) en vez de
  llenar la hoja "DATA" campaña por campaña, esa vía **sigue existiendo**
  en menú **"Metas Calidad"** → tarjeta **"Tráfico de Llamadas — carga
  desde Wolkvox"** (input "Elegir archivo…", sin plantilla propia que
  descargar ahí — la plantilla se obtiene desde cualquier campaña, ver
  arriba). Ahí mismo, debajo, sigue el **mapeo de Skills → Campaña**
  (una skill nueva se guarda igual, marcada "sin asignar", hasta que la
  mapees) y el **Control de Cargas por Período**. El resto de esta sección
  (formato de columnas, sedes, gráfica y filtros) aplica igual sin
  importar por cuál de las dos vías haya entrado el dato.
- **Campañas sin dashboard propio (Cartera Interna, Consultorio Julián
  Molano):** no tienen pantalla "Cargar Datos" — sus monitoreos de Calidad
  se cargan desde el módulo de Calidad → esa campaña → pestaña **"Carga
  Masiva (Excel)"**, sin cambios (ver §13).

Puedes subir el mismo archivo las veces que quieras: si un período ya
tenía datos, se actualiza (nunca se duplica) — el sistema te avisa antes
de sobrescribir para que lo confirmes con conocimiento.

**Si necesitas combinar datos de más de una fuente** (ej. una línea cuyo AHT
sale de un reporte distinto al de Volvox): la plataforma **no** une archivos
por ti — se unifican **a mano, en la misma plantilla**, antes de subir. Es
decir, agrega esas filas dentro del mismo archivo `.xlsx` (mismas columnas
`SKILL_NAME`/`DATE`/etc.) y sube un único archivo por mes/skill — nunca dos
archivos separados para el mismo período, porque el segundo reemplazaría al
primero en vez de sumarse.

Cualquier fila de la base que parezca un resumen/cierre (`SKILL_NAME` =
"TOTAL", "TOTALES", "TOTAL GENERAL", "GRAN TOTAL") se descarta automáticamente
con un aviso — nunca se suma como si fuera una línea real.

### Campañas con más de una sede (hoy: Hospital La María)

Si la campaña tiene sedes (el dashboard muestra un selector "SEDE" arriba),
el mapeo de cada skill pide además la sede correspondiente en un segundo
desplegable, junto al de campaña. Es un solo dashboard con ambas sedes
disponibles — el selector de sede solo cambia qué datos ves, cualquiera con
acceso al dashboard puede ver cualquiera de las dos.

### Control de cargas por período

En la misma pantalla, debajo del mapeo de skills, la tarjeta **"Control de
Cargas por Período"** muestra, por skill, qué meses ya tienen tráfico
cargado — útil para saber qué pedirle a Volvox antes de que se te olvide un
mes.

### Qué hace el sistema con cada columna

| Columna del archivo | Cómo llega | Qué hace el sistema |
|---|---|---|
| `SKILL_NAME` | texto | **Obligatoria.** Determina la campaña (vía el mapeo). |
| `DATE` | fecha nativa de Excel | **Obligatoria.** Se usa tal cual, nunca `MES`/`AÑO` (son solo respaldo informativo). |
| `TOTAL LLAMADAS` / `LLAMADAS CONTESTADAS` | número | **Obligatorias.** |
| `LLAMADAS ABANDONADAS` | número | Opcional — si falta, esa métrica queda vacía (no en 0). |
| `SERVICE_LEVEL_10/20/30SEC`, `ABANDON` | texto `"87.03 %"` | Se convierte a número. |
| `ASA`, `ATA` | número (a veces como texto) | Ya vienen en segundos. |
| `WAIT_TIME`, `AHT` | hora nativa (`0:03:35`) | Se convierte a segundos (215). |
| `NIVEL DE ATENCION`, `TASA DE ABNDONO` (*sic*, así la nombra Volvox) | fracción decimal (`0.9838`) | Se convierte a porcentaje (98.38%). |
| `MES`, `AÑO` | texto/número | Solo respaldo — el mes/año real siempre sale de `DATE`. |
| Cualquier otra columna | — | Se ignora sin fallar. Si Volvox agrega o reordena columnas mañana, la carga sigue funcionando (el emparejamiento es por nombre de encabezado). |

### La gráfica y sus filtros

Barras de **Total Llamadas** y **Llamadas Contestadas**, línea de **Nivel de
Atención** en eje secundario (%). Filtros: skill (una, varias o todas),
rango de fechas, y granularidad **día/mes/año** — al cambiar de
granularidad, los volúmenes se **suman** y el % se **recalcula desde esa
suma** (nunca se promedian los porcentajes diarios: el nivel de atención de
un mes es contestadas del mes ÷ total del mes). Varias skills seleccionadas
se suman entre sí, salvo que actives "Ver skills por separado". Los KPIs de
la cabecera y las exportaciones a Excel/PDF reflejan siempre lo que esté
filtrado en pantalla, y el estado de los filtros queda en la URL (compartible).

### Decisión de arquitectura

Se **extendió** `calidad_nivel_servicio_diario` (la tabla del PR #10) con las
columnas que faltaban, en vez de crear una tabla nueva: ya comparte la misma
llave natural (campaña+fecha+skill) y el mismo flujo de carga/recálculo
mensual — una tabla aparte habría duplicado esa lógica sin necesidad. El
mapeo skill→campaña vive en `trafico_skill_mapeo` (administrable desde el
panel, nunca hardcodeado); remapear una skill reatribuye su histórico ya
guardado sin tener que volver a subir el archivo.

---

## 8. SQLite vs Postgres — cuándo migrar

SQLite en un archivo es adecuado para esta app (un proceso, tráfico bajo/medio).
Migrar a **Postgres + varias instancias** cuando: se necesite más de una
instancia de app (alta disponibilidad), aparezcan `SQLITE_BUSY` recurrentes,
varios servicios escriban la misma BD, o se requiera point-in-time recovery.
Criterio detallado en [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md) §2. Hoy **no
se migra**.

---

## 9. Pruebas automatizadas

```bash
cd server && npm test          # node:test + supertest, sin infra extra  ->  137/137
```

Cubren: login (correcto/incorrecto, suspendido), acceso por permiso (`403`/`200`),
que contraseñas/hashes **nunca** salen en respuestas, rate limit de login
(`429`), validación de entrada (`400`), Calidad (puntaje reproducible, acceso por
campaña, cronograma y cumplimiento), dashboards (cargas por Excel, config,
acceso por cliente, dashboards de M3), Inventario y Gerencia (CRUD + carga masiva
+ adaptadores de dashboard), la **matriz de los 9 roles**
(`role-matrix.test.js`), el seed de demo — idempotencia, que `seed:demo:limpiar`
deja la base como estaba, que los 12 clientes quedan con carga en todas sus
secciones, que su mensual de Nivel de Servicio coincide con el que produce
el endpoint real, y el estado del banner de demo (`seed-demo.test.js`) — y,
sobre el **proceso real** del CLI (no la librería interna), que ninguna
contraseña de demo se escriba jamás en stdout/stderr en el camino no
interactivo, ni al sembrar ni al rotar claves (`seed-demo-cli.test.js`).

**Tráfico de llamadas** (`trafico-logic.test.js`, `trafico-carga.test.js`):
el parseo corre contra el fixture **real** (`server/tests/fixtures/EJEMPLO.xlsx`,
leído con un lector de `.xlsx` propio y sin dependencias —
`tests/helpers/xlsx-lite.js` — porque los paquetes de npm para leer Excel no
pasan `npm audit` hoy), cubriendo horas→segundos, `%` en texto, fracción→%,
columnas extra/reordenadas ignoradas, columna obligatoria faltante, archivo
con varias skills y varios meses, y la agregación correcta por granularidad
(recalcula el % desde los volúmenes ya sumados, nunca promedia los %
diarios). Del lado del servidor: skill nueva → "(SIN ASIGNAR)" sin romper la
carga, idempotencia, y que remapear una skill reatribuye su histórico y
recalcula el mensual de la campaña vieja y la nueva.

CI (`.github/workflows/ci.yml`): pruebas en Node 18/20/22 + build de la imagen
Docker + **smoke test** que arranca el contenedor y verifica `/api/health`.

---

## 10. Comandos útiles

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

## 11. Notas

- No hay recuperación de contraseña por correo (se gestiona vía admin).
- La CSP permite `'unsafe-inline'` en scripts porque `public/index.html` usa
  manejadores inline; `xlsx` se carga desde `cdnjs`, Chart.js va embebido.
- Métricas de negocio de algunos clientes (PANTERA MAIKERS, MOVILIZE) y la
  dirección de las metas de Gerencia están **pendientes de confirmación**; ver
  [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md) §4. Se ajustan desde el constructor
  visual sin programar.

---

## 12. Semáforo de color por umbral (configurable sin desplegar)

Las tarjetas KPI de los 12 dashboards de cliente (y las celdas de tabla donde
aplica, ej. el "Promedio Puntaje" de Calidad y el ranking de asesores) se
pintan en **verde/amarillo/rojo** según qué tan bien o mal está el valor,
usando umbrales que un administrador configura desde el panel — **nunca en
código, nunca requiere desplegar**.

### Cómo configurar un umbral

1. Entra como **administrador** → menú **"Umbrales"**.
2. Completa: **Métrica** (el identificador que usa el KPI, ver tabla abajo),
   **Campaña** (déjalo en blanco para que aplique a todas — "default
   global" — o elige una campaña específica para sobreescribir el default
   solo ahí), **Valor verde**, **Valor amarillo** y **Dirección** (*mayor es
   mejor*, ej. nivel de atención, o *menor es mejor*, ej. tasa de abandono).
3. Guarda. El cambio se ve en los dashboards **de inmediato** — no hace
   falta recargar el servidor ni desplegar nada.

Un umbral con campaña específica siempre gana sobre el default global para
esa misma métrica; si no hay ninguno de los dos, el dato queda sin color
(nunca se inventa un color sin configuración).

### Umbrales por defecto (sembrados automáticamente, editables desde el panel)

| Métrica (identificador) | Verde | Amarillo | Dirección | Por qué este valor |
|---|---|---|---|---|
| `nivel_atencion` | ≥90% | 70–90% | Mayor es mejor | Estándar habitual de nivel de atención en contact center. |
| `tasa_abandono` | ≤5% | 5–10% | Menor es mejor | Umbral típico de abandono de llamadas aceptable. |
| `qa_promedio` | ≥90 | 70–90 | Mayor es mejor | Mismo corte que ya usaba Calidad antes de este cambio (ahora editable). |
| `service_level` | ≥80% | 65–80% | Mayor es mejor | Contestadas dentro del tiempo objetivo (ej. 20s) sobre el total. |
| `cumplimiento_meta` | ≥100% | 80–100% | Mayor es mejor | Mismo corte que ya usaba la barra de avance de meta (ahora editable). |

Si un KPI no trae un identificador de métrica explícito en su configuración,
el sistema deriva uno del título (minúsculas, sin tildes, espacios → `_`) —
por eso el nombre de la métrica en el panel de Umbrales debe coincidir con
ese identificador para que el color se aplique.

### Exportación

El color también viaja a las exportaciones: en **Excel** como una columna de
texto `Semaforo` (VERDE/AMARILLO/ROJO) junto a cada KPI — el motor de Excel
que usa la app (SheetJS, build gratuito de `cdnjs`) no soporta relleno de
celda con color, así que no hay una celda pintada, pero el dato está
presente y es fiel a lo que se ve en pantalla. En **PDF** (impresión) el
texto del semáforo sí sale con su color real.

---

## 13. Cartera (cobranza) — primera campaña con camino a datos reales

La campaña de Calidad **"CARTERA INTERNA"** (cobranza) ya tiene su plantilla
de evaluación (14 ítems ponderados, varios marcados como críticos — ver
`server/calidad-plantillas-seed.js`) y ahora también tiene **carga masiva de
monitoreos por Excel**, la primera campaña con este camino hacia datos
reales (antes, los monitoreos de Calidad solo se creaban uno por uno desde
un formulario).

> Cartera Interna (y Consultorio Julián Molano) no tienen dashboard propio,
> así que no aparecen en el menú "Cargar Datos" ni tienen plantilla
> consolidada (§7) — este es su único camino de carga masiva, y sigue
> siendo así a propósito.

### Cómo cargar monitoreos por Excel

1. Entra al **módulo de Calidad**, elige la campaña **CARTERA INTERNA** →
   pestaña **"Carga Masiva (Excel)"**.
2. **Descarga la plantilla** — trae 3 hojas: **Monitoreos** (para
   diligenciar), **Diccionario** (referencia: ítem, categoría, peso %,
   crítico) y **Resumen por Asesor** (de apoyo). Solo se procesa la hoja
   "Monitoreos"; las otras dos son de referencia.
3. Llena la hoja Monitoreos (un asesor y una fecha por fila, más una columna
   `SI`/`NO`/`N/A` por cada ítem de la plantilla) y vuelve a subirla.
4. Revisa la **vista previa** (avisos de filas descartadas si las hay) y
   confirma con **"Guardar carga masiva"**.

Es **idempotente por (campaña, asesor, fecha, ID Llamada)** cuando la fila
trae un ID de llamada: volver a subir el mismo archivo actualiza esos
monitoreos en vez de duplicarlos. Sin ID de llamada no hay una clave natural
para deduplicar, así que esas filas siempre se insertan.

### Banner de "datos de demostración" mientras conviven campañas reales y demo

**Decisión:** el banner se queda **global** (no por campaña), aunque Cartera
ya tenga datos reales y las otras 11 campañas sigan en demo. Hacerlo por
campaña exigiría un cambio de esquema (columnas de alcance en la tabla que
rastrea los datos de demo) y reescribir la ruta que lo expone con un filtro
por cliente en cada dashboard. Mientras tanto, el banner sigue visible en
**toda** la app — incluida Cartera — hasta que se limpien los datos de demo
de las 11 campañas restantes con `seed:demo:limpiar`. Evita el riesgo de que
alguien vea un dashboard sin el aviso y asuma que es real cuando solo
Cartera lo es (o al revés).
