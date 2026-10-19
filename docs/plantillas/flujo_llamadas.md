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
| SKILL_NAME | Sí | Línea o skill de Wolkvox (Mobilize: "TIPO DE LINEA"). | TIPO DE LINEA |
| DATE | Sí | Día (Mobilize: "DÍA"). | DÍA, DIA |
| TOTAL LLAMADAS | Sí | Llamadas que entraron a la cola ese día (Mobilize: "LLAMADAS INGRESADAS"). | LLAMADAS INGRESADAS |
| LLAMADAS CONTESTADAS | Sí | Llamadas atendidas. |  |
| LLAMADAS ABANDONADAS | No | Llamadas que colgaron antes de ser atendidas. |  |
| SERVICE_LEVEL_10SEC | No | % atendidas en 10 s. |  |
| SERVICE_LEVEL_20SEC | No | % atendidas en 20 s (Mobilize: "NIVEL DE SERVICIO 80 - 20"). | NIVEL DE SERVICIO 80 - 20 |
| SERVICE_LEVEL_30SEC | No | % atendidas en 30 s. |  |
| ABANDON | No | % de abandono que reporta Wolkvox. Se deja como viene: el sistema no la usa (calcula la tasa de abandono con las llamadas). |  |
| ASA | No | Tiempo promedio de respuesta (segundos o mm:ss). |  |
| ATA | No | Tiempo promedio hasta el abandono. |  |
| WAIT_TIME | No | Tiempo de espera. |  |
| AHT | No | Tiempo promedio de atención. |  |
| NIVEL DE ATENCION | No | No hace falta llenarla: el sistema la calcula (contestadas ÷ ingresadas). Si viene llena, no se usa. |  |
| TASA DE ABNDONO | No | No hace falta llenarla: el sistema la calcula (abandonadas ÷ ingresadas). Si viene llena, no se usa. (Así viene escrito de Wolkvox; Mobilize: "% ABANDONO"). | % ABANDONO |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Las filas de esos skills en las fechas que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| SKILL_NAME | DATE | TOTAL LLAMADAS | LLAMADAS CONTESTADAS | LLAMADAS ABANDONADAS | SERVICE_LEVEL_10SEC | SERVICE_LEVEL_20SEC | SERVICE_LEVEL_30SEC | ABANDON | ASA | ATA | WAIT_TIME | AHT | NIVEL DE ATENCION | TASA DE ABNDONO |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SKILL SAC | 2026-08-01 | 120 | 112 | 8 | 0.85 | 0.9 | 0.93 | 0.07 | 12 | 30 | 15 | 210 |  |  |

## Notas

- Es el mismo lector para los dos clientes: Mobilize trae otros nombres de columna (TIPO DE LINEA, DÍA, LLAMADAS INGRESADAS, NIVEL DE SERVICIO 80 - 20, % ABANDONO) y el sistema los acepta como alias.
- Antes de la primera carga de un cliente hay que asignar sus skills a la campaña (pantalla Tráfico → skills). Un skill sin asignar queda en "SIN_ASIGNAR" y no se ve en ningún tablero.
- Una fila de total ("TOTAL", "TOTAL GENERAL") nunca se suma como si fuera una línea.
- Un archivo puede traer varios días o meses; el período es el de las fechas que trae.

## Pendiente

Ruta exacta del reporte en el menú de Wolkvox (la carga de septiembre de Mobilize usó la hoja "HistQueue<fecha>"): confirmarla con Edwin para la guía.
