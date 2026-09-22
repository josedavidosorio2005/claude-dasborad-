// cargas-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del parseo de la carga de datos operativos de los
// dashboards de cliente (ver cargas.js para el flujo con UI). Doble modo
// como trafico-logic.js / calidad-carga-masiva-logic.js: global en el
// navegador y require() en Node para las pruebas
// (server/tests/cargas-logic.test.js).
'use strict';

function _cargasNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function cargasColPorLabel(spec, label) {
  var n = _cargasNorm(label);
  return spec.columnas.find(function (c) { return _cargasNorm(c.label) === n || _cargasNorm(c.key) === n; }) || null;
}

function cargasParseFilaUnica(spec, aoa) {
  // Formato vertical: [ [label, valor], ... ]  (se ignora una fila de encabezado si dice "metrica")
  var obj = {};
  var avisos = [];
  aoa.forEach(function (row) {
    if (!row || row.length < 2) return;
    if (_cargasNorm(row[0]) === 'metrica' || _cargasNorm(row[0]) === 'métrica') return;
    var col = cargasColPorLabel(spec, row[0]);
    if (!col) { avisos.push('Se ignoro la fila "' + row[0] + '" (no coincide con ninguna metrica)'); return; }
    obj[col.key] = row[1];
  });
  if (Object.keys(obj).length === 0) return { error: 'El archivo no tiene metricas reconocibles. Descarga la plantilla.' };
  return { filas: [obj], avisos: avisos };
}

function cargasParseMultiFila(spec, aoa) {
  if (!aoa.length) return { error: 'El archivo esta vacio' };
  var headers = aoa[0].map(function (h) { return cargasColPorLabel(spec, h); });
  if (!headers.some(Boolean)) return { error: 'Los encabezados no coinciden con la plantilla. Descarga la plantilla.' };
  var filas = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v == null; })) continue;
    var obj = {};
    headers.forEach(function (col, j) { if (col) obj[col.key] = row[j]; });
    filas.push(obj);
  }
  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos' };
  return { filas: filas, avisos: [] };
}

// ── Deteccion de formulas de Excel sin valor calculado ──────────────────
// Un .xlsx generado por script (nunca abierto en Excel/LibreOffice para
// forzar el recalculo) guarda el TEXTO de la formula pero no su resultado:
// la celda queda "vacia" para cualquier lector que solo mire el valor crudo
// (SheetJS incluido). Sin esta deteccion esas cargas se aceptaban en
// silencio y la vista previa mostraba "—" sin explicar por que (caso real:
// plantilla de Alberto Linero Go con =COUNTA/=COUNTIF apuntando a una hoja
// de detalle que el sistema nunca calculo).
//
// `ws` es un worksheet con la misma forma que usa SheetJS: un objeto plano
// con una entrada por direccion de celda ("A1", "B2", ...) donde cada celda
// es { v: valor, f: formula (si la hay) }. server/tests/helpers/xlsx-lite.js
// produce la misma forma para poder probar esto contra un .xlsx real sin
// depender del paquete npm `xlsx`.
function _cargasParseAddr(addr) {
  var m = /^([A-Z]+)(\d+)$/.exec(addr);
  var col = 0;
  for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  return { col: col, row: parseInt(m[2], 10) };
}
function _cargasCompararCeldas(a, b) {
  var pa = _cargasParseAddr(a), pb = _cargasParseAddr(b);
  if (pa.row !== pb.row) return pa.row - pb.row;
  return pa.col - pb.col;
}

