// orlant-equidad-app.js — «Equidad profesionales» de ORLANT (HTML de Edwin dentro de la plataforma).
// GENERADO por scripts/orlant/generar-equidad.js desde el HTML de Edwin (fuera del repo): no editar a mano.
// Cambios respecto al HTML, y nada más:
//   - sin los datos que traía pegados (SEED_* vacías) ni SheetJS: las bases salen de /api/orlant/equidad/estado;
//   - corre dentro de un Shadow DOM (ROOT); sin guardar en el navegador, sin las pantallas de inicio y de carga, sin
//     renombrar pestañas ni exportar (la carga va por «Cargar bases», centro-equidad.js);
//   - pestañas Pólizas / Medicina prepagada / Particulares, filtro «Profesional» y, en la base sin entidad
//     (Particulares), sin el filtro de entidad;
//   - etiquetas accesibles y ajustes para el celular (orlant-equidad-app.css).
/* eslint-disable */
var EQ_MARKUP = "<div class=\"eq-app\">\n<nav class=\"tabs\" id=\"tabs\" aria-label=\"Bases de equidad\"></nav>\n<div class=\"main\" id=\"main\"><div class=\"eq-cargando\" role=\"status\">Cargando…</div></div>\n<div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\"></div>\n</div>";

function eqCrearApp(ROOT, API){
// ================== CONFIGURACIÓN ==================
const SEED_POLIZA = [];
const SEED_PREPAGADAS = [];
const SEED_PARTICULARES = [];
const TABS = [
  {id:'poliza', grupo:'polizas', name:'Pólizas', seed: SEED_POLIZA},
  {id:'base2', grupo:'prepagada', name:'Medicina prepagada', seed: SEED_PREPAGADAS},
  {id:'base3', grupo:'particulares', name:'Particulares', seed: SEED_PARTICULARES},
];
// Columnas esperadas (se detectan sin importar mayúsculas/tildes)
const COLS = {
  sede:['CODIGO_SEDE','SEDE'],
  esp:['ESPNOM','ESPECIALIDAD'],
  prof:['MEDNOM','PROFESIONAL','MEDICO','NOMBRE_MEDICO'],
  fecha:['FECHA_CITA','FECHA'],
  ent:['NOMBRE_ENTIDAD','ENTIDAD'],
};
const ICONS={
 logo:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8"/></svg>',
 upload:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
 chart:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>'
};

// ================== ESTADO ==================
const state = {active:'poliza', view:'resultados', tabs:{}};
TABS.forEach(t=>{
  state.tabs[t.id] = {name:t.name, rows:[], source:'', loadedAt:'', conEntidad:true,
    f:{sede:'',esp:'',ent:'',prof:'',desde:'',hasta:'',min:0,tol:20}, sort:{k:'n',d:-1}};
});
function persist(){} // los datos viven en el servidor (/api/orlant/equidad)

// ================== UTILIDADES ==================
const $ = s=>ROOT.querySelector(s);
const esc = s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n,d=0)=>Number(n).toLocaleString('es-CO',{minimumFractionDigits:d,maximumFractionDigits:d});
const norm = s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const cleanName = s=>String(s||'').replace(/\s+/g,' ').trim();
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',3500);}
function pad(n){return String(n).padStart(2,'0')}
function toISO(v){
  if(v==null||v==='') return '';
  if(v instanceof Date && !isNaN(v)) return v.getFullYear()+'-'+pad(v.getMonth()+1)+'-'+pad(v.getDate());
  if(typeof v==='number'){ const d=new Date(Math.round((v-25569)*864e5)); return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()); }
  const s=String(v).trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return m[1]+'-'+pad(m[2])+'-'+pad(m[3]);
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if(m) return m[3]+'-'+pad(m[2])+'-'+pad(m[1]); // dd/mm/aaaa
  return '';
}
const DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
function dLabel(iso){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);return {d:pad(d)+'/'+pad(m),w:DIAS[dt.getDay()]};}

