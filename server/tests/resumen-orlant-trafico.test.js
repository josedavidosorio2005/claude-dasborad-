// resumen-orlant-trafico.test.js — Fase 39: llamadas_3p/nivel_atencion_3p/
// llamadas_general/nivel_atencion_general (seccion "resumen" de ORLANT) se
// recalculan solos a partir de los datos ya subidos por Trafico/Wolkvox
// (POST /api/calidad/trafico/carga), sin depender de que alguien llene la
// hoja "resumen" a mano para esos 4 campos. Cubre: agregacion por
// contestadas/total del periodo (nunca promedio de % diarios), que el
// upsert no borra otros campos de resumen ya presentes, y la precedencia
// Trafico-vs-resumen-manual en ambos ordenes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { lineaDeSkill, recalcularResumenOrlantDesdeTrafico } = require('../resumen-orlant-trafico');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Una skill nueva cae en "(SIN ASIGNAR)" hasta que se mapea a una campana
// (Fase 18) -- sin esto, las filas de Trafico de estos tests nunca
// contarian como ORLANT. Idempotente (mismo PUT que ya prueba
// trafico-carga.test.js), asi que cada test la vuelve a llamar en vez de
// depender del orden de ejecucion de los demas.
async function mapearAOrlant(admin, skillName) {
  const r = await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skillName))
    .set(auth(admin))
    .send({ campana: 'ORLANT' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

function traficoFila(over) {
  return {
    fecha: '2027-09-01',
    skillName: 'TEST F39 3P',
    totalLlamadas: 100,
    contestadas: 90,
    ...over,
  };
}

const RESUMEN_OK = {
  llamadas_3p: 1, wpp_3p: 4269, llamadas_general: 1, wpp_general: 2635,
  nivel_atencion_3p: 1, nivel_atencion_wpp_3p: 98, nivel_atencion_general: 1,
  ordmed_gestionados: 716, ordmed_agendas: 140, recup_cancelado: 655, recup_atendido: 290,
  total_agendas: 11918, agendas_general: 7281, agendas_3p: 4637,
  inasist_audifonos: 4, inasist_audiologia: 5, inasist_examenes: 6, inasist_total: 6,
  sta_ordenes: 3797, sta_factcump: 1064, citas_para_mes: 14488, citas_atendidas: 10831,
};

// secciones.resumen trae UNA entrada por periodo ya cargado (no solo la
// ultima) -- hay que buscar la del mes que interesa, nunca asumir indice 0
// (varios de estos tests conviven con otros meses en la misma corrida).
async function resumenDeOrlant(admin, mes) {
  const r = await request(app).get('/api/dashboard/ORLANT').set(auth(admin));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const resumen = r.body.secciones.resumen || [];
  const carga = resumen.find((c) => c.periodo === mes);
  return carga ? carga.filas[0] : null;
}

test('lineaDeSkill: infiere 3P/GENERAL por el nombre, sin generalizar a un skill que no calce', () => {
  assert.equal(lineaDeSkill('CALL INBOUND ORLANT 3P'), '3P');
  assert.equal(lineaDeSkill('call inbound orlant general'), 'GENERAL');
  assert.equal(lineaDeSkill('  CALL INBOUND ORLANT 3P  '), '3P');
  assert.equal(lineaDeSkill('CALL INBOUND ORLANT WHATSAPP'), null);
  assert.equal(lineaDeSkill('GENERALISIMO'), null); // no termina en " GENERAL" (sin espacio antes)
  assert.equal(lineaDeSkill(''), null);
  assert.equal(lineaDeSkill(null), null);
});

test('la agregacion por linea usa contestadas/total del periodo, NUNCA promedio de los % diarios', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2027-09';
  await mapearAOrlant(admin, 'TEST F39 3P');
  // Dia 1: 50% (50/100). Dia 2: 100% (20/20). Promedio simple de los 2 dias
  // seria (50+100)/2 = 75% -- INCORRECTO. El correcto es (50+20)/(100+20) = 58.33%.
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({
      filas: [
        traficoFila({ fecha: mes + '-01', totalLlamadas: 100, contestadas: 50 }),
        traficoFila({ fecha: mes + '-02', totalLlamadas: 20, contestadas: 20 }),
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const fila = await resumenDeOrlant(admin, mes);
  assert.ok(fila, 'debe existir un resumen de ORLANT para ' + mes + ' tras la carga de Trafico');
  assert.equal(fila.llamadas_3p, 120);
  assert.equal(fila.nivel_atencion_3p, 58.33);
});

test('el recalculo desde Trafico NO borra otros campos ya presentes en resumen (whatsapp, agendas, citas...)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2027-10';
  await mapearAOrlant(admin, 'TEST F39 GENERAL');

  const carga = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: [RESUMEN_OK] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const trafico = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [traficoFila({ fecha: mes + '-01', skillName: 'TEST F39 GENERAL', totalLlamadas: 300, contestadas: 270 })] });
  assert.equal(trafico.status, 201, JSON.stringify(trafico.body));

  const fila = await resumenDeOrlant(admin, mes);
  // Los 2 campos de la linea que SI vino en esta carga de Trafico (General) se actualizaron.
  assert.equal(fila.llamadas_general, 300);
  assert.equal(fila.nivel_atencion_general, 90);
  // Los demas campos de la carga manual (whatsapp, agendas, citas, inasistencia...) siguen intactos.
  assert.equal(fila.wpp_3p, RESUMEN_OK.wpp_3p);
  assert.equal(fila.total_agendas, RESUMEN_OK.total_agendas);
  assert.equal(fila.citas_atendidas, RESUMEN_OK.citas_atendidas);
  assert.equal(fila.inasist_total, RESUMEN_OK.inasist_total);
  // La linea 3P (esta carga de Trafico no trajo nada de 3P) no se toco --
  // sigue con el valor que trajo la carga manual.
  assert.equal(fila.llamadas_3p, RESUMEN_OK.llamadas_3p);
});

test('precedencia: si se sube un resumen manual DESPUES de Trafico, Trafico gana para esos 4 campos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2027-11';
  await mapearAOrlant(admin, 'TEST F39 3P');

  const trafico = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [traficoFila({ fecha: mes + '-01', skillName: 'TEST F39 3P', totalLlamadas: 200, contestadas: 180 })] });
  assert.equal(trafico.status, 201, JSON.stringify(trafico.body));

  let fila = await resumenDeOrlant(admin, mes);
  assert.equal(fila.llamadas_3p, 200);
  assert.equal(fila.nivel_atencion_3p, 90);

  // Sube un resumen manual con valores DISTINTOS (y a proposito incorrectos)
  // para llamadas_3p/nivel_atencion_3p. reemplazar:true porque Trafico ya
  // creo una fila de resumen para este mes arriba -- mismo 409 "Ya existe"
  // (feedback Edwin 3.1) que ya exigiria confirmar si un humano subiera esto
  // desde la UI, comportamiento correcto y sin relacion con esta fase.
  const manual = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: mes, reemplazar: true, filas: [{ ...RESUMEN_OK, llamadas_3p: 999999, nivel_atencion_3p: 1 }] });
  assert.equal(manual.status, 200, JSON.stringify(manual.body));

  fila = await resumenDeOrlant(admin, mes);
  // Trafico sigue ganando para estos 2 campos...
  assert.equal(fila.llamadas_3p, 200);
  assert.equal(fila.nivel_atencion_3p, 90);
  // ...pero el resto de la carga manual (que no compite con Trafico) si se guardo.
  assert.equal(fila.total_agendas, RESUMEN_OK.total_agendas);
});

