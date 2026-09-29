// texto-formato-logic.js — InConexion Platform. Fase 87 (tema C, nota del
// jefe: "Unificar tipo de letra / letra capital").
//
// Logica PURA (sin DOM) de la regla de texto del dashboard, centralizada en
// UN SOLO lugar (pedido explicito): si el jefe pidiera despues TODO EN
// MAYUSCULAS en vez de mayuscula inicial, se cambia UNA sola cosa
// (TEXTO_CONFIG.modoMayusculas) y todo el dashboard sigue. Doble modo como
// esc.js: global en el navegador, require() en Node para las pruebas.
//
// Que formatea esta funcion: nombres que vienen DE LOS DATOS (skills, colas
// de WhatsApp, tipificaciones, especialidades, sedes, asesores) para
// MOSTRARLOS -- nunca cambia lo que esta guardado en la base ni lo que
// viaja en los filtros (esos siguen usando el valor original tal cual, tal
// como llego de Wolkvox). Los textos de la INTERFAZ que este archivo NO
// escribe (titulos, pestañas, botones, avisos -- literales en el codigo o
// en dashboards_config) se corrigen a mano en su lugar, con tildes y
// mayuscula inicial ya escritas en el texto -- esta funcion no puede
// inventar una tilde que la fuente de datos no trae.
'use strict';

// Fuente unica de la familia tipografica del dashboard -- el MISMO valor
// que --font-sans en public/css/styles.css (para HTML/CSS) y lo que usa
// Chart.js (charts.js: `Chart.defaults.font.family = TEXTO_FUENTE`, para
// ejes/leyendas/etiquetas de las graficas). Cambiar la fuente es cambiar
// este valor Y --font-sans en styles.css (dos lugares porque Chart.js no
// puede leer una variable CSS directo) -- todo el resto de los tamaños
// (titulo/subtitulo/pestañas/tarjetas) ya usa unidades relativas (rem) o
// hereda de estos 2 puntos, no hace falta tocar nada mas.
var TEXTO_FUENTE = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";

// Interruptor unico: TEXTO_CONFIG.modoMayusculas=true -> textoFormatoNombre
// devuelve TODO EN MAYUSCULAS en vez de mayuscula inicial por palabra.
// Nunca se toca nada mas si el jefe cambia de opinion sobre el estilo. Es un
// OBJETO (no un booleano suelto) a proposito: en Node, un `var` de modulo es
// privado al archivo (CommonJS lo envuelve en una funcion) y mutarlo desde
// afuera no se ve reflejado -- un objeto se pasa por referencia, asi que
// `TEXTO_CONFIG.modoMayusculas = true` desde quien importe este modulo SI
// cambia el comportamiento real (ver texto-formato-logic.test.js).
var TEXTO_CONFIG = { modoMayusculas: false };

// Siglas/abreviaturas que se quedan en mayusculas siempre, sin importar el
// modo -- lista CERRADA, ver texto-formato-logic.test.js para el mismo
// criterio de "lista cerrada nunca se auto-corrige" que ya usa
// mes-global-logic.js (Fase 86).
var TEXTO_SIGLAS = ['ORLANT', '3P', 'AHT', 'ASA', 'ATA', 'SL', 'EPS', 'ARL', 'KPI'];

// Palabras con capitalizacion propia (marca/nombre compuesto) que la regla
// generica de "solo la primera letra en mayuscula" no puede producir --
// coincide por palabra completa (insensible a mayusculas/minusculas), nunca
// como substring.
var TEXTO_ESPECIALES = { WHATSAPP: 'WhatsApp', INCONEXION: 'InConexion' };

function _textoFormatoPalabra(palabra) {
  if (!palabra) return palabra;
  var arriba = palabra.toUpperCase();
  if (TEXTO_CONFIG.modoMayusculas) return arriba;
  if (TEXTO_ESPECIALES[arriba]) return TEXTO_ESPECIALES[arriba];
  if (TEXTO_SIGLAS.indexOf(arriba) !== -1) return arriba;
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

// Formatea un nombre que viene de los datos (skill, cola, tipificacion,
// especialidad, sede, asesor) para MOSTRARLO: "_" se lee como espacio,
// mayuscula inicial por palabra (siglas y "especiales" intactas), o TODO EN
// MAYUSCULAS si TEXTO_CONFIG.modoMayusculas esta activo. NUNCA toca el valor
// original -- quien filtra por este valor debe seguir usando el que vino de
// la base, no el resultado de esta funcion (ver los call-sites: el `value`
// de un <option> es siempre el original, solo el texto visible pasa por
// aca).
function textoFormatoNombre(valor) {
  if (valor === null || valor === undefined) return valor;
  var s = String(valor).trim();
  if (!s) return s;
  s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').map(_textoFormatoPalabra).join(' ');
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEXTO_FUENTE: TEXTO_FUENTE,
    TEXTO_CONFIG: TEXTO_CONFIG,
    TEXTO_SIGLAS: TEXTO_SIGLAS,
    TEXTO_ESPECIALES: TEXTO_ESPECIALES,
    textoFormatoNombre: textoFormatoNombre,
  };
}
