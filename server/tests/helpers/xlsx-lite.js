// tests/helpers/xlsx-lite.js — lector de .xlsx minimo, SOLO para pruebas.
//
// Por que existe: para probar el parseo de trafico-logic.js contra el
// fixture REAL (server/tests/fixtures/EJEMPLO.xlsx) hace falta leer un
// .xlsx en Node. Los dos paquetes de npm mas usados para eso (`xlsx` de
// SheetJS y `exceljs`) fallan `npm audit` hoy (SheetJS dejo de publicar
// versiones parcheadas en el registro publico de npm; `exceljs` arrastra un
// `uuid` vulnerable) — y el requisito de esta tarea es "npm audit limpio".
//
// En vez de aceptar esa vulnerabilidad, este archivo lee el ZIP (un .xlsx
// es un ZIP con XML adentro) a mano: encuentra el central directory,
// descomprime cada entrada con zlib (nucleo de Node, sin dependencias
// nuevas) y parsea el XML de la hoja con expresiones regulares — suficiente
// para un archivo simple como el export de Volvox (sin formulas, sin
// estilos complejos). NO es un parser de xlsx de proposito general: es
// deliberadamente minimo, y solo se usa desde las pruebas, nunca desde el
// codigo de produccion (el navegador sigue usando xlsx.full.min.js de
// cdnjs, como siempre).
'use strict';

const fs = require('fs');
const zlib = require('zlib');

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('No es un ZIP valido (EOCD no encontrado)');
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let offset = buf.readUInt32LE(eocdOffset + 16);

  const CD_SIG = 0x02014b50;
  const entries = {};
  for (let n = 0; n < totalEntries; n++) {
    if (buf.readUInt32LE(offset) !== CD_SIG) throw new Error('Central directory corrupta en la entrada ' + n);
    const compMethod = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries[name] = { compMethod, compSize, localHeaderOffset };
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(buf, entry) {
  const LOCAL_SIG = 0x04034b50;
  const off = entry.localHeaderOffset;
  if (buf.readUInt32LE(off) !== LOCAL_SIG) throw new Error('Local file header invalido');
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.compMethod === 0) return Buffer.from(raw);
  if (entry.compMethod === 8) return zlib.inflateRawSync(raw);
  throw new Error('Metodo de compresion ZIP no soportado: ' + entry.compMethod);
}

function colLettersToIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSheetXmlToAoA(sheetXml, sharedStrings) {
  const rows = [];
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const rowNum = parseInt(rowMatch[1], 10);
    const rowContent = rowMatch[2];
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    const rowArr = [];
    while ((cellMatch = cellRe.exec(rowContent))) {
      const colIdx = colLettersToIndex(cellMatch[1]);
      const attrs = cellMatch[2] || '';
      const inner = cellMatch[3] || '';
      const typeMatch = /\st="([^"]+)"/.exec(attrs);
      const type = typeMatch ? typeMatch[1] : 'n';
      const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
      let value = null;
      if (type === 's') {
        value = vMatch ? sharedStrings[parseInt(vMatch[1], 10)] : null;
      } else if (type === 'inlineStr') {
        const isMatch = /<is>([\s\S]*?)<\/is>/.exec(inner);
        value = isMatch
          ? decodeXmlEntities([...isMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''))
          : null;
      } else if (type === 'str') {
        value = vMatch ? decodeXmlEntities(vMatch[1]) : null;
      } else if (type === 'b') {
        value = vMatch ? vMatch[1] === '1' : null;
      } else {
        value = vMatch ? Number(vMatch[1]) : null;
      }
      rowArr[colIdx] = value;
    }
    for (let i = 0; i < rowArr.length; i++) if (rowArr[i] === undefined) rowArr[i] = null;
    rows[rowNum - 1] = rowArr;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

