// eficacia.js — Fase 198 (Mobilize): indicador "Eficacia", al lado del One &
// Done (sub-pestaña de Flujo de Llamadas).
//
// Eficacia = llamadas contestadas de ingreso con un codigo positivo /
// llamadas contestadas de ingreso del mes, en %. Sale del CDR que se sube en
// Tipificacion (canal LLAMADAS): ingreso = filas cuyo skill no es de salida
// ("-" o "LLAMADAS DE SALIDA"); cada fila es una llamada contestada (las de
// prueba ya se quitaron al leer el archivo). El codigo es la tipificacion
// (DESCRIPTION_COD_ACT).
//
// UNICO LUGAR de la lista de codigos positivos (la definio Kelly, 27/10/2026).
// La pantalla la lee de la respuesta de /calidad/tipificacion/eficacia para
// la nota; para cambiarla basta editar esta lista.
'use strict';

const EFICACIA_CODIGOS_POSITIVOS = {
  MOBILIZE: [
    'Acuerdos de pago',
    'Confirmación de pago realizado',
    'Confirmación de pago de multa',
    'Pago canon de entrada',
    'Agendamiento cambio de llantas',
    'Agendamiento de mantenimientos',
    'Felicitaciones',
    'Link de pagos',
    'Cómo pagar una multa',
    'Solicitud envío de factura',
    'Cómo realizar pagos',
  ],
};

const SKILLS_SALIDA_CDR = ['-', 'LLAMADAS DE SALIDA'];

// Comparacion sin tildes, sin mayusculas y con "_" como espacio.
function eficaciaNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
// Formas aceptadas de un codigo de la lista: sin tildes ("como pagar una
// multa") y SIN la letra acentuada, porque Wolkvox a veces la borra entera
// (en el CDR real llega "Hurto_de_vehculo" por "vehiculo"): "cmo pagar una multa".
function eficaciaVariantes(nombre) {
  const sinLetra = String(nombre).normalize('NFC').replace(/[^\u0000-\u007f]/g, '');
  return [eficaciaNorm(nombre), eficaciaNorm(sinLetra)];
}
function _indice(codigos) {
  const m = new Map();
  codigos.forEach((c) => eficaciaVariantes(c).forEach((v) => m.set(v, c)));
  return m;
}
// El codigo de la lista con el que casa una tipificacion, o null.
function eficaciaCodigoDe(tipificacion, codigos) {
  return _indice(codigos).get(eficaciaNorm(tipificacion)) || null;
}

// Por mes del rango: contestadas de ingreso, positivas, % y el detalle por
// codigo positivo. `codigos` = la lista de la campaña (null si no tiene).
function eficaciaPorMes(db, { campana, desde, hasta }) {
  const codigos = EFICACIA_CODIGOS_POSITIVOS[campana] || null;
  if (!codigos) return { codigos: null, meses: [] };
  const idx = _indice(codigos);
  const params = { campana };
  let rango = '';
  if (desde) { rango += ' AND fecha >= @desde'; params.desde = desde; }
  if (hasta) { rango += ' AND fecha <= @hasta'; params.hasta = hasta; }
  const filas = db
    .prepare(`SELECT substr(fecha,1,7) AS periodo, tipificacion, COUNT(*) AS n FROM tipificaciones
      WHERE campana = @campana AND canal = 'LLAMADAS'
        AND skill NOT IN (${SKILLS_SALIDA_CDR.map((x) => "'" + x + "'").join(', ')})${rango}
      GROUP BY periodo, tipificacion`)
    .all(params);
  const meses = {};
  for (const f of filas) {
    const m = meses[f.periodo] || (meses[f.periodo] = { periodo: f.periodo, contestadas: 0, positivas: 0, porCodigo: {} });
    m.contestadas += f.n;
    const c = idx.get(eficaciaNorm(f.tipificacion));
    if (c) { m.positivas += f.n; m.porCodigo[c] = (m.porCodigo[c] || 0) + f.n; }
  }
  return {
    codigos,
    meses: Object.values(meses).sort((a, b) => (a.periodo < b.periodo ? -1 : 1)).map((m) => ({
      ...m, pct: m.contestadas > 0 ? Math.round((m.positivas / m.contestadas) * 1000) / 10 : null,
    })),
  };
}

module.exports = { EFICACIA_CODIGOS_POSITIVOS, eficaciaNorm, eficaciaVariantes, eficaciaCodigoDe, eficaciaPorMes };
