// talento-humano-app.js — GENERADO por scripts/gestion-humana/generar-talento-humano.js (Fase GH1)
// desde la app de Gestión humana de Edwin, sin cambiar sus fórmulas: sin datos de prueba, con el
// SheetJS de SinCo y «⌂ Menú principal» que vuelve al menú de SinCo. No editar a mano.
/* eslint-disable */
// «⌂ Menú principal»: cierra la ventana de SinCo que contiene esta página.
window.volverMenu = function () {
  try { if (window.parent && window.parent !== window && typeof window.parent.talentoHumanoCerrar === 'function') window.parent.talentoHumanoCerrar(); } catch (e) { /* otro origen: nada */ }
};
/* ===================== CATÁLOGOS ===================== */
const L = {
  contrato:['Término indefinido','Término fijo','Obra o labor','Aprendizaje SENA','Prestación de servicios','Temporal'],
  tipoId:['CC','CE','TI','PPT','PEP','Pasaporte'],
  genero:['Femenino','Masculino','Otro'],
  arl:['SURA','Positiva','Colmena','Bolívar','AXA Colpatria','La Equidad'],
  eps:['SURA','Nueva EPS','Sanitas','Salud Total','Savia Salud','Coosalud','Compensar','Famisanar','Mutual Ser','Emssanar'],
  pension:['Porvenir','Protección','Colfondos','Skandia','Colpensiones'],
  cesantias:['Porvenir','Protección','Colfondos','Skandia','Fondo Nacional del Ahorro'],
  ccf:['Comfama','Comfenalco Antioquia','Cafam','Colsubsidio','Compensar','Comfandi'],
  carnet:['Entregado','Pendiente','No aplica'],
  estadoCivil:['Soltero(a)','Casado(a)','Unión libre','Separado(a)','Divorciado(a)','Viudo(a)'],
  rh:['O+','O-','A+','A-','B+','B-','AB+','AB-'],
  talla:['XS','S','M','L','XL','XXL','XXXL'],
  motivo:['Renuncia voluntaria','Despido con justa causa','Despido sin justa causa','No renovación de contrato','Terminación de obra o labor','Finalización de prácticas / aprendizaje','Mutuo acuerdo','Abandono del cargo','Pensión','Fallecimiento','Otro'],
  recontratable:['Sí','No','Por evaluar'],
  novedad:['Incapacidad por enfermedad general','Incapacidad por accidente de trabajo','Incapacidad por enfermedad laboral','Licencia de maternidad','Licencia de paternidad','Licencia de luto','Licencia no remunerada','Calamidad doméstica','Permiso remunerado','Permiso no remunerado','Cita médica','Ausencia injustificada','Suspensión disciplinaria'],
  parentesco:['Madre','Padre','Esposo(a)','Compañero(a)','Hijo(a)','Hermano(a)','Abuelo(a)','Tío(a)','Primo(a)','Amigo(a)','Otro'],
  estado:['Activo','Retirado']
};
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ===================== CAMPOS (mismo orden y encabezados del Excel) =====================
   [clave, encabezado Excel, tipo, pestaña, opciones, obligatorio]
   tipos: text | date | num | money | sel (lista cerrada) | list (lista abierta) | calc | email | tel */
const TABS={contrato:'Contrato',personal:'Datos personales',ss:'Seguridad social',contacto:'Residencia y contacto',adicional:'Información adicional',emergencia:'Contacto de emergencia'};
const F=[
 ['num','Nº EMPLEADO','text','interno'],
 ['tipoContrato','TIPO CONTRATO','sel','contrato','contrato',1],
 ['fIngresoSS','FECHA INGRESO SEGURIDAD SOCIAL ','date','contrato'],
 ['fInicio','FECHA INICIO DE CONTRATO','date','contrato',null,1],
 ['fFinPrueba','FECHA FIN PERIODO PRUEBA','date','contrato'],
 ['sede','SEDE','sel','contrato','sede',1],
 ['cargo','CARGO','sel','contrato','cargo',1],
 ['centro','CENTRO DE TRABJO','sel','contrato','centro'],
 ['nombre','NOMBRES Y APELLIDOS','text','personal',null,1],
 ['tipoId','TIPO ID','sel','personal','tipoId',1],
 ['numId','NÚMERO ID','text','personal',null,1],
 ['ciudadId','CIUDAD ID','text','personal'],
 ['fNac','FECHA NACIMIENTO','date','personal'],
 ['lugarNac','LUGAR NACIMIENTO','text','personal'],
 ['mesNac','MES NACIMIENTO','calc','personal'],
 ['edad','EDAD','calc','personal'],
 ['carnet','CARNET','sel','personal','carnet'],
 ['genero','GENERO','sel','personal','genero'],
 ['arl','ARL','sel','ss','arl'],
 ['eps','EPS ','sel','ss','eps'],
 ['pension','F. PENSIÓN','sel','ss','pension'],
 ['cesantias','F.CESANTÍAS','sel','ss','cesantias'],
 ['ccf','CCF','sel','ss','ccf'],
 ['direccion','DIRECCION ','text','contacto'],
 ['ciudadRes','CIUDAD RESIDENCIA','text','contacto'],
 ['telFijo','TELEFONO FIJO','tel','contacto'],
 ['celular','TELEFONO CELULAR','tel','contacto'],
 ['correo','CORREO','email','contacto'],
 ['cuenta','Nº DE CTA','text','adicional'],
 ['estadoCivil','ESTADO CIVIL','sel','adicional','estadoCivil'],
 ['hijos','N° HIJOS','num','adicional'],
 ['salario','SALARIO MENSUAL','money','adicional'],
 ['rh','RH','sel','adicional','rh'],
 ['talla','TALLA','sel','adicional','talla'],
 ['contactoNombre','PERSONA DE CONTACTO','text','emergencia'],
 ['contactoTel','NUMEROS DE CONTACTO','tel','emergencia'],
 ['parentesco','PARENTESCO','sel','emergencia','parentesco'],
 ['estado','ESTADO','sel','interno','estado'],
 ['fRetiro','FECHA RETIRO','date','interno'],
 ['motivoRetiro','MOTIVO RETIRO','text','interno'],
 ['recontratable','RECONTRATABLE','text','interno'],
 ['obsRetiro','OBSERVACIÓN RETIRO','text','interno'],
 ['adjRetiro','SOPORTES RETIRO','adj','interno']
];
F.forEach(f=>{if(f[2]!=='calc'&&f[3]!=='interno')f[5]=1}); // todos los campos de la ficha son obligatorios
const FK=Object.fromEntries(F.map(f=>[f[0],f]));
// campos que se revisan como "ficha incompleta"
const CLAVE=['tipoContrato','fIngresoSS','fInicio','sede','cargo','nombre','tipoId','numId','fNac','genero','arl','eps','pension','ccf','celular','salario','contactoNombre','contactoTel'];

/* ===================== ALMACENAMIENTO ===================== */
const KEY='inconexion_gh_empleados_v1';
let DB=[];
function load(){try{DB=JSON.parse(GH_STORE.getItem(KEY)||'[]')}catch(e){DB=[]}}
function persist(){try{GH_STORE.setItem(KEY,JSON.stringify(DB))}catch(e){toast('No se pudo guardar en el navegador. Descarga un respaldo.')}}

/* ===================== UTILIDADES ===================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const pd=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const iso=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'';
const fmtD=s=>{const d=pd(s);return d?d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):''};
const cop=n=>n||n===0?new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n):'';
const days=(a,b)=>Math.round((b-a)/864e5);
function edad(fNac){const n=pd(fNac);if(!n)return '';const t=today();let e=t.getFullYear()-n.getFullYear();if(t.getMonth()<n.getMonth()||(t.getMonth()===n.getMonth()&&t.getDate()<n.getDate()))e--;return e}
function mesNac(fNac){const n=pd(fNac);return n?MESES[n.getMonth()]:''}
function antig(fInicio,hasta){const a=pd(fInicio);if(!a)return '';const b=hasta?pd(hasta):today();let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();if(b.getDate()<a.getDate())m--;if(m<0)return '';const y=Math.floor(m/12),r=m%12;return (y?y+' año'+(y>1?'s':'')+' ':'')+(r||!y?r+' mes'+(r!==1?'es':''):'')}
function ini(n){return (n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function uniq(k){return [...new Set(DB.map(e=>e[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function nextNum(){const n=DB.map(e=>parseInt(e.num,10)).filter(x=>!isNaN(x));return String((n.length?Math.max(...n):0)+1)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2800)}
function closeOv(id){const o=$('#'+id);if(o)o.classList.remove('show')}
function confirmBox(title,html,okTxt,fn){$('#ovConf .modal').style.width='';$('#confTitle').textContent=title;$('#confBody').innerHTML=html;const b=$('#confOk');b.textContent=okTxt;b.onclick=()=>{closeOv('ovConf');fn()};$('#ovConf').classList.add('show')}
const opTag=e=>e.centro?`<span class="op">${esc(e.centro)}</span>`:'<span class="op none">Sin operación</span>';
function enPrueba(e){if(e.estado==='Retirado')return false;const f=pd(e.fFinPrueba);return f&&f>=today()}
const activos=()=>DB.filter(e=>e.estado!=='Retirado');

/* ===================== NAVEGACIÓN ===================== */
let VIEW='panel';
$('#nav').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;go(b.dataset.v)});
function go(v){VIEW=v;document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));render()}
function render(){
  ({panel:vPanel,empleados:vEmpleados,retirados:vRetirados,vacaciones:vVacaciones,novedades:vNovedades,cumple:vCumple,perfil:vPerfil,ausentismo:vAusentismo,impacto:vImpacto,alertas:vAlertas,admin:vAdmin,datos:vDatos})[VIEW]();
  render0();
}

/* ===================== PANEL ===================== */

/* ===================== GRÁFICAS (SVG, sin librerías) ===================== */
const PAL=['#3CA0DC','#64B450','#F0A35A','#EF7070','#5F7884','#56BDF0','#9B8CD9','#2BB3A8','#8FA9B5','#12546A'];
function sumBy(list,fn){const m={};list.forEach(e=>{const k=fn(e)||'Sin dato';m[k]=(m[k]||0)+(+e.salario||0)});return m}
function legend(arr,tot){return `<div class="leg">${arr.map(([k,v],i)=>`<div><i style="background:${PAL[i%PAL.length]}"></i><span>${esc(k)}</span><b>${v}</b><em>${Math.round(v/tot*100)}%</em></div>`).join('')}</div>`}
function arcs(arr,tot,r,ri){
  let a0=-Math.PI/2;
  if(arr.length===1)return `<circle cx="70" cy="70" r="${(r+ri)/2}" fill="none" stroke="${PAL[0]}" stroke-width="${r-ri||r}"><title>${esc(arr[0][0])}: ${arr[0][1]}</title></circle>`;
  return arr.map(([k,v],i)=>{const a1=a0+v/tot*Math.PI*2,lg=a1-a0>Math.PI?1:0;
    const P=(rr,a)=>`${70+rr*Math.cos(a)} ${70+rr*Math.sin(a)}`;
    const d=ri?`M${P(r,a0)}A${r} ${r} 0 ${lg} 1 ${P(r,a1)}L${P(ri,a1)}A${ri} ${ri} 0 ${lg} 0 ${P(ri,a0)}Z`:`M70 70L${P(r,a0)}A${r} ${r} 0 ${lg} 1 ${P(r,a1)}Z`;
    a0=a1;return `<path d="${d}" fill="${PAL[i%PAL.length]}" stroke="#102530" stroke-width="2.5"><title>${esc(k)}: ${v} (${Math.round(v/tot*100)}%)</title></path>`}).join('');
}
function donut(map){const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '<div class="empty">Sin datos</div>';const tot=arr.reduce((s,x)=>s+x[1],0);
  return `<div class="pie"><svg viewBox="0 0 140 140">${arcs(arr,tot,66,42)}<text x="70" y="68" text-anchor="middle" class="big">${tot}</text><text x="70" y="84" text-anchor="middle" class="sm">empleados</text></svg>${legend(arr,tot)}</div>`}
function pie(map){const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '<div class="empty">Sin datos</div>';const tot=arr.reduce((s,x)=>s+x[1],0);
  return `<div class="pie"><svg viewBox="0 0 140 140">${arcs(arr,tot,66,0)}</svg>${legend(arr,tot)}</div>`}
function cols(map,order,fmt,color,minW){
  let arr=Object.entries(map);arr=order?order.filter(k=>map[k]).map(k=>[k,map[k]]):arr.sort((a,b)=>b[1]-a[1]);
  if(!arr.length)return '<div class="empty">Sin datos</div>';
  const mx=Math.max(...arr.map(x=>x[1])),W=Math.max(minW||300,arr.length*70),H=190,bw=Math.min(46,W/arr.length*.55),step=W/arr.length;
  return `<svg class="ch" viewBox="0 0 ${W} ${H+34}">${[0,.5,1].map(f=>`<line x1="0" x2="${W}" y1="${20+H*(1-f)*.8}" y2="${20+H*(1-f)*.8}" class="grid"/>`).join('')}
  ${arr.map(([k,v],i)=>{const h=v/mx*H*.8,x=i*step+(step-bw)/2,y=20+H*.8-h;return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" fill="${color==="grad"?"url(#gCol)":(color||PAL[(i+1)%PAL.length])}" class="colr"><title>${esc(k)}: ${fmt?fmt(v):v}</title></rect>
  <text x="${x+bw/2}" y="${y-6}" text-anchor="middle" class="val">${fmt?fmt(v).replace(/\s/g,' '):v}</text><text x="${i*step+step/2}" y="${20+H*.8+18}" text-anchor="middle" class="lab">${esc(k.length>Math.floor(step/7)?k.slice(0,Math.floor(step/7)-1)+'…':k)}</text>`}).join('')}</svg>`}
function stack(title,map){const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);const tot=arr.reduce((s,x)=>s+x[1],0);if(!tot)return '';
  return `<div class="stk"><div class="stk-t">${title}</div><div class="stk-b">${arr.map(([k,v],i)=>`<span style="flex:${v};background:${PAL[i%PAL.length]}" title="${esc(k)}: ${v} (${Math.round(v/tot*100)}%)">${v/tot>=.25?esc(k)+' · ':''}${v}</span>`).join('')}</div>
  <div class="stk-l">${arr.map(([k,v],i)=>`<span><i style="background:${PAL[i%PAL.length]}"></i>${esc(k)} ${v}</span>`).join('')}</div></div>`}
function combo(list){
  const t=today(),M=[];for(let i=11;i>=0;i--){const d=new Date(t.getFullYear(),t.getMonth()-i,1);M.push(d)}
  const data=M.map(d=>{const fin=new Date(d.getFullYear(),d.getMonth()+1,0);const same=s=>{const x=pd(s);return x&&x.getFullYear()===d.getFullYear()&&x.getMonth()===d.getMonth()};
    return {l:MESES[d.getMonth()].slice(0,3)+(d.getMonth()===0||d===M[0]?' '+String(d.getFullYear()).slice(2):''),
      ing:list.filter(e=>same(e.fInicio)).length,ret:list.filter(e=>e.estado==='Retirado'&&same(e.fRetiro)).length,
      pl:list.filter(e=>{const a=pd(e.fInicio),r=pd(e.fRetiro);return a&&a<=fin&&!(e.estado==='Retirado'&&r&&r<=fin)}).length}});
  const W=720,H=200,top=20,step=W/12,mxB=Math.max(1,...data.map(x=>Math.max(x.ing,x.ret))),mxL=Math.max(1,...data.map(x=>x.pl))*1.15;
  const yL=v=>top+H-v/mxL*H,bw=Math.min(18,step*.28);
  const pts=data.map((x,i)=>`${i*step+step/2},${yL(x.pl)}`).join(' ');
  return `<svg class="ch" viewBox="0 0 ${W} ${H+44}">
  ${[0,.25,.5,.75,1].map(f=>`<line x1="0" x2="${W}" y1="${top+H*f}" y2="${top+H*f}" class="grid"/>`).join('')}
  ${data.map((x,i)=>{const cx=i*step+step/2,hi=x.ing/mxB*H*.45,hr=x.ret/mxB*H*.45;return `
   <rect x="${cx-bw-1}" y="${top+H-hi}" width="${bw}" height="${hi}" rx="4" fill="url(#gIng)"><title>${x.l}: ${x.ing} ingreso(s)</title></rect>
   <rect x="${cx+1}" y="${top+H-hr}" width="${bw}" height="${hr}" rx="4" fill="url(#gRet)"><title>${x.l}: ${x.ret} retiro(s)</title></rect>
   ${x.ing?`<text x="${cx-bw/2-1}" y="${top+H-hi-6}" text-anchor="middle" class="bval" fill="#8fd47a">${x.ing}</text>`:''}
   ${x.ret?`<text x="${cx+bw/2+1}" y="${top+H-hr-6}" text-anchor="middle" class="bval" fill="#f59a9a">${x.ret}</text>`:''}
   <text x="${cx}" y="${top+H+18}" text-anchor="middle" class="lab">${x.l}</text>`}).join('')}
  <polygon points="${step/2},${top+H} ${pts} ${11*step+step/2},${top+H}" fill="url(#gArea)"/>
  <polyline points="${pts}" fill="none" stroke="url(#gLine)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" class="draw"/>
  ${data.map((x,i)=>`<circle cx="${i*step+step/2}" cy="${yL(x.pl)}" r="4.5" fill="#102530" stroke="#56BDF0" stroke-width="2.5"><title>${x.l}: ${x.pl} empleados en planta</title></circle><text x="${i*step+step/2}" y="${yL(x.pl)-9}" text-anchor="middle" class="val">${x.pl}</text>`).join('')}
  </svg><div class="stk-l" style="justify-content:center"><span><i style="background:#56BDF0"></i>Empleados en planta (fin de mes)</span><span><i style="background:#64B450"></i>Ingresos</span><span><i style="background:#EF7070"></i>Retiros</span></div>`}
function bars(map,color){
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '<div class="empty">Sin datos</div>';
  const mx=Math.max(...arr.map(x=>x[1]));
  return arr.map(([k,v])=>`<div class="bar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><div class="trk"><div class="fill" style="width:${v/mx*100}%;${color?'--c:'+color:''}"></div></div><span class="n">${v}</span></div>`).join('');
}
function count(list,fn){const m={};list.forEach(e=>{const k=fn(e)||'Sin dato';m[k]=(m[k]||0)+1});return m}
function vPanel(){
  const A=activos(),t=today(),mes=t.getMonth();
  const nom=A.reduce((s,e)=>s+(+e.salario||0),0);
  const cumpl=A.filter(e=>pd(e.fNac)&&pd(e.fNac).getMonth()===mes);
  const prueba=A.filter(enPrueba);
  const ingMes=DB.filter(e=>{const d=pd(e.fInicio);return d&&d.getMonth()===mes&&d.getFullYear()===t.getFullYear()}).length;
  const retMes=DB.filter(e=>{const d=pd(e.fRetiro);return e.estado==='Retirado'&&d&&d.getMonth()===mes&&d.getFullYear()===t.getFullYear()}).length;
  const rango=e=>{const x=edad(e.fNac);if(x==='')return 'Sin dato';if(x<25)return '18 – 24';if(x<35)return '25 – 34';if(x<45)return '35 – 44';if(x<55)return '45 – 54';return '55 o más'};
  $('#main').innerHTML=`
  <section class="hero">
    <svg class="net" viewBox="0 0 420 200" aria-hidden="true">${(()=>{const P=[[40,40],[120,20],[200,70],[290,30],[380,60],[90,120],[170,150],[260,130],[350,160],[220,190],[320,95],[30,180]];
      const E=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[2,7],[3,10],[10,4],[7,10],[6,9],[9,8],[5,11],[1,5],[10,8]];
      return E.map(([i,j])=>`<line x1="${P[i][0]}" y1="${P[i][1]}" x2="${P[j][0]}" y2="${P[j][1]}"/>`).join('')+P.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3?3:5}" class="${i%4===0?'g':''}"/>`).join('')})()}</svg>
    <div class="hero-in">
      <div class="eyebrow">InConexion · Gestión Humana</div>
      <h1>Panel de talento humano</h1>
      <div class="hero-date">${t.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      <div class="chips"><span><b>${A.length}</b> activos</span><span><b>${uniqA('sede').length}</b> sedes</span><span><b>${new Set(A.map(e=>e.centro).filter(Boolean)).size}</b> operaciones</span><span><b>${new Set(A.map(e=>e.cargo).filter(Boolean)).size}</b> cargos</span></div>
    </div>
  </section>
  <div class="kpis kp5">
    <div class="kpi k1"><div class="ico">👥</div><div><small>Empleados activos</small><b>${A.length}</b><em>${DB.length-A.length} retirados en el histórico</em></div></div>
    <div class="kpi k2"><div class="ico">⇅</div><div><small>Movimientos del mes</small><b>+${ingMes} <span>/</span> −${retMes}</b><em>ingresos / retiros en ${MESES[mes].toLowerCase()}</em></div></div>
    <div class="kpi k3"><div class="ico">⏳</div><div><small>En periodo de prueba</small><b>${prueba.length}</b><em>${prueba.filter(e=>days(t,pd(e.fFinPrueba))<=CFG.dias).length} vencen en ${CFG.dias} días o menos</em></div></div>
    <div class="kpi k4"><div class="ico">$</div><div><small>Nómina mensual activa</small><b class="money">${cop(nom)}</b><em>Salario promedio: ${cop(A.length?Math.round(nom/A.length):0)}</em></div></div>
    ${(()=>{const R=A.filter(impOk),cab=R.filter(e=>e.imp.cabeza!=='No').length,pri=R.filter(e=>e.imp.primer==='Sí').length,dil=A.filter(impReal).length;
      return `<div class="kpi k5 kclick" onclick="go('impacto')" title="Ver indicadores de impacto"><div class="ico">🌱</div><div><small>Indicadores de impacto</small><b>${cab} <span>/</span> ${pri}</b><em>cabeza de hogar / primer empleo</em><i class="kgo">Ver datos →</i></div></div>`})()}
  </div>
  ${DB.length?`<div class="dash">
    <div class="card c2"><h3>Evolución de la planta · últimos 12 meses</h3>${combo(DB)}</div>
    <div class="card"><h3>Por sede</h3>${donut(count(A,e=>e.sede))}</div>
    <div class="card"><h3>Por tipo de contrato</h3>${donut(count(A,e=>e.tipoContrato),1)}</div>
    <div class="card"><h3>Por género</h3>${pie(count(A,e=>e.genero))}</div>
    <div class="card"><h3>Por rango de edad</h3>${cols(count(A,rango),['18 – 24','25 – 34','35 – 44','45 – 54','55 o más','Sin dato'])}</div>
    <div class="card c2"><h3>Por centro de trabajo</h3>${bars(count(A,e=>e.centro),'#3CA0DC')}</div>
    <div class="card c2"><h3>Por cargo</h3>${bars(count(A,e=>e.cargo),'#64B450')}</div>
    <div class="card c2"><h3>Seguridad social</h3>${stack('EPS',count(A,e=>e.eps))}${stack('Fondo de pensión',count(A,e=>e.pension))}${stack('Caja de compensación',count(A,e=>e.ccf))}</div>
    <div class="card c4"><h3>Nómina mensual por cargo</h3>${cols(sumBy(A,e=>e.cargo),null,cop,'grad',1100)}</div>
  </div>`:`<div class="card empty" style="padding:50px">Aún no hay empleados registrados.<br><br>
    <button class="btn pri" onclick="openEmp()">＋ Registrar el primero</button> &nbsp; <button class="btn" onclick="go('datos')">Importar desde Excel</button></div>`}`;
}

/* ===================== INDICADORES DE IMPACTO ===================== */
const IMP_Q=[
 {k:'cabeza',l:'¿Es madre o padre cabeza de hogar?',o:['Madre cabeza de hogar','Padre cabeza de hogar','No']},
 {k:'primer',l:'¿Este es su primer empleo formal?',o:['Sí','No']},
 {k:'regimen',l:'¿De qué régimen de salud venía antes de ingresar?',o:['Contributivo','Subsidiado','Especial o de excepción','Sin afiliación']},
 {k:'hijos',l:'¿Tiene hijos?',o:['Sí','No']}];
const impOk=e=>e.imp&&IMP_Q.every(q=>e.imp[q.k])&&(e.imp.hijos!=='Sí'||+e.imp.numHijos>0);
const impReal=e=>impOk(e)&&!e.imp.demo;
let IMPF=null;
function openImp(id){const e=emp(id);IMPF={...(e.imp&&!e.imp.demo?e.imp:{})};IMPF.empId=id;
  const ov=modalX('ovImp');ov.querySelector('h2').textContent='Indicadores de impacto';drawImp();ov.classList.add('show')}
function drawImp(errs={}){const ov=$('#ovImp'),e=emp(IMPF.empId);
  ov.querySelector('.mb').innerHTML=`<div class="imp-who"><b>${esc(e.nombre)}</b><span>${esc(e.tipoId||'')} ${esc(e.numId||'')} · ${esc(e.cargo||'')} · ${esc(e.centro||'')}</span></div>
   ${IMP_Q.map(q=>`<div class="f ${errs[q.k]?'bad':''}" style="margin-top:14px"><label>${q.l} <i>*</i></label>
     <div class="seg3" style="grid-template-columns:repeat(${q.o.length},1fr)">${q.o.map(o=>`<button type="button" class="${IMPF[q.k]===o?'on r0':''}" onclick="IMPF['${q.k}']=${JSON.stringify(o).replace(/"/g,'&quot;')};drawImp()">${esc(o)}</button>`).join('')}</div><div class="hint">${errs[q.k]||''}</div></div>
     ${q.k==='hijos'&&IMPF.hijos==='Sí'?`<div class="f ${errs.numHijos?'bad':''}" style="margin-top:10px;max-width:260px"><label>¿Cuántos hijos? <i>*</i></label><input type="number" id="impN" min="1" max="20" value="${IMPF.numHijos||''}" oninput="IMPF.numHijos=this.value"><div class="hint">${errs.numHijos||''}</div></div>`:''}`).join('')}
   ${e.imp&&e.imp.fecha&&!e.imp.demo?`<p class="note" style="margin-bottom:0">Última actualización: ${fmtD(e.imp.fecha)}</p>`:''}`;
  ov.querySelector('.mf').innerHTML=`<span class="note"><i style="color:var(--red);font-style:normal">*</i> Todos los campos son obligatorios</span><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovImp')">Cancelar</button><button class="btn pri" onclick="guardarImp()">Guardar</button></div>`}
function guardarImp(){const er={};if($('#impN'))IMPF.numHijos=$('#impN').value;
  IMP_Q.forEach(q=>{if(!IMPF[q.k])er[q.k]='Seleccione una opción'});
  if(IMPF.hijos==='Sí'&&!(+IMPF.numHijos>0))er.numHijos='Indique cuántos hijos tiene';
  if(Object.keys(er).length){drawImp(er);toast('Responda todas las preguntas');return}
  const e=emp(IMPF.empId);e.imp={cabeza:IMPF.cabeza,primer:IMPF.primer,regimen:IMPF.regimen,hijos:IMPF.hijos,numHijos:IMPF.hijos==='Sí'?+IMPF.numHijos:0,fecha:iso(today())};
  logEv(e.id,'impacto','Indicadores de impacto actualizados');persist();closeOv('ovImp');render();toast('Indicadores de impacto guardados')}
/* vista */
const FIMP={centro:''};
function vImpacto(){document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v==='panel'));
  const A0=activos(),A=A0.filter(e=>!FIMP.centro||e.centro===FIMP.centro),R=A.filter(impOk),P=A.filter(e=>!impReal(e)),n=R.length,pc=x=>n?Math.round(x*100/n)+'%':'—';
  const cab=R.filter(e=>e.imp.cabeza!=='No'),mad=R.filter(e=>e.imp.cabeza==='Madre cabeza de hogar').length,pri=R.filter(e=>e.imp.primer==='Sí'),hij=R.filter(e=>e.imp.hijos==='Sí'),totH=hij.reduce((s,e)=>s+(+e.imp.numHijos||0),0),sub=R.filter(e=>e.imp.regimen==='Subsidiado'||e.imp.regimen==='Sin afiliación');
  const demo=A0.some(e=>e.imp&&e.imp.demo);
  const nh=e=>{const x=+e.imp.numHijos||0;return x>=4?'4 o más':String(x)};
  $('#main').innerHTML=`<div class="top"><div><h1>🌱 Indicadores de impacto</h1><div class="sub">${n} de ${A.length} empleados activos con la información diligenciada${FIMP.centro?' · '+esc(FIMP.centro):''}</div></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="go('panel')">← Volver al panel</button><select id="impC" class="sel"><option value="">Todas las operaciones</option>${[...new Set(A0.map(e=>e.centro).filter(Boolean))].sort().map(c=>`<option ${c===FIMP.centro?'selected':''}>${esc(c)}</option>`).join('')}</select><button class="btn" onclick="exportImp()">⬇ Exportar</button></div></div>
   ${demo?`<div class="note imp-demo">🧪 Se están mostrando <b>datos de prueba</b> para ver cómo quedan las gráficas. Al llenar el formulario de un empleado, sus datos reales reemplazan los de prueba. <button class="btn sm dan" onclick="impQuitarDemo()">Quitar datos de prueba</button></div>`:''}
   <div class="kpis">
    <div class="kpi k1"><div class="ico">👩‍👧</div><div><small>Cabeza de hogar</small><b>${cab.length} <span>· ${pc(cab.length)}</span></b><em>${mad} madres · ${cab.length-mad} padres</em></div></div>
    <div class="kpi k2"><div class="ico">🎓</div><div><small>Primer empleo formal</small><b>${pri.length} <span>· ${pc(pri.length)}</span></b><em>personas que entraron al mercado laboral con nosotros</em></div></div>
    <div class="kpi k3"><div class="ico">🏥</div><div><small>Venían de régimen subsidiado o sin afiliación</small><b>${sub.length} <span>· ${pc(sub.length)}</span></b><em>pasaron a régimen contributivo</em></div></div>
    <div class="kpi k4"><div class="ico">👶</div><div><small>Con hijos</small><b>${hij.length} <span>· ${pc(hij.length)}</span></b><em>${totH} hijos beneficiados en total</em></div></div>
   </div>
   ${n?`<div class="dash">
    <div class="card"><h3>Cabeza de hogar</h3>${donut(count(R,e=>e.imp.cabeza))}</div>
    <div class="card"><h3>Primer empleo formal</h3>${pie(count(R,e=>e.imp.primer==='Sí'?'Primer empleo':'Ya había trabajado'))}</div>
    <div class="card"><h3>Régimen de salud de origen</h3>${donut(count(R,e=>e.imp.regimen))}</div>
    <div class="card"><h3>Número de hijos</h3>${cols(count(R,nh),['0','1','2','3','4 o más'])}</div>
    <div class="card c2"><h3>Cabeza de hogar por operación</h3>${bars(count(cab,e=>e.centro||'Sin operación'),'#F0A35A')}</div>
    <div class="card c2"><h3>Primer empleo por operación</h3>${bars(count(pri,e=>e.centro||'Sin operación'),'#64B450')}</div>
    <div class="card c2"><h3>Cabeza de hogar por género</h3>${pie(count(cab,e=>e.genero||'Sin dato'))}</div>
    <div class="card c2"><h3>Primer empleo por rango de edad</h3>${cols(count(pri,e=>{const x=edad(e.fNac);return x===''?'Sin dato':x<25?'18 – 24':x<35?'25 – 34':x<45?'35 – 44':'45 o más'}),['18 – 24','25 – 34','35 – 44','45 o más','Sin dato'])}</div>
   </div>`:`<div class="card empty" style="padding:40px">Aún no hay indicadores diligenciados${FIMP.centro?' en esta operación':''}. Llénelos desde <b>Empleados</b> con el botón 🌱.</div>`}
   ${P.length?`<div class="card" style="margin-top:16px"><div class="adm-head"><h3>Pendientes por diligenciar (${P.length})</h3></div>
     <div class="imp-pend">${P.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(e=>`<button class="imp-p" onclick="openImp('${e.id}')"><b>${esc(e.nombre)}</b><span>${esc(e.centro||'')}</span><i>🌱 Llenar</i></button>`).join('')}</div></div>`:''}`;
  $('#impC').onchange=ev=>{FIMP.centro=ev.target.value;vImpacto()};
}
function impSheet(L){return sheetSimple(['NÚMERO ID','NOMBRE','OPERACIÓN','CARGO','GÉNERO','CABEZA DE HOGAR','PRIMER EMPLEO','RÉGIMEN DE ORIGEN','TIENE HIJOS','N° HIJOS','ACTUALIZADO'],
  L.map(e=>{const i=impOk(e)?e.imp:{};return [e.numId,e.nombre,e.centro||'',e.cargo||'',e.genero||'',i.cabeza||'Pendiente',i.primer||'',i.regimen||'',i.hijos||'',i.hijos==='Sí'?+i.numHijos:'',i.demo?'Dato de prueba':pd(i.fecha)||'']}))}
