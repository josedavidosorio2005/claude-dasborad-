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
// Fase STA (prueba del 21/11): colores fijos del HTML -> variables, para el tema oscuro de la plataforma (abajo).
// En claro cada variable cae en el mismo color de Edwin.
[
  ['background:#fff;', 'background:var(--card);'], ['background:#fff}', 'background:var(--card)}'],
  ['color:var(--teal)', 'color:var(--sta-titulo,var(--teal))'],
  ['#eef3f6', 'var(--sta-th,#eef3f6)'], ['#eef2f4', 'var(--sta-linea2,#eef2f4)'], ['#f8fbfc', 'var(--sta-hover,#f8fbfc)'],
  ['#eef7fd', 'var(--sta-sel,#eef7fd)'], ['#cfe6f6', 'var(--sta-sel-borde,#cfe6f6)'], ['#fafcfd', 'var(--sta-drop,#fafcfd)'],
  ['fill:#1c2b33', 'fill:var(--txt)'], ['fill:#52514e', 'fill:var(--sta-eje-txt,#52514e)'],
  ['stroke:#e8edf0', 'stroke:var(--sta-grid,#e8edf0)'], ['stroke:#c9d3d9', 'stroke:var(--sta-eje,#c9d3d9)'],
  ['#eaf6e6 0,#f3f6f8 100%', 'var(--sta-gest1,#eaf6e6) 0,var(--sta-gest2,#f3f6f8) 100%'], ['background:#eaf6e6', 'background:var(--sta-gest1,#eaf6e6)'],
  ['color:#2f6b25', 'color:var(--sta-verde-txt,#2f6b25)'], ['color:#2e7d32', 'color:var(--sta-verde-txt,#2e7d32)'],
].forEach(([de, a]) => { css = todas(css, de, a); });
css = `/* orlant-sta-app.css — Fase STA. Estilos de «Gestión STA» (HTML de Edwin) dentro de su Shadow DOM.
   Generado por scripts/orlant/generar-sta.js desde docs/orlant/sta/Gestion_STA.html: no editar a mano. */
${css.trim()}
/* Fase STA: dentro de la plataforma no hay pantalla de inicio (la vista la decide el servidor) */
#inicio{display:none!important}
/* Fase STA: en el celular las pestañas se desplazan de lado en vez de ensanchar la página */
.tabs{overflow-x:auto;scrollbar-width:thin}
.tabs button{flex:0 0 auto;white-space:nowrap}
.sta-cargando{padding:40px 16px;text-align:center;color:var(--muted)}
/* Fase STA (prueba del 21/11): contraste AA (docs/sistema-de-diseno.md). El gris de las etiquetas (#6b7c86, 4,3:1)
   pasa al gris de la plataforma y los botones azul/verde con letra blanca (2,9:1 y 2,6:1) se oscurecen. */
:host{--muted:var(--c-text-muted,#4f6f7d); --btn-pri:#1f6c9c; --btn-ok:#2e7d32}
.btn.pri{background:var(--btn-pri);border-color:var(--btn-pri)}
.btn.pri:hover{background:#185a83}
.btn.ok{background:var(--btn-ok);border-color:var(--btn-ok)}
.ms-acc a{color:var(--sta-enlace,#1f6c9c)}
.tag{color:#1a5c86} .tag.v{color:#2e6a1d} .tag.a{color:#7d520c}
.pill{background:#2e7d32}
.acc .flecha{color:var(--sta-enlace,#1f6c9c)}
/* Tema oscuro: el anfitrión trae data-theme (orlant-sta.js) y los tokens --c-* de la plataforma entran al Shadow DOM. */
:host([data-theme="dark"]){
  --bg:var(--c-bg); --card:var(--c-surface); --line:var(--c-border); --txt:var(--c-text); --muted:var(--c-text-muted);
  --sta-titulo:var(--c-text); --sta-th:var(--c-surface-subtle); --sta-linea2:var(--c-border-soft); --sta-hover:var(--c-hover-bg);
  --sta-sel:var(--c-hover-bg); --sta-sel-borde:var(--c-border); --sta-drop:var(--c-surface-subtle);
  --sta-eje-txt:var(--c-text-2); --sta-grid:var(--c-border-soft); --sta-eje:var(--c-border);
  --sta-carril:var(--c-surface-subtle); --sta-gest1:var(--c-success-bg); --sta-gest2:var(--c-bg); --sta-verde-txt:var(--c-success-text); --sta-enlace:var(--c-text-link);
  --muted:var(--c-text-2); color-scheme:dark;
}
.btn.peligro{color:var(--c-danger-text,#b02a1d)}
/* Pedido 3 de Edwin (23/11/2026): carga eliminada en el historial */
.tag.sta-eliminada{color:var(--c-danger-text,#b02a1d);background:var(--c-danger-bg,#fdecea)}
.sta-fila-eliminada td{color:var(--muted)}
:host([data-theme="dark"]) .sec-gest,:host([data-theme="dark"]) .sec-gest .card,:host([data-theme="dark"]) .kpi.dest{border-color:var(--c-border)}
/* Pedido de Edwin (23/11/2026): vista del CLIENTE de ORLANT = solo «Gráficas» del supervisor, de solo lectura
   (sin la cabecera «Visual de supervisor» ni las demás pestañas). */
.sta-app.sta-cliente #vSupervisor > header.top,.sta-app.sta-cliente #vSupervisor nav.tabs{display:none}
.sta-app.sta-cliente #vSupervisor main{padding-top:0}
/* Pedido de Edwin (25/11/2026): «Cargar base de datos» y «Actualizar estado» lado a lado (uno debajo del otro en
   el celular y la tableta angosta). */
.sta-cargas-dos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.sta-cargas-dos>.card{margin-top:0}
.sta-cargas-dos .drop{padding:22px 14px}
.sta-no-existen{display:block;max-height:140px;overflow:auto;margin-top:6px;font-size:12px;word-break:break-word}
@media(max-width:820px){.sta-cargas-dos{grid-template-columns:minmax(0,1fr)}}
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
// Pendiente del STA (23/11): «Descargar plantilla» en el panel de carga — un Excel vacío con los 8 encabezados
// que pide la carga (CAMPOS, los mismos que exige server/orlant-sta.js), sin filas de ejemplo.
M(`        <input type="file" id="archivo" accept=".xlsx,.xls,.csv" class="hidden">`, `        <div class="fila sta-plantilla" style="margin-top:10px;align-items:center"><span class="muted" style="flex:1;min-width:200px">¿Primera vez? Descarga la plantilla con las 8 columnas que pide la carga.</span><button class="btn sm" type="button" onclick="descargarPlantilla()">Descargar plantilla</button></div>
        <input type="file" id="archivo" accept=".xlsx,.xls,.csv" class="hidden">`);
// Pedidos de Edwin (25/11/2026, 2:45 p. m.): filtro por mes (arranca en el mes actual) junto a las fechas, y en
// Gestionados el cuadro «Cambios de estado» con quién hizo cada cambio (buscable por Numero Autorizacion).
M(`<label class="f">Gestión desde<input type="date" class="inp" id="grD" onchange="pintarGraficas()">`,
  `<label class="f">Mes<select class="inp" id="grMes" aria-label="Mes de gestión" onchange="elegirMes('gr')"></select></label>
        <label class="f">Gestión desde<input type="date" class="inp" id="grD" onchange="pintarGraficas()">`);
M(`<label class="f">Desde<input type="date" class="inp" id="gsD" onchange="pintarGestSup()">`,
  `<label class="f">Mes<select class="inp" id="gsMes" aria-label="Mes de gestión" onchange="elegirMes('gs')"></select></label>
        <label class="f">Desde<input type="date" class="inp" id="gsD" onchange="pintarGestSup()">`);
M(`      <div id="gsTabla"></div>`, `      <div id="gsTabla"></div>
      <div class="card sta-cambios" style="margin-top:16px">
        <h3>Cambios de estado</h3>
        <p class="muted" style="margin-top:0;font-size:12px">Lo que cambió «Actualizar estado» o la carga de la base, con quién lo hizo (no la asesora). El buscador de arriba filtra por Numero Autorizacion.</p>
        <div id="gsCambios"></div>
      </div>`);
// Pedido de Edwin (25/11/2026): «Cargar base de datos» y «Actualizar estado» en dos cuadros lado a lado.
M(`      <div class="card">
        <h3>Cargar base de datos</h3>`, `      <div class="sta-cargas-dos">
      <div class="card sta-carga-base">
        <h3>Cargar base de datos</h3>`);
M(`        <div id="cargaMsg"></div>
      </div>`, `        <div id="cargaMsg"></div>
      </div>
      <div class="card sta-act-estado">
        <h3>Actualizar estado</h3>
        <p class="muted" style="margin-top:0">Excel con 2 columnas: <b>Numero Autorizacion</b> y <b>Estado</b>. Cambia el estado de los casos que ya están en la base; los que no existan se reportan y no se crean. Solo <b>En proceso</b> y <b>Sin contacto</b> se gestionan: con otro estado, el caso sale de asignados, pendientes y sin asignar.</p>
        <div class="drop" id="dropEst" onclick="STAapp.$('archivoEst').click()">
          <b>Arrastra aquí el Excel</b> o haz clic para seleccionarlo<br><span class="muted">.xlsx, .xls o .csv</span>
        </div>
        <div class="fila sta-plantilla" style="margin-top:10px;align-items:center"><span class="muted" style="flex:1;min-width:200px">Plantilla con las 2 columnas.</span><button class="btn sm" type="button" onclick="STAapp.descargarPlantillaEstado()">Descargar plantilla</button></div>
        <input type="file" id="archivoEst" accept=".xlsx,.xls,.csv" class="hidden" aria-label="Archivo para actualizar estado">
        <div id="estadoMsg"></div>
      </div>
      </div>
      <div class="card sta-historico">
        <h3>Cargar histórico (con gestión)</h3>
        <p class="muted" style="margin-top:0">Para los archivos de meses anteriores que ya traen la gestión: los campos de la base más <b>CODIFICACION</b>, <b>OBSERVACION</b>, <b>FECHA GESTION</b> (o FECHA) y <b>ASESOR</b>. Cárgalos del más reciente al más antiguo: una autorización que ya existe se rechaza. Primero se muestra la revisión; nada se guarda hasta que confirmes.</p>
        <div class="drop" id="dropHist" onclick="STAapp.$('archivoHist').click()">
          <b>Arrastra aquí el Excel</b> o haz clic para seleccionarlo<br><span class="muted">.xlsx, .xls o .csv</span>
        </div>
        <input type="file" id="archivoHist" accept=".xlsx,.xls,.csv" class="hidden" aria-label="Archivo del histórico">
        <div id="histMsg"></div>
      </div>`);
M('<input class="inp" id="nuevaTipi" placeholder="Nueva tipificación"', '<input class="inp" id="nuevaTipi" aria-label="Nueva tipificación" placeholder="Nueva tipificación"');
// Pedido de Edwin (23/11/2026): «Regresar a disponibles» en Gestionados (por codificación o marcados).
M(`      <p class="muted" id="gsInfo" style="margin:0 0 10px"></p>`, `      <div class="card fila gs-regresar" style="padding:12px 16px">
        <label class="f">Regresar a disponibles por codificación<select class="inp" id="gsRegTi"></select></label>
        <button class="btn" style="align-self:flex-end" onclick="regresarPorTipi()">Regresar todos</button>
        <span style="flex:1"></span>
        <button class="btn" style="align-self:flex-end" id="gsRegSelBtn" onclick="regresarSel()" disabled>Regresar marcados</button>
      </div>
      <p class="muted" style="margin:-4px 0 10px;font-size:12px">Los casos vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».</p>
      <p class="muted" id="gsInfo" style="margin:0 0 10px"></p>`);
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
funcion('irAgente', 'async function iniciar(){ await cargarEstado(); ROOT.querySelector(\'.sta-app\').classList.toggle(\'sta-cliente\', VISTA===\'cliente\'); if(VISTA===\'cliente\'){ mostrar(\'vSupervisor\'); tabSup(\'graficas\'); } else if(VISTA===\'supervisor\'){ mostrar(\'vSupervisor\'); tabSup(\'base\'); } else { mostrar(\'vAgente\'); abrirPanelAgente(); } }');
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
// Pedido 3 de Edwin (23/11/2026): una carga eliminada queda en el registro como «Eliminada» (sin botones).
L(`<td><button class="btn sm peligro" onclick="pedirBorrarCarga('\${c.id}')">Eliminar carga</button></td>`,
  `<td class="nw">\${c.eliminadaAt?\`<span class="tag sta-eliminada">Eliminada</span> <span class="muted" style="font-size:12px">\${verFecha(c.eliminadaAt,true)}\${c.eliminadaPor?' · '+esc(c.eliminadaPor):''}</span>\`:\`\${c.tieneArchivo?\`<button class="btn sm" onclick="descargarCarga('\${c.id}')">Descargar</button> \`:''}<button class="btn sm peligro" onclick="pedirBorrarCarga('\${c.id}')">Eliminar carga</button>\`}</td>`);
