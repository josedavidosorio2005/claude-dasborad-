# Notas de version — InConexion Platform

Este archivo explica, en palabras simples, que cambia en cada version de
la plataforma. No es un documento tecnico: es para que Edwin y Jairo
sepan que hay nuevo, que se corrigio y que falta.

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
