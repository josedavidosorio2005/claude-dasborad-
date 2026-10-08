// fase133-parte6-regresion-wcag.test.js — Fase 133, Parte 6: "que no se
// pueda romper otra vez". Lee los tokens REALES de styles.css/charts.js
// (nunca copiados a mano) y falla si algun par de la lista del prompt baja
// del umbral, en claro y oscuro. Tambien falla si aparece un font-size
// fuera de los tokens --fs-*/< 0.75rem, o un outline:none/0 sin un
// :focus-visible de reemplazo (esta ultima ya vive en
// fase133-parte5-foco-aria-tactil.test.js -- no se duplica aqui).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { contrasteRazon, contrasteSimularCvd, contrasteDeltaE } = require('../../public/js/contraste-logic.js');

const CSS_PATH = path.join(__dirname, '..', '..', 'public', 'css', 'styles.css');
const CHARTS_PATH = path.join(__dirname, '..', '..', 'public', 'js', 'charts.js');
const css = fs.readFileSync(CSS_PATH, 'utf8');

function bloqueRoot(selectorRegex) {
  const m = css.match(selectorRegex);
  assert.ok(m, 'no se encontro el bloque ' + selectorRegex);
  return m[1];
}
const CLARO = bloqueRoot(/:root\{([\s\S]*?)\n\}/);
const OSCURO = bloqueRoot(/:root\[data-theme="dark"\]\{([\s\S]*?)\n\}/);

function tok(bloque, nombre) {
  const m = bloque.match(new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(#[0-9a-fA-F]{3,6}|var\\([^)]+\\))'));
  assert.ok(m, 'no se encontro el token ' + nombre);
  let v = m[1];
  // Resuelve 1 nivel de indireccion (ej. --c-focus:var(--c-primary-mid)).
  if (v.startsWith('var(')) {
    const ref = v.slice(4, -1);
    return tok(bloque, ref);
  }
  return v;
}

function medir(hex1, hex2) { return contrasteRazon(hex1, hex2); }

// ── Tokens reales de cada tema (nunca copiados a mano) ──
const T = {}; // T.claro.textoSecundario etc.
['CLARO', 'OSCURO'].forEach((tema) => {
  const bloque = tema === 'CLARO' ? CLARO : OSCURO;
  T[tema] = {
    surface: tok(bloque, '--c-surface'),
    bg: tok(bloque, '--c-bg'),
    surfaceSubtle: tok(bloque, '--c-surface-subtle'),
    text: tok(bloque, '--c-text'),
    text2: tok(bloque, '--c-text-2'),
    textMuted: tok(bloque, '--c-text-muted'),
    textLink: tok(bloque, '--c-text-link'),
    brand: tok(CLARO, '--c-brand'), // fijo, nunca se redefine en oscuro
    primaryMid: tok(bloque, '--c-primary-mid'),
    onPrimarySoft: tok(bloque, '--c-on-primary-soft'),
    onBrand: tok(CLARO, '--c-on-brand'), // fijo
    successText: tok(bloque, '--c-success-text'),
    warningText: tok(bloque, '--c-warning-text'),
    dangerText: tok(bloque, '--c-danger-text'),
    successDark: tok(bloque, '--c-success-dark'),
    warningDark: tok(bloque, '--c-warning-dark'),
    dangerDark: tok(bloque, '--c-danger-dark'),
    successBg: tok(bloque, '--c-success-bg'),
    warningBg: tok(bloque, '--c-warning-bg'),
    dangerBg: tok(bloque, '--c-danger-bg'),
    success: tok(bloque, '--c-success'),
    warning: tok(bloque, '--c-warning'),
    danger: tok(bloque, '--c-danger'),
    borderControl: tok(bloque, '--c-border-control'),
  };
});

test('texto principal/secundario/atenuado/enlace >= 4.5:1 contra surface/bg/surface-subtle, en los 2 temas', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    ['text', 'text2', 'textMuted', 'textLink'].forEach((campo) => {
      ['surface', 'bg', 'surfaceSubtle'].forEach((fondoCampo) => {
        const r = medir(t[campo], t[fondoCampo]);
        assert.ok(r >= 4.5, `${tema} ${campo}(${t[campo]}) vs ${fondoCampo}(${t[fondoCampo]}) = ${r.toFixed(2)}:1, se esperaba >=4.5`);
      });
    });
  });
});

test('blanco (--c-on-brand) >= 4.5:1 sobre --c-brand, en los 2 temas', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    assert.ok(medir(t.onBrand, t.brand) >= 4.5, `${tema} on-brand vs brand = ${medir(t.onBrand, t.brand).toFixed(2)}`);
  });
});

