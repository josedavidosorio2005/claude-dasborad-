// calidad-equipo-logic.js — Fase 274 (pedido de Edwin, 06/11). Calculos puros
// de "Resultado de los monitoreos" (pestaña Calidad del dashboard de Mobilize,
// Aurora y HLM) como la vista "Resultados del equipo" del HTML de Edwin
// (Calidad InConexion.html: renderRes, renderResAs, renderDetMes, drawPie,
// klass, fallosOf). Sin DOM. La nota de cada monitoreo ya viene calculada por
// el servidor (monitoreo.puntaje, computeScore de server/calidad-logic.js);
// aqui solo se agrega, igual que el HTML:
//  - solo cuentan los monitoreos con nota (el HTML: r.nota != null);
//  - asesor agrupado sin distinguir mayusculas (r.asesor.toLowerCase());
//  - la tabla va de mayor a menor promedio; la linea por asesor, por nombre;
//  - un item "falla" con NO (en la plantilla de descuento con opciones, con
//    descuento > 0);
//  - modelo de la plantilla: 'weighted' (motor standard de SINCO, el de
//    Mobilize/Aurora/HLM en el HTML) -> "Con fallos en items criticos" y
//    "Fallos criticos"; 'deduct' (SURA en el HTML) -> "Notas en 0%" y "En 0%".
'use strict';

var CE_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// klass() del HTML.
function ceClase(n) {
  if (n === null || n === undefined || isNaN(n)) return { k: 'na', t: 'Incompleto' };
  if (n < 70) return { k: 'bad', t: 'Crítico' };
  if (n < 90) return { k: 'warn', t: 'No crítico' };
  return { k: 'ok', t: 'Sobresaliente' };
}
// pct() del HTML: un decimal con coma; '—' sin dato.
function cePct(n) {
  return n === null || n === undefined || isNaN(n) ? '—' : (Math.round(n * 10) / 10).toString().replace('.', ',') + '%';
}
function ceMesLabel(m) {
  if (m === 'all') return 'Todos los meses';
  var p = String(m || '').split('-');
  return (CE_MESES[+p[1] - 1] || m) + ' ' + p[0];
}
// mesDesc() del HTML.
function ceMesDesc(meses) {
  var a = (meses || []).slice().sort();
  return !a.length ? 'ningún mes' : a.length === 1 ? ceMesLabel(a[0]) : a.length === 2 ? a.map(ceMesLabel).join(' y ') : a.length + ' meses';
}
// motor de SINCO -> modelo del HTML ('sura' = descuento, como SURA en el HTML).
function ceModelo(plantilla) {
  var m = plantilla && (plantilla.motor || plantilla.engine);
  return m === 'sura' || m === 'deduct' || m === 'descuento' ? 'deduct' : 'weighted'; // Fase 322: + motor descuento
}
function _ceNota(m) {
  if (m.puntaje === null || m.puntaje === undefined || m.puntaje === '') return null;
  var n = Number(m.puntaje);
  return isNaN(n) ? null : n;
}
function _ceMes(m) { return String(m.fecha || '').slice(0, 7); }
// fallosOf() del HTML: items criticos en NO.
function ceFallos(m, items) {
  var a = m.answers || {};
  if (!items || !items.length) return Number(m.fallos) || 0;
  return items.filter(function (it) { return it.critico && a[it.n] === 'NO'; }).length;
}
// keyName() del HTML: normName (guion bajo = espacio, espacios simples) en minusculas.
function ceKey(s) { return String(s || '').replace(/_/g, ' ').replace(/s+/g, ' ').trim().toLowerCase(); }
// Fase 322: con opciones, falla la opcion con descuento > 0.
function _ceFalla(m, it) {
  var a = (m.answers || {})[it.n];
  if (it.opciones && it.opciones.length) { var o = it.opciones.filter(function (x) { return x.v === a; })[0]; return !!(o && o.descuento > 0); }
  return a === 'NO';
}

