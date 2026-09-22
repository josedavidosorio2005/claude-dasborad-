// dashboard-plantillas-cliente.js — Configuraciones (datos, no codigo) de los
// dashboards de cliente creados en M3 (Fase A2).
//
// IMPORTANTE: las metricas concretas de cada cliente no estaban definidas por
// negocio. Aqui se usan PLANTILLAS ESTANDAR de contact center (ventas salientes,
// cobranza, atencion al cliente) como punto de partida. El admin las afina desde
// el constructor visual (seccion "Dashboards de Cliente") sin tocar codigo:
// agregar/quitar columnas de carga, KPIs, paneles y tipo de grafico.
//
// Todo dashboard nuevo hereda el estandar de la Fase A6: los KPIs admiten
// { meta, mejorDireccion:'baja', alerta:{min,max,caidaPct} } y cada panel de
// serie admite que el visor cambie su tipo de grafico para su propia vista.

'use strict';

// ── Helpers compactos (equivalentes a los de dashboard-config-seed.js) ──
const U = (campo, extra) => ({ s: 'resumen', modo: 'ultimo', campo, ...(extra || {}) });
const S = (campo, extra) => ({ s: 'resumen', modo: 'serie', campo, ...(extra || {}) });
const pct = (a, b, base) => ({ ...(base || { s: 'resumen', modo: 'serie' }), formula: 'a/b*100', a, b });
const kpi = (titulo, fuente, formato, extra) => ({ titulo, fuente, formato: formato || 'entero', ...(extra || {}) });
const lineMes = (titulo, campo, extra) => ({ tipo: 'line', titulo, series: [{ label: titulo, fuente: S(campo) }], ...(extra || {}) });
const lineDia = (titulo, s, campo, unidad) => ({ tipo: 'line', titulo, unidad, series: [{ label: titulo, fuente: { s, modo: 'filas', x: 'fecha', campo } }] });
const col = (key, label, tipo) => ({ key, label, tipo: tipo || 'entero' });

// Pestaña de Calidad reutilizable (usa los monitoreos de la campana homonima).
const tabCalidad = (campana) => ({
  key: 'calidad', label: 'Calidad', panels: [
    { tipo: 'calidad_kpis', campana },
    { tipo: 'calidad_pie', campana, titulo: 'Distribucion de clasificacion' },
  ],
});

// Pestaña de Trafico de Llamadas (export real de Volvox via mapeo de skill):
// grafica combinada + filtros, panel autonomo del motor generico (ver
// dashboard-generic.js _traficoRenderPanel / dashboard-adapters.js).
const tabTrafico = (campana) => ({
  key: 'trafico', label: 'Trafico de Llamadas', panels: [
    { tipo: 'trafico_combo', campana },
  ],
});

// Las campanas con Calidad tambien traen su pestaña de Trafico (misma
// campana, mismos datos de calidad_nivel_servicio_diario) — un solo punto
// para agregar ambas donde ya se agregaba Calidad.
const tabsCalidadYTrafico = (campana) => [tabCalidad(campana), tabTrafico(campana)];

