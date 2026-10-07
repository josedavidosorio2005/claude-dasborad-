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

## Calidad de ORLANT — qué necesita Edwin para la carga real (Fase 128, Parte 3)

Confirmado en la reunión de hoy: los 37 monitoreos de Calidad de ORLANT
en producción son de prueba (se retiran en esta misma fase, ver
`docs/pendientes.md`); Edwin entrega los datos reales de Calidad mañana.
No hace falta construir nada nuevo — **la carga masiva de Calidad ya
funciona para ORLANT sin cambios de código**, con la misma plantilla y
mecanismo que ya usa "CARTERA INTERNA" (la primera campaña con este
camino, ver README.md §13): ORLANT ya tiene su propia rúbrica activa
(`ITEMS_ORLANT`, 17 ítems, `server/calidad-plantillas-seed.js`) desde
antes, y la carga masiva (`public/js/calidad-carga-masiva.js`,
`POST /api/monitoreos/bulk`) nunca estuvo limitada a una sola campaña —
cualquier campaña con rúbrica activa ya la tiene disponible.

**Cómo lo sube Edwin (o quien registre los monitoreos reales), por la
interfaz normal — nunca un archivo a mano por fuera de esto:**
1. Módulo **Calidad** → campaña **ORLANT** → pestaña **"Carga Masiva
   (Excel)"** → botón **"Descargar plantilla"**.
2. El archivo trae 3 hojas: **Monitoreos** (la única que se procesa — una
   fila por monitoreo real), **Diccionario** (de referencia: ítem,
   categoría, peso %, crítico — los 17 de ORLANT) y **Resumen por
   Asesor** (de apoyo, se calcula solo).
3. Columnas fijas de la hoja Monitoreos: `ASESOR`, `FECHA` (obligatorias),
   `CANAL`, `ID LLAMADA`, `TELEFONO`, `EVALUADOR`, `OBSERVACIONES`
   (opcionales) — más una columna `SI`/`NO`/`N/A` por cada uno de los 17
   ítems de la rúbrica de ORLANT (el encabezado exacto de cada columna es
   el texto del ítem, tal cual aparece en la hoja Diccionario).
4. El puntaje/clasificación/fallos se calculan siempre en el servidor
   (`calidad-logic.js`) a partir de las respuestas — nunca se suben ni se
   confían los que traiga el archivo.
5. Es idempotente por (campaña, asesor, fecha, ID LLAMADA) cuando la fila
   trae un ID de llamada — volver a subir el mismo archivo actualiza esos
   monitoreos en vez de duplicarlos (igual que Cartera Interna). Sin ID de
   llamada, esas filas siempre se insertan.

No se necesita ninguna fase nueva ni pantalla nueva para esto — es
exactamente el mismo camino que ya existe, simplemente nunca se había
usado con un archivo real de ORLANT hasta ahora.
