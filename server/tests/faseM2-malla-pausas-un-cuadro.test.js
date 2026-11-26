// faseM2-malla-pausas-un-cuadro.test.js — Pedido de Edwin (reunión 26/11/2026): «Pausas, almuerzo y horas» pasa al
// MISMO cuadro del horario (cada día una fila: Trabaja, Entrada, Salida, Pausa activa 1, Almuerzo, Pausa activa 2,
// Horas), sin repetir los días, y el líder elige la duración de cada pausa activa (5, 10, 15, 20 o 30 min; por defecto
// 15 y 10). La cuenta de horas no cambia. Los horarios guardados antes siguen igual. Datos SINTÉTICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const L = require('../../public/js/malla-logic.js');

global.esc = require('../../public/js/esc.js').esc;
Object.assign(global, L);
const UI = require('../../public/js/malla.js');
const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const H = (t) => ({ Authorization: 'Bearer ' + t });
const DIA = (extra) => Object.assign({ entrada: '08:00', salida: '17:00', pausa1: '10:00', almuerzo: '12:30', almuerzoMin: 60, pausa2: '15:30' }, extra || {});
const HOR = { 1: DIA({ pausa1Min: 20, pausa2Min: 5 }), 2: DIA(), 3: null, 4: null, 5: null, 6: null, 7: null };
let sup;
before(async () => {
  db.prepare('INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)')
    .run('Persona fm2_sup', 'fm2_sup', 'SUPERVISOR', bcrypt.hashSync('Clave#2026x', 4), JSON.stringify({ supervisa_ORLANT: true }), new Date().toISOString());
  sup = await tokenFor('fm2_sup', 'Clave#2026x');
});

test('duración de cada pausa: la elegida se guarda; sin elegir, 15 y 10 min; otra duración se rechaza', () => {
  assert.deepEqual(L.MALLA_PAUSA_OPCIONES, [5, 10, 15, 20, 30]);
  const v = L.mallaValidarHorario(HOR);
  assert.ok(v.ok, v.error);
  assert.equal(v.horario[1].pausa1Min, 20);
  assert.equal(v.horario[1].pausa2Min, 5);
  assert.equal(v.horario[2].pausa1Min, 15);
  assert.equal(v.horario[2].pausa2Min, 10);
  assert.equal(L.mallaValidarHorario({ 1: DIA({ pausa1Min: '30' }) }).horario[1].pausa1Min, 30, 'del formulario llega como texto');
  assert.match(L.mallaValidarHorario({ 1: DIA({ pausa1Min: 7 }) }).error, /Lunes: la pausa activa 1 dura 5, 10, 15, 20, 30 min/);
  assert.match(L.mallaValidarHorario({ 1: DIA({ pausa2Min: 45 }) }).error, /la pausa activa 2 dura/);
  // Sin hora de pausa, la duración no se guarda.
  const sin = L.mallaValidarHorario({ 1: DIA({ pausa1: '', pausa1Min: 20 }) }).horario[1];
  assert.ok(!('pausa1' in sin) && !('pausa1Min' in sin));
  // Lo guardado antes (sin duración) se lee con 15 y 10.
  assert.equal(L.mallaPausaMin({ pausa1: '10:00' }, 1), 15);
  assert.equal(L.mallaPausaMin({ pausa2: '15:00' }, 2), 10);
  assert.equal(L.mallaPausaMin({ pausa2: '15:00', pausa2Min: 99 }, 2), 10);
});

test('la duración elegida cuenta para quedar dentro del turno y para el orden del día; las horas no cambian', () => {
  assert.match(L.mallaValidarHorario({ 1: DIA({ pausa2: '16:40', pausa2Min: 30 }) }).error, /pausa activa 2 debe quedar dentro del turno/, '16:40 + 30 min pasa de las 17:00');
  assert.ok(L.mallaValidarHorario({ 1: DIA({ pausa2: '16:40', pausa2Min: 20 }) }).ok, '16:40 + 20 min = 17:00 vale');
  assert.match(L.mallaValidarHorario({ 1: DIA({ pausa1: '12:15', pausa1Min: 20 }) }).error, /la pausa activa 1 va antes del almuerzo/, '12:15 + 20 min se cruza con el almuerzo de las 12:30');
  assert.ok(L.mallaValidarHorario({ 1: DIA({ pausa1: '12:15', pausa1Min: 15 }) }).ok);
  assert.equal(L.mallaMinutosDia(L.mallaValidarHorario(HOR).horario[1]), 8 * 60, 'salida − entrada − almuerzo');
  assert.equal(L.mallaPausasTexto(L.mallaValidarHorario(HOR).horario[1]), 'Pausa 10:00–10:20 · Almuerzo 12:30–13:30 · Pausa 15:30–15:35');
});

