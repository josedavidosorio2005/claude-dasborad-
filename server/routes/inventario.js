// routes/inventario.js — Items de stock y movimientos. Extraido de
// server.js (Radiografia InConexion, #3): solo se movio el cableado HTTP,
// sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, can } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');

const router = express.Router();

router.use('/inventario', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function toInvItem(row) {
  return {
    id: row.id, nombre: row.nombre, categoria: row.categoria,
    descripcion: row.descripcion || '', cantidad: row.cantidad, unidad: row.unidad,
    ubicacion: row.ubicacion || '', estado: row.estado, proveedor: row.proveedor || '',
    costoUnitario: row.costoUnitario || 0, observaciones: row.observaciones || '',
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
function toInvMovimiento(row) {
  return {
    id: row.id, itemId: row.itemId, tipo: row.tipo, cantidad: row.cantidad,
    fecha: row.fecha, motivo: row.motivo || '', destino: row.destino || '',
    registradoPorNombre: row.registradoPorNombre || '', createdAt: row.createdAt,
  };
}

// Listar items (con filtros opcionales por categoria y estado)
router.get(
  '/inventario/items',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const { categoria, estado } = req.query;
    let rows;
    if (categoria && estado) {
      rows = db.prepare('SELECT * FROM inventario_items WHERE categoria = ? AND estado = ? ORDER BY nombre').all(categoria, estado);
    } else if (categoria) {
      rows = db.prepare('SELECT * FROM inventario_items WHERE categoria = ? ORDER BY nombre').all(categoria);
    } else if (estado) {
      rows = db.prepare('SELECT * FROM inventario_items WHERE estado = ? ORDER BY nombre').all(estado);
    } else {
      rows = db.prepare('SELECT * FROM inventario_items ORDER BY categoria, nombre').all();
    }
    res.json(rows.map(toInvItem));
  })
);

// Resumen del inventario
router.get(
  '/inventario/resumen',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const total = db.prepare('SELECT COUNT(*) AS c FROM inventario_items').get().c;
    const totalUnidades = db.prepare('SELECT COALESCE(SUM(cantidad), 0) AS s FROM inventario_items').get().s;
    const valorTotal = db.prepare('SELECT COALESCE(SUM(cantidad * costoUnitario), 0) AS s FROM inventario_items').get().s;
    const porEstado = db.prepare('SELECT estado, COUNT(*) AS c FROM inventario_items GROUP BY estado').all();
    const porCategoria = db.prepare('SELECT categoria, COUNT(*) AS c, COALESCE(SUM(cantidad),0) AS unidades FROM inventario_items GROUP BY categoria ORDER BY categoria').all();
    const movimientosRecientes = db.prepare('SELECT * FROM inventario_movimientos ORDER BY id DESC LIMIT 10').all().map(toInvMovimiento);
    res.json({
      total, totalUnidades, valorTotal: Math.round(valorTotal * 100) / 100,
      porEstado, porCategoria, movimientosRecientes,
    });
  })
);

// Crear un item
router.post(
  '/inventario/items',
  requireActor,
  validate(schemas.inventarioItemBody),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const b = req.body;
    const now = nowStr();
    const info = db.prepare(
      `INSERT INTO inventario_items (nombre, categoria, descripcion, cantidad, unidad, ubicacion, estado, proveedor, costoUnitario, observaciones, createdAt, updatedAt)
       VALUES (@nombre,@categoria,@descripcion,@cantidad,@unidad,@ubicacion,@estado,@proveedor,@costoUnitario,@observaciones,@now,@now)`
    ).run({ ...b, now });
    const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(info.lastInsertRowid);
    logEvent('INV_ITEM', { nombre: b.nombre, user: '-', rol: b.categoria }, actorLabel(req.actor), `Cantidad: ${b.cantidad}`);
    res.status(201).json(toInvItem(row));
  })
);

// Actualizar un item
router.put(
  '/inventario/items/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.inventarioItemUpdate),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Item no encontrado' });
    const b = req.body;
    db.prepare(
      `UPDATE inventario_items SET nombre=?, categoria=?, descripcion=?, cantidad=?, unidad=?, ubicacion=?, estado=?, proveedor=?, costoUnitario=?, observaciones=?, updatedAt=? WHERE id=?`
    ).run(
      b.nombre ?? row.nombre, b.categoria ?? row.categoria, b.descripcion ?? row.descripcion,
      b.cantidad ?? row.cantidad, b.unidad ?? row.unidad, b.ubicacion ?? row.ubicacion,
      b.estado ?? row.estado, b.proveedor ?? row.proveedor, b.costoUnitario ?? row.costoUnitario,
      b.observaciones ?? row.observaciones, nowStr(), row.id
    );
    const updated = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(row.id);
    logEvent('INV_ITEM_EDIT', { nombre: updated.nombre, user: '-', rol: updated.categoria }, actorLabel(req.actor), '');
    res.json(toInvItem(updated));
  })
);

// Eliminar un item
router.delete(
  '/inventario/items/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Item no encontrado' });
    db.prepare('DELETE FROM inventario_items WHERE id = ?').run(row.id);
    logEvent('INV_ITEM_DEL', { nombre: row.nombre, user: '-', rol: row.categoria }, actorLabel(req.actor), '');
    res.json({ ok: true });
  })
);

// Movimientos de un item
router.get(
  '/inventario/movimientos',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const { itemId } = req.query;
    let rows;
    if (itemId) {
      rows = db.prepare('SELECT * FROM inventario_movimientos WHERE itemId = ? ORDER BY id DESC').all(itemId);
    } else {
      rows = db.prepare('SELECT * FROM inventario_movimientos ORDER BY id DESC LIMIT 200').all();
    }
    res.json(rows.map(toInvMovimiento));
  })
);

