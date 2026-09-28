# Permisos de AWS pendientes (Fase 72, aún sin aplicar)

Este documento **no aplica ningún cambio** — es la guía para que el dueño de
la cuenta de AWS (no Claude Code: nunca se dio ni se debe dar acceso para
modificar políticas de IAM) haga el cambio a mano en la consola cuando
quiera. Ninguna herramienta de este repo escribe permisos de IAM.

Contexto completo en `docs/auditoria-seguridad-fase72.md` (§5) y
`docs/estado-pendientes-fase74.md`. Sin nombres de secretos ni valores —
solo nombres de recursos (usuario, rol, bucket, log groups), que no son
sensibles.

## 1. Qué falta exactamente

Dos permisos de **solo lectura**, ninguno de escritura — ninguno amplía lo
que esas identidades ya pueden hacer, solo les permite *listar/filtrar*
algo sobre lo que ya tienen acceso de lectura a nivel de objeto.

### 1.1 `s3:ListBucket` — prueba de restauración de respaldos

El usuario IAM `inconexion-instance` ya tiene `s3:GetObject` sobre
`db-backups/*` en el bucket `inconexion-backups-877538609452` (por eso el
respaldo SÍ sube bien) pero le falta `s3:ListBucket` sobre el bucket, así
que no puede listar cuál es el respaldo más reciente para descargarlo y
probar la restauración.

**Pasos en la consola de AWS**:
1. IAM → Users → `inconexion-instance` → pestaña "Permissions".
2. Edita (o agrega) la política inline/administrada que ya cubre el acceso
   a `inconexion-backups-877538609452` y agrégale el statement de abajo
   (o créala como una política nueva separada, lo que prefieras mantener).
3. Guarda.

**JSON mínimo** (statement a agregar; no reemplaza lo que ya existe):

```json
{
  "Sid": "PermitirListarBucketRespaldos",
  "Effect": "Allow",
  "Action": "s3:ListBucket",
  "Resource": "arn:aws:s3:::inconexion-backups-877538609452",
  "Condition": {
    "StringLike": { "s3:prefix": "db-backups/*" }
  }
}
```

La condición `s3:prefix` limita el listado al mismo prefijo donde ya puede
leer objetos (`db-backups/*`) — no le da visibilidad sobre nada nuevo del
bucket.

### 1.2 `logs:FilterLogEvents` — logs reales de producción

El rol OIDC `inconexion-github-deploy` (el que usa el workflow de deploy
vía GitHub Actions) no tiene `logs:FilterLogEvents` sobre los log groups de
producción, así que el workflow de verificación de logs no puede traer
eventos reales.

**Pasos en la consola de AWS**:
1. IAM → Roles → `inconexion-github-deploy` → pestaña "Permissions".
2. Edita la política que ya cubre CloudWatch Logs para este rol (o agrega
   una nueva) con el statement de abajo.
3. Guarda.

**JSON mínimo**:

```json
{
  "Sid": "PermitirFiltrarLogsProduccion",
  "Effect": "Allow",
  "Action": ["logs:FilterLogEvents", "logs:GetLogEvents"],
  "Resource": [
    "arn:aws:logs:*:*:log-group:/inconexion/prod/docker:*",
    "arn:aws:logs:*:*:log-group:/inconexion/prod/backup:*"
  ]
}
```

`logs:GetLogEvents` es opcional (da margen para traer un stream puntual
completo) — con solo `FilterLogEvents` el workflow ya funciona.

## 2. Qué disparar después, cuando el permiso ya esté aplicado

Las 2 herramientas ya existen en el repo, listas, esperando el permiso —
**no hay que recrear nada**:

- `.github/workflows/verificar-restore-backup-produccion.yml` — prueba de
  restauración real de un respaldo (solo lectura contra el respaldo más
  reciente, nunca escribe sobre producción).
- `.github/workflows/verificar-logs-produccion.yml` — trae errores reales
  de los log groups de producción (solo lectura).

Dispara cada uno a mano desde GitHub Actions ("Run workflow") después de
aplicar el permiso correspondiente. Si `gh` está disponible:

```
gh workflow run verificar-restore-backup-produccion.yml
gh workflow run verificar-logs-produccion.yml
```

## 3. Estado a 2026-09-28 (Fase 80)

Sigue exactamente igual que en la Fase 72/74: los 2 permisos arriba siguen
sin aplicarse (confirmado por la falta de estos permisos reportada
entonces; este documento no volvió a probar los workflows, solo deja la
guía). Cuando se apliquen y se disparen los workflows, actualizar
`PROGRESS.md` con el resultado real.
