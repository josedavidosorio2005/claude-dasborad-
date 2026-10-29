# Notas de version — InConexion Platform

Este archivo explica, en palabras simples, que cambia en cada version de
la plataforma. No es un documento tecnico: es para que Edwin y Jairo
sepan que hay nuevo, que se corrigio y que falta.

## v1.101.0 — Octubre 2026

**Fase 213: Ranking de asesores con contestadas y agendas (ORLANT).**

- Agendamiento → Ranking de asesores: ahora compara, por asesor, sus
  contestadas (llamadas + WhatsApp de ingreso, del CDR de Tipificación)
  contra sus agendas, con barras y una línea del %. Sigue a MESES. Es la
  misma lógica de Efectividad de Citas, pero por asesor.
- El asesor de cada agenda sale de la Clasificación de usuarios: un usuario
  que pasa a otra persona (como INCO18 el 07/10) reparte sus agendas por la
  fecha de cambio.
- "OTROS" va aparte, fuera del ranking, en una nota con sus agendas. La nota
  también aclara que el total del equipo no cuadra exacto con Efectividad
  de Citas (el CDR y el reporte de Tráfico cuentan distinto).
- El archivo de Efectividad de Agendamiento ya no se usa en ORLANT, pero no
  se borró: su carga y lo que tenga guardado siguen.

## v1.100.1 — Octubre 2026

**Arreglo: cifras de la gráfica de Efectividad de Citas.**

- En tema oscuro las cifras de las barras casi no se leían y en el celular
  se montaban. Ahora las barras usan los colores de la marca, las cifras
  llevan un fondo y en el celular solo se muestran las del %.

## v1.100.0 — Octubre 2026

**Fase 213: total de agendas, gráfica de Efectividad de Citas e
Inasistencia sin aviso de base baja (ORLANT).**

- Agendamiento: arriba sale una tarjeta **"Total de agendas"** que cambia
  con MESES y con los filtros (por ejemplo, Tipo de línea o Sede).
- Efectividad de Citas: la gráfica muestra, por mes, una barra de las
  contestadas (llamadas + WhatsApp), otra de las agendas y una línea con el
  % de efectividad. La fórmula no cambia.
- Inasistencia por especialidad: ya no sale el aviso "Base baja" ni el
  asterisco; todas las especialidades van de mayor a menor %.

## v1.99.1 — Octubre 2026

**Fase 213: Cargar Datos de ORLANT sin las cargas que ya no se usan.**

- En "Cargar Datos" de ORLANT ya no aparecen "Llamadas y WhatsApp de
  salida" (sale sola del CDR) ni la de citas atendidas de Efectividad de
  Citas (se calcula sola desde la v1.99.0). No se borró nada: lo que se había
  subido sigue guardado, y se puede eliminar más adelante cuando Edwin esté
  seguro. Los demás clientes siguen viendo esas cargas.

## v1.99.0 — Octubre 2026

**Fase 212: Efectividad de Citas de ORLANT con la fórmula nueva.**

- La Efectividad de Citas de ORLANT ya no sale del archivo de citas
  atendidas: ahora es el total de agendas del mes (3P + General) dividido
  entre las llamadas contestadas (Tráfico de Llamadas) más los WhatsApp
  contestados (Tráfico de WhatsApp) del mismo mes. Se calcula sola con lo
  que ya está cargado.
- La gráfica es una barra de % por mes, y la tabla de abajo muestra las
  agendas, las llamadas contestadas, los WhatsApp contestados y el total.
  Con varios meses en MESES, la tarjeta suma los totales de esos meses.

## v1.98.0 — Octubre 2026

**Fase 212: sedes con nombre, filtro "Tipo de línea" resaltado y logo más
grande.**

- Agendamiento de ORLANT: la sede sale con su nombre (Sede Principal, Sede
  Poblado, Sede 34 (Audífonos), Sede Rionegro, Sede Llanogrande) en vez del
  código, en el filtro, en "Ver datos" y en Exportar. Octubre ya cargado se
  ve así sin volver a subirlo, y agosto/septiembre quedan con el mismo
  nombre: una sola opción del filtro sirve para todos los meses. Un código
  que no esté en la lista sale como "Sede" y el código.
- El filtro **"Tipo de línea"** se ve resaltado en azul, aplica apenas se
  cambia y en el celular queda siempre a la vista. Debajo del título se ve
  qué filtros están puestos. Se revisó que General y 3P filtren bien en las
  tres gráficas.
- El logo de InConexion es más grande y está arriba a la derecha, encima de
  los botones Exportar, tema y Cerrar, en todos los tableros, en tema claro
  y oscuro y en el celular.

## v1.97.0 — Octubre 2026

**Fase 211: logo de InConexion en todos los tableros y nombres de
Agendamiento.**

- En la barra de arriba de todos los tableros (todos los clientes) se ve
  ahora el logo de InConexion, a la izquierda de "Actualizar datos". Se ve
  igual en tema claro y oscuro. En el celular sale solo el símbolo, para
  que quepan los botones. El logo del cliente no cambia.
- Agendamiento de ORLANT: cuando se unifica el nombre de un asesor (alias),
  agosto y septiembre también salen con el nombre nuevo, sin volver a subir
  esos meses.

## v1.96.0 — Octubre 2026

**Fase 210: Agendamiento de ORLANT con la base tal cual sale del aplicativo.**

