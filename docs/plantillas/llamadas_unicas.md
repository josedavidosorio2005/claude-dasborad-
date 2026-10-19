# Llamadas Únicas y de Salida

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `llamadas_unicas` (grupo opcional)
- **Lo usa hoy:** MOBILIZE
- **Carga que necesita:** Llamadas únicas + Llamadas de salida (Wolkvox)

## Llamadas Únicas (ingreso)

### De dónde sale

Wolkvox: Reportes → CDR → "1. Detalle de las llamadas", solo las de ingreso (sin las de salida).

**Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) "Únicas de ingreso" — contestadas: Wolkvox, CDR; no contestadas: Wolkvox, reporte por skill y servicio. (2) "De salida" — Wolkvox, CDR. Esta plantilla es la de "Únicas de ingreso".**

### Plantilla oficial

`server/plantillas/PLANTILLA_LLAMADAS_UNICAS.xlsx` — hoja `LLAMADAS_UNICAS` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor que atendió. |  |
| DATE | Sí | Fecha de la llamada. |  |
| TELEPHONE | Sí | Número que llamó. Solo se usa en el navegador para contar una vez por día; nunca se envía ni se guarda. |  |
| SKILL_NAME | Sí | Línea o skill. |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

El mes completo de las fechas del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | TELEPHONE | SKILL_NAME |
|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 | 3000000000 | SKILL SAC |

## Llamadas de Salida

### De dónde sale

Wolkvox: CDR → "1. Detalle de las llamadas" (salientes conectadas) + "5. Detalle de las llamadas para las no conectadas", con SKILL_ID diciendo cuál es cuál.

**Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) "Únicas de ingreso" — contestadas: Wolkvox, CDR; no contestadas: Wolkvox, reporte por skill y servicio. (2) "De salida" — Wolkvox, CDR. Esta plantilla es la de "De salida".**

### Plantilla oficial

`server/plantillas/PLANTILLA_LLAMADAS_SALIDA.xlsx` — hoja `LLAMADAS_SALIDA` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.

### Columnas que lee el sistema

| Columna | Obligatoria | Qué va | También se acepta como |
|---|---|---|---|
| AGENT_NAME | Sí | Asesor que hizo la llamada. |  |
| DATE | Sí | Fecha de la llamada. |  |
| TELEPHONE | Sí | Número llamado. Solo se usa en el navegador; nunca se envía ni se guarda. |  |
| DESCRIPTION_COD_ACT | Sí | Tipificación de la llamada. |  |
| SKILL_ID | Sí | "LLAMADAS DE SALIDA CONECTADAS" o "LLAMADAS DE SALIDA NO CONECTADAS". |  |

### Cómo detecta el encabezado

Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.

### Qué período cubre y qué reemplaza

Todo lo que exista entre la primera y la última fecha del archivo. Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.

### Si falta una columna

Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.

### Ejemplo (inventado)

| AGENT_NAME | DATE | TELEPHONE | DESCRIPTION_COD_ACT | SKILL_ID |
|---|---|---|---|---|
| Asesor Ejemplo Uno | 2026-08-01 | 3000000001 | Seguimiento | LLAMADAS DE SALIDA CONECTADAS |

## Notas

- Son dos cargas, una por mitad de la pestaña "Llamadas Únicas y de Salida": ingreso (izquierda) y salida (derecha).
- Privacidad: TELEPHONE se usa solo en el navegador de quien sube el archivo, para contar una vez cada número por día. Nunca llega al servidor, nunca se guarda ni se muestra.
- Ingreso: no se aceptan filas con SKILL_NAME = "NO CONTESTADAS" (son salidas no conectadas; van en la carga de salida).
- Salida: SKILL_ID debe decir "LLAMADAS DE SALIDA CONECTADAS" o "LLAMADAS DE SALIDA NO CONECTADAS"; otro valor se omite con aviso. Una hoja que trae SKILL_NAME nunca se toma como salida (así un CDR no se cuela aquí).

## Pendiente

Las abandonadas de ingreso siguen sin fuente definida (Edwin). Ver en README.md la propuesta de sacar ingreso y salida conectadas del mismo CDR.
