# Inventario de bases de ORLANT (Fase 112, 2026-10-02; Fase 127 agrega Salida)

Estado actual de las 10 bases que alimentan el dashboard de ORLANT —
reemplaza la versión de la Fase 70/71 (2026-09-24, archivada en
`docs/historico/`), que describía un momento en el que la mayoría de
estas pestañas todavía estaban ocultas y sin datos reales. Hoy **las 7
pestañas de ORLANT tienen datos reales** (ver `CLAUDE.md` para los
números de control vigentes); la Fase 127 agrega una 8va ("Salida"),
construida y verificada con datos sintéticos — su carga real en
producción queda sujeta a la parada obligatoria de esa fase.

Fuentes usadas: `public/js/*-logic.js` (parseo de cada archivo, lado
navegador), `server/validation.js` (esquema Zod de cada endpoint de
carga, lado servidor).

## Las 10 bases

| Base | Hoja (archivo Excel) | Columnas | De dónde sale | Cada cuánto | Pestaña que alimenta |
|---|---|---|---|---|---|
| **Tráfico de Llamadas** | `LLAMADAS` | Columnas de Wolkvox (skill, fecha, llamadas recibidas/atendidas, `SERVICE_LEVEL_20SEC`, `SERVICE_LEVEL_5MIN`, AHT...) | Export directo de Wolkvox | Mensual | Tráfico de Llamadas |
| **Tráfico de WhatsApp** | `WHATSAPP` | Mismo patrón que Llamadas, por cola de WhatsApp | Export directo de Wolkvox | Mensual | Tráfico de WhatsApp |
| **Tipificación de Llamadas** | `TIPIFICACION_LLAMADAS`, o el export completo HistCDR de Wolkvox (se reconoce por encabezados — `SKILL_NAME` + `TYPE_INTERACTION` — sin importar el nombre de la hoja); la hoja vieja `tipificacion` en minúscula sigue aceptándose si todavía llega así | `AGENT_NAME`, `DATE` (fecha y hora juntas en el export completo), `DESCRIPTION_COD_ACT`, `SKILL_NAME` | Export de Wolkvox / sistema de Edwin | Mensual | Tipificación |
| **Tipificación de WhatsApp** | `TIPIFICACION_WHATSAPP`, o el export HistChat de Wolkvox (Fase 122 — hoja `HistChat<fecha>-<hora>`, cambia en cada descarga; se reconoce por encabezados: `CHANNEL`/`DATE_CLOSE`/`NOMBRE DE SKILL`, sin `SKILL_NAME`) | `AGENT_NAME`, `DATE`, `DESCRIPTION_COD_ACT`, `NOMBRE DE SKILL` (alias de `SKILL_NAME`) — el export completo trae otras ~29 columnas con datos de pacientes/asesores (teléfono, correo, DNI, comentarios...) que la plataforma NUNCA lee ni guarda | Export de Wolkvox | Mensual | Tipificación |
| **Agendas** | `AGENDAS` | `NOMBRE DE AGENTE`, `SEDE`, `NOMBRE_EXAMEN`, `ESPECIALIDAD`, `PROFESIONAL`, `FECHA_SOLICITUD`, `TIPO DE LINEA`, `NOMBRE_ENTIDAD` (opcional) | Sistema de agendamiento de Edwin | Mensual | Agendas (y Efectividad de Agendamiento, Ranking de asesores) |
| **Inasistencia (por cita)** | `Hoja1` (desde la Fase 108 — una fila por cita; el formato agregado viejo de las Fases 98–106 ya NO se acepta en cargas nuevas, aunque las filas ya cargadas en ese formato se conservan) | `SEDE`, `ESPECIALIDAD` (o `ESPECIALIDA`, sin la D — se tolera), `FECHA_CITA`, `NOMBRE ENTIDAD`, `CITEST` (`C`=cancelada, `I`=inasistencia, `P`=pendiente, `T`=atendida) | Sistema de agendamiento de Edwin | Mensual | Inasistencia |
| **Efectividad de Agendamiento** | `EFECTIVIDAD_AGENDAMIENTO` | `NOMBRE DE AGENTE`, `MES`, `CANTIDAD DE GESTIONES`, `AGENDAS` (la columna `EFECTIVIDAD` del archivo se ignora — siempre se recalcula en servidor) | Reporte de gestión por asesor de Edwin | Mensual | Agendamiento → Ranking de asesores (por efectividad, Fase 111) |
| **Efectividad de Citas** | `CITAS_ATENDIDAS` | `MES`, `AGENDAS`, `ATENDIDAS` (la columna `EFECTIVIDAD CITAS ATENDIDAS` del archivo se ignora — siempre se recalcula en servidor) | Sistema de agendamiento de Edwin | Mensual | Efectividad de Citas |
| **Salida (Llamadas y WhatsApp)** (Fase 127) | `SALIDA`, o cualquier hoja que traiga los encabezados correctos sin importar su nombre (el archivo real de Edwin trae su única hoja llamada `Hoja1`, con el encabezado en la fila 3, 2 filas vacías antes) | `MES`, `LINEA 3P`, `LINEA GENERAL`, `WHATSAPP 3P`, `WHATSAPP GENERAL` — un total agregado del mes, nunca una fila por llamada/chat | Consolidado mensual de llamadas y WhatsApp de salida de Edwin | Mensual | Salida |
| **Calidad** | Registro manual (monitoreo por monitoreo, roles CALIDAD/SUPERVISOR) + carga masiva opcional (`ASESOR`, `FECHA`, `CANAL`, `ID LLAMADA`, `TELEFONO`, `EVALUADOR`, `OBSERVACIONES` + columnas dinámicas por ítem de la plantilla de evaluación) | Evaluación directa del evaluador, o carga masiva de resultados ya evaluados | Continuo (no mensual — cada monitoreo se registra cuando ocurre) | Calidad |

