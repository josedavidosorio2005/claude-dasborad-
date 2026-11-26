// wolkvox-destinos.js — Fase A24 (20/11/2026): a qué campaña escribe la consulta automática de
// Wolkvox. LISTA CERRADA de destinos (tres desde la Fase N6: + la réplica de ORLANT); cualquier otro valor lanza un error (nunca se escribe en
// otra campaña por un parámetro mal puesto).
//
//  - (Fase W10, 26/11/2026: la réplica «MOBILIZE PRUEBAS API» se BORRÓ por pedido del usuario; su destino
//    `replica` ya no existe. El MOBILIZE real se actualiza solo con su destino `real`.)
//  - real: el MOBILIZE real (autorización escrita del usuario, 20/11/2026, ver CLAUDE.md y
//    docs/plan-api-wolkvox.md §10.19). Solo desde NOVIEMBRE de 2026 (Fase A29: el usuario adelantó el
//    corte de diciembre a noviembre el 20/11; nunca toca octubre ni meses anteriores) y solo desde el
//    programador: «Ejecutar ahora» nunca escribe aquí. Interruptor propio
//    WOLKVOX_REAL_ACTIVO=1 (SSM, leído fresco antes de cada franja) y lista de módulos propia
//    WOLKVOX_REAL_MODULOS. Sin el parámetro, o con otro valor que «1», no corre ni deja rastro.
'use strict';

// Fase N6 (autorización escrita del usuario, 23/11/2026, CLAUDE.md): réplica oculta de ORLANT.
const CAMPANA_REPLICA_ORLANT = 'ORLANT PRUEBAS API';
const CAMPANA_REAL = 'MOBILIZE';
// Fase AU2 (autorización escrita del usuario, 26/11/2026, CLAUDE.md): réplica oculta de Clínica Aurora.
const CAMPANA_REPLICA_AURORA = 'CLINICA AURORA PRUEBAS API';
// Mapeo de Edwin (26/11): qué skills entran en cada reporte de Aurora (nombres tal como los da Wolkvox; en el
// «Probar» del 25/11 la skill de entrada se llama «LINEA DE ENTRADA»). «-» = salida (cdr_1 la trae sin skill).
// Tipificación (llamadas y WhatsApp) solo con los agentes de Inconexión de la lista editable (wolkvox-agentes.js).
const FILTROS_AURORA = Object.freeze({
  flujoSkills: Object.freeze(['LINEA DE ENTRADA']),
  cdrSkills: Object.freeze(['LINEA DE ENTRADA', '-']),
  waSkills: Object.freeze(['CONFIRMACIONES WHATSAPP', 'RECORDACIONES 3 DIAS', 'WHATSAPP']),
  agentes: true,
});
const DESDE_MES_REAL = '2026-11'; // Fase A29 (20/11/2026): antes '2026-12'

// Fase N3 (autorización escrita del usuario, 24/11/2026): WhatsApp por API (chat_1) SOLO en la réplica de
// ORLANT. Por eso MOBILIZE (réplica y real) pasa de «todos» (null) a su lista cerrada de siempre: ningún módulo
// nuevo le llega solo. MOBILIZE no maneja WhatsApp (usuario, 19/11).
const MODULOS_MOBILIZE = Object.freeze(['flujo_hora', 'cdr', 'encuesta', 'no_conectadas', 'abandonadas']);

