// scripts/plantillas/modulos.js — Fase 153 (P1, reunion con Edwin del
// 16/10/2026): una plantilla de carga por modulo, en archivos separados.
//
// Unica fuente para:
//   - el generador de las plantillas (scripts/plantillas/generar-plantillas.js
//     -> server/plantillas/PLANTILLA_<MODULO>.xlsx);
//   - las fichas (docs/plantillas/<modulo>.md);
//   - la prueba server/tests/fase153-plantillas-modulos.test.js.
//
// Las COLUMNAS no se escriben aqui: salen del mismo arreglo que usa el
// lector de cada modulo en public/js/*-logic.js (`fuente`), asi la plantilla
// nunca puede pedir algo distinto de lo que el sistema lee. Aqui solo va lo
// que el lector no sabe: el archivo, la hoja, que significa cada columna y
// un ejemplo INVENTADO (nunca datos reales).
//
// `modulo` es el id del catalogo de server/plantillas-cliente.js (Paso 3).
'use strict';

const CARGAS = [
  // ── Mobilize ──────────────────────────────────────────────────────────
  {
    modulo: 'flujo_llamadas',
    carga: 'Flujo de Llamadas',
    archivo: 'PLANTILLA_FLUJO_LLAMADAS.xlsx',
    hoja: 'LLAMADAS',
    fuente: { js: 'trafico-logic.js', variable: 'TRAFICO_COLUMNAS' },
    columnas: {
      SKILL_NAME: ['Línea o skill de Wolkvox (Mobilize: "TIPO DE LINEA").', 'SKILL SAC'],
      DATE: ['Día (Mobilize: "DÍA").', '2026-08-01'],
      'TOTAL LLAMADAS': ['Llamadas que entraron a la cola ese día (Mobilize: "LLAMADAS INGRESADAS").', 120],
      'LLAMADAS CONTESTADAS': ['Llamadas atendidas.', 112],
      'LLAMADAS ABANDONADAS': ['Llamadas que colgaron antes de ser atendidas.', 8],
      SERVICE_LEVEL_10SEC: ['% atendidas en 10 s.', 0.85],
      SERVICE_LEVEL_20SEC: ['% atendidas en 20 s (Mobilize: "NIVEL DE SERVICIO 80 - 20").', 0.9],
      SERVICE_LEVEL_30SEC: ['% atendidas en 30 s.', 0.93],
      ASA: ['Tiempo promedio de respuesta (segundos o mm:ss).', 12],
      ATA: ['Tiempo promedio hasta el abandono.', 30],
      WAIT_TIME: ['Tiempo de espera.', 15],
      AHT: ['Tiempo promedio de atención.', 210],
      'NIVEL DE ATENCION': ['% de llamadas atendidas.', 0.93],
      'TASA DE ABNDONO': ['% de abandono (así viene escrito de Wolkvox; Mobilize: "% ABANDONO").', 0.07],
    },
  },
  {
    modulo: 'llamadas_unicas',
    carga: 'Llamadas Únicas (ingreso)',
    archivo: 'PLANTILLA_LLAMADAS_UNICAS.xlsx',
    hoja: 'LLAMADAS_UNICAS',
    fuente: { js: 'llamadas-unicas-logic.js', variable: 'LLAMADAS_UNICAS_COLUMNAS' },
    columnas: {
      AGENT_NAME: ['Asesor que atendió.', 'Asesor Ejemplo Uno'],
      DATE: ['Fecha de la llamada.', '2026-08-01'],
      TELEPHONE: ['Número que llamó. Solo se usa en el navegador para contar una vez por día; nunca se envía ni se guarda.', '3000000000'],
      SKILL_NAME: ['Línea o skill.', 'SKILL SAC'],
    },
  },
  {
    modulo: 'llamadas_unicas',
    carga: 'Llamadas de Salida',
    archivo: 'PLANTILLA_LLAMADAS_SALIDA.xlsx',
    hoja: 'LLAMADAS_SALIDA',
    fuente: { js: 'llamadas-salida-logic.js', variable: 'LLAMADAS_SALIDA_COLUMNAS' },
    columnas: {
      AGENT_NAME: ['Asesor que hizo la llamada.', 'Asesor Ejemplo Uno'],
      DATE: ['Fecha de la llamada.', '2026-08-01'],
      TELEPHONE: ['Número llamado. Solo se usa en el navegador; nunca se envía ni se guarda.', '3000000001'],
      DESCRIPTION_COD_ACT: ['Tipificación de la llamada.', 'Seguimiento'],
      SKILL_ID: ['"LLAMADAS DE SALIDA CONECTADAS" o "LLAMADAS DE SALIDA NO CONECTADAS".', 'LLAMADAS DE SALIDA CONECTADAS'],
    },
  },
  {
    modulo: 'tipificacion',
    carga: 'Tipificación de llamadas (CDR)',
    archivo: 'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx',
    hoja: 'TIPIFICACION_LLAMADAS',
    fuente: { js: 'tipificacion-logic.js', variable: 'TIPIFICACION_COLUMNAS' },
    columnas: {
      AGENT_NAME: ['Asesor.', 'Asesor Ejemplo Uno'],
      DATE: ['Fecha de la llamada (la hora va en HORA).', '2026-08-01'],
      HORA: ['Hora, si viene aparte.', '08:15'],
      TIME_MIN: ['Duración en minutos.', 3],
      DESCRIPTION_COD_ACT: ['Motivo o tipificación.', 'Consulta general'],
      SKILL_NAME: ['Línea o skill (WhatsApp: "NOMBRE DE SKILL").', 'SKILL SAC'],
      TIME_SEC: ['Duración en segundos.', 180],
      COD_ACT: ['Código de la tipificación (texto).', '401'],
      TYPE_INTERACTION: ['"inbound" (entrante) u "outbound_ma" (saliente).', 'inbound'],
      HUNG_UP: ['Quién colgó ("agent" o "customer").', 'customer'],
      SKILL_ID: ['Identificador técnico de la línea.', '101'],
    },
  },
  {
    modulo: 'encuesta',
    carga: 'Encuesta de satisfacción',
    archivo: 'PLANTILLA_ENCUESTA.xlsx',
    hoja: 'ENCUESTA',
    fuente: { js: 'encuesta-logic.js', variable: 'ENCUESTA_COLUMNAS' },
    columnas: {
      AGENT_NAME: ['Asesor de la llamada encuestada.', 'Asesor Ejemplo Uno'],
      SKILL_NAME: ['Línea o skill.', 'SKILL SAC'],
      DATE: ['Fecha de la encuesta.', '2026-08-01 10:20'],
      Q01: ['Pregunta 1, de 0 a 10. "-" = sin respuesta.', 9],
      Q02: ['Pregunta 2, de 1 a 5.', 5],
      Q03: ['Pregunta 3: 1 = Sí, 2 = No (base de One & Done y FCR).', 1],
      Q04: ['Pregunta 4, de 1 a 5.', 4],
      VOICE_MESSAGE: ['Comentario (opcional).', 'Buena atención'],
    },
  },
  // ── ORLANT ────────────────────────────────────────────────────────────
  {
    modulo: 'flujo_whatsapp',
    carga: 'Flujo de WhatsApp',
    archivo: 'PLANTILLA_FLUJO_WHATSAPP.xlsx',
    hoja: 'WHATSAPP',
    fuente: { js: 'trafico-whatsapp-logic.js', variable: 'TRAFICO_WPP_COLUMNAS' },
    columnas: {
      NOMBRE_COLA_WHATSAPP: ['Cola de WhatsApp.', 'WHATSAPP GENERAL'],
      'FECHA INICIO': ['Primer día del período de la fila.', '2026-08-01'],
      'FECHA FIN': ['Último día del período de la fila.', '2026-08-31'],
      'TOTAL WHATSAPP': ['Conversaciones que entraron.', 900],
      'WHATSAPP CONTESTADOS': ['Conversaciones atendidas.', 870],
      'WHATSAPP ABANDONADOS': ['Conversaciones sin atender.', 30],
      SERVICE_LEVEL_10SEC: ['% atendidas en 10 s.', 0.4],
      SERVICE_LEVEL_20SEC: ['% atendidas en 20 s.', 0.5],
      SERVICE_LEVEL_30SEC: ['% atendidas en 30 s.', 0.6],
      SERVICE_LEVEL_5MIN: ['% atendidas en 5 min.', 0.9],
      ASA: ['Tiempo promedio de respuesta.', 60],
      ATA: ['Tiempo promedio hasta el abandono.', 300],
      AHT: ['Tiempo promedio de atención.', 400],
    },
  },
  {
    modulo: 'whatsapp_tiempos',
    carga: 'WhatsApp por rangos de tiempo',
    archivo: 'PLANTILLA_WHATSAPP_TIEMPOS.xlsx',
    hoja: 'WHATSAPP_TIEMPOS',
    fuente: { js: 'whatsapp-tiempos-logic.js', variable: 'WPP_TIEMPOS_COLUMNAS' },
    columnas: {
      SKILL_NAME: ['Cola (solo cuentan las que empiezan por WHATSAPP).', 'WHATSAPP GENERAL'],
      DATE: ['Fecha y hora de la conversación.', '2026-08-01 09:05'],
      RESULT: ['Resultado: solo cuentan las ANSWER (contestadas).', 'ANSWER'],
      ANSWER_TIME: ['Segundos hasta que se contestó.', 140],
    },
  },
  {
    modulo: 'tipificacion',
    carga: 'Tipificación de WhatsApp (HistChat)',
    archivo: 'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx',
    hoja: 'TIPIFICACION_WHATSAPP',
    fuente: { js: 'tipificacion-logic.js', variable: 'TIPIFICACION_COLUMNAS' },
    // El export HistChat trae "NOMBRE DE SKILL" en vez de SKILL_NAME; por eso
    // el sistema sabe que es WhatsApp (cargasDetectarCanalTipificacion). Solo
    // se ponen las columnas que trae ese export.
    usarAlias: { SKILL_NAME: 'NOMBRE DE SKILL' },
    soloColumnas: ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'],
    columnas: {
      AGENT_NAME: ['Asesor.', 'Asesor Ejemplo Uno'],
      DATE: ['Fecha de la conversación.', '2026-08-01'],
      DESCRIPTION_COD_ACT: ['Motivo o tipificación.', 'Agendamiento'],
      SKILL_NAME: ['Cola de WhatsApp ("NOMBRE DE SKILL" en el export).', 'WHATSAPP GENERAL'],
    },
  },
  {
    modulo: 'agendas',
    carga: 'Agendas',
    archivo: 'PLANTILLA_AGENDAS.xlsx',
    hoja: 'AGENDAS',
    fuente: { js: 'agendas-logic.js', variable: 'AGENDAS_COLUMNAS' },
    columnas: {
      'NOMBRE DE AGENTE': ['Asesor que agendó.', 'Asesor Ejemplo Uno'],
      SEDE: ['Sede de la cita.', 'Sede Ejemplo'],
      NOMBRE_EXAMEN: ['Examen o servicio.', 'Examen Ejemplo'],
      ESPECIALIDAD: ['Especialidad.', 'Audiología'],
      PROFESIONAL: ['Profesional asignado.', 'Profesional Ejemplo'],
      FECHA_SOLICITUD: ['Fecha y hora en que se agendó.', '2026-08-01 08:15:00'],
      'TIPO DE LINEA': ['"3P" o "GENERAL".', 'GENERAL'],
      NOMBRE_ENTIDAD: ['Entidad (opcional).', 'Entidad Ejemplo'],
    },
  },
  {
    modulo: 'efectividad_agendamiento',
    carga: 'Efectividad de Agendamiento',
    archivo: 'PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx',
    hoja: 'EFECTIVIDAD_AGENDAMIENTO',
    fuente: { js: 'efectividad-agendamiento-logic.js', variable: 'EFECTIVIDAD_AGENDAMIENTO_COLUMNAS' },
    columnas: {
      'NOMBRE DE AGENTE': ['Asesor (una fila por asesor y mes).', 'Asesor Ejemplo Uno'],
      MES: ['Mes en letras, sin año (el sistema pregunta el año).', 'AGOSTO'],
      'CANTIDAD DE GESTIONES': ['Gestiones del mes.', 300],
      AGENDAS: ['Agendas logradas.', 120],
    },
  },
  {
    modulo: 'inasistencia',
    carga: 'Inasistencia',
    archivo: 'PLANTILLA_INASISTENCIA.xlsx',
    hoja: 'INASISTENCIA',
    fuente: { js: 'inasistencia-logic.js', variable: 'INASISTENCIA_COLUMNAS' },
    columnas: {
      SEDE: ['Sede de la cita (una fila por cita).', 'Sede Ejemplo'],
      ESPECIALIDAD: ['Especialidad.', 'Audiología'],
      FECHA_CITA: ['Fecha de la cita.', '2026-08-05'],
      'NOMBRE ENTIDAD': ['Entidad (las que aparecen muy poco se guardan como "PARTICULAR / OTRA").', 'Entidad Ejemplo'],
      CITEST: ['C = cancelada, I = inasistencia, P = pendiente, T = atendida.', 'T'],
    },
  },
  {
    modulo: 'efectividad_citas',
    carga: 'Efectividad de Citas',
    archivo: 'PLANTILLA_EFECTIVIDAD_CITAS.xlsx',
    hoja: 'CITAS_ATENDIDAS',
    fuente: { js: 'citas-atendidas-logic.js', variable: 'CITAS_ATENDIDAS_COLUMNAS' },
    columnas: {
      MES: ['Mes en letras, sin año.', 'AGOSTO'],
      AGENDAS: ['Citas agendadas del mes.', 1500],
      ATENDIDAS: ['Citas atendidas del mes.', 1200],
    },
  },
  {
    modulo: 'salida',
    carga: 'Llamadas y WhatsApp de salida (resumen mensual)',
    archivo: 'PLANTILLA_SALIDA_MENSUAL.xlsx',
    hoja: 'SALIDA',
    fuente: { js: 'salida-logic.js', variable: 'SALIDA_COLUMNAS' },
    columnas: {
      MES: ['Mes en letras, sin año.', 'AGOSTO'],
      'LINEA 3P': ['Llamadas de salida de la línea 3P.', 400],
      'LINEA GENERAL': ['Llamadas de salida de la línea General.', 600],
      'WHATSAPP 3P': ['WhatsApp de salida de la línea 3P.', 200],
      'WHATSAPP GENERAL': ['WhatsApp de salida de la línea General.', 350],
    },
  },
];

