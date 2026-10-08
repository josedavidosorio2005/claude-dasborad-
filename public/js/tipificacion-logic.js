// tipificacion-logic.js — InConexion Platform (Fase 77).
//
// Logica PURA (sin DOM) de "Tipificacion" de ORLANT: parseo de las hojas
// TIPIFICACION_LLAMADAS / TIPIFICACION_WHATSAPP del archivo real de Edwin
// (~15.000 filas/mes). Doble modo como agendas-logic.js: global en el
// navegador, require() en Node para las pruebas
// (server/tests/tipificacion-logic.test.js).
'use strict';

// fecha-limites-logic.js: global en el navegador, require() en Node --
// ver ese archivo para el criterio de "fecha futura".
var _tipificacionFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);
// texto-formato-logic.js (Fase 87, tema C): mismo doble modo, para que
// tipificacionEtiqueta use la MISMA regla de mayuscula inicial/siglas que
// el resto del dashboard.
var _tipificacionTexto = (typeof require === 'function') ? require('./texto-formato-logic.js') : (typeof window !== 'undefined' ? window : this);
// duplicados-exactos-logic.js (Fase 88): mismo doble modo.
var _tipificacionDuplicadosExactos = (typeof require === 'function') ? require('./duplicados-exactos-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas (AGENT_NAME, DATE, HORA, TIME_MIN, DESCRIPTION_COD_ACT,
// SKILL_NAME) -- MES es una formula de Excel del archivo de Edwin
// (=TEXT(B2,"MMMM")), se ignora a proposito: el mes sale de DATE.
// Fase 122 (export HistChat de WhatsApp de Wolkvox, formato NUEVO): ese
// archivo no trae SKILL_NAME, trae en su lugar "NOMBRE DE SKILL" -- mismo
// mecanismo de `labelAlt` que ya usa INASISTENCIA_COLUMNAS
// (inasistencia-logic.js) para ESPECIALIDAD/ESPECIALIDA. Este alias nunca
// cambia el contrato de guardado (sigue siendo la key `skill`, mismo
// payload compacto) ni el formato VIEJO (que sigue trayendo SKILL_NAME
// real): solo amplia que headers reconoce tipificacionColIndexMap.
// Fase 131 (Parte 3, Tipificacion CDR de Mobilize): 5 columnas NUEVAS,
// todas OPCIONALES -- el archivo real de ORLANT (TIPIFICACION_LLAMADAS/
// TIPIFICACION_WHATSAPP) nunca las trae, asi que para ORLANT el
// comportamiento queda EXACTAMENTE igual que siempre (map.xxx ===
// undefined, se guarda null). El CDR real de Mobilize (export completo de
// Wolkvox, hoja "HistCDR<fecha>") SI las trae:
//   - TIME_SEC (duracionSeg): igual que TIME_MIN pero en segundos -- NO es
//     un alias de duracionMin (la unidad es distinta), columna propia.
//   - COD_ACT (codAct): se guarda SIEMPRE como TEXTO -- el archivo real
//     trae casi siempre un numero (400, 401...) pero al menos una fila
//     real trae "TIMEOUTACW" (texto), asi que nunca se valida ni se
//     guarda como entero (ver tipificacionNormTexto mas abajo).
//   - TYPE_INTERACTION (tipoInteraccion): el archivo real solo trae
//     "inbound"/"outbound_ma" -- cualquier otro valor se normaliza a
//     "otro" con un aviso (nunca se inventa cual de los 2 conocidos es).
//   - HUNG_UP (hungUp): quien colgó ("agent"/"customer" en el archivo
//     real) -- se guarda tal cual, sin normalizar valores.
//   - SKILL_ID (skillId): identificador tecnico de la linea/skill, texto.
var TIPIFICACION_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'hora', label: 'HORA', obligatoria: false },
  { key: 'duracionMin', label: 'TIME_MIN', obligatoria: false },
  { key: 'tipificacion', label: 'DESCRIPTION_COD_ACT', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', labelAlt: ['NOMBRE DE SKILL'], obligatoria: true },
  { key: 'duracionSeg', label: 'TIME_SEC', obligatoria: false },
  { key: 'codAct', label: 'COD_ACT', obligatoria: false },
  { key: 'tipoInteraccion', label: 'TYPE_INTERACTION', obligatoria: false },
  { key: 'hungUp', label: 'HUNG_UP', obligatoria: false },
  { key: 'skillId', label: 'SKILL_ID', obligatoria: false },
];
var TIPIFICACION_COLUMNAS_OBLIGATORIAS = TIPIFICACION_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo del payload compacto (arrays, no objetos) -- ver
// tipificacionFilaComoArray. Mismo motivo que Agendas (Fase 78): a
// ~15.000-30.000 filas, un objeto con las claves repetidas por fila pesa
// bastante mas que un array posicional. Las 5 columnas nuevas de la Fase
// 131 van AL FINAL -- debe coincidir EXACTO, en este mismo orden, con
// CAMPOS_FILA (server/tipificaciones.js) y tipificacionFilaArraySchema
// (server/validation.js); cambiar el orden en uno sin los otros 2
// mezclaria columnas en silencio.
var TIPIFICACION_ORDEN_ARRAY = ['agente', 'fecha', 'hora', 'duracionMin', 'tipificacion', 'skill', 'duracionSeg', 'codAct', 'tipoInteraccion', 'hungUp', 'skillId'];

