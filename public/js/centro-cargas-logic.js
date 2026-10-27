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
  calidad_resumen_panel: 'calidad_resumen', // Fase 172
  flujo_hora_panel: 'flujo_hora', // Fase 196
};

// Fase 153 (PR 5): modulos con permiso propio `cargar_<modulo>` para CALIDAD,
// en el orden y con los nombres del catalogo (= MODULOS_CON_PERMISO del
// servidor, centro-cargas.js; una prueba exige que coincidan). Calidad no.
var CENTRO_MODULOS_PERMISO = [
  { id: 'flujo_llamadas', nombre: 'Flujo de Llamadas' },
  { id: 'flujo_whatsapp', nombre: 'Flujo de WhatsApp' },
  { id: 'whatsapp_tiempos', nombre: 'WhatsApp por rangos de tiempo' },
  { id: 'salida', nombre: 'Llamadas y WhatsApp de salida' },
  { id: 'agendas', nombre: 'Agendas' },
  { id: 'efectividad_agendamiento', nombre: 'Efectividad de Agendamiento' },
  { id: 'inasistencia', nombre: 'Inasistencia' },
  { id: 'efectividad_citas', nombre: 'Efectividad de Citas' },
  { id: 'llamadas_unicas', nombre: 'Llamadas Únicas y de Salida' },
  { id: 'flujo_hora', nombre: 'Flujo por hora' }, // Fase 196
  { id: 'tipificacion', nombre: 'Tipificación' },
  { id: 'encuesta', nombre: 'Encuesta' },
  { id: 'calidad_resumen', nombre: 'Calidad: resumen por asesor' }, // Fase 172
];

// Una carga del Centro -> su modulo del catalogo (dos cargas comparten modulo).
function centroModuloDeCarga(cargaId) {
  if (cargaId === 'tipificacion_llamadas' || cargaId === 'tipificacion_whatsapp') return 'tipificacion';
  if (cargaId === 'llamadas_salida' || cargaId === 'llamadas_abandonadas' || cargaId === 'llamadas_no_conectadas') return 'llamadas_unicas';
  return cargaId;
}

// Permisos de carga (mismo criterio que auth.canLoadModule del servidor, que
// es el candado real): cargarDatos = todos; CALIDAD = sus cargar_<modulo>.
// `u` = usuario ({ rol, perms }); `esAdmin` = isFullAdmin() del navegador.
function centroPuedeCargarModulo(u, esAdmin, modulo) {
  if (esAdmin) return true;
  var p = (u && u.perms) || {};
  if (p.cargarDatos === true) return true;
  return !!(u && u.rol === 'CALIDAD' && p['cargar_' + modulo] === true);
}
function centroPuedeCargarAlgo(u, esAdmin) {
  return CENTRO_MODULOS_PERMISO.some(function (m) { return centroPuedeCargarModulo(u, esAdmin, m.id); });
}

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
// Cargas del Centro que suben con el plan de UN modulo y las filas de UN
// mes: las de Mobilize (v1.51.0) y las de ORLANT. `mensual`: el lector
// guarda un dato por mes y reemplaza el mes ENTERO (no por dias). Cada una
// dice que renglon del plan
// de la pantalla de siempre (cargasPlanConsolidado) le corresponde; el
// lector, la vista previa y el guardado son los de siempre.
var CENTRO_CARGA_PLAN = {
  flujo_llamadas: { tipo: 'trafico', canal: 'voz' },
  flujo_whatsapp: { tipo: 'trafico', canal: 'whatsapp' },
  whatsapp_tiempos: { tipo: 'whatsapp_tiempos' },
  agendas: { tipo: 'agendas' },
  salida: { tipo: 'salida', mensual: true },
  efectividad_agendamiento: { tipo: 'efectividad_agendamiento', mensual: true },
  inasistencia: { tipo: 'inasistencia', mensual: true },
  efectividad_citas: { tipo: 'citas_atendidas', mensual: true },
  tipificacion_llamadas: { tipo: 'tipificacion', canalTipificacion: 'LLAMADAS' },
  tipificacion_whatsapp: { tipo: 'tipificacion', canalTipificacion: 'WHATSAPP' },
  llamadas_unicas: { tipo: 'llamadas_unicas' },
  llamadas_salida: { tipo: 'llamadas_salida' },
  llamadas_abandonadas: { tipo: 'llamadas_abandonadas' }, // Fase 191
  llamadas_no_conectadas: { tipo: 'llamadas_no_conectadas' }, // Fase 194
  flujo_hora: { tipo: 'flujo_hora' }, // Fase 196
  encuesta: { tipo: 'encuesta' },
  // Fase 172: la plantilla no trae fecha por fila; el mes es el de la tarjeta.
  calidad_resumen: { tipo: 'calidad_resumen', mensual: true, sinFecha: true },
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
  if (tipo === 'llamadas_unicas' || tipo === 'llamadas_salida' || tipo === 'whatsapp_tiempos') return String(f[1] || '');
  if (tipo === 'llamadas_abandonadas' || tipo === 'llamadas_no_conectadas' || tipo === 'flujo_hora') return String(f[0] || ''); // Fases 191/194/196: [fecha, ...]
  if (tipo === 'encuesta') return String(f[0] || '');
  return String(f.fecha || f.fechaInicio || f.fechaSolicitud || f.mes || '');
}

