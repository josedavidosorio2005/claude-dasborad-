// agendas-usuaria-logic.js — Fase 259 (pedido de Edwin, reunion 05/11, Clinica
// Aurora): "Agendas por usuaria" desde el reporte mensual de citas que
// exporta el sistema de la clinica (una fila por cita). Logica pura, sin DOM.
//
// PRIVACIDAD: el archivo trae datos de pacientes (documento, nombre,
// telefono, direccion, diagnostico, observaciones). TODO se lee y se AGREGA
// en el navegador: al servidor solo llegan conteos por
// (mes de la cita, dia en que se confirmo, sede, usuario, canal, tipo de
// cita, tipo de paciente, rol). Las columnas se buscan por NOMBRE y solo se
// leen las de la lista de abajo; ninguna otra columna sale de esta funcion.
//
// "usuario" es el codigo del sistema de la clinica tal cual ("INCONEXION",
// "INCONEXION A"...). El nombre real de la asesora se resuelve AL MOSTRAR con
// los alias de la campaña (alias_asesores), nunca al guardar.

var AU_COLUMNAS = [
  { key: 'fechacita', obligatoria: true },
  { key: 'usuario_confirma', obligatoria: true },
  { key: 'motivo_conf', obligatoria: true },
  { key: 'fecha_confirma', obligatoria: true },
  { key: 'nombresede', obligatoria: true },
  { key: 'usuario_regcita', obligatoria: false },
  { key: 'consulta', obligatoria: false },
  { key: 'cirugia', obligatoria: false },
  { key: 'tipo_paciente', obligatoria: false },
];
var AU_CANALES = ['Llamada', 'WhatsApp', 'No contesta', 'Otro'];
var AU_TIPOS_CITA = ['Cirugía', 'Consulta', 'Otro'];
var AU_ROLES = ['confirma', 'crea'];
var AU_CLINICA = 'Clínica (no InConexion)';
var AU_CAMPOS_FILA = ['mes', 'dia', 'sede', 'usuario', 'canal', 'tipoCita', 'tipoPaciente', 'rol', 'n'];

function auNorm(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// { key: indiceDeColumna } buscando por nombre (sin mayusculas ni espacios de mas).
function auColIndexMap(header) {
  var map = {};
  (header || []).forEach(function (h, i) {
    var k = auNorm(h).toLowerCase().replace(/ /g, '_');
    AU_COLUMNAS.forEach(function (c) { if (map[c.key] === undefined && k === c.key) map[c.key] = i; });
  });
  return map;
}
function auFaltantes(map) {
  return AU_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; }).map(function (c) { return c.key; });
}

// Serial de Excel (o texto dd/mm/aaaa, aaaa-mm-dd) -> 'AAAA-MM-DD'.
// Aritmetica directa sobre UTC (como agendasFechaHoraDesdeSerial): nunca
// Date con la zona horaria del equipo.
function auFecha(v) {
  if (v === null || v === undefined || v === '') return null;
  // Fase 260 (hallazgo con el archivo real): con las opciones de Cargar Datos
  // (cellNF), SheetJS entrega las celdas con formato de fecha de un .xls como
  // Date en hora LOCAL (medianoche local del dia del serial). Se toman sus
  // componentes locales (mismo criterio que agendasFechaCambio); verificado
  // contra el serial en las 1.678 filas reales.
  if (v instanceof Date || (v && typeof v.getFullYear === 'function')) {
    if (isNaN(v.getTime())) return null;
    var q = function (x) { return (x < 10 ? '0' : '') + x; };
    var y = v.getFullYear();
    if (y < 1970 || y > 2200) return null;
    return y + '-' + q(v.getMonth() + 1) + '-' + q(v.getDate());
  }
  if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()))) {
    var n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 25569 || n > 120000) return null;
    var d = new Date((n - 25569) * 86400000);
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }
  var t = String(v).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) {
    var dd = +m[1], mm = +m[2];
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return m[3] + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }
  return null;
}

// Canal de confirmacion desde motivo_conf (texto libre, con erratas).
function auCanal(motivo) {
  var s = auNorm(motivo);
  if (/NO ?CONT|NO ?CONET/.test(s)) return 'No contesta';
  if (/WPP|WWP|WAPP|WSP|WHATS/.test(s)) return 'WhatsApp';
  if (/LLAM|LALM|LLMA|LAMA|LLAA|CEL|TEL/.test(s)) return 'Llamada';
  return 'Otro';
}

