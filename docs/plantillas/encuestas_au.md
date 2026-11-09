# Encuestas (Aurora)

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `encuestas_au` (grupo salud, **no disponible para clientes nuevos**)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** Compilado de encuestas de la clínica (.xlsx)

## De dónde sale

Es el «COMPILADO ENCUESTAS» de la clínica, tal cual (.xlsx): una fila por encuesta. Se sube en Cargar datos › Clínica Aurora › Encuestas (Aurora) › Subir.

## Privacidad

**El compilado trae cédula, nombre y celular. Nada de eso sale del navegador**: al servidor solo llegan cantidades de encuestas por fecha y entidad.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| fecha | Sí | Día de la encuesta (línea de tiempo) y su mes |
| entidad | Sí | Una barra por entidad; las filas sin entidad no se grafican |

Cada columna se busca por su nombre, en cualquier orden (`ENC_MAPA_ENCABEZADOS` en `public/js/aurora-bases-logic.js`).

## Vista

Encuestas por entidad (barras, de mayor a menor) y encuestas por fecha (línea de tiempo).

## Qué período cubre y qué reemplaza

El mes es el de la columna fecha. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días).
