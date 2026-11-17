// reporte-pdf.js — Fase 355: botón «Exportar PDF» en Hospital La María (cada sede y
// «Datos anteriores»). Solo lo ven ADMIN, REPORTES y el cliente (CLIENTES_DASH). Pide el mes,
// dibuja las gráficas fuera de pantalla con Chart.js (ya incluido) y abre el documento para
// «Guardar como PDF» del navegador. Solo LEE datos que esa persona ya ve en el tablero; no
// escribe nada. La lógica pura (cálculos, HTML) vive en reporte-pdf-logic.js.
'use strict';

var _rpEstado = { campana: null, filasLlamadas: [], filasWpp: [] };

// Fase 355b: el logo va DENTRO del documento (data:image/png;base64,…), igual que las gráficas.
// En producción la ventana del PDF no lo cargaba desde la URL (las gráficas, ya embebidas, sí
// salían). Se lee una sola vez y queda en memoria; si no se puede, el PDF sale sin logo.
var RP_LOGO_RUTA = 'img/marca/logo-horizontal-color.png';
var _rpLogoDataUrl = null;
async function _rpCargarLogo() {
  if (_rpLogoDataUrl) return _rpLogoDataUrl;
  try {
    var r = await fetch(RP_LOGO_RUTA, { credentials: 'same-origin' });
    if (!r.ok) return null;
    var blob = await r.blob();
    var url = await new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () { ok(fr.result); };
      fr.onerror = function () { mal(fr.error); };
      fr.readAsDataURL(blob);
    });
    if (reportePdfLogoValido(url)) _rpLogoDataUrl = url;
  } catch (e) { /* sin logo: el PDF sale igual */ }
  return _rpLogoDataUrl;
}

function _rpEl(id) { return document.getElementById(id); }
function _rpRol() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.rol : null; }
function _rpEsAdmin() { return typeof isFullAdmin === 'function' && isFullAdmin(); }
function _rpRegistro() { return (typeof REGISTRO_CLIENTES !== 'undefined' && REGISTRO_CLIENTES) || []; }

function reportePdfVisible(cliente) {
  return !!cliente && reportePdfAplica(_rpRegistro(), cliente) && reportePdfPuedeVer(_rpRol(), _rpEsAdmin());
}

function reportePdfPintarBoton(cliente) {
  var b = _rpEl('gd-reporte-pdf-btn');
  if (b) b.classList.toggle('hidden', !reportePdfVisible(cliente));
}

// Nombre para el encabezado: «Hospital La María» + la sede o «Datos anteriores».
function _rpNombres(cliente) {
  var reg = _rpRegistro();
  var padre = (typeof padreDeSede === 'function') ? padreDeSede(reg, cliente) : null;
  var nombrePadre = (typeof selSedeNombrePadre === 'function') ? selSedeNombrePadre(padre || cliente) : (padre || cliente);
  if (padre) return { campana: nombrePadre, etiqueta: (typeof sedeEtiqueta === 'function' ? sedeEtiqueta(reg, cliente) : cliente) };
  var ant = (typeof datosAnterioresDe === 'function') ? datosAnterioresDe(reg, cliente) : null;
  return { campana: nombrePadre, etiqueta: ant ? ant.etiqueta : 'Sin sede' };
}

async function reportePdfAbrir() {
  if (typeof _gd === 'undefined' || !_gd || !reportePdfVisible(_gd.cliente)) return;
  var campana = _gd.cliente;
  _rpEstado.campana = campana;
  var sel = _rpEl('rp-mes');
  var btn = _rpEl('rp-generar-btn');
  var nota = _rpEl('rp-nota');
  sel.innerHTML = '<option>Cargando…</option>';
  sel.disabled = true; btn.disabled = true;
  nota.textContent = '';
  var nom = _rpNombres(campana);
  _rpEl('rp-campana').textContent = nom.campana + ' · ' + nom.etiqueta;
  openModal('modal-reporte-pdf');
  var ll = [], wp = [];
  try { ll = (typeof _traficoCargarDatos === 'function') ? ((await _traficoCargarDatos(campana)) || {}).filas || [] : []; } catch (e) { ll = []; }
  try { wp = (typeof _traficoWppCargarDatos === 'function') ? ((await _traficoWppCargarDatos(campana)) || {}).filas || [] : []; } catch (e) { wp = []; }
  if (_rpEstado.campana !== campana) return; // se cerró y se abrió otro tablero mientras cargaba
  await _rpCargarLogo(); // Fase 355b: antes de habilitar «Generar PDF» (el clic abre la ventana de una)
  if (_rpEstado.campana !== campana) return;
  _rpEstado.filasLlamadas = ll; _rpEstado.filasWpp = wp;
  var meses = reportePdfMeses(ll, wp);
  if (!meses.length) {
    meses = reportePdfMesesSinDatos(new Date());
    nota.textContent = 'Esta vista todavía no tiene datos cargados: el PDF saldrá con los indicadores vacíos.';
  }
  sel.innerHTML = meses.map(function (m) { return '<option value="' + esc(m) + '">' + esc(reportePdfMesLargo(m)) + '</option>'; }).join('');
  sel.disabled = false; btn.disabled = false;
  sel.focus();
}

