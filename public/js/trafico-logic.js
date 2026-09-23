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

// SERVICE_LEVEL_10/20/30SEC: texto "86.49 %" / "1.62%" (con o sin espacio
// antes del %, ambos formatos aparecen en el mismo archivo).
function traficoPctDesdeTexto(v) {
  if (v === null || v === undefined) return null;
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
function traficoParseFilas(aoa) {
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
      var val = parse(row[map[key]]);
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
  var NUM_PONDERADOS = ['asaSegundos', 'ataSegundos', 'ahtSegundos', 'waitTimeSegundos'];

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
    var peso = Number(f.totalLlamadas) || 0;
    b.totalLlamadas += peso;
    b.contestadas += Number(f.contestadas) || 0;
    if (f.llamadasAbandonadas != null) { b.llamadasAbandonadas += f.llamadasAbandonadas; b._tieneAbandonadas = true; }
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) {
      if (f[k] != null && peso > 0) { b['_suma_' + k] += f[k] * peso; b['_peso_' + k] += peso; }
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
// ponderado por TOTAL LLAMADAS de cada fila, nunca un promedio simple de
// promedios diarios), asi que un numero calculado con esta funcion
// SIEMPRE coincide con lo que se ve en la sub-pestaña "AHT" de Trafico de
// Llamadas para el mismo conjunto de filas (Fase 65: conecta la tarjeta
// "AHT Promedio" de la franja global de 6 clientes a este mismo calculo,
// en vez de un dato manual de Gestion de base que puede desincronizarse).
function traficoAhtPromedioPeriodo(filas) {
  var suma = 0, peso = 0;
  (filas || []).forEach(function (f) {
    var w = Number(f.totalLlamadas) || 0;
    if (f.ahtSegundos != null && w > 0) { suma += f.ahtSegundos * w; peso += w; }
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
    traficoFechaDesdeSerial: traficoFechaDesdeSerial,
    traficoParseFecha: traficoParseFecha,
    traficoSegundosDesdeFraccionDia: traficoSegundosDesdeFraccionDia,
    traficoPctDesdeTexto: traficoPctDesdeTexto,
    traficoPctDesdeFraccion: traficoPctDesdeFraccion,
    traficoNumero: traficoNumero,
    traficoParseFilas: traficoParseFilas,
    traficoVentana12Meses: traficoVentana12Meses,
    traficoPeriodoDe: traficoPeriodoDe,
    traficoFiltrarFilas: traficoFiltrarFilas,
    traficoAgregar: traficoAgregar,
    traficoAhtPromedioPeriodo: traficoAhtPromedioPeriodo,
    traficoResolverSkillsControles: traficoResolverSkillsControles,
    traficoModoDisplaySkills: traficoModoDisplaySkills,
    traficoValidarNuevoMapeo: traficoValidarNuevoMapeo,
  };
}
