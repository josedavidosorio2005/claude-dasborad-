// aurora-bases.js — Fase 306 (10/11/2026, Clinica Aurora): pestañas «Inasistencia»
// y «Encuestas» (paneles aurora_inasistencia_panel / aurora_encuestas_panel) y la
// ventana de carga de sus bases desde el Centro de cargas. Logica en
// aurora-bases-logic.js; colores AU_PALETA (agendas-usuaria-logic.js). Siguen el
// filtro MESES de arriba; los datos se guardan por campaña (_abCache[camp]).
var _abCache = {}; // por campaña: { inasistencia: { filas }, encuestas: { filas } }
var AB_RUTA = { inasistencia: '/calidad/aurora-inasistencia', encuestas: '/calidad/aurora-encuestas' };
var AB_MODULO_TIPO = { inasistencia_au: 'inasistencia', encuestas_au: 'encuestas' };

async function _abCargar(tipo, camp) {
  var c = _abCache[camp] || (_abCache[camp] = {});
  if (c[tipo]) return c[tipo];
  var r = await apiRequest('GET', AB_RUTA[tipo] + '/datos?campana=' + encodeURIComponent(camp));
  c[tipo] = { filas: (r && r.filas) || [] };
  return c[tipo];
}
async function _abCargarOpciones(tipo, camp) {
  var r = await apiRequest('GET', AB_RUTA[tipo] + '/opciones?campana=' + encodeURIComponent(camp));
  return { meses: (r && r.meses) || [] };
}
function _abOscuro() { return typeof temaActual === 'function' && temaActual() === 'dark'; }
function _abColor(id) { return typeof auColorAgendas === 'function' ? auColorAgendas(id, _abOscuro()) : '#1565c0'; }
function _abMeses() { return (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : []; }
function _abFmtN(v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO'); }
function _abFechaCorta(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return m ? (+m[3]) + ' ' + MES[+m[2] - 1] + ' ' + m[1] : iso;
}
function _abVacio(el, titulo, que, interno) {
  el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div>' +
    (typeof avisoPendienteHtml === 'function' ? avisoPendienteHtml(que, interno) : '<div class="gd-vacio" role="status">' + esc(interno) + '</div>') + '</div>';
}
// Barras horizontales con los nombres COMPLETOS (en varias lineas) en el eje.
function _abBarrasH(canvasId, etiquetas, datos, color, formato) {
  var o = (typeof loBar === 'function') ? loBar(null) : { responsive: true, maintainAspectRatio: false, plugins: {}, scales: { x: {}, y: {} } };
  o.indexAxis = 'y';
  o.plugins.legend = { display: false };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return formato(ctx.parsed.x); } } };
  if (o.plugins.datalabels) Object.assign(o.plugins.datalabels, { anchor: 'end', align: 'end', clamp: true, color: color, formatter: function (v) { return formato(v); } });
  // Pantalla angosta: trozos mas cortos y letra menor, para que el nombre completo no se recorte.
  var angosta = typeof window !== 'undefined' && window.innerWidth < 600;
  o.scales = Object.assign({}, o.scales, {
    x: Object.assign({}, (o.scales || {}).x, { beginAtZero: true, grace: '15%', ticks: Object.assign({}, ((o.scales || {}).x || {}).ticks, { callback: function (v) { return formato(v); } }) }),
    y: Object.assign({}, (o.scales || {}).y, { ticks: Object.assign({}, ((o.scales || {}).y || {}).ticks, { autoSkip: false, font: { size: angosta ? 10 : 12 },
      callback: function (v) { var t = String(this.getLabelForValue(v) || ''); return typeof auPartirEtiqueta === 'function' ? auPartirEtiqueta(t, angosta ? 14 : 24) : t; } }) }),
  });
  o.layout = Object.assign({}, o.layout, { padding: { right: 60 } });
  _gdChart(canvasId, { type: 'bar', data: { labels: etiquetas, datasets: [{ label: '', data: datos, backgroundColor: color, borderColor: color, maxBarThickness: 34 }] }, options: o });
}

