# Sistema de diseño — InConexion® Platform (Fase 133, ampliado Fase 136)

Referencia de los tokens de color/tipografía/espaciado de
`public/css/styles.css`, la regla de los 2 sistemas de color, y cómo
agregar un color nuevo sin romper el contraste. Los valores reales
siempre viven en el CSS — este documento los explica, no los duplica
(los contrastes medidos abajo se re-miden automáticamente en
`server/tests/fase133-parte6-regresion-wcag.test.js`, que falla si
alguien los rompe otra vez).

## Los 2 sistemas de color (nunca se mezclan)

1. **Semáforo** (`--c-success`/`--c-warning`/`--c-danger` y sus
   variantes `-dark`/`-text`/`-bg`): significa "cumple / cerca / no
   cumple una meta". Se usa en celdas de tabla (`td.kpi-green/org/red`),
   tarjetas KPI (`.aurora-kpi.kpi-*`) y spans sueltos
   (`.kpi-green/org/red`). Desde la Fase 133 (Parte 2), el color NUNCA es
   el único indicador — un símbolo (`●`/`◆`/`■`, distinto del `▲`/`▼` que
   ya usa la flecha de tendencia) + texto accesible oculto
   (`.sr-only`) lo acompañan, generados por
   `semaforoBadgeHtml()` (`public/js/semaforo-logic.js`). Donde ya hay
   texto visible describiendo el estado (p. ej. "Activo"/"Retirado",
   "Sí"/"No"), no se agrega símbolo — ya cumple WCAG 1.4.1.
2. **Paleta categórica** (`PC`/`PC_DARK` en `public/js/charts.js`):
   series de una gráfica sin juicio de valor (skills, asesores, colas).
   Nunca usa tonos verde/ámbar/rojo (reservados al semáforo) — solo
   teal/azul/índigo/púrpura/magenta/marrón.

## Tokens de color

Todos en `:root` (claro) y `:root[data-theme="dark"]` (oscuro) de
`styles.css`. `--c-brand` y `--c-on-brand` son los únicos que **nunca**
cambian con el tema (navbar, botones y headers de tablero siguen el
mismo teal en los 2 temas).

| Token | Uso | Contraste medido (claro) |
|---|---|---|
| `--c-brand` | Navbar, botones de marca, headers de tabla (fondo fijo) | texto `--c-on-brand` (blanco) = 11.22:1 |
| `--c-text` / `--c-text-2` / `--c-text-muted` | Jerarquía de texto | ≥4.5:1 contra `--c-surface`/`--c-bg`/`--c-surface-subtle` |
| `--c-text-link` | Enlaces | ≥4.5:1 |
| `--c-success`/`--c-warning`/`--c-danger` | Relleno/borde/gráfica del semáforo (≥3:1, WCAG 1.4.11) | `--c-danger` sin cambio; `--c-success`/`--c-warning` bajados de luminosidad en la Fase 133 |
| `--c-success-dark`/`-warning-dark`/`-danger-dark` | Texto de badge/historial sobre su `-bg` (≥4.5:1) | — |
| `--c-success-text`/`-warning-text`/`-danger-text` | Texto corto sobre la celda/tarjeta TINTADA del semáforo (≥4.5:1 contra la celda compuesta, no solo contra el `-bg` plano) | — |
| `--c-border-control` | Borde de input/select/filtro real (≥3:1, WCAG 1.4.11) — los bordes decorativos de tarjeta (`--c-border`) se quedan suaves a propósito | — |
| `--c-focus` | Anillo de `:focus-visible` (≥3:1) — sobre el navbar (fondo `--c-brand` fijo) se usa `--c-on-brand` en su lugar | — |
| `--c-brand-blue`/`-green`/`-gray-*` | Paleta oficial del logo (Fase 132), documentados — el azul NO se usa como texto sobre fondo claro (falla AA) | — |

## Tipografía

