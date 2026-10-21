// registro-clientes.js — Fase 153 (Paso 2 de docs/plantillas-cliente.md):
// las listas por modulo que antes estaban fijas en cada archivo
// (CARGAS_CLIENTES_* de cargas.js, LU_CAMPANAS_ASESOR_VISIBLE_CLIENTE de
// llamadas-unicas.js, WPP_TIEMPOS_CAMPANAS de whatsapp-tiempos.js, los
// logos y la clase de "Ultima actualizacion" de dashboard-generic.js) salen
// del registro de clientes: sus modulos activos y sus parametros.
//
// REGISTRO_CLIENTES empieza con una copia de la semilla del servidor
// (server/clientes-registro.js, REGISTRO_INICIAL; la prueba
// fase153-listas-registro exige que sean iguales) y, tras el login,
// loadDashboardClientes (dashboards-core.js) lo reemplaza con el registro
// real (GET /api/dashboard/clientes) y llama a aplicarRegistroClientes.
//
// Doble modo: global en el navegador y require() en Node para las pruebas.
'use strict';

var REGISTRO_CLIENTES = [
  {
    nombre: 'ORLANT',
    modulos: ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'tipificacion', 'calidad',
      'agendas', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas', 'salida'],
    parametros: { sedes: [], asesorVisibleCliente: false, traficoDosHojas: true,
      especificos: ['orlant_pestanas_manuales', 'orlant_resumen_trafico', 'borrado_por_rango'] },
    logo: { src: 'img/clientes/orlant-logo-blanco.png', src2x: 'img/clientes/orlant-logo-blanco@2x.png', alt: 'Orlant', width: 64, height: 25 }
  },
  {
    nombre: 'MOBILIZE',
    modulos: ['flujo_llamadas', 'tipificacion', 'calidad', 'llamadas_unicas', 'encuesta'],
    parametros: { sedes: [], asesorVisibleCliente: true, traficoDosHojas: false, especificos: [],
      claseUltimaActualizacion: 'gd-ultima-act-mobilize' },
    logo: { src: 'img/clientes/mobilize-logo.png', src2x: 'img/clientes/mobilize-logo@2x.png', alt: 'Mobilize', width: 140, height: 25 }
  }
];

function _registroTieneModulo(c, m) { return (c.modulos || []).indexOf(m) !== -1; }
function _registroParam(c, p) { return (c.parametros || {})[p]; }

// Listas por modulo a partir del registro (funcion pura, la usa la prueba).
//  - traficoUnificado: plantilla de Trafico de 2 hojas (LLAMADAS/WHATSAPP).
//  - tipificacionExtra: Tipificacion por el CDR de Wolkvox, para quien NO
//    usa la plantilla de 2 hojas (ahi la Tipificacion viene incluida).
//  - llamadasUnicas / llamadasSalida: el modulo llamadas_unicas trae las dos.
//  - traficoWhatsapp (Fase 160): Trafico en 2 hojas (LLAMADAS/WHATSAPP) para
//    todo cliente con Flujo de WhatsApp, aunque no use el resto de la
//    plantilla de ORLANT (Clinica Aurora, Hospital La Maria). Sin esto, su
//    unica hoja de Trafico solo reconocia columnas de voz y la plantilla de
//    WhatsApp se rechazaba ("No se encontro la hoja DATA").
function derivarListasRegistro(registro) {
  var r = registro || [];
  function filtro(fn) { return r.filter(fn).map(function (c) { return c.nombre; }); }
  var logos = {};
  var claseUA = {};
  r.forEach(function (c) {
    if (c.logo) logos[c.nombre] = c.logo;
    if (_registroParam(c, 'claseUltimaActualizacion')) claseUA[c.nombre] = _registroParam(c, 'claseUltimaActualizacion');
  });
  return {
    traficoUnificado: filtro(function (c) { return _registroParam(c, 'traficoDosHojas') === true; }),
    traficoWhatsapp: filtro(function (c) { return _registroParam(c, 'traficoDosHojas') === true || _registroTieneModulo(c, 'flujo_whatsapp'); }),
    tipificacionExtra: filtro(function (c) { return _registroTieneModulo(c, 'tipificacion') && _registroParam(c, 'traficoDosHojas') !== true; }),
    llamadasUnicas: filtro(function (c) { return _registroTieneModulo(c, 'llamadas_unicas'); }),
    llamadasSalida: filtro(function (c) { return _registroTieneModulo(c, 'llamadas_unicas'); }),
    whatsappTiempos: filtro(function (c) { return _registroTieneModulo(c, 'whatsapp_tiempos'); }),
    encuesta: filtro(function (c) { return _registroTieneModulo(c, 'encuesta'); }),
    asesorVisibleCliente: filtro(function (c) { return _registroParam(c, 'asesorVisibleCliente') === true; }),
    logos: logos,
    claseUltimaActualizacion: claseUA
  };
}

var LISTAS_REGISTRO = derivarListasRegistro(REGISTRO_CLIENTES);

// Reemplaza el registro con el del servidor y recalcula las listas. Los
// archivos que las usan (cargas.js, llamadas-unicas.js, whatsapp-tiempos.js,
// dashboard-generic.js) las leen de LISTAS_REGISTRO en cada uso, nunca
// guardan una copia.
function aplicarRegistroClientes(registro) {
  if (!Array.isArray(registro)) return;
  REGISTRO_CLIENTES = registro;
  LISTAS_REGISTRO = derivarListasRegistro(registro);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REGISTRO_CLIENTES: REGISTRO_CLIENTES, derivarListasRegistro: derivarListasRegistro };
}
