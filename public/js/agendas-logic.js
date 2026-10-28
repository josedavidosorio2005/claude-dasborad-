// agendas-logic.js — InConexion Platform (Fase 78).
//
// Logica PURA (sin DOM) de "Agendas" de ORLANT: parseo de la hoja AGENDAS
// del archivo real de Edwin (citas asignadas, ~7.500 filas/mes) y la regla
// de privacidad de NOMBRE_ENTIDAD. Doble modo como trafico-logic.js: global
// en el navegador, require() en Node para las pruebas
// (server/tests/agendas-logic.test.js).
//
// El servidor NUNCA abre el Excel ni ve el NOMBRE_ENTIDAD original: todo el
// parseo (incluida la anonimizacion de entidad) ocurre AQUI, en el
// navegador, antes de armar el payload que se manda a la API -- asi el
// nombre real de un paciente particular nunca sale del navegador, ni
// siquiera de paso (no llega a la red, no puede aparecer en un log del
// servidor). Ver PRIVACIDAD mas abajo.
'use strict';

// fecha-limites-logic.js: global en el navegador, require() en Node --
// ver ese archivo para el criterio de "fecha futura".
var _agendasFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);
// duplicados-exactos-logic.js: global en el navegador, require() en Node.
var _agendasDuplicadosExactos = (typeof require === 'function') ? require('./duplicados-exactos-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas de la hoja AGENDAS (formato consolidado de ORLANT) ─────────
// Emparejamiento por NOMBRE de columna, igual que el resto de la
// plataforma -- nunca por posicion. Las 8 son tal cual las nombra Edwin;
// solo NOMBRE_ENTIDAD puede venir vacia (paciente sin entidad registrada
// -> "SIN ENTIDAD", ver agendasAplicarPrivacidadEntidad).
var AGENDAS_COLUMNAS = [
  { key: 'asesor', label: 'NOMBRE DE AGENTE', obligatoria: true },
  { key: 'sede', label: 'SEDE', obligatoria: true },
  { key: 'examen', label: 'NOMBRE_EXAMEN', obligatoria: true },
  { key: 'especialidad', label: 'ESPECIALIDAD', obligatoria: true },
  { key: 'profesional', label: 'PROFESIONAL', obligatoria: true },
  { key: 'fechaSolicitud', label: 'FECHA_SOLICITUD', obligatoria: true },
  { key: 'tipoLinea', label: 'TIPO DE LINEA', obligatoria: true },
  { key: 'entidad', label: 'NOMBRE_ENTIDAD', obligatoria: false },
];
var AGENDAS_COLUMNAS_OBLIGATORIAS = AGENDAS_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo para el payload compacto (arrays, no objetos con las 8 claves
// repetidas por fila) -- ver agendasFilaComoArray. Mismo orden que las
// columnas de la tabla `agendas` (server/db.js).
var AGENDAS_ORDEN_ARRAY = ['asesor', 'sede', 'examen', 'especialidad', 'profesional', 'fechaSolicitud', 'tipoLinea', 'entidad'];

function agendasNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function agendasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = agendasNorm(h);
    var col = AGENDAS_COLUMNAS.filter(function (c) { return agendasNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Pedido explicito de Edwin: quita espacios sobrantes al inicio/fin y
// colapsa los dobles espacios internos en TODOS los textos -- nunca cambia
// mayusculas/minusculas ni ningun otro caracter ("no cambies nada mas de
// los valores"). Comparte el mismo criterio de trim+collapse que
// traficoNorm/cargasNorm de otros modulos, aqui SIN forzar minusculas
// (esta se usa para el VALOR final que se guarda, no solo para comparar).
function agendasNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// ── FECHA_SOLICITUD: serial de Excel CON hora (fraccion de dia), o texto
// "dd/mm/aaaa hh:mm:ss" -- Edwin: "Hora local de Colombia, sin convertir a
// UTC". El serial se convierte con aritmetica directa sobre UTC (mismo
// criterio que traficoFechaDesdeSerial, trafico-logic.js): NUNCA se usa
// Date+cellDates de SheetJS, que en algunos entornos interpreta el serial
// con la zona horaria del SISTEMA que corre el navegador y puede desplazar
// el dia/mes calendario -- exactamente lo que Edwin pide evitar. Se
// redondea al segundo (Math.round) para que un extremo como "30/04/2025
// 19:00" no se corra al 1/05 por un error de punto flotante en la fraccion
// del serial.
function agendasFechaHoraDesdeSerial(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' ' +
    pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
}

// Texto "dd/mm/aaaa hh:mm:ss" (con o sin segundos) -> "aaaa-mm-dd hh:mm:ss".
// Parseo manual (nunca `new Date(texto)`: dd/mm/aaaa es ambiguo para el
// motor de fechas de JS, que asume mm/dd/aaaa en locale en-US).
var AGENDAS_FECHA_TEXTO_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
function agendasParseFechaSolicitud(v) {
  if (typeof v === 'number') return agendasFechaHoraDesdeSerial(v);
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    // Ya viene en formato final (por si algun dia el archivo trae texto
    // "aaaa-mm-dd hh:mm:ss" en vez de dd/mm/aaaa).
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return agendasFechaHoraDesdeSerial(Number(t));
    var m = AGENDAS_FECHA_TEXTO_RE.exec(t);
    if (!m) return null;
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), aaaa = parseInt(m[3], 10);
    var hh = m[4] ? parseInt(m[4], 10) : 0, mi = m[5] ? parseInt(m[5], 10) : 0, ss = m[6] ? parseInt(m[6], 10) : 0;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59 || ss > 59) return null;
    var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return aaaa + '-' + pad2(mm) + '-' + pad2(dd) + ' ' + pad2(hh) + ':' + pad2(mi) + ':' + pad2(ss);
  }
  return null;
}

var AGENDAS_TIPOS_LINEA = ['3P', 'GENERAL'];

// Fase 122 (hallazgo real contra el archivo AGENDAS_DE_AGOSTO_Y_SEPTIEMBRE.xlsx):
// igual que DATE en Tipificacion (tipificacionValorCrudoSiFechaBoxeada,
// Fase 116) y WAIT_TIME/AHT en Trafico (traficoValorCrudoSiFechaBoxeada,
// Fase 115), FECHA_SOLICITUD en este archivo es una celda NUMERICA
// (serial de Excel con fraccion de dia) con formato de fecha ("dd/mm/yyyy")
// -- con cellNF:true (necesario para que Trafico detecte el % real, ver
// cargas.js) SheetJS la convierte a un objeto Date dentro de
// XLSX.utils.sheet_to_json(ws,{header:1}). Sin este fix, CADA fila del
// archivo real quedaba rechazada ("FECHA_SOLICITUD invalida"): antes de
// esta fase, agendasParseFilas nunca recibia `ws` y nunca sabia leer un
// Date boxeado (ni plain number ni string lo cubren). Mismos helpers
// duplicados a proposito (criterio ya establecido en este repo: cada
// *-logic.js que los necesita trae su propia copia, ver tipificacion-logic.js/
// trafico-logic.js).
function agendasCeldaRef(fila0based, col0based) {
  var col = '';
  var n = col0based;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return col + (fila0based + 1);
}
function agendasValorCrudoSiFechaBoxeada(v, ws, fila0based, col0based) {
  if (!(v instanceof Date) || !ws) return v;
  var cell = ws[agendasCeldaRef(fila0based, col0based)];
  return (cell && cell.t === 'n' && typeof cell.v === 'number') ? cell.v : v;
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria, o { filas, avisos,
// entidadesAgrupadas, entidadesSinDato } -- `filas` ya trae NOMBRE_ENTIDAD
// anonimizada (ver agendasAplicarPrivacidadEntidad, aplicada aqui mismo
// antes de devolver, para que ningun caller externo pueda "olvidarse" del
// paso de privacidad).
// `ws` (Fase 122, opcional): worksheet CRUDO de SheetJS -- si viene, y
// FECHA_SOLICITUD llega boxeada a Date, se recupera el serial numerico
// real desde la celda cruda (ver agendasValorCrudoSiFechaBoxeada). Sin
// `ws` (o con el formato de siempre, texto o numero plano), el
// comportamiento es EXACTAMENTE igual al de siempre.
// `opciones` (Fase 210): { codigosEntidad: [codigo] } -- la Clasificacion de
// lineas del cliente, solo la usa la base cruda (ver agendasParseFilasCruda).
function agendasParseFilas(aoa, ws, opciones) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  if (agendasEsBaseCruda(aoa[0])) return agendasParseFilasCruda(aoa, ws, opciones);
  var map = agendasColIndexMap(aoa[0]);
  var faltantes = AGENDAS_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube la hoja AGENDAS tal cual la exporta el sistema de Edwin, sin recortar columnas.',
    };
  }

  var filas = [];
  var avisos = [];
  var asesoresSinDato = 0;
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var asesorCruda = agendasNormTexto(row[map.asesor]);
    var sede = agendasNormTexto(row[map.sede]);
    var examen = agendasNormTexto(row[map.examen]);
    var especialidad = agendasNormTexto(row[map.especialidad]);
    var profesional = agendasNormTexto(row[map.profesional]);
    var tipoLinea = agendasNormTexto(row[map.tipoLinea]);
    var entidad = map.entidad !== undefined ? agendasNormTexto(row[map.entidad]) : '';
    var fechaCrudaSolicitud = ws ? agendasValorCrudoSiFechaBoxeada(row[map.fechaSolicitud], ws, i, map.fechaSolicitud) : row[map.fechaSolicitud];
    var fechaSolicitud = agendasParseFechaSolicitud(fechaCrudaSolicitud);

    if (!sede || !examen || !especialidad || !profesional) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (sede/examen/especialidad/profesional), se omitio.');
      continue;
    }
    // Fase 104 (pedido de InCo, ranking de asesores): antes, una fila SIN
    // agente asignado se omitia en silencio igual que si le faltara un dato
    // realmente obligatorio -- la suma de lo cargado quedaba por debajo del
    // archivo real, sin ningun aviso. Ahora se conserva (mismo criterio que
    // NOMBRE_ENTIDAD vacio -> "SIN ENTIDAD"): asesor vacio -> "SIN ASESOR",
    // nunca se descarta la cita solo porque no quedo asignada a nadie.
    var asesor = asesorCruda || 'SIN ASESOR';
    if (!asesorCruda) asesoresSinDato++;
    if (!fechaSolicitud) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOLICITUD invalida o vacia, se omitio.');
      continue;
    }
    // Fase 86 (tema 2): solo se compara la parte de fecha (los primeros 10
    // caracteres de 'AAAA-MM-DD HH:MM:SS').
    if (_agendasFechaLimites.fechaLimitesEsFutura(fechaSolicitud.slice(0, 10))) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOLICITUD ' + fechaSolicitud + ' esta en el futuro, se omitio.');
      continue;
    }
    if (_agendasFechaLimites.fechaLimitesEsSospechosaAntigua(fechaSolicitud.slice(0, 10))) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOLICITUD ' + fechaSolicitud + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).');
    }
    if (AGENDAS_TIPOS_LINEA.indexOf(tipoLinea) === -1) {
      avisos.push('Fila ' + filaNum + ': TIPO DE LINEA debe ser 3P o GENERAL (vino "' + tipoLinea + '"), se omitio.');
      continue;
    }

    filas.push({
      asesor: asesor, sede: sede, examen: examen, especialidad: especialidad,
      profesional: profesional, fechaSolicitud: fechaSolicitud, tipoLinea: tipoLinea,
      entidad: entidad,
    });
  }

  if (!filas.length) {
    return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };
  }

  var priv = agendasAplicarPrivacidadEntidad(filas);
  // Fase 88: solo filas EXACTAMENTE iguales en TODAS las columnas (mismo
  // asesor/sede/examen/especialidad/profesional/fechaSolicitud incluida
  // hora/tipoLinea/entidad) -- nunca "casi iguales". Se avisa cuantas se
  // quitaron para que la persona pueda cancelar la carga si no esta de
  // acuerdo (mismo lugar donde ya se muestran los demas avisos, ANTES de
  // confirmar la carga).
  var dedup = _agendasDuplicadosExactos.quitarDuplicadosExactos(priv.filas);
  if (dedup.quitadas > 0) {
    avisos.push(
      'Se encontraron ' + dedup.quitadas + ' fila(s) exactamente duplicada(s) ' +
      '(mismos valores en TODAS las columnas, incluida fecha y hora) -- se conservo solo 1 de cada una.'
    );
  }
  if (asesoresSinDato > 0) {
    avisos.push(
      asesoresSinDato + ' fila(s) sin NOMBRE DE AGENTE -- se guardaron igual, agrupadas como "Sin asesor" ' +
      '(nunca se descarta una cita real solo porque no quedo asignada a nadie).'
    );
  }
  return {
    filas: dedup.filas, avisos: avisos,
    entidadesAgrupadas: priv.entidadesAgrupadas, entidadesSinDato: priv.entidadesSinDato,
    asesoresSinDato: asesoresSinDato,
  };
}

