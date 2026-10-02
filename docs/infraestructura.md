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
