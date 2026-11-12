// calidad-analisis.js — Fase 255 (plan de Calidad B4). En el modulo de Calidad:
// Resumen por asesor (KPIs, tabla con alerta, items mas afectados y que
// asesores los fallaron; clic en un asesor -> su detalle), Detalle por mes
// (lista filtrable y el detalle de cada monitoreo) y Diccionario de la
// plantilla. Todo sale de los monitoreos ya cargados (CAL_DB) y de las
// plantillas (CAL_PLANTILLAS_TODAS). El mes es el filtro MES de arriba.
var _ca = { plantillaId: null, detalleTexto: '' };

function _caPlantillas() { return typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []; }
function _caMonitoreosMes() { return calFilterByMonth(calMonModulo(_ccampana), _cmesFiltro); }

// Plantillas de la campaña que tienen monitoreos en el periodo (o la principal).
function _caPlantillasConDatos(arr) {
  var ids = {};
  arr.forEach(function (m) { var p = caPlantillaDe(m, _caPlantillas()); if (p) ids[p.id] = (ids[p.id] || 0) + 1; });
  var lista = _caPlantillas().filter(function (p) { return p.campana === _ccampana && (ids[p.id] || (p.principal && p.activo !== false)); });
  return { lista: lista, conteo: ids };
}
function _caPlantillaElegida(arr) {
  var d = _caPlantillasConDatos(arr);
  var p = d.lista.find(function (x) { return x.id === _ca.plantillaId; });
  if (!p) p = d.lista.find(function (x) { return x.principal && d.conteo[x.id]; }) || d.lista.slice().sort(function (a, b) { return (d.conteo[b.id] || 0) - (d.conteo[a.id] || 0); })[0] || null;
  return { p: p, lista: d.lista, conteo: d.conteo };
}
function _caSelectorPlantilla(info, onchange) {
  if (info.lista.length < 2) return info.p ? '<p class="ca-plantilla">Plantilla: <strong>' + esc(info.p.nombre) + (info.p.version > 1 ? ' (v' + esc(info.p.version) + ')' : '') + '</strong></p>' : '';
  return '<label class="ca-filtro">Plantilla <select onchange="' + onchange + '(this.value)">' + info.lista.map(function (p) {
    return '<option value="' + p.id + '"' + (info.p && p.id === info.p.id ? ' selected' : '') + '>' + esc(p.nombre) + (p.version > 1 ? ' (v' + esc(p.version) + ')' : '') + (p.activo === false ? ' — inactiva' : '') + '</option>';
  }).join('') + '</select></label>';
}
function caElegirPlantilla(v) { _ca.plantillaId = Number(v) || null; switchCalTab(_ctab); }
function _caDeLaPlantilla(arr, p) { return p ? arr.filter(function (m) { var q = caPlantillaDe(m, _caPlantillas()); return q && q.id === p.id; }) : arr; }
function _caTieneNo(m) { var a = m.answers || {}; return Object.keys(a).some(function (n) { return a[n] === 'NO'; }); }
function _caPill(c) { return '<span class="cc2-pill cc2-' + esc(c.k) + '">' + esc(c.t) + '</span>'; }
function _caPct(n) { return n === null || n === undefined ? '—' : n + '%'; }

function caKpisHtml(k) {
  return '<div class="ca-kpis">' +
    '<div class="ca-kpi"><b>' + k.total + '</b><span>Monitoreos calificados</span></div>' +
    '<div class="ca-kpi"><b class="cc2-c-' + k.clase.k + '">' + _caPct(k.promedio) + '</b><span>Promedio general</span></div>' +
    '<div class="ca-kpi"><b>' + k.criticosAbsolutos + '</b><span>Críticos absolutos</span></div>' +
    '<div class="ca-kpi"><b>' + k.asesores + '</b><span>Asesores evaluados</span></div></div>';
}

