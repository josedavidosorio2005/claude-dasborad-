# Pendientes (actualizado Fase 120, 2026-10-05)

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
- **Pedir a Edwin/Wolkvox: el AHT de Tráfico de WhatsApp** (Fase 120,
  2026-10-05): se confirmó contra los 2 archivos reales de ago-sep/2026
  (258 filas) que la columna AHT siempre viene vacía ("----") — se quitó
  de la pestaña y del export (ver `CHANGELOG.md` v1.12.0). Si Wolkvox
  llega a entregarlo más adelante, reactivarlo es solo volver a poner
  `mostrarAht:true` en el panel (`PUT /dashboards/config/ORLANT`), sin
  tocar código.
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

- ~~Recorrido en producción con un usuario `CLIENTES_DASH` real~~ —
  **hecho en la Fase 119** (2026-10-05): con la cuenta REAL del cliente
  de ORLANT (creada por el usuario desde la plataforma), confirmada por
  JWT. Ver "De la Fase 119" abajo.
- **Barrido visual real** (Playwright local, `seed:demo`: 7 pestañas ×
  claro/oscuro × 1366×768/1920×1080/2560×1440/móvil 412px + estados
  mes-sin-datos/mes-incompleto/0-filas): sigue sin cubrirse — pedido de
  nuevo en la Fase 119 y tampoco alcanzó el tiempo. Prioridad alta para
  la próxima sesión disponible.
- **Barrido de código muerto** a partir del grafo de `graphify`: sigue
  sin cubrirse (pedido de nuevo en la Fase 119).
- ~~Casos de borde del reemplazo por rango~~ — **cubiertos en gran parte
  en la Fase 119**: otra campaña con las mismas fechas no se toca AL
  ESCRIBIR, orden inverso, falla a mitad de carga inyectada (las 7
  bases), archivo equivocado en la ventana equivocada, fecha futura
  (dinámico, las 4 bases que faltaban). Ver
  `server/tests/fase119-cargas-multi-mes.test.js`. Sin cubrir todavía:
  archivo de un solo día explícito, re-subida idéntica con aserción de
  "0 cambios" fila por fila (hoy solo se confirma el conteo), archivo
  grande de varios meses a la vez (límite de payload por base más allá
  de Tipificación, que ya lo tenía).
- **XSS con texto malicioso real** (Playwright local): sigue sin
  cubrirse con pruebas dinámicas (pedido de nuevo en la Fase 119) — Fase
  102 confirmó por lectura de código que `esc()`/`xlsxFilasSeguras`
  cubren todos los módulos, pero eso no es un ataque real ejecutado
  campo por campo.
- ~~Zonas horarias~~ — **hecho en la Fase 119**: confirmado con
  ejecución real (2 procesos Node, TZ=UTC y TZ=America/Bogota) que
  `fecha-limites.js`/`fecha-limites-logic.js`/`tipificacion-logic.js` dan
  el mismo resultado bajo las 2 zonas horarias, con un defecto simulado
  para confirmar que la prueba no es vacía. Ver
  `server/tests/fase119-zonas-horarias.test.js`.
- **Fallas y carreras de UI** (500/red cortada/respuesta vacía en cada
  pestaña, cambio rápido de pestaña/mes): sigue sin cubrirse (pedido de
  nuevo en la Fase 119).
- ~~Las 7 familias de carga masiva fuera de la matriz de acceso
  dinámica~~ — **hecho en la Fase 119**: ejecutadas de verdad contra los
  10 roles × propia/ajena. Ver "De la Fase 119" abajo (incluye un
  hallazgo real, documentado más abajo).
- **Hallazgo real corregido en la Fase 118**: un test de la Fase 117
  (desempate de `GET /historial` en empates de milisegundo) resultó
  flaky en CI por un filtro de verificación demasiado amplio — corregido
  (severidad baja, detalle en `docs/auditoria-seguridad-fase102.md` →
  Fase 118).

## De la Fase 119 (dejar ORLANT lista para entregarla al cliente)

- **Hallazgo real, severidad BAJA/informativa, documentado y NO
  corregido** (motivo abajo): `POST /calidad/trafico/carga` (Tráfico de
  Llamadas) es la ÚNICA de las 7 familias de carga masiva cuyo endpoint
  no exige `campaignAccess` por campaña puntual — solo el permiso
  genérico `canLoadData` ("Cargar Datos"). Confirmado con una prueba
  dedicada: un actor con `cargarDatos` pero solo acceso a ORLANT puede
  cargar Tráfico de Llamadas mapeado a OTRA campaña (mapeando una skill
  nueva a ella), mientras que las otras 6 familias bloquean esa misma
  combinación. No es un descuido — es una decisión EXPLÍCITA y ya
  documentada de una auditoría anterior (`server/routes/trafico.js`,
  comentario "Decisión explícita (auditoría 2026-09-15)"): un solo
  archivo de Tráfico de Llamadas trae varias skills que pueden resolver
  a campañas distintas vía el mapeo de `trafico-skills.js`, así que el
  body de esta ruta nunca cargó `campana` explícita. **No se corrige en
  esta fase** porque arreglarlo exigiría rediseñar el modelo "un
  archivo, varias skills de varias campañas" que Edwin pidió
  explícitamente, y el riesgo real hoy es mínimo (CLINICA AURORA y
  Hospital La María siguen en cero datos reales). Ver
  `server/tests/fase119-matriz-cargas-masivas.test.js`.