// De donde sale el archivo y que reemplaza al subirlo (lo mismo que dice la
// guia de uso, docs/guia-uso-orlant.md seccion 4).
const ORIGEN = {
  'PLANTILLA_FLUJO_LLAMADAS.xlsx': {
    origen: 'Wolkvox: reporte de la cola por skill y por día (hoja "HistQueue<fecha>"; ORLANT lo trae en la hoja LLAMADAS). Se sube tal cual.',
    reemplazo: 'Las filas de esos skills en las fechas que trae el archivo.',
  },
  'PLANTILLA_LLAMADAS_UNICAS.xlsx': {
    origen: 'Wolkvox: Reportes → CDR → "1. Detalle de las llamadas", solo las de ingreso (sin las de salida).',
    reemplazo: 'El mes completo de las fechas del archivo.',
  },
  'PLANTILLA_LLAMADAS_SALIDA.xlsx': {
    origen: 'Wolkvox: CDR → "1. Detalle de las llamadas" (salientes conectadas) + "5. Detalle de las llamadas para las no conectadas", con SKILL_ID diciendo cuál es cuál.',
    reemplazo: 'Todo lo que exista entre la primera y la última fecha del archivo.',
  },
  'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx': {
    origen: 'Wolkvox: Reportes → CDR → "1. Detalle de las llamadas", export completo (hoja "HistCDR<fecha>"). Se sube tal cual: el sistema nunca lee teléfonos, documentos ni comentarios.',
    reemplazo: 'Las llamadas de ese cliente entre la primera y la última fecha del archivo.',
  },
  'PLANTILLA_ENCUESTA.xlsx': {
    origen: 'Wolkvox: Reportes → numeral 4 (hoja "HistIVR<fecha>"). Se sube tal cual: el encabezado puede estar en la fila 2.',
    reemplazo: 'Todo lo que exista entre la primera y la última fecha del archivo. Suba siempre el mes completo.',
  },
  'PLANTILLA_FLUJO_WHATSAPP.xlsx': {
    origen: 'Wolkvox: reporte de WhatsApp por cola (un período por fila). También se acepta el formato diario de Wolkvox (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS…).',
    reemplazo: 'Las filas de esas colas en el rango de fechas de cada fila.',
  },
  'PLANTILLA_WHATSAPP_TIEMPOS.xlsx': {
    origen: 'Wolkvox: detalle de conversaciones de WhatsApp (hoja "HistQueue<fecha>"). La columna TIEMPO y la hoja de tabla dinámica se ignoran.',
    reemplazo: 'Las fechas que trae el archivo.',
  },
  'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx': {
    origen: 'Wolkvox: export "HistChat<fecha>". Se sube tal cual (no hay que renombrar la hoja); el sistema nunca lee nombres, correos, teléfonos ni el texto de las conversaciones.',
    reemplazo: 'Las conversaciones de ese cliente entre la primera y la última fecha del archivo.',
  },
  'PLANTILLA_AGENDAS.xlsx': {
    origen: 'Sistema de agendamiento del cliente: citas agendadas (una fila por cita).',
    reemplazo: 'El rango continuo de fechas que trae el archivo.',
  },
  'PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx': {
    origen: 'Resumen mensual por asesor que arma el equipo (gestiones y agendas). La efectividad la calcula el sistema.',
    reemplazo: 'El mes completo, para todos los asesores del archivo.',
  },
  'PLANTILLA_INASISTENCIA.xlsx': {
    origen: 'Sistema de agendamiento del cliente: citas con su estado (una fila por cita; puede traer varios meses).',
    reemplazo: 'Los meses completos que trae el archivo.',
  },
  'PLANTILLA_EFECTIVIDAD_CITAS.xlsx': {
    origen: 'Resumen mensual de agendas y atendidas que arma el equipo. La efectividad la calcula el sistema.',
    reemplazo: 'Los meses completos que trae el archivo.',
  },
  'PLANTILLA_SALIDA_MENSUAL.xlsx': {
    origen: 'Resumen mensual de salida que arma el equipo (líneas 3P y General de ORLANT). El encabezado puede estar en la fila 3.',
    reemplazo: 'Los meses completos que trae el archivo.',
  },
};
CARGAS.forEach((c) => Object.assign(c, ORIGEN[c.archivo]));

// Columnas que lee el sistema para una carga, en el orden del lector, sin
// las que el lector marca `ocultaEnPlantilla` (el sistema las recalcula).
function columnasDeCarga(c, requerir) {
  const req = requerir || ((js) => require('../../public/js/' + js));
  const lista = req(c.fuente.js)[c.fuente.variable];
  return lista
    .filter((col) => !col.ocultaEnPlantilla)
    .filter((col) => !c.soloColumnas || c.soloColumnas.includes(col.label))
    .map((col) => ({
      label: col.label,
      encabezado: (c.usarAlias && c.usarAlias[col.label]) || col.label,
      obligatoria: !!col.obligatoria,
      alias: [].concat(col.aliases || [], col.labelAlt || []),
      descripcion: (c.columnas[col.label] || [''])[0],
      ejemplo: (c.columnas[col.label] || [])[1],
    }));
}

module.exports = { CARGAS, columnasDeCarga };
