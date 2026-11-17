// reporte-pdf-logic.js — Fase 355: «Exportar PDF» del mes elegido en Hospital La María
// (cada sede y «Datos anteriores»). Lógica pura, sin DOM: quién ve el botón, en qué
// tableros aplica, los meses con datos, los indicadores del mes y el HTML del documento.
// La interfaz (botón, elegir el mes, gráficas, ventana de impresión) vive en reporte-pdf.js.
// Los cálculos son los mismos del tablero (trafico-logic.js / trafico-whatsapp-logic.js):
// se suma primero y el % se calcula después; nunca se promedian porcentajes.
'use strict';

var _rpTL = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
  ? require('./trafico-logic.js') : null;
var _rpWL = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
  ? require('./trafico-whatsapp-logic.js') : null;
function _rpFn(nombre, mod) {
  if (mod && typeof mod[nombre] === 'function') return mod[nombre];
  if (typeof globalThis !== 'undefined' && typeof globalThis[nombre] === 'function') return globalThis[nombre];
  return null;
}

// Roles que ven el botón (pedido del usuario, 17/11/2026): ADMIN, REPORTES y el cliente.
// El supervisor y Calidad no lo ven por ahora.
var REPORTE_PDF_ROLES = ['ADMIN', 'REPORTES', 'CLIENTES_DASH'];

function reportePdfPuedeVer(rol, esAdmin) {
  if (esAdmin) return true;
  return REPORTE_PDF_ROLES.indexOf(rol) !== -1;
}

// Aplica en los tableros de un cliente con sedes: cada sede y el padre («Datos anteriores» /
// «Sin sede»). Hoy solo Hospital La María tiene sedes.
function reportePdfAplica(registro, cliente) {
  var reg = registro || [];
  var c = reg.find(function (x) { return x && x.nombre === cliente; });
  if (!c) return false;
  var p = c.parametros || {};
  if (typeof p.sedeDe === 'string' && p.sedeDe) return true;
  return Array.isArray(p.sedes) && p.sedes.some(function (s) { return s && typeof s === 'object' && s.campana; });
}

var _RP_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function reportePdfMesLargo(mes) {
  var m = /^(\d{4})-(\d{2})$/.exec(mes || '');
  if (!m) return String(mes || '');
  var n = _RP_MESES[Number(m[2]) - 1];
  return n ? n.charAt(0).toUpperCase() + n.slice(1) + ' ' + m[1] : String(mes);
}

// Meses (YYYY-MM) con datos de llamadas o de chats, del más reciente al más viejo.
function reportePdfMeses(filasLlamadas, filasWpp) {
  var visto = {};
  (filasLlamadas || []).forEach(function (f) { if (f && typeof f.fecha === 'string' && f.fecha.length >= 7) visto[f.fecha.slice(0, 7)] = true; });
  (filasWpp || []).forEach(function (f) { if (f && typeof f.fechaInicio === 'string' && f.fechaInicio.length >= 7) visto[f.fechaInicio.slice(0, 7)] = true; });
  return Object.keys(visto).filter(function (m) { return /^\d{4}-\d{2}$/.test(m); }).sort().reverse();
}

// Sin meses con datos (una sede recién creada): el mes actual y los 5 anteriores, para que
// el PDF diga claramente «sin datos» en vez de no dejar exportar.
function reportePdfMesesSinDatos(hoy) {
  var d = hoy instanceof Date ? hoy : new Date();
  var y = d.getFullYear(), m = d.getMonth();
  var out = [];
  for (var k = 0; k < 6; k++) {
    var mm = m - k, yy = y;
    while (mm < 0) { mm += 12; yy -= 1; }
    out.push(yy + '-' + (mm < 9 ? '0' : '') + (mm + 1));
  }
  return out;
}

function _rp1(n) { return n === null || n === undefined || isNaN(n) ? null : Math.round(n * 10) / 10; }

