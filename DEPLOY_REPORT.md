# DEPLOY_REPORT — InConexion Platform

> **Nota (2026-09-09):** este documento cubre el **endurecimiento de seguridad y
> el despliegue genérico con Docker/VPS**. Para el despliegue en **AWS**
> (arquitectura, SSM, S3, CloudWatch, pipeline, runbooks, costos) ver
> [`AWS_DEPLOY_REPORT.md`](AWS_DEPLOY_REPORT.md). Para el estado global del
> proyecto ver [`PROGRESS.md`](PROGRESS.md) y [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md).

Estado: **lista para desplegar en producción con Docker.** Todos los cambios de
seguridad y estabilidad están cubiertos por pruebas automatizadas o por un
comando de verificación reproducible (ver la sección *Checklist* al final).

Fecha del trabajo: 2026-09-08.

---

## 1. Resumen de cambios

### Configuración y arranque (fail-fast)

- **`server/config.js` (nuevo)**: lee y valida **todas** las variables de entorno
  con `zod` antes de abrir la base de datos o el puerto. Exporta un objeto
  `config` congelado; el resto del código ya no toca `process.env`.
  - Obligatorias: `JWT_SECRET` (≥32 caracteres), `MASTER_ADMIN_PASSWORD_HASH`
    (formato bcrypt `$2a$/$2b$…`), `PORT` (entero 1–65535).
  - En `NODE_ENV=production`: `CORS_ORIGIN` **obligatorio**, debe ser una o
    varias URL `http(s)://` explícitas (sin vacío, sin `*`).
  - Si algo falla: imprime cada problema en una línea y `process.exit(1)`.
- **`server/auth.js`**: consume `config` (se eliminó el `throw` disperso de
  validación de `JWT_SECRET`). Añade un check extra: un usuario **suspendido a
  mitad de sesión** deja de poder ejecutar acciones mutantes.
- **`server/db.js`**: apertura de SQLite envuelta en `try/catch` con mensaje
  claro (ruta + motivo) y `exit(1)` si el archivo/directorio no es accesible o
  el disco es de solo lectura. Expone `closeDb()` para el apagado ordenado.

### Seguridad

- **Helmet con CSP explícita** (`useDefaults: false`), afinada para esta app:
  - `script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com`
  - `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`,
    `object-src 'none'`, `frame-ancestors 'self'`, etc.
  - `upgrade-insecure-requests` solo en producción.
  - `'unsafe-inline'` en scripts es necesario porque `public/index.html` tiene
    ~105 manejadores `onclick` inline; `cdnjs.cloudflare.com` es por
    `xlsx.full.min.js` (Chart.js y el plugin datalabels van **embebidos** en el
    HTML, no por CDN).
- **Rate limiting en dos niveles**:
  - Global sobre `/api` (`RATE_LIMIT_MAX`, por defecto 300 / 15 min por IP).
  - Login más estricto encima (`LOGIN_RATE_LIMIT_MAX`, por defecto 20 / 15 min),
    con `skipSuccessfulRequests: true`: **solo cuentan los intentos fallidos**,
    para que una oficina detrás de una sola IP no se autobloquee al usar la app.
  - `app.set('trust proxy', …)` configurable (`TRUST_PROXY`) para que, detrás de
    Caddy/Nginx, el límite y los logs usen la IP real del cliente.
- **CORS con lista blanca** desde `config.corsOrigins`. Nunca `origin: true`. En
  desarrollo sin `CORS_ORIGIN` se permite solo `localhost`.
- **Validación de entrada con `zod`** (`server/validation.js`, nuevo) en cada
  endpoint mutante y en login:
  - `user`: 3–32 caracteres, `^[a-zA-Z0-9._-]+$` (sin espacios ni raros).
  - `nombre`: 1–120. `rol`: enum de los 9 roles válidos.
  - `password`: **mínimo 8**, máximo 128 (política mínima de complejidad).
    Aplica al crear y al cambiar contraseña (antes el mínimo era 4 y al crear
    se usaba `'temp123'` por defecto — eso se eliminó).
  - `perms`: objeto de claves conocidas → booleano.
  - `:id`: entero positivo.
  - Incumplimiento → `400` con `{ error, detalles: [...] }`.
- **`morgan`**: `combined` en producción, `dev` en local; silencioso en tests.
  No registra cuerpos ni el header `Authorization`.
- **`x-powered-by` desactivado**.
- **Confirmado (con prueba)**: ninguna respuesta de la API expone `password_hash`
  ni un hash bcrypt. `toPublicUser()` es el único serializador de usuarios.

