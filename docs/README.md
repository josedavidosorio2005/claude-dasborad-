# docs/ — índice (Fase 124, 2026-10-06)

Mapa de una página de qué hay en `docs/`: qué está **vigente** (se sigue
actualizando, confía en esto) y qué es **histórico** (foto de un momento
pasado, no se reescribe — útil para entender por qué algo quedó como
quedó, pero puede no reflejar el estado actual). Para el resumen corto del
proyecto, ver [`PROGRESS.md`](../PROGRESS.md) en la raíz del repo.

## Vigentes — se actualizan fase tras fase

- **[pendientes.md](pendientes.md)** — único lugar con lo que falta:
  antes de entregar a Edwin, esperando a Edwin, esperando decisión de
  InCo, deuda técnica (con costo/riesgo), y lo que queda para después de
  la entrega.
- **[inventario-bases-orlant.md](inventario-bases-orlant.md)** — las 9
  bases de ORLANT: hoja, columnas, de dónde sale cada una, qué pestaña
  alimenta.
- **[plantillas-inventario.md](plantillas-inventario.md)** — por cada una
  de las 9 bases: qué plantilla descarga hoy la plataforma vs. qué exige
  el lector real vs. qué manda Edwin/Wolkvox en la práctica (Fase 124,
  solo lectura — insumo para la fase de plantillas oficiales que Edwin
  pidió dejar para después de la entrega).
- **[guia-uso-orlant.md](guia-uso-orlant.md)** — espejo legible en GitHub
  de la guía que ve el cliente real (`server/paginas/guia-uso.html`).
- **[procedimiento-carga-mensual.md](procedimiento-carga-mensual.md)** —
  guía corta para quien sube un mes nuevo de datos.
- **[infraestructura.md](infraestructura.md)** — estado vigente de la
  cuenta AWS / recursos / pipeline.
- **[ARQUITECTURA.md](ARQUITECTURA.md)** — foto completa del sistema tal
  como está hoy en el código.
- **[aws-permisos-pendientes.md](aws-permisos-pendientes.md)** — guía
  (sin aplicar nada) para el dueño de la cuenta AWS, permisos que faltan.

## Históricos — fotos de un momento, no se reescriben

- **[historico/progress-fases.md](historico/progress-fases.md)** — el
  detalle narrativo completo de cada fase desde la 112 (qué se hizo,
  verificación, PRs, estado final). Es **aditivo**: cada fase agrega su
  entrada al final, nunca se reescribe una ya publicada.
- **[auditoria-seguridad-fase72.md](auditoria-seguridad-fase72.md)**,
  **[auditoria-seguridad-fase81.md](auditoria-seguridad-fase81.md)**,
  **[auditoria-seguridad-fase102.md](auditoria-seguridad-fase102.md)** —
  auditorías de seguridad puntuales de esas fases (los hallazgos
  corregidos ya están en el código; estos documentos quedan como
  registro de qué se revisó y cuándo).
- **[calidad-flujo-edwin-brecha.md](calidad-flujo-edwin-brecha.md)** —
  análisis de brecha de la Fase 94 (qué describió Edwin vs. qué hace la
  plataforma en Calidad); referencia para cuando se retome ese tema.
- **[ejemplos-plantilla-consolidada/](ejemplos-plantilla-consolidada/)** —
  2 archivos de ejemplo (nombres ficticios) de cómo se veía la plantilla
  consolidada vieja (Fase 24), solo como referencia histórica.
- **[historico/](historico/)** (el resto) — reportes de fases muy
  anteriores (`AWS_DEPLOY_REPORT.md`, `DEPLOY_REPORT.md`,
  `LAUNCH_REPORT.md`, `REAL_DATA_REPORT.md`, `SECURITY_FIX_REPORT.md`,
  `UI_CLEANUP_REPORT.md`, `estado-pendientes-fase74.md`,
  `guia-de-usuario.md` vieja) — consultar solo si hace falta entender una
  decisión antigua.

## Fuera de `docs/`, pero relacionados

- **`PROGRESS.md`** (raíz) — resumen corto y vigente: versión, pestañas y
  bases de ORLANT, números de control, índice de títulos de todas las
  fases.
- **`CHANGELOG.md`** (raíz) — historial de versiones en español simple,
  para Edwin/Jairo.
- **`scripts/README.md`** — qué script de QA/producción sirve para qué
  (todos de uso manual, ninguno corre en CI salvo `ci.yml` →
  `.github/scripts/`).
- **`CLAUDE.md`** (raíz) — reglas fijas de este repo, para cualquier
  sesión de Claude Code.

## No commiteado (por diseño)

- **`docs/capturas-demo/`** — capturas sueltas de verificaciones locales,
  nunca se suben a `main` (quedan en disco, sin rastrear por git).
- **`graphify-out/`** y **`.claude/`** — generados/locales, ignorados por
  `.gitignore`.
