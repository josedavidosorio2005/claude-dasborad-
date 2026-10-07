# Pendientes (reorganizado Fase 124, 2026-10-06)

Un solo lugar para lo que falta. Reorganizado en 5 secciones (antes era
cronológico por fase) para que se vea de un vistazo qué bloquea la
entrega a Edwin, qué depende de él, qué depende de una decisión de InCo,
y qué es deuda técnica con costo/riesgo ya estimado. Lo ya cerrado no se
deja aquí — queda en `docs/historico/progress-fases.md`. Cada ítem tiene
dueño, prioridad, cómo se cierra, y la fecha en que se anotó.

## 1. Antes de entregar a Edwin

- **Contraseña temporal del usuario CLIENTES_DASH** — dueño: InCo. Prioridad
  ALTA. Cómo se cierra: InCo la cambia desde la propia plataforma (nunca
  queda en el repo/commits/logs). Anotado 2026-10-02 (Fase 112), sigue sin
  hacerse. Efecto concreto más reciente: la verificación post-deploy de
  la Fase 125 no pudo confirmar el lado CLIENTES_DASH de producción
  (`scripts/produccion/revision-final.js` espera 2 sesiones, una por
  cada rol) — solo se verificó ADMINISTRADOR. Repetir esa mitad es
  trivial en cuanto haya una contraseña de cliente a mano, sin tocar
  nada más.
- **Visibilidad de nombres de asesor para CLIENTES_DASH** — dueño: InCo
  (decisión) + InCo (ejecución si aplica). Prioridad ALTA — desde la Fase
  122, Agendas y Efectividad de Agendamiento muestran el nombre real del
  asesor a CUALQUIER rol con acceso a ORLANT, incluido CLIENTES_DASH
  (antes solo Tipificación lo hacía). **Desde la Fase 130, Calidad
  también** — el panel nuevo "Promedio de calidad por asesor" (nombre +
  % de puntaje, sin número de monitoreos) usa el mismo filtro de acceso
  por campaña que el resto del dashboard de ORLANT (`campaignAccess`,
  sin distinción por rol) — no se cambió ningún permiso al agregarlo,
  solo se confirmó que el panel hereda exactamente el mismo público que
  ya veía Agendas/Efectividad. Cómo se cierra: decidir con el usuario si
  la cuenta del cliente debe seguir viendo esos nombres (ahora también
  con su nota de calidad) o si hay que redactarlos para ese rol. Anotado
  2026-10-06 (Fase 124, antes solo mencionado como pendiente de decisión
  en la Fase 122), actualizado 2026-10-07 (Fase 130).
- **Exports reales (Excel) de Tipificación, Efectividad de Agendamiento,
  Efectividad de Citas y Agendas: abrir el archivo real y revisar PII /
  fórmulas / columnas vacías** — dueño: InCo. Prioridad MEDIA, reducida en
  la Fase 125. La descarga automática SÍ funcionó en la Fase 125 (local,
  `download.saveAs()` normal, sin el error "Cannot access file" que la
  Fase 124 vio 2 veces contra producción — parece confirmarse que fue una
  interacción puntual Playwright/Chromium/Windows contra ESE entorno, no
  un problema reproducible). Con eso, la Fase 125 releyó 3 exports reales
  (Agendas, Ranking de Efectividad de Agendamiento, Tipificación de
  Llamadas) con un parser de ZIP/XML independiente
  (`server/tests/helpers/xlsx-lite.js`, no la misma librería SheetJS que
  escribe el archivo): abren correctamente, cuadran con la tabla en
  pantalla, sin columnas de PII (sede/examen/profesional/entidad de
  Agendas no aparecen en ningún export — solo se usan para agregación) y
  con las celdas de fórmula neutralizadas de verdad en el archivo (no solo
  en memoria). **Sigue pendiente**: Efectividad de Citas y Tipificación de
  WhatsApp (sin datos sintéticos probados en esta fase) y el único paso
  que sigue siendo manual — abrir el archivo en Excel/LibreOffice de
  verdad (el parser independiente confirma que el formato es válido y el
  contenido correcto, pero no reemplaza abrirlo en la aplicación real).
  Anotado 2026-10-06 (Fase 124), actualizado 2026-10-06 (Fase 125).

## 2. Esperando a Edwin (datos/decisiones)

