# PROGRESS — InConexion® Platform

Fuente de verdad del avance. Desde la Fase 112, este archivo es un
**resumen corto, que se actualiza en el sitio** (no aditivo) — el detalle
narrativo de cada fase, fase por fase, vive en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
(aditivo, nunca se reescribe — ver `CLAUDE.md` → "Bitácora").

## Estado actual

- **Versión**: `1.26.0` (ver `server/package.json`, expuesta en
  `/api/health` y en el menú de usuario de cada página).
- **Marca**: logo/isotipo en `public/img/marca/` (originales de diseño
  fuera del repo, nunca commiteados), favicon en `public/favicon*`,
  tipografía Quicksand autoalojada en `public/fonts/`, tokens de color
  oficiales al inicio de `public/css/styles.css` (`--c-brand`,
  `--c-brand-blue`, `--c-brand-green`, `--c-brand-gray-*`) — Fase 132.
  El nombre se escribe siempre "InConexion®" (sin tilde, con ®) — Fase
  132 (cierre), 4 pruebas nuevas en
  `server/tests/fase132-07-marca-registrada.test.js` que fallan si
  vuelve a aparecer "InConexión" o el nombre sin ® en `index.html`.
  Logo de Mobilize (provisional, ver `docs/pendientes.md`) en el
  encabezado de su propio dashboard, nunca en los demás clientes —
  Fase 132 (Parte 8), `public/img/clientes/mobilize-logo.png` + `@2x`,
  prueba en `server/tests/fase132-08-logo-mobilize.test.js`. Verificado
  en producción real (login de administrador, Playwright visible):
  logo visible solo en MOBILIZE, 0 errores de consola.
- **Sistema de diseño / accesibilidad WCAG 2.1 AA** (Fase 133, ampliado
  en la Fase 136 con tokens/especificación de movimiento y componentes
  base): [`docs/sistema-de-diseno.md`](docs/sistema-de-diseno.md) —
  tokens de color/tipografía/foco/objetivos táctiles, regla del semáforo
  vs. paleta categórica, cómo agregar un color nuevo sin romper el
  contraste, duraciones/easings/interruptor `data-motion="off"` y los
  6 modales unificados.
- **Producción**: `https://informa.inconexion.com.co` (único dominio
  desde la Fase 93, 29/09/2026).
