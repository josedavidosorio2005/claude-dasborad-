// scripts/sura/generar-televentas.js — Fase 215. Genera el tablero Televentas
// de SURA (public/js/sura-televentas-app.js y public/css/sura-televentas-app.css)
// desde el HTML de una sola pagina que hizo Edwin (seguimiento_ventas_offline.html),
// que vive FUERA del repo porque trae datos reales embebidos.
//
//   node scripts/sura/generar-televentas.js <ruta del HTML de Edwin> <raiz del repo>
//
// Nunca copia SheetJS (la plataforma ya trae js/vendor/xlsx-0.20.3) ni las
// constantes SEED* (datos reales); cambia IndexedDB por la API y corre la
// logica en un Shadow DOM. Falla si un reemplazo no encuentra su texto exacto
// (el HTML cambio): revisar el reemplazo antes de forzarlo. No imprime datos,
// solo tamanos. Prueba guardiana: server/tests/fase215-sura-televentas.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const [, , origen, repo] = process.argv;
const html = fs.readFileSync(origen, 'utf8');

function una(s, a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`"${a.slice(0, 60)}" aparece ${n} veces`);
  return s.replace(a, () => b);
}
function todas(s, a, b, min = 1) {
  const n = s.split(a).length - 1;
  if (n < min) throw new Error(`"${a.slice(0, 60)}" aparece ${n} veces`);
  return s.split(a).join(b);
}

// ── CSS ───────────────────────────────────────────────────────────────────
let css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>')).replace(/^\n/, '');
const lineas = css.split('\n');
// 1) tokens: la primera regla :root{...} (2 lineas) y las 2 de tema oscuro de tokens
const iTok = lineas.findIndex((l) => l.startsWith(':root{--bg:'));
if (iTok !== 0) throw new Error('no encontre los tokens');
lineas.splice(0, 4); // :root{..}, linea de box-sizing/padding, media dark tokens, :root[data-theme=dark] tokens
css = lineas.join('\n');
css = css.replace(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)[^\n]*\}\}\n/g, '');
css = todas(css, ':root[data-theme="dark"]', ':host([data-theme="dark"])');
if (/prefers-color-scheme|:root/.test(css)) throw new Error('quedo :root o prefers-color-scheme en el CSS');
css = una(css, 'html{scroll-padding-top:env(safe-area-inset-top,0px)}\n', '');
css = una(css, 'body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}\n', '');
css = una(css, 'h1{font-size:22px;margin:0;letter-spacing:-.2px}', '');
// menu lateral: fijo en la ventana -> columna pegajosa dentro del tablero
const iMenu = css.indexOf('/* menú lateral izquierdo */');
const iFinMenu = css.indexOf('#dicbox table');
if (iMenu < 0 || iFinMenu < iMenu) throw new Error('no encontre el bloque del menu lateral');
css = css.slice(0, iMenu) + css.slice(iFinMenu);

