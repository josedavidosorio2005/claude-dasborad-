// trafico-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del modulo de Trafico de Llamadas: parseo del export
// de Volvox (hoja DATA) y agregacion por dia/mes/anio para la grafica y los
// KPIs. Doble modo como esc.js: global en el navegador (se carga por
// <script>) y require() en Node para las pruebas
// (server/tests/trafico-logic.test.js), que corren esta MISMA logica contra
// el fixture real server/tests/fixtures/EJEMPLO.xlsx — nunca una version
// inventada.
//
// El servidor NUNCA abre el Excel: esto se ejecuta en el navegador (o en el
// proceso de test que simula el navegador), y el servidor solo recibe las
// filas ya parseadas como JSON (mismo patron que cargas.js / metas.js NSD).
'use strict';

// fecha-limites-logic.js: global en el navegador (se carga antes por
// <script>), require() en Node para las pruebas -- ver ese archivo para
// el criterio de "fecha futura" (fin del mes en curso, hora Colombia).
var _traficoFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas del export de Volvox (hoja DATA) ───────────────────────────
// El emparejamiento es por NOMBRE de columna (normalizado), nunca por
// posicion: si Volvox reordena o agrega columnas, esto sigue funcionando.
// Solo 4 son obligatorias; el resto, si faltan, la metrica queda NULL (no
// en 0 — 0% es un dato real, "sin dato" es otra cosa).
var TRAFICO_COLUMNAS = [
  { key: 'skillName', label: 'SKILL_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'totalLlamadas', label: 'TOTAL LLAMADAS', obligatoria: true },
  { key: 'contestadas', label: 'LLAMADAS CONTESTADAS', obligatoria: true },
  { key: 'llamadasAbandonadas', label: 'LLAMADAS ABANDONADAS' },
  { key: 'serviceLevel10secPct', label: 'SERVICE_LEVEL_10SEC' },
  { key: 'serviceLevel20secPct', label: 'SERVICE_LEVEL_20SEC' },
  { key: 'serviceLevel30secPct', label: 'SERVICE_LEVEL_30SEC' },
  // ABANDON (columna propia de Volvox) se dejo de leer en la Fase 45: no se
  // graficaba ni se exportaba en ningun lado -- tasaAbandonoPct (mas abajo)
  // ya cubre ese dato, recalculado EXACTO desde abandonadas/total en vez de
  // depender del % que reporta Volvox. El campo sigue existiendo en la
  // columna calidad_nivel_servicio_diario.abandonPct de la base (cargas
  // viejas lo conservan); solo se retiro de este parseo hacia adelante.
  { key: 'asaSegundos', label: 'ASA' },
  { key: 'ataSegundos', label: 'ATA' },
  { key: 'waitTimeSegundos', label: 'WAIT_TIME' },
  { key: 'ahtSegundos', label: 'AHT' },
  { key: 'nivelAtencionPct', label: 'NIVEL DE ATENCION' },
  { key: 'tasaAbandonoPct', label: 'TASA DE ABNDONO' }, // sic: asi viene de Volvox, no "corregir"
];
var TRAFICO_COLUMNAS_OBLIGATORIAS = TRAFICO_COLUMNAS.filter(function (c) { return c.obligatoria; });

function traficoNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// Fase 75: la pantalla vieja "Metas Calidad -> Trafico/Wolkvox" (trafico.js,
// procesarArchivoTrafico) solo leia la hoja "DATA" -- la plantilla unificada
// (Fase 66, ORLANT) trae la hoja "LLAMADAS" en su lugar, con las MISMAS
// columnas (traficoColIndexMap empareja por nombre, no por posicion), asi
// que basta con preferirla si el archivo la trae. Los archivos viejos (hoja
// "DATA", o cualquier otro nombre) siguen cayendo exactamente en el mismo
// comportamiento de siempre.
function traficoElegirHoja(sheetNames) {
  var nombres = sheetNames || [];
  if (nombres.indexOf('LLAMADAS') !== -1) return 'LLAMADAS';
  if (nombres.indexOf('DATA') !== -1) return 'DATA';
  return nombres[0];
}

// Point 10 del pedido de Edwin: nunca confiar en una fila TOTAL/resumen de
// la base como si fuera una linea real — Volvox (o quien la genere) a veces
// deja una fila de cierre con SKILL_NAME tipo "TOTAL", "TOTAL GENERAL",
// "TOTALES", etc. Si esa fila tuviera ademas una fecha valida, se sumaria
// como una skill mas y duplicaria el conteo. Deteccion por palabra completa
// (no substring) para no descartar una skill real que solo contenga "total"
// como parte de un nombre mas largo por casualidad.
var TRAFICO_SKILL_TOTAL_RE = /^(gran\s+)?total(es)?(\s+general(es)?)?$/i;
function traficoEsFilaTotal(skillName) {
  return TRAFICO_SKILL_TOTAL_RE.test(String(skillName == null ? '' : skillName).trim());
}

function traficoColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = traficoNorm(h);
    var col = TRAFICO_COLUMNAS.filter(function (c) { return traficoNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// ── Conversiones puras (cada una testeada por separado) ─────────────────

// Serial de Excel (dias desde 1899-12-30, incluye el bug del "29-feb-1900"
// que Excel replica a proposito) -> 'YYYY-MM-DD'. Aritmetica directa sobre
// UTC (25569 = serial de 1970-01-01): NUNCA se usa Date+cellDates de
// SheetJS para esto, porque en algunos entornos esa via interpreta el
// serial con la zona horaria local y puede desplazar el dia calendario.
function traficoFechaDesdeSerial(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var d = new Date(Math.round((n - 25569) * 86400000));
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

// DATE: normalmente serial numerico (fecha nativa de Excel). Defensivamente
// tambien acepta texto ya formateado, por si algun export viene distinto.
//
// Fase 90 (tema B, hallazgo real: texto "dd/mm/aaaa" -- formato colombiano
// -- caia en `new Date(t)`, que en V8 asume MM/DD/AAAA (locale en-US). Con
// dia <= 12 esto NO fallaba: daba una fecha VALIDA pero CORRIDA en
// silencio (ej. "03/04/2026", 3 de abril, se leia como 4 de marzo -- mes Y
// dia cambiados, sin ningun aviso). Con dia > 12 si fallaba (null, fila
// descartada con aviso) -- inconsistente y peligroso justo en el caso mas
// comun. Ahora usa el MISMO parseo manual dd/mm/aaaa (nunca `new
// Date(texto)`) que ya usan tipificacion-logic.js/agendas-logic.js -- el
// fallback generico de `new Date(t)` se mantiene SOLO para el resto de
// formatos de texto no numericos/no dd-mm-aaaa que pudiera traer un
// export distinto.
var TRAFICO_FECHA_TEXTO_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
function traficoParseFecha(v) {
  if (typeof v === 'number') return traficoFechaDesdeSerial(v);
  if (v instanceof Date && !isNaN(v)) {
    return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0');
  }
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return traficoFechaDesdeSerial(Number(t));
    var mDmy = TRAFICO_FECHA_TEXTO_RE.exec(t);
    if (mDmy) {
      var dd = parseInt(mDmy[1], 10), mm = parseInt(mDmy[2], 10), aaaa = parseInt(mDmy[3], 10);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
      return aaaa + '-' + pad2(mm) + '-' + pad2(dd);
    }
    var d2 = new Date(t);
    if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
  }
  return null;
}

// WAIT_TIME / AHT: hora nativa de Excel = fraccion de dia (0.002488... ->
// 3:35 -> 215s). Vacio -> null (no 0 segundos, que seria un dato real).
function traficoSegundosDesdeFraccionDia(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 86400);
}

// Fase 88: referencia de celda ('A1', 'B2', ...) sin depender de la
// libreria XLSX (este archivo es "puro", sin ninguna dependencia externa)
// -- para leer ws[ref] del worksheet crudo de SheetJS (t/z de cada celda),
// que SI llega desde cargas.js (que ya tiene XLSX cargado).
function traficoCeldaRef(fila0based, col0based) {
  var col = '';
  var n = col0based;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return col + (fila0based + 1);
}

// Clasifica la celda NUMERICA de una columna de porcentaje segun su
// formato REAL de Excel (nunca segun su valor): 'porcentaje' si la celda
// es numerica (t:'n') y su formato (z) contiene "%" (Excel guarda la
// FRACCION, 0.8649, y la muestra como "86.49%"); 'numero' si es numerica
// pero SIN formato de porcentaje (se toma tal cual, igual que siempre);
// null si no hay informacion de formato disponible (ws ausente, celda de
// texto, o celda vacia) -- en null, el llamador cae al comportamiento de
// SIEMPRE (nunca se adivina por el valor solo).
function traficoClasificarCeldaNumerica(ws, fila0based, col0based) {
  if (!ws) return null;
  var cell = ws[traficoCeldaRef(fila0based, col0based)];
  if (!cell || cell.t !== 'n') return null;
  return (cell.z && cell.z.indexOf('%') !== -1) ? 'porcentaje' : 'numero';
}

// Fase 115 (hallazgo real, archivo de ORLANT ago-sep/2026): WAIT_TIME/AHT
// vienen en Excel con formato de HORA real ("h:mm:ss") -- SheetJS, al leer
// con cellNF:true (necesario para la clasificacion de % de arriba), convierte
// esas celdas numericas a un objeto Date dentro de
// XLSX.utils.sheet_to_json(ws,{header:1}) (nunca en el worksheet crudo `ws`,
// que SIEMPRE conserva el numero original). Esa conversion depende de la
// ZONA HORARIA del navegador: verificado que con TZ=UTC el Date resultante
// es exacto, pero con America/Bogota (la zona del equipo que sube el
// archivo, la misma de Edwin) el motor de V8 le aplica la hora solar media
// historica de Bogota (-4:56:16, vigente en Colombia antes de 1914, que
// Node/Chrome todavia aplican para fechas de 1899) -- el Date queda
// corrido por ese desfase y WAIT_TIME/AHT se leian como null en vez del
// segundo real. En vez de intentar deshacer esa conversion (dependeria de
// la zona horaria de quien suba el archivo, fragil), se recupera el valor
// NUMERICO original directamente de la celda cruda (`ws`), que SheetJS
// nunca altera -- mismo patron que traficoClasificarCeldaNumerica.
// Sin `ws` (o si la celda cruda no es numerica), se devuelve `v` tal cual.
function traficoValorCrudoSiFechaBoxeada(v, ws, fila0based, col0based) {
  if (!(v instanceof Date) || !ws) return v;
  var cell = ws[traficoCeldaRef(fila0based, col0based)];
  return (cell && cell.t === 'n' && typeof cell.v === 'number') ? cell.v : v;
}

// SERVICE_LEVEL_10/20/30SEC: texto "86.49 %" / "1.62%" (con o sin espacio
// antes del %, ambos formatos aparecen en el mismo archivo real de Edwin
// -- ese camino NO CAMBIA con la Fase 88, sigue igual).
//
// `clasificacion` (Fase 88, opcional): resultado de
// traficoClasificarCeldaNumerica para ESTA celda. Solo importa cuando `v`
// es un NUMERO (celda numerica real de Excel, no texto escrito a mano):
// - 'porcentaje': la celda tiene formato de porcentaje real -> el valor
//   guardado es la FRACCION (0.8649 -> se convierte a 86.49).
// - 'numero' / null / undefined: SIN formato de porcentaje o sin
//   informacion de formato -- se toma tal cual, exactamente el mismo
//   comportamiento que antes de la Fase 88 (nunca se adivina "si es <=1
//   es fraccion", porque un 0.56% real escrito como numero terminaria
//   multiplicado por error). La columna se marca aparte como ambigua si
//   TODOS sus valores numericos sin formato son <=1 (ver traficoParseFilas).
function traficoPctDesdeTexto(v, clasificacion) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && clasificacion === 'porcentaje') {
    return Number.isFinite(v) ? Math.round(v * 10000) / 100 : null;
  }
  var s = String(v).trim();
  if (s === '') return null;
  var m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*%?$/);
  if (!m) return null;
  var n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// NIVEL DE ATENCION / TASA DE ABNDONO: fraccion decimal (0.9838 -> 98.38).
