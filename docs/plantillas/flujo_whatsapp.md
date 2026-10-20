# Flujo de WhatsApp

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `flujo_whatsapp` (grupo comun)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** Tráfico de WhatsApp (Wolkvox)

## De dónde sale

Wolkvox: reporte de WhatsApp por cola (un período por fila). También se acepta el formato diario de Wolkvox (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS…).

## Plantilla oficial

`server/plantillas/PLANTILLA_FLUJO_WHATSAPP.xlsx` — hoja `WHATSAPP` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| NOMBRE_COLA_WHATSAPP | Sí | Cola de WhatsApp. |  |
| FECHA INICIO | Sí | Primer día del período de la fila. |  |
| FECHA FIN | Sí | Último día del período de la fila. |  |
| TOTAL WHATSAPP | Sí | Conversaciones que entraron. |  |
| WHATSAPP CONTESTADOS | Sí | Conversaciones atendidas. |  |
| WHATSAPP ABANDONADOS | No | Conversaciones sin atender. |  |
| SERVICE_LEVEL_10SEC | No | % atendidas en 10 s. Como porcentaje ("40 %" o celda con formato %). |  |
| SERVICE_LEVEL_20SEC | No | % atendidas en 20 s. Como porcentaje. |  |
| SERVICE_LEVEL_30SEC | No | % atendidas en 30 s. Como porcentaje. |  |
| SERVICE_LEVEL_5MIN | No | % atendidas en 5 min. Como porcentaje. | SERVICE_LEVEL_300SEC, NIVEL DE SERVICIO 5 MIN |
| ASA | No | Tiempo promedio de respuesta, en segundos. |  |
| ATA | No | Tiempo promedio hasta el abandono, en segundos. |  |
| AHT | No | Tiempo promedio de atención, como hora de Excel (h:mm:ss). No en segundos: 400 se leería como 400 días y la carga se rechaza. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Las filas de esas colas en el rango de fechas de cada fila. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| NOMBRE_COLA_WHATSAPP | FECHA INICIO | FECHA FIN | TOTAL WHATSAPP | WHATSAPP CONTESTADOS | WHATSAPP ABANDONADOS | SERVICE_LEVEL_10SEC | SERVICE_LEVEL_20SEC | SERVICE_LEVEL_30SEC | SERVICE_LEVEL_5MIN | ASA | ATA | AHT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WHATSAPP GENERAL | 2026-08-01 | 2026-08-31 | 900 | 870 | 30 | 40.00 % | 50.00 % | 60.00 % | 90.00 % | 60 | 300 | 0:06:40 |

## Notas

- Acepta dos formatos de Wolkvox: por período (FECHA INICIO / FECHA FIN por fila) o diario (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS…). El sistema distingue cuál es por sus columnas, y nunca lo confunde con el de llamadas.
- La plantilla trae el formato por período; si el archivo nativo diario ya sale de Wolkvox, se sube tal cual.
