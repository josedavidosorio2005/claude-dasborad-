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

// ════════════════════════════════════════════════════════════
// GESTION HUMANA — personal por campana (gestion_humana_personal)
// ════════════════════════════════════════════════════════════
// Metricas (feedback de Edwin 4.2):
//  - Rotacion de personal: bajas del mes / activos al inicio del mes * 100.
//  - Ingresos / salidas por mes: altas y bajas, serie de tiempo.
//  - Costo de nomina: por persona = costo_hora * horas_mes; por campana = suma
//    de su gente activa.
//  - Rentabilidad por campana: ingresos de la campana - costo de nomina.
//    "Ingresos" se toma del ultimo `resumen` cargado del dashboard de esa
//    campana (columna `recaudo` si existe, si no `ventas`). Heuristica
//    confirmada por el usuario (2026-09-14): se mantiene tal cual.
//  - "Efectividad" (feedback de Edwin, punto 4): produccion del equipo (el
//    mismo KPI de "ingresos" de arriba) vs su meta (`meta_recaudo`/`meta_ventas`
//    de esa misma fila `resumen`), definicion confirmada por el usuario
//    (2026-09-14). Ver produccionCampana() abajo. Queda `null` para campanas
//    sin recaudo/ventas en su resumen (hoy: Sascha Fitness, Bivett — plantilla
//    de atencion), mismo hueco que ya tenia "ingresos" para esos 2 clientes.

const GH_CONFIG = {
  cliente: 'GESTION_HUMANA',
  titulo: 'Dashboard de Gestion Humana',
  vista: null,
  secciones: {
    resumen: {
      titulo: 'Foto actual del personal', descripcion: 'Derivado del registro de personal.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('activos', 'Personal activo'), col('ingresos_mes', 'Ingresos del mes'),
        col('salidas_mes', 'Salidas del mes'), col('rotacion_pct', '% Rotacion (mes)', 'porcentaje'),
        col('costo_nomina_mes', 'Costo nomina / mes', 'decimal'), col('campanas', 'Campanas con personal'),
      ],
    },
    flujo_mes: {
      titulo: 'Ingresos y salidas por mes', descripcion: 'Altas y bajas de personal, mes a mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('ingresos', 'Ingresos'), col('salidas', 'Salidas'),
        col('activos_fin', 'Activos al cierre'), col('rotacion_pct', '% Rotacion', 'porcentaje'),
      ],
    },
    por_campana: {
      titulo: 'Personal y rentabilidad por campana', descripcion: 'Un registro por campana.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [
        col('campana', 'Campana', 'texto'), col('activos', 'Activos'),
        col('costo_mes', 'Costo nomina / mes', 'decimal'), col('ingresos', 'Ingresos', 'decimal'),
        col('rentabilidad', 'Rentabilidad', 'decimal'), col('margen_pct', '% Margen', 'porcentaje'),
        col('efectividad_pct', '% Efectividad (produccion vs meta)', 'porcentaje'),
      ],
    },
    personal: {
      titulo: 'Personal', descripcion: 'Detalle del registro de personal.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [
        col('nombre', 'Nombre', 'texto'), col('cargo', 'Cargo', 'texto'),
        col('campana', 'Campana', 'texto'), col('estado', 'Estado', 'texto'),
        col('fecha_ingreso', 'Ingreso', 'texto'), col('antiguedad_meses', 'Antiguedad (meses)'),
      ],
    },
  },
  layout: {
    kpis: [
      kpi('Personal activo', U('activos'), 'entero'),
      kpi('Ingresos del mes', U('ingresos_mes'), 'entero', { cls: 'kpi-green' }),
      kpi('Salidas del mes', U('salidas_mes'), 'entero', { cls: 'kpi-org', mejorDireccion: 'baja' }),
      kpi('% Rotacion (mes)', U('rotacion_pct'), 'porcentaje', { cls: 'kpi-red', mejorDireccion: 'baja', alerta: { max: 10 } }),
      kpi('Costo nomina / mes', U('costo_nomina_mes'), 'miles', { cls: 'kpi-pur' }),
      kpi('Campanas con personal', U('campanas'), 'entero'),
    ],
    tabs: [
      { key: 'flujo', label: 'Ingresos / Salidas', panels: [
        { tipo: 'combo', titulo: 'Ingresos vs Salidas por mes', barras: [
          { label: 'Ingresos', fuente: S('ingresos', { s: 'flujo_mes' }) },
          { label: 'Salidas', fuente: S('salidas', { s: 'flujo_mes' }) }],
          linea: { label: 'Activos al cierre', fuente: S('activos_fin', { s: 'flujo_mes' }) } },
        { tipo: 'line', titulo: '% Rotacion por mes', unidad: '%',
          series: [{ label: '% Rotacion', fuente: S('rotacion_pct', { s: 'flujo_mes' }) }] },
      ] },
      { key: 'campanas', label: 'Por campana', panels: [
        { tipo: 'bar', titulo: 'Personal activo por campana', horizontal: true,
          series: [{ label: 'Activos', fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'activos' } }] },
        { tipo: 'combo', titulo: 'Ingresos vs costo de nomina por campana', barras: [
          { label: 'Ingresos', fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'ingresos' } },
          { label: 'Costo nomina', fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'costo_mes' } }],
          linea: { label: 'Rentabilidad', fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'rentabilidad' } } },
        { tipo: 'bar', titulo: '% Efectividad por campana (produccion vs meta)', horizontal: true, unidad: '%',
          series: [{ label: '% Efectividad', fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'efectividad_pct' } }] },
        { tipo: 'tabla', titulo: 'Rentabilidad por campana', fuente: { s: 'por_campana', modo: 'filas', x: 'campana' },
          columnas: [
            { key: 'campana', label: 'Campana' }, { key: 'activos', label: 'Activos' },
            { key: 'costo_mes', label: 'Costo/mes' }, { key: 'ingresos', label: 'Ingresos' },
            { key: 'rentabilidad', label: 'Rentabilidad' }, { key: 'margen_pct', label: '% Margen' },
            { key: 'efectividad_pct', label: '% Efectividad' },
          ] },
      ] },
      { key: 'personal', label: 'Personal', panels: [
        { tipo: 'pie', titulo: 'Personal activo por campana',
          fuente: { s: 'por_campana', modo: 'filas', x: 'campana', campo: 'activos' } },
        { tipo: 'tabla', titulo: 'Detalle de personal', fuente: { s: 'personal', modo: 'filas', x: 'nombre' },
          columnas: [
            { key: 'nombre', label: 'Nombre' }, { key: 'cargo', label: 'Cargo' },
            { key: 'campana', label: 'Campana' }, { key: 'estado', label: 'Estado' },
            { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'antiguedad_meses', label: 'Antiguedad (m)' },
          ] },
      ] },
    ],
  },
};

