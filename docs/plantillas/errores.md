# Errores

> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.

- **Id del catálogo:** `errores` (grupo salud)
- **Lo usa hoy:** CLINICA AURORA
- **Carga que necesita:** Se registran en la plataforma (supervisor o administrador)

## De dónde sale

No se sube ninguna base. Los errores de agendamiento los registra el supervisor del cliente (o el administrador) en la plataforma: en la pestaña Errores del tablero, botón «Agregar errores». Por cada error: mes, asesora (lista de las asesoras del cliente), cantidad (1 = un error individual) y observación. También se escribe ahí el «Plan de acción» del mes.

## Qué muestra la pestaña

«Flujo de errores por mes» (línea con la cantidad de cada mes; sigue a MESES), «Plan de acción» del mes y «Errores por asesor» del mes, con «Ver observación» en cada error. La pestaña se ve aunque no haya errores (lo avisa). El cliente solo la mira.

## Privacidad

**Ningún dato de pacientes.** Se guarda solo mes, asesora, cantidad y observación; el servidor rechaza una observación o un plan con números de documento o de teléfono.

## Nombre real de la asesora

Sale de Admin › Usuarios del sistema (alias por cliente), igual que en Agendas por usuaria.

## Quién puede registrar

El administrador y el supervisor del cliente. Cada alta, edición o borrado queda con quién lo hizo y en el historial.
