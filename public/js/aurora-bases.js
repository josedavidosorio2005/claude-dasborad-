// aurora-bases.js — Fase 306 (10/11/2026, Clinica Aurora): pestañas «Inasistencia»
// y «Encuestas» (paneles aurora_inasistencia_panel / aurora_encuestas_panel) y la
// ventana de carga de sus bases desde el Centro de cargas. Logica en
// aurora-bases-logic.js; colores AU_PALETA (agendas-usuaria-logic.js). Siguen el
// filtro MESES de arriba; los datos se guardan por campaña (_abCache[camp]).
var _abCache = {}; // por campaña: { inasistencia: { filas }, encuestas: { filas } }
var AB_RUTA = { inasistencia: '/calidad/aurora-inasistencia', encuestas: '/calidad/aurora-encuestas',
  // Fase 311: «Gestión líneas internas»
  flujo_li: '/calidad/aurora-li-flujo', cdr_li: '/calidad/aurora-li-cdr', whatsapp_li: '/calidad/aurora-li-whatsapp' };
var AB_MODULO_TIPO = { inasistencia_au: 'inasistencia', encuestas_au: 'encuestas', flujo_li: 'flujo_li', cdr_li: 'cdr_li', whatsapp_li: 'whatsapp_li' };
// Fase 311: nombre, ayuda y lector de las 3 bases de líneas internas (lineas-internas-logic.js).
var AB_LI = {
  flujo_li: { nombre: 'Flujo líneas internas', ayuda: 'El HistQueue de Wolkvox tal cual (.xlsx). Se usan las columnas SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS y SERVICE_LEVEL_20SEC (por nombre, en cualquier orden). Si trae una hoja por área, se leen todas.' },
  cdr_li: { nombre: 'CDR líneas internas', ayuda: 'El HistCDR de Wolkvox tal cual (.xlsx). Se usan AGENT_NAME, DATE, DESCRIPTION_COD_ACT, SKILL_NAME y SKILL_ID (por nombre). SKILL_NAME «-» = llamada de salida. Las filas PRUEBA no se cuentan.' },
  whatsapp_li: { nombre: 'WhatsApp líneas internas', ayuda: 'El HistChat de Wolkvox tal cual (.xlsx). Se usan AGENT_NAME, DATE_CLOSE, DESCRIPTION_COD_ACT y SKILL_ID (por nombre). Las filas PRUEBA no se cuentan.' },
};

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

