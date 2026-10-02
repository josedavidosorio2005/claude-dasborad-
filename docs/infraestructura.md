# Infraestructura — estado vigente (Fase 112)

Extracto vigente de `AWS_DEPLOY_REPORT.md` §14 (que se archivó completo en
`docs/historico/AWS_DEPLOY_REPORT.md` — ahí está el runbook paso a paso,
los costos estimados y la comparación de arquitecturas). Este documento es
corto a propósito: solo lo que sigue siendo cierto hoy. Para el detalle de
cómo se llegó aquí, o para reconstruir todo desde cero, usar el histórico.

## Cuenta AWS y dominio

- **Cuenta AWS vigente: `877538609452`** (`us-east-1`). La cuenta original
  (`934685482338`) quedó solo con un bucket S3 de backups viejos y los
  usuarios/rol IAM — sin instancia activa (confirmado Fase 93,
  29/09/2026).
- **Dominio único de producción: `https://informa.inconexion.com.co`**
  (duckdns se retiró el 29/09/2026, Fase 93 — no volver a usarlo). Para
  agregar/quitar un dominio, el workflow `dominio-produccion.yml` — nunca
  a mano (ver `CLAUDE.md`).

## Recursos (cuenta `877538609452`)

| Recurso | Valor |
|---|---|
| Instancia Lightsail | `inconexion-prod`, `micro_3_0`, `us-east-1a` |
| Disco de datos | `inconexion-data`, 20 GB, montado por UUID en `/opt/inconexion/data` |
| ECR | `877538609452.dkr.ecr.us-east-1.amazonaws.com/inconexion` |
| S3 backups | `inconexion-backups-877538609452` (versionado activo) |
| SSM `/inconexion/prod/*` | `JWT_SECRET`, `CORS_ORIGIN`, `MASTER_ADMIN_USER`, `MASTER_ADMIN_PASSWORD_HASH` |
| IAM rol de deploy (OIDC) | `inconexion-github-deploy` |
| IAM usuario de instancia | `inconexion-instance` (access key, no rol — Lightsail no soporta instance profiles; rotar periódicamente) |

## Cómo se despliega

1. Push a `main` → workflow `CI` (tests Node 22 + `docker-build`) en verde.
2. `deploy.yml` se dispara solo si `CI` terminó OK en `main` (OIDC a AWS,
   sin claves de larga duración para el paso de build/push): build + push
   a ECR (`:sha` y `:latest`) → SSH a la instancia → `docker system prune
   -af` (Fase 111, evita quedarse sin disco al extraer la imagen nueva) →
   `docker compose pull && up -d` → espera a `/api/health` → `docker
   image prune -f`.
3. Monitor automático post-deploy: `.github/workflows/monitor-produccion.yml`
   revisa producción desde afuera cada 15 min + botón manual — `/api/health`,
   tiempo de respuesta, certificado TLS, redirección HTTP→HTTPS. Abre/
   comenta/cierra solo el issue "Producción caída o con problemas". No
   toca AWS ni secretos.
4. Salud del servidor (Fase 113, Tema C): `.github/workflows/salud-servidor.yml`
   revisa POR DENTRO del servidor una vez al día (6 a.m. Colombia) + botón
   manual, solo lectura, vía SSH (mismo mecanismo OIDC + puerto 22
   temporal que `audit-instance.yml`): disco (sistema y `/opt/inconexion/data`),
   memoria, imágenes Docker, tamaño de la base, fecha/tamaño del último
   respaldo local, estado de `inconexion-backup.timer`/`.service` (is-active
   **e is-enabled** desde la Fase 114 — is-active solo no bastaba: un timer
   puede estar activo y aun así nunca haberse habilitado para sobrevivir un
   reinicio) (incluida la subida a S3 según su log) y días de certificado
   TLS. Abre/comenta/cierra el issue "Salud del servidor con problemas"
   (etiqueta `servidor`) si un disco pasa 80 %, el último respaldo tiene más
   de 26 h, el servicio de respaldo no terminó en éxito, el timer no está
   `enabled`, o el certificado tiene menos de 14 días. Ver `CLAUDE.md` para
   el detalle completo.

## Respaldos: cómo se instalan, activan y verifican

Los respaldos (`scripts/backup.js`: copia local con `better-sqlite3`
`db.backup()` + subida a S3 si `BACKUP_S3_BUCKET` está definido) corren por
un timer systemd — `deploy/inconexion-backup.service`/`.timer` en el repo —
pero **instalar y habilitar esas 2 unidades en una instancia nueva es un
paso manual** (no lo hace `deploy.yml`, que solo despliega la app vía
Docker). Si se crea o reemplaza la instancia de Lightsail, hay que repetir
esto — es justo lo que no se repitió tras la migración de cuenta AWS que
dejó el timer sin habilitar (hallazgo de la Fase 113, resuelto en la
Fase 114, ver `docs/pendientes.md`/`docs/historico/progress-fases.md`).

`.github/workflows/respaldo-produccion.yml` (Fase 114) es la única forma
auditada de hacerlo — nunca a mano por SSH fuera de este pipeline. Mismo
mecanismo OIDC + puerto 22 temporal de siempre. 3 modos manuales
(`workflow_dispatch`, input `modo`):

- **`estado`** (solo lectura): si los 2 archivos de unidad existen en
  `/etc/systemd/system/`, `is-enabled`/`is-active` del timer, próxima
  corrida, resultado y fecha de la última corrida del servicio, fecha/tamaño
  del último respaldo local, y si la última subida a S3 dijo OK o error.
- **`respaldar-ahora`**: corre `inconexion-backup.service` una sola vez (lo
  mismo que haría el timer esa noche) y verifica el respaldo nuevo con
  `docker compose exec -T app node scripts/verificar-restore-backup.js
  --local <ruta>` — `integrity_check` + conteo de filas por tabla (solo
  números), **sin sacar el archivo del servidor**.
- **`activar-timer`**: copia el contenido actual de
  `deploy/inconexion-backup.{service,timer}` (del propio repo, vía
  `actions/checkout` — nunca texto hardcodeado en el workflow) a
  `/etc/systemd/system/`, `daemon-reload`, y
  `systemctl enable --now inconexion-backup.timer`. Idempotente: correrlo
  de nuevo con los mismos archivos no cambia nada.

Solo imprime estados/fechas/tamaños/conteos — nunca una fila real, el
nombre exacto de un archivo de respaldo, ni sube la base/el respaldo como
artifact de GitHub (el repo es público).

Secrets/variables de GitHub Actions: `AWS_DEPLOY_ROLE_ARN`,
`DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY` (secrets),
`AWS_REGION` (variable). Nunca se imprimen ni se piden por variable de
entorno en texto plano en un comando que quede en el historial.

## Qué NO está aquí

- El runbook completo para reconstruir todo desde cero (instancia, disco,
  SSM, ECR, S3, firewall, CloudWatch, alarma) — `docs/historico/AWS_DEPLOY_REPORT.md`
  §7.
- Recuperación ante desastre (instancia caída, restaurar desde S3,
  revertir un deploy malo) — mismo documento, §9.
- Costos estimados y la comparación SQLite-en-una-máquina vs RDS+varias
  instancias — mismo documento, §2 y §10.
