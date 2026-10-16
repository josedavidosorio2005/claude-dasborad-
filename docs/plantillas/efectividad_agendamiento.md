# Efectividad de Agendamiento

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `efectividad_agendamiento` (grupo salud)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** Efectividad por asesor

## De dónde sale

Resumen mensual por asesor que arma el equipo (gestiones y agendas). La efectividad la calcula el sistema.

## Plantilla oficial

`server/plantillas/PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx` — hoja `EFECTIVIDAD_AGENDAMIENTO` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| NOMBRE DE AGENTE | Sí | Asesor (una fila por asesor y mes). |  |
| MES | Sí | Mes en letras, sin año (el sistema pregunta el año). |  |
| CANTIDAD DE GESTIONES | Sí | Gestiones del mes. |  |
| AGENDAS | Sí | Agendas logradas. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

El mes completo, para todos los asesores del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| NOMBRE DE AGENTE | MES | CANTIDAD DE GESTIONES | AGENDAS |
|---|---|---|---|
| Asesor Ejemplo Uno | AGOSTO | 300 | 120 |

## Notas

- Una fila por asesor y mes. La columna EFECTIVIDAD del archivo, si viene, no se guarda: el sistema la recalcula y avisa si no coincide.
- El mes viene sin año: el sistema pregunta a qué año corresponde.
