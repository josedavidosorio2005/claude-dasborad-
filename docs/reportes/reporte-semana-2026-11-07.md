# Reporte de avances — semana del lunes 02/11 al sábado 07/11 de 2026

Para Edwin y la gerencia de InConexion.

## 1. Resumen

- Empezamos la semana con la versión **1.112.0** y la terminamos con la **1.144.8**: se
  publicaron **63 versiones**.
- Lo más importante: **Clínica Aurora** y **Hospital La María** quedaron preparadas para su
  entrega, con las mismas pestañas que ORLANT. Además, **Mobilize** tiene su módulo de
  **Calidad** igual al modelo de Edwin, y los supervisores tienen un **perfil propio** con el
  que cargan las bases de sus clientes.
- Se hicieron **dos revisiones de calidad** (03/11 y 07/11), y se corrigieron sus fallas que no
  dependían de una decisión de Edwin. La plataforma también abre más rápido: ORLANT pasó de
  unos 4 segundos a menos de 1 segundo la primera vez después de cada actualización.

## 2. Avances por cliente

### ORLANT

**Nuevo**
- **Tipificación más simple.** Ya no tiene la fila de filtros de arriba ni los títulos
  «Salida de…»: el mes sale del selector de meses del tablero, y cada mitad (Llamadas y
  WhatsApp) tiene su propio filtro de Línea (General / 3P).
- **Tarjetas de Tráfico de Llamadas y de WhatsApp en el orden pedido**: Ingresadas,
  Contestadas, Abandonadas, Nivel de servicio (20 s), Nivel de atención y Tasa de abandono.
- La tarjeta «Efectividad de Agendamiento» ya no sale en Cargar datos (la pestaña se ve igual
  y no se borró nada).

**Corregido**
- Tipificación con meses que no van seguidos (por ejemplo, agosto y octubre): la torta y las
  tarjetas también contaban septiembre. Ahora cuentan solo los meses elegidos.
- El tablero abre más rápido (ver «Velocidad» en la sección 3).

### Mobilize

**Nuevo**
- **Flujo de Llamadas**: 8 tarjetas en una sola fila, cada una solo con el número y el título
  (pedido de Edwin), en el mismo orden que ORLANT, con Eficacia y «Solución en primer contacto»
  al final.
- **Llamadas Únicas y de Salida**: sin las tablas «De dónde sale cada mes» (la información
  sigue en Exportar) y con la tarjeta nueva «Tasa de contacto llamadas de salida».
- **NPS** solo con su valor y la fórmula. En Cargar datos ya no salen la «Calidad» vieja ni la
  «Tipificación de WhatsApp» (no se borró ningún dato).
- **Calidad igual al modelo de Edwin** (ver «Calidad» en la sección 3): plantilla de 14 ítems
  importada como la principal, formulario «Calificar», «Resultados del equipo», «Resumen por
  asesor», «Detalle por mes» y «Diccionario».

**Corregido**
- «Flujo por hora» mostraba un cuadro vacío debajo de las tablas; ya no aparece.
- El «Diccionario» de Calidad mostraba la plantilla vieja (10 ítems); ahora muestra la
  principal, de 14.

### Clínica Aurora

**Nuevo**
- Las **mismas pestañas que ORLANT** para el tráfico: Tráfico de Llamadas, Tráfico de
  WhatsApp, Total tráfico, salida, Tipificación y WhatsApp por rangos de tiempo.
- **Agendas por usuaria**: las citas por asesora de InConexion, con su nombre real, sacadas
  del reporte de citas de la clínica. Tiene 3 vistas (por mes, por especialidad y por asesora)
  y filtros por sede, asesora, fecha de solicitud y fecha de la cita. El reporte de octubre se
  cargó con la autorización del usuario (1.678 citas). **Ojo:** Edwin avisó que esa base no es
  la definitiva (ver la sección 5).
- **Errores** (pestaña nueva, con el modelo «Flujo de errores por mes» de Edwin): la línea de
  errores por mes, el plan de acción del mes y los errores de cada asesora. Solo los registran
  el supervisor del cliente y el administrador; la cuenta del cliente solo los ve. Al probarla,
  Edwin pidió un solo botón «Guardar» y la lista de errores en una sección aparte: ya está
  hecho.