// Deja en un resultado de cargasProcesarHoja solo las filas del mes y avisa
// cuantas se ignoraron. Nunca cambia la fila: solo la deja o la quita.
// Fase 163 (pedido de Edwin, 21/10): en Flujo de Llamadas ya no se quitan
// las skills que el cliente no tenia registradas: el cliente lo define el
// Centro de cargas (ver centroAvisoSkillsNuevas).
function centroFiltrarResultado(r, cargaId, mes) {
  var spec = CENTRO_CARGA_PLAN[cargaId];
  // Sin filas leidas (el lector las rechazo todas): tal cual, con sus avisos.
  if (!spec || !r || !r.filas || !r.filas.length) return r;
  if (spec.sinFecha) return r; // Fase 172: todas las filas son del mes elegido
  var nombreMes = centroNombreMes(mes);
  if (spec.tipo === 'trafico' && r.canal && r.canal !== spec.canal) {
    return Object.assign({}, r, { filas: undefined, error: spec.canal === 'voz' ? 'Este archivo es de WhatsApp; aquí va el de Llamadas.' : 'Este archivo es de Llamadas; aquí va el de WhatsApp.' });
  }
  var otrosMeses = {};
  var filas = r.filas.filter(function (f) {
    var m = centroFechaFila(spec.tipo, f).slice(0, 7);
    if (m !== mes) { otrosMeses[m || 'sin fecha'] = (otrosMeses[m || 'sin fecha'] || 0) + 1; return false; }
    return true;
  });
  var listaOtros = Object.keys(otrosMeses).sort().map(function (m) {
    return (/^\d{4}-\d{2}$/.test(m) ? centroNombreMes(m).split(' ')[0].toLowerCase() : m) + ' ' + otrosMeses[m];
  });
  if (!filas.length) {
    var motivo = 'El archivo no trae filas de ' + nombreMes + (listaOtros.length ? ' (trae: ' + listaOtros.join(', ') + ').' : '.');
    return Object.assign({}, r, { filas: undefined, error: motivo });
  }
  var avisos = [];
  var ignoradas = r.filas.length - filas.length;
  if (ignoradas) avisos.push('Solo se cargan las filas de ' + nombreMes + ': se ignoraron ' + ignoradas + ' fila(s) de otros meses (' + listaOtros.join(', ') + ').');
  return Object.assign({}, r, { filas: filas, avisos: avisos.concat(r.avisos || []), centroIgnoradas: ignoradas });
}

// Fase 163: las skills del archivo que el cliente todavia no tiene se
// registran solas para el al guardar; la vista previa lo dice antes.
// `skillsDelCliente`: { 'SKILL': true } (las que ya tiene). null si no hay nuevas.
function centroAvisoSkillsNuevas(cliente, filas, skillsDelCliente) {
  var vistas = {};
  (filas || []).forEach(function (f) { if (f && f.skillName && !(skillsDelCliente || {})[f.skillName]) vistas[f.skillName] = true; });
  var nuevas = Object.keys(vistas).sort();
  if (!nuevas.length) return null;
  return 'Skills nuevas que se registran para ' + cliente + ': ' + nuevas.join(', ') + '.';
}

