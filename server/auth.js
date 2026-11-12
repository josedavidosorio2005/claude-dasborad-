// auth.js — Emisión/verificación de JWT y checks de permisos server-side.
// IMPORTANTE: nunca confiamos solo en lo que decide la interfaz (el navegador);
// cada endpoint sensible vuelve a validar el permiso aquí, con los datos reales
// del usuario tal como están guardados en la base de datos.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config');
// Fase 283: perfil del SUPERVISOR (supervisa_<C>), la misma regla que el navegador.
const { permisosEfectivos, supervisorUsaPerfil, supervisorClientes } = require('../public/js/perfil-supervisor-logic.js');

// La validez de JWT_SECRET (longitud minima, etc.) ya se garantiza en config.js
// al arrancar; aqui solo lo consumimos.
const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN = config.jwtExpiresIn;

// Fase 102 (endurecimiento, defensa en profundidad): fija el algoritmo en
// vez de dejar que `jsonwebtoken` decida por defecto -- con un secreto de
// texto plano la libreria ya solo acepta HS256/384/512 (nunca `alg:none` ni
// confusion RS<->HS), asi que esto no cambia ningun comportamiento real,
// solo deja de depender de un default implicito de una dependencia externa.
const JWT_ALGORITHM = 'HS256';

// Fase 151: cada token lleva un identificador unico (jwtid -> claim `jti`)
// para que el cierre de sesion pueda revocar ESE token puntual (tabla
// tokens_revocados) sin cerrar las sesiones del usuario en otros equipos.
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM, jwtid: crypto.randomUUID() });
}

function tokenRevocado(auth) {
  if (!auth || !auth.jti) return false;
  return !!db.prepare('SELECT 1 FROM tokens_revocados WHERE jti = ?').get(auth.jti);
}

// Revoca el token de la peticion actual (cierre de sesion). Limpia de paso
// los ya vencidos, que de todas formas no servirian.
function revocarToken(auth) {
  if (!auth || !auth.jti || !auth.exp) return;
  const ahora = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM tokens_revocados WHERE exp < ?').run(ahora);
  db.prepare('INSERT OR IGNORE INTO tokens_revocados (jti, exp) VALUES (?, ?)').run(auth.jti, auth.exp);
}

// Fase 151: mientras una cuenta tenga una contrasena asignada por un
// administrador sin cambiar, solo puede cambiarla o cerrar sesion.
const RUTAS_PERMITIDAS_SIN_CAMBIAR_PASSWORD = ['/api/auth/password', '/api/auth/logout'];
function bloqueadaPorCambioDePassword(actor, req) {
  if (!actor || actor.isMasterAdmin || !actor.debe_cambiar_password) return false;
  const ruta = String(req.originalUrl || '').split('?')[0];
  return !RUTAS_PERMITIDAS_SIN_CAMBIAR_PASSWORD.includes(ruta);
}
function responderCambioDePassword(res) {
  return res.status(403).json({ error: 'Debes cambiar tu contrasena antes de continuar.', codigo: 'DEBE_CAMBIAR_PASSWORD' });
}

// Middleware: exige un token válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.auth = decoded; // { isMasterAdmin, userId, rol }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

// Carga el usuario "actor" (quien hace la peticion) desde la BD, fresco.
// Fase 154: el actor de una peticion, o null si no hay sesion valida. Sin
// responder nada (lo usa el tope de cargas antes de que corra la ruta).
function actorDeLaPeticion(req) {
  if (!req.auth) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    try {
      req.auth = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    } catch (e) {
      return null;
    }
  }
  return getActor(req);
}

function getActor(req) {
  if (tokenRevocado(req.auth)) return null;
  if (req.auth.isMasterAdmin) {
    return { id: null, nombre: 'Administrador', user: config.masterAdminUser, rol: 'ADMIN', isMasterAdmin: true, perms: { isAdmin: true } };
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.userId);
  if (!row) return null;
  // Fase 113 (tema B): un token firmado ANTES de un cambio de contrasena
  // (propio o por reseteo de admin) trae una tokenVersion vieja -- se
  // incrementa token_version en BD al cambiar la contrasena, asi que
  // comparar aqui invalida ese token de inmediato en la SIGUIENTE peticion,
  // sin necesidad de guardar una lista de tokens revocados. Se trata igual
  // que "actor no encontrado" (401 generico) para no distinguir el motivo.
  if (req.auth.tokenVersion !== row.token_version) return null;
  // Fase 283: un SUPERVISOR en el perfil nuevo decide su acceso SOLO por supervisa_<C>.
  return { ...row, perms: permisosEfectivos(row.rol, JSON.parse(row.perms || '{}')), isMasterAdmin: false };
}

