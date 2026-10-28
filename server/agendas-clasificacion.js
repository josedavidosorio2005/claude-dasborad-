// agendas-clasificacion.js — Fase 210 (pedido de Edwin, 28/10, solo ORLANT).
// Las 2 listas con las que Agendamiento lee la base cruda del aplicativo:
//   - Usuarios: usuario (columna A) -> asesor, desde una fecha de cambio. Un
//     usuario puede pasar a otra persona: sus agendas desde esa fecha cuentan
//     para la nueva y las anteriores siguen siendo de la anterior. Sin fecha =
//     siempre ha sido de esa persona.
//   - Codigos de entidad: codigo (columna R) -> 3P o GENERAL. Un codigo que no
//     esta en la lista (particulares, que se crean con la cedula) suma a 3P.
// Se cruzan AL CONSULTAR (agendas.js, AGENDAS_FUENTE): cambiar una lista nunca
// reescribe lo cargado. Aparte de la clasificacion de asesores de
// Tipificacion (clasificacion-asesores.js), que no cambia.
'use strict';

const { aplicarAliasAFilas } = require('./alias-asesores');

const CLIENTES_AGENDAS_CLASIFICACION = ['ORLANT'];
function usaClasificacionAgendas(campana) { return CLIENTES_AGENDAS_CLASIFICACION.includes(campana); }

// Comparacion de usuarios y codigos: sin espacios de mas, en mayusculas (el
// mismo criterio al guardar la lista y al guardar las agendas).
function normCodigo(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toUpperCase();
}
// Usuario: ademas sin ningun espacio (hallazgo real con los archivos del
// 28/10: la lista trae "INCO 19" y la base "INCO19", el mismo usuario).
function normUsuario(v) {
  return normCodigo(v).replace(/\s+/g, '');
}

// Asesor de un usuario en un dia ('AAAA-MM-DD'): el registro con la fecha de
// cambio mas reciente que no pase de ese dia; sin fecha = desde siempre.
// Misma regla que la expresion SQL de agendas.js (esta la usan las pruebas y
// el resumen de la lista).
function asesorDeUsuarioEnFecha(registros, usuario, dia) {
  let mejor = null;
  for (const r of registros) {
    if (normUsuario(r.usuario) !== normUsuario(usuario)) continue;
    if (r.fechaCambio && r.fechaCambio > dia) continue;
    if (!mejor || (r.fechaCambio && (!mejor.fechaCambio || r.fechaCambio > mejor.fechaCambio))) mejor = r;
  }
  return mejor ? mejor.asesor : null;
}

// Errores de una lista de usuarios (texto para el usuario, sin nombres de
// asesor): el mismo usuario dos veces necesita fecha de cambio en todos sus
// registros menos uno, y nunca dos veces la misma fecha.
function erroresListaUsuarios(lista) {
  const errores = [];
  const porUsuario = {};
  (lista || []).forEach((r) => {
    const u = normUsuario(r.usuario);
    (porUsuario[u] = porUsuario[u] || []).push(r);
  });
  Object.keys(porUsuario).forEach((u) => {
    const regs = porUsuario[u];
    if (regs.length < 2) return;
    if (regs.filter((r) => !r.fechaCambio).length > 1) {
      errores.push('El usuario ' + u + ' está repetido: indica la fecha de cambio (desde cuándo es de la persona nueva).');
    }
    const fechas = regs.map((r) => r.fechaCambio).filter(Boolean);
    if (new Set(fechas).size !== fechas.length) errores.push('El usuario ' + u + ' tiene dos veces la misma fecha de cambio.');
  });
  return errores;
}

function listarUsuarios(db, campana) {
  const usuarios = db
    .prepare('SELECT usuario, asesor, fechaCambio FROM agendas_usuarios WHERE campana = ? ORDER BY usuario, fechaCambio IS NOT NULL, fechaCambio')
    .all(campana);
  const conteos = db
    .prepare('SELECT usuario, COUNT(*) AS agendas FROM agendas WHERE campana = ? AND usuario IS NOT NULL GROUP BY usuario ORDER BY usuario')
    .all(campana);
  const enLista = new Set(usuarios.map((u) => u.usuario));
  const porUsuario = {};
  conteos.forEach((c) => { porUsuario[c.usuario] = c.agendas; });
  return {
    usuarios: usuarios.map((u) => ({ ...u, agendasUsuario: porUsuario[u.usuario] || 0 })),
    // Usuarios de la base cargada que no estan en la lista: sus agendas salen
    // como "Usuario X (sin asesor)" hasta que se les asigne una persona.
    sinAsesor: conteos.filter((c) => !enLista.has(c.usuario)),
  };
}

