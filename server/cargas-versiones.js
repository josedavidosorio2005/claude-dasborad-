// cargas-versiones.js — Fase 153 (Centro de cargas, PR 2): "Deshacer"
// durante 30 dias (diseno aprobado en docs/centro-cargas.md).
//
// Antes de que una carga cambie datos (reemplazar, y en el PR 3 eliminar),
// se guarda el MES COMPLETO de esa carga tal como estaba -- una version por
// cada mes que toca -- en la MISMA transaccion: si el respaldo falla, no se
// cambia nada. "Deshacer" devuelve ese mes exactamente a como estaba; antes
// guarda lo que hay ahora, asi que deshacer tambien se puede deshacer.
//
// - Las filas se guardan como JSON comprimido (gzip), con exactamente las
//   columnas que ya estan en la base (nunca telefonos: la base no los tiene).
// - Vencen a los 30 dias; tope de 5 versiones por carga, cliente y mes.
// - Calidad (monitoreos) no entra: no es una carga que reemplace meses.
'use strict';

const zlib = require('zlib');
const { CARGAS_POR_MODULO, cargaPorId, instanteCarga } = require('./centro-cargas');

const DIAS_RETENCION = 30;
const TOPE_POR_MES = 5;

const SQL_TABLA = `
CREATE TABLE IF NOT EXISTS cargas_versiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carga TEXT NOT NULL,
  tabla TEXT NOT NULL,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,
  motivo TEXT NOT NULL,
  registros INTEGER NOT NULL,
  filas BLOB NOT NULL,
  archivoNombre TEXT,
  cargadoPorNombre TEXT,
  guardadoPorNombre TEXT,
  guardadoEn TEXT NOT NULL,
  expiraEn TEXT NOT NULL,
  restauradoEn TEXT,
  restauradoPorNombre TEXT
);
CREATE INDEX IF NOT EXISTS idx_cargas_versiones_mes ON cargas_versiones (campana, carga, mes);
`;

function crearTabla(db) {
  db.exec(SQL_TABLA);
}

// La carga (de CARGAS_POR_MODULO) que guarda sus filas en `tabla`; para
// Tipificacion, la del canal. null si la tabla no tiene versiones.
function cargaDeTabla(tabla, filtro) {
  for (const lista of Object.values(CARGAS_POR_MODULO)) {
    for (const c of lista) {
      if (c.tabla !== tabla || tabla === 'monitoreos') continue;
      if (c.filtro && (!filtro || Object.keys(c.filtro).some((k) => c.filtro[k] !== filtro[k]))) continue;
      return c;
    }
  }
  return null;
}

// ['2026-07', '2026-08'] entre dos fechas o meses ('AAAA-MM[-DD]').
function mesesEntre(desde, hasta) {
  const out = [];
  if (!desde || !hasta) return out;
  let a = Number(String(desde).slice(0, 4)), m = Number(String(desde).slice(5, 7));
  const fa = Number(String(hasta).slice(0, 4)), fm = Number(String(hasta).slice(5, 7));
  for (let i = 0; i < 1200 && (a < fa || (a === fa && m <= fm)); i++) {
    out.push(a + '-' + (m < 10 ? '0' : '') + m);
    m += 1; if (m === 13) { m = 1; a += 1; }
  }
  return out;
}

function _where(carga) {
  const extra = carga.filtro ? Object.keys(carga.filtro).map((k) => ` AND ${k} = @f_${k}`).join('') : '';
  return `campana = @campana AND substr(${carga.fecha}, 1, 7) = @mes${extra}`;
}
function _params(carga, campana, mes) {
  const p = { campana, mes };
  if (carga.filtro) Object.keys(carga.filtro).forEach((k) => { p['f_' + k] = carga.filtro[k]; });
  return p;
}

