// plantillas-cliente.js — Fase 153 (Paso 3 de docs/plantillas-cliente.md):
// catalogo de modulos y generador del layout de un cliente desde sus
// modulos (plantilla base "Contact center").
//
// Solo GENERA un layout; no escribe nada en la base. Los layouts de ORLANT
// y MOBILIZE que ya existen NO se reemplazan: la prueba de "foto"
// (fase153-plantillas-cliente.test.js) exige que el layout generado con su
// perfil (PERFILES_ACTUALES) sea IGUAL al que hoy tienen tras todas las
// migraciones. La creacion de clientes desde la plantilla (Paso 4) espera
// las respuestas de Edwin y el OK del usuario.
//
// Reglas de la plantilla:
//  - Las pestanas salen en el orden del catalogo; Calidad siempre al final
//    (Fase 147). Los especificos de un cliente van despues.
//  - Toda pestana empieza oculta salvo las que el perfil lista en
//    `visibles` (un cliente nuevo: todas ocultas hasta cargar datos).
//  - `ajustes` por modulo cambian la pestana (key/label), agregan opciones
//    a su panel (`panel`) o quitan paneles (`sinPaneles`). Es como ORLANT y
//    MOBILIZE conservan sus diferencias sin tocar la plantilla comun.
//  - Los especificos (pestanas manuales de ORLANT y sus secciones de carga)
//    no se generalizan: se toman tal cual de dashboard-config-seed.js.
'use strict';

const { CONFIGS } = require('./dashboard-config-seed');