L(`\${S.cargas.slice().reverse().map(c=>\`<tr><td class="nw">`, `\${S.cargas.slice().reverse().map(c=>\`<tr\${c.eliminadaAt?' class="sta-fila-eliminada"':''}><td class="nw">`);
funcion('borrarCarga', `async function borrarCarga(id){
  const conservar = $('conservarGes') ? $('conservarGes').checked : false;
  const r = await accion(()=>API.borrarCarga(id, conservar), 'No se pudo eliminar');
  cerrarModal(); await refrescar(); pintarBase(); if(!r) return;
  $('cargaMsg').innerHTML=\`<div class="msg ok">Se eliminaron <b>\${r.eliminados}</b> casos de la carga.\${r.conservados?\` Se conservaron <b>\${r.conservados}</b> gestionados.\`:''}</div>\`;
}
async function descargarCarga(id){ if(!await API.descargar(id)) toast('No se pudo descargar el archivo'); }
function descargarPlantilla(){
  if(typeof XLSX==='undefined'){ toast('No se pudo preparar el archivo de Excel'); return; }
  const ws=XLSX.utils.aoa_to_sheet([CAMPOS.slice()]); ws['!cols']=CAMPOS.map(c=>({wch:Math.max(14,c.length+2)}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Base STA'); XLSX.writeFile(wb,'Plantilla_base_STA.xlsx');
}`);
funcion('descargarRespaldo', '');

