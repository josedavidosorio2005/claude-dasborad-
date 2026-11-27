// orlant-sta-app.js — Fase STA: «Gestión STA» de ORLANT (HTML de Edwin dentro de la plataforma).
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
var STA_MARKUP = "<div class=\"sta-app\">\n<!-- ================= AGENTE ================= -->\n<section id=\"vAgente\" class=\"hidden\">\n  <header class=\"top\">\n    <div><div class=\"tit\">Visual de agente</div><div class=\"sub\" id=\"agNombreTop\"></div></div>\n    <div class=\"esp\"></div>\n    <button class=\"btn ghost sm\" onclick=\"STAapp.salir()\">Salir</button>\n  </header>\n  <div id=\"agElegir\" class=\"hidden\">\n    <main><div class=\"card\" style=\"max-width:460px;margin:40px auto\">\n      <h3>¿Quién eres?</h3>\n      <div id=\"agElegirLista\"></div>\n    </div></main>\n  </div>\n  <div id=\"agPanel\" class=\"hidden\">\n    <nav class=\"tabs\">\n      <button data-t=\"bandeja\" class=\"act\" onclick=\"STAapp.tabAgente('bandeja')\">Mi bandeja<span class=\"cnt\" id=\"cntBandeja\">0</span></button>\n      <button data-t=\"rellamadas\" onclick=\"STAapp.tabAgente('rellamadas')\">Volver a llamar<span class=\"cnt\" id=\"cntRell\">0</span></button>\n      <button data-t=\"gestionados\" onclick=\"STAapp.tabAgente('gestionados')\">Gestionados<span class=\"cnt\" id=\"cntGest\">0</span></button>\n    </nav>\n    <main>\n      <div id=\"tBandeja\">\n        <div class=\"fila\" style=\"margin-bottom:12px\">\n          <input class=\"inp\" id=\"agBuscar\" aria-label=\"Buscar en mi bandeja\" placeholder=\"Buscar por autorización, entidad, CUPS…\" style=\"width:340px\" oninput=\"STAapp.pintarBandeja()\">\n          <span class=\"muted\" id=\"agBuscarInfo\"></span>\n        </div>\n        <div id=\"agTabla\"></div>\n      </div>\n      <div id=\"tRellamadas\" class=\"hidden\"><div id=\"rellTabla\"></div></div>\n      <div id=\"tGestionados\" class=\"hidden\">\n        <div class=\"ag-gest\">\n          <div>\n            <div class=\"fila\" style=\"margin-bottom:10px\">\n              <input class=\"inp\" id=\"agGestBuscar\" aria-label=\"Buscar por número de autorización\" placeholder=\"Buscar por Numero Autorizacion\" style=\"width:300px\" oninput=\"STAapp.pintarGestionados()\">\n              <span class=\"muted\" id=\"agGestInfo\" style=\"font-size:13px\"></span>\n            </div>\n            <div id=\"agGestTabla\"></div>\n          </div>\n          <div id=\"agResumen\"></div>\n        </div>\n      </div>\n    </main>\n  </div>\n</section>\n\n<!-- ================= SUPERVISOR ================= -->\n<section id=\"vSupervisor\" class=\"hidden\">\n  <header class=\"top\">\n    <div><div class=\"tit\">Visual de supervisor</div><div class=\"sub\">Base, asignación y tipificaciones</div></div>\n    <div class=\"esp\"></div>\n    <button class=\"btn ghost sm\" onclick=\"STAapp.salir()\">Salir</button>\n  </header>\n  <nav class=\"tabs\">\n    <button data-t=\"base\" class=\"act\" onclick=\"STAapp.tabSup('base')\">Cargar base</button>\n    <button data-t=\"asignar\" onclick=\"STAapp.tabSup('asignar')\">Agentes y asignación</button>\n    <button data-t=\"graficas\" onclick=\"STAapp.tabSup('graficas')\">Gráficas</button>\n    <button data-t=\"gestionados\" onclick=\"STAapp.tabSup('gestionados')\">Gestionados</button>\n    <button data-t=\"tipis\" onclick=\"STAapp.tabSup('tipis')\">Tipificaciones</button>\n  </nav>\n  <main>\n    <!-- BASE -->\n    <div id=\"sBase\">\n      <div class=\"kpis\" id=\"kpisBase\"></div>\n      <div class=\"sta-cargas-dos\">\n      <div class=\"card sta-carga-base\">\n        <h3>Cargar base de datos</h3>\n        <p class=\"muted\" style=\"margin-top:0\">Puedes montar la base completa cada día. Los casos cuyo <b>Numero Autorizacion</b> ya exista no se vuelven a cargar.</p>\n        <div class=\"drop\" id=\"drop\" onclick=\"STAapp.$('archivo').click()\">\n          <b>Arrastra aquí el Excel</b> o haz clic para seleccionarlo<br><span class=\"muted\">.xlsx, .xls o .csv</span>\n        </div>\n        <div class=\"fila sta-plantilla\" style=\"margin-top:10px;align-items:center\"><span class=\"muted\" style=\"flex:1;min-width:200px\">¿Primera vez? Descarga la plantilla con las 8 columnas que pide la carga.</span><button class=\"btn sm\" type=\"button\" onclick=\"STAapp.descargarPlantilla()\">Descargar plantilla</button></div>\n        <input type=\"file\" id=\"archivo\" accept=\".xlsx,.xls,.csv\" class=\"hidden\">\n        <div id=\"cargaMsg\"></div>\n      </div>\n      <div class=\"card sta-act-estado\">\n        <h3>Actualizar estado</h3>\n        <p class=\"muted\" style=\"margin-top:0\">Excel con 2 columnas: <b>Numero Autorizacion</b> y <b>Estado</b>. Cambia el estado de los casos que ya están en la base; los que no existan se reportan y no se crean. Solo <b>En proceso</b> y <b>Sin contacto</b> se gestionan: con otro estado, el caso sale de asignados, pendientes y sin asignar.</p>\n        <div class=\"drop\" id=\"dropEst\" onclick=\"STAapp.$('archivoEst').click()\">\n          <b>Arrastra aquí el Excel</b> o haz clic para seleccionarlo<br><span class=\"muted\">.xlsx, .xls o .csv</span>\n        </div>\n        <div class=\"fila sta-plantilla\" style=\"margin-top:10px;align-items:center\"><span class=\"muted\" style=\"flex:1;min-width:200px\">Plantilla con las 2 columnas.</span><button class=\"btn sm\" type=\"button\" onclick=\"STAapp.descargarPlantillaEstado()\">Descargar plantilla</button></div>\n        <input type=\"file\" id=\"archivoEst\" accept=\".xlsx,.xls,.csv\" class=\"hidden\" aria-label=\"Archivo para actualizar estado\">\n        <div id=\"estadoMsg\"></div>\n      </div>\n      </div>\n      <div class=\"card sta-historico\">\n        <h3>Cargar histórico (con gestión)</h3>\n        <p class=\"muted\" style=\"margin-top:0\">Para los archivos de meses anteriores que ya traen la gestión: los campos de la base más <b>CODIFICACION</b>, <b>OBSERVACION</b>, <b>FECHA GESTION</b> (o FECHA) y <b>ASESOR</b>. Cárgalos del más reciente al más antiguo: una autorización que ya existe se rechaza. Primero se muestra la revisión; nada se guarda hasta que confirmes.</p>\n        <div class=\"drop\" id=\"dropHist\" onclick=\"STAapp.$('archivoHist').click()\">\n          <b>Arrastra aquí el Excel</b> o haz clic para seleccionarlo<br><span class=\"muted\">.xlsx, .xls o .csv</span>\n        </div>\n        <input type=\"file\" id=\"archivoHist\" accept=\".xlsx,.xls,.csv\" class=\"hidden\" aria-label=\"Archivo del histórico\">\n        <div id=\"histMsg\"></div>\n      </div>\n      <div class=\"card\">\n        <h3>Historial de cargas</h3>\n        <div id=\"histCargas\"></div>\n      </div>\n    </div>\n\n    <!-- ASIGNAR -->\n    <div id=\"sAsignar\" class=\"hidden\">\n      <div class=\"kpis\" id=\"kpisAsig\"></div>\n      <div class=\"asig\">\n        <div class=\"card\">\n          <h3>Agentes</h3>\n          <p class=\"muted\" style=\"margin-top:0;font-size:12px\">Los agentes son los usuarios ASESOR de ORLANT de la plataforma.</p>\n          <div class=\"ag-list\" id=\"agLista\"></div>\n        </div>\n        <div id=\"asigPanel\"></div>\n      </div>\n      <div class=\"card\" style=\"margin-top:16px\"><h3>Casos pendientes por agente</h3><p class=\"nota\" style=\"color:var(--muted);font-size:12px;margin:-6px 0 10px\">Da clic en un agente para ver su listado. Selecciona casos para devolverlos a disponibles o pasarlos a otro agente.</p><div id=\"pendTodos\"></div></div>\n    </div>\n\n    <!-- GRAFICAS -->\n    <div id=\"sGraficas\" class=\"hidden\">\n      <div class=\"card fila filtros-gr\">\n        <label class=\"f\">Agente<select class=\"inp\" id=\"grAg\" onchange=\"STAapp.pintarGraficas()\"></select></label>\n        <label class=\"f\">Entidad<select class=\"inp\" id=\"grEnt\" onchange=\"STAapp.pintarGraficas()\"></select></label>\n        <label class=\"f\">Servicio<select class=\"inp\" id=\"grServ\" onchange=\"STAapp.pintarGraficas()\"></select></label>\n        <label class=\"f\">Mes<select class=\"inp\" id=\"grMes\" aria-label=\"Mes de gestión\" onchange=\"STAapp.elegirMes('gr')\"></select></label>\n        <label class=\"f\">Gestión desde<input type=\"date\" class=\"inp\" id=\"grD\" onchange=\"STAapp.pintarGraficas()\"></label>\n        <label class=\"f\">hasta<input type=\"date\" class=\"inp\" id=\"grH\" onchange=\"STAapp.pintarGraficas()\"></label>\n        <button class=\"btn\" style=\"align-self:flex-end\" onclick=\"STAapp.limpiarGr()\">Limpiar</button>\n        <span style=\"flex:1\"></span>\n        <span class=\"muted\" style=\"align-self:flex-end;font-size:12px\" id=\"grEfInfo\"></span>\n      </div>\n      <div class=\"kpis\" id=\"grKpis\"></div>\n\n      <div class=\"sec-gest\">\n        <div class=\"sec-h\"><span class=\"pill\">Gestión</span><div><h2>Gestión de los asesores</h2><p>Lo que se está gestionando según los filtros de arriba</p></div></div>\n        <div class=\"card\"><h3>Agendas por asesor</h3><p class=\"nota\">Casos agendados por cada asesor y citas que dio</p><div id=\"grAgAs\"></div></div>\n        <div class=\"gr-grid\">\n          <div class=\"card\"><h3>Agendas por entidad</h3><p class=\"nota\">Agendas de las gestiones efectivas, por entidad</p><div id=\"grAgEnt\"></div></div>\n          <div class=\"card\"><h3>Agendas por servicio</h3><p class=\"nota\">Agendas de las gestiones efectivas, por servicio</p><div id=\"grAgServ\"></div></div>\n          <div class=\"card\"><h3>Codificación general</h3><p class=\"nota\">Distribución de todas las gestiones por tipificación</p><div id=\"grDona\"></div></div>\n          <div class=\"card\"><h3>Gestiones por entidad</h3><p class=\"nota\">Casos codificados por entidad</p><div id=\"grGeEnt\"></div></div>\n          <div class=\"card\"><h3>Gestiones por servicio</h3><p class=\"nota\">Casos codificados por servicio</p><div id=\"grGeServ\"></div></div>\n          <div class=\"card\"><h3>Efectividad por asesor</h3><p class=\"nota\">Citas brindadas ÷ casos gestionados por el asesor</p><div id=\"grEfec\"></div></div>\n          <div class=\"card ancho\"><h3>Gestiones por día</h3><p class=\"nota\">Casos codificados y citas dadas cada día hábil</p><div id=\"grDia\"></div></div>\n        </div>\n      </div>\n\n      <div class=\"gr-sec\">\n        <div class=\"sec-h\"><span class=\"pill base\">Base</span><div><h2>Análisis por campos de la base</h2><p class=\"nota\" id=\"univInfo\"></p></div></div>\n      </div>\n      <div class=\"gr-grid\">\n        <div class=\"card\"><h3>Por Entidad</h3><div id=\"grEnt2\"></div></div>\n        <div class=\"card\"><h3>Por Servicio</h3><div id=\"grServ2\"></div></div>\n        <div class=\"card\"><h3>Por Estado</h3><div id=\"grEst\"></div></div>\n        <div class=\"card\"><h3>Por Descripción CUPS</h3><p class=\"nota\">Las 10 con más casos</p><div id=\"grCups\"></div></div>\n      </div>\n    </div>\n\n    <!-- GESTIONADOS -->\n    <div id=\"sGestionados\" class=\"hidden\">\n      <div class=\"card fila\" style=\"padding:12px 16px\">\n        <label class=\"f\">Buscar<input class=\"inp\" id=\"gsQ\" placeholder=\"Numero Autorizacion\" oninput=\"STAapp.pintarGestSup()\"></label>\n        <label class=\"f\">Agente<select class=\"inp\" id=\"gsAg\" onchange=\"STAapp.pintarGestSup()\"></select></label>\n        <label class=\"f\">Codificación<select class=\"inp\" id=\"gsTi\" onchange=\"STAapp.pintarGestSup()\"></select></label>\n        <label class=\"f\">Mes<select class=\"inp\" id=\"gsMes\" aria-label=\"Mes de gestión\" onchange=\"STAapp.elegirMes('gs')\"></select></label>\n        <label class=\"f\">Desde<input type=\"date\" class=\"inp\" id=\"gsD\" onchange=\"STAapp.pintarGestSup()\"></label>\n        <label class=\"f\">Hasta<input type=\"date\" class=\"inp\" id=\"gsH\" onchange=\"STAapp.pintarGestSup()\"></label>\n        <span style=\"flex:1\"></span>\n        <button class=\"btn pri\" style=\"align-self:flex-end\" onclick=\"STAapp.exportarGestionados()\">Exportar a Excel</button>\n      </div>\n      <div class=\"card fila gs-regresar\" style=\"padding:12px 16px\">\n        <label class=\"f\">Regresar a disponibles por codificación<select class=\"inp\" id=\"gsRegTi\"></select></label>\n        <button class=\"btn\" style=\"align-self:flex-end\" onclick=\"STAapp.regresarPorTipi()\">Regresar todos</button>\n        <span style=\"flex:1\"></span>\n        <button class=\"btn\" style=\"align-self:flex-end\" id=\"gsRegSelBtn\" onclick=\"STAapp.regresarSel()\" disabled>Regresar marcados</button>\n      </div>\n      <p class=\"muted\" style=\"margin:-4px 0 10px;font-size:12px\">Los casos vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».</p>\n      <p class=\"muted\" id=\"gsInfo\" style=\"margin:0 0 10px\"></p>\n      <div id=\"gsTabla\"></div>\n      <div class=\"card sta-cambios\" style=\"margin-top:16px\">\n        <h3>Cambios de estado</h3>\n        <p class=\"muted\" style=\"margin-top:0;font-size:12px\">Lo que cambió «Actualizar estado» o la carga de la base, con quién lo hizo (no la asesora). El buscador de arriba filtra por Numero Autorizacion.</p>\n        <div id=\"gsCambios\"></div>\n      </div>\n    </div>\n\n    <!-- TIPIS -->\n    <div id=\"sTipis\" class=\"hidden\">\n      <div class=\"card\" style=\"max-width:620px\">\n        <h3>Tipificaciones para codificar</h3>\n        <p class=\"muted\" style=\"margin-top:0\">Estas son las opciones que verá el agente al codificar un caso. Marca como <b>efectiva</b> las que cuentan como agenda: al elegirlas, el agente debe escribir la cantidad de citas agendadas, y cuentan como agenda en las gráficas.</p>\n        <div class=\"fila\" style=\"margin-bottom:14px;flex-wrap:nowrap\">\n          <input class=\"inp\" id=\"nuevaTipi\" aria-label=\"Nueva tipificación\" placeholder=\"Nueva tipificación\" style=\"flex:1\" onkeydown=\"if(event.key==='Enter')STAapp.crearTipi()\">\n          <button class=\"btn pri\" onclick=\"STAapp.crearTipi()\">Agregar</button>\n        </div>\n        <div id=\"tipiLista\"></div>\n      </div>\n    </div>\n  </main>\n</section>\n\n<div id=\"modal\"></div>\n<div id=\"dlg\"></div>\n<div id=\"toast\"></div>\n<div id=\"tip\"></div>\n<div id=\"avisoRell\">📞 Tienes una llamada por devolver. Te la muestro al terminar esta gestión.</div>\n</div>";

