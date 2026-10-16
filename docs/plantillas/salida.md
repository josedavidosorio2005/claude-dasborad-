# Llamadas y WhatsApp de salida

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `salida` (grupo opcional, **no disponible para clientes nuevos**)
- **Lo usa hoy:** ORLANT (no disponible para clientes nuevos)
- **Carga que necesita:** Hoja "salida" de la carga manual

## De dónde sale

Resumen mensual de salida que arma el equipo (líneas 3P y General de ORLANT). El encabezado puede estar en la fila 3.

## Plantilla oficial

`server/plantillas/PLANTILLA_SALIDA_MENSUAL.xlsx` — hoja `SALIDA` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

## Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| MES | Sí | Mes en letras, sin año. |  |
| LINEA 3P | Sí | Llamadas de salida de la línea 3P. |  |
| LINEA GENERAL | Sí | Llamadas de salida de la línea General. |  |
| WHATSAPP 3P | Sí | WhatsApp de salida de la línea 3P. |  |
| WHATSAPP GENERAL | Sí | WhatsApp de salida de la línea General. |  |

## Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

## Qué período cubre y qué reemplaza

Los meses completos que trae el archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

## Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

## Ejemplo (inventado)

| MES | LINEA 3P | LINEA GENERAL | WHATSAPP 3P | WHATSAPP GENERAL |
|---|---|---|---|---|
| AGOSTO | 400 | 600 | 200 | 350 |

## Notas

- Lee un resumen mensual con las líneas 3P y General, propias de ORLANT. Queda como módulo pendiente de generalizar cuando un cliente nuevo lo necesite.
- El mes viene sin año: antes de guardar, el sistema muestra a qué año lo resolvió y pide confirmar.
- El archivo real trae el encabezado en la fila 3 (dos filas vacías antes); se reconoce igual.
