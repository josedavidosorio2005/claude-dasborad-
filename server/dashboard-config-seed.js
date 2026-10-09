// dashboard-config-seed.js — Configuracion (datos, no codigo) de cada dashboard
// de cliente. Fase 3 (REAL_DATA_REPORT.md).
//
// Un dashboard = { cliente, titulo, vista?, secciones, layout }
//   secciones : plantillas de carga por Excel (igual que Fase 2) — de aqui salen
//               las plantillas y la validacion.
//   vista     : selector superior que filtra todos los paneles por una columna
//               (ej. sede en Hospital La Maria). null si no aplica.
//   layout    : { kpis:[...], tabs:[{ key, label, panels:[...] }] }
//
// Tipos de panel: kpi_row | line | bar | pie | combo | tabla | calidad_kpis | calidad_pie
//
// "fuente" (de donde sale el dato de un panel):
//   { s:'<seccion>', modo:'serie'|'ultimo'|'filas'|'agregado', ... }
//     serie   -> un punto por periodo (grafica de tendencia mensual)
//     ultimo  -> el valor del ultimo periodo <= el mes seleccionado (KPI escalar)
//     filas   -> todas las filas de la carga del mes (x = etiqueta, campo = valor)
//     agregado-> suma/promedio de `campos` sobre las filas de la carga (KPI escalar)
//   campo    : columna a leer.   x : columna de etiqueta (filas).
//   formula  : 'a/b*100' con a,b = nombres de columna (dato derivado).
//   filtro   : { columna: valor } igualdad exacta sobre las filas.
//   op       : 'suma' | 'promedio' (modo agregado).

'use strict';

const { SECCIONES } = require('./dashboard-secciones');

// ── Helpers para escribir el layout de forma compacta ────────
const serie = (campo, extra) => ({ s: 'resumen', modo: 'serie', campo, ...(extra || {}) });
const ultimo = (campo, extra) => ({ s: 'resumen', modo: 'ultimo', campo, ...(extra || {}) });
const pctFormula = (a, b, base) => ({ ...(base || { s: 'resumen', modo: 'serie' }), formula: 'a/b*100', a, b });
const lineP = (titulo, campo, extra) => ({ tipo: 'line', titulo, series: [{ label: titulo, fuente: serie(campo) }], ...(extra || {}) });
const kpi = (titulo, fuente, formato, extra) => ({ titulo, fuente, formato: formato || 'entero', ...(extra || {}) });

