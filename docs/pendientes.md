# Pendientes (reorganizado Fase 124, 2026-10-06; reorganizado de nuevo en 3 bloques en la Fase 137, Parte D)

Un solo lugar para lo que falta, en 3 bloques: (1) esperando una
decisión tuya, (2) esperando una respuesta de Edwin, (3) técnico, sin
dueño (deuda técnica con costo/riesgo ya estimado, nadie tiene que
decidir nada, solo priorizar cuándo invertir el tiempo). Lo ya cerrado
no se deja aquí — queda en `docs/historico/progress-fases.md`. Cada
ítem tiene prioridad, cómo se cierra, y la fecha en que se anotó.

## 1. Esperando una decisión tuya

- **Salida conectada de Mobilize: filas "-" con "Cliente_no_contesta"**
  (Fase 191) — por el pedido, las conectadas de los meses con CDR son
  todas las filas con SKILL_NAME "-". Parte de esas filas están tipificadas
  "Cliente_no_contesta" (la regla de "no conectada" de Tipificación de
  Mobilize, Fase 174). Confirmar con Edwin si se dejan como conectadas o
  se descuentan.

- **Volver a subir la salida de agosto y septiembre de Mobilize** (Fase
  171) — se cargaron cuando el sistema dejaba una sola llamada por día y
  teléfono, así que les faltan filas. Octubre ya se recargó completo (85).
  Hace falta el archivo de Edwin de cada mes y tu OK.
- **Cuenta @admin compartida** (Fase 166, 23/10/2026) — los cambios del
  Centro de cargas (cargar, eliminar, deshacer) quedan en el Historial a
  nombre de "Administrador (@admin)", así que no se pueden atribuir a una
  persona (pasó con el "Eliminar" de octubre de WhatsApp por rangos de
  ORLANT, ya restaurado). Propuesta: usuarios con nombre para quien carga
  datos. No se aplica sin pedirlo.
- **Teléfono en los monitoreos de Calidad** (Fase 151) — todos los
  monitoreos guardan el teléfono del cliente final. Desde la v1.42.3 solo lo
  reciben los roles internos. Falta decidir con Edwin si se deja de pedir,
  se enmascara o se borran los ya guardados (borrar es destructivo:
  inventario, dry-run y "OK borrar").
- **Una cuenta SUPERVISOR que nunca ingresó** (creada el 29/09/2026) —
  decidir si se suspende.
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
- **IP que queda permitida en el puerto 22 de Lightsail, por confirmar**
  (sigue igual en la última corrida revisada, la verificación de
  restauración del 16/10: al abrir el puerto para el runner, esa IP también
  queda en la lista) —
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
  solo ORLANT y MOBILIZE tienen datos; Clínica Aurora (Fase 153) y
  Hospital La María (Fase 160) existen sin datos y solo los ve el
  administrador).
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

- **Agendamiento ORLANT: 20 usuarios en la lista, no 19** (Fase 210) — la
  lista trae 21 registros y 20 usuarios distintos (INCO18 repetido por su
  cambio). Edwin habló de 19 usuarios fijos. Se cargó tal cual. Cómo se
  cierra: Edwin confirma si sobra alguno.
- **Agendamiento ORLANT: el "518" del pedido es INCO18** (Fase 210) — el
  único usuario con fecha de cambio (07/10/2026) en la lista es INCO18, y
  los nombres de la lista no se escriben exactamente igual que en el
  pedido. Cómo se cierra: Edwin confirma que es ese usuario.

- **¿Las skills Confirmaciones, Cancelaciones y Reprogramación y Atención
  Tutelas cuentan como "Llamadas ingresadas" de ORLANT?** (Fase 208,
  28/10/2026) — llegaron con el Flujo de octubre (26/10) y quedaron
  registradas a ORLANT; desde la recarga de agosto y septiembre de ese día
  suman en Tráfico de Llamadas: ago 10.411 (8.911 sin ellas), sep 10.480
  (9.043 sin ellas). Quedan como están hasta que Edwin responda. Cómo se
  cierra: si cuentan, nada que hacer; si no, quitarlas del mapeo de skills de
  ORLANT (Centro de cargas, con tu OK) y anotar las cifras en PROGRESS.md.
  Desde la Fase 212 también cambian la **Efectividad de Citas** de ORLANT
  (son parte de las llamadas contestadas del denominador).
