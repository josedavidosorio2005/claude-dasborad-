// seguridad.js — InConexion Platform (Fase 113, tema A).
// Aviso de seguridad en el panel admin: mismo patron que el aviso de
// Calidad (mis-resultados.js, calCargarAlertaNuevos/renderAlertaNuevos),
// pero sin "marcar como visto" -- se recalcula en vivo cada vez que el
// admin entra al panel; si la condicion ya no es cierta, deja de salir
// sola. Nunca se invoca para AUX_ADMIN (el servidor responde 403, y
// session.js solo llama a cargarAlertasSeguridad para admin completo).
async function cargarAlertasSeguridad(){
  try{
    var data = await apiRequest('GET','/seguridad/alertas');
    renderAlertaSeguridad(data);
  }catch(e){
    // Silencioso a proposito: un aviso de seguridad que no carga nunca debe
    // bloquear ni ensuciar la entrada al panel admin con un toast de error.
  }
}

function renderAlertaSeguridad(data){
  var banner=document.getElementById('admin-alerta-seguridad');
  var texto=document.getElementById('admin-alerta-seguridad-texto');
  if(!banner||!texto) return;
  var partes=[];
  if(data && data.fallosMasivos && data.fallosMasivos.length){
    var lista=data.fallosMasivos.map(function(f){return '@'+f.username+' ('+f.intentos+' intentos)';}).join(', ');
    partes.push(lista+': 10 o mas intentos fallidos de inicio de sesion en las ultimas 24 horas.');
  }
  if(data && data.ipsNuevasAdmin && data.ipsNuevasAdmin.length){
    var lista2=data.ipsNuevasAdmin.map(function(a){return '@'+a.username+' desde la IP '+a.ip;}).join(', ');
    partes.push(lista2+': inicio de sesion de administrador desde una IP nueva.');
  }
  if(!partes.length){ banner.classList.add('hidden'); return; }
  texto.textContent = partes.join(' ');
  banner.classList.remove('hidden');
}
