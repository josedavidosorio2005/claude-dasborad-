// fase128-parte2-privacidad-revision-final.js — Prueba automatica de
// privacidad, Fase 128 Parte 2.
//
// Corre EN LOCAL (http://localhost:3000, con `npm run seed:demo` ya
// sembrado y el servidor arriba) con Playwright directo desde Node (nunca
// la extension de Claude in Chrome, ver CLAUDE.md). Carga, vía la API real
// con el usuario `demo_ADMIN`, un nombre FICTICIO y muy distintivo
// ("Zzqlovnik Wyrdstanhoff", no existe ningun asesor real con ese nombre)
// en 3 lugares distintos de ORLANT:
//   - efectividad_agendamiento (alimenta la tabla "Ranking de asesores" --
//     el hallazgo real de la Fase 126/127 que esta prueba cierra),
//   - agendas (ASESOR -- alimenta filtros/leyenda de "Agendas por línea"),
//   - tipificaciones (AGENTE -- alimenta el filtro de Tipificación).
//
// Despues corre las MISMAS funciones que usa
// scripts/produccion/revision-final.js contra produccion
// (correrChequeosAdmin/correrChequeosCliente, importadas de ese archivo --
// nunca una reimplementacion aparte que se desalinearia con el codigo
// real) contra este servidor local, y confirma que el nombre ficticio NO
// aparece en ninguna parte del reporte completo (JSON.stringify de todo lo
// que el script produce) -- la prueba concreta de "por construccion,
// nunca por lista de lugares" que pidio el usuario.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));

const BASE = process.env.APP_URL || 'http://localhost:3000';
process.env.APP_URL = BASE; // revision-final.js lee esta misma variable si algo la llegara a necesitar.
const revisionFinal = require(path.join(__dirname, '..', 'produccion', 'revision-final.js'));

const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const NOMBRE_FICTICIO = 'Zzqlovnik Wyrdstanhoff';

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('button.btn-login');
  await page.waitForTimeout(1000);
}

async function inyectarDatosSinteticos(page, nombre) {
  return page.evaluate(async (nombreFicticio) => {
    const efectividad = await apiRequest('POST', '/calidad/efectividad-agendamiento/carga', {
      campana: 'ORLANT',
      archivoNombre: 'fase128-parte2-sintetico.xlsx',
      filas: [['2026-09', nombreFicticio, 100, 50]],
    });
    const agendas = await apiRequest('POST', '/calidad/agendas/carga', {
      campana: 'ORLANT',
      archivoNombre: 'fase128-parte2-sintetico.xlsx',
      filas: [[nombreFicticio, 'SEDE SINTETICA', 'EXAMEN SINTETICO', 'ESPECIALIDAD SINTETICA', 'PROFESIONAL SINTETICO', '2026-09-15 10:00:00', '3P', 'SIN ENTIDAD']],
    });
    const tipificacion = await apiRequest('POST', '/calidad/tipificacion/carga', {
      campana: 'ORLANT',
      canal: 'LLAMADAS',
      archivoNombre: 'fase128-parte2-sintetico.xlsx',
      filas: [[nombreFicticio, '2026-09-15', '10:00:00', 60, 'CONTACTO EFECTIVO', 'SKILL SINTETICO']],
    });
    return { efectividad, agendas, tipificacion };
  }, nombre);
}

function buscarTextoNoPermitido(reporteCompleto) {
  const texto = JSON.stringify(reporteCompleto);
  const hallazgos = [];
  if (texto.includes(NOMBRE_FICTICIO)) hallazgos.push('el nombre ficticio "' + NOMBRE_FICTICIO + '" aparece en el reporte');
  if (/"texto"\s*:/.test(texto)) hallazgos.push('el campo "texto" (eliminado por construccion en la Fase 128 Parte 2) sigue apareciendo en algun lado');
  return hallazgos;
}

async function main() {
  const creds = leerCredenciales();
  const admin = creds.ADMIN;
  const cliente = creds.CLIENTES_DASH;
  if (!admin || !cliente) throw new Error('Faltan credenciales demo_ADMIN/demo_CLIENTES_DASH en ' + CRED_FILE + ' -- correr primero: cd server && npm run seed:demo');

  const browser = await chromium.launch({ headless: true });

  const ctx0 = await browser.newContext();
  const page0 = await ctx0.newPage();
  await login(page0, admin.user, admin.password);
  const inyeccion = await inyectarDatosSinteticos(page0, NOMBRE_FICTICIO);
  console.log('[fase128-parte2] datos sinteticos cargados:', JSON.stringify({
    efectividad: inyeccion.efectividad.insertadas, agendas: inyeccion.agendas.insertadas, tipificacion: inyeccion.tipificacion.insertadas,
  }));
  await ctx0.close();

  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  await login(pageA, admin.user, admin.password);
  const reporteAdmin = await revisionFinal.correrChequeosAdmin(pageA);
  await ctxA.close();

  const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageC = await ctxC.newPage();
  await login(pageC, cliente.user, cliente.password);
  const reporteCliente = await revisionFinal.correrChequeosCliente(pageC);
  await ctxC.close();

  await browser.close();

  const hallazgos = buscarTextoNoPermitido({ admin: reporteAdmin, clientesDash: reporteCliente });

  if (hallazgos.length) {
    console.error('FALLO:');
    hallazgos.forEach((h) => console.error('  - ' + h));
    process.exit(1);
  }
  console.log('OK: el nombre ficticio no aparece en ningun lado del reporte completo (admin + clientesDash) de revision-final.js.');
  process.exit(0);
}

main().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