function auVerdadero(v) {
  if (v === true || v === 1) return true;
  var s = auNorm(v);
  return s === '1' || s === 'TRUE' || s === 'VERDADERO' || s === 'SI' || s === 'X';
}
function auTipoCita(consulta, cirugia) {
  if (auVerdadero(cirugia)) return 'Cirugía';
  if (auVerdadero(consulta)) return 'Consulta';
  return 'Otro';
}

// Codigo del usuario: "INCONEXION", "INCONEXION A"... tal cual (normalizado);
// cualquier otro usuario (personal de la clinica) se agrupa, sin su nombre.
function auUsuario(v) {
  var s = auNorm(v);
  if (!s) return '';
  return /^INCONEXION\b/.test(s) ? s : AU_CLINICA;
}
function auTipoPaciente(v) {
  var s = auNorm(v);
  if (s === 'NUEVO') return 'Nuevo';
  if (s === 'ANTIGUO') return 'Antiguo';
  return s ? 'Otro' : 'Sin dato';
}
function auSede(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin sede'; }

// Lee la hoja (aoa con encabezado en alguna de las primeras 20 filas) y la
// devuelve AGREGADA. { filas:[{mes,dia,sede,usuario,canal,tipoCita,tipoPaciente,rol,n}],
// citas, porUsuario, porSede, porCanal, creadasInconexion, meses, avisos, error }.
function auParseFilas(aoa) {
  var filasAoa = aoa || [];
  var iHead = -1, map = null;
  for (var r = 0; r < Math.min(20, filasAoa.length); r++) {
    var m = auColIndexMap(filasAoa[r]);
    if (!auFaltantes(m).length) { iHead = r; map = m; break; }
  }
  if (iHead === -1) {
    var faltan = auFaltantes(auColIndexMap(filasAoa[0] || []));
    return { error: 'El archivo no es el reporte de citas: faltan las columnas ' + faltan.join(', ') + '.', filas: [] };
  }
  var tieneRegcita = map.usuario_regcita !== undefined;
  var agg = {};
  var res = { citas: 0, porUsuario: {}, porSede: {}, porCanal: {}, creadasInconexion: 0, meses: {}, avisos: [], sinFechaCita: 0, sinUsuario: 0 };
  function sumar(f) {
    var k = [f.mes, f.dia, f.sede, f.usuario, f.canal, f.tipoCita, f.tipoPaciente, f.rol].join('\u0001');
    if (!agg[k]) agg[k] = Object.assign({}, f, { n: 0 });
    agg[k].n++;
  }
  for (var i = iHead + 1; i < filasAoa.length; i++) {
    var row = filasAoa[i];
    if (!row || !row.some(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; })) continue;
    var fc = auFecha(row[map.fechacita]);
    if (!fc) { res.sinFechaCita++; continue; }
    var usuario = auUsuario(row[map.usuario_confirma]);
    if (!usuario) { res.sinUsuario++; continue; }
    var base = {
      mes: fc.slice(0, 7),
      dia: auFecha(row[map.fecha_confirma]) || '',
      sede: auSede(row[map.nombresede]),
      canal: auCanal(row[map.motivo_conf]),
      tipoCita: auTipoCita(map.consulta !== undefined ? row[map.consulta] : null, map.cirugia !== undefined ? row[map.cirugia] : null),
      tipoPaciente: map.tipo_paciente !== undefined ? auTipoPaciente(row[map.tipo_paciente]) : 'Sin dato',
    };
    res.citas++;
    res.meses[base.mes] = (res.meses[base.mes] || 0) + 1;
    res.porUsuario[usuario] = (res.porUsuario[usuario] || 0) + 1;
    res.porSede[base.sede] = (res.porSede[base.sede] || 0) + 1;
    res.porCanal[base.canal] = (res.porCanal[base.canal] || 0) + 1;
    sumar(Object.assign({}, base, { usuario: usuario, rol: 'confirma' }));
    if (tieneRegcita) {
      var creador = auUsuario(row[map.usuario_regcita]);
      if (creador && creador !== AU_CLINICA) {
        res.creadasInconexion++;
        sumar(Object.assign({}, base, { usuario: creador, rol: 'crea' }));
      }
    }
  }
  if (res.sinFechaCita) res.avisos.push(res.sinFechaCita + ' fila(s) sin fecha de cita válida: no se cuentan.');
  if (res.sinUsuario) res.avisos.push(res.sinUsuario + ' fila(s) sin usuario que confirma: no se cuentan.');
  if (!tieneRegcita) res.avisos.push('El archivo no trae usuario_regcita: no se cuentan las citas creadas.');
  // Solo los campos permitidos, en un orden fijo (nada mas sale del navegador).
  res.filas = Object.keys(agg).map(function (k) {
    var o = {}; AU_CAMPOS_FILA.forEach(function (c) { o[c] = agg[k][c]; }); return o;
  });
  res.tieneRegcita = tieneRegcita;
  return res;
}