// ── ORLANT ──────────────────────────────────────────────────
const ORLANT = {
  cliente: 'ORLANT',
  titulo: 'Dashboard Clínica Orlant',
  vista: null,
  secciones: SECCIONES.ORLANT,
  layout: {
    // Fase 68, Pedido 2 (Edwin, 23/09): se quita la franja superior de KPIs
    // de ORLANT -- Llamadas/Nivel de Atencion ya estan abajo en Trafico de
    // Llamadas (filtrables por linea, Fase 65); Total Agendas volvera
    // cuando se grafiquen agendas; las demas no se usan asi. SOLO ORLANT --
    // los demas clientes conservan su franja tal cual (renderGenericKpis,
    // dashboard-generic.js, ya trata un array vacio como "sin franja",
    // limpio). No se borra ningun dato: lo que se carga en la hoja
    // "resumen" se sigue guardando igual (routes/dashboards.js,
    // POST /dashboard/cargas, sin cambios) -- sirve para las graficas de
    // agendas/inasistencia que vienen despues. Si esta config ya estaba
    // sembrada en produccion por una migracion anterior, ver la migracion
    // idempotente en db.js (mismo patron que las Fases 54/59/65).
    kpis: [],
    tabs: [
      // Fase 40 (2026-09-21): "una grafica por pestana" -- `subtabs` agrupa
      // los indices del mismo array `panels` de siempre en sub-pestanas
      // (patron `.aurora-tabs`/`.atab` de la Fase 37, dashboard-generic.js);
      // no se creo grafica nueva ni se toco ningun calculo.
      //
      // Fase 40b (2026-09-21): `oculta: true` (dashboard-generic.js) saca un
      // tab del menu de pestanas SIN borrar nada -- panels/subtabs/datos/
      // calculos quedan intactos, solo no se renderiza su boton ni puede
      // quedar como pestana activa por defecto. Revertir = quitar
      // `oculta: true` de la pestana correspondiente.
      //
      // Fase 94 (tema A, pedido de Edwin): orden de las pestañas VISIBLES
      // (las `oculta:true` no aparecen en el menu, pero su posicion en este
      // array SI importa para cuando se destapan en memoria -- Agendamiento,
      // Inasistencia, Tipificacion y Salida, ver _gdBootstrap en
      // dashboard-generic.js): Trafico de Llamadas -> Trafico de WhatsApp ->
      // Llamadas y WhatsApp de salida (Fase 128, Parte 1 -- antes "Salida" al
      // final) -> Agendamiento -> Inasistencia (Fase 98) -> Tipificacion ->
      // Calidad. La pestaña activa por defecto es SIEMPRE la primera VISIBLE
      // del array (renderGenericTabs/_gdBootstrap toman
      // `_gdTabsVisibles()[0]`) -- por eso 'trafico' va primero: ninguna de
      // las autonomas puede ganarle el primer lugar aunque se destape antes
      // de que el usuario mire, porque siguen despues en este mismo array.
      // Las pestañas ocultas restantes (Ordenamiento Medico, Recuperacion de
      // Cancelados, Flujo, Gestion STA, Efectividad Citas) van al final, en
      // cualquier orden (no aparecen en el menu, su posicion no importa).
      // Ver las migraciones idempotentes
      // dashboards_config_orlant_orden_pestanas_v1/_v2 y
      // dashboards_config_orlant_salida_label_orden_v1 en db.js --
      // produccion ya tenia dashboards_config sembrado, este orden nuevo del
      // seed nunca le habria llegado solo.
      { key: 'trafico', label: 'Tráfico de Llamadas', panels: [
        { tipo: 'trafico_combo', campana: 'ORLANT' },
      ]},
      // Fase 50 (plantilla real confirmada por Edwin): datos por COLA y
      // PERIODO (fechaInicio..fechaFin), no diarios -- panel propio
      // (trafico_whatsapp_combo, ver public/js/trafico-whatsapp.js), mismo
      // patron de integracion que trafico_combo pero con su propia tabla
      // (trafico_whatsapp, db.js) y su propio endpoint. Si esta pestaña ya
      // existe en una base sembrada antes de este cambio, ver la migracion
      // dashboards_config_orlant_trafico_whatsapp_tab_v1 en db.js.
      //
      // Fase 120 (decision de InCo, autorizada): Wolkvox NUNCA entrega AHT
      // para WhatsApp (confirmado contra 2 archivos reales distintos: 258
      // filas, columna AHT siempre "----") -- la sub-pestaña "AHT" quedaba
      // en blanco sin ningun mensaje. `mostrarAht:false` apaga esa
      // sub-pestaña + la tarjeta "AHT Promedio" + la columna "AHT (seg)"
      // de los exports, SOLO en WhatsApp (Trafico de Llamadas/voz sigue
      // con `trafico_combo` de arriba, sin este campo -- ahi SI hay dato).
      // El lector de WhatsApp (trafico-whatsapp-logic.js) sigue leyendo
      // una columna AHT numerica si algun dia Wolkvox la entrega -- para
      // reactivar la sub-pestaña, basta con quitar este campo (o ponerlo
      // en `true`) vía PUT /dashboards/config/ORLANT, sin tocar código.
      // Ver migracion dashboards_config_orlant_whatsapp_sin_aht_v1 en
      // db.js para una base ya sembrada antes de este cambio.
      // Fase 126 (pedido de Edwin): el Nivel de Servicio a 5 minutos sigue
      // sin dato real (Wolkvox todavia no manda SERVICE_LEVEL_5MIN) --
      // `mostrarSL5min:false` apaga esa tarjeta/serie + la columna del
      // export, mismo patron EXACTO que `mostrarAht` arriba. El SL a 20s
      // (que SI llega real) pasa a ser el nivel de servicio PRINCIPAL en
      // vez de quedar como secundario -- se ve igual que si WhatsApp
      // nunca hubiera tenido el campo de 5 min. Ver migracion
      // dashboards_config_orlant_whatsapp_sin_sl5min_v1 en db.js para una
      // base ya sembrada antes de este cambio.
      { key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp', panels: [
        { tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: false, mostrarSL5min: false },
      ]},
      // Fase 128 (Parte 1, pedido textual de Edwin en la reunion de
      // validacion: "Salida" no se entendia como concepto -- se renombra a
      // "Llamadas y WhatsApp de salida" (pestaña + titulo del panel +
      // exports + guia + checklist, server/dashboard-config-seed.js,
      // public/js/salida.js, public/js/dashboard-generic.js) y se reubica
      // aqui, justo despues de "Tráfico de WhatsApp" (antes vivia al final,
      // junto a las pestañas sin base propia -- ya no corresponde, "Salida"
      // SI tiene base real desde la Fase 127). Sigue oculta por defecto
      // (destapada en memoria solo cuando ya hay datos, _gdBootstrap,
      // dashboard-generic.js) -- migracion idempotente
      // dashboards_config_orlant_salida_label_orden_v1 en db.js para quien
      // ya tenia esta config sembrada con el nombre/posicion viejos.
      { key: 'salida', label: 'Llamadas y WhatsApp de salida', oculta: true, panels: [
        { tipo: 'salida_panel', campana: 'ORLANT', titulo: 'Llamadas y WhatsApp de salida' },
      ]},
      // Fase 94 (tema B, pedido de Edwin): Agendamiento queda SOLO con datos
      // reales de la tabla `agendas` (server/agendas.js) -- 4 sub-pestañas
      // que comparten los MISMOS filtros (mes/rango/asesor/sede/examen/
      // especialidad/profesional/tipoLinea/entidad, ver public/js/agendas.js).
      // Cada sub-pestaña es su PROPIO panel `agendas_panel` con un `vista`
      // distinto (especialidad/mensual/linea/agente) -- el componente
      // renderiza la fila de filtros compartida (estado por CAMPANA, no por
      // indice de panel, asi los 4 quedan sincronizados entre si) mas UNA
      // sola grafica, la de su `vista`. "Ordenamiento Médico" y
      // "Recuperación de Cancelados" (hoja "resumen", vacia -- Edwin dijo
      // que son procesos distintos que se montan despues) salen a sus
      // propias pestañas ocultas, MAS ABAJO, sin borrar su configuracion.
      // "Variación % Agendas" se quita del todo (pedido explicito). Ver la
      // migracion idempotente dashboards_config_orlant_agendamiento_edwin_v1
      // en db.js.
      { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [
        // SIEMPRE primer panel/subtab: dashboard-generic.js destapa este
        // tab en memoria SOLO cuando hay agendas cargadas (_gdBootstrap),
        // sin tocar el `oculta` guardado aqui -- asi el admin siempre
        // aterriza en esta sub-pestana cuando el tab recien se vuelve
        // visible, nunca en una vacia.
        { tipo: 'agendas_panel', vista: 'especialidad', titulo: 'Agendas por Especialidad', campana: 'ORLANT' },
        { tipo: 'agendas_panel', vista: 'mensual', titulo: 'Total de Agendas por Mes', campana: 'ORLANT' },
        // "Agendas por línea" (Fase 94): YA NO sale de la hoja "resumen"
        // (agendas_general/agendas_3p, siempre vacios) -- sale de la
        // columna `tipoLinea` de la tabla `agendas` real (GET
        // /calidad/agendas/linea, server/agendas.js).
        { tipo: 'agendas_panel', vista: 'linea', titulo: 'Agendas por Línea', campana: 'ORLANT' },
        // "Ranking de asesores": Fase 104 (pedido de InCo) lo calculaba por
        // CANTIDAD de agendas (tabla `agendas`). Fase 111 (pedido textual de
        // Edwin: "el ranking va a ser efectividad por agendamiento") lo
        // reemplaza por un panel PROPIO (`efectividad_agendamiento_panel`,
        // ya no `agendas_panel`), calculado 100% en el servidor a partir de
        // la tabla nueva `efectividad_agendamiento` (GET
        // /calidad/efectividad-agendamiento/ranking,
        // server/efectividad-agendamiento.js): puesto por EFECTIVIDAD
        // (agendas/gestiones) de mayor a menor, empate = mas gestiones
        // primero. El calculo viejo (agendasRanking, server/agendas.js) se
        // deja intacto -- Fase 104 sigue teniendo su propia prueba y nadie
        // mas lo usa, pero no hace daño que seguir existiendo. Ver migracion
        // idempotente dashboards_config_orlant_efectividad_agendamiento_v1
        // en db.js (produccion ya tenia este panel sembrado con la forma de
        // la Fase 104).
        { tipo: 'efectividad_agendamiento_panel', titulo: 'Ranking de Asesores', campana: 'ORLANT' },
      ], subtabs: [
        { key: 'porespecialidad', label: 'Por especialidad', indices: [0] },
        { key: 'totalagendas', label: 'Total agendas', indices: [1] },
        { key: 'agendasporlinea', label: 'Agendas por línea', indices: [2] },
        { key: 'rankingasesores', label: 'Ranking de asesores', indices: [3] },
      ]},
      // Fase 94 (tema B): salen de Agendamiento (Edwin dijo que son otros
      // procesos, con bases completamente distintas, que se montan
      // despues) a su propia pestaña oculta -- MISMA config exacta que
      // tenian adentro de Agendamiento, nada se borra ni se recalcula, solo
      // cambia de donde cuelga. Se destapa a mano (quitar `oculta: true`)
      // el dia que Edwin mande la base de Ordenamiento Médico.
      { key: 'ordenamiento_medico', label: 'Ordenamiento Médico', oculta: true, panels: [
        { tipo: 'combo', titulo: 'Ordenamiento médico', barras: [
          { label: 'Gestionados', fuente: serie('ordmed_gestionados') },
          { label: 'Agendas', fuente: serie('ordmed_agendas') }],
          linea: { label: '% Efectividad', fuente: pctFormula('ordmed_agendas', 'ordmed_gestionados') } },
        { tipo: 'nota_kpi', titulo: 'Efectividad del año — Ordenamiento médico 3P',
          valores: [
            { clave: 'gestionados', fuente: { s: 'resumen', modo: 'anual', campo: 'ordmed_gestionados' } },
            { clave: 'agendados', fuente: { s: 'resumen', modo: 'anual', campo: 'ordmed_agendas' } },
          ],
          formula: { clave: 'efectividad', a: 'agendados', b: 'gestionados' },
          plantilla: 'De la estrategia de agendamiento por ordenamiento médico en consulta médica, se han gestionado un total de {gestionados} pacientes, de los cuales se han logrado agendar {agendados} — efectividad del año: {efectividad}%.' },
      ]},
      // Fase 94 (tema B): idem, "Recuperación de Cancelados" sale a su
      // propia pestaña oculta -- misma config exacta.
      { key: 'recuperacion_cancelados', label: 'Recuperación de Cancelados', oculta: true, panels: [
        { tipo: 'combo', titulo: 'Recuperación de cancelados', barras: [
          { label: 'Cancelado', fuente: serie('recup_cancelado') },
          { label: 'Atendido', fuente: serie('recup_atendido') }],
          linea: { label: '% Efectividad', fuente: pctFormula('recup_atendido', 'recup_cancelado') } },
      ]},
      // Tipificacion (Fase 77, pedido de Edwin/Jairo): REEMPLAZA el pie
      // filtrable de mas abajo (basado en la hoja vieja "tipificacion", que
      // nunca llego a tener datos reales de ORLANT) por un panel autonomo
      // (mismo patron que "Citas por Especialidad", agendas_panel — Fase 78)
      // alimentado por la tabla `tipificaciones` (server/tipificaciones.js):
      // 2 pies (Llamadas/WhatsApp, ~15.000 filas/mes solo Llamadas) con
      // filtros Mes/rango COMPARTIDOS y Agente/Skill INDEPENDIENTES por
      // canal. La hoja vieja "tipificacion" (dashboard_cargas, seccion
      // 'tipificacion') sigue funcionando exactamente igual que antes si
      // alguien la vuelve a subir (compatibilidad hacia atras) — solo deja
      // de tener un panel que la muestre en ESTE tab de ORLANT.
      // Fase 138 (PR2, pedido de Edwin 09/10): mismas opciones que ya tenia
      // Mobilize (1 torta + filtro + tabla de detalle + tarjetas de salida,
      // en vez de las 2 tortas Llamadas/WhatsApp lado a lado de Fase 77) --
      // decision explicita del usuario de dejar ORLANT igual a Mobilize,
      // sabiendo que la torta de WhatsApp deja de verse EN ESTE panel (sus
      // datos siguen en la tabla `tipificaciones`, solo no se grafican aqui).
      { key: 'tipificacion', label: 'Tipificación', oculta: true, panels: [
        { tipo: 'tipificacion_panel', titulo: 'Tipificación', campana: 'ORLANT',
          soloCanal: 'LLAMADAS', mostrarFiltroTipo: true, mostrarTablaDetalle: true, mostrarTarjetasSalida: true,
        },
      ]},
      { key: 'calidad', label: 'Calidad', panels: [
        { tipo: 'calidad_kpis', campana: 'ORLANT' },
        { tipo: 'calidad_pie', campana: 'ORLANT', titulo: 'Distribución de clasificación' },
        // Fase 130 (pedido de Edwin): nombre + % promedio por asesor, sin
        // numero de monitoreos -- ver calDashPromedioPorAsesor.
        { tipo: 'calidad_bar_asesores', campana: 'ORLANT', titulo: 'Promedio de calidad por asesor' },
      ]},
      { key: 'flujo', label: 'Flujo Mensual', oculta: true, panels: [
        lineP('Llamadas 3P por mes', 'llamadas_3p'),
        lineP('WhatsApp 3P por mes', 'wpp_3p'),
        lineP('Llamadas Línea General por mes', 'llamadas_general'),
        lineP('WhatsApp Línea General por mes', 'wpp_general'),
      ], subtabs: [
        { key: 'llamadas3p', label: 'Llamadas 3P', indices: [0] },
        { key: 'wpp3p', label: 'WhatsApp 3P', indices: [1] },
        { key: 'llamadasgeneral', label: 'Llamadas Línea General', indices: [2] },
        { key: 'wppgeneral', label: 'WhatsApp Línea General', indices: [3] },
      ]},
      // Fase 98 (ORLANT, pedido URGENTE de Edwin): Inasistencia con datos
      // REALES (tabla `inasistencias`, server/inasistencia.js) -- reemplaza
      // las 4 graficas de linea viejas (inasist_audifonos/audiologia/
      // examenes/total, hoja "resumen" generica, que nunca tuvieron datos
      // reales de ORLANT). Mismo patron autonomo que Agendamiento/
      // Tipificacion (Fases 77-78): 3 sub-pestañas, su propio panel
      // `inasistencia_panel` con un `vista` distinto cada una, todas
      // comparten los mismos filtros (mes/especialidad/rango, estado por
      // CAMPANA -- ver public/js/inasistencia.js). Posicion: justo despues
      // de Agendamiento (orden de ORLANT, ver
      // dashboards_config_orlant_orden_pestanas_v2 en db.js).
      //
      // Fase 101 (pedido del jefe): la vista PRINCIPAL pasa a ser "Por mes"
      // (total de TODAS las especialidades juntas, sin filtro, una sola
      // grafica comparando citas vs. inasistencias con el % ponderado) --
      // "Por especialidad" deja de ser la principal y pasa a incluir la
      // linea de tendencia por especialidad que antes vivia en "Por mes".
      //
      // Fase 106 (pedido de InCo, "que en Inasistencia solo quede en
      // porcentaje, por mes"): se retiraron las sub-pestañas "Por
      // especialidad" y "Detalle" (y los conteos sueltos de "Por mes") --
      // quedo UN SOLO panel, sin `subtabs`.
      //
      // Fase 108 (pedido textual de InCo: "que se pueda filtrar por sede,
      // especialidad, nombre entidad... y barra por especialidad, para cada
      // una de ellas, con el % de la inasistencia y poder filtrar por el
      // mes"): vuelven 2 sub-pestañas -- "Resumen por mes" (vista:'pormes',
      // ahora con filtros de sede/especialidad/entidad y una tarjeta con el
      // % ponderado de TODO el periodo filtrado) y "Por especialidad"
      // (vista:'porespecialidad', una barra por especialidad del mes elegido
      // arriba, respetando sede/entidad). `subtabs` nunca se omite (array
      // vacio en vez de ausente): las migraciones viejas de abajo le hacen
      // JSON.parse(JSON.stringify(targetTab.subtabs)) sin guard, y
      // `undefined` ahi revienta.
      // Ver las migraciones idempotentes
      // dashboards_config_orlant_inasistencia_panel_v1 (forma vieja de la
      // Fase 98 -> la de la Fase 101),
      // dashboards_config_orlant_inasistencia_panel_v2 (Fase 98 tardia ->
      // Fase 101), dashboards_config_orlant_inasistencia_panel_v3 (Fase 101
      // -> Fase 106) y dashboards_config_orlant_inasistencia_panel_v4 (Fase
      // 106 -> esta forma) en db.js -- dashboards_config ya existia en
      // produccion, asi que esta forma nueva del seed nunca le habria
      // llegado sola.
      { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [
        { tipo: 'inasistencia_panel', vista: 'pormes', titulo: 'Inasistencia por Mes', campana: 'ORLANT' },
        { tipo: 'inasistencia_panel', vista: 'porespecialidad', titulo: 'Inasistencia por Especialidad', campana: 'ORLANT' },
      ], subtabs: [
        { key: 'pormes', label: 'Resumen por mes', indices: [0] },
        { key: 'porespecialidad', label: 'Por especialidad', indices: [1] },
      ]},
      // "Efectividad de Citas" (Fase 111, pedido textual de InCo): hoy leia
      // citas_para_mes/citas_atendidas de la hoja "resumen" (filaUnica), que
      // nunca tuvo datos reales -- ahora lee la base nueva
      // CITAS_ATENDIDAS.xlsx (tabla efectividad_citas, un total por mes),
      // con su propio panel (efectividad_citas_panel,
      // public/js/efectividad-citas.js) en vez del `combo` generico. Los 2
      // campos viejos de "resumen" quedan ocultaEnPlantilla (ver
      // dashboard-secciones.js) -- nunca se borran, por si un archivo viejo
      // todavia los trae. Se mueve justo DESPUES de "Inasistencia" (pedido
      // explicito) -- antes vivia al final, despues de "Gestión STA". Ver
      // migraciones idempotentes dashboards_config_orlant_efectividad_citas_v1
      // (panel + orden) y dashboards_config_orlant_resumen_citas_opcional_v1
      // (los 2 campos de "resumen") en db.js.
      { key: 'efectividad', label: 'Efectividad de Citas', oculta: true, panels: [
        { tipo: 'efectividad_citas_panel', titulo: 'Efectividad de Citas', campana: 'ORLANT' },
      ]},
      { key: 'sta', label: 'Gestión STA', oculta: true, panels: [
        // Graficas 14-15: agregado ANUAL (f.anual, no solo el ultimo mes
        // cargado) + % del total en cada barra (pctDeTotal -> loBarPct,
        // charts.js), tal como las dibuja el PDF.
        { tipo: 'bar', titulo: 'Órdenes por servicio (año)', horizontal: true, pctDeTotal: true, series: [
          { label: 'Órdenes', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'SERVICIO' }, anual: true } }] },
        { tipo: 'bar', titulo: 'Estado de órdenes cargadas al STA (año)', horizontal: true, pctDeTotal: true,
          series: [{ label: 'Órdenes', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'ESTADO' }, anual: true } }],
          notas: ['No incluye Cirugía, Pre-revisado de cirugía, Procedimiento menor ni Otros servicios — esos se gestionan aparte.'] },
        // Grafica 13: se agrega la barra "Agendada" (sta_agendadas ya
        // existia en el esquema, opcional, sin usar en ningun panel).
        { tipo: 'combo', titulo: 'STA por mes', barras: [
          { label: 'Órdenes Cargadas', fuente: serie('sta_ordenes') },
          { label: 'Agendada', fuente: serie('sta_agendadas') },
          { label: 'Facturado + Cumplida', fuente: serie('sta_factcump') }],
          linea: { label: '% Efectividad', fuente: pctFormula('sta_factcump', 'sta_ordenes') } },
        // Grafica 16: ya era exactamente esto, solo se renombra el titulo.
        { tipo: 'combo', titulo: 'Servicios gestionados del STA del mes', barras: [
          { label: 'Cantidad', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', campo: 'cantidad', filtro: { dimension: 'MES_ACTUAL' } } }],
          linea: { label: '% Efectividad', fuente: { s: 'sta_categorias', modo: 'filas', x: 'categoria', formula: 'a/b*100', a: 'agendas', b: 'cantidad', filtro: { dimension: 'MES_ACTUAL' } } } },
      ], subtabs: [
        { key: 'porservicio', label: 'Órdenes por Servicio (Año)', indices: [0] },
        { key: 'porestado', label: 'Estado de Órdenes (Año)', indices: [1] },
        { key: 'stamensual', label: 'STA por Mes', indices: [2] },
        { key: 'serviciosmes', label: 'Servicios Gestionados del Mes', indices: [3] },
      ]},
    ],
  },
};

