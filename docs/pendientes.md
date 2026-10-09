# Pendientes (reorganizado Fase 124, 2026-10-06; reorganizado de nuevo en 3 bloques en la Fase 137, Parte D)

Un solo lugar para lo que falta, en 3 bloques: (1) esperando una
decisión tuya, (2) esperando una respuesta de Edwin, (3) técnico, sin
dueño (deuda técnica con costo/riesgo ya estimado, nadie tiene que
decidir nada, solo priorizar cuándo invertir el tiempo). Lo ya cerrado
no se deja aquí — queda en `docs/historico/progress-fases.md`. Cada
ítem tiene prioridad, cómo se cierra, y la fecha en que se anotó.

## 1. Esperando una decisión tuya

- **Contraseña temporal del usuario CLIENTES_DASH** — Prioridad ALTA.
  Cómo se cierra: la cambias desde la propia plataforma (nunca queda en
  el repo/commits/logs). Anotado 2026-10-02 (Fase 112), sigue sin
  hacerse. Efecto concreto más reciente: la verificación de cierre de
  la Fase 137 (Parte C) no pudo confirmar el lado CLIENTES_DASH de
  producción (`scripts/produccion/revision-final.js` espera 2 sesiones,
  una por cada rol) — solo se verificó ADMINISTRADOR, en verde.
- **Visibilidad de nombres de asesor para CLIENTES_DASH** — Prioridad
  ALTA. Desde la Fase 122, Agendas y Efectividad de Agendamiento
  muestran el nombre real del asesor a cualquier rol con acceso a
  ORLANT, incluido CLIENTES_DASH. Desde la Fase 130, Calidad también (el
  panel "Promedio de calidad por asesor" hereda el mismo filtro de
  acceso por campaña que el resto del dashboard, sin permiso nuevo).
  Cómo se cierra: decides si la cuenta del cliente debe seguir viendo
  esos nombres o si hay que redactarlos para ese rol. Anotado
  2026-10-06 (Fase 124), actualizado 2026-10-07 (Fase 130).
- **Exports reales (Excel) de Tipificación, Efectividad de Agendamiento,
  Efectividad de Citas y Agendas: abrir el archivo en Excel/LibreOffice
  de verdad** — Prioridad MEDIA. Un parser de ZIP/XML independiente
  (Fase 125) ya confirmó 3 de los 4 exports (formato válido, cifras
  correctas, sin PII, fórmulas neutralizadas en el archivo) — falta
  Efectividad de Citas y Tipificación de WhatsApp, y el único paso que
  sigue siendo manual en cualquier caso: abrirlo en la aplicación real
  (el parser confirma el contenido, no reemplaza esa revisión).
- **Export a Excel del panel "Promedio de calidad por asesor"** —
  Prioridad BAJA. Queda fuera del botón "Exportar" a propósito (una
  superficie de privacidad nueva que nadie pidió todavía). Cambio chico
  si lo pides (`_gdExportarCalidad`, `dashboard-generic.js`).
- **`.github/workflows/fase134-dry-run.yml` sin subir al repo** — el
  workflow del dry-run de la Fase 134 (toca AWS/SSH) quedó escrito pero
  nunca se commiteó (ver Fase 137, Parte A, PR #381). Prioridad BAJA (la
  migración que habría probado ya se desplegó y se verificó sin pérdida
  de datos). Cómo se cierra: decides si lo subo (el script ya fue
  revisado, solo imprime conteos) o si lo descarto del todo.
- **Flujo Mensual**: ¿se retira del todo (código + pestaña oculta) o se
  deja esperando? Prioridad BAJA. Anotado Fase 115, sigue sin decidirse.
- **Tráfico de Llamadas sin `campaignAccess` en la carga** (solo
  `canLoadData` genérico) — hallazgo de severidad BAJA, re-confirmado en
  la Fase 124. Es la única de las 7 familias de carga masiva sin ese
  control puntual — decisión explícita ya documentada (un archivo de
  Tráfico trae varias skills que pueden resolver a campañas distintas).
  Arreglarlo exige rediseñar ese modelo — **no se toca sin tu OK
  explícito**. Riesgo real hoy: bajo (Aurora/HLM siguen en cero datos).
