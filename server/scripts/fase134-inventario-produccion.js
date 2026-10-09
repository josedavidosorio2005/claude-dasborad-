#!/usr/bin/env node
// fase134-inventario-produccion.js — Fase 134, Paso 1: inventario de
// produccion SOLO LECTURA para decidir el borrado de todos los clientes
// menos ORLANT y MOBILIZE. Misma base de siempre: corre contra una COPIA
// del respaldo (nunca la base viva), igual mecanismo que
// scripts/verificar-restore-backup.js (readonly, --local <ruta> o S3).
//
// SOLO imprime conteos (numeros). Nunca una fila real, nunca un nombre de
// persona, nunca un valor de columna de texto libre -- los nombres de
// cliente/campana que imprime son identificadores de negocio (como
// "ORLANT"), no datos personales, y ya aparecen en todo el repo/docs.
//
// Uso:
//   docker compose exec -T app node scripts/fase134-inventario-produccion.js
//   docker compose exec -T app node scripts/fase134-inventario-produccion.js --local /app/server/data/backups/inconexion-<ts>.db
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

// Mismas 12 listas que el codigo (server/db.js: CLIENTES_LIST +
// CAMPANAS_CALIDAD) menos ORLANT/MOBILIZE.
const CLIENTES_A_BORRAR = [
  'HOSPITAL LA MARIA',
  'CLINICA AURORA',
  'TELEVENTAS SURA',
  'TELEVENTAS COMFAMA',
  'PANTERA MAIKERS',
  'ANDRES YEPES',
  'SASCHA FITNESS',
  'ALBERTO LINERO GO',
  'INFONDO',
  'BIVETT',
  'CONSULTORIO JULIAN MOLANO',
  'CARTERA INTERNA',
];
const CLIENTES_A_CONSERVAR = ['ORLANT', 'MOBILIZE'];
const TODOS = [...CLIENTES_A_BORRAR, ...CLIENTES_A_CONSERVAR];

// tabla -> columna de cliente/campana (ver server/db.js, cada CREATE TABLE).
const TABLAS = [
  ['calidad_plantillas', 'campana'],
  ['calidad_codificaciones', 'campana'],
  ['monitoreos', 'campana'],
  ['cronograma_metas', 'campana'],
  ['calidad_nivel_servicio', 'campana'],
  ['calidad_nivel_servicio_diario', 'campana'],
  ['trafico_whatsapp', 'campana'],
  ['agendas', 'campana'],
  ['tipificaciones', 'campana'],
  ['inasistencias', 'campana'],
  ['efectividad_agendamiento', 'campana'],
  ['efectividad_citas', 'campana'],
  ['salida_mensual', 'campana'],
  ['alias_asesores', 'campana'],
  ['trafico_skill_mapeo', 'campana'],
  ['umbrales_semaforo', 'campana'],
  ['gestion_humana_personal', 'campana'],
  ['dashboard_cargas', 'cliente'],
  ['dashboards_config', 'cliente'],
];

function inventarioTablas(db) {
  console.log('');
  console.log('== Filas por tabla y cliente/campana ==');
  for (const [tabla, col] of TABLAS) {
    let existe = true;
    try {
      db.prepare(`SELECT 1 FROM ${tabla} LIMIT 1`).get();
    } catch (e) {
      existe = false;
    }
    if (!existe) {
      console.log(`[${tabla}] tabla no existe en este backup`);
      continue;
    }
    const totalStmt = db.prepare(`SELECT COUNT(*) AS c FROM ${tabla}`);
    const porClienteStmt = db.prepare(`SELECT COUNT(*) AS c FROM ${tabla} WHERE ${col} = ?`);
    const total = totalStmt.get().c;
    const partes = [];
    let sumaConocidos = 0;
    for (const cliente of TODOS) {
      const n = porClienteStmt.get(cliente).c;
      sumaConocidos += n;
      if (n > 0) partes.push(`${cliente}=${n}`);
    }
    const otros = total - sumaConocidos;
    console.log(`[${tabla}] total=${total}  ${partes.join(' ')}${otros > 0 ? `  OTROS(fuera de las 14 listas)=${otros}` : ''}`);
  }
}

