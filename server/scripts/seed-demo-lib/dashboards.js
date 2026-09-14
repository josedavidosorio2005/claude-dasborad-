// dashboards.js — Datos operativos de demo para los 12 dashboards de cliente
// (dashboard_cargas), 6 meses de historico en TODAS sus secciones. Escribe
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
  });
}

// ════════════════════════════════════════════════════════════
// CLINICA AURORA
// ════════════════════════════════════════════════════════════
function seedAurora(db, { cargadoPorNombre }) {
  const cliente = 'CLINICA AURORA';
  const cfg = configDe(cliente);
  const rand = rngFromSeed('dash|' + cliente);

  MESES.forEach((mes, idxMes) => {
    const histLlamadas = ent(serieMensual(rand, idxMes, { base: 5200 }));
    const histWhatsapp = ent(serieMensual(rand, idxMes, { base: 2400 }));
    const llamadasSalida = ent(serieMensual(rand, idxMes, { base: 1600 }));
    const wppSalida = ent(serieMensual(rand, idxMes, { base: 900 }));
    const totalAgendas = ent(serieMensual(rand, idxMes, { base: 1800 }));
    const agendasManager = ent(totalAgendas * randFloat(rand, 0.9, 1.05));
    const agendasWolkvox = ent(totalAgendas * randFloat(rand, 0.9, 1.05));
    const nivelAtencion = randFloat(rand, 82, 95, 1);
    const abandonos = ent(histLlamadas * (1 - nivelAtencion / 100) * randFloat(rand, 0.8, 1.1));

    const resumen = [{
      nivel_atencion: nivelAtencion,
      abandonos,
      aht_segundos: randInt(rand, 150, 320),
      nivel_atencion_wpp: randFloat(rand, 80, 96, 2),
      total_agendas: totalAgendas,
      efectividad: randFloat(rand, 70, 92, 1),
      hist_llamadas: histLlamadas,
      hist_whatsapp: histWhatsapp,
      llamadas_salida: llamadasSalida,
      wpp_salida: wppSalida,
      agendas_manager: agendasManager,
      agendas_wolkvox: agendasWolkvox,
      errores_gestion: randInt(rand, 5, 60),
      inasistencia_pct: randFloat(rand, 6, 18, 1),
    }];
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const llamadasFilas = [];
    const salidaFilas = [];
    const agendasFilas = [];
    for (let d = 1; d <= gen; d++) {
      if (diaSemana(mes, d) === 0) continue; // domingo cerrado
      const finde = diaSemana(mes, d) === 6;
      const factor = finde ? 0.3 : 1;
      const ingresadas = ent(randFloat(rand, 140, 260, 0) * factor);
      const pctContestadas = randFloat(rand, 80, 97, 1);
      llamadasFilas.push({
        fecha: fechaISO(mes, d),
        llamadas_ingresadas: ingresadas,
        pct_contestadas: pctContestadas,
        pct_abandonadas: round2(100 - pctContestadas),
        aht_segundos: randInt(rand, 140, 300),
        wpp_ingresados: ent(randFloat(rand, 60, 140, 0) * factor),
      });
      salidaFilas.push({
        fecha: fechaISO(mes, d),
        llamadas_salida: ent(randFloat(rand, 40, 100, 0) * factor),
        wpp_salida: ent(randFloat(rand, 20, 60, 0) * factor),
      });
      agendasFilas.push({
        fecha: fechaISO(mes, d),
        agendas_llamada: ent(randFloat(rand, 30, 80, 0) * factor),
        agendas_whatsapp: ent(randFloat(rand, 15, 50, 0) * factor),
      });
    }
    cargarSeccion(db, { cliente, seccion: 'llamadas', cadencia: 'diaria', periodo: mes, filas: llamadasFilas, spec: cfg.secciones.llamadas, cargadoPorNombre });
    cargarSeccion(db, { cliente, seccion: 'salida', cadencia: 'diaria', periodo: mes, filas: salidaFilas, spec: cfg.secciones.salida, cargadoPorNombre });
    cargarSeccion(db, { cliente, seccion: 'agendas', cadencia: 'diaria', periodo: mes, filas: agendasFilas, spec: cfg.secciones.agendas, cargadoPorNombre });

    const canales = ['LLAMADA_ENTRADA', 'LLAMADA_SALIDA', 'WPP_ENTRADA', 'WPP_SALIDA', 'ENCUESTAS'];
    const bases = [histLlamadas, llamadasSalida, histWhatsapp, wppSalida, 400];
    const tipif = [];
    canales.forEach((canal, i) => {
      filasTipificacion(rand, bases[i], TIPIFICACIONES_GENERICAS, { canal }).forEach((f) =>
        tipif.push({ canal, tipificacion: f.tipificacion, cantidad: f.cantidad })
      );
    });
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });

    const especialidades = ['MEDICINA GENERAL', 'PEDIATRIA', 'GINECOLOGIA', 'OPTOMETRIA', 'PSICOLOGIA'];
    const asesoresAurora = ['Recepcion A', 'Recepcion B', 'Recepcion C', 'Recepcion D'];
    const agCats = [
      ...filasTipificacion(rand, totalAgendas, especialidades).map((f) => ({ dimension: 'ESPECIALIDAD', categoria: f.tipificacion, valor: f.cantidad })),
      ...filasTipificacion(rand, totalAgendas, asesoresAurora).map((f) => ({ dimension: 'ASESOR', categoria: f.tipificacion, valor: f.cantidad })),
      ...especialidades.map((e) => ({ dimension: 'INASISTENCIA_ESPECIALIDAD', categoria: e, valor: randFloat(rand, 5, 22, 1) })),
    ];
    cargarSeccion(db, { cliente, seccion: 'agendas_categorias', cadencia: 'mensual', periodo: mes, filas: agCats, spec: cfg.secciones.agendas_categorias, cargadoPorNombre });

    const sabFilas = sabadosDelMes(mes).map((d) => ({
      fecha: fechaISO(mes, d),
      llamadas: randInt(rand, 30, 90),
      whatsapp: randInt(rand, 15, 50),
    }));
    if (sabFilas.length) {
      cargarSeccion(db, { cliente, seccion: 'sabados', cadencia: 'mensual', periodo: mes, filas: sabFilas, spec: cfg.secciones.sabados, cargadoPorNombre });
    }
  });
}

