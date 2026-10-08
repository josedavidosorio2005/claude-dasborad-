// fase133-paleta-graficas.test.js — Fase 133 (Parte 3): la paleta
// categorica de graficas (PC/PC_DARK, public/js/charts.js) no puede
// parecerse al semaforo (verde/ambar/rojo reservados a CG/CO/CR) y las
// primeras 8 series deben distinguirse incluso con vision de color
// alterada. Lee charts.js como texto (es un archivo acoplado al navegador/
// Chart.js, sin module.exports) y extrae los arrays reales -- si alguien
// cambia la paleta a mano sin volver a medir, esta prueba lo agarra.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { contrasteRazon, contrasteSimularCvd, contrasteDeltaE } = require('../../public/js/contraste-logic.js');

const CHARTS_PATH = path.join(__dirname, '..', '..', 'public', 'js', 'charts.js');
const texto = fs.readFileSync(CHARTS_PATH, 'utf8');

function extraerArray(nombreVar) {
  const re = new RegExp('var ' + nombreVar + "=\\[([^\\]]+)\\]");
  const m = texto.match(re);
  assert.ok(m, `no se encontro "var ${nombreVar}=[...]" en charts.js`);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
}

// Los 2 lugares donde PC se reconstruye en modo claro (la declaracion
// inicial y dentro de aplicarTemaCharts) tienen que ser el MISMO array --
// si alguien edita uno y se olvida del otro, el tema oscuro->claro se
// rompe en silencio.
function extraerTodasLasApariciones(nombreVar) {
  const re = new RegExp('(?:var |' + nombreVar + '=)\\[([^\\]]+)\\]', 'g');
  const out = [];
  let m;
  while ((m = re.exec(texto)) !== null) out.push(m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')));
  return out;
}

const PC = extraerArray('PC');
const PC_DARK = extraerArray('PC_DARK');

// Los mismos tonos que CG/CO/CR usan HOY (leidos de las mismas 2
// asignaciones de charts.js) -- nunca un valor copiado a mano aqui, para
// que si alguien cambia el semaforo esta prueba se actualice sola.
function extraerColorDeAsignacion(nombreVar, bloque) {
  const re = new RegExp(nombreVar + "='(#[0-9a-fA-F]{6})'");
  const m = bloque.match(re);
  assert.ok(m, `no se encontro ${nombreVar}='...' en charts.js`);
  return m[1];
}
const bloqueClaro = texto.match(/\} else \{([^}]+)\}/)[1];
const bloqueOscuro = texto.match(/if\(oscuro\)\{([^}]+)\}/)[1];
const SEMAFORO_CLARO = ['verde', 'ambar', 'rojo'].map((_, i) =>
  extraerColorDeAsignacion(['CG', 'CO', 'CR'][i], bloqueClaro)
);
const SEMAFORO_OSCURO = ['verde', 'ambar', 'rojo'].map((_, i) =>
  extraerColorDeAsignacion(['CG', 'CO', 'CR'][i], bloqueOscuro)
);

test('PC y PC_DARK tienen 12 colores hex validos', () => {
  [PC, PC_DARK].forEach((paleta) => {
    assert.equal(paleta.length, 12);
    paleta.forEach((hex) => assert.match(hex, /^#[0-9a-fA-F]{6}$/));
  });
});

test('ninguna serie de PC/PC_DARK es el mismo tono que el semaforo (CG/CO/CR) de su propio tema', () => {
  PC.forEach((hex, i) => {
    SEMAFORO_CLARO.forEach((semHex) => {
      assert.notEqual(hex.toLowerCase(), semHex.toLowerCase(), `PC[${i}]=${hex} es identico a un color del semaforo claro (${semHex})`);
    });
  });
  PC_DARK.forEach((hex, i) => {
    SEMAFORO_OSCURO.forEach((semHex) => {
      assert.notEqual(hex.toLowerCase(), semHex.toLowerCase(), `PC_DARK[${i}]=${hex} es identico a un color del semaforo oscuro (${semHex})`);
    });
  });
});

test('las 2 apariciones de PC en modo claro (declaracion inicial + aplicarTemaCharts) son identicas', () => {
  const apariciones = extraerTodasLasApariciones('PC');
  // La 1ra aparicion es la declaracion inicial de PC; la del else-branch
  // de aplicarTemaCharts es la ultima (PC_DARK queda en medio, con su
  // propio array -- ya cubierto por paletasIguales abajo via extraerArray).
  const inicial = apariciones[0];
  const delElse = apariciones[apariciones.length - 1];
  assert.deepEqual(inicial, delElse, 'la paleta clara deberia ser identica en ambos lugares donde se define');
});

test('las 12 series de PC pasan >=3:1 (componente grafico, WCAG 1.4.11) contra blanco y contra la superficie sutil', () => {
  PC.forEach((hex, i) => {
    ['#ffffff', '#f7fbfd'].forEach((bg) => {
      const r = contrasteRazon(hex, bg);
      assert.ok(r >= 3, `PC[${i}]=${hex} da ${r.toFixed(2)}:1 contra ${bg}, por debajo de 3:1`);
    });
  });
});

test('las 12 series de PC_DARK pasan >=3:1 contra las superficies oscuras', () => {
  PC_DARK.forEach((hex, i) => {
    ['#132c35', '#17343e'].forEach((bg) => {
      const r = contrasteRazon(hex, bg);
      assert.ok(r >= 3, `PC_DARK[${i}]=${hex} da ${r.toFixed(2)}:1 contra ${bg}, por debajo de 3:1`);
    });
  });
});

function minDeltaEPrimeras8(paleta) {
  const tipos = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
  const primeras = paleta.slice(0, 8);
  let min = Infinity;
  for (let i = 0; i < primeras.length; i++) {
    for (let j = i + 1; j < primeras.length; j++) {
      tipos.forEach((tipo) => {
        const a = tipo === 'normal' ? primeras[i] : contrasteSimularCvd(primeras[i], tipo);
        const b = tipo === 'normal' ? primeras[j] : contrasteSimularCvd(primeras[j], tipo);
        const de = contrasteDeltaE(a, b);
        if (de < min) min = de;
      });
    }
  }
  return min;
}

test('las primeras 8 series de PC se distinguen (deltaE CIELAB >= 12) incluso con protanopia/deuteranopia/tritanopia simuladas', () => {
  const min = minDeltaEPrimeras8(PC);
  assert.ok(min >= 12, `deltaE minimo real de PC: ${min.toFixed(2)} (se esperaba >= 12)`);
});

test('las primeras 8 series de PC_DARK se distinguen (deltaE CIELAB >= 12) incluso con vision alterada simulada', () => {
  const min = minDeltaEPrimeras8(PC_DARK);
  assert.ok(min >= 12, `deltaE minimo real de PC_DARK: ${min.toFixed(2)} (se esperaba >= 12)`);
});

test('CHART_TICK (claro) ya no es el gris viejo de bajo contraste (2.97:1) -- coincide con el --c-text-muted ya corregido en styles.css', () => {
  const m = texto.match(/CHART_TICK='(#[0-9a-fA-F]{6})'/);
  assert.ok(m);
  const r = contrasteRazon(m[1], '#ffffff');
  assert.ok(r >= 4.5, `CHART_TICK claro (${m[1]}) da ${r.toFixed(2)}:1 contra blanco, por debajo de 4.5:1`);
});
