# AWS_DEPLOY_REPORT — InConexion Platform

Fecha del trabajo: **2026-09-09**
Rama: `feat/dashboards-pro-y-aws`

Este documento cierra dos frentes:

- **Fase A** — terminar la funcionalidad de dashboards (los 9 dashboards de
  cliente que faltaban, Inventario y Gerencia sobre el mismo sistema
  configurable, y el estándar de análisis/gráficos/exportación).
- **Fase B / C / D** — dejar la infraestructura lista para **AWS** (no un VPS
  genérico): secretos en SSM, backups a S3, red y permisos mínimos, dominio +
  HTTPS, logs/alarmas y un pipeline de despliegue.

---

## 0. Resumen por milestone

| M | Contenido | Estado | Verificación |
|---|---|---|---|
| M1 | Motor de análisis A6: KPIs con tendencia vs periodo de comparación, avance de meta, alertas fuera de rango, ejes/tooltips legibles | ✅ | Chrome headless + 58 pruebas |
| M2 | Gráficos por panel (barras/líneas/área/pie/tabla), preferencia de visualización por visor, exportación Excel/PDF, **constructor visual** (se le agregó el modal que faltaba) con reordenar y previsualizar | ✅ | Chrome headless |
| M3 | 9 dashboards de cliente por plantilla estándar de contact center (ventas, cobranza, atención). BIVETT deja de ser demo | ✅ | Chrome headless + prueba de permisos |
| M4 | Inventario y Gerencia como dashboards del **mismo** motor configurable (adaptadores de datos) | ✅ | Chrome headless + prueba |
| M5 | Secretos en AWS SSM Parameter Store, backup a S3, systemd timer, CloudWatch Agent, IAM de mínimo privilegio | ✅ | `npm test`, arranque local de `bootstrap.js` |
| M6 | Pipeline GitHub Actions → ECR → SSH a la instancia. Smoke test del contenedor en CI | ✅ (código) / 🟡 (infra AWS lista, falta cargar secrets de GitHub + 1 push) | `compose config` + YAML válidos; ECR + rol OIDC creados 2026-09-10 (ver §11 y `PROGRESS.md` Fase 9) |
| M7 | Este documento | ✅ | — |
| M8 | **Despliegue real** en AWS (runbook §7): app en producción con HTTPS, backups a S3, alarma | ✅ 2026-09-10 | <https://inconexionpruebasclaude.duckdns.org/api/health> → `{"ok":true}`; ver §11 |

`cd server && npm test` → **73/73** (al 2026-09-10; eran 58 al escribir este documento).

---

## 1. Fase A — qué quedó hecho

### A1 — Los 3 dashboards de código ya estaban migrados

Aurora, Orlant y Hospital La María **ya no existen como archivos JS**
(`dashboard-aurora.js`, etc. fueron eliminados en el commit anterior). Viven como
configuración en `server/dashboard-config-seed.js` y se renderizan con
`public/js/dashboard-generic.js`. Se verificó que siguen mostrando las mismas
pestañas y métricas.

### A2 — 9 dashboards de cliente nuevos (M3)

`server/dashboard-plantillas-cliente.js` define **3 plantillas estándar** de
contact center, generadas por configuración (sin código por cliente):

| Plantilla | Clientes | KPIs principales |
|---|---|---|
| **Ventas salientes** | TELEVENTAS SURA, TELEVENTAS COMFAMA, PANTERA MAIKERS, ANDRES YEPES, MOVILIZE, ALBERTO LINERO GO | Base asignada, Gestionados, Contactabilidad %, Contactos efectivos, Ventas (vs meta), Conversión %, AHT |
| **Cobranza / cartera** | INFONDO | Cuentas gestionadas, Cobertura %, Contactos efectivos, Promesas de pago, Cumplimiento de promesas %, Recaudo (vs meta), % Recaudo vs meta |
| **Atención + agendamiento** | SASCHA FITNESS (pedidos), BIVETT (agendas) | Llamadas/WhatsApp entrada, Nivel de atención, Abandonos, AHT, salida (pedidos/agendas) vs meta |

Cada dashboard trae pestaña de **Calidad** cuando el cliente tiene campaña de
Calidad (`CAMPANAS_CALIDAD`).

> ⚠️ **Estos son SUPUESTOS.** El detalle de métricas de cada cliente no estaba
> definido por negocio. Ver §6 para lo que hay que confirmar y cómo ajustarlo
> **sin programar** (constructor visual).

La lógica de permisos **no se tocó**: un dashboard solo lo ve un rol con el
permiso `cliente_<NOMBRE>` (o admin). Prueba automatizada nueva en
`server/tests/dashboard.test.js` lo confirma para los dashboards de M3.

