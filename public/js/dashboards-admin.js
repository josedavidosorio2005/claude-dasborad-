// dashboards-admin.js — InConexion Platform. FASE 3.
// Pantalla de administracion para crear/editar dashboards de cliente por
// configuracion (secciones de carga + paneles), sin tocar codigo.
// Endpoints: GET/POST/PUT/DELETE /api/dashboards/config[/:cliente]

var _dcEditCliente = null;   // cliente en edicion, o null si es nuevo
var _dcState = null;         // { cliente, titulo, vista, secciones:[], tabs:[], kpis:[] }

var _DC_TIPOS_COL = ['entero', 'decimal', 'porcentaje', 'texto', 'fecha'];
var _DC_CADENCIAS = ['mensual', 'diaria', 'semanal'];
var _DC_PERIODOS = ['mes', 'dia', 'semana'];
var _DC_TIPOS_PANEL = ['line', 'bar', 'area', 'pie', 'tabla', 'calidad_kpis', 'calidad_pie'];
var _DC_MODOS = ['serie', 'ultimo', 'filas', 'agregado'];
var _DC_FORMATOS = ['entero', 'miles', 'porcentaje', 'decimal', 'tiempo_mmss'];

// ── Listado ────────────────────────────────────────────────
async function renderDashboardsSection(){
  var tbody = document.getElementById('dashcfg-tbody');
  var noRes = document.getElementById('dashcfg-no-results');
  var rows = [];
  try{ rows = await apiRequest('GET', '/dashboards/config'); }catch(e){ showToast(e.message); }
  if(!rows.length){ tbody.innerHTML = ''; noRes.classList.remove('hidden'); return; }
  noRes.classList.add('hidden');
  tbody.innerHTML = rows.map(function(r){
    return '<tr><td><strong>'+esc(r.cliente)+'</strong></td><td>'+esc(r.titulo)+'</td><td>'+r.tabs+'</td><td>'+r.paneles+'</td>'+
      '<td style="font-size:0.78rem;color:#7a9ba8">'+esc((r.updatedAt||'').slice(0,10))+'</td>'+
      '<td><button class="btn-sm btn-cancel" data-dcaction="preview" data-cliente="'+esc(r.cliente)+'">Previsualizar</button> '+
      '<button class="btn-sm btn-edit" data-dcaction="edit" data-cliente="'+esc(r.cliente)+'">Editar</button> '+
      '<button class="btn-sm btn-delete" data-dcaction="delete" data-cliente="'+esc(r.cliente)+'">Eliminar</button></td></tr>';
  }).join('');
}

// Los botones Previsualizar/Editar/Eliminar llevan el cliente en data-cliente
// (no en un onclick con texto libre — evita inyeccion de JS via el nombre
// del cliente).
document.getElementById('dashcfg-tbody') && document.getElementById('dashcfg-tbody').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-dcaction]');
  if(!btn) return;
  if(btn.dataset.dcaction === 'preview') previewDashCfgGuardado(btn.dataset.cliente);
  else if(btn.dataset.dcaction === 'edit') openDashCfgModal(btn.dataset.cliente);
  else if(btn.dataset.dcaction === 'delete') deleteDashCfg(btn.dataset.cliente);
});

// Previsualizar el dashboard YA GUARDADO de una campana, desde el listado
// (antes de decidir si editarlo o borrarlo) — reutiliza tal cual
// openGenericDashboard(), la MISMA funcion que abre el dashboard real de un
// cliente (dashboard-generic.js): mismos datos reales, mismo render, cero
// logica nueva. A diferencia de previewDashCfg() (que muestra la
// configuracion EN MEMORIA del formulario, aun sin guardar), esta
// previsualizacion siempre es la version ya guardada en la base.
function previewDashCfgGuardado(cliente){
  if(typeof openGenericDashboard !== 'function'){ showToast('No se pudo abrir la previsualizacion'); return; }
  openGenericDashboard(cliente);
}

