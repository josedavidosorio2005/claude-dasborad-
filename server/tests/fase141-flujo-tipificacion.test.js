// fase141-flujo-tipificacion.test.js — Fase 141 (Parte A, reunion con Edwin
// del 13/10/2026):
//   1. La sub-pestana 'resumen' de Trafico de Llamadas se ve como "Flujo de
//      Llamadas" y la de WhatsApp como "Flujo de WhatsApp" -- solo el texto
//      visible; la key 'resumen' no cambia. Mobilize trae su propia lista de
//      sub-pestanas guardada en dashboards_config con label 'Resumen': el
//      render la rotula igual, sin migrar datos.
//   2. Tipificacion (ORLANT y MOBILIZE, mismo componente): torta a la
//      izquierda y tabla a la derecha (50/50), apiladas en movil; la tabla
//      sale del MISMO resultado que la torta (mismos filtros, mismo total).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const traficoJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'trafico.js'), 'utf8');
const tipificacionJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'tipificacion.js'), 'utf8');
const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Extrae del trafico.js real solo las constantes de sub-pestanas y la barra
// de navegacion (sin DOM) y las corre en un sandbox.
function cargarNavTrafico() {
  const ini = traficoJs.indexOf('var TRAFICO_LABEL_RESUMEN');
  const fin = traficoJs.indexOf('async function _traficoCargarDatos');
  assert.ok(ini !== -1 && fin > ini, 'no se encontro el bloque de sub-pestanas en trafico.js');
  const sandbox = { esc: escHtml };
  vm.createContext(sandbox);
  vm.runInContext(traficoJs.slice(ini, fin) +
    '\nthis.TRAFICO_SUBTABS = TRAFICO_SUBTABS; this.TRAFICO_WPP_SUBTABS = TRAFICO_WPP_SUBTABS; this.nav = _traficoSubtabsNavHTML;', sandbox);
  return sandbox;
}

function textosBotones(html) {
  return Array.from(html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)).map((m) => m[1]);
}

test('Llamadas: la sub-pestana "resumen" dice "Flujo de Llamadas" (key intacta) y ya no dice "Resumen"', () => {
  const s = cargarNavTrafico();
  const r = s.TRAFICO_SUBTABS.find((x) => x.key === 'resumen');
  assert.equal(r.label, 'Flujo de Llamadas');
  const html = s.nav('tv', 0, 'resumen', '_traficoSwitchSubtab', 'trafsub');
  assert.equal(textosBotones(html)[0], 'Flujo de Llamadas');
  assert.match(html, /data-trafsub="resumen"/);
  assert.ok(!textosBotones(html).includes('Resumen'));
});

test('WhatsApp: la sub-pestana "resumen" dice "Flujo de WhatsApp" y el resto de pastillas no cambia', () => {
  const s = cargarNavTrafico();
  assert.deepEqual(Array.from(s.TRAFICO_WPP_SUBTABS, (x) => x.label),
    ['Flujo de WhatsApp', 'Abandono', 'AHT', 'ASA y ATA', 'Nivel de Servicio']);
  assert.deepEqual(Array.from(s.TRAFICO_WPP_SUBTABS, (x) => x.key), ['resumen', 'abandono', 'aht', 'asaata', 'sl']);
  const html = s.nav('tww', 0, 'resumen', '_traficoWppSwitchSubtab', 'trafwppsub', s.TRAFICO_WPP_SUBTABS);
  assert.equal(textosBotones(html)[0], 'Flujo de WhatsApp');
});

test('Mobilize: aunque su config guardada traiga label "Resumen", la pastilla se ve "Flujo de Llamadas" (sin migrar datos)', () => {
  const s = cargarNavTrafico();
  const subtabsGuardadas = [
    { key: 'resumen', label: 'Resumen' }, { key: 'sl', label: 'Nivel de Servicio' },
    { key: 'abandono', label: 'Abandono' }, { key: 'asaata', label: 'ASA y ATA' },
    { key: 'aht', label: 'AHT' },
  ];
  const html = s.nav('tv', 3, 'resumen', '_traficoSwitchSubtab', 'trafsub', subtabsGuardadas);
  assert.deepEqual(textosBotones(html), ['Flujo de Llamadas', 'Nivel de Servicio', 'Abandono', 'ASA y ATA', 'AHT']);
  assert.equal(subtabsGuardadas[0].label, 'Resumen', 'la config recibida no se modifica');
});

// ── Tipificacion: torta y tabla con los mismos datos ──────────────────────