// Pedido de Edwin (23/11/2026): Gestionados con casillas y «Regresar a disponibles». Misma tabla de
// Edwin (últimas 20, «Descargar todas»), más una columna de casillas y «marcar todos los mostrados».
funcion('pintarGestSup', `function pintarGestSup(){
  pintarCambios();
  const l=gestSupLista(), tot=Object.values(S.casos).filter(c=>c._estado==='gestionado').length+gestHistCuenta().length;
  const max=20;
  const tis=[...new Set([...S.tipis,...Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi).map(c=>c._tipi)])];
  const vr=$('gsRegTi').value; $('gsRegTi').innerHTML='<option value="">Elige la codificación</option>'+tis.map(t=>{ const n=Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi===t).length; return \`<option value="\${esc(t)}">\${esc(t)} (\${n.toLocaleString('es-CO')})</option>\`; }).join(''); $('gsRegTi').value=vr;
  const vivos=new Set(l.map(c=>c._id)); [...selGest].forEach(id=>{ if(!vivos.has(id)) selGest.delete(id); });
  $('gsRegSelBtn').disabled=!selGest.size; $('gsRegSelBtn').textContent=selGest.size?\`Regresar marcados (\${selGest.size})\`:'Regresar marcados';
  $('gsInfo').innerHTML = \`\${l.length.toLocaleString('es-CO')} gestiones\${l.length!==tot?\` (de \${tot.toLocaleString('es-CO')} en total)\`:''}\`
    + (l.length>max?\` · Se muestran las últimas \${max}. Para ver todas usa <b>Exportar a Excel</b>.\`:'');
  if(!l.length){ $('gsTabla').innerHTML='<div class="card vacio">No hay gestiones para mostrar.</div>'; return; }
  const vis=l.slice(0,max), marcables=vis.filter(c=>!c._virtual), todos=marcables.length>0&&marcables.every(c=>selGest.has(c._id));
  $('gsTabla').innerHTML=\`<div class="tw"><table><thead><tr><th><input type="checkbox" aria-label="Marcar todos los mostrados" \${todos?'checked':''} onchange="marcarGestTodos(this.checked)"></th><th>Fecha</th><th>Hora</th><th>Numero Autorizacion</th><th>Codificación</th><th>Citas</th><th>Agente</th></tr></thead><tbody>
    \${vis.map(c=>\`<tr><td><input type="checkbox" aria-label="Marcar \${esc(c['Numero Autorizacion'])}" \${selGest.has(c._id)?'checked':''}\${c._virtual?' disabled title="Gestión del histórico: el caso ya está disponible"':''} onchange="marcarGest(\${jsArg(c._id)},this.checked)"></td><td class="nw">\${verFecha(c._fg)}</td><td class="nw">\${c._fg.slice(11,19)==='00:00:00'?'':c._fg.slice(11,19)}</td><td class="nw">\${esc(c['Numero Autorizacion'])}</td><td><span class="tag \${S.efectivas.includes(c._tipi)?'v':''}">\${esc(c._tipi)}</span></td><td>\${c._citas||''}</td><td>\${esc(nombreAgente(c._agente))}</td></tr>\`).join('')}
  </tbody></table></div>\${l.length>max?\`<div class="fila" style="margin-top:10px"><span class="muted">Mostrando las últimas \${max} de \${l.length.toLocaleString('es-CO')}.</span><button class="btn pri sm" onclick="exportarGestionados()">Descargar todas (Excel)</button></div>\`:''}\`;
}
const selGest=new Set();
function marcarGest(id,on){ if(on) selGest.add(id); else selGest.delete(id); pintarGestSup(); }
function marcarGestTodos(on){ gestSupLista().slice(0,20).filter(c=>!c._virtual).forEach(c=>{ if(on) selGest.add(c._id); else selGest.delete(c._id); }); pintarGestSup(); }
async function regresarPorTipi(){
  const t=$('gsRegTi').value; if(!t) return toast('Elige la codificación');
  const n=Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi===t).length; if(!n) return toast('No hay gestionados con esa codificación');
  if(!await confirmar(\`¿Regresar a disponibles los \${n.toLocaleString('es-CO')} casos gestionados como «\${t}»? Vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».\`,{titulo:'Regresar a disponibles',ok:'Regresar'})) return;
  const r=await accion(()=>API.regresar({tipi:t}),'No se pudo regresar');
  await refrescar(); selGest.clear(); pintarGestSup(); if(r) toast(\`\${r.regresados} casos regresados a disponibles\`);
}
async function regresarSel(){
  const ids=[...selGest]; if(!ids.length) return toast('Marca al menos un caso');
  if(!await confirmar(\`¿Regresar a disponibles los \${ids.length} casos marcados? Vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».\`,{titulo:'Regresar a disponibles',ok:'Regresar'})) return;
  const r=await accion(()=>API.regresar({numeros:ids}),'No se pudo regresar');
  await refrescar(); selGest.clear(); pintarGestSup(); if(r) toast(\`\${r.regresados} casos regresados a disponibles\`);
}`);
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
// Fase STA (prueba del 21/11): colores fijos de las gráficas -> variables del tema (en claro, los mismos de Edwin).
js = todas(js, 'fill="#f2f5f7"', 'style="fill:var(--sta-carril,#f2f5f7)"');
js = todas(js, 'fill:#003C50', 'fill:var(--sta-titulo,#003C50)');
js = todas(js, 'fill:#6b7c86', 'fill:var(--muted)');
js = todas(js, 'stroke="#fff" stroke-width="2"', 'style="stroke:var(--card)" stroke-width="2"');
M('<input class="inp" id="agBuscar" ', '<input class="inp" id="agBuscar" aria-label="Buscar en mi bandeja" ');
M('<input class="inp" id="agGestBuscar" ', '<input class="inp" id="agGestBuscar" aria-label="Buscar por número de autorización" ');
L('<input type="date" class="inp" id="codRellF">', '<input type="date" class="inp" id="codRellF" aria-label="Fecha para volver a llamar">');
L('<input type="time" class="inp" id="codRellH">', '<input type="time" class="inp" id="codRellH" aria-label="Hora para volver a llamar">');
L('<select class="inp" id="dest_${a.id}" ', '<select class="inp" id="dest_${a.id}" aria-label="Pasar a otro agente" ');
L('<input type="checkbox" ${todos?', '<input type="checkbox" aria-label="Seleccionar todos" ${todos?');
L('<input type="checkbox" ${sel.has(c._id)?', '<input type="checkbox" aria-label="Seleccionar ${esc(c[\'Numero Autorizacion\'])}" ${sel.has(c._id)?');
L('<input class="inp" placeholder="Buscar…" ', '<input class="inp" aria-label="Buscar opciones" placeholder="Buscar…" ');
L('<input class="inp" id="dlgIn" ', '<input class="inp" id="dlgIn" aria-label="${esc(titulo)}" ');