function traficoPctDesdeFraccion(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100 * 100) / 100;
}

// ASA / ATA / TOTAL LLAMADAS / etc.: numero, venga como numero o como texto.
function traficoNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ── Parseo de filas (aoa = array-of-arrays, como devuelve
// XLSX.utils.sheet_to_json(ws, {header:1}), fila 0 = encabezados) ───────
//
// Devuelve { error } si falta una columna obligatoria (no procesa nada), o
// { filas, avisos, skills, meses } con las filas validas + un aviso por
// cada fila descartada y por que (mismo patron que cargas.js / NSD).
//
// `ws` (Fase 88, opcional): worksheet CRUDO de SheetJS (con `cellNF:true`
// al leer el workbook) -- si viene, SERVICE_LEVEL_10/20/30SEC usan el
// FORMATO real de cada celda (ver traficoClasificarCeldaNumerica) en vez
// de adivinar por el valor. Sin `ws` (o con una version vieja de SheetJS
// sin cellNF), el comportamiento es EXACTAMENTE igual al de antes.
function traficoParseFilas(aoa, ws) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = traficoColIndexMap(aoa[0]);
  var faltantes = TRAFICO_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube el archivo tal cual lo descargas de Volvox (hoja DATA), sin recortar columnas.',
    };
  }

  var filas = [];
  var avisos = [];
  var skillsSet = {};
  var mesesSet = {};

  // Fase 88: si TODOS los valores numericos de una columna SERVICE_LEVEL_*
  // que llegan SIN formato de porcentaje son <=1 (ej. toda la columna en
  // 0.x), es ambiguo -- podria ser una fraccion (multiplicar x100) o un
  // valor real ya en escala 0-100 (un service level de menos del 1% es
  // posible pero raro). En vez de adivinar, se avisa UNA vez por columna
  // para que la persona revise antes de confirmar la carga; el valor
  // parseado NO cambia (mismo comportamiento de siempre).
  if (ws) {
    ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct'].forEach(function (key) {
      if (map[key] === undefined) return;
      var col = TRAFICO_COLUMNAS.filter(function (c) { return c.key === key; })[0];
      var valoresSinFormato = [];
      for (var r = 1; r < aoa.length; r++) {
        var raw = aoa[r] ? aoa[r][map[key]] : undefined;
        if (typeof raw !== 'number') continue;
        if (traficoClasificarCeldaNumerica(ws, r, map[key]) === 'numero') valoresSinFormato.push(raw);
      }
      if (valoresSinFormato.length && valoresSinFormato.every(function (v) { return v <= 1; })) {
        avisos.push(
          'La columna "' + col.label + '" trae valores numericos <= 1 sin formato de porcentaje en Excel ' +
          '(ej. 0.56) -- no se adivino si son fracciones (x100) o ya estan en escala 0-100. Revisa esta columna antes de confirmar.'
        );
      }
    });
  }

  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v == null; })) continue;
    var filaNum = i + 1;

    var fecha = traficoParseFecha(row[map.fecha]);
    var skillName = row[map.skillName] == null ? '' : String(row[map.skillName]).trim();
    var totalLlamadas = traficoNumero(row[map.totalLlamadas]);
    var contestadas = traficoNumero(row[map.contestadas]);

    // MES/AÑO son redundantes con DATE y no alcanzan para reconstruir un
    // dia completo (no hay dia-del-mes en ellas) — si DATE no es valida, la
    // fila se descarta explicando por que, en vez de inventar un dia.
    if (!fecha) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia (MES/AÑO no bastan para reconstruir el dia), se omitio.'); continue; }
    if (!skillName) { avisos.push('Fila ' + filaNum + ' (' + fecha + '): SKILL_NAME vacio, se omitio.'); continue; }
    if (traficoEsFilaTotal(skillName)) { avisos.push('Fila ' + filaNum + ' (' + fecha + '): SKILL_NAME "' + skillName + '" parece una fila TOTAL/resumen de la base, se omitio (nunca se suma como si fuera una linea real).'); continue; }
    if (totalLlamadas === null || totalLlamadas < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): TOTAL LLAMADAS invalido, se omitio.'); continue; }
    if (contestadas === null || contestadas < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): LLAMADAS CONTESTADAS invalido, se omitio.'); continue; }
    if (contestadas > totalLlamadas) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): contestadas (' + contestadas + ') supera el total (' + totalLlamadas + '), se omitio.'); continue; }
    // Fase 86 (tema 2, hallazgo real Fase 85): una fecha mal digitada (ej.
    // "2030" en vez de "2026") corre la ventana por defecto del panel a un
    // mes casi vacio -- se rechaza, nunca "posterior a hoy" (un dia
    // cualquiera del mes en curso es valido).
    if (_traficoFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + filaNum + ' (' + skillName + '): DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    if (_traficoFechaLimites.fechaLimitesEsSospechosaAntigua(fecha)) { avisos.push('Fila ' + filaNum + ' (' + skillName + '): DATE ' + fecha + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).'); }

    var fila = {
      fecha: fecha,
      skillName: skillName,
      totalLlamadas: Math.round(totalLlamadas),
      contestadas: Math.round(contestadas),
    };
    var opcionales = [
      ['llamadasAbandonadas', traficoNumero, Math.round],
      ['serviceLevel10secPct', traficoPctDesdeTexto, null],
      ['serviceLevel20secPct', traficoPctDesdeTexto, null],
      ['serviceLevel30secPct', traficoPctDesdeTexto, null],
      ['asaSegundos', traficoNumero, null],
      ['ataSegundos', traficoNumero, null],
      ['waitTimeSegundos', traficoSegundosDesdeFraccionDia, null],
      ['ahtSegundos', traficoSegundosDesdeFraccionDia, null],
      ['nivelAtencionPct', traficoPctDesdeFraccion, null],
      ['tasaAbandonoPct', traficoPctDesdeFraccion, null],
    ];
    opcionales.forEach(function (spec) {
      var key = spec[0], parse = spec[1], post = spec[2];
      if (map[key] === undefined) return; // columna no vino en el archivo -> no se toca (queda ausente, no null explicito)
      var clasif = ws ? traficoClasificarCeldaNumerica(ws, i, map[key]) : null;
      var crudo = traficoValorCrudoSiFechaBoxeada(row[map[key]], ws, i, map[key]);
      var val = parse(crudo, clasif);
      if (val !== null) fila[key] = post ? post(val) : val;
    });

    filas.push(fila);
    skillsSet[skillName] = true;
    mesesSet[fecha.slice(0, 7)] = true;
  }

  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos validas.' };
  return {
    filas: filas,
    avisos: avisos,
    skills: Object.keys(skillsSet).sort(),
    meses: Object.keys(mesesSet).sort(),
  };
}

