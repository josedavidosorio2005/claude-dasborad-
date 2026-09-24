// resumen-orlant-trafico.js — Fase 39 (Llamadas) + Fase 71 (WhatsApp):
// mantiene los 7 campos de trafico de la seccion "resumen" de ORLANT
// (dashboard_cargas) sincronizados automaticamente con los datos que YA se
// suben por Trafico de Llamadas/WhatsApp (Wolkvox) — sin que nadie tenga que
// llenarlos a mano en la hoja "resumen":
//   llamadas_3p / nivel_atencion_3p / llamadas_general / nivel_atencion_general
//     <- calidad_nivel_servicio_diario (Trafico de Llamadas)
//   wpp_3p / wpp_general / nivel_atencion_wpp_3p
//     <- trafico_whatsapp (Trafico de WhatsApp)
// (El esquema de "resumen" no tiene un campo "nivel_atencion_wpp_general" --
// no se inventa uno aqui, fuera de alcance.)
//
// Solo ORLANT usa estos nombres de campo (confirmado contra
// dashboard-secciones.js: CLINICA AURORA y HOSPITAL LA MARIA no los tienen),
// asi que este modulo esta deliberadamente escrito para una sola campana, no
// generalizado.
//
// Linea (3P / GENERAL) inferida del nombre del skill/cola (no hay un campo
// "linea" en trafico_skill_mapeo ni en trafico_whatsapp, y agregar uno solo
// para esto es mas estado que mantener por los nombres conocidos hoy:
// skills "CALL INBOUND ORLANT 3P"/"CALL INBOUND ORLANT GENERAL", colas
// "WHATSAPP ORLANT 3P"/"WHATSAPP ORLANT GENERAL"). Un skill/cola que no
// calce con ningun patron simplemente no aporta a ninguna de las 2 lineas --
// no rompe la carga, solo no se refleja en estos campos hasta que se
// registre con un nombre reconocible. Mismo criterio para las 3 colas de
// WhatsApp que no terminan en "3P"/"GENERAL" (AUDIFONOS/FONIATRIA/
// FONOAUDIOLOGIA, Fase 71): quedan fuera de "WhatsApp Linea General" por
// diseno -- ver PROGRESS.md Fase 71 para la pregunta pendiente de confirmar
// con el cliente si "Linea General" debe incluirlas.
'use strict';

const ORLANT = 'ORLANT';
const SECCION = 'resumen';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const r2 = (n) => Math.round(n * 100) / 100;

// null si el nombre no calza con ningun patron conocido -- deliberado, ver
// comentario de cabecera. Compartida por skills de Llamadas y colas de
// WhatsApp: las dos siguen la misma convencion de nombre ("... 3P" / "...
// GENERAL").
function lineaDeNombre(nombre) {
  const s = String(nombre || '').trim().toUpperCase();
  if (/ 3P$/.test(s)) return '3P';
  if (/ GENERAL$/.test(s)) return 'GENERAL';
  return null;
}
const lineaDeSkill = lineaDeNombre;
const lineaDeCola = lineaDeNombre;

// Agrupa un conjunto de filas {nombre, total, contestadas} (skills de
// Llamadas o colas de WhatsApp, ya con esas 3 claves normalizadas por el
// caller) en los acumulados por linea (3P/GENERAL) + el set de nombres que
// no calzaron con ningun patron -- misma logica exacta para los 2 canales,
// factorizada para no duplicarla.
function agruparPorLinea(filas) {
  const porLinea = {
    '3P': { total: 0, contestadas: 0, tiene: false },
    GENERAL: { total: 0, contestadas: 0, tiene: false },
  };
  const sinClasificar = new Set();
  for (const f of filas) {
    const linea = lineaDeNombre(f.nombre);
    if (!linea) {
      sinClasificar.add(f.nombre);
      continue;
    }
    porLinea[linea].total += f.total || 0;
    porLinea[linea].contestadas += f.contestadas || 0;
    porLinea[linea].tiene = true;
  }
  return { porLinea, sinClasificar };
}

