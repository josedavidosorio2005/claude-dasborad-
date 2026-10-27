// encuesta.js — InConexion Platform (Fase 147, Parte B, reunion con Edwin
// del 14/10/2026). Panel "encuesta_panel" del dashboard generico (pestaña
// "Encuesta" de Mobilize, antes de Calidad): resultado de la encuesta de
// satisfaccion post-llamada. Un solo juego de filtros (Desde/Hasta, Skill,
// Asesor) para todo; 4 recuadros (uno por pregunta, barras Respuesta →
// Cantidad con TODOS los valores posibles aunque tengan 0); al final, los
// comentarios con texto. Todo viene agregado del servidor
// (GET /calidad/encuestas/*) -- nunca filas crudas, salvo los comentarios.
//
// Nombres de asesor: misma regla que Llamadas Unicas y de Salida
// (_llamadasUnicasVeAsesores, "OK nombres para cliente"): roles internos y
// el cliente de Mobilize. El servidor tambien lo exige.
'use strict';

var _encuestaOpciones = {}; // cache por campana: { total, desde, hasta, meses, skills, agentes? }
var _encuestaEstado = {};   // filtros por campana
var _encuestaUltimo = {};   // por campana: { resumen, comentarios } (para exportar)

var ENCUESTA_AVISO = 'Resultado de la encuesta de satisfacción que responde el usuario al terminar la llamada.';

function _encuestaVeAsesores(campana) {
  if (typeof _llamadasUnicasVeAsesores === 'function') return _llamadasUnicasVeAsesores(campana);
  return typeof currentUser === 'undefined' || !currentUser || currentUser.rol !== 'CLIENTES_DASH';
}

function _encuestaFmtFecha(f) {
  return (typeof fechaDiaCorta === 'function') ? fechaDiaCorta(f, true) : f;
}

function _encuestaNombre(v) {
  if (!v) return 'Sin dato';
  return (typeof textoFormatoNombre === 'function') ? textoFormatoNombre(v) : v;
}

async function _encuestaCargarOpciones(campana) {
  if (_encuestaOpciones[campana]) return _encuestaOpciones[campana];
  var op = { total: 0, meses: [], skills: [] };
  try { op = (await apiRequest('GET', '/calidad/encuestas/opciones?campana=' + encodeURIComponent(campana))) || op; }
  catch (e) { /* sin datos o sin acceso -- estado vacio */ }
  _encuestaOpciones[campana] = op;
  return op;
}

function _encuestaOptionsHtml(valores, seleccionado, formato) {
  return '<option value="">Todos</option>' + (valores || []).map(function (v) {
    return '<option value="' + esc(v) + '"' + (v === seleccionado ? ' selected' : '') + '>' + esc(formato ? formato(v) : v) + '</option>';
  }).join('');
}

// Fase 171 (pedido de Edwin: "solo se cargo septiembre, pero en octubre
// aparecen datos"): el panel arrancaba sin Desde/Hasta (todo el periodo), asi
// que cualquier mes mostraba lo cargado. Ahora sigue el MES de arriba como
// los demas paneles: al cambiar el MES, Desde/Hasta pasan a ese mes; si el
// mes no tiene encuestas, sale el aviso de siempre con "Ver <ultimo mes>".
var _encuestaMesSincronizado = {}; // por campana: ultimo _gd.mesSel aplicado

