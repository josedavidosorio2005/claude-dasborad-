// opciones-precalentar.js — Fase 294 (revision del 07/11, hallazgo #7): al arrancar el
// servidor (despues de cada deploy) la cache de "opciones" (cache-opciones.js) esta
// vacia, y la primera persona que abre un tablero espera a que se calculen TODAS sus
// opciones una tras otra en el unico hilo de Node (ORLANT: ~4 s; la segunda vez,
// 0,5 s). Aqui se llena esa cache EN SEGUNDO PLANO al arrancar, con las MISMAS
// funciones y las MISMAS claves de cada ruta (routes/*.js: JSON.stringify([...])), asi
// que ningun resultado cambia: solo se calcula antes.
//
// No bloquea el arranque ni /api/health: empieza unos segundos despues de escuchar y
// calcula UNA consulta por turno del event loop (setTimeout entre cada una), para que
// los pedidos que lleguen se atiendan entre consulta y consulta. Si una falla, se
// registra y se sigue con la siguiente. Si los datos cambian mientras tanto, la cache
// se vacia sola (firma de datos_version) como siempre.
'use strict';

const { opcionesConCache } = require('./cache-opciones');

// Cada entrada: la clave EXACTA de su ruta y la misma funcion que la ruta.
// (La prueba fase294 comprueba que, ya precalentado, llamar cada ruta no agrega claves.)
function tareasDe(db, campana) {
  const m = (archivo) => require('./' + archivo);
  const t = [];
  const add = (partes, calcular) => t.push({ clave: JSON.stringify(partes), calcular });
  add(['agendas', campana], () => m('agendas').agendasOpciones(db, campana));
  add(['agendas-usuaria', campana], () => m('agendas-usuaria').agendasUsuariaOpciones(db, campana));
  add(['calidad-resumen', campana], () => m('calidad-resumen').calidadResumenOpciones(db, campana));
  add(['efectividad-agendamiento', campana], () => m('efectividad-agendamiento').efectividadAgendamientoOpciones(db, campana));
  add(['efectividad-citas', campana], () => m('efectividad-citas').efectividadCitasOpciones(db, campana));
  add(['flujo-hora', campana], () => m('flujo-hora').flujoHoraOpciones(db, campana));
  add(['inasistencia', campana], () => m('inasistencia').inasistenciaOpciones(db, campana));
  add(['salida', campana], () => m('salida').salidaOpciones(db, campana));
  add(['tipificacion-meses', campana], () => m('tipificaciones').tipificacionesMeses(db, campana));
  for (const canal of m('tipificaciones').CANALES) {
    add(['tipificacion', campana, canal], () => m('tipificaciones').tipificacionesOpciones(db, campana, canal));
  }
  add(['whatsapp-tiempos', campana], () => m('whatsapp-tiempos').whatsappTiemposOpciones(db, campana));
  // Estas 3 dependen de si quien mira ve los nombres de asesor (puedeVerAsesores): las 2 variantes.
  for (const incluirAgentes of [true, false]) {
    add(['encuestas', campana, incluirAgentes], () => m('encuestas').encuestasOpciones(db, campana, { incluirAgentes }));
    add(['llamadas-salida', campana, incluirAgentes], () => m('llamadas-salida').llamadasSalidaOpciones(db, campana, { incluirAgentes }));
    add(['llamadas-unicas', campana, incluirAgentes], () => m('llamadas-unicas').llamadasUnicasOpciones(db, campana, { incluirAgentes }));
  }
  return t;
}

// Todas las tareas: los clientes del registro, en su orden (ORLANT primero).
function tareas(db) {
  const clientes = require('./clientes-registro').leerRegistro(db).map((c) => c.nombre);
  return clientes.flatMap((c) => tareasDe(db, c));
}

// Corre una tarea (sincronica). Devuelve los ms o null si fallo.
function correr(db, tarea, avisar) {
  const t0 = Date.now();
  try {
    opcionesConCache(db, tarea.clave, tarea.calcular);
    return Date.now() - t0;
  } catch (e) {
    if (avisar) avisar(tarea.clave, e);
    return null;
  }
}

// Todas de una vez (para las pruebas).
function precalentarYa(db) {
  const lista = tareas(db);
  lista.forEach((t) => correr(db, t));
  return lista.length;
}

// En segundo plano: espera `demoraMs` y luego una tarea por turno, con `pausaMs`
// entre una y otra. Devuelve una funcion para cancelarlo (cierre del servidor).
// `lista` solo para las pruebas (por defecto, tareas(db) al momento de empezar).
function precalentarEnSegundoPlano(db, { demoraMs = 3000, pausaMs = 20, log = console, lista: listaFija = null } = {}) {
  let cancelado = false;
  let timer = null;
  const programar = (fn, ms) => { timer = setTimeout(fn, ms); if (timer.unref) timer.unref(); };
  programar(() => {
    let lista;
    try { lista = listaFija || tareas(db); } catch (e) { log.error('[precalentar] no se pudo armar la lista:', e.message); return; }
    const t0 = Date.now();
    let i = 0, errores = 0;
    const siguiente = () => {
      if (cancelado) return;
      if (i >= lista.length) {
        log.log(`[precalentar] cache de opciones lista: ${lista.length} consultas en ${Date.now() - t0} ms${errores ? ', ' + errores + ' con error' : ''}.`);
        return;
      }
      correr(db, lista[i++], (clave, e) => { errores++; log.error('[precalentar] ' + clave + ': ' + e.message); });
      programar(siguiente, pausaMs);
    };
    siguiente();
  }, demoraMs);
  return () => { cancelado = true; if (timer) clearTimeout(timer); };
}

module.exports = { tareas, tareasDe, precalentarYa, precalentarEnSegundoPlano };
