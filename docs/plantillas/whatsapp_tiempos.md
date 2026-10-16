# WhatsApp por rangos de tiempo

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `whatsapp_tiempos` (grupo opcional)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** Tiempos de respuesta de WhatsApp (Wolkvox)
- **Necesita el módulo:** `flujo_whatsapp`

## De dónde sale

Wolkvox: detalle de conversaciones de WhatsApp (hoja "HistQueue<fecha>"). La columna TIEMPO y la hoja de tabla dinámica se ignoran.

## Plantilla oficial

`server/plantillas/PLANTILLA_WHATSAPP_TIEMPOS.xlsx` — hoja `WHATSAPP_TIEMPOS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| SKILL_NAME | Sí | Cola (solo cuentan las que empiezan por WHATSAPP). |  |
| DATE | Sí | Fecha y hora de la conversación. |  |
| RESULT | Sí | Resultado: solo cuentan las ANSWER (contestadas). |  |
| ANSWER_TIME | Sí | Segundos hasta que se contestó. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Las fechas que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| SKILL_NAME | DATE | RESULT | ANSWER_TIME |
|---|---|---|---|
| WHATSAPP GENERAL | 2026-08-01 09:05 | ANSWER | 140 |

## Notas

- Es una sub-vista de Flujo de WhatsApp (Nivel de Servicio por rangos de minutos: 0-3, 3-5, 5-8, 8-10, más de 10).
- Solo cuentan las colas cuyo nombre empieza por WHATSAPP y las filas con RESULT = ANSWER; el resto se ignora y la vista previa dice cuántas.
- El rango lo calcula el sistema con ANSWER_TIME; la columna TIEMPO del archivo se ignora.