### A3 — Calidad y Metas ya estaban en backend

`public/js/calidad.js` y `public/js/metas.js` ya iban contra `/api/...` con
`requireAuth` + permisos por campaña (commit anterior). Verificado: 0 usos de
`localStorage` para persistencia.

### A4 — Inventario y Gerencia sobre el sistema configurable (M4)

`server/dashboard-adapters.js` expone `INVENTARIO` y `GERENCIA` como dashboards
del **mismo** motor genérico (mismos paneles, mismo análisis A6, misma
exportación). La diferencia: sus datos salen de sus tablas propias
(`inventario_*`, `gerencia_kpis`), no de `dashboard_cargas`.

- `GET /api/dashboard/INVENTARIO` / `/GERENCIA` — protegidos por
  `can(actor, 'Inventario' | 'Gerencia')`. No aceptan carga de Excel.
- Los **modales de gestión** de Inventario y Gerencia siguen siendo la entrada de
  datos (igual que la pantalla de "Cargar Datos" para los clientes); se les
  agregó un botón **"Ver dashboard"**.
- Gerencia: como sus KPIs ya eran mensuales, el dashboard muestra el **% de
  cumplimiento de metas mes a mes** con tendencia real.
- Inventario: foto de stock (items, unidades, valor, por estado, **sin stock con
  alerta**) + entradas/salidas por mes.

> Nota: la regla "cumple meta" es `valor >= meta` (la misma que ya usaba el
> módulo). Para indicadores donde **menos es mejor** (AHT, costo, inasistencia)
> esto marca "no cumple" aunque el valor sea bueno. Arreglo pendiente en §6.

### A6 — Estándar de análisis, gráficos y exportación (M1 + M2)

**Aplica a todo dashboard configurable, presente y futuro** (clientes,
Inventario, Gerencia).

- **Tarjetas KPI de nivel BI**: valor grande, flecha de tendencia (▲/▼) contra el
  periodo de comparación con variación absoluta y %, dirección "buena/mala"
  configurable (`mejorDireccion: 'baja'`), barra de avance de meta con semáforo
  (≥100 / ≥80 / <80), y **borde rojo + ⚠ automático** si el valor está fuera de
  rango (`alerta: { min, max, caidaPct }`).
- Selector **"Comparar contra"**: cualquier periodo previo, no solo el anterior.
- Ejes y tooltips con formato legible (miles con separador, `%`, `mm:ss`).
- **Tipos de panel**: barras, líneas, **área**, pie/donut, tabla — elegibles en
  el constructor.
- **Preferencia de visualización por visor**: cualquier usuario cambia un panel a
  líneas/barras/área **para su propia vista** (localStorage), sin afectar a los
  demás ni requerir permiso de admin.
- **Exportación**: Excel (`.xlsx` real, hoja de KPIs + una hoja por panel con los
  datos ya calculados) y PDF/impresión.
- **Constructor visual** (`Dashboards de Cliente` → `+ Nuevo dashboard`):
  se le **agregó el modal que faltaba en el HTML** (el botón fallaba antes).
  Permite elegir cliente, definir secciones de carga, KPIs y paneles, elegir tipo
  de gráfico y fuente, **reordenar paneles** y **previsualizar contra datos
  reales antes de guardar**.

### A5 — Verificación

- `npm test` → **58/58**.
- Recorrido headless (Chrome DevTools Protocol) como **ADMIN** sobre Aurora,
  INFONDO, INVENTARIO y GERENCIA con datos reales cargados vía API: tendencias,
  metas, alertas y gráficos personalizados se calculan correctamente.
- Permisos por rol (CLIENTES_DASH / SUPERVISOR / CALIDAD / REPORTES) cubiertos
  por `permissions.test.js`, `calidad.test.js` y el test nuevo de M3.

---

## 2. Fase B1 — Arquitectura elegida y por qué

### Elegida: **1 instancia Lightsail + Docker Compose + Caddy + disco de bloques**

```
                 Internet
                    │  443/80
          ┌─────────▼──────────┐   Lightsail instance (1 vCPU / 2 GB)
          │  Caddy (contenedor) │   - HTTPS automático (Let's Encrypt)
          │  :80 :443           │   - reverse_proxy -> app:3000
          └─────────┬──────────┘
                    │ red interna de compose
          ┌─────────▼──────────┐
          │  app (contenedor)   │   node bootstrap.js
          │  :3000 (solo local) │   - lee secretos de SSM al arrancar
          └─────────┬──────────┘
                    │
        ┌───────────▼───────────┐
        │ disco de bloques (EBS) │  montado en /opt/inconexion/data
        │  inconexion.db (SQLite)│  -> sobrevive a reinicios de contenedor/instancia
        └───────────────────────┘

  SSM Parameter Store  ── secretos (JWT, hash admin, CORS_ORIGIN)
  S3 (versionado)      ── backups diarios de la BD
  CloudWatch           ── logs de contenedores + métricas + alarma de health check
```

