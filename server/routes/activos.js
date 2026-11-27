// routes/activos.js — Fase 369 (E1): «Inventario de sistemas». Solo ADMIN y SISTEMAS. Cada cambio
// queda en el historial del elemento y en el Historial general (sin datos personales). Sin caché.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const A = require('../activos');
const F = require('../activos-formularios'); // Fase 372 (E4)
const NGH = require('../gh-novedades'); // Fase GH4
const { wrap, actorLabel, logEvent } = require('./shared');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();
router.use('/activos', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function permitido(req, res) {
  if (!A.puede(req.actor)) { res.status(403).json({ error: 'Solo Sistemas o el administrador' }); return false; }
  return true;
}
const idValido = (v) => /^[1-9]\d{0,9}$/.test(String(v));
const log = (accion, a, req, detalle) => logEvent(accion, { nombre: a ? a.tipo + ' ' + a.codigo : '-', user: '-', rol: 'activos' }, actorLabel(req.actor), detalle || '');

// Fase INV2: cuántos elementos tiene cada tipo (con elementos, «Se asigna a agentes» ya no se cambia).
function conElementos(tipos) {
  const n = new Map(db.prepare('SELECT tipo, COUNT(*) n FROM activos GROUP BY tipo').all().map((r) => [r.tipo, r.n]));
  return tipos.map((t) => Object.assign({}, t, { elementos: n.get(t.codigo) || 0 }));
}
router.get('/activos/config', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const ambito = A.ambitoDe(req.query.ambito); // Fase 376: sistemas (por defecto) o inmuebles
  res.json({ ambito, estados: A.ESTADOS, rendimientos: A.RENDIMIENTOS, /* Fase 377 */ tipos: A.tipos(db, { ambito }), listas: Object.fromEntries(Object.keys(A.LISTAS).map((k) => [k, A.lista(db, k)])),
    // Fase 372 (E4): para Ajustes › Formularios (todos los tipos, también los desactivados) y los textos del acta.
    tiposTodos: conElementos(A.tipos(db, { todos: true, ambito })), textos: F.textos(db), textosNombres: Object.fromEntries(Object.entries(F.TEXTOS).map(([k, t]) => [k, t.nombre])) });
}));

// ── Pedido de Edwin (25/11/2026): nombre desde Talento humano al escribir la cédula de un agente nuevo ──
// Solo ADMIN y SISTEMAS (los que ya ven el Inventario). Coincidencia exacta; devuelve solo el nombre. La cédula va
// en el cuerpo (nunca en la URL, que es lo único que registra el log de accesos), no se escribe en el Historial ni
// en los errores, y la búsqueda tiene su propio límite bajo, por usuario, para que no sirva para averiguar nombres.
const GH_NOMBRE_VENTANA_MS = 10 * 60 * 1000;
const GH_NOMBRE_MAX = 20;
const ghNombreLimite = rateLimit({
  windowMs: GH_NOMBRE_VENTANA_MS,
  max: GH_NOMBRE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => 'gh-nombre:' + String(req.actor && (req.actor.id != null ? req.actor.id : req.actor.user)),
  message: { error: 'Demasiadas búsquedas de cédula. Espera unos minutos.' },
});
router.post('/activos/gh-nombre', requireActor, (req, res, next) => (permitido(req, res) ? next() : undefined), ghNombreLimite, wrap((req, res) => {
  const d = typeof (req.body || {}).documento === 'string' ? req.body.documento.trim() : '';
  if (!/^[A-Za-z0-9.\- ]{3,20}$/.test(d)) return res.status(400).json({ error: 'Documento inválido' });
  const nombre = NGH.nombrePorDocumento(db, d);
  res.json(nombre ? { encontrado: true, nombre } : { encontrado: false });
}));

