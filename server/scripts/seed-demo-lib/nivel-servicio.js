// nivel-servicio.js — Filas diarias de Nivel de Servicio (formato del export
// real del conmutador, EJEMPLO.xlsx: SKILL_NAME/fecha/TOTAL LLAMADAS/
// LLAMADAS CONTESTADAS/SERVICE_LEVEL_20SEC). Escribe con la MISMA funcion que
// usa POST /api/calidad/nivel-servicio/carga-diaria (cargarNivelServicioDiario),
// asi que el agregado mensual sale calculado por el mismo camino en los dos
// sitios — nunca dos formas distintas de sumar lo mismo.
'use strict';

const { cargarNivelServicioDiario } = require('../../nivel-servicio-diario');
const { mark } = require('./marks');
const { MESES, diasGenerables, diaSemana, rngFromSeed, randInt, fechaISO } = require('./util');

function filasDelMes(campana, mes, rand) {
  const gen = diasGenerables(mes);
  const filas = [];
  for (let dia = 1; dia <= gen; dia++) {
    const dw = diaSemana(mes, dia);
    if (dw === 0) continue; // domingo: sin operacion
    const esSabado = dw === 6;
    const totalLlamadas = esSabado ? randInt(rand, 30, 40) : randInt(rand, 150, 250);
    const pctContestadas = randInt(rand, 92, 99) / 100;
    const contestadas = Math.round(totalLlamadas * pctContestadas);
    const slTope = Math.min(95, Math.round(pctContestadas * 100));
    const serviceLevel20secPct = randInt(rand, 70, Math.max(70, slTope));
    filas.push({
      fecha: fechaISO(mes, dia),
      skillName: campana + ' - INBOUND',
      totalLlamadas,
      contestadas,
      serviceLevel20secPct,
    });
  }
  return filas;
}

// Devuelve { diarioCreados, mensualActualizados }.
function seedNivelServicio(db, { campanas, cargadoPorNombre }) {
  let diarioCreados = 0;
  let mesesActualizados = 0;

  for (const campana of campanas) {
    for (const mes of MESES) {
      const rand = rngFromSeed('ns|' + campana + '|' + mes);
      const filas = filasDelMes(campana, mes, rand);
      if (!filas.length) continue;

      // Solo insertamos filas cuyo (campana,fecha,skillName):
      //  - no este marcado todavia por nosotros (evita duplicar/recalcular de
      //    mas en una segunda corrida), y
      //  - no exista ya como fila REAL (no sembrada por nosotros) — nunca
      //    pisamos un dato que un admin haya subido de verdad.
      const selectDiarioReal = db.prepare(
        'SELECT id FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = ? AND skillName = ?'
      );
      const selectMensualReal = db.prepare(
        'SELECT id FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?'
      );
      const mensualYaExistia = !!selectMensualReal.get(campana, mes) &&
        !db.prepare('SELECT 1 FROM seed_demo_marcas WHERE tabla = ? AND clave = ?').get('calidad_nivel_servicio', `${campana}|${mes}`);

      const porInsertar = [];
      for (const f of filas) {
        const clave = `${campana}|${f.fecha}|${f.skillName}`;
        const yaMarcada = db
          .prepare('SELECT rowId FROM seed_demo_marcas WHERE tabla = ? AND clave = ?')
          .get('calidad_nivel_servicio_diario', clave);
        if (yaMarcada) continue;
        if (selectDiarioReal.get(campana, f.fecha, f.skillName)) continue; // dato real ajeno: no tocar
        porInsertar.push(f);
      }
      if (!porInsertar.length) continue;

      const resultado = cargarNivelServicioDiario(db, {
        campana,
        archivoNombre: 'seed-demo.xlsx',
        cargadoPorNombre: cargadoPorNombre || 'Seed Demo',
        filas: porInsertar,
      });

      porInsertar.forEach((f, idx) => {
        const clave = `${campana}|${f.fecha}|${f.skillName}`;
        mark(db, 'calidad_nivel_servicio_diario', clave, resultado.diario.ids[idx]);
        diarioCreados++;
      });
      // El mensual se recalcula siempre a partir de TODAS las filas diarias
      // (real+demo), igual que el endpoint — pero solo lo MARCAMOS (para que
      // seed:demo:limpiar lo borre) si no existia como fila real antes de esta
      // corrida; si ya existia, se deja su valor recalculado pero no se toca
      // en la limpieza (no era enteramente nuestro).
      resultado.mensual.forEach((m) => {
        if (mensualYaExistia && m.mes === mes) return;
        mark(db, 'calidad_nivel_servicio', `${campana}|${m.mes}`, m.id);
        mesesActualizados++;
      });
    }
  }

  return { diarioCreados, mesesActualizados };
}

module.exports = { seedNivelServicio, filasDelMes };
