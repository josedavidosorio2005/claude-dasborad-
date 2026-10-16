// kpi-tarjeta-logic.js — Fase 152 (B8 + B3): tarjeta KPI ejecutiva.
//
// Logica PURA (sin DOM), doble modo como semaforo-logic.js: global en el
// navegador y require() en Node para las pruebas
// (server/tests/fase152-b8-kpi-tarjeta.test.js).
//
// Una tarjeta tiene: cifra grande, etiqueta (minuscula inicial), y debajo,
// cuando aplica:
//   - variacion contra el mes anterior (flecha + valor). SOLO si el mes
//     anterior tiene datos; nunca un "0 %" inventado. Si el mes elegido es
//     el mes en curso, en su lugar dice "Mes en curso: sin comparación".
//   - meta ("Meta 90 %") con un punto de semaforo y TEXTO ("Cumple la
//     meta"), solo si el indicador tiene umbral configurado (pantalla
//     Umbrales). Sin umbral no hay meta ni semaforo.
'use strict';

var _kpiEsc = (typeof esc === 'function') ? esc : (typeof require === 'function' ? require('./esc.js').esc : function (s) { return String(s); });

function _kpiNum(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

// Numero con coma decimal (es-CO) y a lo sumo `dec` decimales.
function kpiFmtNumero(n, dec) {
  var d = dec === undefined ? 1 : dec;
  var r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  return r.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

// Variacion contra el mes anterior.
//   opts.unidad: 'pct' (el indicador ya es un %: la diferencia va en puntos,
//                "pts") o 'num' (conteo: la diferencia va en %).
//   opts.mejorBaja: true si bajar es bueno (abandono, inasistencia...).
//   opts.mesAnteriorLbl: texto del mes anterior ("agosto").
//   opts.mesEnCurso: true si el mes elegido no ha terminado -> sin variacion.
// Devuelve null si no hay nada que mostrar (sin dato actual o sin mes
// anterior con datos), o { enCurso:true, texto } en el mes en curso.
function kpiVariacion(actual, anterior, opts) {
  var o = opts || {};
  if (o.mesEnCurso) return { enCurso: true, texto: 'Mes en curso: sin comparación' };
  var cur = _kpiNum(actual);
  var prev = _kpiNum(anterior);
  if (cur === null || prev === null) return null;
  var diff = cur - prev;
  var dir = diff > 0 ? 'sube' : diff < 0 ? 'baja' : 'igual';
  var valorTxt;
  if (o.unidad === 'pct') {
    valorTxt = (diff > 0 ? '+' : diff < 0 ? '−' : '') + kpiFmtNumero(Math.abs(diff), 1) + ' pts';
  } else if (prev === 0) {
    valorTxt = (diff > 0 ? '+' : diff < 0 ? '−' : '') + kpiFmtNumero(Math.abs(diff), 0);
  } else {
    valorTxt = (diff > 0 ? '+' : diff < 0 ? '−' : '') + kpiFmtNumero(Math.abs(diff / prev) * 100, 1) + ' %';
  }
  var bueno = dir === 'igual' ? null : (o.mejorBaja ? dir === 'baja' : dir === 'sube');
  return {
    enCurso: false,
    dir: dir,
    bueno: bueno,
    flecha: dir === 'sube' ? '▲' : dir === 'baja' ? '▼' : '→',
    valor: valorTxt,
    contra: o.mesAnteriorLbl ? 'vs. ' + o.mesAnteriorLbl : 'vs. mes anterior',
  };
}

// Meta de un indicador a partir de su umbral { verde, amarillo, direccion }.
// null si no hay umbral (sin meta configurada: sin semaforo).
function kpiMeta(valor, umbral, opts) {
  if (!umbral || _kpiNum(umbral.verde) === null) return null;
  var o = opts || {};
  var sufijo = o.unidad === 'pct' ? ' %' : '';
  var menor = umbral.direccion === 'menor_es_mejor';
  var texto = (menor ? 'Meta máx. ' : 'Meta ') + kpiFmtNumero(Number(umbral.verde), 1) + sufijo;
  var color = null;
  var n = _kpiNum(valor);
  if (n !== null) {
    if (!menor) color = n >= umbral.verde ? 'verde' : (n >= umbral.amarillo ? 'amarillo' : 'rojo');
    else color = n <= umbral.verde ? 'verde' : (n <= umbral.amarillo ? 'amarillo' : 'rojo');
  }
  var estado = color === 'verde' ? 'Cumple la meta' : color === 'amarillo' ? 'Cerca de la meta' : color === 'rojo' ? 'No cumple la meta' : '';
  return { texto: texto, color: color, estado: estado };
}

// Clase de borde de la tarjeta segun el semaforo (misma que antes).
function kpiClaseSemaforo(color) {
  return color === 'verde' ? 'kpi-green' : color === 'amarillo' ? 'kpi-org' : color === 'rojo' ? 'kpi-red' : '';
}

// Tendencia pequena (sparkline): solo con 3 o mas meses con dato. Hoy
// ningun indicador principal los tiene -- queda preparada y apagada
// (KPI_SPARKLINE_ACTIVO), y la tarjeta no la dibuja.
var KPI_SPARKLINE_ACTIVO = false;
var KPI_SPARKLINE_MIN_MESES = 3;
function kpiSparklinePuntos(valores, ancho, alto) {
  var v = (valores || []).map(_kpiNum).filter(function (x) { return x !== null; });
  if (v.length < KPI_SPARKLINE_MIN_MESES) return null;
  var w = ancho || 80;
  var h = alto || 22;
  var min = Math.min.apply(null, v);
  var max = Math.max.apply(null, v);
  var rango = max - min || 1;
  return v.map(function (x, i) {
    var px = Math.round((i / (v.length - 1)) * w * 10) / 10;
    var py = Math.round((h - ((x - min) / rango) * h) * 10) / 10;
    return px + ',' + py;
  }).join(' ');
}

// HTML de la tarjeta. t = { valor (texto ya formateado), etiqueta, notaHtml
// (HTML ya escapado, opcional), cls (clase extra), variacion (de
// kpiVariacion), meta (de kpiMeta), valorPequeno (texto en vez de cifra) }.
function kpiTarjetaHtml(t) {
  var meta = t.meta || null;
  var cls = ['aurora-kpi', 'kpi-ejecutiva'];
  var sem = meta && meta.color ? kpiClaseSemaforo(meta.color) : '';
  if (sem) cls.push(sem); else if (t.cls) cls.push(t.cls);
  var html = '<div class="' + cls.join(' ') + '">' +
    '<div class="kv' + (t.valorPequeno ? ' kv-texto' : '') + '">' + _kpiEsc(t.valor) + '</div>' +
    '<div class="kl">' + _kpiEsc(t.etiqueta) + (t.notaHtml || '') + '</div>';
  var v = t.variacion;
  if (v && v.enCurso) {
    html += '<div class="kpi-var kpi-var-neutra">' + _kpiEsc(v.texto) + '</div>';
  } else if (v) {
    var vcls = v.bueno === null ? 'kpi-var-neutra' : (v.bueno ? 'kpi-var-buena' : 'kpi-var-mala');
    html += '<div class="kpi-var ' + vcls + '"><span aria-hidden="true">' + v.flecha + '</span> ' + _kpiEsc(v.valor) +
      ' <span class="kpi-var-contra">' + _kpiEsc(v.contra) + '</span></div>';
  }
  if (meta) {
    html += '<div class="kpi-meta">' +
      (meta.color ? '<span class="kpi-meta-punto kpi-meta-' + meta.color + '" aria-hidden="true"></span>' : '') +
      '<span>' + _kpiEsc(meta.texto) + (meta.estado ? ' · ' + _kpiEsc(meta.estado) : '') + '</span></div>';
  }
  return html + '</div>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    kpiFmtNumero: kpiFmtNumero,
    kpiVariacion: kpiVariacion,
    kpiMeta: kpiMeta,
    kpiClaseSemaforo: kpiClaseSemaforo,
    kpiSparklinePuntos: kpiSparklinePuntos,
    kpiTarjetaHtml: kpiTarjetaHtml,
    KPI_SPARKLINE_ACTIVO: KPI_SPARKLINE_ACTIVO,
    KPI_SPARKLINE_MIN_MESES: KPI_SPARKLINE_MIN_MESES,
  };
}
