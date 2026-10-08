// fase119-cargas-multi-mes.test.js — Fase 119, Parte 2 (PRIORIDAD ALTA):
// prueba, no suposicion, de que subir un mes/rango nuevo nunca daña otro
// mes/rango ni otra campaña ya cargada, y de que una falla a mitad de
// carga nunca deja nada a medias. Cubre las 7 bases: Trafico de Llamadas,
// Trafico de WhatsApp, Tipificacion, Agendas, Inasistencia, Efectividad de
// Agendamiento, Efectividad de Citas. Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// ══════════════════════════════════════════════════════════════════
// Helper generico: monkey-patch de db.prepare para que el Nth INSERT de
// una tabla lance una excepcion DENTRO de la transaccion -- better-sqlite3
// revierte la transaccion COMPLETA (el DELETE de reemplazo incluido) ante
// cualquier excepcion. Se restaura siempre, incluso si la peticion lanza.
// ══════════════════════════════════════════════════════════════════
async function conFallaInyectadaEnInsert(tablaInsert, nFallo, fn) {
  const originalPrepare = db.prepare.bind(db);
  db.prepare = function (sql) {
    const stmt = originalPrepare(sql);
    if (new RegExp('INSERT INTO ' + tablaInsert + '\\b').test(sql)) {
      const originalRun = stmt.run.bind(stmt);
      let n = 0;
      stmt.run = function (...args) {
        n++;
        if (n === nFallo) throw new Error('FASE119_FALLA_INYECTADA');
        return originalRun(...args);
      };
    }
    return stmt;
  };
  try {
    return await fn();
  } finally {
    db.prepare = originalPrepare;
  }
}