function isFullAdmin(actor) {
  return actor && (actor.isMasterAdmin || actor.rol === 'ADMIN');
}

function can(actor, action) {
  if (!actor) return false;
  if (isFullAdmin(actor)) return true;
  return !!(actor.perms && actor.perms[action] === true);
}

// Middleware factory: exige que el actor sea admin o tenga el permiso indicado
function requirePermission(action) {
  // Fase 154: con nombre, para que fase154-rutas-con-sesion la reconozca.
  return function requirePermission(req, res, next) {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });
    if (!actor.isMasterAdmin && !actor.active) {
      return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });
    }
    if (bloqueadaPorCambioDePassword(actor, req)) return responderCambioDePassword(res);
    if (!can(actor, action)) return res.status(403).json({ error: 'Sin permiso para esta accion' });
    req.actor = actor;
    next();
  };
}

// Fase 130 (Parte 7): identidad LIGERA para el limitador de tasa general
// (server.js) -- solo decodifica el JWT (sin ir a la base de datos, a
// diferencia de getActor/requireActor) para poder clasificar la peticion
// como "autenticada" ANTES de que corra ninguna ruta. Nunca se usa para
// decidir permisos (eso sigue siendo requireActor/requirePermission en
// cada ruta) -- esto solo elige la LLAVE del contador de peticiones. Un
// token invalido/expirado/ausente devuelve null (la peticion cae en el
// limitador por IP, igual que cualquier anonimo).
function identidadParaLimiteDeTasa(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    return decoded.isMasterAdmin ? 'admin' : `u${decoded.userId}`;
  } catch (e) {
    return null;
  }
}

// Middleware: carga el actor fresco en req.actor (sin exigir un permiso concreto).
// Lo usan los endpoints del modulo de Calidad, que despues hacen sus propios
// chequeos por campana con los helpers de abajo.
function requireActor(req, res, next) {
  if (!req.auth) {
    // Permite usar requireActor sin encadenar requireAuth antes.
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.auth = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    } catch (e) {
      return res.status(401).json({ error: 'Sesion invalida o expirada' });
    }
  }
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ error: 'No autenticado' });
  if (!actor.isMasterAdmin && !actor.active) {
    return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });
  }
  if (bloqueadaPorCambioDePassword(actor, req)) return responderCambioDePassword(res);
  req.actor = actor;
  next();
}

// ── Permisos del modulo de Calidad (verificados SIEMPRE en el servidor) ──
// Reflejan exactamente las reglas del frontend (public/js/calidad.js), pero
// ahora la decision la toma el servidor con los datos reales del usuario.

// Puede VER los datos de una campana (monitoreos, resumenes, cronograma).
// Acceso: administrador, quien tiene el permiso de esa campana (roles CALIDAD /
// SUPERVISOR / REPORTES / GERENCIA) o quien tiene el permiso del cliente con el
// mismo nombre (rol CLIENTES_DASH / SUPERVISOR) — este ultimo para que el
// dashboard del cliente pueda leer sus resultados de calidad (Fase 2).
// Campanas multi-sede (HOSPITAL LA MARIA: Castilla/Sede33 — ver
// docs/ARQUITECTURA.md): desde la consolidacion de sede (2026-09-15) la
// sede es un ATRIBUTO del dato (columna `sede`), no una campana distinta,
// asi que ya no hace falta ningun mapeo especial aqui: quien tiene
// campana_HOSPITAL LA MARIA / cliente_HOSPITAL LA MARIA ve AMBAS sedes (el
// filtro de sede en el dashboard/panel es solo de visualizacion, no una
// frontera de permisos — decision explicita: el modelo de permisos de esta
// plataforma nunca tuvo granularidad por sede en ningun otro modulo, y
// dashboards_config.vista ya trataba a HOSPITAL LA MARIA como un solo
// dashboard con ambas sedes visibles desde antes de esta migracion).
function campaignAccess(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || !actor.perms) return false;
  return actor.perms['campana_' + campana] === true || actor.perms['cliente_' + campana] === true;
}

// Puede CREAR monitoreos nuevos en una campana (rol CALIDAD o SUPERVISOR con
// acceso a esa campana). Equivale a calCurrentPerm().
function canEvaluateCampaign(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || (actor.rol !== 'CALIDAD' && actor.rol !== 'SUPERVISOR')) return false;
  return actor.perms && actor.perms['campana_' + campana] === true;
}

