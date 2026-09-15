// calidad-carga-masiva-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del parseo de la hoja "Monitoreos" de la carga
// masiva de Calidad (ver calidad-carga-masiva.js para el flujo con UI).
// Doble modo como trafico-logic.js: global en el navegador y require() en
// Node para las pruebas (server/tests/calidad-carga-masiva-logic.test.js),
// que corren esta MISMA logica contra un fixture real de 3 hojas.
'use strict';

var CM_COLUMNAS_FIJAS = [
  { key: 'asesor', label: 'ASESOR' },
  { key: 'fecha', label: 'FECHA' },
  { key: 'canal', label: 'CANAL' },
  { key: 'idLlamada', label: 'ID LLAMADA' },
  { key: 'telefono', label: 'TELEFONO' },
  { key: 'evaluador', label: 'EVALUADOR' },
  { key: 'observaciones', label: 'OBSERVACIONES' },
];
var CM_LABELS_OBLIGATORIAS = ['asesor', 'fecha'];

function _cmNorm(s){ return String(s==null?'':s).trim().toLowerCase(); }

function cmColIndexMap(headerRow, items){
  var map = { fijas: {}, items: {} };
  (headerRow||[]).forEach(function(h, i){
    var n = _cmNorm(h);
    var fija = CM_COLUMNAS_FIJAS.find(function(c){ return _cmNorm(c.label)===n; });
    if(fija && map.fijas[fija.key]===undefined){ map.fijas[fija.key] = i; return; }
    var item = items.find(function(it){ return _cmNorm(it.label)===n; });
    if(item && map.items[item.n]===undefined) map.items[item.n] = i;
  });
  return map;
}

function cmParseFecha(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='string'){
    var t = v.trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var d = new Date(t);
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  if(typeof v==='number'){
    // Fecha serial de Excel (dias desde 1899-12-30), por si cellDates fallo.
    var epoch = new Date(Date.UTC(1899,11,30));
    var d2 = new Date(epoch.getTime() + v*86400000);
    if(!isNaN(d2)) return d2.toISOString().slice(0,10);
  }
  return null;
}

function cmParseRespuesta(v){
  var s = String(v==null?'':v).trim().toUpperCase();
  if(s==='SI' || s==='SÍ' || s==='S') return 'SI';
  if(s==='NO' || s==='N') return 'NO';
  if(s==='N/A' || s==='NA') return 'N/A';
  return '';
}

// aoa: array-of-arrays de la hoja "Monitoreos" (fila 0 = encabezados).
// items: plantilla de calificacion de la campana (n, cat, label, weight, critico).
function cmParseRows(aoa, items){
  if(!aoa || !aoa.length) return { error: 'La hoja "Monitoreos" esta vacia' };
  var map = cmColIndexMap(aoa[0], items);
  var faltantes = CM_LABELS_OBLIGATORIAS.filter(function(k){ return map.fijas[k]===undefined; });
  if(faltantes.length){
    var labels = faltantes.map(function(k){ return CM_COLUMNAS_FIJAS.find(function(c){ return c.key===k; }).label; });
    return { error: 'Faltan columnas obligatorias: '+labels.join(', ')+'. Revisa los encabezados de la hoja Monitoreos.' };
  }
  var itemsConColumna = items.filter(function(it){ return map.items[it.n]!==undefined; });
  if(itemsConColumna.length===0){
    return { error: 'No se reconocio ninguna columna de item de la plantilla de calificacion. Los encabezados deben coincidir exactamente con los nombres de la hoja Diccionario.' };
  }

  var filas = [];
  var avisos = [];
  for(var i=1;i<aoa.length;i++){
    var row = aoa[i];
    if(!row || row.every(function(v){ return v===''||v==null; })) continue;
    var fila = i+1;
    var asesor = row[map.fijas.asesor]==null ? '' : String(row[map.fijas.asesor]).trim();
    var fecha = cmParseFecha(row[map.fijas.fecha]);
    if(!asesor){ avisos.push('Fila '+fila+': ASESOR vacio, se omitio.'); continue; }
    if(!fecha){ avisos.push('Fila '+fila+' ('+asesor+'): FECHA invalida, se omitio.'); continue; }

    var canalRaw = map.fijas.canal!==undefined ? _cmNorm(row[map.fijas.canal]) : '';
    var canal = (canalRaw.indexOf('wpp')!==-1 || canalRaw.indexOf('whatsapp')!==-1 || canalRaw.indexOf('chat')!==-1) ? 'WPP' : 'LLAMADA';

    var answers = {};
    var respondidos = 0;
    itemsConColumna.forEach(function(it){
      var r = cmParseRespuesta(row[map.items[it.n]]);
      if(r){ answers[it.n] = r; respondidos++; }
    });
    if(respondidos===0){ avisos.push('Fila '+fila+' ('+asesor+', '+fecha+'): ningun item respondido (SI/NO/N-A), se omitio.'); continue; }

    filas.push({
      asesor: asesor,
      fecha: fecha,
      canal: canal,
      idLlamada: map.fijas.idLlamada!==undefined ? (row[map.fijas.idLlamada]==null?'':String(row[map.fijas.idLlamada]).trim()) : '',
      telefono: map.fijas.telefono!==undefined ? (row[map.fijas.telefono]==null?'':String(row[map.fijas.telefono]).trim()) : '',
      evaluador: map.fijas.evaluador!==undefined ? (row[map.fijas.evaluador]==null?'':String(row[map.fijas.evaluador]).trim()) : '',
      observaciones: map.fijas.observaciones!==undefined ? (row[map.fijas.observaciones]==null?'':String(row[map.fijas.observaciones]).trim()) : '',
      answers: answers,
    });
  }
  if(filas.length===0) return { error: 'La hoja "Monitoreos" no tiene filas de datos validas.' };
  return { filas: filas, avisos: avisos };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CM_COLUMNAS_FIJAS: CM_COLUMNAS_FIJAS,
    CM_LABELS_OBLIGATORIAS: CM_LABELS_OBLIGATORIAS,
    cmColIndexMap: cmColIndexMap,
    cmParseFecha: cmParseFecha,
    cmParseRespuesta: cmParseRespuesta,
    cmParseRows: cmParseRows,
  };
}