// ════════════════════════════════════════════════════════════
// HOSPITAL LA MARIA (2 sedes)
// ════════════════════════════════════════════════════════════
function seedHospitalLaMaria(db, { cargadoPorNombre }) {
  const cliente = 'HOSPITAL LA MARIA';
  const cfg = configDe(cliente);
  const sedes = ['CASTILLA', 'SEDE33'];
  const rand = rngFromSeed('dash|' + cliente);

  MESES.forEach((mes, idxMes) => {
    const resumen = [];
    const porSedeIngresadas = {};
    sedes.forEach((sede) => {
      const ingresadas = ent(serieMensual(rand, idxMes, { base: sede === 'CASTILLA' ? 4200 : 2600 }));
      const nivelAtencion = randFloat(rand, 75, 93, 1);
      const contestadas = ent(ingresadas * (nivelAtencion / 100));
      const abandonadas = ingresadas - contestadas;
      porSedeIngresadas[sede] = ingresadas;
      resumen.push({
        sede,
        llamadas_ingresadas: ingresadas,
        nivel_atencion: nivelAtencion,
        llamadas_contestadas: contestadas,
        llamadas_abandonadas: abandonadas,
        wpp_ingresados: ent(serieMensual(rand, idxMes, { base: sede === 'CASTILLA' ? 1800 : 900 })),
        agendas_wpp: ent(serieMensual(rand, idxMes, { base: 500 })),
        agendas_llamada: ent(serieMensual(rand, idxMes, { base: 700 })),
        aht_segundos: randInt(rand, 160, 340),
        llamadas_salida: sede === 'SEDE33' ? ent(serieMensual(rand, idxMes, { base: 500 })) : 0,
        wpp_salida: sede === 'SEDE33' ? ent(serieMensual(rand, idxMes, { base: 300 })) : 0,
      });
    });
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const diaFilas = [];
    for (let d = 1; d <= gen; d++) {
      if (diaSemana(mes, d) === 0) continue;
      const finde = diaSemana(mes, d) === 6;
      const factor = finde ? 0.35 : 1;
      sedes.forEach((sede) => {
        const ingresadas = ent(randFloat(rand, sede === 'CASTILLA' ? 120 : 70, sede === 'CASTILLA' ? 220 : 140, 0) * factor);
        const pctContestadas = randFloat(rand, 72, 95, 1);
        diaFilas.push({
          fecha: fechaISO(mes, d),
          sede,
          llamadas_ingresadas: ingresadas,
          pct_contestadas: pctContestadas,
          pct_abandonadas: round2(100 - pctContestadas),
          wpp_ingresados: ent(randFloat(rand, 30, 90, 0) * factor),
          aht_segundos: randInt(rand, 150, 320),
          agendas_wpp: ent(randFloat(rand, 10, 40, 0) * factor),
          agendas_llamada: ent(randFloat(rand, 15, 55, 0) * factor),
        });
      });
    }
    cargarSeccion(db, { cliente, seccion: 'dia', cadencia: 'diaria', periodo: mes, filas: diaFilas, spec: cfg.secciones.dia, cargadoPorNombre });

    const tipif = [];
    sedes.forEach((sede) => {
      filasTipificacion(rand, porSedeIngresadas[sede], TIPIFICACIONES_GENERICAS).forEach((f) =>
        tipif.push({ sede, tipificacion: f.tipificacion, cantidad: f.cantidad })
      );
    });
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });

    const demanda = [];
    const ivrTotal = ent(porSedeIngresadas.CASTILLA * 0.08);
    demanda.push({ sede: 'CASTILLA', dimension: 'IVR', categoria: 'LLAMADAS IVR SIN AGENDA', llamadas: ivrTotal, whatsapp: 0 });
    const especialidades = ['MEDICINA GENERAL', 'PEDIATRIA', 'GINECOLOGIA', 'ORTOPEDIA', 'CARDIOLOGIA'];
    filasTipificacion(rand, ent(porSedeIngresadas.CASTILLA * 0.15), especialidades).forEach((f) =>
      demanda.push({ sede: 'CASTILLA', dimension: 'ESPECIALIDAD', categoria: f.tipificacion, llamadas: f.cantidad, whatsapp: ent(f.cantidad * 0.4) })
    );
    cargarSeccion(db, { cliente, seccion: 'demanda', cadencia: 'mensual', periodo: mes, filas: demanda, spec: cfg.secciones.demanda, cargadoPorNombre });

    const entidades = ['NUEVA EPS', 'SURA EPS', 'SALUD TOTAL', 'COOSALUD', 'PARTICULAR'];
    const entFilas = [];
    sedes.forEach((sede) => {
      ['LLAMADA', 'WPP'].forEach((canal) => {
        filasTipificacion(rand, porSedeIngresadas[sede] * (canal === 'WPP' ? 0.4 : 1), entidades).forEach((f) =>
          entFilas.push({ sede, canal, entidad: f.tipificacion, cantidad: f.cantidad })
        );
      });
    });
    cargarSeccion(db, { cliente, seccion: 'entidades', cadencia: 'mensual', periodo: mes, filas: entFilas, spec: cfg.secciones.entidades, cargadoPorNombre });
  });
}

