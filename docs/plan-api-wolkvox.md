# Plan — integración con la API de Wolkvox (Fase 330, 10/11/2026)

**Estado:** W0 (este plan) hecho. **W1** (réplica oculta, sin API) hecha en su PR, esperando el OK del
usuario para crear la réplica en producción (la crea una migración al desplegar). Todavía no se
llamó a la API.
Este documento no tiene tokens, números de servidor, URLs reales, nombres ni datos de
clientes (el repo es público). Donde hace falta una URL se escribe `<servidor>` y
`<reporte>`.

## 0. Lo que sabemos de la API y lo que hay que confirmar

| Tema | Lo que sabemos | Por confirmar (antes de la Fase W2) |
|---|---|---|
| Método | GET | — |
| URL | Incluye el número del servidor de la operación y los parámetros del reporte (`https://<servidor>…/<reporte>?…`) | Ruta exacta y nombre de cada parámetro (se copian de la colección de Postman, **sin** el token) |
| Autenticación | Encabezado `wolkvox-token`, un token por operación, creado en Manager | ¿El token vence? ¿Se puede rotar sin cortar el servicio? ¿Exige IP de origen en lista blanca? |
| Límite de uso | Según el licenciamiento | Número exacto (¿por día, por hora, por minuto?) y qué responde al pasarlo (¿429?) |
| Fechas | `AAAAMMDDHHMMSS`, 24 h; la inicial y la final en el **mismo mes** | Zona horaria (¿hora Colombia?), y si la final es incluyente |
| Reportes | Los mismos de Manager › Reports (skills, CDR, agentes, chats…) | Nombre del reporte de la API para cada archivo de la sección 2 |
| Respuesta | JSON, probado en Postman (reporte por skill, 200) | Nombres de los campos (¿iguales a las columnas del Excel?), formato de % y tiempos, paginación, tamaño máximo |

## 1. Campaña réplica oculta: «MOBILIZE PRUEBAS API»

### 1.1 Cómo se arma sin duplicar código

- **Tablero.** La plataforma ya genera el tablero de un cliente a partir de sus módulos:
  `generarLayout(perfil)` en `server/plantillas-cliente.js`, con `PERFILES_ACTUALES.MOBILIZE`.
  Esa función ya se prueba para que reproduzca exacto el tablero guardado de Mobilize, la
  prueba de «foto». La réplica usa ese mismo perfil cambiando solo el nombre:
  `generarLayout({ ...PERFILES_ACTUALES.MOBILIZE, nombre: 'MOBILIZE PRUEBAS API', titulo: 'Mobilize pruebas API' })`.
  Cada panel lleva `campana: 'MOBILIZE PRUEBAS API'`, así que todas las consultas leen
  solo las filas de la réplica. Las tablas son las mismas de siempre, con su columna
  `campana`.
- **Registro de clientes.** Una fila nueva en `clientes_registro`, con los módulos de Mobilize
  que se alimentan de Wolkvox (`flujo_llamadas`, `tipificacion`, `llamadas_unicas`,
  `flujo_hora`, `encuesta`), los mismos `parametros` de Mobilize y uno nuevo,
  `interno: true`. Calidad y «Resumen por asesor» se dejan fuera porque no salen de
  Wolkvox; se pueden agregar después si el supervisor lo pide.
- **Se crea con una migración idempotente** (`runOnceMigration` en `server/db.js`), como
  manda CLAUDE.md para `dashboards_config`. No se usa un script manual. Esa migración no
  toca ninguna fila de `MOBILIZE`.
- **Lo que hoy está escrito a mano como `'MOBILIZE'`** y la réplica necesita igual. Hay que
  pasarlo a un parámetro del registro, o a una lista que incluya a la réplica:
  - `GD_CLIENTES_BOTONES_RESALTADOS` en `public/js/graficas-lineas-logic.js` (botones
    resaltados);
  - `claseUltimaActualizacion` y `salidaNoConectada`: ya están en `parametros`, solo se
    copian.
  - Configuración por campaña que hay que copiar o decidir: el mapeo de skills del cliente
    (Flujo de Llamadas solo cuenta las skills asignadas al cliente), los alias de asesores y
    la clasificación de asesores, si aplica.
  - Las ~75 menciones de `'MOBILIZE'` en `server/db.js` son migraciones viejas que solo
    corren una vez sobre la fila real. No se tocan.