function reportePdfCerrar() {
  closeModal('modal-reporte-pdf');
  var b = _rpEl('gd-reporte-pdf-btn');
  if (b) b.focus();
}

// Gráfica fuera de pantalla → imagen PNG. Colores fijos (documento impreso, no el tema).
function _rpGraficaImg(tipo, etiquetas, series) {
  if (typeof Chart === 'undefined' || !etiquetas.length) return null;
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:340px';
  var cv = document.createElement('canvas');
  cv.width = 900; cv.height = 340;
  host.appendChild(cv);
  document.body.appendChild(host);
  var ch = null;
  try {
    ch = new Chart(cv.getContext('2d'), {
      type: tipo,
      data: { labels: etiquetas, datasets: series },
      options: {
        responsive: false, animation: false, devicePixelRatio: 2,
        plugins: { legend: { position: 'bottom', labels: { color: '#1f3a46' } }, datalabels: { display: false }, tooltip: { enabled: false } },
        scales: { x: { ticks: { color: '#40606e' }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#40606e' } } },
      },
    });
    return cv.toDataURL('image/png');
  } catch (e) {
    return null;
  } finally {
    if (ch) ch.destroy();
    host.remove();
  }
}

function _rpEtiquetaPeriodo(p) {
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p.slice(8, 10) + '/' + p.slice(5, 7) : reportePdfMesLargo(p);
}

var RP_COLOR_TOTAL = '#0b6fa4';
var RP_COLOR_CONTESTADAS = '#2a1b6e';

function _rpGraficaCanal(serie, nombreTotal, nombreContestadas) {
  if (!serie.length) return null;
  return _rpGraficaImg('bar', serie.map(function (s) { return _rpEtiquetaPeriodo(s.periodo); }), [
    { label: nombreTotal, data: serie.map(function (s) { return s.total; }), backgroundColor: RP_COLOR_TOTAL },
    { label: nombreContestadas, data: serie.map(function (s) { return s.contestadas; }), backgroundColor: RP_COLOR_CONTESTADAS },
  ]);
}

function reportePdfGenerar() {
  var campana = _rpEstado.campana;
  var mes = _rpEl('rp-mes').value;
  if (!campana || !/^\d{4}-\d{2}$/.test(mes)) return;
  // La ventana se abre en el mismo clic (si no, el navegador la bloquea).
  var w = window.open('', '_blank');
  if (!w) { showToast('No se pudo exportar: permite las ventanas emergentes para exportar a PDF.'); return; }
  try {
    var ind = reportePdfIndicadores(_rpEstado.filasLlamadas, _rpEstado.filasWpp, mes);
    var serieL = reportePdfSerieDiaria(_rpEstado.filasLlamadas, mes, 'fecha', 'totalLlamadas', 'contestadas');
    var serieW = reportePdfSerieDiaria(_rpEstado.filasWpp, mes, 'fechaInicio', 'totalWhatsapp', 'contestados');
    var graficas = {
      llamadas: ind.llamadas ? _rpGraficaCanal(serieL, 'Total llamadas', 'Llamadas contestadas') : null,
      whatsapp: ind.whatsapp ? _rpGraficaCanal(serieW, 'Total WhatsApp', 'WhatsApp contestados') : null,
      total: ind.total ? _rpGraficaImg('bar', ['Llamadas', 'WhatsApp', 'Total'], [
        { label: 'Ingresados', data: [ind.llamadas ? ind.llamadas.total : 0, ind.whatsapp ? ind.whatsapp.total : 0, ind.total.ingresados], backgroundColor: RP_COLOR_TOTAL },
        { label: 'Contestados', data: [ind.llamadas ? ind.llamadas.contestadas : 0, ind.whatsapp ? ind.whatsapp.contestadas : 0, ind.total.contestados], backgroundColor: RP_COLOR_CONTESTADAS },
      ]) : null,
    };
    var nom = _rpNombres(campana);
    var html = reportePdfPrintHtml({
      campana: nom.campana, etiqueta: nom.etiqueta, mes: mes, ind: ind, graficas: graficas,
      logoUrl: _rpLogoDataUrl, // Fase 355b: embebido (data:image/png), nunca una URL
      generado: new Date().toLocaleString('es-CO'),
      demo: (typeof seedDemoActivo !== 'undefined' && seedDemoActivo),
    });
    w.document.open();
    w.document.write(html);
    w.document.close();
    reportePdfCerrar();
    _rpImprimirCuandoCargue(w, 0);
  } catch (e) {
    w.close();
    showToast('No se pudo exportar: ' + (e && e.message ? e.message : 'error desconocido') + '.');
  }
}

// Espera a que el logo y las gráficas estén cargados antes de abrir «Imprimir» (máx. ~5 s).
function _rpImprimirCuandoCargue(w, intento) {
  var listo = false;
  try {
    var imgs = Array.prototype.slice.call(w.document.images || []);
    listo = imgs.every(function (im) { return im.complete; });
  } catch (e) { return; }
  if (listo || intento >= 25) { try { w.focus(); w.print(); } catch (e) { /* ventana cerrada */ } return; }
  setTimeout(function () { _rpImprimirCuandoCargue(w, intento + 1); }, 200);
}
