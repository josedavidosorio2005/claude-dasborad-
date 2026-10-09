// dashboard-generic.js — InConexion Platform. FASE 3.
// Un unico modulo que renderiza CUALQUIER dashboard de cliente a partir de su
// configuracion (GET /api/dashboard/<cliente> -> {config, secciones:cargas}).
// Ya no hay un archivo JS por cliente: crear un dashboard = crear su config.
//
// Tipos de panel: kpi_row | line | bar | pie | combo | tabla | calidad_kpis | calidad_pie
// Ver server/dashboard-config-seed.js para la forma de la config y las "fuentes".

var _gd = {
  cliente: null, config: null, cargas: {}, periodos: [],
  mesSel: '', compSel: '', vistaSel: '', tab: null, subtab: null, charts: {}
};

var _GD_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function _gdNum(v){ var n = typeof v==='number'?v:Number(v); return Number.isFinite(n)?n:0; }
function _gdMesLbl(p){ var x=String(p||'').split('-'); return x.length<2?(p||''):((_GD_MESES[parseInt(x[1],10)-1]||x[1])+'-'+x[0].slice(2)); }
function _gdDiaLbl(f){ var x=String(f||'').split('-'); return x.length>=3?(parseInt(x[2],10)+'/'+parseInt(x[1],10)):String(f||''); }
function _gdUp(v){ return String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,''); }

function _gdFmt(v, formato){
  var n = _gdNum(v);
  if(formato==='porcentaje') return (n % 1 !== 0 ? n.toFixed(2) : n) + '%';
  if(formato==='decimal') return (Math.round(n*100)/100).toLocaleString('es-CO');
  if(formato==='tiempo_mmss'){ var m=Math.floor(n/60), s=Math.round(n%60); return m+':'+(s<10?'0':'')+s; }
  return Math.round(n).toLocaleString('es-CO'); // entero / miles
}

// ── Umbrales de semaforo (color por dato) ───────────────────
// Configurables desde el panel de administracion (tabla umbrales_semaforo,
// pantalla "Umbrales", public/js/umbrales.js), leidos aqui sin ningun
// codigo/valor quemado. Se recargan cada vez que se abre un dashboard (la
// lista es chica) para que un cambio de umbral se vea al instante, sin
// desplegar ni tener que limpiar cache. Reemplaza las 3 implementaciones de
// color que existian antes (k.semaforo binario, barra de meta hardcodeada,
// promedio de Calidad hardcodeado): todas pasan ahora por _gdSemaforoColor.
var _gdUmbrales = [];
async function _gdCargarUmbrales(){
  try{ _gdUmbrales = (await apiRequest('GET','/umbrales')) || []; }
  catch(e){ _gdUmbrales = []; }
  return _gdUmbrales;
}
// Identificador de metrica: k.metrica explicito si existe (recomendado), si
// no se deriva del titulo. Logica pura compartida en semaforo-logic.js (con
// pruebas en server/tests/semaforo-logic.test.js) para no duplicarla.
function _gdMetricaKey(k){
  if(k && k.metrica) return k.metrica;
  return semaforoMetricaKey((k && k.titulo) || '');
}
function _gdUmbralPara(metrica, campana){
  return semaforoUmbralPara(_gdUmbrales, metrica, campana);
}
// 'verde'|'amarillo'|'rojo' segun el umbral configurado, o null si no hay
// umbral para esa metrica (no se inventa color sin config).
function _gdSemaforoColor(valor, k, campanaOverride){
  var metrica = _gdMetricaKey(k);
  var campana = campanaOverride || (k && k.campana) || _gd.cliente;
  return semaforoColorDe(valor, _gdUmbralPara(metrica, campana));
}
function _gdSemaforoClase(color){
  return semaforoClaseCss(color);
}

// ── Resolucion de una "fuente" de datos ─────────────────────
function _gdSeccionCargas(s){ return (_gd.cargas && _gd.cargas[s]) || []; }
function _gdCargaMes(s){
  var arr = _gdSeccionCargas(s).slice().sort(function(a,b){ return b.periodo.localeCompare(a.periodo); });
  var tope = _gd.mesSel || (arr[0] && arr[0].periodo);
  return arr.filter(function(c){ return !tope || c.periodo <= tope; })[0] || null;
}
function _gdVistaFiltro(){
  var v = _gd.config && _gd.config.vista;
  if(!v || !_gd.vistaSel) return null;
  return { campo: v.campo, valor: _gd.vistaSel };
}
function _gdFilaMatch(row, filtro){
  if(!filtro) return true;
  return Object.keys(filtro).every(function(k){ return _gdUp(row[k]) === _gdUp(filtro[k]); });
}
function _gdPickFila(filas){
  var vf = _gdVistaFiltro();
  if(vf){ var m = (filas||[]).filter(function(r){ return _gdUp(r[vf.campo])===_gdUp(vf.valor); }); return m[0] || null; }
  return (filas && filas[0]) || null;
}
function _gdEvalCampo(row, f){
  if(!row) return null;
  if(f.formula){
    // Fase 75 (hallazgo Fase 74, pendiente A2): si el mes no trae `a` o `b`,
    // _gdNum los volvia 0 en vez de tratarlos como "sin dato" -- un panel de
    // formula (Ordenamiento Medico, Recuperacion de Cancelados, STA por mes,
    // etc.) pintaba un 0% o una resta/suma parcial en vez de un hueco ("—").
    // Mismo criterio que ya usan _gdRenderNotaKpi (linea 943) y el nota_kpi
    // de _gdExportarTabDatos (linea 1079): null si falta cualquiera de los
    // dos campos (o si `b` es 0, division invalida).
    var rawA = row[f.a], rawB = row[f.b];
    var faltaA = rawA === null || rawA === undefined;
    var faltaB = rawB === null || rawB === undefined;
    var a = _gdNum(rawA), b = _gdNum(rawB);
    if(f.formula === 'a+b') return (faltaA || faltaB) ? null : a + b;
    if(f.formula === 'a-b') return (faltaA || faltaB) ? null : a - b;
    if(f.formula === 'a/b*100') return (faltaA || faltaB || !b) ? null : Math.round((a/b)*1000)/10;
    if(f.formula === 'a/b') return (faltaA || faltaB || !b) ? null : a/b;
    return null;
  }
  return _gdNum(row[f.campo]);
}

// Devuelve { scalar } o { labels:[], values:[] }.
// `extra` (opcional, solo aplica a modo:'filas'): { categorias:[...] } para
// quedarse solo con esas categorias de f.x (pie/bar por categoria), o
// { desde, hasta } para acotar por f.x==='fecha' (lineas diarias) — el
// filtro nuevo de graficas de Gestion de base (gd-filtro-logic.js), ademas
// del `f.filtro` de igualdad exacta que ya existia. Sin `extra`, el
// comportamiento es identico al de antes de este cambio.
function _gdResolver(f, extra){
  if(!f) return { scalar: null };
  var vf = _gdVistaFiltro();

  if(f.modo === 'serie'){
    var cargas = _gdSeccionCargas(f.s).slice().sort(function(a,b){ return a.periodo.localeCompare(b.periodo); });
    var tope = _gd.mesSel || (cargas.length ? cargas[cargas.length-1].periodo : null);
    if(tope) cargas = cargas.filter(function(c){ return c.periodo <= tope; });
    var labels = cargas.map(function(c){ return _gdMesLbl(c.periodo); });
    var values = cargas.map(function(c){ return _gdEvalCampo(_gdPickFila(c.filas), f); });
    if(f.transform === 'incremento'){
      values = values.map(function(v,i){ return i===0 ? null : (values[i-1] ? Math.round(((_gdNum(v)-_gdNum(values[i-1]))/_gdNum(values[i-1]))*100) : null); });
    }
    return { labels: labels, values: values };
  }

  if(f.modo === 'ultimo'){
    var carga = _gdCargaMes(f.s);
    return { scalar: carga ? _gdEvalCampo(_gdPickFila(carga.filas), f) : null };
  }

  if(f.modo === 'filas'){
    var xk = f.x || 'fecha';

    // `f.anual`: en vez de la carga de UN mes, junta las filas de TODAS las
    // cargas del año (gdCargasDelAnio, gd-filtro-logic.js) y agrupa-suma por
    // xk. Para series "(año)" que el PDF pide acumuladas (ej. Ordenes STA
    // por servicio/estado), no solo el ultimo mes cargado.
    if(f.anual){
      var cActual = _gdCargaMes(f.s);
      var anio = gdAnioDeMes(_gd.mesSel || (cActual ? cActual.periodo : null));
      var cargasAnio = gdCargasDelAnio(_gdSeccionCargas(f.s), anio);
      var sumas = {}, orden = [];
      cargasAnio.forEach(function(c){
        (c.filas||[]).filter(function(r){ return _gdFilaMatch(r, f.filtro) && (!vf || _gdUp(r[vf.campo])===_gdUp(vf.valor)); })
          .forEach(function(r){
            var k = r[xk];
            if(k === undefined || k === null || k === '') return;
            if(sumas[k] === undefined){ sumas[k] = 0; orden.push(k); }
            sumas[k] += _gdEvalCampo(r, f) || 0;
          });
      });
      return { labels: orden, values: orden.map(function(k){ return sumas[k]; }) };
    }

    var c2 = _gdCargaMes(f.s);
    var filas = (c2 ? c2.filas || [] : []).filter(function(r){
      return _gdFilaMatch(r, f.filtro) && (!vf || _gdUp(r[vf.campo])===_gdUp(vf.valor));
    });
    // filtroCampo (panel con filtro por una columna distinta al eje X, ej. un
    // pie de tipificacion por 'tipificacion' filtrable por 'linea') pisa xk
    // solo para saber QUE columna filtrar — el eje X del grafico sigue siendo xk.
    var campoFiltro = (extra && extra.filtroCampo) || xk;
    if(extra && extra.categorias) filas = gdFiltrarFilasCategorias(filas, campoFiltro, extra.categorias);
    if(extra && (extra.desde || extra.hasta)) filas = gdFiltrarFilasRangoFechas(filas, extra.desde, extra.hasta);
    var esFecha = xk === 'fecha';
    if(esFecha) filas = filas.slice().sort(function(a,b){ return String(a.fecha).localeCompare(String(b.fecha)); });
    return {
      labels: filas.map(function(r){ return esFecha ? _gdDiaLbl(r[xk]) : r[xk]; }),
      values: filas.map(function(r){ return _gdEvalCampo(r, f); })
    };
  }

  if(f.modo === 'agregado'){
    var c3 = _gdCargaMes(f.s);
    var rows = (c3 ? c3.filas || [] : []).filter(function(r){
      return _gdFilaMatch(r, f.filtro) && (!vf || _gdUp(r[vf.campo])===_gdUp(vf.valor));
    });
    var total = 0, count = 0;
    rows.forEach(function(r){ (f.campos || [f.campo]).forEach(function(k){ total += _gdNum(r[k]); count++; }); });
    return { scalar: f.op === 'promedio' ? (count ? total/count : 0) : total };
  }

  // Suma de un campo across TODAS las cargas del año (gdCargasDelAnio) — KPI
  // anual con texto (ej. "Efectividad del año" de ordenamiento medico 3P).
  if(f.modo === 'anual'){
    var cAct = _gdCargaMes(f.s);
    var anioK = gdAnioDeMes(_gd.mesSel || (cAct ? cAct.periodo : null));
    var cargasK = gdCargasDelAnio(_gdSeccionCargas(f.s), anioK);
    var totalK = 0;
    cargasK.forEach(function(c){
      (c.filas||[]).filter(function(r){ return _gdFilaMatch(r, f.filtro) && (!vf || _gdUp(r[vf.campo])===_gdUp(vf.valor)); })
        .forEach(function(r){ totalK += _gdEvalCampo(r, f) || 0; });
    });
    return { scalar: cargasK.length ? totalK : null };
  }

  // AHT real de Trafico de Llamadas (Wolkvox) para el mes seleccionado
  // (`_gd.mesSel`, o el mes mas reciente con datos si no hay ninguno
  // elegido) -- Fase 65: reemplaza el dato manual de Gestion de base
  // (`aht_segundos`) en 6 clientes, para que la tarjeta "AHT Promedio" de
  // la franja global sea la MISMA fuente y formula que la sub-pestaña
  // "AHT" del panel de Trafico (traficoAhtPromedioPeriodo,
  // trafico-logic.js). `_trafico[f.campana]` lo precarga _gdBootstrap
  // (mismo patron que ya usa loadCalData para Calidad) antes de llamar a
  // renderGenericKpis, asi que estos datos ya estan en cache para cuando
  // se llega aqui. Sin datos de Wolkvox para el mes -> scalar:null, que
  // ya renderiza como "—" (_gdKpiCardHtml), nunca un 0 que parezca real.
  if(f.modo === 'trafico_aht'){
    var campanaAht = f.campana || _gd.cliente;
    var datosAht = (typeof _trafico !== 'undefined' && _trafico[campanaAht]) ? _trafico[campanaAht] : null;
    if(!datosAht || !datosAht.filas || !datosAht.filas.length) return { scalar: null };
    var mesesAht = datosAht.filas.map(function(r){ return String(r.fecha).slice(0,7); });
    var mesTopeAht = _gd.mesSel || mesesAht.slice().sort().reverse()[0];
    if(!mesTopeAht) return { scalar: null };
    var filasMesAht = (typeof traficoFiltrarFilas === 'function')
      ? traficoFiltrarFilas(datosAht.filas, { desde: mesTopeAht + '-01', hasta: mesTopeAht + '-31' })
      : [];
    return { scalar: (typeof traficoAhtPromedioPeriodo === 'function') ? traficoAhtPromedioPeriodo(filasMesAht) : null };
  }

  return { scalar: null };
}

// ── Preferencia de visualizacion por usuario (no altera la config del admin) ──
// Cada visor puede cambiar el tipo de grafico de un panel para SU vista.
// Se guarda por cliente en localStorage; los demas siguen viendo la config real.
function _gdPrefsKey(){ return 'gdprefs:' + (_gd.cliente || ''); }
function _gdPrefs(){
  try{ return JSON.parse(localStorage.getItem(_gdPrefsKey()) || '{}') || {}; }catch(e){ return {}; }
}
function _gdSetPref(panelKey, tipo){
  var p = _gdPrefs();
  if(tipo) p[panelKey] = tipo; else delete p[panelKey];
  try{ localStorage.setItem(_gdPrefsKey(), JSON.stringify(p)); }catch(e){}
}
function _gdPanelKey(i){ return _gd.tab + '|' + i; }
// Tipo efectivo de un panel: preferencia del visor si existe, si no la de la config.
function _gdPanelTipo(p, i){
  var pref = _gdPrefs()[_gdPanelKey(i)];
  var permitidos = { line:1, bar:1, area:1 };
  if(pref && permitidos[pref]) return pref;
  return p.tipo;
}
function _gdCyclePanelTipo(i, tipo){
  _gdSetPref(_gdPanelKey(i), tipo);
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  if(tab) _gdRenderPanel(tab.panels[i], i);
  // refrescar los botones activos
  var tools = document.querySelector('#gd-c' + i);
  if(tools){
    var card = tools.closest('.aurora-card');
    if(card) card.querySelectorAll('.gd-panel-tools button').forEach(function(b){
      b.classList.toggle('on', b.dataset.t === tipo);
    });
  }
}

// ── Filtro por panel (categorias o rango de fechas) — Gestion de base ──
// Extiende de forma consistente el patron combinable de Trafico de Llamadas
// (skill + Desde/Hasta) a los pie/bar/line que leen filas de un Excel
// (modo:'filas'): pie/bar sobre un campo categorico -> filtro de que
// categorias incluir; line sobre 'fecha' -> filtro Desde/Hasta. Nunca se
// inventa un filtro sobre un panel que no usa modo:'filas' (series
// mensuales, KPIs escalares, combos de 2 barras fijas quedan intactos).
var _gdCatFiltro = {};    // por 'tab|indice': { incluidas:[...] }
var _gdFechaFiltro = {};  // por 'tab|indice': { desde, hasta }
var _gdSerieFiltro = {};  // por 'tab|indice': { label } — panel con filtroSerie:true
var _gdUnicoFiltro = {};  // por 'tab|indice': { valor } — panel con filtroCampo + filtroUnico:true

