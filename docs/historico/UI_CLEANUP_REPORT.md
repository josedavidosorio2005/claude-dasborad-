# UI_CLEANUP_REPORT — InConexión Platform

Mejora de interfaz (clara e intuitiva), buenas prácticas y limpieza de código.
**No se agregó ninguna funcionalidad de negocio nueva. No se tocó la lógica de permisos
ni las reglas de acceso por rol.**

Fecha: 2026-09-09

---

## 1. Resumen de lo que se hizo

| Paso | Estado | Qué incluyó |
|---|---|---|
| 0 — Quitar datos sensibles de ejemplo | ✅ | Eliminados `<script id="app-data">` (usuarios + contraseñas en texto plano) y `<script id="hist-data">`. Verificado con `grep` que nada los referenciaba. |
| 2 — Design tokens | ✅ | `:root{}` en `public/css/styles.css` como única fuente de verdad de color, tipografía, espaciado y radios. Literales repetidos (`#0d4a5e` ×47, `#1a7a9e` ×19, sombras `rgba(13,74,94,…)` ×18, degradados de marca, fuente) sustituidos por `var(--token)` del **mismo valor** (idéntico a la vista). |
| 3 — Mejoras de UI | ✅ (parcial, ver §3) | Estados de carga en botones de acción, estados vacíos con siguiente paso, tratamiento visual "Próximamente", mensajes de error de API traducidos a lenguaje de usuario. |
| 4 — Limpieza de código | ✅ | CSS embebido → `public/css/styles.css`. `<script>` monolítico (2 758 líneas) → 17 módulos por dominio en `public/js/`. Chart.js + plugin (antes inline minificados) → `public/js/vendor/`. Bloque CSS duplicado exacto (56 líneas) eliminado. `index.html` 4 485 → 1 301 líneas. |
| 6 — Este informe | ✅ | — |

Los pasos 1 y 5 (auditoría escrita + verificación por rol) están recogidos en §2 y §6.

---

## 2. Auditoría UX — problemas encontrados por rol

Recorrido de la app como cada rol. `✅ resuelto` = corregido en esta tarea.
`➡️ follow-up` = documentado, se aborda después (cambio de negocio o riesgo alto sin QA visual).

### Transversal (todos los roles)

| # | Problema | Estado |
|---|---|---|
| T1 | Botones de módulo "en desarrollo" (Inventario, Gerencia) se veían **idénticos** a los activos; al pulsarlos solo salía un toast fugaz. El usuario no sabía si era un fallo o que no existe. | ✅ resuelto — atenuados + etiqueta fija **"Próximamente"** en la esquina; el toast ahora explica ("todavía no está disponible, te avisaremos"). |
| T2 | Dashboards de cliente sin construir (9 de 12) abrían un toast "en desarrollo" indistinguible de un cliente real. | ✅ resuelto — `BUILT_CLIENT_DASHBOARDS` marca los 3 reales (Aurora, Orlant, Hospital La María); el resto se muestra atenuado con **"Próximamente"**. |
| T3 | Mensajes de error genéricos: `Error 500`, `Error 429`, `Failed to fetch` llegaban crudos al usuario. | ✅ resuelto — `friendlyHttpError()` en `api.js` traduce 401/403/404/409/429/5xx; el fallo de red dice "No se pudo conectar con el servidor. Revisa tu conexión". |
| T4 | Acciones asíncronas (guardar usuario, cambiar contraseña, eliminar) no daban feedback: doble clic posible, sin indicación de "procesando". | ✅ resuelto — `withButtonLoading()` deshabilita el botón y cambia el texto ("Guardando…", "Eliminando…") mientras corre la petición. |
| T5 | Tablas vacías mostraban una franja de texto plano ("No se encontraron usuarios.") sin decir qué hacer. | ✅ resuelto — componente `.empty-state` (icono + título + siguiente paso). Distingue "aún no hay datos" de "sin coincidencias con el filtro". |
| T6 | Colores y sombras repartidos como literales por todo el CSS → difícil mantener coherencia entre pantallas. | ✅ resuelto — design tokens (§4). |
| T7 | ~144 `style=""` en línea dentro del HTML y ~80 literales de color dentro de plantillas JS. | ➡️ follow-up — inventariados; se migran a clases de forma incremental. No bloquean el uso y moverlos sin QA visual es arriesgado. |
| T8 | Accesibilidad: `onclick` en `<div>`/`<a>` sin `role`/`tabindex`, contraste no auditado, sin `aria-label` en iconos-botón. | ➡️ follow-up — requiere prueba con lector de pantalla y teclado. |
| T9 | Responsive ~375 px: los modales de dashboard (Aurora/Orlant/HLM) tienen tablas anchas; hay `@media(max-width:700px)` y `520px` pero no un repaso a 375 px. | ➡️ follow-up — necesita verificación visual en dispositivo. |

