// trafico-whatsapp.js — InConexion Platform. Fase 50.
//
// Panel "Trafico de WhatsApp" del dashboard de ORLANT (tipo de panel
// 'trafico_whatsapp_combo', dashboard-config-seed.js) + pantalla de carga en
// el admin. Mismo patron de integracion que trafico.js (voz) -- un panel
// autonomo dentro de dashboard-generic.js, con sus propios datos/estado --
// pero el DISENO de las graficas es distinto a proposito: los datos de esta
// plantilla son una fila por COLA y PERIODO (no por dia), asi que aqui no
// tiene sentido una linea de tendencia diaria como en voz. En su lugar:
// tarjetas de KPI del periodo + graficas de BARRAS comparando las colas
// entre si (Total/Contestados/Abandonados, Niveles de Servicio, ASA/ATA),
// con un selector de periodo simple para cuando haya mas de uno cargado.

// Descarga autenticada de la plantilla (GET requiere el header Authorization
// via JWT, asi que un <a href> plano no sirve -- mismo patron de blob+URL
// temporal que cualquier descarga autenticada de este tipo en un SPA).
async function descargarPlantillaTraficoWpp(){
  var res;
  try{
    res = await fetch(API_BASE + '/calidad/trafico/whatsapp/plantilla', { headers: apiHeaders(false) });
  }catch(e){ showToast('No se pudo conectar con el servidor.'); return; }
  if(!res.ok){
    var data = null; try{ data = await res.json(); }catch(e){}
    showToast((data && data.error) || 'No se pudo descargar la plantilla.');
    return;
  }
  var blob = await res.blob();
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

var _traficoWpp = {}; // cache por campana: { filas: [...] } (GET /calidad/trafico/whatsapp)
var _traficoWppPeriodoSel = {}; // por campana -> "fechaInicio_fechaFin" seleccionado
var _traficoWppSubtabActivo = {}; // por campana -> key de subtab activa

var TRAFICO_WPP_SUBTABS = [
  { key: 'volumen', label: 'Volumen' },
  { key: 'sl', label: 'Niveles de Servicio' },
  { key: 'asaata', label: 'ASA y ATA' },
];

async function _traficoWppCargarDatos(campana) {
  if (_traficoWpp[campana]) return _traficoWpp[campana];
  var filas = [];
  try { filas = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=' + encodeURIComponent(campana)) || []; }
  catch (e) { filas = []; }
  _traficoWpp[campana] = { filas: filas };
  return _traficoWpp[campana];
}

// Periodos presentes en los datos, mas reciente primero (orden por
// fechaInicio, que ademas es el orden natural de subida de meses).
function _traficoWppPeriodos(filas) {
  var set = {};
  filas.forEach(function (f) { set[f.fechaInicio + '_' + f.fechaFin] = true; });
  return Object.keys(set).sort().reverse();
}

function _traficoWppFmtFecha(iso) {
  if (!iso) return '';
  var p = iso.split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
}

// ASA/ATA de WhatsApp pueden ser bastante mayores que en voz (un chat puede
// quedar horas sin responder antes de que se marque abandonado, a
// diferencia de una llamada) -- se formatea con horas cuando aplica, no solo
// mm:ss, para que "82800" se lea "23:00:00" y no un numero de minutos gigante.
function _traficoWppFmtTiempo(v) {
  if (v === null || v === undefined) return '—';
  var total = Math.round(v);
  var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
}

async function _traficoWppRenderPanel(p, i) {
  var campana = p.campana;
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de WhatsApp</div>' +
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var datosCampana = await _traficoWppCargarDatos(campana);
  if (!datosCampana.filas.length) {
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de WhatsApp</div>' +
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin datos cargados todavia. Un usuario con permiso de administrador debe subir el archivo de Trafico de WhatsApp desde "Cargar Datos".</div></div>';
    return;
  }

  var periodos = _traficoWppPeriodos(datosCampana.filas);
  var periodoSel = _traficoWppPeriodoSel[campana];
  if (!periodoSel || periodos.indexOf(periodoSel) === -1) periodoSel = periodos[0];
  _traficoWppPeriodoSel[campana] = periodoSel;

  var subActivo = _traficoWppSubtabActivo[campana] || 'volumen';
  host.innerHTML =
    '<div class="aurora-card">' +
      '<div class="aurora-card-title">Trafico de WhatsApp</div>' +
      '<div class="trafico-filtros" style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:12px">' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Periodo</label>' +
          '<select id="tww-f-periodo-' + i + '" onchange="_traficoWppCambiarPeriodo(' + i + ',this.value)">' +
            periodos.map(function (per) {
              var partes = per.split('_');
              return '<option value="' + esc(per) + '"' + (per === periodoSel ? ' selected' : '') + '>' +
                esc(_traficoWppFmtFecha(partes[0])) + ' a ' + esc(_traficoWppFmtFecha(partes[1])) + '</option>';
            }).join('') +
          '</select></div>' +
      '</div>' +
      '<div class="aurora-kpis" id="tww-kpis-' + i + '"></div>' +
      '<div class="gd-subtabs" id="tww-subtabs-' + i + '">' +
        TRAFICO_WPP_SUBTABS.map(function (s) {
          return '<button class="gd-subtab-btn' + (subActivo === s.key ? ' on' : '') + '" data-trafwppsub="' + s.key + '" onclick="_traficoWppSwitchSubtab(' + i + ',\'' + s.key + '\')">' + s.label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="aurora-chart-wrap" style="height:320px"><canvas id="tww-canvas-' + i + '"></canvas></div>' +
    '</div>';
  host.dataset.campana = campana;

  _traficoWppRenderContenido(i);
}

function _traficoWppCambiarPeriodo(i, periodo) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  _traficoWppPeriodoSel[host.dataset.campana] = periodo;
  _traficoWppRenderContenido(i);
}

function _traficoWppSwitchSubtab(i, key) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  _traficoWppSubtabActivo[host.dataset.campana] = key;
  var nav = document.getElementById('tww-subtabs-' + i);
  if (nav) Array.prototype.forEach.call(nav.querySelectorAll('.gd-subtab-btn'), function (btn) {
    btn.classList.toggle('on', btn.dataset.trafwppsub === key);
  });
  _traficoWppRenderContenido(i);
}

function _traficoWppRenderContenido(i) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  var campana = host.dataset.campana;
  var periodoSel = _traficoWppPeriodoSel[campana];
  var todasLasFilas = (_traficoWpp[campana] || { filas: [] }).filas;
  var filas = todasLasFilas.filter(function (f) { return (f.fechaInicio + '_' + f.fechaFin) === periodoSel; });
  filas.sort(function (a, b) { return a.colaWhatsapp.localeCompare(b.colaWhatsapp); });

  var resumen = (typeof traficoWppResumen === 'function') ? traficoWppResumen(filas) : null;
  var kpisEl = document.getElementById('tww-kpis-' + i);
  if (kpisEl && resumen) {
    var semNivel = (typeof _gdSemaforoColor === 'function') ? _gdSemaforoColor(resumen.nivelAtencionPct, { metrica: 'nivel_atencion', campana: campana }) : null;
    var semAband = (typeof _gdSemaforoColor === 'function') ? _gdSemaforoColor(resumen.tasaAbandonoPct, { metrica: 'tasa_abandono', campana: campana }) : null;
    var clsNivel = semNivel ? _gdSemaforoClase(semNivel) : (resumen.nivelAtencionPct === null ? '' : resumen.nivelAtencionPct >= 90 ? 'kpi-green' : resumen.nivelAtencionPct >= 70 ? 'kpi-org' : 'kpi-red');
    var clsAband = semAband ? _gdSemaforoClase(semAband) : 'kpi-red';
    kpisEl.innerHTML =
      '<div class="aurora-kpi"><div class="kv">' + resumen.totalWhatsapp.toLocaleString('es-CO') + '</div><div class="kl">Total WhatsApp</div></div>' +
      '<div class="aurora-kpi kpi-green"><div class="kv">' + resumen.contestados.toLocaleString('es-CO') + '</div><div class="kl">Contestados</div></div>' +
      '<div class="aurora-kpi ' + clsAband + '"><div class="kv">' + (resumen.abandonados === null ? '—' : resumen.abandonados.toLocaleString('es-CO')) + '</div><div class="kl">Abandonados</div></div>' +
      '<div class="aurora-kpi ' + clsNivel + '"><div class="kv">' + (resumen.nivelAtencionPct === null ? '—' : resumen.nivelAtencionPct + '%') + '</div><div class="kl">Nivel de Atencion</div></div>' +
      '<div class="aurora-kpi ' + clsAband + '"><div class="kv">' + (resumen.tasaAbandonoPct === null ? '—' : resumen.tasaAbandonoPct + '%') + '</div><div class="kl">Tasa de Abandono</div></div>';
  }

  var canvasId = 'tww-canvas-' + i;
  var sub = _traficoWppSubtabActivo[campana] || 'volumen';
  var CDl = (typeof CD !== 'undefined') ? CD : '#0d4a5e';
  var CGl = (typeof CG !== 'undefined') ? CG : '#27ae60';
  var CRl = (typeof CR !== 'undefined') ? CR : '#e74c3c';
  var COl = (typeof CO !== 'undefined') ? CO : '#e67e22';
  var CMl = (typeof CM !== 'undefined') ? CM : '#1a7a9e';
  var CPl = (typeof CP !== 'undefined') ? CP : '#8e44ad';
  var colas = filas.map(function (f) { return f.colaWhatsapp; });

  var cfg;
  if (sub === 'sl') {
    var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
    o.scales = { y: { min: 0, max: 100, ticks: { font: { size: 8 }, callback: function (v) { return gdFmtValor(v, '%'); } } }, x: { ticks: { font: { size: 8 } } } };
    if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o, function (v) { return v === null || v === undefined ? '' : gdFmtValor(v, '%'); });
    o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + gdFmtValor(ctx.parsed.y, '%'); } } };
    cfg = {
      type: 'bar',
      data: { labels: colas, datasets: [
        { label: 'SL 10s', data: filas.map(function (f) { return f.serviceLevel10secPct; }), backgroundColor: CDl, borderRadius: 3 },
        { label: 'SL 20s', data: filas.map(function (f) { return f.serviceLevel20secPct; }), backgroundColor: CMl, borderRadius: 3 },
        { label: 'SL 30s', data: filas.map(function (f) { return f.serviceLevel30secPct; }), backgroundColor: COl, borderRadius: 3 },
      ] },
      options: o,
    };
  } else if (sub === 'asaata') {
    var o2 = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
    o2.scales = { y: { ticks: { font: { size: 8 }, callback: _traficoWppFmtTiempo } }, x: { ticks: { font: { size: 8 } } } };
    if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o2, function (v) { return v === null || v === undefined ? '' : _traficoWppFmtTiempo(v); });
    o2.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + _traficoWppFmtTiempo(ctx.parsed.y); } } };
    cfg = {
      type: 'bar',
      data: { labels: colas, datasets: [
        { label: 'ASA', data: filas.map(function (f) { return f.asaSegundos; }), backgroundColor: CPl, borderRadius: 3 },
        { label: 'ATA', data: filas.map(function (f) { return f.ataSegundos; }), backgroundColor: COl, borderRadius: 3 },
      ] },
      options: o2,
    };
  } else { // 'volumen'
    var o3 = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
    o3.scales = { y: { ticks: { font: { size: 8 } } }, x: { ticks: { font: { size: 8 } } } };
    if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o3, function (v) { return v === null || v === undefined ? '' : gdFmtValor(v); });
    o3.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y === null ? '—' : ctx.parsed.y.toLocaleString('es-CO')); } } };
    cfg = {
      type: 'bar',
      data: { labels: colas, datasets: [
        { label: 'Total', data: filas.map(function (f) { return f.totalWhatsapp; }), backgroundColor: CDl, borderRadius: 3 },
        { label: 'Contestados', data: filas.map(function (f) { return f.contestados; }), backgroundColor: CGl, borderRadius: 3 },
        { label: 'Abandonados', data: filas.map(function (f) { return f.abandonados; }), backgroundColor: CRl, borderRadius: 3 },
      ] },
      options: o3,
    };
  }
  if (typeof _gdChart === 'function') _gdChart(canvasId, cfg);
}