**Por qué esta y no otra:**

- La app usa **SQLite en un archivo**. Es un único proceso escritor. La opción
  más simple y coherente con lo ya construido (`server/Dockerfile`,
  `docker-compose.yml`, `deploy/Caddyfile`) es **una sola máquina** con el
  archivo en un disco persistente.
- **Lightsail** en vez de EC2 puro: precio plano y predecible, panel simple,
  snapshots y disco de bloques incluidos, firewall integrado. Menos piezas que
  administrar. (Si más adelante se necesita VPC peering, varias subredes, o
  autoscaling, se migra a EC2 — el `docker-compose.yml` es el mismo.)
- **Caddy** ya estaba configurado (`deploy/Caddyfile`): HTTPS automático sin
  certbot.

### Alternativa evaluada y **NO** implementada: RDS PostgreSQL + varias instancias

| | SQLite en 1 máquina (elegida) | RDS Postgres + N instancias |
|---|---|---|
| Coste/mes | ~US$17–30 | ~US$45–90+ |
| Complejidad | Baja | Media-alta (migrar el modelo de datos, pool de conexiones, secreto de BD rotable) |
| Alta disponibilidad | No (una máquina) | Sí |
| Escala de escritura | 1 escritor | Concurrente |

**Señal para migrar a RDS + varias instancias** (cualquiera de estas):

1. Se necesita **más de una instancia de aplicación** a la vez (HA real, o que
   una caída de la máquina no sea downtime).
2. Aparecen **errores `SQLITE_BUSY`** de forma recurrente en los logs (escritura
   concurrente sostenida — muchos cargadores de Excel simultáneos, o webhooks de
   integraciones futuras).
3. La BD supera ~1–2 GB y las consultas de dashboard empiezan a tardar.
4. Se requiere un RPO (pérdida máxima aceptable) menor a 24 h sin depender del
   backup manual → RDS con point-in-time recovery.

Mientras nada de esto ocurra, **una máquina + backups a S3 es suficiente y más
barato**.

### Otras alternativas (por qué no ahora)

- **ECS Fargate**: sin servidor que parchear, pero obliga a Postgres ya (no hay
  volumen compartido entre tareas para SQLite) y sube el coste. Reservado para
  cuando se cumpla la señal de migración.
- **Elastic Beanstalk / App Runner**: App Runner no da volumen persistente;
  Beanstalk añade una capa de abstracción que no aporta con una sola máquina.

---

## 3. Fase B2 — Secretos (SSM Parameter Store)

En producción los secretos **no van en un `.env` en disco**. Se guardan como
parámetros `SecureString` y el servidor los lee al arrancar
(`server/secrets.js` → `server/bootstrap.js`), usando el **rol IAM de la
instancia** (sin claves de acceso en ningún lado).

### Crear los parámetros (una vez)

```bash
REGION=us-east-1
PREFIX=/inconexion/prod

# JWT_SECRET (48 bytes hex)
aws ssm put-parameter --region "$REGION" --type SecureString \
  --name "$PREFIX/JWT_SECRET" \
  --value "$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"

# Hash bcrypt de la contraseña del admin maestro
aws ssm put-parameter --region "$REGION" --type SecureString \
  --name "$PREFIX/MASTER_ADMIN_PASSWORD_HASH" \
  --value "$(node server/hash-password.js 'PON-AQUI-UNA-CONTRASEÑA-FUERTE')"

# Usuario del admin maestro
aws ssm put-parameter --region "$REGION" --type SecureString \
  --name "$PREFIX/MASTER_ADMIN_USER" --value "admin"

# Dominio(s) permitido(s) por CORS
aws ssm put-parameter --region "$REGION" --type SecureString \
  --name "$PREFIX/CORS_ORIGIN" --value "https://tu-dominio-real.com"
```

Para **rotar** un secreto: `aws ssm put-parameter ... --overwrite` y reiniciar el
contenedor (`docker compose restart app`).

En `app.env` de la instancia solo queda:

```
NODE_ENV=production
PORT=3000
SSM_PARAM_PREFIX=/inconexion/prod/
AWS_REGION=us-east-1
TRUST_PROXY=1
BACKUP_DIR=/app/server/data/backups
BACKUP_S3_BUCKET=inconexion-backups-tuempresa
```

(SSM estándar es **gratis**. Si se prefiere Secrets Manager por la rotación
automática, son ~US$0.40/secreto/mes; el código no cambia salvo el módulo de
lectura.)

---

## 4. Fase B3 — Red y permisos

### Security Group / firewall de Lightsail

| Puerto | Origen | Motivo |
|---|---|---|
| 443/tcp | `0.0.0.0/0` | HTTPS público |
| 80/tcp | `0.0.0.0/0` | redirección a HTTPS + reto ACME de Caddy |
| 22/tcp | **solo tu IP** `x.x.x.x/32` | SSH de administración/deploy |

El puerto 3000 **nunca** se expone: `docker-compose` lo publica en
`127.0.0.1:3000` y solo Caddy (misma máquina) lo alcanza.

```bash
# Lightsail (CLI): abrir 80/443, restringir 22 a tu IP
MI_IP=$(curl -s https://checkip.amazonaws.com)
aws lightsail put-instance-public-ports --instance-name inconexion-prod --port-infos \
  fromPort=443,toPort=443,protocol=TCP,cidrs=0.0.0.0/0 \
  fromPort=80,toPort=80,protocol=TCP,cidrs=0.0.0.0/0 \
  fromPort=22,toPort=22,protocol=TCP,cidrs="$MI_IP/32"
```

### CORS

`CORS_ORIGIN` se fija al **dominio real de producción** (vía SSM, §3). El código
(`server/config.js`) ya **rechaza el arranque en producción** si `CORS_ORIGIN`
está vacío o contiene `*`.

### IAM de mínimo privilegio

- El usuario/rol que hace el **deploy** (GitHub Actions) **no** usa
  `AdministratorAccess`. Necesita solo: push a un repo ECR concreto y
  (opcional) leer parámetros SSM. Ver §8.
- El **rol de la instancia** usa la política de
  `deploy/iam-policy-instance.json` (sustituir `REGION`, `ACCOUNT_ID` y nombres):
  leer `/inconexion/prod/*` de SSM, `kms:Decrypt` de la clave `aws/ssm`,
  `s3:PutObject` **solo** en el prefijo de backups, y logs/métricas de
  CloudWatch. Nada más.

---

## 5. Fase B4 — Dominio y HTTPS

1. **DNS**: crear un registro `A` (y `AAAA` si hay IPv6) que apunte a la **IP
   estática** de la instancia.
   - Route 53: `aws route53 change-resource-record-sets` con un record `A` →
     `<IP-estatica-lightsail>`.
   - Cualquier otro registrador: panel DNS → registro `A` → IP.
   - En Lightsail: **crear una IP estática** y adjuntarla a la instancia
     (`aws lightsail allocate-static-ip` + `attach-static-ip`) para que no cambie
     al reiniciar.
2. **Caddyfile** (`deploy/Caddyfile`): cambiar `tudominio.com` por el dominio real
   y `tu-email@ejemplo.com` por un correo válido.
3. Al arrancar `docker compose up -d`, Caddy:
   - resuelve el reto HTTP-01 de Let's Encrypt en el puerto 80,
   - obtiene el certificado, sirve HTTPS en 443 y **renueva solo**,
   - redirige `http://` → `https://`.
   El certificado y su estado viven en el volumen `caddy-data` (persistente).

Requisitos antes de `up`: el DNS ya propagado y los puertos 80/443 abiertos.

---

## 6. Pendiente de la Fase A (información de negocio)

Nada de esto bloquea el despliegue. Todo se ajusta **desde el constructor visual**
(`Dashboards de Cliente` en el panel admin) o con una edición pequeña de
`server/dashboard-plantillas-cliente.js` / `server/dashboard-adapters.js`.

### 6.1 Métricas reales de cada cliente (A2)

Se usó una plantilla estándar. Falta confirmar, por cliente:

| Cliente | Confirmar |
|---|---|
| TELEVENTAS SURA / COMFAMA | ¿KPIs correctos? ¿meta de contactabilidad y de conversión reales? ¿la meta de ventas es un número fijo o sale de un cronograma? |
| PANTERA MAIKERS | **Qué operación es.** Se asumió televentas/lead-gen. |
| ANDRES YEPES / ALBERTO LINERO GO | Se asumió ventas. Si son marca personal (redes, e-commerce), cambiar a KPIs de comunidad/pedidos. |
| MOVILIZE | **Qué operación es** y sus KPIs. |
| SASCHA FITNESS | Se asumió atención al cliente + "pedidos". ¿Es tienda? ¿PQR, envíos, redes? |
| INFONDO | ¿KPIs de cartera correctos? ¿la meta de recaudo es fija o mensual? |
| BIVETT | Se asumió agendamiento tipo clínica. ¿Datos reales disponibles? |

