# Módulo de Calidad conectado a la plataforma — diagnóstico y plan

Fase 233, 04/11/2026. **Solo lectura y plan**: no se cambió código. Parte del
análisis de la Fase 94 ([`calidad-flujo-edwin-brecha.md`](calidad-flujo-edwin-brecha.md))
y del pedido de Edwin en la reunión del 04/11. Edwin dijo que esto se
trabaja después y con calma.

> **Prototipo HTML de Edwin**: no se revisó en esta fase porque todavía no
> está en el equipo. Cuando llegue, se guarda **fuera del repo** (por ejemplo
> en la carpeta de bases de Edwin) y se completan las secciones 4 y 5 sin
> copiar datos reales: ni nombres de asesores, ni cédulas, ni teléfonos.

## Lo que pidió Edwin (04/11)

- **Roles**:
  - **CALIDAD** escoge una plantilla, monitorea a un asesor y guarda. Ve el
    resumen por asesor y el diccionario.
  - **ASESOR** solo ve sus resultados y el diccionario, en su propia pantalla.
  - **RESULTADO** ve el resumen por asesor, el diccionario y el interactivo,
    dentro del dashboard de cada cliente, en una pestaña "Calidad" (por
    ejemplo ORLANT › Calidad).
- **Acceso por plantilla**: al crear un usuario de calidad, el administrador
  elige a qué plantillas tiene acceso (una, varias o todas). Cada plantilla es
  diferente.
- **Plantillas**: ya están listas las de SURA, Aurora, Hospital La María y
  ORLANT. Falta la de Mobilize, que la manda Kelly.
- **Tiempo real**: cuando calidad guarda un monitoreo, el asesor recibe un
  aviso y se actualiza el reporte de Calidad.
- **Todos los asesores**: van a entrar todos, así que la lista de usuarios de
  Admin debe poder filtrarse o agruparse por campaña y por rol.
- **Login**: se usan los usuarios y el login de la plataforma; el login del
  prototipo de Edwin era solo para explicar.

## 1. Tabla de brecha

Qué cambió desde la Fase 94:
- la Fase 95 bloqueó la fecha y el evaluador, agregó la lista de
  codificaciones y el aviso al asesor;
- la Fase 134 dejó solo las plantillas de ORLANT y Mobilize;
- la Fase 153 hizo que la lista de campañas de Calidad salga del registro de
  clientes;
- la Fase 172 agregó el Resumen de calidad por asesor de Mobilize, cargado
  desde Excel;
- la Fase 222 hizo que las casillas de un usuario nuevo nazcan sin marcar.

| Pieza del pedido | Estado | Dónde (archivo:línea) |
|---|---|---|
| Login y usuarios de la plataforma | **Ya existe** | `server/auth.js`, `server/routes/usuarios.js` |
| Rol CALIDAD crea monitoreos de una campaña con permiso | **Ya existe** | `canEvaluateCampaign`, `server/auth.js:201-205`; `POST /monitoreos`, `server/routes/calidad.js:314` |
| Calidad "escoge una plantilla" | **Existe distinto** | Hoy hay **una plantilla por campaña**: `calidad_plantillas.campana` es `UNIQUE` (`server/db.js:98-105`). Se escoge la campaña y la plantilla viene sola. No hay varias plantillas en un mismo cliente |
| Plantillas de SURA, Aurora, HLM y ORLANT | **Existe distinto** | Solo hay ORLANT (17 ítems) y una genérica para Mobilize (`server/calidad-plantillas-seed.js:61-64`). Las de Aurora y SURA se quitaron en la Fase 134. HLM nunca tuvo plantilla. Falta cargar las 4 de Edwin |
| Motor de puntaje | **Ya existe** (2 motores) | `computeScore`, `server/calidad-logic.js:18-57`. `standard`: crítico en NO resta 20 y N/A suma el peso. `sura`: solo SI suma y los críticos solo cuentan fallos |
| "No aplica" | **Ya existe** | `N/A` en los dos motores (mismo archivo) |
| Fecha del día y evaluador fijos | **Ya existe** (Fase 95) | `public/index.html:1024` y `:1037` (`disabled`); `public/js/calidad.js:424-427` |
| Codificación en lista | **Ya existe** (Fase 95) | Tabla `calidad_codificaciones`, `server/db.js:114-127`. Si una campaña no tiene lista, la codificación sigue en texto libre |
| Diccionario | **Existe distinto** | Solo como hoja "Diccionario" del Excel de carga masiva (`public/js/calidad-carga-masiva.js:4`, `:38`). No hay una pantalla de diccionario para el asesor ni para el cliente |
| ASESOR ve solo sus resultados | **Ya existe** | `GET /monitoreos/mios`, `server/routes/calidad.js:231-246` (por `asesorUserId`, o por nombre y campaña en los viejos); pantalla "Mis Resultados", `public/js/mis-resultados.js` |
| Aviso al asesor | **Ya existe al iniciar sesión** (Fase 95) | Banner "Tienes N monitoreos nuevos" y contador en el menú (`public/js/mis-resultados.js:55-86`, se llama en `public/js/session.js:178`); `GET /monitoreos/mios/nuevos` y `PUT /monitoreos/:id/visto`, `server/routes/calidad.js:253-290`. **Falta** que llegue mientras la sesión ya está abierta |
| Reporte de Calidad "se actualiza" | **Existe distinto** | Se actualiza al abrir o recargar la pestaña. No se refresca solo |
| Pestaña Calidad en el dashboard del cliente | **Ya existe** (parcial) | ORLANT: `calidad_kpis`, `calidad_pie` y `calidad_bar_asesores` (`server/dashboard-config-seed.js:243-247`, dibujo en `_gdRenderCalidad`, `public/js/dashboard-generic.js:2038`). Mobilize: `calidad_resumen_panel` (Fase 172, desde Excel, no desde monitoreos) |
| Resumen por asesor (tabla) e "interactivo" | **Existe distinto** | Barras de promedio por asesor (`calidad_bar_asesores`). No hay tabla ítem por ítem ni filtros como los del prototipo (pendiente de verlo) |
| Acceso por plantilla al crear el usuario | **Falta** | Hoy el acceso es por campaña (`campana_<CLIENTE>`), `buildCampaignCheckboxes`, `public/js/users.js:202` |
| Lista de usuarios por campaña y rol | **Falta** | `renderUsers`, `public/js/users.js:7-14`: un solo buscador de texto (nombre, usuario o rol); no hay filtro por campaña ni agrupación |
| Campañas con Calidad | **Ya existe** | Salen del registro de clientes (módulo `calidad`), `server/clientes-registro.js:153-155` |

