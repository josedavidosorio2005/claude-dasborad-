#!/usr/bin/env node
// fase134-dry-run-borrado.js — Fase 134, Paso 3 (Parte 2): dry-run REAL de
// la migracion `fase134_borrar_clientes_v1` (server/db.js) contra una COPIA
// DE TRABAJO de un respaldo de produccion -- NUNCA contra la base viva.
//
// AUTOCONTENIDO A PROPOSITO: no hace `require('../db')` -- en el momento en
// que esto corre, server/db.js (con la migracion) todavia NO esta
// desplegado (el PR sigue sin merge, a proposito, hasta el "OK borrar" del
// usuario). Este script reproduce la MISMA logica (misma lista de 12
// clientes, misma lista de 19 tablas, mismo DELETE, mismo recorte de
// permisos) para poder correrla HOY contra una copia, con el mismo runtime
// (Node + better-sqlite3) que ya esta corriendo en el servidor, sin
// necesidad de desplegar nada. Las 2 listas de abajo deben coincidir EXACTO
// con las de la migracion real en server/db.js -- si una cambia, la otra
// tambien (hay un test que lo confirma: ver
// server/tests/fase134-dry-run-listas-coinciden.test.js).
//
// SOLO imprime conteos. Nunca una fila real, nunca un nombre de persona.
//
// Uso:
//   node fase134-dry-run-borrado.js --local <ruta-del-respaldo>
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const CLIENTES_ELIMINADOS_FASE134 = [
  'HOSPITAL LA MARIA',
  'CLINICA AURORA',
  'TELEVENTAS SURA',
  'TELEVENTAS COMFAMA',
  'PANTERA MAIKERS',
  'ANDRES YEPES',
  'SASCHA FITNESS',
  'ALBERTO LINERO GO',
  'INFONDO',
  'BIVETT',
  'CONSULTORIO JULIAN MOLANO',
  'CARTERA INTERNA',
];
const CLIENTES_A_CONSERVAR = ['ORLANT', 'MOBILIZE'];

const TABLAS_CAMPANA_FASE134 = [
  'calidad_plantillas', 'calidad_codificaciones', 'monitoreos', 'cronograma_metas',
  'calidad_nivel_servicio', 'calidad_nivel_servicio_diario', 'trafico_whatsapp',
  'agendas', 'tipificaciones', 'inasistencias', 'efectividad_agendamiento',
  'efectividad_citas', 'salida_mensual', 'alias_asesores', 'trafico_skill_mapeo',
  'gestion_humana_personal', 'umbrales_semaforo',
];
const TABLAS_CLIENTE_FASE134 = ['dashboard_cargas', 'dashboards_config'];
const TODAS_LAS_TABLAS = [
  ...TABLAS_CAMPANA_FASE134.map((t) => [t, 'campana']),
  ...TABLAS_CLIENTE_FASE134.map((t) => [t, 'cliente']),
];

function existeTabla(db, tabla) {
  try { db.prepare(`SELECT 1 FROM ${tabla} LIMIT 1`).get(); return true; } catch (e) { return false; }
}

function snapshot(db) {
  const out = {};
  for (const [tabla, col] of TODAS_LAS_TABLAS) {
    if (!existeTabla(db, tabla)) { out[tabla] = null; continue; }
    const total = db.prepare(`SELECT COUNT(*) c FROM ${tabla}`).get().c;
    const porCliente = {};
    for (const c of [...CLIENTES_ELIMINADOS_FASE134, ...CLIENTES_A_CONSERVAR]) {
      porCliente[c] = db.prepare(`SELECT COUNT(*) c FROM ${tabla} WHERE ${col} = ?`).get(c).c;
    }
    out[tabla] = { total, porCliente };
  }
  out._historial = existeTabla(db, 'historial') ? db.prepare('SELECT COUNT(*) c FROM historial').get().c : null;
  if (existeTabla(db, 'inasistencias')) {
    out._inasistenciaOrlantAgo = db.prepare("SELECT COUNT(*) c FROM inasistencias WHERE campana='ORLANT' AND mes='2026-08'").get().c;
    out._inasistenciaOrlantSep = db.prepare("SELECT COUNT(*) c FROM inasistencias WHERE campana='ORLANT' AND mes='2026-09'").get().c;
  }
  if (existeTabla(db, 'monitoreos')) {
    out._calidadOrlant = db.prepare("SELECT COUNT(*) c FROM monitoreos WHERE campana='ORLANT'").get().c;
  }
  if (existeTabla(db, 'calidad_nivel_servicio_diario')) {
    out._flujoMobilize = db.prepare("SELECT COUNT(*) c FROM calidad_nivel_servicio_diario WHERE campana='MOBILIZE'").get().c;
  }
  if (existeTabla(db, 'tipificaciones')) {
    out._tipificacionMobilize = db.prepare("SELECT COUNT(*) c FROM tipificaciones WHERE campana='MOBILIZE'").get().c;
  }
  return out;
}

