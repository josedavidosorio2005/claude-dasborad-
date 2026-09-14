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

const ITEMS_INFONDO = [
  { n: 1, cat: 'APERTURA', label: 'Saludo', weight: 5, critico: false },
  { n: 2, cat: 'APERTURA', label: 'Valida correctamente la identidad del cliente', weight: 9, critico: false },
  { n: 3, cat: 'ESCUCHA', label: 'Escucha activamente sin interrumpir', weight: 7, critico: false },
  { n: 4, cat: 'ESCUCHA', label: 'Identifica correctamente la necesidad del cliente', weight: 9, critico: true },
  { n: 5, cat: 'GESTION', label: 'Brinda informacion clara y completa', weight: 12, critico: true },
  { n: 6, cat: 'GESTION', label: 'Utiliza lenguaje cordial y profesional', weight: 10, critico: false },
  { n: 7, cat: 'GESTION', label: 'Resuelve la solicitud o brinda la gestion correcta', weight: 13, critico: true },
  { n: 8, cat: 'GESTION', label: 'Ofrece alternativas o brinda gestion necesaria', weight: 10, critico: false },
  { n: 9, cat: 'GESTION', label: 'Registra correctamente la gestion en el sistema (CRM)', weight: 13, critico: true },
  { n: 10, cat: 'CIERRE', label: 'Cierre de llamada y se despide cordialmente', weight: 7, critico: false },
  { n: 11, cat: 'TIEMPOS', label: 'Retoma la llamada cada 60 segundos', weight: 5, critico: false },
];

const ITEMS_SURA = [
  { n: 1, cat: 'ACTITUD Y COMUNICACION', label: 'Saludo y despedida', weight: 7, critico: false },
  { n: 2, cat: 'ACTITUD Y COMUNICACION', label: 'Intencionalidad', weight: 6, critico: true },
  { n: 3, cat: 'ACTITUD Y COMUNICACION', label: 'Amabilidad y trato hacia el cliente', weight: 12, critico: true },
  { n: 4, cat: 'ACTITUD Y COMUNICACION', label: 'Expresion verbal, seguridad y confianza', weight: 5, critico: false },
  { n: 5, cat: 'CONOCIMIENTO Y PERFILACION', label: 'Conocimiento producto', weight: 12, critico: true },
  { n: 6, cat: 'CONOCIMIENTO Y PERFILACION', label: 'Filtros obligatorios y perfilacion', weight: 12, critico: true },
  { n: 7, cat: 'MANEJO DE OBJECIONES', label: 'Manejo de objeciones (minimo 3 por llamada)', weight: 12, critico: true },
  { n: 8, cat: 'MANEJO DE OBJECIONES', label: 'Manejo de objeciones 2 (solo 2 objeciones)', weight: 9, critico: false },
  { n: 9, cat: 'MANEJO DE OBJECIONES', label: 'Manejo de objeciones 1 (solo 1 objecion)', weight: 7, critico: false },
  { n: 10, cat: 'CIERRE', label: 'Escucha activa concentracion', weight: 6, critico: false },
  { n: 11, cat: 'CIERRE', label: 'Tipificacion', weight: 12, critico: true },
];

const ITEMS_AURORA = [
  { n: 1, cat: 'GUION', label: 'Saludo', weight: 5, critico: false },
  { n: 2, cat: 'GUION', label: 'Escucha activa', weight: 8, critico: false },
  { n: 3, cat: 'GUION', label: 'Revision (aplicativos y disponibilidad)', weight: 10, critico: true },
  { n: 4, cat: 'GUION', label: 'Manejo de tiempos de espera y acompanamiento', weight: 4, critico: false },
  { n: 5, cat: 'GUION / AGENDAMIENTO', label: 'Agendamiento correcto', weight: 10, critico: true },
  { n: 6, cat: 'GUION / AGENDAMIENTO', label: 'Registro en sistema', weight: 12, critico: false },
  { n: 7, cat: 'GUION', label: 'Recomendaciones', weight: 10, critico: true },
  { n: 8, cat: 'GUION', label: 'Confirma paciente (fecha y hora de la cita)', weight: 8, critico: false },
  { n: 9, cat: 'GUION', label: 'Conocimiento del producto', weight: 10, critico: true },
  { n: 10, cat: 'CORDIALIDAD', label: 'Uso del mute', weight: 5, critico: false },
  { n: 11, cat: 'CORDIALIDAD', label: 'Cordialidad y respeto', weight: 13, critico: true },
  { n: 12, cat: 'CORDIALIDAD', label: 'Despedida', weight: 5, critico: false },
];