// Reemplaza la lista completa (una transaccion). El nombre del asesor pasa por
// el alias de asesor del cliente (Fase 122), igual que al cargar agendas.
function guardarUsuarios(db, { campana, usuarios, guardadoPorNombre }) {
  const limpios = usuarios.map((u) => ({
    usuario: normUsuario(u.usuario),
    asesor: String(u.asesor).trim().replace(/\s+/g, ' '),
    fechaCambio: u.fechaCambio || null,
  }));
  const errores = erroresListaUsuarios(limpios);
  if (errores.length) return { errores };
  const alias = aplicarAliasAFilas(db, campana, limpios, 'asesor');
  const ahora = new Date().toISOString();
  const ins = db.prepare('INSERT INTO agendas_usuarios (campana, usuario, asesor, fechaCambio, guardadoPorNombre, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    db.prepare('DELETE FROM agendas_usuarios WHERE campana = ?').run(campana);
    alias.filas.forEach((u) => ins.run(campana, u.usuario, u.asesor, u.fechaCambio, guardadoPorNombre || '-', ahora));
  })();
  return {
    registros: limpios.length,
    usuariosDistintos: new Set(limpios.map((u) => u.usuario)).size,
    conCambio: limpios.filter((u) => u.fechaCambio).length,
    unificadosPorAlias: alias.asesoresUnificados,
  };
}

function listarCodigos(db, campana) {
  const codigos = db.prepare('SELECT codigo, linea FROM agendas_codigos_entidad WHERE campana = ? ORDER BY linea, codigo').all(campana);
  const conteos = {};
  db.prepare('SELECT codigoEntidad AS c, COUNT(*) AS n FROM agendas WHERE campana = ? AND usuario IS NOT NULL GROUP BY codigoEntidad')
    .all(campana).forEach((r) => { conteos[r.c] = r.n; });
  const enLista = new Set(codigos.map((c) => c.codigo));
  let fueraDeLista = 0;
  Object.keys(conteos).forEach((c) => { if (!enLista.has(c)) fueraDeLista += conteos[c]; });
  return {
    codigos: codigos.map((c) => ({ ...c, agendas: conteos[c.codigo] || 0 })),
    // Agendas de la base cruda con un codigo fuera de la lista o vacio (suman a 3P).
    agendasFueraDeLista: fueraDeLista,
  };
}

function guardarCodigos(db, { campana, codigos, guardadoPorNombre }) {
  const limpios = codigos.map((c) => ({ codigo: normCodigo(c.codigo), linea: c.linea }));
  const vistos = new Set();
  const repetidos = limpios.filter((c) => (vistos.has(c.codigo) ? true : (vistos.add(c.codigo), false)));
  if (repetidos.length) return { errores: ['El código ' + repetidos[0].codigo + ' está repetido en la lista.'] };
  const ahora = new Date().toISOString();
  const ins = db.prepare('INSERT INTO agendas_codigos_entidad (campana, codigo, linea, guardadoPorNombre, updatedAt) VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => {
    db.prepare('DELETE FROM agendas_codigos_entidad WHERE campana = ?').run(campana);
    limpios.forEach((c) => ins.run(campana, c.codigo, c.linea, guardadoPorNombre || '-', ahora));
  })();
  return { general: limpios.filter((c) => c.linea === 'GENERAL').length, p3: limpios.filter((c) => c.linea === '3P').length };
}

// Codigos de la lista (Set normalizado) -- al guardar agendas, un codigo que no
// esta aqui no se guarda tal cual (puede ser una cedula).
function codigosConocidos(db, campana) {
  return new Set(db.prepare('SELECT codigo FROM agendas_codigos_entidad WHERE campana = ?').all(campana).map((r) => r.codigo));
}

module.exports = {
  CLIENTES_AGENDAS_CLASIFICACION,
  usaClasificacionAgendas,
  normCodigo,
  normUsuario,
  asesorDeUsuarioEnFecha,
  erroresListaUsuarios,
  listarUsuarios,
  guardarUsuarios,
  listarCodigos,
  guardarCodigos,
  codigosConocidos,
};