// Hallazgo real de esta misma prueba, en su primera version: --c-primary-mid
// en tema oscuro (#3fa8cc) esta A PROPOSITO claro -- sirve de TEXTO sobre
// superficie oscura en el resto del archivo. Usarlo AL REVES, como FONDO
// con texto blanco encima, daba 2.73:1 (.gd-subtab-btn.on/.gd-panel-tools
// button.on, los 2 unicos casos reales) -- corregidos a --c-brand (fijo,
// 11.22:1 en los 2 temas, mismo "look" de seleccionado). Esta prueba
// confirma que no vuelve a aparecer ese patron, en vez de exigirle a
// --c-primary-mid un contraste que no es su trabajo dar como fondo.
test('ningun selector usa --c-primary-mid como FONDO con texto blanco/on-brand encima (el bug real: 2.73:1 en oscuro)', () => {
  const reglas = [...css.matchAll(/([^{}]+)\{([^}]*background:\s*var\(--c-primary-mid\)[^}]*)\}/g)];
  reglas.forEach((m) => {
    const decl = m[2];
    assert.ok(!/color:\s*(#fff\b|white\b|var\(--c-on-brand\))/.test(decl), `${m[1].trim()} usa --c-primary-mid de fondo con texto blanco -- 2.73:1 en tema oscuro`);
  });
});

test('--c-on-primary-soft >= 4.5:1 sobre --c-brand (texto del header del dashboard, ej. "Ultima actualizacion")', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    const r = medir(t.onPrimarySoft, t.brand);
    assert.ok(r >= 4.5, `${tema} on-primary-soft vs brand = ${r.toFixed(2)}`);
  });
});

test('los 3 tokens *-text >= 4.5:1 sobre su celda tintada (14% claro / 28% oscuro sobre surface) y sobre surface plana', () => {
  function compositeOver(rgbHex, alpha, bgHex) {
    const { contrasteHexARgb } = require('../../public/js/contraste-logic.js');
    const fg = contrasteHexARgb(rgbHex), bg = contrasteHexARgb(bgHex);
    const mezclar = (c1, c2) => Math.round(c1 * alpha + c2 * (1 - alpha));
    return '#' + [mezclar(fg.r, bg.r), mezclar(fg.g, bg.g), mezclar(fg.b, bg.b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  const BASES = { success: '#27ae60', warning: '#e67e22', danger: '#e74c3c' };
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    const alpha = tema === 'CLARO' ? 0.14 : 0.28;
    [['successText', BASES.success], ['warningText', BASES.warning], ['dangerText', BASES.danger]].forEach(([campo, baseHex]) => {
      const celda = compositeOver(baseHex, alpha, t.surface);
      const rCelda = medir(t[campo], celda);
      const rPlano = medir(t[campo], t.surface);
      assert.ok(rCelda >= 4.5, `${tema} ${campo}(${t[campo]}) vs celda tintada(${celda}) = ${rCelda.toFixed(2)}`);
      assert.ok(rPlano >= 4.5, `${tema} ${campo}(${t[campo]}) vs surface plana = ${rPlano.toFixed(2)}`);
    });
  });
});

test('--c-success-dark/--c-warning-dark/--c-danger-dark >= 4.5:1 sobre su propio -bg', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    [['successDark', 'successBg'], ['warningDark', 'warningBg'], ['dangerDark', 'dangerBg']].forEach(([dk, bg]) => {
      const r = medir(t[dk], t[bg]);
      assert.ok(r >= 4.5, `${tema} ${dk}(${t[dk]}) vs ${bg}(${t[bg]}) = ${r.toFixed(2)}`);
    });
  });
});

test('los 3 rellenos (--c-success/--c-warning/--c-danger) >= 3:1 contra superficie (WCAG 1.4.11, objeto grafico)', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    ['success', 'warning', 'danger'].forEach((campo) => {
      const r = medir(t[campo], t.surface);
      assert.ok(r >= 3, `${tema} ${campo}(${t[campo]}) vs surface = ${r.toFixed(2)}`);
    });
  });
});

test('--c-border-control >= 3:1 contra surface y bg, en los 2 temas', () => {
  ['CLARO', 'OSCURO'].forEach((tema) => {
    const t = T[tema];
    assert.ok(medir(t.borderControl, t.surface) >= 3, `${tema} border-control vs surface`);
    assert.ok(medir(t.borderControl, t.bg) >= 3, `${tema} border-control vs bg`);
  });
});

// ── Paleta categorica de graficas (lee charts.js real) ──
const chartsTexto = fs.readFileSync(CHARTS_PATH, 'utf8');
function extraerPC(nombreVar) {
  const m = chartsTexto.match(new RegExp('var ' + nombreVar + '=\\[([^\\]]+)\\]'));
  assert.ok(m);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
}
const PC = extraerPC('PC');
const PC_DARK = extraerPC('PC_DARK');
function semaforoDe(bloqueElse) {
  const g = chartsTexto.match(new RegExp("CG='(#[0-9a-fA-F]{6})'"));
  const o = chartsTexto.match(new RegExp("CO='(#[0-9a-fA-F]{6})'"));
  const r = chartsTexto.match(new RegExp("CR='(#[0-9a-fA-F]{6})'"));
  return [g, o, r];
}

