// cargas-simultaneas.js — Fase 154: tope de cargas de datos al mismo tiempo.
//
// Cada carga (subir un archivo, su vista previa de impacto, Eliminar un mes,
// Deshacer, el borrado por rango) se procesa entera en el unico hilo del
// servidor, y su cuerpo (hasta 8 MB) queda en memoria mientras espera. Sin
// tope, muchas a la vez podian dejar a los dashboards esperando o quedarse
// sin memoria. Pasado el tope se responde 503 ANTES de leer el cuerpo
// (codigo CARGAS_EN_CURSO + Retry-After) y el navegador reintenta solo
// (public/js/cargas-turno-logic.js): nada se escribio, reintentar es seguro.
//
// Reglas del turno:
//   1. Solo lo toma quien puede intentar esa carga (puede(), abajo); el que
//      no puede recibe su 403 sin ocupar turno. Es un filtro previo, igual
//      o mas amplio que el de cada ruta: la ruta sigue revisando el permiso
//      exacto (campana, modulo...).
//   2. Maximo 1 turno por persona a la vez.
//   3. El cuerpo tiene que terminar de llegar en `tiempoCuerpoMs`: una
//      subida que no termina se corta (408) y libera el turno.
'use strict';

const { actorDeLaPeticion, isFullAdmin, can, canLoadData, canLoadAnyModule, identidadParaLimiteDeTasa } = require('./auth');

const CODIGO = 'CARGAS_EN_CURSO';
const ESPERA_SUGERIDA_S = 3;

// POST/DELETE que cargan, reemplazan o borran datos en bloque, con quien
// puede intentarlas. El orden importa: la primera que calza decide. Una
// ruta de carga nueva que no calce aqui la detecta fase154-tope-cargas.test.js.
const RUTAS_DE_CARGA = [
  { re: /^\/api\/inventario\/carga-(items|movimientos)$/, puede: (a) => can(a, 'Inventario') },
  { re: /^\/api\/gerencia\/carga$/, puede: (a) => canLoadData(a) },
  { re: /^\/api\/monitoreos\/bulk$/, puede: (a) => isFullAdmin(a) || a.rol === 'CALIDAD' || a.rol === 'SUPERVISOR' },
  { re: /^\/api\/calidad\/codificaciones\/bulk$/, puede: (a) => isFullAdmin(a) },
  { re: /^\/api\/calidad\/nivel-servicio\/carga-diaria$/, puede: (a) => isFullAdmin(a) },
  { re: /^\/api\/admin\/borrado-rango$/, puede: (a) => isFullAdmin(a) },
  { re: /\/carga(\/impacto)?$/, puede: (a) => canLoadAnyModule(a) },
  { re: /^\/api\/dashboard\/cargas(\/\d+)?$/, puede: (a) => canLoadAnyModule(a) },
  { re: /^\/api\/centro-cargas\/versiones\/[^/]+\/deshacer$/, puede: (a) => canLoadAnyModule(a) },
  { re: /^\/api\/centro-cargas\/[^/]+\/[^/]+\/[^/]+$/, puede: (a) => canLoadAnyModule(a) },
];

// Fase 157: la ruta como la compara Express (sin distinguir mayusculas y
// con barra final opcional), para que otra forma de escribir la misma ruta
// no se salte el tope.
function rutaNormalizada(req) {
  return String(req.path || '').toLowerCase().replace(/(.)\/+$/, '$1');
}

function reglaDeCarga(req) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return null;
  const ruta = rutaNormalizada(req);
  return RUTAS_DE_CARGA.find((r) => r.re.test(ruta)) || null;
}
function esRutaDeCarga(req) {
  return !!reglaDeCarga(req);
}

// `responderSinLeerCuerpo(req, res, status, cuerpo)` lo pone server.js (el
// mismo que usan el 401 y el 429: descarta el cuerpo sin procesarlo).
function crearTopeCargas({ max, tiempoCuerpoMs, responderSinLeerCuerpo }) {
  let enCurso = 0;
  const porPersona = new Map();
  function middleware(req, res, next) {
    const regla = reglaDeCarga(req);
    if (!regla) return next();
    const actor = actorDeLaPeticion(req);
    // Sin sesion valida (o suspendido): la ruta responde su 401/403, sin turno.
    if (!actor || (!actor.isMasterAdmin && !actor.active)) return next();
    if (!regla.puede(actor)) {
      return responderSinLeerCuerpo(req, res, 403, { error: 'Sin permiso para cargar estos datos' });
    }
    const persona = identidadParaLimiteDeTasa(req);
    if (porPersona.has(persona)) {
      res.set('Retry-After', String(ESPERA_SUGERIDA_S));
      return responderSinLeerCuerpo(req, res, 503, {
        error: 'Ya tienes una carga en curso. Esta espera su turno y sigue sola cuando termine la anterior.',
        codigo: CODIGO,
      });
    }
    if (enCurso >= max) {
      res.set('Retry-After', String(ESPERA_SUGERIDA_S));
      return responderSinLeerCuerpo(req, res, 503, {
        error: 'Hay otras cargas en curso. Tu carga espera su turno y sigue sola en unos segundos.',
        codigo: CODIGO,
      });
    }
    enCurso += 1;
    porPersona.set(persona, true);
    let liberada = false;
    const liberar = () => {
      if (liberada) return;
      liberada = true;
      clearTimeout(reloj);
      enCurso -= 1;
      porPersona.delete(persona);
    };
    // Regla 3: si el cuerpo no termina de llegar a tiempo, se corta.
    const reloj = setTimeout(() => {
      if (req.complete || res.headersSent) return;
      res.set('Connection', 'close');
      res.status(408).json({ error: 'La subida del archivo tardó demasiado. Revisa tu conexión e intenta de nuevo.' });
      req.destroy();
      liberar();
    }, tiempoCuerpoMs);
    reloj.unref();
    res.on('finish', liberar);
    res.on('close', liberar);
    next();
  }
  return { middleware, enCurso: () => enCurso };
}

module.exports = { CODIGO, ESPERA_SUGERIDA_S, RUTAS_DE_CARGA, rutaNormalizada, esRutaDeCarga, crearTopeCargas };
