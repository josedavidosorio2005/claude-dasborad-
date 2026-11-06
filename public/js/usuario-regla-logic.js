// usuario-regla-logic.js — Fase 280 (pedido de Edwin, 06/11): no se pudo crear un
// usuario del estilo «nombre_apellido». La regla (la misma del servidor, userSchema en
// server/validation.js) ya lo permitia: 3 a 32 caracteres, letras SIN tilde,
// numeros, punto, guion y guion bajo. Lo que fallaba era el aviso: decia lo mismo
// para todo, sin decir que sobraba (lo mas comun: una tilde, «gonzález», o un
// espacio). Ahora dice exactamente que corregir. Sin DOM.
'use strict';

var USUARIO_MIN = 3;
var USUARIO_MAX = 32;
var USUARIO_REGLA_TEXTO = USUARIO_MIN + ' a ' + USUARIO_MAX + ' caracteres: letras sin tilde, números, punto (.), guion (-) y guion bajo (_). Ej.: maria_gonzalez';

// null si el usuario sirve; si no, el aviso de que corregir.
function usuarioProblema(user) {
  var u = String(user == null ? '' : user).trim();
  if (!u) return 'Escribe el usuario.';
  if (u.length < USUARIO_MIN) return 'El usuario debe tener al menos ' + USUARIO_MIN + ' caracteres.';
  if (u.length > USUARIO_MAX) return 'El usuario puede tener hasta ' + USUARIO_MAX + ' caracteres (tiene ' + u.length + ').';
  if (/\s/.test(u)) return 'El usuario no puede tener espacios. Usa punto o guion bajo: por ejemplo «' + u.replace(/\s+/g, '_') + '».';
  var sinTilde = u.normalize ? u.normalize('NFD').replace(/[̀-ͯ]/g, '') : u;
  if (/[ñÑ]/.test(u) || sinTilde !== u) {
    var sugerido = sinTilde.replace(/ñ/g, 'n').replace(/Ñ/g, 'N');
    return 'El usuario no puede tener tildes ni ñ. Escríbelo sin tilde: «' + sugerido + '».';
  }
  var raros = u.replace(/[a-zA-Z0-9._-]/g, '');
  if (raros) return 'El usuario no puede tener «' + Array.from(new Set(raros.split(''))).join(' ') + '». Solo letras sin tilde, números, punto, guion y guion bajo.';
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { USUARIO_MIN: USUARIO_MIN, USUARIO_MAX: USUARIO_MAX, USUARIO_REGLA_TEXTO: USUARIO_REGLA_TEXTO, usuarioProblema: usuarioProblema };
}
