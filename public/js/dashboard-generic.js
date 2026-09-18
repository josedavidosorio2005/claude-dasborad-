// dashboard-generic.js — InConexion Platform. FASE 3.
// Un unico modulo que renderiza CUALQUIER dashboard de cliente a partir de su
// configuracion (GET /api/dashboard/<cliente> -> {config, secciones:cargas}).
// Ya no hay un archivo JS por cliente: crear un dashboard = crear su config.
//
// Tipos de panel: kpi_row | line | bar | pie | combo | tabla | calidad_kpis | calidad_pie
// Ver server/dashboard-config-seed.js para la forma de la config y las "fuentes".

var _gd = {
  cliente: null, config: null, cargas: {}, periodos: [],
  mesSel: '', compSel: '', vistaSel: '', tab: null, charts: {}
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
    var a = _gdNum(row[f.a]), b = _gdNum(row[f.b]);
    if(f.formula === 'a+b') return a + b;
    if(f.formula === 'a-b') return a - b;
    if(f.formula === 'a/b*100') return b ? Math.round((a/b)*1000)/10 : 0;
    if(f.formula === 'a/b') return b ? a/b : 0;
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
  var cls;
  if(semColor){
    cls = _gdSemaforoClase(semColor);
  } else if(k.semaforo && cur !== null && cur !== undefined){
    // Compatibilidad: KPI con el semaforo binario viejo (un solo umbral
    // quemado en la config) y sin fila en umbrales_semaforo todavia.
    cls = _gdNum(cur) >= k.semaforo ? 'kpi-green' : 'kpi-red';
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
  if(meta !== null && meta !== undefined && meta !== 0 && cur !== null && cur !== undefined){
    var av = Math.round((cur / meta) * 1000) / 10;
    var avColor = _gdSemaforoColor(av, { metrica: 'cumplimiento_meta' });
    var mcls = avColor==='verde' ? 'gd-meta-ok' : avColor==='amarillo' ? 'gd-meta-warn' : avColor==='rojo' ? 'gd-meta-bad'
      : (av >= 100 ? 'gd-meta-ok' : (av >= 80 ? 'gd-meta-warn' : 'gd-meta-bad')); // sin umbral configurado: mismo default de siempre
    metaHtml = '<div class="gd-kpi-meta ' + mcls + '"><span class="gd-meta-bar"><i style="width:' +
      Math.max(0, Math.min(100, av)) + '%"></i></span>' + av + '% de la meta (' + _gdFmt(meta, k.formato) + ')</div>';
  }

  return '<div class="aurora-kpi gd-kpi ' + cls + (alerta ? ' gd-kpi-alerta' : '') + '">' +
    (alerta ? '<div class="gd-kpi-flag" title="Valor fuera del rango esperado">⚠</div>' : '') +
    '<div class="kv">' + txt + '</div><div class="kl">' + esc(k.titulo) + '</div>' +
    trendHtml + metaHtml + '</div>';
}

// ── Chart helpers (reutiliza lo/loBar/loPie/paleta de charts.js) ──
function _gdChart(canvasId, cfg){
  var el = document.getElementById(canvasId);
  if(!el) return;
  if(_gd.charts[canvasId]){ try{ _gd.charts[canvasId].destroy(); }catch(e){} delete _gd.charts[canvasId]; }
  var empty = !cfg || !cfg.data || !cfg.data.labels || cfg.data.labels.length===0 ||
    (cfg.data.datasets||[]).every(function(d){ return !(d.data||[]).some(function(v){ return v!==null && v!==undefined; }); });
  var card = el.closest ? el.closest('.aurora-card') : null;
  var note = card ? card.querySelector('.oc-nodata') : null;
  if(empty){
    el.style.display = 'none';
    if(card && !note){
      note = document.createElement('div');
      note.className = 'oc-nodata';
      note.style.cssText = 'text-align:center;color:#9bb0bb;font-size:0.8rem;padding:24px 8px';
      note.textContent = 'Sin datos cargados para este periodo';
      card.appendChild(note);
    }
    return;
  }
  if(note) note.remove();
  el.style.display = '';
  _gd.charts[canvasId] = new Chart(el, cfg);
}

// ── Apertura ────────────────────────────────────────────────
async function openGenericDashboard(cliente){
  document.getElementById('gd-overlay').classList.add('show');
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
  document.getElementById('gd-overlay').classList.add('show');
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
  var set = {};
  Object.keys(_gd.cargas).forEach(function(s){ (_gd.cargas[s]||[]).forEach(function(c){ set[c.periodo] = true; }); });
  _gd.periodos = Object.keys(set).sort().reverse();
  _gd.mesSel = '';
  _gd.compSel = '';
  _gd.vistaSel = (_gd.config.vista && _gd.config.vista.opciones[0] && _gd.config.vista.opciones[0].valor) || '';

  var campanas = {};
  (_gd.config.layout.tabs || []).forEach(function(t){
    (t.panels || []).forEach(function(p){ if(p.tipo && p.tipo.indexOf('calidad')===0 && p.campana) campanas[p.campana] = true; });
  });
  for(var camp in campanas){ try{ await loadCalData(camp); }catch(e){} }
  await _gdCargarUmbrales();

  renderGenericHeader();
  renderGenericKpis();
  renderGenericTabs();
  var first = (_gd.config.layout.tabs || [])[0];
  switchGenericTab(first ? first.key : null);
  renderGenericBanner();
}
function closeGenericDashboard(){
  document.getElementById('gd-overlay').classList.remove('show');
  Object.keys(_gd.charts).forEach(function(k){ try{_gd.charts[k].destroy();}catch(e){} delete _gd.charts[k]; });
}
document.getElementById('gd-overlay').addEventListener('click',function(e){ if(e.target===this) closeGenericDashboard(); });

function renderGenericHeader(){
  document.getElementById('gd-title').textContent = _gd.config.titulo || _gd.cliente;
  var sub = document.getElementById('gd-sub');
  var mesLbl = _gd.mesSel ? _gdMesLbl(_gd.mesSel) : (_gd.periodos[0] ? _gdMesLbl(_gd.periodos[0]) : 'Sin datos');
  sub.textContent = 'Informe ' + mesLbl + ' — ' + _gd.cliente;

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
    ? _gd.periodos.map(function(p){ return '<option value="'+p+'">'+_gdMesLbl(p)+'</option>'; }).join('')
    : '<option value="">Sin datos</option>';
  ms.value = _gd.mesSel || (_gd.periodos[0] || '');

  // "Comparar contra": periodo anterior automatico + cualquier periodo previo.
  var cs = document.getElementById('gd-comp-sel');
  if(cs){
    var verMes = ms.value;
    var previos = _gd.periodos.filter(function(p){ return !verMes || p < verMes; });
    cs.innerHTML = '<option value="">Periodo anterior (auto)</option>' +
      previos.map(function(p){ return '<option value="'+p+'">'+_gdMesLbl(p)+'</option>'; }).join('');
    cs.value = _gd.compSel && previos.indexOf(_gd.compSel) !== -1 ? _gd.compSel : '';
    if(cs.value !== _gd.compSel) _gd.compSel = cs.value;
  }
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

function renderGenericBanner(){
  var host = document.getElementById('gd-kpis');
  var hayCargas = Object.keys(_gd.cargas).some(function(s){ return (_gd.cargas[s]||[]).length; });
  var esModulo = _gd.cliente === 'INVENTARIO' || _gd.cliente === 'GERENCIA';
  var ex = document.getElementById('gd-nodata-banner');
  if(hayCargas || esModulo){ if(ex) ex.remove(); return; }
  if(ex) return;
  var d = document.createElement('div');
  d.id = 'gd-nodata-banner';
  d.style.cssText = 'grid-column:1/-1;background:#fff4e5;border:1px solid #f0c98a;border-radius:8px;padding:12px 16px;color:#8a5a12;font-size:0.85rem';
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

function renderGenericTabs(){
  var tabs = (_gd.config.layout.tabs || []);
  document.getElementById('gd-tabs').innerHTML = tabs.map(function(t){
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
});

function switchGenericTab(key){
  _gd.tab = key;
  document.querySelectorAll('#gd-tabs .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.gdtab===key); });
  Object.keys(_gd.charts).forEach(function(k){ try{_gd.charts[k].destroy();}catch(e){} delete _gd.charts[k]; });
  renderGenericTab(key);
}

function renderGenericTab(key){
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key===key; });
  var host = document.getElementById('gd-panels');
  if(!tab){ host.innerHTML = ''; return; }
  var panels = tab.panels || [];

  // KPI-row panels van fuera de la rejilla; el resto en una rejilla de 2 columnas
  var html = '';
  panels.forEach(function(p, i){
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
    } else if(p.tipo === 'trafico_combo'){
      // Panel grande y autonomo (filtros + KPIs + grafica + export propios):
      // no entra en la rejilla de 2 columnas, ocupa el ancho completo.
      html += '<div id="gd-p'+i+'"></div>';
    } else if(p.tipo === 'nota_kpi'){
      // KPI anual con texto explicativo (ej. efectividad de ordenamiento
      // medico): es texto, no un grafico — mismo criterio que trafico_combo,
      // ancho completo, sin canvas.
      html += '<div id="gd-p'+i+'"></div>';
    }
  });
  var chartPanels = panels.map(function(p,i){ return {p:p,i:i}; }).filter(function(x){ return x.p.tipo!=='kpi_row' && x.p.tipo!=='calidad_kpis' && x.p.tipo!=='tabla' && x.p.tipo!=='trafico_combo' && x.p.tipo!=='nota_kpi'; });
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
      var totalSpan = x.p.filtroSerie ? '<span id="gd-serietot-'+x.i+'" style="font-size:0.72rem;color:#7a9ba8;font-weight:600;margin-left:10px"></span>' : '';
      var notasDiv = (x.p.notas && x.p.notas.length) ? '<div id="gd-notas-'+x.i+'" style="padding:10px 4px 2px;font-size:0.74rem;color:#5c7681;line-height:1.5"></div>' : '';
      return '<div class="aurora-card"><div class="aurora-card-title' + (tools ? ' gd-flex' : '') + '">' +
        '<span>' + esc(x.p.titulo || '') + '</span>' + totalSpan + tools + '</div>' + filtroDiv +
        '<div class="aurora-chart-wrap" style="height:230px"><canvas id="gd-c'+x.i+'"></canvas></div>' + notasDiv + '</div>';
    }).join('') + '</div>';
  }
  host.innerHTML = html;

  panels.forEach(function(p, i){ _gdRenderPanel(p, i); });
}