- **Tipificación**: sin la Línea General / 3P ni la clasificación de asesores, que Aurora no
  usa. El filtro de WhatsApp muestra el nombre de 3 colas en vez de su número («Whatsapp de
  entrada», «Confirmaciones whatsapp» y «Recordaciones 3 dias»).
- **Llamadas y WhatsApp de salida**: solo con el total.
- **Calidad**: la plantilla de Aurora (12 ítems) está cargada en producción.
- **Logo de Aurora** en blanco en el encabezado del tablero.

**Corregido**
- El WhatsApp de salida solo contaba una cola. Ahora suma también Confirmaciones y
  Recordaciones: de julio a octubre pasó de 4.074 a 17.166 conversaciones.
- La primera carga del reporte de citas leía 0 citas por el formato de las fechas del archivo;
  se arregló antes de guardar nada.

### Hospital La María

**Nuevo**
- Las **mismas pestañas que ORLANT** para el tráfico: Tipificación, salida, Total tráfico y
  WhatsApp por rangos de tiempo. Por ahora usa la regla de salida de ORLANT, de forma
  provisional, hasta que Edwin confirme la suya.
- **Calidad**: las 2 plantillas (Sede Castilla, 12 ítems, como principal; Sede 33, 7 ítems)
  están cargadas en producción.
- **Nivel de servicio de WhatsApp igual que ORLANT**: mientras no se carguen los tiempos de
  respuesta, muestra un aviso con el archivo que hay que subir.

**Datos:** sigue solo con el tráfico de **agosto** (ver la sección 5).

### SURA (Televentas)

**Nuevo**
- El usuario del cliente quedó creado y verificado: ve sus 6 pestañas en modo de solo lectura,
  sin los botones de cargar, reemplazar, borrar ni descargar.
- El tablero ya no tiene «Cargar información»: la carga se hace en Cargar datos, como en los
  demás clientes.
- SURA ya sale como disponible en el Portal Supervisor (antes decía «Próximamente»).

**Corregido**
- La base inicial ahora le llega al cliente solo con las 10 columnas que usa el tablero (antes
  le llegaba completa).
- Protección contra textos maliciosos en los archivos que se cargan.
- Al abrir el tablero ya no aparece por un instante la pantalla de carga: se ve «Cargando el
  tablero…» hasta que está listo.
- Al cambiar de cliente en Cargar datos, la sección de SURA se quedaba en pantalla; ya no.
- En el celular, la pestaña Agentes ya no se desplaza de lado.

## 3. Plataforma en general

**Perfil del supervisor**
- El supervisor tiene ahora su propia lista, «Clientes que supervisa». Solo ve esos clientes,
  no ve las pestañas ocultas del administrador y puede cargar todas las bases de sus clientes,
  pero las de ningún otro.
- Las 2 cuentas de supervisor que ya existían pasaron al perfil nuevo con la autorización del
  usuario. No perdieron ni ganaron tableros; ganaron la carga de bases de sus clientes. Una
  tercera cuenta, la supervisora de Aurora y HLM, se creó ya con el perfil nuevo.
- Falta que Edwin lo revise al entrar con su cuenta (no se probó con su sesión).

**Usuarios**
- Un usuario nuevo nace **sin ningún cliente marcado** (antes nacía con todos), y nadie puede
  dar acceso a un cliente que él mismo no tiene.
- Filtros por rol y por cliente, buscador y conteo en la lista de usuarios.
- Al crear un usuario, el aviso dice exactamente qué sobra (una tilde, una ñ, un espacio, el
  largo).
- Botones «Marcar todo» y «Ninguno» en el selector de meses y en las listas largas.
- La cuenta de Edwin muestra su nombre completo en el encabezado.

**Calidad**
- Se puede tener **varias plantillas por cliente**, con acceso por plantilla, y el
  administrador importa una plantilla con vista previa antes de guardarla.
- Calidad aparece en el menú del administrador. El formulario «Calificar» es como el modelo de
  Edwin, y la persona de Calidad ve solo lo que ella misma califica.
