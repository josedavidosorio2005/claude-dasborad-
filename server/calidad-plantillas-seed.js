// calidad-plantillas-seed.js — Plantillas de calificacion por campana.
//
// Se portaron 1:1 desde public/js/calidad.js (CAL_ITEMS_* y CAL_CAMPANAS). A
// partir de la migracion a servidor, ESTA es la unica fuente de verdad de los
// items, pesos, criticos y motor de cada campana. El frontend las pide por API
// (GET /api/calidad/plantillas) y ya no las tiene hardcodeadas.
//
// Solo se usan como semilla: si la tabla calidad_plantillas esta vacia se
// insertan estas filas. Editarlas despues (agregar campana, cambiar pesos) es
// trabajo de una fase posterior; por ahora se administran aqui.

'use strict';

const ITEMS_ORLANT = [
  { n: 1, cat: 'APERTURA', label: 'Guion de saludo', weight: 5, critico: false },
  { n: 2, cat: 'APERTURA', label: 'Solicita documento de identidad', weight: 4, critico: false },
  { n: 3, cat: 'APERTURA', label: 'Valida entidad y derechos', weight: 7, critico: true },
  { n: 4, cat: 'ESCUCHA', label: 'Identifica y gestiona el requerimiento', weight: 7, critico: false },
  { n: 5, cat: 'ESCUCHA', label: 'No interrumpe al paciente', weight: 3, critico: false },
  { n: 6, cat: 'GESTION', label: 'Revisa aplicativos y ofrece mejor disponibilidad', weight: 11, critico: true },
  { n: 7, cat: 'GESTION', label: 'Agendamiento correcto / Servinte', weight: 11, critico: true },
  { n: 8, cat: 'GESTION', label: 'Trazabilidad en el STA', weight: 8, critico: true },
  { n: 9, cat: 'GESTION', label: 'Confirma datos en sistema', weight: 4, critico: false },
  { n: 10, cat: 'GESTION', label: 'Confirmacion de la cita con el paciente', weight: 4, critico: false },
  { n: 11, cat: 'INFORMACION', label: 'Recomendaciones / preparacion', weight: 7, critico: true },
  { n: 12, cat: 'INFORMACION', label: 'Informa cancelacion', weight: 3, critico: false },
  { n: 13, cat: 'INFORMACION', label: 'Conocimiento del servicio', weight: 7, critico: true },
  { n: 14, cat: 'TIEMPOS', label: 'Acompanamiento en espera', weight: 3, critico: false },
  { n: 15, cat: 'TIEMPOS', label: 'Uso del mute', weight: 3, critico: false },
  { n: 16, cat: 'CIERRE', label: 'Despedida con protocolo', weight: 3, critico: false },
  { n: 17, cat: 'GESTION 3P', label: 'Gestion correcta pacientes 3P', weight: 10, critico: true },
];

// Plantilla generica estandar (10 items, pesos suman 100) para campanas que
// tienen pestana de Calidad pero no tienen una plantilla de calificacion
// propia -- hoy solo MOBILIZE (sin esto, POST /monitoreos fallaba con "Esa
// campana no tiene plantilla de calificacion" y su pestana de Calidad
// quedaba vacia). No hay definicion de negocio propia para Mobilize todavia,
// asi que se usa un formato estandar de contact center.
function plantillaGenerica(prefijoCategoria) {
  return [
    { n: 1, cat: 'APERTURA', label: 'Saludo y presentacion', weight: 6, critico: false },
    { n: 2, cat: 'APERTURA', label: 'Valida identidad del cliente', weight: 8, critico: true },
    { n: 3, cat: 'ESCUCHA', label: 'Escucha activa sin interrumpir', weight: 8, critico: false },
    { n: 4, cat: 'ESCUCHA', label: 'Identifica correctamente la necesidad', weight: 10, critico: true },
    { n: 5, cat: 'GESTION', label: 'Brinda informacion clara y completa', weight: 14, critico: true },
    { n: 6, cat: 'GESTION', label: 'Tono cordial y profesional', weight: 10, critico: false },
    { n: 7, cat: 'GESTION', label: 'Resuelve o gestiona correctamente la solicitud', weight: 16, critico: true },
    { n: 8, cat: 'GESTION', label: 'Registra correctamente en el sistema (CRM)', weight: 14, critico: true },
    { n: 9, cat: 'CIERRE', label: 'Cierre de llamada y se despide cordialmente', weight: 8, critico: false },
    { n: 10, cat: 'TIEMPOS', label: 'Manejo adecuado de tiempos y silencios', weight: 6, critico: false },
  ];
}

// engine: 'standard' (Orlant/generico) o 'sura' (sin uso hoy, ningun cliente
// activo lo usa -- se deja soportado en calidad-logic.js por si vuelve).
// Fase 134: solo ORLANT y MOBILIZE quedan en produccion (decision del
// usuario, 2026-10-09) -- el resto de plantillas (Infondo/Sura/Aurora/
// Cartera/Comfama/Andres Yepes/Sascha Fitness/Bivett) se quitaron del todo.
const PLANTILLAS = [
  { campana: 'ORLANT', engine: 'standard', items: ITEMS_ORLANT },
  { campana: 'MOBILIZE', engine: 'standard', items: plantillaGenerica() },
];

module.exports = { PLANTILLAS };
