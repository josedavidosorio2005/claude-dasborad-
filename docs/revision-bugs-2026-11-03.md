# Revisión de errores y bugs — 2026-11-03 (solo lectura)

Revisión sobre `main` en `c17b75a` (v1.112.0). No se cambió código, no se
hizo commit y no se tocó producción. La verificación visual se hizo contra
una copia **local y aislada** (base demo nueva en una carpeta temporal,
secretos aleatorios de un solo uso, puerto 3999), con Playwright desde Node
y Brave.

## 1. Pruebas, lint y auditoría

| Qué | Resultado |
|---|---|
| `npm test` (`node --test`, el ejecutor del proyecto) | **2431 / 2431** en verde, 0 fallas, 0 omitidas |
| Lint | **El proyecto no tiene lint** (ni ESLint ni paso de lint en CI). Sustituto: `node --check` sobre los 558 `.js` versionados → 0 errores de sintaxis |
| `npm audit` (server) | **0 vulnerabilidades** |

Nada falló.

## 2. Hallazgos confirmados (por severidad)

### H1 — ALTA · El formulario de usuario nuevo marca todos los clientes y campañas por defecto

- **Dónde**: `public/js/users.js:188` (`buildClientCheckboxes`: sin
  permisos previos, `checked = true`), `public/js/users.js:204`
  (`buildCampaignCheckboxes`, igual) y `public/js/state.js:27` y `:32`
  (`buildPerms`: sin casillas, todo en `true`). El servidor no corrige
  nada: guarda lo que manda el navegador (`server/routes/usuarios.js:108-120`).
- **Qué pasa**: en Gestión de Usuarios → Nuevo usuario, al elegir
  CLIENTES_DASH o SUPERVISOR salen marcados los 5 clientes; con CALIDAD,
  REPORTES, SUPERVISOR o GERENCIA, las 4 campañas de Calidad. Si quien lo
  crea no desmarca a mano, el usuario nuevo ve los datos reales de ORLANT y
  MOBILIZE. Pasó en la Fase 221 (el usuario de cliente de Jairo quedó con
  todos; en ese caso el usuario confirmó que era lo que quería).
- **Cómo se reproduce**: Nuevo usuario → rol CLIENTES_DASH → las 5
  casillas aparecen marcadas. Reproducido en local con Playwright:
  `ORLANT:true MOBILIZE:true CLINICA AURORA:true HOSPITAL LA MARIA:true
  SURA:true`; con CALIDAD, las 4 campañas en `true`.
- **Arreglo propuesto** (parche, sin tocar usuarios ya creados): que en
  modo crear las casillas nazcan **sin marcar** (`existingPerms ?
  … : false`) en las dos funciones, y que `saveUser` no deje guardar un
  CLIENTES_DASH/SUPERVISOR sin al menos un cliente (ni un
  CALIDAD/REPORTES/SUPERVISOR/GERENCIA sin al menos una campaña), con un
  mensaje claro. Como segunda red, `POST /users` en el servidor puede
  rechazar (400) un CLIENTES_DASH sin ningún `cliente_*`. Prueba nueva que
  abra el formulario y compruebe que nada viene marcado.

### H2 — MEDIA · Fechas en texto `DD/MM/AAAA` se leen como `MM/DD` (formato EE. UU.)

- **Dónde**: `public/js/calidad-carga-masiva-logic.js:102-103`
  (`cmParseFecha`, carga masiva de monitoreos) y `public/js/metas.js:388-389`
  (`_nsdParseFecha`, Nivel de servicio diario): caen en `new Date(t)`.
- **Qué pasa**: si la celda de fecha viene como **texto** (no como fecha de
  Excel), `05/10/2026` (5 de octubre en Colombia) queda como `2026-05-10`
  (10 de mayo): mes equivocado y sin aviso. Con día > 12 (`31/10/2026`) la
  fila sale `null` (se rechaza). Tráfico ya lo resolvió con una expresión
  propia (`TRAFICO_FECHA_TEXTO_RE`, `public/js/trafico-logic.js:184`).
- **Cómo se reproduce**: en Node con `TZ=America/Bogota`, cargando esos
  archivos: `cmParseFecha('05/10/2026')` → `2026-05-10`;
  `_nsdParseFecha('05/10/2026')` → `2026-05-10`.
- **Arreglo propuesto**: antes de `new Date(t)`, reconocer `D/M/AAAA`
  (igual que `traficoParseFecha`) y armar la fecha a mano; no usar
  `new Date(texto)` para formatos con barras. Pruebas con `05/10/2026`,
  `31/10/2026` y `1/2/2026`.
