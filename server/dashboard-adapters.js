// dashboard-adapters.js — M4 (Fase A4).
//
// Inventario y Gerencia se muestran con el MISMO sistema de dashboards
// configurables que los clientes (mismos paneles, mismo motor de analisis A6,
// misma exportacion). La unica diferencia: sus datos no salen de
// `dashboard_cargas` (Excel) sino de sus tablas propias (`inventario_*`,
// `gerencia_kpis`), que se siguen administrando desde sus modulos.
//
// Cada adaptador expone:
//   - config : la configuracion de dashboard (igual forma que dashboards_config)
//   - build(db) : arma el objeto `secciones` en la forma que espera el front
//                 ({ <seccion>: [ { periodo, filas:[...] } ] }).
//
// Como no hay cargas de Excel, `secciones` de la config solo documenta las
// columnas; el front no genera plantillas para estos dos.

'use strict';

const col = (key, label, tipo) => ({ key, label, tipo: tipo || 'entero' });
const U = (campo, extra) => ({ s: 'resumen', modo: 'ultimo', campo, ...(extra || {}) });
const S = (campo, extra) => ({ s: 'resumen', modo: 'serie', campo, ...(extra || {}) });
const kpi = (titulo, fuente, formato, extra) => ({ titulo, fuente, formato: formato || 'entero', ...(extra || {}) });
const mesActual = () => new Date().toISOString().slice(0, 7);

// ════════════════════════════════════════════════════════════
// GERENCIA — indicadores ejecutivos mensuales (gerencia_kpis)
// ════════════════════════════════════════════════════════════
const GERENCIA_CONFIG = {
  cliente: 'GERENCIA',
  titulo: 'Dashboard de Gerencia',
  vista: null,
  secciones: {
    resumen: {
      titulo: 'Resumen ejecutivo por mes', descripcion: 'Derivado de los indicadores de Gerencia.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('total', 'Indicadores'), col('con_meta', 'Indicadores con meta'),
        col('cumplen', 'Cumplen la meta'), col('pct_cumplimiento', '% Cumplimiento', 'porcentaje'),
        col('categorias', 'Categorias'),
      ],
    },
    indicadores: {
      titulo: 'Indicadores del mes', descripcion: 'Un registro por indicador.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [
        col('nombre', 'Indicador', 'texto'), col('categoria', 'Categoria', 'texto'),
        col('valor', 'Valor', 'decimal'), col('meta', 'Meta', 'decimal'),
        col('pct_meta', '% de la meta', 'porcentaje'), col('unidad', 'Unidad', 'texto'),
      ],
    },
  },
  layout: {
    kpis: [
      kpi('Indicadores', U('total'), 'entero'),
      kpi('Con meta', U('con_meta'), 'entero'),
      kpi('Cumplen la meta', U('cumplen'), 'entero', { cls: 'kpi-green' }),
      kpi('% Cumplimiento', U('pct_cumplimiento'), 'porcentaje', { cls: 'kpi-org', meta: 100, alerta: { min: 70 } }),
      kpi('Categorias', U('categorias'), 'entero', { cls: 'kpi-pur' }),
    ],
    tabs: [
      { key: 'cumplimiento', label: 'Cumplimiento', panels: [
        { tipo: 'line', titulo: '% Cumplimiento de metas por mes', unidad: '%',
          series: [{ label: '% Cumplimiento', fuente: S('pct_cumplimiento') }] },
        { tipo: 'combo', titulo: 'Indicadores que cumplen vs con meta', barras: [
          { label: 'Con meta', fuente: S('con_meta') }, { label: 'Cumplen', fuente: S('cumplen') }],
          linea: { label: '% Cumplimiento', fuente: { s: 'resumen', modo: 'serie', formula: 'a/b*100', a: 'cumplen', b: 'con_meta' } } },
      ] },
      { key: 'indicadores', label: 'Por indicador', panels: [
        { tipo: 'bar', titulo: '% de avance de meta por indicador', horizontal: true, unidad: '%',
          series: [{ label: '% de la meta', fuente: { s: 'indicadores', modo: 'filas', x: 'nombre', campo: 'pct_meta' } }] },
        { tipo: 'tabla', titulo: 'Detalle de indicadores', fuente: { s: 'indicadores', modo: 'filas', x: 'nombre' },
          columnas: [
            { key: 'nombre', label: 'Indicador' }, { key: 'categoria', label: 'Categoria' },
            { key: 'valor', label: 'Valor' }, { key: 'meta', label: 'Meta' }, { key: 'pct_meta', label: '% Meta' },
          ] },
      ] },
      { key: 'categorias', label: 'Categorias', panels: [
        { tipo: 'pie', titulo: 'Indicadores por categoria',
          fuente: { s: 'indicadores', modo: 'filas', x: 'categoria', campo: 'valor' } },
      ] },
    ],
  },
};

