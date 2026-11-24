// faseEQ1-equidad-lector.test.js — Equidad de agendamiento (ORLANT, A6), paso EQ1 adelantado el 24/11 sin esperar a
// Isa: lector de los dos formatos, cálculos del HTML y guardado; cada respuesta pendiente es UNA opción.
// Solo los ejemplos INVENTADOS de docs/orlant/equidad y filas inventadas aquí.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const { db } = require('./helpers');
const EQ = require('../equidad-agendamiento');

const DOCS = path.join(__dirname, '..', '..', 'docs', 'orlant', 'equidad');
const HOJA_GRUPO = { PREPAGADAS: 'PREPAGADAS', PARTICULARES: 'PARTICULARES', 'POLIZA SURA': 'POLIZA_SURA' };
function hojas(archivo) {
  const wb = XLSX.read(require('fs').readFileSync(path.join(DOCS, archivo)), { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((n) => ({ grupo: HOJA_GRUPO[n], filas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }) }));
}
const CORTO = ['CODIGO_SEDE', 'NOMBRE_EXAMEN', 'ESPNOM', 'MEDNOM', 'FECHA_CITA', 'NOMBRE_ENTIDAD'];
const EX = 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN OTORRINOLARINGOLOGÍA';
const fila = (sede, med, fecha, ent, x) => Object.assign([sede, EX, 'CONSULTA OTORRINO', med, fecha, ent], x || {});
// 6 citas: A 3 (una repetida a la misma hora), B 2, C 1; una de otra especialidad.
const MINI = () => [CORTO,
  fila('SEDE PRINCIPAL', 'Médico A Inventado', '2026-11-03 08:00', 'ENTIDAD X'),
  fila('SEDE PRINCIPAL', 'MEDICO A INVENTADO', '2026-11-03 08:00', 'ENTIDAD X'),
  fila('SEDE POBLADO', 'medico a  inventado', '2026-11-04 09:30', 'ENTIDAD Y'),
  fila('SEDE PRINCIPAL', 'MEDICO B INVENTADO', '05/11/2026 10:00', 'ENTIDAD X'),
  fila('SEDE POBLADO', 'MEDICO B INVENTADO', '2026-11-06 11:00', 'ENTIDAD X'),
  fila('SEDE POBLADO', 'MEDICO C INVENTADO', '2026-11-06 11:00', 'ENTIDAD Z', { 2: 'CIRUGIA MAXILOFACIAL' }),
  fila('SEDE POBLADO', '', '2026-11-06 11:00', ''),
  fila('SEDE POBLADO', 'MEDICO D INVENTADO', 'sin fecha', ''),
];

test('los dos ejemplos inventados: se reconocen por los encabezados y nunca sale la observación', () => {
  for (const [archivo, formato] of [['EJEMPLO_EQUIDAD_FORMATO_REAL_INVENTADO.xlsx', 'completo'], ['EJEMPLO_EQUIDAD_FORMATO_CORTO_INVENTADO.xlsx', 'corto']]) {
    for (const { grupo, filas } of hojas(archivo)) {
      const r = EQ.leer(filas, grupo);
      assert.ok(!r.error, r.error);
      assert.equal(r.formato, formato, archivo);
      assert.equal(r.citas.length, filas.length - 1, archivo + ' ' + grupo);
      for (const c of r.citas) {
        assert.ok(!('observacion' in c) && !('CITOBSOBS' in c));
        assert.equal(c.usuario, null, 'CITUSU no se guarda por defecto (pregunta B)');
        if (grupo === 'PARTICULARES') assert.equal(c.entidad, null, 'entidad de Particulares no se guarda (pregunta A)');
        assert.match(c.fecha, /^2026-10-\d{2}$/);
      }
      if (formato === 'completo') assert.ok(r.citas.every((c) => /^M\d{2}$/.test(c.medicoCodigo)));
    }
  }
});

test('FECHA_CITA con una sola hora en todo el archivo (solo la fecha, como el corto real): sin hora y sin «repetidas»', () => {
  const f = MINI().map((x, i) => (i === 0 ? x : Object.assign([], x, { 4: String(x[4]).replace(/ \d{1,2}:\d{2}$/, ' 00:00') })));
  const r = EQ.leer(f, 'PREPAGADAS');
  assert.equal(r.avisos.repetidas, 0);
  assert.equal(r.avisos.sinHoraEnCorto, true);
  assert.ok(r.citas.every((c) => c.hora === null));
  assert.equal(r.citas.length, 6, 'todas cuentan igual');
});

test('un archivo que no es de equidad, o un grupo que no existe, da error claro', () => {
  assert.match(EQ.leer([['A', 'B'], [1, 2]], 'PREPAGADAS').error, /No es el formato de equidad/);
  assert.match(EQ.leer(MINI(), 'OTRO').error, /Grupo inválido/);
  assert.match(EQ.leer([], 'PREPAGADAS').error, /vacío/);
});

