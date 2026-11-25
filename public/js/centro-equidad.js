// centro-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, 24/11/2026) en el Centro de cargas
// («Cargar bases»), como la sección «Horarios». Tres bases: Pólizas, Medicina prepagada y Particulares.
// Desde el 26/11 (pedido de Edwin) cada base se carga POR MES, con la misma cuadrícula de meses de las demás cargas
// (año del selector de arriba): subir un mes no borra los otros; «Reemplazar» cambia solo esa base en ese mes.
// El Excel se lee en el navegador (equidad-logic.js) y al servidor solo van sede, especialidad, profesional, fecha y,
// en Pólizas y Medicina prepagada, la entidad. Debajo, la lista de entidades y la opción de la cuenta cliente.
'use strict';

var _ceq = { gen: 0, grupo: null, base: 'polizas', mes: null, datos: null };
function _ceqEl(id) { return document.getElementById(id); }
function _ceqAnio() { return (typeof _cc !== 'undefined' && _cc && _cc.anio) ? Number(_cc.anio) : new Date().getFullYear(); }
function _ceqMesActual() { return typeof _ccMesActual === 'function' ? _ccMesActual() : new Date().toISOString().slice(0, 7); }

async function ccEquidadPintar(cliente) {
  var c = _ceqEl('cc-equidad');
  if (!c) return;
  var gen = ++_ceq.gen;
  c.innerHTML = '';
  c.hidden = true;
  if (cliente !== 'ORLANT') return;
  var r;
  try { r = await apiRequest('GET', '/orlant/equidad/resumen'); }
  catch (e) { return; } // sin permiso de carga: la sección no se muestra
  if (gen !== _ceq.gen || !r) return;
  _ceq.datos = r;
  c.innerHTML = ccEquidadHtml(r, _ceqAnio(), _ceq.base, _ceqMesActual(), ccEquidadEsAdmin());
  c.hidden = false;
}
function ccEquidadElegirBase(id) { _ceq.base = id; if (_ceq.datos) { var c = _ceqEl('cc-equidad'); if (c) c.innerHTML = ccEquidadHtml(_ceq.datos, _ceqAnio(), _ceq.base, _ceqMesActual(), ccEquidadEsAdmin()); } }

// Los 12 meses del año con lo cargado de una base: [{ mes, registros, ultimaCarga, cargadoPor, archivo }]. Puro.
function ccEquidadMesesDelAnio(grupo, anio) {
  var porMes = {};
  ((grupo && grupo.meses) || []).forEach(function (m) { porMes[m.mes] = m; });
  var out = [];
  for (var i = 1; i <= 12; i++) {
    var mes = anio + '-' + (i < 10 ? '0' : '') + i, x = porMes[mes];
    out.push({ mes: mes, registros: x ? x.citas : 0, ultimaCarga: x ? x.cargadoEn : '', cargadoPor: x ? x.cargadoPor : '', archivo: x ? x.archivo : '' });
  }
  return out;
}

