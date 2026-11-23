// scripts/gestion-humana/generar-talento-humano.js — Fase GH1 (pedido de Edwin, reunión 23/11/2026).
// Genera «Talento humano» (la app de Gestión humana de la «Plataforma InConexion» de Edwin) para
// abrirla DENTRO de SinCo, con su visual tal cual:
//   public/gestion-humana/talento-humano.html   (marcado de Edwin)
//   public/gestion-humana/talento-humano.css    (su hoja)
//   public/gestion-humana/talento-humano-app.js (su lógica)
// desde el HTML original, que vive FUERA del repo o en docs/gestion-humana/ (ignorado por git):
// su otra mitad, el Inventario, trae datos reales (plantilla SEED_RAW). De ese HTML solo se toma la
// app de Gestión humana (`app-gh`), que no trae personas reales; el Inventario NUNCA se lee aquí.
//
//   node scripts/gestion-humana/generar-talento-humano.js <ruta del HTML de Edwin> <raíz del repo>
//
// Cambios (y nada más; las fórmulas y pantallas de Edwin no se tocan):
//   - sin su «inicio» ni el aviso de «vista previa» (SinCo pone el menú y la barra);
//   - sin SheetJS embebido: usa el de SinCo (js/vendor/xlsx-0.20.3.full.min.js);
//   - SIN datos de prueba: los generadores (empleados, vacaciones y novedades, ausentismo e
//     indicadores de impacto «ficticios») quedan vacíos y salen los botones «Cargar datos de prueba»;
//   - «⌂ Menú principal» cierra la ventana y vuelve al menú de SinCo.
//   - GH2: todo localStorage pasa a GH_STORE (public/gestion-humana/talento-humano-api.js, a mano), que
//     guarda en el servidor (/api/gh/estado); las marcas internas de la app siguen en el navegador.
//   - GH3: los soportes adjuntos (su IndexedDB `IDB`) pasan por ghArchivos (mismo archivo a mano): a S3
//     privado por /api/gh/archivos cuando está encendido; si no, siguen en el navegador como antes.
// Corre en un iframe del mismo origen (sus 135 onclick en línea llaman funciones globales: en un
// Shadow DOM habría que reescribirlos). Falla si un reemplazo no encuentra su texto exacto (el HTML
// cambió): revisar el reemplazo antes de forzarlo. No imprime datos, solo tamaños.
// Prueba guardiana: server/tests/faseGH1-talento-humano.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const [, , origen, repo] = process.argv;
if (!origen || !repo) { console.error('uso: node generar-talento-humano.js <HTML de Edwin> <raíz del repo>'); process.exit(1); }
const html = fs.readFileSync(origen, 'utf8');

function una(s, a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`"${a.slice(0, 60)}" aparece ${n} veces`);
  return s.replace(a, () => b);
}
// Reemplaza desde `ini` (incluido) hasta `fin` (excluido); los dos deben aparecer una sola vez.
function tramo(s, ini, fin, nuevo) {
  const a = s.indexOf(ini), b = s.indexOf(fin);
  if (a < 0 || s.indexOf(ini, a + 1) >= 0) throw new Error(`inicio "${ini.slice(0, 60)}" no aparece una sola vez`);
  if (b < 0 || s.indexOf(fin, b + 1) >= 0) throw new Error(`fin "${fin.slice(0, 60)}" no aparece una sola vez`);
  if (b <= a) throw new Error(`fin antes del inicio: "${ini.slice(0, 40)}"`);
  return s.slice(0, a) + nuevo + s.slice(b);
}
function entre(s, a, b) {
  const i = s.indexOf(a); if (i < 0) throw new Error(`no encontré "${a.slice(0, 50)}"`);
  const j = s.indexOf(b, i + a.length); if (j < 0) throw new Error(`no encontré "${b.slice(0, 50)}"`);
  return s.slice(i + a.length, j);
}

// ── Solo la app de Gestión humana (`app-gh`); el inventario (`app-inv`, con datos reales) no se lee ──
const marca = '<script type="application/json" id="app-gh">';
const iApp = html.indexOf(marca);
if (iApp < 0) throw new Error('no encontré la app de Gestión humana (app-gh)');
const gh = JSON.parse(html.slice(iApp + marca.length, html.indexOf('</script>', iApp)));

// ── CSS ──
const css = entre(gh, '</script>\n<style>\n', '\n</style>\n</head>');
if (!css.startsWith(':root{\n  color-scheme:dark;')) throw new Error('la hoja no empieza como se esperaba');

// ── Marcado ──
let markup = entre(gh, '</style>\n</head>\n<body>\n', '\n\n<script>\n/* ===================== CATÁLOGOS');
if (!markup.includes('<button class="home-btn" onclick="volverMenu()"')) throw new Error('no encontré «⌂ Menú principal»');
// Fase GH2: los datos ya no quedan en el navegador (los soportes adjuntos sí, hasta GH3).
markup = una(markup, 'Los datos se guardan en este navegador. Descarga una copia de respaldo con frecuencia.',
  'Los datos se guardan en la plataforma (SinCo). Descarga una copia de respaldo con frecuencia.');