// Primera y ultima fecha de las filas que quedaron, tal como las compara su
// lector: 'AAAA-MM-DD', o con hora en Agendas (su lector reemplaza de la
// primera a la ultima FECHA_SOLICITUD con hora, no por dias enteros).
function centroRangoFilas(cargaId, filas) {
  var spec = CENTRO_CARGA_PLAN[cargaId];
  var desde = null, hasta = null;
  (filas || []).forEach(function (f) {
    var d = centroFechaFila(spec ? spec.tipo : '', f);
    if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(d)) return;
    if (desde === null || d < desde) desde = d;
    if (hasta === null || d > hasta) hasta = d;
  });
  return desde ? { desde: desde, hasta: hasta } : null;
}

// Modulos mensuales: un dato por mes, se reemplaza el mes entero.
function centroEsMensual(cargaId) { return !!(CENTRO_CARGA_PLAN[cargaId] && CENTRO_CARGA_PLAN[cargaId].mensual); }
function centroTextoReemplazoMensual(mes, conteo) {
  var nombre = centroNombreMes(mes).split(' ')[0].toLowerCase();
  if (!conteo || !conteo.enMes) return 'Este módulo se guarda por mes y ' + nombre + ' no tiene datos todavía.';
  return 'Este módulo se guarda por mes: se reemplaza ' + nombre + ' completo (' + centroTextoRegistros(conteo.enMes) + ' de ahora).';
}

// Aviso de reemplazo parcial: el lector reemplaza SOLO las fechas que trae
// el archivo, el resto del mes queda igual. `conteo` = GET
// /centro-cargas/:cliente/:carga/:mes/conteo ({ enMes, enRango }).
function centroTextoReemplazoParcial(mes, rango, conteo) {
  var nombre = centroNombreMes(mes).split(' ')[0].toLowerCase();
  var d = Number(rango.desde.slice(8, 10)), h = Number(rango.hasta.slice(8, 10));
  var trae, esos;
  if (rango.desde.length > 10) {
    var hh = function (x) { return x.slice(11, 16); };
    trae = 'El archivo trae del ' + d + ' de ' + nombre + ' a las ' + hh(rango.desde) + ' al ' + h + ' de ' + nombre + ' a las ' + hh(rango.hasta) + '.';
    esos = ['Se reemplaza ese tramo', 'fuera de él'];
  } else {
    trae = d === h ? 'El archivo trae solo el ' + d + ' de ' + nombre + '.' : 'El archivo trae del ' + d + ' al ' + h + ' de ' + nombre + '.';
    esos = ['Se reemplazan esos días', 'fuera de ellos'];
  }
  if (!conteo || !conteo.enMes) return trae + ' ' + nombre.charAt(0).toUpperCase() + nombre.slice(1) + ' no tiene datos todavía.';
  var resto = conteo.enMes - conteo.enRango;
  if (!resto) return trae + ' ' + esos[0] + '; ' + nombre + ' no tiene registros ' + esos[1] + '.';
  return trae + ' ' + esos[0] + '; el resto de ' + nombre + ' (' + centroTextoRegistros(resto) + ') queda igual.';
}

// Fase 159: aviso de mes incompleto. Un reporte de Wolkvox trae solo los
// dias que tuvieron llamadas (el de agosto de Mobilize arrancaba el 11), y un
// dia sin fila NO es un dia con cero: se dice claro cuantos dias del mes
// trae y cuales faltan, para que nadie tome una carga parcial por el mes
// completo. `fechas`: 'AAAA-MM-DD' de las filas (repetidas da igual).
// `hoyISO`: en el mes en curso solo se cuenta hasta hoy. null si no falta
// ningun dia.
// Fase 171 (pedido de Edwin): en llamadas de salida es normal que haya dias
// sin llamadas, asi que el aviso de mes incompleto salia siempre aunque el
// archivo estuviera bien. Estas cargas no lo llevan.
// Fase 191: tampoco en las abandonadas (un dia sin abandonos es normal).
var CENTRO_SIN_AVISO_COBERTURA = ['llamadas_salida', 'llamadas_abandonadas', 'llamadas_no_conectadas'];
function centroOmiteCobertura(cargaId) {
  return CENTRO_SIN_AVISO_COBERTURA.indexOf(cargaId) !== -1;
}

