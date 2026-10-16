# Inasistencia

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `inasistencia` (grupo salud)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** Inasistencia

## De dónde sale

Sistema de agendamiento del cliente: citas con su estado (una fila por cita; puede traer varios meses).

## Plantilla oficial

`server/plantillas/PLANTILLA_INASISTENCIA.xlsx` — hoja `INASISTENCIA` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| SEDE | Sí | Sede de la cita (una fila por cita). |  |
| ESPECIALIDAD | Sí | Especialidad. | ESPECIALIDA |
| FECHA_CITA | Sí | Fecha de la cita. | FECHA CITA |
| NOMBRE ENTIDAD | Sí | Entidad (las que aparecen muy poco se guardan como "PARTICULAR / OTRA"). |  |
| CITEST | Sí | C = cancelada, I = inasistencia, P = pendiente, T = atendida. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Los meses completos que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| SEDE | ESPECIALIDAD | FECHA_CITA | NOMBRE ENTIDAD | CITEST |
|---|---|---|---|---|
| Sede Ejemplo | Audiología | 2026-08-05 | Entidad Ejemplo | T |

## Notas

- Una fila por cita (no un resumen). No borre filas repetidas: sin número de cita, dos filas iguales son dos citas reales.
- CITEST: C, I, P o T. Otra letra se avisa; si son demasiadas, la carga se rechaza.
- Privacidad: una entidad que aparece muy pocas veces se guarda como "PARTICULAR / OTRA".
