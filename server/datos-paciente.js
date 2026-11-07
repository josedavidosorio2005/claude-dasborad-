// datos-paciente.js — Fase 287 (revision del 07/11, hallazgo #5): UNA sola regla para
// los textos libres que escribe el equipo (observaciones de Errores y de los
// monitoreos de Calidad, plan de accion): no pueden traer numeros de documento o de
// telefono de pacientes. Antes vivia solo en errores.js (Fase 284); los monitoreos no
// tenian ninguna revision.
'use strict';

// Un numero de 8 o mas cifras, con o sin espacios, puntos o guiones en medio.
const RE_DATO_PACIENTE = /\d[\d .-]{6,}\d/;

// Texto con un posible dato de paciente (documento, telefono).
function pareceDatoPaciente(texto) { return RE_DATO_PACIENTE.test(String(texto || '')); }

module.exports = { RE_DATO_PACIENTE, pareceDatoPaciente };
