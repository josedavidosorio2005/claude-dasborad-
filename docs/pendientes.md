# Pendientes (Fase 112, 2026-10-02)

Un solo lugar para lo que falta — reemplaza los pendientes sueltos que
antes vivían repartidos en `PROGRESS.md`. El detalle histórico de cada
punto, si existe, está en `docs/historico/progress-fases.md`.

## De Edwin (datos reales)

Pestañas ya construidas, esperando el archivo real — ver
`docs/inventario-bases-orlant.md` para la hoja/columnas exactas de cada
una:

- **Ordenamiento Médico** y **Recuperación de Cancelados** (parte de la
  pestaña Agendamiento).
- **Flujo Mensual** — probablemente redundante con Tráfico de
  Llamadas/WhatsApp (que ya cubre lo mismo, automático); preguntar a
  Edwin si se puede retirar del todo en vez de solo dejarla oculta.
- **Salida** (llamadas/WhatsApp de salida, diaria).
- **Gestión STA** — necesita 2 fuentes (`sta_categorias` + parte del
  archivo de agendamiento).

## De AWS

- **Fase 97, parte de AWS: pausada** — falta la **Política 1 de IAM**
  (agregar `s3:ListBucket` + `s3:GetObject` al usuario
  `inconexion-instance`, acotado al prefijo `db-backups/*` del bucket de
  backups — JSON ya armado en `docs/aws-permisos-pendientes.md`). Bloquea
  la prueba real de restauración de backups
  (`.github/workflows/verificar-restore-backup-produccion.yml`). Necesita
  credenciales de AWS a mano para aplicarse — no se puede hacer desde
  una sesión de Claude Code sin eso.
- **Inventario y respaldo de la cuenta AWS vieja** (`934685482338`): sin
  empezar — necesita las credenciales de esa cuenta.
- ~~`inconexion-backup.timer` está `inactive` en producción~~ — **resuelto
  en la Fase 114** (2026-10-02, URGENTE, autorizado): las 2 unidades nunca
  se habían instalado en la instancia nueva (no solo "no habilitadas" —
  no existían en `/etc/systemd/system/`). `respaldo-produccion.yml` las
  instaló desde `deploy/` y activó el timer (`enabled`+`active`, próxima
  corrida 03:15 hora del servidor = 10:15 p.m. Colombia, el servidor corre
  en UTC). Respaldo de hoy verificado (`integrity_check: ok`, conteos
  coinciden con los números de control de `PROGRESS.md`), subida a S3 OK.
  `salud-servidor.yml` ahora también falla si el timer no está `enabled`
  (antes solo miraba `is-active`), para que esto no vuelva a pasar
  desapercibido.

## Decisiones pendientes del usuario

- **Residuo de prueba de la Fase 67 en producción** (hallado en la Fase
  115, 2026-10-04): una fila sintética del 2026-08-17 (3 llamadas, 3
  abandonadas, repartida entre 3P y GENERAL), cargada como
  `llenado-agosto-produccion.xlsx` y marcada "Fase 67 - prueba real
  (borrar automatico)", nunca se borró — infla agosto de 3P/GENERAL en 3
  llamadas (0,04 %) sobre el archivo real de Edwin. Borrarla es una
  escritura puntual en producción (2 filas de
  `calidad_nivel_servicio_diario` + su mensual) que no estaba autorizada
  en la Fase 115 (solo se autorizó subir el archivo nuevo) — pedir visto
  bueno explícito antes de borrarla.
- **Flujo Mensual**: ¿se retira del todo (código + pestaña oculta) o se
  deja esperando por si algún día se usa? (Fase 115: ya quedaría lista
  con Ago-26/Sep-26 en cuanto se decida destaparla.)
- **Nivel de servicio**: Edwin lo mencionó como una base aparte en algún
  momento, pero Tráfico de Llamadas/WhatsApp ya muestra Nivel de Servicio
  a 20s — aclarar con él si se refiere a algo distinto (por hora, un SLA
  interno de InCo, una línea específica) antes de construir nada nuevo.

## Mejoras propuestas (no pedidas todavía, para cuando haya espacio)

Ninguna pendiente por ahora — "Cambiar mi contraseña" y el registro de
inicios de sesión (las dos únicas que había en esta lista) se
implementaron en la Fase 113.