// Ventana movil de 12 meses (pedido explicito de Edwin, llamada 2026-09-15):
// el panel de trafico, al abrirse SIN un filtro de fechas explicito, nunca
// debe acumular años indefinidamente — siempre muestra los ultimos 12 meses
// CALENDARIO con datos, y al aparecer un mes nuevo se cae automaticamente el
// mas antiguo (ej. al llegar datos de enero-2027, se deja de ver enero-2026).
// Devuelve el primer dia ('YYYY-MM-DD') del mes que abre esa ventana de 12
// meses terminando en el mes de `maxDispFecha` — o `minDispFecha` si hay
// menos de 12 meses de historia disponible (nunca antes del primer dato
// real). El filtro de fechas explicito (Desde/Hasta en el panel) sigue
// existiendo aparte y SIEMPRE tiene prioridad: esto solo calcula el valor
// por defecto cuando el usuario no eligio nada.
function traficoVentana12Meses(maxDispFecha, minDispFecha) {
  if (!maxDispFecha) return minDispFecha || null;
  var y = Number(maxDispFecha.slice(0, 4));
  var m = Number(maxDispFecha.slice(5, 7));
  // Date.UTC maneja el "underflow" de mes (ej. mes -2) corriendo el año
  // hacia atras solo, sin aritmetica manual propensa a errores.
  var d = new Date(Date.UTC(y, m - 1 - 11, 1));
  var desde = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-01';
  if (minDispFecha && minDispFecha > desde) return minDispFecha;
  return desde;
}

