// dashboards.js — Datos operativos de demo para los dashboards de cliente
// (Fase 134: solo ORLANT y MOBILIZE), 6 meses de historico en TODAS sus
// secciones (dashboard_cargas). Escribe
// pasando por `normalizarFilas` (server/dashboard-secciones.js) — la MISMA
// validacion/normalizacion que usa POST /api/dashboard/cargas — para que una
// fila que la app real rechazaria tampoco pueda colarse aqui.
'use strict';

const { normalizarFilas } = require('../../dashboard-secciones');
const { CONFIGS } = require('../../dashboard-config-seed');
const { seedOnceGuarded } = require('./marks');
const {
  MESES,
  diasGenerables,
  diaSemana,
  sabadosDelMes,
  progresoMes,
  rngFromSeed,
  randInt,
  randFloat,
  round2,
  fechaISO,
} = require('./util');

const ARCHIVO_DEMO = 'seed-demo.xlsx';

function configDe(cliente) {
  const cfg = CONFIGS.find((c) => c.cliente === cliente);
  if (!cfg) throw new Error(`seed-demo: sin dashboard configurado para "${cliente}"`);
  return cfg;
}

// Sube una carga (cliente, seccion, periodo) pasando por normalizarFilas,
// igual que POST /dashboard/cargas. No pisa una carga real ajena.
function cargarSeccion(db, { cliente, seccion, cadencia, periodo, filas, spec, cargadoPorNombre }) {
  const norm = normalizarFilas(spec, filas);
  if (!norm.ok) {
    throw new Error(
      `seed-demo: filas invalidas para ${cliente}/${seccion}/${periodo}: ${norm.errores.join('; ')}`
    );
  }
  const clave = `${cliente}|${seccion}|${periodo}`;
  return seedOnceGuarded(db, 'dashboard_cargas', clave, {
    checkExisting: () => {
      const row = db
        .prepare('SELECT id FROM dashboard_cargas WHERE cliente = ? AND seccion = ? AND periodo = ?')
        .get(cliente, seccion, periodo);
      return row ? row.id : null;
    },
    insertFn: () => {
      const now = new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO dashboard_cargas
             (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
           VALUES (?,?,?,?,?,?,?,?,?)`
        )
        .run(
          cliente,
          seccion,
          cadencia,
          periodo,
          JSON.stringify(norm.filas),
          ARCHIVO_DEMO,
          null,
          cargadoPorNombre || 'Seed Demo',
          now
        );
      return info.lastInsertRowid;
    },
  });
}

// Valor mensual con leve tendencia (crece/decrece hasta `tendenciaPct` a lo
// largo de los 6 meses) + ruido, escalado por el progreso del mes en curso.
function serieMensual(rand, idxMes, { base, ruidoPct, tendenciaPct }) {
  const t = tendenciaPct === undefined ? 0.12 : tendenciaPct;
  const factorTendencia = 1 + (t * idxMes) / (MESES.length - 1);
  const ruido = 1 + randFloat(rand, -(ruidoPct || 0.1), ruidoPct || 0.1, 3);
  const progreso = progresoMes(MESES[idxMes]);
  return Math.max(0, base * factorTendencia * ruido * progreso);
}

function ent(n) {
  return Math.round(n);
}

const TIPIFICACIONES_GENERICAS = [
  'GESTION EFECTIVA', 'NO CONTESTA', 'NO INTERESADO', 'VOLVER A LLAMAR',
  'NUMERO EQUIVOCADO', 'BUZON DE VOZ',
];

function filasTipificacion(rand, total, categorias, extraCols) {
  const pesos = categorias.map(() => 0.4 + rand());
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  let restante = ent(total);
  return categorias.map((tipificacion, i) => {
    const esUltimo = i === categorias.length - 1;
    const cantidad = esUltimo ? Math.max(0, restante) : Math.max(0, ent((pesos[i] / sumaPesos) * total));
    restante -= cantidad;
    return { tipificacion, cantidad, ...(extraCols || {}) };
  });
}

// Fase 98 (ORLANT, pedido URGENTE de Edwin): Inasistencia con datos REALES
// (tabla `inasistencias`, server/inasistencia.js) -- a diferencia de
// Agendas/Tipificacion (que hoy NO se siembran, ver nota de la Fase 98 en
// PROGRESS.md), esta tabla SI necesita demo local: es la unica manera de
// probar visualmente el panel nuevo (tarjetas, graficas, aviso de "menos
// especialidades que el mes anterior") sin esperar a la carga real en
// produccion. INSERT directo + seedOnceGuarded (categoria A: la tabla ya
// tiene su propio UNIQUE campana+mes+especialidad) -- mismo patron que
// dashboard_cargas (cargarSeccion, mas arriba), nunca pisa una fila real
// que un admin ya haya cargado a mano para esta campana/mes/especialidad.
const INASISTENCIA_ESPECIALIDADES = ['AUDIFONOS', 'AUDIOLOGIA', 'EXAMENES ESPECIALES'];
// Fase 108 (pedido textual de InCo: "que se pueda filtrar por sede,
// especialidad, nombre entidad"): cada fila real ahora es (mes, sede,
// especialidad, entidad) -- el demo reparte el total de cada
// (mes,especialidad) entre estas 2 sedes y 3 entidades para poder probar
// visualmente los filtros nuevos (y la vista "Por especialidad") sin
// esperar la carga real.
const INASISTENCIA_SEDES = ['SEDE PRINCIPAL', 'SEDE NORTE'];
const INASISTENCIA_ENTIDADES = ['EPS DEMO UNO', 'EPS DEMO DOS', 'EPS DEMO TRES'];

// Reparte `total` entre `n` partes enteras no negativas que suman EXACTO
// `total` (pesos aleatorios, la ultima parte se lleva el redondeo) -- mismo
// criterio que distribuirTipificacion (mas arriba en este archivo).
function distribuirEntero(rand, total, n) {
  const pesos = Array.from({ length: n }, () => 0.4 + rand());
  const suma = pesos.reduce((a, b) => a + b, 0);
  let restante = total;
  return pesos.map((p, i) => {
    if (i === n - 1) return Math.max(0, restante);
    const v = Math.max(0, Math.round((total * p) / suma));
    restante -= v;
    return v;
  });
}

function seedInasistenciaOrlant(db, rand, mes, idxMes, cargadoPorNombre) {
  const insert = db.prepare(`
    INSERT INTO inasistencias
      (campana, mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
    VALUES (@campana,@mes,@sede,@especialidad,@entidad,@cancelada,@inasistencia,@pendiente,@atendidas,@total,@archivoNombre,@cargadoPorNombre,@createdAt)
  `);
  // El mes en curso solo trae UNA especialidad, sede='SIN DATO' y
  // entidad='SIN DATO' -- mismo patron REAL de produccion (Fase 109:
  // "Sep-26 quedo del formato viejo -- Fase 98-106 -- mientras Ene-26 a
  // Ago-26 ya vienen del archivo nuevo"): los meses CERRADOS ya tienen el
  // reparto sede x entidad del archivo nuevo, pero el mes que todavia no
  // cierra sigue en el formato agregado viejo. Asi el demo ejercita el
  // aviso 'parcial' (no solo 'incompleto') sin esperar datos reales.
  const esMesActual = idxMes === MESES.length - 1;
  const especialidades = esMesActual ? ['EXAMENES ESPECIALES'] : INASISTENCIA_ESPECIALIDADES;
  const combos = esMesActual
    ? [{ sede: 'SIN DATO', entidad: 'SIN DATO' }]
    : INASISTENCIA_SEDES.reduce((acc, sede) => acc.concat(INASISTENCIA_ENTIDADES.map((entidad) => ({ sede, entidad }))), []);

  especialidades.forEach((especialidad) => {
    const total = Math.max(50, ent(serieMensual(rand, idxMes, { base: 1200, ruidoPct: 0.15 })));
    const cancelada = ent(total * randFloat(rand, 0.1, 0.2, 3));
    const inasistencia = ent(total * randFloat(rand, 0.03, 0.09, 3));
    const pendiente = ent(total * randFloat(rand, 0.002, 0.01, 3));
    const atendidas = Math.max(0, total - cancelada - inasistencia - pendiente); // TOTAL siempre cuadra en el demo

    // Cada conteo se reparte POR SU CUENTA entre las combinaciones sede x
    // entidad (nunca el mismo peso para los 4, para que el % de cada fila
    // varie como en un archivo real) -- el TOTAL de cada fila es la suma de
    // sus propios 4 conteos (nunca se reparte aparte, mismo criterio que
    // inasistenciaParseFilas, inasistencia-logic.js).
    const porCancelada = distribuirEntero(rand, cancelada, combos.length);
    const porInasistencia = distribuirEntero(rand, inasistencia, combos.length);
    const porPendiente = distribuirEntero(rand, pendiente, combos.length);
    const porAtendidas = distribuirEntero(rand, atendidas, combos.length);

    combos.forEach((combo, i) => {
      const filaTotal = porCancelada[i] + porInasistencia[i] + porPendiente[i] + porAtendidas[i];
      if (filaTotal <= 0) return; // combinacion sin citas este mes -- no se inserta una fila vacia
      const clave = `ORLANT|${mes}|${combo.sede}|${especialidad}|${combo.entidad}`;
      seedOnceGuarded(db, 'inasistencias', clave, {
        checkExisting: () => {
          const row = db
            .prepare('SELECT id FROM inasistencias WHERE campana = ? AND mes = ? AND sede = ? AND especialidad = ? AND entidad = ?')
            .get('ORLANT', mes, combo.sede, especialidad, combo.entidad);
          return row ? row.id : null;
        },
        insertFn: () => {
          const info = insert.run({
            campana: 'ORLANT', mes, sede: combo.sede, especialidad, entidad: combo.entidad,
            cancelada: porCancelada[i], inasistencia: porInasistencia[i], pendiente: porPendiente[i], atendidas: porAtendidas[i], total: filaTotal,
            archivoNombre: ARCHIVO_DEMO, cargadoPorNombre: cargadoPorNombre || 'Seed Demo', createdAt: new Date().toISOString(),
          });
          return info.lastInsertRowid;
        },
      });
    });
  });
}

// Fase 111 (ORLANT, pedido textual de Edwin: "el ranking va a ser
// efectividad por agendamiento"): igual que Inasistencia (Fase 98), estas 2
// tablas nuevas SI necesitan demo local -- es la unica manera de probar
// visualmente los paneles nuevos (ranking con grafica combo, Efectividad de
// Citas) sin esperar la carga real en produccion. Generadores PROPIOS
// (rngFromSeed independiente, nunca el `rand` compartido del resto de
// seedOrlant) para no correr el PRNG del resto de secciones y asi no cambiar
// ningun numero de demo ya existente.
const EFECTIVIDAD_AGENDAMIENTO_ASESORES = [
  'Mateo Londono Cardenas', 'Valeria Pulgarin', 'Esteban Zapata', 'Sofia Marulanda',
  'Nicolas Ocampo', 'Camila Agudelo', 'Juan Esteban Villa', 'Manuela Betancourt',
  'Santiago Franco', 'Daniela Mesa', 'Andres David Gaviria', 'Laura Tangarife',
  'Felipe Arroyave', 'Isabella Cano', 'Jacobo Montoya',
];

function seedEfectividadAgendamientoOrlant(db, mes, idxMes, cargadoPorNombre) {
  const insert = db.prepare(`
    INSERT INTO efectividad_agendamiento
      (campana, mes, asesor, gestiones, agendas, archivoNombre, cargadoPorNombre, createdAt)
    VALUES (@campana,@mes,@asesor,@gestiones,@agendas,@archivoNombre,@cargadoPorNombre,@createdAt)
  `);
  EFECTIVIDAD_AGENDAMIENTO_ASESORES.forEach((asesor) => {
    // Nivel propio del asesor (0..1, estable entre meses) -- mismo criterio
    // que respuestasParaNivel en calidad.js -- para que el ranking tenga
    // puestos altos y bajos de verdad, como el control real (97,36% primero,
    // 12,18% ultimo).
    const randNivel = rngFromSeed('ea-nivel|' + asesor);
    const nivel = randFloat(randNivel, 0.08, 0.95, 3);
    const randMes = rngFromSeed('ea-mes|' + asesor + '|' + mes);
    const gestiones = Math.max(10, ent(serieMensual(randMes, idxMes, { base: randInt(randNivel, 300, 2200), ruidoPct: 0.15 })));
    const agendas = Math.max(0, Math.min(gestiones, ent(gestiones * Math.min(1, Math.max(0, nivel + randFloat(randMes, -0.05, 0.05, 3))))));
    const clave = `ORLANT|${mes}|${asesor}`;
    seedOnceGuarded(db, 'efectividad_agendamiento', clave, {
      checkExisting: () => {
        const row = db
          .prepare('SELECT id FROM efectividad_agendamiento WHERE campana = ? AND mes = ? AND asesor = ?')
          .get('ORLANT', mes, asesor);
        return row ? row.id : null;
      },
      insertFn: () => {
        const info = insert.run({
          campana: 'ORLANT', mes, asesor, gestiones, agendas,
          archivoNombre: ARCHIVO_DEMO, cargadoPorNombre: cargadoPorNombre || 'Seed Demo', createdAt: new Date().toISOString(),
        });
        return info.lastInsertRowid;
      },
    });
  });
}

function seedEfectividadCitasOrlant(db, mes, idxMes, cargadoPorNombre) {
  const randMes = rngFromSeed('ec-mes|' + mes);
  const agendas = Math.max(50, ent(serieMensual(randMes, idxMes, { base: 2600, ruidoPct: 0.1 })));
  const atendidas = Math.max(0, Math.min(agendas, ent(agendas * randFloat(randMes, 0.78, 0.94, 3))));
  const clave = `ORLANT|${mes}|citas`;
  seedOnceGuarded(db, 'efectividad_citas', clave, {
    checkExisting: () => {
      const row = db.prepare('SELECT id FROM efectividad_citas WHERE campana = ? AND mes = ?').get('ORLANT', mes);
      return row ? row.id : null;
    },
    insertFn: () => {
      const info = db
        .prepare(
          `INSERT INTO efectividad_citas
             (campana, mes, agendas, atendidas, archivoNombre, cargadoPorNombre, createdAt)
           VALUES (?,?,?,?,?,?,?)`
        )
        .run('ORLANT', mes, agendas, atendidas, ARCHIVO_DEMO, cargadoPorNombre || 'Seed Demo', new Date().toISOString());
      return info.lastInsertRowid;
    },
  });
}

// ════════════════════════════════════════════════════════════
// ORLANT
// ════════════════════════════════════════════════════════════
function seedOrlant(db, { cargadoPorNombre }) {
  const cliente = 'ORLANT';
  const cfg = configDe(cliente);
  const rand = rngFromSeed('dash|' + cliente);

  MESES.forEach((mes, idxMes) => {
    const llamadas3p = ent(serieMensual(rand, idxMes, { base: 2200 }));
    const wpp3p = ent(serieMensual(rand, idxMes, { base: 900 }));
    const llamadasGeneral = ent(serieMensual(rand, idxMes, { base: 3400 }));
    const wppGeneral = ent(serieMensual(rand, idxMes, { base: 1500 }));
    const ordmedGestionados = ent(serieMensual(rand, idxMes, { base: 800 }));
    const ordmedAgendas = ent(ordmedGestionados * randFloat(rand, 0.55, 0.8));
    const recupCancelado = ent(serieMensual(rand, idxMes, { base: 260 }));
    const recupAtendido = ent(recupCancelado * randFloat(rand, 0.3, 0.6));
    const agendasGeneral = ent(serieMensual(rand, idxMes, { base: 1600 }));
    const agendas3p = ent(serieMensual(rand, idxMes, { base: 1100 }));
    const staOrdenes = ent(serieMensual(rand, idxMes, { base: 900 }));
    const staFactcump = ent(staOrdenes * randFloat(rand, 0.7, 0.95));
    const citasParaMes = ent(serieMensual(rand, idxMes, { base: 2600 }));
    const citasAtendidas = ent(citasParaMes * randFloat(rand, 0.75, 0.95));

    const resumen = [{
      llamadas_3p: llamadas3p,
      wpp_3p: wpp3p,
      llamadas_general: llamadasGeneral,
      wpp_general: wppGeneral,
      nivel_atencion_3p: randFloat(rand, 82, 96, 1),
      nivel_atencion_wpp_3p: randFloat(rand, 80, 95, 1),
      nivel_atencion_general: randFloat(rand, 80, 94, 1),
      ordmed_gestionados: ordmedGestionados,
      ordmed_agendas: ordmedAgendas,
      recup_cancelado: recupCancelado,
      recup_atendido: recupAtendido,
      total_agendas: agendasGeneral + agendas3p,
      agendas_general: agendasGeneral,
      agendas_3p: agendas3p,
      inasist_audifonos: randFloat(rand, 6, 18, 1),
      inasist_audiologia: randFloat(rand, 5, 16, 1),
      inasist_examenes: randFloat(rand, 4, 14, 1),
      inasist_total: randFloat(rand, 6, 15, 1),
      sta_ordenes: staOrdenes,
      sta_factcump: staFactcump,
      citas_para_mes: citasParaMes,
      citas_atendidas: citasAtendidas,
    }];
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const salidaFilas = [];
    for (let d = 1; d <= gen; d++) {
      const finde = diaSemana(mes, d) === 0;
      const factor = finde ? 0.2 : 1;
      salidaFilas.push({
        fecha: fechaISO(mes, d),
        salida_general: ent(randFloat(rand, 60, 140, 0) * factor),
        salida_3p: ent(randFloat(rand, 30, 90, 0) * factor),
        wpp_salida_general: ent(randFloat(rand, 40, 100, 0) * factor),
        wpp_salida_3p: ent(randFloat(rand, 20, 60, 0) * factor),
      });
    }
    cargarSeccion(db, { cliente, seccion: 'salida', cadencia: 'diaria', periodo: mes, filas: salidaFilas, spec: cfg.secciones.salida, cargadoPorNombre });

    const tipif = [
      ...filasTipificacion(rand, llamadas3p, TIPIFICACIONES_GENERICAS, { linea: '3P' }),
      ...filasTipificacion(rand, llamadasGeneral, TIPIFICACIONES_GENERICAS, { linea: 'GENERAL' }),
    ];
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });

    const servicios = ['AUDIOLOGIA', 'AUDIFONOS', 'OTORRINOLARINGOLOGIA', 'EXAMENES'];
    const estados = ['CARGADA', 'AGENDADA', 'FACTURADA', 'VENCIDA'];
    const sta = [
      ...filasTipificacion(rand, staOrdenes, servicios, { dimension: 'SERVICIO' }).map((f) => ({ dimension: 'SERVICIO', categoria: f.tipificacion, cantidad: f.cantidad })),
      ...filasTipificacion(rand, staOrdenes, estados, { dimension: 'ESTADO' }).map((f) => ({ dimension: 'ESTADO', categoria: f.tipificacion, cantidad: f.cantidad })),
      { dimension: 'MES_ACTUAL', categoria: 'ORDENES DEL MES', cantidad: staOrdenes, agendas: staFactcump },
    ];
    cargarSeccion(db, { cliente, seccion: 'sta_categorias', cadencia: 'mensual', periodo: mes, filas: sta, spec: cfg.secciones.sta_categorias, cargadoPorNombre });

    seedInasistenciaOrlant(db, rand, mes, idxMes, cargadoPorNombre);
    seedEfectividadAgendamientoOrlant(db, mes, idxMes, cargadoPorNombre);
    seedEfectividadCitasOrlant(db, mes, idxMes, cargadoPorNombre);
  });
}

// MOBILIZE: su unica "seccion" es un placeholder tecnico (ver el comentario
// de MOBILIZE en dashboard-config-seed.js -- `secciones` no admite un
// objeto vacio) sin ningun flujo real detras. Se siembra solo para que el
// seed de demo cubra TODAS las secciones de TODOS los clientes configurados
// (seed-demo.test.js), sin fingir un flujo que Mobilize no tiene.
function seedMobilizeNotas(db, { cargadoPorNombre }) {
  const cfg = configDe('MOBILIZE');
  MESES.forEach((mes) => {
    cargarSeccion(db, {
      cliente: 'MOBILIZE', seccion: 'notas', cadencia: 'mensual', periodo: mes,
      filas: [{ nota: 'Sin uso -- Mobilize funciona 100% automatico (Trafico de Llamadas + Calidad).' }],
      spec: cfg.secciones.notas, cargadoPorNombre,
    });
  });
}

// Fase 134 (decision del usuario, 2026-10-09): solo ORLANT y MOBILIZE
// quedan en produccion -- seedAurora/seedHospitalLaMaria y las funciones
// genericas de plantilla (seedVentas/seedCobranza/seedAtencion,
// PLANTILLA_OPTS con los 8 clientes de M3) se quitaron del todo, para que
// seed:demo nunca vuelva a crear datos de un cliente eliminado.
function seedDashboards(db, { cargadoPorNombre }) {
  seedOrlant(db, { cargadoPorNombre });
  seedMobilizeNotas(db, { cargadoPorNombre });
}

module.exports = { seedDashboards };