// ── Lógica ──
let js = entre(gh, '</defs></svg>\n\n<script>', '</script>\n<script>window.volverMenu=');
// 1) Datos de prueba fuera (Edwin, 23/11: «SIN los datos de prueba»). Las funciones quedan vacías
//    (el arranque las sigue llamando: con la base vacía no siembra nada).
js = tramo(js, '/* ===================== DATOS DE EJEMPLO (ficticios) ===================== */', '\nconst isDemo=',
  '/* SinCo (GH1): sin empleados de ejemplo. */\nfunction demoData(){return []}');
js = tramo(js, '/* ===================== DATOS DE PRUEBA (vacaciones y novedades) ===================== */', '/* ===================== HISTORIAL DEL EMPLEADO',
  '/* SinCo (GH1): sin vacaciones ni novedades de prueba. */\nfunction demoVN(){return {V:[],N:[]}}\n\n');
js = tramo(js, '/* --- datos de prueba --- */\nfunction ausDemo(){', '/* --- registro / edición --- */',
  '/* SinCo (GH1): sin eventos de ausentismo de prueba. */\nfunction ausDemo(){return []}\nfunction ausCargarDemo(){}\nfunction ausQuitarDemo(){}\n');
js = tramo(js, 'function impDemo(){', '\n/* ===================== EMPLEADOS =====================',
  '/* SinCo (GH1): sin indicadores de impacto de prueba. */\nfunction impDemo(){}\n');
// 2) Sin botones para cargar datos de prueba.
js = una(js, '<button class="btn big" style="box-shadow:none" onclick="ausCargarDemo()">🧪 Cargar datos de prueba</button>', '');
js = una(js, '${AUS.some(r=>r.demo&&!r.anulado)?`<button class="btn dan" onclick="ausQuitarDemo()">Quitar datos de prueba</button>`:`<button class="btn" onclick="ausCargarDemo()">🧪 Cargar datos de prueba</button>`}', '');
// 3) Fase GH2: guarda en el servidor. Todo `localStorage.` pasa a GH_STORE (talento-humano-api.js, a
//    mano): las secciones de datos van a /api/gh/estado; las marcas internas siguen en el navegador.
{
  const n = js.split('localStorage.').length - 1;
  if (n !== 22) throw new Error(`localStorage aparece ${n} veces (se esperaban 22): revisar el HTML`);
  js = js.split('localStorage.').join('GH_STORE.');
  if (/localStorage/.test(js)) throw new Error('quedó un localStorage sin pasar a GH_STORE');
}
// 4) Fase GH3: soportes adjuntos. Su objeto IDB (IndexedDB del navegador) queda como IDB_LOCAL y IDB
//    pasa a ser ghArchivos(IDB_LOCAL) (talento-humano-api.js): con S3 encendido, sube y trae del
//    servidor; apagado, sigue en el navegador. Las llamadas IDB.put/get/del de la app no cambian.
js = una(js, 'const IDB={db:null,', 'const IDB_LOCAL={db:null,');
js = una(js, '\nconst MAXF=8*1024*1024;', '\nconst IDB=ghArchivos(IDB_LOCAL);\nconst MAXF=8*1024*1024;');
{
  const a = "toast('No se encontró el archivo en este equipo')";
  if (js.split(a).length - 1 !== 2) throw new Error('texto de archivo no encontrado: revisar el HTML');
  js = js.split(a).join("toast('No se encontró el soporte')");
}
for (const k of ['demoData()', 'ausDemo()', 'demoVN()']) {
  const def = js.indexOf('function ' + k.replace('()', '(){return'));
  if (def < 0) throw new Error('quedó sin vaciar ' + k);
}
if (/onclick="ausCargarDemo\(\)"|let seed=7|correo-ejemplo\.com'|DATOS DE EJEMPLO/.test(js)) throw new Error('quedaron datos o botones de prueba');

// ── Página (dentro de SinCo, en un iframe del mismo origen) ──
const pagina = `<!DOCTYPE html>
<html lang="es">
<head>
<!-- GENERADO por scripts/gestion-humana/generar-talento-humano.js desde el HTML de Edwin. No editar a mano. -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talento humano · InConexion</title>
<link rel="stylesheet" href="talento-humano.css">
</head>
<body>
${markup}

<script src="../js/vendor/xlsx-0.20.3.full.min.js"></script>
<!-- Fase GH2: lee los datos del servidor y después carga talento-humano-app.js -->
<script src="talento-humano-api.js"></script>
</body>
</html>
`;
const app = `// talento-humano-app.js — GENERADO por scripts/gestion-humana/generar-talento-humano.js (Fase GH1)
// desde la app de Gestión humana de Edwin, sin cambiar sus fórmulas: sin datos de prueba, con el
// SheetJS de SinCo y «⌂ Menú principal» que vuelve al menú de SinCo. No editar a mano.
/* eslint-disable */
// «⌂ Menú principal»: cierra la ventana de SinCo que contiene esta página.
window.volverMenu = function () {
  try { if (window.parent && window.parent !== window && typeof window.parent.talentoHumanoCerrar === 'function') window.parent.talentoHumanoCerrar(); } catch (e) { /* otro origen: nada */ }
};
${js.trim()}
`;
const dir = path.join(repo, 'public', 'gestion-humana');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'talento-humano.html'), pagina);
fs.writeFileSync(path.join(dir, 'talento-humano.css'), css.trim() + '\n');
fs.writeFileSync(path.join(dir, 'talento-humano-app.js'), app);
console.log('css', css.length, 'marcado', markup.length, 'js', app.length);
