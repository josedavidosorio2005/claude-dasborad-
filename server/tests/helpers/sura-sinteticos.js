// helpers/sura-sinteticos.js — Fase 215: Excel SINTETICOS (inventados) del
// tablero Televentas de SURA, con las columnas de las bases reales (ventas,
// base inicial, estrategias). Ningun valor sale de un archivo real: cedulas
// 9000000000+n, asesores "asesor_prueba_N", ciudades/departamentos de una
// lista fija. Deterministas (misma semilla = mismo archivo), para que las
// pruebas sepan de antemano los conteos y totales esperados.
'use strict';
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));

const LUGARES = [
  ['medellin', 'antioquia'], ['envigado', 'antioquia'], ['bogota', 'cundinamarca'],
  ['cali', 'valle_del_cauca'], ['pereira', 'risaralda'],
];
const RESULTADOS = ['venta', 'no_contesta', 'cliente_prospecto', 'situacion_economica', 'llamada_colgada'];

function lcg(semilla) {
  let s = semilla >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Base de ventas del mes `mes` ('AAAA-MM'): `n` registros, hoja "data".
// Cada 4o registro es una venta (fecha_venta del mes); el resto, gestion sin
// venta. prodMensual = true usa total_valor_poliza_mes (la plataforma lo
// multiplica x12), si no total_valor_poliza_anualizado.
function baseVentas({ mes, n = 40, semilla = 1, prodMensual = false }) {
  const r = lcg(semilla);
  const H = ['estrategia', 'ciudad', 'departamento', 'edad', 'identificacion', 'agente', 'fecha_venta', 'resultado',
    prodMensual ? 'total_valor_poliza_mes' : 'total_valor_poliza_anualizado', 'cantidad_poliza', 'resultado_validacion', 'producto', 'contacto'];
  const filas = [H];
  const esperado = { registros: n, ventas: 0, polizas: 0, produccion: 0, contactos: 0 };
  for (let i = 0; i < n; i++) {
    const [ciudad, dep] = LUGARES[i % LUGARES.length];
    const camp = i % 2 ? 'salud_para_ti' : 'odontologico';
    const venta = i % 4 === 0;
    const cant = venta ? 1 + (i % 3 === 0 ? 1 : 0) : null;
    const valor = venta ? 100000 + Math.round(r() * 50) * 1000 : null;
    const contacto = venta || i % 3 === 0 ? 1 : 0;
    const dia = String(1 + (i % 27)).padStart(2, '0');
    filas.push([
      camp, ciudad, dep, 20 + (i % 50), String(9000000000 + semilla * 1000 + i), 'asesor_prueba_' + (1 + (i % 3)),
      venta ? `${mes}-${dia}` : null, venta ? 'venta' : RESULTADOS[1 + (i % 4)], valor, cant,
      venta ? (i % 8 === 0 ? 'venta_expedida' : 'venta_pendiente') : null,
      venta ? (camp === 'odontologico' ? 'Plan Odontologico' : 'Salud para ti') : null, contacto,
    ]);
    if (venta) {
      esperado.ventas++;
      esperado.polizas += cant;
      esperado.produccion += prodMensual ? valor * 12 : valor;
    }
    esperado.contactos += contacto;
  }
  return { buf: libro('data', filas), esperado };
}

// Base inicial: las mismas cedulas de baseVentas (mismo `semilla`) + datos
// sociodemograficos inventados.
function baseInicial({ n = 40, semilla = 1 }) {
  const H = ['identificacion', 'tipo_documento', 'sexo', 'edad', 'ingresos', 'estado_civil', 'ocupacion', 'ciudad',
    'departamento', 'rango_saldo_promedio', 'categoria_percentil'];
  const filas = [H];
  for (let i = 0; i < n; i++) {
    const [ciudad, dep] = LUGARES[i % LUGARES.length];
    filas.push([String(9000000000 + semilla * 1000 + i), 'CC', i % 2 ? 'F' : 'M', 20 + (i % 50), 900000 + i * 50000,
      ['S', 'M', 'I'][i % 3], ['E', 'I', 'P'][i % 3], ciudad, dep, i % 2 ? '1M-3M' : '3000000', String(1 + (i % 4))]);
  }
  return { buf: libro('base', filas), esperado: { registros: n } };
}

// Base de estrategias: estrategia #1 para todos, #2 para la mitad.
function baseEstrategias({ n = 40, semilla = 1 }) {
  const H = ['identificacion', 'estrategia', 'Estrategia # 1', 'Lote # 1', 'Estrategia # 2', 'Lote # 2'];
  const filas = [H];
  for (let i = 0; i < n; i++) {
    filas.push([String(9000000000 + semilla * 1000 + i), i % 2 ? 'salud_para_ti' : 'odontologico',
      'Llamada inicial', 'Lote ' + (1 + (i % 2)), i % 2 ? 'Rellamada' : null, i % 2 ? 'Lote A' : null]);
  }
  return { buf: libro('estrategias', filas), esperado: { registros: n } };
}

function libro(hoja, filas) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), hoja);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

module.exports = { XLSX, baseVentas, baseInicial, baseEstrategias };