- **19 asesores del archivo real de Calidad sin usuario ASESOR en la
  plataforma** — dueño: InCo/Edwin. Prioridad MEDIA. La carga masiva de
  Calidad (`POST /monitoreos/bulk`) guarda el nombre de asesor como
  texto libre, nunca requiere un usuario — no bloquea nada — pero
  ninguno de los 19 asesores reales de septiembre puede todavía ver su
  propia nota ("Mis Resultados") porque no tiene cuenta. Cómo se cierra:
  crear esos usuarios (rol ASESOR, campaña ORLANT) cuando InCo/Edwin lo
  pida — no se crean solos. Anotado 2026-10-07 (Fase 130).
- **Observaciones de Calidad: hallazgo de diseño, no corregido, requiere
  decisión** — dueño: InCo (decisión). Prioridad MEDIA. El diseño actual
  guarda `# Teléfono` e `ID/Llamada-Wpp` en la tabla `monitoreos` (todas
  las campañas con Calidad, no solo ORLANT) y el formulario manual
  también los pide — contradice la regla de "nunca guardar # Teléfono"
  de esta fase. Ninguno se muestra en tablas/exports hoy; el campo
  `observaciones` (texto libre del evaluador, puede traer datos de
  paciente) SÍ lo ve el propio asesor en "Mis Resultados" (su propia
  nota, diseño ya existente, no de esta fase) — nunca CLIENTES_DASH.
  Decisión del usuario 2026-10-07: dejarlo así por ahora — no se tocó.
  Anotado 2026-10-07 (Fase 130).
- **Export a Excel del panel "Promedio de calidad por asesor"** — dueño:
  InCo (decisión). Prioridad BAJA. El panel nuevo (Fase 130) queda FUERA
  del botón "Exportar" a propósito — un Excel con nombre + nota es una
  superficie de privacidad nueva (quien lo descarga se lo lleva) que
  nadie pidió todavía. Si hace falta, es un cambio chico
  (`_gdExportarCalidad`/`dashboard-generic.js`). Anotado 2026-10-07
  (Fase 130).
- **Ordenamiento Médico, Recuperación de Cancelados, Flujo Mensual,
  Gestión STA** — dueño: Edwin. Prioridad BAJA (pestañas ya construidas,
  ocultas esperando el archivo real). Anotado en fases anteriores (ver
  `docs/inventario-bases-orlant.md`). "Salida" ya no está en esta lista
  — tiene base propia desde la Fase 127 (ver preguntas abiertas más
  abajo).
- **Pregunta a Edwin: efectividad de agendamiento > 100%** — dueño:
  Edwin. Prioridad MEDIA. Varios asesores quedan por encima de 100% en
  los archivos reales de ago-sep/2026 (confirmado de nuevo en la Fase
  124: ago 3 asesores sobre 100% — máx 180.97% —, sep 2 asesores — máx
  387.31% —, el combo/ranking los dibuja completos y con formato
  correcto). No es error de carga. Pregunta de negocio: ¿agendan por
  fuera de las gestiones que se están contando? Anotado 2026-10-05. El
  punto técnico que la Fase 124 había dejado "no verificado" (si el eje
  secundario recorta la línea/etiquetas con valores tan altos) se
  confirmó en la Fase 125 con datos sintéticos de 118%/181%/387%: Chart.js
  autoescala el eje con margen real (ej. tope de 400% con un máximo de
  387% en los datos) y la captura de pantalla no muestra ningún recorte —
  **no es un defecto**, solo falta la respuesta de negocio de Edwin.
- **Pregunta a Edwin: "hay que quitar esa letra"** — dueño: Edwin.
  Prioridad BAJA. Mención suelta en la reunión del 2026-10-05, sin
  precisar a qué se refería. Preguntarle la próxima vez.
- **Nivel de servicio de WhatsApp a 5 minutos** (`SERVICE_LEVEL_5MIN`) —
  dueño: Edwin/Wolkvox + el jefe (decisión). Prioridad MEDIA. El export
  diario real no trae esa columna; Edwin lo habla con el jefe. Anotado
  2026-10-04 (Fase 116).
- **Plantillas oficiales versionadas** — dueño: Edwin (pedido explícito:
  "eso lo vemos después de la entrega") + InCo. Prioridad BAJA por ahora.
  Ver `docs/plantillas-inventario.md` (Fase 124) para el inventario
  completo de diferencias entre lo que la plataforma descarga hoy, lo que
  el lector real exige, y lo que Edwin/Wolkvox mandan en la práctica.
