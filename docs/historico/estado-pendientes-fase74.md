# Fase 74 — Estado real del código y pendientes (solo verificación, 2026-09-25)

Fase de solo lectura: no se cambió código ni datos de producción. Los únicos
datos tocados fueron locales (ver "Método de prueba" en la Parte 2, punto 1) y
se revirtieron al terminar. Único cambio de este PR: este documento.

## Parte 1 — Estado del repo y de producción

- **Rama**: `main` local = `origin/main` (`129c6ab`). `git status` limpio
  salvo 3 elementos sin trackear que ya estaban ahí al empezar esta fase (no
  se tocaron): 2 `.xlsx` sueltos en `docs/capturas-demo/fase67-.../` y la
  carpeta `mobile-app/` — ver hallazgo nuevo más abajo, no es inofensiva.
- **Ramas remotas**: solo `main`. **PRs abiertos**: 0. **Issues abiertos**: 0.
- **Limpieza de ramas de la Fase 73**: SÍ se hizo. La rama
  `feature/apps-cierre-final-2026-09-11` ya no existe remota ni localmente;
  el tag `archivo/apps-cierre-final-2026-09-11` existe y apunta a su último
  commit — exactamente el patrón descrito para esa fase.
- **Producción**: el último deploy exitoso (`Deploy a AWS`, run
  `36058951763`, 2026-09-24T21:03:15Z) desplegó el commit `129c6ab...873`,
  que es el HEAD actual de `main` — producción está al día.
  `GET /api/health` → `200 {"ok":true}`.
- **`npm test`** (server): **396/396 OK**. **`npm audit`**: **0
  vulnerabilidades**.
- **TODO/FIXME/HACK**: ninguno real encontrado (la única coincidencia de
  "TODO" en mayúsculas es la palabra española "todo" dentro de un
  comentario, no un marcador). **Código comentado muerto**: ninguno
  encontrado.