function exportImp(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,impSheet(activos().filter(e=>!FIMP.centro||e.centro===FIMP.centro)),'Indicadores de impacto');XLSX.writeFile(wb,`Indicadores_Impacto_${stamp()}.xlsx`)}
function impQuitarDemo(){confirmBox('Quitar datos de prueba','Se borrarán los indicadores de prueba. Los que se llenaron con el formulario se conservan.','Quitar',()=>{DB.forEach(e=>{if(e.imp&&e.imp.demo)delete e.imp});GH_STORE.setItem(KEY+'_impdemo','off');persist();render();toast('Datos de prueba quitados')})}
/* SinCo (GH1): sin indicadores de impacto de prueba. */
function impDemo(){}

/* ===================== EMPLEADOS ===================== */
const FIL={q:'',sede:'',contrato:'',cargo:'',estado:'Activo',sort:'nombre',dir:1,page:0};
const PER=25;
function vEmpleados(){
  const opt=(arr,v)=>arr.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('');
  $('#main').innerHTML=`
  <div class="top"><div><h1>Empleados</h1><div class="sub" id="cnt"></div></div>
   <div style="display:flex;gap:8px"><button class="btn" onclick="exportXlsx(true)">⬇ Exportar vista</button><button class="btn pri" onclick="openEmp()">＋ Nuevo empleado</button></div></div>
  <div class="filters">
    <input type="search" id="fq" placeholder="Buscar por nombre, documento, cargo, correo, celular…" value="${esc(FIL.q)}">
    <select id="fsede"><option value="">Todas las sedes</option>${opt(uniqA('sede'),FIL.sede)}</select>
    <select id="fcargo"><option value="">Todos los cargos</option>${opt(uniqA('cargo'),FIL.cargo)}</select>
    <select id="fcont"><option value="">Todo tipo de contrato</option>${opt(uniqA('tipoContrato'),FIL.contrato)}</select>
  </div>
  <div class="tbl-wrap"><table><thead><tr id="thead"></tr></thead><tbody id="tbody"></tbody></table></div>
  <div class="pager" id="pager"></div>`;
  const bind=(id,k)=>$(id).addEventListener('input',e=>{FIL[k]=e.target.value;FIL.page=0;drawTable()});
  bind('#fq','q');bind('#fsede','sede');bind('#fcargo','cargo');bind('#fcont','contrato');
  drawTable();
}
function filtered(){
  const q=FIL.q.trim().toLowerCase();
  let r=DB.filter(e=>(!FIL.sede||e.sede===FIL.sede)&&(!FIL.cargo||e.cargo===FIL.cargo)&&(!FIL.contrato||e.tipoContrato===FIL.contrato)&&e.estado!=='Retirado'
    &&(!q||[e.nombre,e.numId,e.cargo,e.sede,e.correo,e.celular,e.centro].some(v=>String(v||'').toLowerCase().includes(q))));
  const k=FIL.sort,d=FIL.dir;
  r.sort((a,b)=>{let x=a[k]??'',y=b[k]??'';if(k==='num'){x=+x||0;y=+y||0;return (x-y)*d}return String(x).localeCompare(String(y),'es',{numeric:true})*d});
  return r;
}
const COLS=[['nombre','Nombres y apellidos'],['numId','Documento'],['cargo','Cargo'],['sede','Sede'],['tipoContrato','Contrato'],['fInicio','Inicio'],['antig','Antigüedad',1],['estado','Estado',1]];
function drawTable(){
  const todo=filtered(),busca=!!(FIL.q.trim()||FIL.sede||FIL.cargo||FIL.contrato);
  let r=todo;if(!busca&&todo.length>10){const ult=new Set(todo.slice().sort((a,b)=>String(b.fInicio||'').localeCompare(String(a.fInicio||''))).slice(0,10));r=todo.filter(e=>ult.has(e))}
  const pages=Math.max(1,Math.ceil(r.length/PER));if(FIL.page>=pages)FIL.page=pages-1;
  $('#cnt').textContent=busca?`${todo.length} de ${activos().length} empleados activos`:todo.length>10?`Últimos 10 ingresos de ${todo.length} empleados activos · use el buscador o los filtros para ver los demás`:`${todo.length} empleados activos`;
  $('#thead').innerHTML=COLS.map(([k,l,ns])=>`<th ${ns?'class="ns"':`onclick="sortBy('${k}')"`}>${l}${FIL.sort===k?(FIL.dir>0?' ▲':' ▼'):''}</th>`).join('')+'<th class="ns">Acciones</th>';
  $('#tbody').innerHTML=r.slice(FIL.page*PER,(FIL.page+1)*PER).map(e=>{
    const ret=e.estado==='Retirado';
    const st=ret?'<span class="pill r">Retirado</span>':enPrueba(e)?'<span class="pill p">En prueba</span>':'<span class="pill a">Activo</span>';
    return `<tr><td class="w"><b>${esc(e.nombre)}</b></td><td>${esc(e.tipoId)} ${esc(e.numId)}</td><td class="w">${esc(e.cargo)}</td><td>${esc(e.sede)}</td><td class="w" style="min-width:110px">${esc(e.tipoContrato)}</td><td>${(pd(e.fInicio)||'')&&pd(e.fInicio).toLocaleDateString('es-CO')}</td><td>${antig(e.fInicio,ret?e.fRetiro:null)}</td><td>${st}</td>
    <td><div class="acts"><button class="btn sm ic" title="Ver historial completo" onclick="verPerfil('${e.id}')">👁</button><button class="btn sm ic" title="Editar ficha" onclick="openEmp('${e.id}')">✏️</button>${ret?'':`<button class="btn sm ic imp-b ${impReal(e)?'ok':'pend'}" title="Indicadores de impacto${impReal(e)?'':' (pendiente por diligenciar)'}" onclick="openImp('${e.id}')">🌱</button>`}${ret?`<button class="btn sm ic" title="Reintegrar (volver a Activo)" onclick="reintegrar('${e.id}')">↺</button>`:`<button class="btn sm ic" title="Registrar retiro" onclick="retirar('${e.id}')">🚪</button>`}</div></td></tr>`}).join('')
    ||`<tr><td colspan="10" class="empty">No hay empleados que coincidan con los filtros.</td></tr>`;
  if(!busca){$('#pager').innerHTML='';return}
  $('#pager').innerHTML=`<span>Página ${FIL.page+1} de ${pages}</span><span style="display:flex;gap:6px"><button class="btn sm" ${FIL.page?'':'disabled'} onclick="FIL.page--;drawTable()">‹ Anterior</button><button class="btn sm" ${FIL.page<pages-1?'':'disabled'} onclick="FIL.page++;drawTable()">Siguiente ›</button></span>`;
}
function sortBy(k){if(FIL.sort===k)FIL.dir*=-1;else{FIL.sort=k;FIL.dir=1}drawTable()}

/* ===================== FICHA ===================== */
let EDIT=null,TAB='contrato';
let PEND=null;
const isPend=k=>PEND&&PEND.includes(k)&&!String(EDIT[k]??'').trim();
function openEmp(id,pend,foco){
  EDIT=id?structuredClone(DB.find(e=>e.id===id)):{id:null,estado:'Activo',tipoId:'CC'};
  PEND=pend?CFG.clave.filter(k=>!String(EDIT[k]??'').trim()):null;
  $('#empTitle').textContent=id?(EDIT.nombre||'Empleado'):'Nuevo empleado';drawState();
  const first=foco||(PEND&&PEND[0]);
  TAB=first?FK[first][3]:'contrato';lastErrs={};drawForm();$('#ovEmp').classList.add('show');
  if(first)setTimeout(()=>{const el=$(`#empBody [data-k="${first}"]`);if(el){el.focus();el.scrollIntoView({block:'center'})}},80);
}
function drawTabs(errs){
  $('#tabs').innerHTML=Object.entries(TABS).map(([k,l])=>{const bad=F.some(f=>f[3]===k&&errs[f[0]]);const np=F.filter(f=>f[3]===k&&isPend(f[0])).length;
    return `<button class="${k===TAB?'on':''} ${bad?'err':''}" onclick="TAB='${k}';drawForm(lastErrs)">${l}${bad?' •':''}${np?`<span class="pcnt">${np}</span>`:''}</button>`}).join('');
}
function drawPendBar(){
  if(!PEND)return '';
  const left=PEND.filter(isPend);
  if(!left.length)return `<div class="pbar ok">✓ Ya se completaron todos los campos pendientes. Recuerde <b>Guardar</b>.</div>`;
  return `<div class="pbar">⚠ Faltan <b>${left.length}</b> campo(s) por completar: ${left.map(k=>`<button class="pchip" onclick="goPend('${k}')">${esc(FK[k][1].trim())}</button>`).join('')}</div>`;
}
function goPend(k){TAB=FK[k][3];drawForm(lastErrs);const el=$(`#empBody [data-k="${k}"]`);if(el)el.focus()}
function refreshPend(){if(!PEND)return;drawTabs(lastErrs);const b=$('#empBody .pbar');if(b)b.outerHTML=drawPendBar();
  $('#empBody').querySelectorAll('.f[data-f]').forEach(d=>{const k=d.dataset.f;const p=isPend(k);d.classList.toggle('pend',p);if(PEND.includes(k)&&!d.classList.contains('bad')){const h=d.querySelector('.hint');if(p)h.textContent='Pendiente por completar';else if(h.textContent==='Pendiente por completar')h.textContent='✓ Completado'}})}
function optsFor(src){return CFG.cat[src]?catList(src):(L[src]||[])}
function drawForm(errs={}){
  drawTabs(errs);
  $('#empBody').innerHTML=drawPendBar()+'<div class="fg">'+F.filter(f=>f[3]===TAB).map(f=>{
    const [k,h,t,,src,req]=f;let v=EDIT[k]??'';const lab=`<label>${esc(h.trim())}${req?' <i>*</i>':''}</label>`;let inp,hint='';
    if(k==='edad'){v=edad(EDIT.fNac);inp=`<input readonly value="${v}">`;hint='Se calcula con la fecha de nacimiento'}
    else if(k==='mesNac'){v=mesNac(EDIT.fNac);inp=`<input readonly value="${v}">`;hint='Se calcula con la fecha de nacimiento'}
    else if(t==='sel'){const op=optsFor(src);if(v&&!op.includes(v))op.unshift(v);inp=`<select data-k="${k}"><option value="">Seleccione…</option>${op.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
    else if(t==='list')inp=`<input data-k="${k}" list="dl_${k}" value="${esc(v)}" placeholder="Escriba o seleccione"><datalist id="dl_${k}">${optsFor(src).map(o=>`<option value="${esc(o)}">`).join('')}</datalist>`;
    else if(t==='date')inp=`<input type="date" data-k="${k}" value="${esc(v)}">`;
    else if(t==='num')inp=`<input type="number" min="0" step="1" data-k="${k}" value="${esc(v)}">`;
    else if(t==='money'){inp=`<input type="number" min="0" step="1000" data-k="${k}" value="${esc(v)}">`;hint=v?cop(v):''}
    else if(t==='email')inp=`<input type="email" data-k="${k}" value="${esc(v)}">`;
    else if(t==='tel')inp=`<input type="tel" data-k="${k}" value="${esc(v)}">`;
    else inp=`<input data-k="${k}" value="${esc(v)}">`;
    if(k==='fFinPrueba'&&!hint)hint=`Sugerida: ${CFG.meses} mes(es) desde el inicio del contrato`;
    if(k==='fInicio'&&EDIT.fInicio)hint='Antigüedad: '+(antig(EDIT.fInicio,EDIT.estado==='Retirado'?EDIT.fRetiro:null)||'0 meses');
    if(isPend(k))hint='Pendiente por completar';
    if(errs[k])hint=errs[k];
    return `<div class="f ${errs[k]?'bad':''} ${isPend(k)&&!errs[k]?'pend':''}" data-f="${k}">${lab}${inp}<div class="hint">${esc(hint)}</div></div>`}).join('')+'</div>';
  $('#empBody').querySelectorAll('[data-k]').forEach(el=>el.addEventListener('change',onField));
  $('#empBody').querySelectorAll('input[data-k]:not([type=date])').forEach(el=>el.addEventListener('input',ev=>{EDIT[ev.target.dataset.k]=ev.target.value.trim();refreshPend()}));
}
let lastErrs={};
function onField(ev){
  const k=ev.target.dataset.k;let v=ev.target.value.trim();EDIT[k]=v;setTimeout(refreshPend);
  if(k==='fInicio'&&v&&!EDIT.fFinPrueba){const d=pd(v);d.setMonth(d.getMonth()+CFG.meses);d.setDate(d.getDate()-1);EDIT.fFinPrueba=iso(d)}
  if(k==='fInicio'&&v&&!EDIT.fIngresoSS)EDIT.fIngresoSS=v;
  if(k==='cargo'&&v&&!EDIT.salario){const c=CFG.cat.cargo.find(x=>x.n===v);if(c&&c.sal){EDIT.salario=c.sal;toast(`Se asignó el salario base del cargo: ${cop(c.sal)}`)}}
  if(['fNac','fInicio','salario'].includes(k))drawForm(lastErrs);
}
function drawState(){
  const el=$('#empState');
  if(!EDIT.id){el.innerHTML='<span class="note"><i style="color:var(--danger);font-style:normal">*</i> Todos los campos son obligatorios · el empleado se crea como <b>Activo</b></span>';return}
  const ret=EDIT.estado==='Retirado';
  el.innerHTML=ret
   ?`<span class="pill r">Retirado</span><span class="note">desde ${fmtD(EDIT.fRetiro)} · ${esc(EDIT.motivoRetiro||'sin motivo')}</span><button class="btn sm" onclick="verRetiro('${EDIT.id}')">Ver retiro</button><button class="btn sm" onclick="reintegrar('${EDIT.id}',true)">↺ Reintegrar</button>`
   :`<span class="pill ${enPrueba(EDIT)?'p':'a'}">${enPrueba(EDIT)?'Activo · en prueba':'Activo'}</span><button class="btn sm" onclick="retirar('${EDIT.id}',true)">Registrar retiro</button>`;
  el.innerHTML+=`<button class="btn sm" onclick="verPerfil('${EDIT.id}')">👁 Historial</button>`;
}
function validate(e){
  const er={};
  F.forEach(f=>{if(f[5]&&!String(e[f[0]]??'').trim())er[f[0]]='Campo obligatorio'});
  {const dup=e.numId&&DB.find(x=>x.id!==e.id&&String(x.numId).trim()===String(e.numId).trim());if(dup)er.numId=dup.estado==='Retirado'?`Esta persona ya existe y está retirada (${dup.nombre}). Use “Reintegrar” en la pestaña Retirados${dup.recontratable==='No'?' — marcada como NO recontratable':''}`:`Ya existe un empleado con este documento (${dup.nombre})`}
  if(e.correo&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.correo))er.correo='Correo no válido';
  if(e.fNac){const x=edad(e.fNac);if(x<14||x>90)er.fNac='Revise la fecha (edad calculada: '+x+')'}
  if(e.fFinPrueba&&e.fInicio&&pd(e.fFinPrueba)<pd(e.fInicio))er.fFinPrueba='No puede ser anterior al inicio del contrato';
  return er;
}
/* ===================== HISTORIAL DE CARGOS ===================== */
const CARGO_K=[['cargo','Cargo'],['centro','Operación'],['sede','Sede'],['salario','Salario']];
const MOT_CARGO=['Ascenso','Cambio de cargo','Traslado de operación','Cambio de sede','Ajuste salarial','Reubicación','Corrección de un dato mal digitado'];
function snapCargo(e){return {cargo:e.cargo||'',centro:e.centro||'',sede:e.sede||'',salario:+e.salario||0}}
function cargosDe(e){if(!Array.isArray(e.histCargos)||!e.histCargos.length)e.histCargos=[{id:uid(),desde:e.fInicio||'',hasta:'',...snapCargo(e),tipo:'Ingreso',motivo:'Ingreso a la empresa',obs:''}];return e.histCargos}
const diaAntes=f=>{const d=pd(f);if(!d)return '';d.setDate(d.getDate()-1);return iso(d)};
const fmtCampoC=(k,v)=>k==='salario'?cop(+v)||'—':(v||'—');
function difCargo(a,b){return CARGO_K.filter(([k])=>String(k==='salario'?+a[k]||0:a[k]||'')!==String(k==='salario'?+b[k]||0:b[k]||''))}
let PEND_CARGO=null;
function pedirCambioCargo(old,nw,ch){
  confirmBox('Cambio de cargo / operación',`<p class="note" style="margin-top:0">Este cambio queda guardado en el <b>historial de cargos</b> de ${esc(old.nombre)}.</p>
   <div class="cc-dif">${ch.map(([k,l])=>`<div><small>${l}</small><span>${esc(fmtCampoC(k,old[k]))}</span><i>→</i><b>${esc(fmtCampoC(k,nw[k]))}</b></div>`).join('')}</div>
   <div class="fg" style="grid-template-columns:1fr 1fr;margin-top:12px"><div class="f"><label>Fecha en que aplica <i>*</i></label><input type="date" id="ccF" value="${iso(today())}"></div>
   <div class="f"><label>Motivo <i>*</i></label><select id="ccM"><option value="">Seleccione…</option>${MOT_CARGO.map(m=>`<option>${m}</option>`).join('')}</select></div>
   <div class="f" style="grid-column:1/-1"><label>Observación <i>*</i></label><input id="ccO" placeholder="Ej.: pasa a supervisor de la operación Cartera"></div></div>
   <p class="note" id="ccN" style="margin-bottom:0">Si fue un error de digitación elija “Corrección de un dato mal digitado”: se corrige sin crear un nuevo registro en el historial.</p>`,'Guardar cambio',()=>{});$('#ovConf .modal').style.width='min(620px,100%)';
  $('#confOk').onclick=()=>{const f=$('#ccF').value,m=$('#ccM').value,o=$('#ccO').value.trim();
    if(!f){toast('Indique la fecha en que aplica el cambio');return}if(!m){toast('Seleccione el motivo del cambio');return}if(!o){toast('Escriba la observación del cambio');$('#ccO').focus();return}
    const ult=cargosDe(old).slice(-1)[0];if(m!=='Corrección de un dato mal digitado'&&ult&&ult.desde&&f<=ult.desde){toast(`La fecha debe ser posterior al ${fmtD(ult.desde)} (inicio del cargo actual)`);return}
    PEND_CARGO={f,m,o};closeOv('ovConf');saveEmp()}}
function aplicarCambioCargo(old,nw,ch,P){const H=cargosDe(old).map(x=>({...x})),ult=H[H.length-1];
  if(P.m==='Corrección de un dato mal digitado'){Object.assign(ult,snapCargo(nw));ult.correcciones=(ult.correcciones||[]).concat({f:P.f,det:ch.map(([k,l])=>`${l}: ${fmtCampoC(k,old[k])} → ${fmtCampoC(k,nw[k])}`).join(' · '),obs:P.o})}
  else{ult.hasta=diaAntes(P.f);H.push({id:uid(),desde:P.f,hasta:'',...snapCargo(nw),tipo:'Cambio',motivo:P.m,obs:P.o,de:snapCargo(old)})}
  nw.histCargos=H}
function saveEmp(){
  $('#empBody').querySelectorAll('[data-k]').forEach(el=>EDIT[el.dataset.k]=el.value.trim());
  const er=validate(EDIT);lastErrs=er;
  if(Object.keys(er).length){const first=F.find(f=>er[f[0]]);TAB=first[3];drawForm(er);toast('Revise los campos marcados en rojo');return}
  if(EDIT.salario)EDIT.salario=+EDIT.salario;if(EDIT.hijos!==''&&EDIT.hijos!=null)EDIT.hijos=+EDIT.hijos;
  if(EDIT.id){const old=DB.find(x=>x.id===EDIT.id);
    const chC=old.estado!=='Retirado'?difCargo(old,EDIT):[];
    if(chC.length&&!PEND_CARGO){pedirCambioCargo(old,EDIT,chC);return}
    if(chC.length){aplicarCambioCargo(old,EDIT,chC,PEND_CARGO);PEND_CARGO=null}else{PEND_CARGO=null;if(!EDIT.histCargos)cargosDe(EDIT)}
    const ch=F.filter(f=>f[2]!=='calc'&&f[3]!=='interno'&&String(old[f[0]]??'')!==String(EDIT[f[0]]??''));
    if(ch.length)(EDIT.log=EDIT.log||[]).push({f:new Date().toISOString(),tipo:'edicion',detalle:ch.map(f=>`${f[1].trim()}: ${f[2]==='date'?fmtD(old[f[0]])||'—':f[2]==='money'?cop(old[f[0]])||'—':old[f[0]]||'—'} → ${f[2]==='date'?fmtD(EDIT[f[0]]):f[2]==='money'?cop(EDIT[f[0]]):EDIT[f[0]]}`).join(' · ')});
    DB[DB.findIndex(x=>x.id===EDIT.id)]=EDIT;toast('Cambios guardados')}
  else{EDIT.id=uid();EDIT.num=nextNum();EDIT.estado='Activo';EDIT.log=[{f:new Date().toISOString(),tipo:'creacion',detalle:`${EDIT.cargo} · ${EDIT.sede} · ${EDIT.centro}`}];EDIT.histCargos=null;cargosDe(EDIT);DB.push(EDIT);toast('Empleado registrado')}
  lastErrs={};persist();closeOv('ovEmp');render();
}
/* ===================== RETIROS ===================== */
// Archivos adjuntos en IndexedDB (no caben en el almacenamiento normal del navegador)
const IDB={db:null,
  open(){return this.db?Promise.resolve(this.db):new Promise((ok,ko)=>{const r=indexedDB.open('inconexion_gh_archivos',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>{this.db=r.result;ok(this.db)};r.onerror=()=>ko(r.error)})},
  async put(o){const db=await this.open();return new Promise((ok,ko)=>{const t=db.transaction('files','readwrite');t.objectStore('files').put(o);t.oncomplete=ok;t.onerror=()=>ko(t.error)})},
  async get(id){const db=await this.open();return new Promise((ok,ko)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})},
  async del(id){const db=await this.open();return new Promise(ok=>{const t=db.transaction('files','readwrite');t.objectStore('files').delete(id);t.oncomplete=ok;t.onerror=ok})}
};
const MAXF=8*1024*1024;
const fsize=b=>b<1024?b+' B':b<1048576?Math.round(b/1024)+' KB':(b/1048576).toFixed(1)+' MB';
const fico=t=>/pdf/.test(t)?'📕':/image/.test(t)?'🖼':/word|document/.test(t)?'📘':'📎';
function sugerencia(m){m=(m||'').toLowerCase();
  if(m.includes('renuncia'))return {t:'Adjunte la carta de renuncia firmada por el empleado.',imp:1};
  if(m.includes('práctica')||m.includes('aprendiz'))return {t:'Adjunte el certificado o acta de finalización de prácticas.',imp:1};
  if(m.includes('despido'))return {t:'Adjunte la carta de terminación y, si aplica, el acta de descargos.',imp:1};
  if(m.includes('renovación'))return {t:'Adjunte el preaviso de no renovación entregado al empleado.',imp:1};
  if(m.includes('mutuo'))return {t:'Adjunte el acta de terminación por mutuo acuerdo.',imp:1};
  if(m.includes('pensión'))return {t:'Adjunte la resolución de pensión.',imp:0};
  return {t:'Puede adjuntar los documentos que soportan el retiro.',imp:0};
}
// Equipos asignados en Sistemas (inventario) a una persona de GH
function equiposSistemas(e){
  try{const D=JSON.parse(GH_STORE.getItem('inventario_activos_inconexion_v1')||'null');if(!D||!Array.isArray(D.agentes))return [];
    const c=x=>String(x||'').replace(/[^0-9A-Za-z]/g,''),nn=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const a=D.agentes.find(x=>c(x.cedula)&&c(x.cedula)===c(e.numId))||D.agentes.find(x=>nn(x.nombre)===nn(e.nombre));if(!a)return [];
    const T={torre:'Torre',monitor:'Monitor',teclado:'Teclado',mouse:'Mouse',diadema:'Diadema',portatil:'Portátil'};const out=[];
    const NO=['agentes','asig','actas','log','admin','lists','historial'];Object.keys(D).forEach(k=>{if(Array.isArray(D[k])&&!NO.includes(k))D[k].forEach(r=>{if(r&&r.agenteId===a.id&&!r.equipoId)out.push({tipo:T[k]||k.charAt(0).toUpperCase()+k.slice(1),cod:r.codigo||r.codigom||r.codigodiadema||r.codigotcd||r.codigomouse||Object.keys(r).filter(k=>/^codigo/.test(k)).map(k=>r[k]).find(Boolean)||r.serial||''})})});
    return out}catch(err){return []}
}
// Alerta tras registrar un retiro: qué debe devolver la persona a Sistemas
function alertaPendientesSistemas(e,inf){inf=inf||{};const extraGH=`${inf.sal>0?`<div class="ret-sug imp" style="margin-top:12px">🏖 Tiene <b>${inf.sal} días de vacaciones pendientes</b>: inclúyalos en la liquidación.</div>`:''}${inf.nv||inf.nn?`<div class="ret-sug" style="margin-top:8px">Se anularon automáticamente ${inf.nv?inf.nv+' vacación(es) programada(s)':''}${inf.nv&&inf.nn?' y ':''}${inf.nn?inf.nn+' novedad(es)':''} posteriores a la fecha de retiro.</div>`:''}`;
  const q=equiposSistemas(e);
  const txt=q.length?`Hola ${e.nombre.split(' ')[0]}, te recordamos que antes de tu salida debes devolver al área de Sistemas los siguientes elementos a tu nombre: ${q.map(x=>x.tipo+(x.cod?' '+x.cod:'')).join(', ')}. Por favor acércate pronto para hacer la entrega y firmar el acta de devolución. ¡Gracias!`:'';
  confirmBox(q.length?'⚠ Elementos pendientes por devolver a Sistemas':'✓ Sin elementos pendientes en Sistemas',
   q.length?`<p><b>${esc(e.nombre)}</b> (CC ${esc(e.numId)}) quedó retirado(a), pero aún tiene <b>${q.length} elemento(s)</b> asignado(s) en Sistemas:</p>
     <div class="pend-sis">${q.map(x=>`<div>🖥 <b>${esc(x.tipo)}</b>${x.cod?` · ${esc(x.cod)}`:''}</div>`).join('')}</div>
     <p class="note" style="margin-top:12px">El área de Sistemas ya recibió una alerta para gestionar la devolución. Recuérdele a la persona que debe entregarlos pronto:</p>
     ${extraGH}<textarea id="recSis" rows="5" readonly style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--bg);color:#fff;font:inherit;font-size:13px;resize:vertical">${esc(txt)}</textarea>`
    :`<p><b>${esc(e.nombre)}</b> no tiene equipos ni insumos asignados en Sistemas. No hay nada pendiente por devolver.</p>${extraGH}`,
   q.length?'📋 Copiar recordatorio':'Entendido',
   ()=>{if(!q.length)return;const t=$('#recSis');try{navigator.clipboard.writeText(txt).then(()=>toast('Recordatorio copiado: péguelo en WhatsApp o correo'),()=>{t.select();document.execCommand('copy');toast('Recordatorio copiado')})}catch(err){t.select();document.execCommand('copy');toast('Recordatorio copiado')}});
}
let RET=null; // {id, fecha, motivo, recon, obs, files:[{id,name,type,size,blob?,nuevo?}], quitar:[]}
function retirar(id,fromForm,editar){
  const e=DB.find(x=>x.id===id);
  RET={id,fromForm,editar,fecha:editar?e.fRetiro:iso(today()),motivo:editar?e.motivoRetiro||'':'',recon:editar?e.recontratable||'':'',obs:editar?e.obsRetiro||'':'',
    files:editar?(e.adjRetiro||[]).map(a=>({...a})):[],quitar:[]};
  $('#retTitle').innerHTML=`${editar?'Editar retiro':'Registrar retiro'} · <span style="color:var(--muted);font-weight:400">${esc(e.nombre)}</span>`;
  drawRet();$('#ovRet').classList.add('show');
}
function drawRet(errs={}){
  const e=DB.find(x=>x.id===RET.id),sg=sugerencia(RET.motivo);
  const opts=catList('motivo');if(RET.motivo&&!opts.includes(RET.motivo))opts.unshift(RET.motivo);
  $('#retBody').innerHTML=`
   <div class="ret-emp"><div class="av">${ini(e.nombre)}</div><div><b>${esc(e.nombre)}</b> ${opTag(e)}<span>${esc(e.cargo||'')} · ${esc(e.sede||'')} · ingresó el ${fmtD(e.fInicio)||'—'}</span></div></div>
   ${(q=>q.length?`<div class="ret-sug imp" style="margin:-6px 0 16px">🖥 <b>Tiene ${q.length} elemento(s) asignado(s) en Sistemas:</b> ${q.map(x=>esc(x.tipo+(x.cod?' '+x.cod:''))).join(' · ')}. Al registrar el retiro, Sistemas recibirá una alerta para gestionar su devolución.</div>`:'')(equiposSistemas(e))}
   <div class="fg" style="grid-template-columns:1fr 1fr">
    <div class="f ${errs.fecha?'bad':''}"><label>Fecha de retiro <i>*</i></label><input type="date" id="rFecha" value="${esc(RET.fecha)}"><div class="hint">${errs.fecha||(e.fInicio&&RET.fecha?'Tiempo laborado: '+(antig(e.fInicio,RET.fecha)||'menos de 1 mes'):'')}</div></div>
    <div class="f ${errs.motivo?'bad':''}"><label>Motivo de retiro <i>*</i></label><select id="rMotivo"><option value="">Seleccione…</option>${opts.map(o=>`<option ${o===RET.motivo?'selected':''}>${esc(o)}</option>`).join('')}</select><div class="hint">${errs.motivo||''}</div></div>
    <div class="f ${errs.recon?'bad':''}" style="grid-column:1/-1"><label>¿Se puede volver a contratar? <i>*</i></label>
      <div class="seg3">${L.recontratable.map(o=>`<button type="button" class="${o===RET.recon?'on':''} r${L.recontratable.indexOf(o)}" onclick="RET.recon=RET.recon==='${o}'?'':'${o}';syncRet();drawRet()">${o==='Sí'?'👍 ':o==='No'?'👎 ':'🤔 '}${o}</button>`).join('')}</div><div class="hint">${errs.recon||''}</div></div>
   </div>
   <div class="f ${errs.files?'bad':''}" style="margin-top:14px"><label>Soportes del retiro <i>*</i></label>
     <div class="ret-sug ${sg.imp&&!RET.files.length?'imp':''}">${sg.imp&&!RET.files.length?'⚠ ':'💡 '}${sg.t}</div>
     <label class="ret-drop" id="rDrop"><input type="file" id="rFiles" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" hidden>📎 <b>Seleccionar archivos</b> o arrastrarlos aquí<span>PDF, imagen o Word · máximo 8 MB por archivo</span></label>${errs.files?`<div class="hint">${errs.files}</div>`:''}
     <div class="ret-files">${RET.files.map((f,i)=>`<div class="ret-file"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}${f.nuevo?' <em>nuevo</em>':''}</span><span class="fs">${fsize(f.size)}</span>${f.nuevo?'':`<button class="btn sm ic" title="Ver" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button>`}<button class="btn sm ic" title="Quitar" onclick="quitarAdj(${i})">✕</button></div>`).join('')}</div>
   </div>
   <div class="f ${errs.obs?'bad':''}" style="margin-top:14px"><label>Observaciones <i>*</i></label><textarea id="rObs" rows="4" placeholder="Detalles del retiro: circunstancias, entrega de dotación y equipos, paz y salvo, liquidación, etc.">${esc(RET.obs)}</textarea>${errs.obs?`<div class="hint">${errs.obs}</div>`:''}</div>`;
  $('#retFoot').innerHTML=`<span class="note"><i style="color:var(--red);font-style:normal">*</i> Todos los campos son obligatorios</span><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovRet')">Cancelar</button><button class="btn ${RET.editar?'pri':'dan'}" onclick="guardarRetiro()">${RET.editar?'Guardar cambios':'Registrar retiro'}</button></div>`;
  $('#rMotivo').onchange=()=>{syncRet();drawRet()};
  $('#rFecha').onchange=()=>{syncRet();drawRet()};
  $('#rFiles').onchange=ev=>addFiles(ev.target.files);
  const dr=$('#rDrop');['dragover','dragenter'].forEach(x=>dr.addEventListener(x,ev=>{ev.preventDefault();dr.classList.add('hover')}));
  ['dragleave','drop'].forEach(x=>dr.addEventListener(x,ev=>{ev.preventDefault();dr.classList.remove('hover')}));
  dr.addEventListener('drop',ev=>addFiles(ev.dataTransfer.files));
}
function syncRet(){const g=id=>$(id);if(g('#rFecha'))RET.fecha=g('#rFecha').value;if(g('#rMotivo'))RET.motivo=g('#rMotivo').value;if(g('#rObs'))RET.obs=g('#rObs').value}
function addFiles(list){syncRet();let rech=0;[...list].forEach(f=>{if(f.size>MAXF){rech++;return}RET.files.push({id:uid(),name:f.name,type:f.type||'application/octet-stream',size:f.size,blob:f,nuevo:1})});
  if(rech)toast(`${rech} archivo(s) superan 8 MB y no se agregaron`);drawRet()}