// 'categoria' | 'fecha' | 'serie' | 'unico' | null, segun el panel.
//  - p.filtroSerie (panel line/bar con >1 serie): 'serie' — un selector que
//    elige CUAL serie dibujar (ej. Salida: Linea General / Linea 3P), en vez
//    de mostrarlas todas juntas.
//  - p.filtroCampo + p.filtroUnico (pie/line sobre modo:'filas'): 'unico' —
//    un selector de UN SOLO valor de esa columna a la vez (ej. pie de
//    Tipificacion, x:'tipificacion', UNA linea 3P/General a la vez) — evita
//    que la misma categoria aparezca duplicada en la leyenda cuando ambas
//    lineas comparten nombres (el bug que este tipo corrige).
//  - p.filtroCampo sin filtroUnico: 'categoria' (multi-select, filtrando por
//    esa columna en vez del eje X del grafico) — se mantiene para paneles
//    que de verdad quieran combinar varios valores a la vez.
//  - si no, el criterio de siempre: x==='fecha' -> 'fecha', si no 'categoria'.
function _gdPanelFiltroTipo(p){
  if(p.filtroSerie && p.series && p.series.length > 1) return 'serie';
  var f = p.tipo === 'pie' ? p.fuente : (p.series && p.series[0] && p.series[0].fuente);
  // f.anual (agregado multi-periodo, ver _gdResolver) no soporta el filtro
  // de categorias de `extra` -- no se dibuja una barra de filtro que no
  // haria nada.
  if(!f || f.modo !== 'filas' || f.anual) return null;
  if(p.filtroCampo && p.filtroUnico) return 'unico';
  if(p.filtroCampo) return 'categoria';
  var xk = f.x || (p.tipo === 'pie' ? 'categoria' : 'fecha');
  return xk === 'fecha' ? 'fecha' : 'categoria';
}
function _gdPanelFuentes(p){
  if(p.tipo === 'pie') return p.fuente ? [p.fuente] : [];
  return (p.series||[]).map(function(s){ return s.fuente; }).filter(Boolean);
}
function _gdFilasBaseParaFiltro(p){
  var f = _gdPanelFuentes(p)[0];
  if(!f) return { filas: [], campo: 'categoria' };
  var carga = _gdCargaMes(f.s);
  var vf = _gdVistaFiltro();
  var filas = (carga ? carga.filas||[] : []).filter(function(r){
    return _gdFilaMatch(r, f.filtro) && (!vf || _gdUp(r[vf.campo])===_gdUp(vf.valor));
  });
  return { filas: filas, campo: p.filtroCampo || f.x || 'categoria' };
}
function _gdRenderFiltroBar(p, i, tipo){
  var host = document.getElementById('gd-f'+i);
  if(!host) return;
  var key = _gdPanelKey(i);

  if(tipo === 'serie'){
    var estadoS = _gdSerieFiltro[key] || {};
    var actual = gdSerieSeleccionada(p.series, estadoS.label);
    host.innerHTML = '<div class="gd-panel-filtro">' +
      '<div><label>Linea</label><select id="gd-serief-'+i+'">' +
        p.series.map(function(s){ return '<option value="'+esc(s.label)+'"'+(actual && actual.label===s.label?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('') +
      '</select></div>' +
      '<button class="btn-sm" onclick="_gdAplicarFiltroPanel('+i+')">Aplicar</button>' +
    '</div>';
    return;
  }

  var base = _gdFilasBaseParaFiltro(p);

  if(tipo === 'unico'){
    var disponiblesU = gdValoresDistintos(base.filas, base.campo);
    var actualU = gdValorFiltroUnico(disponiblesU, (_gdUnicoFiltro[key]||{}).valor);
    host.innerHTML = '<div class="gd-panel-filtro">' +
      '<div><label>Linea</label><select id="gd-unicof-'+i+'">' +
        disponiblesU.map(function(v){ return '<option value="'+esc(v)+'"'+(v===actualU?' selected':'')+'>'+esc(v)+'</option>'; }).join('') +
      '</select></div>' +
      '<button class="btn-sm" onclick="_gdAplicarFiltroPanel('+i+')">Aplicar</button>' +
    '</div>';
    return;
  }

  if(tipo === 'categoria'){
    var disponibles = gdValoresDistintos(base.filas, base.campo);
    var estado = _gdCatFiltro[key] || {};
    var incluidas = (estado.incluidas && estado.incluidas.length) ? estado.incluidas : disponibles;
    host.innerHTML = '<div class="gd-panel-filtro">' +
      '<div><label>Categorias</label><select multiple id="gd-catf-'+i+'" size="'+Math.min(5, Math.max(2, disponibles.length))+'">' +
        disponibles.map(function(v){ return '<option value="'+esc(v)+'"'+(incluidas.indexOf(v)!==-1?' selected':'')+'>'+esc(v)+'</option>'; }).join('') +
      '</select></div>' +
      '<button class="btn-sm" onclick="_gdAplicarFiltroPanel('+i+')">Aplicar</button>' +
    '</div>';
    return;
  }

  // 'fecha'
  var fechas = base.filas.map(function(r){ return r.fecha; }).filter(Boolean).sort();
  var minF = fechas[0] || '', maxF = fechas[fechas.length-1] || '';
  var estadoF = _gdFechaFiltro[key] || {};
  var desde = estadoF.desde || minF, hasta = estadoF.hasta || maxF;
  host.innerHTML = '<div class="gd-panel-filtro">' +
    '<div><label>Desde</label><input type="date" id="gd-fechaf-desde-'+i+'" value="'+esc(desde)+'" min="'+esc(minF)+'" max="'+esc(maxF)+'"></div>' +
    '<div><label>Hasta</label><input type="date" id="gd-fechaf-hasta-'+i+'" value="'+esc(hasta)+'" min="'+esc(minF)+'" max="'+esc(maxF)+'"></div>' +
    '<button class="btn-sm" onclick="_gdAplicarFiltroPanel('+i+')">Aplicar</button>' +
  '</div>';
}
function _gdExtraFiltroPanel(p, i){
  var tipo = _gdPanelFiltroTipo(p);
  if(tipo === 'unico'){
    var baseU = _gdFilasBaseParaFiltro(p);
    var disponiblesU = gdValoresDistintos(baseU.filas, baseU.campo);
    var valorU = gdValorFiltroUnico(disponiblesU, (_gdUnicoFiltro[_gdPanelKey(i)]||{}).valor);
    return { categorias: valorU ? [valorU] : [], filtroCampo: p.filtroCampo };
  }
  if(tipo === 'categoria') return { categorias: (_gdCatFiltro[_gdPanelKey(i)]||{}).incluidas, filtroCampo: p.filtroCampo };
  if(tipo === 'fecha') return _gdFechaFiltro[_gdPanelKey(i)] || {};
  return null;
}
function _gdAplicarFiltroPanel(i){
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  if(!tab) return;
  var p = tab.panels[i];
  var tipo = _gdPanelFiltroTipo(p);
  var key = _gdPanelKey(i);
  if(tipo === 'unico'){
    var selU = document.getElementById('gd-unicof-'+i);
    _gdUnicoFiltro[key] = { valor: selU ? selU.value : '' };
  } else if(tipo === 'categoria'){
    var sel = document.getElementById('gd-catf-'+i);
    var incluidas = sel ? Array.prototype.filter.call(sel.options, function(o){ return o.selected; }).map(function(o){ return o.value; }) : [];
    _gdCatFiltro[key] = { incluidas: incluidas };
  } else if(tipo === 'fecha'){
    var d = document.getElementById('gd-fechaf-desde-'+i);
    var h = document.getElementById('gd-fechaf-hasta-'+i);
    _gdFechaFiltro[key] = { desde: d ? d.value : '', hasta: h ? h.value : '' };
  } else if(tipo === 'serie'){
    var selS = document.getElementById('gd-serief-'+i);
    _gdSerieFiltro[key] = { label: selS ? selS.value : '' };
  }
  _gdRenderPanel(p, i);
}

// ── Analisis: valor del periodo de comparacion (periodo anterior o el elegido) ──
// Para una fuente 'ultimo', devuelve el escalar del periodo con el que se compara:
//   - si el usuario eligio "Comparar contra", ese periodo exacto (o el ultimo <=).
//   - si no, el periodo inmediatamente anterior al que se esta viendo.
function _gdResolverComp(f){
  if(!f || f.modo !== 'ultimo') return { scalar: null, periodo: null };
  var actual = _gdCargaMes(f.s);
  if(!actual) return { scalar: null, periodo: null };
  var arr = _gdSeccionCargas(f.s).slice().sort(function(a,b){ return b.periodo.localeCompare(a.periodo); });
  var prev;
  if(_gd.compSel){
    prev = arr.filter(function(c){ return c.periodo <= _gd.compSel && c.periodo !== actual.periodo; })[0];
  }
  if(!prev){
    prev = arr.filter(function(c){ return c.periodo < actual.periodo; })[0];
  }
  return prev ? { scalar: _gdEvalCampo(_gdPickFila(prev.filas), f), periodo: prev.periodo } : { scalar: null, periodo: null };
}

// Variacion absoluta y % entre el valor actual y el de comparacion.
function _gdVariacion(cur, prev){
  if(cur === null || cur === undefined || prev === null || prev === undefined) return null;
  var abs = cur - prev;
  var pct = prev === 0 ? null : Math.round((abs / Math.abs(prev)) * 1000) / 10;
  return { abs: abs, pct: pct, sube: abs > 0, baja: abs < 0, plano: abs === 0 };
}

// Meta objetivo de un KPI: numero fijo, o una fuente { s, campo, modo }.
function _gdMetaValor(k){
  if(k.meta === null || k.meta === undefined) return null;
  if(typeof k.meta === 'number') return k.meta;
  var r = _gdResolver(k.meta);
  return r.scalar;
}

// ¿El valor esta fuera del rango esperado? k.alerta = { min?, max?, caidaPct? }
function _gdFueraDeRango(cur, prev, k){
  var a = k.alerta;
  if(!a || cur === null || cur === undefined) return false;
  if(a.min !== undefined && a.min !== null && cur < a.min) return true;
  if(a.max !== undefined && a.max !== null && cur > a.max) return true;
  if(a.caidaPct !== undefined && a.caidaPct !== null && prev !== null && prev !== undefined && prev > 0){
    if(((prev - cur) / prev) * 100 >= a.caidaPct) return true;
  }
  return false;
}

// HTML de una tarjeta KPI "de BI": valor grande, tendencia vs comparacion,
// avance de meta y borde de alerta si esta fuera de rango.
function _gdKpiCardHtml(k){
  var cur = _gdResolver(k.fuente).scalar;
  var comp = _gdResolverComp(k.fuente);
  var prev = comp.scalar;
  var vari = _gdVariacion(cur, prev);
  var meta = _gdMetaValor(k);
  var alerta = _gdFueraDeRango(cur, prev, k);
  var mejorBaja = k.mejorDireccion === 'baja'; // para % inasistencia, abandono, costo…

  var txt = (cur === null || cur === undefined) ? '—' : _gdFmt(cur, k.formato);
  var semColor = _gdSemaforoColor(cur, k);
  var cls, semBadge = '';
  if(semColor){
    cls = _gdSemaforoClase(semColor);
    semBadge = (typeof semaforoBadgeHtml === 'function') ? semaforoBadgeHtml(semColor) : '';
  } else if(k.semaforo && cur !== null && cur !== undefined){
    // Compatibilidad: KPI con el semaforo binario viejo (un solo umbral
    // quemado en la config) y sin fila en umbrales_semaforo todavia.
    var binOk = _gdNum(cur) >= k.semaforo;
    cls = binOk ? 'kpi-green' : 'kpi-red';
    semBadge = (typeof semaforoBadgeHtml === 'function') ? semaforoBadgeHtml(binOk ? 'verde' : 'rojo') : '';
  } else {
    cls = k.cls || '';
  }

  var trendHtml = '';
  if(vari){
    var bueno = vari.plano ? null : (mejorBaja ? vari.baja : vari.sube);
    var tcls = vari.plano ? 'gd-tr-flat' : (bueno ? 'gd-tr-up' : 'gd-tr-down');
    var arrow = vari.plano ? '→' : (vari.sube ? '▲' : '▼');
    var pctTxt = vari.pct === null ? '' : (vari.pct > 0 ? '+' : '') + vari.pct + '%';
    var absTxt = _gdFmt(Math.abs(vari.abs), k.formato);
    trendHtml = '<div class="gd-kpi-trend ' + tcls + '">' + arrow + ' ' + (pctTxt ? pctTxt + ' ' : '') +
      '<span>(' + (vari.abs >= 0 ? '+' : '-') + absTxt + ') vs ' + (comp.periodo ? _gdMesLbl(comp.periodo) : 'periodo anterior') + '</span></div>';
  }

  var metaHtml = '';
  var av = gdPorcentajeMeta(cur, meta);
  if(av !== null){
    var avColor = _gdSemaforoColor(av, { metrica: 'cumplimiento_meta' });
    var mcls = avColor==='verde' ? 'gd-meta-ok' : avColor==='amarillo' ? 'gd-meta-warn' : avColor==='rojo' ? 'gd-meta-bad'
      : (av >= 100 ? 'gd-meta-ok' : (av >= 80 ? 'gd-meta-warn' : 'gd-meta-bad')); // sin umbral configurado: mismo default de siempre
    metaHtml = '<div class="gd-kpi-meta ' + mcls + '"><span class="gd-meta-bar"><i style="width:' +
      Math.max(0, Math.min(100, av)) + '%"></i></span>' + av + '% de la meta (' + _gdFmt(meta, k.formato) + ')</div>';
  }

  return '<div class="aurora-kpi gd-kpi ' + cls + (alerta ? ' gd-kpi-alerta' : '') + '">' +
    (alerta ? '<div class="gd-kpi-flag" title="Valor fuera del rango esperado">⚠</div>' : '') +
    '<div class="kv">' + semBadge + txt + '</div><div class="kl">' + esc(k.titulo) + '</div>' +
    trendHtml + metaHtml + '</div>';
}

// ── Chart helpers (reutiliza lo/loBar/loPie/paleta de charts.js) ──
function _gdChart(canvasId, cfg){
  var el = document.getElementById(canvasId);
  if(!el) return;
  if(_gd.charts[canvasId]){ try{ _gd.charts[canvasId].destroy(); }catch(e){} delete _gd.charts[canvasId]; }
  var empty = gdGraficaEstaVacia(cfg);
  // Fase 90 (hallazgo real: la pastilla de Nivel de Servicio de WhatsApp
  // quedaba en blanco, sin ningun mensaje, cuando su unica serie no tenia
  // dato para el periodo). Causa: este aviso solo se insertaba dentro de
  // un ancestro .aurora-card -- las sub-pestanas de Trafico (Resumen
  // aparte, Abandono/AHT/ASA y ATA/Nivel de Servicio, Fase 68) NUNCA
  // envuelven su canvas en .aurora-card (solo un titulo + .aurora-chart-
  // wrap), asi que el aviso nunca se insertaba y el area quedaba vacia.
  // Ahora cae al contenedor mas cercano que exista: .aurora-card si esta,
  // si no .aurora-chart-wrap (el padre directo del canvas, SIEMPRE
  // presente), si no el padre directo tal cual -- nunca queda sin donde
  // insertar el aviso.
  var contenedor = (el.closest && (el.closest('.aurora-card') || el.closest('.aurora-chart-wrap'))) || el.parentElement;
  var note = contenedor ? contenedor.querySelector('.oc-nodata') : null;
  if(empty){
    el.style.display = 'none';
    if(contenedor && !note){
      note = document.createElement('div');
      note.className = 'oc-nodata';
      note.style.cssText = 'text-align:center;color:var(--c-text-muted);font-size:0.8rem;padding:24px 8px';
      note.textContent = 'Sin datos cargados para este periodo';
      contenedor.appendChild(note);
    }
    return;
  }
  if(note) note.remove();
  el.style.display = '';
  _gd.charts[canvasId] = new Chart(el, cfg);
  if(typeof gdEtiquetarCanvasChart === 'function') gdEtiquetarCanvasChart(_gd.charts[canvasId]);
}

// ── Apertura ────────────────────────────────────────────────
// Fase 105 (hallazgo real de la verificacion final en produccion de la
// Fase 104, con un Chrome real -- en headless nunca aparecio): mientras
// #gd-modal esta abierto, la pagina de FONDO (detras del overlay, nunca
// visible) seguia pudiendo tener su propia barra de scroll vertical si su
// contenido era mas alto que el viewport. Un Chrome real reserva el ancho
// de esa barra al calcular `100vw`/`100%` del arbol completo -- el modal
// (ahora a pantalla completa, Fase 103) quedaba sistematicamente ~15px
// mas angosto que el viewport real, en toda resolucion/tema. Bloquear el
// scroll de `html`/`body` mientras el modal esta abierto (estandar para
// cualquier modal a pantalla completa: nada detras deberia poder
// scrollear de todos modos) elimina esa barra de raiz -- el modal usa su
// PROPIO scroll interno (`#gd-modal{overflow-y:auto}`), nunca el de la
// pagina de fondo.
function _gdBloquearScrollFondo(bloquear){
  document.documentElement.style.overflow = bloquear ? 'hidden' : '';
  document.body.style.overflow = bloquear ? 'hidden' : '';
}

async function openGenericDashboard(cliente){
  _gdBloquearScrollFondo(true);
  document.getElementById('gd-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('gd-modal');
  document.getElementById('gd-title').textContent = 'Cargando…';
  document.getElementById('gd-kpis').innerHTML = '';
  document.getElementById('gd-tabs').innerHTML = '';
  document.getElementById('gd-panels').innerHTML = '';
  try{
    var resp = await apiRequest('GET','/dashboard/'+encodeURIComponent(cliente));
    _gd.cliente = cliente;
    _gd.config = resp.config;
    _gd.cargas = resp.secciones || {};
  }catch(e){
    document.getElementById('gd-title').textContent = 'Dashboard';
    showToast('No se pudo abrir el dashboard: '+e.message);
    return;
  }
  await _gdBootstrap();
}

// Previsualizacion desde el constructor: usa una config en memoria (sin guardar)
// y, si el cliente ya existe, sus cargas reales; si no, se ve la estructura vacia.
async function openGenericDashboardPreview(config){
  _gdBloquearScrollFondo(true);
  document.getElementById('gd-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('gd-modal');
  document.getElementById('gd-kpis').innerHTML = '';
  document.getElementById('gd-tabs').innerHTML = '';
  document.getElementById('gd-panels').innerHTML = '';
  _gd.cliente = config.cliente;
  _gd.config = config;
  _gd.cargas = {};
  try{
    var resp = await apiRequest('GET','/dashboard/'+encodeURIComponent(config.cliente));
    _gd.cargas = resp.secciones || {};
  }catch(e){ _gd.cargas = {}; }
  await _gdBootstrap();
}

async function _gdBootstrap(){
  _gd.compSel = '';
  _gd.vistaSel = (_gd.config.vista && _gd.config.vista.opciones[0] && _gd.config.vista.opciones[0].valor) || '';

  // Fase 90 (tema B, hallazgo real en produccion: el selector "MES" de
  // arriba solo miraba dashboard_cargas -- Agendas/Tipificacion/Trafico
  // Llamadas/Trafico WhatsApp/Calidad viven en sus PROPIAS tablas, nunca
  // ahi. El resultado: la lista de meses podia faltarle meses enteros, y
  // el mes por defecto podia caer en uno que ni siquiera fuera una opcion
  // del selector (ORLANT abria en "Sep-26" con el selector en blanco y la
  // UNICA opcion real era "Ago-26"). Ahora se detectan las campanas de
  // CADA tipo de panel presentes en la config de este cliente (nunca
  // hardcodeado a un cliente puntual) y se junta la lista de TODAS las
  // fuentes de datos mensuales.
  var campanasCalidad = {}, campanasTraficoLlamadas = {}, campanasTraficoWpp = {}, campanasAgendas = {}, campanasEfectividadAgendamiento = {}, campanasInasistencia = {}, campanasEfectividadCitas = {}, campanasTipificacion = {}, campanasSalida = {}, campanasLlamadasUnicas = {};
  (_gd.config.layout.tabs || []).forEach(function(t){
    (t.panels || []).forEach(function(p){
      if(p.tipo && p.tipo.indexOf('calidad')===0 && p.campana) campanasCalidad[p.campana] = true;
      if(p.tipo === 'trafico_combo') campanasTraficoLlamadas[p.campana || _gd.cliente] = true;
      if(p.tipo === 'trafico_whatsapp_combo') campanasTraficoWpp[p.campana || _gd.cliente] = true;
      if(p.tipo === 'agendas_panel') campanasAgendas[p.campana || _gd.cliente] = true;
      if(p.tipo === 'efectividad_agendamiento_panel') campanasEfectividadAgendamiento[p.campana || _gd.cliente] = true;
      if(p.tipo === 'inasistencia_panel') campanasInasistencia[p.campana || _gd.cliente] = true;
      if(p.tipo === 'efectividad_citas_panel') campanasEfectividadCitas[p.campana || _gd.cliente] = true;
      if(p.tipo === 'tipificacion_panel') campanasTipificacion[p.campana || _gd.cliente] = true;
      if(p.tipo === 'salida_panel') campanasSalida[p.campana || _gd.cliente] = true;
      if(p.tipo === 'llamadas_unicas_panel') campanasLlamadasUnicas[p.campana || _gd.cliente] = true;
    });
  });
  // Precarga de Trafico de Llamadas para cualquier KPI de la franja global
  // que lo necesite (fuente.modo==='trafico_aht', Fase 65) -- mismo motivo
  // de siempre: la franja global se dibuja ANTES de que el usuario abra la
  // pestaña "Trafico de Llamadas".
  (_gd.config.layout.kpis || []).forEach(function(k){
    if(k.fuente && k.fuente.modo === 'trafico_aht') campanasTraficoLlamadas[k.fuente.campana || _gd.cliente] = true;
  });

  // Fase 91: las 6 fuentes de abajo (Calidad, Trafico Llamadas, Trafico
  // WhatsApp, umbrales, Agendas, Tipificacion) son independientes entre si
  // -- antes se pedian en serie (hasta ~11 idas y vueltas de red, una
  // atras de otra), lo que ademas de ser mas lento dejaba mas tiempo
  // muerto en el que un solo fetch lento podia hacer sentir el resto como
  // "colgado". Ahora se disparan todas a la vez y se espera el conjunto
  // con Promise.all -- cada tarea sigue con su propio try/catch (un fallo
  // en una fuente no debe tumbar a las demas), y los efectos sobre
  // mesesAgendas/mesesTipificacion/tabs.oculta son seguros en paralelo
  // porque JS es de un solo hilo (nunca hay dos tareas escribiendo a la
  // vez, solo turnos intercalados en cada await).
  var mesesAgendas = [], mesesEfectividadAgendamiento = [], mesesInasistencia = [], mesesEfectividadCitas = [], mesesTipificacion = [], mesesSalida = [], mesesLlamadasUnicas = [];
  var tareasBootstrap = [];

  Object.keys(campanasCalidad).forEach(function(camp){
    tareasBootstrap.push((async function(){ try{ await loadCalData(camp); }catch(e){} })());
  });
  Object.keys(campanasTraficoLlamadas).forEach(function(campT){
    tareasBootstrap.push((async function(){ try{ if(typeof _traficoCargarDatos === 'function') await _traficoCargarDatos(campT); }catch(e){} })());
  });
  Object.keys(campanasTraficoWpp).forEach(function(campW){
    tareasBootstrap.push((async function(){ try{ if(typeof _traficoWppCargarDatos === 'function') await _traficoWppCargarDatos(campW); }catch(e){} })());
  });
  tareasBootstrap.push(_gdCargarUmbrales());
  // Fase 131 (Parte 4, pedido explicito): "Ultima actualizacion" = la
  // carga mas reciente de ESTE cliente, en cualquiera de sus fuentes de
  // datos reales -- independiente del resto (un fallo aqui nunca debe
  // tumbar el resto del dashboard).
  _gd.ultimaActualizacion = null;
  tareasBootstrap.push((async function(){
    try{ _gd.ultimaActualizacion = await apiRequest('GET', '/dashboard/ultima-actualizacion?campana='+encodeURIComponent(_gd.cliente)); }
    catch(e){ _gd.ultimaActualizacion = null; }
  })());

  // Agendas/Tipificacion: ademas de juntar sus meses (abajo), este mismo
  // GET ya destapa el tab en memoria cuando corresponde (Fases 77/78 --
  // el tab sigue oculto por defecto en la config guardada, se destapa
  // SOLO cuando ya hay datos cargados, sin escribir nunca ese cambio en
  // el servidor). Antes esto estaba hardcodeado a "ORLANT"; ahora sigue
  // las campanas que de verdad tienen ese tipo de panel (hoy, solo
  // ORLANT lo tiene -- mismo resultado, ya generico).
  Object.keys(campanasAgendas).forEach(function(campAg){
    tareasBootstrap.push((async function(){
      try{
        var agendasOp = await apiRequest('GET', '/calidad/agendas/opciones?campana='+encodeURIComponent(campAg));
        if(agendasOp && agendasOp.meses) mesesAgendas = mesesAgendas.concat(agendasOp.meses);
        if(campAg === _gd.cliente && agendasOp && agendasOp.meses && agendasOp.meses.length){
          var tabAgendamiento = (_gd.config.layout.tabs || []).find(function(t){ return t.key === 'agendamiento'; });
          if(tabAgendamiento) tabAgendamiento.oculta = false;
        }
      }catch(e){ /* se queda oculta / sin esos meses */ }
    })());
  });
  // Fase 111 (pedido textual de Edwin): "Ranking de Asesores" vive en el
  // MISMO tab "agendamiento" (su visibilidad ya la destapan los paneles
  // agendas_panel de arriba) -- aqui solo se juntan SUS PROPIOS meses
  // (tabla efectividad_agendamiento) al selector global de Mes, nunca al
  // mes POR DEFECTO (mesesPrincipales, mas abajo, no cambia).
  Object.keys(campanasEfectividadAgendamiento).forEach(function(campEa){
    tareasBootstrap.push((async function(){
      try{
        var eaOp = await apiRequest('GET', '/calidad/efectividad-agendamiento/opciones?campana='+encodeURIComponent(campEa));
        if(eaOp && eaOp.meses) mesesEfectividadAgendamiento = mesesEfectividadAgendamiento.concat(eaOp.meses);
      }catch(e){ /* sin datos o sin acceso -- el panel muestra su propio aviso */ }
    })());
  });
  // Fase 98 (ORLANT, pedido URGENTE de Edwin): Inasistencia sigue el MISMO
  // criterio que Agendas -- se destapa en memoria solo cuando ya hay datos
  // reales cargados (tabla `inasistencias`), nunca escribiendo ese cambio
  // en el servidor.
  Object.keys(campanasInasistencia).forEach(function(campIn){
    tareasBootstrap.push((async function(){
      try{
        var inasistOp = await apiRequest('GET', '/calidad/inasistencia/opciones?campana='+encodeURIComponent(campIn));
        if(inasistOp && inasistOp.meses) mesesInasistencia = mesesInasistencia.concat(inasistOp.meses);
        if(campIn === _gd.cliente && inasistOp && inasistOp.meses && inasistOp.meses.length){
          var tabInasistencia = (_gd.config.layout.tabs || []).find(function(t){ return t.key === 'inasistencia'; });
          if(tabInasistencia) tabInasistencia.oculta = false;
        }
      }catch(e){ /* se queda oculta / sin esos meses */ }
    })());
  });
  // Fase 111 (pedido textual de InCo): "Efectividad de Citas" sigue el
  // MISMO criterio que Agendas/Inasistencia -- se destapa en memoria solo
  // cuando ya hay datos reales cargados (tabla efectividad_citas), nunca
  // escribiendo ese cambio en el servidor.
  Object.keys(campanasEfectividadCitas).forEach(function(campEc){
    tareasBootstrap.push((async function(){
      try{
        var ecOp = await apiRequest('GET', '/calidad/efectividad-citas/opciones?campana='+encodeURIComponent(campEc));
        if(ecOp && ecOp.meses) mesesEfectividadCitas = mesesEfectividadCitas.concat(ecOp.meses);
        if(campEc === _gd.cliente && ecOp && ecOp.meses && ecOp.meses.length){
          var tabEfectividadCitas = (_gd.config.layout.tabs || []).find(function(t){ return t.key === 'efectividad'; });
          if(tabEfectividadCitas) tabEfectividadCitas.oculta = false;
        }
      }catch(e){ /* se queda oculta / sin esos meses */ }
    })());
  });
  // Fase 127 (pedido textual de Edwin): "Salida" (renombrada en la Fase 128,
  // Parte 1, a "Llamadas y WhatsApp de salida" -- el `key` interno sigue
  // siendo 'salida') sigue el MISMO criterio que Agendas/Inasistencia/
  // Efectividad de Citas -- se destapa en memoria solo cuando ya hay datos
  // reales cargados (tabla salida_mensual), nunca
  // escribiendo ese cambio en el servidor.
  Object.keys(campanasSalida).forEach(function(campSal){
    tareasBootstrap.push((async function(){
      try{
        var salOp = await apiRequest('GET', '/calidad/salida/opciones?campana='+encodeURIComponent(campSal));
        if(salOp && salOp.meses) mesesSalida = mesesSalida.concat(salOp.meses);
        if(campSal === _gd.cliente && salOp && salOp.meses && salOp.meses.length){
          var tabSalida = (_gd.config.layout.tabs || []).find(function(t){ return t.key === 'salida'; });
          if(tabSalida) tabSalida.oculta = false;
        }
      }catch(e){ /* se queda oculta / sin esos meses */ }
    })());
  });
  Object.keys(campanasTipificacion).forEach(function(campTip){
    tareasBootstrap.push((async function(){
      try{
        var tipifLlamadas = await apiRequest('GET', '/calidad/tipificacion/opciones?campana='+encodeURIComponent(campTip)+'&canal=LLAMADAS');
        var tipifWhatsapp = await apiRequest('GET', '/calidad/tipificacion/opciones?campana='+encodeURIComponent(campTip)+'&canal=WHATSAPP');
        if(tipifLlamadas && tipifLlamadas.meses) mesesTipificacion = mesesTipificacion.concat(tipifLlamadas.meses);
        if(tipifWhatsapp && tipifWhatsapp.meses) mesesTipificacion = mesesTipificacion.concat(tipifWhatsapp.meses);
        var tieneLlamadas = tipifLlamadas && tipifLlamadas.meses && tipifLlamadas.meses.length;
        var tieneWhatsapp = tipifWhatsapp && tipifWhatsapp.meses && tipifWhatsapp.meses.length;
        if(campTip === _gd.cliente && (tieneLlamadas || tieneWhatsapp)){
          var tabTipificacion = (_gd.config.layout.tabs || []).find(function(t){ return t.key === 'tipificacion'; });
          if(tabTipificacion) tabTipificacion.oculta = false;
        }
      }catch(e){ /* se queda oculta / sin esos meses */ }
    })());
  });
  // Fase 138, PR3 (Mobilize): Llamadas Unicas vive en un panel DENTRO del
  // tab "flujo" (ya siempre visible) -- a diferencia de Agendas/Tipificacion/
  // Inasistencia/Salida (tabs ocultos que se destapan solos), aqui solo hace
  // falta juntar sus meses para el selector global, nunca tocar `oculta`.
  Object.keys(campanasLlamadasUnicas).forEach(function(campLu){
    tareasBootstrap.push((async function(){
      try{
        var luOp = await apiRequest('GET', '/calidad/llamadas-unicas/opciones?campana='+encodeURIComponent(campLu));
        if(luOp && luOp.meses) mesesLlamadasUnicas = mesesLlamadasUnicas.concat(luOp.meses);
      }catch(e){ /* sin datos o sin acceso -- el panel muestra su propio aviso */ }
    })());
  });

  await Promise.all(tareasBootstrap);

  var mesesCargas = {};
  Object.keys(_gd.cargas).forEach(function(s){ (_gd.cargas[s]||[]).forEach(function(c){ mesesCargas[c.periodo] = true; }); });
  var mesesTraficoLlamadas = [];
  for(var campTr in campanasTraficoLlamadas){
    ((typeof _trafico!=='undefined' && _trafico[campTr] && _trafico[campTr].filas) || []).forEach(function(f){ mesesTraficoLlamadas.push(f.fecha); });
  }
  var mesesTraficoWpp = [];
  for(var campWp in campanasTraficoWpp){
    ((typeof _traficoWpp!=='undefined' && _traficoWpp[campWp] && _traficoWpp[campWp].filas) || []).forEach(function(f){ mesesTraficoWpp.push(f.fechaInicio); });
  }
  var mesesCalidad = [];
  for(var campCal in campanasCalidad){
    ((typeof CAL_DB!=='undefined' && CAL_DB[campCal] && CAL_DB[campCal].monitoreos) || []).forEach(function(m){ mesesCalidad.push(m.fecha); });
  }

  // Datos mensuales PRINCIPALES (pedido explicito): el mes por defecto es
  // el mas reciente con Trafico de Llamadas o Tipificacion. Si el cliente
  // no tiene ninguno de esos (ej. Aurora/HLM hoy, o un cliente sin esos 2
  // tipos de panel), cae al mes mas reciente con CUALQUIER dato -- nunca
  // un mes que no sea una opcion real del selector.
  var mesesPrincipales = gdMesesUnion([mesesTraficoLlamadas, mesesTipificacion]);
  _gd.periodos = gdMesesUnion([Object.keys(mesesCargas), mesesTraficoLlamadas, mesesTraficoWpp, mesesAgendas, mesesEfectividadAgendamiento, mesesInasistencia, mesesEfectividadCitas, mesesTipificacion, mesesCalidad, mesesSalida, mesesLlamadasUnicas]);
  _gd.mesSel = gdMesPorDefecto(mesesPrincipales, _gd.periodos);

  renderGenericHeader();
  renderGenericKpis();
  renderGenericTabs();
  var first = _gdTabsVisibles()[0];
  switchGenericTab(first ? first.key : null);
  renderGenericBanner();
}
function closeGenericDashboard(){
  // Fase 103: si se cierra el dashboard estando en pantalla completa del
  // navegador, hay que salir primero -- si no, el navegador se queda en
  // fullscreen mostrando lo que sea que quede detras (el overlay ya oculto).
  if(document.fullscreenElement) document.exitFullscreen();
  // Fase 136 (PR 8, F04): el ORDEN de lo que ya hacia esta funcion no
  // cambia -- exitFullscreen() sigue yendo primero, igual que antes. Lo
  // unico nuevo es que ocultar el overlay/destruir los charts/
  // desbloquear el scroll ahora espera a que termine la transicion de
  // salida del modal (motionCerrarModal), en vez de pasar en el mismo
  // instante del clic.
  var cerrarReal = function(){
    document.getElementById('gd-overlay').classList.remove('show');
    Object.keys(_gd.charts).forEach(function(k){ try{_gd.charts[k].destroy();}catch(e){} delete _gd.charts[k]; });
    _gdBloquearScrollFondo(false);
  };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('gd-modal', cerrarReal);
  else cerrarReal();
}
document.getElementById('gd-overlay').addEventListener('click',function(e){ if(e.target===this) closeGenericDashboard(); });

// ── Pantalla completa del navegador (Fase 103, pedido de InCo) ──────────
// Boton opcional en la cabecera del dashboard de cliente: usa la Fullscreen
// API sobre document.documentElement (TODA la pagina, no solo #gd-overlay).
// Hallazgo real probando con Playwright: el menu de "Exportar"
// (#gd-export-menu, ver _gdExport() mas abajo) se agrega como hijo directo
// de <body>, fuera del subarbol de #gd-overlay -- cuando el elemento en
// fullscreen es #gd-overlay (no la pagina completa), el navegador solo
// pinta ESE subarbol en la "top layer" de fullscreen, y cualquier otra cosa
// colgada directo de <body> (el menu de Exportar, un toast, etc.) deja de
// ser clickeable aunque siga "visible" (los clics los recibe lo que SI esta
// en el subarbol fullscreen, como la cabecera). Fullscreen sobre la pagina
// COMPLETA evita este problema de raiz: no hay ningun elemento que quede
// "afuera". Si el navegador no soporta la API (ej. iOS Safari, que no la
// implementa para iPhone), el boton se queda oculto -- `.hidden` ya viene
// puesto en el HTML por defecto.
var GD_FS_ICON_ENTRAR = '⛶', GD_FS_ICON_SALIR = '🗗';
(function(){
  var btn = document.getElementById('gd-fullscreen-btn');
  if(!btn) return;
  var soportado = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  btn.classList.toggle('hidden', !soportado);
})();

function toggleGdFullscreen(){
  var el = document.documentElement;
  if(!document.fullscreenElement){
    var pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if(pedir) pedir.call(el).catch(function(e){ showToast('No se pudo activar pantalla completa: '+e.message); });
  }else{
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
}

// Cubre tambien el Esc del navegador (dispara este mismo evento) -- el
// icono y el estado quedan consistentes sin importar como se salio.
function _gdOnFullscreenChange(){
  var btn = document.getElementById('gd-fullscreen-btn');
  if(!btn) return;
  var activo = document.fullscreenElement === document.documentElement;
  btn.innerHTML = activo ? GD_FS_ICON_SALIR : GD_FS_ICON_ENTRAR;
  btn.title = btn.ariaLabel = activo ? 'Salir de pantalla completa' : 'Pantalla completa';
}
document.addEventListener('fullscreenchange', _gdOnFullscreenChange);
document.addEventListener('webkitfullscreenchange', _gdOnFullscreenChange);

function renderGenericHeader(){
  // Fase 132 (Parte 8): logo de Mobilize en el encabezado -- unica
  // version (clara, para fondo oscuro) porque .aurora-header es SIEMPRE
  // var(--c-brand) (teal fijo, no cambia con el tema). Provisional: ver
  // docs/pendientes.md (falta el original en alta resolucion de Edwin).
  var elLogo = document.getElementById('gd-cliente-logo');
  if(elLogo){
    if(_gd.cliente === 'MOBILIZE'){
      elLogo.src = 'img/clientes/mobilize-logo.png';
      elLogo.srcset = 'img/clientes/mobilize-logo.png 1x, img/clientes/mobilize-logo@2x.png 2x';
      elLogo.alt = 'Mobilize';
      elLogo.width = 140; elLogo.height = 25;
      elLogo.style.display = '';
    } else if(_gd.cliente === 'ORLANT'){
      // Fase 138 (PR1): logo blanco de Orlant -- provisional (ver
      // docs/marca.md), mismo alto que el de Mobilize (25px/50px a 2x),
      // ancho segun su propia relacion de aspecto para no deformarlo.
      // width/height explicitos para que no haya salto de layout mientras
      // carga (igual que Mobilize, arriba).
      elLogo.src = 'img/clientes/orlant-logo-blanco.png';
      elLogo.srcset = 'img/clientes/orlant-logo-blanco.png 1x, img/clientes/orlant-logo-blanco@2x.png 2x';
      elLogo.alt = 'Orlant';
      elLogo.width = 64; elLogo.height = 25;
      elLogo.style.display = '';
    } else {
      elLogo.style.display = 'none';
      elLogo.removeAttribute('src');
      elLogo.removeAttribute('srcset');
      elLogo.alt = '';
    }
  }
  document.getElementById('gd-title').textContent = _gd.config.titulo || _gd.cliente;
  var sub = document.getElementById('gd-sub');
  // Fase 122 (pedido de Edwin: "con la fecha uno se enreda mucho, que salga
  // el nombre"): el selector de mes GLOBAL (y este subtitulo) muestran el
  // nombre completo del mes -- distinto del rotulo corto que siguen usando
  // los EJES de las graficas de tendencia de 12 meses (_gdResolver modo
  // 'serie', mas abajo en este archivo: Trafico/Calidad), que nunca pasan
  // por mesNombreLargo.
  var mesLbl = _gd.mesSel ? mesNombreLargo(_gd.mesSel) : (_gd.periodos[0] ? mesNombreLargo(_gd.periodos[0]) : 'Sin datos');
  sub.textContent = 'Informe ' + mesLbl + ' — ' + _gd.cliente;

  // Fase 131 (Parte 4): "Ultima actualizacion" -- resaltado naranja para
  // Mobilize, verde InConexion (#74B859, color de marca) para el resto.
  // Oculto si el cliente todavia no tiene ninguna carga real (nunca
  // inventa una fecha ni muestra un estado vacio confuso).
  var elUa = document.getElementById('gd-ultima-act');
  var fechaUa = _gd.ultimaActualizacion && _gd.ultimaActualizacion.fechaColombia;
  if(fechaUa){
    elUa.textContent = 'Última actualización: ' + fechaUa.slice(0, 16); // sin segundos
    elUa.className = 'gd-ultima-act' + (_gd.cliente === 'MOBILIZE' ? ' gd-ultima-act-mobilize' : '');
    elUa.style.display = '';
  } else {
    elUa.style.display = 'none';
  }

  var vw = document.getElementById('gd-vista-wrap');
  if(_gd.config.vista){
    vw.style.display = '';
    document.getElementById('gd-vista-label').textContent = (_gd.config.vista.label || 'Vista').toUpperCase() + ':';
    var vs = document.getElementById('gd-vista-sel');
    vs.innerHTML = _gd.config.vista.opciones.map(function(o){ return '<option value="'+esc(o.valor)+'">'+esc(o.label)+'</option>'; }).join('');
    vs.value = _gd.vistaSel;
  } else { vw.style.display = 'none'; }

  var ms = document.getElementById('gd-mes-sel');
  ms.innerHTML = _gd.periodos.length
    ? _gd.periodos.map(function(p){ return '<option value="'+p+'">'+mesNombreLargo(p)+'</option>'; }).join('')
    : '<option value="">Sin datos</option>';
  ms.value = _gd.mesSel || (_gd.periodos[0] || '');

  // "Comparar contra": periodo anterior automatico + cualquier periodo previo.
  var cs = document.getElementById('gd-comp-sel');
  if(cs){
    var verMes = ms.value;
    var previos = _gd.periodos.filter(function(p){ return !verMes || p < verMes; });
    cs.innerHTML = '<option value="">Período anterior (auto)</option>' +
      previos.map(function(p){ return '<option value="'+p+'">'+mesNombreLargo(p)+'</option>'; }).join('');
    cs.value = _gd.compSel && previos.indexOf(_gd.compSel) !== -1 ? _gd.compSel : '';
    if(cs.value !== _gd.compSel) _gd.compSel = cs.value;
  }
  _gdActualizarCompararContra();
}

// Fase 86 (tema 3): "Comparar contra" (periodo anterior) solo tiene
// sentido para los paneles de RESUMEN (kpi_row/line/bar/pie/combo/tabla/
// nota_kpi -- todos leen _gdResolverComp), nunca para los 5 paneles
// autonomos (Trafico Llamadas/WhatsApp, Agendas, Tipificacion, Calidad):
// esos tienen su PROPIA ventana de tiempo (ahora sincronizada con el MES
// de arriba, tema 3) y ninguno calcula un "periodo anterior" -- mostrar el
// selector ahi confundiria (pareceria que hace algo y no hace nada). Si la
// pestana/sub-pestana activa es TODA de paneles autonomos (GD_TIPOS_AUTONOMOS,
// mes-global-logic.js), se esconde el selector y se muestra una nota
// discreta en su lugar; si mezcla paneles autonomos con paneles de resumen
// (ej. Agendamiento: "Citas por Especialidad" autonomo + "Ordenamiento
// medico" de resumen en otras sub-pestanas), el selector sigue disponible
// sin cambios.
function _gdActualizarCompararContra(){
  var wrap = document.getElementById('gd-comp-wrap');
  var nota = document.getElementById('gd-comp-nota');
  if(!wrap || !nota) return;
  var tab = (_gd.config && _gd.config.layout ? (_gd.config.layout.tabs || []) : []).find(function(t){ return t.key === _gd.tab; });
  if(!tab || !tab.panels || !tab.panels.length){ wrap.style.display = ''; nota.style.display = 'none'; return; }
  var subActiva = _gdSubtabActiva(tab);
  var indicesVisibles = subActiva ? subActiva.indices : tab.panels.map(function(p,i){ return i; });
  var visibles = tab.panels.filter(function(p,i){ return indicesVisibles.indexOf(i) !== -1; });
  var todosAutonomos = gdTodosAutonomos(visibles);
  wrap.style.display = todosAutonomos ? 'none' : '';
  nota.style.display = todosAutonomos ? '' : 'none';
}

function onGdMesChange(){
  _gd.mesSel = document.getElementById('gd-mes-sel').value;
  renderGenericHeader();
  renderGenericKpis();
  renderGenericTab(_gd.tab);
}
function onGdCompChange(){
  _gd.compSel = document.getElementById('gd-comp-sel').value;
  renderGenericKpis();
  renderGenericTab(_gd.tab);
}
function exportGenericDashboard(){ if(typeof _gdExport === 'function') _gdExport(); }
function onGdVistaChange(){
  _gd.vistaSel = document.getElementById('gd-vista-sel').value;
  renderGenericKpis();
  renderGenericTab(_gd.tab);
}

// Fase 86 (tema 3): el boton "Ver <mes>" del aviso "sin datos" de un panel
// autonomo (trafico_combo/trafico_whatsapp_combo/agendas_panel/
// tipificacion_panel) mueve el selector MES de ARRIBA -- asi el resto de
// pestanas tambien queda consistente con lo que se ve (una sola fuente de
// verdad, nunca el header diciendo "Informe Ago-26" mientras un panel
// abajo muestra Abr-25).
function _gdIrAMes(mes){
  _gd.mesSel = mes;
  var sel = document.getElementById('gd-mes-sel');
  if(sel) sel.value = mes;
  renderGenericHeader();
  renderGenericKpis();
  renderGenericTab(_gd.tab);
}

// _gdFinDeMes: ver gdFinDeMes en mes-global-logic.js (mismo criterio,
// extraido ahi para poder probarlo con node:test sin cargar el navegador).
var _gdFinDeMes = gdFinDeMes;

// HTML del aviso "sin datos para el mes elegido arriba" + boton al ultimo
// mes con datos -- mismo texto/estructura para los 5 paneles autonomos
// (Fase 86, tema 3): "Sin datos de <etiqueta> para <mes elegido> — el
// ultimo mes con datos es <ultimo mes> [Ver <ultimo mes>]".
// `formatearMes` (Fase 122, opcional): funcion de formato del mes a usar en
// este mensaje -- por defecto _gdMesLbl (formato corto, "Sep-26"), que
// siguen usando los paneles autonomos de siempre (Trafico/Agendas/
// Tipificacion). Efectividad de Agendamiento/Citas pasan mesNombreLargo
// (mes-nombre-logic.js) para mostrar el nombre completo ("Septiembre
// 2026"), pedido textual de Edwin -- sin este parametro, el comportamiento
// es EXACTAMENTE igual al de siempre.
function _gdAvisoSinDatosMesHtml(etiqueta, mesElegido, ultimoMesConDatos, formatearMes){
  var fmt = formatearMes || _gdMesLbl;
  var msg = 'Sin datos de ' + esc(etiqueta) + ' para ' + esc(fmt(mesElegido)) + '.';
  if(ultimoMesConDatos){
    msg += ' El último mes con datos es ' + esc(fmt(ultimoMesConDatos)) +
      ' <button class="btn-sm" onclick="_gdIrAMes(\''+esc(ultimoMesConDatos)+'\')">Ver '+esc(fmt(ultimoMesConDatos))+'</button>';
  }
  return '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">'+msg+'</div>';
}

function renderGenericBanner(){
  var host = document.getElementById('gd-kpis');
  var hayCargas = Object.keys(_gd.cargas).some(function(s){ return (_gd.cargas[s]||[]).length; });
  var esModulo = _gd.cliente === 'INVENTARIO' || _gd.cliente === 'GERENCIA';
  var ex = document.getElementById('gd-nodata-banner');
  if(hayCargas || esModulo){ if(ex) ex.remove(); return; }
  if(ex) return;
  var d = document.createElement('div');
  d.id = 'gd-nodata-banner';
  d.style.cssText = 'grid-column:1/-1;background:var(--c-warning-bg);border:1px solid var(--c-warning);border-radius:8px;padding:12px 16px;color:var(--c-warning-dark);font-size:0.85rem';
  d.innerHTML = 'Este dashboard todavia no tiene datos cargados. Un usuario con permiso de <strong>Cargar Datos</strong> debe subir los Excel del periodo.';
  host.appendChild(d);
}

function renderGenericKpis(){
  var strip = document.getElementById('gd-kpis');
  var kpis = (_gd.config.layout && _gd.config.layout.kpis) || [];
  if(!kpis.length){ strip.innerHTML = ''; renderGenericBanner(); return; }
  strip.innerHTML = kpis.map(_gdKpiCardHtml).join('');
  renderGenericBanner();
}

// `oculta: true` (opcional, en la config de la pestana) la saca del menu sin
// borrar nada -- panels/subtabs/datos/calculos siguen intactos, solo no se
// renderiza su boton ni puede quedar como pestana activa por defecto
// (_gdBootstrap, abajo, usa el mismo filtro). Revertir = quitar `oculta` de
// la config (server/dashboard-config-seed.js).
function _gdTabsVisibles(){
  return (_gd.config.layout.tabs || []).filter(function(t){ return !t.oculta; });
}
function renderGenericTabs(){
  document.getElementById('gd-tabs').innerHTML = _gdTabsVisibles().map(function(t){
    return '<button class="atab" data-gdtab="'+esc(t.key)+'">'+esc(t.label)+'</button>';
  }).join('');
}

// La navegacion por pestanas usa data-gdtab (no un onclick con texto libre).
document.getElementById('gd-tabs').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-gdtab]');
  if(btn) switchGenericTab(btn.dataset.gdtab);
});

// El boton "Aplicar filtros" de Calidad lleva la campana en data-camp (no en
// un onclick con texto libre — mismo criterio que data-gdtab de arriba y
// data-cliente de dashboards-admin.js: evita inyeccion via el nombre).
document.getElementById('gd-panels').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-calapply]');
  if(btn) _calDashAplicarFiltros(btn.dataset.camp, Number(btn.dataset.i));
  var subBtn = e.target.closest('button[data-gdsubtab]');
  if(subBtn) switchGenericSubtab(subBtn.dataset.gdsubtab);
});

