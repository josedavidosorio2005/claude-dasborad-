// Escape HTML para insertar datos (BD, formularios, celdas de Excel) dentro de
// innerHTML / document.write / atributos. NO usar sobre literales de HTML que
// escribimos nosotros en el codigo.
//
// El problema que resuelve es de SALIDA (render), no de entrada: el backend
// permite caracteres HTML en campos de texto libre a proposito, asi que hay que
// escapar en el momento de construir el DOM.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Doble modo: global en el navegador (los modulos se cargan por <script>),
// y require() en Node para la prueba de regresion (server/tests/xss-frontend.test.js).
if (typeof module !== 'undefined' && module.exports) module.exports = { esc: esc };