function quitarAdj(i){syncRet();const f=RET.files.splice(i,1)[0];if(!f.nuevo)RET.quitar.push(f.id);drawRet()}
async function verAdj(id,name){
  try{const o=await IDB.get(id);if(!o){toast('No se encontró el archivo en este equipo');return}
    const url=URL.createObjectURL(o.blob);
    if(/pdf|image/.test(o.type)){const w=window.open(url,'_blank');if(!w)dl(o.blob,name)}else dl(o.blob,name);
    setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){toast('No se pudo abrir el archivo')}
}
async function bajarAdj(id,name){try{const o=await IDB.get(id);if(!o){toast('No se encontró el archivo en este equipo');return}dl(o.blob,name)}catch(e){toast('No se pudo descargar')}}
async function guardarRetiro(){
  syncRet();const e=DB.find(x=>x.id===RET.id),er={};
  if(!RET.fecha)er.fecha='Indique la fecha de retiro';else if(e.fInicio&&pd(RET.fecha)<pd(e.fInicio))er.fecha='No puede ser anterior al inicio del contrato';
  if(!RET.motivo)er.motivo='Seleccione el motivo';
  if(!RET.recon)er.recon='Indique si se puede volver a contratar';
  if(!RET.files.length)er.files='Adjunte al menos un soporte del retiro';
  if(!RET.obs.trim())er.obs='Escriba las observaciones del retiro';
  if(Object.keys(er).length){drawRet(er);toast('Revise los campos marcados');return}
  const go=async()=>{
    try{for(const f of RET.files.filter(f=>f.nuevo)){await IDB.put({id:f.id,empId:e.id,name:f.name,type:f.type,size:f.size,blob:f.blob});}
      for(const id of RET.quitar)await IDB.del(id);}catch(err){toast('No se pudieron guardar los archivos adjuntos');return}
    (e.log=e.log||[]).push({f:new Date().toISOString(),tipo:'retiro',detalle:`${RET.editar?'Edición del retiro':'Retiro registrado'}: ${fmtD(RET.fecha)} · ${RET.motivo} · ${RET.files.length} soporte(s)`});
    if(!RET.editar){const fr=RET.fecha;let nv=0,nn=0;
      VAC.forEach(v=>{if(v.empId===e.id&&!v.anulada&&v.tipo==='Disfrute'&&v.fIni>fr){v.anulada=true;v.motivoAnula='Retiro del empleado';nv++}});
      NOV.forEach(n=>{if(n.empId===e.id&&!n.anulada&&n.fIni>fr){n.anulada=true;n.motivoAnula='Retiro del empleado';nn++}});
      if(nv||nn)saveVN();RET._info={nv,nn,sal:vacInfo(e).saldo}}
    e.estado='Retirado';e.fRetiro=RET.fecha;e.motivoRetiro=RET.motivo;e.recontratable=RET.recon;e.obsRetiro=RET.obs.trim();
    e.adjRetiro=RET.files.map(({id,name,type,size})=>({id,name,type,size}));
    persist();closeOv('ovRet');
    if(RET.fromForm&&EDIT&&EDIT.id===e.id){Object.assign(EDIT,{estado:e.estado,fRetiro:e.fRetiro,motivoRetiro:e.motivoRetiro,recontratable:e.recontratable,obsRetiro:e.obsRetiro,adjRetiro:e.adjRetiro});drawState();drawForm(lastErrs)}
    if($('#ovDet')&&$('#ovDet').classList.contains('show'))verRetiro(e.id);
    render();toast(RET.editar?'Retiro actualizado':'Retiro registrado');if(!RET.editar){const inf=RET._info;setTimeout(()=>alertaPendientesSistemas(e,inf),350)}};
  go();
}
function reintegrar(id,fromForm){
  const e=DB.find(x=>x.id===id),c=snapCargo(e),sel=(k,v)=>`<select id="ri_${k}"><option value="">Seleccione…</option>${optsFor(k).map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  const fp=(()=>{const d=today();d.setMonth(d.getMonth()+2);return iso(d)})();
  confirmBox('Reintegrar empleado',`${e.recontratable==='No'?`<div class="ret-sug imp" style="margin-bottom:12px">⛔ En su retiro se marcó como <b>NO recontratable</b>. Verifique la autorización antes de continuar.</div>`:e.recontratable==='Por evaluar'?`<div class="ret-sug imp" style="margin-bottom:12px">🤔 Su recontratación quedó <b>por evaluar</b>.</div>`:''}
   <p style="margin-top:0">Volver a vincular a <b>${esc(e.nombre)}</b>. Antes del retiro era <b>${esc(c.cargo||'—')}</b> en <b>${esc(c.centro||'—')}</b> (${esc(c.sede||'—')}). Indique cómo regresa:</p>
   <div class="fg" style="grid-template-columns:1fr 1fr">
    <div class="f"><label>Fecha de reingreso (nuevo contrato) <i>*</i></label><input type="date" id="ri_f" value="${iso(today())}"></div>
    <div class="f"><label>Tipo de contrato <i>*</i></label>${sel('contrato',e.tipoContrato)}</div>
    <div class="f"><label>Cargo <i>*</i></label>${sel('cargo',c.cargo)}</div>
    <div class="f"><label>Operación (centro de trabajo) <i>*</i></label>${sel('centro',c.centro)}</div>
    <div class="f"><label>Sede <i>*</i></label>${sel('sede',c.sede)}</div>
    <div class="f"><label>Salario mensual <i>*</i></label><input type="number" id="ri_sal" min="0" value="${c.salario||''}"></div>
    <div class="f"><label>Fin del periodo de prueba <i>*</i></label><input type="date" id="ri_fp" value="${fp}"></div>
    <div class="f"><label>Observación <i>*</i></label><input id="ri_o" placeholder="Ej.: regresa como asesor a Cartera"></div></div>
   <p class="note" style="margin-bottom:0">El retiro del ${fmtD(e.fRetiro)} y el cargo que tenía quedan guardados en su historial. Las vacaciones empiezan a contarse desde la fecha de reingreso.</p>`,'Reintegrar',()=>{});$('#ovConf .modal').style.width='min(680px,100%)';
  $('#ri_cargo').onchange=()=>{const k=CFG.cat.cargo.find(x=>x.n===$('#ri_cargo').value);if(k&&k.sal&&$('#ri_cargo').value!==c.cargo)$('#ri_sal').value=k.sal};
  $('#confOk').onclick=()=>{const v=k=>($('#ri_'+k).value||'').trim(),N={f:v('f'),contrato:v('contrato'),cargo:v('cargo'),centro:v('centro'),sede:v('sede'),sal:+v('sal'),fp:v('fp'),o:v('o')};
    const falta=[['f','la fecha de reingreso'],['contrato','el tipo de contrato'],['cargo','el cargo'],['centro','la operación'],['sede','la sede'],['sal','el salario'],['fp','el fin del periodo de prueba'],['o','la observación']].find(([k])=>!N[k]);
    if(falta){toast('Falta '+falta[1]);return}
    if(e.fRetiro&&N.f<=e.fRetiro){toast(`La fecha de reingreso debe ser posterior al retiro (${fmtD(e.fRetiro)})`);return}
    if(N.fp<N.f){toast('El fin del periodo de prueba no puede ser antes del reingreso');return}
    closeOv('ovConf');
    const H=cargosDe(e),ult=H[H.length-1];if(ult&&!ult.hasta)ult.hasta=e.fRetiro||diaAntes(N.f);
    H.push({id:uid(),desde:N.f,hasta:'',cargo:N.cargo,centro:N.centro,sede:N.sede,salario:N.sal,tipo:'Reintegro',motivo:'Reintegro a la empresa',obs:N.o,de:c});
    (e.histRetiros=e.histRetiros||[]).push({fRetiro:e.fRetiro,motivo:e.motivoRetiro,recontratable:e.recontratable,obs:e.obsRetiro,adj:e.adjRetiro||[],reintegro:N.f,fInicioAnterior:e.fInicio,tipoContrato:e.tipoContrato,...c});
    (e.log=e.log||[]).push({f:new Date().toISOString(),tipo:'reintegro',detalle:`Reintegrado el ${fmtD(N.f)} como ${N.cargo} · ${N.centro} · ${N.sede}. Antes: ${c.cargo} · ${c.centro}. Retiro anterior: ${fmtD(e.fRetiro)} · ${e.motivoRetiro||''}`});
    Object.assign(e,{estado:'Activo',fRetiro:'',motivoRetiro:'',recontratable:'',obsRetiro:'',adjRetiro:[],fInicio:N.f,fIngresoSS:N.f,fFinPrueba:N.fp,tipoContrato:N.contrato,cargo:N.cargo,centro:N.centro,sede:N.sede,salario:N.sal});
    persist();closeOv('ovDet');if(fromForm&&EDIT&&EDIT.id===e.id){Object.assign(EDIT,JSON.parse(JSON.stringify(e)));drawState();drawForm(lastErrs)}render();toast(`${e.nombre} reintegrado como ${N.cargo} (${N.centro})`)};
}
/* detalle del retiro */
function verRetiro(id){
  const e=DB.find(x=>x.id===id);let ov=$('#ovDet');
  if(!ov){ov=document.createElement('div');ov.className='ov';ov.id='ovDet';ov.innerHTML='<div class="modal mid"><div class="mh"><h2>Detalle del retiro</h2><button class="x" onclick="closeOv(\'ovDet\')">×</button></div><div class="mb" id="detBody"></div><div class="mf" id="detFoot"></div></div>';document.body.appendChild(ov)}
  const adj=e.adjRetiro||[],rc=e.recontratable;
  $('#detBody').innerHTML=`<div class="ret-emp"><div class="av" style="background:var(--red)">${ini(e.nombre)}</div><div><b>${esc(e.nombre)}</b> ${opTag(e)}<span>${esc(e.tipoId)} ${esc(e.numId)} · ${esc(e.cargo||'')} · ${esc(e.sede||'')}</span></div></div>
   <div class="det-grid">
    <div><small>Fecha de ingreso</small><b>${fmtD(e.fInicio)||'—'}</b></div>
    <div><small>Fecha de retiro</small><b>${fmtD(e.fRetiro)||'—'}</b></div>
    <div><small>Tiempo laborado</small><b>${antig(e.fInicio,e.fRetiro)||'menos de 1 mes'}</b></div>
    <div><small>Tipo de contrato</small><b>${esc(e.tipoContrato||'—')}</b></div>
    <div class="w2"><small>Motivo</small><b><span class="mot">${esc(e.motivoRetiro||'Sin registrar')}</span></b></div>
    <div><small>¿Recontratable?</small><b class="rc ${rc==='Sí'?'si':rc==='No'?'no':''}">${esc(rc||'Sin definir')}</b></div>
   </div>
   <div class="det-sec"><small>Soportes (${adj.length})</small>${adj.length?adj.map(f=>`<div class="ret-file"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}</span><span class="fs">${fsize(f.size)}</span><button class="btn sm ic" title="Ver" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button><button class="btn sm ic" title="Descargar" onclick="bajarAdj('${f.id}','${esc(f.name)}')">⬇</button></div>`).join(''):`<div class="ret-sug ${sugerencia(e.motivoRetiro).imp?'imp':''}">No hay documentos adjuntos. ${sugerencia(e.motivoRetiro).t}</div>`}</div>
   <div class="det-sec"><small>Observaciones</small><div class="det-obs">${e.obsRetiro?esc(e.obsRetiro).replace(/\n/g,'<br>'):'<span class="note">Sin observaciones.</span>'}</div></div>
   ${(e.histRetiros||[]).length?`<div class="det-sec"><small>Retiros anteriores</small>${e.histRetiros.map(h=>`<div class="hist"><b>${fmtD(h.fRetiro)}</b> · ${esc(h.motivo||'Sin motivo')} · reintegrado el ${fmtD(h.reintegro)}${h.obs?`<div class="note">${esc(h.obs)}</div>`:''}${(h.adj||[]).map(f=>`<button class="pchip blue" onclick="bajarAdj('${f.id}','${esc(f.name)}')">${fico(f.type)} ${esc(f.name)}</button>`).join('')}</div>`).join('')}</div>`:''}`;
  $('#detFoot').innerHTML=`<button class="btn" onclick="verPerfil('${e.id}','ret')">👁 Ver historial completo</button><div style="display:flex;gap:8px"><button class="btn" onclick="reintegrar('${e.id}')">↺ Reintegrar</button><button class="btn pri" onclick="retirar('${e.id}',false,true)">Editar retiro / adjuntar</button></div>`;
  ov.classList.add('show');
}
/* pestaña Retirados */
const FR={q:'',motivo:'',centro:'',anio:'',sort:'fRetiro',dir:-1};
function vRetirados(){
  const R=DB.filter(e=>e.estado==='Retirado'),t=today();
  const anios=[...new Set(R.map(e=>(e.fRetiro||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const esteAnio=R.filter(e=>(e.fRetiro||'').startsWith(String(t.getFullYear()))).length;
  const esteMes=R.filter(e=>(e.fRetiro||'').startsWith(iso(t).slice(0,7))).length;
  const pm=count(R,e=>e.motivoRetiro||'Sin motivo');const top=Object.entries(pm).sort((a,b)=>b[1]-a[1]);
  const sinSop=R.filter(e=>!(e.adjRetiro||[]).length).length;
  const opt=(arr,v)=>arr.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('');
  $('#main').innerHTML=`<div class="top"><div><h1>Retirados</h1><div class="sub">Historial de empleados que salieron de la empresa</div></div>
    <button class="btn" onclick="exportRet()">⬇ Exportar a Excel</button></div>
  <div class="kpis">
    <div class="kpi k3"><div class="ico">🚪</div><div><small>Total retirados</small><b>${R.length}</b><em>en el histórico</em></div></div>
    <div class="kpi k1"><div class="ico">📅</div><div><small>Retiros en ${t.getFullYear()}</small><b>${esteAnio}</b><em>${esteMes} en ${MESES[t.getMonth()].toLowerCase()}</em></div></div>
    <div class="kpi k2"><div class="ico">📊</div><div><small>Motivo más frecuente</small><b class="money" style="font-size:17px">${top[0]?esc(top[0][0]):'—'}</b><em>${top[0]?top[0][1]+' caso(s)':''}</em></div></div>
    <div class="kpi k4" style="--kc:var(--red)"><div class="ico">📎</div><div><small>Sin soportes</small><b>${sinSop}</b><em>retiros sin documentos adjuntos</em></div></div>
  </div>
  ${top.length?`<div class="mchips">${top.map(([m,n])=>`<button class="${FR.motivo===m?'on':''}" onclick="FR.motivo=FR.motivo===${JSON.stringify(m).replace(/"/g,'&quot;')}?'':${JSON.stringify(m).replace(/"/g,'&quot;')};vRetirados()">${esc(m)} <b>${n}</b></button>`).join('')}</div>`:''}
  <div class="filters">
    <input type="search" id="rq" placeholder="Buscar por nombre, documento, cargo u observación…" value="${esc(FR.q)}">
    <select id="rmot"><option value="">Todos los motivos</option>${opt(Object.keys(pm).sort(),FR.motivo)}</select>
    <select id="rcen"><option value="">Todas las operaciones</option>${opt([...new Set(R.map(e=>e.centro).filter(Boolean))].sort(),FR.centro)}</select>
    <select id="ranio"><option value="">Todos los años</option>${opt(anios,FR.anio)}</select>
  </div>
  <div class="tbl-wrap"><table><thead><tr id="rhead"></tr></thead><tbody id="rbody"></tbody></table></div><div class="pager" id="rnote"></div>`;
  [['#rq','q'],['#rmot','motivo'],['#rcen','centro'],['#ranio','anio']].forEach(([id,k])=>$(id).addEventListener('input',ev=>{FR[k]=ev.target.value;if(k==='motivo')vRetirados();else drawRet2()}));
  drawRet2();
}
function filtRet(){
  const q=FR.q.trim().toLowerCase();
  return DB.filter(e=>e.estado==='Retirado'&&(!FR.motivo||(e.motivoRetiro||'Sin motivo')===FR.motivo)&&(!FR.centro||e.centro===FR.centro)&&(!FR.anio||(e.fRetiro||'').startsWith(FR.anio))
    &&(!q||[e.nombre,e.numId,e.cargo,e.obsRetiro,e.centro].some(v=>String(v||'').toLowerCase().includes(q))))
   .sort((a,b)=>String(a[FR.sort]??'').localeCompare(String(b[FR.sort]??''),'es',{numeric:true})*FR.dir);
}
function drawRet2(){
  const C=[['nombre','Empleado'],['cargo','Cargo'],['fInicio','Ingreso'],['fRetiro','Retiro'],['t','Tiempo laborado',1],['motivoRetiro','Motivo'],['a','Soportes',1],['recontratable','Recontratable']];
  $('#rhead').innerHTML=C.map(([k,l,ns])=>`<th ${ns?'class="ns"':`onclick="FR.dir=FR.sort==='${k}'?-FR.dir:1;FR.sort='${k}';drawRet2()"`}>${l}${FR.sort===k?(FR.dir>0?' ▲':' ▼'):''}</th>`).join('')+'<th class="ns">Acciones</th>';
  const todo=filtRet(),busca=!!(FR.q.trim()||FR.motivo||FR.centro||FR.anio);
  let r=todo;if(!busca&&todo.length>10){const ult=new Set(todo.slice().sort((a,b)=>String(b.fRetiro||'').localeCompare(String(a.fRetiro||''))).slice(0,10));r=todo.filter(e=>ult.has(e))}
  $('#rnote').innerHTML=busca?`<span>${todo.length} ${todo.length===1?'retirado coincide':'retirados coinciden'} con la búsqueda</span>`:todo.length>10?`<span>Se muestran los <b>10 retiros más recientes</b> de ${todo.length}. Use el buscador o los filtros para ver los demás.</span>`:'';
  const dc=s=>(pd(s)||'')&&pd(s).toLocaleDateString('es-CO');
  $('#rbody').innerHTML=r.map(e=>{const n=(e.adjRetiro||[]).length,rc=e.recontratable;return `<tr>
    <td class="w"><b>${esc(e.nombre)}</b><div style="margin-top:3px">${opTag(e).replace('class="op','class="op sm')}</div></td>
    <td class="w">${esc(e.cargo||'')}<div class="note">${esc(e.sede||'')}</div></td>
    <td>${dc(e.fInicio)}</td><td><b>${dc(e.fRetiro)}</b></td><td>${antig(e.fInicio,e.fRetiro)||'< 1 mes'}</td>
    <td class="w"><span class="mot">${esc(e.motivoRetiro||'Sin motivo')}</span>${e.obsRetiro?`<div class="note obs" title="${esc(e.obsRetiro)}">${esc(e.obsRetiro.slice(0,60))}${e.obsRetiro.length>60?'…':''}</div>`:''}</td>
    <td>${n?`<span class="adjn">📎 ${n}</span>`:'<span class="adjn z">Sin soporte</span>'}</td>
    <td><span class="rc ${rc==='Sí'?'si':rc==='No'?'no':''}">${esc(rc||'—')}</span></td>
    <td><div class="acts"><button class="btn sm ic" title="Ver historial completo" onclick="verPerfil('${e.id}')">👁</button><button class="btn sm ic" title="Detalle del retiro" onclick="verRetiro('${e.id}')">📄</button><button class="btn sm ic" title="Editar retiro / adjuntar soportes" onclick="retirar('${e.id}',false,true)">📎</button><button class="btn sm ic" title="Reintegrar (volver a Activo)" onclick="reintegrar('${e.id}')">↺</button></div></td></tr>`}).join('')
    ||`<tr><td colspan="9" class="empty">${DB.some(e=>e.estado==='Retirado')?'No hay retirados que coincidan con los filtros.':'Aún no hay empleados retirados.'}</td></tr>`;
}
function exportRet(){const r=filtRet();if(!r.length){toast('No hay registros para exportar');return}writeBook(r.map(rowOut),`Gestion_Humana_Retirados_${stamp()}.xlsx`)}

/* ===================== FESTIVOS DE COLOMBIA ===================== */
const _fest={};
function festivos(y){
  if(_fest[y])return _fest[y];
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const pm=Math.floor((h+l-7*m+114)/31),pd_=((h+l-7*m+114)%31)+1,pascua=new Date(y,pm-1,pd_);
  const add=(dt,n)=>{const x=new Date(dt);x.setDate(x.getDate()+n);return x};
  const lunes=dt=>{const w=dt.getDay();return w===1?dt:add(dt,(8-w)%7)};
  const L=[new Date(y,0,1),new Date(y,4,1),new Date(y,6,20),new Date(y,7,7),new Date(y,11,8),new Date(y,11,25),
    lunes(new Date(y,0,6)),lunes(new Date(y,2,19)),lunes(new Date(y,5,29)),lunes(new Date(y,7,15)),lunes(new Date(y,9,12)),lunes(new Date(y,10,1)),lunes(new Date(y,10,11)),
    add(pascua,-3),add(pascua,-2),add(pascua,43),add(pascua,64),add(pascua,71)];
  return _fest[y]=new Set(L.map(iso));
}
const esHabil=(d,sab)=>d.getDay()!==0&&(sab||d.getDay()!==6)&&!festivos(d.getFullYear()).has(iso(d));
function habiles(a,b,sab){const x=pd(a),y=pd(b);if(!x||!y||y<x)return 0;let n=0;for(const d=new Date(x);d<=y;d.setDate(d.getDate()+1))if(esHabil(d,sab))n++;return n}
function sigHabil(s,sab){const d=pd(s);d.setDate(d.getDate()+1);while(!esHabil(d,sab))d.setDate(d.getDate()+1);return iso(d)}
function finPorHabiles(ini,n,sab){const d=pd(ini);while(!esHabil(d,sab))d.setDate(d.getDate()+1);let c=1;while(c<n){d.setDate(d.getDate()+1);if(esHabil(d,sab))c++}return iso(d)}
const calDias=(a,b)=>{const x=pd(a),y=pd(b);return x&&y&&y>=x?days(x,y)+1:0};
const addYears=(dt,n)=>{const x=new Date(dt);x.setFullYear(x.getFullYear()+n);return x};

/* ===================== DATOS DE VACACIONES Y NOVEDADES ===================== */
let VAC=[],NOV=[];
function loadVN(){try{VAC=JSON.parse(GH_STORE.getItem(KEY+'_vac')||'[]');NOV=JSON.parse(GH_STORE.getItem(KEY+'_nov')||'[]')}catch(e){VAC=[];NOV=[]}}
function saveVN(){try{GH_STORE.setItem(KEY+'_vac',JSON.stringify(VAC));GH_STORE.setItem(KEY+'_nov',JSON.stringify(NOV))}catch(e){toast('No se pudo guardar en el navegador')}}
const emp=id=>DB.find(e=>e.id===id);
const empAct=id=>{const e=emp(id);return e&&e.estado!=='Retirado'?e:null}; // solo empleados activos
const uniqA=k=>[...new Set(activos().map(e=>e[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

/* ===================== CÁLCULO DE VACACIONES ===================== */
const DXP=15; // días hábiles por año laborado
function vacEstado(v){const t=iso(today());if(v.anulada)return 'Anulada';if(v.tipo==='Compensación en dinero')return 'Pagada';if(v.fFin<t)return 'Disfrutadas';if(v.fIni<=t)return 'En curso';return 'Programadas'}
function vacInfo(e){
  const t=today(),ini=pd(e.fInicio);
  const regs=VAC.filter(v=>v.empId===e.id&&!v.anulada&&(!e.fInicio||(v.fIni||v.fPago||'')>=e.fInicio)).sort((a,b)=>(a.fIni||a.fPago).localeCompare(b.fIni||b.fPago));
  if(!ini)return {periodos:[],causados:0,tomados:0,saldo:0,pend:[],regs,prox:null,curso:null,proxCumple:null,proporcional:0};
  let full=0;while(addYears(ini,full+1)<=t)full++;
  const periodos=[];for(let i=1;i<=full;i++){const d=addYears(ini,i-1),h=addYears(ini,i);h.setDate(h.getDate()-1);periodos.push({n:i,desde:iso(d),hasta:iso(h),dias:DXP,usados:0})}
  const tomados=regs.reduce((s,v)=>s+(+v.dias||0),0);
  let r=tomados;periodos.forEach(p=>{const u=Math.min(p.dias,r);p.usados=u;r-=u});
  const anticipados=r; // días tomados por encima de lo causado
  const pend=periodos.filter(p=>p.usados<p.dias);
  const causados=full*DXP,saldo=causados-tomados;
  const ti=iso(t);
  const curso=regs.find(v=>v.tipo!=='Compensación en dinero'&&v.fIni<=ti&&v.fFin>=ti)||null;
  const prox=regs.filter(v=>v.tipo!=='Compensación en dinero'&&v.fIni>ti).sort((a,b)=>a.fIni.localeCompare(b.fIni))[0]||null;
  const proxCumple=iso(addYears(ini,full+1));
  const ult=addYears(ini,full),proporcional=Math.round(days(ult,t)/360*DXP*10)/10;
  return {periodos,causados,tomados,saldo,pend,regs,prox,curso,proxCumple,proporcional,anticipados};
}
function vacAlertas(){
  const t=today(),A=activos().filter(e=>e.fInicio);
  const rows=A.map(e=>({e,v:vacInfo(e)}));
  const sinProg=rows.filter(x=>x.v.pend.length&&!x.v.prox&&!x.v.curso);
  const acumulan=rows.filter(x=>x.v.pend.length>=2);
  const enCurso=rows.filter(x=>x.v.curso);
  const proximas=rows.filter(x=>x.v.prox&&days(t,pd(x.v.prox.fIni))<=CFG.diasVac).sort((a,b)=>a.v.prox.fIni.localeCompare(b.v.prox.fIni));
  const cumplen=rows.filter(x=>days(t,pd(x.v.proxCumple))<=CFG.diasVac).sort((a,b)=>a.v.proxCumple.localeCompare(b.v.proxCumple));
  return {rows,sinProg,acumulan,enCurso,proximas,cumplen};
}

/* ===================== PESTAÑA VACACIONES ===================== */
const FV={q:'',centro:'',ver:'',sort:'nombre',dir:1};
function vVacaciones(){
  const t=today(),a=vacAlertas();
  const fecha=s=>fmtD(s),opt=(arr,v)=>arr.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('');
  const item=(x,extra,cls='')=>`<div class="list-item ${cls}"><div class="av" style="background:${extra.c}">${ini(x.e.nombre)}</div><div class="meta"><b>${esc(x.e.nombre)} ${opTag(x.e)}</b><span>${extra.t}</span></div>${extra.r||''}</div>`;
  $('#main').innerHTML=`<div class="top"><div><h1>Vacaciones</h1><div class="sub">Control de periodos causados, saldos y salidas · ${DXP} días hábiles por año laborado (sin sábados, domingos ni festivos)</div></div>
    <div style="display:flex;gap:8px"><button class="btn" onclick="exportVac()">⬇ Exportar a Excel</button><button class="btn pri" onclick="progVac()">＋ Programar vacaciones</button></div></div>
  <div class="kpis">
    <div class="kpi k1"><div class="ico">🏖</div><div><small>De vacaciones hoy</small><b>${a.enCurso.length}</b><em>empleados fuera por vacaciones</em></div></div>
    <div class="kpi k2"><div class="ico">🛫</div><div><small>Salen pronto</small><b>${a.proximas.length}</b><em>en los próximos ${CFG.diasVac} días</em></div></div>
    <div class="kpi k3"><div class="ico">⚠</div><div><small>Pendientes sin programar</small><b>${a.sinProg.length}</b><em>tienen periodos sin fecha asignada</em></div></div>
    <div class="kpi k4" style="--kc:var(--red);--kg:rgba(239,112,112,.18)"><div class="ico">📚</div><div><small>Acumulan 2 o más periodos</small><b>${a.acumulan.length}</b><em>requieren atención prioritaria</em></div></div>
  </div>
  <div class="grid3">
    <div class="card"><h3>🏖 En vacaciones y próximas salidas</h3>
      ${a.enCurso.map(x=>item(x,{c:'var(--blue)',t:`En vacaciones · regresa el <b>${fecha(sigHabil(x.v.curso.fFin,x.v.curso.sab))}</b>`,r:`<span class="pill a">En curso</span>`},'today')).join('')}
      ${a.proximas.map(x=>{const d=days(t,pd(x.v.prox.fIni));return item(x,{c:'var(--green)',t:`Sale el ${fecha(x.v.prox.fIni)} · ${x.v.prox.dias} días hábiles · regresa ${fecha(sigHabil(x.v.prox.fFin,x.v.prox.sab))}`,r:`<span class="pill p">${d===0?'Hoy':d===1?'Mañana':'En '+d+' días'}</span>`})}).join('')}
      ${!a.enCurso.length&&!a.proximas.length?'<div class="empty">Nadie está de vacaciones ni tiene salidas próximas.</div>':''}</div>
    <div class="card alertc"><h3>⚠ Sin fecha de vacaciones programada (${a.sinProg.length})</h3>
      ${a.sinProg.map(x=>item(x,{c:x.v.pend.length>=2?'var(--red)':'var(--orange)',t:`${x.v.saldo} días pendientes · ${x.v.pend.length} periodo(s) sin disfrutar`,r:`<button class="btn sm pri" onclick="progVac('${x.e.id}')">📅 Programar</button>`})).join('')||'<div class="empty">✓ Todos los empleados con vacaciones pendientes tienen fecha programada.</div>'}</div>
    <div class="card"><h3>📆 Cumplen periodo pronto (${a.cumplen.length})</h3>
      ${a.cumplen.map(x=>{const d=days(t,pd(x.v.proxCumple));return item(x,{c:'var(--blue-l)',t:`Cumple ${x.v.periodos.length+1}° año el ${fecha(x.v.proxCumple)} y causa ${DXP} días`,r:`<span class="pill" style="color:var(--blue-l);border-color:rgba(60,160,220,.4);background:rgba(60,160,220,.1)">${d===0?'Hoy':'En '+d+' días'}</span>`})}).join('')||`<div class="empty">Nadie cumple periodo en los próximos ${CFG.diasVac} días.</div>`}</div>
  </div>
  <div class="filters" style="margin-top:16px">
    <input type="search" id="vq" placeholder="Buscar empleado…" value="${esc(FV.q)}">
    <select id="vcen"><option value="">Todas las operaciones</option>${opt(uniqA('centro'),FV.centro)}</select>
    <select id="vver"><option value="">Todos los empleados</option>${opt(['Con días pendientes','Sin programar','Acumulan 2 o más periodos','De vacaciones hoy','Con salida programada'],FV.ver)}</select>
  </div>
  <div class="tbl-wrap"><table><thead><tr id="vhead"></tr></thead><tbody id="vbody"></tbody></table></div>`;
  [['#vq','q'],['#vcen','centro'],['#vver','ver']].forEach(([id,k])=>$(id).addEventListener('input',ev=>{FV[k]=ev.target.value;drawVac()}));
  drawVac();
}
function filtVac(){
  const q=FV.q.trim().toLowerCase();
  let r=vacAlertas().rows.filter(({e,v})=>(!FV.centro||e.centro===FV.centro)&&(!q||[e.nombre,e.numId,e.cargo].some(x=>String(x||'').toLowerCase().includes(q)))
    &&(!FV.ver||(FV.ver==='Con días pendientes'&&v.saldo>0)||(FV.ver==='Sin programar'&&v.pend.length&&!v.prox&&!v.curso)||(FV.ver==='Acumulan 2 o más periodos'&&v.pend.length>=2)||(FV.ver==='De vacaciones hoy'&&v.curso)||(FV.ver==='Con salida programada'&&v.prox)));
  const k=FV.sort,d=FV.dir;
  r.sort((a,b)=>{const g=x=>k==='saldo'?x.v.saldo:k==='pend'?x.v.pend.length:k==='proxCumple'?x.v.proxCumple:x.e[k]??'';const A=g(a),B=g(b);return (typeof A==='number'?A-B:String(A).localeCompare(String(B),'es'))*d});
  return r;
}
function drawVac(){
  const C=[['nombre','Empleado'],['fInicio','Ingreso'],['c','Causados',1],['t','Tomados',1],['saldo','Saldo'],['pend','Periodos pendientes'],['proxCumple','Próximo periodo'],['p','Próximas vacaciones',1]];
  $('#vhead').innerHTML=C.map(([k,l,ns])=>`<th ${ns?'class="ns"':`onclick="FV.dir=FV.sort==='${k}'?-FV.dir:1;FV.sort='${k}';drawVac()"`}>${l}${FV.sort===k?(FV.dir>0?' ▲':' ▼'):''}</th>`).join('')+'<th class="ns">Acciones</th>';
  const dc=s=>(pd(s)||'')&&pd(s).toLocaleDateString('es-CO');
  $('#vbody').innerHTML=filtVac().map(({e,v})=>{
    const np=v.pend.length,sinp=np&&!v.prox&&!v.curso;
    const prox=v.curso?`<span class="pill a">De vacaciones hasta ${dc(v.curso.fFin)}</span>`:v.prox?`<span class="vdate">📅 ${dc(v.prox.fIni)} → ${dc(v.prox.fFin)}</span><div class="note">${v.prox.dias} días hábiles</div>`:np?'<span class="pill r">⚠ Sin programar</span>':'<span class="note">—</span>';
    return `<tr class="${np>=2?'acum':''}"><td class="w"><b>${esc(e.nombre)}</b><div style="margin-top:3px">${opTag(e).replace('class="op','class="op sm')}</div></td>
     <td>${dc(e.fInicio)}<div class="note">${antig(e.fInicio)||'< 1 mes'}</div></td>
     <td>${v.causados} d<div class="note">+${v.proporcional} en curso</div></td><td>${v.tomados} d</td>
     <td><b class="saldo ${v.saldo<0?'neg':v.saldo>=2*DXP?'alto':v.saldo>0?'pos':''}">${v.saldo} días</b></td>
     <td>${np?`<div class="pers">${v.pend.map(p=>`<span class="per ${np>=2?'r':''}" title="${fmtD(p.desde)} a ${fmtD(p.hasta)} · ${p.dias-p.usados} días pendientes">${pd(p.desde).getFullYear()}-${pd(p.hasta).getFullYear()}</span>`).join('')}</div>${np>=2?`<div class="note" style="color:var(--red)">Acumula ${np} periodos</div>`:''}`:'<span class="note">Al día</span>'}</td>
     <td>${dc(v.proxCumple)}<div class="note">${days(today(),pd(v.proxCumple))} días</div></td>
     <td>${prox}</td>
     <td><div class="acts"><button class="btn sm ic" title="Programar vacaciones" onclick="progVac('${e.id}')">📅</button><button class="btn sm ic" title="Historial y periodos" onclick="histVac('${e.id}')">📜</button></div></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">No hay empleados que coincidan con los filtros.</td></tr>';
}