// PRIVACIDAD (Fase 131, Parte 3): el CDR real de Mobilize/Wolkvox trae
// columnas con datos personales/comerciales que esta plataforma JAMAS lee
// ni guarda ni exporta -- TELEPHONE, CUSTOMER_ID, CONN_ID, AGENT_ID,
// DESTINY, COST, COMMENT (texto libre, lleno en todas las filas reales).
// Ninguna de esas 7 columnas aparece arriba en TIPIFICACION_COLUMNAS a
// proposito: tipificacionColIndexMap solo sabe buscar las columnas de esa
// lista, asi que estas 7 nunca se mapean, nunca llegan a `filas`, nunca
// llegan al servidor. COD_ACT_2/DESCRIPTION_COD_ACT_2 (siempre "-" en el
// archivo real) tampoco se leen -- no aportan nada, se ignoran igual que
// las de PII. Ver server/tests/fase131-tipificacion-cdr-privacidad.test.js
// (prueba que falla si alguna de estas 7 columnas llegara a mapearse).
var TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS = ['TELEPHONE', 'CUSTOMER_ID', 'CONN_ID', 'AGENT_ID', 'DESTINY', 'COST', 'COMMENT'];

// Listas CONFIGURABLES (Fase 131, decision tomada con el usuario, pendiente
// de confirmar con Edwin -- nunca hardcodeadas mas adentro del parseo):
//   - Codificaciones que se EXCLUYEN de la carga (filas de prueba mezcladas
//     con datos reales, ej. DESCRIPTION_COD_ACT="PRUEBA"/COD_ACT=400).
//   - Codificaciones que, en una llamada SALIENTE (TYPE_INTERACTION=
//     outbound_ma), cuentan como "NO conectada" -- cualquier otra
//     codificacion en una saliente cuenta como "conectada" (Regla B,
//     confirmada contra el archivo real: 52 conectadas/15 no conectadas de
//     67 salientes -- la Regla A, TIME_SEC>0, se descarto por inutil: el
//     archivo real trae las 67 con TIME_SEC>0, sin poder de discriminacion).
var TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO = ['PRUEBA'];
var TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO = ['Cliente_no_contesta'];
var TIPIFICACION_CDR_TIPO_INTERACCION_VALIDOS = ['inbound', 'outbound_ma'];

function tipificacionNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function tipificacionColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = tipificacionNorm(h);
    var col = TIPIFICACION_COLUMNAS.filter(function (c) {
      if (tipificacionNorm(c.label) === n) return true;
      return (c.labelAlt || []).some(function (alt) { return tipificacionNorm(alt) === n; });
    })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Trim + colapsar espacios dobles -- mismo criterio que el resto de la
