// centro-cargas.js — Fase 153: datos del "Centro de cargas" que pidio Edwin
// (16/10/2026, diseno aprobado en la maqueta #456). Por cliente y modulo,
// cuantos registros hay en cada mes del ano, cuando se cargaron, quien y con
// que archivo; y las filas de un mes para "Descargar lo cargado".
//
// SOLO LECTURA: cada carga sigue usando su lector y su ruta de siempre.
'use strict';

const clientesRegistro = require('./clientes-registro');

// Por modulo del catalogo (plantillas-cliente.js): sus cargas, la tabla donde
// quedan, la columna de fecha/mes que dice a que mes pertenece cada fila, un
// filtro extra (Tipificacion: un canal por carga) y la plantilla oficial
// (server/plantillas/, Fase 153 P1).
const CARGAS_POR_MODULO = {
  flujo_llamadas: [{ id: 'flujo_llamadas', nombre: 'Flujo de Llamadas', tabla: 'calidad_nivel_servicio_diario', fecha: 'fecha', plantilla: 'PLANTILLA_FLUJO_LLAMADAS.xlsx' }],
  flujo_whatsapp: [{ id: 'flujo_whatsapp', nombre: 'Flujo de WhatsApp', tabla: 'trafico_whatsapp', fecha: 'fechaInicio', plantilla: 'PLANTILLA_FLUJO_WHATSAPP.xlsx' }],
  whatsapp_tiempos: [{ id: 'whatsapp_tiempos', nombre: 'WhatsApp por rangos de tiempo', tabla: 'whatsapp_tiempos', fecha: 'fecha', plantilla: 'PLANTILLA_WHATSAPP_TIEMPOS.xlsx' }],
  salida: [{ id: 'salida', nombre: 'Llamadas y WhatsApp de salida', tabla: 'salida_mensual', fecha: 'mes', plantilla: 'PLANTILLA_SALIDA_MENSUAL.xlsx' }],
  agendas: [{ id: 'agendas', nombre: 'Agendas', tabla: 'agendas', fecha: 'fechaSolicitud', plantilla: 'PLANTILLA_AGENDAS.xlsx' }],
  efectividad_agendamiento: [{ id: 'efectividad_agendamiento', nombre: 'Efectividad de Agendamiento', tabla: 'efectividad_agendamiento', fecha: 'mes', plantilla: 'PLANTILLA_EFECTIVIDAD_AGENDAMIENTO.xlsx' }],
  inasistencia: [{ id: 'inasistencia', nombre: 'Inasistencia', tabla: 'inasistencias', fecha: 'mes', plantilla: 'PLANTILLA_INASISTENCIA.xlsx' }],
  efectividad_citas: [{ id: 'efectividad_citas', nombre: 'Efectividad de Citas', tabla: 'efectividad_citas', fecha: 'mes', plantilla: 'PLANTILLA_EFECTIVIDAD_CITAS.xlsx' }],
  // Fase 194 (pedido del 27/10): las contestadas unicas y la salida conectada
  // salen del CDR de Tipificacion, asi que el Centro solo muestra los dos
  // reportes de Wolkvox tal cual. Las cargas viejas quedan `retirada`: no se
  // muestran ni ofrecen plantilla, pero sus datos (que no se borran y siguen
  // en los meses sin CDR) se pueden seguir eliminando o deshaciendo.
  llamadas_unicas: [
    { id: 'llamadas_unicas', nombre: 'Llamadas Únicas (ingreso)', tabla: 'llamadas_unicas', fecha: 'fecha', plantilla: null, retirada: true },
    { id: 'llamadas_salida', nombre: 'Llamadas de Salida', tabla: 'llamadas_salida', fecha: 'fecha', plantilla: null, retirada: true },
    // Plantilla = el reporte de Wolkvox tal cual (Fase 194), nada armado a mano.
    { id: 'llamadas_abandonadas', nombre: 'Detalle de llamadas abandonadas (Wolkvox)', tabla: 'llamadas_abandonadas', fecha: 'fecha', plantilla: 'PLANTILLA_LLAMADAS_ABANDONADAS.xlsx' },
    { id: 'llamadas_no_conectadas', nombre: 'Llamadas de salida no conectadas (Wolkvox)', tabla: 'llamadas_no_conectadas', fecha: 'fecha', plantilla: 'PLANTILLA_LLAMADAS_NO_CONECTADAS.xlsx' },
  ],
  // Fase 196: el reporte de cola por hora de Wolkvox, tal cual.
  flujo_hora: [{ id: 'flujo_hora', nombre: 'Flujo por hora', tabla: 'flujo_hora', fecha: 'fecha', plantilla: 'PLANTILLA_FLUJO_HORA.xlsx' }],
  tipificacion: [
    { id: 'tipificacion_llamadas', nombre: 'Tipificación de llamadas', tabla: 'tipificaciones', fecha: 'fecha', filtro: { canal: 'LLAMADAS' }, plantilla: 'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx' },
    { id: 'tipificacion_whatsapp', nombre: 'Tipificación de WhatsApp', tabla: 'tipificaciones', fecha: 'fecha', filtro: { canal: 'WHATSAPP' }, plantilla: 'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx' },
  ],
  encuesta: [{ id: 'encuesta', nombre: 'Encuesta', tabla: 'encuestas', fecha: 'fecha', plantilla: 'PLANTILLA_ENCUESTA.xlsx' }],
  // Fase 172: resumen por asesor de la plantilla de Edwin (Mobilize). Mensual.
  calidad_resumen: [{ id: 'calidad_resumen', nombre: 'Calidad: resumen por asesor', tabla: 'calidad_resumen_asesor', fecha: 'mes', plantilla: 'PLANTILLA_CALIDAD_RESUMEN.xlsx' }],
  // Calidad: la plantilla depende de los items de cada campana (se descarga
  // desde Calidad), por eso no hay archivo fijo.
  calidad: [{ id: 'calidad', nombre: 'Monitoreos de Calidad', tabla: 'monitoreos', fecha: 'fecha', plantilla: null }],
};