// ── Fase 372 (E4): formularios editables (tipos y sus campos) y textos del acta. Historial sin datos personales.
const logTipo = (accion, t, req, detalle) => logEvent(accion, { nombre: t.nombre + ' (' + t.codigo + ')', user: '-', rol: 'activos' }, actorLabel(req.actor), detalle || '');
const resumenCampos = (t) => t.campos.length + ' campo(s)' + (t.campos.some((c) => c.oculto) ? ', ' + t.campos.filter((c) => c.oculto).length + ' oculto(s)' : '');
router.post('/activos/config/tipos', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = F.crearTipo(db, req.body, A.ambitoDe(req.query.ambito)); // Fase 376: el tipo nuevo es del inventario abierto
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logTipo('ACTIVO_TIPO_CREADO', r.tipo, req, resumenCampos(r.tipo));
  res.status(201).json(r);
}));
router.put('/activos/config/tipos/:codigo', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = F.editarTipo(db, String(req.params.codigo || ''), req.body);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logTipo('ACTIVO_TIPO_EDITADO', r.tipo, req, resumenCampos(r.tipo) + (r.antes.nombre !== r.tipo.nombre ? ' · antes: ' + r.antes.nombre : ''));
  res.json({ tipo: r.tipo });
}));
router.put('/activos/config/tipos/:codigo/activo', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const b = req.body || {};
  if (Object.keys(b).some((k) => k !== 'activo')) return res.status(400).json({ error: 'Datos no válidos' });
  const r = F.activarTipo(db, String(req.params.codigo || ''), b.activo);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  if (!r.sinCambio) logTipo('ACTIVO_TIPO_ACTIVO', r.tipo, req, r.tipo.activo ? 'activado' : 'desactivado');
  res.json({ tipo: r.tipo });
}));
router.put('/activos/config/textos/:clave', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const b = req.body || {};
  if (Object.keys(b).some((k) => k !== 'valor')) return res.status(400).json({ error: 'Datos no válidos' });
  const r = F.guardarTexto(db, String(req.params.clave || ''), b.valor, actorLabel(req.actor));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logEvent('ACTIVO_TEXTO', { nombre: F.TEXTOS[r.clave].nombre, user: '-', rol: 'activos' }, actorLabel(req.actor), r.valor.length + ' caracteres');
  res.json(r);
}));
// Fase GH5: «Panel general» igual al diseño de Edwin (tarjetas y gráficas); ?tipo= para los chips «Ver gráficas de».
router.get('/activos/panel', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json(require('../activos-panel').panel(db, req.query.ambito, String(req.query.tipo || '')));
}));
router.get('/activos/resumen', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = A.resumen(db, req.query.ambito);
  if (A.ambitoDe(req.query.ambito) === 'sistemas') {
    const ra = ACT.resumen(db); r.actasPorFirmar = ra.pendientes + ra.porCompletar; // Fase 379: conteo del menú (INV4: por completar o firmar, como Edwin)
    const N = NGH.novedades(db); // Fase GH4: retirados y ausentes hoy con equipos (conteo del menú)
    r.novedadesGH = { retirados: N.retirados.length, ausentes: N.ausentes.length };
  }
  res.json(r);
}));
// Fase GH4: «Novedades desde Gestión Humana» (solo lectura de Talento humano; lo mínimo, sin datos de salud).
router.get('/activos/novedades-gh', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json(NGH.novedades(db));
}));
router.get('/activos', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = {};
  for (const k of ['tipo', 'estado', 'sede', 'q', 'ambito', 'operacion']) if (typeof req.query[k] === 'string' && req.query[k].trim()) q[k] = req.query[k].trim(); // Fase 376: + ámbito y operación
  for (const k of ['proveedor', 'rend']) if (typeof req.query[k] === 'string' && req.query[k].trim()) q[k] = req.query[k].trim().slice(0, 120); // Fase 377
  for (const k of ['pend', 'dup']) if (req.query[k] === '1') q[k] = true;
  res.json({ activos: A.listar(db, q) });
}));
router.post('/activos', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const v = A.validar(db, req.body, { nuevo: true, completo: true }); // Fase INV2: todos los campos obligatorios
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.crear(db, v.valores, actorLabel(req.actor));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  log('ACTIVO_INGRESO', r.activo, req, 'estado ' + r.activo.estado);
  const ipRep = A.ipRepetida(db, r.activo.datos.ip, r.activo.id); // Fase 380: aviso, no error
  if (ipRep) r.aviso = 'La IP ' + r.activo.datos.ip + ' ya está registrada en el equipo ' + ipRep.codigo;
  res.status(201).json(r);
}));
router.put('/activos/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  const b = req.body || {};
  if ('tipo' in b || 'codigo' in b || 'estado' in b) return res.status(400).json({ error: 'El tipo, el código y el estado no se editan aquí' });
  const v = A.validar(db, b, { nuevo: false, tipo: a.tipo, completo: true });
  if (v.error) return res.status(400).json({ error: v.error });
  const n = A.editar(db, a, v.valores, actorLabel(req.actor));
  log('ACTIVO_EDICION', n, req);
  const ipRep = A.ipRepetida(db, n.datos.ip, n.id); // Fase 380
  res.json(ipRep ? { activo: n, aviso: 'La IP ' + n.datos.ip + ' ya está registrada en el equipo ' + ipRep.codigo } : { activo: n });
}));
router.post('/activos/:id/estado', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  const b = req.body || {};
  let r; const actas = [];
  db.transaction(() => {
    r = A.cambiarEstado(db, a, b.estado, b.motivo, actorLabel(req.actor), b.tecnico); // Fase 378: + técnico; también si está asignado
    if (r.error) return;
    // Fase 379 (I4): acta automática del cambio (reparación, malo, baja, recibo de reparación o devolución).
    let tipo = ACT.tipoPorEstado(a.estado, r.activo.estado);
    if (tipo === 'devolucion' && !a.agente) tipo = null; // Fase 380: un administrable «en uso» no tiene agente
    if (tipo && ACT.llevaActa(db, a)) actas.push(ACT.auto(db, { tipo, agente: a.agente ? A.agente(db, a.agente.id) : null, items: [{ a, dir: a.agente ? 'devuelve' : '', queda: r.activo.estado }],
      motivo: b.motivo, tecnico: r.activo.estado === 'en_reparacion' ? b.tecnico : '', quien: actorLabel(req.actor) }));
  })();
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_ESTADO', r.activo, req, a.estado + ' → ' + r.activo.estado);
  res.json(Object.assign(r, { actas }));
}));
// Fase 381 (I6): historial general (todos los elementos del inventario abierto).
router.get('/activos/historial', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = {};
  for (const k of ['ambito', 'desde', 'hasta', 'accion', 'q']) if (typeof req.query[k] === 'string' && req.query[k].trim()) q[k] = req.query[k].trim();
  res.json(A.historialGeneral(db, q));
}));
// Fase 381 (I6): importar elementos de un tipo desde Excel (el navegador lee el archivo y manda las filas).
// Sin «confirmar» solo revisa; con «confirmar» crea los válidos. Historial ACTIVO_IMPORTACION (solo conteos).
router.post('/activos/importar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const b = req.body || {};
  if (Object.keys(b).some((k) => !['tipo', 'filas', 'confirmar'].includes(k))) return res.status(400).json({ error: 'Datos no válidos' });
  let r;
  try { r = A.importar(db, b.tipo, b.filas, b.confirmar === true, actorLabel(req.actor)); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (r.error) return res.status(400).json({ error: r.error });
  if (r.importadas) logEvent('ACTIVO_IMPORTACION', { nombre: r.tipo, user: '-', rol: 'activos' }, actorLabel(req.actor), r.importadas + ' importado(s), ' + r.errores + ' con error');
  res.json(r);
}));
router.get('/activos/:id/historial', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  res.json({ activo: a, historial: A.historial(db, a.id) });
}));
router.put('/activos/listas/:lista', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const nombre = String(req.params.lista || '');
  if (!Object.prototype.hasOwnProperty.call(A.LISTAS, nombre)) return res.status(404).json({ error: 'Lista no encontrada' });
  const b = req.body || {};
  if (!Array.isArray(b.valores) || b.valores.length > 200 || !b.valores.every((v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 120)) return res.status(400).json({ error: 'Escribe un valor por línea (hasta 200, de 1 a 120 caracteres)' });
  const valores = [...new Set(b.valores.map((v) => v.trim()))];
  const r = A.guardarLista(db, nombre, valores);
  logEvent('ACTIVO_LISTA', { nombre: A.LISTAS[nombre], user: '-', rol: 'activos' }, actorLabel(req.actor), r.length + ' valor(es)');
  res.json({ lista: nombre, valores: r });
}));