async function deleteDashCfg(cliente){
  // Desde 2026-09-16 borrar la configuracion (KPIs/secciones/layout) NUNCA
  // borra los Excel ya cargados (bug real: alguien perdio una carga real
  // de ORLANT al recrear su dashboard) -- si se vuelve a crear el
  // dashboard para el mismo cliente, esos datos se ven de inmediato.
  if(!confirm('Eliminar la configuracion del dashboard de '+cliente+'? Los datos ya cargados (Excel de meses anteriores) NO se borran -- si vuelves a crear el dashboard de este cliente, se veran de nuevo.')) return;
  try{ await apiRequest('DELETE', '/dashboards/config/'+encodeURIComponent(cliente)); }
  catch(e){ showToast(e.message); return; }
  showToast('Configuracion del dashboard eliminada (los datos cargados se conservaron)');
  await loadDashboardClientes();
  renderDashboardsSection();
}

// ── Modal builder ──────────────────────────────────────────
async function openDashCfgModal(cliente){
  _dcEditCliente = cliente || null;
  if(cliente){
    try{
      var cfg = await apiRequest('GET', '/dashboards/config/'+encodeURIComponent(cliente));
      _dcState = _dcFromConfig(cfg);
    }catch(e){ showToast(e.message); return; }
  } else {
    var libres = CLIENTES_LIST.filter(function(c){ return BUILT_CLIENT_DASHBOARDS.indexOf(c)===-1; });
    _dcState = { cliente:libres[0] || '', titulo:'', vista:null,
      secciones:[ _dcNuevaSeccion() ],
      tabs:[ { key:'general', label:'General', panels:[] } ],
      kpis:[] };
  }
  document.getElementById('dashcfg-modal-title').textContent = cliente ? ('Editar dashboard — '+cliente) : 'Nuevo dashboard';
  _dcRender();
  document.getElementById('dashcfg-overlay').classList.add('show');
}
function closeDashCfgModal(){ document.getElementById('dashcfg-overlay').classList.remove('show'); }

function _dcNuevaSeccion(){
  return { key:'resumen', titulo:'Resumen mensual', cadencia:'mensual', periodo:'mes', filaUnica:true,
    columnas:[ { key:'valor_1', label:'Valor 1', tipo:'entero', opcional:false } ] };
}
function _dcNuevoPanel(){ return { tipo:'line', titulo:'Nuevo panel', s:'', modo:'serie', campo:'', x:'', filtro:'', formula:'', formato:'entero', unidad:'', horizontal:false, campana:'' }; }
function _dcNuevoKpi(){ return { titulo:'KPI', s:'', modo:'ultimo', campo:'', formula:'', formato:'miles', meta:'', direccion:'mayor' }; }

