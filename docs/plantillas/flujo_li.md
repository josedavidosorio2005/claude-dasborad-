# Flujo líneas internas

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `flujo_li` (grupo salud, **no disponible para clientes nuevos**)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** HistQueue de Wolkvox de las líneas internas (.xlsx)

## De dónde sale

Es el HistQueue de Wolkvox de las líneas internas de la clínica, tal cual (.xlsx): una fila por área (skill) y día. Se sube en Cargar datos › Clínica Aurora › Flujo líneas internas › Subir. Si trae una hoja por área, se leen todas (sin columna de skill, el área sale del nombre de la hoja).

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| SKILL_NAME (o SKILL_ID) | No (si falta, el nombre de la hoja) | El área |
| DATE | Sí | Día y mes |
| INBOUND_CALLS | Sí | Total de llamadas |
| ANSWER_CALLS | Sí | Contestadas |
| ABANDON_CALLS | Sí | Abandonadas |
| SERVICE_LEVEL_20SEC | No | Nivel de servicio (promedio simple, como Tráfico de Llamadas) |

Cada columna se busca por su nombre, en cualquier orden (`LI_MAPA_FLUJO` en `public/js/lineas-internas-logic.js`). El nombre de cada área sale del mapa `LI_SKILLS` (código → nombre) del mismo archivo.

## Vista

Barras de total, contestadas y abandonadas, y la línea del nivel de servicio (%). Botones Todas + las 5 áreas: con «Todas», una barra por área; con un área, una barra por día.

## Qué período cubre y qué reemplaza

El mes es el de DATE. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días).