// Fase 153 (PR 5): modulos con permiso propio `cargar_<modulo>` para CALIDAD
// (auth.canLoadModule). Calidad no: sus monitoreos tienen su propio permiso
// (canEvaluateCampaign) y no suben desde el Centro.
const MODULOS_CON_PERMISO = Object.keys(CARGAS_POR_MODULO).filter((m) => m !== 'calidad');

// Lista cerrada de plantillas que se pueden descargar (nunca una ruta armada
// con lo que manda el navegador).
const PLANTILLAS_DESCARGABLES = Object.values(CARGAS_POR_MODULO)
  .flat()
  .map((c) => c.plantilla)
  .filter(Boolean);

// Milisegundos de un createdAt guardado como ISO (UTC) o como
// "dd/mm/aaaa hh:mm:ss". Ese texto lo escribe nowStr() con la hora LOCAL DEL
// PROCESO (ver fecha-limites.js): en produccion el servidor corre en UTC; en
// un equipo local, en Colombia. Se lee en esa misma zona. Fase 173: antes se
// leia siempre como Colombia (+5 h) y en produccion el Centro mostraba la
// hora de carga 5 horas despues de la real.
function instanteCarga(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s || '').trim());
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4] || 0, +m[5] || 0, +m[6] || 0).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function _mesesDelAnio(anio) {
  const out = [];
  for (let m = 1; m <= 12; m++) out.push(anio + '-' + (m < 10 ? '0' : '') + m);
  return out;
}

// Por mes: registros, ultima carga (createdAt), quien y archivo de la carga
// mas reciente de ese mes. Las columnas tabla/fecha/filtro salen de
// CARGAS_POR_MODULO (nunca del navegador).
function resumenCarga(db, campana, carga, anio) {
  const filtroSql = carga.filtro ? Object.keys(carga.filtro).map((k) => ` AND ${k} = @f_${k}`).join('') : '';
  const params = { campana, desde: anio + '-01', hasta: anio + '-12' };
  if (carga.filtro) Object.keys(carga.filtro).forEach((k) => { params['f_' + k] = carga.filtro[k]; });
  const mesExpr = `substr(${carga.fecha}, 1, 7)`;
  // createdAt no tiene un solo formato entre tablas (ISO en UTC, o
  // "dd/mm/aaaa hh:mm:ss" hora Colombia): se trae cada valor distinto (uno
  // por carga) y la mas reciente se decide aqui, nunca comparando textos.
  const filas = db.prepare(
    `SELECT ${mesExpr} AS mes, COUNT(*) AS registros, GROUP_CONCAT(DISTINCT createdAt) AS cargas
       FROM ${carga.tabla}
      WHERE campana = @campana AND ${mesExpr} BETWEEN @desde AND @hasta${filtroSql}
      GROUP BY mes`
  ).all(params);
  // Monitoreos no guarda archivo ni quien cargo (cada uno lo hace un evaluador).
  const ultimo = carga.tabla === 'monitoreos' ? null : db.prepare(
    `SELECT cargadoPorNombre, archivoNombre FROM ${carga.tabla}
      WHERE campana = @campana AND ${mesExpr} = @mes AND createdAt = @createdAt${filtroSql}
      LIMIT 1`
  );
  const porMes = {};
  filas.forEach((f) => {
    const crudo = String(f.cargas || '').split(',').filter(Boolean)
      .map((s) => ({ s, t: instanteCarga(s) }))
      .filter((x) => x.t !== null)
      .sort((a, b) => b.t - a.t)[0];
    const u = (ultimo && crudo && ultimo.get(Object.assign({}, params, { mes: f.mes, createdAt: crudo.s }))) || {};
    porMes[f.mes] = {
      registros: f.registros,
      ultimaCarga: crudo ? new Date(crudo.t).toISOString() : null,
      cargadoPor: u.cargadoPorNombre || null,
      archivo: u.archivoNombre || null,
    };
  });
  return _mesesDelAnio(anio).map((mes) => Object.assign({ mes, registros: 0, ultimaCarga: null, cargadoPor: null, archivo: null }, porMes[mes] || {}));
}

