// routes/centro-cargas.js — Fase 153: Centro de cargas.
// Lectura: resumen por mes de cada modulo de un cliente, filas de un mes y
// las plantillas oficiales (lista cerrada). Quien puede: quien carga datos
// (canLoadData) Y tiene acceso a ese cliente (campaignAccess); el admin
// completo siempre.
'use strict';
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, canLoadData, campaignAccess } = require('../auth');
const { wrap, logEvent, actorLabel } = require('./shared');
const versiones = require('../cargas-versiones');
const { recalcularResumenOrlantDesdeTrafico } = require('../resumen-orlant-trafico');
const { CATALOGO } = require('../plantillas-cliente');
const { resumenCliente, PLANTILLAS_DESCARGABLES, cargaPorId, datosDelMes } = require('../centro-cargas');

const router = express.Router();

router.get(
  '/centro-cargas/:cliente',
  requireActor,
  wrap((req, res) => {
    const cliente = req.params.cliente;
    if (!canLoadData(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    const anioActual = new Date().getFullYear();
    const anio = /^\d{4}$/.test(String(req.query.anio || '')) ? Number(req.query.anio) : anioActual;
    if (anio < 2020 || anio > anioActual + 1) return res.status(400).json({ error: 'Año fuera de rango' });
    const modulos = resumenCliente(db, cliente, anio, CATALOGO);
    if (!modulos) return res.status(404).json({ error: 'Ese cliente no está en el registro' });
    res.json({ cliente, anio, modulos });
  })
);

// "Descargar lo cargado" de un mes: las filas tal como estan en la base.
router.get(
  '/centro-cargas/:cliente/:carga/:mes/datos',
  requireActor,
  wrap((req, res) => {
    const { cliente, mes } = req.params;
    if (!canLoadData(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ error: 'Mes inválido' });
    const carga = cargaPorId(req.params.carga);
    if (!carga) return res.status(404).json({ error: 'Carga desconocida' });
    const datos = datosDelMes(db, cliente, carga, mes);
    if (!datos) return res.status(404).json({ error: 'Esta carga se descarga desde su propio módulo' });
    res.json({ cliente, carga: carga.id, mes, columnas: datos.columnas, filas: datos.filas });
  })
);

// Versiones guardadas (Deshacer, 30 dias) de un cliente; opcionalmente de
// una carga y un mes. Sin las filas.
router.get(
  '/centro-cargas/:cliente/versiones',
  requireActor,
  wrap((req, res) => {
    const cliente = req.params.cliente;
    if (!canLoadData(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    const mes = req.query.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes) ? req.query.mes : undefined;
    const carga = req.query.carga && cargaPorId(String(req.query.carga)) ? String(req.query.carga) : undefined;
    res.json({ cliente, versiones: versiones.listar(db, cliente, { carga, mes }) });
  })
);

// Deshacer: el mes vuelve a como estaba en esa version (lo que hay ahora
// tambien queda guardado). Queda en el Historial.
router.post(
  '/centro-cargas/versiones/:id/deshacer',
  requireActor,
  wrap((req, res) => {
    const id = Number(req.params.id);
    const v = Number.isInteger(id) && id > 0 ? versiones.obtener(db, id) : null;
    if (!v) return res.status(404).json({ error: 'Esa versión no existe (o ya venció)' });
    if (!canLoadData(req.actor) || !campaignAccess(req.actor, v.campana)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    let r;
    try {
      r = versiones.deshacer(db, id, { actorNombre: actorLabel(req.actor) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
    // ORLANT: su "resumen" manual sigue a Trafico (como al cargar).
    if (v.campana === 'ORLANT' && (v.carga === 'flujo_llamadas' || v.carga === 'flujo_whatsapp')) {
      recalcularResumenOrlantDesdeTrafico(db, v.mes);
    }
    const carga = cargaPorId(v.carga);
    logEvent('CENTRO_CARGAS_DESHACER', { nombre: v.campana, user: '-', rol: 'carga' }, actorLabel(req.actor),
      `Deshizo ${carga ? carga.nombre : v.carga} de ${v.mes}: volvieron ${r.restauradas} registros (se reemplazaron ${r.reemplazadas}, que quedan guardados 30 días)`);
    res.json(r);
  })
);

router.get(
  '/centro-cargas-plantillas/:archivo',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Sin permiso para cargar datos' });
    const archivo = PLANTILLAS_DESCARGABLES.find((p) => p === req.params.archivo);
    if (!archivo) return res.status(404).json({ error: 'Plantilla desconocida' });
    res.download(path.join(__dirname, '..', 'plantillas', archivo), archivo);
  })
);

module.exports = router;