// ── Vista (pestaña "Agendas por usuaria") ──────────────────────────────
// filas: [{mes,dia,sede,usuario,asesora,canal,tipoCita,tipoPaciente,rol,n}]
// (asesora = nombre ya resuelto por el servidor, o el codigo si no hay alias).
function auFiltrar(filas, f) {
  var o = f || {};
  var en = function (lista, v) { return !lista || !lista.length || lista.indexOf(v) !== -1; };
  return (filas || []).filter(function (r) {
    return en(o.meses, r.mes) && en(o.asesoras, r.asesora) && en(o.sedes, r.sede) && en(o.canales, r.canal) &&
      en(o.tiposCita, r.tipoCita) && en(o.tiposPaciente, r.tipoPaciente);
  });
}
function auPct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }

// Tarjetas: total confirmadas y por canal (con % sobre el total).
function auTarjetas(filas) {
  var conf = (filas || []).filter(function (r) { return r.rol === 'confirma'; });
  var total = conf.reduce(function (s, r) { return s + r.n; }, 0);
  var c = {};
  AU_CANALES.forEach(function (k) { c[k] = 0; });
  conf.forEach(function (r) { c[r.canal] = (c[r.canal] || 0) + r.n; });
  var creadas = (filas || []).filter(function (r) { return r.rol === 'crea'; }).reduce(function (s, r) { return s + r.n; }, 0);
  return { total: total, llamada: c.Llamada, whatsapp: c.WhatsApp, noContesta: c['No contesta'], otro: c.Otro,
    pctLlamada: auPct(c.Llamada, total), pctWhatsapp: auPct(c.WhatsApp, total), pctNoContesta: auPct(c['No contesta'], total), creadas: creadas };
}

// Tabla por asesora, de mayor a menor total, con fila de total.
function auPorAsesora(filas) {
  var by = {};
  (filas || []).forEach(function (r) {
    if (!by[r.asesora]) by[r.asesora] = { asesora: r.asesora, total: 0, Llamada: 0, WhatsApp: 0, 'No contesta': 0, Otro: 0, creadas: 0 };
    if (r.rol === 'crea') by[r.asesora].creadas += r.n;
    else { by[r.asesora].total += r.n; by[r.asesora][r.canal] += r.n; }
  });
  var lista = Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) { return x.total || x.creadas; });
  var total = lista.reduce(function (s, x) { return s + x.total; }, 0);
  lista.forEach(function (x) { x.pct = auPct(x.total, total); });
  lista.sort(function (a, b) { return b.total - a.total || String(a.asesora).localeCompare(String(b.asesora)); });
  var suma = { asesora: 'Total', total: total, Llamada: 0, WhatsApp: 0, 'No contesta': 0, Otro: 0, creadas: 0, pct: total ? 100 : 0 };
  lista.forEach(function (x) { AU_CANALES.forEach(function (k) { suma[k] += x[k]; }); suma.creadas += x.creadas; });
  return { filas: lista, total: suma };
}

// Confirmadas por dia (fecha_confirma), ordenado.
function auPorDia(filas) {
  var by = {};
  (filas || []).forEach(function (r) { if (r.rol === 'confirma' && r.dia) by[r.dia] = (by[r.dia] || 0) + r.n; });
  return Object.keys(by).sort().map(function (d) { return { dia: d, n: by[d] }; });
}

// Valores distintos de un campo (para los filtros).
function auOpciones(filas, campo) {
  var s = {};
  (filas || []).forEach(function (r) { if (r[campo] !== undefined && r[campo] !== '') s[r[campo]] = true; });
  return Object.keys(s).sort(function (a, b) { return a.localeCompare(b); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AU_COLUMNAS: AU_COLUMNAS, AU_CANALES: AU_CANALES, AU_TIPOS_CITA: AU_TIPOS_CITA, AU_ROLES: AU_ROLES, AU_CLINICA: AU_CLINICA, AU_CAMPOS_FILA: AU_CAMPOS_FILA,
    auNorm: auNorm, auColIndexMap: auColIndexMap, auFaltantes: auFaltantes, auFecha: auFecha, auCanal: auCanal, auTipoCita: auTipoCita, auUsuario: auUsuario,
    auTipoPaciente: auTipoPaciente, auParseFilas: auParseFilas, auFiltrar: auFiltrar, auTarjetas: auTarjetas, auPorAsesora: auPorAsesora, auPorDia: auPorDia, auOpciones: auOpciones, auPct: auPct };
}
