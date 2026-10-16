# Pendientes (reorganizado Fase 124, 2026-10-06; reorganizado de nuevo en 3 bloques en la Fase 137, Parte D)

Un solo lugar para lo que falta, en 3 bloques: (1) esperando una
decisión tuya, (2) esperando una respuesta de Edwin, (3) técnico, sin
dueño (deuda técnica con costo/riesgo ya estimado, nadie tiene que
decidir nada, solo priorizar cuándo invertir el tiempo). Lo ya cerrado
no se deja aquí — queda en `docs/historico/progress-fases.md`. Cada
ítem tiene prioridad, cómo se cierra, y la fecha en que se anotó.

## 1. Esperando una decisión tuya

- **Teléfono en los monitoreos de Calidad** (Fase 151) — todos los
  monitoreos guardan el teléfono del cliente final. Decidir si se deja de
  pedir, se enmascara o se borran los ya guardados (borrar es destructivo:
  inventario, dry-run y "OK borrar").
- **Llave de AWS de la instancia y sudo del usuario de deploy** (Fase 151,
  H-08) — revisar permisos mínimos, rotar la llave y limitar sudo. Plan
  privado fuera del repo; arranca cuando digas "empecemos H-08". Va junto
  con bajar el límite de intentos de login en la configuración de la
  instancia (hoy está por encima del valor por defecto del código).
- **Contraseña temporal del usuario CLIENTES_DASH** — Prioridad ALTA.
  Cómo se cierra: la cambias desde la propia plataforma (nunca queda en
  el repo/commits/logs). Anotado 2026-10-02 (Fase 112), sigue sin
  hacerse. Efecto concreto más reciente: la verificación de cierre de
  la Fase 137 (Parte C) no pudo confirmar el lado CLIENTES_DASH de
  producción (`scripts/produccion/revision-final.js` espera 2 sesiones,
  una por cada rol) — solo se verificó ADMINISTRADOR, en verde. Igual en
  la Fase 139 (2026-10-13): el lado del cliente de Llamadas Únicas
  (filtro Asesor oculto, mismos números que el admin) se confirmó en
  local con el usuario demo; en producción queda pendiente hasta que
  cambies la contraseña y avises (`revision-final.js` ya lo revisa).
- **Denominador del FCR por confirmar con Camila** (Fase 147, Parte C) —
  hoy la tarjeta usa la base "total" (todas las encuestas del mes, pedido de
  Edwin: 3 de 45 = 6,7 % en septiembre). La otra opción es "respondieron"
  (solo quienes contestaron la pregunta 3: 3 de 4 = 75 %). Se cambia con
  `fcrBase` en la config del panel de Flujo de Llamadas, sin código.
- **IP que queda permitida en el puerto 22 de Lightsail, por confirmar** —
  al terminar el respaldo manual del 15/10/2026, el workflow dejó el puerto
  22 abierto solo para una IP, que parece ser la que ya estaba permitida
  antes. Confirmar a quién pertenece y si debe seguir ahí.