// Fase 136 (PR 6): transicion de entrada SOLO al cambiar de pestana/sub-
// pestana real (aqui y en switchGenericSubtab) -- NUNCA en
// onGdMesChange/onGdCompChange/onGdVistaChange/_gdIrAMes ni en el
// listener de theme.js, que tambien llaman a renderGenericTab() pero son
// cambios de FILTRO (mes/comparar/vista), no de seccion -- un supervisor
// los usa para leer una cifra rapido, frecuentes, no deben esperar una
// animacion (ver docs/auditoria-ui-fase135.md, Paso 4: "nada que retrase
// ver un numero"). motionEnter() esta en motion-helpers.js.
function switchGenericTab(key){
  _gd.tab = key;
  _gd.subtab = null; // cada pestana nueva empieza en su primera sub-pestana (si tiene)
  document.querySelectorAll('#gd-tabs .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.gdtab===key); });
  Object.keys(_gd.charts).forEach(function(k){ try{_gd.charts[k].destroy();}catch(e){} delete _gd.charts[k]; });
  renderGenericTab(key);
  if (typeof motionEnter === 'function') motionEnter(document.getElementById('gd-panels'));
  _gdActualizarCompararContra();
}

// Sub-pestanas dentro de una pestana (Fase 40): campo opcional `subtabs` en
// la config de la pestana -- [{ key, label, indices:[...] }], cada `indices`
// apunta a posiciones del MISMO array `panels` de siempre (no se duplica ni
// reordena nada). Si la pestana no trae `subtabs`, el comportamiento es
// identico al de antes (todas sus graficas en la rejilla de 2 columnas) --
// asi AURORA, HOSPITAL LA MARIA y las 9 plantillas de cliente, que nunca
// traen este campo, no se ven afectadas por este cambio.
function _gdSubtabActiva(tab){
  if(!tab.subtabs || !tab.subtabs.length) return null;
  var encontrada = tab.subtabs.find(function(s){ return s.key === _gd.subtab; });
  return encontrada || tab.subtabs[0];
}
function switchGenericSubtab(key){
  _gd.subtab = key;
  Object.keys(_gd.charts).forEach(function(k){ try{_gd.charts[k].destroy();}catch(e){} delete _gd.charts[k]; });
  renderGenericTab(_gd.tab);
  if (typeof motionEnter === 'function') motionEnter(document.getElementById('gd-panels'));
  _gdActualizarCompararContra();
}

function renderGenericTab(key){
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key===key; });
  var host = document.getElementById('gd-panels');
  if(!tab){ host.innerHTML = ''; return; }
  var panels = tab.panels || [];
  var subActiva = _gdSubtabActiva(tab);
  // Sin `subtabs`: todos los indices del tab, igual que siempre. Con
  // `subtabs`: solo los indices de la sub-pestana activa.
  var indicesVisibles = subActiva ? subActiva.indices : panels.map(function(p,i){ return i; });
  var subtabsHtml = '';
  if(tab.subtabs && tab.subtabs.length > 1){
    subtabsHtml = '<div class="gd-subtabs">' + tab.subtabs.map(function(s){
      return '<button class="gd-subtab-btn' + (s.key===subActiva.key?' on':'') + '" data-gdsubtab="' + esc(s.key) + '">' + esc(s.label) + '</button>';
    }).join('') + '</div>';
  }

  // KPI-row panels van fuera de la rejilla; el resto en una rejilla de 2 columnas
  var html = subtabsHtml;
  panels.forEach(function(p, i){
    if(indicesVisibles.indexOf(i) === -1) return;
    if(p.tipo === 'kpi_row' || p.tipo === 'calidad_kpis'){
      // El filtro de asesor/fecha de Calidad (_gdRenderCalidad) va ANTES de
      // la rejilla de tarjetas KPI, nunca adentro (.aurora-kpis es un
      // flex/grid de tarjetas — un filtro adentro se veria como una tarjeta
      // rota). kpi_row (sin Calidad) no tiene filtro: el div queda vacio.
      if(p.tipo === 'calidad_kpis') html += '<div id="gd-f'+i+'"></div>';
      html += '<div class="aurora-kpis" id="gd-p'+i+'"></div>';
    } else if(p.tipo === 'tabla'){
      html += '<div class="aurora-card"><div class="aurora-card-title">'+esc(p.titulo||'')+'</div>'+
        '<div style="overflow-x:auto"><table class="aurora-rank-table" id="gd-p'+i+'"></table></div></div>';
    } else if(p.tipo === 'trafico_combo' || p.tipo === 'trafico_whatsapp_combo' || p.tipo === 'agendas_panel' || p.tipo === 'inasistencia_panel' || p.tipo === 'tipificacion_panel' || p.tipo === 'efectividad_agendamiento_panel' || p.tipo === 'efectividad_citas_panel' || p.tipo === 'salida_panel' || p.tipo === 'llamadas_unicas_panel'){
      // Panel grande y autonomo (filtros + KPIs + grafica + export propios):
      // no entra en la rejilla de 2 columnas, ocupa el ancho completo.
      // agendas_panel (Fase 78), inasistencia_panel (Fase 98),
      // tipificacion_panel (Fase 77, ORLANT), efectividad_agendamiento_panel
      // y efectividad_citas_panel (Fase 111), salida_panel (Fase 127),
      // llamadas_unicas_panel (Fase 138, PR3, Mobilize) siguen el mismo
      // criterio.
      html += '<div id="gd-p'+i+'"></div>';
    } else if(p.tipo === 'nota_kpi'){
      // KPI anual con texto explicativo (ej. efectividad de ordenamiento
      // medico): es texto, no un grafico — mismo criterio que trafico_combo,
      // ancho completo, sin canvas.
      html += '<div id="gd-p'+i+'"></div>';
    }
  });
  var chartPanels = panels.map(function(p,i){ return {p:p,i:i}; }).filter(function(x){ return indicesVisibles.indexOf(x.i)!==-1 && x.p.tipo!=='kpi_row' && x.p.tipo!=='calidad_kpis' && x.p.tipo!=='tabla' && x.p.tipo!=='trafico_combo' && x.p.tipo!=='trafico_whatsapp_combo' && x.p.tipo!=='agendas_panel' && x.p.tipo!=='inasistencia_panel' && x.p.tipo!=='tipificacion_panel' && x.p.tipo!=='efectividad_agendamiento_panel' && x.p.tipo!=='efectividad_citas_panel' && x.p.tipo!=='salida_panel' && x.p.tipo!=='llamadas_unicas_panel' && x.p.tipo!=='nota_kpi'; });
  if(chartPanels.length){
    html += '<div class="aurora-grid-2">' + chartPanels.map(function(x){
      var conmuta = (x.p.tipo === 'line' || x.p.tipo === 'bar' || x.p.tipo === 'area');
      var eff = _gdPanelTipo(x.p, x.i);
      var tools = conmuta ? '<span class="gd-panel-tools">' +
        ['line','bar','area'].map(function(t){
          return '<button data-t="' + t + '"' + (t === eff ? ' class="on"' : '') +
            ' onclick="_gdCyclePanelTipo(' + x.i + ',\'' + t + '\')">' +
            (t === 'line' ? 'Líneas' : t === 'bar' ? 'Barras' : 'Área') + '</button>';
        }).join('') + '</span>' : '';
      var filtroDiv = _gdPanelFiltroTipo(x.p) ? '<div id="gd-f'+x.i+'"></div>' : '';
      var totalSpan = x.p.filtroSerie ? '<span id="gd-serietot-'+x.i+'" style="font-size:0.72rem;color:var(--c-text-muted);font-weight:600;margin-left:10px"></span>' : '';
      var notasDiv = (x.p.notas && x.p.notas.length) ? '<div id="gd-notas-'+x.i+'" style="padding:10px 4px 2px;font-size:0.74rem;color:var(--c-text-2);line-height:1.5"></div>' : '';
      return '<div class="aurora-card"><div class="aurora-card-title' + (tools ? ' gd-flex' : '') + '">' +
        '<span>' + esc(x.p.titulo || '') + '</span>' + totalSpan + tools + '</div>' + filtroDiv +
        '<div class="aurora-chart-wrap" style="height:230px"><canvas id="gd-c'+x.i+'"></canvas></div>' + notasDiv + '</div>';
    }).join('') + '</div>';
  }
  host.innerHTML = html;

  panels.forEach(function(p, i){ if(indicesVisibles.indexOf(i)!==-1) _gdRenderPanel(p, i); });
}

