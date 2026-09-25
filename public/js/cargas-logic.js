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
    // autoTrafico (Fase 71, ORLANT/resumen): este dato se calcula solo desde
    // Trafico de Llamadas/WhatsApp -- nunca se guarda desde esta hoja, ni
    // siquiera si un archivo viejo todavia trae un valor (para no pisar en
    // silencio lo que Trafico ya calculo). Solo avisa si de verdad traia
    // algo escrito -- una fila vacia (plantilla vieja sin llenar) no genera
    // ruido.
    if (col.autoTrafico) {
      if (row[1] !== undefined && row[1] !== null && String(row[1]).trim() !== '') {
        avisos.push('Se ignoro "' + col.label + '" -- este dato se toma automaticamente de Trafico de Llamadas/WhatsApp, no hace falta llenarlo a mano.');
      }
      return;
    }
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
// Fase 66: ORLANT pasa de 1 hoja "DATA" (voz o WhatsApp, autodetectada por
// columnas) a 2 hojas separadas y explicitas -- ver cargasPlanConsolidado.
// Los nombres reservados de abajo son EXCLUSIVOS de ese caso; el resto de
// campanas sigue usando CARGAS_HOJA_TRAFICO ('DATA') tal cual siempre.
var CARGAS_HOJA_TRAFICO_LLAMADAS = 'LLAMADAS';
var CARGAS_HOJA_TRAFICO_WHATSAPP = 'WHATSAPP';
var CARGAS_HOJA_CALIDAD = 'Monitoreos';
var CARGAS_HOJA_DICCIONARIO = 'Diccionario';
var CARGAS_HOJA_RESUMEN_ASESOR = 'Resumen por Asesor';
var CARGAS_HOJA_INSTRUCCIONES = 'INSTRUCCIONES';
// Fase 78 (ORLANT, pedido de Jairo/Edwin): agendas (citas asignadas) en su
// propia hoja del archivo consolidado -- mismo criterio que
// CARGAS_HOJA_TRAFICO_LLAMADAS/_WHATSAPP (solo ORLANT, ver
// cargasPlanConsolidado). Los demas clientes no cambian.
var CARGAS_HOJA_AGENDAS = 'AGENDAS';
// Fase 77 (ORLANT, pedido de Edwin/Jairo): tipificacion de Llamadas y
// WhatsApp en 2 hojas propias -- REEMPLAZAN, solo para ORLANT, la hoja
// vieja "tipificacion" (minuscula, seccion generica de dashboard-secciones.js,
// un resumen mensual manual por linea/tipificacion). Un archivo VIEJO que
// todavia traiga esa hoja "tipificacion" sigue cargando exactamente igual
// que siempre (la seccion generica NO se quita de dashboard-secciones.js a
// proposito, ver docs de la Fase 77) -- las 2 hojas nuevas son ADEMAS, no
// en lugar de. Mismo gate que CARGAS_HOJA_AGENDAS (solo cuando
// tipificacionCols viene, hoy solo ORLANT).
var CARGAS_HOJA_TIPIFICACION_LLAMADAS = 'TIPIFICACION_LLAMADAS';
var CARGAS_HOJA_TIPIFICACION_WHATSAPP = 'TIPIFICACION_WHATSAPP';

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
// traficoWppCols (Fase 66, OPCIONAL): cuando se pasa (hoy solo ORLANT), la
// hoja unica "DATA" (voz o WhatsApp autodetectada) se reemplaza por DOS
// hojas explicitas "LLAMADAS"/"WHATSAPP" -- mismos encabezados/orden que la
// plantilla ya aprobada por el cliente. Sin este parametro, el comportamiento
// es IDENTICO al de siempre (1 sola hoja "DATA") -- asi el resto de campanas
// no cambia en nada. Archivos viejos con hoja "DATA" (de cualquier canal)
// siguen aceptandose para ORLANT: ver el fallback en procesarArchivoConsolidado
// (public/js/cargas.js), que es quien resuelve a que hoja real del archivo
// corresponde cada entrada del plan.
function cargasPlanConsolidado(secciones, calidadCols, traficoCols, traficoWppCols, agendasCols, tipificacionCols) {
  var plan = [];
  Object.keys(secciones || {}).forEach(function (key) {
    var s = secciones[key];
    plan.push({
      tipo: 'seccion', hoja: key, titulo: s.titulo, descripcion: s.descripcion,
      filaUnica: !!s.filaUnica, columnas: s.columnas, notasExtra: s.notasExtra || [],
    });
  });
  if (calidadCols) {
    plan.push({
      tipo: 'calidad', hoja: CARGAS_HOJA_CALIDAD, titulo: 'Calidad — Monitoreos',
      descripcion: 'Un monitoreo por fila (una llamada o interaccion evaluada).',
      filaUnica: false, columnas: calidadCols,
    });
  }
  if (traficoWppCols) {
    plan.push({
      tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas (Wolkvox)',
      descripcion: 'Una fila por skill/linea y dia, tal cual el export de voz de Wolkvox.',
      filaUnica: false, columnas: traficoCols,
      notasExtra: [
        'De donde sale: export diario de voz de Wolkvox (una fila por linea/skill y dia).',
        'Ejemplo de fila (NO la escribas en esta hoja de datos, es solo referencia):',
        '  SKILL_NAME=CALL INBOUND ORLANT 3P | DATE=2026-08-03 | TOTAL LLAMADAS=161 | ' +
          'LLAMADAS CONTESTADAS=158 | LLAMADAS ABANDONADAS=3 | AHT=0:03:41',
        'Si vuelves a subir un dia+skill que ya existia, se actualiza en el mismo lugar (no se ' +
          'duplica) — el sistema te muestra antes cuantos registros existentes se van a reemplazar ' +
          'y pide que confirmes.',
        'AHT/WAIT_TIME: si Wolkvox trae "----" en vez de un tiempo (tipico en un dia con 0 llamadas ' +
          'contestadas), deja la celda vacia o tal cual "----" — el sistema la trata como "sin dato" ' +
          'y la excluye del promedio, nunca la cuenta como 0.',
        'Esta nota manda sobre la seccion general "FORMATOS" de mas abajo para estas 2 hojas: ' +
          'SERVICE_LEVEL_10/20/30SEC aceptan "93.55" o "93.55 %" (con o sin el simbolo); AHT y ' +
          'WAIT_TIME van en formato de HORA de Excel (lo que Wolkvox ya trae, se ve como 0:03:41) — ' +
          'nunca en segundos como numero.',
      ],
    });
    plan.push({
      tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp (Wolkvox)',
      descripcion: 'Una fila por cola y periodo (FECHA INICIO..FECHA FIN), tal cual el export de WhatsApp de Wolkvox.',
      filaUnica: false, columnas: traficoWppCols,
      notasExtra: [
        'De donde sale: export de WhatsApp de Wolkvox (una fila por cola y periodo, no por dia).',
        'Ejemplo de fila (NO la escribas en esta hoja de datos, es solo referencia):',
        '  NOMBRE_COLA_WHATSAPP=WHATSAPP ORLANT 3P | FECHA INICIO=2026-08-01 | FECHA FIN=2026-08-31 | ' +
          'TOTAL WHATSAPP=1500 | WHATSAPP CONTESTADOS=1460',
        'Si vuelves a subir una cola+periodo que ya existia, se actualiza en el mismo lugar (no se ' +
          'duplica) — a diferencia de Llamadas, aqui no se pide confirmacion previa, se actualiza directo.',
        'Esta nota manda sobre la seccion general "FORMATOS" de mas abajo para esta hoja: ' +
          'SERVICE_LEVEL_10/20/30SEC aceptan "93.55" o "93.55 %" (con o sin el simbolo).',
      ],
    });
  }
  // Fase 78 (ORLANT, pedido de Jairo/Edwin): agendas (citas asignadas por
  // especialidad) -- hoja propia, solo cuando agendasCols viene (hoy solo
  // ORLANT, mismo gate que traficoWppCols). Sin este parametro, el
  // comportamiento es identico al de siempre (ninguna hoja AGENDAS).
  if (agendasCols) {
    plan.push({
      tipo: 'agendas', hoja: CARGAS_HOJA_AGENDAS, titulo: 'Agendas (citas asignadas)',
      descripcion: 'Una fila por cita agendada, tal cual la exporta el sistema de agendamiento.',
      filaUnica: false, columnas: agendasCols,
      notasExtra: [
        'De donde sale: export del sistema de agendamiento (una fila por cita).',
        'PRIVACIDAD -- NOMBRE_ENTIDAD: si el paciente es PARTICULAR (no tiene EPS/prepagada/aseguradora), ' +
          'escribe "PARTICULAR" en esa columna -- nunca el nombre del paciente. El sistema tambien protege ' +
          'cualquier entidad que aparezca muy pocas veces en el archivo (probablemente el nombre de un ' +
          'paciente escrito por error en esa columna): la agrupa automaticamente como "PARTICULAR / OTRA" ' +
          'antes de guardarla, sin mostrar ni guardar el valor original en ningun caso.',
        'FECHA_SOLICITUD: fecha y hora de Excel (o texto "dd/mm/aaaa hh:mm:ss"), en hora local de Colombia -- ' +
          'no se convierte a UTC.',
        'TIPO DE LINEA: exactamente "3P" o "GENERAL".',
        'Al guardar, la carga REEMPLAZA todo lo que ya exista entre la primera y la ultima FECHA_SOLICITUD ' +
          'de este archivo (el sistema te muestra antes cuantos registros se van a reemplazar y pide que ' +
          'confirmes) -- nunca duplica, aunque subas el mismo archivo mas de una vez.',
      ],
    });
  }
  // Fase 77 (ORLANT, pedido de Edwin/Jairo): tipificacion de Llamadas y
  // WhatsApp -- hoja propia por canal, solo cuando tipificacionCols viene
  // (hoy solo ORLANT, mismo gate que agendasCols). REEMPLAZAN el panel del
  // dashboard que antes leia la hoja vieja "tipificacion" (minuscula, ver
  // arriba) -- esa hoja sigue existiendo y cargando igual (compatibilidad
  // hacia atras), solo que ya nada la muestra en el tab "Tipificacion".
  if (tipificacionCols) {
    var notaVolumen = 'Volumen esperado: varios miles de filas al mes (agosto 2026 trajo ~15.000 solo en Llamadas) -- ' +
      'sube el archivo tal cual lo exporta Wolkvox, sin resumir ni pre-agrupar filas.';
    var notaFormatos = 'DATE acepta "dd/mm/aaaa" o una fecha de Excel; HORA acepta "6:06:08 p. m." (con o sin ' +
      'espacio antes de "m."), "18:06:08" (24 horas) o una hora de Excel -- si no se puede leer, la fila se ' +
      'guarda igual, solo sin HORA. TIME_MIN es el minutaje de la llamada, se guarda para un reporte futuro.';
    plan.push({
      tipo: 'tipificacion', canalTipificacion: 'LLAMADAS', hoja: CARGAS_HOJA_TIPIFICACION_LLAMADAS, titulo: 'Tipificacion de Llamadas',
      descripcion: 'Una fila por llamada tipificada, tal cual el export de Wolkvox.',
      filaUnica: false, columnas: tipificacionCols,
      notasExtra: [
        'De donde sale: export de tipificacion de llamadas de Wolkvox (una fila por llamada).',
        notaVolumen,
        notaFormatos,
        'Al guardar, la carga REEMPLAZA todo lo que ya exista de Llamadas entre la primera y la ultima DATE ' +
          'de este archivo (el sistema te muestra antes cuantos registros se van a reemplazar y pide que ' +
          'confirmes) -- nunca duplica, aunque subas el mismo archivo mas de una vez. Nunca toca WhatsApp.',
      ],
    });
    plan.push({
      tipo: 'tipificacion', canalTipificacion: 'WHATSAPP', hoja: CARGAS_HOJA_TIPIFICACION_WHATSAPP, titulo: 'Tipificacion de WhatsApp',
      descripcion: 'Una fila por conversacion de WhatsApp tipificada, tal cual el export de Wolkvox.',
      filaUnica: false, columnas: tipificacionCols,
      notasExtra: [
        'De donde sale: export de tipificacion de WhatsApp de Wolkvox (una fila por conversacion).',
        'SKILL_NAME (la cola): Wolkvox exporta la cola de WhatsApp como un CODIGO, no el nombre real -- ' +
          'antes de pegar los datos en esta hoja, cruza ese codigo contra la lista real de colas (BUSCARV/' +
          'VLOOKUP) y escribe el NOMBRE de la cola en esta columna, nunca el codigo tal cual.',
        notaVolumen,
        notaFormatos,
        'Al guardar, la carga REEMPLAZA todo lo que ya exista de WhatsApp entre la primera y la ultima DATE ' +
          'de este archivo (el sistema te muestra antes cuantos registros se van a reemplazar y pide que ' +
          'confirmes) -- nunca duplica, aunque subas el mismo archivo mas de una vez. Nunca toca Llamadas.',
      ],
    });
  }
  if (!traficoWppCols) {
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
  }
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

// Fase 66 — decide de que hoja del archivo sale el dato de un slot de
// Trafico con canal fijo (LLAMADAS o WHATSAPP, plantilla unificada de
// ORLANT): si el archivo ya trae la hoja con el nombre nuevo, esa manda. Si
// no, y el archivo trae una hoja "DATA" (formato viejo, un solo canal) cuyo
// canal detectado coincide con el de este slot, se usa esa -- asi un
// archivo viejo (voz o WhatsApp, hoja "DATA") sigue funcionando exactamente
// igual que antes de la Fase 66. "DATA" nunca se le asigna a los dos slots:
// `dataYaUsada` lo marca despues de que un slot ya la reclamo (ver el
// caller, que llama esta funcion una vez por slot, en orden, y propaga el
// resultado). Pura: no toca el workbook, solo decide un nombre de hoja a
// partir de datos ya extraidos por el caller (nombresHojasDisponibles,
// dataDisponible, canalDataDetectado).
function cargasResolverHojaTrafico(hojaPlan, nombresHojasDisponibles, dataDisponible, canalDataDetectado, dataYaUsada) {
  if ((nombresHojasDisponibles || []).indexOf(hojaPlan.hoja) !== -1) {
    return { hojaReal: hojaPlan.hoja, usoData: false };
  }
  if (hojaPlan.canalFijo && dataDisponible && !dataYaUsada && canalDataDetectado === hojaPlan.canalFijo) {
    return { hojaReal: 'DATA', usoData: true };
  }
  return { hojaReal: null, usoData: false };
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
  var base = { tipo: hojaPlan.tipo, hoja: hojaPlan.hoja, titulo: hojaPlan.titulo, canalTipificacion: hojaPlan.canalTipificacion };
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
    CARGAS_HOJA_TRAFICO_LLAMADAS: CARGAS_HOJA_TRAFICO_LLAMADAS,
    CARGAS_HOJA_TRAFICO_WHATSAPP: CARGAS_HOJA_TRAFICO_WHATSAPP,
    CARGAS_HOJA_CALIDAD: CARGAS_HOJA_CALIDAD,
    CARGAS_HOJA_DICCIONARIO: CARGAS_HOJA_DICCIONARIO,
    CARGAS_HOJA_RESUMEN_ASESOR: CARGAS_HOJA_RESUMEN_ASESOR,
    CARGAS_HOJA_INSTRUCCIONES: CARGAS_HOJA_INSTRUCCIONES,
    CARGAS_HOJA_AGENDAS: CARGAS_HOJA_AGENDAS,
    CARGAS_HOJA_TIPIFICACION_LLAMADAS: CARGAS_HOJA_TIPIFICACION_LLAMADAS,
    CARGAS_HOJA_TIPIFICACION_WHATSAPP: CARGAS_HOJA_TIPIFICACION_WHATSAPP,
    cargasPlanConsolidado: cargasPlanConsolidado,
    cargasHojaVacia: cargasHojaVacia,
    cargasProcesarHoja: cargasProcesarHoja,
    cargasDetectarCanalTrafico: cargasDetectarCanalTrafico,
    cargasResolverHojaTrafico: cargasResolverHojaTrafico,
  };
}