// ================== CÁLCULOS ==================
function gini(vals){
  const v=vals.filter(x=>x>=0).sort((a,b)=>a-b); const n=v.length; if(n<2) return 0;
  const s=v.reduce((a,b)=>a+b,0); if(!s) return 0;
  let cum=0; v.forEach((x,i)=>cum+=(i+1)*x);
  return (2*cum)/(n*s)-(n+1)/n;
}
function filtered(T){
  const f=T.f;
  return T.rows.filter(r=>(!f.sede||r.sede===f.sede)&&(!f.esp||r.esp===f.esp)&&(!f.ent||r.ent===f.ent)&&(!f.prof||r.prof===f.prof)
    &&(!f.desde||r.fecha>=f.desde)&&(!f.hasta||r.fecha<=f.hasta));
}
function analyze(rows,T){
  const tol=(+T.f.tol||0)/100, min=+T.f.min||0;
  const map=new Map();
  rows.forEach(r=>{
    let p=map.get(r.prof); if(!p){p={prof:r.prof,n:0,dias:new Set(),sedes:{},esps:new Set()};map.set(r.prof,p);}
    p.n++; if(r.fecha) p.dias.add(r.fecha); p.sedes[r.sede]=(p.sedes[r.sede]||0)+1; p.esps.add(r.esp);
  });
  const all=[...map.values()];
  const incl=all.filter(p=>p.n>=min);
  const totIncl=incl.reduce((a,p)=>a+p.n,0);
  const ideal=incl.length?totIncl/incl.length:0;
  all.forEach(p=>{
    p.inc=p.n>=min; p.ndias=p.dias.size; p.cpd=p.ndias?p.n/p.ndias:0;
    p.share=rows.length?p.n/rows.length:0;
    p.ideal=p.inc?ideal:null; p.dev=p.inc?p.n-ideal:null; p.devp=p.inc&&ideal?(p.n-ideal)/ideal:null;
    p.estado=!p.inc?'excl':(p.devp>tol?'over':(p.devp<-tol?'under':'ok'));
  });
  const vals=incl.map(p=>p.n);
  const mean=ideal, sd=vals.length?Math.sqrt(vals.reduce((a,x)=>a+(x-mean)**2,0)/vals.length):0;
  const g=gini(vals);
  const max=vals.length?Math.max(...vals):0, minv=vals.length?Math.min(...vals):0;
  const okN=incl.filter(p=>p.estado==='ok').length;
  const top=[...incl].sort((a,b)=>b.n-a.n); const top3=top.slice(0,3).reduce((a,p)=>a+p.n,0);
  return {all,incl,ideal,g,eq:1-g,cv:mean?sd/mean:0,max,minv,okN,top3share:totIncl?top3/totIncl:0,total:rows.length};
}