// Devuelve { celda, formula, etiqueta, mensaje } de la primera celda con
// formula sin valor calculado (leyendo en orden de fila/columna, para
// reportar siempre la primera que veria un humano), o null si no hay ninguna.
function cargasDetectarFormulaSinValor(ws) {
  if (!ws) return null;
  var direcciones = Object.keys(ws)
    .filter(function (k) { return k.charAt(0) !== '!' && /^[A-Z]+\d+$/.test(k); })
    .sort(_cargasCompararCeldas);
  for (var i = 0; i < direcciones.length; i++) {
    var addr = direcciones[i];
    var cell = ws[addr];
    // SheetJS SOLO incluye una celda de formula sin valor cacheado en `ws`
    // si se lee con la opcion `sheetStubs:true` (cargas.js la pasa) — sin
    // ella, la celda no existe en absoluto en `ws` y esta funcion nunca la
    // veria (verificado contra la libreria real, no asumido). Con
    // sheetStubs, esa celda llega como { t:'z', f, v:0 } — el `v:0` es un
    // relleno interno de SheetJS, NUNCA el resultado real de la formula, asi
    // que `t==='z'` manda sobre cualquier valor de `v` para esas celdas.
    var sinValorReal = cell && (cell.t === 'z' || cell.v === undefined || cell.v === null || cell.v === '');
    if (cell && cell.f && sinValorReal) {
      var fila = _cargasParseAddr(addr).row;
      var etiquetaCell = ws['A' + fila];
      var etiqueta = etiquetaCell && etiquetaCell.v != null && etiquetaCell.v !== '' ? String(etiquetaCell.v) : null;
      return {
        celda: addr,
        formula: cell.f,
        etiqueta: etiqueta,
        mensaje: 'La celda ' + addr + (etiqueta ? ' ("' + etiqueta + '")' : '') +
          ' tiene una formula de Excel ("=' + cell.f + '") sin calcular. ' +
          'Escribe el numero final ya calculado, no una formula — probablemente este archivo nunca se abrio ' +
          'en Excel o LibreOffice para forzar el recalculo.',
      };
    }
  }
  return null;
}

// ── Plantilla consolidada (una sola por campana, una hoja por tipo de dato) ──
// Antes de esto, cada campana podia tener hasta 3 botones de carga distintos
// (Gestion de base aqui, Calidad en su propio modulo, Trafico en su propia
// pantalla de administracion). Decision de negocio (2026-09-16): un solo
// archivo .xlsx por campana, con una hoja por tipo de dato — nunca aplanar
// todo en una tabla unica (mezclaria filas de naturaleza distinta: una
// llamada no es un monitoreo de calidad ni un resumen de KPI).
//
// Nombres de hoja RESERVADOS (deben coincidir exacto con lo que ya leen
// trafico.js / calidad-carga-masiva.js, para reusar esos parsers tal cual):
//   'DATA'        -> Trafico (trafico-logic.js: traficoParseFilas)
//   'Monitoreos'  -> Calidad (calidad-carga-masiva-logic.js: cmParseRows)
//   'Diccionario', 'Resumen por Asesor' -> Calidad, solo de referencia (no se parsean)
//   'INSTRUCCIONES' -> texto, no se parsea
// Las hojas de Gestion de base usan la KEY de la seccion tal cual (ej.
// 'resumen', 'diario', 'tipificacion') — son identificadores estables ya
// usados por dashboard-secciones.js / dashboard-plantillas-cliente.js, nunca
// coinciden con los nombres reservados de arriba.
var CARGAS_HOJA_TRAFICO = 'DATA';
var CARGAS_HOJA_CALIDAD = 'Monitoreos';
var CARGAS_HOJA_DICCIONARIO = 'Diccionario';
var CARGAS_HOJA_RESUMEN_ASESOR = 'Resumen por Asesor';
var CARGAS_HOJA_INSTRUCCIONES = 'INSTRUCCIONES';

