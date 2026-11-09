// scripts/plantillas/generar-fichas.js — Fase 153 (P1): genera una ficha
// por modulo del catalogo (server/plantillas-cliente.js) en
// docs/plantillas/<modulo>.md. Las tablas de columnas salen de
// scripts/plantillas/modulos.js (= las columnas del lector), asi fichas,
// plantillas y catalogo dicen lo mismo. Las notas de cada modulo (lo que el
// codigo no sabe por si solo) van aqui abajo, en NOTAS.
//
// Uso (desde la raiz del repo): node scripts/plantillas/generar-fichas.js
'use strict';
const fs = require('fs');
const path = require('path');
const { CATALOGO } = require('../../server/plantillas-cliente');
const { CARGAS, columnasDeCarga } = require('./modulos');

const DESTINO = path.join(__dirname, '..', '..', 'docs', 'plantillas');

const COMUN_ENCABEZADO = 'Cargar Datos busca el encabezado en las primeras 20 filas de cada hoja y lo reconoce por los nombres de las columnas obligatorias (sin importar mayúsculas, espacios de más ni el nombre de la hoja). Las columnas que no están en la tabla se ignoran: nunca se leen ni viajan al servidor.';
const COMUN_FALTA = 'Si falta una columna obligatoria, esa hoja no se carga y el aviso dice cuál falta ("Faltan columnas obligatorias: …"). Si falta una opcional, el dato queda vacío (nunca en 0). Una fila con un dato inválido o una fecha futura se omite con aviso; el resto del archivo sí se carga.';

