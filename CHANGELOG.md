# Notas de version — InConexion Platform

Este archivo explica, en palabras simples, que cambia en cada version de
la plataforma. No es un documento tecnico: es para que Edwin y Jairo
sepan que hay nuevo, que se corrigio y que falta.

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