function _gdRenderPanel(p, i){
  if(p.tipo === 'kpi_row'){
    var el = document.getElementById('gd-p'+i); if(!el) return;
    el.innerHTML = (p.items||[]).map(_gdKpiCardHtml).join('');
    return;
  }

  if(p.tipo === 'calidad_kpis' || p.tipo === 'calidad_pie' || p.tipo === 'calidad_bar_asesores'){ _gdRenderCalidad(p, i); return; }

  if(p.tipo === 'trafico_combo'){ _traficoRenderPanel(p, i); return; }
  if(p.tipo === 'trafico_whatsapp_combo'){ _traficoWppRenderPanel(p, i); return; }
  if(p.tipo === 'agendas_panel'){ _agendasRenderPanel(p, i); return; }
  if(p.tipo === 'efectividad_agendamiento_panel'){ _efectividadAgendamientoRenderPanel(p, i); return; }
  if(p.tipo === 'inasistencia_panel'){ _inasistenciaRenderPanel(p, i); return; }
  if(p.tipo === 'efectividad_citas_panel'){ _efectividadCitasRenderPanel(p, i); return; }
  if(p.tipo === 'tipificacion_panel'){ _tipificacionRenderPanel(p, i); return; }
  if(p.tipo === 'salida_panel'){ _salidaRenderPanel(p, i); return; }
  if(p.tipo === 'llamadas_unicas_panel'){ _llamadasUnicasRenderPanel(p, i); return; }

  if(p.tipo === 'nota_kpi'){ _gdRenderNotaKpi(p, i); return; }

  if(p.tipo === 'tabla'){
    var t = document.getElementById('gd-p'+i); if(!t) return;
    var r = _gdResolver(p.fuente); // espera modo:'filas'
    var cols = p.columnas || [];
    var carga = _gdCargaMes(p.fuente.s);
    var filas = carga ? (carga.filas||[]) : [];
    var html = '<tr>'+cols.map(function(c){ return '<th>'+esc(c.label)+'</th>'; }).join('')+'</tr>';
    if(!filas.length) html += '<tr><td colspan="'+cols.length+'" style="text-align:center;color:var(--c-text-muted)">Sin datos cargados</td></tr>';
    else html += filas.map(function(f){ return '<tr>'+cols.map(function(c){
      var v = f[c.key];
      if(v==null) return '<td>-</td>';
      return '<td>'+(typeof v==='number' ? v.toLocaleString('es-CO') : esc(v))+'</td>';
    }).join('')+'</tr>'; }).join('');
    t.innerHTML = html;
    return;
  }

  var canvasId = 'gd-c'+i;

  if(p.tipo === 'pie'){
    var filtroTipoPie = _gdPanelFiltroTipo(p);
    if(filtroTipoPie) _gdRenderFiltroBar(p, i, filtroTipoPie);
    var pr = _gdResolver(p.fuente, _gdExtraFiltroPanel(p, i));
    _gdChart(canvasId, { type:'doughnut',
      data:{ labels: pr.labels||[], datasets:[{ data: pr.values||[], backgroundColor: (pr.labels||[]).map(function(l){ return paletaColorPara(l); }) }] },
      options: loDatalabelsAuto(loPie()) });
    _gdRenderNotasPanel(p, i);
    return;
  }

  if(p.tipo === 'line' || p.tipo === 'bar' || p.tipo === 'area'){
    var eff = _gdPanelTipo(p, i);          // tipo efectivo (preferencia del visor)
    var esLinea = eff === 'line' || eff === 'area';
    var hex2rgba = function(h, a){ h = h.replace('#',''); return 'rgba(' + parseInt(h.slice(0,2),16) + ',' + parseInt(h.slice(2,4),16) + ',' + parseInt(h.slice(4,6),16) + ',' + a + ')'; };
    var filtroTipoLb = _gdPanelFiltroTipo(p);
    if(filtroTipoLb) _gdRenderFiltroBar(p, i, filtroTipoLb);
    // filtroSerie: en vez de dibujar TODAS las series juntas, solo la
    // seleccionada en el filtro (ej. Salida: Linea General o 3P, nunca las 2
    // superpuestas — mismo criterio de un dato a la vez que ya usa Trafico).
    var series = p.filtroSerie
      ? [gdSerieSeleccionada(p.series, (_gdSerieFiltro[_gdPanelKey(i)]||{}).label)].filter(Boolean)
      : (p.series || []);
    var extraLb = _gdExtraFiltroPanel(p, i);
    var labels = null;
    var datasets = series.map(function(s){
      var rr = _gdResolver(s.fuente, extraLb);
      if(!labels) labels = rr.labels || [];
      var color = paletaColorPara(s.label);
      if(esLinea){
        return { label: s.label, data: rr.values||[], borderColor: color, backgroundColor: hex2rgba(color, eff === 'area' ? 0.18 : 0.08),
          tension:0.3, pointRadius:3, borderWidth:2, fill: eff === 'area' || series.length===1 };
      }
      return { label: s.label, data: rr.values||[], backgroundColor: color, borderRadius:3 };
    });
    if(p.filtroSerie){
      var totEl = document.getElementById('gd-serietot-'+i);
      if(totEl){
        var suma = (datasets[0] && datasets[0].data || []).reduce(function(a,v){ return a + (v||0); }, 0);
        totEl.textContent = 'Total: ' + suma.toLocaleString('es-CO');
      }
    }
    var opts = esLinea
      ? (p.unidad==='%' ? loPct() : (p.unidad==='tiempo' ? _gdTiempoOpts() : loFmt(lo(null, 50), p.unidad)))
      : loFmt(loBar(), p.unidad);
    // pctDeTotal: loFmt() ya puso el tooltip/eje en formato legible arriba —
    // solo se pisa el datalabel (numero crudo) por el de "% del total"
    // (loBarPct, charts.js), sin perder el resto del formato.
    if(!esLinea && p.pctDeTotal) opts.plugins.datalabels.formatter = loBarPct().plugins.datalabels.formatter;
    if(eff==='bar' && p.horizontal){ opts.indexAxis='y'; opts.scales.x={ticks:{font:{size:12}}}; opts.scales.y={ticks:{font:{size:12}}}; }
    // Auto-ocultado (Fase 47, mismo helper de Fase 45): evita que las
    // etiquetas se amontonen en paneles densos (ej. una linea diaria de un
    // mes completo), sin perder el formatter ya calculado arriba.
    loDatalabelsAuto(opts);
    _gdChart(canvasId, { type: esLinea ? 'line' : 'bar', data:{ labels: labels||[], datasets: datasets }, options: opts });
    _gdRenderNotasPanel(p, i);
    return;
  }

  if(p.tipo === 'combo'){
    var barras = (p.barras||[]).map(function(b){
      var rb = _gdResolver(b.fuente);
      return { _r: rb, label: b.label, data: rb.values||[], color: paletaColorPara(b.label) };
    });
    var labels2 = (barras[0] && barras[0]._r.labels) || [];
    var lin = p.linea ? _gdResolver(p.linea.fuente) : null;
    if(lin && !labels2.length) labels2 = lin.labels || [];
    // gdComboDatasets (gd-combo-logic.js, Fase 76): limita el ancho maximo
    // de las barras y fuerza que la linea se dibuje siempre encima -- con
    // varias categorias/series no cambia nada (ver comentario de cabecera
    // de ese archivo).
    var linCfg = lin ? { label: p.linea.label, data: lin.values||[], color: (typeof CO!=='undefined'?CO:'#e67e22') } : null;
    var ds = gdComboDatasets(barras, linCfg);
    var o = loBar();
    // Chart.js usa el mismo `order` (gd-combo-logic.js) tambien para
    // reordenar la leyenda -- sin esto, la linea pasaria a listarse PRIMERO
    // en vez de al final, cambiando la leyenda de todas las graficas combo
    // aunque su dibujo (que es lo unico que debia cambiar) se vea igual.
    // Se fuerza generateLabels a listar los datasets en su orden original
    // (barras, despues la linea), igual que antes del arreglo.
    o.plugins.legend.labels = Object.assign({}, o.plugins.legend.labels, {
      generateLabels: function(chart){
        return chart.data.datasets.map(function(dset, i){
          var color = dset.type === 'line' ? dset.borderColor : dset.backgroundColor;
          return { text: dset.label, fillStyle: color, strokeStyle: color, lineWidth: dset.type==='line' ? 2 : 0, hidden: !chart.isDatasetVisible(i), datasetIndex: i };
        });
      }
    });
    o.scales = {
      y:{ position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:12}} },
      y2:{ position:'right', grid:{display:false}, ticks:{font:{size:12}, callback:function(v){ return gdFmtValor(v,'%'); }} },
      x:{ grid:{display:false}, ticks:{font:{size:12}} }
    };
    // v+'%' sin redondear mostraba ruido de punto flotante en el eje y en el
    // datalabel de la linea -- gdFmtValor(v,'%') redondea a 1 decimal.
    o.plugins.datalabels = { display:true, align:'end', anchor:'end', font:{size:12,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
      formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null?gdFmtValor(v,'%'):'') : v; } };
    loDatalabelsAuto(o);
    _gdChart(canvasId, { data:{ labels: labels2, datasets: ds }, options: o });
    return;
  }
}

