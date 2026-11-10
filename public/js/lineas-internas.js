// lineas-internas.js — Fase 311 (10/11/2026, Clinica Aurora): pestaña «Gestión
// líneas internas» -- 3 graficas, una debajo de otra:
//   aurora_li_flujo_panel    -> barras Total / Contestadas / Abandonadas + Nivel
//                               de servicio (%), con botones por area (estilo Agendas).
//   aurora_li_cdr_panel      -> torta de tipificacion de llamadas (como la de
//                               Tipificación), filtros agente / skill / tipo.
//   aurora_li_whatsapp_panel -> torta de tipificacion de WhatsApp, filtros agente / skill.
// Logica en lineas-internas-logic.js; los datos vienen de las rutas de
// aurora-bases (server/aurora-bases.js, tipos flujo_li / cdr_li / whatsapp_li).
// Siguen el filtro MESES de arriba. Nada de esto toca las demas pestañas.
var LI_PANEL_TIPO = { aurora_li_flujo_panel: 'flujo_li', aurora_li_cdr_panel: 'cdr_li', aurora_li_whatsapp_panel: 'whatsapp_li' };
var _liCache = {}; // por campaña: { flujo_li: { filas }, ... }
var _liEstado = {}; // por panel i: { skill, agente, tipo }

async function _liCargar(tipo, camp) {
  var c = _liCache[camp] || (_liCache[camp] = {});
  if (c[tipo]) return c[tipo];
  var r = await apiRequest('GET', AB_RUTA[tipo] + '/datos?campana=' + encodeURIComponent(camp));
  c[tipo] = { filas: (r && r.filas) || [] };
  return c[tipo];
}
function _liMeses() { return (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : []; }
function _liOscuro() { return typeof temaActual === 'function' && temaActual() === 'dark'; }
function _liVar(nombre, defecto) {
  try { var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim(); return v || defecto; } catch (e) { return defecto; }
}
function _liFmtN(v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO'); }
function _liFmtPct(v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
function _liEstadoDe(i) { return _liEstado[i] || (_liEstado[i] = { skill: '', agente: '', tipo: '' }); }
function _liCaja(titulo, cuerpo) { return '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div>' + cuerpo + '</div>'; }
function _liPendiente(que, interno) {
  return typeof avisoPendienteHtml === 'function' ? avisoPendienteHtml(que, interno) : '<div class="gd-vacio" role="status">' + esc(interno) + '</div>';
}

async function _liRender(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente, tipo = LI_PANEL_TIPO[p.tipo];
  el.dataset.campana = camp; el.dataset.liTipo = tipo;
  var titulo = p.titulo || '';
  var datos;
  try { datos = await _liCargar(tipo, camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) {
    var nombre = AB_LI[tipo].nombre;
    el.innerHTML = _liCaja(titulo, _liPendiente(titulo, 'Todavía no hay base de ' + esc(nombre.toLowerCase()) + '. Súbela en Cargar datos › ' + esc(camp) + ' › ' + esc(nombre) + ' › Subir.'));
    return;
  }
  if (tipo === 'flujo_li') _liRenderFlujo(el, p, i, datos); else _liRenderTorta(el, p, i, datos, tipo);
  _liEnlazar(el, p, i);
}

function _liBotones(lista, activa, i) {
  return '<div class="gd-subtabs au-ag-botones" role="group" aria-label="Área">' + lista.map(function (b) {
    var on = b.v === activa;
    return '<button type="button" class="gd-subtab-btn' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-li-skill="' + esc(b.v) + '" data-i="' + i + '">' +
      esc(b.t) + (b.conDatos ? '' : ' <span class="li-sin-datos">(sin datos)</span>') + '</button>';
  }).join('') + '</div>';
}

// ── A) Flujo de llamadas ──
function _liRenderFlujo(el, p, i, datos) {
  var st = _liEstadoDe(i), meses = _liMeses();
  var botones = liBotonesFlujo(datos.filas, meses);
  if (!botones.some(function (b) { return b.v === st.skill; })) st.skill = '';
  var serie = liFlujoSerie(datos.filas, meses, st.skill);
  var r = serie.resumen;
  var kpi = function (v, l) { return '<div class="aurora-kpi"><div class="kv">' + v + '</div><div class="kl">' + l + '</div></div>'; };
  var cuerpo;
  if (!serie.puntos.length) {
    cuerpo = '<div class="gd-vacio" role="status">Sin datos de esta área para los meses elegidos.</div>';
  } else {
    var alto = (typeof window !== 'undefined' && window.innerWidth < 600) ? 380 : 360;
    cuerpo = '<div class="aurora-kpis li-kpis">' + kpi(_liFmtN(r.total), 'Total de llamadas') + kpi(_liFmtN(r.contestadas), 'Contestadas') +
      kpi(_liFmtN(r.abandonadas), 'Abandonadas') + kpi(r.nivelServicio === null ? '—' : _liFmtPct(r.nivelServicio), 'Nivel de servicio') + '</div>' +
      '<p class="ab-nota">' + (serie.porArea ? 'Una barra por área.' : 'Una barra por día.') + ' Nivel de servicio: promedio simple de SERVICE_LEVEL_20SEC de Wolkvox (llamadas contestadas en los primeros 20 segundos), igual que en Tráfico de Llamadas.</p>' +
      '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-li-flujo"></canvas></div>';
  }
  el.innerHTML = gdGraficaHtml(esc(p.titulo || 'Flujo de llamadas'), '<div class="li-botones">' + _liBotones(botones, st.skill, i) + '</div>' + cuerpo, { destacado: true });
  if (!serie.puntos.length) return;
  var oscuro = _liOscuro();
  var cTotal = auColorAgendas('total', oscuro), cCont = auColorAgendas('citas', oscuro);
  var cAb = _liVar('--c-danger', '#e74c3c'), cNs = _liVar('--c-success-text', '#17703b');
  if (oscuro) cNs = _liVar('--c-success', '#4ade80');
  var etiquetas = serie.puntos.map(function (x) { return serie.porArea ? x.etiqueta : (typeof _abFechaCorta === 'function' ? _abFechaCorta(x.etiqueta) : x.etiqueta); });
  if (serie.porArea && typeof auPartirEtiqueta === 'function') etiquetas = etiquetas.map(function (t) { return auPartirEtiqueta(t, 14); });
  var o = loBar(null);
  o.plugins.legend = { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 10, padding: 8 } };
  o.plugins.datalabels = Object.assign({}, o.plugins.datalabels, { display: serie.puntos.length <= 12 ? 'auto' : false,
    formatter: function (v, ctx) { return ctx.dataset.yAxisID === 'y2' ? _liFmtPct(v) : _liFmtN(v); },
    color: function (ctx) { return ctx.dataset.borderColor; } });
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.dataset.yAxisID === 'y2' ? _liFmtPct(ctx.parsed.y) : _liFmtN(ctx.parsed.y)); } } };
  o.scales.y = Object.assign({}, o.scales.y, { beginAtZero: true, grace: '12%', title: { display: true, text: 'Llamadas', color: o.scales.y.ticks.color } });
  o.scales.y2 = { position: 'right', beginAtZero: true, min: 0, max: 100, grid: { display: false },
    ticks: { font: { size: 12 }, color: o.scales.y.ticks.color, callback: function (v) { return v + ' %'; } },
    title: { display: true, text: 'Nivel de servicio', color: o.scales.y.ticks.color } };
  o.layout = { padding: { top: 22, left: 4, right: 4 } };
  _gdChart('gd-c' + i + '-li-flujo', { type: 'bar', data: { labels: etiquetas, datasets: [
    { label: 'Total de llamadas', data: serie.puntos.map(function (x) { return x.total; }), backgroundColor: cTotal, borderColor: cTotal, maxBarThickness: 36, order: 2 },
    { label: 'Contestadas', data: serie.puntos.map(function (x) { return x.contestadas; }), backgroundColor: cCont, borderColor: cCont, maxBarThickness: 36, order: 2 },
    { label: 'Abandonadas', data: serie.puntos.map(function (x) { return x.abandonadas; }), backgroundColor: cAb, borderColor: cAb, maxBarThickness: 36, order: 2 },
    { label: 'Nivel de servicio (%)', type: 'line', yAxisID: 'y2', data: serie.puntos.map(function (x) { return x.nivelServicio; }), borderColor: cNs, backgroundColor: cNs, pointBackgroundColor: cNs, pointStyle: 'rectRot', pointRadius: 6, borderWidth: 2.5, tension: 0.2, spanGaps: true, order: 1 },
  ] }, options: o });
}

