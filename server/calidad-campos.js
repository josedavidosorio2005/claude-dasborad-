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
};
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
    const v = extras && extras[k] != null ? String(extras[k]).trim() : '';
    if (!v) continue;
    if (def.opciones && !def.opciones.includes(v)) return { error: def.etiqueta + ': elige ' + def.opciones.join(' o ') };
    if (def.max && v.length > def.max) return { error: def.etiqueta + ': máximo ' + def.max + ' caracteres' };
    out[k] = v;
  }
  return { extras: out };
}

// Items sin calificar (o con N/A donde la plantilla no lo admite).
function itemsFaltantes(items, answers) {
  const a = answers || {};
  return (items || []).filter((it) => {
    const v = a[it.n];
    if (v !== 'SI' && v !== 'NO' && v !== 'N/A') return true;
    return v === 'N/A' && it.admiteNA === false;
  }).map((it) => it.n);
}

// "Motivo de afectacion" como en el HTML de Edwin: los items en NO, en orden.
function motivoDesdeItems(items, answers) {
  const a = answers || {};
  return (items || []).filter((it) => a[it.n] === 'NO').map((it) => it.n + '. ' + it.label).join(' · ');
}

module.exports = { CAMPOS_CALIDAD, CAMPOS_OBLIGATORIOS, ALIAS_CAMPOS, claveCampo, normalizarCampos, camposDe, validarExtras, itemsFaltantes, motivoDesdeItems };
