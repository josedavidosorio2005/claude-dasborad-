// wolkvox-destinos.js — Fase A24 (20/11/2026): a qué campaña escribe la consulta automática de
// Wolkvox. LISTA CERRADA de dos destinos; cualquier otro valor lanza un error (nunca se escribe en
// otra campaña por un parámetro mal puesto).
//
//  - replica: «MOBILIZE PRUEBAS API» (autorización del 18/11). Interruptores WOLKVOX_AUTO_ACTIVO y
//    WOLKVOX_AUTO_MODULOS. Sin corte de fecha. También la usa «Ejecutar ahora».
//  - real: el MOBILIZE real (autorización escrita del usuario, 20/11/2026, ver CLAUDE.md y
//    docs/plan-api-wolkvox.md §10.19). Solo desde NOVIEMBRE de 2026 (Fase A29: el usuario adelantó el
//    corte de diciembre a noviembre el 20/11; nunca toca octubre ni meses anteriores) y solo desde el
//    programador: «Ejecutar ahora» nunca escribe aquí. Interruptor propio
//    WOLKVOX_REAL_ACTIVO=1 (SSM, leído fresco antes de cada franja) y lista de módulos propia
//    WOLKVOX_REAL_MODULOS. Sin el parámetro, o con otro valor que «1», no corre ni deja rastro.
'use strict';

const CAMPANA_REPLICA = 'MOBILIZE PRUEBAS API';
const CAMPANA_REAL = 'MOBILIZE';
const DESDE_MES_REAL = '2026-11'; // Fase A29 (20/11/2026): antes '2026-12'

const DESTINOS = Object.freeze({
  replica: Object.freeze({ clave: 'replica', campana: CAMPANA_REPLICA, interruptor: 'WOLKVOX_AUTO_ACTIVO', modulos: 'WOLKVOX_AUTO_MODULOS', desdeMes: null, sufijoFranja: '' }),
  real: Object.freeze({ clave: 'real', campana: CAMPANA_REAL, interruptor: 'WOLKVOX_REAL_ACTIVO', modulos: 'WOLKVOX_REAL_MODULOS', desdeMes: DESDE_MES_REAL, sufijoFranja: ' real' }),
});
const CAMPANAS_PERMITIDAS = Object.freeze([CAMPANA_REPLICA, CAMPANA_REAL]);

// Sin destino = la réplica (lo de siempre). Acepta la clave ('replica' | 'real') o el objeto de la lista.
function destino(d) {
  if (d === undefined || d === null) return DESTINOS.replica;
  if (d === DESTINOS.replica || d === DESTINOS.real) return d;
  if (typeof d === 'string' && Object.prototype.hasOwnProperty.call(DESTINOS, d)) return DESTINOS[d];
  throw new Error('Destino de Wolkvox no permitido');
}

// Quita del plan los meses anteriores al corte del destino (el real: antes de 2026-11).
function recortarPlan(dest, meses) {
  const d = destino(dest);
  return d.desdeMes ? meses.filter((m) => m.mes >= d.desdeMes) : meses;
}

// ¿La campaña destino está lista para recibir datos? La réplica tiene que existir y ser INTERNA;
// el real tiene que existir y NO ser interno (así una confusión de nombres nunca cruza los dos).
function campanaLista(db, dest) {
  const d = destino(dest);
  const { esCampanaInterna } = require('./clientes-registro');
  if (d.clave === 'replica') return esCampanaInterna(db, d.campana);
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

module.exports = { DESTINOS, CAMPANAS_PERMITIDAS, CAMPANA_REPLICA, CAMPANA_REAL, DESDE_MES_REAL, destino, recortarPlan, campanaLista, skillsMapeadas, HUECOS_REAL, huecoPermitido, filasEnHueco, flujoConCargaManual };
