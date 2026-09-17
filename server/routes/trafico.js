// routes/trafico.js — Trafico de llamadas (export real de Volvox, hoja
// DATA). Extraido de server.js (Radiografia InConexion, #3): solo se movio
// el cableado HTTP, sin tocar ninguna regla de negocio.
//
// Nota de orden de montaje: en server.js este router se monta DESPUES del
// de calidad (routes/calidad.js), porque ese router tiene un middleware de
// no-cache con el prefijo '/calidad' que TAMBIEN debe aplicar a las rutas
// /calidad/trafico/* de aqui — igual que en el server.js monolitico
// original, donde ese middleware (definido antes, junto a Calidad) ya
// cubria estas rutas de Trafico definidas mas abajo en el mismo archivo.
//
// Nota de rutas de archivo: PLANTILLA_TRAFICO_PATH usaba `__dirname` desde
// server/ (server/plantillas/...). Movido a server/routes/, asi que ahora
// sube un nivel mas (`..`) para seguir apuntando al mismo archivo real.
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const traficoSkills = require('../trafico-skills');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Puntos 11/12 del pedido de Edwin: cargar/eliminar/actualizar bases (y
// ver el control de cargas de mas abajo) SOLO desde la seccion
// administrativa, nunca accesible a un usuario normal de dashboard.
// Decision explicita (auditoria 2026-09-15): se usa canLoadData(), el
// MISMO permiso "Cargar Datos" que ya gobierna el resto de esta seccion
// (dashboard_cargas, nivel de servicio manual) — no isFullAdmin() a
// secas, que hubiera excluido a un AUX_ADMIN con ese permiso otorgado
// explicitamente por un administrador (el escenario que Edwin describe:
// "Admin/AUX_ADMIN o el rol equivalente de supervisor"). Sigue siendo
// imposible para cualquier rol CLIENTES_DASH/CALIDAD/SUPERVISOR sin ese
// permiso otorgado a mano.
function toTraficoDiarioRow(row) {
  return {
    fecha: row.fecha,
    skillName: row.skillName,
    campana: row.campana,
    sede: row.sede,
    totalLlamadas: row.totalLlamadas,
    contestadas: row.contestadas,
    llamadasAbandonadas: row.llamadasAbandonadas,
    serviceLevel10secPct: row.serviceLevel10secPct,
    serviceLevel20secPct: row.serviceLevel20secPct,
    serviceLevel30secPct: row.serviceLevel30secPct,
    abandonPct: row.abandonPct,
    nivelAtencionPct: row.nivelAtencionPct,
    tasaAbandonoPct: row.tasaAbandonoPct,
    asaSegundos: row.asaSegundos,
    ataSegundos: row.ataSegundos,
    ahtSegundos: row.ahtSegundos,
    waitTimeSegundos: row.waitTimeSegundos,
  };
}

// Plantilla oficial de Tráfico (una sola, para todas las campañas — la
// campaña de cada fila la decide el mapeo de skill, no la plantilla).
// Sirve el ARCHIVO REAL guardado en server/plantillas/ tal cual, nunca lo
// regenera con código: así la copia publicada nunca se desvía de la que
// ya se le mandó al cliente para revisión. Vive FUERA de public/ (que se
// sirve estático sin autenticación) — este endpoint exige canLoadData,
// igual que cargar la base, para que no sea descargable por un usuario
// de solo visualización ni de forma anónima.
const PLANTILLA_TRAFICO_PATH = path.join(__dirname, '..', 'plantillas', 'PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx');
router.get(
  '/calidad/trafico/plantilla',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para descargar la plantilla' });
    }
    res.download(PLANTILLA_TRAFICO_PATH, 'PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'No se pudo leer la plantilla en el servidor' });
      }
    });
  })
);

// Filas diarias crudas para la grafica de Trafico (el filtrado/agregado
// por skill, rango de fechas y granularidad lo hace el navegador —
// public/js/trafico-logic.js — asi que aqui se devuelve todo lo que haya
// para la campana, sin recortar).
router.get(
  '/calidad/nivel-servicio/diario',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (!campana) return res.status(400).json({ error: 'Indica una campana' });
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const rows = db
      .prepare('SELECT * FROM calidad_nivel_servicio_diario WHERE campana = ? ORDER BY fecha, skillName')
      .all(campana);
    res.json(rows.map(toTraficoDiarioRow));
  })
);

