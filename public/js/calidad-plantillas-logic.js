// calidad-plantillas-logic.js — Fase 253 (plan de Calidad B2). Logica pura
// del importador de plantillas en pantalla (sin DOM): leer el archivo,
// explicar en palabras simples lo que va a pasar y ordenar la lista de
// plantillas y versiones. La validacion real la hace el servidor
// (server/calidad-plantilla-import.js); esto solo da un error temprano y claro.
var CPL_MAX_BYTES = 512 * 1024;

// Texto del archivo -> { archivo } o { error }.
function cplLeerArchivo(texto, tamano) {
  if (tamano > CPL_MAX_BYTES) return { error: 'El archivo es muy grande (máximo 512 KB)' };
  var obj;
  try { obj = JSON.parse(String(texto || '').replace(/^\uFEFF/, '')); } catch (e) { return { error: 'El archivo no es un JSON válido' }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.formato !== 'inconexion-plantilla-calidad') {
    return { error: 'El archivo no es una plantilla de calidad de la plataforma' };
  }
  return { archivo: obj };
}

// plan (respuesta de la vista previa) -> frases para mostrar.
function cplPlanTexto(plan, nombre, campana) {
  var out = [];
  if (!plan) return out;
  if (plan.accion === 'version' && plan.reemplaza) {
    out.push('Se crea la versión ' + plan.version + ' de "' + nombre + '" en ' + campana + '. La versión ' + plan.reemplaza.version +
      ' queda desactivada y sus ' + plan.reemplaza.monitoreos + ' monitoreo(s) siguen con ella, sin recalcularse.');
  } else {
    out.push('Se crea la plantilla nueva "' + nombre + '" en ' + campana + ' (versión 1).');
  }
  if (plan.principal) {
    if (plan.principalAnterior && !(plan.reemplaza && plan.principalAnterior.id === plan.reemplaza.id)) {
      out.push('Queda como plantilla principal de ' + campana + '. La principal de hoy ("' + plan.principalAnterior.nombre +
        '") sigue activa como opción y sus monitoreos se quedan con ella.');
    } else {
      out.push('Queda como plantilla principal de ' + campana + '.');
    }
  } else {
    out.push('No cambia la plantilla principal: Calidad la elige en el formulario.');
  }
  out.push('No se guarda un monitoreo con ítems sin calificar ("Faltan ítems por calificar").');
  return out;
}

// Lista de /calidad/plantillas/admin -> [{ campana, filas: [...] }] por campaña,
// cada familia junta y la version mas nueva primero.
function cplAgrupar(lista) {
  var porCamp = {};
  (lista || []).forEach(function (p) { (porCamp[p.campana] = porCamp[p.campana] || []).push(p); });
  return Object.keys(porCamp).sort().map(function (c) {
    var filas = porCamp[c].slice().sort(function (a, b) {
      if (a.familiaId !== b.familiaId) return a.familiaId - b.familiaId;
      return (b.version || 1) - (a.version || 1);
    });
    return { campana: c, filas: filas };
  });
}

function cplSumaPesos(items) {
  return Math.round((items || []).reduce(function (s, it) { return s + (Number(it.weight) || 0); }, 0) * 100) / 100;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cplLeerArchivo: cplLeerArchivo, cplPlanTexto: cplPlanTexto, cplAgrupar: cplAgrupar, cplSumaPesos: cplSumaPesos, CPL_MAX_BYTES: CPL_MAX_BYTES };
}