### 1.2 Cómo se garantiza que solo la ve un administrador

Hoy, «visible solo para el administrador» quiere decir «nadie tiene el permiso
`cliente_`/`campana_` de ese cliente». Eso depende de que nadie lo marque por error. Además,
`GET /dashboard/clientes` muestra **todos** los clientes a quien gestiona usuarios
(`gestionPermisos`, `crearUsuarios` o `editarUsuarios`), aunque no sea administrador. Para la
réplica se vuelve una regla del servidor:

1. Una sola función, `esCampanaInterna(nombre)`, lee `parametros.interno` del registro
   (con caché, igual que el resto del registro).
2. Las funciones de acceso devuelven `false` para una campaña interna si el usuario **no**
   es administrador completo (`isFullAdmin`: el administrador maestro o el rol ADMIN),
   **aunque tenga el permiso marcado**. Son estas:
   - `campaignAccess`, `canEvaluateCampaign`, `canLoadCampaign` y la carga del supervisor
     en `server/auth.js`;
   - `clienteAccess` en `server/routes/dashboards.js`;
   - `puedeVerPlantillasDe` (asesor) en `server/routes/calidad.js`.
3. Las listas (`/dashboard/clientes`: `clientes`, `listaClientes`, `campanasCalidad`,
   `registro`) la quitan para quien no sea administrador completo, aunque gestione usuarios.
   El menú, el selector de Calidad y el Centro de cargas salen de esa lista, así que no
   aparece en ninguno.
4. Crear o editar un usuario rechaza (400) un permiso `cliente_`/`campana_`/`cargar_` de una
   campaña interna, y la pantalla de Usuarios no muestra esa casilla.
5. Todas las llamadas a Wolkvox y la comparación (sección 5) son rutas `/api/wolkvox/*`
   **solo para el administrador completo**.

**Pruebas que tienen que fallar antes del cambio:**

- **Matriz completa.** Para cada rol (`ASESOR`, `CALIDAD`, `SUPERVISOR`, `REPORTES`,
  `GERENCIA`, `CLIENTES_DASH`…), incluso con `cliente_`/`campana_` de la réplica metidos
  directo en la base: 403 o 404 en cada ruta GET que recibe `campana` o `cliente`. La lista
  de rutas se saca del propio `app` (`router.stack`), para que una ruta nueva entre sola a la
  prueba. Va como extensión de `fase118-matriz-acceso.test.js`.
- **Listas.** `/dashboard/clientes` no la trae para nadie que no sea administrador, tampoco
  para quien gestiona usuarios. El administrador sí la ve.
- **Enlace directo.** `GET /dashboard/MOBILIZE PRUEBAS API` da 403 para todos los demás.
- **Mobilize real intacto.** El layout y el registro de `MOBILIZE` son idénticos antes y
  después de la migración (prueba de «foto»), y ninguna consulta de la réplica devuelve filas
  con `campana = 'MOBILIZE'`.
- **Verificación en producción, solo lectura,** con una cuenta de cliente y una de
  supervisor: el menú no la muestra y el enlace directo da 403.

## 2. Qué sube hoy el supervisor para cada pestaña de Mobilize

Todas las lecturas pasan por el lector de cada módulo (`public/js/*-logic.js`, que corre en
el navegador y también en Node). Los lectores buscan las columnas **por nombre**, no por
posición. La última columna se deja vacía para que el supervisor diga qué reporte de la API
corresponde a cada archivo.