// plataforma (agendasNormTexto, traficoNorm...), sin forzar mayusculas ni
// cambiar ningun otro caracter. DESCRIPTION_COD_ACT se guarda con este
// mismo tratamiento (el valor ORIGINAL, incluido "-" tal cual) -- el
// reemplazo "_ -> espacio" / "- -> Sin tipificacion" es solo de
// PRESENTACION (ver tipificacionEtiqueta), nunca se aplica al guardar.
function tipificacionNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// ── DATE: texto "dd/mm/aaaa" o serial de Excel (fecha, sin hora) ────────
function tipificacionParseFecha(v) {
  if (typeof v === 'number') {
    var n = Math.floor(v); // DATE no trae hora -- por si algun archivo la trajera pegada, se descarta (HORA es columna aparte)
    var ms = Math.round((n - 25569) * 86400000);
    var d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    var y = d.getUTCFullYear();
    if (y < 1970 || y > 2200) return null;
    var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return y + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (!m) return null;
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), aaaa = parseInt(m[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var pad2b = function (x) { return (x < 10 ? '0' : '') + x; };
    return aaaa + '-' + pad2b(mm) + '-' + pad2b(dd);
  }
  return null;
}

// ── HORA: texto "H:MM:SS a. m./p. m." (con espacio normal O NO separable
//   antes de "m."), texto de 24h "HH:MM:SS", o serial de Excel
// (fraccion de dia) -- Edwin: hora LOCAL de Colombia, nunca se convierte a
// UTC. No bloquea la fila si no se puede leer (no se usa para filtrar
// hoy, solo se guarda para uso futuro) -- devuelve null en vez de fallar.
var TIPIFICACION_HORA_AMPM_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i;
var TIPIFICACION_HORA_24H_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
function tipificacionParseHora(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    var fraccion = v - Math.floor(v);
    var totalSeg = Math.round(fraccion * 86400);
    if (totalSeg < 0 || totalSeg >= 86400) return null;
    var hh0 = Math.floor(totalSeg / 3600), mm0 = Math.floor((totalSeg % 3600) / 60), ss0 = totalSeg % 60;
    var p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return p2(hh0) + ':' + p2(mm0) + ':' + p2(ss0);
  }
  if (typeof v !== 'string') return null;
  // Normaliza CUALQUIER espacio (incluido el espacio NO separable que
  // trae "p. m." en el archivo real de Edwin -- s de JS ya lo cubre) a
  // espacio comun antes de comparar contra los patrones -- sin esto,
  // "6:06:08 p. m." no calzaria contra un regex con espacio literal.
  var t = v.replace(/s+/g, ' ').trim();
  if (t === '') return null;
  var p2b = function (x) { return (x < 10 ? '0' : '') + x; };
  var mAmPm = TIPIFICACION_HORA_AMPM_RE.exec(t);
  if (mAmPm) {
    var hh = parseInt(mAmPm[1], 10);
    var mm = parseInt(mAmPm[2], 10);
    var ss = mAmPm[3] ? parseInt(mAmPm[3], 10) : 0;
    if (hh < 1 || hh > 12 || mm > 59 || ss > 59) return null;
    var esPM = /p/i.test(mAmPm[4]);
    if (esPM && hh !== 12) hh += 12;
    if (!esPM && hh === 12) hh = 0;
    return p2b(hh) + ':' + p2b(mm) + ':' + p2b(ss);
  }
  var m24 = TIPIFICACION_HORA_24H_RE.exec(t);
  if (m24) {
    var hh2 = parseInt(m24[1], 10), mm2 = parseInt(m24[2], 10), ss2 = m24[3] ? parseInt(m24[3], 10) : 0;
    if (hh2 > 23 || mm2 > 59 || ss2 > 59) return null;
    return p2b(hh2) + ':' + p2b(mm2) + ':' + p2b(ss2);
  }
  return null;
}

