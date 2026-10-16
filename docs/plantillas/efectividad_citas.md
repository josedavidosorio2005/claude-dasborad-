# Efectividad de Citas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `efectividad_citas` (grupo salud)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** Citas atendidas

## De dónde sale

Resumen mensual de agendas y atendidas que arma el equipo. La efectividad la calcula el sistema.

## Plantilla oficial

`server/plantillas/PLANTILLA_EFECTIVIDAD_CITAS.xlsx` — hoja `CITAS_ATENDIDAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| MES | Sí | Mes en letras, sin año. |  |
| AGENDAS | Sí | Citas agendadas del mes. |  |
| ATENDIDAS | Sí | Citas atendidas del mes. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Los meses completos que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| MES | AGENDAS | ATENDIDAS |
|---|---|---|
| AGOSTO | 1500 | 1200 |

## Notas

- Un total por mes. La columna EFECTIVIDAD CITAS ATENDIDAS, si viene, no se guarda: se recalcula.
- El mes viene sin año: el sistema pregunta a qué año corresponde.