`--font-sans: 'Quicksand', 'Segoe UI', system-ui, …` — autoalojada
(`public/fonts/`, 4 pesos: 400/500/600/700, nunca Google Fonts en
runtime). `--fw-regular`/`-medium`/`-semibold`/`-bold` son esos mismos 4
pesos — nunca declarar 800/300, Quicksand no los tiene cargados.

Escala (`--fs-*`), 8 pasos, **`--fs-note` (0.75rem/12px) es el piso
absoluto** — ningún texto de la plataforma baja de ahí:

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-note` | 0.75rem (12px) | notas, pie de gráfica, leyendas — mínimo |
| `--fs-small` | 0.8125rem (13px) | etiquetas secundarias, encabezados de tabla |
| `--fs-body` | 0.875rem (14px) | cuerpo, celdas, controles |
| `--fs-body-lg` | 1rem (16px) | texto destacado, botones principales |
| `--fs-h3` | 1.125rem (18px) | título de sección/panel |
| `--fs-h2` | 1.375rem (22px) | título de pestaña/modal |
| `--fs-kpi` | 1.75rem (28px) | cifras destacadas de tarjetas |
| `--fs-display` | 2rem (32px) | iconos-emoji grandes (no es texto de lectura) |

Chart.js dibuja en `<canvas>`, no puede leer `--fs-*` de CSS — sus
tamaños (`font:{size:N}` en `charts.js` y cada módulo de dashboard) son
números JS sueltos, con el mismo piso de 12px aplicado a mano.
`font-variant-numeric: tabular-nums` en números de KPI/tabla para que
las columnas alineen.

## Espaciado, radios y sombras (Fase 136, PR 3)

**Corrección sobre la auditoría de la Fase 135**
(`docs/auditoria-ui-fase135.md`, Paso 2): esa auditoría reportó "sin
escala de espaciado/radios/sombras". Eso era incorrecto — la escala
**ya existía** en `:root` desde antes de la Fase 136 (`--space-1..10`,
`--r-sm/md/lg/xl/pill`, `--shadow-sm/md/lg`), el problema real era de
**adopción**: solo 7 usos de `--space-*`, 4 de `--r-pill`, 1 de
`--shadow-md` contra 60 declaraciones de `padding`, 36 de `margin`, 20 de
`border-radius` y 19 de `box-shadow` sueltas en el resto del archivo.

| Token | Valor | Uso |
|---|---|---|
| `--space-1` … `--space-10` | 4/8/12/16/20/24/32/40px (base 4px) | Espaciado nuevo — usar en vez de un número suelto |
| `--r-sm` | 6px | Botones, inputs, tarjetas chicas |
| `--r-md` | 10px | Tarjetas, gráficas |
| `--r-lg` | 14px | Paneles grandes |
| `--r-xl` | 18px | Modales/overlays grandes (ventana flotante) |
| `--r-pill` | 20px | Insignias, botones redondeados (no confundir con `999px`, el pill TOTALMENTE circular de `.gd-subtab-btn`, que es otro valor y no se tocó) |
| `--shadow-sm` | `0 2px 8px rgba(var(--shadow-rgb),0.07)` | Tarjetas pequeñas |
| `--shadow-md` | `0 2px 12px rgba(var(--shadow-rgb),0.1)` | Tarjetas medianas |
| `--shadow-lg` | `0 8px 40px rgba(var(--shadow-rgb),0.2)` | Paneles grandes |
| `--shadow-xl` | `0 20px 60px rgba(var(--shadow-rgb),0.35)` (**nuevo, Fase 136**) | Overlays a pantalla completa (Calidad/Cargas/constructor de dashboards) — ya se repetía idéntico 3 veces sin nombre |

La Fase 136 (PR 3) migró las **coincidencias exactas** (mismo valor
numérico, cero cambio visual posible) de `border-radius`/`box-shadow` a
estos tokens — nunca un valor que no calzara exacto, para no arriesgar
una regresión visual. Quedan sueltos a propósito: valores que no son
múltiplo de la escala (3/4/5/7/9/12/17px — organicos, probablemente
ajustes finos caso por caso de fases anteriores) y las esquinas
compuestas (`18px 18px 0 0`, etc. — no se puede reemplazar una esquina
con `var()` sin tocar las otras 3, que pueden ser `0`).

**z-index**: 10 valores distintos (2/50/100/250/290/300/500/600/1000/
3000), sin tokens. **No se tocó en la Fase 136** — a diferencia de
radio/sombra, no hay forma de confirmar "cambio cero" sin revisar cada
capa una por una (qué se superpone a qué, en qué orden), y el riesgo de
romper un apilamiento visual no vale la pena para un PR que se definió
"aditivo, sin cambios visuales". Candidato para una fase futura
dedicada, con su propia verificación capa por capa.

**Breakpoints** (`@media`): 5 valores distintos (480/520/700/768/769px),
sin una escala única. **Tampoco se tocó** — esta app no tiene paso de
build/preprocesador CSS, así que no existe una forma de usar una
variable DENTRO de la condición de un `@media` sin herramientas que este
repo no tiene (`@custom-media` requiere PostCSS). Cambiar a mano
cualquiera de los 5 valores existentes podría mover el punto exacto
donde una vista cambia de layout — eso SÍ sería un cambio visual real,
fuera del alcance "aditivo" de este PR. Si se necesita una escala nueva,
debe decidirse fase por fase, revisando cada media query tocada con
captura antes/después.

## Movimiento (Fase 136, PR 4)

**Decisión de librería — actualizada con números reales de esta fase.**
La auditoría de la Fase 135 (`docs/auditoria-ui-fase135.md`, Paso 1)
estimó `motion` (sucesor JS-plano de Framer Motion) vendorizado en
**22 KB gzip** (v11.15.0) y recomendó usarlo para salidas animadas de
modales y transición entre pestañas. Verificado de nuevo en esta fase
con la última versión estable publicada hace ≥14 días (`npm view motion
version time`, v13.4.2, 2026-09-23): el único build autoalojable sin
bundler (`dist/motion.js`, variable global `Motion`) pesa **49 KB gzip
real** — más del doble. Los 2 casos de uso reales de esta fase (salida
de modales, transición entre pestañas) no necesitan física de resortes,
`inView` ni scroll-linked animation — **se resuelven igual con CSS +
`public/js/motion-helpers.js`** (vanilla, ~1.5 KB gzip, sin
dependencias): `motionExit(el, onDone)` quita la clase de estado
(dispara la transición CSS de salida) y espera `transitionend` antes de
llamar `onDone` (donde el caller oculta el elemento); `motionEnter(el)`
agrega la clase un frame después de que el elemento ya es visible, para
que el navegador sí anime desde el estado inicial. **No se vendorizó
`motion`** — si en una fase futura aparece un candidato real de
`inView`/`stagger`/`scroll` (aparición al hacer scroll, Fase 135 Paso 3,
PR 8), se reevalúa con el mismo método (descargar en una carpeta fuera
del repo, medir gzip real, decidir con números).

### Especificación

3 duraciones, 2 curvas (sin rebotes — un tablero de datos denso es
"crisp", no "juguetón"):

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | 120ms | Feedback de prensado/hover |
| `--dur-medium` | 200ms | Dropdowns, pestañas, microinteracciones |
| `--dur-slow` | 320ms | Modales/paneles grandes |
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | Entradas — el default para casi todo |
| `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | Movimiento ya en pantalla (contenido que cambia de posición) |