## 2. Roles

- **CALIDAD y ASESOR se reutilizan** tal cual: ya tienen pantallas, permisos y
  pruebas.
- **RESULTADO**: recomiendo **no crear un rol nuevo**. Es un **permiso de ver
  la pestaña Calidad** sobre los roles que ya ven el dashboard del cliente
  (CLIENTES_DASH, SUPERVISOR y GERENCIA).
  - **Por qué**: la pestaña Calidad vive dentro del dashboard del cliente, y
    quien entra ahí ya tiene `cliente_<CLIENTE>`. Un rol nuevo obligaría a
    repetir el acceso al dashboard, el menú y las pruebas de permisos.
  - **Cómo**: la pestaña Calidad se muestra solo si el usuario tiene el permiso
    `ver_calidad` (una casilla nueva en el formulario, apagada por defecto). El
    administrador la ve siempre.
  - **Riesgo a cuidar**: los datos personales. Hoy el cliente ve nombres de
    asesor solo donde `asesorVisibleCliente` lo permite
    (`server/clientes-registro.js:160`). Hay que mantener esa misma regla.

## 3. Permiso por plantilla

- **Cómo guardarlo**: recomiendo permisos `plantilla_<id>` en el mismo JSON de
  `perms` de cada usuario, igual que `campana_<CLIENTE>` y `cargar_<modulo>`.
  - Así se reutilizan el formulario, `accesosSinEscalar` (Fase 222) y el
    historial de cambios.
  - Una tabla aparte solo valdría la pena si las plantillas se crearan y
    borraran muy seguido, y no es el caso.
- **Regla en el servidor**: un usuario CALIDAD puede monitorear con una
  plantilla solo si tiene `campana_<CLIENTE>` y `plantilla_<id>`. Las dos se
  revisan en `POST /monitoreos`, nunca solo en el navegador.
- **En el formulario de usuario**: con el rol CALIDAD aparece, debajo de las
  campañas, el grupo "Plantillas", agrupado por cliente. El grupo tiene un
  botón "Todas las de este cliente" y casillas **sin marcar por defecto**.
  - Se repiten las reglas de la Fase 222 (bug H1): no se guarda sin al menos
    una plantilla, y nadie da una plantilla que él mismo no tiene.
- **Usuarios de calidad que ya existen**: hay que decidir si la migración les
  da todas las plantillas de sus campañas (para no cortarles el trabajo) o
  ninguna. **Se le pregunta al usuario antes de construir.**

## 4. Plantillas