- **F10 (auditoría UI Fase 135) — iconos emoji del menú lateral** (ej.
  Usuarios, Inventario). Prioridad BAJA. No se tocó en la Fase 136 por
  decisión explícita tuya: es una decisión de marca (seguir con emoji
  vs. un set de iconos propio), no un defecto de UI — tu postura: no
  antes del demo de Mobilize (mediados de octubre).
- **Limpieza de `.atab{transition:all 0.2s}`** (Fase 137, Parte E) —
  Prioridad BAJA. Confirmado que NO es la causa del bug de Escape ya
  resuelto (ver bloque técnico) — sigue siendo una limpieza de estilo
  válida por separado. Pospuesta hasta después del demo de Mobilize,
  solo si escribes "OK limpieza atab".
- **Limitador de la API para tráfico SIN sesión — sigue por IP, no por
  usuario** — Prioridad BAJA/MEDIA. La Fase 130 (Parte 7) separó el
  limitador en 2 cupos: quien ya inició sesión cuenta por usuario (sin
  compartir cupo con compañeros de oficina); quien todavía no inició
  sesión sigue contando por IP. Eso resolvió el caso real que disparó la
  fase (una revisión administrativa agotando el cupo de toda una
  oficina) pero deja un caso más chico abierto (varias personas
  iniciando sesión casi al mismo tiempo desde la misma IP). 3 opciones
  anotadas en `docs/historico/progress-fases.md` (Fase 130) para cuando
  quieras cerrar esto también — ninguna aplicada todavía.
- **Inventario y respaldo de la cuenta AWS vieja** (`934685482338`) +
  **Política 1 de IAM pendiente** (`s3:ListBucket`+`s3:GetObject`
  acotado, bloquea la prueba real de restauración de backups) — ambos
  necesitan credenciales de AWS que solo tú tienes a mano, sin empezar.
- **Dependencias mayores congeladas** (`better-sqlite3` 13, `dotenv`
  18) — no se tocan sin que lo pidas explícitamente.

## 2. Esperando una respuesta de Edwin

- **19 asesores del archivo real de Calidad sin usuario ASESOR en la
  plataforma** — Prioridad MEDIA. La carga masiva de Calidad guarda el
  nombre como texto libre, nunca requiere un usuario — no bloquea
  nada — pero esos 19 asesores no pueden ver su propia nota ("Mis
  Resultados") porque no tienen cuenta. Se crean (rol ASESOR, campaña
  ORLANT) cuando Edwin lo pida — no se crean solos.
- **Ordenamiento Médico, Recuperación de Cancelados, Flujo Mensual,
  Gestión STA** — Prioridad BAJA (pestañas ya construidas, ocultas
  esperando el archivo real). Ver `docs/inventario-bases-orlant.md`.
- **Pregunta a Edwin: efectividad de agendamiento > 100%** — Prioridad
  MEDIA. Varios asesores quedan por encima de 100% en los archivos
  reales de ago-sep/2026 (confirmado, no es error de carga; Chart.js
  autoescala el eje sin recortar nada). Pregunta de negocio: ¿agendan
  por fuera de las gestiones que se están contando?
- **Pregunta a Edwin: "hay que quitar esa letra"** — Prioridad BAJA.
  Mención suelta en la reunión del 2026-10-05, sin precisar a qué se
  refería.
- **Nivel de servicio de WhatsApp/Tráfico a 5 minutos, y AHT de
  WhatsApp** — Prioridad MEDIA. Ambos se retiraron de pantalla (el
  cálculo sigue en el código) porque el export real de Wolkvox no trae
  esas columnas — Edwin lo habla con el jefe/Wolkvox. Si algún día
  llegan, reactivarlos es solo un flag en `PUT /dashboards/config/
  ORLANT` (`mostrarAht`/`mostrarSL5min`), sin tocar código.
- **Nivel de servicio** (posible base aparte que mencionó Edwin) —
  Prioridad BAJA. Aclarar con él si se refiere a algo distinto de lo
  que ya existe (SL 20s en Tráfico).