// HTML de la sección. Puro (se prueba en Node; usa los ayudantes de centro-cargas-logic.js).
function ccEquidadHtml(r, anio, baseSel, mesActual, esAdmin) {
  if (esAdmin === undefined) esAdmin = ccEquidadEsAdmin();
  anio = Number(anio) || new Date().getFullYear();
  mesActual = mesActual || new Date().toISOString().slice(0, 7);
  var grupos = r.grupos || [];
  var g = grupos.filter(function (x) { return x.id === baseSel; })[0] || grupos[0] || null;
  var selector = !g ? '' : '<div class="cc-selector" role="group" aria-label="Base de Equidad">' +
    '<span class="cc-selector-titulo">Base:</span>' + grupos.map(function (x) {
      var n = (x.meses || []).length;
      return '<button type="button" class="cc-selector-op' + (x.id === g.id ? ' on' : '') + '" aria-pressed="' + (x.id === g.id) + '" onclick="ccEquidadElegirBase(\'' + esc(x.id) + '\')">' +
        esc(x.nombre) + ' <span class="cc-eq-nmeses">· ' + n + (n === 1 ? ' mes' : ' meses') + '</span></button>';
    }).join('') + '</div>';
  var celdas = !g ? '' : ccEquidadMesesDelAnio(g, anio).map(function (x) {
    var est = centroEstadoMes(x, mesActual);
    var nombre = centroNombreMes(x.mes).split(' ')[0];
    var etiqueta = { cargado: 'Cargado', vacio: 'Sin datos', en_curso: 'En curso', futuro: 'Próximo' }[est];
    return '<div class="cc-mes cc-mes-' + est + (x.registros > 0 ? ' cc-mes-con' : '') + '">' +
      '<div class="cc-mes-cab"><span class="cc-mes-nombre">' + esc(nombre) + '</span><span class="cc-pill cc-pill-' + est + '">' + etiqueta + '</span></div>' +
      (x.registros > 0
        ? '<div class="cc-mes-num">' + Number(x.registros).toLocaleString('es-CO') + ' citas</div>' +
          (x.ultimaCarga ? '<div class="cc-mes-meta">' + esc(centroFechaCorta(x.ultimaCarga)) + (x.cargadoPor ? ' · ' + esc(x.cargadoPor) : '') + '</div>' : '') +
          (x.archivo ? '<div class="cc-mes-archivo" title="' + esc(x.archivo) + '">' + esc(x.archivo) + '</div>' : '')
        : '<div class="cc-mes-num cc-mes-num-vacio">—</div>') +
      '<div class="cc-mes-acciones">' + (est !== 'futuro'
        ? '<button type="button" class="cc-accion cc-accion-primaria" onclick="ccEquidadElegir(\'' + esc(g.id) + '\',\'' + esc(x.mes) + '\')" aria-label="' + (x.registros > 0 ? 'Reemplazar' : 'Subir') + ' ' + esc(g.nombre) + ' de ' + esc(nombre) + '">' +
          (typeof iconoSvg === 'function' ? iconoSvg('upload') : '') + (x.registros > 0 ? ' Reemplazar' : ' Subir') + '</button>' : '') + '</div></div>';
  }).join('');
  var ent = r.entidades || { polizas: [], prepagada: [] };
  return '<section class="cc-carga cc-equidad" aria-labelledby="cc-equidad-tit">' +
    '<div class="cc-carga-cab"><h3 id="cc-equidad-tit">Equidad profesionales <span class="cc-carga-anio">' + Number(anio) + '</span></h3></div>' +
    '<p class="cc-intro">Cada base se carga <b>por mes</b>: subir un mes no borra los demás y «Reemplazar» cambia solo esa base en ese mes. ' +
    'Solo se guardan sede, especialidad, profesional, fecha de la cita y la entidad (Particulares no lleva entidad).</p>' +
    (g ? selector +
    '<p class="cc-eq-cols">Columnas de ' + esc(g.nombre) + ': <b>MEDNOM</b> y <b>FECHA_CITA</b>; opcionales CODIGO_SEDE, ESPNOM' + (g.conEntidad ? ' y NOMBRE_ENTIDAD' : ' (esta base no lleva entidad)') + '. Todas las citas del archivo deben ser del mes que elijas.</p>' +
    '<div class="cc-meses">' + celdas + '</div>' : '') +
    '<input type="file" id="cc-equidad-archivo" accept=".xlsx,.xls,.csv" hidden onchange="ccEquidadSubir(this)">' +
    '<div id="cc-equidad-res" aria-live="polite"></div>' +
    '<details class="cc-eq-ent"><summary>Entidades: cuáles son pólizas y cuáles prepagadas</summary>' +
    '<p class="cc-intro">Una entidad por renglón. Al cargar, avisa si una base trae entidades de la otra lista (no mueve ni borra citas).</p>' +
    '<div class="cc-eq-ent-grid"><div class="ig"><label for="cc-eq-ent-polizas">Pólizas</label><textarea id="cc-eq-ent-polizas" rows="6">' + esc((ent.polizas || []).join('\n')) + '</textarea></div>' +
    '<div class="ig"><label for="cc-eq-ent-prepagada">Medicina prepagada</label><textarea id="cc-eq-ent-prepagada" rows="6">' + esc((ent.prepagada || []).join('\n')) + '</textarea></div></div>' +
    '<button type="button" class="btn-cancel" onclick="ccEquidadGuardarEntidades()">Guardar entidades</button><div id="cc-eq-ent-res" aria-live="polite"></div></details>' +
    (esAdmin ? '<div class="cc-eq-cliente"><label class="cc-eq-check"><input type="checkbox" id="cc-eq-visible-cliente"' + (r.visibleCliente ? ' checked' : '') + ' onchange="ccEquidadVisibleCliente(this)"> ' +
      '<span>La cuenta cliente de ORLANT ve «Equidad profesionales» (con los nombres de los profesionales)</span></label>' +
      '<p class="cc-intro">Encenderlo solo con el OK de Edwin.</p><div id="cc-eq-cliente-res" aria-live="polite"></div></div>' : '') + '</section>';
}