// ── Base CRUDA del aplicativo (Fase 210, pedido de Edwin del 28/10) ──────
// "AGENDAS MES DE OCTUBRE.xlsx" tal cual sale del aplicativo: 20 columnas,
// sin NOMBRE DE AGENTE ni TIPO DE LINEA. El asesor sale del USUARIO que asigna
// la cita (columna A) cruzado con la Clasificacion de usuarios, y la linea del
// CODIGO_ENTIDAD (columna R) cruzado con la Clasificacion de lineas -- los dos
// cruces los hace el servidor AL CONSULTAR. Solo se leen estas 8 columnas:
// la cedula del paciente (PACIDE), las observaciones (CITOBSOBS) y el resto
// nunca salen del navegador.
var AGENDAS_COLUMNAS_CRUDA = [
  { key: 'usuario', label: 'USUARIO_QUE_ASIGNA_CITA', obligatoria: true },
  { key: 'sede', label: 'CODIGO_SEDE', obligatoria: true },
  { key: 'examen', label: 'NOMBRE_EXAMEN', obligatoria: true },
  { key: 'especialidad', label: 'ESPNOM', obligatoria: true },
  { key: 'profesional', label: 'MEDNOM', obligatoria: true },
  { key: 'fechaSolicitud', label: 'FECHA_SOL', obligatoria: true },
  { key: 'codigoEntidad', label: 'CODIGO_ENTIDAD', obligatoria: true },
  { key: 'entidad', label: 'NOMBRE_ENTIDAD', obligatoria: false },
];
// Orden del payload de la base cruda: CAMPOS_FILA_CRUDA (server/agendas.js) y
// agendasFilaCrudaSchema (validation.js).
var AGENDAS_ORDEN_ARRAY_CRUDA = ['usuario', 'sede', 'examen', 'especialidad', 'profesional', 'fechaSolicitud', 'codigoEntidad', 'entidad'];
// Mismos valores que CODIGO_FUERA_DE_LISTA / CODIGO_VACIO (server/agendas.js).
var AGENDAS_CODIGO_FUERA_DE_LISTA = 'PARTICULAR / OTRA';
var AGENDAS_CODIGO_VACIO = 'SIN CODIGO';

