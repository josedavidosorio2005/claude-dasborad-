// calidad-plantilla-import.js — Fase 253 (plan de Calidad, B2; pedido de
// Edwin 04/11). Valida un archivo de plantilla de calidad (JSON con
// formato "inconexion-plantilla-calidad", el que se arma desde el HTML de
// Edwin) y lo traduce al formato de la plataforma. Logica pura: no toca la
// base ni Express. El archivo real vive FUERA del repo (es texto de Edwin y
// el repo es publico): el administrador lo importa en pantalla.
//
// Archivo:  { formato, version: 1, nombre, campana, motor, campos, etiquetas,
//             items: [{ n, categoria, nombre, peso, critico, admiteNA,
//                       descripcion, vinetas }] }
// Plataforma: items [{ n, cat, label, weight, critico, admiteNA,
//             descripcion, vinetas }] (cat/label/weight = los de siempre).
'use strict';

const camposLib = require('./calidad-campos');

const FORMATO = 'inconexion-plantilla-calidad';
const MOTORES_IMPORTABLES = ['standard']; // 'descuento' (SURA) llega con su propio PR
const MAX_ITEMS = 60;
const MAX_VINETAS = 12;

const texto = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

// Devuelve { plantilla, avisos } o { error } (el primer problema, en español
// simple, para mostrarlo tal cual en pantalla).
function validarPlantillaImport(archivo, opciones) {
  const campanas = (opciones && opciones.campanas) || [];
  if (!archivo || typeof archivo !== 'object' || Array.isArray(archivo)) return { error: 'El archivo no es una plantilla de calidad' };
  if (archivo.formato !== FORMATO) return { error: 'El archivo no es una plantilla de calidad (formato "' + FORMATO + '")' };
  if (archivo.version !== 1) return { error: 'Versión de archivo no soportada (se espera 1)' };
  const nombre = texto(archivo.nombre, 80);
  if (!nombre) return { error: 'La plantilla no tiene nombre' };
  const campana = texto(archivo.campana, 80).toUpperCase();
  if (!campanas.includes(campana)) return { error: 'La campaña "' + texto(archivo.campana, 40) + '" no tiene Calidad (válidas: ' + campanas.join(', ') + ')' };
  const engine = texto(archivo.motor, 20) || 'standard';
  if (!MOTORES_IMPORTABLES.includes(engine)) return { error: 'Motor de cálculo no soportado todavía: "' + engine + '"' };

  const c = camposLib.normalizarCampos(archivo.campos, archivo.etiquetas);
  if (c.error) return { error: c.error };

  if (!Array.isArray(archivo.items) || !archivo.items.length) return { error: 'La plantilla no trae ítems' };
  if (archivo.items.length > MAX_ITEMS) return { error: 'Demasiados ítems (máximo ' + MAX_ITEMS + ')' };
  const items = [];
  const numeros = new Set();
  for (let i = 0; i < archivo.items.length; i++) {
    const it = archivo.items[i] || {};
    const fila = 'Ítem ' + (i + 1);
    const n = Number(it.n);
    if (!Number.isInteger(n) || n < 1 || n > 999) return { error: fila + ': el número debe ser un entero de 1 a 999' };
    if (numeros.has(n)) return { error: 'El número de ítem ' + n + ' está repetido' };
    numeros.add(n);
    const label = texto(it.nombre, 200);
    if (!label) return { error: 'Ítem ' + n + ': falta el nombre' };
    const cat = texto(it.categoria, 80) || 'General';
    const weight = Number(it.peso);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) return { error: 'Ítem ' + n + ': el peso debe ser un número de 0 a 100' };
    if (it.critico != null && typeof it.critico !== 'boolean') return { error: 'Ítem ' + n + ': "critico" debe ser verdadero o falso' };
    if (it.admiteNA != null && typeof it.admiteNA !== 'boolean') return { error: 'Ítem ' + n + ': "admiteNA" debe ser verdadero o falso' };
    const vinetas = Array.isArray(it.vinetas) ? it.vinetas.map((v) => texto(v, 300)).filter(Boolean).slice(0, MAX_VINETAS) : [];
    items.push({ n, cat, label, weight, critico: it.critico === true, admiteNA: it.admiteNA !== false, descripcion: texto(it.descripcion, 1500), vinetas });
  }
  const suma = Math.round(items.reduce((s, it) => s + it.weight, 0) * 100) / 100;
  if (engine === 'standard' && suma !== 100) return { error: 'Los pesos deben sumar 100 (suman ' + suma + ')' };

  const avisos = [];
  const criticos = items.filter((it) => it.critico).length;
  if (!criticos) avisos.push('La plantilla no tiene ítems críticos');
  items.filter((it) => !it.descripcion).forEach((it) => avisos.push('Ítem ' + it.n + ': sin descripción para el diccionario'));

  return {
    plantilla: { nombre, campana, engine, campos: c.campos, items, completoObligatorio: true },
    resumen: { items: items.length, criticos, sumaPesos: suma, categorias: Array.from(new Set(items.map((it) => it.cat))) },
    avisos,
  };
}

module.exports = { FORMATO, MOTORES_IMPORTABLES, validarPlantillaImport };
