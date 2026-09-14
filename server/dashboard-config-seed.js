// dashboard-config-seed.js — Configuracion (datos, no codigo) de cada dashboard
// de cliente. Fase 3 (REAL_DATA_REPORT.md).
//
// Un dashboard = { cliente, titulo, vista?, secciones, layout }
//   secciones : plantillas de carga por Excel (igual que Fase 2) — de aqui salen
//               las plantillas y la validacion.
//   vista     : selector superior que filtra todos los paneles por una columna
//               (ej. sede en Hospital La Maria). null si no aplica.
//   layout    : { kpis:[...], tabs:[{ key, label, panels:[...] }] }
//
// Tipos de panel: kpi_row | line | bar | pie | combo | tabla | calidad_kpis | calidad_pie
//
// "fuente" (de donde sale el dato de un panel):
//   { s:'<seccion>', modo:'serie'|'ultimo'|'filas'|'agregado', ... }
//     serie   -> un punto por periodo (grafica de tendencia mensual)
//     ultimo  -> el valor del ultimo periodo <= el mes seleccionado (KPI escalar)
//     filas   -> todas las filas de la carga del mes (x = etiqueta, campo = valor)
//     agregado-> suma/promedio de `campos` sobre las filas de la carga (KPI escalar)
//   campo    : columna a leer.   x : columna de etiqueta (filas).
//   formula  : 'a/b*100' con a,b = nombres de columna (dato derivado).
//   filtro   : { columna: valor } igualdad exacta sobre las filas.
//   op       : 'suma' | 'promedio' (modo agregado).

'use strict';

const { SECCIONES } = require('./dashboard-secciones');

// ── Helpers para escribir el layout de forma compacta ────────
const serie = (campo, extra) => ({ s: 'resumen', modo: 'serie', campo, ...(extra || {}) });
const ultimo = (campo, extra) => ({ s: 'resumen', modo: 'ultimo', campo, ...(extra || {}) });
const pctFormula = (a, b, base) => ({ ...(base || { s: 'resumen', modo: 'serie' }), formula: 'a/b*100', a, b });
const lineP = (titulo, campo, extra) => ({ tipo: 'line', titulo, series: [{ label: titulo, fuente: serie(campo) }], ...(extra || {}) });
const kpi = (titulo, fuente, formato, extra) => ({ titulo, fuente, formato: formato || 'entero', ...(extra || {}) });

