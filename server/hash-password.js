// Utilidad: genera el hash bcrypt de una contrasena para pegarlo en .env
// Uso:  node hash-password.js "miContrasenaSegura"
const bcrypt = require('bcryptjs');
const pw = process.argv[2];
if (!pw) {
  console.log('Uso: node hash-password.js "tu-contrasena"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 10));
