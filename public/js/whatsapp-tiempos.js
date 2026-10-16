// whatsapp-tiempos.js — InConexion Platform (Fase 142, punto 4, reunion con
// Edwin del 13/10/2026). ORLANT → Tráfico de WhatsApp → sub-pestaña "Nivel de
// Servicio": en vez de la linea mensual de %, muestra el % de conversaciones
// contestadas en cada RANGO de minutos (0-3, 3-5, 5-8, 8-10, 10+) de UN mes,
// con filtro de Mes y de Cola. Todo viene agregado del servidor
// (GET /calidad/whatsapp-tiempos/rangos) -- nunca filas crudas.
//
// Solo para las campañas de WPP_TIEMPOS_CAMPANAS (hoy ORLANT); cualquier otra
// sigue viendo la grafica de siempre. Los % mensuales de Nivel de Servicio ya
// guardados (trafico_whatsapp) no se tocan, solo dejan de graficarse aqui.
//
// Mes (coherente con los demas paneles autonomos, Fase 86): cuando cambia el
// selector MES de arriba, esta vista toma ese mes si tiene detalle; si no, el
// ultimo mes con detalle que no sea futuro (wppTiemposMesPorDefecto) y lo
// dice en una nota. El filtro de Mes propio solo cambia esta vista.
'use strict';

var WPP_TIEMPOS_CAMPANAS = ['ORLANT'];
var WPP_TIEMPOS_AVISO = 'Porcentaje de conversaciones de WhatsApp según el tiempo que tardaron en ser contestadas.';
var _wppTiemposOpciones = {};        // cache por campana: { meses, skills }
var _wppTiemposEstado = {};          // por campana: { mes, skill, nota }
var _wppTiemposMesSincronizado = {}; // por campana: ultimo _gd.mesSel aplicado
var _wppTiemposUltimo = {};          // por campana: ultima respuesta /rangos (para exportar)

function wppTiemposUsa(campana) {
  return WPP_TIEMPOS_CAMPANAS.indexOf(campana) !== -1;
}

// true si en el panel i esta activa la sub-pestaña 'sl' de una campaña con
// esta vista (lo usan trafico-whatsapp.js y los botones Excel/PDF).
function _wppTiemposActivo(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : null;
  return !!campana && wppTiemposUsa(campana) && (typeof _traficoWppSubtabActivo !== 'undefined') && _traficoWppSubtabActivo[campana] === 'sl';
}

// Esconde (o vuelve a mostrar) los filtros propios del panel de WhatsApp
// (Cola/Desde/Hasta/Granularidad/separado/Aplicar) -- no aplican a esta
// vista, que tiene su Mes/Cola. Excel/PDF (el ultimo span) siguen visibles.
function _wppTiemposFiltrosPanel(i, ocultar) {
  var barra = document.querySelector('#gd-p' + i + ' .trafico-filtros');
  if (!barra) return;
  var hijos = barra.children;
  for (var k = 0; k < hijos.length - 1; k++) hijos[k].style.display = ocultar ? 'none' : '';
}

async function _wppTiemposCargarOpciones(campana) {
  if (_wppTiemposOpciones[campana]) return _wppTiemposOpciones[campana];
  var op = { meses: [], skills: [] };
  try { op = (await apiRequest('GET', '/calidad/whatsapp-tiempos/opciones?campana=' + encodeURIComponent(campana))) || op; }
  catch (e) { /* sin datos o sin acceso -- estado vacio */ }
  _wppTiemposOpciones[campana] = op;
  return op;
}

function _wppTiemposMesLbl(m) {
  return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m) : m;
}

