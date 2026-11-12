// encuesta-monitoreo.js — Fase 331 (pedido del supervisor, Mobilize):
// "Calidad de encuestas". Las llamadas cuya encuesta salio mal calificada se
// escuchan y califican desde el Modulo de Calidad.
//
// - Que es "mal calificada" lo dice la tabla encuesta_monitoreo_reglas (por
//   campaña y pregunta, rango min..max inclusivo). Una campaña sin reglas no
//   tiene esta funcion (hoy solo MOBILIZE).
// - Una sola fila por llamada (CONN_ID), aunque haya fallado varias preguntas.
//   Las encuestas sin CONN_ID no se pueden ubicar en Wolkvox: se cuentan
//   aparte ("sinId") y no entran a la lista.
// - Resuelta = ya existe un monitoreo con ese encuestaConnId (indice unico en
//   monitoreos: el servidor nunca guarda un segundo).
// - Bloqueo "la esta calificando otra persona": una fila por llamada con
//   vencimiento (BLOQUEO_MS). Se renueva mientras el formulario esta abierto
//   y se libera al guardar o cancelar.
// - Fase 344: el telefono (ANI) de la encuesta sale SOLO con opts.verTelefono (la ruta
//   lo pide con puedeVerTelefono: CALIDAD, SUPERVISOR, Reportes, administrador). Por
//   defecto no sale. '' = la encuesta se cargo sin ANI (se ve «—»).
// Logica de base de datos sin Express.
'use strict';

// 15 minutos: alcanza para escuchar una llamada y calificar; el formulario
// abierto lo renueva solo (cada RENOVAR_MS), asi que solo vence si la persona
// cerro la pestaña o perdio la conexion sin cancelar.
const BLOQUEO_MS = 15 * 60 * 1000;
const RENOVAR_MS = 2 * 60 * 1000;
const PREGUNTAS = ['q1', 'q2', 'q3', 'q4'];
const LIMITE_LISTA = 2000;

function reglasDe(db, campana) {
  return db
    .prepare('SELECT pregunta, min, max FROM encuesta_monitoreo_reglas WHERE campana = ? ORDER BY pregunta')
    .all(campana)
    .filter((r) => PREGUNTAS.includes(r.pregunta));
}

function campanaTieneReglas(db, campana) {
  return reglasDe(db, campana).length > 0;
}

// Preguntas mal calificadas de una fila de encuesta: [{ pregunta, valor }].
function fallasDeFila(fila, reglas) {
  const out = [];
  for (const r of reglas) {
    const v = fila[r.pregunta];
    if (v !== null && v !== undefined && v >= r.min && v <= r.max) out.push({ pregunta: r.pregunta, valor: v });
  }
  return out;
}

// WHERE "alguna pregunta mal calificada" armado desde las reglas (los nombres
// de columna salen de la lista cerrada PREGUNTAS, los numeros van por parametro).
function condicionFallas(reglas, params) {
  return '(' + reglas.map((r, k) => {
    params['min' + k] = r.min;
    params['max' + k] = r.max;
    return `(${r.pregunta} IS NOT NULL AND ${r.pregunta} BETWEEN @min${k} AND @max${k})`;
  }).join(' OR ') + ')';
}

function filtrosFecha(q, clausulas, params) {
  // Fase 331 (PR 4): skill y asesor, como el panel Encuesta del dashboard.
  if (q.skill) { clausulas.push('skill = @skill'); params.skill = q.skill; }
  if (q.agente) { clausulas.push('agente = @agente'); params.agente = q.agente; }
  if (q.desde) { clausulas.push('fecha >= @desde'); params.desde = q.desde; }
  if (q.hasta) { clausulas.push('fecha <= @hasta'); params.hasta = q.hasta; }
  if (q.meses) {
    const meses = String(q.meses).split(',');
    clausulas.push('substr(fecha, 1, 7) IN (' + meses.map((m, k) => '@mes' + k).join(', ') + ')');
    meses.forEach((m, k) => { params['mes' + k] = m; });
  }
}

function bloqueoVigente(db, campana, connId, ahora) {
  const b = db.prepare('SELECT userId, nombre, expira FROM encuesta_monitoreo_bloqueos WHERE campana = ? AND connId = ?').get(campana, connId);
  return b && b.expira > ahora ? b : null;
}

// Mismo criterio que el resto de la plataforma: el admin maestro no tiene
// users.id (null); se compara por id, y por nombre solo para el maestro.
function esDelActor(b, actor) {
  if (!b || !actor) return false;
  if (actor.isMasterAdmin) return b.userId === null && b.nombre === actor.nombre;
  return b.userId === actor.id;
}

function monitoreoResumen(m) {
  return {
    id: m.id, fecha: m.fecha, asesor: m.asesor, evaluador: m.evaluador,
    puntaje: m.puntaje, clasificacion: m.clasificacion, observaciones: m.observaciones || '',
  };
}

