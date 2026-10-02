# Inventario de bases de ORLANT (Fase 112, 2026-10-02)

Estado actual de las 8 bases que alimentan el dashboard de ORLANT —
reemplaza la versión de la Fase 70/71 (2026-09-24, archivada en
`docs/historico/`), que describía un momento en el que la mayoría de
estas pestañas todavía estaban ocultas y sin datos reales. Hoy **las 7
pestañas de ORLANT tienen datos reales** (ver `CLAUDE.md` para los
números de control vigentes).

Fuentes usadas: `public/js/*-logic.js` (parseo de cada archivo, lado
navegador), `server/validation.js` (esquema Zod de cada endpoint de
carga, lado servidor).

## Las 8 bases

| Base | Hoja (archivo Excel) | Columnas | De dónde sale | Cada cuánto | Pestaña que alimenta |
|---|---|---|---|---|---|
| **Tráfico de Llamadas** | `LLAMADAS` | Columnas de Wolkvox (skill, fecha, llamadas recibidas/atendidas, `SERVICE_LEVEL_20SEC`, `SERVICE_LEVEL_5MIN`, AHT...) | Export directo de Wolkvox | Mensual | Tráfico de Llamadas |
| **Tráfico de WhatsApp** | `WHATSAPP` | Mismo patrón que Llamadas, por cola de WhatsApp | Export directo de Wolkvox | Mensual | Tráfico de WhatsApp |
| **Tipificación** | `TIPIFICACION_LLAMADAS` / `TIPIFICACION_WHATSAPP` (una hoja por canal; la hoja vieja `tipificacion` en minúscula sigue aceptándose si todavía llega así) | Categoría/código de tipificación por gestión, fecha, canal | Export de Wolkvox / sistema de Edwin | Mensual | Tipificación |
| **Agendas** | `AGENDAS` | `NOMBRE DE AGENTE`, `SEDE`, `NOMBRE_EXAMEN`, `ESPECIALIDAD`, `PROFESIONAL`, `FECHA_SOLICITUD`, `TIPO DE LINEA`, `NOMBRE_ENTIDAD` (opcional) | Sistema de agendamiento de Edwin | Mensual | Agendas (y Efectividad de Agendamiento, Ranking de asesores) |
| **Inasistencia (por cita)** | `Hoja1` (desde la Fase 108 — una fila por cita; el formato agregado viejo de las Fases 98–106 ya NO se acepta en cargas nuevas, aunque las filas ya cargadas en ese formato se conservan) | `SEDE`, `ESPECIALIDAD` (o `ESPECIALIDA`, sin la D — se tolera), `FECHA_CITA`, `NOMBRE ENTIDAD`, `CITEST` (`C`=cancelada, `I`=inasistencia, `P`=pendiente, `T`=atendida) | Sistema de agendamiento de Edwin | Mensual | Inasistencia |
| **Efectividad de Agendamiento** | `EFECTIVIDAD_AGENDAMIENTO` | `NOMBRE DE AGENTE`, `MES`, `CANTIDAD DE GESTIONES`, `AGENDAS` (la columna `EFECTIVIDAD` del archivo se ignora — siempre se recalcula en servidor) | Reporte de gestión por asesor de Edwin | Mensual | Agendamiento → Ranking de asesores (por efectividad, Fase 111) |
| **Efectividad de Citas** | `CITAS_ATENDIDAS` | `MES`, `AGENDAS`, `ATENDIDAS` (la columna `EFECTIVIDAD CITAS ATENDIDAS` del archivo se ignora — siempre se recalcula en servidor) | Sistema de agendamiento de Edwin | Mensual | Efectividad de Citas |
| **Calidad** | Registro manual (monitoreo por monitoreo, roles CALIDAD/SUPERVISOR) + carga masiva opcional (`ASESOR`, `FECHA`, `CANAL`, `ID LLAMADA`, `TELEFONO`, `EVALUADOR`, `OBSERVACIONES` + columnas dinámicas por ítem de la plantilla de evaluación) | Evaluación directa del evaluador, o carga masiva de resultados ya evaluados | Continuo (no mensual — cada monitoreo se registra cuando ocurre) | Calidad |

## Notas

- **Agendamiento, Inasistencia, Efectividad de Agendamiento y Efectividad
  de Citas** comparten todas la misma fuente de Edwin (sistema de
  agendamiento) pero son **4 archivos/hojas distintos** — no un solo
  `resumen` como en la versión vieja de este documento (ese formato
  agregado se retiró).
- El mes de cada fila se valida contra el calendario real (nunca un mes
  futuro) y contra duplicados — ver `server/validation.js` y las pruebas
  de carga de cada base (`server/tests/*-carga.test.js`).
- Las pestañas ocultas que todavía esperan datos de Edwin (no están en
  esta tabla porque no tienen base propia confirmada): Ordenamiento
  Médico, Recuperación de Cancelados, Flujo Mensual, Salida, Gestión STA
  — ver `server/dashboard-config-seed.js` (`oculta: true`).