function _gdRenderPanel(p, i){
  if(p.tipo === 'kpi_row'){
    var el = document.getElementById('gd-p'+i); if(!el) return;
    el.innerHTML = (p.items||[]).map(_gdKpiCardHtml).join('');
    return;
  }

  if(p.tipo === 'calidad_kpis' || p.tipo === 'calidad_pie'){ _gdRenderCalidad(p, i); return; }

  if(p.tipo === 'trafico_combo'){ _traficoRenderPanel(p, i); return; }

  if(p.tipo === 'nota_kpi'){ _gdRenderNotaKpi(p, i); return; }

  if(p.tipo === 'tabla'){
    var t = document.getElementById('gd-p'+i); if(!t) return;
    var r = _gdResolver(p.fuente); // espera modo:'filas'
    var cols = p.columnas || [];
    var carga = _gdCargaMes(p.fuente.s);
    var filas = carga ? (carga.filas||[]) : [];
    var html = '<tr>'+cols.map(function(c){ return '<th>'+esc(c.label)+'</th>'; }).join('')+'</tr>';
    if(!filas.length) html += '<tr><td colspan="'+cols.length+'" style="text-align:center;color:#9bb0bb">Sin datos cargados</td></tr>';
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
      options: loPie() });
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
    if(eff==='bar' && p.horizontal){ opts.indexAxis='y'; opts.scales.x={ticks:{font:{size:7}}}; opts.scales.y={ticks:{font:{size:7}}}; }
    _gdChart(canvasId, { type: esLinea ? 'line' : 'bar', data:{ labels: labels||[], datasets: datasets }, options: opts });
    _gdRenderNotasPanel(p, i);
    return;
  }

  if(p.tipo === 'combo'){
    var barras = (p.barras||[]).map(function(b){
      var rb = _gdResolver(b.fuente);
      return { _r: rb, ds: { type:'bar', label:b.label, data: rb.values||[], backgroundColor: paletaColorPara(b.label), borderRadius:3, yAxisID:'y' } };
    });
    var labels2 = (barras[0] && barras[0]._r.labels) || [];
    var lin = p.linea ? _gdResolver(p.linea.fuente) : null;
    var ds = barras.map(function(x){ return x.ds; });
    if(lin){
      if(!labels2.length) labels2 = lin.labels || [];
      ds.push({ type:'line', label:p.linea.label, data: lin.values||[], borderColor:(typeof CO!=='undefined'?CO:'#e67e22'), borderWidth:2.5, pointRadius:4, tension:0.3, yAxisID:'y2' });
    }
    var o = loBar();
    o.scales = {
      y:{ position:'left', grid:{color:'#f0f4f8'}, ticks:{font:{size:8}} },
      y2:{ position:'right', grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return v+'%'; }} },
      x:{ grid:{display:false}, ticks:{font:{size:8}} }
    };
    o.plugins.datalabels = { display:true, align:'end', anchor:'end', font:{size:7,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
      formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null?v+'%':'') : v; } };
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
    '<div style="padding:6px 4px 2px;font-size:0.92rem;line-height:1.6;color:#2a4a58">' + texto + '</div></div>';
}

