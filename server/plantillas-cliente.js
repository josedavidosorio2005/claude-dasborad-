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
  { id: 'llamadas_unicas', nombre: 'Llamadas Únicas y de Salida', grupo: 'opcional', carga: 'Llamadas únicas + Llamadas de salida (Wolkvox)', disponibleParaNuevos: true },
  // Fase 196: mapas de calor por hora y dia (reporte de cola por hora de Wolkvox).
  { id: 'flujo_hora', nombre: 'Flujo por hora', grupo: 'opcional', carga: 'Flujo por hora (Wolkvox)', disponibleParaNuevos: true },
  { id: 'tipificacion', nombre: 'Tipificación', grupo: 'comun', carga: 'CDR / tipificación (Wolkvox)', disponibleParaNuevos: true },
  { id: 'encuesta', nombre: 'Encuesta', grupo: 'opcional', carga: 'HistIVR (Wolkvox)', disponibleParaNuevos: true },
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

function _subtabs(lista) {
  return lista.map(([key, label], i) => ({ key, label, indices: [i] }));
}

// Pestana por defecto de cada modulo (la de ORLANT, base de la plantilla
// segun el pedido de Edwin). `activos` es el conjunto de modulos del
// cliente (Agendas junta su panel con el de Efectividad de Agendamiento).
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
  calidad: (campana, activos) => ({
    key: 'calidad', label: 'Calidad',
    panels: [
      // Fase 172: con el modulo calidad_resumen, el resumen por asesor va primero.
      ...(activos && activos.has('calidad_resumen') ? [{ tipo: 'calidad_resumen_panel', campana }] : []),
      { tipo: 'calidad_kpis', campana },
      { tipo: 'calidad_pie', campana, titulo: 'Distribución de clasificación' },
      { tipo: 'calidad_bar_asesores', campana, titulo: 'Promedio de calidad por asesor' },
    ],
  }),
};

function _tabEspecifica(cliente, key) {
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
    const tab = GENERADORES[m.id](nombre, activos);
    if (!tab) continue;
    const aj = ajustes[m.id] || {};
    if (aj.key) tab.key = aj.key;
    if (aj.label) tab.label = aj.label;
    if (aj.sinPaneles) tab.panels = tab.panels.filter((p) => !aj.sinPaneles.includes(p.tipo));
    if (aj.panel) tab.panels = tab.panels.map((p) => Object.assign(p, JSON.parse(JSON.stringify(aj.panel))));
    // Mismo orden de claves que los layouts guardados: key, label, oculta, panels, subtabs.
    const ordenada = { key: tab.key, label: tab.label };
    if (!visibles.has(m.id)) ordenada.oculta = true;
    ordenada.panels = tab.panels;
    if (tab.subtabs) ordenada.subtabs = tab.subtabs;
    tabs.push(ordenada);
  }

  const esp = perfil.especificos || {};
  (esp.tabs || []).forEach((k) => tabs.push(_tabEspecifica(esp.de, k)));
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
    especificos: {
      de: 'ORLANT',
      tabs: ['ordenamiento_medico', 'recuperacion_cancelados', 'flujo', 'sta'],
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
          resumenOcultar: ['tasaAbandono', 'nivelServicio'],
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
      calidad: { sinPaneles: ['calidad_bar_asesores'] },
    },
  },
};

module.exports = {
  CATALOGO,
  BASE_CONTACT_CENTER,
  SECCION_VACIA,
  PERFILES_ACTUALES,
  generarLayout,
};
