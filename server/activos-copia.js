// activos-copia.js — Fase INV6 (HTML de Edwin, «Copia de seguridad (.json)»): todo un inventario (sistemas o
// inmuebles) en un solo JSON para guardarlo aparte. SOLO se descarga: la plataforma no restaura desde este archivo
// (los datos viven en el servidor, con respaldo diario). No incluye los PDF firmados ni dónde se guardan.
'use strict';
const A = require('./activos');
const ACT = require('./activos-actas');
const F = require('./activos-formularios');

const VERSION_COPIA = 1;
const json = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
function copia(db, ambitoQ) {
  const ambito = A.ambitoDe(ambitoQ);
  const tipos = A.tipos(db, { todos: true, ambito });
  const cods = tipos.map((t) => t.codigo);
  const marcas = cods.map(() => '?').join(',') || "''";
  const elementos = db.prepare('SELECT * FROM activos WHERE tipo IN (' + marcas + ') ORDER BY tipo, codigo').all(...cods)
    .map((r) => Object.assign({}, r, { datos: json(r.datos, {}) }));
  const ids = new Set(elementos.map((e) => e.id));
  const historial = db.prepare('SELECT * FROM activos_historial ORDER BY ts, id').all().filter((h) => ids.has(h.activoId)).map(({ ts, ...h }) => h);
  const out = {
    copia: 'InConexion® · Inventario de ' + ambito, version: VERSION_COPIA, generada: new Date().toISOString(), ambito,
    aviso: 'Copia solo para guardar. La plataforma no la restaura: los datos siguen en el servidor.',
    estados: A.estados(db).map(({ codigo, nombre }) => ({ codigo, nombre })),
    listas: Object.fromEntries(Object.keys(A.LISTAS).map((k) => [k, A.lista(db, k)])),
    tipos, elementos, historial,
  };
  if (ambito === 'sistemas') {
    out.agentes = db.prepare('SELECT * FROM activos_agentes ORDER BY id').all();
    out.asignaciones = db.prepare('SELECT * FROM activos_asignaciones ORDER BY id').all();
    // Actas sin la ruta del PDF firmado (solo si está firmada, cuándo y quién).
    out.actas = db.prepare('SELECT id FROM activos_actas ORDER BY numero').all().map((r) => ACT.obtener(db, r.id));
    out.textosActa = F.textos(db);
  }
  out.conteos = { tipos: tipos.length, elementos: elementos.length, historial: historial.length, agentes: (out.agentes || []).length, actas: (out.actas || []).length };
  return out;
}
module.exports = { copia, VERSION_COPIA };