- **Foco actual**: **solo ORLANT y MOBILIZE** existen en producción —
  desde la Fase 134 (2026-10-08), los otros 12 clientes (que tenían 0
  filas de datos reales, solo configuración de plantilla vacía) se
  borraron del todo (`fase134_borrar_clientes_v1`, `CLIENTES_LIST` en
  `server/db.js` quedó en `[ORLANT, MOBILIZE]`) — no quedan "en cero",
  dejaron de existir en el código. Esa fase se cerró retroactivamente en
  la Fase 137 (incidente de proceso real: el PR se mergeó sin el
  dry-run/"OK borrar" planeados — ver
  [`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
  y la regla nueva en `CLAUDE.md`). **Desde la Fase 126**
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

### Fase 137 (en curso) — Cierra lo pendiente que se puede hacer desde el código

**Parte A (cerrada):** cierre retroactivo de la Fase 134 — ver su
entrada propia más abajo y en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md).

**Parte B (F07, cerrada):** en Gestión de Usuarios, los 4 botones del
mismo peso por fila (Editar/Contraseña/Suspender/Eliminar) se
reorganizan — "Editar" queda visible como acción principal,
"Cambiar contraseña"/"Suspender-Activar"/"Eliminar" se agrupan en un
menú (ícono de 3 puntos, SVG, patrón WAI-ARIA "menu button" —
`public/js/row-actions.js`, reutilizable). **Ningún permiso cambia** —
cada acción sigue gateada por exactamente la misma condición de antes
(`canEdit`/`canPass`/`canSusp`/`canDel`), solo se reorganiza dónde vive
el botón. Accesible por teclado completo (Enter/flechas/Escape, foco
vuelve al botón que abrió el menú), objetivos táctiles ≥44px en móvil,
sin desbordar a 412px — verificado en navegador real (Playwright):
Escape cierra y devuelve el foco, clic afuera cierra, elegir una acción
por teclado cierra el menú y dispara la acción real (confirmado con
"Cambiar contraseña", que abrió el modal de siempre). 17 pruebas
nuevas (`fase137-f07-menu-acciones-usuarios.test.js`, incluidos 2
retoques tras el "OK F07": `font-family:inherit` y cierre del menú al
hacer scroll/redimensionar) + regresión de Fase 133/136 en verde.
Versión `1.26.0`.

**Incidente real durante el merge de la Parte B**: PR #382 se mergeó
con un commit viejo — la API de GitHub (`head.sha`) quedó atrasada más
de 10 minutos tras un push real y confirmado (`git ls-remote`),
produciendo un deploy a producción sin los 2 retoques del "OK F07".
Corregido con un PR de fast-follow (#383) en minutos; regla nueva en
`CLAUDE.md` (`gh pr merge` siempre con `--match-head-commit`, verificado
contra `git ls-remote` antes).

**Parte C (producción, solo lectura) — hallazgo real confirmado y
corregido:** `revision-final.js` original falló 2 veces (Fase 136) y una
3ª vez justo después de este deploy, siempre en el mismo punto (clic en
la 2ª pestaña de ORLANT, justo después de exportar). **Causa real
encontrada y reproducida en local** (commit actual vs. el commit justo
antes del PR #377): el Escape global que cierra modales (F04, Fase 136)
no distinguía un popup interno (`#gd-export-menu`, el menú de
"Exportar") de los 6 modales grandes — un Escape de costumbre que
`revision-final.js` presiona después de exportar (de cuando Escape
todavía no hacía nada) cerraba el dashboard ENTERO de ORLANT en vez de
solo el popup (que, confirmado, ya estaba cerrado por su propio botón
"Excel" en el momento exacto del Escape). Corregido en
`motion-helpers.js`: un popup interno todavía abierto intercepta Escape
primero; un popup cerrado hace <400ms por cualquier camino (clic,
clic afuera, o su propio Escape) deja ese Escape "gastado" sin cascadear
al overlay. 4 pruebas nuevas que fallan sin el arreglo, confirmadas con
`git stash`. **Reproducción de punta a punta tras el fix: 0 errores,
`correrChequeosAdmin()` completo en las 8 pestañas reales.** La
atribución anterior ("arranque en frío tras deploy") era incorrecta —
corregida en `docs/pendientes.md`.

### Fase 136 (cerrada) — Mejoras visuales y movimiento: ejecuta el plan de 8 PRs de la auditoría de la Fase 135

Ejecuta el plan de `docs/auditoria-ui-fase135.md`: jerarquía visual,
espaciado, tipografía, botones, cards, menús/pestañas, formularios,
hover/focus/active, transiciones entre secciones y microinteracciones,
movimiento suave y sobrio — sin cambiar ningún número ni empeorar lo
logrado en la Fase 133 (contraste AA, foco visible, objetivos táctiles,
`prefers-reduced-motion`). 9 PRs de código (#369-#377, detalle completo
de cada uno en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)):
F01 (pestañas de ORLANT no se superponen en móvil), F02 (CLS real al
abrir Calidad/Cargar Datos, de 0.81 a reservado), tokens de espaciado/
radios/sombras, base de movimiento (tokens + interruptor
`data-motion="off"`, **sin vendorizar** `motion` — medido en 49 KB gzip
real, más del doble de lo estimado en la Fase 135, sin necesitarlo para
los 2 casos de uso reales), componentes base (botones/formularios/menú
lateral), F03 (transición entre pestañas + configuración central de
animación de Chart.js, antes 0 módulos la configuraban), F09
(microinteracciones + "Sin datos" consistente), F08+F11 (toast de error
en login antes de iniciar sesión corregido; pantalla completa
verificada), y F04 (**PR 8, el de mayor riesgo**: los 6 modales/overlays
de la plataforma comparten entrada/salida animada + Escape nuevo,
aprobado con "OK modales" tras 2 condiciones resueltas en el mismo PR —
estado base ahora visible por *progressive enhancement*, y ya no se
oculta un modal que se reabrió durante su propia salida). PR 9
(aparición al scroll) se descartó explícitamente — sin candidato real,
tal como anticipaba la propia auditoría.