// Lista de llamadas mal calificadas. estado: 'pendientes' | 'resueltas' | 'todas'.
// pregunta (opcional): solo las que fallaron ESA pregunta (boton "Monitoreo"
// de la Encuesta). Devuelve { reglas, filas, conteo: { pendientes, resueltas, sinId } }.
function listar(db, q, actor, opts) {
  const verTelefono = !!(opts && opts.verTelefono);
  const reglasTodas = reglasDe(db, q.campana);
  if (!reglasTodas.length) return { reglas: [], filas: [], conteo: { pendientes: 0, resueltas: 0, sinId: 0 } };
  const reglas = q.pregunta ? reglasTodas.filter((r) => r.pregunta === q.pregunta) : reglasTodas;
  if (!reglas.length) return { reglas: reglasTodas, filas: [], conteo: { pendientes: 0, resueltas: 0, sinId: 0 } };
  const params = { campana: q.campana };
  const clausulas = ['campana = @campana', condicionFallas(reglas, params)];
  filtrosFecha(q, clausulas, params);
  const where = clausulas.join(' AND ');
  const sinId = db.prepare(`SELECT COUNT(*) AS n FROM encuestas WHERE ${where} AND connId = ''`).get(params).n;
  // Una fila por CONN_ID (si un mismo ID aparece dos veces, la primera por fecha).
  const filas = db.prepare(
    `SELECT connId, fecha, hora, agente, skill, q1, q2, q3, q4, telefono FROM encuestas
      WHERE ${where} AND connId <> '' ORDER BY fecha DESC, id DESC`
  ).all(params);
  const vistos = new Set();
  const unicas = [];
  for (const f of filas) {
    if (vistos.has(f.connId)) continue;
    vistos.add(f.connId);
    unicas.push(f);
  }
  const monPorConn = new Map();
  if (unicas.length) {
    db.prepare('SELECT * FROM monitoreos WHERE campana = ? AND encuestaConnId IS NOT NULL').all(q.campana)
      .forEach((m) => monPorConn.set(m.encuestaConnId, m));
  }
  const ahora = Date.now();
  const bloqueos = new Map();
  db.prepare('SELECT connId, userId, nombre, expira FROM encuesta_monitoreo_bloqueos WHERE campana = ? AND expira > ?').all(q.campana, ahora)
    .forEach((b) => bloqueos.set(b.connId, b));
  let pendientes = 0;
  let resueltas = 0;
  const out = [];
  for (const f of unicas) {
    const m = monPorConn.get(f.connId);
    if (m) resueltas++; else pendientes++;
    const estado = m ? 'resuelta' : 'pendiente';
    if (q.estado === 'pendientes' && m) continue;
    if (q.estado === 'resueltas' && !m) continue;
    const b = !m ? bloqueos.get(f.connId) : null;
    const fila = {
      connId: f.connId,
      fecha: f.fecha,
      hora: f.hora || '',
      agente: f.agente,
      skill: f.skill,
      // Siempre TODAS las preguntas que fallo la llamada (aunque se filtre por una).
      fallas: fallasDeFila(f, reglasTodas),
      estado,
      bloqueo: b ? { nombre: b.nombre, propio: esDelActor(b, actor), expira: new Date(b.expira).toISOString() } : null,
      monitoreo: m ? monitoreoResumen(m) : null,
    };
    if (verTelefono) fila.telefono = f.telefono || '';
    out.push(fila);
  }
  return { reglas: reglasTodas, filas: out.slice(0, LIMITE_LISTA), conteo: { pendientes, resueltas, sinId } };
}

function contarPendientes(db, campana) {
  return listar(db, { campana, estado: 'pendientes' }, null).conteo.pendientes;
}

// La llamada como fila "mal calificada" (o null si no existe o no fallo nada).
function llamadaMalCalificada(db, campana, connId) {
  const reglas = reglasDe(db, campana);
  if (!reglas.length) return null;
  const f = db.prepare(
    "SELECT connId, fecha, hora, agente, skill, q1, q2, q3, q4, telefono FROM encuestas WHERE campana = ? AND connId = ? AND connId <> '' ORDER BY fecha, id LIMIT 1"
  ).get(campana, connId);
  if (!f) return null;
  const fallas = fallasDeFila(f, reglas);
  return fallas.length ? Object.assign(f, { fallas }) : null;
}

function monitoreoDeLlamada(db, campana, connId) {
  return db.prepare('SELECT * FROM monitoreos WHERE campana = ? AND encuestaConnId = ?').get(campana, connId) || null;
}

// Toma (o renueva) el bloqueo. { ok, bloqueo, llamada } o { status, error, bloqueadoPor }.
function bloquear(db, { campana, connId, actor }) {
  return db.transaction(() => {
    const llamada = llamadaMalCalificada(db, campana, connId);
    if (!llamada) return { status: 404, error: 'Esa llamada no está entre las encuestas mal calificadas' };
    if (monitoreoDeLlamada(db, campana, connId)) return { status: 409, error: 'Esa llamada ya fue calificada', resuelta: true };
    const ahora = Date.now();
    const b = bloqueoVigente(db, campana, connId, ahora);
    if (b && !esDelActor(b, actor)) return { status: 409, error: 'La está calificando otra persona', bloqueadoPor: b.nombre };
    const expira = ahora + BLOQUEO_MS;
    db.prepare(
      `INSERT INTO encuesta_monitoreo_bloqueos (campana, connId, userId, nombre, expira) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (campana, connId) DO UPDATE SET userId = excluded.userId, nombre = excluded.nombre, expira = excluded.expira`
    ).run(campana, connId, actor.isMasterAdmin ? null : actor.id, actor.nombre || '-', expira);
    return { ok: true, bloqueo: { nombre: actor.nombre || '-', propio: true, expira: new Date(expira).toISOString() }, llamada, renovarMs: RENOVAR_MS };
  })();
}

