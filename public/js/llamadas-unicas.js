// llamadas-unicas.js — InConexion Platform (Fase 138, PR3, pedido de Edwin
// 09/10/2026). Panel "llamadas_unicas_panel" del dashboard generico
// (dashboard-generic.js): llamadas de INGRESO deduplicadas por (dia,
// telefono) -- contestadas unicas, abandonadas unicas, total unicas (suma).
// Mismo patron que tipificacion.js (filtros + tarjetas + grafica, fetch a
// agregados ya calculados en el servidor -- nunca filas crudas).
//
// Ubicacion (Fase 139, decision del usuario 13/10/2026, supera el diseño
// del 09/10 que lo ponia encima de Flujo de Llamadas): pestaña PROPIA
// "Llamadas Únicas" de Mobilize -- cuenta distinto que Flujo (CDR
// deduplicado por dia+telefono vs. todas las llamadas de la cola), por eso
// no comparten pantalla y el panel lo aclara bajo su titulo.
//
// Fase 141 (Parte C, reunion con Edwin del 13/10/2026): el panel tiene 2
// mitades -- ingreso a la izquierda (lo de siempre) y "Llamadas de salida" a
// la derecha (tabla llamadas_salida, ver llamadas-salida-logic.js), apiladas
// en movil. Cada mitad tiene sus propios filtros y su propio estado vacio;
// nunca se inventan cifras. Nombres de asesor (filtro y detalle) SOLO para
// roles internos, en las dos mitades.
'use strict';

var _llamadasUnicasOpciones = {}; // cache por campana: { meses, agentes, skills }
var _llamadasUnicasEstado = {};   // estado de filtros actual por campana
var _llamadasSalidaOpciones = {}; // Fase 141: cache por campana: { meses, agentes? }
var _llamadasSalidaEstado = {};   // Fase 141: filtros de la mitad de salida, por campana

// Aviso bajo el titulo (Fase 139): en español simple, por que este numero no
// coincide con Flujo de Llamadas.
var LLAMADAS_UNICAS_AVISO = 'Cuenta una sola vez cada teléfono por día. No coincide con Flujo de Llamadas, que cuenta todas las llamadas de la cola.';
function _llamadasUnicasTituloHtml() {
  return '<div class="aurora-card-title">Llamadas de ingreso únicas</div>' +
    '<p class="lu-aviso">' + LLAMADAS_UNICAS_AVISO + '</p>';
}

function _llamadasUnicasFmtFechaCorta(f) {
  if (!f) return '';
  var p = f.split('-');
  // Fase 147: el mes en letras ('3 sep 2026'), no 03/09/26.
  if (p.length === 3 && typeof fechaDiaCorta === 'function') return fechaDiaCorta(f, true);
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

// Filtro/detalle de asesor: roles internos siempre. Fase 147 ("OK nombres
// para cliente", pedido de Edwin): el cliente de estas campañas TAMBIEN los
// ve (mismo criterio que el servidor, puedeVerAsesores en
// routes/llamadas-salida.js). Fase 153 (Paso 2): la lista sale del registro
// de clientes (parametro asesorVisibleCliente, LISTAS_REGISTRO).
function _llamadasUnicasEsInterno() {
  return typeof currentUser === 'undefined' || !currentUser || currentUser.rol !== 'CLIENTES_DASH';
}
function _llamadasUnicasVeAsesores(campana) {
  return _llamadasUnicasEsInterno() || LISTAS_REGISTRO.asesorVisibleCliente.indexOf(campana) !== -1;
}
// Fase 147: el archivo de salida no trae skill real (SKILL_ID es el tipo),
// asi que el filtro de la mitad de salida es por Tipo.
var LS_TIPOS = [{ v: 'CONECTADA', t: 'Conectada' }, { v: 'NO_CONECTADA', t: 'No conectada' }];

function _llamadasUnicasSinDatosHtml(texto) {
  return '<div class="gd-vacio">' + texto +
    (typeof canLoadData === 'function' && canLoadData() ? '. Un usuario con permiso de administrador debe subir el archivo desde "Cargar Datos".' : '.') +
    '</div>';
}

async function _llamadasUnicasRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  var campana = p.campana || _gd.cliente;
  host.dataset.campana = campana;
  host.innerHTML = '<div class="aurora-grid-2 lu-mitades">' +
    '<div class="aurora-card" id="lu-ing-' + i + '"></div>' +
    '<div class="aurora-card gd-sec gd-sec-salida" id="ls-sal-' + i + '"></div>' +
    '</div>';
  await Promise.all([_llamadasUnicasRenderIngreso(campana, i), _llamadasSalidaRenderMitad(campana, i)]);
}