// grupo: 'comun' (todo cliente), 'opcional', 'salud'.
// disponibleParaNuevos: false si hoy depende de algo propio de un cliente.
const CATALOGO = [
  { id: 'flujo_llamadas', nombre: 'Flujo de Llamadas', grupo: 'comun', carga: 'Tráfico de Llamadas (Wolkvox)', disponibleParaNuevos: true },
  { id: 'flujo_whatsapp', nombre: 'Flujo de WhatsApp', grupo: 'comun', carga: 'Tráfico de WhatsApp (Wolkvox)', disponibleParaNuevos: true },
  // Fase 172: sub-vista de Calidad (panel al inicio de su pestaña).
  { id: 'calidad_resumen', nombre: 'Calidad: resumen por asesor', grupo: 'opcional', carga: 'Resumen de calidad por asesor (plantilla de Edwin)', requiere: 'calidad', subVista: true, disponibleParaNuevos: true },
  { id: 'whatsapp_tiempos', nombre: 'WhatsApp por rangos de tiempo', grupo: 'opcional', carga: 'Tiempos de respuesta de WhatsApp (Wolkvox)', requiere: 'flujo_whatsapp', subVista: true, disponibleParaNuevos: true },
  // Salida lee la hoja manual "salida" de ORLANT (lineas 3P / General): hasta
  // generalizarla, no se ofrece a clientes nuevos.
  { id: 'salida', nombre: 'Llamadas y WhatsApp de salida', grupo: 'opcional', carga: 'Hoja "salida" de la carga manual', disponibleParaNuevos: false },
  { id: 'agendas', nombre: 'Agendas', grupo: 'salud', carga: 'AGENDAS (Wolkvox)', disponibleParaNuevos: true },
  { id: 'efectividad_agendamiento', nombre: 'Efectividad de Agendamiento', grupo: 'salud', carga: 'Efectividad por asesor', disponibleParaNuevos: true },
  { id: 'inasistencia', nombre: 'Inasistencia', grupo: 'salud', carga: 'Inasistencia', disponibleParaNuevos: true },
  { id: 'efectividad_citas', nombre: 'Efectividad de Citas', grupo: 'salud', carga: 'Citas atendidas', disponibleParaNuevos: true },
  // Fase 259 (Clinica Aurora): reporte de citas del sistema de la clinica, agregado en el navegador.
  { id: 'agendas_usuaria', nombre: 'Agendas (3 bases)', grupo: 'salud', carga: '3 bases de la clínica: citas, cancelaciones e inasistencias (.xls)', disponibleParaNuevos: true }, // Fase 303
  // Fase 306 (Clinica Aurora): Inasistencia (% por especialidad) y Encuestas (por entidad y fecha).
  // Nombres con «(Aurora)» para no confundirlos con Inasistencia de ORLANT y Encuesta de Mobilize.
  { id: 'inasistencia_au', nombre: 'Inasistencia (Aurora)', grupo: 'salud', carga: 'Base para sacar inasistencias de la clínica (.xls)', disponibleParaNuevos: false, siempreVisible: true },
  { id: 'encuestas_au', nombre: 'Encuestas (Aurora)', grupo: 'salud', carga: 'Compilado de encuestas de la clínica (.xlsx)', disponibleParaNuevos: false, siempreVisible: true },
  // Fase 284: errores de agendamiento; no se cargan con una base, los registra el supervisor en la plataforma.
  // siempreVisible: la pestaña se ve aunque no haya errores (avisa que no hay).
  { id: 'errores', nombre: 'Errores', grupo: 'salud', carga: 'Se registran en la plataforma (supervisor o administrador)', disponibleParaNuevos: true, siempreVisible: true },
  { id: 'llamadas_unicas', nombre: 'Llamadas Únicas y de Salida', grupo: 'opcional', carga: 'Llamadas únicas + Llamadas de salida (Wolkvox)', disponibleParaNuevos: true },
  // Fase 196: mapas de calor por hora y dia (reporte de cola por hora de Wolkvox).
  { id: 'flujo_hora', nombre: 'Flujo por hora', grupo: 'opcional', carga: 'Flujo por hora (Wolkvox)', disponibleParaNuevos: true },
  { id: 'tipificacion', nombre: 'Tipificación', grupo: 'comun', carga: 'CDR / tipificación (Wolkvox)', disponibleParaNuevos: true },
  { id: 'encuesta', nombre: 'Encuesta', grupo: 'opcional', carga: 'HistIVR (Wolkvox)', disponibleParaNuevos: true },
  // Fase 311 (Clinica Aurora): «Gestión líneas internas» -- una sola pestaña (la de
  // flujo_li) con las 3 graficas; cdr_li y whatsapp_li solo son tipos de carga.
  { id: 'flujo_li', nombre: 'Flujo líneas internas', grupo: 'salud', carga: 'HistQueue de Wolkvox de las líneas internas (.xlsx)', disponibleParaNuevos: false, siempreVisible: true },
  { id: 'cdr_li', nombre: 'CDR líneas internas', grupo: 'salud', carga: 'HistCDR de Wolkvox de las líneas internas (.xlsx)', disponibleParaNuevos: false, siempreVisible: true },
  { id: 'whatsapp_li', nombre: 'WhatsApp líneas internas', grupo: 'salud', carga: 'HistChat de Wolkvox de las líneas internas (.xlsx)', disponibleParaNuevos: false, siempreVisible: true },
  { id: 'calidad', nombre: 'Calidad', grupo: 'comun', carga: 'Monitoreos + plantilla de evaluación del cliente', disponibleParaNuevos: true },
];
const IDS = CATALOGO.map((m) => m.id);

// Modulos que siempre lleva la plantilla base "Contact center".
const BASE_CONTACT_CENTER = ['flujo_llamadas', 'flujo_whatsapp', 'tipificacion', 'calidad'];

// Seccion de carga manual minima (placeholder tecnico) para un cliente sin
// carga manual -- la misma que ya usa MOBILIZE.
const SECCION_VACIA = {
  titulo: 'Notas (sin uso)',
  descripcion: 'Placeholder tecnico -- Mobilize no tiene carga manual, todo sale de Trafico/Calidad.',
  cadencia: 'mensual',
  periodo: 'mes',
  filaUnica: true,
  columnas: [{ key: 'nota', label: 'Nota', tipo: 'texto' }],
};

