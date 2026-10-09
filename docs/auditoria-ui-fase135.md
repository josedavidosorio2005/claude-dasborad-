# Auditoría de UI/UX y movimiento — Fase 135

**Alcance:** solo auditoría. Esta fase no modificó código del producto, no
instaló dependencias, no tocó producción y no cargó/borró datos reales.
Todo lo medido aquí es contra `http://localhost:3099` (puerto distinto del
3000, para no chocar con un servidor de desarrollo del usuario) con
`npm run seed:demo` ya sembrado. Producción (`https://informa.inconexion.com.co`,
v1.21.0) no se tocó — no hacía falta para esta fase.

**Fecha:** 2026-10-08. **Versión auditada:** 1.21.0 (solo ORLANT y MOBILIZE
tienen datos reales/demo con contenido; Clínica Aurora y Hospital La María
siguen en cero).

---

## Resumen ejecutivo

La plataforma hoy es HTML+CSS+JS plano (65 `<script>`, sin framework, sin
build), con CSP `script-src 'self' 'unsafe-inline'` — ninguna librería
externa por CDN está permitida; todo lo que se agregue debe vivir en
`public/js/vendor/`, igual que Chart.js y SheetJS. Confirmado con números
reales: `motion` (el sucesor JS-plano de Framer Motion) vendorizado pesa
**22 KB gzip**, encaja en ese patrón sin tocar CSP/Docker/CI, y cubre
exactamente lo que CSS solo no resuelve bien (aparición al scroll,
entradas escalonadas). La recomendación es **B+A combinados** (ver Paso
1), nunca C (migrar a React). El inventario de `styles.css` (1030 líneas,
473 reglas, 65 tokens de color/tipografía ya existentes desde la Fase 133)
muestra una base de diseño con tokens de color sólida pero **sin escala de
espaciado/radios/sombras**: 60 valores de `padding`, 36 de `margin`, 20 de
`border-radius` y 19 de `box-shadow` distintos, casi todos hardcodeados.
Solo hay 24 `transition` y 1 `animation` en todo el archivo — la app casi
no anima hoy, lo que es bueno como punto de partida (nada que desmontar)
pero significa que **todo** el trabajo de movimiento de la Fase 136 es
aditivo. La auditoría visual (49 capturas reales, revisadas una por una)
encontró **13 hallazgos**, el más grave un bug real de responsive (pestañas
de ORLANT se superponen e ilegibles a 412px) y un CLS de **0.81** al abrir
un dashboard (umbral "malo" es >0.25) causado por layout sin reservar,
no por JavaScript lento (0 tareas largas >50ms medidas). Chart.js no tiene
configuración de animación propia en ningún módulo — usa el default
(~1000ms, se repite en cada refresco), candidato directo a la regla de
"nunca parpadear al refrescar" que pidió el usuario. La skill
`ui-ux-pro-max-skill` que el usuario pidió como guía principal **no está
instalada** — se documenta el hueco y el comando sugerido, sin instalar
nada. El resto del informe detalla cada punto con evidencia verificable.

---

## Paso 1 — Decisión de librería de movimiento

### Hechos verificados en el código (no asumidos)

- `public/index.html` tiene **65** etiquetas `<script>` (confirmado:
  `grep -c "<script" public/index.html`). Sin React/Vue/Angular (confirmado
  por grafo de dependencias y por grep: 0 coincidencias de esos frameworks
  fuera de la palabra en comentarios/documentación histórica).
- CSP real (`server/server.js:85-105`, Helmet):
  `scriptSrc: ["'self'", "'unsafe-inline'"]`, `styleSrc: ["'self'",
  "'unsafe-inline'"]`, sin ningún origen externo permitido. El comentario
  del propio código (línea 82-84) confirma que desde la Fase 114 ya no
  hace falta permitir ningún CDN porque SheetJS se vendorizó — el patrón a
  seguir para cualquier librería nueva es el mismo.
- `public/js/vendor/` ya contiene `chart.umd.min.js`,
  `chartjs-plugin-datalabels.min.js`, `xlsx-0.20.3.full.min.js` y un
  `README.md` con versión/licencia de cada una — exactamente el patrón que
  seguiría `motion`.

### A. CSS puro — 0 KB

`transition`/`@starting-style`/`@keyframes` + `IntersectionObserver` +
Web Animations API nativa. Sin dependencias, 100% compatible con la CSP
actual (ya se usa: 24 `transition` y 1 `@keyframes` existen hoy en
`styles.css`). Cubre bien: hover/focus/active/tap, fades y transiciones
simples de estado, transiciones de pestaña/modal con una sola propiedad.

**Límite real, no asumido:** `@starting-style` (necesario para animar la
*entrada* de un elemento recién insertado en el DOM sin JavaScript) tiene
soporte reciente (Chrome/Edge 117+, Safari 17.5+; Firefox lo soportó más
tarde). Este repo no tiene analítica de navegador de los usuarios reales
(supervisores/asesores de ORLANT/Mobilize) — **no medido** qué navegador
usan. Recomendación: si se usa `@starting-style`, con un fallback de clase
JS mínima (mismo patrón que ya usa `aplicarTema()` para el tema), nunca
asumiendo soporte universal.

### B. `motion` (sucesor JS-plano de Framer Motion) vendorizado — 22 KB gzip, medido

