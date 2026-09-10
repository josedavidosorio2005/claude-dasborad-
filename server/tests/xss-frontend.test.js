// tests/xss-frontend.test.js — regresion del hallazgo de auditoria: XSS almacenado.
//
// El frontend (public/js/*.js) construye HTML por concatenacion y lo asigna con
// innerHTML. Todo valor que viene de datos (texto libre del usuario, celdas de
// Excel) se escapa con esc() de public/js/esc.js antes de insertarse en el DOM.
// Este test fija el contrato de esa funcion: un payload como
// <img src=x onerror=alert(1)> debe quedar como texto literal, no como una
// etiqueta que el navegador pueda ejecutar.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { esc } = require('../../public/js/esc.js');

test('esc() neutraliza los payloads XSS habituales', () => {
  assert.equal(
    esc('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;'
  );
  assert.equal(
    esc('<script>alert(document.cookie)</script>'),
    '&lt;script&gt;alert(document.cookie)&lt;/script&gt;'
  );
  // Ruptura de atributo con comilla doble (title="...", value="...").
  assert.equal(esc('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
  // Ruptura de string JS entre comillas simples.
  assert.equal(esc("'); alert(1); //"), '&#39;); alert(1); //');
  assert.equal(esc('a & b'), 'a &amp; b');
});

test('esc() no altera texto normal y trata null/undefined/numeros', () => {
  assert.equal(esc('Carlos Rodriguez'), 'Carlos Rodriguez');
  assert.equal(esc('AHT promedio (seg)'), 'AHT promedio (seg)');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
  assert.equal(esc(92.5), '92.5');
});

test('una celda/fila renderizada con esc() no produce una etiqueta ejecutable', () => {
  const payload = '<img src=x onerror=alert(1)>';
  // Simula el patron de dashboard-generic.js / calidad.js / inventario.js.
  const fila = '<tr><td>' + esc('nombre') + '</td><td>' + esc(payload) + '</td></tr>';
  assert.ok(!/<img/i.test(fila), 'no debe contener un <img> real');
  assert.ok(fila.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
