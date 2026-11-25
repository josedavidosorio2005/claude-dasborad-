// scripts/orlant/generar-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, llamada del 24/11/2026).
// Genera public/js/orlant-equidad-app.js y public/css/orlant-equidad-app.css desde el HTML de una sola página que
// hizo Edwin (Equidad_Profesionales_InConexion.html), que NUNCA se edita a mano y NUNCA entra al repo: trae las
// bases reales pegadas adentro (SEED_*). Vive fuera del repo, como el HTML de Televentas de SURA.
//
//   node scripts/orlant/generar-equidad.js [ruta del HTML] [raiz del repo]
//   (por defecto: %USERPROFILE%\Downloads\Equidad_Profesionales_InConexion.html)
//
// Igual que STA y Televentas:
//  - nunca copia SheetJS (aquí no hace falta: la carga va por «Cargar bases», centro-equidad.js);
//  - corre dentro de un Shadow DOM (ROOT): ids y estilos no chocan con la plataforma;
//  - las bases salen de la API /api/orlant/equidad/estado (server/orlant-equidad.js), no de localStorage;
//  - las SEED_* (datos reales) se vacían y el script FALLA si queda cualquier rastro de ellas.
// Cambios respecto al HTML, y nada más: nombres de las 3 pestañas (Pólizas, Medicina prepagada, Particulares),
// filtro «Profesional» (pedido de Edwin), sin «Entidad» cuando la base no la trae (Particulares), sin las
// pantallas de inicio y de carga ni el renombrar pestañas (la carga es de la plataforma), etiquetas accesibles y
// ajustes para el celular. Falla si un reemplazo no encuentra su texto exacto (el HTML cambió): revisar antes.
// No imprime datos, solo tamaños. Prueba guardiana: server/tests/faseEQ2-equidad-profesionales.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const repo = process.argv[3] || path.join(__dirname, '..', '..');
const origen = process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Equidad_Profesionales_InConexion.html');
const html = fs.readFileSync(origen, 'utf8');

function una(s, a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`"${a.slice(0, 70)}" aparece ${n} veces`);
  return s.replace(a, () => b);
}
function todas(s, a, b, min = 1) {
  const n = s.split(a).length - 1;
  if (n < min) throw new Error(`"${a.slice(0, 70)}" aparece ${n} veces`);
  return s.split(a).join(b);
}

// ── CSS ──────────────────────────────────────────────────────────────
let css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>')).replace(/^\n/, '');
css = una(css, ':root{', ':host{display:block;');
css = una(css, 'body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);font-size:14px}',
  '.eq-app{font-family:inherit;background:var(--bg);color:var(--ink);font-size:14px;border-radius:12px;padding-bottom:8px;overflow:hidden}');