function tipificacionParseDuracion(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Fase 116 (archivo real HistCDR de Edwin, export completo de Wolkvox): DATE
// ahi trae FECHA Y HORA juntas en una sola celda (serial de Excel con
// fraccion de dia), a diferencia del formato viejo "hoja DATA" (fecha sola,
// HORA en columna aparte). Ademas, con cellNF:true (necesario para que
// Trafico detecte el formato de % real, ver cargas.js) SheetJS convierte esa
// celda numerica a un objeto Date dentro de XLSX.utils.sheet_to_json(ws,
// {header:1}) -- mismo hallazgo exacto que WAIT_TIME/AHT en
// traficoValorCrudoSiFechaBoxeada (trafico-logic.js, Fase 115): esa
// conversion depende de la zona horaria LOCAL de quien sube el archivo (acá
// confirmado contra el archivo real: Bogota, -5h, boxea "18:06:08" local
// como "23:06:07.999Z"), asi que leer HORA desde el objeto Date boxeado con
// getters UTC daria la hora CORRIDA 5 horas. En vez de eso, se recupera el
// valor NUMERICO original directamente de la celda cruda (`ws`), que
// SheetJS nunca altera -- de ahi la aritmetica pura (Math.floor para la
// fecha, fraccion*86400 para la hora) queda sin ninguna dependencia de zona
// horaria. Mismos helpers duplicados a proposito (criterio ya establecido en
// este archivo "gemelo" de trafico-logic.js).
function tipificacionCeldaRef(fila0based, col0based) {
  var col = '';
  var n = col0based;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return col + (fila0based + 1);
}
function tipificacionValorCrudoSiFechaBoxeada(v, ws, fila0based, col0based) {
  if (!(v instanceof Date) || !ws) return v;
  var cell = ws[tipificacionCeldaRef(fila0based, col0based)];
  return (cell && cell.t === 'n' && typeof cell.v === 'number') ? cell.v : v;
}

// ── Presentacion (NUNCA se guarda asi, solo para mostrar): "_" -> espacio,
// y el valor COMPLETO "-" -> "Sin tipificacion". Cualquier otro valor con
// un "-" que no sea el marcador exacto de "sin tipificar" no se toca
// (ej. una tipificacion real que trajera un guion como parte del texto).
function tipificacionEtiqueta(valorOriginal) {
  var v = String(valorOriginal == null ? '' : valorOriginal);
  if (v.trim() === '-') return 'Sin tipificación';
  // Fase 87 (tema C): mayuscula inicial por palabra (siglas intactas, "_"
  // como espacio) -- mismo criterio que el resto de nombres que vienen de
  // los datos. El valor guardado/filtrado nunca cambia, solo esta etiqueta.
  return _tipificacionTexto.textoFormatoNombre(v);
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// `ws` (Fase 116, opcional): worksheet CRUDO de SheetJS -- si viene, DATE se
// recupera sin el boxeo a Date (ver tipificacionValorCrudoSiFechaBoxeada) y,
// cuando el archivo NO trae columna HORA separada (export completo HistCDR),
// la hora se saca de la fraccion de dia de ESE MISMO valor de DATE. Sin `ws`
// (o con el formato viejo, que SI trae HORA aparte), el comportamiento es
// EXACTAMENTE igual al de siempre.
// `canal` (Fase 122, opcional): 'LLAMADAS' o 'WHATSAPP' -- SOLO decide si se
// aplica la eliminacion de duplicados exactos de la Fase 88 (ver mas abajo).
// Sin este parametro (o con 'LLAMADAS'), el comportamiento es EXACTAMENTE
// igual al de siempre.
// `opciones` (Fase 131, Parte 3, opcional): { codificacionesExcluidas }.
// Sin este parametro (el caso de ORLANT, que nunca lo pasa), ninguna fila
// se excluye -- comportamiento EXACTAMENTE igual al de siempre. Mobilize
// pasa `{ codificacionesExcluidas: TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO }`
// (ver ese comentario arriba) desde su propio llamador.
function tipificacionParseFilas(aoa, ws, canal, opciones) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var codificacionesExcluidas = (opciones && opciones.codificacionesExcluidas) || [];
  var map = tipificacionColIndexMap(aoa[0]);
  var faltantes = TIPIFICACION_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.',
    };
  }

  var filas = [];
  var avisos = [];
  var excluidasPorCodificacion = {}; // Fase 131, Parte 3 -- {codificacion: cantidad}
  var otroTipoInteraccionAvisado = false; // 1 solo aviso resumen, no uno por fila
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var agente = tipificacionNormTexto(row[map.agente]);
    var tipificacion = tipificacionNormTexto(row[map.tipificacion]);
    var skill = tipificacionNormTexto(row[map.skill]);
    var fechaCrudo = ws ? tipificacionValorCrudoSiFechaBoxeada(row[map.fecha], ws, i, map.fecha) : row[map.fecha];
    var fecha = tipificacionParseFecha(fechaCrudo);
    // Sin columna HORA propia (export completo HistCDR, Fase 116): si DATE
    // trae fraccion de dia (hora real pegada a la fecha), se saca de ahi --
    // nunca si la fraccion es exactamente 0 (fecha sin hora, no se inventa
    // "00:00:00" como si fuera un dato real).
    var horaDesdeFecha = null;
    if (map.hora === undefined && typeof fechaCrudo === 'number') {
      var fraccionFecha = fechaCrudo - Math.floor(fechaCrudo);
      if (fraccionFecha > 1e-6) horaDesdeFecha = tipificacionParseHora(fechaCrudo);
    }
    var hora = map.hora !== undefined ? tipificacionParseHora(row[map.hora]) : horaDesdeFecha;
    var duracionMin = map.duracionMin !== undefined ? tipificacionParseDuracion(row[map.duracionMin]) : null;

    if (!agente || !tipificacion || !skill) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (agente/tipificacion/skill), se omitio.');
      continue;
    }
    if (!fecha) {
      avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.');
      continue;
    }
    // Fase 86 (tema 2): fecha futura -> se rechaza (nunca "posterior a
    // hoy": un dia cualquiera del mes en curso es valido); fecha anterior
    // a 2020 -> solo se advierte, no se omite.
    if (_tipificacionFechaLimites.fechaLimitesEsFutura(fecha)) {
      avisos.push('Fila ' + filaNum + ' (' + agente + '): DATE ' + fecha + ' esta en el futuro, se omitio.');
      continue;
    }
    if (_tipificacionFechaLimites.fechaLimitesEsSospechosaAntigua(fecha)) {
      avisos.push('Fila ' + filaNum + ' (' + agente + '): DATE ' + fecha + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).');
    }

    // Fase 131, Parte 3 (configurable, decision tomada con el usuario,
    // pendiente de confirmar con Edwin): filas de prueba mezcladas con
    // datos reales (ej. DESCRIPTION_COD_ACT="PRUEBA") se excluyen DESPUES
    // de validar que la fila es por lo demas valida -- nunca se cuentan
    // como "omitida por dato faltante", se cuentan aparte para que el
    // preview diga cuantas se excluyeron y por que.
    if (codificacionesExcluidas.indexOf(tipificacion) !== -1) {
      excluidasPorCodificacion[tipificacion] = (excluidasPorCodificacion[tipificacion] || 0) + 1;
      continue;
    }

    // Fase 131, Parte 3: columnas nuevas del CDR de Mobilize, todas
    // opcionales -- ver el comentario de TIPIFICACION_COLUMNAS arriba.
    var duracionSeg = map.duracionSeg !== undefined ? tipificacionParseDuracion(row[map.duracionSeg]) : null;
    // COD_ACT SIEMPRE como texto (nunca Number()) -- al menos 1 fila real
    // trae "TIMEOUTACW".
    var codAct = map.codAct !== undefined && row[map.codAct] != null && String(row[map.codAct]).trim() !== ''
      ? String(row[map.codAct]).trim() : null;
    var tipoInteraccion = null;
    if (map.tipoInteraccion !== undefined) {
      var tipoCrudo = tipificacionNormTexto(row[map.tipoInteraccion]).toLowerCase();
      if (tipoCrudo === '') {
        tipoInteraccion = null;
      } else if (TIPIFICACION_CDR_TIPO_INTERACCION_VALIDOS.indexOf(tipoCrudo) !== -1) {
        tipoInteraccion = tipoCrudo;
      } else {
        tipoInteraccion = 'otro';
        if (!otroTipoInteraccionAvisado) {
          avisos.push('Al menos una fila trae TYPE_INTERACTION con un valor no reconocido ("' + tipoCrudo + '", se esperaba "inbound" o "outbound_ma") -- se guardo como "otro", nunca se inventa cual de los 2 conocidos es.');
          otroTipoInteraccionAvisado = true;
        }
      }
    }
    var hungUp = map.hungUp !== undefined && row[map.hungUp] != null && String(row[map.hungUp]).trim() !== ''
      ? String(row[map.hungUp]).trim() : null;
    var skillId = map.skillId !== undefined && row[map.skillId] != null && String(row[map.skillId]).trim() !== ''
      ? String(row[map.skillId]).trim() : null;

    filas.push({
      agente: agente, fecha: fecha, hora: hora, duracionMin: duracionMin, tipificacion: tipificacion, skill: skill,
      duracionSeg: duracionSeg, codAct: codAct, tipoInteraccion: tipoInteraccion, hungUp: hungUp, skillId: skillId,
    });
  }

  var totalExcluidas = Object.keys(excluidasPorCodificacion).reduce(function (a, k) { return a + excluidasPorCodificacion[k]; }, 0);
  if (totalExcluidas > 0) {
    var detalleExclusion = Object.keys(excluidasPorCodificacion).map(function (k) {
      return tipificacionEtiqueta(k) + ' (' + excluidasPorCodificacion[k] + ')';
    }).join(', ');
    avisos.push('Se excluyeron ' + totalExcluidas + ' fila(s) por codificacion de prueba (lista configurable): ' + detalleExclusion + '.');
  }

  if (!filas.length) {
    return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos, excluidas: totalExcluidas };
  }
  // Fase 88: solo filas EXACTAMENTE iguales en TODAS las columnas (mismo
  // agente/fecha/hora/duracionMin/tipificacion/skill) -- nunca "casi
  // iguales". Se avisa cuantas se quitaron para que la persona pueda
  // cancelar la carga si no esta de acuerdo.
  //
  // Fase 122 (hallazgo real, export HistChat de WhatsApp de Wolkvox): esta
  // regla NUNCA se aplica al canal WHATSAPP. En Wolkvox cada fila de
  // HistChat es un chat DISTINTO con su propio CONN_ID (que nunca se lee ni
  // se guarda, ver PRIVACIDAD en el encabezado de este archivo) -- un envio
  // masivo (ej. NO_CONTESTAN de 3P/CONFIRMACIONES) genera varios chats
  // reales en el mismo segundo, por el mismo asesor, con la MISMA
  // tipificacion: identicos en todas las columnas que SI se guardan, pero
  // NO duplicados. Confirmado contra el archivo real: 226 filas asi, 0
  // repetidas con la misma tupla agente+fecha+tipificacion+skill (serian
  // coincidencias reales, no defectos de carga). Llamadas y el formato
  // viejo de Tipificacion de WhatsApp (que SI trae SKILL_NAME, Fase 77)
  // siguen aplicando esta regla exactamente igual que siempre.
  if (canal === 'WHATSAPP') {
    return { filas: filas, avisos: avisos, excluidas: totalExcluidas };
  }
  var dedup = _tipificacionDuplicadosExactos.quitarDuplicadosExactos(filas);
  if (dedup.quitadas > 0) {
    avisos.push(
      'Se encontraron ' + dedup.quitadas + ' fila(s) exactamente duplicada(s) ' +
      '(mismos valores en TODAS las columnas, incluida fecha y hora) -- se conservo solo 1 de cada una.'
    );
  }
  return { filas: dedup.filas, avisos: avisos, excluidas: totalExcluidas };
}