function contarFilas(tabla, campana) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE campana = ?`).get(campana).n;
}

let adminToken;
test('setup: token admin', async () => {
  adminToken = await tokenFor('admin', MASTER_PASSWORD);
  assert.ok(adminToken);
});

// ══════════════════════════════════════════════════════════════════
// A. Falla a mitad de carga inyectada -- 0 filas a medias, las 7 bases.
// ══════════════════════════════════════════════════════════════════

test('Fase 119 2.A Tipificación: falla a mitad de la carga -- 0 filas a medias (transaccion revertida completa)', async () => {
  const filaTip = (over) => Object.assign(['Asesor Previo', '2026-01-10', '10:00:00', 3, 'AGENDADA_InConexion', 'SKILL_FALLA_TIP', null, null, null, null, null], over || {});
  // Carga previa legitima, para confirmar que tampoco se pierde lo que ya estaba.
  const previa = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [filaTip()] });
  assert.equal(previa.status, 201, JSON.stringify(previa.body));
  const antes = contarFilas('tipificaciones', 'ORLANT');

  const filasNuevas = Array.from({ length: 5 }, (_, i) => filaTip([`Asesor ${i}`, '2026-02-0' + (i + 1), '10:00:00', 3, 'AGENDADA_InConexion', 'SKILL_FALLA_TIP']));
  const res = await conFallaInyectadaEnInsert('tipificaciones', 3, () =>
    request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: filasNuevas })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('tipificaciones', 'ORLANT'), antes, 'ni el DELETE de reemplazo ni ningun INSERT debieron quedar aplicados');
});

test('Fase 119 2.A Trafico de WhatsApp: falla a mitad de la carga -- 0 filas a medias', async () => {
  const filaWpp = (cola) => ({ colaWhatsapp: cola, fechaInicio: '2026-03-01', fechaFin: '2026-03-31', totalWhatsapp: 100, contestados: 90 });
  const antes = contarFilas('trafico_whatsapp', 'ORLANT');
  const colas = ['SKILL_FALLA_WPP_1', 'SKILL_FALLA_WPP_2', 'SKILL_FALLA_WPP_3', 'SKILL_FALLA_WPP_4'];
  const res = await conFallaInyectadaEnInsert('trafico_whatsapp', 2, () =>
    request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', filas: colas.map(filaWpp) })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('trafico_whatsapp', 'ORLANT'), antes);
});

test('Fase 119 2.A Agendas: falla a mitad de la carga -- 0 filas a medias', async () => {
  const filaAg = (asesor) => ['ASESOR ' + asesor, 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2026-04-15 10:00:00', 'GENERAL', 'EPS DEMO'];
  const antes = contarFilas('agendas', 'ORLANT');
  const res = await conFallaInyectadaEnInsert('agendas', 3, () =>
    request(app).post('/api/calidad/agendas/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', filas: ['A', 'B', 'C', 'D', 'E'].map(filaAg) })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('agendas', 'ORLANT'), antes);
});

test('Fase 119 2.A Inasistencia: falla a mitad de la carga -- 0 filas a medias', async () => {
  const filaIn = (mes) => [mes, 'SEDE FALLA', 'AUDIFONOS', 'EPS DEMO', 1, 1, 0, 10, 12];
  const antes = contarFilas('inasistencias', 'ORLANT');
  const res = await conFallaInyectadaEnInsert('inasistencias', 2, () =>
    request(app).post('/api/calidad/inasistencia/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', filas: ['2026-05', '2026-06', '2026-07'].map(filaIn) })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('inasistencias', 'ORLANT'), antes);
});

test('Fase 119 2.A Efectividad de Agendamiento: falla a mitad de la carga -- 0 filas a medias', async () => {
  const filaEa = (asesor) => ['2026-08', 'ASESOR ' + asesor, 100, 50];
  const antes = contarFilas('efectividad_agendamiento', 'ORLANT');
  const res = await conFallaInyectadaEnInsert('efectividad_agendamiento', 2, () =>
    request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', filas: ['A', 'B', 'C'].map(filaEa) })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('efectividad_agendamiento', 'ORLANT'), antes);
});

test('Fase 119 2.A Efectividad de Citas: falla a mitad de la carga -- 0 filas a medias', async () => {
  const antes = contarFilas('efectividad_citas', 'ORLANT');
  const res = await conFallaInyectadaEnInsert('efectividad_citas', 1, () =>
    request(app).post('/api/calidad/efectividad-citas/carga').set(auth(adminToken))
      .send({ campana: 'ORLANT', filas: [['2026-09', 100, 50], ['2026-10', 100, 50]] })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('efectividad_citas', 'ORLANT'), antes);
});

test('Fase 119 2.A Trafico de Llamadas: falla a mitad de la carga -- 0 filas a medias', async () => {
  const skill = 'SKILL_FALLA_VOZ_' + Date.now();
  const mapeo = await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skill)).set(auth(adminToken)).send({ campana: 'ORLANT' });
  assert.equal(mapeo.status, 200, JSON.stringify(mapeo.body));
  const filaTr = (dia) => ({ fecha: '2026-07-0' + dia, skillName: skill, totalLlamadas: 10, contestadas: 9, nivelAtencionPct: 90 });
  const antes = contarFilas('calidad_nivel_servicio_diario', 'ORLANT');
  const res = await conFallaInyectadaEnInsert('calidad_nivel_servicio_diario', 3, () =>
    request(app).post('/api/calidad/trafico/carga').set(auth(adminToken))
      .send({ filas: [1, 2, 3, 4, 5].map(filaTr) })
  );
  assert.equal(res.status, 500, JSON.stringify(res.body));
  assert.equal(contarFilas('calidad_nivel_servicio_diario', 'ORLANT'), antes);
});

// ══════════════════════════════════════════════════════════════════
// B. Otra campaña con las mismas fechas/mes no se toca (aislamiento al
//    ESCRIBIR, no solo al leer -- ya cubierto por "respeta el acceso por
//    campana" en los archivos existentes).
// ══════════════════════════════════════════════════════════════════

test('Fase 119 2.B Tipificación: cargar ORLANT nunca toca CLINICA AURORA en el mismo rango de fechas', async () => {
  const filaAurora = ['Asesor Aurora', '2026-01-20', '09:00:00', 2, 'AGENDADA_InConexion', 'SKILL_AURORA_TIP', null, null, null, null, null];
  const aurora = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
    .send({ campana: 'CLINICA AURORA', canal: 'LLAMADAS', filas: [filaAurora] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('tipificaciones', 'CLINICA AURORA');

  const filaOrlant = ['Asesor Orlant', '2026-01-20', '09:00:00', 2, 'AGENDADA_InConexion', 'SKILL_ORLANT_TIP', null, null, null, null, null];
  const orlant = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [filaOrlant] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('tipificaciones', 'CLINICA AURORA'), antesAurora, 'cargar ORLANT no debe tocar CLINICA AURORA');
});

test('Fase 119 2.B Agendas: cargar ORLANT nunca toca CLINICA AURORA en el mismo rango de fechas', async () => {
  const filaAurora = ['ASESOR AURORA', 'SEDE X', 'EXAMEN X', 'ESP X', 'DR X', '2026-02-10 10:00:00', 'GENERAL', 'EPS X'];
  const aurora = await request(app).post('/api/calidad/agendas/carga').set(auth(adminToken)).send({ campana: 'CLINICA AURORA', filas: [filaAurora] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('agendas', 'CLINICA AURORA');

  const filaOrlant = ['ASESOR ORLANT', 'SEDE Y', 'EXAMEN Y', 'ESP Y', 'DR Y', '2026-02-10 11:00:00', 'GENERAL', 'EPS Y'];
  const orlant = await request(app).post('/api/calidad/agendas/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [filaOrlant] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('agendas', 'CLINICA AURORA'), antesAurora);
});

test('Fase 119 2.B Inasistencia: cargar ORLANT nunca toca CLINICA AURORA en el mismo mes', async () => {
  const filaAurora = ['2026-03', 'SEDE AURORA', 'ESP AURORA', 'EPS AURORA', 1, 1, 0, 5, 7];
  const aurora = await request(app).post('/api/calidad/inasistencia/carga').set(auth(adminToken)).send({ campana: 'CLINICA AURORA', filas: [filaAurora] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('inasistencias', 'CLINICA AURORA');

  const filaOrlant = ['2026-03', 'SEDE ORLANT', 'ESP ORLANT', 'EPS ORLANT', 1, 1, 0, 5, 7];
  const orlant = await request(app).post('/api/calidad/inasistencia/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [filaOrlant] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('inasistencias', 'CLINICA AURORA'), antesAurora);
});

test('Fase 119 2.B Trafico de WhatsApp: cargar ORLANT nunca toca CLINICA AURORA en el mismo periodo', async () => {
  const aurora = await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(adminToken))
    .send({ campana: 'CLINICA AURORA', filas: [{ colaWhatsapp: 'COLA AURORA', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', totalWhatsapp: 50, contestados: 40 }] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('trafico_whatsapp', 'CLINICA AURORA');

  const orlant = await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [{ colaWhatsapp: 'COLA ORLANT', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', totalWhatsapp: 50, contestados: 40 }] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('trafico_whatsapp', 'CLINICA AURORA'), antesAurora);
});

test('Fase 119 2.B Efectividad de Agendamiento: cargar ORLANT nunca toca CLINICA AURORA en el mismo mes', async () => {
  const aurora = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken))
    .send({ campana: 'CLINICA AURORA', filas: [['2026-05', 'ASESOR AURORA', 80, 40]] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('efectividad_agendamiento', 'CLINICA AURORA');

  const orlant = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [['2026-05', 'ASESOR ORLANT', 80, 40]] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('efectividad_agendamiento', 'CLINICA AURORA'), antesAurora);
});

test('Fase 119 2.B Efectividad de Citas: cargar ORLANT nunca toca CLINICA AURORA en el mismo mes', async () => {
  const aurora = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(adminToken)).send({ campana: 'CLINICA AURORA', filas: [['2026-06', 60, 30]] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('efectividad_citas', 'CLINICA AURORA');

  const orlant = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [['2026-06', 60, 30]] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('efectividad_citas', 'CLINICA AURORA'), antesAurora);
});

test('Fase 119 2.B Trafico de Llamadas: 2 skills mapeadas a campañas distintas, mismas fechas, no se mezclan', async () => {
  const skillOrlant = 'SKILL_B_ORLANT_' + Date.now();
  const skillAurora = 'SKILL_B_AURORA_' + Date.now();
  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skillOrlant)).set(auth(adminToken)).send({ campana: 'ORLANT' });
  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skillAurora)).set(auth(adminToken)).send({ campana: 'CLINICA AURORA' });

  const aurora = await request(app).post('/api/calidad/trafico/carga').set(auth(adminToken))
    .send({ filas: [{ fecha: '2026-08-05', skillName: skillAurora, totalLlamadas: 20, contestadas: 18, nivelAtencionPct: 90 }] });
  assert.equal(aurora.status, 201, JSON.stringify(aurora.body));
  const antesAurora = contarFilas('calidad_nivel_servicio_diario', 'CLINICA AURORA');

  const orlant = await request(app).post('/api/calidad/trafico/carga').set(auth(adminToken))
    .send({ filas: [{ fecha: '2026-08-05', skillName: skillOrlant, totalLlamadas: 20, contestadas: 18, nivelAtencionPct: 90 }] });
  assert.equal(orlant.status, 201, JSON.stringify(orlant.body));

  assert.equal(contarFilas('calidad_nivel_servicio_diario', 'CLINICA AURORA'), antesAurora);
});

// ══════════════════════════════════════════════════════════════════
// C. Orden inverso: cargar un periodo ANTERIOR despues de uno ya cargado
//    mas reciente no daña nada (los 2 quedan intactos).
// ══════════════════════════════════════════════════════════════════

test('Fase 119 2.C Tipificación: cargar un rango ANTERIOR despues de uno mas reciente no daña ninguno de los 2', async () => {
  const reciente = ['Asesor Reciente', '2026-07-15', '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL_ORDEN_TIP', null, null, null, null, null];
  const anterior = ['Asesor Anterior', '2026-06-10', '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL_ORDEN_TIP', null, null, null, null, null];
  const r1 = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [reciente] });
  assert.equal(r1.status, 201);
  const r2 = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [anterior] });
  assert.equal(r2.status, 201);

  const porTipo = await request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'ORLANT', canal: 'LLAMADAS' }).set(auth(adminToken));
  assert.equal(porTipo.status, 200);
  const existeJunio = db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana='ORLANT' AND fecha='2026-06-10' AND skill='SKILL_ORDEN_TIP'").get().n;
  const existeJulio = db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana='ORLANT' AND fecha='2026-07-15' AND skill='SKILL_ORDEN_TIP'").get().n;
  assert.equal(existeJunio, 1, 'el rango anterior (junio) debe seguir ahi');
  assert.equal(existeJulio, 1, 'el rango mas reciente (julio), cargado ANTES, no debio perderse');
});

test('Fase 119 2.C Inasistencia: cargar un mes ANTERIOR despues de uno mas reciente no daña ninguno de los 2', async () => {
  const r1 = await request(app).post('/api/calidad/inasistencia/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [['2026-08', 'SEDE ORDEN', 'ESP ORDEN', 'EPS ORDEN', 1, 1, 0, 5, 7]] });
  assert.equal(r1.status, 201);
  const r2 = await request(app).post('/api/calidad/inasistencia/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [['2026-07', 'SEDE ORDEN', 'ESP ORDEN', 'EPS ORDEN', 1, 1, 0, 5, 7]] });
  assert.equal(r2.status, 201);

  const mensual = await request(app).get('/api/calidad/inasistencia/mensual').query({ campana: 'ORLANT' }).set(auth(adminToken));
  const meses = mensual.body.map((m) => m.mes);
  assert.ok(meses.includes('2026-08'), 'el mes mas reciente (agosto), cargado ANTES, no debio perderse');
  assert.ok(meses.includes('2026-07'), 'el mes anterior (julio) debe seguir ahi');
});

test('Fase 119 2.C Efectividad de Agendamiento: cargar un mes ANTERIOR despues de uno mas reciente no daña ninguno de los 2', async () => {
  const r1 = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [['2026-08', 'ASESOR ORDEN', 90, 45]] });
  assert.equal(r1.status, 201);
  const r2 = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken)).send({ campana: 'ORLANT', filas: [['2026-07', 'ASESOR ORDEN', 90, 45]] });
  assert.equal(r2.status, 201);

  const r1Ahora = db.prepare("SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana='ORLANT' AND mes='2026-08' AND asesor='ASESOR ORDEN'").get().n;
  const r2Ahora = db.prepare("SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana='ORLANT' AND mes='2026-07' AND asesor='ASESOR ORDEN'").get().n;
  assert.equal(r1Ahora, 1);
  assert.equal(r2Ahora, 1);
});

// ══════════════════════════════════════════════════════════════════
// D. Hallazgo real: efectividad-agendamiento no tenia la prueba de "un
//    archivo con VARIOS meses reemplaza SOLO esos meses" que si tenian
//    inasistencia y efectividad-citas.
// ══════════════════════════════════════════════════════════════════

test('Fase 119 2.D Efectividad de Agendamiento: un archivo con VARIOS meses reemplaza SOLO esos meses (hallazgo real: faltaba esta prueba)', async () => {
  const base = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [['2026-05', 'ASESOR VARIOS', 100, 50]] });
  assert.equal(base.status, 201);

  const variosMeses = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [['2026-06', 'ASESOR VARIOS', 80, 40], ['2026-07', 'ASESOR VARIOS', 60, 30]] });
  assert.equal(variosMeses.status, 201, JSON.stringify(variosMeses.body));

  const mayo = db.prepare("SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana='ORLANT' AND mes='2026-05' AND asesor='ASESOR VARIOS'").get().n;
  const junio = db.prepare("SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana='ORLANT' AND mes='2026-06' AND asesor='ASESOR VARIOS'").get().n;
  const julio = db.prepare("SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana='ORLANT' AND mes='2026-07' AND asesor='ASESOR VARIOS'").get().n;
  assert.equal(mayo, 1, 'Mayo-26 no se toco (no vino en el 2do archivo)');
  assert.equal(junio, 1);
  assert.equal(julio, 1);
});

// ══════════════════════════════════════════════════════════════════
// E. Fecha futura -> rechazada (confirmacion dinamica end-to-end; el
//    schema de validation.js ya la rechaza, no tenian prueba estos 4).
// ══════════════════════════════════════════════════════════════════

// "futura" aqui significa "posterior al fin del MES EN CURSO"
// (fechaLimitesEsFutura, server/fecha-limites.js) -- una fecha de MAÑANA
// sigue dentro del mes en curso y NO se rechaza (confirmado al escribir
// esta prueba: un primer intento con mañana() devolvio 201, no 400). El
// primer dia del mes SIGUIENTE si es inequivocamente futuro sin importar
// que dia del mes se corra esta prueba.
function primerDiaMesSiguiente() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}

test('Fase 119 2.E Trafico de Llamadas: fecha futura (mes siguiente) -> 400 (confirmacion dinamica, hallazgo: faltaba esta prueba)', async () => {
  const res = await request(app).post('/api/calidad/trafico/carga').set(auth(adminToken))
    .send({ filas: [{ fecha: primerDiaMesSiguiente(), skillName: 'SKILL_FUTURA', totalLlamadas: 10, contestadas: 9, nivelAtencionPct: 90 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('Fase 119 2.E Trafico de WhatsApp: fecha futura (mes siguiente) -> 400 (confirmacion dinamica, hallazgo: faltaba esta prueba)', async () => {
  const res = await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [{ colaWhatsapp: 'COLA FUTURA', fechaInicio: primerDiaMesSiguiente(), fechaFin: primerDiaMesSiguiente(), totalWhatsapp: 10, contestados: 9 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('Fase 119 2.E Agendas: fecha futura (mes siguiente) -> 400 (confirmacion dinamica, hallazgo: faltaba esta prueba)', async () => {
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [['ASESOR X', 'SEDE X', 'EXAMEN X', 'ESP X', 'DR X', primerDiaMesSiguiente() + ' 10:00:00', 'GENERAL', 'EPS X']] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('Fase 119 2.E Tipificación: fecha futura (mes siguiente) -> 400 (confirmacion dinamica, hallazgo: faltaba esta prueba)', async () => {
  const res = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [['Asesor X', primerDiaMesSiguiente(), '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL X', null, null, null, null, null]] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

// ══════════════════════════════════════════════════════════════════
// F. Detección del archivo equivocado en la ventana equivocada: un body
//    con la FORMA de otra base nunca se acepta silenciosamente.
// ══════════════════════════════════════════════════════════════════

test('Fase 119 2.F: subir una fila con forma de WhatsApp (objeto) a la carga de Llamadas (objeto distinto) -> 400, nunca se mezcla', async () => {
  const res = await request(app).post('/api/calidad/trafico/carga').set(auth(adminToken))
    .send({ filas: [{ colaWhatsapp: 'ESTO ES WHATSAPP', fechaInicio: '2026-01-01', fechaFin: '2026-01-31', totalWhatsapp: 10, contestados: 9 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('Fase 119 2.F: subir una fila con forma de Tipificación (array de 6) a la carga de Agendas (array de 8) -> 400, nunca se mezcla', async () => {
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', filas: [['Asesor X', '2026-01-01', '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL X']] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('Fase 119 2.F: canal LLAMADAS vs WHATSAPP de Tipificación -- un canal invalido se rechaza, nunca se guarda en el otro', async () => {
  const res = await request(app).post('/api/calidad/tipificacion/carga').set(auth(adminToken))
    .send({ campana: 'ORLANT', canal: 'VIDEOLLAMADA', filas: [['Asesor X', '2026-01-01', '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL X', null, null, null, null, null]] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