const tokens = `/* sura-televentas-app.css — Fase 215. Estilos del tablero Televentas (HTML
   de Edwin) dentro de su Shadow DOM. Generado desde el HTML original por el
   script de la Fase 215 (sin la libreria ni datos); los colores base salen de
   los tokens de la plataforma (docs/sistema-de-diseno.md), asi el tema
   claro/oscuro y la marca son los de InConexion. */
:host{--bg:var(--c-bg);--card:var(--c-surface);--tx:var(--c-text);--mut:var(--c-text-muted);--bd:var(--c-border);
  --ac:var(--c-primary-mid);--ac2:#12a37f;--bar:var(--c-primary-mid);--bar2:#12a37f;--dng:var(--c-danger-text);
  display:block;background:var(--bg);color:var(--tx);font-size:15px;line-height:1.45;color-scheme:light}
:host([data-theme="dark"]){--ac2:#2fc79f;--bar2:#2fc79f;color-scheme:dark}
`;
const layout = `
/* menu lateral (Fase 215): columna pegajosa bajo el encabezado del tablero */
.tab svg.icono{width:18px;height:18px;flex:0 0 18px}
.tab[hidden]{display:none!important}
#mtog{display:none}
@media(min-width:901px){
  .wrap{max-width:none;display:grid;grid-template-columns:206px minmax(0,1fr);column-gap:24px;padding:16px 24px 24px 0;align-items:start}
  .wrap>*{grid-column:2;max-width:1180px;width:100%}
  .wrap>header{grid-column:1;grid-row:1/span 200;margin:-16px 0 0;position:sticky;top:var(--stv-header-h,0px);align-self:start;gap:8px;max-width:none}
  .tabs::before{content:"MENÚ";font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--mut);padding:0 12px 8px}
  .tabs{flex-direction:column;flex-wrap:nowrap;justify-content:flex-start;gap:6px;padding:16px 10px;border-radius:0 0 14px 0;border-left:0;border-top:0;max-height:calc(100dvh - var(--stv-header-h,96px));overflow-y:auto}
  .tab{font-size:14px;padding:0 12px;height:44px;flex:0 0 44px;gap:10px;width:100%;justify-content:flex-start;margin:0}
  .tab:hover{background:var(--bg);color:var(--tx);transform:none}
  #mtog{display:flex;align-items:center;gap:6px;margin:12px 0 0 10px;align-self:flex-start;border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:9px;height:32px;padding:0 10px;cursor:pointer;font:inherit;font-size:13px;font-weight:600}
  #mtog:hover{border-color:var(--ac)}
  .wrap.mcol{grid-template-columns:auto minmax(0,1fr)}
  .wrap.mcol .tabs{display:none}
}
@media(max-width:900px){.wrap>header{margin-top:4px}}
@media(max-width:600px){.seg{display:flex;flex-wrap:wrap;max-width:100%}}
/* Fase 216: nombres de archivo largos y selectores no desbordan con las bases montadas */
.m small{overflow-wrap:anywhere}
.row label{max-width:100%;min-width:0}
.row label select{max-width:100%}
/* Fase 217: iconos de campaña con la misma altura visible (~18 px) que el logo de InConexion del encabezado */
.camp-ico{display:inline-block;font-size:20px;line-height:1;vertical-align:middle}
/* Fase 218: en el Centro de cargas solo se ve «Cargar información» (la misma app) */
.wrap.stv-solo-carga>header,.wrap.stv-solo-carga>#gfbar,.wrap.stv-solo-carga>#dhbar,.wrap.stv-solo-carga>section:not(#p1){display:none!important}
.wrap.stv-solo-carga>#p1{display:block!important}
.wrap.stv-solo-carga{display:block;max-width:none;padding:0}
.wrap.stv-solo-carga>*{max-width:none}
/* Fase 218: el recuadro emergente (tooltip) no toma el ancho del tablero (.wrap>*) y cabe en la pantalla */
.wrap>.mtip{width:auto;grid-column:auto;max-width:min(420px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:hidden;font-size:12px;line-height:1.35;padding:8px 10px}
.mtip table{font-size:12px}
.mtip td,.mtip th{padding:2px 6px}
.mtip .tt:has(tr>:nth-child(5)){table-layout:fixed;width:100%}
.mtip .tt th{font-size:11px}
@media(max-width:480px){.wrap>.mtip,.mtip table{font-size:11px}.mtip td,.mtip th{padding:2px 3px}}
.mtip .tt:has(tr>:nth-child(5)) :is(th,td):first-child{width:36%;overflow:hidden;text-overflow:ellipsis}
/* el cliente (solo lectura) no ve botones para cambiar datos */
.stv-lectura [data-ga],.stv-lectura [data-up],.stv-lectura [data-del],.stv-lectura [data-eup],.stv-lectura [data-edel],.stv-lectura [data-iup],.stv-lectura [data-idel]{display:none!important}
.stv-cargando{padding:40px 16px;text-align:center;color:var(--mut)}
`;
css = tokens + css.trim() + '\n' + layout;

// ── Marcado ───────────────────────────────────────────────────────────────
let markup = html.slice(html.indexOf('<div class="wrap">'), html.lastIndexOf('<script>'));
markup = una(markup, '<div class="brand"><div><h1>TELEVENTAS SURA</h1></div></div>\n', '');
const ICONOS = { p1: 'upload', p9: 'target', p2: 'users', p5: 'phone', p7: 'chart-column', p3: 'trending-up', p10: 'file-spreadsheet' };
markup = markup.replace(/<button class="tab( on)?" data-p="(p\d+)"><i>[^<]*<\/i>/g, (m, on, p) => {
  if (!ICONOS[p]) throw new Error('pestana sin icono ' + p);
  return `<button class="tab${on || ''}" type="button" data-p="${p}"><svg class="icono" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#i-${ICONOS[p]}"></use></svg>`;
});
if (/<i>/.test(markup.slice(0, markup.indexOf('</header>')))) throw new Error('quedo un emoji en las pestanas');
markup = markup.trim();

