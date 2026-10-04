#!/usr/bin/env node
// scripts/limpieza-fase115-residuo-trafico.js — Fase 115 (autorizado
// explicitamente, 2026-10-04): limpia el UNICO residuo de prueba conocido
// de la Fase 67 en Trafico de Llamadas de ORLANT -- 2 filas sinteticas del
// 2026-08-17 (CALL INBOUND ORLANT 3P / CALL INBOUND ORLANT GENERAL),
// cargadas como "llenado-agosto-produccion.xlsx" y marcadas "Fase 67 -
// prueba real (borrar automatico)" en su momento, nunca borradas --
// descubierto al comparar agosto contra el archivo real de Edwin (ver
// docs/pendientes.md y docs/historico/progress-fases.md, Fase 115).
//
// Filtro EXACTO y fijo (nunca parametrizable desde afuera, a proposito --
// este script hace UNA sola cosa, no es una herramienta general de
// borrado):
//   campana='ORLANT', fecha='2026-08-17',
//   skillName IN ('CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL'),
//   archivoNombre='llenado-agosto-produccion.xlsx'
//
// --revisar (default): SOLO LECTURA. Cuenta e imprime las filas que
//   calzarian con el filtro exacto (fecha/skill/total/contestadas/
//   abandonadas/archivo/cargadoPor -- nunca mas columnas de las que hacen
//   falta para confirmar que es el residuo correcto). Nunca borra nada.
// --borrar: vuelve a contar con el MISMO filtro justo antes de borrar (por
//   si algo cambio entre un "revisar" y el "borrar") y ABORTA sin tocar
//   nada si el conteo no es exactamente el esperado. Si coincide, borra
//   esas filas (y solo esas) y recalcula el agregado mensual de
//   ORLANT/2026-08 con la MISMA funcion que usa cualquier carga real
//   (recalcularMensual, nivel-servicio-diario.js) -- nunca una resta a
//   mano.
//
// Uso (dentro del contenedor ya corriendo, ver
// .github/workflows/limpieza-fase115-residuo-trafico.yml):
//   docker compose exec -T app node scripts/limpieza-fase115-residuo-trafico.js --revisar
//   docker compose exec -T app node scripts/limpieza-fase115-residuo-trafico.js --borrar
//
// En produccion los secretos (JWT_SECRET, MASTER_ADMIN_PASSWORD_HASH) NO
// viven en el entorno del contenedor -- `bootstrap.js` (el proceso
// principal, PID 1) los hidrata desde AWS SSM SOLO en su propio
// process.env al arrancar (ver secrets.js). Un `docker compose exec` abre
// un proceso NUEVO que no pasa por bootstrap.js, asi que `require('../db')`
// (que valida ./config) fallaria con "JWT_SECRET es obligatorio" si no se
// hidrata aqui tambien -- mismo hydrateEnv(), mismo rol IAM de la
// instancia, ningun permiso nuevo.
'use strict';
const { hydrateEnv } = require('../secrets');

const FILTRO = {
  campana: 'ORLANT',
  fecha: '2026-08-17',
  skills: ['CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL'],
  archivoNombre: 'llenado-agosto-produccion.xlsx',
};
const FILAS_ESPERADAS = 2;

function filasQueCalzan(db) {
  const placeholders = FILTRO.skills.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT id, fecha, skillName, totalLlamadas, contestadas, llamadasAbandonadas, archivoNombre, cargadoPorNombre
       FROM calidad_nivel_servicio_diario
       WHERE campana = ? AND fecha = ? AND skillName IN (${placeholders}) AND archivoNombre = ?`
    )
    .all(FILTRO.campana, FILTRO.fecha, ...FILTRO.skills, FILTRO.archivoNombre);
}

function totalOrlantAgosto2026(db) {
  const filas = db
    .prepare(`SELECT totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = 'ORLANT' AND substr(fecha,1,7) = '2026-08'`)
    .all();
  return filas.reduce((a, r) => a + (r.totalLlamadas || 0), 0);
}

async function main() {
  await hydrateEnv();
  const db = require('../db');
  const { recalcularMensual } = require('../nivel-servicio-diario');

  const borrar = process.argv.includes('--borrar');
  const filas = filasQueCalzan(db);

  console.log(`[limpieza-fase115] Filtro: campana=${FILTRO.campana} fecha=${FILTRO.fecha} skills=[${FILTRO.skills.join(', ')}] archivoNombre="${FILTRO.archivoNombre}"`);
  console.log(`[limpieza-fase115] Filas que calzan: ${filas.length}`);
  filas.forEach((f) => {
    console.log(
      `  - id=${f.id} fecha=${f.fecha} skill="${f.skillName}" total=${f.totalLlamadas} contestadas=${f.contestadas} abandonadas=${f.llamadasAbandonadas} cargadoPor="${f.cargadoPorNombre}"`
    );
  });

  if (filas.length !== FILAS_ESPERADAS) {
    console.error(`[limpieza-fase115] ABORTA: se esperaban exactamente ${FILAS_ESPERADAS} fila(s) con este filtro, se encontraron ${filas.length}. No se toca nada.`);
    process.exitCode = 1;
    return;
  }

  if (!borrar) {
    console.log('[limpieza-fase115] Modo revisar (solo lectura) -- nada se borro. Corre con --borrar para borrar estas filas exactas.');
    return;
  }

  const totalAntes = totalOrlantAgosto2026(db);
  const ids = filas.map((f) => f.id);
  const placeholdersIds = ids.map(() => '?').join(',');
  const info = db.prepare(`DELETE FROM calidad_nivel_servicio_diario WHERE id IN (${placeholdersIds})`).run(...ids);
  console.log(`[limpieza-fase115] Borradas: ${info.changes} fila(s) (id=${ids.join(',')}).`);

  const mensual = recalcularMensual(db, 'ORLANT', '2026-08', new Date().toISOString(), null);
  console.log(`[limpieza-fase115] Agregado mensual ORLANT/2026-08 recalculado: llamadasTotales=${mensual ? mensual.llamadasTotales : 'null'}, contestadas20s=${mensual ? mensual.contestadas20s : 'null'}`);

  const totalDespues = totalOrlantAgosto2026(db);
  console.log(`[limpieza-fase115] Total de llamadas de ORLANT en 2026-08 (las 3 lineas): antes=${totalAntes}, despues=${totalDespues}`);
}

main().catch((err) => {
  console.error('[limpieza-fase115] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