const DESTINOS = Object.freeze({
  // `modulosPermitidos`: null = todos los de MODULOS. `cuentasPrueba`: quitar la cuenta de pruebas de
  // MOBILIZE (agent_id/huella, Fase A26; es de esa operación). `perfilCdr`: opciones del lector del CDR,
  // las mismas de la carga manual de cada cliente (public/js/cargas.js).
  // Fase A33 (autorización escrita del usuario, 24/11/2026): `encuestaConnId` = la Encuesta (diagram_4) guarda el
  // CONN_ID (solo el ID de la llamada, para Calidad de encuestas). SOLO el MOBILIZE real; la réplica sigue sin él.
  real: Object.freeze({ clave: 'real', campana: CAMPANA_REAL, operacion: 'MOBILIZE', interna: false, interruptor: 'WOLKVOX_REAL_ACTIVO', modulos: 'WOLKVOX_REAL_MODULOS', desdeMes: DESDE_MES_REAL, sufijoFranja: ' real', modulosPermitidos: MODULOS_MOBILIZE, cuentasPrueba: true, perfilCdr: 'mobilize', encuestaConnId: true }),
  // Fase N3 (24/11/2026): + WhatsApp (chat_1), sin datos del cliente.
  // Fase N6 (23/11/2026): SOLO la réplica de ORLANT, y solo Flujo (skill_1), Flujo por hora (skill_7),
  // Tipificación (cdr_1, sin datos sensibles) y No conectadas (cdr_5). Encuesta y abandonadas no están
  // autorizadas para ORLANT. Interruptor y lista de módulos propios; arranca apagada.
  orlant_replica: Object.freeze({ clave: 'orlant_replica', campana: CAMPANA_REPLICA_ORLANT, operacion: 'ORLANT', interna: true, interruptor: 'WOLKVOX_ORLANT_AUTO_ACTIVO', modulos: 'WOLKVOX_ORLANT_AUTO_MODULOS', desdeMes: null, sufijoFranja: ' orlant', modulosPermitidos: Object.freeze(['flujo_hora', 'cdr', 'no_conectadas', 'whatsapp']), cuentasPrueba: false, perfilCdr: 'orlant', encuestaConnId: false, flujoPorModulos: true }), // Fase N3b: el Flujo también va por la lista («flujo»)
  // Fase AU2 (26/11/2026): SOLO la réplica de Aurora: Flujo (skill_1), Tipificación de llamadas (cdr_1) y WhatsApp
  // (chat_1: tráfico, tiempos y Tipificación de WhatsApp). Con los filtros de Edwin. Arranca apagada; el Flujo
  // también va por la lista («flujo»). El CDR con el perfil de ORLANT (Aurora usa su regla, provisional).
  // Fase AU3 (26/11/2026): el cdr_1 del mes completo de Aurora pasa los 30 s (octubre): se pide por semanas
  // (cdrDiasPorConsulta: 7 → 5 consultas en un mes de 31 días) y el mes se escribe solo si llegaron todas.
  // Fase AU4 (autorización escrita del usuario, 26/11/2026): «Ejecutar ahora» de esta réplica espera 2 min (no 10).
  aurora_replica: Object.freeze({ clave: 'aurora_replica', campana: CAMPANA_REPLICA_AURORA, operacion: 'AURORA', interna: true, interruptor: 'WOLKVOX_AURORA_AUTO_ACTIVO', modulos: 'WOLKVOX_AURORA_AUTO_MODULOS', desdeMes: null, sufijoFranja: ' aurora', modulosPermitidos: Object.freeze(['cdr', 'whatsapp']), cuentasPrueba: false, perfilCdr: 'orlant', encuestaConnId: false, flujoPorModulos: true, filtros: FILTROS_AURORA, cdrDiasPorConsulta: 7, esperaEjecutarMs: 2 * 60 * 1000 }),
});
const CAMPANAS_PERMITIDAS = Object.freeze([CAMPANA_REAL, CAMPANA_REPLICA_ORLANT, CAMPANA_REPLICA_AURORA]);

// Acepta la clave ('real' | 'orlant_replica' | 'aurora_replica') o el objeto de la lista.
// Fase W10: SIN destino ya no hay valor por defecto (antes era la réplica de MOBILIZE, que se borró): lanza, así
// ninguna llamada puede escribir en una campaña que no nombró.
function destino(d) {
  if (d === undefined || d === null) throw new Error('Falta el destino de Wolkvox');
  if (Object.values(DESTINOS).includes(d)) return d;
  if (typeof d === 'string' && Object.prototype.hasOwnProperty.call(DESTINOS, d)) return DESTINOS[d];
  throw new Error('Destino de Wolkvox no permitido');
}

// Quita del plan los meses anteriores al corte del destino (el real: antes de 2026-11).
function recortarPlan(dest, meses) {
  const d = destino(dest);
  return d.desdeMes ? meses.filter((m) => m.mes >= d.desdeMes) : meses;
}

// Fase N5 (23/11/2026): la operación de Wolkvox (de quién es el token y el contador del día) sale
// del destino, no de una constante. Hoy los dos destinos son de MOBILIZE: nada cambia para ellos.
function operacionDe(dest) { return destino(dest).operacion; }
// ¿El destino puede correr ese módulo? (el Flujo, 'flujo', siempre).
function moduloPermitido(dest, modulo) {
  const d = destino(dest);
  return modulo === 'flujo' || !d.modulosPermitidos || d.modulosPermitidos.includes(modulo);
}
// Fase N3b (26/11/2026, pedido del usuario): en la réplica de ORLANT el Flujo (skill_1) se enciende como
// un módulo más: solo corre si «flujo» está en su lista (WOLKVOX_ORLANT_AUTO_MODULOS), además del
// interruptor. Así WhatsApp puede correr solo. MOBILIZE (réplica y real) no cambia: su Flujo va con el interruptor.
function flujoEnLista(dest, valor) {
  const d = destino(dest);
  if (!d.flujoPorModulos) return true;
  return String(valor == null ? '' : valor).split(',').some((x) => x.trim().toLowerCase() === 'flujo');
}
// Fase N6: el destino INTERNO (réplica) de una campaña, o null. Lo usan «Ejecutar ahora» y el estado.
function destinoInterno(campana) {
  return Object.values(DESTINOS).find((d) => d.interna && d.campana === campana) || null;
}