// ── Logica ────────────────────────────────────────────────────────────────
let js = html.slice(html.indexOf('const MESES=['), html.lastIndexOf('</script>'));
js = js.split('\n').filter((l) => !/^const (SEED|SEED_INI|SEED_EST|SEED_OLD|SEED_METAS|SEED_EST_OLD)=/.test(l)).join('\n');
if (/^const SEED/m.test(js)) throw new Error('quedo una constante SEED');
js = una(js, 'const $=id=>document.getElementById(id);', 'const $=id=>ROOT.getElementById(id);');
js = todas(js, 'document.querySelectorAll(', 'ROOT.querySelectorAll(');
js = una(js, 'const DHHOME=document.getElementById("dhhome");', 'const DHHOME=ROOT.getElementById("dhhome");');
js = todas(js, 'document.body.style.overflow=', 'BLOQUEO.overflow=');
js = todas(js, 'document.addEventListener("keydown",e=>{', 'document.addEventListener("keydown",e=>{if(!ABIERTO())return;');
{
  const resto = js.replace(/\/\* ocultar \/ mostrar menú lateral \*\/[\s\S]*$/, '').replace('document.body.appendChild(a)', '');
  const m = resto.match(/.{0,40}document\.(getElementById|querySelector|body).{0,40}/g);
  if (m) throw new Error('quedo una referencia a document fuera del Shadow DOM: ' + m.join(' | '));
}
// ── Almacenamiento: IndexedDB -> API de la plataforma ──────────────────────
const L = (a, b) => { js = una(js, a, b); };
L(js.slice(js.indexOf('function idb(){'), js.indexOf('\n', js.indexOf('async function save(){')) + 1),
  '/* Fase 215: lo que guardaba IndexedDB vive en el servidor (API, ver sura-televentas.js).\n   Cada cambio se guarda con su propia llamada (API.guardar / API.eliminar / API.config). */\n');
// tarjetas de mes: sin "precargada" ni "Actualizar a la version precargada"
L('${d.at===(SEED[k]||{}).at||SEED_OLD.includes(d.at)?"precargada":"montada el "+', '${"montada el "+');
L(js.slice(js.indexOf('      ${d&&SEED[k]&&d.at!==SEED[k].at'), js.indexOf('\n', js.indexOf('      ${d&&SEED[k]&&d.at!==SEED[k].at')) + 1), '');
L(js.slice(js.indexOf('  const sd=e.target.dataset.seed;'), js.indexOf('\n', js.indexOf('  const sd=e.target.dataset.seed;')) + 1), '');
L('{delete DB[d];await save();origDel("v",d);', '{if(!await API.eliminar("ventas",d,$("msg")))return;delete DB[d];');
L('const buf=await f.arrayBuffer(),r=parseBook(buf);origPut("v",pending,f.name,buf);', 'const k=pending,buf=await f.arrayBuffer(),r=parseBook(buf);');
L('const bad=r.rows.filter(x=>x[1].slice(0,7)!==pending).length;', 'const bad=r.rows.filter(x=>x[1].slice(0,7)!==k).length;');
L('    DB[pending]={file:f.name,at:new Date().toISOString(),rows:r.rows,strat:r.strat,ag:r.ag,geo:r.geo,pr:r.pr,ct:r.ct,sh:r.sh,x12:r.x12,mixta:r.mixta,v:18};\n    await save();renderMonths();refresh();\n    $("msg").textContent=`${MESES[+pending.slice(5)-1]}:',
  '    const nuevo={rows:r.rows,total:r.total,sheet:r.sheet,strat:r.strat,ag:r.ag,geo:r.geo,pr:r.pr,ct:r.ct,sh:r.sh,x12:r.x12,mixta:r.mixta};\n    $("msg").textContent="Guardando "+f.name+" en la plataforma…";\n    const meta=await API.guardar("ventas",k,f.name,buf,nuevo);\n    DB[k]=Object.assign(nuevo,{file:meta.archivoNombre,at:meta.cargadoEn,v:18});delete DB[k].total;delete DB[k].sheet;\n    renderMonths();refresh();\n    $("msg").textContent=`${MESES[+k.slice(5)-1]}:');