// Meses con monitoreos calificados, del mas nuevo al mas viejo (monthsWithData).
function ceMesesConDatos(monitoreos) {
  var o = {};
  (monitoreos || []).forEach(function (m) { if (_ceNota(m) !== null && m.fecha) o[_ceMes(m)] = true; });
  return Object.keys(o).sort().reverse();
}
// Fase 290 (revision del 07/11, #13): el filtro Mes sin ningun mes marcado ("Ninguno")
// equivale a "Todos", como «Meses» del tablero: todos los meses con monitoreos.
function ceMesesEfectivos(elegidos, monitoreos) {
  return (elegidos && elegidos.length) ? elegidos.slice() : ceMesesConDatos(monitoreos).slice().sort();
}
// Texto del filtro Mes: "Todos" sin ninguno marcado.
function ceMesFiltroDesc(elegidos) { return (elegidos && elegidos.length) ? ceMesDesc(elegidos) : 'Todos'; }

// Mes por defecto del HTML: el actual si tiene datos; si no, el ultimo con datos.
function ceMesPorDefecto(monitoreos, hoyMes) {
  var wd = ceMesesConDatos(monitoreos);
  return wd.indexOf(hoyMes) !== -1 ? hoyMes : (wd[0] || hoyMes);
}
// Asesores con monitoreos calificados en los meses elegidos (lista del filtro).
function ceAsesoresDe(monitoreos, meses) {
  var o = {};
  (monitoreos || []).forEach(function (m) {
    if (_ceNota(m) !== null && (meses || []).indexOf(_ceMes(m)) !== -1 && m.asesor) o[m.asesor] = true;
  });
  return Object.keys(o).sort(ceOrdenSinAsesorAlFinal(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }));
}

// La vista entera. asesores: null = todos; [] = ninguno; [..] = esos.
function ceResultado(monitoreos, opts) {
  opts = opts || {};
  var meses = opts.meses || [];
  var items = (opts.plantilla && opts.plantilla.items) || [];
  var modelo = ceModelo(opts.plantilla);
  var filtroAs = opts.asesores;
  var rs = (monitoreos || []).filter(function (m) {
    return _ceNota(m) !== null && meses.indexOf(_ceMes(m)) !== -1 && (filtroAs === null || filtroAs === undefined || filtroAs.indexOf(m.asesor) !== -1);
  });
  var by = {}, orden = [];
  rs.forEach(function (m) {
    var k = String(m.asesor || '').toLowerCase();
    if (!by[k]) { by[k] = { name: m.asesor, n: [], fallos: 0 }; orden.push(k); }
    by[k].n.push(_ceNota(m));
    by[k].fallos += ceFallos(m, items);
  });
  var ag = orden.map(function (k) {
    var a = by[k];
    var avg = a.n.reduce(function (s, x) { return s + x; }, 0) / a.n.length;
    return { name: a.name, cnt: a.n.length, avg: avg, clase: ceClase(avg), zero: a.n.filter(function (x) { return x === 0; }).length, fallos: a.fallos,
      max: Math.max.apply(null, a.n), min: Math.min.apply(null, a.n), sinAsesor: ceNombreInvalido(a.name) };
  });
  // Fase 333: "Sin asesor" siempre al final (tabla, linea y listas).
  var porAsesor = ag.slice().sort(ceOrdenSinAsesorAlFinal(function (a, b) { return b.avg - a.avg; }, 'name'));
  var lineaAsesor = ag.slice().sort(ceOrdenSinAsesorAlFinal(function (a, b) { return String(a.name).localeCompare(String(b.name)); }, 'name'));
  var avg = rs.length ? rs.reduce(function (s, m) { return s + _ceNota(m); }, 0) / rs.length : null;
  var critico = modelo === 'weighted'
    ? rs.filter(function (m) { return ceFallos(m, items) > 0; }).length
    : rs.filter(function (m) { return _ceNota(m) === 0; }).length;
  var bm = {};
  rs.forEach(function (m) { (bm[_ceMes(m)] = bm[_ceMes(m)] || []).push(_ceNota(m)); });
  var porMes = Object.keys(bm).sort().map(function (mes) {
    var n = bm[mes]; var a = n.reduce(function (s, x) { return s + x; }, 0) / n.length;
    return { mes: mes, label: ceMesLabel(mes), monitoreos: n.length, avg: a, clase: ceClase(a) };
  });
  var torta = [['ok', 'Sobresaliente', '90–100%'], ['warn', 'No crítico', '70–89%'], ['bad', 'Crítico', '0–69%']].map(function (c) {
    var n = rs.filter(function (m) { return ceClase(_ceNota(m)).k === c[0]; }).length;
    return { k: c[0], t: c[1], rango: c[2], n: n, pct: rs.length ? n / rs.length * 100 : 0 };
  });
  var itemsAf = items.map(function (it, pos) {
    var fal = rs.filter(function (m) { return _ceFalla(m, it); });
    var nombres = {};
    fal.forEach(function (m) { var k = String(m.asesor || '').trim(); if (k) nombres[k] = (nombres[k] || 0) + 1; });
    return { it: it, pos: pos, c: fal.length, pct: rs.length ? fal.length / rs.length * 100 : 0,
      asesores: Object.keys(nombres).sort(ceOrdenSinAsesorAlFinal(function (a, b) { return nombres[b] - nombres[a] || a.localeCompare(b); })).map(function (n) { return { asesor: n, veces: nombres[n] }; }) };
  }).sort(function (a, b) { return b.c - a.c || a.pos - b.pos; });
  return {
    modelo: modelo,
    total: rs.length,
    monitoreos: rs,
    // Fase 333: los monitoreos "Sin asesor" cuentan en el total y el promedio, pero no como un asesor mas.
    kpis: { total: rs.length, promedio: avg, clase: ceClase(avg), critico: critico, asesores: ag.filter(function (a) { return !a.sinAsesor; }).length,
      criticoLabel: modelo === 'weighted' ? 'Con fallos en ítems críticos' : 'Notas en 0% (crítico)' },
    columnaFinal: modelo === 'weighted' ? 'Fallos críticos' : 'En 0%',
    porAsesor: porAsesor.map(function (a) { return Object.assign({}, a, { final: modelo === 'weighted' ? a.fallos : a.zero }); }),
    lineaAsesor: lineaAsesor,
    porMes: porMes,
    torta: torta,
    items: itemsAf,
  };
}

