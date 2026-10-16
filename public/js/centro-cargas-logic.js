// centro-cargas-logic.js — Fase 153 (P2, MAQUETA): logica PURA del Centro
// de cargas (sin DOM). Doble modo: global en el navegador y require() en
// Node para las pruebas.
'use strict';

var CENTRO_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Pestana del tablero -> modulo del catalogo, por el tipo de su primer panel
// (atajo "Actualizar datos"). Una pestana manual de ORLANT no tiene modulo:
// el atajo abre las tarjetas del cliente.
var CENTRO_PANEL_A_MODULO = {
  trafico_combo: 'flujo_llamadas',
  trafico_whatsapp_combo: 'flujo_whatsapp',
  salida_panel: 'salida',
  agendas_panel: 'agendas',
  efectividad_agendamiento_panel: 'efectividad_agendamiento',
  inasistencia_panel: 'inasistencia',
  efectividad_citas_panel: 'efectividad_citas',
  llamadas_unicas_panel: 'llamadas_unicas',
  tipificacion_panel: 'tipificacion',
  encuesta_panel: 'encuesta',
  calidad_kpis: 'calidad',
  calidad_pie: 'calidad',
  calidad_bar_asesores: 'calidad',
};

function centroModuloDeTab(tab) {
  var p = tab && tab.panels && tab.panels[0];
  return (p && CENTRO_PANEL_A_MODULO[p.tipo]) || null;
}

function centroNombreMes(mes) {
  var m = /^(\d{4})-(\d{2})$/.exec(String(mes || ''));
  return m ? CENTRO_MESES[parseInt(m[2], 10) - 1] + ' ' + m[1] : String(mes || '');
}

// 'cargado' | 'vacio' | 'en_curso' (mes actual sin cerrar) | 'futuro'.
function centroEstadoMes(info, mesActual) {
  if (info.mes > mesActual) return 'futuro';
  if (info.registros > 0) return info.mes === mesActual ? 'en_curso' : 'cargado';
  return info.mes === mesActual ? 'en_curso' : 'vacio';
}

function centroFormatoEntero(n) {
  return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function centroTextoRegistros(n) {
  return n === 1 ? '1 registro' : centroFormatoEntero(n) + ' registros';
}

// "16/10/2026 14:32" desde un ISO (hora de Colombia, UTC-5, sin DST).
function centroFechaCorta(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var c = new Date(d.getTime() - 5 * 3600 * 1000);
  var p = function (x) { return (x < 10 ? '0' : '') + x; };
  return p(c.getUTCDate()) + '/' + p(c.getUTCMonth() + 1) + '/' + c.getUTCFullYear() + ' ' + p(c.getUTCHours()) + ':' + p(c.getUTCMinutes());
}

// Resumen de una tarjeta de modulo: meses con datos (de los ya cerrados o en
// curso), total de registros y la ultima carga de cualquiera de sus cargas.
function centroResumenModulo(modulo, mesActual) {
  var meses = {};
  var total = 0;
  var ultima = null;
  (modulo.cargas || []).forEach(function (c) {
    (c.meses || []).forEach(function (m) {
      if (m.registros > 0) {
        meses[m.mes] = true;
        total += m.registros;
        if (!ultima || (m.ultimaCarga && m.ultimaCarga > ultima)) ultima = m.ultimaCarga;
      }
    });
  });
  var hasta = Object.keys(meses).filter(function (m) { return m <= mesActual; }).sort();
  return { mesesConDatos: hasta.length, total: total, ultimaCarga: ultima, ultimoMes: hasta.length ? hasta[hasta.length - 1] : null };
}

// Meses cerrados del ano sin datos, antes del ultimo mes con datos: huecos
// que conviene llenar (aviso amable en la tarjeta).
function centroHuecos(carga, mesActual) {
  var conDatos = (carga.meses || []).filter(function (m) { return m.registros > 0; }).map(function (m) { return m.mes; });
  if (!conDatos.length) return [];
  var primero = conDatos[0];
  return (carga.meses || []).filter(function (m) { return m.mes > primero && m.mes < mesActual && m.registros === 0; }).map(function (m) { return m.mes; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CENTRO_MESES: CENTRO_MESES,
    CENTRO_PANEL_A_MODULO: CENTRO_PANEL_A_MODULO,
    centroModuloDeTab: centroModuloDeTab,
    centroNombreMes: centroNombreMes,
    centroEstadoMes: centroEstadoMes,
    centroTextoRegistros: centroTextoRegistros,
    centroFechaCorta: centroFechaCorta,
    centroResumenModulo: centroResumenModulo,
    centroHuecos: centroHuecos,
  };
}
