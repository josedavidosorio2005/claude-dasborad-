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

module.exports = { DESTINOS, CAMPANAS_PERMITIDAS, CAMPANA_REPLICA, CAMPANA_REAL, DESDE_MES_REAL, destino, recortarPlan, campanaLista, skillsMapeadas };
