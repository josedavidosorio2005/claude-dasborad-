// trafico.js — InConexion Platform. Trafico de Llamadas (export real de
// Volvox, hoja DATA): carga por Excel (parseo + preview, mismo patron que
// cargas.js / metas.js NSD), mapeo de skills -> campana desde el panel de
// administracion, y el panel "trafico_combo" que consume el motor de
// dashboards genérico (dashboard-generic.js / dashboard-adapters.js) para
// la grafica combinada + filtros de cada dashboard de cliente.
//
// La logica pura (parseo del Excel, agregacion por granularidad) vive en
// trafico-logic.js, que se carga antes que este archivo — aqui solo hay
// codigo que toca el DOM / la API.

// ═══════════════════════════════════════════════════════════
// ADMIN — CARGA DE TRAFICO DESDE EXCEL (Volvox)
// ═══════════════════════════════════════════════════════════
// La plantilla individual (boton "Descargar plantilla" + GET
// /calidad/trafico/plantilla) se retiro de la interfaz (Fase "una sola
// plantilla por campana", 2026-09-16): la hoja "DATA" de Trafico ahora se
// descarga como parte de la plantilla consolidada de cualquier campana
// (cargas.js). El endpoint sigue existiendo en el servidor (nadie lo borro,
// solo dejo de estar enlazado) por si hace falta el archivo original
// aprobado por el cliente; subir un archivo aqui sigue funcionando igual,
// multi-skill y multi-campana en una sola carga.
var _tvParsed = null; // { archivoNombre, filas } listo para POST

async function procesarArchivoTrafico(input){
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); input.value=''; return; }
  var wb, aoa;
  try{
    wb = XLSX.read(new Uint8Array(buf), { type:'array' }); // sin cellDates: DATE se convierte a mano (trafico-logic.js), no depende de la zona horaria
    var sheetName = wb.SheetNames.indexOf('DATA')!==-1 ? 'DATA' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:null });
  }catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var res = traficoParseFilas(aoa);
  if(res.error){ showToast(res.error); input.value=''; return; }

  _tvParsed = { archivoNombre: file.name, filas: res.filas };
  _renderPreviewTrafico(file.name, res);
}

function _renderPreviewTrafico(nombre, res){
  document.getElementById('tv-errores').innerHTML = (res.avisos||[]).map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  document.getElementById('tv-preview-resumen').textContent =
    nombre + ' — ' + res.filas.length + ' fila(s) validas, ' + res.skills.length + ' skill(s), ' +
    res.meses.length + ' mes(es) (' + res.meses.join(', ') + ')';
  var html = res.filas.slice(0,60).map(function(f){
    var nivel = f.nivelAtencionPct===undefined ? '—' : f.nivelAtencionPct+'%';
    return '<tr><td>'+esc(f.fecha)+'</td><td>'+esc(f.skillName)+'</td><td>'+f.totalLlamadas+'</td><td>'+f.contestadas+'</td><td>'+esc(nivel)+'</td></tr>';
  }).join('');
  if(res.filas.length>60) html += '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted)">… y '+(res.filas.length-60)+' filas mas</td></tr>';
  document.getElementById('tv-preview-tbody').innerHTML = html;
  document.getElementById('tv-preview-card').style.display = '';
}

function cancelarPreviewTrafico(){
  _tvParsed = null;
  document.getElementById('tv-preview-card').style.display = 'none';
  document.getElementById('tv-file').value = '';
  document.getElementById('tv-errores').innerHTML = '';
}

// Control de cargas por periodo (seccion 3 del pedido de Edwin): antes de
// guardar, pregunta al servidor cuantas filas YA existen para los mismos
// (skill, mes) que trae este archivo y, si hay alguna, exige confirmacion
// explicita mostrando cuantos registros se van a reemplazar — nunca
// sobrescribe en silencio un mes ya cargado.
async function _traficoConfirmarImpacto(){
  var impacto;
  try{ impacto = await apiRequest('POST','/calidad/trafico/carga/impacto', _tvParsed); }
  catch(e){ showToast(e.message); return false; }
  var afectados = (impacto||[]).filter(function(p){ return p.filasExistentes>0; });
  if(!afectados.length) return true;
  var detalle = afectados.map(function(p){ return '• ' + p.skillName + ' — ' + p.mes + ': ' + p.filasExistentes + ' registro(s) existentes'; }).join('\n');
  var totalExistentes = afectados.reduce(function(a,p){ return a+p.filasExistentes; }, 0);
  return window.confirm(
    'Esta carga va a REEMPLAZAR ' + totalExistentes + ' registro(s) ya cargados:\n\n' + detalle +
    '\n\n¿Continuar y sobrescribir?'
  );
}