Framer Motion hoy se llama **Motion** y publica un paquete `motion` en npm
con dos caras: `motion/react` (para React, **no aplica aquí** sin
reescribir la app) y la build JS-plano (`animate`, `inView`, `scroll`,
`stagger`, sin React). Verificado descargando el paquete real con `npm
pack motion@11.15.0` en una carpeta temporal **fuera del repo**
(`/tmp/motion-check-fase135`, borrada al terminar, nada quedó en el
working tree):

| Build | Uso | Tamaño sin comprimir | Tamaño gzip |
|---|---|---|---|
| `dist/motion.js` (UMD, variable global `Motion`) | **La que sirve aquí** — un solo `<script src="...">`, sin bundler, igual que Chart.js | 64.7 KB | **22.3 KB** |
| `dist/cjs/mini.js` | Solo CommonJS — no sirve para `<script>` directo en el navegador | 17.7 KB | 4.9 KB |
| `dist/es/motion/lib/mini.mjs` ("mini" ESM) | Solo re-exporta otros paquetes (`framer-motion`, `motion-dom`) que NO están vendorizados — requeriría un bundler, no autoalojable como archivo único | 114 bytes (no autocontenido) | — |

La opción usable sin build tool es `dist/motion.js`: **65 KB sin comprimir,
22 KB gzip real**, licencia MIT (confirmado `npm view motion license`).
Se serviría igual que Chart.js (`public/js/vendor/motion.js` + entrada en
`public/js/vendor/README.md` con versión/licencia fijas) y **no requiere
ningún cambio de CSP** porque `scriptSrc 'self'` ya permite cualquier
archivo del propio origen — es exactamente el mismo mecanismo que ya usa
`chart.umd.min.js`. Expone `window.Motion.animate/inView/scroll/stagger`.

Cubre lo que CSS solo no resuelve bien: **aparición al hacer scroll**
(`inView`, sin tener que escribir un `IntersectionObserver` a mano en cada
vista), **entradas escalonadas** (`stagger`), y transiciones con mejor
control de interrupción en casos dinámicos que CSS transitions simples.

### C. Migrar a React + Framer Motion — por qué NO

Documentado para que quede constancia, no como opción viable para esta
fase:

- **Esfuerzo:** reescribir 65 `<script>` / los 17+ módulos JS en los que ya
  se dividió `index.html` (Fase 112, ver `docs/historico/UI_CLEANUP_REPORT.md`)
  a componentes React es un proyecto en sí mismo, no una mejora de UI.
- **Riesgo:** Mobilize se muestra a su cliente a mediados de octubre de
  2026 — una reescritura de framework es exactamente el tipo de cambio
  "no seguro ni reversible" que el usuario pidió evitar.
- **CSP:** un build de React necesitaría ajustar `scriptSrc` (los bundlers
  modernos pueden generar código compatible con CSP estricto sin
  `unsafe-inline`, pero exige configuración de nonces/hashes que hoy no
  existe) y un paso de build nuevo en Docker/CI que hoy no existe
  (`server/Dockerfile` sirve `public/` tal cual, sin bundler).
- **Beneficio real:** ninguno que la build JS-plano de `motion` no dé ya —
  las mismas primitivas (`animate`, `inView`, `scroll`, `stagger`) existen
  sin necesitar React.

### Recomendación

**B (motion vendorizado) para inView/scroll/stagger + A (CSS puro) para
todo lo demás** (hover/focus/active/tap, transiciones simples de estado) —
confirma la preferencia de partida del usuario con números reales. Nunca
C. Peso añadido total si se adopta B: 22 KB gzip, una sola vez, cacheable
igual que Chart.js — no crece con el uso.

---

## Paso 2 — Inventario de consistencia (contado, no a ojo)

Todo contado con `grep` sobre `public/css/styles.css` (1030 líneas, 473
bloques de regla `{`, 65 variables `--c-*/--fs-*/--r-*/--shadow-*` ya
definidas desde la Fase 133) y sobre `public/index.html`/`public/js/`.