// Fase 265: vistas de "Agendas por usuaria" (Clinica Aurora), en el orden de Edwin.
const AGENDAS_USUARIA_VISTAS = [['mes', 'Agendas por mes'], ['especialidad', 'Agendas por especialidad'], ['asesor', 'Agendas por asesor']];

function _subtabs(lista) {
  return lista.map(([key, label], i) => ({ key, label, indices: [i] }));
}

// Pestana por defecto de cada modulo (la de ORLANT, base de la plantilla
// segun el pedido de Edwin). `activos` es el conjunto de modulos del
// cliente (Agendas junta su panel con el de Efectividad de Agendamiento).
// Fase 311: pestaña «Gestión líneas internas» de Aurora (3 graficas, una debajo de otra).
function lineasInternasTab(campana) {
  return {
    key: 'lineas_internas', label: 'Gestión líneas internas',
    panels: [
      { tipo: 'aurora_li_flujo_panel', campana, titulo: 'Flujo WhatsApp de entrada' }, // Fase 320 (Edwin): es WhatsApp, no llamadas
      { tipo: 'aurora_li_cdr_panel', campana, titulo: 'CDR llamadas' },
      { tipo: 'aurora_li_whatsapp_panel', campana, titulo: 'WhatsApp' },
    ],
  };
}

