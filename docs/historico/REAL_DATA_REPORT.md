# REAL_DATA_REPORT - Datos reales y dashboards configurables

> **Nota:** este documento describe la migración a datos reales (Calidad, Metas,
> dashboards base). La ampliación posterior del sistema (motor de análisis, 9
> dashboards nuevos, Inventario/Gerencia configurables, exportación, constructor
> visual) y el despliegue en AWS están en [`PROGRESS.md`](PROGRESS.md),
> [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md) y [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md).

Fecha: 2026-09-09

Objetivo: sacar Calidad, Metas y los dashboards de cliente de datos locales/de
ejemplo, mover la fuente de verdad al servidor SQLite, exigir permisos en cada
endpoint y hacer que un dashboard nuevo se cree por configuracion en vez de por
un archivo JavaScript nuevo.

## Estado

| Fase | Alcance | Estado |
| --- | --- | --- |
| 1 | Calidad y Metas en SQLite, API segura, calculos reproducibles y frontend contra API | Completa y verificada |
| 2 | Dashboards Aurora, Orlant y Hospital La Maria alimentados por datos reales cargados | Completa y verificada |
| 3 | Dashboard generico configurable desde admin | Completa y verificada |
| 4 | Inventario y Gerencia en SQLite, API segura y carga masiva desde Excel | Completa y verificada |

## Fase 1 - Calidad y Metas

### Modelo de datos

Se agregaron tablas en `server/db.js`, siguiendo el mismo patron de `users` e
`historial`:

- `calidad_plantillas`: items, pesos, criticidad y motor de calculo por campana.
- `monitoreos`: un registro de calidad por asesor, campana, fecha y canal, con
  respuestas JSON y resultado calculado por servidor.
- `cronograma_metas`: programacion mensual por campana y lider, con metas base.
- `schema_migrations`: marca migraciones de una sola vez.

Decisiones principales:

- `answers` e `items` se guardan como JSON porque se leen y escriben como unidad.
- `mes` se guarda derivado de `fecha` para consultas por `(campana, mes)`.
- `evaluadorUserId` lo fija el servidor desde el JWT; el texto `evaluador` queda
  solo como etiqueta visible.
- Las metas derivadas no se guardan: el servidor calcula `metaPorAsesor`,
  `metaDiaria` y semanas 1-4 cada vez.
- Los usuarios semilla y las bases antiguas reciben permisos dinamicos explicitos
  (`campana_X`, `cliente_X`) mediante `scoped_permissions_v1`, solo una vez.

### API

- `GET /api/calidad/plantillas`
- `GET /api/calidad/plantillas/:campana`
- `GET /api/monitoreos?campana=&mes=`
- `GET /api/monitoreos/mios`
- `GET /api/monitoreos/resumen?campana=&mes=`
- `POST /api/monitoreos`
- `PUT /api/monitoreos/:id`
- `DELETE /api/monitoreos/:id`
- `GET /api/metas?campana=`
- `GET /api/metas/cumplimiento?campana=&mes=`
- `GET /api/metas/mi-meta?campana=&mes=`
- `POST /api/metas`
- `PUT /api/metas/:id`
- `DELETE /api/metas/:id`

Seguridad:

- Todos los endpoints cargan actor real desde BD.
- Leer datos de campana exige `campana_X`, `cliente_X` o admin.
- Crear monitoreos exige admin o rol `CALIDAD`/`SUPERVISOR` con `campana_X`.
- Editar/borrar monitoreos exige admin o rol `REPORTES` con `campana_X`.
- Crear/editar/borrar metas queda solo para admin.

Calculos migrados a `server/calidad-logic.js`:

- `computeScore`
- `cronogramaDerived`
- `metaForLiderInMonth`
- `lideresCumplimiento`
- `resumenPorAsesor`
- `resumenCampana`

`public/js/calidad.js` y `public/js/metas.js` ya no persisten en
`localStorage`. `CAL_DB` sigue existiendo solo como cache en memoria cargada por
API. El navegador conserva una copia de `computeScore` para preview del
formulario, pero el valor guardado siempre es el del servidor.

## Fase 2 - Datos operativos reales

Como la app no tenia integracion externa definida para AHT, flujo mensual,
tipificacion, agendamiento, inasistencia y demas metricas operativas, el camino
implementado es carga manual controlada por Excel:

- `dashboard_cargas`: una fila por `(cliente, seccion, periodo)`.
- `filas` guarda JSON normalizado por el servidor.
- Re-subir el mismo periodo hace upsert y reemplaza la carga.
- `cargarDatos` es un permiso asignable a cualquier rol.

Los 3 clientes iniciales quedan configurados con sus secciones:

- `ORLANT`: resumen, salida, tipificacion, STA.
- `CLINICA AURORA`: resumen, llamadas, salida, agendas, tipificacion,
  categorias de agendas, sabados.
- `HOSPITAL LA MARIA`: resumen por sede, dia, tipificacion, demanda, entidades.

API:

- `GET /api/dashboard/clientes`
- `GET /api/dashboard/secciones/:cliente`
- `GET /api/dashboard/:cliente`
- `GET /api/dashboard/cargas?cliente=&seccion=`
- `POST /api/dashboard/cargas`
- `DELETE /api/dashboard/cargas/:id`

Frontend:

- `public/js/cargas.js` agrega la pantalla para generar plantilla, leer Excel,
  previsualizar, validar y guardar cargas.
- Los dashboards ya no tienen objetos de datos de ejemplo. Si falta una seccion,
  el panel muestra "Sin datos cargados".

## Fase 3 - Dashboard configurable

Se elimino el patron de un archivo por cliente (`dashboard-aurora.js`,
`dashboard-orlant.js`, `dashboard-hlm.js`) y se reemplazo por:

- `dashboards_config` en SQLite.
- `server/dashboard-config-seed.js` con las configuraciones iniciales de Aurora,
  Orlant y Hospital La Maria.
- `public/js/dashboard-generic.js`, que renderiza KPIs, lineas, barras, pies,
  tablas, combinados y paneles de Calidad desde la configuracion.
- `public/js/dashboards-admin.js`, pantalla admin para crear/editar/eliminar
  dashboards sin tocar codigo.

Tipos de panel soportados:

- `kpi_row`
- `line`
- `bar`
- `pie`
- `combo`
- `tabla`
- `calidad_kpis`
- `calidad_pie`

Fuentes soportadas:

- `ultimo`: valor del ultimo periodo disponible.
- `serie`: tendencia por periodos.
- `filas`: filas del periodo actual.
- `agregado`: suma o promedio de columnas.
- Formulas simples: `a+b`, `a-b`, `a/b`, `a/b*100`.

Seguridad adicional corregida:

- `GET /api/dashboards/config` y `GET /api/dashboards/config/:cliente` ahora son
  solo admin, igual que crear/editar/borrar configuraciones.
- Los usuarios de cliente siguen leyendo su dashboard por `/api/dashboard/:cliente`,
  con permiso `cliente_X` o admin.

Tambien se corrigio:

- La navegacion admin ahora incluye realmente la seccion `dashboards`.
- El menu "Dashboards" se muestra solo a admin.
- La UI ya no trata permisos `cliente_X`/`campana_X` faltantes como acceso
  implicito. Deben ser `true`, igual que en el servidor.
- El modal "Nuevo dashboard" preselecciona internamente el primer cliente libre.

## Fase 4 - Inventario y Gerencia

Ambos modulos se construyeron sobre SQLite, con endpoints protegidos por permisos y soporte completo de carga masiva por Excel.

### Modulo de Inventario

- **Tablas**:
  - `inventario_items`: stock actual con nombre, categoria, cantidad, unidad, ubicacion, estado (`Disponible`, `En Uso`, `Mantenimiento`, `Dado de Baja`), proveedor, costo unitario y observaciones.
  - `inventario_movimientos`: trazabilidad de entradas, salidas, ajustes y transferencias, con motivo, destino y usuario que registro el cambio. Al registrar un movimiento, el stock del item se actualiza atomicamente en una transaccion SQLite.
- **API**:
  - `GET /api/inventario/items`: listado filtrable por categoria y estado.
  - `GET /api/inventario/resumen`: KPIs agregados (total items, unidades, valor monetario total, desglose por estado y categoria, ultimos movimientos).
  - `POST /api/inventario/items`: crear item.
  - `PUT /api/inventario/items/:id`: actualizar item.
  - `DELETE /api/inventario/items/:id`: eliminar item.
  - `GET /api/inventario/movimientos`: historial de movimientos.
  - `POST /api/inventario/movimientos`: registrar movimiento y recalcular stock.
  - `POST /api/inventario/carga-items`: carga masiva de items desde Excel.
  - `POST /api/inventario/carga-movimientos`: carga masiva de movimientos desde Excel.
- **Frontend (`public/js/inventario.js`)**:
  - Modal full-screen con pestañas: Items, Movimientos, Carga Excel.
  - KPIs en tiempo real (Items, Unidades, Valor Total, Disponibles, En Uso).
  - Descarga de plantillas Excel preformateadas para Items y Movimientos.
  - Seccion integrada en el panel de administracion.

### Modulo de Gerencia

- **Tablas**:
  - `gerencia_kpis`: indicadores ejecutivos mensuales por periodo (`AAAA-MM`), categoria, valor, unidad, meta opcional y observaciones. Clave unica `(periodo, nombre)` que permite upsert automatico al volver a cargar un mes.
- **API**:
  - `GET /api/gerencia/kpis`: listado de KPIs filtrables por periodo y categoria.
  - `GET /api/gerencia/periodos`: lista de periodos disponibles.
  - `GET /api/gerencia/resumen`: KPIs del periodo, agrupados por categoria y con conteo de cumplimiento de metas.
  - `POST /api/gerencia/kpis`: crear o actualizar un KPI individual (upsert).
  - `PUT /api/gerencia/kpis/:id`: actualizar KPI.
  - `DELETE /api/gerencia/kpis/:id`: eliminar KPI.
  - `POST /api/gerencia/carga`: carga masiva de indicadores desde Excel para un periodo.