// ── Fase 370 (E2): agentes y asignación por elemento. El Historial general solo lleva el id del
// agente (sin nombre ni documento); el historial del elemento sí dice a quién se asignó.
const logAg = (accion, g, req, detalle) => logEvent(accion, { nombre: 'agente #' + g.id, user: '-', rol: 'activos' }, actorLabel(req.actor), detalle || '');
router.get('/activos/agentes', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = { todos: req.query.todos === '1' };
  if (typeof req.query.q === 'string' && req.query.q.trim()) q.q = req.query.q.trim();
  res.json({ agentes: A.agentes(db, q) });
}));
router.post('/activos/agentes', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const v = A.validarAgente(db, req.body, true);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.crearAgente(db, v.valores);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logAg('ACTIVO_AGENTE', r.agente, req, 'creado');
  res.status(201).json(r);
}));
function agentePorId(req, res) {
  const g = idValido(req.params.id) ? A.agente(db, Number(req.params.id)) : null;
  if (!g) res.status(404).json({ error: 'Agente no encontrado' });
  return g;
}
router.get('/activos/agentes/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  res.json(A.agenteDetalle(db, g));
}));
router.put('/activos/agentes/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  const v = A.validarAgente(db, req.body, false);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.editarAgente(db, g, v.valores);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logAg('ACTIVO_AGENTE', r.agente, req, 'editado' + (v.valores.activo === 0 ? ' (inactivo)' : ''));
  res.json(r);
}));
function activoPorId(req, res) {
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) res.status(404).json({ error: 'Elemento no encontrado' });
  return a;
}
router.post('/activos/:id/asignar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  // Fase 378 (I3): también a un agente nuevo (nombre y cédula) desde el detalle del elemento; si la
  // asignación falla, el agente nuevo no queda creado.
  let r, g; const actas = [];
  try {
    db.transaction(() => {
      g = A.agenteParaAsignar(db, req.body || {});
      if (g.error) throw Object.assign(new Error(g.error), { esperado: true });
      r = A.asignar(db, a, g.agenteId, actorLabel(req.actor));
      if (r.error) throw Object.assign(new Error(r.error), { esperado: true });
      if (ACT.llevaActa(db, a)) actas.push(ACT.auto(db, { tipo: 'entrega', agente: r.agente, items: [{ a: r.activo, dir: 'recibe' }], quien: actorLabel(req.actor) })); // Fase 379
    })();
  } catch (e) { if (e.esperado) return res.status(e.message.startsWith('Ya hay') ? 409 : 400).json({ error: e.message }); throw e; }
  log('ACTIVO_ASIGNACION', r.activo, req, 'a agente #' + r.agente.id + (g.creado ? ' (nuevo)' : ''));
  res.json({ activo: r.activo, agente: r.agente, agenteCreado: !!g.creado, actas });
}));
router.post('/activos/:id/reasignar', requireActor, wrap((req, res) => { // Fase 378 (I3)
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const b = req.body || {};
  let r, g; const actas = [];
  try {
    db.transaction(() => {
      g = A.agenteParaAsignar(db, b);
      if (g.error) throw Object.assign(new Error(g.error), { esperado: true });
      r = A.reasignar(db, a, g.agenteId, b.motivo, actorLabel(req.actor));
      if (r.error) throw Object.assign(new Error(r.error), { esperado: true });
      if (ACT.llevaActa(db, a)) { // Fase 379: devolución del anterior y entrega al nuevo
        actas.push(ACT.auto(db, { tipo: 'devolucion', agente: A.agente(db, a.agente.id), items: [{ a, dir: 'devuelve' }], motivo: 'Reasignado: ' + b.motivo, quien: actorLabel(req.actor) }));
        actas.push(ACT.auto(db, { tipo: 'entrega', agente: r.agente, items: [{ a: r.activo, dir: 'recibe' }], motivo: b.motivo, quien: actorLabel(req.actor) }));
      }
    })();
  } catch (e) { if (e.esperado) return res.status(400).json({ error: e.message }); throw e; }
  log('ACTIVO_REASIGNACION', r.activo, req, 'a agente #' + r.agente.id + (g.creado ? ' (nuevo)' : ''));
  res.json({ activo: r.activo, agente: r.agente, agenteCreado: !!g.creado, actas });
}));
router.post('/activos/:id/devolver', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const b = req.body || {};
  let r; const actas = [];
  db.transaction(() => {
    r = A.devolver(db, a, b.estado, b.motivo, actorLabel(req.actor));
    if (!r.error && ACT.llevaActa(db, a)) actas.push(ACT.auto(db, { tipo: 'devolucion', agente: A.agente(db, a.agente.id), items: [{ a, dir: 'devuelve', queda: r.activo.estado }], motivo: b.motivo, quien: actorLabel(req.actor) })); // Fase 379
  })();
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_DEVOLUCION', r.activo, req, 'queda ' + r.activo.estado);
  res.json(Object.assign(r, { actas }));
}));
router.post('/activos/:id/cambiar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const b = req.body || {};
  let r; const actas = [];
  db.transaction(() => {
    r = A.cambiarElemento(db, a, b.nuevoId, b.estado, b.motivo, actorLabel(req.actor));
    if (!r.error && ACT.llevaActa(db, a)) actas.push(ACT.auto(db, { tipo: 'cambio', agente: A.agente(db, a.agente.id), // Fase 379
      items: [{ a, dir: 'devuelve', queda: r.anterior.estado }, { a: r.activo, dir: 'recibe' }], motivo: b.motivo, quien: actorLabel(req.actor) }));
  })();
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_CAMBIO', r.anterior, req, 'por ' + r.activo.codigo + '; queda ' + r.anterior.estado);
  res.json(Object.assign(r, { actas }));
}));

