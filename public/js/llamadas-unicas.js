// llamadas-unicas.js — InConexion Platform (Fase 138, PR3, pedido de Edwin
// 09/10/2026). Panel "llamadas_unicas_panel" del dashboard generico
// (dashboard-generic.js): llamadas de INGRESO deduplicadas por (dia,
// telefono) -- contestadas unicas, abandonadas unicas, total unicas (suma).
// Mismo patron que tipificacion.js (filtros + tarjetas + grafica, fetch a
// agregados ya calculados en el servidor -- nunca filas crudas).
//
// Diseño pedido: mitad IZQUIERDA de la fila superior de Flujo de Llamadas
// ("Llamadas de ingreso unicas"). La mitad DERECHA ("Llamadas de salida")
// queda SIN CONSTRUIR a proposito -- Edwin todavia no mando ese archivo
// ("ahorita lo saco y te lo comparto"); nunca se muestra una mitad vacia ni
// se inventan cifras en un dashboard de cliente (ver docs/pendientes.md).
'use strict';

var _llamadasUnicasOpciones = {}; // cache por campana: { meses, agentes, skills }
var _llamadasUnicasEstado = {};   // estado de filtros actual por campana

function _llamadasUnicasFmtFechaCorta(f) {
  if (!f) return '';
  var p = f.split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0].slice(2)) : f;
}

async function _llamadasUnicasCargarOpciones(campana) {
  if (_llamadasUnicasOpciones[campana]) return _llamadasUnicasOpciones[campana];
  var op = { meses: [], agentes: [], skills: [] };
  try { op = (await apiRequest('GET', '/calidad/llamadas-unicas/opciones?campana=' + encodeURIComponent(campana))) || op; }
  catch (e) { /* sin datos o sin acceso -- el panel muestra su propio aviso vacio */ }
  _llamadasUnicasOpciones[campana] = op;
  return op;
}

function _llamadasUnicasOptionsHtml(valores, seleccionado) {
  return '<option value="">Todos</option>' + (valores || []).map(function (v) {
    return '<option value="' + esc(v) + '"' + (v === seleccionado ? ' selected' : '') + '>' + esc(v === LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA ? v : textoFormatoNombre(v)) + '</option>';
  }).join('');
}

async function _llamadasUnicasRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  var campana = p.campana || _gd.cliente;
  host.dataset.campana = campana;

  var op = await _llamadasUnicasCargarOpciones(campana);
  if (!op.meses || !op.meses.length) {
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Llamadas de ingreso únicas</div>' +
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin llamadas únicas cargadas todavía' +
      (typeof canLoadData === 'function' && canLoadData() ? '. Un usuario con permiso de administrador debe subir el archivo desde "Cargar Datos".' : '.') +
      '</div></div>';
    return;
  }

  if (!_llamadasUnicasEstado[campana]) _llamadasUnicasEstado[campana] = { desde: '', hasta: '', skill: '', agente: '' };
  var estado = _llamadasUnicasEstado[campana];

  // Filtro de asesor: SOLO roles internos (pedido explicito de Edwin --
  // por defecto, CLIENTES_DASH no ve nombres de asesor aqui; la decision
  // definitiva de si algun dia los vera sigue pendiente del usuario, ver
  // docs/pendientes.md).
  var esInterno = !currentUser || currentUser.rol !== 'CLIENTES_DASH';
  var filtroAsesor = esInterno
    ? '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Asesor</label>' +
      '<select id="lu-f-agente-' + i + '">' + _llamadasUnicasOptionsHtml(op.agentes, estado.agente) + '</select></div>'
    : '';

  host.innerHTML =
    '<div class="aurora-card">' +
      '<div class="aurora-card-title">Llamadas de ingreso únicas</div>' +
      '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px">' +
        '<div class="ig" style="margin-bottom:0"><label>Desde</label><input type="date" id="lu-f-desde-' + i + '" value="' + esc(estado.desde) + '"></div>' +
        '<div class="ig" style="margin-bottom:0"><label>Hasta</label><input type="date" id="lu-f-hasta-' + i + '" value="' + esc(estado.hasta) + '"></div>' +
        '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Skill</label><select id="lu-f-skill-' + i + '">' + _llamadasUnicasOptionsHtml(op.skills, estado.skill) + '</select></div>' +
        filtroAsesor +
        '<div class="ig" style="margin-bottom:0"><button class="btn-sm" onclick="_llamadasUnicasAplicarFiltros(' + i + ')">Aplicar filtros</button></div>' +
      '</div>' +
      '<div class="aurora-kpis" id="lu-kpis-' + i + '"></div>' +
      '<div class="aurora-chart-wrap" style="height:260px"><canvas id="lu-canvas-' + i + '"></canvas></div>' +
    '</div>';

  await _llamadasUnicasRenderContenido(campana, i);
}

