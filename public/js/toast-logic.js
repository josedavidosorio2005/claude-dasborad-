// toast-logic.js — InConexion Platform (Fase 144, A7, hallazgo D12 de la
// Fase 143): los avisos (toast) se anuncian en el lector de pantalla.
//
// El aviso normal ("Guardado", "Carga guardada") va como role="status"
// aria-live="polite" (se lee cuando el lector termina lo que esta diciendo);
// un error va como role="alert" aria-live="assertive" (interrumpe). Los
// textos y el aspecto del aviso NO cambian -- solo los atributos.
//
// Es error si quien llama lo dice (showToast(msg, 'error'), lo usan los
// catch que muestran e.message) o si el texto empieza como los errores de
// siempre de la plataforma ("No se pudo...", "No se pudieron...", "Error...").
//
// Doble modo como el resto de *-logic.js de este repo: global en el
// navegador, require() en Node para las pruebas.
'use strict';

function toastEsError(msg, tipo) {
  if (tipo === 'error') return true;
  if (tipo === 'ok') return false;
  return /^\s*(no se pud|error\b)/i.test(String(msg == null ? '' : msg));
}

// Atributos ARIA que debe llevar #toast para ese aviso.
function toastAtributos(msg, tipo) {
  return toastEsError(msg, tipo)
    ? { role: 'alert', 'aria-live': 'assertive' }
    : { role: 'status', 'aria-live': 'polite' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toastEsError: toastEsError, toastAtributos: toastAtributos };
}
