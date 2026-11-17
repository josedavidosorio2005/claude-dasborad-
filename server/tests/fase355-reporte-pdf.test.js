// fase355-reporte-pdf.test.js — Fase 355: «Exportar PDF» del mes en Hospital La María.
// Datos SINTETICOS. Cubre: quién ve el botón, en qué tableros aplica, los meses, los
// indicadores (iguales a los del tablero), la serie de las gráficas, el HTML (logo, nombre,
// mes, «Tipificación: sin datos cargados», escape de texto) y que la página lo cablea.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../../public/js/reporte-pdf-logic.js');

const HLM = 'HOSPITAL LA MARIA';
const CAS = 'HOSPITAL LA MARIA - CASTILLA';
const S33 = 'HOSPITAL LA MARIA - SEDE 33';
const REG = [
  { nombre: HLM, parametros: { sedes: [{ campana: CAS, etiqueta: 'Sede Castilla' }, { campana: S33, etiqueta: 'Sede 33' }], datosAnteriores: { visible: true } } },
  { nombre: CAS, parametros: { sedeDe: HLM, sedeEtiqueta: 'Sede Castilla' } },
  { nombre: S33, parametros: { sedeDe: HLM, sedeEtiqueta: 'Sede 33' } },
  { nombre: 'ORLANT', parametros: {} },
  { nombre: 'MOBILIZE' },
];

test('roles: ADMIN (y admin maestro), REPORTES y cliente sí; supervisor, Calidad y asesor no', () => {
  assert.equal(R.reportePdfPuedeVer(null, true), true); // admin maestro
  assert.equal(R.reportePdfPuedeVer('ADMIN', true), true);
  assert.equal(R.reportePdfPuedeVer('REPORTES', false), true);
  assert.equal(R.reportePdfPuedeVer('CLIENTES_DASH', false), true);
  for (const rol of ['SUPERVISOR', 'CALIDAD', 'ASESOR', 'GERENCIA', null, undefined, '']) {
    assert.equal(R.reportePdfPuedeVer(rol, false), false, String(rol));
  }
});

test('aplica en el padre (Datos anteriores) y en cada sede; no en otros clientes', () => {
  assert.equal(R.reportePdfAplica(REG, HLM), true);
  assert.equal(R.reportePdfAplica(REG, CAS), true);
  assert.equal(R.reportePdfAplica(REG, S33), true);
  assert.equal(R.reportePdfAplica(REG, 'ORLANT'), false);
  assert.equal(R.reportePdfAplica(REG, 'MOBILIZE'), false);
  assert.equal(R.reportePdfAplica(REG, 'NO EXISTE'), false);
  assert.equal(R.reportePdfAplica(null, HLM), false);
});

const LL = [
  { fecha: '2026-08-01', skillName: 'LINEA ENTRADA', totalLlamadas: 100, contestadas: 70, llamadasAbandonadas: 30, serviceLevel20secPct: 40 },
  { fecha: '2026-08-01', skillName: 'PROGRAMAS ESPECIALES', totalLlamadas: 50, contestadas: 40, llamadasAbandonadas: 10, serviceLevel20secPct: 60 },
  { fecha: '2026-08-02', skillName: 'LINEA ENTRADA', totalLlamadas: 50, contestadas: 30, llamadasAbandonadas: 20, serviceLevel20secPct: 20 },
  { fecha: '2026-07-31', skillName: 'LINEA ENTRADA', totalLlamadas: 999, contestadas: 1, llamadasAbandonadas: 998 },
];
const WP = [
  { fechaInicio: '2026-08-01', fechaFin: '2026-08-01', skillName: 'WhatsApp', totalWhatsapp: 80, contestados: 60, abandonados: 20, serviceLevel20secPct: 10 },
  { fechaInicio: '2026-08-03', fechaFin: '2026-08-03', skillName: 'WhatsApp', totalWhatsapp: 20, contestados: 20, abandonados: 0, serviceLevel20secPct: 50 },
];

test('meses con datos, del más reciente al más viejo; sin datos, los últimos 6', () => {
  assert.deepEqual(R.reportePdfMeses(LL, WP), ['2026-08', '2026-07']);
  assert.deepEqual(R.reportePdfMeses([], []), []);
  assert.deepEqual(R.reportePdfMesesSinDatos(new Date(2026, 1, 10)), ['2026-02', '2026-01', '2025-12', '2025-11', '2025-10', '2025-09']);
  assert.equal(R.reportePdfMesLargo('2026-08'), 'Agosto 2026');
});

test('indicadores del mes: se suma y el % sale de la suma (solo filas de ese mes)', () => {
  const ind = R.reportePdfIndicadores(LL, WP, '2026-08');
  assert.equal(ind.llamadas.total, 200);
  assert.equal(ind.llamadas.contestadas, 140);
  assert.equal(ind.llamadas.abandonadas, 60);
  assert.equal(ind.llamadas.nivelAtencion, 70);
  assert.equal(ind.llamadas.tasaAbandono, 30);
  assert.equal(typeof ind.llamadas.nivelServicio, 'number');
  assert.equal(ind.whatsapp.total, 100);
  assert.equal(ind.whatsapp.contestadas, 80);
  assert.equal(ind.whatsapp.abandonadas, 20);
  assert.equal(ind.whatsapp.nivelAtencion, 80);
  assert.equal(ind.whatsapp.tasaAbandono, 20);
  assert.deepEqual(ind.total, { ingresados: 300, contestados: 220, nivelAtencion: 73.3 });
});

