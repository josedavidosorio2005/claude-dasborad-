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
      kpi('Nivel Atencion 3P', ultimo('nivel_atencion_3p'), 'porcentaje', { semaforo: 90, metrica: 'nivel_atencion' }),
      kpi('WhatsApp 3P', ultimo('wpp_3p'), 'miles'),
      kpi('Nivel Atencion WPP 3P', ultimo('nivel_atencion_wpp_3p'), 'porcentaje', { semaforo: 90, metrica: 'nivel_atencion' }),
      kpi('Llamadas Linea General', ultimo('llamadas_general'), 'miles'),
      kpi('Nivel Atencion L.General', ultimo('nivel_atencion_general'), 'porcentaje', { semaforo: 90, metrica: 'nivel_atencion' }),
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
      // Salida (graficas 4-7 del PDF de InCo, 2026-09-18): el PDF sugiere
      // "pueden ir integradas... y se puede mirar cada linea por medio de un
      // filtro" en vez de 4 graficas separadas — filtroSerie (dashboard-
      // generic.js) hace exactamente eso: una grafica, un selector de Linea
      // General/3P, "Total: N" de la linea que se este viendo. Reemplaza los
      // 4 paneles anteriores (misma fuente/campos, solo cambia la
      // presentacion — ver PROGRESS.md de esta fase).
      { key: 'salida', label: 'Salida', panels: [
        { tipo: 'line', titulo: 'Llamadas de salida', filtroSerie: true, series: [
          { label: 'Linea General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_general' } },
          { label: 'Linea 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_3p' } },
        ]},
        { tipo: 'line', titulo: 'WhatsApp de salida', filtroSerie: true, series: [
          { label: 'Linea General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_general' } },
          { label: 'Linea 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_3p' } },
        ]},
      ]},
      // Tipificacion (graficas 8-9): 1 pie filtrable por linea (filtroCampo,
      // dashboard-generic.js) en vez de 2 pies fijos — misma fuente/campos.
      // filtroUnico:true -> UNA sola linea a la vez (selector, igual que
      // Salida), no un multi-select de categorias: 3P y General comparten
      // nombres de tipificacion (Agendamiento, Informacion general, …), asi
      // que combinarlas sin filtroUnico duplicaba cada categoria en la
      // leyenda (bug real encontrado en la verificacion con InCo,
      // 2026-09-18) — el usuario ve una linea limpia a la vez, sin
      // duplicados, y cambia de linea con el mismo patron que ya conoce de
      // Salida.
      // El glosario son SOLO los 2 codigos que el propio PDF explica en
      // prosa (INFORMACION_3P / INFORMACION_SECRETARIA); el resto de
      // categorias no se inventan — confirmar contra el archivo real cuando
      // se cargue (puede traer categorias mas finas o distintas).
      { key: 'tipificacion', label: 'Tipificacion', panels: [
        { tipo: 'pie', titulo: 'Tipificacion de llamadas y WhatsApp', filtroCampo: 'linea', filtroUnico: true,
          fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' },
          notas: [
            'Glosario basado en el PDF de InCo — confirmar contra las categorias reales que traiga el archivo de tipificacion cuando se cargue (pueden variar).',
            'INFORMACION_3P: el paciente solicita informacion sobre polizas, tarifas o examenes.',
            'INFORMACION_SECRETARIA: se necesita una cita de revision y no ha sido posible comunicarse con la secretaria; tambien pagos o programacion de cirugia que requieren secretaria.',
          ] },
      ]},
      { key: 'agendamiento', label: 'Agendamiento', panels: [
        { tipo: 'combo', titulo: 'Ordenamiento medico', barras: [
          { label: 'Gestionados', fuente: serie('ordmed_gestionados') },
          { label: 'Agendas', fuente: serie('ordmed_agendas') }],
          linea: { label: '% Efectividad', fuente: pctFormula('ordmed_agendas', 'ordmed_gestionados') } },
        // Grafica 10 del PDF: KPI anual con texto explicativo (nota_kpi,
        // dashboard-generic.js — modo:'anual' suma el campo en todas las
        // cargas del año, no solo el ultimo mes).
        { tipo: 'nota_kpi', titulo: 'Efectividad del año — Ordenamiento medico 3P',
          valores: [
            { clave: 'gestionados', fuente: { s: 'resumen', modo: 'anual', campo: 'ordmed_gestionados' } },
            { clave: 'agendados', fuente: { s: 'resumen', modo: 'anual', campo: 'ordmed_agendas' } },
          ],
          formula: { clave: 'efectividad', a: 'agendados', b: 'gestionados' },
          plantilla: 'De la estrategia de agendamiento por ordenamiento medico en consulta medica, se han gestionado un total de {gestionados} pacientes, de los cuales se han logrado agendar {agendados} — efectividad del año: {efectividad}%.' },
        { tipo: 'combo', titulo: 'Recuperacion de cancelados', barras: [
          { label: 'Cancelado', fuente: serie('recup_cancelado') },
          { label: 'Atendido', fuente: serie('recup_atendido') }],
          linea: { label: '% Efectividad', fuente: pctFormula('recup_atendido', 'recup_cancelado') } },
        // Grafica 11: 2 lineas (antes barras — mismo dato, formato del PDF)
        // + variacion % mes a mes (transform:'incremento', ya existia en el
        // motor — lo usa Aurora en "Agendas Manager e incremento").
        lineP('Total agendas por mes', 'total_agendas'),
        { tipo: 'line', titulo: 'Agendas por linea', series: [
          { label: 'Linea General', fuente: serie('agendas_general') },
          { label: 'Linea 3P', fuente: serie('agendas_3p') }] },
        { tipo: 'line', titulo: 'Total agendas — variacion % mes a mes', unidad: '%', series: [
          { label: '% Variacion', fuente: serie('total_agendas', { transform: 'incremento' }) }] },
      ]},
      { key: 'inasistencia', label: 'Inasistencia', panels: [
        lineP('% Inasistencia Audifonos', 'inasist_audifonos', { unidad: '%' }),
        lineP('% Inasistencia Audiologia', 'inasist_audiologia', { unidad: '%' }),
        lineP('% Inasistencia Examenes', 'inasist_examenes', { unidad: '%' }),
        lineP('% Inasistencia Total', 'inasist_total', { unidad: '%' }),
      ]},
      { key: 'sta', label: 'Gestion STA', panels: [
        // Graficas 14-15: agregado ANUAL (f.anual, no solo el ultimo mes
        // cargado) + % del total en cada barra (pctDeTotal -> loBarPct,
        // charts.js), tal como las dibuja el PDF.
        { tipo: 'bar', titulo: 'Ordenes por servicio (año)', horizontal: true, pctDeTotal: true, series: [
          { label: 'Ordenes', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'SERVICIO' }, anual: true } }] },
        { tipo: 'bar', titulo: 'Estado de ordenes cargadas al STA (año)', horizontal: true, pctDeTotal: true,
          series: [{ label: 'Ordenes', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'ESTADO' }, anual: true } }],
          notas: ['No incluye Cirugia, Pre-revisado de cirugia, Procedimiento menor ni Otros servicios — esos se gestionan aparte.'] },
        // Grafica 13: se agrega la barra "Agendada" (sta_agendadas ya
        // existia en el esquema, opcional, sin usar en ningun panel).
        { tipo: 'combo', titulo: 'STA por mes', barras: [
          { label: 'Ordenes Cargadas', fuente: serie('sta_ordenes') },
          { label: 'Agendada', fuente: serie('sta_agendadas') },
          { label: 'Facturado + Cumplida', fuente: serie('sta_factcump') }],
          linea: { label: '% Efectividad', fuente: pctFormula('sta_factcump', 'sta_ordenes') } },
        // Grafica 16: ya era exactamente esto, solo se renombra el titulo.
        { tipo: 'combo', titulo: 'Servicios gestionados del STA del mes', barras: [
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
      kpi('Nivel Atencion', ultimo('nivel_atencion'), 'porcentaje', { semaforo: 90, metrica: 'nivel_atencion', meta: 90, alerta: { min: 85 } }),
      kpi('Abandonos', ultimo('abandonos'), 'entero', { cls: 'kpi-red', mejorDireccion: 'baja' }),
      kpi('AHT Promedio', ultimo('aht_segundos'), 'tiempo_mmss', { cls: 'kpi-org', mejorDireccion: 'baja' }),
      kpi('WhatsApp Entrada', ultimo('hist_whatsapp'), 'miles'),
      kpi('Nivel Ate. WPP', ultimo('nivel_atencion_wpp'), 'porcentaje', { cls: 'kpi-green', metrica: 'nivel_atencion' }),
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
      kpi('Nivel Atencion Llamadas', ultimo('nivel_atencion'), 'porcentaje', { semaforo: 80, metrica: 'nivel_atencion' }),
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
      // Sin "campana" fija: el panel trafico_combo carga TODO el trafico de
      // "HOSPITAL LA MARIA" (una sola campana) y filtra client-side por sede
      // usando la misma vista de arriba (vistaSel = 'CASTILLA'/'SEDE33', ver
      // _traficoRenderPanel en public/js/trafico.js) — el mapeo de skills de
      // Volvox asigna cada skill a la campana "HOSPITAL LA MARIA" + su sede
      // (campo `sede` en trafico_skill_mapeo), nunca a una campana distinta
      // por sede. Ver docs/ARQUITECTURA.md.
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [
        { tipo: 'trafico_combo' },
      ]},
    ],
  },
};

// M3 (Fase A2): 9 dashboards de cliente mas, por plantilla estandar de contact
// center. Se afinan desde el constructor visual, no aqui.
const { CONFIGS_CLIENTE } = require('./dashboard-plantillas-cliente');

const CONFIGS = [ORLANT, AURORA, HLM, ...CONFIGS_CLIENTE];

module.exports = { CONFIGS };
