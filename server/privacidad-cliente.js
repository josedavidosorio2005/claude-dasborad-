// privacidad-cliente.js — Fase 287 (revision del 07/11, hallazgo #5): lo que recibe una
// cuenta de cliente (rol CLIENTES_DASH).
//  - Monitoreos de Calidad: NUNCA el evaluador, las observaciones ni el «Motivo de
//    afectacion» (texto libre del equipo, que antes no pasaba por la revision de datos
//    de pacientes). El telefono ya no llegaba (Fase 151).
//  - En las campañas con asesorOcultoCliente (registro de clientes: Aurora y HLM),
//    tampoco el nombre del asesor en ninguna respuesta: se cambia por "Asesor 1, 2..."
//    (orden alfabetico del nombre real dentro de cada respuesta), asi los conteos por
//    asesor siguen cuadrando sin decir quien es.
// Los roles internos y el administrador reciben todo, como siempre.
'use strict';

const clientesRegistro = require('./clientes-registro');

function esCuentaCliente(actor) {
  return !!actor && !actor.isMasterAdmin && actor.rol === 'CLIENTES_DASH';
}

// ¿A este actor hay que esconderle los nombres de asesor de esta campaña?
function ocultaAsesores(db, actor, campana) {
  return esCuentaCliente(actor) && clientesRegistro.asesorOcultoCliente(db, campana);
}

// Mapa nombre real -> "Asesor N" (alfabetico, sin distinguir mayusculas ni espacios).
function seudonimos(nombres) {
  const clave = (n) => String(n == null ? '' : n).trim().toLowerCase();
  const distintos = [...new Set((nombres || []).map(clave).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const porClave = new Map(distintos.map((c, i) => [c, 'Asesor ' + (i + 1)]));
  return (n) => porClave.get(clave(n)) || '';
}

// Lista de monitoreos (ya sin telefono) para una cuenta de cliente.
function monitoreosParaCliente(lista, ocultarAsesor) {
  const alias = ocultarAsesor ? seudonimos(lista.map((m) => m.asesor)) : null;
  return lista.map((m) => {
    const out = { ...m };
    delete out.evaluador;
    delete out.evaluadorUserId;
    delete out.observaciones;
    if (out.extras && typeof out.extras === 'object') {
      out.extras = { ...out.extras };
      delete out.extras.motivo;
    }
    if (alias) { out.asesor = alias(m.asesor); out.asesorUserId = null; }
    return out;
  });
}

module.exports = { esCuentaCliente, ocultaAsesores, seudonimos, monitoreosParaCliente };