// ════════════════════════════════════════════════════════════
// Plantilla VENTAS (6 clientes) / COBRANZA (1) / ATENCION (2)
// ════════════════════════════════════════════════════════════
const ASESORES_POOL_2 = [
  'Carlos Mario Zapata', 'Diana Marcela Rios', 'Yesid Alfonso Tabares', 'Lorena Patricia Vanegas',
  'Wilson Andres Cuartas', 'Katherine Alzate', 'Harold Steven Mora', 'Angela Maria Buritica',
  'Ivan Dario Muñoz', 'Tatiana Marin', 'Oscar Fabian Castro', 'Viviana Andrea Trujillo',
];

function asesoresVentasPara(cliente, cantidad) {
  const rand = rngFromSeed('asesoresv|' + cliente);
  const start = randInt(rand, 0, ASESORES_POOL_2.length - cantidad - 1);
  return ASESORES_POOL_2.slice(start, start + cantidad);
}

function seedVentas(db, cliente, opts, { cargadoPorNombre }) {
  const cfg = configDe(cliente);
  const rand = rngFromSeed('dash|' + cliente);
  const asesores = asesoresVentasPara(cliente, randInt(rand, 8, 12));
  const metaContact = (opts.metaContact || 70) / 100;
  const metaConv = (opts.metaConv || 15) / 100;

  MESES.forEach((mes, idxMes) => {
    const baseAsignada = ent(serieMensual(rand, idxMes, { base: 6000 }));
    const gestionados = ent(baseAsignada * randFloat(rand, 0.8, 0.98));
    const contactados = ent(gestionados * (metaContact + randFloat(rand, -0.15, 0.12)));
    const contactosEfectivos = ent(contactados * randFloat(rand, 0.55, 0.85));
    const ventas = ent(contactosEfectivos * (metaConv + randFloat(rand, -0.06, 0.06)));
    const metaVentas = ent(ventas * randFloat(rand, 0.8, 1.25));

    const resumen = [{
      base_asignada: baseAsignada,
      gestionados,
      contactados,
      contactos_efectivos: contactosEfectivos,
      ventas,
      meta_ventas: metaVentas,
      aht_segundos: randInt(rand, 150, 340),
    }];
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const diario = [];
    for (let d = 1; d <= gen; d++) {
      if (diaSemana(mes, d) === 0) continue;
      const finde = diaSemana(mes, d) === 6;
      const factor = finde ? 0.3 : 1;
      const gest = ent(randFloat(rand, 150, 320, 0) * factor);
      const cont = ent(gest * randFloat(rand, 0.5, 0.85));
      const vend = ent(cont * randFloat(rand, 0.08, 0.22));
      diario.push({ fecha: fechaISO(mes, d), gestionados: gest, contactados: cont, ventas: vend });
    }
    cargarSeccion(db, { cliente, seccion: 'diario', cadencia: 'diaria', periodo: mes, filas: diario, spec: cfg.secciones.diario, cargadoPorNombre });

    const tipif = filasTipificacion(rand, gestionados, TIPIFICACIONES_GENERICAS);
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });

    const pesos = asesores.map(() => 0.5 + rand());
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    const asesoresFilas = asesores.map((asesor, i) => {
      const g = ent((pesos[i] / sumaPesos) * gestionados);
      const v = ent(g * randFloat(rand, 0.06, 0.24));
      return { asesor, gestionados: g, ventas: v };
    });
    cargarSeccion(db, { cliente, seccion: 'asesores', cadencia: 'mensual', periodo: mes, filas: asesoresFilas, spec: cfg.secciones.asesores, cargadoPorNombre });
  });
}