| # | Pestaña (y lo que alimenta) | Archivo que sube hoy (Wolkvox) | Carga en la plataforma | Columnas que usa la plataforma | Columnas que se leen pero nunca se guardan / se ignoran | Reporte de la API (lo completa el supervisor) |
|---|---|---|---|---|---|---|
| 1 | **Flujo de Llamadas** (resumen, sub-pestañas, nivel de servicio y de atención, tasa de abandono) | Reporte de cola por skill **por día** (hoja `HistQueue…`) | Flujo de Llamadas (`trafico-logic.js`) | Obligatorias: `SKILL_NAME`, `DATE`, `INBOUND_CALLS`, `ANSWER_CALLS`. Si vienen: `ABANDON_CALLS`, `SERVICE_LEVEL_10SEC`, `SERVICE_LEVEL_20SEC`, `SERVICE_LEVEL_30SEC`, `ASA`, `ATA`, `WAIT_TIME`, `AHT` | `ABANDON` se reconoce pero no se lee (la tasa de abandono se recalcula). Solo cuentan las skills asignadas a Mobilize | |
| 2 | **Flujo por hora** (mapas de calor) | Reporte de cola por skill **por hora** (hoja `HistQueue…`) | Flujo por hora (`flujo-hora-logic.js`) | `DATE`, `HOUR`, `SKILL_NAME`, `INBOUND_CALLS`, `ANSWER_CALLS`, `ABANDON_CALLS` | El resto de columnas del reporte no se lee | |
| 3 | **Tipificación**; también da **Eficacia**, las **contestadas** de Llamadas Únicas y las **conectadas** de Llamadas de salida | CDR, «1. Detalle de las llamadas» (hoja `HistCDR…`) | Tipificación, canal Llamadas (`tipificacion-logic.js`) | Obligatorias: `AGENT_NAME`, `DATE`, `DESCRIPTION_COD_ACT`, `SKILL_NAME`. Si vienen: `HORA`, `TIME_MIN`, `TIME_SEC`, `COD_ACT`, `TYPE_INTERACTION`, `HUNG_UP`, `SKILL_ID` | `TELEPHONE` se usa **solo en memoria** para marcar la primera llamada de cada número por día (únicas) y nunca se guarda. `CUSTOMER_ID`, `CONN_ID`, `AGENT_ID`, `DESTINY`, `COST` y `COMMENT` están **prohibidas**: una prueba falla si se leen | |
| 4 | **Llamadas Únicas** (las **abandonadas**) | Skills y servicios, «2. Detalle de llamadas abandonadas» (hoja `HistQueue…`) | Abandonadas (`llamadas-unicas-logic.js`) | Obligatorias: `DATE`, `ANI`, `SKILL_NAME`. Si vienen: `RESULT`, `TYPE_INTERACTION` | `ANI` (teléfono) solo en memoria, para contar un número una vez por día. `CONN_ID`, `CUSTOMER_ID`, `SKILL_ID` y `ABANDON_TIME` no se leen | |
| 5 | **Llamadas de salida** (las **no conectadas**) | CDR, «5. Detalle de las llamadas no conectadas» (hoja `HistCDR…`) | No conectadas (`llamadas-salida-logic.js`) | `AGENT_NAME`, `DATE`. `RING_TIME` y `RESULT` son obligatorias solo para reconocer el reporte | `TELEPHONE`, `DESTINY`, `CUSTOMER_ID`, `CAMPAIGN_ID`, `AGENT_ID` y `CONN_ID` nunca se leen | |
| 6 | **Encuesta** (NPS, resultados por pregunta, comentarios) | Reportes, «4.» encuesta post-llamada (hoja `HistIVR…`) | Encuesta (`encuesta-logic.js`) | Obligatorias: `AGENT_NAME`, `SKILL_NAME`, `DATE`, `Q01`, `Q02`, `Q03`, `Q04`. Si vienen: `VOICE_MESSAGE` (comentario), `CONN_ID` | `ANI`, `AGENT_DNI`, `CUSTOMER_ID`, `Q05`–`Q10`, `RESULT` y `FEELING` se ignoran por nombre | |
| 7 | **Calidad** | No es de Wolkvox: monitoreos hechos en la plataforma, más el Excel de resumen por asesor | Calidad / Resumen por asesor | — | — | No aplica |

Siguen aceptándose las plantillas viejas que el supervisor armaba a mano (Llamadas Únicas con
`AGENT_NAME`, `DATE`, `TELEPHONE`, `SKILL_NAME`, y Llamadas de salida con `TIPO` o
`SKILL_ID`). Con la API ya no harían falta.

**Lo que necesito del supervisor en esta tabla:** para cada fila, el nombre del reporte de la
API y un ejemplo de su respuesta con **datos inventados**, o solo los nombres de los campos.
Así se ve si los campos se llaman igual que las columnas del Excel.