/* --- programar vacaciones --- */
let PV=null;
function modalX(id,cls='mid'){let ov=$('#'+id);if(!ov){ov=document.createElement('div');ov.className='ov';ov.id=id;ov.innerHTML=`<div class="modal ${cls}"><div class="mh"><h2></h2><button class="x" onclick="closeOv('${id}')">×</button></div><div class="mb"></div><div class="mf"></div></div>`;document.body.appendChild(ov)}return ov}
function sabDefecto(empId){const u=VAC.filter(v=>v.empId===empId&&!v.anulada&&v.tipo==='Disfrute').sort((a,b)=>String(b.registrado||b.fIni).localeCompare(String(a.registrado||a.fIni)))[0];return u?!!u.sab:false}
function progVac(empId,editId){
  const v=editId?VAC.find(x=>x.id===editId):null;
  PV=v?{sab:false,...v}:{id:null,empId:empId||'',tipo:'Disfrute',fIni:'',fFin:'',fPago:iso(today()),dias:'',obs:'',sab:sabDefecto(empId)};
  const ov=modalX('ovVac');ov.querySelector('h2').textContent=v?'Editar vacaciones':'Programar vacaciones';drawPV();ov.classList.add('show');
}
function drawPV(errs={}){
  const ov=$('#ovVac'),e=PV.empId?emp(PV.empId):null,info=e?vacInfo(e):null;
  const disp=info?info.saldo+(PV.id?(+VAC.find(x=>x.id===PV.id).dias||0):0):0;
  if(PV.tipo==='Disfrute'&&PV.fIni&&PV.fFin)PV.dias=habiles(PV.fIni,PV.fFin,PV.sab);
  const A=activos().slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  ov.querySelector('.mb').innerHTML=`
   <div class="f ${errs.empId?'bad':''}"><label>Empleado <i>*</i></label><select id="pvEmp" ${PV.id?'disabled':''}><option value="">Seleccione…</option>${A.map(x=>`<option value="${x.id}" ${x.id===PV.empId?'selected':''}>${esc(x.nombre)} — ${esc(x.centro||'')}</option>`).join('')}</select><div class="hint">${errs.empId||''}</div></div>
   ${info?`<div class="vsum"><div><small>Causados</small><b>${info.causados}</b></div><div><small>Tomados</small><b>${info.tomados}</b></div><div><small>Disponibles</small><b class="${disp>0?'pos':disp<0?'neg':''}">${disp}</b></div><div><small>Periodos pendientes</small><b class="${info.pend.length>=2?'neg':''}">${info.pend.length}</b></div><div><small>En causación</small><b>${info.proporcional}</b></div></div>`:''}
   <div class="f" style="margin-top:14px"><label>Tipo <i>*</i></label><div class="seg3 two">${['Disfrute','Compensación en dinero'].map(o=>`<button type="button" class="${PV.tipo===o?'on r0':''}" onclick="syncPV();PV.tipo='${o}';drawPV()">${o==='Disfrute'?'🏖 Disfrute (salir a descansar)':'💵 Compensación en dinero'}</button>`).join('')}</div></div>
   ${PV.tipo==='Disfrute'?`<div class="fg" style="grid-template-columns:1fr 1fr 1fr;margin-top:14px">
     <div class="f ${errs.fIni?'bad':''}"><label>Fecha de salida <i>*</i></label><input type="date" id="pvIni" value="${esc(PV.fIni)}"><div class="hint">${errs.fIni||''}</div></div>
     <div class="f"><label>Días hábiles a disfrutar</label><input type="number" id="pvN" min="1" max="60" value="${PV.dias||''}" placeholder="Ej. 15"><div class="hint">Calcula la fecha final</div></div>
     <div class="f ${errs.fFin?'bad':''}"><label>Último día de vacaciones <i>*</i></label><input type="date" id="pvFin" value="${esc(PV.fFin)}"><div class="hint">${errs.fFin||''}</div></div>
   </div>
   <div class="f" style="margin-top:12px"><label>¿Los sábados cuentan como día de vacaciones? <i>*</i></label><div class="seg3 two">${[[false,'No, de lunes a viernes'],[true,'Sí, de lunes a sábado']].map(([b,l])=>`<button type="button" class="${!!PV.sab===b?'on r0':''}" onclick="syncPV();setSabPV(${b})">${b?'📅':'🗓'} ${l}</button>`).join('')}</div><div class="hint">Use “Sí” para quien trabaja los sábados. Domingos y festivos nunca se cuentan.</div></div>
   ${PV.fIni&&PV.fFin&&PV.dias?`<div class="vcalc">📅 <b>${PV.dias} días hábiles</b>${PV.sab?' <span class="sabt">incluye sábados</span>':''} (${calDias(PV.fIni,PV.fFin)} días calendario) · Sale el <b>${fmtD(PV.fIni)}</b> · Regresa el <b>${fmtD(sigHabil(PV.fFin,PV.sab))}</b>${PV.dias>disp?`<div class="warn">⚠ Supera los días disponibles (${disp}). Se registrarán como vacaciones anticipadas.</div>`:''}</div>`:''}`
   :`<div class="fg" style="grid-template-columns:1fr 1fr;margin-top:14px">
     <div class="f ${errs.fPago?'bad':''}"><label>Fecha de pago <i>*</i></label><input type="date" id="pvPago" value="${esc(PV.fPago)}"><div class="hint">${errs.fPago||''}</div></div>
     <div class="f ${errs.dias?'bad':''}"><label>Días compensados <i>*</i></label><input type="number" id="pvDias" min="1" max="${Math.max(disp,0)}" value="${PV.dias||''}"><div class="hint">${errs.dias||'La ley permite compensar en dinero hasta la mitad de las vacaciones.'}</div></div></div>`}
   <div class="f ${errs.obs?'bad':''}" style="margin-top:14px"><label>Observaciones <i>*</i></label><textarea id="pvObs" rows="3" placeholder="Ej. Aprobado por coordinación, quién cubre el puesto, etc.">${esc(PV.obs)}</textarea><div class="hint">${errs.obs||''}</div></div>`;
  ov.querySelector('.mf').innerHTML=`<span class="note"><i style="color:var(--red);font-style:normal">*</i> Todos los campos son obligatorios</span><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovVac')">Cancelar</button><button class="btn pri" onclick="guardarVac()">Guardar</button></div>`;
  const on=(id,ev,fn)=>{const x=$(id);if(x)x[ev]=fn};
  on('#pvEmp','onchange',()=>{syncPV();drawPV()});
  on('#pvIni','onchange',()=>{syncPV();if(PV.fIni&&+$('#pvN').value)PV.fFin=finPorHabiles(PV.fIni,+$('#pvN').value,PV.sab);else if(PV.fIni&&!PV.fFin&&disp>0)PV.fFin=finPorHabiles(PV.fIni,Math.min(DXP,disp),PV.sab);drawPV()});
  on('#pvN','onchange',()=>{syncPV();const n=+$('#pvN').value;if(PV.fIni&&n>0)PV.fFin=finPorHabiles(PV.fIni,n,PV.sab);drawPV()});
  on('#pvFin','onchange',()=>{syncPV();drawPV()});
}
function setSabPV(b){PV.sab=b;const n=+($('#pvN')&&$('#pvN').value)||+PV.dias;if(PV.fIni&&n>0)PV.fFin=finPorHabiles(PV.fIni,n,PV.sab);drawPV()}
function syncPV(){const g=id=>$(id)?$(id).value:null;const v={empId:g('#pvEmp'),fIni:g('#pvIni'),fFin:g('#pvFin'),fPago:g('#pvPago'),obs:g('#pvObs')};Object.keys(v).forEach(k=>{if(v[k]!==null&&!(k==='empId'&&PV.id))PV[k]=v[k]});if($('#pvDias'))PV.dias=+$('#pvDias').value||''}
function guardarVac(){
  syncPV();const er={};
  if(!PV.empId)er.empId='Seleccione el empleado';
  if(PV.tipo==='Disfrute'){
    if(!PV.fIni)er.fIni='Indique la fecha de salida';
    if(!PV.fFin)er.fFin='Indique el último día';else if(PV.fIni&&PV.fFin<PV.fIni)er.fFin='No puede ser anterior a la salida';
    if(PV.fIni&&PV.fFin&&PV.fFin>=PV.fIni){PV.dias=habiles(PV.fIni,PV.fFin,PV.sab);if(!PV.dias)er.fFin='El rango no tiene días hábiles'}
    if(PV.empId&&PV.fIni&&PV.fFin&&!er.fFin){const cruce=VAC.find(v=>v.empId===PV.empId&&v.id!==PV.id&&!v.anulada&&v.tipo==='Disfrute'&&v.fIni<=PV.fFin&&v.fFin>=PV.fIni);if(cruce)er.fIni=`Se cruza con vacaciones del ${fmtD(cruce.fIni)} al ${fmtD(cruce.fFin)}`}
  }else{if(!PV.fPago)er.fPago='Indique la fecha de pago';if(!(PV.dias>0))er.dias='Indique los días compensados'}
  if(!PV.obs.trim())er.obs='Escriba una observación';
  if(Object.keys(er).length){drawPV(er);toast('Revise los campos marcados');return}
  const rec={id:PV.id||uid(),empId:PV.empId,tipo:PV.tipo,dias:+PV.dias,obs:PV.obs.trim(),registrado:PV.registrado||new Date().toISOString(),sab:PV.tipo==='Disfrute'&&!!PV.sab};
  if(PV.tipo==='Disfrute'){rec.fIni=PV.fIni;rec.fFin=PV.fFin}else{rec.fPago=PV.fPago;rec.fIni=PV.fPago;rec.fFin=PV.fPago}
  const i=VAC.findIndex(x=>x.id===rec.id);if(i>=0)VAC[i]={...VAC[i],...rec};else VAC.push(rec);
  logEv(rec.empId,'vacaciones',`${i>=0?'Edición':'Registro'}: ${rec.tipo==='Disfrute'?`${fmtD(rec.fIni)} → ${fmtD(rec.fFin)}`:'pago en dinero '+fmtD(rec.fPago)} · ${rec.dias} días`);
  saveVN();closeOv('ovVac');if($('#ovHV')&&$('#ovHV').classList.contains('show'))histVac(rec.empId);render();toast(i>=0?'Vacaciones actualizadas':'Vacaciones programadas');
}
function histVac(id){
  const e=emp(id),v=vacInfo(e),ov=modalX('ovHV');ov.querySelector('h2').textContent='Vacaciones · '+e.nombre;
  const all=VAC.filter(x=>x.empId===id).sort((a,b)=>b.fIni.localeCompare(a.fIni));
  ov.querySelector('.mb').innerHTML=`<div class="ret-emp"><div class="av">${ini(e.nombre)}</div><div><b>${esc(e.nombre)}</b> ${opTag(e)}<span>${esc(e.cargo||'')} · ingresó el ${fmtD(e.fInicio)} · ${antig(e.fInicio)}</span></div></div>
   <div class="vsum"><div><small>Causados</small><b>${v.causados}</b></div><div><small>Tomados</small><b>${v.tomados}</b></div><div><small>Saldo</small><b class="${v.saldo>0?'pos':v.saldo<0?'neg':''}">${v.saldo}</b></div><div><small>En causación</small><b>${v.proporcional}</b></div><div><small>Próximo periodo</small><b style="font-size:13px">${fmtD(v.proxCumple)}</b></div></div>
   <div class="det-sec"><small>Periodos causados</small>${v.periodos.length?`<div class="ptl">${v.periodos.map(p=>{const pct=p.usados/p.dias*100;return `<div class="pt ${p.usados>=p.dias?'ok':p.usados?'mid':'no'}"><b>Periodo ${p.n}</b><span>${fmtD(p.desde)} – ${fmtD(p.hasta)}</span><div class="ptb"><i style="width:${pct}%"></i></div><em>${p.usados}/${p.dias} días disfrutados${p.usados<p.dias?` · <b>${p.dias-p.usados} pendientes</b>`:' ✓'}</em></div>`}).join('')}</div>`:'<div class="empty">Aún no cumple su primer año de servicio.</div>'}</div>
   <div class="det-sec"><small>Registros de vacaciones</small>${all.length?all.map(x=>{const st=vacEstado(x);return `<div class="vrec ${x.anulada?'anul':''}"><span class="vst s${['Programadas','En curso','Disfrutadas','Pagada','Anulada'].indexOf(st)}">${st}</span><div><b>${x.tipo==='Disfrute'?`${fmtD(x.fIni)} → ${fmtD(x.fFin)}`:`Pago del ${fmtD(x.fPago)}`}</b> · ${x.dias} días ${x.tipo==='Disfrute'?'hábiles':'compensados'}${x.sab?' <span class="sabt">incluye sábados</span>':''}${x.tipo==='Disfrute'&&!x.anulada?` · regresa ${fmtD(sigHabil(x.fFin,x.sab))}`:''}<div class="note">${esc(x.obs||'')}${x.anulada?` · Anulada: ${esc(x.motivoAnula||'')}`:''}</div></div>${!x.anulada&&st==='Programadas'?`<span class="acts"><button class="btn sm ic" title="Editar" onclick="progVac('${id}','${x.id}')">✏️</button><button class="btn sm ic" title="Anular" onclick="anularVac('${x.id}')">⊘</button></span>`:''}</div>`}).join(''):'<div class="empty">No hay vacaciones registradas.</div>'}</div>`;
  ov.querySelector('.mf').innerHTML=`<span></span><button class="btn pri" onclick="progVac('${id}')">📅 Programar vacaciones</button>`;
  ov.classList.add('show');
}
function anularVac(vid){
  const v=VAC.find(x=>x.id===vid);
  confirmBox('Anular vacaciones',`<p>¿Anular las vacaciones del <b>${fmtD(v.fIni)}</b> al <b>${fmtD(v.fFin)}</b>? Los días vuelven al saldo del empleado.</p><div class="f"><label>Motivo de la anulación <i>*</i></label><input id="anM" placeholder="Ej. Necesidad del servicio, solicitud del empleado…"></div>`,'Anular',()=>{
    const m=$('#anM').value.trim();if(!m){toast('El motivo de la anulación es obligatorio');return}
    v.anulada=true;v.motivoAnula=m;saveVN();logEv(v.empId,'vacaciones',`Anuladas las vacaciones del ${fmtD(v.fIni)}: ${m}`);histVac(v.empId);render();toast('Vacaciones anuladas')});
}
function exportVac(){
  const r=filtVac();if(!r.length){toast('No hay registros');return}
  const wb=XLSX.utils.book_new();
  const h=['EMPLEADO','DOCUMENTO','OPERACIÓN','CARGO','FECHA INGRESO','DÍAS CAUSADOS','DÍAS TOMADOS','SALDO','PERIODOS PENDIENTES','PRÓXIMO PERIODO','PRÓXIMA SALIDA','REGRESO'];
  const rows=r.map(({e,v})=>[e.nombre,e.numId,e.centro,e.cargo,e.fInicio?pd(e.fInicio):'',v.causados,v.tomados,v.saldo,v.pend.length,pd(v.proxCumple),v.prox?pd(v.prox.fIni):(v.curso?'En curso':''),v.prox?pd(sigHabil(v.prox.fFin,v.prox.sab)):(v.curso?pd(sigHabil(v.curso.fFin,v.curso.sab)):'')]);
  XLSX.utils.book_append_sheet(wb,sheetSimple(h,rows),'Saldos');
  XLSX.utils.book_append_sheet(wb,sheetVacRegs(true),'Registros');
  XLSX.writeFile(wb,`Vacaciones_${stamp()}.xlsx`);
}
function sheetSimple(h,rows){rows=rows.map(r=>r.map(c=>c instanceof Date&&!isNaN(c)?{t:'n',v:(Date.UTC(c.getFullYear(),c.getMonth(),c.getDate())-Date.UTC(1899,11,30))/864e5,z:'dd/mm/yyyy'}:c));const ws=XLSX.utils.aoa_to_sheet([h,...rows],{cellDates:false});
  Object.keys(ws).forEach(a=>{if(a[0]==='!')return;const c=ws[a];if(c.v instanceof Date){const d=c.v;c.t='n';c.v=(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/864e5;c.z='dd/mm/yyyy'}});
  ws['!cols']=h.map(x=>({wch:Math.max(14,x.length+2)}));ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:h.length-1}})};return ws}
function sheetVacRegs(soloAct){
  const h=['EMPLEADO','DOCUMENTO','OPERACIÓN','TIPO','FECHA INICIO / PAGO','FECHA FIN','DÍAS','REGRESO','ESTADO','OBSERVACIÓN'];
  const rows=VAC.filter(v=>!soloAct||empAct(v.empId)).map(v=>{const e=emp(v.empId)||{};return [e.nombre||'',e.numId||'',e.centro||'',v.tipo,pd(v.fIni),v.tipo==='Disfrute'?pd(v.fFin):'',v.dias,v.tipo==='Disfrute'?pd(sigHabil(v.fFin,v.sab)):'',vacEstado(v),v.obs+(v.anulada?' | Anulada: '+(v.motivoAnula||''):'')]});
  return sheetSimple(h,rows);
}

/* ===================== INCAPACIDADES Y AUSENTISMOS ===================== */
const LUTO='Licencia de luto';
const esLuto=t=>/luto|fallecimiento/i.test(t||'');
const PARENT_LUTO=['Cónyuge o compañero(a) permanente','Padre','Madre','Hijo(a)','Hermano(a)','Abuelo(a)','Nieto(a)','Suegro(a)','Hijo(a) del cónyuge','Hijo(a) adoptivo(a)','Padre o madre adoptante'];
// duración sugerida por ley para algunos tipos
function finSugerido(tipo,ini){if(!ini)return null;const t=(tipo||'').toLowerCase(),d=pd(ini);
  if(esLuto(tipo))return {fin:finPorHabiles(ini,5),txt:'Ley 1280 de 2009: 5 días hábiles remunerados.'};
  if(t.includes('maternidad')){d.setDate(d.getDate()+125);return {fin:iso(d),txt:'Ley 2114 de 2021: 18 semanas (126 días calendario).'}}
  if(t.includes('paternidad')){d.setDate(d.getDate()+13);return {fin:iso(d),txt:'Ley 2114 de 2021: 2 semanas (14 días calendario).'}}
  return null}