// secciones: { key: {titulo,cadencia,periodo,filaUnica,columnas,descripcion} }
// (la misma forma que devuelve GET /dashboard/secciones/:cliente).
// calidadCols: [{label}, ...] para el encabezado de "Monitoreos" (columnas
// fijas + un item por columna), o null si esta campana no tiene plantilla de
// calificacion todavia (nunca se inventa una hoja con columnas que no existen).
// traficoCols: [{label,obligatoria}, ...] — SIEMPRE se incluye: Trafico es
// estructuralmente universal (el mapeo skill->campana decide a quien
// pertenece cada fila, no el archivo — ver docs/ARQUITECTURA.md §5), asi que
// no hay razon para excluirla de ninguna campana, tenga o no panel de
// Trafico activado hoy en su dashboard.
function cargasPlanConsolidado(secciones, calidadCols, traficoCols) {
  var plan = [];
  Object.keys(secciones || {}).forEach(function (key) {
    var s = secciones[key];
    plan.push({
      tipo: 'seccion', hoja: key, titulo: s.titulo, descripcion: s.descripcion,
      filaUnica: !!s.filaUnica, columnas: s.columnas,
    });
  });
  if (calidadCols) {
    plan.push({
      tipo: 'calidad', hoja: CARGAS_HOJA_CALIDAD, titulo: 'Calidad — Monitoreos',
      descripcion: 'Un monitoreo por fila (una llamada o interaccion evaluada).',
      filaUnica: false, columnas: calidadCols,
    });
  }
  plan.push({
    tipo: 'trafico', hoja: CARGAS_HOJA_TRAFICO, titulo: 'Trafico (Llamadas o WhatsApp)',
    descripcion: 'Una fila por Skill + Dia, tal cual el export de Wolkvox (Trafico de Llamadas). ' +
      'Esta misma hoja tambien acepta el formato de Trafico de WhatsApp (columnas ' +
      'NOMBRE_COLA_WHATSAPP, FECHA INICIO, FECHA FIN, TOTAL WHATSAPP, WHATSAPP CONTESTADOS, ' +
      'etc. — una fila por cola y periodo) si subes ese archivo en su lugar: el sistema detecta ' +
      'cual de los dos formatos trae por las columnas del encabezado, nunca por el nombre de hoja ' +
      '(los dos usan "DATA").',
    filaUnica: false, columnas: traficoCols,
  });
  return plan;
}

// Distingue si la hoja "DATA" que trae el archivo es del formato de Trafico
// de Llamadas (voz, Wolkvox) o de Trafico de WhatsApp -- Fase 52. Antes de
// esto, esta hoja SOLO aceptaba el formato de voz (aunque el nombre de hoja
// fuera el correcto), asi que un archivo real de WhatsApp subido aqui fallaba
// con "ninguna hoja reconocida" (hallazgo real del usuario en produccion).
// Los dos formatos comparten el mismo nombre de hoja, asi que no hay forma de
// distinguirlos sin mirar las columnas del encabezado.
// `colIndexMapVoz`/`colIndexMapWpp` son los indexadores YA EXISTENTES de cada
// modulo (traficoColIndexMap / traficoWppColIndexMap), inyectados igual que
// el resto de parsers de este archivo para no depender de trafico-logic.js
// ni trafico-whatsapp-logic.js aqui.
function cargasDetectarCanalTrafico(headerRow, colIndexMapVoz, colIndexMapWpp) {
  var esWhatsapp = colIndexMapWpp(headerRow || []).colaWhatsapp !== undefined;
  return esWhatsapp ? 'whatsapp' : 'voz';
}

// aoa: array-of-arrays de la hoja tal cual la entrega SheetJS
// (sheet_to_json(ws,{header:1})). ws es el worksheet crudo de SheetJS para
// esa hoja, o null/undefined si el archivo subido NO TIENE ninguna pestana
// con ese nombre exacto (borrada, renombrada sin querer, o Excel le cambio
// el nombre al copiar/pegar) -- aoa y ws siempre viajan sincronizados: los
// dos null/undefined juntos, o los dos presentes juntos (ver cargas.js,
// donde `aoa` se deriva de `ws` con `ws ? sheet_to_json(ws,...) : null`).
// filaUnica: true para hojas verticales Metrica/Valor (Gestion de base
// "resumen"); false para hojas horizontales (headers en la fila 0, una fila
// por registro) — Calidad y Trafico son siempre filaUnica:false.
function cargasHojaVacia(aoa, filaUnica) {
  if (!aoa || aoa.length === 0) return true;
  if (filaUnica) {
    // vertical: vacia si ninguna fila [label, valor] trae un valor no vacio
    // (se ignora la fila de encabezado "Metrica"/"Valor", igual que
    // cargasParseFilaUnica, para no contar el propio encabezado como dato).
    return !aoa.some(function (row) {
      if (!row || row.length < 2) return false;
      if (_cargasNorm(row[0]) === 'metrica' || _cargasNorm(row[0]) === 'métrica') return false;
      return row[1] != null && String(row[1]).trim() !== '';
    });
  }
  // horizontal: vacia si no hay ninguna fila de datos mas alla del encabezado.
  return aoa.slice(1).every(function (row) { return !row || row.every(function (v) { return v === '' || v == null; }); });
}