// Por modulo: quien lo usa hoy, notas propias y lo que falta confirmar.
const NOTAS = {
  flujo_llamadas: {
    usan: 'ORLANT y MOBILIZE',
    notas: [
      'Es el mismo lector para los dos clientes y el mismo reporte de Wolkvox (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS, SERVICE_LEVEL_10SEC, SERVICE_LEVEL_20SEC, SERVICE_LEVEL_30SEC, ABANDON, ASA, ATA, WAIT_TIME, AHT). Los nombres de plantillas anteriores (TOTAL LLAMADAS, LLAMADAS INGRESADAS, TIPO DE LINEA, DÍA, NIVEL DE SERVICIO 80 - 20, % ABANDONO…) se siguen aceptando como alias.',
      'La hoja se reconoce por sus columnas, no por su nombre ("HistQueue<fecha>", "LLAMADAS", "DATA" u otro).',
      'Desde el Centro de cargas, el cliente lo define el Centro: las skills que ese cliente no tiene se registran solas para él (la vista previa dice cuáles) y la skill es por cliente, así que dos clientes pueden tener una skill con el mismo nombre sin mezclarse (Fase 163). En la pantalla de Tráfico de varios clientes, una skill sin asignar queda en "SIN_ASIGNAR" y no se ve en ningún tablero hasta asignarla.',
      'Una fila de total ("TOTAL", "TOTAL GENERAL") nunca se suma como si fuera una línea.',
      'Un archivo puede traer varios días o meses; el período es el de las fechas que trae.',
    ],
    pendiente: 'Ruta exacta del reporte en el menú de Wolkvox (la carga de septiembre de Mobilize usó la hoja "HistQueue<fecha>"): confirmarla con Edwin para la guía.',
  },
  flujo_whatsapp: {
    usan: 'ORLANT',
    notas: [
      'Acepta dos formatos de Wolkvox: por período (FECHA INICIO / FECHA FIN por fila) o diario (SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS…). El sistema distingue cuál es por sus columnas, y nunca lo confunde con el de llamadas.',
      'La plantilla trae el formato por período; si el archivo nativo diario ya sale de Wolkvox, se sube tal cual.',
    ],
  },
  calidad_resumen: {
    usan: 'MOBILIZE',
    notas: [
      'Es una sub-vista de Calidad: un panel al inicio de esa pestaña (tarjetas del mes, tabla por asesor y tabla por mes).',
      'Mientras llega el módulo de calidad completo (detalle por monitoreo), Edwin sube este resumen por asesor.',
      'Clasificación y Alerta no se leen del texto (traen emojis): se recalculan con los números.',
    ],
  },
  whatsapp_tiempos: {
    usan: 'ORLANT',
    notas: [
      'Es una sub-vista de Flujo de WhatsApp (Nivel de Servicio por rangos de minutos: 0 a 3, 3 a 5, 5 a 8, 8 a 10 y 10 minutos en adelante), con conteo y % por rango, por cola y por mes.',
      'Solo cuentan las colas cuyo nombre empieza por WHATSAPP y las filas con RESULT = ANSWER; el resto se ignora y la vista previa dice cuántas.',
      'El rango lo calcula el sistema con ANSWER_TIME; la columna TIEMPO del archivo se ignora.',
    ],
  },
  salida: {
    usan: 'ORLANT (no disponible para clientes nuevos)',
    notas: [
      'Lee un resumen mensual con las líneas 3P y General, propias de ORLANT. Queda como módulo pendiente de generalizar cuando un cliente nuevo lo necesite.',
      'El mes viene sin año: antes de guardar, el sistema muestra a qué año lo resolvió y pide confirmar.',
      'El archivo real trae el encabezado en la fila 3 (dos filas vacías antes); se reconoce igual.',
    ],
  },
  agendas: {
    usan: 'ORLANT',
    notas: [
      'Una fila por cita agendada. TIPO DE LINEA solo acepta 3P o GENERAL.',
      'Un mes grande cabe sin problema; si el archivo junta muchos meses, el sistema avisa antes de guardar y hay que subirlo por meses.',
    ],
  },
  efectividad_agendamiento: {
    usan: 'ORLANT',
    notas: [
      'Una fila por asesor y mes. La columna EFECTIVIDAD del archivo, si viene, no se guarda: el sistema la recalcula y avisa si no coincide.',
      'El mes viene sin año: el sistema pregunta a qué año corresponde.',
    ],
  },
  inasistencia: {
    usan: 'ORLANT',
    notas: [
      'Una fila por cita (no un resumen). No borre filas repetidas: sin número de cita, dos filas iguales son dos citas reales.',
      'CITEST: C, I, P o T. Otra letra se avisa; si son demasiadas, la carga se rechaza.',
      'Privacidad: una entidad que aparece muy pocas veces se guarda como "PARTICULAR / OTRA".',
    ],
  },
  efectividad_citas: {
    usan: 'ORLANT',
    notas: [
      'Un total por mes. La columna EFECTIVIDAD CITAS ATENDIDAS, si viene, no se guarda: se recalcula.',
      'El mes viene sin año: el sistema pregunta a qué año corresponde.',
    ],
  },
  flujo_hora: {
    usan: 'MOBILIZE',
    notas: [
      'Pestaña "Flujo por hora": tres mapas de calor (Ingresadas, Contestadas, Abandonadas), filas = hora, columnas = días del mes, con fila y columna de Total. Sigue el MES de arriba.',
      'Colores en tres tramos del valor más alto de cada tabla: alto (verde), medio (amarillo), bajo (gris). El número siempre está escrito.',
      'El reporte por hora trae la columna HOUR: así nunca se confunde con el de Flujo de Llamadas (diario). No trae teléfonos.',
    ],
  },
  llamadas_unicas: {
    usan: 'MOBILIZE',
    notas: [
      'Fase 194: el módulo lleva dos reportes de Wolkvox, subidos tal cual: "Abandonadas" (Detalle de llamadas abandonadas) y "No conectadas" (5. Detalle de las llamadas para las no conectadas). Las contestadas únicas y la salida conectada salen del CDR que se sube en Tipificación.',
      'Abandonadas: un teléfono (ANI) cuenta una vez por día; otro día vuelve a contar. Un mes sin este reporte muestra 0.',
      'No conectadas: cada fila es una llamada, sin quitar repetidas. Un mes con CDR y sin este reporte dice "Pendiente" en no conectadas y en el total de salida.',
      'Privacidad: el teléfono (ANI, TELEPHONE) solo se usa en el navegador de quien sube el archivo; nunca llega al servidor, nunca se guarda ni se muestra.',
      'Las cargas viejas (plantilla de ingreso y plantilla de salida) se retiraron del Centro; lo ya guardado no se borra y sigue en los meses sin CDR.',
    ],
  },
  tipificacion: {
    usan: 'ORLANT (llamadas y WhatsApp) y MOBILIZE (llamadas, CDR completo)',
    notas: [
      'Llamadas y WhatsApp se cargan por separado; cada carga reemplaza solo su canal.',
      'El sistema distingue el canal por las columnas: el CDR de llamadas trae SKILL_NAME; el HistChat de WhatsApp trae SKILL_ID + CHANNEL (o el formato anterior con "NOMBRE DE SKILL"). Un archivo de un canal nunca se carga en el otro.',
      'WhatsApp (Fase 168): el nombre del skill sale de la tabla "Skills de WhatsApp" del cliente (SKILL_ID → nombre, la edita un administrador en Cargar Datos). SKILL_ID 0 = WhatsApp de salida; un SKILL_ID que no esté en la tabla se ignora con un aviso.',
      'Llamadas (Fase 168): SKILL_ID/SKILL_NAME "-" = Llamadas de salida; las internalcall no cuentan como salida.',
      'Privacidad: del CDR completo nunca se leen TELEPHONE, CUSTOMER_ID, CONN_ID, AGENT_ID, DESTINY, COST ni COMMENT; del HistChat nunca se leen nombres, correos, teléfonos ni el texto de la conversación.',
      'En el CDR de Mobilize se excluyen las filas de prueba (tipificación "PRUEBA"), y en las salientes "Cliente_no_contesta" cuenta como no conectada.',
      'Si el archivo junta muchos meses y es muy grande, el sistema avisa antes de guardar; hay que subirlo por meses.',
    ],
  },
  encuesta: {
    usan: 'MOBILIZE',
    notas: [
      'El archivo real trae una fila de textos antes del encabezado; el sistema lo busca en las primeras 20 filas. La hoja de tabla dinámica se ignora.',
      '"-", "--" o vacío = sin respuesta. Un valor fuera de rango queda como sin respuesta, con aviso.',
      'Los textos de las preguntas no se leen del archivo: son configuración del sistema.',
      'Suba siempre el mes completo: los días del rango que no vengan en el archivo quedan en blanco.',
    ],
  },
  // Fase 259; Fase 302/303: las 3 bases del sistema de la clinica (no Wolkvox), sin plantilla propia.
  agendas_usuaria: {
    usan: 'CLINICA AURORA',
    especial: [
      '## De dónde sale',
      '',
      'Son las 3 bases que exporta el sistema de la clínica (no Wolkvox), tal cual: **Citas asignadas y cumplidas**, **Cancelaciones** e **Inasistencias**, un archivo .xls o .xlsx por base y una fila por cita. Se suben en Cargar datos › Clínica Aurora › Agendas › Subir (una o las tres a la vez; cada una en su casilla). En la carga de un solo archivo, la base se reconoce por el nombre del archivo.',
      '',
      '## Plantilla',
      '',
      'No hay plantilla en `server/plantillas/`: se suben las bases sin cambiarlas. Cada columna se busca por su nombre, en cualquier orden (sin importar mayúsculas, tildes, espacios ni guiones bajos). El mapa de nombres y sinónimos está en `public/js/agendas-usuaria-logic.js` (`AU_MAPA_ENCABEZADOS`; las bases en `AU_TIPOS_BASE`).',
      '',
      '## Privacidad',
      '',
      '**Las bases traen datos de pacientes (nombres, cédula, teléfono, dirección, diagnóstico, observaciones). Nada de eso sale del navegador**: el archivo se lee y se cuenta en el equipo de quien sube, y al servidor solo llegan cantidades por fecha de cita, fecha de registro, entidad, usuario que registra, especialidad, profesional, sede y base. El servidor rechaza cualquier otro campo.',
      '',
      '## Columnas que lee el sistema',
      '',
      '| Columna | Obligatoria | Para qué |',
      '|---|---|---|',
      '| fechacita | Sí | Fecha de cita: el mes de la carga, la gráfica por mes y el filtro "Fecha de cita" |',
      '| fecha_registro | No (Cancelaciones e Inasistencias no la traen) | Gráfica por mes según "Fecha de registro" y su filtro |',
      '| entidad | No | Filtro "Entidad" |',
      '| usuario_regcita | No | Usuario que registra: "INCONEXION", "INCONEXION A"… (otro usuario cuenta como "Clínica (no InConexion)") |',
      '| especial | No | Especialidad (filtro y gráfica) |',
      '| prof | No | Profesional (filtro y gráfica) |',
      '| nombresede (si no, sede) | No | Sede (filtro); `sede` trae un código, por eso va primero `nombresede` |',
      '',
      'Si una base no trae una columna que no es obligatoria, no es error: esas citas no suman en lo que dependa de esa columna. Las fechas vienen como fecha o número de Excel y se convierten sin zona horaria.',
      '',
      '## Vistas',
      '',
      'Una sola vista: filtros arriba (fecha de registro, fecha de cita, entidad, usuario que registra, especialidad, profesional y sede), botones de base (Todas / Citas asignadas y cumplidas / Cancelaciones / Inasistencias), una gráfica de línea por mes (según fecha de registro o fecha de cita) y una de barras por usuario que registra, especialidad o profesional (las 10 primeras, con "Ver más").',
      '',
      '## Nombre real de la asesora',
      '',
      'El archivo trae el usuario del sistema, no el nombre. El nombre se registra en Admin › Usuarios del sistema → asesora (por cliente) y se aplica al mostrar: si se corrige, cambian también los meses ya cargados. Sin registro, se ve el usuario tal cual. El cliente ve "Asesor 1, 2…".',
      '',
      '## Qué período cubre y qué reemplaza',
      '',
      'El mes es el de fechacita. Subir otra vez una base reemplaza solo esa base del mes (Deshacer por 30 días, como las demás cargas). Lo cargado antes con el reporte de una sola base no se muestra en esta vista.',
    ],
  },
  // Fase 284: errores de agendamiento, sin base: se registran en la plataforma.
  errores: {
    usan: 'CLINICA AURORA',
    especial: [
      '## De dónde sale',
      '',
      'No se sube ninguna base. Los errores de agendamiento los registra el supervisor del cliente (o el administrador) en la plataforma: en la pestaña Errores del tablero, botón «Agregar errores». Por cada error: mes, asesora (lista de las asesoras del cliente), cantidad (1 = un error individual) y observación. También se escribe ahí el «Plan de acción» del mes.',
      '',
      '## Qué muestra la pestaña',
      '',
      '«Flujo de errores por mes» (línea con la cantidad de cada mes; sigue a MESES), «Plan de acción» del mes y «Errores por asesor» del mes, con «Ver observación» en cada error. La pestaña se ve aunque no haya errores (lo avisa). El cliente solo la mira.',
      '',
      '## Privacidad',
      '',
      '**Ningún dato de pacientes.** Se guarda solo mes, asesora, cantidad y observación; el servidor rechaza una observación o un plan con números de documento o de teléfono.',
      '',
      '## Nombre real de la asesora',
      '',
      'Sale de Admin › Usuarios del sistema (alias por cliente), igual que en Agendas.',
      '',
      '## Quién puede registrar',
      '',
      'El administrador y el supervisor del cliente. Cada alta, edición o borrado queda con quién lo hizo y en el historial.',
    ],
  },
  calidad: {
    usan: 'ORLANT y MOBILIZE',
    especial: [
      '## De dónde sale',
      '',
      'No sale de Wolkvox: son los monitoreos que hace el equipo de Calidad. La carga normal es un monitoreo a la vez, desde el formulario de Calidad. Para muchos monitoreos de una vez existe la **carga masiva**.',
      '',
      '## Plantilla',
      '',
      'No hay un archivo fijo en `server/plantillas/`: las columnas de los ítems dependen de la plantilla de evaluación de cada cliente (y, cuando un cliente tenga sedes, de cada sede). La plantilla se descarga desde Calidad → Carga masiva, ya armada con los ítems de esa campaña (`descargarPlantillaMonitoreos`, `public/js/calidad-carga-masiva.js`). Trae 3 hojas: "Monitoreos" (para llenar), "Diccionario" (las preguntas) y "Resumen por Asesor" (consulta).',
      '',
      '## Columnas que lee el sistema (hoja "Monitoreos")',
      '',
      '| Columna | Obligatoria | También se acepta como |',
      '|---|---|---|',
      '| ASESOR | Sí | NOMBRE DEL ASESOR |',
      '| FECHA | Sí | |',
      '| CANAL | No | |',
      '| ID LLAMADA | No | ID / LLAMADA - WPP |',
      '| TELEFONO | No | # TELEFONO |',
      '| EVALUADOR | No | |',
      '| OBSERVACIONES | No | OBSERVACIONES GENERALES |',
      '| Una columna por ítem | Según la plantilla | El número al inicio ("3. …") identifica el ítem, aunque cambie la redacción |',
      '',
      '## Cómo detecta el encabezado',
      '',
      'Busca el encabezado en las primeras 10 filas (el archivo real trae título, leyenda y encabezados agrupados antes del encabezado real). Mayúsculas, tildes y espacios no importan.',
      '',
      '## Qué período cubre y qué reemplaza',
      '',
      'Cada fila es un monitoreo con su fecha. La carga masiva **agrega** monitoreos, no reemplaza meses.',
      '',
      '## Si falta una columna',
      '',
      'Sin ASESOR o FECHA, la carga no se hace y el aviso dice cuál falta. Un ítem que no está en el archivo queda sin calificar.',
      '',
      '## Ejemplo (inventado)',
      '',
      '| ASESOR | FECHA | CANAL | EVALUADOR | 1. Guion de saludo | 2. … |',
      '|---|---|---|---|---|---|',
      '| Asesor Ejemplo Uno | 2026-08-05 | LLAMADA | Evaluador Ejemplo | 1 | 1 |',
      '',
      '## Pendiente',
      '',
      'Aurora: su modelo es el de ORLANT estandarizado (14 ítems, 6 críticos), lo entrega el usuario. HLM: una plantilla por sede (Sede 33 y Sede Castilla). No se inventan ítems.',
    ],
  },
};