function _gdTiempoOpts(){
  var o = lo(null, 50);
  var f = function(v){ var m=Math.floor(v/60), s=Math.round(v%60); return m+':'+(s<10?'0':'')+s; };
  o.plugins.datalabels.formatter = f;
  o.scales.y.ticks.callback = f;
  return o;
}

// Texto opcional (glosario/nota) debajo de un panel pie/bar/line — ej. el
// glosario de codigos de tipificacion, o la lista de servicios excluidos de
// "Ordenes por estado". Contenido siempre estatico (viene de la config del
// panel, nunca de una carga de Excel), pero se escapa igual que cualquier
// otro valor renderizado (mismo criterio del resto del frontend desde la
// fase de fix de XSS).
function _gdRenderNotasPanel(p, i){
  if(!p.notas || !p.notas.length) return;
  var el = document.getElementById('gd-notas-'+i);
  if(!el) return;
  el.innerHTML = p.notas.map(function(n){ return '<div style="margin-bottom:4px">'+esc(n)+'</div>'; }).join('');
}

// Panel `nota_kpi`: resuelve 2-3 valores (modo:'anual', ver _gdResolver),
// aplica una formula simple opcional y los sustituye en una plantilla de
// texto — ej. "Efectividad del año" de ordenamiento medico 3P (PDF de InCo:
// KPI anual con texto explicativo, no solo un numero).
//   p.valores  : [{ clave, fuente }]  — cada uno resuelto via _gdResolver.
//   p.formula  : { clave, a, b } opcional -> valores[clave] = b? round(a/b*100*10)/10 : null
//   p.plantilla: texto con {clave} a sustituir (cada valor se escapa al insertarse).
function _gdRenderNotaKpi(p, i){
  var el = document.getElementById('gd-p'+i);
  if(!el) return;
  var valores = {};
  (p.valores || []).forEach(function(v){ valores[v.clave] = _gdResolver(v.fuente).scalar; });
  if(p.formula){
    var a = valores[p.formula.a], b = valores[p.formula.b];
    valores[p.formula.clave] = (a === null || a === undefined || b === null || b === undefined || !b)
      ? null : Math.round((_gdNum(a) / _gdNum(b)) * 1000) / 10;
  }
  var faltan = Object.keys(valores).some(function(k){ return valores[k] === null || valores[k] === undefined; });
  var texto = faltan
    ? 'Todavía no hay datos suficientes del año para este cálculo.'
    : String(p.plantilla || '').replace(/\{(\w+)\}/g, function(_, k){
        var v = valores[k];
        return esc(typeof v === 'number' ? v.toLocaleString('es-CO') : String(v == null ? '' : v));
      });
  el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(p.titulo || '') + '</div>' +
    '<div style="padding:6px 4px 2px;font-size:0.92rem;line-height:1.6;color:var(--c-text)">' + texto + '</div></div>';
}

