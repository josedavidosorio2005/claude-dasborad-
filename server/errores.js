// errores.js — Fase 284 (pedido de Edwin, 06/11): pestaña «Errores» (errores de
// agendamiento) de Clinica Aurora, activable para otros clientes con el modulo
// `errores` del registro (plantillas-cliente.js). Los errores NO se cargan con una
// base: los registra el supervisor (o el administrador) en la plataforma, por mes y
// por asesora, con su observacion; cada mes lleva su «Plan de acción». Ningun
// dato de paciente: solo mes, asesora, cantidad y observacion (que se revisa para
// no guardar documentos ni telefonos). Quien crea, edita o borra queda registrado.
'use strict';

const { cargarAliasMapa, resolverAlias, aliasNorm } = require('./alias-asesores');

const OBS_MAX = 1000;
const PLAN_MAX = 4000;
const CANTIDAD_MAX = 500;
// Una observacion o un plan no pueden traer numeros de documento o de telefono
// (Fase 287: la regla es la misma de los monitoreos, en datos-paciente.js).
const { pareceDatoPaciente, mensajeDatoPaciente } = require('./datos-paciente');
// Fase 292 (#15): las fechas (escritas con nowStr) se muestran en hora de Colombia.
const { fechaServidorAColombiaStr: aColombia } = require('./fecha-limites');

