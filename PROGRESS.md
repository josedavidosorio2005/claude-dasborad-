# PROGRESS — InConexión Platform

Fuente de verdad del avance. Desde la Fase 112, este archivo es un
**resumen corto, que se actualiza en el sitio** (no aditivo) — el detalle
narrativo de cada fase, fase por fase, vive en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
(aditivo, nunca se reescribe — ver `CLAUDE.md` → "Bitácora").

## Estado actual

- **Versión**: `1.17.0` (ver `server/package.json`, expuesta en
  `/api/health` y en el menú de usuario de cada página).
- **Producción**: `https://informa.inconexion.com.co` (único dominio
  desde la Fase 93, 29/09/2026).
- **Foco actual**: solo **ORLANT** tiene datos reales en producción.
  Clínica Aurora y Hospital La María siguen en cero. **Desde la Fase 126**
  (pedido explícito de Edwin: "todos los datos que yo no le haya pasado...
  como pruebas en las plantillas, hay que quitarlo"), ORLANT solo tiene
  **agosto y septiembre de 2026** en todas sus bases (más julio de
  Tipificación de WhatsApp, real) — los meses de prueba (Ene-Jul/2026 en
  Inasistencia, Ene-Mar/2026 en Efectividad de Citas, Abril/2025 en
  Agendas) se borraron por la interfaz, con un endpoint nuevo de solo
  administrador (`POST /api/admin/borrado-rango`, dry-run + conteo exacto
  obligatorio).
- **Pestañas y bases de ORLANT**: 8 pestañas con datos reales (Tráfico de
  Llamadas, Tráfico de WhatsApp, Tipificación, Agendas, Inasistencia,
  Efectividad de Agendamiento, Efectividad de Citas, **Llamadas y
  WhatsApp de salida** desde la Fase 127 — renombrada y reubicada junto
  a Tráfico de WhatsApp en la Fase 128) + Calidad transversal — detalle
  completo (hoja, columnas, de dónde sale, qué pestaña alimenta) en
  [`docs/inventario-bases-orlant.md`](docs/inventario-bases-orlant.md).
  Pestañas ocultas esperando datos de Edwin: ver
  [`docs/pendientes.md`](docs/pendientes.md).
- **Infraestructura**: estado vigente (cuenta AWS, recursos, pipeline) en
  [`docs/infraestructura.md`](docs/infraestructura.md).
- **Pendientes**: un solo lugar, [`docs/pendientes.md`](docs/pendientes.md)
  (reorganizado en la Fase 124 en 5 secciones: antes de entregar a Edwin,
  esperando a Edwin, esperando decisión de InCo, técnico con costo/riesgo,
  después de la entrega).
- **Mapa de la documentación**: [`docs/README.md`](docs/README.md)
  (Fase 124) — qué hay en `docs/`, qué es vigente y qué es histórico.

### Números de control (ORLANT, última verificación completa Fase 130, 2026-10-07)

**Fase 130** corrió `revision-final.js` contra producción real, las 2
cuentas (ADMIN y CLIENTES_DASH, con sesión real de cada una): las 8
pestañas dibujaron algo real, 0 canvas en blanco, 0 errores de consola,
0 peticiones fallidas, exports disparados en las 8, y **0 discrepancias
en los números de control de abajo**. 0 nombres reales en ningún
reporte (confirmado línea por línea antes de mostrar nada al usuario).
Inasistencia de septiembre pasó del agregado viejo (1.483 citas, 1 sola
"especialidad") al archivo real por cita (12.194 citas, 19
especialidades) — Parte 2 de esta fase. Calidad de ORLANT tiene ahora
los 95 monitoreos reales de septiembre/2026 (confirmado ya cargados al
retomar esta fase, no hizo falta cargar nada en esta sesión) y una
gráfica nueva (nombre + % promedio por asesor, Parte 6). Esta misma
fase (Parte 7) también corrigió el limitador de tasa de la API: antes
contaba solo por IP, así que una oficina entera (o una revisión
administrativa completa, ~70 peticiones) podía agotar el cupo
compartido de todos — ahora quien tiene sesión cuenta por usuario, con
un cupo propio. Detalle completo, con los 2 traspiés reales de la
verificación (límite de tasa agotado por corridas repetidas, y 2
autocompletados del navegador que metieron la cuenta de administrador
en la ventana del cliente) en la sección de esta fase, más abajo.

Después, con el "sí" explícito del usuario sobre el conteo exacto que
mostró el dry-run (37, un solo mes, 2026-09): **se borraron los 37
monitoreos de prueba de Calidad de ORLANT** (`POST /api/admin/borrado-
rango`, base `monitoreos` nueva de la Parte 3) — `cronograma_metas` de
ORLANT ya estaba en 0 filas (nada que verificar ahí) y el Historial no
se tocó (el endpoint solo agrega un evento de resumen). Verificado
después: Calidad de ORLANT en 0 monitoreos, mensaje "Sin datos"
visible, 0 errores de consola/página/peticiones fallidas. Calidad
queda esperando el archivo real de Edwin (entrega prevista
2026-10-07).

**Fase 127** cargó en producción el archivo real de Salida de Edwin
(`FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx`) — verificado dato por
dato contra el archivo (API y pantalla), con verificación cruzada contra
el skill "LINEA DE SALIDA" de Tipificación de Llamadas (coincide exacto)
y 0 discrepancias en el resto de los números de control de abajo.

**Fase 126** borró los meses de prueba de producción por la interfaz
(`POST /api/admin/borrado-rango`, dry-run → conteo exacto → confirmar,
uno a la vez) y reconfirmó con sesión real del usuario tras cada
borrado: Efectividad de Citas (Ene/Feb/Mar-2026, 3 filas), Agendas
(Abril/2025, 7.426 filas) e Inasistencia (Ene-Jul/2026, 2.312 filas —
el inventario previo había estimado ~121 con un proxy equivocado,
"especialidades distintas" en vez de filas reales; el propio endpoint
detectó la discrepancia y abortó sin borrar hasta tener el número real y
el OK explícito, ver `docs/pendientes.md` §4). Verificado después de
cada borrado: 0 filas fuera del rango pedido, los meses ago-sep intactos
y con los mismos valores de siempre. Tabla de abajo actualizada con el
estado resultante — Efectividad de Citas y Agendas ya NO tienen un
período aparte de meses de prueba, quedan con un solo período real
(ago-sep) igual que el resto de las bases.

Fases anteriores que ya habían reconfirmado el resto (tema oscuro,
1920×1080/móvil, alias de asesor, exports, XSS, eje del combo,
`revision-final.js` dato-por-dato): Fase 124 y Fase 125 — ver
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
para el detalle narrativo de cada una. La cuenta CLIENTES_DASH sigue sin
verificar en ninguna fase reciente (no hay contraseña de cliente a
mano, ver `docs/pendientes.md` §1).

| Indicador | Valor |
|---|---|
| Tipificación de Llamadas (sin cambios desde la Fase 116) | 34.661 (Ago 14.940 / Sep 19.721) |
| Tipificación de WhatsApp (sin cambios desde la Fase 122) | 25.180 (Jul 71 / Ago 12.061 / Sep 13.048), 11 skills |
| Tráfico de Llamadas (sin cambios desde la Fase 115) | Ago 8.908/7.961/947 · Sep 9.043/8.883/160 |
| Tráfico de WhatsApp (sin cambios desde la Fase 116; aviso de SL 5 min retirado de pantalla en la Fase 126) | Ago 7.390/7.370/20, SL20 36,05 % · Sep 7.968/7.953/15, SL20 39,88 % |
| Agendas (Fase 126: Abril/2025 se borró, queda un solo período real) | 24.186 (Ago 11.040 / Sep 13.146), 20 asesores |
| Inasistencia (Fase 129: solo ago-sep, archivo real ene-ago restaurado y vuelto a limpiar de ene-jul — umbral de privacidad original. Fase 130 Parte 2: septiembre pasa del agregado viejo al archivo real por cita) | Ago-26 11.189/786/48, 7,45 %, 18 especialidades, 54 entidades · Sep-26 12.194/749/61, 19 especialidades · período (ago+sep) 7,03 % |
| Calidad (Fase 130: carga real de monitoreos de septiembre/2026 — confirmado ya cargado al retomar esta fase) | Sep-26: 95 monitoreos, 19 asesores distintos, 1 evaluador, promedio 94,79 % (82 sobresaliente, 13 no crítico, 0 crítico) |
| Efectividad de agendamiento (sin cambios desde la Fase 122) | Ago 41,17 % (11.040 / 26.814) · Sep 40,00 % (13.146 / 32.868) |
| Efectividad de Citas (Fase 126: Ene-Mar/2026 se borró; el mismo día llegó el archivo real de ago-sep, cargado por la interfaz — queda un solo período real) | Ago 11.189 agendas/7.896 atendidas · Sep 12.194/8.968 · período 72,12 % |
| Llamadas y WhatsApp de salida (Fase 127, archivo real de Edwin cargado 2026-10-06; renombrada de "Salida" en la Fase 128) | Llamadas: Ago 6.560 (3P 2.169/General 4.391) · Sep 10.404 (3P 3.530/General 6.874). WhatsApp: Ago 3.382 (3P 747/General 2.635) · Sep 3.997 (3P 1.277/General 2.720). Cruce con "LINEA DE SALIDA" de Tipificación: coincide exacto |

### Fase 131 (EN CURSO) — Cliente Mobilize (entrega: mostrar antes del 15/10) + marca InConexion®

Pedido original: Edwin revisa avances con Mobilize el 2026-10-08. Orden de
prioridad pedido: Parte 1 → 2 → 3 → 6 (lo que Edwin revisa) → 4
("Última actualización") → 5 (marca InConexion®).

**Hecho, mergeado a `main` y DESPLEGADO en producción (confirmado por
`/api/health`, no solo CI):**
- **Parte 1** (#345, v1.16.2): el cliente se escribía "MOVILIZE" en todo el
  código -- corregido a su nombre real, "MOBILIZE" (listas de
  clientes/campañas, plantilla de dashboard, plantilla de Calidad).
  Migración idempotente nueva (`cliente_movilize_renombrado_mobilize_v1`,
  `server/db.js`) renombra la fila ya sembrada en producción (en
  `dashboards_config`, `calidad_plantillas`, y cualquier tabla con datos
  por campaña/cliente) conservando cualquier personalización de admin y
  renombrando las claves de permisos de cada usuario sin tocar su valor --
  nadie perdió acceso. CI encontró 6 fallas reales (5 tests históricos que
  usaban "MOVILIZE" como placeholder de "cliente sin relación" + 1 test
  que SÍ dependía del nombre viejo por diseño) -- corregidas en el mismo
  PR, documentado en su commit.
- **Parte 2** (#347, v1.16.3): pestaña "Flujo de Llamadas" de Mobilize,
  reusando **tal cual** el motor de Tráfico de Llamadas de ORLANT
  (`trafico_combo`, `trafico-skills.js`/`trafico-logic.js`) -- mismo
  mapeo de skill a campaña. `trafico-logic.js` ganó soporte de alias de
  encabezado por columna (Mobilize trae "TIPO DE LINEA"/"DÍA"/"LLAMADAS
  INGRESADAS"/"NIVEL DE SERVICIO 80 - 20"/"% ABANDONO" en vez de los
  nombres de ORLANT -- un solo motor para los 2), ASA/ATA como texto de
  reloj (además de número), y un aviso nuevo (nunca cambia el valor) si
  NIVEL DE ATENCION o % ABANDONO superan 100% al tratarlos como fracción.
  El panel `trafico_combo` ganó opciones opcionales nuevas (`etiquetaLinea`,
  `subtabs`, `subtabsTitulos`, `resumenOcultar`, `resumenPorSeccion`) --
  sin pasarlas, ORLANT/CLINICA AURORA/HOSPITAL LA MARIA quedan exactamente
  igual (confirmado: el fixture real de ORLANT, `trafico-logic.test.js`,
  sigue 60/60 sin cambios). Con ellas, Mobilize muestra el orden pedido
  por Edwin (Resumen → Nivel de Servicio 80-20 → Abandono → ASA → AHT, AHT
  al final), "Tipo de línea" en vez de "Skill", y un resumen acumulado
  propio en cada sub-pestaña de detalle. CI encontró 1 falla real más
  (`secciones` no admite un objeto vacío, límite del schema de
  `validation.js` -- se agregó una sección placeholder "notas" sin ningún
  flujo real) -- corregida en el mismo PR.
  **Verificado dato por dato contra el archivo REAL de septiembre**
  (`PLANTILLA_DE_FLUJO_DE_LLAMADAS_MOBILIZE.xlsx`, ya en
  `C:\Users\filid\Documents\datos-inconexion\mobilize\`, confirmado solo
  estructura/conteos): 27 filas, 25 días distintos, SKILL SAC 24 + Skill
  Key Account 3, 104 ingresadas/104 contestadas/0 abandonadas -- el
  parser real de `trafico-logic.js` corrido contra el archivo da 0 avisos
  y los mismos totales exactos.
  Housekeeping de PRs: se abrieron por error 2 PRs contra el mismo branch
  (#346 contra `main` antes de que la Parte 1 mergeara -- quedó en
  conflicto por el squash-merge de GitHub; #347 apilado sobre la Parte 1).
  Se cerró #346 sin mergear (mismo branch, 0 commits exclusivos) y #347 se
  rebaseó sobre el `main` ya actualizado y se mergeó con CI verde.

- **Carga real de septiembre/2026** (v1.16.4, 2026-10-08): al preparar la
  carga con dry-run (`scripts/produccion/fase131-dryrun-carga-flujo-
  mobilize.js`) se encontro un bug real -- la pantalla "Cargar Datos de
  Dashboards" NUNCA reconocia el archivo real de Mobilize (su hoja trae un
  nombre que cambia cada export, "HistQueue<fecha>", nunca "DATA"):
  "El archivo no tiene datos en ninguna hoja reconocida", aunque el
  parser aislado (`traficoParseFilas`) ya soportara los alias de columna
  de Mobilize desde la Parte 2. Causa: `_cargasTraficoColumnas()`
  (`public/js/cargas.js`) nunca propagaba esos alias (`TRAFICO_COLUMNAS.
  aliases`) hacia `cargasEncabezadosCoinciden` (que solo lee `labelAlt`)
  -- el MISMO bug de fondo que el "HALLAZGO GRAVE" ya documentado de la
  Fase 122 en Tipificacion, esta vez en Trafico. Corregido en una linea
  (PR #349, 2 pruebas nuevas que fijan el encabezado real de Mobilize y la
  regresion exacta), desplegado y reconfirmado con el dry-run contra
  produccion real ya con el fix (reconocida como
  "reconocidaPorEncabezadosComo": "HistQueue20261007-144402", 0 avisos,
  mismos totales exactos, 0 filas escritas).
  Con el "sí" explícito del usuario (mapear las 2 líneas ANTES de cargar,
  para que nunca queden en SIN_ASIGNAR): "SKILL SAC" y "Skill Key Account"
  se mapearon a la campaña MOBILIZE (`PUT /calidad/trafico/skills/...`,
  0 filas movidas porque no existía nada previo) y se guardaron las 27
  filas reales (`scripts/produccion/fase131-carga-real-flujo-mobilize.js`).
  Verificado después, contra producción real: API
  (`/calidad/nivel-servicio/diario?campana=MOBILIZE`) en 27 filas, SAC 24
  + Key Account 3, 104 ingresadas/104 contestadas/0 abandonadas (exacto
  contra el control del archivo) y el dashboard de Mobilize mostrando la
  pestaña "Flujo de Llamadas" junto a "Calidad", sin ninguna pestaña de
  WhatsApp, 0 errores de consola.

- **Parte 3 + Parte 6** (Tipificación CDR de Mobilize + su carga real,
  v1.17.0, 2026-10-08): construida reusando el motor de ORLANT, contrato
  de 3 archivos extendido con 5 columnas NUEVAS y OPCIONALES
  (`duracionSeg`/`codAct`/`tipoInteraccion`/`hungUp`/`skillId` --
  `tipificacion-logic.js`/`tipificaciones.js`/`validation.js`, ORLANT
  nunca las trae, su comportamiento queda exactamente igual, suite
  completa 1300/1300 antes y después). Decisiones tomadas con el usuario,
  **todavía pendientes de confirmar con Edwin**: se excluyen por defecto
  las filas "PRUEBA" (lista configurable) y "conectada" en salientes =
  Regla B (codificación distinta de "Cliente_no_contesta", configurable).
  Nuevo panel de Tipificación para Mobilize (torta + tabla de mayor a
  menor + filtros de agente/skill/Entrante-Saliente/mes + 3 tarjetas de
  llamadas salientes) via 4 opciones opcionales del panel ya existente
  `tipificacion_panel` -- ORLANT sin pasarlas queda igual. Migración
  idempotente nueva (`dashboards_config_mobilize_tipificacion_tab_v1`)
  agrega el tab oculto a la fila ya desplegada de MOBILIZE.
  **Carga real de septiembre/2026 hecha y verificada en producción**: el
  archivo real (`PLANTILLA_CDR.xlsx`) trae 171 filas (104 inbound/67
  outbound_ma); tras excluir 4 de "PRUEBA" quedan **167** (103 inbound/64
  outbound_ma), 20 codificaciones distintas, `COD_ACT` siempre texto
  (confirmado con un valor real no numérico, "TIMEOUTACW"). Guardado real
  confirmado por la API (`/calidad/tipificacion/por-tipo` → 167, 11
  categorías top10+Otras; `/calidad/tipificacion/resumen-salida` → 64
  salientes/49 conectadas/15 no conectadas, exacto) y visualmente (tab
  "Tipificación" visible junto a "Flujo de Llamadas"/"Calidad", 0 errores
  de consola). No se creó ningún usuario CLIENTES_DASH de Mobilize (no se
  ha pedido).

**Sin empezar todavía:**
- **Parte 4** ("Última actualización" visible en cada dashboard).
- **Parte 5** (marca InConexion®: tipografía Quicksand, colores oficiales,
  logo — los archivos de marca de
  `C:\Users\filid\Documents\datos-inconexion\marca\` **todavía no están
  ahí**, carpeta vacía a la fecha de este resumen).

**Siguiente sesión, retomar por**: Parte 4 (marca de "Última
actualización" por cliente, hora Colombia, resaltado naranja Mobilize/
verde InConexion en los demás) y luego Parte 5 (marca InConexion®, si ya
llegaron los archivos a la carpeta de marca). Las Partes 1-3 y 6 de
Mobilize ya están hechas, mergeadas, desplegadas y con datos reales
cargados y verificados -- no hace falta repetir nada de eso.

### Fase 130 (cerrada) — Calidad real de septiembre, pedidos de la reunión del 2026-10-07, y el limitador de tasa que bloqueaba oficinas enteras

Pedido original: seguir la carga real de Calidad de ORLANT (95
monitoreos de septiembre/2026) + varios pedidos puntuales de la reunión
con Edwin del 2026-10-07 + cierre con verificación completa en
producción. 8 PRs (#336-#343):

- **Parte 2** (#336, v1.15.2): Inasistencia acepta el encabezado real
  "FECHA CITA" (con espacio, alias del ya existente) y normaliza "SEDE
  34 (AUDIFONOS)" a "SEDE 34" (antes quedaba partida en 2 valores de
  filtro). Verificado contra el archivo real por fuera del repo (lector
  independiente, sin SheetJS): Ago 11.189/2.459/786/48/7.896/18
  especialidades, Sep 12.194/2.416/749/61/8.968/19 especialidades.
- **Parte 3** (#339, v1.15.4): pedido explícito de Edwin ("quitar esos
  comentarios") — el aviso naranja de mes "incompleto" en Inasistencia
  se quitó: con archivos reales completos mes a mes, que un mes tenga
  menos especialidades que otro es variación de negocio normal, no un
  dato faltante. Los avisos "parcial" y "sin datos por el filtro" se
  mantienen, siguen siendo útiles.
- **Parte 4** (#337, v1.15.3): la carga masiva de Calidad reconoce la
  plantilla real de Edwin (encabezado agrupado antes del real, "Nombre
  del Asesor" en vez de "ASESOR", cada ítem numerado con su peso y los
  críticos con emoji) — detecta el encabezado real aunque no esté en la
  fila 0, empareja cada ítem por su número ignorando emoji/salto de
  línea/peso.
- **Cierre de scripts** (#338): subió trabajo de una sesión anterior que
  había quedado commiteado localmente sin PR — `revision-final.js`
  extendido (Inasistencia completa ago+sep, meses exactos
  `['2026-08','2026-09']`, "SEDE 34" única) + 6 scripts de un solo uso
  (inventario de meses, borrado real de Tipificación de WhatsApp de
  julio — 71 filas confirmadas por 2 caminos independientes —, carga
  real de Inasistencia ago-sep). Corregido por construcción: uno de los
  6 scripts reinventaba su propio bloqueador de red de dry-run en vez de
  usar `lib/dry-run-seguro.js` (regla fija desde el incidente de la Fase
  129) — se generalizó el helper con un allowlist de rutas adicionales.
- **Cierre carga Calidad** (#340, v1.15.5): hallazgo real al intentar la
  carga de los 95 monitoreos reales — el archivo trae, muy por debajo de
  los datos reales, ~126 filas de plantilla con la fórmula del puntaje
  ya copiada pero nunca diligenciada (sin asesor), y eso tumbaba TODA la
  hoja ("no tiene datos en ninguna hoja reconocida"). Corregido por
  construcción: una celda con fórmula sin valor solo cuenta como error
  si su fila SÍ tiene el campo identificador (asesor) lleno — una fila
  de plantilla vacía nunca lo tiene, una fila real rota siempre lo tiene.
- **Cierre observaciones** (#341, v1.15.6): segundo hallazgo real de la
  misma carga — el campo "Observaciones" rechazaba notas de más de 200
  caracteres (4 de las 95 filas reales superan ese límite, máximo real
  235). Subido a 500 caracteres, mismo límite que ya usa Inventario. De
  paso, corrigió un bug del propio script de cierre (no de la app): su
  bloqueador de red comparaba la ruta `/monitoreos/bulk` literal, pero
  el servidor la expone bajo `/api` — abortaba el guardado real
  disfrazado de "no se pudo conectar con el servidor".
- **Nueva gráfica** (#342, v1.16.0): pedido de Edwin — en Calidad, además
  de los indicadores y la torta de siempre, una barra horizontal con el
  nombre de cada asesor y su % promedio de puntaje (sin número de
  monitoreos), respetando el mismo filtro de mes que sus 2 hermanos.
  Aprobado con 3 condiciones (acceso igual al resto del dashboard,
  selector de mes respetado por construcción, probado con datos
  ficticios antes de tocar producción) — las 3 confirmadas.

**Verificación de cierre** (continuación de esta misma fase,
2026-10-07): al retomarla, los 95 monitoreos reales de septiembre YA
estaban en producción (confirmado solo lectura: 95 total / 19 asesores
distintos / 1 evaluador / 94,79 % promedio — 82 sobresaliente, 13 no
crítico, 0 crítico — exacto contra lo esperado), así que no hizo falta
cargar nada en esta sesión.

- **Parte 7** (#343, v1.16.1) — hallazgo real: `revision-final.js`
  agotó el límite de tasa global de la API (300 peticiones/15min, SOLO
  por IP) a mitad de una corrida, el mismo día que el usuario reportó
  que varios clientes reales veían "demasiadas peticiones"/"demasiados
  intentos" en el uso normal. Diagnóstico (solo lectura, con login
  real): `trust proxy` ya estaba bien configurado (confirmado contra
  producción: la IP que ve el servidor es la real del cliente, no la
  interna de Caddy) — la causa real era contar solo por IP, así que una
  oficina entera comparte un único cupo. Corregido: el límite general de
  la API se dividió en 2 cupos mutuamente excluyentes (autenticado por
  USUARIO, 1.500/15min por defecto; sin sesión por IP, sin cambios,
  300/15min); el login ahora cuenta por IP + usuario intentado (antes
  solo IP), con el máximo bajado de 20 a 10 (ya no hace falta un número
  alto por usuario) y un mensaje que dice los minutos exactos que faltan
  para reintentar. 2 tests nuevos confirman que 2 usuarios distintos
  desde la misma IP ya no se bloquean entre sí (en login y en la API
  general). Desplegado y confirmado en producción (`/api/health` →
  `1.16.1`).
- **Verificación final con `revision-final.js`** (después del deploy de
  la Parte 7): el bloque ADMIN corrió 2 veces, idéntico — `ok:true`, 0
  discrepancias en los números de control, 0 canvas en blanco, 0
  errores de consola, exports disparados en las 8 pestañas, integridad
  de Inasistencia correcta (solo ago-sep, "SEDE 34" única). El bloque
  CLIENTES_DASH tuvo 2 traspiés reales antes de completarse: en las
  primeras 2 corridas de esta misma sesión, la segunda ventana no llegó
  a completarse porque la cuota de tasa (recién diagnosticada en la
  Parte 7) se agotó a mitad de camino; ya con el fix desplegado, las 2
  primeras aperturas de la ventana del cliente detectaron por error la
  cuenta de ADMINISTRADOR (autocompletado del navegador llenando el
  usuario "admin" antes de que se corrigiera a mano — el mismo patrón ya
  documentado en el propio script desde la Fase 119). Al tercer intento,
  CLIENTES_DASH se verificó completo: `ok:true`, las 8 pestañas
  visibles, 0 canvas en blanco, 0 avisos de demo, "Llamadas y WhatsApp
  de salida" junto a "Tráfico de WhatsApp", Calidad visible con los 95
  monitoreos (sin nombres), cambio de contraseña visible y rechaza una
  contraseña actual incorrecta, las 7 rutas de escalada de privilegios
  probadas bloqueadas con 403, 0 errores de consola.

**No verificado / pendiente de decisión en esta fase** (anotado en
`docs/pendientes.md`, con dueño y prioridad):
- 19 asesores reales de Calidad de septiembre sin usuario ASESOR en la
  plataforma (dueño InCo/Edwin) — la carga masiva nunca los exige.
- `# Teléfono` e `ID/Llamada-Wpp` guardados en `monitoreos` — decisión
  del usuario 2026-10-07: dejarlo así por ahora, sin tocar.
- Preguntas abiertas de "Llamadas y WhatsApp de salida" (denominador del
  %, si "3P" significa lo mismo que en el resto de la plataforma,
  acumulado del período) — esperando respuesta de Edwin.
- Export a Excel del panel nuevo de Calidad — decisión pendiente,
  excluido del botón "Exportar" a propósito (superficie de privacidad
  nueva que nadie pidió todavía).
- Riesgo residual del limitador de tasa: el tráfico SIN sesión (login,
  `/health`) sigue contando por IP, sin cambios — 3 opciones anotadas
  para una decisión futura si hace falta cerrarlo también.

Versión final `1.16.1`. Detalle narrativo completo (incluidos los 2
traspiés de la verificación, con su causa exacta) en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md).

### Fase 129 (cerrada) — incidente real de escritura accidental + 2 hallazgos reales corregidos, Inasistencia restaurada

Pedido original: recargar Inasistencia de ORLANT (solo agosto). Durante
la preparación, un script de dry-run escribió en producción por
accidente sin el "sí" del usuario ni respaldo previo (`page.exposeFunction`
envuelve el retorno en una Promise, siempre *truthy*, así que el guard
de la app nunca cortó). Impacto real: sin pérdida de datos (el archivo
era byte-idéntico al ya cargado en la Fase 108), solo cambió el umbral
de privacidad de entidades. Corregido por construcción con 2 defensas
independientes (`scripts/produccion/lib/dry-run-seguro.js`). Auditoría
de privacidad completa (`git log --all`): el script que imprimió
`opciones.entidades` crudo nunca se commiteó/pusheó/entró a un PR o a
CI — solo existió en stdout local, ya scrubado. Regla generalizada +
prueba estática nueva en CI (`fase129-scripts-produccion-sin-texto-crudo.test.js`)
para cualquier script de `scripts/produccion/` que reenvíe crudo un
endpoint `.../opciones`.

Hallazgo real nuevo, encontrado al preparar la restauración (v1.15.1,
parche): subir el archivo completo de Inasistencia (varios meses)
fallaba con "ninguna fila válida" — una celda FECHA_CITA con formato de
fecha de Excel llegaba como objeto `Date` nativo en vez de número, por
un efecto secundario de `cellNF:true` (necesario para Tráfico, no
relacionado con `cellDates`); corregido en `inasistencia-logic.js`
(getters LOCALES, nunca UTC). El mismo patrón late en 8 módulos más
(agendas/calidad/citas-atendidas/efectividad-agendamiento/tipificación/
tráfico/tráfico-WhatsApp/metas) — **no tocados en esta fase, pendiente
de decisión** (riesgo documentado, no corregido).

Con el fix desplegado (v1.15.1 en producción), se restauró Inasistencia
al alcance de privacidad original (Opción B, aprobada y ejecutada con
"sí" explícito en cada paso, respaldo manual confirmado antes): Paso 1,
se re-subió el archivo real completo ene-ago (2.664 filas, confirmado
exacto contra el preview antes de guardar) — agosto quedó en
352 filas/54 entidades/11.189 citas/786 inasistencias/7,45 %, igual que
la Fase 108 original; septiembre no se tocó (reemplazo por mes, nunca
toca meses fuera del archivo). Paso 2, dry-run del borrado por rango
(mismo endpoint auditado de la Fase 126, base `inasistencia` únicamente
— no puede tocar otra tabla por diseño, y se cruzó además con una
lectura independiente de Tipificación de WhatsApp de julio) confirmó
exactamente 2.312 filas antes de borrar; con el "sí", se borraron esas
2.312 filas de ene-jul. Verificación final: Inasistencia solo con
ago-sep (ago 352/54/11.189/786/7,45 %, sep 1.483/94/2 sin cambios),
Tipificación de WhatsApp de julio sigue en 71, 2 sub-pestañas con
dibujo real, 0 errores de consola. Septiembre sigue en el agregado
viejo (Fase 98-106, 1 "especialidad") porque el archivo real que Edwin
ha enviado nunca trajo septiembre en el formato nuevo — anotado en
`docs/pendientes.md` §2 (dueño: Edwin). El `console.error 401` visto en
una corrida de verificación no se reprodujo en una segunda corrida
idéntica — sin causa real confirmada, tratado como ruido transitorio.

PRs #333 (corrección del dry-run inseguro), #334 (auditoría de
privacidad + arreglo del `Date`) y el de cierre de esta fase (scripts de
ejecución real + esta actualización). Versión final `1.15.1`. Scripts de un
solo uso de esta fase (`scripts/produccion/fase129-*.js`) quedan en el
repo por ahora, mismo criterio que los de fases anteriores
(`fase122-...`, `fase124-...`, `fase128-...`) — se archivan en bloque
cuando estorben, no fase por fase (ver `scripts/README.md`); confirmado
que ninguno imprime ni contiene un nombre real. Detalle narrativo
completo en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md).

## Índice — fases 0 a 130

Título de cada fase (detalle completo en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md),
mismo orden):