async function guardarTrafico(){
  if(!_tvParsed){ showToast('Primero sube un archivo'); return; }
  var ok = await _traficoConfirmarImpacto();
  if(!ok) return;
  var btn = document.getElementById('tv-save-btn');
  var resp;
  try{
    resp = await withButtonLoading(btn, 'Guardando...', function(){ return apiRequest('POST','/calidad/trafico/carga', _tvParsed); });
  }catch(e){ showToast(e.message); return; }
  var msg = resp.insertadas + ' fila(s) guardadas en ' + resp.campanas.length + ' campana(s)';
  if(resp.skillsSinAsignar && resp.skillsSinAsignar.length){
    msg += '. ' + resp.skillsSinAsignar.length + ' skill(s) nueva(s) sin asignar: ' + resp.skillsSinAsignar.join(', ');
  }
  showToast(msg);
  cancelarPreviewTrafico();
  _trafico = {}; // invalida el cache de datos de los paneles trafico_combo abiertos
  // Refresca tambien la tabla de Historial de Nivel de Servicio de esta misma
  // pagina (la carga de trafico recalcula esos meses, y sin esto quedaria
  // mostrando numeros de antes de subir el archivo hasta recargar la pagina).
  if(typeof renderNivelServicioSection === 'function') await renderNivelServicioSection();
  else {
    if(typeof renderTraficoSkills === 'function') renderTraficoSkills();
    if(typeof renderTraficoCobertura === 'function') renderTraficoCobertura();
  }
}

// ═══════════════════════════════════════════════════════════
// ADMIN — MAPEO DE SKILLS -> CAMPANA (+ SEDE si aplica)
// ═══════════════════════════════════════════════════════════
// Campanas con mas de una "vista" (sede/linea) en su dashboard: la campana
// del mapeo sigue siendo UNA sola (ej. "HOSPITAL LA MARIA"), pero se pide
// ademas una sede (atributo, no una campana distinta — ver
// docs/ARQUITECTURA.md, consolidacion 2026-09-15). Los valores de sede son
// los MISMOS codigos que usa dashboards_config.vista para esa campana
// ('CASTILLA'/'SEDE33'), asi el panel trafico_combo puede filtrar
// directamente por _gd.vistaSel sin tabla de traduccion. Si se agrega otro
// dashboard con "vista" que tambien necesite trafico por sede, se registra
// aqui igual.
var TRAFICO_CAMPANAS_MULTISEDE = {
  'HOSPITAL LA MARIA': [
    { valor: 'CASTILLA', label: 'Sede Castilla' },
    { valor: 'SEDE33', label: 'Sede 33' },
  ],
};

function _traficoCampanasAsignables(){
  var base = (typeof CAMPANAS_CALIDAD !== 'undefined') ? CAMPANAS_CALIDAD : [];
  return base.map(function(c){ return { valor: c, label: c }; });
}

var _traficoSkillsCache = []; // ultimo GET /calidad/trafico/skills (para el chequeo de duplicados del formulario de registro)

async function renderTraficoSkills(){
  var tbody = document.getElementById('tv-skills-tbody');
  if(!tbody) return;
  _traficoPoblarCampanaNuevoSkill();
  var rows = [];
  try{ rows = await apiRequest('GET','/calidad/trafico/skills') || []; }
  catch(e){ tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--c-text-muted)">'+esc(e.message)+'</td></tr>'; return; }
  _traficoSkillsCache = rows;

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--c-text-muted)">Todavia no se ha cargado trafico de ninguna skill.</td></tr>';
    return;
  }
  var campanas = _traficoCampanasAsignables();
  tbody.innerHTML = rows.map(function(r, idx){
    var opciones = '<option value="">— Sin asignar —</option>' + campanas.map(function(c){
      return '<option value="'+esc(c.valor)+'"'+(r.campana===c.valor?' selected':'')+'>'+esc(c.label)+'</option>';
    }).join('');
    var sedesCampana = TRAFICO_CAMPANAS_MULTISEDE[r.campana] || [];
    var sedeOpciones = '<option value="">— Sede —</option>' + sedesCampana.map(function(s){
      return '<option value="'+esc(s.valor)+'"'+(r.sede===s.valor?' selected':'')+'>'+esc(s.label)+'</option>';
    }).join('');
    var sedeStyle = sedesCampana.length ? '' : 'display:none';
    return '<tr>' +
      '<td>'+esc(r.skillName)+(r.campana?'':' <span style="background:var(--c-warning-bg);color:var(--c-warning-dark);border-radius:4px;padding:1px 6px;font-size:0.7rem;margin-left:4px">sin asignar</span>')+'</td>' +
      '<td><select id="tv-skill-sel-'+idx+'" data-skill="'+esc(r.skillName)+'" onchange="_traficoToggleSedeSel('+idx+')">'+opciones+'</select>' +
        ' <select id="tv-skill-sede-'+idx+'" style="'+sedeStyle+'">'+sedeOpciones+'</select></td>' +
      '<td>'+r.filas+'</td>' +
      '<td><button class="btn-sm" onclick="guardarMapeoSkill('+idx+')">Guardar</button></td>' +
      '</tr>';
  }).join('');
}

// Cuando se cambia la campana del mapeo, muestra/oculta y repuebla el
// select de sede segun si la nueva campana elegida tiene sedes o no.
function _traficoToggleSedeSel(idx){
  var campSel = document.getElementById('tv-skill-sel-'+idx);
  var sedeSel = document.getElementById('tv-skill-sede-'+idx);
  if(!campSel || !sedeSel) return;
  var sedes = TRAFICO_CAMPANAS_MULTISEDE[campSel.value] || [];
  if(!sedes.length){
    sedeSel.style.display = 'none';
    sedeSel.innerHTML = '<option value="">— Sede —</option>';
    return;
  }
  sedeSel.style.display = '';
  sedeSel.innerHTML = '<option value="">— Sede —</option>' + sedes.map(function(s){
    return '<option value="'+esc(s.valor)+'">'+esc(s.label)+'</option>';
  }).join('');
}

