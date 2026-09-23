// verificar-fase67-produccion-carga-real.js — QA de un solo uso, Fase 67,
// invocado por .github/workflows/fase67-prueba-real-produccion.yml.
//
// Unica escritura permitida en produccion para esta fase (regla explicita
// del pedido): subir el archivo REAL de agosto 2026 de ORLANT (Llamadas +
// WhatsApp) por la interfaz real -- y SOLO si, comparado antes fila por
// fila y columna por columna contra lo que YA tiene produccion, resulta
// IDENTICO (o sea, la carga reescribe exactamente los mismos valores que
// ya estaban). Si hay cualquier diferencia, este script ABORTA antes de
// subir nada y reporta exactamente cual.
//
// La comparacion usa las MISMAS funciones puras de parseo que usa la app
// (traficoParseFilas / traficoWppParseFilas, doble modo -- nunca reimplementa
// el parseo a mano) contra el fixture real
// (server/tests/fixtures/PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx),
// y las compara contra lo que devuelven los endpoints de lectura reales
// (GET /calidad/nivel-servicio/diario y GET /calidad/trafico/whatsapp) con
// el usuario temporal.
//
// El usuario temporal (creado/borrado por el workflow, directo en la base
// de datos, rol AUX_ADMIN + perms.cargarDatos + perms.campana_ORLANT --
// nunca ADMIN) es lo UNICO que este script borra al terminar. Nunca borra
// ni modifica ninguna fila de Trafico/Gestion de base/Monitoreos -- esa
// data es la REAL de produccion y debe quedar exactamente como quedo tras
// la carga (identica a como estaba, por diseño de este mismo script).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const TEMP_USER = process.env.TEMP_USER;
const TEMP_PW = process.env.TEMP_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || require('os').tmpdir();

const REPO_ROOT = path.join(__dirname, '..', '..');
const { leerHojaXlsxComoAoA } = require(path.join(REPO_ROOT, 'server', 'tests', 'helpers', 'xlsx-lite.js'));
const { traficoParseFilas } = require(path.join(REPO_ROOT, 'public', 'js', 'trafico-logic.js'));
const { traficoWppParseFilas } = require(path.join(REPO_ROOT, 'public', 'js', 'trafico-whatsapp-logic.js'));

const FIXTURE_PATH = path.join(REPO_ROOT, 'server', 'tests', 'fixtures', 'PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx');

const CAMPOS_VOZ = [
  'totalLlamadas', 'contestadas', 'llamadasAbandonadas',
  'serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct',
  'asaSegundos', 'ataSegundos', 'waitTimeSegundos', 'ahtSegundos',
  'nivelAtencionPct', 'tasaAbandonoPct',
];
const CAMPOS_WPP = [
  'totalWhatsapp', 'contestados', 'abandonados',
  'serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct',
  'asaSegundos', 'ataSegundos',
];

function normVal(v) {
  // undefined (campo nunca vino) y null (vino vacio) se tratan igual para
  // esta comparacion -- lo que importa es "hay un dato distinto", no la
  // forma exacta de "no hay dato".
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Math.round(v * 1000) / 1000; // tolerancia de redondeo
  return v;
}

function compararFilas(esperadas, reales, claveFn, campos, etiqueta) {
  const diffs = [];
  const realesPorClave = {};
  reales.forEach((r) => { realesPorClave[claveFn(r)] = r; });
  const esperadasPorClave = {};
  esperadas.forEach((e) => { esperadasPorClave[claveFn(e)] = e; });

  esperadas.forEach((esp) => {
    const clave = claveFn(esp);
    const real = realesPorClave[clave];
    if (!real) { diffs.push(etiqueta + ' ' + clave + ': NO existe en produccion (se esperaba que ya existiera).'); return; }
    campos.forEach((c) => {
      const a = normVal(esp[c]);
      const b = normVal(real[c]);
      if (a !== b) diffs.push(etiqueta + ' ' + clave + '.' + c + ': fixture=' + JSON.stringify(a) + ' produccion=' + JSON.stringify(b));
    });
  });
  reales.forEach((real) => {
    const clave = claveFn(real);
    if (!esperadasPorClave[clave]) diffs.push(etiqueta + ' ' + clave + ': existe en produccion pero NO esta en el fixture de agosto (dato extra inesperado).');
  });
  return diffs;
}