function seedCobranza(db, cliente, opts, { cargadoPorNombre }) {
  const cfg = configDe(cliente);
  const rand = rngFromSeed('dash|' + cliente);
  const asesores = asesoresVentasPara(cliente, randInt(rand, 8, 12));
  let saldoCartera = 9_500_000_000 + randInt(rand, 0, 2_000_000_000);
  const metaCobertura = (opts.metaCobertura || 90) / 100;
  const metaPromesasPct = (opts.metaPromesas || 60) / 100;

  MESES.forEach((mes, idxMes) => {
    const cuentasAsignadas = ent(serieMensual(rand, idxMes, { base: 12000, tendenciaPct: -0.05 }));
    const cuentasGestionadas = ent(cuentasAsignadas * Math.min(1, metaCobertura + randFloat(rand, -0.12, 0.08)));
    const contactosEfectivos = ent(cuentasGestionadas * randFloat(rand, 0.35, 0.6));
    const promesasPago = ent(contactosEfectivos * randFloat(rand, 0.3, 0.55));
    const promesasCumplidas = ent(promesasPago * Math.min(1, metaPromesasPct + randFloat(rand, -0.15, 0.15)));
    const recaudo = round2(promesasCumplidas * randFloat(rand, 180000, 420000, 0));
    const metaRecaudo = round2(recaudo * randFloat(rand, 0.85, 1.2));
    saldoCartera = Math.max(0, round2(saldoCartera - recaudo * randFloat(rand, 0.6, 1)));

    const resumen = [{
      cuentas_asignadas: cuentasAsignadas,
      cuentas_gestionadas: cuentasGestionadas,
      contactos_efectivos: contactosEfectivos,
      promesas_pago: promesasPago,
      promesas_cumplidas: promesasCumplidas,
      recaudo,
      meta_recaudo: metaRecaudo,
      saldo_cartera: saldoCartera,
    }];
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const diario = [];
    for (let d = 1; d <= gen; d++) {
      if (diaSemana(mes, d) === 0) continue;
      const finde = diaSemana(mes, d) === 6;
      const factor = finde ? 0.25 : 1;
      const gest = ent(randFloat(rand, 300, 700, 0) * factor);
      const prom = ent(gest * randFloat(rand, 0.15, 0.3));
      const rec = round2(prom * randFloat(rand, 150000, 380000, 0));
      diario.push({ fecha: fechaISO(mes, d), gestionadas: gest, promesas: prom, recaudo: rec });
    }
    cargarSeccion(db, { cliente, seccion: 'diario', cadencia: 'diaria', periodo: mes, filas: diario, spec: cfg.secciones.diario, cargadoPorNombre });

    const tipif = filasTipificacion(rand, cuentasGestionadas, TIPIFICACIONES_GENERICAS);
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });

    const pesos = asesores.map(() => 0.5 + rand());
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    const asesoresFilas = asesores.map((asesor, i) => {
      const g = ent((pesos[i] / sumaPesos) * cuentasGestionadas);
      const p = ent(g * randFloat(rand, 0.15, 0.3));
      const r = round2(p * randFloat(rand, 150000, 380000, 0));
      return { asesor, gestionadas: g, promesas: p, recaudo: r };
    });
    cargarSeccion(db, { cliente, seccion: 'asesores', cadencia: 'mensual', periodo: mes, filas: asesoresFilas, spec: cfg.secciones.asesores, cargadoPorNombre });
  });
}

