// theme.js — InConexion Platform.
// Tema claro/oscuro de toda la plataforma: atributo data-theme en <html>
// (leido por styles.css), persistido en localStorage. El tema inicial ya
// se fija ANTES de este archivo, en un script inline en <head> de
// index.html (evita el parpadeo de tema incorrecto antes del primer
// paint) -- aca solo vive el toggle, la sincronizacion de los botones y el
// puente hacia Chart.js (charts.js) y los modulos con graficas.
'use strict';

var TEMA_KEY = 'inco_tema';

function temaActual(){
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function aplicarTema(t){
  var tema = t === 'dark' ? 'dark' : 'light';
  var cambioReal = temaActual() !== tema;
  document.documentElement.setAttribute('data-theme', tema);
  try{ localStorage.setItem(TEMA_KEY, tema); }catch(e){}
  if(typeof aplicarTemaCharts === 'function') aplicarTemaCharts();
  document.querySelectorAll('.theme-toggle').forEach(function(btn){
    btn.innerHTML = tema === 'dark' ? '&#9728;&#65039;' : '&#127769;';
    btn.setAttribute('aria-label', tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  });
  // Redibuja las graficas YA renderizadas (si las hay) con los colores del
  // nuevo tema -- necesario tanto en el toggle como en cualquier otra
  // llamada a aplicarTema(), no solo en toggleTema().
  if(cambioReal) refrescarGraficasTema();
}

// Fase 136 (PR 7): microinteraccion SOLO en el clic real del usuario
// (nunca cuando aplicarTema() se llama programaticamente -- ej. al
// restaurar el tema guardado al cargar la pagina, o desde un script de
// verificacion -- eso no es una accion que el usuario necesite ver
// confirmada). Un giro de 180 grados, 200ms, en el propio icono -- el
// contenido del dashboard NO se re-anima (refrescarGraficasTema() sigue
// sin pasar por motionEnter, ver PR 6).
function toggleTema(){
  document.querySelectorAll('.theme-toggle').forEach(function(btn){
    btn.classList.add('theme-spin');
    setTimeout(function(){ btn.classList.remove('theme-spin'); }, 250);
  });
  aplicarTema(temaActual() === 'dark' ? 'light' : 'dark');
}

// Redibuja las graficas de la vista actualmente abierta SIN volver a pedir
// datos al servidor -- mismo mecanismo que la app ya usa en cada cambio de
// filtro (destruye y recrea los canvases desde el estado en memoria), solo
// que disparado por el toggle de tema en vez de por un `change` de <select>.
// Cada bloque es independiente y a prueba de fallos: si el modulo no esta
// cargado en esta pagina (ASESOR/SUPERVISOR no tienen dashboard-generic.js
// abierto, etc.) simplemente no hace nada.
function refrescarGraficasTema(){
  try{
    if(typeof _gd !== 'undefined' && _gd.tab && typeof renderGenericTab === 'function'){
      renderGenericTab(_gd.tab);
    }
  }catch(e){}
  try{
    if(document.getElementById('cal-reportes-kpis') && typeof renderCalReportes === 'function'){
      renderCalReportes();
    }
  }catch(e){}
  try{
    if(document.getElementById('mr-kpis') && typeof renderMisResultados === 'function'){
      renderMisResultados();
    }
  }catch(e){}
}

document.addEventListener('DOMContentLoaded', function(){
  aplicarTema(temaActual());
});
