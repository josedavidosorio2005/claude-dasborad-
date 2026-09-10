# SECURITY_FIX_REPORT — XSS almacenado en el frontend

Fecha: **2026-09-10**
Alcance: cierre del único hallazgo real de la auditoría de seguridad
(datos / seguridad / escalabilidad / documentación). El resto quedó verde:
68/68 tests previos, `npm audit` limpio, sin SQL injection, permisos server-side
sólidos, Docker/CI correctos.

---

## 1. El hallazgo — XSS almacenado (stored XSS)

### Descripción

En todo `public/js/*.js` el patrón dominante era construir HTML por concatenación
de strings y asignarlo con `innerHTML =` / `innerHTML +=` (y un `document.write`
en la exportación a PDF), **sin escapar nunca** los valores que provienen de
datos:

- **Texto libre** que un usuario escribió: nombre de asesor, `idLlamada`,
  `codificacion`, `evaluador`, observaciones (Calidad); nombre/descripción/
  proveedor/ubicación de ítems (Inventario); nombre/observaciones de KPI
  (Gerencia); `liderNombre` (cronograma de metas); nombre/usuario de usuarios;
  detalle/actor del log de auditoría; título y textos de configuración de
  dashboards.
- **Celdas de Excel** parseadas en el navegador (`XLSX.utils.sheet_to_json`) y
  renderizadas: `dashboard_cargas.filas`, ítems y movimientos de inventario, KPIs
  de gerencia, preview de carga.

`server/validation.js` (zod) sólo limita **longitud y formato**; en los campos de
texto libre permite caracteres HTML **a propósito**. El problema es de **salida
(render)**, no de entrada — la solución correcta es escapar en el momento de
insertar en el DOM, no restringir caracteres en el backend.

### Impacto

Un valor como `<img src=x onerror="…">` o `<script>…</script>` guardado como
"nombre de asesor" o en una celda de un Excel se ejecuta en el navegador de
**cualquiera** que abra esa tabla después, incluido un ADMIN (robo de sesión vía
`document.cookie`, acciones administrativas con el token de la víctima, etc.).

El CSP **no** lo mitiga: `script-src` ya incluye `'unsafe-inline'` (necesario por
los ~105 `onclick` inline existentes). Endurecer el CSP es un proyecto aparte y
**no** forma parte de este arreglo.

---

## 2. El arreglo — de raíz

### 2.1 Función central de escape

Nuevo **`public/js/esc.js`**:

```js
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { esc: esc };
```

- Escapa `& < > " '` → cubre el contexto de **texto** y el de **atributo** (comilla
  simple y doble).
- Se carga en `public/index.html` **antes** que cualquier módulo de render
  (justo después del CDN de xlsx, antes de `js/api.js`).
- Modo dual: global en el navegador, `require()` en Node para la prueba de
  regresión.

### 2.2 Auditoría y corrección de cada sink

Se revisó **todo** `public/js/` buscando `innerHTML` / `innerHTML +=` /
`document.write` y se aplicó `esc()` a cada valor que viene de datos. **No** se
escaparon los literales de HTML propios (`'<tr><th>Asesor</th>…'`) ni los valores
de `constants.js` (`CLIENTES_LIST`, `CAMPANAS_CALIDAD`, `DASH_MODULES`, roles) —
son de confianza. Los `onclick="fn('+id+')"` con IDs numéricos no tienen riesgo y
se dejaron igual.