async function _llamadasUnicasRenderIngreso(campana, i) {
  var mitad = document.getElementById('lu-ing-' + i);
  if (!mitad) return;
  var op = await _llamadasUnicasCargarOpciones(campana);
  if (!op.meses || !op.meses.length) {
    mitad.innerHTML = _llamadasUnicasTituloHtml() + _llamadasUnicasSinDatosHtml('Sin llamadas únicas cargadas todavía');
    return;
  }

  if (!_llamadasUnicasEstado[campana]) _llamadasUnicasEstado[campana] = { desde: '', hasta: '', skill: '', agente: '' };
  var estado = _llamadasUnicasEstado[campana];

  var esInterno = _llamadasUnicasVeAsesores(campana);
  var filtroAsesor = esInterno
    ? '<div class="ig ig-filtro"><label for="lu-f-agente-' + i + '">Asesor</label>' +
      '<select id="lu-f-agente-' + i + '">' + _llamadasUnicasOptionsHtml(op.agentes, estado.agente) + '</select></div>'
    : '';

  mitad.innerHTML =
    _llamadasUnicasTituloHtml() +
    '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px">' +
      '<div class="ig ig-sm"><label for="lu-f-desde-' + i + '">Desde</label><input type="date" id="lu-f-desde-' + i + '" value="' + esc(estado.desde) + '"></div>' +
      '<div class="ig ig-sm"><label for="lu-f-hasta-' + i + '">Hasta</label><input type="date" id="lu-f-hasta-' + i + '" value="' + esc(estado.hasta) + '"></div>' +
      '<div class="ig ig-filtro"><label for="lu-f-skill-' + i + '">Skill</label><select id="lu-f-skill-' + i + '">' + _llamadasUnicasOptionsHtml(op.skills, estado.skill) + '</select></div>' +
      filtroAsesor +
      '<div class="ig ig-sm"><button class="btn-sm" onclick="_llamadasUnicasAplicarFiltros(' + i + ')">Aplicar filtros</button></div>' +
    '</div>' +
    '<div class="aurora-kpis" id="lu-kpis-' + i + '"></div>' +
    gdGraficaHtml('Llamadas únicas de ingreso por mes', '<div class="aurora-chart-wrap" style="height:260px"><canvas id="lu-canvas-' + i + '" data-titulo="Llamadas únicas de ingreso por mes"></canvas></div>');

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

// Fase 141 (pedido de Edwin, 13/10): orden total / contestadas / abandonadas.
// Fase 163: sin ninguna abandonada en el filtro (lo cargado antes de esta
// fase no las distinguia), una sola tarjeta "Llamadas únicas de ingreso" en
// vez de tres con el mismo numero.
function _llamadasUnicasSoloTotal(resumen) { return !resumen.abandonadas; }
function _llamadasUnicasDibujarKpis(i, resumen) {
  var el = document.getElementById('lu-kpis-' + i);
  if (!el) return;
  if (_llamadasUnicasSoloTotal(resumen)) {
    el.innerHTML = '<div class="aurora-kpi"><div class="kv">' + resumen.total.toLocaleString('es-CO') + '</div><div class="kl">Llamadas únicas de ingreso</div></div>';
    return;
  }
  el.innerHTML =
    '<div class="aurora-kpi"><div class="kv">' + resumen.total.toLocaleString('es-CO') + '</div><div class="kl">Total únicas</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + resumen.contestadas.toLocaleString('es-CO') + '</div><div class="kl">Contestadas únicas</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + resumen.abandonadas.toLocaleString('es-CO') + '</div><div class="kl">Abandonadas únicas</div></div>';
}

function _llamadasUnicasDibujarBarras(i, porMes, soloTotal) {
  var CDl = (typeof CD !== 'undefined') ? CD : '#0d4a5e';
  // Fase 152 (B1): paleta categorica (sin meta, no hay semaforo).
  var CGl = (typeof colorSerie==='function' ? colorSerie('principal') : '#0d4a5e');
  var COl = (typeof colorSerie==='function' ? colorSerie('secundaria') : '#0d4a5e');
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y || 0).toLocaleString('es-CO'); } } };
  if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o, function (v) { return (v === null || v === undefined) ? '' : v.toLocaleString('es-CO'); });
  else o.plugins.datalabels = { display: false };
  var datasets = [
    { type: 'bar', label: 'Total únicas', data: porMes.map(function (m) { return m.total; }), backgroundColor: CDl, borderRadius: 3 },
    { type: 'bar', label: 'Contestadas únicas', data: porMes.map(function (m) { return m.contestadas; }), backgroundColor: CGl, borderRadius: 3 },
    Object.assign({ type: 'bar', label: 'Abandonadas únicas', data: porMes.map(function (m) { return m.abandonadas; }), backgroundColor: COl, borderRadius: 3 }, (typeof estiloBarraSecundaria==='function' ? estiloBarraSecundaria() : {})),
  ];
  if (soloTotal) datasets = [{ type: 'bar', label: 'Llamadas únicas de ingreso', data: porMes.map(function (m) { return m.total; }), backgroundColor: CDl, borderRadius: 3 }];
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
  _llamadasUnicasDibujarBarras(i, porMes, _llamadasUnicasSoloTotal(resumen));
}