test('por defecto (como el HTML): todas cuentan, avisos sin bloquear; médicos por nombre normalizado', () => {
  const r = EQ.leer(MINI(), 'PREPAGADAS');
  assert.equal(r.formato, 'corto');
  assert.equal(r.citas.length, 6);
  assert.deepEqual(r.avisos, { otraEspecialidad: 1, otroExamen: 0, repetidas: 1, sinMedico: 1, sinFecha: 1, antesDelMesInicial: 0, filtradas: 0, sinHoraEnCorto: false });
  assert.deepEqual([...new Set(r.citas.map((c) => c.medico))].sort(), ['MEDICO A INVENTADO', 'MEDICO B INVENTADO', 'MEDICO C INVENTADO']);
  const k = EQ.calcular(r.citas);
  assert.deepEqual([k.total, k.medicos, k.promedio, k.desde, k.hasta], [6, 3, 2, '2026-11-03', '2026-11-06']);
  assert.deepEqual(k.mayor, { medico: 'MEDICO A INVENTADO', citas: 3, pct: 50 });
  assert.deepEqual(k.porSede, [{ sede: 'SEDE POBLADO', citas: 3, pct: 50 }, { sede: 'SEDE PRINCIPAL', citas: 3, pct: 50 }]);
  assert.deepEqual(k.detalle.map((d) => [d.medico, d.total, d.participacionPct, d.vsPromedio]), [
    ['MEDICO A INVENTADO', 3, 50, 1], ['MEDICO B INVENTADO', 2, 33.3, 0], ['MEDICO C INVENTADO', 1, 16.7, -1]]);
  assert.ok(k.detalle.every((d) => !('estado' in d)), 'sin margen (pregunta 5): solo la línea del promedio');
  assert.deepEqual(k.porEntidad[0], { entidad: 'ENTIDAD X', citas: 4, pct: 66.7 });
  // Filtros: sede, médico y fechas.
  assert.equal(EQ.calcular(r.citas, { sede: 'sede poblado' }).total, 3);
  assert.equal(EQ.calcular(r.citas, { medico: 'Médico B Inventado' }).total, 2);
  assert.equal(EQ.calcular(r.citas, { desde: '2026-11-04', hasta: '2026-11-05' }).total, 2);
});

test('cada respuesta de Isa es solo una opción', () => {
  // C: repetidas una sola vez.
  assert.equal(EQ.leer(MINI(), 'PREPAGADAS', { repetidas: 'una' }).citas.length, 5);
  // D/F: especialidades y exámenes permitidos dejan fuera lo demás.
  const d = EQ.leer(MINI(), 'PREPAGADAS', { especialidadesPermitidas: ['Consulta otorrino'] });
  assert.equal(d.citas.length, 5); assert.equal(d.avisos.filtradas, 1);
  assert.equal(EQ.leer(MINI(), 'PREPAGADAS', { examenesPermitidos: ['OTRO EXAMEN'] }).citas.length, 0);
  // A: entidad de Particulares.
  assert.equal(EQ.leer(MINI(), 'PARTICULARES').citas[0].entidad, null);
  assert.equal(EQ.leer(MINI(), 'PARTICULARES', { guardarEntidadParticulares: true }).citas[0].entidad, 'ENTIDAD X');
  // B: usuario que agenda (solo formato completo).
  const comp = hojas('EJEMPLO_EQUIDAD_FORMATO_REAL_INVENTADO.xlsx')[0];
  assert.ok(EQ.leer(comp.filas, comp.grupo, { guardarUsuario: true }).citas.every((c) => /^USUARIO\d$/.test(c.usuario)));
  // E: un solo formato.
  assert.match(EQ.leer(MINI(), 'PREPAGADAS', { formatosAceptados: 'completo' }).error, /solo se acepta el formato completo/);
  // 11: mes inicial.
  const m = EQ.leer(MINI(), 'PREPAGADAS', { mesInicial: '2026-12' });
  assert.equal(m.citas.length, 0); assert.equal(m.avisos.antesDelMesInicial, 6);
  // 5: margen ±20 % del promedio (2): A 3 → sobre, B 2 → dentro, C 1 → bajo.
  const k = EQ.calcular(EQ.leer(MINI(), 'PREPAGADAS').citas, {}, { margenDesequilibrioPct: 20 });
  assert.deepEqual(k.detalle.map((x) => x.estado), ['sobre', 'dentro', 'bajo']);
  // Opciones inválidas: error, nunca un valor a medias.
  for (const o of [{ modoCarga: 'x' }, { repetidas: 'x' }, { formatosAceptados: 'x' }, { margenDesequilibrioPct: -1 }]) assert.throws(() => EQ.opcionesDe(o));
  assert.ok(Object.isFrozen(EQ.OPCIONES_POR_DEFECTO));
});

test('guardado: reemplaza los meses que trae, solo de ese grupo (pregunta 6); «sumar» no borra', () => {
  const C = 'ORLANT PRUEBA EQ1 INVENTADA';
  const r = EQ.leer(MINI(), 'PREPAGADAS');
  assert.deepEqual(EQ.guardar(db, { campana: C, grupo: 'PREPAGADAS', citas: r.citas, archivoNombre: 'inventado.xlsx', cargadoPor: 'prueba' }), { insertadas: 6, borradas: 0, meses: ['2026-11'] });
  const p = EQ.leer(MINI(), 'PARTICULARES');
  EQ.guardar(db, { campana: C, grupo: 'PARTICULARES', citas: p.citas });
  // Otra carga del mismo mes y grupo reemplaza (no duplica) y no toca el otro grupo.
  assert.equal(EQ.guardar(db, { campana: C, grupo: 'PREPAGADAS', citas: r.citas.slice(0, 2) }).borradas, 6);
  assert.equal(EQ.listar(db, { campana: C, grupo: 'PREPAGADAS' }).length, 2);
  assert.equal(EQ.listar(db, { campana: C, grupo: 'PARTICULARES' }).length, 6);
  EQ.guardar(db, { campana: C, grupo: 'PREPAGADAS', citas: r.citas.slice(0, 2), opciones: { modoCarga: 'sumar' } });
  assert.equal(EQ.listar(db, { campana: C, grupo: 'PREPAGADAS' }).length, 4);
  assert.throws(() => EQ.guardar(db, { campana: C, grupo: 'PREPAGADAS', citas: p.citas }), /otro grupo/);
  // Los cálculos salen igual leyendo de la base.
  assert.equal(EQ.calcular(EQ.listar(db, { campana: C, grupo: 'PARTICULARES' })).total, 6);
});
