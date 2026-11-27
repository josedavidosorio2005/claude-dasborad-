// activos-formularios.js — Fase 372 (pedido de Edwin 18/11, E4): formularios editables del
// «Inventario de sistemas» por ADMIN y SISTEMAS (los permisos los revisa la ruta con A.puede).
//
// - Tipos: renombrar, crear, desactivar (solo sin elementos vigentes) y editar sus campos propios
//   (texto, número o lista con opciones), en el orden que se envían.
// - Un campo NUNCA se borra: se oculta (`oculto: true`). Su clave (`k`) y su tipo (`t`) no cambian,
//   así lo ya guardado en los elementos sigue valiendo. Una opción de lista en uso no se quita.
// - Textos del acta (entrega y devolución): cada acta guarda una COPIA del texto vigente al crearse
//   (activos-actas.js), así cambiar el texto no altera actas ya firmadas.
// Los estados (libre, en uso, en reparación, malo, de baja) siguen fijos: la asignación depende de ellos.
'use strict';

const A = require('./activos');

const TIPOS_CAMPO = ['texto', 'numero', 'lista'];
const MAX_CAMPOS = 30;
const MAX_OPCIONES = 30;
const TEXTOS = {
  acta_entrega: { nombre: 'Texto del acta de entrega', base: 'Recibo los elementos de esta acta en buen estado, para uso exclusivo de mis funciones. Me comprometo a cuidarlos y a devolverlos cuando se me pidan o al terminar mi vinculación, y a informar a Sistemas cualquier daño o pérdida.' },
  acta_devolucion: { nombre: 'Texto del acta de devolución', base: 'Se reciben de vuelta los elementos de esta acta, en el estado que se indica en cada uno.' },
  // Fase 379 (I4): actas automáticas.
  acta_cambio: { nombre: 'Texto del acta de cambio de elemento', base: 'El agente entrega los elementos marcados «devuelve» y recibe los marcados «recibe», en buen estado, con los mismos compromisos del acta de entrega.' },
  acta_reparacion: { nombre: 'Texto del acta de envío a reparación', base: 'Se entregan para revisión o reparación los elementos de esta acta, con el diagnóstico indicado. Quien los recibe se compromete a devolverlos reparados o con el concepto técnico.' },
  acta_retorno: { nombre: 'Texto del acta de recibo de reparación', base: 'Sistemas recibe los elementos de esta acta y los deja disponibles para entregar.' },
  acta_malo: { nombre: 'Texto del acta de elemento malo', base: 'Se reportan en mal estado los elementos de esta acta, con el motivo indicado. No se entregan a ningún agente hasta su revisión.' },
  acta_baja: { nombre: 'Texto del acta de baja', base: 'Se dan de baja los elementos de esta acta, con el motivo indicado. Salen del inventario disponible.' },
};

function crearTablas(db) {
  db.exec('CREATE TABLE IF NOT EXISTS activos_textos (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, updatedAt TEXT NOT NULL, quien TEXT NOT NULL DEFAULT \'\')');
}

const _txt = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
// «Memoria RAM (GB)» → «memoria_ram_gb»; «Cámara IP» → «CAMARA_IP» para el código de un tipo.
function slug(s, max) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max || 30).replace(/_+$/, '');
}

// Valores de cada campo de lista que usan hoy los elementos del tipo: { k: Map(opción → cuántos) }.
function _enUso(db, codigo) {
  const uso = {};
  for (const r of db.prepare('SELECT datos FROM activos WHERE tipo = ?').all(codigo)) {
    let d = {}; try { d = JSON.parse(r.datos || '{}'); } catch (e) { d = {}; }
    for (const [k, v] of Object.entries(d)) { uso[k] = uso[k] || new Map(); uso[k].set(v, (uso[k].get(v) || 0) + 1); }
  }
  return uso;
}