// Resultado de una carga. Puro.
function ccEquidadResultadoHtml(nombre, r, avisos) {
  var otras = r.otraBase || [];
  var NOM = { polizas: 'Pólizas', prepagada: 'Medicina prepagada' };
  var mes = r.mes && typeof centroNombreMes === 'function' ? ' de ' + centroNombreMes(r.mes) : '';
  return '<div class="cc-aviso" role="status">' + esc(nombre) + esc(mes) + ': ' + Number(r.filas).toLocaleString('es-CO') + ' citas cargadas' +
    (r.reemplazadas ? ' (reemplazan ' + Number(r.reemplazadas).toLocaleString('es-CO') + ')' : '') + '.</div>' +
    (avisos || []).map(function (a) { return '<div class="cc-aviso cc-aviso-falta">' + esc(a) + '</div>'; }).join('') +
    (otras.length ? '<div class="cc-aviso cc-aviso-falta"><strong>' + otras.length + ' entidad(es) de la lista de otra base</strong> (se cargaron igual):<ul>' +
      otras.map(function (o) { return '<li>' + esc(o.entidad) + ' · ' + o.citas + ' citas · lista de ' + esc(NOM[o.base] || o.base) + '</li>'; }).join('') + '</ul></div>' : '');
}

function ccEquidadElegir(grupo, mes) {
  _ceq.grupo = grupo;
  _ceq.mes = mes;
  var i = _ceqEl('cc-equidad-archivo');
  if (i) { i.value = ''; i.click(); }
}

async function ccEquidadSubir(input) {
  var f = input.files && input.files[0];
  var res = _ceqEl('cc-equidad-res');
  var g = eqGrupo(_ceq.grupo);
  var mes = _ceq.mes;
  if (!f || !g || !eqMesValido(mes)) return;
  res.innerHTML = '<p class="cc-cargando">Leyendo ' + esc(f.name) + '…</p>';
  try {
    var wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
    var hojas = wb.SheetNames.map(function (n) { return { nombre: n, aoa: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }) }; });
    var p = eqLeerLibro(hojas, g.id);
    if (!p.ok) { res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(p.error) + '</div>'; return; }
    var r = await apiRequest('POST', '/orlant/equidad/cargas/' + encodeURIComponent(g.id), { mes: mes, archivoNombre: f.name.slice(0, 120), hoja: p.hoja, filas: p.filas });
    var guardado = ccEquidadResultadoHtml(g.nombre, r, p.avisos);
    showToast('Base de ' + g.nombre + ' cargada', 'ok');
    await ccEquidadPintar('ORLANT');
    var res2 = _ceqEl('cc-equidad-res'); if (res2) res2.innerHTML = guardado;
  } catch (e) {
    res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(e.message || 'No se pudo cargar el archivo') + '</div>';
  }
}

function ccEquidadEsAdmin() { return typeof isFullAdmin === 'function' && isFullAdmin(); }

// Opción «la ve la cuenta cliente» (solo el administrador; apagada por defecto).
async function ccEquidadVisibleCliente(input) {
  var res = _ceqEl('cc-eq-cliente-res');
  var quiere = !!input.checked;
  try {
    var r = await apiRequest('PUT', '/orlant/equidad/opciones', { visibleCliente: quiere });
    input.checked = !!r.visibleCliente;
    res.innerHTML = '<div class="cc-aviso" role="status">' + (r.visibleCliente ? 'La cuenta cliente de ORLANT ya ve la pestaña (al volver a abrir su tablero).' : 'La cuenta cliente de ORLANT no ve la pestaña.') + '</div>';
  } catch (e) {
    input.checked = !quiere;
    res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(e.message || 'No se pudo cambiar') + '</div>';
  }
}

function ccEquidadLista(id) {
  var t = _ceqEl(id);
  return String(t ? t.value : '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
}

async function ccEquidadGuardarEntidades() {
  var res = _ceqEl('cc-eq-ent-res');
  try {
    var r = await apiRequest('PUT', '/orlant/equidad/entidades', { polizas: ccEquidadLista('cc-eq-ent-polizas'), prepagada: ccEquidadLista('cc-eq-ent-prepagada') });
    res.innerHTML = '<div class="cc-aviso" role="status">Guardado: ' + r.polizas.length + ' de pólizas y ' + r.prepagada.length + ' de prepagadas.</div>';
  } catch (e) {
    res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(e.message || 'No se pudo guardar') + '</div>';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ccEquidadHtml: ccEquidadHtml, ccEquidadResultadoHtml: ccEquidadResultadoHtml, ccEquidadMesesDelAnio: ccEquidadMesesDelAnio };
}