// Items mas afectados: barra por item y, al abrirlo, los asesores que lo fallaron.
function caAfectadosHtml(arr, p, conNombres) {
  if (!p || !arr.length) return '';
  var lista = caItemsAfectados(arr, p.items).filter(function (x) { return x.fallos > 0; });
  if (!lista.length) return '<div class="aurora-card"><div class="aurora-card-title">Ítems más afectados</div><p class="ca-vacio">Ningún ítem fallado en el periodo.</p></div>';
  return '<div class="aurora-card"><div class="aurora-card-title">Ítems más afectados</div><div class="ca-barras">' + lista.map(function (x) {
    var cuerpo = '<span class="ca-bar-txt">' + esc(x.it.n + '. ' + x.it.label) + (x.it.critico ? ' ⚠' : '') + '</span><span class="ca-bar"><span style="width:' + Math.max(2, x.pct) + '%"></span></span><span class="ca-bar-n">' + x.fallos + ' · ' + x.pct + '%</span>';
    if (!conNombres) return '<div class="ca-bar-fila">' + cuerpo + '</div>';
    return '<details class="ca-bar-fila"><summary>' + cuerpo + '</summary><ul>' + x.asesores.map(function (a) { return '<li>' + esc(textoFormatoNombre(a.asesor)) + ' <span>(' + a.veces + ')</span></li>'; }).join('') + '</ul></details>';
  }).join('') + '</div></div>';
}

function caRenderResumen() {
  var host = document.getElementById('ca-resumen');
  var tbl = document.getElementById('cal-resumen-table');
  if (!host || !tbl) return;
  var todos = _caMonitoreosMes();
  var info = _caPlantillaElegida(todos);
  var arr = _caDeLaPlantilla(todos, info.p);
  host.innerHTML = '<div class="ca-filtros">' + _caSelectorPlantilla(info, 'caElegirPlantilla') + '</div>' + caKpisHtml(caKpis(arr));
  // Fase 323: plantilla por descuento (SURA): # monitoreos, promedio, clasificacion, en 0 %, mejor y peor.
  if (info.p && info.p.engine === 'descuento') { tbl.innerHTML = caResumenDescuentoHtml(caResumenDescuento(arr)); var afd = document.getElementById('ca-afectados'); if (afd) afd.innerHTML = caAfectadosHtml(arr, info.p, true); return; }
  var filas = caResumenAsesores(arr);
  var html = '<tr><th>#</th><th>Asesor</th><th>Monitoreos</th><th>Promedio</th><th>Clasificación</th><th>Fallos críticos</th><th>Alerta</th></tr>';
  if (!filas.length) html += '<tr><td colspan="7" class="ca-vacio">No hay monitoreos en el periodo' + (_cmesFiltro ? ' (' + esc(typeof mesNombreLargo === 'function' ? mesNombreLargo(_cmesFiltro) : _cmesFiltro) + ')' : '') + '.</td></tr>';
  filas.forEach(function (f, i) {
    html += '<tr class="ca-click" tabindex="0" role="button" aria-label="Ver los monitoreos de ' + esc(textoFormatoNombre(f.asesor)) + '" onclick="caVerAsesor(this.dataset.a)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();caVerAsesor(this.dataset.a)}" data-a="' + esc(f.asesor) + '">' +
      '<td>' + (i + 1) + '</td><td><b>' + esc(textoFormatoNombre(f.asesor)) + '</b></td><td>' + f.monitoreos + '</td><td>' + _caPct(f.promedio) + '</td><td>' + _caPill(f.clase) + '</td><td>' + f.fallos + '</td><td>' + _caPill(f.alerta) + '</td></tr>';
  });
  tbl.innerHTML = html;
  var af = document.getElementById('ca-afectados');
  if (af) af.innerHTML = caAfectadosHtml(arr, info.p, true);
}
// Fase 323: tabla del resumen por asesor de una plantilla por descuento (SURA).
function caResumenDescuentoHtml(filas) {
  var html = '<tr><th>#</th><th>Asesor</th><th>Monitoreos</th><th>Promedio</th><th>Clasificación</th><th>En 0 %</th><th>Mejor</th><th>Peor</th></tr>';
  if (!filas.length) html += '<tr><td colspan="8" class="ca-vacio">No hay monitoreos en el periodo' + (_cmesFiltro ? ' (' + esc(typeof mesNombreLargo === 'function' ? mesNombreLargo(_cmesFiltro) : _cmesFiltro) + ')' : '') + '.</td></tr>';
  filas.forEach(function (f, i) {
    html += '<tr class="ca-click" tabindex="0" role="button" aria-label="Ver los monitoreos de ' + esc(textoFormatoNombre(f.asesor)) + '" onclick="caVerAsesor(this.dataset.a)" onkeydown="caTeclaFila(event, this)" data-a="' + esc(f.asesor) + '">' +
      '<td>' + (i + 1) + '</td><td><b>' + esc(textoFormatoNombre(f.asesor)) + '</b></td><td>' + f.monitoreos + '</td><td>' + _caPct(f.promedio) + '</td><td>' + _caPill(f.clase) + '</td><td>' + f.enCero + '</td><td>' + _caPct(f.mejor) + '</td><td>' + _caPct(f.peor) + '</td></tr>';
  });
  return html;
}
function caTeclaFila(e, el) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); caVerAsesor(el.dataset.a); } }
function caVerAsesor(nombre) { _ca.detalleTexto = nombre || ''; switchCalTab('detalle'); }

