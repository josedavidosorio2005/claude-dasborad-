# Plantillas de carga por módulo (Fase 153, P1)

Reunión con Edwin del 16/10/2026:
- **Una plantilla por módulo, en archivos separados.** Nunca un solo Excel con hojas: cada reporte de Wolkvox tiene su propio formato, y distintas personas o áreas cargan distintos módulos.
- **El sistema reconoce cada archivo por su formato** (sus columnas), no por el nombre del archivo ni de la hoja.
- Donde el archivo nativo de Wolkvox ya sirve, la plantilla **es ese formato** con sus columnas documentadas.

**Fuente única de todo esto:**
- `scripts/plantillas/modulos.js`: archivo, hoja, descripción y ejemplo inventado de cada columna. Las columnas mismas salen del lector de cada módulo (`public/js/*-logic.js`).
- `node scripts/plantillas/generar-plantillas.js` genera `server/plantillas/PLANTILLA_<MODULO>.xlsx`.
- `node scripts/plantillas/generar-fichas.js` genera las fichas de esta carpeta.
- La prueba `server/tests/fase153-plantillas-modulos.test.js` falla si una plantilla pide algo distinto de lo que lee el sistema, si Cargar Datos no la reconoce, si su ejemplo no pasa por el lector real, o si falta una ficha de un módulo del catálogo.

Las plantillas viejas (`PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx`, `PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx` y `PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx`) siguen en su lugar mientras la pantalla actual de Cargar Datos las use.

**Más adelante (no ahora):** conectar Wolkvox por API. El reconocimiento por columnas es una función pura, sin pantalla, que recibe un encabezado y unas filas (`cargasEncabezadosCoinciden` y los `*ParseFilas` de cada módulo). Una carga que llegue por API podrá pasar por los mismos lectores, sin depender de un Excel.

## Índice (en el orden del catálogo, `server/plantillas-cliente.js`)

| Módulo | Ficha | Plantilla(s) | Lo usa hoy |
|---|---|---|---|
| Flujo de Llamadas | [flujo_llamadas](flujo_llamadas.md) | `PLANTILLA_FLUJO_LLAMADAS.xlsx` | ORLANT, MOBILIZE |
| Flujo de WhatsApp | [flujo_whatsapp](flujo_whatsapp.md) | `PLANTILLA_FLUJO_WHATSAPP.xlsx` | ORLANT |
| Calidad: resumen por asesor | [calidad_resumen](calidad_resumen.md) | `PLANTILLA_CALIDAD_RESUMEN.xlsx` | MOBILIZE |
| WhatsApp por rangos de tiempo | [whatsapp_tiempos](whatsapp_tiempos.md) | `PLANTILLA_WHATSAPP_TIEMPOS.xlsx` | ORLANT |
| Llamadas y WhatsApp de salida | [salida](salida.md) | `PLANTILLA_SALIDA_MENSUAL.xlsx` | ORLANT (pendiente de generalizar) |
| Agendas | [agendas](agendas.md) | `PLANTILLA_AGENDAS.xlsx` | ORLANT |
| Efectividad de Agendamiento | [efectividad_agendamiento](efectividad_agendamiento.md) | `PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx` | ORLANT |
| Inasistencia | [inasistencia](inasistencia.md) | `PLANTILLA_INASISTENCIA.xlsx` | ORLANT |
| Efectividad de Citas | [efectividad_citas](efectividad_citas.md) | `PLANTILLA_EFECTIVIDAD_CITAS.xlsx` | ORLANT |
| Llamadas Únicas y de Salida | [llamadas_unicas](llamadas_unicas.md) | `PLANTILLA_LLAMADAS_UNICAS.xlsx`, `PLANTILLA_LLAMADAS_SALIDA.xlsx` | MOBILIZE |
| Tipificación | [tipificacion](tipificacion.md) | `PLANTILLA_TIPIFICACION_LLAMADAS.xlsx`, `PLANTILLA_TIPIFICACION_WHATSAPP.xlsx` | ORLANT, MOBILIZE |
| Encuesta | [encuesta](encuesta.md) | `PLANTILLA_ENCUESTA.xlsx` | MOBILIZE |
| Calidad | [calidad](calidad.md) | Se descarga desde Calidad, armada con los ítems de cada campaña | ORLANT, MOBILIZE |

Las hojas manuales propias de ORLANT ("resumen" y "sta_categorias", que alimentan las pestañas de Ordenamiento médico, Recuperación de cancelados, Flujo mensual y STA) no son módulos del catálogo: siguen en la carga manual de ORLANT.

## Reciclar bases: qué se puede sacar del mismo archivo (propuesta, sin cambiar los lectores)

**Hoy Mobilize pide 6 archivos al mes**, y Edwin arma dos de ellos a mano combinando reportes:

| # | Archivo de hoy | Reporte de Wolkvox | Alimenta |
|---|---|---|---|
| 1 | Flujo de llamadas | Reporte de la cola por skill y día (`HistQueue`) | Flujo de Llamadas |
| 2 | CDR completo | CDR → "1. Detalle de las llamadas" (`HistCDR`) | Tipificación |
| 3 | Únicas de ingreso | El mismo CDR "1", **filtrado a mano** (sin salidas) | Llamadas Únicas (izquierda) |
| 4 | Salida | CDR "1" (salientes) + CDR "5. … no conectadas", **combinados a mano** | Llamadas de Salida (derecha) |
| 5 | Encuesta | Reportes → numeral 4 (`HistIVR`) | Encuesta, One & Done, FCR |
| 6 | Monitoreos de Calidad | No es Wolkvox (equipo de Calidad) | Calidad |

**Qué módulos podrían alimentarse del mismo archivo:**