function crearTablas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS errores_agendamiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      asesor TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      observacion TEXT NOT NULL DEFAULT '',
      creadoPor INTEGER,
      creadoPorNombre TEXT NOT NULL DEFAULT '-',
      creadoEn TEXT NOT NULL,
      editadoPorNombre TEXT,
      editadoEn TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_errores_agendamiento_campana_mes ON errores_agendamiento(campana, mes);
    CREATE TABLE IF NOT EXISTS errores_plan_accion (
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      texto TEXT NOT NULL DEFAULT '',
      actualizadoPorNombre TEXT NOT NULL DEFAULT '-',
      actualizadoEn TEXT NOT NULL,
      PRIMARY KEY (campana, mes)
    );
  `);
}

// Nombre real de la asesora (alias de "Usuarios del sistema").
function nombreReal(db, campana, asesor) {
  return resolverAlias(cargarAliasMapa(db, campana), String(asesor || '').trim()) || String(asesor || '').trim();
}

// Asesoras para la lista del formulario: los nombres reales de los alias de la
// campaña, los usuarios ASESOR de la campaña y las que ya tienen errores.
function asesorasDe(db, campana) {
  const vistos = new Map();
  const add = (n) => { const v = String(n || '').trim(); if (v && !vistos.has(aliasNorm(v))) vistos.set(aliasNorm(v), v); };
  db.prepare('SELECT DISTINCT canonico AS v FROM alias_asesores WHERE campana = ?').all(campana).forEach((r) => add(r.v));
  db.prepare("SELECT nombre AS v FROM users WHERE rol = 'ASESOR' AND active = 1 AND asesorCampana = ?").all(campana).forEach((r) => add(r.v));
  db.prepare('SELECT DISTINCT asesor AS v FROM errores_agendamiento WHERE campana = ?').all(campana).forEach((r) => add(nombreReal(db, campana, r.v)));
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

// Todo lo que muestra la pestaña: por mes (cantidad), el detalle de cada mes y los planes.
function resumen(db, campana) {
  const filas = db.prepare('SELECT id, mes, asesor, cantidad, observacion, creadoPorNombre, creadoEn, editadoPorNombre, editadoEn FROM errores_agendamiento WHERE campana = ? ORDER BY mes, id').all(campana);
  const mapa = cargarAliasMapa(db, campana);
  const porMes = {};
  const detalle = {};
  for (const f of filas) {
    const asesor = resolverAlias(mapa, f.asesor) || f.asesor;
    porMes[f.mes] = (porMes[f.mes] || 0) + f.cantidad;
    (detalle[f.mes] = detalle[f.mes] || []).push({ ...f, asesor, creadoEn: aColombia(f.creadoEn), editadoEn: f.editadoEn ? aColombia(f.editadoEn) : f.editadoEn });
  }
  const planes = {};
  db.prepare('SELECT mes, texto, actualizadoPorNombre, actualizadoEn FROM errores_plan_accion WHERE campana = ?').all(campana)
    .forEach((p) => { planes[p.mes] = { ...p, actualizadoEn: aColombia(p.actualizadoEn) }; });
  const meses = [...new Set([...Object.keys(porMes), ...Object.keys(planes)])].sort();
  return {
    campana,
    meses,
    porMes: meses.map((mes) => ({ mes, errores: porMes[mes] || 0 })),
    // Por asesora y mes: la suma y cada registro (para "Ver observación").
    porAsesor: Object.fromEntries(meses.map((mes) => {
      const by = {};
      (detalle[mes] || []).forEach((f) => { (by[f.asesor] = by[f.asesor] || { asesor: f.asesor, errores: 0, registros: [] }).errores += f.cantidad; by[f.asesor].registros.push(f); });
      return [mes, Object.values(by).sort((a, b) => b.errores - a.errores || a.asesor.localeCompare(b.asesor, 'es'))];
    })),
    planes,
  };
}

function validar(db, campana, b, parcial) {
  const out = {};
  if (!parcial || b.mes !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.mes || ''))) return { error: 'El mes debe ser AAAA-MM' };
    out.mes = b.mes;
  }
  if (!parcial || b.asesor !== undefined) {
    const a = String(b.asesor || '').trim();
    if (!a) return { error: 'Elige la asesora' };
    if (a.length > 120) return { error: 'El nombre de la asesora es demasiado largo' };
    out.asesor = nombreReal(db, campana, a);
  }
  if (!parcial || b.cantidad !== undefined) {
    const n = Number(b.cantidad === undefined ? 1 : b.cantidad);
    if (!Number.isInteger(n) || n < 1 || n > CANTIDAD_MAX) return { error: 'La cantidad debe ser un número entero entre 1 y ' + CANTIDAD_MAX };
    out.cantidad = n;
  }
  if (!parcial || b.observacion !== undefined) {
    const o = String(b.observacion || '').trim();
    if (o.length > OBS_MAX) return { error: 'La observación puede tener hasta ' + OBS_MAX + ' caracteres' };
    if (pareceDatoPaciente(o)) return { error: mensajeDatoPaciente('La observación', o) }; // Fase 288: dice que numero
    out.observacion = o;
  }
  return { datos: out };
}

function crear(db, campana, b, actor, ahora) {
  const v = validar(db, campana, b, false);
  if (v.error) return v;
  const r = db.prepare('INSERT INTO errores_agendamiento (campana, mes, asesor, cantidad, observacion, creadoPor, creadoPorNombre, creadoEn) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(campana, v.datos.mes, v.datos.asesor, v.datos.cantidad, v.datos.observacion, actor.id || null, actor.nombre || '-', ahora);
  return { fila: db.prepare('SELECT * FROM errores_agendamiento WHERE id = ?').get(r.lastInsertRowid) };
}

function editar(db, id, b, actor, ahora) {
  const fila = db.prepare('SELECT * FROM errores_agendamiento WHERE id = ?').get(id);
  if (!fila) return { noExiste: true };
  const v = validar(db, fila.campana, b, true);
  if (v.error) return v;
  const d = { mes: fila.mes, asesor: fila.asesor, cantidad: fila.cantidad, observacion: fila.observacion, ...v.datos };
  db.prepare('UPDATE errores_agendamiento SET mes = ?, asesor = ?, cantidad = ?, observacion = ?, editadoPorNombre = ?, editadoEn = ? WHERE id = ?')
    .run(d.mes, d.asesor, d.cantidad, d.observacion, actor.nombre || '-', ahora, id);
  return { antes: fila, fila: db.prepare('SELECT * FROM errores_agendamiento WHERE id = ?').get(id) };
}

function borrar(db, id) {
  const fila = db.prepare('SELECT * FROM errores_agendamiento WHERE id = ?').get(id);
  if (!fila) return { noExiste: true };
  db.prepare('DELETE FROM errores_agendamiento WHERE id = ?').run(id);
  return { fila };
}

function guardarPlan(db, campana, mes, texto, actor, ahora) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) return { error: 'El mes debe ser AAAA-MM' };
  const t = String(texto || '').trim();
  if (t.length > PLAN_MAX) return { error: 'El plan de acción puede tener hasta ' + PLAN_MAX + ' caracteres' };
  if (pareceDatoPaciente(t)) return { error: mensajeDatoPaciente('El plan de acción', t) };
  if (!t) { db.prepare('DELETE FROM errores_plan_accion WHERE campana = ? AND mes = ?').run(campana, mes); return { borrado: true }; }
  db.prepare(`INSERT INTO errores_plan_accion (campana, mes, texto, actualizadoPorNombre, actualizadoEn) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(campana, mes) DO UPDATE SET texto = excluded.texto, actualizadoPorNombre = excluded.actualizadoPorNombre, actualizadoEn = excluded.actualizadoEn`)
    .run(campana, mes, t, actor.nombre || '-', ahora);
  return { plan: db.prepare('SELECT * FROM errores_plan_accion WHERE campana = ? AND mes = ?').get(campana, mes) };
}

// Fase 286 (pedido de Edwin, 07/11): un solo «Guardar» para el error y el plan de
// accion del mes. Primero se valida TODO (error y plan) y despues se escribe en una
// sola transaccion: o se guardan los dos o ninguno, y el plan escrito nunca se pierde.
//  b = { mes, error?: { id?, asesor, cantidad?, observacion? }, plan?: texto }
//  - `error.id`: editar ese error (debe ser de la misma campaña).
//  - `plan` ausente: el plan del mes no se toca; '' lo borra (como guardarPlan).
function guardarJunto(db, campana, b, actor, ahora) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.mes || ''))) return { error: 'El mes debe ser AAAA-MM' };
  if (!b.error && b.plan === undefined) return { error: 'Elige la asesora o escribe el plan de acción' };
  let previa = null;
  if (b.error) {
    if (b.error.id) {
      previa = db.prepare('SELECT * FROM errores_agendamiento WHERE id = ?').get(b.error.id);
      if (!previa || previa.campana !== campana) return { noExiste: true };
    }
    const v = validar(db, campana, { ...b.error, mes: b.mes }, false);
    if (v.error) return v;
  }
  if (b.plan !== undefined) {
    const t = String(b.plan || '').trim();
    if (t.length > PLAN_MAX) return { error: 'El plan de acción puede tener hasta ' + PLAN_MAX + ' caracteres' };
    if (pareceDatoPaciente(t)) return { error: mensajeDatoPaciente('El plan de acción', t) };
  }
  const out = {};
  db.transaction(() => {
    if (b.error) {
      const datos = { ...b.error, mes: b.mes };
      delete datos.id;
      if (previa) out.edicion = editar(db, previa.id, datos, actor, ahora);
      else out.creado = crear(db, campana, datos, actor, ahora);
    }
    if (b.plan !== undefined) out.plan = guardarPlan(db, campana, b.mes, b.plan, actor, ahora);
  })();
  return out;
}

module.exports = { OBS_MAX, PLAN_MAX, CANTIDAD_MAX, crearTablas, pareceDatoPaciente, nombreReal, asesorasDe, resumen, crear, editar, borrar, guardarPlan, guardarJunto };