- **Descargas de imágenes Docker con error 429 en CI/deploy** — Prioridad
  MEDIA (hoy se resuelve relanzando el job). Elegiste la opción 1 (cuenta
  gratuita de Docker Hub): el login condicionado (`docker/login-action`,
  solo si existen los secretos `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN`)
  ya está en `main` desde la v1.40.1 (PR #403, 15/10/2026). Mientras no
  existan los 2 secretos, el paso se salta y node se baja de ECR Public
  como siempre. Cómo se cierra: creas el token y los 2 secretos (pasos en la
  descripción del PR #403); el siguiente deploy ya inicia sesión.
  Las 3 opciones están en `docs/historico/progress-fases.md`, Fase 139
  (cierre). El 2026-10-14 (Fase 145) el 429 de `public.ecr.aws` volvió
  a tumbar el docker-build 4 veces; en cada caso pasó al relanzar el job.
- **Nombres de asesor para el cliente en Llamadas Únicas y de Salida** —
  decidido el 2026-10-14 (Fase 147, "OK nombres para cliente"): el cliente
  de **Mobilize** ve y filtra por asesor en las dos mitades (lista cerrada
  `CAMPANAS_ASESOR_VISIBLE_CLIENTE`). El cliente de otra campaña no ve
  nombres de salida. Si se quiere abrir a otra campaña, se agrega a esa
  lista con OK.
- **Skill en Llamadas de salida** (Fase 147) — esperando a Edwin: el
  archivo de salida no trae un skill real (SKILL_ID dice "LLAMADAS DE
  SALIDA CONECTADAS/NO CONECTADAS"), así que hoy el filtro es por Tipo.
  Para filtrar por skill hace falta que Edwin mande el archivo de salida
  con una columna de skill. **Pendiente pedírselo a Edwin.**
- **Visibilidad de nombres de asesor para CLIENTES_DASH** — Prioridad
  ALTA. Desde la Fase 122, Agendas y Efectividad de Agendamiento
  muestran el nombre real del asesor a cualquier rol con acceso a
  ORLANT, incluido CLIENTES_DASH. Desde la Fase 130, Calidad también (el
  panel "Promedio de calidad por asesor" hereda el mismo filtro de
  acceso por campaña que el resto del dashboard, sin permiso nuevo).
  Cómo se cierra: decides si la cuenta del cliente debe seguir viendo
  esos nombres o si hay que redactarlos para ese rol. Anotado
  2026-10-06 (Fase 124), actualizado 2026-10-07 (Fase 130).
- **Exports reales (Excel) de Tipificación, Efectividad de Agendamiento,
  Efectividad de Citas y Agendas: abrir el archivo en Excel/LibreOffice
  de verdad** — Prioridad MEDIA. Un parser de ZIP/XML independiente
  (Fase 125) ya confirmó 3 de los 4 exports (formato válido, cifras
  correctas, sin PII, fórmulas neutralizadas en el archivo) — falta
  Efectividad de Citas y Tipificación de WhatsApp, y el único paso que
  sigue siendo manual en cualquier caso: abrirlo en la aplicación real
  (el parser confirma el contenido, no reemplaza esa revisión).
- **Export a Excel del panel "Promedio de calidad por asesor"** —
  Prioridad BAJA. Queda fuera del botón "Exportar" a propósito (una
  superficie de privacidad nueva que nadie pidió todavía). Cambio chico
  si lo pides (`_gdExportarCalidad`, `dashboard-generic.js`).
- **`.github/workflows/fase134-dry-run.yml` sin subir al repo** — el
  workflow del dry-run de la Fase 134 (toca AWS/SSH) quedó escrito pero
  nunca se commiteó (ver Fase 137, Parte A, PR #381). Prioridad BAJA (la
  migración que habría probado ya se desplegó y se verificó sin pérdida
  de datos). Cómo se cierra: decides si lo subo (el script ya fue
  revisado, solo imprime conteos) o si lo descarto del todo.
- **Flujo Mensual**: ¿se retira del todo (código + pestaña oculta) o se
  deja esperando? Prioridad BAJA. Anotado Fase 115, sigue sin decidirse.
- **Tráfico de Llamadas sin `campaignAccess` en la carga** (solo
  `canLoadData` genérico) — hallazgo de severidad BAJA, re-confirmado en
  la Fase 124. Es la única de las 7 familias de carga masiva sin ese
  control puntual — decisión explícita ya documentada (un archivo de
  Tráfico trae varias skills que pueden resolver a campañas distintas).
  Arreglarlo exige rediseñar ese modelo — **no se toca sin tu OK
  explícito**. Riesgo real hoy: bajo (desde la Fase 134 en producción
  solo quedan ORLANT y MOBILIZE; Aurora/HLM ya no existen — ver
  "Decisiones de esta fase" al final).
- **F10 (auditoría UI Fase 135) — iconos emoji del menú lateral** (ej.
  Usuarios, Inventario). Prioridad BAJA. No se tocó en la Fase 136 por
  decisión explícita tuya: es una decisión de marca (seguir con emoji
  vs. un set de iconos propio), no un defecto de UI — tu postura: no
  antes del demo de Mobilize (mediados de octubre).
- **Limpieza de `.atab{transition:all 0.2s}`** (Fase 137, Parte E) —
  Prioridad BAJA. Confirmado que NO es la causa del bug de Escape ya
  resuelto (ver bloque técnico) — sigue siendo una limpieza de estilo
  válida por separado. Pospuesta hasta después del demo de Mobilize,
  solo si escribes "OK limpieza atab".
- **Limitador de la API para tráfico SIN sesión — sigue por IP, no por
  usuario** — Prioridad BAJA/MEDIA. La Fase 130 (Parte 7) separó el
  limitador en 2 cupos: quien ya inició sesión cuenta por usuario (sin
  compartir cupo con compañeros de oficina); quien todavía no inició
  sesión sigue contando por IP. Eso resolvió el caso real que disparó la
  fase (una revisión administrativa agotando el cupo de toda una
  oficina) pero deja un caso más chico abierto (varias personas
  iniciando sesión casi al mismo tiempo desde la misma IP). 3 opciones
  anotadas en `docs/historico/progress-fases.md` (Fase 130) para cuando
  quieras cerrar esto también — ninguna aplicada todavía.
- **Inventario y respaldo de la cuenta AWS vieja** (`934685482338`) +
  **Política 1 de IAM pendiente** (`s3:ListBucket`+`s3:GetObject`
  acotado, bloquea la prueba real de restauración de backups) — ambos
  necesitan credenciales de AWS que solo tú tienes a mano, sin empezar.
- **Dependencias mayores congeladas** (`better-sqlite3` 13, `dotenv`
  18) — no se tocan sin que lo pidas explícitamente.

- **Textos sin tilde que arma el JavaScript** (Fase 146) — Prioridad BAJA.
  Los textos fijos de `public/index.html` ya llevan tilde (v1.37.0). Quedan
  los que arman los archivos `public/js/*.js` (títulos de tablas, avisos,
  encabezados de exportación). Varios son **encabezados de plantillas y
  exportaciones de Excel que Edwin ya usa** ("Campana", "Categoria",
  "Periodo", "Metrica"…), así que no se tocan sin acordarlo con él.

## 2. Esperando una respuesta de Edwin

- **19 asesores del archivo real de Calidad sin usuario ASESOR en la
  plataforma** — Prioridad MEDIA. La carga masiva de Calidad guarda el
  nombre como texto libre, nunca requiere un usuario — no bloquea
  nada — pero esos 19 asesores no pueden ver su propia nota ("Mis
  Resultados") porque no tienen cuenta. Se crean (rol ASESOR, campaña
  ORLANT) cuando Edwin lo pida — no se crean solos.
- **Ordenamiento Médico, Recuperación de Cancelados, Flujo Mensual,
  Gestión STA** — Prioridad BAJA (pestañas ya construidas, ocultas
  esperando el archivo real). Ver `docs/inventario-bases-orlant.md`.
- **Pregunta a Edwin: efectividad de agendamiento > 100%** — Prioridad
  MEDIA. Varios asesores quedan por encima de 100% en los archivos
  reales de ago-sep/2026 (confirmado, no es error de carga; Chart.js
  autoescala el eje sin recortar nada). Pregunta de negocio: ¿agendan
  por fuera de las gestiones que se están contando?
- **Pregunta a Edwin: "hay que quitar esa letra"** — Prioridad BAJA.
  Mención suelta en la reunión del 2026-10-05, sin precisar a qué se
  refería.
- **Nivel de servicio de WhatsApp/Tráfico a 5 minutos, y AHT de
  WhatsApp** — Prioridad MEDIA. Ambos se retiraron de pantalla (el
  cálculo sigue en el código) porque el export real de Wolkvox no trae
  esas columnas — Edwin lo habla con el jefe/Wolkvox. Si algún día
  llegan, reactivarlos es solo un flag en `PUT /dashboards/config/
  ORLANT` (`mostrarAht`/`mostrarSL5min`), sin tocar código.
- **Nivel de servicio** (posible base aparte que mencionó Edwin) —
  Prioridad BAJA. Aclarar con él si se refiere a algo distinto de lo
  que ya existe (SL 20s en Tráfico).
- **Indicador de Llamadas y WhatsApp de salida — 3 preguntas sin
  responder** (pestaña ya construida y en producción, Fase 127/128):
  - **Denominador del %**: Edwin pidió un indicador simple con
    porcentaje "si aplica" pero nunca dijo contra qué base. Hoy la
    plataforma solo muestra lo que no requiere inventar un denominador
    (total del mes, variación contra el mes anterior, participación
    3P/General dentro del total del mismo mes).
  - **Qué significa "3P" en Salida**: se asume el mismo criterio que en
    el resto de la plataforma (Línea 3P vs. Línea General), nunca
    confirmado explícitamente para esta pestaña.
  - **Total acumulado del período** (mencionado por Edwin, a futuro —
    NO implementar todavía, sin alcance ni fecha definida).
- **Plantillas oficiales versionadas** (carpeta que Isabel pueda
  descargar/pegar/subir sin ayuda de InCo) — pedido explícito de Edwin:
  "eso lo vemos después de la entrega". Ver
  `docs/plantillas-inventario.md` para el inventario que esa fase va a
  necesitar — necesita reunión con Edwin e Isabel.
- **Logo de Mobilize: provisional, falta el original en alta
  resolución** — Prioridad BAJA (ya en producción, no bloquea nada). El
  que se usa hoy (688×124) se ve bien solo hasta ~150px de ancho.
  Cuando llegue el original de Edwin, se regenera igual que el logo de
  InConexion (Fase 132).
- **5 preguntas de la reunión del 2026-10-09 (Fase 138) sobre "Llamadas
  de ingreso únicas" de Mobilize** — Prioridad MEDIA (no bloquean el
  panel ya construido, con septiembre/2026 real cargado desde el
  2026-10-13; vive en su propia pestaña "Llamadas Únicas" desde la Fase
  139):
  - **Archivo real de llamadas ABANDONADAS de ingreso**: las filas
    "NO CONTESTADAS" que se cargaron al principio eran llamadas de SALIDA
    no conectadas (corregido el 2026-10-13, Fase 141 Parte B). Falta que
    Edwin defina de dónde salen las abandonadas entrantes reales.
  - **Filtro de skill y las abandonadas**: sin confirmar si el filtro de
    Skill del panel debe aplicar también a las llamadas abandonadas o
    solo a las contestadas.
  - **"Tipo de línea" en Mobilize**: Edwin mencionó este término en la
    reunión, sin precisar a qué se refiere ni si es un dato nuevo a
    cargar.
  - **"ATA" de Mobilize** — RESUELTO (2026-10-14, Fase 146): indicador
    distinto de AHT ("ASA y ATA" + "AHT" aparte, Fase 145) y, por decisión
    de Edwin, con datos pero 0 abandonos se muestra **0:00** (v1.37.1).
  - **Llamadas de salida de Mobilize (septiembre cargado el 2026-10-14,
    Fase 142)**: se cargó tal cual lo mandó Edwin (111 = 52 no conectadas
    + 59 conectadas). Faltan 3 respuestas de Edwin: ¿se excluyen las
    filas "PRUEBA" (3) y "TIMEOUTACW" (1)? (todas son conectadas; sin
    ellas quedaría 52 / 55 / 107 — se corrige recargando un Excel limpio,
    la carga reemplaza por rango de fechas), ¿por qué él cuenta 51 no
    conectadas únicas y la plataforma 52?, y qué es el "tipo de línea"
    (el archivo no lo trae). El teléfono no se guarda (decisión del
    usuario, 13/10).
- **Resultado de la encuesta/"guanid" de Mobilize para el 15 de
  octubre** — Prioridad MEDIA, dependencia de otras personas (no de esta
  fase): lo están trabajando fuera de esta línea de trabajo y todavía no
  hay datos — riesgo de plazo que no depende del equipo de la
  plataforma.

- **Otro pendiente de ORLANT que mencionó Edwin ("otra cuenta distinta a la
  tarjeta")** — sin entender todavía; lo pregunta el usuario. No se tocó.

## 3. Técnico, sin dueño (costo y riesgo ya estimado — nada se aplica sin pedirlo)

- **El permiso "Cargar Datos" se puede dar a un usuario cliente
  (CLIENTES_DASH)** — hallazgo bajo de la auditoría de la Fase 148
  (`canLoadData`, `server/auth.js`: basta `perms.cargarDatos === true`,
  sin mirar el rol). Hoy ningún cliente lo tiene y solo lo asigna un
  administrador desde Gestión de Usuarios; con él, un cliente podría
  reemplazar datos de su propia campaña (siempre limitado por
  `campaignAccess`). Decidido en la Fase 149 (15/10/2026): no se cambia;
  queda anotado. Cómo se cierra, si se pide: que `canLoadData` (o la
  pantalla de permisos) excluya el rol CLIENTES_DASH. Costo: bajo.
  Anotado 2026-10-15.

- **Lección de la Fase 126 — "conteo de filas" no es lo mismo que
  "categorías distintas"**: un proxy liviano ("especialidades distintas
  por mes") subestimó por mucho el conteo real de filas antes de un
  borrado — el candado `filasEsperadas` del endpoint de borrado detectó
  la discrepancia solo y abortó sin borrar nada. Para una próxima fase
  que necesite "cuántas filas hay": usar el dry-run del endpoint de
  borrado (o un `COUNT(*)` equivalente), nunca un conteo de categorías
  distintas como proxy.
- **`scripts/produccion/revision-final.js` no cubre todavía ATA (voz y
  WhatsApp) ni el desglose mes a mes de Tipificación de WhatsApp ni de
  Tráfico** — confirmado al revisar el script a fondo en la Fase 125:
  solo arma totales agregados del período. No es un defecto de la
  plataforma (esos valores sí se confirmaron a mano, ver `PROGRESS.md`),
  es una brecha de cobertura del script. Costo: bajo-medio.
- **Límite de tamaño por carga** — tabla de bytes/fila medidos/estimados
  por ruta y un aviso del lado del cliente (si el payload estimado
  supera el 85% del límite de su ruta, avisa antes de enviar) ya viven
  en `docs/historico/progress-fases.md` (Fase 125). Regla práctica:
  subir un mes a la vez; si hay que subir varios meses juntos, partir el
  archivo por mes antes de cargar.
- **No hay UI de administración para alias de asesor** — hoy el alta,
  lista y borrado de alias solo existen por API directa, nunca desde una
  pantalla. Costo de una pantalla simple (mismo patrón que el catálogo
  de codificaciones de Calidad): medio. Riesgo: bajo.
- **Alias de asesor no se aplica en Calidad** (el campo `ASESOR` de la
  carga masiva de monitoreos) — confirmado por código
  (`aplicarAliasAFilas` nunca se llama desde Calidad). Severidad baja
  (solo la carga masiva opcional, no el registro manual). Costo de
  extenderlo: bajo (mismo patrón, una línea más).
- **`npm test` local se vuelve inestable en algunas máquinas** —
  decenas de `ETIMEDOUT` en una corrida completa de supertest, sin
  imprimir el resumen final. No es un bug de esas pruebas (la misma
  suite corre en verde en CI, Node 22, en cada PR) — es un límite de
  recursos de la máquina. **CI (Node 22) sigue siendo la referencia
  real**, como indica `CLAUDE.md` — no se investiga más a fondo.
- **Cobertura con Playwright real para las 9 bases, con archivos
  SINTÉTICOS con la forma exacta de los reales** — no construido, es en
  sí mismo un proyecto de varios días (un arnés nuevo por base). Costo
  estimado: alto (días). Riesgo de no tenerlo: medio — ya se demostró
  que un defecto puede pasar pruebas unitarias en verde y solo aparecer
  con el archivo real en la página real. Propuesta: empezar por las 2
  bases que ya mostraron defectos reales (Tipificación de WhatsApp,
  Agendas), no las 9 de una vez.
- **Fallas de red/500/carreras de la interfaz** (cerrar el modal a mitad
  de carga, token vencido a mitad de una carga, archivo corrupto) — no
  cubierto, mismo motivo de alcance (arnés Playwright grande con
  interceptación de red). Costo: medio-alto. Riesgo de no tenerlo:
  bajo-medio (las escrituras ya usan `db.transaction`, confirmado por
  código en las 9 bases). El doble clic en "Confirmar carga" sí está
  cubierto por construcción (`withButtonLoading()` deshabilita el botón
  de forma síncrona antes de cualquier `await`) — sin test automatizado
  que lo fije como regresión todavía.
- **Casos de borde del reemplazo por rango, matriz completa × 9 bases**
  (archivo de 1 solo día, skill nueva, cruce de mes, re-subida idéntica,
  fecha futura, atomicidad con falla inyectada) — cubierto parcialmente
  (las 7 bases principales, Fase 119), no se completó la matriz entera.
  Costo de completar lo que falta: medio.
- **XSS dinámico campo por campo — ejecutado parcialmente** (Fase 125,
  con Playwright real y payloads reales en Agendas, Efectividad de
  Agendamiento y Tipificación de Llamadas: 0 diálogos/elementos
  inyectados reales, fórmulas neutralizadas en el Excel exportado,
  releído con un parser independiente). Falta: campos de Agendas que no
  se renderizan en ninguna vista hoy, el campo SKILL de Tipificación, el
  canal WhatsApp, el nombre de archivo en Historial, Calidad, y el
  export a PDF. Costo de cerrar el resto: bajo (mismo patrón ya probado,
  `esc()`/`xlsxFilasSeguras`, sin ninguna ruta de renderizado distinta
  conocida para lo que falta).
- **Barrido de código muerto completo con `graphify`** (funciones/
  archivos sin referencias, estilos sin uso, endpoints sin cliente) —
  pedido desde hace varias fases, sigue sin alcanzar el tiempo.
- **Barrido visual completo** (claro/oscuro × 3 resoluciones × mes con/
  sin datos, todas las pestañas × todas las sub-pestañas, revisión
  humana una por una) — ya cubierto por chequeos automáticos (consola +
  canvas con píxeles, 0 hallazgos), pero no por ojo humano en cada
  combinación. Queda para después si se quiere ese nivel de detalle.

- **Pruebas de tiempos de modales de la Fase 136 inestables bajo carga**
  (Fase 146) — Prioridad MEDIA. Causa: miden con el reloj real (un
  `requestAnimationFrame` simulado de 16 ms ×2 contra esperas de 60/100 ms,
  y la red de seguridad de 400 ms contra una espera de 450 ms); con la CPU
  saturada (suite en paralelo) los temporizadores se atrasan más que ese
  margen. Arreglo: temporizadores simulados de `node:test` (`mock.timers`)
  y una cola de frames manual, con avance exacto — la prueba queda más
  estricta, no más débil. Archivos: `fase136-pr4-base-movimiento.test.js`,
  `fase136-pr8-modales-unificados.test.js`.
- **CSP con `'unsafe-inline'` en `script-src`** (Fase 146) — Prioridad
  MEDIA, aceptada por ahora. Hace falta porque `index.html` tiene 144
  manejadores `onclick=` en línea (`server/server.js:80-93` lo explica).
  Mitigado: todo texto de datos pasa por `esc()` (probado con texto
  malicioso real en la Fase 146: 66 vistas, nada se ejecutó). Cerrarlo es
  migrar esos manejadores a `addEventListener` — trabajo grande, después de
  la entrega.
- **Código sin uso** (Fase 146) — Prioridad BAJA: las vistas de Tráfico
  "asaaht" (ASA y AHT) y "asa" sola ya no las usa ninguna configuración
  (`public/js/trafico.js`: `_traficoDibujarAsaAht`, sus títulos y su rama
  de resumen). Se pueden quitar cuando convenga.
- **`revision-final.js` no elige el mes** (Fase 146) — Prioridad BAJA.
  Contra una base cuyo mes por defecto no tiene Tráfico (la demo local
  abre en octubre), reporta "sub-pestañas de Flujo" como falla. En
  producción no pasa (abre en septiembre). Arreglo: elegir el último mes
  con datos antes de recorrer.
- **`*.pem` no está en `.gitignore`** (Fase 146) — Prioridad BAJA; hoy no
  hay ninguno en el repo.

- **Corrección (Fase 146)**: el hallazgo "Tipificación oculta en el seed pero
  visible en producción" era un **error del diagnóstico**. El tablero destapa
  sola cada pestaña oculta que ya tiene datos (`dashboard-generic.js`,
  `_gdBootstrap`: Tipificación, Salida, Agendamiento, Inasistencia,
  Efectividad), así que `oculta: true` en el seed es lo correcto: sin datos
  no se muestra, con datos sí. No hay diferencia entre seed y producción y
  no se cambió nada.

## Decisiones de esta fase (sin pendiente — ya resueltas, quedan aquí solo como referencia)

- **Observaciones de Calidad** (`# Teléfono`/`ID-Llamada-Wpp` en
  `monitoreos`, contradice la regla de "nunca guardar # Teléfono"): tu
  decisión 2026-10-07 fue dejarlo así por ahora. Sin cambios.
- **F07 (agrupar las 4 acciones por fila de Usuarios)**: hecho en la
  Fase 137, Parte B — ver `docs/auditoria-ui-fase135.md`, tabla de
  estado final.
- **Fase 134 (borrado de 12 clientes sin datos reales)** y el **bug de
  Escape que cerraba el dashboard de ORLANT entero** (Fase 136/137):
  ambos resueltos — detalle completo en
  `docs/historico/progress-fases.md` y en la tabla de estado de
  `docs/auditoria-ui-fase135.md`.
- **Clínica Aurora / Hospital La María**: ya no existen en la
  plataforma desde la Fase 134 (se borraron junto con los otros 10
  clientes sin datos reales) — no es un pendiente operativo.
- **Llamadas Únicas de Mobilize, septiembre/2026: CARGADAS** (Fase 139,
  2026-10-13, "OK cargar"): 139 = 88 contestadas + 51 abandonadas, 25
  días con contestadas. El nombre de agente de las abandonadas se queda
  visible solo para roles internos (decisión del usuario, opción 1).
  Detalle en `docs/historico/progress-fases.md`.
- **Llamadas Únicas en su propia pestaña** (decisión del usuario,
  2026-10-13, supera el diseño del 2026-10-09 que lo ponía encima de Flujo
  de Llamadas): Mobilize → "Llamadas Únicas" es una pestaña aparte, y
  "Flujo de Llamadas" volvió a quedar como antes de la Fase 138 PR3. Son
  fuentes y criterios distintos (cola de Wolkvox vs. CDR deduplicado por
  día+teléfono), por eso no comparten pantalla; el panel lo aclara bajo
  su título. Cuando llegue el archivo de "Llamadas de salida", su panel
  va en esa misma pestaña (ingreso a la izquierda, salida a la derecha).
