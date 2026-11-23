// calidad-id-agente.js — Ticket #3 de SURA (supervisora, 23/11/2026): en «Calificar» (Calidad), al elegir
// el asesor, el campo «ID de agente» (extras.idAgente, calidad-campos.js) se llena solo.
//
// La plataforma no guarda un «ID de agente» en el usuario. De dónde sale, en este orden:
//   1. 'wolkvox': el enlace agente de Wolkvox <-> usuario de esa campaña (malla_agente_enlace, puntualidad;
//      lo decide una persona);
//   2. 'monitoreo': el último ID de agente que se escribió en un monitoreo de ese asesor en esa campaña;
//   3. null: no hay dato (el formulario lo dice y el campo queda para escribirlo).
// Solo lectura. El campo sigue editable en el formulario.
'use strict';

const ID_VALIDO = /^[^\u0000-\u001f<>]{1,60}$/;
const limpiar = (v) => { const s = String(v == null ? '' : v).trim(); return ID_VALIDO.test(s) ? s : ''; };

function idAgenteDe(db, campana, userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0 || !campana) return { id: null, origen: null };
  try {
    const e = db.prepare('SELECT agentId FROM malla_agente_enlace WHERE campana = ? AND userId = ?').get(campana, uid);
    const id = e && limpiar(e.agentId);
    if (id) return { id, origen: 'wolkvox' };
  } catch (err) { /* sin la tabla (base vieja): sigue con los monitoreos */ }
  const filas = db.prepare(`SELECT extras FROM monitoreos WHERE campana = ? AND asesorUserId = ? AND extras IS NOT NULL AND extras LIKE '%idAgente%'
    ORDER BY id DESC LIMIT 50`).all(campana, uid);
  for (const f of filas) {
    let ex = null;
    try { ex = JSON.parse(f.extras); } catch (err) { ex = null; }
    const id = ex && limpiar(ex.idAgente);
    if (id) return { id, origen: 'monitoreo' };
  }
  return { id: null, origen: null };
}

module.exports = { idAgenteDe };