const NOV_CAT=t=>{t=(t||'').toLowerCase();return t.includes('incapacidad')||t.includes('enfermedad')||t.includes('accidente')?'inc':t.includes('licencia')||t.includes('calamidad')?'lic':t.includes('permiso')||t.includes('cita')?'per':'aus'};
const NOV_LBL={inc:'Incapacidad',lic:'Licencia',per:'Permiso',aus:'Ausencia'};
const esInc=t=>NOV_CAT(t)==='inc';
function novActiva(n,ti){return !n.anulada&&n.fIni<=ti&&n.fFin>=ti}
const FN={q:'',tipo:'',cat:'',centro:'',mes:'',sort:'fIni',dir:-1};
function vNovedades(){
  const t=today(),ti=iso(t),mes=ti.slice(0,7),N=NOV.filter(n=>!n.anulada&&empAct(n.empId));
  const hoy=N.filter(n=>novActiva(n,ti));
  const incAct=hoy.filter(n=>esInc(n.tipo));
  const delMes=N.filter(n=>n.fIni.slice(0,7)===mes||n.fFin.slice(0,7)===mes);
  const diasMes=delMes.reduce((s,n)=>{const a=n.fIni<mes+'-01'?mes+'-01':n.fIni,fin=iso(new Date(t.getFullYear(),t.getMonth()+1,0)),b=n.fFin>fin?fin:n.fFin;return s+habiles(a,b)},0);
  const sinSop=N.filter(n=>!(n.adj||[]).length).length;
  const meses=[...new Set(N.map(n=>n.fIni.slice(0,7)))].sort().reverse();
  const pc=count(N,n=>NOV_CAT(n.tipo));
  const opt=(arr,v,lab)=>arr.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(lab?lab(x):x)}</option>`).join('');
  $('#main').innerHTML=`<div class="top"><div><h1>Incapacidades y ausentismos</h1><div class="sub">Registro de incapacidades, licencias, permisos y ausencias</div></div>
    <div style="display:flex;gap:8px"><button class="btn" onclick="exportNov()">⬇ Exportar a Excel</button><button class="btn pri" onclick="regNov()">＋ Registrar novedad</button></div></div>
  <div class="kpis">
    <div class="kpi k3" style="--kc:var(--red);--kg:rgba(239,112,112,.18)"><div class="ico">🏥</div><div><small>Ausentes hoy</small><b>${hoy.length}</b><em>${incAct.length} por incapacidad</em></div></div>
    <div class="kpi k1"><div class="ico">📋</div><div><small>Novedades en ${MESES[t.getMonth()].toLowerCase()}</small><b>${delMes.length}</b><em>registros que afectan el mes</em></div></div>
    <div class="kpi k3"><div class="ico">⏱</div><div><small>Días hábiles perdidos</small><b>${diasMes}</b><em>en ${MESES[t.getMonth()].toLowerCase()}</em></div></div>
    <div class="kpi k4"><div class="ico">📎</div><div><small>Sin soporte</small><b>${sinSop}</b><em>registros sin documento</em></div></div>
  </div>
  ${hoy.length?`<div class="card" style="margin-bottom:14px"><h3>🔴 Ausentes hoy (${hoy.length})</h3><div class="aus">${hoy.map(n=>{const e=emp(n.empId),c=NOV_CAT(n.tipo);return `<div class="ausc c-${c}" onclick="verNov('${n.id}')"><div class="av">${ini(e.nombre)}</div><div><b>${esc(e.nombre)}</b>${opTag(e)}<span class="nt c-${c}">${esc(n.tipo)}</span><em>Hasta el ${fmtD(n.fFin)} · regresa ${fmtD(sigHabil(n.fFin))}</em></div></div>`}).join('')}</div></div>`:''}
  <div class="mchips nchips"><button class="${!FN.cat?'on':''}" onclick="FN.cat='';vNovedades()">Todas <b>${N.length}</b></button>${['inc','lic','per','aus'].map(c=>`<button class="c-${c} ${FN.cat===c?'on':''}" onclick="FN.cat=FN.cat==='${c}'?'':'${c}';vNovedades()">${NOV_LBL[c]}es <b>${pc[c]||0}</b></button>`).join('').replace('Licenciaes','Licencias').replace('Permisoes','Permisos').replace('Incapacidades','Incapacidades').replace('Ausenciaes','Ausencias')}</div>
  <div class="filters">
    <input type="search" id="nq" placeholder="Buscar por empleado, documento u observación…" value="${esc(FN.q)}">
    <select id="ntipo"><option value="">Todos los tipos</option>${opt(catList('novedad'),FN.tipo)}</select>
    <select id="ncen"><option value="">Todas las operaciones</option>${opt(uniqA('centro'),FN.centro)}</select>
    <select id="nmes"><option value="">Todos los meses</option>${opt(meses,FN.mes,m=>MESES[+m.slice(5)-1]+' '+m.slice(0,4))}</select>
  </div>
  <div class="tbl-wrap"><table><thead><tr id="nhead"></tr></thead><tbody id="nbody"></tbody></table></div>`;
  [['#nq','q'],['#ntipo','tipo'],['#ncen','centro'],['#nmes','mes']].forEach(([id,k])=>$(id).addEventListener('input',ev=>{FN[k]=ev.target.value;drawNov()}));
  drawNov();
}
function filtNov(){
  const q=FN.q.trim().toLowerCase();
  return NOV.filter(n=>{const e=empAct(n.empId);return e&&!n.anulada&&(!FN.tipo||n.tipo===FN.tipo)&&(!FN.cat||NOV_CAT(n.tipo)===FN.cat)&&(!FN.centro||e.centro===FN.centro)&&(!FN.mes||n.fIni.startsWith(FN.mes)||n.fFin.startsWith(FN.mes))
    &&(!q||[e.nombre,e.numId,n.obs,n.numInc,n.tipo].some(v=>String(v||'').toLowerCase().includes(q)))})
   .sort((a,b)=>{const g=x=>FN.sort==='nombre'?emp(x.empId).nombre:x[FN.sort]??'';return String(g(a)).localeCompare(String(g(b)),'es',{numeric:true})*FN.dir});
}
function drawNov(){
  const C=[['nombre','Empleado'],['tipo','Tipo'],['fIni','Desde'],['fFin','Hasta'],['d','Días',1],['s','Soporte',1],['o','Observación',1]];
  $('#nhead').innerHTML=C.map(([k,l,ns])=>`<th ${ns?'class="ns"':`onclick="FN.dir=FN.sort==='${k}'?-FN.dir:1;FN.sort='${k}';drawNov()"`}>${l}${FN.sort===k?(FN.dir>0?' ▲':' ▼'):''}</th>`).join('')+'<th class="ns">Acciones</th>';
  const dc=s=>(pd(s)||'')&&pd(s).toLocaleDateString('es-CO'),ti=iso(today());
  $('#nbody').innerHTML=filtNov().map(n=>{const e=emp(n.empId),c=NOV_CAT(n.tipo),act=novActiva(n,ti),k=(n.adj||[]).length;return `<tr>
    <td class="w"><b>${esc(e.nombre)}</b><div style="margin-top:3px">${opTag(e).replace('class="op','class="op sm')}</div></td>
    <td class="w"><span class="nt c-${c}">${esc(n.tipo)}</span>${n.numInc?`<div class="note">N° ${esc(n.numInc)} · ${esc(n.entidad||'')}</div>`:''}${n.parentesco?`<div class="note">Familiar: ${esc(n.parentesco)}</div>`:''}</td>
    <td>${dc(n.fIni)}</td><td>${dc(n.fFin)}${act?'<div><span class="pill r" style="font-size:10px">Vigente</span></div>':''}</td>
    <td><b>${calDias(n.fIni,n.fFin)}</b> cal.<div class="note">${habiles(n.fIni,n.fFin)} hábiles</div></td>
    <td>${k?`<span class="adjn">📎 ${k}</span>`:'<span class="adjn z">Sin soporte</span>'}</td>
    <td class="w"><div class="note obs">${esc((n.obs||'').slice(0,70))}${(n.obs||'').length>70?'…':''}</div></td>
    <td><div class="acts"><button class="btn sm ic" title="Ver detalle" onclick="verNov('${n.id}')">👁</button><button class="btn sm ic" title="Editar" onclick="regNov(null,'${n.id}')">✏️</button></div></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No hay novedades que coincidan con los filtros.</td></tr>';
}
let RN=null;
function regNov(empId,id){
  const n=id?NOV.find(x=>x.id===id):null;
  RN=n?{parentesco:'',...n,files:(n.adj||[]).map(a=>({...a})),quitar:[]}:{id:null,empId:empId||'',tipo:'',fIni:iso(today()),fFin:iso(today()),numInc:'',entidad:'',parentesco:'',obs:'',files:[],quitar:[]};
  const ov=modalX('ovNov');ov.querySelector('h2').textContent=n?'Editar novedad':'Registrar novedad';drawRN();ov.classList.add('show');
}
function drawRN(errs={}){
  const ov=$('#ovNov'),e=RN.empId?emp(RN.empId):null,inc=esInc(RN.tipo),c=NOV_CAT(RN.tipo);
  if(inc&&e&&!RN.entidad)RN.entidad=RN.tipo.toLowerCase().includes('laboral')||RN.tipo.toLowerCase().includes('trabajo')?('ARL '+(e.arl||'')):('EPS '+(e.eps||''));
  const A=activos().slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  const sug=esLuto(RN.tipo)?'Adjunte el registro civil de defunción y el documento que acredite el parentesco (registro civil de nacimiento o matrimonio).':inc?'Adjunte la incapacidad expedida por la EPS o ARL.':c==='lic'?'Adjunte el soporte de la licencia (registro civil, certificado, etc.).':c==='per'?'Adjunte la solicitud de permiso aprobada o la constancia de la cita.':'Adjunte el soporte o el acta de descargos.';
  ov.querySelector('.mb').innerHTML=`
   <div class="fg" style="grid-template-columns:1fr 1fr">
    <div class="f ${errs.empId?'bad':''}"><label>Empleado <i>*</i></label><select id="rnEmp" ${RN.id?'disabled':''}><option value="">Seleccione…</option>${A.map(x=>`<option value="${x.id}" ${x.id===RN.empId?'selected':''}>${esc(x.nombre)} — ${esc(x.centro||'')}</option>`).join('')}</select><div class="hint">${errs.empId||''}</div></div>
    <div class="f ${errs.tipo?'bad':''}"><label>Tipo de novedad <i>*</i></label><select id="rnTipo"><option value="">Seleccione…</option>${catList('novedad').map(o=>`<option ${o===RN.tipo?'selected':''}>${esc(o)}</option>`).join('')}</select><div class="hint">${errs.tipo||(RN.tipo?`Categoría: ${NOV_LBL[c]}`:'')}</div></div>
    <div class="f ${errs.fIni?'bad':''}"><label>Desde <i>*</i></label><input type="date" id="rnIni" value="${esc(RN.fIni)}"><div class="hint">${errs.fIni||''}</div></div>
    <div class="f ${errs.fFin?'bad':''}"><label>Hasta <i>*</i></label><input type="date" id="rnFin" value="${esc(RN.fFin)}"><div class="hint">${errs.fFin||(RN.fIni&&RN.fFin&&RN.fFin>=RN.fIni?`${calDias(RN.fIni,RN.fFin)} días calendario · ${habiles(RN.fIni,RN.fFin)} hábiles · regresa ${fmtD(sigHabil(RN.fFin))}`:'')}</div></div>
    ${esLuto(RN.tipo)?`<div class="f ${errs.parentesco?'bad':''}" style="grid-column:1/-1"><label>Parentesco del familiar fallecido <i>*</i></label><select id="rnPar"><option value="">Seleccione…</option>${PARENT_LUTO.map(o=>`<option ${o===RN.parentesco?'selected':''}>${o}</option>`).join('')}</select><div class="hint">${errs.parentesco||'Aplica para cónyuge o compañero(a) permanente y familiares hasta 2° de consanguinidad, 1° de afinidad y 1° civil.'}</div></div>`:''}
    ${finSugerido(RN.tipo,RN.fIni)?`<div class="vcalc" style="grid-column:1/-1;margin-top:0">⚖ ${finSugerido(RN.tipo,RN.fIni).txt} Fecha final sugerida: <b>${fmtD(finSugerido(RN.tipo,RN.fIni).fin)}</b>${RN.fFin!==finSugerido(RN.tipo,RN.fIni).fin?` <button class="btn sm" style="margin-left:6px" onclick="syncRN();RN.fFin=finSugerido(RN.tipo,RN.fIni).fin;drawRN()">Aplicar</button>`:' ✓'}</div>`:''}
    ${inc?`<div class="f ${errs.numInc?'bad':''}"><label>Número de incapacidad <i>*</i></label><input id="rnNum" value="${esc(RN.numInc)}" placeholder="Número del certificado"><div class="hint">${errs.numInc||''}</div></div>
    <div class="f ${errs.entidad?'bad':''}"><label>Entidad que la expide <i>*</i></label><input id="rnEnt" value="${esc(RN.entidad)}"><div class="hint">${errs.entidad||'Se sugiere según la EPS/ARL del empleado'}</div></div>`:''}
   </div>
   <div class="f ${errs.files?'bad':''}" style="margin-top:14px"><label>Soporte <i>*</i></label>
     <div class="ret-sug ${!RN.files.length?'imp':''}">${!RN.files.length?'⚠ ':'💡 '}${sug}</div>
     <label class="ret-drop" id="rnDrop"><input type="file" id="rnFiles" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" hidden>📎 <b>Seleccionar archivos</b> o arrastrarlos aquí<span>PDF, imagen o Word · máximo 8 MB por archivo</span></label>${errs.files?`<div class="hint">${errs.files}</div>`:''}
     <div class="ret-files">${RN.files.map((f,i)=>`<div class="ret-file"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}${f.nuevo?' <em>nuevo</em>':''}</span><span class="fs">${fsize(f.size)}</span>${f.nuevo?'':`<button class="btn sm ic" title="Ver" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button>`}<button class="btn sm ic" title="Quitar" onclick="syncRN();const f=RN.files.splice(${i},1)[0];if(!f.nuevo)RN.quitar.push(f.id);drawRN()">✕</button></div>`).join('')}</div></div>
   <div class="f ${errs.obs?'bad':''}" style="margin-top:14px"><label>Observaciones <i>*</i></label><textarea id="rnObs" rows="3" placeholder="Diagnóstico general, motivo del permiso, quién autorizó, etc.">${esc(RN.obs)}</textarea><div class="hint">${errs.obs||''}</div></div>`;
  ov.querySelector('.mf').innerHTML=`<span class="note"><i style="color:var(--red);font-style:normal">*</i> Todos los campos son obligatorios</span><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovNov')">Cancelar</button><button class="btn pri" onclick="guardarNov()">Guardar</button></div>`;
  ['#rnEmp','#rnTipo','#rnIni','#rnFin','#rnPar'].forEach(id=>{const x=$(id);if(x)x.onchange=()=>{syncRN();if(id==='#rnTipo'||id==='#rnEmp')RN.entidad='';if(id==='#rnIni'&&RN.fFin<RN.fIni)RN.fFin=RN.fIni;
    if(id==='#rnTipo'||(id==='#rnIni'&&finSugerido(RN.tipo,RN.fIni))){const sg=finSugerido(RN.tipo,RN.fIni);if(sg)RN.fFin=sg.fin}drawRN()}});
  $('#rnFiles').onchange=ev=>{syncRN();let r=0;[...ev.target.files].forEach(f=>{if(f.size>MAXF){r++;return}RN.files.push({id:uid(),name:f.name,type:f.type||'application/octet-stream',size:f.size,blob:f,nuevo:1})});if(r)toast(`${r} archivo(s) superan 8 MB`);drawRN()};
  const dr=$('#rnDrop');['dragover','dragenter'].forEach(x=>dr.addEventListener(x,ev=>{ev.preventDefault();dr.classList.add('hover')}));['dragleave','drop'].forEach(x=>dr.addEventListener(x,ev=>{ev.preventDefault();dr.classList.remove('hover')}));
  dr.addEventListener('drop',ev=>{syncRN();[...ev.dataTransfer.files].forEach(f=>{if(f.size<=MAXF)RN.files.push({id:uid(),name:f.name,type:f.type||'application/octet-stream',size:f.size,blob:f,nuevo:1})});drawRN()});
}
function syncRN(){const g=id=>$(id)?$(id).value:null;const v={empId:RN.id?null:g('#rnEmp'),tipo:g('#rnTipo'),fIni:g('#rnIni'),fFin:g('#rnFin'),numInc:g('#rnNum'),entidad:g('#rnEnt'),parentesco:g('#rnPar'),obs:g('#rnObs')};Object.keys(v).forEach(k=>{if(v[k]!==null)RN[k]=v[k]})}
async function guardarNov(){
  syncRN();const er={},inc=esInc(RN.tipo);
  if(!RN.empId)er.empId='Seleccione el empleado';if(!RN.tipo)er.tipo='Seleccione el tipo';
  if(!RN.fIni)er.fIni='Indique la fecha inicial';if(!RN.fFin)er.fFin='Indique la fecha final';else if(RN.fIni&&RN.fFin<RN.fIni)er.fFin='No puede ser anterior a la fecha inicial';
  if(inc&&!String(RN.numInc||'').trim())er.numInc='Escriba el número de la incapacidad';if(inc&&!String(RN.entidad||'').trim())er.entidad='Indique la entidad';if(esLuto(RN.tipo)&&!RN.parentesco)er.parentesco='Seleccione el parentesco';
  if(!RN.files.length)er.files='Adjunte al menos un soporte';if(!String(RN.obs||'').trim())er.obs='Escriba las observaciones';
  if(RN.empId&&RN.fIni&&RN.fFin&&!er.fFin){const x=NOV.find(n=>n.empId===RN.empId&&n.id!==RN.id&&!n.anulada&&n.fIni<=RN.fFin&&n.fFin>=RN.fIni);if(x)er.fIni=`Se cruza con "${x.tipo}" del ${fmtD(x.fIni)} al ${fmtD(x.fFin)}`}
  if(Object.keys(er).length){drawRN(er);toast('Revise los campos marcados');return}
  try{for(const f of RN.files.filter(f=>f.nuevo))await IDB.put({id:f.id,empId:RN.empId,name:f.name,type:f.type,size:f.size,blob:f.blob});for(const id of RN.quitar)await IDB.del(id)}catch(e){toast('No se pudieron guardar los soportes');return}
  const rec={id:RN.id||uid(),empId:RN.empId,tipo:RN.tipo,fIni:RN.fIni,fFin:RN.fFin,numInc:inc?RN.numInc.trim():'',entidad:inc?RN.entidad.trim():'',parentesco:esLuto(RN.tipo)?RN.parentesco:'',obs:RN.obs.trim(),adj:RN.files.map(({id,name,type,size})=>({id,name,type,size})),registrado:RN.registrado||new Date().toISOString()};
  const i=NOV.findIndex(x=>x.id===rec.id);if(i>=0)NOV[i]={...NOV[i],...rec};else NOV.push(rec);
  logEv(rec.empId,'novedad',`${i>=0?'Edición':'Registro'}: ${rec.tipo} · ${fmtD(rec.fIni)} → ${fmtD(rec.fFin)}`);
  saveVN();closeOv('ovNov');if($('#ovND')&&$('#ovND').classList.contains('show'))verNov(rec.id);render();toast(i>=0?'Novedad actualizada':'Novedad registrada');
}
function verNov(id){
  const n=NOV.find(x=>x.id===id),e=emp(n.empId),c=NOV_CAT(n.tipo),ov=modalX('ovND');ov.querySelector('h2').textContent='Detalle de la novedad';
  ov.querySelector('.mb').innerHTML=`<div class="ret-emp"><div class="av">${ini(e.nombre)}</div><div><b>${esc(e.nombre)}</b> ${opTag(e)}<span>${esc(e.tipoId)} ${esc(e.numId)} · ${esc(e.cargo||'')} · ${esc(e.sede||'')}</span></div></div>
   <div class="det-grid"><div class="w2"><small>Tipo</small><b><span class="nt c-${c}">${esc(n.tipo)}</span></b></div><div><small>Categoría</small><b>${NOV_LBL[c]}</b></div>
    <div><small>Desde</small><b>${fmtD(n.fIni)}</b></div><div><small>Hasta</small><b>${fmtD(n.fFin)}</b></div><div><small>Regresa</small><b>${fmtD(sigHabil(n.fFin))}</b></div>
    <div><small>Días calendario</small><b>${calDias(n.fIni,n.fFin)}</b></div><div><small>Días hábiles</small><b>${habiles(n.fIni,n.fFin)}</b></div>${n.numInc?`<div><small>N° incapacidad</small><b>${esc(n.numInc)}</b></div><div class="w2"><small>Entidad</small><b>${esc(n.entidad)}</b></div>`:''}${n.parentesco?`<div class="w2"><small>Familiar fallecido</small><b>${esc(n.parentesco)}</b></div>`:''}</div>
   <div class="det-sec"><small>Soportes (${(n.adj||[]).length})</small>${(n.adj||[]).map(f=>`<div class="ret-file"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}</span><span class="fs">${fsize(f.size)}</span><button class="btn sm ic" title="Ver" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button><button class="btn sm ic" title="Descargar" onclick="bajarAdj('${f.id}','${esc(f.name)}')">⬇</button></div>`).join('')||'<div class="ret-sug imp">Sin soportes adjuntos.</div>'}</div>
   <div class="det-sec"><small>Observaciones</small><div class="det-obs">${esc(n.obs||'').replace(/\n/g,'<br>')}</div></div>`;
  ov.querySelector('.mf').innerHTML=`<button class="btn" onclick="anularNov('${id}')">⊘ Anular registro</button><button class="btn pri" onclick="regNov(null,'${id}')">✏️ Editar</button>`;
  ov.classList.add('show');
}
function anularNov(id){
  const n=NOV.find(x=>x.id===id);
  confirmBox('Anular novedad',`<p>¿Anular "<b>${esc(n.tipo)}</b>" del ${fmtD(n.fIni)} al ${fmtD(n.fFin)}? El registro se conserva como anulado.</p><div class="f"><label>Motivo de la anulación <i>*</i></label><input id="anN" placeholder="Ej. Registrado por error"></div>`,'Anular',()=>{
    const m=$('#anN').value.trim();if(!m){toast('El motivo de la anulación es obligatorio');return}n.anulada=true;n.motivoAnula=m;saveVN();logEv(n.empId,'novedad',`Anulada: ${n.tipo} del ${fmtD(n.fIni)} · ${m}`);closeOv('ovND');render();toast('Novedad anulada')});
}
function sheetNov(list){
  const h=['EMPLEADO','DOCUMENTO','OPERACIÓN','CARGO','TIPO','CATEGORÍA','DESDE','HASTA','DÍAS CALENDARIO','DÍAS HÁBILES','N° INCAPACIDAD','ENTIDAD','PARENTESCO (LUTO)','SOPORTES','OBSERVACIÓN','ESTADO'];
  return sheetSimple(h,list.map(n=>{const e=emp(n.empId)||{};return [e.nombre||'',e.numId||'',e.centro||'',e.cargo||'',n.tipo,NOV_LBL[NOV_CAT(n.tipo)],pd(n.fIni),pd(n.fFin),calDias(n.fIni,n.fFin),habiles(n.fIni,n.fFin),n.numInc||'',n.entidad||'',n.parentesco||'',(n.adj||[]).map(a=>a.name).join(', '),n.obs||'',n.anulada?'Anulada: '+(n.motivoAnula||''):'Vigente']}));
}
function exportNov(){const r=filtNov();if(!r.length){toast('No hay registros');return}const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheetNov(r),'Novedades');XLSX.writeFile(wb,`Incapacidades_Ausentismos_${stamp()}.xlsx`)}

/* SinCo (GH1): sin vacaciones ni novedades de prueba. */
function demoVN(){return {V:[],N:[]}}

/* ===================== HISTORIAL DEL EMPLEADO ===================== */
// Bitácora: cada acción queda registrada en la ficha de la persona
function logEv(empId,tipo,detalle){const e=emp(empId);if(!e)return;(e.log=e.log||[]).push({f:new Date().toISOString(),tipo,detalle});persist()}
const fmtDT=s=>new Date(s).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'});
let PERF=null,PTAB='linea',PVOLVER='empleados',PFILT='';
function recChip(r){const m={'Sí':['si','👍','Se puede volver a contratar'],'No':['no','👎','No se puede volver a contratar'],'Por evaluar':['ev','🤔','Recontratación por evaluar']}[r]||['ev','❔','Recontratación sin definir'];
  return `<span class="rchip ${m[0]}">${m[1]} <b>${m[2]}</b></span>`}
