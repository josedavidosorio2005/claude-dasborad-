// fase153-plantillas-modulos.test.js — Fase 153 (P1): una plantilla por
// modulo (server/plantillas/PLANTILLA_<MODULO>.xlsx) y su ficha
// (docs/plantillas/<modulo>.md). Las plantillas piden EXACTO lo que lee el
// lector de cada modulo, el sistema las reconoce por sus columnas, el
// ejemplo inventado pasa por el lector real, y fichas y catalogo dicen lo
// mismo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const { CARGAS, columnasDeCarga } = require('../../scripts/plantillas/modulos');
const { CATALOGO } = require('../plantillas-cliente');
const CL = require('../../public/js/cargas-logic.js');

const RAIZ = path.join(__dirname, '..', '..');
const JS = (f) => require('../../public/js/' + f);
const leerXlsx = (archivo) => XLSX.read(fs.readFileSync(path.join(RAIZ, 'server', 'plantillas', archivo)));
const aoa = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

// Lector real de cada plantilla: recibe [encabezado, fila de ejemplo].
const AHORA = new Date('2026-10-16T12:00:00-05:00');
const LECTORES = {
  'PLANTILLA_FLUJO_LLAMADAS.xlsx': (a) => JS('trafico-logic.js').traficoParseFilas(a),
  // Fase 194: el modulo lleva los dos reportes de Wolkvox tal cual.
  'PLANTILLA_LLAMADAS_ABANDONADAS.xlsx': (a) => JS('llamadas-unicas-logic.js').llamadasAbandonadasParseFilas(a),
  'PLANTILLA_LLAMADAS_NO_CONECTADAS.xlsx': (a) => JS('llamadas-salida-logic.js').llamadasNoConectadasParseFilas(a),
  'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx': (a) => JS('tipificacion-logic.js').tipificacionParseFilas(a, null, 'LLAMADAS'),
  // Fase 168: como en Cargar Datos, el HistChat por SKILL_ID se lee con el mapa de skills (semilla de ORLANT).
  'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx': (a) => JS('tipificacion-logic.js').tipificacionParseFilas(a, null, 'WHATSAPP',
    { skillsWhatsapp: Object.fromEntries(require('../skills-whatsapp').SEMILLA_ORLANT) }),
  'PLANTILLA_ENCUESTA.xlsx': (a) => JS('encuesta-logic.js').encuestaParseFilas(a),
  'PLANTILLA_FLUJO_WHATSAPP.xlsx': (a) => JS('trafico-whatsapp-logic.js').traficoWppParseFilas(a),
  'PLANTILLA_WHATSAPP_TIEMPOS.xlsx': (a) => JS('whatsapp-tiempos-logic.js').wppTiemposParseFilas(a),
  'PLANTILLA_CALIDAD_RESUMEN.xlsx': (a) => JS('calidad-resumen-logic.js').calidadResumenParseFilas(a), // Fase 172
  'PLANTILLA_AGENDAS.xlsx': (a) => JS('agendas-logic.js').agendasParseFilas(a),
  'PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx': (a) => JS('efectividad-agendamiento-logic.js').efectividadAgendamientoParseFilas(a, AHORA),
  'PLANTILLA_INASISTENCIA.xlsx': (a) => JS('inasistencia-logic.js').inasistenciaParseFilas(a, AHORA),
  'PLANTILLA_EFECTIVIDAD_CITAS.xlsx': (a) => JS('citas-atendidas-logic.js').citasAtendidasParseFilas(a, AHORA),
  'PLANTILLA_SALIDA_MENSUAL.xlsx': (a) => JS('salida-logic.js').salidaParseFilas(a, AHORA),
};

test('hay un lector para cada plantilla y ningun nombre de archivo lleva cliente', () => {
  assert.deepEqual(Object.keys(LECTORES).sort(), CARGAS.map((c) => c.archivo).sort());
  CARGAS.forEach((c) => assert.doesNotMatch(c.archivo, /ORLANT|MOBILIZE|AURORA|MARIA/i, c.archivo));
});

