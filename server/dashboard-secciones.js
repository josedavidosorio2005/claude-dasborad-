// dashboard-secciones.js — Que datos operativos necesita cada dashboard de
// cliente y en que forma se cargan por Excel (plantilla propia).
//
// Fase 2 (REAL_DATA_REPORT.md): los dashboards dejan de tener datos de ejemplo
// hardcodeados. Cada "seccion" de un dashboard se llena con una carga de Excel
// (GET/POST /api/dashboard/cargas). Una carga = un archivo para (cliente,
// seccion, periodo); volver a subir el mismo periodo lo reemplaza.
//
//  - filaUnica:true  -> el mes tiene un unico juego de valores. La plantilla es
//    vertical: dos columnas "metrica | valor", una fila por columna definida.
//  - filaUnica:false -> varias filas (por dia, por tipificacion, por categoria).
//    La plantilla es horizontal: una columna por `key`, N filas.
//
// tipo: 'entero' | 'decimal' | 'porcentaje' (0-100) | 'texto' | 'fecha' (AAAA-MM-DD)

'use strict';

const { fechaLimitesEsFutura, fechaLimitesFinDeMesActual } = require('./fecha-limites');

const SECCIONES = {
  ORLANT: {
    resumen: {
      titulo: 'Resumen mensual (KPIs y tendencias)',
      descripcion:
        'Un valor por mes para el tablero de KPIs y las graficas de tendencia (flujo, agendamiento, inasistencia, STA, efectividad).',
      cadencia: 'mensual',
      periodo: 'mes', // AAAA-MM
      filaUnica: true,
      // Fase 71: las 7 metricas de trafico (autoTrafico:true) ya NO se piden
      // en la plantilla ni en las INSTRUCCIONES (cargas.js filtra columnas
      // autoTrafico al generar el archivo descargable) -- se calculan solas
      // todos los meses desde Trafico de Llamadas/WhatsApp
      // (resumen-orlant-trafico.js), igual que ya pasaba desde la Fase 39
      // con las 4 de Llamadas. opcional:true es necesario ademas para que el
      // servidor (normalizarFilas) acepte un archivo que no las traiga. Un
      // archivo VIEJO que todavia las traiga sigue cargando igual: el valor
      // se ignora con un aviso en la vista previa (cargasParseFilaUnica,
      // cargas-logic.js), nunca pisa lo que ya calculo Trafico.
      notasExtra: [
        'Las 7 metricas de trafico (Llamadas 3P/Linea General, WhatsApp 3P/Linea General, ' +
          'Nivel Atencion 3P/WhatsApp 3P/Linea General) NO estan en esta hoja: se calculan solas, ' +
          'todos los meses, desde Trafico de Llamadas y Trafico de WhatsApp -- no hace falta llenarlas ' +
          'a mano (evita el trabajo doble y que los numeros no cuadren entre las dos cargas).',
      ],
      columnas: [
        { key: 'llamadas_3p', label: 'Llamadas 3P', tipo: 'entero', opcional: true, autoTrafico: true },
        { key: 'wpp_3p', label: 'WhatsApp 3P', tipo: 'entero', opcional: true, autoTrafico: true },
        { key: 'llamadas_general', label: 'Llamadas Linea General', tipo: 'entero', opcional: true, autoTrafico: true },
        { key: 'wpp_general', label: 'WhatsApp Linea General', tipo: 'entero', opcional: true, autoTrafico: true },
        { key: 'nivel_atencion_3p', label: 'Nivel Atencion 3P (%)', tipo: 'porcentaje', opcional: true, autoTrafico: true },
        { key: 'nivel_atencion_wpp_3p', label: 'Nivel Atencion WhatsApp 3P (%)', tipo: 'porcentaje', opcional: true, autoTrafico: true },
        { key: 'nivel_atencion_general', label: 'Nivel Atencion Linea General (%)', tipo: 'porcentaje', opcional: true, autoTrafico: true },
        { key: 'ordmed_gestionados', label: 'Ordenes medicas gestionadas', tipo: 'entero' },
        { key: 'ordmed_agendas', label: 'Ordenes medicas que agendaron', tipo: 'entero' },
        { key: 'recup_cancelado', label: 'Citas canceladas (recuperacion)', tipo: 'entero' },
        { key: 'recup_atendido', label: 'Citas canceladas recuperadas/atendidas', tipo: 'entero' },
        { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
        { key: 'agendas_general', label: 'Agendas Linea General', tipo: 'entero' },
        { key: 'agendas_3p', label: 'Agendas Linea 3P', tipo: 'entero' },
        // Fase 98 tema C: superadas por la pestaña "Inasistencia" real
        // (tabla `inasistencias`, server/inasistencia.js) -- ya NO se piden
        // en la plantilla ni en las INSTRUCCIONES (cargas.js filtra columnas
        // `ocultaEnPlantilla` al generar el archivo descargable, mismo
        // mecanismo que `autoTrafico`), para que no haya 2 fuentes de la
        // misma metrica. `opcional:true` es necesario ademas para que el
        // servidor (normalizarFilas) acepte un archivo que no las traiga. Un
        // archivo VIEJO que todavia las traiga sigue cargando igual
        // (compatibilidad hacia atras) -- el valor se guarda tal cual,
        // aunque ya nada lo muestre en el dashboard.
        { key: 'inasist_audifonos', label: '% Inasistencia Audifonos', tipo: 'porcentaje', opcional: true, ocultaEnPlantilla: true },
        { key: 'inasist_audiologia', label: '% Inasistencia Audiologia', tipo: 'porcentaje', opcional: true, ocultaEnPlantilla: true },
        { key: 'inasist_examenes', label: '% Inasistencia Examenes', tipo: 'porcentaje', opcional: true, ocultaEnPlantilla: true },
        { key: 'inasist_total', label: '% Inasistencia Total', tipo: 'porcentaje', opcional: true, ocultaEnPlantilla: true },
        { key: 'sta_ordenes', label: 'STA — Ordenes cargadas', tipo: 'entero' },
        { key: 'sta_agendadas', label: 'STA — Agendadas', tipo: 'entero', opcional: true },
        { key: 'sta_factcump', label: 'STA — Facturado + Cumplida', tipo: 'entero' },
        // Fase 111 (pedido textual de InCo): superadas por la pestaña
        // "Efectividad de Citas" real (tabla `efectividad_citas`,
        // server/efectividad-citas.js) -- ya NO se piden en la plantilla ni
        // en las INSTRUCCIONES (mismo mecanismo `ocultaEnPlantilla` que
        // inasist_audifonos/etc., Fase 98 tema C). Un archivo VIEJO que
        // todavia las traiga sigue cargando igual (compatibilidad hacia
        // atras), aunque ya nada las muestre en el dashboard.
        { key: 'citas_para_mes', label: 'Citas programadas para el mes', tipo: 'entero', opcional: true, ocultaEnPlantilla: true },
        { key: 'citas_atendidas', label: 'Citas atendidas', tipo: 'entero', opcional: true, ocultaEnPlantilla: true },
      ],
    },

    salida: {
      titulo: 'Llamadas y WhatsApp de salida (por dia)',
      descripcion:
        'Una fila por dia. Se puede subir dia a dia (cadencia diaria) o el mes completo en un archivo.',
      cadencia: 'diaria',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'salida_general', label: 'Llamadas salida Linea General', tipo: 'entero' },
        { key: 'salida_3p', label: 'Llamadas salida 3P', tipo: 'entero' },
        { key: 'wpp_salida_general', label: 'WhatsApp salida Linea General', tipo: 'entero' },
        { key: 'wpp_salida_3p', label: 'WhatsApp salida 3P', tipo: 'entero' },
      ],
    },

    tipificacion: {
      titulo: 'Tipificacion (Llamada 3P y General)',
      descripcion: 'Una fila por tipificacion y linea, con la cantidad del mes.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'linea', label: 'Linea (3P / GENERAL)', tipo: 'texto' },
        { key: 'tipificacion', label: 'Tipificacion', tipo: 'texto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
      ],
    },

    sta_categorias: {
      titulo: 'Gestion STA — por servicio, estado y mes actual',
      descripcion:
        'Una fila por categoria. dimension: SERVICIO (ordenes por servicio), ESTADO (ordenes por estado) o MES_ACTUAL (detalle del mes por tipo).',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'dimension', label: 'Dimension (SERVICIO / ESTADO / MES_ACTUAL)', tipo: 'texto' },
        { key: 'categoria', label: 'Categoria', tipo: 'texto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
        { key: 'agendas', label: 'Agendas (solo MES_ACTUAL)', tipo: 'entero', opcional: true },
      ],
    },
  },
};