test('precedencia (al reves): un resumen manual subido ANTES de que exista Trafico se respeta, y Trafico lo toma despues', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2027-12';
  await mapearAOrlant(admin, 'TEST F39 3P');

  // Resumen manual primero -- todavia no hay ninguna fila de Trafico para
  // ORLANT este mes, asi que el recalculo (que corre igual tras esta carga)
  // no encuentra nada y no debe tocar lo recien subido.
  const manual = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: [{ ...RESUMEN_OK, llamadas_3p: 555, nivel_atencion_3p: 45 }] });
  assert.equal(manual.status, 201, JSON.stringify(manual.body));

  let fila = await resumenDeOrlant(admin, mes);
  assert.equal(fila.llamadas_3p, 555);
  assert.equal(fila.nivel_atencion_3p, 45);

  // Ahora llega Trafico para ese mismo mes -- debe tomar el control de esos
  // 2 campos, sin tocar el resto (que sigue siendo de la carga manual).
  const trafico = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [traficoFila({ fecha: mes + '-01', skillName: 'TEST F39 3P', totalLlamadas: 40, contestadas: 40 })] });
  assert.equal(trafico.status, 201, JSON.stringify(trafico.body));

  fila = await resumenDeOrlant(admin, mes);
  assert.equal(fila.llamadas_3p, 40);
  assert.equal(fila.nivel_atencion_3p, 100);
  assert.equal(fila.total_agendas, RESUMEN_OK.total_agendas);
});

test('un skill que no calza con ningun patron 3P/GENERAL no rompe la carga y no crea un resumen vacio', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2028-01';

  const trafico = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [traficoFila({ fecha: mes + '-01', skillName: 'CALL INBOUND ORLANT WHATSAPP', totalLlamadas: 50, contestadas: 40 })] });
  assert.equal(trafico.status, 201, JSON.stringify(trafico.body));
  // Este skill nuevo cae bajo "(SIN ASIGNAR)" salvo que ya este mapeado a
  // ORLANT -- lo mapeamos para que el caso relevante (skill de ORLANT que
  // no calza con 3P/GENERAL) quede cubierto de verdad.
  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent('CALL INBOUND ORLANT WHATSAPP')).set(auth(admin)).send({ campana: 'ORLANT' });

  const r = await request(app).get('/api/dashboard/ORLANT').set(auth(admin));
  const resumenMes = (r.body.secciones.resumen || []).find((c) => c.periodo === mes);
  assert.equal(resumenMes, undefined, 'no debe crearse un resumen para un mes donde Trafico no tiene ninguna linea clasificable');
});

test('recalcularResumenOrlantDesdeTrafico: sin filas de trafico para el mes, no toca dashboard_cargas', () => {
  const antes = db.prepare("SELECT COUNT(*) c FROM dashboard_cargas WHERE cliente='ORLANT' AND seccion='resumen' AND periodo='2029-01'").get().c;
  const resultado = recalcularResumenOrlantDesdeTrafico(db, '2029-01');
  assert.equal(resultado.actualizado, false);
  const despues = db.prepare("SELECT COUNT(*) c FROM dashboard_cargas WHERE cliente='ORLANT' AND seccion='resumen' AND periodo='2029-01'").get().c;
  assert.equal(despues, antes);
});