function staCrearApp(ROOT, API, ABIERTO, CERRAR){
/* =====================================================================
   Almacenamiento (IndexedDB, un solo registro con todo el estado)
===================================================================== */
const CAMPOS = ['Fecha Ingreso Sta','Entidad','Numero Autorizacion','Estado','Descripcion Cups','Fecha Autorizacion','Fecha Expiracion','Servicio'];
const CAMPOS_FECHA = ['Fecha Ingreso Sta','Fecha Autorizacion','Fecha Expiracion'];
const TIPIS_BASE = ['Agendado','No contesta','Número errado','Rechaza','Volver a llamar','Ya agendado'];
let S = null;

function estadoVacio(){ return {agentes:[], tipis:TIPIS_BASE.slice(), efectivas:['Agendado'], casos:{}, cargas:[], columnas:CAMPOS.slice(), seq:1}; }

/* Fase STA: lo que guardaba IndexedDB vive en el servidor (API /api/orlant/sta, server/orlant-sta.js). */
let VISTA = null, YO = null;
async function cargarEstado(){
  const r = await API.estado();
  VISTA = r.vista;
  const cfg = r.config || {};
  S = { agentes:(r.agentes||[]).map(a=>({id:String(a.id),nombre:a.nombre,activo:a.activo!==false})), tipis:(cfg.tipis||[]).slice(), efectivas:(cfg.efectivas||[]).slice(),
        columnas:(cfg.columnas||CAMPOS).slice(), casos:{}, cargas:(r.cargas||[]).map(c=>Object.assign({},c,{id:String(c.id)})).reverse(), seq:1 };
  for(const c of (r.casos||[])){ c._agente = c._agente==null ? null : String(c._agente); c._cargaId = c._cargaId==null ? null : String(c._cargaId); S.casos[c._id]=c; }
  if(VISTA==='asesor' && r.yo){ YO=r.yo; S.agentes=[{id:String(r.yo.id),nombre:r.yo.nombre,activo:true}]; agenteActual=String(r.yo.id); }
  // STA14: gestiones del histórico que cuentan a nombre de esta asesora (el caso puede estar disponible o con otra).
  S.histCuenta = VISTA==='asesor' ? (r.histCuenta||[]).map((h,i)=>({_id:'h'+i,_virtual:true,_estado:'gestionado',_agente:agenteActual,'Numero Autorizacion':h.numero,_tipi:h.tipi||'',_fg:h.fg,_citas:h.citas||0})) : [];
}
// Cada acción guarda con su propia llamada a la API; esto solo vuelve a pintar con lo del servidor.
async function accion(fn, msgError){ try{ return await fn(); }catch(e){ toast((msgError||'No se pudo guardar')+': '+e.message); return null; } }
// relee antes de cada acción para no pisar cambios de otra pestaña abierta en el mismo PC
async function refrescar(){ try{ await cargarEstado(); }catch(e){ toast('No se pudo leer Gestión STA: '+e.message); } }

/* =====================================================================
   Utilidades
===================================================================== */
const $ = id => ROOT.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsArg = v => esc(JSON.stringify(String(v??'')));
const p2 = n => String(n).padStart(2,'0');
function isoLocal(d){ return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }
function ahora(){ return isoLocal(new Date()); }
function aFecha(v){
  if(v==null||v==='') return '';
  if(v instanceof Date && !isNaN(v)) return isoLocal(v);
  if(typeof v==='number'){ const d=XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${p2(d.m)}-${p2(d.d)} ${p2(d.H)}:${p2(d.M)}:${p2(Math.floor(d.S))}`; }
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m) return `${m[3]}-${p2(m[2])}-${p2(m[1])} ${p2(m[4]||0)}:${p2(m[5]||0)}:${p2(m[6]||0)}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}`;
  return s;
}
function verFecha(s, conHora){
  if(!s) return '';
  const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/); if(!m) return esc(s);
  const f=`${m[3]}/${m[2]}/${m[1]}`;
  return (conHora && !(m[4]==='00'&&m[5]==='00')) ? `${f} ${m[4]}:${m[5]}` : f;
}
function verValor(c,v){ return CAMPOS_FECHA.includes(c) ? verFecha(v, c==='Fecha Ingreso Sta') : esc(v); }
function normClave(v){ return String(v??'').trim().replace(/\.0+$/,''); }
function normHeader(h){ return String(h??'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase().replace(/\s+/g,' '); }
let tt; function toast(t){ const e=$('toast'); e.textContent=t; e.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>e.classList.remove('on'),3200); }
function nombreAgente(id){ const a=S.agentes.find(x=>x.id===id); return a?a.nombre:'—'; }
function cerrarModal(){ $('modal').innerHTML=''; if(agenteActual) setTimeout(revisarRellamadas,600); }
/* Ventanas propias (reemplazan confirm/prompt del navegador, que algunos entornos bloquean) */
function dialogo({titulo='Confirmar',mensaje='',ok='Aceptar',peligro=false,input=null,placeholder=''}){
  return new Promise(res=>{
    const box=$('dlg');
    box.innerHTML=`<div class="modal-bg" style="z-index:80"><div class="modal" style="width:min(440px,100%)">
      <header><h3>${esc(titulo)}</h3><button class="x" data-r="no">×</button></header>
      <div class="bd"><p style="margin:0 0 ${input!==null?'12px':'0'}">${mensaje}</p>${input!==null?`<input class="inp" id="dlgIn" aria-label="${esc(titulo)}" style="width:100%" placeholder="${esc(placeholder)}" value="${esc(input)}">`:''}</div>
      <footer><button class="btn" data-r="no">Cancelar</button><button class="btn ${peligro?'':'pri'}" data-r="si" ${peligro?'style="background:var(--red);color:#fff;border-color:var(--red)"':''}>${esc(ok)}</button></footer>
    </div></div>`;
    const fin=v=>{ box.innerHTML=''; document.removeEventListener('keydown',tec); res(v); };
    const valor=()=> input!==null ? $('dlgIn').value : true;
    const tec=e=>{ if(e.key==='Escape') fin(input!==null?null:false); if(e.key==='Enter') fin(valor()); };
    document.addEventListener('keydown',tec);
    box.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=> fin(b.dataset.r==='si' ? valor() : (input!==null?null:false)));
    const f=$('dlgIn'); if(f){ f.focus(); f.select(); } else box.querySelector('[data-r=si]').focus();
  });
}
const confirmar=(mensaje,o={})=>dialogo({mensaje:esc(mensaje),...o});
const pedirTexto=(titulo,valor='',o={})=>dialogo({titulo,input:valor,...o});

/* =====================================================================
   Navegación
===================================================================== */
let agenteActual = null; const TITULO=document.title;
function mostrar(id){ ['vAgente','vSupervisor'].forEach(x=>$(x).classList.toggle('hidden',x!==id)); }
function salir(){ CERRAR(); }
async function iniciar(){ await cargarEstado(); ROOT.querySelector('.sta-app').classList.toggle('sta-cliente', VISTA==='cliente'); if(VISTA==='cliente'){ mostrar('vSupervisor'); tabSup('graficas'); } else if(VISTA==='supervisor'){ mostrar('vSupervisor'); tabSup('base'); } else { mostrar('vAgente'); abrirPanelAgente(); } }


/* =====================================================================
   VISUAL AGENTE
===================================================================== */


function abrirPanelAgente(){
  $('agElegir').classList.add('hidden'); $('agPanel').classList.remove('hidden');
  try{ if(window.Notification && Notification.permission==='default') Notification.requestPermission(); }catch(e){}
  $('agNombreTop').textContent = nombreAgente(agenteActual);
  tabAgente('bandeja'); setTimeout(revisarRellamadas,800);
}
function tabAgente(t){
  ROOT.querySelectorAll('#agPanel nav.tabs button').forEach(b=>b.classList.toggle('act',b.dataset.t===t));
  $('tBandeja').classList.toggle('hidden',t!=='bandeja'); $('tGestionados').classList.toggle('hidden',t!=='gestionados'); $('tRellamadas').classList.toggle('hidden',t!=='rellamadas');
  pintarBandeja(); pintarGestionados(); pintarRellamadas();
}
function misPendientes(){ return Object.values(S.casos).filter(c=>c._agente===agenteActual && c._estado==='pendiente')
  .sort((a,b)=>(a['Fecha Ingreso Sta']||'').localeCompare(b['Fecha Ingreso Sta']||'')); }
function pintarBandeja(){
  const todos=misPendientes(); $('cntBandeja').textContent=todos.length;
  const q=($('agBuscar').value||'').toLowerCase().trim();
  const lista=q? todos.filter(c=>S.columnas.some(k=>String(c[k]??'').toLowerCase().includes(q))) : todos;
  $('agBuscarInfo').textContent = q? `${lista.length} de ${todos.length}` : '';
  if(!todos.length){ $('agTabla').innerHTML=`<div class="card vacio">No tienes casos pendientes en tu bandeja.</div>`; return; }
  $('agTabla').innerHTML = `<div class="tw"><table><thead><tr><th></th>${S.columnas.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Asignado</th></tr></thead><tbody>
    ${lista.map(c=>`<tr><td><button class="btn pri sm" onclick="STAapp.abrirCodificar(${jsArg(c._id)})">Codificar</button></td>
      ${S.columnas.map(k=>`<td class="${CAMPOS_FECHA.includes(k)||k==='Numero Autorizacion'?'nw':''}">${verValor(k,c[k])}</td>`).join('')}
      <td class="nw">${verFecha(c._asignado,true)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function abrirCodificar(id){
  const c=S.casos[id]; if(!c) return;
  const prev=c._rell&&c._rell.estado==='pendiente' ? `<div class="msg warn" style="margin:0 0 14px">Rellamada programada para <b>${verFecha(c._rell.cuando,true)}</b>. Gestión anterior: <b>${esc(c._tipi)}</b> — ${esc(c._obs||'')}</div>` : '';
  $('modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)STAapp.cerrarModal()"><div class="modal">
    <header><h3>Codificar caso · ${esc(c['Numero Autorizacion'])}</h3><button class="x" onclick="STAapp.cerrarModal()">×</button></header>
    <div class="bd">
      ${prev}<div class="datos">${S.columnas.map(k=>`<div><small>${esc(k)}</small>${verValor(k,c[k])||'<span class="muted">—</span>'}</div>`).join('')}</div>
      <div class="grid-f">
        <label class="f">Tipificación *<select class="inp" id="codTipi" onchange="STAapp.cambioTipi()"><option value="">Selecciona…</option>${S.tipis.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label>
        <label class="f hidden" id="codCitasBox">Cantidad de citas agendadas *<input type="number" min="1" step="1" class="inp" id="codCitas" placeholder="Ej: 1"></label>
        <div class="f hidden" id="codRellBox">¿Cuándo debes volver a llamar? *<div class="rango"><input type="date" class="inp" id="codRellF" aria-label="Fecha para volver a llamar"><input type="time" class="inp" id="codRellH" aria-label="Hora para volver a llamar"></div></div>
      </div>
      <label class="f" style="margin-top:14px">Observación *<textarea class="inp" id="codObs" rows="3" placeholder="Describe lo que pasó en la llamada"></textarea></label>
      <p class="muted" style="font-size:12px;margin-bottom:0">La fecha y hora se registran automáticamente al guardar.</p>
    </div>
    <footer><button class="btn" onclick="STAapp.cerrarModal()">Cancelar</button><button class="btn ok" onclick="STAapp.guardarCodificacion(${jsArg(id)})">Guardar gestión</button></footer>
  </div></div>`;
}
function pideCitas(t){ return S.efectivas.includes(t); }
function esVolver(t){ return normHeader(t).includes('volver a llamar'); }
function cambioTipi(){ const t=$('codTipi').value, on=pideCitas(t), rl=esVolver(t);
  $('codCitasBox').classList.toggle('hidden',!on); if(on){ $('codCitas').focus(); } else $('codCitas').value='';
  $('codRellBox').classList.toggle('hidden',!rl);
  if(rl && !$('codRellF').value){ $('codRellF').value=ahora().slice(0,10); $('codRellH').focus(); } }
async function guardarCodificacion(id){
  const tipi=$('codTipi').value, obs=$('codObs').value.trim();
  if(!tipi) return toast('Selecciona una tipificación');
  let cuando='';
  if(esVolver(tipi)){ const f=$('codRellF').value, h=$('codRellH').value;
    if(!f||!h){ (f?$('codRellH'):$('codRellF')).focus(); return toast('Indica la fecha y la hora para volver a llamar'); }
    cuando=`${f} ${h}:00`; if(cuando<=ahora()){ $('codRellH').focus(); return toast('La hora para volver a llamar debe ser posterior a la hora actual'); } }
  if(!obs){ $('codObs').focus(); return toast('La observación es obligatoria'); }
  let citas=0;
  if(pideCitas(tipi)){ citas=Number($('codCitas').value);
    if(!Number.isInteger(citas)||citas<1){ $('codCitas').focus(); return toast('Escribe la cantidad de citas agendadas (mínimo 1)'); } }
  try{ await API.codificar(id,{tipi,obs,citas,cuando}); }
  catch(e){ if(e.status===409){ cerrarModal(); await refrescar(); pintarBandeja(); } return toast(e.status===409?'Este caso ya no está en tu bandeja':'No se pudo guardar: '+e.message); }
  await refrescar(); cerrarModal(); pintarBandeja(); pintarGestionados(); pintarRellamadas();
  toast(cuando?`Gestión registrada. Te avisaré el ${verFecha(cuando,true)} para volver a llamar`:'Gestión registrada');
}
/* ---------- Volver a llamar ---------- */
function misRell(){ return Object.values(S.casos).filter(c=>c._agente===agenteActual&&c._rell&&c._rell.estado==='pendiente').sort((a,b)=>a._rell.cuando.localeCompare(b._rell.cuando)); }
function pintarRellamadas(){
  if(!agenteActual) return;
  const l=misRell(), now=ahora(); $('cntRell').textContent=l.length;
  const venc=l.filter(c=>c._rell.cuando<=now).length;
  $('cntRell').style.background = venc?'var(--red)':''; $('cntRell').style.color = venc?'#fff':'';
  $('rellTabla').innerHTML = !l.length ? `<div class="card vacio">No tienes llamadas pendientes por devolver.</div>` :
    `<div class="tw"><table><thead><tr><th></th><th>Llamar el</th><th>Numero Autorizacion</th><th>Entidad</th><th>Descripcion Cups</th><th>Observación anterior</th></tr></thead><tbody>
    ${l.map(c=>{ const v=c._rell.cuando<=now; return `<tr><td><button class="btn ${v?'ok':'pri'} sm" onclick="STAapp.abrirCodificar(${jsArg(c._id)})">Gestionar</button></td>
      <td class="nw">${v?'<span class="tag" style="background:#fbe5e5;color:#8d2626">Ahora</span> ':''}${verFecha(c._rell.cuando,true)}</td><td class="nw">${esc(c['Numero Autorizacion'])}</td><td>${esc(c['Entidad'])}</td><td>${esc(c['Descripcion Cups'])}</td><td>${esc(c._obs)}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}
let sonando=null;
function pitar(){ try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); [0,0.35,0.7].forEach(t=>{ const o=ctx.createOscillator(), g=ctx.createGain();
  o.frequency.value=880; g.gain.setValueAtTime(0.0001,ctx.currentTime+t); g.gain.exponentialRampToValueAtTime(0.3,ctx.currentTime+t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+t+0.25);
  o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.3); }); }catch(e){} }
async function revisarRellamadas(){
  if(!ABIERTO() || !agenteActual || $('vAgente').classList.contains('hidden')) return;
  try{ await refrescar(); }catch(e){ return; }
  pintarRellamadas();
  if($('dlg').innerHTML || ROOT.querySelector('#alertaRell')) return;
  const now=ahora(), c=misRell().find(x=>x._rell.cuando<=now && !x._rell.avisado);
  // si el asesor está codificando, no interrumpir: aviso discreto y la alerta sale al terminar
  const ocupado=!!$('modal').innerHTML;
  const aviso=$('avisoRell');
  if(!c || ocupado){ if(aviso) aviso.classList.toggle('on', !!c && ocupado); return; }
  if(aviso) aviso.classList.remove('on');
  pitar();
  try{ if(window.Notification && Notification.permission==='granted') new Notification('Debes volver a llamar',{body:`${c['Numero Autorizacion']} · ${c['Entidad']||''}\n${c._obs||''}`}); }catch(e){}
  let flip=false; clearInterval(sonando); sonando=setInterval(()=>{ document.title=(flip=!flip)?'📞 ¡Volver a llamar!':TITULO; },900);
  const box=document.createElement('div'); box.id='alertaRell';
  box.innerHTML=`<div class="modal-bg" style="z-index:85"><div class="modal" style="width:min(520px,100%);border-top:6px solid var(--red)">
    <header><h3>📞 Debes volver a llamar</h3></header>
    <div class="bd"><p style="margin-top:0">Programado para <b>${verFecha(c._rell.cuando,true)}</b></p>
      <div class="datos"><div><small>Numero Autorizacion</small>${esc(c['Numero Autorizacion'])}</div><div><small>Entidad</small>${esc(c['Entidad'])}</div>
      <div><small>Descripcion Cups</small>${esc(c['Descripcion Cups'])}</div><div><small>Servicio</small>${esc(c['Servicio'])}</div></div>
      <p style="margin:0"><small class="muted">Observación anterior</small><br>${esc(c._obs)}</p></div>
    <footer><button class="btn" data-a="pos">Recordar en 10 min</button><button class="btn ok" data-a="ya">Gestionar ahora</button></footer></div></div>`;
  ROOT.querySelector(".sta-app").appendChild(box);
  const cerrar=async(acc)=>{ box.remove(); clearInterval(sonando); document.title=TITULO;
    await accion(()=>API.rellamada(c._id, acc)); await refrescar(); pintarRellamadas(); if(acc==='ya'){ tabAgente('rellamadas'); abrirCodificar(c._id); } };
  box.querySelector('[data-a=pos]').onclick=()=>cerrar('pos'); box.querySelector('[data-a=ya]').onclick=()=>cerrar('ya');
}
setInterval(revisarRellamadas,20000);

function pintarGestionados(){
  const todos=Object.values(S.casos).filter(c=>c._agente===agenteActual && c._estado==='gestionado').concat(S.histCuenta||[]).sort((a,b)=>b._fg.localeCompare(a._fg));
  $('cntGest').textContent=todos.length;
  // resumen del asesor
  const citas=todos.reduce((t,c)=>t+(c._citas||0),0), ag=todos.filter(c=>S.efectivas.includes(c._tipi)).length;
  const hoy=ahora().slice(0,10), hoyL=todos.filter(c=>c._fg.startsWith(hoy));
  if(!todos.length) $('agResumen').innerHTML='';
  else{
    const cnt=agrupar(todos,c=>c._tipi,7);
    $('agResumen').innerHTML=`<div class="card"><h3>Mi efectividad</h3>
      <div class="mini-kpis">
        <div class="kpi dest"><small>Efectividad (citas ÷ gestiones)</small><b>${fmt(pct(citas,todos.length))} %</b></div>
        <div class="kpi"><small>Gestiones</small><b>${fmt(todos.length)}</b></div>
        <div class="kpi"><small>Agendas</small><b>${fmt(ag)}</b></div>
        <div class="kpi"><small>Citas dadas</small><b>${fmt(citas)}</b></div>
      </div>
      <p class="muted" style="margin:0;font-size:12px">Hoy: ${fmt(hoyL.length)} gestiones · ${fmt(hoyL.reduce((t,c)=>t+(c._citas||0),0))} citas · efectividad ${fmt(pct(hoyL.reduce((t,c)=>t+(c._citas||0),0),hoyL.length))} %</p></div>
      <div class="card"><h3>Mis codificaciones</h3>${donaSVG(cnt.map(([t,n])=>({nombre:t,n,color:t==='Otros'?OTRO:colTipi(t)})),todos.length,'gestiones')}</div>`;
  }
  // listado: últimas 50 o búsqueda por número de autorización
  if(!todos.length){ $('agGestTabla').innerHTML=`<div class="card vacio">Aún no has codificado casos.</div>`; $('agGestInfo').textContent=''; return; }
  const q=($('agGestBuscar').value||'').trim().toLowerCase(), MAX=50;
  const encontrados=q? todos.filter(c=>String(c['Numero Autorizacion']).toLowerCase().includes(q)) : todos;
  const l=encontrados.slice(0,MAX);
  $('agGestInfo').textContent = q ? `${fmt(encontrados.length)} resultado${encontrados.length===1?'':'s'}${encontrados.length>MAX?` (se muestran ${MAX})`:''}` : (todos.length>MAX?`Últimas ${MAX} de ${fmt(todos.length)}`:'');
  $('agGestTabla').innerHTML = l.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Numero Autorizacion</th></tr></thead><tbody>
    ${l.map(c=>`<tr><td class="nw">${verFecha(c._fg)}</td><td class="nw">${c._fg.slice(11,19)}</td><td>${esc(c['Numero Autorizacion'])}</td></tr>`).join('')}
  </tbody></table></div>` : `<div class="card vacio">No encontré gestiones con ese número.</div>`;
}

/* =====================================================================
   VISUAL SUPERVISOR
===================================================================== */
function tabSup(t){
  ROOT.querySelectorAll('#vSupervisor nav.tabs button').forEach(b=>b.classList.toggle('act',b.dataset.t===t));
  const m={base:'sBase',asignar:'sAsignar',graficas:'sGraficas',gestionados:'sGestionados',tipis:'sTipis'};
  Object.entries(m).forEach(([k,id])=>$(id).classList.toggle('hidden',k!==t));
  if(t==='base') pintarBase(); if(t==='asignar') pintarAsignar(); if(t==='tipis') pintarTipis();
  if(t==='graficas'){ llenarSelects(); pintarGraficas(); } if(t==='gestionados'){ llenarSelects(); pintarGestSup(); }
}

/* ---------- Base ---------- */
function pintarBase(){
  const v=Object.values(S.casos);
  const sinAsig=v.filter(c=>!c._agente&&c._estado==='pendiente').length, pend=v.filter(c=>c._agente&&c._estado==='pendiente').length, gest=v.filter(c=>c._estado==='gestionado').length, fuera=v.filter(c=>c._estado==='fuera').length;
  $('kpisBase').innerHTML = [['Total en base',v.length],['Sin asignar',sinAsig],['Asignados pendientes',pend],['Gestionados',gest],['Fuera de gestión',fuera]]
    .map(([a,b])=>`<div class="kpi"><small>${a}</small><b>${b.toLocaleString('es-CO')}</b></div>`).join('');
  $('histCargas').innerHTML = S.cargas.length
    ? `<div class="tw" style="max-height:300px"><table><thead><tr><th>Fecha y hora</th><th>Archivo</th><th>Filas leídas</th><th>Cargados</th><th>No cargados (ya existían)</th><th>Estado actualizado</th><th>Sin número</th><th>Casos actuales</th><th></th></tr></thead><tbody>
      ${S.cargas.slice().reverse().map(c=>`<tr${c.eliminadaAt?' class="sta-fila-eliminada"':''}><td class="nw">${verFecha(c.fecha,true)}</td><td>${esc(c.archivo)}</td><td>${c.leidas}</td><td><span class="tag v">${c.nuevos}</span></td><td><span class="tag a">${c.dup}</span></td><td>${c.actEst||0}</td><td>${c.sinNum||0}</td><td>${casosDeCarga(c.id).length}</td><td class="nw">${c.eliminadaAt?`<span class="tag sta-eliminada">Eliminada</span> <span class="muted" style="font-size:12px">${verFecha(c.eliminadaAt,true)}${c.eliminadaPor?' · '+esc(c.eliminadaPor):''}</span>`:`${c.tieneArchivo?`<button class="btn sm" onclick="STAapp.descargarCarga('${c.id}')">Descargar</button> `:''}<button class="btn sm peligro" onclick="STAapp.pedirBorrarCarga('${c.id}')">Eliminar carga</button>`}</td></tr>`).join('')}
      </tbody></table></div>`
    : `<p class="muted">Todavía no se ha cargado ninguna base.</p>`;
}
function leerArchivo(file){
  return new Promise((ok,ko)=>{ const r=new FileReader();
    r.onload=e=>{ try{ const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]]; ok(XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true})); }catch(err){ ko(err); } };
    r.onerror=()=>ko(r.error); r.readAsArrayBuffer(file); });
}
async function procesarCarga(file){
  const box=$('cargaMsg'); box.innerHTML=`<div class="msg warn">Leyendo ${esc(file.name)}…</div>`;
  let filas; try{ filas=await leerArchivo(file); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo leer el archivo: ${esc(e.message)}</div>`; return; }
  if(!filas.length){ box.innerHTML=`<div class="msg err">El archivo está vacío.</div>`; return; }
  // ubicar encabezados (primera fila que contenga "Numero Autorizacion")
  let hi=filas.findIndex(r=>r.some(h=>normHeader(h)==='numero autorizacion'));
  if(hi<0){ box.innerHTML=`<div class="msg err">No encontré la columna <b>Numero Autorizacion</b> en el archivo.</div>`; return; }
  const enc=filas[hi];
  const mapa=[]; // [indice, nombreCampo]
  enc.forEach((h,i)=>{ const n=normHeader(h); if(!n) return;
    const est=CAMPOS.find(c=>normHeader(c)===n); mapa.push([i, est || String(h).trim()]); });
  const faltan=CAMPOS.filter(c=>!mapa.some(m=>m[1]===c));
  // Fase STA: filas leídas con las mismas reglas del HTML; la llave (Numero Autorizacion), los
  // repetidos y el cambio de Estado los aplica el servidor en una sola transacción.
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){
    const fila=filas[r]; if(!fila || fila.every(v=>v===''||v==null)) continue;
    const o={}; mapa.forEach(([i,c])=>{ let v=fila[i]; if(CAMPOS_FECHA.includes(c)) v=aFecha(v); else if(v instanceof Date) v=isoLocal(v); else v=typeof v==='string'?v.trim():v; o[c]=v; });
    objs.push(o);
  }
  box.innerHTML=`<div class="msg warn">Guardando ${esc(file.name)} en la plataforma…</div>`;
  let R; try{ R=await API.cargar(file, mapa.map(m=>m[1]), objs); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo guardar: ${esc(e.message)}</div>`; return; }
  await refrescar(); pintarBase();
  const nuevos=R.nuevos, dup=R.dup, actEst=R.actEst, sinNum=R.sinNum, cambios=R.cambios||{};
  box.innerHTML = `<div class="msg ok">${esc(R.mensaje)}.</div>`
    + (dup?`<div class="msg warn">No se cargaron <b>${dup}</b> casos porque su Numero Autorizacion ya existe.</div>`:'')
    + (actEst?`<div class="msg ok">Se actualizó el <b>Estado</b> de <b>${actEst}</b> casos que ya existían:<br>${Object.entries(cambios).map(([k,n])=>`${esc(k)}: <b>${n}</b>`).join('<br>')}</div>`:'')
    + (sinNum?`<div class="msg warn"><b>${sinNum}</b> filas se omitieron porque no tienen Numero Autorizacion.</div>`:'')
    + (faltan.length?`<div class="msg err">Columnas que no se encontraron en el archivo: ${faltan.map(esc).join(', ')}</div>`:'');
}
function casosDeCarga(id){ return Object.values(S.casos).filter(c=>c._cargaId===id); }
function pedirBorrarCarga(id){
  const cg=S.cargas.find(c=>c.id===id); if(!cg) return;
  const l=casosDeCarga(id);
  const sin=l.filter(c=>!c._agente&&c._estado==='pendiente').length, pen=l.filter(c=>c._agente&&c._estado==='pendiente').length, ges=l.filter(c=>c._estado==='gestionado').length;
  $('modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)STAapp.cerrarModal()"><div class="modal" style="width:min(520px,100%)">
    <header><h3>Eliminar carga</h3><button class="x" onclick="STAapp.cerrarModal()">×</button></header>
    <div class="bd">
      <p style="margin-top:0"><b>${esc(cg.archivo)}</b><br><span class="muted">Cargada el ${verFecha(cg.fecha,true)}</span></p>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
        <div class="kpi"><small>Sin asignar</small><b>${sin}</b></div>
        <div class="kpi"><small>Asignados pendientes</small><b>${pen}</b></div>
        <div class="kpi"><small>Gestionados</small><b>${ges}</b></div>
      </div>
      <p class="muted">Se eliminarán de la base los casos que entraron con esta carga, incluidos los que están en la bandeja de los agentes.</p>
      ${ges?`<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="conservarGes" checked> <span>Conservar los ${ges} casos ya gestionados (con su codificación)</span></label>`:''}
      <p class="muted" style="font-size:12px;margin-bottom:0">Después podrás volver a montar la base correcta; los números eliminados se cargarán como nuevos.</p>
    </div>
    <footer><button class="btn" onclick="STAapp.cerrarModal()">Cancelar</button><button class="btn peligro" style="background:var(--red);color:#fff;border-color:var(--red)" onclick="STAapp.borrarCarga('${id}')">Eliminar</button></footer>
  </div></div>`;
}
async function borrarCarga(id){
  const conservar = $('conservarGes') ? $('conservarGes').checked : false;
  const r = await accion(()=>API.borrarCarga(id, conservar), 'No se pudo eliminar');
  cerrarModal(); await refrescar(); pintarBase(); if(!r) return;
  $('cargaMsg').innerHTML=`<div class="msg ok">Se eliminaron <b>${r.eliminados}</b> casos de la carga.${r.conservados?` Se conservaron <b>${r.conservados}</b> gestionados.`:''}</div>`;
}
async function descargarCarga(id){ if(!await API.descargar(id)) toast('No se pudo descargar el archivo'); }
function descargarPlantilla(){
  if(typeof XLSX==='undefined'){ toast('No se pudo preparar el archivo de Excel'); return; }
  const ws=XLSX.utils.aoa_to_sheet([CAMPOS.slice()]); ws['!cols']=CAMPOS.map(c=>({wch:Math.max(14,c.length+2)}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Base STA'); XLSX.writeFile(wb,'Plantilla_base_STA.xlsx');
}
// Pedido de Edwin (25/11): «Actualizar estado». Lee Numero Autorizacion y Estado; el resto lo hace el servidor.
async function procesarEstados(file){
  const box=$('estadoMsg'); box.innerHTML=`<div class="msg warn">Leyendo ${esc(file.name)}…</div>`;
  let filas; try{ filas=await leerArchivo(file); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo leer el archivo: ${esc(e.message)}</div>`; return; }
  const hi=filas.findIndex(r=>r.some(h=>normHeader(h)==='numero autorizacion'));
  if(hi<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Numero Autorizacion</b> en el archivo.</div>'; return; }
  const iN=filas[hi].findIndex(h=>normHeader(h)==='numero autorizacion'), iE=filas[hi].findIndex(h=>normHeader(h)==='estado');
  if(iE<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Estado</b> en el archivo.</div>'; return; }
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){ const f=filas[r]; if(!f || f.every(v=>v===''||v==null)) continue;
    const n=f[iN], e=f[iE]; objs.push({numero:typeof n==='number'?String(n):String(n??'').trim(), estado:String(e??'').trim()}); }
  if(!objs.length){ box.innerHTML='<div class="msg err">El archivo no tiene filas.</div>'; return; }
  box.innerHTML=`<div class="msg warn">Actualizando ${objs.length.toLocaleString('es-CO')} estados…</div>`;
  let R; try{ R=await API.estados(file.name, objs); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo actualizar: ${esc(e.message)}</div>`; return; }
  await refrescar(); pintarBase();
  const cambios=Object.entries(R.cambios||{});
  box.innerHTML=`<div class="msg ok">${esc(R.mensaje)}.</div>`
    + (cambios.length?`<div class="msg ok" style="font-size:13px">${cambios.map(([k,n])=>`${esc(k)}: <b>${n}</b>`).join(' · ')}</div>`:'')
    + (R.sinNum||R.sinEstado||R.repetidos?`<div class="msg warn">${[R.sinNum?R.sinNum+' sin número':'',R.sinEstado?R.sinEstado+' sin estado':'',R.repetidos?R.repetidos+' repetidas en el archivo (cuenta la primera)':''].filter(Boolean).join(' · ')}.</div>`:'')
    + (R.noExisten?`<div class="msg err"><b>${R.noExisten.toLocaleString('es-CO')}</b> números de autorización no existen en la base y no se crearon:<br><span class="sta-no-existen">${R.noExistenLista.map(esc).join(', ')}${R.noExisten>R.noExistenLista.length?' …':''}</span></div>`:'');
}
function descargarPlantillaEstado(){
  if(typeof XLSX==='undefined'){ toast('No se pudo preparar el archivo de Excel'); return; }
  const ws=XLSX.utils.aoa_to_sheet([['Numero Autorizacion','Estado']]); ws['!cols']=[{wch:22},{wch:18}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Actualizar estado'); XLSX.writeFile(wb,'Plantilla_actualizar_estado_STA.xlsx');
}
let histPendiente=null;
async function revisarHistorico(file){
  const box=$('histMsg'); histPendiente=null; box.innerHTML=`<div class="msg warn">Leyendo ${esc(file.name)}…</div>`;
  let filas; try{ filas=await leerArchivo(file); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo leer el archivo: ${esc(e.message)}</div>`; return; }
  const hi=filas.findIndex(r=>r.some(h=>normHeader(h)==='numero autorizacion'));
  if(hi<0){ box.innerHTML='<div class="msg err">No encontré la columna <b>Numero Autorizacion</b> en el archivo.</div>'; return; }
  const enc=filas[hi].map(normHeader), col=(...ns)=>enc.findIndex(h=>ns.includes(h));
  const iC=col('codificacion'), iO=col('observacion'), iF=col('fecha gestion','fecha'), iA=col('asesor');
  const faltan=[[iC,'CODIFICACION'],[iF,'FECHA GESTION'],[iA,'ASESOR']].filter(([i])=>i<0).map(([,n])=>n);
  if(faltan.length){ box.innerHTML=`<div class="msg err">Faltan columnas de la gestión: <b>${faltan.join(', ')}</b>.</div>`; return; }
  const base=CAMPOS.map(c=>[c,enc.indexOf(normHeader(c))]);
  const objs=[];
  for(let r=hi+1;r<filas.length;r++){ const f=filas[r]; if(!f || f.every(v=>v===''||v==null)) continue;
    const o={}; base.forEach(([c,i])=>{ let v=i<0?'':f[i]; if(CAMPOS_FECHA.includes(c)) v=aFecha(v); else if(v instanceof Date) v=isoLocal(v); else v=typeof v==='string'?v.trim():v; o[c]=v; });
    const fg=aFecha(f[iF]); o.fechaGestion=fg?String(fg).slice(0,10):''; o.codificacion=String(f[iC]??'').trim(); o.observacion=iO<0?'':(f[iO] instanceof Date?isoLocal(f[iO]).slice(0,10):String(f[iO]??'').trim()); o.asesor=String(f[iA]??'').trim();
    objs.push(o); }
  if(!objs.length){ box.innerHTML='<div class="msg err">El archivo no tiene filas.</div>'; return; }
  box.innerHTML=`<div class="msg warn">Revisando ${objs.length.toLocaleString('es-CO')} filas…</div>`;
  let R; try{ R=await API.historico(file.name, objs, true); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo revisar: ${esc(e.message)}</div>`; return; }
  histPendiente={ nombre:file.name, objs };
  box.innerHTML=resumenHistorico(R)+(R.nuevos?`<div class="fila" style="margin-top:8px"><button type="button" class="btn pri" onclick="STAapp.confirmarHistorico()">Cargar ${R.nuevos.toLocaleString('es-CO')} casos</button><button type="button" class="btn" onclick="STAapp.cancelarHistorico()">Cancelar</button></div>`:'');
}
function resumenHistorico(R){
  const lista=(o)=>Object.entries(o||{}).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${esc(k)}: <b>${n}</b>`).join(' · ');
  return `<div class="msg ${R.dryRun?'warn':'ok'}">${esc(R.mensaje)}.</div>`
    + (Object.keys(R.porEstado||{}).length?`<div class="msg ok" style="font-size:13px">Por estado: ${lista(R.porEstado)}. Citas (Agenda InConexion = 1): <b>${R.citas}</b>.</div>`:'')
    + (R.sinAsesor?`<div class="msg err">Asesoras sin usuario en la plataforma (no entran): ${lista(R.asesoresSinUsuario)}</div>`:'')
    + (Object.keys(R.codificacionDesconocida||{}).length?`<div class="msg warn">Codificaciones que no están en la lista: ${lista(R.codificacionDesconocida)}</div>`:'')
    + (R.sinNum||R.sinFecha?`<div class="msg warn">${R.sinNum?R.sinNum+' sin número':''}${R.sinNum&&R.sinFecha?' · ':''}${R.sinFecha?R.sinFecha+' sin fecha de gestión':''}.</div>`:'');
}
async function confirmarHistorico(){
  if(!histPendiente) return; const box=$('histMsg'), p=histPendiente; histPendiente=null;
  box.innerHTML=`<div class="msg warn">Cargando ${esc(p.nombre)}…</div>`;
  let R; try{ R=await API.historico(p.nombre, p.objs, false); }catch(e){ box.innerHTML=`<div class="msg err">No se pudo cargar: ${esc(e.message)}</div>`; return; }
  await refrescar(); pintarBase(); box.innerHTML=resumenHistorico(R);
}
function cancelarHistorico(){ histPendiente=null; $('histMsg').innerHTML='<div class="msg warn">No se cargó nada.</div>'; }
function exportarExcel(){
  const v=Object.values(S.casos); if(!v.length) return toast('No hay datos para exportar');
  const filas=v.map(c=>{ const o={}; S.columnas.forEach(k=>o[k]=CAMPOS_FECHA.includes(k)?verFecha(c[k],k==='Fecha Ingreso Sta'):c[k]);
    o['Agente asignado']=c._agente?nombreAgente(c._agente):''; o['Fecha asignación']=verFecha(c._asignado,true);
    o['Estado gestión']=c._estado==='fuera'?'Fuera de gestión':!c._agente?'Sin asignar':(c._estado==='gestionado'?'Gestionado':'Pendiente');
    o['Tipificación']=c._tipi; o['Citas agendadas']=c._citas||''; o['Observación']=c._obs; o['Fecha gestión']=c._fg?verFecha(c._fg):''; o['Hora gestión']=c._fg?c._fg.slice(11,19):'';
    o['Fecha carga']=verFecha(c._carga,true); return o; });
  const ws=XLSX.utils.json_to_sheet(filas), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Base STA');
  XLSX.writeFile(wb,`Base_STA_gestiones_${ahora().slice(0,10)}.xlsx`);
}




/* ---------- Agentes y asignación ---------- */
let agSel=null;
const MS_CAMPO={ent:'Entidad',serv:'Servicio',cups:'Descripcion Cups'};
const F = {cant:'', ent:null, serv:null, cups:null, ingD:'', ingH:'', autD:'', autH:'', expD:'', expH:''};
function contar(id){ let p=0,g=0; for(const c of Object.values(S.casos)) if(c._agente===id){ c._estado==='gestionado'?g++:p++; } return [p,g]; }
function pintarAsignar(){
  const activos=S.agentes.filter(a=>a.activo!==false);
  const v=Object.values(S.casos), libres=v.filter(c=>!c._agente&&c._estado==='pendiente').length, pendT=v.filter(c=>c._agente&&c._estado==='pendiente').length;
  $('kpisAsig').innerHTML=[['Órdenes libres (sin asignar)',libres,'var(--green)'],['Asignadas pendientes',pendT],['Gestionadas',v.filter(c=>c._estado==='gestionado').length],['Total en base',v.length]]
    .map(([a,b,col])=>`<div class="kpi" ${col?`style="border-left:4px solid ${col}"`:''}><small>${a}</small><b>${b.toLocaleString('es-CO')}</b></div>`).join('');
  $('agLista').innerHTML = activos.length ? activos.map(a=>{ const [p,g]=contar(a.id);
    return `<div class="ag ${agSel===a.id?'sel':''}" onclick="STAapp.selAgente('${a.id}')"><div><b>${esc(a.nombre)}</b><br><small>${p+g} asignados · ${p} pendientes · ${g} gestionados</small></div><span class="tag">${p}</span></div>`; }).join('')
    : `<p class="muted">No hay usuarios ASESOR activos de ORLANT.</p>`;
  pintarPanelAsig(); pintarPendTodos();
}
const abiertos=new Set(); const selPend={}; const cantPend={}; // agenteId -> Set(ids)
function togglePend(id){ abiertos.has(id)?abiertos.delete(id):abiertos.add(id); pintarPendTodos(); }
function pendDe(id){ return Object.values(S.casos).filter(c=>c._agente===id&&c._estado==='pendiente').sort((x,y)=>(x['Fecha Ingreso Sta']||'').localeCompare(y['Fecha Ingreso Sta']||'')); }
function selDe(id){ if(!selPend[id]) selPend[id]=new Set(); return selPend[id]; }
function pintarPendTodos(){
  const ags=S.agentes.filter(a=>a.activo!==false);
  if(!ags.length){ $('pendTodos').innerHTML='<p class="muted">No hay agentes.</p>'; return; }
  $('pendTodos').innerHTML=ags.map(a=>{
    const pend=pendDe(a.id), ab=abiertos.has(a.id), sel=selDe(a.id);
    [...sel].forEach(x=>{ if(!pend.some(c=>c._id===x)) sel.delete(x); }); // limpia selecciones viejas
    const otros=ags.filter(o=>o.id!==a.id);
    const todos=pend.length&&sel.size===pend.length;
    return `<div class="acc ${ab?'ab':''}" id="acc_${a.id}">
      <div class="acc-h" onclick="STAapp.togglePend('${a.id}')"><span class="flecha">${ab?'▾':'▸'}</span><b>${esc(a.nombre)}</b><span style="flex:1"></span><span class="tag ${pend.length?'a':''}">${pend.length} pendientes</span></div>
      ${!ab?'':`<div class="acc-b">${!pend.length?'<p class="muted" style="margin:6px 0">No tiene casos pendientes.</p>':`
        <div class="fila acc-bar">
          <span class="tag a" style="font-size:13px;padding:4px 10px"><b>${pend.length}</b> disponibles</span>
          <button class="btn sm" onclick="STAapp.selTodos('${a.id}',${!todos})">${todos?'Quitar selección':'Seleccionar todos'}</button>
          <label class="chk" style="color:var(--txt)">Cantidad
            <input type="number" min="1" max="${pend.length}" class="inp" id="cantP_${a.id}" style="width:90px;padding:5px 8px" placeholder="Ej: 10" value="${cantPend[a.id]||''}" oninput="STAapp.selCantidad('${a.id}',this.value)"></label>
          <span class="muted" id="selN_${a.id}">${sel.size} seleccionados</span>
          <span id="cantMsg_${a.id}" style="color:var(--red);font-size:12px"></span>
          <span style="flex:1"></span>
          <button class="btn sm peligro" onclick="STAapp.devolverSel('${a.id}')">Devolver a disponibles</button>
          <select class="inp" id="dest_${a.id}" aria-label="Pasar a otro agente" style="padding:5px 8px"><option value="">Pasar a…</option>${otros.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('')}</select>
          <button class="btn sm pri" onclick="STAapp.pasarSel('${a.id}')">Pasar</button>
        </div>
        <div class="tw" style="max-height:340px"><table><thead><tr><th style="width:34px"><input type="checkbox" aria-label="Seleccionar todos" ${todos?'checked':''} onclick="STAapp.selTodos('${a.id}',this.checked)" title="Seleccionar todos"></th><th>Numero Autorizacion</th><th>Entidad</th><th>Servicio</th><th>Descripcion Cups</th><th>Fecha Ingreso Sta</th><th>Asignado</th></tr></thead><tbody>
        ${pend.slice(0,500).map(c=>`<tr><td><input type="checkbox" aria-label="Seleccionar ${esc(c['Numero Autorizacion'])}" ${sel.has(c._id)?'checked':''} onchange="STAapp.selUno('${a.id}',${jsArg(c._id)},this.checked)"></td><td class="nw">${esc(c['Numero Autorizacion'])}</td><td>${esc(c['Entidad'])}</td><td>${esc(c['Servicio'])}</td><td>${esc(c['Descripcion Cups'])}</td><td class="nw">${verFecha(c['Fecha Ingreso Sta'],true)}</td><td class="nw">${verFecha(c._asignado,true)}</td></tr>`).join('')}
        </tbody></table></div>${pend.length>500?`<p class="muted">Mostrando 500 de ${pend.length} (Seleccionar todos toma los ${pend.length})</p>`:''}`}</div>`}
    </div>`; }).join('');
}
function selUno(ag,id,on){ const s=selDe(ag); cantPend[ag]=''; const ci=$('cantP_'+ag); if(ci) ci.value=''; const cm=$('cantMsg_'+ag); if(cm) cm.textContent=''; on?s.add(id):s.delete(id); const e=$('selN_'+ag); if(e) e.textContent=`${s.size} seleccionados`;
  const tot=pendDe(ag).length; const hdr=ROOT.querySelector(`#acc_${ag} thead input`); if(hdr) hdr.checked=s.size===tot; }
function selCantidad(ag,v){
  const n=parseInt(v)||0, pend=pendDe(ag), s=selDe(ag); cantPend[ag]=v; s.clear();
  pend.slice(0,Math.min(n,pend.length)).forEach(c=>s.add(c._id));
  // refrescar casillas sin repintar (para no perder el foco del campo)
  ROOT.querySelectorAll(`#acc_${ag} tbody input[type=checkbox]`).forEach((cb,i)=>{ cb.checked = pend[i] && s.has(pend[i]._id); });
  const hdr=ROOT.querySelector(`#acc_${ag} thead input`); if(hdr) hdr.checked = pend.length>0 && s.size===pend.length;
  $('selN_'+ag).textContent=`${s.size} seleccionados`;
  $('cantMsg_'+ag).textContent = n>pend.length ? `Solo hay ${pend.length} disponibles; se seleccionaron ${pend.length}.` : '';
}
function selTodos(ag,on){ const s=selDe(ag); s.clear(); cantPend[ag]=''; if(on) pendDe(ag).forEach(c=>s.add(c._id)); pintarPendTodos(); }
async function devolverSel(ag){
  const ids=[...selDe(ag)]; if(!ids.length) return toast('Selecciona al menos un caso');
  if(!await confirmar(`¿Devolver ${ids.length} casos de ${nombreAgente(ag)} a disponibles?`,{titulo:'Devolver casos',ok:'Devolver'})) return;
  const r = await accion(()=>API.devolver(ag, ids), 'No se pudo devolver');
  await refrescar(); selDe(ag).clear(); cantPend[ag]=''; if(r) toast(`${r.devueltos} casos devueltos a disponibles`); pintarAsignar();
}
async function pasarSel(ag){
  const ids=[...selDe(ag)]; if(!ids.length) return toast('Selecciona al menos un caso');
  const dest=$('dest_'+ag).value; if(!dest) return toast('Elige el agente al que vas a pasar los casos');
  if(!await confirmar(`¿Pasar ${ids.length} casos de ${nombreAgente(ag)} a ${nombreAgente(dest)}?`,{titulo:'Pasar casos',ok:'Pasar'})) return;
  const r = await accion(()=>API.pasar(ag, dest, ids), 'No se pudo pasar');
  await refrescar(); selDe(ag).clear(); cantPend[ag]=''; abiertos.add(dest); if(r) toast(`${r.pasados} casos pasados a ${nombreAgente(dest)}`); pintarAsignar();
}

function selAgente(id){ agSel=id; pintarAsignar(); }
function disponibles(){ return Object.values(S.casos).filter(c=>!c._agente&&c._estado==='pendiente'); }
function filtrar(sin){ // sin: filtro de lista que no se aplica (para armar sus propias opciones)
  return disponibles().filter(c=>{
    if(sin!=='ent' && F.ent && !F.ent.has(c['Entidad']||'')) return false;
    if(sin!=='serv' && F.serv && !F.serv.has(c['Servicio']||'')) return false;
    if(sin!=='cups' && F.cups && !F.cups.has(c['Descripcion Cups']||'')) return false;
    const rng=(v,a,b)=>{ const s=(v||'').slice(0,10); if(a&&(!s||s<a)) return false; if(b&&(!s||s>b)) return false; return true; };
    return rng(c['Fecha Ingreso Sta'],F.ingD,F.ingH) && rng(c['Fecha Autorizacion'],F.autD,F.autH) && rng(c['Fecha Expiracion'],F.expD,F.expH);
  }).sort((a,b)=>(a['Fecha Ingreso Sta']||'').localeCompare(b['Fecha Ingreso Sta']||''));
}
function opciones(campo){ const m=new Map(), k=Object.keys(MS_CAMPO).find(x=>MS_CAMPO[x]===campo);
  filtrar(k).forEach(c=>{ const v=c[campo]||''; m.set(v,(m.get(v)||0)+1); });
  if(k && F[k]) F[k].forEach(v=>{ if(!m.has(v)) m.set(v,0); });
  return [...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'es')); }
function msHTML(key,titulo,campo){
  const set=F[key], ops=opciones(campo);
  const txt=msTexto(key);
  return `<div class="f">${titulo}<div class="ms" id="ms_${key}">
    <button type="button" class="inp ms-btn" onclick="STAapp.toggleMs('${key}')"><span>${esc(txt)}</span><span>▾</span></button>
    <div class="ms-pan hidden">
      <input class="inp" aria-label="Buscar opciones" placeholder="Buscar…" oninput="STAapp.filtrarMs('${key}',this.value)">
      <div class="ms-list">${ops.length?ops.map(([v,n])=>`<label data-v="${esc(String(v).toLowerCase())}"><input type="checkbox" value="${esc(v)}" ${!set||set.has(v)?'checked':''} onchange="STAapp.marcarMs('${key}',this)"> <span>${esc(v||'(vacío)')} <span class="muted">(${n})</span></span></label>`).join(''):'<p class="muted" style="padding:6px">Sin opciones</p>'}</div>
      <div class="ms-acc"><span><a onclick="STAapp.todoMs('${key}',true)">Seleccionar todo</a> · <a onclick="STAapp.todoMs('${key}',false)">Quitar todo</a></span><a onclick="STAapp.cerrarMs()"><b>Listo</b></a></div>
    </div></div></div>`;
}
function toggleMs(k){ ROOT.querySelectorAll('.ms-pan').forEach(p=>{ if(p.parentElement.id!=='ms_'+k) p.classList.add('hidden'); });
  const p=ROOT.querySelector(`#ms_${k} .ms-pan`); p.classList.toggle('hidden'); if(p.classList.contains('hidden')) pintarPanelAsig(); }
function filtrarMs(k,q){ q=q.toLowerCase(); ROOT.querySelectorAll(`#ms_${k} .ms-list label`).forEach(l=>l.style.display=l.dataset.v.includes(q)?'':'none'); }
// F[k] === null significa "todas marcadas" (incluye opciones nuevas que lleguen en otra carga)
function msTodos(k){ return opciones(MS_CAMPO[k]).map(o=>o[0]); }
function msNormalizar(k){ const t=msTodos(k); if(F[k] && F[k].size===t.length && t.every(v=>F[k].has(v))) F[k]=null; }
function msTexto(k){ const s=F[k]; if(!s) return 'Todos'; if(!s.size) return 'Ninguno';
  return s.size===1 ? ([...s][0]||'(vacío)') : `${s.size} de ${msTodos(k).length}`; }
function msRefrescarTexto(k){ ROOT.querySelector(`#ms_${k} .ms-btn span`).textContent=msTexto(k); actualizarConteo(); }
function marcarMs(k,el){ if(!F[k]) F[k]=new Set(msTodos(k)); el.checked?F[k].add(el.value):F[k].delete(el.value); msNormalizar(k); msRefrescarTexto(k); }
function limpiarMs(k){ F[k]=null; pintarPanelAsig(); }
function cerrarMs(){ ROOT.querySelectorAll('.ms-pan').forEach(p=>p.classList.add('hidden')); pintarPanelAsig(); }
function todoMs(k,on){ // aplica a las opciones visibles (respeta la búsqueda)
  if(!F[k]) F[k]=new Set(msTodos(k));
  ROOT.querySelectorAll(`#ms_${k} .ms-list label`).forEach(l=>{ if(l.style.display==='none') return; const cb=l.querySelector('input'); cb.checked=on; on?F[k].add(cb.value):F[k].delete(cb.value); });
  msNormalizar(k); msRefrescarTexto(k); }
ROOT.addEventListener('click',e=>{ if(!e.target.closest('.ms')){ let abierto=false; ROOT.querySelectorAll('.ms-pan').forEach(p=>{ if(!p.classList.contains('hidden')){abierto=true;p.classList.add('hidden');} }); if(abierto) pintarPanelAsig(); } });
function setF(k,v){ F[k]=v; actualizarConteo(); }
function actualizarConteo(){
  const n=filtrar().length; const el=$('dispN'); if(!el) return;
  el.textContent=n.toLocaleString('es-CO');
  const c=parseInt(F.cant)||0, info=$('asigInfo');
  info.style.color = c>n ? 'var(--red)' : '';
  info.textContent = !c ? 'Indica la cantidad a asignar.'
    : !n ? 'No hay casos disponibles con estos filtros.'
    : c>n ? `Pediste ${c.toLocaleString('es-CO')} pero solo hay ${n.toLocaleString('es-CO')} disponibles con estos filtros.`
    : `Se asignarán ${c.toLocaleString('es-CO')} casos (los más antiguos por Fecha Ingreso Sta).`;
  $('btnAsig').disabled = !c || !n;
}
function limpiarFiltros(){ Object.assign(F,{cant:'',ingD:'',ingH:'',autD:'',autH:'',expD:'',expH:''}); F.ent=null; F.serv=null; F.cups=null; pintarPanelAsig(); }
function pintarPanelAsig(){
  const box=$('asigPanel');
  const a=S.agentes.find(x=>x.id===agSel);
  if(!a){ box.innerHTML=`<div class="card vacio">Selecciona un agente para asignarle casos.</div>`; return; }
  const [p,g]=contar(a.id);
  const rango=(t,a1,a2)=>`<label class="f">${t}<div class="rango"><input type="date" class="inp" value="${F[a1]}" onchange="STAapp.setF('${a1}',this.value)"><span class="muted">a</span><input type="date" class="inp" value="${F[a2]}" onchange="STAapp.setF('${a2}',this.value)"></div></label>`;
  box.innerHTML = `
  <div class="card">
    <div class="fila" style="justify-content:space-between;margin-bottom:6px">
      <h3 style="margin:0">Asignar casos a ${esc(a.nombre)}</h3>
    </div>
    <div class="kpis" style="grid-template-columns:repeat(4,1fr);margin:10px 0 14px">
      <div class="kpi" style="border-left:4px solid var(--green)"><small>Órdenes libres</small><b>${Object.values(S.casos).filter(c=>!c._agente&&c._estado==='pendiente').length.toLocaleString('es-CO')}</b></div>
      <div class="kpi"><small>Total asignado a ${esc(a.nombre)}</small><b>${(p+g).toLocaleString('es-CO')}</b></div>
      <div class="kpi"><small>Pendientes en bandeja</small><b>${p.toLocaleString('es-CO')}</b></div>
      <div class="kpi"><small>Gestionados</small><b>${g.toLocaleString('es-CO')}</b></div>
    </div>
    <p class="muted" style="margin-top:0">Solo se asignan casos que aún no tienen agente.</p>
    <div class="grid-f">
      <label class="f">Cantidad de casos *<input type="number" min="1" class="inp" value="${F.cant}" oninput="STAapp.setF('cant',this.value)" placeholder="Ej: 50"></label>
      ${msHTML('ent','Entidad','Entidad')}
      ${msHTML('serv','Servicio','Servicio')}
      ${msHTML('cups','Descripción CUPS','Descripcion Cups')}
      ${rango('Fecha Ingreso Sta','ingD','ingH')}
      ${rango('Fecha Autorización','autD','autH')}
      ${rango('Fecha Expiración','expD','expH')}
    </div>
    <div class="disp" style="margin-top:16px">
      <div><small class="muted">Disponibles con estos filtros</small><br><b id="dispN">0</b></div>
      <div style="flex:1" class="muted" id="asigInfo"></div>
      <button class="btn" onclick="STAapp.limpiarFiltros()">Limpiar filtros</button>
      <button class="btn ok" id="btnAsig" onclick="STAapp.asignar()">Asignar</button>
    </div>
  </div>`;
  actualizarConteo();
}
async function asignar(){
  const c=parseInt(F.cant)||0; if(!c) return toast('Indica la cantidad');
  await refrescar();
  const disp=filtrar(); if(!disp.length) return toast('No hay casos disponibles con esos filtros');
  if(c>disp.length) return avisoCantidad(c,disp.length);
  ejecutarAsignacion(disp.slice(0,c));
}
function avisoCantidad(pedidos,existen){
  $('modal').innerHTML=`<div class="modal-bg"><div class="modal" style="width:min(460px,100%)">
    <header><h3>No hay suficientes casos</h3><button class="x" onclick="STAapp.cerrarModal()">×</button></header>
    <div class="bd"><p style="margin-top:0">Pediste asignar <b>${pedidos.toLocaleString('es-CO')}</b> casos, pero con los filtros seleccionados solo existen <b>${existen.toLocaleString('es-CO')}</b> disponibles.</p>
      <p style="margin-bottom:0">¿Deseas asignar solo los <b>${existen.toLocaleString('es-CO')}</b> existentes a ${esc(nombreAgente(agSel))}?</p></div>
    <footer><button class="btn" onclick="STAapp.cerrarModal()">No, cambiar filtros</button><button class="btn ok" onclick="STAapp.aceptarExistentes(${existen})">Sí, asignar ${existen.toLocaleString('es-CO')}</button></footer>
  </div></div>`;
}
async function aceptarExistentes(n){
  cerrarModal(); F.cant=String(n); const inp=ROOT.querySelector('#asigPanel input[type=number]'); if(inp) inp.value=n;
  await refrescar(); const disp=filtrar(); ejecutarAsignacion(disp.slice(0,n));
}
async function ejecutarAsignacion(lista){
  if(!lista.length) return toast('No hay casos disponibles con esos filtros');
  const r = await accion(()=>API.asignar(agSel, lista.length, {entidad:F.ent?[...F.ent]:null,servicio:F.serv?[...F.serv]:null,cups:F.cups?[...F.cups]:null,ingD:F.ingD,ingH:F.ingH,autD:F.autD,autH:F.autH,expD:F.expD,expH:F.expH}), 'No se pudo asignar');
  await refrescar(); if(r) toast(`${r.asignados} casos asignados a ${nombreAgente(agSel)}`); F.cant=''; pintarAsignar();
}
async function quitarPendientes(){
  if(!await confirmar('Los casos pendientes (sin codificar) de este agente volverán a quedar sin asignar. ¿Continuar?')) return;
  const ids=pendDe(agSel).map(c=>c._id);
  const r = ids.length ? await accion(()=>API.devolver(agSel, ids), 'No se pudo devolver') : {devueltos:0};
  await refrescar(); if(r) toast(`${r.devueltos} casos devueltos`); pintarAsignar();
}



/* ---------- Gráficas ---------- */
const PAL=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#6250d6','#e34948'];
const OTRO='#9aa5ab', C_EF='#2a78d6', C_NOEF='#a9c9ef';
const C_UNIV={'Gestionado':'#2a78d6','Pendiente':'#eda100','Sin asignar':'#c3ccd1','Fuera de gestión':'#7a6a8f'};
/* Paleta de la sección Gestión (verdes InConexion) */
const G_AG='#4f9a43', G_CIT='#9bd08c', G_LIN='#2e7d32';
function tipShow(e,h){ const t=$('tip'); t.innerHTML=h; t.classList.add('on'); const x=e.clientX+14, y=e.clientY+14;
  t.style.left=Math.min(x,innerWidth-t.offsetWidth-10)+'px'; t.style.top=Math.min(y,innerHeight-t.offsetHeight-10)+'px'; }
ROOT.addEventListener('mousemove',e=>{ const el=e.target.closest&&e.target.closest('[data-tip]'); if(el) tipShow(e,el.dataset.tip); else $('tip').classList.remove('on'); });
let rzT; addEventListener('resize',()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ if(!$('sGraficas').classList.contains('hidden')) pintarGraficas(); },200); });
const NOMBRE_MES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function mesActualSta(){ return ahora().slice(0,7); }
function rangoMes(m){ const [y,mm]=m.split('-').map(Number); const fin=new Date(y,mm,0).getDate(); return [m+'-01', m+'-'+p2(fin)]; }
function mesesConGestion(){ const s=new Set([mesActualSta()]); Object.values(S.casos).forEach(c=>{ if(c._fg) s.add(c._fg.slice(0,7)); (c._prev||[]).forEach(g=>{ if(g&&g.fg) s.add(String(g.fg).slice(0,7)); }); }); return [...s].filter(m=>/^[0-9]{4}-[0-9]{2}$/.test(m)).sort().reverse(); }
const mesIniciado={};
function llenarMeses(pref){ const sel=$(pref+'Mes'); if(!sel) return; const v=mesIniciado[pref]?sel.value:mesActualSta();
  sel.innerHTML=mesesConGestion().map(m=>`<option value="${m}">${NOMBRE_MES[Number(m.slice(5,7))-1]} ${m.slice(0,4)}</option>`).join('')+'<option value="">Todos los meses</option>';
  sel.value=v; if(!mesIniciado[pref]){ mesIniciado[pref]=true; ponerRango(pref, v); } }