// ── ORLANT ──────────────────────────────────────────────────
const ORLANT = {
  cliente: 'ORLANT',
  titulo: 'Dashboard Clinica Orlant',
  vista: null,
  secciones: SECCIONES.ORLANT,
  layout: {
    kpis: [
      kpi('Llamadas 3P', ultimo('llamadas_3p'), 'miles'),
      kpi('Nivel Atencion 3P', ultimo('nivel_atencion_3p'), 'porcentaje', { semaforo: 90 }),
      kpi('WhatsApp 3P', ultimo('wpp_3p'), 'miles'),
      kpi('Nivel Atencion WPP 3P', ultimo('nivel_atencion_wpp_3p'), 'porcentaje', { semaforo: 90 }),
      kpi('Llamadas Linea General', ultimo('llamadas_general'), 'miles'),
      kpi('Nivel Atencion L.General', ultimo('nivel_atencion_general'), 'porcentaje', { semaforo: 90 }),
      kpi('WhatsApp Linea General', ultimo('wpp_general'), 'miles'),
      kpi('Total Agendas', ultimo('total_agendas'), 'miles', { cls: 'kpi-pur' }),
      kpi('Efec. Ordenamiento Medico', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'ordmed_agendas', b: 'ordmed_gestionados' }, 'porcentaje', { cls: 'kpi-org' }),
      kpi('Recuperacion Cancelados', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'recup_atendido', b: 'recup_cancelado' }, 'porcentaje', { cls: 'kpi-green' }),
      kpi('Llamadas Salida (Gral+3P)', { s: 'salida', modo: 'agregado', op: 'suma', campos: ['salida_general', 'salida_3p'] }, 'miles', { cls: 'kpi-red' }),
      kpi('WhatsApp Salida (Gral+3P)', { s: 'salida', modo: 'agregado', op: 'suma', campos: ['wpp_salida_general', 'wpp_salida_3p'] }, 'miles'),
      kpi('% Citas Atendidas', { s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'citas_atendidas', b: 'citas_para_mes' }, 'porcentaje', { cls: 'kpi-org' }),
    ],
    tabs: [
      { key: 'flujo', label: 'Flujo Mensual', panels: [
        lineP('Llamadas 3P por mes', 'llamadas_3p'),
        lineP('WhatsApp 3P por mes', 'wpp_3p'),
        lineP('Llamadas Linea General por mes', 'llamadas_general'),
        lineP('WhatsApp Linea General por mes', 'wpp_general'),
      ]},
      { key: 'salida', label: 'Salida', panels: [
        { tipo: 'line', titulo: 'Llamadas de salida — Linea General', series: [{ label: 'Salida L. General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_general' } }] },
        { tipo: 'line', titulo: 'Llamadas de salida — 3P', series: [{ label: 'Salida 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_3p' } }] },
        { tipo: 'line', titulo: 'WhatsApp de salida — Linea General', series: [{ label: 'WPP Salida L. General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_general' } }] },
        { tipo: 'line', titulo: 'WhatsApp de salida — 3P', series: [{ label: 'WPP Salida 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_3p' } }] },
      ]},
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion Linea 3P', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { linea: '3P' } } },
        { tipo: 'pie', titulo: 'Tipificacion Linea General', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { linea: 'GENERAL' } } },
      ]},
      { key: 'agendamiento', label: 'Agendamiento', panels: [
        { tipo: 'combo', titulo: 'Ordenamiento medico', barras: [
          { label: 'Gestionados', fuente: serie('ordmed_gestionados') },
          { label: 'Agendas', fuente: serie('ordmed_agendas') }],
          linea: { label: '% Efectividad', fuente: pctFormula('ordmed_agendas', 'ordmed_gestionados') } },
        { tipo: 'combo', titulo: 'Recuperacion de cancelados', barras: [
          { label: 'Cancelado', fuente: serie('recup_cancelado') },
          { label: 'Atendido', fuente: serie('recup_atendido') }],
          linea: { label: '% Efectividad', fuente: pctFormula('recup_atendido', 'recup_cancelado') } },
        lineP('Total agendas por mes', 'total_agendas'),
        { tipo: 'bar', titulo: 'Agendas por linea', series: [
          { label: 'Linea General', fuente: serie('agendas_general') },
          { label: 'Linea 3P', fuente: serie('agendas_3p') }] },
      ]},
      { key: 'inasistencia', label: 'Inasistencia', panels: [
        lineP('% Inasistencia Audifonos', 'inasist_audifonos', { unidad: '%' }),
        lineP('% Inasistencia Audiologia', 'inasist_audiologia', { unidad: '%' }),
        lineP('% Inasistencia Examenes', 'inasist_examenes', { unidad: '%' }),
        lineP('% Inasistencia Total', 'inasist_total', { unidad: '%' }),
      ]},
      { key: 'sta', label: 'Gestion STA', panels: [
        { tipo: 'bar', titulo: 'Ordenes por servicio', horizontal: true, series: [{ label: 'Ordenes', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'SERVICIO' } } }] },
        { tipo: 'pie', titulo: 'Ordenes por estado', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'ESTADO' } } },
        { tipo: 'combo', titulo: 'STA por mes', barras: [
          { label: 'Ordenes Cargadas', fuente: serie('sta_ordenes') },
          { label: 'Facturado + Cumplida', fuente: serie('sta_factcump') }],
          linea: { label: '% Efectividad', fuente: pctFormula('sta_factcump', 'sta_ordenes') } },
        { tipo: 'combo', titulo: 'STA del mes por tipo', barras: [
          { label: 'Cantidad', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'MES_ACTUAL' } } }],
          linea: { label: '% Efectividad', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', formula: 'a/b*100', a: 'agendas', b: 'cantidad', filtro: { dimension: 'MES_ACTUAL' } } } },
      ]},
      { key: 'efectividad', label: 'Efectividad Citas', panels: [
        { tipo: 'combo', titulo: 'Efectividad de citas', barras: [
          { label: 'Citas para el mes', fuente: serie('citas_para_mes') },
          { label: 'Total Atendidas', fuente: serie('citas_atendidas') }],
          linea: { label: '% Efectividad', fuente: pctFormula('citas_atendidas', 'citas_para_mes') } },
      ]},
      { key: 'calidad', label: 'Calidad', panels: [
        { tipo: 'calidad_kpis', campana: 'ORLANT' },
        { tipo: 'calidad_pie', campana: 'ORLANT', titulo: 'Distribucion de clasificacion' },
      ]},
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [
        { tipo: 'trafico_combo', campana: 'ORLANT' },
      ]},
    ],
  },
};