// "Resumen por asesor" del HTML (renderResAs): un mes o 'all', por nombre.
function ceResumenAsesores(monitoreos, mes, texto, items) {
  var q = ceKey(texto);
  var by = {}, orden = [];
  (monitoreos || []).forEach(function (m) {
    if (_ceNota(m) === null || !(mes === 'all' || _ceMes(m) === mes)) return;
    var k = ceKey(m.asesor);
    if (!by[k]) { by[k] = { name: m.asesor, n: [], f: 0 }; orden.push(k); }
    by[k].n.push(_ceNota(m)); by[k].f += ceFallos(m, items);
  });
  return orden.map(function (k) { return by[k]; }).filter(function (a) { return !q || ceKey(a.name).indexOf(q) !== -1; })
    .sort(ceOrdenSinAsesorAlFinal(function (a, b) { return String(a.name).localeCompare(String(b.name)); }, 'name'))
    .map(function (a) {
      var avg = a.n.reduce(function (s, x) { return s + x; }, 0) / a.n.length;
      return { name: a.name, cnt: a.n.length, avg: avg, clase: ceClase(avg), fallos: a.f,
        alerta: a.f === 0 ? { k: 'ok', t: '✅ Sin fallos críticos' } : a.f === 1 ? { k: 'warn', t: '⚠ Alerta' } : { k: 'bad', t: '🚨 Crítico frecuente' } };
    });
}

// "Detalle por mes" del HTML (renderDetMes): todos los del mes (tambien los
// incompletos), filtrados por asesor, del mas nuevo al mas viejo.
function ceDetalleMes(monitoreos, mes, texto) {
  var q = ceKey(texto);
  var lista = (monitoreos || []).filter(function (m) {
    return (mes === 'all' || _ceMes(m) === mes) && (!q || ceKey(m.asesor).indexOf(q) !== -1);
  }).sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || (b.id || 0) - (a.id || 0); });
  var hechos = lista.filter(function (m) { return _ceNota(m) !== null; });
  var avg = hechos.length ? hechos.reduce(function (s, m) { return s + _ceNota(m); }, 0) / hechos.length : null;
  return { lista: lista, total: lista.length, promedio: avg, clase: ceClase(avg), incompletos: lista.length - hechos.length };
}
// Meses del "Detalle por mes" (todos los que tienen monitoreos, incompletos incluidos).
function ceMesesDetalle(monitoreos) {
  var o = {};
  (monitoreos || []).forEach(function (m) { if (m.fecha) o[_ceMes(m)] = true; });
  return Object.keys(o).sort().reverse();
}