// mes (YYYY-MM) -> 'YYYY-MM-01' y 'YYYY-MM-ultimo'
function mesRango(mesKey) {
  const [y, m] = mesKey.split('-').map(Number);
  const ini = `${mesKey}-01`;
  const finDate = new Date(Date.UTC(y, m, 0)); // dia 0 del mes siguiente = ultimo del actual
  const fin = finDate.toISOString().slice(0, 10);
  return { ini, fin };
}
function mesSiguiente(mesKey) {
  const [y, m] = mesKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}
function listarMeses(desde, hasta) {
  const out = [];
  let cur = desde;
  for (let i = 0; i < 60 && cur <= hasta; i++) { out.push(cur); cur = mesSiguiente(cur); }
  return out;
}
function mesesEntre(desdeYmd, hastaYmd) {
  if (!desdeYmd) return 0;
  const a = new Date(desdeYmd + 'T00:00:00Z');
  const b = hastaYmd ? new Date(hastaYmd + 'T00:00:00Z') : new Date();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.4375)));
}

// Produccion "proxy" de una campana: ultimo `resumen` cargado de su dashboard,
// con su meta emparejada (meta_recaudo / meta_ventas). Usa `recaudo` si existe
// (monetario), si no `ventas`. Heuristica documentada (mismo criterio que ya
// se usaba para "ingresos"; ver ingresosCampana abajo).
function produccionCampana(db, campana) {
  const row = db
    .prepare("SELECT filas FROM dashboard_cargas WHERE cliente = ? AND seccion = 'resumen' ORDER BY periodo DESC, id DESC LIMIT 1")
    .get(campana);
  if (!row) return { valor: 0, meta: null };
  let filas;
  try { filas = JSON.parse(row.filas || '[]'); } catch (_) { return { valor: 0, meta: null }; }
  const f = filas[0] || {};
  const rec = Number(f.recaudo);
  if (Number.isFinite(rec) && rec > 0) {
    const meta = Number(f.meta_recaudo);
    return { valor: rec, meta: Number.isFinite(meta) && meta > 0 ? meta : null };
  }
  const ven = Number(f.ventas);
  if (Number.isFinite(ven) && ven > 0) {
    const meta = Number(f.meta_ventas);
    return { valor: ven, meta: Number.isFinite(meta) && meta > 0 ? meta : null };
  }
  return { valor: 0, meta: null };
}

// Ingresos "proxy" de una campana (conserva la firma historica; ver
// produccionCampana arriba, que ademas trae la meta para calcular efectividad).
function ingresosCampana(db, campana) {
  return produccionCampana(db, campana).valor;
}