for (const c of CARGAS) {
  test(`${c.archivo}: hoja de datos con las columnas exactas del lector, sin datos`, () => {
    const wb = leerXlsx(c.archivo);
    assert.deepEqual(wb.SheetNames, [c.hoja, 'INSTRUCCIONES']);
    const filas = aoa(wb.Sheets[c.hoja]);
    assert.equal(filas.length, 1, 'solo el encabezado, ninguna fila de datos');
    const cols = columnasDeCarga(c);
    assert.deepEqual(filas[0], cols.map((x) => x.encabezado));
    // Todas las obligatorias del lector estan.
    const lista = JS(c.fuente.js)[c.fuente.variable].filter((x) => x.obligatoria && !x.ocultaEnPlantilla);
    // Fase 168: una obligatoria puede venir reemplazada (WhatsApp: SKILL_ID en vez de SKILL_NAME).
    const reemplazo = c.obligatoriaReemplazada || {};
    lista.forEach((x) => assert.ok(cols.some((y) => y.label === (reemplazo[x.label] || x.label)), x.label));
    // Cada columna tiene descripcion y ejemplo.
    cols.forEach((x) => {
      assert.ok(x.descripcion, 'falta la descripcion de ' + x.label);
      assert.notEqual(x.ejemplo, undefined, 'falta el ejemplo de ' + x.label);
    });
  });

  test(`${c.archivo}: Cargar Datos la reconoce por sus columnas (no por el nombre de la hoja)`, () => {
    const header = columnasDeCarga(c).map((x) => x.encabezado);
    const columnas = JS(c.fuente.js)[c.fuente.variable].map((x) => ({ label: x.label, labelAlt: [].concat(x.aliases || [], x.labelAlt || []), opcional: !x.obligatoria }));
    if (c.fuente.variable === 'ENCUESTA_COLUMNAS') {
      assert.equal(JS('encuesta-logic.js').encuestaBuscarEncabezado([['texto suelto'], header], 20), 1);
    } else {
      // Fase 168: mismo criterio que cargas.js -- el HistChat por SKILL_ID entra al slot de WhatsApp.
      assert.ok(CL.cargasEncabezadosCoinciden(header, columnas) || (c.hoja === 'TIPIFICACION_WHATSAPP' && CL.cargasEsHistChatPorSkillId(header)));
    }
    if (c.fuente.variable === 'TIPIFICACION_COLUMNAS') {
      assert.equal(CL.cargasDetectarCanalTipificacion(header), c.hoja === 'TIPIFICACION_WHATSAPP' ? 'WHATSAPP' : 'LLAMADAS');
    }
  });

  test(`${c.archivo}: el ejemplo inventado de INSTRUCCIONES pasa por el lector real`, () => {
    const cols = columnasDeCarga(c);
    const r = LECTORES[c.archivo]([cols.map((x) => x.encabezado), cols.map((x) => x.ejemplo)]);
    assert.ok(!r.error, r.error);
    const filas = r.filas || r.agregados || r.registros || [];
    assert.ok(filas.length >= 1, JSON.stringify(r).slice(0, 300));
    const ins = aoa(leerXlsx(c.archivo).Sheets.INSTRUCCIONES);
    cols.forEach((x) => assert.ok(ins.some((f) => f[0] === x.encabezado), 'INSTRUCCIONES sin ' + x.encabezado));
  });
}

test('fichas: una por modulo del catalogo, con las columnas obligatorias de sus plantillas', () => {
  const dir = path.join(RAIZ, 'docs', 'plantillas');
  const indice = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  for (const m of CATALOGO) {
    const f = path.join(dir, m.id + '.md');
    assert.ok(fs.existsSync(f), 'falta la ficha ' + m.id);
    const txt = fs.readFileSync(f, 'utf8');
    assert.ok(txt.includes(m.nombre), m.id + ': la ficha debe usar el nombre del catalogo');
    assert.ok(indice.includes('(' + m.id + '.md)'), 'el indice no enlaza ' + m.id);
    for (const c of CARGAS.filter((x) => x.modulo === m.id)) {
      assert.ok(txt.includes(c.archivo), m.id + ': no nombra ' + c.archivo);
      columnasDeCarga(c).filter((x) => x.obligatoria).forEach((x) => assert.ok(txt.includes(x.encabezado), m.id + ': no nombra ' + x.encabezado));
    }
  }
  CARGAS.forEach((c) => assert.ok(CATALOGO.some((m) => m.id === c.modulo), c.modulo));
});

test('las plantillas viejas siguen (la pantalla actual las usa)', () => {
  for (const f of ['PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx', 'PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx', 'PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx']) {
    assert.ok(fs.existsSync(path.join(RAIZ, 'server', 'plantillas', f)), f);
  }
});
