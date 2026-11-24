// equidad-agendamiento.js — Equidad de agendamiento de ORLANT (plan de acción 20/11, punto A6; propuesta en
// docs/orlant/equidad/propuesta.md). Paso EQ1, adelantado el 24/11 sin esperar a Isa: lector de los dos
// formatos reales (completo de 17 columnas y corto de 6), los cálculos del HTML de Isa y el guardado por grupo.
//
// TODO lo que depende de una respuesta de Isa es UNA opción de OPCIONES_POR_DEFECTO: cuando responda, se cambia
// el valor (o se pasa otro en `opciones`) y nada más. Los valores por defecto repiten lo que hace hoy su HTML.
// Todavía NO hay ruta, pantalla ni pestaña (eso es EQ2 y depende de las preguntas 7 y 8).
//
// Datos sensibles: CITOBSOBS (observación libre) NUNCA sale del lector; CITUSU (usuario que agenda) y la entidad
// de Particulares solo si su opción lo pide. Lo que no se guarda se descarta en memoria.
'use strict';

const GRUPOS = Object.freeze(['PREPAGADAS', 'PARTICULARES', 'POLIZA_SURA']);

const OPCIONES_POR_DEFECTO = Object.freeze({
  // Pregunta 5: margen (en % del promedio por médico) para marcar desequilibrio. null = solo la línea del promedio,
  // como el HTML; un número (p. ej. 20) marca a cada médico «sobre» / «bajo» / «dentro».
  margenDesequilibrioPct: null,
  // Pregunta 6: 'reemplazar_meses' = cada carga reemplaza los meses (por fecha de cita) que trae, de ese grupo;
  // 'sumar' = agrega sin borrar.
  modoCarga: 'reemplazar_meses',
  // Pregunta A: guardar la entidad en Particulares (parece un dato del paciente). Prepagadas y Póliza SURA, siempre.
  guardarEntidadParticulares: false,
  // Pregunta B: guardar el usuario que agenda (CITUSU, solo formato completo) para ver la equidad por usuario.
  guardarUsuario: false,
  // Pregunta C: citas repetidas del mismo médico a la misma fecha y hora: 'todas' cuentan, o 'una' sola vez.
  repetidas: 'todas',
  // Preguntas D y F: si son listas (textos normalizados), las filas de otra especialidad / otro examen quedan
  // FUERA. null = cuentan todas (solo un aviso), como el HTML, que usa el archivo que Isa ya filtró.
  especialidadesPermitidas: null,
  examenesPermitidos: null,
  // Pregunta E: 'ambos' | 'corto' | 'completo'.
  formatosAceptados: 'ambos',
  // Pregunta 7: la ve la cuenta cliente ORLANT (y con el nombre del médico). Se usará en EQ2.
  visibleParaCliente: false,
  // Pregunta 11: primer mes (AAAA-MM) que se acepta; null = cualquiera.
  mesInicial: null,
});

const COMPLETO = Object.freeze(['CODIGO_SEDE', 'CODIGO_EXAMEN', 'NOMBRE_EXAMEN', 'CITESP', 'ESPNOM', 'CITMED', 'MEDNOM', 'CITTIP', 'CITUSU',
  'FECHA_SOL', 'HORA_SOL', 'FECHA_CITA', 'HORA_CITA', 'CITTIR', 'CODIGO_ENTIDAD', 'NOMBRE_ENTIDAD', 'CITOBSOBS']);
const CORTO = Object.freeze(['CODIGO_SEDE', 'NOMBRE_EXAMEN', 'ESPNOM', 'MEDNOM', 'FECHA_CITA', 'NOMBRE_ENTIDAD']);

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

function opcionesDe(o) {
  const r = Object.assign({}, OPCIONES_POR_DEFECTO, o || {});
  if (!['reemplazar_meses', 'sumar'].includes(r.modoCarga)) throw new Error('modoCarga inválido');
  if (!['todas', 'una'].includes(r.repetidas)) throw new Error('repetidas inválido');
  if (!['ambos', 'corto', 'completo'].includes(r.formatosAceptados)) throw new Error('formatosAceptados inválido');
  if (r.margenDesequilibrioPct !== null && !(Number.isFinite(r.margenDesequilibrioPct) && r.margenDesequilibrioPct > 0)) throw new Error('margenDesequilibrioPct inválido');
  return r;
}