// ════════════════════════════════════════════════════════════
// PLANTILLA 1 — Ventas salientes / televentas
// ════════════════════════════════════════════════════════════
function plantillaVentas(cliente, titulo, opts) {
  opts = opts || {};
  const secciones = {
    resumen: {
      titulo: 'Resumen mensual (KPIs y tendencias)',
      descripcion: 'Un unico juego de valores por mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('base_asignada', 'Base asignada'),
        col('gestionados', 'Registros gestionados'),
        col('contactados', 'Contactados'),
        col('contactos_efectivos', 'Contactos efectivos'),
        col('ventas', 'Ventas'),
        col('meta_ventas', 'Meta de ventas'),
        col('aht_segundos', 'AHT promedio (segundos)'),
      ],
    },
    diario: {
      titulo: 'Gestion por dia',
      descripcion: 'Una fila por dia; se puede subir dia a dia o el mes completo.',
      cadencia: 'diaria', periodo: 'mes', filaUnica: false,
      columnas: [col('fecha', 'Fecha (AAAA-MM-DD)', 'fecha'), col('gestionados', 'Gestionados'), col('contactados', 'Contactados'), col('ventas', 'Ventas')],
    },
    tipificacion: {
      titulo: 'Tipificacion de gestion',
      descripcion: 'Una fila por tipificacion con la cantidad del mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('tipificacion', 'Tipificacion', 'texto'), col('cantidad', 'Cantidad')],
    },
    asesores: {
      titulo: 'Resultados por asesor',
      descripcion: 'Una fila por asesor con su gestion y ventas del mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('asesor', 'Asesor', 'texto'), col('gestionados', 'Gestionados'), col('ventas', 'Ventas')],
    },
  };
  const layout = {
    kpis: [
      kpi('Base asignada', U('base_asignada'), 'miles'),
      kpi('Gestionados', U('gestionados'), 'miles'),
      kpi('Contactabilidad', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'contactados', b: 'gestionados' }, 'porcentaje', { meta: opts.metaContact || 70, alerta: { min: (opts.metaContact || 70) - 15 } }),
      kpi('Contactos efectivos', U('contactos_efectivos'), 'miles'),
      kpi('Ventas', U('ventas'), 'miles', { cls: 'kpi-green', meta: U('meta_ventas') }),
      kpi('Conversion', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'ventas', b: 'contactados' }, 'porcentaje', { cls: 'kpi-org', meta: opts.metaConv || 15 }),
      kpi('AHT Promedio', U('aht_segundos'), 'tiempo_mmss', { cls: 'kpi-org', mejorDireccion: 'baja' }),
    ],
    tabs: [
      { key: 'flujo', label: 'Flujo de gestion', panels: [
        lineDia('Gestionados por dia', 'diario', 'gestionados'),
        lineDia('Contactados por dia', 'diario', 'contactados'),
        lineDia('Ventas por dia', 'diario', 'ventas'),
        lineMes('Gestionados por mes', 'gestionados'),
      ] },
      { key: 'conversion', label: 'Conversion', panels: [
        { tipo: 'combo', titulo: 'Contactados vs Ventas y % conversion', barras: [
          { label: 'Contactados', fuente: S('contactados') },
          { label: 'Ventas', fuente: S('ventas') }],
          linea: { label: '% Conversion', fuente: pct('ventas', 'contactados') } },
        { tipo: 'combo', titulo: 'Ventas vs Meta', barras: [
          { label: 'Ventas', fuente: S('ventas') },
          { label: 'Meta', fuente: S('meta_ventas') }],
          linea: { label: '% Cumplimiento', fuente: pct('ventas', 'meta_ventas') } },
        lineMes('AHT por mes', 'aht_segundos', { unidad: 'tiempo' }),
      ] },
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion de gestion', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' } },
      ] },
      { key: 'asesores', label: 'Ranking asesores', panels: [
        { tipo: 'bar', titulo: 'Ventas por asesor', horizontal: true, series: [{ label: 'Ventas', fuente: { s: 'asesores', modo: 'filas', x: 'asesor', campo: 'ventas' } }] },
        { tipo: 'bar', titulo: 'Gestionados por asesor', horizontal: true, series: [{ label: 'Gestionados', fuente: { s: 'asesores', modo: 'filas', x: 'asesor', campo: 'gestionados' } }] },
        { tipo: 'tabla', titulo: 'Detalle por asesor', fuente: { s: 'asesores', modo: 'filas', x: 'asesor' },
          columnas: [{ key: 'asesor', label: 'Asesor' }, { key: 'gestionados', label: 'Gestionados' }, { key: 'ventas', label: 'Ventas' }] },
      ] },
    ],
  };
  if (opts.calidad) layout.tabs.push(...tabsCalidadYTrafico(cliente));
  return { cliente, titulo, vista: null, secciones, layout };
}