- **Lo que hay que cambiar en la base**: permitir varias plantillas por
  cliente. Se quita el `UNIQUE(campana)` y se agregan `id` estable, `nombre` y
  `cliente`.
  - Los monitoreos deben guardar con qué plantilla se hicieron
    (`plantillaId`), porque si no, cambiar una plantilla recalcula mal los
    monitoreos viejos.
  - La migración es idempotente y no destructiva: las plantillas de ORLANT y
    Mobilize siguen con el mismo id lógico, y los monitoreos viejos quedan
    con esa plantilla.
- **Lo que hace falta de cada plantilla de Edwin**: ítems con su categoría,
  peso, si es crítico, si admite "No aplica", y el texto del diccionario de
  cada ítem.
  - El diccionario es nuevo: hoy cada ítem tiene solo `label`, así que hay que
    agregar `descripcion`.
- **Si el motor actual sirve**:

  | Plantilla | Motor probable | Qué falta confirmar |
  |---|---|---|
  | ORLANT | `standard` (ya está) | Si cambió la plantilla de 17 ítems (pregunta 2 de la Fase 94, sigue abierta) |
  | SURA | `sura` (ya existe, sin uso desde la Fase 134) | Que la fórmula del prototipo sea esa: solo SI suma y los críticos solo cuentan |
  | Aurora | ¿`standard`? | Pesos, críticos y si el crítico resta 20 |
  | Hospital La María | ¿`standard`? | Lo mismo; y si va por sede |
  | Mobilize | — | La plantilla la manda Kelly; hoy usa una genérica |

  Si alguna plantilla del prototipo usa otra fórmula (por ejemplo, un crítico
  en NO deja la nota en 0, o se pondera por categoría), se agrega un motor
  nuevo en `computeScore` con su prueba, sin tocar los dos que ya existen.
- **Cómo se cargan**: con una migración por plantilla, a partir de un archivo
  de ítems que Edwin entrega sin datos de personas. No se cargan escribiendo
  a mano en la base de producción.

## 5. Pestaña Calidad en el dashboard del cliente

- **Lo que hay hoy en ORLANT**:
  - tarjetas de resumen (`calidad_kpis`);
  - torta de clasificación (`calidad_pie`);
  - barras de promedio por asesor (`calidad_bar_asesores`).

  Todo sale de los monitoreos (`CAL_DB`) y se filtra por MESES.
- **Lo que hay hoy en Mobilize**: el Resumen de calidad por asesor, cargado
  desde Excel (`calidad_resumen_panel`, Fase 172), más tarjetas y torta.
- **Lo que falta para el prototipo**:
  - **Resumen por asesor en tabla**: asesor, cantidad de monitoreos, nota
    promedio, fallos críticos y, quizá, el % por categoría. Sale de los mismos
    monitoreos, sin datos nuevos.
  - **Diccionario**: la lista de ítems de la plantilla con su descripción,
    peso y si es crítico. Es de solo lectura y sale de la plantilla.
  - **"Interactivo"**: hay que verlo en el prototipo. Podría ser hacer clic en
    un asesor y ver el detalle ítem por ítem (como en "Mis Resultados"), o
    filtros por plantilla, evaluador o canal.
  - **Filtro por plantilla**, si un cliente tiene más de una.

## 6. Aviso al asesor y "tiempo real"

El aviso al iniciar sesión ya existe (Fase 95). Lo que falta es que llegue
**mientras la sesión ya está abierta**, y que el reporte del cliente se
refresque solo. No hay precedente de conexión abierta (WebSocket o
EventSource) en la plataforma.

| Opción | Cómo funciona | Costo | Riesgo |
|---|---|---|---|
| A. Aviso al iniciar sesión (hoy) | Banner y contador al entrar | Ya está | No llega si la sesión sigue abierta todo el día |
| B. Consultar cada pocos minutos (**recomendada**) | El portal del asesor pide `GET /monitoreos/mios/nuevos` cada 2–5 minutos, solo con la pestaña visible; el dashboard de Calidad vuelve a pedir sus datos cada 5 minutos o al volver a la pestaña | Chico: 1 PR, sin infraestructura nueva | Bajo: una consulta liviana con índice; respeta el límite de tasa |
| C. Refrescar al abrir | Al entrar a "Mis Resultados" o a la pestaña Calidad se piden datos frescos | Muy chico | No avisa si el asesor no abre nada |
| D. Conexión abierta (SSE) | El servidor empuja el aviso al guardar | Grande: conexiones abiertas en Caddy y Node, reconexión, pruebas nuevas, una sola instancia | Medio: es infraestructura nueva para una ganancia de segundos |

**Recomendación**: B más C. Para "tiempo real" en un contact center, un
aviso que llega en menos de 5 minutos alcanza, y no agrega piezas nuevas en
producción. La caché por usuario (Fase 161) ya se limpia cuando cambian los
datos (`datos_version`); hay que confirmar que guardar un monitoreo la limpie.

## 7. Lista de usuarios por campaña y rol en Admin

