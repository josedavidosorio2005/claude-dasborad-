// fase270-calificar-asesor-lista.test.js — Fase 270 (pedido de Edwin, 05/11):
// en Calificar (formulario con campos de la plantilla) el Asesor es una lista
// desplegable con los usuarios ASESOR activos de la campaña, no texto libre,
// para que el nombre coincida siempre con "Mis resultados". Datos inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-calificar.js'), 'utf8');

function cargar(users, campana) {
  const ctx = {
    console, users, _ccampana: campana,
    esc: (s) => String(s == null ? '' : s).replace(/"/g, '&quot;'),
    textoFormatoNombre: (s) => String(s),
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}
const USUARIOS = [
  { id: 7, nombre: 'Zoe Ficticia', rol: 'ASESOR', asesorCampana: 'CLINICA AURORA', active: true },
  { id: 3, nombre: 'Ana Ficticia', rol: 'ASESOR', asesorCampana: 'CLINICA AURORA', active: true },
  { id: 9, nombre: 'Inactiva Ficticia', rol: 'ASESOR', asesorCampana: 'CLINICA AURORA', active: false },
  { id: 4, nombre: 'Otro Cliente', rol: 'ASESOR', asesorCampana: 'MOBILIZE', active: true },
  { id: 5, nombre: 'Supervisora', rol: 'SUPERVISOR', asesorCampana: null, active: true },
];

test('Asesor: lista desplegable con los ASESOR activos de la campaña (orden alfabetico), con su id', () => {
  const ctx = cargar(USUARIOS, 'CLINICA AURORA');
  const html = ctx._cc2Campo({ k: 'asesor', etiqueta: 'Asesor' });
  assert.match(html, /<select id="cc2-f-asesor" required onchange="_cc2AsesorElegido\(\)">/);
  assert.ok(!/<input type="text" id="cc2-f-asesor"/.test(html), 'ya no es texto libre');
  assert.ok(!/datalist/.test(html));
  const opciones = Array.from(html.matchAll(/<option value="([^"]*)" data-user-id="(\d+)">/g)).map((m) => [m[1], m[2]]);
  assert.deepEqual(opciones, [['Ana Ficticia', '3'], ['Zoe Ficticia', '7']], 'solo los ASESOR activos de esta campaña');
});

test('sin usuarios ASESOR en la campaña: lista deshabilitada y aviso de crearlos (no se puede escribir un nombre suelto)', () => {
  const ctx = cargar(USUARIOS, 'HOSPITAL LA MARIA');
  const html = ctx._cc2Campo({ k: 'asesor', etiqueta: 'Asesor' });
  assert.match(html, /<select id="cc2-f-asesor" disabled>/);
  assert.match(html, /Esta campaña no tiene usuarios ASESOR\. Créalos en Usuarios/);
});

test('guardar toma el usuario de la opcion elegida (data-user-id); editar un monitoreo viejo conserva su nombre', () => {
  assert.match(SRC, /var uidOpt = optAs \? optAs\.getAttribute\('data-user-id'\) : null;/);
  assert.match(SRC, /asesorUserId: uid \? Number\(uid\) : undefined,/);
  assert.match(SRC, /o\.textContent = textoFormatoNombre\(m\.asesor\) \+ ' \(sin usuario\)';/);
  assert.ok(!/String\(u\.nombre\)\.trim\(\)\.toLowerCase\(\) === key/.test(SRC), 'ya no se enlaza por coincidencia de texto');
});
