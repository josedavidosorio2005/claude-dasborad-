// clientes-registro.js — Fase 153 (Paso 1 de docs/plantillas-cliente.md,
// seccion 2.5): registro de clientes en la base.
//
// Reemplaza las listas fijas CLIENTES_LIST / CAMPANAS_CALIDAD que vivian
// copiadas en server/db.js y public/js/constants.js (y que habia que tocar
// en codigo, con deploy, para dar de alta un cliente). Cada fila es un
// cliente (o una campana que solo tiene Calidad) con:
//   - dashboard: 1 si aparece en "Dashboard Clientes" (CLIENTES_LIST);
//   - modulos:   ids del catalogo (plantillas-cliente, Paso 3) que tiene
//                activos; 'calidad' lo pone en CAMPANAS_CALIDAD;
//   - parametros: opciones por cliente (sedes, si el cliente ve el asesor,
//                formato de Trafico de 2 hojas, especificos...). 'sedes'
//                deja previsto que un cliente con sedes tenga una plantilla
//                de Calidad por sede (ajuste del usuario, 16/10/2026);
//   - logo:      imagen del encabezado del dashboard (o null).
//
// La semilla corre UNA sola vez (runOnceMigration 'clientes_registro_v1' en
// db.js) con ORLANT y MOBILIZE exactamente como estan hoy: si un admin
// cambia o quita una fila despues, ningun deploy la vuelve a crear. No
// incluye a ninguno de los clientes borrados en la Fase 134
// (fase134_borrar_clientes_v1): crearlos es un paso aparte, con su OK.
'use strict';

const REGISTRO_INICIAL = [
  {
    nombre: 'ORLANT',
    orden: 1,
    dashboard: 1,
    modulos: [
      'flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'tipificacion', 'calidad',
      'agendas', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas', 'salida',
    ],
    parametros: {
      sedes: [],
      asesorVisibleCliente: false,
      traficoDosHojas: true,
      especificos: ['orlant_pestanas_manuales', 'orlant_resumen_trafico', 'borrado_por_rango'],
      // Fase 174: "no conectada" de las llamadas de salida (DESCRIPTION_COD_ACT).
      salidaNoConectada: ['NO_CONTESTAN', 'BUZON'],
      // Fase 187: la pestaña de salida usa la clasificacion de asesores por cliente (una sola).
      salidaUsaClasificacion: true,
    },
    // Fase 218: logo desde el original de Edwin (sin la linea pequena de
    // texto), blanco para el encabezado teal; 28 px en escritorio, 22 en el celular.
    logo: {
      src: 'img/clientes/orlant-logo.png',
      src2x: 'img/clientes/orlant-logo@2x.png',
      alt: 'Orlant',
      width: 92,
      height: 28,
      alto: 28,
      altoMovil: 22,
    },
  },
  {
    nombre: 'MOBILIZE',
    orden: 2,
    dashboard: 1,
    // Fase 172: calidad_resumen (resumen por asesor de la plantilla de Edwin).
    // Fase 196: flujo_hora (Flujo por hora).
    modulos: ['flujo_llamadas', 'tipificacion', 'calidad', 'calidad_resumen', 'llamadas_unicas', 'flujo_hora', 'encuesta'],
    parametros: {
      sedes: [],
      asesorVisibleCliente: true,
      traficoDosHojas: false,
      especificos: [],
      claseUltimaActualizacion: 'gd-ultima-act-mobilize',
      salidaNoConectada: ['Cliente_no_contesta'], // Fase 174
    },
    logo: {
      src: 'img/clientes/mobilize-logo.png',
      src2x: 'img/clientes/mobilize-logo@2x.png',
      alt: 'Mobilize',
      width: 140,
      height: 25,
    },
  },
];