test('indicadores: una sede sin datos da todo vacío (nunca ceros inventados)', () => {
  const ind = R.reportePdfIndicadores([], [], '2026-08');
  assert.equal(ind.llamadas, null);
  assert.equal(ind.whatsapp, null);
  assert.equal(ind.total, null);
});

test('serie diaria de las gráficas: por día y en orden; WhatsApp de periodo queda como un solo punto', () => {
  assert.deepEqual(R.reportePdfSerieDiaria(LL, '2026-08', 'fecha', 'totalLlamadas', 'contestadas'), [
    { periodo: '2026-08-01', total: 150, contestadas: 110 },
    { periodo: '2026-08-02', total: 50, contestadas: 30 },
  ]);
  const periodo = [{ fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 14, contestados: 12 }];
  assert.deepEqual(R.reportePdfSerieDiaria(periodo, '2026-08', 'fechaInicio', 'totalWhatsapp', 'contestados'), [
    { periodo: '2026-08', total: 14, contestadas: 12 },
  ]);
});

test('HTML: logo, nombre de la campaña y sede, mes, indicadores, gráficas y tipificación', () => {
  const ind = R.reportePdfIndicadores(LL, WP, '2026-08');
  const html = R.reportePdfPrintHtml({
    campana: 'Hospital La María', etiqueta: 'Datos anteriores (agosto, sin separar por sede)', mes: '2026-08', ind,
    graficas: { llamadas: 'data:image/png;base64,AAA', whatsapp: 'data:image/png;base64,BBB', total: 'data:image/png;base64,CCC' },
    logoUrl: 'https://ejemplo.test/img/marca/logo-horizontal-color.png', generado: '17/11/2026',
  });
  assert.match(html, /<img src="https:\/\/ejemplo\.test\/img\/marca\/logo-horizontal-color\.png" alt="InConexion">/);
  assert.match(html, /<h1>Hospital La María · Datos anteriores \(agosto, sin separar por sede\)<\/h1>/);
  assert.match(html, /Informe de Agosto 2026/);
  assert.match(html, /Tráfico de Llamadas/);
  assert.match(html, /Tráfico de WhatsApp/);
  assert.match(html, /Total tráfico/);
  assert.match(html, /Tipificación: sin datos cargados\./);
  assert.ok(html.includes('data:image/png;base64,AAA') && html.includes('data:image/png;base64,BBB') && html.includes('data:image/png;base64,CCC'));
  assert.ok(html.includes(R.reportePdfNum(200)) && html.includes(R.reportePdfNum(300)));
  assert.doesNotMatch(html, /DATOS DE DEMOSTRACIÓN/);
});

test('HTML: una sede vacía dice «sin datos» en cada canal; el aviso de demo va primero', () => {
  const html = R.reportePdfPrintHtml({ campana: 'Hospital La María', etiqueta: 'Sede 33', mes: '2026-11', ind: R.reportePdfIndicadores([], [], '2026-11'), demo: true });
  assert.match(html, /Sin datos de llamadas cargados para este mes\./);
  assert.match(html, /Sin datos de WhatsApp cargados para este mes\./);
  assert.match(html, /Sin tráfico cargado para este mes\./);
  assert.ok(html.indexOf('DATOS DE DEMOSTRACIÓN') < html.indexOf('<header>'));
});

test('HTML: todo texto va escapado (nombre de campaña con etiquetas no se ejecuta)', () => {
  const html = R.reportePdfPrintHtml({ campana: '<script>alert(1)</script>', etiqueta: '"><img src=x onerror=alert(1)>', mes: '2026-08', ind: {}, logoUrl: 'x" onerror="alert(1)' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /x" onerror=/);
  assert.match(html, /&lt;script&gt;/);
});

test('la página cablea el botón, el diálogo, los scripts y la tecla Escape', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const index = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  assert.match(index, /id="gd-reporte-pdf-btn"[^>]*class|class="aurora-close hidden" id="gd-reporte-pdf-btn"/);
  assert.match(index, />Exportar PDF<\/span>/);
  // Icono propio (en el telefono solo se ve el icono: no puede ser el mismo de «Exportar»).
  assert.match(index, /onclick="reportePdfAbrir\(\)"><svg[^>]*><use href="img\/iconos\/lucide\.svg#i-file-text">/);
  assert.match(fs.readFileSync(path.join(pub, 'img', 'iconos', 'lucide.svg'), 'utf8'), /<symbol id="i-file-text" viewBox="0 0 24 24">/);
  assert.match(index, /id="modal-reporte-pdf"/);
  const iLogic = index.indexOf('js/reporte-pdf-logic.js');
  const iUi = index.indexOf('js/reporte-pdf.js');
  assert.ok(iLogic > 0 && iUi > iLogic, 'logic antes que la interfaz');
  assert.ok(index.indexOf('js/trafico-logic.js') < iLogic && index.indexOf('js/trafico-whatsapp-logic.js') < iLogic);
  const gd = fs.readFileSync(path.join(pub, 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gd, /reportePdfPintarBoton\(_gd\.cliente\)/);
  const mh = fs.readFileSync(path.join(pub, 'js', 'motion-helpers.js'), 'utf8');
  assert.match(mh, /'modal-reporte-pdf':/);
  assert.ok(fs.existsSync(path.join(pub, 'img', 'marca', 'logo-horizontal-color.png')));
});