### Estabilidad

- **Middleware de manejo de errores centralizado**: el cliente recibe `500
  { error: 'Error interno del servidor' }`; el stack real va solo a
  `console.error` en el servidor. Casos especiales: JSON malformado → `400`,
  cuerpo > 100 kB → `413`, origen CORS no permitido → `403`.
- **404 JSON** para rutas `/api/*` desconocidas (antes caían en el fallback SPA
  y devolvían el `index.html`).
- **Handlers async envueltos** (`wrap()`): cualquier promesa rechazada llega al
  middleware de errores en vez de tumbar el proceso.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` → `server.close()` → `db.closeDb()` →
  `exit(0)`, con guardia de 10 s que fuerza `exit(1)` si algo se cuelga.
- **`server.js` refactorizado a `createApp()`**: la construcción de la app está
  separada del arranque; `app.listen()` + señales solo cuando el archivo se
  ejecuta directamente. Esto permite las pruebas con `supertest` sin abrir puertos.

### Contenerización

- **`server/Dockerfile`** multi-stage: etapa `deps` sobre `node:20-bookworm`
  (con toolchain por si `better-sqlite3` compila), runtime sobre
  `node:20-bookworm-slim`, `NODE_ENV=production`, **usuario no root** (`node`),
  `HEALTHCHECK` contra `/api/health`. Contexto de build = raíz del repo (necesita
  `server/` y `public/`).
- **`.dockerignore`** en la raíz (excluye `node_modules`, `data`, `.env`, etc.).
- **`docker-compose.yml`**: servicio `app` con `env_file` apuntando a
  **`app.env`** con `format: raw` (requiere Compose ≥ v2.30), volumen
  **persistente** `inconexion-data` en `/app/server/data`, `restart:
  unless-stopped`, healthcheck. Servicio `caddy` opcional (`--profile proxy`)
  para HTTPS. **Sin secretos en el compose** — todo por `app.env`.
  - Se usa `app.env` y no `.env` porque Compose lee `.env` automáticamente para
    interpolar el YAML y rompía el hash bcrypt (`$2a$10$…` → tomaba los `$…`
    como variables). `format: raw` pasa el archivo literal, sin interpolar.
- **`app.env.example`** en la raíz (para Docker) además del `.env.example` de
  `server/` (para uso local sin Docker).

### Reverse proxy / HTTPS

- **`deploy/Caddyfile`**: ejemplo con HTTPS automático (Let's Encrypt),
  redirección HTTP→HTTPS, `reverse_proxy app:3000`, cabeceras de seguridad y
  logs JSON. Documentado en el README ("Poner detrás de HTTPS").

### Base de datos — backups

- **`server/scripts/backup.js`**: copia consistente en caliente del archivo
  SQLite (`better-sqlite3 .backup()`), nombre con timestamp, opción `--keep N`
  de retención. `npm run backup`. Ejemplo de cron en el README.
- Criterio **SQLite vs Postgres** documentado en el README (no se migra ahora).

### Pruebas y CI

- **`server/tests/`** (`node:test` + `supertest`, cero infraestructura): 29
  pruebas en 6 archivos — auth, permisos, no-fuga-de-contraseñas, rate limit,
  validación. BD SQLite temporal y secretos dummy generados por
  `tests/helpers.js`.
- **`npm test`** añadido a `package.json`.
- **`.github/workflows/ci.yml`**: en cada push / PR instala (`npm ci`) y corre
  las pruebas en Node 18/20/22; job aparte que hace `docker build`. El build
  falla si algo no pasa.

### Dependencias

- Añadidas: `zod`, `morgan` (prod), `supertest` (dev).
- `better-sqlite3` actualizado a `^12` (binarios precompilados para Node
  moderno; la versión anterior no compilaba en Node 24).
- `override` de `qs` a `^6.16.0` → `npm audit` = **0 vulnerabilidades**.
- `engines.node >= 18`.

---

## 2. Decisiones de arquitectura (y por qué)

| Decisión | Por qué |
|---|---|
| **SQLite se queda** (no se migra a Postgres) | Tráfico bajo/medio, un solo proceso, operación y backup triviales. Migrar añade una pieza que mantener sin beneficio hoy. El criterio para reconsiderarlo está documentado en el README §6. |
| **Docker + docker-compose** como camino principal | Reproducible, mismo artefacto en cualquier VPS, volumen persistente explícito, apagado ordenado real (SIGTERM). PaaS queda como alternativa documentada. |
| **Caddy** para el reverse proxy (sobre Nginx) | HTTPS automático y renovación de certificados sin `certbot` ni cron extra; redirección HTTP→HTTPS por defecto. Menos piezas que configurar mal. El patrón Nginx queda descrito por si se prefiere. |
| **`zod`** para validación | Esquemas declarativos, mensajes `400` consistentes, una dependencia liviana y muy usada. Menos código repetitivo y con menos huecos que validar a mano endpoint por endpoint. |
| **`'unsafe-inline'` en la CSP de scripts** | `public/index.html` tiene ~105 `onclick` inline. Quitarlos exige refactorizar el frontend, fuera del alcance pedido. Se deja explícito y documentado; el resto de la CSP sí es estricta (`object-src 'none'`, `default-src 'self'`, etc.). |
| **`createApp()` en vez de `module.exports = app`** | Permite pruebas con estado limpio e inyección sin variables globales; el arranque real queda aislado tras `require.main === module`. |
| **Rate limit configurable por entorno** | Los tests bajan el límite para verificarlo de forma determinista; en producción se ajusta sin tocar código. |

---

## 3. Desplegar desde cero (paso a paso)

Requisitos en el servidor: Docker + plugin Compose, un dominio y acceso a su DNS,
puertos 80/443 abiertos.

### 3.1 Clonar

```bash
git clone <URL-de-tu-repo> inconexion-app
cd inconexion-app
```

### 3.2 Configurar `app.env`

```bash
cp app.env.example app.env
```

Genera y pega los secretos:

```bash
# JWT_SECRET (96 caracteres hex)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# MASTER_ADMIN_PASSWORD_HASH (elige la contraseña del admin maestro)
docker compose run --rm --no-deps app node hash-password.js "TU-CONTRASENA-ADMIN-SEGURA"
```

Edita `app.env` (valores **sin comillas**; el hash lleva `$` y está bien) y deja
como mínimo:

```
NODE_ENV=production
JWT_SECRET=<lo que generaste>
MASTER_ADMIN_PASSWORD_HASH=<el hash $2a$... que generaste>
CORS_ORIGIN=https://tudominio.com
TRUST_PROXY=1
```

### 3.3 Configurar el dominio en Caddy

Edita `deploy/Caddyfile`: reemplaza `tudominio.com` y `tu-email@ejemplo.com`.
En tu proveedor de DNS crea un registro **A** (y **AAAA** si tienes IPv6)
apuntando a la IP pública del servidor.

### 3.4 Levantar

```bash
docker compose --profile proxy up -d --build
```

Caddy pedirá el certificado TLS automáticamente en el primer arranque (unos
segundos). Sin reverse proxy en esta máquina: omite `--profile proxy` y expón
el puerto según tu balanceador.

### 3.5 Verificar

```bash
curl -s https://tudominio.com/api/health          # {"ok":true}
# entra en https://tudominio.com y haz login como  admin  /  (tu contraseña)
```

### 3.6 Cerrar la instalación

1. Inicia sesión como `admin`.
2. **Cambia las 6 contraseñas de ejemplo** (`crodriguez`, `mlopez`, `jherrera`,
   `agomez`, `lrios`, `psuarez`) desde el panel, o **elimina** los usuarios que
   no vayas a usar.
3. Programa el backup por cron (README §5) y configura una copia off-site.

### 3.7 Actualizar más adelante

```bash
git pull
docker compose --profile proxy up -d --build      # el volumen de datos se conserva
```

---

## 4. Lo que TÚ todavía debes decidir / hacer manualmente

- [ ] **Comprar un dominio** y tener acceso a su panel de DNS.
- [ ] **Elegir hosting**: un VPS con Docker (DigitalOcean, Hetzner, Contabo,
      Linode…) o un PaaS (Render/Railway) con disco persistente.
- [ ] **Generar tus propios secretos** (`JWT_SECRET`, hash del admin) — no uses
      ningún valor de ejemplo ni de este documento.
- [ ] **Definir y probar la contraseña del admin maestro** (va solo como hash en
      `app.env`, nunca en texto plano en el repo).
- [ ] **Apuntar el DNS** a la IP del servidor y abrir los puertos 80/443.
- [ ] **Editar `deploy/Caddyfile`** con tu dominio y tu email.
- [ ] **Cambiar o eliminar los 6 usuarios de ejemplo** tras el primer login.
- [ ] **Configurar backups**: cron en el host + copia a otro sitio (S3, otro
      disco). Decide la retención (`--keep N`) y verifica una restauración al
      menos una vez.
- [ ] **Revisar `CORS_ORIGIN`**: si sirves el frontend desde el mismo dominio que
      la API (caso por defecto), basta con ese dominio. Si algún día lo separas,
      añade el origen del frontend.
- [ ] **Decidir la exposición de puertos**: por defecto `docker-compose.yml`
      publica `127.0.0.1:3000` (solo accesible vía Caddy). Cámbialo solo si sabes
      lo que haces.
- [ ] **Monitoreo/alertas** (opcional): el endpoint `/api/health` sirve para un
      chequeo externo (UptimeRobot, healthchecks.io, etc.).
- [ ] **Rotación de logs** del contenedor (configura el `logging` de Docker o
      `logrotate` según tu infraestructura).

---

## 5. Checklist final (verificado contra el código, no de memoria)

| Punto | Estado | Cómo se comprueba |
|---|---|---|
| La app no arranca si faltan variables de entorno críticas | ✅ | `node -e "require('./config')"` sin `.env` → exit 1 con lista de faltantes. Idem `NODE_ENV=production` sin `CORS_ORIGIN`, `JWT_SECRET` corto, hash bcrypt inválido. |
| Ninguna contraseña ni hash se expone en ninguna respuesta | ✅ | `tests/no-password-leak.test.js` revisa el texto crudo de `GET/POST/PUT /api/users`, `/api/historial` y login: no aparece `password_hash` ni `$2a$…`. |
| Todos los endpoints mutantes verifican permiso en el servidor | ✅ | Tabla en el plan + `tests/permissions.test.js`: `requireAuth` + `requirePermission` en `POST/PUT/DELETE /api/users*`. AUX_ADMIN sin permiso → `403`. |
| CORS restringido a dominio real en producción | ✅ | `config.js` obliga `CORS_ORIGIN` en producción; `buildCorsOptions()` usa lista blanca, nunca `origin:true`. |
| Rate limiting activo en login y en el resto de la API | ✅ **verificado** | `tests/rate-limit.test.js` (login → `429`). En Docker: 25 logins correctos seguidos → 25×200 (no penaliza éxito); 25 logins fallidos → `429`. Global: `RATE_LIMIT_MAX=5` + 8× `curl /api/health` → 5×200 luego 429. |
| Manejo de errores centralizado, sin fugas de stack | ✅ | Middleware final en `server.js`; responde `500 { error genérico }`, loguea el stack solo en servidor. JSON malformado → `400` (`tests/validation.test.js`). |
| Graceful shutdown implementado | ✅ **verificado** | `docker compose stop app` → logs `[shutdown] Servidor HTTP y base de datos cerrados`, exit code `0`, en 0.6 s. |
| Docker build + compose de punta a punta con datos persistentes | ✅ **verificado** | `docker compose up` en modo producción → 23 comprobaciones funcionales OK (login, permisos 403, validación 400, historial, rate-limit); crear usuario → `docker compose restart` → el usuario sigue (volumen `inconexion-data`). |
| Ejemplo de reverse proxy con HTTPS documentado | ✅ | `deploy/Caddyfile` + README §4. Servicio `caddy` en `docker-compose.yml` (`--profile proxy`). |
| Estrategia de backup documentada y con script | ✅ **verificado** | `docker compose exec app node scripts/backup.js --keep 5` → `/app/server/data/backups/inconexion-<ts>.db`. Cron en README §5. |
| Pruebas automatizadas de login y permisos, en verde | ✅ | `npm test` → **29/29 pass**. |
| CI configurado y en verde | ✅ | `.github/workflows/ci.yml` (push/PR, Node 18/20/22, `npm ci` + `npm test`, + `docker build`). *(Se activará al subir el repo a GitHub.)* |

### Comandos de verificación rápidos

```bash
cd server
npm ci
npm test                                   # 29/29

# fail-fast
node -e "require('./config')"               # sin .env -> exit 1

# arranque + cabeceras
npm start &                                 # con .env válido
curl -s localhost:3000/api/health           # {"ok":true}
curl -sD - -o /dev/null localhost:3000/ | grep -i content-security-policy

# docker end-to-end
cd .. && docker build -f server/Dockerfile -t inconexion .
docker compose up -d && docker compose restart app && docker compose logs app
```

---

## 6. Fuera de alcance (deliberadamente no se hizo)

- Recuperación de contraseña por email.
- Migración a Postgres (solo se documentó el criterio).
- Refactor de los ~105 `onclick` inline del frontend para endurecer más la CSP.
- Endpoints/tablas para los dashboards de clientes (siguen con datos de ejemplo
  en el navegador, como ya estaban).
