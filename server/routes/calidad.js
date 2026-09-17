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
const { requireActor, isFullAdmin, campaignAccess, canEvaluateCampaign, canManageMonitoreos } = require('../auth');
const { validate, schemas } = require('../validation');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Los datos de Calidad cambian con cada monitoreo/meta: nunca cachear las
// respuestas (evita 304 con cuerpo viejo tras un POST).
router.use(['/monitoreos', '/metas', '/calidad'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ── Helpers del modulo de Calidad ────────────────────────────
function getPlantillaRow(campana) {
  return db
    .prepare('SELECT * FROM calidad_plantillas WHERE campana = ? AND activo = 1')
    .get(campana);
}

function toPlantilla(row) {
  return {
    campana: row.campana,
    engine: row.engine,
    items: JSON.parse(row.items || '[]'),
    updatedAt: row.updatedAt,
  };
}

function toMonitoreo(row) {
  return {
    id: row.id,
    campana: row.campana,
    asesor: row.asesor,
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

// ══════════════════════════════════════════════════════════
// CALIDAD — PLANTILLAS (formato de evaluacion por campana)
// ══════════════════════════════════════════════════════════
router.get(
  '/calidad/plantillas',
  requireActor,
  wrap((req, res) => {
    const rows = db
      .prepare('SELECT * FROM calidad_plantillas WHERE activo = 1 ORDER BY campana')
      .all();
    res.json(rows.map(toPlantilla));
  })
);

// ══════════════════════════════════════════════════════════
// CALIDAD — MONITOREOS
// ══════════════════════════════════════════════════════════

// Los monitoreos del asesor logueado (portal ASESOR). Empareja por nombre,
// igual que el dropdown de asesores del formulario. Antes de /:id.
router.get(
  '/monitoreos/mios',
  requireActor,
  wrap((req, res) => {
    const nombre = (req.actor.nombre || '').trim().toLowerCase();
    if (!nombre) return res.json([]);
    const rows = db
      .prepare(
        "SELECT * FROM monitoreos WHERE lower(trim(asesor)) = ? ORDER BY fecha DESC, id DESC"
      )
      .all(nombre);
    res.json(rows.map(toMonitoreo));
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
    res.json(rows.map(toMonitoreo));
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
    const plantillaRow = getPlantillaRow(b.campana);
    if (!plantillaRow) {
      return res.status(400).json({ error: 'Esa campana no tiene plantilla de calificacion' });
    }
    const plantilla = toPlantilla(plantillaRow);
    const score = calc.computeScore(plantilla.items, b.answers, plantilla.engine);
    if (score.puntaje === null) {
      return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
    }
    const now = nowStr();
    const evaluador = b.evaluador || req.actor.nombre;
    const info = db
      .prepare(
        `INSERT INTO monitoreos
           (campana, asesor, fecha, mes, canal, idLlamada, telefono, codificacion,
            evaluador, evaluadorUserId, answers, puntaje, clasificacion, fallos,
            nivelCritico, observaciones, createdAt)
         VALUES (@campana,@asesor,@fecha,@mes,@canal,@idLlamada,@telefono,@codificacion,
                 @evaluador,@evaluadorUserId,@answers,@puntaje,@clasificacion,@fallos,
                 @nivelCritico,@observaciones,@createdAt)`
      )
      .run({
        campana: b.campana,
        asesor: b.asesor,
        fecha: b.fecha,
        mes: calc.monthKey(b.fecha),
        canal: b.canal,
        idLlamada: b.idLlamada || null,
        telefono: b.telefono || null,
        codificacion: b.codificacion || null,
        evaluador,
        evaluadorUserId: req.actor.isMasterAdmin ? null : req.actor.id,
        answers: JSON.stringify(b.answers),
        puntaje: score.puntaje,
        clasificacion: score.clasificacion,
        fallos: score.fallos,
        nivelCritico: score.nivelCritico,
        observaciones: b.observaciones || null,
        createdAt: now,
      });
    const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(info.lastInsertRowid);
    logCalEvent('MONITOREO', b.asesor, b.campana, req.actor, `Puntaje: ${score.puntaje}`);
    res.status(201).json(toMonitoreo(row));
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
    tx(b.filas);

    logCalEvent(
      'MONITOREO_BULK',
      b.campana,
      b.campana,
      req.actor,
      `Carga masiva "${b.archivoNombre || 'sin nombre'}": ${insertadas} nueva(s), ${actualizadas} actualizada(s), ${omitidas} omitida(s)`
    );
    res.status(201).json({ insertadas, actualizadas, omitidas, avisos });
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
    if (!canManageMonitoreos(req.actor, row.campana)) {
      return res
        .status(403)
        .json({ error: 'Solo el rol Reportes o el Administrador pueden editar un monitoreo guardado' });
    }
    const b = req.body;
    const plantilla = toPlantilla(getPlantillaRow(row.campana));
    const answers = b.answers || JSON.parse(row.answers || '{}');
    const score = calc.computeScore(plantilla.items, answers, plantilla.engine);
    if (score.puntaje === null) {
      return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
    }
    const fecha = b.fecha || row.fecha;
    db.prepare(
      `UPDATE monitoreos SET
         asesor=?, fecha=?, mes=?, canal=?, idLlamada=?, telefono=?, codificacion=?,
         evaluador=?, answers=?, puntaje=?, clasificacion=?, fallos=?, nivelCritico=?,
         observaciones=?, updatedAt=?
       WHERE id=?`
    ).run(
      b.asesor ?? row.asesor,
      fecha,
      calc.monthKey(fecha),
      b.canal ?? row.canal,
      (b.idLlamada ?? row.idLlamada) || null,
      (b.telefono ?? row.telefono) || null,
      (b.codificacion ?? row.codificacion) || null,
      b.evaluador ?? row.evaluador,
      JSON.stringify(answers),
      score.puntaje,
      score.clasificacion,
      score.fallos,
      score.nivelCritico,
      (b.observaciones ?? row.observaciones) || null,
      nowStr(),
      row.id
    );
    const updated = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(row.id);
    logCalEvent('MONITOREO_EDIT', updated.asesor, row.campana, req.actor, `Puntaje: ${score.puntaje}`);
    res.json(toMonitoreo(updated));
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
// CALIDAD — CRONOGRAMA Y METAS
// ══════════════════════════════════════════════════════════

// Cumplimiento individual por lider (calculo reproducible en servidor). Antes de /:id.
router.get(
  '/metas/cumplimiento',
  requireActor,
  validate(schemas.calidadQuery, 'query'),
  wrap((req, res) => {
    const { campana } = req.query;
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
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
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);
    if (req.actor.isMasterAdmin) return res.json({ campana, mes, meta: null });
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
