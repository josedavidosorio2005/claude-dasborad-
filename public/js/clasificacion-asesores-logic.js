// clasificacion-asesores-logic.js — Fase 186 (pedido de Edwin, 26/10, solo
// ORLANT). Logica pura del Excel "nombre del asesor, línea" con el que se
// llena la ventana "Clasificación de asesores" de Tipificacion (el listado
// que Edwin tiene con Isa). Nunca inventa cruces: un nombre solo se aplica
// si coincide con un asesor de los CDR cargados despues de quitar
// mayusculas/minusculas, tildes y espacios de mas; si no coincide, la vista
// previa lo avisa y no se guarda.
'use strict';

function clasifNormNombre(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

// "General", "Línea General", "LINEA GENERAL" -> 'GENERAL'; "3P", "Línea 3P" -> '3P'.
function clasifLineaDeTexto(s) {
  var t = clasifNormNombre(s).replace(/^LINEA\s+/, '');
  if (t === 'GENERAL') return 'GENERAL';
  if (t === '3P') return '3P';
  return null;
}

var CLASIF_ETIQUETAS = { GENERAL: 'Línea General', '3P': 'Línea 3P' };

// filas: arrays de la hoja (sheet_to_json header:1). Busca en las primeras 10
// filas un encabezado con una columna de asesor (ASESOR/NOMBRE/AGENT) y una
// de LINEA. asesoresConocidos: nombres de la lista (los de los CDR).
// Devuelve { error } o { asignaciones: {agente: linea}, coincidencias,
// sinCoincidencia: [nombre], lineaInvalida: [{fila, nombre, valor}],
// conflictos: [agente], ambiguos: [nombre], filasLeidas }.
function clasifLeerExcel(filas, asesoresConocidos) {
  filas = filas || [];
  var iEnc = -1, colNombre = -1, colLinea = -1;
  for (var r = 0; r < Math.min(filas.length, 10) && iEnc < 0; r++) {
    var fila = filas[r] || [];
    var cn = -1, cl = -1;
    for (var c = 0; c < fila.length; c++) {
      var h = clasifNormNombre(fila[c]);
      if (cl < 0 && /^LINEA\b/.test(h)) cl = c;
      else if (cn < 0 && /ASESOR|NOMBRE|AGENT/.test(h)) cn = c;
    }
    if (cn >= 0 && cl >= 0) { iEnc = r; colNombre = cn; colLinea = cl; }
  }
  if (iEnc < 0) return { error: 'El archivo debe tener una columna con el nombre del asesor y otra llamada "Línea".' };

  var porNorm = {};
  var ambiguosNorm = {};
  (asesoresConocidos || []).forEach(function (a) {
    var k = clasifNormNombre(a);
    if (porNorm[k] !== undefined && porNorm[k] !== a) ambiguosNorm[k] = true;
    porNorm[k] = a;
  });

  var out = { asignaciones: {}, coincidencias: 0, sinCoincidencia: [], lineaInvalida: [], conflictos: [], ambiguos: [], filasLeidas: 0 };
  for (var i = iEnc + 1; i < filas.length; i++) {
    var f = filas[i] || [];
    var nombre = f[colNombre] == null ? '' : String(f[colNombre]).trim();
    var valor = f[colLinea] == null ? '' : String(f[colLinea]).trim();
    if (!nombre && !valor) continue;
    out.filasLeidas++;
    var linea = clasifLineaDeTexto(valor);
    if (!nombre || !linea) { out.lineaInvalida.push({ fila: i + 1, nombre: nombre, valor: valor }); continue; }
    var k = clasifNormNombre(nombre);
    if (ambiguosNorm[k]) { if (out.ambiguos.indexOf(nombre) < 0) out.ambiguos.push(nombre); continue; }
    var agente = porNorm[k];
    if (agente === undefined) { if (out.sinCoincidencia.indexOf(nombre) < 0) out.sinCoincidencia.push(nombre); continue; }
    if (out.asignaciones[agente] && out.asignaciones[agente] !== linea) {
      if (out.conflictos.indexOf(agente) < 0) out.conflictos.push(agente);
      continue;
    }
    if (!out.asignaciones[agente]) out.coincidencias++;
    out.asignaciones[agente] = linea;
  }
  // Un asesor con 2 lineas distintas en el archivo no se aplica (no se elige por el usuario).
  out.conflictos.forEach(function (a) { if (out.asignaciones[a]) { delete out.asignaciones[a]; out.coincidencias--; } });
  return out;
}

// Avisos de la vista previa (texto plano; el que llama lo escapa).
function clasifAvisosExcel(r) {
  if (r.error) return [r.error];
  var av = [];
  av.push(r.coincidencias + ' asesor(es) del archivo coinciden con los de los CDR y quedaron elegidos abajo (falta Guardar).');
  if (r.sinCoincidencia.length) av.push(r.sinCoincidencia.length + ' nombre(s) del archivo no coinciden con ningún asesor de los CDR y no se aplicaron: ' + r.sinCoincidencia.join(', ') + '.');
  if (r.lineaInvalida.length) av.push(r.lineaInvalida.length + ' fila(s) sin nombre o con una línea que no es "General" ni "3P": ' + r.lineaInvalida.map(function (x) { return 'fila ' + x.fila + (x.valor ? ' ("' + x.valor + '")' : ''); }).join(', ') + '.');
  if (r.conflictos.length) av.push(r.conflictos.length + ' asesor(es) aparecen con las 2 líneas en el archivo y no se aplicaron: ' + r.conflictos.join(', ') + '.');
  if (r.ambiguos.length) av.push(r.ambiguos.length + ' nombre(s) coinciden con más de un asesor de los CDR y no se aplicaron: ' + r.ambiguos.join(', ') + '.');
  return av;
}

// Tarjetas: General + 3P + Sin clasificar = salida del canal (Sin clasificar solo si hay).
function clasifTarjetasSalida(r, canal) {
  var nombre = canal === 'WHATSAPP' ? 'WhatsApp' : 'llamadas';
  var t = [
    { clave: 'GENERAL', valor: r.general || 0, etiqueta: 'Salida General' },
    { clave: '3P', valor: r.p3 || 0, etiqueta: 'Salida 3P' },
  ];
  if (r.sinClasificar) t.push({ clave: 'SIN', valor: r.sinClasificar, etiqueta: 'Sin clasificar' });
  return { tarjetas: t, salida: r.salida || 0, nota: 'Salida de ' + nombre + ': ' + (r.salida || 0).toLocaleString('es-CO') };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clasifNormNombre: clasifNormNombre, clasifLineaDeTexto: clasifLineaDeTexto, clasifLeerExcel: clasifLeerExcel, clasifAvisosExcel: clasifAvisosExcel, clasifTarjetasSalida: clasifTarjetasSalida, CLASIF_ETIQUETAS: CLASIF_ETIQUETAS };
}