// ================== RENDER ==================
function renderTabs(){
  $('#tabs').innerHTML=TABS.map(t=>`<button type="button" class="${state.active===t.id?'active':''}" aria-pressed="${state.active===t.id}" data-t="${t.id}">${esc(state.tabs[t.id].name)}</button>`).join('');
  ROOT.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{state.active=b.dataset.t;render();});
}
function opts(list,sel,all){return `<option value="">${all}</option>`+list.map(v=>`<option ${v===sel?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');}
const uniq=(rows,k)=>[...new Set(rows.map(r=>r[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

function render(){
  $('#tabs').style.display='flex';
  renderResultados();
}
function go(v){state.view=v;window.scrollTo(0,0);render();}
function renderNav(){
  $('#topnav').style.display=state.view==='home'?'none':'flex';
  $('#topnav').innerHTML=`<div class="seg"><button data-v="home">← Inicio</button></div>`;
  ROOT.querySelectorAll('#topnav [data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
}
function baseInfo(T){
  if(!T.rows.length) return null;
  const f=uniq(T.rows,'fecha');
  return {n:T.rows.length,prof:uniq(T.rows,'prof').length,desde:f[0],hasta:f[f.length-1]};
}
const fmtD=iso=>iso?dLabel(iso).d+'/'+iso.slice(0,4):'';
function renderHome(){
  const cargadas=TABS.filter(t=>state.tabs[t.id].rows.length).length;
  $('#main').innerHTML=`<div class="home">
    <h2 class="home-t">¿Qué quieres hacer?</h2>
    <p class="home-s">Primero carga las bases del periodo y luego revisa los resultados de equidad de cada una.</p>
    <div class="home-grid">
      <button class="home-card" data-v="cargar">
        <div class="hc-ic">${ICONS.upload}</div>
        <div class="hc-t">Cargar bases</div>
        <div class="hc-d">Sube el Excel de Póliza, Medicinas prepagadas y Particulares. Cada archivo reemplaza la base anterior de su tipo.</div>
        <div class="hc-f">${cargadas} de ${TABS.length} bases cargadas</div>
      </button>
      <button class="home-card" data-v="resultados" ${cargadas?'':'disabled'}>
        <div class="hc-ic">${ICONS.chart}</div>
        <div class="hc-t">Ver resultados</div>
        <div class="hc-d">Índice de equidad, mapa de calor, reparto por profesional, por sede y por entidad.</div>
        <div class="hc-f">${cargadas?'Listo para consultar':'Primero carga al menos una base'}</div>
      </button>
    </div></div>`;
  ROOT.querySelectorAll('.home-card').forEach(b=>b.onclick=()=>go(b.dataset.v));
}
function renderCargar(){
  $('#main').innerHTML=`<div class="title-row"><span class="tabname" style="border:0">Cargar bases</span><span class="hint">Arrastra el archivo a la base que corresponde o haz clic para buscarlo</span></div>
  <div class="load-grid">`+TABS.map(t=>{const T=state.tabs[t.id],I=baseInfo(T);
    return `<div class="card load-card" style="margin-top:0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>${esc(T.name)}</h3>${I?'<span class="pill ok">Cargada</span>':'<span class="pill under">Sin base</span>'}</div>
      <div class="drop" data-t="${t.id}">${ICONS.upload}<div><b>Arrastra aquí el Excel</b><br><span>o haz clic para seleccionarlo (.xlsx, .xls, .csv)</span></div></div>
      ${I?`<div class="info">
        <div><span>Archivo</span><b title="${esc(T.source)}">${esc(T.source)}</b></div>
        <div><span>Citas</span><b>${fmt(I.n)}</b></div>
        <div><span>Profesionales</span><b>${I.prof}</b></div>
        <div><span>Periodo</span><b>${fmtD(I.desde)} – ${fmtD(I.hasta)}</b></div>
        ${T.loadedAt?`<div><span>Cargada</span><b>${esc(T.loadedAt)}</b></div>`:''}
      </div>`:'<div class="info"><div class="desc" style="margin:0">Columnas necesarias: <b>MEDNOM</b> y <b>FECHA_CITA</b>. Opcionales: CODIGO_SEDE, ESPNOM, NOMBRE_ENTIDAD.</div></div>'}
      ${I?`<button class="btn" data-see="${t.id}" style="margin-top:14px;width:100%">Ver resultados de ${esc(T.name)}</button>`:''}
    </div>`;}).join('')+`</div>`;
  ROOT.querySelectorAll('.drop').forEach(d=>{
    d.onclick=()=>{pendingTab=d.dataset.t;$('#fileInput').click();};
    d.ondragover=e=>{e.preventDefault();d.classList.add('over');};
    d.ondragleave=()=>d.classList.remove('over');
    d.ondrop=e=>{e.preventDefault();d.classList.remove('over');const f=e.dataTransfer.files[0];if(f){pendingTab=d.dataset.t;readFile(f);}};
  });
  ROOT.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{state.active=b.dataset.see;go('resultados');});
}
function renderResultados(){
  renderTabs();
  const id=state.active, T=state.tabs[id];
  const titleRow=`<div class="title-row"><h2 class="tabname">${esc(T.name)}</h2></div>`;
  if(!T.rows.length){
    $('#main').innerHTML=titleRow+`<div class="empty"><h2>Esta pestaña aún no tiene base</h2>
      <p>Carga el Excel de la base (.xlsx o .csv). Debe tener, como mínimo, la columna del profesional (<b>MEDNOM</b>) y la fecha de la cita (<b>FECHA_CITA</b>).<br>Opcionales: CODIGO_SEDE, ESPNOM, NOMBRE_ENTIDAD.</p>
      <p>Se carga en <b>Cargar bases</b> → ORLANT → «Equidad profesionales».</p></div>`;
    bindCommon(); return;
  }
  T.f.min=0; T.f.tol=20;
  const f=T.f, rows=filtered(T), A=analyze(rows,T);
  const fechas=uniq(T.rows,'fecha'); const fmin=fechas[0]||'', fmax=fechas[fechas.length-1]||'';
  const ents=uniq(T.rows,'ent');
  const excl=A.all.filter(p=>!p.inc).length;

  let html=titleRow+`
  <div class="toolbar">
    <div class="field"><label>Sede</label><select data-f="sede" aria-label="Sede">${opts(uniq(T.rows,'sede'),f.sede,'Todas las sedes')}</select></div>
    <div class="field"><label>Especialidad</label><select data-f="esp" aria-label="Especialidad">${opts(uniq(T.rows,'esp'),f.esp,'Todas')}</select></div>
    ${T.conEntidad?`<div class="field"><label>Entidad</label><select data-f="ent" aria-label="Entidad">${opts(ents,f.ent,'Todas las entidades')}</select></div>`:''}
    <div class="field"><label>Profesional</label><select data-f="prof" aria-label="Profesional">${opts(uniq(T.rows,'prof'),f.prof,'Todos los profesionales')}</select></div>
    <div class="field"><label>Desde</label><input type="date" data-f="desde" aria-label="Desde" value="${f.desde}" min="${fmin}" max="${fmax}"></div>
    <div class="field"><label>Hasta</label><input type="date" data-f="hasta" aria-label="Hasta" value="${f.hasta}" min="${fmin}" max="${fmax}"></div>
    <button type="button" class="btn ghost" id="btnClear">Limpiar filtros</button>
  </div>
  <div class="meta">Fuente: <b>${esc(T.source||'—')}</b>${T.loadedAt?' · cargada '+esc(T.loadedAt):''} · ${fmt(T.rows.length)} citas en la base · periodo ${fmin?dLabel(fmin).d+'/'+fmin.slice(0,4):''} a ${fmax?dLabel(fmax).d+'/'+fmax.slice(0,4):''}</div>
  ${excl?`<div class="warn" style="display:block">${excl} profesional(es) con menos de ${f.min} citas quedan fuera del cálculo de equidad (se muestran en gris en el gráfico).</div>`:''}
  <div class="kpis">
    <div class="kpi"><div class="l"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>Citas en el filtro</div><div class="v">${fmt(A.total)}</div><div class="h">${fmt(uniq(rows,'fecha').length)} días con agenda</div></div>
    <div class="kpi"><div class="l"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.5 3.5 5.2"/></svg>Profesionales medidos</div><div class="v">${A.incl.length}</div><div class="h">${A.all.length} con citas en el filtro</div></div>
    <div class="kpi"><div class="l"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>Promedio equitativo</div><div class="v">${fmt(A.ideal,1)}</div><div class="h">citas por profesional</div></div>
    <div class="kpi"><div class="l"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0L7 8zM17 8l-3 7a3 3 0 0 0 6 0l-3-7z"/></svg>Índice de equidad</div><div class="v" style="color:${A.eq>=.8?'var(--green)':A.eq>=.65?'var(--amber)':'var(--red)'}">${fmt(A.eq*100,1)}%</div><div class="h">100% = reparto idéntico (1 − Gini)</div></div>
  </div>
  <div class="card"><h3>Mapa de calor: citas por profesional y día</h3><div class="desc">Muestra cómo se distribuye la agenda en el periodo; celdas más oscuras = más citas ese día.</div><div class="heat">${heatHTML(rows,A)}</div></div>  <div class="grid2">
    <div class="card"><h3>¿Cómo está el reparto?</h3>
      <div class="desc">Profesionales según qué tan lejos están del promedio equitativo (±${f.tol}%).</div>
      ${donutHTML(A)}</div>
    <div class="card"><h3>Citas por profesional vs. promedio equitativo</h3>
      <div class="desc">La línea punteada es el reparto equitativo; la franja sombreada es la tolerancia de ±${f.tol}%.</div>
      <div class="legend"><span style="--c:var(--green)">Equitativo</span><span style="--c:var(--red)">Sobreasignado</span><span style="--c:var(--amber)">Baja asignación</span><span style="--c:var(--gray)">No medido</span></div>
      <div id="chart"></div></div>
  </div>
  <div class="sedes sede-cards">${sedesHTML(T,'sede',true)}</div>
  ${ents.length?`<div class="card"><h3>Citas por entidad</h3><div class="desc">Cantidad de citas de cada entidad y su porcentaje sobre el total de citas del filtro.</div>${entChartHTML(rows,T)}</div>`:''}
`;
  $('#main').innerHTML=html;
  $('#chart').innerHTML=chartSVG(A,T);
  bindCommon();
  ROOT.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{T.f[el.dataset.f]=el.type==='number'?Number(el.value||0):el.value;persist();render();});
  $('#btnClear').onclick=()=>{Object.assign(T.f,{sede:'',esp:'',ent:'',prof:'',desde:'',hasta:''});persist();render();};
}
function bindCommon(){
  const T=state.tabs[state.active];
  const gl=$('#goLoad'); if(gl) gl.onclick=()=>go('cargar');
}

function donutHTML(A){
  const cats=[['over','Sobreasignados','var(--red)'],['ok','Equitativos','var(--green)'],['under','Baja asignación','var(--amber)'],['excl','No medidos','var(--gray)']];
  const tot=A.all.length||1; const R=62, C=2*Math.PI*R; let off=0;
  let arcs=cats.map(([k,,c])=>{const n=A.all.filter(p=>p.estado===k).length; if(!n) return ''; const L=C*n/tot; const s=`<circle r="${R}" cx="80" cy="80" fill="none" stroke="${c}" stroke-width="20" stroke-dasharray="${Math.max(L-2,0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`; off+=L; return s;}).join('');
  const svg=`<svg width="170" height="170" viewBox="0 0 160 160"><circle r="${R}" cx="80" cy="80" fill="none" stroke="var(--track)" stroke-width="20"/>${arcs}<text x="80" y="80" text-anchor="middle" fill="#fff" font-size="30" font-weight="800">${A.all.length}</text><text x="80" y="100" text-anchor="middle" fill="#93A6B3" font-size="12">profesionales</text></svg>`;
  const rows=cats.map(([k,l,c])=>{const n=A.all.filter(p=>p.estado===k).length;return `<div class="row"><span class="dot" style="background:${c}"></span><span>${l}</span><span class="n">${n}</span><span class="p">${fmt(n/tot*100,1)}%</span></div>`;}).join('');
  const sobre=A.incl.filter(p=>p.estado==='over').reduce((a,p)=>a+p.n,0);
  return `<div class="donut-wrap">${svg}<div class="dl">${rows}</div></div><div class="foot"><span>Los sobreasignados concentran ${fmt(A.total?sobre/A.total*100:0,1)}% de las citas</span></div>`;
}
const ESTADO={ok:['ok','Equitativo'],over:['over','Sobreasignado'],under:['under','Baja asignación'],excl:['','No medido']};
const COLOR={ok:'var(--green)',over:'var(--red)',under:'var(--amber)',excl:'var(--gray)'};
function tableHTML(A,T){
  const s=T.sort; const list=[...A.all].sort((a,b)=>{let x=a[s.k],y=b[s.k];if(x==null)x=-1e9;if(y==null)y=-1e9;return (typeof x==='string'?x.localeCompare(y,'es'):x-y)*s.d;});
  const arrow=k=>s.k===k?(s.d<0?' ▼':' ▲'):'';
  return `<table><thead><tr>
   <th data-k="prof">Profesional${arrow('prof')}</th><th class="num" data-k="n">Citas${arrow('n')}</th><th class="num" data-k="share">% part.${arrow('share')}</th>
   <th class="num" data-k="dev">Desv.${arrow('dev')}</th><th class="num" data-k="devp">Desv. %${arrow('devp')}</th>
   <th class="num" data-k="ndias">Días${arrow('ndias')}</th><th class="num" data-k="cpd">Citas/día${arrow('cpd')}</th><th data-k="estado">Estado${arrow('estado')}</th></tr></thead><tbody>`+
   list.map(p=>{const e=ESTADO[p.estado];const sedes=Object.entries(p.sedes).map(([k,v])=>k+': '+v).join(' · ');
    return `<tr style="${p.inc?'':'color:#5E707C'}" title="${esc(sedes)}"><td>${esc(p.prof)}</td><td class="num"><b>${fmt(p.n)}</b></td><td class="num">${fmt(p.share*100,1)}%</td>
    <td class="num">${p.dev==null?'—':(p.dev>0?'+':'')+fmt(p.dev,1)}</td><td class="num">${p.devp==null?'—':(p.devp>0?'+':'')+fmt(p.devp*100,0)+'%'}</td>
    <td class="num">${p.ndias}</td><td class="num">${fmt(p.cpd,1)}</td><td>${e[0]?`<span class="pill ${e[0]}">${e[1]}</span>`:e[1]}</td></tr>`;}).join('')+`</tbody></table>`;
}
function chartSVG(A,T){
  const list=[...A.all].sort((a,b)=>b.n-a.n); if(!list.length) return '<div class="desc">Sin datos con estos filtros.</div>';
  const tol=(+T.f.tol||0)/100;
  const W=860, rowH=26, left=240, right=50, top=10, H=top+list.length*rowH+24;
  const maxV=Math.max(A.max,...list.map(p=>p.n),A.ideal*(1+tol))*1.05||1;
  const x=v=>left+(W-left-right)*v/maxV;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="font-family:inherit;font-size:12px">`;
  // ticks
  const step=Math.pow(10,Math.floor(Math.log10(maxV)))/(maxV/Math.pow(10,Math.floor(Math.log10(maxV)))>5?1:2);
  for(let v=0;v<=maxV;v+=step){s+=`<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H-20}" stroke="#1C3242"/><text x="${x(v)}" y="${H-6}" text-anchor="middle" fill="#7F93A0">${fmt(v)}</text>`;}
  if(A.ideal){
    s+=`<rect x="${x(A.ideal*(1-tol))}" y="${top}" width="${x(A.ideal*(1+tol))-x(A.ideal*(1-tol))}" height="${H-20-top}" fill="#5DB95A" opacity=".12"/>`;
  }
  list.forEach((p,i)=>{const y=top+i*rowH;
    s+=`<text x="${left-8}" y="${y+rowH/2+4}" text-anchor="end" fill="${p.inc?'#DCE5EA':'#5E707C'}">${esc(p.prof.length>30?p.prof.slice(0,29)+'…':p.prof)}</text>`;
    s+=`<rect x="${left}" y="${y+7}" width="${W-left-right}" height="${rowH-14}" rx="6" fill="#1A2E3C"/><rect x="${left}" y="${y+7}" width="${Math.max(2,x(p.n)-left)}" height="${rowH-14}" rx="6" fill="${COLOR[p.estado]}"><title>${esc(p.prof)}: ${p.n} citas</title></rect>`;
    s+=`<text x="${x(p.n)+5}" y="${y+rowH/2+4}" fill="#fff" font-weight="700">${p.n}</text>`;
  });
  if(A.ideal){s+=`<line x1="${x(A.ideal)}" x2="${x(A.ideal)}" y1="${top}" y2="${H-20}" stroke="#E8EEF2" stroke-dasharray="4 3" stroke-width="1.5"/>`;}
  return s+'</svg>';
}
function sedesHTML(T,key='sede',asCards=false){
  const base=filtered(T);
  const sedes=uniq(base,key);
  if(key==='sede') sedes.sort((a,b)=>(/PRINCIPAL/i.test(b)?1:0)-(/PRINCIPAL/i.test(a)?1:0)||a.localeCompare(b,'es'));
  return sedes.map(sd=>{
    const rows=base.filter(r=>r[key]===sd); const A=analyze(rows,T);
    const list=[...A.all].sort((a,b)=>b.n-a.n); const mx=list[0]?list[0].n:1;
    const head=asCards?`<h3>${esc(sd)}</h3>`:`<b style="color:#fff">${esc(sd)}</b>`;
    return `<div${asCards?' class="card" style="margin-top:0"':''}><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">${head}
      <span class="desc" style="margin:0">${fmt(rows.length)} citas · ${A.incl.length} prof. · equidad <b style="color:${A.eq>=.8?'var(--green)':A.eq>=.65?'var(--amber)':'var(--red)'}">${fmt(A.eq*100,1)}%</b> · prom. ${fmt(A.ideal,1)}</span></div>
      <table style="margin-top:6px">${list.map(p=>`<tr style="${p.inc?'':'color:#5E707C'}"><td style="width:48%">${esc(p.prof)}</td><td style="width:38%"><div class="track"><div class="bar-in" style="width:${p.n/mx*100}%;background:${COLOR[p.estado]}"></div></div></td><td class="num">${p.n}</td><td class="num">${fmt(p.share*100,0)}%</td></tr>`).join('')}</table></div>`;
  }).join('');
}
function entChartHTML(rows,T){
  const ents=uniq(rows,'ent').map(e=>{const r=rows.filter(x=>x.ent===e);const A=analyze(r,T);return {e,n:r.length,prof:A.incl.length,eq:A.eq};}).sort((a,b)=>b.n-a.n);
  if(!ents.length) return '<div class="desc">Sin datos con estos filtros.</div>';
  const mx=ents[0].n, tot=rows.length||1;
  return `<table class="entc"><thead><tr><th style="cursor:default">Entidad</th><th style="cursor:default;width:55%"></th><th class="num" style="cursor:default">Citas</th><th class="num" style="cursor:default">% del total</th></tr></thead><tbody>`+
  ents.map(x=>`<tr><td>${esc(x.e)}</td><td><div class="track" style="height:14px;border-radius:7px"><div class="bar-in" style="height:14px;border-radius:7px;width:${x.n/mx*100}%;background:var(--sky)"></div></div></td><td class="num"><b>${fmt(x.n)}</b></td><td class="num" style="width:110px"><b style="color:var(--title)">${fmt(x.n/tot*100,1)}%</b></td></tr>`).join('')+`<tr><td><b>Total</b></td><td></td><td class="num"><b>${fmt(rows.length)}</b></td><td class="num"><b>100%</b></td></tr></tbody></table>`;
}
function heatHTML(rows,A){
  const dias=uniq(rows,'fecha'); if(!dias.length) return '<div class="desc">Sin fechas.</div>';
  const list=[...A.all].sort((a,b)=>b.n-a.n); const cnt={}; let mx=1;
  rows.forEach(r=>{const k=r.prof+'|'+r.fecha;cnt[k]=(cnt[k]||0)+1;mx=Math.max(mx,cnt[k]);});
  const head=dias.map(d=>{const L=dLabel(d);return `<th>${L.w}<br>${L.d}</th>`;}).join('');
  const body=list.map(p=>`<tr><td class="name">${esc(p.prof)}</td>`+dias.map(d=>{const v=cnt[p.prof+'|'+d]||0;const a=v?0.18+0.82*v/mx:0;
    return `<td style="background:${v?`rgba(60,158,224,${a.toFixed(2)})`:'#15283400'};color:#fff">${v||''}</td>`;}).join('')+`<td class="num"><b>${p.n}</b></td></tr>`).join('');
  const tot=dias.map(d=>`<td><b>${rows.filter(r=>r.fecha===d).length}</b></td>`).join('');
  return `<table><thead><tr><th></th>${head}<th>Total</th></tr></thead><tbody>${body}<tr><td class="name"><b>Total día</b></td>${tot}<td class="num"><b>${rows.length}</b></td></tr></tbody></table>`;
}

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