| Archivo | Hoy alimenta | Podría alimentar además | Cambio que haría falta | Estado |
|---|---|---|---|---|
| CDR completo (`HistCDR`) | Tipificación | **Llamadas Únicas de ingreso**: el CDR trae AGENT_NAME, DATE, TELEPHONE y SKILL_NAME, y TYPE_INTERACTION = "inbound" separa el ingreso | Pequeño: el lector de Únicas filtra `inbound` y deduplica igual que hoy. El teléfono sigue solo en el navegador. | Propuesta |
| CDR completo (`HistCDR`) | Tipificación | **Salida conectadas**: TYPE_INTERACTION = "outbound_ma", con la regla de "no conectada" que ya usa Tipificación | Pequeño: el lector de Salida acepta el CDR y marca conectada o no conectada | Propuesta, **a validar con Edwin** que da los mismos números que su archivo combinado |
| CDR "5. … no conectadas" | (parte del archivo 4) | Salida no conectadas | Ninguno en el lector; sigue haciendo falta este reporte | Sigue siendo necesario |
| Detalle de WhatsApp (`HistQueue`, rangos de tiempo) | WhatsApp por rangos (ORLANT) | Flujo de WhatsApp: total, contestados, abandonados, nivel de servicio y ASA por día | Mediano: agregar por cola y día; el AHT no viene en ese archivo | Idea, a validar con Edwin |
| Inasistencia (una fila por cita) | Inasistencia (ORLANT) | Efectividad de Citas (agendas y atendidas del mes) | Pequeño, si "atendida" = CITEST "T" y "agendada" = toda cita del mes | Idea, **la definición la confirma Edwin** |

Las abandonadas de ingreso de Mobilize siguen sin fuente definida.

**Cuántos archivos al mes quedarían:**

| Cliente | Hoy | Con lo propuesto | Cuáles |
|---|---|---|---|
| MOBILIZE | 6 (2 armados a mano) | **5, ninguno armado a mano** | Flujo (`HistQueue`), CDR completo (Tipificación + Únicas + Salida conectadas), CDR "5" no conectadas, Encuesta (`HistIVR`), Calidad |
| ORLANT | 11 archivos de módulos (Tráfico llamadas, Tráfico WhatsApp, Tipificación llamadas, Tipificación WhatsApp, WhatsApp por rangos, Agendas, Efectividad de Agendamiento, Inasistencia, Efectividad de Citas, Salida mensual y Calidad), más sus hojas manuales | **8 a 9** | Sin Efectividad de Citas, si sale de Inasistencia, y sin Tráfico WhatsApp, si sale del detalle de WhatsApp |

Nada de esto cambia los lectores todavía. Cada cambio sería un PR aparte, con su prueba y comparando números contra el archivo de hoy.

## Mobilize, agosto de 2026: archivos que Edwin tiene que exportar

Para dejar Mobilize al día como ORLANT. Mientras no cambien los lectores, son los mismos 6 archivos de septiembre.

**Para todos los archivos:**
- Rango: **01/08/2026 a 31/08/2026**, solo la campaña o skills de Mobilize ("SKILL SAC" y "Skill Key Account").
- **Un archivo por reporte, sin cambiar los encabezados.**
- Cuando el reporte trae datos de clientes (teléfonos), el sistema los usa solo en el navegador o no los lee. Aun así, el archivo no se comparte por correo ni por chat: se sube directo a la plataforma.

| # | Archivo (nombre sugerido) | Reporte de Wolkvox | Filtros | Notas |
|---|---|---|---|---|
| 1 | `MOBILIZE_2026-08_FLUJO_LLAMADAS.xlsx` | El mismo reporte de cola por skill y día de septiembre (hoja `HistQueue<fecha>`) | Skills de Mobilize, agrupado por día | Subirlo tal cual. **Ruta exacta en el menú: confirmar con Edwin** (no está documentada) |
| 2 | `MOBILIZE_2026-08_CDR.xlsx` | Reportes → CDR → "1. Detalle de las llamadas", export completo | Campaña Mobilize, todas las columnas | Subirlo tal cual (Tipificación) |
| 3 | `MOBILIZE_2026-08_LLAMADAS_UNICAS.xlsx` | Del mismo CDR "1": solo las llamadas de **ingreso** | Quitar las de salida (número con guion). **No hace falta** quitar duplicados del mismo número el mismo día: el sistema los cuenta una vez | Columnas AGENT_NAME, DATE, TELEPHONE y SKILL_NAME. Sin filas "NO CONTESTADAS" |
| 4 | `MOBILIZE_2026-08_LLAMADAS_SALIDA.xlsx` | CDR "1" (salientes) + CDR "5. Detalle de las llamadas para las no conectadas" | Solo salientes | Columnas AGENT_NAME, DATE, TELEPHONE, DESCRIPTION_COD_ACT y SKILL_ID. SKILL_ID = "LLAMADAS DE SALIDA CONECTADAS" o "LLAMADAS DE SALIDA NO CONECTADAS" |
| 5 | `MOBILIZE_2026-08_ENCUESTA.xlsx` | Reportes → numeral 4 (hoja `HistIVR<fecha>`) | Campaña Mobilize | Subirlo tal cual; el encabezado puede estar en la fila 2. **Mes completo** |
| 6 | Monitoreos de agosto (si existen) | No es Wolkvox | — | Por el formulario de Calidad o la carga masiva |

**Antes de cargar:**
- Revisar que los skills de agosto sean los mismos dos ya asignados a Mobilize. Un skill nuevo hay que asignarlo antes.
- Procedimiento de siempre: respaldo de menos de 24 h, vista previa con conteos, y solo con el "OK cargar agosto Mobilize".
