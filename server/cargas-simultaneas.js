// cargas-simultaneas.js — Fase 154: tope de cargas de datos al mismo tiempo.
//
// Cada carga (subir un archivo, su vista previa de impacto, Eliminar un mes,
// Deshacer, el borrado por rango) se procesa entera en el unico hilo del
// servidor, y su cuerpo (hasta 8 MB) queda en memoria mientras espera. Sin
// tope, muchas a la vez podian dejar a los dashboards esperando o quedarse
// sin memoria. Pasado el tope se responde 503 ANTES de leer el cuerpo
// (codigo CARGAS_EN_CURSO + Retry-After) y el navegador reintenta solo
// (public/js/cargas-turno-logic.js): nada se escribio, reintentar es seguro.
'use strict';

const CODIGO = 'CARGAS_EN_CURSO';
const ESPERA_SUGERIDA_S = 3;

// POST/DELETE que cargan, reemplazan o borran datos en bloque. Una ruta de
// carga nueva que no calce aqui la detecta fase154-tope-cargas.test.js.
const RUTAS_DE_CARGA = [
  /\/carga(\/impacto)?$/,
  /\/carga-diaria$/,
  /\/carga-(items|movimientos)$/,
  /\/bulk$/,
  /^\/api\/dashboard\/cargas(\/\d+)?$/,
  /^\/api\/centro-cargas\/versiones\/[^/]+\/deshacer$/,
  /^\/api\/centro-cargas\/[^/]+\/[^/]+\/[^/]+$/,
  /^\/api\/admin\/borrado-rango$/,
];

function esRutaDeCarga(req) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return false;
  return RUTAS_DE_CARGA.some((re) => re.test(req.path));
}

// `responderSinLeerCuerpo(req, res, status, cuerpo)` lo pone server.js (el
// mismo que usan el 401 y el 429: descarta el cuerpo sin procesarlo).
function crearTopeCargas({ max, responderSinLeerCuerpo }) {
  let enCurso = 0;
  function middleware(req, res, next) {
    if (!esRutaDeCarga(req)) return next();
    if (enCurso >= max) {
      res.set('Retry-After', String(ESPERA_SUGERIDA_S));
      return responderSinLeerCuerpo(req, res, 503, {
        error: 'Hay otras cargas en curso. Tu carga espera su turno y sigue sola en unos segundos.',
        codigo: CODIGO,
      });
    }
    enCurso += 1;
    let liberada = false;
    const liberar = () => {
      if (liberada) return;
      liberada = true;
      enCurso -= 1;
    };
    res.on('finish', liberar);
    res.on('close', liberar);
    next();
  }
  return { middleware, enCurso: () => enCurso };
}

module.exports = { CODIGO, ESPERA_SUGERIDA_S, RUTAS_DE_CARGA, esRutaDeCarga, crearTopeCargas };