- **Nota de proceso**: `PROGRESS.md` no tiene entradas para las Fases 72 ni
  73 — la última entrada es la Fase 71. Ese trabajo sí quedó documentado
  (PRs #133, #137-144 y `docs/auditoria-seguridad-fase72.md`), pero rompe la
  disciplina de "una entrada por fase en PROGRESS.md" que se venía
  siguiendo. Recomendación: agregar retroactivamente un resumen corto de
  las Fases 72/73 a `PROGRESS.md`.

### Hallazgos nuevos (no estaban en la lista de pendientes)

1. **`mobile-app/` reapareció sin trackear, con el keystore de firma
   Android sin protección.** La Fase 70 la borró de git (`git rm -r`, PR
   #133) documentando que su propio `mobile-app/.gitignore` excluía a
   propósito `inconexion-release.keystore` y `release-signing.properties`
   ("secretos de firma — NUNCA versionar"). Hoy la carpeta existe de nuevo
   en disco (`android/`, `node_modules/`, el keystore y las properties),
   **sin trackear y sin ningún `.gitignore` que la proteja** (ese
   `.gitignore` se fue junto con el resto al hacer `git rm -r`). Confirmé
   con `git check-ignore -v` que ningún patrón del repo la cubre hoy. Un
   futuro `git add -A` subiría el keystore de firma sin que nada lo evite.
   No es una vulnerabilidad activa (nunca llegó a estar en el historial de
   git), pero es un riesgo real y silencioso. **Recomendación**: mover el
   keystore fuera del directorio del repo (ya se recomendó respaldarlo
   aparte en la Fase 70) y agregar `mobile-app/` al `.gitignore` raíz como
   red de seguridad.
2. **`PUT /dashboards/config/:cliente` borra `oculta` y `subtabs` de TODAS
   las pestañas al guardar.** El schema de validación
   (`server/validation.js:553-565`, `dashboardConfigBody.layout.tabs`) solo
   declara `key`, `label` y `panels` — Zod descarta por defecto cualquier
   campo no declarado del objeto. Lo confirmé en vivo contra la base local:
   un `PUT` que solo pretendía cambiar `oculta` en 3 pestañas devolvió las
   **10 pestañas de ORLANT visibles** y sin `subtabs`. No hay ninguna
   pantalla de administración hoy que use este endpoint para editar
   `layout` (confirmé que no hay un caller real en `public/js/` más allá de
   scripts internos), así que **hoy no tiene impacto en producción** — pero
   es una bomba de tiempo: el día que se construya una pantalla de
   "editar dashboard" que lo use, destaparía sin querer las 7 pestañas
   ocultas de ORLANT (y borraría toda la agrupación de sub-pestañas de
   cualquier cliente). **Recomendación**: agregar `oculta` (`z.boolean().optional()`)
   y `subtabs` (mismo shape que ya usa `dashboard-config-seed.js`) al
   schema antes de que alguien construya esa pantalla.

## Parte 2 — Cada pendiente, contra el código real

### 1. Las 7 pestañas ocultas de ORLANT

| Pestaña | Hoja/tabla que la alimenta | Estado |
|---|---|---|
| Agendamiento | `resumen` | **Hecho** — probada en Fase 71 con Playwright + datos inventados (Total Agendas agosto = 2.950). Confirmado. |
| Inasistencia | `resumen` | **Hecho** — igual que arriba. Confirmado. |
| Efectividad Citas | `resumen` | **Hecho** — igual (Citas Atendidas agosto = 2.790). Confirmado. |
| Gestión STA | `resumen` (1 de 4 subtabs) + `sta_categorias` (3 de 4 subtabs) | **A medias.** Solo el subtab "STA por Mes" (viene de `resumen`) se probó en Fase 71. Los otros 3 ("Órdenes por Servicio (año)", "Estado de Órdenes (año)", "Servicios Gestionados del Mes") vienen de `sta_categorias` y no se habían probado — los probé hoy (ver método abajo). |
| Salida | `salida` (hoja propia, diaria) | **A medias** — nunca probada como pestaña visible. Probada hoy (ver método abajo). |
| Tipificación | `tipificacion` (hoja propia, mensual) | **A medias** — nunca probada como pestaña visible. Probada hoy (ver método abajo). |
| Flujo Mensual | `resumen` (columnas `autoTrafico`) | **Construida, deliberadamente no probada.** Fase 70 la marcó como "candidata a no reconstruirse nunca" porque duplica, con los mismos datos automáticos, lo que ya muestran Tráfico de Llamadas/WhatsApp. No la conté entre las "3 restantes" del pedido porque es una decisión aparte, no un hueco de prueba. |

**Corrección al pedido**: no son limpiamente "las 4 de resumen" + "3 más"
(Tipificación/Salida/STA-por-categorías). Es: 3 pestañas completas ya
confirmadas (Agendamiento, Inasistencia, Efectividad) + 2 pestañas enteras
sin probar (Salida, Tipificación) + 3 de las 4 sub-pestañas de Gestión STA
sin probar (las que dependen de `sta_categorias`) + Flujo Mensual, aparte,
deliberadamente sin tocar.

**Método de prueba de hoy (Salida, Tipificación, subtabs de Gestión STA)**:
la base local ya tenía datos de ejemplo para estas 3 secciones cargados por
el mecanismo oficial `npm run seed:demo` (6 periodos, 2026-04 a 2026-09,
etiquetados `Seed Demo (script)`) — no fue necesario inventar ni cargar
nada nuevo. Confirmé que la forma de esos datos calza exactamente con lo
que cada panel espera (p. ej. `tipificacion` trae filas con `linea` = "3P"
Y "GENERAL", necesario para el filtro único del pie; `sta_categorias` trae
las 3 dimensiones `SERVICIO`/`ESTADO`/`MES_ACTUAL` con `agendas`/`cantidad`
coherentes para el cálculo de % efectividad). Para ver las pestañas
temporalmente, actualicé `dashboards_config.layout` de ORLANT **directo en
la base SQLite local** (no por el endpoint `PUT`, que — ver hallazgo arriba
— hoy corrompe `oculta`/`subtabs` de todas las pestañas), confirmé por API
que los datos aparecen correctos en cada sección, y revertí el `layout`
exacto al terminar (confirmado byte a byte contra una copia de respaldo
tomada antes de tocar nada). **No pude confirmarlo visualmente en un
navegador**: la herramienta de automatización de Chrome de este entorno no
pudo conectarse a `localhost` (2 intentos, error de conexión/frame en
ambos) y evité instalar el navegador de Playwright para no salirme del
alcance de "solo verificación". La evidencia de código + forma de los
datos es fuerte (el motor de render, `dashboard-generic.js`, es genérico y
ya está probado con estos mismos tipos de panel — `filtroSerie`,
`filtroCampo`+`filtroUnico`, `pctDeTotal`, `anual` — en Aurora y en las 4
pestañas que sí se confirmaron visualmente en la Fase 71), pero no es una
confirmación visual al 100 % como la de esa fase.

### 2. Calidad de ORLANT — 37 monitoreos de prueba

Sí existe el mecanismo: `seed_demo_marcas`
(`server/scripts/seed-demo-lib/marks.js`) marca filas como demo — la tabla
`monitoreos` ya está en su lista de tablas cubiertas (línea 90). Cuando hay
algo marcado, `GET /api/seed-demo/estado` enciende el banner global
"DATOS DE DEMOSTRACIÓN" (`server/server.js:133-157`, se ve en todos los
roles) y `npm run seed:demo:limpiar` las borra limpio.

El problema (ya documentado en la Fase 71, sigue igual): las 37 filas
reales de producción **no se cargaron por ese mecanismo** — `seed_demo_marcas`
está en 0 en toda la base productiva — así que hoy no tienen marca, el
banner nunca se enciende, y `seed:demo:limpiar` no las tocaría.

**Qué haría falta para limpiarlas con respaldo**: un workflow de escritura
de un solo uso (mismo patrón que los ya usados en fases anteriores) que:
tome un backup real primero, identifique las filas por los criterios ya
documentados en la Fase 71 (nombres "Asesor Prueba 01-04"/"Asesor 01-05",
cargadas el 16/09/2026), y las borre solo tras tu confirmación explícita.
**Esfuerzo**: mediano. **Bloqueado por**: confirmación de Edwin de que
ninguna de las 37 es real + tu decisión de proceder.

### 3. Herramientas de backup/logs de la Fase 72 (#142, #143)

**Listas, bloqueadas por exactamente 2 permisos de AWS** (ya documentado en
`docs/auditoria-seguridad-fase72.md` §5, y lo re-confirmé con evidencia de
runs de GitHub Actions de hoy):

- `verificar-logs-produccion.yml`: el único run que existe (`36057888794`,
  2026-09-24T20:53:22Z, **antes** de que el PR #143 corrigiera el bug de
  esconder errores) capturó en su log el error real:
  `AccessDeniedException ... logs:FilterLogEvents ... role/inconexion-github-deploy`.
  No se ha vuelto a correr desde el fix.
- `verificar-restore-backup-produccion.yml`: el único run
  (`36057866800`, mismo momento) falló con
  `AccessDenied: user/inconexion-instance ... s3:ListBucket ... inconexion-backups-877538609452`.

**Falta exactamente**: `s3:ListBucket` para `inconexion-instance` sobre ese
bucket, y `logs:FilterLogEvents` (+ opcional `GetLogEvents`) para
`inconexion-github-deploy` sobre `/inconexion/prod/docker` y
`/inconexion/prod/backup`. **Esfuerzo de código**: ninguno, ya está listo.
**Bloqueado por**: permisos de AWS (tuyos, en la consola de IAM).

### 4. Pantalla vieja "Metas Calidad → Tráfico/Wolkvox"

**Confirmado, sigue sin aceptar el formato unificado.**
`procesarArchivoTrafico` (`public/js/trafico.js:25-44`) sigue llamando a
`traficoParseFilas`, que solo entiende el formato de voz (nunca autodetecta
WhatsApp) — sin cambios desde la Fase 66. No se rompe (mensaje de error
claro, cero errores de consola), simplemente no lo procesa.

**Recomendación** (decisión tuya): esta pantalla ya es funcionalmente
redundante con el modal "Cargar Datos" consolidado. Adaptarla al formato
unificado es esfuerzo **mediano** (reescribir el parser); quitarle el botón
de carga y dejarla de solo lectura es esfuerzo **pequeño**.

### 5. Recargar WhatsApp sobrescribe sin preguntar

**Confirmado, sigue así.** Voz (`public/js/trafico.js:73-84`,
`_traficoConfirmarImpacto`) llama a `POST /calidad/trafico/carga/impacto` y
muestra un `window.confirm` con el detalle de cuántos registros se
reemplazarían, antes de guardar. WhatsApp (`public/js/trafico-whatsapp.js:377-388`,
`guardarTraficoWpp`) llama directo a `POST /calidad/trafico/whatsapp/carga`
sin ningún paso de confirmación — y ese endpoint de "impacto" ni siquiera
existe en el backend para WhatsApp (`server/routes/trafico-whatsapp.js`).
**Esfuerzo**: pequeño (replicar el mismo patrón de voz). **Bloqueado por**:
nada, se puede hacer ya.

### 6. Colores/desplegables — ¿exceljs ya tiene una versión sin la vulnerabilidad de uuid?

**No, sigue igual.** Lo verifiqué en vivo hoy: instalé `exceljs@4.4.0` (la
versión más reciente publicada) en un directorio aislado y corrí
`npm audit` — sigue arrastrando `uuid <11.1.1` (moderada,
GHSA-w5hq-g745-h8pq). Sin cambios respecto a lo ya investigado; la decisión
de no implementar colores/desplegables ya fue aceptada por el cliente en
una fase anterior. **Bloqueado por**: nada — no hay nada pendiente de hacer
aquí salvo que cambie esa decisión.

### 7. `_gdNum()` "0" vs "—" y otros detalles menores

**Parcialmente resuelto.** Las tarjetas KPI
(`public/js/dashboard-generic.js:452`) ya comprueban `null`/`undefined`
ANTES de formatear, así que hoy sí muestran "—" correctamente cuando no
hay dato — esto ya se corrigió en algún momento anterior, sin
documentarlo como tal. Pero las fórmulas de panel (`formula:{a,b}`, usadas
en paneles como "Ordenamiento Médico", "Recuperación de Cancelados" y
"STA por mes" — justamente paneles de las pestañas de esta fase) siguen
llamando a `_gdNum()` sin comprobar `null` antes
(`dashboard-generic.js:87,94`): si un mes no trae el campo `a` o `b`, hoy
se trata como `0` en vez de mostrarse como "—", lo que puede pintar un 0 %
o una división rara en vez de un hueco. El propio archivo ya tiene el
patrón correcto en otro lado (líneas 944 y 1079: comprueban `null`/`undefined`
antes de dividir) — solo falta aplicarlo también en 87/94. **Esfuerzo**:
pequeño. **Bloqueado por**: nada, se puede hacer ya.

### 8. Números de ORLANT después de la Fase 72

- **Local — verificado hoy en vivo**: Llamadas **8.061 / 7.159 / 902**
  (88,81 % nivel de atención) y WhatsApp **7.305 / 7.109 / 196** (97,32 %).
  Coinciden EXACTO con la referencia. Sin cambios.
- **Producción — no pude verificarlo sin crear un workflow nuevo** (regla
  explícita de esta fase). El workflow genérico de solo lectura que se
  usaba para esto (`diagnostico-dashboard-produccion.yml`) fue **retirado
  en la Fase 72** (PR #141, uno de los 13 workflows de un solo uso que se
  quitaron) — confirmado con `git log --diff-filter=D`. Ningún workflow que
  quede hoy (`audit-instance`, `seed-demo`, `verificar-logs-produccion`,
  `verificar-restore-backup-produccion`) puede dar este dato. Si hace falta
  reconfirmar producción, habría que crear (con tu autorización explícita,
  fuera de esta fase) un workflow de solo lectura equivalente.

## Tabla resumen — todo lo que falta

| # | Pendiente | Esfuerzo | Bloqueo |
|---|---|---|---|
| **A — Se puede hacer ya (no depende de nadie)** | | | |
| A1 | WhatsApp: agregar confirmación antes de sobrescribir (mismo patrón de voz) | Pequeño | Nada |
| A2 | `_gdNum()` en fórmulas de panel (`dashboard-generic.js:87,94`): comprobar `null` antes de dividir | Pequeño | Nada |
| A3 | `PUT /dashboards/config/:cliente`: agregar `oculta`/`subtabs` al schema de validación (hallazgo nuevo) | Pequeño | Nada |
| A4 | `mobile-app/`: mover el keystore fuera del repo + agregar `.gitignore` (hallazgo nuevo) | Pequeño | Nada |
| A5 | `PROGRESS.md`: agregar retroactivamente el resumen de las Fases 72/73 | Pequeño | Nada |
| **B — Depende de Edwin (qué dato exactamente)** | | | |
| B1 | Archivo real de **Salida** (fecha, salida_general, salida_3p, wpp_salida_general, wpp_salida_3p — diario) | Pequeño (activar, una vez llegue) | Dato de Edwin |
| B2 | Archivo real de **Tipificación** (linea 3P/GENERAL, tipificación, cantidad) — y confirmar las categorías reales (el glosario de solo 2 códigos puede quedar corto) | Pequeño | Dato de Edwin |
| B3 | Archivo real de **Gestión STA por categorías** (dimensión SERVICIO/ESTADO/MES_ACTUAL) | Pequeño | Dato de Edwin |
| B4 | Confirmar si ALGUNA de las 37 filas de Calidad en producción es real | — | Dato de Edwin |
| **C — Depende de una decisión tuya** | | | |
| C1 | ¿Revivir "Flujo Mensual" (duplica datos ya visibles en Tráfico) o dejarla enterrada? | — | Decisión tuya |
| C2 | "Metas Calidad → Tráfico/Wolkvox": ¿adaptarla (mediano) o quitarle el botón de carga (pequeño)? | Mediano o pequeño | Decisión tuya |
| C3 | Autorizar la limpieza (con backup) de los 37 monitoreos de prueba, una vez Edwin confirme (B4) | Mediano | Decisión tuya + B4 |
| C4 | Autorizar un nuevo workflow de solo lectura si hace falta reconfirmar números de ORLANT en producción | Pequeño | Decisión tuya |
| **D — Depende de AWS (permisos)** | | | |
| D1 | `s3:ListBucket` para `inconexion-instance` sobre `inconexion-backups-877538609452` (prueba de restauración) | — | Permiso AWS |
| D2 | `logs:FilterLogEvents` (+ opcional `GetLogEvents`) para `inconexion-github-deploy` sobre `/inconexion/prod/docker` y `/inconexion/prod/backup` | — | Permiso AWS |

## Recomendación — con ~1 semana, foco solo ORLANT

1. **Hoy mismo, en paralelo** (no dependen entre sí): pídele a Edwin los 3
   archivos que faltan (B1-B3) — son el verdadero cuello de botella para
   cerrar las 7 pestañas — y agrega los 2 permisos de AWS (D1-D2) en la
   consola de IAM (5 minutos), para desbloquear la verificación real de
   backups/logs de la Fase 72.
2. **Un solo PR chico** con las correcciones de la columna A (A1-A5):
   son pequeñas, seguras, no esperan a nadie, y A3 en particular vale la
   pena cerrarla antes de que alguien construya una pantalla de admin de
   dashboards sobre ese endpoint roto.
3. **Decisiones rápidas** (C1, C2): son de bajo esfuerzo en cualquiera de
   las dos opciones — más vale decidir ya que dejarlas abiertas.
4. Cuando lleguen los archivos de Edwin (B1-B3): activar cada pestaña
   (quitar `oculta:true` + migración idempotente, mismo patrón ya usado en
   la Fase 71) y probarla igual que hoy, pero con datos reales.
5. **Al final de la semana**, si Edwin ya confirmó sobre los 37 monitoreos
   (B4): ejecutar la limpieza con backup (C3). No conviene adelantarla sin
   esa confirmación.