// Libera el bloqueo propio (cancelar). Uno ajeno no se toca.
function liberar(db, { campana, connId, actor }) {
  const b = db.prepare('SELECT userId, nombre, expira FROM encuesta_monitoreo_bloqueos WHERE campana = ? AND connId = ?').get(campana, connId);
  if (!b) return { ok: true, liberado: false };
  if (!esDelActor(b, actor) && b.expira > Date.now()) return { status: 409, error: 'El bloqueo es de otra persona', bloqueadoPor: b.nombre };
  db.prepare('DELETE FROM encuesta_monitoreo_bloqueos WHERE campana = ? AND connId = ?').run(campana, connId);
  return { ok: true, liberado: true };
}

// Antes de guardar un monitoreo con encuestaConnId: null si se puede, o { status, error }.
function validarParaGuardar(db, { campana, connId, actor }) {
  if (!campanaTieneReglas(db, campana)) return { status: 400, error: 'Esta campaña no tiene Calidad de encuestas' };
  if (!llamadaMalCalificada(db, campana, connId)) return { status: 400, error: 'Esa llamada no está entre las encuestas mal calificadas' };
  if (monitoreoDeLlamada(db, campana, connId)) return { status: 409, error: 'Esa llamada ya fue calificada' };
  const b = bloqueoVigente(db, campana, connId, Date.now());
  if (b && !esDelActor(b, actor)) return { status: 409, error: 'La está calificando otra persona', bloqueadoPor: b.nombre };
  return null;
}

// Fase 344: telefono (ANI) de la encuesta de esa llamada ('' si no tiene). Para guardarlo
// con el monitoreo cuando el formulario no lo trae.
function telefonoDeLlamada(db, campana, connId) {
  const f = db.prepare("SELECT telefono FROM encuestas WHERE campana = ? AND connId = ? AND connId <> '' AND telefono <> '' ORDER BY fecha, id LIMIT 1").get(campana, connId);
  return f ? f.telefono : '';
}

// Fase 344: que le haria a Calidad de encuestas volver a subir una base (sin escribir).
// La carga reemplaza campaña + desde..hasta; los monitoreos se enlazan por CONN_ID (texto),
// asi que un monitoreo solo pierde su llamada si ese CONN_ID ya no viene en el archivo.
// filasNuevas: objetos { fecha, connId, q1..q4, telefono }. null si la campaña no tiene reglas.
function impactoRecarga(db, { campana, desde, hasta, filasNuevas }) {
  const reglas = reglasDe(db, campana);
  if (!reglas.length) return null;
  const fallan = (f) => !!f.connId && fallasDeFila(f, reglas).length > 0;
  const todas = db.prepare('SELECT fecha, connId, q1, q2, q3, q4 FROM encuestas WHERE campana = ?').all(campana);
  const antes = new Set(todas.filter(fallan).map((f) => f.connId));
  const despues = new Set(todas.filter((f) => (f.fecha < desde || f.fecha > hasta) && fallan(f)).map((f) => f.connId));
  filasNuevas.filter(fallan).forEach((f) => despues.add(f.connId));
  const mon = new Set(db.prepare('SELECT encuestaConnId FROM monitoreos WHERE campana = ? AND encuestaConnId IS NOT NULL').all(campana).map((m) => m.encuestaConnId));
  const cuenta = (set, conMon) => [...set].filter((c) => mon.has(c) === conMon).length;
  return {
    pendientesAntes: cuenta(antes, false),
    pendientesDespues: cuenta(despues, false),
    resueltasAntes: cuenta(antes, true),
    resueltasDespues: cuenta(despues, true),
    // Monitoreos que hoy tienen su llamada y despues de la carga no la tendrian (deberia ser 0).
    monitoreosSinLlamada: [...antes].filter((c) => mon.has(c) && !despues.has(c)).length,
    conTelefono: filasNuevas.filter((f) => !!f.telefono).length,
  };
}

function borrarBloqueo(db, campana, connId) {
  db.prepare('DELETE FROM encuesta_monitoreo_bloqueos WHERE campana = ? AND connId = ?').run(campana, connId);
}

module.exports = {
  BLOQUEO_MS,
  RENOVAR_MS,
  PREGUNTAS,
  reglasDe,
  campanaTieneReglas,
  fallasDeFila,
  listar,
  contarPendientes,
  llamadaMalCalificada,
  bloquear,
  liberar,
  validarParaGuardar,
  borrarBloqueo,
  telefonoDeLlamada,
  impactoRecarga,
};