function _llamadasUnicasLeerControles(i) {
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { desde: v('lu-f-desde-' + i), hasta: v('lu-f-hasta-' + i), skill: v('lu-f-skill-' + i), agente: v('lu-f-agente-' + i) };
}

function _llamadasUnicasAplicarFiltros(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host.dataset.campana;
  _llamadasUnicasEstado[campana] = _llamadasUnicasLeerControles(i);
  _llamadasUnicasRenderContenido(campana, i);
}

function _llamadasUnicasDibujarKpis(i, resumen) {
  var el = document.getElementById('lu-kpis-' + i);
  if (!el) return;
  el.innerHTML =
    '<div class="aurora-kpi"><div class="kv">' + resumen.contestadas.toLocaleString('es-CO') + '</div><div class="kl">Contestadas únicas</div></div>' +
    '<div class="aurora-kpi kpi-red"><div class="kv">' + resumen.abandonadas.toLocaleString('es-CO') + '</div><div class="kl">Abandonadas únicas</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + resumen.total.toLocaleString('es-CO') + '</div><div class="kl">Total únicas</div></div>';
}

function _llamadasUnicasDibujarBarras(i, porMes) {
  var CDl = (typeof CD !== 'undefined') ? CD : '#0d4a5e';
  var CGl = (typeof CG !== 'undefined') ? CG : '#27ae60';
  var COl = (typeof CO !== 'undefined') ? CO : '#e67e22';
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y || 0).toLocaleString('es-CO'); } } };
  if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o, function (v) { return (v === null || v === undefined) ? '' : v.toLocaleString('es-CO'); });
  else o.plugins.datalabels = { display: false };
  var datasets = [
    { type: 'bar', label: 'Total únicas', data: porMes.map(function (m) { return m.total; }), backgroundColor: CDl, borderRadius: 3 },
    { type: 'bar', label: 'Contestadas únicas', data: porMes.map(function (m) { return m.contestadas; }), backgroundColor: CGl, borderRadius: 3 },
    { type: 'bar', label: 'Abandonadas únicas', data: porMes.map(function (m) { return m.abandonadas; }), backgroundColor: COl, borderRadius: 3 },
  ];
  if (typeof _gdChart === 'function') {
    _gdChart('lu-canvas-' + i, { data: { labels: porMes.map(function (m) { return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m.periodo) : m.periodo; }), datasets: datasets }, options: o });
  }
}

async function _llamadasUnicasRenderContenido(campana, i) {
  var estado = _llamadasUnicasEstado[campana] || {};
  var q = 'campana=' + encodeURIComponent(campana) +
    (estado.desde ? '&desde=' + encodeURIComponent(estado.desde) : '') +
    (estado.hasta ? '&hasta=' + encodeURIComponent(estado.hasta) : '') +
    (estado.skill ? '&skill=' + encodeURIComponent(estado.skill) : '') +
    (estado.agente ? '&agente=' + encodeURIComponent(estado.agente) : '');
  var resumen = { contestadas: 0, abandonadas: 0, total: 0 };
  var porMes = [];
  try {
    resumen = (await apiRequest('GET', '/calidad/llamadas-unicas/resumen?' + q)) || resumen;
    porMes = (await apiRequest('GET', '/calidad/llamadas-unicas/por-mes?' + q)) || [];
  } catch (e) { /* el panel se queda con los KPIs/grafica en 0 — nunca inventa un numero */ }
  _llamadasUnicasDibujarKpis(i, resumen);
  _llamadasUnicasDibujarBarras(i, porMes);
}