function ponerRango(pref, m){ const r=m?rangoMes(m):['','']; $(pref+'D').value=r[0]; $(pref+'H').value=r[1]; }
function elegirMes(pref){ ponerRango(pref, $(pref+'Mes').value); if(pref==='gr') pintarGraficas(); else pintarGestSup(); }
function llenarSelects(){
  llenarMeses('gr'); llenarMeses('gs');
  const ags=S.agentes.map(a=>`<option value="${a.id}">${esc(a.nombre)}${a.activo===false?' (inactivo)':''}</option>`).join('');
  ['grAg','gsAg'].forEach(id=>{ const v=$(id).value; $(id).innerHTML=`<option value="">Todos</option>`+ags; $(id).value=v; });
  const tis=[...new Set([...S.tipis,...Object.values(S.casos).filter(c=>c._tipi).map(c=>c._tipi)])];
  const v=$('gsTi').value; $('gsTi').innerHTML=`<option value="">Todas</option>`+tis.map(t=>`<option>${esc(t)}</option>`).join(''); $('gsTi').value=v;
  [['grEnt','Entidad'],['grServ','Servicio']].forEach(([id,campo])=>{ const v=$(id).value;
    const ops=[...new Set(Object.values(S.casos).map(c=>c[campo]||''))].sort((a,b)=>a.localeCompare(b,'es'));
    $(id).innerHTML=`<option value="">Todas</option>`+ops.map(o=>`<option value="${esc(o)}">${esc(o||'(vacío)')}</option>`).join(''); $(id).value=v; });
}
function limpiarGr(){ ['grAg','grEnt','grServ','grD','grH','grMes'].forEach(id=>$(id).value=''); pintarGraficas(); }
function gestHistCuenta(){ const out=[]; for(const c of Object.values(S.casos)) (c._prev||[]).forEach((p,i)=>{ if(p&&p.cuenta&&p.fg) out.push(Object.assign({},c,{_id:c._id+'#h'+i,_virtual:true,_estado:'gestionado',_agente:p.agente==null?null:String(p.agente),_tipi:p.tipi||'',_obs:p.obs||'',_fg:p.fg,_citas:p.citas||0,_rell:null})); }); return out; }
function gestFiltradas(ag,d,h){ return Object.values(S.casos).filter(c=>c._estado==='gestionado').concat(gestHistCuenta()).filter(c=>(!ag||c._agente===ag) && (!d||c._fg.slice(0,10)>=d) && (!h||c._fg.slice(0,10)<=h)); }
function diasHabiles(a,b){ const out=[]; const d=new Date(a+'T00:00:00'), f=new Date(b+'T00:00:00');
  while(d<=f && out.length<400){ const w=d.getDay(); if(w!==0&&w!==6) out.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`); d.setDate(d.getDate()+1); } return out; }
const dm=s=>`${s.slice(8,10)}/${s.slice(5,7)}`;
const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const mesTxt=s=>`${MESES[+s.slice(5,7)-1]} ${s.slice(2,4)}`;
const pct=(a,b)=>b?Math.round(a*1000/b)/10:0;
const fmt=n=>Number(n).toLocaleString('es-CO');
function nice(m){ if(m<=5) return 5; const p=Math.pow(10,Math.floor(Math.log10(m))); for(const k of [1,2,2.5,5,10]) if(k*p>=m) return k*p; return 10*p; }
const anchoDe=id=>Math.max(280,($(id).clientWidth||600));
function corta(t,max){ t=String(t||'(vacío)'); return t.length>max? t.slice(0,max-1)+'…' : t; }
function leyenda(items){ return `<div class="leyenda">${items.map(i=>`<span><i style="background:${i.color}"></i>${esc(i.nombre)}</span>`).join('')}</div>`; }
const vacioG=t=>`<div class="vacio">${t||'Sin datos para estos filtros.'}</div>`;
function colTipi(t){ const i=S.tipis.indexOf(t); if(i>=0&&i<8) return PAL[i]; return OTRO; }

/* Barras horizontales apiladas. rows:[{label,vals:[],tip,etq}] series:[{nombre,color}] */
function hbarSVG(id,rows,series,{pct100=false,maxLabel=26,maxFijo=0}={}){
  const W=anchoDe(id), LB=Math.min(260,Math.max(110,W*0.3)), bh=20, gap=12, H=rows.length*(bh+gap)+4;
  const tot0=r=>r.vals.reduce((a,b)=>a+b,0);
  const R=Math.max(pct100?56:44, 16+7.2*Math.max(...rows.map(r=>String(r.etq!=null?r.etq:fmt(tot0(r))).length)));
  maxLabel=Math.min(maxLabel, Math.floor((LB-14)/6.9));
  const tot=r=>r.vals.reduce((a,b)=>a+b,0), max=pct100?1:(maxFijo||Math.max(1,...rows.map(tot))), iw=W-LB-R;
  let g='';
  rows.forEach((r,i)=>{ const y=i*(bh+gap)+2, t=tot(r); let x=LB;
    g+=`<text x="${LB-10}" y="${y+bh/2+4}" text-anchor="end" class="lbl">${esc(corta(r.label,maxLabel))}</text>`;
    g+=`<rect x="${LB}" y="${y}" width="${iw}" height="${bh}" rx="4" style="fill:var(--sta-carril,#f2f5f7)"/>`;
    const segs=r.vals.map((v,k)=>({v,k})).filter(s=>s.v>0);
    segs.forEach((s,j)=>{ const w=pct100? (t? s.v/t*iw:0) : s.v/max*iw; const ww=Math.max(w-(j<segs.length-1?2:0),1);
      const tip=`<b>${esc(r.label)}</b><br><span style="color:${series[s.k].color}">●</span> ${esc(series[s.k].nombre)}: <b>${fmt(s.v)}</b> (${pct(s.v,t)} %)`;
      g+=`<rect x="${x}" y="${y}" width="${ww}" height="${bh}" rx="${segs.length===1?4:2}" fill="${series[s.k].color}" data-tip="${esc(tip)}"/>`; x+=w; });
    const ex=pct100? W-R+8 : x+8;
    g+=`<text x="${ex}" y="${y+bh/2+4}" class="val">${r.etq!=null?r.etq:fmt(t)}</text>`;
    if(r.tip) g+=`<rect x="0" y="${y-4}" width="${LB}" height="${bh+8}" fill="transparent" data-tip="${esc(r.tip)}"/>`;
  });
  return `<svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
/* Dona */
function donaSVG(items,total,centro){
  const R=88,r=56,cx=100,cy=100; let a0=-Math.PI/2, segs='';
  items.forEach(it=>{ const a1=a0+it.n/total*Math.PI*2, tip=`<b>${esc(it.nombre)}</b><br>${fmt(it.n)} · ${pct(it.n,total)} %`;
    if(items.length===1) segs+=`<circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="${it.color}" stroke-width="${R-r}" data-tip="${esc(tip)}"/>`;
    else { const lg=a1-a0>Math.PI?1:0, P=(rad,a)=>`${cx+rad*Math.cos(a)},${cy+rad*Math.sin(a)}`;
      segs+=`<path d="M${P(R,a0)} A${R},${R} 0 ${lg} 1 ${P(R,a1)} L${P(r,a1)} A${r},${r} 0 ${lg} 0 ${P(r,a0)}Z" fill="${it.color}" style="stroke:var(--card)" stroke-width="2" data-tip="${esc(tip)}"/>`; }
    a0=a1; });
  segs+=etiquetasDona(items,total,cx,cy,(R+r)/2);
  return `<div class="dona"><svg width="200" height="200" viewBox="0 0 200 200">${segs}<text x="${cx}" y="${cy+2}" text-anchor="middle" style="font-size:26px;font-weight:700;fill:var(--sta-titulo,#003C50)">${fmt(total)}</text><text x="${cx}" y="${cy+20}" text-anchor="middle" style="font-size:12px;fill:var(--muted)">${centro}</text></svg>
    <div class="leyenda">${items.map(it=>`<div data-tip="${esc(`<b>${esc(it.nombre)}</b><br>${fmt(it.n)} · ${pct(it.n,total)} %`)}"><span><i style="background:${it.color}"></i>${esc(corta(it.nombre,34))}</span><span><b>${fmt(it.n)}</b> <span class="muted">${pct(it.n,total)} %</span></span></div>`).join('')}</div></div>`;
}
// Pedido de Edwin (26/11): el número sobre cada porción. Solo donde cabe (≥ 4 % de la dona); el resto sigue en la leyenda.
function etiquetasDona(items,total,cx,cy,rad){
  if(!total) return ''; let a0=-Math.PI/2, g='';
  items.forEach(it=>{ const a=it.n/total*Math.PI*2, md=a0+a/2; a0+=a;
    if(items.length>1&&it.n/total<0.04) return;
    const x=items.length===1?cx:cx+rad*Math.cos(md), y=items.length===1?cy-rad:cy+rad*Math.sin(md);
    g+=`<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle" class="val-dona" style="pointer-events:none">${fmt(it.n)}</text>`; });
  return g;
}
// Color de una codificación: las 8 primeras de la lista con su color de siempre; las demás, la paleta en orden (ya no «Otros»).
function colTipiN(t,k){ const i=S.tipis.indexOf(t); return i>=0&&i<8? PAL[i] : PAL[k%PAL.length]; }
// Barras por un campo de la base (Entidad, Servicio) de una lista de gestiones.
// conCitas (agendas): pedido de Edwin (27/11, Fase STA14): UN solo número por barra, el más alto entre casos agendados
// y citas (las citas, que suelen ser más), con la etiqueta «agendas»; el largo y el orden van por ese número.
function valAgendas(o){ return Math.max(o.n,o.citas); }
function filasCampoGest(lista,campo,conCitas){ const mp=new Map();
  lista.forEach(c=>{ const k=String(c[campo]||'').trim()||'(vacío)'; const o=mp.get(k)||{n:0,citas:0}; o.n++; o.citas+=(c._citas||0); mp.set(k,o); });
  const v=o=>conCitas?valAgendas(o):o.n;
  return [...mp.entries()].sort((x,y)=>v(y[1])-v(x[1])||x[0].localeCompare(y[0],'es')).map(([k,o])=>({label:k,vals:[v(o)],
    etq:conCitas?`${fmt(v(o))} agendas`:fmt(o.n),
    tip:`<b>${esc(k)}</b><br>${conCitas?`Agendas: <b>${fmt(v(o))}</b>`:`Gestiones: <b>${fmt(o.n)}</b>`}`})); }
function agrupar(lista,fn,max=7){ const m=new Map(); lista.forEach(c=>{ const k=fn(c)||'(vacío)'; m.set(k,(m.get(k)||0)+1); });
  let a=[...m.entries()].sort((x,y)=>y[1]-x[1]); if(a.length>max+1){ const r=a.slice(max).reduce((s,x)=>s+x[1],0); a=a.slice(0,max).concat([['Otros',r]]); } return a; }
/* Líneas */
function lineaSVG(id,cats,series,{fmtX=dm,tipX=d=>`${dm(d)}/${d.slice(0,4)}`}={}){
  const W=anchoDe(id),H=250,L=44,R=30,T=16,B=30, iw=W-L-R, ih=H-T-B;
  const max=nice(Math.max(1,...series.flatMap(s=>s.vals)));
  const x=i=> L+(cats.length<2? iw/2 : i*iw/(cats.length-1)), y=v=> T+ih-v*ih/max;
  let g='';
  for(let k=0;k<=4;k++){ const v=max*k/4, yy=y(v); g+=`<line class="${k?'grid':'eje'}" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${fmt(Math.round(v*10)/10)}</text>`; }
  const paso=Math.max(1,Math.ceil(cats.length/Math.max(4,Math.floor(iw/70))));
  cats.forEach((d,i)=>{ if(i%paso===0||i===cats.length-1) g+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle">${fmtX(d)}</text>`; });
  series.forEach(s=>{ g+=`<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.vals.map((v,i)=>x(i)+','+y(v)).join(' ')}"/>`; });
  if(cats.length<=45) series.forEach(s=>s.vals.forEach((v,i)=>{ g+=`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}" style="stroke:var(--card)" stroke-width="2"/>`; }));
  const cw=cats.length<2? iw : iw/(cats.length-1);
  cats.forEach((d,i)=>{ const tip=`<b>${tipX(d)}</b><br>`+series.map(s=>`<span style="color:${s.color}">●</span> ${esc(s.nombre)}: <b>${fmt(s.vals[i])}</b>`).join('<br>');
    g+=`<rect x="${x(i)-cw/2}" y="${T}" width="${cw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"/>`; });
  if(cats.length<=45&&iw/Math.max(1,cats.length)>=26) series.forEach((s,k)=>s.vals.forEach((v,i)=>{ if(series.length>2&&!v) return; g+=`<text x="${x(i)}" y="${k%2?y(v)+16:y(v)-8}" text-anchor="middle" class="val">${fmt(v)}</text>`; }));
  else if(series.length<=4&&cats.length) series.forEach(s=>{ const v=s.vals[s.vals.length-1]; g+=`<text x="${x(cats.length-1)+8}" y="${y(v)-8}" class="val">${fmt(v)}</text>`; });
  return `<svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
/* Columnas apiladas */
function colSVG(id,cats,series,{fmtX=mesTxt}={}){
  const W=anchoDe(id),H=240,L=44,R=12,T=18,B=30, iw=W-L-R, ih=H-T-B;
  const tots=cats.map((_,i)=>series.reduce((s,x)=>s+x.vals[i],0)), max=nice(Math.max(1,...tots));
  const bw=Math.min(46,iw/cats.length*0.62), y=v=>T+ih-v*ih/max;
  let g='';
  for(let k=0;k<=4;k++){ const v=max*k/4, yy=y(v); g+=`<line class="${k?'grid':'eje'}" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${fmt(Math.round(v))}</text>`; }
  const paso=Math.max(1,Math.ceil(cats.length/Math.max(3,Math.floor(iw/56))));
  cats.forEach((c,i)=>{ const cx=L+iw*(i+.5)/cats.length; let base=0;
    const vis=series.map((s,k)=>({v:s.vals[i],k})).filter(z=>z.v>0);
    vis.forEach((z,j)=>{ const y0=y(base), y1=y(base+z.v), h=Math.max(y0-y1-(j<vis.length-1?2:0),1);
      const tip=`<b>${fmtX(c)}</b><br><span style="color:${series[z.k].color}">●</span> ${esc(series[z.k].nombre)}: <b>${fmt(z.v)}</b>${series.length>1?`<br>Total: ${fmt(tots[i])}`:''}`;
      g+=`<rect x="${cx-bw/2}" y="${y1}" width="${bw}" height="${h}" rx="${j===vis.length-1?4:1}" fill="${series[z.k].color}" data-tip="${esc(tip)}"/>`; base+=z.v; });
    if(tots[i]&&(cats.length<=14||iw/cats.length>=30)) g+=`<text x="${cx}" y="${y(tots[i])-6}" text-anchor="middle" class="val">${fmt(tots[i])}</text>`;
    if(i%paso===0) g+=`<text x="${cx}" y="${H-10}" text-anchor="middle">${fmtX(c)}</text>`; });
  return `<svg class="ch" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}

function pintarGraficas(){
  const ag=$('grAg').value, ent=$('grEnt').value, serv=$('grServ').value, d=$('grD').value, h=$('grH').value;
  const pasaBase=c=>(!ent||(c['Entidad']||'')===ent)&&(!serv||(c['Servicio']||'')===serv);
  const gs=gestFiltradas(ag,d,h).filter(pasaBase), ef=new Set(S.efectivas);
  const esEf=c=>ef.has(c._tipi);
  $('grEfInfo').textContent = S.efectivas.length? `Efectivas: ${S.efectivas.join(', ')}` : 'No hay tipificaciones marcadas como efectivas';
  const todos=Object.values(S.casos).filter(pasaBase);
  const pend=todos.filter(c=>c._agente&&c._estado==='pendiente'&&(!ag||c._agente===ag)).length, nEf=gs.filter(esEf).length, citas=gs.reduce((t,c)=>t+(c._citas||0),0);
  $('grKpis').innerHTML=[['Gestionados',fmt(gs.length)],['Agendas',fmt(citas)],['Efectividad (citas ÷ gestiones)',fmt(pct(citas,gs.length))+' %'],['Pendientes en bandejas',fmt(pend)],['Sin asignar',fmt(todos.filter(c=>!c._agente&&c._estado==='pendiente').length)]]
    .map(([a,b])=>`<div class="kpi"><small>${a}</small><b>${b}</b></div>`).join('');

  // asesores a mostrar
  const porAg=new Map(); gs.forEach(c=>{ const o=porAg.get(c._agente)||{g:0,e:0,citas:0,t:{}}; o.g++; if(esEf(c)){o.e++; o.citas+=(c._citas||0);} o.t[c._tipi]=(o.t[c._tipi]||0)+1; porAg.set(c._agente,o); });
  const ases=S.agentes.filter(a=>(!ag||a.id===ag)&&(a.activo!==false||porAg.has(a.id)));
  const dat=id=>porAg.get(id)||{g:0,e:0,citas:0,t:{}};

  // 1. Agendas por asesor
  const asesAg=ases.filter(a=>{ const o=dat(a.id); return o.e>0||o.citas>0; }); // pedido de Edwin 25/11: solo con agendas o citas
  if(!asesAg.length) $('grAgAs').innerHTML=vacioG(ases.length?'Ninguna asesora tiene agendas ni citas con estos filtros.':'No hay asesores.');
  else { const rows=asesAg.map(a=>{ const o=dat(a.id); return {label:a.nombre,vals:[o.e],etq:`${fmt(o.e)} agendas · ${fmt(o.citas)} citas`,
      tip:`<b>${esc(a.nombre)}</b><br>Agendas: <b>${fmt(o.e)}</b><br>Citas: <b>${fmt(o.citas)}</b><br>Gestionados: ${fmt(o.g)}<br>Efectividad: ${pct(o.citas,o.g)} %`}; }).sort((x,y)=>y.vals[0]-x.vals[0]);
    $('grAgAs').innerHTML=hbarSVG('grAgAs',rows,[{nombre:'Agendas',color:G_AG}]); }

  // Pedido de Edwin (26/11): agendas y gestiones por entidad y por servicio (mismos filtros de arriba).
  const agen=gs.filter(esEf);
  [['grAgEnt','Entidad'],['grAgServ','Servicio']].forEach(([id,campo])=>{ $(id).innerHTML= agen.length? hbarSVG(id,filasCampoGest(agen,campo,true),[{nombre:'Agendas',color:G_AG}],{maxLabel:30}) : vacioG('No hay agendas con estos filtros.'); });
  [['grGeEnt','Entidad'],['grGeServ','Servicio']].forEach(([id,campo])=>{ $(id).innerHTML= gs.length? hbarSVG(id,filasCampoGest(gs,campo,false),[{nombre:'Gestiones',color:G_LIN}],{maxLabel:30}) : vacioG(); });

  const asesCon=ases.filter(a=>dat(a.id).g>0);
  if(!gs.length){ ['grDona','grEfec','grDia'].forEach(id=>$(id).innerHTML=vacioG()); }
  else {
    // 3. Dona general
    const cnt=agrupar(gs,c=>c._tipi,Infinity); // pedido de Edwin (26/11): TODAS las codificaciones, sin «Otros»
    $('grDona').innerHTML=donaSVG(cnt.map(([t,n],k)=>({nombre:t,n,color:colTipiN(t,k)})),gs.length,'gestiones');
    // 4. Efectividad
    const rowsE=asesCon.map(a=>{ const o=dat(a.id), p=pct(o.citas,o.g); return {label:a.nombre,vals:[p],etq:`${p} %`,tip:`<b>${esc(a.nombre)}</b><br>${fmt(o.citas)} citas ÷ ${fmt(o.g)} gestionados<br>Efectividad: <b>${p} %</b>`}; }).sort((x,y)=>y.vals[0]-x.vals[0]);
    $('grEfec').innerHTML=hbarSVG('grEfec',rowsE,[{nombre:'Efectividad',color:'#2e7d32'}],{maxFijo:Math.max(100,...rowsE.map(r=>r.vals[0]))});
    // 5. Por día
    const fechas=gs.map(c=>c._fg.slice(0,10)).sort();
    const dias=diasHabiles(d||fechas[0],h||fechas[fechas.length-1]); fechas.forEach(f=>{ if(!dias.includes(f)) dias.push(f); }); dias.sort();
    const serD=[{nombre:'Gestiones',color:G_LIN,vals:dias.map(x=>gs.filter(c=>c._fg.startsWith(x)).length)},{nombre:'Citas',color:'#eda100',vals:dias.map(x=>gs.filter(c=>c._fg.startsWith(x)).reduce((t,c)=>t+(c._citas||0),0))}];
    $('grDia').innerHTML=lineaSVG('grDia',dias,serD)+leyenda(serD);
  }

  // ---- Por campos de la base
  const U = todos; // toda la base (solo aplican los filtros de Entidad y Servicio)
  const est=c=> c._estado==='gestionado'?'Gestionado':c._estado==='fuera'?'Fuera de gestión':(c._agente?'Pendiente':'Sin asignar');
  const SER = ['Gestionado','Pendiente','Sin asignar','Fuera de gestión'].map(n=>({nombre:n,color:C_UNIV[n]}));
  const parte = c=>['Gestionado','Pendiente','Sin asignar','Fuera de gestión'].indexOf(est(c));
  $('univInfo').textContent = `Composición de toda la base: ${fmt(U.length)} casos${ent||serv?' (filtrada por Entidad/Servicio)':''}. Las barras se dividen en gestionado, pendiente, sin asignar y fuera de gestión (Estado distinto de «En proceso» o «Sin contacto»).`;
  const ids=['grEnt2','grServ2','grEst','grCups'];
  if(!U.length){ ids.forEach(id=>$(id).innerHTML=vacioG()); return; }
  const filasPor=(campo,max)=>{ const m=new Map(); U.forEach(c=>{ const k=c[campo]||'(vacío)'; if(!m.has(k)) m.set(k,SER.map(()=>0)); m.get(k)[parte(c)]++; });
    let a=[...m.entries()].sort((x,y)=>y[1].reduce((s,v)=>s+v,0)-x[1].reduce((s,v)=>s+v,0));
    if(max && a.length>max) a=a.slice(0,max);
    return a.map(([k,v])=>{ const t=v.reduce((s,x)=>s+x,0); return {label:k,vals:v,tip:`<b>${esc(k)}</b><br>Total: ${fmt(t)}<br>`+SER.map((s,i)=>v[i]?`<span style="color:${s.color}">●</span> ${s.nombre}: ${fmt(v[i])} (${pct(v[i],t)} %)`:'').filter(Boolean).join('<br>')}; }); };
  $('grEnt2').innerHTML=hbarSVG('grEnt2',filasPor('Entidad',15),SER,{maxLabel:22})+leyenda(SER);
  const servG=agrupar(U,c=>(c['Servicio']||'').trim(),7);
  $('grServ2').innerHTML=donaSVG(servG.map(([t,n],i)=>({nombre:t,n,color:t==='Otros'?OTRO:PAL[i%8]})),U.length,'casos');
  const estG=agrupar(U,c=>(c['Estado']||'').trim(),7);
  $('grEst').innerHTML=donaSVG(estG.map(([t,n],i)=>({nombre:t,n,color:t==='Otros'?OTRO:PAL[i%8]})),U.length,'casos');
  $('grCups').innerHTML=hbarSVG('grCups',filasPor('Descripcion Cups',10),SER,{maxLabel:30})+leyenda(SER);
}

/* ---------- Gestionados (supervisor) ---------- */
function cambiosEstado(){
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
  box.innerHTML=`<div class="tw"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Numero Autorizacion</th><th>Cambio</th><th>Efecto</th><th>Hecho por</th><th>Cómo</th></tr></thead><tbody>
    ${l.slice(0,max).map(({c,x})=>`<tr><td class="nw">${verFecha(x.fecha)}</td><td class="nw">${String(x.fecha).slice(11,19)}</td><td class="nw">${esc(c['Numero Autorizacion'])}</td><td>${esc(x.de||'(vacío)')} → ${esc(x.a||'')}</td><td>${x.sale?'Salió de la gestión'+(x.agente?' (era de '+esc(nombreAgente(String(x.agente)))+')':''):x.vuelve?'Volvió a disponibles':'—'}</td><td>${esc(x.por||'—')}</td><td>${x.origen==='actualizar'?'Actualizar estado':'Carga de la base'}</td></tr>`).join('')}
  </tbody></table></div>${l.length>max?`<p class="muted" style="margin:8px 0 0;font-size:12px">Se muestran los ${max} más recientes de ${l.length.toLocaleString('es-CO')}. Usa el buscador o las fechas para acotar.</p>`:''}`;
}
function gestSupLista(){
  const q=$('gsQ').value.trim().toLowerCase(), ti=$('gsTi').value;
  return gestFiltradas($('gsAg').value,$('gsD').value,$('gsH').value)
    .filter(c=>(!ti||c._tipi===ti)&&(!q||String(c['Numero Autorizacion']).toLowerCase().includes(q)))
    .sort((a,b)=>b._fg.localeCompare(a._fg));
}
function pintarGestSup(){
  pintarCambios();
  const l=gestSupLista(), tot=Object.values(S.casos).filter(c=>c._estado==='gestionado').length+gestHistCuenta().length;
  const max=20;
  const tis=[...new Set([...S.tipis,...Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi).map(c=>c._tipi)])];
  const vr=$('gsRegTi').value; $('gsRegTi').innerHTML='<option value="">Elige la codificación</option>'+tis.map(t=>{ const n=Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi===t).length; return `<option value="${esc(t)}">${esc(t)} (${n.toLocaleString('es-CO')})</option>`; }).join(''); $('gsRegTi').value=vr;
  const vivos=new Set(l.map(c=>c._id)); [...selGest].forEach(id=>{ if(!vivos.has(id)) selGest.delete(id); });
  $('gsRegSelBtn').disabled=!selGest.size; $('gsRegSelBtn').textContent=selGest.size?`Regresar marcados (${selGest.size})`:'Regresar marcados';
  $('gsInfo').innerHTML = `${l.length.toLocaleString('es-CO')} gestiones${l.length!==tot?` (de ${tot.toLocaleString('es-CO')} en total)`:''}`
    + (l.length>max?` · Se muestran las últimas ${max}. Para ver todas usa <b>Exportar a Excel</b>.`:'');
  if(!l.length){ $('gsTabla').innerHTML='<div class="card vacio">No hay gestiones para mostrar.</div>'; return; }
  const vis=l.slice(0,max), marcables=vis.filter(c=>!c._virtual), todos=marcables.length>0&&marcables.every(c=>selGest.has(c._id));
  $('gsTabla').innerHTML=`<div class="tw"><table><thead><tr><th><input type="checkbox" aria-label="Marcar todos los mostrados" ${todos?'checked':''} onchange="STAapp.marcarGestTodos(this.checked)"></th><th>Fecha</th><th>Hora</th><th>Numero Autorizacion</th><th>Codificación</th><th>Citas</th><th>Agente</th></tr></thead><tbody>
    ${vis.map(c=>`<tr><td><input type="checkbox" aria-label="Marcar ${esc(c['Numero Autorizacion'])}" ${selGest.has(c._id)?'checked':''}${c._virtual?' disabled title="Gestión del histórico: el caso ya está disponible"':''} onchange="STAapp.marcarGest(${jsArg(c._id)},this.checked)"></td><td class="nw">${verFecha(c._fg)}</td><td class="nw">${c._fg.slice(11,19)==='00:00:00'?'':c._fg.slice(11,19)}</td><td class="nw">${esc(c['Numero Autorizacion'])}</td><td><span class="tag ${S.efectivas.includes(c._tipi)?'v':''}">${esc(c._tipi)}</span></td><td>${c._citas||''}</td><td>${esc(nombreAgente(c._agente))}</td></tr>`).join('')}
  </tbody></table></div>${l.length>max?`<div class="fila" style="margin-top:10px"><span class="muted">Mostrando las últimas ${max} de ${l.length.toLocaleString('es-CO')}.</span><button class="btn pri sm" onclick="STAapp.exportarGestionados()">Descargar todas (Excel)</button></div>`:''}`;
}
const selGest=new Set();
function marcarGest(id,on){ if(on) selGest.add(id); else selGest.delete(id); pintarGestSup(); }
function marcarGestTodos(on){ gestSupLista().slice(0,20).filter(c=>!c._virtual).forEach(c=>{ if(on) selGest.add(c._id); else selGest.delete(c._id); }); pintarGestSup(); }
async function regresarPorTipi(){
  const t=$('gsRegTi').value; if(!t) return toast('Elige la codificación');
  const n=Object.values(S.casos).filter(c=>c._estado==='gestionado'&&c._tipi===t).length; if(!n) return toast('No hay gestionados con esa codificación');
  if(!await confirmar(`¿Regresar a disponibles los ${n.toLocaleString('es-CO')} casos gestionados como «${t}»? Vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».`,{titulo:'Regresar a disponibles',ok:'Regresar'})) return;
  const r=await accion(()=>API.regresar({tipi:t}),'No se pudo regresar');
  await refrescar(); selGest.clear(); pintarGestSup(); if(r) toast(`${r.regresados} casos regresados a disponibles`);
}
async function regresarSel(){
  const ids=[...selGest]; if(!ids.length) return toast('Marca al menos un caso');
  if(!await confirmar(`¿Regresar a disponibles los ${ids.length} casos marcados? Vuelven a la bolsa libre para reasignarlos; su gestión queda en «Gestiones anteriores».`,{titulo:'Regresar a disponibles',ok:'Regresar'})) return;
  const r=await accion(()=>API.regresar({numeros:ids}),'No se pudo regresar');
  await refrescar(); selGest.clear(); pintarGestSup(); if(r) toast(`${r.regresados} casos regresados a disponibles`);
}
function exportarGestionados(){
  const l=gestSupLista(); if(!l.length) return toast('No hay gestiones para exportar');
  const ws=XLSX.utils.json_to_sheet(l.map(c=>({'Fecha':verFecha(c._fg),'Hora':c._fg.slice(11,19),'Numero Autorizacion':c['Numero Autorizacion'],'Codificación':c._tipi,'Citas agendadas':c._citas||'','Observación':c._obs||'','Volver a llamar':c._rell&&c._rell.estado==='pendiente'?verFecha(c._rell.cuando,true):'','Gestiones anteriores':(c._prev||[]).map(p=>`${verFecha(p.fg,true)} ${p.tipi}: ${p.obs||''}`).join(' | '),'Agente':nombreAgente(c._agente)})));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Gestionados'); XLSX.writeFile(wb,`Gestionados_STA_${ahora().slice(0,10)}.xlsx`);
}

/* ---------- Tipificaciones ---------- */
function pintarTipis(){
  $('tipiLista').innerHTML = S.tipis.length? S.tipis.map((t,i)=>`<div class="tipi-row"><span>${esc(t)}</span><div class="fila">
    <label class="chk"><input type="checkbox" ${S.efectivas.includes(t)?'checked':''} onchange="STAapp.marcarEfectiva(${i},this.checked)"> Efectiva</label>
    <button class="btn sm" ${i===0?'disabled':''} onclick="STAapp.moverTipi(${i},-1)">↑</button><button class="btn sm" ${i===S.tipis.length-1?'disabled':''} onclick="STAapp.moverTipi(${i},1)">↓</button>
    <button class="btn sm peligro" onclick="STAapp.borrarTipi(${i})">Quitar</button></div></div>`).join('') : `<p class="muted">No hay tipificaciones. Agrega al menos una.</p>`;
}
async function marcarEfectiva(i,on){ const t=S.tipis[i], T=S.tipis.slice(), E=S.efectivas.filter(x=>x!==t); if(on) E.push(t);
  if(await (async()=>{ const c=await accion(()=>API.tipis(T,E)); await refrescar(); pintarTipis(); return c; })()) toast(on?`"${t}" cuenta como efectiva`:`"${t}" ya no cuenta como efectiva`); }
async function crearTipi(){ const t=$('nuevaTipi').value.trim(); if(!t) return;
  if(S.tipis.some(x=>x.toLowerCase()===t.toLowerCase())) return toast('Ya existe'); const T=S.tipis.concat([t]), E=S.efectivas.slice();
  if(await (async()=>{ const c=await accion(()=>API.tipis(T,E)); await refrescar(); pintarTipis(); return c; })()) $('nuevaTipi').value=''; }
async function moverTipi(i,d){ const T=S.tipis.slice(), E=S.efectivas.slice(); [T[i],T[i+d]]=[T[i+d],T[i]]; const c=await accion(()=>API.tipis(T,E)); await refrescar(); pintarTipis(); return c; }
async function borrarTipi(i){ const t=S.tipis[i];
  if(!await confirmar(`¿Quitar "${t}"? Las gestiones ya registradas la conservan.`,{titulo:'Quitar tipificación',ok:'Quitar',peligro:true})) return;
  const T=S.tipis.filter(x=>x!==t), E=S.efectivas.filter(x=>x!==t); if(await (async()=>{ const c=await accion(()=>API.tipis(T,E)); await refrescar(); pintarTipis(); return c; })()) toast(`"${t}" quitada`); }

/* =====================================================================
   Eventos de carga
===================================================================== */
const drop=$('drop');
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('on');}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('on');}));
drop.addEventListener('drop',ev=>{ const f=ev.dataTransfer.files[0]; if(f) procesarCarga(f); });
$('archivo').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarCarga(f); e.target.value=''; });
const dropHist=$('dropHist');
['dragenter','dragover'].forEach(e=>dropHist.addEventListener(e,ev=>{ev.preventDefault();dropHist.classList.add('on');}));
['dragleave','drop'].forEach(e=>dropHist.addEventListener(e,ev=>{ev.preventDefault();dropHist.classList.remove('on');}));
dropHist.addEventListener('drop',ev=>{ const f=ev.dataTransfer.files[0]; if(f) revisarHistorico(f); });
$('archivoHist').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) revisarHistorico(f); e.target.value=''; });
const dropEst=$('dropEst');
['dragenter','dragover'].forEach(e=>dropEst.addEventListener(e,ev=>{ev.preventDefault();dropEst.classList.add('on');}));
['dragleave','drop'].forEach(e=>dropEst.addEventListener(e,ev=>{ev.preventDefault();dropEst.classList.remove('on');}));
dropEst.addEventListener('drop',ev=>{ const f=ev.dataTransfer.files[0]; if(f) procesarEstados(f); });
$('archivoEst').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) procesarEstados(f); e.target.value=''; });