// ── Fase 320 (pedido de Edwin, 10/11): Inasistencia y Encuestas más simples ──
// Vista inicial «Por mes» (una línea, un punto por mes con su valor) y botones para
// cambiar de vista. El subtítulo dice siempre qué se está mostrando. Los cálculos no
// cambian (inaPorMes / inaPorEspecialidad usan la misma fórmula de siempre).
var _abVista = {}; // por campaña: { ina, inaMes, enc, encMes }
function _abEstado(camp) { return _abVista[camp] || (_abVista[camp] = { ina: 'mes', inaMes: '', enc: 'mes', encMes: '' }); }
function _abMesLargo(m) { return typeof mesNombreLargo === 'function' ? mesNombreLargo(m) : m; }
function _abBotones(grupo, lista, activa, i, etiqueta) {
  return '<div class="gd-subtabs au-ag-botones" role="group" aria-label="' + esc(etiqueta) + '">' + lista.map(function (b) {
    var on = b.v === activa;
    return '<button type="button" class="gd-subtab-btn' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-ab-grupo="' + grupo + '" data-v="' + esc(b.v) + '">' + esc(b.t) + '</button>';
  }).join('') + '</div>';
}
// Linea con el valor visible en cada punto y, opcional, la linea punteada del promedio.
function _abLinea(canvasId, etiquetas, datos, formato, promedio, etiquetaSerie) {
  var c = _abColor('total'), cp = _abColor('citas');
  var o = (typeof lo === 'function') ? lo(null) : { responsive: true, maintainAspectRatio: false, plugins: {}, scales: { x: {}, y: {} } };
  if (typeof _auEjeDesdeCero === 'function') _auEjeDesdeCero(o);
  if (o.scales && o.scales.y) { o.scales.y.grace = '18%'; o.scales.y.ticks = Object.assign({}, o.scales.y.ticks, { callback: function (v) { return formato(v); } }); }
  var angosta = typeof window !== 'undefined' && window.innerWidth < 600;
  // offset: cada punto en el centro de su espacio (con un solo mes no queda pegado al borde).
  if (o.scales && o.scales.x) o.scales.x.offset = true;
  if (o.scales && o.scales.x) o.scales.x.ticks = Object.assign({}, o.scales.x.ticks, { autoSkip: false, maxRotation: 60, font: { size: angosta ? 10 : 12 },
    callback: function (v) { var t = String(this.getLabelForValue(v) || ''); return typeof auPartirEtiqueta === 'function' ? auPartirEtiqueta(t, angosta ? 12 : 18) : t; } });
  o.plugins.datalabels = Object.assign({}, o.plugins.datalabels, { display: function (ctx) { return ctx.datasetIndex === 0; }, align: 'top', anchor: 'end', color: c, formatter: function (v) { return formato(v); } });
  o.plugins.legend = { display: promedio !== null && promedio !== undefined, position: 'bottom', labels: { boxWidth: 14, font: { size: 12 } } };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + formato(ctx.parsed.y); } } };
  o.layout = { padding: { top: 26, left: 10, right: 24 } };
  var ds = [{ label: etiquetaSerie, data: datos, borderColor: c, backgroundColor: c, pointBackgroundColor: c, borderWidth: 2.5, pointRadius: 6, tension: 0.2, fill: false }];
  if (promedio !== null && promedio !== undefined) ds.push({ label: 'Promedio de los meses: ' + formato(promedio), data: datos.map(function () { return promedio; }), borderColor: cp, backgroundColor: cp, borderDash: [7, 5], borderWidth: 2, pointRadius: 0, fill: false });
  _gdChart(canvasId, { type: 'line', data: { labels: etiquetas, datasets: ds }, options: o });
}
function _abSinDatos(el, titulo, texto) {
  el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="gd-vacio" role="status">' + esc(texto) + '</div></div>';
}
function _abEnlazar(el, camp, p, i) {
  el.querySelectorAll('[data-ab-grupo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var st = _abEstado(camp), g = b.getAttribute('data-ab-grupo'), v = b.getAttribute('data-v');
      st[g] = v;
      (el.dataset.abTipo === 'inasistencia' ? _abRenderInasistencia : _abRenderEncuestas)(p, i);
    });
  });
}

