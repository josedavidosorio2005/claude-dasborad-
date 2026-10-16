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

// ── Fase 152 (B1): semaforo solo con meta; series con la paleta ──────────
const JS_DIR = path.join(__dirname, '..', '..', 'public', 'js');
const leerJs = (f) => fs.readFileSync(path.join(JS_DIR, f), 'utf8');
// Archivos donde CG/CO/CR SI son semaforo a proposito: la torta de
// clasificacion de Calidad (sobresaliente/no critico/critico, excepcion
// documentada), la pantalla de Umbrales y la definicion en charts.js.
const SEMAFORO_PERMITIDO = ['charts.js', 'umbrales.js', 'calidad.js', 'mis-resultados.js', 'dashboard-generic.js'];

test('Fase 152 B1: ninguna serie de grafica de los tableros usa los colores del semaforo (CG/CO/CR)', () => {
  const archivos = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && !SEMAFORO_PERMITIDO.includes(f) && !/^vendor|chart\.umd|xlsx/.test(f));
  for (const f of archivos) {
    const src = leerJs(f);
    assert.doesNotMatch(src, /typeof C[GOR] ?!==? ?'undefined'/, `${f} usa CG/CO/CR para una serie`);
  }
  // dashboard-generic.js: solo la torta de clasificacion de Calidad.
  const gd = leerJs('dashboard-generic.js');
  const usos = gd.match(/typeof C[GOR]!=='undefined'/g) || [];
  assert.equal(usos.length, 3, 'solo los 3 colores de la torta de clasificacion de Calidad');
});

// Colores de serie de MARCA (ajuste pedido en la revision de B1), leidos de
// charts.js para cada tema.
function seriesDelTema(bloque) {
  const v = (n) => { const m = bloque.match(new RegExp(n + "='(#[0-9a-fA-F]{6}|null)'|" + n + '=(null)')); return m ? (m[1] || m[2]) : undefined; };
  return { principal: v('SERIE_PRINCIPAL'), secundaria: v('SERIE_SECUNDARIA'), borde: v('SERIE_SECUNDARIA_BORDE'), linea: v('SERIE_LINEA') };
}
const SERIES_CLARO = seriesDelTema(bloqueClaro);
const SERIES_OSCURO = seriesDelTema(bloqueOscuro);
const FONDOS = { claro: ['#ffffff', '#f7fbfd'], oscuro: ['#132c35', '#17343e'] };

test('Fase 152 B1: series con los colores de marca (teal, azul solo relleno, morado del sistema)', () => {
  assert.equal(SERIES_CLARO.principal.toLowerCase(), '#004150');
  assert.equal(SERIES_CLARO.secundaria.toLowerCase(), '#3da2db');
  assert.equal(SERIES_OSCURO.secundaria.toLowerCase(), '#3da2db');
  assert.equal(SERIES_CLARO.linea.toLowerCase(), '#8e44ad', '--c-purple claro');
  assert.equal(SERIES_OSCURO.linea.toLowerCase(), '#c084fc', '--c-purple oscuro');
  assert.equal(SERIES_OSCURO.principal.toLowerCase(), '#7dd6f0', 'variante clara del sistema (--c-on-primary-soft)');
  // El verde de marca y el semaforo nunca son una serie.
  for (const t of [SERIES_CLARO, SERIES_OSCURO]) {
    for (const c of [t.principal, t.secundaria, t.linea]) {
      assert.notEqual(c.toLowerCase(), '#74b859', 'el verde de marca queda para el semaforo');
      for (const sem of SEMAFORO_CLARO.concat(SEMAFORO_OSCURO)) assert.notEqual(c.toLowerCase(), sem.toLowerCase());
    }
  }
});

test('Fase 152 B1: contraste de cada serie contra el fondo (>= 3:1, WCAG 1.4.11), en claro y oscuro', () => {
  for (const [tema, ser] of [['claro', SERIES_CLARO], ['oscuro', SERIES_OSCURO]]) {
    for (const fondo of FONDOS[tema]) {
      assert.ok(contrasteRazon(ser.principal, fondo) >= 3, `${tema} principal vs ${fondo}`);
      assert.ok(contrasteRazon(ser.linea, fondo) >= 3, `${tema} linea vs ${fondo}`);
      // El azul de marca: si no llega a 3:1 (claro: 2,84:1), la barra lleva
      // un borde que si llega (teal de marca).
      if (contrasteRazon(ser.secundaria, fondo) < 3) {
        assert.ok(ser.borde && ser.borde !== 'null', `${tema}: azul sin 3:1 necesita borde`);
        assert.ok(contrasteRazon(ser.borde, fondo) >= 3, `${tema} borde vs ${fondo}`);
      }
    }
  }
  assert.ok(contrasteRazon(SERIES_CLARO.secundaria, '#ffffff') < 3, 'documenta por que existe el borde en claro');
  assert.match(texto, /function estiloBarraSecundaria()/);
});