// Modulos del cliente (registro) en el orden del catalogo, con sus cargas y
// sus 12 meses. `catalogo` = CATALOGO de plantillas-cliente.js.
function resumenCliente(db, cliente, anio, catalogo) {
  const reg = clientesRegistro.leerRegistro(db).find((c) => c.nombre === cliente);
  if (!reg) return null;
  return catalogo
    .filter((m) => reg.modulos.includes(m.id) && CARGAS_POR_MODULO[m.id])
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      grupo: m.grupo,
      cargas: CARGAS_POR_MODULO[m.id].filter((c) => !c.retirada).map((c) => ({ // Fase 194
        id: c.id,
        nombre: c.nombre,
        plantilla: c.plantilla,
        meses: resumenCarga(db, cliente, c, anio),
      })),
    }));
}

// Una carga por su id (ej. 'tipificacion_whatsapp'), o null.
function cargaPorId(id) {
  for (const m of Object.keys(CARGAS_POR_MODULO)) {
    const c = CARGAS_POR_MODULO[m].find((x) => x.id === id);
    if (c) return Object.assign({ modulo: m }, c);
  }
  return null;
}

// Columnas que NUNCA salen en "Descargar lo cargado": internas o, en
// Calidad, datos de contacto (telefono, Fase 151) y respuestas crudas.
const COLUMNAS_EXCLUIDAS = ['id', 'campana', 'telefono', 'answers', 'evaluadorUserId', 'asesorUserId', 'vistoPorAsesorAt'];

// Filas de un mes de una carga, tal como estan guardadas (sin columnas
// internas). Calidad no se descarga aqui: tiene su propia exportacion.
function datosDelMes(db, campana, carga, mes) {
  if (carga.tabla === 'monitoreos') return null;
  const cols = db.prepare(`PRAGMA table_info(${carga.tabla})`).all().map((c) => c.name).filter((c) => !COLUMNAS_EXCLUIDAS.includes(c));
  const filtroSql = carga.filtro ? Object.keys(carga.filtro).map((k) => ` AND ${k} = @f_${k}`).join('') : '';
  const params = { campana, mes };
  if (carga.filtro) Object.keys(carga.filtro).forEach((k) => { params['f_' + k] = carga.filtro[k]; });
  const filas = db.prepare(
    `SELECT ${cols.join(', ')} FROM ${carga.tabla}
      WHERE campana = @campana AND substr(${carga.fecha}, 1, 7) = @mes${filtroSql}
      ORDER BY ${carga.fecha}`
  ).all(params);
  return { columnas: cols, filas };
}

// Cuantos registros tiene un mes de una carga y cuantos caen entre dos fechas
// (inclusive): el aviso de la vista previa del Centro ("se reemplazan esos
// dias; el resto del mes queda igual"). Solo lectura. 'AAAA-MM-DD' compara
// por dia; con hora ('AAAA-MM-DD HH:MM[:SS]', Agendas: su lector reemplaza
// de la primera a la ultima FECHA_SOLICITUD con hora) compara el valor entero.
function conteoRango(db, campana, carga, mes, desde, hasta) {
  const filtroSql = carga.filtro ? Object.keys(carga.filtro).map((k) => ` AND ${k} = @f_${k}`).join('') : '';
  const params = { campana, mes, desde, hasta };
  if (carga.filtro) Object.keys(carga.filtro).forEach((k) => { params['f_' + k] = carga.filtro[k]; });
  const dia = String(desde).length > 10 ? carga.fecha : `substr(${carga.fecha}, 1, 10)`;
  const r = db.prepare(
    `SELECT COUNT(*) AS enMes, COALESCE(SUM(CASE WHEN ${dia} BETWEEN @desde AND @hasta THEN 1 ELSE 0 END), 0) AS enRango
       FROM ${carga.tabla}
      WHERE campana = @campana AND substr(${carga.fecha}, 1, 7) = @mes${filtroSql}`
  ).get(params);
  return { enMes: r.enMes, enRango: r.enRango };
}

module.exports = { conteoRango, MODULOS_CON_PERMISO, CARGAS_POR_MODULO, PLANTILLAS_DESCARGABLES, COLUMNAS_EXCLUIDAS, instanteCarga, resumenCarga, resumenCliente, cargaPorId, datosDelMes };
