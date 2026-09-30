// generar-pdf-guia-uso.js — Fase 100 (Tema B, guía de uso). Convierte
// `public/guia-uso.html` (servida por la app en local, http://localhost:3000,
// con `npm run seed:demo` corriendo) a PDF con `page.pdf()` de Playwright.
// El PDF sale FUERA del repo, en
// `C:\Users\filid\Documents\trabajo inconexion\entregables\`.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\entregables';
const OUT_FILE = path.join(OUT_DIR, 'Guia_de_uso_ORLANT_v1.2.pdf');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(BASE + '/guia-uso.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.pdf({
      path: OUT_FILE,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    console.log('PDF generado:', OUT_FILE);
  } finally {
    await browser.close();
  }
})();