## Notas

- **Agendamiento, Inasistencia, Efectividad de Agendamiento y Efectividad
  de Citas** comparten todas la misma fuente de Edwin (sistema de
  agendamiento) pero son **4 archivos/hojas distintos** — no un solo
  `resumen` como en la versión vieja de este documento (ese formato
  agregado se retiró).
- **Alias de nombre de asesor** (Fase 122): cuando la misma persona llega
  con dos nombres distintos entre Agendas/Efectividad de Agendamiento/
  Tipificación, o con una errata de tipeo puntual en Wolkvox, un
  administrador registra la equivalencia una sola vez
  (`/api/alias-asesores`, nunca por migración ni seed) — la plataforma
  guarda siempre el nombre canónico en las 3 bases. Ver
  `server/alias-asesores.js`.
- **Privacidad de `NOMBRE_ENTIDAD`** (Agendas): una entidad que aparece
  menos de 5 veces en el archivo que se está subiendo se agrupa como
  `PARTICULAR / OTRA` antes de guardarse (el umbral se calcula sobre
  TODO el archivo de una sola vez, no por mes/periodo) — confirmado
  contra el archivo real de agosto-septiembre/2026: 1.563 de 24.186
  filas agrupadas así, 1 fila sin entidad.
- El mes de cada fila se valida contra el calendario real (nunca un mes
  futuro) y contra duplicados — ver `server/validation.js` y las pruebas
  de carga de cada base (`server/tests/*-carga.test.js`).
- Las pestañas ocultas que todavía esperan datos de Edwin (no están en
  esta tabla porque no tienen base propia confirmada): Ordenamiento
  Médico, Recuperación de Cancelados, Flujo Mensual, Gestión STA — ver
  `server/dashboard-config-seed.js` (`oculta: true`). Salida ya tiene
  base propia (Fase 127) pero sigue el mismo criterio de visibilidad que
  Efectividad de Citas/Inasistencia: oculta hasta que haya datos
  cargados, nunca por decisión manual.
- **Año del MES en Salida, Efectividad de Agendamiento y Efectividad de
  Citas** (Fase 111/127): ninguno de estos 3 archivos trae año en la
  columna MES — la plataforma infiere el año más reciente en que ese mes
  no sea futuro. A diferencia de las otras 2 bases (que lo resuelven en
  silencio), Salida muestra esa resolución ("AGOSTO → Agosto 2026") en
  el modal de confirmación antes de guardar y permite corregirla — pedido
  textual de Edwin en la Fase 127.