test('las 12 series de PC y PC_DARK pasan >=3:1 y ninguna es un tono del semaforo', () => {
  const bloqueClaro = chartsTexto.match(/\} else \{([^}]+)\}/)[1];
  const semClaro = ['CG', 'CO', 'CR'].map((v) => bloqueClaro.match(new RegExp(v + "='(#[0-9a-fA-F]{6})'"))[1].toLowerCase());
  PC.forEach((hex, i) => {
    assert.ok(medir(hex, '#ffffff') >= 3 && medir(hex, '#f7fbfd') >= 3, `PC[${i}]=${hex} no pasa 3:1`);
    assert.ok(!semClaro.includes(hex.toLowerCase()), `PC[${i}]=${hex} coincide con el semaforo`);
  });
  PC_DARK.forEach((hex, i) => {
    assert.ok(medir(hex, '#132c35') >= 3 && medir(hex, '#17343e') >= 3, `PC_DARK[${i}]=${hex} no pasa 3:1`);
  });
});

test('las primeras 8 series de PC/PC_DARK se distinguen (deltaE >= 12) bajo vision tipica y 3 daltonismos simulados', () => {
  function minDeltaE(paleta) {
    const tipos = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
    const primeras = paleta.slice(0, 8);
    let min = Infinity;
    for (let i = 0; i < primeras.length; i++) for (let j = i + 1; j < primeras.length; j++) {
      tipos.forEach((tipo) => {
        const a = tipo === 'normal' ? primeras[i] : contrasteSimularCvd(primeras[i], tipo);
        const b = tipo === 'normal' ? primeras[j] : contrasteSimularCvd(primeras[j], tipo);
        const de = contrasteDeltaE(a, b);
        if (de < min) min = de;
      });
    }
    return min;
  }
  assert.ok(minDeltaE(PC) >= 12, 'PC: deltaE minimo = ' + minDeltaE(PC).toFixed(2));
  assert.ok(minDeltaE(PC_DARK) >= 12, 'PC_DARK: deltaE minimo = ' + minDeltaE(PC_DARK).toFixed(2));
});

// ── Tipografia: nada fuera de los tokens, nada < 0.75rem ──
test('ningun font-size queda fuera de los tokens --fs-*, y ningun valor < 0.75rem (12px, el piso)', () => {
  const sueltos = [...css.matchAll(/font-size:(?!var\(--fs-)([0-9.]+)(rem|px|em)/g)];
  // .gd-sem-simbolo usa 0.85em A PROPOSITO (relativo al texto que lo
  // contiene, ver Parte 2) -- es el UNICO valor suelto permitido.
  const permitidos = sueltos.filter((m) => m[1] === '0.85' && m[2] === 'em');
  const noPermitidos = sueltos.filter((m) => !(m[1] === '0.85' && m[2] === 'em'));
  assert.equal(noPermitidos.length, 0, 'font-size fuera de los tokens --fs-*: ' + noPermitidos.map((m) => m[0]).join(', '));
  assert.ok(permitidos.length <= 1, 'se esperaba como maximo 1 uso de 0.85em (.gd-sem-simbolo)');

  const tokensDef = css.match(/--fs-note:([0-9.]+)rem/);
  assert.ok(tokensDef);
  const piso = parseFloat(tokensDef[1]);
  assert.equal(piso, 0.75, '--fs-note (el piso) deberia ser exactamente 0.75rem (12px)');
  ['--fs-small', '--fs-body', '--fs-body-lg', '--fs-h3', '--fs-h2', '--fs-kpi', '--fs-display'].forEach((nombre) => {
    const m = css.match(new RegExp(nombre + ':([0-9.]+)rem'));
    assert.ok(m, 'falta el token ' + nombre);
    assert.ok(parseFloat(m[1]) >= piso, nombre + ' esta por debajo del piso de 0.75rem');
  });
});

test('--fw-* solo declara los 4 pesos reales de Quicksand (400/500/600/700)', () => {
  const m = css.match(/--fw-regular:(\d+); --fw-medium:(\d+); --fw-semibold:(\d+); --fw-bold:(\d+);/);
  assert.ok(m);
  assert.deepEqual(m.slice(1).map(Number), [400, 500, 600, 700]);
  assert.ok(!/font-weight:(?!400|500|600|700|var\(--fw-)\d+/.test(css), 'no deberia quedar ningun font-weight fuera de 400/500/600/700');
});
