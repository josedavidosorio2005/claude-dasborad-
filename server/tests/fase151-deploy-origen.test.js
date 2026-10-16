// fase151-deploy-origen.test.js — Fase 151: el deploy solo corre tras una CI
// exitosa de un push a main de este mismo repositorio.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const yml = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

function condicionDelJob() {
  const m = yml.match(/\n  deploy:\n([\s\S]*?)\n    runs-on:/);
  assert.ok(m, 'job deploy');
  return m[1].replace(/\s+/g, ' ');
}

test('deploy: exige CI exitosa', () => {
  assert.match(condicionDelJob(), /workflow_run\.conclusion == 'success'/);
});

test('deploy: exige que la CI venga de un push (no de un pull request)', () => {
  assert.match(condicionDelJob(), /workflow_run\.event == 'push'/);
});

test('deploy: exige la rama main', () => {
  assert.match(condicionDelJob(), /workflow_run\.head_branch == 'main'/);
});

test('deploy: exige que el codigo venga de este repositorio', () => {
  assert.match(condicionDelJob(), /workflow_run\.head_repository\.full_name == github\.repository/);
});
