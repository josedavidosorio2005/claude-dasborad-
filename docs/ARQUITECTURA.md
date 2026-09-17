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
                             el host, fuera del contenedor — ver §10 abajo)
 GitHub Actions           ── push a main -> CI corre la suite -> si pasa,
   (deploy.yml)               deploy.yml construye la imagen, la sube a ECR,
                               abre el puerto 22 solo para el runner, hace
                               `docker compose pull && up -d` por SSH, y
                               vuelve a cerrar el puerto 22
```

Quién habla con quién en tiempo de ejecución: el navegador nunca toca SQLite
ni SSM directamente — todo pasa por la API REST (`server/server.js` monta
un `express.Router()` por dominio desde `server/routes/*.js`, ver abajo),
que es la única pieza que conoce las tablas y los secretos.

### Routers por dominio (`server/routes/`, 2026-09-17)

`server/server.js` dejó de tener las ~75 rutas de la API en un solo archivo
(llegó a 2534 líneas). Ahora solo hace el setup de la app (seguridad, CORS,
rate limiting, estático) y monta un `express.Router()` por dominio, en el
mismo orden en que esas rutas vivían en el monolito:

`auth → usuarios → calidad → umbrales → trafico → dashboards → inventario
→ gerencia → gestion-humana → historial`

El orden importa en un solo caso: el router de `calidad` tiene un
middleware de no-cache con el prefijo `/calidad`, que también cubre las
rutas `/calidad/trafico/*` del router de `trafico` — por eso `calidad` se
monta antes. Ningún otro par de routers comparte prefijo. `server/routes/shared.js`
tiene el plumbing común a varios dominios (`wrap`, `logEvent`, `actorLabel`,
`toPublicUser`, credenciales del admin maestro) — todo lo demás (helpers de
formato de fila, checks de acceso específicos) vive junto a las rutas que
lo usan, igual que antes.

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
| `seed_demo_marcas` | Ledger de qué filas sembró `scripts/seed-demo.js` (para poder borrar exactamente eso con `seed:demo:limpiar`). También es lo que enciende/apaga el banner global de "datos de demostración" — ver §11. |
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

### Red de seguridad (decisión 2026-09-16): detector automático de solo lectura, NO backfill automático

Al investigar el reporte de InCo "los datos subidos no se ven en el
dashboard" (2026-09-16), se evaluó explícitamente si vale la pena construir
un mecanismo que reescriba `dashboards_config` solo cuando el código agrega
un campo/KPI nuevo, en vez de depender de que alguien note el hueco y corra
el backfill manual de arriba. **Decisión: no** — un backfill automático que
reescribe el `layout`/`secciones` guardado es peligroso porque esa misma
fila también guarda ediciones manuales hechas por un administrador desde el
constructor visual de dashboards (de hecho, la causa real del reporte de
InCo fue justo un administrador editando esa configuración — ver el bug de
`DELETE /dashboards/config/:cliente` más abajo, no este gotcha de snapshot).
Un script que "corrige" el JSON por su cuenta podría pisar en silencio una
personalización intencional del admin.

En su lugar se agregó `server/scripts/verificar-consistencia-dashboards.js`:
un detector permanente, de solo lectura, que compara los `campo` que usan
los KPIs/paneles de cada dashboard contra las columnas realmente guardadas
en sus secciones y reporta cualquier desalineación (sin tocar nada). Se
puede correr a mano (`node scripts/verificar-consistencia-dashboards.js`,
código de salida 1 si encuentra problemas) o contra producción vía el
workflow `Diagnostico - datos subidos no se ven en el dashboard
(produccion)` (`workflow_dispatch`, sin escribir nada). **Correr este
detector es responsabilidad manual** cada vez que se agregue/renombre un
`campo` de KPI en el código fuente — el detector avisa del problema, pero
sigue siendo el backfill de `runOnceMigration` (arriba) quien lo corrige.

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

### ⚠️ Bug real corregido (2026-09-16): borrar la configuración NUNCA debe borrar los datos ya cargados

`dashboards_config` (la configuración: KPIs, secciones, layout) y
`dashboard_cargas` (los Excel ya subidos) son dos ciclos de vida
**independientes** — el segundo no depende del `id` del primero, solo
comparte el string `cliente`. Hasta el 2026-09-16, `DELETE
/api/dashboards/config/:cliente` violaba esto: además de borrar la fila de
config, también corría `DELETE FROM dashboard_cargas WHERE cliente = ?`,
destruyendo en cascada **todo** el histórico de Excel de ese cliente.

Esto le pasó de verdad a InCo: un administrador borró y volvió a crear la
configuración del dashboard de ORLANT (para ajustar KPIs desde el
constructor visual) y, sin querer, se llevó por delante una carga real de
Gestión de base del periodo "2026-01" que InCo acababa de subir minutos
antes por la plantilla consolidada — de ahí el reporte "subí los datos y no
los veo en el dashboard" (el diagnóstico inicial sospechó del gotcha de
snapshot del §3, pero un chequeo generalizado a las 12 campañas no encontró
ningún desalineamiento de ese tipo; la causa real se confirmó leyendo la
tabla `historial`, que mostraba los eventos `DASHBOARD_CONFIG_DEL` justo
antes y después del `DASHBOARD_CARGA`/`MONITOREO_BULK` real de InCo).

**Fix**: `DELETE /api/dashboards/config/:cliente` ya no toca
`dashboard_cargas`. Borrar (o editar) la configuración de un dashboard
nunca borra los Excel ya cargados; si se vuelve a crear el dashboard para
el mismo `cliente` (a mano o por el auto-sembrado "solo si no existe" de
`dashboard-config-seed.js`), esas cargas se ven de inmediato sin volver a
subir nada. Importante: **este fix no recupera datos ya destruidos por el
bug antes de corregirlo** — la carga real de ORLANT "2026-01" que InCo
subió y se perdió el 2026-09-16 no se restauró automáticamente por este
cambio (arreglar el código solo evita que el problema se repita); para
recuperarla, lo más simple es que InCo vuelva a subir ese mismo periodo por
la plantilla consolidada, que ya funciona de punta a punta.

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

`GET /api/dashboard/:cliente` (`server/routes/dashboards.js`) revisa primero si
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

### Plantilla oficial de carga (decisión 2026-09-15: una sola, para todas las campañas)

> ⚠️ **Vigencia (actualizado 2026-09-16, PR #32):** el botón individual
> "Descargar plantilla" que exponía este archivo se **retiró de la
> interfaz** — la hoja "DATA" descrita aquí abajo ahora se descarga como
> parte de la **plantilla consolidada** de cualquier campaña (§7). Todo lo
> que sigue en esta sección (estructura de columnas, `TRAFICO_COLUMNAS`,
> por qué es un archivo estático) sigue siendo la fuente de verdad de esa
> hoja — el archivo no se borró ni cambió, solo dejó de tener su propio
> botón de descarga. El endpoint `GET /calidad/trafico/plantilla` y el test
> `plantilla-trafico.test.js` tampoco se tocaron (nada los referencia desde
> la interfaz, pero conservarlos no cuesta nada).

`server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx` es el **archivo
real** que el cliente revisó y aprobó — el sistema lo sirve tal cual
(`GET /calidad/trafico/plantilla`, `res.download`), **nunca lo regenera con
código**, para que la copia publicada no pueda desviarse de la que el
cliente ya tiene. Vive fuera de `public/` (que Express sirve estático sin
autenticación) precisamente para que la descarga exija `canLoadData`, igual
que cargar la base — no es un archivo público por URL directa. Es **una
plantilla única** con nombres de columna fijos (los mismos 15 de
`TRAFICO_COLUMNAS` más `MES`/`AÑO` informativas): no hay una plantilla por
campaña, la campaña de cada fila la decide el mapeo de skill de siempre
(arriba), nunca el archivo. Se descartó a propósito el enfoque de reconocer
alias de nombres de columna nativos de Wolkvox — la plantilla ya usa
exactamente los nombres que `traficoColIndexMap` espera, así que no hace
falta ninguna traducción en el código. Verificado con un test que toma el
archivo real publicado, le agrega filas de prueba respetando los formatos
de su propia hoja INSTRUCCIONES, y confirma que pasa la carga real sin
ningún aviso (`server/tests/plantilla-trafico.test.js`). La hoja "DATA" de
la plantilla consolidada (§7) reusa exactamente estos mismos 17 nombres de
columna — `cargas.js` los toma de `TRAFICO_COLUMNAS` en vivo, nunca los
duplica a mano.

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
normal), se usa esa. Si no la trae, es siempre el cliente del dashboard tal
cual — **nunca** una variante distinta por sede (ver el aviso de
consolidación justo abajo: eso cambió el 2026-09-15).

⚠️ **Consolidación de sede (2026-09-15, auditoría contra el pedido de
Edwin — módulo "Flujo de Llamadas"): la sede es un atributo del dato, NO una
campaña distinta.** Antes de esta fecha, Hospital La María (la única
campaña multi-sede hoy) usaba un atajo: el tráfico Volvox fabricaba 2
campañas falsas, `"HOSPITAL LA MARIA CASTILLA"` / `"HOSPITAL LA MARIA
SEDE33"`, y `auth.js` necesitaba un mapeo especial (`CAMPANA_BASE_MULTISEDE`)
solo para que el permiso de la campaña real diera acceso a esas variantes.
Eso era inconsistente con cómo el propio dashboard operativo (los datos de
Excel de `dashboard_cargas`) ya trataba la sede desde antes: como un campo
`sede` en cada fila, filtrable por `dashboards_config.vista`, con UNA sola
campaña. La migración `hlm_sede_consolidacion_v1` (`server/db.js`) llevó el
tráfico Volvox al mismo patrón:

- `calidad_nivel_servicio_diario` y `calidad_nivel_servicio` (el agregado
  mensual) ganaron una columna `sede` (nullable — `NULL` para el resto de
  campañas, que no tienen sedes). El agregado mensual **recalcula siempre
  filtrando también por sede** (`recalcularMensual(db, campana, mes, now,
  sede)`, `server/nivel-servicio-diario.js`) para que 2 sedes de una misma
  campaña nunca se sumen ni se pisen en un mismo mes — punto crítico: la
  `UNIQUE(campana, mes)` original de `calidad_nivel_servicio` pasó a
  `UNIQUE(campana, mes, sede)`, y como SQL nunca trata 2 `NULL` como
  iguales, cualquier código que compare por `(campana, mes)` sin filtrar
  también por `sede IS ?` puede pisar la fila equivocada — ver el mismo
  gotcha que esto le causó a la pantalla manual de Nivel de Servicio
  (`POST`/`PUT /calidad/nivel-servicio`, que dejó de detectar duplicados por
  el mismo motivo hasta que se le agregó el filtro `sede IS NULL` explícito).
- `trafico_skill_mapeo` ganó una columna `sede`: el mapeo de una skill sigue
  siendo a UNA campaña (`PUT /calidad/trafico/skills/:skillName`), más una
  sede opcional cuando la campaña es multi-sede — nunca una campaña
  distinta por sede. `TRAFICO_CAMPANAS_MULTISEDE` (`trafico.js`) sigue
  siendo el registro de qué campañas tienen sedes y sus códigos (hoy
  `CASTILLA`/`SEDE33`, los MISMOS que usa `dashboards_config.vista` para
  Hospital La María — sin tabla de traducción entre los dos), pero ahora
  puebla un segundo `<select>` de sede en el panel de mapeo, no una lista de
  campañas falsas.
- El panel `trafico_combo` (`_traficoRenderPanel`) carga TODO el tráfico de
  la campaña real de una sola vez (`_traficoCargarDatos`, cacheado por
  campaña) y filtra client-side por sede (`_traficoSedePanel()`, que lee
  `_gd.vistaSel`) — un solo fetch por campaña, sin importar cuántas sedes
  tenga.
- `auth.js`: `CAMPANA_BASE_MULTISEDE` se eliminó por completo —
  `campaignAccess` vuelve a ser una sola comprobación directa. **Decisión de
  permisos, documentada en el propio código**: quien tiene acceso a
  `HOSPITAL LA MARIA` ve AMBAS sedes; el filtro de sede en el dashboard es
  solo de visualización, nunca una frontera de permisos (consistente con que
  ningún otro módulo de esta plataforma tiene permisos con esa granularidad,
  y con que el dashboard operativo ya trataba a Hospital La María como un
  solo dashboard desde antes).
- Migración verificada con un test dedicado
  (`server/tests/hlm-sede-migracion.test.js`) que siembra el esquema y los
  datos exactamente como estaban en producción ANTES de este cambio (2
  campañas falsas) y confirma que, tras requerir `db.js`, los mismos números
  siguen ahí bajo `HOSPITAL LA MARIA` + su `sede`, sin mezclarse entre
  sedes.
- `monitoreos` (Calidad) también ganó una columna `sede` (nullable) para
  cuando exista una plantilla de Calidad para Hospital La María — hoy NO
  existe ninguna (`calidad-plantillas-seed.js` no tiene una entrada para esa
  campaña, verificado, no asumido), así que no hay ningún dato de Calidad
  real que reetiquetar todavía. La columna queda lista para cuando esa
  plantilla se cree.

**Gotcha de snapshot, otra vez**: igual que en §3, si un dashboard con
`trafico_combo` ya existe en una base (como producción), agregar el panel
al código fuente después no le llega solo. `dashboards_config_trafico_hlm_v1`
(`server/db.js`) es el backfill para Hospital La María; si otro dashboard ya
existente necesita el panel agregado despues, seguir el mismo patrón (leer
`layout`, revisar si ya tiene un panel `trafico_combo`, si no agregarlo,
regrabar el JSON).

### Punto 10 (auditoría Edwin): nunca confiar en una fila TOTAL/resumen

`traficoParseFilas` descarta (con aviso, no error fatal) cualquier fila cuyo
`SKILL_NAME` coincida por palabra completa con un patrón de fila
resumen/cierre (`TOTAL`, `TOTALES`, `TOTAL GENERAL`, `GRAN TOTAL` —
`TRAFICO_SKILL_TOTAL_RE`), aunque esa fila traiga una fecha válida (el caso
que de verdad importa: una fila con fecha inválida ya se descartaba antes
por esa razón). Coincidencia por palabra completa, no por substring, para no
descartar por error una skill real que solo contenga "total" como parte de
un nombre más largo (ej. "SKILL TOTALIZADORA" se conserva).

### Puntos 11/12 (auditoría Edwin) y control de cargas por período

Cargar/editar el mapeo de skills, y ver/usar el control de cargas de abajo,
exige `canLoadData(actor)` (`server/auth.js`) — el mismo permiso "Cargar
Datos" que ya gobierna el resto de la sección administrativa de cargas
(`dashboard_cargas`, Nivel de Servicio manual), nunca accesible a un rol de
dashboard normal (`CLIENTES_DASH`/`CALIDAD`/`SUPERVISOR` sin ese permiso
otorgado a mano). **Decisión explícita** (antes de esta auditoría, estas
rutas exigían `isFullAdmin` a secas, más estricto que el resto de la
sección): se cambió a `canLoadData` para que un `AUX_ADMIN` con el permiso
"Cargar Datos" otorgado por un administrador también pueda — el escenario
que describe el pedido de Edwin ("Admin/AUX_ADMIN o el rol equivalente de
supervisor").

**Control de cargas por período** (`GET /calidad/trafico/cobertura`,
`public/js/trafico.js: renderTraficoCobertura`): tabla administrativa (misma
sección que la carga, mismo permiso) que muestra, por skill, qué meses ya
tienen tráfico cargado — calculado con un `GROUP BY` sobre las fechas que YA
existen en `calidad_nivel_servicio_diario`, nunca una tabla de "estado"
aparte que haya que mantener sincronizada a mano. Antes de guardar una carga
nueva, el frontend llama `POST /calidad/trafico/carga/impacto` (no escribe
nada: solo cuenta, por `(skillName, mes)` del archivo recién parseado,
cuántas filas ya existen hoy) y si hay alguna, exige confirmación explícita
mostrando cuántos registros se van a reemplazar antes de llamar al guardado
real — nunca sobrescribe un mes ya cargado en silencio.

### Punto 9 (auditoría Edwin): agregar una fuente/plantilla nueva sin reconstruir todo

El diseño actual NO obliga a una sola fuente de datos por campaña. Cada
`dashboards_config.layout` es JSON libre por cliente: agregar una fuente
nueva (ej. AHT de WhatsApp desde otro archivo, cuando llegue esa fase) es
agregar una nueva `seccion` (`dashboard-secciones.js`, con sus propias
columnas) + los paneles que la consuman en `layout.tabs`, sin tocar las
fuentes existentes de esa misma campaña ni las de ninguna otra. El patrón
`trafico_combo` (arriba) es un ejemplo de exactamente eso: se agregó como un
panel más, con su propia tabla (`calidad_nivel_servicio_diario`) y su propio
endpoint de carga, sin modificar ni una línea de las secciones operativas ya
existentes de esa misma campaña. Documentado aquí para que no sea una
sorpresa cuando llegue esa fase — no se implementó nada nuevo para esto en
esta ronda (no fue pedido; el pedido de esta fase era solo confirmar que el
diseño ya lo permite).

**Estado de filtros compartido entre dashboards distintos**: el estado de
filtros (`?tv_...`) vive en la URL de la página, no por panel — si un
usuario filtra un rango de fechas en el tráfico de un dashboard y despues
abre OTRO dashboard en la misma pestaña del navegador (sin recargar), ese
rango puede no solapar en absoluto con los datos de la nueva campaña.
`_traficoRenderPanel` lo detecta (el rango de la URL cae totalmente fuera
del rango de fechas disponible para ESTA campaña) y descarta el filtro
heredado, volviendo al **default** de esta campaña — mismo criterio que ya
existía para el filtro de skills. Ver el punto siguiente para qué es
exactamente ese "default".

### Ventana móvil de 12 meses (llamada con Edwin, 2026-09-15)

El valor **por defecto** de "Desde" del panel — cuando el usuario no eligió
nada, ni en esta carga de página ni antes vía "Aplicar filtros" — nunca es
el inicio de todo el histórico: son los **últimos 12 meses calendario con
datos**. Pedido explícito del cliente: "cuando lleguemos a enero de 2027, se
debe quitar enero de 2026" — no un reinicio por año calendario, una ventana
que se corre sola a medida que llega un mes nuevo. `traficoVentana12Meses(maxDispFecha,
minDispFecha)` (`trafico-logic.js`, pura y testeada) calcula el primer día
del mes que abre esa ventana; si hay menos de 12 meses de historia real,
nunca retrocede antes del primer dato (`minDispFecha`).

**El filtro "Desde"/"Hasta" sigue siendo el mecanismo explícito de siempre**
(no se agregó ningún selector de año nuevo — no hacía falta, esos campos ya
permiten elegir cualquier período, incluido uno anterior a la ventana de 12
meses): en cuanto el usuario los usa (o la URL ya trae `tv_desde`/`tv_hasta`,
ej. de un enlace compartido), esa elección explícita manda sobre el default
y NO se recalcula sola — la ventana móvil solo aplica mientras no haya
ninguna elección explícita en curso.

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

`POST /api/monitoreos/bulk` (`server/routes/calidad.js`) recibe `{campana,
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

## 7. Plantilla consolidada de carga — una sola por campaña (2026-09-16)

Antes de esta fase, una campaña con dashboard podía tener hasta 3 botones de
carga por Excel separados y en pantallas distintas: Gestión de base (esta
pantalla, `cargas.js`), Calidad (su propio módulo, pestaña "Carga Masiva") y
Tráfico (su propia pantalla de administración). Pedido de negocio: que se
sienta como **una sola plantilla por campaña** — un botón "Descargar
plantilla", un `.xlsx`, un botón "Elegir archivo".

**Decisión ya tomada, no reabrir**: nunca aplanar todo en una tabla única con
la unión de columnas de los 3 tipos de dato — mezclaría filas de naturaleza
distinta (una llamada no es un monitoreo de Calidad ni un resumen de KPI) y
produciría datos mal interpretados. La solución es **un archivo, una hoja
por tipo de dato**, dentro del mismo `.xlsx`.

### Inventario (Paso 1 — verificado contra el código, no asumido)

| Tipo de dato | Estructura | Dónde vive el parseo/validación |
|---|---|---|
| Gestión de base (KPIs/resumen mensual + secciones propias de cada cliente) | **Variable por campaña** — cada `dashboards_config.secciones` define sus propias columnas (de 3 a 7 secciones según el cliente) | `cargas-logic.js` (`cargasParseFilaUnica`/`cargasParseMultiFila`), spec en `dashboard-secciones.js` / `dashboard-plantillas-cliente.js`, guardado vía `POST /dashboard/cargas` |
| Calidad (Monitoreos, ítems ponderados) | **Variable por campaña** — el diccionario de ítems/pesos cambia (`calidad_plantillas.items`); columnas fijas (Asesor/Fecha/Canal/...) + 1 columna por ítem | `calidad-carga-masiva-logic.js` (`cmParseRows`), plantilla en `calidad-plantillas-seed.js`, guardado vía `POST /monitoreos/bulk` |
| Tráfico de llamadas (Volvox, hoja DATA) | **Universal** — mismas 15 columnas para cualquier campaña; la campaña de cada fila la decide el mapeo de skill (§5), nunca el archivo | `trafico-logic.js` (`traficoParseFilas`), guardado vía `POST /calidad/trafico/carga` |
| Nivel de Servicio Diario (NSD, `metas.js`) | Universal — lee la MISMA hoja "DATA" que Tráfico, pero solo extrae `SERVICE_LEVEL_20SEC` (subconjunto estrecho, sin desglose por skill-mapeo) | `metas.js` (`_nsdParseRows`), guardado vía `POST /calidad/nivel-servicio/diario` |
| "Cartera" (formato propio) | **No existe tal formato** — `CARTERA INTERNA` es una campaña de Calidad normal, con su propio diccionario de ítems (`ITEMS_CARTERA`) igual que las otras 9; fue la primera en usar la carga masiva de Calidad, nada más | (mismo que Calidad arriba) |

**Nota sobre NSD**: se decidió **no** tocarlo en esta fase. Todo lo que NSD
lee ya lo cubre la hoja de Tráfico (misma hoja "DATA", mismas columnas,
Tráfico además hace el enrutamiento por skill que NSD no hace) — es
funcionalmente una herramienta más angosta y anterior a la integración con
Volvox. Se documenta aquí como redundancia conocida; retirarlo es una
decisión de negocio aparte (no se apagó una función en producción sin que
alguien lo pidiera explícitamente).

### Qué tipo de dato aplica hoy a cada campaña con dashboard (12)

| Campaña | Gestión de base | Calidad | Tráfico (panel hoy) |
|---|---|---|---|
| TELEVENTAS SURA | resumen, diario, tipificación, asesores | Sí (`engine:'sura'`) | Sí |
| TELEVENTAS COMFAMA | resumen, diario, tipificación, asesores | Sí | Sí |
| PANTERA MAIKERS | resumen, diario, tipificación, asesores | **No** (no está en `CAMPANAS_CALIDAD`) | No |
| ANDRES YEPES | resumen, diario, tipificación, asesores | Sí (genérica) | Sí |
| MOVILIZE | resumen, diario, tipificación, asesores | Sí (genérica) | Sí |
| ALBERTO LINERO GO | resumen, diario, tipificación, asesores | **No** | No |
| INFONDO (cobranza) | resumen, diario, tipificación, asesores | Sí | Sí |
| SASCHA FITNESS (atención) | resumen, diario, tipificación | Sí (genérica) | Sí |
| BIVETT (atención) | resumen, diario, tipificación | Sí (genérica) | Sí |
| ORLANT | resumen, salida, tipificación, sta_categorias | Sí | Sí |
| CLINICA AURORA | resumen, llamadas, salida, agendas, tipificación, agendas_categorias, sábados | Sí | Sí |
| HOSPITAL LA MARIA | resumen, día, tipificación, demanda, entidades (multi-sede) | Módulo visible, **sin plantilla todavía** | Sí (multi-sede) |

Fuera de esta tabla (Calidad-only, **sin dashboard**, por lo tanto sin
pantalla de Cargas donde vivir): `CARTERA INTERNA` y `CONSULTORIO JULIAN
MOLANO`. Conservan su pestaña de Calidad "Carga Masiva (Excel)" tal cual,
sin cambios — no hay otro tipo de dato que consolidar con ellas.

### Diseño (Paso 2) — qué hoja entra y por qué

- **Tráfico se incluye SIEMPRE**, en las 12 campañas, tengan o no panel
  `trafico_combo` activado hoy. Razón: el mapeo skill→campaña (§5) es
  independiente de `dashboards_config` — cualquier campaña puede recibir
  filas de tráfico ya hoy, activar el panel después es solo agregar una
  entrada a `layout.tabs`, sin tocar datos. Incluir la hoja no cuesta nada
  (columnas fijas, no dependen de la campaña) y evita que alguien tenga que
  volver a esta decisión cuando active tráfico para Alberto Linero Go o
  Pantera Maikers.
- **Calidad se incluye solo si la campaña YA tiene una fila en
  `calidad_plantillas`** (10 de 12 hoy) — se calcula en caliente
  (`GET /calidad/plantillas`), nunca hace falta tocar código cuando alguien
  cree la plantilla de Hospital La María: la hoja aparece sola la próxima
  vez que se descargue. Para Pantera Maikers y Alberto Linero Go (ni
  siquiera están en `CAMPANAS_CALIDAD`) nunca se incluye — a diferencia de
  Hospital La María, aquí no es "todavía no", es que Calidad no aplica a
  ese tipo de campaña.
- **NSD queda fuera** (ver inventario arriba).
- **Hoja `INSTRUCCIONES`** al inicio, con el mismo contenido/estructura que
  ya usaba la plantilla oficial de Tráfico (cómo se usa, columnas
  obligatorias/opcionales por hoja, formatos de fecha/%) — **sin el color de
  fondo** que sí tiene esa plantilla: verificado (no asumido) que
  `xlsx.full.min.js` (SheetJS build gratuita, la única que carga esta app)
  no escribe estilos de celda al generar un archivo — por eso la plantilla
  de Tráfico es un archivo *estático* aprobado por el cliente y nunca
  regenerado por código (§5), mientras que la consolidada SÍ se genera al
  vuelo por campaña (columnas de Calidad/Gestión de base variables) y por lo
  tanto no puede llevar color. Mismo límite ya documentado en §11
  ("Excel no pinta el color de las celdas del semáforo"). El
  obligatoria/opcional se resuelve con texto explícito en `INSTRUCCIONES` en
  su lugar.

### Backend (Paso 3) — sin rutas nuevas

**No se reescribió el parseo/validación de ningún tipo de dato.** Lo único
nuevo es la capa de arriba, toda en el navegador (`cargas-logic.js` +
`cargas.js`, igual que todo lo demás de esta pantalla — "el servidor nunca
abre el Excel"):

1. `cargasPlanConsolidado(secciones, calidadCols, traficoCols)` decide qué
   hojas le tocan a la campaña seleccionada (regla de arriba).
2. Al subir el archivo, `procesarArchivoConsolidado` busca cada hoja del
   plan por **nombre exacto** (`DATA`, `Monitoreos`, o la `key` de la
   sección — nunca por posición) y la pasa a `cargasProcesarHoja`, que:
   - si la hoja no existe en el archivo, o existe pero no tiene filas de
     datos (`cargasHojaVacia`) → **no es un error**, se omite ("no aplica
     esta vez");
   - si tiene una celda de fórmula sin calcular → reusa
     `cargasDetectarFormulaSinValor` (PR #31), ahora aplicada a **cualquier**
     hoja del archivo, no solo a Gestión de base → se rechaza **solo esa
     hoja**;
   - si no pasa el parser propio de su tipo (`cargasParseFilaUnica`/
     `cargasParseMultiFila`, `cmParseRows`, `traficoParseFilas`) → se
     rechaza **solo esa hoja**, con el mensaje exacto de ese parser.
3. Al guardar, cada hoja con datos válidos se manda a la ruta que YA
   procesaba ese tipo de dato (`POST /dashboard/cargas` por sección,
   `POST /monitoreos/bulk`, `POST /calidad/trafico/carga`), una llamada
   independiente por hoja — si una falla (ej. 403 porque el usuario no
   tiene permiso de evaluar Calidad en esa campaña, o un 409 porque ya
   existe una carga para ese período), las demás hojas se guardan igual; el
   resumen final lista qué hoja se guardó y cuál no, y por qué.

### Botones retirados (Paso 4)

- **Tráfico** (`public/index.html`, pantalla de administración): se retiró
  el botón "Descargar plantilla" y `descargarPlantillaTrafico()`
  (`trafico.js`) — la hoja "DATA" ahora se obtiene desde la plantilla
  consolidada de cualquier campaña. El endpoint `GET
  /calidad/trafico/plantilla` y el archivo `server/plantillas/
  PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx` **no se borraron** (nada más los
  referencia, pero seguir sirviendo el archivo original aprobado por el
  cliente por si hace falta no tiene costo). El input "Elegir archivo" y el
  mapeo de skills/cobertura de esa pantalla **se conservan intactos**: no
  son "una plantilla individual", son la vía de carga masiva multi-skill/
  multi-campaña de un solo export de Wolkvox — que sigue funcionando igual
  reciba el archivo por aquí o dentro de un consolidado (la hoja "DATA" se
  procesa exactamente igual sin importar de qué descarga salió).
- **Calidad** (`calidad.js`): la pestaña "Carga Masiva (Excel)" se oculta
  (`_calActualizarTabCarga`) para las campañas que ya tienen dashboard (10
  de 12 con plantilla) — usan la consolidada. Para `CARTERA INTERNA` y
  `CONSULTORIO JULIAN MOLANO` (sin dashboard, sin pantalla de Cargas donde
  consolidar) la pestaña sigue exactamente igual que antes.

### QA end-to-end (2026-09-16) — las 12 campañas, en navegador real

Antes de mergear, se verificó con Chrome real (no solo `node:test`) que la
plantilla consolidada **descarga, se llena, se sube y se guarda
correctamente en las 12 campañas con dashboard** (no solo en 2 de muestra):
para cada una se descargó la plantilla, se confirmaron sus hojas exactas
contra el inventario de arriba, se llenó con datos ficticios respetando el
formato de cada columna, se subió, y se confirmó que la vista previa y el
guardado final muestran los datos correctos. Dos caminos de error
probados en campañas distintas (fórmula sin calcular en ORLANT, columna
obligatoria ausente en TELEVENTAS COMFAMA) confirmaron que se rechaza
**solo** la hoja mala sin bloquear las demás. No apareció ningún bug real
de producto en esta ronda.

**Verificado también contra producción real** (mecanismo del PR #26 —
usuario temporal insertado directo en la base de datos del contenedor,
nunca la contraseña maestra, borrado de inmediato junto con los datos de
prueba que crea — ver `.github/workflows/verificacion-plantilla-produccion.yml`):
ALBERTO LINERO GO (caso mínimo) y ORLANT (caso completo, con el mismo
camino de error de fórmula sin calcular) pasaron limpio. Un hallazgo real
de esa corrida: el `dashboards_config` de ORLANT en producción resultó
tener **solo la sección "resumen" con una única métrica** — más viejo que
la definición de 4 secciones/23 métricas que trae el código fuente hoy
(el gotcha de "`dashboards_config` es un snapshot" de §3, confirmado en
vivo). No es un bug de este mecanismo; es la razón exacta por la que la
plantilla consolidada **lee la config viva de cada campaña en vez de
asumir una estructura fija** — cualquier campaña con un snapshot más
viejo (o más nuevo) recibe automáticamente la plantilla que le
corresponde de verdad, sin tocar código.

**Segunda ronda (2026-09-16, tras el fix de la cascada de borrado del §4)**:
el mismo workflow se extendió para, después de guardar cada carga de
prueba, **abrir también el dashboard real** (`openGenericDashboard`, no
solo la pantalla de carga) y confirmar que el periodo y los valores recién
subidos aparecen ahí — el chequeo que faltaba y que el reporte de InCo
("subí los datos y no los veo en el dashboard") pedía verificar
explícitamente. Corrida real contra producción tras el deploy del fix:
ALBERTO LINERO GO mostró sus KPIs (`111` en "Base asignada", etc.) para el
periodo `May-27`, y ORLANT mostró los suyos (`222` en "Total Agendas", `85%`
en los KPIs de nivel de atención) para el mismo periodo — capturas en
`docs/capturas-demo/produccion-alberto-linero-go-dashboard-tras-carga.png`
y `docs/capturas-demo/produccion-orlant-dashboard-tras-carga.png`.

---

## 8. Previsualización y filtros/colores de dashboard (2026-09-16)

### Botón "Previsualizar" en el listado de dashboards

`public/js/dashboards-admin.js` (`renderDashboardsSection`) agrega un tercer
botón, antes de Editar/Eliminar, que llama `openGenericDashboard(cliente)`
**tal cual** — la misma función que abre el dashboard real de cualquier
cliente (`dashboard-generic.js`). Cero lógica de render nueva: lo que se ve
al previsualizar es exactamente lo que vería un usuario real con acceso a
esa campaña, con sus datos reales (nunca una maqueta). Esto es distinto de
`previewDashCfg()` (botón "Previsualizar" que ya existía DENTRO del
constructor visual): ese muestra la configuración **en memoria** del
formulario, aún sin guardar, vía `openGenericDashboardPreview()`; el botón
nuevo del listado siempre muestra la versión **ya guardada** en la base.

Sobre permisos: toda la pantalla "Dashboards de Cliente" (menú +
`GET/POST/PUT/DELETE /api/dashboards/config*`) ya era exclusiva de
`isFullAdmin` (ADMIN o master admin) antes de este cambio — no existe un
rol que vea el listado sin poder editar/borrar. El botón nuevo queda
gratis detrás del mismo gate, sin código de permisos adicional.

### Color categórico estable (`public/js/paleta-logic.js`)

Bug real encontrado al revisar esto: las gráficas pie/bar/line/combo del
dashboard genérico pintaban cada serie/categoría por su **posición** en un
array de colores (`paleta[indice % paleta.length]`). En los paneles que
leen filas de un Excel (`modo:'filas'` — tipificación, asesores, entidades,
categorías de STA/demanda) esa posición depende del orden de las filas tal
cual vienen del archivo subido, que no está garantizado entre una carga y
otra — la misma categoría podía cambiar de color de un mes a otro. Los
paneles con series fijas por config (ej. "Contactados" vs "Ventas" en un
combo) sí eran estables *dentro de ese panel*, pero un mismo dato ("Ventas")
podía verse de colores distintos en dos gráficas diferentes de la misma
campaña, porque cada panel indexaba su propio array de series.

`paletaColorPara(etiqueta, paleta)` (dual-mode como `semaforo-logic.js`,
tests en `server/tests/paleta-logic.test.js`) deriva el color de un hash
determinista de la etiqueta — nunca de su posición. Se usa ahora en
`dashboard-generic.js` para pie (`backgroundColor` por label, no un array
plano), line/bar/area multi-serie (`paletaColorPara(s.label)`), las barras
de `combo` (`paletaColorPara(b.label)`), y en `trafico.js` para el color por
skill en modo "separado". Resultado verificado: la misma etiqueta
("Ventas", una skill, una tipificación) tiene el mismo color en **todas**
las gráficas de esa campaña, en cualquier recarga, sin importar el orden en
que vengan los datos.

**Nunca se mezcla con el semáforo** (`semaforo-logic.js`): esa es una
paleta de UMBRAL (verde/amarillo/rojo = cumple/no cumple una meta), esta es
una paleta CATEGÓRICA (identidad de dato → color fijo). `calidad_pie`
sigue usando verde/naranja/rojo fijos para Sobresaliente/No Crítico/Crítico
— es una decisión de diseño de ESE gráfico puntual (una clasificación de 3
cubetas con significado cualitativo obvio), no el motor de umbrales.

### Filtros extendidos desde el patrón de Tráfico de Llamadas

Inventario verificado antes de tocar código (no se asumió que las 12
campañas tienen los mismos paneles):

| Tipo de panel | Campañas | Filtro nuevo |
|---|---|---|
| `calidad_kpis`/`calidad_pie` (asesor, fecha reales en `CAL_DB`) | Las 9 con pestaña Calidad: ORLANT, CLINICA AURORA, TELEVENTAS SURA, TELEVENTAS COMFAMA, ANDRES YEPES, MOVILIZE, INFONDO, SASCHA FITNESS, BIVETT | Asesor (multi-select) + Desde/Hasta |
| `pie` / `bar` con `modo:'filas'` sobre un campo categórico (tipificación, asesor, entidad, categoría de STA/demanda) | Las 12 (todas tienen al menos un panel de tipificación) | Categorías a incluir (multi-select) |
| `line`/`area` con `modo:'filas', x:'fecha'` (líneas diarias) | Las 12 con al menos una sección diaria (todas menos alguna variante mínima) | Desde/Hasta (días dentro del mes cargado) |
| `line`/`bar`/`area` con `modo:'serie'` (tendencia mensual) | Las 12 | Sin filtro nuevo — ya lo controla el selector de mes superior, no hay un campo adicional que filtrar |
| `trafico_combo` | Las 10 con pestaña Tráfico (todas menos PANTERA MAIKERS y ALBERTO LINERO GO, que no tienen esa pestaña en su dashboard aunque su plantilla de carga sí trae la hoja DATA — fuera de alcance de este cambio) | Ya tenía el filtro completo (skill + Desde/Hasta + granularidad); sin cambios funcionales, solo el color por skill ahora es estable |
| `combo` (2 barras fijas + 1 línea %) | Las 12 | Sin filtro — son 2 métricas fijas por config, no una lista de categorías que varíe con el dato |
| `tabla` | Las que tienen ranking de asesores | Sin filtro — fuera de alcance (el pedido fue sobre gráficas) |

Implementación (`dashboard-generic.js`):
- `_gdPanelFiltroTipo(p)` decide `'categoria'` | `'fecha'` | `null` mirando
  el `modo`/`x` REAL de la fuente del panel — nunca se inventa un control
  sobre un campo que ese panel no usa.
- `_gdResolver(f, extra)` gana un segundo parámetro opcional (`{categorias}`
  o `{desde,hasta}`); sin `extra` el comportamiento es idéntico al de antes
  de este cambio (todos los demás llamadores — KPIs, export, tabla — no
  pasan `extra`).
- El filtro de categorías respeta la `vista` del dashboard (sede en
  HOSPITAL LA MARIA): las opciones del multi-select y el rango de fechas
  disponible solo consideran las filas de la sede activa, igual que ya
  hacía el resto del motor.
- Lógica pura extraída y testeada: `gd-filtro-logic.js`
  (`gdFiltrarFilasCategorias`, `gdFiltrarFilasRangoFechas`,
  `gdValoresDistintos`) para Gestión de base, `calidad-dashboard-logic.js`
  (`calDashFiltrarMonitoreos`, `calDashResumen`, `calDashAsesoresDistintos`)
  para Calidad — mismo patrón dual-mode que `trafico-logic.js`.
- El filtro de Calidad es **autónomo** (no seguir al selector de mes
  superior): igual que Tráfico, trae su propio rango por defecto (últimos
  12 meses con datos, reutilizando `traficoVentana12Meses`) y el usuario lo
  amplía si quiere — evita que cambiar el mes del dashboard reinicie en
  silencio un filtro de asesor que el usuario ya había elegido.

### Verificado en producción real (2026-09-16)

Workflow `verificar-filtros-colores-produccion.yml` (usuario temporal
ADMIN + uno AUX_ADMIN, ambos borrados al final): confirmó que un AUX_ADMIN
no ve el botón/la sección; que Previsualizar abre el dashboard real de
ORLANT y ALBERTO LINERO GO con datos reales; que el filtro de categorías
(subida de prueba a ALBERTO LINERO GO, periodo `2027-06`, borrada al
terminar) narrows correctamente y que el color de cada categoría es
idéntico entre dos aperturas del dashboard (`QA Objecion precio` →
`#27ae60` las dos veces, `QA Interesado` → `#8e44ad` las dos veces); que el
filtro de fecha de la línea diaria funciona; y que el filtro de asesor de
Calidad funciona sobre datos **reales** de ORLANT ya existentes (nunca
escritos ni borrados por este workflow) — filtrar a un asesor real bajó los
monitoreos de 37 a 5. Capturas en
`docs/capturas-demo/produccion-filtro-*.png`.

---

## 9. API — endpoints agregados en las últimas fases

Para el resto de la API (usuarios, dashboards de cliente, permisos,
historial, etc.) ver directamente `server/routes/` — esta tabla cubre
solo lo agregado en Tráfico Volvox y Semáforo/Cartera, que no estaba
documentado en ningún lado hasta ahora.

| Endpoint | Método | Para qué | Quién puede |
|---|---|---|---|
| `/api/umbrales` | GET | Lista todos los umbrales de semáforo (global + overrides por campaña) | Cualquier actor autenticado |
| `/api/umbrales` | POST | Crea o actualiza (upsert por `metrica`+`campana`) un umbral | Solo administrador |
| `/api/umbrales/:id` | PUT | Edita un umbral existente | Solo administrador |
| `/api/umbrales/:id` | DELETE | Borra un umbral | Solo administrador |
| `/api/monitoreos/bulk` | POST | Carga masiva de monitoreos de Calidad (§6) | Rol CALIDAD/SUPERVISOR (o admin) con permiso sobre esa campaña |
| `/api/seed-demo/estado` | GET | `{activo, marcas}` — si hay datos de demostración sembrados (pinta el banner global, §11) | Cualquier actor autenticado |
| `/api/calidad/trafico/carga` | POST | Carga el export de Volvox (multi-skill, multi-mes) | `canLoadData` (admin o rol con el permiso "Cargar Datos") |
| `/api/calidad/trafico/carga/impacto` | POST | Cuenta, por (skill,mes) del archivo, cuántas filas ya existen y se reemplazarían — no escribe nada (control de cargas, §5) | `canLoadData` |
| `/api/calidad/trafico/cobertura` | GET | Por skill, qué meses ya tienen tráfico cargado (control de cargas, §5) | `canLoadData` |
| `/api/calidad/trafico/plantilla` | GET | Descarga la plantilla oficial de tráfico (archivo real, nunca regenerado) | `canLoadData` |
| `/api/calidad/trafico/skills` | GET | Lista el mapeo skill → campaña (+ sede) | `canLoadData` |
| `/api/calidad/trafico/skills/:skillName` | PUT | Reasigna una skill a otra campaña/sede (reatribuye el histórico ya guardado) | `canLoadData` |
| `/api/calidad/nivel-servicio/diario` | GET | Filas diarias de nivel de servicio de una campaña (el navegador agrega, ver §5) | Cualquier actor con acceso a esa campaña |

---

## 10. Despliegue y operación

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

## 11. Decisiones que no son obvias mirando el código

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
- **Mapear un skill de Hospital La María sin elegir su sede (dejar el
  segundo `<select>` vacío) lo deja en la campaña correcta pero sin sede**
  (§5) — el panel de tráfico de ese dashboard filtra por sede
  (`CASTILLA`/`SEDE33`), así que esa fila no aparece en ninguna de las 2
  vistas hasta que se le asigne una sede. `guardarMapeoSkill`
  (`trafico.js`) ya bloquea el guardado con un aviso si la campaña elegida
  tiene sedes y no se eligió ninguna — pero sigue siendo un caso a tener en
  cuenta si se agrega otro dashboard multi-sede en el futuro.
- **La `UNIQUE` de `calidad_nivel_servicio` es `(campana, mes, sede)`, y SQL
  nunca trata 2 `NULL` como iguales** (§5) — cualquier código que compare
  filas de esa tabla por `(campana, mes)` sin agregar también `sede IS ?`
  puede leer o pisar la fila equivocada quedándose calladito (sin violar
  ninguna constraint). Ya causó un bug real en la pantalla manual de Nivel
  de Servicio durante la migración de sede (2026-09-15) — corregido, y
  documentado aquí para que no se repita en código nuevo.
- **SheetJS descarta por completo una celda de formula sin valor cacheado, a
  menos que se lea con `{sheetStubs:true}`** — verificado contra el paquete
  real `xlsx` (no asumido) al construir `cargasDetectarFormulaSinValor`
  (PR #31 + consolidacion 2026-09-16): sin esa opcion, `ws['B2']` da
  `undefined` aunque el XML del archivo tenga `<f>` en esa celda — la celda
  no existe en absoluto en el objeto `ws`, así que cualquier código que
  recorra `ws` buscando formulas nunca la encuentra. **Con** `sheetStubs:true`
  la celda sí aparece, pero como `{ t:'z', f, v:0 }` — ese `v:0` es un
  relleno interno de SheetJS, **nunca** el resultado real de la formula,
  así que cualquier chequeo de "esta celda no tiene valor" tiene que mirar
  `t==='z'`, no solo si `v` es `undefined`/`null`/`''`. `cargas.js` ya pasa
  `sheetStubs:true` al leer el archivo consolidado; si se agrega OTRO punto
  de la app que necesite detectar formulas sin calcular, hay que repetir
  ambas partes (la opción de lectura Y el chequeo de `t==='z'`), no solo una.
- **Un filtro de fecha aplicado al tráfico de un dashboard puede parecer
  "perdido" al abrir el tráfico de otro dashboard en la misma pestaña del
  navegador** (§5) — no es un bug de mezcla de datos (cada campaña sigue
  viendo solo lo suyo), es que el estado de filtros vive en la URL de la
  página, compartido por cualquier panel `trafico_combo`; el motor lo
  detecta y descarta el filtro heredado si no aplica a la campaña nueva.
