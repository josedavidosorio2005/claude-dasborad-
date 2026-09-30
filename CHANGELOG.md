# Notas de version — InConexion Platform

Este archivo explica, en palabras simples, que cambia en cada version de
la plataforma. No es un documento tecnico: es para que Edwin y Jairo
sepan que hay nuevo, que se corrigio y que falta.

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
