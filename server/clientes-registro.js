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
    },
    logo: {
      src: 'img/clientes/orlant-logo-blanco.png',
      src2x: 'img/clientes/orlant-logo-blanco@2x.png',
      alt: 'Orlant',
      width: 64,
      height: 25,
    },
  },
  {
    nombre: 'MOBILIZE',
    orden: 2,
    dashboard: 1,
    modulos: ['flujo_llamadas', 'tipificacion', 'calidad', 'llamadas_unicas', 'encuesta'],
    parametros: {
      sedes: [],
      asesorVisibleCliente: true,
      traficoDosHojas: false,
      especificos: [],
      claseUltimaActualizacion: 'gd-ultima-act-mobilize',
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

module.exports = {
  REGISTRO_INICIAL,
  crearTablaRegistro,
  sembrarRegistro,
  leerRegistro,
  listaClientes,
  campanasCalidad,
};
