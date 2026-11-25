// orlant-sta.js — Fase STA (20/11/2026, pedido de Edwin): «Gestión STA» de ORLANT.
//
// Nace del HTML de una sola página de Edwin (docs/orlant/sta/Gestion_STA.html, NUNCA se edita):
// allí todo el estado vivía en IndexedDB del navegador; aquí vive en SQLite, caso por caso, para
// que supervisor y asesores trabajen sobre los mismos datos. Las reglas son las del HTML:
//  - el Numero Autorizacion es la llave: si ya existe no se duplica; si llega con otro Estado,
//    se actualiza el Estado y se guarda el cambio (procesarCarga);
//  - asignar = los N casos libres más antiguos por Fecha Ingreso Sta, con filtros (filtrar);
//  - devolver / pasar = solo casos PENDIENTES del asesor (devolverSel / pasarSel);
//  - codificar = tipificación obligatoria, observación obligatoria, citas >= 1 si la
//    tipificación es efectiva, fecha y hora futuras si es «volver a llamar»; una rellamada
//    pendiente se cierra al gestionarla y la gestión anterior pasa a «prev» (guardarCodificacion);
//  - eliminar una carga borra sus casos, con la opción de conservar los ya gestionados (borrarCarga).
// Los agentes son los usuarios ASESOR de ORLANT que ya existen (no se crean agentes aparte).
// El Excel lo lee el navegador (mismas funciones del HTML); el servidor recibe filas ya leídas.
'use strict';

const zlib = require('zlib');

const CAMPANA = 'ORLANT';
const CAMPOS = ['Fecha Ingreso Sta', 'Entidad', 'Numero Autorizacion', 'Estado', 'Descripcion Cups', 'Fecha Autorizacion', 'Fecha Expiracion', 'Servicio'];
const CAMPOS_FECHA = ['Fecha Ingreso Sta', 'Fecha Autorizacion', 'Fecha Expiracion'];
const TIPIS_BASE = ['Agendado', 'No contesta', 'Número errado', 'Rechaza', 'Volver a llamar', 'Ya agendado'];
const MAX_FILAS = 50000;
const MAX_COLUMNAS = 40;
const MAX_TEXTO = 500;
const MAX_OBS = 2000;
const HIST_ASESOR = 50; // «histórico de 50» del asesor (pintarGestionados)

function asegurarTablas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sta_cargas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      fecha TEXT NOT NULL,
      archivo TEXT NOT NULL,
      leidas INTEGER NOT NULL DEFAULT 0,
      nuevos INTEGER NOT NULL DEFAULT 0,
      dup INTEGER NOT NULL DEFAULT 0,
      sinNum INTEGER NOT NULL DEFAULT 0,
      actEst INTEGER NOT NULL DEFAULT 0,
      eliminados INTEGER NOT NULL DEFAULT 0,
      archivoGz BLOB,
      cargadoPorNombre TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sta_casos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      numero TEXT NOT NULL,
      datos TEXT NOT NULL,
      cargaId INTEGER,
      cargaFecha TEXT,
      agenteId INTEGER,
      asignado TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'pendiente',
      tipi TEXT NOT NULL DEFAULT '',
      obs TEXT NOT NULL DEFAULT '',
      fg TEXT NOT NULL DEFAULT '',
      citas INTEGER NOT NULL DEFAULT 0,
      rell TEXT,
      prev TEXT,
      hist TEXT,
      UNIQUE (campana, numero)
    );
    CREATE INDEX IF NOT EXISTS idx_sta_casos_agente ON sta_casos (campana, agenteId, estado);
    CREATE INDEX IF NOT EXISTS idx_sta_casos_carga ON sta_casos (cargaId);
    -- (pedido 3 de Edwin, 23/11: eliminadaAt / eliminadaPor se agregan abajo si faltan)
    CREATE TABLE IF NOT EXISTS sta_config (
      campana TEXT PRIMARY KEY,
      tipis TEXT NOT NULL,
      efectivas TEXT NOT NULL,
      columnas TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  // Pedido 3 de Edwin (23/11/2026): una carga eliminada queda en el registro como «Eliminada».
  const cols = new Set(db.prepare('PRAGMA table_info(sta_cargas)').all().map((c) => c.name));
  if (!cols.has('eliminadaAt')) db.exec('ALTER TABLE sta_cargas ADD COLUMN eliminadaAt TEXT');
  if (!cols.has('eliminadaPor')) db.exec('ALTER TABLE sta_cargas ADD COLUMN eliminadaPor TEXT');
}