- **Indicador de Llamadas y WhatsApp de salida — 3 preguntas sin
  responder** (pestaña ya construida y en producción, Fase 127/128):
  - **Denominador del %**: Edwin pidió un indicador simple con
    porcentaje "si aplica" pero nunca dijo contra qué base. Hoy la
    plataforma solo muestra lo que no requiere inventar un denominador
    (total del mes, variación contra el mes anterior, participación
    3P/General dentro del total del mismo mes).
  - **Qué significa "3P" en Salida**: se asume el mismo criterio que en
    el resto de la plataforma (Línea 3P vs. Línea General), nunca
    confirmado explícitamente para esta pestaña.
  - **Total acumulado del período** (mencionado por Edwin, a futuro —
    NO implementar todavía, sin alcance ni fecha definida).
- **Plantillas oficiales versionadas** (carpeta que Isabel pueda
  descargar/pegar/subir sin ayuda de InCo) — pedido explícito de Edwin:
  "eso lo vemos después de la entrega". Ver
  `docs/plantillas-inventario.md` para el inventario que esa fase va a
  necesitar — necesita reunión con Edwin e Isabel.
- **Logo de Mobilize: provisional, falta el original en alta
  resolución** — Prioridad BAJA (ya en producción, no bloquea nada). El
  que se usa hoy (688×124) se ve bien solo hasta ~150px de ancho.
  Cuando llegue el original de Edwin, se regenera igual que el logo de
  InConexion (Fase 132).

## 3. Técnico, sin dueño (costo y riesgo ya estimado — nada se aplica sin pedirlo)