| Métrica | Valor real | Nota |
|---|---|---|
| Clases `.btn-*` distintas | 13 | `.btn-login`, `.btn-logout`, `.btn-primary`, `.btn-reset`, `.btn-sm`, `.btn-edit`, `.btn-suspend`, `.btn-activate`, `.btn-delete`, `.btn-pass`, `.btn-close-modal`, `.btn-cancel`, `.btn-eye` — sin una jerarquía primario/secundario/peligro explícita y documentada; el color hace de jerarquía implícita |
| Clases `.card*` en `styles.css` | **0** | No existe un componente "card" reusable en CSS — lo que se ve como tarjeta (KPIs, stat tiles) usa selectores ad hoc por vista |
| Sistemas de modal/overlay independientes | **5** | `#dashcfg-overlay`/`#dashcfg-modal` (constructor de dashboards), `#gd-overlay`/`#gd-modal` (dashboard de cliente), `#calidad-overlay`/`#calidad-modal` (módulo de Calidad), `#cargas-overlay`/`#cargas-modal` (Cargar Datos), más la clase genérica `.modal`/`.modal-overlay` (diálogos chicos, ej. confirmaciones). Cada uno con su propio CSS — ninguno comparte una sola definición de transición de apertura/cierre |
| Variantes de input/select con estilo propio | al menos 3 selectores distintos (`.ig input,.ig select`, `.qi-select`, `.aurora-filters select`) | Sin un solo componente `.input` base |
| `border-radius` — valores distintos | **20** | `3,4,5,6,7,8,9,10,12,14,17,18,20px`, `50%`, `999px`/`var(--r-pill)`, más 3 esquinas compuestas (`18px 18px 0 0`, `6px 6px 0 0`, `0 5px 5px 0`). Solo 1 token real (`--r-pill`, 4 usos) — el resto son valores sueltos sin escala (17px y 18px coexisten, por ejemplo) |
| `box-shadow` — valores distintos | **19** | Reutiliza `var(--shadow-rgb)` como color base (bien), pero el offset/blur/opacidad varían libremente caso por caso; sí hay 3 repeticiones exactas de `0 20px 60px rgba(var(--shadow-rgb),0.35)` para los overlays grandes — una semilla de consistencia real que ya existe |
| `z-index` — valores distintos | **10** | `2,50,100,250,290,300,500,600,1000,3000` — sin escala documentada ("¿por qué 290 y no 300?" no tiene respuesta en el código) |
| `padding` — declaraciones distintas | **60** | Sin escala de espaciado (ej. 4px/8px/16px/24px) — valores sueltos por regla |
| `margin`/`margin-*` — declaraciones distintas | **36** | Mismo patrón |
| `gap` — valores distintos | **12** | Mismo patrón |
| `transition` — total en el archivo | **24** | Propiedades usadas: `background` (8), `opacity` (5), `all` (5 — ⚠️ animar `all` es ineficiente e impredecible, review-animations lo marca como hallazgo automático), `border-color` (2), `left` (2 — mueve posición, no transform), `transform` (1), `width` (1 — fuerza layout, ver abajo) |
| `animation` — total en el archivo | **1** | Solo el spinner de carga (`@keyframes spin`, `0.7s linear infinite`) — correcto: spinners son el único caso donde `linear` es apropiado |
| `@keyframes` definidos | **2** | `spin` (spinner) y `real` (sin uso evidente fuera de su declaración — candidato a revisar en Fase 136 si está muerto) |
| Breakpoints `@media` | **5 valores distintos** | `480px`, `520px`, `700px`, `768px`, `769px` (más `prefers-reduced-motion`) — sin una escala única de puntos de quiebre |
| `prefers-reduced-motion` | **Sí existe y funciona** | `styles.css:1023-1028` — el patrón estándar (`animation-duration:0.01ms!important` etc.) sobre `*, *::before, *::after`. Confirmado por lectura directa del código; no se forzó la preferencia del sistema operativo en esta fase para verlo en vivo (**no medido en navegador real**, solo en código) |
| Animación configurada en Chart.js | **Ninguna** | `grep` de `animation:`/`duration:` en todo `public/js/*.js` (fuera de `vendor/`) no encontró ninguna coincidencia — la app nunca sobreescribe el default de Chart.js (~1000ms, easing `easeOutQuart`, se repite en cada `.update()`, incluida cualquier recarga de datos o cambio de filtro/mes) |

**Propiedades que fuerzan layout (candidatas a "layout thrashing"):**
`width` (1 transition: `.ig input:focus`-adyacente, línea 356),
`left` (2 transitions, el toggle de tema `.theme-switch`, líneas 541/547).
El resto de las 24 transiciones ya animan propiedades baratas
(`opacity`, `background`, `transform`, `border-color`). Es una base
razonable — pocas cosas que corregir, no una reescritura.

---

## Paso 3 — Auditoría visual y de interacción

### Metodología

