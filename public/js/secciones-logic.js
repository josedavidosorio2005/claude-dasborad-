// secciones-logic.js — Fase 163 (punto 5, pedido de Edwin): cada grafica en
// su propio cuadro (tarjeta con borde, fondo y titulo) y un color de acento
// por seccion (Llamadas, WhatsApp, Salida), para distinguir de un vistazo que
// es cada cosa. Logica PURA (sin DOM). Doble modo: global en el navegador y
// require() en Node para las pruebas.
//
// Los colores viven en styles.css (--c-acento-llamadas/-whatsapp/-salida,
// claro y oscuro, contraste medido ahi). El acento se usa solo en bordes y
// franjas (nunca como color de texto) y nunca es verde: el verde queda para
// el semaforo.
'use strict';

// Tipo del primer panel de una pestana -> seccion de color.
var GD_SECCION_POR_TIPO = {
  trafico_combo: 'llamadas',
  trafico_whatsapp_combo: 'whatsapp',
  salida_panel: 'salida',
  // Llamadas Unicas de Mobilize: mitad izquierda (ingreso) = llamadas, mitad
  // derecha (salida) = salida; cada mitad marca su propia tarjeta.
  llamadas_unicas_panel: 'llamadas',
  flujo_hora_panel: 'llamadas', // Fase 196
  total_trafico_panel: 'llamadas', // Fase 219 (entrada + salida)
};

function gdSeccionDeTipo(tipo) {
  return GD_SECCION_POR_TIPO[tipo] || null;
}

// Clase CSS de la seccion ('' si el panel no es de ninguna).
function gdClaseSeccion(seccion) {
  return seccion ? 'gd-sec gd-sec-' + seccion : '';
}

// El cuadro de UNA grafica: titulo + contenido (el .aurora-chart-wrap con su
// canvas, y lo que vaya pegado a esa grafica). `tituloHtml` ya viene escapado
// por quien llama (puede traer la nota "?" de la grafica).
// Fase 165: opciones.destacado agranda el titulo (--fs-h3) sin cambiar la
// etiqueta (sigue siendo <h3>); lo usan "Llamadas de salida" y "WhatsApp de
// salida" (pedido de Edwin).
function gdGraficaHtml(tituloHtml, contenidoHtml, opciones) {
  var clase = 'gd-grafica-titulo' + (opciones && opciones.destacado ? ' gd-grafica-titulo-destacado' : '');
  var titulo = tituloHtml ? '<h3 class="' + clase + '">' + tituloHtml + '</h3>' : '';
  // Fase 189: `acciones` = controles de la grafica en su cabecera (a la derecha
  // del titulo; en el celular, debajo). Sin la opcion, igual que siempre.
  if (opciones && opciones.acciones) titulo = '<div class="gd-grafica-cab">' + titulo + opciones.acciones + '</div>';
  return '<section class="gd-grafica">' +
    titulo +
    contenidoHtml +
    '</section>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GD_SECCION_POR_TIPO: GD_SECCION_POR_TIPO,
    gdSeccionDeTipo: gdSeccionDeTipo,
    gdClaseSeccion: gdClaseSeccion,
    gdGraficaHtml: gdGraficaHtml,
  };
}
