# Flujo de Calidad según lo describió Edwin — análisis de brecha

Fase 94 (tema D), 2026-09-29. **Solo lectura**: este documento es el resultado
de revisar el módulo de Calidad tal como existe hoy (monitoreos, plantillas,
cronograma de metas, `CAL_DB`, el panel de Calidad del dashboard, roles y
permisos) contra el flujo que Edwin explicó en persona. No se cambió código
de Calidad en esta fase.

## El flujo que describió Edwin

1. Alguien con rol CALIDAD entra y crea un monitoreo de una campaña (ej. ORLANT).
2. El formulario tiene: asesor (desplegable); fecha automática del día, que no
   se puede cambiar; ID y teléfono; codificación (desplegable, Edwin manda la
   lista); evaluador = el usuario de la sesión, que no se puede cambiar;
   canal (llamada o WhatsApp); ítems a calificar, con la opción "No aplica".
3. Al guardar: al asesor le sale una alerta cuando inicia sesión ("tienes un
   monitoreo nuevo") y puede verlo.
4. El resultado suma al resultado de calidad del mes de la campaña, en la
   pestaña Calidad del dashboard.

## Tabla de brecha

| Pieza del flujo de Edwin | Estado | Detalle (archivo:línea) |
|---|---|---|
| Rol CALIDAD (o SUPERVISOR) crea un monitoreo de una campaña a la que tiene acceso | **Ya existe** | `server/auth.js:117-121` (`canEvaluateCampaign`); `POST /monitoreos`, `server/routes/calidad.js:160-213`; formulario `submitMonitoreo()`, `public/js/calidad.js:403-440` |
| Asesor en menú desplegable | **Ya existe** | `public/index.html:894` (`<select id="cf-asesor">`); poblado por `populateCalAsesorSelect()`, `public/js/calidad.js:274-289` — ya filtra por usuarios con rol `ASESOR`, activos, de esa campaña |
| Fecha automática del día, que no se puede cambiar | **Existe distinto** | Hay un campo fecha (`public/index.html:897`, `<input type="date" id="cf-fecha">`) pero es **libremente editable** — no se autocompleta con hoy ni se bloquea. `resetCalForm()` (`public/js/calidad.js:362-373`) lo deja vacío. El servidor solo valida que no sea una fecha **futura** (`fechaSchema`/`fechaLimitesEsFutura`, referenciado en `server/validation.js:178`), nunca que sea exactamente hoy |
| ID y teléfono | **Ya existe** | `public/index.html:900-901`, campos de texto libre `cf-idllamada`/`cf-telefono`; columnas `idLlamada`/`telefono`, `server/db.js:125-126` |
| Codificación en menú desplegable (Edwin manda la lista) | **Existe distinto** | Hoy es texto libre sin restricción: `public/index.html:904` (`<input type="text" id="cf-codificacion">`), `server/validation.js:182` (`textoCortoOpt`, sin `enum`). No hay ninguna lista fija ni por campaña — no existe el concepto de "lista de codificaciones válidas" en ningún lado del código |
| Evaluador = el usuario de la sesión, no se puede cambiar | **Existe distinto** | Hoy es un campo de texto libre y editable (`public/index.html:905`, `<input type="text" id="cf-evaluador">`). El servidor **sí** guarda de respaldo quién creó el registro (`evaluadorUserId`, `server/db.js:129`, fijado en `server/routes/calidad.js:200` con `req.actor.id`, nunca lo que mande el cliente) — pero el campo "evaluador" que se ve y se guarda como texto (`evaluador`, `server/db.js:128`) lo puede escribir cualquiera; si el campo viene vacío, el servidor cae al nombre del actor (`server/routes/calidad.js:179`), pero si alguien escribe otro nombre, ese es el que queda |
| Canal: llamada o WhatsApp | **Ya existe** | Botones `LLAMADA`/`WPP`, `public/index.html:910-913`; `z.enum(['LLAMADA','WPP'])`, `server/validation.js:179` |
| Ítems a calificar, con la opción "No aplica" | **Ya existe** | Plantilla de ORLANT: 17 ítems con categoría/peso/crítico, `server/calidad-plantillas-seed.js:14-30`. El motor de puntaje (`computeScore`, `server/calidad-logic.js:18-57`) ya trata `SI`/`NO`/`N/A` — `N/A` ("No aplica") suma el peso completo igual que `SI`, tanto en ítems críticos como no críticos (motor `standard`, el que usa ORLANT) |
| Al guardar: alerta al asesor cuando inicia sesión ("tienes un monitoreo nuevo") | **Falta por completo** | No existe ningún mecanismo de notificación/alerta al iniciar sesión en toda la plataforma (se revisó el flujo de login y los archivos de Calidad — ninguna mención de "notificación"/"alerta de sesión nueva"; los únicos usos de "alerta"/"badge" son etiquetas de clasificación, no notificaciones) |
| El asesor puede ver su monitoreo | **Ya existe, pero no es proactivo** | `GET /monitoreos/mios`, `server/routes/calidad.js:127-140` (empareja por nombre de usuario logueado); pantalla "Mis Resultados", `public/js/mis-resultados.js` completa (KPIs, gráfica de tendencia, detalle ítem por ítem) — pero el asesor tiene que **entrar a buscarlo**, nada se lo avisa |
| El resultado suma al resultado de calidad del mes de la campaña, pestaña Calidad del dashboard | **Ya existe** | `calDashFiltrarMonitoreos`/`calDashResumen`, `public/js/calidad-dashboard-logic.js:16-43` (filtra por mes/asesor/rango, sobre `CAL_DB`); paneles `calidad_kpis`/`calidad_pie` del dashboard genérico ya consumen esto; probado en `server/tests/calidad-dashboard-logic.test.js` |

### Resumen

Lo más grande del flujo (crear el monitoreo, el motor de puntaje con pesos y
"No aplica", que el asesor pueda consultar sus resultados, que sume al
resumen mensual de la pestaña Calidad) **ya existe y funciona**. Lo que falta
o está distinto es más chico de lo que parecía al leer el pedido de cero:

1. Bloquear/autocompletar 2 campos (fecha = hoy, evaluador = sesión).
2. Convertir codificación de texto libre a lista desplegable (falta la lista).
3. Construir desde cero el mecanismo de notificación al iniciar sesión (no
   existe ningún precedente de notificaciones en la plataforma — sería la
   primera vez).

## Preguntas para Edwin (30/09)

1. **¿Cómo se calcula la nota?** Ya existe una fórmula con 2 variantes
   (`server/calidad-logic.js:18-57`): motor `standard` (los críticos
   penalizan restando del peso si la respuesta es "NO") y motor `sura` (solo
   "SI" suma, los críticos no penalizan el puntaje, solo cuentan como fallo).
   ORLANT usa `standard` hoy. **¿Sigue siendo la fórmula correcta, o cambió
   algo?**
2. **¿Qué pesos tiene cada ítem?** Ya existe una plantilla de 17 ítems con
   pesos y críticos definidos para ORLANT (`server/calidad-plantillas-seed.js:14-30`,
   categorías APERTURA/ESCUCHA/GESTION/INFORMACION/TIEMPOS/CIERRE/GESTION 3P).
   **¿Sigue vigente esa plantilla o hay que actualizarla?**
3. **¿El asesor tiene que aceptar el monitoreo, o solo se entera?** Hoy no
   hay ningún paso de aceptación — el monitoreo queda guardado apenas
   CALIDAD/SUPERVISOR lo guarda.
4. **¿Cómo debe verse/dispararse la alerta al iniciar sesión?** ¿Un banner
   al entrar, un contador tipo "1 nuevo" en algún ícono, un correo aparte? Es
   la primera notificación de este tipo en la plataforma — no hay ningún
   patrón existente que copiar.
5. **¿Qué lista de codificaciones se usa?** ¿Es la misma para las 3 campañas
   (ORLANT, CLINICA AURORA, HOSPITAL LA MARIA) o cada una necesita la suya
   propia, como ya pasa con los ítems de la plantilla de calificación?
6. **La fecha:** ¿siempre tiene que ser HOY sin excepción, o a veces se
   registra un monitoreo de un día anterior (por ejemplo, al evaluar una
   llamada grabada de ayer)? Si puede ser un día anterior, "automática y no
   editable" necesitaría matizarse.
7. **El evaluador:** ¿basta con que siempre sea el usuario de la sesión (ya
   se guarda así de respaldo, `evaluadorUserId`), o Edwin necesita que un
   supervisor pueda registrar un monitoreo **a nombre de otro evaluador**
   (por ejemplo, para cargar un histórico)?
8. **¿Qué pasa con los datos de prueba (Asesor 01–05)** que puedan existir
   hoy en producción — se dejan, se archivan aparte, o se borran? (Nota:
   por regla del proyecto, esos datos de prueba de Calidad de ORLANT no se
   tocan sin que Edwin lo pida explícitamente).
9. **¿Hace falta un límite de monitoreos por asesor al mes**, o esa parte ya
   la cubre el Cronograma de Metas existente (`server/routes/calidad.js:392-417`,
   metas por líder/mes con desglose Llamada/WhatsApp)?
