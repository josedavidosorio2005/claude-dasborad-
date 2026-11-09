// agendas-usuaria-logic.js — Fase 259, cambiada en la Fase 265 (pedido de
// Edwin, 05/11, Clinica Aurora): "Agendas por usuaria" desde el reporte de
// citas que exporta el sistema de la clinica (una fila por cita). Logica pura,
// sin DOM.
//
// PRIVACIDAD: el archivo trae datos de pacientes (documento, nombre,
// telefono, direccion, diagnostico, observaciones). TODO se lee y se AGREGA
// en el navegador: al servidor solo llegan conteos por
// (fecha de la cita, fecha de solicitud, sede, usuario, especialidad). Las
// columnas se buscan por NOMBRE y solo se leen las de la lista de abajo.
//
// Fase 302: ahora 3 bases (Citas asignadas y cumplidas, Cancelaciones,
// Inasistencias) con el mapa de abajo. Historico -- Columnas del reporte (Fase 265, confirmado con OCTUBRE.xls): O = fechacita
// ("Fecha de cita"), M = fecha_registro ("Fecha de solicitud de la cita"),
// AE = especial (especialidad), BB = usuario_confirma (usuario de la asesora).
// "usuario" es el codigo del sistema ("INCONEXION", "INCONEXION A"...); el
// nombre real se resuelve AL MOSTRAR con alias_asesores, nunca al guardar.

// ── MAPA DE ENCABEZADOS (Fase 301; Fase 302 con los encabezados REALES de las 3
// bases de Aurora, 10/11). Es el unico lugar que se toca si cambia un nombre de
// columna. Cada columna se ubica por NOMBRE (sin importar mayusculas, tildes,
// espacios, guiones bajos ni puntos), nunca por posicion. Si varios sinonimos
// aparecen en el archivo gana el que va PRIMERO (asi «nombresede», el nombre de
// la sede, manda sobre «sede», que en el reporte es un codigo 001/002).
// Solo «fechacita» es obligatoria: si a una base le falta otra columna (ej.
// Cancelaciones e Inasistencias no traen fecha_registro) NO es error -- esas
// citas simplemente no suman en lo que dependa de esa columna. Las demas
// columnas del archivo (nombres, cedula, direccion, diagnostico...) no se leen.
// `key` es el nombre interno (no cambiarlo); `campo` es donde queda en la fila.
var AU_MAPA_ENCABEZADOS = [
  { key: 'fechacita', campo: 'fechaCita', etiqueta: 'Fecha de cita', obligatoria: true,
    sinonimos: ['fechacita', 'fecha cita', 'fecha de cita', 'fecha de la cita'] },
  { key: 'fecha_registro', campo: 'fechaSolicitud', etiqueta: 'Fecha de registro', obligatoria: false,
    sinonimos: ['fecha_registro', 'fecha registro', 'fecha de registro'] },
  { key: 'entidad', campo: 'entidad', etiqueta: 'Entidad', obligatoria: false,
    sinonimos: ['entidad', 'nombre entidad'] },
  { key: 'usuario_regcita', campo: 'usuario', etiqueta: 'Usuario que registra', obligatoria: false,
    sinonimos: ['usuario_regcita', 'usuario regcita', 'usuario que registra', 'usuario registra'] },
  { key: 'especial', campo: 'especialidad', etiqueta: 'Especialidad', obligatoria: false,
    sinonimos: ['especial', 'especialidad'] },
  { key: 'prof', campo: 'prof', etiqueta: 'Profesional', obligatoria: false,
    sinonimos: ['prof', 'profesional'] },
  { key: 'sede', campo: 'sede', etiqueta: 'Sede', obligatoria: false,
    sinonimos: ['nombresede', 'nombre sede', 'nombre de la sede', 'sede'] },
];
// Las 3 bases de Aurora (Fase 302). `id` es lo que se guarda (no cambiarlo);
// `archivo` reconoce la base por el nombre del archivo en Cargar Datos.
var AU_TIPOS_BASE = [
  { id: 'citas', etiqueta: 'Citas asignadas y cumplidas', archivo: /cita/i },
  { id: 'cancelaciones', etiqueta: 'Cancelaciones', archivo: /cancel/i },
  { id: 'inasistencias', etiqueta: 'Inasistencias', archivo: /inasist/i },
];
var AU_COLUMNAS = AU_MAPA_ENCABEZADOS.map(function (c) { return { key: c.key, obligatoria: c.obligatoria }; });
var AU_CLINICA = 'Clínica (no InConexion)';
// Fase 302: + entidad y prof. Nada mas sale del navegador.
var AU_CAMPOS_FILA = ['mes', 'fechaCita', 'fechaSolicitud', 'sede', 'usuario', 'especialidad', 'entidad', 'prof', 'n'];