css = una(css, 'main{padding:14px 28px 40px;max-width:1600px;margin:0 auto}', '.main{padding:14px 28px 28px;max-width:1600px;margin:0 auto}');
css = una(css, '.sedes{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:22px}', '.sedes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr));gap:22px}');
if (/:root|(^|\n)body\{|(^|\n)html\{|(^|\n)main\{/.test(css)) throw new Error('quedó :root, body, html o main en el CSS');
css = css.replace(/font-weight:\s*(800|900)/g, 'font-weight:700'); // Quicksand trae 400–700 (Fase 132)
css = css.replace(/font-size:\s*(10|11)px/g, 'font-size:12px'); // texto de 12 px como mínimo (Fase 144, WCAG)
// Estilo de la plataforma (pedido de Edwin, 25/11/2026): los colores del HTML (tema oscuro fijo) pasan a los
// tokens de la plataforma, que entran al Shadow DOM porque las variables CSS se heredan: paleta.css (acento,
// botones, series) y los de estado de styles.css (verde / ámbar / rojo, solo para estados, como en el resto de
// la plataforma, docs/sistema-de-diseno.md). Así sigue el tema claro y el oscuro. Estructura, pestañas y
// cálculos no cambian. Falla si un color del HTML no está en la tabla o si queda alguno fijo.
{
  const a = css.indexOf(':host{display:block;');
  const b = css.indexOf('}', a);
  if (a !== 0 || b < 0) throw new Error('el bloque de variables del HTML cambió');
  css = `:host{display:block;
  --bg:var(--c-bg); --card:var(--c-surface); --card2:var(--c-surface-subtle); --line:var(--c-border); --track:var(--c-border-soft);
  --ink:var(--c-text); --muted:var(--c-text-muted); --title:var(--acento-texto);
  --green:var(--c-success); --sky:var(--serie-1); --amber:var(--c-warning); --red:var(--c-danger); --gray:var(--c-text-muted);
  --teal:var(--c-text);
}` + css.slice(b + 1);
  const T = (x, y) => { css = todas(css, x, y); };
  T('color:#fff', 'color:var(--c-text)');
  T('background:#12293A', 'background:var(--acento-suave)');
  T('background:var(--title);color:#06131C', 'background:var(--btn-primario-bg);color:var(--btn-primario-fg)');
  T('color:#C9D5DC', 'color:var(--c-text-2)');
  T('#182D3B', 'var(--c-border-soft)');
  T('background:#14293A', 'background:var(--c-hover-bg)');
  T('background:rgba(93,185,90,.15);color:#7ED17B', 'background:var(--c-success-bg);color:var(--c-success-text)');
  T('background:rgba(232,96,95,.15);color:#F08584', 'background:var(--c-danger-bg);color:var(--c-danger-text)');
  T('background:rgba(240,160,75,.15);color:#F5B672', 'background:var(--c-warning-bg);color:var(--c-warning-text)');
  T('background:rgba(240,160,75,.1);border:1px solid rgba(240,160,75,.4);color:#F5B672', 'background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-text)');
  T('rgba(77,179,240,.12)', 'var(--acento-suave)');
  T('#2C4A5E', 'var(--c-border)');
  T('rgba(77,179,240,.04)', 'var(--c-surface-subtle)');
  T('rgba(77,179,240,.1)', 'var(--acento-suave)');
  T('color-scheme:dark', 'color-scheme:inherit'); // el tema lo pone la plataforma (styles.css, en html)
  const quedan = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g);
  if (quedan) throw new Error('quedaron colores fijos en el CSS: ' + [...new Set(quedan)].join(' '));
}
css = `/* orlant-equidad-app.css — «Equidad profesionales» de ORLANT (HTML de Edwin) dentro de su Shadow DOM.
   Generado por scripts/orlant/generar-equidad.js desde el HTML de Edwin (fuera del repo): no editar a mano. */
${css.trim()}
/* Plataforma (pedido de Edwin, 25/11): tarjetas, pestañas, botones y tablas como las demás pestañas de ORLANT. */
.eq-app{background:transparent;border-radius:0}
.card,.toolbar,.kpi,.empty{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);box-shadow:var(--shadow-sm)}
.kpi{border-left:3px solid var(--acento)}
.kpi .v{color:var(--c-text)}
.card h3{color:var(--c-text);border-bottom-color:var(--acento)}
nav.tabs button{font:inherit;font-weight:600;background:var(--c-surface);border:1px solid var(--c-border);color:var(--c-text-2);border-radius:var(--r-pill)}
nav.tabs button.active{background:var(--acento-suave);border-color:var(--acento);color:var(--acento-texto)}
nav.tabs button:hover:not(.active){color:var(--c-text);border-color:var(--acento)}
.btn{background:var(--btn-secundario-bg);border:1px solid var(--btn-secundario-borde);color:var(--btn-secundario-fg);border-radius:var(--r-sm)}
.btn.ghost{background:var(--btn-suave-bg);border-color:var(--btn-suave-borde);color:var(--btn-suave-fg)}
.btn:hover{filter:none;border-color:var(--acento)}
select,input[type=date],input[type=number]{background:var(--c-surface);border-color:var(--c-border);color:var(--c-text)}
th{color:var(--c-text-2);background:var(--c-surface-subtle)}
/* Foco visible, pestañas que se desplazan de lado y ajustes para el celular (375 / 768 px). */
button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--c-focus);outline-offset:2px}
nav.tabs{overflow-x:auto;scrollbar-width:thin}
nav.tabs button{flex:0 0 auto;white-space:nowrap}
.sedes>div{min-width:0;overflow-x:auto}
#chart{overflow-x:auto}
#chart svg{min-width:620px}
.eq-cargando,.eq-error{padding:40px 16px;text-align:center;color:var(--muted)}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:768px){nav.tabs button,.btn,select,input[type=date]{min-height:44px}}
@media(max-width:560px){
  .kpis{grid-template-columns:minmax(0,1fr)}
  .main{padding:12px 10px 20px}
  nav.tabs{padding:12px 10px 0}
  .toolbar .field{flex:1 1 100%}
  .toolbar .btn{width:100%}
  select,input[type=date]{max-width:none;width:100%}
  .title-row{flex-wrap:wrap}
  .card{padding:14px}
  .empty{padding:28px 14px}
}
`;

// ── Marcado ────────────────────────────────────────────────────────────
let markup = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));
markup = una(markup, '<div id="topnav"></div>\n', '');
markup = una(markup, '<nav class="tabs" id="tabs"></nav>', '<nav class="tabs" id="tabs" aria-label="Bases de equidad"></nav>');
markup = una(markup, '<main id="main"></main>', '<div class="main" id="main"><div class="eq-cargando" role="status">Cargando…</div></div>');
markup = una(markup, '<div class="toast" id="toast"></div>', '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
markup = una(markup, '<input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display:none">', '');
markup = `<div class="eq-app">\n${markup.trim()}\n</div>`;

// ── Lógica ─────────────────────────────────────────────────────────────
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
const conXlsx = scripts.filter((m) => m[1].includes('SheetJS'));
const propios = scripts.filter((m) => !m[1].includes('SheetJS'));
if (conXlsx.length !== 1 || propios.length !== 1) throw new Error('se esperaban 2 scripts: SheetJS y el de Edwin');
let js = propios[0][1];
const L = (a, b) => { js = una(js, a, b); };

// 1) Datos reales: cada SEED_* queda vacía (la línea entera). Nunca se imprimen.
js = js.split('\n').map((l) => (/^const SEED_\w+ = \[/.test(l) ? l.replace(/^(const SEED_\w+ = )\[.*$/, '$1[];') : l)).join('\n');
// 2) Pestañas con los nombres del pedido y la base del servidor que les toca.
L(`{id:'poliza', name:'Póliza', seed: SEED_POLIZA, seedName:'EQUIDAD_POLIZA_SURA_OCTUBRE_2026'},`, `{id:'poliza', grupo:'polizas', name:'Pólizas', seed: SEED_POLIZA},`);
L(`{id:'base2',  name:'Medicinas prepagadas', seed: SEED_PREPAGADAS, seedName:'EQUIDAD_OTRAS_ENTIDADES_OCTUBRE_2026'},`, `{id:'base2', grupo:'prepagada', name:'Medicina prepagada', seed: SEED_PREPAGADAS},`);
L(`{id:'base3',  name:'Particulares', seed: SEED_PARTICULARES, seedName:'EQUIDAD_PARTICULARES_OCTUBRE_2026'},`, `{id:'base3', grupo:'particulares', name:'Particulares', seed: SEED_PARTICULARES},`);
L(`const state = {active:'poliza', view:'home', tabs:{}};`, `const state = {active:'poliza', view:'resultados', tabs:{}};`);
L(`state.tabs[t.id] = {name:t.name, rows:t.seed||[], source:t.seed?t.seedName:'', loadedAt:'',
    f:{sede:'',esp:'',ent:'',desde:'',hasta:'',min:0,tol:20}, sort:{k:'n',d:-1}};`,
`state.tabs[t.id] = {name:t.name, rows:[], source:'', loadedAt:'', conEntidad:true,
    f:{sede:'',esp:'',ent:'',prof:'',desde:'',hasta:'',min:0,tol:20}, sort:{k:'n',d:-1}};`);
// 3) Sin localStorage: los datos viven en el servidor.
L(`try{
  const saved = JSON.parse(localStorage.getItem(LS_KEY)||'null');
  if(saved && saved.tabs){ for(const id in saved.tabs){ if(state.tabs[id]) Object.assign(state.tabs[id], saved.tabs[id]); } }
}catch(e){}
function persist(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({tabs:state.tabs})); }catch(e){ toast('No se pudo guardar en el navegador (la base es muy grande); seguirá disponible mientras la página esté abierta.'); }
}`, `function persist(){} // los datos viven en el servidor (/api/orlant/equidad)`);
L(`const LS_KEY = 'inco_equidad_v3';\n`, '');
// 4) Dentro del Shadow DOM.
L(`const $ = s=>document.querySelector(s);`, `const $ = s=>ROOT.querySelector(s);`);
js = todas(js, 'document.querySelectorAll(', 'ROOT.querySelectorAll(');
// 5) Sin la carga del HTML (FileReader / SheetJS): la plataforma carga por «Cargar bases».
{
  const a = js.indexOf('// ================== CARGA DE ARCHIVOS ==================');
  const b = js.indexOf('// ================== CÁLCULOS ==================');
  if (a < 0 || b < a) throw new Error('no encontré la sección de carga');
  js = js.slice(0, a) + js.slice(b);
}
// 6) Sin exportar a Excel (no tenía botón) ni el render() del final (lo llama iniciar()).
{
  const a = js.indexOf('// ================== EXPORTAR ==================');
  if (a < 0) throw new Error('no encontré la sección de exportar');
  const resto = js.slice(a);
  if (!/\nrender\(\);\s*$/.test(resto)) throw new Error('el final del script cambió');
  js = js.slice(0, a);
}
// 7) Filtro «Profesional» (pedido de Edwin) y sin «Entidad» en la base que no la trae (Particulares).
L(`(!f.ent||r.ent===f.ent)`, `(!f.ent||r.ent===f.ent)&&(!f.prof||r.prof===f.prof)`);
L(`function render(){
  renderNav();
  $('#tabs').style.display=state.view==='resultados'?'flex':'none';
  if(state.view==='home') return renderHome();
  if(state.view==='cargar') return renderCargar();
  renderResultados();
}`, `function render(){
  $('#tabs').style.display='flex';
  renderResultados();
}`);
L(`<button class="\${state.active===t.id?'active':''}" data-t="\${t.id}">`, `<button type="button" class="\${state.active===t.id?'active':''}" aria-pressed="\${state.active===t.id}" data-t="\${t.id}">`);
L(`<input class="tabname" id="tabName" value="\${esc(T.name)}" title="Clic para renombrar la pestaña"><span class="hint">✎ clic en el nombre para renombrar la pestaña</span>`, `<h2 class="tabname">\${esc(T.name)}</h2>`);
L(`<button class="btn primary" id="goLoad">Ir a Cargar bases</button>`, `<p>Se carga en <b>Cargar bases</b> → ORLANT → «Equidad profesionales».</p>`);
L(`<div class="field"><label>Sede</label><select data-f="sede">`, `<div class="field"><label>Sede</label><select data-f="sede" aria-label="Sede">`);
L(`<div class="field"><label>Especialidad</label><select data-f="esp">\${opts(uniq(T.rows,'esp'),f.esp,'Todas')}</select></div>`,
  `<div class="field"><label>Especialidad</label><select data-f="esp" aria-label="Especialidad">\${opts(uniq(T.rows,'esp'),f.esp,'Todas')}</select></div>
    \${T.conEntidad?\`<div class="field"><label>Entidad</label><select data-f="ent" aria-label="Entidad">\${opts(ents,f.ent,'Todas las entidades')}</select></div>\`:''}
    <div class="field"><label>Profesional</label><select data-f="prof" aria-label="Profesional">\${opts(uniq(T.rows,'prof'),f.prof,'Todos los profesionales')}</select></div>`);
L(`    <div class="field"><label>Entidad</label><select data-f="ent">\${opts(ents,f.ent,'Todas las entidades')}</select></div>\n`, '');
L(`<input type="date" data-f="desde"`, `<input type="date" data-f="desde" aria-label="Desde"`);
L(`<input type="date" data-f="hasta"`, `<input type="date" data-f="hasta" aria-label="Hasta"`);
L(`<button class="btn ghost" id="btnClear">Limpiar filtros</button>`, `<button type="button" class="btn ghost" id="btnClear">Limpiar filtros</button>`);
L(`Object.assign(T.f,{sede:'',esp:'',ent:'',desde:'',hasta:''})`, `Object.assign(T.f,{sede:'',esp:'',ent:'',prof:'',desde:'',hasta:''})`);
L(`  const tn=$('#tabName'); tn.onchange=()=>{T.name=tn.value.trim()||T.name;persist();renderTabs();};\n`, '');
js = js.replace(/font-size:(10|11)px/g, 'font-size:12px').replace(/font-size="(10|11)"/g, 'font-size="12"'); // 12 px como mínimo (Fase 144)
// Estilo de la plataforma (25/11): colores de las gráficas y tablas con los tokens (ver el CSS más arriba).
{
  const T = (x, y) => { js = todas(js, x, y); };
  T('stroke="${c}"', 'style="stroke:${c}"');
  T('stroke="var(--track)"', 'style="stroke:var(--track)"');
  T('fill="#fff"', 'style="fill:var(--c-text)"');
  T('fill="#93A6B3"', 'style="fill:var(--c-text-muted)"');
  T('stroke="#1C3242"', 'style="stroke:var(--c-border-soft)"');
  T('fill="#7F93A0"', 'style="fill:var(--c-text-muted)"');
  T('fill="#5DB95A" opacity=".12"', 'style="fill:var(--c-success);opacity:.12"');
  T("fill=\"${p.inc?'#DCE5EA':'#5E707C'}\"", "style=\"fill:${p.inc?'var(--c-text)':'var(--c-text-muted)'}\"");
  T('fill="#1A2E3C"', 'style="fill:var(--track)"');
  T('fill="${COLOR[p.estado]}"', 'style="fill:${COLOR[p.estado]}"');
  T('stroke="#E8EEF2"', 'style="stroke:var(--c-text)"');
  T('color:#5E707C', 'color:var(--c-text-muted)');
  T('<b style="color:#fff">', '<b style="color:var(--c-text)">');
  T("'var(--green)':A.eq>=.65?'var(--amber)':'var(--red)'", "'var(--c-success-text)':A.eq>=.65?'var(--c-warning-text)':'var(--c-danger-text)'");
  // Mapa de calor: la serie 1 de la paleta, con opacidad hasta .5 (el texto sigue con el color de la plataforma y
  // pasa AA en claro y oscuro); la celda vacía, transparente.
  T("`rgba(60,158,224,${a.toFixed(2)})`:'#15283400'};color:#fff", "`color-mix(in srgb, var(--serie-1) ${Math.round(a*100)}%, transparent)`:'transparent'};color:var(--c-text)");
  T('const a=v?0.18+0.82*v/mx:0;', 'const a=v?0.12+0.38*v/mx:0;');
  // En el tema oscuro las celdas con más citas se ven más claras: «más intensas» vale para los dos temas.
  T('celdas más oscuras = más citas', 'celdas más intensas = más citas');
  // El mapa de calor se desplaza de lado: con el teclado también (axe, scrollable-region-focusable).
  T('<div class="heat">', '<div class="heat" tabindex="0" role="region" aria-label="Mapa de calor: citas por profesional y día (se desplaza con las flechas)">');
  const quedan = js.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z])|rgba?\(|hsla?\(/g);
  if (quedan) throw new Error('quedaron colores fijos en el JS: ' + [...new Set(quedan)].join(' '));
}
if (/SEED_\w+ = \[[^\]]/.test(js) || /"sede":/.test(js) || /localStorage|FileReader|XLSX\./.test(js)) throw new Error('quedaron datos, localStorage o la carga del HTML');

const app = `// orlant-equidad-app.js — «Equidad profesionales» de ORLANT (HTML de Edwin dentro de la plataforma).
// GENERADO por scripts/orlant/generar-equidad.js desde el HTML de Edwin (fuera del repo): no editar a mano.
// Cambios respecto al HTML, y nada más:
//   - sin los datos que traía pegados (SEED_* vacías) ni SheetJS: las bases salen de /api/orlant/equidad/estado;
//   - corre dentro de un Shadow DOM (ROOT); sin guardar en el navegador, sin las pantallas de inicio y de carga, sin
//     renombrar pestañas ni exportar (la carga va por «Cargar bases», centro-equidad.js);
//   - pestañas Pólizas / Medicina prepagada / Particulares, filtro «Profesional» y, en la base sin entidad
//     (Particulares), sin el filtro de entidad;
//   - etiquetas accesibles y ajustes para el celular (orlant-equidad-app.css).
/* eslint-disable */
var EQ_MARKUP = ${JSON.stringify(markup)};

function eqCrearApp(ROOT, API){
${js.trim()}

function aplicar(r){
  (r && r.grupos || []).forEach(g=>{
    const t=TABS.find(x=>x.grupo===g.id); if(!t) return;
    const T=state.tabs[t.id];
    T.rows=g.filas||[]; T.conEntidad=g.conEntidad!==false;
    T.source=g.archivo?(g.archivo+(g.hoja?' · hoja "'+g.hoja+'"':'')):'';
    T.loadedAt=g.cargadoEn?new Date(g.cargadoEn).toLocaleString('es-CO'):'';
  });
  if(!state.tabs[state.active].rows.length){ const c=TABS.find(t=>state.tabs[t.id].rows.length); if(c) state.active=c.id; }
}
async function iniciar(){
  try{ aplicar(await API.estado()); render(); }
  catch(e){ $('#main').innerHTML='<div class="eq-error" role="alert">No se pudo leer Equidad profesionales.</div>'; throw e; }
}
return { iniciar: iniciar, aplicar: aplicar, render: render, state: state };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { EQ_MARKUP: EQ_MARKUP, eqCrearApp: eqCrearApp };
`;
fs.writeFileSync(path.join(repo, 'public/js/orlant-equidad-app.js'), app);
fs.writeFileSync(path.join(repo, 'public/css/orlant-equidad-app.css'), css);
console.log('css', css.length, 'markup', markup.length, 'js', js.length);
