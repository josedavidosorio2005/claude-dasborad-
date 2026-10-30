// fase220-orlant-mobilize-sin-cambios.test.js — Fase 220 (pedido del 30/10):
// replicar en Clinica Aurora lo de ORLANT NO puede cambiar a ORLANT ni a
// Mobilize. Guardas cruzadas: registro y tablero iguales a su foto, la regla
// de salida y la clasificacion de cada uno, Tipificacion (Mobilize sigue con
// "Tipo"), Total trafico solo donde corresponde, Centro de cargas y skills de
// WhatsApp. Si un cambio para Aurora (u otro cliente) toca a ORLANT o a
// Mobilize, esta prueba falla. Datos SIEMPRE inventados.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const reg = require('../clientes-registro');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');
const t = require('../tipificaciones');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const centro = require('../centro-cargas');
const { SEMILLA_ORLANT } = require('../skills-whatsapp');

after(cleanup);
const auth = (tk) => ({ Authorization: 'Bearer ' + tk });

function fila(skill, tipo, skillId, n) {
  return Array.from({ length: n }, (_, k) => ['ASESOR ' + (k % 3), '2026-07-0' + (1 + (k % 9)), null, 1, 'AGENDADO', skill, 60, '1', tipo, null, skillId]);
}
// Las mismas filas para los dos clientes: cada uno con su regla.
const FILAS = [
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '-', 10),
  ...fila('-', 'otro', '-', 2),
  ...fila('-', null, '-', 1),
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '4070', 4),
  ...fila('CALL INBOUND', 'inbound', '4308', 6),
];
for (const campana of ['ORLANT', 'MOBILIZE']) {
  t.cargarTipificaciones(db, { campana, canal: 'LLAMADAS', archivoNombre: 'x.xlsx', cargadoPorNombre: 'test', filas: FILAS });
}

test('registro de ORLANT y MOBILIZE identico a la semilla; tableros identicos a su foto', () => {
  for (const c of ['ORLANT', 'MOBILIZE']) {
    const r = reg.leerRegistro(db).find((x) => x.nombre === c);
    const s = reg.REGISTRO_INICIAL.find((x) => x.nombre === c);
    assert.deepEqual({ modulos: r.modulos, parametros: r.parametros, logo: r.logo }, { modulos: s.modulos, parametros: s.parametros, logo: s.logo }, c);
    const f = db.prepare('SELECT titulo, vista, secciones, layout FROM dashboards_config WHERE cliente = ?').get(c);
    const actual = { titulo: f.titulo, vista: f.vista ? JSON.parse(f.vista) : null, secciones: JSON.parse(f.secciones), layout: JSON.parse(f.layout) };
    assert.equal(JSON.stringify(actual), JSON.stringify(generarLayout(PERFILES_ACTUALES[c])), c);
  }
});

test('regla de salida: ORLANT con la suya ("-" con cualquier tipo, out_pre en su skill), Mobilize con la general', () => {
  assert.deepEqual(t.SALIDA_POR_CLIENTE.ORLANT, { regla: 'guion', clasificacionAsesores: true });
  assert.equal(t.SALIDA_POR_CLIENTE.MOBILIZE, undefined);
  const orl = t.tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-07' });
  const mob = t.tipificacionesResumenSalida(db, { campana: 'MOBILIZE', mes: '2026-07' });
  assert.deepEqual([orl.total, orl.totalLlamadas, orl.soloTotal], [13, 23, true]);
  assert.equal(mob.total, 14);
  assert.ok(!mob.soloTotal);
  assert.equal(t.condSalidaLlamadasSql('MOBILIZE'), t.condSalidaLlamadasSql('HOSPITAL LA MARIA'), 'Mobilize sigue con la regla general');
});

test('clasificacion General / 3P: ORLANT si, Mobilize no (ni en Tipificacion ni en la salida)', async () => {
  const tk = await tokenFor('admin', MASTER_PASSWORD);
  const op = async (c) => (await request(app).get('/api/calidad/tipificacion/opciones?campana=' + c + '&canal=LLAMADAS').set(auth(tk))).body;
  assert.equal((await op('ORLANT')).clasificacionAsesores, true);
  assert.ok(!(await op('MOBILIZE')).clasificacionAsesores);
  const mob = salidaCombinadaPorMes(db, 'MOBILIZE').find((f) => f.mes === '2026-07');
  assert.equal(mob.lineaPorCliente, undefined, 'Mobilize sin "Sin clasificar"');
  assert.equal(salidaCombinadaPorMes(db, 'ORLANT').find((f) => f.mes === '2026-07').lineaPorCliente, true);
});

test('vista de Tipificacion: Mobilize sigue con "Tipo" (Entrante / Saliente / Otro)', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  assert.ok(s.includes("[['', 'Todos'], ['inbound', 'Entrante'], ['outbound_ma', 'Saliente'], ['otro', 'Otro']]"));
  assert.ok(s.includes("params.set(_tipificacionSentidoPorCampana[campana] ? 'sentido' : 'tipoInteraccion', deCanal.tipo);"));
});

test('"Total tráfico": una en ORLANT y una en Aurora; ninguna en Mobilize, HLM ni SURA', () => {
  const cuantas = (c) => {
    const r = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    return r ? JSON.parse(r.layout).tabs.filter((x) => x.key === 'total_trafico').length : 0;
  };
  assert.deepEqual(['ORLANT', 'CLINICA AURORA', 'MOBILIZE', 'HOSPITAL LA MARIA', 'SURA'].map(cuantas), [1, 1, 0, 0, 0]);
});

test('Centro de cargas: lo retirado de ORLANT y de Mobilize no cambia', () => {
  const salida = centro.CARGAS_POR_MODULO.salida[0];
  const citas = centro.CARGAS_POR_MODULO.efectividad_citas[0];
  assert.equal(centro.cargaRetiradaPara('ORLANT', salida), true);
  assert.equal(centro.cargaRetiradaPara('ORLANT', citas), true);
  assert.equal(centro.cargaRetiradaPara('MOBILIZE', salida), false);
  assert.equal(centro.cargaRetiradaPara('MOBILIZE', citas), false);
  assert.deepEqual(Object.keys(centro.CARGAS_RETIRADAS_POR_CLIENTE).sort(), ['CLINICA AURORA', 'ORLANT']);
});

test('skills de WhatsApp: ORLANT conserva su semilla; Mobilize no tiene ninguno', () => {
  const de = (c) => db.prepare('SELECT codigo, nombre FROM skills_whatsapp WHERE campana = ? ORDER BY CAST(codigo AS INTEGER), codigo').all(c);
  assert.deepEqual(de('ORLANT').map((x) => [x.codigo, x.nombre]), SEMILLA_ORLANT.slice().sort((a, b) => Number(a[0]) - Number(b[0])));
  assert.deepEqual(de('MOBILIZE'), []);
});