// ── Agregacion por granularidad (dia/mes/anio) + combinar/separar skills ──
//
// SIEMPRE suma los volumenes primero y recalcula los % desde esa suma —
// nunca promedia los % diarios. `nivelAtencionPct` y `tasaAbandonoPct` (las
// dos que importan para la grafica principal y sus KPIs) se recalculan de
// forma EXACTA como contestadas/total y abandonadas/total del periodo ya
// agregado. Los demas % que reporta Volvox (SERVICE_LEVEL_*) no
// tienen un numerador propio disponible aqui, asi que se agregan como
// promedio PONDERADO por TOTAL LLAMADAS del periodo (mejor aproximacion
// posible sin inventar datos; sigue sin ser un promedio simple de %).
function traficoPeriodoDe(fecha, granularidad) {
  if (granularidad === 'anio') return fecha.slice(0, 4);
  if (granularidad === 'mes') return fecha.slice(0, 7);
  return fecha;
}

function traficoFiltrarFilas(filas, opts) {
  opts = opts || {};
  var skills = opts.skills && opts.skills.length ? opts.skills : null;
  return filas.filter(function (f) {
    if (skills && skills.indexOf(f.skillName) === -1) return false;
    if (opts.sede && f.sede !== opts.sede) return false;
    if (opts.desde && f.fecha < opts.desde) return false;
    if (opts.hasta && f.fecha > opts.hasta) return false;
    return true;
  });
}