const GENERADORES = {
  flujo_llamadas: (campana) => ({
    key: 'trafico', label: 'Tráfico de Llamadas',
    panels: [{ tipo: 'trafico_combo', campana }],
  }),
  flujo_whatsapp: (campana) => ({
    key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp',
    panels: [{ tipo: 'trafico_whatsapp_combo', campana, mostrarAht: false, mostrarSL5min: false }],
  }),
  whatsapp_tiempos: () => null, // sub-vista de WhatsApp: sin pestana propia
  flujo_hora: (campana) => ({ // Fase 196
    key: 'flujo_hora', label: 'Flujo por hora',
    panels: [{ tipo: 'flujo_hora_panel', campana }],
  }),
  calidad_resumen: () => null, // Fase 172: sub-vista de Calidad (panel en esa pestaña)
  salida: (campana) => ({
    key: 'salida', label: 'Llamadas y WhatsApp de salida',
    panels: [{ tipo: 'salida_panel', campana, titulo: 'Llamadas y WhatsApp de salida' }],
  }),
  agendas: (campana, activos) => {
    const panels = [
      { tipo: 'agendas_panel', vista: 'especialidad', titulo: 'Agendas por Especialidad', campana },
      { tipo: 'agendas_panel', vista: 'mensual', titulo: 'Total de Agendas por Mes', campana },
      { tipo: 'agendas_panel', vista: 'linea', titulo: 'Agendas por Línea', campana },
    ];
    const subs = [['porespecialidad', 'Por especialidad'], ['totalagendas', 'Total agendas'], ['agendasporlinea', 'Agendas por línea']];
    if (activos.has('efectividad_agendamiento')) {
      panels.push({ tipo: 'efectividad_agendamiento_panel', titulo: 'Ranking de Asesores', campana });
      subs.push(['rankingasesores', 'Ranking de asesores']);
    }
    return { key: 'agendamiento', label: 'Agendamiento', panels, subtabs: _subtabs(subs) };
  },
  efectividad_agendamiento: (campana, activos) => (activos.has('agendas') ? null : {
    key: 'agendamiento', label: 'Agendamiento',
    panels: [{ tipo: 'efectividad_agendamiento_panel', titulo: 'Ranking de Asesores', campana }],
  }),
  inasistencia: (campana) => ({
    key: 'inasistencia', label: 'Inasistencia',
    panels: [
      { tipo: 'inasistencia_panel', vista: 'pormes', titulo: 'Inasistencia por Mes', campana },
      { tipo: 'inasistencia_panel', vista: 'porespecialidad', titulo: 'Inasistencia por Especialidad', campana },
    ],
    subtabs: _subtabs([['pormes', 'Resumen por mes'], ['porespecialidad', 'Por especialidad']]),
  }),
  efectividad_citas: (campana) => ({
    key: 'efectividad', label: 'Efectividad de Citas',
    panels: [{ tipo: 'efectividad_citas_panel', titulo: 'Efectividad de Citas', campana }],
  }),
  // Fase 259; Fase 265: 3 vistas; Fase 302: «Agendas», una sola vista (filtros +
  // 2 graficas) con las 3 bases. La migracion fase302 lleva a esta misma forma la
  // pestaña de 3 vistas que ya existe en produccion.
  agendas_usuaria: (campana) => ({
    key: 'agendas_usuaria', label: 'Agendas',
    panels: [{ tipo: 'agendas_usuaria_panel', campana, vista: 'agendas', titulo: 'Agendas' }],
  }),
  // Fase 306 (Aurora).
  inasistencia_au: (campana) => ({
    key: 'inasistencia_au', label: 'Inasistencia',
    panels: [{ tipo: 'aurora_inasistencia_panel', campana, titulo: 'Inasistencia por especialidad' }],
  }),
  encuestas_au: (campana) => ({
    key: 'encuestas_au', label: 'Encuestas',
    panels: [{ tipo: 'aurora_encuestas_panel', campana, titulo: 'Encuestas' }],
  }),
  // Fase 311 (Aurora): la pestaña sale de flujo_li; los otros 2 solo son cargas.
  flujo_li: (campana) => lineasInternasTab(campana),
  cdr_li: () => null,
  whatsapp_li: () => null,
  // Fase 284: visible aunque no haya errores (la pestaña lo avisa).
  errores: (campana) => ({
    key: 'errores', label: 'Errores',
    panels: [{ tipo: 'errores_panel', campana, titulo: 'Errores de agendamiento' }],
  }),
  llamadas_unicas: (campana) => ({
    key: 'llamadas_unicas', label: 'Llamadas Únicas y de Salida',
    panels: [{ tipo: 'llamadas_unicas_panel', campana }],
  }),
  // Fase 168: con Flujo de WhatsApp (ORLANT), Tipificacion lleva las 2 mitades
  // (CDR de llamadas y de WhatsApp) sin la tabla de detalle; sin WhatsApp
  // (Mobilize), solo llamadas con la tabla, como desde la Fase 138.
  tipificacion: (campana, activos) => ({
    key: 'tipificacion', label: 'Tipificación',
    panels: [activos && activos.has('flujo_whatsapp')
      ? { tipo: 'tipificacion_panel', titulo: 'Tipificación', campana, mostrarFiltroTipo: true, mostrarTarjetasSalida: true }
      : { tipo: 'tipificacion_panel', titulo: 'Tipificación', campana, soloCanal: 'LLAMADAS', mostrarFiltroTipo: true, mostrarTablaDetalle: true, mostrarTarjetasSalida: true }],
  }),
  encuesta: (campana) => ({
    key: 'encuesta', label: 'Encuesta',
    panels: [{ tipo: 'encuesta_panel', campana }],
  }),
  // Fase 269 (pedido de Edwin, 05/11): la pestaña Calidad muestra solo
  // "Resultado de los monitoreos" (lo que se califica en la plataforma), igual
  // en todo cliente. Lo de antes (resumen subido en Cargar datos, indicadores,
  // torta y barras) queda solo con el ajuste `clasica` (hoy ORLANT, mientras
  // el usuario decide). Los datos viejos no se borran: solo no se muestran.
  calidad: (campana, activos, aj) => ({
    key: 'calidad', label: 'Calidad',
    panels: (aj && aj.clasica)
      ? [
        // Fase 332 (reporte del supervisor): los 3 de antes quedan ocultos por configuracion
        // (no se borran); se ve solo «Resultado de los monitoreos».
        { tipo: 'calidad_kpis', campana, oculto: true },
        { tipo: 'calidad_pie', campana, titulo: 'Distribución de clasificación', oculto: true },
        { tipo: 'calidad_bar_asesores', campana, titulo: 'Promedio de calidad por asesor', oculto: true },
        { tipo: 'calidad_monitoreos_panel', campana }, // Fase 307: + lo que califican los lideres (como Mobilize)
      ]
      : [{ tipo: 'calidad_monitoreos_panel', campana }],
  }),
};