const SQL_TABLA = `
CREATE TABLE IF NOT EXISTS clientes_registro (
  nombre TEXT PRIMARY KEY,
  orden INTEGER NOT NULL DEFAULT 0,
  dashboard INTEGER NOT NULL DEFAULT 1,
  modulos TEXT NOT NULL DEFAULT '[]',
  parametros TEXT NOT NULL DEFAULT '{}',
  logo TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

function crearTablaRegistro(db) {
  db.exec(SQL_TABLA);
}

// Inserta las filas que falten (INSERT OR IGNORE): nunca pisa una existente.
function sembrarRegistro(db, filas = REGISTRO_INICIAL) {
  const now = new Date().toISOString();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO clientes_registro
       (nombre, orden, dashboard, modulos, parametros, logo, activo, createdAt, updatedAt)
     VALUES (@nombre, @orden, @dashboard, @modulos, @parametros, @logo, 1, @now, @now)`
  );
  const tx = db.transaction((rows) => {
    let n = 0;
    for (const c of rows) {
      n += ins.run({
        nombre: c.nombre,
        orden: c.orden,
        dashboard: c.dashboard ? 1 : 0,
        modulos: JSON.stringify(c.modulos || []),
        parametros: JSON.stringify(c.parametros || {}),
        logo: c.logo ? JSON.stringify(c.logo) : null,
        now,
      }).changes;
    }
    return n;
  });
  return tx(filas);
}

function _json(txt, def) {
  try {
    return txt ? JSON.parse(txt) : def;
  } catch (_) {
    return def;
  }
}

// Clientes activos, en su orden, con los JSON ya leidos.
function leerRegistro(db) {
  return db
    .prepare('SELECT nombre, orden, dashboard, modulos, parametros, logo FROM clientes_registro WHERE activo = 1 ORDER BY orden, nombre')
    .all()
    .map((r) => ({
      nombre: r.nombre,
      orden: r.orden,
      dashboard: r.dashboard === 1,
      modulos: _json(r.modulos, []),
      parametros: _json(r.parametros, {}),
      logo: _json(r.logo, null),
    }));
}

// Equivalente a la vieja CLIENTES_LIST.
function listaClientes(db) {
  return leerRegistro(db).filter((c) => c.dashboard).map((c) => c.nombre);
}

// Equivalente a la vieja CAMPANAS_CALIDAD.
function campanasCalidad(db) {
  return leerRegistro(db).filter((c) => c.modulos.includes('calidad')).map((c) => c.nombre);
}

// Fase 153 (Paso 2): el cliente (rol CLIENTES_DASH) de esta campana ve los
// nombres de asesor (antes la lista fija CAMPANAS_ASESOR_VISIBLE_CLIENTE de
// routes/llamadas-salida.js). Una campana fuera del registro: no.
function asesorVisibleCliente(db, campana) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  return !!c && c.parametros.asesorVisibleCliente === true;
}

// Fase 287 (revision del 07/11, #5): el cliente de esta campaña NO recibe ningun
// nombre de asesor en ninguna respuesta (Calidad, Tipificacion, Salida, Agendas por
// usuaria, resumen de Calidad): se reemplaza por "Asesor 1, 2...". Hoy Clinica Aurora
// y Hospital La Maria (migracion fase287_asesor_oculto_cliente_v1). ORLANT no: su
// cliente sigue viendo «Promedio de calidad por asesor» con nombres (Fase 130).
function asesorOcultoCliente(db, campana) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  return !!c && c.parametros.asesorOcultoCliente === true;
}

// Fase 317 (pedido del supervisor, 10/11): excepcion POR MODULO a asesorOcultoCliente.
// parametros.asesorVisibleClienteModulos = ['agendas_usuaria', ...]: en esos modulos el
// cliente SI ve el nombre real del asesor (como el administrador y el supervisor); en
// todos los demas sigue «Asesor N» / sin agente. Para abrirlo en otra pestaña, agregar
// su id de modulo a la lista (por migracion). Hoy: Clinica Aurora, solo Agendas.
function asesorVisibleClienteEnModulo(db, campana, modulo) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  const lista = c && Array.isArray(c.parametros.asesorVisibleClienteModulos) ? c.parametros.asesorVisibleClienteModulos : [];
  return !!modulo && lista.includes(modulo);
}

