// scripts/plantillas/generar-plantillas.js — Fase 153 (P1): genera una
// plantilla de carga por modulo en server/plantillas/PLANTILLA_<MODULO>.xlsx
// a partir de scripts/plantillas/modulos.js (columnas = las del lector).
//
// Cada archivo trae 2 hojas:
//   1. la hoja de datos (mismo nombre que la hoja que ya reconoce Cargar
//      Datos), con solo la fila de encabezados;
//   2. INSTRUCCIONES: de donde sale, que reemplaza y que va en cada columna,
//      con un ejemplo INVENTADO.
//
// Uso (desde la raiz del repo): node scripts/plantillas/generar-plantillas.js
// No toca las plantillas viejas (PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx,
// PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx,
// PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx): la pantalla actual las sigue usando.
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const { CARGAS, columnasDeCarga } = require('./modulos');

const DESTINO = path.join(__dirname, '..', '..', 'server', 'plantillas');

function libro(c) {
  const cols = columnasDeCarga(c);
  const wb = XLSX.utils.book_new();
  const datos = XLSX.utils.aoa_to_sheet([cols.map((x) => x.encabezado)]);
  datos['!cols'] = cols.map((x) => ({ wch: Math.max(14, x.encabezado.length + 2) }));
  XLSX.utils.book_append_sheet(wb, datos, c.hoja);

  const filas = [
    ['Plantilla: ' + c.carga],
    ['De dónde sale', c.origen],
    ['Qué reemplaza al subir', c.reemplazo],
    ...(c.nota ? [['Cálculos', c.nota]] : []),
    ['Cómo se sube', 'Cargar Datos → cliente → este módulo. El sistema reconoce el archivo por sus columnas, no por el nombre de la hoja ni del archivo.'],
    ['Importante', 'No cambie los nombres de las columnas. Los ejemplos de abajo son inventados: no los copie a la hoja de datos.'],
    [],
    ['Columna', 'Obligatoria', 'Qué va', 'Ejemplo (inventado)', 'También se acepta como'],
  ];
  cols.forEach((x) => filas.push([x.encabezado, x.obligatoria ? 'Sí' : 'No', x.descripcion, x.ejemplo == null ? '' : x.ejemplo, x.alias.join(', ')]));
  const ins = XLSX.utils.aoa_to_sheet(filas);
  ins['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 70 }, { wch: 26 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ins, 'INSTRUCCIONES');
  return wb;
}

if (require.main === module) {
  for (const c of CARGAS) {
    const buf = XLSX.write(libro(c), { type: 'buffer', bookType: 'xlsx', compression: true });
    fs.writeFileSync(path.join(DESTINO, c.archivo), buf);
    console.log('ok ' + c.archivo);
  }
}

module.exports = { libro };