function traficoAgregar(filas, opts) {
  opts = opts || {};
  var granularidad = opts.granularidad || 'dia';
  var combinar = opts.combinar !== false;

  var buckets = {};
  var orden = [];
  var PCT_PONDERADOS = ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct'];
  // Fase 77 (hallazgo real de Edwin, 25/09): NO todos los numeros de tiempo
  // se ponderan por lo mismo. SL sigue por TOTAL (esta bien: el nivel de
  // servicio se mide sobre todas las llamadas que entraron). AHT/ASA son
  // tiempo por llamada CONTESTADA (Average Handle Time / Average Speed of
  // Answer) -- una llamada abandonada nunca la atiende un agente, no tiene
  // AHT ni ASA, asi que no debe pesar en su promedio. WAIT_TIME queda
  // ponderado por total (su definicion no depende de si la llamada se
  // contesto).
  // Fase 120 (verificacion contra el archivo real de ago-sep/2026, pedido
  // explicito de confirmar si el 0.0 de ATA en ~91% de las filas se estaba
  // tratando bien): ATA (Average Time to Abandon) es un tiempo por llamada
  // ABANDONADA, igual que AHT/ASA lo son por CONTESTADA -- una llamada que
  // se contesto nunca abandona, no tiene ATA. Ponderarlo por TOTAL (como
  // quedo en la Fase 77, "sin evidencia de que este mal") diluye el
  // promedio con dias de mucho volumen y pocos o ningun abandono: contra el
  // archivo real, el promedio de agosto quedaba en 350.92s ponderado por
  // total vs 625.13s ponderado por abandonadas (el numero correcto) --
  // practicamente la mitad del valor real. Ahora ATA pondera por
  // llamadasAbandonadas, igual que AHT/ASA ponderan por contestadas.
  var PONDERADOS_POR_TOTAL = ['waitTimeSegundos'];
  var PONDERADOS_POR_CONTESTADAS = ['asaSegundos', 'ahtSegundos'];
  var PONDERADOS_POR_ABANDONADAS = ['ataSegundos'];
  var NUM_PONDERADOS = PONDERADOS_POR_TOTAL.concat(PONDERADOS_POR_CONTESTADAS).concat(PONDERADOS_POR_ABANDONADAS);

  filas.forEach(function (f) {
    var periodo = traficoPeriodoDe(f.fecha, granularidad);
    var clave = combinar ? periodo : periodo + ' ' + f.skillName;
    if (!buckets[clave]) {
      var b0 = {
        periodo: periodo, skillName: combinar ? null : f.skillName,
        totalLlamadas: 0, contestadas: 0, llamadasAbandonadas: 0, _tieneAbandonadas: false,
      };
      PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { b0['_suma_' + k] = 0; b0['_peso_' + k] = 0; });
      buckets[clave] = b0;
      orden.push(clave);
    }
    var b = buckets[clave];
    var pesoTotal = Number(f.totalLlamadas) || 0;
    var pesoContestadas = Number(f.contestadas) || 0;
    var pesoAbandonadas = Number(f.llamadasAbandonadas) || 0;
    b.totalLlamadas += pesoTotal;
    b.contestadas += pesoContestadas;
    if (f.llamadasAbandonadas != null) { b.llamadasAbandonadas += f.llamadasAbandonadas; b._tieneAbandonadas = true; }
    PCT_PONDERADOS.concat(PONDERADOS_POR_TOTAL).forEach(function (k) {
      if (f[k] != null && pesoTotal > 0) { b['_suma_' + k] += f[k] * pesoTotal; b['_peso_' + k] += pesoTotal; }
    });
    PONDERADOS_POR_ABANDONADAS.forEach(function (k) {
      if (f[k] != null && pesoAbandonadas > 0) { b['_suma_' + k] += f[k] * pesoAbandonadas; b['_peso_' + k] += pesoAbandonadas; }
    });
    PONDERADOS_POR_CONTESTADAS.forEach(function (k) {
      if (f[k] != null && pesoContestadas > 0) { b['_suma_' + k] += f[k] * pesoContestadas; b['_peso_' + k] += pesoContestadas; }
    });
  });

  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var promedioPonderado = function (b, k) { return b['_peso_' + k] > 0 ? r2(b['_suma_' + k] / b['_peso_' + k]) : null; };

  return orden.map(function (clave) {
    var b = buckets[clave];
    var out = {
      periodo: b.periodo,
      skillName: b.skillName,
      totalLlamadas: b.totalLlamadas,
      contestadas: b.contestadas,
      llamadasAbandonadas: b._tieneAbandonadas ? b.llamadasAbandonadas : null,
      nivelAtencionPct: b.totalLlamadas > 0 ? r2((b.contestadas / b.totalLlamadas) * 100) : null,
      tasaAbandonoPct: (b.totalLlamadas > 0 && b._tieneAbandonadas) ? r2((b.llamadasAbandonadas / b.totalLlamadas) * 100) : null,
    };
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { out[k] = promedioPonderado(b, k); });
    return out;
  }).sort(function (a, b) {
    if (a.periodo !== b.periodo) return a.periodo < b.periodo ? -1 : 1;
    return (a.skillName || '').localeCompare(b.skillName || '');
  });
}