// ── Inasistencia: % por especialidad (solo el porcentaje), de mayor a menor ──
async function _abRenderInasistencia(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  el.dataset.campana = camp; el.dataset.abTipo = 'inasistencia';
  var titulo = p.titulo || 'Inasistencia por especialidad';
  var datos;
  try { datos = await _abCargar('inasistencia', camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) { _abVacio(el, titulo, 'Inasistencia', 'Todavía no hay base de inasistencias. Súbela en Cargar datos › ' + esc(camp) + ' › Inasistencia (Aurora) › Subir.'); return; }
  var esp = inaPorEspecialidad(datos.filas, _abMeses());
  if (!esp.length) { el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="gd-vacio" role="status">Sin citas para los meses elegidos.</div></div>'; return; }
  var alto = Math.max(280, 46 * esp.length + 80);
  el.innerHTML = gdGraficaHtml(esc(titulo),
    '<p class="ab-nota">% de inasistencia = citas con estado «No asistió» ÷ total de citas de la especialidad.</p>' +
    '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-ab-ina"></canvas></div>', { destacado: true });
  _abBarrasH('gd-c' + i + '-ab-ina', esp.map(function (x) { return x.especialidad; }), esp.map(function (x) { return x.pct; }), _abColor('citas'), abPct);
}

// ── Encuestas: una barra por entidad y la linea de tiempo por fecha ──
async function _abRenderEncuestas(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  el.dataset.campana = camp; el.dataset.abTipo = 'encuestas';
  var titulo = p.titulo || 'Encuestas';
  var datos;
  try { datos = await _abCargar('encuestas', camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) { _abVacio(el, titulo, 'Encuestas', 'Todavía no hay compilado de encuestas. Súbelo en Cargar datos › ' + esc(camp) + ' › Encuestas (Aurora) › Subir.'); return; }
  var meses = _abMeses();
  var ent = encPorEntidad(datos.filas, meses), fec = encPorFecha(datos.filas, meses);
  if (!ent.length) { el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="gd-vacio" role="status">Sin encuestas para los meses elegidos.</div></div>'; return; }
  var alto = Math.max(280, 46 * ent.length + 80);
  el.innerHTML =
    gdGraficaHtml('Encuestas por entidad', '<p class="ab-nota">Las encuestas sin entidad no se grafican.</p><div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-ab-ent"></canvas></div>', { destacado: true }) +
    gdGraficaHtml('Encuestas por fecha', '<div class="aurora-chart-wrap" style="height:320px"><canvas id="gd-c' + i + '-ab-fec"></canvas></div>', { destacado: true });
  _abBarrasH('gd-c' + i + '-ab-ent', ent.map(function (x) { return x.entidad; }), ent.map(function (x) { return x.n; }), _abColor('citas'), _abFmtN);
  var c = _abColor('total');
  var o = (typeof lo === 'function') ? lo(null) : { responsive: true, maintainAspectRatio: false, plugins: {}, scales: { x: {}, y: {} } };
  if (typeof _auEjeDesdeCero === 'function') _auEjeDesdeCero(o);
  if (o.scales && o.scales.y) o.scales.y.grace = '12%';
  if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(o, _abFmtN);
  if (o.plugins.datalabels) o.plugins.datalabels.color = c;
  o.plugins.legend = { display: false };
  o.layout = { padding: { top: 22, left: 10, right: 30 } };
  _gdChart('gd-c' + i + '-ab-fec', { type: 'line', data: { labels: fec.map(function (x) { return _abFechaCorta(x.fecha); }),
    datasets: [{ label: 'Encuestas', data: fec.map(function (x) { return x.n; }), borderColor: c, backgroundColor: c, pointBackgroundColor: c, borderWidth: 2.5, pointRadius: 5, tension: 0.25, fill: false }] }, options: o });
}

// Para Exportar del tablero: la tabla que se ve.
function _abFilasExport(i) {
  var host = document.getElementById('gd-p' + i); if (!host) return [];
  var camp = host.dataset.campana, tipo = host.dataset.abTipo, d = (_abCache[camp] || {})[tipo];
  if (!d) return [];
  if (tipo === 'inasistencia') return inaPorEspecialidad(d.filas, _abMeses()).map(function (x) { return { Especialidad: x.especialidad, '% inasistencia': x.pct }; });
  return encPorEntidad(d.filas, _abMeses()).map(function (x) { return { Entidad: x.entidad, Encuestas: x.n }; });
}

// ── Carga desde el Centro de cargas (rama Aurora) ──
function abAbrirCarga(moduloId, cliente, mes) {
  var tipo = AB_MODULO_TIPO[moduloId]; if (!tipo) return;
  var nombre = tipo === 'inasistencia' ? 'Base de inasistencias' : 'Compilado de encuestas';
  var ayuda = tipo === 'inasistencia'
    ? 'La base tal cual la exporta la clínica (.xls o .xlsx). Se usan las columnas fecha, especialidad y estado (por nombre, en cualquier orden).'
    : 'El compilado tal cual (.xlsx). Se usan las columnas fecha y entidad (por nombre, en cualquier orden). Las filas sin entidad no se cuentan.';
  _ccDialogo(esc(nombre) + (mes && typeof centroNombreMes === 'function' ? ' (' + esc(centroNombreMes(mes)) + ')' : ''),
    '<p class="au-bases-ayuda">' + ayuda + ' Nada de los pacientes sale de tu equipo: solo se envían conteos. Subir otra vez un mes lo reemplaza (con Deshacer).</p>' +
    '<div class="ig"><label for="ab-archivo">Archivo</label><input type="file" id="ab-archivo" accept=".xls,.xlsx"></div>' +
    '<div id="ab-estado" class="au-bases-estado" role="status" aria-live="polite"></div>',
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary" id="ab-guardar" data-ab-tipo="' + tipo + '" data-ab-cliente="' + esc(cliente) + '" onclick="abGuardarCarga(this)">Revisar y guardar</button>');
}

async function abGuardarCarga(btn) {
  var tipo = btn.getAttribute('data-ab-tipo'), cliente = btn.getAttribute('data-ab-cliente');
  var estado = document.getElementById('ab-estado');
  var decir = function (html, error) { if (estado) { estado.innerHTML = html; estado.setAttribute('role', error ? 'alert' : 'status'); estado.classList.toggle('au-bases-error', !!error); } };
  var input = document.getElementById('ab-archivo');
  var f = input && input.files && input.files[0];
  if (!f) { decir('Elige el archivo.', true); return; }
  btn.disabled = true;
  try {
    decir('Leyendo «' + esc(f.name) + '»…');
    var buf = await new Promise(function (ok, mal) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { mal(new Error('No se pudo leer el archivo')); }; fr.readAsArrayBuffer(f); });
    var wb = XLSX.read(new Uint8Array(buf), { type: 'array', sheetStubs: true, cellNF: true });
    var leer = tipo === 'inasistencia' ? inaParse : encParse, r = null;
    for (var k = 0; k < wb.SheetNames.length; k++) { // la hoja que tenga las columnas
      var x = leer(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[k]], { header: 1, blankrows: false, defval: null }), f.name);
      if (!x.error) { r = x; break; }
      if (!r) r = x;
    }
    if (r.error) { decir('<p>' + esc(r.error) + '</p>', true); return; }
    if (!r.filas.length) { decir('El archivo no tiene filas para contar.', true); return; }
    var cuerpo = { campana: cliente, archivoNombre: f.name.slice(0, 200), filas: r.filas };
    var imp = await apiRequest('POST', AB_RUTA[tipo] + '/carga/impacto', cuerpo);
    var resumen = tipo === 'inasistencia'
      ? r.citas + ' cita(s), ' + r.noAsistio + ' «No asistió»; estados: ' + Object.keys(r.estados).map(function (e) { return e + ' ' + r.estados[e]; }).join(', ')
      : r.encuestas + ' encuesta(s) con entidad, ' + Object.keys(r.entidades).length + ' entidad(es)';
    var lineas = (imp.meses || []).map(function (m) { return '• ' + mesNombreLargo(m.mes) + ': ' + m.nuevas + (m.existentes > 0 ? ' — REEMPLAZA ' + m.existentes + ' ya cargada(s)' : ' — mes nuevo'); });
    var avisos = r.avisos.length ? '\n\nAvisos:\n' + r.avisos.join('\n') : '';
    if (!confirm('«' + f.name + '»: ' + resumen + '\n\nSe va a guardar:\n' + lineas.join('\n') + avisos + '\n\n¿Continuar?')) { decir('No se guardó nada.'); return; }
    var resp = await apiRequest('POST', AB_RUTA[tipo] + '/carga', cuerpo);
    Object.keys(_abCache).forEach(function (c) { delete _abCache[c]; });
    if (typeof showToast === 'function') showToast(resp.total + ' registro(s) guardados (' + resp.meses.map(mesNombreLargo).join(', ') + ')');
    _ccCerrarDialogo();
    if (typeof _ccCargar === 'function') _ccCargar();
  } catch (e) {
    decir(esc(e.message || String(e)), true);
  } finally { btn.disabled = false; }
}