async function guardarMapeoSkill(idx){
  var sel = document.getElementById('tv-skill-sel-'+idx);
  var sedeSel = document.getElementById('tv-skill-sede-'+idx);
  if(!sel) return;
  var skillName = sel.dataset.skill;
  var campana = sel.value || null;
  var sedes = TRAFICO_CAMPANAS_MULTISEDE[campana] || [];
  if(campana && sedes.length && (!sedeSel || !sedeSel.value)){
    showToast('Esta campana tiene mas de una sede: elige cual sede corresponde a esta skill.');
    return;
  }
  var sede = (campana && sedes.length && sedeSel) ? sedeSel.value : null;
  try{
    var resp = await apiRequest('PUT','/calidad/trafico/skills/'+encodeURIComponent(skillName), { campana: campana, sede: sede });
    showToast('Mapeo guardado. '+resp.movidas+' fila(s) reatribuidas, '+resp.mesesRecalculados.length+' mes(es) recalculado(s).');
  }catch(e){ showToast(e.message); return; }
  _trafico = {}; // invalida cache: el trafico de esta skill ya vive en otra campana/sede
  if(typeof renderNivelServicioSection === 'function') await renderNivelServicioSection();
  else {
    renderTraficoSkills();
    if(typeof renderTraficoCobertura === 'function') renderTraficoCobertura();
  }
}

// Puebla el select de campana del formulario "Registrar skill nuevo" una
// sola vez (guard por `sel.options.length`) -- si se repoblara en cada
// render de la tabla se perderia lo que el usuario ya haya elegido ahi
// cada vez que alguien pulsa "Actualizar" o guarda el mapeo de otra fila.
function _traficoPoblarCampanaNuevoSkill(){
  var sel = document.getElementById('tv-skill-nuevo-campana');
  if(!sel || sel.options.length) return;
  var campanas = _traficoCampanasAsignables();
  sel.innerHTML = '<option value="">— Selecciona una campana —</option>' + campanas.map(function(c){
    return '<option value="'+esc(c.valor)+'">'+esc(c.label)+'</option>';
  }).join('');
}

function _traficoToggleSedeSelNuevo(){
  var campSel = document.getElementById('tv-skill-nuevo-campana');
  var sedeWrap = document.getElementById('tv-skill-nuevo-sede-wrap');
  var sedeSel = document.getElementById('tv-skill-nuevo-sede');
  if(!campSel || !sedeWrap || !sedeSel) return;
  var sedes = TRAFICO_CAMPANAS_MULTISEDE[campSel.value] || [];
  if(!sedes.length){
    sedeWrap.style.display = 'none';
    sedeSel.innerHTML = '<option value="">— Sede —</option>';
    return;
  }
  sedeWrap.style.display = '';
  sedeSel.innerHTML = '<option value="">— Sede —</option>' + sedes.map(function(s){
    return '<option value="'+esc(s.valor)+'">'+esc(s.label)+'</option>';
  }).join('');
}

// Registra de antemano el mapeo de un skill que Wolkvox todavia no ha
// mandado en ningun archivo (hallazgo de la auditoria del flujo de carga,
// Fase 30/32): reutiliza EXACTAMENTE el mismo PUT que ya usan las filas
// existentes de abajo (`guardarMapeoSkill`) -- el backend ya hace upsert,
// asi que registrar un skill nuevo o remapear uno existente es la misma
// operacion, solo que este formulario no depende de que el skill ya tenga
// una fila (o trafico cargado) para poder escribirle un SKILL_NAME a mano.
async function registrarNuevoMapeoSkill(){
  var nombreInput = document.getElementById('tv-skill-nuevo-nombre');
  var campSel = document.getElementById('tv-skill-nuevo-campana');
  var sedeSel = document.getElementById('tv-skill-nuevo-sede');
  if(!nombreInput || !campSel) return;

  var v = traficoValidarNuevoMapeo({
    skillName: nombreInput.value,
    campana: campSel.value,
    sede: sedeSel ? sedeSel.value : '',
    sedesDisponibles: TRAFICO_CAMPANAS_MULTISEDE[campSel.value] || [],
    skillsExistentes: _traficoSkillsCache.map(function(r){ return r.skillName; }),
  });
  if(v.error){ showToast(v.error); return; }

  var btn = document.getElementById('tv-skill-nuevo-btn');
  try{
    await withButtonLoading(btn, 'Registrando...', function(){
      return apiRequest('PUT','/calidad/trafico/skills/'+encodeURIComponent(v.skillName), { campana: v.campana, sede: v.sede });
    });
  }catch(e){ showToast(e.message); return; }

  var campanaLabel = v.campana + (v.sede ? ' — ' + v.sede : '');
  showToast('Skill "'+v.skillName+'" registrado y asignado a '+campanaLabel+'. Quedara listo para cuando llegue trafico con este nombre.');
  nombreInput.value = '';
  campSel.value = '';
  _traficoToggleSedeSelNuevo();
  renderTraficoSkills();
}