// ── utilidades (las del HTML) ──
const p2 = (n) => String(n).padStart(2, '0');
// Hora de Colombia (UTC−5, sin horario de verano) en el formato del HTML: «AAAA-MM-DD HH:MM:SS».
function ahora(d) {
  const x = new Date((d ? d.getTime() : Date.now()) - 5 * 3600e3);
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())} ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}:${p2(x.getUTCSeconds())}`;
}
function normClave(v) { return String(v == null ? '' : v).trim().replace(/\.0+$/, ''); }
function normHeader(h) { return String(h == null ? '' : h).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' '); }
function esVolver(t) { return normHeader(t).includes('volver a llamar'); }
const RE_FECHA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// ── Pedido de Edwin (llamada del 25/11/2026): solo se gestionan los casos «En proceso» y «Sin contacto» ──
// Con otro Estado (agendada, cumplida, anulada, facturado…) el caso sale de la gestión: estado 'fuera'
// («Fuera de gestión»), sin asesora, y no cuenta en asignados, pendientes ni sin asignar. Si una carga
// posterior lo trae otra vez «En proceso» o «Sin contacto», vuelve a quedar disponible (siempre por
// Numero Autorizacion). Un caso ya GESTIONADO conserva su gestión (es trabajo hecho); solo se cierra su
// «volver a llamar» pendiente. Estado vacío: no decide nada (el caso sigue como está).
const ESTADOS_GESTION = ['en proceso', 'sin contacto'];
function esGestionable(estado) { const n = normHeader(estado); return !n || ESTADOS_GESTION.includes(n); }
// Cambios de la fila según el Estado nuevo. r: fila de sta_casos. Devuelve null si no cambia la gestión.
function efectoEstado(r, nuevoEstado) {
  const n = normHeader(nuevoEstado);
  if (!n) return null;
  const gestionable = ESTADOS_GESTION.includes(n);
  if (!gestionable && r.estado === 'pendiente') return { estado: 'fuera', agenteId: null, asignado: '', rell: r.rell, sale: true, agenteAntes: r.agenteId };
  if (!gestionable && r.estado === 'gestionado' && r.rell) {
    const rell = JSON.parse(r.rell);
    if (rell && rell.estado === 'pendiente') return { estado: r.estado, agenteId: r.agenteId, asignado: r.asignado, rell: JSON.stringify(Object.assign(rell, { estado: 'cerrada' })), rellCerrada: true };
  }
  if (gestionable && r.estado === 'fuera') return { estado: 'pendiente', agenteId: null, asignado: '', rell: r.rell, vuelve: true };
  return null;
}
// Aplica un Estado nuevo a una fila existente (dato de la base + gestión). Devuelve { cambio, efecto } o null.
function aplicarEstado(db, r, nuevoEstado, hoy, origen, por) {
  const d = JSON.parse(r.datos);
  const antes = String(d['Estado'] == null ? '' : d['Estado']).trim();
  const nuevo = String(nuevoEstado == null ? '' : nuevoEstado).trim();
  const cambio = !!nuevo && antes !== nuevo;
  const ef = efectoEstado(r, nuevo);
  if (!cambio && !ef) return null;
  const h = { fecha: hoy, de: antes, a: nuevo || antes, origen };
  if (por) h.por = String(por).slice(0, 120); // quién lo hizo (líder o administrador), nunca la asesora
  if (ef && ef.sale) { h.sale = true; if (ef.agenteAntes) h.agente = ef.agenteAntes; }
  if (ef && ef.vuelve) h.vuelve = true;
  const hist = (r.hist ? JSON.parse(r.hist) : []).concat([h]);
  if (cambio) d['Estado'] = nuevo;
  const e = ef || { estado: r.estado, agenteId: r.agenteId, asignado: r.asignado, rell: r.rell };
  db.prepare('UPDATE sta_casos SET datos = ?, hist = ?, estado = ?, agenteId = ?, asignado = ?, rell = ? WHERE id = ?')
    .run(JSON.stringify(d), JSON.stringify(hist), e.estado, e.agenteId, e.asignado, e.rell || null, r.id);
  return { cambio, antes, nuevo, efecto: ef };
}
class StaError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function config(db) {
  asegurarTablas(db);
  const r = db.prepare('SELECT tipis, efectivas, columnas FROM sta_config WHERE campana = ?').get(CAMPANA);
  if (!r) return { tipis: TIPIS_BASE.slice(), efectivas: ['Agendado'], columnas: CAMPOS.slice() };
  return { tipis: JSON.parse(r.tipis), efectivas: JSON.parse(r.efectivas), columnas: JSON.parse(r.columnas) };
}
function guardarConfig(db, c) {
  db.prepare(`INSERT INTO sta_config (campana, tipis, efectivas, columnas, updatedAt) VALUES (?,?,?,?,?)
              ON CONFLICT(campana) DO UPDATE SET tipis = excluded.tipis, efectivas = excluded.efectivas, columnas = excluded.columnas, updatedAt = excluded.updatedAt`)
    .run(CAMPANA, JSON.stringify(c.tipis), JSON.stringify(c.efectivas), JSON.stringify(c.columnas), new Date().toISOString());
}

// Tipificaciones que crea el líder: lista ordenada + cuáles son efectivas (pintarTipis y vecinas).
function cambiarTipis(db, body) {
  const b = body || {};
  if (!Array.isArray(b.tipis) || !Array.isArray(b.efectivas) || b.tipis.length > 60) throw new StaError(400, 'Lista de tipificaciones inválida');
  const tipis = [];
  for (const t of b.tipis) {
    const s = String(t == null ? '' : t).trim();
    if (!s || s.length > 80) throw new StaError(400, 'Tipificación vacía o muy larga');
    if (tipis.some((x) => x.toLowerCase() === s.toLowerCase())) throw new StaError(400, 'Tipificación repetida: ' + s);
    tipis.push(s);
  }
  const efectivas = b.efectivas.map((t) => String(t)).filter((t) => tipis.includes(t));
  const c = config(db);
  c.tipis = tipis; c.efectivas = [...new Set(efectivas)];
  guardarConfig(db, c);
  return c;
}

// Agentes = usuarios ASESOR activos de ORLANT (los que ya existen en la plataforma).
function asesores(db, { incluirInactivos } = {}) {
  return db.prepare(`SELECT id, nombre, active FROM users WHERE rol = 'ASESOR' AND asesorCampana = ?${incluirInactivos ? '' : ' AND active = 1'} ORDER BY nombre`).all(CAMPANA)
    .map((u) => ({ id: u.id, nombre: u.nombre, activo: u.active === 1 }));
}
function esAsesorSta(db, id) {
  return !!db.prepare("SELECT 1 FROM users WHERE id = ? AND rol = 'ASESOR' AND asesorCampana = ? AND active = 1").get(Number(id), CAMPANA);
}

function filaCaso(r) {
  return Object.assign(JSON.parse(r.datos), {
    _id: r.numero, _cargaId: r.cargaId, _carga: r.cargaFecha || '', _agente: r.agenteId, _asignado: r.asignado, _estado: r.estado,
    _tipi: r.tipi, _obs: r.obs, _fg: r.fg, _citas: r.citas, _rell: r.rell ? JSON.parse(r.rell) : null, _prev: r.prev ? JSON.parse(r.prev) : [], _hist: r.hist ? JSON.parse(r.hist) : [],
  });
}

// ── Carga (procesarCarga del HTML, del lado del servidor) ──
// filas: objetos ya leídos por el navegador (claves = columnas del Excel, fechas en «AAAA-MM-DD HH:MM:SS»).
function cargar(db, { archivo, filas, columnas, archivoB64, por }) {
  asegurarTablas(db);
  const nombre = String(archivo || '').trim().slice(0, 200);
  if (!nombre) throw new StaError(400, 'Falta el nombre del archivo');
  if (!Array.isArray(filas) || !filas.length) throw new StaError(400, 'El archivo está vacío');
  if (filas.length > MAX_FILAS) throw new StaError(400, 'Máximo ' + MAX_FILAS + ' filas por carga');
  const cols = Array.isArray(columnas) ? columnas.map((c) => String(c).trim().slice(0, 80)).filter(Boolean).slice(0, MAX_COLUMNAS) : [];
  if (!cols.includes('Numero Autorizacion')) throw new StaError(400, 'No encontré la columna Numero Autorizacion en el archivo.');
  const faltan = CAMPOS.filter((c) => !cols.includes(c));
  let gz = null;
  if (archivoB64 !== undefined && archivoB64 !== null) {
    if (typeof archivoB64 !== 'string' || archivoB64.length > 30 * 1024 * 1024) throw new StaError(400, 'Archivo original inválido');
    gz = zlib.gzipSync(Buffer.from(archivoB64, 'base64'));
  }
  const hoy = ahora();
  const res = { leidas: 0, nuevos: 0, dup: 0, sinNum: 0, actEst: 0, cambios: {}, faltan, salieron: 0, volvieron: 0, nuevosFuera: 0 };
  db.transaction(() => {
    const c = config(db);
    for (const k of cols) if (!c.columnas.includes(k)) c.columnas.push(k);
    c.columnas = c.columnas.slice(0, MAX_COLUMNAS);
    guardarConfig(db, c);
    const cargaId = db.prepare('INSERT INTO sta_cargas (campana, fecha, archivo, archivoGz, cargadoPorNombre, createdAt) VALUES (?,?,?,?,?,?)')
      .run(CAMPANA, hoy, nombre, gz, por || null, new Date().toISOString()).lastInsertRowid;
    const leer = db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?');
    const insertar = db.prepare('INSERT INTO sta_casos (campana, numero, datos, cargaId, cargaFecha, estado) VALUES (?,?,?,?,?,?)');
    const conEstado = cols.includes('Estado');
    const vistos = new Set();
    for (const f of filas) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) continue;
      const o = {};
      for (const k of cols) {
        let v = f[k];
        if (v === undefined || v === null) v = '';
        if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') v = '';
        o[k] = typeof v === 'string' ? v.trim().slice(0, MAX_TEXTO) : v;
      }
      if (cols.every((k) => o[k] === '')) continue;
      res.leidas++;
      const k = normClave(o['Numero Autorizacion']);
      if (!k || k.length > 80) { res.sinNum++; continue; }
      o['Numero Autorizacion'] = k;
      const ex = leer.get(CAMPANA, k);
      if (ex || vistos.has(k)) {
        res.dup++;
        const nuevoEst = String(o['Estado'] == null ? '' : o['Estado']).trim();
        if (ex && !vistos.has(k) && conEstado && nuevoEst) {
          // Pedido de Edwin (25/11): también sin cambio de Estado, para que la regla se cumpla con la base del día.
          const a = aplicarEstado(db, ex, nuevoEst, hoy, 'carga', por);
          if (a && a.cambio) {
            const clave = `${a.antes || '(vacío)'} → ${a.nuevo}`;
            res.cambios[clave] = (res.cambios[clave] || 0) + 1;
            res.actEst++;
          }
          if (a && a.efecto && a.efecto.sale) res.salieron++;
          if (a && a.efecto && a.efecto.vuelve) res.volvieron++;
        }
        vistos.add(k);
        continue;
      }
      vistos.add(k);
      const fuera = conEstado && !esGestionable(o['Estado']);
      insertar.run(CAMPANA, k, JSON.stringify(o), cargaId, hoy, fuera ? 'fuera' : 'pendiente');
      res.nuevos++;
      if (fuera) res.nuevosFuera++;
    }
    db.prepare('UPDATE sta_cargas SET leidas = ?, nuevos = ?, dup = ?, sinNum = ?, actEst = ? WHERE id = ?').run(res.leidas, res.nuevos, res.dup, res.sinNum, res.actEst, cargaId);
    res.cargaId = Number(cargaId);
  })();
  res.mensaje = `Se cargaron ${res.nuevos} nuevos, ${res.dup} ya existían, ${res.actEst} actualizados`
    + (res.salieron || res.nuevosFuera ? `; ${res.salieron + res.nuevosFuera} fuera de gestión (Estado distinto de «En proceso» o «Sin contacto»)` : '')
    + (res.volvieron ? `; ${res.volvieron} volvieron a quedar disponibles` : '');
  return res;
}

// ── Pedido de Edwin (25/11/2026): «Actualizar estado» ──
// filas: [{ numero, estado }] leídas por el navegador. Cada fila busca su caso por Numero Autorizacion y le
// cambia el Estado (con la regla de arriba). Las que no existan se reportan y NO se crean.
const MAX_NO_EXISTEN = 500;
function actualizarEstados(db, { archivo, filas, por }) {
  asegurarTablas(db);
  const nombre = String(archivo || '').trim().slice(0, 200);
  if (!nombre) throw new StaError(400, 'Falta el nombre del archivo');
  if (!Array.isArray(filas) || !filas.length) throw new StaError(400, 'El archivo está vacío');
  if (filas.length > MAX_FILAS) throw new StaError(400, 'Máximo ' + MAX_FILAS + ' filas por archivo');
  const hoy = ahora();
  const res = { leidas: 0, actualizados: 0, sinCambio: 0, sinNum: 0, sinEstado: 0, repetidos: 0, noExisten: 0, noExistenLista: [], salieron: 0, volvieron: 0, cambios: {} };
  const texto = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
  db.transaction(() => {
    const leer = db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?');
    const vistos = new Set();
    for (const f of filas) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) continue;
      const k = normClave(texto(f.numero));
      const est = texto(f.estado).trim().slice(0, 80);
      if (!k && !est) continue;
      res.leidas++;
      if (!k || k.length > 80) { res.sinNum++; continue; }
      if (!est) { res.sinEstado++; continue; }
      if (vistos.has(k)) { res.repetidos++; continue; }
      vistos.add(k);
      const r = leer.get(CAMPANA, k);
      if (!r) { res.noExisten++; if (res.noExistenLista.length < MAX_NO_EXISTEN) res.noExistenLista.push(k); continue; }
      const a = aplicarEstado(db, r, est, hoy, 'actualizar', por);
      if (!a) { res.sinCambio++; continue; }
      res.actualizados++;
      if (a.cambio) { const clave = `${a.antes || '(vacío)'} → ${a.nuevo}`; res.cambios[clave] = (res.cambios[clave] || 0) + 1; }
      if (a.efecto && a.efecto.sale) res.salieron++;
      if (a.efecto && a.efecto.vuelve) res.volvieron++;
    }
  })();
  res.mensaje = `${res.actualizados} casos actualizados, ${res.sinCambio} sin cambio`
    + (res.salieron ? `; ${res.salieron} salieron de la gestión` : '') + (res.volvieron ? `; ${res.volvieron} volvieron a quedar disponibles` : '')
    + (res.noExisten ? `; ${res.noExisten} no existen en la base (no se crearon)` : '');
  return res;
}

// ── Pedido de Edwin (25/11/2026, 2:45 p. m.): histórico con gestión (STA - SEPTIEMBRE / OCTUBRE / NOVIEMBRE) ──
// filas: los campos de la base más { codificacion, observacion, fechaGestion: 'AAAA-MM-DD', asesor: nombre }.
// Reglas (decisión del usuario, 26/11):
//  - una autorización que ya existe se rechaza (sin duplicados). Se cargan en orden NOVIEMBRE → OCTUBRE →
//    SEPTIEMBRE, así gana la más reciente; dentro de un archivo, la de fecha de gestión más reciente;
//  - «En proceso» / «Sin contacto»: quedan disponibles (sin asesora) y la gestión vieja va a «Gestiones
//    anteriores». Ajuste del usuario (25/11): si la fila trae codificación, esa gestión CUENTA (gráficas,
//    Gestionados y productividad de su asesora, en su fecha) con la marca `cuenta`; sin codificación no suma;
//  - otro estado: entran GESTIONADOS a nombre de su asesora, en su fecha y sin hora (00:00:00), y suman en las
//    gráficas con su estado; «Agenda InConexion» (efectiva) cuenta 1 cita;
//  - el asesor se reconoce por el nombre de su usuario ASESOR de ORLANT; si no coincide, la fila no entra;
//  - todo o nada por archivo, con su propio registro de carga (se puede eliminar como cualquier carga);
//  - dryRun: hace las mismas cuentas sin escribir nada.
const RE_DIA_HIST = /^\d{4}-\d{2}-\d{2}$/;
function cargarHistorico(db, { archivo, filas, por, dryRun }) {
  asegurarTablas(db);
  const nombre = String(archivo || '').trim().slice(0, 200);
  if (!nombre) throw new StaError(400, 'Falta el nombre del archivo');
  if (!Array.isArray(filas) || !filas.length) throw new StaError(400, 'El archivo está vacío');
  if (filas.length > MAX_FILAS) throw new StaError(400, 'Máximo ' + MAX_FILAS + ' filas por carga');
  const c = config(db);
  const ef = new Set(c.efectivas);
  const tipisNorm = new Map(c.tipis.map((t) => [normHeader(t), t]));
  const ases = new Map();
  db.prepare("SELECT id, nombre, user FROM users WHERE rol = 'ASESOR' AND asesorCampana = ?").all(CAMPANA)
    .forEach((u) => { ases.set(normHeader(u.nombre), u.id); if (u.user) ases.set(normHeader(u.user), u.id); });
  const txt = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, n) : '');
  const res = { leidas: 0, nuevos: 0, disponibles: 0, gestionados: 0, citas: 0, existen: 0, repetidasArchivo: 0, sinNum: 0, sinFecha: 0,
    sinAsesor: 0, cuentanDisponibles: 0, asesoresSinUsuario: {}, codificacionDesconocida: {}, porEstado: {}, dryRun: !!dryRun };
  // 1) Filas válidas; dentro del archivo, la de fecha de gestión más reciente.
  const elegidas = new Map();
  for (const f of filas) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) continue;
    res.leidas++;
    const k = normClave(txt(f['Numero Autorizacion'], 80));
    if (!k) { res.sinNum++; continue; }
    const fg = txt(f.fechaGestion, 10);
    if (!RE_DIA_HIST.test(fg)) { res.sinFecha++; continue; }
    const prev = elegidas.get(k);
    if (prev) { res.repetidasArchivo++; if (prev.fg >= fg) continue; }
    elegidas.set(k, { f, fg });
  }
  const hoy = ahora();
  const quien = String(por || '').slice(0, 120);
  const existe = db.prepare('SELECT 1 FROM sta_casos WHERE campana = ? AND numero = ?');
  const trabajo = () => {
    let cargaId = null;
    if (!dryRun) {
      cargaId = db.prepare('INSERT INTO sta_cargas (campana, fecha, archivo, cargadoPorNombre, createdAt) VALUES (?,?,?,?,?)')
        .run(CAMPANA, hoy, 'Histórico · ' + nombre, quien || null, new Date().toISOString()).lastInsertRowid;
    }
    const ins = db.prepare('INSERT INTO sta_casos (campana, numero, datos, cargaId, cargaFecha, agenteId, asignado, estado, tipi, obs, fg, citas, prev, hist) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const [k, { f, fg }] of elegidas) {
      if (existe.get(CAMPANA, k)) { res.existen++; continue; }
      const asesorTxt = txt(f.asesor, 120);
      const agenteId = ases.get(normHeader(asesorTxt));
      if (!agenteId) { res.sinAsesor++; res.asesoresSinUsuario[asesorTxt || '(vacío)'] = (res.asesoresSinUsuario[asesorTxt || '(vacío)'] || 0) + 1; continue; }
      const codTxt = txt(f.codificacion, 200);
      const tipi = tipisNorm.get(normHeader(codTxt)) || codTxt;
      if (codTxt && !tipisNorm.has(normHeader(codTxt))) res.codificacionDesconocida[codTxt] = (res.codificacionDesconocida[codTxt] || 0) + 1;
      const d = {};
      for (const col of CAMPOS) d[col] = txt(f[col], MAX_TEXTO);
      d['Numero Autorizacion'] = k;
      const estadoBase = d['Estado'];
      const obs = txt(f.observacion, MAX_OBS);
      const fgHora = fg + ' 00:00:00';
      const citas = ef.has(tipi) ? 1 : 0;
      const hist = JSON.stringify([{ fecha: hoy, de: '', a: estadoBase, origen: 'historico', por: quien }]);
      res.porEstado[estadoBase || '(vacío)'] = (res.porEstado[estadoBase || '(vacío)'] || 0) + 1;
      res.nuevos++;
      if (esGestionable(estadoBase)) {
        res.disponibles++;
        const cuenta = !!tipi;
        if (cuenta) { res.cuentanDisponibles++; res.citas += citas; }
        const prev = JSON.stringify([Object.assign({ tipi, obs, fg: fgHora, citas: cuenta ? citas : 0, agente: agenteId, historico: true }, cuenta ? { cuenta: true } : {})]);
        if (!dryRun) ins.run(CAMPANA, k, JSON.stringify(d), cargaId, hoy, null, '', 'pendiente', '', '', '', 0, prev, hist);
      } else {
        res.gestionados++; res.citas += citas;
        if (!dryRun) ins.run(CAMPANA, k, JSON.stringify(d), cargaId, hoy, agenteId, fgHora, 'gestionado', tipi, obs, fgHora, citas, null, hist);
      }
    }
    if (!dryRun) {
      db.prepare('UPDATE sta_cargas SET leidas = ?, nuevos = ?, dup = ?, sinNum = ? WHERE id = ?').run(res.leidas, res.nuevos, res.existen + res.repetidasArchivo, res.sinNum, cargaId);
      res.cargaId = Number(cargaId);
    }
  };
  db.transaction(trabajo)();
  res.mensaje = (dryRun ? 'Revisión (no se cargó nada): ' : '') + `${res.nuevos} casos nuevos (${res.gestionados} gestionados, ${res.disponibles} disponibles`
    + (res.cuentanDisponibles ? `, de ellos ${res.cuentanDisponibles} con su gestión contada` : '') + `), ${res.existen} ya existían (rechazados)`
    + (res.repetidasArchivo ? `, ${res.repetidasArchivo} repetidas en el archivo` : '') + (res.sinAsesor ? `, ${res.sinAsesor} sin asesora reconocida` : '');
  return res;
}

function cargas(db) {
  asegurarTablas(db);
  return db.prepare(`SELECT c.id, c.fecha, c.archivo, c.leidas, c.nuevos, c.dup, c.sinNum, c.actEst, c.eliminados, c.cargadoPorNombre, c.eliminadaAt, c.eliminadaPor,
                            (c.archivoGz IS NOT NULL) tieneArchivo, (SELECT COUNT(*) FROM sta_casos s WHERE s.cargaId = c.id) casosActuales,
                            (SELECT COUNT(*) FROM sta_casos s WHERE s.cargaId = c.id AND s.agenteId IS NULL) sinAsignar,
                            (SELECT COUNT(*) FROM sta_casos s WHERE s.cargaId = c.id AND s.agenteId IS NOT NULL AND s.estado = 'pendiente') pendientes,
                            (SELECT COUNT(*) FROM sta_casos s WHERE s.cargaId = c.id AND s.estado = 'gestionado') gestionados
                     FROM sta_cargas c WHERE c.campana = ? ORDER BY c.id DESC`).all(CAMPANA).map((r) => Object.assign(r, { tieneArchivo: !!r.tieneArchivo }));
}
function archivoDeCarga(db, id) {
  asegurarTablas(db);
  const r = db.prepare('SELECT archivo, archivoGz FROM sta_cargas WHERE campana = ? AND id = ?').get(CAMPANA, Number(id));
  if (!r) throw new StaError(404, 'Esa carga no existe');
  if (!r.archivoGz) throw new StaError(404, 'Esa carga no guardó el archivo original');
  return { nombre: r.archivo, contenido: zlib.gunzipSync(r.archivoGz) };
}
// borrarCarga del HTML: se borran los casos que entraron con esa carga (también los de las bandejas);
// con conservar=true se quedan los gestionados.
// Pedido 3 de Edwin (23/11/2026): la carga YA NO desaparece del registro: queda «Eliminada» (fecha y
// quién), con «eliminados» sumados, y sin el Excel original (eliminar la base es quitar sus datos).
function borrarCarga(db, id, conservar, por) {
  asegurarTablas(db);
  const cg = db.prepare('SELECT id, eliminadaAt FROM sta_cargas WHERE campana = ? AND id = ?').get(CAMPANA, Number(id));
  if (!cg) throw new StaError(404, 'Esa carga no existe');
  if (cg.eliminadaAt) throw new StaError(409, 'Esa carga ya fue eliminada');
  let n = 0, k = 0;
  db.transaction(() => {
    if (conservar) {
      k = db.prepare("SELECT COUNT(*) n FROM sta_casos WHERE cargaId = ? AND estado = 'gestionado'").get(cg.id).n;
      n = db.prepare("DELETE FROM sta_casos WHERE cargaId = ? AND estado <> 'gestionado'").run(cg.id).changes;
    } else {
      n = db.prepare('DELETE FROM sta_casos WHERE cargaId = ?').run(cg.id).changes;
    }
    db.prepare('UPDATE sta_cargas SET eliminados = eliminados + ?, eliminadaAt = ?, eliminadaPor = ?, archivoGz = NULL WHERE id = ?').run(n, ahora(), String(por || '').slice(0, 120), cg.id);
  })();
  return { eliminados: n, conservados: k };
}

// ── Asignación (filtrar / asignar / aceptarExistentes / devolverSel / pasarSel) ──
function _lista(v) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length > 2000) throw new StaError(400, 'Filtro inválido');
  return new Set(v.map((x) => String(x == null ? '' : x)));
}
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
function _dia(v) { if (v === undefined || v === null || v === '') return ''; if (!RE_DIA.test(String(v))) throw new StaError(400, 'Fecha inválida'); return String(v); }
function disponiblesFiltrados(db, filtros) {
  const f = filtros || {};
  const ent = _lista(f.entidad), serv = _lista(f.servicio), cups = _lista(f.cups);
  const rangos = [['Fecha Ingreso Sta', _dia(f.ingD), _dia(f.ingH)], ['Fecha Autorizacion', _dia(f.autD), _dia(f.autH)], ['Fecha Expiracion', _dia(f.expD), _dia(f.expH)]];
  return db.prepare("SELECT numero, datos FROM sta_casos WHERE campana = ? AND agenteId IS NULL AND estado = 'pendiente'").all(CAMPANA)
    .map((r) => ({ numero: r.numero, d: JSON.parse(r.datos) }))
    .filter(({ d }) => {
      if (ent && !ent.has(String(d['Entidad'] || ''))) return false;
      if (serv && !serv.has(String(d['Servicio'] || ''))) return false;
      if (cups && !cups.has(String(d['Descripcion Cups'] || ''))) return false;
      return rangos.every(([c, a, b]) => { const s = String(d[c] || '').slice(0, 10); if (a && (!s || s < a)) return false; if (b && (!s || s > b)) return false; return true; });
    })
    .sort((a, b) => String(a.d['Fecha Ingreso Sta'] || '').localeCompare(String(b.d['Fecha Ingreso Sta'] || '')));
}
function _cantidad(n) { const c = Number(n); if (!Number.isInteger(c) || c < 1 || c > MAX_FILAS) throw new StaError(400, 'Indica la cantidad (entero de 1 en adelante)'); return c; }
// Asigna los N más antiguos; si hay menos, los disponibles (decisión del usuario: sin preguntar).
function asignar(db, { agenteId, cantidad, filtros }) {
  asegurarTablas(db);
  if (!esAsesorSta(db, agenteId)) throw new StaError(400, 'Ese asesor no es de ORLANT o está inactivo');
  const c = _cantidad(cantidad);
  const h = ahora();
  let asignados = 0, disponibles = 0;
  db.transaction(() => {
    const disp = disponiblesFiltrados(db, filtros);
    disponibles = disp.length;
    const up = db.prepare('UPDATE sta_casos SET agenteId = ?, asignado = ? WHERE campana = ? AND numero = ? AND agenteId IS NULL');
    for (const x of disp.slice(0, c)) asignados += up.run(Number(agenteId), h, CAMPANA, x.numero).changes;
  })();
  return { pedidos: c, disponibles, asignados };
}
// Los N pendientes más antiguos del asesor (o los números dados), como pendDe/selCantidad del HTML.
function _pendientesDe(db, agenteId, cantidad, numeros) {
  const pend = db.prepare("SELECT numero, datos FROM sta_casos WHERE campana = ? AND agenteId = ? AND estado = 'pendiente'").all(CAMPANA, Number(agenteId))
    .map((r) => ({ numero: r.numero, f: String(JSON.parse(r.datos)['Fecha Ingreso Sta'] || '') }))
    .sort((a, b) => a.f.localeCompare(b.f));
  if (Array.isArray(numeros)) { const s = new Set(numeros.map(normClave)); return pend.filter((p) => s.has(p.numero)).map((p) => p.numero); }
  return pend.slice(0, _cantidad(cantidad)).map((p) => p.numero);
}
function devolver(db, { agenteId, cantidad, numeros }) {
  asegurarTablas(db);
  let n = 0;
  db.transaction(() => {
    const up = db.prepare("UPDATE sta_casos SET agenteId = NULL, asignado = '' WHERE campana = ? AND numero = ? AND agenteId = ? AND estado = 'pendiente'");
    for (const k of _pendientesDe(db, agenteId, cantidad, numeros)) n += up.run(CAMPANA, k, Number(agenteId)).changes;
  })();
  return { devueltos: n };
}
function pasar(db, { agenteId, destinoId, cantidad, numeros }) {
  asegurarTablas(db);
  if (Number(agenteId) === Number(destinoId)) throw new StaError(400, 'Elige otro asesor');
  if (!esAsesorSta(db, destinoId)) throw new StaError(400, 'El asesor destino no es de ORLANT o está inactivo');
  const h = ahora();
  let n = 0;
  db.transaction(() => {
    const up = db.prepare("UPDATE sta_casos SET agenteId = ?, asignado = ? WHERE campana = ? AND numero = ? AND agenteId = ? AND estado = 'pendiente'");
    for (const k of _pendientesDe(db, agenteId, cantidad, numeros)) n += up.run(Number(destinoId), h, CAMPANA, k, Number(agenteId)).changes;
  })();
  return { pasados: n };
}

// ── Pedido de Edwin (23/11/2026): «Regresar a disponibles» desde Gestionados ──
// Por codificación (todos los gestionados con esa tipificación, también las efectivas como «Agendado»)
// o por casos marcados uno a uno. Cada caso vuelve a la bolsa libre (sin asesor, pendiente) para
// reasignarlo; la gestión que tenía NO se pierde: pasa a «Gestiones anteriores» (prev), con la fecha y
// quién lo regresó. Una rellamada pendiente queda cerrada («regresado»).
const MAX_REGRESAR = 5000;
function regresarGestionados(db, { tipi, numeros, por }) {
  asegurarTablas(db);
  const porTipi = tipi !== undefined && tipi !== null && tipi !== '';
  const porLista = Array.isArray(numeros);
  if (porTipi === porLista) throw new StaError(400, 'Elige una codificación o marca los casos');
  let filas;
  if (porTipi) {
    const t = String(tipi).trim();
    if (!t || t.length > 200) throw new StaError(400, 'Codificación inválida');
    filas = db.prepare("SELECT * FROM sta_casos WHERE campana = ? AND estado = 'gestionado' AND tipi = ?").all(CAMPANA, t);
  } else {
    if (!numeros.length || numeros.length > MAX_REGRESAR) throw new StaError(400, 'Marca de 1 a ' + MAX_REGRESAR + ' casos');
    const sel = db.prepare("SELECT * FROM sta_casos WHERE campana = ? AND numero = ? AND estado = 'gestionado'");
    filas = [...new Set(numeros.map(normClave))].map((n) => sel.get(CAMPANA, n)).filter(Boolean);
  }
  const hoy = ahora();
  const quien = String(por || '').slice(0, 120);
  let n = 0;
  db.transaction(() => {
    const up = db.prepare("UPDATE sta_casos SET estado = ?, agenteId = NULL, asignado = '', tipi = '', obs = '', fg = '', citas = 0, rell = NULL, prev = ? WHERE id = ? AND estado = 'gestionado'");
    for (const r of filas) {
      const prev = r.prev ? JSON.parse(r.prev) : [];
      const rell = r.rell ? JSON.parse(r.rell) : null;
      prev.push(Object.assign({ tipi: r.tipi, obs: r.obs, fg: r.fg, citas: r.citas || 0, agente: r.agenteId, regresado: hoy, por: quien },
        rell ? { rell: rell.cuando, rellEstado: rell.estado === 'pendiente' ? 'regresado' : rell.estado } : {}));
      n += up.run(esGestionable(JSON.parse(r.datos)['Estado']) ? 'pendiente' : 'fuera', JSON.stringify(prev), r.id).changes; // 25/11: si ya no se gestiona, «fuera»
    }
  })();
  return { regresados: n, pedidos: porLista ? numeros.length : n };
}

// ── Codificar (guardarCodificacion del HTML) ── solo el asesor dueño del caso.
function codificar(db, agenteId, numero, body, d) {
  asegurarTablas(db);
  const b = body || {};
  const c = config(db);
  const tipi = String(b.tipi == null ? '' : b.tipi).trim();
  const obs = String(b.obs == null ? '' : b.obs).trim();
  if (!tipi) throw new StaError(400, 'Selecciona una tipificación');
  if (!c.tipis.includes(tipi)) throw new StaError(400, 'Esa tipificación no existe');
  const hoy = ahora(d);
  let cuando = '';
  if (esVolver(tipi)) {
    cuando = String(b.cuando == null ? '' : b.cuando).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(cuando)) cuando += ':00';
    if (!RE_FECHA.test(cuando)) throw new StaError(400, 'Indica la fecha y la hora para volver a llamar');
    if (cuando <= hoy) throw new StaError(400, 'La hora para volver a llamar debe ser posterior a la hora actual');
  }
  if (!obs) throw new StaError(400, 'La observación es obligatoria');
  if (obs.length > MAX_OBS) throw new StaError(400, 'La observación es muy larga');
  let citas = 0;
  if (c.efectivas.includes(tipi)) {
    citas = Number(b.citas);
    if (!Number.isInteger(citas) || citas < 1 || citas > 1000) throw new StaError(400, 'Escribe la cantidad de citas agendadas (mínimo 1)');
  }
  let out;
  db.transaction(() => {
    const r = db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?').get(CAMPANA, normClave(numero));
    const rell = r && r.rell ? JSON.parse(r.rell) : null;
    const esRell = !!(rell && rell.estado === 'pendiente');
    if (!r || r.agenteId !== Number(agenteId) || (r.estado !== 'pendiente' && !esRell)) throw new StaError(409, 'Este caso ya no está en tu bandeja');
    let prev = r.prev ? JSON.parse(r.prev) : [];
    let nuevaRell = rell;
    if (esRell) { prev = prev.concat([{ tipi: r.tipi, obs: r.obs, fg: r.fg, citas: r.citas || 0, rell: rell.cuando }]); nuevaRell = Object.assign({}, rell, { estado: 'hecha' }); }
    if (cuando) nuevaRell = { cuando, estado: 'pendiente', avisado: false };
    db.prepare("UPDATE sta_casos SET estado = 'gestionado', tipi = ?, obs = ?, fg = ?, citas = ?, rell = ?, prev = ? WHERE id = ?")
      .run(tipi, obs, hoy, citas, nuevaRell ? JSON.stringify(nuevaRell) : null, prev.length ? JSON.stringify(prev) : null, r.id);
    out = filaCaso(db.prepare('SELECT * FROM sta_casos WHERE id = ?').get(r.id));
  })();
  return out;
}
// Alerta de «volver a llamar»: «pos» = recordar en 10 min; «ya» = avisado (el asesor la gestiona).
function avisoRellamada(db, agenteId, numero, accion, d) {
  asegurarTablas(db);
  if (accion !== 'pos' && accion !== 'ya') throw new StaError(400, 'Acción inválida');
  const r = db.prepare('SELECT id, agenteId, rell FROM sta_casos WHERE campana = ? AND numero = ?').get(CAMPANA, normClave(numero));
  const rell = r && r.rell ? JSON.parse(r.rell) : null;
  if (!r || r.agenteId !== Number(agenteId) || !rell || rell.estado !== 'pendiente') throw new StaError(409, 'Esa rellamada ya no está pendiente');
  if (accion === 'pos') { rell.cuando = ahora(new Date((d ? d.getTime() : Date.now()) + 10 * 60000)).slice(0, 17) + '00'; rell.avisado = false; } else rell.avisado = true;
  db.prepare('UPDATE sta_casos SET rell = ? WHERE id = ?').run(JSON.stringify(rell), r.id);
  return { cuando: rell.cuando, avisado: rell.avisado };
}

// ── Lecturas ──
// Supervisor/administrativos: todo (casos, asesores, cargas y configuración).
function estadoSupervisor(db) {
  asegurarTablas(db);
  return {
    casos: db.prepare('SELECT * FROM sta_casos WHERE campana = ? ORDER BY id').all(CAMPANA).map(filaCaso),
    agentes: asesores(db, { incluirInactivos: true }), cargas: cargas(db), config: config(db), ahora: ahora(),
  };
}
// Asesor: SOLO sus casos (pendientes, gestionados y rellamadas), sin los de nadie más.
function estadoAsesor(db, agenteId) {
  asegurarTablas(db);
  return {
    casos: db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND agenteId = ? ORDER BY id').all(CAMPANA, Number(agenteId)).map(filaCaso),
    config: config(db), ahora: ahora(), histMax: HIST_ASESOR, histCuenta: histCuentaDe(db, agenteId),
  };
}
// STA14 (25/11): las gestiones del histórico que cuentan («En proceso»/«Sin contacto» con codificación) son de su
// asesora aunque el caso esté disponible o lo tenga otra. Para su «Gestionados» y «Mi efectividad» van SOLO el
// número de autorización, la codificación, la fecha y las citas (nada más del caso ni la observación).
function histCuentaDe(db, agenteId) {
  const out = [];
  for (const r of db.prepare(`SELECT numero, prev FROM sta_casos WHERE campana = ? AND prev LIKE '%"cuenta":true%' ORDER BY id`).all(CAMPANA)) {
    for (const p of prevQueCuenta(r.prev)) if (p.agente != null && String(p.agente) === String(agenteId)) out.push({ numero: r.numero, tipi: p.tipi || '', fg: p.fg, citas: p.citas || 0 });
  }
  return out;
}
// Pedido de Edwin (23/11/2026): la pestaña STA del CLIENTE de ORLANT muestra la MISMA visual de
// «Gráficas» del supervisor (el código de Edwin), de solo lectura. Para eso el navegador necesita los
// casos, pero RECORTADOS a lo que usan las gráficas: los 7 campos de la base que se grafican y estado,
// asesor, codificación, fecha de gestión y citas. NUNCA el número de autorización, otras columnas de
// la base (pueden traer datos del paciente), observaciones, rellamadas ni historial; el id es un
// consecutivo sin relación con el caso. Los nombres de las asesoras sí van (decisión del usuario,
// 23/11/2026: como en el panel de Edwin).
const CAMPOS_CLIENTE = ['Entidad', 'Servicio', 'Estado', 'Descripcion Cups', 'Fecha Ingreso Sta', 'Fecha Autorizacion', 'Fecha Expiracion'];
function estadoCliente(db) {
  asegurarTablas(db);
  const c = config(db);
  const casos = db.prepare('SELECT datos, agenteId, estado, tipi, fg, citas, prev FROM sta_casos WHERE campana = ? ORDER BY id').all(CAMPANA).map((r, i) => {
    const d = JSON.parse(r.datos);
    const o = { _id: 'c' + (i + 1), _agente: r.agenteId, _estado: r.estado, _tipi: r.estado === 'gestionado' ? r.tipi : '', _fg: r.estado === 'gestionado' ? r.fg : '', _citas: r.estado === 'gestionado' ? r.citas || 0 : 0 };
    for (const k of CAMPOS_CLIENTE) o[k] = d[k] === undefined ? '' : d[k];
    const gh = prevQueCuenta(r.prev).map((p) => ({ cuenta: true, agente: p.agente, tipi: p.tipi, fg: p.fg, citas: p.citas || 0 }));
    if (gh.length) o._prev = gh;
    return o;
  });
  return { casos, agentes: asesores(db, { incluirInactivos: true }), config: { tipis: c.tipis, efectivas: c.efectivas, columnas: CAMPOS_CLIENTE }, ahora: ahora() };
}

// Gestiones del histórico que cuentan aunque el caso esté disponible (ajuste del usuario, 25/11).
function prevQueCuenta(prev) {
  if (!prev) return [];
  try { return (JSON.parse(prev) || []).filter((p) => p && p.cuenta && p.fg); } catch { return []; }
}
// Cliente de ORLANT (gráficas del STA en su Dashboard): SOLO agregados, sin números de
// autorización, observaciones ni nombres de asesor.
function resumen(db) {
  asegurarTablas(db);
  const c = config(db);
  const ef = new Set(c.efectivas);
  const rows = db.prepare('SELECT datos, agenteId, estado, tipi, fg, citas, prev FROM sta_casos WHERE campana = ?').all(CAMPANA);
  const out = { total: rows.length, sinAsignar: 0, pendientes: 0, gestionados: 0, fueraGestion: 0, agendas: 0, citas: 0, porTipi: {}, porDia: {}, porEntidad: {}, porServicio: {}, porEstado: {}, efectivas: c.efectivas };
  const parte = (r) => (r.estado === 'gestionado' ? 'gestionado' : r.estado === 'fuera' ? 'fuera' : r.agenteId ? 'pendiente' : 'sinAsignar');
  const sumar = (m, k, p) => { const x = m[k] || (m[k] = { gestionado: 0, pendiente: 0, sinAsignar: 0, fuera: 0 }); x[p]++; };
  for (const r of rows) {
    const d = JSON.parse(r.datos);
    const p = parte(r);
    out[p === 'gestionado' ? 'gestionados' : p === 'pendiente' ? 'pendientes' : p === 'fuera' ? 'fueraGestion' : 'sinAsignar']++;
    sumar(out.porEntidad, String(d['Entidad'] || '(vacío)'), p);
    sumar(out.porServicio, String(d['Servicio'] || '(vacío)'), p);
    sumar(out.porEstado, String(d['Estado'] || '(vacío)'), p);
    if (r.estado === 'gestionado') {
      out.porTipi[r.tipi] = (out.porTipi[r.tipi] || 0) + 1;
      const dia = r.fg.slice(0, 10);
      const x = out.porDia[dia] || (out.porDia[dia] = { gestiones: 0, citas: 0 });
      x.gestiones++; x.citas += r.citas || 0;
      if (ef.has(r.tipi)) out.agendas++;
      out.citas += r.citas || 0;
    }
    for (const p of prevQueCuenta(r.prev)) {
      out.gestionesHistorico = (out.gestionesHistorico || 0) + 1;
      out.porTipi[p.tipi] = (out.porTipi[p.tipi] || 0) + 1;
      const x = out.porDia[p.fg.slice(0, 10)] || (out.porDia[p.fg.slice(0, 10)] = { gestiones: 0, citas: 0 });
      x.gestiones++; x.citas += p.citas || 0;
      if (ef.has(p.tipi)) out.agendas++;
      out.citas += p.citas || 0;
    }
  }
  const gestiones = out.gestionados + (out.gestionesHistorico || 0);
  out.efectividad = gestiones ? Math.round(out.citas * 1000 / gestiones) / 10 : 0;
  return out;
}

module.exports = {
  CAMPANA, CAMPOS, CAMPOS_FECHA, TIPIS_BASE, HIST_ASESOR, StaError, asegurarTablas, ahora, normClave, esVolver,
  config, cambiarTipis, asesores, esAsesorSta, cargar, cargas, archivoDeCarga, borrarCarga, disponiblesFiltrados,
  asignar, devolver, pasar, codificar, avisoRellamada, estadoSupervisor, estadoAsesor, resumen, estadoCliente, CAMPOS_CLIENTE, regresarGestionados,
  ESTADOS_GESTION, esGestionable, actualizarEstados, cargarHistorico,
};