## 3. Dónde viven el token y el número de servidor

- **Solo en el servidor.** Ni en el repo, ni en el navegador, ni en GitHub, ni en un
  workflow, ni en el log de CI. Ninguna respuesta de la plataforma los devuelve.
- **Lugar:** AWS SSM Parameter Store, como `SecureString` bajo el prefijo que ya usa la
  instancia (`server/secrets.js`, `SSM_KEYS`; la política del rol de la instancia ya permite
  leer `/inconexion/prod/*`). Un par de parámetros por operación:
  - `WOLKVOX_MOBILIZE_TOKEN`
  - `WOLKVOX_MOBILIZE_SERVIDOR`

  Más adelante, `WOLKVOX_<OPERACION>_…` para cada operación nueva. `server/secrets.js` se
  amplía para leer las claves que empiezan por `WOLKVOX_`, sin tener que listarlas una por
  una.
- **Por confirmar:** si producción arranca hoy con `SSM_PARAM_PREFIX` o con `app.env`. Si es
  `app.env`, los dos valores van ahí, en la instancia, con permisos `600`. Lo carga el
  usuario por la consola de AWS o por SSH, nunca por un workflow del repo, y se documenta en
  `docs/infraestructura.md` **sin** los valores.
- **El código** (`server/wolkvox.js`) arma la URL en memoria y manda el token solo en el
  encabezado `wolkvox-token`. Los logs y el historial dicen «Wolkvox Mobilize: reporte X,
  01–10/11, 200, 1.234 filas, 2,1 s». Nunca registran la URL, el token, el número de
  servidor ni el cuerpo de la respuesta. Una prueba lo verifica revisando la salida de
  `console` durante una sincronización simulada.
- **Prueba de que no se filtra:** una búsqueda en `public/` y en las respuestas de `/api/*`
  no encuentra `wolkvox-token` ni el valor del token de prueba.

## 4. Cómo respetar el límite de uso

- **Nunca desde el navegador ni al abrir un tablero.** El tablero solo lee la base. Las
  llamadas a Wolkvox salen únicamente de la sincronización del servidor.
- **Sincronización programada** (un `setInterval` con `unref()`, como la limpieza de
  versiones en `server/server.js`, con un candado para que no corran dos a la vez):
  - **mes en curso:** cada N horas, para empezar 2 veces al día, desde el día 1 hasta ayer.
    Por defecto no se pide el día de hoy, que está incompleto;
  - **mes anterior:** una vez más los primeros días del mes siguiente, para cerrar el mes;
  - **meses cerrados:** no se vuelven a pedir, salvo con el botón «Sincronizar este mes» del
    administrador.
- **Consultas partidas:** siempre dentro de un mes, como exige la API. Si el reporte es
  grande (el CDR puede pasar de 15.000 filas al mes), se parte por días o semanas. El tamaño
  se decide con lo que se vea en la Fase W2.
- **Presupuesto:** una tabla `wolkvox_uso` (operación, día, llamadas hechas) y un tope
  configurable, `WOLKVOX_MAX_LLAMADAS_DIA`, menor que el límite de la licencia. Al llegar al
  tope, la sincronización se detiene y lo anota; no reintenta hasta el día siguiente. El
  botón manual también gasta del presupuesto y tiene una espera mínima entre usos.
- **Reintentos:**
  - con tiempo límite por llamada (≈30 s), hasta 3 intentos con espera creciente (30 s,
    2 min, 10 min) ante caída, tiempo agotado o error 5xx;
  - con 429, se espera lo que diga Wolkvox o se deja para la próxima corrida;
  - con 401 o 403 (token vencido o inválido) **no se reintenta**: queda en rojo para el
    administrador.
- **Registro de cada corrida:** tabla `wolkvox_sync` con operación, reporte, mes, desde,
  hasta, estado, filas, intentos, inicio, fin y un error corto. El error nunca guarda la URL
  ni la respuesta.
