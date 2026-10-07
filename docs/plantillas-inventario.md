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

### Actualización — el archivo real que manda Edwin cada mes (Fase 130, Parte 4 + cierre)

El archivo real (`Copia de CALIDAD_CLINICA_ORLANT_2026 - <Mes>.xlsx`) NO es
la plantilla plana que genera "Descargar plantilla" — trae su propio
formato, con 3 hojas: **Diccionario de Ítems** (17 ítems con peso y
críticos, de referencia), **Monitoreos** (la que se carga) y **Resumen por
Asesor** (de apoyo — ver advertencia abajo, nunca se usa como fuente).

- **Encabezado real en la fila 4** (no la 1): las 3 filas de arriba son
  título/leyenda/encabezado agrupado por categoría — `cmDetectarFilaEncabezado`
  busca, entre las primeras 10 filas, la primera que resuelva ASESOR+FECHA.
- **Columnas fijas con nombre distinto al de la plantilla plana**:
  `NOMBRE DEL ASESOR` (no `ASESOR`), `ID / LLAMADA - WPP` (no `ID LLAMADA`),
  `# TELEFONO` (no `TELEFONO`) — `labelAlt` en `CM_COLUMNAS_FIJAS`
  (`calidad-carga-masiva-logic.js`) acepta ambas formas sin que Edwin tenga
  que editar el archivo.
- **Cada ítem va numerado y con su peso en el encabezado** (ej. "⚠️ 3.
  Valida entidad y derechos\n(7%)", el emoji marca los críticos) — el
  emparejamiento es por el NÚMERO al principio (`cmHeaderItemNumero`),
  robusto al emoji/salto de línea/texto exacto; cae al nombre exacto solo
  si el encabezado no trae número (la plantilla plana de siempre).
- **La hoja Monitoreos trae ~126 filas más debajo de los datos reales**,
  pre-armadas con fórmulas y sin `ASESOR` — se omiten solas (cada una
  genera un aviso "ASESOR vacío, se omitió", nunca se cuentan como dato).
- **"Resumen por Asesor" no es confiable como fuente** (al menos un
  asesor puede mostrar "# Monitoreos = 0" con un promedio distinto de 0
  por un error de fórmula de esa hoja) — por diseño, la plataforma SIEMPRE
  calcula desde `Monitoreos`, nunca lee esa hoja.
- **Datos sensibles de este archivo, ya manejados por el diseño actual**:
  `NOMBRE DEL ASESOR` y `EVALUADOR` (nombres), `# TELEFONO` e `ID /
  LLAMADA - WPP` (identificador de Wolkvox) y `OBSERVACIONES` (texto
  libre, puede traer datos de paciente). **Hallazgo para decisión del
  usuario** (no corregido en esta fase, no se cambia sin su OK): el diseño
  YA guarda `telefono` e `idLlamada` en la tabla `monitoreos` — para
  TODAS las campañas con carga masiva de Calidad, no solo ORLANT — y el
  formulario de alta manual (`cf-telefono`) también lo pide; ninguno de
  los 2 se muestra en ninguna tabla/export hoy (confirmado por lectura de
  código), pero si la regla de "nunca guardar # Teléfono" aplica hacia
  adelante, es un cambio de diseño que toca varias campañas activas, no
  solo la carga de hoy.
- **Idempotencia confirmada**: por (campaña, asesor, fecha, ID LLAMADA) —
  volver a subir el mismo archivo actualiza esos monitoreos en vez de
  duplicarlos, siempre que la fila traiga ID de llamada (en el archivo
  real de septiembre, las 95 filas lo traen).
- **Verificado contra el archivo real de septiembre/2026** (solo
  encabezados/tipos/conteos, nunca una fila): 95 monitoreos reconocidos,
  19 asesores distintos, 1 evaluador, un solo mes (2026-09), 17 ítems
  todos emparejados por número. El PUNTAJE OBTENIDO que trae el archivo
  (fórmula de Excel, valor guardado) coincide EXACTO, fila por fila, con
  el recálculo del servidor usando la rúbrica activa de ORLANT (promedio
  94,79 en ambos lados) — la clasificación recalculada también coincide
  con lo esperado (82 SOBRESALIENTE / 13 NO CRÍTICO, 93 sin fallos
  críticos / 2 con 1 crítico).
