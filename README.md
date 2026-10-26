# SInCo — Sistema de Información InConexión

Plataforma web de InConexion® para ver, en un solo lugar, los indicadores
de los clientes de contact center: tráfico de llamadas y WhatsApp
(Wolkvox), tipificación, agendamiento, inasistencia, calidad y más. La usan
el equipo interno de InConexion (cargar datos, calificar monitoreos,
administrar usuarios) y los propios clientes (ver su tablero, solo
lectura).

**Producción:** <https://sinco.inconexion.com.co> (único dominio).
**Versión:** la de `server/package.json`, visible en `/api/health` y en el
menú de usuario. Qué cambia en cada versión: [`CHANGELOG.md`](CHANGELOG.md).

## Clientes y pestañas (hoy)

**ORLANT** y **MOBILIZE** tienen datos reales. **Clínica Aurora** y
**Hospital La María** ya existen (creados en las Fases 153 y 160), con sus
pestañas ocultas y visibles solo para el administrador hasta su primera
carga completa.

| Cliente | Pestañas |
|---|---|
| **ORLANT** (8) | Tráfico de Llamadas · Tráfico de WhatsApp · Llamadas y WhatsApp de salida · Agendamiento · Inasistencia · Efectividad de Citas · Tipificación · Calidad |
| **MOBILIZE** (5) | Flujo de Llamadas (6 sub-pestañas: Flujo de Llamadas, Nivel de Servicio, Abandono, ASA y ATA, AHT, One & Done) · Llamadas Únicas y de Salida · Tipificación · Encuesta · Calidad (con el Resumen de calidad por asesor) |

Qué base alimenta cada pestaña de ORLANT:
[`docs/inventario-bases-orlant.md`](docs/inventario-bases-orlant.md).
Cómo se usa cada pantalla: la **Guía de uso** dentro de la app (menú de
usuario) y su espejo [`docs/guia-uso-orlant.md`](docs/guia-uso-orlant.md).

## Roles

10 roles con permisos por módulo y por campaña: Administrador, Auxiliar
administrativo, Calidad, Supervisor, Asesor, Reportes, Dashboard Clientes
(la cuenta del cliente, solo su tablero), Inventario, Gerencia y Gestión
Humana. Un usuario solo ve las campañas que tiene asignadas; la matriz
completa se prueba en `server/tests/fase118-matriz-acceso.test.js`.

## Stack

- **Servidor:** Node.js 22, Express 5, SQLite (`better-sqlite3`), Zod
  (validación de toda entrada), JWT + bcrypt, Helmet (CSP/HSTS).
- **Navegador:** HTML/CSS/JS sin framework, Chart.js (vendorizado) y
  SheetJS para leer y exportar Excel. Los archivos de Excel **se leen en el
  navegador**; al servidor solo llegan filas ya validadas (nunca teléfonos
  en Llamadas Únicas ni en Salida).
- **Diseño:** tokens de color, tipografía Quicksand y reglas WCAG 2.1 AA en
  [`docs/sistema-de-diseno.md`](docs/sistema-de-diseno.md); marca en
  [`docs/marca.md`](docs/marca.md).

## Correr en local

Requisito: Node.js 22.

```bash
cd server
npm install
cp .env.example .env
```

En `server/.env`:

1. `JWT_SECRET` (48 bytes al azar):
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. `MASTER_ADMIN_PASSWORD_HASH`: `node hash-password.js "tu-contrasena"` y
   pega el resultado.

```bash
npm start                 # http://localhost:3000
npm run seed:demo         # opcional: datos 100 % sintéticos para probar
```

Las contraseñas de los usuarios demo quedan en
`server/data/seed-demo-credenciales.txt` (fuera de git). Nunca se usan
datos reales de clientes en local.

## Pruebas

```bash
cd server && npm test     # node:test + supertest, sin infraestructura extra
```

Cubren autenticación, permisos (los 10 roles, campaña propia y ajena),
validación, cálculos de cada pestaña, migraciones idempotentes, accesibilidad
y textos. En CI además corre el job **pantallas** (Playwright contra la
demo: sin errores de consola, sin gráficas vacías, pestañas sin saltos).

## Despliegue

Todo cambio va por rama → PR → **CI verde** (Node 22 + docker-build +
pantallas) → merge → **despliegue automático**: `deploy.yml` construye la
imagen, la sube a **ECR** y la levanta en la instancia **Lightsail**
(Docker + Caddy con HTTPS), y espera `/api/health`. Nunca se commitea
directo a `main`. Estado de la infraestructura y respaldos:
[`docs/infraestructura.md`](docs/infraestructura.md).

Monitoreo: `monitor-produccion.yml` (desde afuera, cada 15 min) y
`salud-servidor.yml` (disco, respaldos y certificado, diario).

## Seguridad (resumen)

- Contraseñas con bcrypt; JWT con expiración; límite de intentos de login
  (por IP + usuario y, desde la Fase 178, por usuario solo) y de peticiones
  a la API.
- Toda entrada validada con Zod; SQL siempre con parámetros.
- Todo texto que viene de datos se escapa al mostrarlo (`esc()`), y las
  exportaciones a Excel neutralizan fórmulas (`xlsxFilasSeguras`).
- Cabeceras: CSP, HSTS, `frame-ancestors`, Referrer-Policy; CORS solo con
  el dominio de producción.
- Secretos en AWS SSM, nunca en el repo. Respaldos diarios a S3.
- Auditorías: `docs/auditoria-seguridad-fase*.md` y la entrada de la Fase
  146 en `docs/historico/progress-fases.md`.

## Documentos

| Documento | Para qué |
|---|---|
| [`PROGRESS.md`](PROGRESS.md) | Resumen corto del estado actual |
| [`docs/pendientes.md`](docs/pendientes.md) | Todo lo que falta, en un solo lugar |
| [`CHANGELOG.md`](CHANGELOG.md) | Qué cambió en cada versión, en español simple |
| [`CHECKLIST_VERIFICACION_EDWIN.md`](CHECKLIST_VERIFICACION_EDWIN.md) | Lista para revisar cada entrega |
| [`docs/README.md`](docs/README.md) | Índice de toda la documentación |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está hecho el sistema |
| [`docs/procedimiento-carga-mensual.md`](docs/procedimiento-carga-mensual.md) | Cómo subir un mes nuevo de datos |
| [`docs/infraestructura.md`](docs/infraestructura.md) | AWS, despliegue y respaldos |
| [`docs/historico/progress-fases.md`](docs/historico/progress-fases.md) | Bitácora detallada de cada fase |
| [`CLAUDE.md`](CLAUDE.md) | Reglas fijas del repositorio |
