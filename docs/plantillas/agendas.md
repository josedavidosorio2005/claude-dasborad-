# Agendas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `agendas` (grupo salud)
- **Lo usa hoy:** ORLANT
- **Carga que necesita:** AGENDAS (Wolkvox)

## De dónde sale

Sistema de agendamiento del cliente: citas agendadas (una fila por cita).

## Plantilla oficial

`server/plantillas/PLANTILLA_AGENDAS.xlsx` — hoja `AGENDAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| NOMBRE DE AGENTE | Sí | Asesor que agendó. |  |
| SEDE | Sí | Sede de la cita. |  |
| NOMBRE_EXAMEN | Sí | Examen o servicio. |  |
| ESPECIALIDAD | Sí | Especialidad. |  |
| PROFESIONAL | Sí | Profesional asignado. |  |
| FECHA_SOLICITUD | Sí | Fecha y hora en que se agendó. |  |
| TIPO DE LINEA | Sí | "3P" o "GENERAL". |  |
| NOMBRE_ENTIDAD | No | Entidad (opcional). |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

El rango continuo de fechas que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| NOMBRE DE AGENTE | SEDE | NOMBRE_EXAMEN | ESPECIALIDAD | PROFESIONAL | FECHA_SOLICITUD | TIPO DE LINEA | NOMBRE_ENTIDAD |
|---|---|---|---|---|---|---|---|
| Asesor Ejemplo Uno | Sede Ejemplo | Examen Ejemplo | Audiología | Profesional Ejemplo | 2026-08-01 08:15:00 | GENERAL | Entidad Ejemplo |

## Notas

- Una fila por cita agendada. TIPO DE LINEA solo acepta 3P o GENERAL.
- Un mes grande cabe sin problema; si el archivo junta muchos meses, el sistema avisa antes de guardar y hay que subirlo por meses.