// Registrar un movimiento
router.post(
  '/inventario/movimientos',
  requireActor,
  validate(schemas.inventarioMovimientoBody),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const b = req.body;
    const item = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(b.itemId);
    if (!item) return res.status(400).json({ error: 'Item no encontrado' });
    // Actualizar cantidad segun tipo de movimiento
    let nuevaCantidad = item.cantidad;
    if (b.tipo === 'Entrada' || b.tipo === 'Ajuste') {
      nuevaCantidad = b.tipo === 'Ajuste' ? b.cantidad : item.cantidad + b.cantidad;
    } else if (b.tipo === 'Salida') {
      if (item.cantidad < b.cantidad) {
        return res.status(400).json({ error: `Stock insuficiente. Disponible: ${item.cantidad} ${item.unidad}` });
      }
      nuevaCantidad = item.cantidad - b.cantidad;
    } else if (b.tipo === 'Transferencia') {
      if (item.cantidad < b.cantidad) {
        return res.status(400).json({ error: `Stock insuficiente para transferencia. Disponible: ${item.cantidad} ${item.unidad}` });
      }
      nuevaCantidad = item.cantidad - b.cantidad;
    }
    const now = nowStr();
    const tx = db.transaction(() => {
      db.prepare('UPDATE inventario_items SET cantidad = ?, updatedAt = ? WHERE id = ?').run(nuevaCantidad, now, b.itemId);
      const info = db.prepare(
        `INSERT INTO inventario_movimientos (itemId, tipo, cantidad, fecha, motivo, destino, registradoPor, registradoPorNombre, createdAt)
         VALUES (@itemId,@tipo,@cantidad,@fecha,@motivo,@destino,@registradoPor,@registradoPorNombre,@now)`
      ).run({
        itemId: b.itemId, tipo: b.tipo, cantidad: b.cantidad, fecha: b.fecha,
        motivo: b.motivo || '', destino: b.destino || '',
        registradoPor: req.actor.isMasterAdmin ? null : req.actor.id,
        registradoPorNombre: req.actor.nombre, now,
      });
      return info.lastInsertRowid;
    });
    const movId = tx();
    const mov = db.prepare('SELECT * FROM inventario_movimientos WHERE id = ?').get(movId);
    logEvent('INV_MOV', { nombre: item.nombre, user: '-', rol: b.tipo }, actorLabel(req.actor), `${b.tipo}: ${b.cantidad} ${item.unidad}`);
    res.status(201).json(toInvMovimiento(mov));
  })
);

// Carga masiva de items desde Excel
router.post(
  '/inventario/carga-items',
  requireActor,
  validate(schemas.inventarioCargaBody),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const { items } = req.body;
    const now = nowStr();
    let creados = 0;
    const insert = db.prepare(
      `INSERT INTO inventario_items (nombre, categoria, descripcion, cantidad, unidad, ubicacion, estado, proveedor, costoUnitario, observaciones, createdAt, updatedAt)
       VALUES (@nombre,@categoria,@descripcion,@cantidad,@unidad,@ubicacion,@estado,@proveedor,@costoUnitario,@observaciones,@now,@now)`
    );
    const tx = db.transaction((rows) => {
      for (const item of rows) {
        insert.run({ ...item, now });
        creados++;
      }
    });
    tx(items);
    logEvent('INV_CARGA', { nombre: `${creados} items`, user: '-', rol: 'inventario' }, actorLabel(req.actor), `Carga masiva`);
    res.status(201).json({ ok: true, creados });
  })
);

// Carga masiva de movimientos desde Excel
router.post(
  '/inventario/carga-movimientos',
  requireActor,
  validate(schemas.inventarioMovCargaBody),
  wrap((req, res) => {
    if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
    const { movimientos } = req.body;
    const now = nowStr();
    let creados = 0;
    const insert = db.prepare(
      `INSERT INTO inventario_movimientos (itemId, tipo, cantidad, fecha, motivo, destino, registradoPor, registradoPorNombre, createdAt)
       VALUES (@itemId,@tipo,@cantidad,@fecha,@motivo,@destino,@registradoPor,@registradoPorNombre,@now)`
    );
    const tx = db.transaction((rows) => {
      for (const m of rows) {
        const item = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(m.itemId);
        if (!item) continue;
        // Actualizar stock
        let nuevaCantidad = item.cantidad;
        if (m.tipo === 'Entrada' || m.tipo === 'Ajuste') {
          nuevaCantidad = m.tipo === 'Ajuste' ? m.cantidad : item.cantidad + m.cantidad;
        } else if (m.tipo === 'Salida' || m.tipo === 'Transferencia') {
          nuevaCantidad = Math.max(0, item.cantidad - m.cantidad);
        }
        db.prepare('UPDATE inventario_items SET cantidad = ?, updatedAt = ? WHERE id = ?').run(nuevaCantidad, now, m.itemId);
        insert.run({
          itemId: m.itemId, tipo: m.tipo, cantidad: m.cantidad, fecha: m.fecha,
          motivo: m.motivo || '', destino: m.destino || '',
          registradoPor: req.actor.isMasterAdmin ? null : req.actor.id,
          registradoPorNombre: req.actor.nombre, now,
        });
        creados++;
      }
    });
    tx(movimientos);
    logEvent('INV_CARGA_MOV', { nombre: `${creados} movimientos`, user: '-', rol: 'inventario' }, actorLabel(req.actor), `Carga masiva`);
    res.status(201).json({ ok: true, creados });
  })
);

module.exports = router;