- **Filtros arriba de la tabla**: "Rol" (desplegable) y "Campaña" (desplegable
  con las campañas de Calidad y los clientes), además del buscador de texto
  que ya existe.
- **Agrupar por campaña**: un interruptor que pinta un encabezado por campaña.
  Un asesor sale bajo su `asesorCampana`; un usuario de calidad, bajo cada
  campaña que tiene.
- **Contador**: "N usuarios" según el filtro.
- **Tamaño**: con todos los asesores pueden ser cientos de filas. Se filtra
  en el navegador (la lista ya llega completa). Si pasa de unas 500 filas, se
  agrega paginación.
- **Carga masiva de asesores**: si van a entrar todos, crear uno por uno no
  escala. Conviene una carga desde Excel (nombre, usuario, campaña) con
  contraseña temporal y cambio obligatorio al primer ingreso. Es un tema
  aparte, con su propio PR y revisión de seguridad.

## 8. Plan por fases

PRs pequeños, en este orden. Ninguno se empieza sin el OK del usuario, y los
que dependen de Edwin esperan sus respuestas.

| # | PR | Qué hace | Tamaño | Depende de |
|---|---|---|---|---|
| 1 | Usuarios por campaña y rol | Filtros, agrupar y contador en Admin › Usuarios (sección 7) | S | Nada: se puede hacer ya |
| 2 | Aviso cada pocos minutos | Opción B y C de la sección 6 | S | Nada |
| 3 | Varias plantillas por cliente | Migración de `calidad_plantillas` (id, nombre, cliente, descripción por ítem) y `monitoreos.plantillaId`; ORLANT y Mobilize igual | M | Nada (no cambia nada visible) |
| 4 | Permiso por plantilla | `plantilla_<id>` en el formulario, sin marcar por defecto, validado en el servidor | M | 3 y la decisión sobre los usuarios que ya existen |
| 5 | Selector de plantilla en "Nuevo monitoreo" | CALIDAD elige entre sus plantillas | S | 4 |
| 6 | Cargar plantillas de Edwin | Una migración por plantilla (SURA, Aurora, HLM, ORLANT actualizada) | S cada una | Archivos de ítems de Edwin y confirmar el motor de cada una |
| 7 | Diccionario | Pantalla de diccionario para el asesor y en la pestaña Calidad | S | 3 y 6 |
| 8 | Resumen por asesor en la pestaña Calidad | Tabla por asesor y detalle al hacer clic | M | Ver el prototipo |
| 9 | Permiso `ver_calidad` (RESULTADO) | Casilla en el formulario; la pestaña Calidad se muestra solo con ese permiso | S | 8 |
| 10 | Plantilla de Mobilize | Igual que el 6 | S | Kelly |
| 11 | Carga masiva de asesores (opcional) | Excel → usuarios ASESOR con contraseña temporal | M | OK aparte y revisión de seguridad |

Tamaños: S = menos de un día; M = 1 o 2 días, con pruebas y verificación.

## Preguntas para Edwin

1. ¿Puedes mandar el HTML de prueba (o la ruta donde quedó)? Se guarda fuera
   del repo.
2. ¿Cada cliente tiene **una** plantilla o puede tener **varias**? Por
   ejemplo, ¿ORLANT llamadas y ORLANT WhatsApp son plantillas distintas?
3. Para cada plantilla (SURA, Aurora, HLM, ORLANT): ¿cuáles ítems son
   críticos?, ¿un crítico en "No" resta 20 puntos (como ORLANT), deja la nota
   en 0 o solo se cuenta?, ¿cuáles ítems admiten "No aplica"?
4. ¿El diccionario es un texto por ítem, o también trae ejemplos y
   categorías?
5. ¿Qué es exactamente el "interactivo" de la vista de resultados?
6. ¿Quién debe ver la pestaña Calidad del cliente: el cliente (por ejemplo
   Jairo), solo gerencia o los dos? ¿Ve los nombres de los asesores?
7. "Tiempo real": ¿le sirve que el aviso llegue en unos minutos, o necesita
   que salga en el mismo segundo?
8. ¿Los usuarios de calidad que ya existen deben quedar con **todas** las
   plantillas de sus campañas o empezar sin ninguna?
9. ¿Van a entrar todos los asesores? ¿Cuántos son, más o menos? ¿Hay una lista
   en Excel para crearlos de una vez?
10. Hospital La María: ¿la plantilla es la misma para Sede 33 y Castilla?
11. Las preguntas 1, 2, 3, 6 y 9 de la Fase 94 siguen abiertas (fórmula,
    pesos de ORLANT, si el asesor acepta el monitoreo, si la fecha puede ser
    de un día anterior y el límite por asesor).
