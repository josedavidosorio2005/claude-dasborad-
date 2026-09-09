# InConexion Platform

App completa (frontend + backend real) para gestión de usuarios, roles, permisos
y dashboards. Reemplaza la versión anterior que solo guardaba datos en el
navegador (`localStorage`) por un backend con base de datos, login seguro y
API — lista para desplegarse en un servidor real.

## Qué cambió respecto a la versión anterior

| Antes | Ahora |
|---|---|
| Datos guardados en `localStorage` (solo en tu navegador) | Datos guardados en una base de datos SQLite en el servidor |
| Contraseñas en texto plano dentro del HTML | Contraseñas con hash `bcrypt`, nunca en texto plano |
| Sin login real (cualquiera podía editar el HTML) | Login con JWT (token de sesión) y permisos verificados en el servidor |
| No se podía compartir entre usuarios/dispositivos | Cualquier usuario, desde cualquier dispositivo, ve los mismos datos |
| No corría "como app" en un servidor | Es una app Node.js lista para desplegar |

**No llama a Claude ni a ninguna IA en ningún punto** — es una app web
tradicional (Node.js + Express + SQLite) con su propio login.

## Estructura del proyecto

```
inconexion-app/
├── server/                  → Backend (Node.js + Express)
│   ├── server.js             createApp() + arranque, endurecimiento, shutdown
│   ├── config.js             Validación fail-fast de variables de entorno (zod)
│   ├── db.js                 Conexión y esquema de la base de datos (SQLite)
│   ├── auth.js               Emisión/verificación de JWT y checks de permisos
│   ├── validation.js         Esquemas zod de entrada por endpoint
│   ├── hash-password.js      Utilidad para generar hashes de contraseña
│   ├── scripts/backup.js     Copia de seguridad del archivo SQLite
│   ├── tests/                Pruebas (node:test + supertest)
│   ├── Dockerfile            Imagen de producción (multi-stage, usuario no root)
│   ├── .env.example          Plantilla de configuración (local, sin Docker)
│   └── package.json
├── public/
│   └── index.html            Frontend (conectado a la API)
├── deploy/
│   └── Caddyfile             Ejemplo de reverse proxy con HTTPS automático
├── .github/workflows/ci.yml  Integración continua (instala + pruebas)
├── docker-compose.yml        Servicio app + volumen persistente + Caddy opcional
├── app.env.example           Plantilla de configuración (Docker/producción)
├── DEPLOY_REPORT.md          Resumen de cambios y guía de despliegue desde cero
└── README.md                 Este archivo
```

## 1. Instalación local (para probar en tu computador)