// Fecha (y hora, si viene) desde un Date, un serial de Excel o un texto «AAAA-MM-DD[ hh:mm]» / «DD/MM/AAAA[ hh:mm]».
function fechaHora(v) {
  if (v === null || v === undefined || v === '') return null;
  let d = null;
  if (v instanceof Date) d = isNaN(v.getTime()) ? null : v;
  else if (typeof v === 'number' && v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000));
  if (d) return { fecha: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), hora: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return valida(m[1], m[2], m[3], m[4], m[5]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?/);
  return m ? valida(m[3], pad(m[2]), pad(m[1]), m[4], m[5]) : null;
}
function valida(a, me, d, h, mi) {
  const f = a + '-' + me + '-' + d;
  const x = new Date(f + 'T00:00:00Z');
  if (isNaN(x.getTime()) || x.toISOString().slice(0, 10) !== f) return null;
  return { fecha: f, hora: h !== undefined ? pad(h) + ':' + mi : null };
}
function hora(v) {
  if (v instanceof Date) return pad(v.getUTCHours()) + ':' + pad(v.getUTCMinutes());
  if (typeof v === 'number' && v >= 0 && v < 1) { const m = Math.round(v * 1440); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  const m = String(v == null ? '' : v).match(/(\d{1,2}):(\d{2})/);
  return m ? pad(m[1]) + ':' + m[2] : null;
}

// Formato por los encabezados (nunca por el nombre del archivo ni de la hoja).
function formatoDe(encabezados) {
  const h = new Set(encabezados.map(norm));
  if (COMPLETO.every((c) => h.has(c))) return 'completo';
  if (CORTO.every((c) => h.has(c))) return 'corto';
  return null;
}

// filas: arreglo de arreglos con el encabezado en la primera fila (XLSX.utils.sheet_to_json(ws, { header: 1 })).
// → { formato, citas, avisos, error? }. Cada cita: { grupo, sede, examen, especialidad, medico, medicoCodigo,
//   fecha, hora, entidad, usuario }. Nunca la observación.
function leer(filas, grupo, opciones) {
  const op = opcionesDe(opciones);
  if (!GRUPOS.includes(grupo)) return { error: 'Grupo inválido: ' + grupo };
  if (!Array.isArray(filas) || !filas.length) return { error: 'El archivo está vacío' };
  const enc = (filas[0] || []).map(norm);
  const formato = formatoDe(enc);
  if (!formato) return { error: 'No es el formato de equidad: faltan columnas (se esperan las 6 del formato corto o las 17 del completo)' };
  if (op.formatosAceptados !== 'ambos' && op.formatosAceptados !== formato) return { error: 'Por ahora solo se acepta el formato ' + op.formatosAceptados };
  const ix = (c) => enc.indexOf(c);
  const col = (f, c) => (ix(c) >= 0 ? f[ix(c)] : undefined);
  const avisos = { otraEspecialidad: 0, otroExamen: 0, repetidas: 0, sinMedico: 0, sinFecha: 0, antesDelMesInicial: 0, filtradas: 0 };
  const citas = [];
  const vistas = new Set();
  const espOk = op.especialidadesPermitidas && new Set(op.especialidadesPermitidas.map(norm));
  const exaOk = op.examenesPermitidos && new Set(op.examenesPermitidos.map(norm));
  // FECHA_CITA real trae solo la fecha (una única hora en todo el archivo, la medianoche según la zona horaria):
  // si todas las filas tienen la misma hora, no es una hora de verdad y no se usa (sin ella no hay «repetidas»
  // en el formato corto, que no trae HORA_CITA; queda el aviso sinHoraEnCorto).
  const horasFecha = new Set(filas.slice(1).map((f) => { const x = Array.isArray(f) ? fechaHora(col(f, 'FECHA_CITA')) : null; return x ? x.hora : null; }).filter(Boolean));
  const fechaConHora = horasFecha.size > 1;
  const espMasComun = masComun(filas.slice(1).map((f) => norm(col(f, 'ESPNOM'))));
  const exaMasComun = masComun(filas.slice(1).map((f) => norm(col(f, 'NOMBRE_EXAMEN'))));
  for (const f of filas.slice(1)) {
    if (!Array.isArray(f) || f.every((x) => x === null || x === undefined || x === '')) continue;
    const medico = norm(col(f, 'MEDNOM'));
    const medicoCodigo = formato === 'completo' ? (String(col(f, 'CITMED') == null ? '' : col(f, 'CITMED')).trim() || null) : null;
    if (!medico && !medicoCodigo) { avisos.sinMedico++; continue; }
    const fh = fechaHora(col(f, 'FECHA_CITA'));
    if (!fh) { avisos.sinFecha++; continue; }
    if (op.mesInicial && fh.fecha.slice(0, 7) < op.mesInicial) { avisos.antesDelMesInicial++; continue; }
    const especialidad = norm(col(f, 'ESPNOM'));
    const examen = norm(col(f, 'NOMBRE_EXAMEN'));
    if (especialidad !== espMasComun) avisos.otraEspecialidad++;
    if (examen !== exaMasComun) avisos.otroExamen++;
    if ((espOk && !espOk.has(especialidad)) || (exaOk && !exaOk.has(examen))) { avisos.filtradas++; continue; }
    const hf = fechaConHora ? fh.hora : null;
    const hc = formato === 'completo' ? (hora(col(f, 'HORA_CITA')) || hf) : hf;
    const clave = (medicoCodigo || medico) + '|' + fh.fecha + '|' + (hc || '');
    if (hc && vistas.has(clave)) { avisos.repetidas++; if (op.repetidas === 'una') continue; }
    vistas.add(clave);
    const conEntidad = grupo !== 'PARTICULARES' || op.guardarEntidadParticulares;
    citas.push({
      grupo, sede: norm(col(f, 'CODIGO_SEDE')) || null, examen: examen || null, especialidad: especialidad || null,
      medico: medico || medicoCodigo, medicoCodigo, fecha: fh.fecha, hora: hc,
      entidad: conEntidad ? (norm(col(f, 'NOMBRE_ENTIDAD')) || null) : null,
      usuario: op.guardarUsuario && formato === 'completo' ? (norm(col(f, 'CITUSU')) || null) : null,
    });
  }
  avisos.sinHoraEnCorto = formato === 'corto' && !fechaConHora;
  return { formato, citas, avisos };
}
function masComun(l) {
  const c = new Map(); for (const x of l) if (x) c.set(x, (c.get(x) || 0) + 1);
  let mejor = '', n = -1; for (const [k, v] of c) if (v > n) { mejor = k; n = v; }
  return mejor;
}

// Cálculos del HTML (propuesta §3) sobre las citas de UN grupo y los filtros { sede, medico, desde, hasta }.
function calcular(citas, filtros, opciones) {
  const op = opcionesDe(opciones);
  const fl = filtros || {};
  const l = citas.filter((c) => (!fl.sede || c.sede === norm(fl.sede)) && (!fl.medico || c.medico === norm(fl.medico))
    && (!fl.desde || c.fecha >= fl.desde) && (!fl.hasta || c.fecha <= fl.hasta));
  const total = l.length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const porMedico = new Map(), porSede = new Map(), porEntidad = new Map(), porFecha = new Map();
  for (const c of l) {
    if (!porMedico.has(c.medico)) porMedico.set(c.medico, { medico: c.medico, total: 0, porSede: {} });
    const m = porMedico.get(c.medico); m.total++; m.porSede[c.sede || 'SIN SEDE'] = (m.porSede[c.sede || 'SIN SEDE'] || 0) + 1;
    porSede.set(c.sede || 'SIN SEDE', (porSede.get(c.sede || 'SIN SEDE') || 0) + 1);
    if (c.entidad) porEntidad.set(c.entidad, (porEntidad.get(c.entidad) || 0) + 1);
    porFecha.set(c.fecha, (porFecha.get(c.fecha) || 0) + 1);
  }
  const medicos = porMedico.size;
  const promedioExacto = medicos ? total / medicos : 0;
  const promedio = Math.round(promedioExacto);
  const margen = op.margenDesequilibrioPct;
  const detalle = [...porMedico.values()].sort((a, b) => b.total - a.total || a.medico.localeCompare(b.medico)).map((m) => {
    const vs = Math.round((m.total - promedioExacto) * 10) / 10;
    const r = Object.assign({}, m, { participacionPct: pct(m.total), vsPromedio: vs });
    if (margen !== null) {
      const lim = promedioExacto * (margen / 100);
      r.estado = vs > lim ? 'sobre' : vs < -lim ? 'bajo' : 'dentro';
    }
    return r;
  });
  const fechas = [...porFecha.keys()].sort();
  const mayor = detalle[0] || null;
  return {
    total, medicos, promedio,
    desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null,
    porSede: [...porSede].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([sede, n]) => ({ sede, citas: n, pct: pct(n) })),
    mayor: mayor ? { medico: mayor.medico, citas: mayor.total, pct: mayor.participacionPct } : null,
    detalle,
    porEntidad: [...porEntidad].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([entidad, n]) => ({ entidad, citas: n, pct: pct(n) })),
    porFecha: fechas.map((f) => ({ fecha: f, citas: porFecha.get(f) })),
  };
}