| Archivo | Correcciones |
|---|---|
| `public/js/esc.js` | **nuevo** — helper central |
| `public/index.html` | + `<script src="js/esc.js">` (primero de los módulos de app) |
| `public/js/calidad.js` | tabla de monitoreos (`asesor`, `idLlamada`, `codificacion`, `evaluador`), tabla resumen, select de asesor, select de campañas, form de ítems, tabla de permisos (`nombre`/`user`), `liderNombre` (config, supervisión, cumplimiento), tabla de monitoreos por líder |
| `public/js/dashboard-generic.js` | `_gdKpiCardHtml` (`titulo`), opciones de vista, títulos de panel (tabla y gráfico), cabeceras y **celdas de la tabla de datos** (`f[c.key]`), y **`_gdExportPrint`** — `titulo`, `cliente`, `Indicador`, `Alerta`, `pan.titulo`, claves de columna y **cada celda** (`esc(_fmtCell(...))`), `tab.label` |
| `public/js/inventario.js` | tabla de ítems y su versión admin (`nombre`, `descripcion`, `categoria`, `unidad`, `ubicacion`, `estado`, `proveedor`), tabla de movimientos (`item.nombre`, `motivo`, `registradoPorNombre`), select de categorías, select de ítems de movimiento |
| `public/js/gerencia.js` | paneles por categoría y tablas (`cat`, `k.nombre`, `k.categoria`, `k.unidad`, `k.observaciones`, `k.periodo`) — **+ fix de sintaxis** (ver §2.4) |
| `public/js/cargas.js` | select de clientes y de secciones, avisos que embeben `row[0]` de una fila no reconocida, cabeceras y **celdas del preview** (`f[c.key]`), tabla de cargas existentes (`cargadoPorNombre`, `periodo`, `cadencia`, `cargadoEn`) |
| `public/js/users.js` | tabla de usuarios (`nombre`, `user`, `asesorCampana`, `rol`, `createdAt`) |
| `public/js/historial.js` | tabla del log de auditoría (`nombre`, `username`, `rol`, `accion` — texto y clase CSS, `actor`, `detalle`, `fecha`) |
| `public/js/metas.js` | select de responsable (`nombre`, `rol`), tabla del cronograma (`liderNombre`, `campana`, `mes`) |
| `public/js/reportes.js` | matriz de rol REPORTES (`nombre`, `user`) |
| `public/js/mis-resultados.js` | tabla de "mis monitoreos" (`campana`, `evaluador`), detalle de ítems (`cat`, `it.label`, respuesta) |
| `public/js/dashboards-admin.js` | **se reemplazó el helper local `_esc`** (no escapaba `>` ni `'`) por `esc` global; listado de configs (`titulo`), `_dcEditCliente` y nombres de cliente en el `<select>`, `<textarea>` de opciones de vista, label de panel avanzado, `_opt()` con claves de sección |
| `public/js/roles-perms.js` | tabla de permisos por rol y bloque de AUX_ADMIN (`nombre`, `user`) |

Revisados y **sin cambios necesarios** (fuente = `constants.js` o sink =
`.textContent` / `input.value`): `api.js`, `state.js`, `constants.js`, `charts.js`,
`session.js`, `ui-core.js`, `dashboards-core.js`, y `mis-resultados.js`
`verDetalleMonitoreo()` (ya usaba `.textContent`, es el patrón modelo).

### 2.3 `on*` con texto libre → `data-*` + `addEventListener`

Escapar HTML **no basta** dentro de un atributo de evento: el parser HTML decodifica
las entidades antes de que corra el JS, así que `&#39;` vuelve a ser `'` y permite
romper el string. Los 3 sitios que interpolaban texto libre en un `on*` se
convirtieron a atributo `data-*` (escapado con `esc()`) + un listener delegado:

1. **`calidad.js`** — botón "Supervisar" de la tabla de cumplimiento:
   `verSupervisionLider(…, liderNombre)` → `data-campana` / `data-mes` /
   `data-lider` + listener en `#cal-cumplimiento-table`.
2. **`dashboards-admin.js`** — botones Editar/Eliminar del listado de dashboards:
   `openDashCfgModal(r.cliente)` / `deleteDashCfg(r.cliente)` → `data-dcaction` /
   `data-cliente` + listener en `#dashcfg-tbody`.
3. **`dashboard-generic.js`** — pestañas del dashboard: `switchGenericTab(t.key)` →
   `data-gdtab` + listener en `#gd-tabs` (se eliminó el `onclick` inline).

No se tocó ningún otro `onclick` inline (los ~105 restantes usan IDs numéricos o
literales) ni el CSP.

### 2.4 Fix colateral — sintaxis rota en `gerencia.js`

`gerDescargarPlantilla()` tenía un array `aoa` al que le faltaba el `]` de cierre
(`… ,'']` en vez de `… ,'']]`). Era un **error de sintaxis** que impedía parsear
`public/js/gerencia.js` **entero** en el navegador (el módulo de Gerencia no
cargaba). Corregido de un carácter. `node --check` pasa ahora en los 13 archivos
modificados.

---

## 3. Hallazgo menor — `GET /api/users`

**Antes:** `server/server.js` protegía `GET /api/users` sólo con `requireAuth`
(cualquier autenticado) y devolvía, de **todos** los usuarios, la matriz de
permisos completa (`perms`). No filtraba secretos (nunca hubo `password_hash`), pero
exponía qué puede hacer cada quién.

**Decisión: filtrar el payload por rol.** `GET /api/users` pasa a `requireActor` y:

```js
const fullView =
  isFullAdmin(req.actor) ||
  can(req.actor, 'gestionPermisos') ||
  can(req.actor, 'crearUsuarios') ||
  can(req.actor, 'editarUsuarios');
res.json(rows.map(toPublicUser).map((u) => (fullView ? u : { ...u, perms: {} })));
```

- Los solicitantes que **no** administran usuarios ni permisos reciben la lista con
  `perms: {}` (objeto vacío, no se omite la clave, para no romper `ensurePerms()`
  ni los accesos `u.perms[...]` en el frontend).
