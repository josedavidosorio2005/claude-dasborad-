// calidad-carga-masiva-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del parseo de la hoja "Monitoreos" de la carga
// masiva de Calidad (ver calidad-carga-masiva.js para el flujo con UI).
// Doble modo como trafico-logic.js: global en el navegador y require() en
// Node para las pruebas (server/tests/calidad-carga-masiva-logic.test.js),
// que corren esta MISMA logica contra un fixture real de 3 hojas.
'use strict';

// fecha-limites-logic.js: global en el navegador, require() en Node --
// ver ese archivo para el criterio de "fecha futura".
var _cmFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

// Fase 130 (Parte 4): la plantilla REAL que manda Edwin cada mes no es el
// archivo plano que genera descargarPlantillaMonitoreos (ASESOR, FECHA,
// ...) -- tiene estilo (filas de titulo/leyenda, encabezados agrupados por
// categoria) y usa textos mas largos/descriptivos para algunas columnas
// fijas. `labelAlt` deja aceptar esas variantes SIN que Edwin tenga que
// editar el archivo cada mes -- mismo patron que labelAlt en
// INASISTENCIA_COLUMNAS (inasistencia-logic.js).
var CM_COLUMNAS_FIJAS = [
  { key: 'asesor', label: 'ASESOR', labelAlt: ['NOMBRE DEL ASESOR'] },
  { key: 'fecha', label: 'FECHA' },
  { key: 'canal', label: 'CANAL' },
  { key: 'idLlamada', label: 'ID LLAMADA', labelAlt: ['ID / LLAMADA - WPP', 'ID/LLAMADA - WPP'] },
  { key: 'telefono', label: 'TELEFONO', labelAlt: ['# TELEFONO'] },
  { key: 'evaluador', label: 'EVALUADOR' },
  { key: 'observaciones', label: 'OBSERVACIONES', labelAlt: ['OBSERVACIONES GENERALES'] },
];
var CM_LABELS_OBLIGATORIAS = ['asesor', 'fecha'];
// Cuantas filas (desde el principio de la hoja) se revisan buscando el
// encabezado real -- suficiente para el layout real (titulo + leyenda +
// encabezado agrupado + encabezado real = 4 filas antes de los datos),
// con margen.
var CM_MAX_FILAS_BUSCAR_ENCABEZADO = 10;

// Trim + minusculas + sin tildes (NFD y quita las marcas diacriticas) --
// asi "Teléfono"/"TELÉFONO"/"telefono" son la misma columna, y los nombres
// de item en español (con o sin tilde, como los escriba quien edite la
// plantilla en Gestion de Usuarios/Calidad) matchean igual.
var CM_DIACRITICOS_RE = /[̀-ͯ]/g;
function _cmNorm(s){
  return String(s==null?'':s).trim().toLowerCase().normalize('NFD').replace(CM_DIACRITICOS_RE, '');
}

// Un encabezado de item en el archivo real viene como
// "⚠️ 3. Valida entidad y derechos\r\n(7%)" (criticos llevan el emoji de
// advertencia) o "1. Guion de saludo\r\n(5%)" (no criticos) -- el NUMERO
// al principio es el identificador estable del item (coincide con `n` en
// calidad-plantillas-seed.js); el texto despues del numero puede cambiar
// de redaccion sin que el emparejamiento se rompa. Devuelve el numero o
// null si el encabezado no empieza con uno (ej. las columnas fijas, o
// PUNTAJE/CLASIFICACION/OBSERVACIONES GENERALES al final de la hoja real).
function cmHeaderItemNumero(h){
  var s = String(h==null?'':h).trim();
  var m = /^[^\d]{0,4}(\d{1,2})[.)]/.exec(s);
  return m ? parseInt(m[1], 10) : null;
}