test('Fase 152 B1: las series se distinguen entre si (deltaE >= 20), tambien con daltonismo', () => {
  for (const ser of [SERIES_CLARO, SERIES_OSCURO]) {
    const pares = [[ser.principal, ser.secundaria], [ser.principal, ser.linea], [ser.secundaria, ser.linea]];
    for (const [x, y] of pares) {
      assert.ok(contrasteDeltaE(x, y) >= 20, `${x} vs ${y}: deltaE ${contrasteDeltaE(x, y).toFixed(1)}`);
    }
    // Barras vecinas (principal/secundaria): distinguibles con los 3 tipos de daltonismo.
    for (const tipo of ['protanopia', 'deuteranopia', 'tritanopia']) {
      const d = contrasteDeltaE(contrasteSimularCvd(ser.principal, tipo), contrasteSimularCvd(ser.secundaria, tipo));
      assert.ok(d >= 15, `principal/secundaria con ${tipo}: deltaE ${d.toFixed(1)}`);
    }
  }
});

test('Fase 152 B1: linea de meta punteada solo desde un umbral configurado', () => {
  assert.match(texto, /function agregarLineaMeta\(datasets, opciones, umbral, n, yAxisID, unidad\)/);
  assert.match(texto, /if\(!umbral \|\| umbral\.verde === null/, 'sin umbral no se dibuja');
  assert.match(texto, /borderDash: \[6, 4\]/);
  assert.match(texto, /tooltip\.filter = function\(item\)\{ return !item\.dataset\.esMeta; \}/);
  const traf = leerJs('trafico.js');
  assert.match(traf, /agregarLineaMeta\(datasets, o, _traficoUmbral\('nivel_atencion', campana\)/);
  assert.match(traf, /agregarLineaMeta\(dsAband, oAband, _traficoUmbral\('tasa_abandono', campana\)/);
  assert.match(traf, /_traficoDibujarSL\('tv', i, agregadoComb, null, null, null, _traficoUmbral\('service_level', campana\)\)/);
  const wpp = leerJs('trafico-whatsapp.js');
  assert.doesNotMatch(wpp, /service_level/, 'WhatsApp: nivel de servicio sin meta acordada');
  // La linea punteada queda reservada a la meta.
  assert.doesNotMatch(traf, /borderDash:\[4,3\]/);
});

test('Fase 152 B1: tarjetas sin meta con borde neutro (sin verde/rojo fijo)', () => {
  for (const f of ['llamadas-unicas.js', 'tipificacion.js', 'whatsapp-tiempos.js']) {
    assert.doesNotMatch(leerJs(f), /aurora-kpi kpi-(green|red)/, f);
  }
  const traf = leerJs('trafico.js');
  assert.doesNotMatch(traf, /cls: 'kpi-green'/);
  assert.doesNotMatch(traf, /aurora-kpi kpi-red/);
});

test('Fase 152 B1: barras de comparacion (no tiempo) ordenadas de mayor a menor', () => {
  assert.match(leerJs('agendas.js'), /if\(vista === 'especialidad'\)\{\n[^\n]*\n\s*datos = datos\.slice\(\)\.sort\(function\(a,b\)\{ return \(b\.cantidad\|\|0\) - \(a\.cantidad\|\|0\); \}\);/);
});

test('Fase 152 B1: la linea de meta sola no hace que una grafica sin datos parezca con datos', () => {
  const { gdGraficaEstaVacia } = require('../../public/js/grafica-vacia-logic.js');
  const cfg = { data: { labels: ['Agosto 2026'], datasets: [{ data: [null] }, { esMeta: true, data: [5] }] } };
  assert.equal(gdGraficaEstaVacia(cfg), true);
  cfg.data.datasets[0].data = [3];
  assert.equal(gdGraficaEstaVacia(cfg), false);
  assert.match(texto, /if\(!hayDatos\) return;/);
});
