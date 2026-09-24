// routes/dashboards.js — Dashboards de cliente: configuracion, cargas de
// datos operativos por Excel, y el render generico (incluye a los
// adaptadores de Inventario/Gerencia/Gestion Humana). Extraido de
// server.js (Radiografia InConexion, #3): solo se movio el cableado HTTP,
// sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin, can, requireDataLoader } = require('../auth');
const { validate, schemas } = require('../validation');
const secciones = require('../dashboard-secciones');
const { ADAPTERS } = require('../dashboard-adapters');
const { recalcularResumenOrlantDesdeTrafico } = require('../resumen-orlant-trafico');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');

const router = express.Router();

router.use(['/dashboard', '/dashboards'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Fase 72 (hallazgo H1): antes esta funcion tambien daba acceso a
// canLoadData(actor) -- eso hacia que CUALQUIER usuario con el permiso
// global `cargarDatos` (p.ej. el rol REPORTES, que SIEMPRE lo tiene) pudiera
// leer el dashboard RENDERIZADO de un cliente al que nunca se le dio acceso
// (ver GET /dashboard/:cliente mas abajo), cambiando el nombre en la URL.
// `cargarDatos` sigue siendo global a proposito para SUBIR datos
// (requireDataLoader, sin tocar) y para /dashboard/cargas (pantalla interna
// de gestion de cargas, sin tocar) -- pero leer el dashboard que ve el
// cliente final debe seguir el mismo scoping por cliente/campana que todo
// lo demas.
function clienteAccess(actor, cliente) {
  if (isFullAdmin(actor)) return true;
  if (!actor || !actor.perms) return false;
  return (
    actor.perms['cliente_' + cliente] === true || actor.perms['campana_' + cliente] === true
  );
}

function toCarga(row) {
  return {
    id: row.id,
    cliente: row.cliente,
    seccion: row.seccion,
    cadencia: row.cadencia,
    periodo: row.periodo,
    filas: JSON.parse(row.filas || '[]'),
    archivoNombre: row.archivoNombre || '',
    cargadoPorNombre: row.cargadoPorNombre || '',
    cargadoEn: row.cargadoEn,
  };
}

// ── Configuracion de dashboards (Fase 3): la fuente de verdad de que
// secciones y paneles tiene cada dashboard de cliente.
function getConfigRow(cliente) {
  return db.prepare('SELECT * FROM dashboards_config WHERE cliente = ? AND activo = 1').get(cliente);
}
function toConfig(row) {
  return {
    cliente: row.cliente,
    titulo: row.titulo,
    vista: row.vista ? JSON.parse(row.vista) : null,
    secciones: JSON.parse(row.secciones || '{}'),
    layout: JSON.parse(row.layout || '{}'),
    updatedAt: row.updatedAt,
  };
}
function seccionSpec(cliente, seccionKey) {
  const row = getConfigRow(cliente);
  if (!row) return null;
  const secs = JSON.parse(row.secciones || '{}');
  return secs[seccionKey] || null;
}

// Clientes que tienen dashboard configurado.
router.get(
  '/dashboard/clientes',
  requireActor,
  wrap((req, res) => {
    const rows = db.prepare('SELECT cliente FROM dashboards_config WHERE activo = 1 ORDER BY cliente').all();
    res.json({ clientes: rows.map((r) => r.cliente) });
  })
);

// Definicion de las secciones de un cliente (para armar plantillas y el formulario de carga).
router.get(
  '/dashboard/secciones/:cliente',
  requireActor,
  wrap((req, res) => {
    const row = getConfigRow(req.params.cliente);
    if (!row) return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
    res.json({ cliente: req.params.cliente, secciones: JSON.parse(row.secciones || '{}') });
  })
);

// Cargas existentes (para la pantalla de carga). Solo quien puede cargar.
router.get(
  '/dashboard/cargas',
  requireDataLoader,
  wrap((req, res) => {
    const { cliente, seccion } = req.query;
    let rows;
    if (cliente && seccion) {
      rows = db
        .prepare(
          'SELECT * FROM dashboard_cargas WHERE cliente = ? AND seccion = ? ORDER BY periodo DESC'
        )
        .all(cliente, seccion);
    } else if (cliente) {
      rows = db
        .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? ORDER BY seccion, periodo DESC')
        .all(cliente);
    } else {
      rows = db.prepare('SELECT * FROM dashboard_cargas ORDER BY cliente, seccion, periodo DESC').all();
    }
    res.json(rows.map(toCarga));
  })
);

// ── Configuracion de dashboards — CRUD (crear un dashboard = insertar aqui) ──
router.get(
  '/dashboards/config',
  requireActor,
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede ver la configuracion de dashboards' });
    }
    const rows = db.prepare('SELECT * FROM dashboards_config ORDER BY cliente').all();
    res.json(
      rows.map((r) => {
        const layout = JSON.parse(r.layout || '{}');
        return {
          cliente: r.cliente,
          titulo: r.titulo,
          activo: !!r.activo,
          tabs: (layout.tabs || []).length,
          paneles: (layout.tabs || []).reduce((a, t) => a + (t.panels || []).length, 0),
          updatedAt: r.updatedAt,
        };
      })
    );
  })
);

