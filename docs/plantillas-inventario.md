# Inventario de plantillas vs. lo que realmente se sube (Fase 124, 2026-10-06)

**Solo lectura — no construye nada.** Insumo para la fase de plantillas
oficiales versionadas que Edwin pidió dejar explícitamente para después
de la entrega ("eso lo vemos después"). Objetivo de esa fase futura: una
carpeta con una plantilla oficial por base, versionada, para que Isabel
(quien maneja Wolkvox) pueda descargar, pegar el export y subir sin
ayuda de InCo. Este documento reúne, por cada una de las 9 bases, 3
columnas: qué plantilla descarga hoy la plataforma (si existe), qué
exige realmente el lector (`public/js/*-logic.js` +
`server/validation.js`), y qué manda Edwin/Wolkvox en la práctica hoy.

## Resumen por base

| Base | ¿Plantilla descargable hoy? | Qué exige el lector real | Qué manda Edwin/Wolkvox en la práctica |
|---|---|---|---|
| **Tráfico de Llamadas** | Sí — `GET /calidad/trafico/plantilla` sirve `server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx` tal cual (archivo real, no generado al vuelo) | Hoja `LLAMADAS` (o cualquiera con encabezados `SKILL_NAME`+`DATE`+`INBOUND_CALLS`); acepta tanto el formato "período" viejo como el formato DIARIO real de Wolkvox (Fase 115/116) | Export diario real de Wolkvox, hoja `Hoja1`, con `WAIT_TIME`/`AHT` como fecha boxeada por SheetJS — la plantilla descargable NO es la que Edwin manda en la práctica (son 2 formatos distintos que el lector reconcilia) |
| **Tráfico de WhatsApp** | Sí — `GET /calidad/trafico/whatsapp/plantilla` sirve `PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx` | Mismo patrón que Llamadas, por cola; ASA/ATA/AHT en TEXTO con separador de miles inglés en el formato diario (no fracción de día) | Export diario real de Wolkvox, mismo desajuste que Llamadas: la plantilla descargable no es el formato que realmente llega |
| **Tipificación de Llamadas** | **No existe** ningún botón/ruta de descarga | Hoja `TIPIFICACION_LLAMADAS` **o** el export completo HistCDR de Wolkvox, reconocido por encabezados (`SKILL_NAME`+`TYPE_INTERACTION`), sin importar el nombre de la hoja | Export completo **HistCDR** de Wolkvox tal cual (hoja con nombre tipo `HistCDR<fecha>-<hora>`, ~29 columnas de las que solo se leen 4) — Edwin nunca usó una plantilla simplificada, siempre mandó el export nativo |
| **Tipificación de WhatsApp** | **No existe** | Hoja `TIPIFICACION_WHATSAPP` **o** el export **HistChat** de Wolkvox (Fase 122 — hoja `HistChat<fecha>-<hora>`, cambia en cada descarga; se reconoce por `CHANNEL`/`DATE_CLOSE`/`NOMBRE DE SKILL`) | Export completo HistChat de Wolkvox, con ~29 columnas de datos de pacientes/asesores que la plataforma nunca lee ni guarda | Igual que Llamadas: siempre fue el export nativo, nunca una plantilla simplificada |
| **Agendas** | **No existe** | `NOMBRE DE AGENTE`, `SEDE`, `NOMBRE_EXAMEN`, `ESPECIALIDAD`, `PROFESIONAL`, `FECHA_SOLICITUD`, `TIPO DE LINEA`, `NOMBRE_ENTIDAD` (opcional) | Export nativo del sistema de agendamiento de Edwin, hoja `AGENDAS` — mismo formato desde la Fase 79/80 |
| **Inasistencia** | **No existe** | `Hoja1` (una fila por cita): `SEDE`, `ESPECIALIDAD`/`ESPECIALIDA`, `FECHA_CITA`, `NOMBRE ENTIDAD`, `CITEST` (C/I/P/T) | Export nativo del sistema de agendamiento, formato "por cita" desde la Fase 108 (el formato agregado viejo de las Fases 98-106 ya no se acepta en cargas nuevas) |
| **Efectividad de Agendamiento** | **No existe** | Hoja `EFECTIVIDAD_AGENDAMIENTO`: `NOMBRE DE AGENTE`, `MES`, `CANTIDAD DE GESTIONES`, `AGENDAS` (columna `EFECTIVIDAD` se ignora, se recalcula) | El archivo real de Edwin trae su hoja como `Hoja1` (reconocida igual por encabezados) |
| **Efectividad de Citas** | **No existe** | Hoja `CITAS_ATENDIDAS`: `MES`, `AGENDAS`, `ATENDIDAS` (columna `EFECTIVIDAD CITAS ATENDIDAS` se ignora) | Pendiente el archivo de agosto-septiembre/2026 (ver `docs/pendientes.md` → sección 2) — el de enero-marzo/2026 llegó con esta misma forma |
| **Calidad** | No aplica (no es una "plantilla de carga" — `GET /calidad/plantillas` devuelve la rúbrica de evaluación por campaña, no un Excel para subir) | Carga masiva opcional: `ASESOR`, `FECHA`, `CANAL`, `ID LLAMADA`, `TELEFONO`, `EVALUADOR`, `OBSERVACIONES` + columnas dinámicas por ítem de la rúbrica | El registro real es manual (monitoreo por monitoreo); la carga masiva existe en el código pero no se ha usado con un archivo real de Edwin todavía |

## Lo que esto significa para la fase de plantillas (futura)

- **7 de las 9 bases no tienen ninguna plantilla descargable hoy** — la
  razón histórica (ver `docs/pendientes.md` original, Fase 122) es que
  "hoy InCo carga por código": alguien de InCo reconoce el archivo real
  de Edwin/Wolkvox y lo sube, así que nunca hizo falta que Edwin descargara
  nada. Si Isabel va a subir ella misma sin ayuda de InCo, ella necesita
  una plantilla que coincida con lo que YA manda Wolkvox (HistCDR/HistChat/
  diario), no una plantilla simplificada nueva — el lector ya sabe leer el
  formato real, así que la plantilla "oficial" de esas bases debería ser,
  literalmente, un ejemplo del export real de Wolkvox con datos ficticios,
  no una tabla nueva de 4 columnas.
- **Las 2 plantillas que SÍ existen (Tráfico) tampoco coinciden con el
  formato real** que manda Wolkvox hoy (formato diario vs. la plantilla de
  período) — quedarían desactualizadas por la misma razón: el lector se
  adaptó al archivo real en vez de pedirle a Wolkvox que cambiara su
  export.
- Antes de construir nada (pedido explícito de Edwin, además): reunir con
  él/Isabel qué exporta Wolkvox hoy exactamente para cada una de las 9
  bases y confirmar que coincide con la columna "en la práctica" de esta
  tabla — esta tabla sale de lo que InCo ha recibido hasta ahora, no de
  una confirmación nueva con Wolkvox.