function seedAtencion(db, cliente, opts, { cargadoPorNombre }) {
  const cfg = configDe(cliente);
  const rand = rngFromSeed('dash|' + cliente);
  const campoSalida = opts.salidaCampo || 'agendas';

  MESES.forEach((mes, idxMes) => {
    const llamadasEntrada = ent(serieMensual(rand, idxMes, { base: 3200 }));
    const wppEntrada = ent(serieMensual(rand, idxMes, { base: 1800 }));
    const nivelAtencion = randFloat(rand, 78, 95, 1);
    const abandonos = ent(llamadasEntrada * (1 - nivelAtencion / 100) * randFloat(rand, 0.8, 1.1));
    const salidaVal = ent((llamadasEntrada + wppEntrada) * randFloat(rand, 0.18, 0.32));
    const metaSalida = ent(salidaVal * randFloat(rand, 0.85, 1.2));

    const resumen = [{
      llamadas_entrada: llamadasEntrada,
      wpp_entrada: wppEntrada,
      nivel_atencion: nivelAtencion,
      abandonos,
      aht_segundos: randInt(rand, 130, 300),
      [campoSalida]: salidaVal,
      ['meta_' + campoSalida]: metaSalida,
    }];
    cargarSeccion(db, { cliente, seccion: 'resumen', cadencia: 'mensual', periodo: mes, filas: resumen, spec: cfg.secciones.resumen, cargadoPorNombre });

    const gen = diasGenerables(mes);
    const diario = [];
    for (let d = 1; d <= gen; d++) {
      if (diaSemana(mes, d) === 0) continue;
      const finde = diaSemana(mes, d) === 6;
      const factor = finde ? 0.3 : 1;
      const llamadas = ent(randFloat(rand, 90, 180, 0) * factor);
      const wpp = ent(randFloat(rand, 50, 120, 0) * factor);
      diario.push({
        fecha: fechaISO(mes, d),
        llamadas,
        wpp,
        [campoSalida]: ent((llamadas + wpp) * randFloat(rand, 0.15, 0.3)),
      });
    }
    cargarSeccion(db, { cliente, seccion: 'diario', cadencia: 'diaria', periodo: mes, filas: diario, spec: cfg.secciones.diario, cargadoPorNombre });

    const tipif = filasTipificacion(rand, llamadasEntrada + wppEntrada, TIPIFICACIONES_GENERICAS);
    cargarSeccion(db, { cliente, seccion: 'tipificacion', cadencia: 'mensual', periodo: mes, filas: tipif, spec: cfg.secciones.tipificacion, cargadoPorNombre });
  });
}

const PLANTILLA_OPTS = {
  'TELEVENTAS SURA': { tipo: 'ventas', metaContact: 70, metaConv: 15 },
  'TELEVENTAS COMFAMA': { tipo: 'ventas', metaContact: 70, metaConv: 15 },
  'PANTERA MAIKERS': { tipo: 'ventas', metaContact: 65, metaConv: 12 },
  'ANDRES YEPES': { tipo: 'ventas', metaContact: 65, metaConv: 12 },
  'MOVILIZE': { tipo: 'ventas', metaContact: 65, metaConv: 12 },
  'ALBERTO LINERO GO': { tipo: 'ventas', metaContact: 65, metaConv: 12 },
  'INFONDO': { tipo: 'cobranza', metaCobertura: 90, metaPromesas: 60 },
  'SASCHA FITNESS': { tipo: 'atencion', salidaCampo: 'pedidos' },
  'BIVETT': { tipo: 'atencion', salidaCampo: 'agendas' },
};

function seedDashboards(db, { cargadoPorNombre }) {
  seedOrlant(db, { cargadoPorNombre });
  seedAurora(db, { cargadoPorNombre });
  seedHospitalLaMaria(db, { cargadoPorNombre });
  for (const [cliente, opts] of Object.entries(PLANTILLA_OPTS)) {
    if (opts.tipo === 'ventas') seedVentas(db, cliente, opts, { cargadoPorNombre });
    else if (opts.tipo === 'cobranza') seedCobranza(db, cliente, opts, { cargadoPorNombre });
    else seedAtencion(db, cliente, opts, { cargadoPorNombre });
  }
}

module.exports = { seedDashboards };