- **Ranking de asesores de ORLANT: asesores con más agendas que contestadas** (Fase 213,
  29/10/2026) — Prioridad ALTA. En octubre, 4 asesores tienen más agendas que
  contestadas en el CDR de Tipificación (>100 %); 2 de ellos casi no tienen
  contestadas y salen con porcentajes de miles (17.028 % y 8.266 %), lo que
  aplasta la escala de la gráfica. Pueden ser personas que agendan sin
  contestar (lista de espera, back office) o que contestan con otro nombre en
  Wolkvox. Además, 2 asesores de agosto tienen contestadas y 0 agendas. Cómo se
  cierra: decides con Edwin si esas personas van aparte (como "OTROS"), con un
  mínimo de contestadas, o si hay que unir nombres con un alias.
- **Versiones anteriores de las bases de ORLANT borradas el 29/10** (Fase 213) —
  el 29/10 entre las 08:37 y las 08:42 (hora de Colombia; el historial lo guarda
  en hora del servidor, 13:37–13:42) se eliminaron desde Cargar Datos las
  Agendas de ago/sep/oct (11.040 / 13.146 / 8.635) y se volvieron a subir con
  los archivos de cada mes en base cruda (11.039 / 13.088 / 8.635); también se
  eliminaron Efectividad de Agendamiento ago/sep (19 / 20 registros) y
  Efectividad de Citas ago/sep (1 / 1). Todo queda guardado 30 días para
  Deshacer (hasta ~28/11/2026). Cómo se cierra: si alguna de esas bases se
  quería conservar, usar Deshacer antes de esa fecha; si no, nada que hacer.
- **Carga EFECTIVIDAD_AGENDAMIENTO de ORLANT** (Fase 213) — Prioridad BAJA. Ya no
  se usa en ORLANT (el ranking sale de agendas + CDR) pero sigue visible en
  Cargar Datos. Cómo se cierra: decides si se oculta para ORLANT, igual que la
  de citas atendidas (cambio pequeño, con PR).
- **Efectividad de Citas de ORLANT: octubre es parcial** (Fase 212,
  29/10/2026) — oct 67,17 % = 8.635 agendas ÷ (7.343 llamadas + 5.512
  WhatsApp contestados), con agendas y WhatsApp hasta el 24/10 y 20 días de
  Tráfico de Llamadas. Se recalcula sola al cargar el resto del mes (agendas,
  Flujo de llamadas y WhatsApp), sin tocar nada más. Cómo se cierra: llegan
  los archivos del mes completo y se anota la cifra final en PROGRESS.md.

- **Nivel de servicio de llamadas con varios meses: ¿promedio simple o
  ponderado?** (Fase 207, 28/10/2026) — desde la v1.94.0, la tarjeta "Nivel
  de servicio (20 s)" de Tráfico de Llamadas (ORLANT, y de cualquier
  campaña que la muestre) es el promedio simple de la columna
  SERVICE_LEVEL_20SEC de los días de los meses marcados en MESES (decisión
  del usuario: misma definición de siempre, Fase 163). La opción
  ponderada sería pesar cada día por sus llamadas ingresadas (Σ SL × llamadas
  ÷ Σ llamadas), más exacta cuando hay días con mucho y poco volumen; la de
  WhatsApp ya es ponderada por el total de WhatsApp. Cómo se cierra: la
  respuesta de Edwin; si elige la ponderada, una fase corta en
  `traficoServiceLevelPromedioPeriodo` (trafico-logic.js) con su prueba.

- **Eficacia de Mobilize: confirmar con Edwin y Kelly** (Fase 198,
  27/10/2026) — Prioridad MEDIA. En producción desde la v1.86.0: octubre
  47,2 % (42 de 89). Tres cosas por confirmar:
  - **Denominador**: hoy son todas las contestadas de ingreso (89, cada
    llamada cuenta). Con únicas por día sería 32 de 62 = 51,6 %.
  - **Otros_motivos (19 llamadas de ingreso en octubre)**: no está en la
    lista de códigos positivos de Kelly, así que baja la eficacia.
    Confirmar si se deja así o si entra en la lista (único lugar:
    `server/eficacia.js`).
  - **Base de calidad de Mobilize**: confirmar con ellos qué base de
    calidad se usa para Mobilize.
  Cómo se cierra: su respuesta; si cambia la regla, una fase con prueba y
  versión nueva.