// ── CLINICA AURORA ──────────────────────────────────────────
const dailyLine = (titulo, seccion, campo, unidad) => ({
  tipo: 'line', titulo, unidad,
  series: [{ label: titulo, fuente: { s: seccion, modo: 'filas', x: 'fecha', campo } }],
});

const AURORA = {
  cliente: 'CLINICA AURORA',
  titulo: 'Dashboard Clinica Aurora',
  vista: null,
  secciones: SECCIONES['CLINICA AURORA'],
  layout: {
    kpis: [
      kpi('Llamadas Entrada', ultimo('hist_llamadas'), 'miles'),
      kpi('Nivel Atencion', ultimo('nivel_atencion'), 'porcentaje', { semaforo: 90, meta: 90, alerta: { min: 85 } }),
      kpi('Abandonos', ultimo('abandonos'), 'entero', { cls: 'kpi-red', mejorDireccion: 'baja' }),
      kpi('AHT Promedio', ultimo('aht_segundos'), 'tiempo_mmss', { cls: 'kpi-org', mejorDireccion: 'baja' }),
      kpi('WhatsApp Entrada', ultimo('hist_whatsapp'), 'miles'),
      kpi('Nivel Ate. WPP', ultimo('nivel_atencion_wpp'), 'porcentaje', { cls: 'kpi-green' }),
      kpi('Total Agendas', ultimo('total_agendas'), 'miles', { cls: 'kpi-pur' }),
      kpi('Efectividad', ultimo('efectividad'), 'porcentaje', { cls: 'kpi-org' }),
      kpi('Llamadas Salida', ultimo('llamadas_salida'), 'miles', { cls: 'kpi-red' }),
      kpi('WhatsApp Salida', ultimo('wpp_salida'), 'miles'),
    ],
    tabs: [
      { key: 'llamadas', label: 'Llamadas Entrada', panels: [
        dailyLine('Llamadas ingresadas por dia', 'llamadas', 'llamadas_ingresadas'),
        dailyLine('% Contestadas', 'llamadas', 'pct_contestadas', '%'),
        dailyLine('% Abandonadas', 'llamadas', 'pct_abandonadas', '%'),
        { tipo: 'line', titulo: 'AHT por dia (seg)', unidad: 'tiempo', series: [{ label: 'AHT (seg)', fuente: { s: 'llamadas', modo: 'filas', x: 'fecha', campo: 'aht_segundos' } }] },
      ]},
      { key: 'wpp', label: 'WhatsApp Entrada', panels: [
        dailyLine('WhatsApp ingresados por dia', 'llamadas', 'wpp_ingresados'),
      ]},
      { key: 'agendas', label: 'Agendas', panels: [
        dailyLine('Agendas via llamada', 'agendas', 'agendas_llamada'),
        dailyLine('Agendas via WhatsApp', 'agendas', 'agendas_whatsapp'),
        lineP('Wolkvox — agendas por mes', 'agendas_wolkvox'),
        { tipo: 'bar', titulo: 'Agendas por especialidad', horizontal: true, series: [{ label: 'Agendas', fuente: { s: 'agendas_categorias', modo: 'filas', x: 'categoria', campo: 'valor', filtro: { dimension: 'ESPECIALIDAD' } } }] },
        { tipo: 'bar', titulo: 'Agendas por asesor', series: [{ label: 'Agendas', fuente: { s: 'agendas_categorias', modo: 'filas', x: 'categoria', campo: 'valor', filtro: { dimension: 'ASESOR' } } }] },
        lineP('% Inasistencia por mes', 'inasistencia_pct', { unidad: '%' }),
        { tipo: 'bar', titulo: '% Inasistencia por especialidad', horizontal: true, unidad: '%', series: [{ label: '% Inasistencia', fuente: { s: 'agendas_categorias', modo: 'filas', x: 'categoria', campo: 'valor', filtro: { dimension: 'INASISTENCIA_ESPECIALIDAD' } } }] },
      ]},
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion Llamada Entrada', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { canal: 'LLAMADA_ENTRADA' } } },
        { tipo: 'pie', titulo: 'Tipificacion Llamada Salida', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { canal: 'LLAMADA_SALIDA' } } },
        { tipo: 'pie', titulo: 'Tipificacion WhatsApp Entrada', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { canal: 'WPP_ENTRADA' } } },
        { tipo: 'pie', titulo: 'Tipificacion WhatsApp Salida', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { canal: 'WPP_SALIDA' } } },
        { tipo: 'pie', titulo: 'Encuestas', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad', filtro: { canal: 'ENCUESTAS' } } },
      ]},
      { key: 'salida', label: 'Salida', panels: [
        dailyLine('Llamadas de salida por dia', 'salida', 'llamadas_salida'),
        dailyLine('WhatsApp de salida por dia', 'salida', 'wpp_salida'),
      ]},
      { key: 'manager', label: 'Manager', panels: [
        { tipo: 'combo', titulo: 'Agendas Manager e incremento', barras: [{ label: 'Cantidad', fuente: serie('agendas_manager') }], linea: { label: '% Incremento', fuente: serie('agendas_manager', { transform: 'incremento' }) } },
        lineP('Errores de gestion por mes', 'errores_gestion'),
        { tipo: 'line', titulo: 'Historico de flujo', series: [
          { label: 'Llamadas', fuente: serie('hist_llamadas') },
          { label: 'WhatsApp', fuente: serie('hist_whatsapp') },
          { label: 'Total', fuente: serie('hist_llamadas', { formula: 'a+b', a: 'hist_llamadas', b: 'hist_whatsapp' }) },
        ]},
      ]},
      { key: 'sabados', label: 'Sabados', panels: [
        { tipo: 'line', titulo: 'Llamadas los sabados', series: [{ label: 'Llamadas', fuente: { s: 'sabados', modo: 'filas', x: 'fecha', campo: 'llamadas' } }] },
        { tipo: 'line', titulo: 'WhatsApp los sabados', series: [{ label: 'WhatsApp', fuente: { s: 'sabados', modo: 'filas', x: 'fecha', campo: 'whatsapp' } }] },
      ]},
      { key: 'calidad', label: 'Calidad', panels: [
        { tipo: 'calidad_kpis', campana: 'CLINICA AURORA' },
        { tipo: 'calidad_pie', campana: 'CLINICA AURORA', titulo: 'Distribucion de clasificacion' },
      ]},
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [
        { tipo: 'trafico_combo', campana: 'CLINICA AURORA' },
      ]},
    ],
  },
};