### ADMIN / Admin maestro

| # | Problema | Estado |
|---|---|---|
| A1 | Al entrar, si el servidor tarda, la tabla de usuarios queda en blanco sin aviso. | Parcial — el botón "Ingresar" ya muestra "Ingresando…"; si `GET /users` falla se muestra toast. Fila de carga en tabla: helper `tableLoadingRow()` disponible, aplicación completa = follow-up. |
| A2 | "Restablecer" (solo admin maestro) no explicaba qué borra. | Sin cambio de comportamiento (ya redirige a hacerlo desde el servidor con aviso). |
| A3 | Modal de eliminar: confirmación ya clara ("Esta acción no se puede deshacer. Quedará registro en el Historial"). | ✅ ya correcto — se mantiene y ahora el botón pasa a "Eliminando…". |

### AUX_ADMIN

| # | Problema | Estado |
|---|---|---|
| X1 | Acciones sin permiso se muestran con `🔒` y `disabled` — comportamiento correcto y **no se tocó** (regla del encargo). | ✅ sin cambios (intencional). |
| X2 | Banner "Modo Auxiliar Admin" es claro. | Sin cambios. |

### CALIDAD / REPORTES

| # | Problema | Estado |
|---|---|---|
| C1 | En la lista de usuarios, "Sin campañas asignadas" ya se marca en rojo. | Sin cambios (ya informativo). |
| C2 | Módulo de Calidad: selects de campaña/mes vacíos al abrir sin datos; sin estado vacío en tablas de monitoreos/resumen. | ➡️ follow-up — el módulo de Calidad usa `localStorage` y su backend es parte de "otra tarea". |

### CLIENTES_DASH

| # | Problema | Estado |
|---|---|---|
| D1 | Rejilla de clientes: sin acceso vs sin construir eran indistinguibles. | ✅ resuelto (T2). "Sin acceso" (bloqueado) y "Próximamente" (atenuado, clicable con explicación) ahora son estados visuales distintos. |
| D2 | Rejilla vacía: texto plano gris. | ✅ resuelto — `.empty-state` con siguiente paso ("Solicita al administrador acceso…"). |

### GERENCIA / INVENTARIO

| # | Problema | Estado |
|---|---|---|
| G1 | Módulos marcados como "Próximamente" (T1). GERENCIA además ve Calidad en solo lectura — sin cambios de lógica. | ✅ tratamiento visual; funcionalidad = otra tarea. |

### SUPERVISOR

| # | Problema | Estado |
|---|---|---|
| S1 | "Mis Dashboards" no distinguía cliente real de cliente sin informe. | ✅ resuelto — misma marca "Próximamente" que en CLIENTES_DASH. |
| S2 | Estado vacío de "Mis Dashboards" era texto plano. | ✅ resuelto — `.empty-state`. |
| S3 | Tabla "Mi Meta de Monitoreo": mensajes "Sin campañas asignadas" ya presentes. | Sin cambios. |

### ASESOR

| # | Problema | Estado |
|---|---|---|
| E1 | "Mis Resultados de Calidad": sin estado vacío cuando no hay monitoreos del mes. | ➡️ follow-up — depende del módulo de Calidad (otra tarea). |

---

## 3. Mejoras de UI aplicadas (Paso 3) — detalle

1. **Estados de "Próximamente"** — `public/js/constants.js`, `public/js/dashboards-core.js`, `public/js/session.js`, CSS `.badge-soon` / `.dash-soon` / `.client-soon`.
   - `DASH_MODULES`: `soon:true` en Inventario y Gerencia.
   - `BUILT_CLIENT_DASHBOARDS`: lista blanca de los 3 dashboards de cliente construidos.
   - `renderDashGrid()` ahora produce 3 estados diferenciados: *disponible* / *sin acceso* (`.disabled-btn` + "Sin acceso", no clicable) / *próximamente* (`.mod-soon` + "Próximamente", clicable → explica).
   - `openClientsModal()` y `renderSupervisorClientsGrid()` aplican el mismo patrón.

2. **Estados de carga** — `public/js/ui-core.js` (`withButtonLoading`, `tableLoadingRow`), aplicado en `public/js/users.js` (`saveUserModal` crear/editar, `savePass`, `confirmDelete`).
   - El botón se deshabilita (evita doble envío) y muestra "Guardando…" / "Cambiando…" / "Eliminando…". Se restaura aunque la petición falle (`finally`).
   - `doLogin()` ya tenía este patrón desde antes; se mantiene.

