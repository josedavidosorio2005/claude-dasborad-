# Encuesta

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `encuesta` (grupo opcional)
- **Lo usa hoy:** MOBILIZE
- **Carga que necesita:** HistIVR (Wolkvox)

## De dónde sale

Wolkvox: Reportes → numeral 4 (hoja "HistIVR<fecha>"), export completo de 25 columnas. Se sube tal cual, sin armar nada a mano: el encabezado se busca en las primeras filas, y el teléfono (ANI), AGENT_DNI y CUSTOMER_ID nunca se leen ni se guardan.

## Plantilla oficial

`server/plantillas/PLANTILLA_ENCUESTA.xlsx` — hoja `ENCUESTA` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| AGENT_NAME | Sí | Asesor de la llamada encuestada. |  |
| AGENT_DNI | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| SKILL_ID | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| SKILL_NAME | Sí | Línea o skill. |  |
| DATE | Sí | Fecha de la encuesta. |  |
| CONN_ID | No | ID de la llamada en Wolkvox. Sale junto a cada comentario y en el Excel; si un archivo no lo trae, queda vacío. |  |
| ANI | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CUSTOMER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| Q01 | Sí | Pregunta 1, de 0 a 10. "-" = sin respuesta. |  |
| Q02 | Sí | Pregunta 2, de 1 a 5. |  |
| Q03 | Sí | Pregunta 3: 1 = Sí, 2 = No (base de One & Done y FCR). |  |
| Q04 | Sí | Pregunta 4, de 1 a 5. |  |
| Q05 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| Q06 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| Q07 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| Q08 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| Q09 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| Q10 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| VOICE_MESSAGE_DURATION | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TYPE_INTERACTION | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| RESULT | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| VOICE_MESSAGE | No | Comentario (opcional). |  |
| FEELING | No | Viene en el export de Wolkvox; el sistema no la usa. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Todo lo que exista entre la primera y la última fecha del archivo. Suba siempre el mes completo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| AGENT_ID | AGENT_NAME | AGENT_DNI | SKILL_ID | SKILL_NAME | DATE | CONN_ID | ANI | CUSTOMER_ID | Q01 | Q02 | Q03 | Q04 | Q05 | Q06 | Q07 | Q08 | Q09 | Q10 | VOICE_MESSAGE_DURATION | TYPE_INTERACTION | RESULT | TIME | VOICE_MESSAGE | FEELING |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0000 | Asesor Ejemplo Uno | 0000000000 | 101 | SKILL SAC | 2026-08-01 10:20 | A1B2C3D4 | 3000000001 | - | 9 | 5 | 1 | 4 | - | - | - | - | - | - | 0 | inbound | - | 0 | Buena atención | - |

## Notas

- El archivo real trae una fila de textos antes del encabezado; el sistema lo busca en las primeras 20 filas. La hoja de tabla dinámica se ignora.
- "-", "--" o vacío = sin respuesta. Un valor fuera de rango queda como sin respuesta, con aviso.
- Los textos de las preguntas no se leen del archivo: son configuración del sistema.
- Suba siempre el mes completo: los días del rango que no vengan en el archivo quedan en blanco.
