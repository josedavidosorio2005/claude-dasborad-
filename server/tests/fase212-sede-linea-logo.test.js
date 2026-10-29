// fase212-sede-linea-logo.test.js — Fase 212 (pedidos de Edwin del 29/10, solo ORLANT).
// 1) Agendamiento: la sede de la base cruda (CODIGO_SEDE) sale con su nombre,
//    sin ceros a la izquierda ("1" = "01"); un codigo fuera de la lista sale
//    como "Sede <codigo>"; los nombres en mayusculas del formato anterior
//    pasan al mismo nombre (una sola opcion del filtro para todos los meses).
//    Se aplica al consultar: lo ya cargado no se vuelve a subir.
// 2) "Tipo de línea" resaltado y bien filtrado en las 3 vistas; una respuesta
//    vieja nunca pisa a la nueva.
// 3) Logo de InConexion mas grande, arriba a la derecha, encima de los botones.
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const { nombreSede, sedesAgendasJson } = require('../agendas-clasificacion');
const { textoFormatoNombre } = require('../../public/js/texto-formato-logic');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PUB = path.join(__dirname, '..', '..', 'public');

test('nombre de la sede: sin ceros a la izquierda, "Sede <código>" fuera de la lista, solo ORLANT', () => {
  assert.equal(nombreSede('ORLANT', '01'), 'Sede Principal');
  assert.equal(nombreSede('ORLANT', '1'), 'Sede Principal');
  assert.equal(nombreSede('ORLANT', ' 002 '), 'Sede Poblado');
  assert.equal(nombreSede('ORLANT', '4'), 'Sede 34 (Audífonos)');
  assert.equal(nombreSede('ORLANT', '05'), 'Sede Rionegro');
  assert.equal(nombreSede('ORLANT', '6'), 'Sede Llanogrande');
  assert.equal(nombreSede('ORLANT', '07'), 'Sede 07');
  assert.equal(nombreSede('MOBILIZE', '01'), 'Sede 01');
  assert.equal(sedesAgendasJson('MOBILIZE'), '{}');
  const mapa = JSON.parse(sedesAgendasJson('ORLANT'));
  assert.equal(mapa['SEDE 34 (AUDIFONOS)'], 'Sede 34 (Audífonos)');
  assert.equal(mapa['SEDE PRINCIPAL'], 'Sede Principal');
  // "(Audífonos)" conserva su mayuscula al mostrarlo.
  assert.equal(textoFormatoNombre('Sede 34 (Audífonos)'), 'Sede 34 (Audífonos)');
  assert.equal(textoFormatoNombre('(3P) linea'), '(3P) Linea');
  assert.equal(textoFormatoNombre('Call Inbound ORLANT 3P'), 'Call Inbound ORLANT 3P');
});

test('Agendamiento: sede con nombre en opciones, filtro y graficas (lo cargado no cambia), y Tipo de línea en las 3 vistas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Formato anterior (ago): la sede ya viene con nombre en mayusculas.
  const vieja = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [
    ['ASESOR UNO', 'SEDE PRINCIPAL', 'EX', 'ESP A', 'PROF', '2026-08-05 08:00:00', 'GENERAL', 'EPS DEMO'],
    ['ASESOR UNO', 'SEDE 34 (AUDIFONOS)', 'EX', 'ESP A', 'PROF', '2026-08-06 08:00:00', '3P', 'EPS DEMO'],
    ['ASESOR UNO', 'SEDE NUEVA DEMO', 'EX', 'ESP B', 'PROF', '2026-08-07 08:00:00', '3P', 'EPS DEMO'],
  ] });
  assert.equal(vieja.status, 201, JSON.stringify(vieja.body));
  // Base cruda (oct): codigos con y sin cero, y uno fuera de la lista.
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin)).send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }, { codigo: 'EPS3', linea: '3P' }] });
  await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [{ usuario: 'U1', asesor: 'Asesor Uno' }] });
  const cruda = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas: [
    ['U1', '01', 'EX', 'ESP A', 'PROF', '2026-10-01 09:00:00', 'EPSG', 'ENT'],
    ['U1', '1', 'EX', 'ESP A', 'PROF', '2026-10-02 09:00:00', 'EPSG', 'ENT'],
    ['U1', '04', 'EX', 'ESP B', 'PROF', '2026-10-03 09:00:00', 'EPS3', 'ENT'],
    ['U1', '07', 'EX', 'ESP B', 'PROF', '2026-10-04 09:00:00', 'EPS3', 'ENT'],
    ['U1', '2', 'EX', 'ESP A', 'PROF', '2026-10-05 09:00:00', 'EPSG', 'ENT'],
  ] });
  assert.equal(cruda.status, 201, JSON.stringify(cruda.body));
  const q = (ruta, extra) => request(app).get('/api/calidad/agendas/' + ruta).query({ campana: 'ORLANT', ...extra }).set(auth(admin));
  const total = (body) => body.reduce((s, r) => s + r.cantidad, 0);

  assert.deepEqual((await q('opciones')).body.sedes, ['Sede 07', 'Sede 34 (Audífonos)', 'SEDE NUEVA DEMO', 'Sede Poblado', 'Sede Principal'].sort());
  // Una sola opcion junta agosto (nombre) y octubre (codigo "01" y "1").
  assert.deepEqual((await q('mensual', { sede: 'Sede Principal' })).body.map((r) => [r.mes, r.cantidad]), [['2026-08', 1], ['2026-10', 2]]);
  assert.deepEqual((await q('mensual', { sede: 'Sede 34 (Audífonos)' })).body.map((r) => [r.mes, r.cantidad]), [['2026-08', 1], ['2026-10', 1]]);
  assert.equal(total((await q('especialidad', { mes: '2026-10', sede: 'Sede 07' })).body), 1);
  assert.equal(total((await q('especialidad', { mes: '2026-10', sede: '01' })).body), 0); // el codigo ya no es un valor del filtro
  // Lo guardado no cambia (se cruza al consultar).
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM agendas WHERE campana = 'ORLANT' AND sede IN ('01','1')").get().n, 2);

  // Tipo de línea: General / 3P / Todos en las 3 vistas, con el mismo total.
  for (const [tl, esperado] of [[undefined, 5], ['GENERAL', 3], ['3P', 2]]) {
    const f = tl ? { tipoLinea: tl } : {};
    assert.equal(total((await q('especialidad', { mes: '2026-10', ...f })).body), esperado, 'especialidad ' + tl);
    assert.equal((await q('mensual', f)).body.find((r) => r.mes === '2026-10').cantidad, esperado, 'mensual ' + tl);
    assert.equal(total((await q('linea', f)).body.filter((r) => r.mes === '2026-10')), esperado, 'linea ' + tl);
  }
  assert.equal(total((await q('especialidad', { mes: '2026-08', tipoLinea: 'GENERAL' })).body), 1);
  assert.equal(total((await q('especialidad', { mes: '2026-10', tipoLinea: 'GENERAL', sede: 'Sede Poblado' })).body), 1);
});