// Valida nombre, plural y campos de un tipo. `actual` = el tipo guardado (null si es nuevo).
// -> { error } o { valores: { nombre, plural, campos } }
function validarTipo(db, b, actual) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'Datos no válidos' };
  if (Object.keys(b).some((k) => !['nombre', 'plural', 'campos', 'asignable'].includes(k))) return { error: 'Datos no válidos' };
  // Fase INV2 (HTML de Edwin): «Se asigna a agentes». Sí: funciona como un portátil; No: es un componente del
  // inventario. Un tipo nuevo se asigna salvo que se diga lo contrario. No se cambia si el tipo ya tiene elementos.
  if ('asignable' in b && typeof b.asignable !== 'boolean') return { error: 'Datos no válidos' };
  let asignable = actual ? actual.asignable !== false : true;
  if ('asignable' in b && b.asignable !== asignable) {
    if (actual && actual.codigo === 'ADMINISTRABLE') return { error: 'Los equipos administrables no se asignan a agentes' };
    if (actual && (actual.ambito || 'sistemas') === 'inmuebles') return { error: 'Los inmuebles no se asignan a agentes' };
    const n = actual ? db.prepare('SELECT COUNT(*) n FROM activos WHERE tipo = ?').get(actual.codigo).n : 0;
    if (n) return { error: '«Se asigna a agentes» no se puede cambiar: ya hay ' + n + ' elemento(s) de este tipo' };
    asignable = b.asignable;
  }
  const nombre = _txt(b.nombre, 40), plural = _txt(b.plural, 40);
  if (nombre.length < 2) return { error: 'Escribe el nombre del tipo (2 a 40 caracteres)' };
  if (plural.length < 2) return { error: 'Escribe el plural del tipo (2 a 40 caracteres)' };
  const otro = A.tipos(db, { todos: true }).find((t) => (!actual || t.codigo !== actual.codigo) && t.nombre.toLowerCase() === nombre.toLowerCase());
  if (otro) return { error: 'Ya hay un tipo llamado ' + otro.nombre };
  if (!Array.isArray(b.campos) || b.campos.length > MAX_CAMPOS) return { error: 'Hasta ' + MAX_CAMPOS + ' campos por tipo' };
  const previos = new Map(((actual && actual.campos) || []).map((c) => [c.k, c]));
  const uso = actual ? _enUso(db, actual.codigo) : {};
  const campos = [], etiquetas = new Set(), claves = new Set();
  for (const c of b.campos) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some((k) => !['k', 'l', 't', 'o', 'oculto'].includes(k))) return { error: 'Datos no válidos' };
    const l = _txt(c.l, 60);
    if (l.length < 2) return { error: 'Cada campo necesita un nombre (2 a 60 caracteres)' };
    if (etiquetas.has(l.toLowerCase())) return { error: 'Hay dos campos llamados «' + l + '»' };
    etiquetas.add(l.toLowerCase());
    if ('oculto' in c && typeof c.oculto !== 'boolean') return { error: 'Datos no válidos' };
    let k, t;
    if (c.k !== undefined) {
      const p = previos.get(c.k);
      if (!p) return { error: 'Campo no encontrado: «' + l + '»' };
      k = p.k; t = p.t;
      if (c.t !== undefined && c.t !== p.t) return { error: 'El tipo de dato de «' + l + '» no se cambia (lo guardado dejaría de valer): crea un campo nuevo y oculta este' };
    } else {
      if (!TIPOS_CAMPO.includes(c.t)) return { error: '«' + l + '»: elige texto, número o lista' };
      t = c.t;
      const base = slug(l) || 'campo';
      k = base; let i = 2;
      while (previos.has(k) || claves.has(k)) k = base.slice(0, 27) + '_' + i++;
    }
    if (claves.has(k)) return { error: 'Campo repetido: «' + l + '»' };
    claves.add(k);
    const campo = { k, l, t };
    if (t === 'lista') {
      if (!Array.isArray(c.o) || !c.o.length || c.o.length > MAX_OPCIONES || !c.o.every((x) => typeof x === 'string')) return { error: '«' + l + '»: escribe de 1 a ' + MAX_OPCIONES + ' opciones' };
      const o = [...new Set(c.o.map((x) => _txt(x, 60)).filter(Boolean))];
      if (!o.length) return { error: '«' + l + '»: escribe de 1 a ' + MAX_OPCIONES + ' opciones' };
      const usadas = uso[k] ? [...uso[k].entries()].filter(([v]) => !o.includes(v)) : [];
      if (usadas.length) return { error: '«' + l + '»: la opción «' + usadas[0][0] + '» la usan ' + usadas[0][1] + ' elemento(s); no se puede quitar' };
      campo.o = o;
    } else if (c.o !== undefined && !(Array.isArray(c.o) && !c.o.length)) return { error: '«' + l + '»: solo las listas llevan opciones' };
    if (c.oculto) campo.oculto = true;
    campos.push(campo);
  }
  const faltan = [...previos.values()].filter((p) => !claves.has(p.k));
  if (faltan.length) return { error: 'Un campo no se borra: oculta «' + faltan[0].l + '» en vez de quitarlo' };
  return { valores: { nombre, plural, campos, asignable } };
}