- La base de agendas se sube tal cual sale del aplicativo (como "AGENDAS
  MES DE OCTUBRE.xlsx"), sin prepararla a mano. El formato de antes se
  sigue aceptando, y agosto y septiembre quedan como estaban.
- Botón nuevo **"Clasificación de usuarios"** (solo administrador): lista
  de usuario → nombre del asesor → fecha de cambio, con un "+" para
  agregar. Si un usuario pasa a otra persona, se agrega otra vez con la
  fecha de cambio: sus agendas desde esa fecha cuentan para la persona
  nueva y las anteriores siguen siendo de la anterior. Sin fecha, siempre
  ha sido de esa persona. Si se agrega un usuario que ya existe sin fecha,
  la plataforma avisa que está repetido y pide la fecha.
- Botón nuevo **"Clasificación de líneas"** (solo administrador): lista
  de código de entidad → Línea 3P o Línea General, con un "+". Los códigos
  que no estén en la lista (particulares, que se crean con la cédula) y
  los que vienen vacíos suman a 3P. Esos códigos no se guardan tal cual,
  porque pueden ser la cédula de un paciente.
- Las dos listas se pueden cargar desde el Excel de usuarios y códigos, y
  corregir cuando se necesite: el cambio se ve de inmediato en las
  gráficas, sin volver a subir la base.
- Un usuario que no está en la lista sale como "Usuario X (sin asesor)"
  hasta que se le asigne una persona.
- Agendas por especialidad sale de la especialidad de la base. El ranking
  de asesores no cambia.
- Esta clasificación es solo de Agendamiento: la Clasificación de
  asesores de Tipificación sigue igual.

## v1.95.0 — Octubre 2026

**Fase 209: Flujo por hora de Mobilize en una sola tabla.**

- Antes salía una tabla por cada mes. Ahora sale una sola tabla de
  ingresadas, una de contestadas y una de abandonadas, que suman los meses
  marcados en MESES. Con "Todos" suman todos los meses cargados; con un
  solo mes marcado, muestran solo ese mes. El título dice los meses
  elegidos. Con varios meses, cada día suma ese día de todos los meses (por
  ejemplo, el día 5 suma el 5 de agosto, el 5 de septiembre y el 5 de
  octubre).
- Las abandonadas van ahora en rojo (alto rojo, medio rojo claro, bajo
  gris). Las ingresadas y las contestadas siguen en verde, amarillo y gris.
- En el celular y la tablet, el número del día 1 ya se ve en el
  encabezado (antes salía en blanco).
- El Excel/PDF exportado sale igual: una tabla por métrica con los meses
  sumados.

## v1.94.1 — Octubre 2026

**Fase 208: Calidad de Mobilize sin el aviso de "no hay monitoreos".**

- En la pestaña Calidad de Mobilize ya no sale "Todavía no hay monitoreos
  de calidad para Mobilize" (ni el cuadro vacío "Sin monitoreos todavía")
  cuando ya está cargado el resumen de calidad por asesor: la calidad se ve
  en ese resumen. Si una campaña no tiene ni monitoreos ni resumen, el
  aviso sigue saliendo como antes.

## v1.94.0 — Octubre 2026

**Fase 207: la regla de MESES en todas las campañas.**

- Lo que ya hacía Mobilize desde la v1.91.0 ahora vale para todas las
  campañas: ORLANT completo (Tráfico de WhatsApp, Agendamiento,
  Efectividad de Agendamiento, Inasistencia, Efectividad de Citas, Llamadas
  y WhatsApp de salida, WhatsApp por rangos y Calidad), Clínica Aurora,
  Hospital La María y las que se creen después.
- Al entrar, MESES está en "Todos" y las tarjetas suman todos los meses
  cargados. Con un mes marcado, muestran ese mes. Con varios, suman solo
  esos meses. Los porcentajes salen de los totales sumados, nunca del
  promedio de los porcentajes.
- Efectividad de Citas y Inasistencia tienen ahora una sola tarjeta: el %
  ponderado de los meses elegidos (antes eran dos: el del mes y el de todo
  el período).
- El "vs. agosto" de las tarjetas y "Comparar contra" aparecen solo con un
  mes marcado (con varios meses no hay un "mes anterior").
- Si el mes en curso está entre los elegidos, el subtítulo lo marca como
  parcial ("Oct 2026 parcial").
- El nivel de servicio de llamadas sigue siendo el promedio de los días
  (ahora de los días de los meses elegidos); el de WhatsApp sigue ponderado
  por el total de WhatsApp, como antes.

## v1.93.0 — Octubre 2026

**Fase 206: 15 tipificaciones a la vista y "Llamadas ingresadas" en ORLANT.**

- Tipificación, en la computadora: la torta muestra hasta 15 tipificaciones
  (antes 14), así que las 15 de octubre de Mobilize se ven todas, sin
  "Otras". Cuando hay más de 12, cada porción tiene su propio color (antes
  algunas repetían color).
- ORLANT, Tráfico de Llamadas: el total se llama ahora **"Llamadas
  ingresadas"**, igual que en Mobilize: en la tarjeta, la leyenda, al pasar
  el mouse, en "Ver datos" y en el Excel. Solo cambia el texto.

## v1.92.0 — Octubre 2026

**Fase 205: Tipificación con el listado completo (pedido de Edwin).**

- "Ver datos" de cada torta de Tipificación muestra **todas** las
  tipificaciones, una por fila, con su cantidad y su %, sin agruparlas en
  "Otras". La tabla de al lado y el Excel también traen el listado completo.
- La torta muestra todas las tipificaciones que caben legibles en la pantalla
  (hasta 20 en la computadora, 14 en tableta y 10 en el celular, donde la
  leyenda va debajo). Si hay más, el resto queda en "Otras" y, al pasar el
  mouse por "Otras", se ve cuáles son, con su cantidad y %.
- Aplica en Mobilize y en ORLANT (usan la misma pantalla de Tipificación).

## v1.91.1 — Octubre 2026

**Fase 204: "Llamadas ingresadas" en Flujo de Llamadas de Mobilize (pedido de Edwin).**

- En Flujo de Llamadas de Mobilize, el total se llama ahora **"Llamadas
  ingresadas"**: en la tarjeta (antes "Total de llamadas"), en la leyenda de
  la gráfica (antes "Total Llamadas"), al pasar el mouse, en "Ver datos" y en
  la columna del Excel.
- Solo cambia el texto: los números son los mismos.
- ORLANT (Tráfico de Llamadas) sigue diciendo "Total de llamadas" mientras
  no se decida cambiarlo allí.

## v1.91.0 — Octubre 2026

**Fase 203: las tarjetas obedecen solo al filtro MESES (pedido de Edwin).**

- Al entrar (y después de cerrar sesión y volver a entrar), MESES está en
  "Todos" y las tarjetas de resumen suman **todos los meses cargados**, no
  solo octubre.
- Con un mes marcado, las tarjetas muestran solo ese mes. Con varios, suman
  solo esos meses: por ejemplo, agosto y octubre sin contar septiembre. Los
  porcentajes (nivel de atención, FCR / One & Done, Eficacia, promedio de
  calidad) se calculan con los totales sumados, no como promedio de
  porcentajes.
- El subtítulo dice los meses que se están viendo ("Informe Todos los meses
  (Ago 2026 – Oct 2026)", "Informe Septiembre 2026" o "Informe Ago 2026, Oct
  2026"), no un mes fijo.
- En Mobilize se aplica en Flujo de Llamadas (tarjetas, FCR, One & Done y
  Eficacia), Llamadas Únicas y de Salida, Flujo por hora (una tabla por cada
  mes marcado), Tipificación, Encuesta y Calidad. La tarjeta FCR ya no
  muestra "Otros meses": con varios meses trae el detalle "Por mes" de esos
  mismos meses.
- El Desde/Hasta de Tráfico de Llamadas arranca con los meses de MESES
  ("Todos" = todo lo cargado). En ORLANT, Tráfico de Llamadas y Tipificación
  también siguen esta regla. Las otras pantallas de un solo mes de ORLANT
  siguen mostrando el último mes marcado.

## v1.90.0 — Octubre 2026

**Fase 202: Calidad de Mobilize por mes, con torta y barras.**

- La carga "Calidad: resumen por asesor" recibe el archivo de Edwin tal cual,
  con una hoja por mes (AGOSTO, SEPTIEMBRE, OCTUBRE): cada hoja va a su mes.
  La vista previa dice a qué mes va cada hoja y, antes de guardar, se
  confirma qué meses son nuevos y cuáles se reemplazan.
- En la pestaña Calidad, del mes elegido: una torta con el % de monitoreos de
  cada asesor y barras con el Prom. puntaje (%) de cada asesor. La tabla por
  asesor sigue con la clasificación, la alerta y los fallos críticos. El
  Excel trae también el "% de monitoreos".
- En la computadora, el botón de MESES del encabezado es un poco más alto
  (más fácil de usar).

## v1.89.0 — Octubre 2026

**Fase 201: un solo filtro de meses en el encabezado (todos los clientes).**

- Se quitó el filtro "MES" del encabezado del tablero. Queda solo "MESES",
  el de las casillas.
- Las tarjetas de arriba y las pantallas que muestran un solo mes siguen el
  último mes marcado en MESES. Sin ninguno marcado ("Todos"), el mes más
  reciente con datos, como al abrir el tablero.
- Los filtros Desde/Hasta de cada pantalla se ajustan solos a ese mes, igual
  que antes con el MES. "Comparar contra", Exportar y el botón "Ver <mes>"
  de los avisos también usan ese mes ("Ver <mes>" deja marcado solo ese mes).
- En el celular, el botón de MESES es más fácil de tocar.

## v1.88.0 — Octubre 2026

**Fase 200: One & Done de Mobilize sobre las encuestas que empezaron.**

- One & Done = encuestas con "Sí" en la pregunta 3 ÷ encuestas que
  contestaron la pregunta 1 (las que empezaron la encuesta). Antes se dividía
  por todas las encuestas del mes.
- Cambia igual en la tarjeta "Solución en primer contacto (FCR)" de Flujo de
  Llamadas y en la sub-pestaña One & Done, que ahora muestra la nota con la
  fórmula. El Excel de One & Done trae también la columna "Contestaron la
  pregunta 1".
- Agosto: 5 de 6 = 83,3 % (antes 5 de 21 = 23,8 %). Septiembre: 3 de 5 =
  60 % (antes 3 de 45 = 6,7 %). Octubre: 19 de 28 = 67,9 % (antes 19 de 82 =
  23,2 %).

## v1.87.0 — Octubre 2026

**Fase 199: la Eficacia de Mobilize en su propia sub-pestaña.**

- En Flujo de Llamadas hay una sub-pestaña nueva, "Eficacia", a la derecha de
  "One & Done". Ahí están la tarjeta del mes, las barras por mes y la nota con
  la lista de códigos positivos. Su Excel y su PDF exportan la tabla por mes.
- "One & Done" vuelve a mostrar solo el One & Done, como antes de la v1.86.0.
- El cálculo no cambia: octubre, 42 de 89 contestadas de ingreso = 47,2 %.

## v1.86.0 — Octubre 2026

**Fase 198: indicador "Eficacia" en Mobilize.**

- En Flujo de Llamadas → One & Done, al lado del One & Done: Eficacia =
  llamadas contestadas de ingreso con un código positivo ÷ llamadas contestadas
  de ingreso del mes, en %. Tarjeta del mes, barras por mes y la nota de cómo
  se calcula, con la lista de códigos positivos que definió Kelly.
- Los códigos se reconocen aunque vengan sin tildes, con otras mayúsculas o
  con "_"; también cuando Wolkvox borra la letra con tilde.
- Octubre: 42 de 89 contestadas de ingreso = 47,2 %.

## v1.85.0 — Octubre 2026

**Fase 197: NPS y Flujo por hora más claros (Mobilize).**

- Encuesta, NPS: los porcentajes de las barras se ven también en el celular
  (verticales). El resumen dice "NPS (promotores − detractores)" y muestra la
  cuenta: 57,1 % de promotores − 35,7 % de detractores = 21,4 (no es un total).
- Flujo por hora: las columnas de los mapas llevan el título "Día del mes".

## v1.84.0 — Octubre 2026

**Fase 196: pestaña nueva "Flujo por hora" en Mobilize.**

- Tres mapas de calor, uno debajo del otro: llamadas ingresadas, contestadas
  y abandonadas por hora (filas) y día del mes (columnas), con fila y columna
  de Total. Colores en tres niveles: alto en verde, medio en amarillo, bajo en
  gris; el número siempre está escrito. Sigue el mes de arriba.
- Base nueva en el Centro de cargas: el reporte por hora de Wolkvox, subido
  tal cual. La vista previa muestra los totales del archivo, que son los
  mismos del mapa.
- En el celular, cada tabla se desplaza de lado dentro de su tarjeta.

## v1.83.0 — Octubre 2026

**Fase 195: NPS en la Encuesta de Mobilize.**

- La gráfica de la pregunta 1 tiene un botón "NPS": cambia las cantidades por
  porcentajes sobre las encuestas que contestaron la pregunta 1 y muestra el
  NPS (% de promotores 9-10 menos % de detractores 0-6), con una nota de cómo
  se calcula. One and Done no cambia.

## v1.82.1 — Octubre 2026

**Seguridad: actualización de una librería interna.**

- Se actualizó `qs` (la usa el servidor por dentro para leer los pedidos) a
  la 6.17.0, que corrige un aviso de seguridad publicado hoy. No cambia nada
  de lo que se ve.

## v1.82.0 — Octubre 2026

**Fase 194: Llamadas de salida de Mobilize completas.**

- Llamadas de salida conectadas: ahora cuentan todas las filas con skill "-"
  del CDR. Antes se perdían las tipificadas como prueba y las repetidas
  (septiembre 67 en el CDR y 64 en el tablero). Para corregir un mes ya
  cargado, su CDR se vuelve a subir.
- Base nueva en el Centro de cargas: "No conectadas", el reporte de Wolkvox
  "5. Detalle de las llamadas para las no conectadas", subido tal cual. Cada
  fila cuenta; alimenta las no conectadas y el total de salida.
- El Centro de cargas de "Llamadas Únicas y de Salida" ya no muestra las
  cargas armadas a mano de ingreso y de salida (eso sale del CDR). Quedan
  "Abandonadas" y "No conectadas". Lo ya guardado no se borra.
- Un mes sin el reporte de abandonadas muestra 0 abandonadas.
- El teléfono nunca se guarda ni se muestra.

## v1.81.0 — Octubre 2026

**Fase 193: Encuesta de Mobilize con la base completa de Wolkvox.**

- La encuesta se sube tal cual la descarga Wolkvox (el reporte completo, de
  25 columnas), sin armar nada a mano. La plantilla del Centro de cargas ahora
  es ese mismo reporte.
- Las gráficas son las mismas. La vista previa dice qué columnas usó y
  cuántas filas traen el ID de la llamada.
- Cada comentario y el Excel muestran el ID de la llamada. El teléfono y los
  documentos del reporte nunca se leen ni se guardan.

## v1.80.1 — Octubre 2026

**Fase 192: la plataforma pasa a Node.js 24.**

- Por dentro, el servidor ahora corre con Node.js 24 (la versión con soporte
  largo). Node 22 deja de tener soporte en abril de 2027; así se adelanta el
  cambio con margen.
- No cambia nada de lo que se ve ni de las cifras.

## v1.80.0 — Octubre 2026

**Fase 191: Llamadas Únicas de Mobilize con las bases de Wolkvox tal cual.**

- **Contestadas únicas** salen del CDR de llamadas que ya se sube en
  Tipificación. Solo cuentan los skills de ingreso (las de skill "-" son de
  salida). Un teléfono cuenta una vez por día: si llama varias veces el mismo
  día cuenta 1; otro día vuelve a contar. Para que un mes salga de aquí, su
  CDR se vuelve a subir con esta versión (Tipificación no cambia).
- **Abandonadas únicas**: base nueva en el Centro de cargas (Llamadas Únicas
  y de Salida → "Abandonadas"): el reporte "Detalle de llamadas abandonadas"
  de Wolkvox, subido tal cual. La vista previa dice qué columnas usó y avisa
  si falta DATE, ANI o SKILL_NAME.
- **Llamadas de salida conectadas**: en los meses con CDR salen de las filas
  con skill "-". Las no conectadas necesitan otra base que todavía no está:
  esos meses dicen "Pendiente", sin inventar la cifra.
- Debajo de cada gráfica, una tabla "De dónde sale cada mes". Los meses sin
  CDR siguen con la carga anterior. El Excel de "Exportar" también la trae.
- El teléfono nunca llega al servidor ni se muestra.

## v1.79.0 — Octubre 2026

**Fase 190: Tipificación de ORLANT sin las tortas de salida por línea.**

- En Tipificación de ORLANT salen las dos tortas de abajo: "Llamadas de
  salida por línea" y "WhatsApp de salida por línea".
- La salida por línea se sigue viendo con los botones Total / Línea General
  / Línea 3P de la pestaña "Llamadas y WhatsApp de salida".
- Nada más cambia: las tarjetas Salida General / Salida 3P / Sin clasificar,
  el filtro "Línea de salida" y las tortas de tipificación siguen igual.

## v1.78.0 — Octubre 2026

**Fase 189: los botones de línea van en cada gráfica (pedido de Edwin).**

- Los botones "Total", "Línea General" y "Línea 3P" ya no están arriba de
  la pestaña: cada gráfica (llamadas y WhatsApp) tiene los suyos en su
  cabecera, con el mismo estilo de las demás gráficas del tablero.
- Cada grupo cambia solo su métrica: su tarjeta, sus barras y su parte de
  la tabla. Por ejemplo, llamadas en "Línea 3P" y WhatsApp en "Total".
- En el celular, los botones van debajo del título de la gráfica.
- "Línea de cada asesor" sigue arriba. La cuenta no cambia: General + 3P +
  Sin clasificar = Total.

## v1.77.0 — Octubre 2026

**Fase 188: botones Total, Línea General y Línea 3P en la salida de ORLANT.**

- Arriba de la pestaña "Llamadas y WhatsApp de salida" hay tres botones:
  "Total", "Línea General" y "Línea 3P". Al tocar uno, las tarjetas, las
  barras y la tabla muestran solo la salida de esa línea, en llamadas y en
  WhatsApp. El botón activo queda marcado.
- "Total" muestra todo, incluidos los asesores "Sin clasificar".
- Con una línea elegida, la tabla dice también qué parte del Total es.
- El bloque "Línea de cada asesor" (botón "Clasificación de asesores") pasó
  arriba de la pestaña.

## v1.76.1 — Octubre 2026

**Fase 187 (paso 2): se activa la clasificación única de asesores en ORLANT.**

- La pestaña "Llamadas y WhatsApp de salida" reparte la salida de todos los
  meses con la clasificación de asesores de Tipificación (una sola). Lo que
  no tiene línea queda en "Sin clasificar".
- Las líneas que se habían elegido mes a mes se copian a la clasificación
  cuando el asesor tenía la misma línea en todos los meses y todavía no
  estaba clasificado. Si un asesor tenía 3P en un mes y General en otro,
  no se copia: hay que elegirle la línea en "Clasificación de asesores".
- Lo guardado mes a mes no se borra.

## v1.76.0 — Octubre 2026

**Fase 187: una sola clasificación de asesores (preparación).**

- La pestaña "Llamadas y WhatsApp de salida" ya puede usar la misma
  clasificación de asesores de Tipificación, una sola para todos los
  meses, en lugar de elegir la línea mes a mes. **Todavía no está activa**:
  se enciende con la migración, cuando se revise lo guardado.
- Mientras tanto, el administrador ve en esa pestaña qué meses tienen
  líneas guardadas mes a mes y qué asesores cambian de línea según el mes.
  Nada de lo guardado se borra.
- Ya activa, la pestaña dirá "Sin clasificar" y tendrá el mismo botón
  "Clasificación de asesores".

## v1.75.0 — Octubre 2026

**Fase 186: Salida General y Salida 3P en la Tipificación de ORLANT.**

- La salida de llamadas y la de WhatsApp se reparten en "Salida General" y
  "Salida 3P" según el asesor que la hizo, en tarjetas y en una torta por
  canal. Los asesores sin línea quedan en "Sin clasificar" y siguen
  contando: las tres suman la salida, y el total del mes no cambia.
- Nuevo filtro "Línea de salida", junto al mes: cambia las tortas de
  Llamadas y de WhatsApp a la vez.
- Botón "Clasificación de asesores" (solo el administrador): la lista de
  asesores de los CDR con un selector de línea para cada uno. Se guarda una
  vez para el cliente y sirve para todos los meses.
- La lista también se llena desde un Excel (nombre del asesor, línea). Si
  un nombre no coincide con ningún asesor de los CDR, se avisa y no se
  aplica.
- Los usuarios del cliente ven el resultado, pero no pueden cambiarlo.

## v1.74.0 — Octubre 2026

**Fase 185: Tipificación de WhatsApp de ORLANT cuadra con el archivo.**

- Cada chat cuenta en el día en que se **cerró** (DATE_CLOSE), igual que arma
  Wolkvox el archivo. Antes contaba el día en que se abrió: los chats
  abiertos el último día del mes anterior se iban a ese mes (en octubre, 60
  chats abiertos el 30/09, 17 de ellos de salida), y al cargar el archivo se
  borraba ese día del mes anterior.
- Nueva tarjeta "Total WhatsApp" en la mitad de WhatsApp, igual que "Total
  llamadas".
- Un skill que no está en la tabla (por ejemplo 4308) se ve como
  "Skill 4308" y cuenta en el total.
- Si al cargar se omite más de una fila, la vista previa dice primero
  cuántas y por qué.
- Las fechas escritas como "01/10/2026 08:15" ya no se descartan.
- **Hay que volver a subir** los HistChat de agosto, septiembre y octubre
  para que tomen la regla nueva (el orden no importa).

## v1.73.0 — Octubre 2026

**Fase 184: ID de la llamada en los comentarios de la Encuesta (Mobilize).**

- En la pestaña Encuesta, cada comentario muestra el ID de la llamada de
  Wolkvox (columna CONN_ID del archivo de encuesta), para ubicar la llamada.
  También sale en el Excel.
- No se muestra el teléfono: se mantiene la regla de no guardar teléfonos.
- Las encuestas ya cargadas y los archivos que no traen CONN_ID quedan con
  el ID vacío; no se adivina cruzando con otras bases. Para verlo en los
  meses ya cargados, hay que volver a subir el archivo con esa columna.
- Arreglo: un mes que solo tiene Encuesta (sin Flujo de Llamadas) a veces
  no aparecía en el selector MES de Mobilize; ya aparece.

## v1.72.8 — Octubre 2026

**Fase 183: Tipificación de ORLANT con las reglas de Edwin del 26/10.**

- Llamadas de salida = las filas del CDR con skill "-", todas. Agosto queda
  en 6.560 (antes 6.945: se estaban sumando las 390 de "Cancelaciones y
  reprogramación", que son llamadas programadas de ese skill, y faltaban 5
  filas "-" de llamadas internas).
- "Cancelaciones y reprogramación" vuelve a aparecer como skill propio en
  el filtro y en la torta.
- Ya no queda ninguna fila suelta con "-": todas cuentan como Llamadas de
  salida.
- En la mitad de Llamadas, una sola tarjeta: "Total llamadas" del mes.
- En "Llamadas y WhatsApp de salida", cada gráfica muestra solo la salida
  del mes (sin repartir en 3P, General y Sin asignar; la tabla de abajo
  sigue con el detalle).
- WhatsApp: un skill que no está en la tabla de skills ya no se pierde al
  cargar; se ve como "Skill <número>".
- Agendamiento: cada barra de especialidad con su propio color.
- No hay que volver a cargar nada: los datos ya subidos se leen con la
  regla nueva. Mobilize no cambia.

## v1.72.7 — Octubre 2026

**Fase 182: mantenimiento.**

- Se actualizaron el componente que limita los intentos de inicio de sesión
  y las herramientas de pruebas automáticas a sus versiones más recientes
  dentro de la misma línea. No cambia nada de lo que se ve ni de los
  números.

## v1.72.6 — Octubre 2026

**Fase 181: mantenimiento.**

- Se actualizaron dos componentes internos del servidor (Express y la
  librería de AWS que sube los respaldos) a sus versiones más recientes
  dentro de la misma línea. No cambia nada de lo que se ve ni de los
  números.

## v1.72.5 — Octubre 2026

**Fase 180: la cuenta del administrador principal no se puede bloquear a
propósito.**

- El bloqueo de una hora tras 30 intentos fallidos ya no aplica a la cuenta
  del administrador principal, para que nadie la pueda dejar fuera a
  propósito. Sigue teniendo el límite de siempre: 10 intentos por
  computador cada 15 minutos.

## v1.72.4 — Octubre 2026

**Fase 179: el Resumen de calidad ignora las filas de total.**

- Si la plantilla de calidad trae al final una fila "TOTAL", "Promedio
  general" o parecida, ya no se cuenta como un asesor más (antes duplicaba
  los monitoreos del mes). La vista previa avisa cuántas filas se omitieron.

## v1.72.3 — Octubre 2026

**Fase 178: arreglos preventivos.**

- Centro de cargas: después de **Deshacer** o **Eliminar** un mes (y también
  después de cargar), el tablero que está abierto detrás se actualiza solo,
  sin recargar la página. Se queda en el mismo mes y la misma pestaña.
- El selector MES y el filtro "Meses" ahora incluyen los meses que solo
  tienen Resumen de calidad, Encuesta, WhatsApp por rangos o Llamadas de
  salida. Antes, un mes así no se podía elegir arriba.
- Umbrales del semáforo: cada usuario ve solo los de los clientes a los que
  tiene acceso (más los generales). El administrador sigue viendo todos.
- Inicio de sesión más seguro: si una misma cuenta acumula 30 intentos
  fallidos en una hora (aunque vengan de computadores distintos), queda
  bloqueada para iniciar sesión hasta que pase la hora. Queda un aviso
  "Cuenta bloqueada por intentos" en el Historial. El límite de siempre (10
  intentos por computador y usuario cada 15 minutos) no cambia.

## v1.72.2 — Octubre 2026

**Fase 177: arreglos de la revisión de errores y seguridad.**

- Tipificación de llamadas: una llamada con skill "-" ahora cuenta como
  "Llamadas de salida" solo si de verdad es de salida. Antes, una llamada
  entrante con "-" también se habría contado como salida. Los números de
  septiembre de ORLANT no cambian (el archivo real no tenía ninguna).
- Al cargar el resumen de calidad, si el puntaje viene como fracción (0,85
  en vez de 85), se lee como porcentaje y se avisa. Antes todos los
  asesores habrían salido "Crítico".
- Los meses tienen que existir: ya no se acepta un mes como "2026-13".
- Después de cargar Tipificación o Salida, esos paneles muestran enseguida
  los meses nuevos, sin tener que recargar la página.

## v1.72.1 — Octubre 2026

**Fase 176: encabezado del celular todavía más corto.**

- En el teléfono, la fecha de la última actualización ahora dice, por
  ejemplo, "Act. 24/10 08:30" en una sola línea, y el informe ya no repite
  el nombre del cliente (ya está en el logo y el título). El encabezado
  queda más bajo y se ven antes los datos. En el computador no cambia nada.

## v1.72.0 — Octubre 2026

**Fase 175: el tablero se ve mejor en el celular.**

- En el teléfono, el encabezado del tablero (logo, título y filtros) ocupaba
  más de la mitad de la pantalla antes de llegar a los datos. Ahora es
  compacto: logo y título más pequeños, una sola fila de botones y los
  filtros (MES, MESES, COMPARAR) guardados en un botón que dice el mes
  elegido, por ejemplo "Sep 2026". Al tocarlo se abren; al elegir un mes se
  cierran solos.
- Lo mismo en tabletas (hasta 768 px de ancho). En el computador no cambia
  nada.

## v1.71.0 — Octubre 2026

**Fase 174: reglas de ORLANT que confirmó Edwin.**

- Las llamadas "out_pre" del CDR de ORLANT (marcador predictivo, llegan con
  el skill CANCELACIONES Y REPROGRAMACION) ahora cuentan como **llamadas de
  salida**: en Tipificación (filtro "Llamadas de salida" y tarjetas) y en la
  salida por asesor (3P / General). Ya no cuentan además como entrada de
  CANCELACIONES. Para los meses ya cargados, se ve al volver a cargar el CDR.
- **"No conectada" ahora depende del cliente.** En ORLANT son NO_CONTESTAN y
  BUZON (siguen separadas en la torta); en Mobilize sigue siendo
  "Cliente no contesta".
- Las plantillas de "CDR de llamadas" y "CDR de WhatsApp" traen ahora todas
  las columnas del export de Wolkvox (20 y 32), en el mismo orden, aunque el
  sistema solo use algunas. Así se puede subir el archivo tal cual sale de
  Wolkvox.
- El CDR también se puede subir con la fecha y la hora juntas como texto
  ("2026-09-01 08:15:00").

## v1.70.1 — Octubre 2026

**Fase 173: hora de la última carga en el Centro de cargas.**

- El Centro de cargas mostraba la hora de cada carga 5 horas después de la
  real (una carga hecha a las 2:13 p. m. salía a las 7:13 p. m.). Ahora
  muestra la hora real de Colombia. Los datos cargados no cambian.
- Revisado: la Tipificación de septiembre de Mobilize sí está cargada (167
  llamadas, del 1 al 30 de septiembre) y se ve en el tablero.

## v1.70.0 — Octubre 2026

**Fase 172: Calidad de Mobilize con el resumen por asesor.**

- **Nueva carga "Calidad: resumen por asesor"** (Mobilize), con la plantilla
  de Edwin: una fila por asesor con # Monitoreos, Puntaje promedio y Total
  de fallos críticos. El mes se elige al subir y la carga reemplaza solo ese
  mes (se puede deshacer durante 30 días).
- La plantilla puede traer fórmulas que apuntan al libro de Monitoreos: el
  sistema toma los valores ya calculados. Si alguna celda sale en error
  (#REF!) o vacía, avisa en un solo mensaje: abrir la plantilla junto con el
  libro de Monitoreos, dejar que calcule y guardarla antes de subirla.
- La clasificación (Crítico, No crítico, Sobresaliente) y la alerta (Sin
  fallos críticos, Alerta, Crítico frecuente) se calculan siempre con las
  mismas reglas del archivo, a partir de los números.
- **En la pestaña Calidad de Mobilize**, primero sale el resumen: promedio
  general del mes (ponderado por monitoreos), total de monitoreos y de
  fallos, una tabla por asesor con colores de semáforo y otra por mes. Sigue
  el filtro de meses y se exporta a Excel y PDF.
- Plantilla oficial descargable desde el Centro de cargas, con su hoja de
  instrucciones.

## v1.69.0 — Octubre 2026

**Fase 171: pedidos de Edwin para Mobilize.**

- **Llamadas de salida:** cada fila del archivo cuenta como una llamada. El
  archivo de octubre tiene 85 filas (45 conectadas y 40 no conectadas) y
  ahora entran las 85; antes se tomaban 54 porque se dejaba una sola llamada
  por número y día, y se descartaban las filas sin asesor. Las filas sin
  asesor se cargan como "Sin asesor". "No conectada" se reconoce aunque
  venga con guion, sin espacio o en plural. Solo se dejan por fuera las filas
  vacías o sin fecha, y se avisa en un solo mensaje.
- Ya no sale el aviso de "el archivo no trae el mes completo" en llamadas de
  salida: es normal que haya días sin llamadas.
- **Tipificación:** las llamadas de salida que venían con skill "-" ahora
  aparecen y se filtran como "Llamadas de salida".
- **Encuesta:** cada mes muestra solo sus encuestas. Si un mes no tiene, la
  pantalla lo dice en vez de mostrar las de otro mes.
- **Cerrar sesión:** al volver a entrar, el tablero arranca sin los filtros
  de la persona anterior (mes, skill, asesor, fechas).
- **Colores:** en la gráfica de llamadas de salida, conectadas (azul) y no
  conectadas (magenta) tienen colores bien distintos.

## v1.68.0 — Octubre 2026

**Fase 170: llamadas y WhatsApp de salida calculados con los CDR, por línea de cada asesor.**

- En los meses que ya tienen los CDR de Wolkvox cargados, la pestaña
  "Llamadas y WhatsApp de salida" de ORLANT se calcula con ellos, en vez del
  archivo mensual: las llamadas de salida y los WhatsApp de salida de cada
  asesor.
- Cada asesor se asigna a 3P o a General para cada mes. Lo hace el
  administrador en la misma pestaña ("Línea de cada asesor"), con un botón
  para copiar las líneas del mes anterior.
- Mientras un asesor no tenga línea en ese mes, sus salidas se cuentan en
  "Sin asignar": suman al total, pero no a 3P ni a General, y la pestaña
  avisa cuántos asesores faltan. Por eso septiembre aparece completo en
  "Sin asignar" hasta que se asignen las líneas.
- Los meses sin CDR siguen saliendo del archivo mensual, como siempre. La
  tabla y el Excel dicen de dónde sale cada mes ("CDR" o "Archivo mensual").
- Septiembre: 10.399 llamadas y 3.997 WhatsApp de salida. El archivo de
  Edwin decía 10.404 llamadas; la diferencia son 5 llamadas internas que no
  cuentan como salida.

## v1.67.1 — Octubre 2026

**Fase 169: "Llamadas de salida" sale una sola vez en el filtro.**

- En Tipificación de llamadas, los meses cargados antes guardaban las
  llamadas de salida con el nombre "LINEA DE SALIDA" y septiembre ahora las
  guarda como "Llamadas de salida". En el filtro de skill salían las dos.
  Ahora sale una sola, "Llamadas de salida", y al elegirla trae las de todos
  los meses.
- No se borró ni se cambió ningún dato: solo cómo se agrupan y se muestran.

## v1.67.0 — Octubre 2026

**Fase 168: Tipificación con los dos CDR de Wolkvox (pedido de Edwin).**

- La tipificación de ORLANT ahora se carga con solo dos archivos de
  Wolkvox: el CDR de llamadas y el CDR de WhatsApp.
- El CDR de WhatsApp trae el número del skill, no su nombre. La plataforma
  lo traduce con una tabla de skills de WhatsApp de cada cliente (ORLANT ya
  la tiene cargada). Un administrador la puede cambiar en Cargar Datos →
  "Skills de WhatsApp". El 0 es WhatsApp de salida. Si llega un número que
  no está en la tabla, esas filas no se cargan y la vista previa dice
  cuántas fueron, en un solo aviso.
- En el CDR de llamadas, las llamadas sin skill ("-") son las de salida y
  ahora se ven como "Llamadas de salida". Las llamadas internas no cuentan
  como salida.
- Si el archivo de un mes trae unas filas del mes anterior (por ejemplo, el
  31 de agosto en el de septiembre), solo se reemplazan esas fechas; el
  resto de agosto no se toca.
- En la pestaña Tipificación de ORLANT, la de llamadas y la de WhatsApp
  vuelven a verse lado a lado (una debajo de la otra en el celular), cada
  una con sus filtros de asesor, skill y tipo (entrante o de salida). Se
  quitó la tabla de detalle de abajo.
- La plantilla y la guía dicen de dónde sale cada CDR (la ruta exacta en
  Wolkvox está pendiente de confirmar con Edwin) e incluyen la tabla de
  skills.

## v1.66.0 — Octubre 2026

**Fase 167: ver varios meses sueltos lado a lado (pedido de Edwin).**

- En el tablero, junto al MES, hay un filtro nuevo: **MESES**. Ahí se
  marcan los meses que se quieren ver, por ejemplo solo septiembre y
  octubre, sin agosto.
- Las gráficas y tablas que van por mes muestran solo esos meses, uno al
  lado del otro: Tráfico de Llamadas y de WhatsApp, Llamadas y WhatsApp de
  salida, Inasistencia, Efectividad de Citas, Agendas por mes, Llamadas
  Únicas y de Salida, la tabla "Por mes" de Nivel de Servicio y las
  gráficas de resumen. Lo exportado a Excel también sale así.
- No suma meses: las tarjetas de arriba siguen el MES y su comparación
  contra el mes anterior, como siempre. "Ver todos los meses" lo deja como
  estaba. Los números no cambian.

## v1.65.1 — Octubre 2026

**Fase 166: Nivel de Servicio de WhatsApp visible aunque falte el Flujo del mes.**

- En Tráfico de WhatsApp, si el mes elegido arriba todavía no tenía el
  Flujo de WhatsApp cargado, la pestaña decía "sin datos" y escondía
  también "Nivel de Servicio", aunque los tiempos de ese mes ya estuvieran
  cargados. Ahora se sigue viendo el aviso y, debajo, "Nivel de Servicio"
  con sus datos y sus botones Excel y PDF.
- Cuando el Flujo del mes se carga, la pestaña vuelve a mostrarse completa.
  Los números no cambian.

## v1.65.0 — Octubre 2026

**Fase 165: WhatsApp por rangos de tiempo, pedido de Edwin.**

- Al subir el reporte de WhatsApp de Wolkvox salían miles de avisos
  "ANSWER_TIME inválido o vacío" y esas conversaciones no se cargaban. Era
  porque la plataforma solo entendía el tiempo como un número limpio, y
  Wolkvox a veces lo trae como texto (con un apóstrofo delante) o como
  duración (00:01:35). Ahora lee todos esos formatos. Solo se dejan por
  fuera las filas vacías, y la vista previa dice cuántas fueron.
- Si algo no se puede leer, sale un solo aviso con cuántas filas fueron y
  cuáles, en vez de un aviso por fila.
- Los rangos ahora son: menos de 3 minutos = "0 a 3 minutos", menos de 5 =
  "3 a 5", menos de 8 = "5 a 8", menos de 10 = "8 a 10" y el resto "10
  minutos en adelante". Una conversación de 3 minutos exactos ahora cuenta
  en "3 a 5". Esto aplica también a lo que ya estaba cargado.
- En "Nivel de Servicio" de WhatsApp hay dos tablas nuevas con la
  cantidad y el % de cada rango: por cola (del mes) y por mes. También
  salen en el Excel y el PDF.
- La plantilla, la pantalla de carga y la guía dicen de dónde se descarga
  el archivo: Wolkvox > Reportes > Skills & Servicios > 10. Detalle de
  llamadas contestadas. El archivo se sube tal cual.
- En "Llamadas y WhatsApp de salida", los títulos "Llamadas de salida" y
  "WhatsApp de salida" son más grandes.

## v1.64.10 — Octubre 2026

**Fase 164: iconos en vez de emojis.**

- Los emojis de colores (círculos rojo, amarillo y verde, chulos, alertas,
  teléfono, chat) se veían distinto según el celular o el computador.
  Ahora son iconos de la misma familia que el resto de la plataforma, en
  Calidad (monitoreos, resumen por asesor, reportes, configuración),
  Metas, Mis resultados, la tarjeta de Calidad del tablero, la lista de
  usuarios y las tarjetas de módulos del inicio.
- El estado siempre se dice también con la palabra ("Crítico", "Alerta"…)
  y en la tarjeta del tablero el color sigue saliendo de la meta.
- Las exportaciones (Excel/PDF) no cambian. Los números no cambian.

## v1.64.9 — Octubre 2026

**Fase 164: porcentajes de las tortas sin montarse.**

- En las tortas con muchas porciones (por ejemplo Tipificación), los
  porcentajes de las porciones pequeñas quedaban uno encima del otro y no
  se podían leer. Ahora las porciones de menos del 5 % no llevan el número
  encima, y si dos números chocan se muestra solo uno.
- El dato de cada porción sigue en la leyenda, al pasar el mouse y en la
  tabla ("Ver datos"). Los números no cambian.

## v1.64.8 — Octubre 2026

**Fase 164: gráficas por especialidad en un solo color.**

- "Agendas por especialidad" e "Inasistencia por especialidad" pintaban
  cada barra de un color distinto, y dos especialidades podían salir del
  mismo color. Como cada barra es la misma medida, ahora todas van del
  mismo color y sin leyenda, igual que "Calidad por asesor".
- En las tortas de los tableros internos (Gerencia, Inventario, Gestión
  Humana), dos categorías distintas ya no pueden salir del mismo color.
- Los números no cambian: solo cambia cómo se ven.

## v1.64.7 — Octubre 2026

- Actualización de seguridad de una dependencia. No cambia nada de lo que
  se ve ni ningún número.

## v1.64.6 — Octubre 2026

**Fase 164: botones más fáciles de tocar en el celular.**

- En el celular varios botones y campos eran muy pequeños para el dedo
  (los de Excel/PDF de los paneles, los buscadores, los botones de las
  páginas de administración, Editar y Eliminar en las tablas, el ojo de
  la contraseña). Ahora todos tienen un tamaño cómodo, y Editar y
  Eliminar quedan separados para no tocar uno por otro.
- En el computador no cambia nada. Los números no cambian.

## v1.64.5 — Octubre 2026

**Fase 164: títulos de las gráficas en orden para los lectores de pantalla.**

- Los títulos de cada gráfica quedaban dos niveles por debajo del título
  del tablero, y eso confunde a quien navega con un lector de pantalla.
  Ahora siguen el orden correcto.
- No cambia nada de lo que se ve ni ningún número.

## v1.64.4 — Octubre 2026

**Fase 164: tablas que se recorren con el teclado.**

- Las tablas anchas del tablero (y la vista previa del Centro de cargas)
  tienen su propia barra para moverse de lado. Antes no se podían
  alcanzar con la tecla Tab, así que quien usa solo el teclado no veía
  las columnas de la derecha. Ahora sí: con Tab se llega a la tabla y con
  las flechas se mueve. Los lectores de pantalla dicen el nombre de la
  tabla.
- Los números no cambian. Solo se ve el borde de foco cuando se llega
  a la tabla con Tab.

## v1.64.3 — Octubre 2026

**Fase 164: en Calidad se ven todos los asesores.**

- La gráfica "Promedio de calidad por asesor" escondía la mitad de los
  nombres cuando había muchos asesores, y cada barra tenía un color
  distinto. Ahora se ven todos los nombres, la gráfica crece según cuántos
  asesores haya y todas las barras van del mismo color.
- Los números no cambian: solo cambia cómo se ven.

## v1.64.2 — Octubre 2026

**Fase 164: Tipificación más fácil de leer.**

- En la torta de Tipificación, dos tipificaciones distintas podían salir
  del mismo color. Ahora cada una tiene su propio color (las que no
  chocaban conservan el de siempre).
- La tabla de Tipificación muestra el porcentaje con coma, como el resto
  de la plataforma: "24,92 %" en vez de "24.92%".
- Los números no cambian: solo cambia cómo se ven.

## v1.64.1 — Octubre 2026

**Fase 164: arreglos del tablero en el celular.**

- En el celular, el botón "X Cerrar" del tablero se salía de la pantalla.
  Ahora queda siempre visible arriba a la derecha.
- El logo de InConexion de la barra de arriba ya no se ve aplastado en
  celular y tableta.
- Los números no cambian: solo cambia cómo se ve.

## v1.64.0 — Octubre 2026

**Fase 163: cada gráfica en su cuadro y un color por sección.**

- Cada gráfica va en su propio cuadro, con su título arriba, para que se
  distinga una de otra.
- Cada sección tiene su color: Llamadas en azul, WhatsApp en turquesa y
  Salida en morado. Se ve en la franja de arriba de la tarjeta, en el
  borde de cada gráfica y en un punto junto al nombre de la pestaña.
  Funciona en modo claro y oscuro, y se lee bien en los dos.
- En Tráfico de WhatsApp, "ASA y ATA" ahora son dos gráficas (ASA arriba,
  ATA abajo), igual que en Llamadas.
- Los números no cambian: solo cambia cómo se ven.

## v1.63.0 — Octubre 2026

**Fase 163: el nivel de servicio se calcula como lo pide Edwin.**

- Son dos indicadores distintos. El nivel de atención (contestadas ÷
  ingresadas) sigue igual.
- El nivel de servicio ahora es el promedio simple de la columna
  SERVICE_LEVEL_20SEC del reporte de Wolkvox, de las filas (skill y día) que
  entran en el filtro. Por día se ve el valor del reporte; en el mes, el
  promedio de esas filas. Las filas sin dato no cuentan; las de 0 % sí.
- Antes se ponderaba por llamadas. Por eso en agosto de Mobilize daba igual
  al nivel de atención (95,5 %); ahora da 88,24 %. En ORLANT agosto, la
  línea 3P pasa de 87,7 % a 85,19 %.
- Cambia en la tarjeta del mes y en las gráficas por mes, por día y por
  skill, en todos los clientes. WhatsApp no cambia.
- La ayuda (?) de la gráfica y de la tarjeta de nivel de servicio ahora
  explica que es el promedio simple, ya no "ponderado por llamadas".

## v1.62.0 — Octubre 2026

**Fase 163: Llamadas Únicas de ingreso distingue contestadas y abandonadas.**

- El asesor ya no es obligatorio. Las abandonadas (del reporte "Skill y
  servicios, numeral 2") no traen asesor: ahora se cargan con el asesor
  vacío y cuentan como abandonadas. Antes esas filas se omitían; por eso
  el total era igual a las contestadas y las abandonadas daban 0.
- Contestadas y abandonadas únicas se cuentan por separado: un mismo
  teléfono, una vez por día en cada tipo.
- La vista previa dice cuántas contestadas y cuántas abandonadas trae el
  archivo antes de guardar.
- Si en el período no hay abandonadas (como en lo cargado antes de esta
  versión), el tablero muestra una sola tarjeta y una sola barra,
  "Llamadas únicas de ingreso", en vez de tres con el mismo número.

## v1.61.0 — Octubre 2026

**Fase 163: Llamadas de Salida con la plantilla nueva de Edwin.**

- La carga "De salida" reconoce la plantilla de Edwin: AGENT_NAME, DATE,
  TELEPHONE, DESCRIPTION_COD_ACT y TIPO. TIPO es obligatorio y dice si la
  llamada fue "Conectada" o "No conectada"; de ahí sale la separación del
  tablero.
- DATE puede traer la hora: se toma el día en hora de Colombia, nunca el
  día anterior.
- El código de actividad "-" queda como "Sin tipificación".
- La plantilla descargable trae esos 5 encabezados y una hoja de
  instrucciones que dice de qué reporte de Wolkvox sale cada tipo.
- La plantilla anterior (con SKILL_ID) se sigue aceptando.
- Los números ya cargados no cambian.

## v1.60.0 — Octubre 2026

**Fase 163: el nombre de la skill que se sube es el que se refleja.**

- Al subir Flujo de Llamadas desde el Centro de cargas de un cliente, todas
  las filas son de ese cliente. Si trae una skill que el cliente todavía no
  tiene (por ejemplo LINEA ENTRADA o PROGRAMAS ESPECIALES de Hospital La
  María), se registra sola para ese cliente. La vista previa lo avisa antes
  de guardar: "Skills nuevas que se registran para ...".
- Cada cliente tiene sus propias skills: si dos clientes tienen una skill
  con el mismo nombre, sus números nunca se mezclan.
- Los tiempos con separador de miles se leen bien en los dos formatos:
  "1,871.35" y "1.871,35" son 1.871,35 segundos.
- La pantalla de Tráfico de varios clientes funciona igual que antes.
- Los números ya cargados no cambian.

## v1.59.5 — Octubre 2026

**Fase 162: la memoria que usa la plataforma para abrir rápido tiene un límite.**

- Lo que la plataforma recuerda para abrir las pestañas al instante ahora
  tiene un tope de memoria (64 MB). Si se llena, olvida lo más antiguo
  primero, así el servidor nunca se queda sin memoria.
- Los números de los dashboards no cambian.

## v1.59.4 — Octubre 2026

**Fase 161: las pestañas que ya abriste vuelven a abrir al instante.**

- La plataforma recuerda los resúmenes y detalles que cada persona ya
  consultó, y los vuelve a calcular solo cuando cambian datos (cargar,
  eliminar, deshacer). Cada usuario recibe exactamente lo mismo que antes,
  según su rol y sus permisos.
- Los números de los dashboards no cambian.

## v1.59.3 — Octubre 2026

**Fase 161: gráficas que abren más rápido.**

- Agendas por línea, Llamadas de salida, Llamadas únicas, Tipificación y
  "Última actualización" consultan la base de forma más directa (índices
  nuevos). Con 12 meses de datos, las más lentas pasan de más de 1 segundo
  a unas décimas.
- Los números de los dashboards no cambian.

## v1.59.2 — Octubre 2026

**Fase 161: los filtros siguen rápidos aunque mucha gente entre a la vez.**

- La plataforma recuerda las listas de los filtros (meses, asesores,
  skills...) y ahora solo las vuelve a calcular cuando cambian datos
  (cargar, eliminar, deshacer). Antes también las recalculaba cada vez que
  alguien iniciaba sesión.
- Los números de los dashboards no cambian.

## v1.59.1 — Octubre 2026

**Fase 158: dashboards más rápidos.**

- Los filtros de cada pestaña (meses, asesores, skills, sedes...) ahora
  abren más rápido: la plataforma recuerda esas listas y solo las vuelve a
  calcular cuando se carga, se elimina o se deshace algo. Los números de los
  dashboards no cambian.

## v1.59.0 — Octubre 2026

**Fase 160: Hospital La María, listo para su primera carga.**

- Se crea el cliente "HOSPITAL LA MARIA" (uno solo), igual que Clínica
  Aurora: Tráfico de Llamadas, Tráfico de WhatsApp y Calidad, todas ocultas
  y sin datos. Cada pestaña aparece sola cuando se cargan sus datos.
- Por ahora solo lo ve el administrador; los permisos se dan aparte. No se
  crearon usuarios. Las sedes (Sede 33 / Castilla) quedan por definir.
- ORLANT, MOBILIZE y Clínica Aurora no cambian.

## v1.58.2 — Octubre 2026

**Fase 160: Clínica Aurora ya puede cargar Flujo de WhatsApp.**

- Al cargar la plantilla de Flujo de WhatsApp para Clínica Aurora salía
  "No se encontró la hoja DATA" y la carga no entraba. Ahora Aurora (y
  todo cliente con Flujo de WhatsApp) usa la misma plantilla que ORLANT.
- Después de cargar, sus pestañas de Tráfico de Llamadas y de WhatsApp
  aparecen solas, con todas sus gráficas.
- ORLANT y Mobilize no cambian. Los números de los dashboards no cambian.

## v1.58.1 — Octubre 2026

**Fase 160: ejemplos correctos en la plantilla de Flujo de WhatsApp.**

- Los porcentajes de ejemplo ahora van como "40.00 %" y el AHT como hora
  de Excel (0:06:40). Antes, quien seguía el ejemplo (AHT 400) veía la
  carga rechazada, porque 400 se lee como 400 días.
- ASA y ATA siguen en segundos. Los números de los dashboards no cambian.

## v1.58.0 — Octubre 2026

**Fase 160: ASA y ATA en dos gráficas.**

- En Flujo de Llamadas (Mobilize y ORLANT), la sub-pestaña "ASA y ATA"
  muestra dos gráficas, una debajo de la otra: ASA (tiempo promedio de
  respuesta) arriba y ATA (tiempo promedio de abandono) abajo.
- Mismos datos y mismo estilo de antes; cada gráfica tiene su "Ver datos".
- WhatsApp no cambia. Los números de los dashboards no cambian.

## v1.57.8 — Octubre 2026

**Fase 159: pantalla de subida más clara (pedidos de Edwin).**

- El cliente elegido se ve resaltado con color.
- Si entras desde el Centro de cargas, el cliente y el mes quedan fijos: no
  se pueden cambiar en esa pantalla. Para otro mes o cliente, vuelve al Centro.
- Se quitó el botón "Pantalla anterior" del Centro de cargas, porque no
  funcionaba.
- Los números de los dashboards no cambian.

## v1.57.7 — Octubre 2026

**Fase 159: la plantilla de Flujo de Llamadas es igual al reporte de Wolkvox.**

- La hoja de datos de la plantilla trae exactamente los encabezados del
  reporte de la cola que se descarga de Wolkvox, en el mismo orden:
  SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS,
  SERVICE_LEVEL_10SEC, SERVICE_LEVEL_20SEC, SERVICE_LEVEL_30SEC, ABANDON,
  ASA, ATA, WAIT_TIME y AHT.
- La ficha y las instrucciones de la plantilla dicen lo mismo. Los nombres
  de las plantillas anteriores se siguen aceptando.
- Los números de los dashboards no cambian.

## v1.57.6 — Octubre 2026

**Fase 159: Flujo de Llamadas acepta el reporte de Wolkvox tal cual.**

- El reporte de la cola que se descarga de Wolkvox (hoja "HistQueue…", con
  las columnas INBOUND_CALLS, ANSWER_CALLS y ABANDON_CALLS) ahora se reconoce
  sin renombrar la hoja ni cambiar encabezados. Antes salía "No se encontró
  la hoja DATA". Vale igual para ORLANT, que usa el mismo reporte.
- Si a un archivo le faltan columnas, el aviso dice cuáles faltan y qué
  encabezados trae, en vez de hablar de la hoja DATA.
- Antes de guardar, la vista previa muestra las fechas, los skills y las
  llamadas ingresadas, contestadas y abandonadas, y avisa si el archivo no
  trae el mes completo (los días que no vienen no se rellenan con cero).
- Al subir desde el Centro de cargas, el cliente queda fijo durante la carga.
- Los números de los dashboards no cambian.

## v1.57.5 — Octubre 2026

**Fase 156: aviso de la carga de Flujo de Llamadas.**

- Al confirmar una carga de Flujo de Llamadas que trae solo algunos días de
  un mes ya cargado, el aviso ahora dice cuántos registros se reemplazan de
  verdad (los días que trae el archivo). Antes contaba el mes completo y
  exageraba. Lo que se guarda y los números de los tableros no cambian.

## v1.57.4 — Octubre 2026

**Fase 156: arreglos para la carga de agosto.**

- Flujo de Llamadas: las columnas WAIT_TIME y AHT ahora se aceptan en los
  tres formatos (hora de Excel como trae Wolkvox, segundos o texto como
  0:03:35). Antes, si venían en segundos, la carga completa se rechazaba con
  un mensaje en inglés. Los archivos de Wolkvox de siempre se leen igual.
- Si un tiempo viene fuera de rango, el aviso ahora sale en español y dice
  qué columna revisar.

## v1.57.3 — Octubre 2026

**Fase 157: revisión de seguridad.**

- Ajustes internos en el Deshacer del Centro de cargas y en los registros
  de errores del servidor. Para quien usa la plataforma no cambia nada.

## v1.57.2 — Octubre 2026

**Fase 157: revisión de seguridad.**

- Ajuste interno: una sesión ya cerrada se rechaza antes de procesar el
  archivo que se esté subiendo. Para quien usa la plataforma no cambia nada.

## v1.57.1 — Octubre 2026

**Fase 157: revisión de seguridad.**

- Ajuste interno de la protección que reparte el turno entre varias cargas
  de datos al mismo tiempo. Para quien usa la plataforma no cambia nada.

## v1.57.0 — Octubre 2026

**Fase 155: ajustes de la reunión con Edwin (19 de octubre).**

- Flujo de Llamadas: el **nivel de atención** (contestadas ÷ ingresadas) y la
  **tasa de abandono** (abandonadas ÷ ingresadas) ahora los calcula siempre la
  plataforma, por día y por mes. Ya no hace falta calcularlos a mano en el
  Excel: se sube el reporte de Wolkvox tal cual. Si el archivo trae esas
  columnas, la plataforma no las usa.
- Si el archivo no trae las llamadas abandonadas, se toman como ingresadas
  menos contestadas. Un día sin llamadas ingresadas queda "sin dato" (nunca
  100 % ni 0 %).
- La tarjeta "Nivel de atención" ya no muestra "Meta 90 %" ni color de
  semáforo: ese indicador no se mide contra una meta. Aplica a todos los
  clientes.

## v1.56.0 — Octubre 2026

**Fase 155: ajustes de la reunión con Edwin (19 de octubre).**

- Centro de cargas: cuando un módulo lleva dos archivos, ahora se ven los
  dos juntos arriba, como dos botones: "Únicas de ingreso" y "De salida" en
  Llamadas Únicas y de Salida, y "Llamadas" y "WhatsApp" en Tipificación.
  Cada botón muestra sus meses, su Subir/Reemplazar y su Descargar
  plantilla. Antes el segundo archivo solo se veía bajando.
- Las plantillas de esos módulos dicen en la hoja de instrucciones qué
  archivo va en cada carga y de qué reporte de Wolkvox sale cada uno.

## v1.55.0 — Octubre 2026

**Fase 155: ajustes de la reunión con Edwin (19 de octubre).**

- Dentro de cada tablero hay un botón nuevo, al lado de "Exportar", para
  cambiar entre modo claro y modo oscuro (ícono de luna o de sol). Lo puede
  usar cualquiera que vea el tablero, también el cliente, sin salir de él.

## v1.54.5 — Octubre 2026

**Fase 155: ajustes de la reunión con Edwin (19 de octubre).**

- La plantilla de Flujo de Llamadas que se descarga en el Centro de cargas
  ahora tiene exactamente las mismas columnas, en el mismo orden, que el
  reporte de Wolkvox (se agregó la columna ABANDON que faltaba). Así se
  puede pegar el reporte sin modificar nada. Aplica a Mobilize, ORLANT y
  los clientes nuevos.
- La hoja de instrucciones de la plantilla aclara que el nivel de atención
  y la tasa de abandono los calcula el sistema y no hace falta llenarlos.

## v1.54.4 — Octubre 2026

**Fase 154: revisión de seguridad.**

- Revisión automática nueva: si algún día una parte de la plataforma
  quedara accesible sin iniciar sesión, las pruebas lo detectan antes de
  publicar. Para quien usa la plataforma no cambia nada.

## v1.54.3 — Octubre 2026

**Fase 154: revisión de seguridad.**

- Si muchas personas suben archivos al mismo tiempo, la plataforma los
  procesa por turnos para no ponerse lenta. Quien sube ve el aviso "Hay
  otras cargas en curso. Tu carga espera su turno y sigue sola en unos
  segundos": no hay que volver a subir nada.
- Cada persona sube un archivo a la vez; si se abre una segunda carga,
  espera a que termine la primera.
- Si una subida se queda a medias (por ejemplo, se cae el internet), la
  plataforma la cancela al minuto y avisa para intentar de nuevo.

## v1.54.2 — Octubre 2026

**Fase 154: revisión de seguridad.**

- Cada persona recibe solo la lista de los clientes a los que tiene
  acceso. Antes la lista completa llegaba a todos, aunque la pantalla solo
  mostrara los propios. Los administradores y quien gestiona usuarios
  siguen viendo todos.
- En la pantalla de carga, el selector de cliente ya no ofrece clientes que
  la persona no puede cargar.

## v1.54.1 — Octubre 2026

**Fase 154: revisión de seguridad.**

- Arreglo de seguridad interno: el servidor ya no gasta trabajo en
  peticiones de quien no ha iniciado sesión. Para quien usa la plataforma
  no cambia nada.

## v1.54.0 — Octubre 2026

**Fase 153: Centro de cargas — permisos de carga por módulo para Calidad.**

- En **Usuarios**, al editar a alguien de **Calidad**, hay una lista nueva:
  "Puede cargar en el Centro de cargas (por módulo)", con una casilla por
  módulo (Flujo de Llamadas, Tipificación, Encuesta…). **Todas vienen
  apagadas**: nadie gana nada hasta que se le marque.
- Con un módulo marcado, esa persona ve "Cargar Datos" y el Centro de cargas
  **solo con ese módulo**, y solo en los clientes que ya tiene asignados en
  "Acceso a campañas de Calidad". Puede subir, reemplazar, eliminar y
  deshacer en ese módulo; en los demás, no.
- No ve la "Pantalla anterior" ni la lista de Gestión de base: esas siguen
  siendo de quien tiene "Puede cargar datos operativos".
- En Flujo de Llamadas no puede subir skills sin asignar a un cliente: esas
  las asigna quien tiene "Puede cargar datos operativos".
- Reportes y los administradores siguen igual: cargan todo.

## v1.53.0 — Octubre 2026

**Fase 153: Centro de cargas — Subir y Reemplazar desde el mes, ahora
también en los módulos de ORLANT.**

- Flujo de Llamadas y de WhatsApp, WhatsApp por rangos de tiempo, Agendas,
  Salida, Efectividad de Agendamiento, Inasistencia, Efectividad de Citas y
  Tipificación: **Subir** o **Reemplazar** en un mes abre la carga solo con
  ese módulo, y del archivo **solo se cargan las filas de ese mes**, igual
  que en Mobilize.
- Los módulos que se guardan **por mes** (Salida, Efectividad de
  Agendamiento, Inasistencia, Efectividad de Citas) lo dicen en la vista
  previa: "se reemplaza agosto completo".
- En **Agendas** el aviso dice el tramo exacto que se reemplaza, con hora:
  "del 5 de agosto a las 10:00 al 7 de agosto a las 12:00".
- En Salida, si se corrige el año y las filas quedan en otro mes, la carga
  se cancela con un aviso (desde el Centro nunca se toca otro mes).
- En la vista previa de la pantalla de carga, Efectividad de Citas,
  Efectividad de Agendamiento y Salida ya no aparecen como "Trafico de
  Llamadas".

## v1.52.0 — Octubre 2026

**Centro de cargas: aviso claro cuando el archivo no trae el mes completo.**

- Al subir o reemplazar un mes desde el Centro, la vista previa dice qué
  días trae el archivo y cuántos registros del mes quedan igual, por
  ejemplo: "El archivo trae del 5 al 7 de agosto. Se reemplazan esos días;
  el resto de agosto (140 registros) queda igual."
- No cambia cómo se guarda: como siempre, solo se reemplazan los días que
  trae el archivo.

## v1.51.0 — Octubre 2026

**Fase 153: Centro de cargas — Subir y Reemplazar desde el mes (cuarta
parte, módulos de Mobilize).**

- En Flujo de Llamadas, Tipificación (llamadas y WhatsApp), Llamadas Únicas,
  Llamadas de Salida y Encuesta, **Subir** o **Reemplazar** en un mes abre la
  pantalla de carga solo con ese módulo, y del archivo **solo se cargan las
  filas de ese mes**. La vista previa dice cuántas filas de otros meses se
  ignoraron ("se ignoraron 2 fila(s) de otros meses (septiembre 2)"), así que
  un reemplazo nunca toca otro mes.
- En Flujo de Llamadas también se ignoran las skills de otro cliente o sin
  asignar, y se avisa cuántas.
- La lectura del archivo, la vista previa, la confirmación antes de
  reemplazar y la base guardada 30 días (Deshacer) son las de siempre.
- Los demás módulos (los de ORLANT) siguen abriendo la pantalla completa.

## v1.50.0 — Octubre 2026

**Fase 153: Centro de cargas — Eliminar un mes (tercera parte).**

- Cada mes cargado tiene ahora un botón **Eliminar** (el bote de basura).
  Antes de borrar, un aviso dice cuántos registros se eliminan, de qué
  módulo, mes y cliente, y que los demás meses no se tocan.
- La base eliminada **se guarda 30 días**. Justo después sale un aviso con
  **Deshacer**, y también queda en "Versiones guardadas".
- Cada eliminación queda en el Historial: quién, qué módulo, qué mes y
  cuántos registros.
- Calidad no se elimina desde aquí (tiene su propia pantalla).

## v1.49.1 — Octubre 2026

**Arreglo de Deshacer en Flujo de Llamadas.**

- Al deshacer un mes de Flujo de Llamadas, el total mensual de Nivel de
  Servicio ahora también vuelve a como estaba (antes solo volvían los días y
  el total del mes se quedaba con el del archivo reemplazado).

## v1.49.0 — Octubre 2026

**Fase 153: Centro de cargas — Deshacer (segunda parte).**

- Cada vez que se reemplaza la base de un mes (desde el Centro o desde la
  pantalla anterior), la plataforma **guarda la base de antes durante 30
  días**.
- En cada módulo del Centro aparece **"Versiones guardadas"** cuando hay
  alguna: dice de qué mes es, cuántos registros tenía, de qué archivo venía
  y hasta cuándo se guarda.
- **Deshacer** devuelve ese mes exactamente a como estaba, con un aviso
  antes de hacerlo. Lo que había en ese momento también se guarda 30 días,
  así que deshacer también se puede deshacer. Queda en el Historial.
- Se guardan hasta 5 versiones por módulo y mes; las de más de 30 días se
  borran solas.
- Eliminar un mes llega en la próxima versión.

## v1.48.0 — Octubre 2026

**Fase 153: Centro de cargas (primera parte).**

- "Cargar Datos" abre ahora el **Centro de cargas**: eliges el cliente, ves una
  tarjeta por módulo y, al abrirla, los 12 meses del año. Cada mes dice si ya
  tiene su base, cuántos registros, cuándo y quién la cargó, y con qué
  archivo.
- En cada mes cargado, **Descargar** baja un Excel con lo que hay guardado.
  Arriba de cada módulo, **Descargar plantilla** baja la plantilla oficial de
  ese módulo.
- **Subir** y **Reemplazar** abren por ahora la pantalla de carga de siempre,
  ya con el cliente elegido, con la misma vista previa antes de guardar. Al
  cerrarla vuelves al Centro con los números actualizados.
- En cada tablero, quien puede cargar ve el botón **"Actualizar datos"** junto
  a Exportar: abre el Centro en ese cliente y ese módulo. Los clientes no lo
  ven.
- La pantalla anterior sigue disponible con el botón "Pantalla anterior".
- Eliminar un mes y Deshacer (guardar la base anterior 30 días) llegan en la
  próxima versión.

## v1.47.5 — Octubre 2026

**Fase 153: Clínica Aurora, lista para empezar a cargar.**

- Se crea el cliente Clínica Aurora con Flujo de Llamadas y Flujo de
  WhatsApp (iguales a los de ORLANT) y Calidad.
- Todas sus pestañas empiezan ocultas y sin datos. Por ahora solo la ve el
  administrador; nadie más la ve hasta que se le den permisos.
- Mientras no tenga datos, su tablero dice "Este dashboard todavía no tiene
  datos" en vez de quedar en blanco. Flujo de Llamadas y Flujo de WhatsApp
  aparecen solos cuando se carguen sus datos.
- Calidad queda pendiente del modelo de evaluación de Aurora.
- ORLANT y MOBILIZE no cambian.

## v1.47.4 — Octubre 2026

**Fase 153 (paso 3): la plantilla de cliente ya sabe armar un dashboard.**

- Por dentro, la plataforma tiene un catálogo de módulos (Flujo de
  Llamadas, WhatsApp, Tipificación, Calidad, Agendas, Encuesta…) y puede
  armar el dashboard de un cliente a partir de los módulos que lleve.
- Probado: con esa plantilla, los dashboards de ORLANT y MOBILIZE salen
  exactamente iguales a los de hoy. Todavía no se crea ningún cliente nuevo.
- No cambia nada de lo que se ve ni de los números.

## v1.47.3 — Octubre 2026

**Fase 153 (paso 2): qué carga y qué pantalla tiene cada cliente sale de su ficha.**

- Por dentro, las hojas que pide Cargar Datos, si el cliente ve los nombres
  de los asesores, la vista de WhatsApp por rangos y el logo de cada
  dashboard ya no están escritos en el código para ORLANT y MOBILIZE: salen
  de la ficha de cada cliente en la base.
- No cambia nada de lo que se ve ni de los números.

## v1.47.2 — Octubre 2026

**Fase 153 (paso 1): la lista de clientes vive en la base de datos.**

- Por dentro, la lista de clientes (ORLANT y MOBILIZE) ya no está escrita
  en el código: se guarda en la base. Es el primer paso para poder dar de
  alta un cliente nuevo sin cambiar el programa.
- No cambia nada de lo que se ve ni de los números.

## v1.47.1 — Octubre 2026

**Fase 152 (cierre): porcentajes con coma en todas las pantallas.**

- Gerencia, Metas y la vista previa al cargar Tráfico también escriben los
  porcentajes con coma ("12,35 %").

## v1.47.0 — Octubre 2026

**Fase 152: iconos nuevos.**

- El menú y los botones (mostrar contraseña, buscar, tema claro u oscuro,
  menú, usuario, pantalla completa, descargar, restablecer, volver y
  alertas) usan iconos de línea en lugar de emojis. Se ven iguales en
  cualquier equipo y toman el color del tema.
- "Usuarios" y "Gestión Humana" ya no comparten el mismo icono.

## v1.46.0 — Octubre 2026

**Fase 152: mejor en celular y tableta.**

- En el celular, los filtros de cada panel se guardan detrás de un botón
  "Filtros (N)"; se abren, se aplican y se vuelven a guardar solos.
- En pantallas pequeñas, la explicación de colores de cada gráfica va
  debajo y los nombres del eje se inclinan para que no se monten.
- Las tablas anchas se mueven de lado por su cuenta, con la primera
  columna fija, sin que se mueva toda la página.
- Botones más fáciles de tocar en el celular.
- Los porcentajes de las gráficas se escriben con coma ("95,1 %").

## v1.45.0 — Octubre 2026

**Fase 152: "Ver datos" en cada gráfica.**

- Debajo de cada gráfica hay un botón "Ver datos" que muestra en una tabla
  los mismos números de la gráfica, para leer la cifra exacta. También
  sirve con teclado y con lector de pantalla.
- Al pasar el mouse por un porcentaje se ve de dónde sale. Por ejemplo,
  Nivel de atención "95,1 % (4.325 de 4.547)", o en las tortas "30 de 191".

## v1.44.0 — Octubre 2026

**Fase 152: colores de las gráficas y líneas de meta.**

- El verde, el amarillo y el rojo quedan solo para lo que se compara contra
  una meta. Las demás series usan los colores de la marca: azul petróleo,
  azul (solo en barras) y morado para las líneas de porcentaje y tiempo.
- Las gráficas de Nivel de atención, Tasa de abandono y Nivel de servicio
  muestran una línea punteada con su meta ("Meta 90 %"), tomada de la
  pantalla Umbrales.
- Las tarjetas sin meta (por ejemplo, llamadas contestadas o abandonadas)
  ya no se pintan de verde o rojo.
- Agendas por especialidad se ordena de mayor a menor.

## v1.43.0 — Octubre 2026

**Fase 152: tarjetas de indicadores más claras.**

- Las cifras de las tarjetas se ven más grandes y los nombres ya no van en
  mayúsculas.
- Si se mira un mes completo, cada tarjeta dice cuánto subió o bajó frente
  al mes anterior. Si el mes anterior no tiene datos, no se muestra nada.
- Los indicadores con meta (por ejemplo, nivel de atención o nivel de
  servicio) muestran la meta y si se cumple, con un punto de color y en
  palabras. Las metas salen de la pantalla Umbrales.
- El mes que todavía no termina se marca como parcial ("Octubre 2026 —
  parcial, hasta el día 15") y no se compara con el mes anterior.

## v1.42.3 — Octubre 2026

**Fase 151: el teléfono de los monitoreos, solo para el equipo interno.**

- El teléfono que se anota en un monitoreo de Calidad solo lo reciben
  Calidad, Supervisor, Reportes y el administrador. Los usuarios de
  cliente y de Gerencia ven los mismos monitoreos, sin ese dato. Cada
  asesor lo sigue viendo en sus propios monitoreos.

## v1.42.2 — Octubre 2026

**Fase 151: prueba de los respaldos.**

- La revisión automática de respaldos ahora comprueba que la copia más
  reciente guardada en el servidor se puede abrir y está completa.

## v1.42.1 — Octubre 2026

**Fase 151: ajustes menores de seguridad.**

- Los cambios de umbrales del semáforo ahora quedan en el Historial.
- Direcciones que no existen en la plataforma responden "No encontrado".
- Ajustes internos de seguridad en filtros, registros del servidor y
  cuentas de ejemplo. Nada cambia en el uso diario.

## v1.42.0 — Octubre 2026

**Fase 151: más seguridad en usuarios, sesiones y cargas.**

- **Contraseña nueva al primer ingreso:** cuando el administrador crea una
  cuenta o le pone una contraseña nueva a alguien, esa persona debe elegir
  su propia contraseña la primera vez que entra. Las cuentas que ya existen
  no cambian.
- **Cerrar sesión** ahora deja esa sesión inservible al instante (las
  sesiones abiertas en otros equipos siguen igual).
- Los permisos de gestión de usuarios (crear, editar, suspender, eliminar,
  cambiar contraseñas y permisos) solo los da o quita el administrador.
  Nadie puede suspenderse ni eliminarse a sí mismo.
- Cada persona ve en la plataforma solo los usuarios que necesita para su
  trabajo.
- La carga de Tráfico de Llamadas respeta las campañas de cada usuario,
  igual que las demás cargas.

## v1.41.3 — Octubre 2026

**Fase 151: mejora de seguridad en la gestión de usuarios.**

- Editar a un usuario Administrador o Auxiliar administrativo queda
  reservado al administrador.
- Si se cambia la contraseña de alguien desde "Editar usuario", sus
  sesiones abiertas se cierran y debe volver a entrar con la nueva.

## v1.41.2 — Octubre 2026

**Fase 150: ajustes pendientes de la revisión anterior.**

- **"Última actualización"** ahora también cuenta las cargas de Encuesta,
  Llamadas Únicas, Llamadas de Salida y Tiempos de WhatsApp. En Mobilize ya
  muestra la carga más reciente (la Encuesta del 15/10), no la del 08/10.
  En ORLANT la fecha no cambia mientras no haya cargas más nuevas.
- **One & Done**: la gráfica muestra los meses en letras ("Septiembre
  2026"). Si falla la conexión, ahora dice que no se pudo cargar, en vez de
  "Sin encuestas". Al exportar con One & Done abierta, la tabla se llama
  "One & Done" y no "Tráfico de Llamadas".
- La carga de **Llamadas Únicas** y de **Tiempos de WhatsApp** acepta
  archivos de hasta 8 MB, el mismo límite que ya avisaba la pantalla.
- El Excel de **Tiempos de WhatsApp** avisa con un error si no se puede
  preparar de forma segura, en vez de descargar un archivo sin protección.

## v1.41.1 — Octubre 2026

**Fase 149: arreglos de la revisión de seguridad y un detalle visual.**

- En **Llamadas Únicas** de un cliente distinto de Mobilize, el usuario
  del cliente ya no recibe la lista de nombres de asesor, ni siquiera por
  detrás de la pantalla. Es la misma regla que ya tenían Llamadas de
  Salida y Encuesta. En Mobilize nada cambia: el cliente sigue viendo y
  filtrando por asesor.
- La carga de la **Encuesta** acepta archivos de hasta 8 MB, el mismo
  límite que ya avisaba la pantalla. Antes un archivo de entre 2 y 8 MB
  pasaba el aviso y después fallaba.
- Si el Excel de la Encuesta no se puede preparar de forma segura, ahora
  avisa con un error en vez de descargar un archivo sin protección.
- En los tableros, la barra de pestañas principales (Flujo de Llamadas ·
  Llamadas Únicas y de Salida · Tipificación · Encuesta · Calidad) ya no se
  esconde debajo del encabezado al bajar: queda fija justo debajo, en
  computador y tableta. En el celular se ve igual que antes.
- Recordatorio en la guía: al cargar la Encuesta, **suba siempre el mes
  completo**. Los días del rango que no vengan en el archivo se borran.

## v1.41.0 — Octubre 2026

**Fase 147 (parte D): sub-pestaña "One & Done" en Mobilize.**

- En **Flujo de Llamadas** hay una sub-pestaña nueva, la última: "One &
  Done". Muestra en una gráfica de barras, mes por mes, el porcentaje de
  encuestas en las que el usuario dijo que su solicitud se resolvió en el
  primer contacto (pregunta 3 = Sí).
- Arriba hay una tarjeta con el mes en letras, por ejemplo "Septiembre
  2026: 6,7 % (3 de 45 encuestas)". Al pasar el mouse por una barra se ve
  esa misma cuenta.
- Debajo aparece cuántas encuestas dijeron Sí, No o no respondieron la
  pregunta 3, para que se entienda por qué el porcentaje puede ser bajo.
- Es el mismo número de la tarjeta FCR, que sigue igual. Las otras cinco
  sub-pestañas y la pestaña Encuesta tampoco cambian.

## v1.40.1 — Octubre 2026

**Mejora interna: publicar cambios con menos fallas.**

- A veces la publicación de una versión nueva fallaba porque el servicio
  que entrega las piezas base de la plataforma limitaba las descargas.
  Ahora la plataforma queda lista para usar una cuenta propia en ese
  servicio y evitar ese límite. Mientras esa cuenta no se configure, todo
  sigue funcionando igual que antes.
- No cambia nada de lo que se ve en los tableros.

## v1.40.0 — Octubre 2026

**Fase 147 (parte C): solución en primer contacto (FCR) en Mobilize.**

- En **Flujo de Llamadas** hay una tarjeta nueva, "Solución en primer
  contacto (FCR)": de las encuestas del mes, cuántas dijeron que su
  solicitud se resolvió en la primera llamada (pregunta 3 = Sí).
- La tarjeta siempre muestra la cuenta, por ejemplo "3 de 45 encuestas",
  para que se entienda de dónde sale el porcentaje. Si el mes no tiene
  encuestas, dice "Sin encuestas este mes".
- Por ahora se calcula sobre todas las encuestas del mes, como pidió Edwin.
  Si se prefiere contar solo a quienes respondieron la pregunta 3, se
  cambia en la configuración, sin tocar la plataforma.

## v1.39.0 — Octubre 2026

**Fase 147 (parte B): encuesta de satisfacción de Mobilize.**

- Pestaña nueva **Encuesta** en Mobilize (antes de Calidad): una gráfica
  por cada una de las 4 preguntas, con cuántas personas eligieron cada
  respuesta, cuántas respondieron y cuántas no.
- Al final, los **comentarios** que dejaron los usuarios, con fecha, skill
  y asesor.
- Filtros por fecha (Desde/Hasta), skill y asesor, y un botón para ver el
  texto completo de las preguntas.
- Se carga desde **Cargar Datos → Mobilize** con el archivo de Wolkvox tal
  cual (o con la plantilla). Para corregir una base, se vuelve a subir: la
  plataforma reemplaza esas fechas y avisa antes cuántas encuestas cambia.
- Se puede exportar a Excel o PDF.

## v1.38.0 — Octubre 2026

**Fase 147: ajustes de la reunión con Edwin.**

- Los meses se ven con su nombre: "Septiembre 2026" en las gráficas y en
  los avisos, y por día "15 sep". Los archivos de Excel no cambian.
- "Última actualización" ahora se ve en naranja en el encabezado de los
  tableros, para que la fecha resalte.
- En Mobilize, Calidad queda siempre como la última pestaña.
- En "Llamadas Únicas y de Salida", el usuario de Mobilize ahora puede
  filtrar por asesor en las dos mitades y ver el detalle por asesor.
- En la mitad de salida hay un filtro nuevo por Tipo (Conectada / No
  conectada). El archivo de salida no trae el skill, por eso todavía no
  se puede filtrar por skill ahí.

## v1.37.1 — Octubre 2026

**Fase 146: ATA en 0:00 cuando no hubo llamadas abandonadas.**

- En "ASA y ATA" (Flujo de Llamadas de Mobilize y Tráfico de Orlant), si el
  período tiene datos pero ninguna llamada abandonada, el ATA ahora se ve
  como **0:00** (antes "—"): en la tarjeta, en la gráfica y en el Excel.
  Así lo pidió Edwin.
- Si el período no tiene datos, sigue saliendo el aviso de "sin datos".
- Cuando sí hay abandonos, el ATA se calcula igual que siempre. ASA, AHT y
  las demás cifras no cambian.

## v1.37.0 — Octubre 2026

**Fase 146: logo junto a "SInCo" y palabras con tilde.**

- En la pantalla de ingreso, el logo de InConexion ahora va a la izquierda
  de "SInCo", en la misma línea (antes iba encima). A color en tema claro y
  blanco en tema oscuro.
- En la pantalla de bienvenida también aparece el logo blanco a la
  izquierda de "SInCo".
- En el celular, el logo y "SInCo" caben en una sola línea, y nada se mueve
  mientras carga la imagen. El logo pequeño de la esquina sigue igual.
- Los textos de la plataforma ahora llevan tilde: "Cerrar Sesión",
  "Selecciona un módulo", "Gestión de Usuarios", "Campaña", "Último
  ingreso", "Período", "Categoría", entre otros.
- Las plantillas y exportaciones de Excel no cambian sus encabezados.

## v1.36.1 — Octubre 2026

**Fase 146: la guía de uso al día.**

- Las imágenes de la guía ahora muestran la plataforma como se ve hoy: la
  pantalla de ingreso con el logo, "Flujo de Llamadas" y las 8 pestañas de
  Orlant.
- La guía explica el Flujo de Llamadas de Mobilize (ASA y ATA, AHT aparte)
  y usa el nombre nuevo de la pestaña "Llamadas Únicas y de Salida".
- Aclaración sobre ATA en Mobilize: ATA es el tiempo promedio hasta que la
  persona cuelga sin ser atendida. En septiembre no hubo llamadas
  abandonadas, así que no hay promedio y la plataforma muestra "—" (no
  "0:00" como decía la nota de la versión 1.35.0).
- Nada más cambia en la plataforma.

## v1.36.0 — Octubre 2026

**Fase 145: logo de InConexion en la pantalla de ingreso y "Contraseña" con ñ.**

- En la pantalla de ingreso, el logo de InConexion aparece dentro de la
  tarjeta, encima de "SInCo": a color en tema claro y blanco en tema
  oscuro. La tarjeta no se mueve mientras carga el logo. El logo pequeño
  de abajo a la derecha sigue igual.
- "Contrasena" ahora se escribe "Contraseña" en toda la plataforma: ingreso,
  crear usuario, "Cambiar Contraseña", "Cambiar mi Contraseña", "Contraseña
  Actual", "Nueva Contraseña" y "Confirmar Nueva Contraseña".
- Nada más cambia: usuarios, contraseñas y datos siguen igual.

## v1.35.1 — Octubre 2026

**Fase 145: Calidad de Mobilize dice claramente que todavía no hay monitoreos.**

- En la pestaña Calidad de un cliente que todavía no tiene ningún monitoreo
  de calidad (hoy Mobilize), ahora sale "Todavía no hay monitoreos de
  calidad para Mobilize." Antes decía "Sin datos de Calidad para" el mes
  elegido, y parecía que solo faltaba ese mes.
- Cuando Mobilize tenga sus primeros monitoreos, la pestaña se ve igual que
  la de Orlant. Orlant no cambia.

## v1.35.0 — Octubre 2026

**Fase 145: ajustes de Mobilize que pidió Edwin para la entrega.**

- En Mobilize → Flujo de Llamadas, "ASA y AHT" se separó en dos
  sub-pestañas: **"ASA y ATA"** (igual a la que ya tiene Orlant) y
  **"AHT"** aparte. El orden queda: Flujo de Llamadas, Nivel de Servicio,
  Abandono, ASA y ATA, AHT.
- En septiembre, "ASA y ATA" muestra ATA en 0:00 porque la plantilla de
  Flujo de Mobilize trae esa columna en 0 todos los días. La plataforma lo
  muestra tal cual, sin ocultarlo ni inventar otro valor.
- La pestaña "Llamadas Únicas" ahora se llama **"Llamadas Únicas y de
  Salida"**. Los números no cambian.
- El tablero de Mobilize ya no muestra el aviso amarillo de "todavía no
  tiene datos cargados", que salía aunque sí había datos.
- En la torta de Tipificación (Orlant y Mobilize) los porcentajes se leen
  bien en todas las porciones: letra oscura sobre los colores claros y
  blanca sobre los oscuros. Los colores de la torta no cambian.

## v1.34.4 — Octubre 2026

Seis mejoras de la Fase 144 que se publicaron juntas en esta versión.

**Fase 144 (A3b): las demás ventanas también se usan bien con el teclado.**

- Lo que ya se arregló para el tablero, Cargar Datos y Calidad ahora también
  aplica a las ventanas de crear o editar usuario, cambiar contraseña,
  eliminar usuario, Inventario (ítem y movimiento), Gestión Humana, los
  indicadores de Gerencia, el selector de clientes y "Cambiar mi
  contraseña".
- Al abrir una de ellas, la tecla Tab se queda dentro de la ventana, la
  tecla Escape la cierra y el cursor vuelve al botón que la abrió.
- Se ven y funcionan igual con el ratón: clic afuera sigue cerrándolas.

**Fase 144 (A8): tarjetas de indicadores parejas y casillas más fáciles de tocar.**

- En la fila de indicadores de arriba (por ejemplo "Total llamadas",
  "Llamadas contestadas", "Tasa de abandono"), todos los títulos se ven
  ahora con la misma letra. Antes unos salían en negrita y otros no, según
  el color del semáforo. El color del semáforo sigue en la rayita de la
  izquierda de cada tarjeta.
- En Tráfico de Llamadas y de WhatsApp, "Ver skills por separado" y
  "Comparar varias…" tienen un espacio para hacer clic más alto, más
  cómodo en el celular. Se ven igual.
- Ningún número, filtro ni color de semáforo cambia.

**Fase 144 (A7): los lectores de pantalla leen el nombre de cada campo y los avisos.**

- Cada casilla de filtro (Desde, Hasta, Mes, Agente, Sede, Cola, los
  buscadores, Cargar Datos, el inicio de sesión, etc.) quedó unida a su
  título. Para quien usa un lector de pantalla, ahora dice "Desde" o
  "Contraseña" en vez de solo "campo de fecha" o "campo de texto". Y al
  hacer clic en el título, el cursor se pone en la casilla.
- Los avisos que salen abajo a la derecha ("Guardado", "No se pudo…")
  ahora también se leen en voz alta; los de error se anuncian de inmediato.
- Ningún texto, color, número ni filtro cambia: se ve igual que antes.

**Fase 144 (A6): cuando un mes no tiene datos, se ve claro.**

- En Calidad, si el mes elegido arriba todavía no tiene monitoreos, el aviso
  "Sin datos de Calidad para Oct-26… Ver Sep-26" ahora se ve en una sola
  línea a lo ancho (antes quedaba apretado en una esquina, en cinco
  renglones).
- Las gráficas de ese mes ya no quedan en blanco: dicen "Sin monitoreos en
  octubre 2026."
- El botón "Ver Sep-26" sigue llevando al último mes con datos.
- Nada más cambia.

**Fase 144 (A5): textos más legibles.**

- La versión de la plataforma (arriba a la derecha) ahora se lee bien; antes
  casi no se veía sobre la barra azul oscuro.
- El botón "Editar" de Usuarios, los rótulos de rol (por ejemplo
  "Inventario" y "Dashboard Clientes") y el texto verde de campañas
  asignadas tienen ahora más contraste.
- Ningún texto de las pantallas queda por debajo del tamaño mínimo de la
  plataforma: las etiquetas pequeñas de los filtros de Tráfico (Desde,
  Hasta, Granularidad…) y otras notas crecen un poco.
- Los PDF que se descargan no cambian.
- Nada más cambia: datos, permisos y exportaciones son los mismos.

**Fase 144 (A4): pestañas sin barrita de desplazamiento y "X Cerrar" en una sola línea.**

- Junto a las pestañas de los tableros (Tráfico de Llamadas, Tráfico de
  WhatsApp…) ya no aparece una barrita vertical con flechas ▲▼ a la derecha.
- El botón "X Cerrar" (del tablero y de Cargar Datos) ya no se parte en dos
  renglones en computadores y tabletas.
- Nada más cambia.

## v1.34.3 — Octubre 2026

**Fase 144 (A3): las ventanas (tablero, Cargar Datos, Calidad…) se usan bien con el teclado.**

- Al abrir un tablero, Cargar Datos, Calidad o el detalle de un monitoreo,
  el teclado queda dentro de esa ventana: la tecla Tab ya no se va a la
  pantalla de atrás, que queda bloqueada mientras la ventana esté abierta.
- Al cerrar la ventana (con la X o con Esc), el cursor vuelve al botón con
  el que se abrió.
- El botón "Exportar" del tablero abre su menú con Enter, el cursor queda en
  "Excel (.xlsx)", las flechas pasan a "PDF / Imprimir" y Esc o Tab cierran
  solo el menú (el tablero sigue abierto).
- Los lectores de pantalla ahora anuncian el nombre de cada ventana.
- Nada más cambia: lo que se ve con el mouse, las exportaciones y los datos
  son los mismos.

## v1.34.2 — Octubre 2026

**Fase 144 (A2): la plataforma se puede usar con el teclado.**

- Las opciones del menú de la izquierda (Usuarios, Permisos, Cargar Datos…)
  ahora se alcanzan con la tecla Tab y se abren con Enter o la barra
  espaciadora. Antes solo funcionaban con el mouse.
- En la pantalla de bienvenida, la tarjeta "Dashboard Clientes" y las
  tarjetas de cada cliente también se abren con el teclado.
- En los tableros, las pestañas se recorren con las flechas izquierda y
  derecha y se abren con Enter. Los lectores de pantalla ahora dicen cuál
  pestaña está abierta.
- El selector de mes y los demás selectores de los encabezados muestran un
  borde visible cuando se llega a ellos con el teclado.
- En el celular, el botón ☰ indica si el menú está abierto y la tecla Esc lo
  cierra.
- Nada más cambia: el aspecto con el mouse, los números, los permisos y las
  exportaciones son los mismos.

## v1.34.1 — Octubre 2026

**Fase 144 (A1): Tráfico siempre muestra el período del mes elegido.**

- En Orlant → Tráfico de Llamadas, Orlant → Tráfico de WhatsApp y Mobilize
  → Flujo de Llamadas, al elegir un mes arriba la gráfica y las tarjetas
  terminan en ese mes y **se quedan así** aunque uno vuelva a hacer clic en
  la pestaña, vaya a otra y regrese, o cierre y abra el tablero. Antes, al
  volver a la pestaña, se mostraban todos los meses cargados sin avisar.
- Debajo del título de cada uno de esos paneles ahora dice qué fechas se
  están mostrando, por ejemplo "Mostrando: 01/04/2026 – 31/08/2026". Las
  tarjetas suman ese período.
- Si el mes elegido no tiene datos, el aviso "Sin datos… Ver <mes>" se
  mantiene hasta que se cambie de mes o se pulse "Ver".
- Si uno escribe Desde y Hasta a mano y pulsa "Aplicar filtros", esas fechas
  se respetan como siempre.
- Nada más cambia: los números de cada período, las exportaciones y los
  permisos son los mismos.

## v1.34.0 — Octubre 2026

**Fase 142: Nivel de Servicio de WhatsApp de Orlant por tiempo de respuesta.**

- En Orlant → Tráfico de WhatsApp → "Nivel de Servicio", ya no se ve una
  línea de porcentaje por mes. Ahora se ve qué porcentaje de las
  conversaciones se contestó en 0-3, 3-5, 5-8, 8-10 y más de 10 minutos,
  con la cantidad de cada rango, el total del mes y una tarjeta con el
  "% contestado en 0–3 minutos".
- Se puede elegir el mes y la cola. Por defecto se ve el mes elegido
  arriba; si ese mes no tiene datos, el último que sí tenga.
- En "Cargar Datos" de Orlant se puede subir el archivo de tiempos de
  Wolkvox. La plataforma toma solo las colas de WhatsApp y calcula el
  rango con los segundos de cada conversación (no usa la columna
  TIEMPO del archivo).
- Mientras no se cargue ese archivo, la sub-pestaña lo dice claramente,
  sin números inventados. Llamadas y Mobilize no cambian.

## v1.33.1 — Octubre 2026

**Fase 142: Llamadas Únicas ya no acepta filas "NO CONTESTADAS".**

- Si el archivo de Llamadas Únicas trae filas con SKILL_NAME = NO
  CONTESTADAS, la plataforma ahora avisa: "NO CONTESTADAS es una llamada
  de SALIDA no conectada; cárgala en Llamadas de salida." y no guarda esa
  hoja. Así no se vuelve a repetir el error de septiembre, donde esas
  llamadas se contaron como abandonadas.
- La plantilla de Llamadas Únicas ya no trae el ejemplo "NO CONTESTADAS".
- Nada más cambia: los datos ya cargados y las demás pestañas siguen igual.

## v1.33.0 — Octubre 2026

**Fase 141: Llamadas de salida de Mobilize.**

- La pestaña **Llamadas Únicas** de Mobilize ahora tiene dos mitades: a la
  izquierda las llamadas de ingreso (como antes) y a la derecha las
  **Llamadas de salida**. En el celular se ven una debajo de la otra.
- Las tarjetas de ingreso ahora van en este orden: Total, Contestadas y
  Abandonadas. Las de salida: Total llamadas de salida, No conectadas y
  Conectadas. Cada mitad tiene su gráfica de barras por mes y sus filtros
  de fecha.
- El equipo de InConexion también ve el detalle por asesor y por día de
  las llamadas de salida. El usuario de Mobilize ve los totales, sin
  nombres de asesor.
- En "Cargar Datos" de Mobilize se puede subir el archivo de llamadas de
  salida de Wolkvox. Cada teléfono se cuenta una vez por día (por separado
  si fue conectada y no conectada) y el número de teléfono nunca se
  guarda. Se pueden cargar varios meses.
- Mientras no se cargue ese archivo, la mitad derecha dice "Sin llamadas
  de salida cargadas todavía", sin números inventados.

## v1.32.0 — Octubre 2026

**Fase 141: nombres más claros y Tipificación lado a lado (reunión del 13 de octubre).**

- En Tráfico de Llamadas (Orlant) y en Flujo de Llamadas (Mobilize), la
  primera sub-pestaña ya no se llama "Resumen": ahora dice **"Flujo de
  Llamadas"**. En Tráfico de WhatsApp dice **"Flujo de WhatsApp"**.
  "Resumen" se confundía con un resumen de todo el tablero, y no lo es.
- En **Tipificación** (Orlant y Mobilize), en el computador la gráfica de
  torta queda a la izquierda y el cuadro con cada motivo a la derecha,
  del mismo tamaño. En el celular, la torta va arriba y el cuadro debajo.
  Los dos responden a los mismos filtros y siempre suman lo mismo.
- Nada más cambia: los números, los filtros, las exportaciones y los
  permisos son los mismos.

## v1.31.0 — Octubre 2026

**Fase 140: retoques visuales en toda la plataforma.**

- Los botones, cajas de texto y listas desplegables ahora usan la misma
  letra de la marca que el resto de la pantalla (antes usaban la letra
  de Windows y se notaba la diferencia).
- Los filtros de los tableros (Skill, Desde, Hasta, Granularidad,
  Asesor…) tienen ahora el mismo aspecto que el resto de la plataforma.
  Los botones Excel y PDF de cada gráfica se ven bien también en modo
  oscuro.
- En los tableros de Orlant y Mobilize ya no aparece una franja blanca
  vacía entre el encabezado y las pestañas.
- En la pantalla de bienvenida, cuando hay un solo módulo, ahora queda
  centrado.
- Al cambiar de pestaña, las tarjetas aparecen con una entrada suave y
  rápida. Al cambiar un filtro o el mes, los números se actualizan al
  instante, sin animación. Si el computador tiene activada la opción de
  reducir el movimiento, no hay animación.
- Nada más cambia: los números, las pestañas, los permisos y las
  exportaciones son los mismos.

## v1.30.5 — Octubre 2026

**Fase 139: la dirección de la plataforma es solo sinco.inconexion.com.co.**

- La guía de uso ahora dice que la plataforma (SInCo) se abre en
  **https://sinco.inconexion.com.co**. La dirección anterior ya no existe.
- Nada más cambia: tableros, datos y forma de entrar son los mismos.

## v1.30.4 — Octubre 2026

**Fase 139: las pestañas de los tableros ya no "saltan" al abrir.**

- Al abrir el tablero de Mobilize u Orlant, las pestañas (Flujo de
  Llamadas, Llamadas Únicas, Calidad…) se movían un poco hacia arriba o
  hacia abajo un instante después de aparecer, mientras cargaba el logo
  del cliente. Si uno hacía clic muy rápido, podía caer en otra pestaña.
  Ahora quedan quietas desde el primer momento.
- Tampoco se ve ya, por un instante, el logo del otro cliente al pasar de
  un tablero a otro.
- Nada más cambia: los números, las pestañas y los avisos son los mismos.

## v1.30.3 — Octubre 2026

**Fase 139: la guía de uso ya dice SInCo y tiene las pantallas nuevas.**

- La guía de uso (botón "Guía de uso" dentro de la plataforma) ahora se
  llama **SInCo** y explica que la pantalla de ingreso dice SInCo, con el
  logo de InConexion® pequeño abajo a la derecha.
- Las imágenes de la guía se tomaron de nuevo con la plataforma actual
  (solo con datos de demostración, nunca datos reales).
- Nada más cambia: tableros, datos y forma de entrar son los mismos.

## v1.30.2 — Octubre 2026

**Fase 139: "Llamadas Únicas" de Mobilize ahora tiene su propia pestaña.**

- En el tablero de Mobilize hay una pestaña nueva, **"Llamadas Únicas"**,
  justo después de Flujo de Llamadas, con las mismas 3 tarjetas, la
  gráfica por mes y los filtros de siempre.
- **Flujo de Llamadas quedó como antes**, sin el panel de llamadas únicas
  encima.
- Debajo del título de Llamadas Únicas ahora dice por qué sus números no
  coinciden con Flujo de Llamadas: aquí se cuenta una sola vez cada
  teléfono por día; en Flujo se cuentan todas las llamadas de la cola.
- No cambia ningún número ya cargado: solo dónde se ve.

## v1.30.1 — Octubre 2026

**Fase 139: el archivo de Llamadas Únicas de Mobilize ya se puede cargar.**

- Se corrigió un error que hacía que la plataforma no leyera las fechas
  del archivo de Llamadas Únicas que sale de Wolkvox: todas las filas
  aparecían como "fecha inválida" y no se podía cargar nada. Ahora las
  fechas se leen bien.
- Nada más cambia: los demás tableros y datos siguen igual.

## v1.30.0 — Octubre 2026

**Fase 139: la plataforma ahora se llama SInCo.**

- La pantalla de ingreso y la pantalla de bienvenida muestran el nombre
  **SInCo**, y la pestaña del navegador también dice SInCo.
- El logo de InConexion® queda pequeño en la esquina inferior derecha de
  esas dos pantallas.
- Se quitó el texto "Acceso a la plataforma" de la pantalla de ingreso.
- Nada más cambia: los tableros, los datos y la forma de entrar son los
  mismos.

## v1.29.1 — Octubre 2026

**Fase 138 (PR4): la guía de uso ya explica cómo armar el archivo de
"Llamadas Únicas" de Mobilize.**

- Nueva sección en la guía de uso (dentro de la plataforma y en el
  repositorio) con el paso a paso para sacar de Wolkvox los 3 reportes
  que arman el archivo de Llamadas Únicas de Mobilize (contestadas de
  ingreso, abandonadas y salientes no conectadas), con una captura de
  pantalla de referencia.
- Sin cambios de código ni de datos — solo documentación.

## v1.29.0 — Octubre 2026

**Fase 138 (PR3): nueva sección "Llamadas de ingreso únicas" en el tablero
de Mobilize.**

- Arriba de Flujo de Llamadas, Mobilize ahora muestra 3 tarjetas
  (Contestadas únicas, Abandonadas únicas, Total únicas) y una gráfica de
  barras por mes — "única" quiere decir que un mismo número de teléfono
  que llama varias veces el mismo día cuenta una sola vez (si llama en
  días distintos, sí cuenta aparte en cada día).
- Filtros por fecha, por skill y (solo para el equipo de InConexión, no
  para el usuario de Mobilize) por asesor.
- El número de teléfono nunca se guarda, nunca se exporta y nunca se
  muestra en ninguna pantalla — se usa solo un instante, en la
  computadora de quien sube el archivo, para no contar una misma llamada
  dos veces.
- Esta sección queda lista en el código y probada con datos de prueba,
  pero **sin ningún dato real todavía** — el archivo real de Edwin se
  carga en un paso aparte, solo cuando él confirme por escrito.
- La mitad derecha ("Llamadas de salida") queda pendiente — Edwin todavía
  no ha mandado ese archivo.

## v1.28.0 — Octubre 2026

**Fase 138 (PR2): Tipificación de Orlant ahora se ve igual que la de
Mobilize, y ASA + AHT de Mobilize se ven juntos en una sola gráfica.**

- El panel de Tipificación de Orlant (sigue oculto del menú, como antes)
  ahora muestra: 1 sola torta de Llamadas, filtro por tipo, tabla de
  detalle y las tarjetas de llamadas de salida — igual que ya se veía en
  Mobilize. Antes mostraba 2 tortas (Llamadas y WhatsApp) sin filtro ni
  tabla. La información de WhatsApp no se borra, solo deja de graficarse
  en este panel.
- En Flujo de Llamadas de Mobilize, las sub-pestañas "ASA" y "AHT" (antes
  separadas) ahora son una sola ("ASA y AHT"), con las 2 tarjetas de
  promedio y las 2 líneas de tendencia juntas — mismo estilo que ya usa
  Orlant para "ASA y ATA".
- Nada de esto cambia ningún número ya cargado — solo cómo se muestra.

## v1.27.0 — Octubre 2026

**Fase 138 (PR1): el selector de mes ahora muestra el nombre completo en
español, y el tablero de Orlant ya tiene su propio logo.**

- Los selectores de mes de Calidad y de "Mis Resultados" ahora muestran
  "Septiembre 2026" en vez de "2026-09" — igual que ya mostraban el
  selector principal del tablero y el de "Comparar contra". No cambia
  ningún dato, solo cómo se ve el mes.
- El encabezado del tablero de Orlant ahora muestra el logo de Orlant,
  igual que el de Mobilize ya lo muestra desde antes. El logo es
  **provisional** (una versión simple a partir de lo que mandó Edwin por
  WhatsApp) — se reemplaza cuando llegue el original en alta resolución.

## v1.26.0 — Octubre 2026

**Fase 137 (Parte B, F07): en Gestión de Usuarios, las acciones de
cada fila quedan mejor organizadas.**

- "Editar" sigue siendo el botón principal, visible como antes.
- "Cambiar contraseña", "Suspender/Activar" y "Eliminar" ahora están
  agrupadas en un menú (el ícono de 3 puntos ⋮) — menos botones
  sueltos en cada fila, más fácil de leer la tabla.
- El menú se puede usar solo con el teclado (abrir con Enter, moverse
  con las flechas, cerrar con Escape) y se ve bien en el celular.
- Nadie pierde ni gana ninguna acción — quien hoy puede editar,
  cambiar contraseña, suspender o eliminar un usuario, sigue
  pudiendo hacerlo exactamente igual. Solo cambia dónde está el
  botón.
- Nada de esto cambia ningún dato ni ningún número.

## v1.25.0 — Octubre 2026

**Fase 136 (PR 8): abrir y cerrar las ventanas (Calidad, Cargar Datos,
Supervisar Líder, constructor de dashboards, dashboard de cliente,
detalle de monitoreo) ahora se ve suave, no de golpe.**

- Las 6 ventanas emergentes de la plataforma ahora aparecen y se cierran
  con una pequeña transición, en vez de aparecer/desaparecer de un
  salto.
- Nuevo: la tecla **Escape** también cierra la ventana que esté abierta
  (antes solo se podía cerrar con el botón o haciendo clic afuera).
- Nada de esto cambia ningún dato, ningún número, ni cómo se usan estas
  ventanas — solo se ve más suave.

## v1.24.1 — Octubre 2026

**Fase 136 (F08): ya no aparece un aviso de error en la pantalla de
login.**

- Si alguien cambiaba el tema (claro/oscuro) antes de iniciar sesión,
  a veces aparecía un aviso de error abajo a la derecha ("No se
  pudieron cargar tus resultados..."). Era inofensivo — no exponía
  nada — pero confundía.
- Ya no aparece. Nada de esto cambia ningún dato ni ningún número.

## v1.24.0 — Octubre 2026

**Fase 136 (PR 7): "Mis Resultados de Calidad" ya no se ve vacío sin
explicación cuando no hay monitoreos, y el ícono de tema da una
pequeña confirmación al cambiarlo.**

- Cuando un asesor (o un reporte de Calidad) todavía no tiene
  monitoreos cargados, el gráfico de clasificación ahora dice
  claramente "Sin datos... todavía" en vez de verse vacío sin
  explicación.
- El ícono de cambiar tema (luna/sol) ahora gira suavemente al hacer
  clic, confirmando que el cambio se aplicó.
- Nada de esto cambia ningún dato ni ningún número.

## v1.23.0 — Octubre 2026

**Fase 136 (PR 6): las pestañas de un dashboard ahora cambian con una
transición suave, y las gráficas no "parpadean" al cambiar de mes o
filtro.**

- Al cambiar de pestaña (Tráfico de Llamadas, Calidad, etc.) dentro de
  un dashboard, el contenido nuevo aparece con un desvanecimiento suave
  en vez de un salto brusco.
- Cambiar de mes, filtro o tema sigue siendo instantáneo a propósito —
  eso lo usan mucho para revisar cifras rápido, no debía hacerse
  esperar.
- Las gráficas ya no vuelven a animarse de cero cada vez que se
  refresca un dato — solo la primera vez, de forma breve.
- Nada de esto cambia ningún dato ni ningún número.

## v1.22.0 — Octubre 2026

**Fase 136 (PR 5): botones, formularios y menú más consistentes y con
mejor respuesta al tacto/clic.**

- Los botones principales ahora dan un pequeño "rebote" visual al
  hacerles clic — confirma que la plataforma recibió la acción.
- El menú lateral ahora marca con más claridad en qué sección estás (una
  barra de color a la izquierda, no solo el fondo resaltado).
- Los campos de formulario y filtros quedan con el mismo estilo de
  esquina redondeada en toda la plataforma.
- Nada de esto cambia ningún dato ni ningún número.

## v1.21.4 — Octubre 2026

**Fase 136 (PR 4): base interna para las próximas animaciones — nada se
ve distinto todavía.**

- Se preparó la base de código para los próximos cambios de movimiento
  (transiciones, pestañas, modales) que vienen en los siguientes PRs.
- No se usó ninguna librería externa: se evaluó la opción, pesaba más de
  lo esperado (49 KB), y se resolvió igual de bien sin agregar nada de
  peso.
- No cambia absolutamente nada de lo que se ve en pantalla todavía.

## v1.21.3 — Octubre 2026

**Fase 136 (PR 3): orden interno del código de estilos — nada se ve
distinto.**

- Varios valores de diseño que se repetían una y otra vez (esquinas
  redondeadas, sombras) ahora están nombrados una sola vez y se
  reutilizan — más fácil de mantener a futuro.
- No cambia absolutamente nada de lo que se ve en pantalla.

## v1.21.2 — Octubre 2026

**Fase 136 (PR 2): el panel de Calidad y la ventana de "Cargar Datos" ya
no dan un salto visual al abrir.**

- Al abrir el módulo de Calidad o la ventana de "Cargar Datos", el
  contenido a veces "saltaba" de tamaño un instante después de abrirse
  (mientras cargaban los datos), lo que se sentía brusco.
- Ahora el espacio se reserva desde el principio — se ve igual de lleno,
  pero sin el salto.
- Nada de esto cambia ningún dato ni ningún número.

## v1.21.1 — Octubre 2026

**Fase 136 (PR 1): las pestañas del dashboard ya no se superponen en el
celular.**

- En pantallas angostas (celular), las pestañas de un dashboard (Tráfico
  de Llamadas, Calidad, etc.) a veces se veían con el texto encimado,
  difícil de leer.
- Ahora, si no caben todas en la pantalla, se puede deslizar el dedo
  para verlas una por una — nada se superpone.
- Nada de esto cambia ningún dato ni ningún número.

## v1.21.0 — Octubre 2026

**Fase 132 (Parte 8): el dashboard de Mobilize ya muestra su propio
logo en el encabezado.**

- El logo de Mobilize aparece arriba a la izquierda, dentro del
  encabezado teal, solo en su propio dashboard — ningún otro cliente
  cambia.
- Es un logo **provisional** (una captura chica que mandaron, se ve
  bien hasta cierto tamaño) — en cuanto Edwin mande el original en
  alta resolución, se reemplaza sin que nadie note el cambio.
- Nada de esto cambia ningún dato ni ningún número.

**Fase 134: solo ORLANT y MOBILIZE quedan en la plataforma — se
quitaron 12 clientes que no tenían ningún dato real cargado.**
(Nota agregada en la Fase 137 — esto se desplegó junto con lo de arriba
en esta misma versión, pero no se había escrito en su momento.)

- Los otros 12 clientes de la plataforma nunca tuvieron datos reales
  cargados (solo quedaba la plantilla vacía) — se quitaron del todo
  para que la plataforma muestre solo lo que de verdad se usa.
- Nadie perdió acceso a ORLANT ni a MOBILIZE; nada de sus datos
  cambió.
- Esto se hizo sin la doble verificación que usamos siempre antes de
  borrar algo (una prueba en seco primero, y la confirmación explícita
  de Edwin/InCo después) — fue un error de proceso. La revisión
  posterior confirmó que ORLANT y MOBILIZE quedaron intactos, pero a
  partir de ahora ningún borrado de datos se hace sin esos 2 pasos.

## v1.20.1 — Octubre 2026

**Fase 132 (cierre): el nombre de la marca ya se escribe igual en todas
partes — "InConexion®", sin tilde y siempre con el símbolo ®.**

- El menú de arriba de las 4 pantallas (Administrador, Cliente, Asesor,
  Supervisor) ya muestra el símbolo ® junto al nombre, chiquito, sin
  mover nada ni partir el texto en el teléfono.
- Se corrigió el nombre en todos los documentos de la plataforma donde
  todavía tenía tilde ("InConexión") — ahora dice "InConexion®" en
  todos.
- Nada de esto cambia ningún dato ni ningún número — es solo el nombre
  de la marca, escrito siempre igual.

## v1.20.0 — Octubre 2026

**Fase 133: mejor lectura — textos y semáforo con más contraste,
tipografía ordenada, gráficas con colores más distinguibles.**

- Los textos grises (notas, etiquetas, subtítulos) se leen mejor en
  modo claro — eran demasiado tenues para algunas personas.
- El semáforo (verde/amarillo/rojo de las tarjetas y tablas) ahora
  también trae un símbolo (●/◆/■) además del color, para quien no
  distingue bien los colores.
- Las gráficas con varias líneas/colas/asesores usan colores nuevos,
  pensados para que cualquiera los distinga (antes dos series podían
  verse casi igual).
- El texto de las gráficas (números, leyendas) es más grande y legible.
- Botones y enlaces ahora muestran un aro de color al navegar con el
  teclado (Tab), y los botones de mostrar/ocultar contraseña y las
  gráficas son más claros para quien usa un lector de pantalla.
- En el teléfono, los botones principales (cerrar, exportar, el
  selector de mes, las pestañas) son más grandes y fáciles de tocar.
- 2 corrección real encontrada en el camino: en el teléfono, a veces el
  encabezado del dashboard tapaba la primera pestaña y no se podía
  hacer clic — ya no pasa.
- Nada de esto cambia ningún dato ni ningún número — es solo la forma
  en que se ve y se usa la plataforma.

## v1.19.0 — Octubre 2026

**Fase 132: la plataforma ya usa el logo, los colores y la letra
oficiales de InConexion®.**

- Nuevo logo de verdad (con el símbolo de red y el ®) en el inicio de
  sesión, en el menú de arriba de cada pantalla y en la bienvenida —
  antes era un logo provisional. Cambia solo entre claro/oscuro para
  verse siempre bien.
- El ícono de pestaña del navegador (favicon) ya no es el genérico del
  navegador — ahora es el símbolo de InConexion®.
- Letra nueva en toda la plataforma (Quicksand, la de la marca) en vez
  de la letra del sistema operativo. Se revisó que ningún numero, tabla
  ni tarjeta se corte o se desordene con la letra nueva, en pantalla
  grande y en celular.
- El color principal (el teal de la barra de arriba, los botones y los
  encabezados de cada tablero) pasa a ser el oficial de la marca — un
  poco mas oscuro, se lee mejor todavia. El verde de "Última
  actualización" sigue exactamente igual.
- Nada de esto cambia ningún dato, ningún numero ni ningún export —
  es solo la imagen de la plataforma.

## v1.18.0 — Octubre 2026

**Fase 131 (Parte 4): cada dashboard ahora muestra cuándo se cargó por
última vez.**

- Nuevo: en la parte de arriba de cada dashboard aparece "Última
  actualización: [fecha y hora]", en hora de Colombia — la fecha de la
  carga más reciente de ese cliente (sin importar de qué pestaña venga).
- Resaltado con un borde de color: naranja para Mobilize, verde
  InConexion para el resto de clientes.
- Si un cliente todavía no tiene ningún dato real cargado, simplemente no
  aparece (nunca se inventa una fecha).

## v1.17.0 — Octubre 2026

**Fase 131 (Parte 3): Mobilize ya tiene su pestaña de Tipificación
(motivos de llamada), igual que ORLANT.**

- Nueva pestaña "Tipificación" en el dashboard de Mobilize: torta con los
  motivos de llamada (de mayor a menor, con cantidad y %), filtros por
  asesor, línea, mes y Entrante/Saliente.
- Nuevo: 3 tarjetas con el total de llamadas salientes, cuántas se
  conectaron con el cliente y cuántas no — pensadas para las llamadas de
  gestión de salida.
- Al cargar, las filas marcadas como "PRUEBA" en el archivo se excluyen
  solas (y la pantalla avisa cuántas se excluyeron).

## v1.16.4 — Octubre 2026

**Fase 131: la carga real del Flujo de Llamadas de Mobilize no se podía
subir desde la pantalla — ya se puede.**

- Corregido: al intentar subir el archivo real de Mobilize (que trae su
  hoja con un nombre que cambia cada vez, no "DATA"), la plataforma decía
  "El archivo no tiene datos en ninguna hoja reconocida" aunque el archivo
  estuviera bien. La pantalla de carga no sabía reconocer los nombres de
  columna propios de Mobilize ("TIPO DE LINEA", "DÍA", etc.) que ya se
  habían agregado en la versión anterior — ahora sí los reconoce.

## v1.16.3 — Octubre 2026

**Fase 131 (Parte 2): el dashboard de Mobilize ya muestra su Flujo de
Llamadas real, en el orden que pidió Edwin.**

- Nuevo: la pestaña "Flujo de Llamadas" de Mobilize reutiliza el mismo
  motor ya probado con ORLANT (Tráfico de Llamadas) — mismos filtros por
  mes/día/tipo de línea, sin WhatsApp (Mobilize no lo tiene).
- El orden que pidió Edwin: Resumen (ingresadas, contestadas, abandonadas,
  nivel de atención), Nivel de Servicio 80-20, % Abandono, ASA y AHT (al
  final) — cada sección con su propio número acumulado del período, no
  solo un resumen arriba.
- ASA y ATA ya se leen aunque vengan como texto en el archivo (antes solo
  se aceptaban como número); ATA se guarda pero no se grafica (pedido de
  Edwin).
- Se agregó un aviso de seguridad: si "Nivel de Atención" o "% Abandono"
  llegaran a dar más de 100% al cargar un archivo, la plataforma avisa
  antes de confirmar la carga (nunca inventa ni corrige el número solo).

## v1.16.2 — Octubre 2026

**Fase 131 (Parte 1): el cliente "Movilize" se escribía mal — ahora dice
"Mobilize", su nombre real.**

- Corregido: en toda la plataforma (su dashboard, los permisos de sus
  usuarios, Calidad) el cliente aparecía escrito "MOVILIZE" en vez de
  "MOBILIZE". Se corrigió el nombre en todas partes.
- Ningún usuario de Mobilize perdió su acceso con este cambio.

## v1.16.1 — Octubre 2026

**Fase 130 (Parte 7): el límite de "demasiadas peticiones" ya no bloquea a
toda una oficina por el error de una sola persona.**

- Corregido: cuando varias personas de la misma oficina o cliente usan la
  plataforma al mismo tiempo (comparten una sola conexión a internet),
  antes podían bloquearse entre sí con el mensaje "demasiadas peticiones"
  o "demasiados intentos", aunque cada una estuviera usando la app de
  forma normal.
- Ahora, quien ya inició sesión tiene su propio cupo de uso (no comparte
  el de sus compañeros de oficina). El aviso de "demasiados intentos" al
  iniciar sesión también es independiente por cada usuario, y ahora dice
  cuántos minutos faltan para volver a intentar.

## v1.16.0 — Octubre 2026

**Fase 130: nueva gráfica en Calidad — nombre y nota promedio por
asesor.**

- En la pestaña Calidad de ORLANT, además de los indicadores de siempre
  y la torta de clasificación, ahora hay una gráfica de barras con el
  nombre de cada asesor y su puntaje promedio (%), ordenada de mayor a
  menor. Nunca muestra cuántos monitoreos tiene cada uno. Respeta el
  mismo filtro de mes/asesor/fecha que ya tenía la pestaña.

## v1.15.6 — Octubre 2026

**Fase 130 (cierre): las notas del evaluador en Calidad ya aceptan el
tamaño real que escribe el equipo.**

- Corregido: el campo "Observaciones" de un monitoreo de Calidad
  rechazaba una nota de mas de 200 caracteres. El archivo real de
  septiembre trae varias notas mas largas (hasta 235 caracteres). Ya
  acepta hasta 500 caracteres, igual que el mismo campo en Inventario.

## v1.15.5 — Octubre 2026

**Fase 130 (cierre): la carga real de Calidad por "Cargar Datos" ya no se
rechaza por filas de plantilla sin llenar.**

- Corregido: el archivo real de Calidad trae, muy por debajo de los
  monitoreos reales, varias filas de plantilla con la fórmula del puntaje
  ya copiada pero nunca diligenciada (sin nombre de asesor). Antes, eso
  hacía que el sistema rechazara el archivo completo ("no tiene datos en
  ninguna hoja reconocida"), aunque los monitoreos reales estuvieran bien.
  Ya se ignoran esas filas de plantilla, igual que ya se ignoraban al
  cargar Calidad por su pantalla propia.

## v1.15.4 — Octubre 2026

**Fase 130 (Parte 3): se quita el aviso de "mes incompleto" en
Inasistencia — pedido de Edwin.**

- En Inasistencia, un mes ya no se marca con un aviso solo por tener
  menos especialidades que otro mes. Ahora que los archivos reales
  llegan completos mes a mes, que una especialidad no haya operado en
  un mes puntual es una variación normal del negocio, no un dato que
  falte. Se mantienen los avisos que sí siguen siendo útiles: un mes
  en el formato viejo (antes del archivo real por cita) y un filtro
  que deja un mes sin ninguna fila.

## v1.15.3 — Octubre 2026

**Fase 130 (Parte 4): la carga masiva de Calidad acepta la plantilla real
que manda Edwin cada mes, sin que la tenga que editar.**

- Corregido: el archivo real de Calidad trae título, leyenda y un
  encabezado agrupado por categoría antes del encabezado real, usa
  "Nombre del Asesor" en vez de "ASESOR", y cada pregunta de la
  calificación lleva su número y el peso ("1. Guion de saludo (5%)") en
  vez del texto exacto que esperaba el sistema. Antes esto hacía que el
  archivo se rechazara por completo. Ya se reconoce el encabezado real
  (no importa en qué fila esté) y cada pregunta por su número, sin
  depender del texto exacto.

## v1.15.2 — Octubre 2026

**Fase 130 (Parte 2): el archivo de Inasistencia de agosto y septiembre
sube sin tener que editarlo.**

- Corregido: el archivo real de Inasistencia cambio sus encabezados
  ("FECHA CITA" en vez de "FECHA_CITA", y la sede "Sede 34" ahora viene
  con una aclaracion entre parentesis, "SEDE 34 (AUDIFONOS)"). Antes
  esto hacia que el archivo no se reconociera, o que "Sede 34" quedara
  partida en 2 sedes distintas en los filtros. Ya se reconoce igual que
  antes, sin que Edwin tenga que tocar el archivo.

## v1.15.1 — Octubre 2026

**Fase 129: arreglo real al subir el archivo de Inasistencia.**

- Corregido: subir el archivo completo de Inasistencia (varios meses
  juntos) podía terminar en "el archivo no tiene datos reconocidos",
  aunque el archivo fuera perfectamente válido. La causa: cuando la
  columna de fecha de la cita venía con formato de fecha de Excel (en
  vez de un número simple), el sistema no sabía leerla y descartaba
  todas las filas sin avisar bien por qué. Ya se reconoce ese formato
  igual que los demás.

## v1.15.0 — Octubre 2026

**Fase 128: cambios pedidos por Edwin en la reunión de validación de
hoy, más seguridad y orden interno.**

- La pestaña **"Salida" se renombra a "Llamadas y WhatsApp de salida"**
  (más claro) y se mueve justo al lado de "Tráfico de WhatsApp" — antes
  quedaba al final del menú. Los números no cambian, solo el nombre y la
  posición.
- Corrección de seguridad: el script interno que revisa producción
  después de cada cambio ya no puede, por ningún motivo, imprimir
  nombres reales de asesores en su reporte — antes, si alguien corría
  ese chequeo, la tabla "Ranking de asesores" terminaba en el reporte
  con nombres reales. Ahora ese script solo cuenta y clasifica, nunca
  copia texto de la pantalla.
- Herramienta nueva, solo para administradores: una forma segura de
  borrar datos de prueba de Calidad (monitoreos) por rango de fechas,
  con el mismo candado de siempre (primero cuenta cuántos se borrarían
  y solo borra si ese número se confirma exacto) — se usó para retirar
  los monitoreos de prueba de ORLANT antes de que lleguen los datos
  reales.
- Orden interno: limpieza de ramas de trabajo ya cerradas, y la versión
  interna del proyecto quedó al día en todos los archivos que la usan.

## v1.14.0 — Octubre 2026

**Fase 127: nuevo indicador de Llamadas y WhatsApp de Salida — pedido
textual de Edwin ("las llamadas de salida están muy bajas, hay que
revisarlo").**

- Nueva pestaña **"Salida"** en el dashboard de ORLANT: muestra, mes a
  mes, el total de llamadas y de WhatsApp de salida (3P y Línea
  General), con la variación contra el mes anterior cuando hay con qué
  compararla. Solo aparece cuando ya hay datos cargados.
- Se puede cargar el archivo mensual de Salida desde "Cargar Datos"
  (mismo lugar de siempre). Como el mes del archivo no trae año, la
  plataforma **muestra y pide confirmar** a qué año corresponde cada
  mes antes de guardar — nunca lo adivina en silencio, y se puede
  corregir si hace falta.
- Corrección interna: un archivo válido con el encabezado más abajo de
  la primera fila de la hoja (como el de Salida) podía no reconocerse
  ("El archivo no tiene datos en ninguna hoja reconocida") — ya se
  corrigió y quedó cubierto con pruebas para que no vuelva a pasar.

## v1.13.3 — Octubre 2026

**Fase 126: solo quedan los datos oficiales de agosto y septiembre 2026
— pedido explícito de Edwin.**

- Se quitaron de la plataforma los datos que venían de **plantillas de
  prueba** (no son datos que Edwin haya mandado como reales): el mes de
  Abril de 2025 en Agendas, Enero a Marzo de 2026 en Efectividad de
  Citas, y Enero a Julio de 2026 en Inasistencia. Todo lo demás (agosto,
  septiembre y el cruce real de julio en Tipificación de WhatsApp) sigue
  intacto, con los mismos números de siempre.
- El mismo día llegó el archivo real de Efectividad de Citas de
  agosto-septiembre — ya está cargado y visible.
- En Tráfico de WhatsApp ya no aparece el aviso de "Nivel de servicio a
  5 minutos: aún no hay datos" — se simplificó la pantalla mientras ese
  dato no esté disponible (vuelve solo, sin avisos, en cuanto llegue).
- El aviso de un mes con información incompleta en Inasistencia ahora
  usa un texto más simple, sin palabras técnicas.
- Limpieza interna: nuevo mecanismo de administrador para borrar datos
  de prueba por base y rango de meses, con varias verificaciones de
  seguridad antes de borrar cualquier cosa.

## v1.13.2 — Octubre 2026

**Fase 125: cierre de lo que quedó pendiente de la Fase 124 — sin
cambios visibles para la operación diaria, salvo un aviso nuevo al
cargar archivos muy grandes.**

- Se corrigió una explicación mal planteada sobre el tamaño máximo de un
  archivo por carga (el límite es por archivo, no se va acumulando mes a
  mes — no había ningún problema real).
- Al subir un archivo de Agendas o Tipificación que junta demasiados
  meses de una sola vez, la plataforma ahora avisa ANTES de intentar
  guardarlo (en vez de dejarlo pensando y fallar al final).
- La guía de uso y el checklist de verificación quedaron al día con lo de
  las últimas fases: nombre del asesor visible en Agendas y en el
  Ranking, formato del archivo de Tipificación de WhatsApp, qué es un
  alias de nombre de asesor, y los meses con nombre completo.
- Revisión de seguridad con la página real (no solo lectura de código):
  se probaron varios intentos de inyectar código malicioso a través de
  archivos cargados (nombres de asesor, motivos, especialidades) — en
  ningún caso se logró ejecutar nada, todo quedó como texto normal, tanto
  en pantalla como en los archivos Excel descargados.
- Se confirmó que la gráfica de "Ranking de asesores" no recorta ningún
  dato ni etiqueta, incluso con asesores muy por encima del 100% de
  efectividad.

## v1.13.1 — Octubre 2026

**Fase 124: revisión general de errores y seguridad antes de la entrega
— sin cambios visibles para el usuario.**

- Se cerró una alerta de seguridad crítica de una librería externa
  (parche menor, sin afectar ninguna función).
- Se confirmó, probando directamente sobre la plataforma real en
  producción, que todo lo nuevo de la Fase 122 (tema oscuro, pantallas
  grandes y celular, asesores con más del 100% de efectividad, el
  selector de mes, el mes parcial de julio, y el alias de nombre de
  asesor) funciona correctamente — 0 errores encontrados.
- Limpieza interna: se quitó una función de cálculo que ya no se usaba
  en ninguna pantalla.

## v1.13.0 — Octubre 2026

**Fase 122: se cargaron en producción los 4 archivos reales de ORLANT que
faltaban de agosto y septiembre/2026 (Tipificación de WhatsApp, Agendas,
Efectividad de Agendamiento de los 2 meses) y se aplicaron los pedidos de
la reunión con Edwin.**

- **Tipificación de WhatsApp ya se puede cargar.** El export real de
  Wolkvox para WhatsApp (formato "HistChat") no se reconocía antes —
  ahora sí, sin importar el nombre de la hoja (cambia en cada descarga).
  25.180 conversaciones de WhatsApp cargadas (julio a septiembre/2026).
- **Nuevo: alias de nombre de asesor.** Cuando la misma persona llega con
  dos nombres distintos entre archivos, o con una errata de tipeo puntual
  en Wolkvox, un administrador puede registrar la equivalencia una sola
  vez — la plataforma guarda siempre el nombre correcto, en todas las
  bases, sin tener que corregir cada archivo a mano.
- **En Efectividad de Agendamiento y Efectividad de Citas, el mes ya
  muestra su nombre completo** ("Septiembre 2026" en vez de "Sep-26") —
  pedido textual de Edwin. El selector de mes de arriba (compartido por
  las 7 pestañas) también lo muestra así.
- Cargados agosto y septiembre/2026 de Agendas (24.186 citas) y de
  Efectividad de Agendamiento (equipo: agosto 41,17 %, septiembre 40,00 %)
  — reemplaza el dato preliminar de septiembre que venía de un archivo
  anterior.
- **3 arreglos reales encontrados al cargar los archivos reales** (antes
  de que llegaran a mostrarse mal en pantalla): un archivo grande de
  Agendas se rechazaba por superar el límite de tamaño de la plataforma;
  un archivo con muchas filas en una sola hoja podía dejar el navegador
  sin responder varios minutos al subirlo; y el reconocimiento de la hoja
  de WhatsApp (ver arriba) tenía un defecto que lo bloqueaba siempre, no
  solo a veces.
- Verificado en producción, con la sesión real del administrador: los 4
  archivos cargados coinciden exacto con los números ya revisados contra
  los archivos de origen (incluido el cruce completo, asesor por asesor,
  entre Agendas y Efectividad de Agendamiento — 0 diferencias); las 7
  pestañas y sus sub-pestañas siguen mostrando datos reales; 0 errores en
  pantalla.

## v1.12.0 — Octubre 2026

**Fase 120: se revisaron en produccion, dato por dato, los 3 archivos que
envio InCo (Trafico de Llamadas, Trafico de WhatsApp, Tipificacion) y se
corrigieron 2 cosas reales en Trafico de WhatsApp.**

- **En Trafico de WhatsApp se quito el AHT (tiempo promedio de atencion)
  porque Wolkvox no lo entrega.** Se confirmo contra los 2 archivos reales
  de agosto y septiembre/2026 (258 filas en total): la columna AHT siempre
  viene vacia ("----"), nunca con un numero real. Se quito la sub-pestaña
  "AHT", y la columna "AHT (seg)" de los archivos exportados (Excel/PDF).
  El AHT de Trafico de Llamadas (voz) sigue igual — ahi si llega un numero
  real. Si Wolkvox llega a entregar el AHT de WhatsApp mas adelante, se
  puede volver a activar sin tocar codigo.
- **Arreglo real: el ATA (tiempo promedio de abandono) de Trafico de
  Llamadas y de WhatsApp se promediaba mal.** Se calculaba ponderado por
  el total de llamadas/WhatsApp del dia, en vez de por cuantas realmente
  se abandonaron ese dia — un dia con mucho volumen y pocos abandonos
  "diluia" el promedio hacia abajo. Contra el archivo real de Llamadas,
  el promedio de agosto quedaba en 350.92 segundos calculado como antes,
  contra 625.13 segundos con la cuenta corregida (casi el doble). Ya
  quedo corregido en los dos canales (Llamadas y WhatsApp); el numero que
  se ve en la pantalla "ASA y ATA" y en los exportados ahora sube para
  reflejar el dato real.
- Se revisaron en produccion, con la cuenta real del cliente y con la de
  administrador, las 7 pestañas de ORLANT Y cada una de sus sub-pestañas
  (no solo la que abre por defecto) — todas dibujan algo real o muestran
  un mensaje claro, ninguna queda en blanco. Los numeros en pantalla
  coinciden exactamente con los archivos reales: 150 filas de Llamadas,
  258 de WhatsApp y 34.661 de Tipificacion, sin diferencias.
- La revision automatica que corre en cada cambio a la plataforma ahora
  tambien confirma que, cuando una grafica se esconde porque no tiene
  dato, SI quede un aviso visible explicando por que — antes solo
  confirmaba que estuviera escondida, sin revisar si el aviso de verdad
  aparecia.

## v1.11.2 — Octubre 2026

**Revision final de seguridad antes de entregar ORLANT (Fase 117): 2
arreglos reales, el resto de la plataforma quedo verificado sin
hallazgos nuevos.**

- **Arreglo: el Historial (registro de acciones e inicios de sesion)
  podia mostrar dos eventos MUY seguidos en el orden equivocado.** Se
  encontro al correr las pruebas automaticas varias veces seguidas (una
  de ellas fallo por esto, al azar). La causa: el orden se calculaba con
  la hora exacta al milisegundo, y dos eventos en el MISMO milisegundo
  (ej. dos inicios de sesion casi simultaneos) podian aparecer en
  cualquier orden. Ahora, si dos eventos empatan en el mismo
  milisegundo, se desempata siempre por cual ocurrio primero.
- **Arreglo preventivo: la plantilla descargable de Calidad (lista de
  criterios de evaluacion) no protegia contra formulas de Excel en el
  nombre de un criterio**, igual que ya protegen todas las demas
  descargas de la plataforma. No se encontro ningun criterio real
  afectado — es una proteccion agregada por si acaso, antes de que haga
  falta.
- Revisado sin hallazgos nuevos (con evidencia, no solo "se ve bien"):
  inicio de sesion y "Cambiar mi contrasena" (limite de intentos, mensaje
  de error igual para usuario inexistente/clave mala, JWT con expiracion
  y algoritmo fijo), permisos por campana/cliente en las cargas y
  exportaciones, inyeccion SQL (todas las consultas parametrizadas),
  cabeceras de seguridad HTTP y CORS, archivos/datos reales fuera del
  repositorio y del historial de Git, y que las acciones de los workflows
  de GitHub sigan fijadas a una version exacta.

## v1.11.1 — Octubre 2026

**Arreglo: un residuo de datos viejos podia sobrevivir al reemplazar
Trafico de Llamadas o de WhatsApp, si la linea/cola no tenia actividad
justo en los primeros dias del archivo nuevo.** El reemplazo por rango
(ver v1.10.4) calculaba el rango a borrar usando solo las fechas de ESA
linea/cola dentro del archivo — si una cola de WhatsApp no tuvo ningun
mensaje los primeros 1-2 dias del periodo (puede pasar, no es un error),
su rango arrancaba despues y un dato viejo de antes de esa fecha se
quedaba sin borrar, inflando el total. Encontrado y corregido durante la
carga real de agosto-septiembre 2026: ahora el rango a reemplazar es el
de TODO el archivo (todas las lineas/colas juntas), nunca el de una sola
linea/cola por separado.

## v1.11.0 — Octubre 2026

**Novedad: Trafico de WhatsApp acepta el reporte diario real de Wolkvox
(el mismo formato que ya usa Trafico de Llamadas), y Tipificacion acepta
el reporte COMPLETO de Wolkvox (HistCDR).** Antes, Trafico de WhatsApp
solo aceptaba una plantilla con un periodo largo por cola (agosto
completo, por ejemplo); ahora tambien reconoce el archivo real que
exporta Wolkvox dia por dia, igual que Llamadas — un archivo viejo con
el formato de periodo sigue funcionando igual. Tipificacion ahora
tambien acepta el export completo de Wolkvox (con todas sus columnas,
incluidas las de datos del paciente) sin sacar la fecha y hora de la
llamada: esas columnas con datos de pacientes (telefono, comentario,
identificador de cliente/llamada) nunca salen del navegador ni llegan
al servidor — el sistema solo toma las columnas que de verdad usa.

**Recordatorio: al subir un archivo de Trafico (Llamadas o WhatsApp) se
reemplaza todo el periodo que trae el archivo, sin duplicados** (ver
v1.10.4) — Tipificacion ya funcionaba asi desde que se creo.

## v1.10.4 — Octubre 2026

**Arreglo: subir un Trafico de Llamadas o de WhatsApp corregido (con un
dia o periodo de menos) dejaba el dato viejo huerfano en vez de
quitarlo.** Antes, la carga solo actualizaba las fechas que traia el
archivo nuevo — si un dia dejaba de venir (por ejemplo, un dato de
prueba que nunca debio quedar, o un reenvio corregido de Edwin), ese dia
seguia en la base para siempre, sin que nadie lo notara. Ahora la carga
reemplaza TODO el rango de fechas que cubre el archivo (de la primera a
la ultima fecha, por linea/cola) — igual que ya funcionaba Agendas e
Inasistencia. El aviso de confirmacion antes de guardar ahora dice
tambien cuantos registros se van a BORRAR (ademas de cuantos se
reemplazan), para que quede claro antes de confirmar. Nunca toca una
fecha fuera del rango que trae el archivo.

## v1.10.3 — Octubre 2026

**Arreglo: el tiempo promedio de atencion (AHT) y el tiempo de espera
(WAIT_TIME) de Trafico de Llamadas se guardaban vacios.** Cuando el Excel
trae esas 2 columnas con formato de hora real (como vino el archivo de
agosto-septiembre), el navegador las convertia mal por un detalle de la
zona horaria del equipo que sube el archivo -- ya corregido: se lee el
numero real de la celda, sin depender de esa conversion.

## v1.10.2 — Octubre 2026

**Arreglo: un archivo real de Trafico de Llamadas no se reconocia al
subirlo.** Cuando la unica hoja del Excel se llama "Hoja1" (en vez de
"LLAMADAS" o "DATA", como paso con el archivo de agosto-septiembre), la
pantalla de Cargar Datos ya no lo rechaza — lo reconoce igual que ya hacia
con Agendas, Tipificacion, Efectividad de Agendamiento y Citas Atendidas.

## v1.10.1 — Octubre 2026

**Arreglo: los respaldos automaticos de la base volvieron a funcionar.**
El respaldo diario de la base de datos llevaba desde el 18 de septiembre sin
correr (nunca se activo en el servidor nuevo despues de un cambio de cuenta
de AWS) — todo lo cargado desde entonces no tenia copia de seguridad. Ya
esta corregido y confirmado: hay un respaldo de hoy, completo y verificado,
y vuelve a correr solo todas las noches.

**Seguridad: actualizacion de la libreria de Excel.** La libreria que usa la
plataforma para leer los archivos Excel que se suben y para generar los
"Exportar" tenia una vulnerabilidad conocida. Se actualizo a la version mas
reciente — se probo que cada tipo de archivo (Trafico, Tipificacion,
Agendas, Inasistencia, Efectividad, Calidad) y cada "Exportar" siguen
funcionando exactamente igual.

## v1.10.0 — Octubre 2026

**Ahora cada usuario puede cambiar su contrasena.** Nueva opcion "Cambiar mi
contrasena" en el menu de usuario, disponible para cualquier persona desde
cualquier pagina — pide la contrasena actual, la nueva y que la confirmes.
Al cambiarla (ya sea asi, o cuando un administrador resetea la de alguien
mas desde Usuarios), las sesiones abiertas antes de ese cambio dejan de
servir; la que usaste para cambiarla sigue abierta sin pedirte entrar de
nuevo.

**La plataforma registra los inicios de sesion.** Cada vez que alguien
entra o intenta entrar (bien o mal) queda anotado en el Historial — con
fecha, hora, IP y el navegador usado — visible solo para un administrador
completo. La lista de Usuarios ahora muestra cuando entro cada quien por
ultima vez, y si una cuenta tiene muchos intentos fallidos seguidos o un
administrador entra desde un lugar nuevo, sale un aviso en el panel.

## v1.9.1 — Octubre 2026

Revision general de toda la plataforma antes de seguir con las bases
nuevas de Edwin. Nada visible cambia en el dia a dia — quedo todo mas
organizado y verificado por dentro.

- **Revision completa de ORLANT**: las 7 pestañas, cada rol de usuario,
  computador y celular, tema claro y oscuro — confirmado tambien en vivo
  contra produccion: todos los numeros que muestra cada pestaña coinciden
  exactamente con lo esperado.
- **Nueva revision automatica**: de ahora en adelante, cada cambio al
  codigo pasa por un chequeo que abre la plataforma de verdad y confirma
  que cada grafico se dibuja — si alguna vez un grafico deja de
  mostrarse (como paso una vez), se detecta solo antes de llegar a
  produccion.
- Se ordenaron los documentos y los scripts internos del proyecto (nada
  que afecte el uso diario de la plataforma).

## v1.9.0 — Octubre 2026

**El ranking de asesores ahora es por efectividad (agendas / gestiones).**
Antes ordenaba a los asesores por cuántas agendas lograba cada uno; ahora
ordena por su **% de efectividad** (agendas ÷ gestiones) — un asesor con
pocas gestiones pero casi todas agendadas puede quedar por encima de uno
con muchas más gestiones pero menos agendadas. La tarjeta "Efectividad
del equipo" es un **ponderado** (suma de agendas ÷ suma de gestiones de
todos los asesores), nunca el promedio simple de cada %. Se carga con el
archivo mensual que manda Edwin, hoja `EFECTIVIDAD_AGENDAMIENTO`.

**Nueva pestaña Efectividad de Citas.** Muestra qué porcentaje de las
citas agendadas se atendieron realmente, mes a mes, con una tarjeta del
mes elegido arriba y otra con el % ponderado de todo el período con
datos. Se carga con el archivo mensual `CITAS_ATENDIDAS`.

## v1.8.1 — Octubre 2026

**Seguridad:** las cuentas de ejemplo ya no se crean en producción. Además,
al arrancar, la plataforma revisa sola si alguna cuenta de ejemplo quedó
con su contraseña original y, si la encuentra, la suspende automáticamente
y lo deja anotado en el Historial.

## v1.8.0 — Octubre 2026

En Inasistencia, la sub-pestaña "Resumen por mes" cambia de barras a una
**gráfica de línea** (como un gráfico de línea de Excel), con una **tabla
de datos** debajo que muestra el % de cada mes y el total de citas, igual
que la tabla que Excel pone debajo de sus propias gráficas. El mes
elegido arriba se resalta (punto más grande, columna en negrita en la
tabla); un mes que todavía viene del reporte anterior (sin sede ni
entidad, como Septiembre 2026 hoy) se marca con un punto hueco, el último
tramo de la línea punteado y un asterisco en la tabla.

También cambia la tarjeta de arriba: ahora son **2 tarjetas** — una con
el % de todo el período que dejen pasar los filtros (dice el rango exacto,
ej. "Ene-26 a Sep-26", para que nadie la confunda con el mes elegido
arriba) y otra con el % solo del mes elegido arriba. Antes había una sola
tarjeta que podía confundirse con "el % de agosto" sin serlo.

Se confirmó que, cuando llegue el archivo de Septiembre en el formato
nuevo (una fila por cita), subirlo reemplaza completo lo que hoy hay de
Septiembre en el formato anterior — no queda ninguna mezcla de los dos
formatos en el mismo mes.

## v1.7.0 — Octubre 2026

Cambio de fondo en Inasistencia: el archivo que sube Edwin ya no es un
resumen por mes/especialidad, ahora es un reporte con una fila por cada
cita (igual que Agendas) — eso permite filtrar por Sede, Especialidad y
Entidad (esta última con buscador, porque son miles), algo que antes no
se podía. La pestaña Inasistencia ahora tiene 2 vistas:

- **Resumen por mes** (la que abre por defecto): una tarjeta con el % de
  inasistencia de todo el período que dejen pasar los filtros de arriba,
  más una gráfica con el % de cada mes con datos.
- **Por especialidad**: una barra por especialidad, del mes elegido
  arriba. Las especialidades con muy pocas citas ese mes se marcan con un
  asterisco (\*) y se muestran al final del todo — su porcentaje puede no
  ser representativo con tan pocos datos.

Exportar a Excel ahora trae 2 hojas (una por vista), respetando los
filtros que estén aplicados.

**Importante — un número que ya se veía en pantalla va a cambiar**: el %
de inasistencia de Agosto 2026 pasa de 5,63% a 7,45%. No es un error: el
5,63% salía de un reporte parcial (solo 3 especialidades, 5.893 citas) que
Edwin mandó antes de tener listo el reporte completo de agendamiento; el
7,45% sale del archivo completo (todas las especialidades, 11.189 citas) y
es el número correcto. Los meses de Enero a Agosto 2026 completos quedan
cargados con este archivo nuevo; Septiembre 2026 (que solo tenía datos de
Exámenes Especiales) se queda exactamente como estaba.

## v1.6.0 — Octubre 2026

La pestaña Inasistencia ahora muestra solo el porcentaje de inasistencia
por mes. Antes tenía 3 sub-pestañas ("Por mes", "Por especialidad",
"Detalle") con conteos (total de citas, atendidas, canceladas,
inasistencias, pendientes); ahora es una sola vista limpia, con una
tarjeta y una gráfica, las dos con el mismo % ponderado de siempre (nunca
el promedio simple). El selector de Mes de arriba sigue funcionando igual
(resalta el mes elegido en la gráfica) y Exportar a Excel trae el mismo %
que se ve en pantalla. Nada se borró de la base de datos ni de la carga
del archivo — solo cambió qué se muestra en pantalla.

## v1.5.1 — Octubre 2026

Arreglo: el dashboard de cliente a pantalla completa (desde la v1.4.0)
quedaba unos pixeles más angosto que la pantalla real en algunos
navegadores — se notaba como un margen vacío muy delgado del lado
derecho. Corregido: ahora cubre el ancho exacto de la pantalla siempre.

## v1.5.0 — Octubre 2026

Nuevo ranking de agendamiento por asesor. Dentro de Agendamiento (ORLANT),
la pestaña "Agendas por agente" (que solo mostraba los 12 asesores con más
citas y agrupaba al resto en "Otros") se reemplaza por "Ranking de
asesores": una tabla completa con TODOS los asesores, ordenada de mayor a
menor, que muestra la posición de cada uno, el % que representa sobre el
total, cuántas citas fueron de Línea 3P y cuántas de Línea General, el
promedio de citas por día trabajado, y cómo varió frente al mes anterior
(▲/▼). La tabla se puede ordenar por cualquier columna y buscar por
nombre de asesor; una gráfica de barras acompaña con los primeros 25 (o
todos, si son menos). Se puede exportar a Excel igual que el resto de
Agendamiento, respetando los filtros aplicados. Si el mes elegido es el
mes en curso, aparece un aviso de que el ranking todavía puede cambiar.

También se corrigió un detalle en la carga de AGENDAS: antes, una fila sin
nombre de agente se descartaba en silencio (la suma de lo cargado quedaba
por debajo del archivo real, sin ningún aviso); ahora se guarda igual,
agrupada como "Sin asesor" al final del ranking, con un aviso que dice
cuántas filas no traían agente.

## v1.4.0 — Octubre 2026

Los dashboards ahora se ven a pantalla completa, para visualizar mejor las
gráficas — antes se abrían en una ventana más chica, con espacio vacío a
los lados en pantallas grandes. También se agregó un botón opcional para
pasar a pantalla completa del navegador (oculta hasta la barra de
direcciones). El resto de las pantallas (Calidad, Cargar Datos, etc.) se
ven exactamente igual que antes.

## v1.3.2 — Octubre 2026

Sigue la revision de seguridad y de bugs de la Fase 102. Primero, 2
correcciones que en realidad ya habian salido con la v1.3.1 pero por un
error de registro no quedaron anotadas en esa nota (el PR que las trajo
se mergeo despues de subir la version, sin volver a subirla):

- Alguien con el permiso puntual de cambiar contraseñas ya no puede
  resetear la de un Administrador o Auxiliar Admin existente.
- Nadie puede otorgarse permisos a si mismo (ni por la pantalla de
  permisos ni editandose desde la de usuarios).

Y lo nuevo de esta version:

- Arreglo: una fecha que no existe en el calendario (por ejemplo "30 de
  febrero") ya no se guardaba en silencio al cargar un archivo -- ahora
  se rechaza con un aviso.

## v1.3.1 — Octubre 2026

Mejoras de seguridad y arreglos, de una revision completa de la
plataforma (Fase 102):

- La "Guía de uso" ya no se podía ver sin iniciar sesión (cualquiera con
  el enlace veía el nombre del cliente y cómo se cargan sus bases).
  Ahora pide sesión, igual que el resto de la plataforma.
- Nadie con permiso de Usuarios podía convertirse (ni convertir a otra
  persona) en Administrador o Auxiliar Admin por su cuenta — esa
  decisión ya solo la puede tomar un Administrador completo, y nadie
  puede cambiar su propio rol.
- En Calidad, un asesor con el mismo nombre que otro de una campaña
  distinta ya no podía ver ni marcar como "visto" un monitoreo que no
  era suyo; y la plantilla de evaluación de Calidad ya no se mostraba
  completa a cualquier campaña.

## v1.3.0 — Octubre 2026

Nueva "Guía de uso" — un enlace en el menú de tu usuario abre una guía
en español simple con cómo entrar, qué significa cada indicador, cómo
cargar cada base cada mes y a quién escribir si algo falla.

## v1.2.0 — Octubre 2026

Inasistencia: la vista principal ahora es el total por mes. Antes abría
por especialidad; ahora abre con una sola gráfica que compara el total de
citas contra las inasistencias de cada mes (con todas las especialidades
juntas) y el % de inasistencia. Si un mes todavía no tiene todas las
especialidades cargadas, sale un aviso debajo de la gráfica. "Por
especialidad" y "Detalle" siguen disponibles como sub-pestañas aparte.

## v1.1.3 — Octubre 2026

Arreglo (revisión final antes de entregar ORLANT): la plantilla
descargable ya no lista los 4 campos viejos de inasistencia en la hoja de
resumen (el arreglo de la versión anterior había quedado solo en el
código, sin llegarle a los datos ya guardados). También: exportar a Excel
ya no trae una hoja "KPIs" vacía en los paneles que no tienen esa franja.

## v1.1.2 — Octubre 2026

Arreglo: las opciones de los desplegables ya se leen bien.

## v1.1.1 — Octubre 2026

Arreglo: la plantilla descargable de ORLANT ya no pide los 4 campos
viejos de inasistencia por especialidad/audiología/exámenes/total en la
hoja de resumen — esa información ahora vive solo en la pestaña
Inasistencia, para que no haya dos lugares distintos con el mismo dato.

## v1.1.0 — Octubre 2026

Nueva pestaña Inasistencia en ORLANT, por especialidad y por mes. Se
puede filtrar por especialidad y por mes, ver tarjetas con el total de
citas, atendidas, canceladas, inasistencia, pendientes y el % de
inasistencia (comparado con el mes anterior), gráficas de barras y una
tabla de detalle con exportar a Excel.

## v1.0.1 — Octubre 2026

Mantenimiento: pruebas automáticas más rápidas y estables. También se
activó seguridad adicional del repositorio (nada visible para quien usa
la plataforma).

## v1.0.0 — Octubre 2026 — Entrega ORLANT

Primera version que se entrega a ORLANT. El dashboard de ORLANT ya tiene:

- **Trafico de Llamadas**: volumen, nivel de servicio y estado de las
  llamadas del mes.
- **Trafico de WhatsApp**: lo mismo que Llamadas, pero para los chats de
  WhatsApp.
- **Agendamiento**: citas agendadas por especialidad, por linea y por
  agente.
- **Tipificacion**: como se clasifico cada llamada/chat.
- **Calidad**: monitoreo de calidad de asesores, con su nota, resultados y
  cumplimiento de metas.
- **Exportar**: cualquier pantalla se puede descargar en Excel o PDF.
- **Permisos por usuario**: cada persona ve solo lo que le corresponde
  segun su rol (Administrador, Calidad, Asesor, Supervisor, etc.).
- **Dominio nuevo**: la plataforma ahora vive en
  `https://informa.inconexion.com.co` (el dominio anterior, duckdns, ya no
  se usa).

### En el modulo de Calidad, especificamente:

- La fecha del monitoreo se pone sola (la de hoy) y no se puede cambiar
  por error; lo mismo con el evaluador (siempre queda el usuario que
  inicio sesion).
- Ya se puede cargar una lista de codificaciones validas por campana (ver
  "Pendiente de datos" abajo: falta que Edwin mande la lista).
- Cuando a un asesor le registran un monitoreo nuevo, le sale un aviso la
  proxima vez que inicia sesion, con un boton para verlo.

### Pendiente de datos (no es un problema de la plataforma, falta el dato)

- El resumen general todavia no tiene todos los numeros consolidados.
- Inasistencia: falta la fuente de datos.
- WhatsApp a 5 minutos: falta que llegue el reporte con la columna
  correspondiente (Wolkvox).
- Agendas de 2026: falta la carga de datos reales de este año.
- Lista de codificaciones de Calidad: la va a mandar Edwin; en cuanto
  llegue, se carga desde Admin en unos minutos (sin tocar codigo).
