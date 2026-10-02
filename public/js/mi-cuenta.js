// mi-cuenta.js — InConexion Platform (Fase 113, tema B).
// "Cambiar mi contrasena": disponible para CUALQUIER usuario autenticado,
// desde cualquiera de las 4 paginas (el modal vive fuera de los 4
// app-page en index.html, igual que el toast). Reglas de largo/complejidad
// las valida el servidor (PASSWORD_MIN, igual que el reseteo de admin).
document.getElementById('modal-change-own-password').addEventListener('click', function (e) {
  if (e.target === this) closeModal('modal-change-own-password');
});

function abrirCambiarPasswordModal() {
  document.getElementById('cop-actual').value = '';
  document.getElementById('cop-nueva').value = '';
  document.getElementById('cop-confirmar').value = '';
  openModal('modal-change-own-password');
}

async function submitCambiarPasswordPropia() {
  var actual = document.getElementById('cop-actual').value;
  var nueva = document.getElementById('cop-nueva').value;
  var confirmar = document.getElementById('cop-confirmar').value;
  if (!actual || !nueva) { showToast('Completa la contrasena actual y la nueva'); return; }
  if (nueva.length < PASSWORD_MIN) { showToast('La nueva contrasena debe tener al menos ' + PASSWORD_MIN + ' caracteres'); return; }
  if (nueva !== confirmar) { showToast('Las contrasenas nuevas no coinciden'); return; }

  var btn = document.querySelector('#modal-change-own-password .btn-primary');
  try {
    // Fase 113 (tema B): el cambio invalida el token ACTUAL (token_version
    // sube en el servidor) -- por eso la respuesta trae uno nuevo, que
    // reemplaza al viejo en memoria. La sesion sigue abierta, sin pedir
    // login de nuevo (decision tomada en esta fase, ver CLAUDE.md/reporte).
    var data = await withButtonLoading(btn, 'Cambiando...', function () {
      return apiRequest('PUT', '/auth/password', { currentPassword: actual, newPassword: nueva });
    });
    if (data && data.token) authToken = data.token;
    closeModal('modal-change-own-password');
    showToast('Contrasena actualizada');
  } catch (e) {
    showToast(e.message);
  }
}