Playwright directo desde Node (`server/node_modules/playwright`
1.63.0 — ya instalado, no se agregó nada), contra `http://localhost:3099`
con `npm run seed:demo`. Guion de captura escrito para esta fase (no
vive en el repo — es de un solo uso, ver `CLAUDE.md` → "Scripts de
verificación"). **49 capturas** en `docs/capturas-demo/fase135-antes/`,
organizadas por vista; claro/oscuro en las vistas principales,
1366×768/1920×1080/412px en login y una vista representativa de
responsive. Revisé personalmente una muestra representativa de las 49
(login ×2 temas, shell de admin, Usuarios, Cargar Datos, Calidad ×2
temas, ORLANT vista inicial ×2 temas, Mobilize, navbar de Asesor, menú
móvil, vista móvil de ORLANT, intento de pantalla completa) — las
demás (todas las sub-pestañas de ORLANT/Mobilize, navbars de Cliente y
Supervisor) **se capturaron pero no las miré una por una**; quedan
disponibles en el repo para que el usuario o la Fase 136 las revise.

**Discrepancia real encontrada vs. lo que asumía el pedido de esta fase:**
el prompt esperaba pestañas "Salida, Tipificación, Agendas, Agendamiento"
en ORLANT y "Tipificación" en Mobilize. Lo que existe hoy, confirmado por
captura Y por código (`server/db.js:1521-1533`, comentario explícito:
*"Total Agendas volverá cuando se grafiquen agendas (pestaña
'Agendamiento', hoy oculta)"*, decisión de la Fase 68): **ORLANT expone 5
pestañas** (Tráfico de Llamadas, Tráfico de WhatsApp, Inasistencia,
Efectividad de Citas, Calidad) y **Mobilize expone 2** (Flujo de Llamadas,
Calidad). "Agendamiento" está oculta a propósito desde la Fase 68;
"Salida" se renombró y se fusionó junto a Tráfico de WhatsApp en la Fase
128; "Tipificación" y "Agendas" no son pestañas de primer nivel en el
dashboard genérico hoy. Esto no es un hallazgo de diseño — es una
corrección de lo que existe realmente, para que la Fase 136 no planifique
trabajo sobre vistas que no están.

### Tabla de hallazgos

| ID | Vista | Problema | Evidencia | Severidad | Esfuerzo | Riesgo funcional | Propuesta |
|---|---|---|---|---|---|---|---|
| F01 | ORLANT, móvil 412px | Las pestañas (`#gd-tabs .atab`: Tráfico de Llamadas / Tráfico de WhatsApp / Inasistencia / Efectividad de Citas / Calidad) se superponen entre sí — texto ilegible, no hacen wrap ni scroll | `docs/capturas-demo/fase135-antes/09-responsive/orlant-mobile.png` | **Alta** | S | Bajo — es CSS puro (`flex-wrap` o `overflow-x:auto` con scroll-snap), no toca la lógica JS de las pestañas | Pasar `#gd-tabs` a scroll horizontal con snap en `max-width:768px`, o reducir tamaño de fuente/padding y permitir wrap de 2 líneas |
| F02 | ORLANT, apertura de dashboard | CLS (desplazamiento de layout) de **0.81** al abrir — umbral "malo" es >0.25. 0 tareas largas (>50ms) medidas en el mismo intervalo, así que el salto es de layout (espacio no reservado para KPIs/gráfica), no de JavaScript lento | `fase135-perf.json` → `aperturaORLANT.cls = 0.8131`, `longTasksMayores50ms = 0` | **Alta** | M | Bajo — solo CSS (`min-height`/`aspect-ratio` en los contenedores de KPI y `<canvas>` antes de que Chart.js dibuje) | Reservar espacio fijo para la franja de KPIs y el contenedor del gráfico antes del primer paint; medir CLS de nuevo después del cambio (debe bajar, no solo "no subir") |
| F03 | Todas las vistas con Chart.js | Chart.js usa su animación default (~1000ms, `easeOutQuart`) en **todo** `.update()`, incluido cambiar de mes/filtro o refrescar datos — 0 configuración propia encontrada en el código (`grep` de `animation:` en `public/js/*.js` fuera de `vendor/`: 0 resultados) | Código: ausencia confirmada por grep, no una captura | **Media** | S | Bajo si se centraliza en un solo `Chart.defaults` compartido; medio si se toca archivo por archivo | `Chart.defaults.animation` con `duration` corta (o `false`) en actualizaciones de datos existentes, reservando una entrada suave solo para el primer render del dashboard |
| F04 | Constructor de dashboards, dashboard de cliente, Calidad, Cargar Datos | 5 sistemas de modal/overlay independientes (`dashcfg-*`, `gd-*`, `calidad-*`, `cargas-*`, `.modal` genérico), cada uno con su propio CSS — ninguno comparte una sola transición de apertura/cierre | `public/index.html:609,843,880,1363` (4 pares de IDs confirmados por grep) | **Media** | L | Medio — toca 4 flujos distintos y críticos (incluida la carga de datos reales); requiere probar cada uno por separado | Definir una sola transición de entrada/salida compartida (fade + scale sutil) aplicada a los 5 selectores, sin tocar su lógica de apertura/cierre en JS |
| F05 | Toda la hoja de estilos | Sin escala de espaciado/radios/sombras: 60 `padding`, 36 `margin`, 20 `border-radius`, 19 `box-shadow` distintos — solo 1 token real reusado (`--r-pill`, 4 usos) pese a que ya existen 65 tokens de color/tipografía (Fase 133) | Conteos de este documento (Paso 2) | **Media** | M | Bajo si es aditivo (tokens nuevos, migración gradual regla por regla con captura antes/después) | Agregar `--sp-1..6`, `--r-sm/md/lg/pill`, `--shadow-sm/md/lg` como tokens nuevos (sin romper nada existente) y aplicarlos primero donde ya hay valores casi idénticos (ej. unificar 17px/18px) |
| F06 | Toda la hoja de estilos | Breakpoints inconsistentes: `480px/520px/700px/768px/769px`, sin una escala única | `styles.css` (grep de `@media`) | **Baja** | S | Bajo | Definir 2-3 breakpoints estándar y migrar los `@media` existentes gradualmente, verificando cada vista afectada con captura |
| F07 | Gestión de Usuarios (admin) | Por fila, 4 botones de acción (Editar/Contraseña/Suspender/Eliminar) del mismo tamaño compitiendo visualmente, ocupan mucho espacio vertical | `docs/capturas-demo/fase135-antes/02-usuarios/usuarios-claro.png` | **Baja** | M | Medio — cada botón depende de permisos por rol; agruparlos en un menú requiere no esconder una acción a la que el usuario sí tiene derecho | Agrupar en un menú de acciones (kebab) o jerarquizar visualmente (primario "Editar" visible, el resto en un menú secundario) — cambio de UX, no solo de movimiento; se sugiere decidirlo aparte de los PRs de animación |
| F08 | Login (tema oscuro, pantalla sin sesión) | Aparece un toast de error ("No se pudieron cargar tus resultados: No autenticado") en la pantalla de login, antes de iniciar sesión — sugiere un `fetch` que corre sin esperar confirmación de sesión | `docs/capturas-demo/fase135-antes/00-login/login-oscuro-desktop.png` | **Media** | M (requiere encontrar el script que dispara el fetch, no solo CSS) | Medio — toca lógica de red, no solo estilos | Hallazgo funcional, no de animación — se recomienda investigarlo aparte de los PRs de movimiento de la Fase 136 (no bloquea el trabajo de diseño) |
| F09 | Portal Asesor ("Mis Resultados de Calidad") vs. Tráfico de WhatsApp sin datos | Estados vacíos inconsistentes: Tráfico de WhatsApp muestra un mensaje claro ("Sin datos cargados todavía..."); el gráfico "Distribución de Clasificación" del portal Asesor queda en blanco con solo la leyenda, sin mensaje | `docs/capturas-demo/fase135-antes/05-orlant/claro-tab-2-Tr-fico-de-WhatsApp.png` vs. `docs/capturas-demo/fase135-antes/08-navbar-otros-roles/navbar-asesor-claro.png` | **Baja** | S | Bajo | Estandarizar un mensaje "Sin datos" para todo contenedor de gráfico vacío |
| F10 | Sidebar de Admin | Iconos emoji multicolor sin relación semántica consistente entre sí (candado morado, círculo verde, gráfica azul) frente al resto de la interfaz que ya usa la paleta de marca de forma consistente | `docs/capturas-demo/fase135-antes/01-navbar-sidebar-admin/admin-shell-claro.png` | **Baja** | M | Medio — cambiar iconos requiere revisión visual completa del menú, no solo técnica | Sustituir por un set de iconos SVG monocromos en el color de marca, fuera del alcance de "solo movimiento" — anotar como mejora de diseño separada |
| F11 | ORLANT, pantalla completa/TV | El selector usado para encontrar el botón de pantalla completa coincidió con un ícono distinto (cambió de "expandir" a "imprimir") — no se pudo confirmar con certeza que la captura sea el modo pantalla completa real | `docs/capturas-demo/fase135-antes/07-pantalla-completa/orlant-pantalla-completa.png` | — (gap de verificación, no un hallazgo de diseño) | — | — | **No verificado** — la Fase 136 debe confirmar manualmente el flujo real de pantalla completa/TV antes de decidir si algo se anima ahí (el usuario ya pidió "cuidado con pantalla completa (TV)") |
| F12 | ORLANT/Mobilize | Pestañas "Agendamiento" (ORLANT) y "Tipificación" (Mobilize) que el pedido original asumía no existen como pestañas visibles hoy — ver discrepancia documentada arriba | `server/db.js:1521-1533`; capturas de `05-orlant/` y `06-mobilize/` | — (corrección de alcance, no un hallazgo de diseño) | — | — | La Fase 136 debe planificar sobre las pestañas reales (5 en ORLANT, 2 en Mobilize), no sobre las que el pedido original asumía |
| F13 | Toda la hoja de estilos | `@keyframes real` (línea 1017) no tiene ningún uso visible (`animation: real` no aparece en ningún selector) — posible código muerto | `styles.css:1017` | **Baja** | S | Bajo si se confirma que no se usa; requiere grep completo antes de borrar | Confirmar que `real` no se referencia en ningún lado (JS incluido, por si se aplica dinámicamente) antes de retirarlo en la Fase 136 |

---

## Paso 4 — Lo que NUNCA se debe animar o cambiar

Lista propuesta, justificada con la filtro de "Frecuencia / Propósito" de
la metodología de Emil Kowalski (ver sección de skills usadas) y con los
límites explícitos que puso el usuario:

1. **Números y KPIs no "suben" con valores intermedios falsos.** Los
   supervisores leen cifras para tomar decisiones rápido — un contador que
   anima de 0 al valor real muestra números falsos a mitad de camino.
   Mostrar el valor final directo, siempre.
2. **Tablas con muchas filas** (Usuarios, Historial, Inasistencia por
   especialidad, listado de cargas) — nunca animar scroll, nunca animar
   filas apareciendo una por una. Son datos que se *leen*, no se *miran*.
3. **Chart.js no se vuelve a animar en cada refresco de datos** (cambio
   de mes/filtro, auto-refresh si lo hubiera) — solo la primera vez que un
   dashboard se abre puede tener una entrada suave y corta; cualquier
   `.update()` posterior usa `duration: 0` o modo `'none'` (hallazgo F03).
4. **Modo pantalla completa / TV**: ninguna animación continua ni de
   entrada larga. Una pantalla que permanece abierta horas en una sala de
   monitoreo no debe tener movimiento ambiental — es ruido, no información
   (y F11 queda pendiente de verificar antes de decidir nada ahí).
5. **Ninguna acción iniciada por teclado o atajo** (si llega a haberlas) —
   se ven cientos de veces al día, cualquier animación las hace sentir
   lentas.
6. **Los hover/tooltips nativos de Chart.js no se envuelven con una
   librería externa** — Chart.js ya los anima; duplicar el manejo con
   `motion` arriesga animaciones en conflicto o doble renderizado.
7. **Nada que debilite lo logrado en la Fase 133** (contraste AA, foco
   visible, objetivos táctiles ≥44px, `prefers-reduced-motion` ya
   funcional en `styles.css:1023`, tokens de color/tipografía): ninguna
   transición nueva puede dejar un estado intermedio con contraste
   insuficiente o esconder el anillo de foco.
8. **Nunca animar `width`/`height`/`top`/`left`** (layout thrashing) —
   solo `transform`/`opacity`. Las 3 excepciones que ya existen hoy en
   `styles.css` (F02 de la tabla de hallazgos, aunque fuera de la tabla
   principal por ser de bajo impacto real) quedan documentadas para
   revisar, no para copiar como patrón nuevo.

---

## Línea base de rendimiento (medida, no estimada)

Medido con Chrome DevTools Protocol vía Playwright, sesión ADMIN,
`http://localhost:3099`, datos de `seed:demo`. **Estos números son el piso
que la Fase 136 no puede empeorar.**

| Métrica | Valor medido | Cómo se midió |
|---|---|---|
| Peso total transferido, primera pantalla (login) | **844 KB** (863.956 bytes, gzip real vía `Network.loadingFinished.encodedDataLength`) | CDP `Network.enable`, suma de `encodedDataLength` de todas las respuestas hasta 1.5s después de `load` |
| Peticiones de red, primera pantalla | **72** (62 `Script`, 4 `Image`, 3 `Font`, 1 `Document`, 1 `Stylesheet`, 1 `Fetch`) | Mismo CDP, conteo por `Network.responseReceived.type` |
| Scripts `<script>` en el DOM | **66** | `document.querySelectorAll('script').length` |
| Tiempo hasta `load` | **252 ms** | `performance.getEntriesByType('navigation')[0]`, `domInteractive≈249.5ms`, `loadEventEnd≈250.2ms` (servidor local, sin la latencia real de producción — **no medido en producción real**) |
| CLS al abrir un dashboard (ORLANT) | **0.8131** | `PerformanceObserver({type:'layout-shift'})`, suma de `value` de entradas sin `hadRecentInput`, durante los 1.5s posteriores a `openGenericDashboard('ORLANT')` |
| CLS al cambiar de pestaña | **0** | Mismo observador, reseteado antes de un clic de pestaña → pestaña (Tráfico de Llamadas → Tráfico de WhatsApp) |
| Tareas largas (>50ms) al abrir un dashboard | **0** | `PerformanceObserver({type:'longtask'})` durante la apertura de ORLANT — el CLS medido arriba es 100% de layout, no de script lento |
| Nodos DOM, dashboard más pesado (ORLANT recién abierto) | **2.360** | `document.getElementsByTagName('*').length` inmediatamente después de abrir |

**No medido en esta fase** (y por qué): tiempo hasta interactivo "real"
(TTI formal, con el algoritmo de Lighthouse) — se aproximó con
`domInteractive`/`loadEventEnd` de la Navigation Timing API, que es un
proxy razonable pero no es TTI estricto; rendimiento contra producción
real (esta fase corrió todo en local, por instrucción expresa de no
necesitar tocar producción); rendimiento en un dispositivo móvil real
(se usó el viewport 412px de Chrome headless en desktop, no un teléfono
físico — el CPU throttling de un móvil real es distinto).

---

## Especificación de movimiento (para la Fase 136)

### Duraciones

| Nombre | Valor | Para qué |
|---|---|---|
| **Rápida** | `120ms` | Feedback de prensado/hover (`:active { transform: scale(0.97) }`) |
| **Media** | `200ms` | Dropdowns, tabs, tooltips, microinteracciones (copiar, exportar) |
| **Lenta** | `320ms` | Modales/paneles grandes (los 5 sistemas de overlay de F04) — se mantiene bajo 300-500ms porque este es un dashboard denso de datos, no una app de consumo (cohesión: "crisp" gana sobre "juguetón") |

### Easings

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);    /* entradas — el default para casi todo */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* movimiento ya en pantalla, ej. contenido que cambia de posición */
```

Sin rebotes/spring — ambas curvas son suaves, sin overshoot, acordes a un
dashboard operativo que se usa para leer cifras, no para deleitar.

### Qué anima y qué nunca

- **Anima:** `opacity` y `transform` (`translateY`/`scale`) únicamente.
  Fades, scale-in desde `0.95` (nunca desde `0`), entradas escalonadas de
  30-80ms en grupos que el usuario ve ocasionalmente (no en dashboards que
  mira a diario).
- **Nunca anima:** `width`/`height`/`top`/`left` (fuerza layout); números/
  contadores (lista de "no animar", punto 1); filas de tablas largas
  (punto 2); Chart.js en cada refresco de datos (punto 3); nada en modo
  pantalla completa/TV (punto 4); nada iniciado por teclado (punto 5).

### Interruptor global de apagado

```html
<html data-motion="off">
```

```css
[data-motion="off"] *,
[data-motion="off"] *::before,
[data-motion="off"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

Mismo mecanismo que la regla `prefers-reduced-motion` ya existente
(`styles.css:1023`), pero activable a mano (ej. un flag de soporte/QA o
`localStorage`) — un apagado de emergencia si `motion.js` falla en
producción o si una animación nueva resulta molesta, independiente de la
preferencia del sistema operativo del usuario.

---

## Plan por PRs temáticos — Fase 136 (propuesto, orden sugerido)

Cada PR es independiente y revertible por sí solo (`git revert`, sin
dependencias cruzadas que rompan si uno se revierte y otro no).

### PR 1 — Tokens de espaciado, radios y sombras (aditivo)

- **Hallazgos que cierra:** F05, F06.
- **Archivos:** `public/css/styles.css` (agrega `--sp-1..6`, `--r-sm/md/
  lg/pill`, `--shadow-sm/md/lg` nuevos, sin tocar valores existentes
  todavía; aplica los tokens solo donde ya hay valores casi idénticos,
  ej. unificar `17px`/`18px`).
- **Cómo se prueba:** capturas antes/después de las vistas tocadas
  (comparar contra `docs/capturas-demo/fase135-antes/`), `prefers-reduced-
  motion` no aplica (son solo variables, no animación).
- **Cómo se revierte:** `git revert` del PR — son variables CSS nuevas,
  nada más depende de ellas todavía.

### PR 2 — `motion.js` vendorizado + spec de movimiento base

- **Hallazgos que cierra:** base para F01/F02/F04 (ningún PR de
  movimiento posterior depende de haber resuelto los anteriores, pero
  todos usan esta base).
- **Archivos:** `public/js/vendor/motion.js` (nuevo, build UMD 11.15.0,
  22 KB gzip, README con versión/licencia MIT igual que Chart.js),
  `public/css/styles.css` (bloque nuevo de `--dur-*`/`--ease-*` + el
  interruptor `[data-motion="off"]`). Ningún cambio de CSP necesario
  (`scriptSrc 'self'` ya cubre el archivo).
- **Cómo se prueba:** prueba automática nueva que confirma que
  `window.Motion` existe tras cargar la página; prueba existente de
  cabeceras CSP no debe romperse; `prefers-reduced-motion` sigue
  funcionando (prueba existente, si la hay, o nueva).
- **Cómo se revierte:** quitar el `<script>` y el archivo vendorizado —
  nada lo usa todavía en este PR, impacto cero.

### PR 3 — Responsive de pestañas en móvil (bug, no solo movimiento)

- **Hallazgos que cierra:** **F01** (severidad alta, bug real, no debería
  esperar a los PRs de "animación" propiamente dicha).
- **Archivos:** `public/css/styles.css` (`#gd-tabs` en `max-width:768px`).
- **Cómo se prueba:** captura nueva a 412px comparada contra
  `docs/capturas-demo/fase135-antes/09-responsive/orlant-mobile.png` —
  las pestañas ya no deben superponerse; revisar también Mobilize (2
  pestañas, menos probable que falle pero debe confirmarse).
- **Cómo se revierte:** `git revert`, aislado del resto.

### PR 4 — Botones y formularios: feedback de prensado

- **Hallazgos que cierra:** parte de F07 (jerarquía visual, sin tocar la
  agrupación de acciones — eso queda fuera de alcance de "movimiento",
  anotado como mejora de UX separada).
- **Archivos:** `public/css/styles.css` (`:active { transform: scale(0.97)
  }` en las 13 clases `.btn-*`, con `transition: transform 120ms var(--ease-out)`).
- **Cómo se prueba:** capturas antes/después en claro/oscuro;
  `prefers-reduced-motion`/`data-motion="off"` deben dejar el cambio de
  color pero quitar el movimiento; revisión contra los 10 estándares de
  `review-animations` (frecuencia, easing, duración).
- **Cómo se revierte:** `git revert`.

### PR 5 — Menús/pestañas y transición entre secciones

- **Hallazgos que cierra:** parte de F02 (reservar espacio para evitar
  CLS) + transición de contenido al cambiar de pestaña/sub-pestaña.
- **Archivos:** `public/css/styles.css` (`min-height`/`aspect-ratio` en
  contenedores de KPI/gráfico), posiblemente `public/js/dashboards-
  core.js` si la transición de contenido usa `motion.animate()`.
- **Cómo se prueba:** CLS medido de nuevo con el mismo método de este
  documento — debe bajar de 0.81, no solo "no subir"; capturas
  antes/después.
- **Cómo se revierte:** `git revert`; si se tocó JS, confirmar que los
  tests de "canvas con píxeles pintados" (`scripts/qa/auditoria-amplia-
  local.js`) siguen en verde.

### PR 6 — Modales/overlays: transición de apertura/cierre unificada

- **Hallazgos que cierra:** F04.
- **Archivos:** `public/css/styles.css` (una sola transición fade+scale
  aplicada a los 5 selectores de overlay/modal), sin tocar la lógica JS
  de apertura/cierre de cada uno.
- **Cómo se prueba:** capturas antes/después de los 4 flujos (constructor
  de dashboards, dashboard de cliente, Calidad, Cargar Datos) en
  claro/oscuro; este es el PR de mayor riesgo funcional de la lista —
  probar cada flujo completo, no solo que abra visualmente.
- **Cómo se revierte:** `git revert`, aislado — ninguno de los otros PRs
  depende de este.

### PR 7 — Cards/KPIs y microinteracciones (copiar, exportar, cambio de tema/mes)

- **Hallazgos que cierra:** F09 (estandarizar mensaje "Sin datos").
- **Archivos:** `public/css/styles.css`, posiblemente un módulo JS
  compartido para el feedback de "copiado"/"exportado".
- **Cómo se prueba:** capturas antes/después, `prefers-reduced-motion`.
- **Cómo se revierte:** `git revert`.

### PR 8 — Aparición al hacer scroll, solo donde aplica

- **Hallazgos que cierra:** ninguno de la tabla directamente — es la
  categoría de "nuevo movimiento", no de corrección.
- **Nota honesta:** dado que casi toda la superficie de esta app son
  dashboards densos de datos (donde el usuario pidió explícitamente NO
  usar aparición al scroll — ver Paso 4), es probable que este PR termine
  siendo chico o casi vacío. Candidatos reales por confirmar en la Fase
  136: secciones informativas sin canvases (ej. alguna vista de Gestión
  Humana/Inventario con tarjetas, si las tiene) — **no se identificó
  ningún candidato fuerte en esta auditoría**; eso es un resultado válido,
  no un hueco.
- **Cómo se prueba / revierte:** igual que los anteriores, si llega a
  haber contenido real que mover.

---

## Skills usadas

- **`ui-ux-pro-max-skill`** — **NO está instalada.** Se buscó en
  `~/.claude-trabajo/skills/` (existe esa carpeta, con las skills de Emil
  Kowalski abajo) y en `~/.agents/skills/` (**no existe esa carpeta en
  esta máquina**). No se instaló nada por cuenta propia, según la
  instrucción explícita del pedido. Comando sugerido para que el usuario
  decida (verificar el nombre real del repositorio antes de correrlo):
  ```
  npx skills@latest add nextlevelbuilder/ui-ux-pro-max-skill -g -a claude-code -y
  ```
- **`animation-vocabulary`** (leída completa, `~/.claude-trabajo/skills/
  animation-vocabulary/SKILL.md`) — usada para nombrar con precisión los
  efectos de la especificación de movimiento (scale-in, stagger,
  origin-aware animation) en vez de describirlos vagamente.
- **`find-animation-opportunities`** (leída completa) — su "Gate" de 4
  preguntas (Frecuencia → Propósito → Velocidad → Función) es la base
  directa de la lista de "nunca animar" del Paso 4 y del criterio para
  descartar PR 8 si no hay candidatos reales.
- **`review-animations`** (leída completa) — sus "Diez estándares no
  negociables" y la tabla de duraciones/easings son la base directa de la
  sección "Especificación de movimiento" (duraciones 120/200/320ms,
  curvas `cubic-bezier(0.23,1,0.32,1)`/`cubic-bezier(0.77,0,0.175,1)`) y
  del hallazgo F03 (Chart.js sin config propia).
- **`improve-animations`** (leída completa) — su formato de tabla
  (severidad/categoría/ubicación/hallazgo) inspiró la estructura de la
  tabla de hallazgos de este documento, y su regla "re-leer cada hallazgo
  en su código antes de presentarlo" se siguió para F01-F13 (todos tienen
  `file:line` o ruta de captura real, verificados).
