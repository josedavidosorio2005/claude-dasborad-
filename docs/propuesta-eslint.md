# Propuesta: ESLint mínimo (sin aplicar)

Fase 225 (revisión de bugs del 03/11/2026, hallazgo H5: "sin lint
configurado"). **Es solo una propuesta: no se agregó ESLint al repo, ni a
`package.json`, ni a CI.** Antes de aplicarla hay que decidir con el usuario,
porque toca CI (regla de `CLAUDE.md`: los cambios de workflows se consultan
antes).

## Qué se probó

ESLint 9 (configuración plana) en una carpeta aparte, fuera del repo, sobre
`server/`, `public/js/`, `scripts/` y `.github/scripts/`, con solo tres
reglas:

- `no-undef` (error): una variable o función que no existe.
- `no-redeclare` (error): la misma variable declarada dos veces.
- `no-unused-vars` (aviso).

`public/js` se carga como `<script>` sueltos que se usan entre sí, así que la
configuración toma como globales las funciones y variables de nivel superior
de todos sus archivos, más `XLSX`, `Chart` y `ChartDataLabels`. Se excluyen
`public/js/vendor/`, los `.min.js` y el tablero de SURA (`sura-televentas-app.js`,
generado por `scripts/sura/generar-televentas.js`).

## Resultado

Tardó unos 10 s. Dio **544 errores y 232 avisos**, casi todos falsos positivos:

| Dónde | Qué | Cuántos | Por qué |
|---|---|---|---|
| `scripts/` y `.github/scripts/` | `no-undef` | 411 | Código dentro de `page.evaluate(...)` de Playwright: corre en el navegador, no en Node. |
| `public/js` | `no-undef` | 130 | Casi todos son globales declarados en un `var a, b, c` de varias variables, que el recolector de la propuesta no ve. |
| `public/js` | `no-redeclare` | 2 | `state.js:22` y `users.js:309`: `var` repetido dentro de la misma función. No cambian el resultado. |
| `server/` | — | 0 | Solo 1 aviso en las pruebas. |
| todo | `no-unused-vars` | 232 avisos | Funciones que se llaman desde el HTML (`onclick`) y que ESLint no ve. |

**Hallazgo real que salió de la prueba:** `public/js/cargas.js` limpiaba
`_agendasCache` y `_inasistenciaCache` tras guardar Agendas o Inasistencia,
variables que no existen (la caché real es `_agendasOpciones` e
`_inasistenciaOpciones`). La limpieza no hacía nada y el mes recién cargado
no salía en el filtro del panel hasta cerrar sesión. **Ya se arregló en esta
misma fase** (prueba `server/tests/fase225-cargas-invalida-opciones.test.js`).

## Si se aplica, en qué orden

1. Agregar `eslint` y `globals` como dependencias de desarrollo de `server/`
   (pasar `npm audit`).
2. Empezar solo con `server/` (hoy da 0 errores) y un script `npm run lint`.
3. `public/js`: reconocer los `var` de varias variables como globales y
   marcar como usadas las funciones de `onclick`; corregir los 2
   `no-redeclare`.
4. `scripts/`: ignorar el código de `page.evaluate` (con
   `/* global document */` o una sección aparte con globales del navegador).
5. Al final, y solo con OK del usuario, un paso de lint en `ci.yml`.
