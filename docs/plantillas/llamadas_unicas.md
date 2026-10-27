# Llamadas Únicas y de Salida

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `llamadas_unicas` (grupo opcional)
- **Lo usa hoy:** MOBILIZE
- **Carga que necesita:** Llamadas únicas + Llamadas de salida (Wolkvox)

## Llamadas abandonadas

### De dónde sale

Wolkvox: Skills y servicios → "Detalle de llamadas abandonadas" (hoja "HistQueue<fecha>"). Se sube tal cual.

**Este módulo lleva 2 archivos de Wolkvox, cada uno en su propia carga del Centro de cargas: (1) "Abandonadas" (esta plantilla). (2) "No conectadas". Las contestadas únicas y la salida conectada salen del CDR que se sube en Tipificación. Un teléfono cuenta una vez por día; otro día vuelve a contar.**

### Plantilla oficial

`server/plantillas/PLANTILLA_LLAMADAS_ABANDONADAS.xlsx` — hoja `LLAMADAS_ABANDONADAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| CONN_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| SKILL_ID | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| SKILL_NAME | Sí | Línea o skill. |  |
| DATE | Sí | Fecha y hora de la llamada abandonada. |  |
| RESULT | No | Solo cuenta "ABANDON". |  |
| ANI | Sí | Teléfono que llamó. Solo se usa en el navegador para contar una vez por día; nunca se envía ni se guarda. |  |
| ABANDON_TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TYPE_INTERACTION | No | Solo cuenta "inbound". |  |
| CUSTOMER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las abandonadas entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| CONN_ID | SKILL_ID | SKILL_NAME | DATE | RESULT | ANI | ABANDON_TIME | TYPE_INTERACTION | CUSTOMER_ID |
|---|---|---|---|---|---|---|---|---|
| EJEMPLO-0001 | 101 | SKILL SAC | 2026-08-01 09:30 | ABANDON | 3000000001 | 12 | inbound | - |

## Llamadas de salida no conectadas

### De dónde sale

Wolkvox: Reportes → CDR → "5. Detalle de las llamadas para las no conectadas" (hoja "HistCDR<fecha>"). Se sube tal cual.

**Este módulo lleva 2 archivos de Wolkvox, cada uno en su propia carga del Centro de cargas: (1) "Abandonadas". (2) "No conectadas" (esta plantilla). Cada fila es una llamada no conectada: no se quitan repetidas.**

### Plantilla oficial

`server/plantillas/PLANTILLA_LLAMADAS_NO_CONECTADAS.xlsx` — hoja `LLAMADAS_NO_CONECTADAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor que hizo la llamada. Vacío = "Sin asesor". |  |
| DATE | Sí | Fecha y hora de la llamada. |  |
| DESTINY | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| TELEPHONE | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| RING_TIME | Sí | Segundos que timbró (solo para reconocer el reporte). |  |
| RESULT | Sí | Resultado de la llamada (solo para reconocer el reporte). |  |
| TYPE_INTERACTION | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| CUSTOMER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CAMPAIGN_ID | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| AGENT_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CONN_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las no conectadas entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | DESTINY | TELEPHONE | RING_TIME | RESULT | TYPE_INTERACTION | CUSTOMER_ID | CAMPAIGN_ID | AGENT_ID | CONN_ID |
|---|---|---|---|---|---|---|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 10:15 | 3000000001 | 3000000001 | 20 | NO ANSWER | outbound_ma | - | 0 | 0000 | EJEMPLO-0002 |

## Notas

- Fase 194: el módulo lleva dos reportes de Wolkvox, subidos tal cual: "Abandonadas" (Detalle de llamadas abandonadas) y "No conectadas" (5. Detalle de las llamadas para las no conectadas). Las contestadas únicas y la salida conectada salen del CDR que se sube en Tipificación.
- Abandonadas: un teléfono (ANI) cuenta una vez por día; otro día vuelve a contar. Un mes sin este reporte muestra 0.
- No conectadas: cada fila es una llamada, sin quitar repetidas. Un mes con CDR y sin este reporte dice "Pendiente" en no conectadas y en el total de salida.
- Privacidad: el teléfono (ANI, TELEPHONE) solo se usa en el navegador de quien sube el archivo; nunca llega al servidor, nunca se guarda ni se muestra.
- Las cargas viejas (plantilla de ingreso y plantilla de salida) se retiraron del Centro; lo ya guardado no se borra y sigue en los meses sin CDR.
