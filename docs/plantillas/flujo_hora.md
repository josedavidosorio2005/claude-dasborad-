# Flujo por hora

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `flujo_hora` (grupo opcional)
- **Lo usa hoy:** MOBILIZE
- **Carga que necesita:** Flujo por hora (Wolkvox)

## De dónde sale

Wolkvox: reporte de la cola por skill, día y HORA (hoja "HistQueue<fecha>", columna HOUR). Se sube tal cual.

## Plantilla oficial

`server/plantillas/PLANTILLA_FLUJO_HORA.xlsx` — hoja `FLUJO_HORA` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| DATE | Sí | Día, como lo trae Wolkvox (AAAAMMDD). |  |
| SKILL_ID | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| SKILL_NAME | Sí | Línea o skill. |  |
| HOUR | Sí | Hora del día (0 a 23): 8 = de 8:00 a 9:00. |  |
| INBOUND_CALLS | Sí | Llamadas que entraron a la cola en esa hora (ingresadas). |  |
| ANSWER_CALLS | Sí | Contestadas en esa hora. |  |
| ABANDON_CALLS | Sí | Abandonadas en esa hora. |  |
| SERVICE_LEVEL_10SEC | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| SERVICE_LEVEL_20SEC | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| SERVICE_LEVEL_30SEC | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| WAIT_TIME | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| ABANDON | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| AHT | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| ASA | No | Viene en el export de Wolkvox; el sistema no la usa. |  |
| ATA | No | Viene en el export de Wolkvox; el sistema no la usa. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Todo el flujo por hora entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| DATE | SKILL_ID | SKILL_NAME | HOUR | INBOUND_CALLS | ANSWER_CALLS | ABANDON_CALLS | SERVICE_LEVEL_10SEC | SERVICE_LEVEL_20SEC | SERVICE_LEVEL_30SEC | WAIT_TIME | ABANDON | AHT | ASA | ATA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20260801 | 101 | SKILL SAC | 8 | 6 | 5 | 1 | - | - | - | - | - | - | - | - |

## Notas

- Pestaña "Flujo por hora": tres mapas de calor (Ingresadas, Contestadas, Abandonadas), filas = hora, columnas = días del mes, con fila y columna de Total. Sigue el MES de arriba.
- Colores en tres tramos del valor más alto de cada tabla: alto (verde), medio (amarillo), bajo (gris). El número siempre está escrito.
- El reporte por hora trae la columna HOUR: así nunca se confunde con el de Flujo de Llamadas (diario). No trae teléfonos.