function auNorm(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// Encabezado comparable: sin tildes, en minusculas, y espacios/_/-/. como un solo espacio.
function auNormEncabezado(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[\s_.\-]+/g, ' ').trim();
}

// { key: indiceDeColumna } buscando por NOMBRE con los sinonimos del mapa (gana
// el primer sinonimo que aparezca; entre columnas repetidas, la primera).
function auColIndexMap(header) {
  var norm = (header || []).map(auNormEncabezado);
  var map = {};
  AU_MAPA_ENCABEZADOS.forEach(function (c) {
    for (var s = 0; s < c.sinonimos.length && map[c.key] === undefined; s++) {
      var i = norm.indexOf(auNormEncabezado(c.sinonimos[s]));
      if (i !== -1) map[c.key] = i;
    }
  });
  return map;
}
function auFaltantes(map) {
  return AU_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; }).map(function (c) { return c.key; });
}

// Serial de Excel, Date (lectura con cellNF: medianoche local) o texto
// dd/mm/aaaa, aaaa-mm-dd -> 'AAAA-MM-DD'. El serial con aritmetica UTC.
function auFecha(v) {
  if (v === null || v === undefined || v === '') return null;
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

// Codigo del usuario: "INCONEXION", "INCONEXION A"... tal cual (normalizado);
// cualquier otro usuario (personal de la clinica) se agrupa, sin su nombre.
function auUsuario(v) {
  var s = auNorm(v);
  if (!s) return '';
  return /^INCONEXION\b/.test(s) ? s : AU_CLINICA;
}
function auTexto(v, vacio) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 120) || vacio; }