- **Impacto real**: depende de si esos Excel traen la fecha como texto. Con
  fechas nativas de Excel la ruta está bien (ver "Verificado sin
  problema").

### H3 — MEDIA · Fecha-hora en texto desde las 7 p. m. se corre al día siguiente

- **Dónde**: misma rama `new Date(t)` + `toISOString()` en
  `public/js/calidad-carga-masiva-logic.js:103`,
  `public/js/metas.js:389`, `public/js/trafico-logic.js:202-203` y
  `public/js/trafico-whatsapp-logic.js:178-179`.
- **Qué pasa**: un texto como `2026-10-31 20:30` se interpreta en hora
  local (Colombia, UTC-5) y `toISOString()` lo pasa a UTC: queda
  `2026-11-01`. El último día del mes, de 7 p. m. en adelante, el registro
  cae en el **mes siguiente**.
- **Cómo se reproduce**: con `TZ=America/Bogota`, `cmParseFecha`,
  `_nsdParseFecha`, `traficoParseFecha` y `traficoWppParseFecha` con
  `'2026-10-31 20:30'` → `2026-11-01` en las cuatro.
- **Arreglo propuesto**: para textos `AAAA-MM-DD…` tomar los primeros 10
  caracteres sin pasar por `Date`; para el resto, armar la fecha con
  `getFullYear()/getMonth()/getDate()` (hora local), nunca `toISOString()`.
  Puede ir en una sola función compartida para los 4 lectores. Pruebas con
  `TZ=America/Bogota` en las 4 funciones.
- **Impacto real**: igual que H2, solo con fechas en texto. Wolkvox suele
  traer fecha numérica (Tráfico la convierte a mano sin zona horaria).

### H4 — BAJA · "Mes actual" y "hoy" calculados en UTC

- **Dónde** (servidor, que corre en UTC): `server/routes/calidad.js:690` y
  `:717` (`/metas/cumplimiento`, `/metas/mi-meta` sin `mes`),
  `server/routes/gerencia.js:60` (`/gerencia/resumen` sin `periodo`),
  `server/dashboard-adapters.js:24` (`mesActual` de Inventario) y `:415`
  (`hoy` de Gestión Humana). En el navegador: `public/js/calidad.js:91`,
  `:266`, `:588`, `:624`, `:730`, `:812`, `public/js/session.js:231`,
  `public/js/metas.js:44` y `:211`, `public/js/gerencia.js:47`,
  `public/js/inventario.js:252`.
- **Qué pasa**: entre las 7 p. m. y la medianoche (hora Colombia) del
  último día del mes, el "mes actual" por defecto ya es el siguiente; en
  Inventario, la fecha por defecto de un movimiento sale como "mañana" desde
  las 7 p. m. de cualquier día. Solo afecta los valores **por defecto**
  (cuando no se elige mes).
- **Cómo se reproduce**: con el reloj del equipo el 31/10 a las 8 p. m.
  (hora Colombia), abrir Calidad → el mes por defecto es noviembre.
- **Arreglo propuesto**: usar `fechaLimitesHoyColombia()`
  (`server/fecha-limites.js`, ya existe) en el servidor y
  `gdHoyLocal()` (ya existe en el navegador, lo usa `cargas.js:1397`) en
  el navegador.

### H5 — BAJA (proceso) · Sin lint configurado

- **Dónde**: `server/package.json` (no hay script `lint`) y
  `.github/workflows/ci.yml` (no hay paso de lint).
- **Qué pasa**: no hay red automática para variables sin declarar, código
  muerto o `==`, más allá de las pruebas.
- **Arreglo propuesto**: solo si se quiere: ESLint con reglas mínimas
  (`no-undef`, `no-unused-vars`) como paso de CI. Toca `ci.yml`, así que
  se consulta antes (regla de `CLAUDE.md`).

## 3. Sospechas (no confirmadas como bug)

### S1 — ALTA si se confirma · La base inicial de SURA llega completa al cliente

- **Dónde**: `public/js/sura-televentas-app.js:921-929` (`parseIni` guarda
  **todas** las columnas del Excel menos la cédula) y
  `server/sura-televentas.js:293-305` (`seudonimizar` solo cambia `ids`).
- **Qué puede pasar**: si la base inicial trae columnas como nombre,
  teléfono, correo o dirección, el usuario de cliente las recibe en claro en
  la respuesta de `GET /api/sura-televentas/SURA/bases/inicial/<mes>`
  (las pantallas solo muestran agregados, pero los datos van en la red). No
  se pudo confirmar: el Excel real no está en este equipo y no se consultó
  producción (revisión en solo lectura, sin tocar producción).
- **Cómo confirmarlo**: mirar **solo los encabezados** del Excel de la
  base inicial (fuera del repo), o con sesión de administrador en
  producción leer `cols[].h` de esa respuesta (solo nombres de columna).
- **Arreglo propuesto**: lista blanca de columnas en `parseIni` (las que
  usa `INIF`: sexo, edad, ingresos, estado civil, ocupación, saldo,
  percentil, departamento, ciudad y tipo de documento) y, como segunda
  red, que `seudonimizar` quite del resultado cualquier columna fuera de
  esa lista para quien no es administrador. Con prueba.

### S2 — BAJA · Columnas de SURA por posición fija si cambia el encabezado

- **Dónde**: `public/js/sura-televentas-app.js:54-58` (`col(nombre,
  letra)`).
- **Qué puede pasar**: si una columna cambia de nombre **y** de lugar, el
  tablero toma otra columna sin avisar (por ejemplo, la cédula en la letra
  H). Es el comportamiento del HTML de Edwin, a propósito.
- **Arreglo propuesto**: avisar en «Cargar información» cuando una columna
  clave (identificación, agente, fecha de venta, cantidad) no se encontró
  por nombre y se usó la letra fija.

### S3 — BAJA · WhatsApp rechaza `DD/MM/AAAA` en texto

- **Dónde**: `public/js/trafico-whatsapp-logic.js:159`
  (`traficoWppParseFecha('31/10/2026')` → `null`, cuando Tráfico sí lo
  acepta).
- **Por qué es sospecha**: no se verificó si el archivo real de WhatsApp
  puede traer la fecha así; si solo trae fecha numérica, no afecta.

### S4 — BAJA (por diseño) · `/dashboard/cargas` lista cargas de todos los clientes

- **Dónde**: `server/routes/dashboards.js:171-191`.
- **Qué pasa**: quien tiene `cargarDatos` ve nombre de archivo, quién
  cargó y cuántas filas de clientes a los que no tiene acceso (las filas
  van vacías). El código lo documenta como deliberado (Fase 72). Solo lo
  ven usuarios internos de carga; se deja anotado.

## 4. Verificado sin problema

- **Permisos del servidor** (180 rutas, extraídas con un script): todas
  exigen sesión salvo el login; ninguna escritura queda protegida solo con
  `campaignAccess` (que deja pasar al rol cliente): todas piden además
  administrador, `cargarDatos`/`cargar_<módulo>`, evaluar o gestionar
  monitoreos. Las rutas que leen datos de un cliente verifican el acceso a
  ese cliente. Las de "lo propio" (contraseña, cerrar sesión, mis monitoreos,
  guía) no lo necesitan.
- **SURA**: escrituras y descarga del Excel original solo del
  administrador (403 al resto, también comprobado en producción en la Fase
  221); cédulas de ventas, registros (`pr`) y estrategias seudonimizadas con
  HMAC; `pr` no trae datos personales.
- **Teléfonos**: Llamadas únicas, salida, Encuesta, WhatsApp y Flujo por
  hora no guardan teléfono; el de monitoreos se quita para los roles que no
  lo ven (`monitoreoPara`). Los códigos de entidad que pueden ser cédulas
  se reemplazan antes de guardarse y su lista es solo de quien carga.
- **Caché de respuestas** (`server/cache-datos.js`): clave por ruta,
  filtros, usuario, rol, permisos, versión de token y estado; se vacía con
  triggers en todas las tablas de datos. Sin fuga entre usuarios.
- **Lista de clientes** (`/dashboard/clientes`): filtrada por permisos.
- **Secretos**: no hay llaves ni tokens en el repo. Los usuarios de ejemplo
  de `server/db.js` nunca se crean en producción y, si existieran con la
  contraseña de ejemplo, se suspenden solos al arrancar (Fase 110).
- **División por cero**: nivel de servicio, % de meta, inasistencia y
  repartos de Agendamiento devuelven `null`/0 con total 0.
- **Fechas de Excel nativas**: SheetJS 0.20.3 con `cellDates` da el día
  correcto en `America/Bogota` aun a las 20:30 del último día del mes
  (probado).
- **Frontend en local** (base demo, ADMIN y CLIENTES_DASH): los 5 clientes
  y todas sus pestañas (ADMIN) y los 2 del cliente demo, a 1440, 768 y 375
  px en claro y oscuro: **0 errores de consola, 0 respuestas 5xx, 0
  desbordes**; pantallas de administración (10 secciones y Nuevo usuario) a
  1440 y 375, claro y oscuro: sin errores ni desbordes. El filtro de meses
  cambia las gráficas donde hay datos. Las 4 pestañas donde no cambió nada
  (Tráfico de WhatsApp de ORLANT; Llamadas únicas, Flujo por hora y
  Encuesta de Mobilize) no tienen datos en la base demo: falso positivo.

## 5. Lo que no cubre esta revisión

- Producción (por pedido: solo lectura y sin tocarla).
- Las fórmulas internas de SURA (código minificado del HTML de Edwin): solo
  se comprobó que las cifras por mes coinciden con las del administrador
  (Fase 221).
- Los módulos sin datos en la base demo (WhatsApp, Encuesta, Flujo por
  hora, Llamadas únicas) se vieron solo en su estado vacío.
- Cuadre de totales contra archivos reales: lo cubren las pruebas y los
  números de control de `PROGRESS.md`; no se recalcularon aquí.