// ═══════════════════════════════════════════════════════════
// ADMIN — CONTROL DE CARGAS POR PERIODO (seccion 3 del pedido de Edwin)
// ═══════════════════════════════════════════════════════════
// Tabla, por skill, de que meses ya tienen base de trafico cargada.
// Reutiliza las fechas YA guardadas (GET /calidad/trafico/cobertura hace el
// GROUP BY sobre calidad_nivel_servicio_diario) — no hay ninguna tabla de
// "estado" aparte que mantener sincronizada a mano.
async function renderTraficoCobertura(){
  var tbody = document.getElementById('tv-cobertura-tbody');
  if(!tbody) return;
  var rows = [];
  try{ rows = await apiRequest('GET','/calidad/trafico/cobertura') || []; }
  catch(e){ tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--c-text-muted)">'+esc(e.message)+'</td></tr>'; return; }

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--c-text-muted)">Todavia no se ha cargado ningun mes de trafico.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r){
    var campanaLabel = r.campana ? esc(r.campana) + (r.sede ? ' — ' + esc(r.sede) : '') : '<span style="color:var(--c-warning-dark)">(sin asignar)</span>';
    var meses = r.meses.slice().sort(function(a,b){ return a.mes<b.mes?-1:1; });
    var badges = meses.map(function(m){
      return '<span title="'+esc(m.filas)+' fila(s) — '+esc(m.archivoNombre||'')+' ('+esc(m.cargadoPorNombre||'')+')" ' +
        'style="display:inline-block;background:var(--c-success-bg);color:var(--c-success-dark);border-radius:4px;padding:2px 7px;font-size:0.72rem;margin:2px 3px 2px 0">' +
        '&#10003; '+esc(m.mes)+'</span>';
    }).join('');
    return '<tr><td>'+esc(r.skillName)+'</td><td>'+campanaLabel+'</td><td>'+meses.length+' mes(es)</td><td>'+badges+'</td></tr>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// PANEL "trafico_combo" del dashboard generico (dashboard-generic.js)
// ═══════════════════════════════════════════════════════════
var _trafico = {};          // cache por campana: { campana: { filas:[...], skills:[...] } }
var _traficoEstado = {};    // estado de filtros actual por campana
var _traficoAgregadoActual = {}; // ultimo agregado calculado por campana (para exportar)

async function _traficoCargarDatos(campana){
  if(_trafico[campana]) return _trafico[campana];
  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/nivel-servicio/diario?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ filas = []; }
  var skills = [];
  var visto = {};
  filas.forEach(function(f){ if(!visto[f.skillName]){ visto[f.skillName]=true; skills.push(f.skillName); } });
  skills.sort();
  _trafico[campana] = { filas: filas, skills: skills };
  return _trafico[campana];
}

// Prefijo corto para no chocar con otros parametros de la URL si el dia de
// manana la app usara query params para otra cosa.
var TV_URL_PREFIJO = 'tv_';

function _traficoEstadoDesdeURL(){
  var params = new URLSearchParams(window.location.search);
  var skillsParam = params.get(TV_URL_PREFIJO+'skills');
  return {
    skills: skillsParam ? skillsParam.split(',').filter(Boolean) : null,
    desde: params.get(TV_URL_PREFIJO+'desde') || '',
    hasta: params.get(TV_URL_PREFIJO+'hasta') || '',
    granularidad: params.get(TV_URL_PREFIJO+'gran') || 'dia',
    combinar: params.get(TV_URL_PREFIJO+'modo') !== 'separado',
  };
}

// Solo escribe en la URL los parametros de ESTE panel; deja cualquier otro
// query param que ya existiera tal cual (para poder compartir la vista
// concreta sin pisar nada mas de la URL).
function _traficoGuardarEstadoURL(estado){
  var params = new URLSearchParams(window.location.search);
  if(estado.skills && estado.skills.length) params.set(TV_URL_PREFIJO+'skills', estado.skills.join(','));
  else params.delete(TV_URL_PREFIJO+'skills');
  if(estado.desde) params.set(TV_URL_PREFIJO+'desde', estado.desde); else params.delete(TV_URL_PREFIJO+'desde');
  if(estado.hasta) params.set(TV_URL_PREFIJO+'hasta', estado.hasta); else params.delete(TV_URL_PREFIJO+'hasta');
  params.set(TV_URL_PREFIJO+'gran', estado.granularidad);
  params.set(TV_URL_PREFIJO+'modo', estado.combinar ? 'combinado' : 'separado');
  var qs = params.toString();
  var url = window.location.pathname + (qs ? '?'+qs : '');
  window.history.replaceState(null, '', url);
}

// Resuelve la campana de trafico para un panel trafico_combo: la fija en
// config (p.campana, caso normal — ORLANT, CLINICA AURORA) si existe, o si
// no, el cliente del dashboard tal cual (SIEMPRE la campana real, nunca una
// variante por sede — desde la consolidacion 2026-09-15 la sede es un
// atributo del dato, no una campana distinta. Ver _traficoSedePanel abajo y
// docs/ARQUITECTURA.md).
function _traficoCampanaPanel(p){
  return p.campana || _gd.cliente;
}

