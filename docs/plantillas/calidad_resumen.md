# Calidad: resumen por asesor

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `calidad_resumen` (grupo opcional)
- **Lo usa hoy:** MOBILIZE
- **Carga que necesita:** Resumen de calidad por asesor (plantilla de Edwin)
- **Necesita el módulo:** `calidad`

## De dónde sale

Resumen por asesor que arma Edwin a partir de su libro de Monitoreos (una fila por asesor). Si las columnas son fórmulas a ese libro, ábralo junto con la plantilla, deje que calcule y guárdela antes de subirla: el sistema lee los valores ya calculados.

**El mes se elige al subir (Centro de cargas: la tarjeta del mes). Clasificación y Alerta se recalculan con los números: puntaje <70 Crítico, <90 No crítico, si no Sobresaliente; fallos críticos 0 Sin fallos críticos, 1 Alerta, más de 1 Crítico frecuente. El promedio general del mes es ponderado por el número de monitoreos.**

## Plantilla oficial

`server/plantillas/PLANTILLA_CALIDAD_RESUMEN.xlsx` — hoja `CALIDAD_RESUMEN` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| Nombre del Asesor | Sí | Nombre del asesor (puede traer "← Escribir aquí" en el encabezado). |  |
| # Monitoreos | Sí | Cantidad de monitoreos del asesor en el mes (puede ser fórmula ya calculada). |  |
| Prom. Puntaje (%) | Sí | Puntaje promedio del asesor, de 0 a 100 (puede ser fórmula ya calculada). |  |
| Clasificación | No | Opcional: el sistema la recalcula con el puntaje. |  |
| Alerta Críticos | No | Opcional: el sistema la recalcula con los fallos. |  |
| Total Fallos Críticos | Sí | Cantidad de fallos críticos del asesor en el mes (puede ser fórmula ya calculada). |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

El mes elegido completo (los demás meses no se tocan). Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| Nombre del Asesor | # Monitoreos | Prom. Puntaje (%) | Clasificación | Alerta Críticos | Total Fallos Críticos |
|---|---|---|---|---|---|
| Asesor Ejemplo Uno | 11 | 96.5 | Sobresaliente | Alerta | 1 |

## Notas

- Es una sub-vista de Calidad: un panel al inicio de esa pestaña (tarjetas del mes, tabla por asesor y tabla por mes).
- Mientras llega el módulo de calidad completo (detalle por monitoreo), Edwin sube este resumen por asesor.
- Clasificación y Alerta no se leen del texto (traen emojis): se recalculan con los números.
