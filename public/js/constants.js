// constants.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

var CLIENTES_LIST = [
  'ORLANT','HOSPITAL LA MARIA','CLINICA AURORA','TELEVENTAS SURA',
  'TELEVENTAS COMFAMA','PANTERA MAIKERS','ANDRES YEPES','MOVILIZE',
  'SASCHA FITNESS','ALBERTO LINERO GO','INFONDO','BIVETT'
];
var CAMPANAS_CALIDAD = ['ORLANT','HOSPITAL LA MARIA','CLINICA AURORA','TELEVENTAS SURA','TELEVENTAS COMFAMA','ANDRES YEPES','MOVILIZE','SASCHA FITNESS','INFONDO','BIVETT','CONSULTORIO JULIAN MOLANO','CARTERA INTERNA'];

// soon:true  -> el módulo aparece en el dashboard pero todavía no está construido.
// Se muestra atenuado con etiqueta "Próximamente" en vez de abrir una pantalla vacía.
var DASH_MODULES = [
  {key:'Calidad',     label:'Calidad',           icon:'&#10003;', sub:'Control de Calidad',     cls:'mod-calidad'},
  {key:'Inventario',  label:'Inventario',         icon:'&#128230;',sub:'Gestion de Stock',        cls:'mod-inventario', soon:true},
  {key:'Gerencia',    label:'Gerencia',           icon:'&#128202;',sub:'Indicadores Ejecutivos',  cls:'mod-gerencia',   soon:true},
  {key:'ClientesDash',label:'Dashboard Clientes', icon:'&#129309;',sub:'Seguimiento de Clientes', cls:'mod-clientes'}
];

// Dashboards de cliente que ya están construidos. El resto de CLIENTES_LIST
// se muestra como "Próximamente" hasta que tenga su propio informe.
var BUILT_CLIENT_DASHBOARDS = ['CLINICA AURORA', 'ORLANT', 'HOSPITAL LA MARIA'];

var ADMIN_ACTIONS = [
  {key:'crearUsuarios',    label:'Crear usuarios'},
  {key:'editarUsuarios',   label:'Editar usuarios'},
  {key:'cambiarPassword',  label:'Cambiar contrasenas'},
  {key:'suspenderUsuarios',label:'Suspender / Activar'},
  {key:'eliminarUsuarios', label:'Eliminar usuarios'},
  {key:'gestionPermisos',  label:'Gestionar permisos'}
];

var REGULAR_ROLES = [
  {key:'CALIDAD',      label:'CALIDAD',           icon:'&#10003;'},
  {key:'INVENTARIO',   label:'INVENTARIO',         icon:'&#128230;'},
  {key:'GERENCIA',     label:'GERENCIA',           icon:'&#128202;'},
  {key:'CLIENTES_DASH',label:'DASHBOARD CLIENTES', icon:'&#129309;'},
  {key:'REPORTES',     label:'REPORTES',           icon:'&#128200;'},
  {key:'ASESOR',       label:'ASESOR',             icon:'&#127942;'},
  {key:'SUPERVISOR',   label:'SUPERVISOR',         icon:'&#128737;'}
];

var ALL_ROLES = [
  {key:'ADMIN',        label:'ADMINISTRADOR',     icon:'&#9733;'},
  {key:'CALIDAD',      label:'CALIDAD',           icon:'&#10003;'},
  {key:'INVENTARIO',   label:'INVENTARIO',         icon:'&#128230;'},
  {key:'GERENCIA',     label:'GERENCIA',           icon:'&#128202;'},
  {key:'CLIENTES_DASH',label:'DASHBOARD CLIENTES', icon:'&#129309;'},
  {key:'REPORTES',     label:'REPORTES',           icon:'&#128200;'},
  {key:'ASESOR',       label:'ASESOR',             icon:'&#127942;'},
  {key:'SUPERVISOR',   label:'SUPERVISOR',         icon:'&#128737;'},
  {key:'AUX_ADMIN',   label:'AUXILIAR ADMIN',     icon:'&#128737;'}
];

var ROLE_DEFAULT = {CALIDAD:'Calidad',INVENTARIO:'Inventario',GERENCIA:'Gerencia',CLIENTES_DASH:'ClientesDash',REPORTES:'Calidad'};
var RL = {};
ALL_ROLES.forEach(function(r){ RL[r.key]=r.label; });
