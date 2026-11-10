# WhatsApp líneas internas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `whatsapp_li` (grupo salud, **no disponible para clientes nuevos**)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** HistChat de Wolkvox de las líneas internas (.xlsx)

## De dónde sale

Es el HistChat de Wolkvox de las líneas internas, tal cual (.xlsx). Se sube en Cargar datos › Clínica Aurora › WhatsApp líneas internas › Subir.

## Privacidad

**El HistChat trae CONN_ID, USER_ID, la cédula del agente y comentarios. Nada de eso sale del navegador**: al servidor solo llegan cantidades por mes, agente, skill y tipificación.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| AGENT_NAME | Sí | Filtro por agente |
| DATE_CLOSE (o DATE) | Sí | El mes (Wolkvox arma el reporte por fecha de cierre) |
| DESCRIPTION_COD_ACT | Sí | La tipificación (las filas PRUEBA no se cuentan) |
| SKILL_ID | Sí | El skill: el nombre sale del mapa `LI_SKILLS`; un código fuera del mapa se ve como «Skill <código>» |

## Vista

Torta de tipificación con filtros de agente y skill.

## Qué período cubre y qué reemplaza

El mes es el de DATE_CLOSE. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días).