// Fase W1 (docs/plan-api-wolkvox.md, sec. 1.2): una campaña INTERNA (parametros.interno
// = true, hoy solo la replica «MOBILIZE PRUEBAS API») la ve y la usa SOLO el administrador
// completo, aunque alguien tenga el permiso marcado. Se revisa en cada funcion de acceso
// (auth.js, clienteAccess) y en las listas. Cualquier fila (activa o no) cuenta.
function esCampanaInterna(db, nombre) {
  if (typeof nombre !== 'string' || !nombre) return false;
  const r = db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ?').get(nombre);
  return !!r && _json(r.parametros, {}).interno === true;
}

// Lo que el navegador necesita para armar sus listas por modulo
// (public/js/registro-clientes.js): sin fechas ni orden interno.
function registroParaNavegador(db) {
  return leerRegistro(db).map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo }));
}

// Fase 285: logo de CLINICA AURORA (se creo por migracion, Fase 153, sin logo). Desde el
// original de Edwin: solo la palabra «aurora» con los rayos (sin la linea de abajo), en
// blanco con fondo transparente para el encabezado teal; 28 px en escritorio, 22 en el celular.
const LOGO_AURORA = {
  src: 'img/clientes/aurora-logo.png',
  src2x: 'img/clientes/aurora-logo@2x.png',
  alt: 'Clínica Aurora',
  width: 95,
  height: 28,
  alto: 28,
  altoMovil: 22,
};

// Fase 354 (reunion con Edwin del 13/11): Hospital La Maria son dos operaciones «juntas
// pero no revueltas». Cada sede es una campaña HIJA (su propio tablero, sus cargas, sus
// skills y sus permisos), asi nada se mezcla: todas las tablas ya separan por campaña.
// El padre (HOSPITAL LA MARIA) guarda en parametros.sedes la lista de sus sedes; cada
// hija guarda parametros.sedeDe (el padre) y sedeEtiqueta. Lo ya cargado en el padre
// queda ahi, visible solo para el administrador como «Sin sede».
const HLM_NOMBRE = 'HOSPITAL LA MARIA';
const HLM_SEDES = [
  { campana: 'HOSPITAL LA MARIA - CASTILLA', etiqueta: 'Sede Castilla', codigo: 'CASTILLA' },
  { campana: 'HOSPITAL LA MARIA - SEDE 33', etiqueta: 'Sede 33', codigo: 'SEDE33' },
];

// ¿Este cliente se divide en sedes? (entonces no se carga nada directo en el: se elige la sede)
function tieneSedes(db, nombre) {
  if (typeof nombre !== 'string' || !nombre) return false;
  const r = db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ?').get(nombre);
  if (!r) return false;
  const s = _json(r.parametros, {}).sedes;
  return Array.isArray(s) && s.some((x) => x && typeof x === 'object' && typeof x.campana === 'string');
}

// Fase 354b (arreglo temporal): mientras las sedes esten vacias, quien ve el padre sigue viendo
// lo cargado antes de separarlas («Datos anteriores»), en solo lectura. Se controla con
// parametros.datosAnteriores = { visible: true|false, etiqueta } del padre; se apaga con una
// migracion (visible: false) cuando agosto este repartido. Sin la opcion: solo el administrador.
function datosAnterioresVisibles(db, nombre) {
  if (typeof nombre !== 'string' || !nombre) return false;
  const r = db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ?').get(nombre);
  const d = r ? _json(r.parametros, {}).datosAnteriores : null;
  return !!(d && d.visible === true);
}

module.exports = {
  REGISTRO_INICIAL,
  datosAnterioresVisibles, // Fase 354b
  HLM_NOMBRE, // Fase 354
  HLM_SEDES, // Fase 354
  tieneSedes, // Fase 354
  LOGO_AURORA,
  asesorVisibleCliente,
  asesorOcultoCliente,
  asesorVisibleClienteEnModulo, // Fase 317
  registroParaNavegador,
  crearTablaRegistro,
  sembrarRegistro,
  leerRegistro,
  listaClientes,
  campanasCalidad,
  esCampanaInterna, // Fase W1
};
