// calidad-campos.js — Fase 252 (plan de Calidad, C2; pedido de Edwin 04/11:
// "que se migre su HTML a la aplicacion, tal cual"). Campos del formulario de
// monitoreo POR PLANTILLA, desde una LISTA CERRADA, y monitoreo completo
// obligatorio. Logica pura: no toca la base ni Express.
//
// Cada plantilla nueva (importada, Fase 253) trae `campos`: [{ k, etiqueta }].
// Las plantillas viejas (campos = NULL) siguen con el formulario de siempre.
// Algunos campos son columnas que ya existian en `monitoreos`; los nuevos van
// en `monitoreos.extras` (JSON). Datos personales (cedula del cliente, etc.)
// NO estan en la lista: ver docs/calidad-plan-edwin-nov.md, pregunta 3.
'use strict';

// Fase 352 (reunion con Edwin del 13/11): tope de los textos largos de Calidad (Observaciones,
// Estrategia, Motivo de afectacion y Causa), igual en el formulario y en el servidor.
const TEXTO_LARGO_CALIDAD_MAX = 2000;

// k -> { donde: 'columna' | 'extra' | 'auto', etiqueta por defecto, max }
const CAMPOS_CALIDAD = {
  asesor: { donde: 'columna', etiqueta: 'Nombre del asesor' },
  fecha: { donde: 'columna', etiqueta: 'Fecha de monitoreo' },
  idLlamada: { donde: 'columna', etiqueta: 'ID llamada' },
  codificacion: { donde: 'columna', etiqueta: 'Código de gestión' },
  telefono: { donde: 'columna', etiqueta: '# Teléfono' },
  observaciones: { donde: 'columna', etiqueta: 'Observaciones' },
  evaluador: { donde: 'auto', etiqueta: 'Evaluador' }, // siempre el usuario que califica
  motivo: { donde: 'auto', etiqueta: 'Motivo de afectación' }, // se arma con los items fallados
  placa: { donde: 'extra', etiqueta: 'Placa VH', max: 20 },
  tipoLlamada: { donde: 'extra', etiqueta: 'Tipo de llamada', opciones: ['Entrada', 'Salida'] },
  idAgente: { donde: 'extra', etiqueta: 'ID de agente', max: 60 },
  // Fase 322 (Televentas SURA). Estrategia, Motivo y Causa en texto libre por ahora.
  idContacto: { donde: 'extra', etiqueta: 'ID contacto', max: 60 },
  tipificacionSistema: { donde: 'extra', etiqueta: 'Tipificación sistema', max: 120 },
  estrategia: { donde: 'extra', etiqueta: 'Estrategia', max: TEXTO_LARGO_CALIDAD_MAX }, // Fase 352 (antes 200)
  causa: { donde: 'extra', etiqueta: 'Causa', max: TEXTO_LARGO_CALIDAD_MAX }, // Fase 352 (antes 300)
  // Motivo en texto libre (SURA). El `motivo` automatico (items fallados, Mobilize) no cambia.
  motivoTexto: { donde: 'extra', etiqueta: 'Motivo de afectación', max: TEXTO_LARGO_CALIDAD_MAX }, // Fase 352 (antes 300)
  // Cedula del cliente: dato personal. Solo se guardan los ULTIMOS 4 digitos (••••1234)
  // hasta que el supervisor decida (plan de Calidad, pregunta 3).
  cedula: { donde: 'extra', etiqueta: 'Cédula cliente', mascara: 'ultimos4' },
};
// '1.036.555.777' -> '••••5777'; sin digitos -> ''.
function enmascararCedula(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  return d ? '••••' + d.slice(-4) : '';
}
const CAMPOS_OBLIGATORIOS = ['asesor', 'fecha'];
// Nombres del HTML de Edwin -> clave de la plataforma (mismo dato, otro nombre).
const ALIAS_CAMPOS = { codigo: 'codificacion', obs: 'observaciones' };

function claveCampo(k) {
  const c = String(k == null ? '' : k).trim();
  return ALIAS_CAMPOS[c] || c;
}