function _agendasMapaColumnas(headerRow, columnas) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = agendasNorm(h);
    var col = columnas.filter(function (c) { return agendasNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// true si el encabezado trae las 7 columnas obligatorias de la base cruda.
function agendasEsBaseCruda(headerRow) {
  var map = _agendasMapaColumnas(headerRow, AGENDAS_COLUMNAS_CRUDA);
  return AGENDAS_COLUMNAS_CRUDA.every(function (c) { return !c.obligatoria || map[c.key] !== undefined; });
}

// Codigo: sin espacios de mas y en mayusculas (normCodigo del servidor).
function agendasNormCodigo(v) {
  return agendasNormTexto(v).toUpperCase();
}
// Usuario: ademas sin ningun espacio ("INCO 19" de la lista = "INCO19" de la
// base, hallazgo real del 28/10; normUsuario del servidor).
function agendasNormUsuario(v) {
  return agendasNormCodigo(v).replace(/\s+/g, '');
}

function agendasParseFilasCruda(aoa, ws, opciones) {
  var lista = opciones && opciones.codigosEntidad;
  if (!Array.isArray(lista)) {
    return { error: 'No se pudo leer la Clasificación de líneas (códigos de entidad) de este cliente. Vuelve a intentarlo; sin ella no se puede proteger el código de los particulares.' };
  }
  if (!lista.length) {
    return { error: 'La Clasificación de líneas (códigos de entidad) está vacía: llénala primero en Agendamiento → "Clasificación de líneas" y vuelve a subir el archivo.' };
  }
  var conocidos = {};
  lista.forEach(function (c) { conocidos[agendasNormCodigo(c)] = true; });
  var map = _agendasMapaColumnas(aoa[0], AGENDAS_COLUMNAS_CRUDA);

  var filas = [];
  var avisos = [];
  var vistasCrudas = {};
  var duplicadas = 0, usuariosSinDato = 0, codigosFueraDeLista = 0, codigosVacios = 0;
  var usuarios = {};
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    // Duplicado exacto en TODAS las columnas del archivo (no solo en las 8
    // que se guardan: dos citas de pacientes distintos pueden coincidir en
    // esas 8 y son agendas reales distintas).
    var claveCruda = JSON.stringify(row);
    if (vistasCrudas[claveCruda]) { duplicadas++; continue; }
    vistasCrudas[claveCruda] = true;

    var sede = agendasNormTexto(row[map.sede]);
    var examen = agendasNormTexto(row[map.examen]);
    var especialidad = agendasNormTexto(row[map.especialidad]);
    var profesional = agendasNormTexto(row[map.profesional]);
    if (!sede || !examen || !especialidad || !profesional) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (sede/examen/especialidad/profesional), se omitio.');
      continue;
    }
    var fechaCruda = ws ? agendasValorCrudoSiFechaBoxeada(row[map.fechaSolicitud], ws, i, map.fechaSolicitud) : row[map.fechaSolicitud];
    var fechaSolicitud = agendasParseFechaSolicitud(fechaCruda);
    if (!fechaSolicitud) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOL invalida o vacia, se omitio.');
      continue;
    }
    if (_agendasFechaLimites.fechaLimitesEsFutura(fechaSolicitud.slice(0, 10))) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOL ' + fechaSolicitud + ' esta en el futuro, se omitio.');
      continue;
    }
    var usuario = agendasNormUsuario(row[map.usuario]);
    if (!usuario) { usuario = 'SIN USUARIO'; usuariosSinDato++; }
    usuarios[usuario] = true;
    // PRIVACIDAD: un codigo que no esta en la lista puede ser la cedula del
    // paciente particular -- nunca sale del navegador tal cual. Suma a 3P.
    var codigo = agendasNormCodigo(row[map.codigoEntidad]);
    var codigoEntidad;
    if (!codigo) { codigoEntidad = AGENDAS_CODIGO_VACIO; codigosVacios++; }
    else if (conocidos[codigo]) codigoEntidad = codigo;
    else { codigoEntidad = AGENDAS_CODIGO_FUERA_DE_LISTA; codigosFueraDeLista++; }
    filas.push({
      usuario: usuario, sede: sede, examen: examen, especialidad: especialidad, profesional: profesional,
      fechaSolicitud: fechaSolicitud, codigoEntidad: codigoEntidad,
      entidad: map.entidad !== undefined ? agendasNormTexto(row[map.entidad]) : '',
    });
  }
  if (!filas.length) return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };
  var priv = agendasAplicarPrivacidadEntidad(filas);
  if (duplicadas > 0) {
    avisos.push('Se encontraron ' + duplicadas + ' fila(s) exactamente duplicada(s) (mismos valores en TODAS las columnas del archivo) -- se conservo solo 1 de cada una.');
  }
  if (usuariosSinDato > 0) avisos.push(usuariosSinDato + ' fila(s) sin USUARIO_QUE_ASIGNA_CITA -- se guardaron igual, como "SIN USUARIO".');
  return {
    formato: 'cruda',
    filas: priv.filas, avisos: avisos,
    entidadesAgrupadas: priv.entidadesAgrupadas, entidadesSinDato: priv.entidadesSinDato,
    usuarios: Object.keys(usuarios).length,
    codigosFueraDeLista: codigosFueraDeLista, codigosVacios: codigosVacios,
  };
}