// Fase 331 (Calidad de encuestas, Mobilize): VER la lista de llamadas con la
// encuesta mal calificada. Todo el que tiene acceso al Modulo de Calidad de la
// campaña (administrador, supervisor, CALIDAD, Reportes, Gerencia, lideres con
// el modulo Calidad) -- nunca el ASESOR ni la cuenta de cliente. Calificarlas
// exige ademas canEvaluateCampaign (como cualquier monitoreo).
// Fase 151 / 343 / 344: el telefono del cliente final (monitoreos y Calidad de encuestas)
// solo lo reciben los roles que califican o revisan Calidad (CALIDAD, SUPERVISOR, REPORTES)
// y el administrador. Nunca el ASESOR, la cuenta de cliente (CLIENTES_DASH) ni GERENCIA.
const ROLES_VEN_TELEFONO = ['CALIDAD', 'SUPERVISOR', 'REPORTES'];
function puedeVerTelefono(actor) {
  return isFullAdmin(actor) || (!!actor && ROLES_VEN_TELEFONO.includes(actor.rol));
}

function canVerCalidadEncuestas(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || !actor.perms || actor.rol === 'ASESOR' || actor.rol === 'CLIENTES_DASH') return false;
  if (actor.perms['campana_' + campana] !== true) return false;
  return canEvaluateCampaign(actor, campana) || actor.perms.Calidad === true;
}

// Fase 237 (plan de Calidad, sec. 3): acceso por plantilla. Permisos
// plantilla_<id> en el mismo perms. Un usuario SIN ninguna plantilla_* en
// true sigue como siempre (todas las plantillas de sus campañas: no se
// rompe a nadie al desplegar); en cuanto el administrador le marca alguna,
// solo puede usar las marcadas. El administrador completo, todas. Se
// revisa SIEMPRE junto con canEvaluateCampaign (la campaña manda primero).
function tienePlantillasMarcadas(actor) {
  return !!(actor && actor.perms && Object.keys(actor.perms).some((k) => /^plantilla_/.test(k) && actor.perms[k] === true));
}
// Fase 342 (decision del usuario, 11/11): quien califica en una campaña (canEvaluateCampaign:
// SUPERVISOR que la supervisa o CALIDAD con la campaña) queda habilitado siempre para la plantilla
// PRINCIPAL de esa campaña, aunque tenga otras marcadas. Las marcadas a mano siguen igual.
// `plantilla` = la fila de calidad_plantillas (campana, principal); sin ella, la regla de antes.
function canUsePlantilla(actor, plantillaId, plantilla) {
  if (isFullAdmin(actor)) return true;
  if (!tienePlantillasMarcadas(actor)) return true;
  if (actor.perms['plantilla_' + plantillaId] === true) return true;
  return !!(plantilla && plantilla.principal && canEvaluateCampaign(actor, plantilla.campana));
}

// Puede EDITAR / ELIMINAR un monitoreo ya guardado: solo rol REPORTES con acceso
// a la campana, o el administrador. Equivale a calCanManageMonitoreos().
function canManageMonitoreos(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || actor.rol !== 'REPORTES') return false;
  return actor.perms && actor.perms['campana_' + campana] === true;
}

// Puede CARGAR datos operativos de los dashboards (Excel). Permiso `cargarDatos`
// asignable a cualquier rol desde Gestion de Usuarios, o administrador.
function canLoadData(actor) {
  if (isFullAdmin(actor)) return true;
  return !!(actor && actor.perms && actor.perms.cargarDatos === true);
}