// ════════════════════════════════════════════════════════════
// PLANTILLA 2 — Cobranza / gestion de cartera
// ════════════════════════════════════════════════════════════
function plantillaCobranza(cliente, titulo, opts) {
  opts = opts || {};
  const secciones = {
    resumen: {
      titulo: 'Resumen mensual de cartera',
      descripcion: 'Un unico juego de valores por mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('cuentas_asignadas', 'Cuentas asignadas'),
        col('cuentas_gestionadas', 'Cuentas gestionadas'),
        col('contactos_efectivos', 'Contactos efectivos'),
        col('promesas_pago', 'Promesas de pago'),
        col('promesas_cumplidas', 'Promesas cumplidas'),
        col('recaudo', 'Recaudo del mes'),
        col('meta_recaudo', 'Meta de recaudo'),
        col('saldo_cartera', 'Saldo de cartera'),
      ],
    },
    diario: {
      titulo: 'Gestion por dia',
      descripcion: 'Una fila por dia.',
      cadencia: 'diaria', periodo: 'mes', filaUnica: false,
      columnas: [col('fecha', 'Fecha (AAAA-MM-DD)', 'fecha'), col('gestionadas', 'Cuentas gestionadas'), col('promesas', 'Promesas'), col('recaudo', 'Recaudo')],
    },
    tipificacion: {
      titulo: 'Tipificacion de gestion',
      descripcion: 'Una fila por tipificacion.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('tipificacion', 'Tipificacion', 'texto'), col('cantidad', 'Cantidad')],
    },
    asesores: {
      titulo: 'Resultados por asesor',
      descripcion: 'Una fila por asesor.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('asesor', 'Asesor', 'texto'), col('gestionadas', 'Gestionadas'), col('promesas', 'Promesas'), col('recaudo', 'Recaudo')],
    },
  };
  const layout = {
    kpis: [
      kpi('Cuentas gestionadas', U('cuentas_gestionadas'), 'miles'),
      kpi('Cobertura', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'cuentas_gestionadas', b: 'cuentas_asignadas' }, 'porcentaje', { meta: opts.metaCobertura || 90 }),
      kpi('Contactos efectivos', U('contactos_efectivos'), 'miles'),
      kpi('Promesas de pago', U('promesas_pago'), 'miles', { cls: 'kpi-pur' }),
      kpi('Cumplimiento de promesas', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'promesas_cumplidas', b: 'promesas_pago' }, 'porcentaje', { cls: 'kpi-org', meta: opts.metaPromesas || 60 }),
      kpi('Recaudo', U('recaudo'), 'miles', { cls: 'kpi-green', meta: U('meta_recaudo') }),
      kpi('% Recaudo vs meta', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'recaudo', b: 'meta_recaudo' }, 'porcentaje', { cls: 'kpi-green', meta: 100, alerta: { min: 80 } }),
    ],
    tabs: [
      { key: 'recaudo', label: 'Recaudo', panels: [
        { tipo: 'combo', titulo: 'Recaudo vs Meta y % cumplimiento', barras: [
          { label: 'Recaudo', fuente: S('recaudo') },
          { label: 'Meta', fuente: S('meta_recaudo') }],
          linea: { label: '% Cumplimiento', fuente: pct('recaudo', 'meta_recaudo') } },
        lineDia('Recaudo por dia', 'diario', 'recaudo'),
        lineMes('Saldo de cartera por mes', 'saldo_cartera'),
      ] },
      { key: 'promesas', label: 'Promesas', panels: [
        { tipo: 'combo', titulo: 'Promesas vs Cumplidas', barras: [
          { label: 'Promesas', fuente: S('promesas_pago') },
          { label: 'Cumplidas', fuente: S('promesas_cumplidas') }],
          linea: { label: '% Cumplimiento', fuente: pct('promesas_cumplidas', 'promesas_pago') } },
        lineDia('Promesas por dia', 'diario', 'promesas'),
      ] },
      { key: 'gestion', label: 'Gestion', panels: [
        { tipo: 'combo', titulo: 'Asignadas vs Gestionadas y cobertura', barras: [
          { label: 'Asignadas', fuente: S('cuentas_asignadas') },
          { label: 'Gestionadas', fuente: S('cuentas_gestionadas') }],
          linea: { label: '% Cobertura', fuente: pct('cuentas_gestionadas', 'cuentas_asignadas') } },
        { tipo: 'pie', titulo: 'Tipificacion de gestion', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' } },
      ] },
      { key: 'asesores', label: 'Ranking asesores', panels: [
        { tipo: 'bar', titulo: 'Recaudo por asesor', horizontal: true, series: [{ label: 'Recaudo', fuente: { s: 'asesores', modo: 'filas', x: 'asesor', campo: 'recaudo' } }] },
        { tipo: 'tabla', titulo: 'Detalle por asesor', fuente: { s: 'asesores', modo: 'filas', x: 'asesor' },
          columnas: [{ key: 'asesor', label: 'Asesor' }, { key: 'gestionadas', label: 'Gestionadas' }, { key: 'promesas', label: 'Promesas' }, { key: 'recaudo', label: 'Recaudo' }] },
      ] },
    ],
  };
  if (opts.calidad) layout.tabs.push(...tabsCalidadYTrafico(cliente));
  return { cliente, titulo, vista: null, secciones, layout };
}