// 8b) Seguridad (revisión del 23/11): el número del caso viene del Excel que se sube. Dentro de un
// manejador en línea, esc() no basta: el navegador decodifica &#39; y la comilla rompe el string de JS.
// Se pasa como texto JSON (comillas y barras escapadas) y después se escapa para HTML: jsArg().
L("const esc = s => String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));",
  "const esc = s => String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst jsArg = v => esc(JSON.stringify(String(v??'')));");
js = todas(js, "'${esc(c._id)}'", '${jsArg(c._id)}', 1);
js = todas(js, "'${esc(id)}'", '${jsArg(id)}', 1);
{
  const m = js.match(/on(?:click|change|input|keydown)=\\?"[^"]*'\$\{esc\(/);
  if (m) throw new Error('quedó un valor con esc() dentro de un string de un manejador en línea: ' + m[0].slice(0, 80));
}

// 8c) Asignar, filtros Entidad / Servicio / Descripción CUPS (pendiente del 23/11: Isa vio en «Servicio»
// opciones como Audífonos que no correspondían). Causa: opciones() contaba TODOS los casos libres, sin
// los otros filtros puestos; con una Entidad elegida, «Servicio» seguía ofreciendo servicios que esa
// entidad no tiene (y sus conteos eran de toda la base), y al marcarlos no salía ningún caso.
// Ahora cada lista sale de los casos libres que pasan los DEMÁS filtros (los suyos no), como en un
// filtro en cascada; una opción ya marcada que se queda sin casos se sigue mostrando (con 0) para poder
// quitarla. msNormalizar compara los valores, no solo el tamaño.
L(`function filtrar(){
  const d=x=>x?x:null;
  return disponibles().filter(c=>{
    if(F.ent && !F.ent.has(c['Entidad']||'')) return false;
    if(F.serv && !F.serv.has(c['Servicio']||'')) return false;
    if(F.cups && !F.cups.has(c['Descripcion Cups']||'')) return false;`, `function filtrar(sin){ // sin: filtro de lista que no se aplica (para armar sus propias opciones)
  return disponibles().filter(c=>{
    if(sin!=='ent' && F.ent && !F.ent.has(c['Entidad']||'')) return false;
    if(sin!=='serv' && F.serv && !F.serv.has(c['Servicio']||'')) return false;
    if(sin!=='cups' && F.cups && !F.cups.has(c['Descripcion Cups']||'')) return false;`);