const CADENCIAS = ['diaria', 'semanal', 'mensual'];

// Valida el formato de `periodo` segun el tipo de la seccion.
function periodoValido(periodoTipo, valor) {
  if (typeof valor !== 'string') return false;
  if (periodoTipo === 'mes') return /^\d{4}-\d{2}$/.test(valor);
  if (periodoTipo === 'dia') return /^\d{4}-\d{2}-\d{2}$/.test(valor);
  if (periodoTipo === 'semana') return /^\d{4}-W\d{2}$/.test(valor);
  return false;
}

// Normaliza y valida las filas de una carga contra la definicion de la seccion:
//  - descarta columnas que no estan en la definicion
//  - convierte tipos (entero/decimal/porcentaje -> numero; texto -> string; fecha -> AAAA-MM-DD)
//  - exige las columnas no opcionales
//  - filaUnica -> exactamente 1 fila
// Devuelve { ok, filas, errores:[...] }.
function normalizarFilas(spec, filas) {
  const errores = [];
  if (!Array.isArray(filas) || filas.length === 0) {
    return { ok: false, filas: [], errores: ['El archivo no tiene filas de datos'] };
  }
  if (spec.filaUnica && filas.length !== 1) {
    errores.push('Esta seccion espera un unico juego de valores (una fila)');
  }

  const out = [];
  filas.forEach((fila, i) => {
    const nfila = {};
    spec.columnas.forEach((col) => {
      const raw = fila[col.key];
      const vacio = raw === undefined || raw === null || raw === '';
      if (vacio) {
        if (!col.opcional) errores.push(`Fila ${i + 1}: falta "${col.label}"`);
        else if (col.tipo === 'texto') nfila[col.key] = '';
        else nfila[col.key] = 0;
        return;
      }
      if (col.tipo === 'texto') {
        nfila[col.key] = String(raw).trim();
      } else if (col.tipo === 'fecha') {
        const s = String(raw).trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          errores.push(`Fila ${i + 1}: "${col.label}" debe ser AAAA-MM-DD (recibido "${raw}")`);
        } else if (fechaLimitesEsFutura(s)) {
          // Fase 86 (tema 2, hallazgo real Fase 85): defensa en el servidor
          // contra fechas futuras -- nunca "posterior a hoy" (ver
          // fecha-limites.js), asi una fila con fecha mal digitada nunca
          // corre la ventana por defecto de otro panel a un mes vacio.
          errores.push(`Fila ${i + 1}: "${col.label}" esta en el futuro (recibido "${s}", posterior al ${fechaLimitesFinDeMesActual()})`);
        } else {
          nfila[col.key] = s;
        }
      } else {
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(n)) {
          errores.push(`Fila ${i + 1}: "${col.label}" debe ser un numero (recibido "${raw}")`);
        } else if (col.tipo === 'porcentaje' && (n < 0 || n > 100)) {
          errores.push(`Fila ${i + 1}: "${col.label}" debe estar entre 0 y 100 (recibido ${n})`);
        } else {
          nfila[col.key] = col.tipo === 'entero' ? Math.round(n) : Math.round(n * 100) / 100;
        }
      }
    });
    out.push(nfila);
  });

  return { ok: errores.length === 0, filas: out, errores };
}

function getSeccion(cliente, seccion) {
  const c = SECCIONES[cliente];
  return c ? c[seccion] || null : null;
}

function clientesConSecciones() {
  return Object.keys(SECCIONES);
}

module.exports = {
  SECCIONES,
  CADENCIAS,
  periodoValido,
  getSeccion,
  clientesConSecciones,
  normalizarFilas,
};