// Sede a filtrar (client-side, sobre los datos YA cargados de la campana
// completa) para un panel trafico_combo: si el dashboard tiene "vista"
// (HOSPITAL LA MARIA: 2 sedes) y hay una seleccionada, es esa; si no, null
// (sin filtro de sede — campanas de una sola sede, la inmensa mayoria).
function _traficoSedePanel(){
  if(_gd.config && _gd.config.vista && _gd.vistaSel) return _gd.vistaSel;
  return null;
}

// Clave compuesta para el estado/agregado de un panel: campana sola para
// las campanas de una sola sede (la inmensa mayoria), campana+sede para las
// multi-sede (HOSPITAL LA MARIA) — asi cambiar de sede en el selector de
// "vista" del dashboard nunca hereda el filtro de skills/fechas de la otra
// sede (serian skills distintas de todas formas, pero mejor no asumirlo).
function _traficoClaveEstado(campana, sede){
  return sede ? campana + ' :: ' + sede : campana;
}

async function _traficoRenderPanel(p, i){
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var campana = _traficoCampanaPanel(p);
  var sede = _traficoSedePanel();
  var claveEstado = _traficoClaveEstado(campana, sede);
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var datosCampana = await _traficoCargarDatos(campana);
  var filasSede = sede ? datosCampana.filas.filter(function(f){ return f.sede===sede; }) : datosCampana.filas;
  var skillsSede = sede ? datosCampana.skills.filter(function(s){
    return filasSede.some(function(f){ return f.skillName===s; });
  }) : datosCampana.skills;
  var datos = { filas: filasSede, skills: skillsSede };
  if(!datos.filas.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin datos cargados todavia. Un usuario con permiso de administrador debe subir el export de Volvox desde "Cargar Datos → Trafico de Llamadas".</div></div>';
    return;
  }

  var estado = _traficoEstadoDesdeURL();
  var fechasDisponibles = datos.filas.map(function(f){ return f.fecha; }).sort();
  var minDisp = fechasDisponibles[0], maxDisp = fechasDisponibles[fechasDisponibles.length-1];
  // Ventana movil de 12 meses (pedido de Edwin, llamada 2026-09-15): el
  // valor POR DEFECTO de "Desde" (cuando el usuario no eligio nada, ni en
  // esta carga de pagina ni antes via "Aplicar filtros") nunca es el inicio
  // de TODO el historico — son los ultimos 12 meses calendario con datos.
  // El campo "Desde"/"Hasta" sigue siendo el filtro explicito de siempre:
  // en cuanto el usuario lo usa, esa eleccion queda en la URL y manda sobre
  // este default (ver traficoVentana12Meses, trafico-logic.js).
  var desdeDefault = (typeof traficoVentana12Meses === 'function') ? traficoVentana12Meses(maxDisp, minDisp) : minDisp;
  if(!estado.desde) estado.desde = desdeDefault;
  if(!estado.hasta) estado.hasta = maxDisp;
  // El estado de filtros vive en la URL (?tv_...) compartido por CUALQUIER
  // panel trafico_combo de la pagina — si el usuario filtro un rango en el
  // dashboard de otra campana (o de otra sede) y luego abre este (misma
  // pestana del navegador, sin recargar), ese rango puede no solapar en
  // absoluto con los datos de este panel. En vez de mostrar "sin datos" por
  // un filtro heredado que nadie eligio para ESTE panel, se descarta y se
  // vuelve al rango completo disponible aqui (mismo criterio que ya se
  // usaba para skills: si el filtro heredado deja todo afuera, se ignora).
  if(estado.desde > maxDisp || estado.hasta < minDisp){ estado.desde = desdeDefault; estado.hasta = maxDisp; }
  if(!estado.skills) estado.skills = datos.skills.slice(); // sin filtro en la URL -> todas
  else estado.skills = estado.skills.filter(function(s){ return datos.skills.indexOf(s)!==-1; });
  if(!estado.skills.length) estado.skills = datos.skills.slice();
  estado.sede = sede;
  _traficoEstado[claveEstado] = estado;

  var GRAN_LABEL = { dia:'Dia', mes:'Mes', anio:'Año' };
  host.innerHTML =
    '<div class="aurora-card">' +
      '<div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>' +
      '<div class="trafico-filtros" style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:12px">' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Skill</label>' +
          '<select multiple id="tv-f-skills-'+i+'" size="'+Math.min(6, Math.max(2, datos.skills.length))+'" style="min-width:180px">' +
            datos.skills.map(function(s){ return '<option value="'+esc(s)+'"'+(estado.skills.indexOf(s)!==-1?' selected':'')+'>'+esc(s)+'</option>'; }).join('') +
          '</select></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Desde</label><input type="date" id="tv-f-desde-'+i+'" value="'+esc(estado.desde)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Hasta</label><input type="date" id="tv-f-hasta-'+i+'" value="'+esc(estado.hasta)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Granularidad</label>' +
          '<select id="tv-f-gran-'+i+'">' + ['dia','mes','anio'].map(function(g){ return '<option value="'+g+'"'+(estado.granularidad===g?' selected':'')+'>'+GRAN_LABEL[g]+'</option>'; }).join('') + '</select></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">&nbsp;</label>' +
          '<label style="font-size:0.8rem"><input type="checkbox" id="tv-f-separado-'+i+'" '+(!estado.combinar?'checked':'')+'> Ver skills por separado</label></div>' +
        '<button class="btn-primary btn-sm" onclick="_traficoAplicarFiltros('+i+')">Aplicar filtros</button>' +
        '<span style="margin-left:auto;display:flex;gap:6px">' +
          '<button class="btn-sm" onclick="_traficoExportExcel('+i+')">Excel</button>' +
          '<button class="btn-sm" onclick="_traficoExportPrint('+i+')">PDF</button>' +
        '</span>' +
      '</div>' +
      '<div class="aurora-kpis" id="tv-kpis-'+i+'"></div>' +
      '<div class="aurora-chart-wrap" style="height:280px"><canvas id="tv-canvas-'+i+'"></canvas></div>' +
      // Abandono y AHT (graficas 2-3 del PDF de InCo): siempre agregado, sin
      // el desglose "por separado" de arriba (que es para el grafico
      // principal) — son tendencias mensuales de la campana completa.
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:16px">' +
        '<div><div class="aurora-card-title" style="font-size:0.8rem">Llamadas abandonadas</div>' +
          '<div class="aurora-chart-wrap" style="height:230px"><canvas id="tv-canvas-ab-'+i+'"></canvas></div></div>' +
        '<div><div class="aurora-card-title" style="font-size:0.8rem">AHT — tiempo promedio de atencion</div>' +
          '<div class="aurora-chart-wrap" style="height:230px"><canvas id="tv-canvas-aht-'+i+'"></canvas></div></div>' +
      '</div>' +
    '</div>';
  host.dataset.campana = campana;
  host.dataset.sede = sede || '';

  _traficoRenderContenido(campana, sede, i);
}

