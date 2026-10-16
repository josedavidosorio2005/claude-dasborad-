// routes/centro-cargas.js — Fase 153 (P2, MAQUETA): Centro de cargas.
// SOLO LECTURA: resumen por mes de cada modulo de un cliente y descarga de
// las plantillas oficiales (lista cerrada). Quien puede: quien carga datos
// (canLoadData) Y tiene acceso a ese cliente (campaignAccess); el admin
// completo siempre.
'use strict';
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, canLoadData, campaignAccess } = require('../auth');
const { wrap } = require('./shared');
const { CATALOGO } = require('../plantillas-cliente');
const { resumenCliente, PLANTILLAS_DESCARGABLES } = require('../centro-cargas');

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