// ¿La campaña destino está lista para recibir datos? La réplica tiene que existir y ser INTERNA;
// el real tiene que existir y NO ser interno (así una confusión de nombres nunca cruza los dos).
function campanaLista(db, dest) {
  const d = destino(dest);
  const { esCampanaInterna } = require('./clientes-registro');
  if (d.interna) return esCampanaInterna(db, d.campana);
  return !!db.prepare('SELECT 1 FROM clientes_registro WHERE nombre = ?').get(d.campana) && !esCampanaInterna(db, d.campana);
}

// Para el Flujo del real: solo las skills que el mapeo de tráfico ya tiene a nombre de MOBILIZE (sin
// sede). El mapeo nunca se toca: una skill nueva o de otra campaña no entra (se cuenta en el Historial).
function skillsMapeadas(db, campana) {
  return new Set(db.prepare("SELECT skillName FROM trafico_skill_mapeo WHERE campana = ? AND (sede IS NULL OR sede = '')").all(campana).map((r) => r.skillName));
}

// ── Fase A30 (20/11/2026): HUECOS del MOBILIZE real ──
// Autorización escrita del usuario (20/11/2026, CLAUDE.md): un administrador puede llenar a mano, UNA
// vez por pestaña, SOLO estos meses y pestañas del real, y SOLO si la pestaña no tiene ninguna fila en
// ese mes (se revisa antes de consultar y otra vez justo antes de escribir). LISTA CERRADA: ampliarla
// es una autorización nueva por escrito. Nov/2025–jun/2026: Wolkvox los rechaza («Validate dates entered»).
// Fase A32 (autorización escrita del usuario, 21/11/2026): + no_conectadas (cdr_5) de julio de 2026.
const HUECOS_REAL = Object.freeze({ '2026-07': Object.freeze(['flujo', 'flujo_hora', 'cdr', 'no_conectadas', 'abandonadas']) });
// Pestaña -> tabla (y filtro) donde se mira si el real ya tiene datos de ese mes.
const TABLA_HUECO = Object.freeze({
  flujo: { tabla: 'calidad_nivel_servicio_diario', extra: '' },
  flujo_hora: { tabla: 'flujo_hora', extra: '' },
  cdr: { tabla: 'tipificaciones', extra: " AND canal = 'LLAMADAS'" },
  abandonadas: { tabla: 'llamadas_abandonadas', extra: '' },
  no_conectadas: { tabla: 'llamadas_no_conectadas', extra: '' }, // Fase A32
});
function huecoPermitido(mes, modulo) {
  return typeof mes === 'string' && Object.prototype.hasOwnProperty.call(HUECOS_REAL, mes) && HUECOS_REAL[mes].includes(modulo);
}
// Filas que el MOBILIZE real YA tiene en esa pestaña y mes (0 = hueco). Lanza si no es de la lista.
function filasEnHueco(db, mes, modulo) {
  if (!huecoPermitido(mes, modulo)) throw new Error('Hueco no permitido');
  const t = TABLA_HUECO[modulo];
  const hasta = mes + '-31';
  return db.prepare('SELECT COUNT(*) n FROM ' + t.tabla + ' WHERE campana = ? AND substr(fecha, 1, 10) BETWEEN ? AND ?' + t.extra).get(CAMPANA_REAL, mes + '-01', hasta).n;
}
// ¿El Flujo del real en ese mes tiene alguna fila que NO vino de la consulta automática? (carga manual)
function flujoConCargaManual(db, mes, archivoApi) {
  return db.prepare("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha, 1, 7) = ? AND COALESCE(archivoNombre, '') <> ?").get(CAMPANA_REAL, mes, archivoApi).n > 0;
}

module.exports = { DESTINOS, CAMPANAS_PERMITIDAS, flujoEnLista, CAMPANA_REPLICA_ORLANT, CAMPANA_REPLICA_AURORA, FILTROS_AURORA, CAMPANA_REAL, DESDE_MES_REAL, destino, operacionDe, moduloPermitido, destinoInterno, recortarPlan, campanaLista, skillsMapeadas, HUECOS_REAL, huecoPermitido, filasEnHueco, flujoConCargaManual };