// ── Fase 371 (E3): actas de entrega y devolución; la firmada va a S3 privado (apagado sin ACTAS_S3_BUCKET).
const ACT = require('../activos-actas');
const s3Prueba = (req) => ({ cliente: req.app.locals.actasS3Cliente }); // solo las pruebas lo ponen
router.get('/activos/agentes/:id/actas', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  res.json({ actas: ACT.deAgente(db, g.id), entrega: ACT.candidatos(db, g, 'entrega'), devolucion: ACT.candidatos(db, g, 'devolucion'), firmadasActivas: !!ACT.bucket() });
}));
router.post('/activos/agentes/:id/actas', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  const b = req.body || {};
  const r = ACT.crear(db, g, b.tipo, b.activoIds, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  logAg('ACTIVO_ACTA', g, req, 'acta ' + r.acta.numero + ' (' + r.acta.tipo + ', ' + r.acta.elementos.length + ' elemento(s))');
  res.status(201).json(r);
}));
// Fase 379 (I4): todas las actas con filtros y su resumen; anular (nunca borrar).
router.get('/activos/actas', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = {};
  for (const k of ['estado', 'tipo', 'q']) if (typeof req.query[k] === 'string' && req.query[k].trim()) q[k] = req.query[k].trim();
  res.json({ actas: ACT.listar(db, q), resumen: ACT.resumen(db), tipos: ACT.TIPOS_TODOS, diasAtraso: ACT.DIAS_ATRASO, firmadasActivas: !!ACT.bucket() });
}));
router.post('/activos/actas/:id/anular', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = actaPorId(req, res); if (!a) return;
  const r = ACT.anular(db, a, (req.body || {}).motivo, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ACTIVO_ACTA_ANULADA', { nombre: 'acta ' + a.numero, user: '-', rol: 'activos' }, actorLabel(req.actor), a.tipo);
  res.json(r);
}));
function actaPorId(req, res) {
  const a = idValido(req.params.id) ? ACT.obtener(db, Number(req.params.id)) : null;
  if (!a) res.status(404).json({ error: 'Acta no encontrada' });
  return a;
}
router.get('/activos/actas/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = actaPorId(req, res); if (!a) return;
  res.json({ acta: a });
}));
// Fase INV4 (HTML de Edwin): completar el acta y generar su PDF para firmar (queda «por firmar»).
router.post('/activos/actas/:id/completar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = actaPorId(req, res); if (!a) return;
  const r = ACT.completar(db, a, req.body, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ACTIVO_ACTA_GENERADA', { nombre: 'acta ' + a.numero, user: '-', rol: 'activos' }, actorLabel(req.actor), a.tipo);
  res.json(r);
}));
router.post('/activos/actas/:id/firmada', requireActor, wrap(async (req, res) => {
  if (!permitido(req, res)) return;
  const a = actaPorId(req, res); if (!a) return;
  if (a.anulada) return res.status(400).json({ error: 'El acta está anulada' }); // Fase 379
  if (a.estado === 'completar') return res.status(400).json({ error: 'Primero completa el acta y genera el PDF para firmar' }); // Fase INV4
  if (!ACT.bucket()) return res.status(503).json({ error: 'Falta configurar dónde se guardan las actas firmadas (S3). Pídeselo al administrador.' });
  const p = ACT.leerPdf((req.body || {}).pdf);
  if (p.error) return res.status(400).json({ error: p.error });
  let r;
  try { r = await ACT.guardarFirmada(db, a, p.buf, actorLabel(req.actor), s3Prueba(req)); }
  catch (e) { console.error('[actas] no se pudo guardar en S3: ' + (e && e.name)); return res.status(502).json({ error: 'No se pudo guardar el acta firmada. Intenta de nuevo.' }); }
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logEvent('ACTIVO_ACTA_FIRMADA', { nombre: 'acta ' + a.numero, user: '-', rol: 'activos' }, actorLabel(req.actor), Math.round(p.buf.length / 1024) + ' KB');
  res.json(r);
}));
router.get('/activos/actas/:id/firmada', requireActor, wrap(async (req, res) => {
  if (!permitido(req, res)) return;
  const a = actaPorId(req, res); if (!a) return;
  let r;
  try { r = await ACT.leerFirmada(db, a.id, s3Prueba(req)); }
  catch (e) { console.error('[actas] no se pudo leer de S3: ' + (e && e.name)); return res.status(502).json({ error: 'No se pudo traer el acta firmada. Intenta de nuevo.' }); }
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + r.nombre + '"', 'X-Content-Type-Options': 'nosniff' });
  res.send(r.buf);
}));

module.exports = router;