// Indicadores del mes. Llamadas: filas diarias de /calidad/nivel-servicio/diario.
// WhatsApp: filas de /calidad/trafico/whatsapp. Total: suma de los dos canales de entrada.
function reportePdfIndicadores(filasLlamadas, filasWpp, mes) {
  var llam = (filasLlamadas || []).filter(function (f) { return f && typeof f.fecha === 'string' && f.fecha.slice(0, 7) === mes; });
  var wpp = (filasWpp || []).filter(function (f) { return f && typeof f.fechaInicio === 'string' && f.fechaInicio.slice(0, 7) === mes; });

  var abandDe = _rpFn('traficoAbandonadasDe', _rpTL);
  var pctAtAb = _rpFn('traficoPctAtencionAbandono', _rpTL);
  var slLlam = _rpFn('traficoServiceLevelPromedioPeriodo', _rpTL);
  var slWpp = _rpFn('traficoWppServiceLevelPromedioPeriodo', _rpWL);

  var l = null;
  if (llam.length) {
    var total = llam.reduce(function (a, f) { return a + (Number(f.totalLlamadas) || 0); }, 0);
    var contestadas = llam.reduce(function (a, f) { return a + (Number(f.contestadas) || 0); }, 0);
    var tieneAband = llam.some(function (f) { return f.llamadasAbandonadas != null; });
    var abandonadas = tieneAband ? llam.reduce(function (a, f) { return a + (Number(f.llamadasAbandonadas) || 0); }, 0) : null;
    var abandCalc = abandDe ? llam.reduce(function (a, f) { return a + abandDe(f); }, 0) : (abandonadas || 0);
    var pcts = pctAtAb ? pctAtAb(total, contestadas, abandCalc)
      : { nivelAtencionPct: total > 0 ? contestadas / total * 100 : null, tasaAbandonoPct: total > 0 ? abandCalc / total * 100 : null };
    l = {
      total: total, contestadas: contestadas, abandonadas: abandonadas,
      nivelAtencion: _rp1(pcts.nivelAtencionPct), tasaAbandono: _rp1(pcts.tasaAbandonoPct),
      nivelServicio: slLlam ? slLlam(llam, 'serviceLevel20secPct') : null,
    };
  }

  var w = null;
  if (wpp.length) {
    var tw = wpp.reduce(function (a, f) { return a + (Number(f.totalWhatsapp) || 0); }, 0);
    var cw = wpp.reduce(function (a, f) { return a + (Number(f.contestados) || 0); }, 0);
    var tieneAbW = wpp.some(function (f) { return f.abandonados != null; });
    var aw = tieneAbW ? wpp.reduce(function (a, f) { return a + (Number(f.abandonados) || 0); }, 0) : null;
    w = {
      total: tw, contestadas: cw, abandonadas: aw,
      nivelAtencion: tw > 0 ? Math.round(cw / tw * 1000) / 10 : null,
      tasaAbandono: tw > 0 && tieneAbW ? Math.round(aw / tw * 1000) / 10 : null,
      nivelServicio: slWpp ? slWpp(wpp, 'serviceLevel20secPct') : null,
    };
  }

  var t = null;
  if (l || w) {
    var ing = (l ? l.total : 0) + (w ? w.total : 0);
    var con = (l ? l.contestadas : 0) + (w ? w.contestadas : 0);
    t = { ingresados: ing, contestados: con, nivelAtencion: ing > 0 ? Math.round(con / ing * 1000) / 10 : null };
  }
  return { mes: mes, llamadas: l, whatsapp: w, total: t };
}

// Serie diaria del mes para las gráficas (total y contestadas por día). WhatsApp con filas
// de periodo (varios días en una fila) queda como un solo punto con el mes: nunca se reparte.
function reportePdfSerieDiaria(filas, mes, campoFecha, campoTotal, campoContestadas) {
  var porDia = {};
  var orden = [];
  (filas || []).forEach(function (f) {
    var fe = f && f[campoFecha];
    if (typeof fe !== 'string' || fe.slice(0, 7) !== mes) return;
    var esDia = campoFecha !== 'fechaInicio' || (f.fechaFin && f.fechaFin === f.fechaInicio);
    var k = esDia ? fe.slice(0, 10) : mes;
    if (!porDia[k]) { porDia[k] = { periodo: k, total: 0, contestadas: 0 }; orden.push(k); }
    porDia[k].total += Number(f[campoTotal]) || 0;
    porDia[k].contestadas += Number(f[campoContestadas]) || 0;
  });
  return orden.sort().map(function (k) { return porDia[k]; });
}

function _rpEsc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function reportePdfNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-CO');
}
function reportePdfPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %';
}

function _rpTarjetas(items) {
  return '<div class="kpis">' + items.map(function (it) {
    return '<div class="kpi"><div class="v">' + _rpEsc(it.valor) + '</div><div class="l">' + _rpEsc(it.etiqueta) + '</div></div>';
  }).join('') + '</div>';
}
function _rpGrafica(img, alt) {
  return img ? '<img class="graf" src="' + _rpEsc(img) + '" alt="' + _rpEsc(alt) + '">' : '';
}
function _rpCanal(titulo, k, etq, img) {
  var cuerpo = !k
    ? '<p class="vacio">Sin datos de ' + _rpEsc(etq.nombre) + ' cargados para este mes.</p>'
    : _rpTarjetas([
      { valor: reportePdfNum(k.total), etiqueta: etq.total },
      { valor: reportePdfNum(k.contestadas), etiqueta: etq.contestadas },
      { valor: reportePdfNum(k.abandonadas), etiqueta: etq.abandonadas },
      { valor: reportePdfPct(k.nivelServicio), etiqueta: 'Nivel de servicio (20 s)' },
      { valor: reportePdfPct(k.nivelAtencion), etiqueta: 'Nivel de atención' },
      { valor: reportePdfPct(k.tasaAbandono), etiqueta: 'Tasa de abandono' },
    ]) + _rpGrafica(img, titulo);
  return '<section><h2>' + _rpEsc(titulo) + '</h2>' + cuerpo + '</section>';
}