// ═══════════════════════════════════════════════════════════════════
// Fase 141 (Parte C): mitad derecha -- Llamadas de salida
// ═══════════════════════════════════════════════════════════════════
var LLAMADAS_SALIDA_AVISO = 'Cuenta una sola vez cada teléfono por día, por separado si la llamada fue conectada y no conectada.';

function _llamadasSalidaTituloHtml() {
  return '<div class="aurora-card-title">Llamadas de salida</div>' +
    '<p class="lu-aviso">' + LLAMADAS_SALIDA_AVISO + '</p>';
}

async function _llamadasSalidaCargarOpciones(campana) {
  if (_llamadasSalidaOpciones[campana]) return _llamadasSalidaOpciones[campana];
  var op = { meses: [] };
  try { op = (await apiRequest('GET', '/calidad/llamadas-salida/opciones?campana=' + encodeURIComponent(campana))) || op; }
  catch (e) { /* sin datos o sin acceso -- la mitad muestra su propio aviso vacio */ }
  _llamadasSalidaOpciones[campana] = op;
  return op;
}

async function _llamadasSalidaRenderMitad(campana, i) {
  var mitad = document.getElementById('ls-sal-' + i);
  if (!mitad) return;
  var op = await _llamadasSalidaCargarOpciones(campana);
  if (!op.meses || !op.meses.length) {
    mitad.innerHTML = _llamadasSalidaTituloHtml() + _llamadasUnicasSinDatosHtml('Sin llamadas de salida cargadas todavía');
    return;
  }
  if (!_llamadasSalidaEstado[campana]) _llamadasSalidaEstado[campana] = { desde: '', hasta: '', agente: '', tipo: '' };
  var estado = _llamadasSalidaEstado[campana];
  var esInterno = _llamadasUnicasVeAsesores(campana);
  var filtroTipo = '<div class="ig" style="min-width:150px;margin-bottom:0"><label for="ls-f-tipo-' + i + '">Tipo</label>' +
    '<select id="ls-f-tipo-' + i + '"><option value="">Todos</option>' +
    LS_TIPOS.map(function (x) { return '<option value="' + x.v + '"' + (estado.tipo === x.v ? ' selected' : '') + '>' + x.t + '</option>'; }).join('') +
    '</select></div>';
  var filtroAsesor = esInterno
    ? '<div class="ig ig-filtro"><label for="ls-f-agente-' + i + '">Asesor</label>' +
      '<select id="ls-f-agente-' + i + '">' + _llamadasUnicasOptionsHtml(op.agentes, estado.agente) + '</select></div>'
    : '';
  mitad.innerHTML =
    _llamadasSalidaTituloHtml() +
    '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px">' +
      '<div class="ig ig-sm"><label for="ls-f-desde-' + i + '">Desde</label><input type="date" id="ls-f-desde-' + i + '" value="' + esc(estado.desde) + '"></div>' +
      '<div class="ig ig-sm"><label for="ls-f-hasta-' + i + '">Hasta</label><input type="date" id="ls-f-hasta-' + i + '" value="' + esc(estado.hasta) + '"></div>' +
      filtroTipo +
      filtroAsesor +
      '<div class="ig ig-sm"><button class="btn-sm" onclick="_llamadasSalidaAplicarFiltros(' + i + ')">Aplicar filtros</button></div>' +
    '</div>' +
    '<div class="aurora-kpis" id="ls-kpis-' + i + '"></div>' +
    gdGraficaHtml('Llamadas de salida por mes', '<div class="aurora-chart-wrap" style="height:260px"><canvas id="ls-canvas-' + i + '" data-titulo="Llamadas de salida por mes"></canvas></div>') +
    (esInterno ? '<div id="ls-detalle-' + i + '"></div>' : '');
  await _llamadasSalidaRenderContenido(campana, i);
}

function _llamadasSalidaAplicarFiltros(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host.dataset.campana;
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  _llamadasSalidaEstado[campana] = { desde: v('ls-f-desde-' + i), hasta: v('ls-f-hasta-' + i), agente: v('ls-f-agente-' + i), tipo: v('ls-f-tipo-' + i) };
  _llamadasSalidaRenderContenido(campana, i);
}

