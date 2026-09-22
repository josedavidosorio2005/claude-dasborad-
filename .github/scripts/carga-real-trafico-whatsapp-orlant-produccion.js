// carga-real-trafico-whatsapp-orlant-produccion.js — invocado por
// .github/workflows/carga-real-trafico-whatsapp-orlant-produccion.yml.
//
// Fase 56: carga REAL (no de prueba) de Trafico de WhatsApp para ORLANT en
// produccion -- las 5 colas reales de agosto 2026 (FONOAUDIOLOGIA/ORLANT 3P/
// ORLANT GENERAL/FONIATRIA/AUDIFONOS), ya verificadas de punta a punta en
// las Fases 50-55 contra un entorno de verificacion. Este script hace lo
// mismo que un administrador real haria a mano por el modal "Cargar Datos
// de Dashboards": login -> openCargas() -> cliente ORLANT -> elegir archivo
// -> "Guardar carga" -- nunca un atajo directo a la base de datos.
//
// Paso 1 (antes de subir nada): lee el estado actual de trafico_whatsapp
// para ORLANT via GET /calidad/trafico/whatsapp?campana=ORLANT y lo compara
// contra los valores reales de referencia (los 5 x 12 ya verificados en las
// Fases 51/55). Si YA coincide exacto, no sube nada (el upsert lo permitiria
// de todas formas, pero evita una escritura innecesaria quien no la
// necesita). Si no coincide o esta vacio, sigue al Paso 2.
//
// Paso 2: sube server/tests/fixtures/PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx
// (misma hoja DATA, mismos 5 colas/valores que PLANTILLA_TRAFICO_WHATSAPP_
// ORLANT.xlsx -- copia con la hoja INSTRUCCIONES corregida de la Fase 50,
// ya verificada byte-identica en su hoja DATA en las Fases 51/53/55) por el
// modal real, y confirma el mensaje de exito.
//
// Paso 3: relee via GET, compara otra vez contra la referencia (ahora debe
// coincidir exacto), navega a la pestana "Trafico de WhatsApp" y a la
// franja global de KPIs, y captura evidencia.
//
// SOLO toca trafico_whatsapp para ORLANT. Nunca borra nada. El usuario
// temporal (rol ADMIN, para que openGenericDashboard funcione sin depender
// del scoping por cliente) se crea y se borra directo en la base de datos
// desde el workflow (nunca via la API) -- mismo criterio que
// verificar-graficas-orlant-produccion.js / qa-datos-prueba-trafico-salida-orlant.js.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || os.tmpdir();
const ARCHIVO_REAL = path.join(__dirname, '..', '..', 'server', 'tests', 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx');

// Valores reales de referencia (Fases 51/55, verificados por el usuario
// contra la plantilla real byte a byte). ABANDONO no se guarda (se
// recalcula desde abandonados/total, Fase 50) -- no se compara aqui como
// columna propia, pero abandonados si.
const REFERENCIA = [
  { colaWhatsapp: 'WHATSAPP FONOAUDIOLOGIA', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 192, contestados: 187, abandonados: 5, serviceLevel10secPct: 46.88, serviceLevel20secPct: 48.96, serviceLevel30secPct: 49.48, asaSegundos: 4245.5, ataSegundos: 82800 },
  { colaWhatsapp: 'WHATSAPP ORLANT 3P', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 4844, contestados: 4697, abandonados: 147, serviceLevel10secPct: 31.73, serviceLevel20secPct: 32.18, serviceLevel30secPct: 32.54, asaSegundos: 9230.35, ataSegundos: 79125.8 },
  { colaWhatsapp: 'WHATSAPP ORLANT GENERAL', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 1504, contestados: 1467, abandonados: 37, serviceLevel10secPct: 24.4, serviceLevel20secPct: 25.07, serviceLevel30secPct: 25.6, asaSegundos: 11762.29, ataSegundos: 79988.08 },
  { colaWhatsapp: 'WHATSAPP FONIATRIA', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 31, contestados: 29, abandonados: 2, serviceLevel10secPct: 41.94, serviceLevel20secPct: 41.94, serviceLevel30secPct: 41.94, asaSegundos: 4771.76, ataSegundos: 82800 },
  { colaWhatsapp: 'WHATSAPP AUDIFONOS', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 734, contestados: 729, abandonados: 5, serviceLevel10secPct: 66.21, serviceLevel20secPct: 66.76, serviceLevel30secPct: 67.17, asaSegundos: 3392.3, ataSegundos: 82800 },
];
const CAMPOS_COMPARAR = ['fechaInicio', 'fechaFin', 'totalWhatsapp', 'contestados', 'abandonados', 'serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'asaSegundos', 'ataSegundos'];

function compararContraReferencia(filasReales) {
  const porCola = {};
  (filasReales || []).forEach((f) => { porCola[f.colaWhatsapp] = f; });
  const diffs = [];
  REFERENCIA.forEach((esperada) => {
    const real = porCola[esperada.colaWhatsapp];
    if (!real) { diffs.push({ cola: esperada.colaWhatsapp, campo: '(fila completa)', esperado: 'presente', real: 'AUSENTE' }); return; }
    CAMPOS_COMPARAR.forEach((campo) => {
      if (real[campo] !== esperada[campo]) {
        diffs.push({ cola: esperada.colaWhatsapp, campo, esperado: esperada[campo], real: real[campo] });
      }
    });
  });
  if ((filasReales || []).length !== REFERENCIA.length) {
    diffs.push({ cola: '(general)', campo: 'cantidad de filas', esperado: REFERENCIA.length, real: (filasReales || []).length });
  }
  return diffs;
}

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

async function shot(page, nombre) {
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, nombre), fullPage: true });
}