L(`function opciones(campo){ const m=new Map(); disponibles().forEach(c=>{ const v=c[campo]||''; m.set(v,(m.get(v)||0)+1); });`,
  `function opciones(campo){ const m=new Map(), k=Object.keys(MS_CAMPO).find(x=>MS_CAMPO[x]===campo);
  filtrar(k).forEach(c=>{ const v=c[campo]||''; m.set(v,(m.get(v)||0)+1); });
  if(k && F[k]) F[k].forEach(v=>{ if(!m.has(v)) m.set(v,0); });`);
L(`function msNormalizar(k){ if(F[k] && F[k].size===msTodos(k).length) F[k]=null; }`,
  `function msNormalizar(k){ const t=msTodos(k); if(F[k] && F[k].size===t.length && t.every(v=>F[k].has(v))) F[k]=null; }`);

// 8d) Pedidos de Edwin (llamada del 25/11/2026).
//   - Solo «En proceso» y «Sin contacto» se gestionan: un caso con otro Estado queda «Fuera de gestión»
//     (_estado 'fuera', server/orlant-sta.js) y no cuenta como sin asignar, pendiente ni asignado.
//   - «Actualizar estado»: un segundo cuadro junto a «Cargar base de datos» que recibe un Excel con
//     Numero Autorizacion y Estado; el servidor cambia el Estado de los casos existentes (los que no
//     existan se reportan y no se crean).
//   - «Agendas por asesor»: solo las asesoras con agendas o citas.
L("function disponibles(){ return Object.values(S.casos).filter(c=>!c._agente); }",
  "function disponibles(){ return Object.values(S.casos).filter(c=>!c._agente&&c._estado==='pendiente'); }");
L("const sinAsig=v.filter(c=>!c._agente).length, pend=v.filter(c=>c._agente&&c._estado==='pendiente').length, gest=v.filter(c=>c._estado==='gestionado').length;\n  $('kpisBase').innerHTML = [['Total en base',v.length],['Sin asignar',sinAsig],['Asignados pendientes',pend],['Gestionados',gest]]",
  "const sinAsig=v.filter(c=>!c._agente&&c._estado==='pendiente').length, pend=v.filter(c=>c._agente&&c._estado==='pendiente').length, gest=v.filter(c=>c._estado==='gestionado').length, fuera=v.filter(c=>c._estado==='fuera').length;\n  $('kpisBase').innerHTML = [['Total en base',v.length],['Sin asignar',sinAsig],['Asignados pendientes',pend],['Gestionados',gest],['Fuera de gestión',fuera]]");
L("const sin=l.filter(c=>!c._agente).length, pen=", "const sin=l.filter(c=>!c._agente&&c._estado==='pendiente').length, pen=");
L("o['Estado gestión']=!c._agente?'Sin asignar':", "o['Estado gestión']=c._estado==='fuera'?'Fuera de gestión':!c._agente?'Sin asignar':");
L("libres=v.filter(c=>!c._agente).length, pendT=", "libres=v.filter(c=>!c._agente&&c._estado==='pendiente').length, pendT=");
L("<small>Órdenes libres</small><b>${Object.values(S.casos).filter(c=>!c._agente).length", "<small>Órdenes libres</small><b>${Object.values(S.casos).filter(c=>!c._agente&&c._estado==='pendiente').length");
L("['Sin asignar',fmt(todos.filter(c=>!c._agente).length)]", "['Sin asignar',fmt(todos.filter(c=>!c._agente&&c._estado==='pendiente').length)],['Fuera de gestión',fmt(todos.filter(c=>c._estado==='fuera').length)]");
L("const C_UNIV={'Gestionado':'#2a78d6','Pendiente':'#eda100','Sin asignar':'#c3ccd1'};", "const C_UNIV={'Gestionado':'#2a78d6','Pendiente':'#eda100','Sin asignar':'#c3ccd1','Fuera de gestión':'#7a6a8f'};");
L("const est=c=> c._estado==='gestionado'?'Gestionado':(c._agente?'Pendiente':'Sin asignar');\n  const SER = ['Gestionado','Pendiente','Sin asignar'].map(n=>({nombre:n,color:C_UNIV[n]}));\n  const parte = c=>['Gestionado','Pendiente','Sin asignar'].indexOf(est(c));",
  "const est=c=> c._estado==='gestionado'?'Gestionado':c._estado==='fuera'?'Fuera de gestión':(c._agente?'Pendiente':'Sin asignar');\n  const SER = ['Gestionado','Pendiente','Sin asignar','Fuera de gestión'].map(n=>({nombre:n,color:C_UNIV[n]}));\n  const parte = c=>['Gestionado','Pendiente','Sin asignar','Fuera de gestión'].indexOf(est(c));");
