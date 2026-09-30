# CLAUDE.md — reglas fijas de este repo (InConexión Platform)

Estas reglas aplican a CUALQUIER sesión de Claude Code en este repo, sin
importar la fase o el pedido. `PROGRESS.md` es la bitácora fuente de verdad
de todas las fases — leerla (junto con `gh pr list` y `git log`) antes de
asumir en qué quedó una fase anterior.

## Subagentes

- **Nunca uses un subagente de tipo `fork` en este repo.** Ya pasó DOS
  veces (Fase 64 y Fase 77) que un fork ignoró la instrucción de "solo
  investigación, no escribas código" y terminó editando archivos sin
  permiso. El costo de un fork que se sale de su alcance en este proyecto
  (datos reales de clientes, producción con carga real) es demasiado alto
  para el ahorro de contexto que da.
- Si usas cualquier otro tipo de subagente, dale un alcance explícito de
  **solo lectura**: prohibido editar archivos, comitear, hacer push,
  mergear, borrar ramas, tocar producción, o correr `git
  checkout`/`switch`/`stash`/`reset`. Nada de levantar servidores ni
  navegadores en paralelo al agente principal. El agente principal (vos)
  siempre verifica personalmente lo que el subagente reporte antes de
  confiar en ello — un reporte de subagente describe lo que INTENTÓ hacer,
  no necesariamente lo que hizo.

## Git y CI

- Nada de `git push --force` (ni siquiera a una rama propia sin pedirlo
  explícitamente).
- Nunca saltar hooks (`--no-verify`) ni bypassear firmas (`--no-gpg-sign`).
- Nunca mergear con CI en rojo.
- **Nunca commitear ni pushear directo a `main`.** Todo cambio, incluso si
  es solo de documentación (`PROGRESS.md`, `docs/`), va en una rama con
  PR y CI en verde antes de mergear — sin excepción de "es solo un doc".
  (Precedente real: Fase 85 cerró con un commit directo a `main`,
  `a440176`, solo `PROGRESS.md` — no debió pasar por fuera de un PR.)
- Todo cambio sigue el ciclo completo: rama nueva → tests → CI verde
  (Node 22 + docker-build) → `npm audit` limpio → PR → merge →
  deploy automático (AWS vía OIDC) → verificación en producción real
  cuando aplica (no solo el test suite).
  (Desde la Fase 96, CI solo prueba Node 22 — la versión de producción,
  `server/Dockerfile`. Node 18/20 salieron de la matriz: ya no tienen
  soporte upstream y `better-sqlite3` no trae binario listo para ellos,
  lo que colgaba esos jobs.)
- Cualquier cosa que toque CI/workflows (`.github/workflows/`) o secretos
  de deploy se consulta con el usuario ANTES de tocarla — no asumir que
  "arreglar CI" autoriza cambiarlo sin avisar.

## Producción

- **Producción: `https://informa.inconexion.com.co` (único dominio).**
  duckdns se retiró el 29/09/2026 (Fase 93); no volver a usarlo — no
  queda como alterno, no redirige, no sirve la app por ningún otro nombre
  ni por la IP directa.
- **Para agregar o quitar un dominio, usar el workflow
  `dominio-produccion.yml`** (modo `revisar` primero, después `aplicar` o
  `quitar`) — nunca a mano por SSH. Agrega/quita el dominio del Caddyfile
  real de la instancia y de `CORS_ORIGIN`, con respaldo automático y
  reversión si algo falla (validate, health check o certificado). El
  Caddyfile del repo (`deploy/Caddyfile`) es solo una plantilla; el real
  vive en la instancia y ese workflow es la única forma auditada de
  tocarlo.
- Nunca escribir en producción sin autorización EXPLÍCITA del usuario en
  el pedido de esa fase — una autorización de una fase no se extiende a
  la siguiente ni a otros datos.
- Cuando el usuario autoriza una carga real en producción, es SOLO por la
  interfaz normal de la plataforma (como lo haría un usuario real) — nunca
  escribiendo directo en la base de datos, nunca por un workflow (los
  archivos reales de clientes no pueden pasar por GitHub).
- Nada de pruebas agresivas contra producción (sin límite de tasa, sin
  volumen alto, sin tocar datos que no sean los explícitamente
  autorizados). No destapar pestañas ocultas a mano, no tocar datos de
  otros clientes ni los datos de prueba de Calidad salvo que se pida.
- Verificación visual en producción o en local: **Playwright directo desde
  Node** (`server/node_modules/playwright`, o instalado ad hoc), NO la
  extensión de Claude in Chrome — mismo criterio que ya usaban los
  scripts de `.github/scripts/verificar-*` antes de que existiera esta
  regla escrita.