// ── Inasistencia ──
async function _abRenderInasistencia(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  el.dataset.campana = camp; el.dataset.abTipo = 'inasistencia';
  var datos;
  try { datos = await _abCargar('inasistencia', camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) { _abVacio(el, 'Inasistencia', 'Inasistencia', 'Todavía no hay base de inasistencias. Súbela en Cargar datos › ' + esc(camp) + ' › Inasistencia (Aurora) › Subir.'); return; }
  var st = _abEstado(camp), meses = abMesesConDatos(datos.filas, _abMeses());
  if (!meses.length) { _abSinDatos(el, 'Inasistencia', 'Sin citas para los meses elegidos.'); return; }
  if (meses.indexOf(st.inaMes) === -1) st.inaMes = meses[meses.length - 1];
  var vistas = _abBotones('ina', [{ v: 'mes', t: 'Por mes' }, { v: 'especialidad', t: 'Por especialidad' }], st.ina, i, 'Ver inasistencia');
  var nota = '<p class="ab-nota">% de inasistencia = citas con estado «No asistió» ÷ total de citas.</p>';
  if (st.ina === 'especialidad') {
    var esp = inaPorEspecialidad(datos.filas, [st.inaMes]);
    var selMes = meses.length > 1 ? '<div class="ab-meses">' + _abBotones('inaMes', meses.map(function (m) { return { v: m, t: _abMesLargo(m) }; }), st.inaMes, i, 'Mes') + '</div>' : '';
    var alto = Math.max(340, Math.min(560, 18 * esp.length + 300));
    el.innerHTML = gdGraficaHtml('Inasistencia por especialidad', '<p class="ab-sub">Mes: <b>' + esc(_abMesLargo(st.inaMes)) + '</b> · ' + esp.length + ' especialidad(es), de mayor a menor</p>' + selMes + nota +
      '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-ab-ina"></canvas></div>', { destacado: true, acciones: vistas });
    _abLinea('gd-c' + i + '-ab-ina', esp.map(function (x) { return x.especialidad; }), esp.map(function (x) { return x.pct; }), abPct, null, '% inasistencia');
  } else {
    var serie = inaPorMes(datos.filas, meses), prom = abPromedio(serie.map(function (x) { return x.pct; }));
    el.innerHTML = gdGraficaHtml('Inasistencia por mes', '<p class="ab-sub">Un punto por mes (' + serie.length + (serie.length === 1 ? ' mes' : ' meses') + ') · promedio de los meses: <b>' + esc(abPct(prom)) + '</b></p>' + nota +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="gd-c' + i + '-ab-ina"></canvas></div>', { destacado: true, acciones: vistas });
    _abLinea('gd-c' + i + '-ab-ina', serie.map(function (x) { return _abMesLargo(x.mes); }), serie.map(function (x) { return x.pct; }), abPct, serie.length > 1 ? prom : null, '% inasistencia del mes');
  }
  _abEnlazar(el, camp, p, i);
}

// ── Encuestas ── (el compilado no trae especialidad: se ofrece «Por entidad»)
async function _abRenderEncuestas(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  el.dataset.campana = camp; el.dataset.abTipo = 'encuestas';
  var datos;
  try { datos = await _abCargar('encuestas', camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) { _abVacio(el, 'Encuestas', 'Encuestas', 'Todavía no hay compilado de encuestas. Súbelo en Cargar datos › ' + esc(camp) + ' › Encuestas (Aurora) › Subir.'); return; }
  var st = _abEstado(camp), meses = abMesesConDatos(datos.filas, _abMeses());
  if (!meses.length) { _abSinDatos(el, 'Encuestas', 'Sin encuestas para los meses elegidos.'); return; }
  if (meses.indexOf(st.encMes) === -1) st.encMes = meses[meses.length - 1];
  var vistas = _abBotones('enc', [{ v: 'mes', t: 'Por mes' }, { v: 'entidad', t: 'Por entidad' }, { v: 'dia', t: 'Por día' }], st.enc, i, 'Ver encuestas');
  var selMes = meses.length > 1 ? '<div class="ab-meses">' + _abBotones('encMes', meses.map(function (m) { return { v: m, t: _abMesLargo(m) }; }), st.encMes, i, 'Mes') + '</div>' : '';
  var nota = '<p class="ab-nota">Las encuestas sin entidad no se cuentan.</p>';
  if (st.enc === 'entidad') {
    var ent = encPorEntidad(datos.filas, [st.encMes]);
    var alto = Math.max(340, Math.min(560, 18 * ent.length + 300));
    el.innerHTML = gdGraficaHtml('Encuestas por entidad', '<p class="ab-sub">Mes: <b>' + esc(_abMesLargo(st.encMes)) + '</b> · ' + ent.length + ' entidad(es), de mayor a menor</p>' + selMes + nota +
      '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-ab-enc"></canvas></div>', { destacado: true, acciones: vistas });
    _abLinea('gd-c' + i + '-ab-enc', ent.map(function (x) { return x.entidad; }), ent.map(function (x) { return x.n; }), _abFmtN, null, 'Encuestas');
  } else if (st.enc === 'dia') {
    var fec = encPorFecha(datos.filas, [st.encMes]);
    el.innerHTML = gdGraficaHtml('Encuestas por día', '<p class="ab-sub">Mes: <b>' + esc(_abMesLargo(st.encMes)) + '</b> · un punto por día con encuestas</p>' + selMes + nota +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="gd-c' + i + '-ab-enc"></canvas></div>', { destacado: true, acciones: vistas });
    _abLinea('gd-c' + i + '-ab-enc', fec.map(function (x) { return _abFechaCorta(x.fecha); }), fec.map(function (x) { return x.n; }), _abFmtN, null, 'Encuestas');
  } else {
    var serie = encPorMes(datos.filas, meses), prom = abPromedio(serie.map(function (x) { return x.n; }));
    el.innerHTML = gdGraficaHtml('Encuestas por mes', '<p class="ab-sub">Cantidad de encuestas, un punto por mes (' + serie.length + (serie.length === 1 ? ' mes' : ' meses') + ')' + (serie.length > 1 ? ' · promedio de los meses: <b>' + esc(_abFmtN(prom)) + '</b>' : '') + '</p>' + nota +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="gd-c' + i + '-ab-enc"></canvas></div>', { destacado: true, acciones: vistas });
    _abLinea('gd-c' + i + '-ab-enc', serie.map(function (x) { return _abMesLargo(x.mes); }), serie.map(function (x) { return x.n; }), _abFmtN, serie.length > 1 ? prom : null, 'Encuestas del mes');
  }
  _abEnlazar(el, camp, p, i);
}

// Para Exportar del tablero: la tabla de la vista que se ve.
function _abFilasExport(i) {
  var host = document.getElementById('gd-p' + i); if (!host) return [];
  var camp = host.dataset.campana, tipo = host.dataset.abTipo, d = (_abCache[camp] || {})[tipo];
  if (!d) return [];
  var st = _abEstado(camp), meses = abMesesConDatos(d.filas, _abMeses());
  if (tipo === 'inasistencia') {
    if (st.ina === 'especialidad') return inaPorEspecialidad(d.filas, [st.inaMes]).map(function (x) { return { Mes: _abMesLargo(st.inaMes), Especialidad: x.especialidad, '% inasistencia': x.pct }; });
    return inaPorMes(d.filas, meses).map(function (x) { return { Mes: _abMesLargo(x.mes), Citas: x.total, 'No asistió': x.noAsistio, '% inasistencia': x.pct }; });
  }
  if (st.enc === 'entidad') return encPorEntidad(d.filas, [st.encMes]).map(function (x) { return { Mes: _abMesLargo(st.encMes), Entidad: x.entidad, Encuestas: x.n }; });
  if (st.enc === 'dia') return encPorFecha(d.filas, [st.encMes]).map(function (x) { return { Fecha: x.fecha, Encuestas: x.n }; });
  return encPorMes(d.filas, meses).map(function (x) { return { Mes: _abMesLargo(x.mes), Encuestas: x.n }; });
}

// ── Carga desde el Centro de cargas (rama Aurora) ──
function abAbrirCarga(moduloId, cliente, mes) {
  var tipo = AB_MODULO_TIPO[moduloId]; if (!tipo) return;
  var nombre = AB_LI[tipo] ? AB_LI[tipo].nombre : (tipo === 'inasistencia' ? 'Base de inasistencias' : 'Compilado de encuestas');
  var ayuda = AB_LI[tipo] ? AB_LI[tipo].ayuda : (tipo === 'inasistencia'
    ? 'La base tal cual la exporta la clínica (.xls o .xlsx). Se usan las columnas fecha, especialidad y estado (por nombre, en cualquier orden).'
    : 'El compilado tal cual (.xlsx). Se usan las columnas fecha y entidad (por nombre, en cualquier orden). Las filas sin entidad no se cuentan.');
  _ccDialogo(esc(nombre) + (mes && typeof centroNombreMes === 'function' ? ' (' + esc(centroNombreMes(mes)) + ')' : ''),
    '<p class="au-bases-ayuda">' + ayuda + ' Nada de los pacientes sale de tu equipo: solo se envían conteos. Subir otra vez un mes lo reemplaza (con Deshacer).</p>' +
    '<div class="ig"><label for="ab-archivo">Archivo</label><input type="file" id="ab-archivo" accept=".xls,.xlsx"></div>' +
    '<div id="ab-estado" class="au-bases-estado" role="status" aria-live="polite"></div>',
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary" id="ab-guardar" data-ab-tipo="' + tipo + '" data-ab-cliente="' + esc(cliente) + '" data-ab-mes="' + esc(mes || '') + '" onclick="abGuardarCarga(this)">Revisar y guardar</button>');
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
    var r = null;
    // Fase 311: las bases de líneas internas leen TODAS las hojas a la vez.
    if (AB_LI[tipo]) r = ({ flujo_li: liFlujoParse, cdr_li: liCdrParse, whatsapp_li: liWhatsappParse })[tipo](wb.SheetNames.map(function (n) { return { nombre: n, aoa: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false, defval: null }) }; }), f.name);
    var leer = tipo === 'inasistencia' ? inaParse : encParse;
    for (var k = 0; !AB_LI[tipo] && k < wb.SheetNames.length; k++) { // la hoja que tenga las columnas
      var x = leer(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[k]], { header: 1, blankrows: false, defval: null }), f.name);
      if (!x.error) { r = x; break; }
      if (!r) r = x;
    }
    if (r.error) { decir('<p>' + esc(r.error) + '</p>', true); return; }
    if (!r.filas.length) { decir('El archivo no tiene filas para contar.', true); return; }
    var cuerpo = { campana: cliente, archivoNombre: f.name.slice(0, 200), filas: r.filas };
    var imp = await apiRequest('POST', AB_RUTA[tipo] + '/carga/impacto', cuerpo);
    var resumen = AB_LI[tipo] ? liResumenCarga(tipo, r) : tipo === 'inasistencia'
      ? r.citas + ' cita(s), ' + r.noAsistio + ' «No asistió»; estados: ' + Object.keys(r.estados).map(function (e) { return e + ' ' + r.estados[e]; }).join(', ')
      : r.encuestas + ' encuesta(s) con entidad, ' + Object.keys(r.entidades).length + ' entidad(es)';
    var lineas = (imp.meses || []).map(function (m) { return '• ' + mesNombreLargo(m.mes) + ': ' + m.nuevas + (m.existentes > 0 ? ' — REEMPLAZA ' + m.existentes + ' ya cargada(s)' : ' — mes nuevo'); });
    var avisos = r.avisos.length ? '\n\nAvisos:\n' + r.avisos.join('\n') : '';
    // Fase 319: en líneas internas, aviso claro de QUÉ meses se reemplazan (y si el archivo trae
    // otros meses ademas del elegido). La logica de reemplazo no cambia.
    var textoConfirmar = (AB_LI[tipo] && typeof liTextoConfirmacion === 'function')
      ? liTextoConfirmacion({ archivo: f.name, resumen: resumen, meses: imp.meses || [], mesElegido: btn.getAttribute('data-ab-mes') || '', avisos: r.avisos, nombreMes: mesNombreLargo })
      : '«' + f.name + '»: ' + resumen + '\n\nSe va a guardar:\n' + lineas.join('\n') + avisos + '\n\n¿Continuar?';
    if (!confirm(textoConfirmar)) { decir('No se guardó nada.'); return; }
    var resp = await apiRequest('POST', AB_RUTA[tipo] + '/carga', cuerpo);
    Object.keys(_abCache).forEach(function (c) { delete _abCache[c]; });
    if (typeof _liCache !== 'undefined') Object.keys(_liCache).forEach(function (c) { delete _liCache[c]; });
    if (typeof showToast === 'function') showToast(resp.total + ' registro(s) guardados (' + resp.meses.map(mesNombreLargo).join(', ') + ')');
    _ccCerrarDialogo();
    if (typeof _ccCargar === 'function') _ccCargar();
  } catch (e) {
    decir(esc(e.message || String(e)), true);
  } finally { btn.disabled = false; }
}