// Fase 131, Parte 3: "conectada" para una llamada SALIENTE (outbound_ma) --
// Regla B (configurable, ver TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO
// arriba): conectada = su codificacion NO esta en la lista de "no
// conectada". Pura, reutilizable server-side para las tarjetas de salida
// (server/tipificaciones.js la reimplementa igual de simple sobre SQL, sin
// requerir este archivo -- el servidor nunca requiere public/js/*).
function tipificacionEsConectada(tipificacionValor, listaNoConectada) {
  var lista = listaNoConectada || TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO;
  return lista.indexOf(tipificacionValor) === -1;
}

function tipificacionFilaComoArray(f) {
  return TIPIFICACION_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Primera y ultima DATE entre las filas ya parseadas -- define el periodo
// (dia a dia, sin hora) que la carga va a REEMPLAZAR para este canal.
function tipificacionRangoFechas(filas) {
  if (!filas || !filas.length) return null;
  var min = filas[0].fecha, max = filas[0].fecha;
  filas.forEach(function (f) {
    if (f.fecha < min) min = f.fecha;
    if (f.fecha > max) max = f.fecha;
  });
  return { desde: min, hasta: max };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIPIFICACION_COLUMNAS: TIPIFICACION_COLUMNAS,
    TIPIFICACION_ORDEN_ARRAY: TIPIFICACION_ORDEN_ARRAY,
    tipificacionCeldaRef: tipificacionCeldaRef,
    tipificacionValorCrudoSiFechaBoxeada: tipificacionValorCrudoSiFechaBoxeada,
    tipificacionColIndexMap: tipificacionColIndexMap,
    tipificacionNormTexto: tipificacionNormTexto,
    tipificacionParseFecha: tipificacionParseFecha,
    tipificacionParseHora: tipificacionParseHora,
    tipificacionParseDuracion: tipificacionParseDuracion,
    tipificacionEtiqueta: tipificacionEtiqueta,
    tipificacionParseFilas: tipificacionParseFilas,
    tipificacionFilaComoArray: tipificacionFilaComoArray,
    tipificacionRangoFechas: tipificacionRangoFechas,
    tipificacionEsConectada: tipificacionEsConectada,
    TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS: TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS,
    TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO: TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO,
    TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO: TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO,
    TIPIFICACION_CDR_TIPO_INTERACCION_VALIDOS: TIPIFICACION_CDR_TIPO_INTERACCION_VALIDOS,
  };
}