// ── PRIVACIDAD (obligatorio, Edwin): NOMBRE_ENTIDAD nunca se guarda tal
// cual vino del archivo.
//   - Vacia -> "SIN ENTIDAD".
//   - Aparece MENOS de 5 veces en este mismo archivo (paciente particular
//     casi siempre, ver cabecera de este archivo) -> "PARTICULAR / OTRA".
//   - Aparece 5 veces o mas -> se guarda tal cual (ya con espacios
//     normalizados), es una entidad real (EPS, prepagada, aseguradora...).
// El umbral se calcula SOLO sobre las filas de este archivo (cada carga
// reemplaza un periodo completo, asi que "las veces que aparece" siempre
// se refiere al periodo que se esta subiendo, nunca a un acumulado
// historico que nadie ve completo a la vez).
// Pura: recibe filas ya con `entidad` normalizada de espacios (trim +
// collapse), nunca el texto crudo de la celda.
function agendasAplicarPrivacidadEntidad(filas) {
  var freq = {};
  (filas || []).forEach(function (f) {
    if (f.entidad === '') return;
    freq[f.entidad] = (freq[f.entidad] || 0) + 1;
  });
  var entidadesAgrupadas = 0, entidadesSinDato = 0;
  var out = (filas || []).map(function (f) {
    var entidadFinal;
    if (f.entidad === '') { entidadFinal = 'SIN ENTIDAD'; entidadesSinDato++; }
    else if (freq[f.entidad] < 5) { entidadFinal = 'PARTICULAR / OTRA'; entidadesAgrupadas++; }
    else { entidadFinal = f.entidad; }
    if (entidadFinal === f.entidad) return f;
    var copia = {};
    for (var k in f) copia[k] = f[k];
    copia.entidad = entidadFinal;
    return copia;
  });
  return { filas: out, entidadesAgrupadas: entidadesAgrupadas, entidadesSinDato: entidadesSinDato };
}

