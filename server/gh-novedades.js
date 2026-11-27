// gh-novedades.js — Fase GH4 (plan de Gestión humana): «Novedades desde Gestión Humana» en el
// Inventario de sistemas. Une los dos módulos en SOLO LECTURA: Sistemas ve qué agentes con equipos
// asignados están retirados, ausentes hoy o por ausentarse en 7 días según Talento humano.
//
// Misma lógica que el HTML de Edwin (alertasGH/GH.estadoHoy/GH.proxima), con dos diferencias a
// propósito:
//   - el cruce es por documento (cédula sin puntos ni espacios); por nombre SOLO si el agente no tiene
//     documento (con documento distinto podría ser otra persona);
//   - a Sistemas le llega lo mínimo: nombre y documento del agente (que ya ve en el Inventario), un
//     texto con fechas y sus equipos. Nunca salario, cargo, contacto ni el TIPO de novedad (puede ser
//     una incapacidad: dato de salud).
'use strict';

const BASE = 'inconexion_gh_empleados_v1';
const DIAS_PROXIMOS = 7;

function leer(db, clave) {
  const f = db.prepare('SELECT valor FROM gh_estado WHERE clave = ?').get(clave);
  if (!f) return [];
  try { const v = JSON.parse(f.valor); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
const doc = (c) => String(c == null ? '' : c).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const iso = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '');
const fD = (s) => { const x = iso(s); return x ? x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(0, 4) : 'fecha sin registrar'; };
function hoyColombia(ahora) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora || new Date());
}
function sumarDias(isoDia, n) {
  const d = new Date(isoDia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

// Estado de hoy de un empleado de Talento humano → { t: 'retiro'|'vacaciones'|'ausente', txt } o null.
function estadoHoy(e, vac, nov, hoy) {
  if (e.estado === 'Retirado') return { t: 'retiro', txt: 'Retirado de la empresa desde el ' + fD(e.fRetiro) };
  const v = vac.find((x) => x.empId === e.id && !x.anulada && x.tipo === 'Disfrute' && iso(x.fIni) && iso(x.fIni) <= hoy && iso(x.fFin) >= hoy);
  if (v) return { t: 'vacaciones', txt: 'De vacaciones hasta el ' + fD(v.fFin) };
  // Auditoría 24/11 (bajo): una novedad SIN fecha de fin sigue vigente desde su inicio (antes '' >= hoy daba falso).
  const n = nov.find((x) => x.empId === e.id && !x.anulada && iso(x.fIni) && iso(x.fIni) <= hoy && (!iso(x.fFin) || iso(x.fFin) >= hoy));
  if (n) return { t: 'ausente', txt: (iso(n.fFin) ? 'Ausente hasta el ' + fD(n.fFin) : 'Ausente desde el ' + fD(n.fIni) + ', sin fecha de regreso') + ' (novedad registrada en Gestión Humana)' };
  return null;
}
function proxima(e, vac, nov, hoy) {
  if (e.estado === 'Retirado') return null;
  const lim = sumarDias(hoy, DIAS_PROXIMOS);
  const prim = (l) => l.filter((x) => x.empId === e.id && !x.anulada && iso(x.fIni) > hoy && iso(x.fIni) <= lim).sort((a, b) => iso(a.fIni).localeCompare(iso(b.fIni)))[0];
  const v = prim(vac.filter((x) => x.tipo === 'Disfrute'));
  if (v) return { t: 'proximo', txt: 'Sale a vacaciones el ' + fD(v.fIni) + ' hasta el ' + fD(v.fFin) };
  const n = prim(nov);
  return n ? { t: 'proximo', txt: iso(n.fFin) ? 'Ausente del ' + fD(n.fIni) + ' al ' + fD(n.fFin) : 'Ausente desde el ' + fD(n.fIni) + ', sin fecha de regreso' } : null;
}

// Fase INV3: índice de Talento humano para cruzar agentes (por documento; por nombre SOLO si el agente no tiene
// documento). Lo usan las novedades, el estado de cada agente y la entrega. Lee gh_estado sin importar
// GH_ROL_ACTIVO: ese interruptor solo decide si el rol GESTION_HUMANA entra a Talento humano.
function indice(db, opts) {
  const hoy = (opts && opts.hoy) || hoyColombia();
  const emp = leer(db, BASE).filter((e) => e && typeof e === 'object');
  const vac = leer(db, BASE + '_vac');
  const nov = leer(db, BASE + '_nov');
  const porDoc = new Map(), porNombre = new Map();
  for (const e of emp) {
    const d = doc(e.numId); if (d && !porDoc.has(d)) porDoc.set(d, e);
    const n = norm(e.nombre); if (n && !porNombre.has(n)) porNombre.set(n, e);
  }
  const deAgente = (g) => { const d = doc(g && g.documento); return (d ? porDoc.get(d) : porNombre.get(norm(g && g.nombre))) || null; };
  return { hoy, emp, vac, nov, total: emp.length, deAgente };
}
// Estado de un agente según Talento humano → { t, txt } o null si Talento humano no tiene a nadie (sin datos no se
// alarma a todos con «No está»). t: activo | retiro | vacaciones | ausente | proximo | sin. Lo mínimo: nunca el tipo
// de novedad (puede ser una incapacidad), cargo, salario ni contacto.
function estadoAgente(I, g) {
  if (!I.total) return null;
  const e = I.deAgente(g);
  if (!e) return { t: 'sin', txt: 'No está registrado en Gestión humana: verifica la cédula o pide su registro.' };
  const st = estadoHoy(e, I.vac, I.nov, I.hoy);
  if (st) return st;
  return proxima(e, I.vac, I.nov, I.hoy) || { t: 'activo', txt: 'Activo en Gestión humana.' };
}

// → { empleadosGH, retirados[], ausentes[], proximos[], sinRegistro[] }; cada fila:
//   { agente: { id, nombre, documento }, estado: { t, txt } | null, elementos: [{ id, tipo, codigo }] }
function novedades(db, opts) {
  const I = indice(db, opts);
  const R = { empleadosGH: I.total, hoy: I.hoy, retirados: [], ausentes: [], proximos: [], sinRegistro: [] };
  const agentes = db.prepare(`SELECT g.id, g.nombre, g.documento FROM activos_agentes g
    WHERE EXISTS (SELECT 1 FROM activos_asignaciones s WHERE s.agenteId = g.id AND s.hasta IS NULL) ORDER BY g.nombre`).all();
  const elems = db.prepare(`SELECT a.id, a.tipo, a.codigo FROM activos_asignaciones s JOIN activos a ON a.id = s.activoId
    WHERE s.agenteId = ? AND s.hasta IS NULL ORDER BY a.tipo, a.codigo`);
  for (const g of agentes) {
    const e = I.deAgente(g);
    const fila = { agente: { id: g.id, nombre: g.nombre, documento: g.documento || '' }, estado: null, elementos: elems.all(g.id) };
    if (!e) { R.sinRegistro.push(fila); continue; }
    const st = estadoHoy(e, I.vac, I.nov, I.hoy);
    if (st && st.t === 'retiro') { fila.estado = st; R.retirados.push(fila); continue; }
    if (st) { fila.estado = st; R.ausentes.push(fila); continue; }
    const pr = proxima(e, I.vac, I.nov, I.hoy);
    if (pr) { fila.estado = pr; R.proximos.push(fila); }
  }
  return R;
}

// Fase INV3 (HTML de Edwin: los agentes salen de las personas ACTIVAS de Gestión humana): buscar por cédula o
// nombre entre los activos (no retirados). Devuelve SOLO nombre y documento (lo que el Inventario ya guarda del
// agente), máximo 20, y si ya es agente. Texto de 3 a 60 caracteres.
const PERSONAS_MAX = 20;
function personas(db, q) {
  const t = norm(q), d = doc(q);
  if (t.length < 3) return [];
  const yaAgente = new Set(db.prepare("SELECT documento FROM activos_agentes WHERE documento IS NOT NULL AND documento != ''").all().map((r) => doc(r.documento)));
  const out = [];
  for (const e of leer(db, BASE)) {
    if (!e || typeof e !== 'object' || e.estado === 'Retirado') continue;
    const nombre = String(e.nombre == null ? '' : e.nombre).replace(/\s+/g, ' ').trim().slice(0, 80);
    const documento = doc(e.numId).slice(0, 20);
    if (!nombre || !documento) continue;
    if (!(norm(nombre).includes(t) || (d.length >= 3 && documento.includes(d)))) continue;
    out.push({ nombre, documento, yaEsAgente: yaAgente.has(documento) });
    if (out.length >= PERSONAS_MAX) break;
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Pedido de Edwin (25/11/2026): al escribir la cédula de un agente nuevo en el Inventario, su nombre desde Talento
// humano. Coincidencia EXACTA del documento (sin puntos ni espacios, igual que el cruce de arriba); devuelve SOLO el
// nombre, nada más del empleado. Sin documento o sin coincidencia: null.
function nombrePorDocumento(db, documento) {
  const d = doc(documento);
  if (!d) return null;
  const e = leer(db, BASE).find((x) => x && typeof x === 'object' && doc(x.numId) === d);
  const nombre = e ? String(e.nombre == null ? '' : e.nombre).replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return nombre || null;
}

module.exports = { indice, estadoAgente, personas, PERSONAS_MAX, novedades, estadoHoy, proxima, hoyColombia, doc, norm, DIAS_PROXIMOS, nombrePorDocumento };