async function _encuestaRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  var campana = p.campana || _gd.cliente;
  host.dataset.campana = campana;
  var titulo = '<div class="enc-cabecera"><div><div class="aurora-card-title">Encuesta de satisfacción</div>' +
    '<p class="lu-aviso" style="color:var(--c-text-muted);font-size:var(--fs-small);margin:-4px 0 10px">' + ENCUESTA_AVISO + '</p></div>' +
    '<button type="button" class="btn-sm" onclick="_encuestaAbrirPreguntas()">Preguntas de la encuesta</button></div>';
  var op = await _encuestaCargarOpciones(campana);
  if (!op.total) {
    _encuestaUltimo[campana] = null;
    host.innerHTML = '<div class="aurora-card">' + titulo + '<div class="gd-vacio">Sin encuestas cargadas todavía' +
      (typeof canLoadData === 'function' && canLoadData() ? '. Un usuario con permiso de administrador debe subir el archivo desde "Cargar Datos".' : '.') + '</div></div>';
    return;
  }
  if (!_encuestaEstado[campana]) _encuestaEstado[campana] = { desde: '', hasta: '', skill: '', agente: '' };
  var estado = _encuestaEstado[campana];
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  if (mesGlobal && _encuestaMesSincronizado[campana] !== mesGlobal) {
    _encuestaMesSincronizado[campana] = mesGlobal;
    estado.desde = mesGlobal + '-01';
    estado.hasta = (typeof gdFinDeMes === 'function') ? gdFinDeMes(mesGlobal) : mesGlobal + '-31';
  }
  var mesesEnc = (op.meses || []).slice().sort();
  if (mesGlobal && estado.desde === mesGlobal + '-01' && mesesEnc.length && mesesEnc.indexOf(mesGlobal) === -1) {
    _encuestaUltimo[campana] = null;
    host.innerHTML = '<div class="aurora-card">' + titulo +
      _gdAvisoSinDatosMesHtml('Encuesta', mesGlobal, mesesEnc[mesesEnc.length - 1]) + '</div>';
    return;
  }
  var ve = _encuestaVeAsesores(campana);
  if (estado.skill && (op.skills || []).indexOf(estado.skill) === -1) estado.skill = '';
  if (!ve || (estado.agente && (op.agentes || []).indexOf(estado.agente) === -1)) estado.agente = '';
  var filtroAsesor = ve
    ? '<div class="ig ig-filtro"><label for="enc-f-agente-' + i + '">Asesor</label>' +
      '<select id="enc-f-agente-' + i + '">' + _encuestaOptionsHtml(op.agentes, estado.agente, _encuestaNombre) + '</select></div>'
    : '';
  var cuadros = (ENCUESTA_PREGUNTAS || []).map(function (q) {
    // Fase 195: la pregunta 1 lleva en su cabecera "Cantidad" | "NPS".
    var cab = q.key === 'q1'
      ? '<div class="gd-grafica-cab enc-cab"><div class="aurora-card-title">Pregunta ' + q.n + '</div>' + _encuestaBotonesQ1Html(i) + '</div>'
      : '<div class="aurora-card-title">Pregunta ' + q.n + '</div>';
    return '<div class="aurora-card enc-pregunta">' + cab +
      '<div class="aurora-chart-wrap" style="height:230px"><canvas id="enc-c-' + q.key + '-' + i + '" role="img" aria-label="Pregunta ' + q.n + ': cantidad por respuesta"></canvas></div>' +
      '<p class="enc-pie" id="enc-pie-' + q.key + '-' + i + '"></p>' +
      (q.key === 'q1' ? '<div class="enc-nps" id="enc-nps-' + i + '" aria-live="polite"></div>' : '') + '</div>';
  }).join('');
  host.innerHTML = '<div class="aurora-card">' + titulo +
    '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:4px">' +
      '<div class="ig ig-sm"><label for="enc-f-desde-' + i + '">Desde</label><input type="date" id="enc-f-desde-' + i + '" value="' + esc(estado.desde) + '"></div>' +
      '<div class="ig ig-sm"><label for="enc-f-hasta-' + i + '">Hasta</label><input type="date" id="enc-f-hasta-' + i + '" value="' + esc(estado.hasta) + '"></div>' +
      '<div class="ig ig-filtro"><label for="enc-f-skill-' + i + '">Skill</label><select id="enc-f-skill-' + i + '">' + _encuestaOptionsHtml(op.skills, estado.skill) + '</select></div>' +
      filtroAsesor +
      '<div class="ig ig-sm"><button class="btn-sm" onclick="_encuestaAplicarFiltros(' + i + ')">Aplicar filtros</button></div>' +
      '<div class="ig" style="margin-bottom:0;margin-left:auto"><button class="btn-sm" onclick="_encuestaExportExcel(' + i + ')">Excel</button> ' +
        '<button class="btn-sm" onclick="_encuestaExportPrint(' + i + ')">PDF</button></div>' +
    '</div>' +
    '<p class="enc-total" id="enc-total-' + i + '"></p></div>' +
    '<div class="aurora-grid-2 enc-preguntas">' + cuadros + '</div>' +
    '<div class="aurora-card"><div class="aurora-card-title">Comentarios</div><div id="enc-comentarios-' + i + '"></div></div>';
  await _encuestaRenderContenido(campana, i);
}

