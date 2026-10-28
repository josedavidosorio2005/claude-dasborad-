// cargas.js — InConexion Platform. Pantalla de carga de datos operativos de los
// dashboards de cliente (Fase 2; consolidada en la Fase "una sola plantilla
// por campana", 2026-09-16). Requiere el permiso `cargarDatos`.
//
// Antes de la Fase 2026-09-16, una campana podia llegar a tener hasta 3
// botones de carga separados: Gestion de base (aqui), Calidad (su propio
// modulo) y Trafico (su propia pantalla de administracion). Ahora esta
// pantalla arma UN SOLO archivo .xlsx por cliente, con una hoja por tipo de
// dato (nunca aplanado en una tabla unica — mezclaria filas de naturaleza
// distinta). Decision de diseno completa en docs/ARQUITECTURA.md.
//
// El Excel se parsea en el navegador (libreria XLSX ya cargada) y se envia
// como JSON a las rutas que YA EXISTIAN para cada tipo de dato (nunca se
// reescribio su parseo/validacion): POST /dashboard/cargas (Gestion de
// base, una llamada por seccion con datos), POST /monitoreos/bulk (Calidad),
// POST /calidad/trafico/carga (Trafico). Una hoja PRESENTE pero vacia no es
// un error (no aplica esta vez); una hoja AUSENTE (renombrada o borrada por
// error respecto al nombre exacto que espera el plan) SI genera un aviso
// (fix de la Fase 30/31 -- antes se perdia en silencio, igual que una hoja
// vacia legitima); una hoja con datos invalidos se rechaza sola. Ningun caso
// de estos bloquea las demas hojas del mismo archivo.
//
// El parseo puro (sin DOM) vive en cargas-logic.js para poder probarlo con
// node:test contra un .xlsx real (ver server/tests/cargas-logic.test.js).

var _cargasClientes = [];
var _cargasSpec = null;          // { cliente, secciones:{ key: {titulo, cadencia, periodo, filaUnica, columnas} } }
var _cargasCalidadPorCampana = {}; // { campana: {campana,engine,items} } — de GET /calidad/plantillas
var _cargasPlan = [];            // cargasPlanConsolidado(...) para el cliente actual
var _cargasArchivoNombre = '';
var _cargasResultados = [];      // 1 por hoja del plan, tras procesarArchivoConsolidado
var _cargasCodigosEntidad = null; // Fase 210: codigos de la Clasificacion de lineas (base cruda de Agendas)
var _cargasSkillsWhatsappMapa = null; // Fase 168: {codigo: nombre} de WhatsApp del cliente (HistChat por SKILL_ID)
// Fase 153 (Centro de cargas, PR 4): { cliente, carga, mes, nombre } cuando
// se llega desde "Subir/Reemplazar" de un mes del Centro: el plan queda con
// ese modulo y el archivo con las filas de ese mes (centroFiltrarPlan /
// centroFiltrarResultado, centro-cargas-logic.js). null = pantalla de siempre.
var _cargasFocoCentro = null;
function _cargasFocoActivo(cliente){
  return _cargasFocoCentro && _cargasFocoCentro.cliente === cliente ? _cargasFocoCentro : null;
}

// Hojas especiales por cliente (Fases 66, 131, 138, 141, 142 y 147). Desde
// la Fase 153 (Paso 2) ya no son listas fijas aqui: salen del registro de
// clientes (registro-clientes.js, LISTAS_REGISTRO), segun los modulos y
// parametros de cada cliente:
//  - traficoUnificado: plantilla de Trafico de 2 hojas (LLAMADAS/WHATSAPP);
//  - tipificacionExtra: Tipificacion por el CDR de Wolkvox (gate
//    independiente del anterior, ver onCargaClienteChange);
//  - llamadasUnicas / llamadasSalida, whatsappTiempos, encuesta.

// Fase 79 (hallazgo real: una carga fallo en produccion porque la pestana
// llevaba abierta desde ANTES del deploy que agrego las hojas nuevas -- el
// JS que ya estaba en memoria del navegador no reconocia esas hojas, y
// nunca hay forma de "empujarle" el cambio a una pestana que no se recarga).
// Compara el BUILD_ID que esta pagina cargo (window.__BUILD_ID__, ver
// server.js) contra el que reporta el servidor AHORA MISMO (GET /health,
// publico, sin autenticacion) -- si difieren, esta pestana esta corriendo
// JS de un deploy viejo. Nunca bloquea la carga (podria ser un falso
// positivo si /health fallara por otra razon), solo avisa con un banner
// dificil de ignorar -- un toast de 3 segundos ya se habia perdido en el
// incidente real.
async function _cargasAvisarSiVersionVieja(){
  var aviso = document.getElementById('carga-version-vieja-aviso');
  if(!aviso) return;
  aviso.style.display = 'none';
  try{
    var res = await fetch((typeof API_BASE!=='undefined'?API_BASE:'/api')+'/health');
    var data = await res.json();
    if(data && data.buildId && typeof window.__BUILD_ID__ === 'string' && data.buildId !== window.__BUILD_ID__){
      aviso.textContent = '⚠ Esta pagina quedo abierta desde ANTES del ultimo cambio en la plataforma. ' +
        'Antes de cargar un archivo, guarda lo que tengas sin guardar y RECARGA la pagina (F5) -- ' +
        'de lo contrario la carga puede fallar con "hoja no reconocida" aunque el archivo este bien.';
      aviso.style.display = '';
    }
  }catch(e){ /* si /health falla por otra razon, no se avisa nada -- nunca bloquea la carga */ }
}