// "Meta" en el formulario: numero (12.5) o nombre de columna (meta_ventas).
// Se guarda como numero, o como fuente { s, modo:'ultimo', campo } si es columna.
function _dcMetaFromCfg(k){
  var m = k.meta;
  if(m === null || m === undefined || m === '') return '';
  if(typeof m === 'number') return String(m);
  if(m && m.campo) return m.campo;
  return '';
}
function _dcMetaToCfg(str, seccion){
  var s = String(str == null ? '' : str).trim();
  if(!s) return undefined;
  if(/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return { s: seccion || 'resumen', modo: 'ultimo', campo: s };
}

function _dcFromConfig(cfg){
  var secciones = Object.keys(cfg.secciones || {}).map(function(k){
    var s = cfg.secciones[k];
    return { key:k, titulo:s.titulo, cadencia:s.cadencia, periodo:s.periodo, filaUnica:!!s.filaUnica,
      columnas:(s.columnas||[]).map(function(c){ return { key:c.key, label:c.label, tipo:c.tipo, opcional:!!c.opcional }; }) };
  });
  var tabs = (cfg.layout.tabs || []).map(function(t){
    return { key:t.key, label:t.label, panels:(t.panels||[]).map(_dcPanelFromCfg) };
  });
  var kpis = (cfg.layout.kpis || []).map(function(k){
    var f = k.fuente || {};
    return {
      titulo:k.titulo, s:f.s||'', modo:f.modo||'ultimo', campo:f.campo||'',
      formula:_dcFormulaStr(f), formato:k.formato||'miles',
      meta:_dcMetaFromCfg(k),
      direccion:k.mejorDireccion === 'baja' ? 'menor' : 'mayor',
      // Se conservan tal cual los campos de analisis que el formulario no edita
      // (alerta, cls, semaforo) para no perderlos al guardar desde el constructor.
      _extra:{ alerta:k.alerta, cls:k.cls, semaforo:k.semaforo }
    };
  });
  return { cliente:cfg.cliente, titulo:cfg.titulo, vista:cfg.vista || null, secciones:secciones, tabs:tabs, kpis:kpis };
}
function _dcFormulaStr(f){ return f.formula ? (f.formula.replace('a', f.a||'a').replace('b', f.b||'b')) : ''; }
function _dcPanelFromCfg(p){
  var out = { tipo:p.tipo, titulo:p.titulo||'', s:'', modo:'serie', campo:'', x:'', filtro:'', formula:'', formato:'entero', unidad:p.unidad||'', horizontal:!!p.horizontal, campana:p.campana||'' };
  var f = p.fuente || (p.series && p.series[0] && p.series[0].fuente) || null;
  if(f){ out.s=f.s||''; out.modo=f.modo||'serie'; out.campo=f.campo||''; out.x=f.x||''; out.formula=_dcFormulaStr(f);
    out.filtro = f.filtro ? Object.keys(f.filtro).map(function(k){ return k+'='+f.filtro[k]; }).join(',') : ''; }
  if(p.tipo==='combo'){ out._raw = JSON.stringify(p); } // combos: se editan como JSON
  return out;
}

// Convierte una cadena "k=v,k2=v2" en objeto
function _dcParseFiltro(str){
  if(!str) return undefined;
  var o = {};
  str.split(',').forEach(function(part){ var kv = part.split('='); if(kv.length===2) o[kv[0].trim()] = kv[1].trim(); });
  return Object.keys(o).length ? o : undefined;
}
function _dcFuente(p){
  var f = { s:p.s, modo:p.modo };
  if(p.formula){
    var m = p.formula.replace(/\s/g,'').match(/^([a-z0-9_]+)([+\-\/])([a-z0-9_]+)(\*100)?$/);
    if(m){ f.a=m[1]; f.b=m[3]; f.formula = m[2]==='/' ? (m[4]?'a/b*100':'a/b') : 'a'+m[2]+'b'; }
  } else { f.campo = p.campo; }
  if(p.modo==='filas'){ f.x = p.x || 'fecha'; }
  var flt = _dcParseFiltro(p.filtro);
  if(flt) f.filtro = flt;
  return f;
}

function _dcToConfig(){
  var st = _dcState;
  var secciones = {};
  st.secciones.forEach(function(s){
    secciones[s.key] = {
      titulo:s.titulo, descripcion:'', cadencia:s.cadencia, periodo:s.periodo, filaUnica:!!s.filaUnica,
      columnas:s.columnas.map(function(c){ return { key:c.key, label:c.label, tipo:c.tipo, opcional:!!c.opcional }; })
    };
  });
  var tabs = st.tabs.map(function(t){
    return { key:t.key, label:t.label, panels:t.panels.map(function(p){
      if(p._raw){ try{ return JSON.parse(p._raw); }catch(e){ /* cae al form */ } }
      if(p.tipo==='calidad_kpis' || p.tipo==='calidad_pie') return { tipo:p.tipo, titulo:p.titulo, campana:p.campana };
      if(p.tipo==='tabla') return { tipo:'tabla', titulo:p.titulo, fuente:{ s:p.s, modo:'filas', x:p.x||'fecha' },
        columnas: (secciones[p.s] ? secciones[p.s].columnas : []).map(function(c){ return { key:c.key, label:c.label }; }) };
      if(p.tipo==='pie') return { tipo:'pie', titulo:p.titulo, fuente: Object.assign(_dcFuente(p), { modo:'filas', x:p.x||'categoria' }) };
      // line / bar
      return { tipo:p.tipo, titulo:p.titulo, unidad:p.unidad||undefined, horizontal:p.tipo==='bar'?!!p.horizontal:undefined,
        series:[ { label:p.titulo, fuente:_dcFuente(p) } ] };
    })};
  });
  var kpis = st.kpis.map(function(k){
    var pf = _dcFuente({ s:k.s, modo:k.modo, campo:k.campo, formula:k.formula });
    var out = { titulo:k.titulo, fuente:pf, formato:k.formato };
    var meta = _dcMetaToCfg(k.meta, k.s);
    if(meta !== undefined) out.meta = meta;
    if(k.direccion === 'menor') out.mejorDireccion = 'baja';
    var ex = k._extra || {};
    if(ex.alerta) out.alerta = ex.alerta;
    if(ex.cls) out.cls = ex.cls;
    if(ex.semaforo !== undefined && ex.semaforo !== null) out.semaforo = ex.semaforo;
    return out;
  });
  return {
    cliente: _dcEditCliente || st.cliente,
    titulo: st.titulo,
    vista: st.vista,
    secciones: secciones,
    layout: { kpis: kpis, tabs: tabs }
  };
}

// ── Render del formulario ──────────────────────────────────
function _opt(list, sel){ return list.map(function(v){ return '<option'+(v===sel?' selected':'')+'>'+esc(v)+'</option>'; }).join(''); }
function _seccionKeys(){ return _dcState.secciones.map(function(s){ return s.key; }); }

function _dcRender(){
  var st = _dcState;
  var clientesLibres = CLIENTES_LIST.filter(function(c){ return c===_dcEditCliente || BUILT_CLIENT_DASHBOARDS.indexOf(c)===-1; });
  var h = '';
  h += '<div class="form-row">'+
    '<div class="ig"><label>Cliente</label>'+
      (_dcEditCliente
        ? '<input type="text" value="'+esc(_dcEditCliente)+'" disabled>'
        : '<select id="dc-cliente" onchange="_dcSet(\'cliente\',this.value)">'+clientesLibres.map(function(c){ return '<option'+(c===st.cliente?' selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select>')+
    '</div>'+
    '<div class="ig"><label>Titulo del dashboard</label><input type="text" value="'+esc(st.titulo)+'" oninput="_dcSet(\'titulo\',this.value)"></div>'+
  '</div>';

  // Vista
  h += '<div class="section-card" style="margin:8px 0"><label style="font-weight:600"><input type="checkbox" '+(st.vista?'checked':'')+' onchange="_dcToggleVista(this.checked)"> Este cliente tiene sub-vistas (ej. sedes)</label>';
  if(st.vista){
    h += '<div class="form-row" style="margin-top:8px">'+
      '<div class="ig"><label>Columna (en los Excel)</label><input type="text" value="'+esc(st.vista.campo)+'" oninput="_dcVista(\'campo\',this.value)"></div>'+
      '<div class="ig"><label>Etiqueta del selector</label><input type="text" value="'+esc(st.vista.label)+'" oninput="_dcVista(\'label\',this.value)"></div>'+
    '</div><div class="ig"><label>Opciones (una por linea, formato VALOR=Etiqueta)</label>'+
      '<textarea rows="3" oninput="_dcVistaOpts(this.value)">'+st.vista.opciones.map(function(o){ return esc(o.valor)+'='+esc(o.label); }).join('\n')+'</textarea></div>';
  }
  h += '</div>';

  // Secciones
  h += '<h4 style="margin:14px 0 6px">Secciones (plantillas de Excel)</h4>';
  st.secciones.forEach(function(s, si){
    h += '<div class="section-card" style="margin-bottom:8px"><div class="form-row">'+
      '<div class="ig"><label>Clave (sin espacios)</label><input type="text" value="'+esc(s.key)+'" oninput="_dcSec('+si+',\'key\',this.value)"></div>'+
      '<div class="ig"><label>Titulo</label><input type="text" value="'+esc(s.titulo)+'" oninput="_dcSec('+si+',\'titulo\',this.value)"></div>'+
      '<div class="ig"><label>Cadencia</label><select onchange="_dcSec('+si+',\'cadencia\',this.value)">'+_opt(_DC_CADENCIAS,s.cadencia)+'</select></div>'+
      '<div class="ig"><label>Periodo</label><select onchange="_dcSec('+si+',\'periodo\',this.value)">'+_opt(_DC_PERIODOS,s.periodo)+'</select></div>'+
      '<div class="ig"><label>Fila unica</label><input type="checkbox" '+(s.filaUnica?'checked':'')+' onchange="_dcSec('+si+',\'filaUnica\',this.checked)"></div>'+
    '</div>';
    h += '<div style="padding-left:8px">';
    s.columnas.forEach(function(c, ci){
      h += '<div class="form-row" style="align-items:end">'+
        '<div class="ig"><label>Columna (clave)</label><input type="text" value="'+esc(c.key)+'" oninput="_dcCol('+si+','+ci+',\'key\',this.value)"></div>'+
        '<div class="ig"><label>Etiqueta</label><input type="text" value="'+esc(c.label)+'" oninput="_dcCol('+si+','+ci+',\'label\',this.value)"></div>'+
        '<div class="ig"><label>Tipo</label><select onchange="_dcCol('+si+','+ci+',\'tipo\',this.value)">'+_opt(_DC_TIPOS_COL,c.tipo)+'</select></div>'+
        '<div class="ig"><label>Opcional</label><input type="checkbox" '+(c.opcional?'checked':'')+' onchange="_dcCol('+si+','+ci+',\'opcional\',this.checked)"></div>'+
        '<button class="btn-sm btn-delete" onclick="_dcDelCol('+si+','+ci+')">x</button>'+
      '</div>';
    });
    h += '<button class="btn-sm btn-edit" onclick="_dcAddCol('+si+')">+ columna</button> '+
         '<button class="btn-sm btn-delete" onclick="_dcDelSec('+si+')">Eliminar seccion</button></div></div>';
  });
  h += '<button class="btn-sm btn-edit" onclick="_dcAddSec()">+ seccion</button>';

  // KPIs del tablero
  h += '<h4 style="margin:14px 0 6px">KPIs del tablero superior</h4>';
  st.kpis.forEach(function(k, ki){ h += _dcRenderFuenteRow('kpi', k, ki); });
  h += '<button class="btn-sm btn-edit" onclick="_dcAddKpi()">+ KPI</button>';

  // Pestañas y paneles
  h += '<h4 style="margin:14px 0 6px">Pestanas y paneles</h4>';
  st.tabs.forEach(function(t, ti){
    h += '<div class="section-card" style="margin-bottom:8px"><div class="form-row">'+
      '<div class="ig"><label>Clave pestana</label><input type="text" value="'+esc(t.key)+'" oninput="_dcTab('+ti+',\'key\',this.value)"></div>'+
      '<div class="ig"><label>Etiqueta</label><input type="text" value="'+esc(t.label)+'" oninput="_dcTab('+ti+',\'label\',this.value)"></div>'+
      '<button class="btn-sm btn-delete" onclick="_dcDelTab('+ti+')">Eliminar pestana</button>'+
    '</div><div style="padding-left:8px">';
    t.panels.forEach(function(p, pi){ h += _dcRenderPanelRow(ti, pi, p); });
    h += '<button class="btn-sm btn-edit" onclick="_dcAddPanel('+ti+')">+ panel</button></div></div>';
  });
  h += '<button class="btn-sm btn-edit" onclick="_dcAddTab()">+ pestana</button>';

  document.getElementById('dashcfg-body').innerHTML = h;
}

function _dcRenderFuenteRow(kind, k, ki){
  return '<div class="form-row" style="align-items:end">'+
    '<div class="ig"><label>Titulo</label><input type="text" value="'+esc(k.titulo)+'" oninput="_dcKpi('+ki+',\'titulo\',this.value)"></div>'+
    '<div class="ig"><label>Seccion</label><select onchange="_dcKpi('+ki+',\'s\',this.value)">'+_opt(_seccionKeys(),k.s)+'</select></div>'+
    '<div class="ig"><label>Modo</label><select onchange="_dcKpi('+ki+',\'modo\',this.value)">'+_opt(_DC_MODOS,k.modo)+'</select></div>'+
    '<div class="ig"><label>Campo</label><input type="text" value="'+esc(k.campo)+'" oninput="_dcKpi('+ki+',\'campo\',this.value)"></div>'+
    '<div class="ig"><label>Formula (opcional, ej. campo_a/campo_b*100)</label><input type="text" value="'+esc(k.formula)+'" oninput="_dcKpi('+ki+',\'formula\',this.value)"></div>'+
    '<div class="ig"><label>Formato</label><select onchange="_dcKpi('+ki+',\'formato\',this.value)">'+_opt(_DC_FORMATOS,k.formato)+'</select></div>'+
    '<div class="ig"><label>Meta (numero o columna)</label><input type="text" value="'+esc(k.meta)+'" oninput="_dcKpi('+ki+',\'meta\',this.value)"></div>'+
    '<div class="ig"><label>Mejor si</label><select onchange="_dcKpi('+ki+',\'direccion\',this.value)">'+_opt(['mayor','menor'],k.direccion||'mayor')+'</select></div>'+
    '<button class="btn-sm btn-delete" onclick="_dcDelKpi('+ki+')">x</button>'+
  '</div>';
}

function _dcRenderPanelRow(ti, pi, p){
  var mov = '<button class="btn-sm btn-edit" onclick="_dcMovePanel('+ti+','+pi+',-1)" title="Subir">&#9650;</button>'+
    '<button class="btn-sm btn-edit" onclick="_dcMovePanel('+ti+','+pi+',1)" title="Bajar">&#9660;</button>';
  if(p._raw){
    return '<div class="form-row"><div class="ig" style="flex:1"><label>Panel avanzado (JSON) — '+esc(p.titulo||'')+'</label>'+
      '<textarea rows="4" oninput="_dcPanel('+ti+','+pi+',\'_raw\',this.value)">'+esc(p._raw)+'</textarea></div>'+
      mov+'<button class="btn-sm btn-delete" onclick="_dcDelPanel('+ti+','+pi+')">x</button></div>';
  }
  var esCalidad = p.tipo==='calidad_kpis' || p.tipo==='calidad_pie';
  var h = '<div class="form-row" style="align-items:end">'+
    '<div class="ig"><label>Tipo</label><select onchange="_dcPanel('+ti+','+pi+',\'tipo\',this.value)">'+_opt(_DC_TIPOS_PANEL,p.tipo)+'</select></div>'+
    '<div class="ig"><label>Titulo</label><input type="text" value="'+esc(p.titulo)+'" oninput="_dcPanel('+ti+','+pi+',\'titulo\',this.value)"></div>';
  if(esCalidad){
    h += '<div class="ig"><label>Campana de Calidad</label><input type="text" value="'+esc(p.campana)+'" oninput="_dcPanel('+ti+','+pi+',\'campana\',this.value)"></div>';
  } else {
    h += '<div class="ig"><label>Seccion</label><select onchange="_dcPanel('+ti+','+pi+',\'s\',this.value)">'+_opt(_seccionKeys(),p.s)+'</select></div>'+
      (p.tipo==='pie' || p.tipo==='tabla' ? '' : '<div class="ig"><label>Modo</label><select onchange="_dcPanel('+ti+','+pi+',\'modo\',this.value)">'+_opt(_DC_MODOS,p.modo)+'</select></div>')+
      (p.tipo==='tabla' ? '' : '<div class="ig"><label>Campo</label><input type="text" value="'+esc(p.campo)+'" oninput="_dcPanel('+ti+','+pi+',\'campo\',this.value)"></div>')+
      '<div class="ig"><label>Etiqueta X (filas/pie)</label><input type="text" value="'+esc(p.x)+'" oninput="_dcPanel('+ti+','+pi+',\'x\',this.value)"></div>'+
      '<div class="ig"><label>Filtro (k=v,k2=v2)</label><input type="text" value="'+esc(p.filtro)+'" oninput="_dcPanel('+ti+','+pi+',\'filtro\',this.value)"></div>'+
      (p.tipo==='line'||p.tipo==='area' ? '<div class="ig"><label>Formula</label><input type="text" value="'+esc(p.formula)+'" oninput="_dcPanel('+ti+','+pi+',\'formula\',this.value)"></div>' : '')+
      (p.tipo==='line'||p.tipo==='area' ? '<div class="ig"><label>Unidad</label><input type="text" placeholder="% / tiempo" value="'+esc(p.unidad)+'" oninput="_dcPanel('+ti+','+pi+',\'unidad\',this.value)"></div>' : '')+
      (p.tipo==='bar' ? '<div class="ig"><label>Horizontal</label><input type="checkbox" '+(p.horizontal?'checked':'')+' onchange="_dcPanel('+ti+','+pi+',\'horizontal\',this.checked)"></div>' : '');
  }
  h += mov+'<button class="btn-sm btn-delete" onclick="_dcDelPanel('+ti+','+pi+')">x</button></div>';
  return h;
}
function _dcMovePanel(ti,pi,dir){
  var arr = _dcState.tabs[ti].panels; var ni = pi+dir;
  if(ni<0 || ni>=arr.length) return;
  var tmp = arr[pi]; arr[pi]=arr[ni]; arr[ni]=tmp; _dcRender();
}

// El escape HTML lo centraliza esc() de public/js/esc.js (cargado antes que este
// modulo). Aqui se aplica a todo valor de configuracion que va al innerHTML.

// ── Mutaciones de estado (re-render tras cambios estructurales) ──
function _dcSet(k,v){ _dcState[k]=v; }
function _dcToggleVista(on){ _dcState.vista = on ? { campo:'sede', label:'Sede', opciones:[{valor:'A',label:'A'}] } : null; _dcRender(); }
function _dcVista(k,v){ _dcState.vista[k]=v; }
function _dcVistaOpts(txt){ _dcState.vista.opciones = txt.split('\n').map(function(l){ var kv=l.split('='); return { valor:(kv[0]||'').trim(), label:(kv[1]||kv[0]||'').trim() }; }).filter(function(o){ return o.valor; }); }
function _dcSec(i,k,v){ _dcState.secciones[i][k]=v; if(k==='key'||k==='filaUnica'||k==='periodo') _dcRender(); }
function _dcCol(si,ci,k,v){ _dcState.secciones[si].columnas[ci][k]=v; }
function _dcAddCol(si){ _dcState.secciones[si].columnas.push({ key:'col_'+(_dcState.secciones[si].columnas.length+1), label:'Columna', tipo:'entero', opcional:false }); _dcRender(); }
function _dcDelCol(si,ci){ _dcState.secciones[si].columnas.splice(ci,1); _dcRender(); }
function _dcAddSec(){ _dcState.secciones.push(_dcNuevaSeccion()); _dcRender(); }
function _dcDelSec(i){ _dcState.secciones.splice(i,1); _dcRender(); }
function _dcAddKpi(){ _dcState.kpis.push(_dcNuevoKpi()); _dcRender(); }
function _dcKpi(i,k,v){ _dcState.kpis[i][k]=v; }
function _dcDelKpi(i){ _dcState.kpis.splice(i,1); _dcRender(); }
function _dcTab(i,k,v){ _dcState.tabs[i][k]=v; }
function _dcAddTab(){ _dcState.tabs.push({ key:'tab'+(_dcState.tabs.length+1), label:'Pestana', panels:[] }); _dcRender(); }
function _dcDelTab(i){ _dcState.tabs.splice(i,1); _dcRender(); }
function _dcAddPanel(ti){ _dcState.tabs[ti].panels.push(_dcNuevoPanel()); _dcRender(); }
function _dcPanel(ti,pi,k,v){ _dcState.tabs[ti].panels[pi][k]=v; if(k==='tipo'||k==='s') _dcRender(); }
function _dcDelPanel(ti,pi){ _dcState.tabs[ti].panels.splice(pi,1); _dcRender(); }

// ── Previsualizar (sin guardar) ────────────────────────────
function previewDashCfg(){
  var body;
  try{ body = _dcToConfig(); }catch(e){ showToast('Configuracion invalida: '+e.message); return; }
  if(!body.cliente){ showToast('Elige un cliente'); return; }
  if(typeof openGenericDashboardPreview !== 'function'){ showToast('No se pudo abrir la previsualizacion'); return; }
  openGenericDashboardPreview({
    cliente: body.cliente, titulo: body.titulo || body.cliente,
    vista: body.vista || null, secciones: body.secciones, layout: body.layout,
  });
}

// ── Guardar ────────────────────────────────────────────────
async function saveDashCfg(){
  var body;
  try{ body = _dcToConfig(); }catch(e){ showToast('Configuracion invalida: '+e.message); return; }
  if(!body.cliente){ showToast('Elige un cliente'); return; }
  if(!body.titulo){ showToast('Escribe un titulo'); return; }
  var btn = document.querySelector('#dashcfg-modal .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', function(){
      return _dcEditCliente
        ? apiRequest('PUT', '/dashboards/config/'+encodeURIComponent(_dcEditCliente), body)
        : apiRequest('POST', '/dashboards/config', body);
    });
  }catch(e){ showToast(e.message); return; }
  showToast('Dashboard guardado');
  closeDashCfgModal();
  await loadDashboardClientes();
  renderDashboardsSection();
}

document.getElementById('dashcfg-overlay') && document.getElementById('dashcfg-overlay').addEventListener('click', function(e){ if(e.target===this) closeDashCfgModal(); });