- Los cambios de `dashboards_config` en producción van por migración
  idempotente (`runOnceMigration`, `server/db.js`) — nunca un script que
  escriba una sola vez a mano. Así un ORLANT ya sembrado en producción
  recibe el cambio solo con el deploy (el proceso se reinicia y las
  migraciones corren solas), sin intervención manual.
- **Monitor automático de producción** (Fase 100, Tema C):
  `.github/workflows/monitor-produccion.yml` revisa produccion SOLO
  DESDE AFUERA (HTTP público) cada 15 minutos (`schedule`) + botón
  manual (`workflow_dispatch`): `GET /api/health` (200, `ok:true`, con 2
  reintentos y 30s de espera antes de dar la plataforma por caída),
  tiempo de respuesta, días que le quedan al certificado TLS (falla si
  quedan menos de 14) y que `http://` redirija a `https://`. Solo
  imprime estado/tiempo/certificado/versión — nunca un cuerpo de
  respuesta crudo (el repo es público). Si algo falla, el job termina en
  rojo (dispara el correo estándar de GitHub de "workflow failed" a
  quien tenga notificaciones activas) y abre — o comenta, si ya hay uno
  abierto — el issue "Producción caída o con problemas" con la etiqueta
  `produccion`; cuando se recupera, comenta ese issue y lo cierra solo.
  No toca AWS, secretos ni `deploy.yml`. Dos cosas a tener en cuenta:
  GitHub puede retrasar unos minutos una corrida programada (`schedule`)
  cuando hay mucha carga en sus runners — no es un fallo del workflow; y
  en un repo **público**, GitHub **desactiva automáticamente los
  workflows programados tras 60 días sin actividad** en el repo (commits,
  PRs, etc.) — se reactiva solo abriendo la pestaña Actions → el
  workflow → botón "Enable workflow" (o con cualquier commit nuevo al
  repo, que cuenta como actividad).

## Datos reales de clientes

- Los datos reales de clientes (hoy: la carpeta
  `C:\Users\filid\Documents\trabajo inconexion\bases edwin\`, o
  cualquier `.xlsx`/captura con datos reales) **nunca van al repo, a
  GitHub, a logs de CI, ni a capturas commiteadas**. Se referencian por
  ruta absoluta fuera del repo en scripts y documentación, nunca se copia
  su contenido.
- Verificar con datos reales localmente (para confirmar un fix contra el
  archivo real antes de tocar producción) está bien — pero solo imprimir
  estructura/conteos/agregados, nunca valores individuales sensibles
  (nombres de pacientes, etc.).
- Nunca mostrar valores de secretos, contraseñas, cookies, tokens ni
  `storageState` de sesión — ni en el chat, ni en archivos, ni en
  capturas. Si un script necesita una credencial de prueba local, la lee
  de un archivo ya gitignored (ej. `server/data/seed-demo-credenciales.txt`),
  nunca la pide por variable de entorno en texto plano en un comando que
  quede en el historial.

## Alcance del proyecto

- Foco actual: **solo ORLANT** tiene datos reales en producción. Clínica
  Aurora y Hospital La María siguen en cero — no inventar datos ni
  adelantarse a pedidos que no han llegado.
- El repositorio es público por decisión del jefe (29/09/2026); no
  reportarlo como pendiente.

## Versión y CHANGELOG

- La versión de la app vive en un solo lugar: `server/package.json`
  (`version`). Se expone en `/api/health` (campo `version`, junto a
  `buildId`, sin quitarlo) y discretamente en la interfaz (menú de
  usuario de cada página, clase `.navbar-app-version`).
- Cualquier fase que cambie la app (código, no solo `PROGRESS.md`/`docs/`)
  sube esa versión y agrega su entrada a `CHANGELOG.md` (español simple,
  para Edwin y Jairo — no técnico) en el MISMO PR de la fase:
  - parche (`1.0.x`) para arreglos;
  - menor (`1.x.0`) para funciones nuevas o actualizaciones visuales.
- `CHANGELOG.md` es aditivo igual que `PROGRESS.md`: se agregan entradas
  nuevas, nunca se reescribe una entrada de una versión ya publicada.

## Bitácora

- `PROGRESS.md` es aditivo: se agregan entradas al cerrar cada fase, no
  se reescribe el historial.
- Antes de reportar algo como "listo", verificarlo explícitamente (tests
  pasando, CI verde, deploy confirmado, o la verificación real que
  corresponda) — nunca asumir.