L("Las barras se dividen en gestionado, pendiente y sin asignar.", "Las barras se dividen en gestionado, pendiente, sin asignar y fuera de gestión (Estado distinto de «En proceso» o «Sin contacto»).");
L("  if(!ases.length) $('grAgAs').innerHTML=vacioG('No hay asesores.');\n  else { const rows=ases.map(a=>{",
  "  const asesAg=ases.filter(a=>{ const o=dat(a.id); return o.e>0||o.citas>0; }); // pedido de Edwin 25/11: solo con agendas o citas\n  if(!asesAg.length) $('grAgAs').innerHTML=vacioG(ases.length?'Ninguna asesora tiene agendas ni citas con estos filtros.':'No hay asesores.');\n  else { const rows=asesAg.map(a=>{");
L("$('archivo').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarCarga(f); e.target.value=''; });",
  "$('archivo').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarCarga(f); e.target.value=''; });\n"
  + "const dropEst=$('dropEst');\n"
  + "['dragenter','dragover'].forEach(e=>dropEst.addEventListener(e,ev=>{ev.preventDefault();dropEst.classList.add('on');}));\n"
  + "['dragleave','drop'].forEach(e=>dropEst.addEventListener(e,ev=>{ev.preventDefault();dropEst.classList.remove('on');}));\n"
  + "dropEst.addEventListener('drop',ev=>{ const f=ev.dataTransfer.files[0]; if(f) procesarEstados(f); });\n"
  + "$('archivoEst').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarEstados(f); e.target.value=''; });");
L("function exportarExcel(){", `// Pedido de Edwin (25/11): «Actualizar estado». Lee Numero Autorizacion y Estado; el resto lo hace el servidor.
async function procesarEstados(file){
  const box=$('estadoMsg'); box.innerHTML=\`<div class="msg warn">Leyendo \${esc(file.name)}…</div>\`;
  let filas; try{ filas=await leerArchivo(file); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo leer el archivo: \${esc(e.message)}</div>\`; return; }
  const hi=filas.findIndex(r=>r.some(h=>normHeader(h)==='numero autorizacion'));
  if(hi<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Numero Autorizacion</b> en el archivo.</div>'; return; }
  const iN=filas[hi].findIndex(h=>normHeader(h)==='numero autorizacion'), iE=filas[hi].findIndex(h=>normHeader(h)==='estado');
  if(iE<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Estado</b> en el archivo.</div>'; return; }
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){ const f=filas[r]; if(!f || f.every(v=>v===''||v==null)) continue;
    const n=f[iN], e=f[iE]; objs.push({numero:typeof n==='number'?String(n):String(n??'').trim(), estado:String(e??'').trim()}); }
  if(!objs.length){ box.innerHTML='<div class="msg err">El archivo no tiene filas.</div>'; return; }
  box.innerHTML=\`<div class="msg warn">Actualizando \${objs.length.toLocaleString('es-CO')} estados…</div>\`;
  let R; try{ R=await API.estados(file.name, objs); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo actualizar: \${esc(e.message)}</div>\`; return; }
  await refrescar(); pintarBase();
  const cambios=Object.entries(R.cambios||{});
  box.innerHTML=\`<div class="msg ok">\${esc(R.mensaje)}.</div>\`
    + (cambios.length?\`<div class="msg ok" style="font-size:13px">\${cambios.map(([k,n])=>\`\${esc(k)}: <b>\${n}</b>\`).join(' · ')}</div>\`:'')
    + (R.sinNum||R.sinEstado||R.repetidos?\`<div class="msg warn">\${[R.sinNum?R.sinNum+' sin número':'',R.sinEstado?R.sinEstado+' sin estado':'',R.repetidos?R.repetidos+' repetidas en el archivo (cuenta la primera)':''].filter(Boolean).join(' · ')}.</div>\`:'')
    + (R.noExisten?\`<div class="msg err"><b>\${R.noExisten.toLocaleString('es-CO')}</b> números de autorización no existen en la base y no se crearon:<br><span class="sta-no-existen">\${R.noExistenLista.map(esc).join(', ')}\${R.noExisten>R.noExistenLista.length?' …':''}</span></div>\`:'');
}
function descargarPlantillaEstado(){
  if(typeof XLSX==='undefined'){ toast('No se pudo preparar el archivo de Excel'); return; }
  const ws=XLSX.utils.aoa_to_sheet([['Numero Autorizacion','Estado']]); ws['!cols']=[{wch:22},{wch:18}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Actualizar estado'); XLSX.writeFile(wb,'Plantilla_actualizar_estado_STA.xlsx');
}
function exportarExcel(){`);

// 8e) Pedidos de Edwin (25/11/2026, 2:45 p. m.): «Mes» (arranca en el mes actual; llena Desde/Hasta) y trazabilidad.
L("function limpiarGr(){ ['grAg','grEnt','grServ','grD','grH'].forEach(id=>$(id).value=''); pintarGraficas(); }",
  "function limpiarGr(){ ['grAg','grEnt','grServ','grD','grH','grMes'].forEach(id=>$(id).value=''); pintarGraficas(); }");
L("function llenarSelects(){", `const NOMBRE_MES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function mesActualSta(){ return ahora().slice(0,7); }
function rangoMes(m){ const [y,mm]=m.split('-').map(Number); const fin=new Date(y,mm,0).getDate(); return [m+'-01', m+'-'+p2(fin)]; }
function mesesConGestion(){ const s=new Set([mesActualSta()]); Object.values(S.casos).forEach(c=>{ if(c._fg) s.add(c._fg.slice(0,7)); (c._prev||[]).forEach(g=>{ if(g&&g.fg) s.add(String(g.fg).slice(0,7)); }); }); return [...s].filter(m=>/^[0-9]{4}-[0-9]{2}$/.test(m)).sort().reverse(); }
const mesIniciado={};
function llenarMeses(pref){ const sel=$(pref+'Mes'); if(!sel) return; const v=mesIniciado[pref]?sel.value:mesActualSta();
  sel.innerHTML=mesesConGestion().map(m=>\`<option value="\${m}">\${NOMBRE_MES[Number(m.slice(5,7))-1]} \${m.slice(0,4)}</option>\`).join('')+'<option value="">Todos los meses</option>';
  sel.value=v; if(!mesIniciado[pref]){ mesIniciado[pref]=true; ponerRango(pref, v); } }
function ponerRango(pref, m){ const r=m?rangoMes(m):['','']; $(pref+'D').value=r[0]; $(pref+'H').value=r[1]; }
function elegirMes(pref){ ponerRango(pref, $(pref+'Mes').value); if(pref==='gr') pintarGraficas(); else pintarGestSup(); }
function llenarSelects(){
  llenarMeses('gr'); llenarMeses('gs');`);
