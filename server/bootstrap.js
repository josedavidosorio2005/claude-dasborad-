// bootstrap.js — Punto de entrada de produccion (Fase B).
//
// 1. Hidrata process.env desde AWS SSM Parameter Store si SSM_PARAM_PREFIX esta
//    definido (secretos fuera del disco).
// 2. Recien entonces carga ./server (que a su vez valida ./config de forma
//    sincrona con el entorno ya completo) y arranca.
//
// En desarrollo/pruebas se sigue usando `node server.js` directamente: sin
// SSM_PARAM_PREFIX este archivo se comporta igual que server.js.

'use strict';

const { hydrateEnv } = require('./secrets');

hydrateEnv()
  .then((res) => {
    if (res.source === 'ssm') {
      console.log(
        `[bootstrap] Secretos cargados desde SSM (${res.prefix}): ${res.loaded.join(', ') || '(ninguno nuevo)'}`
      );
    }
    require('./server').start();
  })
  .catch((err) => {
    console.error('[bootstrap] No se pudieron cargar los secretos:', err.message);
    process.exit(1);
  });
