# Agendas por usuaria

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `agendas_usuaria` (grupo salud)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** Reporte de citas de la clínica (.xls)

## De dónde sale

Es el reporte mensual de citas que exporta el sistema de la clínica (no Wolkvox), tal cual: un archivo .xls o .xlsx con una hoja (se llama como el mes, por ejemplo "oct") y una fila por cita. Se sube en Cargar Datos › Agendas por usuaria.

## Plantilla

No hay plantilla en `server/plantillas/`: se sube el reporte de la clínica sin cambiarlo. La hoja se reconoce por sus columnas.

## Privacidad

**El reporte trae datos de pacientes (documento, nombre, teléfono, dirección, diagnóstico, observaciones). Nada de eso sale del navegador**: el archivo se lee y se cuenta en el equipo de quien sube, y al servidor solo llegan cantidades por fecha de cita, fecha de solicitud, sede, usuario y especialidad. El servidor rechaza cualquier otro campo.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| fechacita (columna O) | Sí | Fecha de cita: el mes de la carga y el filtro "Fecha de cita" |
| fecha_registro (columna M) | Sí | Filtro "Fecha de solicitud de la cita" |
| usuario_confirma (columna BB) | Sí | Usuario de la asesora: "INCONEXION", "INCONEXION A"… (otro usuario cuenta como "Clínica (no InConexion)") |
| nombresede | Sí | Sede (filtro) |
| especial (columna AE) | Sí | Especialidad (vista "Agendas por especialidad") |

Mayúsculas y espacios en los nombres de columna no importan. Las fechas vienen como fecha o número de Excel y se convierten sin zona horaria.

## Vistas

Agendas por mes (línea de tiempo), Agendas por especialidad y Agendas por asesor (nombre real, línea por mes). Filtros: Sede, Asesor, Fecha de solicitud de la cita y Fecha de cita, además de MESES.

## Nombre real de la asesora

El archivo trae el usuario del sistema, no el nombre. El nombre se registra en Admin › Usuarios del sistema → asesora (por cliente) y se aplica al mostrar: si se corrige, cambian también los meses ya cargados. Sin registro, se ve el usuario tal cual.

## Qué período cubre y qué reemplaza

El mes es el de fechacita. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días, como las demás cargas).
