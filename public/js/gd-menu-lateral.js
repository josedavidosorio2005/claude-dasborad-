// gd-menu-lateral.js — Fase 348, punto G (PROPUESTA, reunion con Edwin del 12/11). Menu lateral
// izquierdo plegable para los dashboards de cliente, como el de Televentas SURA: desde 901 px las
// pestañas pasan a una columna a la izquierda (pegada bajo el encabezado, con «MENÚ», icono y
// 44 px por opcion) y un boton la pliega para dar todo el ancho al tablero. En 900 px o menos se
// quedan las pestañas de siempre arriba.
//
// SOLO para los clientes de GD_MENU_LATERAL_CLIENTES (hoy, Mobilize, para la propuesta). Agregar un
// cliente a la lista es lo unico que hace falta para extenderlo, cuando se apruebe.
var GD_MENU_LATERAL_CLIENTES = ['MOBILIZE'];

// Logica pura: icono de cada pestaña segun su nombre (los del sprite img/iconos/lucide.svg).
var GD_MENU_ICONOS = [
  [/calidad/i, 'i-circle-check'],
  [/encuesta|whatsapp/i, 'i-message-circle'],
  [/tipific/i, 'i-layout-dashboard'],
  [/hora/i, 'i-chart-column'],
  [/unicas|únicas|salida/i, 'i-contact'],
  [/llamada|flujo|tr[aá]fico/i, 'i-phone'],
  [/agend|cita|inasist/i, 'i-target'],
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GD_MENU_LATERAL_CLIENTES: GD_MENU_LATERAL_CLIENTES, gdMenuIcono: gdMenuIcono, gdMenuLateralActivo: gdMenuLateralActivo };
}
