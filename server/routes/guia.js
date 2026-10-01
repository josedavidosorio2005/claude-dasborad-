// routes/guia.js — Fase 102 (auditoria de seguridad, hallazgo real): la
// guia de uso (public/guia-uso.html) se servia por express.static SIN
// autenticacion -- cualquiera con la URL veia el nombre del cliente y la
// estructura exacta (archivo/hoja/columnas obligatorias) de cada base que
// carga ORLANT, sin iniciar sesion. Ahora la pagina vive FUERA de public/
// (server/paginas/guia-uso.html, nunca servida por express.static) y solo
// se entrega por esta ruta autenticada -- el frontend la pide con
// apiRequest (que ya manda el Bearer token en memoria) y la abre en una
// pestaña nueva (ver abrirGuiaUso() en public/js/ui-core.js).
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireActor } = require('../auth');
const { wrap } = require('./shared');

const router = express.Router();
const RUTA_GUIA = path.join(__dirname, '..', 'paginas', 'guia-uso.html');

router.get(
  '/guia-uso',
  requireActor,
  wrap((req, res) => {
    res.type('html').send(fs.readFileSync(RUTA_GUIA, 'utf8'));
  })
);

module.exports = router;