// Sube el export de Volvox ya parseado en el navegador (mismo patron que
// /dashboard/cargas y la carga diaria de arriba: el servidor NUNCA abre el
// Excel). A diferencia de esa carga clasica, aqui NO se manda `campana`:
// un mismo archivo trae varias skills que pueden ser de campanas
// distintas, y cada una se resuelve por su mapeo (trafico-skills.js). Una
// skill nueva se guarda igual, bajo "(SIN ASIGNAR)", sin romper la carga.
router.post(
  '/calidad/trafico/carga',
  requireActor,
  validate(schemas.traficoCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir trafico de llamadas' });
    }
    const b = req.body;
    const resultado = traficoSkills.cargarTrafico(db, {
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'TRAFICO_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: resultado.campanas.join(', ') },
      actorLabel(req.actor),
      resultado.skillsSinAsignar.length
        ? `${resultado.skillsSinAsignar.length} skill(s) sin asignar: ${resultado.skillsSinAsignar.join(', ')}`
        : ''
    );
    res.status(201).json(resultado);
  })
);

// Mapeo SKILL_NAME -> campana/cliente, administrable desde el panel.
router.get(
  '/calidad/trafico/skills',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para ver el mapeo de skills' });
    }
    res.json(traficoSkills.listarSkills(db));
  })
);

router.put(
  '/calidad/trafico/skills/:skillName',
  requireActor,
  validate(schemas.traficoSkillMapeoBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para editar el mapeo de skills' });
    }
    const skillName = req.params.skillName;
    const resultado = traficoSkills.remapearSkill(db, { skillName, campana: req.body.campana, sede: req.body.sede || null });
    logEvent(
      'TRAFICO_SKILL_MAPEO',
      { nombre: skillName, user: '-', rol: req.body.campana || '(sin asignar)' },
      actorLabel(req.actor),
      `${resultado.movidas} fila(s) reatribuidas, ${resultado.mesesRecalculados.length} mes(es) recalculado(s)`
    );
    res.json({ ok: true, ...resultado });
  })
);

// ── Control de cargas por periodo (punto 11/12 + seccion 3 del pedido de
// Edwin) — solo administrativo, nunca visible para un dashboard normal.
// Cobertura: reutiliza las fechas YA guardadas en calidad_nivel_servicio_diario
// (nunca una tabla de "estado" aparte que haya que mantener sincronizada a
// mano) para armar, por skill, que meses ya tienen base cargada.
router.get(
  '/calidad/trafico/cobertura',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para ver el control de cargas' });
    }
    const filas = db
      .prepare(
        `SELECT skillName, campana, sede, substr(fecha,1,7) AS mes, COUNT(*) AS filas,
                MAX(archivoNombre) AS archivoNombre, MAX(cargadoPorNombre) AS cargadoPorNombre
         FROM calidad_nivel_servicio_diario
         GROUP BY skillName, campana, sede, mes
         ORDER BY skillName, mes`
      )
      .all();
    const porSkill = new Map();
    filas.forEach((f) => {
      if (!porSkill.has(f.skillName)) {
        porSkill.set(f.skillName, { skillName: f.skillName, campana: f.campana, sede: f.sede, meses: [] });
      }
      porSkill.get(f.skillName).meses.push({
        mes: f.mes,
        filas: f.filas,
        archivoNombre: f.archivoNombre,
        cargadoPorNombre: f.cargadoPorNombre,
      });
    });
    res.json([...porSkill.values()]);
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada): cuenta, por
// (skillName, mes) presentes en el archivo ya parseado en el navegador,
// cuantas filas YA EXISTEN hoy y se reemplazarian. El frontend usa esto
// para pedir confirmacion explicita antes de sobrescribir un mes ya
// cargado ("esto va a reemplazar N registros de [mes] de [skill]").
router.post(
  '/calidad/trafico/carga/impacto',
  requireActor,
  validate(schemas.traficoCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const pares = new Map(); // "skill|mes" -> { skillName, mes, filasNuevas }
    req.body.filas.forEach((f) => {
      const mes = f.fecha.slice(0, 7);
      const clave = f.skillName + '|' + mes;
      if (!pares.has(clave)) pares.set(clave, { skillName: f.skillName, mes, filasNuevas: 0 });
      pares.get(clave).filasNuevas++;
    });
    const stmt = db.prepare(
      'SELECT COUNT(*) AS n FROM calidad_nivel_servicio_diario WHERE skillName = ? AND substr(fecha,1,7) = ?'
    );
    const resultado = [...pares.values()].map((p) => ({
      ...p,
      filasExistentes: stmt.get(p.skillName, p.mes).n,
    }));
    res.json(resultado);
  })
);

module.exports = router;