// Fila (objeto) -> array en AGENDAS_ORDEN_ARRAY, para el payload compacto
// que se manda al servidor (Fase 78: ~7.500 filas/mes en formato de
// objetos con las 8 claves repetidas por fila se acerca al limite de
// express.json (2mb, ver server/config.js) -- en arrays el mismo archivo
// pesa ~35% menos, con margen comodo. El servidor mapea cada posicion de
// vuelta a su nombre (ver server/agendas.js) -- nunca se cambia el ORDEN
// sin actualizar los dos lados a la vez.
function agendasFilaComoArray(f, formato) {
  return (formato === 'cruda' ? AGENDAS_ORDEN_ARRAY_CRUDA : AGENDAS_ORDEN_ARRAY).map(function (k) { return f[k]; });
}

// ── Listas de Agendamiento (Fase 210): Clasificacion de usuarios y de lineas ──
// Fecha de cambio de una celda (serial de Excel, Date o texto dd/mm/aaaa o
// aaaa-mm-dd) -> 'AAAA-MM-DD', o null si no hay o no se entiende.
function agendasFechaCambio(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    var p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate());
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  var f = agendasParseFechaSolicitud(typeof v === 'number' ? Math.floor(v) : v);
  return f ? f.slice(0, 10) : null;
}

