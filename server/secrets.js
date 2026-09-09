// secrets.js — Carga de secretos desde AWS SSM Parameter Store (Fase B2).
//
// En produccion los secretos (JWT_SECRET, MASTER_ADMIN_PASSWORD_HASH, ...) NO
// viven en un archivo .env en disco: se guardan como parametros SecureString en
// AWS Systems Manager Parameter Store y el servidor los lee al arrancar usando
// el rol IAM de la instancia (sin claves de acceso en ningun lado).
//
// Activacion: definir SSM_PARAM_PREFIX, p.ej. "/inconexion/prod/". El servidor
// pedira <prefix>JWT_SECRET, <prefix>MASTER_ADMIN_PASSWORD_HASH, etc.
//
// Si SSM_PARAM_PREFIX no esta definido, esto es un no-op y se usa .env / app.env
// como siempre (desarrollo local, pruebas).
//
// El SDK de AWS se carga de forma perezosa: si no esta instalado y no se pidio
// SSM, no pasa nada.

'use strict';

// Parametros que tiene sentido guardar en SSM. Se completan en process.env solo
// si aun no estan definidos (asi un valor explicito en el entorno gana).
const SSM_KEYS = [
  'JWT_SECRET',
  'MASTER_ADMIN_PASSWORD_HASH',
  'MASTER_ADMIN_USER',
  'CORS_ORIGIN',
  'JWT_EXPIRES_IN',
];

async function hydrateEnv() {
  const prefix = process.env.SSM_PARAM_PREFIX;
  if (!prefix) return { loaded: [], source: 'env' };

  let SSMClient, GetParametersByPathCommand;
  try {
    ({ SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm'));
  } catch (e) {
    throw new Error(
      'SSM_PARAM_PREFIX esta definido pero @aws-sdk/client-ssm no esta instalado. ' +
        'Instalalo (npm i @aws-sdk/client-ssm) o quita SSM_PARAM_PREFIX para usar .env.'
    );
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new SSMClient({ region });

  const withSlash = prefix.endsWith('/') ? prefix : prefix + '/';
  const found = {};
  let nextToken;
  do {
    const out = await client.send(
      new GetParametersByPathCommand({
        Path: withSlash,
        WithDecryption: true,
        Recursive: false,
        MaxResults: 10,
        NextToken: nextToken,
      })
    );
    for (const p of out.Parameters || []) {
      const name = p.Name.slice(withSlash.length);
      found[name] = p.Value;
    }
    nextToken = out.NextToken;
  } while (nextToken);

  const loaded = [];
  for (const key of SSM_KEYS) {
    if (found[key] !== undefined && (process.env[key] === undefined || process.env[key] === '')) {
      process.env[key] = found[key];
      loaded.push(key);
    }
  }
  return { loaded, source: 'ssm', prefix: withSlash };
}

module.exports = { hydrateEnv, SSM_KEYS };