function _traficoLeerControles(i){
  var sel = document.getElementById('tv-f-skills-'+i);
  var skills = sel ? Array.prototype.filter.call(sel.options, function(o){ return o.selected; }).map(function(o){ return o.value; }) : [];
  return {
    skills: skills,
    desde: document.getElementById('tv-f-desde-'+i).value,
    hasta: document.getElementById('tv-f-hasta-'+i).value,
    granularidad: document.getElementById('tv-f-gran-'+i).value,
    combinar: !document.getElementById('tv-f-separado-'+i).checked,
  };
}

function _traficoAplicarFiltros(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host.dataset.campana;
  var sede = host.dataset.sede || null;
  var claveEstado = _traficoClaveEstado(campana, sede);
  var estado = _traficoLeerControles(i);
  var datosCampana = _trafico[campana];
  var skillsDisponibles = (datosCampana && sede)
    ? datosCampana.skills.filter(function(s){ return datosCampana.filas.some(function(f){ return f.sede===sede && f.skillName===s; }); })
    : ((datosCampana && datosCampana.skills.slice()) || []);
  if(!estado.skills.length) estado.skills = skillsDisponibles;
  estado.sede = sede;
  _traficoEstado[claveEstado] = estado;
  _traficoGuardarEstadoURL(estado);
  _traficoRenderContenido(campana, sede, i);
}

