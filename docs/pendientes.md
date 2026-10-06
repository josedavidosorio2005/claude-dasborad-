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
  hacerse.
- **Visibilidad de nombres de asesor para CLIENTES_DASH** — dueño: InCo
  (decisión) + InCo (ejecución si aplica). Prioridad ALTA — desde la Fase
  122, Agendas y Efectividad de Agendamiento muestran el nombre real del
  asesor a CUALQUIER rol con acceso a ORLANT, incluido CLIENTES_DASH
  (antes solo Tipificación lo hacía). Cómo se cierra: decidir con el
  usuario si la cuenta del cliente debe seguir viendo esos nombres o si
  hay que redactarlos para ese rol. Anotado 2026-10-06 (Fase 124, antes
  solo mencionado como pendiente de decisión en la Fase 122).
- **37 monitoreos de prueba de Calidad** — dueño: Edwin (confirmación) +
  InCo (borrado si aplica). Prioridad MEDIA. Siguen en producción, sin
  tocar (regla fija: no se tocan sin pedido explícito). Cómo se cierra:
  Edwin confirma si son datos reales o de prueba; si son de prueba, InCo
  los borra por la interfaz normal. Anotado 2026-09-24 (Fase 71/119),
  reconfirmado sin tocar en la Fase 124 (2026-10-06).
- **Exports reales (Excel) de Tipificación, Efectividad de Agendamiento,
  Efectividad de Citas y Agendas: abrir el archivo real y revisar PII /
  fórmulas / columnas vacías** — dueño: InCo. Prioridad MEDIA. El primer
  intento (Fase 124) falló por un bug del propio script de verificación
  (`download.saveAs()` sin `downloadsPath` configurado) — ya corregido en
  `scripts/produccion/fase124-parte1b-exports.js`, pendiente de
  reintentar con una sesión real (se puede hacer junto con la
  verificación post-deploy de esta misma fase). Anotado 2026-10-06.
- **Guía de uso (`docs/guia-uso-orlant.md` y `server/paginas/guia-uso.html`)
  al día con lo nuevo de la Fase 122-124** — dueño: InCo. Prioridad MEDIA.
  Falta documentar: Agendas/Efectividad con nombre de asesor, formato
  HistChat (hoja con nombre variable), alias de asesor (qué es, que no
  revierte datos ya unificados al borrarse), nombres de mes completos,
  "Julio 2026" como mes parcial, y marcar explícitamente las filas "por
  confirmar" del "Calendario mensual de cargas" como pendientes de Edwin
  (ya existían desde la Fase 119, siguen sin precisar). No se alcanzó a
  escribir en esta fase por tiempo — contenido para el cliente final, no
  conviene apurarlo. Anotado 2026-10-06 (Fase 124).

## 2. Esperando a Edwin (datos/decisiones)

- **Efectividad de Citas de agosto y septiembre/2026** (columnas MES,
  AGENDAS, ATENDIDAS) — dueño: Edwin (envío) + InCo (carga). Prioridad
  ALTA. Producción sigue solo con Ene-Mar/2026. Anotado 2026-10-05
  (reunión), sigue sin llegar.
- **Ordenamiento Médico, Recuperación de Cancelados, Flujo Mensual,
  Salida, Gestión STA** — dueño: Edwin. Prioridad BAJA (pestañas ya
  construidas, ocultas esperando el archivo real). Anotado en fases
  anteriores (ver `docs/inventario-bases-orlant.md`).
- **Pregunta a Edwin: efectividad de agendamiento > 100%** — dueño:
  Edwin. Prioridad MEDIA. Varios asesores quedan por encima de 100% en
  los archivos reales de ago-sep/2026 (confirmado de nuevo en la Fase
  124: ago 3 asesores sobre 100% — máx 180.97% —, sep 2 asesores — máx
  387.31% —, el combo/ranking los dibuja completos y con formato
  correcto). No es error de carga. Pregunta de negocio: ¿agendan por
  fuera de las gestiones que se están contando? Anotado 2026-10-05.
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

## 3. Esperando decisión de InCo

- **Efectividad de Citas: el mes global cae en un mes sin datos
  (Septiembre 2026) y se ve un aviso + 2 tarjetas vacías** (hallazgo de
  InCo, Fase 124). 3 opciones, sin aplicar ninguna sin OK:
  1. Abrir esa pestaña directo en el último mes CON datos (Marzo 2026),
     en vez de seguir el mes global de las demás pestañas — **recomendado**,
     mismo patrón que el ranking de Efectividad de Agendamiento ya usa.
  2. Ocultar la pestaña hasta que llegue el archivo de ago-sep (igual que
     las 5 pestañas que esperan base de Edwin).
  3. Dejarla como está, solo mejorando el texto del aviso.
  Prioridad MEDIA. Anotado 2026-10-06 (Fase 124).
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

