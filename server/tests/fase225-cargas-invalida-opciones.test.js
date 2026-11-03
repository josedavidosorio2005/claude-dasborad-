// fase225-cargas-invalida-opciones.test.js — Fase 225 (revision del 3-nov):
// despues de guardar Agendas o Inasistencia desde Cargar Datos, cargas.js
// limpiaba `_agendasCache`/`_inasistenciaCache`, variables que no existen
// (la cache real es `_agendasOpciones`/`_inasistenciaOpciones`, por campana).
// La limpieza no hacia nada: el mes recien cargado no salia en el filtro del
// panel hasta cerrar sesion. Ahora se borra la cache de ESE cliente y la de
// los demas queda intacta.
//
// cargas.js es solo navegador: se evalua con `vm` en un sandbox minimo, igual
// que fase122-cargas-tipificacion-labelalt.test.js.
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const cargasJsPath = path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js');
const codigo = fs.readFileSync(cargasJsPath, 'utf8');

function sandboxNuevo() {
  const llamadas = [];
  const sb = {
    document: { getElementById: () => ({ addEventListener: () => {} }) },
    console,
    confirm: () => true,
    cargasPayloadDemasiadoGrande: () => false,
    CARGAS_LIMITE_MAYOR_BYTES: 1e9,
    agendasFilaComoArray: (f) => [f.x],
    inasistenciaFilaComoArray: (f) => [f.mes, f.especialidad],
    inasistenciaMesesDeFilas: (filas) => [...new Set(filas.map((f) => f.mes))],
    inasistenciaMesLbl: (m) => m,
    apiRequest: async (metodo, ruta) => {
      llamadas.push(metodo + ' ' + ruta);
      if (/impacto$/.test(ruta)) return { filasExistentes: 0 };
      if (/agendas/.test(ruta)) return { insertadas: 1, desde: '2026-11-01 08:00:00', hasta: '2026-11-01 09:00:00' };
      return { insertadas: 1, meses: ['2026-11'] };
    },
    _agendasOpciones: { ORLANT: { meses: ['2026-10'] }, AURORA: { meses: ['2026-09'] } },
    _inasistenciaOpciones: { ORLANT: { meses: ['2026-10'] }, AURORA: { meses: ['2026-09'] } },
  };
  vm.createContext(sb);
  vm.runInContext(codigo, sb, { filename: cargasJsPath });
  return { sb, llamadas };
}

test('guardar Agendas borra la cache de opciones de ese cliente (y solo la de ese)', async () => {
  const { sb, llamadas } = sandboxNuevo();
  const r = await sb._cargasGuardarAgendas('ORLANT', { filas: [{ x: 1 }] });
  assert.equal(r.ok, true);
  assert.ok(llamadas.includes('POST /calidad/agendas/carga'));
  assert.equal(sb._agendasOpciones.ORLANT, undefined, 'el panel vuelve a pedir meses y sedes');
  assert.deepEqual(sb._agendasOpciones.AURORA, { meses: ['2026-09'] });
  assert.deepEqual(sb._inasistenciaOpciones.ORLANT, { meses: ['2026-10'] }, 'la de Inasistencia no se toca');
});

test('guardar Inasistencia borra la cache de opciones de ese cliente (y solo la de ese)', async () => {
  const { sb } = sandboxNuevo();
  const r = await sb._cargasGuardarInasistencia('ORLANT', { filas: [{ mes: '2026-11', especialidad: 'X' }] });
  assert.equal(r.ok, true);
  assert.equal(sb._inasistenciaOpciones.ORLANT, undefined);
  assert.deepEqual(sb._inasistenciaOpciones.AURORA, { meses: ['2026-09'] });
  assert.deepEqual(sb._agendasOpciones.ORLANT, { meses: ['2026-10'] });
});

test('si la carga falla, la cache queda como estaba', async () => {
  const { sb } = sandboxNuevo();
  sb.apiRequest = async (metodo, ruta) => { if (/impacto$/.test(ruta)) return { filasExistentes: 0 }; throw new Error('falla'); };
  const r = await sb._cargasGuardarAgendas('ORLANT', { filas: [{ x: 1 }] });
  assert.equal(r.ok, false);
  assert.deepEqual(sb._agendasOpciones.ORLANT, { meses: ['2026-10'] });
});

test('sin el panel cargado (cache inexistente) guardar no falla', async () => {
  const { sb } = sandboxNuevo();
  delete sb._agendasOpciones;
  const r = await sb._cargasGuardarAgendas('ORLANT', { filas: [{ x: 1 }] });
  assert.equal(r.ok, true);
});

test('cargas.js ya no usa las variables que no existen (fuera de comentarios)', () => {
  const sinComentarios = codigo.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(sinComentarios, /_agendasCache|_inasistenciaCache/);
});
