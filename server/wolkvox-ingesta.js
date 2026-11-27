// wolkvox-ingesta.js — validación y reemplazo del Flujo del mes que usa la consulta automática de Wolkvox
// (wolkvox-auto.js). Nació como el Plan B de Wolkvox, fase B1 (17/11/2026): un agente en un PC de la oficina
// ENVIABA el Flujo a POST /api/wolkvox/agente/flujo, solo para la réplica «MOBILIZE PRUEBAS API».
// Fase W10 (26/11/2026, pedido del usuario): la réplica se borró y con ella esa entrada (la ruta ya no existe);
// aquí quedan solo las funciones que usa el programador. Escribe directo en calidad_nivel_servicio_diario,
// SIN tocar el mapeo de skills.
'use strict';

const { cargarNivelServicioDiario } = require('./nivel-servicio-diario');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

const MAX_FILAS = 5000;

const { CAMPANAS_PERMITIDAS } = require('./wolkvox-destinos');
const REPORTES_INGESTA = ['flujo'];

function ultimoDiaDelMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return mes + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
}

// Reemplaza el MES COMPLETO de la campaña con las filas recibidas (todas de ese mes, ya validadas).
// Fase A1 (18/11): `archivoNombre` dice de donde vino (agente o consulta automatica) y
// `conservar` lista campos que la API no trae (AHT y espera): para cada dia y skill, si la fila
// nueva no lo trae, se copia el valor que ya estaba (el del archivo manual) en vez de dejarlo vacio.
const CONSERVABLES = ['ahtSegundos', 'waitTimeSegundos'];
// Fase A24 (20/11): `campana` solo puede ser una de la lista cerrada de wolkvox-destinos.js.
// Fase W10: es obligatoria (antes, sin ella, era la réplica de MOBILIZE, que se borró).
function reemplazarMesFlujo(db, { mes, filas, cargadoPorNombre, archivoNombre, conservar, campana }) {
  const campanaDestino = campana;
  if (!CAMPANAS_PERMITIDAS.includes(campanaDestino)) throw new Error('Campaña no permitida para Wolkvox');
  const desde = mes + '-01', hasta = ultimoDiaDelMes(mes);
  let borradasMes = 0, resultado, conservados = 0;
  db.transaction(() => {
    // Respaldo del mes completo ANTES de borrar (Deshacer 30 dias del Centro de cargas).
    respaldarAntesDeCambiar(db, 'calidad_nivel_servicio_diario', { campana: campanaDestino, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    const campos = Array.isArray(conservar) ? conservar.filter((c) => CONSERVABLES.includes(c)) : [];
    if (campos.length) {
      const previas = new Map();
      for (const r of db.prepare('SELECT fecha, skillName, ahtSegundos, waitTimeSegundos FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha BETWEEN ? AND ?').all(campanaDestino, desde, hasta)) {
        previas.set(r.fecha + '|' + r.skillName, r);
      }
      filas = filas.map((f) => {
        const p = previas.get(f.fecha + '|' + f.skillName);
        if (!p) return f;
        const g = { ...f };
        for (const c of campos) if (g[c] === undefined && p[c] !== null && p[c] !== undefined) { g[c] = p[c]; conservados++; }
        return g;
      });
    }
    // Lo que no venga en este envío (otra skill, otro día del mes) también sale: el mes queda igual a lo enviado.
    borradasMes = db.prepare('DELETE FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha BETWEEN ? AND ?').run(campanaDestino, desde, hasta).changes;
    resultado = cargarNivelServicioDiario(db, { campana: campanaDestino, sede: null, archivoNombre: archivoNombre || 'API Wolkvox', cargadoPorNombre, filas });
  })();
  return { mes, filas: filas.length, skills: new Set(filas.map((f) => f.skillName)).size, reemplazadas: borradasMes, insertadas: resultado.diario.insertadas, conservados };
}

// Fase A4: + nivel de servicio a 10 s y 30 s (se guardan; la pestaña de Flujo solo muestra 20 s, Fase 68).
const CAMPOS_NUM = ['totalLlamadas', 'contestadas', 'llamadasAbandonadas', 'serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'abandonPct', 'asaSegundos', 'ataSegundos', 'ahtSegundos', 'waitTimeSegundos'];
const OBLIGATORIOS = ['totalLlamadas', 'contestadas'];
const PCT = ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'abandonPct'];

function fechaValida(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

// Valida el cuerpo completo; devuelve { error } o { mes, filas } (solo campos conocidos).
function validarCuerpo(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'Cuerpo invalido' };
  if (!REPORTES_INGESTA.includes(b.reporte)) return { error: 'Reporte no permitido' };
  const mes = String(b.mes || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { error: 'Mes invalido (AAAA-MM)' };
  if (!Array.isArray(b.filas) || !b.filas.length) return { error: 'Sin filas' };
  if (b.filas.length > MAX_FILAS) return { error: 'Demasiadas filas' };
  const vistas = new Set();
  const filas = [];
  for (let i = 0; i < b.filas.length; i++) {
    const f = b.filas[i] || {};
    const fecha = String(f.fecha || '');
    if (!fechaValida(fecha) || fecha.slice(0, 7) !== mes) return { error: `Fila ${i + 1}: fecha fuera del mes` };
    const skillName = typeof f.skillName === 'string' ? f.skillName.trim() : '';
    if (!skillName || skillName.length > 120) return { error: `Fila ${i + 1}: skill invalida` };
    const clave = fecha + '|' + skillName;
    if (vistas.has(clave)) return { error: `Fila ${i + 1}: dia y skill repetidos` };
    vistas.add(clave);
    const fila = { fecha, skillName };
    for (const c of CAMPOS_NUM) {
      const v = f[c];
      if (v === undefined || v === null) {
        if (OBLIGATORIOS.includes(c)) return { error: `Fila ${i + 1}: falta ${c}` };
        continue;
      }
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (PCT.includes(c) && v > 100)) return { error: `Fila ${i + 1}: ${c} invalido` };
      fila[c] = v;
    }
    if (fila.contestadas > fila.totalLlamadas) return { error: `Fila ${i + 1}: contestadas mayor que el total` };
    filas.push(fila);
  }
  return { mes, filas };
}

module.exports = { validarCuerpo, REPORTES_INGESTA, ultimoDiaDelMes, reemplazarMesFlujo };