// Cambios de estado: del historial de cada caso (server/orlant-sta.js, aplicarEstado), con quién lo hizo.
L("function gestSupLista(){", `function cambiosEstado(){
  const q=$('gsQ').value.trim().toLowerCase(), d=$('gsD').value, h=$('gsH').value, out=[];
  Object.values(S.casos).forEach(c=>(c._hist||[]).forEach(x=>{ if(!x||!x.fecha||!(x.origen==='actualizar'||x.origen==='carga')) return;
    const f=String(x.fecha).slice(0,10); if((d&&f<d)||(h&&f>h)) return;
    if(q&&!String(c['Numero Autorizacion']).toLowerCase().includes(q)) return;
    out.push({c,x}); }));
  return out.sort((a,b)=>String(b.x.fecha).localeCompare(String(a.x.fecha)));
}
function pintarCambios(){
  const l=cambiosEstado(), max=50, box=$('gsCambios'); if(!box) return;
  if(!l.length){ box.innerHTML='<p class="muted" style="margin:0">No hay cambios de estado con estos filtros.</p>'; return; }
  box.innerHTML=\`<div class="tw"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Numero Autorizacion</th><th>Cambio</th><th>Efecto</th><th>Hecho por</th><th>Cómo</th></tr></thead><tbody>
    \${l.slice(0,max).map(({c,x})=>\`<tr><td class="nw">\${verFecha(x.fecha)}</td><td class="nw">\${String(x.fecha).slice(11,19)}</td><td class="nw">\${esc(c['Numero Autorizacion'])}</td><td>\${esc(x.de||'(vacío)')} → \${esc(x.a||'')}</td><td>\${x.sale?'Salió de la gestión'+(x.agente?' (era de '+esc(nombreAgente(String(x.agente)))+')':''):x.vuelve?'Volvió a disponibles':'—'}</td><td>\${esc(x.por||'—')}</td><td>\${x.origen==='actualizar'?'Actualizar estado':'Carga de la base'}</td></tr>\`).join('')}
  </tbody></table></div>\${l.length>max?\`<p class="muted" style="margin:8px 0 0;font-size:12px">Se muestran los \${max} más recientes de \${l.length.toLocaleString('es-CO')}. Usa el buscador o las fechas para acotar.</p>\`:''}\`;
}
function gestSupLista(){`);

// 8f) Pedido de Edwin (25/11/2026, 2:45 p. m.): histórico con gestión. Primero revisa (dryRun) y luego carga.
L("$('archivo').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarCarga(f); e.target.value=''; });",
  "$('archivo').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarCarga(f); e.target.value=''; });\n"
  + "const dropHist=$('dropHist');\n"
  + "['dragenter','dragover'].forEach(e=>dropHist.addEventListener(e,ev=>{ev.preventDefault();dropHist.classList.add('on');}));\n"
  + "['dragleave','drop'].forEach(e=>dropHist.addEventListener(e,ev=>{ev.preventDefault();dropHist.classList.remove('on');}));\n"
  + "dropHist.addEventListener('drop',ev=>{ const f=ev.dataTransfer.files[0]; if(f) revisarHistorico(f); });\n"
  + "$('archivoHist').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) revisarHistorico(f); e.target.value=''; });");
