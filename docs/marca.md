# Marca InConexion® (Fase 132, al día en la Fase 146)

La plataforma se llama **SInCo** (Sistema de Información InConexión); la
marca de la empresa es **InConexion®** (sin tilde, con ®).

Dónde viven los archivos de marca y los tokens de color/tipografía, para
no tener que ir al código cada vez. Los originales de diseño (PNG a
resolución de impresión, ~4000-6500px) **nunca se commitean** — viven
fuera del repo, en `C:\Users\filid\Documents\datos-inconexion\marca\`.

## Logos e íconos (`public/img/marca/`)

Generados desde los originales con `sharp` (resize + PNG optimizado, sin
metadatos). 8 archivos, 1x + @2x cada uno:

| Archivo | Uso (actualizado Fase 146) |
|---|---|
| `isotipo-color.png` (+@2x) | **Login, tema claro**: dentro de la tarjeta, a la IZQUIERDA de "SInCo" en la misma línea, 36 px de alto (Fase 146; en la Fase 145 iba encima) |
| `isotipo-blanco.png` (+@2x) | **Login, tema oscuro** (mismo lugar), **bienvenida** a la izquierda de "SInCo" (44 px, en los 2 temas: el fondo es teal) y navbar de las 4 vistas con navbar |
| `logo-horizontal-blanco.png` (+@2x) | Logo pequeño en la esquina inferior derecha del login y de la bienvenida (`.marca-esquina`, 120×24, fondo teal en los 2 temas) |
| `logo-horizontal-color.png` (+@2x) | Sin uso en la interfaz hoy (reservado) |

Login y bienvenida usan el mismo patrón (`.marca-sinco`, `styles.css`): logo +
"SInCo" en una línea (flex, `align-items:center`, sin salto de línea), el
conjunto centrado y el logo un poco más alto que las letras. Tamaño fijo por
CSS y por `width`/`height` en cada `<img>`, así nada salta mientras carga la
imagen; a 375 px cabe sin desbordar. El tema se fija antes del primer dibujo,
así que nunca se ve el isotipo del otro tema.

El favicon (`public/favicon.ico` + `favicon-32/180/192.png`) sale de
`isotipo-color-sobre-fondo-oscuro.png` (ya trae su propio fondo teal
horneado, se ve bien en una pestaña de navegador clara u oscura).

Las otras 8 variantes de los 12 archivos originales (una tinta, grises,
negro — pensadas para impresión/PDF) no tienen copia en `public/`:
ningún export de la plataforma las usa hoy (no hay PDFs). Si hace falta
una, se genera igual que las de arriba desde la carpeta de marca.

## Logo de cliente en el encabezado del tablero (`public/img/clientes/`)

Distinto de los logos de marca InConexion de arriba — es el logo del
**cliente** (Mobilize, Orlant) que `renderGenericHeader()`
(`public/js/dashboard-generic.js`) pone junto al título del tablero.
`mobilize-logo.png` (+@2x) es definitivo. `orlant-logo.png` (+@2x,
Fase 218) reemplaza al provisional de la Fase 138 (`orlant-logo-blanco`):
sale del original que mandó Edwin (710×281, a color, fondo blanco), sin la
línea pequeña de texto de abajo ("Clínica de Otorrinolaringología…", que no
se lee a ese tamaño), en blanco sobre transparente (alfa = oscuridad del
píxel) para el encabezado teal, a 28 px de alto en 1x (92×28) y 56 px en 2x
(184×56). Se muestra a 28 px en escritorio y 22 px en el celular: el alto de
cada cliente sale del registro (`logo.alto` / `logo.altoMovil`, variables
CSS `--gd-logo-alto` / `--gd-logo-alto-movil`); sin esos datos, 25/18 px
como Mobilize.

## Colores oficiales (`public/css/styles.css`, bloque `:root` al inicio)

Muestreados de los archivos de logo reales, no de memoria:

| Token | Valor | Uso |
|---|---|---|
| `--c-brand` | `#004150` (teal) | Navbar, botones principales, headers de tablero — el único color de marca que **nunca** cambia con el tema |
| `--c-brand-blue` | `#3DA2DB` | Documentado, sin uso forzado en UI (falla AA como texto sobre fondo claro, 2.84:1) |
| `--c-brand-green` | `#74B859` | Borde de "Última actualización" (clientes que no son Mobilize) |
| `--c-brand-gray-dark/mid/light` | `#575756` / `#878787` / `#B2B2B2` | Documentados, para variantes de logo/impresión |

`--c-primary` (el token de texto/acento que usan >100 reglas en todo el
tablero) se dejó **sin tocar** a propósito — ya era casi idéntico al
oficial, y tocarlo no mejoraba nada visible.

## Tipografía (`public/fonts/`)

Quicksand autoalojada (4 pesos: 400/500/600/700, solo latin, ~61KB
total) — nunca Google Fonts en runtime (privacidad + la CSP del
servidor solo permite `'self'`/`data:` en `font-src`). Licencia SIL OFL
1.1 en `public/fonts/LICENSE-quicksand.txt`. `--font-sans` en
`styles.css` la usa primero, con `'Segoe UI'`/`system-ui` como
respaldo.

Para actualizar a una versión nueva de la fuente: `npm pack
@fontsource/quicksand` en una carpeta temporal (nunca se agrega a
`server/package.json`), copiar los `.woff2` de peso 400/500/600/700
(carpeta `files/`, variante `latin`) a `public/fonts/`, y la licencia.