// El "+" de la Clasificacion de usuarios. Un usuario que ya esta en la lista
// solo se puede volver a agregar con fecha de cambio (desde esa fecha sus
// agendas son de la persona nueva; las anteriores siguen siendo de la
// anterior). Devuelve { lista } o { error, repetido }.
function agendasAgregarUsuario(lista, nuevo) {
  var usuario = agendasNormUsuario(nuevo.usuario);
  var asesor = agendasNormTexto(nuevo.asesor);
  var fechaCambio = nuevo.fechaCambio || null;
  if (!usuario) return { error: 'Escribe el usuario.' };
  if (!asesor) return { error: 'Escribe el nombre del asesor.' };
  var mismos = (lista || []).filter(function (u) { return agendasNormUsuario(u.usuario) === usuario; });
  if (mismos.length) {
    if (!fechaCambio) {
      var actual = mismos.slice().sort(function (a, b) { return (a.fechaCambio || '') < (b.fechaCambio || '') ? -1 : 1; }).pop();
      return {
        repetido: true,
        error: 'El usuario ' + usuario + ' ya existe (hoy es de ' + actual.asesor + '). Indica la fecha de cambio: desde esa fecha sus agendas cuentan para ' + asesor + ' y las anteriores siguen siendo de quien lo tenía.',
      };
    }
    if (mismos.some(function (u) { return u.fechaCambio === fechaCambio; })) {
      return { repetido: true, error: 'El usuario ' + usuario + ' ya tiene un cambio con esa misma fecha.' };
    }
  }
  return { lista: (lista || []).concat([{ usuario: usuario, asesor: asesor, fechaCambio: fechaCambio }]) };
}

