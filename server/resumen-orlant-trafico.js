// resumen-orlant-trafico.js — Fase 39: mantiene llamadas_3p/nivel_atencion_3p/
// llamadas_general/nivel_atencion_general (seccion "resumen" de ORLANT,
// dashboard_cargas) sincronizados automaticamente con los datos que YA se
// suben por Trafico/Wolkvox (calidad_nivel_servicio_diario) — sin que nadie
// tenga que llenar la hoja "resumen" a mano solo para estos 4 campos.
//
// Solo ORLANT usa estos 4 nombres de campo (confirmado contra
// dashboard-secciones.js: CLINICA AURORA y HOSPITAL LA MARIA no los tienen),
// asi que este modulo esta deliberadamente escrito para una sola campana, no
// generalizado.
//
// Linea (3P / GENERAL) inferida del nombre del skill (no hay un campo
// "linea" en trafico_skill_mapeo, y agregar uno solo para esto es mas estado
// que mantener por 2 skills conocidas hoy: "CALL INBOUND ORLANT 3P" y
// "CALL INBOUND ORLANT GENERAL"). Un skill que no calce con ningun patron
// simplemente no aporta a ninguna de las 2 lineas -- no rompe la carga, solo
// no se refleja en estos 4 campos hasta que se registre con un nombre
// reconocible.
'use strict';

const ORLANT = 'ORLANT';
const SECCION = 'resumen';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const r2 = (n) => Math.round(n * 100) / 100;

// null si el skill no calza con ningun patron conocido -- deliberado, ver
// comentario de cabecera.
function lineaDeSkill(skillName) {
  const s = String(skillName || '').trim().toUpperCase();
  if (/ 3P$/.test(s)) return '3P';
  if (/ GENERAL$/.test(s)) return 'GENERAL';
  return null;
}

// Recalcula los 4 campos para UN mes de ORLANT, SIEMPRE desde cero sobre
// TODAS las filas de calidad_nivel_servicio_diario que existan hoy para ese
// mes (mismo criterio que recalcularMensual en nivel-servicio-diario.js) --
// nivelAtencionPct = contestadas totales del periodo / llamadas totales del
// periodo, nunca promedio de los % diarios.
//
// Upsertea en dashboard_cargas (ORLANT, resumen, mes) sin tocar ningun otro
// campo que ya haya en esa fila (whatsapp, agendas, citas, etc.) -- se lee
// el JSON existente, se mezclan solo estos 4 campos, se vuelve a guardar.
// Si Trafico no tiene NADA para ese mes (ninguna fila clasificable en
// 3P/GENERAL), no toca dashboard_cargas en absoluto -- un resumen cargado a
// mano para ese mes queda intacto, tal como estaba.
//
// Devuelve { actualizado, campos, skillsSinClasificar } para que el caller
// (o un test) pueda confirmar que paso, sin tener que releer la fila.
function recalcularResumenOrlantDesdeTrafico(db, mes, now) {
  const ts = now || nowStr();
  const filas = db
    .prepare('SELECT skillName, totalLlamadas, contestadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ?')
    .all(ORLANT, mes);

  const porLinea = {
    '3P': { total: 0, contestadas: 0, tiene: false },
    GENERAL: { total: 0, contestadas: 0, tiene: false },
  };
  const skillsSinClasificar = new Set();
  for (const f of filas) {
    const linea = lineaDeSkill(f.skillName);
    if (!linea) {
      skillsSinClasificar.add(f.skillName);
      continue;
    }
    porLinea[linea].total += f.totalLlamadas || 0;
    porLinea[linea].contestadas += f.contestadas || 0;
    porLinea[linea].tiene = true;
  }

  const campos = {};
  if (porLinea['3P'].tiene) {
    campos.llamadas_3p = porLinea['3P'].total;
    campos.nivel_atencion_3p = porLinea['3P'].total > 0 ? r2((porLinea['3P'].contestadas / porLinea['3P'].total) * 100) : null;
  }
  if (porLinea.GENERAL.tiene) {
    campos.llamadas_general = porLinea.GENERAL.total;
    campos.nivel_atencion_general = porLinea.GENERAL.total > 0 ? r2((porLinea.GENERAL.contestadas / porLinea.GENERAL.total) * 100) : null;
  }

  if (!Object.keys(campos).length) {
    return { actualizado: false, campos: null, skillsSinClasificar: [...skillsSinClasificar] };
  }

  const existing = db
    .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? AND seccion = ? AND periodo = ?')
    .get(ORLANT, SECCION, mes);

  let filaObj = {};
  if (existing) {
    try {
      const arr = JSON.parse(existing.filas || '[]');
      filaObj = (arr && arr[0]) || {};
    } catch (e) {
      filaObj = {};
    }
  }
  Object.assign(filaObj, campos);
  const filasJson = JSON.stringify([filaObj]);

  if (existing) {
    // Solo se toca `filas` -- cadencia/archivoNombre/cargadoPor* quedan tal
    // cual (no se le atribuye a "Sistema" una fila que en su mayoria sigue
    // siendo una carga real de un humano).
    db.prepare('UPDATE dashboard_cargas SET filas = ? WHERE id = ?').run(filasJson, existing.id);
  } else {
    db.prepare(
      `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(ORLANT, SECCION, 'mensual', mes, filasJson, null, null, 'Sistema (calculado desde Trafico)', ts);
  }

  return { actualizado: true, campos, skillsSinClasificar: [...skillsSinClasificar] };
}

module.exports = { recalcularResumenOrlantDesdeTrafico, lineaDeSkill, ORLANT_RESUMEN_CLIENTE: ORLANT };