// Procesa UNA hoja del archivo consolidado contra su definicion del plan
// (`cargasPlanConsolidado`). `parseFn(aoa)` es el parser YA EXISTENTE que
// corresponde a este tipo de hoja (cargasParseFilaUnica/MultiFila para
// 'seccion', cmParseRows para 'calidad', traficoParseFilas para 'trafico') —
// se inyecta en vez de requerirlo aqui para que este archivo siga sin
// depender de calidad-carga-masiva-logic.js ni trafico-logic.js.
// `nombresHojasArchivo`: TODOS los nombres de pestana que trae el workbook
// subido (wb.SheetNames) -- solo se usa para armar el mensaje del caso
// "hoja ausente" de abajo, nunca para decidir si una hoja aplica (eso lo
// sigue decidiendo unicamente el plan de esta campana especifica).
//
// Reglas (pedido explicito, para que una hoja mala nunca bloquee las demas):
//  - hoja AUSENTE del archivo (ninguna pestana con ese nombre exacto) ->
//    ERROR de SOLO esa hoja. Antes de este fix se trataba exactamente igual
//    que "vacia" -- una pestana renombrada o borrada por error se perdia en
//    silencio, sin avisar a nadie (hallazgo real de la auditoria del flujo
//    de carga, Fase 30).
//  - hoja PRESENTE pero sin filas de datos -> sigue siendo el caso legitimo
//    de "no aplica esta vez" (`vacia:true`, se omite al guardar, SIN
//    aviso) -- la pestana existe con el nombre correcto, solo que no tiene
//    datos esta vez.
//  - hoja con una celda de formula sin calcular -> se rechaza SOLO esa hoja
//    (reusa la deteccion del PR #31, ahora aplicada a cualquier hoja, no
//    solo a Gestion de base).
//  - hoja con datos que no pasan su propio parser -> se rechaza SOLO esa
//    hoja, con el mensaje exacto que ya da ese parser.
function cargasProcesarHoja(hojaPlan, aoa, ws, parseFn, nombresHojasArchivo) {
  var base = { tipo: hojaPlan.tipo, hoja: hojaPlan.hoja, titulo: hojaPlan.titulo };
  if (!ws) {
    var encontradas = (nombresHojasArchivo || []).join(', ') || '(el archivo no tiene ninguna hoja)';
    return Object.assign({}, base, {
      error: 'No se encontro la hoja "' + hojaPlan.hoja + '" en tu archivo. ' +
        'Si esta seccion no aplica para esta campana, no la borres ni la renombres: dejala vacia. ' +
        'Hojas encontradas en tu archivo: ' + encontradas + '.',
    });
  }
  if (cargasHojaVacia(aoa, hojaPlan.filaUnica)) {
    return Object.assign({}, base, { vacia: true });
  }
  var celdaFormula = cargasDetectarFormulaSinValor(ws);
  if (celdaFormula) {
    return Object.assign({}, base, { error: celdaFormula.mensaje });
  }
  var res = parseFn(aoa);
  if (res.error) return Object.assign({}, base, { error: res.error });
  // Se copia TODO `res` (no solo filas/avisos) para que campos extra que
  // algunos parsers agregan (ej. `canal` de cargasDetectarCanalTrafico,
  // Fase 52) lleguen intactos hasta el flujo de guardado.
  return Object.assign({}, base, res, { avisos: res.avisos || [] });
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cargasColPorLabel: cargasColPorLabel,
    cargasParseFilaUnica: cargasParseFilaUnica,
    cargasParseMultiFila: cargasParseMultiFila,
    cargasDetectarFormulaSinValor: cargasDetectarFormulaSinValor,
    CARGAS_HOJA_TRAFICO: CARGAS_HOJA_TRAFICO,
    CARGAS_HOJA_CALIDAD: CARGAS_HOJA_CALIDAD,
    CARGAS_HOJA_DICCIONARIO: CARGAS_HOJA_DICCIONARIO,
    CARGAS_HOJA_RESUMEN_ASESOR: CARGAS_HOJA_RESUMEN_ASESOR,
    CARGAS_HOJA_INSTRUCCIONES: CARGAS_HOJA_INSTRUCCIONES,
    cargasPlanConsolidado: cargasPlanConsolidado,
    cargasHojaVacia: cargasHojaVacia,
    cargasProcesarHoja: cargasProcesarHoja,
    cargasDetectarCanalTrafico: cargasDetectarCanalTrafico,
  };
}