// Fase 332/333: nombre de asesor para mostrar. Un nombre que quedo guardado como "Invalid Date"
// (celda de nombre leida como fecha en una carga masiva vieja) no es un nombre: se muestra
// "Sin asesor" (Fase 333, antes "Sin nombre (revisar carga)"). El resto, como siempre.
var CE_SIN_NOMBRE = 'Sin asesor';
function ceNombreInvalido(n) { return /^\s*invalid date\s*$/i.test(String(n == null ? '' : n)); }
function ceNombreAsesor(n, formato) {
  if (ceNombreInvalido(n)) return CE_SIN_NOMBRE;
  return typeof formato === 'function' ? formato(n) : n;
}
// Fase 333: comparador que deja "Sin asesor" siempre al final y, entre los demas, usa `cmp`.
// `campo`: si los elementos son objetos, la propiedad con el nombre (si no, el elemento es el nombre).
function ceOrdenSinAsesorAlFinal(cmp, campo) {
  return function (a, b) {
    var sa = ceNombreInvalido(campo ? a && a[campo] : a), sb = ceNombreInvalido(campo ? b && b[campo] : b);
    if (sa !== sb) return sa ? 1 : -1;
    return cmp(a, b);
  };
}
// Fase 332: promedio del equipo (el de las tarjetas: todos los monitoreos del periodo) y
// cada asesor por encima (▲, igual o mas) o por debajo (▼) -- lo que mostraba el bloque de
// antes de ORLANT («Promedio de calidad por asesor»), mismo criterio (calDashPuntajeVsEquipo).
// Fase 333: "Sin asesor" no cuenta ni por encima ni por debajo (el promedio del equipo si lo incluye).
function ceVsEquipo(porAsesor, promedioEquipo) {
  var conAsesor = (porAsesor || []).filter(function (a) { return !(a.sinAsesor || ceNombreInvalido(a.name)); });
  if (promedioEquipo === null || promedioEquipo === undefined || !conAsesor.length) return { equipo: null, encima: 0, debajo: 0 };
  var encima = conAsesor.filter(function (a) { return a.avg >= promedioEquipo; }).length;
  return { equipo: promedioEquipo, encima: encima, debajo: conAsesor.length - encima };
}

// Fase 346: «Llamada del DD/MM» junto a la fecha de un monitoreo de Calidad de encuestas (la fecha
// de la llamada la manda el servidor en fechaLlamada; el monitoreo cuenta en el mes de su fecha).
function ceFechaLlamadaCorta(f) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  return m ? m[3] + '/' + m[2] : '';
}
function ceFechaConLlamadaHtml(m, escFn, fechaTxt) {
  var e = escFn || function (x) { return String(x); };
  var t = e(fechaTxt !== undefined && fechaTxt !== null ? fechaTxt : ((m && m.fecha) || '-'));
  var c = m && m.fechaLlamada ? ceFechaLlamadaCorta(m.fechaLlamada) : '';
  return c ? t + ' <span class="ce-llamada">Llamada del ' + e(c) + '</span>' : t;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ceFechaLlamadaCorta: ceFechaLlamadaCorta, ceFechaConLlamadaHtml: ceFechaConLlamadaHtml, CE_SIN_NOMBRE: CE_SIN_NOMBRE, ceNombreInvalido: ceNombreInvalido, ceNombreAsesor: ceNombreAsesor, ceOrdenSinAsesorAlFinal: ceOrdenSinAsesorAlFinal, ceVsEquipo: ceVsEquipo, ceClase: ceClase, cePct: cePct, ceMesLabel: ceMesLabel, ceMesDesc: ceMesDesc, ceModelo: ceModelo, ceFallos: ceFallos, ceKey: ceKey,
    ceMesesConDatos: ceMesesConDatos, ceMesesEfectivos: ceMesesEfectivos, ceMesFiltroDesc: ceMesFiltroDesc, ceMesPorDefecto: ceMesPorDefecto, ceAsesoresDe: ceAsesoresDe, ceResultado: ceResultado,
    ceResumenAsesores: ceResumenAsesores, ceDetalleMes: ceDetalleMes, ceMesesDetalle: ceMesesDetalle };
}
