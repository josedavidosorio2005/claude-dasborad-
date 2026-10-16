# Calidad

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `calidad` (grupo comun)
- **Lo usa hoy:** ORLANT y MOBILIZE
- **Carga que necesita:** Monitoreos + plantilla de evaluación del cliente

## De dónde sale

No sale de Wolkvox: son los monitoreos que hace el equipo de Calidad. La carga normal es un monitoreo a la vez, desde el formulario de Calidad. Para muchos monitoreos de una vez existe la **carga masiva**.

## Plantilla

No hay un archivo fijo en `server/plantillas/`: las columnas de los ítems dependen de la plantilla de evaluación de cada cliente (y, cuando un cliente tenga sedes, de cada sede). La plantilla se descarga desde Calidad → Carga masiva, ya armada con los ítems de esa campaña (`descargarPlantillaMonitoreos`, `public/js/calidad-carga-masiva.js`). Trae 3 hojas: "Monitoreos" (para llenar), "Diccionario" (las preguntas) y "Resumen por Asesor" (consulta).

## Columnas que lee el sistema (hoja "Monitoreos")

| Columna | Obligatoria | También se acepta como |
|---|---|---|
| ASESOR | Sí | NOMBRE DEL ASESOR |
| FECHA | Sí | |
| CANAL | No | |
| ID LLAMADA | No | ID / LLAMADA - WPP |
| TELEFONO | No | # TELEFONO |
| EVALUADOR | No | |
| OBSERVACIONES | No | OBSERVACIONES GENERALES |
| Una columna por ítem | Según la plantilla | El número al inicio ("3. …") identifica el ítem, aunque cambie la redacción |

## Cómo detecta el encabezado

Busca el encabezado en las primeras 10 filas (el archivo real trae título, leyenda y encabezados agrupados antes del encabezado real). Mayúsculas, tildes y espacios no importan.

## Qué período cubre y qué reemplaza

Cada fila es un monitoreo con su fecha. La carga masiva **agrega** monitoreos, no reemplaza meses.

## Si falta una columna

Sin ASESOR o FECHA, la carga no se hace y el aviso dice cuál falta. Un ítem que no está en el archivo queda sin calificar.

## Ejemplo (inventado)

| ASESOR | FECHA | CANAL | EVALUADOR | 1. Guion de saludo | 2. … |
|---|---|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-05 | LLAMADA | Evaluador Ejemplo | 1 | 1 |

## Pendiente

Aurora: su modelo es el de ORLANT estandarizado (14 ítems, 6 críticos), lo entrega el usuario. HLM: una plantilla por sede (Sede 33 y Sede Castilla). No se inventan ítems.