// ── Paneles de Calidad (usan CAL_DB de la Fase 1) ───────────
// Filtro de asesor/fecha (extiende el patron combinable de Trafico de
// Llamadas a Calidad, 2026-09-16): estado compartido por campana entre
// calidad_kpis y calidad_pie (son dos paneles separados de la misma
// pestaña, "tabCalidad" siempre los emite juntos) — la barra de filtro se
// dibuja una sola vez (en calidad_kpis, que va primero) y calidad_pie lee
// el mismo estado sin dibujar una segunda barra redundante. A diferencia
// del selector de mes global (_gd.mesSel), este filtro es autonomo como el
// de Trafico: no sigue al selector de mes de arriba, tiene su propio rango.
var _calDashFiltro = {}; // por campana: { asesores:[...]|null, desde, hasta }

function _calDashEstado(camp, todos){
  if(!_calDashFiltro[camp]){
    var fechas = todos.map(function(m){ return m.fecha; }).filter(Boolean).sort();
    var minF = fechas[0], maxF = fechas[fechas.length-1];
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
          asesoresDisp.map(function(a){ return '<option value="'+esc(a)+'"'+(estado.asesores.indexOf(a)!==-1?' selected':'')+'>'+esc(a)+'</option>'; }).join('') +
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
    var qaColor = _gdSemaforoColor(r.total ? r.promedio : null, { metrica: 'qa_promedio', campana: camp });
    var qaCls = qaColor ? _gdSemaforoClase(qaColor) : (r.promedio>=90?'kpi-green':r.promedio>=70?'kpi-org':'kpi-red');
    el.innerHTML =
      '<div class="aurora-kpi"><div class="kv">'+r.total+'</div><div class="kl">Monitoreos Realizados</div></div>'+
      '<div class="aurora-kpi '+qaCls+'"><div class="kv">'+(r.total?r.promedio:'—')+'</div><div class="kl">Puntaje Promedio de Calidad</div></div>'+
      '<div class="aurora-kpi '+qaCls+'"><div class="kv" style="font-size:1rem">'+r.clasificacion+'</div><div class="kl">Clasificacion General</div></div>';
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
    options: loPie() });
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
      '% Meta': meta ? Math.round((cur / meta) * 1000) / 10 : '',
      Alerta: _gdFueraDeRango(cur, comp.scalar, k) ? 'FUERA DE RANGO' : '',
      Semaforo: (function(){
        var c = _gdSemaforoColor(cur, k);
        return c ? c.toUpperCase() : '';
      })(),
    };
  });
}
function _gdDatosPanelesTab(){
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  if(!tab) return [];
  var out = [];
  (tab.panels || []).forEach(function(p){
    if(p.tipo === 'kpi_row'){
      (p.items || []).forEach(function(it){ out.push({ titulo: it.titulo, tipo: 'kpi', filas: [{ Valor: _gdResolver(it.fuente).scalar }] }); });
      return;
    }
    if(p.tipo && p.tipo.indexOf('calidad') === 0) return;
    if(p.tipo === 'trafico_combo') return; // export propio (filtros/fecha no son los de _gd)
    if(p.tipo === 'nota_kpi'){
      var valoresN = {};
      (p.valores || []).forEach(function(v){ valoresN[v.clave] = _gdResolver(v.fuente).scalar; });
      if(p.formula){
        var aN = valoresN[p.formula.a], bN = valoresN[p.formula.b];
        valoresN[p.formula.clave] = (aN===null||aN===undefined||bN===null||bN===undefined||!bN) ? null : Math.round((_gdNum(aN)/_gdNum(bN))*1000)/10;
      }
      out.push({ titulo: p.titulo, tipo: 'kpi', filas: [valoresN] });
      return;
    }
    if(p.tipo === 'pie'){
      var r = _gdResolver(p.fuente);
      out.push({ titulo: p.titulo, tipo: 'pie', filas: (r.labels || []).map(function(l, idx){ return { Categoria: l, Valor: (r.values || [])[idx] }; }) });
      return;
    }
    if(p.tipo === 'tabla'){
      var carga = _gdCargaMes(p.fuente.s);
      out.push({ titulo: p.titulo, tipo: 'tabla', filas: carga ? (carga.filas || []) : [] });
      return;
    }
    // line / bar / area / combo -> serie(s)
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
  });
  return out;
}