// Fase 153 (Centro de cargas, PR 5): cargar POR MODULO. Quien tiene
// cargarDatos (REPORTES, ADMIN, o asignado a mano) carga todos los modulos,
// como siempre. Un usuario CALIDAD sin cargarDatos carga SOLO los modulos
// con su `cargar_<modulo>` en true (apagado por defecto, se activa por
// usuario en Usuarios) -- y siempre con campaignAccess al cliente, que cada
// ruta sigue exigiendo aparte. `modulo` = id del catalogo (centro-cargas.js).
// Fase 283: un SUPERVISOR (perfil nuevo) carga TODOS los modulos, solo de sus
// clientes -- cada ruta exige ademas campaignAccess/clienteAccess al cliente.
// Fase 299 (pedido del usuario, 09/11): depende del ROL, no del perfil ni de una
// lista de campanas: cualquier SUPERVISOR con al menos un cliente asignado (perfil
// nuevo supervisa_<C>, o el de antes con cliente_/campana_) carga. Una campana
// creada despues queda cubierta sola en cuanto se le asigna. El alcance lo sigue
// poniendo campaignAccess en cada ruta (id 56: solo Aurora y HLM).
function supervisorCarga(actor) {
  if (!actor || actor.rol !== 'SUPERVISOR' || !actor.perms) return false;
  if (supervisorUsaPerfil(actor.rol, actor.perms)) return supervisorClientes(actor.perms).length > 0;
  return Object.keys(actor.perms).some((k) => /^(cliente|campana)_/.test(k) && actor.perms[k] === true);
}
// Fase 299: ¿este SUPERVISOR puede cargar en ESTA campana? (rol + acceso). Lo usan
// las cargas que no van por modulo (SURA: bases, metas, codigos).
function supervisorPuedeCargarEn(actor, campana) {
  return supervisorCarga(actor) && campaignAccess(actor, campana);
}
// Fase 299: cargas y codigos de UNA campana que antes eran solo del administrador
// (nivel de servicio, codificaciones, listas de Agendamiento, skills de WhatsApp,
// clasificacion de asesores, SURA): el administrador o el SUPERVISOR de esa campana.
// Crear/borrar usuarios, contrasenas, campanas, umbrales, plantillas de Calidad y
// la configuracion de tableros siguen siendo solo del administrador.
function canLoadCampaign(actor, campana) {
  return isFullAdmin(actor) || supervisorPuedeCargarEn(actor, campana);
}
// Antes de leer un registro por :id: quien no puede cargar en NINGUNA campana
// recibe 403 sin saber si el id existe.
function puedeCargarAlgunaCampana(actor) {
  return isFullAdmin(actor) || supervisorCarga(actor);
}
// Fase 310 (revision de seguridad, hallazgo 2): con `campana`, el modulo debe ser
// de esa campaña segun el registro de clientes (clientes_registro.modulos, la misma
// configuracion del Centro de cargas). Si no, error 400 con mensaje claro. Solo se
// revisa cuando quien carga SI tiene permiso y acceso a la campaña (si no, sigue el
// 403 de siempre y no se revela la configuracion de una campaña ajena).
function moduloEsDeLaCampana(campana, modulo) {
  const reg = require('./clientes-registro').leerRegistro(db).find((c) => c.nombre === campana);
  return !!reg && reg.modulos.includes(modulo);
}
function errorModuloAjeno(campana, modulo) {
  const e = new Error('Esta carga («' + modulo + '») no es de la campaña ' + campana + '. Revise el tipo de base o la campaña elegida.');
  e.statusPublico = 400;
  return e;
}
// La campaña de una peticion de carga (POST/PUT/DELETE, en el cuerpo o la query).
function campanaDeCarga(req) {
  if (!req || req.method === 'GET') return undefined;
  if (req.body && typeof req.body.campana === 'string') return req.body.campana;
  if (req.query && typeof req.query.campana === 'string') return req.query.campana;
  return undefined;
}
function canLoadModule(actor, modulo, campana) {
  const permitido = canLoadData(actor) || supervisorCarga(actor) ||
    !!(actor && actor.rol === 'CALIDAD' && actor.perms && actor.perms['cargar_' + modulo] === true);
  if (permitido && campana !== undefined && campaignAccess(actor, campana) && !moduloEsDeLaCampana(campana, modulo)) {
    throw errorModuloAjeno(campana, modulo);
  }
  return permitido;
}

// Puede cargar al menos un modulo (abrir el Centro de cargas). Requiere
// perezoso: centro-cargas.js depende de la base, como este archivo.
function canLoadAnyModule(actor) {
  if (canLoadData(actor)) return true;
  if (supervisorCarga(actor)) return true;
  if (!actor || actor.rol !== 'CALIDAD' || !actor.perms) return false;
  return require('./centro-cargas').MODULOS_CON_PERMISO.some((m) => actor.perms['cargar_' + m] === true);
}

function requireDataLoader(req, res, next) {
  requireActor(req, res, () => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de dashboards' });
    }
    next();
  });
}

module.exports = {
  ROLES_VEN_TELEFONO,
  puedeVerTelefono,
  signToken,
  revocarToken,
  requireAuth,
  getActor,
  isFullAdmin,
  can,
  requirePermission,
  requireActor,
  actorDeLaPeticion,
  identidadParaLimiteDeTasa,
  campaignAccess,
  canEvaluateCampaign,
  canVerCalidadEncuestas, // Fase 331
  canUsePlantilla,
  tienePlantillasMarcadas,
  canManageMonitoreos,
  canLoadData,
  canLoadModule,
  campanaDeCarga, // Fase 310
  canLoadAnyModule,
  supervisorCarga,
  supervisorPuedeCargarEn,
  canLoadCampaign,
  puedeCargarAlgunaCampana,
  requireDataLoader,
};