- **Recorrido en producción con la cuenta REAL del cliente de ORLANT**
  (`CLIENTES_DASH`): confirmado por JWT (no es admin, no es `null`) —
  solo ve su dashboard de ORLANT; los 7 endpoints administrativos
  probados (`/historial`, `/seguridad/alertas`, `/dashboards/config`,
  `/dashboard/cargas`, `/inventario/items`, `/gerencia/kpis`,
  `/gh/personal`) dan 403; las 7 pestañas cargan con datos y Exportar
  funciona en las 7; las 5 pestañas ocultas (Ordenamiento Médico,
  Recuperación de Cancelados, Flujo Mensual, Salida, Gestión STA) NO
  aparecen; sin ningún aviso "demo"/dato de prueba visible; Calidad:
  catálogo de codificaciones vacío (0), 37 monitoreos (sin tocar, esperan
  confirmación de Edwin); "Cambiar mi contraseña" visible y rechaza una
  contraseña actual incorrecta.
- **Recorrido de ADMIN no se repitió en esta sesión de la Fase 119** (la
  cuenta del cliente se usó varias veces seguidas en la ventana
  pensada para admin) — se apoya en la confirmación completa de ese
  mismo recorrido horas antes, en la Fase 118, mismo día, sin cambios de
  código de `server/`/`public/` de por medio.
- **"Calendario mensual de cargas"** (`docs/guia-uso-orlant.md` → sección
  5): 4 de 8 filas ("quién la manda"/"de qué sistema sale" para Tráfico
  de Llamadas, Tráfico de WhatsApp, Tipificación y Agendas) siguen
  marcadas explícitamente "Por confirmar" — no se resolvieron en esta
  fase porque dependen de que Edwin las precise, no de nada que se
  pueda verificar desde el código. Sigue pendiente de Edwin.

## De la Fase 120 (verificación dato por dato + AHT de WhatsApp)

- ~~Verificar en producción, dato por dato (no solo totales), los 3
  archivos reales que envió InCo~~ — **hecho**: 150/150 filas de Tráfico
  de Llamadas, 258/258 de Tráfico de WhatsApp, 34.661/34.661 de
  Tipificación (por skill × mes), 0 duplicados, 0 diferencias contra la
  API en vivo. Ver `scripts/produccion/revision-final.js`.
- ~~Abrir cada sub-pestaña de las 7 pestañas de ORLANT (no solo la que
  abre por defecto)~~ — **hecho**, el hueco estructural que señaló el
  usuario (Fases 112-119 no lo cubrían de forma explícita): todas
  dibujan algo real o muestran un mensaje claro, ninguna en blanco.
- ~~AHT de Tráfico de WhatsApp~~ — **quitado** (ver más arriba, "De
  Edwin").
- **Hallazgo real corregido**: el ATA (tiempo promedio de abandono) de
  Tráfico de Llamadas Y de WhatsApp se promediaba ponderado por el TOTAL
  de llamadas/WhatsApp, en vez de por cuántas realmente se abandonaron —
  un día de mucho volumen y pocos abandonos diluía el promedio hacia
  abajo. Corregido en `public/js/trafico-logic.js` y
  `public/js/trafico-whatsapp-logic.js`; efecto numérico medido contra
  el archivo real: agosto pasa de 350,92 s a 625,13 s en Llamadas (ver
  `CHANGELOG.md` v1.12.0).
- **Hallazgo documentado, NO corregido** (fuera del alcance pedido):
  `traficoWppResumen` (`public/js/trafico-whatsapp-logic.js`) es una
  función sin ningún llamador en el código de producción (solo la
  referencian sus propios tests) que pondera ASA/ATA por el total en vez
  de por contestados/abandonados — el mismo defecto que se corrigió en
  las funciones que SÍ se usan. Al no estar conectada a ninguna pantalla
  no afecta nada visible hoy, pero conviene decidir si se borra (código
  muerto) o se corrige igual para que no quede una trampa si alguien la
  conecta más adelante.
- **No se llegó a cubrir en esta fase** (quedan de las Fases 118/119,
  sin empeorar ni resolverse):
  - Barrido visual completo con Playwright (claro/oscuro ×
    1366×768/1920×1080/móvil 412px × mes con/sin datos, abriendo cada
    sub-pestaña una por una): se verificó a mano, con el navegador real,
    el caso concreto de esta fase (AHT de WhatsApp oculto + export sin
    la columna, con una base sintética que imita el archivo real de
    Wolkvox) contra un servidor local corriendo de verdad — no la matriz
    completa de viewports/temas que pedía el usuario.
  - Barrido de código muerto a partir del grafo de `graphify` (aparte
    del hallazgo puntual de `traficoWppResumen` arriba, que salió de
    revisar el código tocado en esta fase, no de un barrido completo).
  - XSS con texto malicioso real (Playwright dinámico) y fallas/carreras
    de UI (500/red cortada, cambio rápido de pestaña o mes).
