# Pendientes (actualizado Fase 118, 2026-10-05)

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

- ~~**Residuo de prueba de la Fase 67 en producción**~~ — **resuelto en la
  Fase 116** (2026-10-04): al re-subir Tráfico de Llamadas con el
  reemplazo por rango (Fase 115), el 2026-08-17 real del archivo nuevo
  reemplazó la fila sintética en el mismo lugar (no quedó huérfana porque
  esa fecha SÍ viene en el archivo real). Ver también el hallazgo nuevo de
  la Fase 116 abajo.
- **Pedir a Edwin: Tráfico de WhatsApp con `SERVICE_LEVEL_5MIN`** (Fase
  116, 2026-10-04): el export diario real de Wolkvox que mandó para
  agosto-septiembre/2026 no trae esa columna (solo 10/20/30s) — la
  pestaña sigue mostrando el aviso de "sin dato" para el nivel de
  servicio a 5 minutos en WhatsApp (pedido del jefe, Fase 87). Pedirle
  que la agregue (umbral de 300s en Wolkvox) en el próximo export.
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

## De la Fase 117 (revisión final integral) — demostrado en la Fase 118

- ~~Verificación en producción con sesión real~~ — **hecho en la Fase
  118** (2026-10-05): `scripts/produccion/revision-final.js` corrió
  contra producción con sesión real del usuario — 0 discrepancias de
  números de control, 0 errores de consola, 0 canvas sin dibujar, 0
  peticiones fallidas, Exportar OK en las 7 pestañas, Fase 113
  confirmada. Ver el recorrido `CLIENTES_DASH` abajo (de la Fase 118),
  que quedó aparte, inconcluso.
- ~~Matriz completa de IDOR (10 roles × módulos)~~ — **hecho en la Fase
  118**: `server/tests/fase118-matriz-acceso.test.js` (51 pruebas),
  inventario programático de las 113 rutas reales + política declarada
  + ejecución real contra los 10 roles de `seed:demo`. Detalle en
  `docs/auditoria-seguridad-fase102.md` → Fase 118.
- ~~Barrido visual de las 7 pestañas × claro/oscuro × tamaños de
  pantalla~~ y ~~barrido de código muerto~~ — **siguen pendientes**, ver
  "De la Fase 118" abajo (no se llegaron a cubrir tampoco en esta fase).

## De la Fase 118 (cierra con evidencia lo que la Fase 117 no demostró)

- **Recorrido en producción con un usuario `CLIENTES_DASH` real**:
  quedó **inconcluso**, no verificado. El script pide un segundo login
  manual (misma ventana visible) para esto; la evidencia de la corrida
  real (rol devuelto `null`, `#admin-page` NO oculto, las 2 escaladas de
  prueba "no bloqueadas") apunta a que el segundo login reutilizó la
  sesión de administrador, no una cuenta `CLIENTES_DASH` — no hay a mano
  una contraseña real de ese tipo de usuario en producción. Repetir en
  la próxima sesión disponible con esa contraseña a mano (o pedirle al
  jefe que la comparta por un canal seguro, nunca por el repo/CI).
- **Barrido visual real** (Playwright local, `seed:demo`: 7 pestañas ×
  claro/oscuro × 1366×768/1920×1080/2560×1440/móvil 412px + estados
  mes-sin-datos/mes-incompleto/0-filas): no se llegó a cubrir en esta
  sesión — excede lo que da el tiempo de una sola fase junto con el
  resto de lo pedido. Prioridad alta para la próxima sesión disponible.
- **Barrido de código muerto** a partir del grafo de `graphify` (nodos
  sin referencias entrantes, verificados con grep): no se llegó a cubrir.
- **Casos de borde del reemplazo por rango** (Fases 115/116) más allá de
  los ya cubiertos por `fase116-rango-global-hueco.test.js` (hueco de
  días, caso real FONIATRIA, skill ausente, impacto exacto): archivo de
  un solo día, skill NUEVA, re-subida idéntica (0 cambios, idempotente),
  rango que cruza meses, fecha futura — no se escribieron pruebas
  dedicadas nuevas en esta fase. La atomicidad ante una falla a la mitad
  de la carga SÍ se confirmó por lectura de código (no ejecutada con una
  falla inyectada): `server/tipificaciones.js`, `server/trafico-
  whatsapp.js` y `server/agendas.js` envuelven cada carga en
  `db.transaction(...)`, que revierte todo ante cualquier excepción —
  better-sqlite3 lo garantiza por construcción.
- **XSS con texto malicioso real** (Playwright local, `<img
  src=x onerror=...>` / `"><script>...` en campos de texto libre +
  exports sin fórmulas activas): no se llegó a cubrir con pruebas
  dinámicas nuevas en esta fase — Fase 102 ya confirmó por lectura de
  código que `esc()` y `xlsxFilasSeguras`/`xlsxCeldaSegura` cubren todos
  los módulos (ver `docs/auditoria-seguridad-fase102.md`), pero eso es
  lectura de código, no un ataque real ejecutado campo por campo.
- **Zonas horarias** (TZ=UTC vs TZ=America/Bogota: cortes de fecha, "mes
  en curso", Tipificación con horas como 18:06): no se llegó a cubrir
  con pruebas dedicadas en esta fase.
- **Fallas y carreras de UI** (500/red cortada/respuesta vacía en cada
  pestaña, cambio rápido de pestaña/mes): no se llegó a cubrir.
- **Hallazgo real corregido en esta fase**: un test de la Fase 117
  (desempate de `GET /historial` en empates de milisegundo) resultó
  flaky en CI por un filtro de verificación demasiado amplio — corregido
  (severidad baja, detalle en `docs/auditoria-seguridad-fase102.md` →
  Fase 118).
