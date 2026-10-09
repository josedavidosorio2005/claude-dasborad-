# Notas de version — InConexion Platform

Este archivo explica, en palabras simples, que cambia en cada version de
la plataforma. No es un documento tecnico: es para que Edwin y Jairo
sepan que hay nuevo, que se corrigio y que falta.

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
