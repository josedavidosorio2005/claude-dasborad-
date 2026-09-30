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

Un permiso de **solo lectura**, ninguno de escritura — no amplía lo que
esta identidad ya puede hacer, solo le permite *listar y leer* el bucket de
respaldos sobre el que ya tiene acceso de escritura.

### 1.1 `s3:ListBucket` + `s3:GetObject` — prueba de restauración de respaldos

El usuario IAM `inconexion-instance` ya tiene `s3:PutObject` sobre
`db-backups/*` en el bucket `inconexion-backups-877538609452` (por eso el
respaldo SÍ sube bien), pero **no** tiene `s3:ListBucket` (para listar cuál
es el respaldo más reciente) ni `s3:GetObject` (para descargarlo y probar la
restauración) — el hallazgo original (Fase 72) solo mencionaba el primero;
al revisar de nuevo (Fase 97) se confirmó que el segundo también falta.

**Pasos en la consola de AWS**:
1. IAM → Users → `inconexion-instance` → pestaña "Permissions".
2. Agrega una política inline nueva (o edita la existente, lo que
   prefieras mantener) con el JSON de abajo.
3. Guarda.

**JSON mínimo** (2 statements — el prefijo en `s3:prefix` solo aplica al
statement de `ListBucket`; `GetObject` ya está acotado por el ARN del
objeto, no necesita condición):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PermitirListarBackups",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::inconexion-backups-877538609452",
      "Condition": {
        "StringLike": { "s3:prefix": "db-backups/*" }
      }
    },
    {
      "Sid": "PermitirLeerBackups",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::inconexion-backups-877538609452/db-backups/*"
    }
  ]
}
```

## 2. Qué disparar después, cuando el permiso ya esté aplicado

La herramienta ya existe en el repo, lista, esperando el permiso — **no hay
que recrear nada**:

- `.github/workflows/verificar-restore-backup-produccion.yml` — prueba de
  restauración real de un respaldo (solo lectura contra el respaldo más
  reciente, nunca escribe sobre producción).

Dispárala a mano desde GitHub Actions ("Run workflow") después de aplicar
el permiso. Si `gh` está disponible:

```
gh workflow run verificar-restore-backup-produccion.yml
```

## 3. Logs de producción — ya NO hace falta un permiso nuevo (Fase 97)

El plan original (Fase 72) pedía además `logs:FilterLogEvents` para el rol
OIDC `inconexion-github-deploy`, para que
`.github/workflows/verificar-logs-produccion.yml` pudiera traer errores
reales por GitHub Actions. El usuario decidió (Fase 97) revisar los logs de
producción **desde su PC** (con sus propias credenciales de AWS) en vez de
por un workflow — ese permiso ya no se va a pedir. El workflow sigue en el
repo (sigue siendo solo lectura, nunca escribe nada) por si más adelante se
decide usarlo, pero no está en el plan pendiente.

Nota (Fase 97, hallazgo sin explicar): `verificar-logs-produccion.yml` tuvo
una corrida en verde el 2026-09-24 que sí trajo errores reales de
producción, a pesar de que este documento reportaba el permiso como
pendiente en ese momento — no se investigó la causa de la discrepancia
(pudo ser un permiso temporal que alguien quitó después). Sin relevancia
ahora que no se va a volver a usar este camino.

## 4. Estado a 2026-09-30 (Fase 97, sesión pausada por falta de credenciales)

El único pendiente real es el permiso de la sección 1 (`s3:ListBucket` +
`s3:GetObject` para `inconexion-instance`). Sigue sin aplicarse — el
usuario no tenía las credenciales de AWS a mano en esta sesión, se retoma
cuando las tenga. Cuando se aplique y se dispare el workflow, actualizar
`PROGRESS.md` con el resultado real.
