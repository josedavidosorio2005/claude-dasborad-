// activos-panel.js — Fase GH5 (pedido del usuario, 23/11/2026): «Panel general» del Inventario igual al
// diseño de Edwin (docs/gestion-humana/Plataforma_InConexion.html, leído solo por su estructura).
// Solo lectura: arma, del inventario abierto (y opcionalmente de un solo tipo, los chips «Ver gráficas
// de»), lo que dibujan sus tarjetas y gráficas. No cambia nada de activos.js ni de lo guardado.
'use strict';
const A = require('./activos');
const ACT = require('./activos-actas');

const ESTADOS = A.ESTADO_CODIGOS; // libre, en_uso, en_reparacion, malo, de_baja
const vacioEstados = () => Object.fromEntries(ESTADOS.map((e) => [e, 0]));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const PROPIO = /inconexi[oó]n/i; // propietario InConexion (o sin propietario) = propio; otro = proveedor (rentado)
const esPropio = (p) => !String(p || '').trim() || PROPIO.test(String(p));
// Auditoría 24/11: el mes en hora de Colombia (UTC−5, sin horario de verano), no la del servidor (UTC):
// antes, lo hecho después de las 7 p. m. del último día del mes caía en el mes siguiente.
const COL_MS = 5 * 3600 * 1000;
const mesDe = (d) => { const x = new Date(new Date(d).getTime() - COL_MS); return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0'); };

// Agrupa por una clave y cuenta por estado; ordena de mayor a menor (el «sin …» va al final).
function porClave(filas, clave, sinTxt) {
  const m = new Map();
  for (const f of filas) {
    const k = String(f[clave] || '').trim() || sinTxt;
    if (!m.has(k)) m.set(k, vacioEstados());
    m.get(k)[f.estado] += 1;
  }
  return [...m.entries()].map(([nombre, est]) => ({ nombre, sin: nombre === sinTxt, total: ESTADOS.reduce((a, e) => a + est[e], 0), porEstado: est }))
    .sort((a, b) => (a.sin - b.sin) || (b.total - a.total) || a.nombre.localeCompare(b.nombre, 'es'));
}

function panel(db, ambito, tipoSel, ahora) {
  const amb = A.ambitoDe(ambito);
  const tiposAmb = A.tipos(db, { todos: true, ambito: amb });
  const tipo = tiposAmb.some((t) => t.codigo === tipoSel) ? tipoSel : '';
  const codigos = tipo ? [tipo] : tiposAmb.map((t) => t.codigo);
  const ph = codigos.map(() => '?').join(',') || "''";
  const filas = db.prepare('SELECT id, tipo, codigo, estado, sede, operacion, proveedor, marca, datos FROM activos WHERE tipo IN (' + ph + ')').all(...codigos)
    .map((f) => { let d = {}; try { d = JSON.parse(f.datos || '{}') || {}; } catch (e) { d = {}; } return Object.assign(f, { d }); });
  const vivos = filas.filter((f) => f.estado !== 'de_baja');

  const porEstado = vacioEstados();
  filas.forEach((f) => { porEstado[f.estado] += 1; });
  const porTipo = tiposAmb.filter((t) => codigos.includes(t.codigo)).map((t) => {
    const est = vacioEstados(); filas.filter((f) => f.tipo === t.codigo).forEach((f) => { est[f.estado] += 1; });
    return { codigo: t.codigo, nombre: t.plural || t.nombre, total: ESTADOS.reduce((a, e) => a + est[e], 0), porEstado: est };
  }).filter((t) => t.total > 0);

  // Rendimiento por RAM: solo tipos que llevan RAM, sin los dados de baja.
  const conRam = new Set(tiposAmb.filter((t) => t.campos.some((c) => c.k === 'ram_gb')).map((t) => t.codigo));
  const ram = vivos.filter((f) => conRam.has(f.tipo));
  const porRendimiento = Object.fromEntries(A.RENDIMIENTOS.map((r) => [r.codigo, 0]));
  ram.forEach((f) => { porRendimiento[A.rendimientoDe(f.d.ram_gb)] += 1; });

  // Marcas más comunes (todos los estados, como el diseño).
  const marcas = new Map();
  filas.forEach((f) => { const k = String(f.marca || '').trim().toUpperCase() || 'Sin dato'; marcas.set(k, (marcas.get(k) || 0) + 1); });

  // Valor (precio de compra de los propios, sin los dados de baja) y renta mensual (de proveedores).
  const valor = porTipo.map((t) => ({ codigo: t.codigo, nombre: t.nombre, valor: 0 }));
  let sinPrecio = 0;
  const renta = new Map();
  for (const f of vivos) {
    if (esPropio(f.proveedor)) {
      const p = num(f.d.precio);
      if (!p) sinPrecio += 1;
      const v = valor.find((x) => x.codigo === f.tipo); if (v) v.valor += p;
    } else if (num(f.d.renta_mensual)) {
      const k = String(f.proveedor).trim();
      const r = renta.get(k) || { proveedor: k, valor: 0, n: 0 }; r.valor += num(f.d.renta_mensual); r.n += 1; renta.set(k, r);
    }
  }

  // Calidad de los datos (sin los dados de baja).
  const repetidos = (campo) => { const m = new Map(); vivos.forEach((f) => { const k = String(f[campo] || '').trim().toUpperCase(); if (k) m.set(f.tipo + '|' + k, (m.get(f.tipo + '|' + k) || 0) + 1); }); return [...m.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0); };
  const agentes = db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN TRIM(COALESCE(nombre,'')) = '' OR TRIM(COALESCE(documento,'')) = '' THEN 1 ELSE 0 END) incompletos FROM activos_agentes WHERE activo = 1").get();
  const conEquipo = db.prepare('SELECT COUNT(DISTINCT s.agenteId) n FROM activos_asignaciones s JOIN activos_agentes g ON g.id = s.agenteId WHERE s.hasta IS NULL AND g.activo = 1').get().n;
  const actas = amb === 'sistemas' ? ACT.resumen(db) : null;
  const calidad = [
    { k: 'sin_sede', l: 'Sin sede', n: vivos.filter((f) => !String(f.sede || '').trim()).length, filtro: { sede: '__none' } },
    { k: 'sin_operacion', l: 'Sin operación', n: vivos.filter((f) => !String(f.operacion || '').trim()).length, filtro: { operacion: '__none' } },
    { k: 'codigos_repetidos', l: 'Códigos repetidos', n: repetidos('codigo') },
    { k: 'sin_marca', l: 'Sin marca registrada', n: vivos.filter((f) => !String(f.marca || '').trim()).length },
  ];
  if (!tipo) calidad.push({ k: 'agentes_incompletos', l: 'Agentes sin nombre o sin documento', n: agentes.incompletos || 0, ir: 'agentes' });
  if (actas && !tipo) calidad.push({ k: 'actas_pendientes', l: 'Actas pendientes por completar o firmar', n: actas.pendientes + actas.porCompletar, ir: 'actas' }, { k: 'actas_atrasadas', l: 'Actas atrasadas (' + ACT.DIAS_ATRASO + '+ días hábiles)', n: actas.atrasadas, ir: 'actas' });

  // Movimientos de los últimos 6 meses (del historial del inventario, de los elementos de este panel).
  const hoy = new Date((ahora ? new Date(ahora) : new Date()).getTime() - COL_MS); // reloj de Colombia en campos UTC
  const inicioMes = (i) => Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1) + COL_MS; // 00:00 de Colombia
  const meses = [];
  for (let i = 5; i >= 0; i--) meses.push({ mes: mesDe(inicioMes(i)), ingresos: 0, asignaciones: 0, devoluciones: 0, danos: 0 });
  const ids = new Set(filas.map((f) => f.id));
  const desde = inicioMes(5);
  for (const h of db.prepare('SELECT activoId, ts, accion, estadoAntes, estadoDespues FROM activos_historial WHERE ts >= ?').all(desde)) {
    if (!ids.has(h.activoId)) continue;
    const m = meses.find((x) => x.mes === mesDe(Number(h.ts))); if (!m) continue;
    if (h.accion === 'Ingreso') m.ingresos += 1;
    else if (h.estadoDespues === 'en_uso') m.asignaciones += 1;
    else if (h.estadoAntes === 'en_uso' && h.estadoDespues === 'libre') m.devoluciones += 1;
    else if (h.estadoDespues === 'en_reparacion' || h.estadoDespues === 'malo') m.danos += 1;
  }

  return {
    ambito: amb, tipo, tipos: tiposAmb.map((t) => ({ codigo: t.codigo, nombre: t.plural || t.nombre })),
    total: filas.length, porEstado, porTipo, porRendimiento: conRam.size && (!tipo || conRam.has(tipo)) ? porRendimiento : null,
    porSede: porClave(vivos, 'sede', 'Sin sede'), porOperacion: porClave(vivos, 'operacion', 'Sin operación'),
    marcas: [...marcas.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n).slice(0, 8),
    valor: { porTipo: valor, total: valor.reduce((a, v) => a + v.valor, 0), sinPrecio },
    renta: { porProveedor: [...renta.values()].sort((a, b) => b.valor - a.valor), total: [...renta.values()].reduce((a, r) => a + r.valor, 0), n: [...renta.values()].reduce((a, r) => a + r.n, 0) },
    agentes: { activos: agentes.total || 0, conEquipo }, actasPendientes: actas ? actas.pendientes + actas.porCompletar : null, // Fase INV4: por completar o firmar, como Edwin
    calidad, movimientos: meses,
  };
}

module.exports = { panel, esPropio };