async function openCargas(){
  // Fase 153 (PR 5): sin cargarDatos, solo desde el Centro de cargas y solo
  // el modulo de su permiso cargar_<modulo> (CALIDAD).
  var soloFoco = !canLoadData();
  if(soloFoco && !(_cargasFocoCentro && canLoadModule(centroModuloDeCarga(_cargasFocoCentro.carga)))){
    showToast('No tienes permiso para cargar datos'); return;
  }
  document.getElementById('cargas-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('cargas-modal');
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  _cargasAvisarSiVersionVieja();
  try{
    var r = await apiRequest('GET','/dashboard/clientes');
    _cargasClientes = (r && r.clientes) || [];
  }catch(e){ _cargasClientes = []; showToast(e.message, 'error'); }
  try{
    var plantillas = await apiRequest('GET','/calidad/plantillas') || [];
    _cargasCalidadPorCampana = {};
    plantillas.forEach(function(p){ _cargasCalidadPorCampana[p.campana] = p; });
  }catch(e){ _cargasCalidadPorCampana = {}; }
  var selC = document.getElementById('carga-cliente');
  // PR 5: quien carga por su permiso de modulo solo ve el cliente que eligio en el Centro.
  // Fase 159: desde el Centro (Subir/Reemplazar), el cliente queda fijo -- un
  // cambio accidental de cliente apagaba el filtro de mes sin avisar.
  if(soloFoco || _cargasFocoCentro) _cargasClientes = _cargasClientes.filter(function(c){ return c === _cargasFocoCentro.cliente; });
  selC.disabled = !!_cargasFocoCentro;
  // Fase 159 (pedido de Edwin): el cliente elegido se ve resaltado, y desde
  // el Centro el mes tambien queda fijo (el del mes que se eligio alli).
  selC.classList.add('carga-campo-elegido');
  var per = document.getElementById('carga-periodo');
  per.disabled = !!_cargasFocoCentro;
  per.classList.toggle('carga-campo-elegido', !!_cargasFocoCentro);
  if(_cargasFocoCentro){ per.value = _cargasFocoCentro.mes; per.dataset.fijo = '1'; }
  else if(per.dataset.fijo){ per.value = ''; delete per.dataset.fijo; }
  selC.title = per.title = _cargasFocoCentro ? 'Fijo: viene del Centro de cargas. Para cambiarlo, vuelve al Centro.' : '';
  selC.innerHTML = _cargasClientes.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')
    || '<option value="">Sin clientes configurados</option>';
  await onCargaClienteChange();
}
function closeCargas(){
  var cerrarReal = function(){ document.getElementById('cargas-overlay').classList.remove('show'); };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('cargas-modal', cerrarReal);
  else cerrarReal();
  _cargasFocoCentro = null;
  // Fase 153: si se llego aqui desde el Centro de cargas (Subir/Reemplazar),
  // se vuelve a el en el mismo modulo, con los conteos ya actualizados.
  if (typeof centroVolverTrasCarga === 'function') centroVolverTrasCarga();
}
document.getElementById('cargas-overlay').addEventListener('click',function(e){ if(e.target===this) closeCargas(); });

// ── Columnas de Trafico/Calidad normalizadas a {key?,label,opcional} para
// que el plan y la hoja INSTRUCCIONES usen siempre el mismo criterio
// (Trafico trae `obligatoria`; Gestion de base y esto de aqui usan `opcional`).
//
// Fase 131 (Parte "carga real de Mobilize", MISMO bug de fondo que el
// "HALLAZGO GRAVE" de la Fase 122 en _cargasTipificacionColumnasUnificado,
// ver su comentario arriba): esta funcion NUNCA copiaba los alias de
// columna -- TRAFICO_COLUMNAS (trafico-logic.js) los guarda en una
// propiedad con OTRO nombre, `aliases` (Parte 2 de esta misma fase, para
// que Mobilize use "TIPO DE LINEA"/"DÍA"/"LLAMADAS INGRESADAS"/etc. en vez
// de los nombres de ORLANT), pero cargasEncabezadosCoinciden
// (cargas-logic.js) solo sabe leer `labelAlt`. Confirmado contra
// produccion real con el archivo real de septiembre de Mobilize (hoja
// "HistQueue<fecha>", nunca "DATA"): sin este mapeo, el reconocimiento por
// encabezados SIEMPRE fallaba ("El archivo no tiene datos en ninguna hoja
// reconocida") aunque traficoColIndexMap/traficoParseFilas (que no pasan
// por esta funcion) ya soportaban esos mismos alias desde la Parte 2.
function _cargasTraficoColumnas(){
  // MES/AÑO al final son informativas (Volvox las trae, nadie las parsea:
  // traficoColIndexMap las ignora sin problema) — se agregan solo para que
  // la hoja DATA de esta plantilla se vea igual que la plantilla oficial ya
  // aprobada por el cliente (server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx).
  return TRAFICO_COLUMNAS.map(function(c){ return { key:c.key, label:c.label, labelAlt:c.aliases, opcional: !c.obligatoria }; })
    .concat([{ key:'mes', label:'MES', opcional:true }, { key:'anio', label:'AÑO', opcional:true }]);
}
// Fase 66 — columnas EXACTAS de la hoja LLAMADAS del archivo unificado de
// ORLANT (server/tests/fixtures/PLANTILLA_TRAFICO_UNIFICADA_ORLANT.xlsx, la
// especificacion real que aprobo el cliente — verificado letra por letra
// contra ese archivo, no reconstruido de memoria). WHATSAPP (funcion de
// abajo) ya NO coincide con esa plantilla estatica vieja -- ver Fase 116,
// cambio al formato diario real de Wolkvox. LLAMADAS coincide con la estatica general
// (PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx) SOLO en las primeras 13
// columnas -- esa plantilla vieja trae ademas NIVEL DE ATENCION/TASA DE
// ABNDONO/MES/AÑO al final, que la plantilla unificada NO incluye (decision
// del cliente al aprobar el archivo, no un error de esta funcion). Sin
// impacto funcional: MES/AÑO nunca se leyeron (decorativas); NIVEL DE
// ATENCION/TASA DE ABNDONO si estan en TRAFICO_COLUMNAS pero su valor
// parseado no se usa en ningun calculo real (trafico.js siempre recalcula
// esas 2 métricas desde contestadas/total, nunca confia en el dato crudo
// del archivo) -- solo afectaria una tabla de vista previa de la pantalla
// legacy "Metas Calidad -> Trafico/Wolkvox", no el modal "Cargar Datos".
// Incluyen "ABANDON"/"ABANDONO", una columna que el parser NO lee (retirada
// del parseo en la Fase 45 a proposito, ver TRAFICO_COLUMNAS/TRAFICO_WPP_
// COLUMNAS en *-logic.js) pero que las plantillas oficiales SI traen — no
// se derivan de esas listas (que son las que SI lee el parser) para poder
// insertar esa columna fantasma en su posicion exacta sin tocar el parser
// ni el mapeo de columnas.
function _cargasTraficoLlamadasColumnasUnificado(){
  return [
    { label:'SKILL_NAME', opcional:false },
    { label:'DATE', opcional:false },
    // Fase 159: el reporte nativo de Wolkvox (el mismo de Mobilize) trae
    // INBOUND_CALLS / ANSWER_CALLS / ABANDON_CALLS en vez de estos nombres.
    { label:'TOTAL LLAMADAS', labelAlt:['INBOUND_CALLS'], opcional:false },
    { label:'LLAMADAS CONTESTADAS', labelAlt:['ANSWER_CALLS'], opcional:false },
    { label:'LLAMADAS ABANDONADAS', labelAlt:['ABANDON_CALLS'], opcional:true },
    { label:'SERVICE_LEVEL_10SEC', opcional:true },
    { label:'SERVICE_LEVEL_20SEC', opcional:true },
    { label:'SERVICE_LEVEL_30SEC', opcional:true },
    { label:'ABANDON', opcional:true },
    { label:'ASA', opcional:true },
    { label:'ATA', opcional:true },
    { label:'WAIT_TIME', opcional:true },
    { label:'AHT', opcional:true },
  ];
}
// Fase 116 (archivo real de Edwin, ago-sep/2026): Wolkvox exporta WhatsApp en
// el MISMO formato diario que voz (SKILL_NAME + DATE, una fila por cola y
// dia) -- reemplaza la lista vieja de la plantilla por periodo
// (NOMBRE_COLA_WHATSAPP/FECHA INICIO/FECHA FIN/TOTAL WHATSAPP/WHATSAPP
// CONTESTADOS), que traficoWppParseFilas (trafico-whatsapp-logic.js) sigue
// aceptando igual si alguien llega a subir un archivo viejo con esas
// columnas (el dispatcher detecta el formato por el encabezado, ver
// traficoWppEsFormatoDiario) -- solo esta lista (la de la plantilla
// DESCARGABLE y el reconocimiento por encabezados del modal) pasa a
// describir el formato real que se usa de ahora en adelante.
function _cargasTraficoWhatsappColumnasUnificado(){
  return [
    { label:'SKILL_NAME', opcional:false },
    { label:'DATE', opcional:false },
    { label:'INBOUND_CALLS', opcional:false },
    { label:'ANSWER_CALLS', opcional:false },
    { label:'ABANDON_CALLS', opcional:true },
    { label:'SERVICE_LEVEL_10SEC', opcional:true },
    { label:'SERVICE_LEVEL_20SEC', opcional:true },
    { label:'SERVICE_LEVEL_30SEC', opcional:true },
    // SERVICE_LEVEL_5MIN (Fase 87, tema B, nota del jefe: "En WhatsApp el
    // nivel de servicio es de 5 minutos") -- columna opcional; el cargador
    // (traficoWppColIndexMapDiario, trafico-whatsapp-logic.js) tambien
    // acepta SERVICE_LEVEL_300SEC/"NIVEL DE SERVICIO 5 MIN" como alias si el
    // export de Wolkvox trae otro nombre.
    { label:'SERVICE_LEVEL_5MIN', opcional:true },
    { label:'ABANDON', opcional:true },
    { label:'ASA', opcional:true },
    { label:'ATA', opcional:true },
    // WAIT_TIME: Wolkvox la trae pero nunca se lee aqui (Fase 68 retiro Wait
    // Time de la vista de WhatsApp a pedido de Edwin, no hay columna para
    // esto en trafico_whatsapp) -- se deja fuera de esta lista a proposito,
    // una columna que no esta aqui simplemente se ignora sin error.
    { label:'AHT', opcional:true },
  ];
}
// Fase 78 (ORLANT, pedido de Jairo/Edwin) — columnas EXACTAS de la hoja
// AGENDAS del formato consolidado: las 8 que trae el export de agendamiento
// de Edwin, tal cual (NOMBRE_ENTIDAD es la unica opcional -- una cita sin
// entidad registrada se guarda como "SIN ENTIDAD", ver agendas-logic.js).
function _cargasAgendasColumnasUnificado(){
  return AGENDAS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 77 (ORLANT, pedido de Edwin/Jairo) — columnas EXACTAS de las hojas
// TIPIFICACION_LLAMADAS/TIPIFICACION_WHATSAPP: las 6 que trae el archivo
// real de Edwin (AGENT_NAME, DATE, HORA, TIME_MIN, DESCRIPTION_COD_ACT,
// SKILL_NAME -- MES es una formula de Excel, se ignora a proposito, ver
// tipificacion-logic.js). Mismo set de columnas para las 2 hojas -- lo que
// cambia entre Llamadas y WhatsApp es solo el canal (nota aparte en
// INSTRUCCIONES), no la estructura.
//
// Fase 122 (hallazgo real, HALLAZGO GRAVE en produccion): esta funcion
// NUNCA copiaba `labelAlt` (solo `label`/`opcional`) -- la columna `skill`
// de TIPIFICACION_COLUMNAS gano `labelAlt: ['NOMBRE DE SKILL']` en la Parte
// 1.1 de esta misma fase (export HistChat de Wolkvox, que no trae
// SKILL_NAME), pero cargasEncabezadosCoinciden (cargas-logic.js) nunca
// llegaba a verlo: el reconocimiento por encabezados de WhatsApp SIEMPRE
// fallaba en la pagina real, aunque las pruebas unitarias de
// tipificacionColIndexMap/cargasDetectarCanalTipificacion (que no pasan
// por esta funcion) seguian en verde. Confirmado contra produccion real:
// con `labelAlt` conservado, el archivo real se reconoce correctamente.
function _cargasTipificacionColumnasUnificado(){
  return TIPIFICACION_COLUMNAS.map(function(c){ return { label:c.label, labelAlt:c.labelAlt, opcional: !c.obligatoria }; });
}
// Fase 98 (ORLANT, pedido urgente de Edwin) — columnas de la hoja
// INASISTENCIA: conserva `labelAlt` (ej. ESPECIALIDAD/ESPECIALIDA) para que
// cargasEncabezadosCoinciden (Fase 79, reconocer la hoja por encabezados
// aunque no se llame "INASISTENCIA") tambien acepte los alias -- a
// diferencia de _cargasAgendasColumnasUnificado (AGENDAS_COLUMNAS no tiene
// ninguna columna con mas de un nombre aceptado hoy).
function _cargasInasistenciaColumnasUnificado(){
  return INASISTENCIA_COLUMNAS.map(function(c){ return { label:c.label, labelAlt:c.labelAlt, opcional: !c.obligatoria }; });
}
// Fase 111 (ORLANT, pedido textual de Edwin) — columnas de la hoja
// EFECTIVIDAD_AGENDAMIENTO: EFECTIVIDAD (5ta) va `ocultaEnPlantilla` (nunca
// se pide en blanco: el sistema siempre la recalcula) pero SIGUE
// aceptandose si el archivo real la trae (para compararla, ver
// efectividad-agendamiento-logic.js).
function _cargasEfectividadAgendamientoColumnasUnificado(){
  return EFECTIVIDAD_AGENDAMIENTO_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria, ocultaEnPlantilla: !!c.ocultaEnPlantilla }; });
}
// Fase 111 (ORLANT, pedido textual de InCo) — columnas de la hoja
// CITAS_ATENDIDAS: EFECTIVIDAD CITAS ATENDIDAS (4ta) va `ocultaEnPlantilla`
// (nunca se pide en blanco: el sistema siempre la recalcula) pero SIGUE
// aceptandose si el archivo real la trae.
function _cargasCitasAtendidasColumnasUnificado(){
  return CITAS_ATENDIDAS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria, ocultaEnPlantilla: !!c.ocultaEnPlantilla }; });
}
// Fase 127 (ORLANT, pedido textual de Edwin) — columnas de la hoja SALIDA:
// las 5 son obligatorias (ningun total se recalcula, a diferencia de
// Efectividad de Agendamiento/Citas Atendidas).
function _cargasSalidaColumnasUnificado(){
  return SALIDA_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 138, PR3 (Mobilize, pedido de Edwin 09/10/2026) — columnas EXACTAS
// de la hoja LLAMADAS_UNICAS: las 4 que trae el archivo real de Wolkvox
// (AGENT_NAME, DATE, TELEPHONE, SKILL_NAME -- ver llamadas-unicas-logic.js).
function _cargasLlamadasUnicasColumnasUnificado(){
  return LLAMADAS_UNICAS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 141 (Parte C, Mobilize) — columnas de la hoja LLAMADAS_SALIDA (ver
// llamadas-salida-logic.js).
function _cargasLlamadasSalidaColumnasUnificado(){
  return LLAMADAS_SALIDA_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 191 (Mobilize) — columnas del reporte "Detalle de llamadas abandonadas".
function _cargasLlamadasAbandonadasColumnas(){
  return LLAMADAS_ABANDONADAS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 196 (Mobilize) — columnas del reporte de flujo por hora.
function _cargasFlujoHoraColumnas(){
  return FLUJO_HORA_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 194 (Mobilize) — columnas del reporte de no conectadas.
function _cargasLlamadasNoConectadasColumnas(){
  return LLAMADAS_NO_CONECTADAS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 142 (punto 4, ORLANT) — columnas de la hoja WHATSAPP_TIEMPOS.
function _cargasWhatsappTiemposColumnasUnificado(){
  return WPP_TIEMPOS_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
// Fase 147 (Parte B, Mobilize) — columnas de la hoja ENCUESTA (ver
// encuesta-logic.js).
// Fase 172: columnas de "Calidad: resumen por asesor" (calidad-resumen-logic.js).
function _cargasCalidadResumenColumnas(){
  return CALIDAD_RESUMEN_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
function _cargasEncuestaColumnasUnificado(){
  return ENCUESTA_COLUMNAS.map(function(c){ return { label:c.label, opcional: !c.obligatoria }; });
}
function _cargasCalidadColumnas(items){
  var obligatorias = { asesor:1, fecha:1 };
  return CM_COLUMNAS_FIJAS.map(function(c){ return { key:c.key, label:c.label, opcional: !obligatorias[c.key] }; })
    .concat(items.map(function(it){ return { key:'item_'+it.n, label: it.label, opcional:true }; }));
}

// La hoja "DATA" acepta dos formatos (voz o WhatsApp, Fase 52) — se detecta
// cual trae el archivo por las columnas del encabezado
// (cargasDetectarCanalTrafico, cargas-logic.js) y se delega al parser
// correspondiente, marcando el resultado con `canal` para que la vista
// previa y el guardado (guardarCarga/_cargasGuardarTraficoWhatsapp) sepan
// cual de los dos es.
// Fase 159: canal que eligio la persona en el Centro de cargas (Flujo de
// Llamadas -> 'voz', Flujo de WhatsApp -> 'whatsapp'), o null fuera del
// Centro. Decide el canal de un reporte de Wolkvox cuyo encabezado sirve
// para los dos (ver cargasDetectarCanalTrafico, cargas-logic.js).
function _cargasCanalElegido(){
  var sel = document.getElementById('carga-cliente');
  var foco = _cargasFocoActivo(sel ? sel.value : null);
  var spec = foco && typeof CENTRO_CARGA_PLAN !== 'undefined' ? CENTRO_CARGA_PLAN[foco.carga] : null;
  return spec && spec.tipo === 'trafico' ? spec.canal : null;
}

function _cargasParseTraficoAuto(aoa, ws){
  var header = (aoa && aoa[0]) || [];
  var canal = cargasDetectarCanalTrafico(header, traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario, _cargasCanalElegido());
  if(canal === 'whatsapp'){
    var resWpp = traficoWppParseFilas(aoa, ws);
    if(!resWpp.error) resWpp.canal = 'whatsapp';
    return resWpp;
  }
  var resVoz = traficoParseFilas(aoa, ws);
  if(!resVoz.error) resVoz.canal = 'voz';
  return resVoz;
}

async function onCargaClienteChange(){
  var cliente = document.getElementById('carga-cliente').value;
  _cargasSpec = null;
  _cargasPlan = [];
  if(cliente){
    try{ _cargasSpec = await apiRequest('GET','/dashboard/secciones/'+encodeURIComponent(cliente)); }
    catch(e){ showToast(e.message, 'error'); }
  }
  var calidad = cliente ? (_cargasCalidadPorCampana[cliente] || null) : null;
  var calidadCols = calidad ? _cargasCalidadColumnas(calidad.items) : null;
  if(_cargasSpec){
    // Fase 66: solo ORLANT usa la plantilla unificada de 2 hojas de Trafico
    // (LLAMADAS/WHATSAPP, columnas EXACTAS de la plantilla oficial) -- el
    // resto de campanas sigue con 1 sola hoja "DATA" tal cual siempre
    // (LISTAS_REGISTRO.traficoUnificado controla esto, nunca un cambio
    // global). traficoCols solo se usa para la hoja LLAMADAS cuando hay
    // plantilla unificada (ver cargasPlanConsolidado) -- por eso aqui va la
    // version "unificado" en vez de la generica.
    var esUnificado = LISTAS_REGISTRO.traficoUnificado.indexOf(cliente) !== -1;
    // Fase 160: Trafico en 2 hojas tambien para quien tiene Flujo de WhatsApp
    // sin el resto de la plantilla de ORLANT (LISTAS_REGISTRO.traficoWhatsapp).
    var dosHojasTrafico = esUnificado || LISTAS_REGISTRO.traficoWhatsapp.indexOf(cliente) !== -1;
    var traficoCols = dosHojasTrafico ? _cargasTraficoLlamadasColumnasUnificado() : _cargasTraficoColumnas();
    var traficoWpp = dosHojasTrafico ? _cargasTraficoWhatsappColumnasUnificado() : null;
    // Fase 78: agendas usa el MISMO gate que Trafico unificado (hoy solo
    // ORLANT) -- no un flag propio, para no multiplicar listas de clientes
    // que hay que mantener en sincronia.
    var agendasCols = esUnificado ? _cargasAgendasColumnasUnificado() : null;
    // Fase 131 (Parte 3): Mobilize necesita Tipificacion (CDR de Wolkvox,
    // mismo motor de ORLANT) SIN usar la plantilla unificada de Trafico de
    // 2 hojas (su Trafico sigue en la hoja generica "DATA", gate
    // `esUnificado` de arriba) -- gate PROPIO, no se reusa `esUnificado`
    // para no mezclar 2 decisiones independientes (que plantilla de
    // Trafico usa vs. si tiene Tipificacion).
    var tieneTipificacionExtra = LISTAS_REGISTRO.tipificacionExtra.indexOf(cliente) !== -1;
    var tipificacionCols = (esUnificado || tieneTipificacionExtra) ? _cargasTipificacionColumnasUnificado() : null;
    // Mobilize: excluye por defecto las filas de prueba mezcladas con datos
    // reales (DESCRIPTION_COD_ACT="PRUEBA", lista configurable -- ver
    // TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO, tipificacion-logic.js). ORLANT
    // nunca pasa esto (undefined), ninguna fila se excluye, igual que siempre.
    var tipificacionOpcionesLlamadas = tieneTipificacionExtra ? { codificacionesExcluidas: TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO } : undefined;
    // Fase 191: con Llamadas Unicas (Mobilize), el CDR marca la primera
    // llamada de ingreso de cada (dia, telefono); el telefono no se guarda.
    // Fase 194: y toda fila SKILL_NAME "-" se conserva (ni prueba ni duplicado exacto la quitan).
    if(LISTAS_REGISTRO.llamadasUnicas.indexOf(cliente) !== -1) tipificacionOpcionesLlamadas = Object.assign({}, tipificacionOpcionesLlamadas || {}, { marcarUnicasDia: true, conservarSalidaGuion: true });
    var inasistenciaCols = esUnificado ? _cargasInasistenciaColumnasUnificado() : null;
    var efectividadAgendamientoCols = esUnificado ? _cargasEfectividadAgendamientoColumnasUnificado() : null;
    var citasAtendidasCols = esUnificado ? _cargasCitasAtendidasColumnasUnificado() : null;
    var salidaCols = esUnificado ? _cargasSalidaColumnasUnificado() : null;
    // Fase 138, PR3: gate propio (LISTAS_REGISTRO.llamadasUnicas), mismo
    // patron que tieneTipificacionExtra -- no se reusa ese gate para no
    // mezclar 2 decisiones independientes.
    var tieneLlamadasUnicas = LISTAS_REGISTRO.llamadasUnicas.indexOf(cliente) !== -1;
    // Fase 194 (pedido del 27/10): las cargas viejas de Llamadas Unicas
    // (plantilla de ingreso) y de Llamadas de salida ya no se ofrecen -- las
    // contestadas y la salida conectada salen del CDR de Tipificacion. Lo ya
    // guardado sigue en los meses sin CDR.
    var llamadasUnicasCols = null;
    var llamadasSalidaCols = null;
    var whatsappTiemposCols = LISTAS_REGISTRO.whatsappTiempos.indexOf(cliente) !== -1 ? _cargasWhatsappTiemposColumnasUnificado() : null;
    var encuestaCols = LISTAS_REGISTRO.encuesta.indexOf(cliente) !== -1 ? _cargasEncuestaColumnasUnificado() : null;
    var calidadResumenCols = (LISTAS_REGISTRO.calidadResumen || []).indexOf(cliente) !== -1 ? _cargasCalidadResumenColumnas() : null;
    var llamadasAbandonadasCols = tieneLlamadasUnicas ? _cargasLlamadasAbandonadasColumnas() : null; // Fase 191
    var llamadasNoConectadasCols = tieneLlamadasUnicas ? _cargasLlamadasNoConectadasColumnas() : null; // Fase 194
    var flujoHoraCols = (LISTAS_REGISTRO.flujoHora || []).indexOf(cliente) !== -1 ? _cargasFlujoHoraColumnas() : null; // Fase 196
    _cargasPlan = cargasPlanConsolidado(_cargasSpec.secciones, calidadCols, traficoCols, traficoWpp, agendasCols, tipificacionCols, inasistenciaCols, efectividadAgendamientoCols, citasAtendidasCols, salidaCols, tipificacionOpcionesLlamadas, llamadasUnicasCols, llamadasSalidaCols, whatsappTiemposCols, encuestaCols, calidadResumenCols, llamadasAbandonadasCols, llamadasNoConectadasCols, flujoHoraCols);
    var foco = _cargasFocoActivo(cliente);
    if(foco) _cargasPlan = centroFiltrarPlan(_cargasPlan, foco.carga);
  }
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
  var desc = document.getElementById('carga-plan-desc');
  var focoDesc = _cargasFocoActivo(cliente);
  if(focoDesc && _cargasPlan.length){
    desc.textContent = 'Centro de cargas: ' + focoDesc.nombre + ' de ' + centroNombreMes(focoDesc.mes) +
      '. Del archivo solo se cargan las filas de ese mes; los demás meses no se tocan.';
  } else if(!_cargasPlan.length){
    desc.textContent = cliente ? 'Esta campana no tiene secciones configuradas.' : '';
  } else {
    desc.textContent = 'Esta plantilla trae ' + _cargasPlan.length + ' hoja(s): ' +
      _cargasPlan.map(function(h){ return h.hoja; }).join(', ') +
      '. La(s) que no apliquen hoy pueden quedar vacias.';
  }
  renderCargasExistentes();
  _cargasPintarSkillsWhatsapp(cliente);
}

// ── Fase 168: skills de WhatsApp (codigo -> nombre), solo administrador ──
// El HistChat de Wolkvox trae SKILL_ID y no el nombre; este mapa (tabla
// skills_whatsapp) es el que usa el lector. Se ve solo si el cliente carga
// Tipificacion de WhatsApp y quien entro es administrador (el servidor
// tambien lo exige al guardar).
var _cargasSkillsWppCliente = null;
function _cargasEsAdmin(){
  return (typeof isMasterAdmin === 'function' && isMasterAdmin()) || (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'ADMIN');
}
function _cargasSkillsWppFilaHtml(s){
  return '<div class="cargas-skills-wpp-fila">' +
    '<div class="ig"><label>Código (SKILL_ID)</label><input type="text" inputmode="numeric" class="cargas-skills-wpp-codigo" aria-label="Código del skill (SKILL_ID)" value="'+esc(s.codigo)+'"></div>' +
    '<div class="ig"><label>Nombre del skill</label><input type="text" class="cargas-skills-wpp-nombre" aria-label="Nombre del skill" value="'+esc(s.nombre)+'"></div>' +
    '<button type="button" class="btn-sm cargas-skills-wpp-quitar" onclick="this.parentNode.remove()" aria-label="Quitar este skill">Quitar</button>' +
  '</div>';
}
async function _cargasPintarSkillsWhatsapp(cliente){
  var card = document.getElementById('carga-skills-wpp-card');
  var lista = document.getElementById('carga-skills-wpp-lista');
  if(!card || !lista) return;
  var aplica = !!cliente && _cargasEsAdmin() && _cargasPlan.some(function(h){ return h.tipo==='tipificacion' && h.canalTipificacion==='WHATSAPP'; });
  card.style.display = aplica ? '' : 'none';
  _cargasSkillsWppCliente = aplica ? cliente : null;
  if(!aplica) return;
  lista.innerHTML = '<p class="cargas-skills-wpp-ayuda">Cargando…</p>';
  try{
    var r = await apiRequest('GET','/calidad/tipificacion/skills-whatsapp?campana='+encodeURIComponent(cliente));
    lista.innerHTML = (r.skills || []).map(_cargasSkillsWppFilaHtml).join('') || '';
  }catch(e){ lista.innerHTML = '<p class="cargas-skills-wpp-ayuda">'+esc(e.message)+'</p>'; }
}
function cargasSkillsWppAgregar(){
  var lista = document.getElementById('carga-skills-wpp-lista');
  if(!lista) return;
  lista.insertAdjacentHTML('beforeend', _cargasSkillsWppFilaHtml({ codigo:'', nombre:'' }));
  var nuevos = lista.querySelectorAll('.cargas-skills-wpp-codigo');
  if(nuevos.length) nuevos[nuevos.length-1].focus();
}
async function cargasSkillsWppGuardar(){
  if(!_cargasSkillsWppCliente) return;
  var filas = document.querySelectorAll('#carga-skills-wpp-lista .cargas-skills-wpp-fila');
  var skills = Array.prototype.map.call(filas, function(fl){
    return { codigo: fl.querySelector('.cargas-skills-wpp-codigo').value.trim(), nombre: fl.querySelector('.cargas-skills-wpp-nombre').value.trim() };
  }).filter(function(s){ return s.codigo || s.nombre; });
  try{
    var r = await apiRequest('PUT','/calidad/tipificacion/skills-whatsapp', { campana: _cargasSkillsWppCliente, skills: skills });
    showToast('✓ Skills de WhatsApp guardados: '+(r.skills || []).length+'.');
    await _cargasPintarSkillsWhatsapp(_cargasSkillsWppCliente);
  }catch(e){ showToast(e.message, 'error'); }
}

// ── Plantilla consolidada (descarga) ────────────────────────────
function _cargasInstruccionesAoA(cliente, plan){
  var out = [];
  var put = function(s){ out.push([s]); };
  put('Plantilla consolidada de carga — ' + cliente);
  put('Un archivo, una hoja por tipo de dato. Leela una vez, luego llena cada hoja de abajo.');
  put('');
  put('COMO SE USA');
  put('1. Cada hoja de abajo corresponde a un tipo de dato distinto (ver la lista al final).');
  put('2. Si un tipo de dato NO aplica a esta campana hoy, deja su hoja vacia — no la borres, no la');
  put('   renombres. Una hoja vacia no genera error, el sistema simplemente la ignora.');
  put('3. Escribe SIEMPRE el numero final ya calculado. Nunca una formula de Excel: si una celda de');
  put('   Valor trae una formula sin calcular, el sistema rechaza esa hoja con un mensaje explicito.');
  put('4. Sube este archivo desde esta misma pantalla (Cargar Datos). El sistema valida cada hoja por');
  put('   separado — si una hoja tiene un error, corrigela y vuelve a subir el archivo completo; las');
  put('   hojas que ya estaban bien no se pierden.');
  put('');
  plan.forEach(function(h){
    put('HOJA "' + h.hoja + '" — ' + h.titulo);
    if(h.descripcion) put(h.descripcion);
    if(h.filaUnica){
      put('Formato vertical: una fila por metrica, columnas Metrica / Valor.');
    } else {
      put('Formato horizontal: encabezados en la primera fila, una fila por registro.');
    }
    put('Columnas:');
    h.columnas.forEach(function(c){
      // autoTrafico (Fase 71, ORLANT/resumen): no se lista como fila a
      // llenar -- se explica aparte en notasExtra (nota fija de la hoja).
      // ocultaEnPlantilla (Fase 98, ORLANT/resumen): columna superada por
      // otra fuente real (ej. inasist_* -> tabla `inasistencias`) -- el
      // servidor la sigue aceptando por compatibilidad, pero ya no se pide.
      if(c.autoTrafico || c.ocultaEnPlantilla) return;
      put('  - ' + c.label + (c.opcional ? ' (OPCIONAL, puede quedar vacia)' : ' (OBLIGATORIA)'));
    });
    // notasExtra (Fase 66): lineas adicionales especificas de esta hoja
    // (ejemplo de fila, reglas propias, de donde sale el dato) -- opcional,
    // no cambia nada para las hojas que no lo traen (todas las de siempre).
    (h.notasExtra || []).forEach(function(linea){ put(linea); });
    put('');
  });
  put('FORMATOS');
  put('- Fechas: AAAA-MM-DD, o fecha nativa de Excel.');
  put('- Porcentajes: numero entre 0 y 100 (no entre 0 y 1).');
  put('- Duraciones (ej. AHT): segundos como numero, salvo que la hoja indique otra cosa.');
  return out;
}

function descargarPlantillaConsolidada(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var cliente = document.getElementById('carga-cliente').value;
  if(!cliente || !_cargasPlan.length){ showToast('Selecciona un cliente'); return; }

  var planOrdenado = cargasPlanOrdenParaDescarga(_cargasPlan);
  var wb = XLSX.utils.book_new();

  var wsInstr = XLSX.utils.aoa_to_sheet(_cargasInstruccionesAoA(cliente, planOrdenado));
  wsInstr['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, CARGAS_HOJA_INSTRUCCIONES);

  planOrdenado.forEach(function(h){
    // autoTrafico (Fase 71) + ocultaEnPlantilla (Fase 98): columnas que no
    // se generan como filas/columnas a llenar en el archivo descargable --
    // las autoTrafico se calculan solas desde Trafico; las ocultaEnPlantilla
    // estan superadas por otra fuente real (ver el comentario en
    // dashboard-secciones.js de cada una).
    var columnasPlantilla = (h.columnas || []).filter(function(c){ return !c.autoTrafico && !c.ocultaEnPlantilla; });
    var aoa;
    if(h.filaUnica){
      aoa = [['Metrica','Valor']].concat(columnasPlantilla.map(function(c){ return [c.label, '']; }));
    } else {
      aoa = [columnasPlantilla.map(function(c){ return c.label; })];
      aoa.push(columnasPlantilla.map(function(){ return ''; }));
    }
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = h.filaUnica ? [{wch:42},{wch:16}] : h.columnas.map(function(){ return {wch:20}; });
    XLSX.utils.book_append_sheet(wb, ws, h.hoja);

    // La hoja de Calidad trae ademas Diccionario/Resumen por Asesor de
    // referencia (no se parsean), igual que la plantilla que ya conocian
    // los usuarios de esa carga individual.
    if(h.tipo === 'calidad'){
      var calidad = _cargasCalidadPorCampana[cliente];
      var items = calidad ? calidad.items : [];
      // Fase 117: it.label es texto libre del diccionario de criterios de
      // Calidad (igual que en calidad-carga-masiva.js) -- xlsxFilasSeguras
      // antes de escribirlo evita inyeccion de formulas.
      var dicAoa = [['#','Categoria','Item','Peso %','Critico']].concat(
        items.map(function(it){ return [it.n, it.cat, it.label, it.weight, it.critico ? 'SI' : 'NO']; })
      );
      var wsDic = XLSX.utils.aoa_to_sheet(xlsxFilasSeguras(dicAoa));
      wsDic['!cols'] = [{wch:4},{wch:16},{wch:55},{wch:9},{wch:9}];
      XLSX.utils.book_append_sheet(wb, wsDic, CARGAS_HOJA_DICCIONARIO);

      var wsResumen = XLSX.utils.aoa_to_sheet([['Asesor','# Monitoreos','Promedio','Clasificacion']]);
      wsResumen['!cols'] = [{wch:24},{wch:14},{wch:12},{wch:16}];
      XLSX.utils.book_append_sheet(wb, wsResumen, CARGAS_HOJA_RESUMEN_ASESOR);
    }
  });

  XLSX.writeFile(wb, 'plantilla_consolidada_'+String(cliente).replace(/\s+/g,'_')+'.xlsx');
}

// ── Parseo del archivo consolidado ──────────────────────────────
async function procesarArchivoConsolidado(input){
  var cliente = document.getElementById('carga-cliente').value;
  if(!cliente || !_cargasPlan.length){ showToast('Selecciona un cliente primero'); input.value=''; return; }
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); return; }
  var wb;
  // sheetStubs:true es imprescindible: sin esta opcion, SheetJS descarta por
  // completo (ni siquiera aparece en ws) una celda con formula sin valor
  // cacheado — cargasDetectarFormulaSinValor nunca la veria (verificado
  // contra la libreria real: sin sheetStubs, ws['B2'] da undefined aunque el
  // XML tenga <f> en esa celda; con sheetStubs llega como {t:'z', f, v:0}).
  // cellNF:true (Fase 88): conserva el formato (`z`) de cada celda numerica
  // -- lo necesita traficoParseFilas/traficoWppParseFilas para distinguir
  // una celda con formato de porcentaje REAL de Excel (guarda la fraccion,
  // 0.8649 -> se multiplica x100) de una celda numerica sin ese formato
  // (se deja tal cual, nunca se adivina). No cambia ningun otro valor
  // leido del archivo -- solo agrega metadata de formato a cada celda.
  try{ wb = XLSX.read(new Uint8Array(buf), {type:'array', sheetStubs:true, cellNF:true}); }
  catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var calidad = _cargasCalidadPorCampana[cliente] || null;
  _cargasArchivoNombre = file.name;
  // Fase 66 — compatibilidad hacia atras para campanas con plantilla
  // unificada (2 hojas de Trafico con `canalFijo`, ver cargasPlanConsolidado):
  // un archivo VIEJO de un solo canal sigue trayendo su dato en la hoja
  // "DATA" (nunca "LLAMADAS"/"WHATSAPP") -- si la hoja con el nombre nuevo
  // no esta pero "DATA" si, y su canal detectado coincide con el de este
  // slot, se usa esa. "DATA" solo se consume UNA vez (por el canal que
  // realmente traiga), nunca se le asigna dos veces a ambos slots.
  var dataLegadoUsada = false;
  var wsData = wb.Sheets['DATA'] || null;
  var canalData = null;
  if(wsData){
    var aoaDataHeader = XLSX.utils.sheet_to_json(wsData, {header:1, blankrows:false, defval:null});
    canalData = cargasDetectarCanalTrafico(aoaDataHeader[0]||[], traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario, _cargasCanalElegido());
  }

  // Fase 79 (hallazgo real: los archivos ORIGINALES de Edwin traen la hoja
  // "DATA", nunca "AGENDAS"/"TIPIFICACION_LLAMADAS") -- si una hoja de
  // AGENDAS o de TIPIFICACION DE LLAMADAS (nunca WhatsApp, pedido
  // explicito: comparte encabezados con Llamadas, solo se reconoce por
  // nombre) no esta por su nombre exacto, se busca CUALQUIER hoja del
  // archivo que (a) ningun otro renglon del plan ya reclamo por su nombre
  // exacto, (b) no fue reclamada ya por otro renglon via este mismo
  // mecanismo, y (c) trae TODAS las columnas obligatorias de ese formato
  // (cargasEncabezadosCoinciden, cargas-logic.js) -- una hoja como
  // "GRAFICA" nunca calza y se ignora sin error, tal como antes.
  //
  // Fase 115 (hallazgo real: el archivo de Trafico de Llamadas de Edwin,
  // ago-sep/2026, trae su unica hoja llamada "Hoja1", nunca "LLAMADAS" ni
  // "DATA") -- se agrega 'trafico' a este mismo mecanismo. A diferencia de
  // Tipificacion (Llamadas/WhatsApp SI comparten encabezados, por eso ese
  // slot exige nombre exacto salvo LLAMADAS), las columnas obligatorias de
  // Trafico Llamadas (SKILL_NAME/...) y WhatsApp (NOMBRE_COLA_WHATSAPP/...)
  // son disjuntas -- cargasEncabezadosCoinciden ya alcanza para no confundir
  // una con la otra, pero se verifica ademas el canal detectado
  // (cargasDetectarCanalTrafico) contra canalFijo del slot como defensa
  // adicional, igual de barata.
  var hojasReclamadasPorNombre = {};
  _cargasPlan.forEach(function(h){ if(wb.SheetNames.indexOf(h.hoja)!==-1) hojasReclamadasPorNombre[h.hoja]=true; });
  var hojasUsadasPorEncabezados = {};
  function _cargasBuscarHojaPorEncabezados(h){
    var esTrafico = h.tipo==='trafico';
    // Fase 122: antes, solo Tipificacion de LLAMADAS se reconocia por
    // encabezados -- WhatsApp exigia el nombre EXACTO de hoja
    // (TIPIFICACION_WHATSAPP), asi que un export HistChat de Wolkvox
    // (hoja "HistChat<fecha>-<hora>", cambia en cada export) nunca se
    // reconocia. Ahora los 2 canales de tipificacion entran aqui por igual
    // -- cargasDetectarCanalTipificacion (mas abajo) es quien evita que un
    // archivo de un canal se cuele en el slot del otro.
    var esTipificacion = h.tipo==='tipificacion';
    var esLlamadasUnicas = h.tipo==='llamadas_unicas';
    var esLlamadasSalida = h.tipo==='llamadas_salida';
    var esLlamadasAbandonadas = h.tipo==='llamadas_abandonadas'; // Fase 191
    var esLlamadasNoConectadas = h.tipo==='llamadas_no_conectadas'; // Fase 194
    var esFlujoHora = h.tipo==='flujo_hora'; // Fase 196
    var esWhatsappTiempos = h.tipo==='whatsapp_tiempos';
    var esEncuesta = h.tipo==='encuesta';
    var esCalidadResumen = h.tipo==='calidad_resumen'; // Fase 172
    if(h.tipo!=='agendas' && h.tipo!=='efectividad_agendamiento' && h.tipo!=='inasistencia' && h.tipo!=='citas_atendidas' && h.tipo!=='salida' && !esTrafico && !esTipificacion && !esLlamadasUnicas && !esLlamadasSalida && !esLlamadasAbandonadas && !esLlamadasNoConectadas && !esFlujoHora && !esWhatsappTiempos && !esEncuesta && !esCalidadResumen) return null;
    for(var idx=0; idx<wb.SheetNames.length; idx++){
      var nombre = wb.SheetNames[idx];
      if(nombre===h.hoja) continue; // ya se intento por nombre exacto
      if(hojasReclamadasPorNombre[nombre] || hojasUsadasPorEncabezados[nombre]) continue;
      var wsCandidata = wb.Sheets[nombre];
      // Fase 122 (hallazgo real: archivo de 25.180 filas, 33 columnas --
      // esta funcion corre UNA VEZ POR CADA slot del plan de ORLANT -- antes
      // releia la hoja COMPLETA cada vez solo para mirar aoa[0], confirmado
      // que eso colgaba el navegador mas de 3 minutos con un archivo real)
      // + Fase 127 (correccion de un hallazgo real con Playwright: acotar a
      // UN SOLO renglon rompia con un encabezado que no esta en la primera
      // fila del rango usado de la hoja, ej. renglones vacios antes -- ver
      // cargasLeerEncabezadoAcotado, cargas-logic.js, para el detalle).
      var headerRow0 = cargasLeerEncabezadoAcotado(XLSX.utils, wsCandidata, 20);
      // Fase 147 (Parte B): el export de la encuesta trae una fila de textos
      // sueltos ANTES del encabezado -- se busca en las primeras 20 filas.
      if(esEncuesta){
        if(encuestaBuscarEncabezado(_cargasPrimerasFilas(wsCandidata, 20), 20) === -1) continue;
      // Fase 168: el HistChat NUEVO (SKILL_ID, sin SKILL_NAME) entra al slot de WhatsApp.
      } else if(esCalidadResumen){
        // Fase 172: encabezado con "← Escribir aquí", espacios y sin distinguir mayusculas.
        var mapCR = calidadResumenColIndexMap(headerRow0);
        if(CALIDAD_RESUMEN_COLUMNAS.some(function(c){ return c.obligatoria && mapCR[c.key] === undefined; })) continue;
      } else if(!cargasEncabezadosCoinciden(headerRow0, h.columnas) &&
        !(h.tipo==='agendas' && agendasEsBaseCruda(headerRow0)) && // Fase 210: base cruda del aplicativo
        !(esTipificacion && h.canalTipificacion==='WHATSAPP' && cargasEsHistChatPorSkillId(headerRow0))) continue;
      if(esTrafico && h.canalFijo && cargasDetectarCanalTrafico(headerRow0, traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario, _cargasCanalElegido()) !== h.canalFijo) continue;
      // Fase 122: un archivo de voz (HistCDR, trae SKILL_NAME) nunca debe
      // colarse en el slot de WhatsApp, ni un HistChat (trae NOMBRE DE
      // SKILL) en el de Llamadas -- cargasEncabezadosCoinciden por si sola
      // no alcanza a distinguirlos (comparten agente/fecha/tipificacion/
      // skill-via-alias).
      if(esTipificacion && h.canalTipificacion && cargasDetectarCanalTipificacion(headerRow0) !== h.canalTipificacion) continue;
      // Fase 141: un CDR de Tipificacion (trae SKILL_NAME, y puede traer
      // TELEPHONE/SKILL_ID) nunca debe colarse en el slot de salida.
      if(esLlamadasSalida && (headerRow0 || []).some(function(c){ return String(c == null ? '' : c).trim().toUpperCase() === 'SKILL_NAME'; })) continue;
      // Fase 196: el reporte por hora (trae HOUR) nunca entra en Flujo de Llamadas, y uno diario nunca en Flujo por hora.
      var traeHour = (headerRow0 || []).some(function(c){ return String(c == null ? '' : c).trim().toUpperCase() === 'HOUR'; });
      if(esTrafico && traeHour) continue;
      if(esFlujoHora && !traeHour) continue;
      // Fase 191: el reporte de abandonadas trae ANI y RESULT; un CDR (TELEPHONE, AGENT_NAME) nunca entra aqui.
      if(esLlamadasAbandonadas && (headerRow0 || []).some(function(c){ var t = String(c == null ? '' : c).trim().toUpperCase(); return t === 'AGENT_NAME' || t === 'TELEPHONE'; })) continue;
      hojasUsadasPorEncabezados[nombre] = true;
      return nombre;
    }
    return null;
  }

  // Primeras maxFilas filas con contenido de una hoja (acotado, nunca la
  // hoja completa -- mismo criterio de cargasLeerEncabezadoAcotado).
  function _cargasPrimerasFilas(ws, maxFilas){
    if(!ws || !ws['!ref']) return [];
    var rg = XLSX.utils.decode_range(ws['!ref']);
    var rango = { s: rg.s, e: { r: Math.min(rg.s.r + maxFilas, rg.e.r), c: rg.e.c } };
    return XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:null, range: rango });
  }

  // Fase 168: mapa codigo -> skill de WhatsApp del cliente (HistChat por
  // SKILL_ID). Sin mapa (error de red), el lector lo dice en vez de adivinar.
  _cargasSkillsWhatsappMapa = null;
  if(_cargasPlan.some(function(h){ return h.tipo==='tipificacion' && h.canalTipificacion==='WHATSAPP'; })){
    try{
      var skillsWpp = await apiRequest('GET','/calidad/tipificacion/skills-whatsapp?campana='+encodeURIComponent(cliente));
      _cargasSkillsWhatsappMapa = {};
      (skillsWpp.skills || []).forEach(function(s){ _cargasSkillsWhatsappMapa[s.codigo] = s.nombre; });
    }catch(e){ _cargasSkillsWhatsappMapa = null; }
  }

  // Fase 210: Clasificacion de lineas (codigos de entidad) para la base cruda
  // de Agendas. Sin lista (error de red o cliente sin ella), el lector de la
  // base cruda lo dice en vez de mandar codigos sin proteger.
  _cargasCodigosEntidad = null;
  if(_cargasPlan.some(function(h){ return h.tipo==='agendas'; })){
    try{
      var ce = await apiRequest('GET','/calidad/agendas/codigos-entidad?campana='+encodeURIComponent(cliente));
      _cargasCodigosEntidad = (ce.codigos || []).map(function(c){ return c.codigo; });
    }catch(e){ _cargasCodigosEntidad = null; }
  }

  _cargasResultados = _cargasPlan.map(function(h){
    var resuelto = cargasResolverHojaTrafico(h, wb.SheetNames, !!wsData, canalData, dataLegadoUsada);
    var reconocidaPorEncabezadosComo = null;
    if(!resuelto.hojaReal){
      var porEncabezados = _cargasBuscarHojaPorEncabezados(h);
      if(porEncabezados){ resuelto = { hojaReal: porEncabezados, usoData: false }; reconocidaPorEncabezadosComo = porEncabezados; }
    }
    var ws = resuelto.hojaReal ? wb.Sheets[resuelto.hojaReal] : undefined;
    if(resuelto.usoData) dataLegadoUsada = true;
    var defval = h.tipo==='seccion' ? '' : null;
    var aoa = ws ? XLSX.utils.sheet_to_json(ws, {header:1, blankrows:false, defval:defval}) : null;
    var parseFn;
    if(h.tipo === 'seccion'){
      var spec = _cargasSpec.secciones[h.hoja];
      parseFn = function(a){ return spec.filaUnica ? cargasParseFilaUnica(spec, a) : cargasParseMultiFila(spec, a); };
    } else if(h.tipo === 'calidad'){
      parseFn = function(a){ return cmParseRows(a, calidad.items); };
    } else if(h.tipo === 'agendas'){
      parseFn = function(a, w){ return agendasParseFilas(a, w, { codigosEntidad: _cargasCodigosEntidad }); };
    } else if(h.tipo === 'efectividad_agendamiento'){
      // Fase 122: `ws` (2do param de cargasProcesarHoja) para que la
      // columna EFECTIVIDAD use el formato real de celda (ver
      // efectividad-agendamiento-logic.js) -- `ahora` (2do param real de la
      // funcion) se deja en null, la hora REAL del sistema (mismo
      // comportamiento que siempre, nunca se le paso `ahora` desde aqui).
      parseFn = function(a, w){ return efectividadAgendamientoParseFilas(a, null, w); };
    } else if(h.tipo === 'tipificacion'){
      // Fase 122: el canal (LLAMADAS/WHATSAPP) decide si se aplica la
      // eliminacion de duplicados exactos de la Fase 88 (ver
      // tipificacion-logic.js) -- WhatsApp (Wolkvox/HistChat) nunca la
      // aplica, Llamadas y el formato viejo siguen igual que siempre.
      parseFn = function(a, w){
        var opc = h.canalTipificacion === 'WHATSAPP'
          ? Object.assign({}, h.opcionesTipificacion || {}, { skillsWhatsapp: _cargasSkillsWhatsappMapa })
          : h.opcionesTipificacion;
        return tipificacionParseFilas(a, w, h.canalTipificacion, opc);
      };
    } else if(h.tipo === 'llamadas_unicas'){
      parseFn = llamadasUnicasParseFilas;
    } else if(h.tipo === 'llamadas_salida'){
      parseFn = llamadasSalidaParseFilas;
    } else if(h.tipo === 'llamadas_abandonadas'){
      parseFn = llamadasAbandonadasParseFilas; // Fase 191
    } else if(h.tipo === 'llamadas_no_conectadas'){
      parseFn = llamadasNoConectadasParseFilas; // Fase 194
    } else if(h.tipo === 'flujo_hora'){
      parseFn = flujoHoraParseFilas; // Fase 196
    } else if(h.tipo === 'whatsapp_tiempos'){
      parseFn = wppTiemposParseFilas;
    } else if(h.tipo === 'calidad_resumen'){
      parseFn = calidadResumenParseFilas; // Fase 172 (recibe la hoja cruda: celdas en error)
    } else if(h.tipo === 'encuesta'){
      parseFn = encuestaParseFilas;
    } else if(h.tipo === 'inasistencia'){
      parseFn = inasistenciaParseFilas;
    } else if(h.tipo === 'citas_atendidas'){
      // Fase 122: mismo motivo que efectividad_agendamiento -- `ws` para el
      // formato real de la celda EFECTIVIDAD CITAS ATENDIDAS.
      parseFn = function(a, w){ return citasAtendidasParseFilas(a, null, w); };
    } else if(h.tipo === 'salida'){
      // Fase 127: en la vista previa se usa la inferencia de año SILENCIOSA
      // de siempre (anioForzado=null) -- la confirmacion/correccion explicita
      // del año (pedido textual de Edwin) ocurre en _cargasGuardarSalida,
      // justo antes de guardar, nunca aqui.
      parseFn = function(a){ return salidaParseFilas(a, null); };
    } else {
      parseFn = _cargasParseTraficoAuto;
    }
    // `h` conserva su `hoja` "oficial" (LLAMADAS/WHATSAPP/AGENDAS/
    // TIPIFICACION_LLAMADAS) para el mensaje de "hoja ausente" y la vista
    // previa, aunque el dato real haya salido de "DATA" (por el fallback
    // de canal o el de encabezados) -- cargasProcesarHoja solo mira si `ws`
    // es null o no, nunca vuelve a buscarla por nombre.
    // Fase 159: si ninguna hoja calzo, pero alguna se parece al formato
    // (le faltan columnas obligatorias), el aviso dice cuales faltan y que
    // encabezados trae, en vez de "No se encontro la hoja DATA".
    var diagnostico = null;
    if(!ws && h.columnas){
      diagnostico = cargasDiagnosticoSinHoja(h.titulo, wb.SheetNames
        .filter(function(n){ return !hojasReclamadasPorNombre[n] && !hojasUsadasPorEncabezados[n]; })
        .map(function(n){ return { nombre: n, encabezado: cargasLeerEncabezadoAcotado(XLSX.utils, wb.Sheets[n], 20) }; }), h.columnas);
    }
    var res = cargasProcesarHoja(h, aoa, ws, parseFn, wb.SheetNames, diagnostico);
    if(reconocidaPorEncabezadosComo) res.reconocidaPorEncabezadosComo = reconocidaPorEncabezadosComo;
    return res;
  });

  // Fase 202: "Calidad: resumen por asesor" con una hoja por mes (AGOSTO,
  // SEPTIEMBRE...): se leen TODAS las hojas con nombre de mes y el formato de
  // la plantilla, cada una para su mes. Un archivo de una sola hoja sin
  // nombre de mes ("Hoja1") sigue igual: va al mes elegido.
  _cargasResultados = _cargasResultados.map(function(r){
    if(r.tipo !== 'calidad_resumen') return r;
    var planCR = _cargasPlan.filter(function(h){ return h.tipo === 'calidad_resumen'; })[0];
    var hojasMes = wb.SheetNames.filter(function(n){
      if(!calidadResumenMesDeHoja(n)) return false;
      var mapH = calidadResumenColIndexMap(cargasLeerEncabezadoAcotado(XLSX.utils, wb.Sheets[n], 20));
      return !CALIDAD_RESUMEN_COLUMNAS.some(function(c){ return c.obligatoria && mapH[c.key] === undefined; });
    });
    if(!hojasMes.length || !planCR) return r;
    var porMes = hojasMes.map(function(n){
      var wsM = wb.Sheets[n];
      var resM = cargasProcesarHoja(planCR, XLSX.utils.sheet_to_json(wsM, {header:1, blankrows:false, defval:null}), wsM, calidadResumenParseFilas, wb.SheetNames, null);
      var infoM = calidadResumenMesDeHoja(n);
      return { hoja: n, info: infoM, periodo: calidadResumenPeriodoDeHoja(infoM, _cargasMesReferenciaCalidad(cliente)), filas: resM.filas || [], monitoreos: resM.monitoreos || 0, promedio: resM.promedio, error: resM.error || null, avisos: resM.avisos || [] };
    });
    var avisos = [];
    porMes.forEach(function(m){
      if(m.error) avisos.push('Hoja '+m.hoja+': '+m.error);
      m.avisos.forEach(function(a){ avisos.push('Hoja '+m.hoja+': '+a); });
    });
    var validos = porMes.filter(function(m){ return !m.error && m.filas.length; });
    var nums = validos.map(function(m){ return m.periodo; });
    if(nums.some(function(x, k){ return nums.indexOf(x) !== k; })) return Object.assign({}, r, { filas: undefined, porMes: undefined, error: 'El archivo trae dos hojas del mismo mes. Deja una sola hoja por mes.' });
    if(!validos.length) return Object.assign({}, r, { filas: undefined, error: avisos.join(' ') || 'Ninguna hoja de mes trae asesores.' });
    return Object.assign({}, r, { error: undefined, vacia: false, reconocidaPorEncabezadosComo: undefined, porMes: validos, avisos: avisos,
      filas: validos.reduce(function(a, m){ return a.concat(m.filas); }, []),
      monitoreos: validos.reduce(function(a, m){ return a + m.monitoreos; }, 0) });
  });

  // Fase 153 (PR 4): desde el Centro, solo las filas de ese mes. Fase 163:
  // en Flujo de Llamadas todas las skills son de ese cliente; las que no
  // tiene se registran solas al guardar y la vista previa lo dice antes.
  var focoArch = _cargasFocoActivo(cliente);
  if(focoArch){
    var skillsDelCliente = null;
    if(focoArch.carga==='flujo_llamadas' && _cargasResultados.some(function(r){ return r.tipo==='trafico' && r.filas; })){
      try{
        skillsDelCliente = {};
        (await apiRequest('GET','/calidad/trafico/skills') || []).forEach(function(s){ if(s.campana===cliente) skillsDelCliente[s.skillName] = true; });
      }catch(e){ showToast(e.message, 'error'); input.value=''; _cargasResultados = []; return; }
    }
    _cargasResultados = _cargasResultados.map(function(r){
      var f = centroFiltrarResultado(r, focoArch.carga, focoArch.mes);
      if(skillsDelCliente && f.tipo==='trafico' && f.filas){
        var avisoSkills = centroAvisoSkillsNuevas(cliente, f.filas, skillsDelCliente);
        if(avisoSkills) f.avisos = [avisoSkills].concat(f.avisos || []);
      }
      // Encuesta: los conteos de la vista previa, de las filas que quedaron.
      // Fase 168: Tipificacion -- cuantas de salida, de las filas que quedaron.
      if(f.tipo==='tipificacion' && f.filas && f.centroIgnoradas){
        f.salida = f.filas.filter(function(x){ return x.tipoInteraccion==='outbound_ma'; }).length;
      }
      // Fase 165: WhatsApp tiempos -- igual, rangos y días de las filas que quedaron.
      if(f.tipo==='whatsapp_tiempos' && f.filas && f.centroIgnoradas){
        f.porRango = {};
        WPP_TIEMPOS_RANGOS.forEach(function(x){ f.porRango[x.key] = 0; });
        f.filas.forEach(function(x){ f.porRango[wppTiemposRangoDe(x[3])]++; });
        f.dias = Object.keys(f.filas.reduce(function(a, x){ a[x[1]] = true; return a; }, {})).length;
      }
      if(f.tipo==='encuesta' && f.filas && f.centroIgnoradas){
        f.conteos = encuestaConteos(f.filas);
        f.dias = Object.keys(f.filas.reduce(function(a, x){ a[x[0]] = true; return a; }, {})).length;
      }
      return f;
    });
    // Reemplazo parcial: el lector cambia SOLO las fechas que trae el
    // archivo; se dice cuales y cuantos registros del mes quedan igual.
    for(var ri=0; ri<_cargasResultados.length; ri++){
      var rr = _cargasResultados[ri];
      if(!rr.filas) continue;
      // Modulos mensuales: el lector reemplaza el mes entero.
      if(centroEsMensual(focoArch.carga)){
        try{
          var conteoMes = await apiRequest('GET','/centro-cargas/'+encodeURIComponent(cliente)+'/'+encodeURIComponent(focoArch.carga)+'/'+focoArch.mes+'/conteo?desde='+focoArch.mes+'-01&hasta='+focoArch.mes+'-31');
          rr.avisos = [centroTextoReemplazoMensual(focoArch.mes, conteoMes)].concat(rr.avisos || []);
        }catch(e){ /* sin el conteo, la vista previa sigue con sus avisos de siempre */ }
        continue;
      }
      var rango = centroRangoFilas(focoArch.carga, rr.filas);
      if(!rango) continue;
      try{
        var conteo = await apiRequest('GET','/centro-cargas/'+encodeURIComponent(cliente)+'/'+encodeURIComponent(focoArch.carga)+'/'+focoArch.mes+'/conteo?desde='+encodeURIComponent(rango.desde)+'&hasta='+encodeURIComponent(rango.hasta));
        rr.avisos = [centroTextoReemplazoParcial(focoArch.mes, rango, conteo)].concat(rr.avisos || []);
      }catch(e){ /* sin el conteo, la vista previa sigue con sus avisos de siempre */ }
      // Fase 159: si el archivo no trae el mes completo, se dice claro.
      var cobertura = centroTextoCobertura(focoArch.mes, rr.filas.map(function(f){ return centroFechaFila(focoArch.carga, f); }), fechaLimitesHoyColombia());
      if(cobertura && !centroOmiteCobertura(focoArch.carga)) rr.avisos = [cobertura].concat(rr.avisos || []);
    }
    if(!_cargasResultados.some(function(r){ return r.filas; })){
      var err = _cargasResultados.filter(function(r){ return r.error; })[0];
      showToast(err ? err.error : 'El archivo no trae datos de ' + focoArch.nombre + '.', 'error');
      input.value=''; _cargasResultados = [];
      return;
    }
  }

  if(!_cargasResultados.some(function(r){ return r.filas; })){
    var hojasEsperadas = _cargasPlan.map(function(h){ return h.hoja; }).join(', ');
    var hojasEncontradas = wb.SheetNames.join(', ') || '(el archivo no tiene ninguna hoja)';
    showToast('El archivo no tiene datos en ninguna hoja reconocida (¿subiste la plantilla de este cliente?). ' +
      'Hojas que trae tu archivo: ' + hojasEncontradas + '. Hojas que espera ' + cliente + ': ' + hojasEsperadas + '.');
    input.value='';
    _cargasResultados = [];
    return;
  }

  _renderPreviewCarga();
}

function _cargasEstadoLabel(r){
  if(r.error) return '<span style="color:var(--c-danger-dark)">&#9888; '+esc(r.error)+'</span>';
  if(r.vacia) return '<span style="color:var(--c-text-muted)">Vacia — no aplica esta vez</span>';
  var extra = '';
  // Fase 78: transparencia de privacidad -- la vista previa dice CUANTAS
  // filas se agruparon por el umbral de entidad, nunca cuales (el nombre
  // original nunca llega hasta aqui: agendasAplicarPrivacidadEntidad ya lo
  // reemplazo dentro de agendasParseFilas, antes de que este codigo lo vea).
  if(r.tipo==='agendas' && (r.entidadesAgrupadas || r.entidadesSinDato)){
    extra = ' — '+(r.entidadesAgrupadas||0)+' fila(s) con entidad agrupada por privacidad (PARTICULAR / OTRA), '+
      (r.entidadesSinDato||0)+' sin entidad (SIN ENTIDAD)';
  }
  // Fase 210: base cruda del aplicativo -- usuarios y codigos fuera de la lista (suman a 3P).
  if(r.tipo==='agendas' && r.formato==='cruda'){
    extra += ' — base del aplicativo: '+r.usuarios+' usuario(s); '+(r.codigosFueraDeLista + r.codigosVacios)+
      ' fila(s) con código de entidad fuera de la Clasificación de líneas o vacío (suman a 3P, el código no se guarda)';
  }
  // Fase 79: cuando la hoja no traia el nombre esperado pero sus
  // encabezados calzaron exacto con el formato (archivo ORIGINAL de
  // Edwin, hoja "DATA"), se dice explicitamente cual hoja se uso.
  // Fase 172: Calidad resumen -- asesores, monitoreos y promedio ponderado.
  if(r.tipo==='calidad_resumen' && r.filas && r.filas.length){
    extra = ' — '+r.filas.length+' asesor(es), '+r.monitoreos+' monitoreo(s), promedio '+String(r.promedio).replace('.', ',')+' %';
    // Fase 202: una hoja por mes -- los totales de cada mes y a que mes va cada hoja.
    if(r.porMes){
      extra = ' — una hoja por mes, cada una a su mes: ' + r.porMes.map(function(m){
        var per = m.periodo;
        return m.hoja+' → '+(per ? mesNombreLargo(per) : '¿año?')+': '+m.filas.length+' asesor(es), '+m.monitoreos+' monitoreo(s), promedio '+String(m.promedio).replace('.', ',')+' %';
      }).join('; ');
    }
  }
  // Fase 168: Tipificacion -- cuantas de salida y cuantas ignoradas por skill.
  if(r.tipo==='tipificacion' && r.filas && r.filas.length && typeof r.salida === 'number'){
    extra = ' — de salida: '+r.salida+(r.ignoradasPorSkill ? ', ignoradas por skill: '+r.ignoradasPorSkill : '');
  }
  // Fase 142 (punto 4): WhatsApp tiempos -- solo conteos (ignoradas por no
  // ser WhatsApp, dias y cantidad por rango), nunca filas.
  if(r.tipo==='whatsapp_tiempos' && r.porRango){
    extra = ' — '+r.ignoradasNoWhatsapp+' fila(s) ignoradas (no son de WhatsApp), '+(r.vacias||0)+' fila(s) vacías omitidas, '+r.dias+' día(s); por rango: '+
      WPP_TIEMPOS_RANGOS.map(function(x){ return x.label+' '+r.porRango[x.key]; }).join(', ');
  }
  // Fase 159: Flujo de Llamadas -- fechas, skills y llamadas que entran,
  // para revisar antes de guardar.
  if(r.tipo==='trafico' && r.canal!=='whatsapp' && r.filas && r.filas.length){
    var rt = traficoResumenCarga(r.filas);
    extra = ' — del '+rt.desde+' al '+rt.hasta+' ('+rt.dias+' día(s) con datos); skills: '+rt.skills.join(', ')+
      '; ingresadas '+rt.ingresadas+', contestadas '+rt.contestadas+', abandonadas '+rt.abandonadas+
      '; filas omitidas '+(r.avisos||[]).filter(function(a){ return /se omiti/i.test(a); }).length;
  }
  // Fase 147 (Parte B): Encuesta -- solo conteos por pregunta, nunca filas.
  // Fase 163: Llamadas Unicas -- contestadas (con asesor) y abandonadas
  // (sin asesor), de las filas que entran, para revisar antes de guardar.
  if(r.tipo==='llamadas_unicas' && r.filas && r.filas.length){
    var abandLu = r.filas.filter(function(f){ return f[2]==='ABANDONADA'; }).length;
    extra = ' — contestadas únicas '+(r.filas.length-abandLu)+', abandonadas únicas (sin asesor) '+abandLu;
  }
  // Fase 191: abandonadas unicas y las columnas que se usaron.
  if(r.tipo==='llamadas_abandonadas' && r.filas && r.filas.length){
    extra = ' — abandonadas únicas '+r.abandonadas+' ('+(r.duplicadosQuitados||0)+' repetida(s) el mismo día); columnas usadas: '+(r.columnasUsadas||[]).join(', ');
  }
  // Fase 196: flujo por hora -- totales del archivo (los mismos que el mapa).
  if(r.tipo==='flujo_hora' && r.filas && r.filas.length){
    var thIng = 0, thCon = 0, thAb = 0;
    r.filas.forEach(function(f){ thIng += f[3]; thCon += f[4]; thAb += f[5]; });
    extra = ' — ingresadas '+thIng+', contestadas '+thCon+', abandonadas '+thAb;
  }
  // Fase 194: no conectadas -- todas las filas (sin quitar repetidas) y las columnas usadas.
  if(r.tipo==='llamadas_no_conectadas' && r.filas && r.filas.length){
    extra = ' — no conectadas '+r.filas.length+' (cada fila cuenta); columnas usadas: '+(r.columnasUsadas||[]).join(', ');
  }
  // Fase 191: CDR de Mobilize -- llamadas unicas de ingreso que salen de este archivo.
  if(r.tipo==='tipificacion' && r.unicasDia && r.filas && r.filas.length){
    extra += '; llamadas de ingreso '+r.unicasDia.ingreso+', únicas por día '+r.unicasDia.unicas;
  }
  if(r.tipo==='encuesta' && r.conteos){
    extra = ' — '+r.dias+' día(s); '+encuestaResumenTexto(r.conteos);
    // Fase 193: columnas que se usaron y filas con ID de llamada (de las filas que entran, ya filtradas por mes en el Centro).
    if(r.columnasUsadas) extra += '; columnas usadas: '+r.columnasUsadas.join(', ')+(r.columnasIgnoradas ? ' ('+r.columnasIgnoradas+' columna(s) del archivo no se leen)' : '')+
      '; con ID de llamada '+r.filas.filter(function(f){ return !!f[8]; }).length+' de '+r.filas.length;
  }
  var reconocida = r.reconocidaPorEncabezadosComo ? ' (hoja "'+esc(r.reconocidaPorEncabezadosComo)+'" reconocida como '+esc(r.titulo)+')' : '';
  return '<span style="color:var(--c-success-dark)">OK — '+r.filas.length+' fila(s)'+(r.avisos && r.avisos.length ? ', '+r.avisos.length+' aviso(s)' : '')+esc(extra)+'</span>'+reconocida;
}

function _renderPreviewCarga(){
  document.getElementById('carga-preview-nombre').textContent = _cargasArchivoNombre;
  var html = '<tr><th>Hoja</th><th>Tipo</th><th>Estado</th></tr>';
  html += _cargasResultados.map(function(r){
    var tipoLabel = r.tipo==='seccion' ? 'Gestion de base' : (r.tipo==='calidad' ? 'Calidad' :
      (r.tipo==='agendas' ? 'Agendas' :
      (r.tipo==='inasistencia' ? 'Inasistencia' :
      // Fase 153: sin estas tres, la vista previa las rotulaba "Trafico de Llamadas".
      (r.tipo==='citas_atendidas' ? 'Efectividad de Citas' :
      (r.tipo==='efectividad_agendamiento' ? 'Efectividad de Agendamiento' :
      (r.tipo==='salida' ? 'Salida (Llamadas y WhatsApp)' :
      (r.tipo==='tipificacion' ? ('Tipificación de '+(r.canalTipificacion==='WHATSAPP'?'WhatsApp':'Llamadas')) :
      (r.tipo==='llamadas_unicas' ? 'Llamadas Únicas' :
      (r.tipo==='llamadas_salida' ? 'Llamadas de salida' :
      r.tipo==='llamadas_abandonadas' ? 'Llamadas abandonadas' :
      r.tipo==='llamadas_no_conectadas' ? 'Llamadas de salida no conectadas' :
      r.tipo==='flujo_hora' ? 'Flujo por hora' :
      (r.tipo==='whatsapp_tiempos' ? 'WhatsApp tiempos de respuesta' :
      r.tipo==='calidad_resumen' ? 'Calidad: resumen por asesor' :
      (r.tipo==='encuesta' ? 'Encuesta' :
      (r.canal==='whatsapp' ? 'Trafico de WhatsApp' : 'Trafico de Llamadas'))))))))))));
    return '<tr><td>'+esc(r.titulo)+'</td><td>'+esc(tipoLabel)+'</td><td>'+_cargasEstadoLabel(r)+'</td></tr>';
  }).join('');
  var avisos = [];
  _cargasResultados.forEach(function(r){ (r.avisos||[]).forEach(function(a){ avisos.push(r.titulo+': '+a); }); });
  document.getElementById('carga-errores').innerHTML = avisos.map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  document.getElementById('carga-preview-table').innerHTML = html;
  document.getElementById('carga-preview-card').style.display = '';
}

function cancelarPreviewCarga(){
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
}

// ── Guardado (una llamada por hoja con datos, a la ruta que ya existia) ──
async function _cargasGuardarSeccion(cliente, periodo, r){
  var spec = _cargasSpec.secciones[r.hoja];
  var payload = { cliente: cliente, seccion: r.hoja, cadencia: spec.cadencia, periodo: periodo, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    await apiRequest('POST','/dashboard/cargas', payload);
    return { ok:true };
  }catch(e){
    if(e && e.status===409 && e.data && e.data.yaExiste){
      var d=e.data;
      var quien=d.cargadoPorNombre ? (' por '+d.cargadoPorNombre) : '';
      var cuando=d.cargadoEn ? (' el '+d.cargadoEn) : '';
      if(!confirm('Ya existe una carga para '+d.cliente+' / '+d.seccion+' / '+d.periodo+
                  ' (cargada'+quien+cuando+'). ¿Reemplazarla con este archivo?')){
        return { ok:false, mensaje: 'Se dejo la carga anterior sin tocar.' };
      }
      try{
        await apiRequest('POST','/dashboard/cargas', Object.assign({}, payload, { reemplazar:true }));
        return { ok:true };
      }catch(e2){ return { ok:false, mensaje: e2.message }; }
    }
    return { ok:false, mensaje: e.message };
  }
}

async function _cargasGuardarCalidad(cliente, r){
  try{
    var resp = await apiRequest('POST','/monitoreos/bulk', { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas });
    return { ok:true, mensaje: (resp.insertadas||0)+' nueva(s), '+(resp.actualizadas||0)+' actualizada(s), '+(resp.omitidas||0)+' omitida(s)' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

async function _cargasGuardarTrafico(r, campana){
  var parsed = { archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(campana) parsed.campana = campana;
  try{
    var impacto = await apiRequest('POST','/calidad/trafico/carga/impacto', parsed);
    // Fase 115: la carga reemplaza TODO el rango de fechas que trae el
    // archivo, por skill -- no solo los dias presentes (ver
    // nivel-servicio-diario.js). filasABorrar son registros que YA existen
    // dentro de ese rango pero que este archivo no trae (se borran, nunca
    // quedan huerfanos como paso con un residuo de prueba de la Fase 67).
    var afectados = (impacto||[]).filter(function(p){ return p.filasExistentes>0 || p.filasABorrar>0; });
    if(afectados.length){
      var detalle = afectados.map(function(p){
        var partes = [];
        if(p.filasExistentes>0) partes.push(p.filasExistentes+' existente(s) se reemplazan');
        if(p.filasABorrar>0) partes.push(p.filasABorrar+' se borran (no vienen en el archivo nuevo)');
        return '• ' + p.skillName + ' — ' + p.mes + ': ' + partes.join(', ');
      }).join('\n');
      var totalExistentes = afectados.reduce(function(a,p){ return a+p.filasExistentes; }, 0);
      var totalABorrar = afectados.reduce(function(a,p){ return a+(p.filasABorrar||0); }, 0);
      var msg = 'La hoja de Trafico va a REEMPLAZAR '+totalExistentes+' registro(s) ya cargados';
      if(totalABorrar>0) msg += ' y BORRAR '+totalABorrar+' registro(s) que ya no vienen en el archivo nuevo';
      msg += ':\n\n'+detalle+'\n\n¿Continuar?';
      if(!confirm(msg)){
        return { ok:false, mensaje: 'Se dejo el trafico anterior sin tocar.' };
      }
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/trafico/carga', parsed);
    _trafico = {}; // invalida el cache de los paneles trafico_combo abiertos
    return { ok:true, mensaje: resp.insertadas+' fila(s) en '+resp.campanas.length+' campana(s)'+
      (resp.borradas ? ', '+resp.borradas+' borrada(s) fuera del archivo nuevo' : '')+
      (resp.skillsSinAsignar && resp.skillsSinAsignar.length ? '. '+resp.skillsSinAsignar.length+' skill(s) sin asignar' : '')+
      (resp.skillsRegistradas && resp.skillsRegistradas.length ? '. Skills nuevas registradas: '+resp.skillsRegistradas.join(', ') : '') };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Trafico de WhatsApp no tiene mapeo skill->campana (a diferencia de voz):
// la campana se manda explicita, es el mismo cliente seleccionado en este
// modal (mismo patron "clasico" que _cargasGuardarSeccion/_cargasGuardarCalidad).
//
// Fase 115: igual que voz (_cargasGuardarTrafico), pide impacto -> confirma
// -> guarda -- la carga reemplaza TODO el rango de fechaInicio que trae el
// archivo, por cola (ver cargarTraficoWhatsapp), asi que puede BORRAR
// periodos que ya no vienen en el archivo nuevo, no solo reemplazar los que
// si vienen.
async function _cargasGuardarTraficoWhatsapp(cliente, r){
  var payload = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    var impacto = await apiRequest('POST','/calidad/trafico/whatsapp/carga/impacto', payload);
    var afectados = (impacto||[]).filter(function(p){ return p.filasExistentes>0 || p.filasABorrar>0; });
    if(afectados.length){
      var detalle = afectados.map(function(p){
        var partes = [];
        if(p.filasExistentes>0) partes.push(p.filasExistentes+' existente(s) se reemplazan');
        if(p.filasABorrar>0) partes.push(p.filasABorrar+' se borran (no vienen en el archivo nuevo)');
        return '• ' + p.colaWhatsapp + ' — ' + p.fechaInicio + ' a ' + p.fechaFin + ': ' + partes.join(', ');
      }).join('\n');
      var totalExistentes = afectados.reduce(function(a,p){ return a+p.filasExistentes; }, 0);
      var totalABorrar = afectados.reduce(function(a,p){ return a+(p.filasABorrar||0); }, 0);
      var msg = 'La hoja de Trafico de WhatsApp va a REEMPLAZAR '+totalExistentes+' periodo(s) ya cargado(s)';
      if(totalABorrar>0) msg += ' y BORRAR '+totalABorrar+' periodo(s) que ya no vienen en el archivo nuevo';
      msg += ':\n\n'+detalle+'\n\n¿Continuar?';
      if(!confirm(msg)){
        return { ok:false, mensaje: 'Se dejo el trafico de WhatsApp anterior sin tocar.' };
      }
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/trafico/whatsapp/carga', payload);
    if(typeof _traficoWpp !== 'undefined') _traficoWpp = {}; // invalida el cache del panel de WhatsApp abierto
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+resp.colas.length+' cola(s))'+
      (resp.borradas ? ', '+resp.borradas+' borrada(s) fuera del archivo nuevo' : '') };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 78 (ORLANT): mismo patron que _cargasGuardarTrafico (impacto ->
// confirmar -> guardar), pero el periodo sale de los DATOS mismos
// (primera..ultima FECHA_SOLICITUD del archivo), no de un selector de
// mes/skill -- ver agendasRangoFechas (agendas-logic.js) y
// server/agendas.js (que recalcula el mismo rango del lado del servidor,
// nunca confia en un rango que mande el navegador).
// Fase 122 (alias de nombre de asesor): frase comun de transparencia para
// los 3 dialogos de confirmacion que pueden traer agente/asesor (Agendas,
// Tipificacion, Efectividad de Agendamiento) -- "cantidad, no listado": el
// nombre real nunca llega hasta aqui (ya lo resolvio el servidor antes de
// responder el impacto). Cadena vacia si no hubo ningun alias aplicable.
function _cargasFraseAlias(impacto){
  if(!impacto || !impacto.filasUnificadasPorAlias) return '';
  return impacto.filasUnificadasPorAlias+' fila(s) con '+impacto.asesoresUnificadosPorAlias+
    ' nombre(s) de asesor distinto(s) se van a unificar por alias.';
}
function _agendasFmtFechaCorta(fechaHora){
  // "2025-04-01 08:00:00" -> "01/04" (solo lo que el mensaje de
  // confirmacion necesita mostrar, igual al ejemplo del pedido de Edwin).
  var d = String(fechaHora||'').slice(0,10).split('-');
  return d.length===3 ? (d[2]+'/'+d[1]) : String(fechaHora||'');
}
async function _cargasGuardarAgendas(cliente, r){
  // Payload compacto (arrays, no objetos) -- ver la nota de tamaño en
  // validation.js (agendasCargaBody) y agendas-logic.js (agendasFilaComoArray).
  var formato = r.formato === 'cruda' ? 'cruda' : 'consolidado'; // Fase 210
  var filasArray = r.filas.map(function(f){ return agendasFilaComoArray(f, formato); });
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, formato: formato, filas: filasArray };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/agendas/carga/impacto', parsed);
    var fraseAliasAgendas = _cargasFraseAlias(impacto);
    if(impacto.filasExistentes > 0 || fraseAliasAgendas || impacto.filasSinAsesor){
      var msg = '';
      if(impacto.filasExistentes > 0){
        msg += 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' registro(s) de agendas ya cargados, del '+
          _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+'.';
      }
      if(fraseAliasAgendas) msg += (msg?' ':'')+fraseAliasAgendas;
      if(impacto.filasSinAsesor) msg += (msg?' ':'')+impacto.filasSinAsesor+' agenda(s) son de usuarios que no están en la Clasificación de usuarios: saldrán como "Usuario X (sin asesor)".';
      msg += '\n\n¿Continuar y sobrescribir?';
      if(!confirm(msg)) return { ok:false, mensaje: 'Se dejaron las agendas anteriores sin tocar.' };
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/agendas/carga', parsed);
    if(typeof _agendasCache !== 'undefined') _agendasCache = {}; // invalida el cache del panel abierto
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 77 (ORLANT): mismo patron exacto que _cargasGuardarAgendas (impacto
// -> confirmar -> guardar, periodo = primera..ultima DATE del archivo), con
// el canal (LLAMADAS/WHATSAPP) fijo por hoja -- reemplaza SOLO ese canal,
// nunca el otro (ver server/tipificaciones.js).
async function _cargasGuardarTipificacion(cliente, r){
  var filasArray = r.filas.map(tipificacionFilaComoArray);
  var parsed = { campana: cliente, canal: r.canalTipificacion, archivoNombre: _cargasArchivoNombre, filas: filasArray };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/tipificacion/carga/impacto', parsed);
    var fraseAliasTip = _cargasFraseAlias(impacto);
    if(impacto.filasExistentes > 0 || fraseAliasTip){
      var msg = '';
      if(impacto.filasExistentes > 0){
        msg += 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' registro(s) de tipificacion de '+
          (r.canalTipificacion==='WHATSAPP'?'WhatsApp':'Llamadas')+' ya cargados, del '+
          _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+'.';
      }
      if(fraseAliasTip) msg += (msg?' ':'')+fraseAliasTip;
      msg += '\n\n¿Continuar y sobrescribir?';
      if(!confirm(msg)) return { ok:false, mensaje: 'Se dejo la tipificacion anterior sin tocar.' };
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/tipificacion/carga', parsed);
    // Fase 177: invalida el cache del panel abierto (antes apuntaba a un
    // nombre que no existe, asi que no vaciaba nada) y el de Salida, que desde
    // la Fase 170 tambien saca sus meses de la Tipificacion.
    if(typeof _tipificacionOpciones !== 'undefined') _tipificacionOpciones = {};
    if(typeof _salOpciones !== 'undefined') _salOpciones = {};
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 138, PR3 (Mobilize, pedido de Edwin 09/10/2026): mismo patron impacto
// -> confirmar -> guardar de _cargasGuardarTipificacion -- a diferencia de
// esa, `r.filas` YA son arrays (llamadasUnicasParseFilas las arma asi
// directamente, ver LLAMADAS_UNICAS_ORDEN_ARRAY), sin un paso de conversion
// aparte.
async function _cargasGuardarLlamadasUnicas(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/llamadas-unicas/carga/impacto', parsed);
    var fraseAliasLu = _cargasFraseAlias(impacto);
    if(impacto.filasExistentes > 0 || fraseAliasLu){
      var msgLu = '';
      if(impacto.filasExistentes > 0){
        msgLu += 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' registro(s) de llamadas unicas ya cargados, del '+
          _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+'.';
      }
      if(fraseAliasLu) msgLu += (msgLu?' ':'')+fraseAliasLu;
      msgLu += '\n\n¿Continuar y sobrescribir?';
      if(!confirm(msgLu)) return { ok:false, mensaje: 'Se dejaron las llamadas unicas anteriores sin tocar.' };
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var respLu = await apiRequest('POST','/calidad/llamadas-unicas/carga', parsed);
    if(typeof _llamadasUnicasOpciones !== 'undefined') _llamadasUnicasOpciones = {}; // invalida el cache del panel abierto (Fase 141: antes apuntaba a un nombre que no existe)
    return { ok:true, mensaje: respLu.insertadas+' fila(s) guardadas ('+_agendasFmtFechaCorta(respLu.desde)+' al '+_agendasFmtFechaCorta(respLu.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 191: "Detalle de llamadas abandonadas" -- impacto -> confirmar -> guardar.
async function _cargasGuardarLlamadasAbandonadas(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/llamadas-abandonadas/carga/impacto', parsed);
    if(impacto.filasExistentes > 0 && !confirm('Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' llamada(s) abandonada(s) ya cargadas, del '+
      _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+', por '+impacto.filasNuevas+'.\n\n¿Continuar y sobrescribir?')){
      return { ok:false, mensaje: 'Se dejaron las llamadas abandonadas anteriores sin tocar.' };
    }
    var resp = await apiRequest('POST','/calidad/llamadas-abandonadas/carga', parsed);
    if(typeof _llamadasUnicasOpciones !== 'undefined') _llamadasUnicasOpciones = {};
    return { ok:true, mensaje: resp.insertadas+' abandonada(s) única(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 196: flujo por hora -- impacto -> confirmar -> guardar.
async function _cargasGuardarFlujoHora(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    var impacto = await apiRequest('POST','/calidad/flujo-hora/carga/impacto', parsed);
    if(impacto.filasExistentes > 0 && !confirm('Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' fila(s) de flujo por hora ya cargadas, del '+
      _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+', por '+impacto.filasNuevas+'.\n\n¿Continuar y sobrescribir?')){
      return { ok:false, mensaje: 'Se dejó el flujo por hora anterior sin tocar.' };
    }
    var resp = await apiRequest('POST','/calidad/flujo-hora/carga', parsed);
    if(typeof _flujoHoraOpciones !== 'undefined') _flujoHoraOpciones = {};
    return { ok:true, mensaje: resp.insertadas+' fila(s) de flujo por hora guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 194: no conectadas -- impacto -> confirmar -> guardar.
async function _cargasGuardarLlamadasNoConectadas(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/llamadas-no-conectadas/carga/impacto', parsed);
    var fraseAliasNc = _cargasFraseAlias(impacto);
    if(impacto.filasExistentes > 0 || fraseAliasNc){
      var msgNc = impacto.filasExistentes > 0 ? 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' llamada(s) no conectada(s) ya cargadas, del '+
        _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+', por '+impacto.filasNuevas+'.' : '';
      if(fraseAliasNc) msgNc += (msgNc?' ':'')+fraseAliasNc;
      if(!confirm(msgNc+'\n\n¿Continuar y sobrescribir?')) return { ok:false, mensaje: 'Se dejaron las no conectadas anteriores sin tocar.' };
    }
    var resp = await apiRequest('POST','/calidad/llamadas-no-conectadas/carga', parsed);
    if(typeof _llamadasSalidaOpciones !== 'undefined') _llamadasSalidaOpciones = {};
    return { ok:true, mensaje: resp.insertadas+' no conectada(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 142 (punto 4, ORLANT): mismo patron impacto -> confirmar -> guardar.
async function _cargasGuardarWhatsappTiempos(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/whatsapp-tiempos/carga/impacto', parsed);
    if(impacto.filasExistentes > 0){
      var msg = 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' registro(s) de tiempos de WhatsApp ya cargados, del '+
        _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+', por '+impacto.filasNuevas+' registro(s) nuevos.\n\n¿Continuar y sobrescribir?';
      if(!confirm(msg)) return { ok:false, mensaje: 'Se dejaron los tiempos de WhatsApp anteriores sin tocar.' };
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/whatsapp-tiempos/carga', parsed);
    if(typeof _wppTiemposOpciones !== 'undefined') _wppTiemposOpciones = {}; // invalida el cache de la vista abierta
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 202: mes de referencia para el año de las hojas por mes: el del Centro
// (tarjeta), el campo Periodo o, sin ninguno, el mes actual.
function _cargasMesReferenciaCalidad(cliente){
  var foco = cliente ? _cargasFocoActivo(cliente) : null;
  var per = foco ? foco.mes : ((document.getElementById('carga-periodo') || {}).value || '');
  if(/^\d{4}-\d{2}$/.test(per)) return per;
  return (typeof gdHoyLocal === 'function' ? gdHoyLocal() : new Date().toISOString()).slice(0, 7);
}

// Fase 202: una hoja por mes -- una sola confirmacion con todos los meses
// (asesores nuevos y los que se reemplazan) y luego se guarda mes por mes
// (cada uno reemplaza solo su mes, con su respaldo para Deshacer).
async function _cargasGuardarCalidadResumenPorMes(cliente, r){
  var ref = _cargasMesReferenciaCalidad(cliente);
  var meses = r.porMes.map(function(m){ return { hoja: m.hoja, mes: calidadResumenPeriodoDeHoja(m.info, ref), filas: m.filas }; });
  if(meses.some(function(m){ return !m.mes; })) return { ok:false, mensaje: 'No se pudo saber el año de las hojas. Elige el mes (campo Período) antes de guardar.' };
  var hechos = [];
  try{
    var lineas = [];
    for(var k=0; k<meses.length; k++){
      var imp = await apiRequest('POST','/calidad/calidad-resumen/carga/impacto', { campana: cliente, mes: meses[k].mes, archivoNombre: _cargasArchivoNombre, filas: meses[k].filas });
      lineas.push('• '+mesNombreLargo(meses[k].mes)+' (hoja '+meses[k].hoja+'): '+imp.filasNuevas+' asesor(es), '+imp.monitoreos+' monitoreo(s)'+
        (imp.filasExistentes > 0 ? ' — REEMPLAZA '+imp.filasExistentes+' asesor(es) ya cargados' : ' — mes nuevo'));
    }
    if(!confirm('El archivo trae una hoja por mes. Se va a guardar:\n\n'+lineas.join('\n')+'\n\n¿Continuar?')){
      return { ok:false, mensaje: 'No se guardó nada; el resumen de calidad sigue igual.' };
    }
    for(var j=0; j<meses.length; j++){
      var resp = await apiRequest('POST','/calidad/calidad-resumen/carga', { campana: cliente, mes: meses[j].mes, archivoNombre: _cargasArchivoNombre, filas: meses[j].filas });
      hechos.push(mesNombreLargo(meses[j].mes)+' '+resp.insertadas);
    }
    if(typeof _calResOpciones !== 'undefined') _calResOpciones = {};
    return { ok:true, mensaje: 'Asesores guardados por mes: '+hechos.join(', ') };
  }catch(e){ return { ok:false, mensaje: e.message + (hechos && hechos.length ? ' (ya se guardó: '+hechos.join(', ')+')' : '') }; }
}

// Fase 172: "Calidad: resumen por asesor" -- el mes es el del Centro (tarjeta)
// o el campo Periodo de Cargar Datos; reemplaza solo ese mes.
async function _cargasGuardarCalidadResumen(cliente, r){
  if(r.porMes) return _cargasGuardarCalidadResumenPorMes(cliente, r); // Fase 202
  var foco = _cargasFocoActivo(cliente);
  var mes = foco ? foco.mes : ((document.getElementById('carga-periodo') || {}).value || '');
  if(!/^\d{4}-\d{2}$/.test(mes)) return { ok:false, mensaje: 'Elige el mes (campo Período) antes de guardar el resumen de calidad.' };
  var parsed = { campana: cliente, mes: mes, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    var impacto = await apiRequest('POST','/calidad/calidad-resumen/carga/impacto', parsed);
    if(impacto.filasExistentes > 0 && !confirm('Esta carga va a REEMPLAZAR el resumen de calidad de '+mes+' ('+impacto.filasExistentes+' asesor(es) ya cargados) por '+impacto.filasNuevas+' asesor(es).\n\n¿Continuar?')){
      return { ok:false, mensaje: 'Se dejó el resumen de calidad anterior sin tocar.' };
    }
    var resp = await apiRequest('POST','/calidad/calidad-resumen/carga', parsed);
    if(typeof _calResOpciones !== 'undefined') _calResOpciones = {};
    return { ok:true, mensaje: resp.insertadas+' asesor(es) guardados ('+mes+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 147 (Parte B, Mobilize): impacto (solo lectura) -> confirmar SIEMPRE,
// con los conteos por pregunta -> guardar (reemplazo por rango de fechas).
async function _cargasGuardarEncuesta(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/encuestas/carga/impacto', parsed);
    var msg = 'Se van a guardar '+impacto.filasNuevas+' encuesta(s) del '+_agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+
      ' ('+impacto.dias+' día(s)).\n'+encuestaResumenTexto(impacto.conteos)+'.\n\n'+
      (impacto.filasExistentes > 0 ? 'Esto REEMPLAZA '+impacto.filasExistentes+' encuesta(s) ya cargadas en esas fechas.\n\n' : 'No hay encuestas cargadas en esas fechas.\n\n')+
      '¿Continuar?';
    if(!confirm(msg)) return { ok:false, mensaje: 'No se guardó nada; las encuestas anteriores siguen igual.' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/encuestas/carga', parsed);
    if(typeof _encuestaOpciones !== 'undefined') _encuestaOpciones = {}; // invalida el cache del panel abierto
    return { ok:true, mensaje: resp.insertadas+' encuesta(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 141 (Parte C, Mobilize): mismo patron impacto -> confirmar -> guardar
// de _cargasGuardarLlamadasUnicas. `r.filas` ya son arrays.
async function _cargasGuardarLlamadasSalida(cliente, r){
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  if(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES)){
    return { ok:false, mensaje: CARGAS_MSG_PAYLOAD_GRANDE };
  }
  try{
    var impacto = await apiRequest('POST','/calidad/llamadas-salida/carga/impacto', parsed);
    var fraseAlias = _cargasFraseAlias(impacto);
    if(impacto.filasExistentes > 0 || fraseAlias){
      var msg = '';
      if(impacto.filasExistentes > 0){
        msg += 'Esta carga va a REEMPLAZAR '+impacto.filasExistentes+' registro(s) de llamadas de salida ya cargados, del '+
          _agendasFmtFechaCorta(impacto.desde)+' al '+_agendasFmtFechaCorta(impacto.hasta)+', por '+impacto.filasNuevas+' registro(s) nuevos.';
      }
      if(fraseAlias) msg += (msg?' ':'')+fraseAlias;
      msg += '\n\n¿Continuar y sobrescribir?';
      if(!confirm(msg)) return { ok:false, mensaje: 'Se dejaron las llamadas de salida anteriores sin tocar.' };
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/llamadas-salida/carga', parsed);
    if(typeof _llamadasSalidaOpciones !== 'undefined') _llamadasSalidaOpciones = {}; // invalida el cache del panel abierto
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+_agendasFmtFechaCorta(resp.desde)+' al '+_agendasFmtFechaCorta(resp.hasta)+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 98 (ORLANT, pedido urgente de Edwin): mismo patron impacto ->
// confirmar -> guardar de _cargasGuardarAgendas/_cargasGuardarTipificacion,
// pero el periodo a reemplazar es el CONJUNTO de meses que trae el archivo
// (no un rango continuo de fecha) -- el mensaje de confirmacion muestra
// exactamente como se interpreto cada mes + cuantas especialidades trae
// (calculado aqui mismo, de las filas YA parseadas, sin otra llamada al
// servidor), para que quien carga pueda revisar antes de confirmar.
async function _cargasGuardarInasistencia(cliente, r){
  var filasArray = r.filas.map(inasistenciaFilaComoArray);
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: filasArray };

  var porMes = {};
  r.filas.forEach(function(f){ (porMes[f.mes] = porMes[f.mes] || {})[f.especialidad] = true; });
  var resumenMeses = inasistenciaMesesDeFilas(r.filas).map(function(m){
    var n = Object.keys(porMes[m]).length;
    return inasistenciaMesLbl(m) + ' (' + n + ' especialidad' + (n===1?'':'es') + ')';
  }).join(' y ');

  try{
    var impacto = await apiRequest('POST','/calidad/inasistencia/carga/impacto', parsed);
    var msg = 'Se cargará como ' + resumenMeses + '.';
    if(impacto.filasExistentes > 0){
      msg += ' Esto va a REEMPLAZAR ' + impacto.filasExistentes + ' registro(s) ya cargados de ese/esos mes(es).';
    }
    msg += '\n\n¿Continuar?';
    if(!confirm(msg)) return { ok:false, mensaje: 'Se dejo la inasistencia anterior sin tocar.' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/inasistencia/carga', parsed);
    if(typeof _inasistenciaCache !== 'undefined') _inasistenciaCache = {}; // invalida el cache del panel abierto
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+resp.meses.map(inasistenciaMesLbl).join(', ')+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 111 (ORLANT, pedido textual de Edwin): mismo patron impacto ->
// confirmar -> guardar de _cargasGuardarInasistencia (reemplazo por el
// CONJUNTO de meses del archivo). Si alguna fila trae una EFECTIVIDAD que
// no coincide con el recalculo (ver efectividadAgendamientoParseFilas), se
// suma esa advertencia al mensaje de confirmacion -- nunca bloquea la
// carga, el sistema siempre guarda el recalculo.
async function _cargasGuardarEfectividadAgendamiento(cliente, r){
  var filasArray = r.filas.map(efectividadAgendamientoFilaComoArray);
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: filasArray };
  var meses = efectividadAgendamientoMesesDelArchivo(r.filas);

  try{
    var impacto = await apiRequest('POST','/calidad/efectividad-agendamiento/carga/impacto', parsed);
    var msg = 'Se cargará como ' + meses.map(_gdMesLargo).join(', ') + ' (' + r.filas.length + ' asesor(es)).';
    if(impacto.filasExistentes > 0){
      msg += ' Esto va a REEMPLAZAR ' + impacto.filasExistentes + ' registro(s) ya cargados de ese/esos mes(es).';
    }
    var fraseAliasEA = _cargasFraseAlias(impacto);
    if(fraseAliasEA) msg += ' ' + fraseAliasEA;
    if(r.advertenciasEfectividad && r.advertenciasEfectividad.length){
      msg += '\n\nAdvertencia -- la columna EFECTIVIDAD del archivo no coincide con el recalculo en ' +
        r.advertenciasEfectividad.length + ' fila(s) (se guarda el recalculo igual):\n' +
        r.advertenciasEfectividad.slice(0, 5).join('\n') +
        (r.advertenciasEfectividad.length > 5 ? '\n…' : '');
    }
    msg += '\n\n¿Continuar?';
    if(!confirm(msg)) return { ok:false, mensaje: 'Se dejo la efectividad de agendamiento anterior sin tocar.' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/efectividad-agendamiento/carga', parsed);
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+resp.meses.map(_gdMesLargo).join(', ')+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 111 (ORLANT, pedido textual de InCo): mismo patron impacto ->
// confirmar -> guardar de _cargasGuardarEfectividadAgendamiento.
async function _cargasGuardarCitasAtendidas(cliente, r){
  var filasArray = r.filas.map(citasAtendidasFilaComoArray);
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: filasArray };
  var meses = citasAtendidasMesesDelArchivo(r.filas);

  try{
    var impacto = await apiRequest('POST','/calidad/efectividad-citas/carga/impacto', parsed);
    var msg = 'Se cargará como ' + meses.map(_gdMesLargo).join(', ') + '.';
    if(impacto.filasExistentes > 0){
      msg += ' Esto va a REEMPLAZAR ' + impacto.filasExistentes + ' registro(s) ya cargados de ese/esos mes(es).';
    }
    if(r.advertenciasEfectividad && r.advertenciasEfectividad.length){
      msg += '\n\nAdvertencia -- la columna EFECTIVIDAD CITAS ATENDIDAS del archivo no coincide con el recalculo en ' +
        r.advertenciasEfectividad.length + ' fila(s) (se guarda el recalculo igual):\n' +
        r.advertenciasEfectividad.slice(0, 5).join('\n') +
        (r.advertenciasEfectividad.length > 5 ? '\n…' : '');
    }
    msg += '\n\n¿Continuar?';
    if(!confirm(msg)) return { ok:false, mensaje: 'Se dejo la efectividad de citas anterior sin tocar.' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/efectividad-citas/carga', parsed);
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+resp.meses.map(_gdMesLargo).join(', ')+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

// Fase 127 (ORLANT, pedido textual de Edwin): mismo patron impacto ->
// confirmar -> guardar de _cargasGuardarCitasAtendidas, pero con un paso
// ADICIONAL antes: el MES del archivo nunca trae año (igual que Efectividad
// de Agendamiento/Citas Atendidas), y aqui Edwin pidio EXPLICITAMENTE poder
// ver y corregir a que año resuelve cada mes antes de guardar -- nunca
// adivinarlo en silencio como en esas otras 2 bases.
async function _cargasGuardarSalida(cliente, r){
  var filas = r.filas;
  var textoAnio = salidaTextoConfirmacionAnio(filas);
  var msgAnio = 'Se va a interpretar el MES de cada fila asi:\n\n' + textoAnio + '\n\n¿Es correcto el año?';
  if(!confirm(msgAnio)){
    var anioCorregido = prompt('Escribe el año correcto (4 digitos, ej. 2026) para TODAS las filas de este archivo:');
    if(anioCorregido === null) return { ok:false, mensaje:'Carga cancelada.' };
    anioCorregido = anioCorregido.trim();
    if(!/^\d{4}$/.test(anioCorregido)){
      return { ok:false, mensaje:'Carga cancelada: "'+anioCorregido+'" no es un año valido (4 digitos).' };
    }
    filas = filas.map(function(f){
      return Object.assign({}, f, { mes: mesNombreAAAAMM(f.mesTexto, anioCorregido, null) });
    });
    var mesesInvalidos = filas.filter(function(f){ return !f.mes; });
    if(mesesInvalidos.length){
      return { ok:false, mensaje:'Carga cancelada: no se pudo interpretar el MES de '+mesesInvalidos.length+' fila(s) con ese año.' };
    }
    var vistos = {};
    for(var i=0;i<filas.length;i++){
      if(vistos[filas[i].mes]) return { ok:false, mensaje:'Carga cancelada: con ese año, 2 filas resuelven al mismo mes ('+salidaMesLbl(filas[i].mes)+').' };
      vistos[filas[i].mes] = true;
    }
    // Centro de cargas (PR 4): con el año corregido, una fila no puede
    // salirse del mes elegido.
    var focoSalida = _cargasFocoActivo(cliente);
    if(focoSalida && filas.some(function(f){ return f.mes !== focoSalida.mes; })){
      return { ok:false, mensaje:'Carga cancelada: con ese año las filas ya no son de '+centroNombreMes(focoSalida.mes)+'. Súbelas desde ese mes o con la pantalla anterior.' };
    }
    var textoAnioCorregido = salidaTextoConfirmacionAnio(filas);
    if(!confirm('Se va a interpretar el MES de cada fila asi:\n\n'+textoAnioCorregido+'\n\n¿Continuar con esta correccion?')){
      return { ok:false, mensaje:'Carga cancelada.' };
    }
  }

  var filasArray = filas.map(salidaFilaComoArray);
  var parsed = { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: filasArray };
  var meses = salidaMesesDelArchivo(filas);

  try{
    var impacto = await apiRequest('POST','/calidad/salida/carga/impacto', parsed);
    var msg = 'Se cargará como ' + meses.map(salidaMesLbl).join(', ') + '.';
    if(impacto.filasExistentes > 0){
      msg += ' Esto va a REEMPLAZAR ' + impacto.filasExistentes + ' registro(s) ya cargados de ese/esos mes(es).';
    }
    msg += '\n\n¿Continuar?';
    if(!confirm(msg)) return { ok:false, mensaje: 'Se dejo la salida anterior sin tocar.' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/salida/carga', parsed);
    if(typeof _salOpciones !== 'undefined') _salOpciones = {}; // Fase 177: invalida el cache del panel abierto
    return { ok:true, mensaje: resp.insertadas+' fila(s) guardadas ('+resp.meses.map(salidaMesLbl).join(', ')+')' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

async function guardarCarga(){
  if(!_cargasResultados.length){ showToast('Primero sube un archivo'); return; }
  var cliente = document.getElementById('carga-cliente').value;
  var conDatos = _cargasResultados.filter(function(r){ return r.filas; });
  if(!conDatos.length){ showToast('No hay ninguna hoja lista para guardar'); return; }

  var necesitaPeriodo = conDatos.some(function(r){ return r.tipo==='seccion'; });
  var periodo = document.getElementById('carga-periodo').value;
  if(necesitaPeriodo && !periodo){
    showToast('Indica el periodo (mes) para guardar las hojas de Gestion de base');
    return;
  }

  var btn = document.querySelector('#carga-preview-card .btn-primary');
  var resumen = [];
  await withButtonLoading(btn, 'Guardando...', async function(){
    for(var i=0;i<conDatos.length;i++){
      var r = conDatos[i];
      var res;
      if(r.tipo==='seccion') res = await _cargasGuardarSeccion(cliente, periodo, r);
      else if(r.tipo==='calidad') res = await _cargasGuardarCalidad(cliente, r);
      else if(r.tipo==='agendas') res = await _cargasGuardarAgendas(cliente, r);
      else if(r.tipo==='efectividad_agendamiento') res = await _cargasGuardarEfectividadAgendamiento(cliente, r);
      else if(r.tipo==='tipificacion') res = await _cargasGuardarTipificacion(cliente, r);
      else if(r.tipo==='llamadas_unicas') res = await _cargasGuardarLlamadasUnicas(cliente, r);
      else if(r.tipo==='llamadas_salida') res = await _cargasGuardarLlamadasSalida(cliente, r);
      else if(r.tipo==='llamadas_abandonadas') res = await _cargasGuardarLlamadasAbandonadas(cliente, r);
      else if(r.tipo==='llamadas_no_conectadas') res = await _cargasGuardarLlamadasNoConectadas(cliente, r);
      else if(r.tipo==='flujo_hora') res = await _cargasGuardarFlujoHora(cliente, r);
      else if(r.tipo==='whatsapp_tiempos') res = await _cargasGuardarWhatsappTiempos(cliente, r);
      else if(r.tipo==='calidad_resumen') res = await _cargasGuardarCalidadResumen(cliente, r);
      else if(r.tipo==='encuesta') res = await _cargasGuardarEncuesta(cliente, r);
      else if(r.tipo==='inasistencia') res = await _cargasGuardarInasistencia(cliente, r);
      else if(r.tipo==='citas_atendidas') res = await _cargasGuardarCitasAtendidas(cliente, r);
      else if(r.tipo==='salida') res = await _cargasGuardarSalida(cliente, r);
      else if(r.canal==='whatsapp') res = await _cargasGuardarTraficoWhatsapp(cliente, r);
      // Fase 163: desde el Centro de un cliente, las filas son de ese cliente.
      else res = await _cargasGuardarTrafico(r, _cargasFocoActivo(cliente) ? cliente : null);
      resumen.push((res.ok ? '✓ ' : '✗ ') + r.titulo + (res.mensaje ? ': '+res.mensaje : ''));
    }
  });
  showToast(resumen.join('\n'));
  cancelarPreviewCarga();
  renderCargasExistentes();
  // Fase 178: el tablero abierto de ese cliente vuelve a pedir sus datos
  // (mismo MES, MESES y pestaña), como tras Deshacer / Eliminar.
  if(resumen.some(function(t){ return t.indexOf('✓') === 0; }) && typeof gdDatosCambiaron === 'function') gdDatosCambiaron(cliente);
}

async function renderCargasExistentes(){
  // PR 5: la lista de Gestion de base (dashboard_cargas) es solo de cargarDatos.
  var card = document.getElementById('carga-existentes-card');
  if(card) card.classList.toggle('hidden', !canLoadData());
  if(!canLoadData()) return;
  var tbl = document.getElementById('carga-existentes-table');
  if(!tbl) return;
  var cliente = document.getElementById('carga-cliente').value;
  var rows = [];
  if(cliente){
    try{ rows = await apiRequest('GET','/dashboard/cargas?cliente='+encodeURIComponent(cliente)) || []; }
    catch(e){ /* silencioso */ }
  }
  var html = '<tr><th>Seccion</th><th>Periodo</th><th>Cadencia</th><th>Filas</th><th>Cargado por</th><th>Fecha</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="7" style="text-align:center;color:var(--c-text-muted)">Sin cargas de Gestion de base todavia</td></tr>';
  } else {
    rows.forEach(function(c){
      var titulo = (_cargasSpec && _cargasSpec.secciones[c.seccion]) ? _cargasSpec.secciones[c.seccion].titulo : c.seccion;
      // Fase 81: filasCount siempre trae el conteo real (aunque `filas` venga
      // vacio por no tener acceso a ESE cliente puntual, ver GET
      // /dashboard/cargas en el servidor) -- se prefiere sobre filas.length
      // para que esta tabla no muestre "0" de forma enganosa.
      var conteoFilas = typeof c.filasCount === 'number' ? c.filasCount : (c.filas ? c.filas.length : 0);
      html += '<tr><td>'+esc(titulo)+'</td><td>'+esc(c.periodo)+'</td><td>'+esc(c.cadencia)+'</td><td>'+conteoFilas+'</td>'+
        '<td>'+esc(c.cargadoPorNombre||'-')+'</td><td style="font-size:0.78rem;color:var(--c-text-muted)">'+esc(c.cargadoEn||'-')+'</td>'+
        '<td><button class="btn-sm btn-delete" onclick="eliminarCarga('+c.id+')">Eliminar</button></td></tr>';
    });
  }
  tbl.innerHTML = html;
}

async function eliminarCarga(id){
  if(!confirm('Eliminar esta carga? El dashboard dejara de mostrar esos datos.')) return;
  try{ await apiRequest('DELETE','/dashboard/cargas/'+id); }
  catch(e){ showToast(e.message, 'error'); return; }
  showToast('Carga eliminada');
  renderCargasExistentes();
}