- **Por qué no rompe los selects:** los únicos consumidores de `perms` de *otros*
  usuarios son pantallas de rol privilegiado — el `<select>` de líder en Metas sólo
  es funcional para `isFullAdmin` (`POST /metas` exige `isFullAdmin`), y la matriz
  de REPORTES y `roles-perms.js` son pantallas de administración. El `<select>` de
  asesor en Calidad usa `asesorCampana`, que se conserva.

**Tests** (`server/tests/permissions.test.js`, 2 nuevos):

- `lrios` (AUX_ADMIN sin permisos) → `GET /api/users` = 200; cada objeto trae
  `id`/`nombre`/`rol`, `perms` es `{}`, sin `password_hash`/`password`.
- `admin` → 200 y al menos un `perms` poblado.

`no-password-leak.test.js` y `role-matrix.test.js` siguen pasando sin cambios (no
dependían de `perms`).

---

## 4. Verificación

### 4.1 Automatizada

```
cd server
npm test    →  ℹ tests 73 / ℹ pass 73 / ℹ fail 0
npm audit   →  found 0 vulnerabilities
```

73 = 68 previos + 2 (`GET /api/users`) + 3 (`xss-frontend.test.js`).

`node --check` sobre los 13 archivos JS modificados: OK (incluye `gerencia.js`,
antes con sintaxis rota).

`server/tests/xss-frontend.test.js` fija el contrato de `esc()`:

- `esc('<img src=x onerror=alert(1)>')` → `'&lt;img src=x onerror=alert(1)&gt;'`
- `esc('<script>alert(document.cookie)</script>')` →
  `'&lt;script&gt;alert(document.cookie)&lt;/script&gt;'`
- `esc('" onmouseover="alert(1)')` → `'&quot; onmouseover=&quot;alert(1)'`
- `esc("'); alert(1); //")` → `'&#39;); alert(1); //'`
- texto normal, `null`, `undefined`, números → sin cambios / `''` / string
- una fila `'<tr><td>'+esc(payload)+'</td></tr>'` no contiene `<img>` real

### 4.2 Manual end-to-end

Servidor levantado en local (`node bootstrap.js`), login como admin, vía API:

**Paso 1 — crear un monitoreo con payloads en campos de texto libre**

```
POST /api/monitoreos
  asesor    = "<img src=x onerror=alert(1)>"
  idLlamada = "<script>alert(document.cookie)</script>"
  observaciones = "<b>x</b>"
=> 201 Created
```

**Paso 2 — leerlo de vuelta** (el backend guarda el valor **crudo**, correcto — el
arreglo es de render):

```
GET /api/monitoreos?campana=ORLANT
  asesor    = "<img src=x onerror=alert(1)>"
  idLlamada = "<script>alert(document.cookie)</script>"
```

**Paso 3 — render con `esc()`** (mismo patrón que `renderCalMonitoreosTable()`):

```html
<tr><td>&lt;img src=x onerror=alert(1)&gt;</td><td>2026-09-10</td><td>&lt;script&gt;alert(document.cookie)&lt;/script&gt;</td></tr>
```

→ **RESULTADO: OK** — el HTML resultante no contiene ninguna etiqueta ejecutable
(`<img>` / `<script>`); el payload se muestra como texto literal. El navegador no
dispara `onerror` sobre `&lt;img…&gt;`.

El mismo razonamiento aplica a Inventario, Gerencia, la tabla de un dashboard de
cliente y la **exportación a PDF** (`_gdExportPrint` envuelve cada valor —
incluidas las celdas de Excel vía `esc(_fmtCell(...))` — antes del
`document.write`).

### 4.3 Checklist de comprobación visual manual (para QA en navegador)

- [ ] Calidad: monitoreo con asesor `<img src=x onerror=alert(1)>` y observaciones
      `<script>alert(document.cookie)</script>` → tablas "Monitoreos" y "Resumen"
      muestran el texto, sin `alert`.
- [ ] Inventario: ítem con nombre/observación con el payload → tabla y modales OK.
- [ ] Gerencia: KPI con nombre/observaciones con el payload → panel y tabla OK.
- [ ] Dashboard de cliente: Excel con una celda `<img src=x onerror=alert(1)>` →
      panel tipo tabla muestra el texto; **PDF / Imprimir** abre sin ejecutar el
      script.
- [ ] Datos normales (sin caracteres especiales) se ven **idénticos** a antes.

---

## 5. Fuera de alcance (deliberado)

- **No** se restringieron caracteres en `server/validation.js` — el arreglo
  correcto es de salida, no de entrada.
- **No** se endureció el CSP (`'unsafe-inline'` sigue por los ~105 `onclick`
  inline). Migrar esos handlers y quitar `'unsafe-inline'` es un proyecto aparte.
- No se tocaron `AWS_DEPLOY_REPORT.md`, `LAUNCH_REPORT.md` ni otros reportes.
