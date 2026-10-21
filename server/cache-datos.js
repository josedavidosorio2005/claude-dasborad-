// cache-datos.js — Fase 161: cache en memoria de las respuestas de datos de
// los dashboards (resumenes, por mes, detalle...). Mismo criterio que
// cache-opciones.js: se vacia entera cuando cambian DATOS (firma
// datos_version, ver asegurarDatosVersion en db.js), nunca con un inicio de
// sesion.
//
// Clave: ruta + filtros (la query, con las claves ordenadas) + QUIEN pide:
// id, rol, permisos, version del token y si esta activo. La cache es por
// usuario: todo lo que cambie la respuesta segun quien la pide (rol, ver
// asesores, ver telefono, acceso a campanas...) queda cubierto sin tener que
// enumerarlo, y si a alguien le cambian los permisos, cambia su clave.
//
// Solo GET, solo las rutas de la lista y solo respuestas 200. Sin sesion
// vigente, usuario suspendido o con cambio de clave pendiente, no se toca la
// cache: la ruta responde como siempre (401/403). Se guarda el JSON ya
// serializado (no hay que copiarlo), con un tope por respuesta y de entradas.
'use strict';

const { firmaDatos } = require('./cache-opciones');

// Rutas de datos (relativas a /api). No entran: opciones (tienen su cache),
// cargas, plantillas, metas, monitoreos, umbrales ni nada de administracion.
const RUTAS = [
  /^\/calidad\/agendas\/(especialidad|linea|mensual|ranking)$/,
  /^\/calidad\/efectividad-agendamiento\/ranking$/,
  /^\/calidad\/efectividad-citas\/mensual$/,
  /^\/calidad\/encuestas\/(resumen|fcr|comentarios)$/,
  /^\/calidad\/inasistencia\/(especialidad|mensual)$/,
  /^\/calidad\/llamadas-salida\/(resumen|por-mes|detalle)$/,
  /^\/calidad\/llamadas-unicas\/(resumen|por-mes)$/,
  /^\/calidad\/nivel-servicio\/diario$/,
  /^\/calidad\/salida\/mensual$/,
  /^\/calidad\/tipificacion\/(por-tipo|resumen-salida)$/,
  /^\/calidad\/trafico\/whatsapp$/,
  /^\/calidad\/whatsapp-tiempos\/rangos$/,
];
const MAX_ENTRADAS = 2000;
const MAX_BYTES_RESPUESTA = 2 * 1024 * 1024;

function claveDe(ruta, query, actor) {
  const q = Object.keys(query || {}).sort().map((k) => [k, query[k]]);
  const quien = actor.isMasterAdmin
    ? ['master']
    : [actor.id, actor.rol, actor.token_version, actor.active, JSON.stringify(actor.perms || {})];
  return JSON.stringify([ruta, q, quien]);
}

function crearCacheDatos(db, { actorDeLaPeticion }) {
  const entradas = new Map();
  let firma = null;
  function cacheDatos(req, res, next) {
    if (req.method !== 'GET' || !RUTAS.some((r) => r.test(req.path))) return next();
    const actor = actorDeLaPeticion(req);
    if (!actor || (!actor.isMasterAdmin && (!actor.active || actor.debe_cambiar_password))) return next();
    const actual = firmaDatos(db);
    if (actual !== firma) {
      entradas.clear();
      firma = actual;
    }
    const clave = claveDe(req.path, req.query, actor);
    const guardada = entradas.get(clave);
    if (guardada !== undefined) {
      // Mismo encabezado que pone routes/calidad.js a todo /calidad.
      res.set('Cache-Control', 'no-store');
      return res.type('application/json').send(guardada);
    }
    const json = res.json.bind(res);
    res.json = (cuerpo) => {
      if (res.statusCode === 200 && firmaDatos(db) === firma) {
        const texto = JSON.stringify(cuerpo);
        if (texto !== undefined && texto.length <= MAX_BYTES_RESPUESTA) {
          if (entradas.size >= MAX_ENTRADAS) entradas.clear();
          entradas.set(clave, texto);
        }
      }
      return json(cuerpo);
    };
    next();
  }
  cacheDatos.limpiar = () => entradas.clear();
  cacheDatos.tamano = () => entradas.size;
  return cacheDatos;
}

module.exports = { crearCacheDatos, RUTAS, claveDe };
