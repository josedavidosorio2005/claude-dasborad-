# CDR líneas internas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `cdr_li` (grupo salud, **no disponible para clientes nuevos**)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** HistCDR de Wolkvox de las líneas internas (.xlsx)

## De dónde sale

Es el HistCDR de Wolkvox de las líneas internas, tal cual (.xlsx). Se sube en Cargar datos › Clínica Aurora › CDR líneas internas › Subir.

## Privacidad

**El CDR trae teléfono, CUSTOMER_ID, CONN_ID y comentarios. Nada de eso sale del navegador**: al servidor solo llegan cantidades por mes, agente, skill, tipo (entrada/salida) y tipificación.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| AGENT_NAME | Sí | Filtro por agente |
| DATE | Sí | El mes |
| DESCRIPTION_COD_ACT | Sí | La tipificación (las filas PRUEBA no se cuentan) |
| SKILL_NAME | Sí | El área; «-» = llamada de salida |
| SKILL_ID | No | El código del área (mapa `LI_SKILLS`) |

## Vista

Torta de tipificación (como la de Tipificación) con filtros de agente, skill y tipo (entrada / salida).

## Qué período cubre y qué reemplaza

El mes es el de DATE. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días).