L('}catch(err){$("msg").textContent="No pude leer el archivo: "+err.message}\n  pending=null;', '}catch(err){$("msg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}\n  pending=null;');
L('${SEED_EST[k]&&(d.at===SEED_EST[k].at)?"precargada":"montada el "+', '${"montada el "+');
L(js.slice(js.indexOf('      ${d&&SEED_EST[k]&&d.at!==SEED_EST[k].at'), js.indexOf('\n', js.indexOf('      ${d&&SEED_EST[k]&&d.at!==SEED_EST[k].at')) + 1), '');
L(js.slice(js.indexOf('  const es=e.target.dataset.eseed;'), js.indexOf('\n', js.indexOf('  const es=e.target.dataset.eseed;')) + 1), '');
L('{delete EST()[d];await save();origDel("e",d);', '{if(!await API.eliminar("estrategias",d,$("emsg")))return;delete EST()[d];');
L('r=parseEst(buf);EST()[k]=Object.assign({file:f.name,at:new Date().toISOString()},r);await save();origPut("e",k,f.name,buf);',
  'r=parseEst(buf);$("emsg").textContent="Guardando "+f.name+" en la plataforma…";const meta=await API.guardar("estrategias",k,f.name,buf,r);EST()[k]=Object.assign({file:meta.archivoNombre,at:meta.cargadoEn},r);');
L('  catch(err){$("emsg").textContent="No pude leer el archivo: "+err.message}', '  catch(err){$("emsg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}');
L('${SEED_INI[k]&&d.at===SEED_INI[k].at?"precargada":"montada el "+', '${"montada el "+');
L('{delete INI()[d];await save();origDel("i",d);', '{if(!await API.eliminar("inicial",d,$("imsg")))return;delete INI()[d];');
L('r=parseIni(buf);INI()[k]=Object.assign({file:f.name,at:new Date().toISOString()},r);await save();origPut("i",k,f.name,buf);',
  'r=parseIni(buf);$("imsg").textContent="Guardando "+f.name+" en la plataforma…";const meta=await API.guardar("inicial",k,f.name,buf,r);INI()[k]=Object.assign({file:meta.archivoNombre,at:meta.cargadoEn},r);');
L('  catch(err){$("imsg").textContent="No pude leer el archivo: "+err.message}});', '  catch(err){$("imsg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}});');
// Excel original: del servidor (solo administrador)
L(js.slice(js.indexOf('async function origPut('), js.indexOf('\n', js.indexOf('async function origDel(')) + 1),
  'const ORIGT={v:"ventas",e:"estrategias",i:"inicial"};\nasync function origGet(t,k){return await API.archivo(ORIGT[t],k)}\n');
js = todas(js, 'no está guardado en este navegador', 'no está guardado en la plataforma', 3);
// configuracion (metas, asesores, codigos)
L('else c[t.dataset.mf]=n;await save();renderMetas();draw9();', 'else c[t.dataset.mf]=n;await API.config("metas",METAS());renderMetas();draw9();');
L('  await save();drawAgc();draw()});', '  await API.config("agc",AGC());drawAgc();draw()});');
L('DB.__dic[k]=m;await save();', 'DB.__dic[k]=m;await API.config("dic",DB.__dic);');
L('delete DB.__dic;delete DB.__tip;renderTip();await save();', 'delete DB.__dic;delete DB.__tip;renderTip();await API.config("dic",null);await API.config("tip",null);');
L('async function tipSave(T){DB.__tip=T;await save();', 'async function tipSave(T){DB.__tip=T;await API.config("tip",T);');
L('else c[t.dataset.mf]=n;await save();renderMetaA();', 'else c[t.dataset.mf]=n;await API.config("metasI",METAI());renderMetaA();');
// alias de asesores: del servidor (nunca nombres reales en el codigo)
L(js.slice(js.indexOf('const AGALIAS={'), js.indexOf('\n', js.indexOf('const AGALIAS={')) + 1),
  'let AGALIAS={}; // Fase 215: alias de asesores, del servidor (config "agalias")\n');