Además, para **cargar datos reales** cada dashboard necesita que un usuario con
permiso *Cargar Datos* suba los Excel (plantilla descargable desde la pantalla de
cargas).

### 6.2 Inventario y Gerencia (A4)

- **Inventario**: confirmar si el dashboard debe mostrar algo más (rotación,
  días de cobertura, alerta por umbral **por ítem** — hoy la alerta es "stock =
  0" porque no hay campo `minimo`; añadirlo es una columna en `inventario_items`
  y un `<`).
- **Gerencia**: confirmar de qué fuente salen los indicadores (hoy se cargan a
  mano por Excel; si deben consolidarse desde Calidad + cargas de clientes +
  inventario, eso es trabajo nuevo) y **la dirección de cada meta** (para
  AHT/costo/inasistencia "menos es mejor"): hoy la regla es `valor >= meta` para
  todos. Arreglo: un campo `sentido: 'mayor' | 'menor'` en `gerencia_kpis`.

---

## 7. Runbook — desplegar desde cero

Prerrequisitos: cuenta AWS, dominio, AWS CLI configurado en tu máquina, una clave
SSH.

### 7.1 Crear la infraestructura

```bash
REGION=us-east-1
# 1. Instancia Lightsail (Ubuntu 22.04, plan 2 GB)
aws lightsail create-instances --region $REGION \
  --instance-names inconexion-prod \
  --availability-zone ${REGION}a \
  --blueprint-id ubuntu_22_04 \
  --bundle-id small_3_0

# 2. IP estática
aws lightsail allocate-static-ip --region $REGION --static-ip-name inconexion-ip
aws lightsail attach-static-ip --region $REGION --static-ip-name inconexion-ip \
  --instance-name inconexion-prod

# 3. Disco de bloques para los datos (20 GB) y adjuntarlo
aws lightsail create-disk --region $REGION --disk-name inconexion-data \
  --availability-zone ${REGION}a --size-in-gb 20
aws lightsail attach-disk --region $REGION --disk-name inconexion-data \
  --instance-name inconexion-prod --disk-path /dev/xvdf

# 4. Firewall (ver §4)
MI_IP=$(curl -s https://checkip.amazonaws.com)
aws lightsail put-instance-public-ports --region $REGION --instance-name inconexion-prod \
  --port-infos \
    fromPort=443,toPort=443,protocol=TCP,cidrs=0.0.0.0/0 \
    fromPort=80,toPort=80,protocol=TCP,cidrs=0.0.0.0/0 \
    fromPort=22,toPort=22,protocol=TCP,cidrs="$MI_IP/32"

# 5. Rol IAM para la instancia (SSM + S3 backups + CloudWatch)
#    Lightsail: usar "amazon/AWS-managed" o crear un rol y adjuntarlo desde la
#    consola de Lightsail (Cuenta -> Roles), con la política de
#    deploy/iam-policy-instance.json.

# 6. Bucket S3 de backups CON VERSIONADO
aws s3api create-bucket --region $REGION --bucket inconexion-backups-tuempresa \
  --create-bucket-configuration LocationConstraint=$REGION
aws s3api put-bucket-versioning --bucket inconexion-backups-tuempresa \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket inconexion-backups-tuempresa \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 7. Parámetros SSM (ver §3)

# 8. Repo ECR
aws ecr create-repository --region $REGION --repository-name inconexion \
  --image-scanning-configuration scanOnPush=true
```

### 7.2 Preparar la instancia

```bash
ssh ubuntu@<IP-estatica>

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit && ssh ubuntu@<IP-estatica>

# AWS CLI (para que el pipeline pueda hacer 'aws ecr get-login-password')
sudo snap install aws-cli --classic

# Montar el disco de datos
sudo mkfs -t ext4 /dev/xvdf                 # SOLO la primera vez (disco vacío)
sudo mkdir -p /opt/inconexion/data
echo '/dev/xvdf /opt/inconexion/data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a

# Estructura de despliegue
sudo mkdir -p /opt/inconexion && sudo chown ubuntu:ubuntu /opt/inconexion
cd /opt/inconexion
# Copiar desde el repo: deploy/docker-compose.prod.yml  -> docker-compose.yml
#                       deploy/Caddyfile               -> Caddyfile   (con tu dominio)
# y crear app.env  (ver §3, plantilla en app.env.example)
```