function verPerfil(id,tab){PERF=id;PTAB=tab||'linea';PFILT='';if(VIEW!=='perfil')PVOLVER=VIEW;VIEW='perfil';document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===PVOLVER));closeOv('ovEmp');closeOv('ovDet');render();window.scrollTo(0,0)}
function eventos(e){
  const ev=[],ti=iso(today()),add=(f,t,ic,tit,det,c,ex)=>{if(f)ev.push({f,t,ic,tit,det,c,ex})};
  const HC=cargosDe(e),h0=HC[0];
  add(h0.desde||e.fInicio,'contrato','🟢','Ingreso a la empresa',`${esc(h0.cargo||'')} · ${esc(h0.sede||'')} · ${esc(h0.centro||'')}`,'green');
  HC.slice(1).forEach(h=>{if(h.tipo==='Reintegro')return;add(h.desde,'cargos','💼',`${esc(h.motivo)}: ${esc(h.cargo)}`,`${CARGO_K.filter(([k])=>h.de&&String(h.de[k]||'')!==String(h[k]||'')).map(([k,l])=>`${l}: ${esc(fmtCampoC(k,h.de[k]))} → <b>${esc(fmtCampoC(k,h[k]))}</b>`).join(' · ')}${h.obs?' · '+esc(h.obs):''}`,'blue')});
  HC.forEach(h=>(h.correcciones||[]).forEach(x=>add(x.f,'cargos','✏','Corrección de cargo / operación',esc(x.det)+(x.obs?' · '+esc(x.obs):''),'gray')));
  if(e.fIngresoSS&&e.fIngresoSS!==e.fInicio)add(e.fIngresoSS,'contrato','🛡','Ingreso a seguridad social',`ARL ${esc(e.arl||'')} · EPS ${esc(e.eps||'')}`,'blue');
  if(e.fFinPrueba&&e.fFinPrueba<ti)add(e.fFinPrueba,'contrato','✅','Superó el periodo de prueba','','green');
  if(e.fFinPrueba&&e.fFinPrueba>=ti&&e.estado!=='Retirado')add(e.fFinPrueba,'contrato','⏳','Termina periodo de prueba (próximo)','','orange');
  const vi=vacInfo(e);vi.periodos.forEach(p=>{const h=pd(p.hasta);h.setDate(h.getDate()+1);add(iso(h),'vacaciones','📆',`Causó el periodo de vacaciones ${p.n}`,`${fmtD(p.desde)} – ${fmtD(p.hasta)} · ${p.dias} días hábiles`,'blue')});
  VAC.filter(v=>v.empId===e.id).forEach(v=>{const st=vacEstado(v);
    if(v.tipo==='Compensación en dinero')add(v.fPago,'vacaciones','💵',`Vacaciones pagadas en dinero · ${v.dias} días`,esc(v.obs||''),'orange',v.anulada?'Anulada: '+esc(v.motivoAnula||''):'');
    else add(v.fIni,'vacaciones','🏖',`Vacaciones ${st.toLowerCase()} · ${v.dias} días hábiles${v.sab?' (incluye sábados)':''}`,`${fmtD(v.fIni)} → ${fmtD(v.fFin)} · regreso ${fmtD(sigHabil(v.fFin,v.sab))}${v.obs?' · '+esc(v.obs):''}`,v.anulada?'gray':st==='Disfrutadas'?'green':'blue',v.anulada?'Anulada: '+esc(v.motivoAnula||''):'')});
  NOV.filter(n=>n.empId===e.id).forEach(n=>{const c=NOV_CAT(n.tipo);add(n.fIni,'novedades',{inc:'🏥',lic:'📄',per:'🕒',aus:'⚠'}[c],`${esc(n.tipo)} · ${calDias(n.fIni,n.fFin)} día(s)`,`${fmtD(n.fIni)} → ${fmtD(n.fFin)}${n.numInc?' · N° '+esc(n.numInc)+' · '+esc(n.entidad):''}${n.parentesco?' · Familiar: '+esc(n.parentesco):''}${n.obs?' · '+esc(n.obs):''}`,{inc:'red',lic:'blue',per:'green',aus:'orange'}[c],n.anulada?'Anulada: '+esc(n.motivoAnula||''):'')});
  (e.histRetiros||[]).forEach(h=>{add(h.fRetiro,'retiros','🚪',`Retiro · ${esc(h.motivo||'')}`,esc(h.obs||''),'red');add(h.reintegro,'retiros','↺','Reintegro a la empresa',(r=>r?`Regresa como <b>${esc(r.cargo)}</b> · ${esc(r.centro)} · ${esc(r.sede)}${h.cargo&&h.cargo!==r.cargo?` (antes ${esc(h.cargo)})`:''}${r.obs?' · '+esc(r.obs):''}`:'')(HC.find(x=>x.tipo==='Reintegro'&&x.desde===h.reintegro)),'green')});
  if(e.estado==='Retirado')add(e.fRetiro,'retiros','🚪',`Retiro · ${esc(e.motivoRetiro||'')}`,`Recontratable: ${esc(e.recontratable||'—')}${e.obsRetiro?' · '+esc(e.obsRetiro):''}`,'red');
  (e.log||[]).filter(l=>l.tipo==='edicion'||l.tipo==='creacion').forEach(l=>add(iso(new Date(l.f)),'cambios',l.tipo==='creacion'?'✚':'✏',l.tipo==='creacion'?'Ficha creada en la plataforma':'Actualización de datos',esc(l.detalle),'gray',fmtDT(l.f)));
  return ev.sort((a,b)=>b.f.localeCompare(a.f));
}
function vPerfil(){
  const e=emp(PERF);if(!e){go(PVOLVER);return}
  const ret=e.estado==='Retirado',vi=vacInfo(e),N=NOV.filter(n=>n.empId===e.id&&!n.anulada),V=VAC.filter(v=>v.empId===e.id);
  const dInc=N.filter(n=>esInc(n.tipo)).reduce((s,n)=>s+calDias(n.fIni,n.fFin),0),dAus=N.filter(n=>!esInc(n.tipo)).reduce((s,n)=>s+habiles(n.fIni,n.fFin),0);
  const docs=[...(e.adjRetiro||[]).map(a=>({...a,de:'Retiro '+fmtD(e.fRetiro)})),...(e.histRetiros||[]).flatMap(h=>(h.adj||[]).map(a=>({...a,de:'Retiro '+fmtD(h.fRetiro)}))),...NOV.filter(n=>n.empId===e.id).flatMap(n=>(n.adj||[]).map(a=>({...a,de:n.tipo+' · '+fmtD(n.fIni)})))];
  const TABSP=[['linea','🕘 Línea de tiempo'],['datos','🪪 Datos'],['vac',`🏖 Vacaciones (${V.length})`],['nov',`🏥 Incapacidades y ausentismos (${NOV.filter(n=>n.empId===e.id).length})`],['car',`💼 Cargos (${cargosDe(e).length})`],['ret',`🚪 Retiros (${(e.histRetiros||[]).length+(ret?1:0)})`],['docs',`📎 Documentos (${docs.length})`]];
  $('#main').innerHTML=`
  <div class="top noprint"><button class="btn" onclick="go(PVOLVER)">← Volver</button><div style="display:flex;gap:8px"><button class="btn" onclick="window.print()">🖨 Imprimir</button><button class="btn" onclick="exportPerfil()">⬇ Excel</button>${ret?'':`<button class="btn pri" onclick="openEmp('${e.id}')">✏️ Editar ficha</button>`}</div></div>
  <section class="pf-hero ${ret?'ret':''}">
    <div class="pf-av">${ini(e.nombre)}</div>
    <div class="pf-id"><div class="eyebrow">Historial del empleado</div><h1>${esc(e.nombre)}</h1>
      <div class="pf-sub">${esc(e.tipoId)} ${esc(e.numId)} · ${esc(e.cargo||'')} · ${esc(e.sede||'')} ${opTag(e)}</div>
      <div class="chips"><span>${ret?'<b style="color:var(--red)">Retirado</b> desde '+fmtD(e.fRetiro):enPrueba(e)?'<b style="color:var(--orange)">Activo · en prueba</b>':'<b style="color:#8fd47a">Activo</b>'}</span><span>Ingreso <b>${fmtD(e.fInicio)}</b></span>${(h0=>h0.desde&&h0.desde!==e.fInicio?`<span>Primer ingreso <b>${fmtD(h0.desde)}</b></span>`:'')(cargosDe(e)[0])}<span><b>${antig(e.fInicio,ret?e.fRetiro:null)||'< 1 mes'}</b> de antigüedad</span><span>${esc(e.tipoContrato||'')}</span>${ret?recChip(e.recontratable):''}${(q=>q.length?`<span class="rchip ${ret?'no':'ev'}" title="${esc(q.map(x=>x.tipo+' '+x.cod).join(', '))}">🖥 <b>${q.length} elemento(s) en Sistemas</b></span>`:'')(equiposSistemas(e))}</div></div>
  </section>
  <div class="kpis pf-k">
    <div class="kpi k1"><div class="ico">🏖</div><div><small>Vacaciones</small><b>${vi.saldo} <span>días</span></b><em>${vi.tomados} tomados de ${vi.causados} causados</em></div></div>
    <div class="kpi k3" style="--kc:var(--red);--kg:rgba(239,112,112,.18)"><div class="ico">🏥</div><div><small>Incapacidades</small><b>${dInc} <span>días</span></b><em>${N.filter(n=>esInc(n.tipo)).length} registro(s)</em></div></div>
    <div class="kpi k3"><div class="ico">🕒</div><div><small>Permisos, licencias y ausencias</small><b>${dAus} <span>días háb.</span></b><em>${N.filter(n=>!esInc(n.tipo)).length} registro(s)</em></div></div>
    <div class="kpi k4"><div class="ico">📎</div><div><small>Documentos</small><b>${docs.length}</b><em>soportes adjuntos</em></div></div>
  </div>
  <div class="ptabs noprint">${TABSP.map(([k,l])=>`<button class="${PTAB===k?'on':''}" onclick="PTAB='${k}';vPerfil()">${l}</button>`).join('')}</div>
  <div id="pfBody">${({linea:pfLinea,datos:pfDatos,vac:pfVac,nov:pfNov,car:pfCargos,ret:pfRet,docs:()=>pfDocs(docs)})[PTAB](e)}</div>`;
}
function pfLinea(e){
  const ev=eventos(e),cats=[['','Todo'],['contrato','Contrato'],['vacaciones','Vacaciones'],['novedades','Incapacidades y ausentismos'],['cargos','Cargos'],['retiros','Retiros'],['cambios','Cambios de datos']];
  const L=ev.filter(x=>!PFILT||x.t===PFILT);
  return `<div class="card"><div class="mchips nchips" style="margin-bottom:16px">${cats.map(([k,l])=>`<button class="${PFILT===k?'on':''}" onclick="PFILT='${k}';vPerfil()">${l} <b>${k?ev.filter(x=>x.t===k).length:ev.length}</b></button>`).join('')}</div>
   <div class="tl">${L.map(x=>`<div class="tli c-${x.c}"><div class="tld">${pd(x.f).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}<span>${x.f.slice(0,4)}</span></div><div class="tlm"><i>${x.ic}</i></div><div class="tlc"><b>${x.tit}</b>${x.det?`<div class="note">${x.det}</div>`:''}${x.ex?`<div class="tlx">${x.ex}</div>`:''}</div></div>`).join('')||'<div class="empty">Sin eventos.</div>'}</div></div>`;
}
function pfDatos(e){
  return `<div class="pf-datos">${Object.entries(TABS).map(([k,l])=>`<div class="card"><h3>${l}</h3><div class="dl">${F.filter(f=>f[3]===k).map(f=>{let v=f[0]==='edad'?edad(e.fNac):f[0]==='mesNac'?mesNac(e.fNac):e[f[0]];if(f[2]==='date')v=fmtD(v);if(f[2]==='money')v=cop(v);return `<div><small>${esc(f[1].trim())}</small><span>${v===''||v==null?'<em class="note">Sin dato</em>':esc(v)}</span></div>`}).join('')}</div></div>`).join('')}
   ${(e.log||[]).length?`<div class="card" style="grid-column:1/-1"><h3>Bitácora de cambios</h3>${e.log.slice().reverse().map(l=>`<div class="lg"><span>${fmtDT(l.f)}</span><b>${esc({creacion:'Creación',edicion:'Edición',retiro:'Retiro',reintegro:'Reintegro',vacaciones:'Vacaciones',novedad:'Novedad'}[l.tipo]||l.tipo)}</b><em>${esc(l.detalle)}</em></div>`).join('')}</div>`:''}</div>`;
}
function pfVac(e){
  const v=vacInfo(e),all=VAC.filter(x=>x.empId===e.id).sort((a,b)=>b.fIni.localeCompare(a.fIni)),ret=e.estado==='Retirado';
  return `<div class="card"><div class="adm-head"><h3>Periodos y saldo</h3>${ret?'':`<button class="btn pri sm" onclick="progVac('${e.id}')">📅 Programar vacaciones</button>`}</div>
   <div class="vsum" style="margin-top:0"><div><small>Causados</small><b>${v.causados}</b></div><div><small>Tomados</small><b>${v.tomados}</b></div><div><small>Saldo</small><b class="${v.saldo>0?'pos':v.saldo<0?'neg':''}">${v.saldo}</b></div><div><small>Periodos pendientes</small><b class="${v.pend.length>=2?'neg':''}">${v.pend.length}</b></div><div><small>${ret?'Estado':'Próximo periodo'}</small><b style="font-size:13px">${ret?'Retirado':fmtD(v.proxCumple)}</b></div></div>
   <div class="det-sec">${v.periodos.length?`<div class="ptl">${v.periodos.map(p=>`<div class="pt ${p.usados>=p.dias?'ok':p.usados?'mid':'no'}"><b>Periodo ${p.n}</b><span>${fmtD(p.desde)} – ${fmtD(p.hasta)}</span><div class="ptb"><i style="width:${p.usados/p.dias*100}%"></i></div><em>${p.usados}/${p.dias} días${p.usados<p.dias?` · <b>${p.dias-p.usados} pendientes</b>`:' ✓'}</em></div>`).join('')}</div>`:'<div class="empty">Aún no cumple su primer año de servicio.</div>'}</div></div>
   <div class="card" style="margin-top:14px"><h3>Registros de vacaciones</h3>${all.length?all.map(x=>{const st=vacEstado(x);return `<div class="vrec ${x.anulada?'anul':''}" style="margin-bottom:6px"><span class="vst s${['Programadas','En curso','Disfrutadas','Pagada','Anulada'].indexOf(st)}">${st}</span><div><b>${x.tipo==='Disfrute'?`${fmtD(x.fIni)} → ${fmtD(x.fFin)}`:`Pago en dinero del ${fmtD(x.fPago)}`}</b> · ${x.dias} días ${x.tipo==='Disfrute'?'hábiles · regreso '+fmtD(sigHabil(x.fFin,x.sab)):'compensados'}<div class="note">${esc(x.obs||'')}${x.anulada?' · Anulada: '+esc(x.motivoAnula||''):''}</div></div></div>`}).join(''):'<div class="empty">No hay vacaciones registradas.</div>'}</div>`;
}
function pfNov(e){
  const L=NOV.filter(n=>n.empId===e.id).sort((a,b)=>b.fIni.localeCompare(a.fIni)),ret=e.estado==='Retirado';
  return `<div class="card"><div class="adm-head"><h3>Incapacidades, licencias, permisos y ausencias</h3>${ret?'':`<button class="btn pri sm" onclick="regNov('${e.id}')">＋ Registrar novedad</button>`}</div>
   ${L.length?`<div class="tbl-wrap" style="box-shadow:none"><table><thead><tr><th class="ns">Tipo</th><th class="ns">Desde</th><th class="ns">Hasta</th><th class="ns">Días</th><th class="ns">Soporte</th><th class="ns">Observación</th><th class="ns"></th></tr></thead><tbody>
   ${L.map(n=>`<tr style="${n.anulada?'opacity:.5':''}"><td class="w"><span class="nt c-${NOV_CAT(n.tipo)}">${esc(n.tipo)}</span>${n.numInc?`<div class="note">N° ${esc(n.numInc)} · ${esc(n.entidad)}</div>`:''}${n.parentesco?`<div class="note">Familiar: ${esc(n.parentesco)}</div>`:''}${n.anulada?`<div class="note" style="color:var(--red)">Anulada: ${esc(n.motivoAnula||'')}</div>`:''}</td><td>${fmtD(n.fIni)}</td><td>${fmtD(n.fFin)}</td><td><b>${calDias(n.fIni,n.fFin)}</b> cal.<div class="note">${habiles(n.fIni,n.fFin)} háb.</div></td><td>${(n.adj||[]).map(a=>`<button class="pchip blue" onclick="verAdj('${a.id}','${esc(a.name)}')">${fico(a.type)} ${esc(a.name)}</button>`).join('')||'<span class="adjn z">Sin soporte</span>'}</td><td class="w"><div class="note obs">${esc(n.obs||'')}</div></td><td><button class="btn sm ic" title="Ver detalle" onclick="verNov('${n.id}')">👁</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No tiene incapacidades ni ausentismos registrados.</div>'}</div>`;
}
function pfCargos(e){const H=cargosDe(e),R=(e.histRetiros||[]),rows=[];
  H.forEach((h,i)=>{rows.push(h);const r=R.find(x=>x.fRetiro&&x.fRetiro===h.hasta);if(r)rows.push({retiro:r})});
  if(e.estado==='Retirado')rows.push({retiro:{fRetiro:e.fRetiro,actual:true}});
  const cur=H[H.length-1];
  return `<div class="card"><div class="adm-head"><h3>Historial de cargos y operaciones</h3>${e.estado==='Retirado'?'':`<button class="btn pri sm" onclick="openEmp('${e.id}')">✏️ Cambiar cargo u operación</button>`}</div>
   <p class="note" style="margin-top:0">Cada cambio de cargo, operación, sede o salario que se guarde en la ficha queda registrado aquí, igual que los reintegros.</p>
   <div class="tbl-wrap" style="box-shadow:none"><table><thead><tr><th class="ns">Periodo</th><th class="ns">Cargo</th><th class="ns">Operación</th><th class="ns">Sede</th><th class="ns">Salario</th><th class="ns">Movimiento</th><th class="ns">Observación</th></tr></thead><tbody>
   ${rows.slice().reverse().map(h=>h.retiro?`<tr class="cc-ret"><td colspan="7">🚪 <b>Retirado${h.retiro.actual?' desde':' el'} ${fmtD(h.retiro.fRetiro)}</b>${h.retiro.reintegro?` · reintegrado el ${fmtD(h.retiro.reintegro)}`:''}</td></tr>`
     :`<tr${h===cur&&e.estado!=='Retirado'?' class="cc-cur"':''}><td class="w"><b>${fmtD(h.desde)||'—'}</b> → ${h.hasta?fmtD(h.hasta):e.estado==='Retirado'?'—':'<span class="pill a">Actual</span>'}<div class="note">${h.desde?antig(h.desde,h.hasta||(e.estado==='Retirado'?e.fRetiro:null))||'< 1 mes':''}</div></td>
      <td><b>${esc(h.cargo||'—')}</b></td><td>${esc(h.centro||'—')}</td><td>${esc(h.sede||'—')}</td><td>${cop(+h.salario)||'—'}</td>
      <td><span class="cc-t ${({Ingreso:'g',Reintegro:'g',Cambio:'b'})[h.tipo]||'b'}">${esc(h.tipo==='Cambio'?h.motivo:h.tipo)}</span></td>
      <td class="w"><div class="note obs">${esc(h.obs||'')}${(h.correcciones||[]).map(x=>`<div>✏ ${fmtD(x.f)}: ${esc(x.det)}</div>`).join('')}</div></td></tr>`).join('')}
   </tbody></table></div></div>`}
function pfRet(e){
  const H=(e.histRetiros||[]).map(h=>({...h,actual:false}));if(e.estado==='Retirado')H.push({fRetiro:e.fRetiro,motivo:e.motivoRetiro,recontratable:e.recontratable,obs:e.obsRetiro,adj:e.adjRetiro||[],actual:true});
  H.sort((a,b)=>b.fRetiro.localeCompare(a.fRetiro));
  return H.length?H.map(h=>`<div class="card" style="margin-bottom:14px"><div class="adm-head"><h3>🚪 Retiro del ${fmtD(h.fRetiro)} ${h.actual?'<span class="pill r">Actual</span>':`<span class="pill a">Reintegrado el ${fmtD(h.reintegro)}</span>`}</h3>${h.actual?`<button class="btn pri sm" onclick="retirar('${e.id}',false,true)">Editar retiro / adjuntar</button>`:''}</div>
    <div class="det-grid"><div class="w2"><small>Motivo</small><b><span class="mot">${esc(h.motivo||'Sin registrar')}</span></b></div><div><small>¿Recontratable?</small><b class="rc ${h.recontratable==='Sí'?'si':h.recontratable==='No'?'no':''}">${esc(h.recontratable||'—')}</b></div>${(c=>c?`<div class="w2"><small>Cargo al retirarse</small><b>${esc(c.cargo||'—')} · ${esc(c.centro||'—')} · ${esc(c.sede||'—')}</b></div>`:'')(h.actual?e:h.cargo?h:null)}</div>
    <div class="det-sec"><small>Observaciones</small><div class="det-obs">${h.obs?esc(h.obs).replace(/\n/g,'<br>'):'<span class="note">Sin observaciones.</span>'}</div></div>
    <div class="det-sec"><small>Soportes</small>${(h.adj||[]).map(f=>`<div class="ret-file"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}</span><span class="fs">${fsize(f.size)}</span><button class="btn sm ic" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button><button class="btn sm ic" onclick="bajarAdj('${f.id}','${esc(f.name)}')">⬇</button></div>`).join('')||'<span class="note">Sin soportes.</span>'}</div></div>`).join('')
   :'<div class="card empty">Este empleado no tiene retiros registrados.</div>';
}
function pfDocs(docs){
  return `<div class="card">${docs.length?docs.map(f=>`<div class="ret-file" style="margin-bottom:6px"><span class="fi">${fico(f.type)}</span><span class="fn">${esc(f.name)}<div class="note">${esc(f.de)}</div></span><span class="fs">${fsize(f.size)}</span><button class="btn sm ic" title="Ver" onclick="verAdj('${f.id}','${esc(f.name)}')">👁</button><button class="btn sm ic" title="Descargar" onclick="bajarAdj('${f.id}','${esc(f.name)}')">⬇</button></div>`).join(''):'<div class="empty">No hay documentos adjuntos.</div>'}</div>`;
}
function sheetCargos(L){return sheetSimple(['NÚMERO ID','NOMBRE','DESDE','HASTA','CARGO','OPERACIÓN','SEDE','SALARIO','MOVIMIENTO','MOTIVO','OBSERVACIÓN'],L.flatMap(e=>cargosDe(e).map(h=>[e.numId,e.nombre,pd(h.desde),pd(h.hasta)||'',h.cargo,h.centro,h.sede,+h.salario||'',h.tipo,h.motivo,h.obs||''])))}
function exportPerfil(){
  const e=emp(PERF),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheetSimple(['CAMPO','VALOR'],F.map(f=>{let v=f[0]==='edad'?edad(e.fNac):f[0]==='mesNac'?mesNac(e.fNac):f[2]==='adj'?(e.adjRetiro||[]).map(a=>a.name).join(', '):e[f[0]];if(f[2]==='date'&&v)v=pd(v);return [f[1].trim(),v??'']})),'Datos');
  const strip=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  XLSX.utils.book_append_sheet(wb,sheetSimple(['FECHA','CATEGORÍA','EVENTO','DETALLE','NOTA'],eventos(e).map(x=>[pd(x.f),x.t,strip(x.tit),strip(x.det),strip(x.ex)])),'Línea de tiempo');
  XLSX.utils.book_append_sheet(wb,sheetSimple(['TIPO','INICIO / PAGO','FIN','DÍAS','ESTADO','OBSERVACIÓN'],VAC.filter(v=>v.empId===e.id).map(v=>[v.tipo,pd(v.fIni),v.tipo==='Disfrute'?pd(v.fFin):'',v.dias,vacEstado(v),v.obs+(v.anulada?' | Anulada: '+(v.motivoAnula||''):'')])),'Vacaciones');
  XLSX.utils.book_append_sheet(wb,sheetNov(NOV.filter(n=>n.empId===e.id)),'Novedades');
  XLSX.utils.book_append_sheet(wb,sheetCargos([e]),'Cargos');
  XLSX.writeFile(wb,`Historial_${e.nombre.replace(/\s+/g,'_')}_${stamp()}.xlsx`);
}

/* ===================== AUSENTISMO (módulo independiente) =====================
   Base propia de eventos con el formato del archivo "AUSENTISMO". No se cruza con
   empleados, vacaciones ni novedades: solo se muestra en esta pestaña. */
const AUS_KEY=KEY+'_aus',AUSCFG_KEY=KEY+'_auscfg';
let AUS=[],AUSCFG={div:30,diasEmp:2,pEmpInc:66.67,pEPS:66.67,pARL:100,pOtras:100,salAnual:{2025:1423500,2026:1750905}};
const AUS_CAUSAS=['Incapacidad','Vacaciones','Día de la familia','Compensatorio de votaciones','Licencia remunerada','Licencia no remunerada','Suspensión de contrato'];
const AUS_SUB={'Incapacidad':['Enfermedad general','Accidente de trabajo','Enfermedad laboral','Posquirúrgico','No especificada'],'Vacaciones':['Período de vacaciones'],'Día de la familia':['Día de la familia'],'Compensatorio de votaciones':['Jurado / día de votación'],'Licencia remunerada':['Licencia de maternidad','Licencia de paternidad','Luto / calamidad doméstica','Otra licencia remunerada'],'Licencia no remunerada':['Licencia no remunerada'],'Suspensión de contrato':['Suspensión de contrato']};
const AUS_H=['Id','Fuente','Año','Mes','Fecha','Trabajador','Cédula','Cargo','Área','Tipo de trabajador','Causa de ausentismo','Subtipo / diagnóstico','Días','Detalle original','Salario básico','Salario día','Días asumidos por la empresa','Días asegurados (EPS/ARL)','% pago asumido','% pago asegurado','Costo asumido','Costo asegurado','Costo total'];
function loadAus(){try{AUS=JSON.parse(GH_STORE.getItem(AUS_KEY)||'[]');const c=JSON.parse(GH_STORE.getItem(AUSCFG_KEY)||'null');if(c)AUSCFG=Object.assign(AUSCFG,c)}catch(e){AUS=[]}}
function saveAus(){try{GH_STORE.setItem(AUS_KEY,JSON.stringify(AUS));GH_STORE.setItem(AUSCFG_KEY,JSON.stringify(AUSCFG))}catch(e){toast('No se pudo guardar: el navegador no tiene espacio suficiente')}}
// cálculo de costos (replica las fórmulas del archivo original)
function ausCalc(r){
  const P=AUSCFG,sal=+r.sal||0,salDia=sal/P.div,dias=+r.dias||0,c=r.causa||'',sub=r.sub||'';
  const noPago=c==='Licencia no remunerada'||c==='Suspensión de contrato',lab=/accidente de trabajo|laboral/i.test(sub),mp=/maternidad|paternidad/i.test(sub);
  const dA=noPago?0:c==='Incapacidad'?(lab?0:Math.min(dias,P.diasEmp)):(mp?0:dias);
  const dS=noPago?0:Math.round((dias-dA)*100)/100;
  const pA=dA===0?0:(c==='Incapacidad'?P.pEmpInc:P.pOtras)/100;
  const pS=dS===0?0:(c==='Incapacidad'&&!lab?P.pEPS:P.pARL)/100;
  const cA=Math.round(salDia*dA*pA),cS=Math.round(salDia*dS*pS);
  return {anio:r.fecha?+r.fecha.slice(0,4):'',mes:r.fecha?MESES[+r.fecha.slice(5,7)-1]:'',salDia,dA,dS,pA,pS,cA,cS,cT:cA+cS};
}
const ausKey=r=>[r.fecha,(r.trab||'').trim().toLowerCase(),r.causa,r.sub,+r.dias,r.fuente].join('|');
const nf=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n||0);
const copC=n=>{n=n||0;return Math.abs(n)>=1e6?'$ '+nf(Math.round(n/1e5)/10)+' M':cop(n)};

/* --- filtros y vista --- */
const FA={anio:'',mes:'',area:'',causa:'',cargo:'',fuente:'',q:'',page:0,sort:'fecha',dir:-1,tq:''};
function ausFilt(){
  const q=FA.q.trim().toLowerCase();
  return AUS.filter(r=>!r.anulado&&(!FA.anio||r.fecha.startsWith(FA.anio))&&(!FA.mes||+r.fecha.slice(5,7)===+FA.mes)&&(!FA.area||r.area===FA.area)&&(!FA.causa||r.causa===FA.causa)&&(!FA.cargo||r.cargo===FA.cargo)&&(!FA.fuente||r.fuente===FA.fuente)
    &&(!q||[r.trab,r.ced,r.sub,r.det].some(v=>String(v||'').toLowerCase().includes(q))));
}
const ausU=k=>[...new Set(AUS.filter(r=>!r.anulado).map(r=>r[k]).filter(v=>v!==''&&v!=null))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
function vAusentismo(){
  if(!AUS.filter(r=>!r.anulado).length){
    $('#main').innerHTML=`<div class="top"><div><h1>Costos de ausentismo</h1><div class="sub">Registro de eventos de ausentismo, costos y gráficos</div></div><div style="display:flex;gap:8px"><button class="btn" onclick="ausParam()">⚙ Parámetros</button><button class="btn pri" onclick="ausForm()">＋ Registrar evento</button></div></div>
    <div class="card aus-empty"><div class="cp-ico" style="margin:0 auto 14px">📉</div><h3 style="justify-content:center">Aún no hay eventos registrados</h3>
      <p class="note" style="max-width:520px;margin:0 auto 18px">Registre cada incapacidad, vacación, día de la familia, licencia o suspensión. La plataforma calcula el costo para la empresa y para la EPS/ARL y arma los gráficos automáticamente.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn pri big" onclick="ausForm()">＋ Registrar el primer evento</button></div></div>`;
    return;
  }
  const R=ausFilt(),C=R.map(r=>({r,c:ausCalc(r)}));
  const sum=f=>C.reduce((s,x)=>s+f(x),0);
  const dias=sum(x=>+x.r.dias),cT=sum(x=>x.c.cT),cA=sum(x=>x.c.cA),cS=sum(x=>x.c.cS),trab=new Set(R.map(r=>(r.trab||'').toLowerCase())).size;
  const opt=(arr,v,lab)=>arr.map(x=>`<option value="${esc(x)}" ${String(x)===String(v)?'selected':''}>${esc(lab?lab(x):x)}</option>`).join('');
  const by=(fn,val)=>{const m={};C.forEach(x=>{const k=fn(x)||'Sin dato';m[k]=(m[k]||0)+val(x)});Object.keys(m).forEach(k=>m[k]=Math.round(m[k]*100)/100);return m};
  const top=(m,n)=>Object.fromEntries(Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n));
  const fechas=R.map(r=>r.fecha).sort();
  $('#main').innerHTML=`<div class="top"><div><h1>Costos de ausentismo</h1><div class="sub">${R.length} eventos · ${fechas.length?fmtD(fechas[0])+' a '+fmtD(fechas[fechas.length-1]):''}${AUS.some(r=>r.demo&&!r.anulado)?' · <span style="color:var(--orange)">incluye datos de prueba</span>':''}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="ausExport()">⬇ Exportar</button><button class="btn" onclick="ausParam()">⚙ Parámetros</button><button class="btn pri" onclick="ausForm()">＋ Registrar evento</button></div></div>
  <div class="filters aus-f">
    <select id="faA"><option value="">Todos los años</option>${opt([...new Set(AUS.filter(r=>!r.anulado).map(r=>r.fecha.slice(0,4)))].sort().reverse(),FA.anio)}</select>
    <select id="faM"><option value="">Todos los meses</option>${opt([...Array(12).keys()].map(i=>i+1),FA.mes,m=>MESES[m-1])}</select>
    <select id="faC"><option value="">Todas las causas</option>${opt(ausU('causa'),FA.causa)}</select>
    <select id="faAr"><option value="">Todas las áreas</option>${opt(ausU('area'),FA.area)}</select>
    <select id="faCa"><option value="">Todos los cargos</option>${opt(ausU('cargo'),FA.cargo)}</select>
    <select id="faF"><option value="">Todas las fuentes</option>${opt(ausU('fuente'),FA.fuente)}</select>
    <input type="search" id="faQ" placeholder="Buscar trabajador, cédula, diagnóstico…" value="${esc(FA.q)}">
    ${FA.anio||FA.mes||FA.causa||FA.area||FA.cargo||FA.fuente||FA.q?`<button class="btn sm" onclick="Object.assign(FA,{anio:'',mes:'',area:'',causa:'',cargo:'',fuente:'',q:'',page:0});vAusentismo()">✕ Limpiar filtros</button>`:''}
  </div>
  <div class="kpis aus-k">
    <div class="kpi k1"><div class="ico">📋</div><div><small>Eventos</small><b>${nf(R.length)}</b><em>${trab} trabajadores</em></div></div>
    <div class="kpi k3"><div class="ico">⏱</div><div><small>Días de ausentismo</small><b>${nf(Math.round(dias*10)/10)}</b><em>${R.length?nf(Math.round(dias/R.length*10)/10):0} días por evento</em></div></div>
    <div class="kpi k4"><div class="ico">$</div><div><small>Costo total</small><b class="money">${cop(cT)}</b><em>${trab?cop(Math.round(cT/trab)):''} por trabajador</em></div></div>
    <div class="kpi k3" style="--kc:var(--red);--kg:rgba(239,112,112,.18)"><div class="ico">🏢</div><div><small>Asumido por la empresa</small><b class="money">${cop(cA)}</b><em>${cT?Math.round(cA/cT*100):0}% del costo</em></div></div>
    <div class="kpi k2"><div class="ico">🛡</div><div><small>Asegurado (EPS/ARL)</small><b class="money">${cop(cS)}</b><em>${cT?Math.round(cS/cT*100):0}% del costo</em></div></div>
  </div>
  <div class="dash">
    <div class="card c2"><h3>Días de ausentismo por mes</h3>${ausLineas(C)}</div>
    <div class="card"><h3>Días por causa</h3>${ausDonut(by(x=>x.r.causa,x=>+x.r.dias),'días')}</div>
    <div class="card"><h3>Distribución del costo</h3>${ausDonut({'Asumido por la empresa':cA,'Asegurado EPS/ARL':cS},'',copC,['#EF7070','#64B450'])}</div>
    <div class="card c4"><h3>Costo por mes · empresa vs. EPS/ARL</h3>${ausStack(C)}</div>
    <div class="card c2"><h3>Trabajadores con más días de ausentismo (top 10)</h3>${ausBars(top(by(x=>x.r.trab,x=>+x.r.dias),10),'#EF7070','d')}</div>
    <div class="card c2"><h3>Subtipo / diagnóstico (días)</h3>${ausBars(top(by(x=>x.r.sub,x=>+x.r.dias),10),'#F0A35A','d')}</div>
    <div class="card"><h3>Eventos por área</h3>${ausDonut(by(x=>x.r.area,()=>1),'eventos')}</div>
    <div class="card"><h3>Costo por causa</h3>${ausBars(by(x=>x.r.causa,x=>x.c.cT),'#3CA0DC','$')}</div>
    <div class="card c2"><h3>Eventos por cargo</h3>${cols(by(x=>x.r.cargo,()=>1),null,null,'grad',560)}</div>
  </div>
  <div class="card" style="margin-top:14px"><div class="adm-head"><h3>Eventos registrados</h3><span class="adm-tot" id="ausTot"></span></div>
    <div class="aus-tq"><input id="ausTQ" placeholder="🔎 Buscar en los eventos: nombre, cédula, cargo, causa, diagnóstico, fecha…" value="${esc(FA.tq)}">${FA.tq?`<button class="btn sm" onclick="FA.tq='';FA.page=0;ausTabla(AUS_C);$('#ausTQ').value=''">✕ Limpiar</button>`:''}</div>
    <div class="tbl-wrap" style="box-shadow:none"><table><thead><tr id="ausH"></tr></thead><tbody id="ausB"></tbody></table></div><div class="pager" id="ausP"></div></div>`;
  [['#faA','anio'],['#faM','mes'],['#faC','causa'],['#faAr','area'],['#faCa','cargo'],['#faF','fuente']].forEach(([id,k])=>$(id).onchange=ev=>{FA[k]=ev.target.value;FA.page=0;vAusentismo()});
  let tq;$('#faQ').oninput=ev=>{clearTimeout(tq);tq=setTimeout(()=>{FA.q=ev.target.value;FA.page=0;vAusentismo();const i=$('#faQ');i.focus();i.setSelectionRange(i.value.length,i.value.length)},350)};
  AUS_C=C;let tt;$('#ausTQ').oninput=ev=>{clearTimeout(tt);tt=setTimeout(()=>{FA.tq=ev.target.value;FA.page=0;ausTabla(AUS_C)},250)};
  ausTabla(C);
}
let AUS_C=[];
function ausTabla(C0){
  const nq=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const q=nq(FA.tq).trim(),busca=!!q;
  let C=C0;if(busca){const W=q.split(/\s+/);C=C0.filter(({r})=>{const t=nq([r.trab,r.ced,r.cargo,r.area,r.causa,r.sub,r.det,r.fecha,pd(r.fecha)&&pd(r.fecha).toLocaleDateString('es-CO')].join(' '));return W.every(w=>t.includes(w))})}
  const cols_=[['fecha','Fecha'],['trab','Trabajador'],['cargo','Cargo'],['causa','Causa'],['sub','Subtipo / diagnóstico'],['dias','Días'],['cA','Asumido'],['cS','Asegurado'],['cT','Total']];
  const k=FA.sort,d=FA.dir,g=x=>['cA','cS','cT'].includes(k)?x.c[k]:k==='dias'?+x.r.dias:x.r[k]??'';
  C.sort((a,b)=>{const A=g(a),B=g(b);return (typeof A==='number'?A-B:String(A).localeCompare(String(B),'es'))*d});
  const tot=C.length;if(!busca)C=C.slice().sort((a,b)=>String(b.r.fecha).localeCompare(String(a.r.fecha))).slice(0,5).sort((a,b)=>{const A=g(a),B=g(b);return (typeof A==='number'?A-B:String(A).localeCompare(String(B),'es'))*d});
  const per=busca?25:5,pages=Math.max(1,Math.ceil(C.length/per));if(FA.page>=pages)FA.page=pages-1;
  $('#ausTot').textContent=busca?`${tot} resultado${tot===1?'':'s'} de ${C0.length}`:`Últimos ${Math.min(5,tot)} de ${tot} eventos`;
  $('#ausH').innerHTML=cols_.map(([c,l])=>`<th onclick="FA.dir=FA.sort==='${c}'?-FA.dir:1;FA.sort='${c}';vAusentismo()">${l}${FA.sort===c?(FA.dir>0?' ▲':' ▼'):''}</th>`).join('')+'<th class="ns"></th>';
  $('#ausB').innerHTML=C.slice(FA.page*per,(FA.page+1)*per).map(({r,c})=>`<tr><td>${pd(r.fecha).toLocaleDateString('es-CO')}</td>
    <td class="w"><b>${esc(r.trab)}</b><div class="note">${r.ced?'CC '+esc(r.ced):'Sin cédula'} · ${esc(r.area||'')}</div></td><td class="w">${esc(r.cargo||'')}</td>
    <td><span class="nt c-${r.causa==='Incapacidad'?'inc':/licencia|suspensi/i.test(r.causa)?'lic':/vacaci|familia|votaci/i.test(r.causa)?'per':'aus'}">${esc(r.causa)}</span></td>
    <td class="w"><div>${esc(r.sub||'')}</div>${r.det?`<div class="note obs" title="${esc(r.det)}">${esc(r.det.slice(0,55))}${r.det.length>55?'…':''}</div>`:''}</td>
    <td><b>${nf(+r.dias)}</b><div class="note">${nf(c.dA)} emp · ${nf(c.dS)} aseg</div></td><td>${cop(c.cA)}</td><td>${cop(c.cS)}</td><td><b>${cop(c.cT)}</b></td>
    <td><div class="acts"><button class="btn sm ic" title="Editar" onclick="ausForm('${r.id}')">✏️</button><button class="btn sm ic" title="Anular" onclick="ausAnular('${r.id}')">⊘</button></div></td></tr>`).join('')||`<tr><td colspan="10" class="empty">${busca?'No se encontraron eventos con esa búsqueda.':'No hay eventos con estos filtros.'}</td></tr>`;
  if(!busca){$('#ausP').innerHTML=tot>5?`<span class="note">Se muestran los 5 más recientes. Use el buscador para revisar cualquier evento.</span>`:'';return}
  $('#ausP').innerHTML=`<span>Página ${FA.page+1} de ${pages}</span><span style="display:flex;gap:6px"><button class="btn sm" ${FA.page?'':'disabled'} onclick="FA.page--;ausTabla(AUS_C)">‹ Anterior</button><button class="btn sm" ${FA.page<pages-1?'':'disabled'} onclick="FA.page++;ausTabla(AUS_C)">Siguiente ›</button></span>`;
}