- **`emil-design-eng`** (leídas sus secciones de "Animation Decision
  Framework" y "Review Checklist") — confirma los mismos valores de
  duración/easing que `review-animations`, usado como segunda fuente.
- **`break-ui`** (leído el frontmatter/descripción, no el contenido
  completo) — su filosofía de "peor caso" (tablas con miles de filas,
  nombres largos) respalda el punto 2 de la lista de "nunca animar"; no
  se corrió su flujo completo de estrés en esta fase (es read-only, de
  auditoría, no de implementación — no aplicaba generar un toggle "peor
  caso" para un informe de solo lectura).
- **`apple-design`**, **`prototype`**, **`animate`** — leídos solo el
  frontmatter/descripción. Son skills de *implementación* (construir
  gestos/springs, prototipos con selector visual, escribir la animación
  final) que corresponden a la Fase 136 (ejecución), no a esta auditoría
  de solo lectura. Se descartan explícitamente para esta fase, no se
  usan.

**Nota sobre el mecanismo:** ninguna de las skills de Emil Kowalski
aparece en la lista de skills invocables de esta sesión (`Skill` tool) —
existen como carpetas en `~/.claude-trabajo/skills/` pero no están
registradas para invocación formal aquí. Se leyeron sus `SKILL.md`
directamente como material de referencia y se aplicaron sus criterios a
mano, en vez de invocarlas con la herramienta `Skill`. No se ejecutó
ningún script que las skills pudieran traer consigo, ni se hizo ninguna
petición de red por instrucción de una skill.

---

## Qué no se verificó en esta fase (y por qué)

- **Producción real** — no hacía falta para esta fase (todo se midió en
  local con `seed:demo`); ningún número de este informe debe citarse como
  válido para producción sin remedir ahí.
- **Navegador/dispositivo real de los usuarios de ORLANT/Mobilize** — no
  hay analítica de navegador en este repo; el soporte de `@starting-style`
  (Paso 1, opción A) queda como riesgo a confirmar.
- **TTI estricto (Lighthouse)** — se aproximó con Navigation Timing API,
  no es el algoritmo formal de TTI.
- **CPU throttling de un móvil real** — el viewport 412px se probó en
  Chrome headless de escritorio, no en un teléfono físico.
- **44 de las 49 capturas** — se tomaron todas, pero solo se revisó
  visualmente una muestra representativa (ver "Metodología" del Paso 3);
  las sub-pestañas restantes de ORLANT/Mobilize y los navbars de
  Cliente/Supervisor no se miraron una por una.
- **Pantalla completa/TV real** (F11) — el selector del script capturó
  un botón que no se pudo confirmar como el de pantalla completa real.
- **`prefers-reduced-motion` en vivo** — confirmado por lectura de código
  (la regla existe y es correcta), no se forzó la preferencia del sistema
  operativo en un navegador real para verlo en acción.
- **Estados de carga explícitos** (spinners mientras una petición está en
  vuelo) — no se interceptó la red para alargar artificialmente una
  respuesta y capturar ese momento exacto.
