// centro-horarios.js — Fase 367 (pedido de Edwin 18/11, D2): sección «Horarios» del Centro de cargas
// («Cargar base de datos») para las campañas con puntualidad (hoy la réplica de pruebas y SURA).
// Botones por mes; cada archivo es el reporte de Login/Logout de Wolkvox de uno o varios días y
// reemplaza SOLO esos días. Se enlaza con la asesora por el nombre exacto; los que no coinciden
// salen en una lista aparte. El servidor calcula la puntualidad igual que con la API (agent_7).
'use strict';

var _ch = { campana: null, anio: null, mes: null, gen: 0 };
function _chEl(id) { return document.getElementById(id); }

async function ccHorariosPintar(campana, anio) {
  var c = _chEl('cc-horarios');
  if (!c) return;
  var gen = ++_ch.gen;
  c.innerHTML = '';
  c.hidden = true;
  _ch.campana = campana; _ch.anio = String(anio || new Date().getFullYear());
  var r;
  try { r = await apiRequest('GET', '/malla/horarios?campana=' + encodeURIComponent(campana) + '&anio=' + _ch.anio); }
  catch (e) { return; } // sin puntualidad o sin permiso: la sección no se muestra
  if (gen !== _ch.gen || !r || !r.disponible) return;
  c.innerHTML = ccHorariosHtml(r);
  c.hidden = false;
}

// HTML de la sección. Puro (se prueba en Node).
function ccHorariosHtml(r) {
  var NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return '<section class="cc-carga cc-horarios" aria-labelledby="cc-horarios-tit">' +
    '<div class="cc-carga-cab"><h3 id="cc-horarios-tit">Horarios <span class="cc-carga-anio">' + esc(r.anio) + '</span></h3></div>' +
    '<p class="cc-intro">Reporte de Login / Logout de Wolkvox, por día (día 1, día 2…). Cada archivo reemplaza solo los días que trae. ' +
    'Se une con la asesora por el nombre del agente en Wolkvox, que debe ser igual al de la plataforma; los que no coincidan salen en una lista.</p>' +
    '<div class="cc-meses">' + r.meses.map(function (m, i) {
      return '<button type="button" class="cc-mes ' + (m.dias ? 'cc-mes-ok' : '') + '" onclick="ccHorariosElegir(\'' + esc(m.mes) + '\')">' +
        '<span class="cc-mes-nombre">' + NOM[i] + '</span><span class="cc-mes-dato">' + (m.dias ? m.dias + (m.dias === 1 ? ' día' : ' días') : 'Subir') + '</span></button>';
    }).join('') + '</div>' +
    '<input type="file" id="cc-horarios-archivo" accept=".xlsx,.xls,.csv" hidden onchange="ccHorariosSubir(this)">' +
    '<div id="cc-horarios-res" aria-live="polite"></div></section>';
}

function ccHorariosElegir(mes) {
  _ch.mes = mes;
  var i = _chEl('cc-horarios-archivo');
  if (i) { i.value = ''; i.click(); }
}

async function ccHorariosSubir(input) {
  var f = input.files && input.files[0];
  var res = _chEl('cc-horarios-res');
  if (!f || !_ch.mes) return;
  res.innerHTML = '<p class="cc-cargando">Leyendo ' + esc(f.name) + '…</p>';
  try {
    var buf = await f.arrayBuffer();
    var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: null, raw: true });
    var p = horariosFilasDesdeHoja(aoa);
    if (p.error) { res.innerHTML = '<div class="cc-aviso cc-aviso-error">' + esc(p.error) + '</div>'; return; }
    if (p.mesUnico !== _ch.mes) { res.innerHTML = '<div class="cc-aviso cc-aviso-error">El archivo trae días de ' + esc(p.mesUnico || 'varios meses') + ', no del mes elegido (' + esc(_ch.mes) + ').</div>'; return; }
    var r = await apiRequest('POST', '/malla/horarios/carga', { campana: _ch.campana, mes: _ch.mes, archivoNombre: f.name.slice(0, 120), filas: p.filas });
    res.innerHTML = ccHorariosResultadoHtml(r);
    showToast('Horarios cargados', 'ok');
    var guardado = res.innerHTML;
    await ccHorariosPintar(_ch.campana, _ch.anio);
    var res2 = _chEl('cc-horarios-res'); if (res2) res2.innerHTML = guardado;
  } catch (e) {
    res.innerHTML = '<div class="cc-aviso cc-aviso-error">' + esc(e.message || 'No se pudo cargar el archivo') + '</div>';
  }
}

// Resultado de una carga. Puro.
function ccHorariosResultadoHtml(r) {
  var sin = r.sinCoincidencia || [];
  return '<div class="cc-aviso" role="status">Cargado: ' + r.dias.length + (r.dias.length === 1 ? ' día' : ' días') + ' (' + esc(r.dias.join(', ')) + '), ' +
    r.agentes + ' agentes, ' + r.sesiones + ' sesiones.</div>' +
    (sin.length ? '<div class="cc-aviso cc-aviso-falta"><strong>' + sin.length + ' agente(s) sin coincidencia</strong> (el nombre en Wolkvox no es igual al de ninguna asesora de la campaña):<ul class="cc-horarios-sin">' +
      sin.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '<div class="cc-aviso">Todos los agentes coinciden con una asesora.</div>');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ccHorariosHtml: ccHorariosHtml, ccHorariosResultadoHtml: ccHorariosResultadoHtml };
}
