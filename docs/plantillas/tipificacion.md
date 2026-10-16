# Tipificación

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `tipificacion` (grupo comun)
- **Lo usa hoy:** ORLANT (llamadas y WhatsApp) y MOBILIZE (llamadas, CDR completo)
- **Carga que necesita:** CDR / tipificación (Wolkvox)

## Tipificación de llamadas (CDR)

### De dónde sale

Wolkvox: Reportes → CDR → "1. Detalle de las llamadas", export completo (hoja "HistCDR<fecha>"). Se sube tal cual: el sistema nunca lee teléfonos, documentos ni comentarios.

### Plantilla oficial

`server/plantillas/PLANTILLA_TIPIFICACION_LLAMADAS.xlsx` — hoja `TIPIFICACION_LLAMADAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor. |  |
| DATE | Sí | Fecha de la llamada (la hora va en HORA). |  |
| HORA | No | Hora, si viene aparte. |  |
| TIME_MIN | No | Duración en minutos. |  |
| DESCRIPTION_COD_ACT | Sí | Motivo o tipificación. |  |
| SKILL_NAME | Sí | Línea o skill (WhatsApp: "NOMBRE DE SKILL"). | NOMBRE DE SKILL |
| TIME_SEC | No | Duración en segundos. |  |
| COD_ACT | No | Código de la tipificación (texto). |  |
| TYPE_INTERACTION | No | "inbound" (entrante) u "outbound_ma" (saliente). |  |
| HUNG_UP | No | Quién colgó ("agent" o "customer"). |  |
| SKILL_ID | No | Identificador técnico de la línea. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las llamadas de ese cliente entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | HORA | TIME_MIN | DESCRIPTION_COD_ACT | SKILL_NAME | TIME_SEC | COD_ACT | TYPE_INTERACTION | HUNG_UP | SKILL_ID |
|---|---|---|---|---|---|---|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 | 08:15 | 3 | Consulta general | SKILL SAC | 180 | 401 | inbound | customer | 101 |

## Tipificación de WhatsApp (HistChat)

### De dónde sale

Wolkvox: export "HistChat<fecha>". Se sube tal cual (no hay que renombrar la hoja); el sistema nunca lee nombres, correos, teléfonos ni el texto de las conversaciones.

### Plantilla oficial

`server/plantillas/PLANTILLA_TIPIFICACION_WHATSAPP.xlsx` — hoja `TIPIFICACION_WHATSAPP` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor. |  |
| DATE | Sí | Fecha de la conversación. |  |
| DESCRIPTION_COD_ACT | Sí | Motivo o tipificación. |  |
| NOMBRE DE SKILL | Sí | Cola de WhatsApp ("NOMBRE DE SKILL" en el export). | NOMBRE DE SKILL |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las conversaciones de ese cliente entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | DESCRIPTION_COD_ACT | NOMBRE DE SKILL |
|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 | Agendamiento | WHATSAPP GENERAL |

## Notas

- Llamadas y WhatsApp se cargan por separado; cada carga reemplaza solo su canal.
- El sistema distingue el canal por las columnas: el CDR de llamadas trae SKILL_NAME y el HistChat de WhatsApp trae "NOMBRE DE SKILL". Un archivo de un canal nunca se carga en el otro.
- Privacidad: del CDR completo nunca se leen TELEPHONE, CUSTOMER_ID, CONN_ID, AGENT_ID, DESTINY, COST ni COMMENT; del HistChat nunca se leen nombres, correos, teléfonos ni el texto de la conversación.
- En el CDR de Mobilize se excluyen las filas de prueba (tipificación "PRUEBA"), y en las salientes "Cliente_no_contesta" cuenta como no conectada.
- Si el archivo junta muchos meses y es muy grande, el sistema avisa antes de guardar; hay que subirlo por meses.