- **Escritura:** las filas pasan por **el mismo lector** del módulo, requerido en Node: se
  convierten los campos del JSON a las mismas columnas del Excel. Luego se guardan con el
  **mismo** escritor del servidor, que reemplaza por período en una transacción y respalda
  antes en `cargas_versiones`. Se registran en el Historial como «Sincronización Wolkvox» y
  se limpian las cachés de datos (`datos_version`). Así la API y el Excel calculan
  exactamente igual. Las columnas personales (teléfono y las prohibidas) se descartan en
  memoria; **nunca se guarda la respuesta cruda**.
- **Si Wolkvox está caído:** el tablero sigue mostrando lo último guardado. La «Última
  actualización» pasa a decir «Datos de Wolkvox al 10/11/2026 06:00». Si la última corrida
  falló, el administrador ve un aviso discreto, «No se pudo actualizar desde Wolkvox
  (reintento a las 12:00)». Nunca se borran datos por una sincronización fallida: si no llega
  respuesta completa, no se reemplaza nada.
- **Más adelante:** el monitor de producción (`monitor-produccion.yml`) o la revisión de
  salud del servidor pueden avisar si la última sincronización buena tiene más de X horas.
  Es un cambio de workflow, así que se consulta antes.

## 5. Carga manual y API en la réplica; cómo comparar

- **En la réplica, la fuente es la API.** La carga manual del Centro de cargas sigue
  funcionando ahí, por si hace falta, pero un mes cargado a mano lo reemplazaría la próxima
  sincronización. Por eso el Centro muestra el origen de cada mes («Wolkvox 10/11 06:00» o
  «Manual»), y la sincronización **no pisa** un mes marcado como manual salvo que el
  administrador lo pida.
- **Comparación sin tocar Mobilize real:** una pantalla, o un reporte, solo para el
  administrador: «Comparar con Mobilize». Para un mes, lee **en modo lectura** las cifras ya
  agregadas de `MOBILIZE` (cargado a mano) y las de la réplica (API), con las mismas
  funciones de agregación de cada pestaña, y muestra una tabla por indicador:

  | Indicador | Mobilize (manual) | Réplica (API) | Diferencia |
  |---|---|---|---|
  | Llamadas ingresadas / contestadas / abandonadas | … | … | … |
  | Nivel de servicio 10/20/30 s, ASA, AHT | … | … | … |
  | Flujo por hora (suma del mes y la hora pico) | … | … | … |
  | Tipificaciones (total y las 10 primeras) | … | … | … |
  | Eficacia | … | … | … |
  | Llamadas únicas, abandonadas, de salida conectadas y no conectadas | … | … | … |
  | Encuestas (cuántas, NPS y promedio por pregunta) | … | … | … |

- **Criterio para aprobar:**
  - los conteos deben ser **iguales**;
  - en porcentajes y tiempos se acepta ±0,1 punto o ±1 s, por redondeo;
  - cualquier otra diferencia se explica antes de seguir: hora de corte del reporte, zona
    horaria, llamadas de prueba, skills sin asignar o el día de hoy incompleto.

  Sale solo con totales, sin nombres de asesores ni teléfonos. Una prueba con datos
  sintéticos confirma que dos fuentes iguales dan diferencia 0.

## 6. Fases propuestas (de la más pequeña a la más grande)

Cada fase sigue el ciclo de siempre: rama, pruebas, CI verde, merge con
`--match-head-commit`, versión y verificación. Nada de esto se le muestra al cliente hasta
que esté aprobado.