function buildGestionHumana(db) {
  const gente = db.prepare('SELECT * FROM gestion_humana_personal').all();
  const hoy = new Date().toISOString().slice(0, 10);
  const mesHoy = hoy.slice(0, 7);
  const costoMes = (p) => Math.round((p.costo_hora || 0) * (p.horas_mes || 0) * 100) / 100;
  const salida = (p) => (p.fecha_salida && String(p.fecha_salida).trim()) ? String(p.fecha_salida).slice(0, 10) : null;

  const activoEn = (p, ymd) => p.fecha_ingreso <= ymd && (!salida(p) || salida(p) >= ymd);
  const activosSet = gente.filter((p) => activoEn(p, hoy));

  // ── serie mensual de flujo ──
  const ingresosFechas = gente.map((p) => p.fecha_ingreso).filter(Boolean).sort();
  const primerMes = ingresosFechas.length ? ingresosFechas[0].slice(0, 7) : mesHoy;
  const meses = listarMeses(primerMes, mesHoy);
  const flujo_mes = meses.map((mk) => {
    const { ini, fin } = mesRango(mk);
    const ingresos = gente.filter((p) => p.fecha_ingreso >= ini && p.fecha_ingreso <= fin).length;
    const salidas = gente.filter((p) => { const s = salida(p); return s && s >= ini && s <= fin; }).length;
    const activosInicio = gente.filter((p) => p.fecha_ingreso < ini && (!salida(p) || salida(p) >= ini)).length;
    const activosFin = gente.filter((p) => p.fecha_ingreso <= fin && (!salida(p) || salida(p) > fin)).length;
    const rotacion = activosInicio > 0 ? Math.round((salidas / activosInicio) * 1000) / 10 : 0;
    return { periodo: mk, filas: [{ ingresos, salidas, activos_fin: activosFin, rotacion_pct: rotacion }] };
  });
  const flujoActual = flujo_mes.length ? flujo_mes[flujo_mes.length - 1].filas[0] : { ingresos: 0, salidas: 0, rotacion_pct: 0 };

  // ── por campana (foto actual) ──
  const camps = {};
  for (const p of activosSet) {
    const c = (camps[p.campana] = camps[p.campana] || { campana: p.campana, activos: 0, costo_mes: 0 });
    c.activos += 1;
    c.costo_mes += costoMes(p);
  }
  const por_campana_filas = Object.values(camps).map((c) => {
    const prod = produccionCampana(db, c.campana);
    const ingresos = prod.valor;
    const costo = Math.round(c.costo_mes * 100) / 100;
    const rentabilidad = ingresos > 0 ? Math.round((ingresos - costo) * 100) / 100 : 0;
    const margen = ingresos > 0 ? Math.round(((ingresos - costo) / ingresos) * 1000) / 10 : 0;
    const efectividad_pct = prod.meta ? Math.round((prod.valor / prod.meta) * 1000) / 10 : null;
    return { campana: c.campana, activos: c.activos, costo_mes: costo, ingresos, rentabilidad, margen_pct: margen, efectividad_pct };
  }).sort((a, b) => b.activos - a.activos);

  // ── detalle de personal ──
  const personalFilas = gente
    .slice()
    .sort((a, b) => (a.campana || '').localeCompare(b.campana || '') || (a.nombre || '').localeCompare(b.nombre || ''))
    .map((p) => ({
      nombre: p.nombre,
      cargo: p.cargo || '-',
      campana: p.campana,
      estado: salida(p) ? 'Retirado' : 'Activo',
      fecha_ingreso: p.fecha_ingreso,
      antiguedad_meses: mesesEntre(p.fecha_ingreso, salida(p)),
    }));

  const resumen = [{
    periodo: mesHoy,
    filas: [{
      activos: activosSet.length,
      ingresos_mes: flujoActual.ingresos,
      salidas_mes: flujoActual.salidas,
      rotacion_pct: flujoActual.rotacion_pct,
      costo_nomina_mes: Math.round(activosSet.reduce((a, p) => a + costoMes(p), 0) * 100) / 100,
      campanas: Object.keys(camps).length,
    }],
  }];

  return {
    resumen,
    flujo_mes,
    por_campana: [{ periodo: mesHoy, filas: por_campana_filas }],
    personal: [{ periodo: mesHoy, filas: personalFilas }],
  };
}

const ADAPTERS = {
  GERENCIA: { permiso: 'Gerencia', config: GERENCIA_CONFIG, build: buildGerencia },
  INVENTARIO: { permiso: 'Inventario', config: INVENTARIO_CONFIG, build: buildInventario },
  GESTION_HUMANA: { permiso: 'GestionHumana', config: GH_CONFIG, build: buildGestionHumana },
};

module.exports = { ADAPTERS };