function buildGerencia(db) {
  const rows = db.prepare('SELECT * FROM gerencia_kpis ORDER BY periodo').all();
  const porPeriodo = {};
  for (const r of rows) {
    (porPeriodo[r.periodo] = porPeriodo[r.periodo] || []).push(r);
  }
  const resumen = [];
  const indicadores = [];
  for (const periodo of Object.keys(porPeriodo).sort()) {
    const ks = porPeriodo[periodo];
    const conMeta = ks.filter((k) => k.meta !== null && k.meta !== undefined);
    const cumplen = conMeta.filter((k) => k.valor >= k.meta).length;
    const cats = new Set(ks.map((k) => k.categoria));
    resumen.push({
      periodo,
      filas: [{
        total: ks.length,
        con_meta: conMeta.length,
        cumplen,
        pct_cumplimiento: conMeta.length ? Math.round((cumplen / conMeta.length) * 1000) / 10 : 0,
        categorias: cats.size,
      }],
    });
    indicadores.push({
      periodo,
      filas: ks.map((k) => ({
        nombre: k.nombre,
        categoria: k.categoria,
        valor: k.valor,
        meta: k.meta === null || k.meta === undefined ? 0 : k.meta,
        pct_meta: k.meta ? Math.round((k.valor / k.meta) * 1000) / 10 : 0,
        unidad: k.unidad || '',
      })),
    });
  }
  return { resumen, indicadores };
}

// ════════════════════════════════════════════════════════════
// INVENTARIO — stock y movimientos (inventario_items / inventario_movimientos)
// ════════════════════════════════════════════════════════════
const INVENTARIO_CONFIG = {
  cliente: 'INVENTARIO',
  titulo: 'Dashboard de Inventario',
  vista: null,
  secciones: {
    resumen: {
      titulo: 'Resumen de stock (foto actual)', descripcion: 'Derivado de los items de inventario.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('items', 'Items'), col('unidades', 'Unidades en stock'),
        col('valor_total', 'Valor total', 'decimal'), col('disponibles', 'Disponibles'),
        col('en_uso', 'En uso'), col('mantenimiento', 'En mantenimiento'),
        col('baja', 'Dados de baja'), col('sin_stock', 'Items sin stock'),
      ],
    },
    por_categoria: {
      titulo: 'Stock por categoria', descripcion: 'Un registro por categoria.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('categoria', 'Categoria', 'texto'), col('items', 'Items'), col('unidades', 'Unidades'), col('valor', 'Valor', 'decimal')],
    },
    movimientos_mes: {
      titulo: 'Movimientos por mes', descripcion: 'Entradas y salidas agregadas por mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [col('entradas', 'Entradas'), col('salidas', 'Salidas'), col('ajustes', 'Ajustes'), col('transferencias', 'Transferencias'), col('neto', 'Neto (E-S)')],
    },
    movimientos_recientes: {
      titulo: 'Ultimos movimientos', descripcion: 'Detalle de los movimientos del mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('fecha', 'Fecha', 'texto'), col('item', 'Item', 'texto'), col('tipo', 'Tipo', 'texto'), col('cantidad', 'Cantidad')],
    },
  },
  layout: {
    kpis: [
      kpi('Items', U('items'), 'entero'),
      kpi('Unidades en stock', U('unidades'), 'miles'),
      kpi('Valor total', U('valor_total'), 'miles', { cls: 'kpi-green' }),
      kpi('Disponibles', U('disponibles'), 'entero'),
      kpi('En uso', U('en_uso'), 'entero', { cls: 'kpi-org' }),
      kpi('En mantenimiento', U('mantenimiento'), 'entero', { cls: 'kpi-org', mejorDireccion: 'baja' }),
      kpi('Items sin stock', U('sin_stock'), 'entero', { cls: 'kpi-red', mejorDireccion: 'baja', alerta: { min: 0, max: 0 } }),
    ],
    tabs: [
      { key: 'stock', label: 'Stock', panels: [
        { tipo: 'bar', titulo: 'Unidades por categoria', horizontal: true,
          series: [{ label: 'Unidades', fuente: { s: 'por_categoria', modo: 'filas', x: 'categoria', campo: 'unidades' } }] },
        { tipo: 'pie', titulo: 'Valor por categoria',
          fuente: { s: 'por_categoria', modo: 'filas', x: 'categoria', campo: 'valor' } },
        { tipo: 'tabla', titulo: 'Detalle por categoria', fuente: { s: 'por_categoria', modo: 'filas', x: 'categoria' },
          columnas: [{ key: 'categoria', label: 'Categoria' }, { key: 'items', label: 'Items' }, { key: 'unidades', label: 'Unidades' }, { key: 'valor', label: 'Valor' }] },
      ] },
      { key: 'movimientos', label: 'Movimientos', panels: [
        { tipo: 'combo', titulo: 'Entradas vs Salidas por mes', barras: [
          { label: 'Entradas', fuente: { s: 'movimientos_mes', modo: 'serie', campo: 'entradas' } },
          { label: 'Salidas', fuente: { s: 'movimientos_mes', modo: 'serie', campo: 'salidas' } }],
          linea: { label: 'Neto', fuente: { s: 'movimientos_mes', modo: 'serie', campo: 'neto' } } },
        { tipo: 'tabla', titulo: 'Ultimos movimientos', fuente: { s: 'movimientos_recientes', modo: 'filas', x: 'fecha' },
          columnas: [{ key: 'fecha', label: 'Fecha' }, { key: 'item', label: 'Item' }, { key: 'tipo', label: 'Tipo' }, { key: 'cantidad', label: 'Cantidad' }] },
      ] },
    ],
  },
};

