// constants.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// Fase 139: nombre visible de la plataforma, escrito EXACTO asi (S, I y C
// mayusculas). Unica fuente: lo usan el <title>, la pantalla de ingreso y
// la de bienvenida (todo elemento con data-app-name). El texto que trae
// index.html es solo el respaldo sin JS -- la prueba
// fase139-sinco-nombre.test.js exige que coincida con esta constante.
// La marca de la empresa (InConexion®, navbar y logo) no cambia.
var APP_NAME = 'SInCo';

function aplicarNombreApp() {
  document.title = APP_NAME;
  document.querySelectorAll('[data-app-name]').forEach(function (el) {
    el.textContent = APP_NAME;
  });
}
aplicarNombreApp();

// Fase 134: solo ORLANT y MOBILIZE quedan en produccion (decision del
// usuario, 2026-10-09). Fase 153 (Paso 1): estos valores son solo el
// respaldo inicial; tras el login loadDashboardClientes (dashboards-core.js)
// los reemplaza con las listas del registro de clientes del servidor
// (server/clientes-registro.js). La prueba fase153-registro-clientes exige
// que coincidan con la semilla del registro.
var CLIENTES_LIST = ['ORLANT', 'MOBILIZE'];
var CAMPANAS_CALIDAD = ['ORLANT', 'MOBILIZE'];

// Campanas que tienen plantilla de calificacion de Calidad en el servidor.
// Debe coincidir con server/calidad-plantillas-seed.js. El detalle de cada
// plantilla (items, pesos, motor) se pide por API (GET /api/calidad/plantillas).
var CAMPANAS_CON_PLANTILLA = ['ORLANT', 'MOBILIZE'];

// soon:true  -> el módulo aparece en el dashboard pero todavía no está construido.
// Se muestra atenuado con etiqueta "Próximamente" en vez de abrir una pantalla vacía.
var DASH_MODULES = [
  {key:'Calidad',      label:'Calidad',           icon:'&#10003;', sub:'Control de Calidad',     cls:'mod-calidad'},
  {key:'Inventario',   label:'Inventario',         icon:'&#128230;',sub:'Gestion de Stock',        cls:'mod-inventario'},
  {key:'Gerencia',     label:'Gerencia',           icon:'&#128202;',sub:'Indicadores Ejecutivos',  cls:'mod-gerencia'},
  {key:'GestionHumana',label:'Gestión Humana',     icon:'&#128101;',sub:'Personal por Campaña',     cls:'mod-gerencia'},
  {key:'ClientesDash', label:'Dashboard Clientes', icon:'&#129309;',sub:'Seguimiento de Clientes', cls:'mod-clientes'}
];

// Dashboards de cliente que ya están construidos. El resto de CLIENTES_LIST
// se muestra como "Próximamente" hasta que tenga su propio informe. Valor
// inicial (antes de que dashboards-core.js lo reemplace con la lista real
// del servidor) -- hoy los 2 unicos clientes YA estan construidos.
var BUILT_CLIENT_DASHBOARDS = ['ORLANT', 'MOBILIZE'];

var ADMIN_ACTIONS = [
  {key:'crearUsuarios',    label:'Crear usuarios'},
  {key:'editarUsuarios',   label:'Editar usuarios'},
  {key:'cambiarPassword',  label:'Cambiar contrasenas'},
  {key:'suspenderUsuarios',label:'Suspender / Activar'},
  {key:'eliminarUsuarios', label:'Eliminar usuarios'},
  {key:'gestionPermisos',  label:'Gestionar permisos'}
];

var REGULAR_ROLES = [
  {key:'CALIDAD',        label:'CALIDAD',           icon:'&#10003;'},
  {key:'INVENTARIO',     label:'INVENTARIO',         icon:'&#128230;'},
  {key:'GERENCIA',       label:'GERENCIA',           icon:'&#128202;'},
  {key:'GESTION_HUMANA', label:'GESTION HUMANA',     icon:'&#128101;'},
  {key:'CLIENTES_DASH',  label:'DASHBOARD CLIENTES', icon:'&#129309;'},
  {key:'REPORTES',       label:'REPORTES',           icon:'&#128200;'},
  {key:'ASESOR',         label:'ASESOR',             icon:'&#127942;'},
  {key:'SUPERVISOR',     label:'SUPERVISOR',         icon:'&#128737;'}
];

var ALL_ROLES = [
  {key:'ADMIN',          label:'ADMINISTRADOR',     icon:'&#9733;'},
  {key:'CALIDAD',        label:'CALIDAD',           icon:'&#10003;'},
  {key:'INVENTARIO',     label:'INVENTARIO',         icon:'&#128230;'},
  {key:'GERENCIA',       label:'GERENCIA',           icon:'&#128202;'},
  {key:'GESTION_HUMANA', label:'GESTION HUMANA',     icon:'&#128101;'},
  {key:'CLIENTES_DASH',  label:'DASHBOARD CLIENTES', icon:'&#129309;'},
  {key:'REPORTES',       label:'REPORTES',           icon:'&#128200;'},
  {key:'ASESOR',         label:'ASESOR',             icon:'&#127942;'},
  {key:'SUPERVISOR',     label:'SUPERVISOR',         icon:'&#128737;'},
  {key:'AUX_ADMIN',     label:'AUXILIAR ADMIN',     icon:'&#128737;'}
];

var ROLE_DEFAULT = {CALIDAD:'Calidad',INVENTARIO:'Inventario',GERENCIA:'Gerencia',GESTION_HUMANA:'GestionHumana',CLIENTES_DASH:'ClientesDash',REPORTES:'Calidad'};
var RL = {};
ALL_ROLES.forEach(function(r){ RL[r.key]=r.label; });