// HTML completo del documento para «Guardar como PDF». Todo texto pasa por _rpEsc.
// opts: { campana, etiqueta, mes, logoUrl, ind, graficas: {llamadas, whatsapp, total}, generado, demo }
function reportePdfPrintHtml(opts) {
  var o = opts || {};
  var ind = o.ind || {};
  var g = o.graficas || {};
  var mesLbl = reportePdfMesLargo(o.mes);
  var titulo = (o.campana || '') + (o.etiqueta ? ' · ' + o.etiqueta : '');
  var aviso = o.demo
    ? '<div class="demo">⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
    : '';
  var t = ind.total;
  var totalHtml = '<section><h2>Total tráfico</h2>' + (!t
    ? '<p class="vacio">Sin tráfico cargado para este mes.</p>'
    : _rpTarjetas([
      { valor: reportePdfNum(t.ingresados), etiqueta: 'Total ingresados (llamadas + WhatsApp)' },
      { valor: reportePdfNum(t.contestados), etiqueta: 'Total contestados' },
      { valor: reportePdfPct(t.nivelAtencion), etiqueta: 'Nivel de atención total' },
    ]) + _rpGrafica(g.total, 'Total tráfico')) + '</section>';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + _rpEsc(titulo + ' — ' + mesLbl) + '</title>' +
    '<style>' +
    '@page{size:A4;margin:14mm}' +
    'body{font-family:Segoe UI,system-ui,sans-serif;color:#1f3a46;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #0d4a5e;padding-bottom:12px;margin-bottom:18px}' +
    'header img{height:40px}h1{color:#0d4a5e;font-size:20px;margin:0}.mes{margin:4px 0 0;color:#40606e;font-size:13px}' +
    'h2{color:#0d4a5e;font-size:15px;margin:18px 0 8px}section{break-inside:avoid;page-break-inside:avoid}' +
    '.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}' +
    '.kpi{border:1px solid #c9dbe3;border-left:4px solid #0d4a5e;border-radius:6px;padding:8px 10px}' +
    '.kpi .v{font-size:18px;font-weight:700;color:#0d4a5e}.kpi .l{font-size:11px;color:#40606e}' +
    '.graf{width:100%;max-height:260px;object-fit:contain;margin:4px 0 6px}' +
    '.vacio{color:#5b6f78;font-style:italic;margin:4px 0 10px}' +
    '.demo{background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:14px}' +
    'footer{margin-top:22px;color:#5b6f78;font-size:10px;border-top:1px solid #c9dbe3;padding-top:6px}' +
    '</style></head><body>' + aviso +
    '<header><div><h1>' + _rpEsc(titulo) + '</h1><p class="mes">Informe de ' + _rpEsc(mesLbl) + '</p></div>' +
    (o.logoUrl ? '<img src="' + _rpEsc(o.logoUrl) + '" alt="InConexion">' : '') + '</header>' +
    _rpCanal('Tráfico de Llamadas', ind.llamadas, { nombre: 'llamadas', total: 'Total de llamadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas' }, g.llamadas) +
    _rpCanal('Tráfico de WhatsApp', ind.whatsapp, { nombre: 'WhatsApp', total: 'Total de WhatsApp', contestadas: 'WhatsApp contestados', abandonadas: 'WhatsApp abandonados' }, g.whatsapp) +
    totalHtml +
    '<section><h2>Tipificación</h2><p class="vacio">Tipificación: sin datos cargados.</p></section>' +
    '<footer>Generado por InConexion Platform — ' + _rpEsc(o.generado || '') + '</footer>' +
    '</body></html>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REPORTE_PDF_ROLES: REPORTE_PDF_ROLES,
    reportePdfPuedeVer: reportePdfPuedeVer, reportePdfAplica: reportePdfAplica,
    reportePdfMeses: reportePdfMeses, reportePdfMesesSinDatos: reportePdfMesesSinDatos, reportePdfMesLargo: reportePdfMesLargo,
    reportePdfIndicadores: reportePdfIndicadores, reportePdfSerieDiaria: reportePdfSerieDiaria,
    reportePdfPrintHtml: reportePdfPrintHtml, reportePdfNum: reportePdfNum, reportePdfPct: reportePdfPct,
  };
}