// Lee la hoja (encabezado en alguna de las primeras 20 filas) y la devuelve
// AGREGADA. opts (opcional): { base: id de AU_TIPOS_BASE, archivo: nombre } --
// cada fila agregada lleva su `base` y los errores dicen el archivo.
// -> { filas:[{mes,fechaCita,fechaSolicitud,sede,usuario,especialidad,entidad,prof,n,(base)}],
//      citas, porUsuario, porSede, porEspecialidad, meses, sinColumnas, avisos, error }
function auParseFilas(aoa, opts) {
  var o = opts || {};
  var filasAoa = aoa || [];
  var iHead = -1, map = null;
  var mejor = null; // la fila con mas columnas reconocidas (para decir que falta)
  for (var r = 0; r < Math.min(20, filasAoa.length); r++) {
    var m = auColIndexMap(filasAoa[r]);
    // El encabezado: las obligatorias y al menos 3 columnas del mapa.
    if (!auFaltantes(m).length && Object.keys(m).length >= 3) { iHead = r; map = m; break; }
    if (!mejor || Object.keys(m).length > Object.keys(mejor).length) mejor = m;
  }
  if (iHead === -1) {
    var faltan = auFaltantes(mejor || {});
    if (!faltan.length) {
      // Tiene fechacita pero casi nada mas: no parece una de las bases.
      var pocas = 'no parece una base de citas: solo se reconocen ' + Object.keys(mejor || {}).length + ' columna(s) de ' +
        AU_MAPA_ENCABEZADOS.map(function (c) { return c.key; }).join(', ') + ' (se necesitan al menos 3, con fechacita).';
      return { error: o.archivo ? 'El archivo «' + o.archivo + '»' + (o.base ? ' (' + auEtiquetaBase(o.base) + ')' : '') + ' ' + pocas : 'El archivo ' + pocas, faltan: [], filas: [] };
    }
    if (o.archivo) return { error: auMensajeFaltantes(faltan, o.archivo, o.base), faltan: faltan, filas: [] };
    return { error: 'El archivo no es el reporte de citas: faltan las columnas ' + faltan.join(', ') + '.', faltan: faltan, filas: [] };
  }
  var tiene = function (k) { return map[k] !== undefined; };
  var celda = function (row, k) { return tiene(k) ? row[map[k]] : null; };
  var agg = {};
  var res = { citas: 0, porUsuario: {}, porSede: {}, porEspecialidad: {}, meses: {}, avisos: [], sinFechaCita: 0, solicitudDesde: null, solicitudHasta: null,
    sinColumnas: AU_MAPA_ENCABEZADOS.filter(function (c) { return !tiene(c.key); }).map(function (c) { return c.key; }) };
  for (var i = iHead + 1; i < filasAoa.length; i++) {
    var row = filasAoa[i];
    if (!row || !row.some(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; })) continue;
    var fc = auFecha(celda(row, 'fechacita'));
    if (!fc) { res.sinFechaCita++; continue; }
    var fs = auFecha(celda(row, 'fecha_registro')) || '';
    if (!fs && tiene('fecha_registro')) res.sinSolicitud = (res.sinSolicitud || 0) + 1;
    var f = { mes: fc.slice(0, 7), fechaCita: fc, fechaSolicitud: fs,
      sede: auTexto(celda(row, 'sede'), ''), usuario: tiene('usuario_regcita') ? auUsuario(celda(row, 'usuario_regcita')) : '',
      especialidad: auTexto(celda(row, 'especial'), ''), entidad: auTexto(celda(row, 'entidad'), ''), prof: auTexto(celda(row, 'prof'), '') };
    if (o.base) f.base = o.base; // de que base vino
    var k = [f.mes, f.fechaCita, f.fechaSolicitud, f.sede, f.usuario, f.especialidad, f.entidad, f.prof, f.base || ''].join('\u0001');
    if (!agg[k]) agg[k] = Object.assign({}, f, { n: 0 });
    agg[k].n++;
    res.citas++;
    res.meses[f.mes] = (res.meses[f.mes] || 0) + 1;
    if (f.usuario) res.porUsuario[f.usuario] = (res.porUsuario[f.usuario] || 0) + 1;
    if (f.sede) res.porSede[f.sede] = (res.porSede[f.sede] || 0) + 1;
    if (f.especialidad) res.porEspecialidad[f.especialidad] = (res.porEspecialidad[f.especialidad] || 0) + 1;
    if (fs) {
      if (!res.solicitudDesde || fs < res.solicitudDesde) res.solicitudDesde = fs;
      if (!res.solicitudHasta || fs > res.solicitudHasta) res.solicitudHasta = fs;
    }
  }
  if (res.sinFechaCita) res.avisos.push(res.sinFechaCita + ' fila(s) sin fecha de cita válida: no se cuentan.');
  if (res.sinSolicitud) res.avisos.push(res.sinSolicitud + ' cita(s) sin fecha de registro: se cuentan, pero no suman al mirar por fecha de registro.');
  res.sinColumnas.forEach(function (key) {
    var c = AU_MAPA_ENCABEZADOS.filter(function (x) { return x.key === key; })[0];
    res.avisos.push('No trae la columna «' + c.etiqueta + '»: sus citas no suman en lo que dependa de esa columna.');
  });
  var campos = o.base ? AU_CAMPOS_FILA.concat(['base']) : AU_CAMPOS_FILA;
  res.filas = Object.keys(agg).map(function (key) {
    var x = {}; campos.forEach(function (c) { x[c] = agg[key][c]; }); return x;
  });
  return res;
}