// AHT promedio de un conjunto de filas YA filtradas (skill/fecha/sede),
// colapsado a UN solo numero en vez de una serie por periodo -- misma
// formula EXACTA que usa traficoAgregar para ahtSegundos (promedio
// ponderado por LLAMADAS CONTESTADAS de cada fila, nunca un promedio
// simple de promedios diarios), asi que un numero calculado con esta
// funcion SIEMPRE coincide con lo que se ve en la sub-pestaña "AHT" de
// Trafico de Llamadas para el mismo conjunto de filas (Fase 65: conecta la
// tarjeta "AHT Promedio" de la franja global de 6 clientes a este mismo
// calculo, en vez de un dato manual de Gestion de base que puede
// desincronizarse).
//
// Fase 77 (hallazgo real de Edwin, reunion 25/09): el peso ANTES era
// `totalLlamadas` -- incorrecto. El AHT es tiempo por llamada ATENDIDA
// (Average Handle Time); una llamada abandonada nunca llega a un agente,
// asi que no tiene AHT y no deberia pesar en el promedio. Con datos reales
// de ORLANT/agosto-2026 el cambio corrige el total de las 2 lineas de 4:33
// a 4:26 (GENERAL de 5:20 a 5:18; 3P no cambia, 3:44, porque ahi
// contestadas y total casi coinciden). Mismo criterio para ASA (tiempo
// hasta que SE CONTESTA la llamada -- tampoco existe si nunca se contesto)
// -- ver traficoAgregar, mas abajo, que comparte esta misma regla.
function traficoAhtPromedioPeriodo(filas) {
  var suma = 0, peso = 0;
  (filas || []).forEach(function (f) {
    var w = Number(f.contestadas) || 0;
    if (f.ahtSegundos != null && w > 0) { suma += f.ahtSegundos * w; peso += w; }
  });
  return peso > 0 ? Math.round((suma / peso) * 100) / 100 : null;
}