const ITEMS_CARTERA = [
  { n: 1, cat: 'APERTURA', label: 'Saludo', weight: 5, critico: false },
  { n: 2, cat: 'APERTURA', label: 'Grabacion de la llamada o chat', weight: 7, critico: false },
  { n: 3, cat: 'APERTURA', label: 'Motivo de la llamada', weight: 9, critico: false },
  { n: 4, cat: 'COMUNICACION', label: 'Comunicacion oral y cumplimiento de parametros de cobranza', weight: 9, critico: false },
  { n: 5, cat: 'GESTION', label: 'Buen uso de los argumentos - Persuade al cliente', weight: 7, critico: true },
  { n: 6, cat: 'GESTION', label: 'Objeciones', weight: 9, critico: true },
  { n: 7, cat: 'GESTION', label: 'Liquidacion del credito', weight: 12, critico: true },
  { n: 8, cat: 'GESTION', label: 'Resolucion de la llamada - dudas', weight: 5, critico: false },
  { n: 9, cat: 'GESTION', label: 'Medios de pago', weight: 13, critico: true },
  { n: 10, cat: 'LEGAL', label: 'Habeas data', weight: 5, critico: false },
  { n: 11, cat: 'GESTION', label: 'Documenta gestion de la llamada', weight: 5, critico: false },
  { n: 12, cat: 'COMUNICACION', label: 'Ortografia', weight: 5, critico: false },
  { n: 13, cat: 'CIERRE', label: 'Cierre de la llamada', weight: 6, critico: false },
  { n: 14, cat: 'TIEMPOS', label: 'Tiempo de retoma de llamada', weight: 3, critico: false },
];

const ITEMS_COMFAMA = [
  { n: 1, cat: 'NO NEGOCIABLES', label: 'Presentacion y alianza (SURA Vida / Colmena Desempleo / Los Olivos Exequial)', weight: 5, critico: true },
  { n: 2, cat: 'NO NEGOCIABLES', label: '3 coberturas minimas con valores correctos', weight: 10, critico: true },
  { n: 3, cat: 'NO NEGOCIABLES', label: 'Medio de pago, meses de pignoracion y vigencia', weight: 8, critico: true },
  { n: 4, cat: 'NO NEGOCIABLES', label: 'Pregunta PEP (persona politicamente expuesta)', weight: 5, critico: true },
  { n: 5, cat: 'NO NEGOCIABLES', label: 'Habeas Data (autorizacion tratamiento de datos)', weight: 4, critico: true },
  { n: 6, cat: 'NO NEGOCIABLES', label: 'Codigos OTP (1ro datos/condiciones, 2do debito)', weight: 3, critico: true },
  { n: 7, cat: 'COMERCIAL', label: 'Generar necesidad (conexion emocional antes del plan)', weight: 13, critico: false },
  { n: 8, cat: 'COMERCIAL', label: 'Manejo de objeciones', weight: 15, critico: false },
  { n: 9, cat: 'COMERCIAL', label: 'Cierre efectivo', weight: 12, critico: false },
  { n: 10, cat: 'ATRIBUTOS', label: 'Empatia', weight: 8, critico: false },
  { n: 11, cat: 'ATRIBUTOS', label: 'Resolutividad', weight: 6, critico: false },
  { n: 12, cat: 'ATRIBUTOS', label: 'Mentoria (adapta la explicacion al cliente)', weight: 6, critico: false },
  { n: 13, cat: 'ATRIBUTOS', label: 'Empoderamiento (seguridad y dominio)', weight: 5, critico: false },
];

// Plantilla generica estandar (10 items, pesos suman 100) para las campanas de
// M3 (dashboard-plantillas-cliente.js) que tienen pestana de Calidad pero no
// tenian una plantilla de calificacion propia (ANDRES YEPES, MOVILIZE, SASCHA
// FITNESS, BIVETT): sin esto, POST /monitoreos fallaba con "Esa campana no
// tiene plantilla de calificacion" y su pestana de Calidad quedaba vacia. No
// habia definicion de negocio para estas 4, asi que se usa un formato
// estandar de contact center (mismo criterio que las plantillas de dashboard).
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

// engine: 'standard' (Orlant/Infondo/Aurora/Cartera/Comfama/generico) o 'sura'.
const PLANTILLAS = [
  { campana: 'ORLANT', engine: 'standard', items: ITEMS_ORLANT },
  { campana: 'INFONDO', engine: 'standard', items: ITEMS_INFONDO },
  { campana: 'TELEVENTAS SURA', engine: 'sura', items: ITEMS_SURA },
  { campana: 'CLINICA AURORA', engine: 'standard', items: ITEMS_AURORA },
  { campana: 'CARTERA INTERNA', engine: 'standard', items: ITEMS_CARTERA },
  { campana: 'TELEVENTAS COMFAMA', engine: 'standard', items: ITEMS_COMFAMA },
  { campana: 'ANDRES YEPES', engine: 'standard', items: plantillaGenerica() },
  { campana: 'MOVILIZE', engine: 'standard', items: plantillaGenerica() },
  { campana: 'SASCHA FITNESS', engine: 'standard', items: plantillaGenerica() },
  { campana: 'BIVETT', engine: 'standard', items: plantillaGenerica() },
];

module.exports = { PLANTILLAS };
