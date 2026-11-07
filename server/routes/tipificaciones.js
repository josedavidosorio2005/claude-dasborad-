// routes/tipificaciones.js — Tipificacion de ORLANT (Fase 77, pedido de
// Edwin/Jairo). Mismo patron que routes/agendas.js: el servidor NUNCA abre
// el Excel, solo recibe filas ya parseadas desde el navegador, y el
// dashboard NUNCA descarga filas crudas -- todos los GET de lectura
// devuelven agregados ya calculados en SQL (tipificaciones.js), nunca la
// tabla completa (~15.000 filas/mes solo Llamadas).
//
// Montado bajo '/calidad/tipificacion' para heredar el middleware de
// no-cache de '/calidad' (mismo motivo que routes/agendas.js) -- se monta
// en server.js despues de routes/agendas. El limite de tamano de body mas
// grande para /carga y /carga/impacto vive en server.js (Fase 77, Fase 122,
// ver RUTAS_LIMITE_MAYOR), no aqui.
const express = require('express');
const db = require('../db');
// Fase 158: cache de /opciones (ver cache-opciones.js).
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule, isFullAdmin } = require('../auth');
const { listarSkillsWhatsapp, guardarSkillsWhatsapp } = require('../skills-whatsapp');
const { validate, schemas } = require('../validation');
const {
  impactoTipificaciones,
  cargarTipificaciones,
  tipificacionesPorTipo,
  tipificacionesResumenSalida,
  tipificacionesOpciones,
  tipificacionesMeses,
  usaClasificacionAsesores,
} = require('../tipificaciones');
const { tipificacionTotales } = require('../tipificacion-totales');
const { listarClasificacion, guardarClasificacion, salidaPorLinea } = require('../clasificacion-asesores');
// Fase 287 (revision del 07/11, #5): el cliente que oculta nombres (Aurora, HLM) no
// recibe la lista de agentes ni puede filtrar por un agente (?agente= se ignora).
const { ocultaAsesores } = require('../privacidad-cliente');
function filtrosPara(req) { return ocultaAsesores(db, req.actor, req.query.campana) ? { ...req.query, agente: undefined } : req.query; }
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Valores distintos para los filtros (Agente, Skill) + si hay datos
// (meses.length) para ESTE canal -- lo usa el panel para pintar los
// desplegables y para el mensaje "Sin datos de X cargados para este
// periodo" cuando un canal esta vacio.
router.get(
  '/calidad/tipificacion/opciones',
  requireActor,
  validate(schemas.tipificacionOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const op = opcionesConCache(db, JSON.stringify(['tipificacion', req.query.campana, req.query.canal]), () => tipificacionesOpciones(db, req.query.campana, req.query.canal));
    res.json(ocultaAsesores(db, req.actor, req.query.campana) ? { ...op, agentes: [] } : op);
  })
);

// Fase 267: solo los meses con datos de cada canal -- lo que necesita el
// tablero al abrirse (destapar la pestaña y armar MESES), sin calcular los
// agentes ni los skills de todo el historial.
router.get(
  '/calidad/tipificacion/meses',
  requireActor,
  validate(schemas.tipificacionMesesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(opcionesConCache(db, JSON.stringify(['tipificacion-meses', req.query.campana]), () => tipificacionesMeses(db, req.query.campana)));
  })
);

// Fase 267: todo lo que dibuja una mitad (torta, tarjetas de salida y de
// linea) en un solo pedido, con las mismas cifras (ver tipificacion-totales.js).
router.get(
  '/calidad/tipificacion/totales',
  requireActor,
  validate(schemas.tipificacionTotalesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(tipificacionTotales(db, filtrosPara(req)));
  })
);

// Grafica: conteo por tipificacion, ya agrupado top10+Otras (respeta todos
// los filtros: mes/rango + agente/skill).
router.get(
  '/calidad/tipificacion/por-tipo',
  requireActor,
  validate(schemas.tipificacionFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(tipificacionesPorTipo(db, filtrosPara(req)));
  })
);

