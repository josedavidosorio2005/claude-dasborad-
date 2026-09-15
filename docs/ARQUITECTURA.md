# Arquitectura — InConexion Platform

> Foto completa del sistema tal como está hoy en el código, para alguien que
> no lo escribió y tiene que mantenerlo o extenderlo sin preguntar. Esto
> **no** es un historial de cambios (eso vive en [`PROGRESS.md`](../PROGRESS.md))
> ni un runbook de despliegue con credenciales (eso vive en
> [`AWS_DEPLOY_REPORT.md`](../AWS_DEPLOY_REPORT.md)). Este documento enlaza a
> ambos en vez de repetirlos.

---

## 1. Visión general

InConexion Platform es el sistema interno de un contact center (BPO) para
operar y auditar varias campañas de atención al cliente a la vez: cada
campaña tiene su propio dashboard con indicadores de producción (llamadas,
WhatsApp, ventas, cobranza, agendamiento — según el tipo de campaña), y
comparte con las demás dos módulos transversales: **Calidad** (evaluación de
monitoreos con una plantilla de ítems ponderados por campaña) e
**Inventario/Gerencia/Gestión Humana** (indicadores administrativos que se
ven con el mismo motor de dashboard que las campañas de cliente). Los datos
operativos de cada dashboard entran por carga de Excel (nunca captura
manual fila por fila, salvo Calidad que además permite carga masiva desde
esta última fase); el sistema nunca inventa ni interpola datos que no
subieron.

El sistema fue diseñado para que **agregar un cliente/dashboard nuevo, una
campaña de Calidad nueva, o cambiar un umbral de color no requiera escribir
código ni desplegar** — todo eso vive en filas de configuración en SQLite,
editables desde el panel de administración. El código genérico (el "motor")
se escribió una sola vez y lo reutilizan todos los dashboards/campañas por
igual; lo específico de cada cliente es datos, no lógica.

Es una aplicación monolítica de una sola instancia: un backend Node/Express
con SQLite embebido (un solo archivo, un solo proceso escritor) detrás de
Caddy como reverse proxy con HTTPS automático, desplegada como contenedores
Docker en una instancia Lightsail de AWS. No hay microservicios, no hay cola
de mensajes, no hay caché externo — la simplicidad es deliberada (ver
[`AWS_DEPLOY_REPORT.md`](../AWS_DEPLOY_REPORT.md) §2 para la comparación
contra RDS + varias instancias y las señales concretas para migrar).

### Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express (`server/server.js`), validación con Zod (`server/validation.js`) |
| Base de datos | SQLite embebido vía `better-sqlite3` (síncrono, un archivo, un proceso escritor) — `server/db.js` define TODO el schema |
| Frontend | HTML + JS vanilla (sin framework, sin build step) en `public/`, Chart.js para gráficas, SheetJS (`xlsx`, CDN) para Excel en el navegador |
| Autenticación | JWT propio (`jsonwebtoken`), sin sesiones de servidor |
| Reverse proxy / HTTPS | Caddy 2 (certificados Let's Encrypt automáticos) |
| Contenedores | Docker Compose (`app` + `caddy`), imagen construida desde `server/Dockerfile` |
| Infra / nube | AWS Lightsail (instancia + disco de datos persistente), ECR (imágenes), SSM Parameter Store (secretos), S3 (backups) — detalle completo en [`AWS_DEPLOY_REPORT.md`](../AWS_DEPLOY_REPORT.md) |
| CI/CD | GitHub Actions: `ci.yml` (tests + build) → `deploy.yml` (build/push a ECR + despliegue por SSH, disparado solo si CI pasó en `main`) |

### Cómo se conectan las piezas

```
 Navegador
    │  HTTPS (dominio real)
    ▼
 ┌─────────────────────┐
 │ Caddy (contenedor)   │  HTTPS automático (Let's Encrypt), reverse_proxy -> app:3000
 │ :80 :443             │
 └──────────┬───────────┘
            │ red interna de docker compose
 ┌──────────▼───────────┐
 │ app (contenedor)      │  node bootstrap.js
 │ 127.0.0.1:3000        │  1. hidrata secretos desde SSM (JWT_SECRET, hash del
 │  (no expuesto afuera) │     admin maestro, CORS_ORIGIN) — ver server/secrets.js
 │                       │  2. arranca Express (server/server.js)
 └──────────┬───────────┘
            │ better-sqlite3 (archivo local)
 ┌──────────▼───────────┐
 │ disco de datos         │  /opt/inconexion/data — persistente, sobrevive a
 │ inconexion.db (SQLite) │  reinicios de contenedor/instancia
 └───────────────────────┘

 Fuera de la caja de arriba, pero parte del sistema:

 AWS SSM Parameter Store ── secretos que el contenedor lee AL ARRANCAR
                             (nunca en el repo, nunca en disco en texto plano)
 AWS S3 (versionado)     ── backup diario de inconexion.db (systemd timer en
                             el host, fuera del contenedor — ver §8 abajo)
 GitHub Actions           ── push a main -> CI corre la suite -> si pasa,
   (deploy.yml)               deploy.yml construye la imagen, la sube a ECR,
                               abre el puerto 22 solo para el runner, hace
                               `docker compose pull && up -d` por SSH, y
                               vuelve a cerrar el puerto 22
```

Quién habla con quién en tiempo de ejecución: el navegador nunca toca SQLite
ni SSM directamente — todo pasa por la API REST de `server/server.js`, que
es la única pieza que conoce las tablas y los secretos.

---

## 2. Modelo de datos

Todas las tablas viven en un único `CREATE TABLE` grande al inicio de
[`server/db.js`](../server/db.js) (más migraciones puntuales más abajo en el
mismo archivo, vía `runOnceMigration`, para bases que ya existían antes de un
cambio de schema). **No se repite el schema completo aquí a propósito** —
esta lista es el mapa; el archivo de origen es la fuente de verdad y cambia
con el tiempo sin que este documento tenga que actualizarse línea por línea.

| Tabla | Para qué sirve |
|---|---|
| `users` | Usuarios de la app (rol, permisos por campaña/cliente como JSON, hash bcrypt). El admin maestro NO vive aquí — sale de variables de entorno/SSM. |
| `historial` | Auditoría global append-only de acciones administrativas (crear/editar/suspender usuario, cambios de permisos, cargas, etc.) — nunca se borra ni edita una fila. |
| `dashboards_config` | La configuración (KPIs, paneles, secciones) de cada dashboard de cliente — un dashboard nuevo es una fila nueva aquí, no código nuevo. Se siembra "solo si el cliente no existe todavía" desde `dashboard-config-seed.js`/`dashboard-plantillas-cliente.js` — **ver la advertencia del §3 sobre este comportamiento**. |
| `dashboard_cargas` | Los datos operativos subidos por Excel para cada (cliente, sección, período) — un archivo reemplaza al anterior del mismo período, nunca duplica. |
| `umbrales_semaforo` | Umbrales de color (verde/amarillo/rojo) por métrica, con override opcional por campaña — ver §3. |
| `calidad_plantillas` | La plantilla de evaluación (ítems, pesos, críticos, motor de puntaje) de cada campaña de Calidad — única fuente de verdad del formato, el frontend la consume por API. |
| `monitoreos` | Un monitoreo de Calidad por asesor/campaña/fecha, con las respuestas y el puntaje ya calculado en el servidor (nunca confía en el puntaje que mande el cliente). Ver §6 para la carga masiva. |
| `cronograma_metas` | Metas mensuales de monitoreo por campaña/líder responsable (cuántos monitoreos debe hacer cada quien). |
| `calidad_nivel_servicio` | Nivel de servicio **mensual** por campaña (contestadas ≤20s / total del mes) — se recalcula siempre a partir de `calidad_nivel_servicio_diario`, nunca se edita a mano cuando hay datos diarios. |
| `calidad_nivel_servicio_diario` | Nivel de servicio **diario** por campaña/skill, tal cual viene del export del conmutador/PBX (incluye las columnas ampliadas del export real de Volvox — ver §5). Es la tabla que sobrevivió a la decisión de Volvox: se extendió en vez de crear una tabla nueva, porque ya compartía la llave natural (campaña+fecha+skill) y el flujo de recálculo mensual. |
| `trafico_skill_mapeo` | Mapeo administrable de `SKILL_NAME` (tal cual lo nombra Volvox) → campaña/cliente de InConexion — ver §5. |
| `seed_demo_marcas` | Ledger de qué filas sembró `scripts/seed-demo.js` (para poder borrar exactamente eso con `seed:demo:limpiar`). También es lo que enciende/apaga el banner global de "datos de demostración" — ver §9. |
| `gerencia_kpis`, `inventario_items`, `inventario_movimientos`, `gestion_humana_personal` | Datos propios de los 3 módulos administrativos (Gerencia, Inventario, Gestión Humana), que se ven con el mismo motor de dashboard que las campañas de cliente vía adaptadores — ver §4. |
| `schema_migrations` | Ledger de qué migraciones (`runOnceMigration`) ya corrieron, para que cada una se aplique una sola vez incluso en una base que lleva meses corriendo. |

---

## 3. Motor de semáforo (`public/js/semaforo-logic.js`)

Cada tarjeta KPI (y algunas celdas de tabla, ej. el ranking de asesores de
Calidad) se pinta de color según qué tan bien o mal está su valor, usando
umbrales que un administrador configura desde el panel **"Umbrales"** —
nunca quemados en código.

### Cómo se calcula el color

`semaforoColorDe(valor, umbral)` (lógica pura, con pruebas en
[`server/tests/semaforo-logic.test.js`](../server/tests/semaforo-logic.test.js)):

- `umbral = { verde, amarillo, direccion }`.
- `direccion: 'mayor_es_mejor'` (default) — verde si `valor >= verde`,
  amarillo si `valor >= amarillo` (pero menor que verde), rojo si no. Ejemplo:
  nivel de atención.
- `direccion: 'menor_es_mejor'` — verde si `valor <= verde`, amarillo si
  `valor <= amarillo`, rojo si no. Ejemplo: tasa de abandono (un valor **más
  bajo** es mejor, así que el umbral "verde" es el techo, no el piso).
- Sin umbral configurado para esa métrica, o valor no numérico: `null` (sin
  color) — el sistema **nunca inventa** un color sin configuración.

### De dónde sale el umbral: override por campaña sobre el default global

Tabla `umbrales_semaforo` (ver [`server/db.js`](../server/db.js), tabla
definida junto a las demás y sembrada con 5 defaults vía
`runOnceMigration('umbrales_semaforo_seed_v1', ...)`): una fila por
`(metrica, campana)`, donde `campana=''` es el **default global** para esa
métrica. `semaforoUmbralPara(umbrales, metrica, campana)` busca primero una
fila con esa campaña exacta; si no existe, cae al default global
(`campana===''`); si tampoco existe ninguna de las dos, no hay color.

El identificador de `metrica` de un KPI sale de `k.metrica` si el KPI lo
trae explícito en su configuración (`dashboards_config`/
`dashboard-adapters.js`), o si no, se deriva de `k.titulo`
(`semaforoMetricaKey`: minúsculas, sin tildes, espacios → `_`). Dos KPIs con
títulos que difieren en una palabra (ej. "Nivel Atencion" vs "Nivel Atencion
3P") **derivan identificadores distintos** — si se quiere que compartan el
mismo umbral, hay que ponerles el mismo `k.metrica` explícito a mano.

### ⚠️ Advertencia para quien agregue una métrica nueva: `dashboards_config` es un snapshot, no se re-siembra solo

`dashboards_config` se siembra **"solo si el cliente no existe todavía"**
(para no pisar ediciones de un administrador hechas desde el constructor
visual). Esto significa que si agregás `metrica: 'algo_nuevo'` a un KPI en
`dashboard-config-seed.js` o `dashboard-plantillas-cliente.js`, **ese cambio
NO llega solo** a las filas de `dashboards_config` que ya existen en una
base que lleva tiempo corriendo — incluida producción. El KPI se sigue
viendo, pero sin color, hasta que alguien lo note.

Esto pasó de verdad al construir el motor de semáforo (Fase 19,
[`PROGRESS.md`](../PROGRESS.md)): se agregó `metrica: 'nivel_atencion'` en
el código fuente, pero los dashboards ya sembrados (ORLANT, CLINICA AURORA,
HOSPITAL LA MARIA, los generados por plantilla) no lo recibieron hasta
correr un backfill explícito.

**Paso de backfill obligatorio** cada vez que se agregue o cambie un
`metrica` en un KPI que ya existe en producción: escribir una
`runOnceMigration` en `server/db.js` que lea `dashboards_config`, parsee el
JSON de `layout`, actualice los KPIs que correspondan, y vuelva a guardar el
JSON — ver `runOnceMigration('dashboards_config_metrica_nivel_atencion_v1', ...)`
en `server/db.js` como plantilla exacta a copiar (identifica los KPIs a
tocar por un criterio explícito — en ese caso, tener `semaforo` puesto y no
tener `metrica` todavía — para no pisar nada que un admin haya editado
después a propósito).

### Dónde se aplica

`_gdSemaforoColor` en `public/js/dashboard-generic.js` es el único punto que
calcula color para tarjetas KPI (reemplazó 3 implementaciones
independientes que existían antes: un semáforo binario sin amarillo, la
barra de avance de meta con corte fijo 100/80, y el promedio de Calidad con
corte fijo 90/70 — las tres ahora pasan por el mismo umbral configurable). La
misma función se reusa en `public/js/calidad.js` para el "Promedio Puntaje"
y el ranking de asesores.

---

## 4. Motor de dashboards (`dashboards_config` / `dashboard-adapters.js`)

Hay dos formas de que un "dashboard" exista, y ambas terminan renderizadas
por el mismo motor genérico (`public/js/dashboard-generic.js`, servido vía
`GET /api/dashboard/:cliente`):

### A. Dashboard de cliente (datos por carga de Excel)

Una fila en `dashboards_config` con `{ cliente, titulo, vista, secciones,
layout }`. `secciones` define las columnas que espera cada tipo de carga de
Excel (lo que valida `cargas.js`); `layout.kpis`/`layout.tabs[].panels`
define qué tarjetas y gráficas se ven y de qué fuente de datos salen (ver
`_gdResolver` en `dashboard-generic.js` para la sintaxis de una "fuente":
`{s, modo, campo|formula, filtro?}`).

**Para agregar un cliente nuevo**: o bien insertar una fila en
`dashboards_config` desde el constructor visual del panel de administración
(sin código), o agregar una entrada en `dashboard-config-seed.js` /
generarla con una de las 3 plantillas de `dashboard-plantillas-cliente.js`
(ventas, cobranza, atención) si encaja en un patrón ya existente. **Recordar
el backfill del §3** si el nuevo dashboard necesita compartir un `metrica`
con otros ya existentes.

### B. Módulo administrativo (datos de tablas propias, no de `dashboard_cargas`)

`dashboard-adapters.js` expone `GERENCIA`, `INVENTARIO` y `GESTION_HUMANA`
como "dashboards" del mismo motor, pero sus datos salen de sus propias
tablas (`gerencia_kpis`, `inventario_items`, etc.) en vez de `dashboard_cargas`.

**Contrato de un adapter** (objeto en `ADAPTERS` dentro de
`dashboard-adapters.js`):

```js
NOMBRE: {
  permiso: 'NombreDelPermiso',   // gate: can(actor, permiso) en vez del
                                  // clienteAccess() que usan los de Excel
  config: ALGO_CONFIG,           // exactamente la misma forma {cliente,
                                  // titulo, vista, secciones, layout} que
                                  // una fila de dashboards_config
  build: function(db) { ... },   // calcula "secciones" al vuelo desde las
                                  // tablas propias, en vez de leerlas de
                                  // dashboard_cargas
}
```

`GET /api/dashboard/:cliente` (`server/server.js`) revisa primero si
`cliente` está en `ADAPTERS`; si sí, usa `config`+`build(db)` y el permiso
del adapter; si no, busca la fila en `dashboards_config` y usa
`clienteAccess()` (permiso `cliente_<NOMBRE>` o `campana_<NOMBRE>`).

Como la forma de `config` es idéntica en ambos casos, **cualquier campo que
se agregue al schema genérico de KPI/panel (como `metrica` del semáforo)
aplica automáticamente a los 3 adapters también** — no hace falta tocarlos
uno por uno.

### Conexión con filtros y semáforo

El motor genérico ya trae, para todo dashboard (cliente o adapter): selector
de período (mes), "Comparar contra" (período anterior u otro elegido),
alerta por rango (`k.alerta.min/max/caidaPct`), y color por umbral (§3) —
todo esto es del motor compartido, no algo que cada dashboard implemente
por separado. Lo que **no** trae hoy de forma genérica (y quedó fuera de la
Fase 19, ver `PROGRESS.md`): rango de fechas / granularidad día-mes-año como
la de Tráfico Volvox (§5), drill-down por clic, y tooltips con comparación —
esos existen hoy solo para el panel de Tráfico.

---

## 5. Tráfico de llamadas — Volvox (`public/js/trafico-logic.js`)

Carga el export real de Volvox (hoja `DATA`) tal cual se descarga, sin
recortar ni reordenar columnas, y lo agrega en el navegador por día, mes o
año para la gráfica y los KPIs del panel `trafico_combo`.

### Mapeo de columnas por nombre, no por posición

`traficoColIndexMap` empareja cada columna esperada
(`TRAFICO_COLUMNAS` en `trafico-logic.js`) por su **nombre de encabezado**,
no por su posición en la fila — si Volvox reordena o agrega columnas al
export, el parseo sigue funcionando. Solo 4 columnas son obligatorias
(`SKILL_NAME`, `DATE`, `TOTAL LLAMADAS`, `LLAMADAS CONTESTADAS`); el resto,
si falta, la métrica correspondiente queda `null` — nunca `0` (0% es un dato
real, "no vino esa columna" es otra cosa distinta).

### Agregación día/mes/año sin promediar porcentajes

`traficoAgregar(filas, {granularidad, combinar})` es la pieza más delicada:
para las métricas que sí tienen numerador/denominador disponibles
(`nivelAtencionPct = contestadas/total`, `tasaAbandonoPct =
abandonadas/total`) **suma los volúmenes del período primero y recalcula el
% después** — nunca promedia los porcentajes diarios. Para las que Volvox ya
reporta como % o duración sin numerador propio disponible aquí
(`serviceLevel*Pct`, `abandonPct`, `asaSegundos`, etc.), se usa un promedio
**ponderado por volumen de llamadas** del período — la mejor aproximación
posible sin inventar un numerador que no existe, documentado así en el
propio código (no es un promedio simple). `combinar` es un eje ortogonal a
la granularidad: junta todas las skills en una sola serie, o las separa una
por una.

### Mapeo skill → campaña, configurable

`trafico_skill_mapeo` (tabla, §2) — una skill nueva (nunca vista) se guarda
igual al cargar el archivo, bajo la campaña centinela `(SIN ASIGNAR)`, sin
romper la carga; un administrador la reasigna después desde el panel
(`PUT /calidad/trafico/skills/:skillName`) y **sus filas ya guardadas se
reatribuyen solas** (recalcula el mensual de la campaña vieja y la nueva),
sin tener que volver a subir el archivo.

### El panel `trafico_combo`: tráfico embebido en el dashboard de cada campaña

Desde la Fase 18 (tráfico Volvox), cualquier dashboard de cliente puede
declarar un panel de tipo `trafico_combo` en su `layout.tabs[].panels`
(`dashboards_config`) — no es una pantalla aparte: es el mismo modal de
dashboard del cliente, con su propia pestaña. El panel trae de fábrica todo
el patrón de filtros ya probado (skill, rango de fechas, granularidad
día/mes/año, combinar/separar series) con estado en la URL (`?tv_...`),
export a Excel/PDF, y 5 tarjetas KPI (Total Llamadas, Contestadas,
Abandonadas, Nivel de Atención, Tasa de Abandono) coloreadas con el motor de
semáforo (§3, métricas `nivel_atencion`/`tasa_abandono`). Hoy lo usan ORLANT,
CLINICA AURORA y HOSPITAL LA MARIA — cualquier dashboard nuevo lo hereda con
solo agregar el panel a su config, sin escribir código.

**Cómo se resuelve la campaña del panel** (`_traficoCampanaPanel`,
`public/js/trafico.js`): si el panel trae `campana` fija en su config (caso
normal), se usa esa. Si no la trae **y** el dashboard tiene un selector de
`vista` (hoy solo HOSPITAL LA MARIA, con sus 2 sedes), la campaña se deriva
en caliente como `"<cliente> <valor de la vista seleccionada>"` — ej.
`"HOSPITAL LA MARIA CASTILLA"` / `"HOSPITAL LA MARIA SEDE33"`. Esto evita
inventar una columna "sede" que el export de Volvox no trae: la distinción
vive enteramente en a qué campaña se mapea cada skill.

⚠️ **Consecuencia práctica para el mapeo de skills**: para que el tráfico de
cada sede de Hospital La María llegue a su propio dashboard, el admin debe
mapear cada skill de Volvox exactamente a `HOSPITAL LA MARIA CASTILLA` o
`HOSPITAL LA MARIA SEDE33` (**nunca** a `HOSPITAL LA MARIA` sola — esa
campaña no la consume ningún panel). El desplegable de mapeo
(`renderTraficoSkills`) ya ofrece estas 2 variantes en vez de la campaña
plana, vía un pequeño registro explícito (`TRAFICO_CAMPANAS_MULTISEDE` en
`trafico.js`) — si se agrega otro dashboard con `vista` que también
necesite tráfico por sub-unidad, hay que registrarlo ahí (y su contraparte
de permisos, ver abajo).

**Permisos**: quien tiene acceso al dashboard tiene el permiso de la
campaña "padre" (`cliente_HOSPITAL LA MARIA` / `campana_HOSPITAL LA
MARIA`), no de la variante por sede — sin ajuste, el panel de tráfico
devolvería 403 aunque el resto del dashboard funcione. `campaignAccess`
(`server/auth.js`) resuelve esto con un mapeo `CAMPANA_BASE_MULTISEDE`
(la contraparte servidor del registro de arriba): si la campaña pedida es
una variante por sede conocida, también acepta el permiso de su campaña
base.

**Gotcha de snapshot, otra vez**: igual que en §3, si un dashboard con
`trafico_combo` ya existe en una base (como producción), agregar el panel
al código fuente después no le llega solo. `dashboards_config_trafico_hlm_v1`
(`server/db.js`) es el backfill para Hospital La María; si otro dashboard ya
existente necesita el panel agregado despues, seguir el mismo patrón (leer
`layout`, revisar si ya tiene un panel `trafico_combo`, si no agregarlo,
regrabar el JSON).

**Estado de filtros compartido entre dashboards distintos**: el estado de
filtros (`?tv_...`) vive en la URL de la página, no por panel — si un
usuario filtra un rango de fechas en el tráfico de un dashboard y despues
abre OTRO dashboard en la misma pestaña del navegador (sin recargar), ese
rango puede no solapar en absoluto con los datos de la nueva campaña.
`_traficoRenderPanel` lo detecta (el rango de la URL cae totalmente fuera
del rango de fechas disponible para ESTA campaña) y descarta el filtro
heredado, volviendo al rango completo de esta campaña — mismo criterio que
ya existía para el filtro de skills.

---

## 6. Carga masiva de Calidad (`/api/monitoreos/bulk`)

Antes de la Fase 19 no existía ningún camino de carga masiva para Calidad,
en ninguna campaña: los monitoreos se creaban uno por uno desde un
formulario. La primera campaña con este camino es **CARTERA INTERNA**
(cobranza).

### La plantilla de 3 hojas

Se descarga desde el panel (Calidad → campaña → pestaña "Carga Masiva
(Excel)"):

1. **Monitoreos** — la única hoja que se parsea. Columnas fijas (Asesor,
   Fecha, Canal, ID Llamada, Teléfono, Evaluador, Observaciones) + una
   columna por cada ítem de la plantilla de esa campaña (`SI`/`NO`/`N/A`).
2. **Diccionario** — de referencia: ítem, categoría, peso %, crítico. No se
   parsea.
3. **Resumen por Asesor** — de apoyo, encabezados solamente. No se parsea
   (el resumen real se calcula en el servidor a partir de `monitoreos`).

Parseo puro (sin DOM, con pruebas contra un fixture real de 3 hojas) en
[`public/js/calidad-carga-masiva-logic.js`](../public/js/calidad-carga-masiva-logic.js).

### El endpoint

`POST /api/monitoreos/bulk` (`server/server.js`) recibe `{campana,
archivoNombre, filas}` ya parseado por el navegador (el servidor nunca abre
el Excel) y reusa **el mismo motor de puntaje** que el alta individual
(`calc.computeScore`, `server/calidad-logic.js`) — el puntaje nunca lo
manda el cliente.

### Clave de idempotencia

`(campana, asesor, fecha, idLlamada)` — **solo cuando la fila trae
`idLlamada`**, que es la única clave natural disponible (un mismo asesor
puede tener legítimamente varios monitoreos el mismo día, así que no se
puede usar `(campana, asesor, fecha)` a secas). Si la fila no trae
`idLlamada`, no hay forma de deduplicar sin inventar una clave — esa fila
siempre se inserta (documentado así en el código, no es un descuido).

### Cómo agregar una campaña nueva con su propia plantilla

1. Agregar la lista de ítems (`{n, cat, label, weight, critico}`, pesos que
   sumen 100) a `server/calidad-plantillas-seed.js` y registrarla en
   `PLANTILLAS` con su `campana` y `engine` (`'standard'` para la mayoría;
   `'sura'` es un motor de puntaje alternativo usado hoy solo por
   Televentas Sura — ver `server/calidad-logic.js:computeScore`).
2. Agregar el nombre de la campaña a `CAMPANAS_CALIDAD` (`server/db.js`) y a
   `CAMPANAS_CALIDAD`/`CAMPANAS_CON_PLANTILLA` (`public/js/constants.js`).
3. Nada más — la carga masiva, el motor de puntaje, la semilla de
   `calidad_plantillas`, y el generador de datos de demo
   (`server/scripts/seed-demo-lib/calidad.js`) ya son genéricos y recorren
   la lista de campañas sin código específico por campaña.

---

## 7. API — endpoints agregados en las últimas fases

Para el resto de la API (usuarios, dashboards de cliente, permisos,
historial, etc.) ver directamente `server/server.js` — esta tabla cubre
solo lo agregado en Tráfico Volvox y Semáforo/Cartera, que no estaba
documentado en ningún lado hasta ahora.

| Endpoint | Método | Para qué | Quién puede |
|---|---|---|---|
| `/api/umbrales` | GET | Lista todos los umbrales de semáforo (global + overrides por campaña) | Cualquier actor autenticado |
| `/api/umbrales` | POST | Crea o actualiza (upsert por `metrica`+`campana`) un umbral | Solo administrador |
| `/api/umbrales/:id` | PUT | Edita un umbral existente | Solo administrador |
| `/api/umbrales/:id` | DELETE | Borra un umbral | Solo administrador |
| `/api/monitoreos/bulk` | POST | Carga masiva de monitoreos de Calidad (§6) | Rol CALIDAD/SUPERVISOR (o admin) con permiso sobre esa campaña |
| `/api/seed-demo/estado` | GET | `{activo, marcas}` — si hay datos de demostración sembrados (pinta el banner global, §9) | Cualquier actor autenticado |
| `/api/calidad/trafico/carga` | POST | Carga el export de Volvox (multi-skill, multi-mes) | Solo administrador |
| `/api/calidad/trafico/skills` | GET | Lista el mapeo skill → campaña | Solo administrador |
| `/api/calidad/trafico/skills/:skillName` | PUT | Reasigna una skill a otra campaña (reatribuye el histórico ya guardado) | Solo administrador |
| `/api/calidad/nivel-servicio/diario` | GET | Filas diarias de nivel de servicio de una campaña (el navegador agrega, ver §5) | Cualquier actor con acceso a esa campaña |

---

## 8. Despliegue y operación

Para la cuenta AWS, IP, recursos exactos y el runbook de despliegue desde
cero, ver [`AWS_DEPLOY_REPORT.md`](../AWS_DEPLOY_REPORT.md) (§14 tiene el
estado de la cuenta actual). Acá solo el **flujo operativo del día a día**:

- **Disparar un deploy**: push a `main` (directo o vía merge de PR). `ci.yml`
  corre la suite en Node 18/20/22 + build de la imagen Docker; si pasa,
  dispara `deploy.yml` automáticamente (`workflow_run`). No hay paso manual.
- **Puerto 22 durante el pipeline**: se abre y se cierra **solo dentro de
  `deploy.yml`**, automáticamente: un paso guarda el estado actual del
  firewall, abre el 22 únicamente para la IP pública del runner de GitHub
  que está corriendo ese despliegue, hace el despliegue por SSH, y un paso
  final (`if: always()`) lo revierte al estado exacto de antes — incluso si
  el despliegue falla a mitad de camino. Fuera de un despliegue, el puerto
  22 está cerrado a todo salvo la IP del operador.
- **Backups automáticos**: `systemd timer` en el host (`deploy/inconexion-backup.timer`),
  todos los días a las **03:15** hora del servidor (`RandomizedDelaySec=300`
  para no pegarle siempre al segundo exacto; `Persistent=true` recupera la
  corrida si la máquina estaba apagada a esa hora). Sube a S3 con
  versionado — retención local + política de versiones documentadas en
  `AWS_DEPLOY_REPORT.md` §5.
- **Rotar la contraseña del admin maestro sin que quede en ningún log**: el
  procedimiento ya usado (ver histórico de la migración de cuenta AWS) es
  generar la contraseña, hashearla con `server/hash-password.js`, y subir
  **solo el hash** a SSM (`/inconexion/prod/MASTER_ADMIN_PASSWORD_HASH`) con
  `aws ssm put-parameter --type SecureString`, pasando el valor por una
  variable de shell leída con `read -s` (nunca como argumento de línea de
  comandos, nunca impreso) — la contraseña en texto plano solo existe en la
  pantalla de quien la escribe, nunca en un comando, archivo o log. Después
  hay que **reiniciar el contenedor `app`** (`docker compose restart app`)
  para que relea el secreto de SSM — `bootstrap.js` solo hidrata secretos al
  arrancar, no los relee en caliente.

---

## 9. Decisiones que no son obvias mirando el código

Cosas que alguien podría "corregir" por accidente sin este contexto:

- **El banner de "datos de demostración" es global, no por campaña** — aunque
  Cartera ya tenga datos reales y las otras 11 campañas sigan en demo, el
  banner sale en toda la app por igual. No es un descuido: hacerlo por
  campaña exige agregar columnas de alcance a `seed_demo_marcas` (hoy no
  tiene ninguna) y reescribir `GET /api/seed-demo/estado` con un filtro por
  cliente/campaña en cada dashboard que lo consulte — un cambio de schema
  real, no un ajuste de lectura. La decisión fue quedarse con la opción
  global mientras solo una campaña tenga datos reales, para no arriesgar
  que alguien vea un dashboard sin el aviso y asuma que es real cuando no
  lo es (o al revés). Ver README §13 para el detalle completo.
- **Excel no pinta el color de las celdas del semáforo, PDF sí** — la
  librería de Excel que usa la app en el navegador es la build gratuita de
  SheetJS (`xlsx.full.min.js` vía `cdnjs`), que **no soporta estilos de
  celda** (relleno de color) — es una limitación de la librería, no algo que
  falte implementar. La exportación a Excel sí incluye el color como una
  columna de texto (`Semaforo`: VERDE/AMARILLO/ROJO) para no perder el dato.
  La exportación a PDF es HTML + `window.print()`, así que ahí sí se puede
  (y se hace) pintar el texto con el color real.
- **`dashboards_config` no se re-siembra solo al cambiar el código fuente**
  — ver la advertencia completa en §3. Es la causa más probable de que "un
  cambio que ya está en el código no se vea en producción" para cualquier
  campo nuevo agregado a un KPI/panel de un dashboard que ya existía.
- **La carga masiva de Calidad no es idempotente sin `idLlamada`** (§6) — a
  propósito, no por limitación técnica: no hay una clave natural sin ese
  campo, y asumir una (ej. `campana+asesor+fecha`) rompería el caso legítimo
  de varios monitoreos el mismo día.
- **`calidad_nivel_servicio_diario` se extendió en vez de crear una tabla
  nueva para Volvox** (§2, §5) — ya compartía la llave natural
  (campaña+fecha+skill) y el flujo de recálculo mensual con la carga simple
  anterior; las columnas nuevas se agregaron por migración (`ALTER TABLE`),
  nunca directo en el `CREATE TABLE`, para que funcione igual en una base
  nueva o en una que ya tenía filas.
- **Los adapters (`GERENCIA`/`INVENTARIO`/`GESTION_HUMANA`) no son
  dashboards "de verdad" en `dashboards_config`** (§4) — son código
  (`dashboard-adapters.js`) que imita la misma forma de config para
  reutilizar el motor genérico, pero sus datos nunca pasan por
  `dashboard_cargas` ni por el flujo de carga de Excel de un cliente normal.
- **Mapear un skill de una sede de Hospital La María a la campaña "HOSPITAL
  LA MARIA" (sin sufijo) no rompe nada visiblemente, pero tampoco llega a
  ningún dashboard** (§5) — el panel de tráfico de ese dashboard siempre
  pide la variante por sede (`HOSPITAL LA MARIA CASTILLA`/`SEDE33`); la
  campaña sola queda huérfana. Fácil de mapear "mal" sin que nada avise en
  el momento, salvo que el admin no vea datos donde esperaba verlos.
- **Un filtro de fecha aplicado al tráfico de un dashboard puede parecer
  "perdido" al abrir el tráfico de otro dashboard en la misma pestaña del
  navegador** (§5) — no es un bug de mezcla de datos (cada campaña sigue
  viendo solo lo suyo), es que el estado de filtros vive en la URL de la
  página, compartido por cualquier panel `trafico_combo`; el motor lo
  detecta y descarta el filtro heredado si no aplica a la campaña nueva.