function cmColIndexMap(headerRow, items){
  var map = { fijas: {}, items: {} };
  (headerRow||[]).forEach(function(h, i){
    var n = _cmNorm(h);
    var fija = CM_COLUMNAS_FIJAS.find(function(c){
      if(_cmNorm(c.label)===n) return true;
      return (c.labelAlt||[]).some(function(alt){ return _cmNorm(alt)===n; });
    });
    if(fija && map.fijas[fija.key]===undefined){ map.fijas[fija.key] = i; return; }
    // Primero por NUMERO (robusto al emoji/salto de linea/peso -- ver
    // cmHeaderItemNumero); si el encabezado no trae numero (ej. la
    // plantilla plana que genera esta misma plataforma), cae al nombre
    // exacto del item, igual que antes de la Fase 130.
    var numero = cmHeaderItemNumero(h);
    var item = (numero!=null ? items.find(function(it){ return it.n===numero; }) : null) ||
      items.find(function(it){ return _cmNorm(it.label)===n; });
    if(item && map.items[item.n]===undefined) map.items[item.n] = i;
  });
  return map;
}

// Busca, entre las primeras `CM_MAX_FILAS_BUSCAR_ENCABEZADO` filas de la
// hoja, la primera que resuelva LAS 2 columnas obligatorias (asesor+fecha)
// -- la plantilla plana de esta plataforma la tiene en la fila 0; el
// archivo real de Edwin trae antes 3 filas de titulo/leyenda/encabezado
// agrupado por categoria (Fase 130, Parte 4). Devuelve el indice de fila
// (0 si no hay nada que detectar, ej. hoja vacia) -- nunca null, para que
// el llamador no tenga que manejar un caso aparte.
function cmDetectarFilaEncabezado(aoa, items){
  var limite = Math.min(aoa.length, CM_MAX_FILAS_BUSCAR_ENCABEZADO);
  for(var i=0;i<limite;i++){
    var map = cmColIndexMap(aoa[i], items);
    if(CM_LABELS_OBLIGATORIAS.every(function(k){ return map.fijas[k]!==undefined; })) return i;
  }
  return 0;
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

// aoa: array-of-arrays de la hoja "Monitoreos" -- el encabezado real NO
// siempre es la fila 0 (Fase 130, Parte 4: el archivo real de Edwin trae
// titulo/leyenda/encabezado agrupado por categoria ANTES del encabezado
// real, ver cmDetectarFilaEncabezado). items: plantilla de calificacion de
// la campana (n, cat, label, weight, critico).
function cmParseRows(aoa, items){
  if(!aoa || !aoa.length) return { error: 'La hoja "Monitoreos" esta vacia' };
  var filaEncabezado = cmDetectarFilaEncabezado(aoa, items);
  var map = cmColIndexMap(aoa[filaEncabezado], items);
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
  for(var i=filaEncabezado+1;i<aoa.length;i++){
    var row = aoa[i];
    if(!row || row.every(function(v){ return v===''||v==null; })) continue;
    var fila = i+1;
    var asesor = row[map.fijas.asesor]==null ? '' : String(row[map.fijas.asesor]).trim();
    var fecha = cmParseFecha(row[map.fijas.fecha]);
    if(!asesor){ avisos.push('Fila '+fila+': ASESOR vacio, se omitio.'); continue; }
    if(!fecha){ avisos.push('Fila '+fila+' ('+asesor+'): FECHA invalida, se omitio.'); continue; }
    // Fase 86 (tema 2): fecha futura -> se rechaza; fecha anterior a 2020
    // -> solo se advierte, no se omite.
    if(_cmFechaLimites.fechaLimitesEsFutura(fecha)){ avisos.push('Fila '+fila+' ('+asesor+'): FECHA '+fecha+' esta en el futuro, se omitio.'); continue; }
    if(_cmFechaLimites.fechaLimitesEsSospechosaAntigua(fecha)){ avisos.push('Fila '+fila+' ('+asesor+'): FECHA '+fecha+' es anterior a 2020, revisa si esta bien digitada (no se omitio).'); }

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
    cmHeaderItemNumero: cmHeaderItemNumero,
    cmColIndexMap: cmColIndexMap,
    cmDetectarFilaEncabezado: cmDetectarFilaEncabezado,
    cmParseFecha: cmParseFecha,
    cmParseRespuesta: cmParseRespuesta,
    cmParseRows: cmParseRows,
  };
}