// Guarda el mes completo de una carga (si tiene filas). Devuelve el id de la
// version o null. No abre transaccion: se llama DENTRO de la de quien borra.
function respaldarMes(db, carga, campana, mes, { motivo, guardadoPorNombre, ahora }) {
  const filas = db.prepare(`SELECT * FROM ${carga.tabla} WHERE ${_where(carga)}`).all(_params(carga, campana, mes));
  if (!filas.length) return null;
  const reciente = filas.reduce((a, f) => ((instanteCarga(f.createdAt) || 0) > (instanteCarga(a.createdAt) || 0) ? f : a), filas[0]);
  const t = ahora || new Date();
  const id = db.prepare(
    `INSERT INTO cargas_versiones (carga, tabla, campana, mes, motivo, registros, filas, archivoNombre, cargadoPorNombre, guardadoPorNombre, guardadoEn, expiraEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    carga.id, carga.tabla, campana, mes, motivo, filas.length,
    zlib.gzipSync(Buffer.from(JSON.stringify(filas))),
    reciente.archivoNombre || null, reciente.cargadoPorNombre || null, guardadoPorNombre || null,
    t.toISOString(), new Date(t.getTime() + DIAS_RETENCION * 86400000).toISOString()
  ).lastInsertRowid;
  // Tope: se quedan las TOPE_POR_MES mas recientes de esa carga/cliente/mes.
  db.prepare(
    `DELETE FROM cargas_versiones WHERE campana = ? AND carga = ? AND mes = ? AND id NOT IN (
       SELECT id FROM cargas_versiones WHERE campana = ? AND carga = ? AND mes = ? ORDER BY id DESC LIMIT ${TOPE_POR_MES})`
  ).run(campana, carga.id, mes, campana, carga.id, mes);
  return Number(id);
}

// Lo llama cada lector del servidor al EMPEZAR su transaccion, con el rango
// (desde/hasta) o los meses que va a tocar. Respalda cada mes completo.
function respaldarAntesDeCambiar(db, tabla, { campana, desde, hasta, meses, filtro, guardadoPorNombre }) {
  const carga = cargaDeTabla(tabla, filtro);
  if (!carga || !campana) return [];
  const lista = [...new Set((meses && meses.length ? meses.map((m) => String(m).slice(0, 7)) : mesesEntre(desde, hasta)))];
  return lista.map((mes) => respaldarMes(db, carga, campana, mes, { motivo: 'reemplazo', guardadoPorNombre })).filter(Boolean);
}

function _publica(v) {
  return {
    id: v.id, carga: v.carga, mes: v.mes, motivo: v.motivo, registros: v.registros,
    archivoNombre: v.archivoNombre, cargadoPorNombre: v.cargadoPorNombre,
    guardadoPorNombre: v.guardadoPorNombre, guardadoEn: v.guardadoEn, expiraEn: v.expiraEn,
    restauradoEn: v.restauradoEn, restauradoPorNombre: v.restauradoPorNombre,
  };
}

// Versiones vigentes de un cliente (opcionalmente de una carga y un mes),
// mas recientes primero. Sin las filas.
function listar(db, campana, { carga, mes, ahora } = {}) {
  const t = (ahora || new Date()).toISOString();
  let sql = 'SELECT * FROM cargas_versiones WHERE campana = ? AND expiraEn > ?';
  const p = [campana, t];
  if (carga) { sql += ' AND carga = ?'; p.push(carga); }
  if (mes) { sql += ' AND mes = ?'; p.push(mes); }
  return db.prepare(sql + ' ORDER BY id DESC').all(...p).map(_publica);
}

function obtener(db, id) {
  return db.prepare('SELECT * FROM cargas_versiones WHERE id = ?').get(id) || null;
}

// Lo que cada lector recalcula a partir de las filas despues de cargar, para
// un mes que cambio sin pasar por el lector (Deshacer y, en el PR 3,
// Eliminar). Va dentro de la misma transaccion. Requires perezosos: esos
// modulos requieren este.
function recalcularDerivados(db, carga, campana, mes) {
  if (carga.id === 'flujo_llamadas') {
    // Agregado mensual de Nivel de Servicio, por cada sede del mes (las de
    // antes y las de ahora: una sede que quedo sin filas baja a 0, igual que
    // al cargar).
    const { recalcularMensual } = require('./nivel-servicio-diario');
    const sedes = db.prepare(
      `SELECT sede FROM calidad_nivel_servicio WHERE campana = @c AND mes = @m
       UNION SELECT sede FROM calidad_nivel_servicio_diario WHERE campana = @c AND substr(fecha, 1, 7) = @m`
    ).all({ c: campana, m: mes }).map((r) => r.sede);
    sedes.forEach((sede) => recalcularMensual(db, campana, mes, undefined, sede));
  }
  // ORLANT: su "resumen" manual sigue a Trafico (como al cargar).
  if (campana === 'ORLANT' && (carga.id === 'flujo_llamadas' || carga.id === 'flujo_whatsapp')) {
    require('./resumen-orlant-trafico').recalcularResumenOrlantDesdeTrafico(db, mes);
  }
}

// Devuelve el mes a como estaba en la version `id`. Lanza un Error con
// `.status` si no se puede. Transaccion propia.
function deshacer(db, id, { actorNombre, ahora } = {}) {
  const t = ahora || new Date();
  const v = obtener(db, id);
  if (!v) throw Object.assign(new Error('Esa versión no existe (o ya venció)'), { status: 404 });
  if (v.expiraEn <= t.toISOString()) throw Object.assign(new Error('Esa versión ya venció (se guardan 30 días)'), { status: 410 });
  if (v.restauradoEn) throw Object.assign(new Error('Esa versión ya se restauró'), { status: 409 });
  const carga = cargaPorId(v.carga);
  if (!carga) throw Object.assign(new Error('Carga desconocida'), { status: 400 });
  const filas = JSON.parse(zlib.gunzipSync(v.filas).toString('utf8'));
  let reemplazadas = 0;
  let guardadaAntes = null;
  db.transaction(() => {
    guardadaAntes = respaldarMes(db, carga, v.campana, v.mes, { motivo: 'antes de deshacer', guardadoPorNombre: actorNombre, ahora: t });
    reemplazadas = db.prepare(`DELETE FROM ${carga.tabla} WHERE ${_where(carga)}`).run(_params(carga, v.campana, v.mes)).changes;
    if (filas.length) {
      const cols = Object.keys(filas[0]).filter((c) => c !== 'id');
      const ins = db.prepare(`INSERT INTO ${carga.tabla} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`);
      filas.forEach((f) => { const r = {}; cols.forEach((c) => { r[c] = f[c] === undefined ? null : f[c]; }); ins.run(r); });
    }
    recalcularDerivados(db, carga, v.campana, v.mes);
    db.prepare('UPDATE cargas_versiones SET restauradoEn = ?, restauradoPorNombre = ? WHERE id = ?').run(t.toISOString(), actorNombre || null, v.id);
  })();
  return { version: _publica(obtener(db, id)), restauradas: filas.length, reemplazadas, guardadaAntes };
}

// Borra las versiones vencidas. Devuelve cuantas.
function purgar(db, ahora) {
  return db.prepare('DELETE FROM cargas_versiones WHERE expiraEn <= ?').run((ahora || new Date()).toISOString()).changes;
}

module.exports = {
  DIAS_RETENCION, TOPE_POR_MES, crearTabla, cargaDeTabla, mesesEntre,
  respaldarMes, respaldarAntesDeCambiar, recalcularDerivados, listar, obtener, deshacer, purgar,
};