// ═══════════════════════════════════════════════════════════
// ADMIN — CARGA (parseo en el navegador, POST /calidad/trafico/whatsapp/carga)
// ═══════════════════════════════════════════════════════════
var _twwParsed = null; // { campana, archivoNombre, filas } listo para guardar

async function procesarArchivoTraficoWpp(input) {
  var file = input.files && input.files[0];
  if (!file) return;

  var buf;
  try { buf = await file.arrayBuffer(); }
  catch (e) { showToast('No se pudo leer el archivo'); input.value = ''; return; }
  var wb, aoa;
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    var sheetName = wb.SheetNames.indexOf('DATA') !== -1 ? 'DATA' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  } catch (e) { showToast('El archivo no es un Excel valido'); input.value = ''; return; }

  var res = traficoWppParseFilas(aoa);
  if (res.error) { showToast(res.error); input.value = ''; return; }

  var campana = document.getElementById('tww-campana-sel').value;
  _twwParsed = { campana: campana, archivoNombre: file.name, filas: res.filas };
  _renderPreviewTraficoWpp(file.name, res);
}

function _renderPreviewTraficoWpp(nombre, res) {
  document.getElementById('tww-errores').innerHTML = (res.avisos || []).map(function (a) { return '&#9888; ' + esc(a); }).join('<br>');
  document.getElementById('tww-preview-resumen').textContent =
    nombre + ' — ' + res.filas.length + ' fila(s) validas, ' + res.colas.length + ' cola(s), ' +
    res.periodos.length + ' periodo(s)';
  var html = res.filas.slice(0, 60).map(function (f) {
    return '<tr><td>' + esc(f.colaWhatsapp) + '</td><td>' + esc(f.fechaInicio) + '</td><td>' + esc(f.fechaFin) + '</td><td>' + f.totalWhatsapp + '</td><td>' + f.contestados + '</td></tr>';
  }).join('');
  if (res.filas.length > 60) html += '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted)">… y ' + (res.filas.length - 60) + ' filas mas</td></tr>';
  document.getElementById('tww-preview-tbody').innerHTML = html;
  document.getElementById('tww-preview-card').style.display = '';
}

function cancelarPreviewTraficoWpp() {
  _twwParsed = null;
  document.getElementById('tww-preview-card').style.display = 'none';
  document.getElementById('tww-file').value = '';
  document.getElementById('tww-errores').innerHTML = '';
}

async function guardarTraficoWpp() {
  if (!_twwParsed) { showToast('Primero sube un archivo'); return; }
  var btn = document.getElementById('tww-save-btn');
  var resp;
  try {
    resp = await withButtonLoading(btn, 'Guardando...', function () { return apiRequest('POST', '/calidad/trafico/whatsapp/carga', _twwParsed); });
  } catch (e) { showToast(e.message); return; }
  showToast(resp.insertadas + ' fila(s) guardadas (' + resp.colas.length + ' cola(s))');
  cancelarPreviewTraficoWpp();
  delete _traficoWpp[_twwParsed && _twwParsed.campana]; // invalida el cache del panel del dashboard
  _traficoWpp = {}; // por simplicidad, invalida todo el cache (pocas campanas usan este modulo hoy)
}
