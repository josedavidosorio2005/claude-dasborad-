// centro-cargas-logic.js — Fase 153: logica PURA del Centro
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

// "MOBILIZE_2026-08_LLAMADAS_UNICAS.xlsx" (solo letras, numeros y _).
function centroNombreArchivoDescarga(cliente, cargaId, mes) {
  var limpio = function (t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); };
  return limpio(cliente) + '_' + String(mes || '').replace(/[^0-9-]/g, '') + '_' + limpio(cargaId) + '.xlsx';
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

// ── PR 4: Subir/Reemplazar DESDE EL MES ─────────────────────────────
// Cargas del Centro que ya suben con el plan de UN modulo y las filas de UN
// mes (empezando por las de Mobilize). Cada una dice que renglon del plan
// de la pantalla de siempre (cargasPlanConsolidado) le corresponde; el
// lector, la vista previa y el guardado son los de siempre.
var CENTRO_CARGA_PLAN = {
  flujo_llamadas: { tipo: 'trafico', canal: 'voz' },
  tipificacion_llamadas: { tipo: 'tipificacion', canalTipificacion: 'LLAMADAS' },
  tipificacion_whatsapp: { tipo: 'tipificacion', canalTipificacion: 'WHATSAPP' },
  llamadas_unicas: { tipo: 'llamadas_unicas' },
  llamadas_salida: { tipo: 'llamadas_salida' },
  encuesta: { tipo: 'encuesta' },
};

function centroSubeDesdeMes(cargaId) { return Object.prototype.hasOwnProperty.call(CENTRO_CARGA_PLAN, cargaId); }

// Los renglones del plan de esa carga (normalmente uno).
function centroFiltrarPlan(plan, cargaId) {
  var spec = CENTRO_CARGA_PLAN[cargaId];
  if (!spec) return plan;
  return (plan || []).filter(function (h) {
    if (h.tipo !== spec.tipo) return false;
    if (spec.canalTipificacion && h.canalTipificacion !== spec.canalTipificacion) return false;
    // Trafico: el renglon de voz de la plantilla de 2 hojas (ORLANT) o el
    // generico de una hoja (el canal lo dice el archivo, se revisa al leer).
    if (spec.tipo === 'trafico' && h.canalFijo && h.canalFijo !== spec.canal) return false;
    return true;
  });
}

// 'AAAA-MM-DD' de una fila ya leida, segun el lector.
function centroFechaFila(tipo, f) {
  if (!f) return '';
  if (tipo === 'llamadas_unicas' || tipo === 'llamadas_salida') return String(f[1] || '');
  if (tipo === 'encuesta') return String(f[0] || '');
  return String(f.fecha || f.fechaInicio || '');
}

// Deja en un resultado de cargasProcesarHoja solo las filas del mes (y, en
// Flujo de Llamadas, solo las skills de ese cliente) y avisa cuantas se
// ignoraron. Nunca cambia la fila: solo la deja o la quita.
// opciones.skillsDelCliente: { 'SKILL': true } (solo Trafico).
function centroFiltrarResultado(r, cargaId, mes, opciones) {
  var spec = CENTRO_CARGA_PLAN[cargaId];
  // Sin filas leidas (el lector las rechazo todas): tal cual, con sus avisos.
  if (!spec || !r || !r.filas || !r.filas.length) return r;
  var nombreMes = centroNombreMes(mes);
  if (spec.tipo === 'trafico' && r.canal && r.canal !== spec.canal) {
    return Object.assign({}, r, { filas: undefined, error: 'Este archivo es de WhatsApp; aquí va el de Llamadas.' });
  }
  var skills = spec.tipo === 'trafico' && opciones && opciones.skillsDelCliente;
  var otrosMeses = {};
  var otrasSkills = 0;
  var filas = r.filas.filter(function (f) {
    var m = centroFechaFila(spec.tipo, f).slice(0, 7);
    if (m !== mes) { otrosMeses[m || 'sin fecha'] = (otrosMeses[m || 'sin fecha'] || 0) + 1; return false; }
    if (skills && !skills[f.skillName]) { otrasSkills++; return false; }
    return true;
  });
  var listaOtros = Object.keys(otrosMeses).sort().map(function (m) {
    return (/^\d{4}-\d{2}$/.test(m) ? centroNombreMes(m).split(' ')[0].toLowerCase() : m) + ' ' + otrosMeses[m];
  });
  if (!filas.length) {
    var motivo = otrasSkills && !listaOtros.length
      ? 'Las filas de ' + nombreMes + ' son de skills de otro cliente o sin asignar.'
      : 'El archivo no trae filas de ' + nombreMes + (listaOtros.length ? ' (trae: ' + listaOtros.join(', ') + ').' : '.');
    return Object.assign({}, r, { filas: undefined, error: motivo });
  }
  var avisos = [];
  var ignoradas = r.filas.length - filas.length - otrasSkills;
  if (ignoradas) avisos.push('Solo se cargan las filas de ' + nombreMes + ': se ignoraron ' + ignoradas + ' fila(s) de otros meses (' + listaOtros.join(', ') + ').');
  if (otrasSkills) avisos.push('Se ignoraron ' + otrasSkills + ' fila(s) de skills de otro cliente o sin asignar (asígnalas en Tráfico o usa la pantalla anterior).');
  return Object.assign({}, r, { filas: filas, avisos: avisos.concat(r.avisos || []), centroIgnoradas: ignoradas + otrasSkills });
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
    centroNombreArchivoDescarga: centroNombreArchivoDescarga,
    centroHuecos: centroHuecos,
    CENTRO_CARGA_PLAN: CENTRO_CARGA_PLAN,
    centroSubeDesdeMes: centroSubeDesdeMes,
    centroFiltrarPlan: centroFiltrarPlan,
    centroFechaFila: centroFechaFila,
    centroFiltrarResultado: centroFiltrarResultado,
  };
}
