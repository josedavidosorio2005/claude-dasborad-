// salida.js — Llamadas y WhatsApp de Salida de ORLANT (Fase 127, pedido
// textual de Edwin: "que sea simplemente el mes y la cantidad... las
// llamadas de salida están muy bajas"). Archivo real de Edwin:
// FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx — un total AGREGADO por
// mes, ya separado por línea (3P/General) y canal (llamadas/WhatsApp),
// nunca una fila por llamada/chat. Mismo patrón exacto que
// efectividad-citas.js (reemplazo por MES, escritura+lectura).
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays) -- debe coincidir EXACTO con
// SALIDA_ORDEN_ARRAY (public/js/salida-logic.js) y con
// salidaFilaArraySchema (validation.js). El mes YA viene resuelto a
// 'AAAA-MM' (el navegador le agrega el año que el usuario confirmo en el
// modal de impacto -- el archivo de Edwin nunca trae año, ver
// salida-logic.js) -- el servidor nunca adivina un año.
const CAMPOS_FILA = ['mes', 'llamadas3p', 'llamadasGeneral', 'wpp3p', 'wppGeneral'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

function mesesDelArchivo(filasObj) {
  const set = new Set(filasObj.map((f) => f.mes));
  return Array.from(set).sort();
}

function impactoSalida(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);
  if (!meses.length) return { meses: [], filasExistentes: 0, filasNuevas: 0 };
  const placeholders = meses.map(() => '?').join(',');
  const existentes = db
    .prepare(`SELECT COUNT(*) AS n FROM salida_mensual WHERE campana = ? AND mes IN (${placeholders})`)
    .get(campana, ...meses).n;
  return { meses, filasExistentes: existentes, filasNuevas: filasObj.length };
}

function cargarSalida(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);

  const insert = db.prepare(
    `INSERT INTO salida_mensual
       (campana, mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@llamadas3p,@llamadasGeneral,@wpp3p,@wppGeneral,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    if (meses.length) {
      const placeholders = meses.map(() => '?').join(',');
      // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
      respaldarAntesDeCambiar(db, 'salida_mensual', { campana, meses, guardadoPorNombre: cargadoPorNombre });
      borradas = db.prepare(`DELETE FROM salida_mensual WHERE campana = ? AND mes IN (${placeholders})`).run(campana, ...meses).changes;
    }
    for (const f of filasObj) {
      insert.run({
        campana,
        mes: f.mes, llamadas3p: f.llamadas3p, llamadasGeneral: f.llamadasGeneral,
        wpp3p: f.wpp3p, wppGeneral: f.wppGeneral,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, meses };
}

// Valores distintos de Mes + si hay datos -- tambien lo usa el dashboard
// para decidir si la pestaña "Salida" tiene algo que mostrar (mismo
// criterio que Efectividad de Citas: aparece sola cuando hay datos).
// Fase 170: los meses incluyen los que solo tienen CDR (salida-cdr.js).
function salidaOpciones(db, campana) {
  return {
    meses: require('./salida-cdr').salidaCombinadaPorMes(db, campana).map((f) => f.mes),
  };
}

// Todos los meses con datos, ordenados -- sin filtros (un total por mes,
// ya separado por linea/canal).
// Fase 170: por canal, el CDR (Tipificacion) manda en los meses que lo
// tienen; el resto sale del archivo mensual. Ver salida-cdr.js.
function salidaPorMes(db, campana) {
  return require('./salida-cdr').salidaCombinadaPorMes(db, campana);
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  mesesDelArchivo,
  impactoSalida,
  cargarSalida,
  salidaOpciones,
  salidaPorMes,
};