(async () => {
  if (!TEMP_USER || !TEMP_PW) { console.error('Faltan TEMP_USER/TEMP_PW.'); process.exit(1); }
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const resultado = { comparacionPrevia: {}, subida: {}, comparacionPosterior: {} };
  let ok = true;
  const erroresConsola = [];
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', TEMP_USER);
    await page.fill('#password', TEMP_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    // ══ 0. Confirma que produccion ya sirve el fix de cache-busting ═════
    const htmlRaiz = await page.content();
    resultado.cacheBustingActivo = /(src|href)="(?:js|css)\/[^"]*\?v=\d+"/.test(htmlRaiz);

    // ══ 1. Fixture parseado con las MISMAS funciones puras de la app ═══
    const llamadasAoa = leerHojaXlsxComoAoA(FIXTURE_PATH, 'LLAMADAS');
    const whatsappAoa = leerHojaXlsxComoAoA(FIXTURE_PATH, 'WHATSAPP');
    const parLlamadas = traficoParseFilas(llamadasAoa);
    const parWhatsapp = traficoWppParseFilas(whatsappAoa);
    if (parLlamadas.error) throw new Error('Fixture LLAMADAS no parsea: ' + parLlamadas.error);
    if (parWhatsapp.error) throw new Error('Fixture WHATSAPP no parsea: ' + parWhatsapp.error);
    resultado.fixture = { filasLlamadas: parLlamadas.filas.length, filasWhatsapp: parWhatsapp.filas.length };

    // ══ 2. Lo que YA tiene produccion, via los endpoints de lectura reales ══
    const vozAntes = await page.evaluate(() => apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT'));
    const wppAntes = await page.evaluate(() => apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT'));
    const vozAntesFiltrado = vozAntes.filter((r) => r.fecha && r.fecha.startsWith('2026-08'));
    resultado.produccionAntes = { filasVoz: vozAntesFiltrado.length, filasWpp: wppAntes.length };

    // ══ 3. Comparacion fila por fila / columna por columna ═════════════
    const diffsVoz = compararFilas(
      parLlamadas.filas, vozAntesFiltrado,
      (r) => r.skillName + '|' + r.fecha,
      CAMPOS_VOZ, 'LLAMADAS'
    );
    const diffsWpp = compararFilas(
      parWhatsapp.filas, wppAntes,
      (r) => r.colaWhatsapp + '|' + r.fechaInicio + '|' + r.fechaFin,
      CAMPOS_WPP, 'WHATSAPP'
    );
    resultado.comparacionPrevia.diffsVoz = diffsVoz;
    resultado.comparacionPrevia.diffsWpp = diffsWpp;
    resultado.comparacionPrevia.identico = diffsVoz.length === 0 && diffsWpp.length === 0;

    if (!resultado.comparacionPrevia.identico) {
      console.log(JSON.stringify(resultado, null, 2));
      console.error('ABORTA: produccion NO es identica al fixture de agosto 2026 -- no se sube nada. Ver comparacionPrevia.diffsVoz/diffsWpp arriba.');
      process.exit(1);
    }

    // Snapshot de "otros datos" de ORLANT ANTES de subir, via los
    // endpoints de lectura reales (nunca SSH), para confirmar despues que
    // nada mas cambio.
    const cargasAntes = await page.evaluate(() => apiRequest('GET', '/dashboard/cargas?cliente=ORLANT'));
    const monitoreosAntesConteo = (await page.evaluate(() => apiRequest('GET', '/monitoreos?campana=ORLANT'))).length;

    // ══ 4. SUBIDA REAL por la interfaz (Paso 3.4) ══════════════════════
    // Descarga la plantilla real (misma que un usuario descargaria) y
    // reemplaza SOLO LLAMADAS/WHATSAPP con el fixture, dentro del
    // navegador con el XLSX que ya carga la app -- igual que la
    // verificacion local, nunca se instala el paquete npm `xlsx`.
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(600);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#cargas-overlay button:has-text("Descargar plantilla (Excel)")'),
    ]);
    const descargaPath = path.join(ARTIFACTS_DIR, 'descarga-orlant-produccion.xlsx');
    await download.saveAs(descargaPath);
    fs.copyFileSync(descargaPath, path.join(ARTIFACTS_DIR, 'descarga-orlant-produccion.xlsx'));

    let tieneLlamadas = false, tieneWhatsapp = false, tieneData = false;
    try { leerHojaXlsxComoAoA(descargaPath, 'LLAMADAS'); tieneLlamadas = true; } catch (e) {}
    try { leerHojaXlsxComoAoA(descargaPath, 'WHATSAPP'); tieneWhatsapp = true; } catch (e) {}
    try { leerHojaXlsxComoAoA(descargaPath, 'DATA'); tieneData = true; } catch (e) {}
    resultado.descarga = { tieneLlamadas, tieneWhatsapp, tieneData, ok: tieneLlamadas && tieneWhatsapp && !tieneData };
    if (!resultado.descarga.ok) throw new Error('La plantilla descargada de produccion no es la unificada: ' + JSON.stringify(resultado.descarga));

    const b64Descarga = fs.readFileSync(descargaPath).toString('base64');
    const b64Lleno = await page.evaluate(({ b64, llamadasAoa, whatsappAoa }) => {
      var wb = XLSX.read(b64, { type: 'base64' });
      wb.Sheets['LLAMADAS'] = XLSX.utils.aoa_to_sheet(llamadasAoa);
      wb.Sheets['WHATSAPP'] = XLSX.utils.aoa_to_sheet(whatsappAoa);
      return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    }, { b64: b64Descarga, llamadasAoa, whatsappAoa });
    const llenoPath = path.join(ARTIFACTS_DIR, 'llenado-agosto-produccion.xlsx');
    fs.writeFileSync(llenoPath, Buffer.from(b64Lleno, 'base64'));

    await page.setInputFiles('#carga-file', llenoPath);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '1-preview-produccion.png') });
    const preview = await page.evaluate(() => {
      var filas = Array.from(document.querySelectorAll('#carga-preview-table tr')).slice(1);
      return filas.map(function (tr) {
        var tds = tr.querySelectorAll('td');
        return { hoja: tds[0] ? tds[0].textContent.trim() : '', tipo: tds[1] ? tds[1].textContent.trim() : '', estado: tds[2] ? tds[2].textContent.trim() : '' };
      });
    });
    resultado.subida.preview = preview;
    const filaLlamadas = preview.find((p) => p.tipo === 'Trafico de Llamadas');
    const filaWhatsapp = preview.find((p) => p.tipo === 'Trafico de WhatsApp');
    resultado.subida.previewLlamadasOk = !!filaLlamadas && /OK/i.test(filaLlamadas.estado) && /50/.test(filaLlamadas.estado);
    resultado.subida.previewWhatsappOk = !!filaWhatsapp && /OK/i.test(filaWhatsapp.estado) && /5\b/.test(filaWhatsapp.estado);

    // El aviso de voz "se reemplazaran N registros" es ESPERADO (regla
    // explicita del pedido: aceptarlo) -- page.on('dialog') ya lo acepta
    // automaticamente arriba.
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(2000);
    resultado.subida.toast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '2-guardado-produccion.png') });

    // ══ 5. Verificacion POSTERIOR: identico al fixture, y nada mas cambio ══
    await page.evaluate(() => closeCargas());
    const vozDespues = (await page.evaluate(() => apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT')))
      .filter((r) => r.fecha && r.fecha.startsWith('2026-08'));
    const wppDespues = await page.evaluate(() => apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT'));
    const diffsVozDespues = compararFilas(parLlamadas.filas, vozDespues, (r) => r.skillName + '|' + r.fecha, CAMPOS_VOZ, 'LLAMADAS');
    const diffsWppDespues = compararFilas(parWhatsapp.filas, wppDespues, (r) => r.colaWhatsapp + '|' + r.fechaInicio + '|' + r.fechaFin, CAMPOS_WPP, 'WHATSAPP');
    resultado.comparacionPosterior = {
      filasVoz: vozDespues.length, filasWpp: wppDespues.length,
      diffsVoz: diffsVozDespues, diffsWpp: diffsWppDespues,
      identico: diffsVozDespues.length === 0 && diffsWppDespues.length === 0,
      sinDuplicados: vozDespues.length === vozAntesFiltrado.length && wppDespues.length === wppAntes.length,
    };

    const cargasDespues = await page.evaluate(() => apiRequest('GET', '/dashboard/cargas?cliente=ORLANT'));
    const monitoreosDespuesConteo = (await page.evaluate(() => apiRequest('GET', '/monitoreos?campana=ORLANT'))).length;
    resultado.otrosDatos = {
      cargasIdenticas: JSON.stringify(cargasAntes) === JSON.stringify(cargasDespues),
      monitoreosConteoIdentico: monitoreosAntesConteo === monitoreosDespuesConteo,
      monitoreosAntes: monitoreosAntesConteo,
      monitoreosDespues: monitoreosDespuesConteo,
    };

    // ══ 6. KPIs en el dashboard real ════════════════════════════════════
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1200);
    resultado.kpisLlamadas = await page.$eval('#gd-kpis', (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '3-dashboard-orlant-produccion.png') });

    resultado.erroresConsola = erroresConsola;
    ok =
      resultado.loginOk &&
      resultado.cacheBustingActivo &&
      resultado.comparacionPrevia.identico &&
      resultado.descarga.ok &&
      resultado.subida.previewLlamadasOk &&
      resultado.subida.previewWhatsappOk &&
      resultado.comparacionPosterior.identico &&
      resultado.comparacionPosterior.sinDuplicados &&
      resultado.otrosDatos.cargasIdenticas &&
      resultado.otrosDatos.monitoreosConteoIdentico &&
      erroresConsola.length === 0;
    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