- En Mobilize, Aurora y HLM, la pestaña Calidad del tablero muestra «Resultados del equipo»
  como el modelo de Edwin. Los números se comprobaron contra su propio archivo con los mismos
  datos de prueba.
- El aviso al asesor se actualiza solo cada 3 minutos, y la pestaña Calidad cada 5.

**Seguridad y privacidad**
- La cuenta del cliente ya no recibe de Calidad el nombre del evaluador, las observaciones ni
  el motivo.
- En **Aurora y HLM** el cliente no ve ningún nombre de asesora en ninguna pestaña: sale
  «Asesor 1, 2…». En ORLANT y Mobilize se siguen viendo, por decisión del usuario.
- Las observaciones de Calidad y de Errores se revisan para frenar números de documento o de
  teléfono de pacientes. Las fechas («15-10-2026») ya no se confunden con esos números.
- El reporte de citas de Aurora se resume en el computador de quien lo carga: a la plataforma
  no llega ningún dato de pacientes, solo conteos.
- Las fechas y horas se muestran en **hora de Colombia** (antes algunas salían 5 horas
  adelantadas, y desde las 7 p. m. algunas pasaban al día siguiente). Las fechas escritas como
  día/mes/año se leen bien.
- Un supervisor ya no puede quedar con permiso de cargar bases de todos los clientes.

**Velocidad**
- **ORLANT, primera apertura después de cada actualización: de 4,2 s a 0,8 s.** Ahora la
  plataforma prepara las listas de los filtros sola al arrancar.
- **Tipificación de ORLANT: de 3,1 s a 1,4 s** hasta ver las 2 tortas (0,4 s la segunda vez).
  Con los datos reales se comprobó que los números son exactamente los mismos.

**Otros**
- El encabezado de los tableros ya no tiene la línea «Informe…».
- Flujo de WhatsApp se puede ver por día.
- En la gráfica de Abandono, cada barra muestra la cantidad y el %, y la línea del % ya no se
  monta sobre las etiquetas.
- Los ejes de las gráficas usan punto de miles (1.000), como las tarjetas.

## 4. Revisión de calidad

**Fallas encontradas y corregidas esta semana**