// ── Guardado (tabla propia; la carga por el Centro de cargas, con respaldo y «Deshacer», es EQ1 con la ruta) ──
function asegurarTabla(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS equidad_citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL, grupo TEXT NOT NULL, sede TEXT, examen TEXT, especialidad TEXT,
    medico TEXT NOT NULL, medicoCodigo TEXT, fecha TEXT NOT NULL, hora TEXT, entidad TEXT, usuario TEXT,
    archivoNombre TEXT, cargadoPor TEXT, cargadoAt TEXT NOT NULL)`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_equidad_citas_cgf ON equidad_citas (campana, grupo, fecha)');
}
// Todo o nada. Con 'reemplazar_meses' borra antes los meses (de ese grupo) que trae la carga.
function guardar(db, { campana, grupo, citas, archivoNombre, cargadoPor, opciones }) {
  const op = opcionesDe(opciones);
  if (!GRUPOS.includes(grupo)) throw new Error('Grupo inválido');
  if (!citas.every((c) => c.grupo === grupo)) throw new Error('Citas de otro grupo');
  asegurarTabla(db);
  const meses = [...new Set(citas.map((c) => c.fecha.slice(0, 7)))].sort();
  const ahora = new Date().toISOString();
  let borradas = 0;
  db.transaction(() => {
    if (op.modoCarga === 'reemplazar_meses') {
      const del = db.prepare("DELETE FROM equidad_citas WHERE campana = ? AND grupo = ? AND substr(fecha, 1, 7) = ?");
      for (const m of meses) borradas += del.run(campana, grupo, m).changes;
    }
    const ins = db.prepare(`INSERT INTO equidad_citas (campana, grupo, sede, examen, especialidad, medico, medicoCodigo, fecha, hora, entidad, usuario, archivoNombre, cargadoPor, cargadoAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const c of citas) ins.run(campana, grupo, c.sede, c.examen, c.especialidad, c.medico, c.medicoCodigo, c.fecha, c.hora, c.entidad, c.usuario, archivoNombre || null, cargadoPor || null, ahora);
  })();
  return { insertadas: citas.length, borradas, meses };
}
function listar(db, { campana, grupo }) {
  asegurarTabla(db);
  return db.prepare('SELECT grupo, sede, examen, especialidad, medico, medicoCodigo, fecha, hora, entidad, usuario FROM equidad_citas WHERE campana = ? AND grupo = ? ORDER BY fecha, hora, id').all(campana, grupo);
}

module.exports = { GRUPOS, OPCIONES_POR_DEFECTO, COMPLETO, CORTO, opcionesDe, formatoDe, fechaHora, leer, calcular, asegurarTabla, guardar, listar, norm };
