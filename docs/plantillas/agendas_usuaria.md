# Agendas (3 bases)

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `agendas_usuaria` (grupo salud)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** 3 bases de la clínica: citas, cancelaciones e inasistencias (.xls)

## De dónde sale

Son las 3 bases que exporta el sistema de la clínica (no Wolkvox), tal cual: **Citas asignadas y cumplidas**, **Cancelaciones** e **Inasistencias**, un archivo .xls o .xlsx por base y una fila por cita. Se suben en Cargar datos › Clínica Aurora › Agendas › Subir (una o las tres a la vez; cada una en su casilla). En la carga de un solo archivo, la base se reconoce por el nombre del archivo.

## Plantilla

No hay plantilla en `server/plantillas/`: se suben las bases sin cambiarlas. Cada columna se busca por su nombre, en cualquier orden (sin importar mayúsculas, tildes, espacios ni guiones bajos). El mapa de nombres y sinónimos está en `public/js/agendas-usuaria-logic.js` (`AU_MAPA_ENCABEZADOS`; las bases en `AU_TIPOS_BASE`).

## Privacidad

**Las bases traen datos de pacientes (nombres, cédula, teléfono, dirección, diagnóstico, observaciones). Nada de eso sale del navegador**: el archivo se lee y se cuenta en el equipo de quien sube, y al servidor solo llegan cantidades por fecha de cita, fecha de registro, entidad, usuario que registra, especialidad, profesional, sede y base. El servidor rechaza cualquier otro campo.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| fechacita | Sí | Fecha de cita: el mes de la carga, la gráfica por mes y el filtro "Fecha de cita" |
| fecha_registro | No (Cancelaciones e Inasistencias no la traen) | Gráfica por mes según "Fecha de registro" y su filtro |
| entidad | No | Filtro "Entidad" |
| usuario_regcita | No | Usuario que registra: "INCONEXION", "INCONEXION A"… (otro usuario cuenta como "Clínica (no InConexion)") |
| especial | No | Especialidad (filtro y gráfica) |
| prof | No | Profesional (filtro y gráfica) |
| nombresede (si no, sede) | No | Sede (filtro); `sede` trae un código, por eso va primero `nombresede` |

Si una base no trae una columna que no es obligatoria, no es error: esas citas no suman en lo que dependa de esa columna. Las fechas vienen como fecha o número de Excel y se convierten sin zona horaria.

## Vistas

Una sola vista: filtros arriba (fecha de registro, fecha de cita, entidad, usuario que registra, especialidad, profesional y sede), botones de base (Todas / Citas asignadas y cumplidas / Cancelaciones / Inasistencias), una gráfica de línea por mes (según fecha de registro o fecha de cita) y una de barras por usuario que registra, especialidad o profesional (las 10 primeras, con "Ver más").

## Nombre real de la asesora

El archivo trae el usuario del sistema, no el nombre. El nombre se registra en Admin › Usuarios del sistema → asesora (por cliente) y se aplica al mostrar: si se corrige, cambian también los meses ya cargados. Sin registro, se ve el usuario tal cual. El cliente ve "Asesor 1, 2…".

## Qué período cubre y qué reemplaza

El mes es el de fechacita. Subir otra vez una base reemplaza solo esa base del mes (Deshacer por 30 días, como las demás cargas). Lo cargado antes con el reporte de una sola base no se muestra en esta vista.
