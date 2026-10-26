// fase169-salida-unificada.test.js — Fase 169: en Tipificacion de LLAMADAS
// los nombres de salida de meses anteriores ("LINEA DE SALIDA", "Linea de
// salida") y el de la Fase 168 ("LLAMADAS DE SALIDA") son el mismo skill:
// salen UNA vez en el filtro y filtrar por cualquiera trae todos. Solo cambia
// como se agrupan/muestran: los datos guardados no se tocan. WhatsApp y los
// demas skills no cambian. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../public/js/tipificacion-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const fila = (fecha, skill, tipo, tip) => ['Asesor Uno', fecha, '09:00:00', null, tip || 'Agendada', skill, null, null, tipo || null, null, null];

test('filtro de skill de Llamadas: los 3 nombres de salida salen como uno solo y filtrar por cualquiera trae los 3 meses', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cargar = async (canal, filas) => {
    const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal, filas });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  };
  await cargar('LLAMADAS', [fila('2025-07-02', 'Linea de salida'), fila('2025-07-03', 'CALL INBOUND ORLANT 3P', 'inbound')]);
  await cargar('LLAMADAS', [fila('2025-08-02', 'LINEA DE SALIDA'), fila('2025-08-03', 'LINEA DE SALIDA', null, 'No Contestan')]);
  await cargar('LLAMADAS', [fila('2025-09-02', 'LLAMADAS DE SALIDA', 'outbound_ma'), fila('2025-09-03', '-', 'otro')]);
  await cargar('WHATSAPP', [fila('2025-09-02', 'WHATSAPP DE SALIDA', 'outbound_ma'), fila('2025-09-03', 'WHATSAPP 3P', 'inbound')]);

  const op = await request(app).get('/api/calidad/tipificacion/opciones').query({ campana: 'ORLANT', canal: 'LLAMADAS' }).set(auth(admin));
  assert.equal(op.status, 200);
  assert.equal(op.body.skills.filter((s) => /salida/i.test(s)).length, 1, 'una sola opcion de salida');
  assert.ok(op.body.skills.includes('LLAMADAS DE SALIDA'));
  assert.ok(!op.body.skills.includes('LINEA DE SALIDA') && !op.body.skills.includes('Linea de salida'));
  // Fase 183: en ORLANT el "-" del CDR (cualquier tipo) tambien es salida: ya no sale suelto.
  assert.ok(!op.body.skills.includes('-') && op.body.skills.includes('CALL INBOUND ORLANT 3P'), 'los demas skills siguen igual');
  assert.equal(T.tipificacionEtiquetaSkill('LLAMADAS DE SALIDA'), 'Llamadas de salida');

  for (const skill of ['LLAMADAS DE SALIDA', 'LINEA DE SALIDA', 'Linea de salida']) {
    const r = await request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'ORLANT', canal: 'LLAMADAS', desde: '2025-07-01', hasta: '2025-09-30', skill }).set(auth(admin));
    // Fase 183: + el "-" de septiembre (tipo otro), que en ORLANT tambien es salida.
    assert.equal(r.body.total, 5, 'filtrando por "' + skill + '" salen los 3 meses');
  }
  const ago = await request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'ORLANT', canal: 'LLAMADAS', mes: '2025-08', skill: 'LLAMADAS DE SALIDA' }).set(auth(admin));
  assert.equal(ago.body.total, 2);
  // Fase 183: en ORLANT el "-" (internalcall/sin tipo) tambien es salida: ya no queda nada como "-".
  const guion = await request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'ORLANT', canal: 'LLAMADAS', mes: '2025-09', skill: '-' }).set(auth(admin));
  assert.equal(guion.body.total, 0);

  // WhatsApp no cambia.
  const opW = await request(app).get('/api/calidad/tipificacion/opciones').query({ campana: 'ORLANT', canal: 'WHATSAPP' }).set(auth(admin));
  assert.ok(opW.body.skills.includes('WHATSAPP DE SALIDA'));
  assert.ok(!opW.body.skills.includes('LLAMADAS DE SALIDA'));

  // Los datos guardados no se tocan: siguen los 3 nombres originales.
  const crudos = db.prepare("SELECT DISTINCT skill FROM tipificaciones WHERE campana='ORLANT' AND canal='LLAMADAS' AND fecha BETWEEN '2025-07-01' AND '2025-09-30' ORDER BY skill").all().map((r) => r.skill);
  assert.deepEqual(crudos, ['-', 'CALL INBOUND ORLANT 3P', 'LINEA DE SALIDA', 'LLAMADAS DE SALIDA', 'Linea de salida']);
});