function crearTipo(db, b, ambito) {
  const v = validarTipo(db, b, null);
  if (v.error) return v;
  const base = slug(v.valores.nombre, 20).toUpperCase() || 'TIPO';
  const existentes = new Set(A.tipos(db, { todos: true }).map((t) => t.codigo));
  let codigo = base, i = 2;
  while (existentes.has(codigo)) codigo = base.slice(0, 17) + '_' + i++;
  const orden = (db.prepare('SELECT COALESCE(MAX(orden), 0) n FROM activos_tipos').get().n) + 1;
  const amb = A.ambitoDe(ambito);
  if (amb === 'inmuebles' && b.asignable === true) return { error: 'Los inmuebles no se asignan a agentes' };
  db.prepare('INSERT INTO activos_tipos (codigo, nombre, plural, orden, activo, campos, ambito, asignable) VALUES (?,?,?,?,1,?,?,?)').run(codigo, v.valores.nombre, v.valores.plural, orden, JSON.stringify(v.valores.campos), amb, amb === 'inmuebles' ? 0 : (v.valores.asignable ? 1 : 0));
  return { tipo: A.tipo(db, codigo, { todos: true }) };
}
function editarTipo(db, codigo, b) {
  const actual = A.tipo(db, codigo, { todos: true });
  if (!actual) return { error: 'Tipo no encontrado', status: 404 };
  const v = validarTipo(db, b, actual);
  if (v.error) return v;
  db.prepare('UPDATE activos_tipos SET nombre = ?, plural = ?, campos = ?, asignable = ? WHERE codigo = ?').run(v.valores.nombre, v.valores.plural, JSON.stringify(v.valores.campos), v.valores.asignable ? 1 : 0, codigo);
  return { tipo: A.tipo(db, codigo, { todos: true }), antes: actual };
}
// Desactivar: solo sin elementos vigentes (todos de baja o ninguno). Sus elementos de baja se siguen viendo.
function activarTipo(db, codigo, activo) {
  const actual = A.tipo(db, codigo, { todos: true });
  if (!actual) return { error: 'Tipo no encontrado', status: 404 };
  if (typeof activo !== 'boolean') return { error: 'Datos no válidos' };
  if (actual.activo === activo) return { tipo: actual, sinCambio: true };
  if (!activo) {
    const n = db.prepare("SELECT COUNT(*) n FROM activos WHERE tipo = ? AND estado != 'de_baja'").get(codigo).n;
    if (n) return { error: 'Hay ' + n + ' elemento(s) de este tipo sin dar de baja: no se puede desactivar' };
    if (db.prepare('SELECT COUNT(*) n FROM activos_tipos WHERE activo = 1').get().n <= 1) return { error: 'Debe quedar al menos un tipo activo' };
  }
  db.prepare('UPDATE activos_tipos SET activo = ? WHERE codigo = ?').run(activo ? 1 : 0, codigo);
  return { tipo: A.tipo(db, codigo, { todos: true }) };
}

// ── Textos del acta ──
function textos(db) {
  const guardados = new Map(db.prepare('SELECT clave, valor FROM activos_textos').all().map((r) => [r.clave, r.valor]));
  return Object.fromEntries(Object.entries(TEXTOS).map(([k, t]) => [k, guardados.has(k) ? guardados.get(k) : t.base]));
}
function guardarTexto(db, clave, valor, quien) {
  if (!Object.prototype.hasOwnProperty.call(TEXTOS, clave)) return { error: 'Texto no encontrado', status: 404 };
  const v = typeof valor === 'string' ? valor.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : '';
  if (v.length < 10 || v.length > 1500) return { error: 'El texto debe tener entre 10 y 1.500 caracteres' };
  db.prepare(`INSERT INTO activos_textos (clave, valor, updatedAt, quien) VALUES (?,?,?,?)
              ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updatedAt = excluded.updatedAt, quien = excluded.quien`).run(clave, v, new Date().toISOString(), quien || '');
  return { clave, valor: v };
}
function textoActa(db, tipoActa) { const t = textos(db); return t['acta_' + tipoActa] || t.acta_devolucion; } // Fase 379: un texto por tipo

module.exports = { TIPOS_CAMPO, MAX_CAMPOS, TEXTOS, crearTablas, slug, validarTipo, crearTipo, editarTipo, activarTipo, textos, guardarTexto, textoActa };
