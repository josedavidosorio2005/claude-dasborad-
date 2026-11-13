// gd-menu-lateral.js — Fase 348, punto G (reunion con Edwin del 12/11; aprobado por el usuario el 13/11). Menu lateral
// izquierdo plegable para los dashboards de cliente, como el de Televentas SURA: desde 901 px las
// pestañas pasan a una columna a la izquierda (pegada bajo el encabezado, con «MENÚ», icono y
// 44 px por opcion) y un boton la pliega para dar todo el ancho al tablero. En 900 px o menos se
// quedan las pestañas de siempre arriba.
//
// SOLO para los clientes de GD_MENU_LATERAL_CLIENTES. Fase 349 (13/11, pedido del usuario): ademas
// de Mobilize, Clinica Aurora y Hospital La Maria. Fase 350 (13/11, excepcion al congelamiento de
// ORLANT aprobada por el usuario, solo navegacion): tambien ORLANT. SURA no (Televentas ya tiene su
// menu). El menu se arma con las pestañas que ya se dibujaron para quien mira: mismas pestañas,
// mismo orden y mismos permisos. «Gestión líneas internas» no es pestaña (boton aparte, #gd-li-btn).
var GD_MENU_LATERAL_CLIENTES = ['MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'HOSPITAL LA MARIA - CASTILLA', 'HOSPITAL LA MARIA - SEDE 33', 'ORLANT']; // Fase 354: + las 2 sedes de HLM

// Logica pura: icono de cada pestaña segun su nombre (los del sprite img/iconos/lucide.svg). Gana
// la PRIMERA que coincida. Fase 349: Errores, Inasistencia y Total tráfico con icono propio, y
// «salida» antes de «WhatsApp» (Aurora: «Llamadas y WhatsApp de salida»). Fase 350: «Efectividad de
// Citas» (ORLANT) con icono propio, distinto del de Agendamiento. Mobilize, Aurora y HLM quedan igual.
var GD_MENU_ICONOS = [
  [/efectividad/i, 'i-trending-up'],
  [/calidad/i, 'i-circle-check'],
  [/error/i, 'i-triangle-alert'],
  [/inasist/i, 'i-ban'],
  [/total/i, 'i-gauge'],
  [/unicas|únicas|salida/i, 'i-contact'],
  [/encuesta|whatsapp/i, 'i-message-circle'],
  [/tipific/i, 'i-layout-dashboard'],
  [/hora/i, 'i-chart-column'],
  [/llamada|flujo|tr[aá]fico/i, 'i-phone'],
  [/agend|cita/i, 'i-target'],
];
function gdMenuIcono(label) {
  var t = String(label || '');
  for (var i = 0; i < GD_MENU_ICONOS.length; i++) if (GD_MENU_ICONOS[i][0].test(t)) return GD_MENU_ICONOS[i][1];
  return 'i-punto';
}
function gdMenuLateralActivo(cliente) { return GD_MENU_LATERAL_CLIENTES.indexOf(String(cliente || '').toUpperCase()) !== -1; }

var GD_MENU_CLAVE_PLEGADO = 'gd-menu-plegado';
function _gdMenuPlegadoGuardado() { try { return localStorage.getItem(GD_MENU_CLAVE_PLEGADO) === '1'; } catch (e) { return false; } }
function _gdMenuGuardarPlegado(v) { try { localStorage.setItem(GD_MENU_CLAVE_PLEGADO, v ? '1' : '0'); } catch (e) { /* sin almacenamiento: no se recuerda */ } }

// Se llama despues de dibujar las pestañas (renderGenericTabs).
function gdMenuLateralAplicar(cliente) {
  var modal = document.getElementById('gd-modal');
  var tabs = document.getElementById('gd-tabs');
  if (!modal || !tabs) return;
  var activo = gdMenuLateralActivo(cliente);
  modal.classList.toggle('gd-menu-lateral', activo);
  var tog = document.getElementById('gd-menu-tog');
  if (!activo) {
    modal.classList.remove('gd-menu-plegado');
    if (tog) tog.remove();
    return;
  }
  tabs.setAttribute('aria-label', 'Menú del tablero');
  Array.prototype.forEach.call(tabs.querySelectorAll('button[data-gdtab]'), function (b) {
    if (b.querySelector('svg.icono')) return;
    var txt = b.textContent;
    b.innerHTML = '<svg class="icono gd-menu-ico" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#' + gdMenuIcono(txt) + '"></use></svg><span class="gd-menu-txt">' + esc(txt) + '</span>';
  });
  if (!tog) {
    tog = document.createElement('button');
    tog.type = 'button';
    tog.id = 'gd-menu-tog';
    tog.className = 'gd-menu-tog';
    tog.setAttribute('aria-controls', 'gd-tabs');
    tog.addEventListener('click', function () { gdMenuLateralPlegar(!modal.classList.contains('gd-menu-plegado')); });
    modal.insertBefore(tog, tabs);
  }
  gdMenuLateralPlegar(_gdMenuPlegadoGuardado(), true);
}
function gdMenuLateralPlegar(plegar, sinGuardar) {
  var modal = document.getElementById('gd-modal');
  var tog = document.getElementById('gd-menu-tog');
  if (!modal) return;
  modal.classList.toggle('gd-menu-plegado', !!plegar);
  if (tog) {
    tog.setAttribute('aria-expanded', plegar ? 'false' : 'true');
    tog.setAttribute('aria-label', plegar ? 'Mostrar el menú' : 'Ocultar el menú');
    tog.innerHTML = plegar ? '<span aria-hidden="true">»</span> <span class="gd-menu-tog-txt">Menú</span>' : '<span aria-hidden="true">«</span>';
  }
  if (!sinGuardar) _gdMenuGuardarPlegado(!!plegar);
  // Las graficas toman el ancho nuevo.
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 0);
}