- **Margen de tamaño de carga: Agendas se queda sin margen en ~1-2 meses**
  (hallazgo nuevo, Fase 124, con el único número REAL medido hasta hoy —
  el resto de esta tabla es estimado, ver abajo). El archivo real de
  ago-sep/2026 (24.186 filas, 2 meses) pesa **4,91 MB confirmado** contra
  el límite de 8 MB de esa ruta (`RUTAS_LIMITE_MAYOR`, `server/server.js`)
  — eso deja ~212,9 bytes/fila. Con el ritmo de crecimiento reciente
  (ago 11.040 + sep 13.146 ≈ 12.100 filas/mes) el margen que queda
  (8−4,91 MB ≈ 3,09 MB ≈ 15.200 filas más) se agota en **~1,3 meses** —
  por debajo del umbral de 6 meses que pidió esta fase.
  - Tipificación de voz: ~3,2 MB para 34.661 filas (número dado, no
    remedido en esta fase — el intento de remedirlo con el archivo real
    local falló por un error del script de medición, no de la
    plataforma) contra el mismo límite de 8 MB → ~96,8 bytes/fila,
    margen ≈ 4,8 MB ≈ 52.000 filas más. Con (ago 14.940 + sep 19.721) /
    2 ≈ 17.330 filas/mes, el margen dura **~3 meses** — también por
    debajo de 6 meses.
  - Tipificación de WhatsApp, Tráfico (Llamadas/WhatsApp), Inasistencia y
    Efectividad (Agendamiento/Citas): **no medido en esta fase** (el
    script de medición falló antes de llegar a estos) — pero estructural-
    mente tienen muchas menos columnas por fila y/o muchas menos filas
    totales que Agendas/Tipificación de voz (ej. Tráfico nunca pasó de
    258 filas reales), así que es muy poco probable que estén cerca del
    límite de 2 MB global. Pendiente confirmar con una medición real.
  - **Propuesta (NO aplicada):** subir el límite de la ruta de Agendas de
    8 MB a, por ejemplo, 16 MB — mismo patrón ya usado 2 veces (Fase 77 y
    Fase 122), costo mínimo (1 línea en `server.js`, sin dependencias
    nuevas), riesgo bajo (ya hay precedente, no cambia el comportamiento
    para archivos chicos). Es un parche temporal, no la solución de
    fondo (carga por lotes/paginada), que NO se implementa en esta fase
    por ser un cambio de arquitectura grande. Necesita tu OK porque toca
    un límite de la API en producción.
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
- **Fallas de red/500/carreras de la interfaz (doble clic en "Confirmar
  carga", cerrar el modal a mitad de carga, token vencido a mitad de una
  carga, archivo corrupto/0 bytes/hoja vacía)** — **NO cubierto en esta
  fase** por el mismo motivo de alcance (sería un arnés Playwright nuevo,
  grande, con interceptación de red simulando cada falla). Pedido de
  nuevo desde la Fase 118/119, sigue sin cubrirse. Costo estimado: medio-
  alto. Riesgo de NO tenerlo: bajo-medio (las escrituras ya usan
  `db.transaction`, confirmado por lectura de código en las 9 bases, pero
  nunca ejecutado con una falla inyectada a mitad de carga en esta fase
  particular — sí se ejecutó esa prueba en fases anteriores para algunas
  bases, ver Fase 119).
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
- **XSS dinámico campo por campo con payloads reales** (`<img onerror>`,
  `"><script>`, `javascript:`) en tablas/tooltips/leyendas/mensajes de
  carga/exports/Historial — **NO ejecutado en esta fase** (pedido de
  nuevo desde la Fase 118). La Fase 102 confirmó por LECTURA de código
  que `esc()`/`xlsxFilasSeguras` cubren todos los módulos, pero eso no es
  un ataque real ejecutado. Costo: medio (un arnés Playwright que suba un
  archivo con esos payloads en cada campo de texto y lea el DOM
  renderizado). Riesgo de NO tenerlo: bajo (ya hay cobertura por lectura
  de código + sanitización demostrada en los exports de esta y fases
  anteriores — nunca se encontró una fuga real).
- **Código muerto fuera del hallazgo puntual de esta fase** — se borró
  `traficoWppResumen` (confirmado sin llamadores, Fase 124). Un barrido
  completo con `graphify` del resto del código (funciones/archivos sin
  referencias, estilos sin uso, endpoints sin cliente) sigue sin hacerse
  — pedido desde la Fase 118/119/120, sigue sin alcanzar el tiempo.

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
