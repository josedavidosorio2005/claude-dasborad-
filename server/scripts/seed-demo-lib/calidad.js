// calidad.js — Monitoreos + cronograma de metas de demo, para las campanas
// que tienen plantilla de calificacion y pestana de Calidad en su dashboard.
// El puntaje SIEMPRE lo calcula calc.computeScore() (server/calidad-logic.js),
// nunca un numero a mano, igual que POST /monitoreos.
'use strict';

const calc = require('../../calidad-logic');
const { seedOnce, seedOnceGuarded } = require('./marks');
const { MESES, diasGenerables, rngFromSeed, randInt, fechaISO } = require('./util');

const OBS_DEMO = '[DEMO] Generado por seed-demo';

const POOL_NOMBRES = [
  'Daniel Osorio Vega', 'Valentina Restrepo', 'Juan Pablo Arango', 'Mariana Zuluaga',
  'Santiago Gomez Diaz', 'Camila Hincapie', 'Andres Felipe Mejia', 'Laura Sofia Cardona',
  'Sebastian Vélez', 'Isabella Montoya', 'Nicolas Ramirez', 'Salome Betancur',
  'Alejandro Ospina', 'Daniela Correa', 'David Esteban Torres', 'Gabriela Londono',
  'Miguel Angel Sepulveda', 'Paula Andrea Jimenez', 'Cristian Camilo Bedoya', 'Natalia Uribe',
  'Julian David Cano', 'Manuela Giraldo', 'Esteban Salazar', 'Sara Valentina Duque',
  'Tomas Henao', 'Luisa Fernanda Gil', 'Felipe Quintero', 'Mariana Posada',
  'Simon Vargas', 'Antonia Castano', 'Emmanuel Ruiz', 'Valeria Aristizabal',
  'Kevin Steven Marin', 'Juliana Palacio', 'Diego Alejandro Rios', 'Sofia Herrera',
  'Brayan Castillo', 'Melissa Serna', 'Jorge Ivan Patino', 'Yuliana Monsalve',
];

function asesoresPara(campana, cantidad) {
  const rand = rngFromSeed('asesores|' + campana);
  const start = randInt(rand, 0, POOL_NOMBRES.length - cantidad - 1);
  const nombres = POOL_NOMBRES.slice(start, start + cantidad);
  if (campana === 'ORLANT' && !nombres.includes('Daniel Osorio Vega')) {
    nombres[0] = 'Daniel Osorio Vega';
  }
  return nombres;
}

// Genera un juego de respuestas coherente con un "nivel" 0..1 del asesor:
// mas alto -> mas SI, menos NO. Los items criticos tienen un poco mas de
// probabilidad de fallar que los no criticos (para que existan alertas reales).
function respuestasParaNivel(items, engine, rand, nivel) {
  const answers = {};
  items.forEach((it) => {
    const rN = rand();
    if (rN < 0.06) {
      answers[it.n] = 'N/A';
      return;
    }
    const base = 0.55 + nivel * 0.42; // ~0.55..0.97
    const pSi = it.critico ? base - 0.1 : base;
    answers[it.n] = rand() < Math.max(0.15, Math.min(0.98, pSi)) ? 'SI' : 'NO';
  });
  return answers;
}

// Devuelve la lider asignada de una campana para el cronograma/evaluador:
// ORLANT usa el Supervisor de demo (para que su pagina de "mi meta" tenga
// datos); el resto usa el Calidad de demo. Ambos son roles validos para
// liderId (CALIDAD o SUPERVISOR), igual que exige POST /metas.
function liderPara(campana, porRol) {
  if (campana === 'ORLANT' && porRol.SUPERVISOR) return porRol.SUPERVISOR;
  return porRol.CALIDAD || porRol.SUPERVISOR;
}

