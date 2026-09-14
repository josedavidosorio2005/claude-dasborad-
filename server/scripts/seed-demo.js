#!/usr/bin/env node
// scripts/seed-demo.js — Siembra datos de demostracion en TODOS los
// dashboards de InConexion Platform (o los limpia con --limpiar).
//
//   npm run seed:demo            — siembra (idempotente: correrlo 2 veces no duplica nada)
//   npm run seed:demo:limpiar    — borra EXACTAMENTE lo que este script sembro
//
// Ver la seccion "Datos de demostracion" del README para el detalle completo.
//
// Escribe DIRECTO a SQLite (server/db.js), pero SIEMPRE pasando por las mismas
// funciones de normalizacion/calculo que usa la API real
// (dashboard-secciones.normalizarFilas, calidad-logic.computeScore,
// nivel-servicio-diario.cargarNivelServicioDiario) — para que un dato sembrado
// sea indistinguible de uno real y nunca se cuele algo que la app rechazaria.
'use strict';

// ── Guarda de produccion: nunca corre contra produccion por accidente ──────
// (antes de cargar config/db, que ya validan y abren la conexion real).
const nodeEnv = process.env.NODE_ENV || 'development';
const esProduccion = nodeEnv === 'production';
if (esProduccion && process.env.SEED_DEMO_CONFIRM !== '1') {
  process.stderr.write(
    '\n[seed-demo] NODE_ENV=production y SEED_DEMO_CONFIRM no esta en "1".\n' +
      '            Por seguridad este script NO corre contra produccion sin\n' +
      '            confirmacion explicita. Si de verdad quieres sembrar (o\n' +
      '            limpiar) datos de demo en produccion, vuelve a correr con:\n\n' +
      '              SEED_DEMO_CONFIRM=1 npm run seed:demo\n' +
      '              SEED_DEMO_CONFIRM=1 npm run seed:demo:limpiar\n\n'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const limpiar = args.includes('--limpiar') || args.includes('--clean');

const CARGADO_POR = 'Seed Demo (script)';

function linea(char, n) {
  return char.repeat(n);
}

function imprimirResumen(titulo, filas) {
  process.stdout.write('\n' + titulo + '\n' + linea('-', titulo.length) + '\n');
  filas.forEach((f) => process.stdout.write('  ' + f + '\n'));
}

async function main() {
  // En produccion los secretos (JWT_SECRET, MASTER_ADMIN_PASSWORD_HASH...) no
  // viven en el entorno del contenedor: bootstrap.js los hidrata desde SSM
  // DENTRO del proceso del servidor al arrancar (nunca se persisten). Un
  // proceso nuevo (`docker compose exec ... node scripts/seed-demo.js`) no
  // los hereda, asi que este script hace la MISMA hidratacion antes de tocar
  // ../config/../db — igual que bootstrap.js. Sin SSM_PARAM_PREFIX es un no-op.
  await require('../secrets').hydrateEnv();

  const db = require('../db'); // side effect: crea/migra el esquema + semillas base (usuarios ejemplo, plantillas, dashboards_config)
  const { CONFIGS } = require('../dashboard-config-seed');
  const { ensureMarksTable, countByTabla, limpiarTodo } = require('./seed-demo-lib/marks');
  const { campanasConCalidadTab } = require('./seed-demo-lib/campanas');
  const { seedUsers } = require('./seed-demo-lib/users');
  const { seedCalidad } = require('./seed-demo-lib/calidad');
  const { seedNivelServicio } = require('./seed-demo-lib/nivel-servicio');
  const { seedDashboards } = require('./seed-demo-lib/dashboards');
  const { seedInventario } = require('./seed-demo-lib/inventario');
  const { seedGerencia } = require('./seed-demo-lib/gerencia');
  const { seedGestionHumana } = require('./seed-demo-lib/gestion-humana');

  ensureMarksTable(db);

  if (limpiar) {
    process.stdout.write(
      `\n[seed-demo] Limpiando datos de demo${esProduccion ? ' EN PRODUCCION' : ''} (DB: ${db.DB_PATH})...\n`
    );
    const borrados = limpiarTodo(db);
    const filas = Object.entries(borrados)
      .filter(([, n]) => n > 0)
      .map(([tabla, n]) => `${tabla}: ${n} fila(s) borradas`);
    imprimirResumen('Limpieza completada', filas.length ? filas : ['(no habia nada sembrado por seed-demo)']);
    process.stdout.write('\n');
    db.closeDb();
    return;
  }

  process.stdout.write(
    `\n[seed-demo] Sembrando datos de demo${esProduccion ? ' EN PRODUCCION' : ''} (DB: ${db.DB_PATH})...\n`
  );

  const clientesList = CONFIGS.map((c) => c.cliente);
  const campanasCalidad = campanasConCalidadTab(CONFIGS);

  const tx = db.transaction(() => {
    const { porRol, creadosConPassword } = seedUsers(db, { clientesList, campanasCalidad });
    const cal = seedCalidad(db, { campanas: campanasCalidad, porRol });
    const ns = seedNivelServicio(db, { campanas: campanasCalidad, cargadoPorNombre: CARGADO_POR });
    seedDashboards(db, { cargadoPorNombre: CARGADO_POR });
    const inv = seedInventario(db, { cargadoPorNombre: CARGADO_POR });
    const ger = seedGerencia(db, { cargadoPorNombre: CARGADO_POR });
    const gh = seedGestionHumana(db, { clientesList, cargadoPorNombre: CARGADO_POR });
    return { creadosConPassword, cal, ns, inv, ger, gh, clientesList, campanasCalidad };
  });

  const r = tx();

  imprimirResumen('Cobertura', [
    `${r.clientesList.length} dashboards de cliente con carga en todas sus secciones (6 meses: 2026-04 a 2026-09)`,
    `${r.campanasCalidad.length} campanas con monitoreos de Calidad y cronograma de metas`,
    `Nivel de Servicio diario: ${r.ns.diarioCreados} fila(s) nuevas, ${r.ns.mesesActualizados} mes(es) recalculados`,
    `Calidad: ${r.cal.monitoreosCreados} monitoreo(s) nuevo(s), ${r.cal.metasCreadas} meta(s) de cronograma nuevas`,
    `Inventario: ${r.inv.itemsCreados} item(s) nuevos, ${r.inv.movimientosCreados} movimiento(s) nuevos`,
    `Gerencia: ${r.ger.kpisCreados} KPI(s) nuevos`,
    `Gestion Humana: ${r.gh.creados} registro(s) de personal nuevos`,
  ]);

  const totales = countByTabla(db);
  imprimirResumen(
    'Total marcado por seed-demo (lo que borrara seed:demo:limpiar)',
    totales.map((t) => `${t.tabla}: ${t.n}`)
  );

  if (r.creadosConPassword.length) {
    imprimirResumen('Usuarios de demo CREADOS en esta corrida (contrasena solo se muestra AHORA)', [
      ...r.creadosConPassword.map((u) => `${u.rol.padEnd(14)} user: ${u.user.padEnd(20)} password: ${u.password}`),
      '',
      'Guarda estas contrasenas ahora: no se pueden volver a mostrar (se guardan hasheadas).',
    ]);
  } else {
    imprimirResumen('Usuarios de demo', ['Ya existian de una corrida anterior — contrasenas sin cambios (no se muestran de nuevo).']);
  }

  process.stdout.write('\n[seed-demo] Listo. Corre "npm run seed:demo:limpiar" para deshacer exactamente esto.\n\n');
  db.closeDb();
}

main().catch((err) => {
  process.stderr.write('\n[seed-demo] ERROR: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exitCode = 1;
});