- **Lección de la Fase 126 — "conteo de filas" no es lo mismo que
  "categorías distintas"**: un proxy liviano ("especialidades distintas
  por mes") subestimó por mucho el conteo real de filas antes de un
  borrado — el candado `filasEsperadas` del endpoint de borrado detectó
  la discrepancia solo y abortó sin borrar nada. Para una próxima fase
  que necesite "cuántas filas hay": usar el dry-run del endpoint de
  borrado (o un `COUNT(*)` equivalente), nunca un conteo de categorías
  distintas como proxy.
- **`scripts/produccion/revision-final.js` no cubre todavía ATA (voz y
  WhatsApp) ni el desglose mes a mes de Tipificación de WhatsApp ni de
  Tráfico** — confirmado al revisar el script a fondo en la Fase 125:
  solo arma totales agregados del período. No es un defecto de la
  plataforma (esos valores sí se confirmaron a mano, ver `PROGRESS.md`),
  es una brecha de cobertura del script. Costo: bajo-medio.
- **Límite de tamaño por carga** — tabla de bytes/fila medidos/estimados
  por ruta y un aviso del lado del cliente (si el payload estimado
  supera el 85% del límite de su ruta, avisa antes de enviar) ya viven
  en `docs/historico/progress-fases.md` (Fase 125). Regla práctica:
  subir un mes a la vez; si hay que subir varios meses juntos, partir el
  archivo por mes antes de cargar.
- **No hay UI de administración para alias de asesor** — hoy el alta,
  lista y borrado de alias solo existen por API directa, nunca desde una
  pantalla. Costo de una pantalla simple (mismo patrón que el catálogo
  de codificaciones de Calidad): medio. Riesgo: bajo.
- **Alias de asesor no se aplica en Calidad** (el campo `ASESOR` de la
  carga masiva de monitoreos) — confirmado por código
  (`aplicarAliasAFilas` nunca se llama desde Calidad). Severidad baja
  (solo la carga masiva opcional, no el registro manual). Costo de
  extenderlo: bajo (mismo patrón, una línea más).
- **`npm test` local se vuelve inestable en algunas máquinas** —
  decenas de `ETIMEDOUT` en una corrida completa de supertest, sin
  imprimir el resumen final. No es un bug de esas pruebas (la misma
  suite corre en verde en CI, Node 22, en cada PR) — es un límite de
  recursos de la máquina. **CI (Node 22) sigue siendo la referencia
  real**, como indica `CLAUDE.md` — no se investiga más a fondo.
- **Cobertura con Playwright real para las 9 bases, con archivos
  SINTÉTICOS con la forma exacta de los reales** — no construido, es en
  sí mismo un proyecto de varios días (un arnés nuevo por base). Costo
  estimado: alto (días). Riesgo de no tenerlo: medio — ya se demostró
  que un defecto puede pasar pruebas unitarias en verde y solo aparecer
  con el archivo real en la página real. Propuesta: empezar por las 2
  bases que ya mostraron defectos reales (Tipificación de WhatsApp,
  Agendas), no las 9 de una vez.
- **Fallas de red/500/carreras de la interfaz** (cerrar el modal a mitad
  de carga, token vencido a mitad de una carga, archivo corrupto) — no
  cubierto, mismo motivo de alcance (arnés Playwright grande con
  interceptación de red). Costo: medio-alto. Riesgo de no tenerlo:
  bajo-medio (las escrituras ya usan `db.transaction`, confirmado por
  código en las 9 bases). El doble clic en "Confirmar carga" sí está
  cubierto por construcción (`withButtonLoading()` deshabilita el botón
  de forma síncrona antes de cualquier `await`) — sin test automatizado
  que lo fije como regresión todavía.
- **Casos de borde del reemplazo por rango, matriz completa × 9 bases**
  (archivo de 1 solo día, skill nueva, cruce de mes, re-subida idéntica,
  fecha futura, atomicidad con falla inyectada) — cubierto parcialmente
  (las 7 bases principales, Fase 119), no se completó la matriz entera.
  Costo de completar lo que falta: medio.
- **XSS dinámico campo por campo — ejecutado parcialmente** (Fase 125,
  con Playwright real y payloads reales en Agendas, Efectividad de
  Agendamiento y Tipificación de Llamadas: 0 diálogos/elementos
  inyectados reales, fórmulas neutralizadas en el Excel exportado,
  releído con un parser independiente). Falta: campos de Agendas que no
  se renderizan en ninguna vista hoy, el campo SKILL de Tipificación, el
  canal WhatsApp, el nombre de archivo en Historial, Calidad, y el
  export a PDF. Costo de cerrar el resto: bajo (mismo patrón ya probado,
  `esc()`/`xlsxFilasSeguras`, sin ninguna ruta de renderizado distinta
  conocida para lo que falta).
- **Barrido de código muerto completo con `graphify`** (funciones/
  archivos sin referencias, estilos sin uso, endpoints sin cliente) —
  pedido desde hace varias fases, sigue sin alcanzar el tiempo.
- **Barrido visual completo** (claro/oscuro × 3 resoluciones × mes con/
  sin datos, todas las pestañas × todas las sub-pestañas, revisión
  humana una por una) — ya cubierto por chequeos automáticos (consola +
  canvas con píxeles, 0 hallazgos), pero no por ojo humano en cada
  combinación. Queda para después si se quiere ese nivel de detalle.

## Decisiones de esta fase (sin pendiente — ya resueltas, quedan aquí solo como referencia)

- **Observaciones de Calidad** (`# Teléfono`/`ID-Llamada-Wpp` en
  `monitoreos`, contradice la regla de "nunca guardar # Teléfono"): tu
  decisión 2026-10-07 fue dejarlo así por ahora. Sin cambios.
- **F07 (agrupar las 4 acciones por fila de Usuarios)**: hecho en la
  Fase 137, Parte B — ver `docs/auditoria-ui-fase135.md`, tabla de
  estado final.
- **Fase 134 (borrado de 12 clientes sin datos reales)** y el **bug de
  Escape que cerraba el dashboard de ORLANT entero** (Fase 136/137):
  ambos resueltos — detalle completo en
  `docs/historico/progress-fases.md` y en la tabla de estado de
  `docs/auditoria-ui-fase135.md`.
- **Clínica Aurora / Hospital La María**: ya no existen en la
  plataforma desde la Fase 134 (se borraron junto con los otros 10
  clientes sin datos reales) — no es un pendiente operativo.