3. **Estados vacíos con siguiente paso** — componente CSS `.empty-state`, aplicado en:
   - Tabla de usuarios (`renderUsers`): distingue "Aún no hay usuarios → crea el primero" de "Sin coincidencias → prueba otra búsqueda".
   - Historial (`renderHist`): "Sin eventos todavía → aparecen aquí automáticamente" vs "Sin coincidencias con el filtro".
   - Rejilla de clientes (dashboard y supervisor).

4. **Mensajes de error de API legibles** — `public/js/api.js`:
   - `fetch` que rechaza (red/CORS/servidor caído) → mensaje único claro en vez de `TypeError: Failed to fetch`.
   - Respuestas `!ok` sin `error` del servidor → texto por código (401 sesión expirada, 403 sin permiso, 429 demasiados intentos, 5xx problema del servidor…).
   - Si el servidor **sí** manda `data.error`, ese texto tiene prioridad (no se pierde información útil).

5. **Confirmaciones destructivas** — el modal de eliminar ya tenía copy correcto ("no se puede deshacer, queda en el Historial"); se conserva y se le añade el estado de carga.

### Lo que quedó pendiente del Paso 3 (follow-up)

- Fila de carga (`tableLoadingRow`) en la tabla de usuarios/historial durante `loadData()`/`loadHist()` — el helper está listo, falta cablearlo; hoy el feedback lo da el botón de login.
- Patrón único de "volver/cerrar" en todos los modales: hoy conviven `X Cerrar` (dashboards), `Cancelar` (modales de formulario) y `← Volver a Roles` (permisos). Son coherentes dentro de su tipo; unificar iconografía es cosmético y se deja para el repaso de accesibilidad.
- Estados vacíos dentro del módulo de Calidad y del portal Asesor (dependen de "otra tarea").

---

## 4. Estructura de código — antes / después

### Antes

```
public/index.html   4 485 líneas
  ├── <style> … </style>                (~430 líneas de CSS embebido, con un bloque duplicado)
  ├── <script id="app-data">            usuarios + CONTRASEÑAS EN TEXTO PLANO  ← riesgo
  ├── <script id="hist-data">           historial de ejemplo
  ├── <script> Chart.js 4.4.1 </script>            (minificado, inline)
  ├── <script> chartjs-plugin-datalabels </script> (minificado, inline)
  └── <script> … 2 758 líneas … </script>          (toda la app en un bloque)
```

### Después

```
public/
  index.html                 1 301 líneas (estructura + ~600 KB de logos base64 en línea *)
  css/
    styles.css               :root{} design tokens  +  estilos (sin duplicados)
  js/
    vendor/
      chart.umd.min.js                 Chart.js 4.4.1 (UMD, pin exacto)
      chartjs-plugin-datalabels.min.js
    api.js            API_BASE, apiRequest, friendlyHttpError
    constants.js      CLIENTES_LIST, CAMPANAS_CALIDAD, DASH_MODULES, BUILT_CLIENT_DASHBOARDS, roles…
    state.js          users/historial/currentUser, buildPerms, ensurePerms, loadData, loadHist
    session.js        login/logout, enter*Page, showSection por portal
    ui-core.js        can/canAccessRole, showSection, showToast, withButtonLoading, tableLoadingRow
    users.js          tabla + modal crear/editar + password + suspender + eliminar
    roles-perms.js    rejilla de roles + tabla de permisos + permisos de AUX_ADMIN
    historial.js      render + filtros del historial
    dashboards-core.js  renderDashGrid, onDashBtn, modal de clientes
    dashboard-aurora.js / dashboard-orlant.js / dashboard-hlm.js
    calidad.js        módulo de Calidad (monitoreos, resúmenes, reportes)
    metas.js          cronograma y metas de monitoreo
    reportes.js       permisos del rol REPORTES
    mis-resultados.js portal del asesor
    charts.js         helpers de Chart.js (paletas, mk, loBar/loPie…) + registro
```

`*` Los logotipos del login/navbar siguen como `data:` URI en línea (~600 KB). Moverlos a
`public/img/` es una mejora de rendimiento pura, sin efecto visual; se deja como follow-up
opcional para no arriesgar la verificación de esta tanda.

### Orden de carga de scripts (fijo, sin bundler)

`vendor/chart` → `vendor/datalabels` → `Chart.register` → `xlsx` (CDN) → `api` → `constants`
→ `state` → `session` → `ui-core` → `users` → `roles-perms` → `historial` → `dashboards-core`
→ `dashboard-aurora` → `dashboard-orlant` → `dashboard-hlm` → `calidad` → `metas` → `reportes`
→ `mis-resultados` → `charts`.

Todas las funciones siguen siendo globales y se invocan desde los `onclick=` del HTML
(66 en total). No se introdujo framework ni bundler, según el encargo.

---

## 5. Decisiones de diseño y su porqué