Ajustar en `docker-compose.yml` de la instancia el volumen de datos a un bind al
disco montado:

```yaml
    volumes:
      - /opt/inconexion/data:/app/server/data
```

### 7.3 Primer arranque

```bash
cd /opt/inconexion
export INCONEXION_IMAGE=<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/inconexion:latest
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:3000/api/health      # {"ok":true}
```

Entrar a `https://tu-dominio-real.com`, iniciar sesión con el admin maestro,
**cambiar todas las contraseñas de ejemplo** y crear los usuarios reales.

### 7.4 Backups programados

```bash
sudo cp deploy/inconexion-backup.service /etc/systemd/system/
sudo cp deploy/inconexion-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now inconexion-backup.timer
systemctl list-timers inconexion-backup.timer      # comprobar próxima ejecución
sudo systemctl start inconexion-backup.service     # probar una vez ya
aws s3 ls s3://inconexion-backups-tuempresa/db-backups/
```

### 7.5 Logs y alarma (Fase B6)

```bash
# CloudWatch Agent
sudo snap install amazon-cloudwatch-agent    # o el .deb oficial
sudo cp deploy/cloudwatch-agent-config.json \
  /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

Alarma de caída del health check (canary externo con Route 53 Health Check +
CloudWatch):

```bash
aws route53 create-health-check --caller-reference inconexion-$(date +%s) \
  --health-check-config \
  Type=HTTPS,FullyQualifiedDomainName=tu-dominio-real.com,ResourcePath=/api/health,RequestInterval=30,FailureThreshold=3

aws cloudwatch put-metric-alarm --alarm-name inconexion-health \
  --namespace AWS/Route53 --metric-name HealthCheckStatus \
  --dimensions Name=HealthCheckId,Value=<ID-del-health-check> \
  --statistic Minimum --period 60 --evaluation-periods 3 --threshold 1 \
  --comparison-operator LessThanThreshold \
  --alarm-actions arn:aws:sns:<REGION>:<ACCOUNT>:inconexion-alertas
```

(El `restart: unless-stopped` de compose ya reinicia el contenedor si el proceso
muere; la alarma cubre "la máquina o el proceso llevan >3 min sin responder".)

---

## 8. Fase C — Pipeline y sus secrets

`.github/workflows/deploy.yml` se dispara **solo si el workflow `CI` terminó OK
en `main`**. Pasos: OIDC con AWS → build + push a ECR (`:sha` y `:latest`) → SSH a
la instancia → `docker compose pull && up -d` → espera al health check → `prune`.

### Secrets / variables de GitHub (Settings → Secrets and variables → Actions)

| Nombre | Tipo | Valor |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | secret | ARN de un rol IAM con *trust* al OIDC de GitHub, permisos: `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` **solo** sobre el repo `inconexion` |
| `DEPLOY_SSH_HOST` | secret | IP estática de la instancia |
| `DEPLOY_SSH_USER` | secret | `ubuntu` |
| `DEPLOY_SSH_KEY` | secret | clave **privada** SSH (la pública va en `~/.ssh/authorized_keys` de la instancia) |
| `AWS_REGION` | **variable** | p.ej. `us-east-1` |

Crear el proveedor OIDC y el rol:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list <thumbprint-actual-de-github>
# Rol con condición  token.actions.githubusercontent.com:sub = repo:<org>/<repo>:ref:refs/heads/main
```

Además, en GitHub → Settings → Environments → **`produccion`**: activar
*Required reviewers* si se quiere **aprobación manual** antes de cada deploy.

### Estado de la verificación del pipeline

- ✅ `docker compose -f deploy/docker-compose.prod.yml config` válido.
- ✅ YAML de `ci.yml` y `deploy.yml` válidos. `ci.yml` ahora arranca el
  contenedor y verifica `/api/health` (smoke test real de la imagen).
- ⏳ **Deploy real pendiente**: requiere crear el repo ECR, el rol OIDC y los 4
  secrets + la variable. No se ejecutó porque implica credenciales de la cuenta
  AWS que no deben manejarse desde aquí. El runbook de §7 permite hacer el primer
  deploy a mano; a partir de ahí el pipeline lo automatiza.

---

## 9. Runbook — recuperación

### La instancia se cae / se corrompe

1. Crear una instancia nueva con §7.1–7.2 (o restaurar un **snapshot** de
   Lightsail si se tomaban: `aws lightsail create-instances-from-snapshot`).