**Qué anima:** `opacity` y `transform` (`translateY`/`scale`) únicamente.
Entradas desde `scale(0.95)` + `opacity:0` (nunca `scale(0)`).

**Qué NUNCA anima** (lista completa y su justificación en
`docs/auditoria-ui-fase135.md`, Paso 4): números/KPIs con valores
intermedios falsos; filas de tablas largas; Chart.js en cada `.update()`
de datos ya cargados; nada en modo pantalla completa/TV; nada iniciado
por teclado; `width`/`height`/`top`/`left` (fuerzan layout).

### Interruptor global de apagado

```html
<html data-motion="off">
```

Mismo mecanismo exacto que `prefers-reduced-motion` (que cubre la
preferencia del sistema operativo), pero activable a mano — un apagado
de emergencia si algo de movimiento falla en producción, o para
soporte/QA. Los dos son independientes: cualquiera de los 2 activos
apaga el movimiento (`animation-duration`/`transition-duration` caen a
0.01ms). **Probado de verdad en navegador** (Playwright, forzando
`reducedMotion:'reduce'` del contexto real Y fijando el atributo a
mano) — con cualquiera de los 2 activos, `.atab` mide
`transition-duration` real de `0.00001s` (vs `0.2s` sin ninguna
preferencia) y el dashboard/Calidad se siguen abriendo y usando bien, 0
errores de página.

