# Inasistencia (Aurora)

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `inasistencia_au` (grupo salud, **no disponible para clientes nuevos**)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** Base para sacar inasistencias de la clínica (.xls)

## De dónde sale

Es la «BASE PARA SACAR INASISTENCIAS» que exporta el sistema de la clínica, tal cual (.xls o .xlsx): una fila por cita. Se sube en Cargar datos › Clínica Aurora › Inasistencia (Aurora) › Subir.

## Privacidad

**La base trae datos de pacientes (documento, nombre, observaciones). Nada de eso sale del navegador**: al servidor solo llegan, por mes y especialidad, el total de citas y cuántas tienen estado «No asistió».

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| fecha | Sí | El mes de la cita |
| especialidad | Sí | Agrupa la gráfica |
| estado | Sí | «No asistió» cuenta como inasistencia (sin importar tildes ni mayúsculas) |

Cada columna se busca por su nombre, en cualquier orden (`INA_MAPA_ENCABEZADOS` en `public/js/aurora-bases-logic.js`).

## Vista

% de inasistencia por especialidad = citas con estado «No asistió» ÷ total de citas de la especialidad × 100. Solo el porcentaje, de mayor a menor, con los nombres completos.

## Qué período cubre y qué reemplaza

El mes es el de la columna fecha. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días).