function _encuestaAplicarFiltros(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : null;
  if (!campana) return;
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  _encuestaEstado[campana] = { desde: v('enc-f-desde-' + i), hasta: v('enc-f-hasta-' + i), skill: v('enc-f-skill-' + i), agente: v('enc-f-agente-' + i) };
  _encuestaRenderContenido(campana, i);
}

function _encuestaQuery(campana) {
  var e = _encuestaEstado[campana] || {};
  return 'campana=' + encodeURIComponent(campana) +
    (e.desde ? '&desde=' + encodeURIComponent(e.desde) : '') +
    (e.hasta ? '&hasta=' + encodeURIComponent(e.hasta) : '') +
    (e.skill ? '&skill=' + encodeURIComponent(e.skill) : '') +
    (e.agente && _encuestaVeAsesores(campana) ? '&agente=' + encodeURIComponent(e.agente) : '');
}

// ── Fase 195: vista "Cantidad" | "NPS" de la pregunta 1, por panel ──
var _encuestaVistaQ1 = {}; // i -> 'cantidad' | 'nps'
var _encuestaDatosQ1 = {}; // i -> { datos, k } del ultimo dibujo (para cambiar de vista sin pedir otra vez)
function _encuestaBotonesQ1Html(i) {
  var activa = _encuestaVistaQ1[i] || 'cantidad';
  return '<div class="gd-subtabs enc-q1-vista" aria-label="Vista de la pregunta 1">' +
    [{ v: 'cantidad', t: 'Cantidad' }, { v: 'nps', t: 'NPS' }].map(function (b) {
      return '<button type="button" class="gd-subtab-btn' + (b.v === activa ? ' on' : '') + '" data-vista="' + b.v + '" onclick="encuestaElegirVistaQ1(' + i + ',\'' + b.v + '\')">' + b.t + '</button>';
    }).join('') + '</div>';
}
function encuestaElegirVistaQ1(i, vista) {
  _encuestaVistaQ1[i] = vista === 'nps' ? 'nps' : 'cantidad';
  document.querySelectorAll('#gd-p' + i + ' .enc-q1-vista .gd-subtab-btn').forEach(function (b) {
    var on = b.getAttribute('data-vista') === _encuestaVistaQ1[i];
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  var u = _encuestaDatosQ1[i];
  var q = (ENCUESTA_PREGUNTAS || []).filter(function (x) { return x.key === 'q1'; })[0];
  if (u && q) _encuestaDibujarPregunta(i, q, u.datos, u.k);
}
function _encuestaNpsHtml(n) {
  if (!n.respondieron) return '<p class="enc-nps-nota">Nadie contestó la pregunta 1 con estos filtros: sin NPS.</p>';
  var pct = function (v) { return encuestaFmtPct(v); };
  return '<div class="enc-nps-valor"><span class="enc-nps-num">' + String(n.nps).replace('.', ',') + '</span> <span class="enc-nps-etq">NPS</span></div>' +
    '<p class="enc-nps-detalle">Promotores ' + pct(n.pctPromotores) + ' (' + n.promotores + ') − detractores ' + pct(n.pctDetractores) + ' (' + n.detractores + '); pasivos ' + n.pasivos +
    ', sobre ' + n.respondieron.toLocaleString('es-CO') + ' que contestaron la pregunta 1.</p>' +
    '<p class="enc-nps-nota">' + esc(ENCUESTA_NPS_NOTA) + '</p>';
}

function _encuestaDibujarPregunta(i, q, datos, k) {
  var pie = document.getElementById('enc-pie-' + q.key + '-' + i);
  if (pie) pie.textContent = datos.respondieron.toLocaleString('es-CO') + ' respondieron · ' + datos.sinRespuesta.toLocaleString('es-CO') + ' sin respuesta';
  // Fase 195: en la pregunta 1, la vista "NPS" cambia cantidades por % sobre las que contestaron.
  var nps = null;
  if (q.key === 'q1') {
    _encuestaDatosQ1[i] = { datos: datos, k: k };
    var elNps = document.getElementById('enc-nps-' + i);
    if (_encuestaVistaQ1[i] === 'nps') {
      nps = encuestaNps(datos);
      if (elNps) elNps.innerHTML = _encuestaNpsHtml(nps);
    } else if (elNps) elNps.innerHTML = '';
  }
  var color = (typeof PC !== 'undefined' && PC.length) ? PC[k % PC.length] : '#29564b';
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins = o.plugins || {};
  o.plugins.legend = { display: false };
  o.plugins.tooltip = { callbacks: { label: function (ctx) {
    if (nps) { var x = nps.porcentajes[ctx.dataIndex] || {}; return encuestaFmtPct(ctx.parsed.y) + ' (' + (x.cantidad || 0) + ' de ' + nps.respondieron + ')'; }
    return 'Cantidad: ' + (ctx.parsed.y || 0).toLocaleString('es-CO');
  } } };
  if (o.plugins.datalabels) {
    o.plugins.datalabels.display = true;
    o.plugins.datalabels.formatter = function (v) { return nps ? (v ? encuestaFmtPct(v) : '') : (v || 0).toLocaleString('es-CO'); };
  }
  o.scales = o.scales || {};
  o.scales.y = Object.assign({}, o.scales.y || {}, nps
    ? { beginAtZero: true, max: 100, ticks: Object.assign({}, (o.scales.y || {}).ticks || {}, { callback: function (v) { return v + ' %'; } }) }
    : { beginAtZero: true, ticks: Object.assign({}, (o.scales.y || {}).ticks || {}, { precision: 0 }) });
  o.scales.x = Object.assign({}, o.scales.x || {}, { title: { display: true, text: 'Respuesta' } });
  if (typeof _gdChart === 'function') {
    _gdChart('enc-c-' + q.key + '-' + i, {
      type: 'bar',
      data: {
        labels: datos.valores.map(function (x) { return encuestaEtiquetaValor(q, x.valor); }),
        datasets: [nps
          ? { label: '% de las que contestaron', data: nps.porcentajes.map(function (x) { return x.pct || 0; }), backgroundColor: color, borderRadius: 3 }
          : { label: 'Cantidad', data: datos.valores.map(function (x) { return x.cantidad; }), backgroundColor: color, borderRadius: 3 }],
      },
      options: o,
    });
  }
}

function _encuestaComentariosHtml(lista, ve) {
  if (!lista || !lista.length) return '<div class="gd-vacio-chico">No hay comentarios con estos filtros.</div>';
  return '<div class="table-wrap" style="max-height:360px;overflow:auto"><table class="aurora-table enc-tabla-comentarios"><thead><tr>' +
    '<th class="th-izq">Fecha</th><th class="th-izq">Skill</th>' + (ve ? '<th class="th-izq">Asesor</th>' : '') +
    '<th class="th-izq">Comentario</th><th class="th-izq">ID de llamada</th></tr></thead><tbody>' +
    lista.map(function (c) {
      return '<tr><td>' + esc(_encuestaFmtFecha(c.fecha)) + '</td><td>' + esc(c.skill || 'Sin dato') + '</td>' +
        (ve ? '<td>' + esc(_encuestaNombre(c.agente)) + '</td>' : '') + '<td style="text-align:left">' + esc(c.comentario) + '</td>' +
        // Fase 184: ID de la llamada (CONN_ID), al final para no quitarle espacio al comentario en el celular; vacio si el archivo no lo traia.
        '<td class="enc-conn-id">' + esc(c.connId || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

async function _encuestaRenderContenido(campana, i) {
  var q = _encuestaQuery(campana);
  var resumen = null, comentarios = [];
  try {
    resumen = await apiRequest('GET', '/calidad/encuestas/resumen?' + q);
    comentarios = (await apiRequest('GET', '/calidad/encuestas/comentarios?' + q)) || [];
  } catch (e) { resumen = null; }
  _encuestaUltimo[campana] = resumen ? { resumen: resumen, comentarios: comentarios } : null;
  var total = document.getElementById('enc-total-' + i);
  if (total) total.textContent = resumen
    ? (resumen.total ? resumen.total.toLocaleString('es-CO') + ' encuesta(s) con estos filtros.' : 'No hay encuestas con estos filtros.')
    : 'No se pudieron leer las encuestas.';
  var vacio = { respondieron: 0, sinRespuesta: 0, valores: [] };
  (ENCUESTA_PREGUNTAS || []).forEach(function (pq, k) {
    var d = resumen ? (resumen.preguntas || []).filter(function (x) { return x.key === pq.key; })[0] : null;
    if (!d) d = Object.assign({}, vacio, { valores: encuestaValoresPosibles(pq).map(function (v) { return { valor: v, cantidad: 0 }; }) });
    _encuestaDibujarPregunta(i, pq, d, k);
  });
  var elC = document.getElementById('enc-comentarios-' + i);
  if (elC) elC.innerHTML = _encuestaComentariosHtml(comentarios, _encuestaVeAsesores(campana));
}

// ── Dialogo "Preguntas de la encuesta" (patron A3b: #modal-encuesta-preguntas
// en index.html, registrado en MOTION_DIALOGOS_SIMPLES -- foco atrapado,
// Escape y foco de vuelta al boton) ──
function _encuestaAbrirPreguntas() {
  var lista = document.getElementById('enc-preguntas-lista');
  if (lista) {
    lista.innerHTML = (ENCUESTA_PREGUNTAS || []).map(function (q) {
      return '<li><strong>Pregunta ' + q.n + '.</strong> ' + esc(q.texto) + '</li>';
    }).join('') + '<li><strong>Comentarios.</strong> ' + esc(ENCUESTA_PREGUNTA_COMENTARIOS) + '</li>';
  }
  var ov = document.getElementById('modal-encuesta-preguntas');
  if (ov) ov.classList.add('show');
}
function _encuestaCerrarPreguntas() {
  var ov = document.getElementById('modal-encuesta-preguntas');
  if (ov) ov.classList.remove('show');
}

// ── Exportar (Excel/PDF del panel y "Exportar" de la pestaña) ──
function _encuestaFiltrosTexto(campana) {
  var e = _encuestaEstado[campana] || {};
  var partes = [];
  partes.push('Desde ' + (e.desde ? _encuestaFmtFecha(e.desde) : 'el inicio') + ' hasta ' + (e.hasta ? _encuestaFmtFecha(e.hasta) : 'hoy'));
  partes.push('Skill: ' + (e.skill || 'Todos'));
  if (_encuestaVeAsesores(campana)) partes.push('Asesor: ' + (e.agente ? _encuestaNombre(e.agente) : 'Todos'));
  return partes.join(' · ');
}

// Bloques exportables: una tabla por pregunta + comentarios.
function _encuestaDatosExport(campana) {
  var u = _encuestaUltimo[campana];
  if (!u || !u.resumen || !u.resumen.total) return [];
  var ve = _encuestaVeAsesores(campana);
  var bloques = (ENCUESTA_PREGUNTAS || []).map(function (q) {
    var d = (u.resumen.preguntas || []).filter(function (x) { return x.key === q.key; })[0] || { valores: [], respondieron: 0, sinRespuesta: 0 };
    var filas = d.valores.map(function (x) { return { Respuesta: encuestaEtiquetaValor(q, x.valor), Cantidad: x.cantidad }; });
    filas.push({ Respuesta: 'Respondieron', Cantidad: d.respondieron });
    filas.push({ Respuesta: 'Sin respuesta', Cantidad: d.sinRespuesta });
    return { titulo: 'Pregunta ' + q.n, hoja: 'Pregunta' + q.n, texto: q.texto, filas: filas };
  });
  bloques.push({
    titulo: 'Comentarios', hoja: 'Comentarios', texto: ENCUESTA_PREGUNTA_COMENTARIOS,
    filas: (u.comentarios || []).map(function (c) {
      var f = { Fecha: _encuestaFmtFecha(c.fecha), Skill: c.skill || 'Sin dato' };
      if (ve) f.Asesor = _encuestaNombre(c.agente);
      f.Comentario = c.comentario;
      f['ID de llamada'] = c.connId || ''; // Fase 184
      return f;
    }),
  });
  return bloques;
}

function _encuestaExportExcel(i) {
  if (typeof XLSX === 'undefined') { showToast('No se pudo cargar el generador de Excel.'); return; }
  // Fase 149 (auditoria 148): sin la proteccion anti-formula NO se exporta
  // (antes caia en silencio a las filas crudas, con comentarios de texto libre).
  if (typeof xlsxFilasSeguras !== 'function') { showToast('No se pudo preparar el Excel de forma segura. Recarga la página e inténtalo de nuevo.', 'error'); return; }
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : '';
  var bloques = _encuestaDatosExport(campana);
  if (!bloques.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var wb = XLSX.utils.book_new();
  if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wb);
  bloques.forEach(function (b) {
    var filas = b.filas.length ? b.filas : [{ Aviso: 'Sin comentarios con estos filtros.' }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(filas)), b.hoja);
  });
  XLSX.writeFile(wb, 'Encuesta_' + String(campana).replace(/\s+/g, '_') + '.xlsx');
}

function _encuestaExportPrint(i) {
  var host = document.getElementById('gd-p' + i);
  var campana = host ? host.dataset.campana : '';
  var bloques = _encuestaDatosExport(campana);
  if (!bloques.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var w = window.open('', '_blank');
  if (!w) { showToast('Permite las ventanas emergentes para exportar a PDF.'); return; }
  var cuerpo = bloques.map(function (b) {
    if (!b.filas.length) return '<h2>' + esc(b.titulo) + '</h2><p>' + esc(b.texto) + '</p><p>Sin comentarios con estos filtros.</p>';
    var cols = Object.keys(b.filas[0]);
    return '<h2>' + esc(b.titulo) + '</h2><p>' + esc(b.texto) + '</p><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      b.filas.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }).join('');
  var avisoHtml = (typeof seedDemoActivo !== 'undefined' && seedDemoActivo)
    ? '<div style="background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:16px">' +
      '⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
    : '';
  w.document.write('<!doctype html><html><head><title>Encuesta de satisfacción — ' + esc(campana) + '</title>' +
    '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}h2{color:#0d4a5e;font-size:14px;margin:18px 0 4px}' +
    'p{font-size:12px;margin:2px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0 16px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}' +
    'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>' + avisoHtml +
    '<h1>Encuesta de satisfacción — ' + esc(campana) + '</h1><p>' + esc(_encuestaFiltrosTexto(campana)) + '</p>' + cuerpo +
    '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — ' + new Date().toLocaleString('es-CO') + '</p>' +
    '</body></html>');
  w.document.close();
  setTimeout(function () { w.focus(); w.print(); }, 300);
}

// ── Parte C: "Solución en primer contacto (FCR)" en Flujo de Llamadas ──
// La llama _traficoRenderContenido (trafico.js) en la sub-pestaña "Flujo de
// Llamadas" cuando el panel trae `fcrBase` ('total' = todas las encuestas
// del mes, pedido de Edwin; 'respondieron' = solo las que contestaron la
// pregunta 3). Mes de la tarjeta = el del final del rango del panel; los
// demas meses del rango con encuestas van en una linea aparte. Siempre con
// la fraccion ("3 de 45 encuestas") para que se entienda.
var ENCUESTA_FCR_NOTA = 'Encuestas en las que el usuario dijo que su solicitud se resolvió en este primer contacto (pregunta 3 = Sí).';
async function _encuestaDibujarFcr(i, campana, desde, hasta, base) {
  var kpis = document.getElementById('tv-kpis-' + i);
  if (!kpis) return;
  // Una tarjeta mas al final de la fila de tarjetas de Flujo de Llamadas
  // (_traficoDibujarKpis reescribe esa fila en cada filtro: se vuelve a poner).
  var el = document.getElementById('tv-fcr-' + i);
  if (!el) {
    kpis.insertAdjacentHTML('beforeend', '<div class="aurora-kpi enc-fcr" id="tv-fcr-' + i + '"></div>');
    el = document.getElementById('tv-fcr-' + i);
  }
  var q = 'campana=' + encodeURIComponent(campana) + '&base=' + encodeURIComponent(base === 'respondieron' ? 'respondieron' : 'total') +
    (desde ? '&desde=' + encodeURIComponent(desde) : '') + (hasta ? '&hasta=' + encodeURIComponent(hasta) : '');
  var porMes = [];
  try { porMes = (await apiRequest('GET', '/calidad/encuestas/fcr?' + q)) || []; } catch (e) { porMes = []; }
  var mesFin = hasta ? hasta.slice(0, 7) : (porMes.length ? porMes[porMes.length - 1].periodo : '');
  var t = encuestaFcrTarjeta(porMes, mesFin);
  var mesLbl = function (m) { return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m) : m; };
  var nota = ' <span title="' + esc(ENCUESTA_FCR_NOTA) + '" style="cursor:help;color:var(--c-text-muted);font-size:var(--fs-note);border:1px solid var(--c-border,#999);border-radius:50%;padding:0 4px">?</span>';
  var cuerpo = t.sinEncuestas
    ? '<div class="kv">—</div><div class="kl">Solución en primer contacto (FCR)' + nota + '</div><div class="enc-fcr-sub">' + esc(mesLbl(t.mes)) + ': Sin encuestas este mes</div>'
    : '<div class="kv">' + esc(encuestaFmtPct(t.pct)) + '</div><div class="kl">Solución en primer contacto (FCR)' + nota + '</div>' +
      '<div class="enc-fcr-sub">' + esc(mesLbl(t.mes)) + ': ' + esc(encuestaFcrFraccion(t.si, t.den, t.base)) + '</div>';
  var otros = t.otros.length
    ? '<div class="enc-fcr-otros">Otros meses: ' + t.otros.map(function (m) {
        return esc(mesLbl(m.periodo)) + ' ' + esc(encuestaFmtPct(m.pct)) + ' (' + esc(encuestaFcrFraccion(m.si, m.den, m.base)) + ')';
      }).join(' · ') + '</div>'
    : '';
  el.innerHTML = cuerpo + otros;
}

// ── Fase 147 (Parte D): sub-pestaña "One & Done" de Flujo de Llamadas ──
// Mismo endpoint y misma base que la tarjeta FCR (_encuestaDibujarFcr), asi
// el % es identico. Barras por mes (paleta categorica, sin semaforo: no hay
// meta), tarjeta con el mes del final del rango y el desglose de la
// pregunta 3 debajo.
var _encuestaOadUltimo = {}; // por indice de panel: serie para exportar
async function _encuestaDibujarOneAndDone(i, campana, desde, hasta, base) {
  var elKpi = document.getElementById('tv-oad-kpi-' + i);
  var elQ3 = document.getElementById('tv-oad-q3-' + i);
  base = base === 'respondieron' ? 'respondieron' : 'total';
  var q = 'campana=' + encodeURIComponent(campana) + '&base=' + encodeURIComponent(base) +
    (desde ? '&desde=' + encodeURIComponent(desde) : '') + (hasta ? '&hasta=' + encodeURIComponent(hasta) : '');
  var porMes = [];
  var mesLbl = function (m) { return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m) : m; };
  // Fase 150: un error de red/servidor NO se disfraza de "Sin encuestas":
  // se dice que no se pudo cargar (y no queda nada viejo para exportar).
  try { porMes = (await apiRequest('GET', '/calidad/encuestas/fcr?' + q)) || []; }
  catch (e) {
    _encuestaOadUltimo[i] = [];
    if (elKpi) elKpi.innerHTML = '';
    if (elQ3) elQ3.textContent = '';
    var wrapErr = document.getElementById('tv-canvas-oad-' + i);
    if (wrapErr && wrapErr.parentNode) wrapErr.parentNode.innerHTML = '<div role="alert" style="text-align:center;color:var(--c-danger-text);padding:24px 8px">No se pudo cargar One &amp; Done. Revisa la conexión y vuelve a aplicar los filtros.</div>';
    return;
  }
  var serie = encuestaOneAndDoneSerie(porMes, encuestaMesesRango(desde, hasta, porMes), base);
  _encuestaOadUltimo[i] = serie;
  var d = encuestaQ3Desglose(porMes);
  if (!d.total) {
    if (elKpi) elKpi.innerHTML = '';
    if (elQ3) elQ3.textContent = '';
    var wrap = document.getElementById('tv-canvas-oad-' + i);
    if (wrap && wrap.parentNode) wrap.parentNode.innerHTML = '<div class="gd-vacio">Sin encuestas en el período seleccionado. Cuando se cargue la Encuesta de satisfacción, aquí aparecerá One &amp; Done por mes.</div>';
    return;
  }
  var mesFin = hasta ? String(hasta).slice(0, 7) : serie[serie.length - 1].periodo;
  var t = encuestaFcrTarjeta(porMes, mesFin);
  if (elKpi) {
    elKpi.innerHTML = '<div class="aurora-kpi enc-oad"><div class="kv">' + (t.sinEncuestas ? '—' : esc(encuestaFmtPct(t.pct))) + '</div>' +
      '<div class="kl">One &amp; Done — ' + esc(mesLbl(t.mes)) + ': ' +
      (t.sinEncuestas ? 'Sin encuestas este mes' : esc(encuestaFmtPct(t.pct)) + ' (' + esc(encuestaFcrFraccion(t.si, t.den, t.base)) + ')') + '</div></div>';
  }
  var sinMes = serie.filter(function (s) { return s.sinEncuestas; }).map(function (s) { return mesLbl(s.periodo); });
  if (elQ3) {
    elQ3.innerHTML = '<strong>Respuestas de la pregunta 3</strong> del período: ' +
      'Sí ' + d.si.toLocaleString('es-CO') + ' (' + esc(encuestaFmtPct(d.pctSi)) + ') · ' +
      'No ' + d.no.toLocaleString('es-CO') + ' (' + esc(encuestaFmtPct(d.pctNo)) + ') · ' +
      'Sin respuesta ' + d.sinRespuesta.toLocaleString('es-CO') + ' (' + esc(encuestaFmtPct(d.pctSinRespuesta)) + ')' +
      (sinMes.length ? '<br>' + esc(sinMes.join(', ')) + ': Sin encuestas este mes' : '');
  }
  var color = (typeof PC !== 'undefined' && PC.length) ? PC[0] : '#29564b';
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins = o.plugins || {};
  o.plugins.legend = { display: false };
  o.scales = {
    y: { min: 0, max: 100, grid: { color: (typeof CHART_GRID !== 'undefined' ? CHART_GRID : '#f0f4f8') }, ticks: { font: { size: 12 }, callback: function (v) { return v + ' %'; } } },
    x: { grid: { display: false }, ticks: { font: { size: 12 } } },
  };
  o.plugins.tooltip = { callbacks: { label: function (ctx) {
    var s = serie[ctx.dataIndex];
    return s.sinEncuestas ? 'Sin encuestas este mes' : encuestaFmtPct(s.pct) + ' (' + encuestaFcrFraccion(s.si, s.den, s.base) + ')';
  } } };
  o.plugins.datalabels = { display: function (ctx) { return serie[ctx.dataIndex] && !serie[ctx.dataIndex].sinEncuestas; }, anchor: 'end', align: 'end',
    formatter: function (v) { return encuestaFmtPct(v); } };
  if (typeof _gdChart === 'function') {
    _gdChart('tv-canvas-oad-' + i, {
      type: 'bar',
      // Fase 150: eje X con el mes en letras ("Septiembre 2026", pedido de Edwin).
      data: { labels: serie.map(function (s) { return mesLbl(s.periodo); }), datasets: [{ label: 'One & Done', data: serie.map(function (s) { return s.pct; }), backgroundColor: color, borderRadius: 3 }] },
      options: o,
    });
  }
}

function _encuestaOadDatosExport(i) {
  return (_encuestaOadUltimo[i] || []).map(function (s) {
    return {
      Periodo: s.periodo,
      'One & Done (%)': s.sinEncuestas ? 'Sin encuestas este mes' : s.pct,
      'Pregunta 3 = Sí': s.si,
      'Base': s.den,
      'Encuestas del mes': s.total,
      'Respondieron la pregunta 3': s.respondieron,
    };
  });
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  var _encuestaOv = document.getElementById('modal-encuesta-preguntas');
  if (_encuestaOv && typeof _encuestaOv.addEventListener === 'function') _encuestaOv.addEventListener('click', function (e) { if (e.target === this) _encuestaCerrarPreguntas(); });
}
