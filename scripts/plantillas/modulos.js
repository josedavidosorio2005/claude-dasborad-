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

// Fase 174: columnas del export de Wolkvox que el sistema no usa.
const NO_USA_TXT = 'Viene en el export de Wolkvox; el sistema no la usa.';
const NO_LEE_TXT = 'Viene en el export de Wolkvox; el sistema nunca la lee ni la guarda.';

const CARGAS = [
  // ── Mobilize ──────────────────────────────────────────────────────────
  {
    modulo: 'flujo_llamadas',
    carga: 'Flujo de Llamadas',
    archivo: 'PLANTILLA_FLUJO_LLAMADAS.xlsx',
    hoja: 'LLAMADAS',
    fuente: { js: 'trafico-logic.js', variable: 'TRAFICO_COLUMNAS' },
    // Fase 159: la hoja de datos lleva EXACTAMENTE los 13 encabezados del
    // reporte nativo de la cola de Wolkvox, en su orden (el archivo que se
    // descarga se sube tal cual). Los nombres viejos siguen como alias.
    usarAlias: { 'TOTAL LLAMADAS': 'INBOUND_CALLS', 'LLAMADAS CONTESTADAS': 'ANSWER_CALLS', 'LLAMADAS ABANDONADAS': 'ABANDON_CALLS' },
    soloColumnas: ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS', 'SERVICE_LEVEL_10SEC',
      'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'ABANDON', 'ASA', 'ATA', 'WAIT_TIME', 'AHT'],
    columnas: {
      SKILL_NAME: ['Línea o skill de Wolkvox.', 'SKILL SAC'],
      DATE: ['Día.', '2026-08-01'],
      'TOTAL LLAMADAS': ['Llamadas que entraron a la cola ese día (ingresadas).', 120],
      'LLAMADAS CONTESTADAS': ['Llamadas atendidas.', 112],
      'LLAMADAS ABANDONADAS': ['Llamadas que colgaron antes de ser atendidas.', 8],
      SERVICE_LEVEL_10SEC: ['% atendidas en 10 s. Puede venir como texto ("66.67 %").', '66.67 %'],
      SERVICE_LEVEL_20SEC: ['% atendidas en 20 s (nivel de servicio 80 - 20).', '80.00 %'],
      SERVICE_LEVEL_30SEC: ['% atendidas en 30 s.', '93.00 %'],
      ABANDON: ['% de abandono que reporta Wolkvox. Se deja como viene: el sistema no la usa (calcula la tasa de abandono con las llamadas).', '0.00%'],
      ASA: ['Tiempo promedio de respuesta (segundos, también como texto "11.00").', '11.00'],
      ATA: ['Tiempo promedio hasta el abandono.', '30.00'],
      WAIT_TIME: ['Tiempo de espera (hora de Excel o segundos).', '0:00:15'],
      AHT: ['Tiempo promedio de atención (hora de Excel o segundos). "----" o vacío = sin dato, nunca 0.', '0:03:30'],
    },
  },
  {
    modulo: 'llamadas_unicas',
    carga: 'Llamadas Únicas (ingreso)',
    archivo: 'PLANTILLA_LLAMADAS_UNICAS.xlsx',
    hoja: 'LLAMADAS_UNICAS',
    fuente: { js: 'llamadas-unicas-logic.js', variable: 'LLAMADAS_UNICAS_COLUMNAS' },
    columnas: {
      AGENT_NAME: ['Asesor que atendió. Vacío en las abandonadas (el reporte de abandonadas no trae asesor): una fila sin asesor cuenta como abandonada.', 'Asesor Ejemplo Uno'],
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
      DATE: ['Fecha y hora de la llamada. Cuenta el día en hora de Colombia.', '2026-08-01 09:30'],
      TELEPHONE: ['Número llamado. Solo se usa en el navegador; nunca se envía ni se guarda.', '3000000001'],
      DESCRIPTION_COD_ACT: ['Tipificación de la llamada. "-" o vacío = "Sin tipificación".', 'Seguimiento'],
      TIPO: ['"Conectada" (sale del CDR, numeral 1) o "No conectada" (sale del reporte "Detalle de llamadas no conectadas", numeral 5).', 'Conectada'],
    },
  },
  {
    modulo: 'tipificacion',
    carga: 'Tipificación de llamadas (CDR)',
    archivo: 'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx',
    hoja: 'TIPIFICACION_LLAMADAS',
    fuente: { js: 'tipificacion-logic.js', variable: 'TIPIFICACION_COLUMNAS' },
    // Fase 174: la plantilla es el export HistCDR completo, con sus 20
    // columnas en el mismo orden de Wolkvox (las que el sistema no usa van
    // con un ejemplo inventado y la nota de que no se leen).
    ordenCompleto: ['AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'COST', 'TIME_SEC', 'TIME_MIN', 'COD_ACT', 'DESCRIPTION_COD_ACT',
      'COD_ACT_2', 'DESCRIPTION_COD_ACT_2', 'TYPE_INTERACTION', 'CUSTOMER_ID', 'HUNG_UP', 'CAMPAIGN_ID', 'CONN_ID', 'SKILL_ID',
      'SKILL_NAME', 'AGENT_ID', 'COMMENT'],
    columnas: {
      AGENT_NAME: ['Asesor.', 'Asesor Ejemplo Uno'],
      DATE: ['Fecha y hora de la llamada.', '2026-08-01 08:15:00'],
      DESTINY: [NO_LEE_TXT, '3000000001'],
      TELEPHONE: [NO_LEE_TXT, '3000000001'],
      COST: [NO_USA_TXT, 0],
      TIME_SEC: ['Duración en segundos.', 180],
      TIME_MIN: ['Duración en minutos.', 3],
      COD_ACT: ['Código de la tipificación (texto).', '401'],
      DESCRIPTION_COD_ACT: ['Motivo o tipificación. En una llamada de salida, el cliente define cuáles cuentan como "no conectada" (ORLANT: NO_CONTESTAN y BUZON).', 'Consulta general'],
      COD_ACT_2: [NO_USA_TXT, '-'],
      DESCRIPTION_COD_ACT_2: [NO_USA_TXT, '-'],
      TYPE_INTERACTION: ['"inbound" (entrante), "outbound_ma" u "out_pre" (salientes: las dos cuentan como Llamadas de salida). Las "internalcall" no cuentan como salida.', 'inbound'],
      CUSTOMER_ID: [NO_LEE_TXT, '1000000001'],
      HUNG_UP: ['Quién colgó ("agent" o "customer").', 'customer'],
      CAMPAIGN_ID: [NO_USA_TXT, '-'],
      CONN_ID: [NO_LEE_TXT, 'EJEMPLO-0001'],
      SKILL_ID: ['Identificador técnico de la línea.', '101'],
      SKILL_NAME: ['Línea o skill. "-" con TYPE_INTERACTION de salida = Llamadas de salida.', 'SKILL SAC'],
      AGENT_ID: [NO_LEE_TXT, '0000'],
      COMMENT: [NO_LEE_TXT, ''],
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
      // Fase 160: ejemplos en el formato que el lector acepta sin dudas (un
      // 0.4 sin formato de % queda como dudoso, y un AHT en segundos se lee
      // como dias y la carga se rechaza).
      SERVICE_LEVEL_10SEC: ['% atendidas en 10 s. Como porcentaje ("40 %" o celda con formato %).', '40.00 %'],
      SERVICE_LEVEL_20SEC: ['% atendidas en 20 s. Como porcentaje.', '50.00 %'],
      SERVICE_LEVEL_30SEC: ['% atendidas en 30 s. Como porcentaje.', '60.00 %'],
      SERVICE_LEVEL_5MIN: ['% atendidas en 5 min. Como porcentaje.', '90.00 %'],
      ASA: ['Tiempo promedio de respuesta, en segundos.', 60],
      ATA: ['Tiempo promedio hasta el abandono, en segundos.', 300],
      AHT: ['Tiempo promedio de atención, como hora de Excel (h:mm:ss). No en segundos: 400 se leería como 400 días y la carga se rechaza.', '0:06:40'],
    },
  },
  {
    // Fase 172: resumen por asesor (plantilla de Edwin). Clasificacion y Alerta
    // son opcionales: el sistema las recalcula con los numeros.
    modulo: 'calidad_resumen',
    carga: 'Calidad: resumen por asesor',
    archivo: 'PLANTILLA_CALIDAD_RESUMEN.xlsx',
    hoja: 'CALIDAD_RESUMEN',
    fuente: { js: 'calidad-resumen-logic.js', variable: 'CALIDAD_RESUMEN_COLUMNAS' },
    columnas: {
      'Nombre del Asesor': ['Nombre del asesor (puede traer "← Escribir aquí" en el encabezado).', 'Asesor Ejemplo Uno'],
      '# Monitoreos': ['Cantidad de monitoreos del asesor en el mes (puede ser fórmula ya calculada).', 11],
      'Prom. Puntaje (%)': ['Puntaje promedio del asesor, de 0 a 100 (puede ser fórmula ya calculada).', 96.5],
      'Clasificación': ['Opcional: el sistema la recalcula con el puntaje.', 'Sobresaliente'],
      'Alerta Críticos': ['Opcional: el sistema la recalcula con los fallos.', 'Alerta'],
      'Total Fallos Críticos': ['Cantidad de fallos críticos del asesor en el mes (puede ser fórmula ya calculada).', 1],
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
      ANSWER_TIME: ['Segundos hasta que se contestó (número, tal como sale de Wolkvox).', 140],
    },
  },
  {
    modulo: 'tipificacion',
    carga: 'Tipificación de WhatsApp (HistChat)',
    archivo: 'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx',
    hoja: 'TIPIFICACION_WHATSAPP',
    fuente: { js: 'tipificacion-logic.js', variable: 'TIPIFICACION_COLUMNAS' },
    // Fase 168: el export HistChat NUEVO de Wolkvox trae SKILL_ID (numero) y
    // no el nombre del skill; el nombre sale de la tabla "Skills de WhatsApp"
    // del cliente. Con SKILL_ID + CHANNEL el sistema sabe que es WhatsApp
    // (cargasEsHistChatPorSkillId). Solo se ponen las columnas que lee.
    // Fase 174: el export HistChat completo, con sus 32 columnas en el
    // orden de Wolkvox.
    ordenCompleto: ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'ROUTING', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'CUSTOMER_PHONE',
      'CUSTOMER_CHARS', 'ASSIGNMENT_TIME', 'AGENT_AVERAGE_RESPONSE_TIME', 'AGENT_ID', 'AGENT_NAME', 'AGENT_CHARS', 'TIME_ON_AGENT',
      'CHAT_DURATION', 'COD_ACT', 'DESCRIPTION_COD_ACT', 'TRANSFER', 'TRANSFER_TYPE', 'COMMENTS', 'CUSTOMER_ID', 'SKILL_ID',
      'FIRST RESPONSE TIME', 'LAST_PARTICIPANT_WHO_SPOKE', 'EXTRA_FIELD', 'COMMENT', 'USER_ID', 'FEELING', 'AGENT_DNI',
      'AGENT_ANSWERS', 'BSUID'],
    // SKILL_ID hace las veces de SKILL_NAME (el nombre sale de la tabla de skills).
    obligatoriaReemplazada: { SKILL_NAME: 'SKILL_ID' },
    columnas: {
      CONN_ID: [NO_LEE_TXT, 'EJEMPLO-0001'],
      CHANNEL: ['Canal del chat ("whatsapp").', 'whatsapp'],
      DATE: ['Fecha y hora de la conversación.', '2026-09-01 08:15:00'],
      DATE_CLOSE: [NO_USA_TXT, '2026-09-01 08:30:00'],
      ROUTING: [NO_USA_TXT, '-'],
      CUSTOMER_NAME: [NO_LEE_TXT, 'Cliente Ejemplo'],
      CUSTOMER_EMAIL: [NO_LEE_TXT, 'cliente@ejemplo.com'],
      CUSTOMER_PHONE: [NO_LEE_TXT, '3000000001'],
      CUSTOMER_CHARS: [NO_USA_TXT, 0],
      ASSIGNMENT_TIME: [NO_USA_TXT, 0],
      AGENT_AVERAGE_RESPONSE_TIME: [NO_USA_TXT, 0],
      AGENT_ID: [NO_LEE_TXT, '0000'],
      AGENT_NAME: ['Asesor.', 'Asesor Ejemplo Uno'],
      AGENT_CHARS: [NO_USA_TXT, 0],
      TIME_ON_AGENT: [NO_USA_TXT, 0],
      CHAT_DURATION: [NO_USA_TXT, 0],
      COD_ACT: [NO_USA_TXT, '401'],
      DESCRIPTION_COD_ACT: ['Motivo o tipificación.', 'Agendamiento'],
      TRANSFER: [NO_USA_TXT, '-'],
      TRANSFER_TYPE: [NO_USA_TXT, '-'],
      COMMENTS: [NO_LEE_TXT, ''],
      CUSTOMER_ID: [NO_LEE_TXT, '1000000001'],
      SKILL_ID: ['Número del skill (ver la tabla de skills). 0 = WhatsApp de salida.', '4327'],
      'FIRST RESPONSE TIME': [NO_USA_TXT, 0],
      LAST_PARTICIPANT_WHO_SPOKE: [NO_USA_TXT, '-'],
      EXTRA_FIELD: [NO_LEE_TXT, ''],
      COMMENT: [NO_LEE_TXT, ''],
      USER_ID: [NO_LEE_TXT, '0000'],
      FEELING: [NO_USA_TXT, '-'],
      AGENT_DNI: [NO_LEE_TXT, '0000'],
      AGENT_ANSWERS: [NO_USA_TXT, 0],
      BSUID: [NO_LEE_TXT, '-'],
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
    // Fase 155: una linea en INSTRUCCIONES y en la ficha.
    nota: 'Nivel de atención y tasa de abandono los calcula el sistema; no hace falta llenarlos.',
    reemplazo: 'Las filas de esos skills en las fechas que trae el archivo.',
  },
  'PLANTILLA_LLAMADAS_UNICAS.xlsx': {
    origen: 'Wolkvox, dos reportes en una sola hoja: las CONTESTADAS del CDR → "1. Detalle de las llamadas" (solo las de ingreso, con asesor) y las ABANDONADAS de "Skill y servicios → 2. Detalle llamadas abandonadas" (skill, teléfono y día, con AGENT_NAME vacío).',
    notaTitulo: 'Archivos del módulo',
    nota: "Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) \"Únicas de ingreso\" — contestadas: Wolkvox, CDR; no contestadas: Wolkvox, reporte por skill y servicio. (2) \"De salida\" — Wolkvox, CDR. Esta plantilla es la de \"Únicas de ingreso\".",
    reemplazo: 'El mes completo de las fechas del archivo.',
  },
  'PLANTILLA_LLAMADAS_SALIDA.xlsx': {
    origen: 'Wolkvox, dos reportes en una sola hoja: las CONECTADAS salen del CDR → "1. Detalle de las llamadas" (solo las de salida) y las NO CONECTADAS del reporte "5. Detalle de llamadas no conectadas". La columna TIPO dice cuál es cuál: "Conectada" o "No conectada".',
    notaTitulo: 'Archivos del módulo',
    nota: "Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) \"Únicas de ingreso\" — contestadas: Wolkvox, CDR; no contestadas: Wolkvox, reporte por skill y servicio. (2) \"De salida\" — Wolkvox, CDR. Esta plantilla es la de \"De salida\".",
    reemplazo: 'Todo lo que exista entre la primera y la última fecha del archivo.',
  },
  'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx': {
    origen: 'Wolkvox: CDR de llamadas, export completo (hoja "HistCDR<fecha>") — [ruta pendiente de confirmar con Edwin]. Se sube tal cual: el sistema nunca lee teléfonos, documentos ni comentarios. SKILL_ID/SKILL_NAME "-" = Llamadas de salida (las internalcall no cuentan). TYPE_INTERACTION "out_pre" también es Llamada de salida, aunque traiga skill (ORLANT: 4070 CANCELACIONES Y REPROGRAMACION).',
    notaTitulo: 'Archivos del módulo',
    nota: "Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) \"Llamadas\" — Wolkvox, CDR (hoja \"HistCDR<fecha>\"). (2) \"WhatsApp\" — Wolkvox, HistChat (hoja \"HistChat<fecha>\"). Esta plantilla es la de \"Llamadas\".",
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
  'PLANTILLA_CALIDAD_RESUMEN.xlsx': {
    origen: 'Resumen por asesor que arma Edwin a partir de su libro de Monitoreos (una fila por asesor). Si las columnas son fórmulas a ese libro, ábralo junto con la plantilla, deje que calcule y guárdela antes de subirla: el sistema lee los valores ya calculados.',
    notaTitulo: 'Cálculos',
    nota: 'El mes se elige al subir (Centro de cargas: la tarjeta del mes). Clasificación y Alerta se recalculan con los números: puntaje <70 Crítico, <90 No crítico, si no Sobresaliente; fallos críticos 0 Sin fallos críticos, 1 Alerta, más de 1 Crítico frecuente. El promedio general del mes es ponderado por el número de monitoreos.',
    reemplazo: 'El mes elegido completo (los demás meses no se tocan).',
  },
  'PLANTILLA_WHATSAPP_TIEMPOS.xlsx': {
    // Fase 165: la ruta exacta del reporte y los rangos, en INSTRUCCIONES y en la ficha.
    origen: 'Wolkvox > Reportes > Skills & Servicios > 10. Detalle de llamadas contestadas (rango de fechas y SKILL = ALL). Se sube tal cual: CONN_ID, SKILL_ID, ANI, la columna TIEMPO y la hoja de tabla dinámica se ignoran.',
    notaTitulo: 'Rangos',
    nota: 'El sistema clasifica cada WhatsApp contestado con ANSWER_TIME (segundos), sin fórmulas en el Excel: menos de 180 s = 0 a 3 minutos; menos de 300 s = 3 a 5 minutos; menos de 480 s = 5 a 8 minutos; menos de 600 s = 8 a 10 minutos; 600 s o más = 10 minutos en adelante.',
    reemplazo: 'Las fechas que trae el archivo.',
  },
  'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx': {
    origen: 'Wolkvox: CDR de WhatsApp, export "HistChat<fecha>" — [ruta pendiente de confirmar con Edwin]. Se sube tal cual (no hay que renombrar la hoja); el sistema nunca lee nombres, correos, teléfonos ni el texto de las conversaciones. Un SKILL_ID que no esté en la tabla de skills se ignora y la vista previa dice cuántos.',
    notaSkills: 'Tabla de skills de WhatsApp de ORLANT (SKILL_ID = nombre): 0 = WHATSAPP DE SALIDA; 4042 = WHATSAPP PAUTAS; 4047 = WHATSAPP AUDIFONOS; 4061 = WHATSAPP FONOAUDIOLOGIA; 4071 = WHATSAPP FONIATRIA; 4306 = WHATSAPP 3P; 4327 = WHATSAPP GENERAL; 4338 = WHATSAPP CONFIRMACIONES; 4362 = ATENCION TUTELAS. La edita un administrador en Cargar Datos → "Skills de WhatsApp".',
    notaTitulo: 'Archivos del módulo',
    nota: "Este módulo lleva 2 archivos, cada uno en su propia carga del Centro de cargas: (1) \"Llamadas\" — Wolkvox, CDR (hoja \"HistCDR<fecha>\"). (2) \"WhatsApp\" — Wolkvox, HistChat (hoja \"HistChat<fecha>\"). Esta plantilla es la de \"WhatsApp\".",
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
  // Fase 174: export completo de Wolkvox, en su orden. Las columnas que el
  // lector no conoce se ponen igual (el lector las ignora por nombre).
  if (c.ordenCompleto) {
    return c.ordenCompleto.map((label) => {
      const col = lista.find((x) => x.label === label);
      return {
        label,
        encabezado: label,
        obligatoria: !!(col && col.obligatoria),
        alias: col ? [].concat(col.aliases || [], col.labelAlt || []).filter((a) => a !== label) : [],
        descripcion: (c.columnas[label] || [''])[0],
        ejemplo: (c.columnas[label] || [])[1],
      };
    });
  }
  return lista
    .filter((col) => !col.ocultaEnPlantilla)
    .filter((col) => !c.soloColumnas || c.soloColumnas.includes(col.label))
    .map((col) => ({
      label: col.label,
      encabezado: (c.usarAlias && c.usarAlias[col.label]) || col.label,
      obligatoria: !!col.obligatoria,
      // Si la plantilla usa un alias como encabezado, el nombre oficial pasa
      // a la lista de "también se acepta como" (Fase 159).
      alias: [].concat(c.usarAlias && c.usarAlias[col.label] ? [col.label] : [], col.aliases || [], col.labelAlt || [])
        .filter((a) => a !== ((c.usarAlias && c.usarAlias[col.label]) || col.label)),
      descripcion: (c.columnas[col.label] || [''])[0],
      ejemplo: (c.columnas[col.label] || [])[1],
    }));
}

module.exports = { CARGAS, columnasDeCarga };
