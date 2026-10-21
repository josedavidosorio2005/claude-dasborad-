// fase160-deploy-cabeza.test.js — Fase 160: el deploy se salta si el commit
// de su CI ya no es la cabeza de main (21/10: el deploy de un merge viejo
// termino ultimo y publico 1.58.1 encima de 1.58.2). Ademas de revisar el
// workflow, corre el script del job `vigente` con un `git` falso.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const yml = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

function job(nombre) {
  const m = yml.match(new RegExp('\\n  ' + nombre + ':\\n([\\s\\S]*?)(?=\\n  [a-z][\\w-]*:\\n|$)'));
  assert.ok(m, 'job ' + nombre);
  return m[1];
}

// El bloque `run: |` del job `vigente`, sin la sangria de YAML.
function scriptVigente() {
  const lineas = job('vigente').split('\n');
  const i = lineas.findIndex((l) => /^\s+run: \|$/.test(l));
  assert.ok(i !== -1, 'run del job vigente');
  const cuerpo = [];
  for (const l of lineas.slice(i + 1)) {
    if (l.trim() && !/^ {10}/.test(l)) break;
    cuerpo.push(l.slice(10));
  }
  return cuerpo.join('\n');
}

const SHA = 'a'.repeat(40);
const OTRO = 'b'.repeat(40);

// Corre el script con un `git` falso que responde `cabeza` (o nada) y
// devuelve { status, salida (lo que escribio en GITHUB_OUTPUT), log }.
function correr(cabeza) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f160-deploy-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\n' + (cabeza ? 'printf "%s\\trefs/heads/main\\n" "' + cabeza + '"\n' : 'exit 2\n'), { mode: 0o755 });
  const script = path.join(dir, 'vigente.sh');
  fs.writeFileSync(script, scriptVigente());
  const out = path.join(dir, 'out.txt');
  fs.writeFileSync(out, '');
  const r = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      PATH: bin + path.delimiter + process.env.PATH,
      SHA,
      GH_TOKEN: 'x',
      REPO: 'dueno/repo',
      GITHUB_OUTPUT: out,
    }),
  });
  return { status: r.status, salida: fs.readFileSync(out, 'utf8'), log: r.stdout + r.stderr };
}

test('deploy espera al job vigente y exige que su commit sea la cabeza de main', () => {
  const d = job('deploy');
  assert.match(d, /^    needs: vigente$/m);
  assert.match(d.replace(/\s+/g, ' '), /needs\.vigente\.outputs\.es_cabeza == 'true' \}\}/);
});

test('vigente lee la cabeza con git ls-remote (no con la API) y la compara con el commit de su CI', () => {
  const v = job('vigente');
  assert.match(v, /es_cabeza: \$\{\{ steps\.cabeza\.outputs\.es_cabeza \}\}/);
  assert.match(v, /SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(v, /git ls-remote .* refs\/heads\/main/);
  assert.doesNotMatch(v, /gh api|api\.github\.com/);
});

test('los deploys siguen yendo de a uno, sin cancelar uno a medias', () => {
  assert.match(yml, /\nconcurrency:\n  group: deploy-produccion\n  cancel-in-progress: false\n/);
});

test('script: si el commit es la cabeza de main, despliega', () => {
  const r = correr(SHA);
  assert.equal(r.status, 0, r.log);
  assert.equal(r.salida.trim(), 'es_cabeza=true');
});

test('script: si main ya avanzo, se salta (sin fallar)', () => {
  const r = correr(OTRO);
  assert.equal(r.status, 0, r.log);
  assert.equal(r.salida.trim(), 'es_cabeza=false');
  assert.match(r.log, /Se salta/);
});

test('script: si no se puede leer la cabeza, falla y no despliega', () => {
  const r = correr(null);
  assert.notEqual(r.status, 0);
  assert.equal(r.salida.trim(), '');
});
