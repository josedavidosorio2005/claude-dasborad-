// routes/gh-estado.js — Fase GH2: guardado de «Talento humano» (app de Gestión humana de Edwin) en el
// servidor. Administrador completo; rol GESTION_HUMANA solo con GH_ROL_ACTIVO=1. Sin caché. La
// bitácora y los logs nunca llevan el contenido (hay cédulas, salarios y diagnósticos).
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const G = require('../gh-estado');
const GA = require('../gh-archivos');
const { wrap, actorLabel } = require('./shared');

const router = express.Router();
router.use('/gh', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function permitido(req, res) {
  if (!G.puede(req.actor)) { res.status(403).json({ error: 'Solo Gestión humana o el administrador' }); return false; }
  return true;
}

// ¿Esta persona entra a Talento humano? (la tarjeta del rol GESTION_HUMANA la pide al pintar el menú)
router.get('/gh/acceso', requireActor, wrap((req, res) => {
  res.json({ puede: G.puede(req.actor) });
}));

router.get('/gh/estado', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json({ claves: G.leerTodo(db), soportesActivos: !!GA.bucket() });
}));

router.put('/gh/estado/:clave', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = G.guardar(db, String(req.params.clave || ''), req.body, actorLabel(req.actor));
  if (r.status !== 200) return res.status(r.status).json(r.version !== undefined ? { error: r.error, version: r.version } : { error: r.error });
  res.json({ version: r.version });
}));

// ── Fase GH3: soportes adjuntos en S3 privado (apagado sin GH_SOPORTES_S3_BUCKET) ──
// El cliente S3 de pruebas lo pone solo el test (app.locals.ghS3Cliente); en producción es el real.
const s3 = (req) => ({ cliente: req.app.locals.ghS3Cliente });
const fallaS3 = (res, que, e) => { console.error('[gh] no se pudo ' + que + ' en S3: ' + (e && e.name)); res.status(502).json({ error: 'No se pudo ' + que + ' el soporte. Intenta de nuevo.' }); };

router.post('/gh/archivos', requireActor, wrap(async (req, res) => {
  if (!permitido(req, res)) return;
  let r;
  try { r = await GA.subir(db, req.body, actorLabel(req.actor), s3(req)); } catch (e) { return fallaS3(res, 'guardar', e); }
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.status(r.status).json(r.archivo);
}));

router.get('/gh/archivos/:id', requireActor, wrap(async (req, res) => {
  if (!permitido(req, res)) return;
  let r;
  try { r = await GA.leerArchivo(db, String(req.params.id || ''), s3(req)); } catch (e) { return fallaS3(res, 'traer', e); }
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r.archivo);
}));

router.delete('/gh/archivos/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = GA.borrar(db, String(req.params.id || ''), actorLabel(req.actor));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ borrado: r.borrado });
}));

// Quién guardó y cuándo (sin contenido). Solo el administrador.
router.get('/gh/bitacora', requireActor, wrap((req, res) => {
  if (!require('../auth').isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador' });
  res.json(G.bitacora(db, req.query.limite));
}));

module.exports = router;