| Fase | Qué se hace | Qué necesito de ti |
|---|---|---|
| **W0** (esta) | Este plan | Revisarlo con el supervisor y completar la columna de la sección 2 |
| **W1** | Réplica oculta **sin API**: `interno` en el registro, las funciones de acceso, la matriz de pruebas de la sección 1.2, y la migración que crea «MOBILIZE PRUEBAS API» con el tablero de Mobilize, vacío. Verificación en producción, solo lectura, con una cuenta de cliente y una de supervisor | El OK al nombre, y el OK para que la migración cree la réplica en producción (escribe en producción) |
| **W2** | `server/wolkvox.js`: cliente GET (encabezado, fechas `AAAAMMDDHHMMSS`, partición por mes, tiempo límite, reintentos, presupuesto, logs sin secretos), probado con un servidor falso local. Ruta del administrador «Probar conexión»: una llamada mínima que devuelve solo el estado, cuántas filas y los **nombres** de los campos | El token de Mobilize y el número de servidor, cargados por ti en SSM o en `app.env`, nunca por chat. La ruta y los parámetros de Postman **sin token**. El límite exacto de la licencia. Saber si Wolkvox exige lista blanca de IP (te doy la IP de salida de la instancia) |
| **W3** | **Flujo de Llamadas** desde la API (reporte por skill por día) en la réplica, con el botón «Sincronizar este mes» y la comparación contra Mobilize de un mes cerrado | El nombre del reporte, la lista de skills de Mobilize y un mes de referencia ya cargado a mano |
| **W4** | **Flujo por hora** | El reporte por hora, si es otro |
| **W5** | **CDR → Tipificación**, Eficacia, contestadas únicas y conectadas de salida: el de más volumen y con datos personales en la respuesta. Se descartan en memoria y hay prueba de que no se guardan | El nombre del reporte CDR y si viene paginado |
| **W6** | **Abandonadas** y **no conectadas** | Sus dos reportes |
| **W7** | **Encuesta** (HistIVR) | El reporte de la encuesta |
| **W8** | **Sincronización programada**, con `wolkvox_sync`, `wolkvox_uso`, el estado «Datos de Wolkvox al…», los avisos y el origen por mes en el Centro de cargas | La frecuencia deseada y el tope diario |
| **W9** | **Aprobación y paso a Mobilize real**, módulo por módulo, solo con el OK del supervisor y del cliente. La carga manual queda como respaldo | El OK escrito. Para otra operación, su token y su servidor |

## 7. Riesgos y preguntas abiertas

**Riesgos**

- **Límite de la licencia:** si se agota, se pierde la sincronización del día. Para
  mitigarlo: tope propio menor que el de la licencia, meses cerrados que no se vuelven a
  pedir, y nunca llamadas desde el navegador.
- **Datos personales en la respuesta:** el CDR y la encuesta traen teléfonos y otros datos
  del cliente final. Se aplica la misma lista de columnas permitidas que en los Excel, se
  descarta todo en memoria, nunca se guarda ni se registra la respuesta, y las pruebas usan
  solo datos sintéticos.
- **Secretos en un repo público:** el token o el servidor podrían colarse en logs, errores o
  capturas. Se mitiga con logs sin URL, errores recortados, la prueba de la sección 3 y que
  ningún workflow los use.
- **Las cifras no coinciden con el Excel:** puede pasar por zona horaria, hora de corte,
  formato de % o de tiempos, o llamadas de prueba. Por eso existe la comparación de la
  sección 5 antes de aprobar.
- **Fuga de la réplica:** que alguien la vea por una ruta que no revise el acceso. Se mitiga
  con la matriz generada desde `router.stack` y con la verificación en producción con
  cuentas reales de cliente y supervisor.
- **Wolkvox caído o lento:** se muestra el último dato con su fecha y hora, y nunca se borra
  nada si la respuesta no llegó completa.
- **Volumen:** el CDR tiene 15.000–30.000 filas al mes. Se pide por partes, se escribe en una
  transacción y nunca se mandan filas crudas al navegador.
- **Cargas simultáneas:** una sincronización mientras alguien sube a mano. Se usa el mismo
  candado de `server/cargas-simultaneas.js`.

**Preguntas abiertas** (para el supervisor y para Wolkvox)

1. ¿Qué reporte de la API corresponde a cada fila de la tabla de la sección 2?
2. ¿El límite es por día, por hora o por minuto? ¿Cuánto es para Mobilize? ¿Qué responde
   Wolkvox al pasarlo?
3. ¿Los campos del JSON se llaman igual que las columnas del Excel? ¿Cómo vienen los
   porcentajes y los tiempos?
4. ¿Las fechas de la respuesta están en hora Colombia? ¿La fecha final es incluyente?
5. ¿Los reportes grandes (CDR) vienen paginados o tienen un tope de filas por respuesta?
6. ¿El token vence? ¿Exige lista blanca de IP?
7. ¿Con qué frecuencia quiere el supervisor ver el mes en curso actualizado?
8. ¿La réplica debe tener también Calidad (monitoreos), o solo lo de Wolkvox?
9. ¿Se pide también el día de hoy, que está incompleto, o solo hasta ayer?