// Fase 87 (tema A, nota del jefe: "siempre tener visible el nivel de
// servicio, en Resumen"): colapsa un conjunto de filas YA filtradas (el
// mismo `filtradas` que ya usa la tarjeta "Resumen" para Total/Contestadas/
// Nivel de Atencion) a UN solo numero ponderado por TOTAL LLAMADAS -- mismo
// criterio de peso que traficoAgregar usa para serviceLevel10/20/30secPct
// (el nivel de servicio se mide sobre TODO lo que entro, no solo lo
// contestado). Generica en `campo` para poder reusarse tal cual con
// cualquier columna de nivel de servicio (20s hoy; WhatsApp usa su propia
// version ponderada por TOTAL WHATSAPP, trafico-whatsapp-logic.js). Si
// ninguna fila trae el campo, devuelve null (nunca 0 ni un numero
// inventado) -- la tarjeta debe mostrar "—", no un dato que no existe.
function traficoServiceLevelPromedioPeriodo(filas, campo) {
  var suma = 0, peso = 0;
  (filas || []).forEach(function (f) {
    var w = Number(f.totalLlamadas) || 0;
    if (f[campo] != null && w > 0) { suma += f[campo] * w; peso += w; }
  });
  return peso > 0 ? Math.round((suma / peso) * 100) / 100 : null;
}

// ── Filtro "Skill": desplegable principal + comparador (Fase 60/65) ─────
// Fase 60 introdujo el desplegable "Skill" (una sola linea o "Todas") mas
// un listbox secundario "Comparar varias lineas" para 2+. Bug real de la
// Fase 64: el listbox del comparador podia quedar con una seleccion vieja
// de 2+ lineas (ej. cargada desde una URL compartida) y, si el usuario
// cambiaba el desplegable principal a otra linea SIN tocar el comparador,
// "Aplicar filtros" seguia usando la seleccion vieja del comparador --
// ignoraba la eleccion nueva del usuario. Esta funcion es la fuente unica
// de verdad de "quien manda": el comparador gana SOLO si tiene 2+
// seleccionadas; el resto de las veces manda el desplegable principal. El
// arreglo real (trafico.js) es que el desplegable principal, al cambiar,
// limpia la seleccion del comparador -- asi el comparador NUNCA puede
// "sobrevivir" a una eleccion nueva del usuario en el desplegable. Esta
// funcion pura queda igual de todos modos como ultima linea de defensa y
// para poder probarse sin DOM.
function traficoResolverSkillsControles(seleccionComparador, valorPrincipal) {
  var seleccion = seleccionComparador || [];
  if (seleccion.length >= 2) {
    return { skills: seleccion.slice(), modo: 'multi', skillUna: null };
  }
  if (valorPrincipal && valorPrincipal !== '__multi__') {
    return { skills: [valorPrincipal], modo: 'una', skillUna: valorPrincipal };
  }
  return { skills: [], modo: 'todas', skillUna: null };
}

