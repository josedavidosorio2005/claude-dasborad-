// xlsx-export-helpers.js — InConexion Platform.
//
// De los ~8 sitios que exportan a Excel (dashboard-generic.js, trafico.js,
// historial.js, calidad.js, gerencia.js, inventario.js x2, cargas.js),
// revisados uno por uno: la mayoria construye hojas con columnas, titulos
// y datos de ejemplo genuinamente distintos por modulo -- forzarlos a una
// sola funcion generica hubiera significado inventar una forma comun que
// ninguno tiene hoy. Lo que SI se repetia literal, byte a byte, en mas de
// un sitio, es exactamente esto:
//
//   - xlsxAgregarAvisoDemo: la hoja "DATOS DE DEMOSTRACION" que antepone
//     dashboard-generic.js y trafico.js cuando hay datos de demo activos.
//   - xlsxNombreHojaUnico: sanitizar y desambiguar el nombre de una hoja
//     (limite de 31 caracteres de Excel, sin caracteres invalidos, sin
//     colisionar con una hoja ya agregada al mismo libro) -- lo hacian
//     dashboard-generic.js y calidad.js, cada uno con su propia variante
//     ligeramente distinta.
'use strict';

// Nombre de hoja unico y valido para Excel. `usados` es un objeto que este
// helper va llenando -- pasa el MISMO objeto en cada llamada dentro de un
// mismo libro para que la desambiguacion funcione entre todas las hojas.
function xlsxNombreHojaUnico(nombre, usados) {
  var limpio = String(nombre || 'Hoja').replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
  var candidato = limpio;
  var n = 1;
  while (usados[candidato]) {
    n++;
    var sufijo = '_' + n;
    candidato = limpio.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados[candidato] = true;
  return candidato;
}

// Antepone una hoja "AVISO" si hay datos de demostracion activos (Fase 16),
// para que un Excel exportado con datos falsos nunca circule sin decirlo.
// Llamar ANTES de agregar las demas hojas (Excel abre en la primera hoja).
function xlsxAgregarAvisoDemo(wb) {
  if (typeof seedDemoActivo === 'undefined' || !seedDemoActivo) return;
  var ws = XLSX.utils.aoa_to_sheet([
    ['DATOS DE DEMOSTRACION'],
    ['La informacion de este archivo es de prueba y NO corresponde a la operacion real.'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'AVISO');
}

// Fase 72 (hallazgo H2): inyeccion de formulas / CSV injection (OWASP). Los
// datos que exportamos vienen de texto libre cargado por Excel (skill,
// observaciones, motivos, descripciones...) y se escriben tal cual en un
// .xlsx nuevo con XLSX.utils.json_to_sheet/aoa_to_sheet. Si una celda de
// texto empieza con =, +, -, @ (o tab/retorno de carro), Excel/LibreOffice
// pueden interpretarla como formula al abrir el archivo exportado, en vez
// de como texto literal. Anteponer una comilla simple neutraliza eso sin
// cambiar el texto visible para quien abre el archivo (Excel la usa
// justamente para forzar "esto es texto", nunca se muestra).
var XLSX_FORMULA_RE = /^[=+\-@\t\r]/;
function xlsxCeldaSegura(v) {
  if (typeof v !== 'string') return v;
  return XLSX_FORMULA_RE.test(v) ? "'" + v : v;
}

// Aplica xlsxCeldaSegura a cada celda de texto de `filas`, aceptando tanto
// el formato de json_to_sheet (array de objetos) como el de aoa_to_sheet
// (array de arrays) -- no muta el original, devuelve una copia.
function xlsxFilasSeguras(filas) {
  if (!Array.isArray(filas)) return filas;
  return filas.map(function (fila) {
    if (Array.isArray(fila)) return fila.map(xlsxCeldaSegura);
    if (fila && typeof fila === 'object') {
      var out = {};
      Object.keys(fila).forEach(function (k) { out[k] = xlsxCeldaSegura(fila[k]); });
      return out;
    }
    return xlsxCeldaSegura(fila);
  });
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
// (xlsxAgregarAvisoDemo depende de los globales XLSX/seedDemoActivo del
// navegador y no se exporta -- el resto es logica pura, sin esa
// dependencia, y si se puede probar igual que semaforo-logic.js.)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    xlsxNombreHojaUnico: xlsxNombreHojaUnico,
    xlsxCeldaSegura: xlsxCeldaSegura,
    xlsxFilasSeguras: xlsxFilasSeguras,
  };
}