function caRenderDetalle() {
  var host = document.getElementById('ca-detalle'); if (!host) return;
  var lista = caFiltrar(calMonModulo(_ccampana), _cmesFiltro, _ca.detalleTexto);
  var k = caKpis(lista);
  var corte = clCortar('det', lista); // Fase 348 (C1): de a 10 (o 20); los KPIs cuentan todos
  var filas = corte.filas.map(function (m) {
    var c = caClase(Number(m.puntaje));
    var mot = (m.extras && m.extras.motivo) || '';
    return '<tr class="ca-click" tabindex="0" role="button" aria-label="Ver el detalle del monitoreo de ' + esc(textoFormatoNombre(m.asesor)) + '" onclick="caVerMonitoreo(' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();caVerMonitoreo(' + m.id + ')}">' +
      '<td>' + esc(m.fecha || '-') + '</td><td><b>' + esc(textoFormatoNombre(m.asesor)) + '</b></td><td>' + esc(m.idLlamada || '-') + '</td><td>' + esc(m.codificacion || '-') + '</td><td>' + esc(m.evaluador || '-') + '</td>' +
      '<td><span class="cc2-pill cc2-' + c.k + '">' + _caPct(m.puntaje) + '</span></td><td class="ca-mot">' + esc(mot || (_caTieneNo(m) ? '' : 'Sin afectaciones')) + '</td></tr>';
  }).join('');
  host.innerHTML =
    '<div class="ca-filtros"><label class="ca-filtro">Buscar asesor <input type="search" id="ca-detalle-q" value="' + esc(_ca.detalleTexto) + '" placeholder="Nombre del asesor" oninput="_ca.detalleTexto=this.value;caRenderDetalleTabla()"></label>' +
      (_ca.detalleTexto ? '<button type="button" class="btn-cancel ca-limpiar" onclick="_ca.detalleTexto=\'\';caRenderDetalle()">Ver todos</button>' : '') + '</div>' +
    '<div class="ca-kpis">' +
      '<div class="ca-kpi"><b>' + k.total + '</b><span>Monitoreos</span></div>' +
      '<div class="ca-kpi"><b class="cc2-c-' + k.clase.k + '">' + _caPct(k.promedio) + '</b><span>Calificación definitiva</span></div>' +
      '<div class="ca-kpi"><b>' + esc(k.total ? k.clase.t : '—') + '</b><span>Clasificación</span></div></div>' +
    '<div style="overflow-x:auto"><table class="aurora-rank-table" id="ca-detalle-tabla"><tr><th>Fecha</th><th>Asesor</th><th>ID llamada</th><th>Código</th><th>Evaluador</th><th>Nota</th><th>Motivo de afectación</th></tr>' +
      (filas || '<tr><td colspan="7" class="ca-vacio">No hay monitoreos con ese filtro.</td></tr>') + '</table></div>' +
    clPieHtml('det', corte.pg);
}
clRegistrar('det', function () { caRenderDetalle(); });
// Al escribir en el buscador solo se repinta la tabla (no se pierde el foco).
var _caDetTimer = null;
function caRenderDetalleTabla() {
  clearTimeout(_caDetTimer);
  _caDetTimer = setTimeout(function () {
    var q = document.getElementById('ca-detalle-q');
    var pos = q ? q.selectionStart : null;
    caRenderDetalle();
    var q2 = document.getElementById('ca-detalle-q');
    if (q2) { q2.focus(); if (pos !== null) q2.setSelectionRange(pos, pos); }
  }, 200);
}

