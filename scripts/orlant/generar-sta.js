// scripts/orlant/generar-sta.js — Fase STA (parte 2). Genera «Gestión STA» de ORLANT
// (public/js/orlant-sta-app.js y public/css/orlant-sta-app.css) desde el HTML de una sola página
// que hizo Edwin (docs/orlant/sta/Gestion_STA.html, que NUNCA se edita a mano).
//
//   node scripts/orlant/generar-sta.js [ruta del HTML] [raiz del repo]
//
// Igual que Televentas de SURA (scripts/sura/generar-televentas.js):
//  - nunca copia SheetJS (la plataforma ya trae js/vendor/xlsx-0.20.3);
//  - corre dentro de un Shadow DOM (ROOT): ids y estilos no chocan con la plataforma;
//  - lo que guardaba IndexedDB va a la API /api/orlant/sta/* (server/orlant-sta.js): cada acción
//    llama a su ruta y después relee el estado del servidor;
//  - sin «Agregar / Renombrar / Eliminar agente» ni «Cambiar agente» (los agentes son los usuarios
//    ASESOR de ORLANT) ni respaldo / restaurar / borrar todo (los datos viven en el servidor);
//  - la vista (supervisor o asesor) la decide el servidor (/estado → vista).
// Los onclick="…" del HTML llaman a funciones globales; aquí viven dentro de stcCrearApp, así que
// cada llamada de un manejador en línea pasa a STAapp.<función>(…) (un solo nombre global; la CSP
// de la plataforma permite manejadores en línea pero no eval).
// Falla si un reemplazo no encuentra su texto exacto (el HTML cambió): revisar antes de forzarlo.
// No imprime datos, solo tamaños. Prueba guardiana: server/tests/faseSTA-orlant-gestion-sta-app.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const repo = process.argv[3] || path.join(__dirname, '..', '..');
const origen = process.argv[2] || path.join(repo, 'docs', 'orlant', 'sta', 'Gestion_STA.html');
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
css = una(css, 'body{margin:0;font-family:"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--txt);font-size:14px}',
  '.sta-app{font-family:inherit;background:var(--bg);color:var(--txt);font-size:14px;min-height:100%}');
