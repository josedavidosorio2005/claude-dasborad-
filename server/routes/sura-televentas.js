// routes/sura-televentas.js — Fase 215: tablero "Televentas" de SURA
// (ver sura-televentas.js). Leer: quien tenga acceso al cliente. Montar,
// reemplazar, eliminar y cambiar metas/codigos/asesores: el administrador y,
// desde la Fase 299, el SUPERVISOR con acceso a ese cliente (403 para el resto,
// aunque el navegador ya esconde esos botones). Descargar el Excel ORIGINAL
// (trae las cedulas reales) sigue siendo solo del administrador: el supervisor
// lee las bases con las cedulas seudonimizadas, como cualquier no-admin.
'use strict';
const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireActor, campaignAccess, isFullAdmin, supervisorPuedeCargarEn } = require('../auth');
const sura = require('../sura-televentas');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const BASE = '/sura-televentas/:cliente';
const NOMBRE_TIPO = { ventas: 'base de ventas', inicial: 'base inicial', estrategias: 'base de estrategias' };

// Cliente con el tablero + acceso de quien pregunta. Deja req.sura listo.
// nivel: 'leer' (quien tenga acceso), 'cargar' (admin o supervisor de ese
// cliente, Fase 299) o 'admin' (solo el administrador).
function conAcceso(nivel) {
  return function suraAcceso(req, res, next) {
    const cliente = req.params.cliente;
    if (!sura.esClienteTeleventas(db, cliente)) return res.status(404).json({ error: 'Ese cliente no tiene el tablero de Televentas' });
    if (!campaignAccess(req.actor, cliente)) return res.status(403).json({ error: 'Sin acceso a este dashboard' });
    const esAdmin = isFullAdmin(req.actor);
    const puedeCargar = esAdmin || supervisorPuedeCargarEn(req.actor, cliente);
    if (nivel === 'admin' && !esAdmin) return res.status(403).json({ error: 'Solo el administrador puede descargar el archivo original' });
    if (nivel === 'cargar' && !puedeCargar) return res.status(403).json({ error: 'Solo el administrador o un supervisor de este cliente puede cambiar las bases y la configuracion de este tablero' });
    req.sura = { cliente, esAdmin, puedeCargar };
    next();
  };
}

function tipoYMes(req, res) {
  const { tipo, mes } = req.params;
  if (!sura.TIPOS.includes(tipo) || !sura.RE_MES.test(mes)) {
    res.status(400).json({ error: 'Tipo de base o mes invalido' });
    return null;
  }
  return { tipo, mes };
}

router.get(BASE + '/resumen', requireActor, conAcceso('leer'), wrap((req, res) => {
  const { cliente, esAdmin, puedeCargar } = req.sura;
  res.set('Cache-Control', 'private, no-cache');
  res.json({
    cliente,
    puedeEditar: puedeCargar, // Fase 299: admin o supervisor de este cliente
    puedeDescargar: esAdmin, // el Excel original (cedulas reales): solo el administrador
    pestanas: sura.pestanasPara(puedeCargar),
    bases: sura.listarBases(db, cliente),
    config: sura.leerConfig(db, cliente),
  });
}));

router.get(BASE + '/bases/:tipo/:mes', requireActor, conAcceso('leer'), wrap((req, res) => {
  const tm = tipoYMes(req, res);
  if (!tm) return;
  const seudonimo = req.sura.esAdmin ? null : sura.crearSeudonimo(config.jwtSecret);
  const datos = sura.leerBase(db, { cliente: req.sura.cliente, ...tm, seudonimo });
  if (!datos) return res.status(404).json({ error: 'No hay base cargada para ese mes' });
  res.set('Cache-Control', 'private, no-cache');
  res.json(datos);
}));

router.get(BASE + '/bases/:tipo/:mes/archivo', requireActor, conAcceso('admin'), wrap((req, res) => {
  const tm = tipoYMes(req, res);
  if (!tm) return;
  const a = sura.leerArchivo(db, { cliente: req.sura.cliente, ...tm });
  if (!a) return res.status(404).json({ error: 'No hay archivo original guardado para ese mes' });
  res.set('Cache-Control', 'no-store');
  res.attachment(a.archivoNombre);
  res.type('application/octet-stream');
  res.send(a.archivo);
}));

router.post(BASE + '/bases/:tipo/:mes', requireActor, conAcceso('cargar'), wrap((req, res) => {
  const tm = tipoYMes(req, res);
  if (!tm) return;
  const v = sura.validarCarga(tm.tipo, tm.mes, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = sura.guardarBase(db, {
    cliente: req.sura.cliente, ...tm, archivoNombre: v.archivoNombre, datos: v.datos, archivo: v.archivo,
    actorNombre: req.actor.nombre || '-',
  });
  logEvent('SURA_BASE_CARGADA', { nombre: `${r.registros} registro(s)`, user: '-', rol: req.sura.cliente }, actorLabel(req.actor),
    `${NOMBRE_TIPO[tm.tipo]} de ${tm.mes}`);
  res.status(201).json(r);
}));

router.delete(BASE + '/bases/:tipo/:mes', requireActor, conAcceso('cargar'), wrap((req, res) => {
  const tm = tipoYMes(req, res);
  if (!tm) return;
  if (!sura.eliminarBase(db, { cliente: req.sura.cliente, ...tm, actorNombre: req.actor.nombre || '-' })) {
    return res.status(404).json({ error: 'No hay base cargada para ese mes' });
  }
  logEvent('SURA_BASE_ELIMINADA', { nombre: '-', user: '-', rol: req.sura.cliente }, actorLabel(req.actor), `${NOMBRE_TIPO[tm.tipo]} de ${tm.mes}`);
  res.json({ ok: true });
}));

router.put(BASE + '/config/:clave', requireActor, conAcceso('cargar'), wrap((req, res) => {
  const clave = req.params.clave;
  const valor = req.body ? req.body.valor : undefined;
  const err = valor === undefined ? 'Falta el valor' : sura.validarConfig(clave, valor);
  if (err) return res.status(400).json({ error: err });
  sura.guardarConfig(db, { cliente: req.sura.cliente, clave, valor, actorNombre: req.actor.nombre || '-' });
  // Fase 299: queda en el Historial quien cambio metas/codigos (ademas de
  // actualizadoPorNombre/actualizadoEn en sura_config). Solo la clave, nunca el valor.
  logEvent('SURA_CONFIG_CAMBIADA', { nombre: '-', user: '-', rol: req.sura.cliente }, actorLabel(req.actor), 'clave ' + clave);
  res.json({ ok: true });
}));

module.exports = router;