function _liSelect(campo, etiqueta, opciones, valor, i, todos) {
  return '<div class="au-filtro"><label for="li-f-' + campo + '-' + i + '">' + esc(etiqueta) + '</label><select id="li-f-' + campo + '-' + i + '" data-li-campo="' + campo + '" data-i="' + i + '"><option value="">' + esc(todos || 'Todos') + '</option>' +
    opciones.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === valor ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select></div>';
}

// ── B) y C) Tortas de tipificacion ──
function _liRenderTorta(el, p, i, datos, tipo) {
  var st = _liEstadoDe(i), meses = _liMeses(), esCdr = tipo === 'cdr_li';
  var filtro = { agente: st.agente, skill: st.skill, tipo: esCdr ? st.tipo : '' };
  // Lo elegido se conserva aunque no tenga datos con los demas filtros (la torta
  // dice entonces «Sin llamadas de salida», etc.), en vez de limpiarse solo.
  var opc = function (c) {
    var l = liOpciones(datos.filas, meses, filtro, c);
    if (filtro[c] && !l.some(function (o) { return o.v === filtro[c]; })) l.push({ v: filtro[c], t: c === 'skill' ? liNombreSkill(filtro[c]) : filtro[c] });
    return l;
  };
  var filtros = '<div class="au-filtros li-filtros">' +
    _liSelect('agente', 'Agente', opc('agente'), filtro.agente, i) +
    _liSelect('skill', 'Skill', opc('skill'), filtro.skill, i) +
    (esCdr ? _liSelect('tipo', 'Tipo', [{ v: 'entrada', t: 'Entrada' }, { v: 'salida', t: 'Salida' }], filtro.tipo, i, 'Entrada y salida') : '') + '</div>';
  var res = liTorta(datos.filas, meses, filtro);
  var canal = esCdr ? 'Llamadas' : 'WhatsApp';
  var vacio = '';
  if (!res.total) vacio = (esCdr && filtro.tipo === 'salida') ? 'Sin llamadas de salida' + (filtro.agente || filtro.skill ? ' con estos filtros.' : ' en este período.')
    : (esCdr && filtro.tipo === 'entrada') ? 'Sin llamadas de entrada' + (filtro.agente || filtro.skill ? ' con estos filtros.' : ' en este período.')
    : 'Sin registros de ' + canal.toLowerCase() + ' con estos filtros.';
  el.innerHTML = gdGraficaHtml(esc(p.titulo || canal), filtros + (vacio
    ? '<div class="gd-vacio" role="status">' + esc(vacio) + '</div>'
    : '<div class="aurora-chart-wrap li-torta-wrap"><canvas id="gd-c' + i + '-li-torta"></canvas></div>'), { destacado: true });
  if (vacio) return;
  var wrap = el.querySelector('.li-torta-wrap');
  var ancho = (wrap && wrap.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 0);
  var porciones = tipificacionPorcionesTorta(res.todas, tipificacionMaxPorciones(ancho));
  var leyendaAbajo = ancho < 600;
  if (wrap) wrap.style.height = (leyendaAbajo ? 260 + porciones.length * 20 : Math.max(340, porciones.length * 18 + 60)) + 'px';
  var labels = porciones.map(function (r) { return r.esOtras ? r.tipificacion : liEtiquetaTipificacion(r.tipificacion); });
  var propios = paletaColoresSinRepetir(porciones.filter(function (r) { return !r.esOtras; }).map(function (r) { return r.tipificacion; }));
  propios = tipificacionSinRepetirConExtra(propios, typeof PC_EXTRA !== 'undefined' ? PC_EXTRA : []);
  var k = 0;
  var colores = porciones.map(function (r) { return r.esOtras ? '#9aa0a6' : propios[k++]; });
  var o = loPie(canal + ' — ' + res.total.toLocaleString('es-CO') + ' registro(s)');
  if (leyendaAbajo) o.plugins.legend = Object.assign({}, o.plugins.legend, { position: 'bottom' });
  o.plugins.tooltip = { callbacks: {
    label: function (ctx) { return labels[ctx.dataIndex] + ': ' + tipificacionCantidadPct(porciones[ctx.dataIndex].cantidad, res.total); },
    afterLabel: function (ctx) { var r = porciones[ctx.dataIndex]; return r && r.esOtras ? tipificacionLineasOtras(r, res.total, liEtiquetaTipificacion, 15) : ''; },
  } };
  _gdChart('gd-c' + i + '-li-torta', { type: 'pie', data: { labels: labels, datasets: [{ data: porciones.map(function (r) { return r.cantidad; }), backgroundColor: colores,
    verDatosTodas: { filas: res.todas.map(function (r) { return { etiqueta: liEtiquetaTipificacion(r.tipificacion), cantidad: r.cantidad }; }), total: res.total } }] }, options: o });
}