// Localiza el XML de la hoja `sheetName` (y sus sharedStrings) dentro del
// .xlsx — logica compartida por leerHojaXlsxComoAoA y leerHojaXlsxComoCeldas.
function _localizarHojaXml(filePath, sheetName) {
  const buf = fs.readFileSync(filePath);
  const entries = readZipEntries(buf);

  const workbookXml = readEntryData(buf, entries['xl/workbook.xml']).toString('utf8');
  const nameEsc = sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sheetTagRe = new RegExp('<sheet\\b[^>]*\\bname="' + nameEsc + '"[^>]*/>');
  const sheetTagMatch = sheetTagRe.exec(workbookXml);
  if (!sheetTagMatch) throw new Error('No se encontro la hoja "' + sheetName + '" en el workbook');
  const ridMatch = /r:id="([^"]+)"/.exec(sheetTagMatch[0]);
  if (!ridMatch) throw new Error('No se encontro r:id para la hoja "' + sheetName + '"');
  const rId = ridMatch[1];

  const relsXml = readEntryData(buf, entries['xl/_rels/workbook.xml.rels']).toString('utf8');
  const relRe = new RegExp('<Relationship\\b[^>]*\\bId="' + rId + '"[^>]*/>');
  const relMatch = relRe.exec(relsXml);
  if (!relMatch) throw new Error('No se pudo resolver la relacion de la hoja "' + sheetName + '"');
  const targetMatch = /Target="([^"]+)"/.exec(relMatch[0]);
  const target = targetMatch[1].replace(/^\.?\//, '');
  const sheetKey = entries['xl/' + target] ? 'xl/' + target : target;
  if (!entries[sheetKey]) throw new Error('No se encontro el archivo de la hoja: ' + sheetKey);

  let sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const ssXml = readEntryData(buf, entries['xl/sharedStrings.xml']).toString('utf8');
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(ssXml))) {
      const text = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('');
      sharedStrings.push(decodeXmlEntities(text));
    }
  }

  const sheetXml = readEntryData(buf, entries[sheetKey]).toString('utf8');
  return { sheetXml, sharedStrings };
}

// Lee la hoja `sheetName` de un .xlsx y la devuelve como array-of-arrays
// (fila 0 = encabezados), igual que XLSX.utils.sheet_to_json(ws,{header:1})
// en el navegador — asi trafico-logic.js recibe exactamente la misma forma
// de datos en la prueba que en produccion.
function leerHojaXlsxComoAoA(filePath, sheetName) {
  const { sheetXml, sharedStrings } = _localizarHojaXml(filePath, sheetName);
  return parseSheetXmlToAoA(sheetXml, sharedStrings);
}

// Lee la hoja `sheetName` y la devuelve como un objeto de celdas por
// direccion (A1, B2, ...) con { v, f } — misma forma que un worksheet de
// SheetJS (ws['A1'].v / ws['A1'].f) — para probar deteccion de formulas sin
// valor cacheado (cargasDetectarFormulaSinValor en cargas-logic.js) contra un
// .xlsx real, sin depender del paquete npm `xlsx` (ver cabecera del archivo).
function leerHojaXlsxComoCeldas(filePath, sheetName) {
  const { sheetXml, sharedStrings } = _localizarHojaXml(filePath, sheetName);
  const cells = {};
  const cellRe = /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRe.exec(sheetXml))) {
    const addr = m[1];
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const typeMatch = /\st="([^"]+)"/.exec(attrs);
    const type = typeMatch ? typeMatch[1] : 'n';
    const fMatch = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner);
    const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
    const cell = {};
    if (fMatch) cell.f = decodeXmlEntities(fMatch[1]);
    if (vMatch) {
      if (type === 's') cell.v = sharedStrings[parseInt(vMatch[1], 10)];
      else if (type === 'str' || type === 'b') cell.v = decodeXmlEntities(vMatch[1]);
      else cell.v = Number(vMatch[1]);
    }
    cells[addr] = cell;
  }
  return cells;
}

module.exports = { leerHojaXlsxComoAoA, leerHojaXlsxComoCeldas };
