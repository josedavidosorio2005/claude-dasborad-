// faseN1-orlant-tablero.test.js — Fase N1 (docs/orlant/nuevo-dashboard/plan.md): tablero nuevo de
// ORLANT con las cargas manuales, solo para el administrador. Datos SIEMPRE inventados.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { orlantTableroDatos, lunesDe, rangoValido } = require('../orlant-tablero');
const front = require('../../public/js/orlant-tablero.js');

after(cleanup);
const C = 'ORLANT N1 INVENTADO';
const t = new Date().toISOString();
const L = db.prepare('INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, serviceLevel20secPct, contestadas20sEstimado, createdAt) VALUES (?,?,?,?,?,?,?,?)');
const W = db.prepare('INSERT INTO trafico_whatsapp (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, asaSegundos, createdAt) VALUES (?,?,?,?,?,?,?,?)');
const WT = db.prepare('INSERT INTO whatsapp_tiempos (campana, skill, fecha, hora, segundos, createdAt) VALUES (?,?,?,?,?,?)');
const S = db.prepare('INSERT INTO salida_mensual (campana, mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral, createdAt) VALUES (?,?,?,?,?,?,?)');
const A = db.prepare("INSERT INTO agendas (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, createdAt) VALUES (?, 'ASESORA X', 'SEDE X', 'EX', 'ESP', 'PROF', ?, ?, 'ENT', ?)");
L.run(C, '2026-10-05', 'SKILL A', 100, 90, 80, 80, t);
L.run(C, '2026-10-06', 'SKILL B', 50, 40, null, null, t);
L.run(C, '2026-11-02', 'SKILL A', 60, 30, 50, 30, t);
W.run(C, 'COLA', '2026-10-05', '2026-10-05', 40, 30, 20, t);
W.run(C, 'COLA', '2026-11-02', '2026-11-02', 10, 10, 50, t);
[60, 170, 200, 400].forEach((s) => WT.run(C, 'COLA', '2026-10-05', 9, s, t));
S.run(C, '2026-10', 7, 3, 2, 1, t);
A.run(C, '2026-10-05 09:00:00', 'GENERAL', t); A.run(C, '2026-10-06 09:00:00', '3P', t); A.run(C, '2026-11-02 09:00:00', 'GENERAL', t);

test('llamadas: recibidas, NS 20 s solo con filas que lo traen, abandono y participación por skill', () => {
  const d = orlantTableroDatos(db, { gran: 'mes' }, C);
  const T = d.llamadas.total;
  assert.deepEqual([T.recibidas, T.contestadas, T.abandonadas], [210, 160, 50]);
  assert.equal(T.nivelServicio20s, 110 / 160, 'ns20: (80+30)/(100+60), sin la fila sin dato');
  assert.equal(T.abandono, 50 / 210);
  assert.deepEqual(d.llamadas.serie.map((s) => [s.periodo, s.recibidas]), [['2026-10', 150], ['2026-11', 60]]);
  assert.deepEqual(d.llamadas.porSkill.map((s) => [s.skill, s.recibidas]), [['SKILL A', 160], ['SKILL B', 50]]);
  assert.equal(d.llamadas.porSkill[0].participacion, 160 / 210);
});

test('WhatsApp: rangos 0–3 / 3–5 / >5 min, ASA ponderado; citas y salida por línea; filtro de fechas', () => {
  const d = orlantTableroDatos(db, { gran: 'mes' }, C);
  const T = d.whatsapp.total;
  assert.deepEqual([T.recibidos, T.contestados, T.abandonados, T.rango0a3, T.rango3a5, T.rangoMas5], [50, 40, 10, 2, 1, 1]);
  assert.equal(T.pct0a3, 0.5);
  assert.equal(T.asaSegundos, (20 * 30 + 50 * 10) / 40);
  assert.deepEqual(d.citas.total, { total: 3, general: 2, p3: 1 });
  assert.deepEqual(front.otOutboundLinea(d.outbound.total, '3p'), { llamadas: 7, whatsapp: 2 });
  assert.deepEqual(front.otOutboundLinea(d.outbound.total, 'total'), { llamadas: 10, whatsapp: 3 });
  const nov = orlantTableroDatos(db, { desde: '2026-11-01', hasta: '2026-11-30', gran: 'dia' }, C);
  assert.equal(nov.llamadas.total.recibidas, 60);
  assert.equal(nov.citas.total.total, 1);
  assert.equal(nov.outbound.meses.length, 0, 'octubre fuera del rango');
  assert.deepEqual(nov.llamadas.serie.map((s) => s.periodo), ['2026-11-02']);
  const sem = orlantTableroDatos(db, { gran: 'semana' }, C);
  assert.deepEqual(sem.llamadas.serie.map((s) => s.periodo), ['2026-10-05', '2026-11-02']);
});