async function _wppTiemposRender(i, campana) {
  var content = document.getElementById('tww-content-' + i);
  if (!content) return;
  _wppTiemposFiltrosPanel(i, true);
  var titulo = '<div class="aurora-card-title" style="font-size:0.85rem">Nivel de Servicio por tiempo de respuesta</div>' +
    '<p class="lu-aviso" style="color:var(--c-text-muted);font-size:var(--fs-small);margin:-4px 0 10px">' + WPP_TIEMPOS_AVISO + '</p>';
  var op = await _wppTiemposCargarOpciones(campana);
  if (!op.meses || !op.meses.length) {
    _wppTiemposUltimo[campana] = null;
    content.innerHTML = titulo + '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin tiempos de respuesta de WhatsApp cargados todavía' +
      (typeof canLoadData === 'function' && canLoadData() ? '. Un usuario con permiso de administrador debe subir el archivo desde "Cargar Datos".' : '.') + '</div>';
    return;
  }
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  var mesActual = (typeof fechaLimitesFinDeMesActual === 'function') ? fechaLimitesFinDeMesActual().slice(0, 7) : null;
  var estado = _wppTiemposEstado[campana] || { mes: '', skill: '', nota: '' };
  if (!estado.mes || _wppTiemposMesSincronizado[campana] !== mesGlobal) {
    _wppTiemposMesSincronizado[campana] = mesGlobal;
    var preferido = mesGlobal || mesActual;
    estado.mes = wppTiemposMesPorDefecto(op.meses, preferido, mesActual);
    estado.nota = (preferido && estado.mes !== preferido)
      ? 'No hay tiempos de respuesta cargados para ' + _wppTiemposMesLbl(preferido) + '; se muestra ' + _wppTiemposMesLbl(estado.mes) + '.'
      : '';
  }
  if (op.meses.indexOf(estado.mes) === -1) estado.mes = op.meses[op.meses.length - 1];
  if (estado.skill && (op.skills || []).indexOf(estado.skill) === -1) estado.skill = '';
  _wppTiemposEstado[campana] = estado;

  content.innerHTML = titulo +
    '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px">' +
      '<div class="ig" style="min-width:160px;margin-bottom:0"><label for="wtt-f-mes-' + i + '">Mes</label><select id="wtt-f-mes-' + i + '">' +
        op.meses.slice().reverse().map(function (m) { return '<option value="' + esc(m) + '"' + (m === estado.mes ? ' selected' : '') + '>' + esc(_wppTiemposMesLbl(m)) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="ig" style="min-width:200px;margin-bottom:0"><label for="wtt-f-skill-' + i + '">Cola</label><select id="wtt-f-skill-' + i + '"><option value="">Todas</option>' +
        (op.skills || []).map(function (s) { return '<option value="' + esc(s) + '"' + (s === estado.skill ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="ig" style="margin-bottom:0"><button class="btn-sm" onclick="_wppTiemposAplicar(' + i + ')">Aplicar filtros</button></div>' +
    '</div>' +
    (estado.nota ? '<p style="color:var(--c-text-muted);font-size:var(--fs-small);margin:0 0 8px">' + esc(estado.nota) + '</p>' : '') +
    '<div class="aurora-kpis" id="wtt-kpis-' + i + '"></div>' +
    '<div class="aurora-chart-wrap" style="height:280px"><canvas id="wtt-canvas-' + i + '"></canvas></div>' +
    '<div id="wtt-tabla-' + i + '" style="margin-top:10px"></div>';
  await _wppTiemposDibujar(i, campana);
}

function _wppTiemposAplicar(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : null;
  if (!campana) return;
  var mes = document.getElementById('wtt-f-mes-' + i);
  var skill = document.getElementById('wtt-f-skill-' + i);
  var estado = _wppTiemposEstado[campana] || {};
  estado.mes = mes ? mes.value : estado.mes;
  estado.skill = skill ? skill.value : '';
  estado.nota = '';
  _wppTiemposEstado[campana] = estado;
  var notaEl = document.querySelector('#tww-content-' + i + ' p[style*="margin:0 0 8px"]');
  if (notaEl) notaEl.remove();
  _wppTiemposDibujar(i, campana);
}

function _wppTiemposFmtPct(v) {
  return String(v).replace('.', ',') + ' %';
}

async function _wppTiemposDibujar(i, campana) {
  var estado = _wppTiemposEstado[campana];
  var q = 'campana=' + encodeURIComponent(campana) + '&mes=' + encodeURIComponent(estado.mes) +
    (estado.skill ? '&skill=' + encodeURIComponent(estado.skill) : '');
  var r = null;
  try { r = await apiRequest('GET', '/calidad/whatsapp-tiempos/rangos?' + q); } catch (e) { r = null; }
  _wppTiemposUltimo[campana] = r ? Object.assign({ skill: estado.skill }, r) : null;
  var kpis = document.getElementById('wtt-kpis-' + i);
  var tabla = document.getElementById('wtt-tabla-' + i);
  if (!r || !r.total) {
    if (kpis) kpis.innerHTML = '';
    if (tabla) tabla.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:16px 8px">Sin conversaciones de WhatsApp para ' + esc(_wppTiemposMesLbl(estado.mes)) + (estado.skill ? ' en esa cola' : '') + '.</div>';
    if (typeof _gdChart === 'function') _gdChart('wtt-canvas-' + i, { type: 'bar', data: { labels: [], datasets: [] }, options: {} });
    return;
  }
  var r03 = r.rangos[0];
  if (kpis) kpis.innerHTML =
    '<div class="aurora-kpi"><div class="kv">' + _wppTiemposFmtPct(r03.pct) + '</div><div class="kl">% contestado en 0–3 minutos</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + r.total.toLocaleString('es-CO') + '</div><div class="kl">Conversaciones contestadas del mes</div></div>';
  var CDl = (typeof CD !== 'undefined') ? CD : '#0d4a5e';
  var CGl = (typeof colorSerie==='function' ? colorSerie('secundaria') : '#0d4a5e'); // Fase 152 (B1): resalta 0–3 min sin usar el verde del semaforo
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.indexAxis = 'y';
  o.scales = o.scales || {};
  o.scales.x = Object.assign({}, o.scales.x || {}, { beginAtZero: true, max: 100, ticks: Object.assign({}, (o.scales.x || {}).ticks || {}, { callback: function (v) { return v + '%'; } }) });
  o.plugins = o.plugins || {};
  o.plugins.legend = { display: false };
  // Fase 152 (B9): fraccion "12 de 340" (antes solo la cantidad).
  o.plugins.tooltip = { callbacks: { label: function (ctx) { var x = r.rangos[ctx.dataIndex]; var fr = (typeof fraccionTexto === 'function') ? fraccionTexto(x.cantidad, r.total) : null; return _wppTiemposFmtPct(x.pct) + ' (' + (fr || x.cantidad.toLocaleString('es-CO')) + ')'; } } };
  if (o.plugins.datalabels) {
    o.plugins.datalabels.display = true;
    o.plugins.datalabels.anchor = 'end';
    o.plugins.datalabels.align = 'end';
    o.plugins.datalabels.formatter = function (v, ctx) { var x = r.rangos[ctx.dataIndex]; return _wppTiemposFmtPct(x.pct) + ' (' + x.cantidad.toLocaleString('es-CO') + ')'; };
  }
  if (typeof _gdChart === 'function') {
    _gdChart('wtt-canvas-' + i, {
      type: 'bar',
      data: {
        labels: r.rangos.map(function (x) { return x.label; }),
        datasets: [{ label: '% de conversaciones', data: r.rangos.map(function (x) { return x.pct; }), backgroundColor: r.rangos.map(function (x, k) { return k === 0 ? CGl : CDl; }),
          // Fase 152 (B1): borde de contraste solo en la barra azul de marca (claro).
          borderColor: r.rangos.map(function (x, k) { var e = (typeof estiloBarraSecundaria==='function' ? estiloBarraSecundaria() : {}); return k === 0 && e.borderColor ? e.borderColor : 'rgba(0,0,0,0)'; }),
          borderWidth: r.rangos.map(function (x, k) { var e = (typeof estiloBarraSecundaria==='function' ? estiloBarraSecundaria() : {}); return k === 0 && e.borderWidth ? e.borderWidth : 0; }), borderRadius: 3 }],
      },
      options: o,
    });
  }
  if (tabla) tabla.innerHTML = '<div class="table-wrap"><table class="aurora-table"><thead><tr><th style="text-align:left">Tiempo de respuesta</th><th>Conversaciones</th><th>%</th></tr></thead><tbody>' +
    r.rangos.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td>' + x.cantidad.toLocaleString('es-CO') + '</td><td>' + _wppTiemposFmtPct(x.pct) + '</td></tr>'; }).join('') +
    '<tr><td><strong>Total del mes</strong></td><td><strong>' + r.total.toLocaleString('es-CO') + '</strong></td><td>100 %</td></tr>' +
    '</tbody></table></div>';
}

// ── Exportar (mismo estilo que _traficoWppExportExcel/_traficoWppExportPrint) ──
function _wppTiemposDatosExport(campana) {
  var r = _wppTiemposUltimo[campana];
  if (!r || !r.total) return [];
  var mes = _wppTiemposMesLbl(r.mes);
  var cola = r.skill || 'Todas';
  return r.rangos.map(function (x) { return { Mes: mes, Cola: cola, 'Tiempo de respuesta': x.label, Conversaciones: x.cantidad, '%': x.pct }; })
    .concat([{ Mes: mes, Cola: cola, 'Tiempo de respuesta': 'Total del mes', Conversaciones: r.total, '%': 100 }]);
}

function _wppTiemposExportExcel(i) {
  if (typeof XLSX === 'undefined') { showToast('No se pudo cargar el generador de Excel.'); return; }
  // Fase 150 (igual que la Encuesta, Fase 149): sin la proteccion
  // anti-formula NO se exporta (antes caia en silencio a las filas crudas).
  if (typeof xlsxFilasSeguras !== 'function') { showToast('No se pudo preparar el Excel de forma segura. Recarga la página e inténtalo de nuevo.', 'error'); return; }
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : '';
  var datos = _wppTiemposDatosExport(campana);
  if (!datos.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var wb = XLSX.utils.book_new();
  if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wb);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(datos)), 'NivelServicioTiempos');
  XLSX.writeFile(wb, 'WhatsApp_Nivel_Servicio_Tiempos_' + String(campana).replace(/\s+/g, '_') + '_' + (_wppTiemposUltimo[campana] || {}).mes + '.xlsx');
}

function _wppTiemposExportPrint(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : '';
  var datos = _wppTiemposDatosExport(campana);
  if (!datos.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var w = window.open('', '_blank');
  if (!w) { showToast('Permite las ventanas emergentes para exportar a PDF.'); return; }
  var cols = Object.keys(datos[0]);
  var tabla = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    datos.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(c === '%' ? _wppTiemposFmtPct(r[c]) : r[c]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  var avisoHtml = (typeof seedDemoActivo !== 'undefined' && seedDemoActivo)
    ? '<div style="background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:16px">' +
      '⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
    : '';
  w.document.write('<!doctype html><html><head><title>Nivel de Servicio de WhatsApp por tiempo — ' + esc(campana) + '</title>' +
    '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}' +
    'table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}' +
    'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>' + avisoHtml +
    '<h1>Nivel de Servicio de WhatsApp por tiempo de respuesta — ' + esc(campana) + '</h1>' +
    '<p style="font-size:12px">' + esc(WPP_TIEMPOS_AVISO) + '</p>' + tabla +
    '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — ' + new Date().toLocaleString('es-CO') + '</p>' +
    '</body></html>');
  w.document.close();
  setTimeout(function () { w.focus(); w.print(); }, 300);
}