function _traficoRenderContenido(campana, sede, i){
  var claveEstado = _traficoClaveEstado(campana, sede);
  var datosCampana = _trafico[campana];
  var datos = { filas: sede ? datosCampana.filas.filter(function(f){ return f.sede===sede; }) : datosCampana.filas };
  var estado = _traficoEstado[claveEstado];
  var filtradas = traficoFiltrarFilas(datos.filas, { skills: estado.skills, desde: estado.desde, hasta: estado.hasta });
  var agregado = traficoAgregar(filtradas, { granularidad: estado.granularidad, combinar: estado.combinar });
  _traficoAgregadoActual[claveEstado] = agregado;

  // Totales del periodo YA filtrado (nunca promedio de % diarios): suma
  // primero, calcula el % despues — mismo criterio de traficoAgregar.
  var totalLlamadas = filtradas.reduce(function(a,f){ return a+f.totalLlamadas; }, 0);
  var totalContestadas = filtradas.reduce(function(a,f){ return a+f.contestadas; }, 0);
  var tieneAbandonadas = filtradas.some(function(f){ return f.llamadasAbandonadas!=null; });
  var totalAbandonadas = tieneAbandonadas ? filtradas.reduce(function(a,f){ return a+(f.llamadasAbandonadas||0); }, 0) : null;
  var nivelAtencion = totalLlamadas>0 ? Math.round((totalContestadas/totalLlamadas)*1000)/10 : null;
  var tasaAbandono = (totalLlamadas>0 && tieneAbandonadas) ? Math.round((totalAbandonadas/totalLlamadas)*1000)/10 : null;

  var kpisEl = document.getElementById('tv-kpis-'+i);
  if(kpisEl){
    var semNivel = (typeof _gdSemaforoColor==='function') ? _gdSemaforoColor(nivelAtencion, { metrica:'nivel_atencion', campana: campana }) : null;
    var semAband = (typeof _gdSemaforoColor==='function') ? _gdSemaforoColor(tasaAbandono, { metrica:'tasa_abandono', campana: campana }) : null;
    var clsNivel = semNivel ? _gdSemaforoClase(semNivel) : (nivelAtencion===null?'':nivelAtencion>=90?'kpi-green':nivelAtencion>=70?'kpi-org':'kpi-red');
    var clsAband = semAband ? _gdSemaforoClase(semAband) : 'kpi-red';
    kpisEl.innerHTML =
      '<div class="aurora-kpi"><div class="kv">'+totalLlamadas.toLocaleString('es-CO')+'</div><div class="kl">Total Llamadas</div></div>'+
      '<div class="aurora-kpi kpi-green"><div class="kv">'+totalContestadas.toLocaleString('es-CO')+'</div><div class="kl">Llamadas Contestadas</div></div>'+
      '<div class="aurora-kpi '+clsAband+'"><div class="kv">'+(totalAbandonadas===null?'—':totalAbandonadas.toLocaleString('es-CO'))+'</div><div class="kl">Llamadas Abandonadas</div></div>'+
      '<div class="aurora-kpi '+clsNivel+'"><div class="kv">'+(nivelAtencion===null?'—':nivelAtencion+'%')+'</div><div class="kl">Nivel de Atencion</div></div>'+
      '<div class="aurora-kpi '+clsAband+'"><div class="kv">'+(tasaAbandono===null?'—':tasaAbandono+'%')+'</div><div class="kl">Tasa de Abandono</div></div>';
  }

  var canvasId = 'tv-canvas-'+i;
  var labels, datasets;
  var CDl = (typeof CD!=='undefined') ? CD : '#0d4a5e';
  var CGl = (typeof CG!=='undefined') ? CG : '#27ae60';
  var COl = (typeof CO!=='undefined') ? CO : '#e67e22';
  var pal = (typeof PC!=='undefined') ? PC : [CDl,CGl,COl];

  if(estado.combinar){
    labels = agregado.map(function(a){ return a.periodo; });
    datasets = [
      { type:'bar', label:'Total Llamadas', data: agregado.map(function(a){return a.totalLlamadas;}), backgroundColor: CDl, yAxisID:'y', borderRadius:3 },
      { type:'bar', label:'Llamadas Contestadas', data: agregado.map(function(a){return a.contestadas;}), backgroundColor: CGl, yAxisID:'y', borderRadius:3 },
      { type:'line', label:'Nivel de Atencion', data: agregado.map(function(a){return a.nivelAtencionPct;}), borderColor: COl, backgroundColor: COl, yAxisID:'y2', borderWidth:2.5, pointRadius:3, tension:0.3 },
    ];
  } else {
    var periodos = agregado.map(function(a){ return a.periodo; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
    var skillsPresentes = agregado.map(function(a){ return a.skillName; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; });
    datasets = [];
    skillsPresentes.forEach(function(sk){
      var porPeriodo = {};
      agregado.filter(function(a){ return a.skillName===sk; }).forEach(function(a){ porPeriodo[a.periodo]=a; });
      // Color por identidad de la skill (paleta-logic.js), no por posicion:
      // la misma skill se ve siempre del mismo color, combinada o separada,
      // sin importar el orden en que aparezca tras subir un archivo nuevo.
      var color = (typeof paletaColorPara==='function') ? paletaColorPara(sk, pal) : pal[0];
      datasets.push({ type:'bar', label: sk+' — Total', data: periodos.map(function(p){ return porPeriodo[p]?porPeriodo[p].totalLlamadas:0; }), backgroundColor: color, yAxisID:'y', borderRadius:3 });
      datasets.push({ type:'line', label: sk+' — Nivel Atencion', data: periodos.map(function(p){ return porPeriodo[p]?porPeriodo[p].nivelAtencionPct:null; }), borderColor: color, backgroundColor: color, yAxisID:'y2', borderWidth:2, pointRadius:2, tension:0.3 });
    });
    labels = periodos;
  }

  var o = (typeof loBar==='function') ? loBar() : { responsive:true, maintainAspectRatio:false, plugins:{} };
  o.scales = {
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:8}} },
    y2: { position:'right', min:0, max:100, grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return v+'%'; }} },
    x: { grid:{display:false}, ticks:{font:{size:8}, maxRotation:60} },
  };
  o.plugins.datalabels = { display:false };
  o.plugins.tooltip = { callbacks: { label: function(ctx){
    var v = ctx.parsed.y;
    var suf = ctx.dataset.yAxisID==='y2' ? '%' : '';
    return ctx.dataset.label + ': ' + (v===null||v===undefined ? '—' : (suf ? v+suf : v.toLocaleString('es-CO')));
  } } };

  if(typeof _gdChart === 'function'){
    _gdChart(canvasId, { data:{ labels: labels, datasets: datasets }, options: o });
  }

  // Abandono (graf. 2 del PDF) y AHT (graf. 3) — siempre agregado combinado
  // (traficoAgregar con combinar:true), sin depender del checkbox "Ver
  // skills por separado" de arriba: son la tendencia de la campana completa,
  // igual que las pide InCo. Reutiliza el mismo `filtradas` (mismos filtros
  // de skill/fecha ya aplicados) y traficoAgregar ya testeado — sin logica
  // nueva en trafico-logic.js, los campos ya se calculaban y exportaban.
  var agregadoComb = estado.combinar ? agregado : traficoAgregar(filtradas, { granularidad: estado.granularidad, combinar: true });

  var oAband = (typeof loBar==='function') ? loBar() : { responsive:true, maintainAspectRatio:false, plugins:{} };
  oAband.scales = {
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:8}} },
    y2: { position:'right', min:0, grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return v+'%'; }} },
    x: { grid:{display:false}, ticks:{font:{size:8}, maxRotation:60} },
  };
  oAband.plugins.datalabels = { display:false };
  oAband.plugins.tooltip = { callbacks: { label: function(ctx){
    var v = ctx.parsed.y;
    var suf = ctx.dataset.yAxisID==='y2' ? '%' : '';
    return ctx.dataset.label + ': ' + (v===null||v===undefined ? '—' : (suf ? v+suf : v.toLocaleString('es-CO')));
  } } };
  if(typeof _gdChart === 'function'){
    _gdChart('tv-canvas-ab-'+i, { data:{ labels: agregadoComb.map(function(a){return a.periodo;}),
      datasets:[
        { type:'bar', label:'Abandono', data: agregadoComb.map(function(a){return a.llamadasAbandonadas;}), backgroundColor: CDl, yAxisID:'y', borderRadius:3 },
        { type:'line', label:'% Abandono', data: agregadoComb.map(function(a){return a.tasaAbandonoPct;}), borderColor: COl, backgroundColor: COl, yAxisID:'y2', borderWidth:2.5, pointRadius:3, tension:0.3 },
      ] }, options: oAband });
  }

  var oAht = (typeof lo==='function') ? lo(null, 60) : { responsive:true, maintainAspectRatio:false, plugins:{} };
  var fmtAht = function(v){ if(v===null||v===undefined) return '—'; var m=Math.floor(v/60), s=Math.round(v%60); return m+':'+(s<10?'0':'')+s; };
  oAht.plugins.datalabels = { display:false };
  oAht.scales.y.ticks.callback = fmtAht;
  oAht.plugins.tooltip = { callbacks: { label: function(ctx){ return 'AHT: ' + fmtAht(ctx.parsed.y); } } };
  if(typeof _gdChart === 'function'){
    _gdChart('tv-canvas-aht-'+i, { type:'line', data:{ labels: agregadoComb.map(function(a){return a.periodo;}),
      datasets:[{ label:'AHT', data: agregadoComb.map(function(a){return a.ahtSegundos;}), borderColor: CDl, backgroundColor: CDl, borderWidth:2.5, pointRadius:3, tension:0.3, fill:false }] },
      options: oAht });
  }
}

