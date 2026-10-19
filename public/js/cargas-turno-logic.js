// cargas-turno-logic.js — Fase 154: cuando el servidor tiene el tope de
// cargas simultaneas lleno, responde 503 con codigo CARGAS_EN_CURSO (antes
// de leer el archivo: no se escribio nada) y la carga se reintenta sola.
// Logica pura (sin DOM) para poder probarla en node; la usa api.js.

var CARGAS_TURNO_CODIGO = 'CARGAS_EN_CURSO';
// Hasta ~3 minutos esperando turno; despues se muestra el error.
var CARGAS_TURNO_INTENTOS_MAX = 45;

// Milisegundos a esperar antes del siguiente intento, o null si no toca
// reintentar. `retryAfter` es la cabecera Retry-After (segundos, texto).
// Se suma un poco al azar para que varias cargas no reintenten a la vez.
function cargasTurnoEspera(status, data, intento, retryAfter, azar) {
  if (status !== 503 || !data || data.codigo !== CARGAS_TURNO_CODIGO) return null;
  if (intento >= CARGAS_TURNO_INTENTOS_MAX) return null;
  var base = Number(retryAfter);
  if (!(base > 0) || base > 30) base = 3;
  var r = typeof azar === 'number' ? azar : Math.random();
  return Math.round(base * 1000 + r * 1500);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CARGAS_TURNO_CODIGO: CARGAS_TURNO_CODIGO, CARGAS_TURNO_INTENTOS_MAX: CARGAS_TURNO_INTENTOS_MAX, cargasTurnoEspera: cargasTurnoEspera };
}