**Verificación de cierre en producción** (2026-10-09, solo lectura,
Playwright visible, sesión real del usuario): confirmado en vivo 0
errores de consola/peticiones fallidas en MOBILIZE (3 pestañas, claro y
oscuro), tema oscuro, los 3 modales del PR 8 con Escape, y F01 en móvil
412px. **Un hallazgo real sin resolver** quedó documentado en
`docs/pendientes.md` §4: el chequeo de datos/canvas de
`revision-final.js` (sin relación con el PR 8) falló al cambiar de
pestaña en ORLANT con datos reales (no reproduce en local) — se
encontró `transition:all` en `.atab`, preexistente a esta fase, como
sospechoso principal, sin confirmar la causa exacta todavía. La cuenta
CLIENTES_DASH sigue sin verificar (contraseña temporal pendiente de
InCo). F07 y F10 (fuera de alcance, decisión explícita del usuario)
quedan en `docs/pendientes.md` §3.

Versión final `1.25.0`.

### Fase 135 (cerrada) — Auditoría completa de UI/UX y movimiento (solo auditoría, nada del producto cambió)

Pedido: auditar jerarquía/espaciado/tipografía/componentes/estados,
decidir qué librería de movimiento usar, y dejar un informe + capturas
demo para que el usuario decida la Fase 136 — **sin tocar código del
producto, sin instalar nada, sin tocar producción**. Entregable:
[`docs/auditoria-ui-fase135.md`](docs/auditoria-ui-fase135.md) (resumen
ejecutivo, decisión de librería con números reales, inventario de
consistencia contado con `grep`, 13 hallazgos con evidencia, línea base
de rendimiento medida con CDP, especificación de movimiento y plan de 8
PRs temáticos para la Fase 136) + 49 capturas en
`docs/capturas-demo/fase135-antes/` (seed:demo, nunca producción).

**Paso 1 (librería):** confirmado con números reales (descarga en una
carpeta temporal fuera del repo, borrada al terminar) que `motion`
(sucesor JS-plano de Framer Motion) vendorizado pesa **22 KB gzip**,
encaja en `public/js/vendor/` igual que Chart.js, sin tocar la CSP actual
(`scriptSrc 'self'`). Recomendación: CSS puro para hover/focus/active/tap
+ `motion` vendorizado para aparición al scroll/entradas escalonadas;
migrar a React queda documentado como descartado (esfuerzo/riesgo, sin
beneficio que `motion` no dé ya).

**Hallazgos más relevantes:** bug real de responsive (pestañas de ORLANT
se superponen a 412px, severidad alta), CLS de 0.81 al abrir un dashboard
(0 tareas largas >50ms — el salto es de layout, no de JavaScript lento),
Chart.js sin configuración de animación propia en ningún módulo (usa el
default ~1000ms en cada refresco), 5 sistemas de modal/overlay
independientes sin una sola transición compartida, y sin escala de
espaciado/radios/sombras (60 valores de `padding` distintos, 20 de
`border-radius`, pese a que ya existen 65 tokens de color/tipografía
desde la Fase 133). `ui-ux-pro-max-skill` (pedida como guía principal) no
está instalada — documentado el hueco y el comando sugerido, sin
instalarla. Detalle completo, con la discrepancia real encontrada entre
las pestañas que el pedido asumía y las que existen hoy en ORLANT/
Mobilize, en `docs/auditoria-ui-fase135.md`.

Esta fase **no cambia la versión de la app** (1.21.0 sin cambios) — no
tocó código del producto, solo documentación y capturas demo.

### Fase 131 (cerrada) — Cliente Mobilize: Flujo de Llamadas, Tipificación CDR, "Última actualización"

Partes 1, 2, 3, 4 y 6 (detalle completo en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)):
cliente renombrado de "MOVILIZE" a "MOBILIZE" en todo el código y en
producción (migración idempotente, sin que nadie perdiera acceso);
pestaña "Flujo de Llamadas" reusando el motor de Tráfico de ORLANT;
pestaña "Tipificación" reusando el motor de ORLANT (CDR, 5 columnas
nuevas opcionales); "Última actualización" visible en cada dashboard
(naranja Mobilize, verde de marca el resto). Carga real de
septiembre/2026 hecha y verificada contra producción en las 2 bases
(Flujo de Llamadas 27 filas, Tipificación 167 filas tras excluir
"PRUEBA"). La Parte 5 (marca InConexion®) se separó como **Fase 132** al
llegar los archivos de diseño.