// ── Paneles de Calidad (usan CAL_DB de la Fase 1) ───────────
// Filtro de asesor/fecha (extiende el patron combinable de Trafico de
// Llamadas a Calidad, 2026-09-16): estado compartido por campana entre
// calidad_kpis y calidad_pie (son dos paneles separados de la misma
// pestaña, "tabCalidad" siempre los emite juntos) — la barra de filtro se
// dibuja una sola vez (en calidad_kpis, que va primero) y calidad_pie lee
// el mismo estado sin dibujar una segunda barra redundante. A diferencia
// del selector de mes global (_gd.mesSel) de antes de la Fase 86, este
// filtro ahora SI sigue al selector de mes de arriba (tema 3): el mes
// elegido desliza la ventana de 12 meses igual que Trafico -- ver
// _calDashMesSincronizado mas abajo.
var _calDashFiltro = {}; // por campana: { asesores:[...]|null, desde, hasta }
var _calDashMesSincronizado = {}; // por campana: ultimo _gd.mesSel ya aplicado
var _calDashSinDatosMesGlobal = {}; // por campana: true si _gd.mesSel no tiene monitoreos

function _calDashEstado(camp, todos){
  if(!_calDashFiltro[camp]){
    var fechas = todos.map(function(m){ return m.fecha; }).filter(Boolean).sort();
    var minF = fechas[0], maxF = fechas[fechas.length-1];
    // Fase 86 (tema 2): una fila vieja con fecha futura ya en la base nunca
    // debe arrastrar la ventana por defecto (ver trafico.js).
    if(typeof fechaLimitesRecortar === 'function') maxF = fechaLimitesRecortar(maxF);
    var desdeDefault = (typeof traficoVentana12Meses === 'function') ? traficoVentana12Meses(maxF, minF) : minF;
    _calDashFiltro[camp] = { asesores: null, desde: desdeDefault || '', hasta: maxF || '' };
  }
  return _calDashFiltro[camp];
}

function _calDashAplicarFiltros(camp, i){
  var sel = document.getElementById('cd-f-asesor-'+i);
  var asesores = sel ? Array.prototype.filter.call(sel.options, function(o){ return o.selected; }).map(function(o){ return o.value; }) : [];
  var desde = document.getElementById('cd-f-desde-'+i);
  var hasta = document.getElementById('cd-f-hasta-'+i);
  _calDashFiltro[camp] = { asesores: asesores, desde: desde ? desde.value : '', hasta: hasta ? hasta.value : '' };
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  if(tab) renderGenericTab(tab.key);
}

function _gdRenderCalidad(p, i){
  var camp = p.campana;
  var todos = (typeof CAL_DB!=='undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  var asesoresDisp = calDashAsesoresDistintos(todos);
  var estado = _calDashEstado(camp, todos);

  // Fase 86 (tema 3): si el selector MES de arriba cambio desde la ultima
  // vez que se sincronizo esta campana, desliza la ventana de 12 meses
  // para que TERMINE en el mes elegido (mismo criterio que Trafico). Si
  // ese mes no tiene ningun monitoreo, aviso con boton al ultimo mes con
  // datos en vez de KPIs/pie en cero (que se verian como "0 monitoreos
  // reales" en vez de "mes no sincronizado").
  if(_gd.mesSel && _calDashMesSincronizado[camp] !== _gd.mesSel){
    _calDashMesSincronizado[camp] = _gd.mesSel;
    var inicioMesGlobalCal = _gd.mesSel + '-01', finMesGlobalCal = _gdFinDeMes(_gd.mesSel);
    var tieneDatosMesGlobalCal = todos.some(function(m){ return m.fecha >= inicioMesGlobalCal && m.fecha <= finMesGlobalCal; });
    // Se fija el rango SIEMPRE (incluso sin datos): asi Exportar
    // (_gdExportarCalidad, que recalcula fresco desde _calDashFiltro en
    // el momento del clic) queda consistente con lo que se ve en pantalla.
    var fechasCalTodas = todos.map(function(m){ return m.fecha; }).filter(Boolean).sort();
    estado.hasta = finMesGlobalCal;
    estado.desde = (typeof traficoVentana12Meses === 'function') ? traficoVentana12Meses(estado.hasta, fechasCalTodas[0]) : estado.desde;
    _calDashSinDatosMesGlobal[camp] = !tieneDatosMesGlobalCal;
  }
  if(_calDashSinDatosMesGlobal[camp]){
    var fechasCalOrden = todos.map(function(m){ return m.fecha; }).filter(Boolean).sort();
    var ultimoMesCal = fechasCalOrden.length ? fechasCalOrden[fechasCalOrden.length-1].slice(0,7) : null;
    if(p.tipo === 'calidad_kpis'){
      var fElAviso = document.getElementById('gd-f'+i); if(fElAviso) fElAviso.innerHTML = '';
      var elAviso = document.getElementById('gd-p'+i);
      if(elAviso) elAviso.innerHTML = _gdAvisoSinDatosMesHtml('Calidad', _gd.mesSel, ultimoMesCal);
    }
    return; // calidad_pie: no dibuja nada -- evita un donut vacio sin explicacion
  }

  if(!estado.asesores) estado.asesores = asesoresDisp.slice();
  else estado.asesores = estado.asesores.filter(function(a){ return asesoresDisp.indexOf(a)!==-1; });
  if(!estado.asesores.length) estado.asesores = asesoresDisp.slice();

  var arr = calDashFiltrarMonitoreos(todos, { asesores: estado.asesores, desde: estado.desde, hasta: estado.hasta });
  var r = calDashResumen(arr);

  if(p.tipo === 'calidad_kpis'){
    var fEl = document.getElementById('gd-f'+i);
    if(fEl){
      fEl.innerHTML = '<div class="gd-panel-filtro">' +
        '<div><label>Asesor</label><select multiple id="cd-f-asesor-'+i+'" size="'+Math.min(5, Math.max(2, asesoresDisp.length))+'">' +
          // Fase 87 (tema C): `value` sigue siendo el nombre ORIGINAL del
          // asesor (los filtros tienen que seguir funcionando igual); solo
          // el texto visible pasa por textoFormatoNombre.
          asesoresDisp.map(function(a){ return '<option value="'+esc(a)+'"'+(estado.asesores.indexOf(a)!==-1?' selected':'')+'>'+esc(textoFormatoNombre(a))+'</option>'; }).join('') +
        '</select></div>' +
        '<div><label>Desde</label><input type="date" id="cd-f-desde-'+i+'" value="'+esc(estado.desde)+'"></div>' +
        '<div><label>Hasta</label><input type="date" id="cd-f-hasta-'+i+'" value="'+esc(estado.hasta)+'"></div>' +
        '<button class="btn-sm" data-calapply data-camp="'+esc(camp)+'" data-i="'+i+'">Aplicar filtros</button>' +
      '</div>';
    }
    var el = document.getElementById('gd-p'+i); if(!el) return;
    // 'qa_promedio' via umbrales_semaforo (default global 90/70, editable
    // desde el panel de administracion); si no hay umbral configurado cae
    // al mismo corte 90/70 que este panel siempre uso, para no perder color.
    // qaColor (y por lo tanto qaCls) se calcula IGUAL que siempre -- umbral
    // configurado si existe, si no el mismo corte 90/70 sobre r.promedio
    // (sin mirar r.total, igual que antes) -- no se toca esa clasificacion.
    // qaBadge (Fase 133, WCAG 1.4.1) usa ese mismo color para decidir el
    // simbolo -- nunca un color aparte.
    var qaColor = _gdSemaforoColor(r.total ? r.promedio : null, { metrica: 'qa_promedio', campana: camp })
      || (r.promedio>=90?'verde':r.promedio>=70?'amarillo':'rojo');
    var qaCls = _gdSemaforoClase(qaColor);
    var qaBadge = (typeof semaforoBadgeHtml === 'function') ? semaforoBadgeHtml(qaColor) : '';
    el.innerHTML =
      '<div class="aurora-kpi"><div class="kv">'+r.total+'</div><div class="kl">Monitoreos Realizados</div></div>'+
      '<div class="aurora-kpi '+qaCls+'"><div class="kv">'+qaBadge+(r.total?r.promedio:'—')+'</div><div class="kl">Puntaje Promedio de Calidad</div></div>'+
      '<div class="aurora-kpi '+qaCls+'"><div class="kv" style="font-size:1rem">'+qaBadge+r.clasificacion+'</div><div class="kl">Clasificacion General</div></div>';
    return;
  }
  if(p.tipo === 'calidad_bar_asesores'){
    // Fase 130 (pedido de Edwin): nombre + % promedio por asesor, barras
    // horizontales ordenadas de mayor a menor -- NUNCA el numero de
    // monitoreos (ni dataset, ni tooltip, ni eje: calDashPromedioPorAsesor
    // ni siquiera lo calcula). Mismo `arr` ya filtrado por mes/asesor/fecha
    // que calidad_kpis/calidad_pie -- el promedio nunca mezcla meses.
    var porAsesor = calDashPromedioPorAsesor(arr);
    var labelsAsesores = porAsesor.map(function(x){ return textoFormatoNombre(x.asesor); });
    var valoresAsesores = porAsesor.map(function(x){ return x.promedio; });
    var optsBar = loFmt(loBar(), '%');
    optsBar.indexAxis = 'y';
    optsBar.scales.x = { ticks:{ font:{ size:12 } } };
    optsBar.scales.y = { ticks:{ font:{ size:12 } } };
    loDatalabelsAuto(optsBar);
    _gdChart('gd-c'+i, { type:'bar',
      data:{ labels: labelsAsesores, datasets:[{ label:'Promedio', data: valoresAsesores,
        backgroundColor: labelsAsesores.map(function(l){ return paletaColorPara(l); }), borderRadius:3 }] },
      options: optsBar });
    return;
  }
  // calidad_pie — clasificacion cualitativa fija (sobresaliente/no critico/
  // critico), no la paleta categorica: colores intencionalmente iguales al
  // semaforo (verde/naranja/rojo = bueno/medio/malo), pero es una decision
  // de diseño de ESTE grafico puntual, no el motor de umbrales de
  // semaforo-logic.js (no hay umbral configurable de por medio aqui).
  _gdChart('gd-c'+i, { type:'doughnut',
    data:{ labels:['Sobresaliente','No Critico','Critico'], datasets:[{ data:[r.sobresaliente,r.noCritico,r.critico], backgroundColor:[
      (typeof CG!=='undefined'?CG:'#27ae60'), (typeof CO!=='undefined'?CO:'#e67e22'), (typeof CR!=='undefined'?CR:'#e74c3c') ] }] },
    options: loDatalabelsAuto(loPie()) });
}

// ══════════════════════════════════════════════════════════════
// EXPORTACION (Excel real + PDF por impresion) — Fase A6
// ══════════════════════════════════════════════════════════════

// Extrae, ya calculadas, las filas de KPIs y de datos de una pestana.
function _gdDatosKpis(){
  var kpis = (_gd.config.layout && _gd.config.layout.kpis) || [];
  return kpis.map(function(k){
    var cur = _gdResolver(k.fuente).scalar;
    var comp = _gdResolverComp(k.fuente);
    var v = _gdVariacion(cur, comp.scalar);
    var meta = _gdMetaValor(k);
    return {
      Indicador: k.titulo,
      Valor: cur === null || cur === undefined ? '' : cur,
      'Periodo comparado': comp.periodo ? _gdMesLbl(comp.periodo) : '',
      'Var. %': v && v.pct !== null ? v.pct : '',
      'Var. abs': v ? v.abs : '',
      Meta: meta === null || meta === undefined ? '' : meta,
      // Fase 88 (hallazgo real del barrido): usa la MISMA funcion que la
      // tarjeta en pantalla (_gdKpiCardHtml, dashboard-kpi-logic.js) --
      // antes esto era un calculo aparte que no chequeaba `cur`, y con
      // `cur` null (sin dato del periodo) pero `meta` configurada, el
      // export mostraba "% Meta: 0" como si la meta estuviera en 0%
      // cumplida en vez de "sin dato".
      '% Meta': (function(){ var av = gdPorcentajeMeta(cur, meta); return av === null ? '' : av; })(),
      Alerta: _gdFueraDeRango(cur, comp.scalar, k) ? 'FUERA DE RANGO' : '',
      Semaforo: (function(){
        var c = _gdSemaforoColor(cur, k);
        return c ? c.toUpperCase() : '';
      })(),
    };
  });
}
// Fase 85 (hallazgo real: "Exportar" no exportaba nada en NINGUNA de las 5
// pestanas de ORLANT). Causa con 2 partes:
//  1. El menu de "Exportar" (#gd-export-menu) se pintaba con z-index:50,
//     por DEBAJO del modal del dashboard (#gd-overlay, z-index:600) -- el
//     menu quedaba invisible/inclicable detras del propio dashboard (ver
//     el fix de z-index en _gdExport, mas abajo). Sin esto, ni siquiera
//     se podia llegar a "Excel (.xlsx)".
//  2. Aunque se pudiera hacer clic, esta funcion (_gdDatosPanelesTab)
//     saltaba por completo los 5 tipos de panel autonomo (trafico_combo,
//     trafico_whatsapp_combo, agendas_panel, tipificacion_panel,
//     calidad_kpis/calidad_pie) con un comentario que decia "export
//     propio" -- cierto para Trafico (_traficoDatosExport/
//     _traficoWppDatosExport YA EXISTIAN, con botones Excel/PDF DENTRO de
//     cada panel, Fase 68 -- nunca conectados a este boton de arriba) pero
//     FALSO para Agendas/Tipificacion/Calidad (Fases 77/78): nunca tuvieron
//     ningun export, ni aqui ni en su propio panel.
//
// GD_EXPORT_TIPOS_SOPORTADOS (lista CERRADA de tipos de panel que esta
// funcion sabe exportar) vive en dashboard-export-tipos.js -- ver ese
// archivo y server/tests/dashboard-generic-export-fase85-lista-cerrada.test.js.

// Agendas (Fase 78; Fase 94 tema B, pedido explicito de Edwin: "Exportar
// tiene que incluir las 4 sub-pestañas con los filtros aplicados"). Cada
// una de las 4 sub-pestañas es su propio panel `agendas_panel` (distinto
// `vista`) -- _gdDatosPanelesTab llama esta funcion UNA VEZ POR PANEL (los
// 4, sin importar cual este activo en pantalla), asi el export siempre
// trae las 4. El filtro que se usa es el ESTADO COMPARTIDO por campana
// (_agendasEstado[campana], el mismo que ya usa _agendasDibujar) -- no el
// de un panel puntual -- para que quede igual sin importar cual de las 4
// sub-pestañas se visito ultimo.
async function _gdExportarAgendas(p, i){
  var campana = p.campana;
  var vista = p.vista || 'especialidad';
  var filtros = _agendasEstado[campana] || {};
  var titulo = p.titulo || (_AGENDAS_VISTAS[vista] && _AGENDAS_VISTAS[vista].titulo) || 'Agendas';
  var def = _AGENDAS_VISTAS[vista];
  if(!def) return [];

  var datos = [];
  try{ datos = await apiRequest('GET', def.endpoint+'?'+_agendasQueryString(campana, filtros, def.incluirMes)) || []; }catch(e){}
  if(!datos.length){
    return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Agendas para el mes/filtros actuales.' }];
  }
  if(vista === 'especialidad'){
    return [{ titulo: titulo, tipo: 'tabla', filas: datos.map(function(r){ return { Especialidad: textoFormatoNombre(r.especialidad), Cantidad: r.cantidad }; }) }];
  }
  if(vista === 'mensual'){
    return [{ titulo: titulo, tipo: 'tabla', filas: datos.map(function(r){ return { Mes: _agendasMesLbl(r.mes), Cantidad: r.cantidad }; }) }];
  }
  if(vista === 'linea'){
    return [{ titulo: titulo, tipo: 'tabla', filas: datos.map(function(r){ return { Mes: _agendasMesLbl(r.mes), 'Tipo de Línea': r.tipoLinea, Cantidad: r.cantidad }; }) }];
  }
  return [];
}

// "Ranking de Asesores" (Fase 111, pedido textual de Edwin: "el ranking va
// a ser efectividad por agendamiento"): exporta la tabla COMPLETA del mes
// elegido arriba (_gd.mesSel -- este panel no tiene su propio filtro de
// mes, ver public/js/efectividad-agendamiento.js), igual que se ve en
// pantalla, mas una fila de totales del equipo (ponderado, nunca el
// promedio simple de los %). La proteccion contra inyeccion de formulas
// (Fase 72) se aplica de forma generica a cualquier panel tipo:'tabla' al
// armar el libro (xlsxFilasSeguras, mas abajo en este archivo).
async function _gdExportarEfectividadAgendamiento(p, i){
  var campana = p.campana;
  var titulo = p.titulo || 'Ranking de Asesores';
  if(!_gd.mesSel) return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Efectividad de agendamiento para el mes actual.' }];
  var ranking = { filas: [], equipo: { gestiones: 0, agendas: 0, efectividad: 0 } };
  try{ ranking = await apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(_gd.mesSel)) || ranking; }catch(e){}
  if(!ranking.filas || !ranking.filas.length){
    return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Efectividad de agendamiento para ' + mesNombreLargo(_gd.mesSel) + '.' }];
  }
  var filas = ranking.filas.map(function(f){
    return { Puesto: f.puesto, Asesor: textoFormatoNombre(f.asesor), Gestiones: f.gestiones, Agendas: f.agendas, '% Efectividad': efectividadAgendamientoFmtPct(f.efectividad) };
  });
  filas.push({ Puesto: '', Asesor: 'TOTAL EQUIPO', Gestiones: ranking.equipo.gestiones, Agendas: ranking.equipo.agendas, '% Efectividad': efectividadAgendamientoFmtPct(ranking.equipo.efectividad) });
  return [{ titulo: titulo, tipo: 'tabla', filas: filas }];
}