// El "+" de la Clasificacion de lineas. Un codigo va una sola vez.
function agendasAgregarCodigo(lista, nuevo) {
  var codigo = agendasNormCodigo(nuevo.codigo);
  if (!codigo) return { error: 'Escribe el código de la entidad.' };
  if (nuevo.linea !== '3P' && nuevo.linea !== 'GENERAL') return { error: 'Elige la línea (3P o General).' };
  var ya = (lista || []).filter(function (c) { return agendasNormCodigo(c.codigo) === codigo; })[0];
  if (ya) return { repetido: true, error: 'El código ' + codigo + ' ya está en la lista (' + (ya.linea === '3P' ? 'Línea 3P' : 'Línea General') + ').' };
  return { lista: (lista || []).concat([{ codigo: codigo, linea: nuevo.linea }]) };
}

// Hoja de usuarios (USUARIO, NOMBRE..., FECHA DE CAMBIO), como la hoja
// AGENTES de "USUARIOS CON CAMBIOS ORLANT": un usuario repetido entra con su
// fecha de cambio. Devuelve { usuarios, avisos } o { error }.
function agendasLeerUsuariosExcel(filas) {
  filas = filas || [];
  var iEnc = -1, cU = -1, cN = -1, cF = -1;
  for (var r = 0; r < Math.min(filas.length, 10) && iEnc < 0; r++) {
    var u = -1, n = -1, f = -1;
    (filas[r] || []).forEach(function (h, c) {
      var t = agendasNormCodigo(h);
      if (u < 0 && t === 'USUARIO') u = c;
      else if (n < 0 && /NOMBRE|ASESOR/.test(t)) n = c;
      else if (f < 0 && /FECHA/.test(t)) f = c;
    });
    if (u >= 0 && n >= 0) { iEnc = r; cU = u; cN = n; cF = f; }
  }
  if (iEnc < 0) return { error: 'La hoja debe tener una columna USUARIO y otra con el nombre del asesor (y, si aplica, FECHA DE CAMBIO).' };
  var lista = [], avisos = [];
  for (var i = iEnc + 1; i < filas.length; i++) {
    var fila = filas[i] || [];
    var usuario = fila[cU], asesor = fila[cN], fechaCruda = cF >= 0 ? fila[cF] : null;
    if (!agendasNormTexto(usuario) && !agendasNormTexto(asesor)) continue;
    var fecha = agendasFechaCambio(fechaCruda);
    if (fechaCruda !== null && fechaCruda !== undefined && fechaCruda !== '' && !fecha) {
      avisos.push('Fila ' + (i + 1) + ': la fecha de cambio no se entiende, no se aplicó.');
      continue;
    }
    var r2 = agendasAgregarUsuario(lista, { usuario: usuario, asesor: asesor, fechaCambio: fecha });
    if (r2.error) { avisos.push('Fila ' + (i + 1) + ': ' + r2.error); continue; }
    lista = r2.lista;
  }
  return { usuarios: lista, avisos: avisos };
}