// [{k, etiqueta}] valido o { error }. Acepta strings sueltos (clave) o
// objetos; quita repetidos; exige asesor y fecha.
function normalizarCampos(lista, etiquetas) {
  if (!Array.isArray(lista) || !lista.length) return { error: 'La plantilla no trae campos del formulario' };
  const out = [];
  const vistos = new Set();
  for (const x of lista) {
    const k = claveCampo(typeof x === 'string' ? x : x && x.k);
    if (!CAMPOS_CALIDAD[k]) return { error: 'Campo no permitido: "' + String(typeof x === 'string' ? x : x && x.k).slice(0, 40) + '"' };
    if (vistos.has(k)) continue;
    vistos.add(k);
    const crudo = (typeof x === 'object' && x && x.etiqueta) || (etiquetas && (etiquetas[k] || etiquetas[Object.keys(ALIAS_CAMPOS).find((a) => ALIAS_CAMPOS[a] === k)]));
    const etiqueta = String(crudo || CAMPOS_CALIDAD[k].etiqueta).trim().slice(0, 60) || CAMPOS_CALIDAD[k].etiqueta;
    out.push({ k, etiqueta });
  }
  for (const k of CAMPOS_OBLIGATORIOS) if (!vistos.has(k)) return { error: 'La plantilla debe pedir el campo "' + CAMPOS_CALIDAD[k].etiqueta + '"' };
  return { campos: out };
}

function camposDe(plantilla) {
  return Array.isArray(plantilla && plantilla.campos) ? plantilla.campos : null;
}

// Valida los extras que manda el formulario contra los campos de la
// plantilla. Devuelve { extras } (solo las claves permitidas, recortadas) o
// { error }. Claves que no pide la plantilla se ignoran (no se guardan).
function validarExtras(plantilla, extras) {
  const campos = camposDe(plantilla);
  if (!campos) return { extras: null };
  const pedidos = campos.map((c) => c.k).filter((k) => CAMPOS_CALIDAD[k].donde === 'extra');
  const out = {};
  for (const k of pedidos) {
    const def = CAMPOS_CALIDAD[k];
    let v = extras && extras[k] != null ? String(extras[k]).trim() : '';
    if (def.mascara === 'ultimos4') v = enmascararCedula(v); // Fase 322: nunca la cedula completa
    if (!v) continue;
    if (def.opciones && !def.opciones.includes(v)) return { error: def.etiqueta + ': elige ' + def.opciones.join(' o ') };
    if (def.max && v.length > def.max) return { error: def.etiqueta + ': máximo ' + def.max + ' caracteres' };
    out[k] = v;
  }
  return { extras: out };
}

// Fase 322: respuestas validas de un item: SI/NO/N/A, o SI + sus opciones (OP1..).
function respuestasDeItem(it) {
  if (Array.isArray(it.opciones) && it.opciones.length) return it.opciones.map((o) => o.v);
  return it.admiteNA === false ? ['SI', 'NO'] : ['SI', 'NO', 'N/A'];
}
// Items con una respuesta que no les corresponde (una opcion que el item no tiene).
// N/A donde no se admite sigue igual que antes (lo marca itemsFaltantes si la plantilla
// exige monitoreo completo).
function respuestasInvalidas(items, answers) {
  const a = answers || {};
  return (items || []).filter((it) => /^OP\d$/.test(a[it.n] || '') && !respuestasDeItem(it).includes(a[it.n])).map((it) => it.n);
}

// Items sin calificar (o con N/A donde la plantilla no lo admite).
function itemsFaltantes(items, answers) {
  const a = answers || {};
  return (items || []).filter((it) => {
    const v = a[it.n];
    if (Array.isArray(it.opciones) && it.opciones.length) return !respuestasDeItem(it).includes(v); // Fase 322
    if (v !== 'SI' && v !== 'NO' && v !== 'N/A') return true;
    return v === 'N/A' && it.admiteNA === false;
  }).map((it) => it.n);
}

// "Motivo de afectacion" como en el HTML de Edwin: los items en NO, en orden.
function motivoDesdeItems(items, answers) {
  const a = answers || {};
  return (items || []).filter((it) => a[it.n] === 'NO' || (/^OP\d$/.test(a[it.n] || '') && Array.isArray(it.opciones))).map((it) => {
    const o = Array.isArray(it.opciones) ? it.opciones.find((x) => x.v === a[it.n]) : null;
    return it.n + '. ' + it.label + (o ? ' (' + o.t + ')' : ''); // Fase 322: con la opcion elegida
  }).join(' · ');
}

module.exports = { CAMPOS_CALIDAD, CAMPOS_OBLIGATORIOS, ALIAS_CAMPOS, claveCampo, normalizarCampos, camposDe, validarExtras, itemsFaltantes, motivoDesdeItems,
  respuestasDeItem, respuestasInvalidas, enmascararCedula, TEXTO_LARGO_CALIDAD_MAX }; // Fase 322; 352
