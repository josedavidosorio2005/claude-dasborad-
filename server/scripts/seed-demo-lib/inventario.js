// inventario.js — Items de stock + movimientos de demo. Incluye items SIN
// STOCK a proposito (cantidad final 0) para que la alerta del KPI "Items sin
// stock" del dashboard de Inventario se vea de verdad, no solo en el caso feliz.
'use strict';

const { seedOnce } = require('./marks');
const { MESES, rngFromSeed, randInt, fechaISO, diasGenerables } = require('./util');

const OBS_DEMO = '[DEMO] Sembrado por seed-demo';

const ITEMS = [
  { nombre: 'Diadema con microfono', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 85000, meta: 40 },
  { nombre: 'Computador de escritorio', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 1850000, meta: 18 },
  { nombre: 'Monitor 24 pulgadas', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 620000, meta: 22 },
  { nombre: 'Teclado USB', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 45000, meta: 35 },
  { nombre: 'Mouse optico', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 28000, meta: 35 },
  { nombre: 'Camara web HD', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 95000, meta: 15 },
  { nombre: 'Diadema Bluetooth', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 120000, meta: 12 },
  { nombre: 'Impresora laser', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 980000, meta: 4 },
  { nombre: 'Adaptador USB-C', categoria: 'Equipos de Computo', unidad: 'un', costoUnitario: 35000, meta: 0, sinStock: true },
  { nombre: 'Router WiFi', categoria: 'Telefonia y Redes', unidad: 'un', costoUnitario: 180000, meta: 8 },
  { nombre: 'Switch 24 puertos', categoria: 'Telefonia y Redes', unidad: 'un', costoUnitario: 650000, meta: 3 },
  { nombre: 'Telefono IP', categoria: 'Telefonia y Redes', unidad: 'un', costoUnitario: 210000, meta: 20 },
  { nombre: 'Cable de red Cat6 (caja)', categoria: 'Telefonia y Redes', unidad: 'caja', costoUnitario: 320000, meta: 6 },
  { nombre: 'UPS 1000VA', categoria: 'Telefonia y Redes', unidad: 'un', costoUnitario: 480000, meta: 5, estado: 'Mantenimiento' },
  { nombre: 'Silla ergonomica', categoria: 'Mobiliario', unidad: 'un', costoUnitario: 410000, meta: 25 },
  { nombre: 'Escritorio modular', categoria: 'Mobiliario', unidad: 'un', costoUnitario: 520000, meta: 14 },
  { nombre: 'Archivador metalico', categoria: 'Mobiliario', unidad: 'un', costoUnitario: 380000, meta: 7 },
  { nombre: 'Silla de espera (sala)', categoria: 'Mobiliario', unidad: 'un', costoUnitario: 150000, meta: 10, estado: 'Dado de Baja' },
  { nombre: 'Resma de papel carta', categoria: 'Suministros de Oficina', unidad: 'resma', costoUnitario: 16000, meta: 60 },
  { nombre: 'Toner impresora laser', categoria: 'Suministros de Oficina', unidad: 'un', costoUnitario: 220000, meta: 10 },
  { nombre: 'Esferos (caja x50)', categoria: 'Suministros de Oficina', unidad: 'caja', costoUnitario: 38000, meta: 8 },
  { nombre: 'Carpetas AZ', categoria: 'Suministros de Oficina', unidad: 'un', costoUnitario: 9500, meta: 50 },
  { nombre: 'Extension electrica', categoria: 'Suministros de Oficina', unidad: 'un', costoUnitario: 22000, meta: 0, sinStock: true },
  { nombre: 'Gel antibacterial (galon)', categoria: 'Suministros de Aseo', unidad: 'galon', costoUnitario: 42000, meta: 12 },
  { nombre: 'Tapabocas (caja x50)', categoria: 'Suministros de Aseo', unidad: 'caja', costoUnitario: 28000, meta: 18 },
];

function seedInventario(db, { cargadoPorNombre }) {
  const insertItem = db.prepare(`
    INSERT INTO inventario_items
      (nombre, categoria, descripcion, cantidad, unidad, ubicacion, estado, proveedor, costoUnitario, observaciones, createdAt, updatedAt)
    VALUES (@nombre,@categoria,@descripcion,@cantidad,@unidad,@ubicacion,@estado,@proveedor,@costoUnitario,@observaciones,@now,@now)
  `);
  const insertMov = db.prepare(`
    INSERT INTO inventario_movimientos
      (itemId, tipo, cantidad, fecha, motivo, destino, registradoPor, registradoPorNombre, createdAt)
    VALUES (@itemId,@tipo,@cantidad,@fecha,@motivo,@destino,NULL,@registradoPorNombre,@now)
  `);

  let itemsCreados = 0;
  let movimientosCreados = 0;

  for (const def of ITEMS) {
    const { created, id: itemId } = seedOnce(db, 'inventario_items', 'item|' + def.nombre, () => {
      const now = new Date().toISOString();
      // El stock final coincide con el ultimo movimiento (Ajuste) que se
      // siembra mas abajo para este mismo item — nunca queda descuadrado.
      const cantidadFinal = def.sinStock ? 0 : def.meta;
      const info = insertItem.run({
        nombre: def.nombre,
        categoria: def.categoria,
        descripcion: '',
        cantidad: cantidadFinal,
        unidad: def.unidad,
        ubicacion: 'Bodega Principal',
        estado: def.estado || (def.sinStock ? 'Disponible' : 'Disponible'),
        proveedor: 'Proveedor Demo S.A.S.',
        costoUnitario: def.costoUnitario,
        observaciones: OBS_DEMO,
        now,
      });
      return info.lastInsertRowid;
    });
    if (created) itemsCreados++;
    if (!created) continue; // sus movimientos ya se sembraron en una corrida anterior

    // Historico de movimientos en 3-5 de los 6 meses, terminando SIEMPRE en un
    // Ajuste al valor meta del item (o 0 para los marcados sinStock) — asi el
    // stock final coincide exactamente con lo que muestran los movimientos.
    const randI = rngFromSeed('invmov|' + def.nombre);
    const mesesConMov = MESES.filter(() => randI() < 0.7);
    if (!mesesConMov.length) mesesConMov.push(MESES[MESES.length - 1]);
    let idx = 0;
    for (const mes of mesesConMov) {
      const gen = diasGenerables(mes);
      const dia = randInt(randI, 1, gen);
      const esUltimo = idx === mesesConMov.length - 1;
      const tipo = esUltimo ? 'Ajuste' : randI() < 0.55 ? 'Entrada' : 'Salida';
      const cantidad = esUltimo
        ? (def.sinStock ? 0 : def.meta)
        : Math.max(1, Math.round(def.meta * (0.1 + randI() * 0.25)));
      const clave = `${def.nombre}|${mes}|${idx}`;
      const { created: movCreated, id: movId } = seedOnce(db, 'inventario_movimientos', clave, () => {
        const info = insertMov.run({
          itemId,
          tipo,
          cantidad,
          fecha: fechaISO(mes, dia),
          motivo: tipo === 'Ajuste' ? 'Ajuste de inventario (demo)' : tipo === 'Entrada' ? 'Compra / reposicion (demo)' : 'Consumo operativo (demo)',
          destino: '',
          registradoPorNombre: cargadoPorNombre || 'Seed Demo',
          now: new Date().toISOString(),
        });
        return info.lastInsertRowid;
      });
      if (movCreated) movimientosCreados++;
      void movId;
      idx++;
    }
  }

  return { itemsCreados, movimientosCreados };
}

module.exports = { seedInventario, ITEMS };