function snapshotUsuarios(db) {
  const rows = db.prepare('SELECT id, rol, perms FROM users').all();
  const out = {};
  for (const u of rows) {
    let perms = {};
    try { perms = JSON.parse(u.perms || '{}'); } catch (e) { /* ignore */ }
    out[u.id] = { rol: u.rol, keys: Object.keys(perms).filter((k) => perms[k] === true).sort() };
  }
  return out;
}

// Reproduce EXACTO lo que hace runOnceMigration('fase134_borrar_clientes_v1', ...)
// en server/db.js -- mismas tablas, mismo WHERE IN, mismo recorte de perms.
function aplicarBorrado(db) {
  const placeholders = CLIENTES_ELIMINADOS_FASE134.map(() => '?').join(',');
  const tx = db.transaction(() => {
    for (const tabla of TABLAS_CAMPANA_FASE134) {
      if (!existeTabla(db, tabla)) continue;
      db.prepare(`DELETE FROM ${tabla} WHERE campana IN (${placeholders})`).run(...CLIENTES_ELIMINADOS_FASE134);
    }
    for (const tabla of TABLAS_CLIENTE_FASE134) {
      if (!existeTabla(db, tabla)) continue;
      db.prepare(`DELETE FROM ${tabla} WHERE cliente IN (${placeholders})`).run(...CLIENTES_ELIMINADOS_FASE134);
    }
    const usuarios = db.prepare('SELECT id, perms FROM users').all();
    const actualizarUser = db.prepare('UPDATE users SET perms = ? WHERE id = ?');
    usuarios.forEach((u) => {
      let perms;
      try { perms = JSON.parse(u.perms || '{}'); } catch (e) { return; }
      let cambiado = false;
      CLIENTES_ELIMINADOS_FASE134.forEach((cliente) => {
        ['campana_', 'cliente_'].forEach((prefix) => {
          const key = prefix + cliente;
          if (Object.prototype.hasOwnProperty.call(perms, key)) { delete perms[key]; cambiado = true; }
        });
      });
      if (cambiado) actualizarUser.run(JSON.stringify(perms), u.id);
    });
  });
  tx();
}

function imprimirComparacion(titulo, antes, despues) {
  console.log('');
  console.log(`== ${titulo} ==`);
  for (const [tabla] of TODAS_LAS_TABLAS) {
    const a = antes[tabla];
    const d = despues[tabla];
    if (a === null || d === null) { console.log(`[${tabla}] sin tabla en este respaldo`); continue; }
    const partes = [];
    let huboCambioInesperado = false;
    for (const c of CLIENTES_ELIMINADOS_FASE134) {
      if (a.porCliente[c] !== 0) partes.push(`BORRADAS(${c})=${a.porCliente[c] - d.porCliente[c]}`);
    }
    for (const c of CLIENTES_A_CONSERVAR) {
      if (a.porCliente[c] !== d.porCliente[c]) { huboCambioInesperado = true; partes.push(`!!CAMBIO INESPERADO en ${c}: ${a.porCliente[c]} -> ${d.porCliente[c]}`); }
      else if (a.porCliente[c] > 0) partes.push(`${c} sin cambio=${a.porCliente[c]}`);
    }
    const sumaAntes = CLIENTES_ELIMINADOS_FASE134.concat(CLIENTES_A_CONSERVAR).reduce((s, c) => s + a.porCliente[c], 0);
    const sumaDespues = CLIENTES_ELIMINADOS_FASE134.concat(CLIENTES_A_CONSERVAR).reduce((s, c) => s + d.porCliente[c], 0);
    const otrosAntes = a.total - sumaAntes;
    const otrosDespues = d.total - sumaDespues;
    if (otrosAntes !== otrosDespues) { huboCambioInesperado = true; partes.push(`!!OTROS cambio: ${otrosAntes} -> ${otrosDespues}`); }
    console.log(`[${tabla}] total ${a.total} -> ${d.total}  ${partes.join(' ')}${huboCambioInesperado ? '  <<< REVISAR' : ''}`);
  }
  console.log('');
  console.log(`Historial: ${antes._historial} -> ${despues._historial} (debe ser IGUAL)`);
  if (antes._inasistenciaOrlantAgo !== undefined) {
    console.log(`Inasistencia ORLANT ago-2026: ${antes._inasistenciaOrlantAgo} -> ${despues._inasistenciaOrlantAgo}`);
    console.log(`Inasistencia ORLANT sep-2026: ${antes._inasistenciaOrlantSep} -> ${despues._inasistenciaOrlantSep}`);
  }
  if (antes._calidadOrlant !== undefined) console.log(`Calidad (monitoreos) ORLANT: ${antes._calidadOrlant} -> ${despues._calidadOrlant}`);
  if (antes._flujoMobilize !== undefined) console.log(`Flujo de Llamadas (calidad_nivel_servicio_diario) MOBILIZE: ${antes._flujoMobilize} -> ${despues._flujoMobilize}`);
  if (antes._tipificacionMobilize !== undefined) console.log(`Tipificacion CDR MOBILIZE: ${antes._tipificacionMobilize} -> ${despues._tipificacionMobilize}`);
}