- Fase 0 — Auditoría de punto de partida
- Fase 1 — Backend Calidad y Metas
- Fase 2 — Sistema de dashboards configurables, nivel profesional
- Fase 3 — Dashboards de cliente restantes
- Fase 4 — Inventario y Gerencia
- Fase 5 — Seguridad y estabilidad
- Fase 6 — Infraestructura y despliegue en AWS
- Fase 7 — Verificación final integral
- Fase 8 — Reporte final
- Fase 8.1 — Auditoría post-cierre: XSS almacenado (2026-09-10)
- Fase 9 — Despliegue real en AWS (2026-09-10)
- Fase 10 — Feedback de Edwin (rama `feature/feedback-edwin-2026-09-10`)
- Fase 11 — Cierre: Gestión Humana + pasada de calidad + merge a producción (2026-09-10)
- Fase 12 — Apps de escritorio y Android (rama `feature/apps-desktop-android`, 2026-09-10)
- Fase 13 — Cierre total: producción sirviendo la versión nueva (2026-09-10)
- Fase 14 — Layout responsivo en celular: navbar + sidebar (rama `fix/responsive-navbar-sidebar-movil-2026-09-11`, 2026-09-11)
- Fase 15 — Logo del navbar ilegible por contraste (rama `fix/logo-navbar-contraste-2026-09-11`, 2026-09-11)
- Fase 16 — Datos de demostración para todos los dashboards + PRs #9/#10 (2026-09-14)
- Fase 17 — Cierre de dos cabos sueltos de la Fase 16: credenciales de demo y aviso de datos ficticios (2026-09-14)
- Fase 18 — Trafico de llamadas: carga real de Volvox, mapeo de skills y grafica con filtros (2026-09-14)
- Fase 19 — Semáforo de color configurable + carga masiva de Cartera (2026-09-15)
- Fase 20 — Cierre del módulo "Flujo de Llamadas" contra el pedido de Edwin (2026-09-15)
- Fase 21 — Ajustes finos de "Flujo de Llamadas" tras la llamada real con Edwin (2026-09-15)
- Fase 22 — Plantilla oficial de Tráfico publicada como descarga (2026-09-15)
- Fase 23 — QA de la plantilla oficial de Tráfico en producción (PRs #27-30, 2026-09-15)
- Fase 24 — Plantilla consolidada de carga (PRs #31-37, 2026-09-15)
- Fase 25 — Diagnóstico de solo lectura para producción (PRs #38-39, 2026-09-15)
- Fase 26 — Fix: la cascada de borrado de dashboards ya no borra los Excel cargados (PRs #40-43, 2026-09-16)
- Fase 27 — Botón "Previsualizar" + filtros y colores estables en gráficas (PRs #44-46, 2026-09-16)
- Fase 28 — Auditoría de solo lectura de las 3 campañas prioritarias (PR #47, 2026-09-16)
- Fase 29 — Auditoría general de la plataforma ("Radiografía InConexión") + 4 mejoras técnicas (2026-09-17)
- Fase 30 — Cierre del resto de la lista de auditoría (deps mayores) + fix de `main` roto + auditoría del flujo de carga (PRs #55-57, 2026-09-17)
- Fase 31 — Fix: una hoja renombrada en la plantilla consolidada ya no se pierde en silencio (2026-09-17)
- Fase 32 — Pantalla de mapeo manual de skill de Wolkvox → campaña (2026-09-17)
- Fase 33 — Dashboard de ORLANT con las 16 gráficas del PDF de InCo (PRs #64-65, 2026-09-18)
- Fase 34 — Fix: Tipificación duplicaba categorías en el pie + datos de prueba dejados visibles a propósito (PR #70, 2026-09-18)
- Fase 35 — Tema oscuro/claro para toda la plataforma (PR #72, 2026-09-18)
- Fase 36 — Trafico real de ORLANT (agosto 2026) + retiro de los datos de prueba de la Fase 34 (2026-09-18)
- Fase 37 — Cronograma y Metas de Monitoreo reorganizado en sub-pestañas (PR #76, 2026-09-18)
- Fase 38 — Gráficas de ASA/ATA, Wait Time y Niveles de Servicio 10s/30s en Tráfico (PR #78, 2026-09-18)
- Fase 39 — Llamadas 3P/General y Nivel de Atención de ORLANT se calculan solos desde Tráfico (PR #80, 2026-09-18)
- Fase 40 — "Una gráfica por pestaña": Tráfico/Wolkvox y el dashboard normal de ORLANT reorganizados en sub-pestañas (2026-09-21)
- Fase 40b — Menú de ORLANT reducido a "Calidad" y "Tráfico de Llamadas" — TEMPORAL (2026-09-21)
- Fase 41 — Escaneo completo: tema oscuro/claro, bugs cosméticos conocidos y QA funcional general (2026-09-21)
- Fase 42 — Extiende el escaneo de tema/QA a las 8 campañas restantes + cierra los colores tenues pendientes (2026-09-21)
- Fase 42-bis — Limpieza de la rama sin usar de la Fase 36 (2026-09-21)
- Fase 45 — Ajustes de Tráfico de Llamadas + valores numéricos visibles en las gráficas (2026-09-21)
- Fase 46 — Menú lateral desplegable (2026-09-21)
- Fase 47 — Auditoría de cumplimiento vs. la reunión con Edwin (21/09) (2026-09-21)
- Fase 48 — Revisión de seguridad y de bugs de las Fases 45-47, integradas (2026-09-21)
- Fase 49 — Verificación física completa, por rol de usuario, con navegador real (2026-09-21)
- Fase 50 — Módulo de Tráfico de WhatsApp: plantilla real, carga, dashboard (2026-09-21)
- Fase 51 — Verificación final del módulo de Trafico de WhatsApp: código + base de datos + navegador (2026-09-22)
- Fase 52 — Fix real: la carga de WhatsApp por el modal "Cargar Datos de Dashboards" no reconocía el archivo (2026-09-22)
- Fase 53 — Subida manual guiada del archivo real de WhatsApp por la web (2026-09-22)
- Fase 54 — KPIs de WhatsApp desconectados en la franja global de ORLANT (2026-09-22)
- Fase 55 — Verificación final consolidada del módulo de Tráfico de WhatsApp (2026-09-22)
- Fase 56 — Carga real de Trafico de WhatsApp en producción (en curso, 2026-09-22)
- Fase 57 — Color por cola en las gráficas de Tráfico de WhatsApp (2026-09-22)
- Fase 58 — Unificación de ramas a main + auditoría completa de código, base de datos y verificación web (2026-09-22)
- Fase 59 — Confirmación de la Fase 58 + arreglo de los 2 hallazgos pendientes (2026-09-22)
- Fase 60 — Filtro "Skill" de Trafico de Llamadas: de listbox multi-select a desplegable (2026-09-22)
- Fase 61 — Investigación: qué de lo hecho para ORLANT se puede extender al resto de clientes (2026-09-23)
- Fase 63 — Unificación del tipo de pestañas/gráficas de ORLANT (Calidad, Tráfico de Llamadas, Tráfico de WhatsApp) en el resto de plantillas (2026-09-23)
- Fase 64 — Unificación de ramas, confirmación de producción, y auditoría completa (código + BD + navegador) (2026-09-23)
- Fase 65 — Resuelve los 3 hallazgos de la Fase 64 (dropdown Skill + AHT Promedio real) + revisión independiente con subagentes (2026-09-23)
- Fase 66 — Plantilla unificada de Tráfico para ORLANT (Llamadas + WhatsApp en un solo archivo) (2026-09-23)
- Fase 67 — Por qué producción seguía sirviendo la plantilla vieja de ORLANT, y prueba real de punta a punta en producción (2026-09-23)
- Fase 68 — Ajustes pedidos por Edwin en la revisión del 23/09 (vista mensual, quitar franja de KPIs de ORLANT, solo SL20, quitar Wait Time, y Tráfico de WhatsApp igual a Tráfico de Llamadas) (2026-09-24)
- Fase 70 — Inventario de ORLANT, causa del 403, y retiro de las apps móvil/escritorio (2026-09-24)
- Fase 71 — Prepara la hoja "resumen" de ORLANT antes de la base de Edwin + revisión de Calidad (2026-09-24)
- Fase 72 — Auditoría de seguridad y fallos (2026-09-24)
- Fase 73 — Limpieza de ramas (2026-09-24, sin PR de código)
- Fase 75 — Arregla lo que encontró la Fase 74 + pendientes chicos sin bloqueo (2026-09-25)
- Fase 76 — Cierra los 4 detalles que dejó la Fase 75 (2026-09-25, automática)
- Fase 78 — Agendas de ORLANT: citas asignadas por especialidad (2026-09-25, automática)
- Fase 77 — Reunión con Edwin (25/09): fixes de Tráfico + Tipificación de ORLANT (2026-09-25, automática)
- Fase 79 — La carga de Agendas/Tipificación falló en producción: causa real, arreglo y carga de los datos reales (2026-09-28, automática)
- Fase 80 — Carga real de Agendas/Tipificación en producción + cierre de pendientes (2026-09-28, automática)
- Fase 81 — Auditoría de seguridad y QA de toda la plataforma: inyección SQL + permisos + no-regresión (2026-09-28, automática)
- Fase 82 — Cierra el hueco de POST /dashboard/cargas que la Fase 81 dejó pendiente de decisión (2026-09-28, automática)
- Fase 83 — Cada usuario ve SOLO los módulos/pestañas/botones a los que tiene permiso (esconder, no mostrar en gris) (2026-09-28, automática)
- Fase 84 — Plantilla de Excel de ORLANT al día: una hoja por cada tipo de dato que ya se puede cargar (2026-09-28, automática)
- Fase 85 — "Exportar" del dashboard genérico no exportaba nada en ninguna pestaña (2026-09-28, automática)
- Fase 86 — 3 ajustes de la Fase 85: nada de commits directos a `main`, frenar fechas futuras al cargar, y que el selector "MES" mueva todas las pestañas (2026-09-28, automática)
- Fase 87 — Notas del jefe (nivel de servicio en Resumen, WhatsApp a 5 min, tipografía unificada) + 2 revisiones pendientes de la Fase 86 (2026-09-29, automática)
- Fase 88 — barrido de bugs después de las Fases 75-87, más revisión de exposición pública del repo (2026-09-29, automática)
- Fase 90 — WhatsApp con los DOS niveles de servicio (20 s y 5 min) + arreglar el selector de MES y las fechas (2026-09-30, automática)
- Fase 91 — encontrar por qué en producción el selector de MES solo mostraba Ago-26 (2026-09-30, automática)
- Fase 92 — poner a funcionar el dominio nuevo `https://informa.inconexion.com.co` (2026-09-29, automática)
- Fase 93 — quitar duckdns por completo: todo desde informa.inconexion.com.co (2026-09-29, automática)
- Fase 94 — Agendamiento como lo pidió Edwin + orden de pestañas + aviso de WhatsApp más claro + análisis de brecha de Calidad (2026-09-29, automática)
- Fase 95 — Calidad: lo que Edwin ya decidió (fecha/evaluador automáticos, codificación en lista, alerta al asesor) + versión 1.0 con CHANGELOG + limpieza del repo público (2026-09-30, automática)
- Fase 96 — activar la seguridad de GitHub que estaba apagada + CI sin Node 18/20 y con límite de tiempo (2026-09-30, automática)
- Fase 98 — Inasistencia de ORLANT: base real, pestaña con filtro por mes y por especialidad, y carga en producción (2026-09-30, URGENTE, automática)
- Fase 97 (continuación) — PAUSADA la parte de AWS; hecho lo que no depende de credenciales (2026-09-30)
- Fase 97 (continuación 2) — revisión del log de `verificar-logs-produccion` y corrección de los 2 workflows (2026-09-30)
- Fase 97 (continuación 3) — borradas las 40 corridas viejas de GitHub Actions con datos de producción (2026-09-30, autorizado explícitamente)
- Fase 99 — las opciones de los desplegables se veían en blanco (texto blanco sobre fondo blanco) (2026-09-30)
- Fase 100 — revisión final de ORLANT antes de entregar: 2 arreglos reales encontrados en producción (2026-09-30)
- Fase 101 — Inasistencia: la vista principal pasa a ser "Por mes" (total de todas las especialidades juntas) (2026-09-30)
- Fase 100 (continuación) — Tema B: guía de uso (2026-09-30)
- Fase 100 (continuación) — Tema C: monitor automático de producción (2026-09-30)
- Fase 100 (cierre) — lo que ve un usuario sin admin, confirmación de la plantilla, y verificación en vivo del monitor (2026-09-30)
- Fase 102 — escaneo completo de seguridad y bugs (2026-10-01)
- Fase 103 — dashboards de cliente a pantalla completa (2026-10-01)
- Fase 104 — ranking de agendamiento por asesor (2026-10-01)
- Fase 105 — #gd-modal no cubría el viewport exacto (2026-10-01)
- Fase 106 — Inasistencia solo en porcentaje, por mes (2026-10-01)
- Fase 108 — Inasistencia con la base nueva: por mes, filtros de sede/especialidad/entidad, resumen de todos los meses, barra por especialidad (2026-10-01)
- Fase 109 — Auditoría de las 3 escaladas de la Fase 102, Inasistencia en línea y acciones de workflows fijadas a SHA (2026-10-01)
- Fase 110 (URGENTE) — usuarios de ejemplo con contraseña pública seguían activos en producción (2026-10-02)
- Fase 111 — 2 bases nuevas de ORLANT: el ranking pasa a ser EFECTIVIDAD de agendamiento + Efectividad de citas atendidas (2026-10-02)
- Fase 112 — revisión general de toda la plataforma + reorganización completa del repo (2026-10-02)
- Fase 113 — registro de inicios de sesión + "Cambiar mi contraseña" + revisión diaria de la salud del servidor (2026-10-02)
- Fase 114 (URGENTE) — respaldos automáticos vueltos a activar (nunca se habían instalado en la instancia nueva) + alerta alta de Dependabot (SheetJS) resuelta (2026-10-02)
- Fase 115 — Tráfico de Llamadas de agosto y septiembre 2026, con la línea REGIMEN ESPECIALES (faltaba desde la Fase 67): lector al día (hoja "Hoja1", WAIT_TIME/AHT con fecha boxeada) y carga real en producción (2026-10-04)
- Fase 116 — Tráfico de WhatsApp (formato diario real de Wolkvox) y Tipificación (export completo HistCDR) de agosto y septiembre 2026, sin duplicados; fix real de un residuo huérfano por un defecto del reemplazo por rango de la Fase 115 (2026-10-04)
- Fase 117 — Revisión final integral (seguridad + bugs) antes de entregar ORLANT: 2 arreglos reales (orden del Historial, inyección de fórmulas en la plantilla de Calidad), resto de la plataforma verificado sin hallazgos nuevos (2026-10-05)
- Fase 118 — Cierra con evidencia lo que la Fase 117 dejó sin demostrar: matriz de acceso de las 113 rutas EJECUTADA (51 pruebas, reconfirma las 3 escaladas críticas de la Fase 102), privacidad del HistCDR completo EJECUTADA con valores centinela, verificación en producción con sesión real, 1 test flaky corregido; barrido visual/código muerto/XSS dinámico/zonas horarias quedan pendientes (2026-10-05)
- Fase 119 — Deja ORLANT lista para entregarla al cliente: recorrido en producción con la cuenta REAL del cliente (CLIENTES_DASH) confirmado por JWT, cargar un mes nuevo nunca daña los ya cargados (26 pruebas EJECUTADAS, las 7 bases), matriz de acceso de las 7 familias de carga masiva EJECUTADA (1 hallazgo real de bajo riesgo documentado: Tráfico de Llamadas sin campaignAccess por diseño), zonas horarias EJECUTADAS con procesos reales TZ=UTC/TZ=America-Bogota, guía de uso + checklist de aceptación + procedimiento de carga mensual al día; barrido visual/código muerto/XSS dinámico/fallas de UI siguen pendientes (2026-10-05)
- Fase 120 — Verificación dato por dato de los 3 archivos reales que envió InCo (Llamadas 150 filas, WhatsApp 258 filas, Tipificación 34.661) contra producción, recorriendo TODAS las sub-pestañas (no solo la que abre por defecto, el hueco real que dejaba pasar un AHT de WhatsApp en blanco sin que nadie lo notara); se quitó el AHT de WhatsApp (Wolkvox nunca lo entrega) con migración idempotente + reactivación sin tocar código; 2do hallazgo real: el ATA de Llamadas Y de WhatsApp se promediaba ponderado por el total en vez de por los abandonos reales (corregido, con el efecto numérico documentado); la revisión automática de cada PR ahora también confirma que un aviso de "sin datos" quede visible de verdad, no solo que el canvas esté escondido (2026-10-05)
- Fase 122 — Carga real de ORLANT de agosto-septiembre/2026 (Tipificación de WhatsApp, Agendas, Efectividad de Agendamiento) + pedidos de la reunión con Edwin (alias de nombre de asesor, nombre completo del mes); 3 hallazgos reales encontrados y corregidos al cargar los archivos reales (límite de tamaño de Agendas, el navegador sin responder con archivos grandes de 1 sola hoja, y un defecto que bloqueaba SIEMPRE el reconocimiento de Tipificación de WhatsApp) (2026-10-06)
- Fase 123 — Re-carga de TIPIFICACIONES.xlsx para consolidar el alias "_falla" (pendiente de la Fase 122) + identificación de otros 4 archivos reales de Descargas que ya coincidían con lo cargado (se dejaron sin tocar, decisión del usuario) (2026-10-06)
- Fase 124 — Revisión de errores y bugs probando la página real en producción (lo que la Fase 122 dejó sin cubrir: tema oscuro, 1920×1080, móvil, efecto real del alias, mes parcial de julio) + 1 vulnerabilidad crítica de npm audit corregida + 1 función muerta borrada + reorganización completa de la documentación (`docs/pendientes.md` en 5 secciones, `docs/README.md`, `docs/plantillas-inventario.md` nuevos) (2026-10-06)
- Fase 125 — Cierre de lo que la Fase 124 dejó sin hacer: corrección del margen de tamaño de carga (era por archivo, no acumulado) + aviso de carga demasiado grande antes de enviar + guía de uso y checklist de Edwin al día + XSS/exports/eje secundario del combo probados de verdad con Playwright contra la página real, no solo lectura de código (2026-10-06)
- Fase 126 — Pedido de Edwin: borrado de todos los meses de prueba de producción (Inasistencia Ene-Jul/2026, Efectividad de Citas Ene-Mar/2026, Agendas Abril/2025), con un endpoint nuevo de solo administrador (dry-run + conteo exacto obligatorio) construido para la ocasión; retiro del aviso de Nivel de Servicio a 5 minutos de WhatsApp y redacción simplificada del aviso de mes incompleto en Inasistencia; propuesta (sin programar) de un indicador de llamadas de salida (2026-10-06)
- Fase 127 — Indicador de Llamadas y WhatsApp de SALIDA (archivo mensual de Edwin): nueva pestaña "Salida" (tabla propia `salida_mensual`, confirmación explícita del año del mes antes de guardar, nunca en silencio); hallazgo real con Playwright contra un archivo sintético de la forma exacta del real (encabezado en la fila 3, 2 filas vacías antes) -- un archivo válido no se reconocía porque el buscador de encabezados por rango acotado solo miraba el primer renglón del rango usado de la hoja, corregido y cubierto con pruebas; carga real en producción sujeta a parada obligatoria y al "OK cargar" explícito del usuario (2026-10-06)
- Fase 128 — 4 pedidos de la reunión de validación con Edwin del 2026-10-06: Parte 1, pestaña "Salida" renombrada a "Llamadas y WhatsApp de salida" y reubicada junto a Tráfico de WhatsApp (migración idempotente nueva, reposición incondicional por el mismo criterio que `orden_pestanas_v2` -- hallazgo real: gatearla al label viejo habría dejado mal ubicada cualquier instalación nueva); Parte 2, corrección por construcción del hallazgo de privacidad de `revision-final.js` (`veredictoSubvista` ya nunca devuelve texto crudo del DOM, solo conteos/veredicto de lista fija -- cierra la clase completa del problema, no solo el caso de "Ranking de asesores"), con prueba automática nueva que confirma con un nombre ficticio que no se filtra; mismo criterio aplicado al resto de `scripts/produccion/`; Parte 3, nueva base `monitoreos` en el borrado por rango (mismo endpoint auditado de la Fase 126) para retirar los 37 monitoreos de prueba de Calidad confirmados por Edwin, con respaldo manual confirmado antes del cambio; Parte 4, housekeeping (30 ramas locales ya mergeadas, lockfile al día, `.gitignore` de la configuración local de Codex); verificación real en producción EJECUTADA (2026-10-07): `revision-final.js` corrido con sesión real del usuario (0 nombres, 0 discrepancias, Salida confirmada), y los 37 monitoreos de prueba de Calidad borrados de verdad tras el "sí" explícito del usuario sobre el conteo exacto (37, 2026-09) — Calidad de ORLANT queda en 0, "Sin datos" visible, 0 errores (2026-10-06/07)
- Fase 129 — Recarga de Inasistencia de ORLANT: incidente real de escritura accidental en producción (dry-run con `page.exposeFunction` -- corregido por construcción con `dry-run-seguro.js`), auditoría completa de privacidad del incidente (nunca llegó al repo/PR/CI), y hallazgo real nuevo (v1.15.1): una celda de fecha con formato Excel llegaba como objeto `Date` por un efecto secundario de `cellNF:true`, bloqueando en silencio cualquier re-carga del archivo completo -- corregido; Inasistencia restaurada al umbral de privacidad original (Ago-26 352 filas/54 entidades/11.189/786/7,45 %, ene-jul vueltos a borrar, septiembre intacto) (2026-10-07)
- Fase 130 — Calidad real de septiembre/2026 (95 monitoreos) + pedidos de la reunión con Edwin del 2026-10-07 (Inasistencia acepta "FECHA CITA"/normaliza SEDE 34, quita el aviso "incompleto", nueva gráfica de nombre+% promedio por asesor en Calidad) + 2 hallazgos reales corrigiendo la carga masiva de Calidad (filas de plantilla sin diligenciar, observaciones hasta 500 caracteres) + Parte 7: el limitador de tasa de la API ya no bloquea a toda una oficina por el error de una sola persona (ahora cuenta por usuario autenticado, no por IP); verificación final completa en producción (ADMIN y CLIENTES_DASH) EJECUTADA, con 2 traspiés reales documentados (límite de tasa agotado por corridas repetidas, autocompletado del navegador) antes de confirmarla en verde (2026-10-07)