// ════════════════════════════════════════════════════════════
// PLANTILLA 3 — Atencion al cliente / agendamiento
// ════════════════════════════════════════════════════════════
function plantillaAtencion(cliente, titulo, opts) {
  opts = opts || {};
  const etiquetaSalida = opts.salidaLabel || 'Agendas';
  const campoSalida = opts.salidaCampo || 'agendas';
  const secciones = {
    resumen: {
      titulo: 'Resumen mensual (KPIs y tendencias)',
      descripcion: 'Un unico juego de valores por mes.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [
        col('llamadas_entrada', 'Llamadas de entrada'),
        col('wpp_entrada', 'WhatsApp de entrada'),
        col('nivel_atencion', 'Nivel de atencion (%)', 'porcentaje'),
        col('abandonos', 'Abandonos'),
        col('aht_segundos', 'AHT promedio (segundos)'),
        col(campoSalida, etiquetaSalida),
        col('meta_' + campoSalida, 'Meta de ' + etiquetaSalida.toLowerCase()),
      ],
    },
    diario: {
      titulo: 'Actividad por dia',
      descripcion: 'Una fila por dia.',
      cadencia: 'diaria', periodo: 'mes', filaUnica: false,
      columnas: [col('fecha', 'Fecha (AAAA-MM-DD)', 'fecha'), col('llamadas', 'Llamadas'), col('wpp', 'WhatsApp'), col(campoSalida, etiquetaSalida)],
    },
    tipificacion: {
      titulo: 'Tipificacion',
      descripcion: 'Una fila por tipificacion.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: false,
      columnas: [col('tipificacion', 'Tipificacion', 'texto'), col('cantidad', 'Cantidad')],
    },
  };
  // 'Llamadas Entrada'/'Nivel de Atencion'/'Abandonos' (carga manual de
  // Gestion de base) duplican EXACTO lo que ya muestra la pestaña real de
  // Trafico de Llamadas ('Total Llamadas'/'Nivel de Atencion'/'Llamadas
  // Abandonadas', trafico.js) cuando esa pestaña existe -- mismo criterio
  // ya aplicado a CLINICA AURORA en la Fase 45 (dashboards_config_trafico_
  // kpis_duplicados_v1) y confirmado de nuevo para SASCHA FITNESS/BIVETT en
  // la Fase 59. Se mantienen 'WhatsApp Entrada' (sin modulo automatico de
  // WhatsApp para estos clientes, es su unica fuente real) y la de salida
  // (Pedidos/Agendas, tampoco tiene equivalente automatico).
  const kpisBase = [
    kpi('Llamadas Entrada', U('llamadas_entrada'), 'miles'),
    kpi('WhatsApp Entrada', U('wpp_entrada'), 'miles'),
    kpi('Nivel de Atencion', U('nivel_atencion'), 'porcentaje', { semaforo: 90, metrica: 'nivel_atencion', meta: 90, alerta: { min: 85 } }),
    kpi('Abandonos', U('abandonos'), 'entero', { cls: 'kpi-red', mejorDireccion: 'baja' }),
    kpi('AHT Promedio', U('aht_segundos'), 'tiempo_mmss', { cls: 'kpi-org', mejorDireccion: 'baja' }),
    kpi(etiquetaSalida, U(campoSalida), 'miles', { cls: 'kpi-green', meta: U('meta_' + campoSalida) }),
  ];
  const DUPLICADOS_CON_TRAFICO = ['Llamadas Entrada', 'Nivel de Atencion', 'Abandonos'];
  const layout = {
    kpis: opts.calidad ? kpisBase.filter((k) => DUPLICADOS_CON_TRAFICO.indexOf(k.titulo) === -1) : kpisBase,
    tabs: [
      { key: 'flujo', label: 'Flujo diario', panels: [
        lineDia('Llamadas por dia', 'diario', 'llamadas'),
        lineDia('WhatsApp por dia', 'diario', 'wpp'),
        lineDia(etiquetaSalida + ' por dia', 'diario', campoSalida),
        lineMes('Nivel de atencion por mes', 'nivel_atencion', { unidad: '%' }),
      ] },
      { key: 'tendencias', label: 'Tendencias', panels: [
        { tipo: 'combo', titulo: etiquetaSalida + ' vs Meta', barras: [
          { label: etiquetaSalida, fuente: S(campoSalida) },
          { label: 'Meta', fuente: S('meta_' + campoSalida) }],
          linea: { label: '% Cumplimiento', fuente: pct(campoSalida, 'meta_' + campoSalida) } },
        lineMes('AHT por mes', 'aht_segundos', { unidad: 'tiempo' }),
        lineMes('Abandonos por mes', 'abandonos'),
      ] },
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' } },
      ] },
    ],
  };
  if (opts.calidad) layout.tabs.push(...tabsCalidadYTrafico(cliente));
  return { cliente, titulo, vista: null, secciones, layout };
}