- **Clasificar a los asesores de ORLANT en Línea General o Línea 3P**
  (Fase 186, 26/10/2026) — desde la v1.75.0, la salida de Tipificación se
  reparte por la clasificación del asesor; hasta que alguien la llene, toda
  la salida queda en "Sin clasificar". Edwin tiene el listado con Isa: se
  carga desde el Excel (nombre del asesor, línea) en "Clasificación de
  asesores" o se elige a mano. Desde la Fase 187 (OK de Edwin, una sola
  clasificación) también alimenta la pestaña de salida (v1.76.1): los
  asesores que tenían 3P en un mes y General en otro quedaron sin
  clasificar y hay que elegirles la línea.
- **CDR de octubre de ORLANT (llamadas y WhatsApp)** (24/10/2026) — faltan
  los archivos: en Descargas solo están los de septiembre (`CDR LLAMADAS
  ORLANT`, `CDR WHATSAPP ORLANT`, `CDR ORLANT SEPTIEMBRE`, ya cargados).
  La carga por el Centro está autorizada; se hace al recibirlos, con la
  vista previa primero (out_pre = salida, no conectada = NO_CONTESTAN +
  BUZON).

- **Preguntas abiertas de la reunión del 23/10 (Tipificación con los CDR)**.
  Edwin ya respondió `out_pre`, "no conectada", registro o teléfono único y
  la tabla de detalle quitada (Fase 174, ver la bitácora). Quedan:
  - **Ruta del CDR en Wolkvox** (llamadas: HistCDR; WhatsApp: HistChat).
    Las plantillas dicen "[ruta pendiente de confirmar con Edwin]".
  - Confirmaciones (skill 4338) queda fuera del Nivel de Servicio por
    ahora: confirmar si se queda así.
- **Versión para el celular** (Fase 174, 23/10/2026) — a Edwin le pareció
  incómoda en su teléfono. Primer paso hecho en la Fase 175 (v1.72.0): el
  encabezado del tablero pasó de 354 a 151 px a 375 px, con los filtros
  plegados en un botón. Falta que Edwin lo pruebe en su teléfono y diga qué
  pantallas usa más en el celular (para seguir con esas).
- **Llamadas Únicas de Mobilize desde el CDR** (Fase 174) — hoy Edwin arma
  a mano el archivo de Únicas filtrando el CDR. El CDR ya trae lo necesario
  (ver "Reciclar bases" en `docs/plantillas/README.md`). Falta que Edwin
  confirme que da los mismos números que su archivo.
- **Frecuencia de actualización por API** (Fase 174) — propuesta de Edwin:
  Mobilize cada 2 horas, el resto en la noche. Antes de decidir: revisar
  con Wolkvox el costo por consulta de su API.
- **Llamadas Únicas de agosto de Mobilize: volver a cargar** (Fase 163).
  Desde la v1.62.0 las filas sin asesor cuentan como abandonadas; en la
  carga de agosto anterior se habían omitido. La hacen el usuario y Edwin
  por la interfaz, con el archivo de Edwin.
- **Primera carga de Clínica Aurora y Hospital La María** (Fase 160).
  Fase 163 (22/10): HLM ya tiene el Flujo de agosto (cargado por el
  usuario con Edwin, por la interfaz). Aurora sigue sin datos. Lo de abajo sigue abierto para lo que falta.
  Ambos tienen Tráfico de Llamadas y Tráfico de WhatsApp listos: las
  pestañas aparecen solas al cargar (probado de punta a punta en local).
  Falta de Edwin:
  - los nombres exactos de las skills de llamadas de cada cliente, tal
    como salen en Wolkvox (SKILL_NAME). Hay que asignarlas al cliente
    ANTES de cargar: desde el Centro, Flujo de Llamadas solo guarda las
    skills ya asignadas a ese cliente;
  - HLM: si se mide por sede (Sede 33 / Castilla) y qué skills van a cada
    una — hoy es un solo cliente sin sedes;
  - los archivos: el reporte nativo de la cola de Wolkvox (llamadas) y la
    plantilla de Flujo de WhatsApp llena;
  - quién ve cada cliente (permisos; hoy solo el administrador) y si hay
    que crear usuarios;
  - el modelo de Calidad de cada uno (mientras no esté, Calidad sigue
    oculta).