router.get(
  '/dashboards/config/:cliente',
  requireActor,
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede ver la configuracion de dashboards' });
    }
    const row = getConfigRow(req.params.cliente);
    if (!row) return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
    res.json(toConfig(row));
  })
);

router.post(
  '/dashboards/config',
  requireActor,
  validate(schemas.dashboardConfigBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede crear dashboards' });
    }
    const b = req.body;
    if (db.prepare('SELECT id FROM dashboards_config WHERE cliente = ?').get(b.cliente)) {
      return res.status(409).json({ error: 'Ya existe un dashboard para ese cliente' });
    }
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
       VALUES (@cliente,@titulo,@vista,@secciones,@layout,1,@now,@now)`
    ).run({
      cliente: b.cliente,
      titulo: b.titulo,
      vista: b.vista ? JSON.stringify(b.vista) : null,
      secciones: JSON.stringify(b.secciones),
      layout: JSON.stringify(b.layout),
      now,
    });
    logEvent('DASHBOARD_CONFIG', { nombre: b.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), b.titulo);
    res.status(201).json(toConfig(getConfigRow(b.cliente)));
  })
);

router.put(
  '/dashboards/config/:cliente',
  requireActor,
  validate(schemas.dashboardConfigBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede editar dashboards' });
    }
    const row = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(req.params.cliente);
    if (!row) return res.status(404).json({ error: 'Dashboard no encontrado' });
    const b = req.body;
    db.prepare(
      `UPDATE dashboards_config SET titulo=?, vista=?, secciones=?, layout=?, updatedAt=? WHERE cliente=?`
    ).run(
      b.titulo,
      b.vista ? JSON.stringify(b.vista) : null,
      JSON.stringify(b.secciones),
      JSON.stringify(b.layout),
      new Date().toISOString(),
      req.params.cliente
    );
    logEvent('DASHBOARD_CONFIG_EDIT', { nombre: req.params.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), b.titulo);
    res.json(toConfig(getConfigRow(req.params.cliente)));
  })
);

router.delete(
  '/dashboards/config/:cliente',
  requireActor,
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar dashboards' });
    }
    const row = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(req.params.cliente);
    if (!row) return res.status(404).json({ error: 'Dashboard no encontrado' });
    db.prepare('DELETE FROM dashboards_config WHERE cliente = ?').run(req.params.cliente);
    // NUNCA se borra dashboard_cargas aqui (bug real encontrado 2026-09-16,
    // ver docs/ARQUITECTURA.md §4): borrar/recrear la CONFIGURACION de un
    // dashboard (KPIs, secciones, layout) no debe destruir los EXCEL ya
    // cargados de ningun periodo -- son dos ciclos de vida independientes.
    // Si se vuelve a crear un dashboard para el mismo `cliente` (a mano o
    // por el auto-sembrado "solo si no existe"), sus cargas siguen ahi y
    // se ven de inmediato, sin tener que volver a subir nada.
    logEvent('DASHBOARD_CONFIG_DEL', { nombre: req.params.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), '');
    res.json({ ok: true });
  })
);

// Todos los datos operativos de un cliente, agrupados por seccion (los lee el dashboard).
router.get(
  '/dashboard/:cliente',
  requireActor,
  wrap((req, res) => {
    const cliente = req.params.cliente;

    // M4 (Fase A4): Inventario y Gerencia usan el mismo renderer generico, pero
    // sus datos salen de sus tablas propias (no de dashboard_cargas).
    const adapter = ADAPTERS[cliente];
    if (adapter) {
      if (!isFullAdmin(req.actor) && !can(req.actor, adapter.permiso)) {
        return res.status(403).json({ error: `Sin acceso al modulo de ${adapter.permiso}` });
      }
      return res.json({ cliente, config: adapter.config, secciones: adapter.build(db) });
    }

    if (!getConfigRow(cliente)) {
      return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
    }
    if (!clienteAccess(req.actor, cliente)) {
      return res.status(403).json({ error: 'Sin acceso a este dashboard' });
    }
    const rows = db
      .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? ORDER BY periodo')
      .all(cliente);
    const porSeccion = {};
    rows.map(toCarga).forEach((c) => {
      (porSeccion[c.seccion] = porSeccion[c.seccion] || []).push(c);
    });
    res.json({ cliente, config: toConfig(getConfigRow(cliente)), secciones: porSeccion });
  })
);

router.post(
  '/dashboard/cargas',
  requireDataLoader,
  validate(schemas.cargaBody),
  wrap((req, res) => {
    const b = req.body;
    const spec = seccionSpec(b.cliente, b.seccion);
    if (!spec) return res.status(400).json({ error: 'Cliente o seccion desconocidos' });
    if (!secciones.periodoValido(spec.periodo, b.periodo)) {
      return res.status(400).json({
        error:
          spec.periodo === 'mes'
            ? 'El periodo debe tener formato AAAA-MM'
            : spec.periodo === 'dia'
              ? 'El periodo debe tener formato AAAA-MM-DD'
              : 'Formato de periodo invalido',
      });
    }
    const norm = secciones.normalizarFilas(spec, b.filas);
    if (!norm.ok) {
      return res.status(400).json({ error: norm.errores[0], detalles: norm.errores });
    }
    const now = nowStr();
    const existing = db
      .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? AND seccion = ? AND periodo = ?')
      .get(b.cliente, b.seccion, b.periodo);
    // Ya hay una carga para este cliente/seccion/periodo y no se pidio
    // reemplazar -> avisar, no sobrescribir en silencio (feedback Edwin 3.1).
    if (existing && !b.reemplazar) {
      return res.status(409).json({
        error: `Ya existe una carga para ${b.cliente} / ${b.seccion} / ${b.periodo}.`,
        yaExiste: true,
        cliente: b.cliente,
        seccion: b.seccion,
        periodo: b.periodo,
        cargadoPorNombre: existing.cargadoPorNombre,
        cargadoEn: existing.cargadoEn,
        filasActuales: (() => { try { return JSON.parse(existing.filas || '[]').length; } catch (_) { return null; } })(),
      });
    }
    const payload = {
      cliente: b.cliente,
      seccion: b.seccion,
      cadencia: b.cadencia,
      periodo: b.periodo,
      filas: JSON.stringify(norm.filas),
      archivoNombre: b.archivoNombre || null,
      cargadoPor: req.actor.isMasterAdmin ? null : req.actor.id,
      cargadoPorNombre: req.actor.nombre,
      cargadoEn: now,
    };
    let id;
    if (existing) {
      db.prepare(
        `UPDATE dashboard_cargas SET cadencia=@cadencia, filas=@filas, archivoNombre=@archivoNombre,
           cargadoPor=@cargadoPor, cargadoPorNombre=@cargadoPorNombre, cargadoEn=@cargadoEn
         WHERE id=@id`
      ).run({ ...payload, id: existing.id });
      id = existing.id;
    } else {
      const info = db
        .prepare(
          `INSERT INTO dashboard_cargas
             (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
           VALUES (@cliente,@seccion,@cadencia,@periodo,@filas,@archivoNombre,@cargadoPor,@cargadoPorNombre,@cargadoEn)`
        )
        .run(payload);
      id = info.lastInsertRowid;
    }

    // Fase 39: Trafico es la fuente de verdad para llamadas_3p/
    // nivel_atencion_3p/llamadas_general/nivel_atencion_general de ORLANT --
    // si esta carga manual de "resumen" trae sus propios valores para esos 4
    // campos, se re-aplican de inmediato los que ya calculo Trafico (si hay
    // datos de Trafico para este mes; si no hay, no hace nada y los valores
    // recien subidos a mano quedan tal cual, igual que hoy). El resto de
    // columnas de esta carga (whatsapp, agendas, citas, etc.) no se tocan.
    if (b.cliente === 'ORLANT' && b.seccion === 'resumen') {
      recalcularResumenOrlantDesdeTrafico(db, b.periodo, now);
    }

    const row = db.prepare('SELECT * FROM dashboard_cargas WHERE id = ?').get(id);
    logEvent(
      existing ? 'DASHBOARD_CARGA_EDIT' : 'DASHBOARD_CARGA',
      { nombre: b.cliente, user: '-', rol: b.seccion },
      actorLabel(req.actor),
      `${b.periodo} — ${norm.filas.length} fila(s)`
    );
    res.status(existing ? 200 : 201).json(toCarga(row));
  })
);

router.delete(
  '/dashboard/cargas/:id',
  requireDataLoader,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    const row = db.prepare('SELECT * FROM dashboard_cargas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Carga no encontrada' });
    db.prepare('DELETE FROM dashboard_cargas WHERE id = ?').run(row.id);
    logEvent(
      'DASHBOARD_CARGA_DEL',
      { nombre: row.cliente, user: '-', rol: row.seccion },
      actorLabel(req.actor),
      row.periodo
    );
    res.json({ ok: true });
  })
);

module.exports = router;
