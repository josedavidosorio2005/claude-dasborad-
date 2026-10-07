// fase129-diagnostico-inasistencia-agosto.js — Script de un solo uso, Fase
// 129. Diagnóstico de SOLO LECTURA (ningún POST) de qué hay HOY en
// producción para Inasistencia de ORLANT, agosto 2026 y el resto de meses,
// comparado contra los números de control del archivo real que envió
// Edwin. Playwright DIRECTO desde Node (headless:false) -- NO la extensión
// de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El usuario
// inicia sesión a mano; el script nunca ve ni escribe la contraseña.
//
// PRIVACIDAD, por construcción (corregido tras un incidente real: la
// version anterior SI dejaba pasar `opciones.entidades` -- la lista de
// entidades/pacientes reales -- hasta Node, y solo la borraba con un
// `delete` justo antes del dump final; una linea nueva entre medio habria
// podido imprimirla antes de llegar a ese `delete`). Ahora la extraccion
// de campos seguros pasa DENTRO de page.evaluate -- el valor crudo de
// `entidades` NUNCA cruza al lado de Node, ni siquiera un instante (mismo
// criterio que `veredictoSubvista`, scripts/produccion/revision-final.js:
// nunca se trae un objeto crudo del servidor/DOM, siempre se devuelve un
// objeto YA reducido a conteos/numeros/estados de una lista fija).
// `server/tests/fase129-scripts-produccion-sin-texto-crudo.test.js` falla
// en CI si un script nuevo de scripts/produccion/ vuelve a tener la forma
// del bug original (un page.evaluate que reenvia el resultado crudo de
// apiRequest sin pasar por una seleccion explicita de campos).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA === (ventana de Chromium abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  let browser;
  const reporte = {};
  let ok = true;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    // ── Opciones -- la seleccion de campos pasa DENTRO de page.evaluate,
    // `o.entidades` (la lista real) nunca sale del navegador. ──────────
    reporte.opciones = await page.evaluate(async () => {
      const o = await apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT');
      return {
        meses: o.meses,
        sedes: o.sedes,
        especialidadesCount: o.especialidades.length,
        entidadesCount: o.entidades.length,
        mesesFormatoViejo: o.mesesFormatoViejo,
      };
    });
    log('Meses en producción:', JSON.stringify(reporte.opciones.meses));
    log('Sedes en producción:', JSON.stringify(reporte.opciones.sedes));
    log('Especialidades (conteo):', reporte.opciones.especialidadesCount);
    log('Entidades (conteo, nunca la lista):', reporte.opciones.entidadesCount);
    log('Meses en formato viejo (sede/entidad=SIN DATO):', JSON.stringify(reporte.opciones.mesesFormatoViejo));

    // ── Resumen de AGOSTO 2026 (sin filtros) -- ya son solo numeros ──
    reporte.resumenAgo = await page.evaluate(() =>
      apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08')
    );
    log('Resumen Ago-26 (sin filtros):', JSON.stringify(reporte.resumenAgo));

    // ── Por especialidad de AGOSTO 2026 -- "especialidad" es una
    // categoria medica de una lista fija (AUDIFONOS, FONOAUDIOLOGIA...),
    // nunca un nombre de persona/entidad -- seguro de imprimir completo. ──
    reporte.especialidadAgo = await page.evaluate(() =>
      apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-08')
    );
    log('Especialidades distintas en Ago-26 (producción):', reporte.especialidadAgo.length);
    const sumaEspecialidades = reporte.especialidadAgo.reduce((a, r) => ({
      total: a.total + r.total, inasistencia: a.inasistencia + r.inasistencia,
      cancelada: a.cancelada + r.cancelada, pendiente: a.pendiente + r.pendiente, atendidas: a.atendidas + r.atendidas,
    }), { total: 0, inasistencia: 0, cancelada: 0, pendiente: 0, atendidas: 0 });
    log('Suma de todas las especialidades de Ago-26 (debe calzar con el resumen):', JSON.stringify(sumaEspecialidades));

    // ── Por sede de AGOSTO 2026 (un resumen por cada sede conocida) ──
    reporte.porSede = {};
    for (const sede of reporte.opciones.sedes) {
      const r = await page.evaluate(
        (s) => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08&sede=' + encodeURIComponent(s)),
        sede
      );
      reporte.porSede[sede] = { total: r.total, inasistencia: r.inasistencia };
    }
    log('Por sede, Ago-26 (producción):', JSON.stringify(reporte.porSede, null, 2));

    // ── Mensual (todos los meses, sin filtro de mes -- para ver
    // Septiembre y confirmar que esta fase no lo toca) -- solo mes/
    // especialidad/conteos, nunca entidad. ────────────────────────────
    reporte.mensual = await page.evaluate(() =>
      apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT')
    );
    const porMes = {};
    reporte.mensual.forEach((f) => {
      if (!porMes[f.mes]) porMes[f.mes] = { total: 0, inasistencia: 0, pendiente: 0, especialidades: 0 };
      porMes[f.mes].total += f.total; porMes[f.mes].inasistencia += f.inasistencia; porMes[f.mes].pendiente += f.pendiente;
      porMes[f.mes].especialidades += 1;
    });
    log('Resumen mensual agregado en producción (todas las especialidades por mes):', JSON.stringify(porMes, null, 2));

    reporte.ok = true;
    console.log('\n=== REPORTE COMPLETO (JSON) ===');
    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