function centroTextoCobertura(mes, fechas, hoyISO) {
  var nombre = centroNombreMes(mes).split(' ')[0].toLowerCase();
  var anio = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  var ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  if (hoyISO && hoyISO.slice(0, 7) === mes) ultimo = Number(hoyISO.slice(8, 10));
  var dias = {};
  (fechas || []).forEach(function (f) {
    var s = String(f || '');
    if (s.slice(0, 7) === mes) dias[Number(s.slice(8, 10))] = true;
  });
  var lista = Object.keys(dias).map(Number).filter(function (d) { return d <= ultimo; }).sort(function (x, y) { return x - y; });
  if (!lista.length || lista.length >= ultimo) return null;
  var min = lista[0], max = lista[lista.length - 1];
  var tramo = function (d, h) { return d === h ? 'el ' + d + ' de ' + nombre : 'del ' + d + ' al ' + h + ' de ' + nombre; };
  var partes = [];
  if (min > 1) partes.push(tramo(1, min - 1));
  if (max < ultimo) partes.push(tramo(max + 1, ultimo));
  var interior = (max - min + 1) - lista.length;
  var faltan = partes.join(' y ');
  if (interior) faltan += (partes.length ? ' y ' + interior + ' día(s) más' : interior + ' día(s)') + ' entre el ' + min + ' y el ' + max;
  return 'Ojo: el archivo no trae ' + nombre + ' completo. Tiene datos de ' + lista.length + ' de ' + ultimo + ' días: faltan ' +
    faltan + '. Los días que no vienen no se rellenan con cero.';
}

// Fase 155 (reunion con Edwin, 19/10): un modulo con DOS archivos muestra
// arriba las dos opciones juntas (selector), cada una con su cuadricula de
// meses, Subir/Reemplazar y Descargar plantilla. Nombre corto de cada opcion
// (si no esta aqui, el nombre completo de la carga).
var CENTRO_ETIQUETA_CARGA = {
  llamadas_unicas: 'Únicas de ingreso',
  llamadas_salida: 'De salida',
  llamadas_abandonadas: 'Abandonadas', // Fase 191
  llamadas_no_conectadas: 'No conectadas', // Fase 194
  tipificacion_llamadas: 'Llamadas',
  tipificacion_whatsapp: 'WhatsApp',
};
// Fase 191: nota en lugar de "Descargar plantilla" cuando la carga no tiene
// plantilla (se sube el reporte tal cual o se descarga desde otro lado).
var CENTRO_NOTA_SIN_PLANTILLA = {
  calidad: 'La plantilla de Calidad se descarga desde Calidad (depende de los ítems de cada campaña).',
  llamadas_abandonadas: 'Sin plantilla: se sube el reporte de Wolkvox "Detalle de llamadas abandonadas" tal cual lo descarga.',
  llamadas_no_conectadas: 'Sin plantilla: se sube el reporte de Wolkvox "5. Detalle de las llamadas para las no conectadas" tal cual lo descarga.',
};
function centroNotaSinPlantilla(cargaId) {
  return CENTRO_NOTA_SIN_PLANTILLA[cargaId] || CENTRO_NOTA_SIN_PLANTILLA.calidad;
}
function centroEtiquetaCarga(c) {
  return (c && CENTRO_ETIQUETA_CARGA[c.id]) || (c && c.nombre) || '';
}
// Indice de la carga que se muestra: la elegida si existe; si no, la primera.
function centroCargaVisible(modulo, elegida) {
  var n = modulo && modulo.cargas ? modulo.cargas.length : 0;
  return (typeof elegida === 'number' && elegida >= 0 && elegida < n) ? elegida : 0;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CENTRO_ETIQUETA_CARGA: CENTRO_ETIQUETA_CARGA,
    centroEtiquetaCarga: centroEtiquetaCarga,
    centroCargaVisible: centroCargaVisible,
    centroTextoCobertura: centroTextoCobertura,
    centroOmiteCobertura: centroOmiteCobertura,
    CENTRO_MESES: CENTRO_MESES,
    CENTRO_PANEL_A_MODULO: CENTRO_PANEL_A_MODULO,
    centroModuloDeTab: centroModuloDeTab,
    CENTRO_MODULOS_PERMISO: CENTRO_MODULOS_PERMISO,
    centroModuloDeCarga: centroModuloDeCarga,
    centroPuedeCargarModulo: centroPuedeCargarModulo,
    centroPuedeCargarAlgo: centroPuedeCargarAlgo,
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
    centroAvisoSkillsNuevas: centroAvisoSkillsNuevas,
    centroRangoFilas: centroRangoFilas,
    centroTextoReemplazoParcial: centroTextoReemplazoParcial,
    centroEsMensual: centroEsMensual,
    centroTextoReemplazoMensual: centroTextoReemplazoMensual,
    centroNotaSinPlantilla: centroNotaSinPlantilla, // Fase 191
  };
}