2. Adjuntar el **mismo disco de datos** (`inconexion-data`) a la instancia nueva
   y montarlo en `/opt/inconexion/data`. El `inconexion.db` está ahí intacto.
3. `docker compose up -d`. Repuntar el DNS/IP estática si cambió.

### Hay que restaurar desde un backup de S3

```bash
cd /opt/inconexion
docker compose stop app
# Elegir la copia (S3 tiene versionado: se puede volver a cualquier versión)
aws s3 ls s3://inconexion-backups-tuempresa/db-backups/
aws s3 cp s3://inconexion-backups-tuempresa/db-backups/inconexion-YYYYMMDD-HHMMSS.db \
  ./data/inconexion.db
rm -f ./data/inconexion.db-wal ./data/inconexion.db-shm   # descartar WAL viejo
docker compose start app
curl -fsS http://127.0.0.1:3000/api/health
```

### El deploy rompió producción

```bash
cd /opt/inconexion
export INCONEXION_IMAGE=<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/inconexion:<SHA-anterior-bueno>
docker compose up -d          # vuelve a la imagen anterior (ECR guarda los tags :sha)
```

---

## 10. Costos estimados (us-east-1, orden de magnitud)

| Recurso | Detalle | US$/mes |
|---|---|---|
| Instancia Lightsail | plan 2 GB RAM / 2 vCPU / 60 GB SSD | ~12 |
| IP estática | gratis mientras esté adjunta | 0 |
| Disco de bloques | 20 GB | ~2 |
| S3 backups | <5 GB con versionado + salida mínima | <1 |
| CloudWatch | logs (~pocos GB) + 1–2 métricas custom + 1 alarma | 1–4 |
| Route 53 | zona alojada + health check | ~1.5 |
| Dominio | .com (anual, ~US$12/año) | ~1 |
| ECR | almacenamiento de imágenes (<2 GB) | <1 |
| **Total** | | **~US$18–25/mes** |

Con RDS Postgres + 2 instancias esto subiría a **~US$60–100/mes** (ver §2).

---

## 11. Checklist "¿iría a producción hoy?"

Recorrido honesto sobre esta rama:

> **Actualización 2026-09-10:** ejecutado el runbook §7 en la cuenta AWS
> `934685482338` (us-east-1). App en producción:
> <https://inconexionpruebasclaude.duckdns.org>. Detalle completo con IDs/ARNs en
> `PROGRESS.md` → «Fase 9».

| Ítem | Estado |
|---|---|
| `npm test` en verde | ✅ **73/73** (68 + 2 de `/api/users` + 3 de XSS) |
| Config fail-fast (JWT, hash admin, CORS obligatorio en prod) | ✅ (commit previo) |
| Secretos fuera del repo y fuera del disco (SSM) | ✅ 4 `SecureString` en `/inconexion/prod/*`; el contenedor los lee al arrancar |
| Rate limiting, helmet + CSP, CORS whitelist | ✅ (commit previo) |
| Historial append-only, permisos por rol/campaña/cliente | ✅ sin cambios |
| Dashboards: 12 clientes + Inventario + Gerencia por configuración | ✅ |
| Análisis (tendencia/meta/alerta), export, constructor visual | ✅ |
| Imagen Docker arranca y responde `/api/health` | ✅ en producción: `https://…/api/health` → `{"ok":true}` |
| Backups automáticos local + S3 versionado | ✅ `inconexion-backup.timer` activo; prueba real subida a `s3://inconexion-backups-josedavidosorio2005/db-backups/` |
| Disco persistente para SQLite | ✅ disco `inconexion-data` 20 GB montado por UUID en `/opt/inconexion/data` |
| HTTPS automático (Caddy) | ✅ certificado Let's Encrypt emitido, HTTP→HTTPS 308 |
| Security Group: 80/443 público, 22 restringido | 🟡 22 estaba en `181.79.84.39/32`; el paso SSH del pipeline (runners de GitHub, IP dinámica) **no conecta**. SSH es key-only (`passwordauthentication no`) → abrir 22 a `0.0.0.0/0` es aceptable. **Pendiente** (comando en `PROGRESS.md` «Fase 13»). Mientras tanto los deploys se hacen a mano por SSH desde la IP del operador. |
| Rol IAM de mínimo privilegio (instancia y deploy) | ✅ `user/inconexion-instance` + `role/inconexion-github-deploy`. Trust policy ajustada: `StringEquals` sobre el claim `repository` + `StringLike` sobre `sub` = `repo:*:ref:refs/heads/main` (la cuenta usa *immutable subjects* → el `sub` trae sufijos `@<id>`). |
| Pipeline CI→deploy | ✅ CI (test 18/20/22 + docker-build) + `deploy.yml` (OIDC → ECR build/push). El paso final SSH depende del puerto 22 (arriba). 5 secrets/variable de GitHub cargados. |
| **Producción sirviendo la versión de `main`** | ✅ **2026-09-10**: imagen `sha256:9c8b0b72…` (tag `0fd699ce…`) = digest de `main` HEAD. `curl https://…/api/health` → `{"ok":true}` con cert Let's Encrypt válido. Login admin OK. `dashboard/GESTION_HUMANA` → 4 secciones. Historial registra la creación de usuarios (bug 1.1 corregido). |
| Alarma de caída (health check) | ✅ Route 53 health check `94fe66d2-…` + CloudWatch alarm `inconexion-health` → SNS. **Suscripción email confirmada**. |
| Métricas de negocio reales cargadas | ⏳ depende de negocio (§6) — hoy los dashboards tienen estructura, no datos |
| Contraseñas de ejemplo cambiadas | ✅ verificado: login `crodriguez` / `calidad123` → **401** (las semilla ya no sirven) |