- **Metas que faltan para el semáforo y la línea de meta** (Fase 152).
  Sin meta, un indicador no lleva semáforo ni línea punteada. Hoy no
  tienen meta: FCR (One & Done) de Mobilize, Inasistencia, Efectividad de
  Citas, Efectividad de Agendamiento. Confirmar también el nivel de
  servicio de WhatsApp (el umbral sembrado `service_level` 80/65 hoy solo
  se usa en llamadas). Cómo se cierra: Edwin manda las metas y se cargan
  en la pantalla Umbrales (sin código). Anotado 16/10/2026.
- **Tarjetas de Tráfico: mes elegido o ventana de meses** (Fase 152, B8).
  Hoy las tarjetas suman la ventana de varios meses del filtro (ej. abril
  a septiembre); la variación contra el mes anterior solo aparece al
  filtrar un mes. Si Edwin prefiere que las tarjetas muestren siempre el
  mes elegido arriba (con su variación) y la gráfica conserve la ventana,
  es un PR aparte (cambia las cifras que muestran las tarjetas).
  Anotado 16/10/2026.
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
  - **Archivo real de llamadas ABANDONADAS de ingreso** — RESUELTO (Fase
    163): salen de Wolkvox, "Skill y servicios → 2. Detalle llamadas
    abandonadas", en la misma hoja que las contestadas; una fila sin
    asesor cuenta como abandonada.
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
    la carga reemplaza por rango de fechas) y qué es el "tipo de línea"
    (el archivo no lo trae). La pregunta de "51 contra 52 no conectadas
    únicas" ya no aplica: desde la Fase 171 cada fila cuenta (no se quitan
    repetidos), y agosto y septiembre esperan recarga (sección 1). El teléfono no se guarda (decisión del
    usuario, 13/10).
- **Resultado de la encuesta/"guanid" de Mobilize para el 15 de
  octubre** — probablemente resuelto (la pestaña Encuesta de Mobilize ya
  tiene septiembre, Fase 171); confirmar y quitar. Prioridad MEDIA, dependencia de otras personas (no de esta
  fase): lo están trabajando fuera de esta línea de trabajo y todavía no
  hay datos — riesgo de plazo que no depende del equipo de la
  plataforma.