function buildInventario(db) {
  const mes = mesActual();
  const items = db.prepare('SELECT * FROM inventario_items').all();
  const est = (e) => items.filter((i) => i.estado === e).length;
  const resumen = [{
    periodo: mes,
    filas: [{
      items: items.length,
      unidades: items.reduce((a, i) => a + (i.cantidad || 0), 0),
      valor_total: Math.round(items.reduce((a, i) => a + (i.cantidad || 0) * (i.costoUnitario || 0), 0) * 100) / 100,
      disponibles: est('Disponible'),
      en_uso: est('En Uso'),
      mantenimiento: est('Mantenimiento'),
      baja: est('Dado de Baja'),
      sin_stock: items.filter((i) => (i.cantidad || 0) <= 0).length,
    }],
  }];

  const cats = {};
  for (const i of items) {
    const c = (cats[i.categoria] = cats[i.categoria] || { categoria: i.categoria, items: 0, unidades: 0, valor: 0 });
    c.items += 1;
    c.unidades += i.cantidad || 0;
    c.valor += (i.cantidad || 0) * (i.costoUnitario || 0);
  }
  const por_categoria = [{
    periodo: mes,
    filas: Object.values(cats).map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 })),
  }];

  const movs = db.prepare('SELECT * FROM inventario_movimientos ORDER BY fecha').all();
  const nombreItem = {};
  for (const i of items) nombreItem[i.id] = i.nombre;
  const porMes = {};
  for (const m of movs) {
    const mk = String(m.fecha || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mk)) continue;
    const b = (porMes[mk] = porMes[mk] || { entradas: 0, salidas: 0, ajustes: 0, transferencias: 0 });
    if (m.tipo === 'Entrada') b.entradas += m.cantidad;
    else if (m.tipo === 'Salida') b.salidas += m.cantidad;
    else if (m.tipo === 'Ajuste') b.ajustes += m.cantidad;
    else if (m.tipo === 'Transferencia') b.transferencias += m.cantidad;
  }
  const movimientos_mes = Object.keys(porMes).sort().map((mk) => ({
    periodo: mk,
    filas: [{ ...porMes[mk], neto: porMes[mk].entradas - porMes[mk].salidas }],
  }));
  const movimientos_recientes = [{
    periodo: mes,
    filas: movs.slice(-20).reverse().map((m) => ({
      fecha: m.fecha, item: nombreItem[m.itemId] || ('#' + m.itemId), tipo: m.tipo, cantidad: m.cantidad,
    })),
  }];

  return { resumen, por_categoria, movimientos_mes, movimientos_recientes };
}

const ADAPTERS = {
  GERENCIA: { permiso: 'Gerencia', config: GERENCIA_CONFIG, build: buildGerencia },
  INVENTARIO: { permiso: 'Inventario', config: INVENTARIO_CONFIG, build: buildInventario },
};

module.exports = { ADAPTERS };