Requisitos: tener [Node.js](https://nodejs.org) instalado (v18 o superior).

```bash
cd server
npm install
cp .env.example .env
```

Edita `server/.env` y completa:

1. **JWT_SECRET**: genera uno con
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **MASTER_ADMIN_PASSWORD_HASH**: elige una contraseña para el admin maestro
   y genera su hash con
   ```bash
   node hash-password.js "tu-contrasena-segura"
   ```
   Pega el resultado (empieza con `$2a$...`) en `MASTER_ADMIN_PASSWORD_HASH`.

Luego arranca el servidor:

```bash
npm start
```

Abre `http://localhost:3000` en el navegador. Ya no es un archivo HTML suelto:
es una app real corriendo en un servidor.

### Usuarios de ejemplo (creados automáticamente la primera vez)

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | (la que definiste en MASTER_ADMIN_PASSWORD_HASH) | Administrador maestro |
| crodriguez | calidad123 | Calidad |
| mlopez | inv123 | Inventario |
| jherrera | ger123 | Gerencia |
| agomez | cli123 | Dashboard Clientes |
| lrios | aux123 | Auxiliar Admin |
| psuarez | admin456 | Admin |

**Cambia estas contraseñas de ejemplo** (desde el panel de administración,
opción "cambiar contraseña") antes de usar la app con datos reales.

> **¿Vas directo a producción?** Salta a
> [3. Desplegar con Docker](#3-desplegar-con-docker-recomendado) y luego
> [`DEPLOY_REPORT.md`](DEPLOY_REPORT.md), que tiene el paso a paso completo
> desde cero.

## 2. Cómo funciona la seguridad

- **Configuración validada al arrancar (fail-fast)**: `server/config.js` revisa
  al inicio que estén todas las variables críticas y con formato válido
  (`JWT_SECRET` de 32+ caracteres, `MASTER_ADMIN_PASSWORD_HASH` con formato
  bcrypt, `PORT` numérico, y en producción `CORS_ORIGIN` obligatorio con un
  dominio explícito). Si algo falta o está mal, el proceso **no arranca**:
  imprime qué falta y termina.
- **Contraseñas**: se guardan con `bcrypt` (hash de un solo sentido). Ni el
  desarrollador ni nadie con acceso a la base de datos puede ver la
  contraseña original. Política mínima: **8 caracteres** al crear o cambiar.
- **Sesión**: al iniciar sesión el servidor entrega un token (JWT) que el
  navegador guarda en memoria (no en `localStorage`). Cada petición lo incluye.
- **Permisos**: cada acción sensible (crear/editar/eliminar usuario, cambiar
  contraseña, suspender, gestionar permisos) se vuelve a verificar **en el
  servidor**, con los datos reales de la base de datos. Manipular el navegador
  no sirve. Un usuario suspendido a mitad de sesión también deja de poder actuar.
- **Validación de entrada**: cada endpoint valida tipos, longitudes y formato
  con `zod` (usuario sin espacios ni caracteres raros, rol dentro de la lista
  válida, permisos booleanos, etc.). Lo que no cumple se rechaza con `400`.
- **Anti fuerza-bruta y anti abuso**: el login está limitado (20 intentos / 15
  min por IP) y además hay un límite global sobre toda la API (300 req / 15 min
  por IP). Ambos son configurables por variables de entorno.
- **Cabeceras de seguridad**: `helmet` con una **Content-Security-Policy
  explícita** (no la de por defecto), afinada para una app que sirve su propio
  HTML/JS y carga `xlsx` desde `cdnjs`. Chart.js va embebido en el HTML.
- **Manejo de errores**: middleware centralizado. El cliente recibe un `500`
  genérico; el detalle real (stack) se registra solo en el servidor.
- **Logging de accesos**: `morgan` (`combined` en producción). No registra
  contraseñas ni el header `Authorization`.
- **Apagado ordenado**: ante `SIGTERM`/`SIGINT` cierra el servidor HTTP y la
  conexión SQLite antes de salir (importante en Docker).

## 3. Desplegar con Docker (recomendado)

Necesitas Docker con **Compose ≥ v2.30** (`docker compose version`). En un VPS
(DigitalOcean, Hetzner, Contabo…) con tu dominio apuntando a la máquina.

```bash
# 1. Clona el repo en el servidor
git clone <tu-repo> inconexion-app && cd inconexion-app

# 2. Crea el app.env a partir de la plantilla
cp app.env.example app.env

# 3. Genera tus secretos
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"      # -> JWT_SECRET
docker compose run --rm --no-deps app node hash-password.js "TU-CONTRASENA-ADMIN"   # -> MASTER_ADMIN_PASSWORD_HASH

# 4. Edita app.env: pega JWT_SECRET y MASTER_ADMIN_PASSWORD_HASH (con sus "$",
#    sin comillas), pon CORS_ORIGIN=https://tudominio.com y TRUST_PROXY=1

# 5. Levanta la app (con reverse proxy + HTTPS automático)
#    Antes edita deploy/Caddyfile con tu dominio y tu email.
docker compose --profile proxy up -d --build

# 6. Comprueba
curl -s https://tudominio.com/api/health   # -> {"ok":true}
```

> Los secretos van en **`app.env`** (no `.env`): Docker Compose lee `.env`
> automáticamente para interpolar el YAML y se quejaría del `$` del hash bcrypt.
> `docker-compose.yml` usa `env_file` con `format: raw` para pasar `app.env`
> literal.

- La base de datos SQLite vive en el **volumen** `inconexion-data`
  (`/app/server/data` dentro del contenedor) y **sobrevive** a
  `docker compose restart`, `down`/`up` y actualizaciones de imagen
  (verificado). Solo `docker compose down -v` la borra.
- Sin reverse proxy en esa máquina (p. ej. detrás de un balanceador que ya hace
  TLS): omite `--profile proxy` y ajusta `ports` en `docker-compose.yml`.
- Para PaaS (Render, Railway): también sirve — usa `server/` como raíz,
  `npm ci` + `npm start`, configura las mismas variables de entorno en el panel
  y añade un disco persistente montado en `server/data`. Detalles en
  [`DEPLOY_REPORT.md`](DEPLOY_REPORT.md).

## 4. Poner detrás de HTTPS

El ejemplo incluido usa **Caddy**, que obtiene y renueva el certificado TLS
solo (Let's Encrypt) y redirige HTTP→HTTPS sin configuración extra.

1. Edita [`deploy/Caddyfile`](deploy/Caddyfile): reemplaza `tudominio.com` y
   `tu-email@ejemplo.com`.
2. Asegúrate de que el DNS (registro A / AAAA) de tu dominio apunta a la IP
   pública del servidor y que los puertos **80 y 443** están abiertos.
3. En `app.env`: `CORS_ORIGIN=https://tudominio.com` y `TRUST_PROXY=1`.
4. `docker compose --profile proxy up -d`.

Caddy queda como servicio `caddy` en `docker-compose.yml` y hace
`reverse_proxy` al servicio `app`. Si prefieres Nginx, el patrón es el mismo
(`proxy_pass http://app:3000`, bloque `listen 443 ssl`, redirección 80→443) pero
gestionando los certificados con `certbot` aparte.

## 5. Backups de la base de datos

`server/scripts/backup.js` hace una copia consistente del archivo SQLite (usa la
API de backup en caliente de `better-sqlite3`, no hace falta parar la app):

```bash
# copia puntual -> server/data/backups/inconexion-<fecha>.db
docker compose exec app node scripts/backup.js

# con retención (conserva las 14 más recientes)
docker compose exec app node scripts/backup.js --keep 14
```

Para automatizarlo, añade un cron en el **host** (no dentro del contenedor):

```cron
0 3 * * * cd /ruta/inconexion-app && docker compose exec -T app node scripts/backup.js --keep 14 >> /var/log/inconexion-backup.log 2>&1
```

Copia además los backups a otra máquina / almacenamiento (S3, otro disco): un
backup en el mismo servidor no protege ante pérdida del servidor.

## 6. SQLite vs Postgres — cuándo migrar

SQLite en un solo archivo es **adecuado** para esta app con tráfico bajo/medio:
un solo proceso, decenas de usuarios del panel de administración, lecturas
frecuentes y escrituras esporádicas (altas/bajas de usuarios, historial). Es más
simple de operar y respaldar, y no hay servidor de BD que mantener.

Conviene plantearse **Postgres** cuando aparezca alguna de estas señales:

- Necesitas correr **varias instancias** de la app (balanceo horizontal,
  alta disponibilidad, despliegues sin downtime): SQLite no se comparte entre
  nodos.
- Escrituras concurrentes sostenidas (aprox. **>50–100 por segundo**) o errores
  `SQLITE_BUSY` frecuentes en los logs.
- Varios servicios distintos necesitan leer/escribir la misma base de datos.
- Requisitos de réplica, point-in-time recovery o backups gestionados por un
  proveedor.

Hoy **no se migra**; este es el criterio para decidirlo más adelante.

## 7. Pruebas automatizadas

```bash
cd server && npm test          # node:test + supertest, sin infra extra
```

Cubren: login correcto/incorrecto (admin maestro y usuario normal), usuario
suspendido, acceso sin permiso (`403`) y con permiso a las acciones de usuarios,
que las contraseñas/hashes **nunca** aparecen en las respuestas, que el rate
limit de login bloquea (`429`), y la validación de entrada (`400`). Se ejecutan
también en CI (`.github/workflows/ci.yml`) en cada push y pull request.

## 8. Qué quedó pendiente (para que lo sepas de antemano)

- Los dashboards de clientes (Aurora, Orlant, Hospital La María, etc.) siguen
  usando datos de ejemplo generados en el navegador — no vienen de la base de
  datos. La parte central de usuarios/permisos/historial sí está completamente
  migrada, endurecida y con pruebas.
- Un dashboard de cliente todavía muestra "en desarrollo" al abrirlo (venía así).
- No hay recuperación de contraseña por correo.
- La CSP permite `'unsafe-inline'` en scripts porque `public/index.html` usa
  ~105 manejadores `onclick` inline. Eliminar esa concesión requiere refactorizar
  el frontend (fuera del alcance de este trabajo).

## 9. Comandos útiles

```bash
# generar un JWT_SECRET nuevo (32+ caracteres)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# generar el hash bcrypt de una contraseña (admin maestro)
node server/hash-password.js "mi-contrasena"

# desarrollo local (sin Docker)
cd server && npm install && cp .env.example .env   # completa .env
npm start

# pruebas
cd server && npm test

# backup manual
cd server && npm run backup            # o: node scripts/backup.js --keep 14
```