L("function exportarExcel(){", `let histPendiente=null;
async function revisarHistorico(file){
  const box=$('histMsg'); histPendiente=null; box.innerHTML=\`<div class="msg warn">Leyendo \${esc(file.name)}…</div>\`;
  let filas; try{ filas=await leerArchivo(file); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo leer el archivo: \${esc(e.message)}</div>\`; return; }
  const hi=filas.findIndex(r=>r.some(h=>normHeader(h)==='numero autorizacion'));
  if(hi<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Numero Autorizacion</b> en el archivo.</div>'; return; }
  const enc=filas[hi].map(normHeader), col=(...ns)=>enc.findIndex(h=>ns.includes(h));
  const iC=col('codificacion'), iO=col('observacion'), iF=col('fecha gestion','fecha'), iA=col('asesor');
  const faltan=[[iC,'CODIFICACION'],[iF,'FECHA GESTION'],[iA,'ASESOR']].filter(([i])=>i<0).map(([,n])=>n);
  if(faltan.length){ box.innerHTML=\`<div class="msg err">Faltan columnas de la gestión: <b>\${faltan.join(', ')}</b>.</div>\`; return; }
  const base=CAMPOS.map(c=>[c,enc.indexOf(normHeader(c))]);
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){ const f=filas[r]; if(!f || f.every(v=>v===''||v==null)) continue;
    const o={}; base.forEach(([c,i])=>{ let v=i<0?'':f[i]; if(CAMPOS_FECHA.includes(c)) v=aFecha(v); else if(v instanceof Date) v=isoLocal(v); else v=typeof v==='string'?v.trim():v; o[c]=v; });
    const fg=aFecha(f[iF]); o.fechaGestion=fg?String(fg).slice(0,10):''; o.codificacion=String(f[iC]??'').trim(); o.observacion=iO<0?'':(f[iO] instanceof Date?isoLocal(f[iO]).slice(0,10):String(f[iO]??'').trim()); o.asesor=String(f[iA]??'').trim();
    objs.push(o); }
  if(!objs.length){ box.innerHTML='<div class="msg err">El archivo no tiene filas.</div>'; return; }
  box.innerHTML=\`<div class="msg warn">Revisando \${objs.length.toLocaleString('es-CO')} filas…</div>\`;
  let R; try{ R=await API.historico(file.name, objs, true); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo revisar: \${esc(e.message)}</div>\`; return; }
  histPendiente={ nombre:file.name, objs };
  box.innerHTML=resumenHistorico(R)+(R.nuevos?\`<div class="fila" style="margin-top:8px"><button type="button" class="btn pri" onclick="STAapp.confirmarHistorico()">Cargar \${R.nuevos.toLocaleString('es-CO')} casos</button><button type="button" class="btn" onclick="STAapp.cancelarHistorico()">Cancelar</button></div>\`:'');
}
function resumenHistorico(R){
  const lista=(o)=>Object.entries(o||{}).sort((a,b)=>b[1]-a[1]).map(([k,n])=>\`\${esc(k)}: <b>\${n}</b>\`).join(' · ');
  return \`<div class="msg \${R.dryRun?'warn':'ok'}">\${esc(R.mensaje)}.</div>\`
    + (Object.keys(R.porEstado||{}).length?\`<div class="msg ok" style="font-size:13px">Por estado: \${lista(R.porEstado)}. Citas (Agenda InConexion = 1): <b>\${R.citas}</b>.</div>\`:'')
    + (R.sinAsesor?\`<div class="msg err">Asesoras sin usuario en la plataforma (no entran): \${lista(R.asesoresSinUsuario)}</div>\`:'')
    + (Object.keys(R.codificacionDesconocida||{}).length?\`<div class="msg warn">Codificaciones que no están en la lista: \${lista(R.codificacionDesconocida)}</div>\`:'')
    + (R.sinNum||R.sinFecha?\`<div class="msg warn">\${R.sinNum?R.sinNum+' sin número':''}\${R.sinNum&&R.sinFecha?' · ':''}\${R.sinFecha?R.sinFecha+' sin fecha de gestión':''}.</div>\`:'');
}
async function confirmarHistorico(){
  if(!histPendiente) return; const box=$('histMsg'), p=histPendiente; histPendiente=null;
  box.innerHTML=\`<div class="msg warn">Cargando \${esc(p.nombre)}…</div>\`;
  let R; try{ R=await API.historico(p.nombre, p.objs, false); }catch(e){ box.innerHTML=\`<div class="msg err">No se pudo cargar: \${esc(e.message)}</div>\`; return; }
  await refrescar(); pintarBase(); box.innerHTML=resumenHistorico(R);
}
function cancelarHistorico(){ histPendiente=null; $('histMsg').innerHTML='<div class="msg warn">No se cargó nada.</div>'; }
function exportarExcel(){`);

// 8g) Ajuste del usuario (25/11): la gestión del histórico de un caso que quedó disponible («En proceso» o
// «Sin contacto» con codificación) cuenta en las gráficas y en Gestionados, a nombre de su asesora y en su
// fecha, como una gestión «virtual» (no se puede marcar ni regresar: el caso ya está disponible).
L("function gestFiltradas(ag,d,h){ return Object.values(S.casos).filter(c=>c._estado==='gestionado' && (!ag||c._agente===ag) && (!d||c._fg.slice(0,10)>=d) && (!h||c._fg.slice(0,10)<=h)); }",
  "function gestHistCuenta(){ const out=[]; for(const c of Object.values(S.casos)) (c._prev||[]).forEach((p,i)=>{ if(p&&p.cuenta&&p.fg) out.push(Object.assign({},c,{_id:c._id+'#h'+i,_virtual:true,_estado:'gestionado',_agente:p.agente==null?null:String(p.agente),_tipi:p.tipi||'',_obs:p.obs||'',_fg:p.fg,_citas:p.citas||0,_rell:null})); }); return out; }\n"
  + "function gestFiltradas(ag,d,h){ return Object.values(S.casos).filter(c=>c._estado==='gestionado').concat(gestHistCuenta()).filter(c=>(!ag||c._agente===ag) && (!d||c._fg.slice(0,10)>=d) && (!h||c._fg.slice(0,10)<=h)); }");

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
//     (supervisor, asesor o cliente: solo «Gráficas», de solo lectura) la decide el servidor;
//   - sin agregar/renombrar/eliminar ni cambiar de agente (son los ASESOR de ORLANT), sin respaldo,
//     restaurar ni borrar todo; «Descargar» el Excel de cada carga;
//   - los manejadores en línea llaman a STAapp.<función> (un solo nombre global).
/* eslint-disable */
var STA_MARKUP = ${JSON.stringify(markup)};

function staCrearApp(ROOT, API, ABIERTO, CERRAR){
${js.trim()}

var STAapp = { ${nombres.join(', ')}, $: $ };
if (typeof window !== 'undefined') window.STAapp = STAapp;
return { iniciar: iniciar, refrescar: refrescar, vista: function(){ return VISTA; }, activar: function(){ if (typeof window !== 'undefined') window.STAapp = STAapp; } };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { STA_MARKUP: STA_MARKUP, staCrearApp: staCrearApp };
`;
fs.writeFileSync(path.join(repo, 'public/js/orlant-sta-app.js'), app);
fs.writeFileSync(path.join(repo, 'public/css/orlant-sta-app.css'), css);
console.log('css', css.length, 'markup', markup.length, 'js', js.length, 'funciones', nombres.length);