// arranque: del servidor, sin semillas
L(js.slice(js.indexOf('(async()=>{DB=await load();'), js.indexOf('\n', js.indexOf('  agFixDB();if(ch)await save();')) + 1),
  `async function cargar(){ // Fase 215: todo sale de la API (resumen + cada base por mes)
  const R=await API.resumen(),cfg=R.config||{};PERM=R;
  DB={};if(cfg.metas)DB.__metas=cfg.metas;if(cfg.metasI)DB.__metasI=cfg.metasI;if(cfg.agc)DB.__agc=cfg.agc;if(cfg.dic)DB.__dic=cfg.dic;if(cfg.tip)DB.__tip=cfg.tip;AGALIAS=cfg.agalias||{};
  const L=R.bases.slice();
  await Promise.all([0,1,2,3].map(async()=>{while(L.length){const b=L.shift(),d=await API.base(b.tipo,b.mes);if(b.tipo==="ventas")DB[b.mes]=d;else if(b.tipo==="inicial")INI()[b.mes]=d;else EST()[b.mes]=d}}));
  agFixDB();renderMonths();renderEst();renderIni();refresh();
  return R;
}
`);
L('const b=document.getElementById("mtog"),set=c=>{document.body.classList.toggle("mcol",c);', 'const b=$("mtog"),W=ROOT.querySelector(".wrap"),set=c=>{W.classList.toggle("mcol",c);');
L('localStorage.setItem("menuOculto",', 'localStorage.setItem("stvMenuOculto",');
L('c=localStorage.getItem("menuOculto")==="1"', 'c=localStorage.getItem("stvMenuOculto")==="1"');
L('b.addEventListener("click",()=>set(!document.body.classList.contains("mcol")))', 'b.addEventListener("click",()=>set(!W.classList.contains("mcol")))');
// Fase 217: los iconos de campaña (🦷 💙) van en un span con tamaño propio (.camp-ico).
L('function cfBtns(){', 'const CICO=c=>`<span class="camp-ico" aria-hidden="true">${c==="odontologico"?"🦷":"💙"}</span>`; // Fase 217: icono de campaña con tamaño propio\nfunction cfBtns(){');
L('${o.value==="odontologico"?"🦷 ":o.value==="salud_para_ti"?"💙 ":""}', '${o.value==="odontologico"||o.value==="salud_para_ti"?CICO(o.value)+" ":""}');
L('<h4>${c==="odontologico"?"🦷":"💙"} Campaña', '<h4>${CICO(c)} Campaña');
L('data-cc="${c}">${c==="odontologico"?"🦷":"💙"} ${n}', 'data-cc="${c}">${CICO(c)} ${n}');
L('ico=x=>x==="odontologico"?"🦷":"💙";', 'ico=CICO;');
// Fase 218: una sola funcion posiciona el recuadro emergente (tooltip), siempre dentro de la pantalla
// (primero se reemplazan las 9 copias y despues se agrega tipPos, que lleva el mismo texto).
js = todas(js, "m.style.left=x+\"px\";m.style.top=y+\"px\"", 'tipPos(m,x,y)', 8);
js = todas(js, "m.style.left=X+\"px\";m.style.top=Y+\"px\"", 'tipPos(m,X,Y)', 1);
L("const $=id=>ROOT.getElementById(id);", "const $=id=>ROOT.getElementById(id);\n// Fase 218: el recuadro emergente nunca se sale de la pantalla (8 px de margen).\nconst tipPos=(m,x,y)=>{x=Math.max(8,Math.min(x,innerWidth-m.offsetWidth-8));y=Math.max(8,Math.min(y,innerHeight-m.offsetHeight-8));m.style.left=x+\"px\";m.style.top=y+\"px\"};");
// ── Sistema de diseno: Quicksand trae 400-700 (Fase 132) y todo campo con nombre accesible (Fase 144, D13) ──
js = todas(js, 'font-weight:800', 'font-weight:700');
css = css.replace(/font-weight:\s*(800|900)/g, 'font-weight:700');
markup = markup.replace(/font-weight:\s*(800|900)/g, 'font-weight:700');
const M = (a, b) => { markup = una(markup, a, b); };
M('<select id="cf" hidden>', '<select id="cf" hidden aria-label="Campaña">');
M('<input type="date" id="fd">', '<input type="date" id="fd" aria-label="Desde">');
M('<input type="date" id="fh">', '<input type="date" id="fh" aria-label="Hasta">');
M('<select id="fp">', '<select id="fp" aria-label="Producto">');
for (const [id, que] of [['ric', 'ciudades'], ['rid', 'departamentos'], ['tic', 'ciudades'], ['tid', 'departamentos'], ['tip', 'productos']]) {
  M(`<input id="${id}" `, `<input id="${id}" aria-label="Agregar ${que}" `);
}
L('<input id="mic" ', '<input id="mic" aria-label="Agregar ciudades" ');
L('<input id="mid" ', '<input id="mid" aria-label="Agregar departamentos" ');
L('<input data-mk="${k}" data-mc="${c}" data-mf="p" ', '<input aria-label="Meta de producción ${nm} ${cName(c)}" data-mk="${k}" data-mc="${c}" data-mf="p" ');
L('<input data-mk="${k}" data-mc="${c}" data-mf="v" ', '<input aria-label="Meta de ventas ${nm} ${cName(c)}" data-mk="${k}" data-mc="${c}" data-mf="v" ');
L('<input data-mi="${k}" data-mc="${c}" data-mf="v" ', '<input aria-label="Meta individual de ventas ${nm} ${cName(c)}" data-mi="${k}" data-mc="${c}" data-mf="v" ');
L('<input data-mi="${k}" data-mc="${c}" data-mf="p" ', '<input aria-label="Meta individual de producción ${nm} ${cName(c)}" data-mi="${k}" data-mc="${c}" data-mf="p" ');
L('<input data-dk="${k}" data-dc="${c}" ', '<input aria-label="Significado del código ${c}" data-dk="${k}" data-dc="${c}" ');
L('<input data-nk="${k}" ', '<input aria-label="Código nuevo" data-nk="${k}" ');
L('<input data-nv="${k}" ', '<input aria-label="Significado nuevo" data-nv="${k}" ');
L('<input data-ti="${i}" data-tj="${j}" ', '<input aria-label="${TIPH[j]}, fila ${i+1}" data-ti="${i}" data-tj="${j}" ');
L('<input data-tn="${j}" ', '<input aria-label="${h}, fila nueva" data-tn="${j}" ');