// "Efectividad de Citas" (Fase 111, pedido textual de InCo): exporta
// TODOS los meses con datos (tabla completa, igual que se ve en pantalla)
// mas una fila de totales del periodo (ponderado, nunca el promedio
// simple de los %).
async function _gdExportarEfectividadCitas(p, i){
  var campana = p.campana;
  var titulo = p.titulo || 'Efectividad de Citas';
  var filas = [];
  try{ filas = await apiRequest('GET', '/calidad/efectividad-citas/mensual?campana='+encodeURIComponent(campana)) || []; }catch(e){}
  if(!filas.length){
    return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Efectividad de citas para el periodo actual.' }];
  }
  var ponderado = citasAtendidasPonderado(filas);
  var out = filas.map(function(f){
    return { Mes: citasAtendidasMesLbl(f.mes), Agendas: f.agendas, Atendidas: f.atendidas, '% Efectividad': citasAtendidasFmtPct(f.agendas>0?f.atendidas/f.agendas:null) };
  });
  out.push({ Mes: 'PERÍODO ('+citasAtendidasRangoLbl(filas)+')', Agendas: ponderado.agendas, Atendidas: ponderado.atendidas, '% Efectividad': citasAtendidasFmtPct(ponderado.pct) });
  return [{ titulo: titulo, tipo: 'tabla', filas: out }];
}

// Salida (Fase 127, pedido textual de Edwin): 2 hojas separadas (Llamadas/
// WhatsApp), una fila por mes -- mismo criterio de "nunca mezclar datos de
// naturaleza distinta en una sola hoja" que Tipificacion (justo abajo).
// Participacion 3P dentro del total de ESE mismo mes (nunca un denominador
// de entrada/gestion, Edwin no lo definio).
async function _gdExportarSalida(p, i){
  var campana = p.campana;
  var filas = [];
  try{ filas = await apiRequest('GET', '/calidad/salida/mensual?campana='+encodeURIComponent(campana)) || []; }catch(e){}
  if(!filas.length){
    return [{ titulo: 'Llamadas y WhatsApp de salida', tipo: 'aviso', filas: [], mensaje: 'Sin datos de Llamadas y WhatsApp de salida para el periodo actual.' }];
  }
  function pct(parte, total){ return total>0 ? gdFmtValor(Math.round(parte/total*1000)/10,'%') : '—'; }
  var llamadas = filas.map(function(f){
    return { Mes: salidaMesLbl(f.mes), 'Línea 3P': f.llamadas3p, 'Línea General': f.llamadasGeneral, 'Total': f.llamadas3p+f.llamadasGeneral, '% 3P': pct(f.llamadas3p, f.llamadas3p+f.llamadasGeneral) };
  });
  var whatsapp = filas.map(function(f){
    return { Mes: salidaMesLbl(f.mes), 'WhatsApp 3P': f.wpp3p, 'WhatsApp General': f.wppGeneral, 'Total': f.wpp3p+f.wppGeneral, '% 3P': pct(f.wpp3p, f.wpp3p+f.wppGeneral) };
  });
  return [
    { titulo: 'Llamadas de salida', tipo: 'tabla', filas: llamadas },
    { titulo: 'WhatsApp de salida', tipo: 'tabla', filas: whatsapp },
  ];
}

// Llamadas Unicas (Fase 138, PR3, Mobilize): 1 sola tabla, por mes -- mismo
// criterio que _gdExportarSalida (no respeta los filtros Desde/Hasta/Skill/
// Asesor del panel, exporta el total mensual completo). El telefono nunca
// llega hasta aqui (ya no existe desde que se cargo, ver llamadas-unicas.js
// del servidor).
async function _gdExportarLlamadasUnicas(p, i){
  var campana = p.campana;
  var porMes = [];
  try{ porMes = await apiRequest('GET', '/calidad/llamadas-unicas/por-mes?campana='+encodeURIComponent(campana)) || []; }catch(e){}
  if(!porMes.length){
    return [{ titulo: 'Llamadas de ingreso únicas', tipo: 'aviso', filas: [], mensaje: 'Sin llamadas únicas cargadas todavía.' }];
  }
  var filas = porMes.map(function(m){
    return { Mes: (typeof mesNombreLargo==='function') ? mesNombreLargo(m.periodo) : m.periodo, 'Total únicas': m.total, 'Contestadas únicas': m.contestadas, 'Abandonadas únicas': m.abandonadas };
  });
  return [{ titulo: 'Llamadas de ingreso únicas', tipo: 'tabla', filas: filas }];
}

