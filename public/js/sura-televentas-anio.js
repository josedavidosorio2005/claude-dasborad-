// sura-televentas-anio.js — Fase 359 (pedido de Edwin, 17/11): filtro por año de Televentas (SURA),
// desde el encabezado de la plataforma (no se toca el HTML de Edwin). Lógica pura + el selector.
// Decisiones del usuario: por defecto, el año más reciente con datos; el selector va en el
// encabezado y aplica a todas las pestañas. Se ofrece también el año en curso (Colombia), para
// poder montar las bases de un año nuevo aunque todavía no tenga ninguna.
'use strict';

// Año actual en Colombia.
function stvAnioActual(ahora) {
  var d = ahora instanceof Date ? ahora : new Date();
  try { return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric' }).format(d)); }
  catch (e) { return new Date(d.getTime() - 5 * 3600 * 1000).getUTCFullYear(); }
}

// Años del selector: los que tienen bases + el actual, del más reciente al más viejo.
function stvAniosOpciones(conDatos, actual) {
  var s = {};
  (conDatos || []).forEach(function (a) { if (/^\d{4}$/.test(String(a))) s[Number(a)] = true; });
  if (actual) s[Number(actual)] = true;
  return Object.keys(s).map(Number).sort(function (a, b) { return b - a; });
}

// Por defecto: el más reciente con datos; sin datos, el actual.
function stvAnioPorDefecto(conDatos, actual) {
  var c = (conDatos || []).map(Number).filter(function (n) { return n > 0; });
  return c.length ? Math.max.apply(null, c) : Number(actual);
}

// Llena un <select> de año y lo deja en `elegido`.
function stvAnioPintarSelect(sel, opciones, elegido) {
  if (!sel) return;
  sel.innerHTML = opciones.map(function (a) { return '<option value="' + a + '"' + (a === elegido ? ' selected' : '') + '>' + a + '</option>'; }).join('');
}

// Después de cargar una app (tablero o Centro de cargas): arma el selector y aplica el año.
function stvAnioPreparar(app, sel, wrap) {
  if (!app || typeof app.anios !== 'function' || !sel) return null;
  var actual = stvAnioActual();
  var con = app.anios();
  var previo = Number(sel.value) || 0;
  var opciones = stvAniosOpciones(con, actual);
  var elegido = previo && opciones.indexOf(previo) !== -1 ? previo : stvAnioPorDefecto(con, actual);
  stvAnioPintarSelect(sel, opciones, elegido);
  if (wrap) wrap.classList.remove('hidden');
  app.anio(elegido);
  return elegido;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { stvAnioActual: stvAnioActual, stvAniosOpciones: stvAniosOpciones, stvAnioPorDefecto: stvAnioPorDefecto, stvAnioPintarSelect: stvAnioPintarSelect, stvAnioPreparar: stvAnioPreparar };
}
