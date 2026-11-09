// fase296-informacion-pendiente.test.js — Fase 296 (revisión de Aurora y HLM
// antes de la reunión del 10/11/2026). Cuando falta un dato por cargar, la
// cuenta del cliente ve "Información pendiente" (sin la instrucción interna de
// qué subir y desde dónde); quien carga datos sigue viendo esa instrucción. Y
// un panel con datos viejos (HLM: solo agosto) avisa qué meses faltan.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../public/js/aviso-pendiente-logic.js');

const JS = path.join(__dirname, '..', '..', 'public', 'js');

test('cuenta que carga datos: el mensaje de siempre, con la instrucción', () => {
  const html = A.avisoPendienteHtml('Tipificación', 'Sin tipificación cargada todavía. Un usuario con permiso de administrador debe subir el CDR.', true);
  assert.match(html, /Un usuario con permiso de administrador debe subir el CDR/);
  assert.doesNotMatch(html, /Información pendiente/);
  assert.match(html, /role="status"/);
});

test('cuenta del cliente: "Información pendiente", sin pasos internos', () => {
  const html = A.avisoPendienteHtml('Tipificación', 'Sin tipificación cargada todavía. Un usuario con permiso de administrador debe subir el CDR (HistCDR) desde "Cargar Datos".', false);
  assert.match(html, /<strong>Información pendiente<\/strong>/);
  assert.match(html, /Los datos de Tipificación todavía no están disponibles/);
  assert.doesNotMatch(html, /administrador|Cargar Datos|HistCDR|subir/);
});

test('sin decir quién es, sale de la sesión; fuera del navegador nunca muestra la instrucción', () => {
  assert.equal(A.avisoPendientePuedeCargar(), false);
  assert.doesNotMatch(A.avisoPendienteHtml('X', 'Un usuario con permiso de administrador debe subir X'), /administrador/);
});

test('meses faltantes: el caso real de HLM (solo agosto, hoy 09/11) -> septiembre y octubre', () => {
  assert.deepEqual(A.avisoPendienteMesesFaltantes('2026-08-31', '2026-11-09'), ['2026-09', '2026-10']);
  assert.equal(A.avisoPendienteMesesTexto(['2026-09', '2026-10']), 'septiembre y octubre de 2026');
  const html = A.avisoPendienteMesesHtml('el tráfico de llamadas', '2026-08-31', '2026-11-09');
  assert.match(html, /Información pendiente:<\/strong> el tráfico de llamadas de septiembre y octubre de 2026 todavía no se ha cargado\./);
});

test('meses faltantes: al día (último = mes pasado o el mes en curso) -> sin aviso', () => {
  assert.equal(A.avisoPendienteMesesHtml('el tráfico', '2026-10-31', '2026-11-09'), '');
  assert.equal(A.avisoPendienteMesesHtml('el tráfico', '2026-11-05', '2026-11-09'), '');
  assert.equal(A.avisoPendienteMesesHtml('el tráfico', '', '2026-11-09'), '');
  assert.equal(A.avisoPendienteMesesHtml('el tráfico', null, null), '');
});

test('meses faltantes: cruza el año y nombra cada año', () => {
  assert.deepEqual(A.avisoPendienteMesesFaltantes('2025-11', '2026-02-01'), ['2025-12', '2026-01']);
  assert.equal(A.avisoPendienteMesesTexto(['2025-12', '2026-01']), 'diciembre de 2025 y enero de 2026');
  assert.equal(A.avisoPendienteMesesTexto(['2026-07', '2026-08', '2026-09']), 'julio, agosto y septiembre de 2026');
});

test('ningún panel arma a mano la instrucción interna para el cliente: pasa por avisoPendienteHtml', () => {
  const paneles = ['trafico.js', 'trafico-whatsapp.js', 'tipificacion.js', 'salida.js', 'agendas.js', 'inasistencia.js',
    'efectividad-citas.js', 'total-trafico.js', 'whatsapp-tiempos.js'];
  for (const f of paneles) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    assert.ok(src.includes('avisoPendienteHtml('), f + ' deberia usar avisoPendienteHtml');
    // Una instruccion "debe subir" fuera de avisoPendienteHtml(...) volveria a mostrarse al cliente.
    for (const linea of src.split('\n')) {
      if (/debe subir/.test(linea) && !/avisoPendienteHtml\(|^\s*\/\//.test(linea) && !/^\s*\(p\.soloCanal/.test(linea)) {
        assert.fail(f + ': instruccion interna fuera de avisoPendienteHtml: ' + linea.trim().slice(0, 90));
      }
    }
  }
});

test('index.html carga el helper antes de los paneles que lo usan', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const iAviso = html.indexOf('src="js/aviso-pendiente-logic.js"');
  assert.ok(iAviso > 0, 'falta <script src="js/aviso-pendiente-logic.js">');
  assert.ok(iAviso < html.indexOf('src="js/trafico.js"'));
});