/* --- gráficos propios del módulo --- */
function ausDonut(map,label,fmt,colors){
  const arr=Object.entries(map).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '<div class="empty">Sin datos</div>';
  const tot=arr.reduce((s,x)=>s+x[1],0),f=fmt||nf,P=colors||PAL;let a0=-Math.PI/2;
  const paths=arr.length===1?`<circle cx="70" cy="70" r="54" fill="none" stroke="${P[0]}" stroke-width="24"/>`:arr.map(([k,v],i)=>{const a1=a0+v/tot*Math.PI*2,lg=a1-a0>Math.PI?1:0,Pt=(r,a)=>`${70+r*Math.cos(a)} ${70+r*Math.sin(a)}`;
    const d=`M${Pt(66,a0)}A66 66 0 ${lg} 1 ${Pt(66,a1)}L${Pt(42,a1)}A42 42 0 ${lg} 0 ${Pt(42,a0)}Z`;a0=a1;return `<path d="${d}" fill="${P[i%P.length]}" stroke="#102530" stroke-width="2.5"><title>${esc(k)}: ${f(v)} (${Math.round(v/tot*100)}%)</title></path>`}).join('');
  return `<div class="pie"><svg viewBox="0 0 140 140">${paths}<text x="70" y="${label?68:75}" text-anchor="middle" class="big" style="font-size:${String(f(tot)).length>8?15:24}px">${f(tot)}</text>${label?`<text x="70" y="84" text-anchor="middle" class="sm">${label}</text>`:''}</svg>
    <div class="leg">${arr.map(([k,v],i)=>`<div><i style="background:${P[i%P.length]}"></i><span title="${esc(k)}">${esc(k)}</span><b>${f(v)}</b><em>${Math.round(v/tot*100)}%</em></div>`).join('')}</div></div>`;
}
function ausBars(map,color,mode){
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '<div class="empty">Sin datos</div>';const mx=Math.max(...arr.map(x=>x[1]));
  return arr.map(([k,v])=>`<div class="bar aus-bar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><div class="trk"><div class="fill" style="width:${v/mx*100}%;--c:${color}"></div></div><span class="n">${mode==='$'?copC(v):nf(v)}</span></div>`).join('');
}
function ausMeses(C){const ms=[...new Set(C.map(x=>x.r.fecha.slice(0,7)))].sort();if(!ms.length)return [];const out=[];let [y,m]=ms[0].split('-').map(Number);const [ey,em]=ms[ms.length-1].split('-').map(Number);while(y<ey||(y===ey&&m<=em)){out.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++}}return out}
function ausLineas(C){
  const anios=[...new Set(C.map(x=>x.r.fecha.slice(0,4)))].sort();if(!anios.length)return '<div class="empty">Sin datos</div>';
  const W=720,H=200,top=22,step=W/12,hoyM=iso(today()).slice(0,7),data=anios.map(a=>[...Array(12).keys()].map(i=>{const m=`${a}-${String(i+1).padStart(2,'0')}`;return m>hoyM?null:C.filter(x=>x.r.fecha.startsWith(m)).reduce((s,x)=>s+ +x.r.dias,0)}));
  const mx=Math.max(1,...data.flat().filter(v=>v!=null))*1.15,y=v=>top+H-v/mx*H,col=['#5F7884','#3CA0DC','#64B450','#F0A35A'];
  return `<svg class="ch" viewBox="0 0 ${W} ${H+44}">${[0,.25,.5,.75,1].map(f=>`<line x1="0" x2="${W}" y1="${top+H*f}" y2="${top+H*f}" class="grid"/>`).join('')}
   ${MESES.map((m,i)=>`<text x="${i*step+step/2}" y="${top+H+18}" text-anchor="middle" class="lab">${m.slice(0,3)}</text>`).join('')}
   ${data.map((d,j)=>{const c=col[(j+(anios.length===1?1:0))%col.length],last=j===data.length-1,nn=d.filter(v=>v!=null).length,pts=d.map((v,i)=>v==null?null:`${i*step+step/2},${y(v)}`).filter(Boolean).join(' ');
     return `${last?`<polygon points="${step/2},${top+H} ${pts} ${(nn-1)*step+step/2},${top+H}" fill="url(#gArea)"/>`:''}<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${last?3.5:2}" ${last?'filter="url(#glow)" class="draw"':'stroke-dasharray="5 5"'} stroke-linecap="round"/>
     ${d.map((v,i)=>v!=null&&v>0?`<circle cx="${i*step+step/2}" cy="${y(v)}" r="${last?4.5:3}" fill="#102530" stroke="${c}" stroke-width="2"><title>${MESES[i]} ${anios[j]}: ${nf(v)} días</title></circle>${last?`<text x="${i*step+step/2}" y="${y(v)-9}" text-anchor="middle" class="val">${nf(Math.round(v))}</text>`:''}`:'').join('')}`}).join('')}
  </svg><div class="stk-l" style="justify-content:center">${anios.map((a,j)=>`<span><i style="background:${col[(j+(anios.length===1?1:0))%col.length]}"></i>${a}</span>`).join('')}</div>`;
}
function ausStack(C){
  const ms=ausMeses(C);if(!ms.length)return '<div class="empty">Sin datos</div>';
  const d=ms.map(m=>{const L=C.filter(x=>x.r.fecha.startsWith(m));return {m,a:L.reduce((s,x)=>s+x.c.cA,0),s:L.reduce((s,x)=>s+x.c.cS,0)}});
  const W=Math.max(720,ms.length*44),H=190,top=24,step=W/ms.length,bw=Math.min(28,step*.6),mx=Math.max(1,...d.map(x=>x.a+x.s))*1.12,h=v=>v/mx*H;
  return `<div style="overflow-x:auto"><svg class="ch" viewBox="0 0 ${W} ${H+48}" style="min-width:${Math.min(W,1100)}px;max-height:270px">${[0,.5,1].map(f=>`<line x1="0" x2="${W}" y1="${top+H*f}" y2="${top+H*f}" class="grid"/>`).join('')}
   ${d.map((x,i)=>{const cx=i*step+step/2,ha=h(x.a),hs=h(x.s),yb=top+H;return `<rect x="${cx-bw/2}" y="${yb-ha}" width="${bw}" height="${ha}" fill="url(#gRet)" class="colr"><title>${MESES[+x.m.slice(5)-1]} ${x.m.slice(0,4)} · Empresa: ${cop(x.a)}</title></rect>
     <rect x="${cx-bw/2}" y="${yb-ha-hs}" width="${bw}" height="${hs}" rx="4" fill="url(#gIng)" class="colr"><title>${MESES[+x.m.slice(5)-1]} ${x.m.slice(0,4)} · EPS/ARL: ${cop(x.s)}</title></rect>
     ${x.a+x.s?`<text x="${cx}" y="${yb-ha-hs-6}" text-anchor="middle" class="val" style="font-size:10px">${copC(x.a+x.s).replace('$ ','')}</text>`:''}
     <text x="${cx}" y="${yb+16}" text-anchor="middle" class="lab">${MESES[+x.m.slice(5)-1].slice(0,3)}</text>${x.m.endsWith('-01')||i===0?`<text x="${cx}" y="${yb+30}" text-anchor="middle" class="lab" style="font-weight:700">${x.m.slice(0,4)}</text>`:''}`}).join('')}
  </svg></div><div class="stk-l" style="justify-content:center"><span><i style="background:#EF7070"></i>Asumido por la empresa</span><span><i style="background:#64B450"></i>Asegurado EPS/ARL</span></div>`;
}

/* SinCo (GH1): sin eventos de ausentismo de prueba. */
function ausDemo(){return []}
function ausCargarDemo(){}
function ausQuitarDemo(){}
/* --- registro / edición --- */
let AF=null;
function ausForm(id){
  const r=id?AUS.find(x=>x.id===id):null;
  AF=r?{...r}:{id:null,fuente:'Registro manual',fecha:iso(today()),trab:'',ced:'',cargo:'',area:'',tipoT:'',causa:'',sub:'',dias:'',det:'',sal:''};
  const ov=modalX('ovAus');ov.querySelector('h2').textContent=r?'Editar evento de ausentismo':'Registrar evento de ausentismo';drawAF();ov.classList.add('show');
}
function drawAF(er={}){
  const ov=$('#ovAus'),dl=(id,arr)=>`<datalist id="${id}">${arr.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
  const subs=[...new Set([...(AUS_SUB[AF.causa]||[]),...AUS.filter(r=>r.causa===AF.causa).map(r=>r.sub)])].filter(Boolean);
  const c=AF.fecha&&AF.causa&&AF.dias&&AF.sal?ausCalc(AF):null;
  const fld=(k,l,inp,w)=>`<div class="f ${er[k]?'bad':''}" ${w?'style="grid-column:1/-1"':''}><label>${l} <i>*</i></label>${inp}<div class="hint">${er[k]||''}</div></div>`;
  ov.querySelector('.mb').innerHTML=`<div class="fg" style="grid-template-columns:1fr 1fr">
    ${fld('trab','Trabajador',`<input id="afTrab" list="dlT" value="${esc(AF.trab)}" placeholder="Nombre completo">${dl('dlT',ausU('trab'))}`)}
    ${fld('ced','Cédula',`<input id="afCed" value="${esc(AF.ced)}" inputmode="numeric">`)}
    ${fld('cargo','Cargo',`<input id="afCargo" list="dlC" value="${esc(AF.cargo)}">${dl('dlC',ausU('cargo'))}`)}
    ${fld('area','Área',`<select id="afArea"><option value="">Seleccione…</option>${[...new Set(['Operativo','Administrativo',...ausU('area')])].map(x=>`<option ${x===AF.area?'selected':''}>${esc(x)}</option>`).join('')}</select>`)}
    ${fld('tipoT','Tipo de trabajador',`<select id="afTipo"><option value="">Seleccione…</option>${[...new Set(['Operativo','Administrativo',...ausU('tipoT')])].map(x=>`<option ${x===AF.tipoT?'selected':''}>${esc(x)}</option>`).join('')}</select>`)}
    ${fld('fecha','Fecha',`<input type="date" id="afFecha" value="${esc(AF.fecha)}">`)}
    ${fld('causa','Causa de ausentismo',`<select id="afCausa"><option value="">Seleccione…</option>${[...new Set([...AUS_CAUSAS,...ausU('causa')])].map(x=>`<option ${x===AF.causa?'selected':''}>${esc(x)}</option>`).join('')}</select>`)}
    ${fld('sub','Subtipo / diagnóstico',`<input id="afSub" list="dlS" value="${esc(AF.sub)}">${dl('dlS',subs)}`)}
    ${fld('dias','Días',`<input type="number" id="afDias" min="0.5" step="0.5" value="${esc(AF.dias)}">`)}
    ${fld('sal','Salario básico',`<input type="number" id="afSal" min="0" step="1000" value="${esc(AF.sal)}">`)}
    ${fld('fuente','Fuente',`<input id="afFuente" list="dlF" value="${esc(AF.fuente)}">${dl('dlF',[...new Set(['Registro manual',...ausU('fuente')])])}`)}
    ${fld('det','Detalle',`<textarea id="afDet" rows="2" placeholder="Diagnóstico, observación de nómina, fechas, etc.">${esc(AF.det)}</textarea>`,1)}
  </div>
  <div id="afCalc">${c?`<div class="vcalc">💰 Salario día <b>${cop(Math.round(c.salDia))}</b> · Empresa asume <b>${nf(c.dA)} días</b> al ${Math.round(c.pA*100)}% = <b>${cop(c.cA)}</b> · EPS/ARL <b>${nf(c.dS)} días</b> al ${Math.round(c.pS*100)}% = <b>${cop(c.cS)}</b> · Total <b>${cop(c.cT)}</b></div>`:''}</div>`;
  ov.querySelector('.mf').innerHTML=`<span class="note"><i style="color:var(--red);font-style:normal">*</i> Todos los campos son obligatorios</span><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovAus')">Cancelar</button><button class="btn pri" onclick="ausGuardar()">Guardar</button></div>`;
  // días, salario y fecha solo actualizan el cálculo (sin redibujar, para no perder lo que se escribe)
  ['#afDias','#afSal','#afFecha'].forEach(s=>{$(s).oninput=$(s).onchange=()=>{syncAF();if(s==='#afFecha'&&!AF.sal&&AF.fecha){AF.sal=AUSCFG.salAnual[+AF.fecha.slice(0,4)]||'';$('#afSal').value=AF.sal}const c=AF.fecha&&AF.causa&&+AF.dias&&+AF.sal?ausCalc(AF):null;
    $('#afCalc').innerHTML=c?`<div class="vcalc">💰 Salario día <b>${cop(Math.round(c.salDia))}</b> · Empresa asume <b>${nf(c.dA)} días</b> al ${Math.round(c.pA*100)}% = <b>${cop(c.cA)}</b> · EPS/ARL <b>${nf(c.dS)} días</b> al ${Math.round(c.pS*100)}% = <b>${cop(c.cS)}</b> · Total <b>${cop(c.cT)}</b></div>`:''}});
  ['#afTrab','#afCausa'].forEach(s=>{$(s).onchange=()=>{const foco=document.activeElement&&document.activeElement.id;syncAF();
    if(s==='#afTrab'){const p=AUS.filter(r=>r.trab.toLowerCase()===AF.trab.toLowerCase()).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];if(p){['ced','cargo','area','tipoT'].forEach(k=>{if(!AF[k]&&p[k])AF[k]=p[k]});if(!AF.sal)AF.sal=p.sal}}
    if((s==='#afFecha'||s==='#afTrab')&&!AF.sal&&AF.fecha)AF.sal=AUSCFG.salAnual[+AF.fecha.slice(0,4)]||'';
    if(s==='#afCausa'&&(AUS_SUB[AF.causa]||[]).length===1)AF.sub=AUS_SUB[AF.causa][0];
    drawAF();if(foco&&$('#'+foco))$('#'+foco).focus()}});
}
function syncAF(){const g=s=>$(s)?$(s).value.trim():'';Object.assign(AF,{trab:g('#afTrab'),ced:g('#afCed'),cargo:g('#afCargo'),area:g('#afArea'),tipoT:g('#afTipo'),fecha:g('#afFecha'),causa:g('#afCausa'),sub:g('#afSub'),dias:g('#afDias'),sal:g('#afSal'),fuente:g('#afFuente'),det:g('#afDet')})}
function ausGuardar(){
  syncAF();const er={};['trab','ced','cargo','area','tipoT','fecha','causa','sub','fuente','det'].forEach(k=>{if(!AF[k])er[k]='Campo obligatorio'});
  if(!(+AF.dias>0))er.dias='Indique los días';if(!(+AF.sal>0))er.sal='Indique el salario básico';
  if(Object.keys(er).length){drawAF(er);toast('Revise los campos marcados');return}
  const rec={...AF,dias:+AF.dias,sal:+AF.sal};
  if(!rec.id&&AUS.some(r=>!r.anulado&&ausKey(r)===ausKey(rec))){toast('Ya existe un evento igual');return}
  if(rec.id){const i=AUS.findIndex(x=>x.id===rec.id);AUS[i]={...AUS[i],...rec}}else{rec.id=uid();rec.num=Math.max(0,...AUS.map(r=>+r.num||0))+1;rec.cargado=new Date().toISOString();AUS.push(rec)}
  saveAus();closeOv('ovAus');vAusentismo();toast(AF.id?'Evento actualizado':'Evento registrado');
}
function ausAnular(id){
  const r=AUS.find(x=>x.id===id);
  confirmBox('Anular evento',`<p>¿Anular el evento de <b>${esc(r.trab)}</b> del ${fmtD(r.fecha)} (${esc(r.causa)}, ${nf(r.dias)} días)? Dejará de contar en los indicadores y gráficos.</p><div class="f"><label>Motivo <i>*</i></label><input id="anA" placeholder="Ej. Registro duplicado"></div>`,'Anular',()=>{
    const m=$('#anA').value.trim();if(!m){toast('El motivo es obligatorio');return}r.anulado=true;r.motivoAnula=m;saveAus();vAusentismo();toast('Evento anulado')});
}

/* --- parámetros del cálculo --- */
function ausParam(){
  const ov=modalX('ovAusP');ov.querySelector('h2').textContent='Parámetros del cálculo de costos';
  const P=AUSCFG,anios=Object.keys(P.salAnual).sort();
  ov.querySelector('.mb').innerHTML=`<p class="note" style="margin-top:0">Estos valores replican las reglas del archivo original. Al cambiarlos, se recalculan todos los costos.</p>
   <div class="fg" style="grid-template-columns:1fr 1fr">
    <div class="f"><label>Días base para el salario día</label><input type="number" id="pDiv" value="${P.div}" min="1"><div class="hint">Salario día = salario básico ÷ este valor</div></div>
    <div class="f"><label>Días de incapacidad que asume la empresa</label><input type="number" id="pDE" value="${P.diasEmp}" min="0"><div class="hint">Primeros días de enfermedad general</div></div>
    <div class="f"><label>% que paga la empresa en incapacidad</label><input type="number" id="pEI" value="${P.pEmpInc}" step="0.01"></div>
    <div class="f"><label>% que reconoce la EPS (enfermedad general)</label><input type="number" id="pEPS" value="${P.pEPS}" step="0.01"></div>
    <div class="f"><label>% que reconoce ARL / licencias de maternidad y paternidad</label><input type="number" id="pARL" value="${P.pARL}" step="0.01"></div>
    <div class="f"><label>% que asume la empresa en otras causas</label><input type="number" id="pOT" value="${P.pOtras}" step="0.01"><div class="hint">Vacaciones, día de la familia, votaciones, licencias remuneradas</div></div>
   </div>
   <div class="det-sec"><small>Salario base por año (se usa cuando el evento no trae salario)</small><div id="pSal" class="fg" style="grid-template-columns:repeat(3,1fr)">${anios.map(a=>`<div class="f"><label>${a}</label><input type="number" data-a="${a}" value="${P.salAnual[a]}"></div>`).join('')}<div class="f"><label>Agregar año</label><input type="number" id="pNA" placeholder="${+anios[anios.length-1]+1}"></div></div></div>
   <div class="note" style="margin-top:10px">Licencia no remunerada y suspensión de contrato no generan costo. Accidente de trabajo y enfermedad laboral los paga la ARL desde el primer día.</div>`;
  ov.querySelector('.mf').innerHTML=`<button class="btn" onclick="AUSCFG=Object.assign(AUSCFG,{div:30,diasEmp:2,pEmpInc:66.67,pEPS:66.67,pARL:100,pOtras:100});saveAus();ausParam();toast('Valores restablecidos')">Restablecer</button><div style="display:flex;gap:8px"><button class="btn" onclick="closeOv('ovAusP')">Cancelar</button><button class="btn pri" onclick="ausParamG()">Guardar</button></div>`;
  ov.classList.add('show');
}
function ausParamG(){
  const g=id=>+$(id).value,v={div:g('#pDiv'),diasEmp:g('#pDE'),pEmpInc:g('#pEI'),pEPS:g('#pEPS'),pARL:g('#pARL'),pOtras:g('#pOT')};
  if(!(v.div>0)||[v.diasEmp,v.pEmpInc,v.pEPS,v.pARL,v.pOtras].some(x=>!(x>=0))){toast('Revise los valores: todos son obligatorios');return}
  const sa={};document.querySelectorAll('#pSal [data-a]').forEach(i=>{if(+i.value>0)sa[i.dataset.a]=+i.value});const na=$('#pNA').value;
  if(na){const y=+na;if(y<2000||y>2100){toast('Año no válido');return}sa[y]=sa[y]||AUSCFG.salAnual[Math.max(...Object.keys(sa).map(Number))]||0}
  Object.assign(AUSCFG,v,{salAnual:sa});saveAus();closeOv('ovAusP');vAusentismo();toast('Parámetros guardados');
}
function ausExport(){
  const R=ausFilt();if(!R.length){toast('No hay eventos para exportar');return}
  const rows=R.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)).map((r,i)=>{const c=ausCalc(r);return [i+1,r.fuente,c.anio,c.mes,pd(r.fecha),r.trab,r.ced&&/^\d+$/.test(r.ced)?+r.ced:r.ced,r.cargo,r.area,r.tipoT,r.causa,r.sub,+r.dias,r.det,+r.sal,Math.round(c.salDia*100)/100,c.dA,c.dS,Math.round(c.pA*10000)/10000,Math.round(c.pS*10000)/10000,c.cA,c.cS,c.cT]});
  const ws=sheetSimple(AUS_H,rows);
  ['O','P','U','V','W'].forEach(col=>{for(let i=2;i<=rows.length+1;i++){const c=ws[col+i];if(c&&c.t==='n')c.z='"$"#,##0'}});
  ['S','T'].forEach(col=>{for(let i=2;i<=rows.length+1;i++){const c=ws[col+i];if(c&&c.t==='n')c.z='0%'}});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Base ausentismo');XLSX.writeFile(wb,`Costos_Ausentismo_${stamp()}.xlsx`);
}

/* ===================== CUMPLEAÑOS ===================== */
let MES=new Date().getMonth();
function vCumple(){
  const t=today();
  const l=activos().filter(e=>pd(e.fNac)&&pd(e.fNac).getMonth()===MES).sort((a,b)=>pd(a.fNac).getDate()-pd(b.fNac).getDate());
  $('#main').innerHTML=`<div class="top"><div><h1>Cumpleaños</h1><div class="sub">${l.length} empleado(s) activo(s) cumplen años en ${MESES[MES].toLowerCase()}</div></div>
  <div style="display:flex;gap:8px"><select class="btn" onchange="MES=+this.value;vCumple()">${MESES.map((m,i)=>`<option value="${i}" ${i===MES?'selected':''}>${m}</option>`).join('')}</select><button class="btn" onclick="window.print()">🖨 Imprimir</button></div></div>
  <div class="card">${l.map(e=>{const d=pd(e.fNac);const hoy=d.getDate()===t.getDate()&&MES===t.getMonth();
    return `<div class="list-item ${hoy?'today':''}"><div class="day">${d.getDate()}</div><div class="av">${ini(e.nombre)}</div><div class="meta"><b>${esc(e.nombre)}${hoy?' 🎉 ¡Hoy!':''} ${opTag(e)}</b><span>${esc(e.cargo||'')} · ${esc(e.sede||'')}</span></div><span class="note">Cumple ${t.getFullYear()-d.getFullYear()} años</span></div>`}).join('')||'<div class="empty">Nadie cumple años este mes.</div>'}</div>`;
}

/* ===================== ALERTAS ===================== */
function alertas(){
  const t=today(),A=activos();
  const prueba=A.filter(e=>{const f=pd(e.fFinPrueba);return f&&f>=t&&days(t,f)<=CFG.dias}).sort((a,b)=>pd(a.fFinPrueba)-pd(b.fFinPrueba));
  const incompletos=A.map(e=>({e,m:CFG.clave.filter(k=>!String(e[k]??'').trim())})).filter(x=>x.m.length).sort((a,b)=>b.m.length-a.m.length);
  const cumpleHoy=A.filter(e=>{const d=pd(e.fNac);return d&&d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()});
  const va=vacAlertas();
  return {prueba,incompletos,cumpleHoy,vacSinProg:va.sinProg,vacAcum:va.acumulan};
}
function vAlertas(){
  const {prueba,incompletos,cumpleHoy,vacSinProg,vacAcum}=alertas(),t=today();
  $('#main').innerHTML=`<div class="top"><div><h1>Alertas</h1><div class="sub">Seguimiento de vencimientos y calidad de la información</div></div></div>
  <div class="grid2">
   <div class="card"><h3>⏳ Periodos de prueba que vencen en ${CFG.dias} días o menos (${prueba.length})</h3>
    ${prueba.map(e=>{const d=days(t,pd(e.fFinPrueba));return `<div class="list-item"><div class="av" style="background:var(--warn)">${ini(e.nombre)}</div><div class="meta"><b>${esc(e.nombre)} ${opTag(e)}</b><span>${esc(e.cargo)} · ${esc(e.sede)} · vence ${fmtD(e.fFinPrueba)}</span></div><span class="pill p">${d===0?'Hoy':d===1?'Mañana':'En '+d+' días'}</span></div>`}).join('')||'<div class="empty">No hay periodos de prueba próximos a vencer.</div>'}</div>
   <div class="card"><h3>🎂 Cumpleaños de hoy (${cumpleHoy.length})</h3>
    ${cumpleHoy.map(e=>`<div class="list-item"><div class="av" style="background:var(--green)">${ini(e.nombre)}</div><div class="meta"><b>${esc(e.nombre)} ${opTag(e)}</b><span>Cumple ${edad(e.fNac)} años · ${esc(e.cargo)} · ${esc(e.sede||'')}</span></div></div>`).join('')||'<div class="empty">Nadie cumple años hoy.</div>'}</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🏖 Vacaciones pendientes sin programar (${vacSinProg.length})</h3>
   ${vacSinProg.length?`<div class="tbl-wrap" style="border:0"><table><thead><tr><th class="ns">Empleado</th><th class="ns">Días pendientes</th><th class="ns">Periodos</th><th class="ns"></th></tr></thead><tbody>
   ${vacSinProg.map(x=>`<tr><td><b>${esc(x.e.nombre)}</b> ${opTag(x.e)}<br><span class="note">${esc(x.e.cargo||'')} · ingresó el ${fmtD(x.e.fInicio)}</span></td><td><b class="saldo ${x.v.pend.length>=2?'alto':'pos'}">${x.v.saldo} días</b></td><td>${x.v.pend.length>=2?`<span class="pill r">Acumula ${x.v.pend.length} periodos</span>`:'<span class="pill p">1 periodo</span>'}</td><td><button class="btn sm pri" onclick="progVac('${x.e.id}')">📅 Programar</button></td></tr>`).join('')}
   </tbody></table></div>`:'<div class="empty">✓ Todos los empleados con vacaciones pendientes tienen fecha programada.</div>'}</div>
  <div class="card" style="margin-top:14px"><h3>📝 Fichas incompletas (${incompletos.length})</h3>
   ${incompletos.length?`<div class="tbl-wrap" style="border:0"><table><thead><tr><th class="ns">Empleado</th><th class="ns">Faltan</th><th class="ns">Campos pendientes</th><th class="ns"></th></tr></thead><tbody>
   ${incompletos.map(({e,m})=>`<tr><td><b>${esc(e.nombre||'(sin nombre)')}</b> ${opTag(e)}<br><span class="note">${esc(e.cargo||'')} · ${esc(e.sede||'')}</span></td><td>${m.length}</td><td style="white-space:normal">${m.map(k=>`<button class="pchip" title="Abrir este campo" onclick="openEmp('${e.id}',true,'${k}')">${esc(FK[k][1].trim())}</button>`).join('')}</td><td><button class="btn sm pri" onclick="openEmp('${e.id}',true)">Completar</button></td></tr>`).join('')}
   </tbody></table></div>`:'<div class="empty">Todas las fichas activas tienen la información clave completa.</div>'}</div>`;
}


