# Tipificación

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `tipificacion` (grupo comun)
- **Lo usa hoy:** ORLANT (llamadas y WhatsApp) y MOBILIZE (llamadas, CDR completo)
- **Carga que necesita:** CDR / tipificación (Wolkvox)

## Tipificación de llamadas (CDR)

### De dónde sale

Wolkvox: CDR de llamadas, export completo (hoja "HistCDR<fecha>") — [ruta pendiente de confirmar con Edwin]. Se sube tal cual: el sistema nunca lee teléfonos, documentos ni comentarios. SKILL_ID/SKILL_NAME "-" = Llamadas de salida (las internalcall no cuentan). TYPE_INTERACTION "out_pre" también es Llamada de salida, aunque traiga skill (ORLANT: 4070 CANCELACIONES Y REPROGRAMACION).

**Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) "Llamadas" — Wolkvox, CDR (hoja "HistCDR<fecha>"). (2) "WhatsApp" — Wolkvox, HistChat (hoja "HistChat<fecha>"). Esta plantilla es la de "Llamadas".**

### Plantilla oficial

`server/plantillas/PLANTILLA_TIPIFICACION_LLAMADAS.xlsx` — hoja `TIPIFICACION_LLAMADAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor. |  |
| DATE | Sí | Fecha y hora de la llamada. |  |
| DESTINY | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| TELEPHONE | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| COST | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TIME_SEC | No | Duración en segundos. |  |
| TIME_MIN | No | Duración en minutos. |  |
| COD_ACT | No | Código de la tipificación (texto). |  |
| DESCRIPTION_COD_ACT | Sí | Motivo o tipificación. En una llamada de salida, el cliente define cuáles cuentan como "no conectada" (ORLANT: NO_CONTESTAN y BUZON). |  |
| COD_ACT_2 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| DESCRIPTION_COD_ACT_2 | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TYPE_INTERACTION | No | "inbound" (entrante), "outbound_ma" u "out_pre" (salientes: las dos cuentan como Llamadas de salida). Las "internalcall" no cuentan como salida. |  |
| CUSTOMER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| HUNG_UP | No | Quién colgó ("agent" o "customer"). |  |
| CAMPAIGN_ID | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| CONN_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| SKILL_ID | No | Identificador técnico de la línea. |  |
| SKILL_NAME | Sí | Línea o skill. "-" con TYPE_INTERACTION de salida = Llamadas de salida. | NOMBRE DE SKILL |
| AGENT_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| COMMENT | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las llamadas de ese cliente entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | DESTINY | TELEPHONE | COST | TIME_SEC | TIME_MIN | COD_ACT | DESCRIPTION_COD_ACT | COD_ACT_2 | DESCRIPTION_COD_ACT_2 | TYPE_INTERACTION | CUSTOMER_ID | HUNG_UP | CAMPAIGN_ID | CONN_ID | SKILL_ID | SKILL_NAME | AGENT_ID | COMMENT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 08:15:00 | 3000000001 | 3000000001 | 0 | 180 | 3 | 401 | Consulta general | - | - | inbound | 1000000001 | customer | - | EJEMPLO-0001 | 101 | SKILL SAC | 0000 |  |

## Tipificación de WhatsApp (HistChat)

### De dónde sale

Wolkvox: CDR de WhatsApp, export "HistChat<fecha>" — [ruta pendiente de confirmar con Edwin]. Se sube tal cual (no hay que renombrar la hoja); el sistema nunca lee nombres, correos, teléfonos ni el texto de las conversaciones. Un SKILL_ID que no esté en la tabla de skills se ignora y la vista previa dice cuántos.

**Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) "Llamadas" — Wolkvox, CDR (hoja "HistCDR<fecha>"). (2) "WhatsApp" — Wolkvox, HistChat (hoja "HistChat<fecha>"). Esta plantilla es la de "WhatsApp".**

Tabla de skills de WhatsApp de ORLANT (SKILL_ID = nombre): 0 = WHATSAPP DE SALIDA; 4042 = WHATSAPP PAUTAS; 4047 = WHATSAPP AUDIFONOS; 4061 = WHATSAPP FONOAUDIOLOGIA; 4071 = WHATSAPP FONIATRIA; 4306 = WHATSAPP 3P; 4327 = WHATSAPP GENERAL; 4338 = WHATSAPP CONFIRMACIONES; 4362 = ATENCION TUTELAS. La edita un administrador en Cargar Datos → "Skills de WhatsApp".

### Plantilla oficial

`server/plantillas/PLANTILLA_TIPIFICACION_WHATSAPP.xlsx` — hoja `TIPIFICACION_WHATSAPP` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| CONN_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CHANNEL | No | Canal del chat ("whatsapp"). |  |
| DATE | Sí | Fecha y hora de la conversación. |  |
| DATE_CLOSE | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| ROUTING | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| CUSTOMER_NAME | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CUSTOMER_EMAIL | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CUSTOMER_PHONE | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CUSTOMER_CHARS | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| ASSIGNMENT_TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| AGENT_AVERAGE_RESPONSE_TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| AGENT_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| AGENT_NAME | Sí | Asesor. |  |
| AGENT_CHARS | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TIME_ON_AGENT | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| CHAT_DURATION | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| COD_ACT | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| DESCRIPTION_COD_ACT | Sí | Motivo o tipificación. |  |
| TRANSFER | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| TRANSFER_TYPE | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| COMMENTS | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| CUSTOMER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| SKILL_ID | No | Número del skill (ver la tabla de skills). 0 = WhatsApp de salida. |  |
| FIRST RESPONSE TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| LAST_PARTICIPANT_WHO_SPOKE | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| EXTRA_FIELD | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| COMMENT | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| USER_ID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| FEELING | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| AGENT_DNI | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |
| AGENT_ANSWERS | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| BSUID | No | Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Las conversaciones de ese cliente entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| CONN_ID | CHANNEL | DATE | DATE_CLOSE | ROUTING | CUSTOMER_NAME | CUSTOMER_EMAIL | CUSTOMER_PHONE | CUSTOMER_CHARS | ASSIGNMENT_TIME | AGENT_AVERAGE_RESPONSE_TIME | AGENT_ID | AGENT_NAME | AGENT_CHARS | TIME_ON_AGENT | CHAT_DURATION | COD_ACT | DESCRIPTION_COD_ACT | TRANSFER | TRANSFER_TYPE | COMMENTS | CUSTOMER_ID | SKILL_ID | FIRST RESPONSE TIME | LAST_PARTICIPANT_WHO_SPOKE | EXTRA_FIELD | COMMENT | USER_ID | FEELING | AGENT_DNI | AGENT_ANSWERS | BSUID |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EJEMPLO-0001 | whatsapp | 2026-09-01 08:15:00 | 2026-09-01 08:30:00 | - | Cliente Ejemplo | cliente@ejemplo.com | 3000000001 | 0 | 0 | 0 | 0000 | Asesor Ejemplo Uno | 0 | 0 | 0 | 401 | Agendamiento | - | - |  | 1000000001 | 4327 | 0 | - |  |  | 0000 | - | 0000 | 0 | - |

## Notas

- Llamadas y WhatsApp se cargan por separado; cada carga reemplaza solo su canal.
- El sistema distingue el canal por las columnas: el CDR de llamadas trae SKILL_NAME; el HistChat de WhatsApp trae SKILL_ID + CHANNEL (o el formato anterior con "NOMBRE DE SKILL"). Un archivo de un canal nunca se carga en el otro.
- WhatsApp (Fase 168): el nombre del skill sale de la tabla "Skills de WhatsApp" del cliente (SKILL_ID → nombre, la edita un administrador en Cargar Datos). SKILL_ID 0 = WhatsApp de salida; un SKILL_ID que no esté en la tabla se ignora con un aviso.
- Llamadas (Fase 168): SKILL_ID/SKILL_NAME "-" = Llamadas de salida; las internalcall no cuentan como salida.
- Privacidad: del CDR completo nunca se leen TELEPHONE, CUSTOMER_ID, CONN_ID, AGENT_ID, DESTINY, COST ni COMMENT; del HistChat nunca se leen nombres, correos, teléfonos ni el texto de la conversación.
- En el CDR de Mobilize se excluyen las filas de prueba (tipificación "PRUEBA"), y en las salientes "Cliente_no_contesta" cuenta como no conectada.
- Si el archivo junta muchos meses y es muy grande, el sistema avisa antes de guardar; hay que subirlo por meses.