test('fechas y granularidad: lunes de la semana, valores inválidos se ignoran, atajos', () => {
  assert.equal(lunesDe('2026-11-21'), '2026-11-16');
  assert.equal(lunesDe('2026-11-16'), '2026-11-16');
  assert.deepEqual(rangoValido({ desde: "2026-11-01' OR 1", hasta: 'x', gran: 'año' }), { desde: null, hasta: null, gran: 'mes' });
  assert.deepEqual(front.otRangoAtajo('mes_anterior', '2026-11-21'), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(front.otRangoAtajo('semana', '2026-11-21'), { desde: '2026-11-16', hasta: '2026-11-21' });
  assert.deepEqual(front.otRangoAtajo('todo', '2026-11-21'), { desde: '', hasta: '' });
});

test('ruta: solo el administrador completo; otro rol 403; sin sesión 401', async () => {
  const tk = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/orlant/tablero?gran=mes').set('Authorization', 'Bearer ' + tk);
  assert.equal(r.status, 200);
  assert.equal(r.body.campana, 'ORLANT');
  assert.ok(r.body.llamadas && r.body.whatsapp && r.body.outbound && r.body.citas);
  assert.equal((await request(app).get('/api/orlant/tablero')).status, 401);
  const bcrypt = require('bcryptjs');
  db.prepare('INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)')
    .run('Sup N1', 'sup_n1', 'SUPERVISOR', bcrypt.hashSync('Clave#2026x', 4), JSON.stringify({ campana_ORLANT: true, cliente_ORLANT: true }), null, t);
  const ts = await tokenFor('sup_n1', 'Clave#2026x');
  assert.equal((await request(app).get('/api/orlant/tablero').set('Authorization', 'Bearer ' + ts)).status, 403);
  assert.equal(front.orlantTableroVeTarjeta(true), true);
  assert.equal(front.orlantTableroVeTarjeta(false), false);
});

test('vista: 4 secciones, línea sin dato en la entrada, «Ver más», Excel; enlazado en el inicio', () => {
  assert.deepEqual(front.OT_SECCIONES.map((s) => s.label), ['Tráfico inbound', 'Tráfico outbound', 'Back office', 'Asesores']);
  const d = orlantTableroDatos(db, { gran: 'mes' }, C);
  const base = { seccion: 'inbound', canal: 'llamadas', linea: 'total', gran: 'mes' };
  const c = front.otContenido(d, base);
  assert.match(c.kpis, /Llamadas recibidas/); assert.match(c.detalle, /Participación por skill/);
  assert.match(front.otContenido(d, { ...base, linea: '3p' }).kpis, /todavía no se separa por línea/);
  assert.match(front.otContenido(d, { ...base, canal: 'citas', linea: '3p' }).kpis, />1</);
  assert.match(front.otContenido(d, { ...base, seccion: 'asesores' }).kpis, /fase N8/);
  assert.deepEqual(front.otHojasExcel(d).map((h) => h.nombre), ['Llamadas', 'Llamadas por skill', 'WhatsApp', 'Citas', 'Salida']);
  const RAIZ = path.join(__dirname, '..', '..', 'public');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  assert.ok(html.includes('<script src="js/orlant-tablero.js"></script>'));
  assert.ok(html.includes('id="ot-overlay"'));
  const core = fs.readFileSync(path.join(RAIZ, 'js', 'dashboards-core.js'), 'utf8');
  assert.ok(core.includes("orlantTableroVeTarjeta(isFullAdmin())"));
});
