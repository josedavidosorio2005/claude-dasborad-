// gestion-humana.js — Personal de demo por campana (gestion_humana_personal),
// con altas y bajas repartidas en los 6 meses y costo_hora/horas_mes poblados
// para que salgan la rotacion, la rentabilidad por campana y el % efectividad
// (produccion vs meta) del dashboard de Gestion Humana.
'use strict';

const { seedOnce } = require('./marks');
const { MESES, rngFromSeed, randInt, fechaISO, diasGenerables, daysInMonth } = require('./util');

const OBS_DEMO = '[DEMO] Sembrado por seed-demo';

const NOMBRES_GH = [
  'Astrid Morales', 'Ricardo Pelaez', 'Vanessa Echeverri', 'Fabian Alexis Gaviria',
  'Carolina Botero', 'German Dario Aguirre', 'Estefania Villa', 'Jhon Freddy Ospina',
  'Marcela Isaza', 'Rodrigo Alonso Perez', 'Ximena Restrepo', 'Cesar Augusto Marulanda',
  'Lina Maria Franco', 'Alvaro Andres Ceballos', 'Johana Patricia Tobon',
];

const CARGOS = [
  { cargo: 'Asesor', costo: [11000, 18000], horas: [176, 192] },
  { cargo: 'Asesor Senior', costo: [16000, 22000], horas: [176, 192] },
  { cargo: 'Supervisor', costo: [21000, 28000], horas: [176, 192] },
  { cargo: 'Coordinador', costo: [30000, 45000], horas: [160, 192] },
];

function mesesAntes(mesKey, n) {
  const [y, m] = mesKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function seedGestionHumana(db, { clientesList, cargadoPorNombre }) {
  const insert = db.prepare(`
    INSERT INTO gestion_humana_personal
      (nombre, documento, cargo, campana, supervisor, fecha_ingreso, fecha_salida, motivo_salida, costo_hora, horas_mes, salario, observaciones, createdAt, updatedAt)
    VALUES (@nombre,@documento,@cargo,@campana,@supervisor,@fecha_ingreso,@fecha_salida,@motivo_salida,@costo_hora,@horas_mes,NULL,@observaciones,@now,@now)
  `);

  let creados = 0;
  const primerMes = MESES[0];
  const ultimoMes = MESES[MESES.length - 1];

  clientesList.forEach((campana, ci) => {
    const rand = rngFromSeed('gh|' + campana);
    const headcount = randInt(rand, 6, 13);
    const supervisor = NOMBRES_GH[randInt(rand, 0, NOMBRES_GH.length - 1)];
    let personIdx = 0;

    function nuevoRegistro(fechaIngreso, fechaSalida, motivo) {
      // OJO: TODO lo que consume rand() va aqui afuera, nunca dentro del
      // callback de seedOnce — ese callback NO se ejecuta cuando la clave ya
      // esta marcada (segunda corrida), y si algo consumiera rand() solo ahi
      // adentro, la secuencia determinista se desincroniza entre corridas y
      // el resto de personas/meses de esta campana dejarian de ser idempotentes.
      const cargoDef = CARGOS[randInt(rand, 0, CARGOS.length - 1)];
      const nombre = NOMBRES_GH[randInt(rand, 0, NOMBRES_GH.length - 1)] + ' ' + (personIdx + 1);
      const costoHora = randInt(rand, cargoDef.costo[0], cargoDef.costo[1]);
      const horasMes = randInt(rand, cargoDef.horas[0], cargoDef.horas[1]);
      const clave = `${campana}|${personIdx}`;
      const documento = 'DEMO' + (10_000_000 + ci * 1000 + personIdx);
      personIdx++;
      const { created } = seedOnce(db, 'gestion_humana_personal', clave, () => {
        const info = insert.run({
          nombre,
          documento,
          cargo: cargoDef.cargo,
          campana,
          supervisor,
          fecha_ingreso: fechaIngreso,
          fecha_salida: fechaSalida || null,
          motivo_salida: motivo || '',
          costo_hora: costoHora,
          horas_mes: horasMes,
          observaciones: OBS_DEMO,
          now: new Date().toISOString(),
        });
        return info.lastInsertRowid;
      });
      if (created) creados++;
    }

    // Base del equipo: ingreso entre 8 y 24 meses antes del inicio del
    // historico (tenured), todos activos.
    const baseCount = Math.max(1, headcount - randInt(rand, 2, 4));
    for (let i = 0; i < baseCount; i++) {
      const { y, m } = mesesAntes(primerMes, randInt(rand, 8, 24));
      const dia = randInt(rand, 1, 28);
      nuevoRegistro(`${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, null, '');
    }

    // Altas dentro del historico (2-4), repartidas en distintos meses.
    const altas = randInt(rand, 2, 4);
    for (let i = 0; i < altas; i++) {
      const mes = MESES[randInt(rand, 0, MESES.length - 1)];
      const dia = randInt(rand, 1, diasGenerables(mes));
      nuevoRegistro(fechaISO(mes, dia), null, '');
    }

    // Bajas dentro del historico (1-3): ingresaron antes, se retiraron en el
    // periodo. fecha_salida siempre despues de fecha_ingreso (regla del schema).
    const bajas = randInt(rand, 1, 3);
    const motivos = ['Renuncia voluntaria', 'Terminacion de contrato', 'Mutuo acuerdo', 'Bajo desempeno'];
    for (let i = 0; i < bajas; i++) {
      const { y, m } = mesesAntes(primerMes, randInt(rand, 4, 20));
      const diaIngreso = randInt(rand, 1, 28);
      const fechaIngreso = `${y}-${String(m).padStart(2, '0')}-${String(diaIngreso).padStart(2, '0')}`;
      const mesSalida = MESES[randInt(rand, 0, MESES.length - 1)];
      const maxDiaSalida = mesSalida === ultimoMes ? diasGenerables(mesSalida) : daysInMonth(mesSalida);
      const diaSalida = randInt(rand, 1, maxDiaSalida);
      const fechaSalida = fechaISO(mesSalida, diaSalida);
      if (fechaSalida <= fechaIngreso) continue; // seguridad: nunca antes del ingreso
      nuevoRegistro(fechaIngreso, fechaSalida, motivos[randInt(rand, 0, motivos.length - 1)]);
    }
  });

  return { creados };
}

module.exports = { seedGestionHumana };
