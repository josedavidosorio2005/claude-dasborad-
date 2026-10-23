// skills-whatsapp.js — Fase 168 (reunion con Edwin del 23/10/2026). El export
// HistChat de WhatsApp de Wolkvox trae SKILL_ID (numerico) y no el nombre del
// skill: este mapa codigo -> nombre, por cliente, es el que usa el navegador
// para leer ese archivo (tipificacionParseFilas, opciones.skillsWhatsapp). Lo
// edita un administrador desde Cargar Datos; la semilla de ORLANT entra con
// la migracion fase168_skills_whatsapp_v1 (server/db.js). SKILL_ID 0 es el
// WhatsApp de SALIDA.
'use strict';

const SEMILLA_ORLANT = [
  ['0', 'WHATSAPP DE SALIDA'],
  ['4042', 'WHATSAPP PAUTAS'],
  ['4047', 'WHATSAPP AUDIFONOS'],
  ['4061', 'WHATSAPP FONOAUDIOLOGIA'],
  ['4071', 'WHATSAPP FONIATRIA'],
  ['4306', 'WHATSAPP 3P'],
  ['4327', 'WHATSAPP GENERAL'],
  ['4338', 'WHATSAPP CONFIRMACIONES'],
  ['4362', 'ATENCION TUTELAS'],
];

// Lista ordenada por codigo numerico (0 primero).
function listarSkillsWhatsapp(db, campana) {
  return db
    .prepare('SELECT codigo, nombre FROM skills_whatsapp WHERE campana = ? ORDER BY CAST(codigo AS INTEGER), codigo')
    .all(campana);
}

// Reemplaza el mapa completo del cliente en una sola transaccion (la lista
// ya viene validada por Zod: codigos unicos, solo digitos).
function guardarSkillsWhatsapp(db, campana, skills) {
  const ahora = new Date().toISOString();
  const del = db.prepare('DELETE FROM skills_whatsapp WHERE campana = ?');
  const ins = db.prepare('INSERT INTO skills_whatsapp (campana, codigo, nombre, updatedAt) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    del.run(campana);
    for (const s of skills) ins.run(campana, s.codigo, s.nombre, ahora);
  })();
  return listarSkillsWhatsapp(db, campana);
}

module.exports = { SEMILLA_ORLANT, listarSkillsWhatsapp, guardarSkillsWhatsapp };