**Veredicto:** la aplicación **está desplegada y sirviendo en producción** la
versión de `main` (Edwin + Gestión Humana + Node 22), verificado contra la API
real. El pipeline CI→ECR funciona; el paso SSH del deploy automático necesita
abrir el puerto 22 (ver «Fase 13»). Quedan **4 decisiones de negocio** que no
bloquean.

> **Actualización 2026-09-10 (Fase 11):** `server/Dockerfile` pasó de `node:20-*`
> a **`node:22-*`** (el AWS SDK v3 pedirá Node ≥ 22 después de enero 2027).
> La imagen de producción se reconstruye en el próximo deploy.

---

## 12. Pendiente de la Fase B (decisiones abiertas)

| Decisión | Recomendación por defecto | A confirmar |
|---|---|---|
| Lightsail vs EC2 | Lightsail | Si el equipo ya opera en una VPC con otras cosas, EC2 encaja mejor. |
| SSM Parameter Store vs Secrets Manager | Parameter Store (gratis) | Secrets Manager si se quiere rotación automática del hash del admin. |
| Región | `us-east-1` | Elegir la más cercana a Colombia con Lightsail: `us-east-1` o `us-west-2`; `sa-east-1` (São Paulo) no tiene Lightsail con todos los planes. |
| Retención de backups locales | 14 | ¿Suficiente? S3 los guarda todos con versionado. |
| Aprobación manual del deploy | Sí (environment `produccion`) | Desactivar si se quiere deploy continuo. |
| Snapshots de Lightsail además de S3 | No configurados | Añadir un snapshot semanal automático si se quiere recuperación de "toda la máquina" en 1 paso. |

---

## 13. Archivos nuevos / modificados en esta rama

**Fase A (dashboards):**
- `server/dashboard-plantillas-cliente.js` (nuevo) — 3 plantillas + 9 configs
- `server/dashboard-adapters.js` (nuevo) — Inventario y Gerencia
- `server/dashboard-config-seed.js`, `server/db.js` — seed idempotente por cliente
- `public/js/dashboard-generic.js` — motor de análisis A6, área, preferencia por visor, exportación, `openGenericDashboardPreview`
- `public/js/dashboards-admin.js` — reordenar paneles, previsualizar, tipo `area`
- `public/js/charts.js` — `loFmt()` (ejes/tooltips/datalabels legibles)
- `public/css/styles.css` — tarjetas KPI de BI, herramientas de panel, modal del constructor
- `public/index.html` — modal del constructor (faltaba), selector "Comparar contra", botón Exportar, "Ver dashboard" en Inventario/Gerencia
- `server/server.js` — ruta de adaptadores en `GET /api/dashboard/:cliente`
- `server/tests/dashboard.test.js`, `server/tests/inventario-gerencia.test.js` — +2 pruebas

**Fase B/C (infra):**
- `server/secrets.js`, `server/bootstrap.js` (nuevos)
- `server/Dockerfile`, `server/package.json` — entrypoint `bootstrap.js`, deps AWS SDK
- `server/scripts/backup.js` — subida a S3
- `docker-compose.yml`, `app.env.example` — SSM/S3, rotación de logs
- `deploy/docker-compose.prod.yml`, `deploy/inconexion-backup.{service,timer}`, `deploy/cloudwatch-agent-config.json`, `deploy/iam-policy-instance.json` (nuevos)
- `.github/workflows/deploy.yml` (nuevo), `.github/workflows/ci.yml` — smoke test del contenedor