| Decisión | Por qué |
|---|---|
| **Tokens = mismo valor exacto que los literales que reemplazan.** | El encargo pide unificar *sin* cambiar la identidad de marca por cliente ni el aspecto. Un reemplazo hex→`var()` idéntico es verificable (mismo píxel) y reversible. |
| **"Próximamente" como estado clicable, no como botón muerto.** | Un botón que no hace nada al pulsarlo se percibe como fallo. Clicable + toast explicativo comunica intención ("existe, aún no"). |
| **Lista blanca `BUILT_CLIENT_DASHBOARDS` en vez de flag por cliente.** | Los 3 dashboards construidos están cableados en `openClientByEl` con `if (c === 'ORLANT') …`. Una lista al lado de esa función es la fuente de verdad más cercana al código que decide. |
| **`withButtonLoading` con `try/finally`.** | Garantiza que el botón se rehabilita aunque la API falle; sin `finally` un error dejaría el botón bloqueado para siempre. |
| **Traducir errores en `api.js`, no en cada `catch`.** | Un solo punto: cualquier `showToast(e.message)` existente hereda el mensaje legible sin tocarlo. |
| **Estados vacíos que distinguen "vacío" de "sin coincidencias".** | Son situaciones distintas con acciones distintas (crear un dato vs. cambiar el filtro). |
| **Split incremental verificado con carga simulada.** | Sin herramienta de navegador, se validó con `node --check` (sintaxis), un cargador en `vm` con DOM simulado (19 archivos en orden, 0 errores, 23 funciones clave definidas) y cobertura de `onclick`/`getElementById`/`<script src>`. |

---

## 6. Verificación realizada

| Comprobación | Resultado |
|---|---|
| `node --check` en los 17 módulos + 2 vendor | ✅ todos OK |
| Carga simulada (DOM en `vm`, orden real de `index.html`) | ✅ 19/19 sin error, 23/23 funciones globales clave definidas |
| Cobertura `onclick` → función definida | ✅ 49/49 |
| Cobertura `getElementById('id')` → id existe en HTML | ✅ 153/153 |
| `<script src>` locales existen | ✅ 19/19 |
| CSS: llaves balanceadas, todas las `var()` definidas | ✅ |
| Servidor sirve `index.html`, `css/styles.css`, `js/*.js` | ✅ 200 + content-type correcto |
| `npm test` (backend, `server/`) | ✅ **29/29** |

### Verificación visual pendiente (requiere navegador — la debe hacer una persona)

Recorrer en `http://localhost:8090` con **Ctrl+F5**:

1. `admin` — tabla de usuarios, crear/editar (ver "Guardando…"), Permisos, Historial.
2. `agomez / cli123` (CLIENTES_DASH) — rejilla de clientes: Aurora/Orlant/Hospital La María abren; el resto se ve "Próximamente".
3. Dashboard de usuario — Inventario y Gerencia se ven atenuados con "Próximamente".
4. Un rol SUPERVISOR — "Mis Dashboards" con el mismo tratamiento.
5. Provocar un error (p. ej. parar el servidor y guardar) → mensaje legible, no `Failed to fetch`.
6. Que los colores se vean **igual** que antes (los tokens son de valor idéntico).

---

## 7. Lo que NO se tocó — a propósito

- **Lógica de permisos y acceso por rol** — ni `can()`, ni `canAccessRole()`, ni `buildPerms()`,
  ni `requireAuth`/`requirePermission` del backend. Regla explícita del encargo.
- **Módulo de Inventario** — no existe; solo se marca "Próximamente".
- **Módulo de Gerencia** — íd. (más allá de la vista de Calidad en solo lectura que ya tenía).
- **9 dashboards de cliente sin construir** (Televentas Sura, Televentas Comfama, Pantera Maikers,
  Andrés Yepes, Movilize, Sascha Fitness, Alberto Linero Go, Infondo, Bivett) — solo "Próximamente".
- **Backend de Calidad / Metas** — el módulo de Calidad sigue sobre `localStorage`; su persistencia
  en servidor es "otra tarea".
- **Deduplicación de los patrones de gráficas Aurora/Orlant/HLM** — repiten estructura de tabs y
  render, pero extraer una función común sin poder verificar cada gráfica en pantalla es arriesgado.
  Recomendado como follow-up con QA visual.
- **~144 `style=""` en línea del HTML y ~80 literales de color en plantillas JS** — inventariados;
  migración incremental a clases pendiente.
- **Logos base64 en línea (~600 KB)** — mover a archivos es mejora de rendimiento, no de UI.
- **Accesibilidad (roles ARIA, foco de teclado, contraste) y responsive fino a 375 px** —
  requieren pruebas con lector de pantalla / dispositivo real.
- **Sin framework, sin bundler** — según el encargo.