// Fase 302: la base por el nombre del archivo ("INASISTENCIAS.xlsx" -> inasistencias). '' si no se reconoce.
function auBaseDesdeArchivo(nombre) {
  var n = String(nombre || '');
  var orden = ['inasistencias', 'cancelaciones', 'citas']; // "cita" aparece en los otros nombres: va de ultima
  for (var k = 0; k < orden.length; k++) {
    var b = AU_TIPOS_BASE.filter(function (t) { return t.id === orden[k]; })[0];
    if (b && b.archivo.test(n)) return b.id;
  }
  return '';
}

function auEtiquetaBase(id) {
  var b = AU_TIPOS_BASE.filter(function (t) { return t.id === id; })[0];
  return b ? b.etiqueta : (id || '');
}
// "En el archivo «x.xlsx» (Base 2) falta la columna «Fecha de cita» (se busca como: fechacita, fecha cita…)."
function auMensajeFaltantes(faltan, archivo, base) {
  var desc = (faltan || []).map(function (k) {
    var c = AU_MAPA_ENCABEZADOS.filter(function (x) { return x.key === k; })[0];
    return c ? '«' + c.etiqueta + '» (se busca como: ' + c.sinonimos.join(', ') + ')' : '«' + k + '»';
  });
  return 'En el archivo «' + (archivo || 'sin nombre') + '»' + (base ? ' (' + auEtiquetaBase(base) + ')' : '') +
    (desc.length === 1 ? ' falta la columna ' : ' faltan las columnas ') + desc.join('; ') + '.';
}

// Fase 301: lee 1 a 3 bases (cada una con su tipo) y las UNE en un solo conjunto.
// partes: [{ base, archivo, aoa }]. Si alguna falla, no se une nada y vuelve
// `errores` (uno por archivo) para no guardar a medias.
// -> { filas (cada una con `base`), citas, porBase: { base: { archivo, citas, meses } },
//      meses, avisos, errores, error }
function auUnirBases(partes) {
  var ids = AU_TIPOS_BASE.map(function (t) { return t.id; });
  var out = { filas: [], citas: 0, porBase: {}, meses: {}, avisos: [], errores: [] };
  var vistas = {};
  (partes || []).forEach(function (p) {
    if (ids.indexOf(p.base) === -1) { out.errores.push('El archivo «' + (p.archivo || 'sin nombre') + '» no tiene una base válida.'); return; }
    if (vistas[p.base]) { out.errores.push(auEtiquetaBase(p.base) + ' viene dos veces («' + vistas[p.base] + '» y «' + p.archivo + '»): sube un archivo por base.'); return; }
    vistas[p.base] = p.archivo || 'sin nombre';
    var r = auParseFilas(p.aoa, { base: p.base, archivo: p.archivo || 'sin nombre' });
    if (r.error) { out.errores.push(r.error); return; }
    if (!r.filas.length) { out.errores.push('El archivo «' + (p.archivo || 'sin nombre') + '» (' + auEtiquetaBase(p.base) + ') no tiene citas que contar.'); return; }
    out.porBase[p.base] = { archivo: p.archivo || '', citas: r.citas, meses: Object.keys(r.meses).sort() };
    Object.keys(r.meses).forEach(function (m) { out.meses[m] = (out.meses[m] || 0) + r.meses[m]; });
    r.avisos.forEach(function (a) { out.avisos.push('«' + p.archivo + '» (' + auEtiquetaBase(p.base) + '): ' + a); });
    out.citas += r.citas;
    out.filas = out.filas.concat(r.filas);
  });
  if (!Object.keys(vistas).length && !out.errores.length) out.errores.push('Elige al menos un archivo.');
  if (out.errores.length) { out.error = out.errores.join(' '); out.filas = []; }
  return out;
}

