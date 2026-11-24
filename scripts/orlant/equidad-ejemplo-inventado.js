// Equidad de agendamiento (ORLANT, plan de acción 20/11, punto A6).
// Genera docs/orlant/equidad/EJEMPLO_EQUIDAD_FORMATO_REAL_INVENTADO.xlsx (formato completo, 17 columnas) y
// EJEMPLO_EQUIDAD_FORMATO_CORTO_INVENTADO.xlsx (formato corto, 6 columnas): el MISMO formato que manda
// Isa (una fila por cita) con valores 100 % INVENTADOS («MEDICO 01…»,
// «ENTIDAD A…», observaciones vacías). Sirve de base para el lector y sus pruebas; nunca lleva datos reales.
// Uso: node scripts/orlant/equidad-ejemplo-inventado.js
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');

const COLUMNAS = ['CODIGO_SEDE', 'CODIGO_EXAMEN', 'NOMBRE_EXAMEN', 'CITESP', 'ESPNOM', 'CITMED', 'MEDNOM', 'CITTIP', 'CITUSU',
  'FECHA_SOL', 'HORA_SOL', 'FECHA_CITA', 'HORA_CITA', 'CITTIR', 'CODIGO_ENTIDAD', 'NOMBRE_ENTIDAD', 'CITOBSOBS'];
const EXAMEN = ['000000', 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN OTORRINOLARINGOLOGÍA'];
const MEDICOS = Array.from({ length: 8 }, (_, i) => ['M' + String(i + 1).padStart(2, '0'), 'MEDICO ' + String(i + 1).padStart(2, '0') + ' INVENTADO']);
const ENTIDADES = [['E01', 'ENTIDAD A'], ['E02', 'ENTIDAD B'], ['E03', 'ENTIDAD C']];

function filas(grupo, n) {
  let semilla = grupo.length * 13 + 5;
  const azar = (k) => { semilla = (semilla * 9301 + 49297) % 233280; return Math.floor((semilla / 233280) * k); };
  const out = [];
  for (let i = 0; i < n; i++) {
    const med = MEDICOS[azar(azar(2) ? 8 : 4)]; // a propósito desparejo: unos médicos concentran más citas
    const dia = 1 + azar(28);
    const cita = new Date(Date.UTC(2026, 9, dia, 7 + azar(10), azar(2) * 30));
    const sol = new Date(cita.getTime() - (2 + azar(30)) * 86400000);
    const ent = grupo === 'PARTICULARES' ? ['', ''] : grupo === 'POLIZA SURA' ? ['E90', 'POLIZA DE SALUD INVENTADA'] : ENTIDADES[azar(3)];
    out.push([azar(4) ? 'SEDE PRINCIPAL' : 'SEDE POBLADO', EXAMEN[0], EXAMEN[1], 'ORL', 'CONSULTA OTORRINO', med[0], med[1], 'P', 'USUARIO' + (1 + azar(5)),
      sol, sol, cita, cita, grupo === 'PARTICULARES' ? 'P' : 'E', ent[0], ent[1], '']);
  }
  return out;
}

// Formato corto (el de noviembre, con el que Isa arma su HTML): 6 de las 17 columnas, ya filtrado.
const CORTO = ['CODIGO_SEDE', 'NOMBRE_EXAMEN', 'ESPNOM', 'MEDNOM', 'FECHA_CITA', 'NOMBRE_ENTIDAD'];
const GRUPOS = [['PREPAGADAS', 'PREPAGADAS', 60], ['PARTICULARES', 'PARTICULARES', 40], ['POLIZA SURA', 'POLIZA SURA', 70]];
const carpeta = path.join(__dirname, '..', '..', 'docs', 'orlant', 'equidad');
for (const [archivo, columnas] of [['EJEMPLO_EQUIDAD_FORMATO_REAL_INVENTADO.xlsx', COLUMNAS], ['EJEMPLO_EQUIDAD_FORMATO_CORTO_INVENTADO.xlsx', CORTO]]) {
  const idx = columnas.map((c) => COLUMNAS.indexOf(c));
  const wb = XLSX.utils.book_new();
  for (const [hoja, grupo, n] of GRUPOS) {
    const ws = XLSX.utils.aoa_to_sheet([columnas].concat(filas(grupo, n).map((f) => idx.map((i) => f[i]))), { cellDates: true });
    XLSX.utils.book_append_sheet(wb, ws, hoja);
  }
  const destino = path.join(carpeta, archivo);
  fs.writeFileSync(destino, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }));
  console.log('Ejemplo generado:', path.relative(process.cwd(), destino), '(3 hojas = los 3 archivos de Isa; valores inventados)');
}
