# Flujo de Llamadas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `flujo_llamadas` (grupo comun)
- **Lo usa hoy:** ORLANT y MOBILIZE
- **Carga que necesita:** Tráfico de Llamadas (Wolkvox)

## De dónde sale

Wolkvox: reporte de la cola por skill y por día (hoja "HistQueue<fecha>"; ORLANT lo trae en la hoja LLAMADAS). Se sube tal cual.

**Nivel de atención y tasa de abandono los calcula el sistema; no hace falta llenarlos.**

## Plantilla oficial

`server/plantillas/PLANTILLA_FLUJO_LLAMADAS.xlsx` — hoja `LLAMADAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| SKILL_NAME | Sí | Línea o skill de Wolkvox. | TIPO DE LINEA |
| DATE | Sí | Día. | DÍA, DIA |
| INBOUND_CALLS | Sí | Llamadas que entraron a la cola ese día (ingresadas). | TOTAL LLAMADAS, LLAMADAS INGRESADAS |
| ANSWER_CALLS | Sí | Llamadas atendidas. | LLAMADAS CONTESTADAS |
| ABANDON_CALLS | No | Llamadas que colgaron antes de ser atendidas. | LLAMADAS ABANDONADAS |
| SERVICE_LEVEL_10SEC | No | % atendidas en 10 s. Puede venir como texto ("66.67 %"). |  |
| SERVICE_LEVEL_20SEC | No | % atendidas en 20 s (nivel de servicio 80 - 20). | NIVEL DE SERVICIO 80 - 20 |
| SERVICE_LEVEL_30SEC | No | % atendidas en 30 s. |  |
| ABANDON | No | % de abandono que reporta Wolkvox. Se deja como viene: el sistema no la usa (calcula la tasa de abandono con las llamadas). |  |
| ASA | No | Tiempo promedio de respuesta (segundos, también como texto "11.00"). |  |
| ATA | No | Tiempo promedio hasta el abandono. |  |
| WAIT_TIME | No | Tiempo de espera (hora de Excel o segundos). |  |
| AHT | No | Tiempo promedio de atención (hora de Excel o segundos). "----" o vacío = sin dato, nunca 0. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Las filas de esos skills en las fechas que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| SKILL_NAME | DATE | INBOUND_CALLS | ANSWER_CALLS | ABANDON_CALLS | SERVICE_LEVEL_10SEC | SERVICE_LEVEL_20SEC | SERVICE_LEVEL_30SEC | ABANDON | ASA | ATA | WAIT_TIME | AHT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SKILL SAC | 2026-08-01 | 120 | 112 | 8 | 66.67 % | 80.00 % | 93.00 % | 0.00% | 11.00 | 30.00 | 0:00:15 | 0:03:30 |

## Notas

- Es el mismo lector para los dos clientes y el mismo reporte de Wolkvox (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS, SERVICE_LEVEL_10SEC, SERVICE_LEVEL_20SEC, SERVICE_LEVEL_30SEC, ABANDON, ASA, ATA, WAIT_TIME, AHT). Los nombres de plantillas anteriores (TOTAL LLAMADAS, LLAMADAS INGRESADAS, TIPO DE LINEA, DÍA, NIVEL DE SERVICIO 80 - 20, % ABANDONO…) se siguen aceptando como alias.
- La hoja se reconoce por sus columnas, no por su nombre ("HistQueue<fecha>", "LLAMADAS", "DATA" u otro).
- Desde el Centro de cargas, el cliente lo define el Centro: las skills que ese cliente no tiene se registran solas para él (la vista previa dice cuáles) y la skill es por cliente, así que dos clientes pueden tener una skill con el mismo nombre sin mezclarse (Fase 163). En la pantalla de Tráfico de varios clientes, una skill sin asignar queda en "SIN_ASIGNAR" y no se ve en ningún tablero hasta asignarla.
- Una fila de total ("TOTAL", "TOTAL GENERAL") nunca se suma como si fuera una línea.
- Un archivo puede traer varios días o meses; el período es el de las fechas que trae.

## Pendiente

Ruta exacta del reporte en el menú de Wolkvox (la carga de septiembre de Mobilize usó la hoja "HistQueue<fecha>"): confirmarla con Edwin para la guía.