// ── Vista (pestaña "Agendas por usuaria": por mes, por especialidad, por asesor) ──
// filas: [{mes,fechaCita,fechaSolicitud,sede,usuario,asesora,especialidad,n}]
// (asesora = nombre ya resuelto por el servidor, o el codigo si no hay alias).
// f: { meses, sedes, asesoras, citaDesde, citaHasta, solicitudDesde, solicitudHasta }
function auFiltrar(filas, f) {
  var o = f || {};
  var en = function (lista, v) { return !lista || !lista.length || lista.indexOf(v) !== -1; };
  var rango = function (v, desde, hasta) { if (!desde && !hasta) return true; if (!v) return false; return (!desde || v >= desde) && (!hasta || v <= hasta); };
  return (filas || []).filter(function (r) {
    return en(o.meses, r.mes) && en(o.sedes, r.sede) && en(o.asesoras, r.asesora) &&
      rango(r.fechaCita, o.citaDesde, o.citaHasta) && rango(r.fechaSolicitud, o.solicitudDesde, o.solicitudHasta);
  });
}
function auPct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
function auTotal(filas) { return (filas || []).reduce(function (s, r) { return s + r.n; }, 0); }

// a) Agendas por mes (mes de la cita), ordenado.
function auPorMes(filas) {
  var by = {};
  (filas || []).forEach(function (r) { by[r.mes] = (by[r.mes] || 0) + r.n; });
  return Object.keys(by).sort().map(function (m) { return { mes: m, n: by[m] }; });
}

// b) Agendas por especialidad, de mayor a menor, con %.
function auPorEspecialidad(filas) {
  var by = {};
  (filas || []).forEach(function (r) { by[r.especialidad] = (by[r.especialidad] || 0) + r.n; });
  var total = auTotal(filas);
  return Object.keys(by).map(function (k) { return { especialidad: k, n: by[k], pct: auPct(by[k], total) }; })
    .sort(function (a, b) { return b.n - a.n || a.especialidad.localeCompare(b.especialidad); });
}

// c) Agendas por asesor: total y por mes (linea de tiempo), de mayor a menor.
function auPorAsesor(filas) {
  var meses = auPorMes(filas).map(function (x) { return x.mes; });
  var by = {};
  (filas || []).forEach(function (r) {
    if (!by[r.asesora]) by[r.asesora] = { asesora: r.asesora, total: 0, porMes: {} };
    by[r.asesora].total += r.n;
    by[r.asesora].porMes[r.mes] = (by[r.asesora].porMes[r.mes] || 0) + r.n;
  });
  var total = auTotal(filas);
  var lista = Object.keys(by).map(function (k) {
    var a = by[k];
    return { asesora: a.asesora, total: a.total, pct: auPct(a.total, total), serie: meses.map(function (m) { return a.porMes[m] || 0; }) };
  }).sort(function (a, b) { return b.total - a.total || String(a.asesora).localeCompare(String(b.asesora)); });
  return { meses: meses, filas: lista, total: total };
}

// Valores distintos de un campo (para los filtros).
function auOpciones(filas, campo) {
  var s = {};
  (filas || []).forEach(function (r) { if (r[campo] !== undefined && r[campo] !== '') s[r[campo]] = true; });
  return Object.keys(s).sort(function (a, b) { return a.localeCompare(b); });
}