function celda(v) {
  return String(v == null ? '' : v).replace(/\|/g, '\\|');
}

function ficha(m) {
  const n = NOTAS[m.id] || {};
  const cargas = CARGAS.filter((c) => c.modulo === m.id);
  const L = [];
  L.push('# ' + m.nombre);
  L.push('');
  L.push('> Ficha generada por `scripts/plantillas/generar-fichas.js` desde el catálogo (`server/plantillas-cliente.js`) y las columnas reales del lector. No editar a mano: cambie el generador o `scripts/plantillas/modulos.js` y vuelva a correrlo.');
  L.push('');
  L.push('- **Id del catálogo:** `' + m.id + '` (grupo ' + m.grupo + (m.disponibleParaNuevos ? '' : ', **no disponible para clientes nuevos**') + ')');
  L.push('- **Lo usa hoy:** ' + (n.usan || '—'));
  L.push('- **Carga que necesita:** ' + m.carga);
  if (m.requiere) L.push('- **Necesita el módulo:** `' + m.requiere + '`');
  L.push('');
  if (n.especial) {
    L.push(...n.especial);
    return L.join('\n') + '\n';
  }
  for (const c of cargas) {
    const cols = columnasDeCarga(c);
    if (cargas.length > 1) { L.push('## ' + c.carga); L.push(''); }
    const h = cargas.length > 1 ? '###' : '##';
    L.push(h + ' De dónde sale');
    L.push('');
    L.push(c.origen);
    L.push('');
    if (c.nota) { L.push('**' + c.nota + '**'); L.push(''); }
    if (c.notaSkills) { L.push(c.notaSkills); L.push(''); }
    L.push(h + ' Plantilla oficial');
    L.push('');
    L.push('`server/plantillas/' + c.archivo + '` — hoja `' + c.hoja + '` (solo encabezados) + hoja `INSTRUCCIONES`. Es el formato nativo de Wolkvox con sus columnas cuando el archivo existe: se puede subir el archivo nativo tal cual.');
    L.push('');
    L.push(h + ' Columnas que lee el sistema');
    L.push('');
    L.push('| Columna | Obligatoria | Qué va | También se acepta como |');
    L.push('|---|---|---|---|');
    cols.forEach((x) => L.push('| ' + [x.encabezado, x.obligatoria ? 'Sí' : 'No', x.descripcion, x.alias.join(', ')].map(celda).join(' | ') + ' |'));
    L.push('');
    L.push(h + ' Cómo detecta el encabezado');
    L.push('');
    L.push(COMUN_ENCABEZADO);
    L.push('');
    L.push(h + ' Qué período cubre y qué reemplaza');
    L.push('');
    L.push(c.reemplazo + ' Antes de guardar, la vista previa muestra cuántos registros se van a reemplazar.');
    L.push('');
    L.push(h + ' Si falta una columna');
    L.push('');
    L.push(COMUN_FALTA);
    L.push('');
    L.push(h + ' Ejemplo (inventado)');
    L.push('');
    L.push('| ' + cols.map((x) => celda(x.encabezado)).join(' | ') + ' |');
    L.push('|' + cols.map(() => '---').join('|') + '|');
    L.push('| ' + cols.map((x) => celda(x.ejemplo)).join(' | ') + ' |');
    L.push('');
  }
  if (n.notas && n.notas.length) {
    L.push('## Notas');
    L.push('');
    n.notas.forEach((x) => L.push('- ' + x));
    L.push('');
  }
  if (n.pendiente) {
    L.push('## Pendiente');
    L.push('');
    L.push(n.pendiente);
    L.push('');
  }
  return L.join('\n');
}

if (require.main === module) {
  fs.mkdirSync(DESTINO, { recursive: true });
  for (const m of CATALOGO) {
    fs.writeFileSync(path.join(DESTINO, m.id + '.md'), ficha(m));
    console.log('ok ' + m.id + '.md');
  }
}

module.exports = { ficha };