test('un solo cuadro: cada día una fila con horario, pausas (con su duración) y horas; el festivo sin pausas', () => {
  const g = UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: HOR, asesoras: [] }, true, [], 0, { ajustes: [], novedades: [] });
  assert.equal((g.match(/<table/g) || []).length, 1, 'una sola tabla: los días no se repiten');
  assert.ok(!g.includes('ml-pausas') && !g.includes('<details'), 'ya no hay un cuadro aparte de pausas');
  assert.match(g, /<th scope="col">Entrada<\/th><th scope="col">Salida<\/th><th scope="col">Pausa activa 1<\/th><th scope="col">Almuerzo<\/th><th scope="col">Pausa activa 2<\/th><th scope="col">Horas<\/th>/);
  assert.equal((g.match(/<tr data-dia="/g) || []).length, 7);
  // Lunes: pausa 1 de 20 min y pausa 2 de 5 min seleccionadas.
  assert.match(g, /<select id="ml-g0-d11" aria-label="Duración de la pausa activa 1 del lunes">.*?<option value="20" selected>20 min<\/option>/);
  assert.match(g, /<select id="ml-g0-d21" aria-label="Duración de la pausa activa 2 del lunes"><option value="5" selected>5 min<\/option>/);
  // Martes sin duración guardada: 15 y 10 por defecto.
  assert.match(g, /<select id="ml-g0-d12"[^>]*>.*?<option value="15" selected>/);
  assert.match(g, /<select id="ml-g0-d22"[^>]*>.*?<option value="10" selected>/);
  // Miércoles de descanso: pausas y duraciones deshabilitadas.
  assert.match(g, /<tr data-dia="3" class="ml-descanso">/);
  assert.match(g, /id="ml-g0-d13" disabled/);
  assert.match(g, /id="ml-g0-hd1">8 h</);
  assert.match(g, /<tr class="ml-fila-festivo">.*?Sin pausas ni horas: el festivo no cuenta en la semana/);
  assert.match(g, /<fieldset class="ml-asesoras">/, 'la lista de asesoras sigue, debajo');
  // Solo lectura: todo deshabilitado y sin recálculo.
  const ro = UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: HOR, asesoras: [] }, false, [], 0, { ajustes: [], novedades: [] });
  assert.match(ro, /id="ml-g0-d11" disabled/);
  assert.ok(!ro.includes('oninput='));
});

test('el formulario lee la duración y el recálculo habilita/deshabilita también los selectores de duración', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'malla.js'), 'utf8');
  assert.match(js, /t\.pausa1Min = Number\(val\(pre \+ '-d1' \+ d\.n\)\) \|\| MALLA_PAUSA1_MIN;/);
  assert.match(js, /t\.pausa2Min = Number\(val\(pre \+ '-d2' \+ d\.n\)\) \|\| MALLA_PAUSA2_MIN;/);
  assert.match(js, /\['-p1', '-d1', '-al', '-am', '-p2', '-d2'\]\.forEach/);
});

test('celular y tableta (≤900 px): cada día es una tarjeta; un día de descanso muestra solo «Trabaja»', () => {
  const i = CSS.indexOf('@media (max-width:900px){\n  .ml-tabla-dia thead');
  assert.ok(i !== -1, 'hay reglas para ≤900 px');
  const m = CSS.slice(i, CSS.indexOf('\n}', i));
  assert.match(m, /\.ml-tabla-dia tr\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-areas:"dia horas" "trab trab" "ent sal" "p1 p2" "alm alm"/);
  assert.match(m, /\.ml-tabla-dia tr\.ml-descanso td:not\(\.ml-celda-trab\):not\(\.ml-horas-dia\)\{display:none\}/);
  assert.match(m, /\.ml-tabla-dia td::before\{content:attr\(data-etq\)/);
  assert.ok(CSS.includes('.ml-tabla-dia select,.ml-tabla-dia input[type="time"],.ml-tabla input[type="time"]{min-height:44px}'), '44 px en el celular');
});

test('API: el supervisor guarda la duración elegida y una duración inválida da 400 con el motivo', async () => {
  const r = await request(app).post('/api/malla/grupos').set(H(sup)).send({ campana: 'ORLANT', semana: '2030-04-01', nombre: 'Pausas M2', horario: HOR });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.grupo.horario[1].pausa1Min, 20);
  assert.equal(r.body.grupo.horario[1].pausa2Min, 5);
  const mal = await request(app).put(`/api/malla/grupos/${r.body.grupo.id}`).set(H(sup)).send({ horario: Object.assign({}, HOR, { 1: DIA({ pausa1Min: 12 }) }) });
  assert.equal(mal.status, 400);
  assert.match(mal.body.error, /la pausa activa 1 dura 5, 10, 15, 20, 30 min/);
});
