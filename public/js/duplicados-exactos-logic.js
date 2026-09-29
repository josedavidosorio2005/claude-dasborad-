// duplicados-exactos-logic.js — Fase 88 (hallazgo real del barrido).
//
// Agendas y Tipificacion reemplazan por PERIODO al cargar (borran el rango
// de fechas del archivo, insertan todas las filas) -- eso evita duplicar
// al volver a subir el MISMO archivo, pero NUNCA revisaba si el archivo
// en si traia dos filas EXACTAMENTE iguales (mismos valores en TODAS las
// columnas, incluida fecha/hora): las dos se insertaban, inflando el
// conteo en silencio.
//
// Regla, pedida explicitamente: solo se quitan filas IDENTICAS en TODAS
// las columnas -- nunca "casi iguales" (dos citas del mismo asesor el
// mismo dia con datos distintos son 2 citas reales, no un duplicado).
// Doble modo (global/Node), sin DOM -- lo usan agendas-logic.js y
// tipificacion-logic.js, cada uno sobre sus propias filas ya parseadas
// (mismas claves que se van a guardar), asi que "todas las columnas"
// siempre significa las columnas reales que se insertarian en la base.
function quitarDuplicadosExactos(filas) {
  var vistos = {};
  var out = [];
  var quitadas = 0;
  (filas || []).forEach(function (f) {
    var clave = JSON.stringify(f, Object.keys(f).sort());
    if (vistos[clave]) { quitadas++; return; }
    vistos[clave] = true;
    out.push(f);
  });
  return { filas: out, quitadas: quitadas };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { quitarDuplicadosExactos: quitarDuplicadosExactos };
}