// Detalle de un monitoreo: cada item con su respuesta, motivo y observaciones.
function caDetalleHtml(m, p) {
  var c = caClase(Number(m.puntaje));
  var ex = m.extras || {};
  var datos = [['Fecha', m.fecha], ['Asesor', textoFormatoNombre(m.asesor)], ['Evaluador', m.evaluador], ['ID llamada', m.idLlamada], ['Código', m.codificacion],
    ['Placa', ex.placa], ['Tipo de llamada', ex.tipoLlamada], ['ID de agente', ex.idAgente]].filter(function (d) { return d[1]; });
  var items = (p && p.items) || [];
  return '<div class="ca-det-cab"><span class="cc2-big cc2-c-' + c.k + '">' + _caPct(m.puntaje) + '</span>' + _caPill(c) + (m.fallos ? ' ' + _caPill(cc2Alerta(m.fallos)) : '') + '</div>' +
    '<dl class="ca-det-datos">' + datos.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' +
    (items.length ? '<div class="ca-det-wrap"><table class="aurora-rank-table ca-det-items"><tr><th>#</th><th>Ítem</th><th>Respuesta</th></tr>' + items.map(function (it) {
      var v = (m.answers || {})[it.n] || '—';
      return '<tr' + (v === 'NO' ? ' class="ca-det-no"' : '') + '><td>' + esc(it.n) + '</td><td>' + esc(it.label) + (it.critico ? ' ⚠' : '') + '</td><td><b>' + esc(v) + '</b></td></tr>';
    }).join('') + '</table></div>' : '') +
    (ex.motivo ? '<p><strong>Motivo de afectación:</strong> ' + esc(ex.motivo) + '</p>' : '') +
    (m.observaciones ? '<p><strong>Observaciones:</strong> ' + esc(m.observaciones) + '</p>' : '');
}
function caVerMonitoreo(id) {
  var m = (calMonModulo(_ccampana)).find(function (x) { return x.id === id; });
  if (!m) return;
  document.getElementById('ca-ov-detalle-t').textContent = 'Monitoreo de ' + textoFormatoNombre(m.asesor);
  document.getElementById('ca-ov-detalle-b').innerHTML = caDetalleHtml(m, caPlantillaDe(m, _caPlantillas()));
  _cc2AbrirDialogo('ca-ov-detalle');
}

function caDiccionarioHtml(p) {
  if (!p) return '<p class="ca-vacio">Esta campaña no tiene plantilla.</p>';
  return '<div class="ca-reglas">' + caReglasDiccionario(p).map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('') + '</div>' +
    cc2PorCategoria(p.items).map(function (g) {
      return '<h4 class="cc2-cat">' + esc(g.cat) + '</h4>' + g.items.map(function (it) {
        // Fase 324 (motor descuento): afectacion maxima, como la matriz de SURA, y la descripcion con sus saltos de linea.
        var desc = p.engine === 'descuento';
        var afecta = desc ? ' <span class="cc2-pill' + (it.critico ? ' cc2-bad' : '') + '">Afectación máxima ' + (it.critico ? '100' : esc(it.weight)) + ' %</span>' : '';
        return '<article class="ca-dcard"><div><h5><span class="cc2-num">' + esc(it.n) + '</span> ' + esc(it.label) + (it.critico ? ' <span class="cc2-pill cc2-bad">⚠ Crítico</span>' : '') + afecta + '</h5>' +
          (it.descripcion ? '<p' + (desc ? ' class="ca-desc-lineas"' : '') + '>' + esc(it.descripcion) + '</p>' : '<p class="ca-vacio">Sin descripción.</p>') +
          (it.vinetas && it.vinetas.length ? '<ul>' + it.vinetas.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
          '<div class="ca-imp"><span class="cc2-tag">Impacto en la nota</span>' + caImpacto(it, p.engine).map(function (x) { return '<div><span>' + x[0] + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div></article>';
      }).join('');
    }).join('');
}
function caRenderDiccionario() {
  var host = document.getElementById('ca-diccionario'); if (!host) return;
  var lista = _caPlantillas().filter(function (p) { return p.campana === _ccampana && p.activo !== false; });
  var p = lista.find(function (x) { return x.id === _ca.plantillaId; }) || lista.find(function (x) { return x.principal; }) || lista[0] || null;
  host.innerHTML = '<div class="ca-filtros">' + _caSelectorPlantilla({ lista: lista, p: p }, 'caElegirPlantilla') + '</div>' + caDiccionarioHtml(p);
}