// Hoja de codigos: o dos columnas "3P" y "GENERAL" con los codigos debajo
// (hoja CODIGOS de Edwin), o una columna de codigo y otra de LINEA.
function agendasLeerCodigosExcel(filas) {
  filas = filas || [];
  var lista = [], avisos = [];
  var agregar = function (codigo, linea, filaNum) {
    if (!agendasNormTexto(codigo)) return;
    var r = agendasAgregarCodigo(lista, { codigo: codigo, linea: linea });
    if (r.error) avisos.push('Fila ' + filaNum + ': ' + r.error);
    else lista = r.lista;
  };
  for (var r = 0; r < Math.min(filas.length, 10); r++) {
    var enc = (filas[r] || []).map(agendasNormCodigo);
    var c3 = enc.indexOf('3P'), cG = enc.indexOf('GENERAL');
    var cL = -1, cC = -1;
    enc.forEach(function (t, c) { if (cL < 0 && /^LINEA\b/.test(t.normalize('NFD').replace(/[̀-ͯ]/g, ''))) cL = c; else if (cC < 0 && /CODIGO|CÓDIGO/.test(t)) cC = c; });
    if (c3 >= 0 && cG >= 0) {
      for (var i = r + 1; i < filas.length; i++) {
        agregar((filas[i] || [])[c3], '3P', i + 1);
        agregar((filas[i] || [])[cG], 'GENERAL', i + 1);
      }
      return { codigos: lista, avisos: avisos };
    }
    if (cL >= 0 && cC >= 0) {
      for (var k = r + 1; k < filas.length; k++) {
        var lin = agendasNormCodigo((filas[k] || [])[cL]).replace(/^L[IÍ]NEA\s+/, '');
        if (!agendasNormTexto((filas[k] || [])[cC])) continue;
        if (lin !== '3P' && lin !== 'GENERAL') { avisos.push('Fila ' + (k + 1) + ': la línea debe ser 3P o General.'); continue; }
        agregar((filas[k] || [])[cC], lin, k + 1);
      }
      return { codigos: lista, avisos: avisos };
    }
  }
  return { error: 'La hoja debe tener dos columnas "3P" y "GENERAL" con los códigos debajo, o una columna de código y otra de "Línea".' };
}

// Extremos (primera/ultima) de FECHA_SOLICITUD entre las filas ya parseadas
// -- define el periodo que la carga va a REEMPLAZAR (Fase 78, mismo
// criterio de "reemplaza por periodo" que Trafico, pero aqui el periodo
// sale de los datos mismos, no de un selector de mes/skill).
function agendasRangoFechas(filas) {
  if (!filas || !filas.length) return null;
  var min = filas[0].fechaSolicitud, max = filas[0].fechaSolicitud;
  filas.forEach(function (f) {
    if (f.fechaSolicitud < min) min = f.fechaSolicitud;
    if (f.fechaSolicitud > max) max = f.fechaSolicitud;
  });
  return { desde: min, hasta: max };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AGENDAS_COLUMNAS: AGENDAS_COLUMNAS,
    AGENDAS_ORDEN_ARRAY: AGENDAS_ORDEN_ARRAY,
    AGENDAS_TIPOS_LINEA: AGENDAS_TIPOS_LINEA,
    agendasColIndexMap: agendasColIndexMap,
    agendasNormTexto: agendasNormTexto,
    agendasCeldaRef: agendasCeldaRef,
    agendasValorCrudoSiFechaBoxeada: agendasValorCrudoSiFechaBoxeada,
    agendasFechaHoraDesdeSerial: agendasFechaHoraDesdeSerial,
    agendasParseFechaSolicitud: agendasParseFechaSolicitud,
    agendasParseFilas: agendasParseFilas,
    agendasAplicarPrivacidadEntidad: agendasAplicarPrivacidadEntidad,
    agendasFilaComoArray: agendasFilaComoArray,
    agendasRangoFechas: agendasRangoFechas,
    // Fase 210
    AGENDAS_COLUMNAS_CRUDA: AGENDAS_COLUMNAS_CRUDA,
    AGENDAS_ORDEN_ARRAY_CRUDA: AGENDAS_ORDEN_ARRAY_CRUDA,
    AGENDAS_CODIGO_FUERA_DE_LISTA: AGENDAS_CODIGO_FUERA_DE_LISTA,
    AGENDAS_CODIGO_VACIO: AGENDAS_CODIGO_VACIO,
    agendasEsBaseCruda: agendasEsBaseCruda,
    agendasParseFilasCruda: agendasParseFilasCruda,
    agendasNormCodigo: agendasNormCodigo,
    agendasNormUsuario: agendasNormUsuario,
    agendasFechaCambio: agendasFechaCambio,
    agendasAgregarUsuario: agendasAgregarUsuario,
    agendasAgregarCodigo: agendasAgregarCodigo,
    agendasLeerUsuariosExcel: agendasLeerUsuariosExcel,
    agendasLeerCodigosExcel: agendasLeerCodigosExcel,
  };
}