// ── Fase 302: vista «Agendas» (filtros + base + 2 graficas) ──
// Solo filas con base (las 3 bases); lo cargado antes con el reporte de una sola
// base (base '') no entra: su "usuario" era el que confirma, no el que registra.
// f: { meses, bases (null = todas), citaDesde, citaHasta, registroDesde, registroHasta,
//      entidad, usuario, especialidad, prof, sede } ('' = sin filtro)
var AU_DIMENSIONES = { usuario: 'Usuario que registra', especialidad: 'Especialidad', prof: 'Profesional', entidad: 'Entidad', sede: 'Sede' };
function auValorDim(r, dim) { return dim === 'usuario' ? (r.asesora || r.usuario || '') : (r[dim] || ''); }
function auFiltrarAgendas(filas, f) {
  var o = f || {};
  return (filas || []).filter(function (r) {
    if (!r.base) return false;
    if (o.bases && o.bases.length && o.bases.indexOf(r.base) === -1) return false;
    if (o.meses && o.meses.length && o.meses.indexOf(r.mes) === -1) return false;
    if (o.citaDesde && r.fechaCita < o.citaDesde) return false;
    if (o.citaHasta && r.fechaCita > o.citaHasta) return false;
    if ((o.registroDesde || o.registroHasta) && !r.fechaSolicitud) return false;
    if (o.registroDesde && r.fechaSolicitud < o.registroDesde) return false;
    if (o.registroHasta && r.fechaSolicitud > o.registroHasta) return false;
    for (var d in AU_DIMENSIONES) if (o[d] && auValorDim(r, d) !== o[d]) return false;
    return true;
  });
}
// Linea por mes de `campo` ('fechaCita' | 'fechaSolicitud'): una serie por base y el total.
// Las citas sin esa fecha no suman (sinFecha cuenta cuantas quedaron fuera, por base).
function auSerieMensual(filas, campo) {
  var meses = {}, porBase = {}, sinFecha = {};
  (filas || []).forEach(function (r) {
    var d = r[campo];
    if (!d) { sinFecha[r.base] = (sinFecha[r.base] || 0) + r.n; return; }
    var m = d.slice(0, 7); meses[m] = true;
    porBase[r.base] = porBase[r.base] || {};
    porBase[r.base][m] = (porBase[r.base][m] || 0) + r.n;
  });
  var lista = Object.keys(meses).sort();
  var series = AU_TIPOS_BASE.filter(function (b) { return porBase[b.id]; }).map(function (b) {
    return { base: b.id, etiqueta: b.etiqueta, data: lista.map(function (m) { return porBase[b.id][m] || 0; }) };
  });
  var total = lista.map(function (m, k) { return series.reduce(function (s, x) { return s + x.data[k]; }, 0); });
  return { meses: lista, series: series, total: total, sinFecha: sinFecha };
}
// Ranking por `dim` (usuario | especialidad | prof | ...): de mayor a menor, con el
// detalle por base. Las citas sin ese dato no suman. top: cuantas mostrar (null = todas).
function auRanking(filas, dim, top) {
  var acc = {};
  (filas || []).forEach(function (r) {
    var v = auValorDim(r, dim); if (!v) return;
    var x = acc[v] || (acc[v] = { valor: v, total: 0, porBase: {} });
    x.total += r.n; x.porBase[r.base] = (x.porBase[r.base] || 0) + r.n;
  });
  var todos = Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(function (a, b) { return b.total - a.total || (a.valor < b.valor ? -1 : 1); });
  var n = (top && top > 0) ? Math.min(top, todos.length) : todos.length;
  return { items: todos.slice(0, n), cantidad: todos.length, ocultos: todos.length - n };
}
function auOpcionesAgendas(filas, dim) {
  var vistos = {};
  (filas || []).forEach(function (r) { var v = auValorDim(r, dim); if (v) vistos[v] = true; });
  return Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AU_COLUMNAS: AU_COLUMNAS, AU_CLINICA: AU_CLINICA, AU_CAMPOS_FILA: AU_CAMPOS_FILA,
    AU_MAPA_ENCABEZADOS: AU_MAPA_ENCABEZADOS, AU_TIPOS_BASE: AU_TIPOS_BASE, auNormEncabezado: auNormEncabezado,
    auBaseDesdeArchivo: auBaseDesdeArchivo, AU_DIMENSIONES: AU_DIMENSIONES, auFiltrarAgendas: auFiltrarAgendas,
    auSerieMensual: auSerieMensual, auRanking: auRanking, auOpcionesAgendas: auOpcionesAgendas, auValorDim: auValorDim,
    auUnirBases: auUnirBases, auMensajeFaltantes: auMensajeFaltantes, auEtiquetaBase: auEtiquetaBase,
    auNorm: auNorm, auColIndexMap: auColIndexMap, auFaltantes: auFaltantes, auFecha: auFecha, auUsuario: auUsuario,
    auParseFilas: auParseFilas, auFiltrar: auFiltrar, auPct: auPct, auTotal: auTotal, auPorMes: auPorMes, auPorEspecialidad: auPorEspecialidad, auPorAsesor: auPorAsesor, auOpciones: auOpciones };
}