// Orden pedido (Edwin, 13/10): total / no conectadas / conectadas.
function _llamadasSalidaKpisHtml(resumen) {
  return '<div class="aurora-kpi"><div class="kv">' + resumen.total.toLocaleString('es-CO') + '</div><div class="kl">Total llamadas de salida</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + resumen.noConectadas.toLocaleString('es-CO') + '</div><div class="kl">Llamadas de salida no conectadas</div></div>' +
    '<div class="aurora-kpi"><div class="kv">' + resumen.conectadas.toLocaleString('es-CO') + '</div><div class="kl">Llamadas de salida conectadas</div></div>';
}

function _llamadasSalidaDibujarBarras(i, porMes) {
  var CDl = (typeof CD !== 'undefined') ? CD : '#0d4a5e';
  // Fase 152 (B1): paleta categorica (sin meta, no hay semaforo).
  var CGl = (typeof colorSerie==='function' ? colorSerie('principal') : '#0d4a5e');
  var COl = (typeof colorSerie==='function' ? colorSerie('secundaria') : '#0d4a5e');
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y || 0).toLocaleString('es-CO'); } } };
  if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o, function (v) { return (v === null || v === undefined) ? '' : v.toLocaleString('es-CO'); });
  else o.plugins.datalabels = { display: false };
  var datasets = [
    { type: 'bar', label: 'Total', data: porMes.map(function (m) { return m.total; }), backgroundColor: CDl, borderRadius: 3 },
    Object.assign({ type: 'bar', label: 'No conectadas', data: porMes.map(function (m) { return m.noConectadas; }), backgroundColor: COl, borderRadius: 3 }, (typeof estiloBarraSecundaria==='function' ? estiloBarraSecundaria() : {})),
    { type: 'bar', label: 'Conectadas', data: porMes.map(function (m) { return m.conectadas; }), backgroundColor: CGl, borderRadius: 3 },
  ];
  if (typeof _gdChart === 'function') {
    _gdChart('ls-canvas-' + i, { data: { labels: porMes.map(function (m) { return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m.periodo) : m.periodo; }), datasets: datasets }, options: o });
  }
}

// Detalle por asesor y por dia (solo roles internos; el servidor tambien lo
// exige). Mismo patron visual que la tabla de Tipificacion.
function _llamadasSalidaDetalleHtml(detalle) {
  function tabla(titulo, col, filas, etiqueta) {
    if (!filas.length) return '';
    return '<div class="aurora-card-title" style="font-size:0.85rem;margin-top:12px">' + titulo + '</div>' +
      '<div class="table-wrap" style="max-height:280px;overflow:auto"><table class="aurora-table"><thead><tr><th class="th-izq">' + col + '</th><th>Total</th><th>No conectadas</th><th>Conectadas</th></tr></thead><tbody>' +
      filas.map(function (r) {
        return '<tr><td>' + esc(etiqueta(r)) + '</td><td>' + r.total.toLocaleString('es-CO') + '</td><td>' + r.noConectadas.toLocaleString('es-CO') + '</td><td>' + r.conectadas.toLocaleString('es-CO') + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }
  return tabla('Detalle por asesor', 'Asesor', detalle.porAsesor || [], function (r) { return textoFormatoNombre(r.agente); }) +
    tabla('Detalle por día', 'Día', detalle.porDia || [], function (r) { return _llamadasUnicasFmtFechaCorta(r.fecha); });
}

async function _llamadasSalidaRenderContenido(campana, i) {
  var estado = _llamadasSalidaEstado[campana] || {};
  var esInterno = _llamadasUnicasVeAsesores(campana);
  var q = 'campana=' + encodeURIComponent(campana) +
    (estado.desde ? '&desde=' + encodeURIComponent(estado.desde) : '') +
    (estado.hasta ? '&hasta=' + encodeURIComponent(estado.hasta) : '') +
    (estado.tipo ? '&tipo=' + encodeURIComponent(estado.tipo) : '') +
    (esInterno && estado.agente ? '&agente=' + encodeURIComponent(estado.agente) : '');
  var resumen = { total: 0, noConectadas: 0, conectadas: 0 };
  var porMes = [];
  var detalle = null;
  try {
    resumen = (await apiRequest('GET', '/calidad/llamadas-salida/resumen?' + q)) || resumen;
    porMes = (await apiRequest('GET', '/calidad/llamadas-salida/por-mes?' + q)) || [];
    if (esInterno) detalle = await apiRequest('GET', '/calidad/llamadas-salida/detalle?' + q);
  } catch (e) { /* tarjetas/grafica en 0 -- nunca inventa un numero */ }
  var elKpis = document.getElementById('ls-kpis-' + i);
  if (elKpis) elKpis.innerHTML = _llamadasSalidaKpisHtml(resumen);
  _llamadasSalidaDibujarBarras(i, porMes);
  var elDet = document.getElementById('ls-detalle-' + i);
  if (elDet) elDet.innerHTML = detalle ? _llamadasSalidaDetalleHtml(detalle) : '';
}