{
  // sin imprimir contexto (podria traer datos): solo cual quedo
  const m = js.match(/SEED|save\(\)|idb\(|origPut|origDel|load\(\)|document\.body\.classList/i);
  if (m || !js.includes('let AGALIAS={};')) throw new Error('quedo algo del almacenamiento viejo: ' + (m ? m[0] : 'AGALIAS con valores'));
}

const app = `// sura-televentas-app.js — Fase 215: logica del tablero "Televentas" de SURA.
// Es el HTML de una sola pagina que hizo Edwin (lectura de los 3 Excel por
// mes con SheetJS, calculos y graficas), sin cambiar sus formulas: lo genera
// el script de la Fase 215 desde el HTML original, con estos cambios y nada
// mas:
//   - sin SheetJS embebido (usa js/vendor/xlsx-0.20.3.full.min.js de la
//     plataforma) y SIN las constantes SEED* (datos reales precargados);
//   - corre dentro de un Shadow DOM (ROOT): sus ids y estilos no chocan con
//     los de la plataforma;
//   - lo que guardaba IndexedDB (DB, save(), Excel original) va a la API
//     (objeto API, sura-televentas.js) y el arranque lee del servidor;
//   - los alias de asesores salen del servidor (nunca nombres en el codigo).
// Quien abre el tablero y que pestanas ve: sura-televentas.js.
/* eslint-disable */
var STV_MARKUP = ${JSON.stringify(markup)};

function stvCrearApp(ROOT, API, ABIERTO){
const BLOQUEO = {}; // el overlay de la plataforma ya bloquea el scroll del fondo
let PERM = null;
${js.trim()}

// leer: las 3 lecturas de Excel del HTML, para las pruebas con archivos sinteticos.
return { cargar: cargar, leer: { parseBook: parseBook, parseIni: parseIni, parseEst: parseEst } };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { STV_MARKUP: STV_MARKUP, stvCrearApp: stvCrearApp };
`;
fs.writeFileSync(path.join(repo, 'public/js/sura-televentas-app.js'), app);
fs.writeFileSync(path.join(repo, 'public/css/sura-televentas-app.css'), css);
console.log('css', css.length, 'markup', markup.length, 'js', js.length);