function inventarioUsuarios(db) {
  console.log('');
  console.log('== Usuarios: acceso a los clientes a borrar (por rol, solo conteos) ==');
  const rows = db.prepare('SELECT rol, perms, asesorCampana, active FROM users').all();

  // Por rol: cuantos usuarios tienen al menos 1 permiso campana_X/cliente_X
  // true para alguno de los 12 clientes a borrar.
  const porRolConAccesoABorrar = {};
  // Por CLIENTE a borrar, por rol: cuantos usuarios tienen ESE permiso
  // puntual (lo que pidio el usuario: desglose por cliente, no solo total).
  const porClientePorRol = {};
  CLIENTES_A_BORRAR.forEach((c) => { porClientePorRol[c] = {}; });
  // Por rol: de esos, cuantos quedarian con CERO acceso campana_*/cliente_*
  // total (a cualquier cliente, incluido ORLANT/MOBILIZE) si se quitan
  // justo los permisos de los 12 clientes a borrar.
  const porRolQuedariaSinAcceso = {};
  // ASESOR/SUPERVISOR: asesorCampana coincide exacto con un cliente a borrar.
  const porRolAsesorCampanaABorrar = {};

  for (const u of rows) {
    let perms = {};
    try { perms = JSON.parse(u.perms || '{}'); } catch (e) { perms = {}; }

    const keysCampanaCliente = Object.keys(perms).filter(
      (k) => (k.startsWith('campana_') || k.startsWith('cliente_')) && perms[k] === true
    );
    const nombresConAcceso = keysCampanaCliente.map((k) => k.replace(/^campana_|^cliente_/, ''));
    const tieneAccesoABorrar = nombresConAcceso.some((n) => CLIENTES_A_BORRAR.includes(n));
    if (tieneAccesoABorrar) {
      porRolConAccesoABorrar[u.rol] = (porRolConAccesoABorrar[u.rol] || 0) + 1;
      nombresConAcceso.forEach((n) => {
        if (CLIENTES_A_BORRAR.includes(n)) {
          porClientePorRol[n][u.rol] = (porClientePorRol[n][u.rol] || 0) + 1;
        }
      });
      const quedaria = nombresConAcceso.filter((n) => !CLIENTES_A_BORRAR.includes(n));
      if (quedaria.length === 0) {
        porRolQuedariaSinAcceso[u.rol] = (porRolQuedariaSinAcceso[u.rol] || 0) + 1;
      }
    }

    if (u.asesorCampana && CLIENTES_A_BORRAR.includes(String(u.asesorCampana).trim())) {
      porRolAsesorCampanaABorrar[u.rol] = (porRolAsesorCampanaABorrar[u.rol] || 0) + 1;
    }
  }

  console.log('Usuarios con permiso, POR CLIENTE a borrar y por rol:');
  CLIENTES_A_BORRAR.forEach((c) => {
    const porRol = porClientePorRol[c];
    const entradas = Object.entries(porRol);
    console.log(`  ${c}: ${entradas.length ? entradas.map(([r, n]) => `${r}=${n}`).join(' ') : '(ninguno)'}`);
  });

  console.log('Usuarios (cualquier rol) con permiso campana_X/cliente_X=true a ALGUNO de los 12 clientes a borrar:');
  for (const [rol, n] of Object.entries(porRolConAccesoABorrar)) console.log(`  ${rol}: ${n}`);
  if (!Object.keys(porRolConAccesoABorrar).length) console.log('  (ninguno)');

  console.log('De esos, quedarian con CERO acceso campana_*/cliente_* tras quitar los 12 (no se borran, solo se reporta):');
  for (const [rol, n] of Object.entries(porRolQuedariaSinAcceso)) console.log(`  ${rol}: ${n}`);
  if (!Object.keys(porRolQuedariaSinAcceso).length) console.log('  (ninguno)');

  console.log('ASESOR/SUPERVISOR con asesorCampana EXACTO = a un cliente a borrar (campo libre, no se toca en Paso 2):');
  for (const [rol, n] of Object.entries(porRolAsesorCampanaABorrar)) console.log(`  ${rol}: ${n}`);
  if (!Object.keys(porRolAsesorCampanaABorrar).length) console.log('  (ninguno)');

  const totalUsuarios = rows.length;
  const activos = rows.filter((u) => u.active === 1).length;
  console.log(`\nTotal usuarios en la base: ${totalUsuarios} (activos: ${activos}) -- informativo, ninguno se toca en este inventario.`);
}

function correr(rutaDb) {
  const db = new Database(rutaDb, { readonly: true });
  try {
    const integridad = db.pragma('integrity_check', { simple: true });
    console.log(`[fase134-inventario] integrity_check: ${integridad}`);
    if (integridad !== 'ok') {
      console.error('[fase134-inventario] FALLO: integrity_check no devolvio "ok". No se sigue.');
      process.exitCode = 1;
      return;
    }
    inventarioTablas(db);
    inventarioUsuarios(db);
  } finally {
    db.close();
  }
}

async function modoLocal(rutaLocal) {
  if (!fs.existsSync(rutaLocal)) {
    console.error(`[fase134-inventario] No existe el archivo: ${rutaLocal}`);
    process.exitCode = 1;
    return;
  }
  const { size, mtime } = fs.statSync(rutaLocal);
  console.log(`[fase134-inventario] Backup local: ${mtime.toISOString()} (${(size / 1024).toFixed(1)} KiB)`);
  correr(rutaLocal);
}

async function modoS3() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    console.error('[fase134-inventario] BACKUP_S3_BUCKET no esta definido -- nada que inventariar.');
    process.exitCode = 1;
    return;
  }
  const prefix = (process.env.BACKUP_S3_PREFIX || 'db-backups').replace(/^\/+|\/+$/g, '');
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region });

  console.log(`[fase134-inventario] Listando s3://${bucket}/${prefix}/ ...`);
  const listado = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix + '/' }));
  const objetos = (listado.Contents || []).filter((o) => /inconexion-\d{8}-\d{6}\.db$/.test(o.Key));
  if (!objetos.length) {
    console.error('[fase134-inventario] No se encontro ningun backup en S3 con el nombre esperado.');
    process.exitCode = 1;
    return;
  }
  objetos.sort((a, b) => (a.Key < b.Key ? 1 : -1));
  const masReciente = objetos[0];
  console.log(`[fase134-inventario] Backup mas reciente: (${masReciente.LastModified}, ${(masReciente.Size / 1024).toFixed(1)} KiB)`);

  const destino = path.join(os.tmpdir(), 'fase134-inventario-' + Date.now() + '.db');
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: masReciente.Key }));
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destino);
    obj.Body.pipe(out);
    obj.Body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });

  try {
    correr(destino);
  } finally {
    fs.unlinkSync(destino);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const idxLocal = argv.indexOf('--local');
  if (idxLocal !== -1) {
    const ruta = argv[idxLocal + 1];
    if (!ruta) {
      console.error('[fase134-inventario] --local requiere una ruta de archivo.');
      process.exitCode = 1;
      return;
    }
    await modoLocal(ruta);
    return;
  }
  await modoS3();
}

main().catch((err) => {
  console.error('[fase134-inventario] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
