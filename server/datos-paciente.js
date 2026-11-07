// datos-paciente.js — Fase 287 (revision del 07/11, hallazgo #5): UNA sola regla para
// los textos libres que escribe el equipo (observaciones de Errores y de los
// monitoreos de Calidad, plan de accion): no pueden traer numeros de documento o de
// telefono de pacientes. Antes vivia solo en errores.js (Fase 284); los monitoreos no
// tenian ninguna revision.
//
// Fase 288 (hallazgo #11): una FECHA no es un dato de paciente. «15-10-2026»,
// «2026-10-15», «15 10 2026» o «15.10.2026» (con o sin hora) ya no se rechazan, y el
// mensaje dice cual numero se rechazo.
'use strict';

// Un numero de 8 o mas cifras, con o sin espacios, puntos o guiones en medio.
const RE_DATO_PACIENTE = /\d[\d .-]{6,}\d/g;
// Fechas que se quitan antes de buscar: D-M-AAAA / AAAA-M-D con -, espacio o punto,
// y una hora opcional (10:30 o 10:30:15) pegada.
const RE_FECHAS = [
  /(^|[^\d])(\d{1,2})[-. ](\d{1,2})[-. ](\d{4})(?![\d])/g,
  /(^|[^\d])(\d{4})[-. ](\d{1,2})[-. ](\d{1,2})(?![\d])/g,
];

function _esFecha(a, b, c, anioPrimero) {
  const anio = Number(anioPrimero ? a : c);
  const x = Number(b);
  const y = Number(anioPrimero ? c : a);
  if (anio < 1900 || anio > 2100) return false;
  // Dia y mes en cualquier orden (D-M o M-D), los dos validos.
  const dia = (n) => n >= 1 && n <= 31;
  const mes = (n) => n >= 1 && n <= 12;
  return (dia(y) && mes(x)) || (mes(y) && dia(x));
}

// El texto sin las fechas (se cambian por espacios del mismo largo).
function _sinFechas(texto) {
  let t = String(texto || '');
  RE_FECHAS.forEach((re, k) => {
    t = t.replace(re, (todo, pre, a, b, c) => (_esFecha(a, b, c, k === 1) ? pre + ' '.repeat(todo.length - pre.length) : todo));
  });
  return t;
}

// El primer numero que parece un documento o telefono (tal como se escribio), o null.
function datoPacienteEncontrado(texto) {
  const original = String(texto || '');
  const limpio = _sinFechas(original);
  RE_DATO_PACIENTE.lastIndex = 0;
  const m = RE_DATO_PACIENTE.exec(limpio);
  RE_DATO_PACIENTE.lastIndex = 0;
  return m ? original.substr(m.index, m[0].length).trim() : null;
}

// Texto con un posible dato de paciente (documento, telefono).
function pareceDatoPaciente(texto) { return datoPacienteEncontrado(texto) !== null; }

// Mensaje para quien escribio: que campo y que numero se rechazo.
function mensajeDatoPaciente(campo, texto) {
  const n = datoPacienteEncontrado(texto);
  return campo + ' tiene «' + n + '», que parece un documento o teléfono (datos de pacientes). Escríbelo sin ese número; las fechas sí se pueden escribir.';
}

module.exports = { pareceDatoPaciente, datoPacienteEncontrado, mensajeDatoPaciente };