test('Tipo de línea resaltado, respuesta vieja descartada y filtros en "Ver datos" y en Exportar', () => {
  const js = fs.readFileSync(path.join(PUB, 'js', 'agendas.js'), 'utf8');
  assert.match(js, /class="ig agendas-filtro-destacado gd-filtros-siempre"[^>]*><label for="agendas-f-tipolinea-/);
  assert.match(js, /<select id="agendas-f-tipolinea-'\+i\+'" onchange="_agendasAplicarFiltros\('\+i\+'\)">/);
  assert.match(js, /var n = _agendasDibujoN\[i\] = \(_agendasDibujoN\[i\] \|\| 0\) \+ 1;/);
  assert.match(js, /if\(_agendasDibujoN\[i\] !== n\) return;/);
  assert.match(js, /setAttribute\('data-titulo'/);
  const gen = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gen, /fila\.Filtros = txtFiltros/);
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  const regla = css.slice(css.indexOf('.agendas-filtro-destacado{'), css.indexOf('}', css.indexOf('.agendas-filtro-destacado{')));
  assert.match(regla, /var\(--c-brand-blue\)/);
  assert.ok(!/success|warning|danger/.test(regla), 'nunca colores del semaforo');
});

test('logo de InConexion: mas grande, arriba a la derecha, encima de los botones; blanco en los 2 temas', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const derecha = html.slice(html.indexOf('<div class="gd-header-derecha">'), html.indexOf('id="gd-cerrar-btn"'));
  const iLogo = derecha.indexOf('class="gd-marca-inconexion"');
  const iAcciones = derecha.indexOf('<div class="gd-header-acciones"');
  assert.ok(iLogo > -1 && iAcciones > iLogo, 'el logo va antes (encima) de la fila de botones');
  assert.match(derecha, /class="gd-marca-logo" src="img\/marca\/logo-horizontal-blanco\.png"[^>]*alt="InConexion" width="170" height="34"/);
  assert.ok(!/gd-marca-isotipo/.test(html), 'ya no hay isotipo en la barra');
  // Ya no esta junto a "Actualizar datos" (dentro de la fila de botones).
  const acciones = html.slice(html.indexOf('<div class="gd-header-acciones"'), html.indexOf('id="gd-cerrar-btn"'));
  assert.ok(!/gd-marca-inconexion/.test(acciones));
  assert.match(html, /<img id="gd-cliente-logo" class="gd-cliente-logo"/);
  for (const f of ['logo-horizontal-blanco.png', 'logo-horizontal-blanco@2x.png']) assert.ok(fs.existsSync(path.join(PUB, 'img', 'marca', f)), f);
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.gd-header-derecha\{display:flex;flex-direction:column;align-items:flex-end;/);
  assert.match(css, /\.gd-marca-logo\{width:170px;height:34px;\}/);
  const oscuro = css.slice(css.indexOf(':root[data-theme="dark"]{'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]{')));
  assert.ok(!/--c-brand:/.test(oscuro));
});