// Que debe mostrar el desplegable/comparador dado el `estado.skills` YA
// resuelto (post-aplicar-filtros o al cargar desde una URL compartida).
// Misma logica que ya usaba _traficoRenderPanel (Fase 60), factorizada
// para reusarse tambien al re-dibujar la barra de filtros despues de
// aplicar (Fase 65) -- sin esto, el desplegable principal se quedaba
// mostrando una opcion vieja despues de usar el comparador en vivo
// (segundo hallazgo real de la Fase 64).
function traficoModoDisplaySkills(datosSkills, estadoSkills) {
  var todas = estadoSkills.length === datosSkills.length;
  var una = estadoSkills.length === 1 ? estadoSkills[0] : null;
  var subsetParcial = estadoSkills.length > 1 && !todas;
  return { todas: todas, una: una, subsetParcial: subsetParcial };
}

// ── Formulario "Registrar skill nuevo" (mapeo manual Wolkvox -> campana,
// hallazgo de la auditoria del flujo de carga, Fase 30/32) ──────────────
// Valida ANTES de llamar al backend -- reutiliza el mismo PUT que ya usan
// las filas existentes de la tabla de mapeo (`/calidad/trafico/skills/
// :skillName`, un upsert), asi que la unica responsabilidad de esta
// funcion es rechazar con un mensaje claro los casos que ni deberian
// llegar al servidor.
// `skillsExistentes`: nombres de skill que YA tienen fila en
// trafico_skill_mapeo (el ultimo GET, ya en el navegador) -- un SKILL_NAME
// que coincida con uno de ellos se rechaza en vez de dejar que el upsert
// lo reasigne en silencio: la fila que ya existe muestra su campana/filas
// actuales a la vista, mas seguro editarla ahi que pisarla desde un
// formulario que no tiene esa visibilidad (podria mover trafico ya
// cargado a otra campana por un simple typo que coincida con un skill real).
function traficoValidarNuevoMapeo(input) {
  var skillName = String((input && input.skillName) == null ? '' : input.skillName).trim();
  if (!skillName) return { error: 'Escribe el SKILL_NAME real de Wolkvox.' };
  var campana = (input && input.campana) || '';
  if (!campana) return { error: 'Selecciona la campana a la que pertenece este skill.' };
  var sedesDisponibles = (input && input.sedesDisponibles) || [];
  var sede = (input && input.sede) || '';
  if (sedesDisponibles.length && !sede) {
    return { error: 'Esta campana tiene mas de una sede: elige cual sede corresponde a este skill.' };
  }
  var skillsExistentes = (input && input.skillsExistentes) || [];
  if (skillsExistentes.indexOf(skillName) !== -1) {
    return { error: 'El skill "' + skillName + '" ya existe en la tabla de abajo — editalo ahi en vez de registrarlo de nuevo.' };
  }
  return { ok: true, skillName: skillName, campana: campana, sede: sedesDisponibles.length ? sede : null };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRAFICO_COLUMNAS: TRAFICO_COLUMNAS,
    TRAFICO_COLUMNAS_OBLIGATORIAS: TRAFICO_COLUMNAS_OBLIGATORIAS,
    traficoColIndexMap: traficoColIndexMap,
    traficoEsFilaTotal: traficoEsFilaTotal,
    traficoElegirHoja: traficoElegirHoja,
    traficoFechaDesdeSerial: traficoFechaDesdeSerial,
    traficoParseFecha: traficoParseFecha,
    traficoSegundosDesdeFraccionDia: traficoSegundosDesdeFraccionDia,
    traficoPctDesdeTexto: traficoPctDesdeTexto,
    traficoPctDesdeFraccion: traficoPctDesdeFraccion,
    traficoNumero: traficoNumero,
    traficoCeldaRef: traficoCeldaRef,
    traficoClasificarCeldaNumerica: traficoClasificarCeldaNumerica,
    traficoValorCrudoSiFechaBoxeada: traficoValorCrudoSiFechaBoxeada,
    traficoParseFilas: traficoParseFilas,
    traficoVentana12Meses: traficoVentana12Meses,
    traficoPeriodoDe: traficoPeriodoDe,
    traficoFiltrarFilas: traficoFiltrarFilas,
    traficoAgregar: traficoAgregar,
    traficoAhtPromedioPeriodo: traficoAhtPromedioPeriodo,
    traficoServiceLevelPromedioPeriodo: traficoServiceLevelPromedioPeriodo,
    traficoResolverSkillsControles: traficoResolverSkillsControles,
    traficoModoDisplaySkills: traficoModoDisplaySkills,
    traficoValidarNuevoMapeo: traficoValidarNuevoMapeo,
  };
}