// Fase 351 (pedido del usuario): las graficas que deciden su forma por el ANCHO de su contenedor
// (las tortas de Tipificación y de «Gestión líneas internas»: cuantas porciones y si la leyenda va
// abajo; las barras de líneas internas: tamaño y giro de los numeros) calculan sus cortes con el
// ancho que tendria el contenedor SIN la columna del menu, abierta o plegada. Asi se ven igual que
// antes del menu. Logica pura: el contenedor ocupa la misma fraccion del panel con o sin menu.
function gdAnchoEquivalente(ancho, anchoPanel, anchoMenu) {
  var w = Number(ancho) || 0, p = Number(anchoPanel) || 0, m = Number(anchoMenu) || 0;
  if (w <= 0 || p <= 0 || m <= 0) return w;
  return Math.round(w * (p + m) / p);
}
// Con el DOM: el ancho del contenedor `el` como si no estuviera el menu. Sin menu (otros clientes,
// o 900 px o menos, donde quedan las pestañas de siempre) devuelve su ancho tal cual.
function gdAnchoSinMenu(el) {
  var w = (el && el.clientWidth) || 0;
  var modal = typeof document !== 'undefined' ? document.getElementById('gd-modal') : null;
  var panels = typeof document !== 'undefined' ? document.getElementById('gd-panels') : null;
  if (!w || !modal || !panels || !modal.classList.contains('gd-menu-lateral') || !panels.contains(el)) return w;
  var cs = getComputedStyle(modal);
  if (cs.display !== 'grid') return w;
  var menu = panels.getBoundingClientRect().left - modal.getBoundingClientRect().left - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.borderLeftWidth) || 0);
  return gdAnchoEquivalente(w, panels.clientWidth, menu);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GD_MENU_LATERAL_CLIENTES: GD_MENU_LATERAL_CLIENTES, gdMenuIcono: gdMenuIcono, gdMenuLateralActivo: gdMenuLateralActivo, gdAnchoEquivalente: gdAnchoEquivalente };
}
