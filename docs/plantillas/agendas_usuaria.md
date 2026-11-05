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

**El reporte trae datos de pacientes (documento, nombre, teléfono, dirección, diagnóstico, observaciones). Nada de eso sale del navegador**: el archivo se lee y se cuenta en el equipo de quien sube, y al servidor solo llegan cantidades por mes, día, sede, usuario, canal, tipo de cita y tipo de paciente. El servidor rechaza cualquier otro campo.

## Columnas que lee el sistema

| Columna | Obligatoria | Para qué |
|---|---|---|
| fechacita | Sí | Mes de la cita (el mes de la carga) |
| usuario_confirma | Sí | Quién confirmó: "INCONEXION", "INCONEXION A"… (otro usuario cuenta como "Clínica (no InConexion)") |
| motivo_conf | Sí | Canal: Llamada, WhatsApp, No contesta u Otro (texto libre, se reconocen erratas como "LALMADA", "WWP", "NO CONETESTA") |
| fecha_confirma | Sí | Día en que se confirmó (gráfica por día) |
| nombresede | Sí | Sede |
| usuario_regcita | No | Quién creó la cita (tarjeta y columna "Creadas") |
| consulta, cirugia | No | Tipo de cita: Cirugía, Consulta u Otro |
| tipo_paciente | No | Nuevo / Antiguo |

Mayúsculas y espacios en los nombres de columna no importan. Las fechas vienen como número de Excel y se convierten sin zona horaria.

## Nombre real de la asesora

El archivo trae el usuario del sistema, no el nombre. El nombre se registra en Admin › Usuarios del sistema → asesora (por cliente) y se aplica al mostrar: si se corrige, cambian también los meses ya cargados. Sin registro, se ve el usuario tal cual.

## Qué período cubre y qué reemplaza

El mes es el de fechacita. Subir otra vez un mes lo reemplaza entero (Deshacer por 30 días, como las demás cargas).