// Fase 131, Parte 3 (Mobilize): tarjetas de SALIDA (total/conectadas/no
// conectadas de llamadas salientes) -- mismos filtros de mes/rango/
// agente/skill que /por-tipo, canal siempre LLAMADAS, siempre sobre
// tipoInteraccion='outbound_ma' (nunca el filtro Entrante/Saliente del
// panel, que es independiente).
router.get(
  '/calidad/tipificacion/resumen-salida',
  requireActor,
  validate(schemas.tipificacionSalidaResumenQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(tipificacionesResumenSalida(db, filtrosPara(req)));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada): cuenta cuantas
// filas de ESTE canal ya existen en el rango [primera..ultima fecha] del
// archivo que se esta por subir.
router.post(
  '/calidad/tipificacion/carga/impacto',
  requireActor,
  validate(schemas.tipificacionCargaBody),
  wrap((req, res) => {
    if (!canLoadModule(req.actor, 'tipificacion')) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoTipificaciones(db, { campana: b.campana, canal: b.canal, filas: b.filas }));
  })
);

router.post(
  '/calidad/tipificacion/carga',
  requireActor,
  validate(schemas.tipificacionCargaBody),
  wrap((req, res) => {
    if (!canLoadModule(req.actor, 'tipificacion')) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir tipificacion' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarTipificaciones(db, {
      campana: b.campana,
      canal: b.canal,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'TIPIFICACION_CARGA',
      { nombre: `${resultado.insertadas} fila(s) (${b.canal})`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

// Fase 168: mapa codigo -> nombre de los skills de WhatsApp del cliente. Lo
// lee quien puede cargar Tipificacion (el navegador lo usa para leer el
// HistChat por SKILL_ID); solo un administrador lo cambia (Cargar Datos).
router.get(
  '/calidad/tipificacion/skills-whatsapp',
  requireActor,
  validate(schemas.skillsWhatsappQuery, 'query'),
  wrap((req, res) => {
    if (!canLoadModule(req.actor, 'tipificacion')) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos de Tipificación' });
    }
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json({ campana: req.query.campana, skills: listarSkillsWhatsapp(db, req.query.campana) });
  })
);

router.put(
  '/calidad/tipificacion/skills-whatsapp',
  requireActor,
  validate(schemas.skillsWhatsappBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo un administrador puede cambiar los skills de WhatsApp' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const skills = guardarSkillsWhatsapp(db, b.campana, b.skills);
    logEvent('SKILLS_WHATSAPP_GUARDAR', { nombre: b.campana, user: '-', rol: 'tipificacion' }, actorLabel(req.actor),
      skills.length + ' skill(s) de WhatsApp: ' + skills.map((s) => s.codigo + ' ' + s.nombre).join(', '));
    res.json({ campana: b.campana, skills });
  })
);

// Fase 186 (solo ORLANT): salida del canal repartida en General / 3P / Sin
// clasificar, por la clasificacion del asesor. Lo ve quien ve la campana.
router.get(
  '/calidad/tipificacion/salida-por-linea',
  requireActor,
  validate(schemas.tipificacionFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    if (!usaClasificacionAsesores(req.query.campana)) {
      return res.status(404).json({ error: 'Este cliente no usa la clasificación de asesores' });
    }
    res.json(salidaPorLinea(db, req.query));
  })
);

// Fase 186: lista de asesores (de los CDR cargados) con su linea. Solo el
// administrador la ve y la cambia; los usuarios del cliente ven el resultado.
router.get(
  '/calidad/tipificacion/clasificacion-asesores',
  requireActor,
  validate(schemas.clasificacionAsesoresQuery, 'query'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo un administrador puede ver la clasificación de asesores' });
    }
    if (!usaClasificacionAsesores(req.query.campana)) {
      return res.status(404).json({ error: 'Este cliente no usa la clasificación de asesores' });
    }
    res.json({ campana: req.query.campana, asesores: listarClasificacion(db, req.query.campana) });
  })
);

router.put(
  '/calidad/tipificacion/clasificacion-asesores',
  requireActor,
  validate(schemas.clasificacionAsesoresBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo un administrador puede cambiar la clasificación de asesores' });
    }
    const b = req.body;
    if (!usaClasificacionAsesores(b.campana)) {
      return res.status(404).json({ error: 'Este cliente no usa la clasificación de asesores' });
    }
    const r = guardarClasificacion(db, { campana: b.campana, asignaciones: b.asignaciones, guardadoPorNombre: actorLabel(req.actor) });
    logEvent('CLASIFICACION_ASESORES', { nombre: b.campana, user: '-', rol: 'tipificacion' }, actorLabel(req.actor),
      r.general + ' asesor(es) en Línea General, ' + r.p3 + ' en Línea 3P, ' + r.sinClasificar + ' sin clasificar');
    res.json({ ...r, asesores: listarClasificacion(db, b.campana) });
  })
);

module.exports = router;