// ── HOSPITAL LA MARIA (dos sedes) ───────────────────────────
const hd = (titulo, campo, unidad) => ({
  tipo: 'line', titulo, unidad,
  series: [{ label: titulo, fuente: { s: 'dia', modo: 'filas', x: 'fecha', campo } }],
});

const HLM = {
  cliente: 'HOSPITAL LA MARIA',
  titulo: 'Dashboard Hospital La Maria',
  vista: {
    campo: 'sede',
    label: 'Sede',
    opciones: [
      { valor: 'CASTILLA', label: 'Sede Castilla' },
      { valor: 'SEDE33', label: 'Sede 33' },
    ],
  },
  secciones: SECCIONES['HOSPITAL LA MARIA'],
  layout: {
    kpis: [
      kpi('Llamadas Ingresadas', ultimo('llamadas_ingresadas'), 'miles'),
      kpi('Nivel Atencion Llamadas', ultimo('nivel_atencion'), 'porcentaje', { semaforo: 80 }),
      kpi('Llamadas Contestadas', ultimo('llamadas_contestadas'), 'miles'),
      kpi('Llamadas Abandonadas', ultimo('llamadas_abandonadas'), 'miles', { cls: 'kpi-red' }),
      kpi('WhatsApp Ingresados', ultimo('wpp_ingresados'), 'miles'),
      kpi('Agendas via WhatsApp', ultimo('agendas_wpp'), 'miles', { cls: 'kpi-pur' }),
      kpi('Agendas via Llamada', ultimo('agendas_llamada'), 'miles', { cls: 'kpi-pur' }),
      kpi('Total Agendas', { s: 'resumen', modo: 'ultimo', formula: 'a+b', a: 'agendas_wpp', b: 'agendas_llamada' }, 'miles', { cls: 'kpi-org' }),
      kpi('AHT Promedio', ultimo('aht_segundos'), 'tiempo_mmss', { cls: 'kpi-org' }),
    ],
    tabs: [
      { key: 'llamadas', label: 'Llamadas y WhatsApp', panels: [
        hd('Llamadas ingresadas por dia', 'llamadas_ingresadas'),
        hd('% Contestadas', 'pct_contestadas', '%'),
        hd('% Abandonadas', 'pct_abandonadas', '%'),
        hd('WhatsApp ingresados por dia', 'wpp_ingresados'),
      ]},
      { key: 'agendamiento', label: 'Agendamiento', panels: [
        hd('Agendas via WhatsApp', 'agendas_wpp'),
        hd('Agendas via llamada', 'agendas_llamada'),
        { tipo: 'line', titulo: 'AHT por dia (seg)', unidad: 'tiempo', series: [{ label: 'AHT (seg)', fuente: { s: 'dia', modo: 'filas', x: 'fecha', campo: 'aht_segundos' } }] },
      ]},
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion', fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' } },
      ]},
      { key: 'demanda', label: 'Demanda Insatisfecha', panels: [
        { tipo: 'bar', titulo: 'Llamadas IVR sin agenda', series: [{ label: 'Llamadas IVR', fuente: { s: 'demanda', modo: 'filas', x: 'categoria', campo: 'llamadas', filtro: { dimension: 'IVR' } } }] },
        { tipo: 'bar', titulo: 'Demanda por especialidad', series: [
          { label: 'Llamadas', fuente: { s: 'demanda', modo: 'filas', x: 'categoria', campo: 'llamadas', filtro: { dimension: 'ESPECIALIDAD' } } },
          { label: 'WhatsApp', fuente: { s: 'demanda', modo: 'filas', x: 'categoria', campo: 'whatsapp', filtro: { dimension: 'ESPECIALIDAD' } } },
        ]},
      ]},
      { key: 'entidades', label: 'Entidades', panels: [
        { tipo: 'pie', titulo: 'Flujo llamadas por entidad', fuente: { s: 'entidades', modo: 'filas', x: 'entidad', campo: 'cantidad', filtro: { canal: 'LLAMADA' } } },
        { tipo: 'pie', titulo: 'Flujo WhatsApp por entidad', fuente: { s: 'entidades', modo: 'filas', x: 'entidad', campo: 'cantidad', filtro: { canal: 'WPP' } } },
      ]},
    ],
  },
};

// M3 (Fase A2): 9 dashboards de cliente mas, por plantilla estandar de contact
// center. Se afinan desde el constructor visual, no aqui.
const { CONFIGS_CLIENTE } = require('./dashboard-plantillas-cliente');

const CONFIGS = [ORLANT, AURORA, HLM, ...CONFIGS_CLIENTE];

module.exports = { CONFIGS };