// Botones y filtros: redibujan solo este panel.
function _liEnlazar(el, p, i) {
  el.querySelectorAll('[data-li-skill]').forEach(function (b) {
    b.addEventListener('click', function () { _liEstadoDe(i).skill = b.getAttribute('data-li-skill'); _liRender(p, i); });
  });
  el.querySelectorAll('select[data-li-campo]').forEach(function (s) {
    s.addEventListener('change', function () { _liEstadoDe(i)[s.getAttribute('data-li-campo')] = s.value; _liRender(p, i).then(function () { var n = document.getElementById(s.id); if (n) n.focus(); }); });
  });
}

// Para Exportar del tablero: la tabla de lo que se ve.
function _liFilasExport(i) {
  var host = document.getElementById('gd-p' + i); if (!host) return [];
  var camp = host.dataset.campana, tipo = host.dataset.liTipo, d = (_liCache[camp] || {})[tipo];
  if (!d) return [];
  var st = _liEstadoDe(i), meses = _liMeses();
  if (tipo === 'flujo_li') {
    return liFlujoSerie(d.filas, meses, st.skill).puntos.map(function (x) {
      return { 'Área / día': x.etiqueta, 'Total de llamadas': x.total, Contestadas: x.contestadas, Abandonadas: x.abandonadas, 'Nivel de servicio (%)': x.nivelServicio };
    });
  }
  return liTorta(d.filas, meses, { agente: st.agente, skill: st.skill, tipo: tipo === 'cdr_li' ? st.tipo : '' }).todas
    .map(function (r) { return { 'Tipificación': liEtiquetaTipificacion(r.tipificacion), Cantidad: r.cantidad }; });
}