- **AHT de Tráfico de WhatsApp** — ya resuelto (quitado, Fase 120) — sigue
  aquí solo como recordatorio: si Wolkvox llega a entregarlo, reactivarlo
  es solo `mostrarAht:true` en `PUT /dashboards/config/ORLANT`, sin tocar
  código.
- **Nivel de Servicio a 5 minutos de WhatsApp** — igual que el AHT de
  arriba (Fase 126): retirado de pantalla (`mostrarSL5min:false`), el
  cálculo sigue en el código. Si Wolkvox manda `SERVICE_LEVEL_5MIN`,
  reactivarlo es `mostrarSL5min:true` en `PUT /dashboards/config/ORLANT`.
- **Indicador de llamadas y WhatsApp de Salida — construido en la Fase
  127, renombrado y reubicado en la Fase 128 (Parte 1)** (pedido textual
  de Edwin: "las llamadas de salida están muy bajas, hay que
  revisarlo"; archivo recibido
  `FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx`). Ya no es una propuesta:
  pestaña **"Llamadas y WhatsApp de salida"** (tabla propia
  `salida_mensual`, antes llamada solo "Salida" — renombrada por pedido
  textual de Edwin en la reunión de validación del 2026-10-06, el
  nombre corto no se entendía como concepto; reubicada junto a "Tráfico
  de WhatsApp"), cargador con confirmación explícita del año del mes
  antes de guardar. Verificado "LINEA DE SALIDA" de Tipificación de
  Llamadas: los totales mensuales del archivo de Edwin coinciden EXACTO
  con ese skill (6.560 en ago-26, 10.404 en sep-26) — confirmado como la
  misma línea. Preguntas que Edwin no definió y la plataforma **no
  inventó**:
  - **Denominador del %**: Edwin pidió "un indicador simple, el mes y la
    cantidad, con porcentaje si aplica" pero nunca dijo contra qué
    denominador (¿salida ÷ gestión total del asesor/día? ¿salida ÷
    llamadas de entrada del mismo período?). Hoy la plataforma muestra
    solo lo que no requiere inventar un denominador: el total del mes,
    la variación contra el mes anterior, y la participación de 3P/General
    DENTRO del total de salida de ese mismo mes. Falta la respuesta de
    Edwin para agregar un % contra otra base.
  - **Qué significa "3P"**: se asume el mismo significado que en el
    resto de la plataforma (Línea 3P vs. Línea General, igual que
    Tráfico/Agendas), pero nunca se confirmó explícitamente para Salida
    — preguntar a Edwin si aplica el mismo criterio.
  - **Total acumulado además del filtro por mes** (pedido de Edwin,
    mencionado en la reunión de validación del 2026-10-06, a futuro —
    **NO implementar todavía**, queda anotado para cuando se pida
    formalmente): hoy la pestaña solo muestra mes por mes (con la
    variación contra el mes anterior) — Edwin mencionó que más adelante
    quiere ver también un acumulado del período completo, igual que
    "Efectividad de Citas" ya tiene su % ponderado del período. Sin
    alcance ni fecha definida todavía.

## 3. Esperando decisión de InCo

- **Flujo Mensual**: ¿se retira del todo (código + pestaña oculta) o se
  deja esperando? Prioridad BAJA. Anotado Fase 115 (2026-09-21), sigue
  sin decidirse.
- **Nivel de servicio** (posible base aparte que mencionó Edwin) —
  aclarar si se refiere a algo distinto de lo que ya existe (SL 20s en
  Tráfico). Prioridad BAJA. Anotado en fases anteriores.
- **Tráfico de Llamadas sin `campaignAccess` en la carga** (solo
  `canLoadData` genérico) — hallazgo de severidad BAJA de la Fase 119,
  **re-ejecutado y confirmado igual en la Fase 124**
  (`server/tests/fase119-matriz-cargas-masivas.test.js`, 9/9 pass). Es la
  ÚNICA de las 7 familias de carga masiva sin ese control puntual — fue
  una decisión explícita documentada (un archivo de Tráfico trae varias
  skills que pueden resolver a campañas distintas). Arreglarlo exige
  rediseñar ese modelo. **No se toca sin tu OK explícito** (regla fija de
  esta fase). Riesgo real hoy: bajo (Aurora/HLM siguen en cero datos).

## 4. Técnico (con costo y riesgo — ninguno aplicado sin pedirlo)

- **Lección de la Fase 126 — "conteo de filas" no es lo mismo que
  "categorías distintas"**: el inventario de la Parte 1 de esa fase midió
  Inasistencia como "especialidades distintas por mes" (17-18) para
  decidir qué borrar — un proxy liviano, pensado para armar la tabla
  base×mes rápido. El conteo REAL de filas de la tabla (que varía también
  por sede y entidad, no solo especialidad) resultó ser **2.312** para
  Ene-Jul/2026, no ~121 como ese proxy sugería. El endpoint de borrado
  (`POST /api/admin/borrado-rango`) detectó la discrepancia solo y abortó
  sin borrar nada (el candado `filasEsperadas` funcionó exactamente para
  esto) — se pausó, se le mostró el número real al usuario, y se borró
  recién con su OK explícito sobre esa cifra. No fue un error de la
  plataforma, fue un error de estimación en el inventario. Para una
  próxima fase que necesite "cuántas filas hay": usar el dry-run del
  endpoint de borrado (o una consulta `COUNT(*)` equivalente) como la
  fuente de verdad, nunca un conteo de categorías distintas como proxy.
- **`scripts/produccion/revision-final.js` no cubre todavía ATA (voz y
  WhatsApp) ni el desglose mes a mes de Tipificación de WhatsApp
  (Jul/Ago/Sep) ni de Tráfico (Ago vs. Sep por separado)** — confirmado
  al revisar el script a fondo en la Fase 125 (2026-10-06) antes de
  usarlo para la verificación post-deploy: solo arma totales agregados
  del período y una verificación por skill/cola × mes para Llamadas,
  WhatsApp de voz y Tipificación de Llamadas — nunca para esos 4 datos
  puntuales. No es un defecto de la plataforma (la Fase 124 sí confirmó
  esos 9 valores completos a mano, ver `PROGRESS.md`), es una brecha de
  cobertura del script mismo. Costo de cerrarlo: bajo-medio (agregar los
  cálculos ponderados correctos, con cuidado de no inventar una fórmula
  distinta a la que ya usa el dashboard). No pedido todavía.
- **Límite de tamaño por carga — corrección de un hallazgo mal planteado
  en la Fase 124** (Fase 125, 2026-10-06; ver nota de corrección al
  final de la Fase 124 en `docs/historico/progress-fases.md`). La Fase
  124 trató el límite de 8 MB de `RUTAS_LIMITE_MAYOR` (`server/server.js`)
  como si fuera un margen ACUMULADO que se agota carga tras carga, y
  proponía subirlo a 16 MB. Está mal planteado: ese límite
  (`express.json({limit:'8mb'})`) es por CARGA — un solo archivo/petición
  — no acumulado; lo que ya quedó guardado en la base no cuenta contra él
  en la carga siguiente. Una carga mensual normal cabe con margen amplio
  en cualquier mes futuro; el límite solo aprieta si alguien sube varios
  meses juntos en un único archivo. **Se retira la propuesta de subir a
  16 MB** — no hace falta con el patrón de carga real (un mes a la vez).

  | Ruta | Bytes/fila | Medido o estimado | Máximo de filas por carga (límite 8 MB) |
  |---|---|---|---|
  | Agendas (`/calidad/agendas/carga`) | 212,9 | **medido** (archivo real ago-sep/2026: 4,91 MB / 24.186 filas) | ≈ 39.000 (≈ 3 meses juntos al ritmo actual de ~12.100 filas/mes) |
  | Tipificación de voz (`/calidad/tipificacion/carga`) | 96,8 | **estimado** (3,2 MB / 34.661 filas, dato de fases anteriores — el intento de remedirlo con el archivo real falló por un error del script, no de la plataforma) | ≈ 86.000 (≈ 5 meses juntos al ritmo actual de ~17.300 filas/mes) |
  | Tipificación de WhatsApp, Tráfico (Llamadas/WhatsApp), Inasistencia, Efectividad (Agendamiento/Citas) | — | **no medido** — usan el límite global de 2 MB; estructuralmente muchas menos columnas y/o filas (Tráfico nunca pasó de 258 filas reales) | no calculado, muy poco probable que se acerquen |

  **Regla práctica:** subir un mes a la vez; si hay que subir varios
  meses juntos, partir el archivo por mes antes de cargar. La Fase 125
  agregó un aviso del lado del cliente antes de enviar
  (`public/js/cargas.js`): si el payload estimado de Agendas o
  Tipificación supera el 85 % del límite de su ruta, avisa ANTES de
  enviar ("este archivo es muy grande para una sola carga... no se
  guardó nada") en vez de dejar que lo resuelva solo el 413 del
  servidor — ese 413 ya tenía un mensaje claro desde la Fase 122
  (confirmado de nuevo en la Fase 125, sin duplicarlo).
- **No hay UI de administración para alias de asesor** — hoy el alta,
  lista y borrada de alias solo existen por API directa
  (`/api/alias-asesores`), nunca desde una pantalla — confirmado
  revisando todo `public/` (ningún archivo de frontend lo referencia).
  Edwin no puede corregir un typo de asesor nuevo el mes que viene sin
  pedirle a InCo que corra una llamada directa a la API. Costo de una
  pantalla simple (tabla + alta + borrado, mismo patrón que el catálogo
  de codificaciones de Calidad): medio. Riesgo: bajo. No pedido todavía.
- **Alias de asesor no se aplica en Calidad** (el campo `ASESOR` de la
  carga masiva de monitoreos) — confirmado revisando el código
  (`aplicarAliasAFilas` solo se llama desde `agendas.js`,
  `efectividad-agendamiento.js` y `tipificaciones.js`, nunca desde
  Calidad). Inasistencia y Efectividad de Citas NO tienen columna de
  nombre de asesor en absoluto (estructuralmente no aplica ahí). Efecto:
  si el mismo asesor llega con 2 variantes de nombre en una carga masiva
  de Calidad, Calidad lo seguiría mostrando separado aunque
  Agendas/Efectividad/Tipificación ya lo unifiquen. Severidad baja (solo
  afecta la carga masiva opcional de Calidad, no el registro manual
  monitoreo por monitoreo). Costo de extenderlo: bajo (una línea más,
  mismo patrón). No pedido todavía.
- **`npm test` local se vuelve inestable en la máquina de InCo** —
  confirmado de nuevo en la Fase 124: una corrida completa produjo
  decenas de `ETIMEDOUT` en pruebas de supertest (`fase95-tema-c-alerta-
  asesor.test.js`, `gestion-humana.test.js`, `historial.test.js`,
  `inasistencia-carga.test.js`, entre otras) y terminó sin imprimir el
  resumen final (`# pass`/`# fail`) — no es un bug de esas pruebas (la
  misma suite corre en verde en CI, Node 22, en cada PR reciente): es un
  límite de recursos de esta máquina en particular (ya documentado como
  conocido antes de esta fase). No se investigó más a fondo (saldría caro
  diagnosticar límites del sistema operativo/antivirus de una máquina
  específica) — **CI (Node 22) sigue siendo la referencia real**, como ya
  indica `CLAUDE.md`.
- **Cobertura con Playwright real para las 9 bases, con archivos
  SINTÉTICOS con la forma exacta de los reales** (hoja con nombre
  variable tipo `HistChat<fecha>-<hora>`, celdas de fecha boxeadas,
  porcentajes >100%, encabezados en fila 3, hoja de 30.000 filas, hoja
  vacía con formato) — **NO construido en esta fase**: es, en sí mismo,
  un proyecto de varios días (un arnés nuevo por base, con fixtures
  sintéticos a medida). La Fase 124 SÍ corrió un barrido real contra
  PRODUCCIÓN (no sintético) de lo que la 122 había dejado sin ver — ver
  `scripts/produccion/fase124-parte1-pendientes-fase122.js` — pero eso es
  distinto de un arnés local reutilizable fase tras fase con datos
  sintéticos. Costo estimado: alto (días, no horas). Riesgo de NO
  tenerlo: medio — ya se demostró en la Fase 122 que un defecto puede
  pasar pruebas unitarias en verde y solo aparecer con el archivo real en
  la página real. Propuesta: empezar por las 2 bases que ya mostraron
  defectos reales (Tipificación de WhatsApp por el `labelAlt` perdido, y
  Agendas por el límite de tamaño), no las 9 de una vez.
- **Fallas de red/500/carreras de la interfaz (cerrar el modal a mitad de
  carga, token vencido a mitad de una carga, archivo corrupto/0 bytes/hoja
  vacía)** — **NO cubierto en esta fase** por el mismo motivo de alcance
  (sería un arnés Playwright nuevo, grande, con interceptación de red
  simulando cada falla). Pedido de nuevo desde la Fase 118/119, sigue sin
  cubrirse. Costo estimado: medio-alto. Riesgo de NO tenerlo: bajo-medio
  (las escrituras ya usan `db.transaction`, confirmado por lectura de
  código en las 9 bases, pero nunca ejecutado con una falla inyectada a
  mitad de carga en esta fase particular — sí se ejecutó esa prueba en
  fases anteriores para algunas bases, ver Fase 119).
  El caso del **doble clic en "Confirmar carga"** sí se revisó en la Fase
  125 (por lectura de código, no con clics reales): `guardarCarga()` pasa
  por `withButtonLoading()` (`public/js/ui-core.js`), que pone
  `btn.disabled=true` de forma SÍNCRONA antes de cualquier `await` — un
  segundo clic sobre un botón ya deshabilitado nunca llega a disparar su
  manejador (comportamiento del navegador, no de esta app). Es una prueba
  estructural (imposible por construcción), no solo "no se observó en la
  prueba" — pero sigue sin un test automatizado que lo deje fijado como
  regresión.
- **Casos de borde del reemplazo por rango, matriz completa × 9 bases**
  (archivo de 1 solo día, skill/cola nueva, cruce de mes, mes parcial,
  re-subida idéntica fila por fila, 2 meses cuando ya existe 1, fecha
  futura, atomicidad con falla inyectada) — cubierto PARCIALMENTE en
  fases anteriores (Fase 119: las 7 bases principales, ver
  `server/tests/fase119-cargas-multi-mes.test.js`); **no se repitió ni se
  completó la matriz entera en la Fase 124** por tiempo. Costo de
  completar lo que falta (archivo de 1 día explícito, re-subida idéntica
  con aserción "0 cambios" fila por fila, archivo de varios meses de una
  sola vez): medio.
- **XSS dinámico campo por campo con payloads reales — EJECUTADO
  parcialmente en la Fase 125** (hasta la Fase 124 solo se había
  confirmado por lectura de código). Con Playwright real contra el
  servidor local (`seed:demo`), payloads (`<img src=x onerror=alert(...)>`,
  `"><script>...</script>`, `'><svg onload=alert(...)>`, inyección de
  fórmula `=2+2+cmd|...`) cargados vía API en: **Agendas** (especialidad,
  tipo de línea), **Efectividad de Agendamiento** (nombre de asesor, en
  tabla + categoría de la gráfica + leyenda + buscador de asesor) y
  **Tipificación de Llamadas** (motivo). En los 3: 0 diálogos nativos
  (`alert`/`confirm`) disparados, 0 `<img>`/`<script>`/`onmouseover`/
  `onload` reales creados en el DOM (el payload queda como texto literal
  escapado) y el Excel exportado de cada vista — releído con un parser de
  ZIP/XML independiente del que escribe el archivo
  (`server/tests/helpers/xlsx-lite.js`, no SheetJS) — trae el payload
  como texto plano, y la celda de fórmula queda neutralizada con una
  comilla simple por delante (`'=2+2+cmd...`), confirmando que la
  protección sobrevive al archivo real, no solo en memoria.
  **No verificado en esta fase** (queda para una próxima pasada): los
  campos de Agendas que no se renderizan en ninguna vista del dashboard
  hoy (sede, examen, profesional, entidad — solo se usan para agregación,
  no aparecen en pantalla ni en export, así que no se pudo confirmar su
  escape visualmente, aunque pasan por el mismo `esc()`/`xlsxCeldaSegura`
  que el resto), el campo SKILL de Tipificación, el canal WhatsApp (sin
  datos sintéticos cargados), el nombre de archivo en Historial (la
  carga sintética con nombre payload no apareció en la primera página del
  listado dentro del tiempo de esta prueba — no se confirmó ni se
  descartó), Calidad, y el export a PDF. Costo de cerrar el resto: bajo
  (mismo patrón, más tiempo). Riesgo de lo que falta: bajo (misma función
  `esc()`/`xlsxFilasSeguras` ya demostrada en los campos sí probados, sin
  ninguna ruta de renderizado distinta conocida para los campos que
  faltan).
- **Código muerto fuera del hallazgo puntual de esta fase** — se borró
  `traficoWppResumen` (confirmado sin llamadores, Fase 124). Un barrido
  completo con `graphify` del resto del código (funciones/archivos sin
  referencias, estilos sin uso, endpoints sin cliente) sigue sin hacerse
  — pedido desde la Fase 118/119/120, sigue sin alcanzar el tiempo.

- **Limitador de la API para tráfico SIN sesión — sigue por IP, no por
  usuario** — dueño: InCo (decisión). Prioridad BAJA/MEDIA. La Fase 130
  (Parte 7) separó el limitador general en dos cupos: quien YA inició
  sesión cuenta por usuario (1.500 peticiones/15 min, nunca comparte cupo
  con sus compañeros de oficina); quien todavía NO inició sesión (la
  página de login, `/api/health`, un token vencido) sigue contando por
  IP, sin cambios (300 peticiones/15 min). Eso resuelve el caso real que
  disparó esta fase (una revisión administrativa completa, ~70
  peticiones, agotando el cupo compartido de toda una oficina) pero deja
  abierto un caso más chico: muchas personas iniciando sesión casi al
  mismo tiempo desde la misma IP (ej. toda una oficina al inicio del día)
  todavía comparten ese cupo de 300 antes de autenticarse. Opciones para
  cuando se quiera cerrar esto también (ninguna aplicada todavía):
  1. **Subir el límite anónimo** (ej. 300 → 600/15 min). Riesgo: bajo,
     pero sigue siendo un número arbitrario — solo corre el problema más
     lejos, no lo elimina.
  2. **Extender la clave por usuario también a rutas sin sesión que lo
     permitan** (ej. `/api/auth/login` ya tiene su propio limitador por
     IP+usuario desde esta misma fase — ver más arriba — así que el
     riesgo real hoy es solo peticiones genéricas sin sesión, no login).
     Riesgo: bajo, pero no hay "usuario" que identificar antes de que
     alguien se autentique, así que no aplica igual que para el tráfico
     autenticado.
  3. **Excluir del limitador los `GET` de solo lectura más livianos**
     (ej. `/api/health`) **del cupo anónimo**. Riesgo: bajo para ese caso
     puntual, pero hay que revisar caso por caso cuáles rutas anónimas
     existen hoy antes de excluir cualquiera (evitar abrir una puerta a
     abuso real sin límite).
  Anotado 2026-10-07 (Fase 130, Parte 7).

## 5. Después de la entrega (no pedido todavía)

- **Fase de plantillas oficiales** (carpeta versionada, que Isabel pueda
  descargar/pegar/subir sin ayuda de InCo) — pedido explícito de Edwin:
  "eso lo vemos después". Ver `docs/plantillas-inventario.md` (Fase 124)
  para el inventario que esa fase va a necesitar.
- **Barrido visual completo** (claro/oscuro × 1366×768/1920×1080/móvil
  412px × mes con/sin datos, las 7 pestañas × todas las sub-pestañas) —
  la Fase 124 SÍ cubrió tema oscuro + 1920×1080 + móvil para las 7
  pestañas/sub-vistas (0 errores de consola, 0 peticiones fallidas, 0
  canvas sin dibujar en los 5 combos nuevos) contra producción real, pero
  fue un chequeo automático (consola + canvas con píxeles), no una
  revisión visual humana de cada combinación una por una. Queda para
  después si se quiere ese nivel de detalle.
- **Inventario y respaldo de la cuenta AWS vieja** (`934685482338`) —
  necesita credenciales de esa cuenta, sin empezar.
- **Política 1 de IAM pendiente** (`s3:ListBucket`+`s3:GetObject`
  acotado) — bloquea la prueba real de restauración de backups. Necesita
  credenciales de AWS a mano.
- **Clínica Aurora / Hospital La María** — siguen en cero datos reales,
  no es un pendiente operativo, es el estado esperado hasta que haya
  pedido real.
- **Dependencias mayores congeladas** (`better-sqlite3` 13, `dotenv` 18) —
  decisión del usuario, no se tocan sin pedirlo.
- **Keystore** — sin tocar, fuera de alcance de esta fase (regla fija).