### Fase 132 (cerrada) — Marca InConexion®: logo, colores oficiales y tipografía

Cambio puramente visual (detalle completo en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)):
logo real (con el símbolo de red y el ®) en login/navbar/bienvenida, con
versión clara/oscura donde el fondo cambia de verdad con el tema;
favicon nuevo; `--c-brand` (navbar/botones/headers) pasa al teal OFICIAL
muestreado del logo (`#004150`, mejora el contraste con texto blanco);
tipografía Quicksand autoalojada (nunca Google Fonts), 4 pesos, ~61KB.
`--c-primary` (texto en >100 reglas) se dejó intacto a propósito — ya
era casi idéntico, tocarlo no aportaba nada visible. 10 pruebas nuevas
+ suite completa 1321/1321, `npm audit` en 0, auditoría amplia local
(`scripts/qa/auditoria-amplia-local.js`) en 0 hallazgos, capturas
Playwright propias revisadas una por una (claro/oscuro/1366×768/móvil).
2 hallazgos de contraste **pre-existentes** encontrados y NO corregidos
(fuera de alcance de esta fase, pertenecen a la Fase 121 de diseño/
accesibilidad): `.toast`/`.btn-login`/`.btn-primary` en tema oscuro, y
el encabezado del dashboard montándose en móvil — ambos confirmados
idénticos con la letra vieja, no los causó este cambio.

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

(Fase 129 — detalle narrativo movido a
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
al cerrar la Fase 136, para no dejar crecer este resumen sin límite —
ver su línea en el índice más abajo.)

## Índice — fases 0 a 136

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
- Fase 29 — Auditoría general de la plataforma ("Radiografía InConexion®") + 4 mejoras técnicas (2026-09-17)
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
- Fase 131 — Cliente Mobilize: pestañas "Flujo de Llamadas" y "Tipificación" reusando el motor de ORLANT, "Última actualización" visible en cada dashboard (naranja Mobilize/verde de marca el resto), carga real de septiembre/2026 verificada en producción (2026-10-08)
- Fase 132 — Marca InConexion®: logo real, favicon, teal oficial de marca (`#004150`) y tipografía Quicksand autoalojada; cambio puramente visual, 2 hallazgos de contraste pre-existentes documentados sin corregir (fuera de alcance, pertenecen a la Fase 121) (2026-10-08)
- Fase 134 — Solo ORLANT y MOBILIZE quedan en producción: borrado de los otros 12 clientes (0 filas de datos reales, solo plantilla vacía), migración idempotente `fase134_borrar_clientes_v1`; **incidente de proceso real** (cierre retroactivo en la Fase 137): el PR se mergeó y desplegó sin el dry-run ni el "OK borrar" planeados — verificación posterior reportó 0 pérdida de datos; regla nueva en `CLAUDE.md` a partir de esto (2026-10-08)
- Fase 135 — Auditoría completa de UI/UX y movimiento (solo auditoría, sin tocar producto ni producción): decisión de librería de movimiento con números reales (`motion` vendorizado, 22 KB gzip), inventario de consistencia contado con `grep`, 13 hallazgos con evidencia (bug de responsive en pestañas de ORLANT a 412px, CLS 0.81 al abrir un dashboard, Chart.js sin config de animación propia, 5 sistemas de modal sin transición compartida), línea base de rendimiento medida y plan de 8 PRs para la Fase 136 (2026-10-08)
- Fase 136 — Mejoras visuales y movimiento: ejecuta el plan de 8 PRs de la auditoría de la Fase 135 (F01 pestañas móviles, F02 CLS, tokens, base de movimiento sin vendorizar `motion` -- 49 KB gzip real, más del doble de lo estimado --, componentes base, F03 transición de pestañas + Chart.js, F09 microinteracciones, F08+F11 toast de login + pantalla completa, y F04 modales unificados con Escape, el PR de mayor riesgo, aprobado con "OK modales" tras 2 condiciones de progressive enhancement/reabrir-durante-salida); PR 9 (scroll) descartado sin candidato real; verificación de cierre en producción confirmó MOBILIZE/tema oscuro/modales/F01 en vivo, con 1 hallazgo sin resolver (inestabilidad real, no reproducible en local, al cambiar de pestaña en ORLANT -- documentado, no es regresión de esta fase) (2026-10-09)