function seedCalidad(db, { campanas, porRol }) {
  const plantillaStmt = db.prepare('SELECT * FROM calidad_plantillas WHERE campana = ? AND activo = 1');
  const insertMonitoreo = db.prepare(`
    INSERT INTO monitoreos
      (campana, asesor, fecha, mes, canal, idLlamada, telefono, codificacion,
       evaluador, evaluadorUserId, answers, puntaje, clasificacion, fallos,
       nivelCritico, observaciones, createdAt)
    VALUES (@campana,@asesor,@fecha,@mes,@canal,@idLlamada,@telefono,@codificacion,
            @evaluador,@evaluadorUserId,@answers,@puntaje,@clasificacion,@fallos,
            @nivelCritico,@observaciones,@createdAt)
  `);
  const selectMeta = db.prepare(
    'SELECT * FROM cronograma_metas WHERE campana = ? AND mes = ? AND liderId = ?'
  );
  const insertMeta = db.prepare(`
    INSERT INTO cronograma_metas
      (campana, mes, liderId, liderNombre, metaGrupal, asesores, diasLaborales, whatsapp, pctWhatsapp, createdAt, updatedAt)
    VALUES (@campana,@mes,@liderId,@liderNombre,@metaGrupal,@asesores,@diasLaborales,@whatsapp,@pctWhatsapp,@now,@now)
  `);

  let monitoreosCreados = 0;
  let metasCreadas = 0;

  for (const campana of campanas) {
    const plantillaRow = plantillaStmt.get(campana);
    if (!plantillaRow) continue; // no deberia pasar: campanas viene de las que si tienen plantilla
    const plantilla = { engine: plantillaRow.engine, items: JSON.parse(plantillaRow.items) };
    const lider = liderPara(campana, porRol);
    if (!lider) continue; // sin usuarios de demo (no deberia pasar)

    const cantAsesores = randInt(rngFromSeed('nasesores|' + campana), 8, 12);
    const asesores = asesoresPara(campana, cantAsesores);
    const nivelAsesor = {};
    asesores.forEach((a) => {
      nivelAsesor[a] = rngFromSeed('nivel|' + campana + '|' + a)();
    });

    for (const mes of MESES) {
      const gen = diasGenerables(mes);
      let realizadosDelMes = 0;
      const randMes = rngFromSeed('metames|' + campana + '|' + mes);

      asesores.forEach((asesor, idxAsesor) => {
        const randA = rngFromSeed('mon|' + campana + '|' + asesor + '|' + mes);
        const cantidad = randInt(randA, 2, 5);
        for (let i = 0; i < cantidad; i++) {
          const clave = `${campana}|${asesor}|${mes}|${i}`;
          const { created } = seedOnce(db, 'monitoreos', clave, () => {
            const dia = randInt(randA, 1, gen);
            const fecha = fechaISO(mes, dia);
            const canal = randA() < 0.2 ? 'WPP' : 'LLAMADA';
            const answers = respuestasParaNivel(plantilla.items, plantilla.engine, randA, nivelAsesor[asesor]);
            const score = calc.computeScore(plantilla.items, answers, plantilla.engine);
            const info = insertMonitoreo.run({
              campana,
              asesor,
              fecha,
              mes,
              canal,
              idLlamada: 'DEMO-' + Math.floor(randA() * 900000 + 100000),
              telefono: '30' + Math.floor(randA() * 90000000 + 10000000),
              codificacion: canal === 'WPP' ? 'GESTION WHATSAPP' : 'GESTION LLAMADA',
              evaluador: lider.nombre,
              evaluadorUserId: lider.id,
              answers: JSON.stringify(answers),
              puntaje: score.puntaje,
              clasificacion: score.clasificacion,
              fallos: score.fallos,
              nivelCritico: score.nivelCritico,
              observaciones: OBS_DEMO,
              createdAt: new Date().toISOString(),
            });
            return info.lastInsertRowid;
          });
          if (created) monitoreosCreados++;
          realizadosDelMes++;
        }
      });

      // Meta del mes: cerca de lo realizado, con variacion +-30% para que el
      // cumplimiento a veces pase de 100% y a veces no.
      const claveMeta = `${campana}|${mes}|${lider.id}`;
      const metaGrupal = Math.max(1, Math.round(realizadosDelMes * (0.75 + randMes() * 0.5)));
      const whatsapp = randMes() < 0.6;
      const metaResult = seedOnceGuarded(db, 'cronograma_metas', claveMeta, {
        checkExisting: () => {
          const row = selectMeta.get(campana, mes, lider.id);
          return row ? row.id : null;
        },
        insertFn: () => {
          const now = new Date().toISOString();
          const info = insertMeta.run({
            campana,
            mes,
            liderId: lider.id,
            liderNombre: lider.nombre,
            metaGrupal,
            asesores: cantAsesores,
            diasLaborales: randInt(randMes, 19, 23),
            whatsapp: whatsapp ? 1 : 0,
            pctWhatsapp: whatsapp ? randInt(randMes, 15, 35) : 0,
            now,
          });
          return info.lastInsertRowid;
        },
      });
      if (metaResult.created) metasCreadas++;
    }
  }

  return { monitoreosCreados, metasCreadas };
}

module.exports = { seedCalidad, OBS_DEMO };