function _gdExportExcel(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var wb = XLSX.utils.book_new();
  var mesLbl = _gd.mesSel ? _gdMesLbl(_gd.mesSel) : (_gd.periodos[0] ? _gdMesLbl(_gd.periodos[0]) : 's/d');
  // El aviso va PRIMERO (primera hoja que se ve al abrir el archivo) si los
  // datos de este dashboard son de demostracion — para que un Excel con
  // datos falsos nunca circule sin decirlo.
  xlsxAgregarAvisoDemo(wb);
  var usados = {};
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(_gdDatosKpis()), xlsxNombreHojaUnico('KPIs', usados));
  _gdDatosPanelesTab().forEach(function(pan){
    if(!pan.filas.length) return;
    var name = xlsxNombreHojaUnico(pan.titulo || 'Panel', usados);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pan.filas), name);
  });
  XLSX.writeFile(wb, 'Dashboard_' + (_gd.cliente || '').replace(/\s+/g, '_') + '_' + mesLbl + '.xlsx');
}

// PDF por impresion nativa: abre una ventana solo con el tablero + estilo de
// impresion y llama print(); el usuario elige "Guardar como PDF".
function _gdExportPrint(){
  var mesLbl = _gd.mesSel ? _gdMesLbl(_gd.mesSel) : (_gd.periodos[0] ? _gdMesLbl(_gd.periodos[0]) : 's/d');
  var kpis = _gdDatosKpis();
  var tab = (_gd.config.layout.tabs || []).find(function(t){ return t.key === _gd.tab; });
  var w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para exportar a PDF.'); return; }
  var SEM_HEX = { VERDE: '#27ae60', AMARILLO: '#e67e22', ROJO: '#e74c3c' };
  var tblKpis = '<table><thead><tr><th>Indicador</th><th>Valor</th><th>Var. %</th><th>% Meta</th><th>Alerta</th><th>Semaforo</th></tr></thead><tbody>' +
    kpis.map(function(r){
      var semColorTd = r.Semaforo ? ('<td style="color:' + SEM_HEX[r.Semaforo] + ';font-weight:700">' + esc(r.Semaforo) + '</td>') : '<td></td>';
      return '<tr><td>' + esc(r.Indicador) + '</td><td>' + esc(_fmtCell(r.Valor)) + '</td><td>' + esc(_fmtCell(r['Var. %'])) +
      '</td><td>' + esc(_fmtCell(r['% Meta'])) + '</td><td>' + esc(r.Alerta || '') + '</td>' + semColorTd + '</tr>'; }).join('') + '</tbody></table>';
  var secs = _gdDatosPanelesTab().filter(function(p){ return p.filas.length; }).map(function(pan){
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
}
function _fmtCell(v){ return v === null || v === undefined || v === '' ? '' : (typeof v === 'number' ? v.toLocaleString('es-CO') : String(v)); }

// Menu de exportacion (lo llama exportGenericDashboard del boton del header).
function _gdExport(){
  var m = document.getElementById('gd-export-menu');
  if(m){ m.remove(); return; }
  var btn = document.getElementById('gd-export-btn');
  m = document.createElement('div');
  m.id = 'gd-export-menu';
  m.style.cssText = 'position:absolute;background:#fff;border:1px solid #dde8ef;border-radius:8px;box-shadow:0 8px 30px rgba(13,74,94,.2);z-index:50;overflow:hidden;font-size:0.85rem';
  m.innerHTML =
    '<button style="display:block;width:100%;text-align:left;padding:9px 16px;border:none;background:none;cursor:pointer;color:#2a4a58" onclick="_gdExportExcel();_gdExport()">Excel (.xlsx)</button>' +
    '<button style="display:block;width:100%;text-align:left;padding:9px 16px;border:none;background:none;cursor:pointer;color:#2a4a58;border-top:1px solid #edf2f6" onclick="_gdExportPrint();_gdExport()">PDF / Imprimir</button>';
  var r = btn.getBoundingClientRect();
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.max(8, r.right - 160) + 'px';
  m.style.width = '160px';
  document.body.appendChild(m);
}