// Fase 219: pestañas especificas que no estan en la semilla (las migraciones
// viejas de ORLANT comparan la semilla exacta). La misma forma la usa la
// migracion fase219_total_trafico_v1 (db.js).
// despuesDe: la pestaña va justo despues de esa (si existe); si no, al final.
const TABS_EXTRA = {
  total_trafico: {
    despuesDe: 'salida',
    crear: (cliente) => ({ key: 'total_trafico', label: 'Total tráfico', panels: [{ tipo: 'total_trafico_panel', campana: cliente, titulo: 'Total tráfico' }] }),
  },
};
function _tabEspecifica(cliente, key) {
  if (TABS_EXTRA[key]) return TABS_EXTRA[key].crear(cliente);
  const cfg = CONFIGS.find((c) => c.cliente === cliente);
  const tab = cfg && cfg.layout.tabs.find((t) => t.key === key);
  if (!tab) throw new Error(`Pestaña específica desconocida: ${cliente}/${key}`);
  return JSON.parse(JSON.stringify(tab));
}
function _seccionEspecifica(cliente, key) {
  const cfg = CONFIGS.find((c) => c.cliente === cliente);
  const sec = cfg && cfg.secciones[key];
  if (!sec) throw new Error(`Sección específica desconocida: ${cliente}/${key}`);
  return JSON.parse(JSON.stringify(sec));
}

// Arma { titulo, vista, secciones, layout } para un cliente.
//   perfil = { nombre, titulo?, modulos, visibles?, ajustes?, especificos? }
//   especificos = { de: 'CLIENTE', tabs: [keys], secciones: [keys] }
function generarLayout(perfil) {
  const nombre = String(perfil && perfil.nombre || '').trim();
  if (!nombre) throw new Error('Falta el nombre del cliente');
  const modulos = perfil.modulos || [];
  modulos.forEach((m) => {
    if (!IDS.includes(m)) throw new Error('Módulo desconocido: ' + m);
  });
  const activos = new Set(modulos);
  CATALOGO.forEach((m) => {
    if (m.requiere && activos.has(m.id) && !activos.has(m.requiere)) {
      throw new Error(`${m.nombre} necesita ${m.requiere}`);
    }
  });
  const visibles = new Set(perfil.visibles || []);
  const ajustes = perfil.ajustes || {};

  const tabs = [];
  for (const m of CATALOGO) {
    if (!activos.has(m.id)) continue;
    const aj = ajustes[m.id] || {};
    const tab = GENERADORES[m.id](nombre, activos, aj);
    if (!tab) continue;
    if (aj.key) tab.key = aj.key;
    if (aj.label) tab.label = aj.label;
    if (aj.sinPaneles) tab.panels = tab.panels.filter((p) => !aj.sinPaneles.includes(p.tipo));
    if (aj.panel) tab.panels = tab.panels.map((p) => Object.assign(p, JSON.parse(JSON.stringify(aj.panel))));
    // Mismo orden de claves que los layouts guardados: key, label, oculta, panels, subtabs.
    const ordenada = { key: tab.key, label: tab.label };
    if (!visibles.has(m.id) && !m.siempreVisible) ordenada.oculta = true; // Fase 284: siempreVisible (Errores)
    ordenada.panels = tab.panels;
    if (tab.subtabs) ordenada.subtabs = tab.subtabs;
    tabs.push(ordenada);
  }

  const esp = perfil.especificos || {};
  (esp.tabs || []).forEach((k) => {
    const tab = _tabEspecifica(esp.de, k);
    const i = TABS_EXTRA[k] ? tabs.findIndex((t) => t.key === TABS_EXTRA[k].despuesDe) : -1;
    if (i !== -1) tabs.splice(i + 1, 0, tab); else tabs.push(tab);
  });
  const secciones = {};
  (esp.secciones || []).forEach((k) => { secciones[k] = _seccionEspecifica(esp.de, k); });
  if (!Object.keys(secciones).length) secciones.notas = JSON.parse(JSON.stringify(SECCION_VACIA));

  return {
    titulo: perfil.titulo || 'Dashboard ' + nombre,
    vista: null,
    secciones,
    layout: { kpis: [], tabs },
  };
}