// Recalcula los 7 campos de trafico para UN mes de ORLANT, SIEMPRE desde
// cero sobre TODAS las filas de calidad_nivel_servicio_diario (Llamadas) y
// trafico_whatsapp (WhatsApp) que existan hoy para ese mes (mismo criterio
// que recalcularMensual en nivel-servicio-diario.js) -- nivelAtencionPct =
// contestadas totales del periodo / total del periodo, nunca promedio de
// los % diarios/por-cola.
//
// WhatsApp usa `fechaInicio` para decidir a que mes pertenece un periodo
// (asume que un periodo cargado empieza el mismo mes que representa --
// cierto para todos los datos reales de hoy, un periodo mensual completo;
// documentado por si algun dia se cargan periodos que crucen un mes).
//
// Upsertea en dashboard_cargas (ORLANT, resumen, mes) sin tocar ningun otro
// campo que ya haya en esa fila (agendas, citas, inasistencia, etc.) -- se
// lee el JSON existente, se mezclan solo los campos de trafico que SI se
// pudieron calcular este mes, se vuelve a guardar. Si Trafico no tiene NADA
// para ese mes (ni Llamadas ni WhatsApp clasificables en 3P/GENERAL), no
// toca dashboard_cargas en absoluto -- un resumen cargado a mano para ese
// mes queda intacto, tal como estaba.
//
// Devuelve { actualizado, campos, skillsSinClasificar, colasSinClasificar }
// para que el caller (o un test) pueda confirmar que paso, sin tener que
// releer la fila.
function recalcularResumenOrlantDesdeTrafico(db, mes, now) {
  const ts = now || nowStr();

  const filasLlamadas = db
    .prepare('SELECT skillName AS nombre, totalLlamadas AS total, contestadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ?')
    .all(ORLANT, mes);
  const { porLinea: porLineaLlamadas, sinClasificar: skillsSinClasificar } = agruparPorLinea(filasLlamadas);

  const filasWpp = db
    .prepare('SELECT colaWhatsapp AS nombre, totalWhatsapp AS total, contestados AS contestadas FROM trafico_whatsapp WHERE campana = ? AND substr(fechaInicio,1,7) = ?')
    .all(ORLANT, mes);
  const { porLinea: porLineaWpp, sinClasificar: colasSinClasificar } = agruparPorLinea(filasWpp);

  const campos = {};
  if (porLineaLlamadas['3P'].tiene) {
    campos.llamadas_3p = porLineaLlamadas['3P'].total;
    campos.nivel_atencion_3p = porLineaLlamadas['3P'].total > 0 ? r2((porLineaLlamadas['3P'].contestadas / porLineaLlamadas['3P'].total) * 100) : null;
  }
  if (porLineaLlamadas.GENERAL.tiene) {
    campos.llamadas_general = porLineaLlamadas.GENERAL.total;
    campos.nivel_atencion_general = porLineaLlamadas.GENERAL.total > 0 ? r2((porLineaLlamadas.GENERAL.contestadas / porLineaLlamadas.GENERAL.total) * 100) : null;
  }
  // WhatsApp: el esquema de "resumen" no tiene "nivel_atencion_wpp_general"
  // (solo nivel_atencion_wpp_3p existe) -- confirmado contra
  // dashboard-secciones.js, no se inventa aqui.
  if (porLineaWpp['3P'].tiene) {
    campos.wpp_3p = porLineaWpp['3P'].total;
    campos.nivel_atencion_wpp_3p = porLineaWpp['3P'].total > 0 ? r2((porLineaWpp['3P'].contestadas / porLineaWpp['3P'].total) * 100) : null;
  }
  if (porLineaWpp.GENERAL.tiene) {
    campos.wpp_general = porLineaWpp.GENERAL.total;
  }

  if (!Object.keys(campos).length) {
    return { actualizado: false, campos: null, skillsSinClasificar: [...skillsSinClasificar], colasSinClasificar: [...colasSinClasificar] };
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

  return { actualizado: true, campos, skillsSinClasificar: [...skillsSinClasificar], colasSinClasificar: [...colasSinClasificar] };
}

module.exports = { recalcularResumenOrlantDesdeTrafico, lineaDeSkill, lineaDeCola, ORLANT_RESUMEN_CLIENTE: ORLANT };
