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

const SECCIONES = {
  ORLANT: {
    resumen: {
      titulo: 'Resumen mensual (KPIs y tendencias)',
      descripcion:
        'Un valor por mes para el tablero de KPIs y las graficas de tendencia (flujo, agendamiento, inasistencia, STA, efectividad).',
      cadencia: 'mensual',
      periodo: 'mes', // AAAA-MM
      filaUnica: true,
      columnas: [
        { key: 'llamadas_3p', label: 'Llamadas 3P', tipo: 'entero' },
        { key: 'wpp_3p', label: 'WhatsApp 3P', tipo: 'entero' },
        { key: 'llamadas_general', label: 'Llamadas Linea General', tipo: 'entero' },
        { key: 'wpp_general', label: 'WhatsApp Linea General', tipo: 'entero' },
        { key: 'nivel_atencion_3p', label: 'Nivel Atencion 3P (%)', tipo: 'porcentaje' },
        { key: 'nivel_atencion_wpp_3p', label: 'Nivel Atencion WhatsApp 3P (%)', tipo: 'porcentaje' },
        { key: 'nivel_atencion_general', label: 'Nivel Atencion Linea General (%)', tipo: 'porcentaje' },
        { key: 'ordmed_gestionados', label: 'Ordenes medicas gestionadas', tipo: 'entero' },
        { key: 'ordmed_agendas', label: 'Ordenes medicas que agendaron', tipo: 'entero' },
        { key: 'recup_cancelado', label: 'Citas canceladas (recuperacion)', tipo: 'entero' },
        { key: 'recup_atendido', label: 'Citas canceladas recuperadas/atendidas', tipo: 'entero' },
        { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
        { key: 'agendas_general', label: 'Agendas Linea General', tipo: 'entero' },
        { key: 'agendas_3p', label: 'Agendas Linea 3P', tipo: 'entero' },
        { key: 'inasist_audifonos', label: '% Inasistencia Audifonos', tipo: 'porcentaje' },
        { key: 'inasist_audiologia', label: '% Inasistencia Audiologia', tipo: 'porcentaje' },
        { key: 'inasist_examenes', label: '% Inasistencia Examenes', tipo: 'porcentaje' },
        { key: 'inasist_total', label: '% Inasistencia Total', tipo: 'porcentaje' },
        { key: 'sta_ordenes', label: 'STA — Ordenes cargadas', tipo: 'entero' },
        { key: 'sta_agendadas', label: 'STA — Agendadas', tipo: 'entero', opcional: true },
        { key: 'sta_factcump', label: 'STA — Facturado + Cumplida', tipo: 'entero' },
        { key: 'citas_para_mes', label: 'Citas programadas para el mes', tipo: 'entero' },
        { key: 'citas_atendidas', label: 'Citas atendidas', tipo: 'entero' },
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

  'CLINICA AURORA': {
    resumen: {
      titulo: 'Resumen mensual (KPIs y tendencias)',
      descripcion:
        'Un valor por mes: alimenta el tablero de KPIs, la pestaña Manager (Manager/Wolkvox/errores/histórico) y la línea de inasistencia.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: true,
      columnas: [
        { key: 'nivel_atencion', label: 'Nivel de atencion (%)', tipo: 'porcentaje' },
        { key: 'abandonos', label: 'Abandonos (llamadas)', tipo: 'entero' },
        { key: 'aht_segundos', label: 'AHT promedio (segundos)', tipo: 'entero' },
        { key: 'nivel_atencion_wpp', label: 'Nivel de atencion WhatsApp (%)', tipo: 'decimal' },
        { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
        { key: 'efectividad', label: 'Efectividad de citas (%)', tipo: 'porcentaje' },
        { key: 'hist_llamadas', label: 'Llamadas de entrada (total mes)', tipo: 'entero' },
        { key: 'hist_whatsapp', label: 'WhatsApp de entrada (total mes)', tipo: 'entero' },
        { key: 'llamadas_salida', label: 'Llamadas de salida (total mes)', tipo: 'entero' },
        { key: 'wpp_salida', label: 'WhatsApp de salida (total mes)', tipo: 'entero' },
        { key: 'agendas_manager', label: 'Agendas segun Manager', tipo: 'entero' },
        { key: 'agendas_wolkvox', label: 'Agendas segun Wolkvox', tipo: 'entero' },
        { key: 'errores_gestion', label: 'Errores de gestion', tipo: 'entero' },
        { key: 'inasistencia_pct', label: '% Inasistencia del mes', tipo: 'porcentaje' },
      ],
    },
    llamadas: {
      titulo: 'Entrada por dia (llamadas y WhatsApp)',
      descripcion: 'Una fila por dia con los indicadores de entrada.',
      cadencia: 'diaria',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'llamadas_ingresadas', label: 'Llamadas ingresadas', tipo: 'entero' },
        { key: 'pct_contestadas', label: '% Contestadas', tipo: 'porcentaje' },
        { key: 'pct_abandonadas', label: '% Abandonadas', tipo: 'porcentaje' },
        { key: 'aht_segundos', label: 'AHT (segundos)', tipo: 'entero' },
        { key: 'wpp_ingresados', label: 'WhatsApp ingresados', tipo: 'entero' },
      ],
    },
    salida: {
      titulo: 'Salida por dia (llamadas y WhatsApp)',
      descripcion: 'Una fila por dia.',
      cadencia: 'diaria',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'llamadas_salida', label: 'Llamadas de salida', tipo: 'entero' },
        { key: 'wpp_salida', label: 'WhatsApp de salida', tipo: 'entero' },
      ],
    },
    agendas: {
      titulo: 'Agendas por dia (via llamada / WhatsApp)',
      descripcion: 'Una fila por dia. El total se calcula solo.',
      cadencia: 'diaria',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'agendas_llamada', label: 'Agendas via llamada', tipo: 'entero' },
        { key: 'agendas_whatsapp', label: 'Agendas via WhatsApp', tipo: 'entero' },
      ],
    },
    tipificacion: {
      titulo: 'Tipificacion y encuestas',
      descripcion:
        'Una fila por tipificacion. canal: LLAMADA_ENTRADA, LLAMADA_SALIDA, WPP_ENTRADA, WPP_SALIDA o ENCUESTAS.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'canal', label: 'Canal', tipo: 'texto' },
        { key: 'tipificacion', label: 'Tipificacion / estado', tipo: 'texto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
      ],
    },
    agendas_categorias: {
      titulo: 'Agendas por especialidad / asesor / inasistencia',
      descripcion:
        'Una fila por categoria. dimension: ESPECIALIDAD (agendas), ASESOR (agendas) o INASISTENCIA_ESPECIALIDAD (% inasistencia).',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'dimension', label: 'Dimension (ESPECIALIDAD / ASESOR / INASISTENCIA_ESPECIALIDAD)', tipo: 'texto' },
        { key: 'categoria', label: 'Categoria', tipo: 'texto' },
        { key: 'valor', label: 'Valor (agendas, o % si es inasistencia)', tipo: 'decimal' },
      ],
    },
    sabados: {
      titulo: 'Sabados (llamadas y WhatsApp)',
      descripcion: 'Una fila por sabado del mes.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'llamadas', label: 'Llamadas', tipo: 'entero' },
        { key: 'whatsapp', label: 'WhatsApp', tipo: 'entero' },
      ],
    },
  },

  'HOSPITAL LA MARIA': {
    resumen: {
      titulo: 'Resumen mensual por sede (KPIs)',
      descripcion:
        'Una fila por sede (CASTILLA / SEDE33) con los totales del mes para el tablero de KPIs.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'sede', label: 'Sede (CASTILLA / SEDE33)', tipo: 'texto' },
        { key: 'llamadas_ingresadas', label: 'Llamadas ingresadas', tipo: 'entero' },
        { key: 'nivel_atencion', label: 'Nivel de atencion (%)', tipo: 'porcentaje' },
        { key: 'llamadas_contestadas', label: 'Llamadas contestadas', tipo: 'entero' },
        { key: 'llamadas_abandonadas', label: 'Llamadas abandonadas', tipo: 'entero' },
        { key: 'wpp_ingresados', label: 'WhatsApp ingresados', tipo: 'entero' },
        { key: 'agendas_wpp', label: 'Agendas via WhatsApp', tipo: 'entero' },
        { key: 'agendas_llamada', label: 'Agendas via llamada', tipo: 'entero' },
        { key: 'aht_segundos', label: 'AHT promedio (segundos)', tipo: 'entero' },
        { key: 'llamadas_salida', label: 'Llamadas de salida (SEDE33)', tipo: 'entero', opcional: true },
        { key: 'wpp_salida', label: 'WhatsApp de salida (SEDE33)', tipo: 'entero', opcional: true },
      ],
    },
    dia: {
      titulo: 'Indicadores por dia y sede',
      descripcion: 'Una fila por dia y sede. Se puede subir dia a dia o el mes completo.',
      cadencia: 'diaria',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' },
        { key: 'sede', label: 'Sede (CASTILLA / SEDE33)', tipo: 'texto' },
        { key: 'llamadas_ingresadas', label: 'Llamadas ingresadas', tipo: 'entero' },
        { key: 'pct_contestadas', label: '% Contestadas', tipo: 'porcentaje' },
        { key: 'pct_abandonadas', label: '% Abandonadas', tipo: 'porcentaje' },
        { key: 'wpp_ingresados', label: 'WhatsApp ingresados / salida', tipo: 'entero' },
        { key: 'aht_segundos', label: 'AHT (segundos)', tipo: 'entero' },
        { key: 'agendas_wpp', label: 'Agendas via WhatsApp', tipo: 'entero' },
        { key: 'agendas_llamada', label: 'Agendas via llamada', tipo: 'entero' },
      ],
    },
    tipificacion: {
      titulo: 'Tipificacion por sede',
      descripcion: 'Una fila por tipificacion y sede.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'sede', label: 'Sede (CASTILLA / SEDE33)', tipo: 'texto' },
        { key: 'tipificacion', label: 'Tipificacion', tipo: 'texto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
      ],
    },
    demanda: {
      titulo: 'Demanda insatisfecha (solo Castilla)',
      descripcion:
        'Una fila por categoria. dimension: IVR (llamadas IVR sin agenda) o ESPECIALIDAD (demanda por especialidad).',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'sede', label: 'Sede (CASTILLA / SEDE33)', tipo: 'texto' },
        { key: 'dimension', label: 'Dimension (IVR / ESPECIALIDAD)', tipo: 'texto' },
        { key: 'categoria', label: 'Categoria', tipo: 'texto' },
        { key: 'llamadas', label: 'Llamadas', tipo: 'entero' },
        { key: 'whatsapp', label: 'WhatsApp', tipo: 'entero', opcional: true },
      ],
    },
    entidades: {
      titulo: 'Flujo por entidad (EPS) y sede',
      descripcion: 'Una fila por entidad, canal (LLAMADA / WPP) y sede.',
      cadencia: 'mensual',
      periodo: 'mes',
      filaUnica: false,
      columnas: [
        { key: 'sede', label: 'Sede (CASTILLA / SEDE33)', tipo: 'texto' },
        { key: 'canal', label: 'Canal (LLAMADA / WPP)', tipo: 'texto' },
        { key: 'entidad', label: 'Entidad', tipo: 'texto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
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