- **Otro pendiente de ORLANT que mencionó Edwin ("otra cuenta distinta a la
  tarjeta")** — sin entender todavía; lo pregunta el usuario. No se tocó.

## 3. Técnico, sin dueño (costo y riesgo ya estimado — nada se aplica sin pedirlo)

- **Auditoría de bugs y seguridad de v1.72.1 (24/10/2026) — puntos que
  quedan pendientes** (los puntos 1, 2, 3 y 5 se arreglaron en la Fase 177;
  el 4, el 6, el 9 y el refresco tras Deshacer / Eliminar, en la Fase 178).
  Ninguno es de gravedad alta; nada se aplica sin pedirlo:
  - **(7, baja) Sesión del administrador maestro sin versión**: no hay forma
    de cerrar a la vez todas sus sesiones abiertas; cada una vence a las 8 h
    o al cerrar sesión en ese equipo (`server/auth.js`, `getActor`). Cómo:
    una versión de token configurable para el maestro, o una duración más
    corta. Costo: bajo.
  - **(8, baja, ya conocido) CSP con `'unsafe-inline'` en scripts**
    (`server/server.js`): lo exigen los 152 `onclick` de `index.html` (conteo del
    26/10/2026). Mitigado: todo texto de datos pasa por `esc()` (probado con
    texto malicioso real en la Fase 146: 66 vistas, nada se ejecutó), pero un
    XSS futuro podría leer el token en memoria. Cómo: pasar los `onclick` a eventos registrados desde el JS y
    quitar `'unsafe-inline'`. Costo: alto (toca casi toda la interfaz).

- **Revisión preventiva de la Fase 178 (26/10/2026) — hallazgos nuevos**.
  Nada se aplica sin pedirlo:
  - **(media) No hay forma de leer los logs de producción**: el workflow
    `verificar-logs-produccion.yml` (solo lectura, CloudWatch) falla con
    `AccessDenied`: el rol de deploy de la cuenta AWS actual no tiene
    `logs:FilterLogEvents`. Tampoco se sabe si el agente de CloudWatch
    sigue enviando logs tras el cambio de cuenta. Sin eso no se pueden
    buscar errores 500 ni avisos repetidos. Cómo: dar ese permiso de solo
    lectura a los 2 grupos de logs (IAM, necesita tu OK) o agregar a
    `salud-servidor.yml` un conteo de líneas 5xx de `docker logs` (solo
    números). Costo: bajo.
  - **(baja) Tope de login por usuario: dos efectos aceptados** (Fase 180).
    El administrador maestro ya no entra en el tope de 30 fallidos por hora
    (no se puede bloquear a propósito); a cambio, contra él solo queda el
    límite por IP + usuario (10 cada 15 min), así que un intento repartido
    entre muchas IP depende de que su contraseña sea larga y única. Las
    demás cuentas sí se pueden bloquear 1 hora a propósito. Si molesta:
    bajar la ventana o avisar por correo al bloquear. Costo: bajo.

- **Paso a Node.js 24 — hecho en la Fase 192 (27/10/2026, v1.80.1)**
  (anotado 26/10/2026, Fase 181; Node 22 deja de tener soporte el
  30/04/2027). Resultado de la prueba previa (rama local, Node 24.22.1 LTS
  portátil, npm 11.19.1): `better-sqlite3` 12.11.1 trae binario para Node 24
  (ABI 137) en linux-x64 y win32-x64, sin compilar; suite completa
  2238/2238 en verde, sin avisos de deprecación; `npm audit` 0
  vulnerabilidades. Con el OK del usuario se cambiaron `server/Dockerfile`
  (`node:24-bookworm` / `-slim`), `ci.yml` (Node 24 y las imágenes de
  pre-descarga), `deploy.yml` (imágenes de pre-descarga, que la nota
  original no nombraba) y `engines` (`>=24`). Dos cosas a saber: con Node
  24, `node --test` imprime el formato "spec" (✔) en vez de TAP (`ok`,
  `# pass`) — CI no lee esa salida; y npm 11 avisa sobre el script de
  instalación de `better-sqlite3`, pero lo deja correr. Verificación en
  producción: ver la Fase 192 en `docs/historico/progress-fases.md`. Se
  quita de aquí en el próximo reordenamiento.
- **Prueba mensual de restauración del respaldo** (anotado 26/10/2026, Fase
  181) — Prioridad MEDIA, recurrente. La última prueba fue el 16/10/2026
  (copia local, `integrity_check` ok). Cómo: el primer día hábil de cada
  mes, correr `verificar-restore-backup-produccion.yml` (solo lectura:
  copia el último respaldo local a un temporal, lo revisa y lo borra) y
  anotar el resultado en la bitácora. La prueba desde S3 sigue bloqueada
  por la Política 1 de IAM (sección 1). Próxima: 2/11/2026.

- **Mapa de calor por hora (fase futura)** — Tipificación guarda la hora
  de cada registro (`tipificaciones.hora`). Falta contar en producción,
  con sesión y solo conteos, cuántas filas tienen la hora llena por
  campaña y mes, la próxima vez que se entre a producción por otra cosa.
  Anotado 16/10/2026 (Fase 152, Paso 0).
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
  suite corre en verde en CI, Node 24 desde la Fase 192, en cada PR) — es un límite de
  recursos de la máquina. **CI (Node 24) sigue siendo la referencia
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

- **Código sin uso** (Fase 146) — Prioridad BAJA: las vistas de Tráfico
  "asaaht" (ASA y AHT) y "asa" sola ya no las usa ninguna configuración
  (`public/js/trafico.js`: `_traficoDibujarAsaAht`, sus títulos y su rama
  de resumen). Se pueden quitar cuando convenga.

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
- **Clínica Aurora / Hospital La María**: se borraron en la Fase 134
  (no tenían datos reales). Se volvieron a crear vacíos, con el OK del
  usuario: Aurora en la Fase 153 y HLM en la Fase 160 (un solo cliente,
  "HOSPITAL LA MARIA", sin sedes por ahora). Lo que falta para su primera
  carga está en la sección 2.
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
