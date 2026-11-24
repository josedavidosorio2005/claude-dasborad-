// centro-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, 24/11/2026) en el Centro de cargas
// («Cargar bases»), como la sección «Horarios». Tres bases: Pólizas, Medicina prepagada y Particulares; cada archivo
// reemplaza SOLO su base. El Excel se lee en el navegador (equidad-logic.js, las mismas columnas del HTML de Edwin)
// y al servidor solo van sede, especialidad, profesional, fecha y, en Pólizas y Medicina prepagada, la entidad.
// Debajo, la lista configurable de qué entidades son pólizas y cuáles prepagadas (Isa se la pasa a Edwin).
'use strict';

var _ceq = { gen: 0, grupo: null };
function _ceqEl(id) { return document.getElementById(id); }

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
  c.innerHTML = ccEquidadHtml(r);
  c.hidden = false;
}

function _ceqFecha(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

// HTML de la sección. Puro (se prueba en Node).
function ccEquidadHtml(r) {
  var tarjetas = (r.grupos || []).map(function (g) {
    var info = g.citas
      ? '<dl class="cc-eq-info"><div><dt>Archivo</dt><dd>' + esc(g.archivo || '—') + '</dd></div><div><dt>Citas</dt><dd>' + Number(g.citas).toLocaleString('es-CO') + '</dd></div>' +
        '<div><dt>Profesionales</dt><dd>' + Number(g.profesionales) + '</dd></div><div><dt>Periodo</dt><dd>' + esc(_ceqFecha(g.desde)) + ' – ' + esc(_ceqFecha(g.hasta)) + '</dd></div>' +
        '<div><dt>Cargada</dt><dd>' + esc(g.cargadoEn ? new Date(g.cargadoEn).toLocaleString('es-CO') : '') + '</dd></div></dl>'
      : '<p class="cc-intro">Sin base. Columnas: <b>MEDNOM</b> y <b>FECHA_CITA</b>; opcionales CODIGO_SEDE, ESPNOM' + (g.conEntidad ? ' y NOMBRE_ENTIDAD' : ' (esta base no lleva entidad)') + '.</p>';
    return '<article class="cc-eq-card" aria-labelledby="cc-eq-' + esc(g.id) + '-tit"><div class="cc-eq-cab"><h4 id="cc-eq-' + esc(g.id) + '-tit">' + esc(g.nombre) + '</h4>' +
      '<span class="vis-pill ' + (g.citas ? 'vis-verde' : 'vis-gris') + '">' + (g.citas ? 'Cargada' : 'Sin base') + '</span></div>' + info +
      '<button type="button" class="btn-primary cc-eq-subir" onclick="ccEquidadElegir(\'' + esc(g.id) + '\')">' + (g.citas ? 'Reemplazar base' : 'Subir base') + '</button></article>';
  }).join('');
  var ent = r.entidades || { polizas: [], prepagada: [] };
  return '<section class="cc-carga cc-equidad" aria-labelledby="cc-equidad-tit">' +
    '<div class="cc-carga-cab"><h3 id="cc-equidad-tit">Equidad profesionales</h3></div>' +
    '<p class="cc-intro">Una base por pestaña: Pólizas, Medicina prepagada y Particulares. Cada archivo reemplaza solo la base que elijas. ' +
    'Solo se guardan sede, especialidad, profesional, fecha de la cita y la entidad (Particulares no lleva entidad: ahí no se guarda nada del paciente).</p>' +
    '<div class="cc-eq-grid">' + tarjetas + '</div>' +
    '<input type="file" id="cc-equidad-archivo" accept=".xlsx,.xls,.csv" hidden onchange="ccEquidadSubir(this)">' +
    '<div id="cc-equidad-res" aria-live="polite"></div>' +
    '<details class="cc-eq-ent"><summary>Entidades: cuáles son pólizas y cuáles prepagadas</summary>' +
    '<p class="cc-intro">Una entidad por renglón. Al cargar, avisa si una base trae entidades de la otra lista (no mueve ni borra citas).</p>' +
    '<div class="cc-eq-ent-grid"><div class="ig"><label for="cc-eq-ent-polizas">Pólizas</label><textarea id="cc-eq-ent-polizas" rows="6">' + esc((ent.polizas || []).join('\n')) + '</textarea></div>' +
    '<div class="ig"><label for="cc-eq-ent-prepagada">Medicina prepagada</label><textarea id="cc-eq-ent-prepagada" rows="6">' + esc((ent.prepagada || []).join('\n')) + '</textarea></div></div>' +
    '<button type="button" class="btn-cancel" onclick="ccEquidadGuardarEntidades()">Guardar entidades</button><div id="cc-eq-ent-res" aria-live="polite"></div></details></section>';
}

// Resultado de una carga. Puro.
function ccEquidadResultadoHtml(nombre, r, avisos) {
  var otras = r.otraBase || [];
  var NOM = { polizas: 'Pólizas', prepagada: 'Medicina prepagada' };
  return '<div class="cc-aviso" role="status">' + esc(nombre) + ': ' + Number(r.filas).toLocaleString('es-CO') + ' citas cargadas' +
    (r.reemplazadas ? ' (reemplazan ' + Number(r.reemplazadas).toLocaleString('es-CO') + ')' : '') + '.</div>' +
    (avisos || []).map(function (a) { return '<div class="cc-aviso cc-aviso-falta">' + esc(a) + '</div>'; }).join('') +
    (otras.length ? '<div class="cc-aviso cc-aviso-falta"><strong>' + otras.length + ' entidad(es) de la lista de otra base</strong> (se cargaron igual):<ul>' +
      otras.map(function (o) { return '<li>' + esc(o.entidad) + ' · ' + o.citas + ' citas · lista de ' + esc(NOM[o.base] || o.base) + '</li>'; }).join('') + '</ul></div>' : '');
}

function ccEquidadElegir(grupo) {
  _ceq.grupo = grupo;
  var i = _ceqEl('cc-equidad-archivo');
  if (i) { i.value = ''; i.click(); }
}

async function ccEquidadSubir(input) {
  var f = input.files && input.files[0];
  var res = _ceqEl('cc-equidad-res');
  var g = eqGrupo(_ceq.grupo);
  if (!f || !g) return;
  res.innerHTML = '<p class="cc-cargando">Leyendo ' + esc(f.name) + '…</p>';
  try {
    var wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
    var hojas = wb.SheetNames.map(function (n) { return { nombre: n, aoa: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }) }; });
    var p = eqLeerLibro(hojas, g.id);
    if (!p.ok) { res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(p.error) + '</div>'; return; }
    var r = await apiRequest('POST', '/orlant/equidad/cargas/' + encodeURIComponent(g.id), { archivoNombre: f.name.slice(0, 120), hoja: p.hoja, filas: p.filas });
    var guardado = ccEquidadResultadoHtml(g.nombre, r, p.avisos);
    showToast('Base de ' + g.nombre + ' cargada', 'ok');
    await ccEquidadPintar('ORLANT');
    var res2 = _ceqEl('cc-equidad-res'); if (res2) res2.innerHTML = guardado;
  } catch (e) {
    res.innerHTML = '<div class="cc-aviso cc-aviso-error" role="alert">' + esc(e.message || 'No se pudo cargar el archivo') + '</div>';
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
  module.exports = { ccEquidadHtml: ccEquidadHtml, ccEquidadResultadoHtml: ccEquidadResultadoHtml };
}
