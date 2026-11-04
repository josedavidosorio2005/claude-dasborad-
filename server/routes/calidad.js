// routes/calidad.js — Plantillas de evaluacion, monitoreos, cronograma de
// metas y nivel de servicio. Extraido de server.js (Radiografia InConexion,
// #3): solo se movio el cableado HTTP, sin tocar ninguna regla de negocio.
//
// Nota de orden de montaje: el middleware de no-cache de abajo usa el
// prefijo '/calidad', que TAMBIEN cubre las rutas /calidad/trafico/* que
// viven en routes/trafico.js (no en este archivo) — en server.js este
// router se monta ANTES que el de trafico para que ese efecto se preserve
// exactamente igual que en el server.js monolitico original.
const express = require('express');
const db = require('../db');
const calc = require('../calidad-logic');
const { requireActor, isFullAdmin, campaignAccess, canEvaluateCampaign, canManageMonitoreos, canUsePlantilla } = require('../auth');
const { validate, schemas } = require('../validation');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');
const { fechaLimitesHoyColombia } = require('../fecha-limites');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');
const { aplicarAliasAFilas } = require('../alias-asesores');
const camposLib = require('../calidad-campos'); // Fase 252

const router = express.Router();

// Los datos de Calidad cambian con cada monitoreo/meta: nunca cachear las
// respuestas (evita 304 con cuerpo viejo tras un POST).
router.use(['/monitoreos', '/metas', '/calidad'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ── Helpers del modulo de Calidad ────────────────────────────
// Fase 237: una campaña puede tener varias plantillas. Sin plantillaId (o
// NULL en un monitoreo viejo) se usa la principal de la campaña -- la misma
// de siempre. Con plantillaId, esa, si es de la campaña y esta activa.
// Fase 252: `aunInactiva` (solo para EDITAR un monitoreo ya guardado): su
// plantilla puede haber quedado reemplazada por una version nueva.
function getPlantillaRow(campana, plantillaId, aunInactiva) {
  if (plantillaId) {
    return db.prepare('SELECT * FROM calidad_plantillas WHERE id = ? AND campana = ?' + (aunInactiva ? '' : ' AND activo = 1')).get(plantillaId, campana);
  }
  return db
    .prepare('SELECT * FROM calidad_plantillas WHERE campana = ? AND activo = 1 ORDER BY principal DESC, id LIMIT 1')
    .get(campana);
}

// Fase 95 (tema B): catalogo de codificaciones validas por campana.
function toCodificacion(row) {
  return {
    id: row.id,
    campana: row.campana,
    valor: row.valor,
    activo: !!row.activo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function codificacionesActivas(campana) {
  return db
    .prepare('SELECT valor FROM calidad_codificaciones WHERE campana = ? AND activo = 1 ORDER BY lower(valor)')
    .all(campana)
    .map((r) => r.valor);
}

// Si la campana todavia no tiene ningun catalogo cargado, sigue siendo
// texto libre (ok:true, tal cual). En cuanto tiene al menos una fila
// activa, el valor debe coincidir (sin distinguir mayusculas/espacios) con
// alguna -- se normaliza a la forma exacta guardada en el catalogo.
function validarCodificacion(campana, valor) {
  if (!valor) return { ok: true, valor: null };
  const activas = codificacionesActivas(campana);
  if (activas.length === 0) return { ok: true, valor };
  const match = activas.find((v) => v.trim().toLowerCase() === valor.trim().toLowerCase());
  return match ? { ok: true, valor: match } : { ok: false };
}

function toPlantilla(row) {
  return {
    id: row.id,
    nombre: row.nombre || row.campana,
    principal: row.principal === undefined ? true : !!row.principal,
    campana: row.campana,
    engine: row.engine,
    items: JSON.parse(row.items || '[]'),
    // Fase 252: campos del formulario (NULL = los de siempre), version y monitoreo completo.
    campos: row.campos ? JSON.parse(row.campos) : null,
    version: row.version || 1,
    completoObligatorio: !!row.completoObligatorio,
    activo: row.activo === undefined ? true : !!row.activo,
    updatedAt: row.updatedAt,
  };
}

// Fase 151: el telefono del cliente final solo lo reciben los roles que
// trabajan el monitoreo (CALIDAD, SUPERVISOR, REPORTES) y el administrador.
// CLIENTES_DASH, GERENCIA y el resto reciben la fila SIN ese campo. El
// asesor lo sigue viendo en sus propios monitoreos (/monitoreos/mios).
const ROLES_VEN_TELEFONO = ['CALIDAD', 'SUPERVISOR', 'REPORTES'];
function puedeVerTelefono(actor) {
  return isFullAdmin(actor) || (!!actor && ROLES_VEN_TELEFONO.includes(actor.rol));
}
function monitoreoPara(actor, row) {
  const m = toMonitoreo(row);
  if (!puedeVerTelefono(actor)) delete m.telefono;
  return m;
}

function toMonitoreo(row) {
  return {
    id: row.id,
    campana: row.campana,
    asesor: row.asesor,
    asesorUserId: row.asesorUserId || null,
    fecha: row.fecha,
    mes: row.mes,
    canal: row.canal,
    idLlamada: row.idLlamada || '',
    telefono: row.telefono || '',
    codificacion: row.codificacion || '',
    evaluador: row.evaluador,
    evaluadorUserId: row.evaluadorUserId,
    answers: JSON.parse(row.answers || '{}'),
    puntaje: row.puntaje,
    clasificacion: row.clasificacion,
    fallos: row.fallos,
    nivelCritico: row.nivelCritico,
    observaciones: row.observaciones || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
    vistoPorAsesorAt: row.vistoPorAsesorAt || null,
    plantillaId: row.plantillaId || null, // Fase 237 (NULL = la principal de la campaña)
    extras: row.extras ? JSON.parse(row.extras) : null, // Fase 252
    origen: row.origen || 'manual',
    encuestaId: row.encuestaId || null,
  };
}

function toMetaRow(row) {
  return calc.withDerived({
    id: row.id,
    campana: row.campana,
    mes: row.mes,
    liderId: row.liderId,
    liderNombre: row.liderNombre,
    metaGrupal: row.metaGrupal,
    asesores: row.asesores,
    diasLaborales: row.diasLaborales,
    whatsapp: !!row.whatsapp,
    pctWhatsapp: row.pctWhatsapp,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toNivelServicioRow(row) {
  const pct = calc.nivelServicioPct(row.contestadas20s, row.llamadasTotales);
  return {
    id: row.id,
    campana: row.campana,
    mes: row.mes,
    sede: row.sede,
    contestadas20s: row.contestadas20s,
    llamadasTotales: row.llamadasTotales,
    pct,
    cumple: calc.nivelServicioCumple(pct),
    umbral: calc.NIVEL_SERVICIO_UMBRAL,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Registra un evento del modulo de Calidad en el historial (mismo append-only
// que usuarios). El "objetivo" es sintetico: nombre = asesor/lider, rol = campana.
function logCalEvent(accion, nombre, campana, actor, detalle) {
  logEvent(accion, { nombre: nombre || '-', user: '-', rol: campana || '-' }, actorLabel(actor), detalle || '');
}

// Resuelve y valida el asesorUserId que mando el cliente (id elegido en el
// desplegable de populateCalAsesorSelect, Fase 95 tema A): debe ser un
// usuario ASESOR activo, de ESA campana, y con el mismo nombre que el
// campo "asesor" de texto -- evita que un id ajeno o de otra campana quede
// pegado al monitoreo. Si no valida, se guarda null (igual que antes:
// /monitoreos/mios cae al nombre para esos casos).
function resolverAsesorUserId(asesorUserId, asesorNombre, campana) {
  if (!asesorUserId) return null;
  const row = db
    .prepare(
      "SELECT id FROM users WHERE id = ? AND rol = 'ASESOR' AND active = 1 AND asesorCampana = ? AND lower(trim(nombre)) = lower(trim(?))"
    )
    .get(asesorUserId, campana, asesorNombre || '');
  return row ? row.id : null;
}

// Fase 95 (tema C): id de monitoreo desde el que cuenta la alerta de
// "monitoreo nuevo" al asesor (guardado por la migracion
// monitoreos_visto_por_asesor_v1 -- el maximo id que existia justo antes
// del deploy de esta fase). Los monitoreos viejos, incluidos los datos de
// prueba de Calidad, nunca cuentan.
function alertaAsesorDesdeId() {
  const row = db.prepare("SELECT valor FROM app_config WHERE clave = 'alertaAsesorDesdeMonitoreoId'").get();
  return row ? Number(row.valor) : 0;
}

// Es del asesor dueño (mismo criterio que /monitoreos/mios, Fase 95 tema
// A): prioriza el id real, cae al nombre solo para filas viejas sin id.
// Fase 102 (hallazgo real): el fallback por nombre NUNCA filtraba por
// campana -- una fila de OTRA campana (asesorUserId nulo, ej. toda la carga
// masiva historica, que nunca lo completa) con el mismo nombre (coincidencia
// entre 2 campanas distintas) se consideraba "del asesor". Ahora el fallback
// por nombre tambien exige que la fila sea de la MISMA campana del actor
// (asesorCampana, fijada al crear el usuario ASESOR) -- sin esa campana,
// nunca cae al nombre (nunca adivina).
// Fase 252: reglas de la plantilla al guardar (crear o editar): monitoreo
// completo si la plantilla lo pide y los campos extra de su lista cerrada.
// Devuelve { error, faltantes } o { extras } (JSON listo o null).
function reglasDePlantilla(plantilla, answers, extrasBody) {
  if (plantilla.completoObligatorio) {
    const faltantes = camposLib.itemsFaltantes(plantilla.items, answers);
    if (faltantes.length) return { error: 'Faltan ítems por calificar: ' + faltantes.join(', '), faltantes };
  }
  const ex = camposLib.validarExtras(plantilla, extrasBody);
  if (ex.error) return { error: ex.error };
  if (!ex.extras) return { extras: null };
  if ((plantilla.campos || []).some((c) => c.k === 'motivo')) {
    const motivo = camposLib.motivoDesdeItems(plantilla.items, answers);
    if (motivo) ex.extras.motivo = motivo;
  }
  return { extras: JSON.stringify(ex.extras) };
}

// Fase 252: ademas de Reportes/Administrador, la persona de CALIDAD puede
// editar los monitoreos que ella misma califico (regla del HTML de Edwin),
// solo con las plantillas nuevas (con campos propios); ORLANT y las viejas, igual que antes.
function puedeEditarMonitoreo(actor, row) {
  if (canManageMonitoreos(actor, row.campana)) return true;
  const pl = getPlantillaRow(row.campana, row.plantillaId, true);
  if (!pl || !pl.campos) return false;
  return !!actor && actor.rol === 'CALIDAD' && actor.id != null && row.evaluadorUserId === actor.id && canEvaluateCampaign(actor, row.campana);
}

function esDelAsesor(actor, row) {
  if (row.asesorUserId) return actor.id != null && row.asesorUserId === actor.id;
  const nombre = (actor.nombre || '').trim().toLowerCase();
  const campana = (actor.asesorCampana || '').trim();
  return !!nombre && !!campana && row.campana === campana && (row.asesor || '').trim().toLowerCase() === nombre;
}

// ══════════════════════════════════════════════════════════
// CALIDAD — PLANTILLAS (formato de evaluacion por campana)
// ══════════════════════════════════════════════════════════
// Fase 102 (hallazgo real de la auditoria): antes devolvia la plantilla de
// evaluacion de TODAS las campanas a cualquier actor autenticado, sin
// filtrar por campaignAccess -- un actor con acceso a una sola campana veia
// los items/pesos de calificacion de las demas. Mismo criterio que
// GET /dashboard/cargas (routes/dashboards.js): se filtra el contenido por
// acceso, nunca se bloquea el endpoint entero (el admin sigue viendo todas).
router.get(
  '/calidad/plantillas',
  requireActor,
  wrap((req, res) => {
    // Fase 237: sigue devolviendo UNA por campaña (la principal), para que el
    // navegador de hoy (CAL_PLANTILLAS por campaña) no cambie.
    const rows = db
      .prepare('SELECT * FROM calidad_plantillas WHERE activo = 1 ORDER BY campana, principal DESC, id')
      .all()
      .filter((row) => campaignAccess(req.actor, row.campana));
    const vistas = new Set();
    res.json(rows.filter((r) => (vistas.has(r.campana) ? false : vistas.add(r.campana))).map(toPlantilla));
  })
);

// Fase 237: TODAS las plantillas activas que el actor puede ver (formulario
// de usuario: acceso por plantilla; formulario de monitoreo: elegir entre
// varias). `usable`: si este actor puede monitorear con ella.
router.get(
  '/calidad/plantillas/todas',
  requireActor,
  wrap((req, res) => {
    const rows = db
      .prepare('SELECT * FROM calidad_plantillas WHERE activo = 1 ORDER BY campana, principal DESC, id')
      .all()
      .filter((row) => campaignAccess(req.actor, row.campana));
    res.json(rows.map((r) => Object.assign(toPlantilla(r), { usable: canEvaluateCampaign(req.actor, r.campana) && canUsePlantilla(req.actor, r.id) })));
  })
);

// ══════════════════════════════════════════════════════════
// CALIDAD — MONITOREOS
// ══════════════════════════════════════════════════════════

// Los monitoreos del asesor logueado (portal ASESOR). Fase 95 (tema A):
// prioriza el id real del actor (asesorUserId, guardado desde el
// desplegable al crear) y SOLO cae al nombre para monitoreos viejos que no
// lo tienen -- antes emparejaba solo por nombre, lo que hacia que dos
// usuarios con el mismo nombre vieran (o no vieran) los monitoreos del
// otro. Antes de /:id.
// Fase 102: el fallback por nombre ahora tambien exige `campana = @campana`
// (actor.asesorCampana) -- mismo motivo que esDelAsesor, arriba.
router.get(
  '/monitoreos/mios',
  requireActor,
  wrap((req, res) => {
    const nombre = (req.actor.nombre || '').trim().toLowerCase();
    const campana = (req.actor.asesorCampana || '').trim();
    if (!req.actor.id && !nombre) return res.json([]);
    const rows = db
      .prepare(
        `SELECT * FROM monitoreos
         WHERE (asesorUserId = @id)
            OR (asesorUserId IS NULL AND campana = @campana AND lower(trim(asesor)) = @nombre)
         ORDER BY fecha DESC, id DESC`
      )
      .all({ id: req.actor.id || 0, nombre, campana });
    res.json(rows.map(toMonitoreo));
  })
);

// Cuantos monitoreos NUEVOS (creados despues del deploy de esta fase) el
// asesor logueado todavia no ha visto (Fase 95, tema C). Antes de /:id.
// Fase 102: mismo filtro de campana en el fallback por nombre que arriba.
router.get(
  '/monitoreos/mios/nuevos',
  requireActor,
  wrap((req, res) => {
    const nombre = (req.actor.nombre || '').trim().toLowerCase();
    const campana = (req.actor.asesorCampana || '').trim();
    if (!req.actor.id && !nombre) return res.json({ count: 0 });
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM monitoreos
         WHERE ((asesorUserId = @id) OR (asesorUserId IS NULL AND campana = @campana AND lower(trim(asesor)) = @nombre))
           AND vistoPorAsesorAt IS NULL
           AND id > @desde`
      )
      .get({ id: req.actor.id || 0, nombre, campana, desde: alertaAsesorDesdeId() });
    res.json({ count: row.n });
  })
);

// Marca un monitoreo como visto por el asesor dueño (se llama al abrir el
// detalle en "Mis Resultados", Fase 95 tema C). Idempotente: si ya estaba
// marcado, no pisa la fecha original. Solo el asesor dueño puede marcarlo
// -- ni siquiera un administrador (no hace falta: esto es solo el "ya lo
// vi" del propio asesor). Antes de /:id generico (PUT /monitoreos/:id).
router.put(
  '/monitoreos/:id/visto',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Monitoreo no encontrado' });
    if (!esDelAsesor(req.actor, row)) {
      return res.status(403).json({ error: 'Ese monitoreo no es suyo' });
    }
    if (!row.vistoPorAsesorAt) {
      db.prepare('UPDATE monitoreos SET vistoPorAsesorAt = ? WHERE id = ?').run(nowStr(), row.id);
      logCalEvent('MONITOREO_VISTO', row.asesor, row.campana, req.actor, '');
    }
    const updated = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(row.id);
    res.json(toMonitoreo(updated));
  })
);

router.get(
  '/monitoreos',
  requireActor,
  validate(schemas.calidadQuery, 'query'),
  wrap((req, res) => {
    const { campana, mes } = req.query;
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const rows = mes
      ? db
          .prepare('SELECT * FROM monitoreos WHERE campana = ? AND mes = ? ORDER BY id DESC')
          .all(campana, mes)
      : db.prepare('SELECT * FROM monitoreos WHERE campana = ? ORDER BY id DESC').all(campana);
    res.json(rows.map((r) => monitoreoPara(req.actor, r)));
  })
);

router.post(
  '/monitoreos',
  requireActor,
  validate(schemas.createMonitoreoBody),
  wrap((req, res) => {
    const b = req.body;
    if (!canEvaluateCampaign(req.actor, b.campana)) {
      return res.status(403).json({ error: 'No tiene permiso para evaluar esta campana' });
    }
    const plantillaRow = getPlantillaRow(b.campana, b.plantillaId);
    if (!plantillaRow) {
      return res.status(400).json({ error: b.plantillaId ? 'Esa plantilla no es de esta campaña o no está activa' : 'Esa campana no tiene plantilla de calificacion' });
    }
    // Fase 237: acceso por plantilla (plantilla_<id>), ademas de la campaña.
    if (!canUsePlantilla(req.actor, plantillaRow.id)) {
      return res.status(403).json({ error: 'No tiene acceso a esa plantilla de calificación' });
    }
    const plantilla = toPlantilla(plantillaRow);
    const score = calc.computeScore(plantilla.items, b.answers, plantilla.engine);
    if (score.puntaje === null) {
      return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
    }
    const now = nowStr();
    // Fase 95 (tema A): evaluador SIEMPRE el usuario de la sesion (se
    // ignora cualquier texto que mande el cliente); fecha SIEMPRE hoy en
    // Colombia, salvo que el actor sea administrador completo (correccion
    // explicita, envia una fecha distinta).
    const evaluador = req.actor.nombre;
    const fecha = isFullAdmin(req.actor) && b.fecha ? b.fecha : fechaLimitesHoyColombia();
    const asesorUserId = resolverAsesorUserId(b.asesorUserId, b.asesor, b.campana);
    // Fase 95 (tema B): si la campana ya tiene catalogo de codificaciones,
    // el valor debe estar en la lista activa; si no tiene catalogo
    // todavia, sigue siendo texto libre (igual que hasta ahora).
    const codifCheck = validarCodificacion(b.campana, b.codificacion);
    if (!codifCheck.ok) {
      return res.status(400).json({ error: 'Esa codificacion no esta en la lista activa de la campana' });
    }
    const reglas = reglasDePlantilla(plantilla, b.answers, b.extras); // Fase 252
    if (reglas.error) return res.status(400).json({ error: reglas.error, faltantes: reglas.faltantes });
    const info = db
      .prepare(
        `INSERT INTO monitoreos
           (campana, asesor, asesorUserId, fecha, mes, canal, idLlamada, telefono, codificacion,
            evaluador, evaluadorUserId, answers, puntaje, clasificacion, fallos,
            nivelCritico, observaciones, createdAt, plantillaId, extras, origen)
         VALUES (@campana,@asesor,@asesorUserId,@fecha,@mes,@canal,@idLlamada,@telefono,@codificacion,
                 @evaluador,@evaluadorUserId,@answers,@puntaje,@clasificacion,@fallos,
                 @nivelCritico,@observaciones,@createdAt,@plantillaId,@extras,'manual')`
      )
      .run({
        // Fase 237: la principal se guarda como NULL (igual que los viejos);
        // otra plantilla, con su id.
        plantillaId: plantillaRow.principal ? null : plantillaRow.id,
        campana: b.campana,
        asesor: b.asesor,
        asesorUserId,
        fecha,
        mes: calc.monthKey(fecha),
        canal: b.canal,
        idLlamada: b.idLlamada || null,
        telefono: b.telefono || null,
        codificacion: codifCheck.valor,
        evaluador,
        evaluadorUserId: req.actor.isMasterAdmin ? null : req.actor.id,
        answers: JSON.stringify(b.answers),
        puntaje: score.puntaje,
        clasificacion: score.clasificacion,
        fallos: score.fallos,
        nivelCritico: score.nivelCritico,
        observaciones: b.observaciones || null,
        createdAt: now,
        extras: reglas.extras,
      });
    const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(info.lastInsertRowid);
    logCalEvent('MONITOREO', b.asesor, b.campana, req.actor, `Puntaje: ${score.puntaje}`);
    res.status(201).json(monitoreoPara(req.actor, row));
  })
);

// Carga masiva de monitoreos desde Excel (3 hojas: Monitoreos + Diccionario
// + Resumen por Asesor de apoyo). El navegador ya parseo el archivo (mismo
// criterio que el resto de cargas.js/NSD: el servidor nunca abre el Excel,
// solo recibe filas ya validadas como JSON) — aqui se reusa exactamente la
// misma logica de puntaje que el alta individual (calc.computeScore).
// Idempotencia: por (campana, asesor, fecha, idLlamada) SOLO cuando la fila
// trae idLlamada (es la unica clave natural disponible para un monitoreo:
// un mismo asesor puede tener varios monitoreos legitimos el mismo dia).
// Sin idLlamada no hay forma de deduplicar sin inventar una clave — esas
// filas siempre se insertan.
router.post(
  '/monitoreos/bulk',
  requireActor,
  validate(schemas.monitoreoBulkBody),
  wrap((req, res) => {
    const b = req.body;
    if (!canEvaluateCampaign(req.actor, b.campana)) {
      return res.status(403).json({ error: 'No tiene permiso para evaluar esta campana' });
    }
    const plantillaRow = getPlantillaRow(b.campana);
    if (!plantillaRow) {
      return res.status(400).json({ error: 'Esa campana no tiene plantilla de calificacion' });
    }
    const plantilla = toPlantilla(plantillaRow);
    const now = nowStr();
    const evaluadorDefault = req.actor.nombre;
    const evaluadorUserId = req.actor.isMasterAdmin ? null : req.actor.id;

    const buscarExistente = db.prepare(
      `SELECT id FROM monitoreos WHERE campana=? AND asesor=? AND fecha=? AND idLlamada=? LIMIT 1`
    );
    const insertar = db.prepare(
      `INSERT INTO monitoreos
         (campana, asesor, fecha, mes, canal, idLlamada, telefono, codificacion,
          evaluador, evaluadorUserId, answers, puntaje, clasificacion, fallos,
          nivelCritico, observaciones, createdAt)
       VALUES (@campana,@asesor,@fecha,@mes,@canal,@idLlamada,@telefono,@codificacion,
               @evaluador,@evaluadorUserId,@answers,@puntaje,@clasificacion,@fallos,
               @nivelCritico,@observaciones,@createdAt)`
    );
    const actualizar = db.prepare(
      `UPDATE monitoreos SET
         canal=@canal, telefono=@telefono, codificacion=@codificacion, evaluador=@evaluador,
         evaluadorUserId=@evaluadorUserId, answers=@answers, puntaje=@puntaje,
         clasificacion=@clasificacion, fallos=@fallos, nivelCritico=@nivelCritico,
         observaciones=@observaciones
       WHERE id=@id`
    );

    let insertadas = 0;
    let actualizadas = 0;
    let omitidas = 0;
    const avisos = [];

    const tx = db.transaction((filas) => {
      filas.forEach((fila, idx) => {
        const score = calc.computeScore(plantilla.items, fila.answers, plantilla.engine);
        if (score.puntaje === null) {
          omitidas++;
          avisos.push(`Fila ${idx + 2}: ninguna respuesta valida, se omitio.`);
          return;
        }
        const payload = {
          campana: b.campana,
          asesor: fila.asesor,
          fecha: fila.fecha,
          mes: calc.monthKey(fila.fecha),
          canal: fila.canal,
          idLlamada: fila.idLlamada || null,
          telefono: fila.telefono || null,
          codificacion: fila.codificacion || null,
          evaluador: fila.evaluador || evaluadorDefault,
          evaluadorUserId,
          answers: JSON.stringify(fila.answers),
          puntaje: score.puntaje,
          clasificacion: score.clasificacion,
          fallos: score.fallos,
          nivelCritico: score.nivelCritico,
          observaciones: fila.observaciones || null,
          createdAt: now,
        };
        const existente = fila.idLlamada ? buscarExistente.get(b.campana, fila.asesor, fila.fecha, fila.idLlamada) : null;
        if (existente) {
          actualizar.run({ ...payload, id: existente.id });
          actualizadas++;
        } else {
          insertar.run(payload);
          insertadas++;
        }
      });
    });
    // Fase 239 (pendiente "Alias de asesor no se aplica en Calidad"): el
    // nombre del asesor de cada fila pasa por el alias de la campaña, igual
    // que en Agendas y Efectividad de Agendamiento (Fase 122).
    const alias = aplicarAliasAFilas(db, b.campana, b.filas, 'asesor');
    tx(alias.filas);

    logCalEvent(
      'MONITOREO_BULK',
      b.campana,
      b.campana,
      req.actor,
      `Carga masiva "${b.archivoNombre || 'sin nombre'}": ${insertadas} nueva(s), ${actualizadas} actualizada(s), ${omitidas} omitida(s)`
    );
    res.status(201).json({ insertadas, actualizadas, omitidas, avisos, filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados });
  })
);

router.put(
  '/monitoreos/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateMonitoreoBody),
  wrap((req, res) => {
    const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Monitoreo no encontrado' });
    if (!puedeEditarMonitoreo(req.actor, row)) {
      return res
        .status(403)
        .json({ error: 'Solo quien lo calificó, el rol Reportes o el Administrador pueden editar un monitoreo guardado' });
    }
    const b = req.body;
    const plantillaEdit = getPlantillaRow(row.campana, row.plantillaId, true); // Fase 237: la del monitoreo (Fase 252: aunque ya tenga version nueva)
    if (!plantillaEdit) return res.status(400).json({ error: 'La plantilla de este monitoreo ya no está activa' });
    const plantilla = toPlantilla(plantillaEdit);
    const answers = b.answers || JSON.parse(row.answers || '{}');
    const score = calc.computeScore(plantilla.items, answers, plantilla.engine);
    if (score.puntaje === null) {
      return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
    }
    // Fase 95 (tema A): el evaluador original NUNCA cambia al editar (ni el
    // nombre visible ni evaluadorUserId) -- no se aceptan del body. La
    // fecha solo la puede corregir un administrador completo; cualquier
    // otro rol que edite (REPORTES) mantiene la fecha original.
    const fecha = isFullAdmin(req.actor) && b.fecha ? b.fecha : row.fecha;
    const asesorNombre = b.asesor ?? row.asesor;
    const asesorUserId = b.asesorUserId
      ? resolverAsesorUserId(b.asesorUserId, asesorNombre, row.campana)
      : row.asesorUserId;
    // Fase 95 (tema B): solo se valida contra el catalogo si el body trae
    // codificacion (si no la trae, se mantiene la de la fila sin volver a
    // validarla -- ya paso la validacion cuando se creo/edito por ultima vez).
    let codificacion = row.codificacion;
    if (b.codificacion !== undefined) {
      const codifCheck = validarCodificacion(row.campana, b.codificacion);
      if (!codifCheck.ok) {
        return res.status(400).json({ error: 'Esa codificacion no esta en la lista activa de la campana' });
      }
      codificacion = codifCheck.valor;
    }
    // Fase 252: mismas reglas de la plantilla que al crear; sin extras en el body, se conservan.
    const extrasPrevios = row.extras ? JSON.parse(row.extras) : null;
    const reglas = reglasDePlantilla(plantilla, answers, b.extras !== undefined ? b.extras : extrasPrevios);
    if (reglas.error) return res.status(400).json({ error: reglas.error, faltantes: reglas.faltantes });
    db.prepare(
      `UPDATE monitoreos SET
         asesor=?, asesorUserId=?, fecha=?, mes=?, canal=?, idLlamada=?, telefono=?, codificacion=?,
         answers=?, puntaje=?, clasificacion=?, fallos=?, nivelCritico=?,
         observaciones=?, updatedAt=?, extras=?
       WHERE id=?`
    ).run(
      asesorNombre,
      asesorUserId,
      fecha,
      calc.monthKey(fecha),
      b.canal ?? row.canal,
      (b.idLlamada ?? row.idLlamada) || null,
      (b.telefono ?? row.telefono) || null,
      codificacion,
      JSON.stringify(answers),
      score.puntaje,
      score.clasificacion,
      score.fallos,
      score.nivelCritico,
      (b.observaciones ?? row.observaciones) || null,
      nowStr(),
      reglas.extras,
      row.id
    );
    const updated = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(row.id);
    logCalEvent('MONITOREO_EDIT', updated.asesor, row.campana, req.actor, `Puntaje: ${score.puntaje}`);
    res.json(monitoreoPara(req.actor, updated));
  })
);

router.delete(
  '/monitoreos/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Monitoreo no encontrado' });
    if (!canManageMonitoreos(req.actor, row.campana)) {
      return res
        .status(403)
        .json({ error: 'Solo el rol Reportes o el Administrador pueden eliminar un monitoreo guardado' });
    }
    db.prepare('DELETE FROM monitoreos WHERE id = ?').run(row.id);
    logCalEvent('MONITOREO_DEL', row.asesor, row.campana, req.actor, '');
    res.json({ ok: true });
  })
);

// ══════════════════════════════════════════════════════════
// CALIDAD — CATALOGO DE CODIFICACIONES (Fase 95, tema B)
// ══════════════════════════════════════════════════════════

// Lectura: cualquier actor con acceso a la campana (el formulario de
// monitoreo y la pantalla de administracion la necesitan). Incluye
// activas E inactivas -- la pantalla de admin necesita ver ambas para
// poder reactivar; el formulario de monitoreo filtra "activo" en el
// navegador (igual patron que calidad_plantillas/activo).
router.get(
  '/calidad/codificaciones',
  requireActor,
  validate(schemas.calidadQuery, 'query'),
  wrap((req, res) => {
    const { campana } = req.query;
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const rows = db
      .prepare('SELECT * FROM calidad_codificaciones WHERE campana = ? ORDER BY lower(valor)')
      .all(campana);
    res.json(rows.map(toCodificacion));
  })
);

// Alta (pegar varias de una vez, una por linea -> array ya partido por el
// navegador). Deduplica contra lo que YA EXISTE (activo o inactivo) e
// internamente en el mismo pegado, sin distinguir mayusculas/espacios --
// nunca crea un duplicado ni reactiva algo desactivado (eso es una accion
// aparte, PUT :id). Solo administrador completo.
router.post(
  '/calidad/codificaciones/bulk',
  requireActor,
  validate(schemas.codificacionBulkBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede administrar el catalogo de codificaciones' });
    }
    const b = req.body;
    const existentes = new Set(
      db
        .prepare('SELECT valor FROM calidad_codificaciones WHERE campana = ?')
        .all(b.campana)
        .map((r) => r.valor.trim().toLowerCase())
    );
    const now = nowStr();
    const insertar = db.prepare(
      `INSERT INTO calidad_codificaciones (campana, valor, activo, createdAt, updatedAt)
       VALUES (@campana, @valor, 1, @createdAt, @updatedAt)`
    );
    const creadas = [];
    const yaExistian = [];
    const vistasEnEstePegado = new Set();
    const tx = db.transaction((valores) => {
      valores.forEach((valorCrudo) => {
        const valor = valorCrudo.trim();
        const norm = valor.toLowerCase();
        if (existentes.has(norm) || vistasEnEstePegado.has(norm)) {
          yaExistian.push(valor);
          return;
        }
        vistasEnEstePegado.add(norm);
        insertar.run({ campana: b.campana, valor, createdAt: now, updatedAt: now });
        creadas.push(valor);
      });
    });
    tx(b.valores);
    if (creadas.length > 0) {
      logCalEvent(
        'COD_AGREGADA',
        creadas.length === 1 ? creadas[0] : `${creadas.length} codificaciones`,
        b.campana,
        req.actor,
        `Codificacion(es) agregada(s): ${creadas.join(', ')}`
      );
    }
    res.status(201).json({ creadas, yaExistian });
  })
);

// Desactivar / reactivar (nunca se borra: rompería monitoreos viejos que
// la guardaron como texto). Solo administrador completo.
router.put(
  '/calidad/codificaciones/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateCodificacionBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede administrar el catalogo de codificaciones' });
    }
    const row = db.prepare('SELECT * FROM calidad_codificaciones WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Codificacion no encontrada' });
    const activo = req.body.activo ? 1 : 0;
    db.prepare('UPDATE calidad_codificaciones SET activo=?, updatedAt=? WHERE id=?').run(
      activo,
      nowStr(),
      row.id
    );
    const updated = db.prepare('SELECT * FROM calidad_codificaciones WHERE id = ?').get(row.id);
    logCalEvent(activo ? 'COD_REACTIVADA' : 'COD_DESACTIVADA', row.valor, row.campana, req.actor, '');
    res.json(toCodificacion(updated));
  })
);

// ══════════════════════════════════════════════════════════
// CALIDAD — CRONOGRAMA Y METAS
// ══════════════════════════════════════════════════════════

// Cumplimiento individual por lider (calculo reproducible en servidor). Antes de /:id.
router.get(
  '/metas/cumplimiento',
  requireActor,
  validate(schemas.calidadQuery, 'query'),
  wrap((req, res) => {
    const { campana } = req.query;
    const mes = req.query.mes || fechaLimitesHoyColombia().slice(0, 7); // Fase 223 (H4): hora Colombia
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const cronograma = db
      .prepare('SELECT * FROM cronograma_metas WHERE campana = ?')
      .all(campana)
      .map(toMetaRow);
    const monitoreos = db
      .prepare('SELECT * FROM monitoreos WHERE campana = ?')
      .all(campana)
      .map(toMonitoreo);
    res.json({
      campana,
      mes,
      lideres: calc.lideresCumplimiento(monitoreos, cronograma, mes),
    });
  })
);

// La meta individual del usuario logueado para una campana/mes (con carry-forward).
router.get(
  '/metas/mi-meta',
  requireActor,
  validate(schemas.calidadQuery, 'query'),
  wrap((req, res) => {
    const { campana } = req.query;
    const mes = req.query.mes || fechaLimitesHoyColombia().slice(0, 7); // Fase 223 (H4): hora Colombia
    if (req.actor.isMasterAdmin) return res.json({ campana, mes, meta: null });
    // Fase 81 (hallazgo real): faltaba este gate -- el resultado ya se
    // limita a la meta del propio actor (metaForLiderInMonth con su
    // req.actor.id), asi que nunca fugaba la meta de otra persona, pero SI
    // dejaba confirmar/descartar si el actor tiene una meta configurada en
    // una campana a la que no tiene acceso. Mismo criterio que el resto de
    // este archivo (campaignAccess en cada ruta que recibe `campana`).
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const cronograma = db
      .prepare('SELECT * FROM cronograma_metas WHERE campana = ?')
      .all(campana)
      .map(toMetaRow);
    res.json({
      campana,
      mes,
      meta: calc.metaForLiderInMonth(cronograma, mes, req.actor.id),
    });
  })
);

router.get(
  '/metas',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (campana) {
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const rows = db
        .prepare('SELECT * FROM cronograma_metas WHERE campana = ? ORDER BY mes DESC, liderNombre')
        .all(campana);
      return res.json(rows.map(toMetaRow));
    }
    // Sin campana: solo el administrador puede ver el cronograma completo.
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Indique una campana' });
    }
    const rows = db
      .prepare('SELECT * FROM cronograma_metas ORDER BY mes DESC, campana, liderNombre')
      .all();
    res.json(rows.map(toMetaRow));
  })
);

router.post(
  '/metas',
  requireActor,
  validate(schemas.metaBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede configurar el cronograma' });
    }
    const b = req.body;
    const lider = db.prepare('SELECT * FROM users WHERE id = ?').get(b.liderId);
    if (!lider) return res.status(400).json({ error: 'Usuario responsable no encontrado' });
    if (lider.rol !== 'CALIDAD' && lider.rol !== 'SUPERVISOR') {
      return res
        .status(400)
        .json({ error: 'El responsable debe tener rol CALIDAD o SUPERVISOR' });
    }
    const now = nowStr();
    const existing = db
      .prepare('SELECT * FROM cronograma_metas WHERE campana = ? AND mes = ? AND liderId = ?')
      .get(b.campana, b.mes, b.liderId);
    if (existing) {
      db.prepare(
        `UPDATE cronograma_metas SET
           liderNombre=?, metaGrupal=?, asesores=?, diasLaborales=?, whatsapp=?, pctWhatsapp=?, updatedAt=?
         WHERE id=?`
      ).run(
        lider.nombre,
        b.metaGrupal,
        b.asesores,
        b.diasLaborales,
        b.whatsapp ? 1 : 0,
        b.pctWhatsapp,
        now,
        existing.id
      );
      const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(existing.id);
      logCalEvent('META_EDIT', lider.nombre, b.campana, req.actor, `${b.mes} — meta ${b.metaGrupal}`);
      return res.json(toMetaRow(row));
    }
    const info = db
      .prepare(
        `INSERT INTO cronograma_metas
           (campana, mes, liderId, liderNombre, metaGrupal, asesores, diasLaborales,
            whatsapp, pctWhatsapp, createdAt, updatedAt)
         VALUES (@campana,@mes,@liderId,@liderNombre,@metaGrupal,@asesores,@diasLaborales,
                 @whatsapp,@pctWhatsapp,@createdAt,@updatedAt)`
      )
      .run({
        campana: b.campana,
        mes: b.mes,
        liderId: b.liderId,
        liderNombre: lider.nombre,
        metaGrupal: b.metaGrupal,
        asesores: b.asesores,
        diasLaborales: b.diasLaborales,
        whatsapp: b.whatsapp ? 1 : 0,
        pctWhatsapp: b.pctWhatsapp,
        createdAt: now,
        updatedAt: now,
      });
    const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(info.lastInsertRowid);
    logCalEvent('META', lider.nombre, b.campana, req.actor, `${b.mes} — meta ${b.metaGrupal}`);
    res.status(201).json(toMetaRow(row));
  })
);

router.put(
  '/metas/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateMetaBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede editar el cronograma' });
    }
    const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Meta no encontrada' });
    const b = req.body;
    let liderNombre = row.liderNombre;
    let liderId = row.liderId;
    if (b.liderId && b.liderId !== row.liderId) {
      const lider = db.prepare('SELECT * FROM users WHERE id = ?').get(b.liderId);
      if (!lider) return res.status(400).json({ error: 'Usuario responsable no encontrado' });
      if (lider.rol !== 'CALIDAD' && lider.rol !== 'SUPERVISOR') {
        return res.status(400).json({ error: 'El responsable debe tener rol CALIDAD o SUPERVISOR' });
      }
      liderNombre = lider.nombre;
      liderId = lider.id;
    }
    try {
      db.prepare(
        `UPDATE cronograma_metas SET
           campana=?, mes=?, liderId=?, liderNombre=?, metaGrupal=?, asesores=?,
           diasLaborales=?, whatsapp=?, pctWhatsapp=?, updatedAt=?
         WHERE id=?`
      ).run(
        b.campana ?? row.campana,
        b.mes ?? row.mes,
        liderId,
        liderNombre,
        b.metaGrupal ?? row.metaGrupal,
        b.asesores ?? row.asesores,
        b.diasLaborales ?? row.diasLaborales,
        b.whatsapp === undefined ? row.whatsapp : b.whatsapp ? 1 : 0,
        b.pctWhatsapp ?? row.pctWhatsapp,
        nowStr(),
        row.id
      );
    } catch (e) {
      // Ya existe otra meta para esa (campana, mes, liderId) -> conflicto amigable,
      // no un 500 generico (UNIQUE(campana, mes, liderId) en cronograma_metas).
      if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Ya existe una meta para esa campana, mes y lider responsable' });
      }
      throw e;
    }
    const updated = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(row.id);
    logCalEvent('META_EDIT', updated.liderNombre, updated.campana, req.actor, `${updated.mes}`);
    res.json(toMetaRow(updated));
  })
);

router.delete(
  '/metas/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar del cronograma' });
    }
    const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Meta no encontrada' });
    db.prepare('DELETE FROM cronograma_metas WHERE id = ?').run(row.id);
    logCalEvent('META_DEL', row.liderNombre, row.campana, req.actor, `${row.mes}`);
    res.json({ ok: true });
  })
);

// ══════════════════════════════════════════════════════════
// CALIDAD — NIVEL DE SERVICIO (feedback de Edwin, punto 3.2)
// % de llamadas contestadas en <=20s sobre el total, por campana/mes.
// ══════════════════════════════════════════════════════════
router.get(
  '/calidad/nivel-servicio',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (campana) {
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const rows = db
        .prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? ORDER BY mes DESC')
        .all(campana);
      return res.json(rows.map(toNivelServicioRow));
    }
    // Sin campana: solo el administrador puede ver el listado completo.
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Indique una campana' });
    }
    const rows = db
      .prepare('SELECT * FROM calidad_nivel_servicio ORDER BY mes DESC, campana')
      .all();
    res.json(rows.map(toNivelServicioRow));
  })
);

router.post(
  '/calidad/nivel-servicio',
  requireActor,
  validate(schemas.nivelServicioBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede cargar el nivel de servicio' });
    }
    const b = req.body;
    const now = nowStr();
    // sede IS NULL: esta pantalla manual nunca la pide, y con la
    // consolidacion HOSPITAL LA MARIA (2026-09-15) puede haber filas de
    // esta MISMA campana/mes con sede != NULL (trafico Volvox) que nunca
    // deben tocarse desde aqui.
    const existing = db
      .prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede IS NULL')
      .get(b.campana, b.mes);
    if (existing) {
      db.prepare(
        'UPDATE calidad_nivel_servicio SET contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?'
      ).run(b.contestadas20s, b.llamadasTotales, now, existing.id);
      const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(existing.id);
      logCalEvent(
        'NIVEL_SERVICIO_EDIT',
        '-',
        b.campana,
        req.actor,
        `${b.mes} — ${b.contestadas20s}/${b.llamadasTotales}`
      );
      return res.json(toNivelServicioRow(row));
    }
    const info = db
      .prepare(
        `INSERT INTO calidad_nivel_servicio
           (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt)
         VALUES (@campana,@mes,@contestadas20s,@llamadasTotales,@createdAt,@updatedAt)`
      )
      .run({
        campana: b.campana,
        mes: b.mes,
        contestadas20s: b.contestadas20s,
        llamadasTotales: b.llamadasTotales,
        createdAt: now,
        updatedAt: now,
      });
    const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(info.lastInsertRowid);
    logCalEvent(
      'NIVEL_SERVICIO',
      '-',
      b.campana,
      req.actor,
      `${b.mes} — ${b.contestadas20s}/${b.llamadasTotales}`
    );
    res.status(201).json(toNivelServicioRow(row));
  })
);

router.put(
  '/calidad/nivel-servicio/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateNivelServicioBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede editar el nivel de servicio' });
    }
    const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    const b = req.body;
    const contestadas20s = b.contestadas20s ?? row.contestadas20s;
    const llamadasTotales = b.llamadasTotales ?? row.llamadasTotales;
    if (contestadas20s > llamadasTotales) {
      return res.status(400).json({ error: 'Las llamadas contestadas no pueden superar el total' });
    }
    const campanaNueva = b.campana ?? row.campana;
    const mesNuevo = b.mes ?? row.mes;
    // Chequeo explicito en vez de confiar en el UNIQUE de la tabla: desde
    // la consolidacion HOSPITAL LA MARIA (2026-09-15) esa UNIQUE es
    // (campana, mes, sede), y SQL trata 2 NULL de `sede` como NO iguales
    // (nunca chocan) — esta pantalla manual siempre opera con sede=NULL,
    // asi que el duplicado hay que detectarlo a mano, no dejarselo a la
    // constraint (que ya no lo atraparia).
    const otro = db
      .prepare('SELECT id FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede IS NULL AND id != ?')
      .get(campanaNueva, mesNuevo, row.id);
    if (otro) {
      return res.status(409).json({ error: 'Ya existe un registro de nivel de servicio para esa campana y mes' });
    }
    db.prepare(
      'UPDATE calidad_nivel_servicio SET campana=?, mes=?, contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?'
    ).run(campanaNueva, mesNuevo, contestadas20s, llamadasTotales, nowStr(), row.id);
    const updated = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(row.id);
    logCalEvent('NIVEL_SERVICIO_EDIT', '-', updated.campana, req.actor, `${updated.mes}`);
    res.json(toNivelServicioRow(updated));
  })
);

router.delete(
  '/calidad/nivel-servicio/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar el nivel de servicio' });
    }
    const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    db.prepare('DELETE FROM calidad_nivel_servicio WHERE id = ?').run(row.id);
    logCalEvent('NIVEL_SERVICIO_DEL', '-', row.campana, req.actor, `${row.mes}`);
    res.json({ ok: true });
  })
);

// ── CARGA DIARIA (Fase 1 del pedido de carga real) ──────────
// Recibe filas ya parseadas en el navegador desde el export del conmutador
// (mismo patron que /dashboard/cargas: el servidor nunca parsea Excel). Por
// cada fila upsertea calidad_nivel_servicio_diario por (campana, fecha,
// skillName), y recalcula el agregado mensual de calidad_nivel_servicio a
// partir de TODAS las filas diarias de ese mes (no solo las de este
// archivo), asi que una vez que un mes tiene carga diaria, esta reemplaza
// cualquier dato manual que hubiera para ese mes.
router.post(
  '/calidad/nivel-servicio/carga-diaria',
  requireActor,
  validate(schemas.nivelServicioCargaDiariaBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede cargar el nivel de servicio' });
    }
    const b = req.body;
    const resultado = cargarNivelServicioDiario(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
      now: nowStr(),
    });
    const mensual = resultado.mensual.map(toNivelServicioRow);

    logCalEvent(
      'NIVEL_SERVICIO_CARGA_DIARIA',
      '-',
      b.campana,
      req.actor,
      `${b.filas.length} fila(s) — ${resultado.mensual.length} mes(es) recalculado(s)`
    );
    res.status(201).json({ diario: { insertadas: resultado.diario.insertadas }, mensual });
  })
);

module.exports = router;