function compararUsuarios(antes, despues) {
  console.log('');
  console.log('== Usuarios: cambios de permiso ==');
  let conClaveQuitada = 0;
  const quedaronSinAccesoPorRol = {};
  for (const id of Object.keys(antes)) {
    const a = antes[id];
    const d = despues[id];
    if (!d) { console.log(`  !!USUARIO ${id} desaparecio -- NUNCA deberia pasar`); continue; }
    if (a.rol !== d.rol) console.log(`  !!USUARIO ${id} cambio de rol -- NUNCA deberia pasar`);
    const quitadas = a.keys.filter((k) => !d.keys.includes(k));
    const agregadas = d.keys.filter((k) => !a.keys.includes(k));
    if (agregadas.length) console.log(`  !!USUARIO ${id} gano claves nuevas (${agregadas.length}) -- NUNCA deberia pasar`);
    const quitadasRelevantes = quitadas.filter((k) => k.startsWith('campana_') || k.startsWith('cliente_'));
    const quitadasNoRelevantes = quitadas.filter((k) => !(k.startsWith('campana_') || k.startsWith('cliente_')));
    if (quitadasNoRelevantes.length) console.log(`  !!USUARIO ${id} perdio una clave que NO es campana_/cliente_ -- NUNCA deberia pasar`);
    if (quitadasRelevantes.length) {
      conClaveQuitada++;
      const quedaAlgo = d.keys.some((k) => k.startsWith('campana_') || k.startsWith('cliente_'));
      if (!quedaAlgo) quedaronSinAccesoPorRol[d.rol] = (quedaronSinAccesoPorRol[d.rol] || 0) + 1;
    }
  }
  console.log(`Usuarios a los que se les quito al menos 1 clave campana_X/cliente_X: ${conClaveQuitada}`);
  console.log('Usuarios que quedaron con CERO acceso campana_*/cliente_* (0 esperado o muy bajo, informativo, nunca se borran):');
  const entradas = Object.entries(quedaronSinAccesoPorRol);
  if (!entradas.length) console.log('  (ninguno)');
  else entradas.forEach(([rol, n]) => console.log(`  ${rol}: ${n}`));
}

function correrDryRun(rutaRespaldo) {
  const trabajo = path.join(os.tmpdir(), 'fase134-dryrun-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.db');
  fs.copyFileSync(rutaRespaldo, trabajo);
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(rutaRespaldo + ext)) fs.copyFileSync(rutaRespaldo + ext, trabajo + ext);
  }
  console.log('[dry-run] Copia de trabajo creada (NUNCA el respaldo original, NUNCA la base viva).');

  try {
    let db = new Database(trabajo);
    const integridad = db.pragma('integrity_check', { simple: true });
    console.log(`[dry-run] integrity_check de la copia: ${integridad}`);
    if (integridad !== 'ok') {
      console.error('[dry-run] FALLO: integrity_check no devolvio "ok". No se sigue.');
      process.exitCode = 1;
      db.close();
      return;
    }

    const antes = snapshot(db);
    const usuariosAntes = snapshotUsuarios(db);

    console.log('[dry-run] Aplicando el borrado (1a corrida) sobre la copia...');
    aplicarBorrado(db);
    const despues1 = snapshot(db);
    const usuariosDespues1 = snapshotUsuarios(db);

    imprimirComparacion('ANTES -> DESPUES de la 1a corrida (lo que de verdad se borraria)', antes, despues1);
    compararUsuarios(usuariosAntes, usuariosDespues1);

    console.log('');
    console.log('[dry-run] Aplicando el borrado otra vez (2a corrida, misma copia ya migrada) -- debe borrar 0 filas mas...');
    aplicarBorrado(db);
    const despues2 = snapshot(db);
    imprimirComparacion('DESPUES de la 1a corrida -> DESPUES de la 2a corrida (debe ser TODO sin cambio)', despues1, despues2);

    db.close();
  } finally {
    for (const ext of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(trabajo + ext); } catch (e) { /* no existia */ }
    }
    console.log('[dry-run] Copia de trabajo borrada. El respaldo original y la base viva nunca se tocaron.');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const idxLocal = argv.indexOf('--local');
  if (idxLocal === -1 || !argv[idxLocal + 1]) {
    console.error('[dry-run] Uso: node fase134-dry-run-borrado.js --local <ruta-del-respaldo>');
    process.exitCode = 1;
    return;
  }
  const ruta = argv[idxLocal + 1];
  if (!fs.existsSync(ruta)) {
    console.error(`[dry-run] No existe el archivo: ${ruta}`);
    process.exitCode = 1;
    return;
  }
  correrDryRun(ruta);
}

main().catch((err) => {
  console.error('[dry-run] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