// ════════════════════════════════════════════════════════════
// Los 9 dashboards (M3). Supuestos documentados en AWS_DEPLOY_REPORT.md.
// ════════════════════════════════════════════════════════════
const CONFIGS_CLIENTE = [
  plantillaVentas('TELEVENTAS SURA', 'Dashboard Televentas Sura', { calidad: true, metaContact: 70, metaConv: 15 }),
  plantillaVentas('TELEVENTAS COMFAMA', 'Dashboard Televentas Comfama', { calidad: true, metaContact: 70, metaConv: 15 }),
  plantillaVentas('PANTERA MAIKERS', 'Dashboard Pantera Maikers', { calidad: false, metaContact: 65, metaConv: 12 }),
  plantillaVentas('ANDRES YEPES', 'Dashboard Andres Yepes', { calidad: true, metaContact: 65, metaConv: 12 }),
  plantillaVentas('MOVILIZE', 'Dashboard Movilize', { calidad: true, metaContact: 65, metaConv: 12 }),
  plantillaVentas('ALBERTO LINERO GO', 'Dashboard Alberto Linero Go', { calidad: false, metaContact: 65, metaConv: 12 }),
  plantillaCobranza('INFONDO', 'Dashboard Infondo', { calidad: true, metaCobertura: 90, metaPromesas: 60 }),
  plantillaAtencion('SASCHA FITNESS', 'Dashboard Sascha Fitness', { calidad: true, salidaLabel: 'Pedidos', salidaCampo: 'pedidos' }),
  plantillaAtencion('BIVETT', 'Dashboard Bivett', { calidad: true, salidaLabel: 'Agendas', salidaCampo: 'agendas' }),
];

module.exports = { CONFIGS_CLIENTE, plantillaVentas, plantillaCobranza, plantillaAtencion };
