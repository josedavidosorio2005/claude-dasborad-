# Marca InConexion® (Fase 132)

Dónde viven los archivos de marca y los tokens de color/tipografía, para
no tener que ir al código cada vez. Los originales de diseño (PNG a
resolución de impresión, ~4000-6500px) **nunca se commitean** — viven
fuera del repo, en `C:\Users\filid\Documents\datos-inconexion\marca\`.

## Logos e íconos (`public/img/marca/`)

Generados desde los originales con `sharp` (resize + PNG optimizado, sin
metadatos). 8 archivos, 1x + @2x cada uno:

| Archivo | Uso |
|---|---|
| `logo-horizontal-color.png` (+@2x) | Login, tema **claro** (la tarjeta es blanca) |
| `logo-horizontal-blanco.png` (+@2x) | Login tema **oscuro** (tarjeta `#132c35`) y pantalla de bienvenida (`user-page`, fondo degradado oscuro fijo en los 2 temas) |
| `isotipo-blanco.png` (+@2x) | Navbar de las 4 vistas con navbar (Admin, Cliente, Asesor, Supervisor) — fondo siempre `var(--c-brand)` (teal fijo, no cambia con el tema) |
| `isotipo-color.png` (+@2x) | Reservado para un futuro avatar — sin uso en la UI todavía |

El favicon (`public/favicon.ico` + `favicon-32/180/192.png`) sale de
`isotipo-color-sobre-fondo-oscuro.png` (ya trae su propio fondo teal
horneado, se ve bien en una pestaña de navegador clara u oscura).

Las otras 8 variantes de los 12 archivos originales (una tinta, grises,
negro — pensadas para impresión/PDF) no tienen copia en `public/`:
ningún export de la plataforma las usa hoy (no hay PDFs). Si hace falta
una, se genera igual que las de arriba desde la carpeta de marca.

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