async function leerTraficoWppReal(page) {
  return page.evaluate(() => apiRequest('GET', '/calidad/trafico/whatsapp?campana=' + encodeURIComponent('ORLANT')));
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = { campana: 'ORLANT' };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.loginOk = true;

    // ══ PASO 1: estado actual ANTES de subir nada ══
    const antes = await leerTraficoWppReal(page);
    resultado.filasAntes = antes;
    const diffsAntes = compararContraReferencia(antes);
    resultado.diferenciasAntes = diffsAntes;
    resultado.yaCoincideExacto = diffsAntes.length === 0;
    console.log('PASO 1 -- estado en produccion ANTES de subir: ' + (antes || []).length + ' fila(s). Coincide exacto con la referencia: ' + resultado.yaCoincideExacto);
    if (!resultado.yaCoincideExacto) {
      console.log('Diferencias encontradas ANTES de subir:', JSON.stringify(diffsAntes, null, 2));
    }

    if (resultado.yaCoincideExacto) {
      console.log('Los datos reales ya estan cargados y coinciden exacto con la referencia -- no se sube nada (Paso 2 omitido).');
      resultado.subioArchivo = false;
    } else {
      // ══ PASO 2: subir el archivo real por el modal real ══
      resultado.subioArchivo = true;
      await page.evaluate(() => openCargas());
      await page.waitForTimeout(800);
      await page.selectOption('#carga-cliente', 'ORLANT');
      await page.waitForTimeout(500);
      await shot(page, '1-modal-cargar-datos-orlant.png');

      await page.setInputFiles('#carga-file', ARCHIVO_REAL);
      await page.waitForTimeout(1000);
      resultado.previewVisible = await page.evaluate(() => document.getElementById('carga-preview-card').style.display !== 'none');
      await shot(page, '2-vista-previa.png');

      const filaTrafico = await page.evaluate(() => {
        var rows = Array.from(document.querySelectorAll('#carga-preview-table tr'));
        var fila = rows.find(function (tr) { return tr.textContent.indexOf('Trafico') !== -1 && tr.textContent.indexOf('WhatsApp') !== -1; });
        return fila ? Array.from(fila.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); }) : null;
      });
      resultado.filaTraficoEnPreview = filaTrafico;
      if (!filaTrafico || filaTrafico.join(' ').indexOf('OK') === -1) {
        throw new Error('La hoja de Trafico de WhatsApp no aparecio como OK en la vista previa: ' + JSON.stringify(filaTrafico));
      }

      await page.click('#carga-preview-card button.btn-primary');
      await page.waitForTimeout(1800);
      resultado.toastGuardado = await page.evaluate(() => { var t = document.getElementById('toast'); return t ? t.textContent : null; });
      await shot(page, '3-mensaje-exito.png');
      console.log('PASO 2 -- toast tras guardar: ' + JSON.stringify(resultado.toastGuardado));
      if (!resultado.toastGuardado || !/guardad/i.test(resultado.toastGuardado)) {
        throw new Error('El mensaje tras guardar no confirma exito: ' + JSON.stringify(resultado.toastGuardado));
      }
      await page.evaluate(() => closeCargas());
      await page.waitForTimeout(400);
    }

    // ══ PASO 3: verificar en pantalla, y releer para confirmar ══
    const despues = await leerTraficoWppReal(page);
    resultado.filasDespues = despues;
    const diffsDespues = compararContraReferencia(despues);
    resultado.diferenciasDespues = diffsDespues;
    resultado.coincideExactoAlFinal = diffsDespues.length === 0;
    console.log('PASO 3 -- estado en produccion DESPUES: ' + (despues || []).length + ' fila(s). Coincide exacto con la referencia: ' + resultado.coincideExactoAlFinal);
    if (!resultado.coincideExactoAlFinal) {
      console.log('Diferencias encontradas DESPUES:', JSON.stringify(diffsDespues, null, 2));
    }

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    resultado.kpisGlobales = await page.evaluate(() => Array.from(document.querySelectorAll('#gd-kpis .aurora-kpi')).map(function (el) {
      return { valor: (el.querySelector('.kv') || {}).textContent, etiqueta: (el.querySelector('.kl') || {}).textContent };
    }));
    resultado.kpisGlobalesCantidad = resultado.kpisGlobales.length;
    resultado.sinTarjetasWhatsappEnFranjaGlobal = !resultado.kpisGlobales.some(function (k) {
      return ['WhatsApp 3P', 'Nivel Atencion WPP 3P', 'WhatsApp Linea General', 'WhatsApp Salida (Gral+3P)'].indexOf(k.etiqueta) !== -1;
    });
    await shot(page, '4-franja-global-orlant.png');

    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);
    resultado.kpisPeriodo = await page.evaluate(() => Array.from(document.querySelectorAll('#tww-kpis-0 .aurora-kpi')).map(function (el) {
      return { valor: (el.querySelector('.kv') || {}).textContent, etiqueta: (el.querySelector('.kl') || {}).textContent };
    }));
    await shot(page, '5-tab-trafico-whatsapp-volumen.png');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(900);
    await shot(page, '6-tab-trafico-whatsapp-sl.png');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(900);
    await shot(page, '7-tab-trafico-whatsapp-asaata.png');

    await page.evaluate(() => closeGenericDashboard());

    ok = resultado.loginOk && resultado.coincideExactoAlFinal && resultado.kpisGlobalesCantidad === 9 && resultado.sinTarjetasWhatsappEnFranjaGlobal;
    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la carga/verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