function _traficoDatosExport(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : null;
  var sede = host ? (host.dataset.sede || null) : null;
  var agregado = _traficoAgregadoActual[_traficoClaveEstado(campana, sede)] || [];
  return agregado.map(function(a){
    return {
      Periodo: a.periodo,
      Skill: a.skillName || 'Todas (combinado)',
      'Total Llamadas': a.totalLlamadas,
      'Llamadas Contestadas': a.contestadas,
      'Llamadas Abandonadas': a.llamadasAbandonadas,
      '% Nivel de Atencion': a.nivelAtencionPct,
      '% Tasa de Abandono': a.tasaAbandonoPct,
      '% Service Level 10s': a.serviceLevel10secPct,
      '% Service Level 20s': a.serviceLevel20secPct,
      '% Service Level 30s': a.serviceLevel30secPct,
      'ASA (seg)': a.asaSegundos,
      'ATA (seg)': a.ataSegundos,
      'AHT (seg)': a.ahtSegundos,
      'Wait Time (seg)': a.waitTimeSegundos,
    };
  });
}

function _traficoExportExcel(i){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var datos = _traficoDatosExport(i);
  if(!datos.length){ showToast('No hay datos para exportar con estos filtros.'); return; }
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : 'trafico';
  var wb = XLSX.utils.book_new();
  xlsxAgregarAvisoDemo(wb);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Trafico');
  XLSX.writeFile(wb, 'Trafico_Llamadas_'+String(campana).replace(/\s+/g,'_')+'.xlsx');
}

function _traficoExportPrint(i){
  var datos = _traficoDatosExport(i);
  if(!datos.length){ showToast('No hay datos para exportar con estos filtros.'); return; }
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : '';
  var w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para exportar a PDF.'); return; }
  var cols = Object.keys(datos[0]);
  var tabla = '<table><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('')+'</tr></thead><tbody>'+
    datos.map(function(r){ return '<tr>'+cols.map(function(c){ var v=r[c]; return '<td>'+(v===null||v===undefined?'—':esc(v))+'</td>'; }).join('')+'</tr>'; }).join('')+
    '</tbody></table>';
  var avisoHtml = (typeof seedDemoActivo !== 'undefined' && seedDemoActivo)
    ? '<div style="background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:16px">'+
      '⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
    : '';
  w.document.write('<!doctype html><html><head><title>Trafico de Llamadas — '+esc(campana)+'</title>'+
    '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}'+
    'table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}'+
    'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>'+
    avisoHtml +
    '<h1>Trafico de Llamadas — '+esc(campana)+'</h1>'+tabla+
    '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — '+new Date().toLocaleString('es-CO')+'</p>'+
    '</body></html>');
  w.document.close();
  setTimeout(function(){ w.focus(); w.print(); }, 300);
}