// Perfil con el que la plantilla reproduce EXACTO el layout que ORLANT y
// MOBILIZE ya tienen (prueba de "foto"). Sus modulos deben coincidir con el
// registro de clientes (clientes-registro.js).
const PERFILES_ACTUALES = {
  ORLANT: {
    nombre: 'ORLANT',
    titulo: 'Dashboard Clínica Orlant',
    modulos: ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'tipificacion', 'calidad',
      'agendas', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas', 'salida'],
    visibles: ['flujo_llamadas', 'flujo_whatsapp', 'calidad'],
    ajustes: {
      flujo_llamadas: { panel: { etiquetaTotal: 'Llamadas ingresadas' } }, // Fase 206
      calidad: { clasica: true }, // Fase 262/269: ORLANT sigue con su pestaña Calidad de siempre (pendiente de decision)
    },
    especificos: {
      de: 'ORLANT',
      // Fase 219: Total tráfico (sin carga propia: sale de lo ya cargado), justo
      // despues de "Llamadas y WhatsApp de salida" (TABS_EXTRA), igual que la
      // migracion fase219_total_trafico_v1 en produccion.
      tabs: ['ordenamiento_medico', 'recuperacion_cancelados', 'flujo', 'sta', 'total_trafico'],
      secciones: ['resumen', 'salida', 'tipificacion', 'sta_categorias'],
    },
  },
  MOBILIZE: {
    nombre: 'MOBILIZE',
    titulo: 'Dashboard Mobilize',
    modulos: ['flujo_llamadas', 'tipificacion', 'calidad', 'calidad_resumen', 'llamadas_unicas', 'flujo_hora', 'encuesta'],
    visibles: ['flujo_llamadas', 'llamadas_unicas', 'flujo_hora', 'encuesta', 'calidad'],
    ajustes: {
      flujo_llamadas: {
        key: 'flujo',
        label: 'Flujo de Llamadas',
        panel: {
          etiquetaLinea: 'Tipo de línea',
          etiquetaLineaPlural: 'líneas',
          etiquetaTotal: 'Llamadas ingresadas', // Fase 204
          // Fase 227 (pedido de Edwin, 03/11): Tasa de abandono y Eficacia en el resumen.
          // Fase 248: mismo orden que ORLANT (TRAFICO_ORDEN_TARJETAS_LLAMADAS) y al
          // final Eficacia (FCR sigue al final, despues de Eficacia).
          resumenOrden: ['total', 'contestadas', 'abandonadas', 'nivelServicio', 'nivelAtencion', 'tasaAbandono', 'eficacia'],
          eficaciaEnResumen: true,
          // Fase 231 (pedido de Edwin, 04/11): en la fila del resumen, solo la cifra y
          // el titulo de cada tarjeta (sin "?", variacion ni meta; el color se queda).
          resumenSoloTitulos: true,
          resumenPorSeccion: true,
          subtabs: [
            { key: 'resumen', label: 'Resumen' },
            { key: 'sl', label: 'Nivel de Servicio' },
            { key: 'abandono', label: 'Abandono' },
            { key: 'asaata', label: 'ASA y ATA' },
            { key: 'aht', label: 'AHT' },
            { key: 'oneanddone', label: 'One & Done' },
            { key: 'eficacia', label: 'Eficacia' },
          ],
          subtabsTitulos: { sl: 'Nivel de Servicio 80 - 20' },
          fcrBase: 'empezaron',
        },
      },
    },
  },
};

module.exports = {
  CATALOGO,
  BASE_CONTACT_CENTER,
  SECCION_VACIA,
  PERFILES_ACTUALES,
  generarLayout,
  TABS_EXTRA,
  AGENDAS_USUARIA_VISTAS,
  lineasInternasTab, // Fase 311
};