// ── MOBILIZE ────────────────────────────────────────────────
// Fase 131 (Parte 2, pedido de Edwin): dashboard real de Mobilize, no la
// plantilla generica de "ventas" de M3 (ver el comentario de donde salio,
// dashboard-plantillas-cliente.js) -- Mobilize es un cliente de FLUJO DE
// LLAMADAS (cola/skill), no de televentas. "Flujo de Llamadas" reusa tal
// cual el mismo motor/panel de ORLANT (trafico_combo, trafico-skills.js/
// trafico-logic.js -- su propio export de Volvox mapea por skill a la
// campana MOBILIZE igual que cualquier otra) con 4 ajustes, todos opciones
// NUEVAS y opcionales del panel (ORLANT/CLINICA AURORA/HOSPITAL LA MARIA no
// las pasan, asi que su comportamiento no cambia en nada):
//   - `etiquetaLinea`/`etiquetaLineaPlural`: el filtro dice "Tipo de línea"
//     (el nombre real de su columna), no "Skill".
//   - `subtabs`/`subtabsTitulos`: orden pedido por Edwin (Resumen -> Nivel
//     de Servicio 80-20 -> Abandono -> ASA -> AHT, AHT al final) en vez del
//     orden de siempre (Resumen/Abandono/AHT/ASA y ATA/Nivel de Servicio).
//     "asa" (sin ATA, que "se guarda pero no se grafica") es una sub-pestaña
//     nueva, independiente de "asaata" -- ver _traficoDibujarAsaAta en
//     trafico.js. SL10/SL30/WAIT_TIME ya no se grafican para NADIE desde la
//     Fase 68 (se siguen guardando igual) -- nada que apagar aqui.
//   - `resumenOcultar`: el resumen principal de Mobilize es SOLO
//     ingresadas/contestadas/abandonadas/nivel de atencion (pedido
//     explicito de Edwin) -- se quitan las tarjetas de tasa de abandono y
//     nivel de servicio, que ya tienen su PROPIA sub-pestaña con su propio
//     resumen (`resumenPorSeccion`, siguiente punto).
//   - `resumenPorSeccion`: cada sub-pestaña de detalle (SL/Abandono/ASA/
//     AHT) trae su propio numero acumulado del periodo/filtro actual
//     ENCIMA de su grafica, no solo el chart solo -- pedido textual de
//     Edwin ("cada sección con SU resumen acumulado debajo, no un solo
//     resumen arriba").
// Sin pestaña de Trafico de WhatsApp (Mobilize no tiene WhatsApp).
// Tipificacion (Parte 3 de esta misma fase): CDR real de Wolkvox (export
// completo HistCDR, hoja con nombre dinamico "HistCDR<fecha>"), MISMO
// motor que ORLANT (tipificacion_panel, tipificacion-logic.js/
// tipificaciones.js/validation.js) con 4 opciones NUEVAS y opcionales del
// panel (ORLANT no las pasa, su comportamiento no cambia en nada):
//   - `soloCanal: 'LLAMADAS'`: Mobilize no tiene WhatsApp -- una sola
//     mitad, a todo el ancho (nunca el grid de 2 columnas de ORLANT).
//   - `mostrarFiltroTipo`: desplegable Entrante/Saliente (TYPE_INTERACTION).
//   - `mostrarTablaDetalle`: tabla de mayor a menor debajo del pie (ORLANT
//     sigue sin tabla, pedido explicito de la Fase 77).
//   - `mostrarTarjetasSalida`: 3 tarjetas (total/conectadas/no conectadas)
//     de las llamadas SALIENTES (Regla B: "Cliente_no_contesta" es la
//     unica codificacion que cuenta como "no conectada", configurable).
// La exclusion de filas de prueba (DESCRIPTION_COD_ACT="PRUEBA") y la
// lista de "no conectada" se configuran en la CARGA (cargas.js/
// tipificacion-logic.js), no aqui -- este panel solo CONSUME lo que ya
// quedo guardado.
// Oculta por defecto (igual que ORLANT, Fase 77): se destapa en memoria
// solo cuando ya hay datos reales cargados (_gdBootstrap,
// dashboard-generic.js), nunca escribiendo este cambio en el servidor.
// Calidad usa la plantilla GENERICA de contact center (plantillaGenerica,
// calidad-plantillas-seed.js) -- Edwin no dio todavia criterios propios de
// calificacion para Mobilize, mismo caso que Andres Yepes/Sascha Fitness/
// Bivett.
const MOBILIZE = {
  cliente: 'MOBILIZE',
  titulo: 'Dashboard Mobilize',
  vista: null,
  // Sin carga manual real (Gestion de base): todo lo real de Mobilize sale
  // de Trafico (automatico, por skill) y Calidad (su propio formulario) --
  // a diferencia de ORLANT, Mobilize no tiene ningun tab viejo que todavia
  // dependa de una hoja "resumen" generica. "notas" es un PLACEHOLDER
  // tecnico, no un flujo real: `secciones` no admite un objeto vacio
  // (validation.js, dashboardConfigBody.secciones, "El dashboard necesita
  // entre 1 y 30 secciones" -- lo exige CUALQUIER PUT /dashboards/config/
  // :cliente, incluido guardar sin cambiar nada desde el constructor visual
  // del admin, hallazgo real de esta misma fase). Nunca se le pide nada al
  // admin de Mobilize en la pantalla de carga -- queda ahi sin uso real.
  secciones: {
    notas: {
      titulo: 'Notas (sin uso)',
      descripcion: 'Placeholder tecnico -- Mobilize no tiene carga manual, todo sale de Trafico/Calidad.',
      cadencia: 'mensual', periodo: 'mes', filaUnica: true,
      columnas: [{ key: 'nota', label: 'Nota', tipo: 'texto' }],
    },
  },
  layout: {
    kpis: [],
    tabs: [
      { key: 'flujo', label: 'Flujo de Llamadas', panels: [
        { tipo: 'trafico_combo', campana: 'MOBILIZE',
          etiquetaLinea: 'Tipo de línea', etiquetaLineaPlural: 'líneas',
          resumenOcultar: ['tasaAbandono', 'nivelServicio'],
          resumenPorSeccion: true,
          // Fase 138 (PR2, pedido de Edwin 09/10): ASA y AHT antes eran 2
          // sub-pestanas separadas (Fase 131) -- ahora van juntas en 1 sola
          // ("asaaht", confirmado que la plantilla real de Flujo trae AHT
          // antes de construir esto), mismo patron que "asaata" (Llamadas de
          // ORLANT) ya usaba para ASA+ATA.
          subtabs: [
            { key: 'resumen', label: 'Resumen' },
            { key: 'sl', label: 'Nivel de Servicio' },
            { key: 'abandono', label: 'Abandono' },
            { key: 'asaaht', label: 'ASA y AHT' },
          ],
          subtabsTitulos: { sl: 'Nivel de Servicio 80 - 20' },
        },
      ]},
      { key: 'tipificacion', label: 'Tipificación', oculta: true, panels: [
        { tipo: 'tipificacion_panel', titulo: 'Tipificación', campana: 'MOBILIZE',
          soloCanal: 'LLAMADAS', mostrarFiltroTipo: true, mostrarTablaDetalle: true, mostrarTarjetasSalida: true,
        },
      ]},
      { key: 'calidad', label: 'Calidad', panels: [
        { tipo: 'calidad_kpis', campana: 'MOBILIZE' },
        { tipo: 'calidad_pie', campana: 'MOBILIZE', titulo: 'Distribución de clasificación' },
      ]},
    ],
  },
};

// Fase 134: solo ORLANT y MOBILIZE quedan en produccion (decision del
// usuario, 2026-10-09) -- CLINICA AURORA/HOSPITAL LA MARIA (arriba) y los 8
// dashboards de plantilla estandar que vivian en dashboard-plantillas-
// cliente.js (M3/Fase A2, ninguno con datos reales) se quitaron del todo,
// archivo incluido, para que ningun deploy/migracion los vuelva a crear.
const CONFIGS = [ORLANT, MOBILIZE];

module.exports = { CONFIGS };