## Foco visible (WCAG 2.4.7/2.4.11)

Regla global al final de `styles.css`:
`a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible, summary:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }`
— va al **final del archivo a propósito**: varias reglas más arriba usan
`outline:none` sin reemplazo (inputs/selects de filtro); con la misma
especificidad `(0,1,0)`, gana la que aparece más abajo en la cascada.
Sobre el navbar (`--c-focus` no llega a 3:1 contra `--c-brand`) se
redefine a `--c-on-brand`.

## Objetivos táctiles (WCAG 2.5.8)

Escritorio ≥24×24px (explícito, todo lo demás ya lo cumple).
Móvil (≤768px) ≥44×44px en los controles PRINCIPALES: cerrar/exportar
del dashboard, el selector de MES, las pestañas. Sub-pestañas y botones
chicos de tabla (`.btn-sm`) se quedan como están — son secundarios y muy
numerosos en una fila.

## Movimiento reducido (WCAG 2.3.3)

`@media (prefers-reduced-motion: reduce)` apaga `animation-duration`/
`transition-duration` globalmente (snippet estándar) — el único
`@keyframes` real de la plataforma es el spinner de carga.

## Cómo agregar un color nuevo sin romper el contraste

1. Decide primero si es **semáforo** (significado) o **paleta
   categórica** (serie sin juicio) — nunca lo mismo para los dos.
2. Mide el contraste real con `public/js/contraste-logic.js`
   (`contrasteRazon(hexA, hexB)`) contra TODAS las superficies donde
   va a aparecer — nunca a ojo. Umbral: 4.5:1 si es texto normal, 3:1 si
   es texto grande (≥24px, o ≥18.66px en negrita), borde de control, o
   relleno/gráfica (objeto gráfico, WCAG 1.4.11).
3. Si es una serie nueva de `PC`/`PC_DARK`: confirma que no caiga en los
   tonos del semáforo (hue fuera de verde/ámbar/rojo) y mide
   `contrasteDeltaE` contra las demás series, bajo `contrasteSimularCvd`
   (protanopia/deuteranopia/tritanopia) — apunta a ≥12 entre las
   primeras 8.
4. Agrega el token a `:root` (y a `:root[data-theme="dark"]` si cambia
   con el tema) con un comentario que diga el contraste medido y contra
   qué.
5. Corre `server/tests/fase133-parte6-regresion-wcag.test.js` — si falla,
   ajusta el TONO (nunca el texto) hasta que pase.

## Pendiente (no esta fase)

- Extender el job `pantallas` del CI para revisar foco visible y
  nombres accesibles automáticamente — requiere tocar
  `.github/workflows/ci.yml`, fuera de alcance sin autorización
  explícita (ver `CLAUDE.md` → reglas de CI/workflows). Ver
  `docs/pendientes.md`.