var STAapp = { estadoVacio, cargarEstado, accion, refrescar, isoLocal, ahora, aFecha, verFecha, verValor, normClave, normHeader, nombreAgente, cerrarModal, dialogo, mostrar, salir, iniciar, abrirPanelAgente, tabAgente, misPendientes, pintarBandeja, abrirCodificar, pideCitas, esVolver, cambioTipi, guardarCodificacion, misRell, pintarRellamadas, pitar, revisarRellamadas, pintarGestionados, tabSup, pintarBase, leerArchivo, procesarCarga, casosDeCarga, pedirBorrarCarga, borrarCarga, descargarCarga, descargarPlantilla, procesarEstados, descargarPlantillaEstado, revisarHistorico, resumenHistorico, confirmarHistorico, cancelarHistorico, exportarExcel, contar, pintarAsignar, togglePend, pendDe, selDe, pintarPendTodos, selUno, selCantidad, selTodos, devolverSel, pasarSel, selAgente, disponibles, filtrar, opciones, msHTML, toggleMs, filtrarMs, msTodos, msNormalizar, msTexto, msRefrescarTexto, marcarMs, limpiarMs, cerrarMs, todoMs, setF, actualizarConteo, limpiarFiltros, pintarPanelAsig, asignar, avisoCantidad, aceptarExistentes, ejecutarAsignacion, quitarPendientes, tipShow, mesActualSta, rangoMes, mesesConGestion, llenarMeses, ponerRango, elegirMes, llenarSelects, limpiarGr, gestHistCuenta, gestFiltradas, diasHabiles, nice, corta, leyenda, colTipi, hbarSVG, donaSVG, etiquetasDona, colTipiN, valAgendas, filasCampoGest, agrupar, lineaSVG, colSVG, pintarGraficas, cambiosEstado, pintarCambios, gestSupLista, pintarGestSup, marcarGest, marcarGestTodos, regresarPorTipi, regresarSel, exportarGestionados, pintarTipis, marcarEfectiva, crearTipi, moverTipi, borrarTipi, $: $ };
if (typeof window !== 'undefined') window.STAapp = STAapp;
return { iniciar: iniciar, refrescar: refrescar, vista: function(){ return VISTA; }, activar: function(){ if (typeof window !== 'undefined') window.STAapp = STAapp; } };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { STA_MARKUP: STA_MARKUP, staCrearApp: staCrearApp };