| Revisión | Qué se corrigió | Qué quedó abierto |
|---|---|---|
| 03/11 | 5 fallas: usuarios nuevos con todos los clientes marcados; fechas día/mes leídas al revés; fechas corridas al día siguiente desde las 7 p. m.; «mes actual» en otra zona horaria; base inicial de SURA completa al cliente. Además, protección de SURA contra textos maliciosos, un cálculo de Gestión Humana y el mes recién cargado que no salía en el filtro | 4 de baja prioridad o que funcionan así a propósito |
| 07/11 (15 hallazgos) | 8: privacidad de Calidad para el cliente; fechas confundidas con datos de pacientes; «72,97 %» con coma; «Ninguno» en Calidad igual a «Todos»; permiso de carga del supervisor; fechas de creación en hora de Colombia; Agentes de SURA en el celular; y la demora al abrir ORLANT | 3 por datos o cuentas que faltan (#2, #3 y #4, todos de Aurora y HLM; #2 y #3 se cargan con lo que mande Edwin) y 4 que decide Edwin (#1, #6, #8, #9; ver la sección 5) |

También se corrigieron durante la semana, fuera de las dos revisiones: Tipificación con meses
que no van seguidos, el cuadro vacío de Flujo por hora, el Diccionario de Mobilize, la
pantalla de carga que se veía al abrir SURA, el WhatsApp de salida de Aurora, la lectura de
fechas del reporte de citas y la línea de Abandono sobre las etiquetas.

**Pruebas automáticas.** Hay **2.746**; empezamos la semana con 2.438. Todas pasan, y la
revisión de seguridad de las librerías da **0 vulnerabilidades**. Cada cambio pasó por las
pruebas antes de publicarse.

**Verificación en producción.** Después de cada publicación se revisó la plataforma real con
la sesión del administrador, en computador (1440 px) y celular (375 px): los 5 clientes con
sus pestañas, 0 errores, 0 cambios no pedidos y sin escribir nada salvo las cargas autorizadas.
Lo que **no** se pudo probar en producción, por no tener la clave de esas cuentas:
- la vista de la cuenta del cliente en Calidad (la cubren las pruebas automáticas);
- la vista de un supervisor (la cubren las pruebas y una revisión local).

## 5. Pendientes para la entrega de Aurora y HLM (lunes 09/11; reunión con el cliente el martes 10/11)

### Lo que necesitamos de Edwin

- **Aurora, agendas:** las **3 bases definitivas** (la que se cargó no lo era), cómo se juntan
  y qué meses se recargan. Se revisa con él el lunes 09/11. No se recarga ni se borra nada sin
  esos archivos y la autorización del usuario.
- **HLM, datos que faltan:** el tráfico de **septiembre y octubre**, el detalle de llamadas
  (HistCDR) y de WhatsApp (HistChat) de Wolkvox, y el reporte «10. Detalle de llamadas
  contestadas» de las colas de WhatsApp (para el Nivel de servicio por rangos). Hoy HLM solo
  tiene agosto.
- **Aurora, tiempos de respuesta de WhatsApp:** el mismo reporte «10. Detalle de llamadas
  contestadas». Hoy Aurora muestra el aviso de que falta (por confirmar si sigue faltando).
- **Salida de HLM:** cómo se marca la salida en su Wolkvox y si tiene líneas General / 3P. Hoy
  usa la regla de ORLANT de forma provisional.
- **Calidad de los dos:** cuál sede de HLM es la principal (hoy Castilla); si quiere los campos
  «ID de agente» y «Motivo de afectación» como en su modelo; si los 3 ítems críticos de la
  Sede 33 están bien con su peso; las listas de codificación (hoy son texto libre); y quién
  califica en cada campaña.
- **Agendas por usuaria (lectura):** si cuentan las confirmaciones o las citas creadas; si
  «No contesta» va aparte; si el mes es el de la cita o el de la confirmación; si el mismo
  reporte sirve para HLM; y si hay una lista cerrada de motivos (hoy hay 28 «Otro»).
- **Nombres de 2 colas de WhatsApp de Aurora** que todavía salen con su número. Es algo menor:
  tienen 2 y 1 chats.
- **Logo de HLM**, si lo quiere en el encabezado.

### Decisiones por tomar

- **Qué pestañas ve el cliente de cada clínica.** Hoy el cliente de **HLM solo ve «Total
  tráfico»**. El de **Aurora** no ve «Llamadas y WhatsApp de salida», «Agendas por usuaria»,
  «Tipificación» ni «Calidad», aunque su «Total tráfico» sí suma la salida. Encenderlas es un
  cambio pequeño una vez decidido.
- **Errores de Aurora:** si el cliente debe ver los nombres de las asesoras. Hoy los ve, como
  en el modelo de Edwin, pero va en contra de la regla de Aurora de no mostrar nombres al
  cliente. Hoy hay 0 errores registrados.
- **Si Calidad entra en la entrega.** Si entra, hay que crear las cuentas de asesor (y de
  Calidad, si aplica) de Aurora y HLM. Hoy no hay ninguna, y sin ellas no se puede calificar.
  Se crean por la plataforma con la autorización del usuario.
- **Agendas de Aurora:** no mostrarlas al cliente hasta recargar las bases definitivas.

Otras decisiones de Edwin que no bloquean esta entrega: la salida de Mobilize que no cuadra
entre pestañas, y si se vuelve a calificar el único monitoreo de Mobilize con la plantilla
nueva.

### Lo que no está construido

- **La unión de las 3 bases de agendas de Aurora.** Depende de qué bases sean; hoy la
  plataforma lee un solo reporte.
- **Agendas por usuaria y Errores para HLM:** hoy solo existen en Aurora. Encenderlos en HLM es
  un cambio pequeño, si Edwin lo pide.
- **HLM por sede** (Castilla / Sede 33) en el tráfico: hoy es un solo cliente, sin sedes.
- **Errores sin nombres para el cliente**, si Edwin decide que no los vea.
- **Campos extra y listas cerradas de Calidad** («ID de agente», «Motivo de afectación»,
  listas de codificación), si Edwin los quiere.