- **Frontend (`public/js/gerencia.js`)**:
  - Modal full-screen con selector de periodo mensual.
  - KPIs y tarjetas por categoria con semaforizacion automatica segun la meta (verde: cumple, naranja: >80%, rojo: <80%).
  - Tabla detallada con estado de cumplimiento de meta.
  - Descarga de plantilla Excel con indicadores sugeridos (Nivel de atencion, AHT, Satisfaccion, Costo, Productividad, Inasistencia).
  - Seccion integrada en el panel de administracion.

## Verificacion

### Pruebas automatizadas

Comando:

```bash
cd server
node --test
```

Resultado:

```text
tests 56
pass 56
fail 0
```

Cobertura agregada en `server/tests/inventario-gerencia.test.js`:
- Inventario: control de acceso por permiso `Inventario`.
- Inventario: creacion, listado, resumen y eliminacion de items.
- Inventario: registro de movimientos y descuento automatico de stock.
- Inventario: carga masiva de items desde Excel (payload JSON).
- Gerencia: control de acceso por permiso `Gerencia`.
- Gerencia: creacion, resumen y eliminacion de KPIs ejecutivos.
- Gerencia: obtencion de periodos disponibles.
- Gerencia: carga masiva de KPIs desde Excel con upsert.

### API real con reinicio

- Crear monitoreo y recalcular puntaje en servidor.
- Ignorar puntaje inyectado desde cliente.
- Bloquear rol sin `campana_X`.
- Bloquear acceso cruzado entre campanas.
- Calcular cumplimiento contra metas reales.
- Persistencia de monitoreos.
- Cargas de dashboard con validacion y upsert.
- Acceso por `cliente_X`.
- Configuracion editable solo admin.
- Crear dashboard de ejemplo para `BIVETT` solo por configuracion, sin archivo JS
  nuevo, cargar datos y leerlo desde `/api/dashboard/BIVETT`.

### API real con reinicio

Se levanto el backend en `localhost:3210` con SQLite temporal:

- Login admin, Calidad y cliente.
- Crear asesor ORLANT.
- Programar meta de Carlos Rodriguez para `2026-09`.
- Crear monitoreo real ORLANT con todos los items en `SI`.
- Resultado: `puntaje = 100`, `realizados = 1`, `pct = 100`.
- Leer `/api/dashboard/ORLANT`: incluye la pestana Calidad.
- Leer `/api/monitoreos?campana=ORLANT&mes=2026-09` como usuario cliente:
  devuelve el monitoreo.
- Reiniciar servidor con la misma BD.
- Volver a consultar: el monitoreo persiste y el cumplimiento recalcula `100%`.

### UI headless

Se ejecuto Edge headless por Chrome DevTools Protocol contra `localhost:3211`:

- Login en la pagina como `crodriguez`.
- Abrir Modulo de Calidad.
- Seleccionar ORLANT y asesor creado para la prueba.
- Completar 17 items con `SI`.
- Preview de formulario: `100`, `SOBRESALIENTE`, `0 fallos`.
- Guardar desde `submitMonitoreo()`.
- La tabla de Monitoreos muestra `Asesor UI ORLANT`, `2026-09-10`, `100`.
- Login como `agomez`.
- Abrir dashboard ORLANT generico.
- Pestana Calidad muestra `1 Monitoreos Realizados`, `100 Puntaje Promedio` y
  clasificacion `SOBRESALIENTE`.

Las bases temporales y el perfil temporal de Edge se limpiaron al final.

## Archivos principales

Servidor:

- `server/db.js`
- `server/server.js`
- `server/auth.js`
- `server/validation.js`
- `server/calidad-logic.js`
- `server/calidad-plantillas-seed.js`
- `server/dashboard-secciones.js`
- `server/dashboard-config-seed.js`
- `server/tests/calidad.test.js`
- `server/tests/dashboard.test.js`

Frontend:

- `public/js/calidad.js`
- `public/js/metas.js`
- `public/js/cargas.js`
- `public/js/dashboard-generic.js`
- `public/js/dashboards-admin.js`
- `public/js/dashboards-core.js`
- `public/js/session.js`
- `public/js/state.js`
- `public/js/users.js`
- `public/js/roles-perms.js`
- `public/js/ui-core.js`
- `public/index.html`
- `public/css/styles.css`

## Estado posterior (actualizado 2026-09-09)

Inventario y Gerencia **sí se construyeron** (`server/server.js`,
`public/js/inventario.js`, `public/js/gerencia.js`) con sus tablas propias y
carga masiva por Excel, y luego se expusieron sobre el **mismo motor de
dashboards configurables** mediante `server/dashboard-adapters.js` (M4). Ver
[`PROGRESS.md`](PROGRESS.md) Fase 4.

Sigue pendiente de negocio: umbral de bajo stock **por ítem** en Inventario
(hoy la alerta es `cantidad = 0`) y la **dirección** de cada meta ejecutiva de
Gerencia (hoy `valor >= meta` para todas). Detalle en
[`LAUNCH_REPORT.md`](LAUNCH_REPORT.md) §4.