// Tipificacion (Fase 77, pedido explicito de esta fase): las 2 mitades
// (Llamadas y WhatsApp) por separado -- si una no tiene datos, se dice
// (nunca se omite en silencio). Mismo estado compartido/por-canal que ya
// usa _tipificacionDibujarCanal.
async function _gdExportarTipificacion(p, i){
  var campana = p.campana;
  var compartido = _tipificacionEstadoCompartido[i] || {};
  var out = [];
  // Fase 131 (Mobilize): respeta `soloCanal` -- un cliente sin WhatsApp
  // (Mobilize) nunca exporta una hoja "Sin datos de WhatsApp" que no
  // corresponde a su operacion real. ORLANT (sin soloCanal) sigue
  // exportando las 2, exactamente igual que siempre.
  var canalesAUsar = (_tipificacionCanalesPorPanel && _tipificacionCanalesPorPanel[i]) || (p.soloCanal ? TIPIFICACION_CANALES.filter(function(c){ return c.canal === p.soloCanal; }) : TIPIFICACION_CANALES);
  for(var c=0; c<canalesAUsar.length; c++){
    var def = canalesAUsar[c];
    var deCanal = _tipificacionEstadoCanal[i+'::'+def.canal] || {};
    var resultado = { datos: [], total: 0 };
    try{ resultado = await apiRequest('GET','/calidad/tipificacion/por-tipo?'+_tipificacionQueryString(campana, def.canal, compartido, deCanal)) || resultado; }catch(e){}
    var titulo = 'Tipificación de ' + def.titulo;
    if(resultado.total){
      out.push({ titulo: titulo, tipo: 'tabla', filas: resultado.datos.map(function(r){ return { Tipificacion: (typeof tipificacionEtiqueta==='function'?tipificacionEtiqueta(r.tipificacion):r.tipificacion), Cantidad: r.cantidad }; }) });
    } else {
      out.push({ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de ' + def.titulo + ' para el mes/filtros actuales.' });
    }
  }
  return out;
}

// Inasistencia (Fase 98, pedido URGENTE de Edwin; Fase 106, "que en
// Inasistencia solo quede en porcentaje, por mes"; Fase 108, pedido
// textual de InCo: filtros de sede/especialidad/entidad + sub-pestaña "Por
// especialidad"). Se llama UNA VEZ por panel `inasistencia_panel` del tab
// (hoy 2: vista 'pormes' y 'porespecialidad') -- "una hoja por vista,
// respetando los filtros" sale solo de que cada llamada exporta la hoja de
// SU propia vista, usando el mismo estado de filtros compartido que pinto
// la pantalla (_inasistenciaEstado, inasistencia.js) -- nunca vuelve a
// preguntar nada, nunca una fila cruda (solo mes/especialidad y %, Fase
// 106). La proteccion anti-formula (xlsxFilasSeguras, Fase 72) se aplica
// de forma generica mas abajo en este archivo a TODO lo que devuelva esto,
// no hace falta llamarla aqui.
async function _gdExportarInasistencia(p, i){
  var campana = p.campana;
  var vista = p.vista || 'pormes';
  var titulo = p.titulo || 'Inasistencia';
  var estado = _inasistenciaEstado[campana] || {};

  if(vista === 'porespecialidad'){
    var mesGlobal = estado.mes || (typeof _gd!=='undefined' ? _gd.mesSel : '');
    if(!mesGlobal) return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Inasistencia todavia.' }];
    var paramsEsp = new URLSearchParams();
    paramsEsp.set('campana', campana);
    paramsEsp.set('mes', mesGlobal);
    if(estado.sede) paramsEsp.set('sede', estado.sede);
    if(estado.entidad) paramsEsp.set('entidad', estado.entidad);
    var filasEsp = [];
    try{ filasEsp = await apiRequest('GET', '/calidad/inasistencia/especialidad?'+paramsEsp.toString()) || []; }catch(e){}
    if(!filasEsp.length) return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Inasistencia para ' + inasistenciaMesLbl(mesGlobal) + ' con estos filtros.' }];
    var conPct = filasEsp.map(function(f){ return { especialidad: f.especialidad, pct: inasistenciaPctPonderado(f.inasistencia, f.pendiente, f.total), total: f.total }; });
    var ordenadas = inasistenciaOrdenarBaseBaja(conPct, (typeof INASISTENCIA_BASE_BAJA_UMBRAL!=='undefined') ? INASISTENCIA_BASE_BAJA_UMBRAL : 30);
    return [{ titulo: titulo, tipo: 'tabla', filas: ordenadas.map(function(f){
      return { Especialidad: textoFormatoNombre(f.especialidad) + (f.baseBaja?' *':''), '% de inasistencia': f.pct===null?'':f.pct };
    }) }];
  }

  var paramsMes = new URLSearchParams();
  paramsMes.set('campana', campana);
  if(estado.sede) paramsMes.set('sede', estado.sede);
  if(estado.especialidad) paramsMes.set('especialidad', estado.especialidad);
  if(estado.entidad) paramsMes.set('entidad', estado.entidad);
  var datosPorMes = [];
  try{ datosPorMes = await apiRequest('GET', '/calidad/inasistencia/mensual?'+paramsMes.toString()) || []; }catch(e){}
  var agregado = inasistenciaAgregarPorMes(datosPorMes);
  if(!agregado.length) return [{ titulo: titulo, tipo: 'aviso', filas: [], mensaje: 'Sin datos de Inasistencia todavia.' }];
  // Fase 109: "Exportar trae los mismos valores de la tabla" -- la tabla de
  // datos debajo de la grafica de linea trae Mes/% de inasistencia/Total de
  // citas (ver _inasistenciaTablaHtml, inasistencia.js), mismas 3 columnas
  // aqui, mismo orden.
  return [{ titulo: titulo, tipo: 'tabla', filas: agregado.map(function(a){
    return { Mes: inasistenciaMesLbl(a.mes), '% de inasistencia': a.pct===null?'':a.pct, 'Total de citas': a.total };
  }) }];
}

// Calidad: KPIs + desglose del pie, con el filtro de asesor/fecha que este
// aplicado ahora mismo en el panel (_calDashEstado, el mismo que usa
// _gdRenderCalidad). calidad_pie se omite a proposito -- es la MISMA data
// de calidad_kpis, solo visualizada distinto; exportarla dos veces
// duplicaria la hoja sin aportar nada nuevo.
function _gdExportarCalidad(p, i){
  var camp = p.campana;
  var todos = (typeof CAL_DB!=='undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  var estado = _calDashEstado(camp, todos);
  var arr = calDashFiltrarMonitoreos(todos, { asesores: estado.asesores, desde: estado.desde, hasta: estado.hasta });
  var r = calDashResumen(arr);
  if(!r.total){
    return [{ titulo: 'Calidad', tipo: 'aviso', filas: [], mensaje: 'Sin monitoreos de Calidad para el filtro actual.' }];
  }
  return [{
    titulo: 'Calidad', tipo: 'tabla',
    filas: [{ 'Monitoreos Realizados': r.total, 'Puntaje Promedio': r.promedio, Clasificacion: r.clasificacion,
      Sobresaliente: r.sobresaliente, 'No Critico': r.noCritico, Critico: r.critico }],
  }];
}

async function _gdDatosPanelesTab(){
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  if(!tab) return [];
  var out = [];
  var panels = tab.panels || [];
  for(var i=0; i<panels.length; i++){
    var p = panels[i];
    if(p.tipo === 'kpi_row'){
      (p.items || []).forEach(function(it){ out.push({ titulo: it.titulo, tipo: 'kpi', filas: [{ Valor: _gdResolver(it.fuente).scalar }] }); });
      continue;
    }
    if(p.tipo === 'calidad_kpis'){ out = out.concat(_gdExportarCalidad(p, i)); continue; }
    if(p.tipo === 'calidad_pie'){ continue; } // misma data que calidad_kpis, ver comentario arriba
    // Fase 130: la barra por asesor (nombre + %) queda FUERA del export a
    // proposito -- un Excel con nombre+nota es una superficie de privacidad
    // nueva (quien lo descarga se lo lleva) que nadie pidio todavia; se deja
    // anotado en docs/pendientes.md para que el usuario decida si hace falta.
    if(p.tipo === 'calidad_bar_asesores'){ continue; }
    if(p.tipo === 'trafico_combo'){
      var dT = (typeof _traficoDatosExport === 'function') ? _traficoDatosExport(i) : [];
      out.push(dT.length ? { titulo: 'Trafico de Llamadas', tipo: 'tabla', filas: dT }
        : { titulo: 'Trafico de Llamadas', tipo: 'aviso', filas: [], mensaje: 'Sin datos de Trafico de Llamadas para el periodo/filtros actuales.' });
      continue;
    }
    if(p.tipo === 'trafico_whatsapp_combo'){
      var dW = (typeof _traficoWppDatosExport === 'function') ? _traficoWppDatosExport(i) : [];
      out.push(dW.length ? { titulo: 'Trafico de WhatsApp', tipo: 'tabla', filas: dW }
        : { titulo: 'Trafico de WhatsApp', tipo: 'aviso', filas: [], mensaje: 'Sin datos de Trafico de WhatsApp para el periodo/filtros actuales.' });
      continue;
    }
    if(p.tipo === 'agendas_panel'){ out = out.concat(await _gdExportarAgendas(p, i)); continue; }
    if(p.tipo === 'efectividad_agendamiento_panel'){ out = out.concat(await _gdExportarEfectividadAgendamiento(p, i)); continue; }
    if(p.tipo === 'inasistencia_panel'){ out = out.concat(await _gdExportarInasistencia(p, i)); continue; }
    if(p.tipo === 'efectividad_citas_panel'){ out = out.concat(await _gdExportarEfectividadCitas(p, i)); continue; }
    if(p.tipo === 'tipificacion_panel'){ out = out.concat(await _gdExportarTipificacion(p, i)); continue; }
    if(p.tipo === 'salida_panel'){ out = out.concat(await _gdExportarSalida(p, i)); continue; }
    if(p.tipo === 'llamadas_unicas_panel'){ out = out.concat(await _gdExportarLlamadasUnicas(p, i)); continue; }
    if(p.tipo === 'nota_kpi'){
      var valoresN = {};
      (p.valores || []).forEach(function(v){ valoresN[v.clave] = _gdResolver(v.fuente).scalar; });
      if(p.formula){
        var aN = valoresN[p.formula.a], bN = valoresN[p.formula.b];
        valoresN[p.formula.clave] = (aN===null||aN===undefined||bN===null||bN===undefined||!bN) ? null : Math.round((_gdNum(aN)/_gdNum(bN))*1000)/10;
      }
      out.push({ titulo: p.titulo, tipo: 'kpi', filas: [valoresN] });
      continue;
    }
    if(p.tipo === 'pie'){
      var r = _gdResolver(p.fuente);
      out.push({ titulo: p.titulo, tipo: 'pie', filas: (r.labels || []).map(function(l, idx){ return { Categoria: l, Valor: (r.values || [])[idx] }; }) });
      continue;
    }
    if(p.tipo === 'tabla'){
      var carga = _gdCargaMes(p.fuente.s);
      out.push({ titulo: p.titulo, tipo: 'tabla', filas: carga ? (carga.filas || []) : [] });
      continue;
    }
    if(p.tipo === 'line' || p.tipo === 'bar' || p.tipo === 'area' || p.tipo === 'combo'){
      var series = p.series || (p.barras || []).map(function(b){ return b; });
      if(p.linea) series = series.concat([p.linea]);
      var labels = null;
      var cols = {};
      series.forEach(function(s){
        var rr = _gdResolver(s.fuente);
        if(!labels) labels = rr.labels || [];
        cols[s.label || 'Serie'] = rr.values || [];
      });
      var filas = (labels || []).map(function(l, idx){
        var row = { Periodo: l };
        Object.keys(cols).forEach(function(c){ row[c] = cols[c][idx]; });
        return row;
      });
      out.push({ titulo: p.titulo, tipo: 'serie', filas: filas });
      continue;
    }
    // Fase 85: tipo de panel no reconocido -- un aviso claro, nunca se
    // rompe ni se ignora en silencio (ver GD_EXPORT_TIPOS_SOPORTADOS).
    out.push({ titulo: p.titulo || p.tipo || ('panel ' + i), tipo: 'aviso', filas: [], mensaje: 'Este panel (tipo "' + (p.tipo || '?') + '") todavia no tiene soporte de exportacion.' });
  }
  return out;
}

async function _gdExportExcel(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo exportar: no se pudo cargar el generador de Excel.'); return; }
  try{
    var wb = XLSX.utils.book_new();
    var mesLbl = _gd.mesSel ? _gdMesLbl(_gd.mesSel) : (_gd.periodos[0] ? _gdMesLbl(_gd.periodos[0]) : 's/d');
    // El aviso va PRIMERO (primera hoja que se ve al abrir el archivo) si los
    // datos de este dashboard son de demostracion — para que un Excel con
    // datos falsos nunca circule sin decirlo.
    xlsxAgregarAvisoDemo(wb);
    var usados = {};
    // Fase 100 (hallazgo real en produccion): ORLANT (y cualquier cliente
    // sin franja de KPIs arriba, layout.kpis:[]) exportaba una hoja "KPIs"
    // siempre vacia, sin ningun aviso -- mismo criterio que los paneles de
    // abajo (`if(!pan.filas.length) return;`): si no hay KPIs, no se agrega
    // la hoja en absoluto, en vez de agregarla vacia.
    var datosKpis = _gdDatosKpis();
    if(datosKpis.length){
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(datosKpis)), xlsxNombreHojaUnico('KPIs', usados));
    }
    var paneles = await _gdDatosPanelesTab();
    paneles.forEach(function(pan){
      var name = xlsxNombreHojaUnico(pan.titulo || 'Panel', usados);
      if(pan.tipo === 'aviso'){
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Aviso: pan.mensaje }]), name);
        return;
      }
      if(!pan.filas.length) return;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(pan.filas)), name);
    });
    XLSX.writeFile(wb, 'Dashboard_' + (_gd.cliente || '').replace(/\s+/g, '_') + '_' + mesLbl + '.xlsx');
  }catch(e){
    showToast('No se pudo exportar: ' + (e && e.message ? e.message : 'error desconocido') + '.');
  }
}

// PDF por impresion nativa: abre una ventana solo con el tablero + estilo de
// impresion y llama print(); el usuario elige "Guardar como PDF".
async function _gdExportPrint(){
  var w = window.open('', '_blank');
  if(!w){ showToast('No se pudo exportar: permite las ventanas emergentes para exportar a PDF.'); return; }
  try{
    var mesLbl = _gd.mesSel ? _gdMesLbl(_gd.mesSel) : (_gd.periodos[0] ? _gdMesLbl(_gd.periodos[0]) : 's/d');
    var kpis = _gdDatosKpis();
    var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
    var SEM_HEX = { VERDE: '#27ae60', AMARILLO: '#e67e22', ROJO: '#e74c3c' };
    var tblKpis = '<table><thead><tr><th>Indicador</th><th>Valor</th><th>Var. %</th><th>% Meta</th><th>Alerta</th><th>Semaforo</th></tr></thead><tbody>' +
      kpis.map(function(r){
        var semColorTd = r.Semaforo ? ('<td style="color:' + SEM_HEX[r.Semaforo] + ';font-weight:700">' + esc(r.Semaforo) + '</td>') : '<td></td>';
        return '<tr><td>' + esc(r.Indicador) + '</td><td>' + esc(_fmtCell(r.Valor)) + '</td><td>' + esc(_fmtCell(r['Var. %'])) +
        '</td><td>' + esc(_fmtCell(r['% Meta'])) + '</td><td>' + esc(r.Alerta || '') + '</td>' + semColorTd + '</tr>'; }).join('') + '</tbody></table>';
    var paneles = await _gdDatosPanelesTab();
    var secs = paneles.map(function(pan){
      if(pan.tipo === 'aviso'){
        return '<h3>' + esc(pan.titulo || '') + '</h3><p style="color:#92400e;font-style:italic">' + esc(pan.mensaje) + '</p>';
      }
      if(!pan.filas.length) return '';
      var keys = Object.keys(pan.filas[0]);
      return '<h3>' + esc(pan.titulo || '') + '</h3><table><thead><tr>' + keys.map(function(k){ return '<th>' + esc(k) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + pan.filas.map(function(f){ return '<tr>' + keys.map(function(k){ return '<td>' + esc(_fmtCell(f[k])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }).join('');
    // Mismo criterio que el Excel: si el dashboard tiene datos de demostracion,
    // el aviso va como lo PRIMERO que se ve — un PDF con datos falsos no puede
    // salir de la app sin decirlo.
    var avisoHtml = (typeof seedDemoActivo !== 'undefined' && seedDemoActivo)
      ? '<div style="background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:16px">' +
        '⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
      : '';
    w.document.write('<!doctype html><html><head><title>' + esc((_gd.config.titulo || _gd.cliente) + ' — ' + mesLbl) + '</title>' +
      '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}h2,h3{color:#0d4a5e}' +
      'table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}' +
      'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>' +
      avisoHtml +
      '<h1>' + esc(_gd.config.titulo || _gd.cliente) + '</h1><p>Periodo ' + esc(mesLbl) + ' — ' + esc(_gd.cliente) +
      (_gd.compSel ? ' · comparado con ' + esc(_gdMesLbl(_gd.compSel)) : '') + '</p>' +
      '<h2>Indicadores principales</h2>' + tblKpis +
      '<h2>' + esc(tab ? tab.label : '') + '</h2>' + secs +
      '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — ' + new Date().toLocaleString('es-CO') + '</p>' +
      '</body></html>');
    w.document.close();
    setTimeout(function(){ w.focus(); w.print(); }, 300);
  }catch(e){
    w.close();
    showToast('No se pudo exportar: ' + (e && e.message ? e.message : 'error desconocido') + '.');
  }
}
function _fmtCell(v){ return v === null || v === undefined || v === '' ? '' : (typeof v === 'number' ? v.toLocaleString('es-CO') : String(v)); }

// Menu de exportacion (lo llama exportGenericDashboard del boton del header).
// Fase 85: el menu se pintaba con position:absolute + z-index:50 -- por
// DEBAJO de #gd-overlay (z-index:600, styles.css), es decir INVISIBLE/
// INCLICABLE detras del propio dashboard en TODAS las pestanas (confirmado
// con Playwright: "…subtree intercepts pointer events" al hacer clic).
// Fix: position:fixed (getBoundingClientRect() ya es relativo al viewport,
// igual que fixed -- absolute podia desalinearse si la pagina estaba
// scrolleada) + z-index por encima del overlay, y un cierre al hacer clic
// afuera para que no quede pegado en pantalla.
// Fase 137 (Parte C, bug real de Escape): este es el UNICO popup
// interno ad-hoc de los 6 modales (nunca parte de MOTION_OVERLAY_STACK)
// -- se registra en motion-helpers.js al abrirse y se desregistra al
// cerrarse (en los 3 caminos: toggle de este mismo boton, clic afuera, y
// Escape) para que el Escape global cierre PRIMERO este popup (si sigue
// abierto) o se de por "gastado" un instante despues de que se cierre
// por cualquier otro camino -- nunca cascadea a cerrar el dashboard
// entero. Ver motion-helpers.js para el detalle completo del hallazgo.
function _gdExport(){
  var m = document.getElementById('gd-export-menu');
  if(m){ m.remove(); document.removeEventListener('click', _gdExportClickAfuera, true); if (typeof motionDesregistrarPopupInterno === 'function') motionDesregistrarPopupInterno('gd-export-menu'); return; }
  var btn = document.getElementById('gd-export-btn');
  m = document.createElement('div');
  m.id = 'gd-export-menu';
  m.style.cssText = 'position:fixed;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;box-shadow:0 8px 30px rgba(var(--shadow-rgb),.2);z-index:700;overflow:hidden;font-size:0.85rem';
  m.innerHTML =
    '<button style="display:block;width:100%;text-align:left;padding:9px 16px;border:none;background:none;cursor:pointer;color:var(--c-text)" onclick="_gdExportExcel();_gdExport()">Excel (.xlsx)</button>' +
    '<button style="display:block;width:100%;text-align:left;padding:9px 16px;border:none;background:none;cursor:pointer;color:var(--c-text);border-top:1px solid var(--c-border-soft2)" onclick="_gdExportPrint();_gdExport()">PDF / Imprimir</button>';
  var r = btn.getBoundingClientRect();
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.max(8, r.right - 160) + 'px';
  m.style.width = '160px';
  document.body.appendChild(m);
  if (typeof motionRegistrarPopupInterno === 'function') motionRegistrarPopupInterno('gd-export-menu', _gdExport);
  setTimeout(function(){ document.addEventListener('click', _gdExportClickAfuera, true); }, 0);
}
function _gdExportClickAfuera(ev){
  var m = document.getElementById('gd-export-menu');
  var btn = document.getElementById('gd-export-btn');
  if(!m) return;
  if(m.contains(ev.target) || (btn && btn.contains(ev.target))) return;
  m.remove();
  document.removeEventListener('click', _gdExportClickAfuera, true);
  if (typeof motionDesregistrarPopupInterno === 'function') motionDesregistrarPopupInterno('gd-export-menu');
}