function cargarTipificacion(respuestaPorTipo) {
  const elementos = {};
  const llamadas = [];
  const graficas = [];
  const sandbox = {
    document: { getElementById: (id) => (elementos[id] = elementos[id] || { id, innerHTML: '', value: '' }) },
    apiRequest: async (metodo, url) => {
      llamadas.push(url);
      if (url.indexOf('/resumen-salida') !== -1) return { total: 64, conectadas: 40, noConectadas: 24 };
      return respuestaPorTipo(url);
    },
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    loPie: (titulo) => ({ titulo }),
    tipificacionEtiqueta: (t) => String(t).replace(/_/g, ' '),
    paletaColorPara: () => '#000',
    paletaColoresSinRepetir: (etiquetas) => etiquetas.map(() => '#000'), // Fase 164 (D-02)
    showToast: () => {},
    esc: escHtml,
    textoFormatoNombre: (v) => v,
    URLSearchParams,
  };
  vm.createContext(sandbox);
  vm.runInContext(tipificacionJs, sandbox);
  return { sandbox, elementos, llamadas, graficas };
}

function sumaTabla(html) {
  return Array.from(html.matchAll(/<tr><td>[^<]*<\/td><td>([\d.]+)<\/td>/g))
    .reduce((acc, m) => acc + parseInt(m[1].replace(/\./g, ''), 10), 0);
}

test('Tipificacion: con cualquier filtro, la torta y la tabla suman lo mismo (Mobilize sin filtros: 167 = 103 entrantes + 64 salientes)', async () => {
  const datosPorTipo = {
    '': [{ tipificacion: 'A_UNO', cantidad: 100 }, { tipificacion: 'B_DOS', cantidad: 50 }, { tipificacion: 'C_TRES', cantidad: 17 }],
    inbound: [{ tipificacion: 'A_UNO', cantidad: 70 }, { tipificacion: 'B_DOS', cantidad: 33 }],
    outbound_ma: [{ tipificacion: 'A_UNO', cantidad: 30 }, { tipificacion: 'B_DOS', cantidad: 17 }, { tipificacion: 'C_TRES', cantidad: 17 }],
  };
  const { sandbox, elementos, llamadas, graficas } = cargarTipificacion((url) => {
    const tipo = new URLSearchParams(url.split('?')[1]).get('tipoInteraccion') || '';
    const datos = datosPorTipo[tipo];
    return { datos, total: datos.reduce((a, r) => a + r.cantidad, 0) };
  });
  vm.runInContext("_tipificacionPanelConfig[0] = { mostrarTablaDetalle: true, mostrarTarjetasSalida: true, mostrarFiltroTipo: true }; _tipificacionEstadoCompartido[0] = { mes: '2026-09', desde: '', hasta: '' };", sandbox);

  const esperado = { '': 167, inbound: 103, outbound_ma: 64 };
  for (const tipo of Object.keys(esperado)) {
    elementos['tipif-f-tipo-0-LLAMADAS'] = { value: tipo, innerHTML: '' };
    graficas.length = 0;
    await sandbox._tipificacionDibujarCanal('MOBILIZE', 0, 'LLAMADAS', { meses: ['2026-09'] });
    const pie = graficas[0].cfg.data.datasets[0].data.reduce((a, b) => a + b, 0);
    const tabla = sumaTabla(elementos['tipif-tabla-0-LLAMADAS'].innerHTML);
    assert.equal(pie, esperado[tipo], 'torta con tipo="' + tipo + '"');
    assert.equal(tabla, esperado[tipo], 'tabla con tipo="' + tipo + '"');
    const ultimaPorTipo = llamadas.filter((u) => u.indexOf('/por-tipo') !== -1).pop();
    assert.equal(new URLSearchParams(ultimaPorTipo.split('?')[1]).get('mes'), '2026-09');
  }
  assert.equal(graficas.length, 1, 'una sola grafica por redibujado');
});

test('Tipificacion: con tabla, torta y tabla van dentro de .tipif-pie-tabla (torta primero = izquierda / arriba en movil)', () => {
  const ini = tipificacionJs.indexOf("if(p.mostrarTablaDetalle) html += '<div class=\"tipif-pie-tabla\">'");
  assert.ok(ini !== -1, 'el contenedor .tipif-pie-tabla debe abrirse antes de la torta');
  const iTorta = tipificacionJs.indexOf('class="tipif-pie"', ini);
  const iTabla = tipificacionJs.indexOf('class="tipif-tabla"', ini);
  assert.ok(iTorta > ini && iTabla > iTorta, 'la torta va antes que la tabla');
});

test('CSS: .tipif-pie-tabla es 50/50 en escritorio, se apila en movil y no agrega animaciones', () => {
  const ini = css.indexOf('Fase 141 — Tipificacion');
  assert.ok(ini !== -1, 'falta el bloque de la Fase 141 en styles.css');
  const bloque = css.slice(ini);
  assert.match(bloque, /\.tipif-pie-tabla\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\);/);
  assert.match(bloque, /@media\(max-width:700px\)\{\s*\.tipif-pie-tabla\{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(bloque, /\.tipif-pie-tabla \.tipif-tabla \.table-wrap\{margin:0;max-height:340px;overflow:auto;\}/);
  assert.match(bloque, /\.tipif-pie-tabla \.tipif-tabla thead th\{position:sticky;top:0;/);
  assert.ok(!/animation|transition/.test(bloque), 'sin animaciones nuevas');
});