/* ===================== ADMINISTRATIVO (catálogos y parámetros) ===================== */
const CATS=[
 {k:'sede',t:'Sedes',ico:'🏢',campo:'sede',d:'Lugares físicos donde trabaja el personal.'},
 {k:'centro',t:'Operaciones',ico:'🎧',campo:'centro',d:'Campañas o centros de trabajo (columna CENTRO DE TRABAJO).'},
 {k:'cargo',t:'Cargos',ico:'💼',campo:'cargo',sal:true,d:'Puestos de trabajo. El salario base es obligatorio y se asigna al crear un empleado.'},
 {k:'contrato',t:'Tipos de contrato',ico:'📄',campo:'tipoContrato'},
 {k:'arl',t:'ARL',ico:'🦺',campo:'arl'},
 {k:'eps',t:'EPS',ico:'🏥',campo:'eps'},
 {k:'pension',t:'Fondos de pensión',ico:'🏦',campo:'pension'},
 {k:'cesantias',t:'Fondos de cesantías',ico:'💰',campo:'cesantias'},
 {k:'ccf',t:'Cajas de compensación',ico:'🤝',campo:'ccf'},
 {k:'carnet',t:'Estados de carnet',ico:'🪪',campo:'carnet'},
 {k:'talla',t:'Tallas de dotación',ico:'👕',campo:'talla'},
 {k:'parentesco',t:'Parentescos',ico:'👪',campo:'parentesco'},
 {k:'novedad',t:'Tipos de novedad',ico:'🏥',campo:'_nov',d:'Incapacidades, licencias, permisos y ausencias. El nombre define la categoría: incluya “Incapacidad”, “Licencia”, “Permiso” o “Ausencia”.'},
 {k:'motivo',t:'Motivos de retiro',ico:'🚪',campo:'motivoRetiro',d:'Opciones al registrar el retiro de un empleado.'}
];
const CK=Object.fromEntries(CATS.map(c=>[c.k,c]));
const CFG_KEY=KEY+'_cfg';
let CFG={cat:{},dias:15,diasVac:30,meses:2,clave:[...CLAVE]};
function loadCfg(){
  try{const c=JSON.parse(GH_STORE.getItem(CFG_KEY)||'null');if(c)CFG=Object.assign(CFG,c)}catch(e){}
  CATS.forEach(c=>{if(!Array.isArray(CFG.cat[c.k]))CFG.cat[c.k]=(L[c.k]||[]).map(n=>({n}))});
  // migración: volver al nombre "Licencia de luto"
  const LARGO='Licencia por luto (fallecimiento de un familiar)',old=CFG.cat.novedad.find(x=>x.n===LARGO);if(old){if(CFG.cat.novedad.some(x=>x.n===LUTO))CFG.cat.novedad=CFG.cat.novedad.filter(x=>x!==old);else old.n=LUTO}
  if(NOV.some(n=>n.tipo===LARGO)){NOV.forEach(n=>{if(n.tipo===LARGO)n.tipo=LUTO});saveVN()}
  syncCat();
}
function saveCfg(){try{GH_STORE.setItem(CFG_KEY,JSON.stringify(CFG))}catch(e){toast('No se pudo guardar la configuración')}}
function catList(k){return CFG.cat[k].map(x=>x.n)}
function syncCat(){ // agrega a los catálogos los valores que ya usan los empleados
  CATS.forEach(c=>{const have=new Set(catList(c.k));uniq(c.campo).forEach(v=>{if(!have.has(v)){CFG.cat[c.k].push({n:v});have.add(v)}})});
  saveCfg();
}
const usos=(c,n)=>c==='novedad'?NOV.filter(x=>x.tipo===n).length:DB.filter(e=>e[CK[c].campo]===n).length;
let ACAT='sede',ASUB='listas';
const SUBS=[['listas','📋 Listas','Valores que aparecen en los formularios'],['param','⏱ Parámetros','Reglas de alertas y fechas'],['ficha','✅ Ficha completa','Campos obligatorios de cada empleado']];
function vAdmin(){
  $('#main').innerHTML=`<div class="top"><div><h1>Administrativo</h1><div class="sub">Listas y parámetros que usa toda la plataforma</div></div></div>
  <div class="seg">${SUBS.map(([k,l,d])=>`<button class="${k===ASUB?'on':''}" onclick="ASUB='${k}';vAdmin()"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
  <div id="admBody">${({listas:admListas,param:admParam,ficha:admFicha})[ASUB]()}</div>`;
  if(ASUB==='listas')setTimeout(()=>{const i=$('#newItem');if(i)i.focus()},50);
}
function admListas(){
  const c=CK[ACAT],items=CFG.cat[ACAT];
  const grp=[['Organización',['sede','centro','cargo','contrato']],['Seguridad social',['arl','eps','pension','cesantias','ccf']],['Novedades',['novedad','motivo']],['Otros',['carnet','talla','parentesco']]];
  return `<div class="adm">
    <div class="card adm-nav">${grp.map(([g,ks])=>`<div class="adm-g">${g}</div>`+ks.map(k=>{const x=CK[k];return `<button class="${x.k===ACAT?'on':''}" onclick="ACAT='${x.k}';vAdmin()"><span>${x.ico}</span>${x.t}<em>${CFG.cat[x.k].length}</em></button>`}).join('')).join('')}</div>
    <div class="card adm-ed">
      <div class="adm-head"><div><h3>${c.ico} ${c.t}</h3>${c.d?`<p class="note">${c.d}</p>`:''}</div><span class="adm-tot">${items.length} valor${items.length===1?'':'es'}</span></div>
      <div class="adm-add"><input id="newItem" placeholder="Nuevo valor para ${c.t.toLowerCase()}…" onkeydown="if(event.key==='Enter')addItem()">${c.sal?`<input id="newSal" class="sal" type="number" min="0" step="1000" placeholder="Salario base *" onkeydown="if(event.key==='Enter')addItem()">`:''}<button class="btn pri" onclick="addItem()">＋ Agregar</button></div>
      <div class="adm-cols ${c.sal?'s':''}"><span>Nombre</span>${c.sal?'<span>Salario base</span>':''}<span>En uso</span><span>Acciones</span></div>
      <div class="adm-list">${items.length?items.map((x,i)=>{const u=usos(ACAT,x.n);return `<div class="adm-row ${c.sal?'s':''}">
        <span class="adm-n">${esc(x.n)}</span>
        ${c.sal?`<span><input class="adm-salin" type="number" min="0" step="1000" value="${x.sal||''}" placeholder="Obligatorio" onchange="setSal(${i},this.value)"></span>`:''}
        <span><span class="adm-u ${u?'':'z'}">${u} empleado${u===1?'':'s'}</span></span>
        <span class="acts"><button class="btn sm ic" title="Subir" ${i?'':'disabled'} onclick="moveItem(${i},-1)">▲</button><button class="btn sm ic" title="Bajar" ${i<items.length-1?'':'disabled'} onclick="moveItem(${i},1)">▼</button><button class="btn sm ic" title="Renombrar" onclick="renItem(${i})">✏️</button><button class="btn sm ic" title="Eliminar" onclick="delItem(${i})">🗑</button></span></div>`}).join(''):'<div class="empty">Aún no hay valores. Agregue el primero.</div>'}</div>
      <p class="note adm-foot">💡 Al renombrar un valor se actualiza en todas las fichas que lo usan. El orden de la lista es el orden en que aparece en los formularios.</p>
    </div>
  </div>`;
}
function admParam(){
  return `<div class="pgrid">
    <div class="card pcard"><div class="pico" style="--kc:var(--orange)">⏳</div><div class="pbody"><h3>Alerta de periodo de prueba</h3>
      <p class="note">Los empleados cuyo periodo de prueba vence dentro de este plazo aparecen en <b>Alertas</b> y en el panel.</p>
      <div class="pin"><input type="number" min="1" max="90" value="${CFG.dias}" onchange="setParam('dias',this.value,1,90)"><span>días o menos para vencer</span></div></div></div>
    <div class="card pcard"><div class="pico" style="--kc:var(--blue)">📅</div><div class="pbody"><h3>Duración sugerida del periodo de prueba</h3>
      <p class="note">Al registrar la fecha de inicio del contrato, la fecha fin del periodo de prueba se sugiere con este plazo. Siempre se puede cambiar en la ficha.</p>
      <div class="pin"><input type="number" min="1" max="12" value="${CFG.meses}" onchange="setParam('meses',this.value,1,12)"><span>mes(es) desde el inicio</span></div></div></div>
    <div class="card pcard"><div class="pico" style="--kc:var(--green)">🏖</div><div class="pbody"><h3>Aviso de vacaciones próximas</h3>
      <p class="note">En <b>Vacaciones</b> se muestran las salidas programadas y los empleados que cumplen periodo dentro de este plazo.</p>
      <div class="pin"><input type="number" min="1" max="120" value="${CFG.diasVac}" onchange="setParam('diasVac',this.value,1,120)"><span>días hacia adelante</span></div></div></div>
  </div>`;
}
function admFicha(){
  const n=CFG.clave.length;
  return `<div class="card"><div class="adm-head"><div><h3>Campos que debe tener una ficha completa</h3><p class="note">Si a un empleado activo le falta alguno de los campos marcados, aparece en <b>Alertas → Fichas incompletas</b>.</p></div>
    <span style="display:flex;gap:8px;align-items:center"><span class="adm-tot">${n} campos marcados</span><button class="btn sm" onclick="CFG.clave=[...CLAVE];saveCfg();vAdmin();render0()">Restablecer</button></span></div>
    <div class="fgrp">${Object.entries(TABS).map(([tk,tl])=>{const fs=F.filter(f=>f[3]===tk&&f[2]!=='calc');const on=fs.filter(f=>CFG.clave.includes(f[0])).length;
      return `<div class="fgbox"><div class="fgh"><b>${tl}</b><span>${on}/${fs.length}</span><button class="lnk" onclick="setGrupo('${tk}',${on<fs.length})">${on<fs.length?'Marcar todos':'Desmarcar todos'}</button></div>
      ${fs.map(f=>`<label class="chk"><input type="checkbox" ${CFG.clave.includes(f[0])?'checked':''} onchange="setClave('${f[0]}',this.checked)"><span>${esc(f[1].trim())}${f[5]?' <i class="req">obligatorio al guardar</i>':''}</span></label>`).join('')}</div>`}).join('')}</div></div>`;
}
function setGrupo(tk,on){F.filter(f=>f[3]===tk&&f[2]!=='calc').forEach(f=>{CFG.clave=on?[...new Set([...CFG.clave,f[0]])]:CFG.clave.filter(x=>x!==f[0])});CFG.clave=F.map(f=>f[0]).filter(x=>CFG.clave.includes(x));saveCfg();vAdmin();render0()}
function render0(){const a=alertas();const n=a.prueba.length+a.incompletos.length+a.vacSinProg.length;const bd=$('#nAlert');bd.hidden=!n;bd.textContent=n;
  const v=a.vacSinProg.length,bv=$('#nVac');bv.hidden=!v;bv.textContent=v;const h=NOV.filter(x=>novActiva(x,iso(today()))&&emp(x.empId)&&emp(x.empId).estado!=='Retirado').length,bn=$('#nNov');bn.hidden=!h;bn.textContent=h}
function addItem(){
  const n=$('#newItem').value.trim().replace(/\s+/g,' ');if(!n){toast('Escriba un valor');return}
  if(catList(ACAT).some(x=>x.toLowerCase()===n.toLowerCase())){toast('Ese valor ya existe en la lista');return}
  const o={n};const sv=$('#newSal');if(sv){if(!(+sv.value>0)){toast('Escriba el salario base del cargo');sv.focus();return}o.sal=+sv.value}
  CFG.cat[ACAT].push(o);saveCfg();vAdmin();toast(`“${n}” agregado`);
}
function moveItem(i,d){const a=CFG.cat[ACAT];[a[i],a[i+d]]=[a[i+d],a[i]];saveCfg();vAdmin()}
function setSal(i,v){if(!(+v>0)){toast('El salario base es obligatorio');vAdmin();return}CFG.cat[ACAT][i].sal=+v;saveCfg();toast('Salario base actualizado')}
function setParam(k,v,mn,mx){v=Math.round(+v);if(!(v>=mn&&v<=mx)){toast(`Ingrese un valor entre ${mn} y ${mx}`);vAdmin();return}CFG[k]=v;saveCfg();render0();toast('Parámetro guardado')}
function setClave(k,on){CFG.clave=on?[...new Set([...CFG.clave,k])]:CFG.clave.filter(x=>x!==k);CFG.clave=F.map(f=>f[0]).filter(x=>CFG.clave.includes(x));saveCfg();vAdmin();render0()}
function renItem(i){
  const it=CFG.cat[ACAT][i],u=usos(ACAT,it.n),campo=CK[ACAT].campo;
  confirmBox('Renombrar',`<div class="f"><label>Nuevo nombre</label><input id="renV" value="${esc(it.n)}"></div>${u?`<p class="note">Se actualizará en <b>${u}</b> ficha(s) de empleados.</p>`:''}`,'Guardar',()=>{
    const n=$('#renV').value.trim().replace(/\s+/g,' ');if(!n){toast('El nombre es obligatorio');return}if(n===it.n)return;
    const j=CFG.cat[ACAT].findIndex((x,k)=>k!==i&&x.n.toLowerCase()===n.toLowerCase());
    if(ACAT==='novedad'){NOV.forEach(x=>{if(x.tipo===it.n)x.tipo=j>=0?CFG.cat[ACAT][j].n:n});saveVN()}
    DB.forEach(e=>{if(e[campo]===it.n)e[campo]=j>=0?CFG.cat[ACAT][j].n:n});
    if(j>=0){CFG.cat[ACAT].splice(i,1);toast(`Se unificó con “${n}”`)}else{it.n=n;toast('Nombre actualizado')}
    persist();saveCfg();vAdmin();render0();
  });
  setTimeout(()=>{const x=$('#renV');x.focus();x.select()},50);
}
function delItem(i){
  const it=CFG.cat[ACAT][i],u=usos(ACAT,it.n),campo=CK[ACAT].campo,otros=CFG.cat[ACAT].filter((_,k)=>k!==i);
  if(u&&!otros.length){toast('No se puede eliminar: es el único valor y está en uso');return}
  if(!u){confirmBox('Eliminar',`<p>¿Eliminar <b>${esc(it.n)}</b> de la lista de ${CK[ACAT].t.toLowerCase()}?</p>`,'Eliminar',()=>{CFG.cat[ACAT].splice(i,1);saveCfg();vAdmin();toast('Valor eliminado')});return}
  confirmBox('Eliminar valor en uso',`<p><b>${esc(it.n)}</b> está asignado a <b>${u}</b> empleado(s). Para eliminarlo, elija a qué valor pasarlos:</p>
   <div class="f"><label>Reasignar a</label><select id="reasig">${otros.map(x=>`<option>${esc(x.n)}</option>`).join('')}</select></div>`,'Reasignar y eliminar',()=>{
    const to=$('#reasig').value;if(!to){toast('Debe elegir a qué valor reasignar');return}if(ACAT==='novedad'){NOV.forEach(x=>{if(x.tipo===it.n)x.tipo=to});saveVN()}DB.forEach(e=>{if(e[campo]===it.n)e[campo]=to});CFG.cat[ACAT].splice(i,1);persist();saveCfg();vAdmin();render0();toast(`Eliminado. ${u} ficha(s) actualizada(s)`)});
}
/* ===================== IMPORTAR / EXPORTAR ===================== */
function vDatos(){
  const A=activos(),last=(()=>{try{return GH_STORE.getItem(KEY+'_lastcopy')}catch(e){return null}})();
  const dd=last?days(pd(last.slice(0,10)),today()):null;
  $('#main').innerHTML=`<div class="top"><div><h1>Copias de seguridad</h1><div class="sub">Descargue la información de Gestión Humana en Excel para guardar copias</div></div></div>
  <div class="cp-hero card">
    <div class="cp-ico">📊</div>
    <div class="cp-txt"><h3>Copia completa en Excel</h3>
      <p class="note">Un solo archivo con toda la información, listo para guardar en el equipo o en la carpeta compartida.</p>
      <div class="cp-sheets"><span><b>Todos</b> ${DB.length} registros</span><span><b>Activos</b> ${A.length}</span><span><b>Retirados</b> ${DB.length-A.length}</span><span><b>Resumen</b> por sede, operación y cargo</span><span><b>Vacaciones</b> ${VAC.length}</span><span><b>Novedades</b> ${NOV.length}</span><span><b>Listas</b> de Administrativo</span></div>
      <p class="cp-last ${dd===null||dd>7?'warn':''}">${last?`Última copia descargada: <b>${new Date(last).toLocaleString('es-CO',{dateStyle:'long',timeStyle:'short'})}</b>${dd>7?` · hace ${dd} días, se recomienda descargar una nueva`:''}`:'Aún no se ha descargado ninguna copia desde este navegador.'}</p>
    </div>
    <button class="btn ok big" onclick="copiaCompleta()">⬇ Descargar copia completa</button>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div class="card"><h3>Descargas rápidas</h3>
      <div class="cp-list">
        <button class="cp-it" onclick="exportSel('activos')"><span>👥</span><div><b>Solo empleados activos</b><em>${A.length} registros · mismo formato de la plantilla</em></div><i>⬇</i></button>
        <button class="cp-it" onclick="exportSel('retirados')"><span>🚪</span><div><b>Solo empleados retirados</b><em>${DB.length-A.length} registros · con fecha de retiro</em></div><i>⬇</i></button>
        <button class="cp-it" onclick="go('empleados')"><span>🔎</span><div><b>Una selección filtrada</b><em>En Empleados, filtre y use <b>Exportar vista</b></em></div><i>→</i></button>
      </div></div>
    <div class="card"><h3>Mantenimiento</h3>
      <p class="note" style="margin-top:-6px">La información se guarda en este navegador. El respaldo del sistema permite recuperarla en otro equipo o si se borra el historial.</p>
      <div class="cp-list">
        <button class="cp-it" onclick="backup()"><span>💾</span><div><b>Respaldo del sistema (.json)</b><em>Incluye empleados, vacaciones, novedades, ausentismo, configuración y todos los soportes adjuntos</em></div><i>⬇</i></button>
        <label class="cp-it"><span>♻</span><div><b>Restaurar un respaldo</b><em>Recupera los empleados del archivo sin borrar los que ya existen</em></div><i>↑</i><input type="file" accept=".json" hidden onchange="restore(this.files[0])"></label>
      </div>
      ${DB.some(isDemo)?`<div class="cp-danger"><div><b>Empleados de ejemplo</b><em>Hay ${DB.filter(isDemo).length} empleados ficticios de prueba. Quítelos antes de registrar la información real.</em></div>
        <span><button class="btn dan sm" onclick="quitarDemo()">Quitar empleados de ejemplo</button></span></div>`:''}
      <p class="note" style="margin-top:14px">🔒 Los empleados no se pueden eliminar. Si alguien deja la empresa, use <b>Registrar retiro</b> en su ficha para conservar el historial.</p>
    </div>
  </div>`;
}
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const HMAP=Object.fromEntries(F.map(f=>[norm(f[1]),f[0]]));
Object.assign(HMAP,{[norm('CENTRO DE TRABAJO')]:'centro',[norm('NUMERO DE CTA')]:'cuenta',[norm('NO HIJOS')]:'hijos',[norm('NUMERO DE CONTACTO')]:'contactoTel',[norm('FONDO PENSION')]:'pension',[norm('FONDO CESANTIAS')]:'cesantias'});
function toISO(v){
  if(v==null||v==='')return '';
  if(v instanceof Date&&!isNaN(v))return iso(new Date(v.getFullYear(),v.getMonth(),v.getDate()));
  if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?iso(new Date(d.y,d.m-1,d.d)):''}
  const s=String(v).trim();let m;
  if(m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))return iso(new Date(+m[1],m[2]-1,+m[3]));
  if(m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)){let y=+m[3];if(y<100)y+=y>40?1900:2000;return iso(new Date(y,m[2]-1,+m[1]))}
  return '';
}
function importX(file){
  if(typeof XLSX==='undefined'){toast('No se cargó la librería de Excel (requiere internet la primera vez).');return}
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
      const hi=rows.findIndex(r=>r.some(c=>norm(c)==='NOMBRESYAPELLIDOS'));
      if(hi<0){toast('No se encontró la columna NOMBRES Y APELLIDOS');return}
      const cols=rows[hi].map(h=>HMAP[norm(h)]||null);
      let nuevos=0,act=0,omit=0;
      rows.slice(hi+1).forEach(r=>{
        const e={};cols.forEach((k,i)=>{if(!k||k==='edad'||k==='mesNac')return;let v=r[i];
          if(FK[k][2]==='date')v=toISO(v);else if(FK[k][2]==='money'||FK[k][2]==='num'){v=typeof v==='number'?v:+(String(v).replace(/[^\d]/g,''))||'';}
          else v=v instanceof Date?iso(v):String(v??'').trim();e[k]=v});
        if(!e.nombre&&!e.numId){omit++;return}
        if(!e.estado)e.estado=e.fRetiro?'Retirado':'Activo';
        const ex=e.numId&&DB.find(x=>String(x.numId).trim()===String(e.numId).trim());
        if(ex){Object.keys(e).forEach(k=>{if(e[k]!==''&&e[k]!=null)ex[k]=e[k]});act++}
        else{e.id=uid();if(!e.num)e.num=nextNum();DB.push(e);nuevos++}
      });
      syncCat();persist();toast(`Importación lista: ${nuevos} nuevos, ${act} actualizados${omit?`, ${omit} filas vacías omitidas`:''}`);go('empleados');
    }catch(err){console.error(err);toast('No se pudo leer el archivo')}
  };
  rd.readAsArrayBuffer(file);
}
const serial=s=>{const [y,m,d]=s.split('-').map(Number);return (Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5};
function rowOut(e){return F.map(([k,,t])=>{let v=k==='edad'?edad(e.fNac):k==='mesNac'?mesNac(e.fNac):e[k];if(t==='adj')return (e.adjRetiro||[]).map(a=>a.name).join(', ');if(t==='date'&&v)return serial(v);if(k==='num'&&/^\d+$/.test(String(v)))return +v;return v??''})}
function mkSheet(rows){
  const ws=XLSX.utils.aoa_to_sheet([F.map(f=>f[1]),...rows]);
  F.forEach((f,c)=>{if(f[2]!=='date'&&f[2]!=='money')return;for(let r=1;r<=rows.length;r++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell&&cell.t==='n')cell.z=f[2]==='date'?'dd/mm/yyyy':'"$"#,##0'}});
  ws['!cols']=F.map(f=>({wch:Math.max(12,f[1].length+2)}));
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:F.length-1}})};
  return ws;
}
function writeBook(rows,name){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,mkSheet(rows),'Empleados');XLSX.writeFile(wb,name)}
const byNum=a=>[...a].sort((x,y)=>(+x.num||0)-(+y.num||0));
const stamp=()=>{const d=new Date();return `${iso(d)}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`};
function exportSel(t){
  if(typeof XLSX==='undefined'){toast('No se pudo preparar el archivo de Excel');return}
  const src=byNum(t==='activos'?activos():DB.filter(e=>e.estado==='Retirado'));
  if(!src.length){toast('No hay registros para exportar');return}
  writeBook(src.map(rowOut),`Gestion_Humana_${t==='activos'?'Activos':'Retirados'}_${stamp()}.xlsx`);
}
function copiaCompleta(){
  if(typeof XLSX==='undefined'){toast('No se pudo preparar el archivo de Excel');return}
  if(!DB.length){toast('No hay registros para exportar');return}
  const wb=XLSX.utils.book_new(),A=activos();
  XLSX.utils.book_append_sheet(wb,mkSheet(byNum(DB).map(rowOut)),'Todos');
  XLSX.utils.book_append_sheet(wb,mkSheet(byNum(A).map(rowOut)),'Activos');
  XLSX.utils.book_append_sheet(wb,mkSheet(byNum(DB.filter(e=>e.estado==='Retirado')).map(rowOut)),'Retirados');
  // resumen
  const nom=A.reduce((s,e)=>s+(+e.salario||0),0),R=[['RESUMEN DE GESTIÓN HUMANA'],['Generado',new Date().toLocaleString('es-CO')],[],
    ['Empleados activos',A.length],['Empleados retirados',DB.length-A.length],['En periodo de prueba',A.filter(enPrueba).length],['Nómina mensual activa',nom],[]];
  [['SEDE','sede'],['OPERACIÓN','centro'],['CARGO','cargo'],['TIPO DE CONTRATO','tipoContrato'],['GÉNERO','genero']].forEach(([t,k])=>{
    R.push([t,'ACTIVOS','NÓMINA']);const m={};A.forEach(e=>{const v=e[k]||'Sin dato';m[v]=m[v]||[0,0];m[v][0]++;m[v][1]+=(+e.salario||0)});
    Object.entries(m).sort((a,b)=>b[1][0]-a[1][0]).forEach(([v,[n,sal]])=>R.push([v,n,sal]));R.push([])});
  const ws=XLSX.utils.aoa_to_sheet(R);ws['!cols']=[{wch:34},{wch:14},{wch:18}];
  Object.keys(ws).forEach(a=>{if(a[0]==='!')return;const c=XLSX.utils.decode_cell(a);if((c.c===2||(c.c===1&&R[c.r][0]==='Nómina mensual activa'))&&ws[a].t==='n'&&R[c.r][0]!=='Empleados activos')ws[a].z='"$"#,##0'});
  XLSX.utils.book_append_sheet(wb,ws,'Resumen');
  // listas
  const mx=Math.max(...CATS.map(c=>CFG.cat[c.k].length));const Lr=[CATS.map(c=>c.t.toUpperCase())];
  for(let i=0;i<mx;i++)Lr.push(CATS.map(c=>{const x=CFG.cat[c.k][i];return x?x.n+(x.sal?` (${cop(x.sal)})`:''):''}));
  const wl=XLSX.utils.aoa_to_sheet(Lr);wl['!cols']=CATS.map(()=>({wch:26}));XLSX.utils.book_append_sheet(wb,wl,'Listas');
  XLSX.utils.book_append_sheet(wb,sheetVacRegs(),'Vacaciones');
  XLSX.utils.book_append_sheet(wb,sheetNov(NOV),'Novedades');
  XLSX.utils.book_append_sheet(wb,sheetCargos(DB),'Historial de cargos');
  XLSX.utils.book_append_sheet(wb,impSheet(activos()),'Indicadores de impacto');
  XLSX.writeFile(wb,`Gestion_Humana_Copia_${stamp()}.xlsx`);
  try{GH_STORE.setItem(KEY+'_lastcopy',new Date().toISOString())}catch(e){}
  toast('Copia completa descargada');if(VIEW==='datos')vDatos();
}
function exportXlsx(vista){
  if(typeof XLSX==='undefined'){toast('No se pudo preparar el archivo de Excel');return}
  const src=vista?filtered():[...DB].sort((a,b)=>(+a.num||0)-(+b.num||0));
  if(!src.length){toast('No hay registros para exportar');return}
  writeBook(src.map(rowOut),`Gestion_Humana_${iso(today())}.xlsx`);
}
function plantilla(){if(typeof XLSX==='undefined'){toast('No se pudo preparar el archivo de Excel');return}writeBook([],'Plantilla_Gestion_Humana.xlsx')}
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
async function backup(){
  let files=[];
  try{const ids=new Set();NOV.forEach(n=>(n.adj||[]).forEach(a=>ids.add(a.id)));DB.forEach(e=>{(e.adjRetiro||[]).forEach(a=>ids.add(a.id));(e.histRetiros||[]).forEach(h=>(h.adj||[]).forEach(a=>ids.add(a.id)))});
    for(const id of ids){const o=await IDB.get(id);if(o)files.push({id:o.id,empId:o.empId,name:o.name,type:o.type,size:o.size,data:await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(o.blob)})})}}catch(e){}
  dl(new Blob([JSON.stringify({v:4,fecha:new Date().toISOString(),empleados:DB,config:CFG,vacaciones:VAC,novedades:NOV,ausentismo:AUS,ausentismoCfg:AUSCFG,archivos:files})],{type:'application/json'}),`respaldo_gestion_humana_${stamp()}.json`);
  if(files.length)toast(`Respaldo descargado con ${files.length} soporte(s) adjunto(s)`);
}
function restore(f){if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);const arr=Array.isArray(d)?d:d.empleados;if(!Array.isArray(arr))throw 0;
  const key=e=>e.numId?'d:'+String(e.numId).trim():'i:'+e.id;const have=new Map(DB.map(e=>[key(e),e]));
  const nuevos=arr.filter(e=>!have.has(key(e))).length,act=arr.length-nuevos;
  confirmBox('Restaurar respaldo',`<p>El respaldo tiene <b>${arr.length}</b> empleados: <b>${nuevos}</b> se agregarán y <b>${act}</b> se actualizarán con la información del archivo.</p><p class="note">Los empleados que ya están en la plataforma y no vienen en el respaldo se conservan; no se elimina a nadie.</p>`,'Restaurar',()=>{
    arr.forEach(e=>{const k=key(e);if(have.has(k)){const x=have.get(k);Object.assign(x,e,{id:x.id})}else{if(!e.id)e.id=uid();DB.push(e)}});
    if(Array.isArray(d.ausentismo)){d.ausentismo.forEach(v=>{const i=AUS.findIndex(x=>x.id===v.id);if(i>=0)AUS[i]=v;else AUS.push(v)});if(d.ausentismoCfg)AUSCFG=Object.assign(AUSCFG,d.ausentismoCfg);saveAus()}
    (d.vacaciones||[]).forEach(v=>{const i=VAC.findIndex(x=>x.id===v.id);if(i>=0)VAC[i]=v;else VAC.push(v)});(d.novedades||[]).forEach(v=>{const i=NOV.findIndex(x=>x.id===v.id);if(i>=0)NOV[i]=v;else NOV.push(v)});saveVN();
    (d.archivos||[]).forEach(f=>{fetch(f.data).then(r=>r.blob()).then(bl=>IDB.put({id:f.id,empId:f.empId,name:f.name,type:f.type,size:f.size,blob:bl})).catch(()=>{})});
    if(d.config){CFG=Object.assign(CFG,d.config);saveCfg()}syncCat();persist();render();toast(`Respaldo restaurado: ${nuevos} nuevos, ${act} actualizados`)})}catch(e){toast('Archivo de respaldo no válido')}};r.readAsText(f)}


/* SinCo (GH1): sin empleados de ejemplo. */
function demoData(){return []}
const isDemo=e=>e.demo||/@correo-ejemplo\.com$/.test(e.correo||'');
function quitarDemo(){
  const n=DB.filter(isDemo).length;
  confirmBox('Quitar empleados de ejemplo',`<p>Se quitarán los <b>${n}</b> empleados ficticios que trae la plataforma para pruebas.</p><p class="note">Los empleados reales no se tocan.</p>`,'Quitar ejemplo',()=>{
    const ids=new Set(DB.filter(isDemo).map(e=>e.id));VAC=VAC.filter(v=>!ids.has(v.empId));NOV=NOV.filter(v=>!ids.has(v.empId));saveVN();
    DB=DB.filter(e=>!isDemo(e));persist();render();toast('Se quitaron los empleados de ejemplo')});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#ovConf').classList.contains('show'))closeOv('ovConf');else{['ovRet','ovVac','ovNov','ovHV','ovND','ovDet','ovEmp'].some(id=>{const o=$('#'+id);if(o&&o.classList.contains('show')){closeOv(id);return true}})}}});
load();loadVN();loadCfg();loadAus();
try{if(!AUS.some(r=>r.demo)&&!GH_STORE.getItem(KEY+'_init_aus2')){AUS=AUS.concat(ausDemo());saveAus()}GH_STORE.setItem(KEY+'_init_aus2','1')}catch(e){}
try{if(!DB.length&&!GH_STORE.getItem(KEY+'_init')){DB=demoData();persist();syncCat();GH_STORE.setItem(KEY+'_init','1')}}catch(e){}
try{if(!GH_STORE.getItem(KEY+'_init_vn')&&!VAC.length&&!NOV.length&&DB.some(isDemo)){const d=demoVN();VAC=d.V;NOV=d.N;saveVN()}GH_STORE.setItem(KEY+'_init_vn','1')}catch(e){}
impDemo();{let m=false;DB.forEach(e=>{if(!Array.isArray(e.histCargos)||!e.histCargos.length){cargosDe(e);m=true}});if(m)persist()}
render();
