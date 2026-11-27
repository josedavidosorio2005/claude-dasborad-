// wolkvox-wa-skill1.js — Fase AU5 (26/11/2026, pedido del usuario): en la réplica «CLINICA AURORA PRUEBAS API», el
// Tráfico de WhatsApp salía con las abandonadas y el ATA vacíos: chat_1 no los trae. Pero skill_1 (la consulta del
// Flujo, ya autorizada en la Fase AU2) devuelve UNA fila por skill y día también para las skills de WhatsApp («WhatsApp»,
// «Confirmaciones WhatsApp», «Recordaciones 3 Días»), con `abandon_calls` y `ata` — el mismo reporte de Skills con el
// que se carga el Aurora real (formato diario SKILL_NAME + DATE). Hasta ahora esas filas se descartaban («otras
// skills fuera»). Aquí:
//  - guardarDelFlujo: el Flujo guarda, por día y skill de WhatsApp de la lista, SOLO dos números (abandonadas y ATA)
//    en `wolkvox_wa_skill1_dia` (reemplaza el mes; nada crudo) y completa las filas de Tráfico de WhatsApp que ya
//    estén cargadas;
//  - completarTrafico: el módulo de WhatsApp (chat_1) completa sus filas día-cola con esos dos números antes de
//    escribirlas.
// El abandono NUNCA se calcula como recibidos − contestados: es el `abandon_calls` de Wolkvox, o queda vacío.
// Ni el nivel de servicio (Edwin: sale de otra base) ni el AHT (skill_1 no lo trae).
'use strict';
const AG = require('./wolkvox-agentes');

const TABLA = 'wolkvox_wa_skill1_dia';
function asegurarTabla(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLA} (
    campana TEXT NOT NULL,
    fecha TEXT NOT NULL,
    skill TEXT NOT NULL,
    abandonados INTEGER,
    ataSegundos REAL,
    PRIMARY KEY (campana, fecha, skill)
  )`);
}

// Puro: de las filas del Flujo (ya convertidas, con skillName/fecha/llamadasAbandonadas/ataSegundos) deja las de las
// skills de WhatsApp de la lista, con solo los dos números.
function filasWhatsapp(filas, waSkills) {
  const out = [];
  for (const f of filas || []) {
    if (!f || !AG.enLista(waSkills, f.skillName)) continue;
    const ab = f.llamadasAbandonadas == null ? null : Number(f.llamadasAbandonadas);
    const ata = f.ataSegundos == null ? null : Number(f.ataSegundos);
    out.push({ fecha: f.fecha, skill: String(f.skillName), abandonados: Number.isFinite(ab) ? Math.round(ab) : null, ataSegundos: Number.isFinite(ata) ? ata : null });
  }
  return out;
}

const _mapa = (db, campana, desde, hasta) => {
  const m = new Map();
  for (const r of db.prepare(`SELECT fecha, skill, abandonados, ataSegundos FROM ${TABLA} WHERE campana = ? AND fecha BETWEEN ? AND ?`).all(campana, desde, hasta)) {
    m.set(r.fecha + '|' + AG.norm(r.skill), r);
  }
  return m;
};

// Completa (en memoria) las filas día-cola de chat_1 con lo que trajo skill_1. Devuelve cuántas completó.
function completarTrafico(db, campana, mes, trafico) {
  asegurarTabla(db);
  const m = _mapa(db, campana, mes + '-01', mes + '-31');
  let n = 0;
  for (const t of trafico) {
    const r = m.get(t.fechaInicio + '|' + AG.norm(t.colaWhatsapp));
    if (!r) continue;
    t.abandonados = r.abandonados;
    t.ataSegundos = r.ataSegundos;
    n++;
  }
  return n;
}

// Lo llama el Flujo tras escribir el mes: reemplaza los números del mes y completa el Tráfico de WhatsApp ya cargado
// (solo esas dos columnas, solo de esta campaña y este mes). Todo en una transacción.
function guardarDelFlujo(db, campana, mes, filas) {
  asegurarTabla(db);
  const desde = mes + '-01', hasta = mes + '-31';
  let actualizadas = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM ${TABLA} WHERE campana = ? AND fecha BETWEEN ? AND ?`).run(campana, desde, hasta);
    const ins = db.prepare(`INSERT OR REPLACE INTO ${TABLA} (campana, fecha, skill, abandonados, ataSegundos) VALUES (?, ?, ?, ?, ?)`);
    for (const f of filas) if (f.fecha >= desde && f.fecha <= hasta) ins.run(campana, f.fecha, f.skill, f.abandonados, f.ataSegundos);
    const m = _mapa(db, campana, desde, hasta);
    const up = db.prepare('UPDATE trafico_whatsapp SET abandonados = ?, ataSegundos = ? WHERE id = ?');
    for (const t of db.prepare('SELECT id, colaWhatsapp, fechaInicio FROM trafico_whatsapp WHERE campana = ? AND fechaInicio BETWEEN ? AND ?').all(campana, desde, hasta)) {
      const r = m.get(t.fechaInicio + '|' + AG.norm(t.colaWhatsapp));
      if (r) { up.run(r.abandonados, r.ataSegundos, t.id); actualizadas++; }
    }
  })();
  return { guardadas: filas.length, actualizadas };
}

module.exports = { TABLA, asegurarTabla, filasWhatsapp, completarTrafico, guardarDelFlujo };
