// routes/centro-cargas.js — Fase 153: Centro de cargas.
// Resumen por mes de cada modulo de un cliente, filas de un mes, versiones,
// Deshacer y Eliminar un mes (PR 2 y 3), y
// las plantillas oficiales (lista cerrada). Quien puede: quien carga datos
// (canLoadData, o en CALIDAD su permiso cargar_<modulo>: canLoadModule)
// Y tiene acceso a ese cliente (campaignAccess); el admin
// completo siempre.
'use strict';
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, canLoadModule, canLoadAnyModule, campaignAccess } = require('../auth');
const { wrap, logEvent, actorLabel } = require('./shared');
const versiones = require('../cargas-versiones');
const clientesRegistro = require('../clientes-registro');
const { CATALOGO } = require('../plantillas-cliente');
const { resumenCliente, PLANTILLAS_DESCARGABLES, CARGAS_POR_MODULO, cargaPorId, datosDelMes, conteoRango } = require('../centro-cargas');

const router = express.Router();

router.get(
  '/centro-cargas/:cliente',
  requireActor,
  wrap((req, res) => {
    const cliente = req.params.cliente;
    if (!canLoadAnyModule(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    const anioActual = new Date().getFullYear();
    const anio = /^\d{4}$/.test(String(req.query.anio || '')) ? Number(req.query.anio) : anioActual;
    if (anio < 2020 || anio > anioActual + 1) return res.status(400).json({ error: 'Año fuera de rango' });
    const modulos = resumenCliente(db, cliente, anio, CATALOGO);
    if (!modulos) return res.status(404).json({ error: 'Ese cliente no está en el registro' });
    // PR 5: CALIDAD ve solo los modulos con su cargar_<modulo>.
    res.json({ cliente, anio, modulos: modulos.filter((m) => canLoadModule(req.actor, m.id)) });
  })
);

// "Descargar lo cargado" de un mes: las filas tal como estan en la base.
router.get(
  '/centro-cargas/:cliente/:carga/:mes/datos',
  requireActor,
  wrap((req, res) => {
    const { cliente, mes } = req.params;
    if (!canLoadAnyModule(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ error: 'Mes inválido' });
    const carga = cargaPorId(req.params.carga);
    if (!carga) return res.status(404).json({ error: 'Carga desconocida' });
    if (!canLoadModule(req.actor, carga.modulo)) return res.status(403).json({ error: 'Sin permiso para cargar este módulo' });
    const datos = datosDelMes(db, cliente, carga, mes);
    if (!datos) return res.status(404).json({ error: 'Esta carga se descarga desde su propio módulo' });
    res.json({ cliente, carga: carga.id, mes, columnas: datos.columnas, filas: datos.filas });
  })
);

// Vista previa del Centro (reemplazo parcial): registros del mes y cuantos
// caen entre desde/hasta (las fechas que trae el archivo). Solo lectura.
router.get(
  '/centro-cargas/:cliente/:carga/:mes/conteo',
  requireActor,
  wrap((req, res) => {
    const { cliente, mes } = req.params;
    if (!canLoadAnyModule(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ error: 'Mes inválido' });
    // Dia, o dia con hora (Agendas reemplaza por FECHA_SOLICITUD con hora).
    const dia = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
    const { desde, hasta } = req.query;
    if (!dia.test(String(desde || '')) || !dia.test(String(hasta || '')) || desde > hasta) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }
    const carga = cargaPorId(req.params.carga);
    if (!carga) return res.status(404).json({ error: 'Carga desconocida' });
    if (!canLoadModule(req.actor, carga.modulo)) return res.status(403).json({ error: 'Sin permiso para cargar este módulo' });
    res.json(Object.assign({ cliente, carga: carga.id, mes, desde, hasta }, conteoRango(db, cliente, carga, mes, desde, hasta)));
  })
);

// Versiones guardadas (Deshacer, 30 dias) de un cliente; opcionalmente de
// una carga y un mes. Sin las filas.
router.get(
  '/centro-cargas/:cliente/versiones',
  requireActor,
  wrap((req, res) => {
    const cliente = req.params.cliente;
    if (!canLoadAnyModule(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    const mes = req.query.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes) ? req.query.mes : undefined;
    const carga = req.query.carga && cargaPorId(String(req.query.carga)) ? String(req.query.carga) : undefined;
    const deSusModulos = (v) => { const c = cargaPorId(v.carga); return !!c && canLoadModule(req.actor, c.modulo); };
    res.json({ cliente, versiones: versiones.listar(db, cliente, { carga, mes }).filter(deSusModulos) });
  })
);

// Deshacer: el mes vuelve a como estaba en esa version (lo que hay ahora
// tambien queda guardado). Queda en el Historial.
router.post(
  '/centro-cargas/versiones/:id/deshacer',
  requireActor,
  wrap((req, res) => {
    if (!canLoadAnyModule(req.actor)) return res.status(403).json({ error: 'Sin permiso para cargar datos' });
    const id = Number(req.params.id);
    const v = Number.isInteger(id) && id > 0 ? versiones.obtener(db, id) : null;
    // Fase 157 (S-06): la version de un cliente o modulo ajeno responde lo
    // mismo que una que no existe (si no, se podia saber que ids existen).
    const cargaV = v && cargaPorId(v.carga);
    if (!v || !campaignAccess(req.actor, v.campana) || !cargaV || !canLoadModule(req.actor, cargaV.modulo)) {
      return res.status(404).json({ error: 'Esa versión no existe (o ya venció)' });
    }
    let r;
    try {
      r = versiones.deshacer(db, id, { actorNombre: actorLabel(req.actor) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
    // Agregado mensual de Flujo de Llamadas y "resumen" de ORLANT: ya los
    // recalculo deshacer() en su transaccion (recalcularDerivados).
    const carga = cargaPorId(v.carga);
    logEvent('CENTRO_CARGAS_DESHACER', { nombre: v.campana, user: '-', rol: 'carga' }, actorLabel(req.actor),
      `Deshizo ${carga ? carga.nombre : v.carga} de ${v.mes}: volvieron ${r.restauradas} registros (se reemplazaron ${r.reemplazadas}, que quedan guardados 30 días)`);
    res.json(r);
  })
);

const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Eliminar un mes (PR 3): la base de ese mes se guarda 30 dias (Deshacer) y
// se borra; los demas meses no se tocan. Queda en el Historial.
router.delete(
  '/centro-cargas/:cliente/:carga/:mes',
  requireActor,
  wrap((req, res) => {
    const { cliente, mes } = req.params;
    if (!canLoadAnyModule(req.actor) || !campaignAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de este cliente' });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ error: 'Mes inválido' });
    const carga = cargaPorId(req.params.carga);
    if (!carga) return res.status(404).json({ error: 'Carga desconocida' });
    if (!canLoadModule(req.actor, carga.modulo)) return res.status(403).json({ error: 'Sin permiso para cargar este módulo' });
    // Solo un modulo que el cliente tiene en el registro.
    const reg = clientesRegistro.leerRegistro(db).find((c) => c.nombre === cliente);
    if (!reg || !reg.modulos.includes(carga.modulo)) return res.status(404).json({ error: 'Ese cliente no tiene este módulo' });
    let r;
    try {
      r = versiones.eliminarMes(db, carga, cliente, mes, { actorNombre: actorLabel(req.actor) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
    const nombreMes = NOMBRE_MES[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4);
    logEvent('CENTRO_CARGAS_ELIMINAR', { nombre: cliente, user: '-', rol: 'carga' }, actorLabel(req.actor),
      `Eliminó la base de ${nombreMes} de ${carga.nombre} (${cliente}): ${r.eliminadas} registros (se guarda 30 días para Deshacer)`);
    res.json(r);
  })
);

router.get(
  '/centro-cargas-plantillas/:archivo',
  requireActor,
  wrap((req, res) => {
    if (!canLoadAnyModule(req.actor)) return res.status(403).json({ error: 'Sin permiso para cargar datos' });
    const archivo = PLANTILLAS_DESCARGABLES.find((p) => p === req.params.archivo);
    if (!archivo) return res.status(404).json({ error: 'Plantilla desconocida' });
    // PR 5: la plantilla de un modulo, solo si puede cargar ese modulo.
    const deCarga = Object.values(CARGAS_POR_MODULO).flat().find((c) => c.plantilla === archivo);
    if (!deCarga || !canLoadModule(req.actor, cargaPorId(deCarga.id).modulo)) return res.status(403).json({ error: 'Sin permiso para cargar este módulo' });
    res.download(path.join(__dirname, '..', 'plantillas', archivo), archivo);
  })
);

module.exports = router;
