// seed-demo-cli.test.js — cubre el CLI real (no la libreria) de
// scripts/seed-demo.js en su camino NO interactivo: verifica sobre la salida
// real del proceso (stdout/stderr capturados de un subproceso genuino, sin
// TTY — igual que `docker compose exec -T ...` en produccion) que NINGUNA
// contrasena de usuario demo se escribe ahi. Es una prueba real sobre bytes
// de salida, no un comentario ni un test que solo llama a la libreria interna.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { spawnSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..');

function nuevoEntorno(dbDir) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    MASTER_ADMIN_PASSWORD_HASH: bcrypt.hashSync('cli-test-master', 10),
    DB_PATH: path.join(dbDir, 'inconexion.db'),
    TRUST_PROXY: 'false',
  };
}

// spawnSync (a diferencia de execFileSync) siempre entrega stdout Y stderr
// por separado, sin heredar una TTY del proceso de pruebas — exactamente el
// camino "no interactivo" que el script debe proteger.
function correrCli(args, env) {
  const r = spawnSync('node', ['scripts/seed-demo.js', ...args], {
    cwd: SERVER_DIR,
    env,
    encoding: 'utf8',
  });
  if (r.error) throw r.error;
  return r;
}

function extraerPasswords(texto) {
  const out = [];
  const re = /password:\s*(\S+)/g;
  let m;
  while ((m = re.exec(texto))) out.push(m[1]);
  return out;
}

test('seed-demo (CLI, no interactivo): nunca escribe una contrasena en stdout/stderr al sembrar', () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-demo-cli-'));
  try {
    const env = nuevoEntorno(dbDir);

    const r = correrCli([], env);
    assert.equal(r.status, 0, `seed-demo.js debe salir 0; stderr:\n${r.stderr}`);

    // Confirma que SI se genero al menos una contrasena de demo (si no, la
    // prueba de "no se filtra" seria trivialmente verdadera sin decir nada).
    const archivoCred = path.join(dbDir, 'seed-demo-credenciales.txt');
    assert.ok(fs.existsSync(archivoCred), 'el archivo de credenciales deberia existir en salida no interactiva');
    const contenidoArchivo = fs.readFileSync(archivoCred, 'utf8');
    const passwordsReales = extraerPasswords(contenidoArchivo);
    assert.ok(passwordsReales.length >= 8, 'deberian haberse generado varias contrasenas de demo (una por rol)');

    // La prueba real: ninguna de esas contrasenas aparece en stdout/stderr.
    for (const pw of passwordsReales) {
      assert.ok(!r.stdout.includes(pw), `una contrasena real aparecio en stdout: "${pw}"`);
      assert.ok(!r.stderr.includes(pw), `una contrasena real aparecio en stderr: "${pw}"`);
    }

    // Y el propio patron "password: <algo>" no debe aparecer en la salida
    // del proceso (solo puede aparecer en el archivo, nunca en stdout/stderr).
    assert.ok(!/password:\s*\S/.test(r.stdout), 'stdout no debe contener ninguna linea "password: <valor>"');
    assert.ok(!/password:\s*\S/.test(r.stderr), 'stderr no debe contener ninguna linea "password: <valor>"');

    assert.match(r.stdout, /Salida NO interactiva detectada/, 'debe avisar explicitamente que tomo el camino no interactivo');
  } finally {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('seed-demo --rotar-claves (CLI, no interactivo): rota las contrasenas y tampoco las filtra', () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-demo-cli-rot-'));
  try {
    const env = nuevoEntorno(dbDir);
    const archivoCred = path.join(dbDir, 'seed-demo-credenciales.txt');

    const primero = correrCli([], env);
    assert.equal(primero.status, 0, `siembra inicial debe salir 0; stderr:\n${primero.stderr}`);
    const passwordsOriginales = extraerPasswords(fs.readFileSync(archivoCred, 'utf8'));
    assert.ok(passwordsOriginales.length >= 8);

    const rotar = correrCli(['--rotar-claves'], env);
    assert.equal(rotar.status, 0, `--rotar-claves debe salir 0; stderr:\n${rotar.stderr}`);
    const passwordsNuevas = extraerPasswords(fs.readFileSync(archivoCred, 'utf8'));
    assert.ok(passwordsNuevas.length >= 8);

    // Realmente cambiaron (rotar no es un no-op).
    assert.notDeepEqual(
      [...passwordsOriginales].sort(),
      [...passwordsNuevas].sort(),
      'las contrasenas rotadas deberian ser distintas a las originales'
    );

    // Ni las nuevas ni las viejas contrasenas aparecen en la salida del
    // proceso de rotacion (las viejas ya no sirven, pero tampoco deberian
    // filtrarse; las nuevas es justo lo que este test protege).
    for (const pw of [...passwordsOriginales, ...passwordsNuevas]) {
      assert.ok(!rotar.stdout.includes(pw), `una contrasena aparecio en stdout de --rotar-claves: "${pw}"`);
      assert.ok(!rotar.stderr.includes(pw), `una contrasena aparecio en stderr de --rotar-claves: "${pw}"`);
    }
    assert.ok(!/password:\s*\S/.test(rotar.stdout));
    assert.ok(!/password:\s*\S/.test(rotar.stderr));
  } finally {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});

test('seed-demo --limpiar (CLI): sigue funcionando end-to-end tras los cambios de credenciales', () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-demo-cli-clean-'));
  try {
    const env = nuevoEntorno(dbDir);
    const uno = correrCli([], env);
    assert.equal(uno.status, 0);
    const dos = correrCli(['--limpiar'], env);
    assert.equal(dos.status, 0, `--limpiar debe salir 0; stderr:\n${dos.stderr}`);
    assert.match(dos.stdout, /Limpieza completada/);
  } finally {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
});