if (/:root|(^|\n)body\{|(^|\n)html\{/.test(css)) throw new Error('quedó :root, body o html en el CSS');
css = css.replace(/font-weight:\s*(800|900)/g, 'font-weight:700'); // Quicksand trae 400–700 (Fase 132)
css = `/* orlant-sta-app.css — Fase STA. Estilos de «Gestión STA» (HTML de Edwin) dentro de su Shadow DOM.
   Generado por scripts/orlant/generar-sta.js desde docs/orlant/sta/Gestion_STA.html: no editar a mano. */
${css.trim()}
/* Fase STA: dentro de la plataforma no hay pantalla de inicio (la vista la decide el servidor) */
#inicio{display:none!important}
/* Fase STA: en el celular las pestañas se desplazan de lado en vez de ensanchar la página */
.tabs{overflow-x:auto;scrollbar-width:thin}
.tabs button{flex:0 0 auto;white-space:nowrap}
.sta-cargando{padding:40px 16px;text-align:center;color:var(--muted)}
`;

// ── Marcado ────────────────────────────────────────────────────────────
let markup = html.slice(html.indexOf('<!-- ================= AGENTE ================= -->'), html.indexOf('<script>/*! xlsx.js'));
markup = markup.replace(/\s*<\/body>[\s\S]*$/, '');
const M = (a, b) => { markup = una(markup, a, b); };
M('    <button class="btn ghost sm" onclick="cambiarAgente()">Cambiar agente</button>\n', ''); // pedido del usuario: sin «Cambiar de agente»
M(`          <div class="fila" style="margin-bottom:12px;flex-wrap:nowrap">
            <input class="inp" id="nuevoAgente" placeholder="Nombre del agente" style="flex:1" onkeydown="if(event.key==='Enter')crearAgente()">
            <button class="btn pri" onclick="crearAgente()">Agregar</button>
          </div>
`, '          <p class="muted" style="margin-top:0;font-size:12px">Los agentes son los usuarios ASESOR de ORLANT de la plataforma.</p>\n');
M(`onclick="document.getElementById('archivo').click()"`, `onclick="STAapp.$('archivo').click()"`);
M('<input class="inp" id="nuevaTipi" placeholder="Nueva tipificación"', '<input class="inp" id="nuevaTipi" aria-label="Nueva tipificación" placeholder="Nueva tipificación"');
markup = `<div class="sta-app">\n${markup.trim()}\n</div>`;

// ── Lógica ─────────────────────────────────────────────────────────────
const iScript = html.indexOf('<script>', html.indexOf('</script>'));
let js = html.slice(iScript + 8, html.lastIndexOf('</script>'));
const L = (a, b) => { js = una(js, a, b); };

// Reemplaza una función completa (de «function nombre(» o «async function nombre(» hasta antes de la
// siguiente línea de nivel superior que no sea «}»).
function funcion(nombre, nuevo) {
  const re = new RegExp('(^|\\n)(async )?function ' + nombre + '\\(');
  const m = re.exec(js);
  if (!m) throw new Error('no encontré la función ' + nombre);
  const ini = m.index + m[1].length;
  const lineas = js.slice(ini).split('\n');
  let fin = 1;
  while (fin < lineas.length && (lineas[fin] === '' || /^[\s}]/.test(lineas[fin]))) fin++;
  // las líneas en blanco del final quedan fuera
  while (fin > 1 && lineas[fin - 1] === '') fin--;
  const viejo = lineas.slice(0, fin).join('\n');
  if (/\n(async )?function /.test(viejo)) throw new Error('el bloque de ' + nombre + ' se comió otra función');
  js = js.slice(0, ini) + nuevo.trim() + js.slice(ini + viejo.length);
}

// 1) Almacenamiento: IndexedDB → API (estado del servidor; ids como texto, como en el HTML).
L(js.slice(js.indexOf('const DB = {'), js.indexOf('// relee antes de cada acción')),
  `/* Fase STA: lo que guardaba IndexedDB vive en el servidor (API /api/orlant/sta, server/orlant-sta.js). */
let VISTA = null, YO = null;
async function cargarEstado(){
  const r = await API.estado();
  VISTA = r.vista;
  const cfg = r.config || {};
  S = { agentes:(r.agentes||[]).map(a=>({id:String(a.id),nombre:a.nombre,activo:a.activo!==false})), tipis:(cfg.tipis||[]).slice(), efectivas:(cfg.efectivas||[]).slice(),
        columnas:(cfg.columnas||CAMPOS).slice(), casos:{}, cargas:(r.cargas||[]).map(c=>Object.assign({},c,{id:String(c.id)})).reverse(), seq:1 };
  for(const c of (r.casos||[])){ c._agente = c._agente==null ? null : String(c._agente); c._cargaId = c._cargaId==null ? null : String(c._cargaId); S.casos[c._id]=c; }
  if(VISTA==='asesor' && r.yo){ YO=r.yo; S.agentes=[{id:String(r.yo.id),nombre:r.yo.nombre,activo:true}]; agenteActual=String(r.yo.id); }
}
// Cada acción guarda con su propia llamada a la API; esto solo vuelve a pintar con lo del servidor.
async function accion(fn, msgError){ try{ return await fn(); }catch(e){ toast((msgError||'No se pudo guardar')+': '+e.message); return null; } }
`);
L("async function refrescar(){ await cargarEstado(); }", "async function refrescar(){ try{ await cargarEstado(); }catch(e){ toast('No se pudo leer Gestión STA: '+e.message); } }");

// 2) Shadow DOM: todo lo que buscaba en document busca en ROOT.
L("const $ = id => document.getElementById(id);", "const $ = id => ROOT.getElementById(id);");
js = todas(js, 'document.querySelectorAll(', 'ROOT.querySelectorAll(');
js = todas(js, 'document.querySelector(', 'ROOT.querySelector(');
L('document.body.appendChild(box);', 'ROOT.querySelector(".sta-app").appendChild(box);');
L("document.addEventListener('click',e=>{ if(!e.target.closest('.ms')){", "ROOT.addEventListener('click',e=>{ if(!e.target.closest('.ms')){");
L("document.addEventListener('mousemove',e=>{", "ROOT.addEventListener('mousemove',e=>{");
{
  const m = js.match(/document\.(getElementById|querySelector|body)/g);
  if (m) throw new Error('quedó una referencia a document fuera del Shadow DOM: ' + m.join(' | '));
}

// 3) Navegación: sin pantalla de inicio ni «elegir agente»; la vista la da el servidor.
L("function mostrar(id){ ['inicio','vAgente','vSupervisor'].forEach(", "function mostrar(id){ ['vAgente','vSupervisor'].forEach(");
L("function salir(){ agenteActual=null; mostrar('inicio'); document.title=TITULO; }", 'function salir(){ CERRAR(); }');
funcion('irAgente', 'async function iniciar(){ await cargarEstado(); if(VISTA===\'supervisor\'){ mostrar(\'vSupervisor\'); tabSup(\'base\'); } else { mostrar(\'vAgente\'); abrirPanelAgente(); } }');
funcion('irSupervisor', '');
funcion('cambiarAgente', '');
funcion('elegirAgente', '');
L("function revisarRellamadas(){\n  if(!agenteActual || $('vAgente').classList.contains('hidden')) return;", "function revisarRellamadas(){\n  if(!ABIERTO() || !agenteActual || $('vAgente').classList.contains('hidden')) return;");

// 4) Carga de la base: el Excel se lee aquí con la lógica de Edwin; el servidor aplica la llave.
L(`  const faltan=CAMPOS.filter(c=>!mapa.some(m=>m[1]===c));
  await refrescar();`, `  const faltan=CAMPOS.filter(c=>!mapa.some(m=>m[1]===c));
  // Fase STA: filas leídas con las mismas reglas del HTML; la llave (Numero Autorizacion), los
  // repetidos y el cambio de Estado los aplica el servidor en una sola transacción.
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){
    const fila=filas[r]; if(!fila || fila.every(v=>v===''||v==null)) continue;
    const o={}; mapa.forEach(([i,c])=>{ let v=fila[i]; if(CAMPOS_FECHA.includes(c)) v=aFecha(v); else if(v instanceof Date) v=isoLocal(v); else v=typeof v==='string'?v.trim():v; o[c]=v; });
    objs.push(o);
  }
  box.innerHTML=\`<div class="msg warn">Guardando \${esc(file.name)} en la plataforma…</div>\`;
  let R; try{ R=await API.cargar(file, mapa.map(m=>m[1]), objs); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo guardar: \${esc(e.message)}</div>\`; return; }
  await refrescar(); pintarBase();
  const nuevos=R.nuevos, dup=R.dup, actEst=R.actEst, sinNum=R.sinNum, cambios=R.cambios||{};
  box.innerHTML = \`<div class="msg ok">\${esc(R.mensaje)}.</div>\``);
L(js.slice(js.indexOf("  mapa.forEach(([,c])=>{ if(!S.columnas.includes(c)) S.columnas.push(c); });"), js.indexOf("  box.innerHTML = `<div class=\"msg ok\">Se cargaron <b>${nuevos}</b> casos nuevos.</div>`\n")), '');
L("  box.innerHTML = `<div class=\"msg ok\">Se cargaron <b>${nuevos}</b> casos nuevos.</div>`\n    + (dup?", "    + (dup?");
L(`<td><button class="btn sm peligro" onclick="pedirBorrarCarga('\${c.id}')">Eliminar carga</button></td>`,
  `<td class="nw">\${c.tieneArchivo?\`<button class="btn sm" onclick="descargarCarga('\${c.id}')">Descargar</button> \`:''}<button class="btn sm peligro" onclick="pedirBorrarCarga('\${c.id}')">Eliminar carga</button></td>`);
funcion('borrarCarga', `async function borrarCarga(id){
  const conservar = $('conservarGes') ? $('conservarGes').checked : false;
  const r = await accion(()=>API.borrarCarga(id, conservar), 'No se pudo eliminar');
  cerrarModal(); await refrescar(); pintarBase(); if(!r) return;
  $('cargaMsg').innerHTML=\`<div class="msg ok">Se eliminaron <b>\${r.eliminados}</b> casos de la carga.\${r.conservados?\` Se conservaron <b>\${r.conservados}</b> gestionados.\`:''}</div>\`;
}
async function descargarCarga(id){ if(!await API.descargar(id)) toast('No se pudo descargar el archivo'); }`);
funcion('descargarRespaldo', '');
funcion('restaurarRespaldo', '');
funcion('borrarTodo', '');

// 5) Asignación: las mismas reglas (los más antiguos por Fecha Ingreso Sta, con filtros); el servidor asigna.
const filtrosApi = "{entidad:F.ent?[...F.ent]:null,servicio:F.serv?[...F.serv]:null,cups:F.cups?[...F.cups]:null,ingD:F.ingD,ingH:F.ingH,autD:F.autD,autH:F.autH,expD:F.expD,expH:F.expH}";
funcion('ejecutarAsignacion', `async function ejecutarAsignacion(lista){
  if(!lista.length) return toast('No hay casos disponibles con esos filtros');
  const r = await accion(()=>API.asignar(agSel, lista.length, ${filtrosApi}), 'No se pudo asignar');
  await refrescar(); if(r) toast(\`\${r.asignados} casos asignados a \${nombreAgente(agSel)}\`); F.cant=''; pintarAsignar();
}`);
funcion('devolverSel', `async function devolverSel(ag){
  const ids=[...selDe(ag)]; if(!ids.length) return toast('Selecciona al menos un caso');
  if(!await confirmar(\`¿Devolver \${ids.length} casos de \${nombreAgente(ag)} a disponibles?\`,{titulo:'Devolver casos',ok:'Devolver'})) return;
  const r = await accion(()=>API.devolver(ag, ids), 'No se pudo devolver');
  await refrescar(); selDe(ag).clear(); cantPend[ag]=''; if(r) toast(\`\${r.devueltos} casos devueltos a disponibles\`); pintarAsignar();
}`);
funcion('pasarSel', `async function pasarSel(ag){
  const ids=[...selDe(ag)]; if(!ids.length) return toast('Selecciona al menos un caso');
  const dest=$('dest_'+ag).value; if(!dest) return toast('Elige el agente al que vas a pasar los casos');
  if(!await confirmar(\`¿Pasar \${ids.length} casos de \${nombreAgente(ag)} a \${nombreAgente(dest)}?\`,{titulo:'Pasar casos',ok:'Pasar'})) return;
  const r = await accion(()=>API.pasar(ag, dest, ids), 'No se pudo pasar');
  await refrescar(); selDe(ag).clear(); cantPend[ag]=''; abiertos.add(dest); if(r) toast(\`\${r.pasados} casos pasados a \${nombreAgente(dest)}\`); pintarAsignar();
}`);
funcion('quitarPendientes', `async function quitarPendientes(){
  if(!await confirmar('Los casos pendientes (sin codificar) de este agente volverán a quedar sin asignar. ¿Continuar?')) return;
  const ids=pendDe(agSel).map(c=>c._id);
  const r = ids.length ? await accion(()=>API.devolver(agSel, ids), 'No se pudo devolver') : {devueltos:0};
  await refrescar(); if(r) toast(\`\${r.devueltos} casos devueltos\`); pintarAsignar();
}`);
funcion('crearAgente', '');
funcion('renombrarAgente', '');
funcion('eliminarAgente', '');
L(`      <div class="fila"><button class="btn sm" onclick="renombrarAgente()">Renombrar</button>
        <button class="btn sm peligro" onclick="eliminarAgente()">Eliminar</button></div>
`, '');
L("    : `<p class=\"muted\">Agrega el primer agente.</p>`;", "    : `<p class=\"muted\">No hay usuarios ASESOR activos de ORLANT.</p>`;");

// 6) Tipificaciones del líder: se calcula la lista nueva y se guarda entera.
const guardarTipis = "const c=await accion(()=>API.tipis(T,E)); await refrescar(); pintarTipis(); return c;";
funcion('marcarEfectiva', `async function marcarEfectiva(i,on){ const t=S.tipis[i], T=S.tipis.slice(), E=S.efectivas.filter(x=>x!==t); if(on) E.push(t);
  if(await (async()=>{ ${guardarTipis} })()) toast(on?\`"\${t}" cuenta como efectiva\`:\`"\${t}" ya no cuenta como efectiva\`); }`);
funcion('crearTipi', `async function crearTipi(){ const t=$('nuevaTipi').value.trim(); if(!t) return;
  if(S.tipis.some(x=>x.toLowerCase()===t.toLowerCase())) return toast('Ya existe'); const T=S.tipis.concat([t]), E=S.efectivas.slice();
  if(await (async()=>{ ${guardarTipis} })()) $('nuevaTipi').value=''; }`);
funcion('moverTipi', `async function moverTipi(i,d){ const T=S.tipis.slice(), E=S.efectivas.slice(); [T[i],T[i+d]]=[T[i+d],T[i]]; ${guardarTipis} }`);
funcion('borrarTipi', `async function borrarTipi(i){ const t=S.tipis[i];
  if(!await confirmar(\`¿Quitar "\${t}"? Las gestiones ya registradas la conservan.\`,{titulo:'Quitar tipificación',ok:'Quitar',peligro:true})) return;
  const T=S.tipis.filter(x=>x!==t), E=S.efectivas.filter(x=>x!==t); if(await (async()=>{ ${guardarTipis} })()) toast(\`"\${t}" quitada\`); }`);

// 7) Asesor: codificar y la alerta de «volver a llamar» van al servidor (que valida que el caso sea suyo).
L(`  await refrescar();
  const c=S.casos[id];
  const esRell = c && c._rell && c._rell.estado==='pendiente';
  if(!c || c._agente!==agenteActual || (c._estado!=='pendiente' && !esRell)){ cerrarModal(); pintarBandeja(); return toast('Este caso ya no está en tu bandeja'); }
  if(esRell){ c._prev=(c._prev||[]).concat([{tipi:c._tipi,obs:c._obs,fg:c._fg,citas:c._citas||0,rell:c._rell.cuando}]); c._rell.estado='hecha'; }
  c._estado='gestionado'; c._tipi=tipi; c._obs=obs; c._fg=ahora(); c._citas=citas;
  if(cuando) c._rell={cuando,estado:'pendiente',avisado:false};
  await guardar(); cerrarModal();`, `  try{ await API.codificar(id,{tipi,obs,citas,cuando}); }
  catch(e){ if(e.status===409){ cerrarModal(); await refrescar(); pintarBandeja(); } return toast(e.status===409?'Este caso ya no está en tu bandeja':'No se pudo guardar: '+e.message); }
  await refrescar(); cerrarModal();`);
L(`  const cerrar=async(acc)=>{ box.remove(); clearInterval(sonando); document.title=TITULO; await refrescar(); const x=S.casos[c._id]; if(!x||!x._rell) return;
    if(acc==='pos'){ const d=new Date(); d.setMinutes(d.getMinutes()+10); x._rell.cuando=isoLocal(d).slice(0,17)+'00'; x._rell.avisado=false; }
    else x._rell.avisado=true;
    await guardar(); pintarRellamadas();`, `  const cerrar=async(acc)=>{ box.remove(); clearInterval(sonando); document.title=TITULO;
    await accion(()=>API.rellamada(c._id, acc)); await refrescar(); pintarRellamadas();`);

// 8) Arranque: lo hace la plataforma (iniciar), no la página.
L('\n\ncargarEstado();\n', '\n');
{
  const m = js.match(/indexedDB|DB\.(leer|escribir)|await guardar\(\)|migrar\(\)|sessionStorage|\bguardar\(\)/);
  if (m) throw new Error('quedó algo del almacenamiento viejo: ' + m[0]);
}
js = js.replace(/font-weight:\s*(800|900)/g, 'font-weight:700');

// Sistema de diseño (Fase 144): nada de texto bajo 12 px y todo campo con nombre accesible (D13).
js = todas(js, 'font-size:11px', 'font-size:12px');
M('<input class="inp" id="agBuscar" ', '<input class="inp" id="agBuscar" aria-label="Buscar en mi bandeja" ');
M('<input class="inp" id="agGestBuscar" ', '<input class="inp" id="agGestBuscar" aria-label="Buscar por número de autorización" ');
L('<input type="date" class="inp" id="codRellF">', '<input type="date" class="inp" id="codRellF" aria-label="Fecha para volver a llamar">');
L('<input type="time" class="inp" id="codRellH">', '<input type="time" class="inp" id="codRellH" aria-label="Hora para volver a llamar">');
L('<select class="inp" id="dest_${a.id}" ', '<select class="inp" id="dest_${a.id}" aria-label="Pasar a otro agente" ');
L('<input type="checkbox" ${todos?', '<input type="checkbox" aria-label="Seleccionar todos" ${todos?');
L('<input type="checkbox" ${sel.has(c._id)?', '<input type="checkbox" aria-label="Seleccionar ${esc(c[\'Numero Autorizacion\'])}" ${sel.has(c._id)?');
L('<input class="inp" placeholder="Buscar…" ', '<input class="inp" aria-label="Buscar opciones" placeholder="Buscar…" ');
L('<input class="inp" id="dlgIn" ', '<input class="inp" id="dlgIn" aria-label="${esc(titulo)}" ');

// 9) Manejadores en línea (onclick, onchange, oninput, onkeydown): sus llamadas pasan a STAapp.<función>.
const nombres = [...new Set([...js.matchAll(/(?:^|\n)(?:async )?function (\w+)\(/g)].map((m) => m[1]))];
const reLlamada = new RegExp('(^|[^.\\w$])(' + nombres.join('|') + ')\\(', 'g');
const prefijar = (s) => s.replace(/ on(click|change|input|keydown)="([^"]*)"/g, (all, ev, code) => ` on${ev}="${code.replace(reLlamada, '$1STAapp.$2(')}"`);
markup = prefijar(markup);
js = prefijar(js);
{
  const sinPrefijo = [...(markup + js).matchAll(/ on(?:click|change|input|keydown)="([^"]*)"/g)].map((m) => m[1]).filter((c) => !/STAapp\./.test(c) && !/^if\(event/.test(c));
  if (sinPrefijo.length) throw new Error('quedó un manejador sin STAapp: ' + sinPrefijo.slice(0, 3).join(' | '));
}

const app = `// orlant-sta-app.js — Fase STA: «Gestión STA» de ORLANT (HTML de Edwin dentro de la plataforma).
// GENERADO por scripts/orlant/generar-sta.js desde docs/orlant/sta/Gestion_STA.html: no editar a mano.
// Cambios respecto al HTML, y nada más:
//   - sin SheetJS embebido (usa js/vendor/xlsx-0.20.3.full.min.js de la plataforma);
//   - corre dentro de un Shadow DOM (ROOT);
//   - lo que guardaba IndexedDB va a la API /api/orlant/sta (objeto API, orlant-sta.js); la vista
//     (supervisor o asesor) la decide el servidor;
//   - sin agregar/renombrar/eliminar ni cambiar de agente (son los ASESOR de ORLANT), sin respaldo,
//     restaurar ni borrar todo; «Descargar» el Excel de cada carga;
//   - los manejadores en línea llaman a STAapp.<función> (un solo nombre global).
/* eslint-disable */
var STA_MARKUP = ${JSON.stringify(markup)};

function staCrearApp(ROOT, API, ABIERTO, CERRAR){
${js.trim()}

var STAapp = { ${nombres.join(', ')}, $: $ };
if (typeof window !== 'undefined') window.STAapp = STAapp;
return { iniciar: iniciar, refrescar: refrescar, vista: function(){ return VISTA; } };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { STA_MARKUP: STA_MARKUP, staCrearApp: staCrearApp };
`;
fs.writeFileSync(path.join(repo, 'public/js/orlant-sta-app.js'), app);
fs.writeFileSync(path.join(repo, 'public/css/orlant-sta-app.css'), css);
console.log('css', css.length, 'markup', markup.length, 'js', js.length, 'funciones', nombres.length);
